"""Engrave song phrases with Verovio and turn them into slide-ready PNGs.

song phrases --> MEI --> Verovio SVG --> resvg PNG --> recolored, cropped PNG
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path
from xml.sax.saxutils import escape

import resvg_py
import verovio
from PIL import Image

from .songformat import Event, Measure, Song, SongError, parse_lyrics

FONT_DIR = Path(__file__).parent / "fonts"
LYRIC_FONT = "Fira Sans"
PNG_WIDTH = 3600
MIN_LYRIC_PT = 30.0

# Space for the music on a 13.333 x 7.5 in slide, below the 30 pt section label.
SLIDE_MUSIC_BOX = (12.9, 6.4)

verovio.enableLog(verovio.LOG_ERROR)


# ---------------------------------------------------------------- MEI building

class _Ids:
    def __init__(self):
        self.n = 0

    def __call__(self, prefix: str) -> str:
        self.n += 1
        return f"{prefix}{self.n}"


def _keysig(fifths: int) -> str:
    if fifths == 0:
        return "0"
    return f"{abs(fifths)}{'s' if fifths > 0 else 'f'}"


ACCID = {1: "s", -1: "f", 0: "n"}


@dataclass
class Line:
    """One system: a phrase plus the lyric line sung to it."""
    phrase: str
    lyrics: str | None


def build_mei(song: Song, lines: list[Line], final: bool = True) -> str:
    ids = _Ids()
    out = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">',
        f"<meiHead><fileDesc><titleStmt><title>{escape(song.title)}</title></titleStmt>"
        "<pubStmt/></fileDesc></meiHead>",
        "<music><body><mdiv><score>",
        f'<scoreDef><keySig sig="{_keysig(song.fifths)}"/>'
        f'<meterSig count="{song.time[0]}" unit="{song.time[1]}"/>'
        '<staffGrp symbol="brace" bar.thru="true">'
        '<staffDef n="1" lines="5"><clef shape="G" line="2"/></staffDef>'
        '<staffDef n="2" lines="5"><clef shape="F" line="4"/></staffDef>'
        "</staffGrp></scoreDef>",
        "<section>",
    ]
    number = 0
    for li, line in enumerate(lines):
        phrase = song.phrases[line.phrase]
        syllables = parse_lyrics(line.lyrics) if line.lyrics else []
        syl_iter = iter(syllables)
        if li > 0:
            out.append("<sb/>")
        ties: dict[tuple[int, int, str, int], bool] = {}
        for mi, (tm, bm) in enumerate(zip(phrase.treble, phrase.bass)):
            number += 1
            partial = tm.length < song.measure_length
            last = mi == len(phrase.treble) - 1
            attrs = f'n="{number}"'
            if partial:
                attrs += ' metcon="false"'
            if last and li == len(lines) - 1 and final:
                attrs += ' right="end"'
            out.append(f"<measure {attrs}>")
            controls: list[str] = []
            out.append(_staff(song, 1, tm, ids, syl_iter, ties, controls))
            out.append(_staff(song, 2, bm, ids, None, ties, controls))
            out.extend(controls)
            out.append("</measure>")
    out.append("</section></score></mdiv></body></music></mei>")
    return "\n".join(out)


def _staff(song, n, measure: Measure, ids, syl_iter, ties, controls) -> str:
    parts = [f'<staff n="{n}">']
    accid_state: dict[tuple[str, int], int] = {}
    two = len(measure.layers) > 1
    for ln, layer in enumerate(measure.layers, start=1):
        stem = ("up" if ln == 1 else "down") if two else None
        lyr = syl_iter if (ln == 1 and syl_iter is not None) else None
        parts.append(f'<layer n="{ln}">')
        parts.append(_layer(song, n, ln, layer, ids, lyr, stem, accid_state, ties, controls))
        parts.append("</layer>")
    parts.append("</staff>")
    return "".join(parts)


def _beam_groups(song: Song, layer: list[Event]) -> list[tuple[int, int]]:
    """Index ranges [start, end) of events to beam together, beat by beat."""
    beat = Fraction(3, 8) if song.compound else Fraction(1, song.time[1] if song.time[1] <= 4 else 4)
    groups, pos, cur, cur_beat = [], Fraction(0), [], None
    for i, ev in enumerate(layer):
        start_beat = pos // beat
        end_beat = (pos + ev.dur - Fraction(1, 1024)) // beat
        beamable = not ev.is_rest and ev.dur < Fraction(1, 4) and start_beat == end_beat
        if beamable and (cur_beat is None or start_beat == cur_beat):
            cur.append(i)
            cur_beat = start_beat
        else:
            if len(cur) > 1:
                groups.append((cur[0], cur[-1] + 1))
            cur, cur_beat = ([i], start_beat) if beamable else ([], None)
        pos += ev.dur
    if len(cur) > 1:
        groups.append((cur[0], cur[-1] + 1))
    return groups


def _layer(song, staff_n, layer_n, layer, ids, syl_iter, stem, accid_state, ties, controls) -> str:
    beams = _beam_groups(song, layer)
    starts = {s for s, _ in beams}
    ends = {e - 1 for _, e in beams}
    xml = []
    for i, ev in enumerate(layer):
        if i in starts:
            xml.append("<beam>")
        xml.append(_event(song, staff_n, layer_n, ev, ids, syl_iter, stem, accid_state, ties, controls))
        if i in ends:
            xml.append("</beam>")
    return "".join(xml)


def _event(song, staff_n, layer_n, ev: Event, ids, syl_iter, stem, accid_state, ties, controls) -> str:
    dur = f'dur="{ev.mei_dur}"' + (f' dots="{ev.dots}"' if ev.dots else "")
    if ev.is_rest:
        return f'<rest xml:id="{ids("r")}" {dur}/>'

    tie_key = lambda p: (staff_n, layer_n, p.step, p.octave)  # noqa: E731
    continues_tie = all(ties.get(tie_key(p)) for p in ev.pitches)
    notes = []
    for p in ev.pitches:
        attrs = f'xml:id="{ids("n")}" pname="{p.step.lower()}" oct="{p.octave}"'
        # Accidentals: print only when the sound differs from what the reader expects.
        state_key = (p.step, p.octave)
        expected = accid_state.get(state_key, song.key_alter(p.step))
        if ties.get(tie_key(p)) or p.alter == expected:
            if p.alter != 0:
                attrs += f' accid.ges="{ACCID[p.alter]}"'
        else:
            attrs += f' accid="{ACCID[p.alter]}"'
        accid_state[state_key] = p.alter
        tie_in = ties.get(tie_key(p), False)
        if tie_in and p.tie:
            attrs += ' tie="m"'
        elif tie_in:
            attrs += ' tie="t"'
        elif p.tie:
            attrs += ' tie="i"'
        ties[tie_key(p)] = p.tie
        notes.append(attrs)
    # Any pitch in the layer that was tied but is not here any more ends its tie.
    for key in list(ties):
        if key[:2] == (staff_n, layer_n) and (key[2], key[3]) not in {(p.step, p.octave) for p in ev.pitches}:
            ties[key] = False

    verse = ""
    if syl_iter is not None and not continues_tie:
        syl = next(syl_iter, None)
        if syl is not None and syl.text:
            sattr = ""
            if syl.wordpos:
                sattr += f' wordpos="{syl.wordpos}"'
            if syl.hyphen:
                sattr += ' con="d"'
            elif syl.extend:
                sattr += ' con="u"'
            verse = f'<verse n="1"><syl{sattr}>{escape(syl.text)}</syl></verse>'

    stem_attr = f' stem.dir="{stem}"' if stem else ""
    if len(notes) == 1:
        el_id = notes[0].split('"')[1]
        xml = f"<note {notes[0]} {dur}{stem_attr}>{verse}</note>"
    else:
        el_id = ids("c")
        inner = "".join(f"<note {a}/>" for a in notes)
        xml = f'<chord xml:id="{el_id}" {dur}{stem_attr}>{inner}{verse}</chord>'
    if ev.fermata:
        place = "above" if (staff_n == 1 and layer_n == 1) or stem == "up" else "below"
        controls.append(f'<fermata staff="{staff_n}" startid="#{el_id}" place="{place}"/>')
    return xml


# ---------------------------------------------------------------- rendering

@dataclass
class Engraving:
    png: Image.Image          # RGBA, cropped to the music
    lyric_px: float           # lyric font size in PNG pixels
    lyric_size: float         # Verovio lyricSize used

    def lyric_pt(self, box: tuple[float, float] = SLIDE_MUSIC_BOX) -> float:
        """Lyric size in points once the image is fitted into `box` (inches)."""
        w, h = self.png.size
        width_in = min(box[0], box[1] * w / h)
        return self.lyric_px * 72 * width_in / w


def _toolkit(lyric_size: float, page_width: int) -> verovio.toolkit:
    tk = verovio.toolkit()
    tk.setOptions({
        "breaks": "encoded",
        "header": "none",
        "footer": "none",
        "adjustPageHeight": True,
        "pageWidth": page_width,
        "pageHeight": 60000,
        "pageMarginLeft": 20,
        "pageMarginRight": 20,
        "pageMarginTop": 20,
        "pageMarginBottom": 20,
        "minLastJustification": 0,
        "mnumInterval": 0,
        "lyricSize": lyric_size,
        "lyricTopMinMargin": 3.0,
        "spacingSystem": 10,
        "spacingStaff": 8,
        "scale": 100,
    })
    return tk


def render_svg(mei: str, lyric_size: float, page_width: int) -> str:
    tk = _toolkit(lyric_size, page_width)
    if not tk.loadData(mei):
        raise SongError("Verovio could not read the music (internal MEI error).")
    if tk.getPageCount() != 1:
        raise SongError("The music did not fit on one page.")
    svg = tk.renderToSVG(1)
    # Draw text in the bundled lyric font.
    return svg.replace('font-family="Times, serif"', f'font-family="{LYRIC_FONT}" font-weight="500"')


def _lyric_ratio(svg: str) -> float:
    """Lyric font size as a fraction of the full SVG width."""
    view = re.search(r'viewBox="0 0 ([\d.]+) [\d.]+"', svg)
    sizes = [float(s) for s in re.findall(r'class="syl".*?<tspan font-size="([\d.]+)px"', svg, re.S)]
    if not view or not sizes:
        return 0.0
    return max(sizes) / float(view.group(1))


def svg_to_png(svg: str, width: int = PNG_WIDTH) -> Image.Image:
    data = resvg_py.svg_to_bytes(
        svg_string=svg,
        width=width,
        font_dirs=[str(FONT_DIR)],
        sans_serif_family=LYRIC_FONT,
    )
    return Image.open(io.BytesIO(bytes(data))).convert("RGBA")


def recolor_crop(img: Image.Image, color: str, margin: int = 24) -> Image.Image:
    """Fill the music with one color (keeping its alpha) and crop to the ink."""
    alpha = img.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        l, t, r, b = bbox
        bbox = (max(0, l - margin), max(0, t - margin),
                min(img.width, r + margin), min(img.height, b + margin))
        alpha = alpha.crop(bbox)
    out = Image.new("RGBA", alpha.size, color)
    out.putalpha(alpha)
    return out


def engrave(song: Song, lines: list[Line], color: str = "#111111",
            box: tuple[float, float] = SLIDE_MUSIC_BOX, final: bool = True) -> Engraving:
    """Engrave lines so the lyrics come out at least 30 pt in `box`.

    The page width is chosen so each line is just a little wider than its
    natural spacing (the music fills the slide); the lyric size grows until
    the 30 pt target is met.
    """
    mei = build_mei(song, lines, final)
    best = None
    for lyric_size in [4.5 + 0.25 * i for i in range(15)]:  # 4.5 .. 8 (Verovio's maximum)
        natural = _natural_width(mei, lyric_size)
        page_width = int(natural * 1.04) + 40
        svg = render_svg(mei, lyric_size, page_width)
        full = svg_to_png(svg)
        ratio = _lyric_ratio(svg)
        png = recolor_crop(full, color)
        result = Engraving(png, ratio * full.width, lyric_size)
        best = result
        if result.lyric_pt(box) >= MIN_LYRIC_PT:
            return result
    return best


def _natural_width(mei: str, lyric_size: float) -> float:
    """Width (Verovio page units) the music needs without stretching."""
    tk = _toolkit(lyric_size, 60000)
    tk.setOptions({"noJustification": True, "adjustPageWidth": True})
    tk.loadData(mei)
    svg = tk.renderToSVG(1)
    m = re.search(r'<svg width="([\d.]+)px"', svg)
    return float(m.group(1)) if m else 2100.0


def lines_for(song: Song, section_index: int) -> list[Line]:
    sec = song.structure[section_index]
    words = song.lyrics.get(sec.lyrics, {})
    return [Line(name, words.get(name)) for name in sec.phrases]


def preview_line(song: Song, phrase: str, out: str | Path, color: str = "#111111",
                 background: str = "#FFFFFF") -> Engraving:
    """Engrave one phrase (with the first stanza that sings it) to a PNG."""
    words = None
    for sec in song.structure:
        if phrase in sec.phrases:
            words = song.lyrics.get(sec.lyrics, {}).get(phrase)
            break
    if phrase not in song.phrases:
        raise SongError(f'There is no line named "{phrase}". Lines: {", ".join(song.phrases)}')
    # One line takes half the slide height (slides hold two systems).
    box = (SLIDE_MUSIC_BOX[0], SLIDE_MUSIC_BOX[1] / 2)
    result = engrave(song, [Line(phrase, words)], color, box)
    canvas = Image.new("RGBA", result.png.size, background)
    canvas.alpha_composite(result.png)
    canvas.convert("RGB").save(out)
    return result

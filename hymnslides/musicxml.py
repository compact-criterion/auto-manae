"""Import MusicXML (.musicxml, .xml or compressed .mxl) into a HymnSlides song file.

Works with the usual hymn layouts:
  - one part with two staves (MuseScore's piano/choir layout), voices 1-2 and 5-6
  - two parts (treble and bass), with chords or two voices each
  - four parts (soprano, alto, tenor, bass)

Steps: read every note -> group the staves into treble and bass -> per measure,
merge the voices into chords when they move together, or two layers when they
do not -> cut the music into lines (the file's system breaks, or a few measures
each) so each line starts with its own pickup -> sort lines into stanzas and
refrain from the verse numbers of the lyrics -> write the song file.
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path
from xml.etree import ElementTree as ET

from .songformat import MAJOR_FIFTHS, MINOR_FIFTHS, SongError

ACCIDENTAL = {-1: "b", 0: "", 1: "#"}
# Durations the song format can write, longest first: (length, token).
TOKENS = [(Fraction(1), "w"), (Fraction(3, 4), "h."), (Fraction(1, 2), "h"), (Fraction(3, 8), "q."),
          (Fraction(1, 4), "q"), (Fraction(3, 16), "e."), (Fraction(1, 8), "e"), (Fraction(1, 16), "s")]


# ---------------------------------------------------------------- reading the file

@dataclass
class XNote:
    offset: Fraction                     # from the start of the measure, in whole notes
    dur: Fraction
    pitches: list[tuple[str, int, int]]  # (step, alter, octave); empty = rest
    tie_start: bool = False
    tie_stop: bool = False
    fermata: bool = False
    lyrics: dict[int, tuple[str, str]] = field(default_factory=dict)  # verse -> (syllabic, text)

    @property
    def is_rest(self) -> bool:
        return not self.pitches

    @property
    def end(self) -> Fraction:
        return self.offset + self.dur


@dataclass
class XMeasure:
    streams: dict[tuple, list[XNote]] = field(default_factory=dict)  # (part, staff, voice) -> notes
    new_system: bool = False
    full: Fraction = Fraction(1)         # length the time signature asks for
    repeat: bool = False

    @property
    def length(self) -> Fraction:
        ends = [n.end for notes in self.streams.values() for n in notes]
        return max(ends) if ends else self.full


@dataclass
class XScore:
    title: str = ""
    words: str = ""
    music: str = ""
    fifths: int = 0
    minor: bool = False
    time: tuple[int, int] = (4, 4)
    measures: list[XMeasure] = field(default_factory=list)
    staves: list[tuple] = field(default_factory=list)   # (part, staff) in score order
    clefs: dict[tuple, str] = field(default_factory=dict)  # (part, staff) -> "G", "G8vb", "F", ...
    warnings: list[str] = field(default_factory=list)


def read_xml_root(path: Path) -> ET.Element:
    if path.suffix.lower() == ".mxl":
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            target = None
            if "META-INF/container.xml" in names:
                container = ET.fromstring(z.read("META-INF/container.xml"))
                rootfile = container.find(".//rootfile")
                if rootfile is not None:
                    target = rootfile.get("full-path")
            target = target or next(n for n in names if n.endswith((".xml", ".musicxml")) and "META-INF" not in n)
            return ET.fromstring(z.read(target))
    return ET.parse(path).getroot()


def _strip_ns(root: ET.Element):
    for el in root.iter():
        if isinstance(el.tag, str) and "}" in el.tag:
            el.tag = el.tag.split("}", 1)[1]


def parse_musicxml(path: str | Path) -> XScore:
    path = Path(path)
    try:
        root = read_xml_root(path)
    except (ET.ParseError, zipfile.BadZipFile, StopIteration, KeyError) as exc:
        raise SongError(f"{path.name} is not a MusicXML file I can read ({exc}).") from exc
    _strip_ns(root)
    if root.tag == "score-timewise":
        raise SongError("This MusicXML file is 'timewise'. In MuseScore, export it again as MusicXML.")
    if root.tag != "score-partwise":
        raise SongError(f"{path.name} does not look like a MusicXML score.")

    score = XScore()
    score.title = (root.findtext("work/work-title") or root.findtext("movement-title") or path.stem).strip()
    for creator in root.findall("identification/creator"):
        kind = creator.get("type", "")
        if kind in ("lyricist", "poet", "words"):
            score.words = (creator.text or "").strip()
        elif kind == "composer":
            score.music = (creator.text or "").strip()

    key_seen = time_seen = False
    for pi, part in enumerate(root.findall("part")):
        divisions = 1
        staves = 1
        full = Fraction(1)
        for mi, measure in enumerate(part.findall("measure")):
            while len(score.measures) <= mi:
                score.measures.append(XMeasure())
            xm = score.measures[mi]
            pos = Fraction(0)
            last: XNote | None = None
            for el in measure:
                if el.tag == "attributes":
                    divisions = int(el.findtext("divisions") or divisions)
                    staves = int(el.findtext("staves") or staves)
                    for s in range(1, staves + 1):
                        if (pi, s) not in score.staves:
                            score.staves.append((pi, s))
                    if el.find("key/fifths") is not None and not key_seen:
                        key_seen = True
                        score.fifths = int(el.findtext("key/fifths"))
                        score.minor = (el.findtext("key/mode") or "").strip() == "minor"
                    if el.find("time/beats") is not None:
                        beats, beat_type = el.findtext("time/beats"), el.findtext("time/beat-type")
                        if "+" in beats:
                            raise SongError(f"Measure {mi + 1}: mixed time signatures ({beats}/{beat_type}) "
                                            "are not supported.")
                        if not time_seen:
                            time_seen = True
                            score.time = (int(beats), int(beat_type))
                        full = Fraction(int(beats), int(beat_type))
                    for clef in el.findall("clef"):
                        staff = int(clef.get("number", "1"))
                        sign = clef.findtext("sign") or "G"
                        if (clef.findtext("clef-octave-change") or "0").strip() == "-1":
                            sign += "8vb"
                        score.clefs.setdefault((pi, staff), sign)
                elif el.tag == "print" and pi == 0:
                    if el.get("new-system") == "yes" or el.get("new-page") == "yes":
                        xm.new_system = True
                elif el.tag == "barline" and el.find("repeat") is not None:
                    xm.repeat = True
                elif el.tag == "backup":
                    pos -= Fraction(int(el.findtext("duration")), divisions * 4)
                elif el.tag == "forward":
                    pos += Fraction(int(el.findtext("duration")), divisions * 4)
                elif el.tag == "note":
                    if el.find("grace") is not None or el.find("cue") is not None:
                        continue
                    dur = Fraction(int(el.findtext("duration") or 0), divisions * 4)
                    pitch = None
                    if el.find("pitch") is not None:
                        alter = round(float(el.findtext("pitch/alter") or 0))
                        if abs(alter) > 1:
                            raise SongError(f"Measure {mi + 1}: double sharps and flats are not supported yet.")
                        pitch = (el.findtext("pitch/step"), alter, int(el.findtext("pitch/octave")))
                    ties = {t.get("type") for t in el.findall("tie")} | {t.get("type") for t in el.findall("notations/tied")}
                    if el.find("chord") is not None and last is not None:
                        if pitch:
                            last.pitches.append(pitch)
                        last.tie_start |= "start" in ties
                        continue
                    staff = int(el.findtext("staff") or 1)
                    voice = (el.findtext("voice") or "1").strip()
                    note = XNote(pos, dur, [pitch] if pitch else [], "start" in ties, "stop" in ties,
                                 el.find("notations/fermata") is not None)
                    for lyric in el.findall("lyric"):
                        text = "".join(t.text or "" for t in lyric.findall("text")).strip()
                        if text:
                            number = int(re.sub(r"\D", "", lyric.get("number", "1")) or 1)
                            note.lyrics[number] = ((lyric.findtext("syllabic") or "single").strip(), text)
                    xm.streams.setdefault((pi, staff, voice), []).append(note)
                    last = note
                    pos += dur
            xm.full = full
            if not score.staves:
                score.staves.append((pi, 1))
    if any(m.repeat for m in score.measures):
        score.warnings.append("The music has repeat signs. Repeats are not played out: write the "
                              "repeated part out in full, or list it twice in the structure.")
    return score


# ---------------------------------------------------------------- treble / bass and voices

@dataclass
class Ev:
    """One event of one layer of one staff, ready to write."""
    offset: Fraction
    dur: Fraction
    pitches: list[tuple[str, int, int]]
    tie_start: bool = False
    tie_stop: bool = False
    fermata: bool = False
    lyrics: dict[int, tuple[str, str]] = field(default_factory=dict)


def staff_groups(score: XScore) -> tuple[list[tuple], list[tuple]]:
    """Which (part, staff) staves make the treble line and which the bass line."""
    staves = score.staves
    clefs = [score.clefs.get(s, "G") for s in staves]
    low = [s for s, c in zip(staves, clefs) if c.startswith("F") or c.endswith("8vb")]
    high = [s for s in staves if s not in low]
    if high and low:
        return high, low
    if len(staves) == 1:
        return staves, []
    if len(staves) == 2:
        return staves[:1], staves[1:]
    half = len(staves) // 2
    return staves[:half], staves[half:]


def _fill(notes: list[XNote], length: Fraction) -> list[XNote]:
    """Sort a voice and fill gaps with rests, so it covers the whole measure."""
    out, pos = [], Fraction(0)
    for n in sorted(notes, key=lambda n: n.offset):
        if n.offset < pos:  # overlapping: keep the earlier note
            continue
        if n.offset > pos:
            out.append(XNote(pos, n.offset - pos, []))
        out.append(n)
        pos = n.end
    if pos < length:
        out.append(XNote(pos, length - pos, []))
    return out


def _rhythm(notes):
    return [(n.offset, n.dur) for n in notes]


def _midi(p):
    return 12 * (p[2] + 1) + {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[p[0]] + p[1]


def _to_ev(n: XNote) -> Ev:
    return Ev(n.offset, n.dur, list(n.pitches), n.tie_start, n.tie_stop, n.fermata, dict(n.lyrics))


def merge_staff(measure: XMeasure, staves: list[tuple], number: int) -> list[list[Ev]]:
    """The layers (one or two) of one line (treble or bass) in one measure."""
    length = measure.length
    streams = [notes for key, notes in sorted(measure.streams.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2]))
               if (key[0], key[1]) in staves]
    singing = [_fill(s, length) for s in streams if any(not n.is_rest for n in s)]
    if not singing:
        return [[Ev(Fraction(0), length, [])]]
    if len(singing) == 1:
        return [[_to_ev(n) for n in singing[0]]]

    # Group voices that move together into chords.
    groups: list[list[list[XNote]]] = []
    for s in singing:
        for g in groups:
            if _rhythm(g[0]) == _rhythm(s):
                g.append(s)
                break
        else:
            groups.append([s])
    if len(groups) > 2:
        raise SongError(f"Measure {number}: more than two different rhythms on one staff. "
                        "Simplify the voices in MuseScore, or write this measure by hand.")
    layers = []
    for g in groups:
        events = []
        for notes in zip(*g):
            ev = _to_ev(notes[0])
            for n in notes[1:]:
                ev.pitches += n.pitches
                ev.tie_start |= n.tie_start
                ev.tie_stop |= n.tie_stop
                ev.fermata |= n.fermata
                for verse, lyric in n.lyrics.items():
                    ev.lyrics.setdefault(verse, lyric)
            ev.pitches = sorted(set(ev.pitches), key=_midi, reverse=True)
            events.append(ev)
        layers.append(events)
    if len(layers) == 2:
        def height(layer):
            ps = [_midi(p) for e in layer for p in e.pitches]
            return sum(ps) / len(ps) if ps else 0
        layers.sort(key=height, reverse=True)
    return layers


# ---------------------------------------------------------------- lines (phrases)

@dataclass
class Segment:
    measure: int
    start: Fraction
    end: Fraction


@dataclass
class ImportedLine:
    segments: list[Segment]
    treble: list[list[list[Ev]]] = field(default_factory=list)  # per segment: layers
    bass: list[list[list[Ev]]] = field(default_factory=list)


def default_measures_per_line(time: tuple[int, int]) -> int:
    quarters = time[0] * 4 / time[1]
    return max(1, round(8 / quarters))


def cut_lines(score: XScore, merged: list[tuple[list, list]], per_line: int | None) -> list[list[Segment]]:
    measures = score.measures
    if not measures:
        raise SongError("The file has no measures.")
    pickup = measures[0].length if measures[0].length < measures[0].full else Fraction(0)
    # Where lines begin: system breaks from the file, or every few measures.
    if per_line is None and any(m.new_system for m in measures[1:]):
        starts = [0] + [i for i, m in enumerate(measures) if i > 0 and m.new_system]
    else:
        n = per_line or default_measures_per_line(score.time)
        first = 1 if pickup else 0
        starts = [0] + list(range(first + n, len(measures), n))
    starts = sorted(set(starts))

    lines = []
    for li, s in enumerate(starts):
        e = starts[li + 1] if li + 1 < len(starts) else len(measures)
        lines.append([Segment(i, Fraction(0), measures[i].length) for i in range(s, e)])

    # Give each line its own pickup: move the end of the measure before a line
    # break (as long as the opening pickup) to the start of the next line.
    if pickup:
        for li in range(1, len(lines)):
            prev = lines[li - 1][-1]
            m = measures[prev.measure]
            cut = m.length - pickup
            if cut <= 0 or prev.start != 0:
                continue
            if all(_has_onset(layer, cut) for tre, bas in [merged[prev.measure]] for layer in tre + bas):
                lines[li - 1][-1] = Segment(prev.measure, Fraction(0), cut)
                lines[li].insert(0, Segment(prev.measure, cut, m.length))
    return lines


def _has_onset(layer: list[Ev], at: Fraction) -> bool:
    return any(ev.offset == at for ev in layer)


def _slice(layers: list[list[Ev]], start: Fraction, end: Fraction) -> list[list[Ev]]:
    return [[ev for ev in layer if start <= ev.offset < end] for layer in layers]


# ---------------------------------------------------------------- writing tokens

def _pitch_name(p, tie: bool) -> str:
    step, alter, octave = p
    return f"{step}{ACCIDENTAL[alter]}{octave}" + ("~" if tie else "")


def split_duration(d: Fraction) -> list[tuple[Fraction, str]]:
    out = []
    while d > 0:
        for length, token in TOKENS:
            if length <= d:
                out.append((length, token))
                d -= length
                break
        else:
            raise SongError("A note is shorter than a sixteenth (or a tuplet); this is not supported yet.")
    return out


def layer_tokens(layer: list[Ev]) -> str:
    tokens = []
    for ev in layer:
        parts = split_duration(ev.dur)
        for i, (_, tok) in enumerate(parts):
            last = i == len(parts) - 1
            if not ev.pitches:
                tokens.append(f"{tok}:r")
                continue
            tie = ev.tie_start if last else True
            mark = "!" if ev.fermata and last else ""
            tokens.append(f"{tok}{mark}:" + ",".join(_pitch_name(p, tie) for p in ev.pitches))
    return " ".join(tokens)


def measure_text(layers: list[list[Ev]]) -> str:
    return " // ".join(layer_tokens(layer) for layer in layers)


# ---------------------------------------------------------------- lyrics and structure

def sung_events(layer_runs: list[list[Ev]]) -> list[Ev]:
    """Events that start a sung note (the same rule as the song format: no rests, no tie endings)."""
    out, tied = [], False
    for layer in layer_runs:
        for ev in layer:
            if not ev.pitches:
                tied = False
                continue
            if not tied:
                out.append(ev)
            tied = ev.tie_start
    return out


def lyric_line(events: list[Ev], verse: int) -> str:
    words, current = [], ""
    for ev in events:
        syl = ev.lyrics.get(verse)
        if syl is None:
            if current:
                words.append(current)
                current = ""
            words.append("_")
            continue
        syllabic, text = syl
        text = text.replace(" ", " ").replace("-", "‐").replace('"', "”")
        if syllabic in ("begin", "middle"):
            current += text + "-"
        else:
            words.append(current + text)
            current = ""
    if current:
        words.append(current.rstrip("-"))
    return " ".join(words)


@dataclass
class ImportResult:
    yaml_text: str
    lines: list[ImportedLine]
    names: list[str]
    warnings: list[str]


def _key_name(fifths: int, minor: bool) -> str:
    table = MINOR_FIFTHS if minor else MAJOR_FIFTHS
    for name, f in table.items():
        if f == fifths:
            return f"{name.lower()} minor" if minor else name
    return "C"


def _q(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def import_score(score: XScore, source: str, per_line: int | None = None) -> ImportResult:
    treble_staves, bass_staves = staff_groups(score)
    merged = []
    for i, m in enumerate(score.measures):
        tre = merge_staff(m, treble_staves, i + 1)
        bas = merge_staff(m, bass_staves, i + 1) if bass_staves else [[Ev(Fraction(0), m.length, [])]]
        merged.append((tre, bas))

    lines = []
    for segs in cut_lines(score, merged, per_line):
        line = ImportedLine(segs)
        for seg in segs:
            tre, bas = merged[seg.measure]
            line.treble.append(_slice(tre, seg.start, seg.end))
            line.bass.append(_slice(bas, seg.start, seg.end))
        lines.append(line)

    # Lyrics: verse numbers on the top layer of the treble decide stanza or refrain.
    verses = sorted({v for ln in lines for seg in ln.treble for ev in seg[0] for v in ev.lyrics})
    info = []
    for ln in lines:
        top = sung_events([seg[0] for seg in ln.treble])
        alto = sung_events([seg[1] for seg in ln.treble if len(seg) > 1])
        present = sorted({v for ev in top for v in ev.lyrics})
        texts = {v: lyric_line(top, v) for v in verses}
        alto_text = None
        if any(ev.lyrics for ev in alto):
            first = min(v for ev in alto for v in ev.lyrics)
            alto_text = lyric_line(alto, first)
        info.append([top, False, texts, alto_text, present])

    # Refrain lines: only verse 1 has words there. If the file repeats the
    # refrain words in every verse instead, the refrain is the block of lines
    # at the end whose words are the same in every verse.
    if len(verses) > 1:
        only_first = [i for i, x in enumerate(info) if x[4] == [verses[0]]]
        if only_first:
            for i in only_first:
                info[i][1] = True
        else:
            i = len(info) - 1
            while i > 0 and len(info[i][4]) > 1 and len({info[i][2][v] for v in info[i][4]}) == 1:
                info[i][1] = True
                i -= 1

    names, stanza_lines, refrain_lines = [], [], []
    for ln, (_, is_refrain, _, _, _) in zip(lines, info):
        if is_refrain:
            refrain_lines.append(len(names))
            names.append(f"R{len(refrain_lines)}")
        else:
            stanza_lines.append(len(names))
            names.append(f"S{len(stanza_lines)}")

    out = [
        f"# Imported from {source} by HymnSlides.",
        "# reviewed: false -> open review.html, compare every line with the page,",
        "# fix this file, and then change it to reviewed: true. Until then the",
        "# slides cannot be built.",
        "reviewed: false",
        "",
        f"title: {_q(score.title)}",
        'number: ""',
        'scripture: ""',
        f"words: {_q(score.words)}",
        f"music: {_q(score.music)}",
        "copyright_status: public_domain   # CHECK: public_domain, licensed or template_only",
        f"key: {_key_name(score.fifths, score.minor)}",
        f"time: {score.time[0]}/{score.time[1]}",
        "",
        "phrases:",
    ]
    for name, ln in zip(names, lines):
        first = ln.segments[0].measure + 1
        last = ln.segments[-1].measure + 1
        out.append(f"  - name: {name}   # measure{'s' if first != last else ''} {first}"
                   + (f"-{last}" if first != last else ""))
        for staff, segs in (("treble", ln.treble), ("bass", ln.bass)):
            out.append(f"    {staff}: |")
            out.extend(f"      {measure_text(seg)}" for seg in segs)

    out += ["", "lyrics:"]
    stanza_verses = verses or [1]
    for v in stanza_verses:
        out.append(f"  stanza{v}:")
        for idx in stanza_lines:
            top, _, texts, alto, _ = info[idx]
            text = texts.get(v) or " ".join("_" for _ in top)
            out.append(f"    {names[idx]}: {_q(text)}")
            if alto:
                out.append(f"    {names[idx]}.alto: {_q(alto)}")
    if refrain_lines:
        out.append("  refrain:")
        for idx in refrain_lines:
            top, _, texts, alto, _ = info[idx]
            text = texts.get(verses[0]) if verses else ""
            out.append(f"    {names[idx]}: {_q(text or ' '.join('_' for _ in top))}")
            if alto:
                out.append(f"    {names[idx]}.alto: {_q(alto)}")

    out += ["", "structure:"]
    stanza_names = [names[i] for i in stanza_lines]
    refrain_names = [names[i] for i in refrain_lines]
    for k, v in enumerate(stanza_verses):
        if stanza_names:
            out.append(f'  - {{ label: "Stanza {k + 1}", phrases: [{", ".join(stanza_names)}], lyrics: stanza{v} }}')
        if k == 0 and refrain_names:
            out.append(f'  - {{ label: "Refrain", phrases: [{", ".join(refrain_names)}], lyrics: refrain }}')
    return ImportResult("\n".join(out) + "\n", lines, names, list(score.warnings))


def import_musicxml(path: str | Path, per_line: int | None = None) -> ImportResult:
    path = Path(path)
    return import_score(parse_musicxml(path), path.name, per_line)


def concat_scores(scores: list[XScore]) -> XScore:
    """Join scores read from several pages into one."""
    first = scores[0]
    for s in scores[1:]:
        if s.measures:
            s.measures[0].new_system = True
        first.measures.extend(s.measures)
        first.warnings.extend(s.warnings)
    return first

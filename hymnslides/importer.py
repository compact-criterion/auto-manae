"""`hymnslides import`: MusicXML or scanned pages -> song file + review.html + MIDI."""

from __future__ import annotations

import html
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from PIL import Image

from .engrave import Line, engrave
from .midi import write_midi
from .musicxml import concat_scores, import_score, parse_musicxml
from .songformat import SongError, song_from_dict

MUSICXML = {".musicxml", ".xml", ".mxl"}
SCANS = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}


@dataclass
class ImportOutcome:
    song_path: Path
    review_path: Path
    midi_path: Path | None
    problems: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def import_file(path: str | Path, out: str | Path | None = None, pages: str | None = None,
                engine: str = "auto", per_line: int | None = None, log=print) -> ImportOutcome:
    path = Path(path)
    if not path.exists():
        raise SongError(f"{path} does not exist.")
    suffix = path.suffix.lower()
    song_path = Path(out) if out else path.with_suffix(".yaml")
    if not out and song_path.exists():
        song_path = path.with_name(f"{path.stem}-imported.yaml")
    review_dir = song_path.with_name(f"{song_path.stem}-review")
    review_dir.mkdir(parents=True, exist_ok=True)

    crops: list[Image.Image] = []
    if suffix in MUSICXML:
        log(f"Reading {path.name}…")
        score = parse_musicxml(path)
    elif suffix in SCANS:
        from . import omr
        chosen = omr.choose_engine(engine)
        pngs = omr.page_images(path, pages, review_dir / "pages")
        scores = []
        for png in pngs:
            log(f"Reading the music on {png.name} with {chosen} (this can take a few minutes)…")
            scores.append(parse_musicxml(omr.recognize_page(png, chosen, review_dir / "omr")))
            crops.extend(omr.find_systems(png))
        score = concat_scores(scores)
    else:
        raise SongError(f"I can import MusicXML ({', '.join(sorted(MUSICXML))}) or scans "
                        f"({', '.join(sorted(SCANS))}), not {suffix} files.")

    result = import_score(score, path.name, per_line)
    song_path.write_text(result.yaml_text, encoding="utf-8")
    log(f"Wrote {song_path}")

    problems = []
    data = yaml.safe_load(result.yaml_text)
    try:
        song = song_from_dict(data)
    except SongError as exc:
        problems.append(str(exc))
        song = song_from_dict(data, check=False)

    midi_path = None
    try:
        midi_path = write_midi(song, song_path.with_suffix(".mid"))
        log(f"Wrote {midi_path}")
    except (SongError, KeyError, ValueError) as exc:
        problems.append(f"MIDI: {exc}")

    review = write_review(song, result.names, crops, review_dir, song_path, midi_path, problems,
                          result.warnings, log)
    return ImportOutcome(song_path, review, midi_path, problems, result.warnings)


def _first_words(song, name: str) -> tuple[str | None, str | None]:
    for sec in song.structure:
        if name in sec.phrases:
            words = song.lyrics.get(sec.lyrics, {})
            return words.get(name), words.get(f"{name}.alto")
    return None, None


def write_review(song, names, crops, review_dir: Path, song_path: Path, midi_path, problems,
                 warnings, log=print) -> Path:
    """review.html: each engraved line next to the matching part of the page."""
    rows = []
    for i, name in enumerate(names):
        words, alto = _first_words(song, name)
        img_file = review_dir / f"line-{name}.png"
        note = ""
        try:
            try:
                result = engrave(song, [Line(name, words, alto)], "#111111", (12.9, 3.2), final=False)
            except SongError:
                result = engrave(song, [Line(name, None)], "#111111", (12.9, 3.2), final=False)
                note = "Words left out: they do not match the notes (see the problems above)."
            canvas = Image.new("RGBA", result.png.size, "white")
            canvas.alpha_composite(result.png)
            canvas.convert("RGB").save(img_file)
            engraved = f'<img src="{img_file.name}" alt="line {name}">'
        except Exception as exc:  # show it in the page instead of stopping the review
            engraved = f'<p class="err">Could not engrave this line: {html.escape(str(exc))}</p>'
        page = ""
        if i < len(crops):
            crop_file = review_dir / f"page-{i + 1}.png"
            crops[i].save(crop_file)
            page = f'<img src="{crop_file.name}" alt="page system {i + 1}">'
        rows.append((name, engraved, note, page))
    for j in range(len(names), len(crops)):  # page systems left over
        crop_file = review_dir / f"page-{j + 1}.png"
        crops[j].save(crop_file)
        rows.append(("", "", "", f'<img src="{crop_file.name}" alt="page system {j + 1}">'))

    has_page = bool(crops)
    midi_link = (f'<a href="../{html.escape(midi_path.name)}">{html.escape(midi_path.name)}</a>'
                 if midi_path else "(not made, see the problems)")
    parts = [
        "<!doctype html><html><head><meta charset='utf-8'>",
        f"<title>Review: {html.escape(song.title)}</title>",
        "<style>body{font-family:'Segoe UI',sans-serif;font-size:18px;margin:24px;color:#111}"
        "h1{font-size:30px}table{border-collapse:collapse;width:100%}"
        "td{border-top:2px solid #ccc;padding:12px;vertical-align:top}"
        "td.name{font-weight:bold;font-size:22px;width:4em}img{max-width:100%}"
        ".err{color:#a00;font-weight:bold}.box{background:#fff4d6;border:2px solid #e0b000;padding:12px;margin:12px 0}"
        "</style></head><body>",
        f"<h1>Review: {html.escape(song.title)}</h1>",
        "<div class='box'><b>How to check:</b> compare every line below with the page, note by note "
        "and word by word. Listen to the MIDI file too: "
        f"{midi_link}. Fix mistakes in <b>{html.escape(song_path.name)}</b>, run the import "
        "review again if you like, and when everything is right change "
        "<code>reviewed: false</code> to <code>reviewed: true</code>. Then build the slides.</div>",
    ]
    if problems:
        parts.append("<div class='box'><b class='err'>Problems to fix in the song file:</b><ul>"
                     + "".join(f"<li>{html.escape(p)}</li>" for p in problems) + "</ul></div>")
    if warnings:
        parts.append("<div class='box'><b>Warnings:</b><ul>"
                     + "".join(f"<li>{html.escape(w)}</li>" for w in warnings) + "</ul></div>")
    if has_page:
        parts.append("<p>Left: what HymnSlides read. Right: the page. The rows may drift apart if "
                     "the reader found a different number of lines than the page has.</p>")
    parts.append("<table>")
    for name, engraved, note, page in rows:
        right = f"<td style='width:50%'>{page}</td>" if has_page else ""
        note_html = f"<p class='err'>{note}</p>" if note else ""
        parts.append(f"<tr><td class='name'>{html.escape(name)}</td><td>{engraved}{note_html}</td>{right}</tr>")
    parts.append("</table></body></html>")
    out = review_dir / "review.html"
    out.write_text("\n".join(parts), encoding="utf-8")
    log(f"Wrote {out}")
    return out

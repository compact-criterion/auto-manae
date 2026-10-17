"""Command-line entry point: `hymnslides preview song.yaml --line A1`."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .deck import build_deck, build_template
from .engrave import preview_line
from .midi import SOUNDS, VOICES, write_midi
from .songformat import SongError, load_song


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hymnslides", description="Make hymn slides with music notation.")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("preview", help="engrave one line of music to a PNG")
    p.add_argument("song", help="the song file (.yaml)")
    p.add_argument("--line", required=True, help="the phrase name, for example A1")
    p.add_argument("--out", help="PNG file to write (default: <song>-<line>.png)")

    c = sub.add_parser("check", help="check a song file for mistakes")
    c.add_argument("song")

    b = sub.add_parser("build", help="build the slide deck (.pptx)")
    b.add_argument("song")
    _theme_args(b)
    b.add_argument("--out", help="the .pptx to write (default: <song>-<theme>.pptx)")

    m = sub.add_parser("midi", help="write a MIDI file to listen for wrong notes")
    m.add_argument("song")
    m.add_argument("--voice", choices=VOICES, help="make this voice loud and the others soft")
    m.add_argument("--tempo", type=int, help="beats per minute (dotted quarters in 6/8 and 9/8)")
    m.add_argument("--all", action="store_true", help="play every stanza, not just one stanza and the refrain")
    m.add_argument("--sound", default="piano", choices=list(SOUNDS))
    m.add_argument("--out", help="the .mid file to write (default: <song>.mid)")

    sub.add_parser("gui", help="open the HymnSlides window")
    pic = sub.add_parser("pictures", help="slides with the printed music cut from scans (no note reading)")
    pic.add_argument("scans", nargs="+", help="scanned pages or photos (.pdf, .png, .jpg), in order")
    pic.add_argument("--title", required=True)
    pic.add_argument("--pages", help='PDF pages, for example "20-21"')
    pic.add_argument("--verses", type=int, default=1,
                     help="repeat the music once per verse, labelled Stanza 1, 2, …")
    pic.add_argument("--per-slide", type=int, default=2, help="lines of music on each slide")
    for field in ("number", "scripture", "words", "music", "copyright", "ccli-song", "ccli-license"):
        pic.add_argument(f"--{field}", default="")
    pic.add_argument("--status", default="public_domain",
                     choices=["public_domain", "licensed", "template_only"], help="copyright status")
    _theme_args(pic)
    pic.add_argument("--out", help="the .pptx to write")

    sub.add_parser("install-omr", help="install oemer, the music reader for scanned pages")

    im = sub.add_parser("import", help="make a song file from MusicXML or a scanned page")
    im.add_argument("source", help=".musicxml / .mxl from MuseScore, or a scan (.pdf, .png, .jpg)")
    im.add_argument("--pages", help='PDF pages to read, for example "20-21"')
    im.add_argument("--engine", default="auto", choices=["auto", "oemer", "audiveris"],
                    help="music reader for scans (auto uses Audiveris if installed, else oemer)")
    im.add_argument("--measures-per-line", type=int,
                    help="measures in each line (default: the file's line breaks, or about 8 beats)")
    im.add_argument("--time", help="the time signature, if the scan reader got it wrong (for example 9/8)")
    im.add_argument("--key", help="the key, if the scan reader got it wrong (for example D or Ab)")
    im.add_argument("--out", help="the song file to write (default: next to the source)")

    t = sub.add_parser("template", help="make a deck of empty panels to paste music into")
    t.add_argument("--title", required=True)
    t.add_argument("--sections", required=True, help='for example "Stanza 1:2,Refrain:2"')
    for field in ("number", "scripture", "words", "music", "copyright", "ccli-song", "ccli-license"):
        t.add_argument(f"--{field}", default="")
    t.add_argument("--status", default="template_only",
                   choices=["public_domain", "licensed", "template_only"], help="copyright status")
    _theme_args(t, default="color")
    t.add_argument("--out", help="the .pptx to write (default: <title>-template.pptx)")

    args = parser.parse_args(argv)
    if args.command == "gui":
        from .gui import run
        run()
        return 0
    if args.command == "install-omr":
        return install_omr()
    try:
        if args.command == "pictures":
            from .picture import build_picture_deck
            meta = {"title": args.title, "number": args.number, "scripture": args.scripture,
                    "words": args.words, "music": args.music, "copyright": args.copyright,
                    "ccli_song": args.ccli_song, "ccli_license": args.ccli_license,
                    "copyright_status": args.status}
            out = Path(args.out or f"{_safe(args.title)}-pictures-{args.theme}.pptx")
            build_picture_deck(args.scans, out, meta, args.theme, args.bg, args.pages,
                               args.per_slide, args.verses)
            return 0
        if args.command == "import":
            from .importer import import_file
            from .songformat import parse_time
            time = parse_time(args.time) if args.time else None
            outcome = import_file(args.source, args.out, args.pages, args.engine, args.measures_per_line,
                                  time=time, key=args.key)
            for w in outcome.warnings:
                print(f"Warning: {w}")
            for p in outcome.problems:
                print(f"Problem to fix: {p}")
            print(f"\nNext: open {outcome.review_path} and check every line against the page.")
            print(f"Fix {outcome.song_path.name}, then change 'reviewed: false' to 'reviewed: true'.")
            return 0
        if args.command == "template":
            meta = {"title": args.title, "number": args.number, "scripture": args.scripture,
                    "words": args.words, "music": args.music, "copyright": args.copyright,
                    "ccli_song": args.ccli_song, "ccli_license": args.ccli_license,
                    "copyright_status": args.status}
            out = Path(args.out or f"{_safe(args.title)}-template.pptx")
            n = build_template(meta, args.sections, out, args.theme, args.bg)
            print(f"Wrote {out}  (title slide + {n} empty music slides)")
            return 0
        song = load_song(args.song)
        if song.meta.get("verified") is False:
            print("Note: this song file is marked 'verified: false' - check the notes against a hymnal.")
        if args.command == "check":
            print(f"OK: {song.title} ({len(song.phrases)} lines, {len(song.structure)} sections).")
        elif args.command == "preview":
            out = Path(args.out or f"{Path(args.song).stem}-{args.line}.png")
            result = preview_line(song, args.line, out)
            print(f"Wrote {out}  (lyrics {result.lyric_pt((12.9, 3.2)):.1f} pt on a slide with 2 lines)")
        elif args.command == "midi":
            suffix = f"-{args.voice}" if args.voice else ""
            out = Path(args.out or f"{Path(args.song).stem}{suffix}.mid")
            write_midi(song, out, args.tempo, args.all, args.voice, args.sound)
            print(f"Wrote {out}")
        elif args.command == "build":
            out = Path(args.out or f"{Path(args.song).stem}-{args.theme}.pptx")
            print(f"Building {song.title} ({args.theme} theme)...")
            slides = build_deck(song, out, args.theme, args.bg)
            print(f"Wrote {out}  ({len(slides) + 1} slides)")
    except SongError as exc:
        print(f"Problem: {exc}", file=sys.stderr)
        return 1
    return 0


def install_omr() -> int:
    from .omr import install_oemer
    print("Installing the music reader (oemer). This downloads about 200 MB…")
    try:
        install_oemer()
    except SongError as exc:
        print(f"Problem: {exc}", file=sys.stderr)
        return 1
    print("Done. The first scan you import also downloads oemer's models once.")
    return 0


def _theme_args(p, default: str = "light") -> None:
    p.add_argument("--theme", default=default, choices=["light", "dark", "color"])
    p.add_argument("--bg", help='background color for the color theme, for example "#8B1A1A"')


def _safe(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in " -_" else "" for ch in name).strip().replace(" ", "_")


if __name__ == "__main__":
    sys.exit(main())

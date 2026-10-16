"""Command-line entry point: `hymnslides preview song.yaml --line A1`."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .deck import build_deck, build_template
from .engrave import preview_line
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
    try:
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
        elif args.command == "build":
            out = Path(args.out or f"{Path(args.song).stem}-{args.theme}.pptx")
            print(f"Building {song.title} ({args.theme} theme)...")
            slides = build_deck(song, out, args.theme, args.bg)
            print(f"Wrote {out}  ({len(slides) + 1} slides)")
    except SongError as exc:
        print(f"Problem: {exc}", file=sys.stderr)
        return 1
    return 0


def _theme_args(p, default: str = "light") -> None:
    p.add_argument("--theme", default=default, choices=["light", "dark", "color"])
    p.add_argument("--bg", help='background color for the color theme, for example "#8B1A1A"')


def _safe(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in " -_" else "" for ch in name).strip().replace(" ", "_")


if __name__ == "__main__":
    sys.exit(main())

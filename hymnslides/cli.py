"""Command-line entry point: `hymnslides preview song.yaml --line A1`."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

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

    args = parser.parse_args(argv)
    try:
        song = load_song(args.song)
        if song.meta.get("verified") is False:
            print("Note: this song file is marked 'verified: false' - check the notes against a hymnal.")
        if args.command == "check":
            print(f"OK: {song.title} ({len(song.phrases)} lines, {len(song.structure)} sections).")
        elif args.command == "preview":
            out = Path(args.out or f"{Path(args.song).stem}-{args.line}.png")
            result = preview_line(song, args.line, out)
            print(f"Wrote {out}  (lyrics {result.lyric_pt((12.9, 3.2)):.1f} pt on a slide with 2 lines)")
    except SongError as exc:
        print(f"Problem: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

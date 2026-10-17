"""Read scanned hymnal pages (PDF, PNG or JPG) with optical music recognition.

Engines:
  - Audiveris (free, more accurate; install it separately) if it can be found
  - oemer (pip install hymnslides[omr]) otherwise

Both turn each page into MusicXML, which then goes through the MusicXML importer.
OMR always makes some mistakes, so imported songs must be reviewed (review.html).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from .songformat import SongError

MIN_WIDTH = 2000  # small scans are enlarged to about this width before reading


def parse_pages(spec: str | None, count: int) -> list[int]:
    """'20-21' or '3,5' (1-based, as printed in a PDF viewer) -> 0-based page numbers."""
    if not spec:
        return list(range(count))
    pages = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            pages.extend(range(int(a), int(b) + 1))
        elif part:
            pages.append(int(part))
    bad = [p for p in pages if p < 1 or p > count]
    if bad:
        raise SongError(f"Page {bad[0]} does not exist; the file has {count} page(s).")
    return [p - 1 for p in pages]


def page_images(path: Path, pages: str | None, work: Path) -> list[Path]:
    """The pages to read, as PNG files of a good size for OMR."""
    work.mkdir(parents=True, exist_ok=True)
    out = []
    if path.suffix.lower() == ".pdf":
        try:
            import pymupdf
        except ImportError as exc:
            raise SongError("Reading PDF files needs PyMuPDF: pip install pymupdf") from exc
        doc = pymupdf.open(path)
        for n in parse_pages(pages, doc.page_count):
            png = work / f"page{n + 1}.png"
            doc[n].get_pixmap(dpi=300).save(png)
            out.append(png)
    else:
        img = Image.open(path)
        if pages:
            raise SongError("--pages is only for PDF files.")
        out.append(work / f"{path.stem}.png")
        img.save(out[0])
    for png in out:
        img = Image.open(png).convert("L")
        if img.width < MIN_WIDTH:
            scale = MIN_WIDTH / img.width
            img = img.resize((MIN_WIDTH, round(img.height * scale)), Image.LANCZOS)
        img.save(png)
    return out


# ---------------------------------------------------------------- engines

def find_audiveris() -> str | None:
    candidates = [os.environ.get("AUDIVERIS"), shutil.which("Audiveris"), shutil.which("audiveris")]
    if sys.platform.startswith("win"):
        for base in (os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", "")):
            if base:
                candidates.append(str(Path(base) / "Audiveris" / "bin" / "Audiveris.bat"))
                candidates.append(str(Path(base) / "Audiveris" / "Audiveris.exe"))
    for c in candidates:
        if c and Path(c).exists():
            return c
    return None


# oemer asks for the newest onnxruntime-gpu, whose newer versions refuse oemer's
# model files, and breaks with OpenCV 5; install it with versions that work.
OMR_PACKAGES = ["onnxruntime==1.20.1", "opencv-python-headless<5", "scikit-learn", "scipy",
                "matplotlib", "typing-extensions"]


def install_oemer(log=print) -> None:
    """Install oemer (about 200 MB) with pip, showing pip's progress through `log`."""
    import importlib

    pip = [sys.executable, "-m", "pip", "install", "--only-binary=:all:"]
    for cmd in (pip + OMR_PACKAGES, pip + ["--no-deps", "oemer"]):
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in proc.stdout:
            line = line.strip()
            if line.startswith(("Collecting", "Downloading", "Installing", "Successfully", "ERROR")):
                log(line)
        if proc.wait() != 0:
            raise SongError("Installing the music reader did not finish. Check the internet "
                            "connection and try again.")
    importlib.invalidate_caches()


def has_oemer() -> bool:
    try:
        import oemer  # noqa: F401
        return True
    except ImportError:
        return False


def choose_engine(engine: str) -> str:
    if engine == "audiveris" or (engine == "auto" and find_audiveris()):
        if not find_audiveris():
            raise SongError("Audiveris was not found. Install it from https://audiveris.github.io, or set "
                            "the AUDIVERIS environment variable to its program file.")
        return "audiveris"
    if engine in ("oemer", "auto"):
        if not has_oemer():
            raise SongError("No music reader is installed. In the HymnSlides window, choose Import… "
                            "again and click Yes to install it (or type: hymnslides install-omr).")
        return "oemer"
    raise SongError(f'Unknown engine "{engine}". Use auto, oemer or audiveris.')


def _run(cmd: list[str], what: str):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        tail = (result.stderr or result.stdout).strip().splitlines()[-5:]
        raise SongError(f"{what} could not read the page:\n" + "\n".join(tail))


def recognize_page(png: Path, engine: str, work: Path) -> Path:
    """Run the OMR engine on one page image; return the MusicXML it wrote."""
    out = work / f"{png.stem}-{engine}"
    out.mkdir(parents=True, exist_ok=True)
    if engine == "oemer":
        _run([sys.executable, "-m", "oemer.ete", str(png), "-o", str(out)], "oemer")
    else:
        _run([find_audiveris(), "-batch", "-export", "-output", str(out), "--", str(png)], "Audiveris")
    found = sorted(out.rglob("*.mxl")) + sorted(out.rglob("*.musicxml")) + sorted(out.rglob("*.xml"))
    if not found:
        raise SongError(f"{engine} finished but wrote no MusicXML for {png.name}.")
    return found[0]


# ---------------------------------------------------------------- systems on the page (for review.html)

def find_systems(png: Path) -> list[Image.Image]:
    """Crops of each system (treble + bass staff pair) on a page, top to bottom."""
    img = Image.open(png).convert("L")
    a = np.asarray(img) < 140
    cols = np.where(a.any(axis=0))[0]
    if cols.size == 0:
        return []
    width = cols[-1] - cols[0] + 1
    dark = a.sum(axis=1)
    rows = np.where(dark > 0.5 * width)[0]
    # Staff lines: runs of dark rows.
    lines = []
    for y in rows:
        if lines and y - lines[-1][-1] <= 2:
            lines[-1].append(y)
        else:
            lines.append([y])
    centers = [sum(r) / len(r) for r in lines]
    # Staves: five lines with even spacing.
    staves, i = [], 0
    while i + 4 < len(centers):
        five = centers[i:i + 5]
        gaps = np.diff(five)
        if gaps.min() > 2 and gaps.max() < 1.5 * gaps.min():
            staves.append((five[0], five[-1], float(gaps.mean())))
            i += 5
        else:
            i += 1
    if not staves:
        return []
    # Systems: a hymn pairs every treble staff with a bass staff. With an odd
    # number of staves, join staves that are close together instead.
    systems, i = [], 0
    if len(staves) % 2 == 0:
        systems = [(staves[k][0], staves[k + 1][1], staves[k][2]) for k in range(0, len(staves), 2)]
        i = len(staves)
    while i < len(staves):
        top, bottom, sp = staves[i]
        if i + 1 < len(staves) and staves[i + 1][0] - bottom < 14 * sp:
            bottom = staves[i + 1][1]
            i += 2
        else:
            i += 1
        systems.append((top, bottom, sp))
    crops = []
    for k, (top, bottom, sp) in enumerate(systems):
        upper = (systems[k - 1][1] + top) / 2 if k else top - 5 * sp
        lower = (bottom + systems[k + 1][0]) / 2 if k + 1 < len(systems) else bottom + 7 * sp
        crops.append(img.crop((0, max(0, int(upper)), img.width, min(img.height, int(lower)))))
    return crops

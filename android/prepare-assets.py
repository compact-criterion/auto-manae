"""Copy the five web apps, the MathJax library, and launcher icons into the Android project.

Run from the repository root before building:  python3 android/prepare-assets.py
"""
import os, shutil
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "android", "app", "src")
FLAVORS = {"wisechoice": "wise-choice", "gardenarch": "garden-arch", "signalcheck": "signal-check",
           "wastewatch": "waste-watch", "investorpitch": "investor-pitch"}
WEB_FILES = ["index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"]
LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_bg" />
    <foreground android:drawable="@android:color/transparent" />
</adaptive-icon>
'''

lib = os.path.join(APP, "main", "assets", "www", "lib", "mathjax")
shutil.rmtree(lib, ignore_errors=True)
os.makedirs(lib)
for f in ("tex-svg.js", "LICENSE"):
    shutil.copy(os.path.join(ROOT, "lib", "mathjax", f), lib)

for flavor, folder in FLAVORS.items():
    src = os.path.join(ROOT, folder)
    www = os.path.join(APP, flavor, "assets", "www", folder)
    shutil.rmtree(os.path.join(APP, flavor), ignore_errors=True)
    os.makedirs(www)
    for f in WEB_FILES:
        shutil.copy(os.path.join(src, f), www)
    res = os.path.join(APP, flavor, "res")
    icon = Image.open(os.path.join(src, "icon-512.png")).convert("RGBA")
    for dpi, px in LEGACY.items():
        d = os.path.join(res, "mipmap-" + dpi)
        os.makedirs(d, exist_ok=True)
        icon.resize((px, px), Image.LANCZOS).save(os.path.join(d, "ic_launcher.png"))
    bg = Image.open(os.path.join(src, "icon-maskable-512.png")).convert("RGBA")
    bg.resize((432, 432), Image.LANCZOS).save(os.path.join(res, "mipmap-xxxhdpi", "ic_launcher_bg.png"))
    os.makedirs(os.path.join(res, "mipmap-anydpi-v26"), exist_ok=True)
    with open(os.path.join(res, "mipmap-anydpi-v26", "ic_launcher.xml"), "w") as fh:
        fh.write(ADAPTIVE)
    print("prepared", flavor)

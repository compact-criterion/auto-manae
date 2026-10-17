"""A simple HymnSlides window (Tkinter, which comes with Python on Windows).

Left: the song's details (title, credits, copyright) and the song file itself.
Right: theme and colour, Preview / Build slides / Make MIDI / Open folder, and
a preview of one line of music.

The detail fields and the song file stay in step: typing in a field rewrites
that line of the song file, and editing the song file refreshes the fields.
"""

from __future__ import annotations

import json
import os
import queue
import re
import subprocess
import sys
import tempfile
import threading
import tkinter as tk
from pathlib import Path
from tkinter import colorchooser, filedialog, messagebox, simpledialog, ttk

import yaml
from PIL import Image, ImageTk

from .deck import build_deck
from .engrave import preview_line
from .midi import VOICES, write_midi
from .songformat import COPYRIGHT_STATUSES, SongError, song_from_dict

FIELDS = [  # (song file key, label)
    ("title", "Title"),
    ("number", "Hymn number"),
    ("scripture", "Scripture"),
    ("words", "Words by"),
    ("music", "Music by"),
    ("copyright_status", "Copyright status"),
    ("copyright", "Copyright line"),
    ("ccli_song", "CCLI song #"),
    ("ccli_license", "CCLI license #"),
]

NEW_SONG = '''# A new song. Write one line of music per phrase, then the words.
# See the README for the full format.
title: New Hymn
number: ""
scripture: ""
words: ""
music: ""
copyright_status: public_domain
key: C
time: 4/4

phrases:
  - name: A1
    treble: |
      q:E4,C4 q:F4,C4 q:G4,C4 q:E4,C4
      h:D4,B3 h:C4,G3
    bass: |
      q:G3,C3 q:A3,F3 q:G3,E3 q:G3,C3
      h:G3,G2 h:E3,C3

lyrics:
  stanza1:
    A1: "Write the words here, one syl-la-ble per note."

structure:
  - { label: "Stanza 1", phrases: [A1], lyrics: stanza1 }
'''


def set_top_key(text: str, key: str, value: str) -> str:
    """Set a top-level `key: value` line in the song file, keeping everything else."""
    value = value.strip()
    if (key == "number" and value.isdigit()) or key == "copyright_status":
        shown = value
    else:
        shown = json.dumps(value, ensure_ascii=False)  # quoted, so any text is safe
    line = f"{key}: {shown}"
    pattern = re.compile(rf"^{re.escape(key)}:.*$", re.M)
    if pattern.search(text):
        return pattern.sub(lambda _: line, text, count=1)
    if not value:
        return text  # don't add empty lines for details the song doesn't have
    title = re.search(r"^title:.*$", text, re.M)
    if title:
        return text[:title.end()] + "\n" + line + text[title.end():]
    return line + "\n" + text


class App:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.path: Path | None = None
        self.bg_color = "#8B1A1A"
        self.busy = False
        self.messages: queue.Queue = queue.Queue()
        self.syncing = False
        self.pending_fields = None
        self.preview_image = None
        self.out_dir = Path(tempfile.gettempdir()) / "HymnSlides"

        root.title("HymnSlides")
        root.geometry("1280x820")
        root.option_add("*Font", "{Segoe UI} 11")
        style = ttk.Style()
        style.configure(".", font=("Segoe UI", 11))
        style.configure("Big.TButton", font=("Segoe UI", 12, "bold"), padding=8)

        self._build_toolbar()
        body = ttk.PanedWindow(root, orient="horizontal")
        body.pack(fill="both", expand=True, padx=8, pady=(0, 8))
        left = ttk.Frame(body)
        right = ttk.Frame(body)
        body.add(left, weight=3)
        body.add(right, weight=2)
        self._build_fields(left)
        self._build_editor(left)
        self._build_actions(right)

        self.set_text(NEW_SONG)
        self.text.edit_modified(False)
        root.protocol("WM_DELETE_WINDOW", self.on_close)
        root.after(100, self._poll_messages)

    # ------------------------------------------------------------- layout

    def _build_toolbar(self):
        bar = ttk.Frame(self.root)
        bar.pack(fill="x", padx=8, pady=8)
        for label, cmd in (("New", self.new), ("Open…", self.open), ("Save", self.save),
                           ("Save as…", self.save_as), ("Import…", self.import_music)):
            ttk.Button(bar, text=label, command=cmd).pack(side="left", padx=(0, 6))
        self.path_label = ttk.Label(bar, text="(not saved yet)", foreground="#555")
        self.path_label.pack(side="left", padx=12)

    def _build_fields(self, parent):
        box = ttk.LabelFrame(parent, text="Song details (shown on the title slide)")
        box.pack(fill="x", pady=(0, 8))
        self.vars: dict[str, tk.StringVar] = {}
        for i, (key, label) in enumerate(FIELDS):
            ttk.Label(box, text=label).grid(row=i // 2, column=(i % 2) * 2, sticky="w", padx=6, pady=3)
            var = tk.StringVar()
            if key == "copyright_status":
                widget = ttk.Combobox(box, textvariable=var, values=COPYRIGHT_STATUSES, state="readonly")
            else:
                widget = ttk.Entry(box, textvariable=var)
            widget.grid(row=i // 2, column=(i % 2) * 2 + 1, sticky="ew", padx=6, pady=3)
            var.trace_add("write", lambda *_: self._fields_changed())
            self.vars[key] = var
        box.columnconfigure(1, weight=1)
        box.columnconfigure(3, weight=1)

    def _build_editor(self, parent):
        box = ttk.LabelFrame(parent, text="Song file (notes, words, order)")
        box.pack(fill="both", expand=True)
        self.text = tk.Text(box, wrap="none", undo=True, font=("Consolas", 11))
        ys = ttk.Scrollbar(box, orient="vertical", command=self.text.yview)
        xs = ttk.Scrollbar(box, orient="horizontal", command=self.text.xview)
        self.text.configure(yscrollcommand=ys.set, xscrollcommand=xs.set)
        self.text.grid(row=0, column=0, sticky="nsew")
        ys.grid(row=0, column=1, sticky="ns")
        xs.grid(row=1, column=0, sticky="ew")
        box.rowconfigure(0, weight=1)
        box.columnconfigure(0, weight=1)
        self.text.bind("<FocusOut>", lambda _: self._text_to_fields())

    def _build_actions(self, parent):
        theme = ttk.LabelFrame(parent, text="Theme")
        theme.pack(fill="x", pady=(0, 8))
        self.theme = tk.StringVar(value="light")
        for value, label in (("light", "Light (black on white)"), ("dark", "Dark (white on black)"),
                             ("color", "Colour background")):
            ttk.Radiobutton(theme, text=label, value=value, variable=self.theme).pack(anchor="w", padx=6)
        row = ttk.Frame(theme)
        row.pack(fill="x", padx=6, pady=6)
        ttk.Button(row, text="Choose colour…", command=self.pick_color).pack(side="left")
        self.swatch = tk.Label(row, width=6, background=self.bg_color, relief="solid", borderwidth=1)
        self.swatch.pack(side="left", padx=8)

        act = ttk.LabelFrame(parent, text="Make")
        act.pack(fill="x", pady=(0, 8))
        row = ttk.Frame(act)
        row.pack(fill="x", padx=6, pady=4)
        ttk.Label(row, text="Line:").pack(side="left")
        self.line = ttk.Combobox(row, width=8, state="readonly")
        self.line.pack(side="left", padx=6)
        ttk.Button(row, text="Preview", command=self.preview).pack(side="left")
        ttk.Button(act, text="Build slides", style="Big.TButton", command=self.build).pack(fill="x", padx=6, pady=4)
        ttk.Button(act, text="Picture slides from a scan…", command=self.picture_slides).pack(fill="x", padx=6, pady=4)
        row = ttk.Frame(act)
        row.pack(fill="x", padx=6, pady=4)
        self.voice = ttk.Combobox(row, width=10, state="readonly", values=["all voices", *VOICES])
        self.voice.set("all voices")
        self.voice.pack(side="left")
        ttk.Button(row, text="Make MIDI (listen)", command=self.make_midi).pack(side="left", padx=6)
        ttk.Button(act, text="Open output folder", command=self.open_folder).pack(fill="x", padx=6, pady=(4, 8))

        self.image_label = ttk.Label(parent, anchor="center", relief="sunken")
        self.image_label.pack(fill="both", expand=True, pady=(0, 8))
        self.log = tk.Text(parent, height=9, state="disabled", wrap="word", font=("Consolas", 10))
        self.log.pack(fill="x")

    # ------------------------------------------------------------- song text and fields

    def get_text(self) -> str:
        return self.text.get("1.0", "end-1c")

    def set_text(self, text: str):
        view, cursor = self.text.yview()[0], self.text.index("insert")
        self.text.delete("1.0", "end")
        self.text.insert("1.0", text)
        self.text.mark_set("insert", cursor)
        self.text.yview_moveto(view)
        self._text_to_fields()

    def _text_to_fields(self):
        try:
            data = yaml.safe_load(self.get_text()) or {}
        except yaml.YAMLError:
            return
        if not isinstance(data, dict):
            return
        self.syncing = True
        for key, var in self.vars.items():
            value = data.get(key, "public_domain" if key == "copyright_status" else "")
            var.set("" if value is None else str(value))
        self.syncing = False
        self.line.configure(values=[str(p.get("name")) for p in data.get("phrases") or [] if isinstance(p, dict)])
        if self.line.get() not in self.line.cget("values"):
            self.line.set(self.line.cget("values")[0] if self.line.cget("values") else "")

    def _fields_changed(self):
        if self.syncing:
            return
        if self.pending_fields:
            self.root.after_cancel(self.pending_fields)
        self.pending_fields = self.root.after(300, self._fields_to_text)

    def _fields_to_text(self):
        self.pending_fields = None
        text = self.get_text()
        for key, var in self.vars.items():
            text = set_top_key(text, key, var.get())
        if text != self.get_text():
            self.syncing = True
            view, cursor = self.text.yview()[0], self.text.index("insert")
            self.text.delete("1.0", "end")
            self.text.insert("1.0", text)
            self.text.mark_set("insert", cursor)
            self.text.yview_moveto(view)
            self.syncing = False

    def load_song(self):
        """The song in the editor, checked. Shows a message and returns None on a mistake."""
        self._fields_to_text()
        try:
            data = yaml.safe_load(self.get_text())
            return song_from_dict(data or {})
        except (yaml.YAMLError, SongError) as exc:
            messagebox.showerror("Problem in the song file", str(exc))
            return None

    # ------------------------------------------------------------- files

    def new(self):
        if self._confirm_discard():
            self.path = None
            self.path_label.configure(text="(not saved yet)")
            self.set_text(NEW_SONG)
            self.text.edit_modified(False)

    def open(self):
        if not self._confirm_discard():
            return
        name = filedialog.askopenfilename(filetypes=[("Song files", "*.yaml *.yml"), ("All files", "*.*")])
        if name:
            self.path = Path(name)
            self.path_label.configure(text=str(self.path))
            self.set_text(self.path.read_text(encoding="utf-8"))
            self.text.edit_modified(False)

    def save(self) -> bool:
        if self.path is None:
            return self.save_as()
        self._fields_to_text()
        self.path.write_text(self.get_text(), encoding="utf-8")
        self.text.edit_modified(False)
        self.say(f"Saved {self.path}")
        return True

    def save_as(self) -> bool:
        name = filedialog.asksaveasfilename(defaultextension=".yaml",
                                            filetypes=[("Song files", "*.yaml"), ("All files", "*.*")])
        if not name:
            return False
        self.path = Path(name)
        self.path_label.configure(text=str(self.path))
        return self.save()

    def import_music(self):
        """MusicXML or a scanned page -> a new song file, plus review.html to check it."""
        if not self._confirm_discard():
            return
        name = filedialog.askopenfilename(
            title="Import music",
            filetypes=[("Music files", "*.musicxml *.mxl *.xml *.pdf *.png *.jpg *.jpeg"),
                       ("MusicXML from MuseScore", "*.musicxml *.mxl *.xml"),
                       ("Scanned pages", "*.pdf *.png *.jpg *.jpeg"), ("All files", "*.*")])
        if not name:
            return
        source = Path(name)
        pages = None
        if source.suffix.lower() == ".pdf":
            pages = simpledialog.askstring("Pages", "Which pages? For example 20-21 (leave empty for all):",
                                           parent=self.root) or None
        from . import omr
        from .importer import MUSICXML, import_file

        if source.suffix.lower() not in MUSICXML and not (omr.has_oemer() or omr.find_audiveris()):
            if not messagebox.askyesno(
                    "Install the music reader?",
                    "To read a scanned page, HymnSlides needs its music reader (oemer).\n\n"
                    "Install it now? It downloads about 200 MB and takes a few minutes. "
                    "Reading the first page then downloads its models once more.\n\n"
                    "Please note: music readers make many mistakes on hymn pages. You will "
                    "need to check and correct the result."):
                return
            self.run_in_background("Installing the music reader… (a few minutes)",
                                   lambda: omr.install_oemer(log=self.say),
                                   lambda _: (self.say("Music reader installed."),
                                              self._start_import(source, pages)))
            return
        self._start_import(source, pages)

    def _start_import(self, source: Path, pages):
        from .importer import import_file

        def done(outcome):
            self.path = outcome.song_path
            self.path_label.configure(text=str(self.path))
            self.set_text(self.path.read_text(encoding="utf-8"))
            self.text.edit_modified(False)
            for w in outcome.warnings:
                self.say(f"Warning: {w}")
            for p in outcome.problems:
                self.say(f"Problem to fix: {p}")
            self.say("Check every line in the review page, fix the song file, then change "
                     "'reviewed: false' to 'reviewed: true'.")
            open_path(outcome.review_path)

        self.run_in_background(f"Importing {source.name}…",
                               lambda: import_file(source, pages=pages, log=self.say), done)

    def _confirm_discard(self) -> bool:
        if not self.text.edit_modified():
            return True
        answer = messagebox.askyesnocancel("Save changes?", "Save the changes to this song first?")
        if answer is None:
            return False
        return self.save() if answer else True

    def on_close(self):
        if self._confirm_discard():
            self.root.destroy()

    def output_folder(self) -> Path:
        folder = self.path.parent if self.path else Path.home() / "Documents" / "HymnSlides"
        folder.mkdir(parents=True, exist_ok=True)
        return folder

    def output_stem(self, song) -> str:
        if self.path:
            return self.path.stem
        return re.sub(r"[^A-Za-z0-9]+", "_", song.title).strip("_") or "song"

    # ------------------------------------------------------------- actions

    def pick_color(self):
        color = colorchooser.askcolor(color=self.bg_color, title="Background colour")[1]
        if color:
            self.bg_color = color
            self.swatch.configure(background=color)
            self.theme.set("color")

    def preview(self):
        song = self.load_song()
        if song is None or not self.line.get():
            return
        out = self.out_dir / "preview.png"
        self.out_dir.mkdir(parents=True, exist_ok=True)
        line = self.line.get()
        self.run_in_background(f"Engraving line {line}…",
                               lambda: preview_line(song, line, out),
                               lambda result: self.show_image(out, result))

    def show_image(self, path: Path, result):
        img = Image.open(path)
        width = max(200, self.image_label.winfo_width() - 10)
        img.thumbnail((width, 2000))
        self.preview_image = ImageTk.PhotoImage(img)
        self.image_label.configure(image=self.preview_image)
        pt = result.lyric_pt((12.9, 3.2))
        note = "" if pt >= 30 else " The slides will give this line more room to reach 30 pt."
        self.say(f"Preview done: lyrics {pt:.1f} pt with 2 lines on a slide.{note}")

    def build(self):
        song = self.load_song()
        if song is None:
            return
        theme = self.theme.get()
        out = self.output_folder() / f"{self.output_stem(song)}-{theme}.pptx"
        bg = self.bg_color if theme == "color" else None
        self.run_in_background(f"Building {song.title} ({theme})… this takes about a minute.",
                               lambda: build_deck(song, out, theme, bg, log=self.say),
                               lambda slides: self.say(f"Done: {out}  ({len(slides) + 1} slides)"))

    def picture_slides(self):
        """Slides with the printed music cut straight from scans; uses the song details above."""
        names = filedialog.askopenfilenames(
            title="Choose the scanned pages, in order",
            filetypes=[("Scans and photos", "*.pdf *.png *.jpg *.jpeg"), ("All files", "*.*")])
        if not names:
            return
        sources = [Path(n) for n in names]
        pages = None
        if any(p.suffix.lower() == ".pdf" for p in sources):
            pages = simpledialog.askstring("Pages", "Which pages? For example 20-21 (leave empty for all):",
                                           parent=self.root) or None
        verses = simpledialog.askinteger(
            "Verses", "How many verses? The music is shown once for each verse\n"
            "(labelled Stanza 1, 2, …). Type 1 to show it once.",
            parent=self.root, initialvalue=1, minvalue=1, maxvalue=12)
        if verses is None:
            return
        self._fields_to_text()
        meta = {key: var.get() for key, var in self.vars.items()}
        if not meta.get("title"):
            meta["title"] = sources[0].stem
        theme = self.theme.get()
        bg = self.bg_color if theme == "color" else None
        safe = re.sub(r"[^A-Za-z0-9]+", "_", meta["title"]).strip("_") or "hymn"
        out = self.output_folder() / f"{safe}-pictures-{theme}.pptx"
        from .picture import build_picture_deck
        self.run_in_background(
            f"Making picture slides for {meta['title']}…",
            lambda: build_picture_deck(sources, out, meta, theme, bg, pages, verses=verses, log=self.say),
            lambda n: self.say(f"Done: {out}  ({n + 1} slides). The title slide uses the song details above."))

    def make_midi(self):
        song = self.load_song()
        if song is None:
            return
        voice = None if self.voice.get() == "all voices" else self.voice.get()
        suffix = f"-{voice}" if voice else ""
        out = self.output_folder() / f"{self.output_stem(song)}{suffix}.mid"
        self.run_in_background("Writing MIDI…", lambda: write_midi(song, out, voice=voice),
                               lambda _: (self.say(f"Done: {out}"), open_path(out)))

    def open_folder(self):
        open_path(self.output_folder())

    # ------------------------------------------------------------- background work and log

    def run_in_background(self, message: str, work, done):
        if self.busy:
            self.say("Please wait, still working…")
            return
        self.busy = True
        self.say(message)

        def task():
            try:
                result = work()
                self.messages.put(("done", done, result))
            except Exception as exc:  # shown to the user, not swallowed
                self.messages.put(("error", None, exc))

        threading.Thread(target=task, daemon=True).start()

    def say(self, text: str):
        self.messages.put(("log", None, text))

    def _poll_messages(self):
        try:
            while True:
                kind, done, value = self.messages.get_nowait()
                if kind == "log":
                    self.log.configure(state="normal")
                    self.log.insert("end", value + "\n")
                    self.log.see("end")
                    self.log.configure(state="disabled")
                elif kind == "done":
                    self.busy = False
                    done(value)
                else:
                    self.busy = False
                    self.say(f"Problem: {value}")
                    messagebox.showerror("Problem", str(value))
        except queue.Empty:
            pass
        self.root.after(100, self._poll_messages)


def open_path(path: Path):
    """Open a file or folder with the computer's usual program."""
    if sys.platform.startswith("win"):
        os.startfile(path)  # noqa: S606 - opening the user's own output
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


def run():
    root = tk.Tk()
    App(root)
    root.mainloop()

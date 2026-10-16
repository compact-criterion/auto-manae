# Build "HymnSlides": a tool that turns hymn music into slide decks with notation

## Who this is for
I am a math teacher and a preacher in a Fundamental Baptist church. I am not a
professional programmer. I run Windows 10/11 and I will install Python 3.12 myself.
Explain every command I need to type, and keep the setup to `pip install` only:
no compilers, no extra programs I must download, unless they are optional.

## Goal
Build a Python program that makes PowerPoint (.pptx) slides for congregational
singing. Each music slide shows engraved SATB music (treble + bass staves) with
the lyrics between the staves, large enough to read on a projector from the back
of the church.

Two ways to enter music:
1. **Manual mode**: I type the notes and lyrics in a simple text song file.
2. **Automatic mode**: I give it a MusicXML file (exported from MuseScore) or a
   scanned hymnal page (PDF/PNG/JPG), and it converts it into the same song file
   so I can check and fix it before building slides.

Both modes end in the same place: one song file → one engraving pipeline → one deck.

## Tech stack (use these)
- **Verovio** (`pip install verovio`) to engrave MEI to SVG. For MusicXML input,
  load it with Verovio or `music21`, then convert to my song file format.
  Do NOT require LilyPond or MuseScore to be installed.
- **SVG → PNG**: use **resvg** through the `resvg-py` pip package (it has Windows
  wheels and needs no extra DLLs). Do NOT use cairosvg: on Windows it needs the GTK
  Cairo DLLs, which a normal user does not have. Render at about 3600 px wide.
- **Pillow** to recolor the PNG (keep the alpha channel, fill the color with the
  theme color) and to crop it to the content with a small margin.
- **python-pptx** to build the deck: 16:9, 13.333 × 7.5 in.
- **PyYAML** for song files, **mido** for MIDI output, **PyMuPDF** to read PDF pages.
- OMR (optical music recognition) for scanned pages:
  - `oemer` (pip) as the default engine, installed as an optional extra:
    `pip install hymnslides[omr]`.
  - **Audiveris** as an optional, better engine if I have installed it; detect it
    on the PATH or by a setting in the config file.
  - OMR is never perfect. Its output must always go through the review step.
- Fonts: bundle **Fira Sans Medium** (SIL Open Font License, include the license
  file) and point resvg at it, so lyrics look the same on every PC. Use
  **Segoe UI** for slide text, since it is on every Windows PC.

## Song file format (YAML; document it fully in the README)
```yaml
title: Blessed Assurance
number: 334                 # optional hymn number
scripture: "Hebrews 10:22"  # optional, shown in italics
words: Fanny J. Crosby, 1873
music: Phoebe P. Knapp, 1873
copyright_status: public_domain   # public_domain | licensed | template_only
copyright: ""               # required if licensed
ccli_song: ""               # required if licensed
ccli_license: ""            # required if licensed (the church's license number)
key: D                      # major keys like D, Ab; minor like "c minor"
time: 9/8
pickup: e                   # optional anacrusis length

phrases:                    # one phrase = one line (system) of music
  - name: A1
    treble: |               # one measure per line; "|" also allowed
      e:F#4,D4 | q.:A4,D4 ...
    bass: |
      ...
lyrics:
  stanza1:
    A1: "Bless-ed as-sur-ance, Je-sus is mine! ..."
  refrain:
    R1: "This is my sto-ry, this is my song, ..."
structure:                  # order the deck plays in
  - { label: "Stanza 1", phrases: [A1, A2, A3, A4], lyrics: stanza1 }
  - { label: "Refrain",  phrases: [R1, R2, R3, R4], lyrics: refrain }
  - { label: "Stanza 2", phrases: [A1, A2, A3, A4], lyrics: stanza2 }
  - { label: "Refrain",  phrases: [R1, R2, R3, R4], lyrics: refrain }
```
Note syntax (keep it this simple):
- An event is `duration:pitches`. Durations: `s, e, e., q, q., h, h., w`.
  Pitches like `F#4`, `Bb3`, `C5`; a chord is pitches joined by commas
  (`q:F4,Db4`); a rest is `r` (`q:r`).
- Fermata: `!` after the duration (`q.!:Db5`). Tie: `~` after the pitch (`h:Ab4~`).
- **Two layers per staff** when voices move separately, written as
  `layer1 // layer2` inside a measure (for example, soprano holds "Stand—ing"
  while alto sings "Standing on the promises"). Give a second lyric line for the
  alto layer.
- Lyrics: syllables split by spaces, `-` joins to the next syllable with a hyphen,
  `_` means "this note continues the previous syllable" (melisma, with an extender
  line). Words are matched to notes of the top layer of the treble staff.
- Validation with clear, friendly errors: "Stanza 2, line A3, measure 2 has 8
  eighths but 9/8 needs 9" or "Stanza 1 line A2 has 11 syllables but 12 notes".

## Engraving rules (these make it look like a real hymnal)
- **One stanza on screen at a time**: each music slide shows only the lyric line
  of the current stanza, not all stanzas stacked.
- Accidentals: notes that match the key get `accid.ges` (no printed sign). Notes
  outside the key print an accidental only the first time in a measure (and print
  the natural/sharp again when it changes back).
- Beam eighths and sixteenths by beat (by dotted quarter in 6/8, 9/8, 12/8).
  Stems: in SATB, soprano/tenor stems up, alto/bass stems down when layered.
- **One phrase per system, 2 systems per slide.** When a long note ends a phrase
  and a pickup starts the next phrase in the same measure, split it into two
  partial measures, so each line starts with its own pickup, like a hymnal.
- Verovio options to use: `breaks: "encoded"` with `<sb/>` between systems,
  `minLastJustification: 0` so the last line is justified too, hide measure
  numbers, `header: "none"`, `footer: "none"`, `adjustPageHeight: true`.
- Final barline at the end of each stanza and at the end of the song.
- Show key and time signature on the first system of each slide (clef and key on
  every system).
- **Lyrics at least 30 pt on the finished slide.** Compute it, don't guess:
  `lyric_pt = lyric_height_px × (image_width_on_slide_in × 72 / png_width_px)`.
  Increase Verovio's `lyricSize` and the overall scale until it is ≥ 30 pt. If the
  line then does not fit the slide width, reduce the measures per line (split the
  phrase in two systems), never the font. Print the final lyric size for each slide.

## Slide deck rules
- **Title slide**: hymn number, title, scripture (italic), words and music credits,
  copyright line and CCLI line when given. All text ≥ 30 pt (title larger).
- **Music slides**: a label at top-left ("Stanza 1", "Refrain", "Bridge") at 30 pt,
  then the music image centered and as large as fits, with small even margins.
- Repeat the refrain slides after every stanza, so the deck plays straight through
  with only the "next" key. Optional final "Amen" slide if the song has one.
- Put the full lyrics of each slide in the **speaker notes** (helps the operator).
- **Themes**:
  - `dark`: white music on #1C1C1C
  - `light`: near-black #111111 music on white
  - `color --bg "#8B1A1A"`: any background color; the music sits on a white
    rounded panel with black notation, so it stays readable. Label text is white.
- **Template mode**: makes a deck with the title slide and empty labeled section
  slides containing the panel and the text "Paste 2 music systems here", so I can
  fill it with crops from my licensed sheet music.

## Review step (required for automatic mode)
After `import`, create `review.html` that shows each engraved line next to the
matching crop of the original page, so I can compare them line by line. Also
write a MIDI file (SATB on separate tracks, a sensible tempo) so I can listen and
catch wrong notes. Then I edit the song file and run `build`. `build` refuses to
run on an imported file until I change `reviewed: false` to `reviewed: true`.

## Interface
Command-line tool (installed with `pip install -e .`):
- `hymnslides build song.yaml --theme light` → `song.pptx`
- `hymnslides preview song.yaml --line A1` → one PNG of one line (for quick checks)
- `hymnslides template --title "..." --sections "Stanza 1:2,Refrain:2" --theme color --bg "#8B1A1A"`
- `hymnslides import page.pdf --pages 20-21` (OMR → editable song file + review.html)
- `hymnslides import song.musicxml` (MusicXML → editable song file + review.html)
- `hymnslides midi song.yaml`

Also make a **simple local GUI** (Tkinter, so no extra install): fields for
metadata, a text box for the song file, theme choice and color picker, and
Preview / Build / Open Folder buttons. Start it with `hymnslides gui` or by
double-clicking `HymnSlides.bat`.

## Copyright rules
- `public_domain`: no extra lines needed.
- `licensed`: the build must stop with an error unless `copyright`, `ccli_song`,
  and `ccli_license` are filled in; all three appear on the title slide.
- `template_only`: only template mode is allowed (no engraving of the music).

## Deliverables
- The program as a Python package with a `pyproject.toml`, and a clear folder
  layout (`songformat/`, `engrave/`, `deck/`, `omr/`, `gui/`).
- A README for a non-programmer: installing Python on Windows (tick "Add to PATH"),
  installing HymnSlides, writing a song file step by step, examples, and a
  "common errors" section.
- Two public-domain example songs that together test every feature:
  - "Blessed Assurance" (9/8, D major, with refrain)
  - "Standing on the Promises" (4/4, A-flat major, refrain with split
    soprano/alto parts and a fermata)
- Tests (`pytest`) that build both examples in all three themes and check:
  the .pptx opens, every music slide has exactly one picture, the lyric size is
  ≥ 30 pt, all slide text is ≥ 30 pt, the refrain appears after every stanza,
  and the licensed-without-CCLI case fails with a clear error.

## How to work
Work in milestones and stop after each one to show me the result:
1. Song file format + parser + validation, and engraving of **one line** →
   show me a preview PNG of "Blessed Assurance" line 1.
2. Full deck for both examples in all three themes, plus template mode.
3. MIDI output and the GUI.
4. Automatic import (MusicXML first, then OMR) with the review page.

At each milestone, run the tests, show me screenshots of a few slides
(convert the .pptx to images to check them yourself), and fix anything that looks
crowded, cut off, or too small before moving on.

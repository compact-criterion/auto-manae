# HymnSlides

Makes PowerPoint slides for congregational singing with engraved SATB music
and large lyrics (at least 30 pt on the slide).

**Status: all 4 milestones**: song files, engraving, slide decks in three themes,
template mode, MIDI files for listening, a simple window, and importing music
from MuseScore (MusicXML) or scanned hymnal pages.

> **Check the example songs before using them in a service.**
> Both songs were transcribed from hymnal pages ("Blessed Assurance", Hymn 381;
> "Standing on the Promises", Hymn 395) and still need proofreading.
The full plan is in [`prompts/hymnslides-prompt.md`](prompts/hymnslides-prompt.md).

## Install (Windows)
1. Install Python 3.12 from python.org. On the first screen, tick **"Add python.exe to PATH"**.
2. Open **Command Prompt** in this folder and type:
   ```
   pip install -e .
   ```

## Try it
```
hymnslides check examples/blessed_assurance.yaml
hymnslides preview examples/blessed_assurance.yaml --line A1
```
The second command writes `blessed_assurance-A1.png`.

## The HymnSlides window
Double-click **`HymnSlides.bat`** (or type `hymnslides gui`). In the window:

- **Song details**: title, hymn number, scripture, credits and copyright. These
  are the lines of the song file shown on the title slide; typing here updates
  the song file below, and editing the song file updates these fields.
- **Song file**: the notes, words and order (see "Writing a song file").
- **Theme**: light, dark, or a colour you choose with **Choose colour…**.
- **Preview**: engraves one line, so you can check it quickly.
- **Build slides**: makes the `.pptx` next to your song file (about a minute).
- **Make MIDI (listen)**: makes a MIDI file and plays it. Choose one voice
  (soprano, alto, tenor or bass) to hear that part loud and the others soft.
- **Open output folder**: shows the files you made.

New songs that are not saved yet go to `Documents\HymnSlides`.

## Listen for wrong notes (MIDI)
```
hymnslides midi examples/blessed_assurance.yaml
hymnslides midi examples/blessed_assurance.yaml --voice alto
```
Each voice is on its own track (soprano, alto, tenor, bass). `--voice` makes one
part loud and the others soft, which is the easiest way to proofread a part.
By default you hear one stanza and the refrain; add `--all` for every stanza.
Other options: `--tempo 72` (beats per minute; dotted quarters in 6/8 and 9/8),
`--sound organ` or `--sound choir`. You can also put `tempo: 72` in the song file.

## Import music instead of typing it
```
hymnslides import "Great Hymn.mxl"
hymnslides import hymnal.pdf --pages 20-21
hymnslides import page.jpg
```
(or the **Import…** button in the window). This writes three things next to the
file you import:

- **the song file** (`.yaml`) with the notes, the words of every verse, and the
  order (stanzas, with the refrain after each one);
- **a MIDI file** to listen for wrong notes;
- **a review page** (`…-review/review.html`): every line as HymnSlides read it,
  next to that part of the page for scans. Open it in your web browser.

Imported songs start with `reviewed: false`, and **slides cannot be built until
you have checked them**: compare each line with the page, fix the song file, and
then change it to `reviewed: true`. Also check the title, credits and
`copyright_status`.

**From MuseScore** (most reliable): open or type the hymn in MuseScore, then
*File → Export → MusicXML* (`.mxl` or `.musicxml`). MuseScore's line breaks
become the lines of the slides; without them HymnSlides uses about 8 beats per
line (`--measures-per-line 3` to choose). Verses must be entered as verse 1, 2, 3…
Lines where only verse 1 has words become the refrain.

**From a scan or PDF page** (needs proofreading): first install the music reader
once:
```
hymnslides install-omr
```
This installs oemer. Reading one page takes a few minutes. If you install
[Audiveris](https://audiveris.github.io) (free, usually more accurate),
HymnSlides uses it instead; choose with `--engine oemer` or `--engine audiveris`.
Scan at 300 dpi or more, straight and well lit.

## Make a slide deck
```
hymnslides build examples/blessed_assurance.yaml --theme light
hymnslides build examples/blessed_assurance.yaml --theme dark
hymnslides build examples/standing_on_the_promises.yaml --theme color --bg "#8B1A1A"
```
Each command writes a `.pptx` and lists every slide with its lyric size.
Building one song takes about half a minute.

- **Title slide**: hymn number, title, scripture (italic), words and music credits,
  and the copyright and CCLI lines when given.
- **Music slides**: a label ("Stanza 1", "Refrain"), then two lines of music. If the
  lyrics would come out under 30 pt, the program puts one line per slide instead,
  and splits a long line into two shorter ones if needed.
- The **refrain is repeated after every stanza** automatically. To write the order
  yourself, add `repeat_refrain: false` to the song file.
- The words of each slide are in the **speaker notes** for the slide operator.
- Themes: `light` (black on white), `dark` (white on #1C1C1C), `color` (any
  background color, with the music on a white panel).

## Template mode (for copyrighted songs)
Makes a deck with a title slide and empty white panels to paste crops of your
licensed sheet music into:
```
hymnslides template --title "Great Is Thy Faithfulness" --sections "Stanza 1:2,Refrain:2" --theme color --bg "#8B1A1A"
```
Optional: `--number`, `--scripture`, `--words`, `--music`, `--copyright`,
`--ccli-song`, `--ccli-license`, and `--status licensed` (which requires the
copyright and both CCLI numbers).

## Copyright status
Every song file has `copyright_status:`
- `public_domain`: nothing extra needed.
- `licensed`: `copyright:`, `ccli_song:` and `ccli_license:` must be filled in;
  they appear on the title slide.
- `template_only`: the music may not be engraved; use template mode.

## Writing a song file (short version)
- Each **phrase** is one line of music. Write the treble staff (soprano + alto) and
  the bass staff (tenor + bass) with one measure per line.
- A note or chord is `duration:pitches`, for example `q:F#4,D4`.
  - Durations: `s` (16th), `e` (8th), `e.`, `q` (quarter), `q.`, `h` (half), `h.`, `w` (whole).
  - Pitches are **absolute**: write `F#4` in D major even though the key already
    has F-sharp. The program hides accidentals the key signature already shows.
  - Rest: `q:r`. Tie: `~` after a pitch (`e:D4~`). Fermata: `!` after the duration (`q.!:D5`).
  - Two voices on one staff: `layer 1 // layer 2`. Give the second voice its own
    words with a `.alto` line, for example `R1.alto: "Stand-ing on the prom-is-es"`.
- Lyrics: `Bless-ed as-sur-ance` (a hyphen joins syllables). Use `_` for a note
  that holds the previous syllable.
- `structure:` lists the sections in order; each names its lines and its lyrics.
- If something is wrong, the program tells you where, for example:
  `Line A1 (treble), measure 2 has 8 eighths but 9/8 needs 9`.

## Common errors
- **"has 8 eighths but 9/8 needs 9"**: a measure is too short or too long. Count
  the durations in that measure.
- **"has 11 syllables but 12 notes"**: add or remove a syllable, or use `_` for a
  note that holds the previous syllable.
- **"has not been checked yet"**: an imported song; see "Import music".
- **"No music reader is installed"**: run `hymnslides install-omr`.

## Run the tests
```
pip install -e .[test]
pytest
```

## Fonts
Lyrics use Fira Sans Medium (in `hymnslides/fonts`, SIL Open Font License).

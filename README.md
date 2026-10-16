# HymnSlides

Makes PowerPoint slides for congregational singing with engraved SATB music
and large lyrics (at least 30 pt on the slide).

**Status: Milestone 2 of 4**: song files, engraving, full slide decks in three
themes, and template mode. MIDI and a window (GUI) come in Milestone 3; reading
MusicXML files and scanned pages comes in Milestone 4.

> **The two example songs are not checked against a hymnal.** Their words are the
> real public-domain texts, but the notes are stand-ins so the program can be
> tested. Type the real music from your hymnal before using them in a service.
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

## Run the tests
```
pip install -e .[test]
pytest
```

## Fonts
Lyrics use Fira Sans Medium (in `hymnslides/fonts`, SIL Open Font License).

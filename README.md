# HymnSlides

Makes PowerPoint slides for congregational singing with engraved SATB music
and large lyrics (at least 30 pt on the slide).

**Status: Milestone 1 of 4**: the song file format, error checking, and engraving
of one line of music to a PNG. Building the slide deck comes in Milestone 2.
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

## Writing a song file (short version)
- Each **phrase** is one line of music. Write the treble staff (soprano + alto) and
  the bass staff (tenor + bass) with one measure per line.
- A note or chord is `duration:pitches`, for example `q:F#4,D4`.
  - Durations: `s` (16th), `e` (8th), `e.`, `q` (quarter), `q.`, `h` (half), `h.`, `w` (whole).
  - Pitches are **absolute**: write `F#4` in D major even though the key already
    has F-sharp. The program hides accidentals the key signature already shows.
  - Rest: `q:r`. Tie: `~` after a pitch (`e:D4~`). Fermata: `!` after the duration (`q.!:D5`).
  - Two voices on one staff: `layer 1 // layer 2`.
- Lyrics: `Bless-ed as-sur-ance` (a hyphen joins syllables). Use `_` for a note
  that holds the previous syllable.
- If something is wrong, the program tells you where, for example:
  `Line A1 (treble), measure 2 has 8 eighths but 9/8 needs 9`.

## Run the tests
```
pip install -e .[test]
pytest
```

## Fonts
Lyrics use Fira Sans Medium (in `hymnslides/fonts`, SIL Open Font License).

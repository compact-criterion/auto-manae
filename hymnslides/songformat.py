"""Read and check HymnSlides song files (YAML).

A song file holds metadata, phrases (one line of music each, written per staff),
lyrics per stanza, and the structure (the order the deck plays in).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path

import yaml


class SongError(ValueError):
    """A mistake in the song file, explained in plain words."""


# Durations as fractions of a whole note, plus their MEI dur/dots.
DURATIONS = {
    "s": (Fraction(1, 16), "16", 0),
    "e": (Fraction(1, 8), "8", 0),
    "e.": (Fraction(3, 16), "8", 1),
    "q": (Fraction(1, 4), "4", 0),
    "q.": (Fraction(3, 8), "4", 1),
    "h": (Fraction(1, 2), "2", 0),
    "h.": (Fraction(3, 4), "2", 1),
    "w": (Fraction(1, 1), "1", 0),
}

MAJOR_FIFTHS = {"C": 0, "G": 1, "D": 2, "A": 3, "E": 4, "B": 5, "F#": 6, "C#": 7,
                "F": -1, "Bb": -2, "Eb": -3, "Ab": -4, "Db": -5, "Gb": -6, "Cb": -7}
MINOR_FIFTHS = {"A": 0, "E": 1, "B": 2, "F#": 3, "C#": 4, "G#": 5, "D#": 6, "A#": 7,
                "D": -1, "G": -2, "C": -3, "F": -4, "Bb": -5, "Eb": -6, "Ab": -7}
SHARP_ORDER = "FCGDAEB"

PITCH_RE = re.compile(r"^([A-Ga-g])(#|b|n)?(\d)(~)?$")
EVENT_RE = re.compile(r"^(s|e\.?|q\.?|h\.?|w)(!)?:(.+)$")


@dataclass
class Pitch:
    step: str           # "C".."B"
    alter: int          # +1 sharp, -1 flat, 0 natural (pitches are absolute)
    octave: int
    tie: bool = False   # tied to the same pitch in the next event


@dataclass
class Event:
    dur: Fraction
    mei_dur: str
    dots: int
    pitches: list[Pitch]  # empty list = rest
    fermata: bool = False

    @property
    def is_rest(self) -> bool:
        return not self.pitches


@dataclass
class Measure:
    layers: list[list[Event]]

    @property
    def length(self) -> Fraction:
        return sum((e.dur for e in self.layers[0]), Fraction(0))


@dataclass
class Phrase:
    name: str
    treble: list[Measure]
    bass: list[Measure]


@dataclass
class Syllable:
    text: str           # "" for a melisma note
    wordpos: str | None  # "i", "m", "t" or None (a whole word)
    hyphen: bool = False
    extend: bool = False  # draw an extender line (a melisma follows)


@dataclass
class Section:
    label: str
    phrases: list[str]
    lyrics: str


@dataclass
class Song:
    title: str
    key: str
    time: tuple[int, int]
    fifths: int
    phrases: dict[str, Phrase]
    lyrics: dict[str, dict[str, str]]
    structure: list[Section]
    meta: dict = field(default_factory=dict)

    @property
    def measure_length(self) -> Fraction:
        return Fraction(self.time[0], self.time[1])

    @property
    def compound(self) -> bool:
        return self.time[1] == 8 and self.time[0] % 3 == 0 and self.time[0] > 3

    def key_alter(self, step: str) -> int:
        """How the key signature changes a note name (+1, -1 or 0)."""
        n = abs(self.fifths)
        if self.fifths > 0 and step in SHARP_ORDER[:n]:
            return 1
        if self.fifths < 0 and step in SHARP_ORDER[::-1][:n]:
            return -1
        return 0


def parse_key(key: str) -> int:
    k = key.strip()
    minor = "minor" in k.lower() or k.endswith("m")
    name = k.split()[0].rstrip("m")
    name = name[0].upper() + name[1:]
    table = MINOR_FIFTHS if minor else MAJOR_FIFTHS
    if name not in table:
        raise SongError(f'I do not know the key "{key}". Try something like "D", "Ab" or "c minor".')
    return table[name]


def parse_time(time) -> tuple[int, int]:
    m = re.fullmatch(r"\s*(\d+)\s*/\s*(\d+)\s*", str(time))
    if not m:
        raise SongError(f'The time signature "{time}" should look like 4/4 or 9/8.')
    return int(m.group(1)), int(m.group(2))


def parse_pitch(text: str, where: str) -> Pitch:
    m = PITCH_RE.match(text.strip())
    if not m:
        raise SongError(f'{where}: "{text}" is not a pitch. Write pitches like F#4, Bb3 or C5.')
    acc = {"#": 1, "b": -1, "n": 0, None: 0}[m.group(2)]
    return Pitch(m.group(1).upper(), acc, int(m.group(3)), tie=bool(m.group(4)))


def parse_event(token: str, where: str) -> Event:
    m = EVENT_RE.match(token)
    if not m:
        raise SongError(
            f'{where}: "{token}" should be duration:pitches, for example q:F4,Db4 or e.:Eb4. '
            f"Durations are s, e, e., q, q., h, h., w."
        )
    dur, mei_dur, dots = DURATIONS[m.group(1)]
    body = m.group(3)
    pitches = [] if body.lower() == "r" else [parse_pitch(p, where) for p in body.split(",")]
    return Event(dur, mei_dur, dots, pitches, fermata=bool(m.group(2)))


def parse_staff(text: str, where: str) -> list[Measure]:
    measures = []
    for line in str(text).replace("|", "\n").splitlines():
        if not line.strip():
            continue
        n = len(measures) + 1
        layers = []
        for layer_text in line.split("//"):
            events = [parse_event(tok, f"{where}, measure {n}") for tok in layer_text.split()]
            if not events:
                raise SongError(f"{where}, measure {n}: a layer after // is empty.")
            layers.append(events)
        measures.append(Measure(layers))
    return measures


def parse_lyrics(text: str) -> list[Syllable]:
    """Turn "Bless-ed as-sur-ance, _ Je-sus" into one Syllable per note."""
    syllables: list[Syllable] = []
    for word in str(text).split():
        if word == "_":
            if syllables:
                syllables[-1].extend = True
            syllables.append(Syllable("", None))
            continue
        parts = word.split("-")
        if len(parts) == 1:
            syllables.append(Syllable(word, None))
            continue
        for i, part in enumerate(parts):
            pos = "i" if i == 0 else ("t" if i == len(parts) - 1 else "m")
            syllables.append(Syllable(part, pos, hyphen=pos != "t"))
    return syllables


def sung_notes(measures: list[Measure], layer: int = 0) -> list[Event]:
    """The events of one layer that start a new sung note (no rests, no tied endings)."""
    out, tied = [], False
    for m in measures:
        if layer >= len(m.layers):
            continue
        for ev in m.layers[layer]:
            if ev.is_rest:
                tied = False
                continue
            if not tied:
                out.append(ev)
            tied = any(p.tie for p in ev.pitches)
    return out


def load_song(path: str | Path) -> Song:
    path = Path(path)
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise SongError(f"{path.name} is not valid YAML: {exc}") from exc
    return song_from_dict(data)


def song_from_dict(data: dict) -> Song:
    for required in ("title", "key", "time", "phrases"):
        if required not in data:
            raise SongError(f'The song file needs a "{required}:" line.')

    phrases = {}
    for p in data["phrases"]:
        name = str(p.get("name", ""))
        if not name:
            raise SongError("Every phrase needs a name, for example  - name: A1")
        if name in phrases:
            raise SongError(f'Two phrases are both named "{name}".')
        treble = parse_staff(p.get("treble", ""), f"Line {name} (treble)")
        bass = parse_staff(p.get("bass", ""), f"Line {name} (bass)")
        phrases[name] = Phrase(name, treble, bass)

    lyrics = {str(k): {str(pk): str(pv) for pk, pv in (v or {}).items()}
              for k, v in (data.get("lyrics") or {}).items()}
    structure = [Section(str(s["label"]), [str(x) for x in s["phrases"]], str(s.get("lyrics", "")))
                 for s in data.get("structure") or []]
    if data.get("repeat_refrain", True):
        structure = _repeat_refrain(structure)
    meta = {k: v for k, v in data.items() if k not in ("phrases", "lyrics", "structure")}

    song = Song(str(data["title"]), str(data["key"]), parse_time(data["time"]),
                parse_key(str(data["key"])), phrases, lyrics, structure, meta)
    validate(song)
    return song


def _repeat_refrain(structure: list[Section]) -> list[Section]:
    """Put the refrain after every stanza, so the deck plays straight through."""
    refrain = next((s for s in structure if s.label.lower().startswith("refrain")), None)
    if refrain is None:
        return structure
    out = []
    for i, sec in enumerate(structure):
        out.append(sec)
        nxt = structure[i + 1] if i + 1 < len(structure) else None
        if sec.label.lower().startswith("stanza") and (nxt is None or nxt.label != refrain.label):
            out.append(refrain)
    return out


COPYRIGHT_STATUSES = ("public_domain", "licensed", "template_only")


def check_copyright(meta: dict, engraving: bool = True) -> None:
    """Stop when a licensed song is missing its copyright and CCLI lines."""
    status = str(meta.get("copyright_status", "public_domain"))
    if status not in COPYRIGHT_STATUSES:
        raise SongError(f'copyright_status must be one of {", ".join(COPYRIGHT_STATUSES)}, not "{status}".')
    if status == "licensed":
        missing = [k for k in ("copyright", "ccli_song", "ccli_license") if not str(meta.get(k) or "").strip()]
        if missing:
            raise SongError("This song is marked licensed, so the title slide must show "
                            f'{", ".join(missing)}. Fill in: ' + ", ".join(f"{k}:" for k in missing))
    if status == "template_only" and engraving:
        raise SongError("This song is marked template_only, so its music cannot be engraved. "
                        "Use `hymnslides template` instead.")


def validate(song: Song) -> None:
    full = song.measure_length
    for ph in song.phrases.values():
        if not ph.treble or not ph.bass:
            raise SongError(f"Line {ph.name} needs both treble and bass music.")
        if len(ph.treble) != len(ph.bass):
            raise SongError(f"Line {ph.name}: treble has {len(ph.treble)} measures "
                            f"but bass has {len(ph.bass)}.")
        for staff_name, measures in (("treble", ph.treble), ("bass", ph.bass)):
            for i, m in enumerate(measures):
                where = f"Line {ph.name} ({staff_name}), measure {i + 1}"
                lengths = {sum((e.dur for e in layer), Fraction(0)) for layer in m.layers}
                if len(lengths) > 1:
                    raise SongError(f"{where}: the two layers have different lengths.")
                length = lengths.pop()
                partial_ok = i == 0 or i == len(measures) - 1
                if length > full or (length < full and not partial_ok):
                    raise SongError(f"{where} has {_describe(length, song)} "
                                    f"but {song.time[0]}/{song.time[1]} needs {_describe(full, song)}.")
            for i, (t, b) in enumerate(zip(ph.treble, ph.bass)):
                if t.length != b.length:
                    raise SongError(f"Line {ph.name}, measure {i + 1}: treble and bass "
                                    f"have different lengths.")

    for sec in song.structure:
        for name in sec.phrases:
            if name not in song.phrases:
                raise SongError(f'{sec.label} uses line "{name}", but there is no phrase with that name.')
            words = song.lyrics.get(sec.lyrics, {}).get(name)
            if words is None:
                raise SongError(f'{sec.label}: no lyrics for line {name} '
                                f'(add it under lyrics: {sec.lyrics}:).')
            notes = sung_notes(song.phrases[name].treble)
            syls = parse_lyrics(words)
            if len(syls) != len(notes):
                raise SongError(f"{sec.label} line {name} has {len(syls)} syllables "
                                f"but {len(notes)} notes.")
            alto = song.lyrics.get(sec.lyrics, {}).get(f"{name}.alto")
            if alto is not None:
                alto_notes = sung_notes(song.phrases[name].treble, layer=1)
                if len(parse_lyrics(alto)) != len(alto_notes):
                    raise SongError(f"{sec.label} line {name}: the alto words have "
                                    f"{len(parse_lyrics(alto))} syllables but the alto part "
                                    f"(after //) has {len(alto_notes)} notes.")


def _describe(length: Fraction, song: Song) -> str:
    unit = Fraction(1, song.time[1])
    count = length / unit
    names = {2: "halves", 4: "quarters", 8: "eighths", 16: "sixteenths"}
    noun = names.get(song.time[1], f"1/{song.time[1]} notes")
    return f"{count} {noun}" if count.denominator == 1 else f"{float(count):g} {noun}"

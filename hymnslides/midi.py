"""Write a song as a MIDI file, one track per voice (SATB), for listening checks.

Voices come from the song file: on each staff the top note of a chord is the
upper voice (soprano / tenor) and the bottom note the lower voice (alto / bass).
When a staff has two layers, layer 1 is the upper voice and layer 2 the lower.
A single note means both voices sing it.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

import mido

from .songformat import Event, Pitch, Song, SongError

VOICES = ("soprano", "alto", "tenor", "bass")
SOUNDS = {"piano": 0, "organ": 19, "choir": 52}
TICKS = 480  # per quarter note
STEP_SEMITONES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi_number(p: Pitch) -> int:
    return 12 * (p.octave + 1) + STEP_SEMITONES[p.step] + p.alter


@dataclass
class _Note:
    start: Fraction   # in whole notes
    end: Fraction
    pitch: int
    tied: bool = False  # tied into the next note of the same pitch


def _voice_events(measure, upper: bool) -> list[tuple[Event, Pitch | None]]:
    """The events one voice sings in a measure, with the pitch it takes from each."""
    if len(measure.layers) > 1:
        layer = measure.layers[0] if upper else measure.layers[1]
    else:
        layer = measure.layers[0]
    out = []
    for ev in layer:
        if ev.is_rest:
            out.append((ev, None))
        else:
            ordered = sorted(ev.pitches, key=midi_number, reverse=True)
            out.append((ev, ordered[0] if upper else ordered[-1]))
    return out


def play_order(song: Song, whole: bool) -> list[str]:
    """Phrase names in singing order: the whole song, or each section once."""
    order, seen = [], set()
    for sec in song.structure:
        key = tuple(sec.phrases)
        if not whole and key in seen:
            continue
        seen.add(key)
        order.extend(sec.phrases)
    return order or list(song.phrases)


def build_voices(song: Song, whole: bool = False) -> tuple[dict[str, list[_Note]], list[tuple[Fraction, Fraction]]]:
    """Notes for each voice, plus fermatas as (time, extra hold)."""
    voices: dict[str, list[_Note]] = {v: [] for v in VOICES}
    fermatas: dict[Fraction, Fraction] = {}
    pos = Fraction(0)
    for name in play_order(song, whole):
        phrase = song.phrases[name]
        for tm, bm in zip(phrase.treble, phrase.bass):
            for voice, measure, upper in (("soprano", tm, True), ("alto", tm, False),
                                          ("tenor", bm, True), ("bass", bm, False)):
                t = pos
                notes = voices[voice]
                for ev, pitch in _voice_events(measure, upper):
                    if ev.fermata:
                        fermatas[t + ev.dur] = max(fermatas.get(t + ev.dur, Fraction(0)), ev.dur)
                    if pitch is not None:
                        n = midi_number(pitch)
                        last = notes[-1] if notes else None
                        if last and last.end == t and last.pitch == n and last.tied:
                            last.end = t + ev.dur  # a tie continues the sounding note
                        else:
                            notes.append(_Note(t, t + ev.dur, n))
                        notes[-1].tied = pitch.tie
                    t += ev.dur
            pos += tm.length
    return voices, sorted(fermatas.items())


def default_tempo(song: Song) -> int:
    """Beats per minute: dotted quarters in 6/8, 9/8, 12/8; otherwise the beat."""
    return 60 if song.compound else 92


def write_midi(song: Song, out: str | Path, tempo: int | None = None, whole: bool = False,
               voice: str | None = None, sound: str = "piano") -> Path:
    """Write the MIDI file. `voice` makes that part loud and the others soft."""
    if voice and voice not in VOICES:
        raise SongError(f'Voice must be one of {", ".join(VOICES)}, not "{voice}".')
    if sound not in SOUNDS:
        raise SongError(f'Sound must be one of {", ".join(SOUNDS)}, not "{sound}".')
    bpm = tempo or int(song.meta.get("tempo") or default_tempo(song))
    beat = Fraction(3, 8) if song.compound else Fraction(1, song.time[1])
    quarter_per_min = bpm * beat / Fraction(1, 4)
    voices, fermatas = build_voices(song, whole)

    def shift(t: Fraction) -> Fraction:
        return t + sum((extra for f, extra in fermatas if f <= t), Fraction(0))

    def ticks(t: Fraction) -> int:
        return round(t * 4 * TICKS)

    mid = mido.MidiFile(type=1, ticks_per_beat=TICKS)
    conductor = mido.MidiTrack()
    conductor.append(mido.MetaMessage("track_name", name=song.title, time=0))
    conductor.append(mido.MetaMessage("set_tempo", tempo=round(60_000_000 / quarter_per_min), time=0))
    conductor.append(mido.MetaMessage("time_signature", numerator=song.time[0],
                                      denominator=song.time[1], time=0))
    mid.tracks.append(conductor)

    for ch, name in enumerate(VOICES):
        track = mido.MidiTrack()
        track.append(mido.MetaMessage("track_name", name=name.capitalize(), time=0))
        track.append(mido.Message("program_change", channel=ch, program=SOUNDS[sound], time=0))
        loud = 110 if voice in (None, name) else 45
        track.append(mido.Message("control_change", channel=ch, control=7, value=loud, time=0))
        events = []
        for n in voices[name]:
            start, end = ticks(shift(n.start)), ticks(shift(n.end))
            events.append((start, 1, mido.Message("note_on", channel=ch, note=n.pitch, velocity=80)))
            events.append((max(start + 1, end - 10), 0, mido.Message("note_off", channel=ch, note=n.pitch, velocity=0)))
        events.sort(key=lambda e: (e[0], e[1]))
        now = 0
        for at, _, msg in events:
            track.append(msg.copy(time=at - now))
            now = at
        mid.tracks.append(track)

    out = Path(out)
    mid.save(out)
    return out

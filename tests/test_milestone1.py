from pathlib import Path

import pytest

from hymnslides.engrave import Line, build_mei, lines_for, preview_line
from hymnslides.songformat import SongError, load_song, parse_lyrics, song_from_dict

EXAMPLE = Path(__file__).parent.parent / "examples" / "blessed_assurance.yaml"


def test_example_loads():
    song = load_song(EXAMPLE)
    assert song.fifths == 2 and song.time == (9, 8) and song.compound


def test_key_signature_accidentals_are_hidden():
    song = load_song(EXAMPLE)
    mei = build_mei(song, lines_for(song, 0))
    assert 'accid.ges="s"' in mei          # F# and C# come from the key
    assert ' accid="' not in mei            # nothing outside the key is printed
    assert 'tie="i"' in mei and 'tie="t"' in mei
    assert 'right="end"' in mei


def test_out_of_key_accidental_printed_once_per_measure():
    song = song_from_dict({
        "title": "t", "key": "C", "time": "4/4",
        "phrases": [{"name": "A", "treble": "q:F#4 q:F#4 q:F4 q:F4", "bass": "w:C3"}],
    })
    mei = build_mei(song, [Line("A", None)])
    assert mei.count('accid="s"') == 1 and mei.count('accid="n"') == 1


def test_lyrics_syllables():
    syl = parse_lyrics("Bless-ed as-sur-ance, _ mine!")
    assert [s.text for s in syl] == ["Bless", "ed", "as", "sur", "ance,", "", "mine!"]
    assert syl[0].hyphen and syl[4].extend


def test_wrong_measure_length_is_explained():
    with pytest.raises(SongError, match="has 8 eighths but 9/8 needs 9"):
        song_from_dict({
            "title": "t", "key": "D", "time": "9/8",
            "phrases": [{"name": "A", "treble": "q.:D4 q.:D4 q.:D4\nq.:D4 q:D4 q.:D4\nq.:D4 q.:D4 q.:D4",
                         "bass": "h.:D3 q.:D3\nh.:D3 q.:D3\nh.:D3 q.:D3"}],
        })


def test_syllable_count_mismatch_is_explained():
    with pytest.raises(SongError, match="has 1 syllables but 2 notes"):
        song_from_dict({
            "title": "t", "key": "C", "time": "4/4",
            "phrases": [{"name": "A", "treble": "h:C4 h:D4", "bass": "w:C3"}],
            "lyrics": {"s1": {"A": "Hi"}},
            "structure": [{"label": "Stanza 1", "phrases": ["A"], "lyrics": "s1"}],
        })


def test_preview_lyrics_at_least_30pt(tmp_path):
    song = load_song(EXAMPLE)
    out = tmp_path / "a1.png"
    result = preview_line(song, "A1", out)
    assert out.exists() and result.png.width > 3000
    assert result.lyric_pt((12.9, 3.2)) >= 30

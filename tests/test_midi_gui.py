import os
from pathlib import Path

import mido
import pytest

from hymnslides.midi import build_voices, write_midi
from hymnslides.songformat import load_song

EXAMPLES = Path(__file__).parent.parent / "examples"


def test_midi_has_four_voices_in_the_right_order(tmp_path):
    song = load_song(EXAMPLES / "blessed_assurance.yaml")
    out = write_midi(song, tmp_path / "ba.mid")
    mid = mido.MidiFile(out)
    names = [t.name for t in mid.tracks[1:]]
    assert names == ["Soprano", "Alto", "Tenor", "Bass"]
    voices, _ = build_voices(song)
    # "Bless-ed as-sur-ance": F# E D A A
    assert [n.pitch for n in voices["soprano"][:5]] == [66, 64, 62, 69, 69]
    # Soprano is never below alto, tenor never below bass.
    for upper, lower in (("soprano", "alto"), ("tenor", "bass")):
        for a, b in zip(voices[upper], voices[lower]):
            if a.start == b.start:
                assert a.pitch >= b.pitch
    # One stanza and the refrain: 16 measures of 9/8 at 60 dotted quarters a minute.
    assert abs(mid.length - 48) < 1


def test_midi_fermata_and_whole_song(tmp_path):
    song = load_song(EXAMPLES / "standing_on_the_promises.yaml")
    _, fermatas = build_voices(song)
    assert len(fermatas) == 1
    short = mido.MidiFile(write_midi(song, tmp_path / "a.mid")).length
    whole = mido.MidiFile(write_midi(song, tmp_path / "b.mid", whole=True)).length
    assert whole > 3 * short


def test_set_top_key_keeps_comments():
    pytest.importorskip("tkinter")
    from hymnslides.gui import set_top_key
    text = "# comment\ntitle: Old\nkey: D\n"
    text = set_top_key(text, "title", "Blessed Assurance")
    text = set_top_key(text, "number", "381")
    text = set_top_key(text, "ccli_song", "")
    assert text == '# comment\ntitle: "Blessed Assurance"\nnumber: 381\nkey: D\n'


def test_window_opens_and_previews():
    tk = pytest.importorskip("tkinter")
    if not os.environ.get("DISPLAY") and os.name != "nt":
        pytest.skip("no display")
    from hymnslides.gui import App
    root = tk.Tk()
    try:
        app = App(root)
        app.set_text((EXAMPLES / "blessed_assurance.yaml").read_text(encoding="utf-8"))
        assert app.vars["title"].get() == "Blessed Assurance"
        assert app.vars["number"].get() == "381"
        assert "A1" in app.line.cget("values")
        app.vars["number"].set("400")
        app._fields_to_text()
        assert "number: 400" in app.get_text()
    finally:
        root.destroy()

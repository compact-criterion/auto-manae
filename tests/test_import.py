import sys
import zipfile
from pathlib import Path

import pytest
import yaml

from hymnslides.deck import build_deck
from hymnslides.importer import import_file
from hymnslides.musicxml import import_musicxml
from hymnslides.songformat import SongError, load_song, song_from_dict

sys.path.insert(0, str(Path(__file__).parent))
from musicxml_export import export  # noqa: E402

EXAMPLES = Path(__file__).parent.parent / "examples"


def _music(song, name):
    ph = song.phrases[name]
    return [[[(e.dur, e.fermata, [(p.step, p.alter, p.octave, p.tie) for p in e.pitches]) for e in layer]
             for layer in m.layers] for m in ph.treble + ph.bass]


def test_round_trip_blessed_assurance(tmp_path):
    song = load_song(EXAMPLES / "blessed_assurance.yaml")
    xml = tmp_path / "ba.musicxml"
    xml.write_text(export(song))
    result = import_musicxml(xml)
    new = song_from_dict(yaml.safe_load(result.yaml_text))
    assert [s.label for s in new.structure] == [s.label for s in song.structure]
    pairs = list(zip(["A1", "A2", "A3", "A4", "R1", "R2", "R3", "R4"],
                     ["S1", "S2", "S3", "S4", "R1", "R2", "R3", "R4"]))
    for old, imported in pairs:
        assert _music(song, old) == _music(new, imported), old  # pickups split as in the hymnal
    assert new.lyrics["stanza2"]["S2"] == song.lyrics["stanza2"]["A2"]
    assert new.lyrics["refrain"]["R4"] == song.lyrics["refrain"]["R4"]
    assert new.meta["reviewed"] is False


def test_round_trip_standing_layers_and_verses(tmp_path):
    song = load_song(EXAMPLES / "standing_on_the_promises.yaml")
    mxl = tmp_path / "sotp.mxl"  # compressed MusicXML, as MuseScore saves it
    with zipfile.ZipFile(mxl, "w") as z:
        z.writestr("META-INF/container.xml", '<container><rootfiles><rootfile full-path="score.xml"/>'
                                             "</rootfiles></container>")
        z.writestr("score.xml", export(song))
    new = song_from_dict(yaml.safe_load(import_musicxml(mxl).yaml_text))
    assert [s.label for s in new.structure] == [s.label for s in song.structure]
    for name in ("S1", "S2", "S3", "S4", "R1", "R2"):
        assert _music(song, name) == _music(new, name), name
    assert new.lyrics["refrain"]["R1.alto"] == song.lyrics["refrain"]["R1.alto"]
    assert new.lyrics["stanza4"]["S2"] == song.lyrics["stanza4"]["S2"]
    assert any(e.fermata for m in new.phrases["R3"].treble for layer in m.layers for e in layer)


def test_import_writes_review_and_build_waits_for_review(tmp_path):
    song = load_song(EXAMPLES / "blessed_assurance.yaml")
    xml = tmp_path / "ba.musicxml"
    xml.write_text(export(song))
    outcome = import_file(xml, log=lambda *_: None)
    assert outcome.problems == []
    assert outcome.review_path.exists() and outcome.midi_path.exists()
    html = outcome.review_path.read_text(encoding="utf-8")
    assert "line-S1.png" in html and "reviewed: true" in html
    imported = load_song(outcome.song_path)
    with pytest.raises(SongError, match="has not been checked"):
        build_deck(imported, tmp_path / "x.pptx", log=lambda *_: None)


def test_bad_file_is_explained(tmp_path):
    bad = tmp_path / "x.musicxml"
    bad.write_text("not xml")
    with pytest.raises(SongError, match="not a MusicXML file"):
        import_musicxml(bad)


def test_find_systems_on_a_hymnal_page(tmp_path):
    from PIL import Image, ImageDraw

    from hymnslides.omr import find_systems
    img = Image.new("L", (1000, 900), 255)
    d = ImageDraw.Draw(img)
    for top in (100, 260, 500, 660):  # two systems of treble + bass
        for k in range(5):
            d.line([(50, top + 12 * k), (950, top + 12 * k)], fill=0, width=2)
    png = tmp_path / "page.png"
    img.save(png)
    assert len(find_systems(png)) == 2

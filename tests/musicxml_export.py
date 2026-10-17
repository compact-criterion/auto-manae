"""Test helper: write a song file as MusicXML laid out the way MuseScore exports
an SATB hymn (one part, two staves, voices 1-2 and 5-6, verses as lyric numbers,
the end of a line and the next line's pickup sharing one measure)."""

from fractions import Fraction
from xml.sax.saxutils import escape

from hymnslides.songformat import Song, parse_lyrics

DIV = 16  # divisions per quarter note


def _voice(measure, upper):
    layer = measure.layers[0] if len(measure.layers) == 1 or upper else measure.layers[1]
    out = []
    for ev in layer:
        if ev.is_rest:
            out.append((ev, None))
        else:
            ps = sorted(ev.pitches, key=lambda p: (p.octave, "CDEFGAB".index(p.step), p.alter), reverse=True)
            out.append((ev, ps[0] if upper else ps[-1]))
    return out


def _lyric_queue(song: Song, phrases, lyrics_by_verse):
    """For each verse: syllables for the top voice's sung notes, in order."""
    queues = {}
    for verse, words in lyrics_by_verse.items():
        syls = []
        for name in phrases:
            text = words.get(name)
            syls.extend(parse_lyrics(text) if text else [])
        queues[verse] = iter(syls)
    return queues


def export(song: Song) -> str:
    stanzas = [s for s in song.structure if s.label.startswith("Stanza")]
    refrain = next((s for s in song.structure if s.label.startswith("Refrain")), None)
    blocks = [(stanzas[0].phrases, {i + 1: song.lyrics[s.lyrics] for i, s in enumerate(stanzas)})]
    if refrain:
        blocks.append((refrain.phrases, {1: song.lyrics[refrain.lyrics]}))

    # Measures as (treble, bass, line_start, alto_words) chunks, then merge partials.
    chunks = []
    for phrases, verses in blocks:
        queues = _lyric_queue(song, phrases, verses)
        alto_q = iter([s for n in phrases for s in parse_lyrics(verses[1].get(f"{n}.alto") or "")])
        for name in phrases:
            ph = song.phrases[name]
            has_alto = bool(verses[1].get(f"{name}.alto"))
            for mi, (t, b) in enumerate(zip(ph.treble, ph.bass)):
                chunks.append({"t": t, "b": b, "start": mi == 0, "q": queues,
                               "alto": alto_q if has_alto else None})
    measures = []
    for c in chunks:
        if (measures and c["start"] and measures[-1]["len"] < song.measure_length
                and measures[-1]["len"] + c["t"].length == song.measure_length and len(measures) > 1):
            measures[-1]["parts"].append(c)
            measures[-1]["len"] += c["t"].length
            measures[-1]["break_after"] = True
        else:
            measures.append({"parts": [c], "len": c["t"].length,
                             "new_system": c["start"] and bool(measures) and not measures[-1].get("break_after"),
                             "break_after": False})
            if len(measures) > 1 and measures[-2].get("break_after"):
                measures[-1]["new_system"] = True

    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<score-partwise version="4.0">',
           f"<work><work-title>{escape(song.title)}</work-title></work>",
           f'<identification><creator type="composer">{escape(str(song.meta.get("music", "")))}</creator>'
           f'<creator type="lyricist">{escape(str(song.meta.get("words", "")))}</creator></identification>',
           '<part-list><score-part id="P1"><part-name>Choir</part-name></score-part></part-list>',
           '<part id="P1">']
    tied = {}
    for n, m in enumerate(measures):
        out.append(f'<measure number="{n + 1}"' + (' implicit="yes"' if n == 0 and m["len"] < song.measure_length else "") + ">")
        if m["new_system"]:
            out.append('<print new-system="yes"/>')
        if n == 0:
            out.append(f"<attributes><divisions>{DIV}</divisions><key><fifths>{song.fifths}</fifths></key>"
                       f"<time><beats>{song.time[0]}</beats><beat-type>{song.time[1]}</beat-type></time>"
                       "<staves>2</staves><clef number=\"1\"><sign>G</sign><line>2</line></clef>"
                       "<clef number=\"2\"><sign>F</sign><line>4</line></clef></attributes>")
        total = int(m["len"] * 4 * DIV)
        first = True
        for staff, key, voices in ((1, "t", ("1", "2")), (2, "b", ("5", "6"))):
            for vi, voice in enumerate(voices):
                if not first:
                    out.append(f"<backup><duration>{total}</duration></backup>")
                first = False
                for c in m["parts"]:
                    measure = c[key]
                    for ev, p in _voice(measure, vi == 0):
                        d = int(ev.dur * 4 * DIV)
                        if p is None:
                            out.append(f"<note><rest/><duration>{d}</duration><voice>{voice}</voice><staff>{staff}</staff></note>")
                            tied[(staff, voice)] = False
                            continue
                        alter = f"<alter>{p.alter}</alter>" if p.alter else ""
                        ties = ""
                        cont = tied.get((staff, voice), False)
                        if cont:
                            ties += '<tie type="stop"/>'
                        if p.tie:
                            ties += '<tie type="start"/>'
                        lyr = ""
                        if staff == 1 and not cont:
                            if vi == 0:
                                for verse, q in c["q"].items():
                                    syl = next(q, None)
                                    if syl and syl.text:
                                        kind = {"i": "begin", "m": "middle", "t": "end", None: "single"}[syl.wordpos]
                                        lyr += (f'<lyric number="{verse}"><syllabic>{kind}</syllabic>'
                                                f"<text>{escape(syl.text)}</text></lyric>")
                            elif c["alto"] is not None and len(measure.layers) > 1:
                                syl = next(c["alto"], None)
                                if syl and syl.text:
                                    kind = {"i": "begin", "m": "middle", "t": "end", None: "single"}[syl.wordpos]
                                    lyr += (f'<lyric number="1"><syllabic>{kind}</syllabic>'
                                            f"<text>{escape(syl.text)}</text></lyric>")
                        ferm = "<notations><fermata/></notations>" if ev.fermata else ""
                        out.append(f"<note><pitch><step>{p.step}</step>{alter}<octave>{p.octave}</octave></pitch>"
                                   f"<duration>{d}</duration>{ties}<voice>{voice}</voice><staff>{staff}</staff>{ferm}{lyr}</note>")
                        tied[(staff, voice)] = p.tie
        out.append("</measure>")
    out.append("</part></score-partwise>")
    return "\n".join(out)

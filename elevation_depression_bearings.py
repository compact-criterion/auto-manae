"""
Angles of Elevation and Depression, and Bearings: a narrated Manim explainer.

Covers angles of elevation and depression (with three worked examples),
three-figure and compass bearings, back bearings, and two bearing problems.

Narration uses Piper (offline neural text-to-speech). Setup:

    pip install manim piper-tts
    mkdir -p voices
    curl -L https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-lessac-medium.tar.gz \
        | tar xz -C voices

Render (from the repo root):

    manim -pqh elevation_depression_bearings.py ElevationDepressionBearings   # 1080p
    manim -pql elevation_depression_bearings.py ElevationDepressionBearings   # preview

Set PIPER_VOICE=/path/to/model.onnx to use a different voice. If the voice
model or piper is missing, the video still renders, silently, with timing
estimated from the length of the narration. Subtitles are written next to the
video as an .srt file.
"""

import hashlib
import os
import subprocess
import sys
import wave
from contextlib import contextmanager
from pathlib import Path

import numpy as np
from manim import *

VOICE_MODEL = Path(os.environ.get("PIPER_VOICE", "voices/en-us-lessac-medium.onnx"))
PAUSE_AFTER_LINE = 0.4  # seconds of breathing room after each narration line

ANGLE = YELLOW
SIGHT = ORANGE
HORIZ = GRAY_B
NORTH = BLUE
RESULT = GREEN
NOTE = GRAY_B
GROUND = GREEN_E


def synthesize(text):
    """Return (wav_path or None, duration_seconds) for a narration line."""
    out_dir = Path(config.media_dir) / "voiceovers"
    out_dir.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha1(f"{VOICE_MODEL.name}|{text}".encode()).hexdigest()[:16]
    wav_path = out_dir / f"{key}.wav"

    if not wav_path.exists():
        if not VOICE_MODEL.exists():
            logger.warning(f"Voice model {VOICE_MODEL} not found; rendering without audio.")
            return None, len(text.split()) / 2.6
        try:
            subprocess.run(
                [sys.executable, "-m", "piper", "-m", str(VOICE_MODEL), "-f", str(wav_path)],
                input=text.encode(),
                check=True,
                capture_output=True,
            )
        except (subprocess.CalledProcessError, FileNotFoundError) as err:
            logger.warning(f"piper failed ({err}); rendering without audio.")
            return None, len(text.split()) / 2.6

    with wave.open(str(wav_path)) as w:
        return wav_path, w.getnframes() / w.getframerate()


class VoiceoverScene(Scene):
    @contextmanager
    def voiceover(self, text):
        """Play narration while the animations inside the block run.

        Yields the clip length so animations can be paced to it. If the
        animations finish early, waits out the rest of the narration.
        """
        path, duration = synthesize(text)
        start = self.renderer.time
        if path is not None:
            self.add_sound(str(path))
        self.add_subcaption(text, duration=duration)
        yield duration
        remaining = duration + PAUSE_AFTER_LINE - (self.renderer.time - start)
        if remaining > 0:
            self.wait(remaining)


def bearing_vector(degrees):
    """Unit vector for a bearing measured clockwise from north."""
    b = np.radians(degrees)
    return np.array([np.sin(b), np.cos(b), 0])


def person(feet, height=0.9, color=WHITE):
    """A simple stick figure standing at `feet`; its eye is near the top."""
    head_r = height * 0.13
    neck = feet + UP * height * 0.72
    head = Circle(radius=head_r, color=color, stroke_width=3).move_to(neck + UP * head_r)
    body = Line(neck, feet + UP * height * 0.35, color=color, stroke_width=3)
    hip = body.get_end()
    legs = VGroup(
        Line(hip, feet + LEFT * height * 0.15, color=color, stroke_width=3),
        Line(hip, feet + RIGHT * height * 0.15, color=color, stroke_width=3),
    )
    arms = Line(
        neck + DOWN * height * 0.12 + LEFT * height * 0.18,
        neck + DOWN * height * 0.12 + RIGHT * height * 0.18,
        color=color,
        stroke_width=3,
    )
    return VGroup(head, body, legs, arms)


def boat(center, width=0.8, color=WHITE):
    hull = Polygon(
        center + LEFT * width / 2,
        center + RIGHT * width / 2,
        center + RIGHT * width * 0.32 + DOWN * width * 0.22,
        center + LEFT * width * 0.32 + DOWN * width * 0.22,
        color=color,
        stroke_width=3,
    )
    mast = Line(center, center + UP * width * 0.6, color=color, stroke_width=3)
    sail = Polygon(
        center + UP * width * 0.58 + RIGHT * 0.03,
        center + UP * width * 0.08 + RIGHT * 0.03,
        center + UP * width * 0.08 + RIGHT * width * 0.35,
        color=color,
        stroke_width=2,
        fill_opacity=0.3,
    )
    return VGroup(hull, mast, sail)


class ElevationDepressionBearings(VoiceoverScene):
    def construct(self):
        self.intro()
        self.angle_of_elevation()
        self.angle_of_depression()
        self.elevation_example()
        self.depression_example()
        self.kite_example()
        self.bearings_intro()
        self.back_bearings()
        self.bearing_components()
        self.two_leg_journey()
        self.summary()

    # ------------------------------------------------------------------ helpers
    def clear_scene(self, run_time=0.6):
        if self.mobjects:
            self.play(FadeOut(Group(*self.mobjects)), run_time=run_time)

    def header(self, text):
        h = Text(text, font_size=40).to_edge(UP)
        self.play(Write(h), run_time=0.8)
        return h

    @staticmethod
    def work(*lines, font_size=44, buff=0.35):
        return VGroup(*[MathTex(l, font_size=font_size) for l in lines]).arrange(
            DOWN, buff=buff, aligned_edge=LEFT
        )

    @staticmethod
    def angle_label(angle_mob, center, tex, radius_scale=1.6, font_size=36, color=ANGLE):
        """Place a label just outside the middle of an Angle arc whose vertex is `center`."""
        arc_mid = angle_mob.point_from_proportion(0.5)
        return MathTex(tex, font_size=font_size, color=color).move_to(
            center + (arc_mid - center) * radius_scale
        )

    # ---------------------------------------------------------------- 1. intro
    def intro(self):
        title = Text("Angles of Elevation & Depression", font_size=54, weight=BOLD)
        sub = Text("and Bearings", font_size=44, weight=BOLD).next_to(title, DOWN)
        with self.voiceover(
            "Welcome! In this video we'll use trigonometry to measure things we can't "
            "reach directly: the height of a building, the distance to a ship, and the "
            "direction of travel."
        ):
            self.play(Write(title), run_time=1.5)
            self.play(FadeIn(sub, shift=UP * 0.3))
        with self.voiceover(
            "We'll cover angles of elevation and depression first, and then bearings."
        ):
            self.wait(0.5)
        self.clear_scene()

    # ------------------------------------------------------ 2. elevation idea
    def angle_of_elevation(self):
        self.header("Angle of elevation")
        ground = Line(LEFT * 6.5, RIGHT * 6.5, color=GROUND).shift(DOWN * 2.6)
        feet = np.array([-4.5, -2.6, 0])
        observer = person(feet)
        eye = feet + UP * 0.8
        tower = Rectangle(width=1.2, height=4.6, color=WHITE).move_to(
            np.array([3, -2.6 + 2.3, 0])
        )
        top = tower.get_corner(UL) + RIGHT * 0.6
        flag = Triangle(color=RED, fill_opacity=1).scale(0.15).rotate(-PI / 2)
        flag.next_to(top, RIGHT, buff=0).shift(UP * 0.35)
        pole = Line(top, top + UP * 0.5, color=WHITE)

        horizontal = DashedLine(eye, np.array([top[0], eye[1], 0]), color=HORIZ)
        sight = Line(eye, top, color=SIGHT, stroke_width=5)
        angle = Angle(horizontal, sight, radius=1.0, color=ANGLE)
        theta = self.angle_label(angle, eye, r"\theta")

        with self.voiceover(
            "Imagine you're standing on level ground, looking up at the top of a tower."
        ):
            self.play(Create(ground), FadeIn(observer), Create(tower), Create(pole), FadeIn(flag))
        with self.voiceover("First, picture a horizontal line straight out from your eye."):
            self.play(Create(horizontal))
        with self.voiceover("Your line of sight goes up to the top of the tower."):
            self.play(Create(sight))
        with self.voiceover(
            "The angle between the horizontal and the line of sight is called the "
            "angle of elevation. You raise your eyes to see the object."
        ):
            self.play(Create(angle), Write(theta))
            self.play(Indicate(theta, scale_factor=1.6))

        h_lbl = Text("horizontal", font_size=26, color=HORIZ).next_to(horizontal, DOWN, buff=0.15)
        s_lbl = Text("line of sight", font_size=26, color=SIGHT)
        s_lbl.rotate(sight.get_angle()).next_to(sight.get_center(), UL, buff=0.15)
        defn = Text(
            "Elevation: measured UP from the horizontal",
            font_size=28,
            color=ANGLE,
        ).next_to(ground, DOWN, buff=0.25)
        with self.voiceover(
            "Remember: an angle of elevation is always measured upward from the "
            "horizontal, never from the vertical."
        ):
            self.play(FadeIn(h_lbl), FadeIn(s_lbl))
            self.play(FadeIn(defn))
        self.clear_scene()

    # ------------------------------------------------------ 3. depression idea
    def angle_of_depression(self):
        self.header("Angle of depression")
        sea_y = -2.6
        sea = Line(LEFT * 6.5, RIGHT * 6.5, color=BLUE_D).shift(UP * sea_y)
        cliff = Polygon(
            np.array([-6.5, sea_y, 0]),
            np.array([-3.6, sea_y, 0]),
            np.array([-3.6, 1.2, 0]),
            np.array([-6.5, 1.2, 0]),
            color=GROUND,
            fill_opacity=0.35,
        )
        feet = np.array([-4.2, 1.2, 0])
        observer = person(feet)
        eye = feet + UP * 0.8
        ship_pos = np.array([3.2, sea_y + 0.2, 0])
        ship = boat(ship_pos)

        horizontal = DashedLine(eye, np.array([ship_pos[0] + 0.5, eye[1], 0]), color=HORIZ)
        sight = Line(eye, ship_pos, color=SIGHT, stroke_width=5)
        dep = Angle(sight, horizontal, radius=1.3, color=ANGLE)
        dep_lbl = self.angle_label(dep, eye, r"\theta", radius_scale=1.4)

        with self.voiceover(
            "Now you're standing on top of a cliff, looking down at a boat on the sea."
        ):
            self.play(Create(sea), FadeIn(cliff), FadeIn(observer), FadeIn(ship))
        with self.voiceover(
            "Again, start with the horizontal line from your eye, and draw the line of "
            "sight down to the boat."
        ):
            self.play(Create(horizontal))
            self.play(Create(sight))
        with self.voiceover(
            "The angle between them is the angle of depression. You lower your eyes "
            "to see the object. It's still measured from the horizontal, but downward."
        ):
            self.play(Create(dep), Write(dep_lbl))
            self.play(Indicate(dep_lbl, scale_factor=1.6))

        boat_horiz = DashedLine(ship_pos, ship_pos + LEFT * 3.2, color=HORIZ)
        elev = Angle(Line(ship_pos, eye), boat_horiz, radius=1.3, color=ANGLE)
        elev_lbl = self.angle_label(elev, ship_pos, r"\theta", radius_scale=1.4)
        fact = Text(
            "angle of depression = angle of elevation",
            font_size=30,
            color=ANGLE,
        ).next_to(sea, DOWN, buff=0.25)
        with self.voiceover(
            "Here's a useful fact. Someone in the boat looking up at you sees an angle "
            "of elevation."
        ):
            self.play(Create(boat_horiz))
            self.play(Create(elev), Write(elev_lbl))
        with self.voiceover(
            "Because the two horizontal lines are parallel, these are alternate angles, "
            "so they're equal. The angle of depression from the top equals the angle of "
            "elevation from the bottom."
        ):
            self.play(FadeIn(fact))
            self.play(Indicate(dep_lbl, scale_factor=1.6), Indicate(elev_lbl, scale_factor=1.6))
        self.clear_scene()

    # --------------------------------------------- 4. elevation worked example
    def elevation_example(self):
        h = self.header("Example 1: height of a building")
        scale = 0.15
        base_y = -2.6
        obs = np.array([-5.6, base_y, 0])
        foot = obs + RIGHT * 30 * scale
        height = 30 * np.tan(np.radians(40)) * scale
        top = foot + UP * height

        ground = Line(obs + LEFT * 0.7, foot + RIGHT * 1.2, color=GROUND)
        building = Rectangle(width=1.2, height=height, color=WHITE).move_to(
            foot + RIGHT * 0.6 + UP * height / 2
        )
        tri_base = Line(obs, foot, color=HORIZ)
        tri_side = Line(foot, top, color=RESULT, stroke_width=5)
        sight = Line(obs, top, color=SIGHT, stroke_width=5)
        right = RightAngle(Line(foot, obs), Line(foot, top), length=0.25, quadrant=(1, 1))
        angle = Angle(tri_base, sight, radius=0.9, color=ANGLE)
        a_lbl = self.angle_label(angle, obs, r"40^\circ", radius_scale=1.6, font_size=30)
        base_lbl = MathTex(r"30\text{ m}", font_size=34).next_to(tri_base, DOWN, buff=0.2)
        h_lbl = MathTex("h", font_size=40, color=RESULT).next_to(tri_side, LEFT, buff=0.15)

        problem = Text(
            "You stand 30 m from a building. The angle of\n"
            "elevation to its top is 40°. How tall is it?",
            font_size=26,
            line_spacing=1.1,
        ).next_to(h, DOWN, buff=0.3)

        with self.voiceover(
            "Let's try an example. You stand thirty meters from a building. The angle "
            "of elevation to the top is forty degrees. How tall is the building?"
        ):
            self.play(FadeIn(problem))
            self.play(Create(ground), Create(building))
        with self.voiceover(
            "Sketch a right triangle. The ground distance of thirty meters is the side "
            "adjacent to the angle, and the height h is the side opposite."
        ):
            self.play(Create(tri_base), Write(base_lbl))
            self.play(Create(sight), Create(angle), Write(a_lbl))
            self.play(Create(tri_side), Create(right), Write(h_lbl))

        steps = self.work(
            r"\tan 40^\circ = \frac{h}{30}",
            r"h = 30 \tan 40^\circ",
            r"h \approx 30 \times 0.8391",
            r"h \approx 25.2\text{ m}",
        )
        steps[-1].set_color(RESULT)
        steps.move_to(RIGHT * 1.6 + DOWN * 0.6, aligned_edge=LEFT)
        soh = Text("opposite & adjacent → TAN", font_size=24, color=ANGLE).next_to(
            steps, UP, buff=0.4, aligned_edge=LEFT
        )

        with self.voiceover(
            "Opposite and adjacent means we use tangent. Tangent of forty degrees "
            "equals h over thirty."
        ):
            self.play(FadeIn(soh))
            self.play(Write(steps[0]))
        with self.voiceover(
            "Multiply both sides by thirty. h equals thirty times tangent forty, which is "
            "about thirty times zero point eight three nine one."
        ):
            self.play(Write(steps[1]))
            self.play(Write(steps[2]))
        with self.voiceover("So the building is about twenty five point two meters tall."):
            self.play(Write(steps[3]))
            self.play(Circumscribe(steps[3], color=RESULT))
        self.clear_scene()

    # -------------------------------------------- 5. depression worked example
    def depression_example(self):
        h = self.header("Example 2: distance to a boat")
        scale = 0.03
        sea_y = -2.6
        lh_x = -5.4
        top = np.array([lh_x, sea_y + 80 * scale, 0])
        dist = 80 / np.tan(np.radians(25))
        ship_pos = np.array([lh_x + dist * scale, sea_y, 0])
        base = np.array([lh_x, sea_y, 0])

        sea = Line(LEFT * 6.8, RIGHT * 0.8, color=BLUE_D).shift(UP * sea_y)
        lighthouse = Polygon(
            base + LEFT * 0.35, base + RIGHT * 0.35, top + RIGHT * 0.2, top + LEFT * 0.2,
            color=WHITE,
        )
        lamp = Square(0.3, color=YELLOW, fill_opacity=0.6).next_to(top, UP, buff=0)
        ship = boat(ship_pos + UP * 0.2, width=0.6)
        horizontal = DashedLine(top, np.array([ship_pos[0] + 0.3, top[1], 0]), color=HORIZ)
        sight = Line(top, ship_pos, color=SIGHT, stroke_width=5)
        dep = Angle(sight, horizontal, radius=1.2, color=ANGLE)
        dep_lbl = self.angle_label(dep, top, r"25^\circ", radius_scale=1.5, font_size=30)

        height_line = Line(base, top, color=HORIZ)
        h_lbl = MathTex(r"80\text{ m}", font_size=32).next_to(lighthouse, LEFT, buff=0.15)
        d_line = Line(base, ship_pos, color=RESULT, stroke_width=5)
        d_lbl = MathTex("d", font_size=40, color=RESULT).next_to(d_line, DOWN, buff=0.15)
        elev = Angle(Line(ship_pos, top), Line(ship_pos, base), radius=0.9, color=ANGLE)
        elev_lbl = self.angle_label(elev, ship_pos, r"25^\circ", radius_scale=1.7, font_size=28)

        problem = Text(
            "From the top of an 80 m lighthouse, the angle of\n"
            "depression to a boat is 25°. How far away is the boat?",
            font_size=26,
            line_spacing=1.1,
        ).next_to(h, DOWN, buff=0.3)

        with self.voiceover(
            "From the top of an eighty meter lighthouse, the angle of depression to a "
            "boat is twenty five degrees. How far is the boat from the lighthouse?"
        ):
            self.play(FadeIn(problem))
            self.play(Create(sea), Create(lighthouse), FadeIn(lamp), FadeIn(ship))
            self.play(Create(horizontal), Create(sight))
            self.play(Create(dep), Write(dep_lbl))
        with self.voiceover(
            "The angle of depression equals the angle of elevation from the boat, so "
            "the angle at the boat is also twenty five degrees."
        ):
            self.play(Create(elev), Write(elev_lbl))
        with self.voiceover(
            "From the boat's corner, the eighty meter height is opposite, and the "
            "distance d is adjacent."
        ):
            self.play(Create(height_line), Write(h_lbl))
            self.play(Create(d_line), Write(d_lbl))

        steps = self.work(
            r"\tan 25^\circ = \frac{80}{d}",
            r"d = \frac{80}{\tan 25^\circ}",
            r"d \approx \frac{80}{0.4663}",
            r"d \approx 171.6\text{ m}",
            buff=0.3,
        )
        steps[-1].set_color(RESULT)
        steps.to_edge(RIGHT, buff=0.7).shift(DOWN * 0.7)
        with self.voiceover("So tangent of twenty five degrees equals eighty over d."):
            self.play(Write(steps[0]))
        with self.voiceover(
            "This time d is in the denominator, so rearrange: d equals eighty divided by "
            "tangent twenty five degrees."
        ):
            self.play(Write(steps[1]))
        with self.voiceover(
            "That's eighty over zero point four six six three, or about one hundred "
            "seventy one point six meters."
        ):
            self.play(Write(steps[2]))
            self.play(Write(steps[3]))
            self.play(Circumscribe(steps[3], color=RESULT))
        self.clear_scene()

    # ----------------------------------------------- 6. finding an angle
    def kite_example(self):
        h = self.header("Example 3: finding the angle")
        scale = 0.075
        hand = np.array([-5.0, -2.4, 0])
        run = np.sqrt(50**2 - 35**2)
        kite_pos = hand + np.array([run * scale, 35 * scale, 0])
        foot = np.array([kite_pos[0], hand[1], 0])

        kite = Polygon(
            kite_pos + UP * 0.35, kite_pos + RIGHT * 0.22, kite_pos + DOWN * 0.45,
            kite_pos + LEFT * 0.22, color=RED, fill_opacity=0.7,
        )
        string = Line(hand, kite_pos, color=SIGHT, stroke_width=4)
        horizontal = DashedLine(hand, foot, color=HORIZ)
        vertical = DashedLine(foot, kite_pos, color=HORIZ)
        right = RightAngle(Line(foot, hand), Line(foot, kite_pos), length=0.25, quadrant=(1, 1))
        angle = Angle(horizontal, string, radius=0.9, color=ANGLE)
        theta = self.angle_label(angle, hand, r"\theta", radius_scale=1.5)
        s_lbl = MathTex(r"50\text{ m}", font_size=34, color=SIGHT).move_to(
            string.get_center() + UL * 0.4
        )
        v_lbl = MathTex(r"35\text{ m}", font_size=34).next_to(vertical, RIGHT, buff=0.15)

        problem = Text(
            "A kite is on a 50 m string, flying 35 m above\n"
            "your hand. Find the angle of elevation.",
            font_size=26,
            line_spacing=1.1,
        ).next_to(h, DOWN, buff=0.3)

        with self.voiceover(
            "Sometimes we need the angle itself. A kite is flying on a fifty meter "
            "string, thirty five meters above your hand. What is the angle of elevation "
            "of the kite?"
        ):
            self.play(FadeIn(problem))
            self.play(Create(string), FadeIn(kite))
            self.play(Create(horizontal), Create(vertical), Create(right))
            self.play(Create(angle), Write(theta), Write(s_lbl), Write(v_lbl))

        steps = self.work(
            r"\sin\theta = \frac{35}{50} = 0.7",
            r"\theta = \sin^{-1}(0.7)",
            r"\theta \approx 44.4^\circ",
        )
        steps[-1].set_color(RESULT)
        steps.to_edge(RIGHT, buff=0.9).shift(DOWN * 0.5)
        with self.voiceover(
            "The thirty five meters is opposite the angle, and the fifty meter string is "
            "the hypotenuse. Opposite over hypotenuse means sine."
        ):
            self.play(Indicate(v_lbl), Indicate(s_lbl))
            self.play(Write(steps[0]))
        with self.voiceover(
            "To undo sine, use the inverse sine button on your calculator. "
            "The angle of elevation is about forty four point four degrees."
        ):
            self.play(Write(steps[1]))
            self.play(Write(steps[2]))
            self.play(Circumscribe(steps[2], color=RESULT))
        self.clear_scene()

    # ------------------------------------------------------- 7. bearings intro
    def bearings_intro(self):
        self.header("Bearings")
        center = np.array([-3.3, -0.5, 0])
        r = 2.4
        ring = Circle(radius=r, color=GRAY).move_to(center)
        ticks = VGroup(
            *[
                Line(
                    center + bearing_vector(d) * (r - (0.2 if d % 90 else 0.35)),
                    center + bearing_vector(d) * r,
                    color=GRAY,
                )
                for d in range(0, 360, 30)
            ]
        )
        letters = VGroup(
            *[
                Text(t, font_size=30, color=NORTH if t == "N" else WHITE).move_to(
                    center + bearing_vector(d) * (r + 0.35)
                )
                for t, d in [("N", 0), ("E", 90), ("S", 180), ("W", 270)]
            ]
        )
        north = Arrow(center, center + UP * r, buff=0, color=NORTH, stroke_width=5)

        rules = VGroup(
            Text("1. Start facing North", font_size=28),
            Text("2. Turn clockwise", font_size=28),
            Text("3. Write three digits", font_size=28),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3)
        rules.to_edge(RIGHT, buff=0.8).shift(UP * 1.2)

        with self.voiceover(
            "A bearing describes a direction as an angle. Navigators, pilots, and hikers "
            "all use them."
        ):
            self.play(Create(ring), Create(ticks), FadeIn(letters))
        with self.voiceover(
            "There are three rules for a three figure bearing. One: always start "
            "from north."
        ):
            self.play(GrowArrow(north), FadeIn(rules[0]))
        with self.voiceover("Two: measure the angle clockwise.") :
            self.play(FadeIn(rules[1]))
        with self.voiceover(
            "And three: always write it with three digits, so forty five degrees becomes "
            "zero four five."
        ):
            self.play(FadeIn(rules[2]))

        b = ValueTracker(0.001)
        ray = always_redraw(
            lambda: Arrow(
                center,
                center + bearing_vector(b.get_value()) * r * 0.95,
                buff=0,
                color=SIGHT,
                stroke_width=5,
            )
        )
        arc = always_redraw(
            lambda: Arc(
                radius=0.7,
                start_angle=PI / 2,
                angle=-np.radians(b.get_value()),
                arc_center=center,
                color=ANGLE,
            )
        )
        readout = always_redraw(
            lambda: MathTex(
                rf"\text{{Bearing}} = {int(round(b.get_value())) % 360:03d}^\circ",
                font_size=48,
                color=ANGLE,
            ).next_to(rules, DOWN, buff=0.8, aligned_edge=LEFT)
        )
        self.add(arc, ray, readout)

        with self.voiceover(
            "Watch the bearing as the direction turns. North east is zero four five "
            "degrees."
        ):
            self.play(b.animate.set_value(45), run_time=2)
        with self.voiceover("Due east is zero nine zero degrees."):
            self.play(b.animate.set_value(90), run_time=1.5)
        with self.voiceover(
            "South is one eighty, and south west is two two five."
        ):
            self.play(b.animate.set_value(180), run_time=1.5)
            self.wait(0.5)
            self.play(b.animate.set_value(225), run_time=1.2)
        with self.voiceover(
            "West is two seven zero. And a direction just west of north, like here, is "
            "three three zero degrees."
        ):
            self.play(b.animate.set_value(270), run_time=1.2)
            self.wait(0.5)
            self.play(b.animate.set_value(330), run_time=1.5)

        compass_note = VGroup(
            Text("Compass bearings:", font_size=26, color=NOTE),
            MathTex(r"\text{N}\,30^\circ\,\text{W} = 330^\circ", font_size=40),
            MathTex(r"\text{S}\,40^\circ\,\text{E} = 140^\circ", font_size=40),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.2)
        compass_note.next_to(readout, DOWN, buff=0.6, aligned_edge=LEFT)
        with self.voiceover(
            "You may also see compass bearings, which start from north or south and turn "
            "toward east or west. North thirty degrees west is the same as three three "
            "zero. South forty degrees east means start at south and turn forty degrees "
            "toward east, which is one four zero."
        ):
            self.play(FadeIn(compass_note[0]), Write(compass_note[1]))
            self.wait(2.5)
            self.play(b.animate.set_value(140), run_time=2)
            self.play(Write(compass_note[2]))
        for m in (ray, arc, readout):
            m.clear_updaters()
        self.clear_scene()

    # -------------------------------------------------------- 8. back bearings
    def back_bearings(self):
        self.header("Back bearings")
        A = np.array([-4.5, -2.0, 0])
        B = A + bearing_vector(60) * 4.2
        nA = Arrow(A, A + UP * 2.0, buff=0, color=NORTH)
        nB = Arrow(B, B + UP * 2.0, buff=0, color=NORTH)
        nA_lbl = Text("N", font_size=26, color=NORTH).next_to(nA, UP, buff=0.1)
        nB_lbl = Text("N", font_size=26, color=NORTH).next_to(nB, UP, buff=0.1)
        dotA, dotB = Dot(A), Dot(B)
        lblA = MathTex("A").next_to(A, DL, buff=0.1)
        lblB = MathTex("B").next_to(B, RIGHT, buff=0.2)
        path = Line(A, B, color=SIGHT, stroke_width=5)

        arcA = Arc(radius=0.8, start_angle=PI / 2, angle=-np.radians(60), arc_center=A, color=ANGLE)
        arcA_lbl = MathTex(r"060^\circ", font_size=32, color=ANGLE).move_to(
            A + bearing_vector(30) * 1.3
        )
        arcB = Arc(radius=0.6, start_angle=PI / 2, angle=-np.radians(240), arc_center=B, color=RESULT)
        arcB_lbl = MathTex(r"240^\circ", font_size=32, color=RESULT).move_to(
            B + bearing_vector(150) * 1.0
        )

        with self.voiceover(
            "Suppose B is on a bearing of zero six zero degrees from A. What is the "
            "bearing of A from B?"
        ):
            self.play(FadeIn(dotA), Write(lblA), GrowArrow(nA), FadeIn(nA_lbl))
            self.play(Create(path), FadeIn(dotB), Write(lblB))
            self.play(Create(arcA), Write(arcA_lbl))
        with self.voiceover(
            "Draw a new north line at B, and turn clockwise from it until you face A."
        ):
            self.play(GrowArrow(nB), FadeIn(nB_lbl))
            self.play(Create(arcB), run_time=2)
            self.play(Write(arcB_lbl))

        rule = VGroup(
            Text("Back bearing:", font_size=30),
            MathTex(r"60^\circ + 180^\circ = 240^\circ", font_size=44, color=RESULT),
            Text("add 180° if the bearing is less than 180°,", font_size=24, color=NOTE),
            Text("otherwise subtract 180°", font_size=24, color=NOTE),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.25)
        rule.to_corner(DR, buff=0.6)
        with self.voiceover(
            "Facing the opposite way is a half turn, so the back bearing is the bearing "
            "plus one hundred eighty degrees. Sixty plus one eighty is two four zero."
        ):
            self.play(FadeIn(rule[0]), Write(rule[1]))
        with self.voiceover(
            "If the original bearing is already more than one eighty, subtract one "
            "eighty instead, so the answer stays between zero and three sixty."
        ):
            self.play(FadeIn(rule[2]), FadeIn(rule[3]))
        self.clear_scene()

    # ---------------------------------------------- 9. bearing components
    def bearing_components(self):
        h = self.header("Example 4: how far north and east?")
        scale = 0.085
        O = np.array([-4.8, -2.6, 0])
        P = O + bearing_vector(60) * 50 * scale
        east_pt = np.array([P[0], O[1], 0])

        north = Arrow(O, O + UP * 3.3, buff=0, color=NORTH)
        n_lbl = Text("N", font_size=26, color=NORTH).next_to(north, UP, buff=0.1)
        path = Arrow(O, P, buff=0, color=SIGHT, stroke_width=5)
        p_lbl = MathTex(r"50\text{ km}", font_size=32, color=SIGHT).move_to(
            (O + P) / 2 + UL * 0.4
        )
        arc = Arc(radius=0.9, start_angle=PI / 2, angle=-np.radians(60), arc_center=O, color=ANGLE)
        arc_lbl = MathTex(r"60^\circ", font_size=30, color=ANGLE).move_to(O + bearing_vector(30) * 1.3)

        east_leg = Line(O, east_pt, color=RESULT, stroke_width=5)
        north_leg = Line(east_pt, P, color=NORTH, stroke_width=5)
        right = RightAngle(Line(east_pt, O), Line(east_pt, P), length=0.22, quadrant=(1, 1))
        e_lbl = MathTex(r"\text{east}", font_size=30, color=RESULT).next_to(east_leg, DOWN, buff=0.15)
        nn_lbl = MathTex(r"\text{north}", font_size=30, color=NORTH).next_to(north_leg, RIGHT, buff=0.15)

        problem = Text(
            "A ship sails 50 km on a bearing of 060°.\nHow far east and how far north has it gone?",
            font_size=26,
            line_spacing=1.1,
        ).next_to(h, DOWN, buff=0.3)

        with self.voiceover(
            "Bearings combine with right triangles too. A ship sails fifty kilometers on "
            "a bearing of zero six zero. How far east, and how far north, has it travelled?"
        ):
            self.play(FadeIn(problem))
            self.play(GrowArrow(north), FadeIn(n_lbl))
            self.play(GrowArrow(path), Write(p_lbl))
            self.play(Create(arc), Write(arc_lbl))
        with self.voiceover(
            "Drop a vertical line from the ship to make a right triangle. The sixty "
            "degree angle is measured from north."
        ):
            self.play(Create(east_leg), Create(north_leg), Create(right))
            self.play(Write(e_lbl), Write(nn_lbl))

        steps = self.work(
            r"\text{east} = 50 \sin 60^\circ \approx 43.3\text{ km}",
            r"\text{north} = 50 \cos 60^\circ = 25\text{ km}",
            font_size=42,
            buff=0.5,
        )
        steps[0].set_color(RESULT)
        steps[1].set_color(NORTH)
        steps.move_to(RIGHT * 0.2 + DOWN * 0.4, aligned_edge=LEFT)
        tip = Text(
            "east → sin,  north → cos  (angle from north)",
            font_size=24,
            color=NOTE,
        ).to_edge(DOWN, buff=0.4).shift(RIGHT * 2.5)
        with self.voiceover(
            "The east distance is opposite the sixty degree angle, so it's fifty times "
            "sine sixty, about forty three point three kilometers."
        ):
            self.play(Write(steps[0]))
        with self.voiceover(
            "The north distance is adjacent, so it's fifty times cosine sixty, which is "
            "exactly twenty five kilometers."
        ):
            self.play(Write(steps[1]))
            self.play(FadeIn(tip))
        self.clear_scene()

    # ---------------------------------------------- 10. two-leg journey
    def two_leg_journey(self):
        h = self.header("Example 5: a two-leg journey")
        scale = 0.25
        A = np.array([-5.2, -2.6, 0])
        B = A + bearing_vector(40) * 12 * scale
        C = B + bearing_vector(130) * 9 * scale

        def north_at(p, length=1.5):
            arrow = Arrow(p, p + UP * length, buff=0, color=NORTH, stroke_width=4)
            return VGroup(arrow, Text("N", font_size=22, color=NORTH).next_to(arrow, UP, buff=0.05))

        nA, nB = north_at(A), north_at(B)
        AB = Line(A, B, color=SIGHT, stroke_width=5)
        BC = Line(B, C, color=SIGHT, stroke_width=5)
        dots = VGroup(Dot(A), Dot(B), Dot(C))
        labels = VGroup(
            MathTex("A").next_to(A, DL, buff=0.1),
            MathTex("B").next_to(B, UL, buff=0.1),
            MathTex("C").next_to(C, DR, buff=0.1),
        )
        ab_lbl = MathTex(r"12\text{ km}", font_size=30).move_to((A + B) / 2 + np.array([-0.766, 0.643, 0]) * 0.5)
        bc_lbl = MathTex(r"9\text{ km}", font_size=30).move_to((B + C) / 2 + UR * 0.35)
        arcA = Arc(radius=0.6, start_angle=PI / 2, angle=-np.radians(40), arc_center=A, color=ANGLE)
        arcA_lbl = MathTex(r"040^\circ", font_size=26, color=ANGLE).move_to(A + bearing_vector(20) * 1.0)
        arcB = Arc(radius=0.5, start_angle=PI / 2, angle=-np.radians(130), arc_center=B, color=ANGLE)
        arcB_lbl = MathTex(r"130^\circ", font_size=26, color=ANGLE).move_to(B + bearing_vector(65) * 0.9)

        problem = Text(
            "A boat sails 12 km on a bearing of 040° from A to B,\n"
            "then 9 km on a bearing of 130° from B to C.",
            font_size=26,
            line_spacing=1.1,
        ).next_to(h, DOWN, buff=0.3)

        with self.voiceover(
            "Finally, a two leg journey. A boat sails twelve kilometers from A to B on a "
            "bearing of zero four zero, then nine kilometers from B to C on a bearing of "
            "one three zero. How far is C from A, and on what bearing?"
        ):
            self.play(FadeIn(problem))
            self.play(FadeIn(dots[0]), Write(labels[0]), FadeIn(nA))
            self.play(Create(AB), Create(arcA), Write(arcA_lbl), Write(ab_lbl))
            self.play(FadeIn(dots[1]), Write(labels[1]), FadeIn(nB))
            self.play(Create(BC), Create(arcB), Write(arcB_lbl), Write(bc_lbl))
            self.play(FadeIn(dots[2]), Write(labels[2]))

        right = RightAngle(Line(B, A), Line(B, C), length=0.3, quadrant=(1, 1), color=RESULT)
        why = self.work(
            r"\text{Bearing of A from B} = 040^\circ + 180^\circ = 220^\circ",
            r"\angle ABC = 220^\circ - 130^\circ = 90^\circ",
            font_size=34,
            buff=0.25,
        )
        why.to_edge(RIGHT, buff=0.4).shift(UP * 0.9)
        with self.voiceover(
            "First, find the angle at B. The back bearing of A from B is two two zero "
            "degrees. The boat leaves B on one three zero, so the angle between the two "
            "legs is two twenty minus one thirty: ninety degrees. A right angle!"
        ):
            self.play(Write(why[0]))
            self.wait(1)
            self.play(Write(why[1]))
            self.play(Create(right))

        AC = DashedLine(A, C, color=RESULT, stroke_width=4)
        angA = Angle(Line(A, B), Line(A, C), radius=1.1, color=RESULT, other_angle=True)
        angA_lbl = MathTex(r"\alpha", font_size=30, color=RESULT).move_to(
            A + bearing_vector(58) * 1.45
        )
        calc = self.work(
            r"AC = \sqrt{12^2 + 9^2} = \sqrt{225} = 15\text{ km}",
            r"\tan\alpha = \tfrac{9}{12} \;\Rightarrow\; \alpha \approx 36.9^\circ",
            r"\text{Bearing} \approx 040^\circ + 36.9^\circ = 076.9^\circ",
            font_size=34,
            buff=0.3,
        )
        calc.next_to(why, DOWN, buff=0.5, aligned_edge=LEFT)
        calc[0].set_color(RESULT)
        calc[2].set_color(RESULT)
        with self.voiceover(
            "With a right angle, Pythagoras gives the distance. A C is the square root "
            "of twelve squared plus nine squared, which is the square root of two hundred "
            "twenty five: fifteen kilometers."
        ):
            self.play(Create(AC))
            self.play(Write(calc[0]))
        with self.voiceover(
            "For the direction, find angle alpha at A. Tangent alpha is nine over twelve, "
            "so alpha is about thirty six point nine degrees."
        ):
            self.play(Create(angA), Write(angA_lbl))
            self.play(Write(calc[1]))
        with self.voiceover(
            "Add this to the first bearing. The bearing of C from A is about zero seven "
            "six point nine degrees."
        ):
            self.play(Write(calc[2]))
            self.play(Circumscribe(calc[2], color=RESULT))
        self.clear_scene()

    # --------------------------------------------------------------- 11. recap
    def summary(self):
        self.header("Recap")
        points = VGroup(
            Text("Elevation: look UP from the horizontal", font_size=30),
            Text("Depression: look DOWN from the horizontal", font_size=30),
            Text("Depression from the top = elevation from the bottom", font_size=30),
            Text("Bearings: from North, clockwise, three digits", font_size=30),
            Text("Back bearing: add or subtract 180°", font_size=30),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.45).shift(DOWN * 0.3)
        lines = [
            "To recap. An angle of elevation is measured up from the horizontal.",
            "An angle of depression is measured down from the horizontal.",
            "The angle of depression from the top equals the angle of elevation from the bottom.",
            "Bearings are measured from north, clockwise, and written with three digits.",
            "And a back bearing is found by adding or subtracting one hundred eighty degrees. "
            "In every problem, sketch the right triangle first, then choose sine, cosine, or tangent.",
        ]
        for p, line in zip(points, lines):
            with self.voiceover(line):
                self.play(FadeIn(p, shift=UP * 0.2))
        self.clear_scene()

        outro = Text("Thanks for watching!", font_size=48)
        with self.voiceover("Thanks for watching!"):
            self.play(Write(outro))
        self.play(FadeOut(outro))

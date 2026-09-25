"""
Basic Trigonometry — a Manim Community video.

Render (from the repo root):
    manim -pqh basic_trigonometry.py BasicTrigonometry     # 1080p
    manim -pql basic_trigonometry.py BasicTrigonometry     # quick 480p preview

Requires Manim Community (v0.18+) and a LaTeX installation.
"""

from manim import *
import numpy as np

OPP_COLOR = BLUE
ADJ_COLOR = GREEN
HYP_COLOR = RED
ANGLE_COLOR = YELLOW


class BasicTrigonometry(Scene):
    def construct(self):
        self.intro()
        self.right_triangle()
        self.soh_cah_toa()
        self.worked_example()
        self.unit_circle()
        self.pythagorean_identity()
        self.summary()

    # ------------------------------------------------------------------ helpers
    def clear_scene(self, run_time=0.8):
        if self.mobjects:
            self.play(FadeOut(Group(*self.mobjects)), run_time=run_time)

    @staticmethod
    def build_triangle(a, b, c, theta_label=r"\theta"):
        """Right triangle with right angle at b, angle theta at a."""
        tri = Polygon(a, b, c, color=WHITE, stroke_width=4)
        right_angle = RightAngle(
            Line(b, a), Line(b, c), length=0.3, quadrant=(1, 1), color=WHITE
        )
        theta_arc = Angle(Line(a, b), Line(a, c), radius=0.7, color=ANGLE_COLOR)
        theta = MathTex(theta_label, color=ANGLE_COLOR).move_to(
            Angle(Line(a, b), Line(a, c), radius=1.05).point_from_proportion(0.5)
        )
        return tri, right_angle, theta_arc, theta

    # ------------------------------------------------------------------ 1. intro
    def intro(self):
        title = Text("Basic Trigonometry", font_size=64, weight=BOLD)
        subtitle = Text(
            "Triangles, ratios, and the unit circle", font_size=32, color=GRAY_B
        ).next_to(title, DOWN)
        self.play(Write(title))
        self.play(FadeIn(subtitle, shift=UP * 0.3))
        self.wait(1.5)

        question = Text(
            "How are the angles of a triangle\nrelated to the lengths of its sides?",
            font_size=36,
            line_spacing=1.2,
        )
        self.play(FadeOut(VGroup(title, subtitle), shift=UP), FadeIn(question))
        self.wait(2)
        self.play(FadeOut(question))

    # ------------------------------------------------------------ 2. triangle
    def right_triangle(self):
        a = np.array([-3.5, -2, 0])  # angle theta
        b = np.array([2.5, -2, 0])  # right angle
        c = np.array([2.5, 1.5, 0])
        tri, right_angle, theta_arc, theta = self.build_triangle(a, b, c)

        header = Text("The right triangle", font_size=40).to_edge(UP)
        self.play(Write(header))
        self.play(Create(tri), run_time=1.5)
        self.play(Create(right_angle))
        self.play(Create(theta_arc), Write(theta))
        self.wait(0.5)

        hyp = Line(a, c, color=HYP_COLOR, stroke_width=7)
        opp = Line(b, c, color=OPP_COLOR, stroke_width=7)
        adj = Line(a, b, color=ADJ_COLOR, stroke_width=7)

        hyp_lbl = Text("hypotenuse", font_size=30, color=HYP_COLOR)
        hyp_lbl.rotate(hyp.get_angle()).move_to(hyp.get_center() + UL * 0.45)
        opp_lbl = Text("opposite", font_size=30, color=OPP_COLOR).next_to(opp, RIGHT)
        adj_lbl = Text("adjacent", font_size=30, color=ADJ_COLOR).next_to(adj, DOWN)

        self.play(Create(hyp), Write(hyp_lbl))
        note = Text(
            "longest side, across from the right angle", font_size=24, color=GRAY_B
        ).next_to(header, DOWN)
        self.play(FadeIn(note))
        self.wait(1)

        self.play(
            Create(opp),
            Write(opp_lbl),
            Transform(
                note,
                Text("across from θ", font_size=24, color=GRAY_B).next_to(header, DOWN),
            ),
        )
        self.wait(1)
        self.play(
            Create(adj),
            Write(adj_lbl),
            Transform(
                note,
                Text("next to θ (not the hypotenuse)", font_size=24, color=GRAY_B).next_to(
                    header, DOWN
                ),
            ),
        )
        self.wait(2)
        self.clear_scene()

    # ---------------------------------------------------------- 3. SOH CAH TOA
    def soh_cah_toa(self):
        header = Text("Three trigonometric ratios", font_size=40).to_edge(UP)
        self.play(Write(header))

        sin_eq = MathTex(
            r"\sin\theta", "=", r"{\text{opposite}", r"\over", r"\text{hypotenuse}}"
        )
        cos_eq = MathTex(
            r"\cos\theta", "=", r"{\text{adjacent}", r"\over", r"\text{hypotenuse}}"
        )
        tan_eq = MathTex(
            r"\tan\theta", "=", r"{\text{opposite}", r"\over", r"\text{adjacent}}"
        )
        sin_eq[2].set_color(OPP_COLOR)
        sin_eq[4].set_color(HYP_COLOR)
        cos_eq[2].set_color(ADJ_COLOR)
        cos_eq[4].set_color(HYP_COLOR)
        tan_eq[2].set_color(OPP_COLOR)
        tan_eq[4].set_color(ADJ_COLOR)

        eqs = VGroup(sin_eq, cos_eq, tan_eq).arrange(DOWN, buff=0.6, aligned_edge=LEFT)
        eqs.shift(LEFT * 1.5)

        mnemonics = VGroup(
            Text("SOH", font_size=44, weight=BOLD),
            Text("CAH", font_size=44, weight=BOLD),
            Text("TOA", font_size=44, weight=BOLD),
        )
        for m, eq in zip(mnemonics, eqs):
            m.next_to(eqs, RIGHT, buff=1.2).match_y(eq)
            m.set_color(ANGLE_COLOR)

        for eq, m in zip(eqs, mnemonics):
            self.play(Write(eq), run_time=1.5)
            self.play(FadeIn(m, shift=LEFT * 0.3))
            self.wait(0.6)

        caption = Text(
            "Sine = Opposite / Hypotenuse,  Cosine = Adjacent / Hypotenuse,  "
            "Tangent = Opposite / Adjacent",
            font_size=20,
            color=GRAY_B,
        ).to_edge(DOWN)
        self.play(FadeIn(caption))
        self.wait(2)

        tan_ratio = MathTex(
            r"\tan\theta = {\sin\theta \over \cos\theta}", font_size=44
        ).next_to(caption, UP, buff=0.4)
        self.play(Write(tan_ratio))
        self.play(Circumscribe(tan_ratio, color=ANGLE_COLOR))
        self.wait(2)
        self.clear_scene()

    # ------------------------------------------------------ 4. worked example
    def worked_example(self):
        header = Text("Example: a 3-4-5 triangle", font_size=40).to_edge(UP)
        self.play(Write(header))

        unit = 0.9
        a = np.array([-5.5, -2.2, 0])
        b = a + RIGHT * 4 * unit
        c = b + UP * 3 * unit
        tri, right_angle, theta_arc, theta = self.build_triangle(a, b, c)

        adj_lbl = MathTex("4", color=ADJ_COLOR).next_to(Line(a, b), DOWN)
        opp_lbl = MathTex("3", color=OPP_COLOR).next_to(Line(b, c), RIGHT)
        hyp_lbl = MathTex("5", color=HYP_COLOR).move_to(
            Line(a, c).get_center() + UL * 0.4
        )

        self.play(Create(tri), Create(right_angle), Create(theta_arc), Write(theta))
        self.play(Write(adj_lbl), Write(opp_lbl))

        pyth = MathTex(r"3^2 + 4^2 = 9 + 16 = 25 = 5^2", font_size=36)
        pyth.next_to(header, DOWN, buff=0.4).to_edge(RIGHT, buff=0.8)
        self.play(Write(pyth))
        self.play(Write(hyp_lbl))
        self.wait(1)

        results = VGroup(
            MathTex(r"\sin\theta = {3 \over 5} = 0.6"),
            MathTex(r"\cos\theta = {4 \over 5} = 0.8"),
            MathTex(r"\tan\theta = {3 \over 4} = 0.75"),
        ).arrange(DOWN, buff=0.5, aligned_edge=LEFT)
        results.next_to(pyth, DOWN, buff=0.6).align_to(pyth, LEFT)

        highlights = [
            (opp_lbl, hyp_lbl),
            (adj_lbl, hyp_lbl),
            (opp_lbl, adj_lbl),
        ]
        for res, (top, bottom) in zip(results, highlights):
            self.play(
                Indicate(top, scale_factor=1.5),
                Indicate(bottom, scale_factor=1.5),
                Write(res),
                run_time=1.5,
            )
            self.wait(0.5)

        angle = MathTex(
            r"\theta = \sin^{-1}(0.6) \approx 36.87^\circ", color=ANGLE_COLOR
        ).next_to(results, DOWN, buff=0.6).align_to(results, LEFT)
        self.play(Write(angle))
        self.wait(2.5)
        self.clear_scene()

    # ---------------------------------------------------------- 5. unit circle
    def unit_circle(self):
        header = Text("The unit circle", font_size=40).to_edge(UP)
        self.play(Write(header))

        r = 2.0
        origin = LEFT * 3.5 + DOWN * 0.4
        axes = Axes(
            x_range=[-1.3, 1.3, 1],
            y_range=[-1.3, 1.3, 1],
            x_length=2.6 * r,
            y_length=2.6 * r,
            tips=False,
            axis_config={"color": GRAY},
        ).move_to(origin)
        circle = Circle(radius=r, color=WHITE).move_to(origin)
        one_lbl = MathTex("1", font_size=30).next_to(axes.c2p(1, 0), DR, buff=0.1)
        self.play(Create(axes), Create(circle), Write(one_lbl))

        explain = Text(
            "radius = 1, so the hypotenuse is 1:", font_size=26
        ).to_edge(RIGHT, buff=0.5).shift(UP * 2.2)
        explain_eq = MathTex(
            r"\cos\theta = x", r",\quad", r"\sin\theta = y", font_size=40
        ).next_to(explain, DOWN)
        explain_eq[0].set_color(ADJ_COLOR)
        explain_eq[2].set_color(OPP_COLOR)

        t = ValueTracker(PI / 6)

        def point():
            return axes.c2p(np.cos(t.get_value()), np.sin(t.get_value()))

        radius = always_redraw(
            lambda: Line(axes.c2p(0, 0), point(), color=HYP_COLOR, stroke_width=5)
        )
        x_leg = always_redraw(
            lambda: Line(
                axes.c2p(0, 0),
                axes.c2p(np.cos(t.get_value()), 0),
                color=ADJ_COLOR,
                stroke_width=6,
            )
        )
        y_leg = always_redraw(
            lambda: Line(
                axes.c2p(np.cos(t.get_value()), 0),
                point(),
                color=OPP_COLOR,
                stroke_width=6,
            )
        )
        dot = always_redraw(lambda: Dot(point(), color=ANGLE_COLOR))
        arc = always_redraw(
            lambda: Arc(
                radius=0.45,
                start_angle=0,
                angle=t.get_value() % TAU,
                arc_center=axes.c2p(0, 0),
                color=ANGLE_COLOR,
            )
        )

        self.play(Create(radius), Create(x_leg), Create(y_leg), FadeIn(dot), Create(arc))
        self.play(Write(explain), Write(explain_eq))

        readout = always_redraw(
            lambda: VGroup(
                MathTex(
                    rf"\theta = {np.degrees(t.get_value()) % 360:.0f}^\circ",
                    color=ANGLE_COLOR,
                ),
                MathTex(
                    rf"\cos\theta = {np.cos(t.get_value()):+.2f}", color=ADJ_COLOR
                ),
                MathTex(
                    rf"\sin\theta = {np.sin(t.get_value()):+.2f}", color=OPP_COLOR
                ),
            )
            .arrange(DOWN, aligned_edge=LEFT)
            .next_to(explain_eq, DOWN, buff=0.5)
            .align_to(explain, LEFT)
        )
        self.play(FadeIn(readout))
        self.wait(1)

        self.play(t.animate.set_value(PI / 3), run_time=2)
        self.wait(0.5)
        self.play(t.animate.set_value(3 * PI / 4), run_time=2)
        self.wait(0.5)

        note = Text(
            "Works for any angle — signs follow the quadrant",
            font_size=24,
            color=GRAY_B,
        ).to_edge(DOWN)
        self.play(FadeIn(note))
        self.play(t.animate.set_value(TAU + PI / 6), run_time=5, rate_func=linear)
        self.wait(1)

        # Trace the sine wave from the rotating point.
        self.play(FadeOut(readout), FadeOut(explain), FadeOut(explain_eq), FadeOut(note))
        t.set_value(0)

        wave_axes = Axes(
            x_range=[0, TAU, PI / 2],
            y_range=[-1.3, 1.3, 1],
            x_length=6,
            y_length=2.6 * r,
            tips=False,
            axis_config={"color": GRAY},
        )
        wave_axes.next_to(axes, RIGHT, buff=0.6).align_to(axes, DOWN)
        x_ticks = VGroup(
            *[
                MathTex(lbl, font_size=26).next_to(wave_axes.c2p(v, 0), DOWN, buff=0.15)
                for v, lbl in [
                    (PI / 2, r"90^\circ"),
                    (PI, r"180^\circ"),
                    (3 * PI / 2, r"270^\circ"),
                    (TAU, r"360^\circ"),
                ]
            ]
        )
        wave_title = MathTex(r"y = \sin\theta", color=OPP_COLOR).next_to(
            wave_axes, UP, buff=0.2
        )
        self.play(Create(wave_axes), Write(x_ticks), Write(wave_title))

        wave = always_redraw(
            lambda: wave_axes.plot(
                np.sin,
                x_range=[0, max(t.get_value(), 1e-3)],
                color=OPP_COLOR,
                stroke_width=5,
            )
        )
        connector = always_redraw(
            lambda: DashedLine(
                point(),
                wave_axes.c2p(t.get_value(), np.sin(t.get_value())),
                color=GRAY_B,
                stroke_width=2,
            )
        )
        self.add(wave, connector)
        self.play(t.animate.set_value(TAU), run_time=7, rate_func=linear)
        self.wait(1)

        cos_wave = wave_axes.plot(np.cos, x_range=[0, TAU], color=ADJ_COLOR)
        cos_title = MathTex(r"y = \cos\theta", color=ADJ_COLOR).next_to(
            wave_title, RIGHT, buff=0.6
        )
        self.play(Create(cos_wave), Write(cos_title), run_time=2)
        self.wait(2)

        for m in (radius, x_leg, y_leg, dot, arc, wave, connector):
            m.clear_updaters()
        self.clear_scene()

    # ------------------------------------------------ 6. Pythagorean identity
    def pythagorean_identity(self):
        header = Text("The Pythagorean identity", font_size=40).to_edge(UP)
        self.play(Write(header))

        step1 = MathTex(
            r"\text{opposite}^2", "+", r"\text{adjacent}^2", "=", r"\text{hypotenuse}^2"
        )
        step1[0].set_color(OPP_COLOR)
        step1[2].set_color(ADJ_COLOR)
        step1[4].set_color(HYP_COLOR)

        step2 = MathTex(
            r"\left({\text{opp} \over \text{hyp}}\right)^2",
            "+",
            r"\left({\text{adj} \over \text{hyp}}\right)^2",
            "=",
            "1",
        )
        step2[0].set_color(OPP_COLOR)
        step2[2].set_color(ADJ_COLOR)

        step3 = MathTex(r"\sin^2\theta", "+", r"\cos^2\theta", "=", "1", font_size=64)
        step3[0].set_color(OPP_COLOR)
        step3[2].set_color(ADJ_COLOR)

        hint = Text("divide both sides by hypotenuse²", font_size=26, color=GRAY_B)
        hint.next_to(step1, DOWN, buff=0.8)

        self.play(Write(step1))
        self.wait(1)
        self.play(FadeIn(hint))
        self.wait(1)
        self.play(FadeOut(hint), TransformMatchingTex(step1, step2))
        self.wait(1.5)
        self.play(TransformMatchingTex(step2, step3))
        box = SurroundingRectangle(step3, color=ANGLE_COLOR, buff=0.3)
        self.play(Create(box))

        check = MathTex(
            r"\text{3-4-5 check: } 0.6^2 + 0.8^2 = 0.36 + 0.64 = 1", font_size=34
        ).next_to(box, DOWN, buff=0.8)
        self.play(Write(check))
        self.wait(2.5)
        self.clear_scene()

    # ---------------------------------------------------------------- 7. recap
    def summary(self):
        header = Text("Recap", font_size=48).to_edge(UP)
        points = VGroup(
            MathTex(r"\sin\theta = \frac{\text{opp}}{\text{hyp}},\quad"
                    r"\cos\theta = \frac{\text{adj}}{\text{hyp}},\quad"
                    r"\tan\theta = \frac{\text{opp}}{\text{adj}}"),
            MathTex(r"\tan\theta = \frac{\sin\theta}{\cos\theta}"),
            MathTex(r"\text{On the unit circle: } (x, y) = (\cos\theta, \sin\theta)"),
            MathTex(r"\sin^2\theta + \cos^2\theta = 1"),
        ).arrange(DOWN, buff=0.55)
        self.play(Write(header))
        for p in points:
            self.play(FadeIn(p, shift=UP * 0.2))
            self.wait(0.8)
        self.wait(2)
        self.play(FadeOut(VGroup(header, points)))

        outro = Text("Thanks for watching!", font_size=48)
        self.play(Write(outro))
        self.wait(1.5)
        self.play(FadeOut(outro))

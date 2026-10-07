"""
Radical Expressions: an explainer video with voiceover, built with Manim Community.

Covers simplifying radicals, operations on radicals (add, subtract, multiply,
divide, rationalize), and solving radical equations, including extraneous
solutions.

Narration uses Piper (offline neural text-to-speech). Setup:

    pip install manim piper-tts
    mkdir -p voices
    curl -L https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-lessac-medium.tar.gz \
        | tar xz -C voices

Render (from the repo root):

    manim -pqh radical_expressions.py RadicalExpressions   # 1080p
    manim -pql radical_expressions.py RadicalExpressions   # quick preview

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

from manim import *

VOICE_MODEL = Path(os.environ.get("PIPER_VOICE", "voices/en-us-lessac-medium.onnx"))
PAUSE_AFTER_LINE = 0.4  # seconds of breathing room after each narration line

RADICAND = BLUE
SQUARE = YELLOW
RESULT = GREEN
WRONG = RED
NOTE = GRAY_B


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


class RadicalExpressions(VoiceoverScene):
    def construct(self):
        self.intro()
        self.parts_of_a_radical()
        self.simplifying()
        self.rationalizing()
        self.adding_and_subtracting()
        self.multiplying_and_dividing()
        self.solving_equations()
        self.extraneous_solutions()
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
    def steps(*lines, font_size=60, buff=0.4):
        return VGroup(*[MathTex(l, font_size=font_size) for l in lines]).arrange(
            DOWN, buff=buff
        )

    @staticmethod
    def note(text, mob, direction=RIGHT, font_size=26):
        return Text(text, font_size=font_size, color=NOTE).next_to(mob, direction, buff=0.6)

    # ---------------------------------------------------------------- 1. intro
    def intro(self):
        title = Text("Radical Expressions", font_size=64, weight=BOLD)
        topics = VGroup(
            Text("1. Simplifying radicals", font_size=32),
            Text("2. Operations on radicals", font_size=32),
            Text("3. Solving radical equations", font_size=32),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.35)
        topics.next_to(title, DOWN, buff=0.8)

        with self.voiceover(
            "Welcome! In this video, we'll learn about radical expressions."
        ):
            self.play(Write(title), run_time=1.5)
        with self.voiceover(
            "We'll start by simplifying radicals. Then we'll add, subtract, "
            "multiply, and divide them. And finally, we'll solve equations that "
            "contain radicals."
        ):
            self.play(title.animate.shift(UP * 1.2))
            topics.next_to(title, DOWN, buff=0.8)
            for t in topics:
                self.play(FadeIn(t, shift=RIGHT * 0.3), run_time=0.8)
                self.wait(0.9)
        self.clear_scene()

    # ------------------------------------------------------ 2. radical anatomy
    def parts_of_a_radical(self):
        self.header("Parts of a radical")
        rad = MathTex(r"\sqrt[n]{a}", font_size=160)
        index, sign, bar, radicand = rad[0]
        index.set_color(SQUARE)
        radicand.set_color(RADICAND)

        index_lbl = Text("index", font_size=32, color=SQUARE).next_to(rad, LEFT, buff=1.2).shift(UP * 0.6)
        index_arrow = Arrow(index_lbl.get_right(), index.get_left(), buff=0.15, color=SQUARE)
        sign_lbl = Text("radical sign", font_size=32).next_to(rad, DOWN, buff=0.8).shift(LEFT * 1.5)
        sign_arrow = Arrow(sign_lbl.get_top(), sign.get_bottom() + RIGHT * 0.1, buff=0.15)
        rad_lbl = Text("radicand", font_size=32, color=RADICAND).next_to(rad, RIGHT, buff=1.2)
        rad_arrow = Arrow(rad_lbl.get_left(), radicand.get_right(), buff=0.15, color=RADICAND)

        with self.voiceover("A radical has three parts."):
            self.play(Write(rad))
        with self.voiceover("The radical sign,"):
            self.play(FadeIn(sign_lbl), GrowArrow(sign_arrow), Indicate(sign))
        with self.voiceover("the index, which tells us which root to take,"):
            self.play(FadeIn(index_lbl), GrowArrow(index_arrow), Indicate(index))
        with self.voiceover("and the radicand, which is the expression under the radical sign."):
            self.play(FadeIn(rad_lbl), GrowArrow(rad_arrow), Indicate(radicand))

        examples = MathTex(
            r"\sqrt{9} = 3", r"\qquad", r"\sqrt[3]{8} = 2", r"\qquad", r"\sqrt[4]{81} = 3",
            font_size=56,
        ).to_edge(DOWN, buff=0.7)
        with self.voiceover(
            "When no index is written, it's a square root, with index two. "
            "So the square root of nine is three, the cube root of eight is two, "
            "and the fourth root of eighty one is three."
        ):
            self.play(Write(examples[0]))
            self.wait(1.5)
            self.play(Write(examples[2]))
            self.wait(0.8)
            self.play(Write(examples[4]))
        self.clear_scene()

    # ---------------------------------------------------------- 3. simplifying
    def simplifying(self):
        h = self.header("Simplifying radicals")

        product = MathTex(r"\sqrt{ab} = \sqrt{a}\cdot\sqrt{b}", font_size=56)
        quotient = MathTex(r"\sqrt{\frac{a}{b}} = \frac{\sqrt{a}}{\sqrt{b}}", font_size=56)
        rules = VGroup(product, quotient).arrange(RIGHT, buff=1.5).shift(UP * 1)
        cond = Text("(for a ≥ 0, b > 0)", font_size=24, color=NOTE).next_to(rules, DOWN)

        with self.voiceover(
            "The key tool is the product rule. The square root of a times b "
            "equals the square root of a times the square root of b."
        ):
            self.play(Write(product), run_time=2)
        with self.voiceover("A similar rule works for quotients."):
            self.play(Write(quotient), FadeIn(cond))

        squares = MathTex(
            r"1,\ 4,\ 9,\ 16,\ 25,\ 36,\ 49,\ 64,\ 81,\ 100,\ \dots", color=SQUARE
        ).next_to(cond, DOWN, buff=1)
        sq_lbl = Text("Perfect squares:", font_size=30).next_to(squares, UP)
        with self.voiceover(
            "To simplify a square root, look for the largest perfect square that "
            "divides the radicand. These are the perfect squares worth knowing by heart."
        ):
            self.play(FadeIn(sq_lbl), Write(squares), run_time=2.5)
        self.play(FadeOut(VGroup(rules, cond, squares, sq_lbl)))

        # Example: sqrt(72)
        ex = self.steps(
            r"\sqrt{72}",
            r"= \sqrt{36 \cdot 2}",
            r"= \sqrt{36} \cdot \sqrt{2}",
            r"= 6\sqrt{2}",
        )
        ex[1][0][3:5].set_color(SQUARE)
        ex[2][0][3:5].set_color(SQUARE)
        ex[3].set_color(RESULT)
        ex.next_to(h, DOWN, buff=0.6)

        with self.voiceover("Let's simplify the square root of seventy two."):
            self.play(Write(ex[0]))
        with self.voiceover(
            "The largest perfect square that divides seventy two is thirty six. "
            "So we write seventy two as thirty six times two."
        ):
            self.wait(1.5)
            self.play(TransformFromCopy(ex[0], ex[1]))
        with self.voiceover("Using the product rule, we split it into two roots."):
            self.play(TransformFromCopy(ex[1], ex[2]))
        with self.voiceover(
            "The square root of thirty six is six. So the square root of seventy two "
            "simplifies to six root two."
        ):
            self.wait(1)
            self.play(TransformFromCopy(ex[2], ex[3]))
            self.play(Circumscribe(ex[3], color=RESULT))

        rule = Text(
            "Simplified: no perfect-square factors left under the root",
            font_size=26,
            color=NOTE,
        ).to_edge(DOWN, buff=0.6)
        with self.voiceover(
            "A square root is fully simplified when the radicand has no perfect "
            "square factors other than one."
        ):
            self.play(FadeIn(rule))
        self.play(FadeOut(ex), FadeOut(rule))

        # Cube root and variables, side by side
        cube = self.steps(
            r"\sqrt[3]{54}",
            r"= \sqrt[3]{27 \cdot 2}",
            r"= 3\sqrt[3]{2}",
        )
        var = self.steps(
            r"\sqrt{18x^3}",
            r"= \sqrt{9x^2 \cdot 2x}",
            r"= 3x\sqrt{2x}",
        )
        cube[2].set_color(RESULT)
        var[2].set_color(RESULT)
        VGroup(cube, var).arrange(RIGHT, buff=2, aligned_edge=UP).next_to(h, DOWN, buff=0.8)
        cubes = MathTex(r"\text{cubes: } 8,\ 27,\ 64,\ 125", font_size=32, color=SQUARE)
        cubes.next_to(cube, DOWN, buff=0.6)
        assume = MathTex(r"(x \ge 0)", font_size=32, color=NOTE).next_to(var, DOWN, buff=0.6)

        with self.voiceover(
            "For cube roots, look for perfect cubes instead, like eight, twenty seven, "
            "and sixty four."
        ):
            self.play(Write(cube[0]), FadeIn(cubes))
        with self.voiceover(
            "Fifty four is twenty seven times two, and the cube root of twenty seven "
            "is three. So the cube root of fifty four is three times the cube root of two."
        ):
            self.play(TransformFromCopy(cube[0], cube[1]))
            self.wait(1.5)
            self.play(TransformFromCopy(cube[1], cube[2]))
        with self.voiceover(
            "Variables work the same way. Assuming x is not negative, eighteen x cubed "
            "is nine x squared, times two x."
        ):
            self.play(Write(var[0]), FadeIn(assume))
            self.play(TransformFromCopy(var[0], var[1]))
        with self.voiceover(
            "Nine x squared is a perfect square whose root is three x. "
            "So the answer is three x, root two x."
        ):
            self.wait(1)
            self.play(TransformFromCopy(var[1], var[2]))
        self.clear_scene()

    # -------------------------------------------------------- 4. rationalizing
    def rationalizing(self):
        h = self.header("Rationalizing the denominator")

        ex1 = self.steps(
            r"\frac{6}{\sqrt{3}}",
            r"= \frac{6}{\sqrt{3}} \cdot \frac{\sqrt{3}}{\sqrt{3}}",
            r"= \frac{6\sqrt{3}}{3}",
            r"= 2\sqrt{3}",
            buff=0.3,
        )
        ex1[3].set_color(RESULT)
        ex1.next_to(h, DOWN, buff=0.5)

        with self.voiceover(
            "A simplified expression also has no radicals in the denominator. "
            "Removing them is called rationalizing the denominator."
        ):
            self.play(Write(ex1[0]))
        with self.voiceover(
            "To clear root three from six over root three, multiply the top and "
            "bottom by root three. That's just multiplying by one."
        ):
            self.play(TransformFromCopy(ex1[0], ex1[1]))
        with self.voiceover(
            "Root three times root three is three. Then six root three over three "
            "reduces to two root three."
        ):
            self.play(TransformFromCopy(ex1[1], ex1[2]))
            self.wait(1)
            self.play(TransformFromCopy(ex1[2], ex1[3]))
        self.play(FadeOut(ex1))

        ex2 = self.steps(
            r"\frac{4}{3-\sqrt{5}}",
            r"= \frac{4}{3-\sqrt{5}} \cdot \frac{3+\sqrt{5}}{3+\sqrt{5}}",
            r"= \frac{4(3+\sqrt{5})}{9-5}",
            r"= 3+\sqrt{5}",
            buff=0.3,
        )
        ex2[3].set_color(RESULT)
        ex2.next_to(h, DOWN, buff=0.5)
        conj = Text("conjugate", font_size=28, color=SQUARE)
        conj.next_to(ex2[1], RIGHT, buff=0.4)
        dos = MathTex(r"(a-b)(a+b) = a^2 - b^2", font_size=36, color=NOTE).next_to(ex2[2], RIGHT, buff=0.6)

        with self.voiceover(
            "When the denominator is a sum or difference, like three minus root five, "
            "multiply by its conjugate: three plus root five."
        ):
            self.play(Write(ex2[0]))
            self.play(TransformFromCopy(ex2[0], ex2[1]), FadeIn(conj))
        with self.voiceover(
            "The bottom becomes a difference of squares: nine minus five, which is four."
        ):
            self.play(FadeIn(dos))
            self.play(TransformFromCopy(ex2[1], ex2[2]))
        with self.voiceover("The fours cancel, leaving three plus root five."):
            self.play(TransformFromCopy(ex2[2], ex2[3]))
            self.play(Circumscribe(ex2[3], color=RESULT))
        self.clear_scene()

    # -------------------------------------------------- 5. add and subtract
    def adding_and_subtracting(self):
        h = self.header("Adding and subtracting radicals")

        like = MathTex(r"3\sqrt{2} + 5\sqrt{2} = 8\sqrt{2}", font_size=56)
        analogy = MathTex(r"3x + 5x = 8x", font_size=48, color=NOTE)
        VGroup(like, analogy).arrange(DOWN, buff=0.4).next_to(h, DOWN, buff=0.7)

        with self.voiceover(
            "You can only add or subtract like radicals, meaning radicals with the "
            "same index and the same radicand."
        ):
            self.wait(1)
        with self.voiceover(
            "Treat them like like terms. Three root two plus five root two is eight "
            "root two, just as three x plus five x is eight x."
        ):
            self.play(Write(like), run_time=2)
            self.play(FadeIn(analogy, shift=UP * 0.2))

        ex = self.steps(
            r"\sqrt{12} + \sqrt{27}",
            r"= \sqrt{4\cdot 3} + \sqrt{9 \cdot 3}",
            r"= 2\sqrt{3} + 3\sqrt{3}",
            r"= 5\sqrt{3}",
            font_size=54,
            buff=0.3,
        )
        ex[3].set_color(RESULT)
        ex.next_to(analogy, DOWN, buff=0.6)

        with self.voiceover(
            "Sometimes radicals only look unlike. Root twelve and root twenty seven "
            "seem different, so simplify each one first."
        ):
            self.play(Write(ex[0]))
            self.play(TransformFromCopy(ex[0], ex[1]))
        with self.voiceover(
            "Root twelve is two root three, and root twenty seven is three root three. "
            "Now they're like radicals, and the sum is five root three."
        ):
            self.play(TransformFromCopy(ex[1], ex[2]))
            self.wait(1.5)
            self.play(TransformFromCopy(ex[2], ex[3]))
        self.play(FadeOut(VGroup(like, analogy, ex)))

        warn = MathTex(r"\sqrt{2} + \sqrt{3} \ne \sqrt{5}", font_size=64)
        warn.set_color(WRONG)
        cross_note = Text(
            "≈ 1.414 + 1.732 = 3.146,  but  √5 ≈ 2.236", font_size=28, color=NOTE
        ).next_to(warn, DOWN, buff=0.5)
        with self.voiceover(
            "Be careful. Root two plus root three is not root five. Check with decimals: "
            "the left side is about three point one four, but root five is only about "
            "two point two four. Unlike radicals cannot be combined."
        ):
            self.play(Write(warn))
            self.play(FadeIn(cross_note))
        self.clear_scene()

    # -------------------------------------------- 6. multiply and divide
    def multiplying_and_dividing(self):
        h = self.header("Multiplying and dividing radicals")

        mult = self.steps(
            r"\sqrt{6}\cdot\sqrt{15}",
            r"= \sqrt{90}",
            r"= \sqrt{9 \cdot 10}",
            r"= 3\sqrt{10}",
            font_size=54,
            buff=0.3,
        )
        div = self.steps(
            r"\frac{\sqrt{50}}{\sqrt{2}}",
            r"= \sqrt{\frac{50}{2}}",
            r"= \sqrt{25}",
            r"= 5",
            font_size=54,
            buff=0.3,
        )
        mult[3].set_color(RESULT)
        div[3].set_color(RESULT)
        VGroup(mult, div).arrange(RIGHT, buff=2.5, aligned_edge=UP).next_to(h, DOWN, buff=0.7)

        with self.voiceover(
            "To multiply, use the product rule in reverse. Root six times root fifteen "
            "is root ninety."
        ):
            self.play(Write(mult[0]))
            self.play(TransformFromCopy(mult[0], mult[1]))
        with self.voiceover(
            "Ninety is nine times ten, so the product simplifies to three root ten."
        ):
            self.play(TransformFromCopy(mult[1], mult[2]))
            self.play(TransformFromCopy(mult[2], mult[3]))
        with self.voiceover(
            "To divide, use the quotient rule. Root fifty over root two is the root of "
            "fifty over two. That's root twenty five, which is simply five."
        ):
            self.play(Write(div[0]))
            self.play(TransformFromCopy(div[0], div[1]))
            self.play(TransformFromCopy(div[1], div[2]))
            self.play(TransformFromCopy(div[2], div[3]))
        self.play(FadeOut(VGroup(mult, div)))

        expr = MathTex(r"(2+\sqrt{3})(4-\sqrt{3})", font_size=56).next_to(h, DOWN, buff=0.8)
        terms = MathTex(
            r"= ", r"8", r"- 2\sqrt{3}", r"+ 4\sqrt{3}", r"- 3", font_size=52
        ).next_to(expr, DOWN, buff=0.6)
        result = MathTex(r"= 5 + 2\sqrt{3}", font_size=56, color=RESULT).next_to(terms, DOWN, buff=0.6)
        foil = Text("distribute: First, Outer, Inner, Last", font_size=26, color=NOTE)
        foil.to_edge(DOWN, buff=0.6)

        with self.voiceover(
            "For binomials, distribute just like you would with polynomials."
        ):
            self.play(Write(expr), FadeIn(foil))
        with self.voiceover("Two times four is eight."):
            self.play(Write(terms[:2]))
        with self.voiceover("Two times negative root three is negative two root three."):
            self.play(Write(terms[2]))
        with self.voiceover("Root three times four is four root three."):
            self.play(Write(terms[3]))
        with self.voiceover(
            "And root three times negative root three is negative three."
        ):
            self.play(Write(terms[4]))
        with self.voiceover(
            "Combine like terms. Eight minus three is five, and negative two root three "
            "plus four root three is two root three. The answer is five plus two root three."
        ):
            self.play(Indicate(terms[1]), Indicate(terms[4]))
            self.play(Indicate(terms[2]), Indicate(terms[3]))
            self.play(Write(result))
        self.clear_scene()

    # ------------------------------------------------ 7. solving equations
    def solving_equations(self):
        h = self.header("Solving radical equations")

        steps = VGroup(
            Text("1. Isolate the radical", font_size=32),
            Text("2. Raise both sides to the power of the index", font_size=32),
            Text("3. Solve the resulting equation", font_size=32),
            Text("4. Check every answer in the original equation", font_size=32),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.4)
        steps[3].set_color(SQUARE)
        steps.next_to(h, DOWN, buff=0.8)

        with self.voiceover(
            "To solve an equation with a radical, follow four steps. "
            "First, isolate the radical on one side."
        ):
            self.wait(1.5)
            self.play(FadeIn(steps[0], shift=RIGHT * 0.3))
        with self.voiceover(
            "Second, raise both sides to the power that matches the index. "
            "For a square root, square both sides."
        ):
            self.play(FadeIn(steps[1], shift=RIGHT * 0.3))
        with self.voiceover("Third, solve the equation that results."):
            self.play(FadeIn(steps[2], shift=RIGHT * 0.3))
        with self.voiceover(
            "And fourth, always check your answers in the original equation."
        ):
            self.play(FadeIn(steps[3], shift=RIGHT * 0.3))
        self.play(FadeOut(steps))

        eq = self.steps(
            r"\sqrt{x+3} - 2 = 3",
            r"\sqrt{x+3} = 5",
            r"x + 3 = 25",
            r"x = 22",
            font_size=60,
        )
        eq[3].set_color(RESULT)
        eq.next_to(h, DOWN, buff=0.6).shift(LEFT * 2)
        notes = [
            self.note("add 2 to both sides", eq[1]),
            self.note("square both sides", eq[2]),
            self.note("subtract 3", eq[3]),
        ]
        for n in notes:
            n.align_to(notes[0], LEFT)
        check = MathTex(
            r"\text{Check: } \sqrt{22+3} - 2 = 5 - 2 = 3 \ \checkmark",
            font_size=40,
            color=RESULT,
        ).to_edge(DOWN, buff=0.7)

        with self.voiceover(
            "Let's solve: the square root of x plus three, minus two, equals three."
        ):
            self.play(Write(eq[0]))
        with self.voiceover(
            "Add two to both sides to isolate the radical. The square root of x plus "
            "three equals five."
        ):
            self.play(TransformFromCopy(eq[0], eq[1]), FadeIn(notes[0]))
        with self.voiceover(
            "Square both sides. x plus three equals twenty five, so x equals twenty two."
        ):
            self.play(TransformFromCopy(eq[1], eq[2]), FadeIn(notes[1]))
            self.play(TransformFromCopy(eq[2], eq[3]), FadeIn(notes[2]))
        with self.voiceover(
            "Check it: the square root of twenty five is five, and five minus two is "
            "three. It works."
        ):
            self.play(Write(check), run_time=2)
        self.play(FadeOut(VGroup(eq, check, *notes)))

        cube = self.steps(
            r"\sqrt[3]{2x-1} = 3",
            r"2x - 1 = 27",
            r"x = 14",
            font_size=60,
        )
        cube[2].set_color(RESULT)
        cube.next_to(h, DOWN, buff=0.8).shift(LEFT * 2)
        cube_note = self.note("cube both sides", cube[1])
        odd_note = Text(
            "Odd roots can't create extraneous solutions, but checking is a good habit",
            font_size=24,
            color=NOTE,
        ).to_edge(DOWN, buff=0.7)

        with self.voiceover(
            "For a cube root, cube both sides. The cube root of two x minus one equals "
            "three becomes two x minus one equals twenty seven. So x equals fourteen."
        ):
            self.play(Write(cube[0]))
            self.play(TransformFromCopy(cube[0], cube[1]), FadeIn(cube_note))
            self.wait(1)
            self.play(TransformFromCopy(cube[1], cube[2]))
        with self.voiceover(
            "Cubing both sides never creates false solutions, but checking is still a "
            "good habit. Squaring is a different story, as we'll see next."
        ):
            self.play(FadeIn(odd_note))
        self.clear_scene()

    # ---------------------------------------------- 8. extraneous solutions
    def extraneous_solutions(self):
        h = self.header("Watch out: extraneous solutions")

        work = self.steps(
            r"\sqrt{x+6} = x",
            r"x + 6 = x^2",
            r"x^2 - x - 6 = 0",
            r"(x-3)(x+2) = 0",
            r"x = 3 \ \text{ or } \ x = -2",
            font_size=54,
            buff=0.3,
        )
        work.next_to(h, DOWN, buff=0.5).to_edge(LEFT, buff=1.2)

        with self.voiceover(
            "Here's why checking matters. Solve: the square root of x plus six equals x."
        ):
            self.play(Write(work[0]))
        with self.voiceover(
            "The radical is already isolated, so square both sides: x plus six equals "
            "x squared."
        ):
            self.play(TransformFromCopy(work[0], work[1]))
        with self.voiceover(
            "Rearranging gives x squared minus x minus six equals zero, which factors as "
            "x minus three, times x plus two."
        ):
            self.play(TransformFromCopy(work[1], work[2]))
            self.wait(1)
            self.play(TransformFromCopy(work[2], work[3]))
        with self.voiceover("So x equals three, or x equals negative two."):
            self.play(TransformFromCopy(work[3], work[4]))

        check3 = MathTex(r"x = 3: \ \sqrt{9} = 3 \ \checkmark", font_size=50, color=RESULT)
        check_neg = MathTex(r"x = -2: \ \sqrt{4} = 2 \ne -2", font_size=50, color=WRONG)
        checks = VGroup(check3, check_neg).arrange(DOWN, aligned_edge=LEFT, buff=0.6)
        checks.next_to(work, RIGHT, buff=1.2).align_to(work[1], UP)
        title = Text("Check:", font_size=32).next_to(checks, UP, aligned_edge=LEFT)

        with self.voiceover(
            "Now check both. If x equals three, the square root of nine is three. True."
        ):
            self.play(FadeIn(title), Write(check3))
        with self.voiceover(
            "If x equals negative two, the square root of four is two, not negative two. "
            "That's false."
        ):
            self.play(Write(check_neg))
        cross = Cross(work[4][0][-4:], stroke_width=5)
        ext = Text("extraneous!", font_size=30, color=WRONG).next_to(check_neg, DOWN, buff=0.4)
        final = MathTex(r"x = 3", font_size=60, color=RESULT)
        final_box = SurroundingRectangle(final, color=RESULT, buff=0.25)
        VGroup(final, final_box).next_to(ext, DOWN, buff=0.7).align_to(checks, LEFT)
        with self.voiceover(
            "So negative two is an extraneous solution. It appeared only because we "
            "squared both sides, which hides the difference between two and negative two."
        ):
            self.play(Create(cross), FadeIn(ext))
        with self.voiceover("The only solution is x equals three."):
            self.play(Write(final), Create(final_box))
        self.clear_scene()

    # ---------------------------------------------------------------- 9. recap
    def summary(self):
        self.header("Recap")
        points = VGroup(
            MathTex(r"\sqrt{ab} = \sqrt{a}\,\sqrt{b}, \qquad \sqrt{72} = 6\sqrt{2}"),
            MathTex(r"\frac{6}{\sqrt{3}} = 2\sqrt{3} \quad \text{(rationalize)}"),
            MathTex(r"2\sqrt{3} + 3\sqrt{3} = 5\sqrt{3} \quad \text{(like radicals only)}"),
            MathTex(r"\text{Isolate, raise to a power, solve, }\textbf{check}"),
        ).arrange(DOWN, buff=0.55).shift(DOWN * 0.3)

        lines = [
            "To recap. Simplify radicals by pulling out perfect square factors, using the product rule.",
            "Rationalize denominators by multiplying by the radical, or by the conjugate.",
            "Add and subtract only like radicals, and multiply or divide with the product and quotient rules.",
            "To solve radical equations: isolate, raise to a power, solve, and always check for extraneous solutions.",
        ]
        for p, line in zip(points, lines):
            with self.voiceover(line):
                self.play(FadeIn(p, shift=UP * 0.2))
        self.clear_scene()

        outro = Text("Thanks for watching!", font_size=48)
        with self.voiceover("Thanks for watching!"):
            self.play(Write(outro))
        self.play(FadeOut(outro))

# Wise Choice Helper

A phone-friendly web app that walks Grade 8 students through the BBSI Mathematics 8
Third Quarter Performance Task, **The Wise Choice** (linear equations, systems of linear
equations, and linear inequalities).

Students enter their family's two payment options once (starting cost, cost per use,
monthly budget). Each screen then shows the work for one part of the task using
their own numbers:

| Part | What the app shows |
|---|---|
| Plan | Deadlines with a countdown, progress per part, scoring rubric, "copy all as text" |
| A | Variable definitions, photo of the real price list (saved on the phone) |
| B | `y = mx + b` for each option, meaning of slope and y-intercept, tables of ordered pairs with solutions |
| C | Both lines on one plane with labeled intercepts, plus a graph-paper scale suggestion |
| D | Break-even point from the graph, full substitution **or** elimination steps with checking, classification of the system, which option is cheaper below/above |
| E | One-variable budget inequality solved step by step with number lines; two-variable inequality graphed and shaded with two test points |
| F, G | Guides, the student's own numbers, and draft boxes for the letter and biblical reflection (students write these themselves) |

## Teacher Check

Open **Plan → Open Teacher Check** (or add `#teacher` to the link). Type in a student's two options and budget to get the full answer key for Parts B to E (both solving methods). It is kept separate from the student screens on the same phone; **Clear for the next student** resets it.

Everything is saved in the phone's browser (no account, no server). It works offline after
the first visit and can be added to the home screen ("Install app" / "Add to Home Screen").

## Hosting it for students

The app is static files only (`index.html`, `manifest.webmanifest`, `sw.js`, `icon.svg`).
To give students a link, enable **GitHub Pages** for this repository
(Settings → Pages → Deploy from branch) and share
`https://<owner>.github.io/<repo>/wise-choice/`.

# Signal Check Helper

A phone-friendly web app for the BBSI Mathematics 10 Third Quarter Performance Task,
**Signal Check** (circles on the coordinate plane, evaluating statistical reports, and
probability of compound events).

| Part | What the app shows |
|---|---|
| Plan | Deadlines with a countdown, progress per part, scoring rubric, "copy all as text" |
| A | Center-radius and general form of each circle with expansion steps, coverage map with the overlap shaded, distance-formula table classifying every landmark (A only, B only, both, neither) |
| B | Tap-to-record survey (network, good signal yes/no, inside/outside, no names), counter to 30, summary and raw-data tables |
| C | Contingency table, Venn diagram, P(A), P(G), P(A ∪ G), P(A ∩ G), complement, P(G given A), P(G given B), independence test, mutually exclusive events |
| D | Claim vs. data bar chart, representativeness checklist, verdict and discussion |
| E, F | Findings summary, report outline, Ephesians 4:25 prompts, and draft boxes (students write these themselves) |

## Teacher Check

Open **Plan → Open Teacher Check** (or add `#teacher` to the link). It asks for the teacher PIN first; only a SHA-256 hash of the PIN is stored in the code (`TC_HASH`). Type in a student's circles, landmarks and survey counts to get the full answer key for Parts A, C and D. It is kept separate from the student screens on the same phone; **Clear for the next student** resets it.

Everything is saved in the phone's browser. Works offline after the first visit.

Link for students (GitHub Pages): `https://compact-criterion.github.io/auto-manae/signal-check/`

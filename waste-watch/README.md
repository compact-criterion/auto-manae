# Waste Watch Helper

A phone-friendly web app for the BBSI Grade 11 integrated performance task,
**Kaytikling Waste Watch: Data, Design, and Advocacy** (General Mathematics × Philippine
Politics and Governance). It follows the task's 19 steps in five phases plus the reflection.

| Screen | What the app does |
|---|---|
| Plan | Group angle (segregation, single-use plastics, or recycling chain), members and roles, key dates with countdown, progress through the 19 steps, both 50-point rubrics, copy all as text |
| A · Prepare and research | Source tracker (title, outlet, what it says, why it can be trusted; at least five), guiding questions, governance analysis draft |
| B · Gather data | Survey item tips; Cochran sample size with the finite population correction (always rounded up); stratified allocation per grade level; secure random draw of ID-list positions; forms sent/returned and response rate; 7-day waste log entry or paste from a spreadsheet (no names; incomplete forms are flagged, never "fixed") |
| C · Analyze the data | Mean and SD of W (matching AVERAGE and STDEV.S), histogram with normal curve and bell-shape check, two normal-model questions and a percentile (with NORM.DIST / NORM.INV checks), probability distribution and E(X), projection, limits drawn from the group's own data |
| D · Design and build | Bulk density, volume needed between pickups with overflow, box dimensions vs. volume, surface area, cost, model size at scale, clinometer height, ramp slope check against 1 : 12 (BP 344) |
| E · Campaign and forum | Findings from the data, claim–evidence–reasoning builder, calls to action for the barangay, school, and households, and a rehearsal timer for the 45-minute forum program |
| F · Reflect | Philippians 2:4 prompts and an individual reflection draft |

Equations are typeset with MathJax (local copy in `../lib/mathjax`).

## Teacher Check

Open **Plan → Open Teacher Check** (or add `#teacher` to the link). It asks for the teacher PIN first; only a SHA-256 hash of the PIN is stored in the code (`TC_HASH`). Type in a group's N, strata, and measurements and paste their data rows to get the answer key.

Everything is saved in the phone's browser. Works offline after the first visit.

Link for students (GitHub Pages): `https://compact-criterion.github.io/auto-manae/waste-watch/`

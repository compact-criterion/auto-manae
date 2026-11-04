# MathGuro: an Android app for mathematics teachers

MathGuro is an offline Android app for a junior high, senior high, and college math teacher.

| Section | What it does |
|---|---|
| **Classes** | Students (male/female order), assessments by component and grading period, fast score entry with MPS/mean/high/low, a class record with DepEd transmutation (DO 8, s. 2015) or a college 1.00–5.00 scale, final grades, a descriptor summary, learner detail, and CSV export for Excel |
| **Attendance** | P / L / A / E per day, "mark rest present", a per-learner summary with rates, CSV export |
| **Picker** | A random student picker (no repeats, skips absentees) and a group maker |
| **Quiz** | 50+ randomized item generators (Grade 8 to Basic Calculus, plus Mathematics in the Modern World) with answer keys, multiple sets, a printable file, share as text, present/drill mode, and "add to class record" |
| **Tools** | A scientific calculator, a grapher, statistics, normal curve and z, correlation and regression, a quadratic solver, truth tables, sets and Venn diagrams, number theory and bases, sequences and Fibonacci, interest, counting, and the transmutation table |

All data stays on the phone. Use **Settings → Export backup** regularly.

## Grading presets
- JHS Mathematics: WW 40 / PT 40 / QA 20, Q1–Q4
- SHS Core (General Math, Stat & Prob): 25 / 50 / 25
- SHS Academic (Pre-Calc, Basic Calc): 25 / 45 / 30
- College: Quizzes 30 / Projects 30 / Exam 40, Prelim–Midterm–Finals, 1.00–5.00 (zero-based or base-50)

You can edit every class's components, weights, periods, and scale.

## Getting the APK
Every push runs `.github/workflows/android.yml`, which builds `MathGuro.apk` and publishes it under **Releases**.
On the phone, open the latest release, download `MathGuro.apk`, and install it.

The key in `signing/` is a fixed debug-style key. It keeps every build signed the same way, so new versions install over old ones without losing data. It is not meant for Play Store publishing.

## Development
```bash
npm install
npm test          # grading, math engine, and quiz generator tests
npm run serve     # open http://localhost:8080 in a browser
```
The app is plain HTML/CSS/JS in `www/`, wrapped with Capacitor 8.

// Grading logic: DepEd (DO 8, s. 2015) components, transmutation, and a
// common Philippine college 1.00–5.00 scale. Pure functions, no DOM.

export const PRESETS = {
  jhs: {
    label: 'JHS Mathematics (Grades 7–10)',
    scale: 'deped',
    periods: ['Q1', 'Q2', 'Q3', 'Q4'],
    components: [
      { key: 'WW', name: 'Written Works', weight: 40 },
      { key: 'PT', name: 'Performance Tasks', weight: 40 },
      { key: 'QA', name: 'Quarterly Assessment', weight: 20 },
    ],
  },
  'shs-core': {
    label: 'SHS Core (General Math, Statistics & Probability)',
    scale: 'deped',
    periods: ['Q1', 'Q2'],
    components: [
      { key: 'WW', name: 'Written Works', weight: 25 },
      { key: 'PT', name: 'Performance Tasks', weight: 50 },
      { key: 'QA', name: 'Quarterly Assessment', weight: 25 },
    ],
  },
  'shs-academic': {
    label: 'SHS Academic Track (Pre-Calculus, Basic Calculus)',
    scale: 'deped',
    periods: ['Q1', 'Q2'],
    components: [
      { key: 'WW', name: 'Written Works', weight: 25 },
      { key: 'PT', name: 'Performance Tasks', weight: 45 },
      { key: 'QA', name: 'Quarterly Assessment', weight: 30 },
    ],
  },
  college: {
    label: 'College (e.g., Mathematics in the Modern World)',
    scale: 'college',
    periods: ['Prelim', 'Midterm', 'Finals'],
    components: [
      { key: 'QZ', name: 'Quizzes & Seatwork', weight: 30 },
      { key: 'PR', name: 'Projects & Activities', weight: 30 },
      { key: 'EX', name: 'Major Exam', weight: 40 },
    ],
  },
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** DepEd transmutation of an initial grade (0–100) to a transmuted grade (60–100). */
export function transmute(ig) {
  if (!Number.isFinite(ig)) return null;
  ig = round2(Math.max(0, Math.min(100, ig)));
  if (ig >= 100) return 100;
  if (ig >= 60) return 75 + Math.floor((ig - 60) / 1.6 + 1e-9);
  return 60 + Math.floor(ig / 4 + 1e-9);
}

export function depedDescriptor(g) {
  if (g == null) return '';
  if (g >= 90) return 'Outstanding';
  if (g >= 85) return 'Very Satisfactory';
  if (g >= 80) return 'Satisfactory';
  if (g >= 75) return 'Fairly Satisfactory';
  return 'Did Not Meet Expectations';
}

const COLLEGE_TABLE = [
  [97, '1.00'], [94, '1.25'], [91, '1.50'], [88, '1.75'], [85, '2.00'],
  [82, '2.25'], [79, '2.50'], [76, '2.75'], [75, '3.00'],
];

export function collegePoint(pct) {
  if (pct == null) return null;
  const p = Math.round(pct);
  for (const [min, g] of COLLEGE_TABLE) if (p >= min) return g;
  return '5.00';
}

export function collegeDescriptor(point) {
  if (point == null) return '';
  const g = parseFloat(point);
  if (g <= 1.25) return 'Excellent';
  if (g <= 1.75) return 'Very Good';
  if (g <= 2.25) return 'Good';
  if (g <= 2.75) return 'Satisfactory';
  if (g <= 3.0) return 'Passed';
  return 'Failed';
}

export const COLLEGE_SCALE_ROWS = COLLEGE_TABLE.map(([min, g], i) => {
  const max = i === 0 ? 100 : COLLEGE_TABLE[i - 1][0] - 1;
  return { range: min === max ? `${min}` : `${min}–${max}`, grade: g };
}).concat([{ range: 'below 75', grade: '5.00' }]);

/**
 * Compute one student's grade for a grading period.
 * Blank scores on an existing assessment count as 0 (DepEd practice).
 * Components with no assessments yet are left out and the remaining
 * weights are re-scaled; the result is then flagged `partial`.
 */
export function computePeriod(cls, studentId, period) {
  const base = cls.scale === 'college' && Number(cls.collegeBase) === 50 ? 50 : 0;
  const comps = cls.components.map((c) => {
    const items = cls.assessments.filter((a) => a.period === period && a.comp === c.key);
    let raw = 0, max = 0, missing = 0;
    for (const a of items) {
      const s = cls.scores?.[a.id]?.[studentId];
      max += Number(a.max) || 0;
      if (s === undefined || s === null || s === '') missing++;
      else raw += Number(s) || 0;
    }
    const ps = max > 0 ? round2(base + (raw / max) * (100 - base)) : null;
    const ws = ps == null ? null : round2((ps * c.weight) / 100);
    return { key: c.key, name: c.name, weight: c.weight, raw, max, ps, ws, count: items.length, missing };
  });
  const present = comps.filter((c) => c.ps != null);
  if (!present.length) return { comps, initial: null, grade: null, display: '', descriptor: '', partial: false };
  const wSum = present.reduce((s, c) => s + c.weight, 0);
  const initial = round2(present.reduce((s, c) => s + c.ws, 0) * (100 / wSum));
  const partial = present.length < comps.length;
  if (cls.scale === 'college') {
    const point = collegePoint(initial);
    return { comps, initial, grade: initial, display: point, descriptor: collegeDescriptor(point), partial };
  }
  if (cls.scale === 'percent') {
    return { comps, initial, grade: initial, display: initial.toFixed(2), descriptor: '', partial };
  }
  const tg = transmute(initial);
  return { comps, initial, grade: tg, display: String(tg), descriptor: depedDescriptor(tg), partial };
}

/** Final grade: average of available period grades. */
export function computeFinal(cls, studentId) {
  const per = cls.periods.map((p) => ({ period: p, ...computePeriod(cls, studentId, p) }));
  const have = per.filter((p) => p.grade != null);
  if (!have.length) return { per, final: null, display: '', descriptor: '', complete: false };
  const avg = have.reduce((s, p) => s + p.grade, 0) / have.length;
  const complete = have.length === per.length;
  if (cls.scale === 'college') {
    const pct = round2(avg);
    const point = collegePoint(pct);
    return { per, final: pct, display: point, descriptor: collegeDescriptor(point), complete };
  }
  if (cls.scale === 'percent') {
    const pct = round2(avg);
    return { per, final: pct, display: pct.toFixed(2), descriptor: '', complete };
  }
  const fg = Math.round(avg);
  return { per, final: fg, display: String(fg), descriptor: depedDescriptor(fg), complete };
}

export function isPassing(cls, display) {
  if (display === '' || display == null) return null;
  if (cls.scale === 'college') return parseFloat(display) <= 3.0;
  return parseFloat(display) >= 75;
}

/** Rows for a full DepEd transmutation table (for the reference tool). */
export function transmutationRows() {
  const rows = [{ from: 100, to: 100, tg: 100 }];
  for (let tg = 99; tg >= 75; tg--) {
    const lo = round2(60 + (tg - 75) * 1.6);
    const hi = round2(lo + 1.59);
    rows.push({ from: lo, to: hi, tg });
  }
  for (let tg = 74; tg >= 60; tg--) {
    const lo = (tg - 60) * 4;
    rows.push({ from: lo, to: round2(lo + 3.99), tg });
  }
  return rows;
}

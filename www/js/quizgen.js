// Randomized item generators with answer keys, grouped by level.
// Each generator returns { q, a } using plain text + Unicode math.

import { sup, sub, gcd, lcm, nPr, nCr, fib, simplifyFraction, mod, fmt, sortSet, showSet } from './mathcore.js';

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const nz = (a, b) => { let x = 0; while (x === 0) x = ri(a, b); return x; };
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const money = (n) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format a polynomial from coefficients (highest power first). */
export function poly(coeffs, v = 'x') {
  const deg = coeffs.length - 1;
  let out = '';
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const p = deg - i;
    const abs = Math.abs(c);
    const coef = p === 0 ? String(abs) : abs === 1 ? '' : String(abs);
    const vv = p === 0 ? '' : p === 1 ? v : v + sup(p);
    const sign = c < 0 ? (out ? ' − ' : '−') : out ? ' + ' : '';
    out += sign + coef + vv;
  });
  return out || '0';
}

const lin = (a, b, v = 'x') => poly([a, b], v); // ax + b

/** Join signed terms, e.g. terms([[3,'x'],[-1,'y'],[5,'']]) -> "3x − y + 5". */
export function terms(list) {
  let out = '';
  for (const [c, v] of list) {
    if (c === 0) continue;
    const abs = Math.abs(c);
    const coef = v && abs === 1 ? '' : String(abs);
    out += (c < 0 ? (out ? ' − ' : '−') : out ? ' + ' : '') + coef + v;
  }
  return out || '0';
}
const factor = (r) => (r === 0 ? 'x' : r > 0 ? `(x − ${r})` : `(x + ${-r})`);
const signed = (n) => (n < 0 ? `− ${-n}` : `+ ${n}`);
const paren = (n) => (n < 0 ? `(${n})` : `${n}`);

const TRIPLES = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20], [20, 21, 29]];

export const GENERATORS = [
  /* ---------------- Grade 8 ---------------- */
  {
    id: 'g8-factor-trinomial', level: 'Grade 8', name: 'Factoring x² + bx + c',
    gen() {
      const r1 = nz(-9, 9), r2 = nz(-9, 9);
      const b = -(r1 + r2), c = r1 * r2;
      return { q: `Factor completely: ${poly([1, b, c])}`, a: r1 === r2 ? `${factor(r1)}²` : `${factor(r1)}${factor(r2)}` };
    },
  },
  {
    id: 'g8-diff-squares', level: 'Grade 8', name: 'Difference of two squares',
    gen() {
      let a, b;
      do { a = ri(1, 9); b = ri(1, 12); } while (gcd(a, b) !== 1);
      const A = a === 1 ? 'x' : `${a}x`;
      return { q: `Factor: ${a * a === 1 ? '' : a * a}x² − ${b * b}`, a: `(${A} + ${b})(${A} − ${b})` };
    },
  },
  {
    id: 'g8-gcf', level: 'Grade 8', name: 'Factoring the GCF',
    gen() {
      const g = ri(2, 9), m = ri(1, 3), k1 = ri(1, 7), k2 = nz(-9, 9);
      const xm = `x${m === 1 ? '' : sup(m)}`;
      const q = terms([[g * k1, `x${sup(m + 1)}`], [g * k2, xm]]);
      return { q: `Factor out the GCF: ${q}`, a: `${g}${xm}(${lin(k1, k2)})` };
    },
  },
  {
    id: 'g8-slope', level: 'Grade 8', name: 'Slope of a line through two points',
    gen() {
      const x1 = ri(-8, 8), y1 = ri(-8, 8);
      let x2 = ri(-8, 8);
      while (x2 === x1) x2 = ri(-8, 8);
      const y2 = ri(-8, 8);
      return { q: `Find the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`, a: `m = ${simplifyFraction(y2 - y1, x2 - x1)}` };
    },
  },
  {
    id: 'g8-slope-intercept', level: 'Grade 8', name: 'Slope-intercept form',
    gen() {
      const m = nz(-5, 5), b = ri(-9, 9);
      return { q: `Write in slope-intercept form and give the slope and y-intercept: ${terms([[-m, 'x'], [1, 'y']])} = ${b}`, a: `y = ${lin(m, b)}; m = ${m}, b = ${b}` };
    },
  },
  {
    id: 'g8-system', level: 'Grade 8', name: 'Systems of linear equations',
    gen() {
      const x = ri(-6, 6), y = ri(-6, 6);
      let a1, b1, a2, b2;
      do { a1 = nz(-5, 5); b1 = nz(-5, 5); a2 = nz(-5, 5); b2 = nz(-5, 5); } while (a1 * b2 - a2 * b1 === 0);
      const eq = (a, b) => `${terms([[a, 'x'], [b, 'y']])} = ${a * x + b * y}`;
      return { q: `Solve the system:  ${eq(a1, b1)}  and  ${eq(a2, b2)}`, a: `(${x}, ${y})` };
    },
  },
  {
    id: 'g8-linear-ineq', level: 'Grade 8', name: 'Linear inequalities in one variable',
    gen() {
      const a = nz(-6, 6), x = ri(-9, 9), b = ri(-10, 10);
      const op = pick(['<', '>', '≤', '≥']);
      const flip = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
      return { q: `Solve: ${lin(a, b)} ${op} ${a * x + b}`, a: `x ${a < 0 ? flip[op] : op} ${x}` };
    },
  },
  {
    id: 'g8-probability', level: 'Grade 8', name: 'Probability of simple events',
    gen() {
      const t = ri(0, 2);
      if (t === 0) {
        const k = ri(2, 12);
        let ways = 0;
        for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) if (i + j === k) ways++;
        return { q: `Two fair dice are rolled. What is P(sum = ${k})?`, a: simplifyFraction(ways, 36) };
      }
      if (t === 1) {
        const r = ri(2, 9), b = ri(2, 9), g = ri(1, 6);
        const c = pick([['red', r], ['blue', b], ['green', g]]);
        return { q: `A bag has ${r} red, ${b} blue, and ${g} green marbles. One marble is drawn at random. Find P(${c[0]}).`, a: simplifyFraction(c[1], r + b + g) };
      }
      const what = pick([['a heart', 13], ['a king', 4], ['a red card', 26], ['a face card', 12], ['an ace of spades', 1]]);
      return { q: `A card is drawn from a standard deck of 52. Find P(${what[0]}).`, a: simplifyFraction(what[1], 52) };
    },
  },

  /* ---------------- Grade 9 ---------------- */
  {
    id: 'g9-quadratic', level: 'Grade 9', name: 'Solving quadratic equations',
    gen() {
      const a = pick([1, 1, 1, 2, 3]);
      const r1 = nz(-9, 9), r2 = ri(-9, 9);
      const b = -a * (r1 + r2), c = a * r1 * r2;
      const roots = [...new Set([r1, r2])].sort((m, n) => m - n);
      return { q: `Solve: ${poly([a, b, c])} = 0`, a: roots.length === 1 ? `x = ${roots[0]} (double root)` : `x = ${roots[0]} or x = ${roots[1]}` };
    },
  },
  {
    id: 'g9-discriminant', level: 'Grade 9', name: 'Nature of roots (discriminant)',
    gen() {
      const a = nz(-4, 5), b = ri(-10, 10), c = ri(-10, 10);
      const d = b * b - 4 * a * c;
      const sq = Number.isInteger(Math.sqrt(d));
      const nature = d < 0 ? 'no real roots (imaginary)' : d === 0 ? 'real, rational, and equal' : sq ? 'real, rational, and unequal' : 'real, irrational, and unequal';
      return { q: `Find the discriminant and describe the roots of ${poly([a, b, c])} = 0.`, a: `D = ${d}; ${nature}` };
    },
  },
  {
    id: 'g9-sum-product', level: 'Grade 9', name: 'Sum and product of roots',
    gen() {
      const a = nz(1, 5), b = ri(-12, 12), c = nz(-12, 12);
      return { q: `Without solving, find the sum and product of the roots of ${poly([a, b, c])} = 0.`, a: `sum = ${simplifyFraction(-b, a)}, product = ${simplifyFraction(c, a)}` };
    },
  },
  {
    id: 'g9-variation', level: 'Grade 9', name: 'Direct and inverse variation',
    gen() {
      const k = ri(2, 9), x1 = ri(2, 9), x2 = ri(2, 12);
      if (Math.random() < 0.5) {
        return { q: `y varies directly as x. If y = ${k * x1} when x = ${x1}, find y when x = ${x2}.`, a: `y = ${k * x2}  (k = ${k})` };
      }
      const K = k * x1 * x2;
      return { q: `y varies inversely as x. If y = ${K / x1} when x = ${x1}, find y when x = ${x2}.`, a: `y = ${fmt(K / x2, 4)}  (k = ${K})` };
    },
  },
  {
    id: 'g9-exponents', level: 'Grade 9', name: 'Laws of exponents',
    gen() {
      const a = ri(2, 9), b = ri(2, 9), c = ri(1, 9), m = ri(2, 4);
      const t = ri(0, 2);
      if (t === 0) return { q: `Simplify: x${sup(a)} · x${sup(b)} ÷ x${sup(c)}`, a: `x${sup(a + b - c)}` + (a + b - c < 0 ? `  =  1/x${sup(c - a - b)}` : '') };
      if (t === 1) return { q: `Simplify: (x${sup(a)}y${sup(b)})${sup(m)}`, a: `x${sup(a * m)}y${sup(b * m)}` };
      const n = ri(2, 5);
      return { q: `Evaluate: ${n}${sup(-2)}`, a: `1/${n * n}` };
    },
  },
  {
    id: 'g9-radicals', level: 'Grade 9', name: 'Simplifying radicals',
    gen() {
      const k = ri(2, 9), r = pick([2, 3, 5, 6, 7, 10]);
      return { q: `Simplify: √${k * k * r}`, a: `${k}√${r}` };
    },
  },
  {
    id: 'g9-trig-special', level: 'Grade 9', name: 'Trigonometric ratios of special angles',
    gen() {
      const table = {
        sin: { 30: '1/2', 45: '√2/2', 60: '√3/2' },
        cos: { 30: '√3/2', 45: '√2/2', 60: '1/2' },
        tan: { 30: '√3/3', 45: '1', 60: '√3' },
      };
      const f = pick(['sin', 'cos', 'tan']), ang = pick([30, 45, 60]);
      return { q: `Give the exact value of ${f} ${ang}°.`, a: table[f][ang] };
    },
  },
  {
    id: 'g9-right-triangle', level: 'Grade 9', name: 'Right triangles (Pythagorean theorem)',
    gen() {
      const [a, b, c] = pick(TRIPLES);
      const k = ri(1, 3);
      if (Math.random() < 0.5) return { q: `The legs of a right triangle are ${a * k} and ${b * k}. Find the hypotenuse.`, a: `${c * k}` };
      return { q: `A right triangle has hypotenuse ${c * k} and one leg ${a * k}. Find the other leg.`, a: `${b * k}` };
    },
  },

  /* ---------------- Grade 10 ---------------- */
  {
    id: 'g10-arith-nth', level: 'Grade 10', name: 'Arithmetic sequence: nth term',
    gen() {
      const a1 = ri(-10, 20), d = nz(-6, 8), n = ri(8, 40);
      return { q: `Find the ${ord(n)} term of the arithmetic sequence ${a1}, ${a1 + d}, ${a1 + 2 * d}, …`, a: `${a1 + (n - 1) * d}` };
    },
  },
  {
    id: 'g10-arith-sum', level: 'Grade 10', name: 'Arithmetic series: sum of n terms',
    gen() {
      const a1 = ri(1, 15), d = ri(1, 7), n = ri(8, 30);
      return { q: `Find the sum of the first ${n} terms of ${a1}, ${a1 + d}, ${a1 + 2 * d}, …`, a: `S${sub(n)} = ${(n / 2) * (2 * a1 + (n - 1) * d)}` };
    },
  },
  {
    id: 'g10-geo-nth', level: 'Grade 10', name: 'Geometric sequence: nth term',
    gen() {
      const a1 = nz(-5, 6), r = pick([2, 3, -2, -3, 2, 3]), n = ri(5, 9);
      return { q: `Find the ${ord(n)} term of the geometric sequence ${a1}, ${a1 * r}, ${a1 * r * r}, …`, a: `${a1 * r ** (n - 1)}` };
    },
  },
  {
    id: 'g10-geo-inf', level: 'Grade 10', name: 'Infinite geometric series',
    gen() {
      const r = pick([[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [-1, 2], [-1, 3]]);
      const a1 = r[1] * ri(1, 6);
      const a2 = (a1 * r[0]) / r[1];
      const S = simplifyFraction(a1 * r[1], r[1] - r[0]);
      return { q: `Find the sum of the infinite geometric series ${a1} + ${paren(a2)} + …`, a: `S = ${S}  (r = ${r[0]}/${r[1]})` };
    },
  },
  {
    id: 'g10-remainder', level: 'Grade 10', name: 'Remainder theorem',
    gen() {
      const c = [ri(1, 4), ri(-6, 6), ri(-9, 9), ri(-9, 9)];
      const r = nz(-3, 3);
      const val = c.reduce((acc, k) => acc * r + k, 0);
      return { q: `Find the remainder when P(x) = ${poly(c)} is divided by ${r > 0 ? `x − ${r}` : `x + ${-r}`}.`, a: `R = P(${r}) = ${val}` };
    },
  },
  {
    id: 'g10-synthetic', level: 'Grade 10', name: 'Polynomial division (exact quotient)',
    gen() {
      const q = [ri(1, 3), ri(-5, 5), ri(-6, 6)];
      const r = nz(-4, 4);
      // (x − r)(q0x² + q1x + q2)
      const p = [q[0], q[1] - r * q[0], q[2] - r * q[1], -r * q[2]];
      return { q: `Divide: (${poly(p)}) ÷ (${r > 0 ? `x − ${r}` : `x + ${-r}`})`, a: `${poly(q)}` };
    },
  },
  {
    id: 'g10-distance', level: 'Grade 10', name: 'Distance formula',
    gen() {
      const [a, b, c] = pick(TRIPLES);
      const x1 = ri(-6, 6), y1 = ri(-6, 6);
      const sx = pick([1, -1]), sy = pick([1, -1]);
      return { q: `Find the distance between (${x1}, ${y1}) and (${x1 + sx * a}, ${y1 + sy * b}).`, a: `${c}` };
    },
  },
  {
    id: 'g10-midpoint', level: 'Grade 10', name: 'Midpoint formula',
    gen() {
      const x1 = ri(-10, 10), y1 = ri(-10, 10), x2 = ri(-10, 10), y2 = ri(-10, 10);
      const h = (n) => (n % 2 === 0 ? `${n / 2}` : `${n}/2`);
      return { q: `Find the midpoint of the segment joining (${x1}, ${y1}) and (${x2}, ${y2}).`, a: `(${h(x1 + x2)}, ${h(y1 + y2)})` };
    },
  },
  {
    id: 'g10-circle', level: 'Grade 10', name: 'Equation of a circle',
    gen() {
      const h = ri(-7, 7), k = ri(-7, 7), r = ri(1, 9);
      const part = (v, s) => (s === 0 ? `${v}²` : s > 0 ? `(${v} − ${s})²` : `(${v} + ${-s})²`);
      if (Math.random() < 0.5) return { q: `Write the standard equation of the circle with center (${h}, ${k}) and radius ${r}.`, a: `${part('x', h)} + ${part('y', k)} = ${r * r}` };
      return { q: `Give the center and radius of ${part('x', h)} + ${part('y', k)} = ${r * r}.`, a: `center (${h}, ${k}), r = ${r}` };
    },
  },
  {
    id: 'g10-perm-comb', level: 'Grade 10', name: 'Permutations and combinations',
    gen() {
      const n = ri(5, 12), r = ri(2, Math.min(5, n - 1));
      const t = ri(0, 3);
      if (t === 0) return { q: `Evaluate P(${n}, ${r}).`, a: `${nPr(n, r)}` };
      if (t === 1) return { q: `Evaluate C(${n}, ${r}).`, a: `${nCr(n, r)}` };
      if (t === 2) return { q: `In how many ways can a president, a vice-president, and a secretary be chosen from ${n} officers?`, a: `P(${n}, 3) = ${nPr(n, 3)}` };
      return { q: `How many committees of ${r} can be formed from ${n} students?`, a: `C(${n}, ${r}) = ${nCr(n, r)}` };
    },
  },
  {
    id: 'g10-circular-perm', level: 'Grade 10', name: 'Circular & distinguishable permutations',
    gen() {
      if (Math.random() < 0.5) {
        const n = ri(4, 9);
        return { q: `In how many ways can ${n} people be seated around a circular table?`, a: `(${n} − 1)! = ${nPr(n - 1, n - 1)}` };
      }
      const word = pick(['BANANA', 'LETTER', 'GOOGLE', 'BALLOON', 'MAMMAL', 'COFFEE', 'ASSESS']);
      const counts = {};
      [...word].forEach((c) => (counts[c] = (counts[c] || 0) + 1));
      let v = nPr(word.length, word.length);
      Object.values(counts).forEach((c) => (v /= nPr(c, c)));
      return { q: `How many distinguishable arrangements of the letters of "${word}" are there?`, a: `${v}` };
    },
  },
  {
    id: 'g10-quartile', level: 'Grade 10', name: 'Quartiles and percentiles (ungrouped)',
    gen() {
      const n = pick([7, 11, 15]);
      const data = Array.from({ length: n }, () => ri(10, 99)).sort((a, b) => a - b);
      const k = pick([1, 2, 3]);
      const pos = (k * (n + 1)) / 4;
      return { q: `Find Q${sub(k)} of: ${shuffle(data).join(', ')}`, a: `Q${sub(k)} = ${data[pos - 1]}  (position ${pos} in sorted data)` };
    },
  },

  /* ---------------- Senior High School ---------------- */
  {
    id: 'shs-eval-fn', level: 'SHS – General Math', name: 'Evaluating functions',
    gen() {
      const a = nz(-4, 4), b = ri(-8, 8), c = ri(-9, 9), x = ri(-5, 5);
      return { q: `If f(x) = ${poly([a, b, c])}, find f(${x}).`, a: `${a * x * x + b * x + c}` };
    },
  },
  {
    id: 'shs-composite', level: 'SHS – General Math', name: 'Composite functions',
    gen() {
      const a = nz(-4, 4), b = ri(-6, 6), c = nz(-3, 3), d = ri(-6, 6), x = ri(-4, 4);
      const g = c * x + d;
      return { q: `If f(x) = ${lin(a, b)} and g(x) = ${lin(c, d)}, find (f ∘ g)(${x}).`, a: `f(g(${x})) = f(${g}) = ${a * g + b}` };
    },
  },
  {
    id: 'shs-inverse', level: 'SHS – General Math', name: 'Inverse of a linear function',
    gen() {
      const a = nz(-6, 6), b = ri(-9, 9);
      const num = b === 0 ? 'x' : `x ${b > 0 ? '−' : '+'} ${Math.abs(b)}`;
      return { q: `Find f⁻¹(x) if f(x) = ${lin(a, b)}.`, a: a === 1 ? `f⁻¹(x) = ${num}` : `f⁻¹(x) = (${num}) / ${a}` };
    },
  },
  {
    id: 'shs-simple-interest', level: 'SHS – General Math', name: 'Simple interest',
    gen() {
      const P = ri(5, 100) * 1000, r = pick([2, 3, 4, 5, 6, 8, 10, 12]), t = pick([1, 2, 3, 4, 5, 1.5, 2.5]);
      const I = (P * r * t) / 100;
      return { q: `Find the simple interest and maturity value on ${money(P)} at ${r}% per year for ${t} years.`, a: `I = ${money(I)}, F = ${money(P + I)}` };
    },
  },
  {
    id: 'shs-compound-interest', level: 'SHS – General Math', name: 'Compound interest',
    gen() {
      const P = ri(5, 100) * 1000, r = pick([2, 3, 4, 5, 6, 8]), t = ri(2, 10);
      const m = pick([[1, 'annually'], [2, 'semi-annually'], [4, 'quarterly'], [12, 'monthly']]);
      const F = P * (1 + r / 100 / m[0]) ** (m[0] * t);
      return { q: `${money(P)} is invested at ${r}% compounded ${m[1]} for ${t} years. Find the future value.`, a: `F = ${money(Math.round(F * 100) / 100)}` };
    },
  },
  {
    id: 'shs-log', level: 'SHS – General Math', name: 'Evaluating logarithms',
    gen() {
      const b = pick([2, 3, 4, 5, 10]), k = ri(-2, 5);
      const val = k >= 0 ? `${b ** k}` : `1/${b ** -k}`;
      return { q: `Evaluate: log${sub(b)} ${val}`, a: `${k}` };
    },
  },
  {
    id: 'shs-exp-eq', level: 'SHS – General Math', name: 'Exponential equations',
    gen() {
      const b = pick([2, 3, 5]), x = ri(-3, 5), a = ri(-3, 3);
      const k = x + a;
      const rhs = k >= 0 ? `${b ** k}` : `1/${b ** -k}`;
      return { q: `Solve for x: ${b}^(x ${a < 0 ? '−' : '+'} ${Math.abs(a)}) = ${rhs}`, a: `x = ${x}` };
    },
  },
  {
    id: 'sp-mean-rv', level: 'SHS – Statistics & Probability', name: 'Mean & variance of a discrete random variable',
    gen() {
      const xs = [0, 1, 2, 3];
      let w;
      do { w = xs.map(() => ri(1, 5)); } while (w.reduce((a, b) => a + b) !== 10);
      const ps = w.map((v) => v / 10);
      const mean = xs.reduce((s, x, i) => s + x * ps[i], 0);
      const varr = xs.reduce((s, x, i) => s + (x - mean) ** 2 * ps[i], 0);
      return {
        q: `X has the distribution  X: ${xs.join(', ')}  with P(X): ${ps.map((p) => p.toFixed(1)).join(', ')}. Find μ and σ².`,
        a: `μ = ${fmt(mean, 2)}, σ² = ${fmt(varr, 4)}`,
      };
    },
  },
  {
    id: 'sp-zscore', level: 'SHS – Statistics & Probability', name: 'z-scores',
    gen() {
      const mu = ri(50, 90), sd = ri(2, 10), z = pick([-2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3]);
      const x = mu + z * sd;
      return { q: `A test has μ = ${mu} and σ = ${sd}. Find the z-score of a score of ${x}.`, a: `z = ${z}` };
    },
  },
  {
    id: 'sp-normal-area', level: 'SHS – Statistics & Probability', name: 'Areas under the normal curve',
    gen() {
      const rule = pick([[1, '68%'], [2, '95%'], [3, '99.7%']]);
      return { q: `Using the empirical rule, about what percent of a normal distribution lies within ${rule[0]} standard deviation${rule[0] > 1 ? 's' : ''} of the mean?`, a: rule[1] };
    },
  },
  {
    id: 'sp-sampling', level: 'SHS – Statistics & Probability', name: 'Sampling distribution of the mean',
    gen() {
      const sd = pick([8, 10, 12, 15, 20]), n = pick([4, 16, 25, 36, 64, 100]), mu = ri(40, 90);
      return { q: `A population has μ = ${mu} and σ = ${sd}. For samples of size n = ${n}, find the mean and standard error of the sample mean.`, a: `μx̄ = ${mu}, σx̄ = ${fmt(sd / Math.sqrt(n), 4)}` };
    },
  },
  {
    id: 'pc-deg-rad', level: 'SHS – Pre-Calculus', name: 'Degree ↔ radian conversion',
    gen() {
      const deg = pick([30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360]);
      const g = gcd(deg, 180);
      const num = deg / g, den = 180 / g;
      const rad = `${num === 1 ? '' : num}π${den === 1 ? '' : '/' + den}`;
      return Math.random() < 0.5 ? { q: `Convert ${deg}° to radians.`, a: rad } : { q: `Convert ${rad} radians to degrees.`, a: `${deg}°` };
    },
  },
  {
    id: 'pc-conic', level: 'SHS – Pre-Calculus', name: 'Identifying conic sections',
    gen() {
      const t = ri(0, 3);
      const A = ri(1, 6), C = ri(1, 6), D = ri(-8, 8), E = nz(-8, 8), F = ri(-20, 20);
      const make = (a, c) => `${terms([[a, 'x²'], [c, 'y²'], [D, 'x'], [E, 'y'], [F, '']])} = 0`;
      if (t === 0) return { q: `Identify the conic: ${make(A, A)}`, a: 'Circle' };
      if (t === 1) return { q: `Identify the conic: ${make(A, A + C)}`, a: 'Ellipse' };
      if (t === 2) return { q: `Identify the conic: ${make(A, -C)}`, a: 'Hyperbola' };
      return { q: `Identify the conic: ${make(A, 0)}`, a: 'Parabola' };
    },
  },
  {
    id: 'bc-limit', level: 'SHS – Basic Calculus', name: 'Limits',
    gen() {
      if (Math.random() < 0.5) {
        const c = [ri(1, 3), ri(-5, 5), ri(-9, 9)], a = ri(-4, 4);
        return { q: `Evaluate: lim (x→${a}) [${poly(c)}]`, a: `${c[0] * a * a + c[1] * a + c[2]}` };
      }
      const a = nz(-6, 6);
      return { q: `Evaluate: lim (x→${a}) (x² − ${a * a}) / (x ${a < 0 ? '+' : '−'} ${Math.abs(a)})`, a: `${2 * a}` };
    },
  },
  {
    id: 'bc-derivative', level: 'SHS – Basic Calculus', name: 'Derivatives of polynomials',
    gen() {
      const c = [ri(1, 5), ri(-6, 6), ri(-9, 9), ri(-9, 9)];
      const d = [3 * c[0], 2 * c[1], c[2]];
      return { q: `Find f′(x) if f(x) = ${poly(c)}.`, a: `f′(x) = ${poly(d)}` };
    },
  },
  {
    id: 'bc-slope-tangent', level: 'SHS – Basic Calculus', name: 'Slope of the tangent line',
    gen() {
      const a = nz(-3, 3), b = ri(-6, 6), c = ri(-9, 9), x = ri(-3, 3);
      return { q: `Find the slope of the tangent to y = ${poly([a, b, c])} at x = ${x}.`, a: `m = ${2 * a * x + b}` };
    },
  },
  {
    id: 'bc-integral', level: 'SHS – Basic Calculus', name: 'Definite integrals of polynomials',
    gen() {
      const a = ri(1, 3) * 3, b = ri(-4, 4) * 2, lo = ri(0, 2), hi = lo + ri(1, 3);
      // ∫ (a x² + b x) dx = a/3 x³ + b/2 x²
      const F = (x) => (a / 3) * x ** 3 + (b / 2) * x ** 2;
      return { q: `Evaluate: ∫ from ${lo} to ${hi} of (${poly([a, b, 0])}) dx`, a: `${fmt(F(hi) - F(lo), 4)}` };
    },
  },

  /* ---------------- College: Mathematics in the Modern World ---------------- */
  {
    id: 'mmw-fibonacci', level: 'College – MMW', name: 'Fibonacci sequence',
    gen() {
      const n = ri(8, 25);
      if (Math.random() < 0.5) return { q: `Find F${sub(n)}, the ${ord(n)} Fibonacci number (F₁ = F₂ = 1).`, a: `${fib(n)}` };
      return { q: `Compute F${sub(n + 1)} / F${sub(n)} to 4 decimal places. What number does it approach?`, a: `${(fib(n + 1) / fib(n)).toFixed(4)}; the golden ratio φ ≈ 1.6180` };
    },
  },
  {
    id: 'mmw-patterns', level: 'College – MMW', name: 'Number patterns: next term',
    gen() {
      const t = ri(0, 4);
      if (t === 0) { const a = ri(1, 9), d = ri(2, 9); const s = [0, 1, 2, 3, 4].map((i) => a + i * d); return { q: `What is the next term? ${s.join(', ')}, …`, a: `${a + 5 * d}` }; }
      if (t === 1) { const a = ri(1, 4), r = ri(2, 3); const s = [0, 1, 2, 3, 4].map((i) => a * r ** i); return { q: `What is the next term? ${s.join(', ')}, …`, a: `${a * r ** 5}` }; }
      if (t === 2) { const k = ri(1, 4); const s = [0, 1, 2, 3, 4].map((i) => (i + k) ** 2); return { q: `What is the next term? ${s.join(', ')}, …`, a: `${(5 + k) ** 2}` }; }
      if (t === 3) { const s = [1, 3, 6, 10, 15]; return { q: `What is the next term? ${s.join(', ')}, …  (triangular numbers)`, a: '21' }; }
      const a = ri(1, 5), b = ri(1, 5);
      const s = [a, b]; for (let i = 2; i < 6; i++) s.push(s[i - 1] + s[i - 2]);
      return { q: `What is the next term? ${s.join(', ')}, …`, a: `${s[4] + s[5]}` };
    },
  },
  {
    id: 'mmw-truth-value', level: 'College – MMW', name: 'Truth value of compound propositions',
    gen() {
      const p = Math.random() < 0.5, q = Math.random() < 0.5, r = Math.random() < 0.5;
      const T = (b) => (b ? 'T' : 'F');
      const forms = [
        ['(p ∧ q) → r', (!(p && q) || r)],
        ['¬p ∨ (q ∧ r)', (!p || (q && r))],
        ['(p → q) ↔ ¬r', ((!p || q) === !r)],
        ['¬(p ∨ q) ∧ r', (!(p || q) && r)],
        ['(p ∨ ¬q) → (q ∧ r)', (!(p || !q) || (q && r))],
        ['(p ↔ q) ∨ ¬r', ((p === q) || !r)],
      ];
      const [f, v] = pick(forms);
      return { q: `If p is ${T(p)}, q is ${T(q)}, and r is ${T(r)}, find the truth value of ${f}.`, a: T(v) };
    },
  },
  {
    id: 'mmw-conditional', level: 'College – MMW', name: 'Converse, inverse, contrapositive',
    gen() {
      const bank = [
        ['it rains', 'the ground is wet', 'it does not rain', 'the ground is not wet'],
        ['a number is divisible by 4', 'it is even', 'a number is not divisible by 4', 'it is not even'],
        ['you study hard', 'you pass the exam', 'you do not study hard', 'you do not pass the exam'],
        ['a polygon is a square', 'it has four sides', 'a polygon is not a square', 'it does not have four sides'],
        ['x = 3', 'x² = 9', 'x ≠ 3', 'x² ≠ 9'],
      ];
      const [p, q, np, nq] = pick(bank);
      const kind = pick(['converse', 'inverse', 'contrapositive']);
      const ans = { converse: `If ${q}, then ${p}.`, inverse: `If ${np}, then ${nq}.`, contrapositive: `If ${nq}, then ${np}.` }[kind];
      return { q: `Write the ${kind} of: "If ${p}, then ${q}."`, a: ans };
    },
  },
  {
    id: 'mmw-sets', level: 'College – MMW', name: 'Set operations',
    gen() {
      const U = Array.from({ length: 10 }, (_, i) => i + 1);
      const A = shuffle(U).slice(0, ri(3, 6)), B = shuffle(U).slice(0, ri(3, 6));
      const op = pick(['∪', '∩', '−', "A′"]);
      let ans;
      if (op === '∪') ans = [...new Set([...A, ...B])];
      else if (op === '∩') ans = A.filter((x) => B.includes(x));
      else if (op === '−') ans = A.filter((x) => !B.includes(x));
      else ans = U.filter((x) => !A.includes(x));
      const what = op === "A′" ? "A′ (complement of A)" : `A ${op} B`;
      return { q: `U = {1, 2, …, 10}, A = ${showSet(sortSet(A))}, B = ${showSet(sortSet(B))}. Find ${what}.`, a: showSet(ans) };
    },
  },
  {
    id: 'mmw-modular', level: 'College – MMW', name: 'Modular (clock) arithmetic',
    gen() {
      const t = ri(0, 2);
      if (t === 0) { const a = ri(20, 300), n = pick([5, 7, 9, 11, 12, 13]); return { q: `Evaluate ${a} mod ${n}.`, a: `${mod(a, n)}` }; }
      if (t === 1) { const now = ri(1, 12), h = ri(20, 200); const r = mod(now + h - 1, 12) + 1; return { q: `It is ${now} o'clock now. What time will it be after ${h} hours (12-hour clock)?`, a: `${r} o'clock` }; }
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const d = ri(0, 6), k = ri(30, 400);
      return { q: `Today is ${days[d]}. What day will it be ${k} days from now?`, a: `${days[mod(d + k, 7)]}  (${k} mod 7 = ${mod(k, 7)})` };
    },
  },
  {
    id: 'mmw-gcd-lcm', level: 'College – MMW', name: 'GCD and LCM',
    gen() {
      const g = ri(2, 12), a = g * ri(2, 9), b = g * ri(2, 9);
      return { q: `Find the GCD and LCM of ${a} and ${b}.`, a: `GCD = ${gcd(a, b)}, LCM = ${lcm(a, b)}` };
    },
  },
  {
    id: 'mmw-central', level: 'College – MMW', name: 'Mean, median, mode',
    gen() {
      const n = ri(6, 9);
      const data = Array.from({ length: n }, () => ri(60, 100));
      data.push(pick(data));
      const s = [...data].sort((a, b) => a - b);
      const m = s.length;
      const mean = s.reduce((a, b) => a + b, 0) / m;
      const median = m % 2 ? s[(m - 1) / 2] : (s[m / 2 - 1] + s[m / 2]) / 2;
      const f = {}; s.forEach((x) => (f[x] = (f[x] || 0) + 1));
      const mx = Math.max(...Object.values(f));
      const modes = Object.keys(f).filter((k) => f[k] === mx);
      return { q: `Find the mean, median, and mode of: ${shuffle(data).join(', ')}`, a: `mean = ${fmt(mean, 2)}, median = ${fmt(median, 2)}, mode = ${modes.join(', ')}` };
    },
  },
  {
    id: 'mmw-sd', level: 'College – MMW', name: 'Standard deviation (sample)',
    gen() {
      const data = Array.from({ length: ri(5, 7) }, () => ri(1, 20));
      const n = data.length, mean = data.reduce((a, b) => a + b, 0) / n;
      const v = data.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
      return { q: `Find the sample variance and standard deviation of: ${data.join(', ')}`, a: `s² = ${fmt(v, 4)}, s = ${fmt(Math.sqrt(v), 4)}` };
    },
  },
  {
    id: 'mmw-binary', level: 'College – MMW', name: 'Base conversion (binary)',
    gen() {
      const n = ri(5, 255);
      return Math.random() < 0.5 ? { q: `Convert ${n} (base 10) to base 2.`, a: `${n.toString(2)}₂` } : { q: `Convert ${n.toString(2)}₂ to base 10.`, a: `${n}` };
    },
  },
  {
    id: 'mmw-isbn', level: 'College – MMW', name: 'ISBN-13 check digit',
    gen() {
      const d = [9, 7, pick([8, 9]), ...Array.from({ length: 9 }, () => ri(0, 9))];
      const s = d.reduce((acc, x, i) => acc + x * (i % 2 ? 3 : 1), 0);
      const check = (10 - (s % 10)) % 10;
      return { q: `Find the check digit of the ISBN-13 that begins ${d.slice(0, 3).join('')}-${d.slice(3).join('')}-?`, a: `${check}  (weighted sum = ${s})` };
    },
  },
  {
    id: 'mmw-linreg', level: 'College – MMW', name: 'Correlation & linear regression',
    gen() {
      const m = nz(-3, 4), b = ri(-5, 10);
      const xs = [1, 2, 3, 4, 5];
      const ys = xs.map((x) => m * x + b);
      return { q: `Find the regression line ŷ = a + bx for the data x: ${xs.join(', ')} and y: ${ys.join(', ')}. What is r?`, a: `ŷ = ${b} ${signed(m)}x; r = ${m > 0 ? 1 : -1} (perfect ${m > 0 ? 'positive' : 'negative'} linear)` };
    },
  },
];

function ord(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export const LEVELS = [...new Set(GENERATORS.map((g) => g.level))];

/** Build a quiz: topicCounts = { [genId]: count }. Returns items in topic order (or shuffled). */
export function buildQuiz(topicCounts, { shuffleItems = false } = {}) {
  const items = [];
  for (const g of GENERATORS) {
    const n = topicCounts[g.id] || 0;
    const seen = new Set();
    for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
      const it = g.gen();
      if (seen.has(it.q)) continue;
      seen.add(it.q);
      items.push({ ...it, topic: g.name });
      i++;
    }
  }
  const neat = (t) => t.replace(/(^|[\s(,=:\[])-(\d)/g, '$1−$2');
  for (const it of items) { it.q = neat(it.q); it.a = neat(it.a); }
  return shuffleItems ? shuffle(items) : items;
}

// Math engine: safe expression parser (no eval), statistics, logic,
// number theory, normal distribution. Pure functions, no DOM.

/* ---------------- Expression parser ---------------- */

const FUNCS = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, sqrt: 1, cbrt: 1, abs: 1,
  ln: 1, log: 1, exp: 1, floor: 1, ceil: 1, round: 1, sec: 1, csc: 1, cot: 1,
};

function tokenize(src) {
  const s = src.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
    .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/²/g, '^2').replace(/³/g, '^3');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      if (s[j] === 'E' && /[-+0-9]/.test(s[j + 1] || '')) { j += 2; while (/[0-9]/.test(s[j] || '')) j++; }
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) throw new Error(`Bad number "${s.slice(i, j)}"`);
      out.push({ t: 'num', v: num });
      i = j;
    } else if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      let word = s.slice(i, j);
      // split words like "xsin" or "pix" into known pieces
      while (word.length) {
        const fn = Object.keys(FUNCS).sort((a, b) => b.length - a.length).find((f) => word.startsWith(f));
        if (fn) { out.push({ t: 'fn', v: fn }); word = word.slice(fn.length); continue; }
        if (word.startsWith('pi')) { out.push({ t: 'num', v: Math.PI }); word = word.slice(2); continue; }
        const c = word[0];
        if (c === 'e') out.push({ t: 'num', v: Math.E });
        else out.push({ t: 'var', v: c });
        word = word.slice(1);
      }
      i = j;
    } else if ('+-*/^()!,'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
    } else {
      throw new Error(`Unexpected "${ch}"`);
    }
  }
  // implicit multiplication: 2x, 2(…), )(, x(…), )x, 2sin, x y
  const res = [];
  for (let k = 0; k < out.length; k++) {
    const a = res[res.length - 1], b = out[k];
    const aEnds = a && (a.t === 'num' || a.t === 'var' || (a.t === 'op' && (a.v === ')' || a.v === '!')));
    const bStarts = b.t === 'num' || b.t === 'var' || b.t === 'fn' || (b.t === 'op' && b.v === '(');
    if (aEnds && bStarts) res.push({ t: 'op', v: '*' });
    res.push(b);
  }
  return res;
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) return gamma(n + 1);
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function gamma(z) {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/**
 * Compile an expression into a function of a scope object, e.g.
 * compile('2x^2+3')({x: 1}) === 5. Options: {deg: true} for degree trig.
 */
export function compile(src, opts = {}) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
  const expect = (v) => { if (!isOp(v)) throw new Error(`Expected "${v}"`); p++; };
  const D = opts.deg ? Math.PI / 180 : 1;

  // expr := term (('+'|'-') term)*
  function expr() {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = toks[p++].v, l = left, r = term();
      left = op === '+' ? (s) => l(s) + r(s) : (s) => l(s) - r(s);
    }
    return left;
  }
  // term := unary (('*'|'/') unary)*
  function term() {
    let left = unary();
    while (isOp('*') || isOp('/')) {
      const op = toks[p++].v, l = left, r = unary();
      left = op === '*' ? (s) => l(s) * r(s) : (s) => l(s) / r(s);
    }
    return left;
  }
  // unary := ('-'|'+') unary | power
  function unary() {
    if (isOp('-')) { p++; const u = unary(); return (s) => -u(s); }
    if (isOp('+')) { p++; return unary(); }
    return power();
  }
  // power := postfix ('^' unary)?   (right associative)
  function power() {
    const base = postfix();
    if (isOp('^')) { p++; const ex = unary(); return (s) => Math.pow(base(s), ex(s)); }
    return base;
  }
  function postfix() {
    let a = atom();
    while (isOp('!')) { p++; const f = a; a = (s) => factorial(f(s)); }
    return a;
  }
  function atom() {
    const tk = peek();
    if (!tk) throw new Error('Incomplete expression');
    if (tk.t === 'num') { p++; const v = tk.v; return () => v; }
    if (tk.t === 'var') {
      p++;
      const name = tk.v;
      return (s) => {
        if (!(name in s)) throw new Error(`Unknown variable "${name}"`);
        return s[name];
      };
    }
    if (tk.t === 'fn') {
      p++;
      let arg;
      if (isOp('(')) { p++; arg = expr(); expect(')'); } else arg = power();
      const f = tk.v;
      const fns = {
        sin: (x) => Math.sin(x * D), cos: (x) => Math.cos(x * D), tan: (x) => Math.tan(x * D),
        sec: (x) => 1 / Math.cos(x * D), csc: (x) => 1 / Math.sin(x * D), cot: (x) => 1 / Math.tan(x * D),
        asin: (x) => Math.asin(x) / D, acos: (x) => Math.acos(x) / D, atan: (x) => Math.atan(x) / D,
        sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp,
        floor: Math.floor, ceil: Math.ceil, round: Math.round,
      };
      const fn = fns[f];
      return (s) => fn(arg(s));
    }
    if (tk.t === 'op' && tk.v === '(') { p++; const e = expr(); expect(')'); return e; }
    throw new Error(`Unexpected "${tk.v}"`);
  }
  const fn = expr();
  if (p < toks.length) throw new Error(`Unexpected "${toks[p].v}"`);
  return fn;
}

export function evaluate(src, scope = {}, opts = {}) {
  return compile(src, opts)(scope);
}

/** Pretty-print a number: trims float noise, uses up to `digits` significant decimals. */
export function fmt(n, digits = 6) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '−∞';
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(4);
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(Object.is(r, -0) ? 0 : r);
}

/* ---------------- Statistics ---------------- */

export function parseList(text) {
  return String(text).split(/[\s,;]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n));
}

function quantileSorted(s, q) {
  // Mendenhall–Sincich style used in many PH textbooks: position = q(n+1)
  const n = s.length;
  const pos = q * (n + 1);
  if (pos <= 1) return s[0];
  if (pos >= n) return s[n - 1];
  const lo = Math.floor(pos);
  return s[lo - 1] + (pos - lo) * (s[lo] - s[lo - 1]);
}

export function stats(data) {
  const n = data.length;
  if (!n) return null;
  const s = [...data].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  const freq = new Map();
  for (const x of s) freq.set(x, (freq.get(x) || 0) + 1);
  const maxF = Math.max(...freq.values());
  const mode = maxF === 1 ? [] : [...freq].filter(([, f]) => f === maxF).map(([x]) => x);
  const ss = s.reduce((a, x) => a + (x - mean) ** 2, 0);
  const popVar = ss / n;
  const sampVar = n > 1 ? ss / (n - 1) : NaN;
  return {
    n, sum, mean, median, mode, min: s[0], max: s[n - 1], range: s[n - 1] - s[0],
    popVar, popSD: Math.sqrt(popVar), sampVar, sampSD: Math.sqrt(sampVar),
    q1: quantileSorted(s, 0.25), q3: quantileSorted(s, 0.75), sorted: s,
    meanDev: s.reduce((a, x) => a + Math.abs(x - mean), 0) / n,
  };
}

/* ---------------- Normal distribution ---------------- */

export function erf(x) {
  // Abramowitz & Stegun 7.1.26 with higher-precision series for small |x|
  const sign = Math.sign(x);
  x = Math.abs(x);
  if (x < 2.5) {
    let sum = x, term = x;
    for (let n = 1; n < 60; n++) {
      term *= -x * x / n;
      sum += term / (2 * n + 1);
    }
    return sign * (2 / Math.sqrt(Math.PI)) * sum;
  }
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

export const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/* ---------------- Number theory ---------------- */

export function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
export function lcm(a, b) { return a && b ? Math.abs(a * b) / gcd(a, b) : 0; }
export function mod(a, n) { return ((a % n) + n) % n; }

export function primeFactors(n) {
  n = Math.abs(Math.trunc(n));
  const f = [];
  if (n < 2) return f;
  for (let d = 2; d * d <= n; d++) while (n % d === 0) { f.push(d); n /= d; }
  if (n > 1) f.push(n);
  return f;
}

export function factorString(n) {
  const f = primeFactors(n);
  if (!f.length) return String(n);
  const counts = new Map();
  f.forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
  return [...counts].map(([p, c]) => (c > 1 ? `${p}${sup(c)}` : `${p}`)).join(' × ');
}

export const isPrime = (n) => n >= 2 && primeFactors(n).length === 1;

export function nPr(n, r) { if (r > n || r < 0) return 0; let x = 1; for (let i = 0; i < r; i++) x *= n - i; return x; }
export function nCr(n, r) {
  if (r > n || r < 0) return 0;
  r = Math.min(r, n - r);
  let x = 1;
  for (let i = 1; i <= r; i++) x = (x * (n - r + i)) / i;
  return Math.round(x);
}

export function fib(n) { let a = 0, b = 1; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return a; }

export function sup(n) {
  const m = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  return String(n).split('').map((c) => m[c] ?? c).join('');
}
export function sub(n) {
  const m = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
  return String(n).split('').map((c) => m[c] ?? c).join('');
}

export function simplifyFraction(n, d) {
  if (d === 0) return 'undefined';
  const g = gcd(n, d) || 1;
  let a = n / g, b = d / g;
  if (b < 0) { a = -a; b = -b; }
  return b === 1 ? `${a}` : `${a}/${b}`;
}

/* ---------------- Propositional logic ---------------- */

function lexLogic(src) {
  const s = src.replace(/<->|<=>|↔|≡/g, '↔').replace(/->|=>|→/g, '→')
    .replace(/[~¬!]/g, '¬').replace(/\^|&|∧/g, '∧').replace(/\|/g, '∨').replace(/⊕/g, '⊕');
  const toks = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\s/.test(c)) continue;
    if (c === 'v' || c === 'V' || c === '∨') toks.push('∨');
    else if ('¬∧→↔⊕()'.includes(c)) toks.push(c);
    else if (/[a-uw-zA-UW-Z]/.test(c)) toks.push(c.toLowerCase());
    else if (c === 'T' || c === 'F') toks.push(c);
    else throw new Error(`Unexpected "${c}"`);
  }
  return toks;
}

/** Parse a propositional formula into an AST. Precedence: ¬ > ∧ > ∨,⊕ > → > ↔ */
export function parseLogic(src) {
  const t = lexLogic(src);
  let p = 0;
  const node = (op, a, b) => ({ op, a, b });
  function iff() { let l = imp(); while (t[p] === '↔') { p++; l = node('↔', l, imp()); } return l; }
  function imp() { const l = or(); if (t[p] === '→') { p++; return node('→', l, imp()); } return l; }
  function or() { let l = and(); while (t[p] === '∨' || t[p] === '⊕') { const op = t[p++]; l = node(op, l, and()); } return l; }
  function and() { let l = not(); while (t[p] === '∧') { p++; l = node('∧', l, not()); } return l; }
  function not() { if (t[p] === '¬') { p++; return node('¬', not()); } return atom(); }
  function atom() {
    const c = t[p];
    if (c === undefined) throw new Error('Incomplete formula');
    if (c === '(') { p++; const e = iff(); if (t[p] !== ')') throw new Error('Missing ")"'); p++; return e; }
    if (/^[a-z]$/.test(c)) { p++; return { v: c }; }
    if (c === 'T' || c === 'F') { p++; return { c: c === 'T' }; }
    throw new Error(`Unexpected "${c}"`);
  }
  const ast = iff();
  if (p < t.length) throw new Error(`Unexpected "${t[p]}"`);
  return ast;
}

export function showLogic(n, top = true) {
  if (n.v) return n.v;
  if ('c' in n) return n.c ? 'T' : 'F';
  if (n.op === '¬') return `¬${showLogic(n.a, false)}`;
  const s = `${showLogic(n.a, false)} ${n.op} ${showLogic(n.b, false)}`;
  return top ? s : `(${s})`;
}

export function evalLogic(n, env) {
  if (n.v) return env[n.v];
  if ('c' in n) return n.c;
  const a = evalLogic(n.a, env);
  if (n.op === '¬') return !a;
  const b = evalLogic(n.b, env);
  switch (n.op) {
    case '∧': return a && b;
    case '∨': return a || b;
    case '⊕': return a !== b;
    case '→': return !a || b;
    case '↔': return a === b;
  }
  throw new Error('bad op');
}

export function truthTable(src) {
  const ast = parseLogic(src);
  const vars = new Set();
  const cols = [];
  const seen = new Set();
  (function walk(n) {
    if (n.v) { vars.add(n.v); return; }
    if ('c' in n) return;
    walk(n.a);
    if (n.b) walk(n.b);
    const label = showLogic(n);
    if (!seen.has(label)) { seen.add(label); cols.push({ label, node: n }); }
  })(ast);
  const vs = [...vars].sort();
  const rows = [];
  const total = 2 ** vs.length;
  for (let i = 0; i < total; i++) {
    const env = {};
    // textbook order: first row all T
    vs.forEach((v, k) => { env[v] = !((i >> (vs.length - 1 - k)) & 1); });
    rows.push({ vals: vs.map((v) => env[v]), cols: cols.map((c) => evalLogic(c.node, env)) });
  }
  const last = rows.map((r) => r.cols[r.cols.length - 1]);
  const kind = last.every(Boolean) ? 'Tautology' : last.every((x) => !x) ? 'Contradiction' : 'Contingency';
  return { vars: vs, cols: cols.map((c) => c.label), rows, kind };
}

/* ---------------- Sets ---------------- */

export function parseSet(text) {
  return [...new Set(String(text).replace(/[{}]/g, '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean))];
}
export function sortSet(arr) {
  return [...arr].sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });
}
export const showSet = (arr) => (arr.length ? `{ ${sortSet(arr).join(', ')} }` : '∅');

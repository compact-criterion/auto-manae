// Math tools for class: calculator, grapher, statistics, normal curve,
// quadratic solver, truth tables, sets, number theory, sequences,
// finance, counting, regression, and the DepEd transmutation table.

import {
  compile, evaluate, fmt, parseList, stats, normalCdf, gcd, lcm, mod, primeFactors, factorString, isPrime,
  nPr, nCr, fib, truthTable, parseSet, showSet, sortSet, simplifyFraction,
} from './mathcore.js';
import { transmute, depedDescriptor, transmutationRows, COLLEGE_SCALE_ROWS } from './grading.js';
import { h, icon } from './ui.js';

const TOOLS = [
  { id: 'calc', name: 'Scientific calculator', icon: icon.tools, view: calcTool },
  { id: 'graph', name: 'Graphing', icon: icon.graph, view: graphTool },
  { id: 'stats', name: 'Statistics', icon: icon.sigma, view: statsTool },
  { id: 'normal', name: 'Normal curve & z', icon: icon.bell, view: normalTool },
  { id: 'regress', name: 'Correlation & regression', icon: icon.scatter, view: regressTool },
  { id: 'quad', name: 'Quadratic solver', icon: icon.parabola, view: quadTool },
  { id: 'logic', name: 'Truth tables', icon: icon.logic, view: logicTool },
  { id: 'sets', name: 'Sets & Venn', icon: icon.venn, view: setsTool },
  { id: 'number', name: 'Number theory', icon: icon.hash, view: numberTool },
  { id: 'seq', name: 'Sequences & Fibonacci', icon: icon.seq, view: seqTool },
  { id: 'finance', name: 'Interest', icon: icon.peso, view: financeTool },
  { id: 'count', name: 'Counting', icon: icon.count, view: countTool },
  { id: 'transmute', name: 'Transmutation table', icon: icon.table, view: transmuteTool },
];

export const routes = [
  [/^\/tools$/, () => ({
    title: 'Math tools', tab: 'tools',
    html: `<ul class="tool-grid">${TOOLS.map((t) => `<li><a href="#/tools/${t.id}">${t.icon}<span>${h(t.name)}</span></a></li>`).join('')}</ul>`,
  })],
  [/^\/tools\/(\w+)$/, (id) => {
    const t = TOOLS.find((x) => x.id === id);
    if (!t) return null;
    const v = t.view();
    return { title: t.name, tab: 'tools', back: '#/tools', ...v };
  }],
];

/* helpers */
const num = (el, sel) => { const v = el.querySelector(sel).value.trim(); return v === '' ? NaN : evaluateSafe(v); };
function evaluateSafe(v) { try { return evaluate(v); } catch { return NaN; } }
const out = (rows) => `<dl class="results">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const err = (m) => `<p class="error">${h(m)}</p>`;
function live(el, inputsSel, fn) {
  const run = () => { try { fn(); } catch (e) { el.querySelector('.res').innerHTML = err(e.message); } };
  el.querySelectorAll(inputsSel).forEach((i) => i.addEventListener('input', run));
  el.querySelectorAll(inputsSel).forEach((i) => i.addEventListener('change', run));
  run();
}

/* ---------------- Calculator ---------------- */

const calcState = { expr: '', deg: true, ans: 0, hist: [] };

function calcTool() {
  const keys = [
    ['sin(', 'cos(', 'tan(', 'DEG'], ['asin(', 'acos(', 'atan(', 'π'],
    ['ln(', 'log(', '√(', '^'], ['(', ')', '!', 'e'],
    ['7', '8', '9', '÷'], ['4', '5', '6', '×'], ['1', '2', '3', '−'], ['0', '.', 'Ans', '+'],
    ['AC', '⌫', 'x²', '='],
  ];
  return {
    html: `
      <div class="calc">
        <div class="calc-screen"><input id="cExpr" value="${h(calcState.expr)}" aria-label="Expression" autocomplete="off" inputmode="none"><output id="cOut"></output></div>
        <div class="calc-keys">${keys.flat().map((k) => `<button data-k="${h(k)}" class="${/^[0-9.]$/.test(k) ? 'n' : k === '=' ? 'eq' : k === 'AC' ? 'ac' : ''}">${k === 'DEG' ? (calcState.deg ? 'DEG' : 'RAD') : h(k.replace('(', ''))}</button>`).join('')}</div>
        <button class="link" id="kbd">Use phone keyboard</button>
        <ul class="hist" id="cHist">${calcState.hist.map((x) => `<li><span>${h(x.e)}</span><b>= ${h(x.r)}</b></li>`).join('')}</ul>
      </div>`,
    mount(el) {
      const inp = el.querySelector('#cExpr'), o = el.querySelector('#cOut');
      const preview = () => {
        calcState.expr = inp.value;
        if (!inp.value.trim()) { o.textContent = ''; return; }
        try { o.textContent = '= ' + fmt(evaluate(inp.value, { A: calcState.ans }, { deg: calcState.deg }), 10); o.classList.remove('bad-text'); } catch { o.textContent = ''; }
      };
      const insert = (t) => {
        const s = inp.selectionStart ?? inp.value.length, e = inp.selectionEnd ?? inp.value.length;
        inp.value = inp.value.slice(0, s) + t + inp.value.slice(e);
        inp.setSelectionRange(s + t.length, s + t.length);
        preview();
      };
      el.querySelector('#kbd').addEventListener('click', () => { inp.setAttribute('inputmode', 'text'); inp.focus(); });
      inp.addEventListener('input', preview);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-k="="]').click(); } });
      el.querySelector('.calc-keys').addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const k = b.dataset.k;
        if (k === 'AC') { inp.value = ''; preview(); return; }
        if (k === '⌫') {
          const s = inp.selectionStart ?? inp.value.length;
          if (s > 0) { inp.value = inp.value.slice(0, s - 1) + inp.value.slice(s); inp.setSelectionRange(s - 1, s - 1); }
          preview(); return;
        }
        if (k === 'DEG') { calcState.deg = !calcState.deg; b.textContent = calcState.deg ? 'DEG' : 'RAD'; preview(); return; }
        if (k === '=') {
          try {
            const r = fmt(evaluate(inp.value, { A: calcState.ans }, { deg: calcState.deg }), 10);
            calcState.ans = Number(r) || evaluate(inp.value, { A: calcState.ans }, { deg: calcState.deg });
            calcState.hist.unshift({ e: inp.value, r });
            calcState.hist = calcState.hist.slice(0, 20);
            el.querySelector('#cHist').innerHTML = calcState.hist.map((x) => `<li><span>${h(x.e)}</span><b>= ${h(x.r)}</b></li>`).join('');
            inp.value = r;
            preview();
          } catch (ex) { o.textContent = ex.message; o.classList.add('bad-text'); }
          return;
        }
        insert({ 'Ans': 'A', 'x²': '^2', '√(': '√(' }[k] ?? k);
      });
      el.querySelector('#cHist').addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) { inp.value = li.querySelector('span').textContent; preview(); } });
      preview();
    },
  };
}

/* ---------------- Graphing ---------------- */

const graphState = { fns: ['x^2 - 2x - 3', '2x + 1', ''], xmin: -10, xmax: 10, ymin: -10, ymax: 10 };
const COLORS = ['#2563eb', '#dc2626', '#059669'];

function graphTool() {
  return {
    html: `
      ${graphState.fns.map((f, i) => `<div class="fn-row"><span class="swatch" style="background:${COLORS[i]}"></span><label for="f${i}">y${['₁', '₂', '₃'][i]} =</label><input id="f${i}" class="fn" value="${h(f)}" placeholder="e.g., sin(x), 1/x, sqrt(x)" autocomplete="off" autocapitalize="off"></div>`).join('')}
      <div class="graph-wrap"><canvas id="gc" aria-label="Graph"></canvas><div id="gTip" class="g-tip"></div></div>
      <div class="btn-row wrap">
        <button class="btn small" data-z="0.5">Zoom in</button><button class="btn small" data-z="2">Zoom out</button><button class="btn small" id="gReset">Reset</button><button class="btn small" id="gTable">${icon.table} Table of values</button>
      </div>
      <p class="hint">Drag to move. Tap the graph to read coordinates. Use x as the variable; trig is in radians here. Examples: x^3 - 4x, abs(x), 2^x, ln(x).</p>
      <div id="gRes"></div>`,
    mount(el) {
      const cv = el.querySelector('#gc');
      const ctx = cv.getContext('2d');
      const tip = el.querySelector('#gTip');
      let compiled = [];
      const recompile = () => {
        compiled = graphState.fns.map((f, i) => {
          const inp = el.querySelector(`#f${i}`);
          if (!f.trim()) { inp.classList.remove('bad'); return null; }
          try { const fn = compile(f); fn({ x: 1 }); inp.classList.remove('bad'); return fn; } catch { inp.classList.add('bad'); return null; }
        });
      };
      const css = getComputedStyle(document.body);
      const draw = () => {
        const dpr = window.devicePixelRatio || 1;
        const W = cv.clientWidth, H = cv.clientHeight;
        cv.width = W * dpr; cv.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const { xmin, xmax, ymin, ymax } = graphState;
        const X = (x) => ((x - xmin) / (xmax - xmin)) * W, Y = (y) => H - ((y - ymin) / (ymax - ymin)) * H;
        ctx.fillStyle = css.getPropertyValue('--surface').trim() || '#fff';
        ctx.fillRect(0, 0, W, H);
        const step = niceStep((xmax - xmin) / 8), ystep = niceStep((ymax - ymin) / 8);
        ctx.lineWidth = 1;
        ctx.strokeStyle = css.getPropertyValue('--grid').trim() || '#e5e7eb';
        ctx.fillStyle = css.getPropertyValue('--muted').trim() || '#666';
        ctx.font = '12px system-ui, sans-serif';
        for (let x = Math.ceil(xmin / step) * step; x <= xmax; x += step) { ctx.beginPath(); ctx.moveTo(X(x), 0); ctx.lineTo(X(x), H); ctx.stroke(); }
        for (let y = Math.ceil(ymin / ystep) * ystep; y <= ymax; y += ystep) { ctx.beginPath(); ctx.moveTo(0, Y(y)); ctx.lineTo(W, Y(y)); ctx.stroke(); }
        ctx.strokeStyle = css.getPropertyValue('--text').trim() || '#111';
        ctx.lineWidth = 1.5;
        const ax = Math.min(Math.max(Y(0), 0), H), ay = Math.min(Math.max(X(0), 0), W);
        ctx.beginPath(); ctx.moveTo(0, ax); ctx.lineTo(W, ax); ctx.moveTo(ay, 0); ctx.lineTo(ay, H); ctx.stroke();
        for (let x = Math.ceil(xmin / step) * step; x <= xmax; x += step) if (Math.abs(x) > step / 2) ctx.fillText(fmt(x, 4), X(x) + 2, Math.min(ax + 14, H - 4));
        for (let y = Math.ceil(ymin / ystep) * ystep; y <= ymax; y += ystep) if (Math.abs(y) > ystep / 2) ctx.fillText(fmt(y, 4), Math.min(ay + 4, W - 30), Y(y) - 3);
        compiled.forEach((fn, i) => {
          if (!fn) return;
          ctx.strokeStyle = COLORS[i];
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          let pen = false, prevY = null;
          for (let px = 0; px <= W; px += 1) {
            const x = xmin + (px / W) * (xmax - xmin);
            let y;
            try { y = fn({ x }); } catch { y = NaN; }
            if (!Number.isFinite(y) || (prevY !== null && Math.abs(Y(y) - Y(prevY)) > H * 2)) { pen = false; prevY = Number.isFinite(y) ? y : null; continue; }
            const py = Y(y);
            if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
            prevY = y;
          }
          ctx.stroke();
        });
      };
      el.querySelectorAll('.fn').forEach((inp, i) => inp.addEventListener('input', () => { graphState.fns[i] = inp.value; recompile(); draw(); }));
      el.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => { zoom(Number(b.dataset.z)); draw(); }));
      el.querySelector('#gReset').addEventListener('click', () => { Object.assign(graphState, { xmin: -10, xmax: 10, ymin: -10, ymax: 10 }); draw(); });
      el.querySelector('#gTable').addEventListener('click', () => {
        const xs = []; for (let x = -5; x <= 5; x++) xs.push(x);
        const active = compiled.map((f, i) => [f, i]).filter(([f]) => f);
        el.querySelector('#gRes').innerHTML = active.length ? `<div class="table-wrap"><table class="grid compact"><thead><tr><th>x</th>${active.map(([, i]) => `<th style="color:${COLORS[i]}">y${['₁', '₂', '₃'][i]}</th>`).join('')}</tr></thead><tbody>${xs.map((x) => `<tr><td>${x}</td>${active.map(([f]) => { let y; try { y = f({ x }); } catch { y = NaN; } return `<td>${Number.isFinite(y) ? fmt(y, 4) : 'undef.'}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : '';
      });
      function zoom(k, cx, cy) {
        const { xmin, xmax, ymin, ymax } = graphState;
        cx ??= (xmin + xmax) / 2; cy ??= (ymin + ymax) / 2;
        Object.assign(graphState, { xmin: cx + (xmin - cx) * k, xmax: cx + (xmax - cx) * k, ymin: cy + (ymin - cy) * k, ymax: cy + (ymax - cy) * k });
      }
      // pan / tap / pinch
      const pts = new Map();
      let start = null, moved = false, pinch = null;
      cv.addEventListener('pointerdown', (e) => {
        cv.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
        moved = false;
        start = { x: e.offsetX, y: e.offsetY, s: { ...graphState } };
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: { ...graphState } }; }
      });
      cv.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
        const W = cv.clientWidth, H = cv.clientHeight;
        if (pts.size === 2 && pinch) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const k = pinch.d / Math.max(d, 1);
          const s = pinch.s;
          const cx = (s.xmin + s.xmax) / 2, cy = (s.ymin + s.ymax) / 2;
          Object.assign(graphState, { xmin: cx + (s.xmin - cx) * k, xmax: cx + (s.xmax - cx) * k, ymin: cy + (s.ymin - cy) * k, ymax: cy + (s.ymax - cy) * k });
          moved = true; draw(); return;
        }
        const dx = e.offsetX - start.x, dy = e.offsetY - start.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (!moved) return;
        const s = start.s;
        const ux = ((s.xmax - s.xmin) / W) * dx, uy = ((s.ymax - s.ymin) / H) * dy;
        Object.assign(graphState, { xmin: s.xmin - ux, xmax: s.xmax - ux, ymin: s.ymin + uy, ymax: s.ymax + uy });
        draw();
      });
      const end = (e) => {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (!moved && e.type === 'pointerup') {
          const W = cv.clientWidth, H = cv.clientHeight;
          const x = graphState.xmin + (e.offsetX / W) * (graphState.xmax - graphState.xmin);
          const y = graphState.ymax - (e.offsetY / H) * (graphState.ymax - graphState.ymin);
          const vals = compiled.map((f, i) => { if (!f) return ''; let v; try { v = f({ x }); } catch { v = NaN; } return `<span style="color:${COLORS[i]}">y${['₁', '₂', '₃'][i]}(${fmt(x, 2)}) = ${Number.isFinite(v) ? fmt(v, 3) : 'undef.'}</span>`; }).filter(Boolean).join('<br>');
          tip.innerHTML = `(${fmt(x, 2)}, ${fmt(y, 2)})${vals ? '<br>' + vals : ''}`;
          tip.style.display = 'block';
        }
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      const ro = new ResizeObserver(draw);
      ro.observe(cv);
      recompile();
      draw();
      return () => ro.disconnect();
    },
  };
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/* ---------------- Statistics ---------------- */

function statsTool() {
  return {
    html: `
      <div class="field"><label for="sData">Data (separate with spaces, commas, or new lines)</label><textarea id="sData" rows="4" inputmode="decimal">85 90 78 92 88 76 95 89 84 90</textarea></div>
      <div class="field"><label for="sX">Find the z-score of a value (optional)</label><input id="sX" inputmode="decimal" placeholder="e.g., 92"></div>
      <div class="res"></div>`,
    mount(el) {
      live(el, 'textarea,input', () => {
        const d = parseList(el.querySelector('#sData').value);
        const s = stats(d);
        if (!s) { el.querySelector('.res').innerHTML = err('Enter some numbers.'); return; }
        const x = Number(el.querySelector('#sX').value);
        const freq = new Map(); s.sorted.forEach((v) => freq.set(v, (freq.get(v) || 0) + 1));
        el.querySelector('.res').innerHTML = out([
          ['n', s.n], ['Sum Σx', fmt(s.sum)], ['Mean x̄', fmt(s.mean, 4)], ['Median', fmt(s.median, 4)],
          ['Mode', s.mode.length ? s.mode.map((m) => fmt(m)).join(', ') : 'none'],
          ['Range', `${fmt(s.range)}  (${fmt(s.min)} to ${fmt(s.max)})`],
          ['Q₁ · Q₃', `${fmt(s.q1, 4)} · ${fmt(s.q3, 4)}  (IQR ${fmt(s.q3 - s.q1, 4)})`],
          ['Mean absolute deviation', fmt(s.meanDev, 4)],
          ['Population σ² · σ', `${fmt(s.popVar, 4)} · ${fmt(s.popSD, 4)}`],
          ['Sample s² · s', `${fmt(s.sampVar, 4)} · ${fmt(s.sampSD, 4)}`],
          ['Coefficient of variation', s.mean ? fmt((s.sampSD / s.mean) * 100, 2) + '%' : '—'],
          Number.isFinite(x) && el.querySelector('#sX').value.trim() ? ['z of ' + fmt(x), `${fmt((x - s.mean) / s.sampSD, 4)} (sample s) · ${fmt((x - s.mean) / s.popSD, 4)} (population σ)`] : null,
        ]) + `<h3>Sorted data</h3><p class="mono">${s.sorted.map((v) => fmt(v)).join(', ')}</p>
        <h3>Frequency</h3><div class="table-wrap"><table class="grid compact"><thead><tr><th>x</th><th>f</th><th>cf</th><th>%</th></tr></thead><tbody>${(() => { let cf = 0; return [...freq].map(([v, f]) => { cf += f; return `<tr><td>${fmt(v)}</td><td>${f}</td><td>${cf}</td><td>${fmt((f / s.n) * 100, 2)}</td></tr>`; }).join(''); })()}</tbody></table></div>
        <p class="hint">Quartiles use the position k(n+1)/4, as in most Philippine textbooks.</p>`;
      });
    },
  };
}

/* ---------------- Normal curve ---------------- */

function normalTool() {
  return {
    html: `
      <div class="seg" id="nMode"><a href="javascript:void 0" data-m="between" class="on">Between</a><a href="javascript:void 0" data-m="left">Left of</a><a href="javascript:void 0" data-m="right">Right of</a></div>
      <div class="grid2">
        <div class="field"><label for="z1">z₁</label><input id="z1" inputmode="decimal" value="-1"></div>
        <div class="field"><label for="z2">z₂</label><input id="z2" inputmode="decimal" value="1"></div>
      </div>
      <canvas id="nc" class="curve" aria-label="Normal curve with shaded area"></canvas>
      <div class="res"></div>
      <section class="panel">
        <h3>Convert a raw score to z</h3>
        <div class="grid3">
          <div class="field"><label for="nx">x</label><input id="nx" inputmode="decimal" value="85"></div>
          <div class="field"><label for="nmu">μ</label><input id="nmu" inputmode="decimal" value="75"></div>
          <div class="field"><label for="nsd">σ</label><input id="nsd" inputmode="decimal" value="5"></div>
        </div>
        <div class="res2"></div>
      </section>`,
    mount(el) {
      let mode = 'between';
      el.querySelectorAll('#nMode a').forEach((a) => a.addEventListener('click', () => {
        mode = a.dataset.m;
        el.querySelectorAll('#nMode a').forEach((x) => x.classList.toggle('on', x === a));
        el.querySelector('#z2').closest('.field').hidden = mode !== 'between';
        run();
      }));
      const cv = el.querySelector('#nc');
      const run = () => {
        const z1 = Number(el.querySelector('#z1').value), z2 = Number(el.querySelector('#z2').value);
        if (!Number.isFinite(z1) || (mode === 'between' && !Number.isFinite(z2))) { el.querySelector('.res').innerHTML = err('Enter z values.'); return; }
        let a, b, area;
        if (mode === 'between') { a = Math.min(z1, z2); b = Math.max(z1, z2); area = normalCdf(b) - normalCdf(a); }
        else if (mode === 'left') { a = -5; b = z1; area = normalCdf(z1); }
        else { a = z1; b = 5; area = 1 - normalCdf(z1); }
        el.querySelector('.res').innerHTML = out([
          ['Area / probability', `<b>${area.toFixed(4)}</b>  (${(area * 100).toFixed(2)}%)`],
          mode === 'between' ? ['P(' + fmt(a) + ' < z < ' + fmt(b) + ')', area.toFixed(4)] : null,
          ['Area from 0 to z₁ (table value)', Math.abs(normalCdf(z1) - 0.5).toFixed(4)],
        ]);
        drawCurve(cv, a, b);
      };
      const run2 = () => {
        const x = Number(el.querySelector('#nx').value), mu = Number(el.querySelector('#nmu').value), sd = Number(el.querySelector('#nsd').value);
        el.querySelector('.res2').innerHTML = sd > 0 ? out([['z = (x − μ) / σ', `<b>${fmt((x - mu) / sd, 4)}</b>`], ['Percentile (area to the left)', `${(normalCdf((x - mu) / sd) * 100).toFixed(2)}%`]]) : err('σ must be positive');
      };
      el.querySelectorAll('#z1,#z2').forEach((i) => i.addEventListener('input', run));
      el.querySelectorAll('#nx,#nmu,#nsd').forEach((i) => i.addEventListener('input', run2));
      const ro = new ResizeObserver(run); ro.observe(cv);
      run(); run2();
      return () => ro.disconnect();
    },
  };
}

function drawCurve(cv, a, b) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (!W) return;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(document.body);
  const X = (z) => ((z + 4) / 8) * W, f = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI), Y = (y) => H - 22 - (y / 0.42) * (H - 30);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = css.getPropertyValue('--accent-soft').trim() || '#bfdbfe';
  ctx.beginPath(); ctx.moveTo(X(Math.max(a, -4)), Y(0));
  for (let z = Math.max(a, -4); z <= Math.min(b, 4); z += 0.02) ctx.lineTo(X(z), Y(f(z)));
  ctx.lineTo(X(Math.min(b, 4)), Y(0)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = css.getPropertyValue('--accent').trim() || '#2563eb'; ctx.lineWidth = 2;
  ctx.beginPath(); for (let z = -4; z <= 4; z += 0.02) { z === -4 ? ctx.moveTo(X(z), Y(f(z))) : ctx.lineTo(X(z), Y(f(z))); } ctx.stroke();
  ctx.strokeStyle = css.getPropertyValue('--muted').trim(); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke();
  ctx.fillStyle = css.getPropertyValue('--muted').trim(); ctx.font = '12px system-ui'; ctx.textAlign = 'center';
  for (let z = -3; z <= 3; z++) ctx.fillText(String(z), X(z), H - 6);
}

/* ---------------- Regression ---------------- */

function regressTool() {
  return {
    html: `
      <div class="field"><label for="rx">x values</label><textarea id="rx" rows="2" inputmode="decimal">1 2 3 4 5 6</textarea></div>
      <div class="field"><label for="ry">y values</label><textarea id="ry" rows="2" inputmode="decimal">65 70 72 80 85 88</textarea></div>
      <div class="field"><label for="rp">Predict y for x = (optional)</label><input id="rp" inputmode="decimal" placeholder="e.g., 7"></div>
      <div class="res"></div>`,
    mount(el) {
      live(el, 'textarea,input', () => {
        const x = parseList(el.querySelector('#rx').value), y = parseList(el.querySelector('#ry').value);
        if (x.length !== y.length) { el.querySelector('.res').innerHTML = err(`x has ${x.length} values but y has ${y.length}.`); return; }
        const n = x.length;
        if (n < 2) { el.querySelector('.res').innerHTML = err('Enter at least two pairs.'); return; }
        const sx = x.reduce((a, b) => a + b, 0), sy = y.reduce((a, b) => a + b, 0);
        const sxy = x.reduce((a, v, i) => a + v * y[i], 0), sx2 = x.reduce((a, v) => a + v * v, 0), sy2 = y.reduce((a, v) => a + v * v, 0);
        const den = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
        const r = den ? (n * sxy - sx * sy) / den : NaN;
        const b = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
        const a = (sy - b * sx) / n;
        const ar = Math.abs(r);
        const strength = ar === 1 ? 'perfect' : ar >= 0.8 ? 'very strong' : ar >= 0.6 ? 'strong' : ar >= 0.4 ? 'moderate' : ar >= 0.2 ? 'weak' : ar > 0 ? 'very weak / negligible' : 'no';
        const p = Number(el.querySelector('#rp').value);
        el.querySelector('.res').innerHTML = out([
          ['n', n], ['Σx · Σy', `${fmt(sx)} · ${fmt(sy)}`], ['Σxy · Σx² · Σy²', `${fmt(sxy)} · ${fmt(sx2)} · ${fmt(sy2)}`],
          ['Pearson r', `<b>${fmt(r, 4)}</b>`], ['Interpretation', `${strength} ${r > 0 ? 'positive' : r < 0 ? 'negative' : ''} correlation`],
          ['r² (coefficient of determination)', fmt(r * r, 4)],
          ['Regression line', `ŷ = ${fmt(a, 4)} ${b < 0 ? '−' : '+'} ${fmt(Math.abs(b), 4)}x`],
          el.querySelector('#rp').value.trim() && Number.isFinite(p) ? [`ŷ when x = ${fmt(p)}`, `<b>${fmt(a + b * p, 4)}</b>`] : null,
        ]);
      });
    },
  };
}

/* ---------------- Quadratic ---------------- */

function quadTool() {
  return {
    html: `
      <p class="center big-eq">ax² + bx + c = 0</p>
      <div class="grid3">
        <div class="field"><label for="qa">a</label><input id="qa" inputmode="decimal" value="1"></div>
        <div class="field"><label for="qb">b</label><input id="qb" inputmode="decimal" value="-5"></div>
        <div class="field"><label for="qc">c</label><input id="qc" inputmode="decimal" value="6"></div>
      </div>
      <div class="res"></div>`,
    mount(el) {
      live(el, 'input', () => {
        const a = num(el, '#qa'), b = num(el, '#qb'), c = num(el, '#qc');
        if (![a, b, c].every(Number.isFinite)) { el.querySelector('.res').innerHTML = err('Enter a, b, and c.'); return; }
        if (a === 0) { el.querySelector('.res').innerHTML = err('a cannot be 0 (that is a linear equation).') + (b ? out([['x', fmt(-c / b, 6)]]) : ''); return; }
        const D = b * b - 4 * a * c;
        const h2 = -b / (2 * a), k = c - (b * b) / (4 * a);
        let roots, nature;
        if (D > 0) {
          const s = Math.sqrt(D);
          roots = `x₁ = ${fmt((-b + s) / (2 * a), 6)}, x₂ = ${fmt((-b - s) / (2 * a), 6)}`;
          nature = Number.isInteger(s) && [a, b, c].every(Number.isInteger) ? 'real, rational, unequal' : 'real, irrational, unequal';
        } else if (D === 0) { roots = `x = ${fmt(h2, 6)} (double root)`; nature = 'real, rational, equal'; }
        else { const im = Math.sqrt(-D) / (2 * a); roots = `x = ${fmt(h2, 6)} ± ${fmt(Math.abs(im), 6)}i`; nature = 'not real (complex conjugates)'; }
        const exact = [a, b, c].every(Number.isInteger) && D >= 0 ? exactRoots(a, b, D) : '';
        el.querySelector('.res').innerHTML = out([
          ['Discriminant b² − 4ac', `${fmt(D)}`], ['Nature of roots', nature], ['Roots', `<b>${roots}</b>`], exact ? ['Exact form', exact] : null,
          ['Sum of roots −b/a', fmt(-b / a, 6)], ['Product of roots c/a', fmt(c / a, 6)],
          ['Vertex (h, k)', `(${fmt(h2, 4)}, ${fmt(k, 4)})`], ['Axis of symmetry', `x = ${fmt(h2, 4)}`],
          ['Opens', a > 0 ? 'upward (minimum)' : 'downward (maximum)'], ['y-intercept', fmt(c)],
          ['Vertex form', `y = ${fmt(a)}(x ${h2 < 0 ? '+' : '−'} ${fmt(Math.abs(h2), 4)})² ${k < 0 ? '−' : '+'} ${fmt(Math.abs(k), 4)}`],
        ]);
      });
    },
  };
}

function exactRoots(a, b, D) {
  // simplify √D = m√r
  let m = 1, r = D;
  for (let i = 2; i * i <= r; i++) while (r % (i * i) === 0) { r /= i * i; m *= i; }
  const den = 2 * a;
  if (r === 1 || D === 0) return `x = ${simplifyFraction(-b + m * (D ? 1 : 0), den)}${D ? ` or ${simplifyFraction(-b - m, den)}` : ''}`;
  const g = gcd(gcd(b, m), den);
  const B = -b / g, M = m / g, Dn = den / g;
  const sign = Dn < 0 ? -1 : 1;
  const top = `${B * sign === 0 ? '' : B * sign + ' '}± ${M === 1 ? '' : Math.abs(M)}√${r}`;
  return Math.abs(Dn) === 1 ? `x = ${top}` : `x = (${top}) / ${Math.abs(Dn)}`;
}

/* ---------------- Logic ---------------- */

function logicTool() {
  const sym = ['¬', '∧', '∨', '→', '↔', '⊕', '(', ')', 'p', 'q', 'r', 's'];
  return {
    html: `
      <div class="field"><label for="lf">Proposition</label><input id="lf" value="(p → q) ∧ (q → r) → (p → r)" autocomplete="off" autocapitalize="off"></div>
      <div class="sym-keys">${sym.map((s) => `<button data-s="${s}">${s}</button>`).join('')}<button data-s="⌫">⌫</button></div>
      <p class="hint">You may also type ~ (not), ^ or &amp; (and), v or | (or), -&gt; (if…then), &lt;-&gt; (if and only if).</p>
      <div class="res"></div>`,
    mount(el) {
      const inp = el.querySelector('#lf');
      el.querySelector('.sym-keys').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        const s = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? inp.value.length;
        if (b.dataset.s === '⌫') { if (s > 0) { inp.value = inp.value.slice(0, s - 1) + inp.value.slice(en); inp.setSelectionRange(s - 1, s - 1); } }
        else { const t = /[∧∨→↔⊕]/.test(b.dataset.s) ? ` ${b.dataset.s} ` : b.dataset.s; inp.value = inp.value.slice(0, s) + t + inp.value.slice(en); inp.setSelectionRange(s + t.length, s + t.length); }
        inp.dispatchEvent(new Event('input'));
      });
      live(el, '#lf', () => {
        const t = truthTable(inp.value);
        if (t.vars.length > 5) throw new Error('Use at most 5 variables.');
        const TF = (v) => `<td class="${v ? 'tv' : 'fv'}">${v ? 'T' : 'F'}</td>`;
        el.querySelector('.res').innerHTML = `
          <p class="verdict ${t.kind === 'Tautology' ? 'pass' : t.kind === 'Contradiction' ? 'fail' : ''}"><b>${t.kind}</b></p>
          <div class="table-wrap"><table class="grid tt"><thead><tr>${t.vars.map((v) => `<th>${v}</th>`).join('')}${t.cols.map((c, i) => `<th class="${i === t.cols.length - 1 ? 'final' : ''}">${h(c)}</th>`).join('')}</tr></thead>
          <tbody>${t.rows.map((r) => `<tr>${r.vals.map(TF).join('')}${r.cols.map(TF).join('')}</tr>`).join('')}</tbody></table></div>`;
      });
    },
  };
}

/* ---------------- Sets ---------------- */

function setsTool() {
  return {
    html: `
      <div class="field"><label for="sU">Universal set U (optional)</label><input id="sU" value="1, 2, 3, 4, 5, 6, 7, 8, 9, 10"></div>
      <div class="field"><label for="sA">Set A</label><input id="sA" value="1, 2, 3, 4, 5"></div>
      <div class="field"><label for="sB">Set B</label><input id="sB" value="2, 4, 6, 8, 10"></div>
      <div class="res"></div>`,
    mount(el) {
      live(el, 'input', () => {
        const U = parseSet(el.querySelector('#sU').value), A = parseSet(el.querySelector('#sA').value), B = parseSet(el.querySelector('#sB').value);
        const inB = new Set(B), inA = new Set(A);
        const uni = sortSet([...new Set([...A, ...B])]), inter = A.filter((x) => inB.has(x));
        const aMinusB = A.filter((x) => !inB.has(x)), bMinusA = B.filter((x) => !inA.has(x));
        const comp = (S) => (U.length ? U.filter((x) => !S.includes(x)) : null);
        const sub = A.every((x) => inB.has(x));
        el.querySelector('.res').innerHTML = venn(aMinusB, inter, bMinusA, U.length ? U.filter((x) => !inA.has(x) && !inB.has(x)) : null) + out([
          ['A ∪ B', `${showSet(uni)}  · n = ${uni.length}`], ['A ∩ B', `${showSet(inter)}  · n = ${inter.length}`],
          ['A − B', showSet(aMinusB)], ['B − A', showSet(bMinusA)], ['A △ B (symmetric difference)', showSet([...aMinusB, ...bMinusA])],
          U.length ? ["A′", showSet(comp(A))] : null, U.length ? ["B′", showSet(comp(B))] : null, U.length ? ["(A ∪ B)′", showSet(comp(uni))] : null,
          ['n(A), n(B)', `${A.length}, ${B.length}`], ['Number of subsets of A', `2${'^'}${A.length} = ${2 ** A.length}`],
          ['A ⊆ B?', sub ? 'Yes' : 'No'], ['Disjoint?', inter.length ? 'No' : 'Yes'],
          U.length && [...A, ...B].some((x) => !U.includes(x)) ? ['Note', 'Some elements of A or B are not in U.'] : null,
        ]);
      });
    },
  };
}

function venn(a, ab, b, outside) {
  const t = (arr) => h(sortSet(arr).slice(0, 8).join(', ') + (arr.length > 8 ? '…' : ''));
  return `<svg class="venn" viewBox="0 0 320 190" role="img" aria-label="Venn diagram">
    <rect x="2" y="2" width="316" height="186" rx="10" class="vu"/>
    <text x="12" y="20" class="vl">U</text>
    <circle cx="120" cy="100" r="70" class="va"/><circle cx="200" cy="100" r="70" class="vb"/>
    <text x="80" y="38" class="vl">A</text><text x="236" y="38" class="vl">B</text>
    <foreignObject x="58" y="70" width="70" height="60"><div class="vt">${t(a)}</div></foreignObject>
    <foreignObject x="132" y="70" width="56" height="60"><div class="vt">${t(ab)}</div></foreignObject>
    <foreignObject x="192" y="70" width="70" height="60"><div class="vt">${t(b)}</div></foreignObject>
    ${outside ? `<foreignObject x="200" y="160" width="115" height="26"><div class="vt">${t(outside)}</div></foreignObject>` : ''}
  </svg>`;
}

/* ---------------- Number theory ---------------- */

function numberTool() {
  return {
    html: `
      <section class="panel"><h3>One number</h3>
        <div class="field"><label for="nn">n</label><input id="nn" inputmode="numeric" value="360"></div><div class="res r1"></div></section>
      <section class="panel"><h3>Two numbers</h3>
        <div class="grid2"><div class="field"><label for="na">a</label><input id="na" inputmode="numeric" value="84"></div><div class="field"><label for="nb">b</label><input id="nb" inputmode="numeric" value="36"></div></div>
        <div class="res r2"></div></section>
      <section class="panel"><h3>Base conversion</h3>
        <div class="grid2"><div class="field"><label for="bv">Number</label><input id="bv" value="2026" autocapitalize="characters"></div>
        <div class="field"><label for="bf">From base</label><input id="bf" inputmode="numeric" value="10"></div></div>
        <div class="res r3"></div></section>`,
    mount(el) {
      const run1 = () => {
        const n = Math.trunc(Number(el.querySelector('#nn').value));
        const r = el.querySelector('.r1');
        if (!Number.isFinite(n) || n < 1 || n > 1e12) { r.innerHTML = err('Enter a whole number from 1 to 10¹².'); return; }
        const divs = []; for (let d = 1; d * d <= n; d++) if (n % d === 0) { divs.push(d); if (d * d !== n) divs.push(n / d); }
        divs.sort((a, b) => a - b);
        const sum = divs.reduce((a, b) => a + b, 0) - n;
        r.innerHTML = out([
          ['Prime?', isPrime(n) ? '<b>Yes, prime</b>' : n === 1 ? 'Neither prime nor composite' : 'No, composite'],
          ['Prime factorization', factorString(n)], ['Number of divisors', divs.length],
          ['Divisors', divs.length <= 60 ? divs.join(', ') : divs.slice(0, 60).join(', ') + '…'],
          ['Sum of proper divisors', `${sum} → ${sum === n ? 'perfect' : sum > n ? 'abundant' : 'deficient'} number`],
          ['Binary · Octal · Hex', `${n.toString(2)} · ${n.toString(8)} · ${n.toString(16).toUpperCase()}`],
        ]);
      };
      const run2 = () => {
        const a = Math.trunc(Number(el.querySelector('#na').value)), b = Math.trunc(Number(el.querySelector('#nb').value));
        const r = el.querySelector('.r2');
        if (!Number.isFinite(a) || !Number.isFinite(b)) { r.innerHTML = err('Enter two whole numbers.'); return; }
        const steps = []; let x = Math.abs(a), y = Math.abs(b);
        while (y && steps.length < 20) { steps.push(`${x} = ${Math.floor(x / y)} × ${y} + ${x % y}`); [x, y] = [y, x % y]; }
        r.innerHTML = out([
          ['GCD', `<b>${gcd(a, b)}</b>`], ['LCM', `<b>${lcm(a, b)}</b>`],
          ['a mod b', b ? mod(a, b) : '—'], ['a ÷ b', b ? `${Math.trunc(a / b)} remainder ${a % b}` : '—'],
          ['Relatively prime?', gcd(a, b) === 1 ? 'Yes' : 'No'],
        ]) + (steps.length ? `<h3>Euclidean algorithm</h3><ol class="mono small">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>` : '');
      };
      const run3 = () => {
        const v = el.querySelector('#bv').value.trim(), f = Number(el.querySelector('#bf').value);
        const r = el.querySelector('.r3');
        if (!(f >= 2 && f <= 36)) { r.innerHTML = err('Base must be 2 to 36.'); return; }
        const valid = [...v.toLowerCase()].every((c) => { const d = parseInt(c, 36); return !Number.isNaN(d) && d < f; });
        const n = parseInt(v, f);
        if (!valid || !Number.isFinite(n)) { r.innerHTML = err(`"${v}" is not a valid base-${f} number.`); return; }
        r.innerHTML = out([[`Base 10`, n], ['Base 2', n.toString(2)], ['Base 5', n.toString(5)], ['Base 8', n.toString(8)], ['Base 12', n.toString(12).toUpperCase()], ['Base 16', n.toString(16).toUpperCase()]]);
      };
      el.querySelector('#nn').addEventListener('input', run1);
      el.querySelectorAll('#na,#nb').forEach((i) => i.addEventListener('input', run2));
      el.querySelectorAll('#bv,#bf').forEach((i) => i.addEventListener('input', run3));
      run1(); run2(); run3();
    },
  };
}

/* ---------------- Sequences ---------------- */

function seqTool() {
  return {
    html: `
      <div class="seg" id="sqMode"><a href="javascript:void 0" data-m="arith" class="on">Arithmetic</a><a href="javascript:void 0" data-m="geo">Geometric</a><a href="javascript:void 0" data-m="fib">Fibonacci</a></div>
      <div class="grid3" id="sqIn">
        <div class="field"><label for="sa1">a₁</label><input id="sa1" inputmode="decimal" value="3"></div>
        <div class="field"><label for="sd" id="sdl">d</label><input id="sd" inputmode="decimal" value="4"></div>
        <div class="field"><label for="sn">n</label><input id="sn" inputmode="numeric" value="10"></div>
      </div>
      <div class="res"></div>`,
    mount(el) {
      let mode = 'arith';
      el.querySelectorAll('#sqMode a').forEach((a) => a.addEventListener('click', () => {
        mode = a.dataset.m;
        el.querySelectorAll('#sqMode a').forEach((x) => x.classList.toggle('on', x === a));
        el.querySelector('#sdl').textContent = mode === 'geo' ? 'r' : 'd';
        el.querySelector('#sa1').closest('.field').hidden = mode === 'fib';
        el.querySelector('#sd').closest('.field').hidden = mode === 'fib';
        if (mode === 'geo') el.querySelector('#sd').value = '2';
        if (mode === 'arith') el.querySelector('#sd').value = '4';
        run();
      }));
      const run = () => {
        const a1 = num(el, '#sa1'), d = num(el, '#sd'), n = Math.trunc(Number(el.querySelector('#sn').value));
        const r = el.querySelector('.res');
        if (!(n >= 1 && n <= 1000)) { r.innerHTML = err('n must be from 1 to 1000.'); return; }
        if (mode === 'fib') {
          const terms = Array.from({ length: Math.min(n, 40) }, (_, i) => fib(i + 1));
          r.innerHTML = out([[`F${n}`, `<b>${n <= 78 ? fib(n) : fmt(fib(n))}</b>`], ['Sum of first n', n <= 76 ? fib(n + 2) - 1 : '—'], [`F${n + 1} ÷ F${n}`, fmt(fib(n + 1) / fib(n), 8)], ['Golden ratio φ', fmt((1 + Math.sqrt(5)) / 2, 8)]]) +
            `<h3>Terms</h3><p class="mono">${terms.join(', ')}${n > 40 ? ', …' : ''}</p>`;
          return;
        }
        if (![a1, d].every(Number.isFinite)) { r.innerHTML = err('Enter a₁ and ' + (mode === 'geo' ? 'r' : 'd') + '.'); return; }
        const term = (k) => (mode === 'arith' ? a1 + (k - 1) * d : a1 * d ** (k - 1));
        const Sn = mode === 'arith' ? (n / 2) * (2 * a1 + (n - 1) * d) : d === 1 ? a1 * n : (a1 * (1 - d ** n)) / (1 - d);
        const terms = Array.from({ length: Math.min(n, 15) }, (_, i) => fmt(term(i + 1)));
        r.innerHTML = out([
          [mode === 'arith' ? 'aₙ = a₁ + (n − 1)d' : 'aₙ = a₁·rⁿ⁻¹', `a${n} = <b>${fmt(term(n))}</b>`],
          [mode === 'arith' ? 'Sₙ = n/2 [2a₁ + (n − 1)d]' : 'Sₙ = a₁(1 − rⁿ)/(1 − r)', `S${n} = <b>${fmt(Sn)}</b>`],
          mode === 'geo' && Math.abs(d) < 1 ? ['Infinite sum a₁/(1 − r)', fmt(a1 / (1 - d))] : null,
          mode === 'geo' && Math.abs(d) >= 1 ? ['Infinite sum', 'diverges (|r| ≥ 1)'] : null,
        ]) + `<h3>First terms</h3><p class="mono">${terms.join(', ')}${n > 15 ? ', …' : ''}</p>`;
      };
      el.querySelectorAll('#sqIn input').forEach((i) => i.addEventListener('input', run));
      run();
    },
  };
}

/* ---------------- Finance ---------------- */

function financeTool() {
  return {
    html: `
      <div class="grid2">
        <div class="field"><label for="fP">Principal P (₱)</label><input id="fP" inputmode="decimal" value="10000"></div>
        <div class="field"><label for="fr">Annual rate r (%)</label><input id="fr" inputmode="decimal" value="5"></div>
        <div class="field"><label for="ft">Time t (years)</label><input id="ft" inputmode="decimal" value="3"></div>
        <div class="field"><label for="fm">Compounded</label><select id="fm"><option value="1">annually (m = 1)</option><option value="2">semi-annually (m = 2)</option><option value="4" selected>quarterly (m = 4)</option><option value="12">monthly (m = 12)</option><option value="365">daily (m = 365)</option></select></div>
      </div>
      <div class="res"></div>`,
    mount(el) {
      const peso = (n) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      live(el, 'input,select', () => {
        const P = num(el, '#fP'), r = num(el, '#fr') / 100, t = num(el, '#ft'), m = Number(el.querySelector('#fm').value);
        if (![P, r, t].every(Number.isFinite)) { el.querySelector('.res').innerHTML = err('Enter P, r, and t.'); return; }
        const Is = P * r * t, Fc = P * (1 + r / m) ** (m * t), Fcont = P * Math.exp(r * t);
        el.querySelector('.res').innerHTML = `<h3>Simple interest  (I = Prt)</h3>` + out([['Interest I', peso(Is)], ['Maturity value F = P + I', `<b>${peso(P + Is)}</b>`]]) +
          `<h3>Compound interest  (F = P(1 + r/m)<sup>mt</sup>)</h3>` + out([['Future value F', `<b>${peso(Fc)}</b>`], ['Compound interest', peso(Fc - P)], ['Effective annual rate', fmt(((1 + r / m) ** m - 1) * 100, 4) + '%'], ['Continuous compounding Pe^(rt)', peso(Fcont)]]) +
          `<h3>Present value of ₱${P.toLocaleString('en-PH')} due in ${fmt(t)} years</h3>` + out([['P = F / (1 + r/m)^(mt)', peso(P / (1 + r / m) ** (m * t))]]);
      });
    },
  };
}

/* ---------------- Counting ---------------- */

function countTool() {
  return {
    html: `
      <div class="grid2"><div class="field"><label for="cn">n</label><input id="cn" inputmode="numeric" value="10"></div><div class="field"><label for="cr">r</label><input id="cr" inputmode="numeric" value="3"></div></div>
      <div class="res"></div>
      <section class="panel"><h3>Arrangements of a word</h3><div class="field"><label for="cw">Word</label><input id="cw" value="MISSISSIPPI" autocapitalize="characters"></div><div class="res2"></div></section>`,
    mount(el) {
      const fact = (n) => (n > 170 ? Infinity : nPr(n, n));
      live(el, '#cn,#cr', () => {
        const n = Math.trunc(Number(el.querySelector('#cn').value)), r = Math.trunc(Number(el.querySelector('#cr').value));
        if (!(n >= 0 && r >= 0)) { el.querySelector('.res').innerHTML = err('Enter whole numbers.'); return; }
        el.querySelector('.res').innerHTML = out([
          ['n!', fmt(fact(n), 0)], ['P(n, r) = n!/(n − r)!', `<b>${fmt(nPr(n, r), 0)}</b>`], ['C(n, r) = n!/[r!(n − r)!]', `<b>${fmt(nCr(n, r), 0)}</b>`],
          ['Circular arrangements (n − 1)!', n ? fmt(fact(n - 1), 0) : '—'], ['With repetition nʳ', fmt(n ** r, 0)], ['Subsets 2ⁿ', fmt(2 ** n, 0)],
        ]);
      });
      const run2 = () => {
        const w = el.querySelector('#cw').value.replace(/\s/g, '').toUpperCase();
        const c = {}; [...w].forEach((ch) => (c[ch] = (c[ch] || 0) + 1));
        let v = fact(w.length); Object.values(c).forEach((k) => (v /= fact(k)));
        const reps = Object.entries(c).filter(([, k]) => k > 1);
        el.querySelector('.res2').innerHTML = w ? out([['Letters', w.length], ['Repeated', reps.map(([ch, k]) => `${ch}×${k}`).join(', ') || 'none'], ['Distinguishable arrangements', `<b>${fmt(Math.round(v), 0)}</b>`], ['Formula', `${w.length}! / ${reps.map(([, k]) => k + '!').join(' · ') || '1'}`]]) : '';
      };
      el.querySelector('#cw').addEventListener('input', run2);
      run2();
    },
  };
}

/* ---------------- Transmutation ---------------- */

function transmuteTool() {
  return {
    html: `
      <div class="field"><label for="tig">Initial grade</label><input id="tig" inputmode="decimal" value="79.50"></div>
      <div class="res"></div>
      <details class="panel"><summary><h3>DepEd transmutation table</h3></summary>
        <div class="table-wrap"><table class="grid compact"><thead><tr><th>Initial grade</th><th>Transmuted</th></tr></thead>
        <tbody>${transmutationRows().map((r) => `<tr><td>${r.from === r.to ? r.from.toFixed(2) : `${r.from.toFixed(2)} – ${r.to.toFixed(2)}`}</td><td>${r.tg}</td></tr>`).join('')}</tbody></table></div>
      </details>
      <details class="panel"><summary><h3>DepEd descriptors</h3></summary>
        <table class="grid compact"><tbody><tr><td>90–100</td><td>Outstanding</td></tr><tr><td>85–89</td><td>Very Satisfactory</td></tr><tr><td>80–84</td><td>Satisfactory</td></tr><tr><td>75–79</td><td>Fairly Satisfactory</td></tr><tr><td>Below 75</td><td>Did Not Meet Expectations</td></tr></tbody></table>
      </details>
      <details class="panel"><summary><h3>College grade equivalents</h3></summary>
        <table class="grid compact"><thead><tr><th>Percentage</th><th>Grade</th></tr></thead><tbody>${COLLEGE_SCALE_ROWS.map((r) => `<tr><td>${r.range}</td><td>${r.grade}</td></tr>`).join('')}</tbody></table>
        <p class="hint">Common scale; check your institution's grading policy.</p>
      </details>`,
    mount(el) {
      live(el, '#tig', () => {
        const ig = Number(el.querySelector('#tig').value);
        if (!Number.isFinite(ig) || ig < 0 || ig > 100) { el.querySelector('.res').innerHTML = err('Enter 0 to 100.'); return; }
        const tg = transmute(ig);
        el.querySelector('.res').innerHTML = `<div class="big-grade ${tg >= 75 ? 'pass' : 'fail'}"><span>Transmuted grade</span><b>${tg}</b><span>${depedDescriptor(tg)}</span></div>`;
      });
    },
  };
}

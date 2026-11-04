// Quiz & worksheet generator UI, saved quizzes, and present (drill) mode.

import { GENERATORS, LEVELS, buildQuiz } from './quizgen.js';
import { db, persist, uid, shareFile, shareText, copyText, safeFile, getClass } from './store.js';
import { h, icon, toast, dialog, confirmBox, today, rerender } from './ui.js';

export const routes = [
  [/^\/quiz$/, () => builder()],
  [/^\/quiz\/result$/, () => resultView(current, true)],
  [/^\/quiz\/saved\/([\w]+)$/, (id) => resultView(db.quizzes.find((q) => q.id === id), false)],
  [/^\/quiz\/present(?:\/([\w]+))?$/, (id) => presentView(id ? db.quizzes.find((q) => q.id === id) : current)],
];

const form = { title: '', counts: {}, sets: 1, shuffle: false, open: {} };
let current = null;

function builder() {
  const total = Object.values(form.counts).reduce((a, b) => a + b, 0);
  const html = `
    <section class="panel">
      <div class="field"><label for="qTitle">Title</label><input id="qTitle" value="${h(form.title)}" placeholder="e.g., Quiz 3 – Factoring Polynomials"></div>
      <p class="muted">Choose topics and how many items of each. Every item is randomly generated with its answer key, so you can make different sets for each row or section.</p>
    </section>
    ${LEVELS.map((lv) => {
      const gens = GENERATORS.filter((g) => g.level === lv);
      const n = gens.reduce((s, g) => s + (form.counts[g.id] || 0), 0);
      return `<details class="level" data-level="${h(lv)}" ${form.open[lv] ? 'open' : ''}>
        <summary><span>${h(lv)}</span>${n ? `<span class="badge ok">${n}</span>` : ''}</summary>
        <ul class="topic-list">${gens.map((g) => `
          <li><span class="grow">${h(g.name)}</span>
            <span class="stepper"><button type="button" data-step="-1" data-id="${g.id}" aria-label="Fewer ${h(g.name)}">−</button><output id="c-${g.id}">${form.counts[g.id] || 0}</output><button type="button" data-step="1" data-id="${g.id}" aria-label="More ${h(g.name)}">+</button></span>
            <button type="button" class="link" data-sample="${g.id}">sample</button></li>`).join('')}</ul>
      </details>`;
    }).join('')}
    <section class="panel">
      <div class="field"><label for="qSets">Number of sets (different items, same topics)</label>
        <select id="qSets">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${form.sets === n ? 'selected' : ''}>${n} set${n > 1 ? 's' : ''} (${'ABCD'.slice(0, n).split('').join(', ')})</option>`).join('')}</select></div>
      <label class="check"><input type="checkbox" id="qShuffle" ${form.shuffle ? 'checked' : ''}> Mix the order of items</label>
    </section>
    <div class="sticky-action">
      <button class="btn primary block" id="genBtn">${icon.quiz} Generate <span id="qTotal">${total}</span> item${total === 1 ? '' : 's'}</button>
    </div>
    ${db.quizzes.length ? `<h2>Saved quizzes</h2><ul class="list">${db.quizzes.slice().reverse().map((q) => `<li><a class="row" href="#/quiz/saved/${q.id}"><span class="grow"><strong>${h(q.title)}</strong><span class="muted">${q.sets.length} set${q.sets.length > 1 ? 's' : ''} · ${q.sets[0].items.length} items · ${h(q.created.slice(0, 10))}</span></span>${icon.chevron}</a></li>`).join('')}</ul>` : ''}`;
  return {
    title: 'Quiz generator', tab: 'quiz', html,
    mount(el) {
      const totalEl = el.querySelector('#qTotal');
      el.querySelector('#qTitle').addEventListener('input', (e) => { form.title = e.target.value; });
      el.querySelector('#qSets').addEventListener('change', (e) => { form.sets = Number(e.target.value); });
      el.querySelector('#qShuffle').addEventListener('change', (e) => { form.shuffle = e.target.checked; });
      el.querySelectorAll('details.level').forEach((d) => d.addEventListener('toggle', () => { form.open[d.dataset.level] = d.open; }));
      el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.id;
        form.counts[id] = Math.max(0, Math.min(30, (form.counts[id] || 0) + Number(b.dataset.step)));
        el.querySelector(`#c-${id}`).textContent = form.counts[id];
        const t = Object.values(form.counts).reduce((a, c) => a + c, 0);
        totalEl.textContent = t;
        const det = b.closest('details');
        const lv = det.dataset.level;
        const n = GENERATORS.filter((g) => g.level === lv).reduce((s, g) => s + (form.counts[g.id] || 0), 0);
        let badge = det.querySelector('summary .badge');
        if (n && !badge) { badge = document.createElement('span'); badge.className = 'badge ok'; det.querySelector('summary').appendChild(badge); }
        if (badge) { if (n) badge.textContent = n; else badge.remove(); }
      }));
      el.querySelectorAll('[data-sample]').forEach((b) => b.addEventListener('click', () => {
        const g = GENERATORS.find((x) => x.id === b.dataset.sample);
        const it = buildQuiz({ [g.id]: 1 })[0];
        dialog({ title: g.name, html: `<p class="q-sample">${h(it.q)}</p><p class="muted">Answer: <strong>${h(it.a)}</strong></p>`, buttons: [{ label: 'Close', value: 'ok', kind: 'primary' }] });
      }));
      el.querySelector('#genBtn').addEventListener('click', () => {
        const t = Object.values(form.counts).reduce((a, c) => a + c, 0);
        if (!t) return toast('Choose at least one topic (tap +)');
        current = makeQuiz();
        location.hash = '#/quiz/result';
      });
    },
  };
}

function makeQuiz() {
  const sets = Array.from({ length: form.sets }, (_, i) => ({ label: 'ABCD'[i], items: buildQuiz(form.counts, { shuffleItems: form.shuffle }) }));
  return { id: uid(), title: form.title.trim() || 'Mathematics Quiz', created: new Date().toISOString(), counts: { ...form.counts }, shuffle: form.shuffle, sets };
}

function resultView(q, unsaved) {
  if (!q) { location.replace('#/quiz'); return { title: 'Quiz', tab: 'quiz', html: '' }; }
  const saved = db.quizzes.some((x) => x.id === q.id);
  const html = `
    <div class="btn-row wrap">
      ${saved ? '' : `<button class="btn primary" id="saveQ">${icon.save} Save</button>`}
      <button class="btn" id="fileQ">${icon.share} Printable file</button>
      <button class="btn" id="textQ">${icon.copy} Share as text</button>
      <a class="btn" href="#/quiz/present${saved ? '/' + q.id : ''}">${icon.play} Present</a>
      ${unsaved ? `<button class="btn" id="regenQ">${icon.refresh} New items</button>` : ''}
      <button class="btn" id="recQ">${icon.classes} Add to class record</button>
      ${saved ? `<button class="btn danger" id="delQ">${icon.trash} Delete</button>` : ''}
    </div>
    ${q.sets.map((s) => `
      <article class="paper">
        <header><h2>${h(q.title)}${q.sets.length > 1 ? ` — Set ${s.label}` : ''}</h2>
          <p class="muted">Name: ________________________ &nbsp; Section: __________ &nbsp; Score: ____/${s.items.length}</p></header>
        <ol class="items">${s.items.map((it) => `<li>${h(it.q)}</li>`).join('')}</ol>
      </article>`).join('')}
    <details class="paper key" open><summary><h2>Answer key</h2></summary>
      ${q.sets.map((s) => `${q.sets.length > 1 ? `<h3>Set ${s.label}</h3>` : ''}<ol class="items">${s.items.map((it) => `<li>${h(it.a)}</li>`).join('')}</ol>`).join('')}
    </details>`;
  return {
    title: q.title, tab: 'quiz', back: '#/quiz', html,
    mount(el) {
      el.querySelector('#saveQ')?.addEventListener('click', () => { db.quizzes.push(q); persist(); toast('Saved to your quizzes'); location.replace(`#/quiz/saved/${q.id}`); });
      el.querySelector('#regenQ')?.addEventListener('click', () => { current = makeQuiz(); current.title = q.title; rerender(); toast('New items generated'); });
      el.querySelector('#textQ').addEventListener('click', async () => {
        const text = quizText(q);
        if (!(await shareText(q.title, text))) { await copyText(text); toast('Copied to clipboard'); }
      });
      el.querySelector('#fileQ').addEventListener('click', async () => {
        try { await shareFile(`${safeFile(q.title)}.html`, quizHTML(q), 'text/html'); } catch (e) { toast('Could not create file: ' + e.message); }
      });
      el.querySelector('#recQ').addEventListener('click', () => addToRecord(q));
      el.querySelector('#delQ')?.addEventListener('click', async () => {
        if (!(await confirmBox('Delete saved quiz?', q.title))) return;
        db.quizzes = db.quizzes.filter((x) => x.id !== q.id);
        persist();
        location.replace('#/quiz');
      });
    },
  };
}

async function addToRecord(q) {
  if (!db.classes.length) return toast('Create a class first');
  const r = await dialog({
    title: 'Add to class record',
    message: `Creates an assessment worth ${q.sets[0].items.length} points so you can enter scores.`,
    fields: [
      { name: 'cls', type: 'select', label: 'Class', options: db.classes.map((c) => ({ value: c.id, label: `${c.name} ${c.section ? '– ' + c.section : ''}` })) },
    ],
    buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Next', value: 'ok', kind: 'primary' }],
  });
  if (!r) return;
  const cls = getClass(r.values.cls);
  const r2 = await dialog({
    title: cls.name,
    fields: [
      { name: 'comp', type: 'select', label: 'Component', options: cls.components.map((c) => ({ value: c.key, label: `${c.name} (${c.weight}%)` })) },
      { name: 'period', type: 'select', label: 'Grading period', options: cls.periods.map((p) => ({ value: p, label: p })) },
    ],
    buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Add', value: 'ok', kind: 'primary' }],
  });
  if (!r2) return;
  const a = { id: uid(), title: q.title, max: q.sets[0].items.length, comp: r2.values.comp, period: r2.values.period, date: today() };
  cls.assessments.push(a);
  cls.scores[a.id] = {};
  persist();
  location.hash = `#/class/${cls.id}/assess/${a.id}`;
}

function quizText(q) {
  const out = [];
  q.sets.forEach((s) => {
    out.push(`${q.title}${q.sets.length > 1 ? ' — Set ' + s.label : ''}`, '');
    s.items.forEach((it, i) => out.push(`${i + 1}. ${it.q}`));
    out.push('');
  });
  out.push('ANSWER KEY');
  q.sets.forEach((s) => {
    if (q.sets.length > 1) out.push(`Set ${s.label}`);
    s.items.forEach((it, i) => out.push(`${i + 1}. ${it.a}`));
    out.push('');
  });
  return out.join('\n');
}

function quizHTML(q) {
  const teacher = db.settings.teacher, school = db.settings.school;
  const paper = (s) => `<section class="page"><div class="hd">${school ? `<div class="school">${h(school)}</div>` : ''}<h1>${h(q.title)}${q.sets.length > 1 ? ` — Set ${s.label}` : ''}</h1>${teacher ? `<div class="t">${h(teacher)}</div>` : ''}</div>
    <table class="info"><tr><td>Name: ______________________________</td><td>Date: ______________</td></tr><tr><td>Grade &amp; Section: ____________________</td><td>Score: _____ / ${s.items.length}</td></tr></table>
    <p class="dir"><b>Directions:</b> Solve each problem. Show your solution and write your final answer clearly.</p>
    <ol>${s.items.map((it) => `<li>${h(it.q)}<div class="space"></div></li>`).join('')}</ol></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(q.title)}</title>
<style>
body{font-family:"Times New Roman",Georgia,serif;font-size:13pt;color:#000;background:#fff;margin:0;padding:16px}
.page{max-width:780px;margin:0 auto 24px;page-break-after:always}
.hd{text-align:center;margin-bottom:10px}.school{font-weight:bold;text-transform:uppercase;font-size:12pt}
h1{font-size:16pt;margin:4px 0}.t{font-size:11pt}
table.info{width:100%;margin:8px 0 12px;font-size:12pt}table.info td{padding:4px 0}
.dir{font-size:12pt}ol{padding-left:28px}li{margin:6px 0 2px;line-height:1.5}.space{height:44px}
.key li{margin:2px 0}.key .space{display:none}
@media print{body{padding:0}.noprint{display:none}}
.noprint{text-align:center;margin:12px}button{font-size:14pt;padding:8px 18px}
</style></head><body>
<div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
${q.sets.map(paper).join('')}
<section class="page key"><h1>Answer Key — ${h(q.title)}</h1>${q.sets.map((s) => `${q.sets.length > 1 ? `<h2>Set ${s.label}</h2>` : ''}<ol>${s.items.map((it) => `<li>${h(it.a)}</li>`).join('')}</ol>`).join('')}</section>
</body></html>`;
}

/* ---------------- Present / drill mode ---------------- */

function presentView(q) {
  if (!q) { location.replace('#/quiz'); return { title: 'Present', tab: 'quiz', html: '' }; }
  const items = q.sets[0].items;
  let i = 0, shown = false;
  const html = `
    <div class="present">
      <div class="present-top"><span id="pCount"></span><span class="muted" id="pTopic"></span></div>
      <div class="present-q" id="pQ"></div>
      <div class="present-a" id="pA" hidden></div>
      <div class="present-nav">
        <button class="btn big" id="pPrev" aria-label="Previous">◀</button>
        <button class="btn primary big" id="pShow">Show answer</button>
        <button class="btn big" id="pNext" aria-label="Next">▶</button>
      </div>
      <p class="hint">Tip: turn the phone sideways or cast the screen to a TV for the whole class.</p>
    </div>`;
  return {
    title: q.title, tab: 'quiz', back: db.quizzes.some((x) => x.id === q.id) ? `#/quiz/saved/${q.id}` : '#/quiz/result', html, wide: true,
    mount(el) {
      const show = () => {
        el.querySelector('#pCount').textContent = `Item ${i + 1} of ${items.length}`;
        el.querySelector('#pTopic').textContent = items[i].topic || '';
        el.querySelector('#pQ').textContent = items[i].q;
        const a = el.querySelector('#pA');
        a.textContent = items[i].a;
        a.hidden = !shown;
        el.querySelector('#pShow').textContent = shown ? 'Hide answer' : 'Show answer';
        el.querySelector('#pPrev').disabled = i === 0;
        el.querySelector('#pNext').disabled = i === items.length - 1;
      };
      el.querySelector('#pPrev').addEventListener('click', () => { if (i > 0) { i--; shown = false; show(); } });
      el.querySelector('#pNext').addEventListener('click', () => { if (i < items.length - 1) { i++; shown = false; show(); } });
      el.querySelector('#pShow').addEventListener('click', () => { shown = !shown; show(); });
      show();
    },
  };
}

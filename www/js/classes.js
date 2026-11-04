// Classes: students, assessments & score entry, class record, class setup.

import { db, persist, getClass, newClass, sortedStudents, fullName, parseNames, uid, shareFile, toCSV, safeFile } from './store.js';
import { PRESETS, computePeriod, computeFinal, isPassing, depedDescriptor, COLLEGE_SCALE_ROWS } from './grading.js';
import { h, icon, toast, dialog, confirmBox, today, niceDate, rerender } from './ui.js';
import { fmt } from './mathcore.js';

const periodSel = {}; // classId -> current period (or 'FINAL' on record tab)

export const routes = [
  [/^\/new-class$/, () => newClassView()],
  [/^\/class\/([\w]+)\/assess\/([\w]+)$/, (id, aid) => assessView(id, aid)],
  [/^\/class\/([\w]+)\/student\/([\w]+)$/, (id, sid) => studentView(id, sid)],
  [/^\/class\/([\w]+)(?:\/(students|scores|record|setup))?$/, (id, tab) => classView(id, tab || 'scores')],
];

const missing = () => ({ title: 'Not found', back: '#/', tab: 'classes', html: '<div class="empty"><p>This class no longer exists.</p><a class="btn" href="#/">Back to classes</a></div>' });

/* ---------------- New class ---------------- */

function newClassView() {
  const html = `
    <form class="panel" id="ncForm">
      <div class="field"><label for="ncName">Subject / class name</label><input id="ncName" required placeholder="e.g., Mathematics 8, General Mathematics, MMW"></div>
      <div class="field"><label for="ncSection">Grade &amp; section</label><input id="ncSection" placeholder="e.g., Grade 8 – Faith, BSEd 1-A"></div>
      <div class="field"><label for="ncSY">School year / semester</label><input id="ncSY" value="${schoolYear()}"></div>
      <fieldset class="field"><legend>Grading system</legend>
        ${Object.entries(PRESETS).map(([k, p], i) => `
          <label class="radio-card"><input type="radio" name="preset" value="${k}" ${i === 0 ? 'checked' : ''}>
            <span><strong>${h(p.label)}</strong><span class="muted">${p.components.map((c) => `${h(c.name)} ${c.weight}%`).join(' · ')}<br>${p.scale === 'college' ? 'Grades 1.00–5.00' : 'DepEd transmutation, passing 75'} · ${p.periods.join(', ')}</span></span>
          </label>`).join('')}
        <p class="hint">You can change component names, weights, and grading periods later in the class's Setup tab.</p>
      </fieldset>
      <button class="btn primary block" type="submit">${icon.plus} Create class</button>
    </form>`;
  return {
    title: 'New class', back: '#/', tab: 'classes', html,
    mount(el) {
      el.querySelector('#ncForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target;
        const cls = newClass({
          name: f.querySelector('#ncName').value.trim(),
          section: f.querySelector('#ncSection').value.trim(),
          schoolYear: f.querySelector('#ncSY').value.trim(),
          preset: f.querySelector('input[name=preset]:checked').value,
        });
        location.replace(`#/class/${cls.id}/students`);
        toast('Class created. Add your students.');
      });
    },
  };
}

function schoolYear() {
  const d = new Date();
  const y = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
  return `S.Y. ${y}–${y + 1}`;
}

/* ---------------- Class view (tabs) ---------------- */

function classView(id, tab) {
  const cls = getClass(id);
  if (!cls) return missing();
  const tabs = [['scores', 'Scores'], ['record', 'Grades'], ['students', 'Students'], ['setup', 'Setup']];
  const body = { students: studentsTab, scores: scoresTab, record: recordTab, setup: setupTab }[tab](cls);
  const html = `
    <div class="class-head"><strong>${h(cls.name)}</strong><span class="muted">${h([cls.section, cls.schoolYear].filter(Boolean).join(' · '))}</span></div>
    <nav class="seg" aria-label="Class sections">${tabs.map(([k, l]) => `<a href="#/class/${id}/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>
    ${body.html}`;
  return { title: cls.name, back: '#/', tab: 'classes', html, mount: body.mount, keepScroll: false };
}

function periodChips(cls, withFinal = false) {
  let cur = periodSel[cls.id];
  if (!cur || (!cls.periods.includes(cur) && !(withFinal && cur === 'FINAL'))) cur = periodSel[cls.id] = cls.periods[0];
  if (!withFinal && cur === 'FINAL') cur = cls.periods[0];
  const list = withFinal ? [...cls.periods, 'FINAL'] : cls.periods;
  return {
    cur,
    html: `<div class="chips scroll" role="tablist">${list.map((p) => `<button class="chip-btn ${p === cur ? 'on' : ''}" data-period="${h(p)}" role="tab" aria-selected="${p === cur}">${p === 'FINAL' ? 'Final' : h(p)}</button>`).join('')}</div>`,
  };
}

function bindPeriodChips(el, cls) {
  el.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => { periodSel[cls.id] = b.dataset.period; rerender(); }));
}

/* ---------- Students tab ---------- */

function studentsTab(cls) {
  const list = sortedStudents(cls);
  let lastSex = null;
  const rows = list.map((s, i) => {
    let head = '';
    if (cls.sortBySex && s.sex !== lastSex) {
      head = `<li class="group-head">${s.sex === 'M' ? 'Male' : s.sex === 'F' ? 'Female' : 'Not set'}</li>`;
      lastSex = s.sex;
    }
    return `${head}<li><button class="row" data-sid="${s.id}"><span class="num">${i + 1}</span><span class="grow">${h(fullName(s))}</span>${s.sex ? `<span class="badge ${s.sex}">${s.sex}</span>` : ''}${icon.edit}</button></li>`;
  }).join('');
  return {
    html: `
      <div class="section-head"><h2>${list.length} student${list.length === 1 ? '' : 's'}</h2><button class="btn primary small" id="addStudents">${icon.plus} Add</button></div>
      ${list.length ? `<ul class="list">${rows}</ul>` : `<div class="empty"><p>No students yet.</p><p class="muted">Tap <strong>Add</strong> and paste your class list, one name per line (Last, First).</p></div>`}`,
    mount(el) {
      el.querySelector('#addStudents').addEventListener('click', () => addStudents(cls));
      el.querySelectorAll('[data-sid]').forEach((b) => b.addEventListener('click', () => editStudent(cls, b.dataset.sid)));
    },
  };
}

async function addStudents(cls) {
  const r = await dialog({
    title: 'Add students',
    fields: [
      { name: 'names', type: 'textarea', label: 'Names (one per line)', placeholder: 'Dela Cruz, Juan\nSantos, Maria\nReyes, Jose', rows: 8, hint: 'Format: Last, First. Copying a column from Excel or Google Sheets works too.' },
      { name: 'sex', type: 'select', label: 'Sex for these names', value: '', options: [{ value: '', label: 'Not set / mixed' }, { value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }], hint: 'Tip: paste boys first with “Male”, then add girls with “Female”. You can also end a line with “- M” or “- F”.' },
    ],
    buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Add students', value: 'ok', kind: 'primary' }],
  });
  if (!r) return;
  const added = parseNames(r.values.names, r.values.sex);
  if (!added.length) return toast('No names entered');
  cls.students.push(...added);
  persist();
  toast(`Added ${added.length} student${added.length === 1 ? '' : 's'}`);
  rerender();
}

async function editStudent(cls, sid) {
  const s = cls.students.find((x) => x.id === sid);
  if (!s) return;
  const r = await dialog({
    title: 'Edit student',
    fields: [
      { name: 'last', label: 'Last name', value: s.last },
      { name: 'first', label: 'First name (and middle initial)', value: s.first },
      { name: 'sex', type: 'select', label: 'Sex', value: s.sex || '', options: [{ value: '', label: 'Not set' }, { value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }] },
    ],
    buttons: [{ label: 'Remove', value: 'delete', kind: 'danger' }, { label: 'Cancel', value: 'cancel' }, { label: 'Save', value: 'ok', kind: 'primary' }],
  });
  if (!r) return;
  if (r.button === 'delete') {
    if (!(await confirmBox('Remove student?', `${fullName(s)} and all of their scores and attendance will be removed from this class.`, 'Remove'))) return;
    cls.students = cls.students.filter((x) => x.id !== sid);
    for (const a of Object.values(cls.scores)) delete a[sid];
    for (const d of Object.values(cls.attendance)) delete d[sid];
  } else {
    s.last = r.values.last.trim() || s.last;
    s.first = r.values.first.trim();
    s.sex = r.values.sex;
  }
  persist();
  rerender();
}

/* ---------- Scores tab ---------- */

function scoresTab(cls) {
  const { cur, html: chips } = periodChips(cls);
  const n = cls.students.length;
  const sections = cls.components.map((c) => {
    const items = cls.assessments.filter((a) => a.period === cur && a.comp === c.key);
    const totalMax = items.reduce((s, a) => s + Number(a.max || 0), 0);
    return `
      <section class="comp">
        <div class="section-head"><h3>${h(c.name)} <span class="muted">${c.weight}%</span></h3><button class="btn small" data-add="${h(c.key)}">${icon.plus} Add</button></div>
        ${items.length ? `<ul class="list">${items.map((a) => {
          const filled = Object.values(cls.scores[a.id] || {}).filter((v) => v !== '' && v != null).length;
          return `<li><a class="row" href="#/class/${cls.id}/assess/${a.id}"><span class="grow"><strong>${h(a.title)}</strong><span class="muted">${a.date ? h(niceDate(a.date)) + ' · ' : ''}${a.max} pts</span></span><span class="badge ${filled >= n && n ? 'ok' : 'warn'}">${filled}/${n}</span>${icon.chevron}</a></li>`;
        }).join('')}</ul><p class="hint">Total: ${totalMax} points</p>` : `<p class="muted small-pad">No ${h(c.name.toLowerCase())} yet for ${h(cur)}.</p>`}
      </section>`;
  }).join('');
  return {
    html: `${chips}${n ? '' : `<a class="banner" href="#/class/${cls.id}/students">Add students first so you can enter scores.</a>`}${sections}`,
    mount(el) {
      bindPeriodChips(el, cls);
      el.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addAssessment(cls, cur, b.dataset.add)));
    },
  };
}

async function addAssessment(cls, period, comp, existing) {
  const c = cls.components.find((x) => x.key === comp);
  const count = cls.assessments.filter((a) => a.period === period && a.comp === comp).length;
  const defTitle = comp === 'QA' ? `${period} Quarterly Exam` : comp === 'EX' ? `${period} Exam` : `${c ? c.name.replace(/s\b.*$/, '') : 'Item'} ${count + 1}`;
  const r = await dialog({
    title: existing ? 'Edit assessment' : `New: ${c?.name || comp}`,
    fields: [
      { name: 'title', label: 'Title', value: existing?.title ?? defTitle },
      { name: 'max', label: 'Highest possible score', type: 'number', inputmode: 'decimal', value: existing?.max ?? (comp === 'QA' ? 50 : 20) },
      { name: 'date', label: 'Date', type: 'date', value: existing?.date ?? today() },
      { name: 'comp', label: 'Component', type: 'select', value: comp, options: cls.components.map((x) => ({ value: x.key, label: `${x.name} (${x.weight}%)` })) },
      { name: 'period', label: 'Grading period', type: 'select', value: period, options: cls.periods.map((p) => ({ value: p, label: p })) },
    ],
    buttons: [{ label: 'Cancel', value: 'cancel' }, { label: existing ? 'Save' : 'Create & enter scores', value: 'ok', kind: 'primary' }],
  });
  if (!r) return null;
  const max = Number(r.values.max);
  if (!(max > 0)) { toast('Highest possible score must be more than 0'); return null; }
  if (existing) {
    Object.assign(existing, { title: r.values.title.trim() || existing.title, max, date: r.values.date, comp: r.values.comp, period: r.values.period });
    persist();
    rerender();
    return existing;
  }
  const a = { id: uid(), title: r.values.title.trim() || defTitle, max, date: r.values.date, comp: r.values.comp, period: r.values.period };
  cls.assessments.push(a);
  cls.scores[a.id] = {};
  persist();
  location.hash = `#/class/${cls.id}/assess/${a.id}`;
  return a;
}

/* ---------- Score entry ---------- */

function assessView(id, aid) {
  const cls = getClass(id);
  const a = cls?.assessments.find((x) => x.id === aid);
  if (!cls || !a) return missing();
  const comp = cls.components.find((c) => c.key === a.comp);
  const list = sortedStudents(cls);
  const sc = (cls.scores[a.id] ||= {});
  const html = `
    <div class="class-head"><strong>${h(a.title)}</strong><span class="muted">${h(comp?.name || a.comp)} · ${h(a.period)} · ${a.max} pts${a.date ? ' · ' + h(niceDate(a.date)) : ''}</span></div>
    <div class="stat-strip" id="aStats"></div>
    <p class="hint">Type each score; it saves automatically. Press <strong>Next</strong> on the keyboard to move down. Blank counts as 0 in the grade.</p>
    <ol class="score-list">
      ${list.map((s, i) => `<li><label for="sc-${s.id}"><span class="num">${i + 1}</span><span class="grow">${h(fullName(s))}</span></label>
        <input id="sc-${s.id}" data-sid="${s.id}" class="score-in" type="text" inputmode="decimal" enterkeyhint="${i === list.length - 1 ? 'done' : 'next'}" autocomplete="off" value="${sc[s.id] ?? ''}" aria-label="Score of ${h(fullName(s))}">
        <span class="of">/${a.max}</span></li>`).join('')}
    </ol>
    ${list.length ? '' : `<a class="banner" href="#/class/${cls.id}/students">This class has no students yet.</a>`}
    <div class="btn-row">
      <button class="btn" id="editA">${icon.edit} Edit details</button>
      <button class="btn" id="fillMax">Give all perfect</button>
      <button class="btn danger" id="delA">${icon.trash} Delete</button>
    </div>`;
  return {
    title: 'Enter scores', back: `#/class/${cls.id}/scores`, tab: 'classes', html,
    mount(el) {
      const statsEl = el.querySelector('#aStats');
      const showStats = () => {
        const vals = list.map((s) => sc[s.id]).filter((v) => v !== '' && v != null).map(Number);
        if (!vals.length) { statsEl.innerHTML = `<span><b>0/${list.length}</b> entered</span>`; return; }
        const mean = vals.reduce((x, y) => x + y, 0) / vals.length;
        const mps = (mean / a.max) * 100;
        const mastered = vals.filter((v) => v / a.max >= 0.75).length;
        statsEl.innerHTML = `<span><b>${vals.length}/${list.length}</b> entered</span><span>MPS <b>${fmt(mps, 2)}%</b></span><span>Mean <b>${fmt(mean, 2)}</b></span><span>High <b>${Math.max(...vals)}</b></span><span>Low <b>${Math.min(...vals)}</b></span><span>≥75%: <b>${mastered}</b></span>`;
      };
      showStats();
      const inputs = [...el.querySelectorAll('.score-in')];
      inputs.forEach((inp, i) => {
        inp.addEventListener('input', () => {
          const raw = inp.value.trim().replace(',', '.');
          if (raw === '') { delete sc[inp.dataset.sid]; inp.classList.remove('bad'); persist(); showStats(); return; }
          const v = Number(raw);
          if (!Number.isFinite(v) || v < 0 || v > a.max) { inp.classList.add('bad'); return; }
          inp.classList.remove('bad');
          sc[inp.dataset.sid] = v;
          persist();
          showStats();
        });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); const nx = inputs[i + 1]; if (nx) { nx.focus(); nx.select(); } else inp.blur(); }
        });
        inp.addEventListener('focus', () => inp.select());
      });
      el.querySelector('#editA').addEventListener('click', () => addAssessment(cls, a.period, a.comp, a));
      el.querySelector('#fillMax').addEventListener('click', async () => {
        if (!(await confirmBox('Give everyone a perfect score?', `Every blank score becomes ${a.max}. Scores already typed stay as they are.`, 'Fill blanks', 'primary'))) return;
        list.forEach((s) => { if (sc[s.id] === undefined || sc[s.id] === '') sc[s.id] = a.max; });
        persist();
        rerender();
      });
      el.querySelector('#delA').addEventListener('click', async () => {
        if (!(await confirmBox('Delete this assessment?', `“${a.title}” and all its scores will be removed.`))) return;
        cls.assessments = cls.assessments.filter((x) => x.id !== a.id);
        delete cls.scores[a.id];
        persist();
        location.replace(`#/class/${cls.id}/scores`);
      });
    },
  };
}

/* ---------- Grades (record) tab ---------- */

function gradeClass(cls, display) {
  const p = isPassing(cls, display);
  return p === null ? '' : p ? 'pass' : 'fail';
}

function recordTab(cls) {
  const { cur, html: chips } = periodChips(cls, true);
  const list = sortedStudents(cls);
  if (!list.length) return { html: `${chips}<div class="empty"><p>No students yet.</p></div>`, mount: (el) => bindPeriodChips(el, cls) };
  let table, summary;
  const scaleNote = cls.scale === 'college' ? 'Grade = 1.00–5.00 (3.00 passing).' : cls.scale === 'percent' ? 'Grade = weighted percentage.' : 'QG = transmuted quarterly grade (DepEd).';
  if (cur === 'FINAL') {
    const res = list.map((s) => ({ s, f: computeFinal(cls, s.id) }));
    table = `<table class="grid">
      <thead><tr><th class="sticky">Learner</th>${cls.periods.map((p) => `<th>${h(p)}</th>`).join('')}<th>Final</th><th>Remarks</th></tr></thead>
      <tbody>${res.map(({ s, f }) => `<tr data-sid="${s.id}"><td class="sticky">${h(fullName(s))}</td>${f.per.map((p) => `<td class="${gradeClass(cls, p.display)}">${p.display || '–'}</td>`).join('')}<td class="strong ${gradeClass(cls, f.display)}">${f.display || '–'}${f.complete || !f.display ? '' : '*'}</td><td>${f.display ? (isPassing(cls, f.display) ? 'Passed' : 'Failed') : ''}</td></tr>`).join('')}</tbody></table>`;
    summary = descriptorSummary(cls, res.map((r) => r.f));
  } else {
    const res = list.map((s) => ({ s, r: computePeriod(cls, s.id, cur) }));
    table = `<table class="grid">
      <thead><tr><th class="sticky">Learner</th>${cls.components.map((c) => `<th>${h(c.key)}<small>${c.weight}%</small></th>`).join('')}<th>Initial</th><th>${cls.scale === 'deped' ? 'QG' : 'Grade'}</th></tr></thead>
      <tbody>${res.map(({ s, r }) => `<tr data-sid="${s.id}"><td class="sticky">${h(fullName(s))}</td>${r.comps.map((c) => `<td>${c.ps == null ? '–' : fmt(c.ps, 2)}</td>`).join('')}<td>${r.initial == null ? '–' : r.initial.toFixed(2)}</td><td class="strong ${gradeClass(cls, r.display)}">${r.display || '–'}${r.partial ? '*' : ''}</td></tr>`).join('')}</tbody></table>`;
    summary = descriptorSummary(cls, res.map((x) => x.r));
  }
  return {
    html: `${chips}
      <div class="table-wrap">${table}</div>
      <p class="hint">Component columns are percentage scores (PS). ${scaleNote} * = incomplete (some components or periods have no scores yet). Tap a learner for details.</p>
      ${summary}
      <div class="btn-row">
        <button class="btn primary" id="csvBtn">${icon.share} Export ${cur === 'FINAL' ? 'final grades' : h(cur) + ' record'} (CSV)</button>
      </div>`,
    mount(el) {
      bindPeriodChips(el, cls);
      el.querySelectorAll('tr[data-sid]').forEach((tr) => tr.addEventListener('click', () => { location.hash = `#/class/${cls.id}/student/${tr.dataset.sid}`; }));
      el.querySelector('#csvBtn').addEventListener('click', async () => {
        try {
          const rows = cur === 'FINAL' ? finalCSV(cls) : periodCSV(cls, cur);
          await shareFile(`${safeFile(cls.name + ' ' + (cls.section || ''))}_${cur}.csv`, toCSV(rows), 'text/csv');
        } catch (e) { toast('Export failed: ' + e.message); }
      });
    },
  };
}

function descriptorSummary(cls, results) {
  const graded = results.filter((r) => (r.display ?? '') !== '');
  if (!graded.length) return '';
  const counts = new Map();
  const label = (r) => (cls.scale === 'percent' ? (isPassing(cls, r.display) ? 'Passed' : 'Failed') : r.descriptor);
  graded.forEach((r) => counts.set(label(r), (counts.get(label(r)) || 0) + 1));
  const order = cls.scale === 'deped'
    ? ['Outstanding', 'Very Satisfactory', 'Satisfactory', 'Fairly Satisfactory', 'Did Not Meet Expectations']
    : cls.scale === 'college' ? ['Excellent', 'Very Good', 'Good', 'Satisfactory', 'Passed', 'Failed'] : ['Passed', 'Failed'];
  const max = Math.max(...counts.values());
  const pass = graded.filter((r) => isPassing(cls, r.display)).length;
  return `<section class="panel">
    <h3>Summary · ${graded.length} graded · ${pass} passing (${fmt((pass / graded.length) * 100, 1)}%)</h3>
    <div class="bars">${order.map((k) => {
      const n = counts.get(k) || 0;
      return `<div class="bar-row"><span class="bar-label">${h(k)}</span><span class="bar"><span style="width:${max ? (n / max) * 100 : 0}%" class="${/Not Meet|Failed/.test(k) ? 'fail' : ''}"></span></span><span class="bar-n">${n}</span></div>`;
    }).join('')}</div></section>`;
}

function periodCSV(cls, period) {
  const list = sortedStudents(cls);
  const header1 = ['#', 'Learner', 'Sex'];
  const header2 = ['', 'Highest possible score', ''];
  const groups = cls.components.map((c) => ({ c, items: cls.assessments.filter((a) => a.period === period && a.comp === c.key) }));
  for (const { c, items } of groups) {
    items.forEach((a) => { header1.push(`${c.key}: ${a.title}`); header2.push(a.max); });
    header1.push(`${c.key} Total`, `${c.key} PS`, `${c.key} WS (${c.weight}%)`);
    header2.push(items.reduce((s, a) => s + Number(a.max), 0), 100, c.weight);
  }
  header1.push('Initial Grade', cls.scale === 'deped' ? 'Quarterly Grade' : 'Grade', 'Descriptor');
  header2.push('', '', '');
  const rows = [[`${cls.name} ${cls.section || ''} — ${period}`.trim()], header1, header2];
  list.forEach((s, i) => {
    const r = computePeriod(cls, s.id, period);
    const row = [i + 1, fullName(s), s.sex || ''];
    groups.forEach(({ items }, gi) => {
      items.forEach((a) => row.push(cls.scores[a.id]?.[s.id] ?? ''));
      const comp = r.comps[gi];
      row.push(comp.count ? comp.raw : '', comp.ps ?? '', comp.ws ?? '');
    });
    row.push(r.initial ?? '', r.display, r.descriptor);
    rows.push(row);
  });
  return rows;
}

function finalCSV(cls) {
  const list = sortedStudents(cls);
  const rows = [[`${cls.name} ${cls.section || ''} — Final grades`.trim()], ['#', 'Learner', 'Sex', ...cls.periods, 'Final', 'Descriptor', 'Remarks']];
  list.forEach((s, i) => {
    const f = computeFinal(cls, s.id);
    rows.push([i + 1, fullName(s), s.sex || '', ...f.per.map((p) => p.display), f.display, f.descriptor, f.display ? (isPassing(cls, f.display) ? 'Passed' : 'Failed') : '']);
  });
  return rows;
}

/* ---------- Student detail ---------- */

function studentView(id, sid) {
  const cls = getClass(id);
  const s = cls?.students.find((x) => x.id === sid);
  if (!cls || !s) return missing();
  const f = computeFinal(cls, sid);
  const att = Object.values(cls.attendance || {}).map((d) => d[sid]).filter(Boolean);
  const cnt = (k) => att.filter((v) => v === k).length;
  const html = `
    <div class="class-head"><strong>${h(fullName(s))}</strong><span class="muted">${h(cls.name)} · ${h(cls.section || '')}</span></div>
    <div class="big-grade ${gradeClass(cls, f.display)}"><span>Final${f.complete ? '' : ' (so far)'}</span><b>${f.display || '–'}</b><span>${h(f.descriptor)}</span></div>
    ${att.length ? `<p class="chips"><span class="chip ok">Present ${cnt('P')}</span><span class="chip warn">Late ${cnt('L')}</span><span class="chip bad">Absent ${cnt('A')}</span><span class="chip">Excused ${cnt('E')}</span></p>` : ''}
    ${f.per.map((p) => `
      <section class="panel">
        <div class="section-head"><h3>${h(p.period)}</h3><span class="grade-pill ${gradeClass(cls, p.display)}">${p.display || '–'}${p.partial ? '*' : ''}</span></div>
        ${p.comps.map((c) => {
          const items = cls.assessments.filter((a) => a.period === p.period && a.comp === c.key);
          return `<div class="comp-line"><div class="section-head"><span>${h(c.name)} (${c.weight}%)</span><span class="muted">${c.ps == null ? 'no scores yet' : `${c.raw}/${c.max} → PS ${fmt(c.ps, 2)} → WS ${fmt(c.ws, 2)}`}</span></div>
            ${items.length ? `<ul class="mini">${items.map((a) => `<li><span>${h(a.title)}</span><span class="${cls.scores[a.id]?.[sid] == null ? 'muted' : ''}">${cls.scores[a.id]?.[sid] ?? '—'}/${a.max}</span></li>`).join('')}</ul>` : ''}</div>`;
        }).join('')}
        ${p.initial != null ? `<p class="muted">Initial grade ${p.initial.toFixed(2)}${cls.scale === 'deped' ? ` → transmuted ${p.display} (${h(depedDescriptor(p.grade))})` : ''}</p>` : ''}
      </section>`).join('')}
    <button class="btn" id="shareGrade">${icon.share} Share grade summary</button>`;
  return {
    title: 'Learner', back: `#/class/${cls.id}/record`, tab: 'classes', html,
    mount(el) {
      el.querySelector('#shareGrade').addEventListener('click', async () => {
        const text = [`${fullName(s)} — ${cls.name} ${cls.section || ''}`.trim(),
          ...f.per.map((p) => `${p.period}: ${p.display || '–'}${p.partial ? ' (incomplete)' : ''}`),
          `Final: ${f.display || '–'} ${f.descriptor ? '(' + f.descriptor + ')' : ''}`].join('\n');
        const { shareText, copyText } = await import('./store.js');
        if (!(await shareText('Grade summary', text))) { await copyText(text); toast('Copied to clipboard'); }
      });
    },
  };
}

/* ---------- Setup tab ---------- */

function setupTab(cls) {
  const wSum = cls.components.reduce((s, c) => s + Number(c.weight), 0);
  return {
    html: `
      <form class="panel" id="setupForm">
        <h3>Class details</h3>
        <div class="field"><label for="sName">Subject / class name</label><input id="sName" value="${h(cls.name)}"></div>
        <div class="field"><label for="sSection">Grade &amp; section</label><input id="sSection" value="${h(cls.section)}"></div>
        <div class="field"><label for="sSY">School year / semester</label><input id="sSY" value="${h(cls.schoolYear)}"></div>
        <label class="check"><input type="checkbox" id="sSort" ${cls.sortBySex ? 'checked' : ''}> List male learners first, then female (DepEd form order)</label>

        <h3>Grading components</h3>
        <div id="compRows">${cls.components.map((c, i) => compRow(c, i)).join('')}</div>
        <button type="button" class="btn small" id="addComp">${icon.plus} Add component</button>
        <p class="hint" id="wSum">Weights total: <b>${wSum}%</b>${wSum !== 100 ? ' — should be 100%' : ''}</p>

        <div class="field"><label for="sPeriods">Grading periods (comma-separated)</label><input id="sPeriods" value="${h(cls.periods.join(', '))}"></div>
        <div class="field"><label for="sScale">Grade scale</label>
          <select id="sScale">
            <option value="deped" ${cls.scale === 'deped' ? 'selected' : ''}>DepEd transmutation (60–100, passing 75)</option>
            <option value="college" ${cls.scale === 'college' ? 'selected' : ''}>College point grade (1.00–5.00)</option>
            <option value="percent" ${cls.scale === 'percent' ? 'selected' : ''}>Plain percentage (passing 75)</option>
          </select></div>
        <div class="field" id="baseField" ${cls.scale === 'college' ? '' : 'hidden'}><label for="sBase">College percentage formula</label>
          <select id="sBase">
            <option value="0" ${Number(cls.collegeBase) !== 50 ? 'selected' : ''}>Zero-based: score ÷ total × 100</option>
            <option value="50" ${Number(cls.collegeBase) === 50 ? 'selected' : ''}>Base-50: score ÷ total × 50 + 50</option>
          </select></div>
        <button class="btn primary block" type="submit">${icon.save} Save setup</button>
      </form>
      ${cls.scale === 'college' ? `<section class="panel"><h3>College grade equivalents</h3><table class="grid compact"><thead><tr><th>Percentage</th><th>Grade</th></tr></thead><tbody>${COLLEGE_SCALE_ROWS.map((r) => `<tr><td>${r.range}</td><td>${r.grade}</td></tr>`).join('')}</tbody></table></section>` : ''}
      <section class="panel">
        <h3>More</h3>
        <div class="btn-row">
          <button class="btn" id="dupBtn">${icon.copy} Copy setup to a new section</button>
          <button class="btn danger" id="delBtn">${icon.trash} Delete class</button>
        </div>
      </section>`,
    mount(el) {
      const rowsEl = el.querySelector('#compRows');
      const sumEl = el.querySelector('#wSum');
      const updateSum = () => {
        const t = [...rowsEl.querySelectorAll('.cw')].reduce((s, i) => s + (Number(i.value) || 0), 0);
        sumEl.innerHTML = `Weights total: <b>${t}%</b>${t !== 100 ? ' — should be 100%' : ''}`;
        sumEl.classList.toggle('bad-text', t !== 100);
      };
      rowsEl.addEventListener('input', updateSum);
      rowsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-delcomp]'); if (b) { b.closest('.comp-row').remove(); updateSum(); } });
      el.querySelector('#addComp').addEventListener('click', () => {
        rowsEl.insertAdjacentHTML('beforeend', compRow({ key: '', name: '', weight: 0 }, rowsEl.children.length));
      });
      el.querySelector('#sScale').addEventListener('change', (e) => { el.querySelector('#baseField').hidden = e.target.value !== 'college'; });
      el.querySelector('#setupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const comps = [...rowsEl.querySelectorAll('.comp-row')].map((r) => ({
          key: r.querySelector('.ck').value.trim().toUpperCase(),
          name: r.querySelector('.cn').value.trim(),
          weight: Number(r.querySelector('.cw').value) || 0,
        })).filter((c) => c.key && c.name);
        const keys = comps.map((c) => c.key);
        if (new Set(keys).size !== keys.length) return toast('Each component needs a different short code');
        const total = comps.reduce((s, c) => s + c.weight, 0);
        if (total !== 100) return toast(`Weights add up to ${total}%. Make them total 100%.`);
        const periods = el.querySelector('#sPeriods').value.split(',').map((p) => p.trim()).filter(Boolean);
        if (!periods.length) return toast('Add at least one grading period');
        const orphanC = cls.assessments.filter((a) => !keys.includes(a.comp)).length;
        const orphanP = cls.assessments.filter((a) => !periods.includes(a.period)).length;
        if ((orphanC || orphanP) && !(await confirmBox('Some assessments will be hidden', `${orphanC + orphanP} assessment(s) belong to a component or period you removed. They will not count in grades unless you add it back.`, 'Save anyway', 'primary'))) return;
        Object.assign(cls, {
          name: el.querySelector('#sName').value.trim() || cls.name,
          section: el.querySelector('#sSection').value.trim(),
          schoolYear: el.querySelector('#sSY').value.trim(),
          sortBySex: el.querySelector('#sSort').checked,
          components: comps, periods,
          scale: el.querySelector('#sScale').value,
          collegeBase: Number(el.querySelector('#sBase').value),
        });
        persist();
        toast('Setup saved');
        rerender();
      });
      el.querySelector('#dupBtn').addEventListener('click', async () => {
        const r = await dialog({ title: 'Copy setup', message: 'Creates a new class with the same subject, components, and periods (no students or scores).', fields: [{ name: 'section', label: 'New grade & section', value: '' }], buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Create', value: 'ok', kind: 'primary' }] });
        if (!r) return;
        const copy = { ...structuredClone(cls), id: uid(), section: r.values.section.trim(), students: [], assessments: [], scores: {}, attendance: {}, created: new Date().toISOString() };
        db.classes.push(copy);
        persist();
        location.hash = `#/class/${copy.id}/students`;
      });
      el.querySelector('#delBtn').addEventListener('click', async () => {
        if (!(await confirmBox('Delete this class?', `${cls.name} ${cls.section || ''} with ${cls.students.length} students, all scores, and attendance will be deleted. Export a backup first if unsure.`))) return;
        db.classes = db.classes.filter((c) => c.id !== cls.id);
        persist(true);
        location.replace('#/');
        toast('Class deleted');
      });
    },
  };
}

function compRow(c, i) {
  return `<div class="comp-row">
    <input class="ck" value="${h(c.key)}" placeholder="Code" aria-label="Component ${i + 1} code" maxlength="4">
    <input class="cn" value="${h(c.name)}" placeholder="Name" aria-label="Component ${i + 1} name">
    <input class="cw" value="${c.weight}" type="number" inputmode="decimal" aria-label="Component ${i + 1} weight percent"><span>%</span>
    <button type="button" class="icon-btn" data-delcomp aria-label="Remove component">${icon.trash}</button>
  </div>`;
}

/* ---------- Demo data ---------- */

export function loadDemo() {
  const cls = newClass({ name: 'Mathematics 8', section: 'Grade 8 – Sample', schoolYear: schoolYear(), preset: 'jhs' });
  const boys = ['Aquino, Marco', 'Bautista, Joshua', 'Cruz, Daniel', 'Garcia, Paolo', 'Mendoza, Carlo', 'Ramos, Jericho'];
  const girls = ['Castillo, Angela', 'Dela Cruz, Faith', 'Flores, Grace', 'Lopez, Hannah', 'Reyes, Joy', 'Santos, Mary'];
  cls.students.push(...parseNames(boys.join('\n'), 'M'), ...parseNames(girls.join('\n'), 'F'));
  const add = (comp, title, max, day) => {
    const a = { id: uid(), title, max, comp, period: 'Q1', date: day };
    cls.assessments.push(a);
    cls.scores[a.id] = {};
    cls.students.forEach((s, i) => { cls.scores[a.id][s.id] = Math.max(0, Math.min(max, Math.round(max * (0.55 + ((i * 37) % 45) / 100)))); });
  };
  add('WW', 'Quiz 1: Factoring', 20, '2026-08-12');
  add('WW', 'Quiz 2: Special Products', 15, '2026-08-19');
  add('PT', 'Problem Solving Task', 30, '2026-08-26');
  add('QA', 'Q1 Quarterly Exam', 50, '2026-09-30');
  const d = today();
  cls.attendance[d] = {};
  cls.students.forEach((s, i) => { cls.attendance[d][s.id] = i === 3 ? 'A' : i === 7 ? 'L' : 'P'; });
  persist(true);
}

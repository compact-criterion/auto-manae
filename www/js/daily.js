// Attendance and random picker / group maker.

import { db, persist, getClass, sortedStudents, fullName, shortName, shareFile, shareText, copyText, toCSV, safeFile } from './store.js';
import { h, icon, toast, today, niceDate, rerender } from './ui.js';

export const routes = [
  [/^\/attend$/, () => chooseClass('attend', 'Attendance', icon.attend)],
  [/^\/attend\/([\w]+)(?:\/(summary))?$/, (id, sum) => attendView(id, !!sum)],
  [/^\/picker$/, () => chooseClass('picker', 'Random picker', icon.picker)],
  [/^\/picker\/([\w]+)$/, (id) => pickerView(id)],
];

const lastClass = {};

function chooseClass(kind, title, ic) {
  if (db.classes.length === 1) {
    location.replace(`#/${kind}/${db.classes[0].id}`);
    return { title, tab: kind, html: '' };
  }
  if (lastClass[kind] && getClass(lastClass[kind])) {
    location.replace(`#/${kind}/${lastClass[kind]}`);
    return { title, tab: kind, html: '' };
  }
  return {
    title, tab: kind,
    html: db.classes.length
      ? `<h2>Choose a class</h2><ul class="cards">${db.classes.map((c) => `<li><a class="card class-card" href="#/${kind}/${c.id}"><div><strong>${h(c.name)}</strong><span class="muted">${h(c.section || '')} · ${c.students.length} students</span></div>${icon.chevron}</a></li>`).join('')}</ul>`
      : `<div class="empty">${ic}<p>Create a class and add students first.</p><a class="btn primary" href="#/new-class">${icon.plus} New class</a></div>`,
  };
}

function classSwitcher(kind, cls) {
  if (db.classes.length < 2) return '';
  return `<div class="chips scroll">${db.classes.map((c) => `<a class="chip-btn ${c.id === cls.id ? 'on' : ''}" href="#/${kind}/${c.id}">${h(c.section || c.name)}</a>`).join('')}</div>`;
}

/* ---------------- Attendance ---------------- */

const attDate = {};
const STATES = [['P', 'Present'], ['L', 'Late'], ['A', 'Absent'], ['E', 'Excused']];

function attendView(id, summary) {
  const cls = getClass(id);
  if (!cls) return { title: 'Attendance', tab: 'attend', back: '#/attend', html: '<p>Class not found.</p>' };
  lastClass.attend = id;
  const date = attDate[id] || today();
  const list = sortedStudents(cls);
  const rec = cls.attendance[date] || {};
  const counts = Object.fromEntries(STATES.map(([k]) => [k, list.filter((s) => rec[s.id] === k).length]));
  const unmarked = list.filter((s) => !rec[s.id]).length;

  if (summary) return attendSummary(cls, list);

  const html = `
    ${classSwitcher('attend', cls)}
    <div class="class-head"><strong>${h(cls.name)}</strong><span class="muted">${h(cls.section || '')}</span></div>
    <div class="date-row">
      <button class="icon-btn" id="prevDay" aria-label="Previous day">${icon.back}</button>
      <input type="date" id="attDate" value="${date}" aria-label="Attendance date">
      <button class="icon-btn flip" id="nextDay" aria-label="Next day">${icon.back}</button>
    </div>
    <div class="stat-strip"><span>Present <b>${counts.P}</b></span><span>Late <b>${counts.L}</b></span><span>Absent <b>${counts.A}</b></span><span>Excused <b>${counts.E}</b></span>${unmarked ? `<span>Unmarked <b>${unmarked}</b></span>` : ''}</div>
    <div class="btn-row">
      <button class="btn small" id="allP">Mark rest present</button>
      <a class="btn small" href="#/attend/${id}/summary">${icon.table} Summary</a>
    </div>
    ${list.length ? `<ul class="att-list">${list.map((s, i) => `
      <li><span class="num">${i + 1}</span><span class="grow">${h(fullName(s))}</span>
        <span class="seg-mini" role="radiogroup" aria-label="${h(fullName(s))}">${STATES.map(([k, l]) => `<button class="st-${k} ${rec[s.id] === k ? 'on' : ''}" data-sid="${s.id}" data-st="${k}" role="radio" aria-checked="${rec[s.id] === k}" aria-label="${l}">${k}</button>`).join('')}</span></li>`).join('')}</ul>`
    : `<div class="empty"><p>No students in this class yet.</p><a class="btn" href="#/class/${id}/students">Add students</a></div>`}
    <p class="hint">P = Present · L = Late · A = Absent · E = Excused. Tap again to clear.</p>`;
  return {
    title: 'Attendance', tab: 'attend', html, back: db.classes.length > 1 ? null : null,
    mount(el) {
      const setDate = (d) => { attDate[id] = d; rerender(); };
      el.querySelector('#attDate').addEventListener('change', (e) => e.target.value && setDate(e.target.value));
      const shift = (n) => { const [y, m, d] = date.split('-').map(Number); const dt = new Date(y, m - 1, d + n); setDate(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`); };
      el.querySelector('#prevDay').addEventListener('click', () => shift(-1));
      el.querySelector('#nextDay').addEventListener('click', () => shift(1));
      el.querySelector('#allP').addEventListener('click', () => {
        const r = (cls.attendance[date] ||= {});
        list.forEach((s) => { if (!r[s.id]) r[s.id] = 'P'; });
        persist();
        rerender();
      });
      el.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => {
        const r = (cls.attendance[date] ||= {});
        const { sid, st } = b.dataset;
        if (r[sid] === st) delete r[sid]; else r[sid] = st;
        if (!Object.keys(r).length) delete cls.attendance[date];
        persist();
        rerender();
      }));
    },
  };
}

function attendSummary(cls, list) {
  const dates = Object.keys(cls.attendance).sort();
  const rows = list.map((s) => {
    const c = { P: 0, L: 0, A: 0, E: 0 };
    dates.forEach((d) => { const v = cls.attendance[d][s.id]; if (v) c[v]++; });
    const held = c.P + c.L + c.A;
    return { s, c, rate: held ? ((c.P + c.L) / held) * 100 : null };
  });
  const html = `
    <div class="class-head"><strong>${h(cls.name)}</strong><span class="muted">${h(cls.section || '')} · ${dates.length} day${dates.length === 1 ? '' : 's'} recorded</span></div>
    ${dates.length ? `
    <div class="table-wrap"><table class="grid">
      <thead><tr><th class="sticky">Learner</th><th>P</th><th>L</th><th>A</th><th>E</th><th>Rate</th></tr></thead>
      <tbody>${rows.map(({ s, c, rate }) => `<tr><td class="sticky">${h(fullName(s))}</td><td>${c.P}</td><td>${c.L}</td><td class="${c.A >= 3 ? 'fail' : ''}">${c.A}</td><td>${c.E}</td><td class="${rate != null && rate < 80 ? 'fail' : ''}">${rate == null ? '–' : Math.round(rate) + '%'}</td></tr>`).join('')}</tbody>
    </table></div>
    <p class="hint">Rate = (present + late) ÷ days marked, excluding excused. Red = 3 or more absences or below 80%.</p>
    <h3>Days recorded</h3>
    <ul class="list">${dates.slice().reverse().map((d) => { const r = cls.attendance[d]; const a = Object.values(r).filter((v) => v === 'A').length; return `<li><button class="row" data-date="${d}"><span class="grow">${h(niceDate(d))}</span><span class="badge ${a ? 'warn' : 'ok'}">${a} absent</span>${icon.chevron}</button></li>`; }).join('')}</ul>
    <button class="btn primary" id="attCsv">${icon.share} Export attendance (CSV)</button>`
    : '<div class="empty"><p>No attendance recorded yet.</p></div>'}`;
  return {
    title: 'Attendance summary', tab: 'attend', back: `#/attend/${cls.id}`, html,
    mount(el) {
      el.querySelectorAll('[data-date]').forEach((b) => b.addEventListener('click', () => { attDate[cls.id] = b.dataset.date; location.hash = `#/attend/${cls.id}`; }));
      el.querySelector('#attCsv')?.addEventListener('click', async () => {
        const out = [['#', 'Learner', 'Sex', ...dates, 'Present', 'Late', 'Absent', 'Excused']];
        rows.forEach(({ s, c }, i) => out.push([i + 1, fullName(s), s.sex || '', ...dates.map((d) => cls.attendance[d][s.id] || ''), c.P, c.L, c.A, c.E]));
        try { await shareFile(`${safeFile(cls.name + ' ' + (cls.section || ''))}_attendance.csv`, toCSV(out), 'text/csv'); } catch (e) { toast('Export failed: ' + e.message); }
      });
    },
  };
}

/* ---------------- Random picker & groups ---------------- */

const picked = {}; // classId -> Set of picked ids
const pickerState = {}; // classId -> {noRepeat, presentOnly, last, groups, groupMode, groupN}

function pickerView(id) {
  const cls = getClass(id);
  if (!cls) return { title: 'Picker', tab: 'picker', back: '#/picker', html: '<p>Class not found.</p>' };
  lastClass.picker = id;
  const st = (pickerState[id] ||= { noRepeat: true, presentOnly: true, last: null, groups: null, groupMode: 'count', groupN: 4 });
  const used = (picked[id] ||= new Set());
  const rec = cls.attendance[today()];
  const pool = () => sortedStudents(cls).filter((s) => !(st.presentOnly && rec && rec[s.id] === 'A'));
  const remaining = () => pool().filter((s) => !st.noRepeat || !used.has(s.id));
  const last = cls.students.find((s) => s.id === st.last);
  const html = `
    ${classSwitcher('picker', cls)}
    <section class="pick-card" aria-live="polite">
      <span class="muted" id="pickMeta">${remaining().length} of ${pool().length} left</span>
      <div class="pick-name" id="pickName">${last ? h(shortName(last)) : 'Tap Pick!'}</div>
      <button class="btn primary big" id="pickBtn" ${cls.students.length ? '' : 'disabled'}>${icon.picker} Pick a student</button>
    </section>
    <label class="check"><input type="checkbox" id="noRep" ${st.noRepeat ? 'checked' : ''}> Don't repeat until everyone has been picked</label>
    <label class="check"><input type="checkbox" id="presOnly" ${st.presentOnly ? 'checked' : ''}> Skip students marked absent today</label>
    <button class="btn small" id="resetPick">${icon.refresh} Start over</button>

    <section class="panel">
      <h2>Group maker</h2>
      <div class="inline-form">
        <select id="gMode" aria-label="Group by"><option value="count" ${st.groupMode === 'count' ? 'selected' : ''}>Number of groups</option><option value="size" ${st.groupMode === 'size' ? 'selected' : ''}>Students per group</option></select>
        <input id="gN" type="number" inputmode="numeric" min="1" value="${st.groupN}" aria-label="How many">
        <button class="btn primary" id="gBtn">Make groups</button>
      </div>
      <div id="groups">${st.groups ? groupsHTML(cls, st.groups) : ''}</div>
      ${st.groups ? `<button class="btn" id="gShare">${icon.share} Share groups</button>` : ''}
    </section>`;
  return {
    title: 'Random picker', tab: 'picker', html,
    mount(el) {
      const nameEl = el.querySelector('#pickName');
      el.querySelector('#pickBtn').addEventListener('click', () => {
        let rem = remaining();
        if (!rem.length) { used.clear(); rem = remaining(); toast('Everyone has been picked. Starting a new round.'); }
        if (!rem.length) return toast('No students available');
        const choice = rem[Math.floor(Math.random() * rem.length)];
        const all = pool();
        let n = 0;
        nameEl.classList.add('spinning');
        const spin = setInterval(() => {
          nameEl.textContent = shortName(all[Math.floor(Math.random() * all.length)]);
          if (++n > 12) {
            clearInterval(spin);
            nameEl.classList.remove('spinning');
            nameEl.textContent = shortName(choice);
            used.add(choice.id);
            st.last = choice.id;
            el.querySelector('#pickMeta').textContent = `${remaining().length} of ${all.length} left`;
            navigator.vibrate?.(40);
          }
        }, 60);
      });
      el.querySelector('#noRep').addEventListener('change', (e) => { st.noRepeat = e.target.checked; rerender(); });
      el.querySelector('#presOnly').addEventListener('change', (e) => { st.presentOnly = e.target.checked; rerender(); });
      el.querySelector('#resetPick').addEventListener('click', () => { used.clear(); st.last = null; rerender(); });
      el.querySelector('#gBtn').addEventListener('click', () => {
        st.groupMode = el.querySelector('#gMode').value;
        st.groupN = Math.max(1, parseInt(el.querySelector('#gN').value, 10) || 1);
        const ppl = shuffle(pool());
        if (!ppl.length) return toast('No students to group');
        const k = st.groupMode === 'count' ? Math.min(st.groupN, ppl.length) : Math.max(1, Math.ceil(ppl.length / st.groupN));
        const groups = Array.from({ length: k }, () => []);
        ppl.forEach((s, i) => groups[i % k].push(s.id));
        st.groups = groups;
        rerender();
      });
      el.querySelector('#gShare')?.addEventListener('click', async () => {
        const byId = Object.fromEntries(cls.students.map((s) => [s.id, s]));
        const text = `${cls.name} ${cls.section || ''} – Groups\n\n` + st.groups.map((g, i) => `Group ${i + 1}\n${g.map((sid) => '• ' + (byId[sid] ? shortName(byId[sid]) : '')).join('\n')}`).join('\n\n');
        if (!(await shareText('Groups', text))) { await copyText(text); toast('Copied to clipboard'); }
      });
    },
  };
}

function groupsHTML(cls, groups) {
  const byId = Object.fromEntries(cls.students.map((s) => [s.id, s]));
  return `<div class="groups">${groups.map((g, i) => `<div class="group"><strong>Group ${i + 1}</strong><ol>${g.filter((sid) => byId[sid]).map((sid) => `<li>${h(shortName(byId[sid]))}</li>`).join('')}</ol></div>`).join('')}</div>`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

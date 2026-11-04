// MathGuro – app shell, router, home and settings screens.

import { db, persist, exportJSON, importJSON, shareFile } from './store.js';
import { h, $, icon, toast, dialog, confirmBox, today, niceDate } from './ui.js';
import * as classes from './classes.js';
import * as daily from './daily.js';
import * as quiz from './quizui.js';
import * as tools from './tools.js';

const VERSES = [
  ['Colossians 3:23', 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men;'],
  ['Proverbs 1:7', 'The fear of the LORD is the beginning of knowledge: but fools despise wisdom and instruction.'],
  ['James 1:5', 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.'],
  ['Psalm 90:12', 'So teach us to number our days, that we may apply our hearts unto wisdom.'],
  ['2 Timothy 2:15', 'Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth.'],
  ['Proverbs 22:6', 'Train up a child in the way he should go: and when he is old, he will not depart from it.'],
  ['1 Corinthians 14:40', 'Let all things be done decently and in order.'],
  ['Proverbs 9:10', 'The fear of the LORD is the beginning of wisdom: and the knowledge of the holy is understanding.'],
  ['Galatians 6:9', 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.'],
  ['Isaiah 40:31', 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'],
  ['Proverbs 4:7', 'Wisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding.'],
  ['Psalm 147:5', 'Great is our Lord, and of great power: his understanding is infinite.'],
  ['Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'],
  ['Matthew 5:16', 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.'],
];

const NAV = [
  { href: '#/', key: 'classes', label: 'Classes', icon: icon.classes },
  { href: '#/attend', key: 'attend', label: 'Attendance', icon: icon.attend },
  { href: '#/picker', key: 'picker', label: 'Picker', icon: icon.picker },
  { href: '#/quiz', key: 'quiz', label: 'Quiz', icon: icon.quiz },
  { href: '#/tools', key: 'tools', label: 'Tools', icon: icon.tools },
];

const routes = [
  [/^\/?$/, () => home()],
  [/^\/settings$/, () => settings()],
  ...classes.routes,
  ...daily.routes,
  ...quiz.routes,
  ...tools.routes,
];

function shell() {
  document.body.innerHTML = `
    <header class="topbar">
      <a class="icon-btn" id="backBtn" href="#/" aria-label="Back">${icon.back}</a>
      <h1 id="title">MathGuro</h1>
      <a class="icon-btn" href="#/settings" aria-label="Settings and backup">${icon.gear}</a>
    </header>
    <main id="view" tabindex="-1"></main>
    <nav class="tabbar" aria-label="Main">
      ${NAV.map((n) => `<a href="${n.href}" data-tab="${n.key}">${n.icon}<span>${n.label}</span></a>`).join('')}
    </nav>`;
}

let cleanup = null;
function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  let view = null;
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) { view = fn(...m.slice(1).map((x) => (x === undefined ? undefined : decodeURIComponent(x)))); break; }
  }
  if (!view) { location.replace('#/'); return; }
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  $('#title').textContent = view.title;
  const back = $('#backBtn');
  back.style.visibility = view.back ? 'visible' : 'hidden';
  if (view.back) back.setAttribute('href', view.back);
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === view.tab));
  const el = $('#view');
  el.className = view.wide ? 'wide' : '';
  el.innerHTML = view.html;
  if (!view.keepScroll && !window.__keepScroll) window.scrollTo(0, 0);
  window.__keepScroll = false;
  if (view.mount) cleanup = view.mount(el) || null;
}

/* ---------------- Home ---------------- */

function verseOfDay() {
  const d = new Date();
  const n = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  return VERSES[n % VERSES.length];
}

function home() {
  const list = db.classes;
  const needBackup = list.length && (!db.settings.lastBackup || (Date.now() - new Date(db.settings.lastBackup)) / 864e5 > 14);
  const [ref, text] = verseOfDay();
  const html = `
    ${db.settings.showVerse ? `<section class="verse"><p>“${h(text)}”</p><cite>${h(ref)} (KJV)</cite></section>` : ''}
    ${needBackup ? `<a class="banner" href="#/settings"><strong>Back up your class records.</strong> Your data lives only on this phone. ${db.settings.lastBackup ? `Last backup: ${h(niceDate(db.settings.lastBackup.slice(0, 10)))}.` : 'No backup yet.'}</a>` : ''}
    <div class="section-head"><h2>My classes</h2><a class="btn primary small" href="#/new-class">${icon.plus} New class</a></div>
    ${list.length ? `<ul class="cards">${list.map((c) => `
      <li><a class="card class-card" href="#/class/${c.id}">
        <div>
          <strong>${h(c.name)}</strong>
          <span class="muted">${h([c.section, c.schoolYear].filter(Boolean).join(' · '))}</span>
          <span class="chips"><span class="chip">${c.students.length} students</span><span class="chip">${c.assessments.length} assessments</span>${attendToday(c)}</span>
        </div>${icon.chevron}</a></li>`).join('')}</ul>`
    : `<div class="empty">
        ${icon.classes}
        <p><strong>No classes yet.</strong></p>
        <p class="muted">Add your Grade 8–12 sections and your Mathematics in the Modern World class. Each class keeps its own students, scores, and attendance.</p>
        <a class="btn primary" href="#/new-class">${icon.plus} Add your first class</a>
        <button class="btn" id="demoBtn">Try with sample data</button>
      </div>`}`;
  return {
    title: 'MathGuro', tab: 'classes', html,
    mount(el) {
      el.querySelector('#demoBtn')?.addEventListener('click', () => { classes.loadDemo(); render(); toast('Sample class added'); });
    },
  };
}

function attendToday(c) {
  const rec = c.attendance?.[today()];
  if (!rec) return '';
  const present = Object.values(rec).filter((v) => v === 'P' || v === 'L').length;
  return `<span class="chip ok">Today: ${present}/${c.students.length} present</span>`;
}

/* ---------------- Settings & backup ---------------- */

function settings() {
  const s = db.settings;
  const nStudents = db.classes.reduce((a, c) => a + c.students.length, 0);
  const html = `
    <section class="panel">
      <h2>Backup &amp; restore</h2>
      <p class="muted">Everything is saved on this phone only. Export a backup file regularly and keep it in Google Drive, Gmail, or Messenger. If you change phones or uninstall the app, restore from that file.</p>
      <p><strong>${db.classes.length}</strong> classes · <strong>${nStudents}</strong> students · <strong>${db.quizzes.length}</strong> saved quizzes</p>
      <p class="muted">Last backup: ${s.lastBackup ? h(new Date(s.lastBackup).toLocaleString('en-PH')) : 'never'}</p>
      <div class="btn-row">
        <button class="btn primary" id="exportBtn">${icon.save} Export backup</button>
        <label class="btn">${icon.refresh} Restore backup<input type="file" id="importFile" accept=".json,application/json,text/plain" hidden></label>
      </div>
    </section>
    <section class="panel">
      <h2>Profile</h2>
      <div class="field"><label for="tName">Teacher name (printed on quizzes)</label><input id="tName" value="${h(s.teacher)}" placeholder="e.g., Mr. Juan Dela Cruz"></div>
      <div class="field"><label for="tSchool">School</label><input id="tSchool" value="${h(s.school)}"></div>
      <label class="check"><input type="checkbox" id="verseToggle" ${s.showVerse ? 'checked' : ''}> Show a Bible verse (KJV) on the home screen</label>
    </section>
    <section class="panel">
      <h2>About</h2>
      <p>MathGuro 1.0 — class record (DepEd DO 8, s. 2015 weights and transmutation; college 1.00–5.00 scale), attendance, random picker, quiz generator, and math tools.</p>
      <p class="muted">Works fully offline. No account, no ads, no data leaves your phone unless you share it.</p>
    </section>
    <section class="panel danger-zone">
      <h2>Erase everything</h2>
      <p class="muted">Deletes all classes, scores, attendance, and saved quizzes from this phone.</p>
      <button class="btn danger" id="wipeBtn">${icon.trash} Erase all data</button>
    </section>`;
  return {
    title: 'Settings & Backup', back: '#/', html,
    mount(el) {
      el.querySelector('#exportBtn').addEventListener('click', async () => {
        try {
          db.settings.lastBackup = new Date().toISOString();
          persist(true);
          await shareFile(`MathGuro-backup-${today()}.json`, exportJSON(), 'application/json');
          toast('Backup ready');
        } catch (e) { toast('Export failed: ' + e.message); }
      });
      el.querySelector('#importFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const r = await dialog({
          title: 'Restore backup',
          message: `File: ${file.name}. Replace everything on this phone with the backup, or add the backup's classes to what you already have?`,
          buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Add', value: 'merge' }, { label: 'Replace', value: 'replace', kind: 'primary' }],
        });
        e.target.value = '';
        if (!r) return;
        try {
          const n = importJSON(text, r.button);
          toast(`Restored ${n} class${n === 1 ? '' : 'es'}`);
          location.hash = '#/';
        } catch (err) { toast(err.message); }
      });
      const save = () => {
        db.settings.teacher = el.querySelector('#tName').value.trim();
        db.settings.school = el.querySelector('#tSchool').value.trim();
        db.settings.showVerse = el.querySelector('#verseToggle').checked;
        persist();
      };
      el.querySelectorAll('#tName,#tSchool,#verseToggle').forEach((i) => i.addEventListener('change', save));
      el.querySelector('#wipeBtn').addEventListener('click', async () => {
        if (!(await confirmBox('Erase all data?', 'This cannot be undone. Export a backup first if you might need it.', 'Erase'))) return;
        db.classes = []; db.quizzes = [];
        persist(true);
        toast('All data erased');
        location.hash = '#/';
      });
    },
  };
}

/* ---------------- Boot ---------------- */

shell();
window.addEventListener('hashchange', render);
render();

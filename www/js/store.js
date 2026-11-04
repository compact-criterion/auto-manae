// Local data store (on-device only) + backup/restore + file sharing.

import { PRESETS } from './grading.js';

const KEY = 'mathguro.data.v1';

function blank() {
  return {
    version: 1,
    classes: [],
    quizzes: [],
    settings: { showVerse: true, teacher: '', school: 'Baptist Bible Seminary and Institute', lastBackup: null },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const d = JSON.parse(raw);
    return migrate(d);
  } catch (e) {
    console.error(e);
    return blank();
  }
}

function migrate(d) {
  const b = blank();
  const out = { ...b, ...d, settings: { ...b.settings, ...(d.settings || {}) } };
  out.classes = (out.classes || []).map((c) => ({
    students: [], assessments: [], scores: {}, attendance: {}, ...c,
  }));
  out.quizzes = out.quizzes || [];
  return out;
}

export const db = load();

let saveTimer = null;
export function persist(now = false) {
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      alert('Could not save data on this phone: ' + e.message);
    }
  };
  clearTimeout(saveTimer);
  if (now) write();
  else saveTimer = setTimeout(write, 150);
}
window.addEventListener('pagehide', () => persist(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(true); });

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function getClass(id) {
  return db.classes.find((c) => c.id === id);
}

export function newClass({ name, section, schoolYear, preset }) {
  const p = structuredClone(PRESETS[preset]);
  const cls = {
    id: uid(), name, section, schoolYear, preset,
    scale: p.scale, collegeBase: 0, periods: p.periods, components: p.components,
    sortBySex: preset !== 'college',
    students: [], assessments: [], scores: {}, attendance: {},
    created: new Date().toISOString(),
  };
  db.classes.push(cls);
  persist();
  return cls;
}

export function sortedStudents(cls) {
  const list = [...cls.students];
  list.sort((a, b) => {
    if (cls.sortBySex) {
      const sa = a.sex === 'M' ? 0 : a.sex === 'F' ? 1 : 2;
      const sb = b.sex === 'M' ? 0 : b.sex === 'F' ? 1 : 2;
      if (sa !== sb) return sa - sb;
    }
    return (a.last + ' ' + a.first).localeCompare(b.last + ' ' + b.first, 'en', { sensitivity: 'base' });
  });
  return list;
}

export const fullName = (s) => (s.first ? `${s.last}, ${s.first}` : s.last);
export const shortName = (s) => (s.first ? `${s.first} ${s.last}` : s.last);

/** Parse "Last, First" / "First Last" lines into students. */
export function parseNames(text, sex = '') {
  return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    let sx = sex;
    const m = line.match(/\s*[-–(|]\s*([MF])\)?\s*$/i);
    if (m) { sx = m[1].toUpperCase(); line = line.slice(0, m.index).trim(); }
    line = line.replace(/^\d+[.)]\s*/, '');
    let last, first;
    if (line.includes(',')) {
      [last, ...first] = line.split(',');
      first = first.join(',').trim();
    } else {
      const parts = line.split(/\s+/);
      last = parts.length > 1 ? parts.pop() : parts[0];
      first = parts.length ? parts.join(' ') : '';
      if (parts.length === 0) first = '';
    }
    return { id: uid(), last: last.trim(), first, sex: sx };
  });
}

/* ---------------- Backup ---------------- */

export function exportJSON() {
  return JSON.stringify({ app: 'MathGuro', exported: new Date().toISOString(), ...db }, null, 1);
}

export function importJSON(text, mode = 'replace') {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.classes)) throw new Error('This file is not a MathGuro backup.');
  const m = migrate(d);
  if (mode === 'replace') {
    db.classes = m.classes;
    db.quizzes = m.quizzes;
    db.settings = { ...db.settings, ...m.settings };
  } else {
    const ids = new Set(db.classes.map((c) => c.id));
    for (const c of m.classes) {
      if (ids.has(c.id)) c.id = uid();
      db.classes.push(c);
    }
    const qids = new Set(db.quizzes.map((q) => q.id));
    for (const q of m.quizzes) if (!qids.has(q.id)) db.quizzes.push(q);
  }
  persist(true);
  return m.classes.length;
}

/* ---------------- Files & sharing ---------------- */

const native = () => window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins;

/** Save/share a text file. On the phone this opens Android's share sheet
 *  (save to Drive, Files, Messenger, Gmail…). In a browser it downloads. */
export async function shareFile(filename, text, mime = 'text/plain') {
  const P = native();
  if (P && P.Filesystem && P.Share) {
    const res = await P.Filesystem.writeFile({ path: filename, data: text, directory: 'CACHE', encoding: 'utf8', recursive: true });
    try {
      await P.Share.share({ title: filename, url: res.uri, dialogTitle: `Save or send ${filename}` });
    } catch (e) {
      if (!/cancel/i.test(String(e?.message || e))) throw e;
    }
    return;
  }
  const blob = new Blob([mime.startsWith('text/csv') ? '﻿' + text : text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function shareText(title, text) {
  const P = native();
  if (P && P.Share) {
    try { await P.Share.share({ title, text, dialogTitle: title }); } catch (e) { if (!/cancel/i.test(String(e?.message || e))) throw e; }
    return true;
  }
  if (navigator.share) { try { await navigator.share({ title, text }); return true; } catch { return false; } }
  return false;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function toCSV(rows) {
  return rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
}

export const safeFile = (s) => String(s).replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'file';

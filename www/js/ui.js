// Small UI helpers: escaping, icons, toast, dialogs.

export const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const icon = {
  classes: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h5"/>'),
  attend: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  picker: svg('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  quiz: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
  tools: svg('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  back: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>'),
  copy: svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  trash: svg('<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  play: svg('<path d="m6 3 14 9-14 9z"/>'),
  refresh: svg('<path d="M21 2v6h-6M3 22v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L21 8M3 16l2.64 2.36A9 9 0 0 0 20.49 15"/>'),
  save: svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'),
  chevron: svg('<path d="m9 18 6-6-6-6"/>'),
  users: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  graph: svg('<path d="M3 3v18h18"/><path d="M7 15c2-6 4-9 6-4s4 2 6-4"/>'),
  sigma: svg('<path d="M18 4H6l6 8-6 8h12"/>'),
  bell: svg('<path d="M3 3v18h18"/><path d="M5 18c3-1 4-12 7-12s4 11 7 12"/>'),
  parabola: svg('<path d="M4 4c2 14 14 14 16 0"/><path d="M2 20h20"/>'),
  logic: svg('<path d="M4 6h6M4 12h16M4 18h10"/><path d="m15 4 4 4-4 4"/>'),
  venn: svg('<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>'),
  hash: svg('<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>'),
  seq: svg('<circle cx="5" cy="17" r="1.5"/><circle cx="10" cy="13" r="1.5"/><circle cx="15" cy="9" r="1.5"/><circle cx="20" cy="5" r="1.5"/>'),
  peso: svg('<path d="M7 21V3h6a5 5 0 0 1 0 10H7M4 7h16M4 10h16"/>'),
  count: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M17.5 14v7M14 17.5h7"/>'),
  table: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'),
  scatter: svg('<path d="M3 3v18h18"/><path d="M6 17 20 6" stroke-dasharray="2 2"/><circle cx="8" cy="14" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="15" cy="8" r="1"/><circle cx="18" cy="9" r="1"/>'),
  book: svg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
};

let toastTimer;
export function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/**
 * Show a modal sheet. fields: [{name,label,type,value,options,placeholder,rows,inputmode}]
 * buttons: [{label, value, kind}] ; resolves to {button, values} or null when dismissed.
 */
export function dialog({ title, message = '', fields = [], buttons = [{ label: 'OK', value: 'ok', kind: 'primary' }], html = '' }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-backdrop';
    const fieldHTML = fields.map((f, i) => {
      const id = `dlg-${f.name}-${i}`;
      const label = f.label ? `<label for="${id}">${h(f.label)}</label>` : '';
      if (f.type === 'textarea') return `<div class="field">${label}<textarea id="${id}" name="${f.name}" rows="${f.rows || 6}" placeholder="${h(f.placeholder || '')}">${h(f.value || '')}</textarea>${f.hint ? `<p class="hint">${h(f.hint)}</p>` : ''}</div>`;
      if (f.type === 'select') return `<div class="field">${label}<select id="${id}" name="${f.name}">${f.options.map((o) => `<option value="${h(o.value)}" ${String(o.value) === String(f.value) ? 'selected' : ''}>${h(o.label)}</option>`).join('')}</select>${f.hint ? `<p class="hint">${h(f.hint)}</p>` : ''}</div>`;
      if (f.type === 'checkbox') return `<label class="check"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''}> ${h(f.label)}</label>`;
      return `<div class="field">${label}<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${h(f.value ?? '')}" placeholder="${h(f.placeholder || '')}" ${f.inputmode ? `inputmode="${f.inputmode}"` : ''} ${f.step ? `step="${f.step}"` : ''}>${f.hint ? `<p class="hint">${h(f.hint)}</p>` : ''}</div>`;
    }).join('');
    wrap.innerHTML = `
      <form class="sheet" role="dialog" aria-modal="true" aria-label="${h(title)}">
        <div class="sheet-grip"></div>
        <h2>${h(title)}</h2>
        ${message ? `<p class="muted">${h(message)}</p>` : ''}
        ${html}
        ${fieldHTML}
        <div class="sheet-actions">
          ${buttons.map((b) => `<button type="${(b.kind || '').split(' ').includes('primary') ? 'submit' : 'button'}" class="btn ${b.kind || ''}" data-v="${h(b.value)}">${h(b.label)}</button>`).join('')}
        </div>
      </form>`;
    document.body.appendChild(wrap);
    document.body.classList.add('modal-open');
    const form = wrap.querySelector('form');
    const first = form.querySelector('input:not([type=checkbox]),textarea,select');
    if (first && fields.length) setTimeout(() => first.focus(), 60);
    const close = (result) => {
      wrap.remove();
      document.body.classList.remove('modal-open');
      window.removeEventListener('hashchange', onNav);
      resolve(result);
    };
    const onNav = () => close(null);
    window.addEventListener('hashchange', onNav);
    const values = () => {
      const v = {};
      fields.forEach((f) => {
        const el = form.elements[f.name];
        v[f.name] = f.type === 'checkbox' ? el.checked : el.value;
      });
      return v;
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      close({ button: btn.dataset.v, values: values() });
    });
    form.addEventListener('click', (e) => {
      const b = e.target.closest('button[type=button]');
      if (b) close(b.dataset.v === 'cancel' ? null : { button: b.dataset.v, values: values() });
    });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(null); });
  });
}

export async function confirmBox(title, message, okLabel = 'Delete', kind = 'danger') {
  const r = await dialog({ title, message, buttons: [{ label: 'Cancel', value: 'cancel' }, { label: okLabel, value: 'ok', kind: kind === 'danger' ? 'primary danger' : 'primary' }] });
  return !!r;
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function niceDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Re-render the current screen, keeping the scroll position. */
export function rerender() {
  window.__keepScroll = true;
  window.dispatchEvent(new Event('hashchange'));
}

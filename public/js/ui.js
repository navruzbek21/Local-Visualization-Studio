// Небольшие помощники для построения интерфейса без фреймворков.

// h('div.cls#id', {attrs, on: {click}}, ...children)
export function h(tag, props, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag) || [];
  const el = document.createElement(m[1] || 'div');
  (m[2] || '').replace(/([.#])([\w-]+)/g, (_, t, v) => {
    if (t === '.') el.classList.add(v);
    else el.id = v;
  });
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className += ' ' + v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function svg(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstChild;
}

// Иконки (контурные, 24×24)
const P = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  tablet: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M11 18h2"/>',
  mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  db: '<ellipse cx="12" cy="5.5" rx="7" ry="2.5"/><path d="M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  html: '<path d="M4 4h16v16H4z"/><path d="M8 9l-2 3 2 3M16 9l2 3-2 3M13 8l-2 8"/>',
  embed: '<path d="M3 5h18v14H3z"/><path d="M3 9h18"/><circle cx="6" cy="7" r=".6"/><circle cx="8.3" cy="7" r=".6"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.6L4 8"/><path d="M4 4v4h4M4 13a8 8 0 0 0 14.6 4.6L20 16"/><path d="M20 20v-4h-4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  transpose: '<path d="M4 4h7v7H4zM13 13h7v7h-7z"/><path d="M15 4h3a2 2 0 0 1 2 2v3M9 20H6a2 2 0 0 1-2-2v-3"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1.3-1-1.6-1-2.9 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  logo: '<rect x="4" y="12" width="3.5" height="8" rx="1" fill="#fff" stroke="none"/><rect x="10.25" y="7" width="3.5" height="13" rx="1" fill="#fff" stroke="none"/><rect x="16.5" y="3.5" width="3.5" height="16.5" rx="1" fill="#fff" stroke="none"/>',
};

export function icon(name, cls) {
  return svg(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''}>${P[name] || ''}</svg>`);
}

export function button(label, opts = {}) {
  const b = h('button.btn', { type: 'button', title: opts.title, disabled: opts.disabled, on: { click: opts.onClick } });
  if (opts.cls) opts.cls.split(' ').forEach((c) => c && b.classList.add(c));
  if (opts.icon) b.appendChild(icon(opts.icon));
  if (label) b.appendChild(document.createTextNode(label));
  if (!label && opts.icon) b.classList.add('icon');
  if (opts.title) b.setAttribute('aria-label', opts.title);
  return b;
}

// ------------------------------------------------------------ уведомления
export function toast(msg, kind = '') {
  const t = h('div.toast', { class: kind }, msg);
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), kind === 'error' ? 6000 : 3000);
}

// ------------------------------------------------------------ модальные окна
export function modal({ title, body, footer, size = '', onClose, dismissable = true }) {
  const back = h('div.modal-back');
  const closeBtn = button('', { icon: 'close', cls: 'ghost sm', title: 'Закрыть' });
  const box = h('div.modal', { class: size, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div.modal-head', h('h2', title), closeBtn),
    h('div.modal-body', body),
    footer ? h('div.modal-foot', footer) : null,
  );
  back.appendChild(box);
  const prevFocus = document.activeElement;
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && dismissable) {
      e.stopPropagation();
      close();
    }
  };
  closeBtn.onclick = close;
  back.addEventListener('mousedown', (e) => {
    if (e.target === back && dismissable) close();
  });
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(back);
  setTimeout(() => {
    const f = box.querySelector('[autofocus], .modal-body input, .modal-body textarea, .modal-body select, .modal-foot .primary');
    (f || closeBtn).focus();
  }, 30);
  return { close, el: box, body: box.querySelector('.modal-body') };
}

export function confirmDialog(text, { ok = 'Удалить', danger = true, title = 'Подтверждение' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const okBtn = button(ok, { cls: danger ? 'danger solid' : 'primary', onClick: () => { done = true; m.close(); resolve(true); } });
    const m = modal({
      title,
      body: h('p', { style: { margin: 0 } }, text),
      footer: [button('Отмена', { onClick: () => m.close() }), okBtn],
      onClose: () => { if (!done) resolve(false); },
    });
    setTimeout(() => okBtn.focus(), 40);
  });
}

export function promptDialog(title, { label = '', value = '', ok = 'Сохранить', placeholder = '', multiline = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const inp = multiline ? h('textarea.textarea', { placeholder, rows: 4 }) : h('input.input', { value, placeholder });
    if (multiline) inp.value = value;
    const submit = () => { done = true; m.close(); resolve(inp.value); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !multiline) submit(); });
    const m = modal({
      title,
      body: h('label.field', label ? h('span', label) : null, inp),
      footer: [button('Отмена', { onClick: () => m.close() }), button(ok, { cls: 'primary', onClick: submit })],
      onClose: () => { if (!done) resolve(null); },
    });
    setTimeout(() => { inp.focus(); inp.select?.(); }, 40);
  });
}

// ------------------------------------------------------------ выпадающее меню
let openMenu = null;
export function menu(anchor, items, { align = 'left' } = {}) {
  closeMenu();
  const m = h('div.menu', { role: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it === '-') m.appendChild(h('hr'));
    else if (it.label && !it.onClick) m.appendChild(h('div.menu-label', it.label));
    else {
      const b = h('button', { type: 'button', role: 'menuitem', class: it.danger ? 'danger' : '', disabled: it.disabled },
        it.icon ? icon(it.icon) : null, h('span', it.text));
      b.onclick = () => { closeMenu(); it.onClick(); };
      m.appendChild(b);
    }
  }
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = align === 'right' ? r.right - mw : r.left;
  let top = r.bottom + 4;
  if (left + mw > innerWidth - 8) left = innerWidth - mw - 8;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  m.style.left = Math.max(8, left) + 'px';
  m.style.top = top + 'px';
  openMenu = m;
  setTimeout(() => {
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', escKey, true);
  });
  m.querySelector('button')?.focus();
  return m;
}
export function menuAt(x, y, items) {
  const fake = { getBoundingClientRect: () => ({ left: x, right: x, top: y, bottom: y }) };
  return menu(fake, items);
}
function outside(e) {
  if (openMenu && !openMenu.contains(e.target)) closeMenu();
}
function escKey(e) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    closeMenu();
  }
}
export function closeMenu() {
  if (openMenu) openMenu.remove();
  openMenu = null;
  document.removeEventListener('mousedown', outside, true);
  document.removeEventListener('keydown', escKey, true);
}

// ------------------------------------------------------------ разное
export function debounce(fn, ms) {
  let t;
  const d = (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  d.flush = (...a) => {
    clearTimeout(t);
    fn(...a);
  };
  d.cancel = () => clearTimeout(t);
  return d;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFilename(s) {
  return (String(s || 'visualization').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'visualization').slice(0, 100);
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return 'сегодня, ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

export function pickFile(accept, multiple = false) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    inp.onchange = () => {
      resolve(multiple ? [...inp.files] : inp.files[0] || null);
      inp.remove();
    };
    document.body.appendChild(inp);
    inp.click();
  });
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

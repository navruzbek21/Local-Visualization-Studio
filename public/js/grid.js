// Электронная таблица для вкладки «Данные»: виртуальная прокрутка, выделение, правка,
// копирование/вставка (совместимо с Excel), контекстное меню, изменение ширины колонок.
import { h, menuAt } from './ui.js';
import { parseCsv } from './importers.js';

const ROW_H = 28;
const HEAD_H = 28;
const ROWNUM_W = 48;
const DEF_W = 140;

export class Sheet {
  constructor(container, { data, onChange, colStyles = {} }) {
    this.onChange = onChange;
    this.colStyles = colStyles;
    this.widths = [];
    this.active = { r: 1, c: 0 };
    this.anchor = { r: 1, c: 0 };
    this.edit = null;
    this.el = h('div.sheet', { tabindex: 0, role: 'grid', 'aria-label': 'Таблица данных' });
    this.inner = h('div.sheet-inner');
    this.top = h('div', { style: { position: 'sticky', top: '0', zIndex: '4' } });
    this.body = h('div.sheet-rows');
    this.inner.append(this.top, this.body);
    this.el.appendChild(this.inner);
    container.appendChild(this.el);
    this.setData(data);
    this.#bind();
  }

  // ------------------------------------------------------------ данные
  setData(data) {
    this.data = Array.isArray(data) && data.length ? data : [['']];
    this.types = [];
    const width = this.dataWidth();
    for (let c = 0; c < width; c++) {
      const vals = [];
      for (let r = 1; r < this.data.length && vals.length < 300; r++) vals.push(this.data[r]?.[c]);
      this.types[c] = window.VS.inferType(vals);
    }
    this.render();
  }
  setColStyles(styles) {
    this.colStyles = styles || {};
    this.render();
  }
  dataWidth() {
    let w = 0;
    for (const r of this.data) if (r && r.length > w) w = r.length;
    return w;
  }
  get nRows() {
    return Math.max(this.data.length + 30, 60);
  }
  get nCols() {
    return Math.max(this.dataWidth() + 5, 12);
  }
  width(c) {
    return this.widths[c] || DEF_W;
  }
  cell(r, c) {
    const row = this.data[r];
    const v = row ? row[c] : undefined;
    return v === undefined || v === null ? '' : String(v);
  }

  // Изменение данных без мутаций: копируем только затронутые строки
  #commit(next, kind) {
    // убираем пустые строки снизу и пустые колонки справа
    while (next.length > 1 && (!next[next.length - 1] || next[next.length - 1].every((v) => v === '' || v == null))) next.pop();
    let w = 0;
    for (const r of next) {
      if (!r) continue;
      let k = r.length;
      while (k > 0 && (r[k - 1] === '' || r[k - 1] == null)) k--;
      w = Math.max(w, k);
    }
    next = next.map((r) => {
      r = r ? r.slice(0, w) : [];
      while (r.length < w) r.push('');
      return r;
    });
    if (!next.length) next = [['']];
    this.setData(next);
    this.onChange?.(next, kind);
  }
  #writeCells(r0, c0, block) {
    const next = this.data.slice();
    block.forEach((vals, i) => {
      const r = r0 + i;
      while (next.length <= r) next.push([]);
      const row = (next[r] || []).slice();
      vals.forEach((v, j) => {
        const c = c0 + j;
        while (row.length <= c) row.push('');
        row[c] = v;
      });
      next[r] = row;
    });
    this.#commit(next, 'edit');
  }

  // ------------------------------------------------------------ отрисовка
  render() {
    const nCols = this.nCols;
    let total = ROWNUM_W;
    for (let c = 0; c < nCols; c++) total += this.width(c);
    this.totalW = total;
    this.inner.style.width = total + 'px';
    this.inner.style.height = HEAD_H + ROW_H * this.nRows + 'px';
    this.body.style.height = ROW_H * (this.nRows - 1) + 'px';
    this.#renderTop();
    this.#renderRows(true);
  }

  #sel() {
    const a = this.anchor, b = this.active;
    return { r0: Math.min(a.r, b.r), r1: Math.max(a.r, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) };
  }

  #rowHtml(r, sel, nCols) {
    const isHead = r === 0;
    const width = this.dataWidth();
    let html = `<div class="sheet-rowh${r >= sel.r0 && r <= sel.r1 ? ' sel' : ''}" data-r="${r}">${isHead ? '' : r}</div>`;
    for (let c = 0; c < nCols; c++) {
      const v = this.cell(r, c);
      const st = this.colStyles[c];
      let cls = 'sheet-cell';
      if (!isHead && this.types[c] === 'number') cls += ' num';
      if (r >= this.data.length || c >= width) cls += ' extra';
      const inSel = r >= sel.r0 && r <= sel.r1 && c >= sel.c0 && c <= sel.c1;
      if (inSel && (sel.r0 !== sel.r1 || sel.c0 !== sel.c1)) cls += ' in';
      let style = `width:${this.width(c)}px`;
      if (r === this.active.r && c === this.active.c) style += ';box-shadow:inset 0 0 0 2px var(--accent)';
      else if (st && !inSel) style += `;background:${isHead ? hexA(st.color, 0.16) : hexA(st.color, 0.06)}`;
      html += `<div class="${cls}" style="${style}" data-r="${r}" data-c="${c}">${esc(v)}</div>`;
    }
    return html;
  }

  #renderTop() {
    const nCols = this.nCols;
    const sel = this.#sel();
    let letters = '<div class="sheet-corner" title="Выделить всё"></div>';
    for (let c = 0; c < nCols; c++) {
      const st = this.colStyles[c];
      const isSel = c >= sel.c0 && c <= sel.c1;
      const bg = st ? `background:${hexA(st.color, 0.22)};color:${st.color};box-shadow:inset 0 -3px 0 ${st.color};` : '';
      letters += `<div class="sheet-colh${isSel ? ' sel' : ''}" style="width:${this.width(c)}px;${isSel ? '' : bg}" data-c="${c}" title="${st ? esc(st.label) : ''}">` +
        `<span>${window.VS.colLetter(c)}</span>${st ? `<span class="bl">· ${esc(st.label)}</span>` : ''}<div class="resizer" data-c="${c}"></div></div>`;
    }
    this.top.innerHTML =
      `<div class="sheet-cols">${letters}</div>` +
      `<div class="sheet-row header" style="position:relative">${this.#rowHtml(0, sel, nCols)}</div>`;
  }

  #renderRows(force) {
    const top = this.el.scrollTop;
    const viewH = this.el.clientHeight || 600;
    const first = Math.max(1, Math.floor(top / ROW_H) - 4 + 1);
    const last = Math.min(this.nRows - 1, Math.ceil((top + viewH) / ROW_H) + 4);
    if (!force && this.rendered && this.rendered[0] === first && this.rendered[1] === last) return;
    this.rendered = [first, last];
    const sel = this.#sel();
    const nCols = this.nCols;
    let html = '';
    for (let r = first; r <= last; r++) {
      html += `<div class="sheet-row" style="top:${(r - 1) * ROW_H}px">${this.#rowHtml(r, sel, nCols)}</div>`;
    }
    this.body.innerHTML = html;
  }

  #refreshSelection() {
    this.#renderTop();
    this.#renderRows(true);
  }

  // ------------------------------------------------------------ выделение и навигация
  select(r, c, extend) {
    r = Math.max(0, Math.min(this.nRows - 1, r));
    c = Math.max(0, Math.min(this.nCols - 1, c));
    this.active = { r, c };
    if (!extend) this.anchor = { r, c };
    this.#refreshSelection();
    this.#scrollIntoView(r, c);
  }
  #scrollIntoView(r, c) {
    const el = this.el;
    if (r > 0) {
      const y = HEAD_H * 2 + (r - 1) * ROW_H;
      if (y - HEAD_H * 2 < el.scrollTop) el.scrollTop = y - HEAD_H * 2;
      else if (y + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = y + ROW_H - el.clientHeight;
    }
    let x = ROWNUM_W;
    for (let i = 0; i < c; i++) x += this.width(i);
    const w = this.width(c);
    if (x - ROWNUM_W < el.scrollLeft) el.scrollLeft = x - ROWNUM_W;
    else if (x + w > el.scrollLeft + el.clientWidth) el.scrollLeft = x + w - el.clientWidth;
  }

  #cellEl(r, c) {
    return this.el.querySelector(`.sheet-cell[data-r="${r}"][data-c="${c}"]`);
  }

  // ------------------------------------------------------------ правка ячейки
  startEdit(initial) {
    const { r, c } = this.active;
    this.#scrollIntoView(r, c);
    const target = this.#cellEl(r, c);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const inp = h('input.sheet-editor', { type: 'text' });
    inp.value = initial !== undefined ? initial : this.cell(r, c);
    Object.assign(inp.style, {
      position: 'fixed', left: rect.left + 'px', top: rect.top + 'px',
      width: Math.max(rect.width, 160) + 'px', height: rect.height + 'px',
      textAlign: this.types[c] === 'number' && r > 0 ? 'right' : 'left',
    });
    document.body.appendChild(inp);
    inp.focus();
    if (initial === undefined) inp.select();
    this.edit = { r, c, inp };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.stopEdit(true);
        this.select(r + (e.shiftKey ? -1 : 1), c);
        this.el.focus();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.stopEdit(true);
        this.select(r, c + (e.shiftKey ? -1 : 1));
        this.el.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.stopEdit(false);
        this.el.focus();
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && initial !== undefined) {
        e.preventDefault();
        this.stopEdit(true);
        this.select(r + (e.key === 'ArrowUp' ? -1 : 1), c);
        this.el.focus();
      }
    });
    inp.addEventListener('blur', () => this.stopEdit(true));
  }
  stopEdit(save) {
    const e = this.edit;
    if (!e) return;
    this.edit = null;
    const v = e.inp.value;
    e.inp.remove();
    if (save && v !== this.cell(e.r, e.c)) this.#writeCells(e.r, e.c, [[v]]);
  }

  // ------------------------------------------------------------ буфер обмена
  #selectionTsv() {
    const s = this.#sel();
    const lines = [];
    for (let r = s.r0; r <= s.r1; r++) {
      const vals = [];
      for (let c = s.c0; c <= s.c1; c++) {
        const v = this.cell(r, c);
        vals.push(/[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
      }
      lines.push(vals.join('\t'));
    }
    return lines.join('\n');
  }
  clearSelection() {
    const s = this.#sel();
    const block = [];
    for (let r = s.r0; r <= s.r1; r++) {
      const row = [];
      for (let c = s.c0; c <= s.c1; c++) row.push('');
      block.push(row);
    }
    this.#writeCells(s.r0, s.c0, block);
  }
  paste(text) {
    if (!text) return;
    const delim = text.includes('\t') ? '\t' : text.includes(';') && !text.includes(',') ? ';' : '\t';
    let rows = parseCsv(text.replace(/\r?\n$/, ''), delim);
    if (!rows.length) return;
    const s = this.#sel();
    // одно значение в выделенный диапазон — заполняем весь диапазон
    if (rows.length === 1 && rows[0].length === 1 && (s.r1 > s.r0 || s.c1 > s.c0)) {
      const block = [];
      for (let r = s.r0; r <= s.r1; r++) block.push(new Array(s.c1 - s.c0 + 1).fill(rows[0][0]));
      rows = block;
    }
    this.#writeCells(s.r0, s.c0, rows);
    this.anchor = { r: s.r0, c: s.c0 };
    this.active = { r: s.r0 + rows.length - 1, c: s.c0 + Math.max(...rows.map((r) => r.length)) - 1 };
    this.#refreshSelection();
  }

  // ------------------------------------------------------------ строки/колонки
  insertRows(at, count = 1) {
    const w = this.dataWidth();
    const next = this.data.slice();
    while (next.length < at) next.push(new Array(w).fill(''));
    next.splice(at, 0, ...Array.from({ length: count }, () => new Array(w).fill('')));
    this.#commit(next, 'structure');
  }
  deleteRows(r0, r1) {
    const next = this.data.slice();
    next.splice(r0, r1 - r0 + 1);
    this.#commit(next.length ? next : [['']], 'structure');
  }
  insertCols(at, count = 1) {
    const next = this.data.map((row) => {
      row = row.slice();
      while (row.length < at) row.push('');
      row.splice(at, 0, ...new Array(count).fill(''));
      return row;
    });
    if (next[0]) for (let i = 0; i < count; i++) if (next[0][at + i] === '') next[0][at + i] = 'Колонка ' + window.VS.colLetter(at + i);
    this.#commit(next, 'structure');
  }
  deleteCols(c0, c1) {
    this.#commit(this.data.map((row) => {
      row = row.slice();
      row.splice(c0, c1 - c0 + 1);
      return row;
    }), 'structure');
  }
  sortBy(c, dir) {
    const head = this.data[0];
    const body = this.data.slice(1);
    const num = this.types[c] === 'number';
    body.sort((a, b) => {
      const x = a[c], y = b[c];
      let res;
      if (num) {
        const nx = window.VS.parseNumber(x), ny = window.VS.parseNumber(y);
        res = (nx === null ? Infinity : nx) - (ny === null ? Infinity : ny);
      } else res = String(x ?? '').localeCompare(String(y ?? ''), 'ru', { numeric: true });
      return dir === 'desc' ? -res : res;
    });
    this.#commit([head, ...body], 'structure');
  }

  #contextMenu(x, y) {
    const s = this.#sel();
    const rows = s.r1 - s.r0 + 1;
    const cols = s.c1 - s.c0 + 1;
    const colName = this.cell(0, this.active.c) || window.VS.colLetter(this.active.c);
    menuAt(x, y, [
      { text: 'Вырезать', icon: 'copy', onClick: () => { this.#copyToClipboard(); this.clearSelection(); } },
      { text: 'Копировать', icon: 'copy', onClick: () => this.#copyToClipboard() },
      { text: 'Вставить', icon: 'paste', onClick: () => this.#pasteFromClipboard() },
      '-',
      { text: 'Вставить строку выше', icon: 'plus', onClick: () => this.insertRows(Math.max(1, s.r0), 1), disabled: s.r0 === 0 },
      { text: 'Вставить строку ниже', icon: 'plus', onClick: () => this.insertRows(s.r1 + 1, 1) },
      { text: rows > 1 ? `Удалить строки (${rows})` : 'Удалить строку', icon: 'trash', onClick: () => this.deleteRows(s.r0, s.r1), danger: true },
      '-',
      { text: 'Вставить колонку слева', icon: 'plus', onClick: () => this.insertCols(s.c0, 1) },
      { text: 'Вставить колонку справа', icon: 'plus', onClick: () => this.insertCols(s.c1 + 1, 1) },
      { text: cols > 1 ? `Удалить колонки (${cols})` : 'Удалить колонку', icon: 'trash', onClick: () => this.deleteCols(s.c0, s.c1), danger: true },
      '-',
      { text: `Сортировать «${colName}» по возрастанию`, icon: 'chev', onClick: () => this.sortBy(this.active.c, 'asc') },
      { text: `Сортировать «${colName}» по убыванию`, icon: 'chev', onClick: () => this.sortBy(this.active.c, 'desc') },
      '-',
      { text: 'Очистить содержимое', icon: 'close', onClick: () => this.clearSelection() },
    ]);
  }
  async #copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.#selectionTsv());
    } catch {
      /* в небезопасном контексте (http в интранете) — только через Ctrl+C */
    }
  }
  async #pasteFromClipboard() {
    try {
      this.paste(await navigator.clipboard.readText());
    } catch {
      alert('Браузер не дал доступ к буферу обмена. Используйте Ctrl+V (⌘V).');
    }
  }

  // ------------------------------------------------------------ события
  #bind() {
    const el = this.el;
    let raf = 0;
    el.addEventListener('scroll', () => {
      if (this.edit) this.stopEdit(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.#renderRows(false));
    });
    this.ro = new ResizeObserver(() => this.#renderRows(true));
    this.ro.observe(el);

    let dragging = false;
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      const rz = e.target.closest('.resizer');
      if (rz) {
        e.preventDefault();
        this.#startResize(+rz.dataset.c, e.clientX);
        return;
      }
      const cell = e.target.closest('.sheet-cell');
      const colh = e.target.closest('.sheet-colh');
      const rowh = e.target.closest('.sheet-rowh');
      const corner = e.target.closest('.sheet-corner');
      if (this.edit) this.stopEdit(true);
      if (e.button === 2) {
        // правый клик внутри выделения его не сбрасывает
        if (cell) {
          const r = +cell.dataset.r, c = +cell.dataset.c, s = this.#sel();
          if (!(r >= s.r0 && r <= s.r1 && c >= s.c0 && c <= s.c1)) this.select(r, c);
        }
        return;
      }
      el.focus({ preventScroll: true });
      if (corner) {
        this.anchor = { r: 0, c: 0 };
        this.active = { r: Math.max(0, this.data.length - 1), c: Math.max(0, this.dataWidth() - 1) };
        this.#refreshSelection();
      } else if (colh) {
        const c = +colh.dataset.c;
        this.anchor = e.shiftKey ? { r: 0, c: this.anchor.c } : { r: 0, c };
        this.active = { r: Math.max(1, this.data.length - 1), c };
        this.#refreshSelection();
      } else if (rowh) {
        const r = +rowh.dataset.r;
        this.anchor = e.shiftKey ? { r: this.anchor.r, c: 0 } : { r, c: 0 };
        this.active = { r, c: Math.max(0, this.dataWidth() - 1) };
        this.#refreshSelection();
      } else if (cell) {
        e.preventDefault();
        this.select(+cell.dataset.r, +cell.dataset.c, e.shiftKey);
        dragging = true;
      }
    });
    el.addEventListener('mousemove', (e) => {
      if (!dragging || !(e.buttons & 1)) {
        dragging = false;
        return;
      }
      const cell = e.target.closest('.sheet-cell');
      if (cell) {
        const r = +cell.dataset.r, c = +cell.dataset.c;
        if (r !== this.active.r || c !== this.active.c) {
          this.active = { r, c };
          this.#refreshSelection();
        }
      }
    });
    window.addEventListener('mouseup', (this._up = () => (dragging = false)));
    el.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('.sheet-cell');
      if (cell) {
        this.select(+cell.dataset.r, +cell.dataset.c);
        this.startEdit();
      }
    });
    el.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('.sheet-cell, .sheet-colh, .sheet-rowh')) return;
      e.preventDefault();
      this.#contextMenu(e.clientX, e.clientY);
    });
    el.addEventListener('keydown', (e) => this.#onKey(e));
    el.addEventListener('copy', (e) => {
      if (this.edit) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', this.#selectionTsv());
    });
    el.addEventListener('cut', (e) => {
      if (this.edit) return;
      e.preventDefault();
      e.clipboardData.setData('text/plain', this.#selectionTsv());
      this.clearSelection();
    });
    el.addEventListener('paste', (e) => {
      if (this.edit) return;
      e.preventDefault();
      this.paste(e.clipboardData.getData('text/plain'));
    });
  }

  #onKey(e) {
    if (this.edit) return;
    const { r, c } = this.active;
    const mod = e.ctrlKey || e.metaKey;
    const move = (dr, dc) => {
      e.preventDefault();
      if (mod) {
        // Ctrl+стрелка — к краю данных
        if (dr) dr = dr > 0 ? Math.max(1, this.data.length - 1) - r : -r;
        if (dc) dc = dc > 0 ? Math.max(0, this.dataWidth() - 1) - c : -c;
      }
      this.select(r + dr, c + dc, e.shiftKey);
    };
    switch (e.key) {
      case 'ArrowUp': return move(-1, 0);
      case 'ArrowDown': return move(1, 0);
      case 'ArrowLeft': return move(0, -1);
      case 'ArrowRight': return move(0, 1);
      case 'Tab': e.preventDefault(); return this.select(r, c + (e.shiftKey ? -1 : 1));
      case 'Enter': e.preventDefault(); return this.startEdit();
      case 'F2': e.preventDefault(); return this.startEdit();
      case 'Home': e.preventDefault(); return this.select(mod ? 1 : r, 0, e.shiftKey);
      case 'End': e.preventDefault(); return this.select(mod ? Math.max(1, this.data.length - 1) : r, Math.max(0, this.dataWidth() - 1), e.shiftKey);
      case 'PageDown': e.preventDefault(); return this.select(r + Math.floor(this.el.clientHeight / ROW_H) - 2, c, e.shiftKey);
      case 'PageUp': e.preventDefault(); return this.select(r - Math.floor(this.el.clientHeight / ROW_H) + 2, c, e.shiftKey);
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        return this.clearSelection();
    }
    if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      this.anchor = { r: 0, c: 0 };
      this.active = { r: Math.max(0, this.data.length - 1), c: Math.max(0, this.dataWidth() - 1) };
      this.#refreshSelection();
      return;
    }
    if (!mod && !e.altKey && e.key.length === 1) {
      e.preventDefault();
      this.startEdit(e.key);
    }
  }

  #startResize(c, startX) {
    const start = this.width(c);
    const onMove = (e) => {
      this.widths[c] = Math.max(48, Math.min(600, start + e.clientX - startX));
      this.render();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  focus() {
    this.el.focus({ preventScroll: true });
  }

  destroy() {
    this.stopEdit(false);
    this.ro?.disconnect();
    window.removeEventListener('mouseup', this._up);
    this.el.remove();
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

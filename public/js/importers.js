// Разбор файлов данных в двумерную таблицу (первая строка — заголовки).

// ---------------------------------------------------------------- кодировки
// Пробуем UTF-8 строго; при ошибке — Windows-1251 (типично для выгрузок из 1С и старого Excel).
export function decodeText(buffer, encoding = 'auto') {
  const bytes = new Uint8Array(buffer);
  if (encoding !== 'auto') return { text: new TextDecoder(encoding).decode(bytes), encoding };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'utf-16le' };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'utf-16be' };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('windows-1251').decode(bytes), encoding: 'windows-1251' };
  }
}

// ---------------------------------------------------------------- CSV
export function detectDelimiter(text) {
  const sample = text.slice(0, 20000).split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  const candidates = ['\t', ';', ',', '|'];
  let best = ',', bestScore = -1;
  for (const d of candidates) {
    const counts = sample.map((l) => splitCsvLine(l, d).length);
    if (!counts.length) continue;
    const first = counts[0];
    if (first < 2) continue;
    const same = counts.filter((c) => c === first).length;
    const score = same * 10 + first;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function splitCsvLine(line, d) {
  return parseCsv(line, d)[0] || [];
}

// RFC 4180: кавычки, переносы строк внутри кавычек, удвоенные кавычки
export function parseCsv(text, delimiter) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let quoted = false;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function toCsv(table, delimiter = ',') {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /["\n\r]/.test(s) || s.includes(delimiter) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return table.map((r) => r.map(esc).join(delimiter)).join('\r\n');
}

// ---------------------------------------------------------------- нормализация таблицы
export function normalizeTable(rows) {
  rows = rows.map((r) => (Array.isArray(r) ? r : [r]).map((v) => (v === null || v === undefined ? '' : typeof v === 'number' ? v : String(v))));
  // убираем пустые строки в конце и пустые колонки справа
  while (rows.length && rows[rows.length - 1].every((v) => v === '')) rows.pop();
  let width = 0;
  for (const r of rows) {
    let w = r.length;
    while (w > 0 && (r[w - 1] === '' || r[w - 1] === undefined)) w--;
    width = Math.max(width, w);
  }
  return rows.map((r) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push('');
    return out;
  });
}

// ---------------------------------------------------------------- JSON
// Поддерживает: массив объектов, массив массивов, {columns, rows}, {data: [...]}, объект массивов.
export function jsonToTable(json) {
  if (json && !Array.isArray(json)) {
    if (Array.isArray(json.columns) && Array.isArray(json.rows)) return [json.columns, ...json.rows];
    if (Array.isArray(json.data)) return jsonToTable(json.data);
    if (Array.isArray(json.items)) return jsonToTable(json.items);
    if (Array.isArray(json.records)) return jsonToTable(json.records);
    const keys = Object.keys(json);
    if (keys.length && keys.every((k) => Array.isArray(json[k]))) {
      const len = Math.max(...keys.map((k) => json[k].length));
      const rows = [keys];
      for (let i = 0; i < len; i++) rows.push(keys.map((k) => json[k][i]));
      return rows;
    }
    // объект «ключ → значение»
    return [['Ключ', 'Значение'], ...Object.entries(json).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v])];
  }
  if (!json.length) return [];
  if (Array.isArray(json[0])) return json;
  const flat = json.map((o) => flatten(o));
  const keys = [];
  const seen = new Set();
  for (const o of flat) for (const k of Object.keys(o)) if (!seen.has(k)) { seen.add(k); keys.push(k); }
  return [keys, ...flat.map((o) => keys.map((k) => (o[k] === undefined ? '' : o[k])))];
}

function flatten(obj, prefix = '', out = {}) {
  if (obj === null || typeof obj !== 'object') {
    out[prefix || 'Значение'] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}

// ---------------------------------------------------------------- Excel
export function readWorkbook(buffer) {
  if (!window.XLSX) throw new Error('Библиотека Excel не загружена');
  return window.XLSX.read(buffer, { type: 'array', cellDates: true, dense: true });
}

export function sheetToTable(wb, name) {
  const ws = wb.Sheets[name];
  // raw: исходные значения ячеек (числа — числами, даты — Date), без зависимостей от формата отображения
  const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false });
  const pad = (n) => String(n).padStart(2, '0');
  return rows.map((r) => r.map((v) => {
    if (v instanceof Date) {
      if (isNaN(v)) return '';
      const date = `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
      return v.getHours() || v.getMinutes() ? `${date} ${pad(v.getHours())}:${pad(v.getMinutes())}` : date;
    }
    if (typeof v === 'boolean') return v ? 'Да' : 'Нет';
    return v;
  }));
}

// ---------------------------------------------------------------- LAS (каротаж, версия 2.0)
// Разделы: ~V(ersion), ~W(ell), ~C(urve), ~P(arameter), ~O(ther), ~A(SCII). NULL-значения → пусто.
export function parseLas(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  let section = '';
  const curves = [];
  const well = {};
  let wrap = false;
  let nul = null;
  const values = [];
  const headerLine = /^\s*([^.\s]+)\s*\.([^\s]*)\s+(.*?):\s*(.*)$/;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('~')) {
      section = line[1].toUpperCase();
      continue;
    }
    if (section === 'A') {
      for (const tok of line.split(/\s+/)) values.push(tok);
      continue;
    }
    const m = headerLine.exec(raw);
    if (!m) continue;
    const [, mnem, unit, data, desc] = m;
    const key = mnem.toUpperCase();
    if (section === 'V' && key === 'WRAP') wrap = /^y/i.test(data.trim());
    if (section === 'W') {
      well[key] = (data.trim() || desc.trim());
      if (key === 'NULL') nul = Number(data.trim());
    }
    if (section === 'C') curves.push({ mnem: mnem.trim(), unit: unit.trim(), desc: desc.trim() });
  }
  if (!curves.length) throw new Error('В LAS-файле не найден раздел ~Curve');
  const n = curves.length;
  const rows = [curves.map((c) => (c.unit ? `${c.mnem}, ${c.unit}` : c.mnem))];
  // данные идут подряд (в т.ч. в режиме WRAP) — группируем по числу кривых
  for (let i = 0; i + n <= values.length; i += n) {
    rows.push(values.slice(i, i + n).map((v) => {
      const num = Number(v);
      if (nul !== null && Number.isFinite(num) && Math.abs(num - nul) < 1e-9) return '';
      return Number.isFinite(num) ? num : v;
    }));
  }
  return { table: rows, well: well.WELL || '', wrap, curves };
}

// ---------------------------------------------------------------- RSM (сводка расчёта tNavigator / Eclipse)
// Страницы: «SUMMARY OF RUN …», строки заголовка (мнемоника, единицы, множитель, скважина/группа, номер),
// пунктир, данные. Колонки страниц объединяются по номеру строки (одинаковые шаги по времени).
const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JLY: 7, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
function rsmDate(tok) {
  const m = /^(\d{1,2})-([A-Z]{3})-(\d{4})$/i.exec(tok);
  if (!m || !MONTHS[m[2].toUpperCase()]) return null;
  return `${m[3]}-${String(MONTHS[m[2].toUpperCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
export function parseRsm(text) {
  const lines = text.replace(/\f/g, '\n').split(/\r?\n/);
  const isDash = (l) => /^\s*-{10,}\s*$/.test(l);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/SUMMARY OF RUN/i.test(lines[i])) continue;
    let j = i + 1;
    while (j < lines.length && !isDash(lines[j])) j++;
    const head = [];
    j++;
    while (j < lines.length && !isDash(lines[j])) head.push(lines[j++]);
    j++;
    const data = [];
    while (j < lines.length && !/SUMMARY OF RUN/i.test(lines[j]) && !/^1\s*$/.test(lines[j]) && !isDash(lines[j])) {
      if (lines[j].trim()) data.push(lines[j]);
      j++;
    }
    if (head.length) blocks.push({ head, data });
    i = j - 1;
  }
  if (!blocks.length) throw new Error('Не найдено ни одной страницы «SUMMARY OF RUN» — это не RSM-файл?');
  const columns = [];
  const series = [];
  const seen = new Set();
  let rowCount = 0;
  for (const b of blocks) {
    // границы колонок — по началу мнемоник в первой строке заголовка
    const names = b.head[0];
    const starts = [];
    names.replace(/\S+/g, (tok, pos) => { starts.push(pos); return tok; });
    const cell = (line, k) => (line || '').slice(starts[k], k + 1 < starts.length ? starts[k + 1] : undefined).trim();
    const meta = starts.map((_, k) => ({
      mnem: cell(names, k),
      unit: cell(b.head[1], k),
      mult: cell(b.head[2], k),
      name: cell(b.head[3], k),
      num: cell(b.head[4], k),
    }));
    const rows = b.data.map((l) => l.trim().split(/\s+/));
    rowCount = Math.max(rowCount, rows.length);
    meta.forEach((mt, k) => {
      const multM = /\*10\*\*(-?\d+)/.exec(mt.mult);
      const mult = multM ? Math.pow(10, Number(multM[1])) : 1;
      const isDate = mt.mnem.toUpperCase() === 'DATE';
      let label = mt.mnem + (mt.name ? ':' + mt.name : '') + (mt.num ? ':' + mt.num.replace(/\s+/g, '') : '');
      if (seen.has(label)) return; // время/дата повторяются на каждой странице
      seen.add(label);
      if (mt.unit && !isDate) label += ', ' + mt.unit;
      columns.push(label);
      series.push(rows.map((r) => {
        const v = r[k];
        if (v === undefined) return '';
        if (isDate) return rsmDate(v) || v;
        const num = Number(v);
        return Number.isFinite(num) ? num * mult : v;
      }));
    });
  }
  const table = [columns];
  for (let r = 0; r < rowCount; r++) table.push(series.map((s) => (s[r] === undefined ? '' : s[r])));
  return { table, blocks: blocks.length };
}

// ---------------------------------------------------------------- определение формата
export function kindOf(name = '', type = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['xlsx', 'xlsm', 'xls', 'xlsb', 'ods'].includes(ext) || /spreadsheet|excel/.test(type)) return 'excel';
  if (ext === 'json' || /json/.test(type)) return 'json';
  if (['geojson'].includes(ext)) return 'json';
  if (['sqlite', 'sqlite3', 'db', 'db3'].includes(ext)) return 'sqlite';
  if (ext === 'las') return 'las';
  if (ext === 'rsm') return 'rsm';
  return 'csv';
}

// Полный разбор: возвращает {kind, sheets?, table, encoding?, delimiter?}
export function parseBuffer(buffer, { name = '', type = '', sheet, delimiter = 'auto', encoding = 'auto' } = {}) {
  const kind = kindOf(name, type);
  if (kind === 'excel') {
    const wb = readWorkbook(buffer);
    const sheets = wb.SheetNames;
    const s = sheet && sheets.includes(sheet) ? sheet : sheets[0];
    return { kind, sheets, sheet: s, table: normalizeTable(sheetToTable(wb, s)) };
  }
  const dec = decodeText(buffer, encoding);
  // отраслевые текстовые форматы (распознаём и по содержимому, если расширение другое)
  const head = dec.text.slice(0, 4000);
  if (kind === 'las' || (kind === 'csv' && /^\s*~V/m.test(head) && /~C/i.test(dec.text.slice(0, 20000)))) {
    const r = parseLas(dec.text);
    return { kind: 'las', table: normalizeTable(r.table), encoding: dec.encoding, well: r.well };
  }
  if (kind === 'rsm' || (kind === 'csv' && /SUMMARY OF RUN/i.test(head))) {
    const r = parseRsm(dec.text);
    return { kind: 'rsm', table: normalizeTable(r.table), encoding: dec.encoding };
  }
  if (kind === 'json') {
    let json;
    try {
      json = JSON.parse(dec.text);
    } catch (e) {
      throw new Error('Некорректный JSON: ' + e.message);
    }
    if (json && json.type === 'FeatureCollection') {
      // GeoJSON как таблица свойств
      return { kind, table: normalizeTable(jsonToTable(json.features.map((f) => f.properties || {}))), encoding: dec.encoding };
    }
    return { kind, table: normalizeTable(jsonToTable(json)), encoding: dec.encoding };
  }
  const d = delimiter === 'auto' ? detectDelimiter(dec.text) : delimiter;
  return { kind: 'csv', table: normalizeTable(parseCsv(dec.text, d)), encoding: dec.encoding, delimiter: d };
}

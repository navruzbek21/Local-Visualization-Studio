// Диалоги: галерея шаблонов, импорт данных (файл / вставка / URL), базы данных, карты.
import { h, icon, svg, button, modal, toast, confirmDialog, pickFile, plural } from './ui.js';
import { api } from './api.js';
import { parseBuffer, parseCsv, detectDelimiter, normalizeTable, kindOf } from './importers.js';

// ================================================================= галерея шаблонов
export function chooseTemplate({ title = 'Новая визуализация', presets = [], current } = {}) {
  return new Promise((resolve) => {
    const VS = window.VS;
    let done = false;
    const tpls = VS.sortedTemplates();
    const cats = [...new Set(tpls.map((t) => t.category))];
    const catBar = h('div.gallery-cats');
    const content = h('div');
    const filters = ['Все', ...cats, ...(presets.length ? ['Мои шаблоны'] : [])];
    let active = 'Все';
    filters.forEach((c) => {
      const b = h('button', { type: 'button' }, c);
      b.onclick = () => {
        active = c;
        catBar.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        draw();
      };
      if (c === active) b.classList.add('active');
      catBar.appendChild(b);
    });

    const card = (art, name, desc, onPick) => {
      const b = h('button.tpl-card', { type: 'button' }, h('div.art', svg(art)), h('b', name), h('small', desc));
      b.onclick = () => {
        done = true;
        m.close();
        onPick();
      };
      return b;
    };

    function draw() {
      content.innerHTML = '';
      if (presets.length && (active === 'Все' || active === 'Мои шаблоны')) {
        const g = h('div.gallery');
        presets.forEach((p) => {
          const t = VS.templates[p.template];
          if (!t) return;
          g.appendChild(card(t.icon, p.name, p.description || `На основе «${t.name}»${p.data ? ' · с данными' : ''}`, () => resolve({ preset: p })));
        });
        content.appendChild(h('div.gallery-group', h('h3', 'Мои шаблоны'), g));
      }
      const groups = active === 'Все' ? cats : cats.filter((c) => c === active);
      groups.forEach((cat) => {
        const g = h('div.gallery');
        tpls.filter((t) => t.category === cat).forEach((t) => {
          t.variants.forEach((v, vi) => {
            g.appendChild(card(v.icon || t.icon, v.name, v.description || t.description, () => resolve({ template: t.id, variant: vi })));
          });
        });
        content.appendChild(h('div.gallery-group', h('h3', cat), g));
      });
    }
    draw();
    const m = modal({
      title,
      size: 'wide',
      body: h('div', current ? h('p.muted', { style: { marginTop: 0 } }, 'Данные сохранятся — колонки будут привязаны к новому шаблону автоматически.') : null, catBar, content),
      onClose: () => { if (!done) resolve(null); },
    });
  });
}

// ================================================================= импорт: предпросмотр
function previewTable(table, limit = 12) {
  const [head = [], ...rows] = table;
  return h('div.preview-wrap', h('table.preview-table',
    h('thead', h('tr', head.map((c, i) => h('th', c === '' ? window.VS.colLetter(i) : String(c))))),
    h('tbody', rows.slice(0, limit).map((r) => h('tr', head.map((_, i) => h('td', r[i] === undefined ? '' : String(r[i]))))))));
}

function importPreview({ title, parse, initial, source, extraControls }) {
  return new Promise((resolve) => {
    let done = false;
    let result = initial;
    const info = h('div.small.muted');
    const holder = h('div');
    const firstRowHeader = h('input', { type: 'checkbox', checked: true });
    const redraw = () => {
      holder.innerHTML = '';
      const t = result.table;
      const rows = Math.max(0, t.length - 1);
      const cols = t[0] ? t[0].length : 0;
      info.textContent = `${rows} ${plural(rows, 'строка', 'строки', 'строк')} × ${cols} ${plural(cols, 'колонка', 'колонки', 'колонок')}` +
        (result.encoding ? ` · кодировка ${result.encoding}` : '') + (result.delimiter ? ` · разделитель «${result.delimiter === '\t' ? 'табуляция' : result.delimiter}»` : '');
      holder.appendChild(t.length ? previewTable(t) : h('div.empty-state', 'Нет данных'));
    };
    const controls = extraControls ? extraControls((opts) => {
      try {
        result = parse(opts);
        redraw();
      } catch (e) {
        toast(e.message, 'error');
      }
    }) : null;
    redraw();
    const ok = button('Заменить данные', {
      cls: 'primary',
      onClick: () => {
        let table = result.table;
        if (!firstRowHeader.checked) table = [table[0].map((_, i) => 'Колонка ' + window.VS.colLetter(i)), ...table];
        done = true;
        m.close();
        resolve({ table, source: { ...source, sheet: result.sheet, encoding: result.encoding, delimiter: result.delimiter } });
      },
    });
    const m = modal({
      title,
      size: 'mid',
      body: h('div.stack', { style: { gap: '12px' } }, controls,
        h('label.row', { style: { gap: '8px', fontSize: '13px' } }, h('span.switch', firstRowHeader, h('span')), 'Первая строка — заголовки'),
        info, holder),
      footer: [h('div.small.muted.grow', 'Текущие данные визуализации будут заменены'), button('Отмена', { onClick: () => m.close() }), ok],
      onClose: () => { if (!done) resolve(null); },
    });
  });
}

const DELIMS = [['auto', 'Авто'], [',', 'Запятая ,'], [';', 'Точка с запятой ;'], ['\t', 'Табуляция'], ['|', 'Вертикальная черта |']];
const ENCODINGS = [['auto', 'Авто'], ['utf-8', 'UTF-8'], ['windows-1251', 'Windows-1251 (кириллица)'], ['koi8-r', 'KOI8-R'], ['ibm866', 'DOS-866'], ['utf-16le', 'UTF-16']];

function csvControls(apply) {
  const d = h('select.select.sm', DELIMS.map(([v, l]) => h('option', { value: v }, l)));
  const e = h('select.select.sm', ENCODINGS.map(([v, l]) => h('option', { value: v }, l)));
  const go = () => apply({ delimiter: d.value, encoding: e.value });
  d.onchange = go;
  e.onchange = go;
  return h('div.form-grid', h('label.field', h('span', 'Разделитель'), d), h('label.field', h('span', 'Кодировка'), e));
}

function sheetControls(sheets, current, apply) {
  const s = h('select.select.sm', sheets.map((n) => h('option', { value: n }, n)));
  s.value = current;
  s.onchange = () => apply({ sheet: s.value });
  return h('label.field', h('span', `Лист (${sheets.length})`), s);
}

// Импорт файла: CSV/TSV/TXT, Excel, JSON. SQLite — в диалог БД.
export async function importFile(file, ctx = {}) {
  if (!file) return null;
  const kind = kindOf(file.name, file.type);
  if (kind === 'sqlite') {
    toast('Загружаю базу SQLite…');
    const conn = await api.uploadSqlite(file);
    toast(`База «${conn.name}» подключена`, 'ok');
    return openDatabaseDialog({ ...ctx, selectId: conn.id });
  }
  if (file.size > 150 * 1048576) throw new Error('Файл больше 150 МБ — загрузите его в базу данных или отфильтруйте');
  const buffer = await file.arrayBuffer();
  const parse = (opts = {}) => parseBuffer(buffer, { name: file.name, type: file.type, ...opts });
  const first = parse();
  return importPreview({
    title: `Импорт: ${file.name}`,
    parse,
    initial: first,
    source: { type: 'file', name: file.name },
    extraControls: first.kind === 'excel' && first.sheets.length > 1
      ? (apply) => sheetControls(first.sheets, first.sheet, apply)
      : first.kind === 'csv' ? csvControls : null,
  });
}

export async function importPasted() {
  const ta = h('textarea.textarea', { rows: 12, placeholder: 'Вставьте таблицу из Excel, Google Таблиц или CSV-текст (Ctrl+V)', style: { fontFamily: 'var(--mono)', fontSize: '12px' } });
  return new Promise((resolve) => {
    let done = false;
    const go = button('Далее', {
      cls: 'primary',
      onClick: async () => {
        const text = ta.value;
        if (!text.trim()) return;
        done = true;
        m.close();
        const parse = (opts = {}) => {
          const d = !opts.delimiter || opts.delimiter === 'auto' ? detectDelimiter(text) : opts.delimiter;
          return { kind: 'csv', table: normalizeTable(parseCsv(text, d)), delimiter: d };
        };
        resolve(await importPreview({
          title: 'Вставка данных', parse, initial: parse(), source: { type: 'paste' },
          extraControls: (apply) => {
            const d = h('select.select.sm', DELIMS.map(([v, l]) => h('option', { value: v }, l)));
            d.onchange = () => apply({ delimiter: d.value });
            return h('label.field', h('span', 'Разделитель'), d);
          },
        }));
      },
    });
    const m = modal({
      title: 'Вставить данные',
      body: ta,
      footer: [button('Отмена', { onClick: () => m.close() }), go],
      onClose: () => { if (!done) resolve(null); },
    });
    setTimeout(() => ta.focus(), 50);
  });
}

export async function importFromUrl(initialUrl = '') {
  const inp = h('input.input', { type: 'url', placeholder: 'http://portal.corp/reports/sales.csv', value: initialUrl });
  return new Promise((resolve) => {
    let done = false;
    const go = button('Загрузить', {
      cls: 'primary',
      onClick: async () => {
        const url = inp.value.trim();
        if (!url) return;
        go.disabled = true;
        try {
          const r = await api.fetchUrl(url);
          const buffer = await r.arrayBuffer();
          const name = new URL(url).pathname.split('/').pop() || 'data';
          const type = r.headers.get('content-type') || '';
          const parse = (opts = {}) => parseBuffer(buffer, { name, type, ...opts });
          const first = parse();
          done = true;
          m.close();
          resolve(await importPreview({
            title: 'Данные по ссылке', parse, initial: first, source: { type: 'url', url },
            extraControls: first.kind === 'excel' && first.sheets.length > 1 ? (apply) => sheetControls(first.sheets, first.sheet, apply) : first.kind === 'csv' ? csvControls : null,
          }));
        } catch (e) {
          toast(e.message, 'error');
        } finally {
          go.disabled = false;
        }
      },
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
    const m = modal({
      title: 'Загрузка по ссылке',
      body: h('div.stack', { style: { gap: '12px' } },
        h('label.field', h('span', 'Адрес файла или API (CSV, Excel, JSON)'), inp),
        h('div.note', 'Подходит для отчётов и API во внутренней сети. Запрос выполняет сервер студии, поэтому ограничения CORS не мешают. Ссылка сохранится в проекте — данные можно обновить одной кнопкой.')),
      footer: [button('Отмена', { onClick: () => m.close() }), go],
      onClose: () => { if (!done) resolve(null); },
    });
  });
}

// Повторная загрузка из сохранённого источника (URL или БД)
export async function refreshSource(source) {
  if (source?.type === 'url') {
    const r = await api.fetchUrl(source.url);
    const buffer = await r.arrayBuffer();
    const name = new URL(source.url).pathname.split('/').pop() || 'data';
    return parseBuffer(buffer, { name, type: r.headers.get('content-type') || '', sheet: source.sheet, delimiter: source.delimiter || 'auto', encoding: source.encoding || 'auto' }).table;
  }
  if (source?.type === 'db') {
    const res = await api.query(source.connectionId, source.sql, source.limit);
    return [res.columns, ...res.rows];
  }
  throw new Error('Источник нельзя обновить автоматически');
}

// ================================================================= базы данных
const DB_TYPES = {
  sqlite: { name: 'SQLite', driver: 'sqlite', hint: 'встроен (Node.js ≥ 22.13)' },
  postgres: { name: 'PostgreSQL', driver: 'postgres', hint: 'npm install pg' },
  mysql: { name: 'MySQL / MariaDB', driver: 'mysql', hint: 'npm install mysql2' },
  mssql: { name: 'MS SQL Server', driver: 'mssql', hint: 'npm install mssql' },
};

export function connectionForm(drivers, initial = {}) {
  return new Promise((resolve) => {
    let done = false;
    const type = h('select.select', Object.entries(DB_TYPES).map(([k, t]) => h('option', { value: k, disabled: !drivers[t.driver] }, t.name + (drivers[t.driver] ? '' : ` — нужен драйвер (${t.hint})`))));
    type.value = initial.type || 'sqlite';
    const f = {
      name: h('input.input', { value: initial.name || '', placeholder: 'Например: Продажи (DWH)' }),
      file: h('input.input', { value: initial.file || '', placeholder: '/data/reports/sales.db или C:\\data\\sales.sqlite' }),
      host: h('input.input', { value: initial.host || '', placeholder: 'db.corp.local' }),
      port: h('input.input', { value: initial.port || '', placeholder: 'по умолчанию' }),
      database: h('input.input', { value: initial.database || '' }),
      user: h('input.input', { value: initial.user || '', autocomplete: 'off' }),
      password: h('input.input', { type: 'password', autocomplete: 'new-password', placeholder: initial.hasPassword ? 'не менять' : '' }),
      ssl: h('input', { type: 'checkbox', checked: !!initial.ssl }),
    };
    const sqliteBox = h('div.stack',
      h('label.field', h('span', 'Путь к файлу на сервере'), f.file),
      h('div.row', h('span.small.muted', 'или'), button('Загрузить файл .sqlite / .db…', { cls: 'sm', icon: 'upload', onClick: async () => {
        const file = await pickFile('.sqlite,.sqlite3,.db,.db3');
        if (!file) return;
        try {
          const c = await api.uploadSqlite(file);
          done = true;
          m.close();
          resolve(c);
        } catch (e) {
          toast(e.message, 'error');
        }
      } })));
    const serverBox = h('div.form-grid',
      h('label.field.full', h('span', 'Сервер'), f.host),
      h('label.field', h('span', 'Порт'), f.port),
      h('label.field', h('span', 'База данных'), f.database),
      h('label.field', h('span', 'Пользователь'), f.user),
      h('label.field', h('span', 'Пароль'), f.password),
      h('label.row.full', { style: { fontSize: '13px' } }, h('span.switch', f.ssl, h('span')), 'Шифрованное соединение (SSL/TLS)'),
      h('div.note.full', 'Запросы выполняются только на чтение. Рекомендуется отдельная учётная запись с правами SELECT. Пароль хранится на сервере студии в data/connections.json.'));
    const sync = () => {
      sqliteBox.hidden = type.value !== 'sqlite';
      serverBox.hidden = type.value === 'sqlite';
    };
    type.onchange = sync;
    sync();
    const save = button(initial.id ? 'Сохранить' : 'Подключить', {
      cls: 'primary',
      onClick: async () => {
        const body = { type: type.value, name: f.name.value, file: f.file.value.trim(), host: f.host.value.trim(), port: f.port.value.trim(), database: f.database.value.trim(), user: f.user.value.trim(), password: f.password.value, ssl: f.ssl.checked };
        save.disabled = true;
        try {
          const c = initial.id ? await api.updateConnection(initial.id, body) : await api.createConnection(body);
          // подключение уже сохранено: при неудачной проверке следующее нажатие обновит его, а не создаст дубликат
          initial = { ...initial, id: c.id, hasPassword: c.hasPassword };
          if (c.type !== 'sqlite') await api.testConnection(c.id);
          done = true;
          m.close();
          toast('Подключение сохранено', 'ok');
          resolve(c);
        } catch (e) {
          toast(e.message, 'error');
        } finally {
          save.disabled = false;
        }
      },
    });
    const m = modal({
      title: initial.id ? 'Изменить подключение' : 'Новое подключение к БД',
      body: h('div.stack', { style: { gap: '12px' } }, h('label.field', h('span', 'Тип'), type), h('label.field', h('span', 'Название'), f.name), sqliteBox, serverBox),
      footer: [button('Отмена', { onClick: () => m.close() }), save],
      onClose: () => { if (!done) resolve(null); },
    });
  });
}

export function openDatabaseDialog({ selectId, sql: initialSql } = {}) {
  return new Promise(async (resolve) => {
    let done = false;
    let drivers = {};
    let conns = [];
    let selected = null;
    let lastResult = null;
    const side = h('div.db-side');
    const main = h('div.db-main');
    const m = modal({
      title: 'Данные из базы данных',
      size: 'wide',
      body: h('div.db-layout', side, main),
      onClose: () => { if (!done) resolve(null); },
    });

    async function load() {
      [drivers, conns] = await Promise.all([api.drivers(), api.connections()]);
      if (!selected && conns.length) selected = conns.find((c) => c.id === selectId) || conns[0];
      if (selected) selected = conns.find((c) => c.id === selected.id) || conns[0] || null;
      drawSide();
      drawMain();
    }

    function drawSide() {
      side.innerHTML = '';
      side.appendChild(button('Новое подключение', { icon: 'plus', cls: 'sm', onClick: async () => {
        const c = await connectionForm(drivers);
        if (c) {
          selected = c;
          load();
        }
      } }));
      if (!conns.length) side.appendChild(h('div.small.muted', 'Подключений пока нет'));
      conns.forEach((c) => {
        const b = h('button.db-conn', { type: 'button', class: selected?.id === c.id ? 'active' : '' }, icon('db'),
          h('span', { style: { minWidth: 0 } }, h('b', c.name), h('small', DB_TYPES[c.type]?.name + (c.host ? ' · ' + c.host : ''))));
        b.onclick = () => {
          selected = c;
          lastResult = null;
          drawSide();
          drawMain();
        };
        side.appendChild(b);
      });
    }

    async function drawMain() {
      main.innerHTML = '';
      if (!selected) {
        main.appendChild(h('div.empty-state', h('h3', 'Подключите базу данных'), h('p', 'SQLite-файл, PostgreSQL, MySQL или MS SQL Server. Данные остаются в вашей сети.')));
        return;
      }
      const c = selected;
      const head = h('div.row', h('b.grow', c.name),
        button('', { icon: 'edit', cls: 'sm', title: 'Изменить', onClick: async () => { if (await connectionForm(drivers, c)) load(); } }),
        button('', { icon: 'trash', cls: 'sm danger', title: 'Удалить подключение', onClick: async () => {
          if (!(await confirmDialog(`Удалить подключение «${c.name}»? Файлы баз данных не удаляются.`))) return;
          await api.deleteConnection(c.id);
          selected = null;
          load();
        } }));
      const tablesBox = h('div.db-tables', h('div.small.muted', { style: { padding: '8px 10px' } }, 'Загрузка таблиц…'));
      const sqlArea = h('textarea.textarea.sql', { spellcheck: false, placeholder: 'SELECT …' });
      sqlArea.value = initialSql && c.id === selectId ? initialSql : '';
      const limit = h('input.input.sm', { type: 'number', value: 50000, min: 1, style: { width: '110px' } });
      const resultBox = h('div');
      const run = button('Выполнить', { icon: 'play', cls: 'primary sm', onClick: () => execute() });
      const imp = button('Использовать эти данные', { cls: 'primary', disabled: true, onClick: () => {
        if (!lastResult) return;
        done = true;
        m.close();
        resolve({ table: [lastResult.columns, ...lastResult.rows], source: { type: 'db', connectionId: c.id, connectionName: c.name, sql: sqlArea.value.trim(), limit: Number(limit.value) || 50000 } });
      } });
      sqlArea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          execute();
        }
      });
      async function execute() {
        const sql = sqlArea.value.trim();
        if (!sql) return;
        run.disabled = true;
        resultBox.innerHTML = '';
        resultBox.appendChild(h('div.small.muted', 'Выполняется…'));
        try {
          const t0 = performance.now();
          const res = await api.query(c.id, sql, Number(limit.value) || 50000);
          lastResult = res;
          imp.disabled = !res.columns.length;
          resultBox.innerHTML = '';
          resultBox.append(
            h('div.small.muted', { style: { marginBottom: '6px' } }, `${res.rows.length} ${plural(res.rows.length, 'строка', 'строки', 'строк')} · ${res.columns.length} ${plural(res.columns.length, 'колонка', 'колонки', 'колонок')} · ${Math.round(performance.now() - t0)} мс` + (res.truncated ? ' · результат обрезан по лимиту' : '')),
            previewTable([res.columns, ...res.rows], 50));
        } catch (e) {
          lastResult = null;
          imp.disabled = true;
          resultBox.innerHTML = '';
          resultBox.appendChild(h('div.warning', icon('warn'), e.message));
        } finally {
          run.disabled = false;
        }
      }
      main.append(head,
        h('div.small.muted', 'Таблицы и представления — нажмите, чтобы подставить запрос'), tablesBox,
        h('label.field', h('span', 'SQL-запрос (только чтение) — Ctrl+Enter для выполнения'), sqlArea),
        h('div.row', run, h('span.small.muted', 'Лимит строк'), limit, h('span.grow'), imp),
        resultBox);
      try {
        const tables = await api.tables(c.id);
        tablesBox.innerHTML = '';
        if (!tables.length) tablesBox.appendChild(h('div.small.muted', { style: { padding: '8px 10px' } }, 'Таблиц нет'));
        const q = (n) => (c.type === 'mysql' ? '`' + n + '`' : c.type === 'mssql' ? n.split('.').map((x) => '[' + x + ']').join('.') : n.split('.').map((x) => '"' + x + '"').join('.'));
        tables.forEach((t) => {
          const b = h('button', { type: 'button' }, (t.type === 'view' ? '◇ ' : '▦ ') + t.name, h('small', t.columns.join(', ')));
          b.onclick = () => {
            sqlArea.value = c.type === 'mssql' ? `SELECT TOP 1000 * FROM ${q(t.name)}` : `SELECT * FROM ${q(t.name)} LIMIT 1000`;
            execute();
          };
          tablesBox.appendChild(b);
        });
        if (!sqlArea.value && tables[0]) {
          sqlArea.value = c.type === 'mssql' ? `SELECT TOP 1000 * FROM ${q(tables[0].name)}` : `SELECT * FROM ${q(tables[0].name)} LIMIT 1000`;
        }
        if (sqlArea.value) execute();
      } catch (e) {
        tablesBox.innerHTML = '';
        tablesBox.appendChild(h('div.warning', { style: { margin: '8px' } }, icon('warn'), e.message));
      }
    }

    try {
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  });
}

// ================================================================= карты
export async function uploadMapDialog() {
  const file = await pickFile('.json,.geojson');
  if (!file) return null;
  let geo;
  try {
    geo = JSON.parse(await file.text());
  } catch {
    toast('Файл не является JSON', 'error');
    return null;
  }
  if (geo.type === 'Topology') {
    toast('Формат TopoJSON не поддерживается — сохраните карту как GeoJSON (например, в mapshaper.org офлайн-версии или QGIS)', 'error');
    return null;
  }
  if (geo.type !== 'FeatureCollection') {
    toast('Нужен GeoJSON типа FeatureCollection', 'error');
    return null;
  }
  const name = file.name.replace(/\.(geo)?json$/i, '');
  try {
    const m = await api.createMap({ name, geojson: geo });
    toast(`Карта «${m.name}» загружена: ${m.geojson.features.length} объектов`, 'ok');
    return m;
  } catch (e) {
    toast(e.message, 'error');
    return null;
  }
}

// Редактор визуализации: предпросмотр + настройки, данные + привязка колонок.
import { h, icon, svg, button, toast, menu, debounce, confirmDialog, promptDialog, modal, pickFile, plural, formatDate } from './ui.js';
import { api } from './api.js';
import { Sheet } from './grid.js';
import { renderSettings } from './settings-panel.js';
import { openExportDialog, thumbnailBlob } from './export.js';
import { chooseTemplate, importFile, importPasted, importFromUrl, openDatabaseDialog, refreshSource, uploadMapDialog } from './dialogs.js';
import { normalizeTable } from './importers.js';

const BIND_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#7c5cd6', '#d6458a', '#c98500', '#0e8a8a', '#e34948'];
const DEVICES = [
  { id: 'auto', icon: 'full', title: 'По ширине окна', width: null },
  { id: 'desktop', icon: 'desktop', title: 'Ноутбук — 1024 px', width: 1024 },
  { id: 'tablet', icon: 'tablet', title: 'Планшет — 768 px', width: 768 },
  { id: 'mobile', icon: 'mobile', title: 'Телефон — 375 px', width: 375 },
];
const COMMON_KEYS = /^(title|subtitle|footer|layout\.|colors\.|number\.|legend\.|tooltip\.|animation\.|filter\.)/;
const STYLE_KEYS = /^(layout\.|colors\.(palette|custom)|number\.|legend\.|tooltip\.show|animation\.)/;

export async function openEditor(root, id, app) {
  const VS = window.VS;
  let project;
  try {
    project = await api.project(id);
  } catch (e) {
    root.innerHTML = '';
    root.appendChild(h('div.empty-state', h('h3', 'Не удалось открыть визуализацию'), h('p', e.message), h('a', { href: '#/' }, 'К списку проектов')));
    return () => {};
  }
  if (!VS.templates[project.template]) {
    root.innerHTML = '';
    root.appendChild(h('div.empty-state', h('h3', `Шаблон «${project.template}» не найден`), h('p', 'Возможно, это пользовательский шаблон, которого нет на этом сервере.'), h('a', { href: '#/' }, 'К списку проектов')));
    return () => {};
  }
  project.data = project.data && project.data.length ? project.data : [['']];
  project.bindings = project.bindings || {};
  project.settings = project.settings || {};

  let view = sessionStorage.getItem('vs.view.' + id) || 'preview';
  let device = localStorage.getItem('vs.device') || 'auto';
  let viz = null;
  let sheet = null;
  let lastRender = null;
  let disposed = false;
  let presets = [];
  let maps = [];

  // ------------------------------------------------------------ история (undo/redo)
  const undoStack = [];
  const redoStack = [];
  let before = null;
  const snapshot = () => ({ template: project.template, data: project.data, bindings: project.bindings, settings: project.settings, title: project.title, source: project.source });
  const begin = () => { if (!before) before = snapshot(); };
  const end = () => {
    if (!before) return;
    undoStack.push(before);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
    before = null;
    syncUndo();
  };
  function restore(snap) {
    Object.assign(project, snap);
    renderAll();
    scheduleSave();
  }
  function undo() {
    end();
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    syncUndo();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    syncUndo();
  }

  // ------------------------------------------------------------ сохранение
  let saveState = 'saved';
  let thumbTimer = null;
  const save = debounce(async () => {
    setSaveState('saving');
    try {
      const saved = await api.saveProject(id, project);
      project.updatedAt = saved.updatedAt;
      setSaveState('saved');
      clearTimeout(thumbTimer);
      thumbTimer = setTimeout(saveThumb, 1500);
    } catch (e) {
      setSaveState('error', e.message);
    }
  }, 700);
  function scheduleSave() {
    setSaveState('dirty');
    save();
  }
  async function saveThumb() {
    if (disposed && !project) return;
    try {
      const blob = await thumbnailBlob(project, viz ? viz.current() : {});
      await api.saveThumb(id, blob);
    } catch {
      /* миниатюра не критична */
    }
  }
  const beforeUnload = (e) => {
    if (saveState === 'dirty' || saveState === 'saving') {
      save.flush();
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', beforeUnload);

  // ------------------------------------------------------------ каркас
  root.innerHTML = '';
  const titleInput = h('input.title-input', { value: project.title || '', 'aria-label': 'Название визуализации', spellcheck: false });
  titleInput.addEventListener('input', () => {
    begin();
    project.title = titleInput.value;
    document.title = (project.title || 'Без названия') + ' — Visualization Studio';
    scheduleSave();
  });
  titleInput.addEventListener('change', end);
  titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') titleInput.blur(); });

  const tabPreview = h('button', { type: 'button' }, icon('chart'), 'Предпросмотр');
  const tabData = h('button', { type: 'button' }, icon('table'), 'Данные');
  tabPreview.onclick = () => setView('preview');
  tabData.onclick = () => setView('data');
  const undoBtn = button('', { icon: 'undo', cls: 'ghost', title: 'Отменить (Ctrl+Z)', onClick: undo });
  const redoBtn = button('', { icon: 'redo', cls: 'ghost', title: 'Повторить (Ctrl+Shift+Z)', onClick: redo });
  const saveEl = h('span.save-state', 'Сохранено');
  const moreBtn = button('', { icon: 'more', cls: 'ghost', title: 'Ещё' });
  moreBtn.onclick = () => menu(moreBtn, [
    { text: 'Открыть в отдельной вкладке', icon: 'link', onClick: () => window.open('/view/' + encodeURIComponent(id), '_blank') },
    { text: 'Сохранить как мой шаблон…', icon: 'star', onClick: saveAsPreset },
    { text: 'Применить оформление из шаблона…', icon: 'palette', onClick: applyPresetStyle },
    { text: 'Дублировать', icon: 'copy', onClick: async () => {
      save.flush();
      const copy = await api.duplicateProject(id);
      toast('Создана копия', 'ok');
      location.hash = '#/edit/' + copy.id;
    } },
    '-',
    { text: 'Удалить визуализацию', icon: 'trash', danger: true, onClick: async () => {
      if (!(await confirmDialog(`Удалить «${project.title}»? Это действие нельзя отменить.`))) return;
      save.cancel();
      await api.deleteProject(id);
      saveState = 'saved';
      location.hash = '#/';
    } },
  ], { align: 'right' });
  const exportBtn = button('Экспорт', { icon: 'download', cls: 'primary', onClick: () => {
    save.flush();
    openExportDialog(project, { state: viz ? viz.current() : {}, previewSize: frameSize() });
  } });

  const top = h('header.topbar',
    h('a.btn.ghost.icon', { href: '#/', title: 'К проектам', 'aria-label': 'К проектам' }, icon('back')),
    titleInput,
    h('div.tabs', { role: 'tablist' }, tabPreview, tabData),
    h('span.grow'),
    saveEl, undoBtn, redoBtn, h('span.divider-v'), moreBtn, exportBtn);
  const main = h('div.main-pane');
  const side = h('aside.side-pane');
  const editorEl = h('div.editor', top, h('div.editor-body', main, side));
  root.appendChild(editorEl);
  document.title = (project.title || 'Без названия') + ' — Visualization Studio';

  function setSaveState(s, msg) {
    saveState = s;
    saveEl.classList.toggle('error', s === 'error');
    saveEl.textContent = s === 'saving' ? 'Сохранение…' : s === 'dirty' ? 'Изменено' : s === 'error' ? 'Ошибка сохранения' : 'Сохранено';
    saveEl.title = msg || (project.updatedAt ? 'Изменено ' + formatDate(project.updatedAt) : '');
  }
  function syncUndo() {
    undoBtn.disabled = !undoStack.length && !before;
    redoBtn.disabled = !redoStack.length;
  }
  syncUndo();

  // ------------------------------------------------------------ предпросмотр
  const stage = h('div.stage');
  const deviceBox = h('div.device-btns', { role: 'group', 'aria-label': 'Ширина предпросмотра' });
  const sizeLabel = h('span.size-label');
  const frame = h('div.frame');
  const vizEl = h('div.viz');
  frame.appendChild(vizEl);
  const warningsEl = h('div.warnings');
  DEVICES.forEach((d) => {
    const b = h('button', { type: 'button', title: d.title, 'aria-label': d.title }, icon(d.icon));
    b.onclick = () => {
      device = d.id;
      localStorage.setItem('vs.device', device);
      syncDevice();
      layoutFrame();
    };
    b.dataset.id = d.id;
    deviceBox.appendChild(b);
  });
  stage.append(h('div.stage-toolbar', deviceBox, sizeLabel), frame, warningsEl);
  function syncDevice() {
    deviceBox.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.id === device));
  }
  syncDevice();

  function frameSize() {
    const d = DEVICES.find((x) => x.id === device) || DEVICES[0];
    const avail = Math.max(280, (stage.clientWidth || main.clientWidth || 900) - 48);
    const width = d.width ? Math.min(d.width, avail) : Math.min(avail, 1400);
    return { width, height: VS.heightFor(project, width) };
  }
  function layoutFrame() {
    if (view !== 'preview') return;
    const { width, height } = frameSize();
    frame.style.width = width + 'px';
    frame.style.height = height + 'px';
    const s = VS.resolveSettings(VS.templates[project.template], project.settings);
    frame.style.background = s['layout.background'];
    sizeLabel.textContent = `${width} × ${height} px`;
  }
  const stageRO = new ResizeObserver(() => layoutFrame());
  stageRO.observe(stage);

  let raf = 0;
  function refreshViz() {
    if (view !== 'preview') return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      layoutFrame();
      if (!viz) {
        viz = VS.render(vizEl, project, { onRender: onVizRender });
      } else viz.update(project);
    });
  }
  function onVizRender(res, err) {
    lastRender = res;
    warningsEl.innerHTML = '';
    const list = [];
    if (err) list.push('Ошибка построения: ' + err.message);
    if (res) list.push(...res.warnings);
    list.push(...dataWarnings());
    list.forEach((w) => warningsEl.appendChild(h('div.warning', icon('warn'), h('span', w))));
  }
  function dataWarnings() {
    const tpl = VS.templates[project.template];
    const t = VS.prepareTable(project.data);
    const out = [];
    const missing = tpl.bindings.filter((b) => !b.optional && b.key !== 'filter').filter((b) => {
      const v = project.bindings[b.key];
      if (Array.isArray(v)) return !v.some((i) => t.columns[i]);
      return v === undefined || v === null || v === '' || !t.columns[v];
    });
    if (missing.length && tpl.bindings.length) out.push('Не выбраны колонки: ' + missing.map((b) => '«' + b.name + '»').join(', ') + '. Откройте вкладку «Данные».');
    tpl.bindings.forEach((b) => {
      if (b.dataType !== 'number') return;
      let v = project.bindings[b.key];
      if (v === undefined || v === null || v === '') return;
      (Array.isArray(v) ? v : [v]).forEach((i) => {
        const c = t.columns[i];
        if (c && c.type !== 'number') out.push(`Колонка «${c.name}» привязана к «${b.name}», но содержит не числа — нечисловые значения будут пропущены.`);
      });
    });
    return out;
  }

  // ------------------------------------------------------------ боковая панель: настройки
  function renderSidePreview() {
    side.innerHTML = '';
    const tpl = VS.templates[project.template];
    const chip = h('div.tpl-chip');
    // название и значок текущего варианта шаблона (меняются вместе с настройками)
    const updateChip = () => {
      const s = VS.resolveSettings(tpl, project.settings);
      const variant = tpl.variants.find((v) => Object.entries(v.settings || {}).every(([k, val]) => s[k] === val));
      chip.replaceChildren(h('div.ico', svg((variant && variant.icon) || tpl.icon)), h('div', { style: { minWidth: 0 } }, h('b', variant ? variant.name : tpl.name), h('small', tpl.category)));
    };
    updateChip();
    const head = h('div.side-head', chip, button('Сменить', { icon: 'swap', cls: 'sm', onClick: switchTemplate }));
    const scroll = h('div.side-scroll');
    side.append(head, scroll);
    renderSettings(scroll, {
      tpl,
      settings: project.settings,
      env: { maps, bindings: () => project.bindings, uploadMap: async () => {
        const m = await uploadMapDialog();
        if (m) maps = await api.maps();
        return m;
      } },
      onChange: (key, value, opts = {}) => {
        begin();
        project.settings = { ...project.settings, [key]: value };
        if (!opts.transient) {
          end();
          updateChip();
        } else syncUndo();
        refreshViz();
        scheduleSave();
      },
    });
  }

  // ------------------------------------------------------------ данные
  const dataPane = h('div.main-pane', { style: { display: 'contents' } });
  const sourceInfo = h('span.source-info');
  const dataToolbar = h('div.data-toolbar',
    button('Загрузить файл', { icon: 'upload', cls: 'sm', title: 'CSV, Excel, JSON, LAS (каротаж), RSM (tNavigator/Eclipse), SQLite', onClick: async () => {
      const f = await pickFile('.csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,.json,.geojson,.las,.rsm,.sqlite,.sqlite3,.db');
      if (f) runImport(() => importFile(f));
    } }),
    button('Вставить', { icon: 'paste', cls: 'sm', onClick: () => runImport(importPasted) }),
    button('По ссылке', { icon: 'link', cls: 'sm', onClick: () => runImport(() => importFromUrl(project.source?.type === 'url' ? project.source.url : '')) }),
    button('Из базы данных', { icon: 'db', cls: 'sm', onClick: () => runImport(() => openDatabaseDialog(project.source?.type === 'db' ? { selectId: project.source.connectionId, sql: project.source.sql } : {})) }),
    h('span.divider-v'),
    button('', { icon: 'transpose', cls: 'sm', title: 'Транспонировать (строки ↔ колонки)', onClick: transpose }),
    button('', { icon: 'trash', cls: 'sm', title: 'Очистить таблицу', onClick: async () => {
      if (await confirmDialog('Очистить все данные таблицы?', { ok: 'Очистить' })) setData([['']], { source: null });
    } }),
    h('span.grow'),
    sourceInfo);
  const gridWrap = h('div.grid-wrap');
  dataPane.append(dataToolbar, gridWrap);

  function renderSourceInfo() {
    sourceInfo.innerHTML = '';
    const t = VS.prepareTable(project.data);
    const src = project.source;
    const label = !src ? '' : src.type === 'file' ? `Файл: ${src.name}${src.sheet ? ' · ' + src.sheet : ''}` : src.type === 'url' ? `URL: ${src.url}` : src.type === 'db' ? `БД: ${src.connectionName || ''}` : src.type === 'paste' ? 'Вставлено вручную' : '';
    sourceInfo.append(`${t.rows.length} ${plural(t.rows.length, 'строка', 'строки', 'строк')} × ${t.columns.length} ${plural(t.columns.length, 'колонка', 'колонки', 'колонок')}`);
    if (label) sourceInfo.append(' · ', h('span', { title: label, style: { maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom' } }, label));
    if (src && (src.type === 'url' || src.type === 'db')) {
      sourceInfo.appendChild(button('Обновить', { icon: 'refresh', cls: 'sm', title: 'Загрузить свежие данные из источника', onClick: async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        try {
          const table = normalizeTable(await refreshSource(src));
          setData(table, { source: src, keepBindings: true });
          toast('Данные обновлены', 'ok');
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          b.disabled = false;
        }
      } }));
    }
  }

  function bindingColStyles() {
    const tpl = VS.templates[project.template];
    const styles = {};
    tpl.bindings.forEach((b, i) => {
      let v = project.bindings[b.key];
      if (v === undefined || v === null || v === '') return;
      (Array.isArray(v) ? v : [v]).forEach((c) => {
        if (!styles[c]) styles[c] = { color: BIND_COLORS[i % BIND_COLORS.length], label: b.name };
      });
    });
    return styles;
  }

  function renderGrid() {
    if (!sheet) {
      sheet = new Sheet(gridWrap, {
        data: project.data,
        colStyles: bindingColStyles(),
        onChange: (next, kind) => {
          const oldCols = VS.prepareTable(project.data).columns;
          begin();
          project.data = next;
          if (kind === 'structure') project.bindings = rebind(project.bindings, oldCols, VS.prepareTable(next).columns, true);
          end();
          scheduleSave();
          renderSourceInfo();
          renderSideData();
          sheet.setColStyles(bindingColStyles());
        },
      });
    } else {
      sheet.setData(project.data);
      sheet.setColStyles(bindingColStyles());
    }
  }

  // перенос привязок на новую таблицу: по имени колонки, иначе автоматически
  function rebind(old, oldCols, newCols, byIndexFallback) {
    const tpl = VS.templates[project.template];
    const auto = VS.autoBind(tpl, newCols);
    const out = {};
    const byName = new Map(newCols.map((c) => [c.name, c.index]));
    tpl.bindings.forEach((b) => {
      const v = old[b.key];
      if (v === undefined || v === null || v === '') {
        if (auto[b.key] !== undefined && !Object.keys(old).length) out[b.key] = auto[b.key];
        return;
      }
      const list = Array.isArray(v) ? v : [v];
      const mapped = list.map((i) => {
        const oc = oldCols[i];
        if (!oc) return null;
        if (byName.has(oc.name)) return byName.get(oc.name);
        return byIndexFallback && newCols[i] ? i : null;
      }).filter((x) => x !== null && x !== undefined);
      if (mapped.length === list.length || (Array.isArray(v) && mapped.length)) out[b.key] = Array.isArray(v) ? mapped : mapped[0];
      else if (auto[b.key] !== undefined) out[b.key] = auto[b.key];
    });
    return out;
  }

  function setData(table, { source, keepBindings } = {}) {
    const oldCols = VS.prepareTable(project.data).columns;
    begin();
    project.data = table.length ? table : [['']];
    if (source !== undefined) project.source = source || undefined;
    const newCols = VS.prepareTable(project.data).columns;
    const tpl = VS.templates[project.template];
    project.bindings = keepBindings ? rebind(project.bindings, oldCols, newCols, false) : (() => {
      const kept = rebind(project.bindings, oldCols, newCols, false);
      const auto = VS.autoBind(tpl, newCols);
      // если по именам ничего не совпало — полностью автоматическая привязка
      return Object.keys(kept).length ? { ...auto, ...kept } : auto;
    })();
    end();
    scheduleSave();
    renderAll();
  }

  async function runImport(fn) {
    try {
      const res = await fn();
      if (res && res.table) {
        setData(res.table, { source: res.source });
        toast('Данные загружены', 'ok');
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function transpose() {
    const t = project.data;
    const w = Math.max(0, ...t.map((r) => r.length));
    const out = [];
    for (let c = 0; c < w; c++) out.push(t.map((r) => (r[c] === undefined ? '' : r[c])));
    setData(out, {});
  }

  // ------------------------------------------------------------ боковая панель: привязки
  function renderSideData() {
    if (view !== 'data') return;
    side.innerHTML = '';
    const tpl = VS.templates[project.template];
    const t = VS.prepareTable(project.data);
    const scroll = h('div.side-scroll');
    side.append(h('div.side-head', h('div', h('b', 'Привязка колонок'), h('div.small.muted', 'Какие колонки таблицы использует шаблон'))), scroll);
    if (!tpl.bindings.length) {
      scroll.appendChild(h('div.bind', h('div.small.muted', 'Этот шаблон получает всю таблицу целиком (переменные data и columns в коде).')));
    }
    tpl.bindings.forEach((b, bi) => {
      const color = BIND_COLORS[bi % BIND_COLORS.length];
      const cur = project.bindings[b.key];
      const selected = (Array.isArray(cur) ? cur : cur === undefined || cur === null || cur === '' ? [] : [cur]).map(Number);
      const chips = h('div.chips');
      t.columns.forEach((c) => {
        const idx = selected.indexOf(c.index);
        const on = idx >= 0;
        const typeOk = !b.dataType || b.dataType === 'any' || b.dataType === 'text' || c.type === b.dataType;
        const chip = h('button.chip', { type: 'button', class: on ? 'on' : '', title: `${c.letter}: ${c.name} (${typeName(c.type)})`, style: on ? { background: color } : typeOk ? null : { opacity: '.6' } },
          h('span.l', b.multiple && on && selected.length > 1 ? `${idx + 1}·${c.letter}` : c.letter), h('span.t', c.name));
        chip.onclick = () => {
          begin();
          let next;
          if (b.multiple) next = on ? selected.filter((x) => x !== c.index) : [...selected, c.index];
          else next = on ? (b.optional || b.key === 'filter' ? undefined : c.index) : c.index;
          const nb = { ...project.bindings };
          if (next === undefined || (Array.isArray(next) && !next.length && b.optional)) delete nb[b.key];
          else nb[b.key] = next;
          project.bindings = nb;
          end();
          scheduleSave();
          renderSideData();
          sheet?.setColStyles(bindingColStyles());
        };
        chips.appendChild(chip);
      });
      const actions = b.multiple ? h('div.row', { style: { marginTop: '6px' } },
        button('Все числовые', { cls: 'sm ghost', onClick: () => {
          begin();
          project.bindings = { ...project.bindings, [b.key]: t.columns.filter((c) => c.type === 'number' && !Object.entries(project.bindings).some(([k, v]) => k !== b.key && !Array.isArray(v) && Number(v) === c.index)).map((c) => c.index) };
          end(); scheduleSave(); renderSideData(); sheet?.setColStyles(bindingColStyles());
        } }),
        button('Очистить', { cls: 'sm ghost', onClick: () => {
          begin();
          const nb = { ...project.bindings };
          delete nb[b.key];
          project.bindings = nb;
          end(); scheduleSave(); renderSideData(); sheet?.setColStyles(bindingColStyles());
        } })) : null;
      scroll.appendChild(h('div.bind',
        h('div.bname', h('span.bdot', { style: { background: color } }), b.name, b.optional || b.key === 'filter' ? h('span.opt', '— необязательно') : null, b.multiple ? h('span.opt', '· несколько') : null),
        b.description ? h('div.bdesc', b.description) : h('div', { style: { height: '6px' } }),
        t.columns.length ? chips : h('div.small.muted', 'Нет колонок — загрузите данные'),
        actions));
    });
    // сводка по колонкам
    if (t.columns.length) {
      const rows = t.columns.map((c) => {
        const filled = t.rows.filter((r) => !VS.util.isEmpty(r[c.index])).length;
        return h('tr', h('td.mono.small', { style: { color: 'var(--faint)', width: '28px' } }, c.letter), h('td', { style: { maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.name), h('td', { style: { textAlign: 'right' } }, h('span.type-tag', typeName(c.type)), ' ', h('span.small.muted', `${filled}/${t.rows.length}`)));
      });
      scroll.appendChild(h('div.col-types', h('div.small', { style: { fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' } }, 'Колонки и типы'), h('table', h('tbody', rows))));
    }
    scroll.appendChild(h('div.bind', h('div.small.muted', 'Подсказки: выделяйте ячейки мышью, копируйте и вставляйте из Excel (', h('span.kbd', 'Ctrl+V'), '), правый клик — вставка/удаление строк и колонок, сортировка. Файл можно перетащить прямо на таблицу.')));
  }

  // ------------------------------------------------------------ шаблоны
  async function switchTemplate() {
    const choice = await chooseTemplate({ title: 'Сменить шаблон', current: project.template, presets });
    if (!choice) return;
    begin();
    if (choice.preset) applyPreset(choice.preset, true);
    else {
      const tpl = VS.templates[choice.template];
      const variant = tpl.variants[choice.variant] || tpl.variants[0];
      const kept = {};
      for (const [k, v] of Object.entries(project.settings)) if (COMMON_KEYS.test(k)) kept[k] = v;
      const changedTemplate = choice.template !== project.template;
      project.template = choice.template;
      project.settings = { ...kept, ...(variant.settings || {}) };
      if (changedTemplate) project.bindings = VS.autoBind(tpl, VS.prepareTable(project.data).columns);
    }
    end();
    scheduleSave();
    if (viz) {
      viz.dispose();
      viz = null;
    }
    renderAll();
  }

  function applyPreset(p, withTemplate) {
    if (withTemplate && p.template !== project.template && VS.templates[p.template]) {
      project.template = p.template;
      project.bindings = p.bindings && p.data ? p.bindings : VS.autoBind(VS.templates[p.template], VS.prepareTable(project.data).columns);
    }
    const textKeys = ['title', 'subtitle', 'footer'];
    const next = { ...project.settings };
    for (const [k, v] of Object.entries(p.settings || {})) if (!textKeys.includes(k)) next[k] = v;
    project.settings = next;
  }

  async function saveAsPreset() {
    const name = h('input.input', { value: (project.title || 'Мой шаблон') });
    const desc = h('input.input', { placeholder: 'Например: фирменный стиль отдела, для ежемесячного отчёта' });
    const withData = h('input', { type: 'checkbox' });
    const ok = button('Сохранить', { cls: 'primary', onClick: async () => {
      try {
        await api.createPreset({
          name: name.value.trim() || 'Мой шаблон',
          description: desc.value.trim(),
          template: project.template,
          settings: project.settings,
          bindings: withData.checked ? project.bindings : undefined,
          data: withData.checked ? project.data : undefined,
        });
        presets = await api.presets();
        m.close();
        toast('Шаблон сохранён — он появится в галерее «Новая визуализация»', 'ok');
      } catch (e) {
        toast(e.message, 'error');
      }
    } });
    const m = modal({
      title: 'Сохранить как мой шаблон',
      body: h('div.stack', { style: { gap: '12px' } },
        h('label.field', h('span', 'Название'), name),
        h('label.field', h('span', 'Описание'), desc),
        h('label.row', { style: { fontSize: '13px' } }, h('span.switch', withData, h('span')), 'Сохранить вместе с данными'),
        h('div.note', 'Шаблон запоминает тип графика и все настройки оформления: цвета, шрифты, форматы чисел, подписи. Им смогут пользоваться все пользователи этого сервера.')),
      footer: [button('Отмена', { onClick: () => m.close() }), ok],
    });
  }

  async function applyPresetStyle() {
    if (!presets.length) {
      toast('Сначала сохраните хотя бы один шаблон («Сохранить как мой шаблон»)');
      return;
    }
    const sel = h('select.select', presets.map((p) => h('option', { value: p.id }, p.name)));
    const ok = button('Применить', { cls: 'primary', onClick: () => {
      const p = presets.find((x) => x.id === sel.value);
      if (!p) return;
      begin();
      const next = { ...project.settings };
      for (const [k, v] of Object.entries(p.settings || {})) if (STYLE_KEYS.test(k)) next[k] = v;
      project.settings = next;
      end();
      scheduleSave();
      renderAll();
      m.close();
      toast('Оформление применено', 'ok');
    } });
    const m = modal({
      title: 'Применить оформление',
      body: h('div.stack', h('label.field', h('span', 'Шаблон'), sel), h('div.note', 'Переносятся только настройки стиля: палитра, шрифт, фон, форматы чисел, легенда и анимация. Тип графика и тексты не меняются.')),
      footer: [button('Отмена', { onClick: () => m.close() }), ok],
    });
  }

  // ------------------------------------------------------------ переключение вкладок
  function setView(v) {
    view = v;
    sessionStorage.setItem('vs.view.' + id, v);
    tabPreview.classList.toggle('active', v === 'preview');
    tabData.classList.toggle('active', v === 'data');
    tabPreview.setAttribute('aria-selected', v === 'preview');
    tabData.setAttribute('aria-selected', v === 'data');
    main.innerHTML = '';
    if (v === 'preview') {
      sheet?.stopEdit(true);
      main.appendChild(stage);
      renderSidePreview();
      if (viz) {
        viz.dispose();
        viz = null;
      }
      refreshViz();
    } else {
      main.appendChild(dataPane);
      renderGrid();
      renderSourceInfo();
      renderSideData();
      setTimeout(() => sheet?.focus(), 30);
    }
  }

  function renderAll() {
    titleInput.value = project.title || '';
    if (view === 'preview') {
      renderSidePreview();
      refreshViz();
    } else {
      renderGrid();
      renderSourceInfo();
      renderSideData();
    }
    syncUndo();
  }

  // ------------------------------------------------------------ клавиатура, перетаскивание файлов
  const onKey = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const t = e.target;
    const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (document.querySelector('.modal-back')) return;
    if (mod && e.key.toLowerCase() === 'z' && !inField) {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (mod && e.key.toLowerCase() === 'y' && !inField) {
      e.preventDefault();
      redo();
    } else if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save.flush();
    }
  };
  document.addEventListener('keydown', onKey);

  let dragDepth = 0;
  const dropHint = h('div.drop-hint', 'Отпустите файл, чтобы загрузить данные');
  dropHint.hidden = true;
  editorEl.appendChild(dropHint);
  editorEl.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragDepth++;
    dropHint.hidden = false;
  });
  editorEl.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropHint.hidden = true;
  });
  editorEl.addEventListener('dragover', (e) => e.preventDefault());
  editorEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropHint.hidden = true;
    const f = e.dataTransfer.files[0];
    if (f) {
      if (view !== 'data') setView('data');
      runImport(() => importFile(f));
    }
  });

  // ------------------------------------------------------------ старт
  setView(view);
  api.presets().then((p) => (presets = p)).catch(() => {});
  api.maps().then((m) => {
    maps = m;
    if (view === 'preview' && project.template === 'map') renderSidePreview();
  }).catch(() => {});

  // функция очистки при уходе со страницы редактора
  return () => {
    disposed = true;
    if (saveState === 'dirty' || saveState === 'saving') save.flush();
    clearTimeout(thumbTimer);
    saveThumb();
    window.removeEventListener('beforeunload', beforeUnload);
    document.removeEventListener('keydown', onKey);
    stageRO.disconnect();
    viz?.dispose();
    sheet?.destroy();
  };
}

function typeName(t) {
  return t === 'number' ? 'число' : t === 'date' ? 'дата' : 'текст';
}

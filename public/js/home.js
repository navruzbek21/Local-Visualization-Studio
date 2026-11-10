// Главная: проекты, мои шаблоны, источники данных и карты.
import { h, icon, svg, button, toast, menu, modal, confirmDialog, promptDialog, pickFile, downloadBlob, safeFilename, formatDate, plural } from './ui.js';
import { renderImage } from './export.js';
import { api } from './api.js';
import { chooseTemplate, connectionForm, openDatabaseDialog, uploadMapDialog } from './dialogs.js';

export async function createFromChoice(choice) {
  const VS = window.VS;
  let p;
  if (choice.preset) {
    const pr = choice.preset;
    const tpl = VS.templates[pr.template];
    p = VS.newProject(pr.template, 0);
    const keepText = !pr.data;
    const settings = { ...p.settings };
    for (const [k, v] of Object.entries(pr.settings || {})) if (!keepText || !['title', 'subtitle', 'footer'].includes(k)) settings[k] = v;
    p.settings = settings;
    if (pr.data) {
      p.data = pr.data;
      p.bindings = pr.bindings || VS.autoBind(tpl, VS.prepareTable(pr.data).columns);
    }
    p.title = pr.name;
  } else {
    p = VS.newProject(choice.template, choice.variant);
  }
  const created = await api.createProject(p);
  location.hash = '#/edit/' + created.id;
}

export async function newVisualization() {
  const presets = await api.presets().catch(() => []);
  const choice = await chooseTemplate({ presets });
  if (choice) {
    try {
      await createFromChoice(choice);
    } catch (e) {
      toast(e.message, 'error');
    }
  }
}

export async function renderHome(root, section = 'projects') {
  const VS = window.VS;
  root.innerHTML = '';
  document.title = 'Visualization Studio';
  const nav = h('nav.topnav',
    h('a', { href: '#/', class: section === 'projects' ? 'active' : '' }, icon('folder'), 'Проекты'),
    h('a', { href: '#/examples', class: section === 'examples' ? 'active' : '' }, icon('chart'), 'Примеры'),
    h('a', { href: '#/presets', class: section === 'presets' ? 'active' : '' }, icon('star'), 'Мои шаблоны'),
    h('a', { href: '#/sources', class: section === 'sources' ? 'active' : '' }, icon('db'), 'Источники и карты'));
  const top = h('header.topbar',
    h('a.logo', { href: '#/' }, h('span.logo-mark', svg('<svg viewBox="0 0 24 24">' + '<rect x="4" y="12" width="3.5" height="8" rx="1" fill="#fff"/><rect x="10.25" y="7" width="3.5" height="13" rx="1" fill="#fff"/><rect x="16.5" y="3.5" width="3.5" height="16.5" rx="1" fill="#fff"/></svg>')), 'Visualization Studio'),
    nav, h('span.grow'),
    button('Новая визуализация', { icon: 'plus', cls: 'primary', onClick: newVisualization }));
  const main = h('main.home');
  root.append(top, main);
  if (section === 'examples') return renderExamples(main);
  if (section === 'presets') return renderPresets(main);
  if (section === 'sources') return renderSources(main);
  return renderProjects(main);
}

// ================================================================= проекты
async function renderProjects(main) {
  const VS = window.VS;
  const search = h('input.input', { type: 'search', placeholder: 'Поиск по названию…', 'aria-label': 'Поиск' });
  const sort = h('select.select', { style: { width: 'auto' } }, h('option', { value: 'updated' }, 'Недавно изменённые'), h('option', { value: 'created' }, 'Недавно созданные'), h('option', { value: 'title' }, 'По названию'));
  sort.value = localStorage.getItem('vs.sort') || 'updated';
  const cards = h('div.cards');
  main.append(
    h('div.home-head',
      h('div', h('h1', 'Мои визуализации'), h('p', 'Все данные и проекты хранятся локально на этом сервере')),
      h('div.toolbar', search, sort, button('Импорт проекта', { icon: 'upload', onClick: importProject }))),
    cards);

  let list = [];
  try {
    list = await api.projects();
  } catch (e) {
    cards.replaceWith(h('div.empty-state', h('h3', 'Не удалось загрузить проекты'), h('p', e.message)));
    return;
  }

  function draw() {
    const q = search.value.trim().toLowerCase();
    let items = list.filter((p) => !q || (p.title || '').toLowerCase().includes(q));
    if (sort.value === 'title') items.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'));
    else if (sort.value === 'created') items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    cards.innerHTML = '';
    if (!q) {
      cards.appendChild(h('button.card.new', { type: 'button', on: { click: newVisualization } }, icon('plus'), 'Новая визуализация'));
    }
    items.forEach((p) => cards.appendChild(projectCard(p)));
    if (q && !items.length) cards.appendChild(h('div.empty-state', { style: { gridColumn: '1 / -1' } }, 'Ничего не найдено'));
    if (!q && !list.length) {
      cards.appendChild(h('div.empty-state', { style: { gridColumn: '2 / -1', textAlign: 'left', padding: '30px 10px' } },
        h('h3', 'Здесь появятся ваши визуализации'),
        h('p', 'Нажмите «Новая визуализация», выберите шаблон — он откроется с примером данных. Затем замените данные своими: загрузите Excel/CSV, вставьте таблицу или подключите базу данных.'),
        h('p', 'Или откройте ', h('a', { href: '#/examples' }, 'готовые примеры'), ' — профили добычи, карты отборов, планшеты ГИС на реальных данных месторождения Volve.')));
    }
  }

  function projectCard(p) {
    const tpl = VS.templates[p.template];
    const thumb = h('div.thumb', p.hasThumb
      ? h('img', { src: `/thumbs/${p.id}.png?v=${encodeURIComponent(p.updatedAt || '')}`, alt: '', loading: 'lazy' })
      : svg(tpl ? tpl.icon : '<svg viewBox="0 0 48 36"></svg>'));
    const more = button('', { icon: 'more', cls: 'ghost sm menu-btn', title: 'Действия' });
    more.addEventListener('click', (e) => {
      e.stopPropagation();
      menu(more, [
        { text: 'Открыть', icon: 'edit', onClick: open },
        { text: 'Открыть просмотр', icon: 'link', onClick: () => window.open('/view/' + encodeURIComponent(p.id), '_blank') },
        { text: 'Переименовать', icon: 'edit', onClick: async () => {
          const name = await promptDialog('Переименовать', { value: p.title });
          if (name === null) return;
          const full = await api.project(p.id);
          await api.saveProject(p.id, { ...full, title: name.trim() || 'Без названия' });
          reload();
        } },
        { text: 'Дублировать', icon: 'copy', onClick: async () => { await api.duplicateProject(p.id); reload(); } },
        { text: 'Скачать проект (.json)', icon: 'download', onClick: async () => {
          const { id, createdAt, updatedAt, ...rest } = await api.project(p.id);
          downloadBlob(new Blob([JSON.stringify({ format: 'visualization-studio', version: 1, project: rest }, null, 2)], { type: 'application/json' }), safeFilename(p.title) + '.vstudio.json');
        } },
        '-',
        { text: 'Удалить', icon: 'trash', danger: true, onClick: async () => {
          if (!(await confirmDialog(`Удалить «${p.title}»? Это действие нельзя отменить.`))) return;
          await api.deleteProject(p.id);
          toast('Удалено');
          reload();
        } },
      ], { align: 'right' });
    });
    const open = () => (location.hash = '#/edit/' + p.id);
    return h('div.card', { tabindex: 0, role: 'link', 'aria-label': p.title, on: { click: open, keydown: (e) => { if (e.key === 'Enter') open(); } } },
      thumb,
      h('div.body',
        h('div', { style: { minWidth: 0, flex: 1 } },
          h('div.name', p.title || 'Без названия'),
          h('div.meta', (tpl ? tpl.name : p.template) + ' · ' + formatDate(p.updatedAt))),
        more));
  }

  async function reload() {
    list = await api.projects();
    draw();
  }

  async function importProject() {
    const f = await pickFile('.json');
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const p = j.format === 'visualization-studio' ? j.project : j;
      if (!p || !p.template || !p.data) throw new Error('Файл не похож на проект Visualization Studio');
      if (!VS.templates[p.template]) throw new Error(`Шаблон «${p.template}» не установлен на этом сервере`);
      const created = await api.createProject(p);
      toast('Проект импортирован', 'ok');
      location.hash = '#/edit/' + created.id;
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  search.addEventListener('input', draw);
  sort.addEventListener('change', () => {
    localStorage.setItem('vs.sort', sort.value);
    draw();
  });
  draw();
}

// ================================================================= примеры
async function renderExamples(main) {
  const VS = window.VS;
  const list = await api.examples().catch(() => []);
  main.append(h('div.home-head',
    h('div', h('h1', 'Примеры визуализаций'), h('p', 'Нажмите на пример, чтобы посмотреть его вживую. «Открыть копию» создаёт ваш проект — его можно менять и подставлять свои данные.')),
    list.length ? h('div.toolbar', button('Добавить все в мои проекты', { icon: 'plus', onClick: async (e) => {
      e.currentTarget.disabled = true;
      for (const ex of list) await api.copyExample(ex.id);
      toast(`Добавлено примеров: ${list.length}`, 'ok');
      location.hash = '#/';
    } })) : null));
  if (!list.length) {
    main.appendChild(h('div.empty-state', h('h3', 'Примеров нет'), h('p', 'Папка examples/ пуста. Соберите примеры командой npm run build:examples.')));
    return;
  }
  const groups = [...new Set(list.map((e) => e.group || 'Прочее'))];
  const thumbs = [];
  groups.forEach((g) => {
    const cards = h('div.cards');
    list.filter((e) => (e.group || 'Прочее') === g).forEach((ex) => {
      const tpl = VS.templates[ex.template];
      const thumb = h('div.thumb', tpl ? svg(tpl.icon) : null);
      thumbs.push({ ex, thumb });
      const open = () => previewExample(ex);
      cards.appendChild(h('div.card', { tabindex: 0, role: 'button', 'aria-label': ex.title, on: { click: open, keydown: (e) => { if (e.key === 'Enter') open(); } } },
        thumb,
        h('div.body', h('div', { style: { minWidth: 0, flex: 1 } },
          h('div.name', { title: ex.title }, ex.title),
          h('div.meta', { style: { whiteSpace: 'normal', lineHeight: '1.35', marginTop: '4px' } }, ex.description || (tpl ? tpl.name : ''))))));
    });
    main.append(h('div.section-title', g), cards);
  });
  // миниатюры строим по очереди, чтобы не блокировать интерфейс
  for (const { ex, thumb } of thumbs) {
    try {
      const full = await api.example(ex.id);
      if (!VS.templates[full.project.template]) continue;
      // для анимированных шаблонов (гонка) — последний кадр
      const url = await renderImage(full.project, { type: 'png', width: 640, height: 400, scale: 1, clip: true, frame: 1e9 });
      thumb.replaceChildren(h('img', { src: url, alt: '' }));
    } catch (e) {
      console.warn('Миниатюра примера', ex.id, e);
    }
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function previewExample(ex) {
  const VS = window.VS;
  const full = await api.example(ex.id);
  const holder = h('div', { style: { height: '62vh', minHeight: '360px', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' } });
  const m = modal({
    title: ex.title,
    size: 'wide',
    body: h('div.stack', { style: { gap: '10px' } }, h('div.muted', ex.description || ''), holder),
    footer: [
      h('div.small.muted.grow', (VS.templates[full.project.template] || {}).name || ''),
      button('Закрыть', { onClick: () => m.close() }),
      button('Открыть копию в редакторе', { cls: 'primary', icon: 'edit', onClick: async () => {
        const p = await api.copyExample(ex.id);
        m.close();
        location.hash = '#/edit/' + p.id;
      } }),
    ],
    onClose: () => viz && viz.dispose(),
  });
  let viz = null;
  setTimeout(() => { viz = VS.render(holder, full.project); }, 30);
}

// ================================================================= мои шаблоны
async function renderPresets(main) {
  const VS = window.VS;
  main.append(h('div.home-head', h('div', h('h1', 'Мои шаблоны'), h('p', 'Сохранённые оформления и заготовки. Создаются в редакторе: меню «⋯» → «Сохранить как мой шаблон».'))));
  const box = h('div');
  main.appendChild(box);
  async function draw() {
    const list = await api.presets();
    box.innerHTML = '';
    if (!list.length) {
      box.appendChild(h('div.empty-state', h('h3', 'Пока нет своих шаблонов'), h('p', 'Настройте визуализацию под фирменный стиль (цвета, шрифт, формат чисел) и сохраните её как шаблон — коллеги смогут начинать с него.')));
      return;
    }
    const l = h('div.list');
    list.forEach((p) => {
      const tpl = VS.templates[p.template];
      l.appendChild(h('div.list-item',
        h('div.ico', { style: { width: '54px', height: '40px' } }, tpl ? svg(tpl.icon) : icon('star')),
        h('div.grow', h('b', p.name), h('div.small.muted', [tpl ? tpl.name : p.template, p.data ? 'с данными' : null, p.description, formatDate(p.createdAt)].filter(Boolean).join(' · '))),
        button('Создать визуализацию', { cls: 'sm', icon: 'plus', onClick: () => createFromChoice({ preset: p }).catch((e) => toast(e.message, 'error')) }),
        button('', { cls: 'sm danger', icon: 'trash', title: 'Удалить шаблон', onClick: async () => {
          if (!(await confirmDialog(`Удалить шаблон «${p.name}»? Визуализации, созданные из него, не пострадают.`))) return;
          await api.deletePreset(p.id);
          draw();
        } })));
    });
    box.appendChild(l);
  }
  draw().catch((e) => toast(e.message, 'error'));
}

// ================================================================= источники
async function renderSources(main) {
  main.append(h('div.home-head', h('div', h('h1', 'Источники данных и карты'), h('p', 'Подключения к базам данных и собственные карты (GeoJSON) доступны во всех визуализациях'))));
  const dbBox = h('div');
  const mapBox = h('div');
  const infoBox = h('div');
  main.append(dbBox, mapBox, infoBox);

  async function drawDb() {
    const [drivers, conns] = await Promise.all([api.drivers(), api.connections()]);
    dbBox.innerHTML = '';
    const names = { sqlite: 'SQLite', postgres: 'PostgreSQL', mysql: 'MySQL / MariaDB', mssql: 'MS SQL Server' };
    dbBox.append(
      h('div.section-title', 'Базы данных', h('span.grow'),
        button('Подключить', { icon: 'plus', cls: 'sm', onClick: async () => { if (await connectionForm(drivers)) drawDb(); } }),
        button('Открыть обозреватель', { icon: 'db', cls: 'sm', onClick: () => openDatabaseDialog() })),
      h('div.row', { style: { marginBottom: '10px', flexWrap: 'wrap' } }, Object.entries(names).map(([k, n]) => h('span.badge', { class: drivers[k] ? 'ok' : 'off', title: drivers[k] ? 'Драйвер доступен' : 'Драйвер не установлен' }, (drivers[k] ? '✓ ' : '— ') + n))));
    if (!conns.length) {
      dbBox.appendChild(h('div.list', h('div.list-item', h('div.ico', icon('db')), h('div.grow.muted', 'Подключений нет. Добавьте файл SQLite или сервер PostgreSQL / MySQL / MS SQL.'))));
      return;
    }
    const l = h('div.list');
    conns.forEach((c) => {
      const status = h('span.small.muted');
      l.appendChild(h('div.list-item',
        h('div.ico', icon('db')),
        h('div.grow', h('b', c.name), h('div.small.muted', names[c.type] + ' · ' + (c.type === 'sqlite' ? c.file + (c.size ? ` · ${(c.size / 1048576).toFixed(1)} МБ` : '') : `${c.user ? c.user + '@' : ''}${c.host}${c.port ? ':' + c.port : ''}/${c.database || ''}`))),
        status,
        button('Проверить', { cls: 'sm', onClick: async () => {
          status.textContent = '…';
          try {
            const r = await api.testConnection(c.id);
            status.textContent = `✓ ${r.tables} ${plural(r.tables, 'таблица', 'таблицы', 'таблиц')}`;
            status.style.color = 'var(--ok)';
          } catch (e) {
            status.textContent = e.message;
            status.style.color = 'var(--danger)';
          }
        } }),
        button('', { cls: 'sm', icon: 'edit', title: 'Изменить', onClick: async () => { if (await connectionForm(drivers, c)) drawDb(); } }),
        button('', { cls: 'sm danger', icon: 'trash', title: 'Удалить', onClick: async () => {
          if (!(await confirmDialog(`Удалить подключение «${c.name}»?`))) return;
          await api.deleteConnection(c.id);
          drawDb();
        } })));
    });
    dbBox.appendChild(l);
  }

  async function drawMaps() {
    const maps = await api.maps();
    mapBox.innerHTML = '';
    mapBox.append(h('div.section-title', 'Карты', h('span.grow'), button('Загрузить GeoJSON', { icon: 'upload', cls: 'sm', onClick: async () => { if (await uploadMapDialog()) drawMaps(); } })));
    const l = h('div.list');
    l.appendChild(h('div.list-item', h('div.ico', icon('map')), h('div.grow', h('b', 'Мир (страны)'), h('div.small.muted', 'Встроенная · 241 страна · названия на русском и английском, коды ISO')), h('span.badge', 'встроенная')));
    maps.forEach((m) => {
      l.appendChild(h('div.list-item', h('div.ico', icon('map')),
        h('div.grow', h('b', m.name), h('div.small.muted', `${m.features} ${plural(m.features, 'объект', 'объекта', 'объектов')} · свойства: ${(m.properties || []).slice(0, 6).join(', ')}${m.properties.length > 6 ? '…' : ''}`)),
        button('', { cls: 'sm danger', icon: 'trash', title: 'Удалить', onClick: async () => {
          if (!(await confirmDialog(`Удалить карту «${m.name}»? Визуализации с ней перестанут отображаться.`))) return;
          await api.deleteMap(m.id);
          drawMaps();
        } })));
    });
    mapBox.appendChild(l);
    mapBox.appendChild(h('p.small.muted', 'Подойдут границы регионов, районов, зон обслуживания и т.п. в формате GeoJSON (FeatureCollection, координаты WGS84). Из Shapefile/KML файл можно получить в QGIS: «Экспорт → Сохранить как → GeoJSON».'));
  }

  async function drawInfo() {
    const hInfo = await api.health();
    infoBox.innerHTML = '';
    infoBox.append(h('div.section-title', 'О сервере'), h('div.note',
      `Visualization Studio ${hInfo.version}. Все библиотеки (Apache ECharts, SheetJS) и карты загружаются с этого сервера — доступ в интернет не нужен. `,
      'Пользовательские шаблоны графиков: положите .js-файл в папку templates/ рядом с server.js — он появится в галерее после перезагрузки страницы.'));
  }

  Promise.all([drawDb(), drawMaps(), drawInfo()]).catch((e) => toast(e.message, 'error'));
}

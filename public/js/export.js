// Экспорт визуализаций: изображения, автономный HTML, конфигурации, данные, встраивание.
import { h, icon, button, modal, toast, downloadBlob, safeFilename } from './ui.js';
import { toCsv } from './importers.js';

const textCache = new Map();
async function fetchText(url) {
  if (!textCache.has(url)) {
    textCache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error('Не удалось загрузить ' + url);
      return r.text();
    }));
  }
  return textCache.get(url);
}

function dataUrlToBlob(url) {
  const [head, b64] = url.split(',');
  const mime = /:(.*?);/.exec(head)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function cleanProject(p) {
  const { id, createdAt, updatedAt, ...rest } = p;
  return rest;
}

// ---------------------------------------------------------------- изображения
export async function renderImage(project, { type = 'png', width, height, scale = 2, filterValue, frame, clip }) {
  const pending = window.VS.prepare(project);
  if (pending) await pending;
  return window.VS.renderStatic(project, { type, width, height, pixelRatio: scale, filterValue, frame, clip });
}

export async function thumbnailBlob(project, state) {
  const w = 640;
  const hgt = Math.round(w * 0.625);
  const url = await renderImage(project, { type: 'png', width: w, height: hgt, scale: 1, clip: true, ...state });
  return dataUrlToBlob(url);
}

// ---------------------------------------------------------------- автономный HTML
export async function buildStandaloneHtml(project, { state = {}, maxWidth = '' } = {}) {
  const VS = window.VS;
  const tplUrl = VS.templateSources?.[project.template];
  if (!tplUrl) throw new Error('Не найден файл шаблона');
  const [echarts, langRu, core, tpl] = await Promise.all([
    fetchText('/vendor/echarts.min.js'),
    fetchText('/vendor/echarts-langRU.js').catch(() => ''),
    fetchText('/runtime/core.js'),
    fetchText(tplUrl),
  ]);
  const s = VS.resolveSettings(VS.templates[project.template], project.settings);
  // карты встраиваем целиком, чтобы файл работал без сервера
  let maps = '';
  if (project.template === 'map') {
    const key = s['map.source'] || 'world';
    const pending = VS.prepare(project);
    if (pending) await pending;
    if (VS.mapData[key]) maps = `VS.mapData[${JSON.stringify(key)}] = ${JSON.stringify(VS.mapData[key])};`;
  }
  const safe = (js) => js.replace(/<\/script/gi, '<\\/script');
  const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const title = (project.title || 'Визуализация').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const p = cleanProject(project);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Visualization Studio ${VS.version}">
<title>${title}</title>
<style>
html,body{margin:0;background:${s['layout.background'] || '#fff'}}
#viz{width:100%;${maxWidth ? `max-width:${Number(maxWidth)}px;margin:0 auto;` : ''}}
</style>
</head>
<body>
<div id="viz" role="img" aria-label="${title}"></div>
<script>${safe(echarts)}</script>
<script>${safe(langRu)}</script>
<script>window.__VS_LOCALE_RU = true;</script>
<script>${safe(core)}</script>
<script>${safe(tpl)}</script>
<script>
${safe(maps)}
(function () {
  var project = ${json(p)};
  var el = document.getElementById('viz');
  function fit() { el.style.height = VS.heightFor(project, el.clientWidth || window.innerWidth) + 'px'; }
  fit();
  window.addEventListener('resize', fit);
  var viz = VS.render(el, project);
  ${state.filterValue !== undefined && state.filterValue !== null ? `viz.setFilter(${json(state.filterValue)});` : ''}
})();
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------- конфигурация ECharts
export function echartsOptionJson(project, { width = 1000, height = 600, state = {} } = {}) {
  const res = window.VS.buildOption(project, { width, height, filterValue: state.filterValue, frame: state.frame, forExport: true });
  const fnNote = [];
  const clean = JSON.stringify(res.option, (k, v) => {
    if (typeof v === 'function') {
      fnNote.push(k);
      return undefined;
    }
    return v;
  }, 2);
  return { json: clean, droppedFunctions: [...new Set(fnNote)] };
}

// ---------------------------------------------------------------- диалог экспорта
export function openExportDialog(project, { state = {}, previewSize } = {}) {
  const VS = window.VS;
  const name = safeFilename(project.title);
  const formats = [
    { id: 'image', icon: 'image', title: 'Изображение', sub: 'PNG, JPEG, SVG' },
    { id: 'html', icon: 'html', title: 'Интерактивный HTML', sub: 'Один файл, работает офлайн' },
    { id: 'embed', icon: 'embed', title: 'Встраивание', sub: 'Код iframe для интранета' },
    { id: 'config', icon: 'code', title: 'Конфигурация', sub: 'ECharts JSON, проект' },
    { id: 'data', icon: 'table', title: 'Данные', sub: 'CSV, JSON' },
  ];
  const nav = h('div.export-nav');
  const pane = h('div');
  const body = h('div.export-layout', nav, pane);
  const m = modal({ title: 'Экспорт и публикация', body, size: 'mid' });
  const tabs = {};
  formats.forEach((f) => {
    const b = h('button', { type: 'button' }, icon(f.icon), h('span', h('b', f.title), h('small', f.sub)));
    b.onclick = () => show(f.id);
    nav.appendChild(b);
    tabs[f.id] = b;
  });

  function show(id) {
    Object.entries(tabs).forEach(([k, b]) => b.classList.toggle('active', k === id));
    pane.innerHTML = '';
    ({ image: imagePane, html: htmlPane, embed: embedPane, config: configPane, data: dataPane })[id]();
  }

  function imagePane() {
    const w0 = previewSize?.width || 1200;
    const h0 = previewSize?.height || VS.heightFor(project, w0);
    const fmt = h('select.select', h('option', { value: 'png' }, 'PNG — для презентаций и документов'), h('option', { value: 'jpeg' }, 'JPEG — меньше размер файла'), h('option', { value: 'svg' }, 'SVG — векторный, для печати и вёрстки'));
    const preset = h('select.select',
      h('option', { value: 'current' }, `Как в предпросмотре (${w0} × ${h0})`),
      h('option', { value: '1920x1080' }, 'Full HD 1920 × 1080'),
      h('option', { value: '1280x720' }, 'Слайд 16:9 — 1280 × 720'),
      h('option', { value: '1024x768' }, 'Слайд 4:3 — 1024 × 768'),
      h('option', { value: '1080x1080' }, 'Квадрат 1080 × 1080'),
      h('option', { value: '800x1000' }, 'Вертикаль 800 × 1000'),
      h('option', { value: '700x420' }, 'Документ A4 по ширине — 700 × 420'),
      h('option', { value: 'custom' }, 'Свой размер…'));
    const wIn = h('input.input', { type: 'number', min: 100, max: 8000 });
    const hIn = h('input.input', { type: 'number', min: 100, max: 8000 });
    wIn.value = w0;
    hIn.value = h0;
    const scale = h('select.select', h('option', { value: '1' }, '1× (как есть)'), h('option', { value: '2', selected: true }, '2× (чётко на Retina и в печати)'), h('option', { value: '3' }, '3×'), h('option', { value: '4' }, '4× (плакат)'));
    const sizeRow = h('div.form-grid', h('label.field', h('span', 'Ширина, px'), wIn), h('label.field', h('span', 'Высота, px'), hIn));
    sizeRow.hidden = true;
    preset.onchange = () => {
      sizeRow.hidden = preset.value !== 'custom';
      if (preset.value === 'current') { wIn.value = w0; hIn.value = h0; }
      else if (preset.value !== 'custom') { const [a, b] = preset.value.split('x'); wIn.value = a; hIn.value = b; }
    };
    const scaleField = h('label.field', h('span', 'Плотность пикселей'), scale);
    fmt.onchange = () => (scaleField.hidden = fmt.value === 'svg');
    const go = button('Скачать', {
      icon: 'download', cls: 'primary',
      onClick: async () => {
        go.disabled = true;
        try {
          const width = Math.max(100, Number(wIn.value) || w0);
          const height = Math.max(100, Number(hIn.value) || h0);
          const out = await renderImage(project, { type: fmt.value, width, height, scale: Number(scale.value), ...state });
          if (fmt.value === 'svg') downloadBlob(new Blob([out], { type: 'image/svg+xml' }), name + '.svg');
          else downloadBlob(dataUrlToBlob(out), `${name}.${fmt.value === 'jpeg' ? 'jpg' : 'png'}`);
          toast('Файл сохранён', 'ok');
        } catch (e) {
          toast('Ошибка экспорта: ' + e.message, 'error');
        } finally {
          go.disabled = false;
        }
      },
    });
    pane.append(h('div.stack', { style: { gap: '14px' } },
      h('label.field', h('span', 'Формат'), fmt),
      h('label.field', h('span', 'Размер'), preset),
      sizeRow,
      scaleField,
      h('div.note', VS.templates[project.template]?.html ? 'Таблица экспортируется в выбранную ширину; высота — по содержимому (число строк задаётся в настройках «Экспорт в изображение»). ' : 'Изображение строится заново под выбранный размер — заголовки, подписи и легенда перекомпонуются. ',
        state.filterValue !== undefined && state.filterValue !== null ? 'Будет экспортировано текущее значение фильтра. ' : '',
        'Анимация и элементы управления в изображение не попадают.'),
      h('div.row', go)));
  }

  function htmlPane() {
    const maxW = h('input.input', { type: 'number', min: 300, placeholder: 'на всю ширину' });
    const go = button('Скачать HTML', {
      icon: 'download', cls: 'primary',
      onClick: async () => {
        go.disabled = true;
        try {
          const html = await buildStandaloneHtml(project, { state, maxWidth: maxW.value });
          downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), name + '.html');
          toast('HTML сохранён', 'ok');
        } catch (e) {
          toast('Ошибка: ' + e.message, 'error');
        } finally {
          go.disabled = false;
        }
      },
    });
    pane.append(h('div.stack', { style: { gap: '14px' } },
      h('p', { style: { margin: 0 } }, 'Один самодостаточный файл: библиотека ECharts, шаблон и данные встроены внутрь. Открывается в любом браузере без интернета и без сервера — подсказки, фильтры и анимация работают.'),
      h('label.field', h('span', 'Максимальная ширина, px (необязательно)'), maxW),
      h('div.note', 'Размер файла ≈ 1,2 МБ (большая часть — сама библиотека ECharts). Файл можно отправить по почте, положить на общий диск или в SharePoint/Confluence как вложение.'),
      h('div.row', go)));
  }

  function embedPane() {
    const base = location.origin;
    const url = `${base}/view/${encodeURIComponent(project.id)}`;
    const hgt = previewSize?.height || 500;
    const code = `<iframe src="${url}" title="${(project.title || '').replace(/"/g, '&quot;')}" width="100%" height="${hgt}" style="border:0" loading="lazy"></iframe>`;
    const box = h('div.code-box', code);
    const linkBox = h('div.code-box', url);
    const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
    pane.append(h('div.stack', { style: { gap: '12px' } },
      h('p', { style: { margin: 0 } }, 'Живая версия: при изменении проекта встроенная визуализация обновится автоматически.'),
      h('label.field', h('span', 'Ссылка'), linkBox),
      h('div.row', button('Копировать ссылку', { icon: 'copy', cls: 'sm', onClick: () => copy(url) }), button('Открыть', { icon: 'link', cls: 'sm', onClick: () => window.open(url, '_blank') })),
      h('label.field', h('span', 'Код для вставки (iframe)'), box),
      h('div.row', button('Копировать код', { icon: 'copy', cls: 'sm', onClick: () => copy(code) })),
      local ? h('div.note', 'Сейчас студия доступна только на этом компьютере (localhost). Чтобы коллеги в корпоративной сети видели встраивание, запустите сервер с HOST=0.0.0.0 и используйте сетевое имя/адрес машины — см. README.') : null));
  }

  function configPane() {
    const isHtml = VS.templates[project.template]?.html;
    const opt = () => echartsOptionJson(project, { width: previewSize?.width || 1000, height: previewSize?.height || 600, state });
    pane.append(h('div.stack', { style: { gap: '14px' } },
      h('div.list',
        isHtml ? null : h('div.list-item', h('div.ico', icon('code')), h('div.grow', h('b', 'Конфигурация ECharts (option)'), h('div.small.muted', 'Готовый объект option для echarts.setOption() — для встраивания в свои приложения')),
          button('Скачать', { icon: 'download', cls: 'sm', onClick: () => {
            const r = opt();
            downloadBlob(new Blob([r.json], { type: 'application/json' }), name + '.echarts.json');
            if (r.droppedFunctions.length) toast('Функции форматирования не сохраняются в JSON (' + r.droppedFunctions.slice(0, 4).join(', ') + ')');
          } }),
          button('', { icon: 'copy', cls: 'sm', title: 'Копировать', onClick: () => copy(opt().json) })),
        h('div.list-item', h('div.ico', icon('file')), h('div.grow', h('b', 'Проект Visualization Studio'), h('div.small.muted', 'Данные + настройки. Импортируется на главной странице студии на любом компьютере')),
          button('Скачать', { icon: 'download', cls: 'sm', onClick: () => downloadBlob(new Blob([JSON.stringify({ format: 'visualization-studio', version: 1, project: cleanProject(project) }, null, 2)], { type: 'application/json' }), name + '.vstudio.json') }))),
    ));
  }

  function dataPane() {
    const table = project.data || [];
    pane.append(h('div.stack', { style: { gap: '14px' } },
      h('div.list',
        h('div.list-item', h('div.ico', icon('table')), h('div.grow', h('b', 'CSV (Excel, разделитель «;»)'), h('div.small.muted', 'Открывается двойным щелчком в русском Excel')),
          button('Скачать', { icon: 'download', cls: 'sm', onClick: () => downloadBlob(new Blob(['﻿' + toCsv(table, ';')], { type: 'text/csv;charset=utf-8' }), name + '.csv') })),
        h('div.list-item', h('div.ico', icon('table')), h('div.grow', h('b', 'CSV (стандартный, разделитель «,»)'), h('div.small.muted', 'Для Python, R, BI-систем')),
          button('Скачать', { icon: 'download', cls: 'sm', onClick: () => downloadBlob(new Blob([toCsv(table, ',')], { type: 'text/csv;charset=utf-8' }), name + '.csv') })),
        h('div.list-item', h('div.ico', icon('code')), h('div.grow', h('b', 'JSON (массив объектов)'), h('div.small.muted', 'Строки таблицы с ключами по заголовкам')),
          button('Скачать', { icon: 'download', cls: 'sm', onClick: () => {
            const [head = [], ...rows] = table;
            const arr = rows.map((r) => Object.fromEntries(head.map((k, i) => [k || VS.colLetter(i), r[i] ?? ''])));
            downloadBlob(new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' }), name + '.json');
          } })))));
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Скопировано', 'ok');
    } catch {
      const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('Скопировано', 'ok');
    }
  }

  show('image');
  return m;
}

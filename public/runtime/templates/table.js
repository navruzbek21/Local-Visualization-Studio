(function (VS) {
  'use strict';

  // Таблица — HTML-шаблон: поиск, сортировка, страницы, раскраска значений, мини-гистограммы, итоги.
  VS.registerTemplate({
    id: 'table',
    order: 95,
    name: 'Таблица',
    category: 'Таблицы',
    description: 'Интерактивная таблица: поиск, сортировка, раскраска значений, мини-гистограммы в ячейках и строка итогов.',
    icon: '<svg viewBox="0 0 48 36"><rect x="4" y="4" width="40" height="6" rx="1.5" fill="var(--c1)"/><g fill="currentColor" opacity=".18"><rect x="4" y="12" width="40" height="5"/><rect x="4" y="25" width="40" height="5"/></g><rect x="30" y="13" width="9" height="3" rx="1" fill="var(--c2)"/><rect x="30" y="19.5" width="13" height="3" rx="1" fill="var(--c2)"/><rect x="30" y="26" width="5" height="3" rx="1" fill="var(--c2)"/><g fill="currentColor" opacity=".5"><rect x="6" y="13.5" width="14" height="2" rx="1"/><rect x="6" y="20" width="10" height="2" rx="1"/><rect x="6" y="26.5" width="16" height="2" rx="1"/></g></svg>',
    bindings: [
      { key: 'columns', name: 'Колонки таблицы', dataType: 'any', multiple: true, description: 'Какие колонки показывать и в каком порядке' },
      { key: 'heat', name: 'Раскрасить по значению', dataType: 'number', multiple: true, optional: true, description: 'Фон ячеек по цветовой шкале' },
      { key: 'bars', name: 'Мини-гистограммы', dataType: 'number', multiple: true, optional: true, description: 'Полоска пропорционально значению' },
      { key: 'totalsCols', name: 'Колонки для итогов', dataType: 'number', multiple: true, optional: true, description: 'Пусто — все числовые (если включена строка итогов)' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    autoBind: function (cols) {
      return { columns: cols.map(function (c) { return c.index; }) };
    },
    common: ['layout', 'number', 'appearance'],
    sections: [
      {
        id: 'table',
        title: 'Таблица',
        items: [
          { key: 'table.search', label: 'Поиск по таблице', type: 'toggle', default: true },
          { key: 'table.sortable', label: 'Сортировка по клику на заголовок', type: 'toggle', default: true },
          { key: 'table.sortCol', label: 'Сортировать по колонке', type: 'text', default: '', placeholder: 'название колонки', help: 'Начальная сортировка; пусто — как в данных' },
          { key: 'table.sortDir', label: 'Направление', type: 'radio', options: [['desc', 'По убыванию'], ['asc', 'По возрастанию']], default: 'desc', show: function (s) { return !!s['table.sortCol']; } },
          { key: 'table.pageSize', label: 'Строк на странице', type: 'select', options: [['0', 'Все (прокрутка)'], ['10', '10'], ['20', '20'], ['50', '50'], ['100', '100']], default: '0' },
          { key: 'table.totals', label: 'Строка итогов', type: 'select', options: [['none', 'Нет'], ['sum', 'Сумма'], ['avg', 'Среднее']], default: 'none' },
          { key: 'table.totalsLabel', label: 'Подпись итогов', type: 'text', default: 'Итого', show: function (s) { return s['table.totals'] !== 'none'; } },
          { type: 'heading', label: 'Оформление' },
          { key: 'table.density', label: 'Плотность строк', type: 'radio', options: [['compact', 'Плотно'], ['normal', 'Обычно'], ['loose', 'Свободно']], default: 'normal' },
          { key: 'table.striped', label: 'Чередование фона строк', type: 'toggle', default: true },
          { key: 'table.firstBold', label: 'Первая колонка жирным', type: 'toggle', default: true },
          { key: 'table.wrap', label: 'Переносить длинный текст', type: 'toggle', default: false },
          { key: 'table.headerBg', label: 'Фон заголовка', type: 'color', default: '' },
          { type: 'heading', label: 'Раскраска и гистограммы' },
          { key: 'table.heatScale', label: 'Шкала раскраски', type: 'scale', default: 'blues' },
          { key: 'table.heatMode', label: 'Диапазон шкалы', type: 'radio', options: [['column', 'Для каждой колонки'], ['table', 'Общий']], default: 'column' },
          { key: 'table.barColor', label: 'Цвет гистограмм', type: 'color', default: '#2a78d6' },
          { key: 'table.barValues', label: 'Числа рядом с гистограммой', type: 'toggle', default: true },
          { type: 'heading', label: 'Экспорт в изображение' },
          { key: 'table.staticRows', label: 'Строк в PNG/SVG', type: 'number', min: 1, max: 500, default: 30 },
        ],
      },
    ],
    sample: {
      data: [
        ['Скважина', 'Куст', 'Тип', 'Дебит нефти, т/сут', 'Дебит жидкости, т/сут', 'Обводнённость, %', 'Накопленная нефть, тыс. т', 'Пластовое давление, атм'],
        ['101', '1', 'Добывающая', '42,5', '61,2', '30,6', '512,4', '231'],
        ['102', '1', 'Добывающая', '18,1', '74,8', '75,8', '388,0', '219'],
        ['103', '1', 'Добывающая', '27,9', '39,0', '28,5', '296,7', '236'],
        ['104', '2', 'Добывающая', '9,4', '88,3', '89,4', '615,2', '205'],
        ['105', '2', 'Добывающая', '35,0', '47,1', '25,7', '201,9', '240'],
        ['106', '2', 'Добывающая', '12,7', '52,6', '75,9', '344,1', '214'],
        ['107', '3', 'Добывающая', '51,3', '66,0', '22,3', '158,3', '244'],
        ['108', '3', 'Добывающая', '6,2', '95,4', '93,5', '702,8', '198'],
        ['201', '1', 'Нагнетательная', '', '', '', '', '268'],
        ['202', '2', 'Нагнетательная', '', '', '', '', '271'],
      ],
      bindings: { columns: [0, 1, 2, 3, 4, 5, 6, 7], heat: [5], bars: [3, 6], totalsCols: [3, 4, 6] },
      settings: { title: 'Технологический режим скважин', subtitle: 'Демонстрационные данные, сентябрь 2025', footer: 'Источник: демонстрационные данные', 'table.sortCol': 'Дебит нефти, т/сут', 'table.totals': 'sum' },
    },
    legend: false,

    renderHtml: function (el, ctx, api) {
      var m = model(ctx, api.state);
      if (!m) {
        el.innerHTML = '<div style="padding:24px;color:' + ctx.theme.muted + '">Выберите колонки на вкладке «Данные»</div>';
        return;
      }
      var s = ctx.s;
      var st = api.state;
      var t = ctx.theme;
      var padY = { compact: 4, normal: 8, loose: 12 }[s['table.density']] || 8;
      var headBg = s['table.headerBg'] || VS.color.mix(t.text, t.background, 0.94);
      var stripe = VS.color.mix(t.text, t.background, 0.975);

      // поиск
      if (s['table.search']) {
        var inp = document.createElement('input');
        inp.type = 'search';
        inp.placeholder = 'Поиск…';
        inp.value = st.q || '';
        inp.setAttribute('aria-label', 'Поиск по таблице');
        inp.style.cssText = 'font:inherit;font-size:13px;padding:6px 10px;border:1px solid ' + t.grid + ';border-radius:6px;background:' + t.background + ';color:' + t.text + ';min-width:200px';
        inp.oninput = function () {
          st.q = inp.value;
          st.page = 0;
          var pos = inp.selectionStart;
          api.rerender();
          var again = api.root.querySelector('.vs-h-bar input[type=search]');
          if (again) {
            again.focus();
            again.setSelectionRange(pos, pos);
          }
        };
        api.bar.appendChild(inp);
      }
      var info = document.createElement('span');
      info.style.cssText = 'font-size:12px;color:' + t.muted;
      info.textContent = m.total === m.allCount ? m.total + ' ' + VS.util.plural(m.total, 'строка', 'строки', 'строк') : 'Найдено ' + m.total + ' из ' + m.allCount;
      api.bar.appendChild(info);

      var html = ['<table style="border-collapse:separate;border-spacing:0;width:100%;font-variant-numeric:tabular-nums">'];
      html.push('<thead><tr>');
      m.cols.forEach(function (c, ci) {
        var arrow = st.sort === c.index ? (st.dir === 'asc' ? ' ▲' : ' ▼') : '';
        html.push('<th data-ci="' + ci + '" scope="col" style="position:sticky;top:0;z-index:1;background:' + headBg + ';text-align:' + (c.num ? 'right' : 'left') +
          ';padding:' + (padY + 2) + 'px 10px;border-bottom:2px solid ' + t.axis + ';font-weight:600;white-space:nowrap;' + (s['table.sortable'] ? 'cursor:pointer;user-select:none' : '') + '">' +
          VS.util.escapeHtml(c.name) + '<span style="color:' + t.muted + '">' + arrow + '</span></th>');
      });
      html.push('</tr></thead><tbody>');
      m.page.forEach(function (row, ri) {
        html.push('<tr style="' + (s['table.striped'] && ri % 2 ? 'background:' + stripe : '') + '">');
        m.cols.forEach(function (c, ci) {
          html.push(cellHtml(ctx, m, c, row, ci, padY));
        });
        html.push('</tr>');
      });
      html.push('</tbody>');
      if (m.totals) {
        html.push('<tfoot><tr>');
        m.cols.forEach(function (c, ci) {
          var v = ci === 0 && !c.num ? m.totalsLabel : c.num ? (m.totals[ci] === null ? '' : ctx.fmt(m.totals[ci])) : '';
          html.push('<td style="position:sticky;bottom:0;background:' + headBg + ';padding:' + padY + 'px 10px;border-top:2px solid ' + t.axis + ';font-weight:700;text-align:' + (c.num ? 'right' : 'left') + '">' + VS.util.escapeHtml(v) + '</td>');
        });
        html.push('</tr></tfoot>');
      }
      html.push('</table>');
      if (!m.page.length) html.push('<div style="padding:20px;text-align:center;color:' + t.muted + '">Ничего не найдено</div>');
      el.innerHTML = html.join('');

      // страницы
      if (m.pages > 1) {
        var nav = document.createElement('div');
        nav.style.cssText = 'display:flex;gap:6px;align-items:center;justify-content:flex-end;padding:8px 0;font-size:13px;color:' + t.muted;
        var mk = function (label, page, disabled) {
          var b = document.createElement('button');
          b.type = 'button';
          b.textContent = label;
          b.disabled = disabled;
          b.style.cssText = 'font:inherit;padding:3px 10px;border:1px solid ' + t.grid + ';border-radius:5px;background:' + t.background + ';color:' + t.text + ';cursor:pointer;opacity:' + (disabled ? 0.4 : 1);
          b.onclick = function () {
            st.page = page;
            api.rerender();
          };
          return b;
        };
        nav.appendChild(mk('←', m.pageIndex - 1, m.pageIndex === 0));
        var lbl = document.createElement('span');
        lbl.textContent = 'Стр. ' + (m.pageIndex + 1) + ' из ' + m.pages;
        nav.appendChild(lbl);
        nav.appendChild(mk('→', m.pageIndex + 1, m.pageIndex >= m.pages - 1));
        el.appendChild(nav);
      }
      if (s['table.sortable']) {
        el.querySelectorAll('th').forEach(function (th) {
          th.onclick = function () {
            var c = m.cols[Number(th.dataset.ci)];
            if (st.sort === c.index) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
            else {
              st.sort = c.index;
              st.dir = c.num ? 'desc' : 'asc';
            }
            api.rerender();
          };
        });
      }
    },

    // Отрисовка для PNG/SVG: та же таблица без интерактивности (первые N строк текущей сортировки)
    drawStatic: function (ctx, d, box) {
      var m = model(ctx, {}, Number(ctx.s['table.staticRows']) || 30);
      if (!m) return box.y;
      var s = ctx.s;
      var t = ctx.theme;
      var fs = ctx.fontSize + 1;
      var padY = { compact: 4, normal: 8, loose: 12 }[s['table.density']] || 8;
      var rowH = Math.round(fs * 1.4 + padY * 2);
      var headBg = s['table.headerBg'] || VS.color.mix(t.text, t.background, 0.94);
      var stripe = VS.color.mix(t.text, t.background, 0.975);
      // ширины колонок по содержимому, затем растягиваем на всю ширину
      var widths = m.cols.map(function (c, ci) {
        var w = VS.measureText(c.name, '600 ' + fs + 'px ' + ctx.font);
        m.page.forEach(function (row) { w = Math.max(w, VS.measureText(display(ctx, c, row[ci]), fs + 'px ' + ctx.font) + (m.barCols[ci] ? 60 : 0)); });
        return Math.min(w + 20, 320);
      });
      var total = widths.reduce(function (a, b) { return a + b; }, 0);
      var k = box.width / total;
      widths = widths.map(function (w) { return w * k; });
      var xs = [box.x];
      widths.forEach(function (w, i) { xs[i + 1] = xs[i] + w; });
      var y = box.y;
      var clip = function (text, w, font) {
        text = String(text);
        if (VS.measureText(text, font) <= w) return text;
        while (text.length > 1 && VS.measureText(text + '…', font) > w) text = text.slice(0, -1);
        return text + '…';
      };
      d.rect(box.x, y, box.width, rowH, headBg);
      m.cols.forEach(function (c, ci) {
        var font = '600 ' + fs + 'px ' + ctx.font;
        d.text(c.num ? xs[ci + 1] - 10 : xs[ci] + 10, y + rowH / 2, clip(c.name, widths[ci] - 20, font), { font: ctx.font, size: fs, weight: 600, color: t.text, align: c.num ? 'right' : 'left' });
      });
      y += rowH;
      d.line(box.x, y, box.x + box.width, y, t.axis, 2);
      m.page.forEach(function (row, ri) {
        if (s['table.striped'] && ri % 2) d.rect(box.x, y, box.width, rowH, stripe);
        m.cols.forEach(function (c, ci) {
          var v = row[ci];
          var heat = m.heatColor(ci, v);
          if (heat) d.rect(xs[ci], y, widths[ci], rowH, heat);
          var bold = s['table.firstBold'] && ci === 0;
          var color = heat && VS.color.luminance(heat) < 0.35 ? '#ffffff' : t.text;
          if (m.barCols[ci] && c.num && v !== null) {
            var frac = m.barFrac(ci, v);
            var bw = (widths[ci] - 20) * (s['table.barValues'] ? 0.55 : 1);
            d.rect(xs[ci] + 10, y + rowH / 2 - 5, Math.max(1, bw * frac), 10, s['table.barColor'] || '#2a78d6', null, 2);
            if (s['table.barValues']) d.text(xs[ci + 1] - 10, y + rowH / 2, display(ctx, c, v), { font: ctx.font, size: fs, color: color, align: 'right' });
          } else {
            var font = (bold ? '600 ' : '') + fs + 'px ' + ctx.font;
            d.text(c.num ? xs[ci + 1] - 10 : xs[ci] + 10, y + rowH / 2, clip(display(ctx, c, v), widths[ci] - 20, font), { font: ctx.font, size: fs, weight: bold ? 600 : 'normal', color: color, align: c.num ? 'right' : 'left' });
          }
        });
        y += rowH;
        d.line(box.x, y, box.x + box.width, y, t.grid, 1);
      });
      if (m.totals) {
        d.rect(box.x, y, box.width, rowH, headBg);
        d.line(box.x, y, box.x + box.width, y, t.axis, 2);
        m.cols.forEach(function (c, ci) {
          var v = ci === 0 && !c.num ? m.totalsLabel : c.num && m.totals[ci] !== null ? ctx.fmt(m.totals[ci]) : '';
          d.text(c.num ? xs[ci + 1] - 10 : xs[ci] + 10, y + rowH / 2, v, { font: ctx.font, size: fs, weight: 700, color: t.text, align: c.num ? 'right' : 'left' });
        });
        y += rowH;
      }
      if (m.total > m.page.length) {
        y += 6;
        d.text(box.x, y + 8, 'Показаны первые ' + m.page.length + ' из ' + m.total + ' строк', { font: ctx.font, size: ctx.fontSize, color: t.muted });
        y += 16;
      }
      return y;
    },
  });

  function display(ctx, c, v) {
    if (v === null || v === undefined || v === '') return '';
    return c.num ? ctx.fmt(v) : String(v);
  }

  function cellHtml(ctx, m, c, row, ci, padY) {
    var s = ctx.s;
    var v = row[ci];
    var style = 'padding:' + padY + 'px 10px;border-bottom:1px solid ' + ctx.theme.grid + ';text-align:' + (c.num ? 'right' : 'left') + ';' + (s['table.wrap'] ? '' : 'white-space:nowrap;');
    if (s['table.firstBold'] && ci === 0) style += 'font-weight:600;';
    var heat = m.heatColor(ci, v);
    if (heat) style += 'background:' + heat + ';' + (VS.color.luminance(heat) < 0.35 ? 'color:#fff;' : '');
    var text = VS.util.escapeHtml(display(ctx, c, v));
    if (m.barCols[ci] && c.num && v !== null) {
      var pct = Math.round(m.barFrac(ci, v) * 1000) / 10;
      var bar = '<span style="display:inline-block;vertical-align:middle;height:10px;border-radius:2px;width:' + pct + '%;max-width:100%;background:' + (s['table.barColor'] || '#2a78d6') + '"></span>';
      return '<td style="' + style + 'min-width:120px"><div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">' +
        '<span style="flex:1;text-align:left;line-height:0">' + bar + '</span>' + (s['table.barValues'] ? '<span>' + text + '</span>' : '') + '</div></td>';
    }
    return '<td style="' + style + '">' + text + '</td>';
  }

  // Модель таблицы: видимые колонки, отсортированные/отфильтрованные строки, раскраска
  function model(ctx, st, limit) {
    var cols = ctx.columnsOf('columns');
    if (!cols.length) return null;
    var s = ctx.s;
    var heatSet = {}, barSet = {}, totSet = null;
    ctx.columnsOf('heat').forEach(function (c) { heatSet[c.index] = 1; });
    if (ctx.has('totalsCols')) {
      totSet = {};
      ctx.columnsOf('totalsCols').forEach(function (c) { totSet[c.index] = 1; });
    }
    ctx.columnsOf('bars').forEach(function (c) { barSet[c.index] = 1; });
    var defs = cols.map(function (c) { return { index: c.index, name: c.name, num: c.type === 'number', col: c }; });
    var rows = ctx.rows.map(function (_, i) {
      return defs.map(function (d) { return d.num ? d.col.num[i] : d.col.raw[i]; });
    });
    var allCount = rows.length;
    var q = String(st.q || '').trim().toLowerCase();
    if (q) rows = rows.filter(function (r) {
      return r.some(function (v, ci) { return display(ctx, defs[ci], v).toLowerCase().indexOf(q) >= 0; });
    });
    // сортировка: выбранная пользователем или из настроек
    if (st.sort === undefined && s['table.sortCol']) {
      var want = String(s['table.sortCol']).trim().toLowerCase();
      var sc = defs.find(function (d) { return d.name.toLowerCase() === want || VS.colLetter(d.index).toLowerCase() === want; });
      if (sc) {
        st.sort = sc.index;
        st.dir = s['table.sortDir'] || 'desc';
      }
    }
    var si = defs.findIndex(function (d) { return d.index === st.sort; });
    if (si >= 0) {
      var dir = st.dir === 'asc' ? 1 : -1;
      var numeric = defs[si].num;
      rows = rows.slice().sort(function (a, b) {
        var x = a[si], y = b[si];
        var ex = x === null || x === '', ey = y === null || y === '';
        if (ex || ey) return ex === ey ? 0 : ex ? 1 : -1; // пустые всегда внизу
        return (numeric ? x - y : String(x).localeCompare(String(y), 'ru', { numeric: true })) * dir;
      });
    }
    // диапазоны для раскраски и гистограмм — по всем строкам (не только странице)
    var ranges = defs.map(function (d, ci) {
      if (!d.num) return null;
      return VS.stats(rows.map(function (r) { return r[ci]; }));
    });
    var tableRange = VS.stats([].concat.apply([], defs.map(function (d, ci) {
      return heatSet[d.index] && d.num ? rows.map(function (r) { return r[ci]; }) : [];
    })));
    var colors = ctx.seqScale(s['table.heatScale']);
    var total = rows.length;
    var pageSize = limit || Number(s['table.pageSize']) || 0;
    var pages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    var pageIndex = limit ? 0 : Math.min(Math.max(0, st.page || 0), pages - 1);
    var page = pageSize ? rows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize) : rows;
    var totals = null;
    if (s['table.totals'] && s['table.totals'] !== 'none') {
      totals = defs.map(function (d, ci) {
        if (!d.num || (totSet && !totSet[d.index])) return null;
        var st2 = VS.stats(rows.map(function (r) { return r[ci]; }));
        if (!st2.count) return null;
        return s['table.totals'] === 'avg' ? st2.sum / st2.count : st2.sum;
      });
    }
    return {
      cols: defs,
      page: page,
      total: total,
      allCount: allCount,
      pages: pages,
      pageIndex: pageIndex,
      totals: totals,
      totalsLabel: s['table.totalsLabel'] || 'Итого',
      barCols: defs.map(function (d) { return !!barSet[d.index]; }),
      heatColor: function (ci, v) {
        var d = defs[ci];
        if (!heatSet[d.index] || !d.num || v === null) return null;
        var r = s['table.heatMode'] === 'table' ? tableRange : ranges[ci];
        var tt = r.max > r.min ? (v - r.min) / (r.max - r.min) : 0.5;
        return VS.color.scale(colors, 0.08 + tt * 0.8);
      },
      barFrac: function (ci, v) {
        var r = ranges[ci];
        var mx = Math.max(Math.abs(r.max), Math.abs(r.min));
        return mx ? Math.max(0, Math.abs(v) / mx) : 0;
      },
    };
  }
})(window.VS);

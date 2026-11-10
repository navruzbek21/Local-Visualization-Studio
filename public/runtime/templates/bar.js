(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'bar',
    order: 10,
    name: 'Столбчатая диаграмма',
    category: 'Сравнение',
    description: 'Сравнение значений по категориям: сгруппированные столбцы, с накоплением или 100%.',
    icon: '<svg viewBox="0 0 48 36"><rect x="5" y="16" width="7" height="16" rx="1.5" fill="var(--c1)"/><rect x="15" y="8" width="7" height="24" rx="1.5" fill="var(--c1)"/><rect x="25" y="20" width="7" height="12" rx="1.5" fill="var(--c1)"/><rect x="35" y="4" width="7" height="28" rx="1.5" fill="var(--c1)"/></svg>',
    variants: [
      { name: 'Столбцы', settings: { 'bar.orientation': 'vertical', 'bar.mode': 'grouped' } },
      {
        name: 'Столбцы с накоплением', settings: { 'bar.orientation': 'vertical', 'bar.mode': 'stacked' },
        icon: '<svg viewBox="0 0 48 36"><rect x="6" y="18" width="9" height="14" fill="var(--c1)"/><rect x="6" y="10" width="9" height="8" fill="var(--c2)"/><rect x="19" y="14" width="9" height="18" fill="var(--c1)"/><rect x="19" y="4" width="9" height="10" fill="var(--c2)"/><rect x="32" y="22" width="9" height="10" fill="var(--c1)"/><rect x="32" y="14" width="9" height="8" fill="var(--c2)"/></svg>',
      },
      {
        name: 'Столбцы 100%', settings: { 'bar.orientation': 'vertical', 'bar.mode': 'percent' },
        icon: '<svg viewBox="0 0 48 36"><rect x="6" y="4" width="9" height="28" fill="var(--c2)"/><rect x="6" y="16" width="9" height="16" fill="var(--c1)"/><rect x="19" y="4" width="9" height="28" fill="var(--c2)"/><rect x="19" y="10" width="9" height="22" fill="var(--c1)"/><rect x="32" y="4" width="9" height="28" fill="var(--c2)"/><rect x="32" y="22" width="9" height="10" fill="var(--c1)"/></svg>',
      },
      {
        name: 'Линейчатая', settings: { 'bar.orientation': 'horizontal', 'bar.mode': 'grouped' },
        icon: '<svg viewBox="0 0 48 36"><rect x="4" y="4" width="36" height="6" rx="1.5" fill="var(--c1)"/><rect x="4" y="13" width="26" height="6" rx="1.5" fill="var(--c1)"/><rect x="4" y="22" width="18" height="6" rx="1.5" fill="var(--c1)"/></svg>',
      },
      {
        name: 'Линейчатая с накоплением', settings: { 'bar.orientation': 'horizontal', 'bar.mode': 'stacked' },
        icon: '<svg viewBox="0 0 48 36"><rect x="4" y="4" width="22" height="7" fill="var(--c1)"/><rect x="26" y="4" width="16" height="7" fill="var(--c2)"/><rect x="4" y="14" width="16" height="7" fill="var(--c1)"/><rect x="20" y="14" width="12" height="7" fill="var(--c2)"/><rect x="4" y="24" width="10" height="7" fill="var(--c1)"/><rect x="14" y="24" width="14" height="7" fill="var(--c2)"/></svg>',
      },
    ],
    bindings: [
      { key: 'label', name: 'Категории', dataType: 'any', description: 'Подписи столбцов' },
      { key: 'values', name: 'Значения', dataType: 'number', multiple: true, description: 'Каждая колонка — отдельная серия' },
      { key: 'filter', name: 'Фильтр', optional: true, description: 'Переключатель над графиком' },
    ],
    sections: [
      {
        id: 'bars',
        title: 'Столбцы',
        items: [
          { key: 'bar.orientation', label: 'Ориентация', type: 'radio', options: [['vertical', 'Вертикально'], ['horizontal', 'Горизонтально']], default: 'vertical' },
          { key: 'bar.mode', label: 'Режим', type: 'radio', options: [['grouped', 'Рядом'], ['stacked', 'Накопление'], ['percent', '100%']], default: 'grouped' },
          { key: 'bar.sort', label: 'Сортировка', type: 'select', options: [['none', 'Как в данных'], ['desc', 'По убыванию'], ['asc', 'По возрастанию'], ['alpha', 'По алфавиту']], default: 'none' },
          { key: 'bar.colorBy', label: 'Цвет', type: 'radio', options: [['series', 'По сериям'], ['category', 'По категориям']], default: 'series', help: '«По категориям» — для одной серии значений' },
          { key: 'bar.gap', label: 'Промежуток между группами, %', type: 'range', min: 0, max: 80, default: 30 },
          { key: 'bar.radius', label: 'Скругление краёв, px', type: 'range', min: 0, max: 12, default: 3 },
          { key: 'bar.maxBars', label: 'Показывать не больше N категорий', type: 'number', min: 0, default: 0, help: '0 — все' },
          { type: 'heading', label: 'Подписи значений' },
          { key: 'labels.show', label: 'Показывать значения', type: 'toggle', default: false },
          { key: 'labels.position', label: 'Положение', type: 'radio', options: [['outside', 'Снаружи'], ['inside', 'Внутри']], default: 'outside', show: function (s) { return s['labels.show']; } },
          { key: 'labels.total', label: 'Итог над стопкой', type: 'toggle', default: false, show: function (s) { return s['bar.mode'] === 'stacked'; } },
        ],
      },
      VS.axisSection({ xLabel: 'Ось категорий', yLabel: 'Ось значений' }),
    ],
    sample: {
      data: [
        ['Регион', '2022', '2023', '2024'],
        ['Центральный', '1 240', '1 380', '1 525'],
        ['Северо-Западный', '860', '910', '1 004'],
        ['Южный', '640', '702', '768'],
        ['Приволжский', '980', '1 015', '1 120'],
        ['Уральский', '720', '754', '812'],
        ['Сибирский', '690', '735', '790'],
        ['Дальневосточный', '410', '436', '470'],
      ],
      bindings: { label: 0, values: [1, 2, 3] },
      settings: { title: 'Выручка по федеральным округам', subtitle: 'млн ₽, 2022–2024', footer: 'Источник: демонстрационные данные' },
    },
    legendNames: function (ctx) {
      var v = ctx.columnsOf('values');
      if (v.length < 2) return null;
      return v.map(function (c) { return c.name; });
    },
    tooltip: function (ctx) {
      var horiz = ctx.s['bar.orientation'] === 'horizontal';
      var percent = ctx.s['bar.mode'] === 'percent';
      var o = { trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: VS.color.alpha(ctx.theme.text, 0.05) } } };
      o.formatter = function (params) {
        var list = Array.isArray(params) ? params : [params];
        if (!list.length) return '';
        var rows = list.filter(function (p) { return p.value !== '-' && p.value !== null; }).map(function (p) {
          var d = p.data || {};
          var raw = d.rawValue !== undefined ? d.rawValue : p.value;
          var val = ctx.fmt(raw);
          if (percent) val = ctx.fmt(Array.isArray(p.value) ? p.value[horiz ? 0 : 1] : p.value, { noAffix: true, noCompact: true, decimals: 1 }) + '% · ' + val;
          return { name: list.length > 1 ? p.seriesName : (ctx.column('values') || {}).name, value: val, color: p.color };
        });
        return VS.tooltipHtml(ctx, list[0].name, rows);
      };
      return o;
    },
    build: function (ctx) {
      var s = ctx.s;
      var label = ctx.column('label');
      var vals = ctx.columnsOf('values');
      if (!label || !vals.length) return VS.empty(ctx, 'Привяжите колонки «Категории» и «Значения» на вкладке «Данные»');

      var horiz = s['bar.orientation'] === 'horizontal';
      var mode = s['bar.mode'];
      var stacked = mode !== 'grouped';
      var n = label.raw.length;
      var order = [];
      for (var i = 0; i < n; i++) order.push(i);
      var totalOf = function (i) {
        return vals.reduce(function (a, c) { return a + (c.num[i] || 0); }, 0);
      };
      if (s['bar.sort'] === 'desc') order.sort(function (a, b) { return totalOf(b) - totalOf(a); });
      else if (s['bar.sort'] === 'asc') order.sort(function (a, b) { return totalOf(a) - totalOf(b); });
      else if (s['bar.sort'] === 'alpha') order.sort(function (a, b) { return label.raw[a].localeCompare(label.raw[b], 'ru'); });
      var maxBars = Number(s['bar.maxBars']) || 0;
      if (maxBars > 0) order = order.slice(0, maxBars);

      var cats = order.map(function (i) { return label.raw[i]; });
      var absTotals = order.map(function (i) {
        return vals.reduce(function (a, c) { return a + Math.abs(c.num[i] || 0); }, 0);
      });
      var r = Number(s['bar.radius']) || 0;
      var radius = horiz ? [0, r, r, 0] : [r, r, 0, 0];
      var byCategory = s['bar.colorBy'] === 'category' && vals.length === 1;

      var series = vals.map(function (c, si) {
        var color = ctx.color(c.name, si);
        var data = order.map(function (i, k) {
          var v = c.num[i];
          var item = { value: v === null ? '-' : v, rowIndex: i };
          if (mode === 'percent') {
            item.value = v === null ? '-' : absTotals[k] ? (v / absTotals[k]) * 100 : 0;
            item.rawValue = v;
          }
          if (byCategory) item.itemStyle = { color: ctx.color(cats[k], k) };
          return item;
        });
        var serie = {
          type: 'bar',
          name: c.name,
          data: data,
          barCategoryGap: (Number(s['bar.gap']) || 0) + '%',
          barGap: '8%',
          barMaxWidth: 90,
          itemStyle: {
            color: color,
            borderRadius: stacked ? 0 : radius,
            borderColor: stacked ? ctx.theme.background : undefined,
            borderWidth: stacked ? 1 : 0,
          },
          emphasis: { focus: vals.length > 1 ? 'series' : 'none' },
        };
        if (stacked) serie.stack = 'total';
        if (s['labels.show']) {
          var inside = s['labels.position'] === 'inside' || stacked;
          serie.label = VS.labelStyle(ctx, {
            show: true,
            position: inside ? 'inside' : horiz ? 'right' : 'top',
            color: inside ? '#fff' : ctx.theme.text,
            fontSize: ctx.fontSize - 1,
            formatter: function (p) {
              var d = p.data || {};
              if (mode === 'percent') return ctx.fmt(p.value, { noAffix: true, noCompact: true, decimals: 0 }) + '%';
              return ctx.fmt(d.rawValue !== undefined ? d.rawValue : p.value);
            },
          });
          serie.labelLayout = { hideOverlap: true };
        }
        return serie;
      });

      // Итог над стопкой — невидимая серия с подписью
      if (stacked && mode === 'stacked' && s['labels.total']) {
        series.push({
          type: 'bar',
          name: '__total',
          stack: 'total',
          silent: true,
          tooltip: { show: false },
          itemStyle: { color: 'transparent' },
          data: order.map(function () { return 0; }),
          label: VS.labelStyle(ctx, {
            show: true,
            position: horiz ? 'right' : 'top',
            fontWeight: 'bold',
            formatter: function (p) { return ctx.fmt(totalOf(order[p.dataIndex])); },
          }),
        });
      }

      var catAxis = VS.axis(ctx, 'x', {
        type: 'category',
        data: cats,
        inverse: horiz,
      });
      if (horiz) {
        catAxis.axisLabel.width = Math.round(ctx.area.width * 0.28);
        catAxis.axisLabel.overflow = 'truncate';
        catAxis.axisLabel.hideOverlap = false;
        catAxis.axisLabel.interval = 0;
        if (catAxis.nameLocation) catAxis.nameGap = catAxis.axisLabel.width + 12;
      }
      var valAxis = VS.axis(ctx, 'y', { type: 'value', percent: mode === 'percent' });

      var ref = VS.refLine(ctx, horiz);
      if (ref && series[0]) series[0].markLine = ref;

      var out = { series: series, grid: VS.grid(ctx, { right: horiz && s['labels.show'] ? 10 : 0 }) };
      if (horiz) {
        // для горизонтальных столбцов категории — по вертикали
        catAxis.splitLine.show = !!s['xAxis.grid'];
        valAxis.position = s['yAxis.position'] === 'right' ? 'top' : 'bottom';
        out.yAxis = catAxis;
        out.xAxis = valAxis;
      } else {
        out.xAxis = catAxis;
        out.yAxis = valAxis;
      }
      if (byCategory) out.legend = false;
      return out;
    },
  });
})(window.VS);

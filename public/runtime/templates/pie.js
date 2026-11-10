(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'pie',
    order: 30,
    name: 'Круговая диаграмма',
    category: 'Доли',
    description: 'Доли целого: круговая, кольцевая, полукольцо или «роза».',
    icon: '<svg viewBox="0 0 48 36"><path d="M24 18 L24 3 A15 15 0 0 1 38.3 22.6 Z" fill="var(--c1)"/><path d="M24 18 L38.3 22.6 A15 15 0 0 1 12 27 Z" fill="var(--c2)"/><path d="M24 18 L12 27 A15 15 0 0 1 24 3 Z" fill="var(--c3)"/></svg>',
    variants: [
      { name: 'Круговая', settings: { 'pie.inner': 0 } },
      {
        name: 'Кольцевая', settings: { 'pie.inner': 55, 'pie.centerTotal': true },
        icon: '<svg viewBox="0 0 48 36"><circle cx="24" cy="18" r="11.5" fill="none" stroke="var(--c3)" stroke-width="6"/><path d="M24 6.5 A11.5 11.5 0 0 1 34.9 21.6" fill="none" stroke="var(--c1)" stroke-width="6"/><path d="M34.9 21.6 A11.5 11.5 0 0 1 14.8 24.9" fill="none" stroke="var(--c2)" stroke-width="6"/></svg>',
      },
      {
        name: 'Полукольцо', settings: { 'pie.inner': 55, 'pie.half': true, 'pie.centerTotal': true },
        icon: '<svg viewBox="0 0 48 36"><path d="M8 28 A16 16 0 0 1 20 12.5" fill="none" stroke="var(--c1)" stroke-width="7"/><path d="M20 12.5 A16 16 0 0 1 36 15" fill="none" stroke="var(--c2)" stroke-width="7"/><path d="M36 15 A16 16 0 0 1 40 28" fill="none" stroke="var(--c3)" stroke-width="7"/></svg>',
      },
      {
        name: 'Роза Найтингейла', settings: { 'pie.inner': 10, 'pie.rose': true },
        icon: '<svg viewBox="0 0 48 36"><path d="M24 18 L24 2 A16 16 0 0 1 40 18 Z" fill="var(--c1)"/><path d="M24 18 L34 18 A10 10 0 0 1 24 28 Z" fill="var(--c2)"/><path d="M24 18 L24 31 A13 13 0 0 1 11 18 Z" fill="var(--c3)"/><path d="M24 18 L17 18 A7 7 0 0 1 24 11 Z" fill="var(--c4)"/></svg>',
      },
    ],
    defaults: { 'legend.show': false },
    bindings: [
      { key: 'label', name: 'Категории', dataType: 'any' },
      { key: 'value', name: 'Значение', dataType: 'number' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    sections: [
      {
        id: 'pie',
        title: 'Сектора',
        items: [
          { key: 'pie.inner', label: 'Внутренний радиус, %', type: 'range', min: 0, max: 85, default: 0 },
          { key: 'pie.half', label: 'Полукруг', type: 'toggle', default: false },
          { key: 'pie.rose', label: 'Роза (радиус по значению)', type: 'toggle', default: false },
          { key: 'pie.sort', label: 'Сортировка', type: 'select', options: [['desc', 'По убыванию'], ['none', 'Как в данных'], ['asc', 'По возрастанию']], default: 'desc' },
          { key: 'pie.other', label: 'Объединять в «Прочее» доли меньше, %', type: 'range', min: 0, max: 15, step: 0.5, default: 0 },
          { key: 'pie.otherLabel', label: 'Подпись «Прочее»', type: 'text', default: 'Прочее', show: function (s) { return Number(s['pie.other']) > 0; } },
          { key: 'pie.gap', label: 'Зазор между секторами', type: 'range', min: 0, max: 6, step: 0.5, default: 1 },
          { key: 'pie.radius', label: 'Радиус, % от области', type: 'range', min: 40, max: 100, default: 82 },
          { key: 'pie.startAngle', label: 'Начальный угол', type: 'range', min: 0, max: 360, default: 90, show: function (s) { return !s['pie.half']; } },
          { key: 'pie.centerTotal', label: 'Итог в центре', type: 'toggle', default: false, show: function (s) { return Number(s['pie.inner']) >= 35; } },
          { key: 'pie.centerLabel', label: 'Подпись итога', type: 'text', default: 'Всего', show: function (s) { return s['pie.centerTotal'] && Number(s['pie.inner']) >= 35; } },
          { type: 'heading', label: 'Подписи секторов' },
          { key: 'labels.mode', label: 'Подписи', type: 'radio', options: [['outside', 'Снаружи'], ['inside', 'Внутри'], ['none', 'Нет']], default: 'outside' },
          { key: 'labels.name', label: 'Название', type: 'toggle', default: true, show: function (s) { return s['labels.mode'] !== 'none'; } },
          { key: 'labels.value', label: 'Значение', type: 'toggle', default: false, show: function (s) { return s['labels.mode'] !== 'none'; } },
          { key: 'labels.percent', label: 'Процент', type: 'toggle', default: true, show: function (s) { return s['labels.mode'] !== 'none'; } },
        ],
      },
    ],
    sample: {
      data: [
        ['Канал', 'Продажи'],
        ['Интернет-магазин', '4 820'], ['Розничные магазины', '3 150'], ['Маркетплейсы', '2 640'],
        ['Оптовые партнёры', '1 380'], ['Корпоративные клиенты', '910'], ['Прочие', '300'],
      ],
      bindings: { label: 0, value: 1 },
      settings: { title: 'Структура продаж по каналам', subtitle: 'млн ₽, 2025 год', footer: 'Источник: демонстрационные данные' },
    },
    legendNames: function (ctx) {
      var items = prepareItems(ctx);
      return items ? items.map(function (d) { return d.name; }) : null;
    },
    build: function (ctx) {
      var s = ctx.s;
      var items = prepareItems(ctx);
      if (!items) return VS.empty(ctx, 'Привяжите колонки «Категории» и «Значение»');
      var total = items.reduce(function (a, d) { return a + d.value; }, 0);
      var a = ctx.area;
      var half = !!s['pie.half'];
      var labelsMode = s['labels.mode'];
      var outside = labelsMode === 'outside';
      var size = Math.min(a.width * (outside ? 0.62 : 0.95), (half ? a.height * 2 * 0.92 : a.height));
      var R = (size / 2) * ((Number(s['pie.radius']) || 82) / 100);
      var inner = (R * (Number(s['pie.inner']) || 0)) / 100;
      var cy = half ? a.top + a.height * 0.5 + R * 0.5 : a.cy;

      var parts = function (p) {
        var out = [];
        if (s['labels.name']) out.push(outside ? '{n|' + p.name + '}' : p.name);
        var vv = [];
        if (s['labels.value']) vv.push(ctx.fmt(p.value));
        if (s['labels.percent']) vv.push(ctx.fmt(p.percent, { noAffix: true, noCompact: true, decimals: p.percent < 10 ? 1 : 0 }) + '%');
        if (vv.length) out.push(outside ? '{v|' + vv.join(' · ') + '}' : vv.join(' · '));
        return out.join('\n');
      };

      var serie = {
        type: 'pie',
        name: (ctx.column('value') || {}).name,
        center: [a.cx, cy],
        radius: [inner, R],
        roseType: s['pie.rose'] ? 'radius' : false,
        startAngle: half ? 180 : Number(s['pie.startAngle']) || 90,
        endAngle: half ? 360 : 'auto',
        padAngle: Number(s['pie.gap']) || 0,
        avoidLabelOverlap: true,
        minShowLabelAngle: 3,
        data: items.map(function (d, i) {
          return {
            name: d.name,
            value: d.value,
            rowIndex: d.rowIndex,
            itemStyle: { color: d.other ? ctx.theme.faint : ctx.color(d.name, i), borderRadius: inner > 0 ? 3 : 0 },
          };
        }),
        itemStyle: { borderColor: ctx.theme.background, borderWidth: Number(s['pie.gap']) ? 0 : 1 },
        label: labelsMode === 'none'
          ? { show: false }
          : VS.labelStyle(ctx, {
              show: true,
              position: outside ? 'outside' : 'inside',
              formatter: parts,
              color: outside ? ctx.theme.text : '#fff',
              fontSize: ctx.fontSize,
              lineHeight: ctx.fontSize + 4,
              rich: { n: { color: ctx.theme.muted, fontSize: ctx.fontSize, lineHeight: ctx.fontSize + 4 }, v: { color: ctx.theme.text, fontWeight: 'bold', fontSize: ctx.fontSize + 1 } },
            }),
        labelLine: { show: outside, length: 10, length2: 14, lineStyle: { color: ctx.theme.axis } },
        labelLayout: outside ? { hideOverlap: true } : undefined,
        emphasis: { scale: true, scaleSize: 6 },
      };

      var out = { series: [serie], tooltip: { trigger: 'item', formatter: tooltipFormatter(ctx) } };
      if (s['pie.centerTotal'] && inner > 35) {
        var vs = Math.max(14, Math.min(inner * 0.42, 40));
        out.graphic = [{
          type: 'group',
          left: a.cx - 0,
          top: cy - (half ? vs * 1.6 : vs * 0.95),
          bounding: 'raw',
          children: [
            { type: 'text', style: { text: ctx.fmt(total), x: 0, y: 0, align: 'center', fill: ctx.theme.text, font: 'bold ' + Math.round(vs) + 'px ' + ctx.font } },
            { type: 'text', style: { text: s['pie.centerLabel'] || '', x: 0, y: vs * 1.2, align: 'center', fill: ctx.theme.muted, font: Math.round(Math.max(11, vs * 0.4)) + 'px ' + ctx.font } },
          ],
        }];
      }
      return out;
    },
  });

  function tooltipFormatter(ctx) {
    return function (p) {
      return VS.tooltipHtml(ctx, p.name, [
        { name: p.seriesName || 'Значение', value: ctx.fmt(p.value), color: p.color },
        { name: 'Доля', value: ctx.fmt(p.percent, { noAffix: true, noCompact: true, decimals: 1 }) + '%' },
      ]);
    };
  }

  // Категории с суммированием дубликатов, сортировкой и группой «Прочее»
  function prepareItems(ctx) {
    var s = ctx.s;
    var label = ctx.column('label');
    var val = ctx.column('value');
    if (!label || !val) return null;
    var map = new Map();
    label.raw.forEach(function (name, i) {
      var v = val.num[i];
      if (v === null || v <= 0) return;
      if (map.has(name)) map.get(name).value += v;
      else map.set(name, { name: name, value: v, rowIndex: i });
    });
    var items = Array.from(map.values());
    if (s['pie.sort'] === 'desc') items.sort(function (a, b) { return b.value - a.value; });
    else if (s['pie.sort'] === 'asc') items.sort(function (a, b) { return a.value - b.value; });
    var thr = Number(s['pie.other']) || 0;
    if (thr > 0) {
      var total = items.reduce(function (a, d) { return a + d.value; }, 0);
      var keep = [], rest = 0, restCount = 0;
      items.forEach(function (d) {
        if ((d.value / total) * 100 < thr) {
          rest += d.value;
          restCount++;
        } else keep.push(d);
      });
      if (restCount > 1) {
        keep.push({ name: s['pie.otherLabel'] || 'Прочее', value: rest, other: true });
        items = keep;
      }
    }
    return items.length ? items : null;
  }
})(window.VS);

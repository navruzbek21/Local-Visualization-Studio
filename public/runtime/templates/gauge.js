(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'gauge',
    order: 90,
    name: 'Спидометр / KPI',
    category: 'Показатели',
    description: 'Ключевой показатель относительно цели: один или несколько индикаторов.',
    icon: '<svg viewBox="0 0 48 36"><path d="M8 30 A16 16 0 0 1 40 30" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="6"/><path d="M8 30 A16 16 0 0 1 33 17" fill="none" stroke="var(--c1)" stroke-width="6"/><circle cx="24" cy="30" r="2.5" fill="currentColor"/></svg>',
    variants: [
      { name: 'Спидометр', settings: { 'gauge.style': 'arc' } },
      {
        name: 'Кольцевой индикатор', settings: { 'gauge.style': 'ring' },
        icon: '<svg viewBox="0 0 48 36"><circle cx="24" cy="18" r="12" fill="none" stroke="currentColor" stroke-opacity=".18" stroke-width="5"/><path d="M24 6 A12 12 0 1 1 12.6 21.7" fill="none" stroke="var(--c1)" stroke-width="5" stroke-linecap="round"/></svg>',
      },
      {
        name: 'Стрелочный прибор', settings: { 'gauge.style': 'needle' },
        icon: '<svg viewBox="0 0 48 36"><path d="M8 30 A16 16 0 0 1 40 30" fill="none" stroke="var(--c3)" stroke-width="4"/><path d="M8 30 A16 16 0 0 1 16 16" fill="none" stroke="var(--c8)" stroke-width="4"/><line x1="24" y1="30" x2="33" y2="18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="30" r="3" fill="currentColor"/></svg>',
      },
    ],
    bindings: [
      { key: 'label', name: 'Название показателя', dataType: 'text', optional: true },
      { key: 'value', name: 'Значение', dataType: 'number' },
      { key: 'target', name: 'Цель / максимум', dataType: 'number', optional: true, description: 'Если задана, шкала строится до цели' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    autoBind: function (cols) {
      var num = cols.filter(function (c) { return c.type === 'number'; });
      var txt = cols.find(function (c) { return c.type !== 'number'; });
      return { label: txt ? txt.index : undefined, value: num[0] && num[0].index, target: num[1] ? num[1].index : undefined };
    },
    common: ['layout', 'colors', 'number', 'animation', 'appearance', 'tooltip'],
    sections: [
      {
        id: 'gauge',
        title: 'Индикатор',
        items: [
          { key: 'gauge.style', label: 'Вид', type: 'radio', options: [['arc', 'Дуга'], ['ring', 'Кольцо'], ['needle', 'Стрелка']], default: 'arc' },
          { key: 'gauge.min', label: 'Минимум', type: 'text', default: '0' },
          { key: 'gauge.max', label: 'Максимум', type: 'text', default: '', placeholder: 'из колонки «Цель» или 100' },
          { key: 'gauge.maxCount', label: 'Индикаторов не больше', type: 'range', min: 1, max: 12, default: 6, help: 'Каждая строка данных — отдельный индикатор' },
          { key: 'gauge.bands', label: 'Цветовые зоны', type: 'text', default: '', placeholder: '60:#e34948, 85:#eda100, 100:#1baf7a', help: '«% шкалы: цвет» через запятую. Цвет прогресса берётся из зоны' },
          { key: 'gauge.percent', label: 'Показывать как % от максимума', type: 'toggle', default: false },
          { key: 'gauge.width', label: 'Толщина дуги', type: 'range', min: 4, max: 60, default: 18 },
          { key: 'gauge.ticks', label: 'Деления шкалы', type: 'toggle', default: false },
        ],
      },
    ],
    sample: {
      data: [
        ['Показатель', 'Факт', 'План'],
        ['Выручка, млн ₽', '842', '1000'],
        ['Новые клиенты', '1 260', '1 500'],
        ['NPS', '61', '70'],
      ],
      bindings: { label: 0, value: 1, target: 2 },
      settings: { title: 'Выполнение плана за 3 квартал', footer: 'Источник: демонстрационные данные', 'gauge.bands': '60:#e34948, 85:#eda100, 100:#1baf7a' },
    },
    legend: false,
    build: function (ctx) {
      var s = ctx.s;
      var val = ctx.column('value');
      if (!val) return VS.empty(ctx, 'Привяжите колонку «Значение»');
      var label = ctx.column('label');
      var target = ctx.column('target');
      var maxCount = Number(s['gauge.maxCount']) || 6;
      var items = [];
      val.num.forEach(function (v, i) {
        if (v === null || items.length >= maxCount) return;
        items.push({ name: label ? label.raw[i] : '', value: v, target: target ? target.num[i] : null, rowIndex: i });
      });
      if (!items.length) return VS.empty(ctx);
      var bands = String(s['gauge.bands'] || '').split(',').map(function (p) {
        var m = p.split(':');
        var t = VS.parseNumber(m[0]);
        return t !== null && m[1] ? [t / 100, m[1].trim()] : null;
      }).filter(Boolean).sort(function (a, b) { return a[0] - b[0]; });
      if (bands.length && bands[bands.length - 1][0] < 1) bands.push([1, bands[bands.length - 1][1]]);

      var a = ctx.area;
      var n = items.length;
      var cols = n <= 3 ? n : n === 4 ? 2 : 3;
      if (a.width < 520 && n > 1) cols = n <= 2 ? 1 : 2;
      var rows = Math.ceil(n / cols);
      var cw = a.width / cols;
      var ch = a.height / rows;
      var style = s['gauge.style'];
      var ring = style === 'ring';
      var width = Number(s['gauge.width']) || 18;
      var mn = VS.parseNumber(s['gauge.min']) || 0;
      var userMax = VS.parseNumber(s['gauge.max']);

      var series = items.map(function (d, i) {
        var mx = userMax !== null ? userMax : d.target !== null ? d.target : 100;
        if (mx <= mn) mx = mn + 1;
        var ratio = (d.value - mn) / (mx - mn);
        var color = ctx.color(d.name, 0);
        if (bands.length) {
          for (var b = 0; b < bands.length; b++) if (ratio <= bands[b][0] + 1e-9) { color = bands[b][1]; break; }
          if (ratio > 1) color = bands[bands.length - 1][1];
        }
        var col = i % cols, row = Math.floor(i / cols);
        var cx = a.left + cw * col + cw / 2;
        var titleH = d.name ? ctx.fontSize + 16 : 0;
        var R = Math.max(20, Math.min(cw * 0.42, ring ? (ch - titleH) * 0.46 : (ch - titleH) * (style === 'needle' ? 0.5 : 0.62)));
        var cy = a.top + ch * row + (ring ? (ch - titleH) / 2 : (ch - titleH) * 0.62 + 8);
        var pct = ((d.value - mn) / (mx - mn)) * 100;
        var showPct = s['gauge.percent'];
        var axisColor = style === 'needle' && bands.length
          ? bands.map(function (b) { return [Math.min(1, b[0]), b[1]]; })
          : [[1, ctx.theme.grid]];
        var big = Math.max(14, Math.min(R * (ring ? 0.42 : 0.36), 52));
        return {
          type: 'gauge',
          name: d.name,
          center: [cx, cy],
          radius: R,
          startAngle: ring ? 90 : 200,
          endAngle: ring ? -270 : -20,
          min: mn,
          max: mx,
          splitNumber: 5,
          progress: { show: style !== 'needle', width: width, roundCap: ring, itemStyle: { color: color } },
          pointer: { show: style === 'needle', length: '68%', width: Math.max(3, width / 4), itemStyle: { color: ctx.theme.text } },
          anchor: { show: style === 'needle', size: Math.max(8, width / 1.6), itemStyle: { color: ctx.theme.text } },
          axisLine: { roundCap: ring, lineStyle: { width: width, color: axisColor } },
          axisTick: { show: !!s['gauge.ticks'], distance: -width - 6, length: 5, lineStyle: { color: ctx.theme.axis } },
          splitLine: { show: !!s['gauge.ticks'], distance: -width - 8, length: 9, lineStyle: { color: ctx.theme.axis, width: 1.5 } },
          axisLabel: { show: !!s['gauge.ticks'] && !ring, distance: width + 12, color: ctx.theme.muted, fontSize: ctx.fontSize - 1, fontFamily: ctx.font, formatter: function (v) { return ctx.fmt(v, { decimals: 0 }); } },
          title: { show: !!d.name, offsetCenter: [0, ring ? R + titleH * 0.7 : style === 'needle' ? R * 0.62 + big + titleH * 0.4 : R * 0.35 + titleH * 0.55], color: ctx.theme.text, fontSize: ctx.fontSize + 1, fontFamily: ctx.font, overflow: 'truncate', width: cw * 0.9 },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, ring ? 0 : style === 'needle' ? R * 0.62 : -R * 0.08],
            color: ctx.theme.text,
            fontFamily: ctx.font,
            fontSize: big,
            fontWeight: 'bold',
            lineHeight: big * 1.2,
            formatter: function (v) {
              var main = showPct ? ctx.fmt(pct, { noAffix: true, noCompact: true, decimals: 0 }) + '%' : ctx.fmt(v);
              if (d.target === null || showPct) return main;
              return main + '\n{t|из ' + ctx.fmt(mx) + '}';
            },
            rich: { t: { fontSize: Math.max(11, big * 0.32), color: ctx.theme.muted, fontFamily: ctx.font, fontWeight: 'normal', padding: [4, 0, 0, 0] } },
          },
          data: [{ value: d.value, name: d.name, rowIndex: d.rowIndex }],
        };
      });
      return {
        series: series,
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            var d = items[p.seriesIndex];
            var rows = [{ name: val.name, value: ctx.fmt(d.value) }];
            if (d.target !== null) {
              rows.push({ name: (target || {}).name || 'Цель', value: ctx.fmt(d.target) });
              rows.push({ name: 'Выполнение', value: ctx.fmt((d.value / d.target) * 100, { noAffix: true, noCompact: true, decimals: 1 }) + '%' });
            }
            return VS.tooltipHtml(ctx, d.name, rows);
          },
        },
      };
    },
  });
})(window.VS);

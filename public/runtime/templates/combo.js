(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'combo',
    order: 25,
    name: 'Столбцы и линии',
    category: 'Динамика',
    description: 'Факт столбцами, план или тренд линией. Вторая ось — по желанию.',
    icon: '<svg viewBox="0 0 48 36"><rect x="5" y="18" width="7" height="14" rx="1.5" fill="var(--c1)"/><rect x="16" y="13" width="7" height="19" rx="1.5" fill="var(--c1)"/><rect x="27" y="16" width="7" height="16" rx="1.5" fill="var(--c1)"/><rect x="38" y="8" width="7" height="24" rx="1.5" fill="var(--c1)"/><polyline points="8,12 19,8 30,10 41,4" fill="none" stroke="var(--c2)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bindings: [
      { key: 'label', name: 'Ось X', dataType: 'any' },
      { key: 'bars', name: 'Столбцы', dataType: 'number', multiple: true },
      { key: 'lines', name: 'Линии', dataType: 'number', multiple: true },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    autoBind: function (cols) {
      var num = cols.filter(function (c) { return c.type === 'number'; });
      var lab = cols.find(function (c) { return c.type !== 'number'; }) || cols[0];
      var rest = num.filter(function (c) { return c !== lab; });
      return {
        label: lab ? lab.index : undefined,
        bars: rest.slice(0, Math.max(1, rest.length - 1)).map(function (c) { return c.index; }),
        lines: rest.length > 1 ? [rest[rest.length - 1].index] : [],
      };
    },
    sections: [
      {
        id: 'combo',
        title: 'Столбцы и линии',
        items: [
          { key: 'combo.stack', label: 'Столбцы с накоплением', type: 'toggle', default: false },
          { key: 'combo.dualAxis', label: 'Линии на второй оси', type: 'toggle', default: false, help: 'Две шкалы легко ввести в заблуждение — используйте, только если единицы измерения разные' },
          { key: 'combo.lineSmooth', label: 'Плавные линии', type: 'toggle', default: false },
          { key: 'combo.lineDashed', label: 'Пунктирные линии', type: 'toggle', default: false },
          { key: 'line.width', label: 'Толщина линии', type: 'range', min: 1, max: 8, step: 0.5, default: 2.5 },
          { key: 'bar.radius', label: 'Скругление столбцов', type: 'range', min: 0, max: 12, default: 3 },
          { key: 'labels.show', label: 'Подписи значений', type: 'toggle', default: false },
          { key: 'y2.title', label: 'Название второй оси', type: 'text', default: '', show: function (s) { return s['combo.dualAxis']; } },
          { key: 'y2.suffix', label: 'Суффикс второй оси', type: 'text', default: '', placeholder: '%', show: function (s) { return s['combo.dualAxis']; } },
        ],
      },
      VS.axisSection(),
    ],
    sample: {
      data: [
        ['Квартал', 'Факт', 'План'],
        ['I кв. 2024', '412', '400'], ['II кв. 2024', '455', '430'], ['III кв. 2024', '438', '460'],
        ['IV кв. 2024', '520', '490'], ['I кв. 2025', '486', '470'], ['II кв. 2025', '541', '505'],
      ],
      bindings: { label: 0, bars: [1], lines: [2] },
      settings: { title: 'Продажи: факт и план', subtitle: 'тыс. единиц', footer: 'Источник: демонстрационные данные' },
    },
    legendNames: function (ctx) {
      var names = ctx.columnsOf('bars').concat(ctx.columnsOf('lines')).map(function (c) { return c.name; });
      return names.length > 1 ? names : null;
    },
    tooltip: function () {
      return { trigger: 'axis', axisPointer: { type: 'shadow' } };
    },
    build: function (ctx) {
      var s = ctx.s;
      var label = ctx.column('label');
      var bars = ctx.columnsOf('bars');
      var lines = ctx.columnsOf('lines');
      if (!label || (!bars.length && !lines.length)) return VS.empty(ctx, 'Привяжите колонки «Ось X», «Столбцы» и «Линии»');
      var dual = s['combo.dualAxis'] && lines.length && bars.length;
      var r = Number(s['bar.radius']) || 0;
      var stack = !!s['combo.stack'];
      var idx = 0;
      var lbl = function (pos) {
        return s['labels.show'] ? VS.labelStyle(ctx, { show: true, position: pos, fontSize: ctx.fontSize - 1, formatter: function (p) { return ctx.fmt(p.value); } }) : undefined;
      };
      var series = [];
      bars.forEach(function (c) {
        var color = ctx.color(c.name, idx++);
        series.push({
          type: 'bar', name: c.name, stack: stack ? 'bars' : undefined, barMaxWidth: 70,
          data: c.num.map(function (v, i) { return { value: v === null ? '-' : v, rowIndex: i }; }),
          itemStyle: { color: color, borderRadius: stack ? 0 : [r, r, 0, 0], borderColor: stack ? ctx.theme.background : undefined, borderWidth: stack ? 1 : 0 },
          label: lbl(stack ? 'inside' : 'top'),
          emphasis: { focus: 'series' },
        });
      });
      lines.forEach(function (c) {
        var color = ctx.color(c.name, idx++);
        series.push({
          type: 'line', name: c.name, yAxisIndex: dual ? 1 : 0, z: 5,
          data: c.num.map(function (v, i) { return { value: v === null ? '-' : v, rowIndex: i }; }),
          smooth: s['combo.lineSmooth'] ? 0.35 : false,
          symbol: 'circle', symbolSize: 7, showSymbol: c.num.length <= 24,
          color: color,
          lineStyle: { color: color, width: Number(s['line.width']) || 2.5, type: s['combo.lineDashed'] ? 'dashed' : 'solid' },
          itemStyle: { color: color, borderColor: ctx.theme.background, borderWidth: 1.5 },
          label: lbl('top'),
          tooltip: dual && s['y2.suffix'] ? { valueFormatter: function (v) { return ctx.fmt(v, { noAffix: true }) + s['y2.suffix']; } } : undefined,
        });
      });
      var ref = VS.refLine(ctx, false);
      if (ref && series[0]) series[0].markLine = ref;

      var yAxis = [VS.axis(ctx, 'y', { type: 'value' })];
      if (dual) {
        var y2 = VS.axis(ctx, 'y', { type: 'value' });
        y2.position = s['yAxis.position'] === 'right' ? 'left' : 'right';
        y2.splitLine = { show: false };
        y2.min = undefined;
        y2.max = undefined;
        y2.name = s['y2.title'] || undefined;
        y2.axisLabel.formatter = function (v) { return ctx.fmt(v, { noAffix: true }) + (s['y2.suffix'] || ''); };
        y2.axisLabel.color = ctx.color(lines[0].name, bars.length);
        yAxis.push(y2);
      }
      return {
        series: series,
        xAxis: VS.axis(ctx, 'x', { type: 'category', data: label.raw }),
        yAxis: yAxis,
        grid: VS.grid(ctx),
      };
    },
  });
})(window.VS);

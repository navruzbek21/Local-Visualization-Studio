(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'waterfall',
    order: 28,
    name: 'Каскадная диаграмма',
    category: 'Сравнение',
    description: 'Как складывается итог: рост и снижение по шагам (план-факт, P&L, мосты).',
    icon: '<svg viewBox="0 0 48 36"><rect x="4" y="14" width="7" height="18" fill="var(--c1)"/><rect x="13" y="7" width="7" height="7" fill="var(--c3)"/><rect x="22" y="7" width="7" height="10" fill="var(--c8)"/><rect x="31" y="3" width="7" height="14" fill="var(--c3)"/><rect x="40" y="3" width="5" height="29" fill="var(--c1)"/></svg>',
    bindings: [
      { key: 'label', name: 'Шаги', dataType: 'text' },
      { key: 'value', name: 'Изменение', dataType: 'number', description: 'Положительные — рост, отрицательные — снижение' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    common: ['layout', 'tooltip', 'number', 'animation', 'appearance'],
    sections: [
      {
        id: 'waterfall',
        title: 'Каскад',
        items: [
          { key: 'wf.firstIsTotal', label: 'Первая строка — начальный итог', type: 'toggle', default: true },
          { key: 'wf.subtotals', label: 'Промежуточные итоги', type: 'text', default: '', placeholder: 'Названия шагов через запятую', help: 'Эти шаги показывают накопленную сумму, а не изменение' },
          { key: 'wf.total', label: 'Итоговый столбец', type: 'toggle', default: true },
          { key: 'wf.totalLabel', label: 'Подпись итога', type: 'text', default: 'Итого', show: function (s) { return s['wf.total']; } },
          { key: 'wf.up', label: 'Цвет роста', type: 'color', default: '#1baf7a' },
          { key: 'wf.down', label: 'Цвет снижения', type: 'color', default: '#e34948' },
          { key: 'wf.totalColor', label: 'Цвет итогов', type: 'color', default: '#2a78d6' },
          { key: 'wf.connectors', label: 'Соединительные линии', type: 'toggle', default: true },
          { key: 'labels.show', label: 'Подписи значений', type: 'toggle', default: true },
          { key: 'bar.radius', label: 'Скругление', type: 'range', min: 0, max: 8, default: 2 },
        ],
      },
      VS.axisSection(),
    ],
    sample: {
      data: [
        ['Статья', 'млн ₽'],
        ['Выручка 2024', '1 250'], ['Рост продаж', '210'], ['Новые продукты', '95'], ['Скидки', '-80'],
        ['Курсовые разницы', '-45'], ['Себестоимость', '-160'], ['Оптимизация затрат', '70'],
      ],
      bindings: { label: 0, value: 1 },
      settings: { title: 'Как менялась выручка', subtitle: 'Мост от 2024 к 2025 году, млн ₽', footer: 'Источник: демонстрационные данные', 'wf.totalLabel': 'Выручка 2025' },
    },
    legend: false,
    build: function (ctx) {
      var s = ctx.s;
      var label = ctx.column('label');
      var val = ctx.column('value');
      if (!label || !val) return VS.empty(ctx, 'Привяжите колонки «Шаги» и «Изменение»');
      var subs = String(s['wf.subtotals'] || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      var steps = [];
      var run = 0;
      label.raw.forEach(function (name, i) {
        var v = val.num[i];
        if (v === null) return;
        var isTotal = (i === 0 && s['wf.firstIsTotal']) || subs.indexOf(name) >= 0;
        if (isTotal) {
          if (i === 0 && s['wf.firstIsTotal']) run = v;
          steps.push({ name: name, kind: 'total', base: 0, size: run, value: run, rowIndex: i });
        } else {
          var from = run;
          run += v;
          steps.push({ name: name, kind: v >= 0 ? 'up' : 'down', base: Math.min(from, run), size: Math.abs(v), value: v, end: run, rowIndex: i });
        }
      });
      if (s['wf.total']) steps.push({ name: s['wf.totalLabel'] || 'Итого', kind: 'total', base: 0, size: run, value: run });
      if (!steps.length) return VS.empty(ctx);
      var colors = { up: s['wf.up'], down: s['wf.down'], total: s['wf.totalColor'] };
      var r = Number(s['bar.radius']) || 0;
      var names = steps.map(function (d) { return d.name; });
      var series = [
        {
          type: 'bar', name: 'База', stack: 'wf', silent: true, tooltip: { show: false },
          itemStyle: { color: 'transparent' }, emphasis: { disabled: true },
          data: steps.map(function (d) { return d.base; }),
        },
        {
          type: 'bar', name: val.name, stack: 'wf', barCategoryGap: '30%',
          data: steps.map(function (d) {
            return { value: d.size, rowIndex: d.rowIndex, itemStyle: { color: colors[d.kind], borderRadius: r } };
          }),
          label: VS.labelStyle(ctx, {
            show: !!s['labels.show'],
            position: 'top',
            fontSize: ctx.fontSize - 1,
            formatter: function (p) {
              var d = steps[p.dataIndex];
              return d.kind === 'total' ? ctx.fmt(d.value) : ctx.fmt(d.value, { plusSign: true });
            },
          }),
        },
      ];
      if (s['wf.connectors']) {
        // горизонтальные отрезки на уровне накопленной суммы между соседними столбцами
        var lines = [];
        steps.forEach(function (d, i) {
          if (i === steps.length - 1) return;
          var level = d.kind === 'total' ? d.value : d.end;
          lines.push([{ coord: [i, level] }, { coord: [i + 1, level] }]);
        });
        series[1].markLine = {
          silent: true, symbol: 'none', animation: false,
          lineStyle: { color: ctx.theme.axis, type: 'dashed', width: 1 },
          label: { show: false },
          data: lines,
        };
      }
      var yAxis = VS.axis(ctx, 'y', { type: 'value' });
      return {
        series: series,
        xAxis: VS.axis(ctx, 'x', { type: 'category', data: names }),
        yAxis: yAxis,
        grid: VS.grid(ctx),
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            var d = steps[p.dataIndex];
            if (!d) return '';
            var rows = d.kind === 'total'
              ? [{ name: 'Итог', value: ctx.fmt(d.value), color: colors.total }]
              : [{ name: 'Изменение', value: ctx.fmt(d.value, { plusSign: true }), color: colors[d.kind] }, { name: 'Накоплено', value: ctx.fmt(d.end) }];
            return VS.tooltipHtml(ctx, d.name, rows);
          },
        },
      };
    },
  });
})(window.VS);

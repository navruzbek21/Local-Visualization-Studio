(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'heatmap',
    order: 60,
    name: 'Тепловая карта',
    category: 'Распределение',
    description: 'Матрица значений с цветовой шкалой: строки × колонки таблицы.',
    icon: '<svg viewBox="0 0 48 36"><g><rect x="4" y="4" width="9" height="8" fill="var(--c1)" opacity=".25"/><rect x="14" y="4" width="9" height="8" fill="var(--c1)" opacity=".6"/><rect x="24" y="4" width="9" height="8" fill="var(--c1)"/><rect x="34" y="4" width="9" height="8" fill="var(--c1)" opacity=".4"/><rect x="4" y="13" width="9" height="8" fill="var(--c1)" opacity=".7"/><rect x="14" y="13" width="9" height="8" fill="var(--c1)" opacity=".3"/><rect x="24" y="13" width="9" height="8" fill="var(--c1)" opacity=".5"/><rect x="34" y="13" width="9" height="8" fill="var(--c1)" opacity=".9"/><rect x="4" y="22" width="9" height="8" fill="var(--c1)" opacity=".45"/><rect x="14" y="22" width="9" height="8" fill="var(--c1)" opacity=".85"/><rect x="24" y="22" width="9" height="8" fill="var(--c1)" opacity=".2"/><rect x="34" y="22" width="9" height="8" fill="var(--c1)" opacity=".6"/></g></svg>',
    bindings: [
      { key: 'label', name: 'Строки', dataType: 'any', description: 'Подписи строк матрицы' },
      { key: 'values', name: 'Колонки матрицы', dataType: 'number', multiple: true, description: 'Каждая колонка — столбец матрицы' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    common: ['layout', 'tooltip', 'number', 'animation', 'appearance'],
    sections: [
      {
        id: 'heat',
        title: 'Ячейки и шкала',
        items: [
          { key: 'heat.scale', label: 'Цветовая шкала', type: 'scale', default: 'blues' },
          { key: 'heat.mode', label: 'Шкала', type: 'radio', options: [['continuous', 'Плавная'], ['pieces', 'Ступени']], default: 'continuous' },
          { key: 'heat.pieces', label: 'Число ступеней', type: 'range', min: 3, max: 9, default: 5, show: function (s) { return s['heat.mode'] === 'pieces'; } },
          { key: 'heat.min', label: 'Минимум шкалы', type: 'text', default: '', placeholder: 'авто' },
          { key: 'heat.max', label: 'Максимум шкалы', type: 'text', default: '', placeholder: 'авто' },
          { key: 'heat.labels', label: 'Значения в ячейках', type: 'toggle', default: true },
          { key: 'heat.gap', label: 'Зазор между ячейками', type: 'range', min: 0, max: 6, default: 2 },
          { key: 'heat.legend', label: 'Показывать шкалу', type: 'toggle', default: true },
          { key: 'heat.xTop', label: 'Подписи колонок сверху', type: 'toggle', default: true },
          { key: 'xAxis.rotate', label: 'Поворот подписей колонок', type: 'select', options: [['auto', 'Авто'], ['0', '0°'], ['30', '30°'], ['45', '45°'], ['90', '90°']], default: 'auto' },
        ],
      },
    ],
    sample: {
      data: [
        ['День', '00–03', '03–06', '06–09', '09–12', '12–15', '15–18', '18–21', '21–24'],
        ['Понедельник', '12', '6', '48', '130', '142', '160', '118', '54'],
        ['Вторник', '10', '5', '52', '138', '150', '171', '122', '50'],
        ['Среда', '11', '7', '55', '141', '148', '168', '126', '58'],
        ['Четверг', '13', '6', '50', '136', '155', '175', '134', '61'],
        ['Пятница', '15', '8', '47', '128', '160', '190', '170', '96'],
        ['Суббота', '34', '18', '22', '74', '120', '142', '150', '118'],
        ['Воскресенье', '40', '20', '18', '60', '104', '126', '118', '70'],
      ],
      bindings: { label: 0, values: [1, 2, 3, 4, 5, 6, 7, 8] },
      settings: { title: 'Нагрузка на колл-центр', subtitle: 'Среднее число обращений по дням недели и времени суток', footer: 'Источник: демонстрационные данные' },
    },
    legend: false,
    build: function (ctx) {
      var s = ctx.s;
      var label = ctx.column('label');
      var vals = ctx.columnsOf('values');
      if (!label || !vals.length) return VS.empty(ctx, 'Привяжите колонку строк и числовые колонки матрицы');
      var rowsNames = label.raw;
      var colNames = vals.map(function (c) { return c.name; });
      var data = [];
      var all = [];
      vals.forEach(function (c, ci) {
        c.num.forEach(function (v, ri) {
          if (v === null) return;
          data.push({ value: [ci, ri, v], rowIndex: ri });
          all.push(v);
        });
      });
      var st = VS.stats(all);
      var mn = VS.parseNumber(s['heat.min']);
      var mx = VS.parseNumber(s['heat.max']);
      if (mn === null) mn = st.min;
      if (mx === null) mx = st.max;
      if (mx === mn) mx = mn + 1;
      var colors = ctx.seqScale(s['heat.scale']);
      var showLegend = s['heat.legend'];
      var legendH = showLegend ? 46 : 0;

      var visualMap = {
        min: mn,
        max: mx,
        calculable: true,
        show: !!showLegend,
        orient: 'horizontal',
        left: ctx.area.left,
        bottom: ctx.area.bottom,
        itemWidth: 12,
        itemHeight: Math.min(260, ctx.area.width * 0.5),
        inRange: { color: colors },
        textStyle: { color: ctx.theme.muted, fontSize: ctx.fontSize - 1, fontFamily: ctx.font },
        formatter: function (v) { return ctx.fmt(v); },
      };
      if (s['heat.mode'] === 'pieces') {
        visualMap.type = 'piecewise';
        visualMap.splitNumber = Number(s['heat.pieces']) || 5;
        visualMap.itemWidth = 16;
        visualMap.itemHeight = 12;
        visualMap.itemGap = 6;
        visualMap.formatter = function (a, b) { return ctx.fmt(a) + ' – ' + ctx.fmt(b); };
      } else {
        visualMap.type = 'continuous';
        visualMap.formatter = function (v) { return ctx.fmt(v); };
      }

      var xAxis = VS.axis(ctx, 'x', { type: 'category', data: colNames });
      xAxis.position = s['heat.xTop'] ? 'top' : 'bottom';
      xAxis.axisLine.show = false;
      xAxis.splitArea = { show: false };
      var yAxis = VS.axis(ctx, 'y', { type: 'category', data: rowsNames, inverse: true });
      yAxis.axisLine = { show: false };
      yAxis.splitLine = { show: false };
      yAxis.axisLabel.formatter = undefined;
      yAxis.axisLabel.hideOverlap = true;
      yAxis.min = undefined;
      yAxis.max = undefined;

      var gap = Number(s['heat.gap']);
      var cellH = (ctx.area.height - legendH) / Math.max(1, rowsNames.length);
      var cellW = ctx.area.width / Math.max(1, colNames.length);
      var showLabels = s['heat.labels'] && cellH > 14 && cellW > 26;
      // на тёмных ячейках подпись белая
      var darkEnd = VS.color.luminance(colors[colors.length - 1]) < 0.3;
      if (darkEnd) {
        data.forEach(function (d) {
          if ((d.value[2] - mn) / (mx - mn) > 0.55) d.label = { color: '#ffffff' };
        });
      }

      return {
        visualMap: visualMap,
        xAxis: xAxis,
        yAxis: yAxis,
        grid: VS.grid(ctx, { bottom: legendH }),
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            return VS.tooltipHtml(ctx, rowsNames[p.value[1]], [{ name: colNames[p.value[0]], value: ctx.fmt(p.value[2]), color: p.color }]);
          },
        },
        series: [{
          type: 'heatmap',
          data: data,
          itemStyle: { borderColor: ctx.theme.background, borderWidth: gap, borderRadius: gap > 1 ? 3 : 0 },
          label: {
            show: !!showLabels,
            fontFamily: ctx.font,
            fontSize: Math.max(9, Math.min(ctx.fontSize, cellH * 0.45)),
            color: ctx.theme.text,
            formatter: function (p) { return ctx.fmt(p.value[2]); },
          },
          emphasis: { itemStyle: { borderColor: ctx.theme.text, borderWidth: 1.5 } },
        }],
      };
    },
  });
})(window.VS);

(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'radar',
    order: 80,
    name: 'Радарная диаграмма',
    category: 'Сравнение',
    description: 'Профиль объектов по нескольким критериям сразу.',
    icon: '<svg viewBox="0 0 48 36"><polygon points="24,3 39,13 34,31 14,31 9,13" fill="none" stroke="currentColor" stroke-opacity=".3"/><polygon points="24,8 34,14 30,26 17,27 14,15" fill="var(--c1)" fill-opacity=".35" stroke="var(--c1)" stroke-width="1.6"/><polygon points="24,12 37,13 27,24 19,24 12,13" fill="var(--c2)" fill-opacity=".25" stroke="var(--c2)" stroke-width="1.6"/></svg>',
    bindings: [
      { key: 'label', name: 'Критерии (оси)', dataType: 'text' },
      { key: 'values', name: 'Объекты', dataType: 'number', multiple: true, description: 'Каждая колонка — отдельный многоугольник' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    sections: [
      {
        id: 'radar',
        title: 'Радар',
        items: [
          { key: 'radar.shape', label: 'Форма сетки', type: 'radio', options: [['polygon', 'Многоугольник'], ['circle', 'Круг']], default: 'polygon' },
          { key: 'radar.max', label: 'Максимум шкалы', type: 'text', default: '', placeholder: 'авто (общий)' },
          { key: 'radar.fill', label: 'Заливка', type: 'range', min: 0, max: 0.8, step: 0.05, default: 0.2 },
          { key: 'radar.width', label: 'Толщина линий', type: 'range', min: 1, max: 5, step: 0.5, default: 2 },
          { key: 'radar.symbols', label: 'Маркеры', type: 'toggle', default: true },
          { key: 'radar.split', label: 'Колец сетки', type: 'range', min: 2, max: 10, default: 5 },
          { key: 'labels.show', label: 'Значения у точек', type: 'toggle', default: false },
        ],
      },
    ],
    sample: {
      data: [
        ['Критерий', 'Модель A', 'Модель B', 'Модель C'],
        ['Цена', '8', '6', '9'], ['Надёжность', '7', '9', '6'], ['Скорость', '9', '7', '5'],
        ['Удобство', '6', '8', '7'], ['Поддержка', '5', '9', '8'], ['Безопасность', '8', '8', '6'],
      ],
      bindings: { label: 0, values: [1, 2, 3] },
      settings: { title: 'Сравнение решений', subtitle: 'Экспертные оценки по шкале от 1 до 10', footer: 'Источник: демонстрационные данные', 'radar.max': '10' },
    },
    legendNames: function (ctx) {
      var v = ctx.columnsOf('values');
      return v.length > 1 ? v.map(function (c) { return c.name; }) : null;
    },
    build: function (ctx) {
      var s = ctx.s;
      var label = ctx.column('label');
      var vals = ctx.columnsOf('values');
      if (!label || !vals.length) return VS.empty(ctx, 'Привяжите колонки «Критерии» и «Объекты»');
      var userMax = VS.parseNumber(s['radar.max']);
      var allMax = 0;
      vals.forEach(function (c) { allMax = Math.max(allMax, VS.stats(c.num).max); });
      var max = userMax !== null ? userMax : niceMax(allMax);
      var a = ctx.area;
      var R = Math.min(a.width * 0.36, a.height / 2 - 18);
      return {
        radar: {
          center: [a.cx, a.cy],
          radius: Math.max(20, R),
          shape: s['radar.shape'],
          splitNumber: Number(s['radar.split']) || 5,
          indicator: label.raw.map(function (n) { return { name: n, max: max }; }),
          axisName: { color: ctx.theme.text, fontFamily: ctx.font, fontSize: ctx.fontSize },
          axisLine: { lineStyle: { color: ctx.theme.grid } },
          splitLine: { lineStyle: { color: ctx.theme.grid } },
          splitArea: { show: false },
        },
        tooltip: { trigger: 'item' },
        series: [{
          type: 'radar',
          symbol: s['radar.symbols'] ? 'circle' : 'none',
          symbolSize: 6,
          emphasis: { focus: 'series', areaStyle: { opacity: Math.min(0.9, (Number(s['radar.fill']) || 0.2) + 0.25) } },
          data: vals.map(function (c, i) {
            var color = ctx.color(c.name, i);
            return {
              name: c.name,
              value: c.num.map(function (v) { return v === null ? 0 : v; }),
              itemStyle: { color: color },
              lineStyle: { color: color, width: Number(s['radar.width']) || 2 },
              areaStyle: { color: color, opacity: Number(s['radar.fill']) || 0 },
              label: VS.labelStyle(ctx, { show: !!s['labels.show'], fontSize: ctx.fontSize - 1, formatter: function (p) { return ctx.fmt(p.value); } }),
            };
          }),
        }],
      };
    },
  });

  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var m = v / p;
    var n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return n * p;
  }
})(window.VS);

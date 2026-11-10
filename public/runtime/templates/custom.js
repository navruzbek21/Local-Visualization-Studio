(function (VS) {
  'use strict';

  var EXAMPLE = [
    '// Доступно: data (массив объектов по строкам), columns (имена колонок),',
    '// palette, fmt(число), area {top,left,right,bottom,width,height}, theme, echarts.',
    '// Верните объект option для ECharts (https://echarts.apache.org/ — документация есть и офлайн в пакете).',
    'const cats = data.map(r => r[columns[0]]);',
    'return {',
    '  tooltip: { trigger: "axis" },',
    '  grid: { left: area.left, right: area.right, top: area.top, bottom: area.bottom, containLabel: true },',
    '  xAxis: { type: "category", data: cats },',
    '  yAxis: { type: "value" },',
    '  series: columns.slice(1).map((c, i) => ({',
    '    type: "bar", name: c, data: data.map(r => r[c]),',
    '    itemStyle: { color: palette[i % palette.length], borderRadius: [3, 3, 0, 0] },',
    '  })),',
    '};',
  ].join('\n');

  VS.registerTemplate({
    id: 'custom',
    order: 200,
    name: 'Свой код ECharts',
    category: 'Для разработчиков',
    description: 'Любой тип графика ECharts: напишите функцию, возвращающую option. Данные из таблицы передаются автоматически.',
    icon: '<svg viewBox="0 0 48 36"><path d="M17 10 L9 18 L17 26" fill="none" stroke="var(--c1)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 10 L39 18 L31 26" fill="none" stroke="var(--c1)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 7 L21 29" stroke="var(--c2)" stroke-width="2.4" stroke-linecap="round"/></svg>',
    bindings: [],
    common: ['layout', 'colors', 'number', 'animation', 'appearance'],
    sections: [
      {
        id: 'code',
        title: 'Код',
        items: [
          { key: 'code.js', label: 'Функция (тело) → option', type: 'code', default: EXAMPLE },
          { key: 'code.legend', label: 'Общая легенда студии', type: 'toggle', default: false, help: 'Если выключено — настройте legend в коде сами' },
        ],
      },
    ],
    sample: {
      data: [
        ['Месяц', 'Москва', 'Санкт-Петербург'],
        ['Январь', '42', '31'], ['Февраль', '38', '29'], ['Март', '51', '35'], ['Апрель', '58', '41'], ['Май', '64', '47'], ['Июнь', '71', '52'],
      ],
      bindings: {},
      settings: { title: 'Пользовательский график', subtitle: 'Измените код в настройках справа' },
    },
    legend: false,
    build: function (ctx) {
      var s = ctx.s;
      var columns = ctx.columns.map(function (c) { return c.name; });
      var data = ctx.rows.map(function (r) {
        var o = {};
        ctx.columns.forEach(function (c) {
          var v = r[c.index];
          o[c.name] = c.type === 'number' ? VS.parseNumber(v) : v === undefined || v === null ? '' : String(v);
        });
        return o;
      });
      var fn;
      try {
        fn = new Function('data', 'columns', 'palette', 'fmt', 'area', 'theme', 'echarts', 'ctx', s['code.js'] || '');
      } catch (e) {
        return VS.empty(ctx, 'Синтаксическая ошибка в коде: ' + e.message);
      }
      var opt;
      try {
        opt = fn(data, columns, ctx.palette, ctx.fmt, ctx.area, ctx.theme, ctx.echarts, ctx);
      } catch (e) {
        return VS.empty(ctx, 'Ошибка выполнения кода: ' + e.message);
      }
      if (!opt || typeof opt !== 'object') return VS.empty(ctx, 'Код должен вернуть объект option (return { … })');
      var out = {};
      for (var k in opt) out[k] = opt[k];
      if (!s['code.legend'] && !out.legend) out.legend = false;
      if (out.title) out.title = [].concat(out.title);
      return out;
    },
  });
})(window.VS);

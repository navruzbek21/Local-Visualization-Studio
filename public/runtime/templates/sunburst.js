(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'sunburst',
    order: 52,
    name: 'Солнечные лучи',
    category: 'Доли',
    description: 'Многоуровневая иерархия кольцами: от центра — общее, к краю — детали.',
    icon: '<svg viewBox="0 0 48 36"><circle cx="24" cy="18" r="6" fill="var(--c1)"/><path d="M24 6 A12 12 0 0 1 35.4 21.7 L29.7 19.9 A6 6 0 0 0 24 12 Z" fill="var(--c2)"/><path d="M35.4 21.7 A12 12 0 0 1 13 23 L18.6 20.5 A6 6 0 0 0 29.7 19.9 Z" fill="var(--c3)"/><path d="M13 23 A12 12 0 0 1 24 6 L24 12 A6 6 0 0 0 18.6 20.5 Z" fill="var(--c4)"/></svg>',
    bindings: [
      { key: 'levels', name: 'Уровни иерархии', dataType: 'text', multiple: true, description: 'Колонки по порядку: от центра к краю' },
      { key: 'value', name: 'Размер', dataType: 'number', optional: true },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    autoBind: function (cols) {
      var txt = cols.filter(function (c) { return c.type !== 'number'; });
      var num = cols.find(function (c) { return c.type === 'number'; });
      return { levels: txt.slice(0, 3).map(function (c) { return c.index; }), value: num ? num.index : undefined };
    },
    common: ['layout', 'colors', 'tooltip', 'number', 'animation', 'appearance'],
    sections: [
      {
        id: 'sunburst',
        title: 'Кольца',
        items: [
          { key: 'sun.inner', label: 'Пустой центр, %', type: 'range', min: 0, max: 60, default: 15 },
          { key: 'sun.labels', label: 'Подписи', type: 'select', options: [['radial', 'Радиально'], ['tangential', 'По кругу'], ['horizontal', 'Горизонтально'], ['none', 'Нет']], default: 'radial' },
          { key: 'sun.minAngle', label: 'Скрывать подписи у секторов меньше, °', type: 'range', min: 0, max: 30, default: 8 },
          { key: 'sun.gap', label: 'Зазор', type: 'range', min: 0, max: 4, step: 0.5, default: 1.5 },
          { key: 'sun.round', label: 'Скругление', type: 'range', min: 0, max: 10, default: 3 },
          { key: 'sun.sort', label: 'Сортировка', type: 'radio', options: [['desc', 'По убыванию'], ['none', 'Как в данных']], default: 'desc' },
        ],
      },
    ],
    sample: {
      data: [
        ['Континент', 'Регион', 'Страна', 'Население, млн'],
        ['Азия', 'Восточная Азия', 'Китай', '1410'], ['Азия', 'Восточная Азия', 'Япония', '124'], ['Азия', 'Восточная Азия', 'Корея', '52'],
        ['Азия', 'Южная Азия', 'Индия', '1430'], ['Азия', 'Южная Азия', 'Пакистан', '240'], ['Азия', 'Южная Азия', 'Бангладеш', '173'],
        ['Азия', 'Центральная Азия', 'Узбекистан', '36'], ['Азия', 'Центральная Азия', 'Казахстан', '20'],
        ['Европа', 'Восточная Европа', 'Россия', '144'], ['Европа', 'Восточная Европа', 'Польша', '37'],
        ['Европа', 'Западная Европа', 'Германия', '84'], ['Европа', 'Западная Европа', 'Франция', '68'],
        ['Африка', 'Западная Африка', 'Нигерия', '224'], ['Африка', 'Северная Африка', 'Египет', '113'], ['Африка', 'Восточная Африка', 'Эфиопия', '127'],
        ['Америка', 'Северная Америка', 'США', '335'], ['Америка', 'Южная Америка', 'Бразилия', '216'], ['Америка', 'Северная Америка', 'Мексика', '128'],
      ],
      bindings: { levels: [0, 1, 2], value: 3 },
      settings: { title: 'Население крупнейших стран', subtitle: 'млн человек, по континентам и регионам', footer: 'Источник: демонстрационные данные' },
    },
    legend: false,
    build: function (ctx) {
      var s = ctx.s;
      var tree = VS.buildTree(ctx, 'levels', 'value');
      if (!tree) return VS.empty(ctx, 'Привяжите колонки «Уровни иерархии»');
      var total = tree.value;
      tree.children.forEach(function (n, i) {
        n.itemStyle = { color: ctx.color(n.name, i) };
      });
      var a = ctx.area;
      var R = Math.min(a.width, a.height) / 2 - 4;
      var levelsCount = ctx.columnsOf('levels').length;
      var innerPct = Number(s['sun.inner']) || 0;
      var labelMode = s['sun.labels'];
      var levels = [{}];
      var r0 = (R * innerPct) / 100;
      var ring = (R - r0) / levelsCount;
      for (var l = 0; l < levelsCount; l++) {
        levels.push({
          r0: r0 + ring * l,
          r: r0 + ring * (l + 1),
          itemStyle: { opacity: l === 0 ? 1 : Math.max(0.35, 0.7 - (l - 1) * 0.18) },
          label: l === 0 ? {} : { color: ctx.theme.text },
        });
      }
      return {
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            var path = (p.treePathInfo || []).slice(1).map(function (x) { return x.name; }).join(' › ');
            return VS.tooltipHtml(ctx, path || p.name, [
              { name: (ctx.column('value') || { name: 'Количество' }).name, value: ctx.fmt(p.value) },
              { name: 'Доля от целого', value: ctx.fmt((p.value / total) * 100, { noAffix: true, noCompact: true, decimals: 1 }) + '%' },
            ]);
          },
        },
        series: [{
          type: 'sunburst',
          data: tree.children,
          center: [a.cx, a.cy],
          radius: [0, R],
          sort: s['sun.sort'] === 'desc' ? 'desc' : null,
          nodeClick: 'rootToNode',
          levels: levels,
          itemStyle: { borderColor: ctx.theme.background, borderWidth: Number(s['sun.gap']) || 0, borderRadius: Number(s['sun.round']) || 0 },
          label: {
            show: labelMode !== 'none',
            rotate: labelMode === 'horizontal' ? 0 : labelMode,
            minAngle: Number(s['sun.minAngle']) || 0,
            color: '#fff',
            fontFamily: ctx.font,
            fontSize: ctx.fontSize - 1,
            overflow: 'truncate',
          },
          emphasis: { focus: 'ancestor' },
        }],
      };
    },
  });
})(window.VS);

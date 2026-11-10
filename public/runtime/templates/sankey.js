(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'sankey',
    order: 70,
    name: 'Диаграмма Санкей',
    category: 'Связи',
    description: 'Потоки между этапами или категориями: откуда → куда → сколько.',
    icon: '<svg viewBox="0 0 48 36"><rect x="4" y="4" width="4" height="14" fill="var(--c1)"/><rect x="4" y="20" width="4" height="12" fill="var(--c2)"/><rect x="40" y="4" width="4" height="18" fill="var(--c3)"/><rect x="40" y="24" width="4" height="8" fill="var(--c4)"/><path d="M8 4 C24 4, 24 4, 40 4 L40 15 C24 15, 24 18, 8 18 Z" fill="var(--c1)" opacity=".4"/><path d="M8 20 C24 20, 24 15, 40 15 L40 22 C24 22, 24 27, 8 27 Z" fill="var(--c2)" opacity=".4"/><path d="M8 27 C24 27, 24 24, 40 24 L40 32 C24 32, 24 32, 8 32 Z" fill="var(--c2)" opacity=".4"/></svg>',
    bindings: [
      { key: 'source', name: 'Откуда', dataType: 'text' },
      { key: 'target', name: 'Куда', dataType: 'text' },
      { key: 'value', name: 'Объём потока', dataType: 'number' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    common: ['layout', 'colors', 'tooltip', 'number', 'animation', 'appearance'],
    sections: [
      {
        id: 'sankey',
        title: 'Узлы и потоки',
        items: [
          { key: 'sankey.orient', label: 'Направление', type: 'radio', options: [['horizontal', 'Слева направо'], ['vertical', 'Сверху вниз']], default: 'horizontal' },
          { key: 'sankey.align', label: 'Выравнивание узлов', type: 'radio', options: [['justify', 'По ширине'], ['left', 'Влево'], ['right', 'Вправо']], default: 'justify' },
          { key: 'sankey.nodeWidth', label: 'Ширина узла', type: 'range', min: 4, max: 40, default: 14 },
          { key: 'sankey.nodeGap', label: 'Промежуток между узлами', type: 'range', min: 2, max: 40, default: 12 },
          { key: 'sankey.linkColor', label: 'Цвет потоков', type: 'radio', options: [['source', 'Как источник'], ['target', 'Как цель'], ['gradient', 'Градиент'], ['gray', 'Серый']], default: 'source' },
          { key: 'sankey.opacity', label: 'Непрозрачность потоков', type: 'range', min: 0.1, max: 0.9, step: 0.05, default: 0.35 },
          { key: 'sankey.values', label: 'Значения у узлов', type: 'toggle', default: true },
          { key: 'sankey.draggable', label: 'Перетаскивание узлов', type: 'toggle', default: false },
        ],
      },
    ],
    sample: {
      data: [
        ['Источник', 'Назначение', 'Объём'],
        ['Бюджет', 'Образование', '320'], ['Бюджет', 'Здравоохранение', '280'], ['Бюджет', 'Инфраструктура', '240'], ['Бюджет', 'Соцподдержка', '410'],
        ['Образование', 'Школы', '190'], ['Образование', 'Вузы', '130'],
        ['Здравоохранение', 'Больницы', '200'], ['Здравоохранение', 'Поликлиники', '80'],
        ['Инфраструктура', 'Дороги', '160'], ['Инфраструктура', 'ЖКХ', '80'],
        ['Соцподдержка', 'Пенсии', '290'], ['Соцподдержка', 'Пособия', '120'],
      ],
      bindings: { source: 0, target: 1, value: 2 },
      settings: { title: 'Распределение бюджета', subtitle: 'млрд ₽', footer: 'Источник: демонстрационные данные' },
    },
    legend: false,
    build: function (ctx) {
      var s = ctx.s;
      var src = ctx.column('source'), dst = ctx.column('target'), val = ctx.column('value');
      if (!src || !dst || !val) return VS.empty(ctx, 'Привяжите колонки «Откуда», «Куда» и «Объём потока»');
      var nodes = [];
      var seen = new Map();
      var linksMap = new Map();
      function node(name) {
        if (!seen.has(name)) {
          seen.set(name, nodes.length);
          nodes.push({ name: name, itemStyle: { color: ctx.color(name, nodes.length), borderWidth: 0 } });
        }
      }
      src.raw.forEach(function (a, i) {
        var b = dst.raw[i];
        var v = val.num[i];
        if (!a || !b || v === null || v <= 0) return;
        if (a === b) {
          ctx.warnings.push('Поток «' + a + '» → «' + b + '» ссылается сам на себя и пропущен');
          return;
        }
        node(a);
        node(b);
        var key = a + '\u0001' + b;
        if (linksMap.has(key)) linksMap.get(key).value += v;
        else linksMap.set(key, { source: a, target: b, value: v, rowIndex: i });
      });
      var links = Array.from(linksMap.values());
      if (!links.length) return VS.empty(ctx, 'Нет потоков с положительным объёмом');

      // ECharts требует граф без циклов — проверяем заранее и даём понятную ошибку
      var adj = new Map();
      links.forEach(function (l) {
        if (!adj.has(l.source)) adj.set(l.source, []);
        adj.get(l.source).push(l.target);
      });
      var state = new Map();
      var cycle = null;
      function dfs(u, path) {
        state.set(u, 1);
        var next = adj.get(u) || [];
        for (var i = 0; i < next.length && !cycle; i++) {
          var v = next[i];
          if (state.get(v) === 1) cycle = path.concat(u, v);
          else if (!state.get(v)) dfs(v, path.concat(u));
        }
        state.set(u, 2);
      }
      nodes.forEach(function (n) { if (!state.get(n.name) && !cycle) dfs(n.name, []); });
      if (cycle) {
        var from = cycle.indexOf(cycle[cycle.length - 1]);
        return VS.empty(ctx, 'В данных есть цикл: ' + cycle.slice(from).join(' → ') + '. Санкей поддерживает только потоки без циклов.');
      }

      var lc = s['sankey.linkColor'];
      var vertical = s['sankey.orient'] === 'vertical';
      var labelW = 0;
      var f = ctx.fontSize + 'px ' + ctx.font;
      nodes.forEach(function (n) { labelW = Math.max(labelW, VS.measureText(n.name, f)); });
      labelW = Math.min(labelW + 10, ctx.area.width * 0.25);
      var a = ctx.area;
      return {
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            if (p.dataType === 'edge') return VS.tooltipHtml(ctx, p.data.source + ' → ' + p.data.target, [{ name: val.name, value: ctx.fmt(p.value) }]);
            return VS.tooltipHtml(ctx, p.name, [{ name: val.name, value: ctx.fmt(p.value), color: p.color }]);
          },
        },
        series: [{
          type: 'sankey',
          top: a.top + (vertical ? 4 : 4),
          bottom: a.bottom + (vertical ? 24 : 4),
          left: a.left,
          right: a.right + (vertical ? 0 : labelW),
          orient: s['sankey.orient'],
          nodeAlign: s['sankey.align'],
          nodeWidth: Number(s['sankey.nodeWidth']) || 14,
          nodeGap: Number(s['sankey.nodeGap']) || 12,
          draggable: !!s['sankey.draggable'],
          layoutIterations: 64,
          data: nodes,
          links: links,
          emphasis: { focus: 'adjacency' },
          lineStyle: {
            color: lc === 'gray' ? ctx.theme.faint : lc,
            opacity: Number(s['sankey.opacity']) || 0.35,
            curveness: 0.5,
          },
          label: {
            color: ctx.theme.text,
            fontFamily: ctx.font,
            fontSize: ctx.fontSize,
            position: vertical ? 'bottom' : 'right',
            formatter: function (p) { return s['sankey.values'] ? p.name + '  {v|' + ctx.fmt(p.value) + '}' : p.name; },
            rich: { v: { color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize } },
          },
        }],
      };
    },
  });
})(window.VS);

(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'treemap',
    order: 50,
    name: 'Древовидная карта',
    category: 'Доли',
    description: 'Иерархия долей прямоугольниками; уровни задаются колонками, можно проваливаться внутрь.',
    icon: '<svg viewBox="0 0 48 36"><rect x="4" y="4" width="22" height="28" fill="var(--c1)"/><rect x="27" y="4" width="17" height="15" fill="var(--c2)"/><rect x="27" y="20" width="9" height="12" fill="var(--c3)"/><rect x="37" y="20" width="7" height="12" fill="var(--c4)"/></svg>',
    bindings: [
      { key: 'levels', name: 'Уровни иерархии', dataType: 'text', multiple: true, description: 'Колонки по порядку: от общего к частному' },
      { key: 'value', name: 'Размер', dataType: 'number', optional: true, description: 'Если не задан — считается число строк' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    autoBind: function (cols) {
      var txt = cols.filter(function (c) { return c.type !== 'number'; });
      var num = cols.find(function (c) { return c.type === 'number'; });
      return { levels: txt.slice(0, 2).map(function (c) { return c.index; }), value: num ? num.index : undefined };
    },
    common: ['layout', 'colors', 'tooltip', 'number', 'animation', 'appearance'],
    sections: [
      {
        id: 'treemap',
        title: 'Прямоугольники',
        items: [
          { key: 'tree.depth', label: 'Показывать уровней сразу', type: 'select', options: [['all', 'Все'], ['1', '1 (с проваливанием)'], ['2', '2']], default: 'all' },
          { key: 'tree.parentLabels', label: 'Заголовки групп', type: 'toggle', default: true },
          { key: 'tree.values', label: 'Значения в подписях', type: 'toggle', default: true },
          { key: 'tree.percent', label: 'Доля от целого в подписях', type: 'toggle', default: false },
          { key: 'tree.gap', label: 'Зазор', type: 'range', min: 0, max: 8, default: 2 },
          { key: 'tree.breadcrumb', label: 'Навигационная цепочка', type: 'toggle', default: true },
          { key: 'tree.shade', label: 'Оттенки внутри группы', type: 'toggle', default: true },
          { key: 'tree.round', label: 'Скругление', type: 'range', min: 0, max: 10, default: 2 },
        ],
      },
    ],
    sample: {
      data: [
        ['Отдел', 'Статья', 'Расходы'],
        ['ИТ', 'Лицензии', '420'], ['ИТ', 'Оборудование', '310'], ['ИТ', 'Облако и хостинг', '180'], ['ИТ', 'Подрядчики', '150'],
        ['Маркетинг', 'Реклама онлайн', '380'], ['Маркетинг', 'Мероприятия', '160'], ['Маркетинг', 'Исследования', '90'],
        ['Производство', 'Сырьё', '920'], ['Производство', 'Энергия', '260'], ['Производство', 'Ремонт', '140'],
        ['Персонал', 'Обучение', '120'], ['Персонал', 'ДМС', '210'], ['Персонал', 'Подбор', '70'],
        ['Логистика', 'Перевозки', '330'], ['Логистика', 'Склады', '190'],
      ],
      bindings: { levels: [0, 1], value: 2 },
      settings: { title: 'Структура расходов компании', subtitle: 'млн ₽ по отделам и статьям', footer: 'Источник: демонстрационные данные' },
    },
    legend: false,
    build: function (ctx) {
      var s = ctx.s;
      var tree = VS.buildTree(ctx, 'levels', 'value');
      if (!tree) return VS.empty(ctx, 'Привяжите колонки «Уровни иерархии» (и при желании «Размер»)');
      var total = tree.value;
      tree.children.forEach(function (n, i) {
        var c = ctx.color(n.name, i);
        n.itemStyle = { color: c };
      });
      var gap = Number(s['tree.gap']);
      var round = Number(s['tree.round']) || 0;
      var depth = s['tree.depth'] === 'all' ? null : Number(s['tree.depth']);
      var levelsCount = ctx.columnsOf('levels').length;
      var bc = s['tree.breadcrumb'] && (depth !== null);
      var bcH = bc ? 30 : 0;

      var levelStyles = [
        { itemStyle: { borderWidth: 0, gapWidth: gap * 2, borderColor: ctx.theme.background, borderRadius: round } },
      ];
      for (var l = 1; l < levelsCount; l++) {
        levelStyles.push({
          colorSaturation: s['tree.shade'] ? [0.35, 0.65] : undefined,
          itemStyle: { gapWidth: gap, borderWidth: gap, borderColor: ctx.theme.background, borderColorSaturation: s['tree.shade'] ? 0.65 : undefined, borderRadius: round },
        });
      }
      var labelFmt = function (p) {
        var parts = ['{n|' + p.name + '}'];
        var extra = [];
        if (s['tree.values']) extra.push(ctx.fmt(p.value));
        if (s['tree.percent'] && total) extra.push(ctx.fmt((p.value / total) * 100, { noAffix: true, noCompact: true, decimals: 1 }) + '%');
        if (extra.length) parts.push('{v|' + extra.join(' · ') + '}');
        return parts.join('\n');
      };
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
          type: 'treemap',
          name: s.title || 'Всего',
          data: tree.children,
          top: ctx.area.top,
          left: ctx.area.left,
          right: ctx.area.right,
          bottom: ctx.area.bottom + bcH,
          roam: false,
          nodeClick: depth !== null ? 'zoomToNode' : false,
          leafDepth: depth || undefined,
          visibleMin: 1,
          sort: 'desc',
          breadcrumb: {
            show: !!bc,
            bottom: ctx.area.bottom,
            left: ctx.area.left,
            height: 22,
            itemStyle: { color: ctx.theme.grid, borderColor: ctx.theme.grid, textStyle: { color: ctx.theme.text, fontFamily: ctx.font } },
            emphasis: { itemStyle: { color: ctx.theme.faint } },
          },
          label: {
            show: true,
            formatter: labelFmt,
            position: 'insideTopLeft',
            padding: [6, 8],
            overflow: 'truncate',
            rich: {
              n: { fontSize: ctx.fontSize, color: '#fff', fontFamily: ctx.font, lineHeight: ctx.fontSize + 4 },
              v: { fontSize: ctx.fontSize + 2, color: '#fff', fontWeight: 'bold', fontFamily: ctx.font, lineHeight: ctx.fontSize + 6 },
            },
          },
          upperLabel: {
            show: !!s['tree.parentLabels'] && levelsCount > 1,
            height: ctx.fontSize + 12,
            color: '#fff',
            fontWeight: 'bold',
            fontFamily: ctx.font,
            fontSize: ctx.fontSize,
            formatter: function (p) { return p.name + (s['tree.values'] ? '  ' + ctx.fmt(p.value) : ''); },
          },
          itemStyle: { borderColor: ctx.theme.background },
          levels: levelStyles,
        }],
      };
    },
  });
})(window.VS);

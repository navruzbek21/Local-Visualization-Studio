(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'funnel',
    order: 85,
    name: 'Воронка',
    category: 'Доли',
    description: 'Этапы процесса и конверсия между ними: продажи, найм, онбординг.',
    icon: '<svg viewBox="0 0 48 36"><path d="M4 4 H44 L38 12 H10 Z" fill="var(--c1)"/><path d="M11 13 H37 L32 21 H16 Z" fill="var(--c1)" opacity=".75"/><path d="M17 22 H31 L28 30 H20 Z" fill="var(--c1)" opacity=".5"/></svg>',
    bindings: [
      { key: 'label', name: 'Этапы', dataType: 'text' },
      { key: 'value', name: 'Значение', dataType: 'number' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    common: ['layout', 'colors', 'tooltip', 'number', 'animation', 'appearance', 'legend'],
    sections: [
      {
        id: 'funnel',
        title: 'Воронка',
        items: [
          { key: 'funnel.sort', label: 'Порядок', type: 'radio', options: [['none', 'Как в данных'], ['descending', 'По убыванию'], ['ascending', 'Перевёрнутая']], default: 'none' },
          { key: 'funnel.align', label: 'Выравнивание', type: 'radio', options: [['center', 'По центру'], ['left', 'Слева']], default: 'center' },
          { key: 'funnel.gap', label: 'Зазор между этапами', type: 'range', min: 0, max: 12, default: 3 },
          { key: 'funnel.minSize', label: 'Минимальная ширина, %', type: 'range', min: 0, max: 60, default: 10 },
          { key: 'funnel.color', label: 'Цвет', type: 'radio', options: [['single', 'Один цвет'], ['category', 'По этапам']], default: 'single' },
          { key: 'funnel.conversion', label: 'Конверсия', type: 'select', options: [['first', 'От первого этапа'], ['prev', 'От предыдущего'], ['none', 'Не показывать']], default: 'first' },
          { key: 'labels.position', label: 'Подписи', type: 'radio', options: [['inside', 'Внутри'], ['right', 'Справа']], default: 'right' },
        ],
      },
    ],
    sample: {
      data: [
        ['Этап', 'Клиенты'],
        ['Посетили сайт', '48 200'], ['Зарегистрировались', '12 540'], ['Добавили в корзину', '5 860'],
        ['Начали оформление', '3 410'], ['Оплатили заказ', '2 170'], ['Повторная покупка', '840'],
      ],
      bindings: { label: 0, value: 1 },
      settings: { title: 'Воронка интернет-продаж', subtitle: 'Число клиентов на каждом этапе, сентябрь', footer: 'Источник: демонстрационные данные', 'legend.show': false },
    },
    legendNames: function (ctx) {
      var l = ctx.column('label');
      return l && ctx.s['funnel.color'] === 'category' ? l.raw : null;
    },
    build: function (ctx) {
      var s = ctx.s;
      var label = ctx.column('label');
      var val = ctx.column('value');
      if (!label || !val) return VS.empty(ctx, 'Привяжите колонки «Этапы» и «Значение»');
      var items = [];
      label.raw.forEach(function (n, i) {
        if (val.num[i] !== null) items.push({ name: n, value: val.num[i], rowIndex: i });
      });
      if (!items.length) return VS.empty(ctx);
      var first = items[0].value;
      var conv = s['funnel.conversion'];
      items.forEach(function (d, i) {
        var base = conv === 'prev' ? (i ? items[i - 1].value : d.value) : first;
        d.conv = base ? (d.value / base) * 100 : null;
      });
      var single = s['funnel.color'] !== 'category';
      var a = ctx.area;
      var right = s['labels.position'] === 'right';
      var labelW = right ? Math.min(a.width * 0.4, 260) : 0;
      return {
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            var d = items[p.dataIndex];
            var rows = [{ name: val.name, value: ctx.fmt(p.value), color: p.color }];
            if (conv !== 'none' && d.conv !== null) rows.push({ name: conv === 'prev' ? 'От предыдущего' : 'От первого этапа', value: ctx.fmt(d.conv, { noAffix: true, noCompact: true, decimals: 1 }) + '%' });
            return VS.tooltipHtml(ctx, p.name, rows);
          },
        },
        series: [{
          type: 'funnel',
          top: a.top,
          bottom: a.bottom,
          left: a.left,
          right: a.right + labelW,
          sort: s['funnel.sort'],
          funnelAlign: s['funnel.align'],
          gap: Number(s['funnel.gap']) || 0,
          minSize: (Number(s['funnel.minSize']) || 0) + '%',
          maxSize: '100%',
          data: items.map(function (d, i) {
            var color = single ? ctx.color(val.name, 0) : ctx.color(d.name, i);
            return {
              name: d.name, value: d.value, rowIndex: d.rowIndex,
              itemStyle: { color: color, opacity: single ? Math.max(0.45, 1 - i * (0.5 / Math.max(1, items.length - 1))) : 1, borderWidth: 0 },
            };
          }),
          label: VS.labelStyle(ctx, {
            show: true,
            position: right ? 'right' : 'inside',
            color: right ? ctx.theme.text : '#fff',
            formatter: function (p) {
              var d = items[p.dataIndex];
              var c = conv !== 'none' && d.conv !== null && p.dataIndex > 0 ? '  {c|' + ctx.fmt(d.conv, { noAffix: true, noCompact: true, decimals: 1 }) + '%}' : '';
              return '{n|' + p.name + '}\n{v|' + ctx.fmt(p.value) + '}' + c;
            },
            rich: {
              n: { color: right ? ctx.theme.muted : '#fff', fontSize: ctx.fontSize, lineHeight: ctx.fontSize + 4, fontFamily: ctx.font },
              v: { color: right ? ctx.theme.text : '#fff', fontSize: ctx.fontSize + 2, fontWeight: 'bold', fontFamily: ctx.font },
              c: { color: right ? ctx.theme.muted : '#fff', fontSize: ctx.fontSize, fontFamily: ctx.font },
            },
          }),
          labelLine: { show: right, length: 12, lineStyle: { color: ctx.theme.axis } },
        }],
      };
    },
  });
})(window.VS);

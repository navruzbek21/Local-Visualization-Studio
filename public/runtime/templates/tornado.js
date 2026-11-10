(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'tornado',
    order: 6,
    name: 'Торнадо-диаграмма',
    category: 'Разработка месторождений',
    description: 'Чувствительность результата (NPV, запасы, добыча) к неопределённым параметрам: пессимистичный и оптимистичный варианты.',
    icon: '<svg viewBox="0 0 48 36"><line x1="24" y1="2" x2="24" y2="34" stroke="currentColor" stroke-opacity=".4"/><rect x="6" y="5" width="18" height="5" fill="var(--c8)"/><rect x="24" y="5" width="16" height="5" fill="var(--c1)"/><rect x="11" y="13" width="13" height="5" fill="var(--c8)"/><rect x="24" y="13" width="11" height="5" fill="var(--c1)"/><rect x="16" y="21" width="8" height="5" fill="var(--c8)"/><rect x="24" y="21" width="8" height="5" fill="var(--c1)"/><rect x="20" y="29" width="4" height="4" fill="var(--c8)"/><rect x="24" y="29" width="3" height="4" fill="var(--c1)"/></svg>',
    bindings: [
      { key: 'label', name: 'Параметр', dataType: 'text' },
      { key: 'low', name: 'Результат при низком значении', dataType: 'number', match: [/(низ|мин|пессим|low|p90)/i] },
      { key: 'high', name: 'Результат при высоком значении', dataType: 'number', match: [/(выс|макс|оптим|high|p10)/i] },
      { key: 'lowLabel', name: 'Подпись низкого значения', dataType: 'any', optional: true, match: [/(значение.*низ|low.*value|диапазон.*от)/i], description: 'Например «−20%» или «0,18»' },
      { key: 'highLabel', name: 'Подпись высокого значения', dataType: 'any', optional: true, match: [/(значение.*выс|high.*value|диапазон.*до)/i] },
    ],
    common: ['layout', 'legend', 'tooltip', 'number', 'animation', 'appearance'],
    sections: [
      {
        id: 'tornado',
        title: 'Торнадо',
        items: [
          { key: 'tor.base', label: 'Базовое значение результата', type: 'text', default: '', placeholder: 'например, 1250', help: 'Пусто — среднее из середин диапазонов' },
          { key: 'tor.baseLabel', label: 'Подпись базового варианта', type: 'text', default: 'Базовый вариант' },
          { key: 'tor.sort', label: 'Сортировать по размаху', type: 'toggle', default: true },
          { key: 'tor.lowName', label: 'Название низкого варианта', type: 'text', default: 'Низкое значение параметра' },
          { key: 'tor.highName', label: 'Название высокого варианта', type: 'text', default: 'Высокое значение параметра' },
          { key: 'tor.lowColor', label: 'Цвет низкого', type: 'color', default: '#e34948' },
          { key: 'tor.highColor', label: 'Цвет высокого', type: 'color', default: '#2a78d6' },
          { key: 'labels.show', label: 'Значения на концах столбцов', type: 'toggle', default: true },
          { key: 'xAxis.title', label: 'Название оси результата', type: 'text', default: '' },
        ],
      },
    ],
    sample: {
      data: [
        ['Параметр', 'Диапазон', 'NPV при низком, млн ₽', 'NPV при высоком, млн ₽', 'Низкое значение', 'Высокое значение'],
        ['Цена нефти', '±25%', '4 120', '11 860', '55 $/барр', '90 $/барр'],
        ['Извлекаемые запасы', 'P90–P10', '5 380', '10 240', 'P90', 'P10'],
        ['Начальный дебит скважин', '±30%', '5 950', '9 610', '21 т/сут', '39 т/сут'],
        ['Капитальные затраты', '+30% / −15%', '6 240', '8 820', '+30%', '−15%'],
        ['Темп падения добычи', '18–30%/год', '6 610', '8 750', '30%/год', '18%/год'],
        ['Ставка дисконтирования', '15% / 10%', '6 880', '8 400', '15%', '10%'],
        ['Операционные затраты', '±20%', '7 110', '8 160', '+20%', '−20%'],
      ],
      bindings: { label: 0, low: 2, high: 3, lowLabel: 4, highLabel: 5 },
      settings: { title: 'Анализ чувствительности NPV проекта', subtitle: 'Влияние ключевых параметров на чистую приведённую стоимость, млн ₽', footer: 'Источник: демонстрационные данные', 'tor.base': '7 640', 'xAxis.title': 'NPV, млн ₽' },
    },
    legendNames: function (ctx) { return [ctx.s['tor.lowName'], ctx.s['tor.highName']]; },
    build: function (ctx) {
      var s = ctx.s;
      var L = ctx.column('label'), Lo = ctx.column('low'), Hi = ctx.column('high');
      if (!L || !Lo || !Hi) return VS.empty(ctx, 'Привяжите колонки «Параметр», результаты при низком и высоком значениях');
      var LL = ctx.column('lowLabel'), HL = ctx.column('highLabel');
      var items = [];
      L.raw.forEach(function (name, i) {
        if (!name || Lo.num[i] === null || Hi.num[i] === null) return;
        items.push({ name: name, low: Lo.num[i], high: Hi.num[i], lowLabel: LL ? LL.raw[i] : '', highLabel: HL ? HL.raw[i] : '', range: Math.abs(Hi.num[i] - Lo.num[i]) });
      });
      if (!items.length) return VS.empty(ctx);
      var base = VS.parseNumber(s['tor.base']);
      if (base === null) base = items.reduce(function (a, it) { return a + (it.low + it.high) / 2; }, 0) / items.length;
      if (s['tor.sort']) items.sort(function (a, b) { return b.range - a.range; });
      var lowC = s['tor.lowColor'], highC = s['tor.highColor'];
      var mk = function (key, color, nameKey) {
        return {
          type: 'bar', name: s[nameKey], stack: 'tornado', barCategoryGap: '35%', color: color,
          data: items.map(function (it) {
            return { value: it[key] - base, actual: it[key], label2: it[key + 'Label'], itemStyle: { color: color, borderRadius: it[key] - base >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3] } };
          }),
          label: VS.labelStyle(ctx, {
            show: !!s['labels.show'], position: 'outside', fontSize: ctx.fontSize - 1,
            formatter: function (p) {
              var d = p.data;
              return ctx.fmt(d.actual) + (d.label2 ? '  {m|' + d.label2 + '}' : '');
            },
            rich: { m: { color: ctx.theme.muted, fontSize: ctx.fontSize - 1, fontFamily: ctx.font } },
          }),
        };
      };
      var series = [mk('low', lowC, 'tor.lowName'), mk('high', highC, 'tor.highName')];
      // «outside» для stacked нет — ставим подпись с нужной стороны
      series.forEach(function (sr) {
        sr.data.forEach(function (d) { d.label = { position: d.value >= 0 ? 'right' : 'left' }; });
      });
      series[0].markLine = {
        silent: true, symbol: 'none', lineStyle: { color: ctx.theme.text, width: 1.5 },
        label: { formatter: (s['tor.baseLabel'] || 'База') + ': ' + ctx.fmt(base), color: ctx.theme.text, fontFamily: ctx.font, fontSize: ctx.fontSize - 1, fontWeight: 'bold' },
        data: [{ xAxis: 0 }],
      };
      var maxDev = Math.max.apply(null, items.map(function (it) { return Math.max(Math.abs(it.low - base), Math.abs(it.high - base)); }));
      var xAxis = VS.axis(ctx, 'x', { type: 'value' });
      xAxis.axisLabel.formatter = function (v) { return ctx.fmt(v + base); };
      xAxis.min = -maxDev * 1.35;
      xAxis.max = maxDev * 1.35;
      xAxis.splitLine = { show: true, lineStyle: { color: ctx.theme.grid } };
      var yAxis = VS.axis(ctx, 'y', { type: 'category', data: items.map(function (it) { return it.name; }), inverse: true });
      yAxis.axisLabel.interval = 0;
      yAxis.axisLabel.hideOverlap = false;
      yAxis.axisLabel.color = ctx.theme.text;
      // ширина подписей — по самому длинному слову, но не больше трети области
      var f = ctx.fontSize + 'px ' + ctx.font;
      var longestWord = 0;
      items.forEach(function (it) { it.name.split(/\s+/).forEach(function (wd) { longestWord = Math.max(longestWord, VS.measureText(wd, f)); }); });
      yAxis.axisLabel.width = Math.round(Math.min(ctx.area.width * 0.34, Math.max(ctx.area.width * 0.18, longestWord + 8)));
      yAxis.axisLabel.overflow = 'break';
      yAxis.axisLine = { show: false };
      yAxis.splitLine = { show: false };
      yAxis.name = undefined;
      return {
        series: series, xAxis: xAxis, yAxis: yAxis, grid: VS.grid(ctx, { top: 22 }),
        tooltip: {
          trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: function (params) {
            var it = items[params[0].dataIndex];
            return VS.tooltipHtml(ctx, it.name, [
              { name: s['tor.lowName'] + (it.lowLabel ? ' (' + it.lowLabel + ')' : ''), value: ctx.fmt(it.low), color: lowC },
              { name: s['tor.highName'] + (it.highLabel ? ' (' + it.highLabel + ')' : ''), value: ctx.fmt(it.high), color: highC },
              { name: 'Размах', value: ctx.fmt(it.range) },
            ]);
          },
        },
      };
    },
  });
})(window.VS);

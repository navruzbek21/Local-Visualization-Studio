(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'pareto',
    order: 27,
    name: 'Диаграмма Парето',
    category: 'Сравнение',
    description: 'Категории по убыванию и накопленный процент: какие причины дают 80 % потерь, простоев или затрат. ABC-анализ.',
    icon: '<svg viewBox="0 0 48 36"><g fill="var(--c1)"><rect x="5" y="6" width="6" height="26" rx="1"/><rect x="12" y="14" width="6" height="18" rx="1"/><rect x="19" y="20" width="6" height="12" rx="1"/></g><g fill="var(--c1)" opacity=".4"><rect x="26" y="25" width="6" height="7" rx="1"/><rect x="33" y="28" width="6" height="4" rx="1"/><rect x="40" y="30" width="5" height="2" rx="1"/></g><polyline points="8,16 15,10 22,6.5 29,5 36,4 42,3.5" fill="none" stroke="var(--c2)" stroke-width="2"/></svg>',
    variants: [
      { name: 'Диаграмма Парето', settings: { 'pareto.abc': false } },
      {
        name: 'ABC-анализ', settings: { 'pareto.abc': true },
        icon: '<svg viewBox="0 0 48 36"><rect x="4" y="3" width="17" height="30" fill="var(--c1)" opacity=".1"/><g fill="var(--c1)"><rect x="5" y="6" width="6" height="26" rx="1"/><rect x="13" y="14" width="6" height="18" rx="1"/></g><g fill="var(--c1)" opacity=".55"><rect x="22" y="20" width="6" height="12" rx="1"/><rect x="29" y="25" width="6" height="7" rx="1"/></g><g fill="var(--c1)" opacity=".25"><rect x="36" y="28" width="4" height="4" rx="1"/><rect x="41" y="30" width="4" height="2" rx="1"/></g><text x="10" y="9" font-size="7" font-weight="bold" fill="currentColor" opacity=".7">A</text></svg>',
      },
    ],
    bindings: [
      { key: 'label', name: 'Категории (причины)', dataType: 'text' },
      { key: 'value', name: 'Значение', dataType: 'number', description: 'Одинаковые категории суммируются' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    sections: [
      {
        id: 'pareto',
        title: 'Парето',
        items: [
          { key: 'pareto.threshold', label: 'Порог, %', type: 'range', min: 50, max: 95, step: 5, default: 80, help: 'Линия «главных» причин: классическое правило 80/20' },
          { key: 'pareto.abc', label: 'ABC-анализ', type: 'toggle', default: false, help: 'A — категории до порога, B — до второй границы, C — остальные' },
          { key: 'pareto.bThreshold', label: 'Граница групп B и C, %', type: 'range', min: 85, max: 99, default: 95, show: function (s) { return s['pareto.abc']; } },
          { key: 'pareto.highlight', label: 'Выделять категории до порога', type: 'toggle', default: true, show: function (s) { return !s['pareto.abc']; } },
          { key: 'pareto.top', label: 'Число категорий', type: 'range', min: 0, max: 40, default: 0, help: '0 — все; остальные объединяются в «Прочие» в конце' },
          { key: 'pareto.otherLabel', label: 'Подпись «Прочие»', type: 'text', default: 'Прочие', show: function (s) { return Number(s['pareto.top']) > 0; } },
          { key: 'pareto.labels', label: 'Значения на столбцах', type: 'toggle', default: true },
          { key: 'pareto.cumLabels', label: 'Проценты на кривой', type: 'toggle', default: false },
          { key: 'bar.radius', label: 'Скругление столбцов', type: 'range', min: 0, max: 10, default: 3 },
          { key: 'pareto.color', label: 'Цвет столбцов', type: 'color', default: '#2a78d6' },
          { key: 'pareto.lineColor', label: 'Цвет кривой', type: 'color', default: '#eb6834' },
          { type: 'heading', label: 'Оси' },
          { key: 'yAxis.title', label: 'Название оси значений', type: 'text', default: '' },
          { key: 'xAxis.rotate', label: 'Поворот подписей категорий', type: 'select', options: [['auto', 'Авто'], ['0', '0°'], ['30', '30°'], ['45', '45°'], ['90', '90°']], default: 'auto' },
          { key: 'yAxis.grid', label: 'Линии сетки', type: 'toggle', default: true },
        ],
      },
    ],
    sample: {
      data: [
        ['Причина', 'Потери нефти, т'],
        ['Отказы ЭЦН', '4820'], ['Ожидание ПРС/КРС', '3150'], ['Ограничения энергоснабжения', '1980'],
        ['АСПО (парафин)', '1240'], ['Гидратообразование', '860'], ['Плановые ремонты', '610'],
        ['Прорыв газа', '420'], ['Солеотложение', '380'], ['Порывы трубопроводов', '290'],
        ['Ожидание замера', '150'], ['Прочие причины', '120'],
      ],
      bindings: { label: 0, value: 1 },
      settings: {
        title: 'Потери добычи нефти по причинам',
        subtitle: 'Тонн за 2025 год. Кривая — накопленная доля потерь',
        footer: 'Источник: демонстрационные данные',
        'yAxis.title': 'Потери, т',
      },
    },
    legendNames: function (ctx) {
      var v = ctx.column('value');
      return v ? [v.name, 'Накопленная доля'] : null;
    },
    build: function (ctx) {
      var s = ctx.s;
      var L = ctx.column('label'), V = ctx.column('value');
      if (!L || !V) return VS.empty(ctx, 'Привяжите колонки «Категории» и «Значение»');
      var sums = new Map(), negatives = 0;
      L.raw.forEach(function (k, i) {
        var v = V.num[i];
        if (!k || v === null) return;
        if (v < 0) { negatives++; return; }
        sums.set(k, (sums.get(k) || 0) + v);
      });
      if (negatives) ctx.warnings.push('Отрицательные значения пропущены: ' + negatives);
      var items = Array.from(sums, function (e) { return { name: e[0], value: e[1] }; }).sort(function (a, b) { return b.value - a.value; });
      if (!items.length) return VS.empty(ctx, 'Нет положительных значений');
      var top = Number(s['pareto.top']) || 0;
      if (top > 0 && items.length > top + 1) {
        var rest = items.slice(top);
        items = items.slice(0, top);
        items.push({ name: s['pareto.otherLabel'] || 'Прочие', value: rest.reduce(function (a, x) { return a + x.value; }, 0), other: rest.length });
      }
      var total = items.reduce(function (a, x) { return a + x.value; }, 0) || 1;
      var thrA = Number(s['pareto.threshold']) || 80;
      var thrB = Math.max(thrA, Number(s['pareto.bThreshold']) || 95);
      var abc = !!s['pareto.abc'];
      var acc = 0;
      items.forEach(function (x) {
        var before = (acc / total) * 100;
        acc += x.value;
        x.share = (x.value / total) * 100;
        x.cum = (acc / total) * 100;
        // категория входит в группу, если до неё накоплено меньше порога (включая ту, что его пересекает)
        x.cls = before < thrA - 1e-9 ? 'A' : before < thrB - 1e-9 ? 'B' : 'C';
      });

      var color = s['pareto.color'] || ctx.palette[0];
      var lineColor = s['pareto.lineColor'] || ctx.palette[1];
      var light = VS.color.mix(color, ctx.theme.background, 0.62);
      var mid = VS.color.mix(color, ctx.theme.background, 0.35);
      var colorOf = function (x) {
        if (abc) return x.cls === 'A' ? color : x.cls === 'B' ? mid : light;
        return s['pareto.highlight'] === false || x.cls === 'A' ? color : light;
      };
      var r = Number(s['bar.radius']) || 0;
      var names = items.map(function (x) { return x.name; });
      var bars = {
        type: 'bar', name: V.name, barCategoryGap: '18%',
        data: items.map(function (x) { return { value: x.value, itemStyle: { color: colorOf(x), borderRadius: [r, r, 0, 0] }, item: x }; }),
        // подложка: линии порогов не перечёркивают подписи
        label: VS.labelStyle(ctx, { show: !!s['pareto.labels'], position: 'top', fontSize: ctx.fontSize - 1, color: ctx.theme.muted, backgroundColor: VS.color.alpha(ctx.theme.background, 0.9), padding: [1, 3], borderRadius: 2, formatter: function (p) { return ctx.fmt(p.value); } }),
        labelLayout: { hideOverlap: true },
        color: color,
      };
      var line = {
        type: 'line', name: 'Накопленная доля', yAxisIndex: 1, z: 5,
        data: items.map(function (x) { return x.cum; }),
        color: lineColor, symbol: 'circle', symbolSize: 6,
        lineStyle: { color: lineColor, width: 2.2 },
        itemStyle: { color: lineColor, borderColor: ctx.theme.background, borderWidth: 1.5 },
        label: VS.labelStyle(ctx, { show: !!s['pareto.cumLabels'], position: 'top', fontSize: ctx.fontSize - 1, color: lineColor, formatter: function (p) { return ctx.fmt(p.value, { noAffix: true, noCompact: true, decimals: 0 }) + '%'; } }),
        labelLayout: { hideOverlap: true },
      };
      // линии порогов — отдельной серией под столбцами, чтобы не перечёркивать подписи
      var thresholds = { type: 'line', name: '__thresholds', yAxisIndex: 1, data: [], silent: true, z: 1, tooltip: { show: false },
        markLine: {
          silent: true, symbol: 'none', animation: false, z: 1, // у markLine свой z (по умолчанию 5)
          lineStyle: { color: ctx.theme.text, type: 'dashed', width: 1, opacity: 0.6 },
          label: { position: 'insideEndTop', color: ctx.theme.text, fontFamily: ctx.font, fontSize: ctx.fontSize - 1, formatter: function (p) { return ctx.fmt(p.value, { noAffix: true, noCompact: true, decimals: 0 }) + '%'; } },
          data: [{ yAxis: thrA }].concat(abc ? [{ yAxis: thrB }] : []),
        },
      };
      // группы ABC — светлые полосы с подписью
      if (abc) {
        var bands = [];
        ['A', 'B', 'C'].forEach(function (cls) {
          var idx = items.map(function (x, i) { return x.cls === cls ? i : -1; }).filter(function (i) { return i >= 0; });
          if (!idx.length) return;
          var shareSum = idx.reduce(function (a, i) { return a + items[i].share; }, 0);
          bands.push([
            {
              xAxis: names[idx[0]],
              name: cls + ': ' + idx.length + ' ' + VS.util.plural(idx.length, 'категория', 'категории', 'категорий') + ', ' + ctx.fmt(shareSum, { noAffix: true, noCompact: true, decimals: 0 }) + '%',
              itemStyle: { color: VS.color.alpha(color, cls === 'A' ? 0.08 : cls === 'B' ? 0.05 : 0.02) },
            },
            { xAxis: names[idx[idx.length - 1]] },
          ]);
        });
        bars.markArea = {
          silent: true,
          label: { position: 'top', color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 1, fontWeight: 'bold', distance: 6, overflow: 'truncate' },
          data: bands,
        };
      }

      var xAxis = VS.axis(ctx, 'x', { type: 'category', data: names });
      // длинные названия причин переносим по словам; если отдельное слово не помещается — наклон с обрезкой
      var lf = ctx.fontSize + 'px ' + ctx.font;
      var yLabW = VS.measureText(ctx.fmt(items[0].value), lf);
      var plotW = ctx.area.width - yLabW - (s['yAxis.title'] ? ctx.fontSize + 26 : 14) - VS.measureText('100%', lf) - 14;
      var per = plotW / names.length - 8;
      var longestWord = 0;
      names.forEach(function (n) { String(n).split(/\s+/).forEach(function (w) { longestWord = Math.max(longestWord, VS.measureText(w, lf)); }); });
      if ((s['xAxis.rotate'] || 'auto') === 'auto') {
        if (longestWord <= per) {
          var wrapped = {};
          names.forEach(function (n) { wrapped[n] = VS.wrapText(String(n), lf, per).slice(0, 4).join('\n'); });
          delete xAxis.axisLabel.rotate;
          delete xAxis.axisLabel.width;
          xAxis.axisLabel.interval = 0;
          xAxis.axisLabel.hideOverlap = false;
          xAxis.axisLabel.lineHeight = ctx.fontSize + 3;
          xAxis.axisLabel.formatter = function (v) { return wrapped[v] || v; };
        } else {
          xAxis.axisLabel.rotate = 35;
          xAxis.axisLabel.interval = 0;
          xAxis.axisLabel.hideOverlap = false;
          xAxis.axisLabel.width = Math.min(210, ctx.area.height * 0.55);
          xAxis.axisLabel.overflow = 'truncate';
        }
      }
      var y1 = VS.axis(ctx, 'y', { type: 'value' });
      y1.min = 0;
      y1.max = undefined;
      if (y1.name) {
        y1.nameLocation = 'middle';
        y1.nameGap = Math.ceil(yLabW) + 14;
        y1.nameTextStyle = { color: ctx.theme.muted, fontSize: ctx.fontSize, fontFamily: ctx.font, fontWeight: 'bold' };
      }
      var y2 = {
        type: 'value', min: 0, max: 100, interval: 20, position: 'right', splitLine: { show: false },
        axisLabel: { color: VS.color.mix(lineColor, ctx.theme.text, 0.25), fontFamily: ctx.font, fontSize: ctx.fontSize, formatter: '{value}%' },
        axisLine: { show: false }, axisTick: { show: false },
      };
      return {
        series: [bars, line, thresholds],
        xAxis: xAxis,
        yAxis: [y1, y2],
        grid: Object.assign(VS.grid(ctx, { top: abc ? ctx.fontSize + 16 : 8 }), { outerBoundsClampHeight: '45%' }),
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: function (ps) {
            var p = (Array.isArray(ps) ? ps : [ps])[0];
            var x = items[p.dataIndex];
            if (!x) return '';
            var rows = [
              { name: V.name, value: ctx.fmt(x.value), color: colorOf(x) },
              { name: 'Доля', value: ctx.fmt(x.share, { noAffix: true, noCompact: true, decimals: 1 }) + '%' },
              { name: 'Накопленная доля', value: ctx.fmt(x.cum, { noAffix: true, noCompact: true, decimals: 1 }) + '%', color: lineColor },
            ];
            if (abc) rows.push({ name: 'Группа', value: x.cls });
            if (x.other) rows.push({ name: 'Объединено категорий', value: String(x.other) });
            return VS.tooltipHtml(ctx, x.name, rows);
          },
        },
      };
    },
  });
})(window.VS);

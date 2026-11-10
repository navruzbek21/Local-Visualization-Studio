(function (VS) {
  'use strict';

  // Квантиль отсортированного массива (линейная интерполяция) — из ядра
  var quantile = VS.math.quantile;

  VS.registerTemplate({
    id: 'histogram',
    order: 7,
    name: 'Вероятностная оценка (P90/P50/P10)',
    category: 'Разработка месторождений',
    description: 'Гистограмма реализаций (Монте-Карло, многовариантные модели) с кривой вероятности превышения и отметками P90, P50, P10.',
    icon: '<svg viewBox="0 0 48 36"><g fill="var(--c1)" opacity=".75"><rect x="5" y="27" width="5" height="5"/><rect x="11" y="20" width="5" height="12"/><rect x="17" y="11" width="5" height="21"/><rect x="23" y="8" width="5" height="24"/><rect x="29" y="15" width="5" height="17"/><rect x="35" y="23" width="5" height="9"/></g><path d="M4 5 C 16 5, 20 8, 25 18 S 36 31, 44 31" fill="none" stroke="var(--c2)" stroke-width="2"/><g stroke="currentColor" stroke-dasharray="2 2" stroke-opacity=".6"><line x1="15" y1="2" x2="15" y2="34"/><line x1="25" y1="2" x2="25" y2="34"/><line x1="35" y1="2" x2="35" y2="34"/></g></svg>',
    bindings: [
      { key: 'value', name: 'Значения (реализации)', dataType: 'number', match: [/(запас|stoiip|ooip|нгз|низ|npv|eur|реализ|value)/i] },
      { key: 'filter', name: 'Фильтр (объект, сценарий)', optional: true },
    ],
    common: ['layout', 'legend', 'tooltip', 'number', 'animation', 'appearance', 'filter'],
    sections: [
      {
        id: 'hist',
        title: 'Распределение',
        items: [
          { key: 'hist.bins', label: 'Число интервалов', type: 'range', min: 0, max: 80, default: 0, help: '0 — автоматически (правило Фридмана–Диакониса)' },
          { key: 'hist.yMode', label: 'Высота столбцов', type: 'radio', options: [['pct', 'Доля, %'], ['count', 'Количество']], default: 'pct' },
          { key: 'hist.curve', label: 'Кривая', type: 'select', options: [['exceed', 'Вероятность превышения (S-кривая)'], ['cdf', 'Накопленная вероятность'], ['none', 'Нет']], default: 'exceed' },
          { key: 'hist.convention', label: 'Обозначения', type: 'radio', options: [['petro', 'Нефтегазовые (P90 — низкая)'], ['stat', 'Статистические (P10 — низкая)']], default: 'petro', help: 'В оценке запасов P90 — значение, превышаемое с вероятностью 90%' },
          { key: 'hist.marks', label: 'Отметки P90 / P50 / P10', type: 'toggle', default: true },
          { key: 'hist.mean', label: 'Отметка среднего', type: 'toggle', default: true },
          { key: 'hist.color', label: 'Цвет столбцов', type: 'color', default: '#2a78d6' },
          { key: 'hist.curveColor', label: 'Цвет кривой', type: 'color', default: '#eb6834' },
          { key: 'xAxis.title', label: 'Название оси значений', type: 'text', default: '' },
        ],
      },
    ],
    sample: {
      data: (function () {
        // Объёмный метод: НГЗ = F · h · Кп · Кн · θ / b, параметры — случайные величины
        var rows = [['Реализация', 'НГЗ, млн т']];
        var seed = 17;
        var u = function () { seed = (seed * 9301 + 49297) % 233280; return (seed + 0.5) / 233281; };
        var normal = function (m, sd) { return m + sd * Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); };
        var tri = function (a, m, b) { var x = u(), f = (m - a) / (b - a); return x < f ? a + Math.sqrt(x * (b - a) * (m - a)) : b - Math.sqrt((1 - x) * (b - a) * (b - m)); };
        for (var i = 1; i <= 1500; i++) {
          var area = tri(28, 36, 52) * 1e6;       // м²
          var h = Math.max(2, normal(9.5, 1.6));   // м
          var kp = Math.max(0.1, normal(0.19, 0.02));
          var kn = tri(0.55, 0.68, 0.78);
          var ooip = (area * h * kp * kn * 0.86) / 1.18 / 1e6; // млн т (плотность 0,86, объёмный коэф. 1,18)
          rows.push([String(i), ooip.toFixed(2)]);
        }
        return rows;
      })(),
      bindings: { value: 1 },
      settings: { title: 'Вероятностная оценка геологических запасов нефти', subtitle: 'Объёмный метод, 1 500 реализаций Монте-Карло', footer: 'Источник: демонстрационные данные', 'xAxis.title': 'НГЗ, млн т' },
    },
    legendNames: function (ctx) {
      var n = ['Распределение'];
      if (ctx.s['hist.curve'] !== 'none') n.push(ctx.s['hist.curve'] === 'cdf' ? 'Накопленная вероятность' : 'Вероятность превышения');
      return n;
    },
    build: function (ctx) {
      var s = ctx.s;
      var V = ctx.column('value');
      if (!V) return VS.empty(ctx, 'Привяжите колонку со значениями');
      var vals = V.num.filter(function (v) { return v !== null; }).sort(function (a, b) { return a - b; });
      if (vals.length < 5) return VS.empty(ctx, 'Нужно хотя бы 5 значений');
      var n = vals.length;
      var mn = vals[0], mx = vals[n - 1];
      var bins = Number(s['hist.bins']) || 0;
      if (!bins) {
        var iqr = quantile(vals, 0.75) - quantile(vals, 0.25);
        var h = iqr > 0 ? 2 * iqr / Math.cbrt(n) : (mx - mn) / 10;
        bins = Math.max(5, Math.min(60, Math.round((mx - mn) / (h || 1))));
      }
      var w = (mx - mn) / bins || 1;
      var counts = new Array(bins).fill(0);
      vals.forEach(function (v) { counts[Math.min(bins - 1, Math.floor((v - mn) / w))]++; });
      var pct = s['hist.yMode'] === 'pct';
      var color = s['hist.color'], cColor = s['hist.curveColor'];
      var series = [{
        type: 'bar', name: 'Распределение', barWidth: '96%', color: color,
        data: counts.map(function (c, i) {
          return { value: [mn + (i + 0.5) * w, pct ? (c / n) * 100 : c], range: [mn + i * w, mn + (i + 1) * w], count: c };
        }),
        itemStyle: { color: VS.color.alpha(color, 0.75), borderRadius: [2, 2, 0, 0] },
      }];
      var curve = s['hist.curve'];
      if (curve !== 'none') {
        var pts = [];
        var steps = 120;
        for (var k = 0; k <= steps; k++) {
          var x = mn + ((mx - mn) * k) / steps;
          // доля значений ≤ x
          var lo = 0, hi = n;
          while (lo < hi) { var mid = (lo + hi) >> 1; if (vals[mid] <= x) lo = mid + 1; else hi = mid; }
          var cdf = (lo / n) * 100;
          pts.push([x, curve === 'cdf' ? cdf : 100 - cdf]);
        }
        series.push({ type: 'line', name: curve === 'cdf' ? 'Накопленная вероятность' : 'Вероятность превышения', yAxisIndex: 1, data: pts, showSymbol: false, smooth: true, color: cColor, lineStyle: { width: 2.2, color: cColor }, z: 4 });
      }
      var petro = s['hist.convention'] !== 'stat';
      var marks = [];
      if (s['hist.marks']) {
        [[0.1, 'P90', 'P10'], [0.5, 'P50', 'P50'], [0.9, 'P10', 'P90']].forEach(function (q) {
          marks.push({ xAxis: quantile(vals, q[0]), name: petro ? q[1] : q[2] });
        });
      }
      var mean = vals.reduce(function (a, v) { return a + v; }, 0) / n;
      // подпись среднего — посередине линии, чтобы не накладывалась на P50
      if (s['hist.mean']) marks.push({ xAxis: mean, name: 'Среднее', lineStyle: { type: 'dotted', color: ctx.theme.muted }, label: { position: 'insideMiddleTop', fontWeight: 'normal', color: ctx.theme.muted, formatter: function (p) { return 'Среднее ' + ctx.fmt(p.value); } } });
      if (marks.length) {
        series[0].markLine = {
          silent: true, symbol: 'none', animation: false,
          lineStyle: { color: ctx.theme.text, type: 'dashed', width: 1.2 },
          label: {
            position: 'end', color: ctx.theme.text, fontFamily: ctx.font, fontSize: ctx.fontSize - 1, fontWeight: 'bold',
            formatter: function (p) { return p.name + '\n' + ctx.fmt(p.value); }, lineHeight: ctx.fontSize + 3,
          },
          data: marks,
        };
      }
      var xAxis = VS.axis(ctx, 'x', { type: 'value' });
      xAxis.min = mn - w * 0.6;
      xAxis.max = mx + w * 0.6;
      xAxis.axisLine.show = true;
      xAxis.scale = true;
      xAxis.axisLabel.showMinLabel = false;
      xAxis.axisLabel.showMaxLabel = false;
      var yAxis = [VS.axis(ctx, 'y', { type: 'value' })];
      yAxis[0].min = undefined;
      yAxis[0].max = undefined;
      yAxis[0].name = pct ? 'доля, %' : 'количество';
      yAxis[0].nameLocation = 'end';
      yAxis[0].nameGap = 10;
      yAxis[0].nameTextStyle = { color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 1, align: 'left' };
      yAxis[0].axisLabel.formatter = function (v) { return ctx.fmt(v, { noAffix: true, noCompact: true }); };
      if (curve !== 'none') {
        yAxis.push({
          type: 'value', min: 0, max: 100, position: 'right', splitLine: { show: false },
          axisLabel: { color: cColor, fontFamily: ctx.font, fontSize: ctx.fontSize, formatter: '{value}%' },
          axisLine: { show: false }, axisTick: { show: false },
        });
      }
      return {
        series: series, xAxis: xAxis, yAxis: yAxis, grid: VS.grid(ctx, { top: 34 }),
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            if (p.seriesType === 'bar') {
              var d = p.data;
              return VS.tooltipHtml(ctx, ctx.fmt(d.range[0]) + ' – ' + ctx.fmt(d.range[1]), [
                { name: 'Реализаций', value: ctx.fmt(d.count, { noAffix: true, decimals: 0 }), color: p.color },
                { name: 'Доля', value: ctx.fmt((d.count / n) * 100, { noAffix: true, noCompact: true, decimals: 1 }) + '%' },
              ]);
            }
            return VS.tooltipHtml(ctx, ctx.fmt(p.value[0]), [{ name: p.seriesName, value: ctx.fmt(p.value[1], { noAffix: true, noCompact: true, decimals: 1 }) + '%', color: p.color }]);
          },
        },
      };
    },
  });
})(window.VS);

(function (VS) {
  'use strict';

  var RE = VS.petroPatterns || {};
  var DAY = 86400000;
  var YEAR = 365.25;

  // ------------------------------------------------------------------ модели Арпса
  // q(t) = qi / (1 + b·D·t)^(1/b);  b = 0 — экспоненциальная, b = 1 — гармоническая. t — сутки, D — 1/сут.
  function rate(m, t) {
    if (m.b === 0) return m.qi * Math.exp(-m.D * t);
    return m.qi / Math.pow(1 + m.b * m.D * t, 1 / m.b);
  }
  // накопленная добыча от 0 до t (в единицах дебит × сутки)
  function cumulative(m, t) {
    var q = rate(m, t);
    if (m.b === 0) return (m.qi - q) / m.D;
    if (Math.abs(m.b - 1) < 1e-9) return (m.qi / m.D) * Math.log(m.qi / q);
    return (Math.pow(m.qi, m.b) / ((1 - m.b) * m.D)) * (Math.pow(m.qi, 1 - m.b) - Math.pow(q, 1 - m.b));
  }
  function linreg(xs, ys) {
    var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    var d = n * sxx - sx * sx;
    if (!d) return null;
    var k = (n * sxy - sx * sy) / d;
    return { k: k, c: (sy - k * sx) / n };
  }
  // Подбор параметров: для фиксированного b зависимость q^(-b) от t линейна; выбираем b по ошибке в логарифмах
  function fit(ts, qs, model) {
    var lnq = qs.map(Math.log);
    var mean = lnq.reduce(function (a, v) { return a + v; }, 0) / lnq.length;
    var sst = lnq.reduce(function (a, v) { return a + (v - mean) * (v - mean); }, 0) || 1;
    var bs = model === 'exponential' ? [0] : model === 'harmonic' ? [1] : model === 'hyperbolic' ? grid(0.05, 1.5) : [0].concat(grid(0.05, 1.5));
    var best = null;
    bs.forEach(function (b) {
      var m;
      if (b === 0) {
        var r = linreg(ts, lnq);
        if (!r || r.k >= 0) return;
        m = { b: 0, qi: Math.exp(r.c), D: -r.k };
      } else {
        var r2 = linreg(ts, qs.map(function (q) { return Math.pow(q, -b); }));
        if (!r2 || r2.c <= 0 || r2.k <= 0) return;
        m = { b: b, qi: Math.pow(r2.c, -1 / b), D: r2.k / (r2.c * b) };
      }
      var sse = 0;
      for (var i = 0; i < ts.length; i++) {
        var e = lnq[i] - Math.log(rate(m, ts[i]));
        sse += e * e;
      }
      m.r2 = 1 - sse / sst;
      m.sse = sse;
      if (!best || sse < best.sse) best = m;
    });
    return best;
  }
  function grid(a, b) {
    var out = [];
    for (var v = a; v <= b + 1e-9; v += 0.05) out.push(Math.round(v * 100) / 100);
    return out;
  }
  VS.arps = { rate: rate, cumulative: cumulative, fit: fit };

  VS.registerTemplate({
    id: 'dca',
    order: 2,
    name: 'Анализ падения добычи',
    category: 'Разработка месторождений',
    description: 'Кривая Арпса (экспоненциальная, гиперболическая, гармоническая): подбор параметров, прогноз, извлекаемые запасы.',
    icon: '<svg viewBox="0 0 48 36"><g fill="#7a4a1e"><circle cx="6" cy="8" r="1.6"/><circle cx="10" cy="11" r="1.6"/><circle cx="14" cy="13" r="1.6"/><circle cx="18" cy="16" r="1.6"/><circle cx="22" cy="17" r="1.6"/><circle cx="26" cy="20" r="1.6"/></g><path d="M5 8 C 14 14, 20 18, 27 20" fill="none" stroke="var(--c1)" stroke-width="2"/><path d="M27 20 C 33 22, 38 24, 44 25" fill="none" stroke="var(--c2)" stroke-width="2" stroke-dasharray="3 2"/><line x1="4" y1="29" x2="44" y2="29" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="2 2"/></svg>',
    bindings: [
      { key: 'date', name: 'Дата', dataType: 'any', match: RE.date },
      { key: 'rate', name: 'Дебит / добыча', dataType: 'number', match: RE.oil, description: 'Нефть (или газ) по периодам' },
      { key: 'filter', name: 'Скважина', optional: true, match: RE.well },
    ],
    defaults: { 'legend.show': true },
    common: ['layout', 'legend', 'tooltip', 'number', 'animation', 'appearance', 'filter'],
    sections: [
      {
        id: 'dca',
        title: 'Анализ падения',
        items: [
          { key: 'dca.model', label: 'Модель', type: 'select', options: [['auto', 'Автоподбор (лучшая)'], ['exponential', 'Экспоненциальная (b = 0)'], ['hyperbolic', 'Гиперболическая (0 < b ≤ 1,5)'], ['harmonic', 'Гармоническая (b = 1)']], default: 'auto' },
          { key: 'dca.input', label: 'Данные в колонке', type: 'radio', options: [['rate', 'Дебит в сутки'], ['volume', 'Объём за период']], default: 'rate' },
          { key: 'dca.from', label: 'Аппроксимировать с даты', type: 'text', default: '', placeholder: 'авто — от максимума дебита', help: 'Формат 2015-01 или 01.01.2015' },
          { key: 'dca.to', label: 'по дату', type: 'text', default: '', placeholder: 'до последней' },
          { key: 'dca.years', label: 'Горизонт прогноза, лет', type: 'range', min: 0, max: 50, default: 10 },
          { key: 'dca.qlim', label: 'Экономический предел дебита', type: 'text', default: '', placeholder: 'например, 5', help: 'Прогноз останавливается при достижении' },
          { key: 'dca.log', label: 'Логарифмическая шкала дебита', type: 'toggle', default: true },
          { key: 'dca.params', label: 'Показывать параметры модели', type: 'toggle', default: true },
          { key: 'dca.unit', label: 'Единицы дебита', type: 'text', default: 'м³/сут' },
          { key: 'dca.cumDiv', label: 'Запасы показывать в', type: 'select', options: [['1', 'исходных единицах'], ['1000', 'тысячах'], ['1000000', 'миллионах']], default: '1000' },
          { key: 'dca.cumUnit', label: 'Единицы запасов', type: 'text', default: 'тыс. м³' },
          { type: 'heading', label: 'Цвета' },
          { key: 'dca.histColor', label: 'Фактические данные', type: 'color', default: '#7a4a1e' },
          { key: 'dca.fitColor', label: 'Аппроксимация', type: 'color', default: '#2a78d6' },
          { key: 'dca.fcColor', label: 'Прогноз', type: 'color', default: '#eb6834' },
        ],
      },
    ],
    sample: {
      data: (function () {
        var rows = [['Дата', 'Дебит нефти, м³/сут']];
        var seed = 11;
        for (var m = 0; m < 84; m++) {
          seed = (seed * 9301 + 49297) % 233280;
          var y = 2018 + Math.floor(m / 12), mo = m % 12 + 1;
          var t = m * 30.44;
          var q = m < 4 ? 180 + 70 * m : 420 / Math.pow(1 + 0.55 * 0.0021 * (t - 120), 1 / 0.55);
          q *= 0.94 + 0.12 * (seed / 233280);
          rows.push([y + '-' + (mo < 10 ? '0' : '') + mo, q.toFixed(1)]);
        }
        return rows;
      })(),
      bindings: { date: 0, rate: 1 },
      settings: { title: 'Анализ падения дебита скв. 1024', subtitle: 'Аппроксимация кривой Арпса и прогноз добычи нефти', footer: 'Источник: демонстрационные данные', 'dca.qlim': '15' },
    },
    legendKind: 'line',
    legendNames: function () { return ['Факт', 'Аппроксимация', 'Прогноз']; },
    tooltip: function (ctx) {
      return { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: ctx.theme.axis, type: 'dashed' } } };
    },
    build: function (ctx) {
      var s = ctx.s;
      var D = ctx.column('date'), R = ctx.column('rate');
      if (!D || !R) return VS.empty(ctx, 'Привяжите колонки «Дата» и «Дебит / добыча»');
      var agg = VS.aggregate(ctx, D, { q: { col: R } });
      if (!agg.dates) return VS.empty(ctx, 'Для анализа падения нужны даты (например, 2015-03 или 01.03.2015)');
      var dates = agg.dates;
      var volume = s['dca.input'] === 'volume';
      var t0 = dates[0].getTime();
      var hist = agg.values.q.map(function (v, i) {
        return { t: (dates[i].getTime() - t0) / DAY, date: dates[i], q: v === null ? null : volume ? v / VS.periodDays(dates, i) : v, vol: v === null ? 0 : volume ? v : v * VS.periodDays(dates, i) };
      });
      var valid = hist.filter(function (h) { return h.q > 0; });
      if (valid.length < 3) return VS.empty(ctx, 'Недостаточно точек с положительным дебитом');

      // окно аппроксимации
      var from = VS.parseDate(s['dca.from']);
      var to = VS.parseDate(s['dca.to']);
      if (!from) {
        var peak = valid.reduce(function (b, h) { return h.q > b.q ? h : b; }, valid[0]);
        from = peak.date;
      }
      var win = valid.filter(function (h) { return h.date >= from && (!to || h.date <= to); });
      if (win.length < 3) return VS.empty(ctx, 'В окне аппроксимации меньше трёх точек — измените даты');
      var tStart = win[0].t;
      var m = VS.arps.fit(win.map(function (h) { return h.t - tStart; }), win.map(function (h) { return h.q; }), s['dca.model']);
      if (!m) return VS.empty(ctx, 'Дебит в выбранном окне не снижается — модель падения неприменима');

      // прогноз
      var last = hist[hist.length - 1];
      var qlim = VS.parseNumber(s['dca.qlim']) || 0;
      var horizon = (Number(s['dca.years']) || 0) * YEAR;
      var fc = [];
      var tEnd = last.t;
      for (var t = last.t; t <= last.t + horizon + 0.1; t += 30.4375) {
        var q = VS.arps.rate(m, t - tStart);
        if (qlim && q < qlim) break;
        fc.push([t0 + t * DAY, q]);
        tEnd = t;
      }
      var cumHist = hist.reduce(function (a, h) { return a + h.vol; }, 0);
      var cumFc = fc.length ? VS.arps.cumulative(m, tEnd - tStart) - VS.arps.cumulative(m, last.t - tStart) : 0;
      var div = Number(s['dca.cumDiv']) || 1;
      var unit = s['dca.unit'] || '';
      var cumUnit = s['dca.cumUnit'] || '';
      var inWin = function (h) { return h.date >= win[0].date && h.date <= win[win.length - 1].date; };

      var histColor = s['dca.histColor'], fitColor = s['dca.fitColor'], fcColor = s['dca.fcColor'];
      var fitLine = [];
      for (var k = 0; k <= 60; k++) {
        var tt = tStart + ((win[win.length - 1].t - tStart) * k) / 60;
        fitLine.push([t0 + tt * DAY, VS.arps.rate(m, tt - tStart)]);
      }
      var vf = function (v) { return v === null || v === undefined || v === '-' ? '—' : ctx.fmt(v) + (unit ? ' ' + unit : ''); };
      var series = [
        {
          type: 'scatter', name: 'Факт', symbolSize: 6,
          data: hist.filter(function (h) { return h.q > 0; }).map(function (h) {
            return { value: [h.date.getTime(), h.q], itemStyle: { color: histColor, opacity: inWin(h) ? 0.95 : 0.35 } };
          }),
          itemStyle: { color: histColor },
          tooltip: { valueFormatter: vf },
          z: 3,
        },
        {
          type: 'line', name: 'Аппроксимация', data: fitLine, showSymbol: false, smooth: false, color: fitColor,
          lineStyle: { width: 2.4, color: fitColor }, tooltip: { valueFormatter: vf }, z: 4,
          markArea: {
            silent: true,
            itemStyle: { color: VS.color.alpha(fitColor, 0.06) },
            data: [[{ xAxis: win[0].date.getTime() }, { xAxis: win[win.length - 1].date.getTime() }]],
          },
        },
        {
          type: 'line', name: 'Прогноз', data: fc, showSymbol: false, color: fcColor,
          lineStyle: { width: 2.2, type: 'dashed', color: fcColor }, tooltip: { valueFormatter: vf }, z: 4,
          markLine: qlim ? {
            silent: true, symbol: 'none',
            lineStyle: { color: ctx.theme.muted, type: 'dotted' },
            label: { formatter: 'Экон. предел ' + ctx.fmt(qlim), position: 'insideStartTop', color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 1 },
            data: [{ yAxis: qlim }],
          } : undefined,
        },
      ];

      var xAxis = VS.axis(ctx, 'x', { type: 'time' });
      xAxis.axisLine.show = true;
      VS.timeAxis(xAxis, (fc.length ? fc[fc.length - 1][0] : dates[dates.length - 1].getTime()) - dates[0].getTime());
      var yAxis = VS.axis(ctx, 'y', { type: s['dca.log'] ? 'log' : 'value' });
      if (s['dca.log']) {
        yAxis.type = 'log';
        yAxis.logBase = 10;
        yAxis.min = function (v) { return Math.pow(10, Math.floor(Math.log10(Math.max(v.min, qlim || v.min) * 0.8))); };
        yAxis.max = function (v) { return Math.pow(10, Math.ceil(Math.log10(v.max * 1.05))); };
        yAxis.minorSplitLine = { show: true, lineStyle: { color: VS.color.mix(ctx.theme.grid, ctx.theme.background, 0.5) } };
        yAxis.minorTick = { show: false, splitNumber: 9 };
      }
      if (!yAxis.name) {
        yAxis.name = unit;
        yAxis.nameLocation = 'end';
        yAxis.nameGap = 10;
        yAxis.nameTextStyle = { color: ctx.theme.muted, fontSize: ctx.fontSize - 1, fontFamily: ctx.font, align: 'left' };
      }
      var out = { series: series, xAxis: xAxis, yAxis: yAxis, grid: VS.grid(ctx, { top: 18 }) };

      if (s['dca.params']) {
        var names = { 0: 'экспоненциальная', 1: 'гармоническая' };
        var lines = [
          'Модель: ' + (names[m.b] || 'гиперболическая') + (m.b !== 0 && m.b !== 1 ? ', b = ' + ctx.fmt(m.b, { decimals: 2, noAffix: true, noCompact: true }) : ''),
          'qi = ' + ctx.fmt(m.qi, { noAffix: true }) + ' ' + unit + ' (на ' + win[0].date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) + ')',
          'Di = ' + ctx.fmt(m.D * YEAR * 100, { decimals: 1, noAffix: true, noCompact: true }) + ' %/год (номинальный)',
          'R² = ' + ctx.fmt(m.r2, { decimals: 3, noAffix: true, noCompact: true }) + ' · точек: ' + win.length,
          'Добыто: ' + ctx.fmt(cumHist / div, { noAffix: true }) + ' ' + cumUnit,
          'Прогноз добычи: ' + ctx.fmt(cumFc / div, { noAffix: true }) + ' ' + cumUnit,
          'Извлекаемые (EUR): ' + ctx.fmt((cumHist + cumFc) / div, { noAffix: true }) + ' ' + cumUnit,
        ];
        if (fc.length) lines.push('Конец прогноза: ' + new Date(fc[fc.length - 1][0]).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }));
        out.graphic = [{
          type: 'text', right: ctx.area.right + 12, top: ctx.area.top + 26, z: 10, silent: true,
          style: {
            text: lines.join('\n'), font: (ctx.fontSize) + 'px ' + ctx.font, fill: ctx.theme.text, lineHeight: ctx.fontSize + 6,
            backgroundColor: VS.color.alpha(ctx.theme.background, 0.92), borderColor: ctx.theme.grid, borderWidth: 1, borderRadius: 6, padding: [8, 10],
          },
        }];
      }
      ctx.dca = { model: m, cumHist: cumHist, cumForecast: cumFc };
      return out;
    },
  });
})(window.VS);

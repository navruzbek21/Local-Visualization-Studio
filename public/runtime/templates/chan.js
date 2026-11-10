(function (VS) {
  'use strict';

  var RE = VS.petroPatterns;
  var DAY = 86400000;

  // Наклон в двойных логарифмических координатах по последним точкам
  function logSlope(pts) {
    var ok = pts.filter(function (p) { return p[0] > 0 && p[1] > 0; });
    if (ok.length < 3) return null;
    var r = VS.math.linreg(ok.map(function (p) { return Math.log10(p[0]); }), ok.map(function (p) { return Math.log10(p[1]); }));
    return r ? r.k : null;
  }

  VS.registerTemplate({
    id: 'chan',
    order: 8,
    name: 'Диагностика обводнения (Чен)',
    category: 'Разработка месторождений',
    description: 'Водонефтяной фактор ВНФ (WOR) и его производная от времени в логарифмических координатах: конус подошвенной воды или прорыв по высокопроницаемому пропластку.',
    icon: '<svg viewBox="0 0 48 36"><g stroke="currentColor" stroke-opacity=".2"><line x1="4" y1="11" x2="44" y2="11"/><line x1="4" y1="22" x2="44" y2="22"/><line x1="17" y1="3" x2="17" y2="32"/><line x1="30" y1="3" x2="30" y2="32"/></g><g fill="var(--c1)"><circle cx="12" cy="27" r="1.6"/><circle cx="17" cy="23" r="1.6"/><circle cx="22" cy="19" r="1.6"/><circle cx="27" cy="15" r="1.6"/><circle cx="32" cy="12" r="1.6"/><circle cx="37" cy="8" r="1.6"/><circle cx="42" cy="5" r="1.6"/></g><g fill="var(--c2)"><circle cx="14" cy="31" r="1.6"/><circle cx="20" cy="27" r="1.6"/><circle cx="26" cy="22" r="1.6"/><circle cx="32" cy="17" r="1.6"/><circle cx="38" cy="12" r="1.6"/></g><line x1="4" y1="33" x2="44" y2="33" stroke="currentColor" stroke-opacity=".5"/></svg>',
    bindings: [
      { key: 'date', name: 'Дата / период', dataType: 'any', match: RE.date },
      { key: 'oil', name: 'Нефть', dataType: 'number', match: RE.oil, description: 'Дебит или добыча за период' },
      { key: 'water', name: 'Вода', dataType: 'number', optional: true, match: RE.water },
      { key: 'liquid', name: 'Жидкость', dataType: 'number', optional: true, match: RE.liquid, description: 'Если нет воды: вода = жидкость − нефть' },
      { key: 'wc', name: 'Обводнённость', dataType: 'number', optional: true, match: RE.wc, description: 'Если нет ни воды, ни жидкости: ВНФ = обв. / (1 − обв.)' },
      { key: 'filter', name: 'Скважина', optional: true, match: RE.well, description: 'Диагностика строится по одной скважине' },
    ],
    common: ['layout', 'legend', 'tooltip', 'number', 'animation', 'appearance', 'filter'],
    sections: [
      {
        id: 'chan',
        title: 'Диагностика по Чену',
        items: [
          { key: 'chan.derivative', label: 'Производная ВНФ′', type: 'toggle', default: true },
          { key: 'chan.smooth', label: 'Сглаживание производной, точек', type: 'range', min: 1, max: 8, default: 2, help: 'Производная берётся по скользящему окну ±N точек: больше — глаже, но меньше деталей' },
          { key: 'chan.from', label: 'Начало участка для наклона, сут', type: 'text', default: '', placeholder: 'авто', help: 'Наклон ВНФ и ВНФ′ в логарифмических координатах. Пусто — вторая половина периода после прорыва (по логарифму времени)' },
          { key: 'chan.hint', label: 'Подсказка по интерпретации', type: 'toggle', default: true },
          { key: 'chan.breakthrough', label: 'Отметка прорыва воды', type: 'toggle', default: true },
          { key: 'chan.worColor', label: 'Цвет ВНФ', type: 'color', default: '#2a78d6' },
          { key: 'chan.derColor', label: 'Цвет ВНФ′', type: 'color', default: '#eb6834' },
        ],
      },
    ],
    defaults: { 'filter.all': false },
    sample: {
      data: (function () {
        // две скважины с разными механизмами обводнения
        var rows = [['Скважина', 'Дата', 'Дебит нефти, м³/сут', 'Дебит воды, м³/сут']];
        var seed = 5;
        var u = function () { seed = (seed * 9301 + 49297) % 233280; return (seed + 0.5) / 233281 - 0.5; };
        var pw = function (x, p) { return x > 0 ? Math.pow(x, p) : 0; };
        [
          // многопластовый прорыв: ВНФ растёт ступенями, ВНФ′ — с положительным наклоном
          ['Скв. 315', function (t) { return 0.012 * pw((t - 420) / 30, 1.7) + 0.02 * pw((t - 1500) / 30, 1.8); }, 165],
          // конус подошвенной воды: быстрый рост после прорыва, затем выполаживание; ВНФ′ снижается
          ['Скв. 427', function (t) { return t < 150 ? 0 : 1.6 * (1 - Math.exp(-(t - 150) / 420)) + 0.0006 * (t - 150); }, 120],
        ].forEach(function (w) {
          for (var m = 0; m < 108; m++) {
            var y = 2016 + Math.floor(m / 12), mo = m % 12 + 1;
            var t = m * 30.44 + 30.44;
            var wor = w[1](t) * (1 + u() * 0.06);
            var liq = w[2] * (1 - m / 400) * (1 + u() * 0.04);
            var oil = liq / (1 + wor);
            rows.push([w[0], y + '-' + (mo < 10 ? '0' : '') + mo, oil.toFixed(2), (liq - oil).toFixed(2)]);
          }
        });
        return rows;
      })(),
      bindings: { filter: 0, date: 1, oil: 2, water: 3 },
      settings: {
        title: 'Диагностика обводнения по Чену',
        subtitle: 'Водонефтяной фактор и его производная, логарифмические шкалы',
        footer: 'Источник: демонстрационные данные. Метод: K. S. Chan, SPE 30775 (1995)',
        'filter.control': 'buttons',
      },
    },
    legendNames: function (ctx) {
      return ctx.s['chan.derivative'] === false ? null : ['ВНФ (WOR)', 'Производная ВНФ′'];
    },
    build: function (ctx) {
      var s = ctx.s;
      var D = ctx.column('date'), O = ctx.column('oil');
      var Wt = ctx.column('water'), L = ctx.column('liquid'), WC = ctx.column('wc');
      if (!D || !O || !(Wt || L || WC)) return VS.empty(ctx, 'Привяжите дату, нефть и одну из колонок: вода, жидкость или обводнённость');
      var agg = VS.aggregate(ctx, D, { oil: { col: O }, water: { col: Wt }, liquid: { col: L }, wc: { col: WC, how: 'avg' } });
      if (!agg.dates) return VS.empty(ctx, 'Колонка «Дата» должна содержать даты');
      var dates = agg.dates;
      var wcFrac = agg.values.wc && VS.stats(agg.values.wc).max <= 1.0001;
      var t0 = dates[0].getTime();
      var pts = [];
      agg.keys.forEach(function (_, i) {
        var o = agg.values.oil[i];
        if (o === null || o <= 0) return;
        var w = null;
        if (agg.values.water && agg.values.water[i] !== null) w = agg.values.water[i];
        else if (agg.values.liquid && agg.values.liquid[i] !== null) w = Math.max(0, agg.values.liquid[i] - o);
        else if (agg.values.wc && agg.values.wc[i] !== null) {
          var f = wcFrac ? agg.values.wc[i] : agg.values.wc[i] / 100;
          if (f < 1) return pts.push({ i: i, t: (dates[i] - t0) / DAY + VS.periodDays(dates, i), wor: f / (1 - f), o: o, w: null });
          return;
        }
        if (w === null) return;
        pts.push({ i: i, t: (dates[i] - t0) / DAY + VS.periodDays(dates, i), wor: w / o, o: o, w: w });
      });
      if (pts.length < 3) return VS.empty(ctx, 'Мало точек с добычей нефти');

      // производная ВНФ по времени — линейная регрессия в скользящем окне
      var k = Math.max(1, Number(s['chan.smooth']) || 2);
      pts.forEach(function (p, j) {
        var lo = Math.max(0, j - k), hi = Math.min(pts.length - 1, j + k);
        var win = pts.slice(lo, hi + 1);
        var r = VS.math.linreg(win.map(function (q) { return q.t; }), win.map(function (q) { return q.wor; }));
        p.der = r ? r.k : null;
      });
      var worPts = pts.filter(function (p) { return p.wor > 0; });
      if (!worPts.length) return VS.empty(ctx, 'Вода в продукции не появлялась — ВНФ равен нулю');
      var derPts = pts.filter(function (p) { return p.der !== null && p.der > 0 && p.wor > 0; });
      // прорыв воды — первая точка с обводнённостью от 2 % (ВНФ ≥ 0,0204); единичные следы воды при освоении не в счёт
      var bt = worPts.filter(function (p) { return p.wor >= 0.0204; })[0] || worPts[0];
      var showDer = s['chan.derivative'] !== false;
      var cW = s['chan.worColor'] || ctx.palette[0];
      var cD = s['chan.derColor'] || ctx.palette[1];
      var dfmt = function (i) { return dates[i].toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }); };
      var sig = function (v) { return VS.math.formatSig(v, 3, s['number.decimal'] !== 'dot'); };

      var series = [{
        type: 'scatter', name: 'ВНФ (WOR)', color: cW, symbolSize: 7,
        data: worPts.map(function (p) { return { value: [p.t, p.wor], p: p }; }),
        itemStyle: { color: cW, borderColor: ctx.theme.background, borderWidth: 0.8 },
      }];
      if (showDer) {
        series.push({
          type: 'scatter', name: 'Производная ВНФ′', color: cD, symbol: 'triangle', symbolSize: 7,
          data: derPts.map(function (p) { return { value: [p.t, p.der], p: p }; }),
          itemStyle: { color: cD, borderColor: ctx.theme.background, borderWidth: 0.8 },
        });
      }
      if (s['chan.breakthrough'] !== false) {
        series[0].markLine = {
          silent: true, symbol: 'none', animation: false,
          lineStyle: { color: ctx.theme.muted, type: [3, 3], width: 1 },
          label: { formatter: 'Прорыв воды (обв. ≥ 2 %): ' + dfmt(bt.i), position: 'insideStartTop', color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 1 },
          data: [{ xAxis: bt.t }],
        };
      }

      // наклоны на последнем участке и подсказка
      var tEnd = worPts[worPts.length - 1].t;
      var tFrom = VS.parseNumber(s['chan.from']);
      if (tFrom === null || tFrom >= tEnd) tFrom = Math.sqrt(bt.t * tEnd);
      var lastW = worPts.filter(function (p) { return p.t >= tFrom; });
      if (lastW.length < 3) lastW = worPts.slice(-3);
      var lastD = derPts.filter(function (p) { return p.t >= lastW[0].t; });
      var sW = logSlope(lastW.map(function (p) { return [p.t, p.wor]; }));
      var sD = logSlope(lastD.map(function (p) { return [p.t, p.der]; }));
      var verdict;
      if (sD === null) verdict = 'Производная не определена: мало точек с растущим ВНФ';
      else if (sD < -0.1) verdict = 'ВНФ′ снижается — признак конуса подошвенной воды';
      else if (sD > 0.3 && sW !== null && sW > 0.5) verdict = 'ВНФ′ растёт — признак прорыва по высокопроницаемому пропластку или каналу (многопластовое обводнение)';
      else verdict = 'ВНФ′ почти постоянна — близко к нормальному вытеснению';
      ctx.chan = { slopeWor: sW, slopeDer: sD, verdict: verdict, points: pts.length, breakthrough: bt.t };

      var xAxis = VS.axis(ctx, 'x', { type: 'value' });
      xAxis.type = 'log';
      xAxis.logBase = 10;
      xAxis.axisLine.show = true;
      xAxis.name = s['xAxis.title'] || 'Время с начала добычи, сут';
      xAxis.nameLocation = 'middle';
      xAxis.nameGap = 28;
      xAxis.nameTextStyle.fontWeight = 'bold';
      xAxis.min = function (v) { return Math.pow(10, Math.floor(Math.log10(v.min))); };
      xAxis.max = function (v) { return Math.pow(10, Math.ceil(Math.log10(v.max))); };
      xAxis.splitLine = { show: true, lineStyle: { color: ctx.theme.grid } };
      xAxis.minorSplitLine = { show: true, lineStyle: { color: VS.color.mix(ctx.theme.grid, ctx.theme.background, 0.55) } };
      xAxis.minorTick = { show: false, splitNumber: 9 };
      var yAxis = VS.axis(ctx, 'y', { type: 'value' });
      yAxis.type = 'log';
      yAxis.logBase = 10;
      yAxis.min = function (v) { return Math.pow(10, Math.floor(Math.log10(v.min))); };
      yAxis.max = function (v) { return Math.pow(10, Math.ceil(Math.log10(v.max))); };
      yAxis.splitLine = { show: true, lineStyle: { color: ctx.theme.grid } };
      yAxis.minorSplitLine = { show: true, lineStyle: { color: VS.color.mix(ctx.theme.grid, ctx.theme.background, 0.55) } };
      yAxis.minorTick = { show: false, splitNumber: 9 };
      yAxis.axisLabel.formatter = function (v) { return sig(v); };
      yAxis.name = 'ВНФ, ВНФ′ (1/сут)';
      yAxis.nameLocation = 'end';
      yAxis.nameGap = 10;
      yAxis.nameTextStyle = { color: ctx.theme.muted, fontSize: ctx.fontSize - 1, fontFamily: ctx.font, align: 'left' };

      // подсказка — над областью построения, чтобы не закрывать точки
      var hint = null, hintH = 0;
      if (s['chan.hint'] !== false) {
        var hf = ctx.fontSize + 'px ' + ctx.font;
        var head = 'Наклон после ' + ctx.fmt(lastW[0].t, { decimals: 0, noAffix: true }) + ' сут (' + lastW.length + ' точек): ВНФ ' + (sW === null ? '—' : sig(sW)) + (showDer ? ', ВНФ′ ' + (sD === null ? '—' : sig(sD)) : '');
        var hl = [head].concat(VS.wrapText(verdict, 'bold ' + hf, ctx.area.width - 30));
        hintH = hl.length * (ctx.fontSize + 6) + 14;
        hint = {
          type: 'text', left: ctx.area.left, top: ctx.area.top, z: 10, silent: true,
          style: {
            text: hl.map(function (t, i) { return i ? '{b|' + t + '}' : t; }).join('\n'), rich: { b: { font: 'bold ' + hf, fill: ctx.theme.text } },
            font: hf, fill: ctx.theme.muted, lineHeight: ctx.fontSize + 6,
            backgroundColor: VS.color.alpha(ctx.theme.grid, 0.35), borderRadius: 6, padding: [7, 10],
          },
        };
      }
      var out = {
        series: series, xAxis: xAxis, yAxis: yAxis, grid: VS.grid(ctx, { top: 20 + (hint ? hintH + 8 : 0) }),
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            var q = p.data && p.data.p;
            if (!q) return '';
            var rows = [
              { name: 'Время', value: ctx.fmt(q.t, { decimals: 0, noAffix: true }) + ' сут' },
              { name: 'ВНФ', value: sig(q.wor), color: cW },
              { name: 'Обводнённость', value: ctx.fmt((q.wor / (1 + q.wor)) * 100, { decimals: 1, noAffix: true, noCompact: true }) + '%' },
            ];
            if (q.der !== null) rows.push({ name: 'ВНФ′, 1/сут', value: sig(q.der), color: cD });
            rows.push({ name: O.name, value: ctx.fmt(q.o) });
            if (q.w !== null) rows.push({ name: 'Вода', value: ctx.fmt(q.w) });
            return VS.tooltipHtml(ctx, dfmt(q.i), rows);
          },
        },
      };
      if (hint) out.graphic = [hint];
      return out;
    },
  });
})(window.VS);

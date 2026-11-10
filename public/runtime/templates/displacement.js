(function (VS) {
  'use strict';

  var RE = VS.petroPatterns;

  // Характеристики вытеснения — интегральные зависимости накопленной добычи нефти от воды/жидкости
  // для прогноза извлекаемых запасов при предельной обводнённости (по методическим рекомендациям РД 153-39.0-110-01).
  var METHODS = {
    sazonov: {
      name: 'Сазонова', formula: 'Qн = a + b·ln Qж', xLabel: 'Накопленная жидкость Qж', yLabel: 'Накопленная нефть Qн', logX: true,
      x: function (p) { return p.ql; }, y: function (p) { return p.qo; },
      fx: function (p) { return Math.log(p.ql); }, fy: function (p) { return p.qo; },
      curve: function (a, b, x) { return a + b * Math.log(x); },
      limit: function (a, b, wc) {
        var ql = b / (1 - wc);
        return { x: ql, qo: a + b * Math.log(ql) };
      },
    },
    maksimov: {
      name: 'Максимова', formula: 'Qн = a + b·ln Qв', xLabel: 'Накопленная вода Qв', yLabel: 'Накопленная нефть Qн', logX: true,
      x: function (p) { return p.qw; }, y: function (p) { return p.qo; },
      fx: function (p) { return Math.log(p.qw); }, fy: function (p) { return p.qo; },
      curve: function (a, b, x) { return a + b * Math.log(x); },
      limit: function (a, b, wc) {
        var qw = (b * wc) / (1 - wc);
        return { x: qw, qo: a + b * Math.log(qw) };
      },
    },
    nazarov: {
      name: 'Назарова–Сипачёва', formula: 'Qж/Qн = a + b·Qв', xLabel: 'Накопленная вода Qв', yLabel: 'Отношение Qж / Qн', logX: false,
      x: function (p) { return p.qw; }, y: function (p) { return p.ql / p.qo; },
      fx: function (p) { return p.qw; }, fy: function (p) { return p.ql / p.qo; },
      curve: function (a, b, x) { return a + b * x; },
      limit: function (a, b, wc) {
        if (a <= 1 || b <= 0) return null;
        var r = Math.sqrt(((a - 1) * wc) / (1 - wc));
        var qw = (r - (a - 1)) / b;
        if (qw <= 0) return null;
        return { x: qw, qo: qw / r, y: a + b * qw };
      },
    },
  };

  VS.registerTemplate({
    id: 'displacement',
    order: 3,
    name: 'Характеристики вытеснения',
    category: 'Разработка месторождений',
    description: 'Методы Сазонова, Максимова, Назарова–Сипачёва: извлекаемые и остаточные запасы при предельной обводнённости.',
    icon: '<svg viewBox="0 0 48 36"><g fill="#7a4a1e"><circle cx="8" cy="27" r="1.6"/><circle cx="13" cy="23" r="1.6"/><circle cx="18" cy="20" r="1.6"/><circle cx="23" cy="17" r="1.6"/><circle cx="28" cy="15" r="1.6"/></g><line x1="6" y1="29" x2="42" y2="8" stroke="var(--c1)" stroke-width="2" stroke-dasharray="3 2"/><path d="M42 4 L45 8 L42 12 L39 8 Z" fill="var(--c8)"/></svg>',
    bindings: [
      { key: 'date', name: 'Дата / период', dataType: 'any', optional: true, match: RE.date, description: 'Для упорядочивания и подписей' },
      { key: 'oil', name: 'Нефть', dataType: 'number', match: RE.oil.concat(RE.cumOil) },
      { key: 'water', name: 'Вода', dataType: 'number', optional: true, match: RE.water.concat(RE.cumWater) },
      { key: 'liquid', name: 'Жидкость', dataType: 'number', optional: true, match: RE.liquid.concat(RE.cumLiquid), description: 'Если нет колонки воды' },
      { key: 'filter', name: 'Скважина / объект', optional: true, match: RE.well },
    ],
    defaults: { 'filter.all': true, 'filter.allLabel': 'Всё месторождение' },
    common: ['layout', 'legend', 'tooltip', 'number', 'animation', 'appearance', 'filter'],
    sections: [
      {
        id: 'disp',
        title: 'Характеристика вытеснения',
        items: [
          { key: 'disp.method', label: 'Метод', type: 'select', options: [['sazonov', 'Сазонова: Qн = a + b·ln Qж'], ['maksimov', 'Максимова: Qн = a + b·ln Qв'], ['nazarov', 'Назарова–Сипачёва: Qж/Qн = a + b·Qв']], default: 'sazonov' },
          { key: 'disp.input', label: 'Данные в колонках', type: 'radio', options: [['period', 'Добыча за период'], ['cumulative', 'Накопленная']], default: 'period' },
          { key: 'disp.wcLimit', label: 'Предельная обводнённость, %', type: 'range', min: 80, max: 99.5, step: 0.5, default: 98 },
          { key: 'disp.minWc', label: 'Аппроксимировать при обводнённости от, %', type: 'range', min: 0, max: 95, default: 50, help: 'Линейный участок обычно наступает при обводнённости 50% и выше' },
          { key: 'disp.from', label: 'или с даты', type: 'text', default: '', placeholder: '2013-01', help: 'Если задано — заменяет порог обводнённости' },
          { key: 'disp.ooip', label: 'Начальные геологические запасы (НГЗ)', type: 'text', default: '', placeholder: 'в тех же единицах, что ниже', help: 'Для расчёта КИН' },
          { key: 'disp.div', label: 'Объёмы показывать в', type: 'select', options: [['1', 'исходных единицах'], ['1000', 'тысячах'], ['1000000', 'миллионах']], default: '1000' },
          { key: 'disp.unit', label: 'Единицы объёмов', type: 'text', default: 'тыс. м³' },
          { key: 'disp.params', label: 'Показывать результаты расчёта', type: 'toggle', default: true },
          { key: 'disp.color', label: 'Цвет точек', type: 'color', default: '#7a4a1e' },
          { key: 'disp.lineColor', label: 'Цвет линии тренда', type: 'color', default: '#2a78d6' },
        ],
      },
    ],
    sample: {
      data: (function () {
        var rows = [['Год', 'Добыча нефти, тыс. т', 'Добыча воды, тыс. т']];
        for (var y = 2005; y <= 2025; y++) {
          var t = y - 2005;
          var oil = 520 * Math.exp(-0.085 * t) + (t < 3 ? -150 + 50 * t : 0);
          var wc = Math.min(0.94, 0.05 + 0.045 * t + 0.0009 * t * t);
          rows.push([String(y), oil.toFixed(1), (oil * wc / (1 - wc)).toFixed(1)]);
        }
        return rows;
      })(),
      bindings: { date: 0, oil: 1, water: 2 },
      settings: { title: 'Характеристика вытеснения по методу Сазонова', subtitle: 'Объект АВ1-2, прогноз извлекаемых запасов при обводнённости 98%', footer: 'Источник: демонстрационные данные', 'disp.unit': 'тыс. т', 'disp.div': '1', 'disp.ooip': '18500' },
    },
    legendNames: function () { return ['Фактические данные', 'Аппроксимация']; },
    build: function (ctx) {
      var s = ctx.s;
      var O = ctx.column('oil'), W = ctx.column('water'), L = ctx.column('liquid'), Dt = ctx.column('date');
      if (!O || !(W || L)) return VS.empty(ctx, 'Привяжите колонки «Нефть» и «Вода» (или «Жидкость»)');
      var div = Number(s['disp.div']) || 1;
      var unit = s['disp.unit'] || '';
      var keyCol = Dt || { raw: O.raw.map(function (_, i) { return String(i + 1); }) };
      var agg = VS.aggregate(ctx, keyCol, { o: { col: O }, w: { col: W }, l: { col: L } });
      var cumulativeInput = s['disp.input'] === 'cumulative';
      var pts = [];
      var qo = 0, qw = 0;
      agg.keys.forEach(function (k, i) {
        var o = agg.values.o[i];
        var w = W ? agg.values.w[i] : agg.values.l && agg.values.l[i] !== null && o !== null ? agg.values.l[i] - o : null;
        if (o === null || w === null) return;
        var po, pw;
        if (cumulativeInput) {
          po = o - qo; pw = w - qw;
          qo = o; qw = w;
        } else {
          po = o; pw = w;
          qo += o; qw += w;
        }
        if (qo <= 0 || qw <= 0) return;
        pts.push({ key: k, date: agg.dates ? agg.dates[i] : null, qo: qo / div, qw: qw / div, ql: (qo + qw) / div, wc: po + pw > 0 ? pw / (po + pw) : null });
      });
      if (pts.length < 4) return VS.empty(ctx, 'Недостаточно периодов с добычей нефти и воды (нужно не меньше 4)');
      var M = METHODS[s['disp.method']] || METHODS.sazonov;
      var from = VS.parseDate(s['disp.from']);
      var minWc = (Number(s['disp.minWc']) || 0) / 100;
      var fitPts = from && agg.dates ? pts.filter(function (p) { return p.date >= from; }) : pts.filter(function (p) { return p.wc !== null && p.wc >= minWc; });
      if (fitPts.length < 3) fitPts = pts.slice(Math.floor(pts.length / 2));
      // регрессия
      var xs = fitPts.map(M.fx), ys = fitPts.map(M.fy);
      var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
      for (var i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; syy += ys[i] * ys[i]; }
      var b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      var a = (sy - b * sx) / n;
      var r2 = Math.pow(n * sxy - sx * sy, 2) / ((n * sxx - sx * sx) * (n * syy - sy * sy));
      var wcLim = (Number(s['disp.wcLimit']) || 98) / 100;
      var lim = b > 0 ? M.limit(a, b, wcLim) : null;
      var cur = pts[pts.length - 1];
      if (lim && lim.qo < cur.qo) lim = null;

      // линия тренда: от начала аппроксимации до предельной точки
      var xFrom = M.x(fitPts[0]);
      var xTo = lim ? Math.max(lim.x, M.x(cur)) : M.x(cur) * 1.3;
      var line = [];
      for (var k = 0; k <= 80; k++) {
        var xv = M.logX ? xFrom * Math.pow(xTo / xFrom, k / 80) : xFrom + ((xTo - xFrom) * k) / 80;
        line.push([xv, M.curve(a, b, M.logX ? xv : xv)]);
      }
      var fitSet = new Set(fitPts);
      var color = s['disp.color'], lineColor = s['disp.lineColor'];
      var label = function (p) { return p.date ? p.date.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }) : p.key; };
      var series = [
        {
          type: 'scatter', name: 'Фактические данные', symbolSize: 7,
          data: pts.map(function (p) {
            return { value: [M.x(p), M.y(p)], name: label(p), wc: p.wc, itemStyle: { color: color, opacity: fitSet.has(p) ? 0.95 : 0.35 } };
          }),
          itemStyle: { color: color },
          z: 3,
        },
        { type: 'line', name: 'Аппроксимация', data: line, showSymbol: false, color: lineColor, lineStyle: { width: 2, type: 'dashed', color: lineColor }, tooltip: { show: false }, z: 2 },
      ];
      if (lim) {
        series.push({
          type: 'scatter', name: 'Предел', symbol: 'diamond', symbolSize: 14, z: 5,
          data: [{ value: [lim.x, M === METHODS.nazarov ? lim.y : lim.qo], name: 'Предельная обводнённость ' + ctx.fmt(wcLim * 100, { noAffix: true, noCompact: true }) + '%' }],
          itemStyle: { color: '#e34948', borderColor: '#fff', borderWidth: 1.5 },
          label: {
            show: true, position: 'left', distance: 10, color: ctx.theme.text, fontFamily: ctx.font, fontSize: ctx.fontSize, fontWeight: 'bold',
            formatter: M === METHODS.nazarov ? 'Qв* = ' + ctx.fmt(lim.x, { noAffix: true }) : 'НИЗ ≈ ' + ctx.fmt(lim.qo, { noAffix: true }) + ' ' + unit,
            backgroundColor: VS.color.alpha(ctx.theme.background, 0.85), padding: [2, 4],
          },
        });
      }
      var xAxis = VS.axis(ctx, 'x', { type: M.logX ? 'log' : 'value' });
      if (M.logX) xAxis.type = 'log';
      xAxis.axisLine.show = true;
      xAxis.scale = true;
      xAxis.name = xAxis.name || M.xLabel + (unit ? ', ' + unit : '') + (M.logX ? ' (лог. шкала)' : '');
      xAxis.nameLocation = 'middle';
      xAxis.nameGap = 28;
      xAxis.nameTextStyle = { color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize };
      xAxis.splitLine = { show: true, lineStyle: { color: ctx.theme.grid } };
      var yAxis = VS.axis(ctx, 'y', { type: 'value' });
      yAxis.scale = true;
      yAxis.name = yAxis.name || M.yLabel + (M === METHODS.nazarov ? '' : unit ? ', ' + unit : '');
      yAxis.nameLocation = 'end';
      yAxis.nameGap = 10;
      yAxis.nameTextStyle = { color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 1, align: 'left' };
      var out = {
        series: series, xAxis: xAxis, yAxis: yAxis, grid: VS.grid(ctx, { top: 18, bottom: 10 }),
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            if (p.seriesType !== 'scatter') return '';
            var rows = [{ name: M.xLabel, value: ctx.fmt(p.value[0]) }, { name: M.yLabel, value: ctx.fmt(p.value[1]) }];
            if (p.data.wc !== undefined && p.data.wc !== null) rows.push({ name: 'Обводнённость за период', value: ctx.fmt(p.data.wc * 100, { decimals: 1, noAffix: true, noCompact: true }) + '%' });
            return VS.tooltipHtml(ctx, p.name, rows);
          },
        },
      };
      if (s['disp.params']) {
        var f = function (v, d) { return ctx.fmt(v, { noAffix: true, decimals: d }); };
        var lines = [
          'Метод ' + M.name + ': ' + M.formula,
          'a = ' + f(a, Math.abs(a) < 10 ? 4 : 1) + ';  b = ' + f(b, Math.abs(b) < 10 ? 4 : 1) + ';  R² = ' + f(r2, 3),
          'Точек в аппроксимации: ' + fitPts.length + ' из ' + pts.length,
          'Накоплено нефти: ' + f(cur.qo) + ' ' + unit,
          'Текущая обводнённость: ' + (cur.wc !== null ? f(cur.wc * 100, 1) + '%' : '—'),
        ];
        if (lim) {
          lines.push('Извлекаемые запасы (НИЗ): ' + f(lim.qo) + ' ' + unit);
          lines.push('Остаточные извлекаемые: ' + f(lim.qo - cur.qo) + ' ' + unit);
          var ooip = VS.parseNumber(s['disp.ooip']);
          if (ooip) lines.push('КИН: ' + f(lim.qo / ooip, 3) + ' (текущий ' + f(cur.qo / ooip, 3) + ')');
        } else lines.push('Предельная точка не определена — проверьте участок аппроксимации');
        out.graphic = [{
          type: 'text', left: ctx.area.left + 74, top: ctx.area.top + 34, z: 10, silent: true,
          style: {
            text: lines.join('\n'), font: ctx.fontSize + 'px ' + ctx.font, fill: ctx.theme.text, lineHeight: ctx.fontSize + 6,
            backgroundColor: VS.color.alpha(ctx.theme.background, 0.92), borderColor: ctx.theme.grid, borderWidth: 1, borderRadius: 6, padding: [8, 10],
          },
        }];
      }
      ctx.displacement = { a: a, b: b, r2: r2, limit: lim, current: cur };
      return out;
    },
  });
})(window.VS);

(function (VS) {
  'use strict';

  var RE = VS.petroPatterns;

  // ------------------------------------------------------------------ интерполяция и изолинии
  // Обратно-взвешенные расстояния (IDW) на регулярной сетке; ячейки дальше maskR от ближайшей скважины — пустые
  function idw(points, ext, nx, ny, power, maskR) {
    var cw = (ext.x1 - ext.x0) / nx, ch = (ext.y1 - ext.y0) / ny;
    var grid = [];
    for (var j = 0; j < ny; j++) {
      var row = [];
      var y = ext.y0 + (j + 0.5) * ch;
      for (var i = 0; i < nx; i++) {
        var x = ext.x0 + (i + 0.5) * cw;
        var num = 0, den = 0, nearest = Infinity, exact = null;
        for (var k = 0; k < points.length; k++) {
          var p = points[k];
          var d2 = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
          if (d2 < 1e-12) { exact = p.v; break; }
          if (d2 < nearest) nearest = d2;
          var w = 1 / Math.pow(d2, power / 2);
          num += w * p.v;
          den += w;
        }
        row.push(exact !== null ? exact : Math.sqrt(nearest) > maskR ? null : num / den);
      }
      grid.push(row);
    }
    return { grid: grid, cw: cw, ch: ch };
  }

  // Изолинии методом «марширующих квадратов» по центрам ячеек
  function contours(g, ext, nx, ny, level) {
    var segs = [];
    var X = function (i) { return ext.x0 + (i + 0.5) * g.cw; };
    var Y = function (j) { return ext.y0 + (j + 0.5) * g.ch; };
    var lerp = function (a, b, va, vb) { return a + ((level - va) / (vb - va)) * (b - a); };
    for (var j = 0; j < ny - 1; j++) {
      for (var i = 0; i < nx - 1; i++) {
        var v0 = g.grid[j][i], v1 = g.grid[j][i + 1], v2 = g.grid[j + 1][i + 1], v3 = g.grid[j + 1][i];
        if (v0 === null || v1 === null || v2 === null || v3 === null) continue;
        var c = (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) | (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0);
        if (c === 0 || c === 15) continue;
        var x0 = X(i), x1 = X(i + 1), y0 = Y(j), y1 = Y(j + 1);
        var b = [lerp(x0, x1, v0, v1), y0]; // нижняя грань
        var r = [x1, lerp(y0, y1, v1, v2)]; // правая
        var t = [lerp(x0, x1, v3, v2), y1]; // верхняя
        var l = [x0, lerp(y0, y1, v0, v3)]; // левая
        switch (c) {
          case 1: case 14: segs.push([l, b]); break;
          case 2: case 13: segs.push([b, r]); break;
          case 3: case 12: segs.push([l, r]); break;
          case 4: case 11: segs.push([r, t]); break;
          case 5: segs.push([l, t], [b, r]); break;
          case 6: case 9: segs.push([b, t]); break;
          case 7: case 8: segs.push([l, t]); break;
          case 10: segs.push([l, b], [r, t]); break;
        }
      }
    }
    return segs;
  }
  function niceStep(range, count) {
    var raw = range / Math.max(1, count);
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  VS.geo2d = { idw: idw, contours: contours };

  VS.registerTemplate({
    id: 'wellmap',
    order: 4,
    name: 'Карта отборов',
    category: 'Разработка месторождений',
    description: 'Скважины по координатам: круговые диаграммы нефть/вода, нагнетательные скважины, карта свойства (толщины, проницаемости) с изолиниями.',
    icon: '<svg viewBox="0 0 48 36"><rect x="3" y="3" width="42" height="30" rx="3" fill="var(--c3)" opacity=".18"/><path d="M8 26 C 14 14, 30 10, 40 18" fill="none" stroke="currentColor" stroke-opacity=".35"/><path d="M12 28 C 18 20, 30 17, 38 24" fill="none" stroke="currentColor" stroke-opacity=".35"/><circle cx="14" cy="12" r="5" fill="#3987e5"/><path d="M14 12 L14 7 A5 5 0 0 1 18.3 14.5 Z" fill="#7a4a1e"/><circle cx="31" cy="21" r="4" fill="#3987e5"/><path d="M31 21 L31 17 A4 4 0 1 1 27.5 19 Z" fill="#7a4a1e"/><path d="M23 8 L26 13 L20 13 Z" fill="#19a3b8"/></svg>',
    variants: [
      { name: 'Карта отборов', settings: { 'wm.bubble': 'pie' } },
      {
        name: 'Карта свойства пласта', settings: { 'wm.bubble': 'none', 'wm.levels': 10 },
        description: 'Интерполированная карта параметра по скважинам (толщина, пористость, давление) с изолиниями.',
        icon: '<svg viewBox="0 0 48 36"><rect x="3" y="3" width="42" height="30" rx="3" fill="var(--c1)" opacity=".2"/><ellipse cx="24" cy="18" rx="14" ry="9" fill="var(--c1)" opacity=".35"/><ellipse cx="24" cy="18" rx="7" ry="4.5" fill="var(--c1)" opacity=".6"/><g fill="currentColor"><circle cx="12" cy="10" r="1.3"/><circle cx="24" cy="18" r="1.3"/><circle cx="35" cy="24" r="1.3"/><circle cx="33" cy="9" r="1.3"/></g></svg>',
      },
    ],
    bindings: [
      { key: 'well', name: 'Скважина', dataType: 'text', match: RE.well },
      { key: 'x', name: 'Координата X', dataType: 'number', match: RE.x },
      { key: 'y', name: 'Координата Y', dataType: 'number', match: RE.y },
      { key: 'oil', name: 'Нефть', dataType: 'number', optional: true, match: RE.oil.concat(RE.cumOil), description: 'Дебит или накопленная добыча' },
      { key: 'water', name: 'Вода', dataType: 'number', optional: true, match: RE.water.concat(RE.cumWater) },
      { key: 'inj', name: 'Закачка', dataType: 'number', optional: true, match: RE.inj },
      { key: 'type', name: 'Тип скважины', dataType: 'text', optional: true, match: RE.type, description: '«Нагнетательная» / «Добывающая»' },
      { key: 'value', name: 'Свойство для карты', dataType: 'number', optional: true, match: [/толщин|пористост|проницаем|давлен|h\s*эф|кпор|кпр|thick|poro|perm/i], description: 'Интерполируется между скважинами' },
      { key: 'filter', name: 'Фильтр (период, пласт)', optional: true },
    ],
    defaults: { 'legend.show': true },
    common: ['layout', 'legend', 'tooltip', 'number', 'animation', 'appearance', 'filter'],
    sections: [
      {
        id: 'wm',
        title: 'Карта',
        items: [
          { key: 'wm.bubble', label: 'Значки скважин', type: 'select', options: [['pie', 'Круговые: нефть / вода'], ['liquid', 'Круг по жидкости'], ['oil', 'Круг по нефти'], ['none', 'Только точки']], default: 'pie' },
          { key: 'wm.rMax', label: 'Максимальный радиус, px', type: 'range', min: 8, max: 60, default: 26 },
          { key: 'wm.labels', label: 'Названия скважин', type: 'toggle', default: true },
          { key: 'wm.bg', label: 'Карта свойства (фон)', type: 'toggle', default: true, help: 'Нужна колонка «Свойство для карты»' },
          { key: 'wm.scale', label: 'Цветовая шкала', type: 'scale', default: 'viridis', show: function (s) { return s['wm.bg']; } },
          { key: 'wm.reverse', label: 'Инвертировать шкалу', type: 'toggle', default: true, show: function (s) { return s['wm.bg']; } },
          { key: 'wm.levels', label: 'Изолиний', type: 'range', min: 0, max: 20, default: 8, show: function (s) { return s['wm.bg']; } },
          { key: 'wm.opacity', label: 'Непрозрачность карты', type: 'range', min: 0.2, max: 1, step: 0.05, default: 0.75, show: function (s) { return s['wm.bg']; } },
          { key: 'wm.res', label: 'Детальность интерполяции', type: 'range', min: 30, max: 160, default: 90, show: function (s) { return s['wm.bg']; } },
          { key: 'wm.power', label: 'Степень IDW', type: 'range', min: 1, max: 4, step: 0.5, default: 2, show: function (s) { return s['wm.bg']; } },
          { key: 'wm.mask', label: 'Радиус влияния скважины, × шаг сетки', type: 'range', min: 1, max: 6, step: 0.5, default: 2.5, show: function (s) { return s['wm.bg']; } },
          { key: 'wm.valueName', label: 'Название свойства', type: 'text', default: '', placeholder: 'из колонки' },
          { type: 'heading', label: 'Оси и цвета' },
          { key: 'wm.axes', label: 'Координатные оси', type: 'toggle', default: true },
          { key: 'wm.unit', label: 'Единицы координат', type: 'text', default: 'м' },
          { key: 'wm.zoom', label: 'Масштаб колесом мыши', type: 'toggle', default: false },
          { key: 'wm.oilColor', label: 'Нефть', type: 'color', default: '#7a4a1e' },
          { key: 'wm.waterColor', label: 'Вода', type: 'color', default: '#3987e5' },
          { key: 'wm.injColor', label: 'Закачка', type: 'color', default: '#19a3b8' },
        ],
      },
    ],
    sample: {
      data: (function () {
        var rows = [['Скважина', 'X, м', 'Y, м', 'Тип', 'Нефть, т/сут', 'Вода, т/сут', 'Закачка, м³/сут', 'Нефтенасыщенная толщина, м']];
        var seed = 5;
        var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        var n = 0;
        for (var r = 0; r < 5; r++) {
          for (var c = 0; c < 6; c++) {
            var x = 1000 + c * 600 + (r % 2) * 300 + (rnd() - 0.5) * 120;
            var y = 1000 + r * 520 + (rnd() - 0.5) * 120;
            var dx = (x - 2600) / 1700, dy = (y - 2050) / 1100;
            var h = Math.max(1.5, 14 * Math.exp(-(dx * dx + dy * dy)) + rnd() * 2);
            var inj = (r === 1 || r === 3) && c % 2 === 1;
            n++;
            var oil = inj ? '' : (h * (2.2 + rnd())).toFixed(1);
            var wc = Math.min(0.92, 0.15 + 0.6 * Math.sqrt(dx * dx + dy * dy) * rnd() + 0.1);
            var water = inj ? '' : (oil * wc / (1 - wc)).toFixed(1);
            rows.push([String(1000 + n), x.toFixed(0), y.toFixed(0), inj ? 'Нагнетательная' : 'Добывающая', oil, water, inj ? (60 + rnd() * 90).toFixed(0) : '', h.toFixed(1)]);
          }
        }
        return rows;
      })(),
      bindings: { well: 0, x: 1, y: 2, type: 3, oil: 4, water: 5, inj: 6, value: 7 },
      settings: { title: 'Карта текущих отборов', subtitle: 'Фон — нефтенасыщенная толщина, м; диаграммы — дебиты нефти и воды', footer: 'Источник: демонстрационные данные' },
    },
    legendNames: function (ctx) {
      var names = [];
      if (ctx.s['wm.bubble'] !== 'none' && ctx.has('oil')) names.push('Нефть');
      if (ctx.s['wm.bubble'] === 'pie' && ctx.has('water')) names.push('Вода');
      if (ctx.has('inj') || ctx.has('type')) names.push('Закачка');
      return names.length ? names : null;
    },
    build: function (ctx) {
      var s = ctx.s;
      var Wn = ctx.column('well'), X = ctx.column('x'), Y = ctx.column('y');
      if (!X || !Y) return VS.empty(ctx, 'Привяжите колонки координат X и Y');
      var O = ctx.column('oil'), Wt = ctx.column('water'), I = ctx.column('inj'), T = ctx.column('type'), V = ctx.column('value');
      // агрегируем по скважине (несколько строк одной скважины — сумма отборов)
      var keyCol = Wn || { raw: X.raw.map(function (_, i) { return '#' + (i + 1); }) };
      var wells = new Map();
      keyCol.raw.forEach(function (name, i) {
        if (!name || X.num[i] === null || Y.num[i] === null) return;
        var w = wells.get(name);
        if (!w) wells.set(name, (w = { name: name, x: X.num[i], y: Y.num[i], oil: 0, water: 0, inj: 0, type: '', v: null, has: {} }));
        if (O && O.num[i] !== null) { w.oil += O.num[i]; w.has.oil = 1; }
        if (Wt && Wt.num[i] !== null) { w.water += Wt.num[i]; w.has.water = 1; }
        if (I && I.num[i] !== null) { w.inj += I.num[i]; w.has.inj = 1; }
        if (T && T.raw[i]) w.type = T.raw[i];
        if (V && V.num[i] !== null) w.v = V.num[i];
      });
      var list = Array.from(wells.values());
      if (!list.length) return VS.empty(ctx, 'Нет скважин с координатами');
      list.forEach(function (w) {
        w.injector = /нагнет|inj|ппд|wi\b/i.test(w.type) || (w.inj > 0 && w.oil + w.water === 0);
      });

      // экстент и равный масштаб по осям
      var xs = list.map(function (w) { return w.x; }), ys = list.map(function (w) { return w.y; });
      var ext = { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
      var span = Math.max(ext.x1 - ext.x0, ext.y1 - ext.y0, 1);
      var m = span * 0.08;
      ext = { x0: ext.x0 - m, x1: ext.x1 + m, y0: ext.y0 - m, y1: ext.y1 + m };
      var a = ctx.area;
      var bgOn = s['wm.bg'] && V && list.some(function (w) { return w.v !== null; });
      var axes = s['wm.axes'];
      var padL = axes ? 58 : 0, padB = axes ? 34 : 0, padR = bgOn ? 120 : 0, padT = 6;
      var availW = Math.max(50, a.width - padL - padR), availH = Math.max(50, a.height - padB - padT);
      var dx = ext.x1 - ext.x0, dy = ext.y1 - ext.y0;
      var k = Math.min(availW / dx, availH / dy);
      // растягиваем экстент по свободной стороне, чтобы масштаб X и Y совпадал
      var extraX = (availW / k - dx) / 2, extraY = (availH / k - dy) / 2;
      ext = { x0: ext.x0 - extraX, x1: ext.x1 + extraX, y0: ext.y0 - extraY, y1: ext.y1 + extraY };
      var grid = { left: a.left + padL, top: a.top + padT, width: availW, height: availH };

      var unit = s['wm.unit'] ? ', ' + s['wm.unit'] : '';
      var axisOf = function (dim, name) {
        var ax = VS.axis(ctx, dim, { type: 'value' });
        ax.min = dim === 'x' ? ext.x0 : ext.y0;
        ax.max = dim === 'x' ? ext.x1 : ext.y1;
        ax.show = !!axes;
        ax.axisLine = { show: true, lineStyle: { color: ctx.theme.axis } };
        ax.axisTick = { show: true, lineStyle: { color: ctx.theme.axis } };
        ax.splitLine = { show: false };
        ax.axisLabel.formatter = function (v) { return ctx.fmt(v, { noAffix: true, decimals: 0, noCompact: true }); };
        ax.axisLabel.showMinLabel = false;
        ax.axisLabel.showMaxLabel = false;
        ax.name = ax.name || name + unit;
        ax.nameLocation = 'middle';
        ax.nameGap = dim === 'x' ? 26 : 46;
        ax.nameTextStyle = { color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 1 };
        return ax;
      };
      var series = [];
      var out = { grid: grid, xAxis: axisOf('x', 'X'), yAxis: axisOf('y', 'Y'), series: series };

      // ----- фоновая карта свойства + изолинии
      var vName = s['wm.valueName'] || (V ? V.name : '');
      if (bgOn) {
        var pts = list.filter(function (w) { return w.v !== null; }).map(function (w) { return { x: w.x, y: w.y, v: w.v }; });
        var res = Number(s['wm.res']) || 90;
        var nx = Math.max(10, Math.round(res * Math.min(1, (ext.x1 - ext.x0) / (ext.y1 - ext.y0)) || res));
        var ny = Math.max(10, Math.round(res * Math.min(1, (ext.y1 - ext.y0) / (ext.x1 - ext.x0)) || res));
        // средний шаг между скважинами — для маски «зоны влияния»
        var nn = pts.map(function (p) {
          var best = Infinity;
          pts.forEach(function (q) { if (q !== p) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y)); });
          return best;
        }).filter(isFinite).sort(function (u, v) { return u - v; });
        var spacing = nn.length ? nn[Math.floor(nn.length / 2)] : span / 4;
        var g = idw(pts, ext, nx, ny, Number(s['wm.power']) || 2, spacing * (Number(s['wm.mask']) || 2.5));
        var cells = [];
        var vmin = Infinity, vmax = -Infinity;
        g.grid.forEach(function (row, j) {
          row.forEach(function (v, i) {
            if (v === null) return;
            cells.push([ext.x0 + (i + 0.5) * g.cw, ext.y0 + (j + 0.5) * g.ch, v]);
            if (v < vmin) vmin = v;
            if (v > vmax) vmax = v;
          });
        });
        var colors = ctx.seqScale(s['wm.scale']).slice();
        if (s['wm.reverse']) colors.reverse();
        var hw = g.cw / 2, hh = g.ch / 2;
        // прозрачность смешиваем с фоном заранее: перекрытие полупрозрачных ячеек давало бы сетку
        var alpha = Number(s['wm.opacity']) || 0.75;
        var bgRgb = VS.color.hexToRgb(ctx.theme.background);
        var blend = function (c) {
          var m = /rgba?\(([^)]+)\)/.exec(c);
          var rgb = m ? m[1].split(',').slice(0, 3).map(Number) : VS.color.hexToRgb(c);
          return 'rgb(' + rgb.map(function (v, i) { return Math.round(bgRgb[i] + (v - bgRgb[i]) * alpha); }).join(',') + ')';
        };
        series.push({
          type: 'custom', name: vName, silent: true, z: 1, animation: false,
          data: cells,
          renderItem: function (params, api) {
            var p1 = api.coord([api.value(0) - hw, api.value(1) + hh]);
            var p2 = api.coord([api.value(0) + hw, api.value(1) - hh]);
            return { type: 'rect', shape: { x: p1[0], y: p1[1], width: p2[0] - p1[0] + 0.6, height: p2[1] - p1[1] + 0.6 }, style: { fill: blend(api.visual('color')) } };
          },
          encode: { x: 0, y: 1 },
          tooltip: { show: false },
        });
        var titleLines = VS.wrapText(vName, 'bold ' + (ctx.fontSize - 1) + 'px ' + ctx.font, padR - 12);
        var titleH = titleLines.length * (ctx.fontSize + 3);
        out.visualMap = {
          type: 'continuous', seriesIndex: 0, dimension: 2, min: vmin, max: vmax, calculable: false,
          orient: 'vertical', right: a.right + 20, top: grid.top + titleH + 22, itemWidth: 12, itemHeight: Math.max(60, Math.min(220, availH - titleH - 60)),
          inRange: { color: colors },
          text: [ctx.fmt(vmax, { noAffix: true }), ctx.fmt(vmin, { noAffix: true })],
          textStyle: { color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 1 },
        };
        out.graphic = [{ type: 'text', left: a.left + a.width - padR + 12, top: grid.top, style: { text: titleLines.join('\n'), font: 'bold ' + (ctx.fontSize - 1) + 'px ' + ctx.font, fill: ctx.theme.text, lineHeight: ctx.fontSize + 3 } }];
        var levels = Number(s['wm.levels']) || 0;
        if (levels > 0 && vmax > vmin) {
          var step = niceStep(vmax - vmin, levels);
          var segs = [], labels = [];
          for (var L = Math.ceil(vmin / step) * step; L < vmax; L += step) {
            var sg = contours(g, ext, nx, ny, L);
            sg.forEach(function (seg) { segs.push({ coords: seg }); });
            if (sg.length > 6) {
              var mid = sg[Math.floor(sg.length / 2)];
              labels.push({ value: [(mid[0][0] + mid[1][0]) / 2, (mid[0][1] + mid[1][1]) / 2], label: ctx.fmt(L, { noAffix: true, noCompact: true }) });
            }
          }
          series.push({
            type: 'lines', coordinateSystem: 'cartesian2d', polyline: false, silent: true, z: 2, animation: false, large: true,
            lineStyle: { color: VS.color.alpha(ctx.theme.text, 0.45), width: 0.8 },
            data: segs, tooltip: { show: false },
          });
          series.push({
            type: 'scatter', symbolSize: 0, silent: true, z: 3, animation: false, tooltip: { show: false },
            data: labels.map(function (l) { return { value: l.value, name: l.label }; }),
            label: { show: true, formatter: '{b}', color: ctx.theme.text, fontSize: Math.max(9, ctx.fontSize - 2), fontFamily: ctx.font, backgroundColor: VS.color.alpha(ctx.theme.background, 0.6), padding: [0, 2] },
          });
        }
      }

      // ----- скважины
      var mode = s['wm.bubble'];
      var rMax = Number(s['wm.rMax']) || 26;
      var prod = list.filter(function (w) { return !w.injector; });
      var maxQ = Math.max.apply(null, prod.map(function (w) { return mode === 'oil' ? w.oil : w.oil + w.water; }).concat([0]));
      var maxI = Math.max.apply(null, list.map(function (w) { return w.inj; }).concat([0]));
      var rOf = function (q, max) { return max > 0 ? Math.max(3, Math.sqrt(q / max) * rMax) : 4; };
      var oilC = s['wm.oilColor'], watC = s['wm.waterColor'], injC = s['wm.injColor'];
      var showLabels = s['wm.labels'];
      var labelEl = function (w, c, r) {
        return showLabels ? { type: 'text', style: { text: w.name, x: c[0] + r + 3, y: c[1] - r * 0.6, fill: ctx.theme.text, font: (ctx.fontSize - 1) + 'px ' + ctx.font, textShadowColor: ctx.theme.background, textShadowBlur: 3 } } : null;
      };
      series.push({
        type: 'custom', name: 'Скважины', z: 5,
        data: list.map(function (w) { return { value: [w.x, w.y], name: w.name, well: w }; }),
        encode: { x: 0, y: 1 },
        renderItem: function (params, api) {
          var w = list[params.dataIndex];
          var c = api.coord([w.x, w.y]);
          var kids = [];
          if (w.injector) {
            var ri = w.inj > 0 ? rOf(w.inj, maxI) * 0.9 : 5;
            kids.push({ type: 'polygon', shape: { points: [[c[0], c[1] - ri], [c[0] + ri * 0.95, c[1] + ri * 0.7], [c[0] - ri * 0.95, c[1] + ri * 0.7]] }, style: { fill: injC, stroke: ctx.theme.background, lineWidth: 1 } });
            var lb = labelEl(w, c, ri);
            if (lb) kids.push(lb);
            return { type: 'group', children: kids };
          }
          var liq = w.oil + w.water;
          var q = mode === 'oil' ? w.oil : liq;
          var r = mode === 'none' || !(q > 0) ? 3.5 : rOf(q, maxQ);
          if (mode === 'pie' && liq > 0) {
            var start = -Math.PI / 2;
            var oilEnd = start + (2 * Math.PI * w.oil) / liq;
            if (w.oil > 0) kids.push({ type: 'sector', shape: { cx: c[0], cy: c[1], r0: 0, r: r, startAngle: start, endAngle: oilEnd, clockwise: true }, style: { fill: oilC } });
            if (w.water > 0) kids.push({ type: 'sector', shape: { cx: c[0], cy: c[1], r0: 0, r: r, startAngle: oilEnd, endAngle: start + 2 * Math.PI, clockwise: true }, style: { fill: watC } });
            kids.push({ type: 'circle', shape: { cx: c[0], cy: c[1], r: r }, style: { fill: 'none', stroke: ctx.theme.background, lineWidth: 1 } });
          } else {
            kids.push({ type: 'circle', shape: { cx: c[0], cy: c[1], r: r }, style: { fill: mode === 'none' || !(q > 0) ? ctx.theme.text : mode === 'liquid' ? watC : oilC, stroke: ctx.theme.background, lineWidth: 1, opacity: 0.9 } });
          }
          var lb2 = labelEl(w, c, r);
          if (lb2) kids.push(lb2);
          return { type: 'group', children: kids };
        },
      });
      // элементы легенды (пустые серии с нужными цветами)
      [['Нефть', oilC], ['Вода', watC], ['Закачка', injC]].forEach(function (p) {
        series.push({ type: 'line', name: p[0], data: [], color: p[1], itemStyle: { color: p[1] } });
      });
      out.legend = { selectedMode: false };
      out.tooltip = {
        trigger: 'item',
        formatter: function (p) {
          var w = p.data && p.data.well;
          if (!w) return '';
          var rows = [];
          if (w.injector) rows.push({ name: (I ? I.name : 'Закачка'), value: ctx.fmt(w.inj), color: injC });
          else {
            if (w.has.oil) rows.push({ name: O.name, value: ctx.fmt(w.oil), color: oilC });
            if (w.has.water) rows.push({ name: Wt.name, value: ctx.fmt(w.water), color: watC });
            if (w.has.oil && w.has.water && w.oil + w.water > 0) rows.push({ name: 'Обводнённость', value: ctx.fmt((w.water / (w.oil + w.water)) * 100, { decimals: 1, noAffix: true, noCompact: true }) + '%' });
          }
          if (w.v !== null) rows.push({ name: vName, value: ctx.fmt(w.v) });
          if (w.type) rows.push({ name: 'Тип', value: w.type });
          rows.push({ name: 'X; Y', value: ctx.fmt(w.x, { noAffix: true, noCompact: true, decimals: 0 }) + '; ' + ctx.fmt(w.y, { noAffix: true, noCompact: true, decimals: 0 }) });
          return VS.tooltipHtml(ctx, 'Скважина ' + w.name, rows);
        },
      };
      if (s['wm.zoom']) out.dataZoom = [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }, { type: 'inside', yAxisIndex: 0, filterMode: 'none' }];
      return out;
    },
  });
})(window.VS);

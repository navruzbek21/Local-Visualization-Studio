(function (VS) {
  'use strict';

  var M = VS.math;
  var MAX_SPLOM = 8;

  // Порядок переменных по иерархической кластеризации (среднее связывание, расстояние 1 − |r|)
  function clusterOrder(R) {
    var k = R.length;
    var cl = [];
    for (var i = 0; i < k; i++) cl.push([i]);
    var dist = function (a, b) {
      var s = 0, n = 0;
      a.forEach(function (i) { b.forEach(function (j) { s += 1 - Math.abs(R[i][j] === null ? 0 : R[i][j]); n++; }); });
      return s / n;
    };
    while (cl.length > 1) {
      var best = null;
      for (var x = 0; x < cl.length; x++) {
        for (var y = x + 1; y < cl.length; y++) {
          var d = dist(cl[x], cl[y]);
          if (!best || d < best.d) best = { d: d, x: x, y: y };
        }
      }
      var merged = cl[best.x].concat(cl[best.y]);
      cl.splice(best.y, 1);
      cl[best.x] = merged;
    }
    return cl[0];
  }

  VS.registerTemplate({
    id: 'correlation',
    order: 44,
    name: 'Матрица корреляций',
    category: 'Связи',
    description: 'Какие параметры связаны между собой: коэффициенты Пирсона или Спирмена, значимость, кластеризация. Вариант — матрица диаграмм рассеяния.',
    icon: '<svg viewBox="0 0 48 36"><g><rect x="6" y="3" width="9" height="9" fill="#184f95"/><rect x="16" y="3" width="9" height="9" fill="#9ec5f4"/><rect x="26" y="3" width="9" height="9" fill="#f4a3a0"/><rect x="6" y="13" width="9" height="9" fill="#9ec5f4"/><rect x="16" y="13" width="9" height="9" fill="#184f95"/><rect x="26" y="13" width="9" height="9" fill="#e34948"/><rect x="6" y="23" width="9" height="9" fill="#f4a3a0"/><rect x="16" y="23" width="9" height="9" fill="#e34948"/><rect x="26" y="23" width="9" height="9" fill="#184f95"/></g><rect x="39" y="3" width="4" height="29" rx="1" fill="url(#cg)"/><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#184f95"/><stop offset=".5" stop-color="#f0efec"/><stop offset="1" stop-color="#b2182b"/></linearGradient></defs></svg>',
    variants: [
      { name: 'Матрица корреляций', settings: { 'corr.view': 'heatmap' } },
      {
        name: 'Матрица диаграмм рассеяния', settings: { 'corr.view': 'splom' },
        description: 'Попарные кросс-плоты: внизу — точки, на диагонали — гистограммы, вверху — коэффициенты.',
        sampleBindings: { values: [2, 3, 4, 5, 6], color: 1, name: 0 },
        sampleSettings: { title: 'Попарные связи параметров скважин', subtitle: 'Внизу — точки, на диагонали — распределения, вверху — коэффициент Спирмена' },
        icon: '<svg viewBox="0 0 48 36"><g stroke="currentColor" stroke-opacity=".25" fill="none"><rect x="4" y="2" width="13" height="10"/><rect x="18" y="2" width="13" height="10"/><rect x="32" y="2" width="13" height="10"/><rect x="4" y="13" width="13" height="10"/><rect x="18" y="13" width="13" height="10"/><rect x="32" y="13" width="13" height="10"/><rect x="4" y="24" width="13" height="10"/><rect x="18" y="24" width="13" height="10"/><rect x="32" y="24" width="13" height="10"/></g><g fill="var(--c1)"><rect x="6" y="8" width="2" height="3"/><rect x="9" y="5" width="2" height="6"/><rect x="12" y="7" width="2" height="4"/><circle cx="7" cy="20" r="1"/><circle cx="10" cy="18" r="1"/><circle cx="14" cy="15" r="1"/><circle cx="7" cy="31" r="1"/><circle cx="11" cy="29" r="1"/><circle cx="15" cy="26" r="1"/><circle cx="21" cy="30" r="1"/><circle cx="25" cy="28" r="1"/><circle cx="29" cy="29" r="1"/></g><text x="21" y="10" font-size="6" fill="currentColor">0,8</text><text x="35" y="10" font-size="6" fill="currentColor">0,3</text></svg>',
      },
    ],
    bindings: [
      { key: 'values', name: 'Параметры', dataType: 'number', multiple: true, description: 'Две и более числовые колонки; пустые ячейки исключаются попарно' },
      { key: 'color', name: 'Группа (цвет точек)', dataType: 'text', optional: true, description: 'Только для матрицы диаграмм рассеяния' },
      { key: 'name', name: 'Название точки', dataType: 'text', optional: true, description: 'Для подсказок (например, скважина)' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    autoBind: function (cols) {
      var num = cols.filter(function (c) { return c.type === 'number'; });
      var txt = cols.filter(function (c) { return c.type !== 'number'; });
      var out = { values: num.slice(0, 10).map(function (c) { return c.index; }) };
      if (txt[0]) out.name = txt[0].index;
      return out;
    },
    common: ['layout', 'legend', 'tooltip', 'number', 'animation', 'appearance'],
    sections: [
      {
        id: 'corr',
        title: 'Корреляции',
        items: [
          { key: 'corr.view', label: 'Вид', type: 'radio', options: [['heatmap', 'Матрица'], ['splom', 'Диаграммы рассеяния']], default: 'heatmap' },
          { key: 'corr.method', label: 'Коэффициент', type: 'radio', options: [['pearson', 'Пирсона'], ['spearman', 'Спирмена']], default: 'pearson', help: 'Пирсон — линейная связь; Спирмен — монотонная, устойчив к выбросам и логнормальным величинам (проницаемость)' },
          { key: 'corr.order', label: 'Порядок параметров', type: 'radio', options: [['data', 'Как в данных'], ['cluster', 'Группировать связанные']], default: 'data', help: 'Сильно связанные параметры встают рядом (иерархическая кластеризация)' },
          { key: 'corr.triangle', label: 'Показывать', type: 'radio', options: [['lower', 'Нижний треугольник'], ['full', 'Всю матрицу']], default: 'lower', show: function (s) { return s['corr.view'] !== 'splom'; } },
          { key: 'corr.signif', label: 'Приглушать незначимые (p ≥ 0,05)', type: 'toggle', default: true, help: 'Двусторонний критерий по преобразованию Фишера. При малом числе точек высокий |r| может быть случайным' },
          { key: 'corr.labels', label: 'Значения в ячейках', type: 'toggle', default: true, show: function (s) { return s['corr.view'] !== 'splom'; } },
          { key: 'corr.scale', label: 'Цветовая шкала', type: 'select', options: [['rdbu', 'Красный (−) ↔ синий (+)'], ['rdylgn', 'Красный (−) ↔ зелёный (+)']], default: 'rdbu' },
          { key: 'corr.legend', label: 'Шкала цвета', type: 'toggle', default: true, show: function (s) { return s['corr.view'] !== 'splom'; } },
          { key: 'corr.autoLog', label: 'Логарифмическая шкала для асимметричных', type: 'toggle', default: true, help: 'Для положительных параметров с разбросом в десятки раз (проницаемость, дебит)', show: function (s) { return s['corr.view'] === 'splom'; } },
          { key: 'corr.pointSize', label: 'Размер точек', type: 'range', min: 2, max: 10, step: 0.5, default: 4, show: function (s) { return s['corr.view'] === 'splom'; } },
          { key: 'corr.bins', label: 'Интервалов в гистограммах', type: 'range', min: 4, max: 30, default: 10, show: function (s) { return s['corr.view'] === 'splom'; } },
        ],
      },
    ],
    sample: {
      data: (function () {
        // параметры скважин: связь ФЕС, насыщенности и показателей работы
        var rows = [['Скважина', 'Пласт', 'Пористость, %', 'Проницаемость, мД', 'Нефтенасыщенность, д. ед.', 'Эфф. толщина, м', 'Дебит нефти, м³/сут', 'Обводнённость, %', 'Забойное давление, атм']];
        var seed = 31;
        var u = function () { seed = (seed * 9301 + 49297) % 233280; return (seed + 0.5) / 233281; };
        var nrm = function () { return Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); };
        for (var i = 0; i < 64; i++) {
          var bs = i % 2 === 0;
          var phi = (bs ? 17 : 14) + 3 * nrm();
          var k = Math.pow(10, -1.9 + 0.2 * phi + 0.3 * nrm());
          var so = Math.max(0.35, Math.min(0.85, 0.42 + 0.014 * phi + 0.05 * nrm()));
          var h = Math.max(1.5, (bs ? 9 : 6) + 2.5 * nrm());
          var qo = Math.max(0.5, 0.35 * Math.pow(k, 0.55) * h * so * (1 + 0.25 * nrm()));
          var wc = Math.max(3, Math.min(97, 125 - 120 * so + 9 * nrm()));
          var pz = Math.max(40, 95 + 12 * nrm() - 0.25 * qo);
          rows.push(['Скв. ' + (2101 + i), bs ? 'БС10' : 'АС11', phi.toFixed(1), k < 10 ? k.toFixed(2) : k.toFixed(1), so.toFixed(3), h.toFixed(1), qo.toFixed(1), wc.toFixed(1), pz.toFixed(1)]);
        }
        return rows;
      })(),
      bindings: { name: 0, values: [2, 3, 4, 5, 6, 7, 8] },
      settings: {
        title: 'Связь параметров пласта и работы скважин',
        subtitle: 'Коэффициенты корреляции Спирмена, 64 скважины. Бледные ячейки — статистически незначимые связи',
        footer: 'Источник: демонстрационные данные',
        'corr.method': 'spearman',
      },
    },
    legendNames: function (ctx) {
      if (ctx.s['corr.view'] !== 'splom') return null;
      var c = ctx.column('color');
      return c ? VS.util.uniq(c.raw.filter(Boolean)) : null;
    },
    build: function (ctx) {
      var s = ctx.s;
      var vars = ctx.columnsOf('values');
      if (vars.length < 2) return VS.empty(ctx, 'Привяжите к «Параметрам» хотя бы две числовые колонки');
      var method = s['corr.method'] === 'spearman' ? 'spearman' : 'pearson';
      var k = vars.length;
      var R = [], Nn = [], P = [];
      for (var i = 0; i < k; i++) {
        R.push([]); Nn.push([]); P.push([]);
        for (var j = 0; j < k; j++) {
          var c = i === j ? { r: 1, n: vars[i].num.filter(function (v) { return v !== null; }).length } : M.correlation(vars[i].num, vars[j].num, method);
          R[i].push(c.r);
          Nn[i].push(c.n);
          P[i].push(i === j ? 0 : M.corrPValue(c.r, c.n));
        }
      }
      var order = s['corr.order'] === 'cluster' ? clusterOrder(R) : vars.map(function (_, i) { return i; });
      var names = order.map(function (i) { return vars[i].name; });
      var colors = (VS.scales[s['corr.scale']] || VS.scales.rdbu).colors;
      var signifOn = s['corr.signif'] !== false;
      var fmtR = function (r) { return r === null ? '—' : ctx.fmt(r, { decimals: 2, noAffix: true, noCompact: true }); };
      var rTxt = fmtR;
      var methodName = method === 'spearman' ? 'Спирмена' : 'Пирсона';
      var pTxt = function (p) { return p < 0.001 ? '< 0,001' : ctx.fmt(p, { decimals: 3, noAffix: true, noCompact: true }); };
      var faint = VS.color.mix(ctx.theme.text, ctx.theme.background, 0.94);

      if (s['corr.view'] === 'splom') return splom();

      // ------------------------------------------------------------ тепловая матрица
      var lower = s['corr.triangle'] !== 'full';
      var main = [], weak = [];
      order.forEach(function (vi, yi) {
        order.forEach(function (vj, xi) {
          if (lower && xi > yi) return;
          var r = R[vi][vj];
          var item = { value: [xi, yi, r === null ? '-' : r], a: vi, b: vj };
          var dark = r !== null && Math.abs(r) > 0.55;
          // диагональ (r = 1) и незначимые связи — нейтральным цветом, чтобы не отвлекали
          if (vi === vj || (r !== null && signifOn && P[vi][vj] >= 0.05)) {
            item.label = { color: ctx.theme.faint };
            weak.push(item);
          } else {
            item.label = { color: dark ? '#ffffff' : ctx.theme.text };
            main.push(item);
          }
        });
      });
      var showLegend = s['corr.legend'] !== false;
      var legW = showLegend ? 64 : 0;
      var cell = Math.min((ctx.area.width - legW - 140) / k, (ctx.area.height - 40) / k);
      var showLabels = s['corr.labels'] !== false && cell > 24;
      var labelStyle = {
        show: showLabels, fontFamily: ctx.font, fontSize: Math.max(9, Math.min(ctx.fontSize, cell * 0.3)),
        formatter: function (p) { return p.value[2] === '-' ? '' : rTxt(p.value[2]); },
      };
      var tooltipFor = function (p) {
        var d = p.data;
        if (!d) return '';
        var rows = [
          { name: 'r ' + methodName, value: fmtR(R[d.a][d.b]), color: p.color },
          { name: 'Пар значений (n)', value: String(Nn[d.a][d.b]) },
        ];
        if (d.a !== d.b) rows.push({ name: 'p-уровень', value: pTxt(P[d.a][d.b]) + (P[d.a][d.b] >= 0.05 ? ' — незначимо' : '') });
        return VS.tooltipHtml(ctx, vars[d.a].name + ' × ' + vars[d.b].name, rows);
      };
      var xAxis = VS.axis(ctx, 'x', { type: 'category', data: names });
      xAxis.axisLine.show = false;
      xAxis.splitLine = { show: false };
      var yAxis = VS.axis(ctx, 'y', { type: 'category', data: names, inverse: true });
      yAxis.axisLine = { show: false };
      yAxis.splitLine = { show: false };
      yAxis.axisLabel.width = 170;
      yAxis.axisLabel.overflow = 'truncate';
      var series = [{
        type: 'heatmap', name: 'r', data: main,
        itemStyle: { borderColor: ctx.theme.background, borderWidth: 2, borderRadius: 3 },
        label: labelStyle,
        emphasis: { itemStyle: { borderColor: ctx.theme.text, borderWidth: 1.5 } },
      }];
      if (weak.length) {
        series.push({
          type: 'heatmap', name: 'незначимые', data: weak,
          itemStyle: { color: faint, borderColor: ctx.theme.background, borderWidth: 2, borderRadius: 3 },
          label: labelStyle,
          emphasis: { itemStyle: { borderColor: ctx.theme.text, borderWidth: 1.5 } },
        });
      }
      var a = ctx.area;
      ctx.correlation = { names: vars.map(function (v) { return v.name; }), r: R, n: Nn, p: P, order: order };
      return {
        series: series,
        xAxis: xAxis,
        yAxis: yAxis,
        // квадратные ячейки: ширина сетки подбирается под высоту
        grid: VS.grid(ctx, { right: legW + Math.max(0, a.width - legW - 170 - k * cell) * 0.5 }),
        visualMap: {
          type: 'continuous', min: -1, max: 1, seriesIndex: 0, dimension: 2, calculable: false, show: showLegend,
          orient: 'vertical', right: a.right, top: a.top + 10, itemWidth: 12, itemHeight: Math.max(80, Math.min(260, a.height - 60)),
          inRange: { color: colors.slice() },
          text: ['+1', '−1'], textGap: 6,
          textStyle: { color: ctx.theme.muted, fontSize: ctx.fontSize - 1, fontFamily: ctx.font },
        },
        tooltip: { trigger: 'item', formatter: tooltipFor },
        legend: false,
      };

      // ------------------------------------------------------------ матрица диаграмм рассеяния
      function splom() {
        var use = order.slice(0, MAX_SPLOM);
        if (order.length > MAX_SPLOM) ctx.warnings.push('В матрице диаграмм рассеяния показаны первые ' + MAX_SPLOM + ' параметров из ' + order.length);
        var kk = use.length;
        var C = ctx.column('color'), N = ctx.column('name');
        var groups = C ? VS.util.uniq(C.raw.filter(Boolean)) : [''];
        var area = ctx.area;
        var sf = Math.max(9, ctx.fontSize - 2);
        var lf = sf + 'px ' + ctx.font;
        var padL = 8 + use.reduce(function (m, vi) {
          var st = VS.stats(vars[vi].num);
          return Math.max(m, VS.measureText(ctx.fmt(st.max), lf), VS.measureText(ctx.fmt(st.min), lf));
        }, 0);
        var padB = sf + 12;
        var cw = (area.width - padL) / kk, ch = (area.height - padB) / kk;
        var gap = Math.min(10, Math.max(4, Math.min(cw, ch) * 0.06));
        var grids = [], xAxes = [], yAxes = [], series = [], graphic = [];
        // параметры с разбросом в десятки раз — на логарифмической шкале
        var isLog = {};
        if (s['corr.autoLog'] !== false) {
          use.forEach(function (vi) {
            var v = vars[vi].num.filter(function (x) { return x !== null; }).sort(function (x, y) { return x - y; });
            if (v.length > 4 && v[0] > 0 && M.quantile(v, 0.95) / M.quantile(v, 0.05) >= 25) isLog[vi] = true;
          });
        }
        var ps = Number(s['corr.pointSize']) || 4;
        var bins = Number(s['corr.bins']) || 10;
        var axisBase = function (show, which) {
          return {
            type: 'value', scale: true, splitNumber: 3, boundaryGap: ['5%', '5%'],
            axisLine: { show: true, lineStyle: { color: ctx.theme.axis } }, axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: show, color: ctx.theme.muted, fontSize: sf, fontFamily: ctx.font, hideOverlap: true, showMinLabel: false, showMaxLabel: false, formatter: function (v) { return ctx.fmt(v); } },
          };
        };
        use.forEach(function (vi, i) {
          use.forEach(function (vj, j) {
            var left = area.left + padL + j * cw + gap / 2, top = area.top + i * ch + gap / 2;
            var w = cw - gap, h = ch - gap;
            if (i < j) {
              // верхний треугольник — коэффициент
              var r = R[vi][vj];
              var weakR = r === null || (signifOn && P[vi][vj] >= 0.05);
              var bg = weakR ? faint : VS.color.mix(VS.color.scale(colors, (r + 1) / 2), ctx.theme.background, 0.35);
              graphic.push({ type: 'rect', left: left, top: top, shape: { width: w, height: h, r: 3 }, style: { fill: bg }, silent: true });
              graphic.push({
                type: 'text', x: left + w / 2, y: top + h / 2, silent: true,
                style: {
                  text: rTxt(r), fill: weakR ? ctx.theme.muted : Math.abs(r) > 0.7 ? '#ffffff' : ctx.theme.text,
                  font: 'bold ' + Math.max(10, Math.min(22, Math.min(w, h) * (0.18 + 0.2 * Math.abs(r || 0)))) + 'px ' + ctx.font,
                  align: 'center', verticalAlign: 'middle',
                },
              });
              return;
            }
            var gi = grids.length;
            grids.push({ left: left, top: top, width: w, height: h, show: true, borderColor: ctx.theme.grid, borderWidth: 1, backgroundColor: 'transparent' });
            var xa = axisBase(i === kk - 1, 'x');
            xa.gridIndex = gi;
            if (isLog[vj]) { xa.type = 'log'; xa.logBase = 10; }
            var ya = axisBase(j === 0 && i !== j, 'y');
            ya.gridIndex = gi;
            if (isLog[vi] && i !== j) { ya.type = 'log'; ya.logBase = 10; }
            if (i === j) {
              // диагональ — гистограмма и название параметра
              var lg = !!isLog[vi];
              var tf = function (v) { return lg ? Math.log10(v) : v; };
              var inv = function (v) { return lg ? Math.pow(10, v) : v; };
              var vals = vars[vi].num.filter(function (v) { return v !== null && (!lg || v > 0); }).map(tf);
              var st = VS.stats(vals);
              var bw = (st.max - st.min) / bins || 1;
              var counts = new Array(bins).fill(0);
              vals.forEach(function (v) { counts[Math.min(bins - 1, Math.floor((v - st.min) / bw))]++; });
              xa.min = inv(st.min);
              xa.max = inv(st.max);
              xa.scale = false;
              ya.min = 0;
              ya.axisLabel.show = false;
              ya.axisLine.show = false;
              xAxes.push(xa);
              yAxes.push(ya);
              series.push({
                type: 'bar', xAxisIndex: gi, yAxisIndex: gi, silent: false, name: '__hist',
                barWidth: Math.max(1, (w / bins) * 0.9),
                data: counts.map(function (cnt, b) { return { value: [inv(st.min + (b + 0.5) * bw), cnt], range: [inv(st.min + b * bw), inv(st.min + (b + 1) * bw)], v: vi }; }),
                itemStyle: { color: VS.color.alpha(ctx.palette[0], 0.45), borderRadius: [1, 1, 0, 0] },
                tooltip: {
                  formatter: function (p) {
                    return VS.tooltipHtml(ctx, vars[p.data.v].name, [
                      { name: 'Интервал', value: ctx.fmt(p.data.range[0]) + ' – ' + ctx.fmt(p.data.range[1]) },
                      { name: 'Значений', value: String(p.value[1]) },
                    ]);
                  },
                },
              });
              var lines = VS.wrapText(vars[vi].name + (lg ? ' (лог.)' : ''), 'bold ' + sf + 'px ' + ctx.font, w - 10).slice(0, 3);
              graphic.push({
                type: 'text', left: left + 5, top: top + 4, silent: true, z: 20,
                style: { text: lines.join('\n'), fill: ctx.theme.text, font: 'bold ' + sf + 'px ' + ctx.font, lineHeight: sf + 3, backgroundColor: VS.color.alpha(ctx.theme.background, 0.75), padding: [1, 2] },
              });
              return;
            }
            xAxes.push(xa);
            yAxes.push(ya);
            groups.forEach(function (g, gIdx) {
              var data = [];
              vars[vj].num.forEach(function (x, row) {
                var y = vars[vi].num[row];
                if (x === null || y === null || (isLog[vj] && x <= 0) || (isLog[vi] && y <= 0)) return;
                if (C && C.raw[row] !== g) return;
                data.push({ value: [x, y], row: row });
              });
              var color = ctx.color(g || undefined, gIdx);
              series.push({
                type: 'scatter', name: g || vars[vi].name, xAxisIndex: gi, yAxisIndex: gi, data: data, symbolSize: ps,
                itemStyle: { color: VS.color.alpha(color, 0.7), borderColor: ctx.theme.background, borderWidth: 0.5 },
                emphasis: { itemStyle: { color: color, borderColor: ctx.theme.text, borderWidth: 1 } },
                tooltip: {
                  formatter: function (p) {
                    var row = p.data.row;
                    var rows = [
                      { name: vars[vj].name, value: ctx.fmt(p.value[0]), color: color },
                      { name: vars[vi].name, value: ctx.fmt(p.value[1]) },
                    ];
                    if (C) rows.push({ name: C.name, value: C.raw[row] });
                    return VS.tooltipHtml(ctx, N ? N.raw[row] : '', rows);
                  },
                },
              });
            });
          });
        });
        ctx.correlation = { names: vars.map(function (v) { return v.name; }), r: R, n: Nn, p: P, order: order };
        var out = { grid: grids, xAxis: xAxes, yAxis: yAxes, series: series, graphic: graphic, tooltip: { trigger: 'item' } };
        if (!C) out.legend = false;
        return out;
      }
    },
  });
})(window.VS);

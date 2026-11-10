(function (VS) {
  'use strict';

  var M = VS.math;

  // Описательная статистика группы значений (в пространстве шкалы: на логарифмической — по log10)
  function describe(values, mode, log) {
    var tv = log ? values.map(function (v) { return Math.log10(v); }) : values.slice();
    var sorted = tv.slice().sort(function (a, b) { return a - b; });
    var n = sorted.length;
    var q = function (p) { return M.quantile(sorted, p); };
    var q1 = q(0.25), med = q(0.5), q3 = q(0.75);
    var lo, hi;
    if (mode === 'minmax') {
      lo = sorted[0];
      hi = sorted[n - 1];
    } else if (mode === 'p10') {
      lo = q(0.1);
      hi = q(0.9);
    } else if (mode === 'p5') {
      lo = q(0.05);
      hi = q(0.95);
    } else {
      // Тьюки: усы до крайних значений в пределах 1,5 межквартильного размаха
      var iqr = q3 - q1;
      lo = q1;
      hi = q3;
      sorted.forEach(function (v) {
        if (v >= q1 - 1.5 * iqr && v < lo) lo = v;
        if (v <= q3 + 1.5 * iqr && v > hi) hi = v;
      });
    }
    var back = function (v) { return log ? Math.pow(10, v) : v; };
    var arith = M.mean(values);
    var geo = Math.pow(10, M.mean(values.filter(function (v) { return v > 0; }).map(Math.log10)));
    return {
      n: n, q1: back(q1), med: back(med), q3: back(q3), lo: back(lo), hi: back(hi),
      min: back(sorted[0]), max: back(sorted[n - 1]), mean: arith, geo: isFinite(geo) ? geo : null,
      tv: tv,
    };
  }

  // Детерминированный «разброс» точек, чтобы они не прыгали при перерисовке
  function jitter(i) {
    var x = Math.sin((i + 1) * 12.9898) * 43758.5453;
    return x - Math.floor(x) - 0.5;
  }

  VS.registerTemplate({
    id: 'boxplot',
    order: 42,
    name: 'Ящик с усами (boxplot)',
    category: 'Распределение',
    description: 'Разброс значений по группам: медиана, квартили, усы и выбросы. Варианты с точками, «скрипичный» и горизонтальный.',
    icon: '<svg viewBox="0 0 48 36"><g stroke="var(--c1)" stroke-width="1.8" fill="none"><line x1="12" y1="4" x2="12" y2="10"/><line x1="12" y1="24" x2="12" y2="31"/><line x1="9" y1="4" x2="15" y2="4"/><line x1="9" y1="31" x2="15" y2="31"/><rect x="7" y="10" width="10" height="14" rx="1.5" fill="var(--c1)" fill-opacity=".25"/><line x1="7" y1="16" x2="17" y2="16" stroke-width="2.6"/><line x1="33" y1="9" x2="33" y2="15"/><line x1="33" y1="25" x2="33" y2="30"/><line x1="30" y1="9" x2="36" y2="9"/><line x1="30" y1="30" x2="36" y2="30"/><rect x="28" y="15" width="10" height="10" rx="1.5" fill="var(--c1)" fill-opacity=".25"/><line x1="28" y1="21" x2="38" y2="21" stroke-width="2.6"/></g><circle cx="33" cy="4" r="1.6" fill="var(--c1)"/></svg>',
    variants: [
      { name: 'Ящик с усами', settings: { 'box.kind': 'box', 'box.points': 'outliers', 'box.horizontal': false } },
      {
        name: 'Ящики с точками', settings: { 'box.kind': 'box', 'box.points': 'all', 'box.horizontal': false },
        icon: '<svg viewBox="0 0 48 36"><g stroke="var(--c1)" stroke-width="1.6" fill="none"><rect x="8" y="10" width="12" height="14" rx="1.5"/><line x1="8" y1="16" x2="20" y2="16" stroke-width="2.4"/><rect x="28" y="14" width="12" height="11" rx="1.5"/><line x1="28" y1="20" x2="40" y2="20" stroke-width="2.4"/></g><g fill="var(--c2)" opacity=".8"><circle cx="11" cy="7" r="1.5"/><circle cx="16" cy="13" r="1.5"/><circle cx="12" cy="20" r="1.5"/><circle cx="17" cy="27" r="1.5"/><circle cx="31" cy="11" r="1.5"/><circle cx="36" cy="18" r="1.5"/><circle cx="33" cy="23" r="1.5"/><circle cx="37" cy="29" r="1.5"/></g></svg>',
      },
      {
        name: 'Скрипичная диаграмма', settings: { 'box.kind': 'violin', 'box.points': 'none', 'box.horizontal': false },
        icon: '<svg viewBox="0 0 48 36"><path d="M14 3 C 11 9, 6 13, 7 19 C 8 25, 12 29, 14 33 C 16 29, 20 25, 21 19 C 22 13, 17 9, 14 3 Z" fill="var(--c1)" fill-opacity=".3" stroke="var(--c1)" stroke-width="1.5"/><path d="M34 6 C 31 12, 27 18, 29 24 C 30 28, 33 30, 34 32 C 35 30, 38 28, 39 24 C 41 18, 37 12, 34 6 Z" fill="var(--c2)" fill-opacity=".3" stroke="var(--c2)" stroke-width="1.5"/><rect x="12.5" y="14" width="3" height="9" fill="var(--c1)"/><rect x="32.5" y="19" width="3" height="7" fill="var(--c2)"/></svg>',
      },
      {
        name: 'Горизонтальный', settings: { 'box.kind': 'box', 'box.points': 'outliers', 'box.horizontal': true },
        icon: '<svg viewBox="0 0 48 36"><g stroke="var(--c1)" stroke-width="1.8" fill="none"><line x1="4" y1="10" x2="12" y2="10"/><line x1="28" y1="10" x2="38" y2="10"/><rect x="12" y="5" width="16" height="10" rx="1.5" fill="var(--c1)" fill-opacity=".25"/><line x1="19" y1="5" x2="19" y2="15" stroke-width="2.6"/><line x1="8" y1="26" x2="18" y2="26"/><line x1="34" y1="26" x2="44" y2="26"/><rect x="18" y="21" width="16" height="10" rx="1.5" fill="var(--c1)" fill-opacity=".25"/><line x1="27" y1="21" x2="27" y2="31" stroke-width="2.6"/></g></svg>',
      },
    ],
    bindings: [
      { key: 'group', name: 'Группы (категории)', dataType: 'text', optional: true, description: 'Пласт, куст, скважина, месяц… Без групп — отдельный ящик для каждой колонки значений' },
      { key: 'values', name: 'Значения', dataType: 'number', multiple: true, description: 'Несколько колонок при заданных группах — ящики рядом, разными цветами' },
      { key: 'label', name: 'Название точки', dataType: 'text', optional: true, description: 'Для подсказок у выбросов и точек (например, номер скважины)' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    autoBind: function (cols) {
      var num = cols.filter(function (c) { return c.type === 'number'; });
      var txt = cols.filter(function (c) { return c.type !== 'number'; });
      var group = VS.findColumn(txt, [/(пласт|объект|групп|категор|куст|зона|месторожд|formation|zone|group|field)/i]) || txt[0];
      var label = txt.filter(function (c) { return c !== group; })[0];
      var out = { values: group ? num.slice(0, 1).map(function (c) { return c.index; }) : num.map(function (c) { return c.index; }) };
      if (group) out.group = group.index;
      if (label) out.label = label.index;
      return out;
    },
    sections: [
      {
        id: 'box',
        title: 'Ящики и точки',
        items: [
          { key: 'box.kind', label: 'Вид', type: 'radio', options: [['box', 'Ящик с усами'], ['violin', 'Скрипичная']], default: 'box', help: 'Скрипичная диаграмма показывает форму распределения (ядерная оценка плотности) и узкий ящик внутри' },
          { key: 'box.whiskers', label: 'Усы', type: 'select', options: [['tukey', '1,5 межквартильного размаха (Тьюки)'], ['minmax', 'Минимум — максимум'], ['p10', '10-й — 90-й перцентиль'], ['p5', '5-й — 95-й перцентиль']], default: 'tukey', help: 'Значения за пределами усов считаются выбросами' },
          { key: 'box.points', label: 'Точки', type: 'radio', options: [['none', 'Нет'], ['outliers', 'Выбросы'], ['all', 'Все']], default: 'outliers' },
          { key: 'box.mean', label: 'Отметка среднего', type: 'select', options: [['none', 'Нет'], ['arith', 'Среднее арифметическое'], ['geo', 'Среднее геометрическое']], default: 'arith', help: 'Геометрическое — для логнормальных величин (проницаемость)' },
          { key: 'box.horizontal', label: 'Горизонтально', type: 'toggle', default: false },
          { key: 'box.sort', label: 'Порядок групп', type: 'select', options: [['none', 'Как в данных'], ['asc', 'По медиане, по возрастанию'], ['desc', 'По медиане, по убыванию'], ['name', 'По названию']], default: 'none' },
          { key: 'box.n', label: 'Число значений (n) у подписи группы', type: 'toggle', default: true },
          { key: 'box.width', label: 'Ширина ящиков', type: 'range', min: 0.2, max: 0.95, step: 0.05, default: 0.6 },
          { key: 'box.opacity', label: 'Заливка ящиков', type: 'range', min: 0, max: 1, step: 0.05, default: 0.22 },
          { key: 'box.pointSize', label: 'Размер точек', type: 'range', min: 2, max: 12, step: 0.5, default: 5, show: function (s) { return s['box.points'] !== 'none'; } },
        ],
      },
      VS.axisSection({ xLabel: 'Ось групп', yLabel: 'Ось значений' }),
    ],
    sample: {
      data: (function () {
        // Проницаемость по керну — логнормальное распределение по пластам
        var rows = [['Пласт', 'Скважина', 'Проницаемость, мД']];
        var seed = 7;
        var u = function () { seed = (seed * 9301 + 49297) % 233280; return (seed + 0.5) / 233281; };
        var normal = function () { return Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); };
        var well = 1001;
        [['АС10', 14, 0.85, 34], ['АС11', 38, 0.75, 46], ['БС10', 115, 0.6, 52], ['БС11', 62, 0.95, 40], ['ЮС1', 4.5, 1.05, 38]].forEach(function (f) {
          for (var i = 0; i < f[3]; i++) {
            var k = f[1] * Math.exp(f[2] * normal());
            rows.push([f[0], 'Скв. ' + (well++), k < 10 ? k.toFixed(2) : k.toFixed(1)]);
          }
        });
        rows.push(['БС10', 'Скв. 1290', '1450'], ['АС11', 'Скв. 1291', '2,1'], ['ЮС1', 'Скв. 1292', '180']);
        return rows;
      })(),
      bindings: { group: 0, label: 1, values: [2] },
      settings: {
        title: 'Проницаемость коллекторов по пластам',
        subtitle: 'Исследования керна, мД. Ящик — квартили, линия — медиана, ромб — среднее геометрическое',
        footer: 'Источник: демонстрационные данные',
        'yAxis.log': true, 'yAxis.title': 'Проницаемость, мД', 'box.mean': 'geo',
      },
    },
    legendNames: function (ctx) {
      var v = ctx.columnsOf('values');
      return ctx.has('group') && v.length > 1 ? v.map(function (c) { return c.name; }) : null;
    },
    build: function (ctx) {
      var s = ctx.s;
      var vals = ctx.columnsOf('values');
      if (!vals.length) return VS.empty(ctx, 'Привяжите числовые колонки «Значения» на вкладке «Данные»');
      var G = ctx.column('group'), N = ctx.column('label');
      var log = !!s['yAxis.log'];
      var horizontal = !!s['box.horizontal'];
      var violin = s['box.kind'] === 'violin';
      var pointsMode = s['box.points'];
      var meanMode = s['box.mean'];
      var skippedLog = 0;

      // группы → категории оси; без групп каждая колонка — своя категория
      var cats = G ? VS.util.uniq(G.raw.filter(Boolean)) : vals.map(function (c) { return c.name; });
      var seriesCols = G ? vals : [null];
      var K = seriesCols.length;
      var stats = seriesCols.map(function (col) {
        return cats.map(function (cat, ci) {
          var c = col || vals[ci];
          var list = [], rows = [];
          c.num.forEach(function (v, i) {
            if (v === null || (G && G.raw[i] !== cat)) return;
            if (log && v <= 0) { skippedLog++; return; }
            list.push(v);
            rows.push(i);
          });
          if (!list.length) return null;
          var st = describe(list, s['box.whiskers'], log);
          st.values = list;
          st.rows = rows;
          return st;
        });
      });
      if (skippedLog) ctx.warnings.push('На логарифмической шкале пропущено значений ≤ 0: ' + skippedLog);
      if (!stats.some(function (r) { return r.some(Boolean); })) return VS.empty(ctx, 'Нет числовых значений для построения');

      // порядок категорий
      var order = cats.map(function (_, i) { return i; });
      var sortMode = s['box.sort'];
      if (sortMode === 'asc' || sortMode === 'desc') {
        var medOf = function (i) { var st = stats[0][i]; return st ? st.med : -Infinity; };
        order.sort(function (a, b) { return sortMode === 'asc' ? medOf(a) - medOf(b) : medOf(b) - medOf(a); });
      } else if (sortMode === 'name') {
        order.sort(function (a, b) { return String(cats[a]).localeCompare(String(cats[b]), 'ru', { numeric: true }); });
      }
      var catLabels = order.map(function (ci) {
        if (!s['box.n']) return cats[ci];
        var n = stats.reduce(function (a, r) { return a + (r[ci] ? r[ci].n : 0); }, 0);
        return cats[ci] + '\n{n|n = ' + n + '}';
      });

      var width = Number(s['box.width']) || 0.6;
      var opacity = s['box.opacity'] === undefined ? 0.22 : Number(s['box.opacity']);
      var ptSize = Number(s['box.pointSize']) || 5;
      var bg = ctx.theme.background;

      // координаты: категория (позиция по индексу) + значение; для горизонтального — оси меняются местами
      function pt(api, cat, v, off) {
        var p = horizontal ? api.coord([v, cat]) : api.coord([cat, v]);
        if (horizontal) p[1] += off;
        else p[0] += off;
        return p;
      }
      function slot(api, k) {
        var band = horizontal ? api.size([0, 1])[1] : api.size([1, 0])[0];
        var group = band * width;
        return { center: (k - (K - 1) / 2) * (group / K), w: (group / K) * (K > 1 ? 0.88 : 1) };
      }
      // отрезок вдоль оси значений или поперёк неё в пикселях
      function seg(a, b, style) {
        return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: style };
      }

      var series = [];
      seriesCols.forEach(function (col, k) {
        var name = col ? col.name : vals[0].name;
        var color = col ? ctx.color(col.name, k) : ctx.color(undefined, 0);
        var dark = VS.color.mix(color, ctx.theme.text, 0.35);
        var dens = [];
        var data = [];
        order.forEach(function (ci, pos) {
          var st = stats[k][ci];
          if (!st) return;
          if (violin) {
            var lo = Math.min.apply(null, st.tv), hi = Math.max.apply(null, st.tv);
            var d = M.kde(st.tv, 48, lo, hi);
            var mx = d.reduce(function (a, p) { return Math.max(a, p[1]); }, 0) || 1;
            dens[pos] = d.map(function (p) { return [log ? Math.pow(10, p[0]) : p[0], p[1] / mx]; });
          }
          var mv = meanMode === 'geo' ? st.geo : meanMode === 'arith' ? st.mean : null;
          data.push({
            value: [pos, st.lo, st.q1, st.med, st.q3, st.hi, st.min, st.max],
            st: st, cat: cats[ci], meanValue: mv,
          });
        });
        series.push({
          type: 'custom',
          name: name,
          color: color,
          itemStyle: { color: color },
          encode: horizontal ? { y: 0, x: [1, 2, 3, 4, 5, 6, 7], tooltip: [3] } : { x: 0, y: [1, 2, 3, 4, 5, 6, 7], tooltip: [3] },
          data: data,
          z: 2,
          renderItem: function (params, api) {
            var item = data[params.dataIndexInside];
            if (!item) return null;
            var st = item.st;
            var pos = api.value(0);
            var sl = slot(api, k);
            var c = sl.center, w = sl.w;
            var children = [];
            var thin = { stroke: color, lineWidth: 1.4 };
            if (violin) {
              var d = dens[pos] || [];
              var half = w / 2;
              var left = d.map(function (p) { return pt(api, pos, p[0], c - p[1] * half); });
              var right = d.slice().reverse().map(function (p) { return pt(api, pos, p[0], c + p[1] * half); });
              children.push({ type: 'polygon', shape: { points: left.concat(right), smooth: 0.25 }, style: { fill: VS.color.alpha(color, Math.max(0.15, opacity + 0.1)), stroke: color, lineWidth: 1.4 } });
              var iw = Math.max(4, w * 0.12);
              children.push(seg(pt(api, pos, st.lo, c), pt(api, pos, st.hi, c), { stroke: dark, lineWidth: 1.2 }));
              var a = pt(api, pos, st.q1, c - iw / 2), b = pt(api, pos, st.q3, c + iw / 2);
              children.push({ type: 'rect', shape: { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]) }, style: { fill: dark } });
              var m = pt(api, pos, st.med, c);
              children.push({ type: 'circle', shape: { cx: m[0], cy: m[1], r: Math.max(2.5, iw * 0.42) }, style: { fill: bg, stroke: dark, lineWidth: 1 } });
            } else {
              var cap = w * 0.45;
              children.push(seg(pt(api, pos, st.lo, c), pt(api, pos, st.q1, c), thin));
              children.push(seg(pt(api, pos, st.q3, c), pt(api, pos, st.hi, c), thin));
              children.push(seg(pt(api, pos, st.lo, c - cap / 2), pt(api, pos, st.lo, c + cap / 2), thin));
              children.push(seg(pt(api, pos, st.hi, c - cap / 2), pt(api, pos, st.hi, c + cap / 2), thin));
              var p1 = pt(api, pos, st.q1, c - w / 2), p3 = pt(api, pos, st.q3, c + w / 2);
              children.push({
                type: 'rect',
                shape: { x: Math.min(p1[0], p3[0]), y: Math.min(p1[1], p3[1]), width: Math.abs(p3[0] - p1[0]), height: Math.max(1, Math.abs(p3[1] - p1[1])), r: 2 },
                style: { fill: VS.color.alpha(color, opacity), stroke: color, lineWidth: 1.5 },
              });
              children.push(seg(pt(api, pos, st.med, c - w / 2), pt(api, pos, st.med, c + w / 2), { stroke: dark, lineWidth: 2.6 }));
            }
            if (item.meanValue !== null && item.meanValue !== undefined && (!log || item.meanValue > 0)) {
              var mc = pt(api, pos, item.meanValue, c);
              var r = Math.max(3.5, Math.min(6, w * 0.09));
              children.push({ type: 'polygon', shape: { points: [[mc[0], mc[1] - r], [mc[0] + r, mc[1]], [mc[0], mc[1] + r], [mc[0] - r, mc[1]]] }, style: { fill: bg, stroke: dark, lineWidth: 1.5 } });
            }
            return { type: 'group', children: children };
          },
        });

        // точки: выбросы или все значения (отдельная серия — у каждой точки своя подсказка)
        if (pointsMode !== 'none') {
          var pts = [];
          order.forEach(function (ci, pos) {
            var st = stats[k][ci];
            if (!st) return;
            st.values.forEach(function (v, j) {
              var out = v < st.lo - 1e-12 || v > st.hi + 1e-12;
              if (pointsMode === 'outliers' && !out) return;
              var row = st.rows[j];
              pts.push({ value: [pos, v, jitter(row), out ? 1 : 0], name: N ? N.raw[row] : '', rowIndex: row, cat: cats[ci] });
            });
          });
          if (pts.length) {
            series.push({
              type: 'custom',
              name: name,
              color: color,
              itemStyle: { color: color },
              encode: horizontal ? { y: 0, x: 1 } : { x: 0, y: 1 },
              data: pts,
              z: 3,
              renderItem: function (params, api) {
                var sl = slot(api, k);
                var spread = pointsMode === 'all' ? sl.w * 0.7 : sl.w * 0.25;
                var p = pt(api, api.value(0), api.value(1), sl.center + api.value(2) * spread);
                var outl = api.value(3) === 1;
                return {
                  type: 'circle',
                  shape: { cx: p[0], cy: p[1], r: ptSize / 2 },
                  style: {
                    fill: pointsMode === 'all' && !outl ? VS.color.alpha(color, 0.55) : outl && pointsMode === 'outliers' ? bg : color,
                    stroke: pointsMode === 'all' && !outl ? bg : color,
                    lineWidth: pointsMode === 'all' && !outl ? 0.6 : 1.3,
                  },
                };
              },
            });
          }
        }
      });

      var ref = VS.refLine(ctx, horizontal);
      if (ref) series[0].markLine = ref;

      // оси
      var catAxis = VS.axis(ctx, horizontal ? 'y' : 'x', { type: 'category', data: catLabels, settingsKey: 'xAxis', inverse: horizontal });
      catAxis.axisLabel.rich = { n: { color: ctx.theme.faint, fontSize: Math.max(9, ctx.fontSize - 2), fontFamily: ctx.font, lineHeight: ctx.fontSize + 4 } };
      catAxis.axisLabel.lineHeight = ctx.fontSize + 4;
      if (horizontal) {
        catAxis.axisLabel.formatter = function (v) { return String(v).replace('\n', '  '); };
        catAxis.axisLine.show = false;
      }
      var valAxis = VS.axis(ctx, horizontal ? 'x' : 'y', { type: 'value', settingsKey: 'yAxis' });
      if (horizontal) {
        delete valAxis.position;
        if (valAxis.name) valAxis.nameGap = 30;
      }
      if (log) {
        valAxis.type = 'log';
        valAxis.logBase = 10;
        valAxis.minorSplitLine = { show: !!s['yAxis.grid'], lineStyle: { color: VS.color.mix(ctx.theme.grid, ctx.theme.background, 0.55) } };
        valAxis.minorTick = { show: false, splitNumber: 9 };
        if (valAxis.min === undefined) valAxis.min = function (v) { return Math.pow(10, Math.floor(Math.log10(v.min))); };
        if (valAxis.max === undefined) valAxis.max = function (v) { return Math.pow(10, Math.ceil(Math.log10(v.max))); };
      } else if (valAxis.min === undefined) {
        valAxis.scale = true;
      }

      var fmt = function (v) { return v === null || v === undefined ? '—' : ctx.fmt(v); };
      return {
        series: series,
        xAxis: horizontal ? valAxis : catAxis,
        yAxis: horizontal ? catAxis : valAxis,
        grid: VS.grid(ctx, { top: !horizontal && valAxis.name ? 0 : 0, right: 6 }),
        legend: K > 1 ? undefined : false,
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            var d = p.data || {};
            if (d.st) {
              var st = d.st;
              var head = d.cat + (K > 1 ? ' · ' + p.seriesName : '');
              var whiskerName = { tukey: 'ус (1,5 IQR)', minmax: 'ус', p10: 'P10/P90', p5: 'P5/P95' }[s['box.whiskers']] || 'ус';
              var rows = [
                { name: 'Значений', value: ctx.fmt(st.n, { noAffix: true, decimals: 0 }) },
                { name: 'Максимум', value: fmt(st.max) },
                { name: 'Верхний ' + whiskerName, value: fmt(st.hi) },
                { name: '3-й квартиль (75%)', value: fmt(st.q3) },
                { name: 'Медиана', value: fmt(st.med), color: p.color },
                { name: '1-й квартиль (25%)', value: fmt(st.q1) },
                { name: 'Нижний ' + whiskerName, value: fmt(st.lo) },
                { name: 'Минимум', value: fmt(st.min) },
                { name: 'Среднее арифметическое', value: fmt(st.mean) },
              ];
              if (st.geo !== null) rows.push({ name: 'Среднее геометрическое', value: fmt(st.geo) });
              return VS.tooltipHtml(ctx, head, rows);
            }
            return VS.tooltipHtml(ctx, d.name || d.cat, [
              { name: (K > 1 ? p.seriesName : vals[0].name), value: fmt(p.value[1]), color: p.color },
              { name: G ? G.name : 'Колонка', value: d.cat },
            ].concat(p.value[3] === 1 ? [{ name: 'Выброс', value: 'за пределами усов' }] : []));
          },
        },
      };
    },
  });
})(window.VS);

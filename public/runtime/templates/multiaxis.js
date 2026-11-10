(function (VS) {
  'use strict';

  var RE = VS.petroPatterns;
  var KEYS = ['values', 'y2', 'y3', 'y4', 'y5'];
  var MAX_AXES = KEYS.length;
  var GOR = [/газов[а-яё]*\s*фактор/i, /^(гф|gor)(?![a-zа-яё])/i, /\b(wgor|fgor)/i];

  function matches(list, name) {
    return (Array.isArray(list) ? list : [list]).some(function (re) { return re.test(name); });
  }
  function bound(b, key) {
    var v = b && b[key];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== '';
  }

  // Раздел настроек одной оси: виден, только если к оси привязаны колонки
  function axisSectionFor(n) {
    var k = 'ax' + n;
    var key = KEYS[n - 1];
    var isPanels = function (s) { return s['multi.layout'] === 'panels'; };
    return {
      id: k,
      title: 'Ось Y ' + n + (n === 1 ? ' (основная)' : ''),
      show: function (s, b) { return n === 1 || bound(b, key); },
      items: [
        { key: k + '.title', label: 'Название оси', type: 'text', default: '', placeholder: 'например, Давление, атм', help: 'Пусто — название колонки, если она на оси одна' },
        { key: k + '.unit', label: 'Единицы в подсказке', type: 'text', default: '', placeholder: 'атм' },
        { key: k + '.type', label: 'Вид', type: 'select', options: [['line', 'Линии'], ['area', 'Области'], ['bar', 'Столбцы'], ['scatter', 'Точки'], ['step', 'Ступени']], default: 'line' },
        { key: k + '.stack', label: 'С накоплением', type: 'toggle', default: false, show: function (s) { return s[k + '.type'] === 'area' || s[k + '.type'] === 'bar'; } },
        { key: k + '.side', label: 'Сторона', type: 'radio', options: [['auto', 'Авто'], ['left', 'Слева'], ['right', 'Справа']], default: 'auto' },
        { key: k + '.min', label: 'Минимум', type: 'text', default: '', placeholder: 'авто' },
        { key: k + '.max', label: 'Максимум', type: 'text', default: '', placeholder: 'авто' },
        { key: k + '.zero', label: 'Шкала от нуля', type: 'toggle', default: n === 1, help: 'Выключите для величин вроде давления, которые далеки от нуля' },
        { key: k + '.log', label: 'Логарифмическая шкала', type: 'toggle', default: false },
        { key: k + '.agg', label: 'Повторы значений X', type: 'radio', options: [['sum', 'Сумма'], ['avg', 'Среднее']], default: n === 1 ? 'sum' : 'avg', help: 'Если на одно значение X приходится несколько строк (например, несколько скважин на дату)' },
        { key: k + '.weight', label: 'Высота панели', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1, show: isPanels },
      ],
    };
  }

  var sections = [
    {
      id: 'multi',
      title: 'Оси и панели',
      items: [
        { key: 'multi.layout', label: 'Компоновка', type: 'radio', options: [['axes', 'Один график'], ['panels', 'Панели']], default: 'axes', help: 'Панели: каждая ось Y — отдельный график с общей осью X. Нагляднее, когда шкал больше трёх' },
        { key: 'multi.colorAxes', label: 'Окрашивать оси в цвет серий', type: 'toggle', default: true },
        { key: 'multi.lineWidth', label: 'Толщина линий', type: 'range', min: 1, max: 6, step: 0.5, default: 2 },
        { key: 'multi.symbols', label: 'Маркеры точек', type: 'radio', options: [['none', 'Нет'], ['auto', 'Авто'], ['all', 'Все']], default: 'auto' },
        { key: 'multi.connectNulls', label: 'Соединять пропуски', type: 'toggle', default: false },
        { key: 'multi.zoom', label: 'Ползунок масштаба по X', type: 'toggle', default: false },
        { key: 'multi.events', label: 'Подписи событий', type: 'toggle', default: true, show: function (s, b) { return bound(b, 'event'); } },
        { type: 'heading', label: 'Ось X' },
        { key: 'xAxis.title', label: 'Название оси X', type: 'text', default: '' },
        { key: 'multi.xType', label: 'Тип оси X', type: 'radio', options: [['auto', 'Авто'], ['category', 'Категории']], default: 'auto', help: 'Авто: даты — шкала времени, числа — числовая шкала' },
        { key: 'xAxis.rotate', label: 'Поворот подписей', type: 'select', options: [['auto', 'Авто'], ['0', '0°'], ['30', '30°'], ['45', '45°'], ['90', '90°']], default: 'auto' },
        { key: 'xAxis.grid', label: 'Вертикальные линии сетки', type: 'toggle', default: false },
        { key: 'yAxis.grid', label: 'Горизонтальные линии сетки', type: 'toggle', default: true },
      ],
    },
  ];
  for (var n = 1; n <= MAX_AXES; n++) sections.push(axisSectionFor(n));

  VS.registerTemplate({
    id: 'multiaxis',
    order: 22,
    name: 'Несколько осей Y',
    category: 'Динамика',
    description: 'До пяти вертикальных шкал на одном графике или панели с общей осью X: дебиты, обводнённость, давление, газовый фактор…',
    icon: '<svg viewBox="0 0 48 36"><line x1="6" y1="4" x2="6" y2="32" stroke="var(--c1)" stroke-width="1.6"/><line x1="42" y1="4" x2="42" y2="32" stroke="var(--c2)" stroke-width="1.6"/><line x1="46" y1="4" x2="46" y2="32" stroke="var(--c3)" stroke-width="1.6"/><polyline points="8,10 16,12 24,16 32,20 40,24" fill="none" stroke="var(--c1)" stroke-width="2.2"/><polyline points="8,28 16,24 24,18 32,13 40,9" fill="none" stroke="var(--c2)" stroke-width="2.2"/><polyline points="8,18 16,21 24,20 32,24 40,22" fill="none" stroke="var(--c3)" stroke-width="2" stroke-dasharray="3 2"/></svg>',
    variants: [
      { name: 'Несколько осей Y', settings: { 'multi.layout': 'axes' } },
      {
        name: 'Панели с общей осью X', settings: { 'multi.layout': 'panels' },
        description: 'Каждая шкала — своя панель, время общее.',
        icon: '<svg viewBox="0 0 48 36"><g fill="none" stroke-width="2"><polyline points="5,10 15,7 25,9 35,6 44,8" stroke="var(--c1)"/><polyline points="5,21 15,19 25,16 35,15 44,13" stroke="var(--c2)"/><polyline points="5,28 15,30 25,29 35,31 44,30" stroke="var(--c3)"/></g><g stroke="currentColor" stroke-opacity=".25"><line x1="4" y1="13" x2="44" y2="13"/><line x1="4" y1="24" x2="44" y2="24"/><line x1="4" y1="33" x2="44" y2="33"/></g></svg>',
      },
    ],
    bindings: [
      { key: 'label', name: 'Ось X', dataType: 'any', description: 'Даты, годы, категории или числа (глубина, накопленная добыча)' },
      { key: 'values', name: 'Ось Y 1', dataType: 'number', multiple: true, description: 'Основная шкала (например, дебиты)' },
      { key: 'y2', name: 'Ось Y 2', dataType: 'number', multiple: true, optional: true, description: 'Колонки со своей шкалой, например обводнённость, %' },
      { key: 'y3', name: 'Ось Y 3', dataType: 'number', multiple: true, optional: true, description: 'Например, давление' },
      { key: 'y4', name: 'Ось Y 4', dataType: 'number', multiple: true, optional: true },
      { key: 'y5', name: 'Ось Y 5', dataType: 'number', multiple: true, optional: true },
      { key: 'event', name: 'События (отметки)', dataType: 'text', optional: true, description: 'Текст в строке — вертикальная отметка (ГТМ, смена режима)' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    defaults: { 'layout.mobileAspect': '3:4' }, // на телефоне шкалам нужна высота
    autoBind: function (cols) {
      var used = {};
      var free = function () { return cols.filter(function (c) { return !used[c.index]; }); };
      var take = function (c) { if (c) used[c.index] = 1; return c; };
      var x = take(VS.findColumn(cols, RE.date) || cols.find(function (c) { return c.type === 'date'; }) || cols.find(function (c) { return c.type !== 'number'; }) || cols[0]);
      var out = {};
      if (x) out.label = x.index;
      var well = take(VS.findColumn(free(), RE.well)); // «Скв. 1012» может распознаться как число
      if (well) out.filter = well.index;
      var ev = take(VS.findColumn(free().filter(function (c) { return c.type !== 'number'; }), RE.event));
      if (ev) out.event = ev.index;
      // по названиям: дебиты — ось 1, обводнённость — 2, давление — 3, газовый фактор и газ — 4
      var groups = [[], [], [], []];
      free().filter(function (c) { return c.type === 'number'; }).forEach(function (c) {
        if (matches(RE.wc, c.name)) groups[1].push(c.index);
        else if (matches(RE.pressure, c.name)) groups[2].push(c.index);
        else if (matches(GOR, c.name) || matches(RE.gas, c.name)) groups[3].push(c.index);
        else groups[0].push(c.index);
      });
      groups.filter(function (g) { return g.length; }).forEach(function (g, i) { out[KEYS[i]] = g; });
      return out;
    },
    sections: sections,
    sample: {
      data: (function () {
        // мониторинг добывающей скважины: рост обводнённости, снижение Pзаб, ГРП и смена ЭЦН
        var rows = [['Дата', 'Дебит жидкости, м³/сут', 'Дебит нефти, м³/сут', 'Обводнённость, %', 'Забойное давление, атм', 'Газовый фактор, м³/т', 'Мероприятие']];
        var seed = 11;
        var u = function () { seed = (seed * 9301 + 49297) % 233280; return (seed + 0.5) / 233281 - 0.5; };
        for (var m = 0; m < 48; m++) {
          var y = 2021 + Math.floor(m / 12), mo = m % 12 + 1;
          var liq = 95 + m * 0.9 + (m >= 20 ? 38 : 0) + (m >= 34 ? 22 : 0) + u() * 6;
          var wc = Math.min(96, 18 + m * 1.15 + (m >= 20 ? 9 : 0) + u() * 2.5);
          var pz = 118 - m * 0.55 - (m >= 20 ? 14 : 0) - (m >= 34 ? 9 : 0) + u() * 3;
          var gor = 62 + m * 0.35 + (pz < 95 ? (95 - pz) * 1.8 : 0) + u() * 3;
          rows.push([y + '-' + (mo < 10 ? '0' : '') + mo, liq.toFixed(1), (liq * (1 - wc / 100)).toFixed(1), wc.toFixed(1), pz.toFixed(1), gor.toFixed(0), m === 20 ? 'ГРП' : m === 34 ? 'Смена ЭЦН' : '']);
        }
        return rows;
      })(),
      bindings: { label: 0, values: [1, 2], y2: [3], y3: [4], y4: [5], event: 6 },
      settings: {
        title: 'Скважина 1024: режим работы',
        subtitle: 'Дебиты, обводнённость, забойное давление и газовый фактор',
        footer: 'Источник: демонстрационные данные',
        'ax1.title': 'Дебит, м³/сут', 'ax1.unit': 'м³/сут',
        'ax2.title': 'Обводнённость, %', 'ax2.unit': '%', 'ax2.min': '0', 'ax2.max': '100',
        'ax3.title': 'Pзаб, атм', 'ax3.unit': 'атм', 'ax3.zero': false,
        'ax4.title': 'ГФ, м³/т', 'ax4.unit': 'м³/т', 'ax4.zero': false, 'ax4.type': 'scatter',
      },
    },
    legendKind: 'line',
    legendNames: function (ctx) {
      var names = [];
      KEYS.forEach(function (key) {
        ctx.columnsOf(key).forEach(function (c) { if (names.indexOf(c.name) < 0) names.push(c.name); });
      });
      return names.length > 1 ? names : null;
    },
    tooltip: function (ctx) {
      return { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: ctx.theme.axis, type: 'dashed' } } };
    },
    build: function (ctx) {
      var s = ctx.s;
      var X = ctx.column('label');
      var axes = [];
      KEYS.forEach(function (key, i) {
        var cols = ctx.columnsOf(key);
        if (cols.length) axes.push({ n: i + 1, key: 'ax' + (i + 1), cols: cols });
      });
      if (!X || !axes.length) return VS.empty(ctx, 'Привяжите «Ось X» и колонки хотя бы к «Оси Y 1»');

      // группировка по X: повторы суммируются или усредняются (настройка оси)
      var specs = {};
      axes.forEach(function (a) {
        a.cols.forEach(function (c) { specs[a.n + ':' + c.index] = { col: c, how: s[a.key + '.agg'] === 'avg' ? 'avg' : 'sum' }; });
      });
      var agg = VS.aggregate(ctx, X, specs);
      var nPts = agg.keys.length;
      if (!nPts) return VS.empty(ctx, 'Нет значений по оси X');
      var xMode = s['multi.xType'] === 'category' ? 'category' : agg.dates ? 'time' : X.type === 'number' ? 'value' : 'category';
      var xv = function (i) { return xMode === 'time' ? agg.dates[i].getTime() : xMode === 'value' ? VS.parseNumber(agg.keys[i]) : agg.keys[i]; };

      var panels = s['multi.layout'] === 'panels' && axes.length > 1;
      var a = ctx.area;
      var zoomOn = s['multi.zoom'] && !ctx.forExport;
      var lw = Number(s['multi.lineWidth']) || 2;
      var symMode = s['multi.symbols'];
      var showSym = symMode === 'all' || (symMode === 'auto' && nPts <= 30);
      var colorAxes = s['multi.colorAxes'] !== false;
      var font = ctx.fontSize + 'px ' + ctx.font;
      var colorIndex = 0;

      // цвет и серии каждой оси
      axes.forEach(function (ax) {
        ax.colors = ax.cols.map(function (c) { return ctx.color(c.name, colorIndex++); });
        ax.data = ax.cols.map(function (c) { return agg.values[ax.n + ':' + c.index]; });
        ax.title = s[ax.key + '.title'] || (ax.cols.length === 1 ? ax.cols[0].name : '');
        var st = VS.stats([].concat.apply([], ax.data));
        // ширина подписей оси — по самым длинным значениям
        var labW = Math.max(VS.measureText(ctx.fmt(st.max), font), VS.measureText(ctx.fmt(st.min), font), VS.measureText(ctx.fmt((st.max + st.min) / 2), font));
        ax.width = Math.ceil(labW) + 14 + (ax.title ? ctx.fontSize + 10 : 0);
        ax.labW = Math.ceil(labW);
      });
      // на узком экране шкалы съели бы всю область построения — переходим к панелям
      if (!panels && axes.length > 1) {
        var axesW = axes.reduce(function (sum, ax) { return sum + ax.width + 6; }, 0);
        if (axesW > a.width * 0.45) panels = true;
      }

      // стороны: авто — по очереди слева и справа
      var sideCount = { left: 0, right: 0 }, sideOffset = { left: 0, right: 0 };
      axes.forEach(function (ax, j) {
        var side = s[ax.key + '.side'];
        ax.side = side === 'left' || side === 'right' ? side : panels ? 'left' : j % 2 === 0 ? 'left' : 'right';
        if (!panels) {
          ax.offset = sideOffset[ax.side];
          sideOffset[ax.side] += ax.width + 6;
          sideCount[ax.side]++;
        } else ax.offset = 0;
      });

      var grids = [], xAxes = [], yAxes = [], series = [];
      var nameH = panels ? 18 : 0;
      var lastGrid = 0;
      if (panels) {
        var gap = a.height > 380 ? 30 : 22;
        var weights = axes.map(function (ax) { return Math.max(0.2, Number(s[ax.key + '.weight']) || 1); });
        var totalW = weights.reduce(function (p, c) { return p + c; }, 0);
        // снизу — подписи и название оси X; слева/справа — общая ширина подписей, чтобы панели совпадали по краям
        var xLabH = ctx.fontSize + 12 + (s['xAxis.title'] ? ctx.fontSize + 12 : 0);
        var avail = a.height - (zoomOn ? 46 : 0) - gap * (axes.length - 1) - nameH - xLabH;
        var padL = 0, padR = 0;
        axes.forEach(function (ax) {
          if (ax.side === 'right') padR = Math.max(padR, ax.labW + 10);
          else padL = Math.max(padL, ax.labW + 10);
        });
        var top = a.top + nameH;
        lastGrid = axes.length - 1;
        axes.forEach(function (ax, j) {
          var h = Math.max(24, (avail * weights[j]) / totalW);
          grids.push({ left: a.left + padL, right: a.right + Math.max(padR, 14), top: top, height: h, outerBoundsMode: 'none' });
          ax.grid = j;
          top += h + gap;
        });
      } else {
        grids.push(VS.grid(ctx, { bottom: zoomOn ? 44 : 0, top: 6 }));
        axes.forEach(function (ax) { ax.grid = 0; });
      }

      function addX(gi) {
        var ax = VS.axis(ctx, 'x', xMode === 'category' ? { type: 'category', data: agg.keys } : { type: xMode === 'time' ? 'time' : 'value' });
        ax.gridIndex = gi;
        ax.axisLine.show = true;
        if (xMode === 'time') VS.timeAxis(ax, agg.dates[agg.dates.length - 1] - agg.dates[0]);
        if (xMode === 'value') ax.scale = true;
        if (xMode === 'category') ax.boundaryGap = axes.some(function (q) { return s[q.key + '.type'] === 'bar'; });
        if (gi !== lastGrid) {
          ax.axisLabel.show = false;
          ax.name = undefined;
        }
        xAxes.push(ax);
        return xAxes.length - 1;
      }
      var xIndexOfGrid = {};
      grids.forEach(function (_, gi) { xIndexOfGrid[gi] = addX(gi); });

      axes.forEach(function (ax, j) {
        var k = ax.key;
        var y = VS.axis(ctx, 'y', { type: 'value', settingsKey: k });
        y.gridIndex = ax.grid;
        // на низких панелях — меньше делений, чтобы подписи не прореживались случайно
        if (panels) y.splitNumber = Math.max(2, Math.min(5, Math.floor(grids[ax.grid].height / 30)));
        y.position = ax.side;
        y.offset = ax.offset;
        var mainColor = ax.colors[0];
        // цвет оси — только если на ней одна серия, иначе связь «ось — линия» была бы ложной
        var tint = colorAxes && axes.length > 1 && ax.cols.length === 1 ? mainColor : null;
        y.splitLine = { show: !!s['yAxis.grid'] && (panels || j === 0), lineStyle: { color: ctx.theme.grid } };
        if (!panels && axes.length > 1) y.axisLine = { show: true, lineStyle: { color: tint || ctx.theme.axis, width: 1.2 } };
        if (tint) y.axisLabel.color = VS.color.mix(tint, ctx.theme.text, 0.25);
        y.scale = !s[k + '.zero'];
        if (s[k + '.log']) {
          y.type = 'log';
          y.logBase = 10;
          y.scale = true;
        }
        var type = s[k + '.type'] || 'line';
        if ((type === 'bar' || type === 'area') && !s[k + '.log']) y.scale = false;
        if (ax.title) {
          y.name = ax.title;
          if (panels) {
            y.nameLocation = 'end';
            y.nameGap = 8;
            y.nameTextStyle = { color: tint ? VS.color.mix(tint, ctx.theme.text, 0.25) : ctx.theme.muted, fontSize: ctx.fontSize, fontFamily: ctx.font, fontWeight: 'bold', align: ax.side === 'right' ? 'right' : 'left' };
          } else {
            y.nameLocation = 'middle';
            y.nameGap = ax.labW + 14;
            y.nameRotate = ax.side === 'right' ? -90 : 90;
            y.nameTruncate = { maxWidth: Math.max(60, a.height - 40) };
            y.nameTextStyle = { color: tint ? VS.color.mix(tint, ctx.theme.text, 0.25) : ctx.theme.muted, fontSize: ctx.fontSize, fontFamily: ctx.font, fontWeight: 'bold' };
          }
        } else y.name = undefined;
        yAxes.push(y);
        var yi = yAxes.length - 1;
        var xi = xIndexOfGrid[ax.grid];
        var unit = s[k + '.unit'] ? ' ' + s[k + '.unit'] : '';
        ax.cols.forEach(function (c, ci) {
          var color = ax.colors[ci];
          var arr = ax.data[ci];
          var pts = arr.map(function (v, i) {
            var yv = v === null || (s[k + '.log'] && v <= 0) ? '-' : v;
            return xMode === 'category' ? yv : [xv(i), yv];
          });
          var sr = {
            name: c.name, data: pts, xAxisIndex: xi, yAxisIndex: yi, color: color,
            emphasis: { focus: 'series' },
            tooltip: { valueFormatter: function (v) { return v === '-' || v === null || v === undefined ? '—' : ctx.fmt(v) + unit; } },
          };
          if (type === 'bar') {
            sr.type = 'bar';
            sr.barMaxWidth = 26;
            sr.itemStyle = { color: color, borderRadius: s[k + '.stack'] ? 0 : [2, 2, 0, 0] };
            if (s[k + '.stack']) sr.stack = k;
          } else if (type === 'scatter') {
            sr.type = 'scatter';
            sr.symbolSize = 6;
            sr.itemStyle = { color: color, borderColor: ctx.theme.background, borderWidth: 0.8 };
          } else {
            sr.type = 'line';
            sr.showSymbol = showSym;
            sr.symbol = 'circle';
            sr.symbolSize = 6;
            sr.connectNulls = !!s['multi.connectNulls'];
            sr.lineStyle = { width: lw, color: color };
            sr.itemStyle = { color: color, borderColor: ctx.theme.background, borderWidth: 1.2 };
            if (type === 'step') sr.step = 'end';
            if (type === 'area') {
              sr.areaStyle = { color: color, opacity: s[k + '.stack'] ? 0.75 : 0.18 };
              if (s[k + '.stack']) {
                sr.stack = k;
                sr.lineStyle.width = Math.min(lw, 1.4);
              }
            }
          }
          series.push(sr);
        });
      });

      // события: вертикальные отметки на всех панелях, подписи — только на верхней
      var E = ctx.column('event');
      if (E && s['multi.events'] !== false) {
        var marks = [];
        agg.rows.forEach(function (list, i) {
          var labels = VS.util.uniq(list.map(function (r) { return E.raw[r]; }).filter(Boolean));
          if (labels.length) marks.push({ xAxis: xv(i), label: { formatter: labels.join(', ') } });
        });
        if (marks.length) {
          var seen = {};
          series.forEach(function (sr) {
            if (seen[sr.xAxisIndex]) return;
            seen[sr.xAxisIndex] = true;
            sr.markLine = {
              silent: true, symbol: 'none', animation: false,
              lineStyle: { color: ctx.theme.text, type: [3, 3], width: 1, opacity: 0.55 },
              label: {
                show: sr.xAxisIndex === 0, position: 'insideEndTop', color: ctx.theme.text, fontSize: ctx.fontSize - 1, fontFamily: ctx.font,
                backgroundColor: VS.color.alpha(ctx.theme.background, 0.85), padding: [1, 3],
              },
              data: marks,
            };
          });
        }
      }

      var out = { grid: grids, xAxis: xAxes, yAxis: yAxes, series: series };
      if (panels) out.axisPointer = { link: [{ xAxisIndex: 'all' }] };
      if (zoomOn) {
        var xIdx = xAxes.map(function (_, i) { return i; });
        out.dataZoom = [
          { type: 'inside', xAxisIndex: xIdx },
          {
            type: 'slider', xAxisIndex: xIdx, height: 20, bottom: a.bottom, left: a.left + 50, right: a.right + 50,
            borderColor: ctx.theme.grid, fillerColor: VS.color.alpha(ctx.palette[0], 0.12), textStyle: { color: ctx.theme.muted, fontSize: ctx.fontSize - 2 },
            dataBackground: { lineStyle: { color: ctx.theme.axis }, areaStyle: { color: ctx.theme.grid } },
          },
        ];
      }
      if (series.length < 2) out.legend = false;
      return out;
    },
  });
})(window.VS);

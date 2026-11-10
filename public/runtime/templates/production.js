(function (VS) {
  'use strict';

  var RE = VS.petroPatterns;

  VS.registerTemplate({
    id: 'production',
    order: 1,
    name: 'Профиль добычи',
    category: 'Разработка месторождений',
    description: 'Динамика добычи нефти, воды, жидкости, газа и закачки; обводнённость и давление на отдельной панели; отметки ГТМ.',
    icon: '<svg viewBox="0 0 48 36"><path d="M4 22 L10 12 L16 9 L24 10 L32 13 L40 16 L44 17 L44 24 L4 24 Z" fill="var(--c1)" opacity=".35"/><path d="M4 22 L10 15 L16 14 L24 17 L32 20 L40 22 L44 23 L44 24 L4 24 Z" fill="#7a4a1e"/><polyline points="4,33 12,32 20,30 28,28 36,27 44,26" fill="none" stroke="var(--c7)" stroke-width="1.8"/><line x1="4" y1="26.5" x2="44" y2="26.5" stroke="currentColor" stroke-opacity=".25"/></svg>',
    variants: [
      { name: 'Профиль добычи', settings: { 'prod.layout': 'panels' } },
      {
        name: 'Добыча и обводнённость', settings: { 'prod.layout': 'single', 'prod.style': 'lines' },
        description: 'Классический график: дебиты на левой оси, обводнённость — на правой.',
        icon: '<svg viewBox="0 0 48 36"><polyline points="4,10 12,8 20,12 28,16 36,20 44,24" fill="none" stroke="#7a4a1e" stroke-width="2.4"/><polyline points="4,28 12,24 20,18 28,14 36,10 44,8" fill="none" stroke="var(--c7)" stroke-width="2" stroke-dasharray="3 2"/></svg>',
      },
    ],
    bindings: [
      { key: 'date', name: 'Дата / период', dataType: 'any', match: RE.date },
      { key: 'oil', name: 'Нефть', dataType: 'number', optional: true, match: RE.oil, description: 'Дебит или добыча за период' },
      { key: 'water', name: 'Вода', dataType: 'number', optional: true, match: RE.water },
      { key: 'liquid', name: 'Жидкость', dataType: 'number', optional: true, match: RE.liquid, description: 'Если не задана — нефть + вода' },
      { key: 'gas', name: 'Газ', dataType: 'number', optional: true, match: RE.gas },
      { key: 'inj', name: 'Закачка', dataType: 'number', optional: true, match: RE.inj },
      { key: 'wc', name: 'Обводнённость, %', dataType: 'number', optional: true, match: RE.wc, description: 'Если не задана — рассчитывается как вода / жидкость' },
      { key: 'pressure', name: 'Давление', dataType: 'number', optional: true, match: RE.pressure },
      { key: 'event', name: 'Мероприятия (ГТМ)', dataType: 'text', optional: true, match: RE.event, description: 'Текст в строке — отметка на графике (ГРП, ЗБС, …)' },
      { key: 'filter', name: 'Скважина / объект', optional: true, match: RE.well, description: 'Переключатель; «Все» суммирует по дате' },
    ],
    defaults: { 'filter.all': true, 'filter.allLabel': 'Всё месторождение' },
    sections: [
      {
        id: 'prod',
        title: 'Профиль добычи',
        items: [
          { key: 'prod.layout', label: 'Компоновка', type: 'radio', options: [['panels', 'Панели'], ['single', 'Один график']], default: 'panels', help: 'Панели: дебиты, газ и обводнённость/давление — отдельно, с общей осью времени' },
          { key: 'prod.style', label: 'Дебиты', type: 'radio', options: [['area', 'Области'], ['lines', 'Линии'], ['bars', 'Столбцы']], default: 'area' },
          { key: 'prod.input', label: 'Данные в колонках', type: 'radio', options: [['rate', 'Дебиты (в сутки)'], ['volume', 'Объёмы за период']], default: 'rate', help: '«Объёмы за период» пересчитываются в среднесуточные дебиты по датам' },
          { key: 'prod.rateUnit', label: 'Единицы дебитов', type: 'text', default: 'м³/сут' },
          { key: 'prod.gasDiv', label: 'Газ показывать в', type: 'select', options: [['1', 'исходных единицах'], ['1000', 'тысячах'], ['1000000', 'миллионах']], default: '1000' },
          { key: 'prod.gasUnit', label: 'Единицы газа', type: 'text', default: 'тыс. м³/сут' },
          { key: 'prod.pressureUnit', label: 'Единицы давления', type: 'text', default: 'атм' },
          { key: 'prod.cum', label: 'Накопленная добыча нефти', type: 'toggle', default: false },
          { key: 'prod.cumDiv', label: 'Накопленную показывать в', type: 'select', options: [['1', 'исходных единицах'], ['1000', 'тысячах'], ['1000000', 'миллионах']], default: '1000', show: function (s) { return s['prod.cum']; } },
          { key: 'prod.cumUnit', label: 'Единицы накопленной', type: 'text', default: 'тыс. м³', show: function (s) { return s['prod.cum']; } },
          { key: 'prod.zoom', label: 'Ползунок масштаба по времени', type: 'toggle', default: true },
          { key: 'prod.events', label: 'Подписи мероприятий', type: 'toggle', default: true },
          { type: 'heading', label: 'Цвета' },
          { key: 'prod.oilColor', label: 'Нефть', type: 'color', default: '#7a4a1e' },
          { key: 'prod.waterColor', label: 'Вода', type: 'color', default: '#3987e5' },
          { key: 'prod.liquidColor', label: 'Жидкость', type: 'color', default: '#9aa5b1' },
          { key: 'prod.gasColor', label: 'Газ', type: 'color', default: '#e0a100' },
          { key: 'prod.injColor', label: 'Закачка', type: 'color', default: '#19a3b8' },
          { key: 'prod.wcColor', label: 'Обводнённость', type: 'color', default: '#4a3aa7' },
          { key: 'prod.pColor', label: 'Давление', type: 'color', default: '#e34948' },
        ],
      },
    ],
    sample: {
      data: (function () {
        // демонстрационный объект: выход на полку, падение, рост обводнённости, ППД с 2021 г.
        var rows = [['Дата', 'Нефть, м³/сут', 'Вода, м³/сут', 'Закачка, м³/сут', 'Пластовое давление, атм', 'ГТМ']];
        for (var m = 0; m < 96; m++) {
          var y = 2018 + Math.floor(m / 12), mo = m % 12 + 1;
          var t = m / 12;
          var oil = m < 10 ? 120 + m * 38 : 500 * Math.pow(1 + 0.6 * 0.45 * (t - 0.8), -1 / 0.6);
          if (m >= 58) oil *= 1.22; // ГРП
          var wc = 0.92 / (1 + Math.exp(-(t - 5) / 1.3));
          var water = oil * wc / (1 - wc);
          var inj = m >= 36 ? (oil + water) * (0.7 + 0.25 * Math.min(1, (m - 36) / 24)) : 0;
          var p = 250 - 9 * t + (m >= 36 ? 4.2 * (t - 3) : 0);
          rows.push([y + '-' + (mo < 10 ? '0' : '') + mo, oil.toFixed(1), water.toFixed(1), inj ? inj.toFixed(1) : '', p.toFixed(1), m === 36 ? 'Начало ППД' : m === 58 ? 'ГРП' : '']);
        }
        return rows;
      })(),
      bindings: { date: 0, oil: 1, water: 2, inj: 3, pressure: 4, event: 5 },
      settings: { title: 'Профиль добычи пласта ЮС1', subtitle: 'Среднесуточные дебиты, обводнённость и пластовое давление', footer: 'Источник: демонстрационные данные' },
    },
    legendKind: 'line',
    legendNames: function (ctx) {
      var names = [];
      var has = function (k) { return ctx.has(k); };
      if (has('oil')) names.push('Нефть');
      if (has('water') || (has('liquid') && has('oil'))) names.push('Вода');
      if (has('liquid') || (has('oil') && has('water'))) names.push('Жидкость');
      if (has('inj')) names.push('Закачка');
      if (has('gas')) names.push('Газ');
      if (ctx.s['prod.cum'] && has('oil')) names.push('Накопленная нефть');
      if (has('wc') || (has('water') && (has('oil') || has('liquid'))) || (has('liquid') && has('oil'))) names.push('Обводнённость');
      if (has('pressure') && ctx.s['prod.layout'] === 'panels') names.push('Давление');
      return names;
    },
    tooltip: function (ctx) {
      return {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: ctx.theme.axis, type: 'dashed' } },
      };
    },
    build: function (ctx) {
      var s = ctx.s;
      var D = ctx.column('date');
      var O = ctx.column('oil'), W = ctx.column('water'), L = ctx.column('liquid'), G = ctx.column('gas');
      var I = ctx.column('inj'), WC = ctx.column('wc'), P = ctx.column('pressure'), E = ctx.column('event');
      if (!D || !(O || L || I || G)) return VS.empty(ctx, 'Привяжите колонку «Дата / период» и хотя бы одну из: нефть, жидкость, газ, закачка');
      var agg = VS.aggregate(ctx, D, {
        oil: { col: O }, water: { col: W }, liquid: { col: L }, gas: { col: G }, inj: { col: I },
        wc: { col: WC, how: 'avg' }, p: { col: P, how: 'avg' },
      });
      var n = agg.keys.length;
      if (!n) return VS.empty(ctx, 'Нет строк с датами');
      var dates = agg.dates;
      var volume = s['prod.input'] === 'volume';
      var perDay = function (arr) {
        if (!arr) return null;
        return arr.map(function (v, i) { return v === null ? null : volume ? v / VS.periodDays(dates, i) : v; });
      };
      var oil = perDay(agg.values.oil), water = perDay(agg.values.water), liquid = perDay(agg.values.liquid);
      var gas = perDay(agg.values.gas), inj = perDay(agg.values.inj);
      if (gas) {
        var gd = Number(s['prod.gasDiv']) || 1;
        gas = gas.map(function (v) { return v === null ? null : v / gd; });
      }
      if (!liquid && oil && water) liquid = oil.map(function (v, i) { return v === null && water[i] === null ? null : (v || 0) + (water[i] || 0); });
      if (!water && oil && liquid) water = liquid.map(function (v, i) { return v === null || oil[i] === null ? null : Math.max(0, v - oil[i]); });
      var wc = agg.values.wc;
      // обводнённость в долях (FWCT/WWCT в RSM, 0…1) переводим в проценты
      if (wc && VS.stats(wc).max <= 1.0001) wc = wc.map(function (v) { return v === null ? null : v * 100; });
      if (!wc && water && liquid) wc = liquid.map(function (l, i) { return l > 0 && water[i] !== null ? (water[i] / l) * 100 : null; });
      var pr = agg.values.p;
      var cum = null;
      if (s['prod.cum'] && oil) {
        var acc = 0, cd = Number(s['prod.cumDiv']) || 1;
        cum = (agg.values.oil || []).map(function (v, i) {
          if (v !== null) acc += volume ? v : v * VS.periodDays(dates, i);
          return acc / cd;
        });
      }

      var panels = s['prod.layout'] === 'panels';
      var useTime = !!dates;
      var x = function (i) { return useTime ? dates[i].getTime() : agg.keys[i]; };
      var pts = function (arr) { return arr.map(function (v, i) { return useTime ? [x(i), v === null ? '-' : v] : v === null ? '-' : v; }); };
      var style = s['prod.style'];
      var rateUnit = s['prod.rateUnit'] || '';

      // ----- панели
      var gasPanel = panels && !!gas;
      var lowerPanel = panels && !!(wc || pr);
      var weights = [1, gasPanel ? 0.42 : 0, lowerPanel ? 0.6 : 0];
      var a = ctx.area;
      var zoomOn = s['prod.zoom'] && !ctx.forExport; // ползунок не нужен на картинке
      var zoomH = zoomOn ? 50 : ctx.fontSize + 12; // ползунок с подписями дат или только подписи дат
      var gap = 34;
      var used = weights.filter(Boolean).length;
      var nameH = 18; // место над первой панелью под названия осей
      var avail = a.height - zoomH - nameH - gap * (used - 1);
      var totalW = weights.reduce(function (p, c) { return p + c; }, 0);
      var grids = [], xAxes = [], yAxes = [], series = [];
      var top = a.top + nameH;
      var panelIndex = {};
      weights.forEach(function (wgt, k) {
        if (!wgt) return;
        var h = Math.max(60, (avail * wgt) / totalW);
        panelIndex[k] = grids.length;
        grids.push({ top: top, height: h });
        top += h + gap;
      });
      var lastGrid = grids.length - 1;
      // поля слева/справа задаются после построения осей — одинаковыми для всех панелей
      grids = grids.map(function (g) { return { left: a.left, right: a.right, top: g.top, height: g.height, outerBoundsMode: 'none' }; });
      var rightCount = {};

      function addX(gi) {
        var ax = VS.axis(ctx, 'x', useTime ? { type: 'time' } : { type: 'category', data: agg.keys });
        ax.gridIndex = gi;
        ax.axisLine.show = true;
        ax.splitLine = { show: !!s['xAxis.grid'], lineStyle: { color: ctx.theme.grid } };
        if (useTime) VS.timeAxis(ax, dates[dates.length - 1] - dates[0]);
        else ax.boundaryGap = style === 'bars';
        ax.axisLabel.show = gi === lastGrid;
        if (gi !== lastGrid) ax.name = undefined;
        xAxes.push(ax);
        return xAxes.length - 1;
      }
      function addY(gi, name, color, right, extra) {
        var ax = VS.axis(ctx, 'y', { type: 'value' });
        ax.gridIndex = gi;
        ax.name = name;
        ax.nameLocation = 'end';
        ax.nameGap = 10;
        ax.nameTextStyle = { color: color || ctx.theme.muted, fontSize: ctx.fontSize - 1, fontFamily: ctx.font, align: right ? 'right' : 'left', fontWeight: 'normal' };
        ax.position = right ? 'right' : 'left';
        if (right) rightCount[gi] = (rightCount[gi] || 0) + 1;
        ax.splitLine.show = !right && !!s['yAxis.grid'];
        if (right) ax.axisLabel.color = color;
        ax.min = undefined;
        ax.max = undefined;
        for (var k in extra || {}) ax[k] = extra[k];
        yAxes.push(ax);
        return yAxes.length - 1;
      }
      function rateSeries(name, arr, color, gi, xi, yi, opts) {
        opts = opts || {};
        var sr = {
          type: style === 'bars' && !opts.line ? 'bar' : 'line', name: name, data: pts(arr), xAxisIndex: xi, yAxisIndex: yi,
          color: color, showSymbol: false, symbol: 'circle', symbolSize: 5, connectNulls: false,
          lineStyle: { width: opts.width || 1.8, color: color, type: opts.dashed ? 'dashed' : 'solid' },
          itemStyle: { color: color },
          emphasis: { focus: 'series' },
          tooltip: { valueFormatter: function (v) { return v === '-' || v === null ? '—' : ctx.fmt(v) + (opts.unit !== undefined ? opts.unit : rateUnit ? ' ' + rateUnit : ''); } },
        };
        if (style === 'bars' && !opts.line) {
          sr.barMaxWidth = 18;
          if (opts.stack) sr.stack = opts.stack;
        }
        if (style === 'area' && opts.area) {
          sr.areaStyle = { color: color, opacity: opts.opacity || 0.85 };
          sr.lineStyle.width = 0.8;
          if (opts.stack) sr.stack = opts.stack;
        }
        series.push(sr);
        return sr;
      }

      // --- панель 1: дебиты
      var g0 = 0;
      var x0 = addX(g0);
      var y0 = addY(g0, rateUnit, null, false, { scale: false });
      if (style === 'area' && oil && water) {
        rateSeries('Нефть', oil, s['prod.oilColor'], g0, x0, y0, { area: true, stack: 'liq' });
        rateSeries('Вода', water, s['prod.waterColor'], g0, x0, y0, { area: true, stack: 'liq', opacity: 0.55 });
        if (liquid) rateSeries('Жидкость', liquid, s['prod.liquidColor'], g0, x0, y0, { line: true, width: 1.2 });
      } else {
        if (liquid) rateSeries('Жидкость', liquid, s['prod.liquidColor'], g0, x0, y0, { line: style === 'bars', width: 1.6 });
        if (oil) rateSeries('Нефть', oil, s['prod.oilColor'], g0, x0, y0, { area: style === 'area', width: 2.2 });
        if (water) rateSeries('Вода', water, s['prod.waterColor'], g0, x0, y0, { width: 1.8 });
      }
      if (inj) rateSeries('Закачка', inj, s['prod.injColor'], g0, x0, y0, { line: true, width: 1.6, dashed: true });
      if (gas && !panels) {
        var yG = addY(g0, s['prod.gasUnit'], s['prod.gasColor'], true, { splitLine: { show: false } });
        rateSeries('Газ', gas, s['prod.gasColor'], g0, x0, yG, { line: true, unit: ' ' + (s['prod.gasUnit'] || '') });
      }
      if (cum) {
        var yC = addY(g0, s['prod.cumUnit'], ctx.theme.text, true, { splitLine: { show: false } });
        rateSeries('Накопленная нефть', cum, ctx.theme.text, g0, x0, yC, { line: true, width: 1.4, dashed: true, unit: ' ' + (s['prod.cumUnit'] || '') });
      }

      // --- обводнённость: на правой оси (один график) или на нижней панели
      var wcColor = s['prod.wcColor'], pColor = s['prod.pColor'];
      if (!panels && wc) {
        var yW = addY(g0, 'обводн., %', wcColor, true, { max: 100, min: 0, splitLine: { show: false } });
        yAxes[yW].axisLabel.formatter = function (v) { return v + '%'; };
        rateSeries('Обводнённость', wc, wcColor, g0, x0, yW, { line: true, width: 2, unit: ' %' });
      }
      // --- панель газа
      if (gasPanel) {
        var g1 = panelIndex[1];
        var x1 = addX(g1);
        var y1 = addY(g1, s['prod.gasUnit'], s['prod.gasColor'], false);
        var gs = rateSeries('Газ', gas, s['prod.gasColor'], g1, x1, y1, { area: style === 'area', opacity: 0.35, unit: ' ' + (s['prod.gasUnit'] || '') });
        if (style === 'area') gs.lineStyle.width = 1.6;
      }
      // --- нижняя панель: обводнённость + давление
      if (lowerPanel) {
        var g2 = panelIndex[2];
        var x2 = addX(g2);
        if (wc) {
          var y2 = addY(g2, 'обводнённость, %', wcColor, false, { max: 100, min: 0 });
          yAxes[y2].axisLabel.formatter = function (v) { return v + '%'; };
          rateSeries('Обводнённость', wc, wcColor, g2, x2, y2, { line: true, width: 2, unit: ' %' });
        }
        if (pr) {
          var y3 = addY(g2, s['prod.pressureUnit'], pColor, !!wc, { scale: true, splitLine: { show: !wc && !!s['yAxis.grid'], lineStyle: { color: ctx.theme.grid } } });
          rateSeries('Давление', pr, pColor, g2, x2, y3, { line: true, width: 1.8, unit: ' ' + (s['prod.pressureUnit'] || '') });
        }
      }

      // --- мероприятия (ГТМ): вертикальные линии на всех панелях
      if (E && s['prod.events']) {
        var marks = [];
        agg.rows.forEach(function (list, i) {
          var labels = VS.util.uniq(list.map(function (r) { return E.raw[r]; }).filter(Boolean));
          if (labels.length) marks.push({ xAxis: x(i), label: { formatter: labels.join(', ') } });
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

      // общие поля панелей по ширине подписей осей: иначе панели сдвинуты и отметки ГТМ не совпадают по времени
      var lf = ctx.fontSize + 'px ' + ctx.font;
      var niceUp = function (v) {
        if (!(v > 0)) return v;
        var m = Math.pow(10, Math.floor(Math.log10(v)));
        return Math.ceil(v / m) * m;
      };
      var labelW = function (yi) {
        var ax = yAxes[yi], vals = [];
        series.forEach(function (sr) {
          if (sr.yAxisIndex !== yi) return;
          sr.data.forEach(function (d) { var v = Array.isArray(d) ? d[1] : d; if (typeof v === 'number') vals.push(v); });
        });
        var st = VS.stats(vals);
        var hi = typeof ax.max === 'number' ? ax.max : niceUp(st.max);
        var f = typeof ax.axisLabel.formatter === 'function' ? ax.axisLabel.formatter : function (v) { return ctx.fmt(v); };
        // подписи делений — «круглые» числа: меряем максимум шкалы и типичное промежуточное деление
        var lo = st.min < 0 ? -niceUp(-st.min) : hi / 4;
        return Math.ceil(Math.max(VS.measureText(String(f(hi)), lf), VS.measureText(String(f(lo)), lf)));
      };
      var padL = 0, padR = 0, rightUsed = {};
      yAxes.forEach(function (ax, yi) {
        var lw = labelW(yi);
        var w = lw + 10;
        // несколько правых осей: названия вдоль осей, иначе сверху они наезжают друг на друга
        if (ax.position === 'right' && rightCount[ax.gridIndex] > 1 && ax.name) {
          ax.nameLocation = 'middle';
          ax.nameRotate = -90;
          ax.nameGap = lw + 10;
          ax.nameTextStyle.align = 'center';
          w += ctx.fontSize + 8;
        }
        if (ax.position === 'right') {
          ax.offset = rightUsed[ax.gridIndex] || 0;
          rightUsed[ax.gridIndex] = ax.offset + w + 6;
          padR = Math.max(padR, rightUsed[ax.gridIndex]);
        } else padL = Math.max(padL, w);
      });
      grids.forEach(function (g) {
        g.left = a.left + padL;
        g.right = a.right + Math.max(padR, 14);
      });

      var xIdx = xAxes.map(function (_, i) { return i; });
      var out = {
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        series: series,
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
      };
      if (zoomOn) {
        out.dataZoom = [
          { type: 'inside', xAxisIndex: xIdx },
          {
            type: 'slider', xAxisIndex: xIdx, height: 20, bottom: a.bottom, left: a.left + 50, right: a.right + 50,
            borderColor: ctx.theme.grid, fillerColor: VS.color.alpha(ctx.palette[0], 0.12), textStyle: { color: ctx.theme.muted, fontSize: ctx.fontSize - 2 },
            dataBackground: { lineStyle: { color: ctx.theme.axis }, areaStyle: { color: ctx.theme.grid } },
            labelFormatter: useTime ? function (v) { var d = new Date(v); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); } : undefined,
          },
        ];
      }
      return out;
    },
  });
})(window.VS);

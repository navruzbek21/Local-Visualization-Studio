(function (VS) {
  'use strict';

  var RE = VS.petroPatterns;
  var LOG_RE = /^(RT|RES|ILD|ILM|LLD|LLS|RD|RS|RXO|MSFL|AT\d+|RDEP|RMED|RSHAL|HDRS|HMRS|КС|БК|ИК|БКЗ|МБК|R\d|RESD|RESM)/i;
  var REV_RE = /^(NPHI|TNPH|NPOR|ННК|НК|CNC)/i;
  var COLORS = [
    [/^(GR|ГК|SGR|CGR|ГАММА)/i, '#1baf7a'], [LOG_RE, '#e34948'], [/^(NPHI|TNPH|NPOR|НК|ННК)/i, '#2a78d6'],
    [/^(RHOB|RHOZ|DEN|ГГК|ПЛОТН)/i, '#d6458a'], [/^(DT|AC|АК|DTC)/i, '#7c5cd6'], [/^(SP|ПС)/i, '#1f2328'], [/^(CALI|ДС|КВ|CAL)/i, '#9aa5b1'],
    [/^(PHI|PHIE|КП|ПОРИСТ)/i, '#0e8a8a'], [/^(SW|КВ|ВОДОНАС)/i, '#3987e5'],
  ];
  var mnemonic = function (name) { return String(name).split(/[,(\s]/)[0]; };

  VS.registerTemplate({
    id: 'welllog',
    order: 5,
    name: 'Планшет ГИС',
    category: 'Разработка месторождений',
    description: 'Каротажные кривые по глубине в отдельных дорожках: лог. шкала для сопротивлений, литология, отметки ВНК/ГНК. Импорт LAS.',
    icon: '<svg viewBox="0 0 48 36"><g stroke="currentColor" stroke-opacity=".25" fill="none"><rect x="3" y="3" width="13" height="30"/><rect x="18" y="3" width="13" height="30"/><rect x="33" y="3" width="12" height="30"/></g><path d="M8 3 L11 7 L6 11 L12 15 L7 19 L13 23 L8 27 L10 33" fill="none" stroke="#1baf7a" stroke-width="1.6"/><path d="M21 3 L22 8 L27 12 L23 16 L29 20 L22 25 L24 33" fill="none" stroke="#e34948" stroke-width="1.6"/><rect x="33" y="12" width="12" height="9" fill="#eda100" opacity=".55"/></svg>',
    bindings: [
      { key: 'depth', name: 'Глубина', dataType: 'number', match: RE.depth },
      { key: 'curves', name: 'Кривые', dataType: 'number', multiple: true, description: 'Каждая — отдельная дорожка' },
      { key: 'zone', name: 'Литология / пласт', dataType: 'text', optional: true, match: [/(литолог|пласт|зона|lith|zone|формац|horizon|горизонт|facies)/i] },
      { key: 'filter', name: 'Скважина', optional: true, match: RE.well },
    ],
    autoBind: function (cols) {
      var used = {};
      var d = VS.findColumn(cols, RE.depth) || cols.find(function (c) { return c.type === 'number'; });
      if (d) used[d.index] = 1;
      var z = VS.findColumn(cols, [/(литолог|пласт|зона|lith|zone|формац|horizon|горизонт|facies)/i], used);
      if (z) used[z.index] = 1;
      var w = VS.findColumn(cols, RE.well, used);
      if (w) used[w.index] = 1;
      var curves = cols.filter(function (c) { return !used[c.index] && c.type === 'number'; }).slice(0, 6);
      var out = { depth: d && d.index, curves: curves.map(function (c) { return c.index; }) };
      if (z) out.zone = z.index;
      if (w) out.filter = w.index;
      return out;
    },
    common: ['layout', 'colors', 'number', 'animation', 'appearance', 'filter', 'tooltip'],
    legend: false,
    sections: [
      {
        id: 'log',
        title: 'Планшет',
        items: [
          { key: 'log.from', label: 'Глубина от', type: 'text', default: '', placeholder: 'авто' },
          { key: 'log.to', label: 'Глубина до', type: 'text', default: '', placeholder: 'авто' },
          { key: 'log.logScale', label: 'Логарифмические кривые', type: 'text', default: 'auto', help: '«auto» — сопротивления (RT, ILD, LLD, БК, ИК…) или мнемоники через запятую' },
          { key: 'log.reverse', label: 'Обратная шкала', type: 'text', default: 'auto', help: '«auto» — нейтронная пористость (NPHI, НК); или мнемоники через запятую' },
          { key: 'log.fill', label: 'Заливка первой кривой', type: 'toggle', default: true },
          { key: 'log.width', label: 'Толщина линий', type: 'range', min: 0.5, max: 3, step: 0.1, default: 1.2 },
          { key: 'log.markers', label: 'Отметки глубин', type: 'textarea', default: '', placeholder: '2531,4: ВНК\n2490: Кровля пласта', help: 'По строке: «глубина: подпись»' },
          { key: 'log.zoneAlpha', label: 'Прозрачность интервалов', type: 'range', min: 0, max: 0.6, step: 0.02, default: 0.16 },
          { key: 'log.zoom', label: 'Ползунок глубины', type: 'toggle', default: true },
          { key: 'log.unit', label: 'Единицы глубины', type: 'text', default: 'м' },
        ],
      },
    ],
    sample: {
      data: (function () {
        var rows = [['DEPT, м', 'GR, API', 'RT, Ом·м', 'NPHI, д.ед.', 'RHOB, г/см³', 'Литология']];
        var seed = 3;
        var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 - 0.5; };
        var lith = function (d) {
          if (d < 2462) return 'Глина';
          if (d < 2476) return 'Песчаник';
          if (d < 2481) return 'Глина';
          if (d < 2502) return 'Песчаник';
          if (d < 2508) return 'Известняк';
          return 'Глина';
        };
        for (var d = 2440; d <= 2525; d += 0.2) {
          var l = lith(d);
          var gr = l === 'Глина' ? 105 : l === 'Известняк' ? 35 : 48;
          var oilZone = (d >= 2462 && d < 2476) || (d >= 2481 && d < 2494.6);
          var rt = l === 'Глина' ? 3.2 : l === 'Известняк' ? 60 : oilZone ? 38 : 1.6;
          var nphi = l === 'Глина' ? 0.36 : l === 'Известняк' ? 0.08 : 0.22;
          var rhob = l === 'Глина' ? 2.45 : l === 'Известняк' ? 2.65 : 2.25;
          rows.push([d.toFixed(1), (gr + rnd() * 14).toFixed(1), (rt * Math.exp(rnd() * 0.5)).toFixed(2), (nphi + rnd() * 0.04).toFixed(3), (rhob + rnd() * 0.05).toFixed(3), l]);
        }
        return rows;
      })(),
      bindings: { depth: 0, curves: [1, 2, 3, 4], zone: 5 },
      settings: {
        title: 'Планшет ГИС, скв. 1012', subtitle: 'Интервал 2440–2525 м: ГК, сопротивление, нейтронная пористость, плотность',
        footer: 'Источник: синтетические кривые для демонстрации', 'log.markers': '2494,6: ВНК\n2462: Кровля пласта',
        'colors.overrides': 'Песчаник: #eda100\nГлина: #8d8d8d\nИзвестняк: #4f9ad6',
      },
    },
    tooltip: function () { return { trigger: 'axis', axisPointer: { type: 'line', axis: 'y' } }; },
    build: function (ctx) {
      var s = ctx.s;
      var Dp = ctx.column('depth');
      var curves = ctx.columnsOf('curves').filter(function (c) { return !Dp || c.index !== Dp.index; });
      if (!Dp || !curves.length) return VS.empty(ctx, 'Привяжите колонку «Глубина» и хотя бы одну кривую');
      var Z = ctx.column('zone');
      // строки по возрастанию глубины
      var order = Dp.num.map(function (d, i) { return i; }).filter(function (i) { return Dp.num[i] !== null; }).sort(function (a, b) { return Dp.num[a] - Dp.num[b]; });
      if (!order.length) return VS.empty(ctx);
      var dMin = VS.parseNumber(s['log.from']), dMax = VS.parseNumber(s['log.to']);
      if (dMin === null) dMin = Dp.num[order[0]];
      if (dMax === null) dMax = Dp.num[order[order.length - 1]];
      var listOf = function (txt) { return String(txt || '').split(/[,;\s]+/).filter(Boolean).map(function (x) { return x.toUpperCase(); }); };
      var logList = listOf(s['log.logScale']), revList = listOf(s['log.reverse']);
      var isLog = function (c) {
        var mn = mnemonic(c.name).toUpperCase();
        if (logList.length && logList[0] !== 'AUTO') return logList.indexOf(mn) >= 0;
        if (LOG_RE.test(mn)) return true;
        var st = VS.stats(c.num.filter(function (v) { return v > 0; }));
        return st.min > 0 && st.max / st.min > 300;
      };
      var isRev = function (c) {
        var mn = mnemonic(c.name).toUpperCase();
        if (revList.length && revList[0] !== 'AUTO') return revList.indexOf(mn) >= 0;
        return REV_RE.test(mn);
      };
      var colorOf = function (c, i) {
        if (ctx.overrides[c.name]) return ctx.overrides[c.name];
        var mn = mnemonic(c.name);
        for (var k = 0; k < COLORS.length; k++) if (COLORS[k][0].test(mn)) return COLORS[k][1];
        return ctx.palette[i % ctx.palette.length];
      };

      // интервалы литологии/пластов
      var zones = [];
      if (Z) {
        var cur = null;
        order.forEach(function (i) {
          var z = Z.raw[i], d = Dp.num[i];
          if (cur && cur.name === z) cur.bottom = d;
          else {
            if (cur) cur.bottom = d;
            cur = z ? { name: z, top: d, bottom: d } : null;
            if (cur) zones.push(cur);
          }
        });
      }
      var zoneNames = VS.util.uniq(zones.map(function (z) { return z.name; }));
      var zoneColor = function (name) { return ctx.color(name, zoneNames.indexOf(name) + 3); };

      // разметка дорожек
      var a = ctx.area;
      var zoneW = Z ? 74 : 0;
      var zoomOn = s['log.zoom'] && !ctx.forExport;
      var depthW = 52, sliderW = zoomOn ? 34 : 0, gap = 8, headH = 46;
      var n = curves.length;
      var trackW = Math.max(40, (a.width - depthW - sliderW - zoneW - gap * n) / n);
      var grids = [], xAxes = [], yAxes = [], series = [];
      var top = a.top + headH;
      var height = Math.max(60, a.height - headH);
      var x = a.left + depthW;
      var lineW = Number(s['log.width']) || 1.2;
      var markers = String(s['log.markers'] || '').split(/\r?\n/).map(function (line) {
        var i = line.indexOf(':');
        if (i < 0) return null;
        var d = VS.parseNumber(line.slice(0, i));
        return d === null ? null : { depth: d, label: line.slice(i + 1).trim() };
      }).filter(Boolean);
      var unit = s['log.unit'] || '';

      var span = Math.abs(dMax - dMin);
      var depthDec = span < 5 ? 2 : span < 60 ? 1 : 0;
      function yAxisFor(gi, showLabels) {
        return {
          type: 'value', gridIndex: gi, inverse: true, min: dMin, max: dMax,
          axisLine: { show: true, lineStyle: { color: ctx.theme.axis } }, axisTick: { show: showLabels },
          axisLabel: { show: showLabels, color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 1, formatter: function (v) { return ctx.fmt(v, { noAffix: true, noCompact: true, decimals: depthDec }); } },
          splitLine: { show: true, lineStyle: { color: ctx.theme.grid } },
          name: showLabels ? 'Глубина' + (unit ? ', ' + unit : '') : undefined, nameLocation: 'start', nameGap: 12,
          nameTextStyle: { color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 1, align: 'right' },
        };
      }
      var zoneMarkArea = Z ? {
        silent: true,
        data: zones.map(function (z) { return [{ yAxis: z.top, itemStyle: { color: VS.color.alpha(zoneColor(z.name), Number(s['log.zoneAlpha']) || 0) } }, { yAxis: z.bottom }]; }),
      } : undefined;
      var markLineFor = function (withLabel) {
        if (!markers.length) return undefined;
        return {
          silent: true, symbol: 'none', animation: false,
          lineStyle: { color: '#e34948', width: 1.4, type: 'dashed' },
          label: { show: withLabel, position: 'insideEndTop', formatter: function (p) { return p.data.label + ' ' + ctx.fmt(p.data.yAxis, { noAffix: true, noCompact: true }); }, color: '#c0392b', fontFamily: ctx.font, fontSize: ctx.fontSize - 1, fontWeight: 'bold' },
          data: markers.map(function (m) { return { yAxis: m.depth, label: m.label }; }),
        };
      };

      // дорожка литологии
      if (Z) {
        grids.push({ left: x, top: top, width: zoneW - 6, height: height });
        xAxes.push({ type: 'value', gridIndex: 0, min: 0, max: 1, show: true, position: 'top', axisLabel: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLine: { lineStyle: { color: ctx.theme.axis } }, name: Z.name, nameLocation: 'middle', nameGap: 14, nameTextStyle: { color: ctx.theme.text, fontFamily: ctx.font, fontSize: ctx.fontSize - 1, fontWeight: 'bold', width: zoneW, overflow: 'truncate' } });
        yAxes.push(yAxisFor(0, true));
        series.push({
          type: 'custom', xAxisIndex: 0, yAxisIndex: 0, clip: true, silent: false, animation: false,
          data: zones.map(function (z) { return [0, z.top, 1, z.bottom]; }),
          encode: { x: [0, 2], y: [1, 3] },
          renderItem: function (params, api) {
            var z = zones[params.dataIndex];
            var p1 = api.coord([0, z.top]), p2 = api.coord([1, z.bottom]);
            var hgt = p2[1] - p1[1];
            var kids = [{ type: 'rect', shape: { x: p1[0], y: p1[1], width: p2[0] - p1[0], height: Math.max(0.5, hgt) }, style: { fill: zoneColor(z.name), opacity: 0.85 } }];
            if (hgt > ctx.fontSize + 4) kids.push({ type: 'text', style: { text: z.name, x: (p1[0] + p2[0]) / 2, y: p1[1] + hgt / 2, align: 'center', verticalAlign: 'middle', fill: '#fff', font: (ctx.fontSize - 1) + 'px ' + ctx.font, width: p2[0] - p1[0] - 4, overflow: 'truncate' } });
            return { type: 'group', children: kids };
          },
          tooltip: { trigger: 'item', formatter: function (p) { var z = zones[p.dataIndex]; return VS.tooltipHtml(ctx, z.name, [{ name: 'Интервал', value: ctx.fmt(z.top, { noAffix: true, noCompact: true }) + ' – ' + ctx.fmt(z.bottom, { noAffix: true, noCompact: true }) + (unit ? ' ' + unit : '') }, { name: 'Толщина', value: ctx.fmt(z.bottom - z.top, { noAffix: true, noCompact: true, decimals: 1 }) + (unit ? ' ' + unit : '') }]); } },
          markLine: markLineFor(false),
        });
        x += zoneW;
      }

      curves.forEach(function (c, ci) {
        var gi = grids.length;
        var color = colorOf(c, ci);
        var logScale = isLog(c);
        var data = order.map(function (i) {
          var v = c.num[i];
          if (v === null || (logScale && v <= 0)) v = null;
          return [v === null ? null : v, Dp.num[i]];
        });
        var st = VS.stats(data.map(function (p) { return p[0]; }));
        grids.push({ left: x, top: top, width: trackW, height: height });
        var xa = {
          type: logScale ? 'log' : 'value', gridIndex: gi, position: 'top', inverse: isRev(c),
          name: c.name, nameLocation: 'middle', nameGap: 26,
          nameTextStyle: { color: color, fontFamily: ctx.font, fontSize: ctx.fontSize, fontWeight: 'bold', width: trackW, overflow: 'truncate' },
          axisLine: { show: true, lineStyle: { color: color, width: 2 } },
          axisTick: { show: false },
          axisLabel: { color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 2, hideOverlap: true, formatter: function (v) { return ctx.fmt(v, { noAffix: true, noCompact: true }); } },
          splitLine: { show: true, lineStyle: { color: ctx.theme.grid } },
          splitNumber: 3,
        };
        if (logScale) {
          xa.min = Math.pow(10, Math.floor(Math.log10(Math.max(st.min, 1e-3))));
          xa.max = Math.pow(10, Math.ceil(Math.log10(Math.max(st.max, xa.min * 10))));
          xa.minorSplitLine = { show: true, lineStyle: { color: VS.color.mix(ctx.theme.grid, ctx.theme.background, 0.6) } };
          xa.minorTick = { show: false, splitNumber: 9 };
        } else {
          xa.scale = true;
        }
        xAxes.push(xa);
        yAxes.push(yAxisFor(gi, !Z && ci === 0));
        series.push({
          type: 'line', name: c.name, xAxisIndex: gi, yAxisIndex: gi, data: data, showSymbol: false, connectNulls: false,
          lineStyle: { color: color, width: lineW }, itemStyle: { color: color }, color: color, clip: true, sampling: 'lttb',
          markArea: zoneMarkArea,
          markLine: markLineFor(ci === n - 1),
          tooltip: { valueFormatter: function (v) { return ctx.fmt(v, { noAffix: true }); } },
          z: 3,
        });
        // заливка первой кривой от левого края дорожки
        if (ci === 0 && s['log.fill'] && !logScale) {
          var edgeX = xa.inverse ? x + trackW : x; // заливка до левого края дорожки (до правого — для обратной шкалы)
          series.push({
            type: 'custom', xAxisIndex: gi, yAxisIndex: gi, silent: true, clip: true, animation: false, z: 2,
            data: [[st.min, dMin]],
            renderItem: function (params, api) {
              if (params.dataIndex) return null;
              var pts = [];
              data.forEach(function (p) { if (p[0] !== null) pts.push(api.coord(p)); });
              if (pts.length < 2) return null;
              var poly = [[edgeX, pts[0][1]]].concat(pts).concat([[edgeX, pts[pts.length - 1][1]]]);
              return { type: 'polygon', shape: { points: poly }, style: { fill: VS.color.alpha(color, 0.18) } };
            },
            tooltip: { show: false },
          });
        }
        x += trackW + gap;
      });

      var allY = yAxes.map(function (_, i) { return i; });
      var out = { grid: grids, xAxis: xAxes, yAxis: yAxes, series: series, axisPointer: { link: [{ yAxisIndex: 'all' }], label: { show: false } } };
      if (zoomOn) {
        out.dataZoom = [
          { type: 'inside', yAxisIndex: allY, filterMode: 'none' },
          { type: 'slider', yAxisIndex: allY, filterMode: 'none', right: a.right, top: top, bottom: a.bottom, width: 16, borderColor: ctx.theme.grid, fillerColor: VS.color.alpha(ctx.palette[0], 0.12), showDetail: false, brushSelect: false },
        ];
      }
      out.tooltip = {
        trigger: 'axis',
        axisPointer: { type: 'line', axis: 'y', lineStyle: { color: ctx.theme.text, type: 'dashed' } },
        formatter: function (params) {
          var list = (Array.isArray(params) ? params : [params]).filter(function (p) { return p.seriesType === 'line'; });
          if (!list.length) return '';
          var depth = list[0].value[1];
          var rows = list.map(function (p) { return { name: p.seriesName, value: p.value[0] === null ? '—' : ctx.fmt(p.value[0], { noAffix: true }), color: p.color }; });
          if (Z) {
            var z = zones.find(function (zz) { return depth >= zz.top && depth <= zz.bottom; });
            if (z) rows.unshift({ name: Z.name, value: z.name, color: zoneColor(z.name) });
          }
          return VS.tooltipHtml(ctx, 'Глубина ' + ctx.fmt(depth, { noAffix: true, noCompact: true }) + (unit ? ' ' + unit : ''), rows);
        },
      };
      return out;
    },
  });

})(window.VS);

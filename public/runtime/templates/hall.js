(function (VS) {
  'use strict';

  var RE = VS.petroPatterns;

  VS.registerTemplate({
    id: 'hall',
    order: 9,
    name: 'График Холла (нагнетательные)',
    category: 'Разработка месторождений',
    description: 'Интеграл репрессии от накопленной закачки: рост наклона — ухудшение приёмистости (кольматация), снижение — ОПЗ, автоГРП или уход закачки.',
    icon: '<svg viewBox="0 0 48 36"><g stroke="currentColor" stroke-opacity=".2"><line x1="4" y1="11" x2="44" y2="11"/><line x1="4" y1="22" x2="44" y2="22"/></g><polyline points="5,31 12,27 19,23 24,18 28,12 33,9 38,7 44,5" fill="none" stroke="var(--c1)" stroke-width="2.2"/><line x1="5" y1="31" x2="22" y2="21" stroke="var(--c3)" stroke-width="1.4" stroke-dasharray="3 2"/><line x1="21" y1="22" x2="31" y2="9" stroke="var(--c4)" stroke-width="1.4" stroke-dasharray="3 2"/><line x1="30" y1="10" x2="44" y2="4" stroke="var(--c7)" stroke-width="1.4" stroke-dasharray="3 2"/><line x1="4" y1="33" x2="44" y2="33" stroke="currentColor" stroke-opacity=".5"/></svg>',
    bindings: [
      { key: 'date', name: 'Дата / период', dataType: 'any', match: RE.date },
      { key: 'inj', name: 'Закачка', dataType: 'number', match: RE.inj, description: 'Приёмистость (м³/сут) или объём за период' },
      { key: 'pressure', name: 'Давление нагнетания', dataType: 'number', match: [/(нагнет|устьев|буфер|закач).*давл|давл.*(нагнет|устье|закач)/i, /\b(wthp|wbhp)/i].concat(RE.pressure) },
      { key: 'pres', name: 'Пластовое давление', dataType: 'number', optional: true, match: [/пластов/i, /\b(fpr|wbp)/i], description: 'Если нет — постоянное значение из настроек' },
      { key: 'event', name: 'Мероприятия', dataType: 'text', optional: true, match: RE.event, description: 'Отметки и границы участков (ОПЗ, ГРП, смена режима)' },
      { key: 'filter', name: 'Скважина', optional: true, match: RE.well },
    ],
    common: ['layout', 'legend', 'tooltip', 'number', 'animation', 'appearance', 'filter'],
    defaults: { 'filter.all': false },
    sections: [
      {
        id: 'hall',
        title: 'График Холла',
        items: [
          { key: 'hall.input', label: 'Закачка в колонке', type: 'radio', options: [['rate', 'Приёмистость, в сутки'], ['volume', 'Объём за период']], default: 'rate' },
          { key: 'hall.pres', label: 'Пластовое давление (если нет колонки)', type: 'text', default: '0', help: 'При устьевом давлении часто берут 0 — модифицированный график Холла; важны изменения наклона, а не его величина' },
          { key: 'hall.derivative', label: 'Производная Холла', type: 'toggle', default: true, help: 'dH/d(ln W) по Изгецу и Кабиру — усиливает изменения наклона' },
          { key: 'hall.segments', label: 'Наклоны по участкам', type: 'toggle', default: true, help: 'Участки разделяются мероприятиями и датами из поля ниже' },
          { key: 'hall.breaks', label: 'Дополнительные границы участков', type: 'text', default: '', placeholder: '2021-06, 2023-01', show: function (s) { return s['hall.segments']; } },
          { key: 'hall.results', label: 'Таблица наклонов на графике', type: 'toggle', default: true, show: function (s) { return s['hall.segments']; } },
          { key: 'hall.xDiv', label: 'Накопленную закачку показывать в', type: 'select', options: [['1', 'исходных единицах'], ['1000', 'тысячах'], ['1000000', 'миллионах']], default: '1000' },
          { key: 'hall.xUnit', label: 'Единицы закачки', type: 'text', default: 'тыс. м³' },
          { key: 'hall.yDiv', label: 'Интеграл Холла показывать в', type: 'select', options: [['1', 'исходных единицах'], ['1000', 'тысячах'], ['1000000', 'миллионах']], default: '1000' },
          { key: 'hall.yUnit', label: 'Единицы интеграла', type: 'text', default: 'тыс. атм·сут' },
          { key: 'hall.color', label: 'Цвет кривой Холла', type: 'color', default: '#2a78d6' },
          { key: 'hall.derColor', label: 'Цвет производной', type: 'color', default: '#9aa5b1' },
        ],
      },
    ],
    sample: {
      data: (function () {
        // нагнетательная скважина: стабильная работа, кольматация призабойной зоны, ОПЗ
        var rows = [['Дата', 'Приёмистость, м³/сут', 'Давление на устье, атм', 'Мероприятие']];
        var seed = 9;
        var u = function () { seed = (seed * 9301 + 49297) % 233280; return (seed + 0.5) / 233281 - 0.5; };
        for (var m = 0; m < 84; m++) {
          var y = 2018 + Math.floor(m / 12), mo = m % 12 + 1;
          var skin = m < 22 ? 0 : m < 50 ? (m - 22) * 0.06 : 0.25 * Math.exp(-(m - 50) / 30) - 0.35;
          var p = (m < 22 ? 92 : m < 50 ? 92 + (m - 22) * 1.55 : 96) + u() * 3;
          var q = 340 / (1 + skin * 0.5) * (p / 92) * (1 + u() * 0.05);
          rows.push([y + '-' + (mo < 10 ? '0' : '') + mo, q.toFixed(0), p.toFixed(1), m === 50 ? 'ОПЗ' : '']);
        }
        return rows;
      })(),
      bindings: { date: 0, inj: 1, pressure: 2, event: 3 },
      settings: {
        title: 'График Холла: нагнетательная скважина 2045',
        subtitle: 'Интеграл давления нагнетания от накопленной закачки. Наклон — величина, обратная приёмистости',
        footer: 'Источник: демонстрационные данные. Метод: H. N. Hall (1963); производная — Izgec, Kabir (2009)',
        'hall.breaks': '2019-11',
      },
    },
    legendNames: function (ctx) {
      var n = ['Кривая Холла'];
      if (ctx.s['hall.derivative'] !== false) n.push('Производная');
      return n;
    },
    build: function (ctx) {
      var s = ctx.s;
      var D = ctx.column('date'), Q = ctx.column('inj'), P = ctx.column('pressure'), PR = ctx.column('pres'), E = ctx.column('event');
      if (!D || !Q || !P) return VS.empty(ctx, 'Привяжите дату, закачку и давление нагнетания');
      var agg = VS.aggregate(ctx, D, { q: { col: Q }, p: { col: P, how: 'avg' }, pr: { col: PR, how: 'avg' } });
      if (!agg.dates) return VS.empty(ctx, 'Колонка «Дата» должна содержать даты');
      var dates = agg.dates;
      var volume = s['hall.input'] === 'volume';
      var presConst = VS.parseNumber(s['hall.pres']) || 0;
      var xDiv = Number(s['hall.xDiv']) || 1, yDiv = Number(s['hall.yDiv']) || 1;
      var W = 0, H = 0;
      var pts = [];
      agg.keys.forEach(function (_, i) {
        var d = VS.periodDays(dates, i);
        var q = agg.values.q[i];
        if (q === null || q <= 0) return;
        var vol = volume ? q : q * d;
        W += vol;
        var p = agg.values.p[i];
        if (p === null) return;
        var pr = agg.values.pr && agg.values.pr[i] !== null ? agg.values.pr[i] : presConst;
        H += (p - pr) * d;
        pts.push({ i: i, W: W, H: H, q: volume ? q / d : q, p: p, dp: p - pr });
      });
      if (pts.length < 3) return VS.empty(ctx, 'Мало периодов с закачкой и давлением');

      // производная Холла: dH / d(ln W) по скользящему окну
      var showDer = s['hall.derivative'] !== false;
      pts.forEach(function (pt, j) {
        var win = pts.slice(Math.max(0, j - 2), Math.min(pts.length, j + 3));
        var r = VS.math.linreg(win.map(function (x) { return Math.log(x.W); }), win.map(function (x) { return x.H; }));
        pt.der = r && r.k > 0 ? r.k : null;
      });

      // участки: границы — мероприятия и даты из настроек
      var breaks = [];
      var evLabels = {};
      if (E) {
        agg.rows.forEach(function (list, i) {
          var labels = VS.util.uniq(list.map(function (r) { return E.raw[r]; }).filter(Boolean));
          if (labels.length) {
            evLabels[i] = labels.join(', ');
            breaks.push(i);
          }
        });
      }
      String(s['hall.breaks'] || '').split(/[,;]+/).forEach(function (t) {
        var d = VS.parseDate(t.trim());
        if (!d) return;
        for (var i = 0; i < dates.length; i++) if (dates[i] >= d) { breaks.push(i); break; }
      });
      breaks = VS.util.uniq(breaks).sort(function (a, b) { return a - b; });
      var segs = [];
      if (s['hall.segments'] !== false) {
        var bounds = [-Infinity].concat(breaks, [Infinity]);
        for (var b = 0; b < bounds.length - 1; b++) {
          var part = pts.filter(function (x) { return x.i >= bounds[b] && x.i < bounds[b + 1]; });
          if (part.length < 3) continue;
          var r = VS.math.linreg(part.map(function (x) { return x.W; }), part.map(function (x) { return x.H; }));
          if (!r) continue;
          segs.push({ from: part[0], to: part[part.length - 1], slope: r.k, c: r.c, r2: r.r2, n: part.length });
        }
      }
      var sig = function (v) { return VS.math.formatSig(v, 3, s['number.decimal'] !== 'dot'); };
      var dfmt = function (i) { return dates[i].toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }); };
      segs.forEach(function (sg, k) {
        if (!k) return;
        sg.change = (sg.slope / segs[k - 1].slope - 1) * 100;
        sg.verdict = sg.change > 15 ? 'приёмистость ухудшилась' : sg.change < -15 ? 'приёмистость улучшилась' : 'без существенных изменений';
      });

      var color = s['hall.color'] || ctx.palette[0];
      var segColors = [ctx.palette[2], ctx.palette[3], ctx.palette[6], ctx.palette[4], ctx.palette[5]];
      var series = [{
        type: 'line', name: 'Кривая Холла', color: color, symbol: 'circle', symbolSize: 5, showSymbol: pts.length <= 120,
        data: pts.map(function (x) { return { value: [x.W / xDiv, x.H / yDiv], pt: x }; }),
        lineStyle: { color: color, width: 2.2 }, itemStyle: { color: color, borderColor: ctx.theme.background, borderWidth: 1 }, z: 3,
      }];
      if (showDer) {
        var dc = s['hall.derColor'] || ctx.theme.muted;
        series.push({
          type: 'scatter', name: 'Производная', color: dc, symbol: 'triangle', symbolSize: 6,
          data: pts.filter(function (x) { return x.der !== null; }).map(function (x) { return { value: [x.W / xDiv, x.der / yDiv], pt: x }; }),
          itemStyle: { color: dc }, z: 2,
        });
      }
      segs.forEach(function (sg, k) {
        var c = segColors[k % segColors.length];
        sg.color = c;
        series.push({
          // широкая полупрозрачная полоса под кривой: видно и подобранную прямую, и сами точки
          type: 'line', name: 'Участок ' + (k + 1), silent: true, symbol: 'none', z: 1, color: c,
          data: [[sg.from.W / xDiv, (sg.c + sg.slope * sg.from.W) / yDiv], [sg.to.W / xDiv, (sg.c + sg.slope * sg.to.W) / yDiv]],
          lineStyle: { color: c, width: 7, opacity: 0.35, cap: 'round' }, tooltip: { show: false },
          endLabel: VS.labelStyle(ctx, { show: true, color: c, fontWeight: 'bold', fontSize: ctx.fontSize - 1, formatter: function () { return sig(sg.slope); }, distance: 6, offset: [0, -12] }),
        });
      });
      // мероприятия — вертикальные отметки на накопленной закачке
      var marks = Object.keys(evLabels).map(function (i) {
        var pt = pts.filter(function (x) { return x.i >= Number(i); })[0];
        return pt ? { xAxis: pt.W / xDiv, label: { formatter: evLabels[i] } } : null;
      }).filter(Boolean);
      if (marks.length) {
        series[0].markLine = {
          silent: true, symbol: 'none', animation: false,
          lineStyle: { color: ctx.theme.text, type: [3, 3], width: 1, opacity: 0.55 },
          label: { position: 'insideEndTop', color: ctx.theme.text, fontFamily: ctx.font, fontSize: ctx.fontSize - 1, backgroundColor: VS.color.alpha(ctx.theme.background, 0.85), padding: [1, 3] },
          data: marks,
        };
      }

      var xAxis = VS.axis(ctx, 'x', { type: 'value' });
      xAxis.axisLine.show = true;
      xAxis.name = 'Накопленная закачка' + (s['hall.xUnit'] ? ', ' + s['hall.xUnit'] : '');
      xAxis.nameLocation = 'middle';
      xAxis.nameGap = 28;
      xAxis.nameTextStyle.fontWeight = 'bold';
      xAxis.min = 0;
      var yAxis = VS.axis(ctx, 'y', { type: 'value' });
      yAxis.splitLine = { show: true, lineStyle: { color: ctx.theme.grid } };
      yAxis.min = 0;
      yAxis.name = 'Интеграл Холла' + (s['hall.yUnit'] ? ', ' + s['hall.yUnit'] : '');
      yAxis.nameLocation = 'end';
      yAxis.nameGap = 10;
      yAxis.nameTextStyle = { color: ctx.theme.muted, fontSize: ctx.fontSize - 1, fontFamily: ctx.font, align: 'left' };

      // таблица наклонов над графиком
      var table = null, tableH = 0;
      if (segs.length && s['hall.results'] !== false) {
        var unit = 'атм·сут/м³';
        var rich = { h: { fill: ctx.theme.muted }, b: { fontWeight: 'bold', fill: ctx.theme.text } };
        var lines = ['{h|Наклон кривой Холла (' + unit + ') по участкам:}'];
        segs.forEach(function (sg, k) {
          rich['c' + k] = { fill: sg.color, fontSize: ctx.fontSize + 2 };
          var t = '{c' + k + '|●} ' + dfmt(sg.from.i) + ' — ' + dfmt(sg.to.i) + ':  {b|' + sig(sg.slope) + '}';
          if (sg.change !== undefined) t += '  (' + (sg.change > 0 ? '+' : '−') + ctx.fmt(Math.abs(sg.change), { decimals: 0, noAffix: true, noCompact: true }) + '%, ' + sg.verdict + ')';
          lines.push(t);
        });
        tableH = lines.length * (ctx.fontSize + 6) + 14;
        table = {
          type: 'text', left: ctx.area.left, top: ctx.area.top, z: 10, silent: true,
          style: {
            text: lines.join('\n'), rich: rich, font: ctx.fontSize + 'px ' + ctx.font, fill: ctx.theme.text, lineHeight: ctx.fontSize + 6,
            backgroundColor: VS.color.alpha(ctx.theme.grid, 0.35), borderRadius: 6, padding: [7, 10],
          },
        };
      }
      ctx.hall = { segments: segs.map(function (sg) { return { slope: sg.slope, change: sg.change, n: sg.n }; }), W: W, H: H };

      var out = {
        series: series, xAxis: xAxis, yAxis: yAxis,
        grid: VS.grid(ctx, { top: 22 + (table ? tableH + 8 : 0), right: segs.length ? 40 : 8 }),
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            var x = p.data && p.data.pt;
            if (!x) return '';
            var rows = [
              { name: 'Накопленная закачка', value: ctx.fmt(x.W / xDiv) + ' ' + (s['hall.xUnit'] || '') },
              { name: 'Интеграл Холла', value: ctx.fmt(x.H / yDiv) + ' ' + (s['hall.yUnit'] || ''), color: color },
              { name: 'Приёмистость', value: ctx.fmt(x.q) + ' м³/сут' },
              { name: 'Давление', value: ctx.fmt(x.p) },
              { name: 'Репрессия', value: ctx.fmt(x.dp) },
            ];
            if (x.der !== null) rows.push({ name: 'Производная', value: ctx.fmt(x.der / yDiv) });
            return VS.tooltipHtml(ctx, dfmt(x.i), rows);
          },
        },
      };
      if (table) out.graphic = [table];
      return out;
    },
  });
})(window.VS);

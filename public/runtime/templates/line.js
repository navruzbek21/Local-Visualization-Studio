(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'line',
    order: 20,
    name: 'Линейный график',
    category: 'Динамика',
    description: 'Изменение показателей во времени: линии, области, области с накоплением.',
    icon: '<svg viewBox="0 0 48 36"><polyline points="4,28 14,18 22,22 32,9 44,13" fill="none" stroke="var(--c1)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/><polyline points="4,31 14,27 22,29 32,21 44,24" fill="none" stroke="var(--c2)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    variants: [
      { name: 'Линейный график', settings: { 'line.area': 'none', 'line.curve': 'straight' } },
      {
        name: 'Сглаженные линии', settings: { 'line.area': 'none', 'line.curve': 'smooth' },
        icon: '<svg viewBox="0 0 48 36"><path d="M4 28 C 12 10, 18 30, 26 16 S 38 6, 44 12" fill="none" stroke="var(--c1)" stroke-width="2.6" stroke-linecap="round"/></svg>',
      },
      {
        name: 'Диаграмма с областями', settings: { 'line.area': 'area' },
        icon: '<svg viewBox="0 0 48 36"><path d="M4 28 L14 18 L22 22 L32 9 L44 13 L44 32 L4 32 Z" fill="var(--c1)" opacity=".35"/><polyline points="4,28 14,18 22,22 32,9 44,13" fill="none" stroke="var(--c1)" stroke-width="2.4" stroke-linejoin="round"/></svg>',
      },
      {
        name: 'Области с накоплением', settings: { 'line.area': 'stacked' },
        icon: '<svg viewBox="0 0 48 36"><path d="M4 22 L16 14 L28 17 L44 6 L44 32 L4 32 Z" fill="var(--c2)"/><path d="M4 27 L16 22 L28 25 L44 18 L44 32 L4 32 Z" fill="var(--c1)"/></svg>',
      },
      {
        name: 'Области 100%', settings: { 'line.area': 'percent' },
        icon: '<svg viewBox="0 0 48 36"><rect x="4" y="4" width="40" height="28" fill="var(--c2)"/><path d="M4 20 L16 14 L28 19 L44 12 L44 32 L4 32 Z" fill="var(--c1)"/></svg>',
      },
    ],
    bindings: [
      { key: 'label', name: 'Ось X (время)', dataType: 'any', description: 'Даты, годы или категории' },
      { key: 'values', name: 'Значения', dataType: 'number', multiple: true, description: 'Каждая колонка — отдельная линия' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    sections: [
      {
        id: 'lines',
        title: 'Линии',
        items: [
          { key: 'line.curve', label: 'Форма линии', type: 'radio', options: [['straight', 'Прямая'], ['smooth', 'Плавная'], ['step', 'Ступенька']], default: 'straight' },
          { key: 'line.width', label: 'Толщина линии', type: 'range', min: 1, max: 8, step: 0.5, default: 2 },
          { key: 'line.area', label: 'Заливка', type: 'select', options: [['none', 'Без заливки'], ['area', 'Область'], ['stacked', 'Области с накоплением'], ['percent', 'Области 100%']], default: 'none' },
          { key: 'line.areaOpacity', label: 'Прозрачность заливки', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.25, show: function (s) { return s['line.area'] === 'area'; } },
          { key: 'line.symbols', label: 'Маркеры точек', type: 'radio', options: [['none', 'Нет'], ['auto', 'Авто'], ['all', 'Все']], default: 'auto' },
          { key: 'line.symbolSize', label: 'Размер маркеров', type: 'range', min: 4, max: 16, default: 7, show: function (s) { return s['line.symbols'] !== 'none'; } },
          { key: 'line.connectNulls', label: 'Соединять пропуски', type: 'toggle', default: false },
          { key: 'line.timeAxis', label: 'Ось X как шкала времени', type: 'toggle', default: false, help: 'Для колонок с датами: учитывает неравные интервалы' },
          { type: 'heading', label: 'Подписи' },
          { key: 'line.endLabels', label: 'Названия у конца линий', type: 'toggle', default: false, help: 'Удобно при 2–6 линиях вместо легенды' },
          { key: 'labels.show', label: 'Значения на точках', type: 'select', options: [['none', 'Нет'], ['last', 'Только последнее'], ['minmax', 'Мин. и макс.'], ['all', 'Все']], default: 'none' },
          { key: 'line.zoom', label: 'Масштабирование (ползунок)', type: 'toggle', default: false },
        ],
      },
      VS.axisSection({ xLabel: 'Ось X', yLabel: 'Ось Y' }),
    ],
    sample: {
      data: [
        ['Месяц', 'Москва', 'Санкт-Петербург', 'Новосибирск'],
        ['Янв', '-6,5', '-5,5', '-16,5'], ['Фев', '-6,7', '-5,8', '-14,7'], ['Мар', '-1,0', '-1,3', '-7,4'],
        ['Апр', '6,7', '5,0', '2,4'], ['Май', '13,2', '11,4', '10,9'], ['Июн', '17,0', '15,8', '16,8'],
        ['Июл', '19,2', '18,8', '19,2'], ['Авг', '17,0', '16,8', '15,6'], ['Сен', '11,3', '11,3', '9,6'],
        ['Окт', '5,6', '5,6', '2,1'], ['Ноя', '-1,2', '0,1', '-7,6'], ['Дек', '-4,5', '-3,3', '-14,4'],
      ],
      bindings: { label: 0, values: [1, 2, 3] },
      settings: { title: 'Средняя температура по месяцам', subtitle: '°C, климатическая норма', footer: 'Источник: демонстрационные данные', 'number.suffix': '°' },
    },
    legendKind: 'line',
    legendNames: function (ctx) {
      var v = ctx.columnsOf('values');
      if (v.length < 2 || ctx.s['line.endLabels']) return null;
      return v.map(function (c) { return c.name; });
    },
    tooltip: function (ctx) {
      var percent = ctx.s['line.area'] === 'percent';
      return {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: ctx.theme.axis, type: 'dashed' } },
        formatter: function (params) {
          var list = (Array.isArray(params) ? params : [params]).filter(function (p) {
            var v = Array.isArray(p.value) ? p.value[1] : p.value;
            return v !== '-' && v !== null && v !== undefined;
          });
          if (!list.length) return '';
          list.sort(function (a, b) {
            var x = (a.data && a.data.rawValue !== undefined) ? a.data.rawValue : (Array.isArray(a.value) ? a.value[1] : a.value);
            var y = (b.data && b.data.rawValue !== undefined) ? b.data.rawValue : (Array.isArray(b.value) ? b.value[1] : b.value);
            return y - x;
          });
          var head = list[0].axisValueLabel || list[0].name;
          return VS.tooltipHtml(ctx, head, list.map(function (p) {
            var d = p.data || {};
            var v = d.rawValue !== undefined ? d.rawValue : Array.isArray(p.value) ? p.value[1] : p.value;
            var txt = ctx.fmt(v);
            if (percent) txt = ctx.fmt(Array.isArray(p.value) ? p.value[1] : p.value, { noAffix: true, noCompact: true, decimals: 1 }) + '% · ' + txt;
            return { name: p.seriesName, value: txt, color: p.color };
          }));
        },
      };
    },
    build: function (ctx) {
      var s = ctx.s;
      var label = ctx.column('label');
      var vals = ctx.columnsOf('values');
      if (!label || !vals.length) return VS.empty(ctx, 'Привяжите колонки «Ось X» и «Значения» на вкладке «Данные»');

      var area = s['line.area'];
      var stacked = area === 'stacked' || area === 'percent';
      var useTime = s['line.timeAxis'] && label.type === 'date';
      var xs = label.raw;
      var dates = useTime ? xs.map(function (x) { return VS.parseDate(x); }) : null;
      var totals = xs.map(function (_, i) {
        return vals.reduce(function (a, c) { return a + Math.abs(c.num[i] || 0); }, 0);
      });
      var n = xs.length;
      var symbols = s['line.symbols'];
      var showSymbol = symbols === 'all' || (symbols === 'auto' && n <= 24);
      var labelsMode = s['labels.show'];
      var endLabels = s['line.endLabels'];

      // индексы точек мин/макс по каждой серии для подписей
      function extremes(c) {
        var mi = -1, ma = -1;
        c.num.forEach(function (v, i) {
          if (v === null) return;
          if (mi < 0 || v < c.num[mi]) mi = i;
          if (ma < 0 || v > c.num[ma]) ma = i;
        });
        return [mi, ma];
      }
      function lastIndex(c) {
        for (var i = c.num.length - 1; i >= 0; i--) if (c.num[i] !== null) return i;
        return -1;
      }

      var series = vals.map(function (c, si) {
        var color = ctx.color(c.name, si);
        var ex = labelsMode === 'minmax' ? extremes(c) : null;
        var last = lastIndex(c);
        var data = c.num.map(function (v, i) {
          var y = v;
          var item = { rowIndex: i };
          if (area === 'percent') {
            item.rawValue = v;
            y = v === null ? null : totals[i] ? (Math.abs(v) / totals[i]) * 100 : 0;
          }
          var yy = y === null ? '-' : y;
          item.value = useTime ? [dates[i] ? dates[i].getTime() : null, yy] : yy;
          var show = labelsMode === 'all' || (labelsMode === 'last' && i === last) || (ex && (i === ex[0] || i === ex[1]));
          if (show) {
            item.label = { show: true };
            item.symbol = 'circle';
            item.symbolSize = Math.max(6, Number(s['line.symbolSize']) || 7);
          }
          return item;
        });
        var serie = {
          type: 'line',
          name: c.name,
          data: data,
          color: color,
          smooth: s['line.curve'] === 'smooth' ? 0.35 : false,
          step: s['line.curve'] === 'step' ? 'middle' : false,
          connectNulls: !!s['line.connectNulls'],
          showSymbol: showSymbol,
          symbol: 'circle',
          symbolSize: Number(s['line.symbolSize']) || 7,
          lineStyle: { width: Number(s['line.width']) || 2, color: color },
          itemStyle: { color: color, borderColor: ctx.theme.background, borderWidth: 1.5 },
          emphasis: { focus: vals.length > 1 ? 'series' : 'none' },
          label: VS.labelStyle(ctx, {
            show: false,
            position: 'top',
            fontSize: ctx.fontSize - 1,
            formatter: function (p) {
              var d = p.data || {};
              return ctx.fmt(d.rawValue !== undefined ? d.rawValue : Array.isArray(p.value) ? p.value[1] : p.value);
            },
          }),
          labelLayout: { hideOverlap: true },
        };
        if (area !== 'none') {
          serie.areaStyle = { color: color, opacity: area === 'area' ? Number(s['line.areaOpacity']) || 0.25 : 0.9 };
          if (stacked) {
            serie.stack = 'total';
            serie.lineStyle.width = Math.min(serie.lineStyle.width, 1.5);
            serie.showSymbol = false;
          }
        }
        if (endLabels) {
          serie.endLabel = VS.labelStyle(ctx, {
            show: true,
            color: color,
            fontWeight: 'bold',
            distance: 6,
            formatter: function (p) { return p.seriesName; },
          });
          serie.labelLayout = { moveOverlap: 'shiftY', hideOverlap: false };
        }
        return serie;
      });

      var ref = VS.refLine(ctx, false);
      if (ref && series[0]) series[0].markLine = ref;

      var xAxis = VS.axis(ctx, 'x', { type: useTime ? 'time' : 'category', data: useTime ? undefined : xs, boundaryGap: false });
      if (useTime) {
        xAxis.axisLine.show = true;
        var ds = dates.filter(Boolean);
        VS.timeAxis(xAxis, ds.length ? Math.max.apply(null, ds) - Math.min.apply(null, ds) : 0);
      }
      var yAxis = VS.axis(ctx, 'y', { type: 'value', percent: area === 'percent' });
      if (area === 'none') yAxis.scale = VS.parseNumber(s['yAxis.min']) === null;

      // место справа под названия у конца линий
      var extraRight = 0;
      if (endLabels) {
        var f = 'bold ' + ctx.fontSize + 'px ' + ctx.font;
        vals.forEach(function (c) { extraRight = Math.max(extraRight, VS.measureText(c.name, f)); });
        extraRight = Math.min(Math.ceil(extraRight) + 14, ctx.area.width * 0.35);
      }
      var extraBottom = 0;
      var out = { series: series, xAxis: xAxis, yAxis: yAxis };
      if (s['line.zoom'] && !ctx.forExport) {
        extraBottom = 44;
        out.dataZoom = [
          { type: 'inside', xAxisIndex: 0 },
          {
            type: 'slider', xAxisIndex: 0, height: 22, bottom: ctx.area.bottom, left: ctx.area.left + 40, right: ctx.area.right + 10,
            borderColor: ctx.theme.grid, fillerColor: VS.color.alpha(ctx.palette[0], 0.12), textStyle: { color: ctx.theme.muted },
            dataBackground: { lineStyle: { color: ctx.theme.axis }, areaStyle: { color: ctx.theme.grid } },
          },
        ];
      }
      out.grid = VS.grid(ctx, { right: extraRight, bottom: extraBottom });
      return out;
    },
  });
})(window.VS);

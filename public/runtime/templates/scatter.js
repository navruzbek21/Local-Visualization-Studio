(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'scatter',
    order: 40,
    name: 'Точечная диаграмма',
    category: 'Связи',
    description: 'Связь двух показателей; размер точки — третий показатель (пузырьковая).',
    icon: '<svg viewBox="0 0 48 36"><circle cx="10" cy="26" r="3" fill="var(--c1)"/><circle cx="17" cy="20" r="3" fill="var(--c1)"/><circle cx="24" cy="22" r="3" fill="var(--c2)"/><circle cx="30" cy="12" r="3" fill="var(--c1)"/><circle cx="38" cy="8" r="3" fill="var(--c2)"/><circle cx="34" cy="17" r="3" fill="var(--c2)"/></svg>',
    variants: [
      { name: 'Точечная', settings: {} },
      {
        name: 'Кросс-плот с регрессией', settings: { 'scatter.trend': 'exp', 'scatter.equation': true },
        description: 'Например, пористость — проницаемость: линия тренда, уравнение и R².',
        sampleData: (function () {
          // керн: log10(k) линейно зависит от пористости, у алевролитов — ниже
          var rows = [['Образец', 'Пористость, %', 'Проницаемость, мД', 'Литотип']];
          var seed = 23;
          var u = function () { seed = (seed * 9301 + 49297) % 233280; return (seed + 0.5) / 233281; };
          var nrm = function () { return Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()); };
          for (var i = 1; i <= 90; i++) {
            var silt = i % 3 === 0;
            var phi = silt ? 9 + u() * 9 : 13 + u() * 11;
            var lk = (silt ? -2.3 : -1.6) + 0.17 * phi + nrm() * 0.28;
            rows.push(['Обр. ' + i, phi.toFixed(1), Math.pow(10, lk).toFixed(Math.pow(10, lk) < 10 ? 2 : 1), silt ? 'Алевролит' : 'Песчаник']);
          }
          return rows;
        })(),
        sampleBindings: { name: 0, x: 1, y: 2, color: 3 },
        sampleSettings: {
          title: 'Связь пористости и проницаемости',
          subtitle: 'Исследования керна, пласт БС10. Линия — экспоненциальная регрессия',
          footer: 'Источник: демонстрационные данные',
          'xAxis.title': 'Пористость, %', 'yAxis.title': 'Проницаемость, мД', 'yAxis.log': true, 'yAxis.min': '', 'scatter.trendGroups': true,
        },
        icon: '<svg viewBox="0 0 48 36"><g fill="var(--c1)"><circle cx="9" cy="28" r="2.2"/><circle cx="14" cy="24" r="2.2"/><circle cx="19" cy="25" r="2.2"/><circle cx="23" cy="18" r="2.2"/><circle cx="29" cy="16" r="2.2"/><circle cx="34" cy="10" r="2.2"/><circle cx="39" cy="8" r="2.2"/></g><path d="M5 31 C 18 26, 30 16, 44 4" fill="none" stroke="var(--c2)" stroke-width="2" stroke-dasharray="4 2"/><text x="5" y="8" font-size="7" fill="currentColor" opacity=".7">R²</text></svg>',
      },
      {
        name: 'Пузырьковая', settings: { 'scatter.opacity': 0.7 }, sampleBindings: { name: 0, x: 1, y: 2, size: 3, color: 4 },
        icon: '<svg viewBox="0 0 48 36"><circle cx="12" cy="24" r="6" fill="var(--c1)" opacity=".8"/><circle cx="26" cy="16" r="9" fill="var(--c2)" opacity=".8"/><circle cx="38" cy="9" r="4" fill="var(--c1)" opacity=".8"/></svg>',
      },
    ],
    bindings: [
      { key: 'x', name: 'Ось X', dataType: 'number' },
      { key: 'y', name: 'Ось Y', dataType: 'number' },
      { key: 'size', name: 'Размер', dataType: 'number', optional: true, description: 'Для пузырьковой диаграммы' },
      { key: 'color', name: 'Цвет (группа)', dataType: 'text', optional: true, description: 'Категория — отдельный цвет и пункт легенды' },
      { key: 'name', name: 'Название точки', dataType: 'text', optional: true, description: 'Для подсказок и подписей' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    autoBind: function (cols) {
      var num = cols.filter(function (c) { return c.type === 'number'; });
      var txt = cols.filter(function (c) { return c.type !== 'number'; });
      return { x: num[0] && num[0].index, y: num[1] && num[1].index, name: txt[0] && txt[0].index };
    },
    sections: [
      {
        id: 'points',
        title: 'Точки',
        items: [
          { key: 'scatter.size', label: 'Размер точки', type: 'range', min: 3, max: 30, default: 10 },
          { key: 'scatter.maxSize', label: 'Максимальный размер пузыря', type: 'range', min: 10, max: 120, default: 56 },
          { key: 'scatter.opacity', label: 'Непрозрачность', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.85 },
          { key: 'scatter.symbol', label: 'Форма', type: 'select', options: [['circle', 'Круг'], ['rect', 'Квадрат'], ['triangle', 'Треугольник'], ['diamond', 'Ромб']], default: 'circle' },
          { type: 'heading', label: 'Линия тренда (регрессия)' },
          { key: 'scatter.trend', label: 'Модель', type: 'select', options: [['none', 'Нет'], ['linear', 'Линейная: y = a + b·x'], ['exp', 'Экспоненциальная: y = a·e^(b·x)'], ['power', 'Степенная: y = a·x^b'], ['log', 'Логарифмическая: y = a + b·ln x'], ['poly2', 'Полином 2-й степени'], ['poly3', 'Полином 3-й степени']], default: 'none', help: 'Для «пористость — проницаемость» обычно экспоненциальная (прямая на логарифмической оси Y). R² экспоненциальной и степенной считается по логарифмам, как в Excel' },
          { key: 'scatter.trendGroups', label: 'Отдельно для каждой группы', type: 'toggle', default: false, show: function (s, b) { return s['scatter.trend'] !== 'none' && b && b.color !== undefined && b.color !== null && b.color !== ''; } },
          { key: 'scatter.equation', label: 'Уравнение и R² на графике', type: 'toggle', default: true, show: function (s) { return s['scatter.trend'] !== 'none'; } },
          { key: 'scatter.eqPos', label: 'Положение уравнения', type: 'radio', options: [['tl', 'Слева вверху'], ['tr', 'Справа вверху'], ['br', 'Справа внизу']], default: 'tl', show: function (s) { return s['scatter.trend'] !== 'none' && s['scatter.equation']; } },
          { key: 'scatter.labels', label: 'Подписи точек', type: 'radio', options: [['none', 'Нет'], ['all', 'Все'], ['top', 'Крупнейшие']], default: 'none' },
          { key: 'scatter.zoom', label: 'Масштабирование колесом', type: 'toggle', default: false },
        ],
      },
      VS.axisSection({ xValue: true, xGrid: true }),
    ],
    sample: {
      data: [
        ['Страна', 'ВВП на душу, тыс. $', 'Ожидаемая продолжительность жизни', 'Население, млн', 'Регион'],
        ['Россия', '14,4', '73,2', '144', 'Европа'], ['Германия', '52,7', '81,0', '84', 'Европа'], ['Франция', '44,4', '82,3', '68', 'Европа'],
        ['Польша', '22,1', '78,5', '37', 'Европа'], ['Италия', '38,4', '82,9', '59', 'Европа'], ['Китай', '12,6', '78,6', '1410', 'Азия'],
        ['Индия', '2,5', '70,8', '1430', 'Азия'], ['Япония', '33,8', '84,7', '124', 'Азия'], ['Казахстан', '13,1', '74,4', '20', 'Азия'],
        ['Узбекистан', '2,5', '71,7', '36', 'Азия'], ['Корея', '33,1', '83,7', '52', 'Азия'], ['США', '80,4', '78,4', '335', 'Америка'],
        ['Бразилия', '10,0', '75,8', '216', 'Америка'], ['Мексика', '13,8', '75,0', '128', 'Америка'], ['Канада', '53,4', '81,6', '40', 'Америка'],
        ['Нигерия', '1,6', '54,5', '224', 'Африка'], ['Египет', '3,5', '71,6', '113', 'Африка'], ['ЮАР', '6,0', '65,3', '61', 'Африка'],
      ],
      bindings: { name: 0, x: 1, y: 2, color: 4 },
      settings: {
        title: 'Доход и продолжительность жизни',
        subtitle: 'ВВП на душу населения и ожидаемая продолжительность жизни при рождении',
        footer: 'Источник: демонстрационные данные (округлённые оценки)',
        'xAxis.title': 'ВВП на душу населения, тыс. $', 'yAxis.title': 'Продолжительность жизни, лет', 'yAxis.min': '50',
      },
    },
    legendNames: function (ctx) {
      var c = ctx.column('color');
      return c ? VS.util.uniq(c.raw.filter(Boolean)) : null;
    },
    build: function (ctx) {
      var s = ctx.s;
      var X = ctx.column('x'), Y = ctx.column('y');
      if (!X || !Y) return VS.empty(ctx, 'Привяжите числовые колонки к осям X и Y');
      var S = ctx.column('size'), C = ctx.column('color'), N = ctx.column('name');
      var groups = C ? VS.util.uniq(C.raw.filter(Boolean)) : [''];
      var sizeStats = S ? VS.stats(S.num) : null;
      var base = Number(s['scatter.size']) || 10;
      var maxSize = Number(s['scatter.maxSize']) || 56;
      var sizeOf = function (v) {
        if (!S || v === null || !sizeStats.max) return base;
        // площадь пропорциональна значению
        return Math.max(4, Math.sqrt(Math.max(0, v) / sizeStats.max) * maxSize);
      };
      var labelsMode = s['scatter.labels'];
      var topSet = null;
      if (labelsMode === 'top') {
        var idx = X.num.map(function (_, i) { return i; });
        var key = S ? S.num : Y.num;
        idx.sort(function (a, b) { return (key[b] || 0) - (key[a] || 0); });
        topSet = new Set(idx.slice(0, 8));
      }

      var series = groups.map(function (g, gi) {
        var color = ctx.color(g || Y.name, gi);
        var data = [];
        X.num.forEach(function (x, i) {
          var y = Y.num[i];
          if (x === null || y === null) return;
          if (C && C.raw[i] !== g) return;
          var item = { value: [x, y, S ? S.num[i] : null], name: N ? N.raw[i] : '', rowIndex: i, symbolSize: sizeOf(S ? S.num[i] : null) };
          if (labelsMode === 'all' || (topSet && topSet.has(i))) item.label = { show: true };
          data.push(item);
        });
        // крупные пузыри рисуем первыми, чтобы мелкие были видны
        if (S) data.sort(function (a, b) { return (b.value[2] || 0) - (a.value[2] || 0); });
        return {
          type: 'scatter',
          name: g || Y.name,
          data: data,
          symbol: s['scatter.symbol'] || 'circle',
          itemStyle: { color: color, opacity: Number(s['scatter.opacity']) || 0.85, borderColor: ctx.theme.background, borderWidth: 1 },
          emphasis: { focus: groups.length > 1 ? 'series' : 'none', itemStyle: { borderColor: ctx.theme.text, borderWidth: 1.5 } },
          label: VS.labelStyle(ctx, { show: false, position: 'right', fontSize: ctx.fontSize - 1, color: ctx.theme.muted, formatter: function (p) { return p.name; } }),
          labelLayout: { hideOverlap: true },
        };
      });

      // линии тренда (метод наименьших квадратов, модель на выбор)
      var trend = s['scatter.trend'] || 'none';
      var byGroup = !!s['scatter.trendGroups'] && !!C;
      if (trend === 'group') { trend = 'linear'; byGroup = !!C; } // старое значение настройки
      var xLog = !!s['xAxis.log'], yLog = !!s['yAxis.log'];
      var fits = [];
      if (trend !== 'none') {
        var sets = byGroup ? series.map(function (sr) { return { name: sr.name, color: sr.itemStyle.color, pts: sr.data.map(function (d) { return d.value; }) }; })
          : [{ name: 'Тренд', color: ctx.theme.text, pts: series.reduce(function (acc, sr) { return acc.concat(sr.data.map(function (d) { return d.value; })); }, []) }];
        sets.forEach(function (st) {
          var f = VS.math.fit(trend, st.pts.map(function (v) { return [v[0], v[1]]; }));
          if (!f) return;
          fits.push({ name: st.name, color: st.color, fit: f });
          var line = [];
          var x0 = f.xMin, x1 = f.xMax;
          for (var k = 0; k <= 80; k++) {
            var x = xLog && x0 > 0 ? x0 * Math.pow(x1 / x0, k / 80) : x0 + ((x1 - x0) * k) / 80;
            var y = f.f(x);
            if (isFinite(y) && (!yLog || y > 0)) line.push([x, y]);
          }
          series.push({
            type: 'line', name: st.name, data: line, symbol: 'none', silent: true, z: 1, smooth: false,
            lineStyle: { color: st.color, width: 1.8, type: 'dashed', opacity: 0.9 },
            tooltip: { show: false }, legendHoverLink: false,
          });
        });
        if (!fits.length) ctx.warnings.push('Не удалось построить тренд: мало точек' + (trend === 'exp' || trend === 'power' || trend === 'log' ? ' или есть значения ≤ 0' : ''));
      }

      var xAxis = VS.axis(ctx, 'x', { type: 'value' });
      var yAxis = VS.axis(ctx, 'y', { type: 'value' });
      xAxis.axisLine.show = true;
      xAxis.scale = VS.parseNumber(s['xAxis.min']) === null;
      yAxis.scale = VS.parseNumber(s['yAxis.min']) === null;
      var out = {
        series: series,
        xAxis: xAxis,
        yAxis: yAxis,
        grid: VS.grid(ctx, { top: S ? 6 : 0, right: 8 }),
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            if (!p.value || p.seriesType !== 'scatter') return '';
            var rows = [
              { name: X.name, value: ctx.fmt(p.value[0]) },
              { name: Y.name, value: ctx.fmt(p.value[1]) },
            ];
            if (S) rows.push({ name: S.name, value: ctx.fmt(p.value[2]) });
            if (C) rows.unshift({ name: C.name, value: p.seriesName, color: p.color });
            return VS.tooltipHtml(ctx, p.name, rows);
          },
        },
      };
      if (fits.length && s['scatter.equation'] !== false) {
        var comma = s['number.decimal'] !== 'dot';
        var rich = {};
        var lines = fits.map(function (q, i) {
          rich['g' + i] = { fill: q.color, fontSize: ctx.fontSize + 2 };
          return '{g' + i + '|●} ' + (fits.length > 1 ? q.name + ':  ' : '') + VS.math.equation(q.fit, comma) +
            '   R² = ' + VS.math.formatSig(q.fit.r2, 3, comma) + '   n = ' + q.fit.n;
        });
        var pos = s['scatter.eqPos'] || 'tl';
        var a = ctx.area;
        var fy = function (v) { return ctx.fmt(v); };
        var ys = VS.stats(Y.num);
        var yLabW = Math.max(VS.measureText(fy(ys.max), ctx.fontSize + 'px ' + ctx.font), VS.measureText(fy(ys.min), ctx.fontSize + 'px ' + ctx.font));
        var g = {
          type: 'text', z: 10, silent: true,
          style: {
            text: lines.join('\n'), rich: rich, font: ctx.fontSize + 'px ' + ctx.font, fill: ctx.theme.text, lineHeight: ctx.fontSize + 8,
            backgroundColor: VS.color.alpha(ctx.theme.background, 0.9), borderColor: ctx.theme.grid, borderWidth: 1, borderRadius: 6, padding: [7, 10],
          },
        };
        if (pos === 'tl') { g.left = a.left + yLabW + (s['yAxis.title'] ? ctx.fontSize + 30 : 22); g.top = a.top + (S ? 14 : 8); }
        else if (pos === 'tr') { g.right = a.right + 14; g.top = a.top + (S ? 14 : 8); }
        else { g.right = a.right + 14; g.bottom = a.bottom + ctx.fontSize + 26 + (s['xAxis.title'] ? ctx.fontSize + 16 : 0); }
        out.graphic = [g];
      }
      ctx.trends = fits;
      if (s['scatter.zoom']) out.dataZoom = [{ type: 'inside', xAxisIndex: 0 }, { type: 'inside', yAxisIndex: 0 }];
      if (!C) out.legend = false;
      return out;
    },
  });
})(window.VS);

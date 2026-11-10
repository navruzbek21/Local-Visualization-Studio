/*
 * Пример пользовательского шаблона: календарная тепловая карта.
 *
 * Как добавить свой шаблон:
 *   1. Создайте .js-файл в этой папке (templates/) рядом с server.js.
 *   2. Вызовите VS.registerTemplate({...}) — как ниже. Обязательны id, name и build(ctx).
 *   3. Обновите страницу студии — шаблон появится в галерее.
 *
 * Что доступно в build(ctx):
 *   ctx.column('ключ')      — колонка, привязанная к полю: { name, raw: [...строки], num: [...числа|null], type }
 *   ctx.columnsOf('ключ')   — массив колонок для полей с multiple: true
 *   ctx.s['настройка']      — значения настроек (с учётом значений по умолчанию)
 *   ctx.fmt(число)          — форматирование по настройкам «Формат чисел»
 *   ctx.color(имя, i)       — цвет серии из выбранной палитры
 *   ctx.area                — свободная область {top,left,right,bottom,width,height,cx,cy} под заголовком
 *   ctx.theme               — цвета текста/сетки/фона
 *   VS.empty(ctx, 'текст')  — заглушка, если данных не хватает
 * build возвращает фрагмент option ECharts; заголовок, подпись, легенда и подсказки добавляются студией.
 */
(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'calendar',
    order: 65,
    name: 'Календарь',
    category: 'Распределение',
    description: 'Значения по дням года: активность, продажи, обращения. Пользовательский шаблон из папки templates/.',
    icon: '<svg viewBox="0 0 48 36"><g fill="var(--c1)">' +
      [0, 1, 2, 3, 4, 5, 6, 7].map(function (x) {
        return [0, 1, 2, 3].map(function (y) {
          var o = [0.2, 0.5, 0.8, 0.35, 1, 0.6, 0.25, 0.9][(x * 3 + y) % 8];
          return '<rect x="' + (4 + x * 5) + '" y="' + (8 + y * 5) + '" width="4" height="4" rx=".8" opacity="' + o + '"/>';
        }).join('');
      }).join('') + '</g></svg>',
    bindings: [
      { key: 'date', name: 'Дата', dataType: 'any', description: 'ГГГГ-ММ-ДД или ДД.ММ.ГГГГ' },
      { key: 'value', name: 'Значение', dataType: 'number' },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    autoBind: function (cols) {
      var d = cols.find(function (c) { return c.type === 'date'; }) || cols[0];
      var v = cols.find(function (c) { return c.type === 'number' && c !== d; });
      return { date: d && d.index, value: v && v.index };
    },
    common: ['layout', 'tooltip', 'number', 'animation', 'appearance'],
    legend: false,
    sections: [
      {
        id: 'calendar',
        title: 'Календарь',
        items: [
          { key: 'cal.scale', label: 'Цветовая шкала', type: 'scale', default: 'greens' },
          { key: 'cal.empty', label: 'Цвет пустых дней', type: 'color', default: '#f0efec' },
          { key: 'cal.gap', label: 'Зазор между днями', type: 'range', min: 0, max: 4, default: 2 },
          { key: 'cal.firstDay', label: 'Неделя начинается с', type: 'radio', options: [['1', 'Понедельника'], ['0', 'Воскресенья']], default: '1' },
        ],
      },
    ],
    sample: {
      data: (function () {
        var rows = [['Дата', 'Заказы']];
        var d = new Date(2025, 0, 1);
        var seed = 7;
        while (d.getFullYear() === 2025) {
          seed = (seed * 9301 + 49297) % 233280;
          var wd = d.getDay();
          var base = wd === 0 || wd === 6 ? 20 : 60;
          var season = 1 + 0.4 * Math.sin(((d.getMonth() + 1) / 12) * Math.PI * 2);
          rows.push([d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), Math.round(base * season + (seed / 233280) * 30)]);
          d.setDate(d.getDate() + 1);
        }
        return rows;
      })(),
      bindings: { date: 0, value: 1 },
      settings: { title: 'Заказы по дням', subtitle: '2025 год, демонстрационные данные' },
    },
    build: function (ctx) {
      var s = ctx.s;
      var D = ctx.column('date'), V = ctx.column('value');
      if (!D || !V) return VS.empty(ctx, 'Привяжите колонки «Дата» и «Значение»');
      var pad = function (n) { return String(n).padStart(2, '0'); };
      var byYear = {};
      var all = [];
      D.raw.forEach(function (raw, i) {
        var d = VS.parseDate(raw);
        var v = V.num[i];
        if (!d || v === null) return;
        var y = d.getFullYear();
        (byYear[y] = byYear[y] || []).push([y + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), v]);
        all.push(v);
      });
      var years = Object.keys(byYear).sort();
      if (!years.length) return VS.empty(ctx, 'Не удалось распознать даты');
      var st = VS.stats(all);
      var a = ctx.area;
      var legendH = 40;
      var rowH = (a.height - legendH) / years.length;
      var cell = Math.max(4, Math.min((a.width - 40) / 54, (rowH - 26) / 7));
      var MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      var DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      return {
        visualMap: {
          min: st.min, max: st.max, calculable: true, orient: 'horizontal', left: a.left, bottom: a.bottom,
          itemWidth: 12, itemHeight: Math.min(220, a.width * 0.4),
          inRange: { color: ctx.seqScale(s['cal.scale']) },
          textStyle: { color: ctx.theme.muted, fontSize: ctx.fontSize - 1 },
          formatter: function (v) { return ctx.fmt(v); },
        },
        calendar: years.map(function (y, i) {
          return {
            range: y,
            top: a.top + 22 + i * rowH,
            left: a.left + 34,
            cellSize: [cell, cell],
            orient: 'horizontal',
            dayLabel: { firstDay: Number(s['cal.firstDay']), nameMap: DAYS, color: ctx.theme.muted, fontSize: Math.max(9, ctx.fontSize - 2) },
            monthLabel: { nameMap: MONTHS, color: ctx.theme.muted, fontSize: ctx.fontSize - 1 },
            yearLabel: { show: years.length > 1, color: ctx.theme.text, fontSize: ctx.fontSize + 2, margin: 26 },
            itemStyle: { color: s['cal.empty'], borderColor: ctx.theme.background, borderWidth: Number(s['cal.gap']) },
            splitLine: { show: false },
          };
        }),
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            var d = new Date(p.value[0]);
            return VS.tooltipHtml(ctx, d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }), [{ name: V.name, value: ctx.fmt(p.value[1]), color: p.color }]);
          },
        },
        series: years.map(function (y, i) {
          return { type: 'heatmap', coordinateSystem: 'calendar', calendarIndex: i, data: byYear[y] };
        }),
      };
    },
  });
})(window.VS);

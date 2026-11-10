(function (VS) {
  'use strict';

  VS.registerTemplate({
    id: 'race',
    order: 35,
    name: 'Гонка столбцов',
    category: 'Динамика',
    description: 'Анимированный рейтинг во времени (bar chart race): столбцы обгоняют друг друга.',
    icon: '<svg viewBox="0 0 48 36"><rect x="4" y="4" width="38" height="6" rx="1.5" fill="var(--c2)"/><rect x="4" y="13" width="30" height="6" rx="1.5" fill="var(--c1)"/><rect x="4" y="22" width="20" height="6" rx="1.5" fill="var(--c3)"/><path d="M37 16 l5 0 m-2 -2 l2 2 l-2 2" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>',
    bindings: [
      { key: 'label', name: 'Названия', dataType: 'text', description: 'Участники рейтинга' },
      { key: 'values', name: 'Значения по периодам', dataType: 'number', multiple: true, description: 'Каждая колонка — отдельный кадр (год, месяц…)' },
      { key: 'group', name: 'Группа (для цвета)', dataType: 'text', optional: true },
    ],
    common: ['layout', 'colors', 'legend', 'number', 'appearance'],
    sections: [
      {
        id: 'race',
        title: 'Анимация гонки',
        items: [
          { key: 'race.bars', label: 'Столбцов на экране', type: 'range', min: 3, max: 30, default: 10 },
          { key: 'race.duration', label: 'Длительность кадра, мс', type: 'range', min: 200, max: 5000, step: 100, default: 1400 },
          { key: 'race.autoplay', label: 'Автозапуск', type: 'toggle', default: true },
          { key: 'race.loop', label: 'Повторять по кругу', type: 'toggle', default: false },
          { key: 'race.showFrame', label: 'Крупная подпись периода', type: 'toggle', default: true },
          { key: 'race.colorBy', label: 'Цвет', type: 'radio', options: [['name', 'По названию'], ['group', 'По группе']], default: 'name', help: '«По группе» — нужна колонка «Группа»' },
          { key: 'labels.show', label: 'Значения у столбцов', type: 'toggle', default: true },
          { key: 'bar.radius', label: 'Скругление', type: 'range', min: 0, max: 12, default: 3 },
        ],
      },
    ],
    sample: {
      data: [
        ['Город', 'Регион', '1970', '1980', '1990', '2000', '2010', '2020', '2025'],
        ['Токио', 'Азия', '23,3', '28,5', '32,5', '34,4', '36,8', '37,4', '37,0'],
        ['Дели', 'Азия', '3,5', '5,6', '9,7', '15,7', '22,0', '30,3', '34,7'],
        ['Шанхай', 'Азия', '6,0', '7,6', '8,6', '13,9', '20,3', '27,1', '30,5'],
        ['Сан-Паулу', 'Америка', '7,6', '12,1', '14,8', '17,0', '19,7', '22,0', '22,8'],
        ['Мехико', 'Америка', '8,8', '13,0', '15,6', '18,5', '20,1', '21,8', '22,5'],
        ['Каир', 'Африка', '5,6', '7,3', '9,9', '13,6', '16,9', '20,9', '23,1'],
        ['Мумбаи', 'Азия', '5,8', '8,7', '12,4', '16,4', '18,3', '20,4', '21,7'],
        ['Пекин', 'Азия', '4,4', '5,4', '6,8', '10,2', '16,4', '20,5', '22,6'],
        ['Нью-Йорк', 'Америка', '16,2', '15,6', '16,1', '17,8', '18,4', '18,8', '19,0'],
        ['Осака', 'Азия', '15,3', '17,0', '18,4', '18,7', '19,3', '19,2', '18,9'],
        ['Москва', 'Европа', '7,1', '8,1', '9,0', '10,0', '11,5', '12,5', '12,7'],
        ['Лагос', 'Африка', '0,8', '1,8', '4,8', '7,3', '10,4', '14,4', '16,5'],
        ['Стамбул', 'Европа', '2,8', '4,4', '6,6', '8,7', '12,7', '15,2', '16,0'],
        ['Лондон', 'Европа', '7,5', '7,0', '6,8', '7,3', '8,0', '9,3', '9,6'],
        ['Лос-Анджелес', 'Америка', '8,4', '9,5', '11,0', '11,8', '12,2', '12,4', '12,5'],
        ['Париж', 'Европа', '8,2', '8,7', '9,3', '9,7', '10,5', '11,0', '11,3'],
      ],
      bindings: { label: 0, group: 1, values: [2, 3, 4, 5, 6, 7, 8] },
      settings: { title: 'Крупнейшие агломерации мира', subtitle: 'Население, млн человек', footer: 'Источник: демонстрационные данные (оценки ООН, округлено)', 'race.colorBy': 'group', 'race.bars': 10 },
    },
    frames: function (ctx) {
      return ctx.columnsOf('values').map(function (c) { return c.name; });
    },
    legendNames: function (ctx) {
      var g = ctx.column('group');
      return g && ctx.s['race.colorBy'] === 'group' ? VS.util.uniq(g.raw.filter(Boolean)) : null;
    },
    build: function (ctx) {
      var s = ctx.s;
      var label = ctx.column('label');
      var vals = ctx.columnsOf('values');
      if (!label || !vals.length) return VS.empty(ctx, 'Привяжите колонку «Названия» и колонки значений по периодам');
      var group = ctx.column('group');
      var byGroup = group && s['race.colorBy'] === 'group';
      var groups = byGroup ? VS.util.uniq(group.raw.filter(Boolean)) : [];
      var f = ctx.frame || 0;
      var col = vals[f];
      var names = label.raw;
      var N = Math.min(Number(s['race.bars']) || 10, names.length);
      var dur = Number(s['race.duration']) || 1400;
      var r = Number(s['bar.radius']) || 0;
      var colorOf = function (i) {
        if (byGroup) return ctx.color(group.raw[i], groups.indexOf(group.raw[i]));
        return ctx.color(names[i], i);
      };
      var fs = Math.max(24, Math.min(ctx.area.height / 4.2, 96));
      var nameW = Math.min(ctx.area.width * 0.26, 200);

      var series = [{
        type: 'bar',
        id: 'race',
        name: col.name,
        realtimeSort: true,
        seriesLayoutBy: 'column',
        barCategoryGap: '18%',
        data: col.num.map(function (v, i) {
          return { value: v === null ? 0 : v, rowIndex: i, itemStyle: { color: colorOf(i), borderRadius: [0, r, r, 0] } };
        }),
        label: VS.labelStyle(ctx, {
          show: !!s['labels.show'],
          position: 'right',
          valueAnimation: true,
          fontWeight: 'bold',
          fontSize: ctx.fontSize + 1,
          formatter: function (p) { return ctx.fmt(p.value); },
        }),
      }];
      // Для легенды по группам добавляем «пустые» серии с цветами групп
      if (byGroup) {
        groups.forEach(function (g, gi) {
          series.push({ type: 'line', name: g, data: [], color: ctx.color(g, gi), itemStyle: { color: ctx.color(g, gi) } });
        });
      }

      var yAxis = VS.axis(ctx, 'y', { type: 'category', data: names, inverse: true });
      yAxis.max = N - 1;
      yAxis.animationDuration = 300;
      yAxis.animationDurationUpdate = 300;
      yAxis.axisLabel.width = nameW;
      yAxis.axisLabel.overflow = 'truncate';
      yAxis.axisLabel.interval = 0;
      yAxis.axisLabel.hideOverlap = false;
      yAxis.axisLabel.color = ctx.theme.text;
      yAxis.axisLabel.fontSize = ctx.fontSize + 1;
      yAxis.axisLine.show = false;
      var xAxis = VS.axis(ctx, 'x', { type: 'value' });
      xAxis.max = 'dataMax';
      xAxis.position = 'top';
      xAxis.splitLine = { show: true, lineStyle: { color: ctx.theme.grid } };
      xAxis.axisLabel.hideOverlap = true;

      var out = {
        animation: !ctx.forExport,
        animationDuration: 0,
        animationDurationUpdate: dur,
        animationEasing: 'linear',
        animationEasingUpdate: 'linear',
        series: series,
        yAxis: yAxis,
        xAxis: xAxis,
        grid: VS.grid(ctx, { right: s['labels.show'] ? 40 : 0 }),
        tooltip: {
          trigger: 'item',
          formatter: function (p) {
            return VS.tooltipHtml(ctx, p.name, [{ name: col.name, value: ctx.fmt(p.value), color: p.color }]);
          },
        },
        graphic: {
          elements: [{
            type: 'text',
            id: 'frameLabel',
            right: ctx.area.right + 12,
            bottom: ctx.area.bottom + 20,
            invisible: !s['race.showFrame'],
            silent: true,
            z: 0,
            style: { text: col.name, font: 'bold ' + Math.round(fs) + 'px ' + ctx.font, fill: ctx.theme.text, opacity: 0.16, textAlign: 'right' },
          }],
        },
      };
      if (!byGroup) out.legend = false;
      return out;
    },
  });
})(window.VS);

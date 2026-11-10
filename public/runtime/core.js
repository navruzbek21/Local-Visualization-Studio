/*!
 * Visualization Studio runtime — ядро рендеринга визуализаций на Apache ECharts.
 * Классический скрипт (без модулей): тот же файл встраивается в экспорт HTML,
 * поэтому визуализации работают полностью автономно.
 */
(function (global) {
  'use strict';

  var VS = (global.VS = global.VS || {});
  VS.version = '1.2.0';
  VS.templates = VS.templates || {};
  VS.templateOrder = VS.templateOrder || [];
  VS.templateSources = VS.templateSources || {};

  // ===================================================================== утилиты
  var hasOwn = Object.prototype.hasOwnProperty;

  function isEmpty(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function uniq(arr) {
    var seen = new Set();
    var out = [];
    arr.forEach(function (v) {
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    });
    return out;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function plural(n, one, few, many) {
    var m10 = Math.abs(n) % 10, m100 = Math.abs(n) % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  VS.util = { isEmpty: isEmpty, clamp: clamp, uniq: uniq, escapeHtml: escapeHtml, plural: plural };

  // Буквенное имя колонки, как в Excel: 0 → A, 26 → AA
  VS.colLetter = function (i) {
    var s = '';
    i = i + 1;
    while (i > 0) {
      var m = (i - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  };

  // ===================================================================== числа и даты
  // Понимает «1 234,56», «1,234.56», «12,5%», «₽ 1 000», «-3.2e5», «(150)» и т.п.
  VS.parseNumber = function (v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (isEmpty(v)) return null;
    var s = String(v).trim();
    // буквы вплотную к цифрам («12abc», «3а», «5кг») — это код/артикул, а не число; экспонента «1e3» допустима
    if (/\d[A-Za-zА-Яа-яЁё]/.test(s) && !/^[^A-Za-zА-Яа-яЁё]*\d[eE][+-]?\d+$/.test(s)) return null;
    var neg = false;
    if (/^\(.*\)$/.test(s)) {
      neg = true;
      s = s.slice(1, -1);
    }
    s = s.replace(/[\s   ']/g, '').replace(/[−–]/g, '-');
    s = s.replace(/^[^\d+\-.,]+/, '').replace(/[^\d]+$/, '');
    if (!s || !/^[+-]?[\d.,]*\d[\d.,]*(e[+-]?\d+)?$/i.test(s)) return null;
    var comma = s.lastIndexOf(','), dot = s.lastIndexOf('.');
    if (comma >= 0 && dot >= 0) {
      if (comma > dot) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (comma >= 0) {
      s = (s.match(/,/g).length > 1) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (dot >= 0 && s.match(/\./g).length > 1) {
      s = s.replace(/\./g, '');
    }
    var n = Number(s);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  };

  var DATE_PATTERNS = [
    // 2024-03-15, 2024-03-15T10:00, 2024/03/15
    { re: /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/, map: [1, 2, 3, 4, 5, 6] },
    // 15.03.2024, 15/03/2024 (день первым — российский формат)
    { re: /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/, map: [3, 2, 1, 4, 5, 6] },
    // 2024-03
    { re: /^(\d{4})-(\d{1,2})$/, map: [1, 2, null] },
  ];
  VS.parseDate = function (v) {
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (isEmpty(v) || typeof v === 'number') return null;
    var s = String(v).trim();
    for (var i = 0; i < DATE_PATTERNS.length; i++) {
      var p = DATE_PATTERNS[i];
      var m = p.re.exec(s);
      if (!m) continue;
      var g = function (k) {
        return p.map[k] ? Number(m[p.map[k]] || 0) : k === 2 ? 1 : 0;
      };
      var mo = g(1);
      var d = g(2);
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      return new Date(g(0), mo - 1, d, g(3), g(4), g(5));
    }
    return null;
  };

  VS.inferType = function (values) {
    var n = 0, num = 0, date = 0;
    for (var i = 0; i < values.length && n < 500; i++) {
      var v = values[i];
      if (isEmpty(v)) continue;
      n++;
      if (VS.parseNumber(v) !== null) num++;
      else if (VS.parseDate(v)) date++;
    }
    if (!n) return 'text';
    if (num / n >= 0.9) return 'number';
    if (date / n >= 0.9) return 'date';
    return 'text';
  };

  // ===================================================================== форматирование чисел
  var COMPACT = {
    ru: [[1e12, ' трлн'], [1e9, ' млрд'], [1e6, ' млн'], [1e3, ' тыс.']],
    en: [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']],
  };
  var SEP = { space: ' ', comma: ',', dot: '.', apostrophe: '’', none: '' };

  VS.makeFormatter = function (s) {
    var decimals = s['number.decimals'];
    var thousands = SEP[s['number.thousands']] != null ? SEP[s['number.thousands']] : ' ';
    var decimal = s['number.decimal'] === 'dot' ? '.' : ',';
    var prefix = s['number.prefix'] || '';
    var suffix = s['number.suffix'] || '';
    var compact = COMPACT[s['number.compact']];

    function group(intStr) {
      if (!thousands || intStr.length < 4) return intStr; // 1000 → «1000» в русской типографике допустимо, но 12 345 разделяем
      return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    }
    function fixed(abs, dec) {
      var str;
      if (dec === 'auto' || dec === undefined || dec === null || dec === '') {
        var d = abs >= 100 ? 0 : abs >= 1 ? 2 : abs === 0 ? 0 : Math.min(6, 2 - Math.floor(Math.log10(abs)));
        str = abs.toFixed(d);
        if (str.indexOf('.') >= 0) str = str.replace(/0+$/, '').replace(/\.$/, '');
      } else {
        str = abs.toFixed(Number(dec));
      }
      return str;
    }
    function fmt(v, opts) {
      if (v === null || v === undefined || v === '') return '';
      var n = typeof v === 'number' ? v : VS.parseNumber(v);
      if (n === null) return String(v);
      opts = opts || {};
      var abs = Math.abs(n);
      var unit = '';
      var dec = opts.decimals !== undefined ? opts.decimals : decimals;
      if (compact && !opts.noCompact) {
        for (var i = 0; i < compact.length; i++) {
          if (abs >= compact[i][0]) {
            abs = abs / compact[i][0];
            unit = compact[i][1];
            if (dec === 'auto' || dec == null) dec = abs >= 100 ? 0 : 1;
            break;
          }
        }
      }
      var str = fixed(abs, dec);
      var parts = str.split('.');
      var out = group(parts[0]) + (parts[1] ? decimal + parts[1] : '');
      if (out.replace(/[^1-9]/g, '') === '' && n !== 0 && !parts[1]) {
        // очень маленькое значение, округлилось до 0
      }
      var sign = n < 0 && Number(str) !== 0 ? '−' : opts.plusSign && n > 0 ? '+' : '';
      return sign + (opts.noAffix ? '' : prefix) + out + unit + (opts.noAffix ? '' : suffix);
    }
    return fmt;
  };

  // ===================================================================== палитры
  // Категориальные палитры. «Студия» — проверенный на различимость при дальтонизме порядок цветов.
  VS.palettes = {
    studio: { name: 'Студия (по умолчанию)', colors: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'] },
    okabe: { name: 'Okabe–Ito (для дальтоников)', colors: ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000'] },
    tableau: { name: 'Tableau 10', colors: ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'] },
    echarts: { name: 'ECharts классика', colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'] },
    corporate: { name: 'Корпоративная синяя', colors: ['#0b3c7d', '#2a78d6', '#86b6ef', '#5c6b7a', '#a5b1bd', '#eb6834', '#1baf7a', '#eda100'] },
    bold: { name: 'Яркая', colors: ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#469990', '#9a6324'] },
    pastel: { name: 'Пастельная', colors: ['#8fb9e8', '#f5b48c', '#9ad8bf', '#f2d083', '#e8a6c4', '#b4a7e5', '#f29e9e', '#b5d48a'] },
    earth: { name: 'Земляная', colors: ['#8c510a', '#bf812d', '#35978f', '#01665e', '#dfc27d', '#80cdc1', '#543005', '#003c30'] },
    mono: { name: 'Монохромная', colors: ['#1f2933', '#3e4c59', '#616e7c', '#7b8794', '#9aa5b1', '#cbd2d9'] },
  };

  // Последовательные (одна величина) и расходящиеся шкалы
  VS.scales = {
    blues: { name: 'Синяя', colors: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'] },
    greens: { name: 'Зелёная', colors: ['#d8f3e6', '#a6e3c6', '#6bcc9f', '#2fae78', '#16895a', '#0d6643', '#06452c'] },
    oranges: { name: 'Оранжевая', colors: ['#fde4d3', '#fbc4a0', '#f69b66', '#eb6834', '#c9501f', '#9c3c14', '#6e290c'] },
    reds: { name: 'Красная', colors: ['#fde0dd', '#fbb4ae', '#f6827c', '#e34948', '#bf2f32', '#931f25', '#661419'] },
    purples: { name: 'Фиолетовая', colors: ['#e8e4f8', '#c9c0ee', '#a597e1', '#7e6ccf', '#5f4bb6', '#4a3aa7', '#2f2470'] },
    grays: { name: 'Серая', colors: ['#f0efec', '#d4d3cf', '#aeada8', '#86857f', '#5f5e59', '#3c3b38', '#1f1f1d'] },
    viridis: { name: 'Viridis', colors: ['#fde725', '#90d743', '#35b779', '#21918c', '#31688e', '#443983', '#440154'] },
    rdbu: { name: 'Красный ↔ синий', diverging: true, colors: ['#b2182b', '#e34948', '#f4a3a0', '#f0efec', '#9ec5f4', '#3987e5', '#184f95'] },
    rdylgn: { name: 'Красный ↔ зелёный', diverging: true, colors: ['#c0392b', '#e8735c', '#f5c27a', '#f0efec', '#a6d99b', '#4fae5c', '#1d7a36'] },
  };

  VS.fonts = {
    system: { name: 'Системный', css: '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
    arial: { name: 'Arial', css: 'Arial, "Helvetica Neue", Helvetica, sans-serif' },
    verdana: { name: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
    tahoma: { name: 'Tahoma', css: 'Tahoma, Verdana, sans-serif' },
    roboto: { name: 'Roboto', css: 'Roboto, "Segoe UI", Arial, sans-serif' },
    ptsans: { name: 'PT Sans', css: '"PT Sans", "Segoe UI", Arial, sans-serif' },
    georgia: { name: 'Georgia (с засечками)', css: 'Georgia, "Times New Roman", serif' },
    times: { name: 'Times New Roman', css: '"Times New Roman", Times, serif' },
    mono: { name: 'Моноширинный', css: '"SF Mono", Menlo, Consolas, "Courier New", monospace' },
  };

  // Интерполяция по шкале (для подбора цветов в шаблонах)
  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(c) {
    return '#' + c.map(function (x) {
      return ('0' + Math.round(clamp(x, 0, 255)).toString(16)).slice(-2);
    }).join('');
  }
  VS.color = {
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    mix: function (a, b, t) {
      var x = hexToRgb(a), y = hexToRgb(b);
      return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
    },
    alpha: function (hex, a) {
      var c = hexToRgb(hex);
      return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
    },
    luminance: function (hex) {
      var c = hexToRgb(hex).map(function (v) {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    },
    scale: function (colors, t) {
      t = clamp(t, 0, 1) * (colors.length - 1);
      var i = Math.floor(t);
      if (i >= colors.length - 1) return colors[colors.length - 1];
      return VS.color.mix(colors[i], colors[i + 1], t - i);
    },
  };

  // ===================================================================== измерение текста
  var measureCanvas;
  VS.measureText = function (text, font) {
    if (!measureCanvas) {
      if (typeof document === 'undefined') return String(text).length * 7;
      measureCanvas = document.createElement('canvas').getContext('2d');
    }
    measureCanvas.font = font;
    return measureCanvas.measureText(text).width;
  };
  VS.wrapText = function (text, font, maxWidth) {
    var out = [];
    String(text).split(/\r?\n/).forEach(function (para) {
      var words = para.split(/\s+/);
      var line = '';
      words.forEach(function (w) {
        var test = line ? line + ' ' + w : w;
        if (line && VS.measureText(test, font) > maxWidth) {
          out.push(line);
          line = w;
        } else line = test;
      });
      out.push(line);
    });
    return out;
  };

  // ===================================================================== настройки
  // Общие разделы настроек — подключаются к любому шаблону.
  var ASPECTS = [['16:9', '16:9'], ['4:3', '4:3'], ['3:2', '3:2'], ['1:1', '1:1'], ['3:4', '3:4 (вертикально)'], ['9:16', '9:16 (сторис)'], ['fixed', 'Фиксированная высота']];

  VS.commonSections = {
    layout: {
      id: 'layout',
      title: 'Заголовок и подписи',
      items: [
        { key: 'title', label: 'Заголовок', type: 'text', default: '' },
        { key: 'subtitle', label: 'Подзаголовок', type: 'textarea', default: '' },
        { key: 'footer', label: 'Источник / примечание', type: 'textarea', default: '', placeholder: 'Источник: …' },
        { key: 'layout.align', label: 'Выравнивание', type: 'radio', options: [['left', 'Слева'], ['center', 'По центру']], default: 'left' },
        { key: 'layout.titleSize', label: 'Размер заголовка', type: 'range', min: 12, max: 44, default: 22 },
        { key: 'layout.subtitleSize', label: 'Размер подзаголовка', type: 'range', min: 10, max: 28, default: 15 },
      ],
    },
    appearance: {
      id: 'appearance',
      title: 'Оформление и размер',
      items: [
        { key: 'layout.aspect', label: 'Пропорции', type: 'select', options: ASPECTS, default: '16:9' },
        { key: 'layout.height', label: 'Высота, px', type: 'number', min: 150, max: 4000, default: 500, show: function (s) { return s['layout.aspect'] === 'fixed'; } },
        { key: 'layout.mobileAspect', label: 'Пропорции на узком экране', type: 'select', options: [['same', 'Как на широком']].concat(ASPECTS.slice(0, 6)), default: '1:1', help: 'При ширине меньше 600 px' },
        { key: 'layout.font', label: 'Шрифт', type: 'select', options: Object.keys(VS.fonts).map(function (k) { return [k, VS.fonts[k].name]; }), default: 'system' },
        { key: 'layout.fontSize', label: 'Базовый размер текста', type: 'range', min: 9, max: 20, default: 12 },
        { key: 'layout.background', label: 'Фон', type: 'color', default: '#ffffff' },
        { key: 'layout.textColor', label: 'Цвет текста', type: 'color', default: '#1f2328' },
        { key: 'layout.padding', label: 'Внешние отступы, px', type: 'range', min: 0, max: 60, default: 16 },
      ],
    },
    colors: {
      id: 'colors',
      title: 'Цвета',
      items: [
        { key: 'colors.palette', label: 'Палитра', type: 'palette', default: 'studio' },
        { key: 'colors.custom', label: 'Свои цвета (HEX через запятую)', type: 'text', default: '', placeholder: '#0b3c7d, #eb6834, …', help: 'Заменяют палитру, если заполнено' },
        { key: 'colors.overrides', label: 'Цвета отдельных серий', type: 'textarea', default: '', placeholder: 'Продажи: #2a78d6\nПлан: #9aa5b1', help: 'По строке на серию/категорию: «Название: #цвет»' },
      ],
    },
    legend: {
      id: 'legend',
      title: 'Легенда',
      items: [
        { key: 'legend.show', label: 'Показывать легенду', type: 'toggle', default: true },
        { key: 'legend.position', label: 'Расположение', type: 'radio', options: [['top', 'Сверху'], ['bottom', 'Снизу'], ['right', 'Справа']], default: 'top', show: function (s) { return s['legend.show']; } },
        { key: 'legend.align', label: 'Выравнивание', type: 'radio', options: [['left', 'Слева'], ['center', 'Центр'], ['right', 'Справа']], default: 'left', show: function (s) { return s['legend.show'] && s['legend.position'] !== 'right'; } },
        { key: 'legend.icon', label: 'Значок', type: 'select', options: [['circle', 'Круг'], ['roundRect', 'Скруглённый прямоугольник'], ['rect', 'Прямоугольник'], ['line', 'Линия']], default: 'circle', show: function (s) { return s['legend.show']; } },
      ],
    },
    tooltip: {
      id: 'tooltip',
      title: 'Всплывающие подсказки',
      items: [
        { key: 'tooltip.show', label: 'Показывать подсказки', type: 'toggle', default: true },
        { key: 'tooltip.template', label: 'Свой шаблон подсказки', type: 'textarea', default: '', placeholder: '<b>{name}</b><br>{series}: {value}', help: 'Подстановки: {name}, {series}, {value}, {percent} и {{Название колонки}}. Можно HTML.', show: function (s) { return s['tooltip.show']; } },
      ],
    },
    number: {
      id: 'number',
      title: 'Формат чисел',
      items: [
        { key: 'number.prefix', label: 'Префикс', type: 'text', default: '', placeholder: '$' },
        { key: 'number.suffix', label: 'Суффикс', type: 'text', default: '', placeholder: ' ₽, %' },
        { key: 'number.decimals', label: 'Знаков после запятой', type: 'select', options: [['auto', 'Авто'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], default: 'auto' },
        { key: 'number.thousands', label: 'Разделитель тысяч', type: 'select', options: [['space', 'Пробел (1 000)'], ['comma', 'Запятая (1,000)'], ['dot', 'Точка (1.000)'], ['none', 'Нет (1000)']], default: 'space' },
        { key: 'number.decimal', label: 'Десятичный разделитель', type: 'radio', options: [['comma', 'Запятая'], ['dot', 'Точка']], default: 'comma' },
        { key: 'number.compact', label: 'Сокращения', type: 'select', options: [['none', 'Нет'], ['ru', 'тыс. / млн / млрд'], ['en', 'K / M / B']], default: 'none' },
      ],
    },
    filter: {
      id: 'filter',
      title: 'Фильтр',
      items: [
        { key: 'filter.control', label: 'Элемент управления', type: 'radio', options: [['dropdown', 'Список'], ['buttons', 'Кнопки']], default: 'dropdown' },
        { key: 'filter.all', label: 'Вариант «Все»', type: 'toggle', default: false },
        { key: 'filter.allLabel', label: 'Подпись для «Все»', type: 'text', default: 'Все', show: function (s) { return s['filter.all']; } },
        { key: 'filter.default', label: 'Значение по умолчанию', type: 'text', default: '', help: 'Пусто — первое значение' },
      ],
    },
    animation: {
      id: 'animation',
      title: 'Анимация',
      items: [
        { key: 'animation.enabled', label: 'Анимация', type: 'toggle', default: true },
        { key: 'animation.duration', label: 'Длительность, мс', type: 'range', min: 100, max: 3000, step: 100, default: 800, show: function (s) { return s['animation.enabled']; } },
        { key: 'animation.easing', label: 'Плавность', type: 'select', options: [['cubicOut', 'Плавное замедление'], ['linear', 'Линейная'], ['elasticOut', 'Упругая'], ['bounceOut', 'Отскок'], ['quarticInOut', 'Плавная в обе стороны']], default: 'cubicOut', show: function (s) { return s['animation.enabled']; } },
      ],
    },
  };

  // Раздел настроек осей для декартовых графиков
  VS.axisSection = function (opts) {
    opts = opts || {};
    var xl = opts.xLabel || 'Ось X';
    var yl = opts.yLabel || 'Ось Y';
    return {
      id: 'axes',
      title: 'Оси',
      items: [
        { type: 'heading', label: xl },
        { key: 'xAxis.show', label: 'Показывать ось', type: 'toggle', default: true },
        { key: 'xAxis.title', label: 'Название оси', type: 'text', default: '' },
        opts.xValue
          ? { key: 'xAxis.min', label: 'Минимум', type: 'text', default: '', placeholder: 'авто' }
          : { key: 'xAxis.rotate', label: 'Поворот подписей', type: 'select', options: [['auto', 'Авто'], ['0', '0°'], ['30', '30°'], ['45', '45°'], ['90', '90°']], default: 'auto' },
        opts.xValue ? { key: 'xAxis.max', label: 'Максимум', type: 'text', default: '', placeholder: 'авто' } : null,
        opts.xValue ? { key: 'xAxis.log', label: 'Логарифмическая шкала', type: 'toggle', default: false } : null,
        { key: 'xAxis.grid', label: 'Линии сетки', type: 'toggle', default: !!opts.xGrid },
        { type: 'heading', label: yl },
        { key: 'yAxis.show', label: 'Показывать ось', type: 'toggle', default: true },
        { key: 'yAxis.title', label: 'Название оси', type: 'text', default: '' },
        { key: 'yAxis.min', label: 'Минимум', type: 'text', default: '', placeholder: 'авто' },
        { key: 'yAxis.max', label: 'Максимум', type: 'text', default: '', placeholder: 'авто' },
        { key: 'yAxis.log', label: 'Логарифмическая шкала', type: 'toggle', default: false },
        { key: 'yAxis.grid', label: 'Линии сетки', type: 'toggle', default: true },
        { key: 'yAxis.position', label: 'Положение', type: 'radio', options: [['left', 'Слева'], ['right', 'Справа']], default: 'left' },
        { type: 'heading', label: 'Опорная линия' },
        { key: 'ref.value', label: 'Значение', type: 'text', default: '', placeholder: 'например, 1000', help: 'Горизонтальная линия цели/среднего. «avg» — среднее' },
        { key: 'ref.label', label: 'Подпись', type: 'text', default: '', show: function (s) { return !!s['ref.value']; } },
      ].filter(Boolean),
    };
  };

  // Опорная линия (цель, план, среднее) для декартовых графиков
  VS.refLine = function (ctx, horizontal) {
    var raw = String(ctx.s['ref.value'] || '').trim();
    if (!raw) return null;
    var item = {};
    if (/^(avg|среднее)$/i.test(raw)) item.type = 'average';
    else {
      var v = VS.parseNumber(raw);
      if (v === null) return null;
      item[horizontal ? 'xAxis' : 'yAxis'] = v;
    }
    var label = ctx.s['ref.label'];
    return {
      silent: true,
      symbol: 'none',
      lineStyle: { color: ctx.theme.text, type: 'dashed', width: 1.2, opacity: 0.75 },
      label: VS.labelStyle(ctx, {
        position: horizontal ? 'insideEndTop' : 'insideEndTop',
        color: ctx.theme.text,
        fontSize: ctx.fontSize - 1,
        formatter: function (p) { return (label ? label + ': ' : '') + ctx.fmt(p.value); },
      }),
      data: [item],
    };
  };

  VS.registerTemplate = function (def) {
    if (!def || !def.id || (typeof def.build !== 'function' && typeof def.renderHtml !== 'function')) {
      console.error('VS.registerTemplate: нужен объект с id и build() (или renderHtml() для HTML-шаблонов)', def);
      return;
    }
    def.html = typeof def.renderHtml === 'function';
    def.category = def.category || 'Другое';
    def.bindings = def.bindings || [];
    def.sections = def.sections || [];
    def.common = def.common || ['layout', 'colors', 'legend', 'tooltip', 'number', 'animation', 'appearance'];
    def.variants = def.variants && def.variants.length ? def.variants : [{ name: def.name, settings: {} }];
    if (!VS.templates[def.id]) VS.templateOrder.push(def.id);
    VS.templates[def.id] = def;
  };

  // Полный список разделов настроек шаблона (собственные + общие в нужном порядке)
  VS.sectionsFor = function (tpl) {
    var common = tpl.common.slice();
    var hasFilter = tpl.bindings.some(function (b) { return b.key === 'filter'; });
    if (hasFilter && common.indexOf('filter') < 0) common.push('filter');
    var out = [];
    if (common.indexOf('layout') >= 0) out.push(VS.commonSections.layout);
    tpl.sections.forEach(function (s) { out.push(s); });
    ['colors', 'legend', 'tooltip', 'number', 'filter', 'animation', 'appearance'].forEach(function (id) {
      if (common.indexOf(id) >= 0) out.push(VS.commonSections[id]);
    });
    return out;
  };

  // Загрузка скриптов шаблонов (последовательно, чтобы сохранить порядок регистрации)
  VS.loadScripts = function (urls) {
    return urls.reduce(function (p, url) {
      return p.then(function () {
        return new Promise(function (resolve) {
          var before = VS.templateOrder.length;
          var sc = document.createElement('script');
          sc.src = url;
          sc.onload = function () {
            // запоминаем файл каждого шаблона — нужен для автономного экспорта HTML
            VS.templateOrder.slice(before).forEach(function (id) { VS.templateSources[id] = url; });
            resolve();
          };
          sc.onerror = function () {
            console.error('Не удалось загрузить шаблон ' + url);
            resolve();
          };
          document.head.appendChild(sc);
        });
      });
    }, Promise.resolve());
  };

  VS.sortedTemplates = function () {
    return VS.templateOrder.map(function (id) { return VS.templates[id]; }).sort(function (a, b) {
      return (a.order || 100) - (b.order || 100);
    });
  };

  // Новый проект из шаблона (с демонстрационными данными)
  VS.newProject = function (tplId, variantIndex) {
    var tpl = VS.templates[tplId];
    var variant = tpl.variants[variantIndex || 0] || tpl.variants[0];
    var sample = tpl.sample || { data: [['Категория', 'Значение'], ['А', 10], ['Б', 20]], bindings: {}, settings: {} };
    var settings = {};
    var k;
    for (k in sample.settings || {}) settings[k] = sample.settings[k];
    for (k in variant.settings || {}) settings[k] = variant.settings[k];
    for (k in variant.sampleSettings || {}) settings[k] = variant.sampleSettings[k];
    return {
      title: settings.title || variant.name || tpl.name,
      template: tplId,
      data: JSON.parse(JSON.stringify(variant.sampleData || sample.data)),
      bindings: JSON.parse(JSON.stringify(variant.sampleBindings || sample.bindings || {})),
      settings: settings,
    };
  };

  VS.defaultSettings = function (tpl) {
    var s = {};
    VS.sectionsFor(tpl).forEach(function (sec) {
      sec.items.forEach(function (it) {
        if (it.key && it.default !== undefined) s[it.key] = it.default;
      });
    });
    // шаблон может переопределить умолчания общих разделов (например, скрыть легенду)
    for (var k in tpl.defaults || {}) s[k] = tpl.defaults[k];
    return s;
  };

  VS.resolveSettings = function (tpl, settings) {
    var s = VS.defaultSettings(tpl);
    if (settings) for (var k in settings) if (hasOwn.call(settings, k) && settings[k] !== undefined) s[k] = settings[k];
    return s;
  };

  // ===================================================================== данные
  // table — двумерный массив, первая строка — заголовки (как в электронной таблице).
  VS.prepareTable = function (table) {
    table = Array.isArray(table) ? table : [];
    var header = table[0] || [];
    var body = table.slice(1).filter(function (r) {
      return Array.isArray(r) && r.some(function (v) { return !isEmpty(v); });
    });
    var ncols = header.length;
    body.forEach(function (r) { if (r.length > ncols) ncols = r.length; });
    var columns = [];
    for (var i = 0; i < ncols; i++) {
      var raw = body.map(function (r) { return r[i]; });
      var name = isEmpty(header[i]) ? VS.colLetter(i) : String(header[i]).trim();
      columns.push({ index: i, letter: VS.colLetter(i), name: name, type: VS.inferType(raw) });
    }
    return { columns: columns, rows: body };
  };

  // Автоматическая привязка колонок к полям шаблона (как «умная» привязка во Flourish)
  // Поиск колонки по названию (регулярное выражение или список), например /^(qн|нефть|oil|wopr)/i
  VS.findColumn = function (columns, re, used) {
    var list = Array.isArray(re) ? re : [re];
    for (var k = 0; k < list.length; k++) {
      for (var i = 0; i < columns.length; i++) {
        var c = columns[i];
        if (used && used[c.index]) continue;
        if (list[k].test(c.name)) return c;
      }
    }
    return null;
  };

  // Распознавание колонок по типичным названиям (рус./англ., мнемоники Eclipse/tNavigator).
  // После кириллицы вместо \b — (?![а-я…]): в JS граница слова \b учитывает только латиницу.
  var RE = {
    date: [/^(дата|date|период|period|месяц|month|dateprd)(?![a-zа-яё0-9_])/i, /(дата|date)/i],
    oil: [/(дебит|добыча|qн).*нефт/i, /^q\s*н(?![a-zа-яё])/i, /\b(wopr|fopr|gopr|bore_oil)/i, /^oil\b/i, /^(?!.*(накоп|cum)).*нефт/i],
    water: [/(дебит|добыча|qв).*вод/i, /^q\s*в(?![a-zа-яё])/i, /\b(wwpr|fwpr|gwpr|bore_wat)/i, /^water\b/i],
    liquid: [/(дебит|добыча|qж).*жидк/i, /^q\s*ж(?![a-zа-яё])/i, /\b(wlpr|flpr|glpr)/i, /liquid/i],
    gas: [/(дебит|добыча).*газ/i, /\b(wgpr|fgpr|ggpr|bore_gas)/i, /^gas\b/i, /^газ/i],
    inj: [/закач/i, /приём/i, /\b(wwir|fwir|gwir|bore_wi)/i, /inject/i, /^wi\b/i],
    wc: [/обводн/i, /\b(wwct|fwct|gwct)/i, /water\s*cut/i, /^wc\b/i],
    pressure: [/давлен/i, /\b(wbhp|fpr|wthp|bhp|avg_downhole_pressure)/i, /pressure/i, /^p\s*(пл|заб)/i],
    well: [/^(скв|скважина|well|wellbore|npd_well_bore_name)/i, /(скважин|wellbore name)/i],
    event: [/(гтм|мероприят|событ|event|комментар)/i],
    x: [/^(x|х)(\b|[,\s(])/i, /координата\s*x/i, /^(east|easting)/i],
    y: [/^(y|у)(\b|[,\s(])/i, /координата\s*y/i, /^(north|northing)/i],
    depth: [/^(dept|depth|глубина|md|tvd)(?![a-zа-яё])/i, /глубин/i],
    type: [/^(тип|type|назначение|категория|характер)/i],
    cumOil: [/(накоп|cum).*нефт/i, /\b(wopt|fopt)/i, /cum.*oil/i],
    cumWater: [/(накоп|cum).*вод/i, /\b(wwpt|fwpt)/i, /cum.*water/i],
    cumLiquid: [/(накоп|cum).*жидк/i, /\b(wlpt|flpt)/i],
  };
  VS.petroPatterns = RE;

  VS.autoBind = function (tpl, columns) {
    if (tpl.autoBind) return tpl.autoBind(columns);
    var used = {};
    var out = {};
    // сначала — по названиям колонок (поле match в описании привязки)
    tpl.bindings.forEach(function (b) {
      if (!b.match) return;
      if (b.multiple) {
        var many = columns.filter(function (c) { return !used[c.index] && b.match.test(c.name); });
        if (many.length) {
          out[b.key] = many.map(function (c) { return c.index; });
          many.forEach(function (c) { used[c.index] = 1; });
        }
        return;
      }
      var c = VS.findColumn(columns, b.match, used);
      if (c) {
        out[b.key] = c.index;
        used[c.index] = 1;
      }
    });
    var numeric = columns.filter(function (c) { return c.type === 'number'; });
    var texty = columns.filter(function (c) { return c.type !== 'number'; });
    tpl.bindings.forEach(function (b) {
      if (b.key === 'filter' || b.optional || out[b.key] !== undefined) return;
      var pool = b.dataType === 'number' ? numeric : b.dataType === 'text' ? texty.concat(numeric) : columns;
      var free = pool.filter(function (c) { return !used[c.index]; });
      if (!free.length) free = columns.filter(function (c) { return !used[c.index]; });
      if (b.multiple) {
        var many = free.filter(function (c) { return b.dataType !== 'number' || c.type === 'number'; });
        out[b.key] = many.map(function (c) { return c.index; });
        many.forEach(function (c) { used[c.index] = 1; });
      } else if (free.length) {
        out[b.key] = free[0].index;
        used[free[0].index] = 1;
      }
    });
    return out;
  };

  // ===================================================================== контекст сборки
  function parseOverrides(text) {
    var map = {};
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var i = line.lastIndexOf(':');
      if (i <= 0) return;
      var name = line.slice(0, i).trim();
      var color = line.slice(i + 1).trim();
      if (name && /^#?[0-9a-f]{3,8}$|^rgb|^hsl|^[a-z]+$/i.test(color)) map[name] = color.charAt(0) === '#' || !/^[0-9a-f]+$/i.test(color) ? color : '#' + color;
    });
    return map;
  }

  function aspectHeight(aspect, width, s) {
    if (aspect === 'fixed') return Number(s['layout.height']) || 500;
    var p = String(aspect || '16:9').split(':');
    var w = Number(p[0]) || 16;
    var h = Number(p[1]) || 9;
    return Math.round((width * h) / w);
  }
  VS.heightFor = function (project, width) {
    var tpl = VS.templates[project.template];
    var s = tpl ? VS.resolveSettings(tpl, project.settings) : project.settings || {};
    var aspect = s['layout.aspect'];
    if (width < 600 && s['layout.mobileAspect'] && s['layout.mobileAspect'] !== 'same') aspect = s['layout.mobileAspect'];
    return Math.max(150, aspectHeight(aspect, width, s));
  };

  // Значения фильтра (уникальные значения колонки «Фильтр»)
  VS.filterValues = function (project) {
    var tpl = VS.templates[project.template];
    if (!tpl) return [];
    var b = project.bindings || {};
    if (b.filter === undefined || b.filter === null || b.filter === '') return [];
    var t = VS.prepareTable(project.data);
    if (b.filter >= t.columns.length) return [];
    return uniq(t.rows.map(function (r) { return isEmpty(r[b.filter]) ? '' : String(r[b.filter]).trim(); }).filter(Boolean));
  };

  VS.createContext = function (project, opts) {
    opts = opts || {};
    var tpl = VS.templates[project.template];
    var s = VS.resolveSettings(tpl, project.settings);
    var table = VS.prepareTable(project.data);
    var bindings = project.bindings || {};
    var columns = table.columns;
    var rows = table.rows;

    // фильтр
    var fIdx = bindings.filter;
    var filterActive = fIdx !== undefined && fIdx !== null && fIdx !== '' && columns[fIdx];
    var filterValue = null;
    if (filterActive && opts.filterValue !== VS.ALL) {
      filterValue = opts.filterValue;
      var values = VS.filterValues(project);
      if (filterValue === undefined || filterValue === null || values.indexOf(filterValue) < 0) {
        filterValue = s['filter.default'] && values.indexOf(s['filter.default']) >= 0 ? s['filter.default'] : s['filter.all'] ? VS.ALL : values[0];
      }
      if (filterValue !== VS.ALL) {
        rows = rows.filter(function (r) { return String(r[fIdx] == null ? '' : r[fIdx]).trim() === filterValue; });
      }
    }

    var palette = VS.palettes[s['colors.palette']] ? VS.palettes[s['colors.palette']].colors : VS.palettes.studio.colors;
    var custom = String(s['colors.custom'] || '').split(/[,;\s]+/).filter(function (c) { return /^#[0-9a-f]{3,8}$/i.test(c); });
    if (custom.length) palette = custom;
    var overrides = parseOverrides(s['colors.overrides']);

    var bg = s['layout.background'] || '#ffffff';
    var text = s['layout.textColor'] || '#1f2328';
    var isDark = VS.color.luminance(bg) < 0.35;
    var font = (VS.fonts[s['layout.font']] || VS.fonts.system).css;
    var fmt = VS.makeFormatter(s);

    function column(idx) {
      var c = columns[idx];
      if (!c) return null;
      return {
        index: c.index, name: c.name, letter: c.letter, type: c.type,
        raw: rows.map(function (r) { return r[idx] === undefined || r[idx] === null ? '' : String(r[idx]).trim(); }),
        num: rows.map(function (r) { return VS.parseNumber(r[idx]); }),
      };
    }

    var ctx = {
      VS: VS,
      echarts: global.echarts,
      project: project,
      template: tpl,
      s: s,
      table: table,
      columns: columns,
      rows: rows,
      width: opts.width || 800,
      height: opts.height || 500,
      forExport: !!opts.forExport,
      frame: opts.frame || 0,
      filterValue: filterValue,
      fmt: fmt,
      palette: palette,
      font: font,
      fontSize: Number(s['layout.fontSize']) || 12,
      theme: {
        background: bg,
        text: text,
        muted: VS.color.mix(text, bg, 0.38),
        faint: VS.color.mix(text, bg, 0.62),
        grid: VS.color.mix(text, bg, isDark ? 0.82 : 0.9),
        axis: VS.color.mix(text, bg, 0.7),
        isDark: isDark,
      },
      has: function (key) {
        var v = bindings[key];
        if (Array.isArray(v)) return v.some(function (i) { return columns[i]; });
        return v !== undefined && v !== null && v !== '' && !!columns[v];
      },
      column: function (key) {
        var v = bindings[key];
        if (Array.isArray(v)) v = v[0];
        if (v === undefined || v === null || v === '') return null;
        return column(Number(v));
      },
      columnsOf: function (key) {
        var v = bindings[key];
        if (v === undefined || v === null || v === '') return [];
        if (!Array.isArray(v)) v = [v];
        return v.map(Number).map(column).filter(Boolean);
      },
      // цвет для серии/категории: сначала ручное переопределение, затем палитра по порядку
      color: function (name, i) {
        if (name !== undefined && overrides[name]) return overrides[name];
        return palette[(i || 0) % palette.length];
      },
      overrides: overrides,
      warnings: [],
      seqScale: function (key) {
        var sc = VS.scales[key] || VS.scales.blues;
        return sc.colors;
      },
    };
    return ctx;
  };

  VS.ALL = '\u0000__all__';

  // ===================================================================== раскладка
  function headerLayout(ctx, opts) {
    var s = ctx.s;
    var pad = Number(s['layout.padding']);
    if (isNaN(pad)) pad = 16;
    var W = ctx.width;
    var H = ctx.height;
    var maxW = Math.max(50, W - pad * 2);
    var align = s['layout.align'] === 'center' ? 'center' : 'left';
    var titles = [];
    var y = pad;

    function block(text, size, weight, color, extraGap) {
      if (isEmpty(text)) return;
      var f = weight + ' ' + size + 'px ' + ctx.font;
      var lines = VS.wrapText(text, f, maxW);
      var lh = Math.round(size * 1.28);
      titles.push({
        text: lines.join('\n'),
        left: align === 'center' ? W / 2 : pad,
        top: y,
        textAlign: align,
        textStyle: { fontSize: size, fontWeight: weight === 'bold' ? 'bold' : 'normal', color: color, fontFamily: ctx.font, lineHeight: lh },
      });
      y += lines.length * lh + (extraGap || 0);
    }
    block(s.title, Number(s['layout.titleSize']) || 22, 'bold', ctx.theme.text, 4);
    block(s.subtitle, Number(s['layout.subtitleSize']) || 15, 'normal', ctx.theme.muted, 0);
    var top = y > pad ? y + 14 : pad;

    // примечание снизу
    var bottom = pad;
    if (!isEmpty(s.footer)) {
      var size = Math.max(10, ctx.fontSize - 1);
      var f = 'normal ' + size + 'px ' + ctx.font;
      var lines = VS.wrapText(s.footer, f, maxW);
      var lh = Math.round(size * 1.35);
      var h = lines.length * lh;
      titles.push({
        text: lines.join('\n'),
        left: align === 'center' ? W / 2 : pad,
        top: H - pad - h,
        textAlign: align,
        textStyle: { fontSize: size, fontWeight: 'normal', color: ctx.theme.muted, fontFamily: ctx.font, lineHeight: lh },
      });
      bottom = pad + h + 10;
    }

    // место под HTML-элементы управления (фильтр, проигрыватель)
    var controlsTop = 0;
    if (opts.filter) {
      if (!ctx.forExport) {
        controlsTop = top;
        top += opts.filterHeight || 40;
      } else if (ctx.filterValue !== null && ctx.filterValue !== VS.ALL) {
        titles.push({
          text: String(ctx.filterValue),
          left: align === 'center' ? W / 2 : pad,
          top: top,
          textAlign: align,
          textStyle: { fontSize: ctx.fontSize + 2, fontWeight: 'bold', color: ctx.theme.text, fontFamily: ctx.font },
        });
        top += ctx.fontSize + 14;
      }
    }
    var playerBottom = 0;
    if (opts.player && !ctx.forExport) {
      playerBottom = bottom;
      bottom += 46;
    }

    return { pad: pad, top: top, bottom: bottom, titles: titles, controlsTop: controlsTop, playerBottom: playerBottom, align: align };
  }

  function legendLayout(ctx, L, names, kind) {
    var s = ctx.s;
    var show = s['legend.show'] && names && names.length > 0;
    if (!show) return null;
    var pos = s['legend.position'] || 'top';
    var size = ctx.fontSize;
    var font = 'normal ' + size + 'px ' + ctx.font;
    var legend = {
      type: 'scroll',
      icon: kind === 'line' && s['legend.icon'] === 'circle' ? 'circle' : s['legend.icon'] || 'circle',
      itemWidth: s['legend.icon'] === 'line' ? 20 : 11,
      itemHeight: s['legend.icon'] === 'line' ? 3 : 11,
      itemGap: 16,
      textStyle: { color: ctx.theme.text, fontSize: size, fontFamily: ctx.font },
      pageTextStyle: { color: ctx.theme.muted },
      pageIconColor: ctx.theme.text,
      pageIconInactiveColor: ctx.theme.faint,
      inactiveColor: ctx.theme.faint,
      data: names,
    };
    if (pos === 'right') {
      var maxw = 0;
      names.forEach(function (n) { maxw = Math.max(maxw, VS.measureText(String(n), font)); });
      var w = Math.min(Math.round(ctx.width * 0.32), Math.ceil(maxw) + 30);
      legend.orient = 'vertical';
      legend.right = L.pad;
      legend.top = L.top;
      legend.bottom = L.bottom;
      legend.align = 'left';
      L.right = L.pad + w + 12;
    } else {
      // сколько строк займёт легенда (ECharts переносит только тип plain; используем scroll — одна строка)
      legend.orient = 'horizontal';
      var a = s['legend.align'] || 'left';
      if (a === 'center') legend.left = 'center';
      else if (a === 'right') legend.right = L.pad;
      else legend.left = L.pad;
      if (a === 'left') legend.left = L.pad - 4;
      var h = size + 14;
      if (pos === 'bottom') {
        legend.bottom = L.bottom;
        L.bottom += h + 8;
      } else {
        legend.top = L.top;
        L.top += h + 8;
      }
    }
    return legend;
  }

  // ===================================================================== вспомогательные построители для шаблонов
  // Декартова ось с общими настройками
  VS.axis = function (ctx, which, o) {
    o = o || {};
    var s = ctx.s;
    var key = o.settingsKey || which + 'Axis';
    var t = ctx.theme;
    var isValue = o.type === 'value' || o.type === 'log';
    var ax = {
      type: o.type || 'category',
      show: s[key + '.show'] !== false,
      axisLine: { show: !isValue, lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: {
        color: t.muted,
        fontSize: ctx.fontSize,
        fontFamily: ctx.font,
        hideOverlap: true,
      },
      splitLine: { show: !!s[key + '.grid'], lineStyle: { color: t.grid, type: isValue ? 'solid' : 'dashed' } },
      nameTextStyle: { color: t.muted, fontSize: ctx.fontSize, fontFamily: ctx.font },
    };
    if (o.data) ax.data = o.data;
    if (o.boundaryGap !== undefined) ax.boundaryGap = o.boundaryGap;
    if (s[key + '.title']) {
      ax.name = s[key + '.title'];
      ax.nameLocation = 'middle';
      ax.nameGap = which === 'x' ? 28 : 40;
      ax.nameTextStyle.fontWeight = 'bold';
    }
    if (isValue) {
      if (s[key + '.log']) ax.type = 'log';
      var mn = VS.parseNumber(s[key + '.min']);
      var mx = VS.parseNumber(s[key + '.max']);
      if (mn !== null) ax.min = mn;
      if (mx !== null) ax.max = mx;
      if (o.percent) {
        ax.max = 100;
        ax.axisLabel.formatter = function (v) { return ctx.fmt(v, { noAffix: true, noCompact: true, decimals: 0 }) + '%'; };
      } else {
        ax.axisLabel.formatter = function (v) { return ctx.fmt(v, { decimals: o.integer ? 0 : undefined }); };
      }
      if (s[key + '.position']) ax.position = s[key + '.position'];
    } else {
      var rot = s[key + '.rotate'];
      if (rot && rot !== 'auto') {
        ax.axisLabel.rotate = Number(rot);
        ax.axisLabel.hideOverlap = false;
        ax.axisLabel.interval = 0;
      } else if (which === 'x' && !o.inverse && o.data && o.data.length && ctx.area) {
        // авто: если подписи не помещаются горизонтально — наклоняем, чтобы показать все
        var f = ctx.fontSize + 'px ' + ctx.font;
        var per = ctx.area.width / o.data.length;
        var maxW = 0;
        o.data.forEach(function (d) { maxW = Math.max(maxW, VS.measureText(String(d), f)); });
        if (maxW <= per - 8) {
          ax.axisLabel.interval = 0; // всё помещается — показываем каждую подпись
        } else if (ctx.fontSize * 1.4 <= per) {
          ax.axisLabel.rotate = maxW * 0.5 < per ? 30 : 45;
          ax.axisLabel.interval = 0;
          ax.axisLabel.hideOverlap = false;
          ax.axisLabel.width = Math.min(160, ctx.area.height * 0.4);
          ax.axisLabel.overflow = 'truncate';
        }
      }
      if (o.labelFormatter) ax.axisLabel.formatter = o.labelFormatter;
    }
    if (o.inverse) ax.inverse = true;
    return ax;
  };

  // Подписи временной оси: на многолетних рядах — деления по годам, иначе «мес год»
  var MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  VS.timeAxis = function (ax, spanMs) {
    var years = (spanMs || 0) / (365.25 * 86400000);
    if (years > 3) ax.minInterval = 365.25 * 86400000;
    ax.axisLabel.formatter = function (v) {
      var d = new Date(v);
      if (years > 3) return String(d.getFullYear());
      if (years > 0.5) return d.getMonth() === 0 ? String(d.getFullYear()) : MONTHS_RU[d.getMonth()];
      return d.getDate() + ' ' + MONTHS_RU[d.getMonth()];
    };
    ax.axisLabel.hideOverlap = true;
    return ax;
  };

  // Прямоугольник области построения с учётом подписей осей (ECharts 6 outerBounds)
  VS.grid = function (ctx, extra) {
    var a = ctx.area;
    extra = extra || {};
    var box = {
      left: a.left + (extra.left || 0),
      right: a.right + (extra.right || 0),
      top: a.top + (extra.top || 0),
      bottom: a.bottom + (extra.bottom || 0),
    };
    return {
      left: box.left, right: box.right, top: box.top, bottom: box.bottom,
      outerBoundsMode: 'auto',
      outerBounds: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
      outerBoundsContain: 'all',
    };
  };

  VS.labelStyle = function (ctx, extra) {
    var o = { color: ctx.theme.text, fontSize: ctx.fontSize, fontFamily: ctx.font };
    for (var k in extra || {}) o[k] = extra[k];
    return o;
  };

  // Пустое состояние: подсказка в центре вместо графика
  VS.empty = function (ctx, msg) {
    return {
      title: [{
        text: msg || 'Нет данных для отображения',
        left: 'center',
        top: ctx.area ? ctx.area.cy - 10 : 'middle',
        textAlign: 'center',
        textStyle: { color: ctx.theme.muted, fontSize: 14, fontWeight: 'normal', fontFamily: ctx.font },
      }],
      legend: false,
      series: [],
    };
  };

  // HTML-строка подсказки: заголовок + строки «маркер · серия · значение»
  VS.tooltipHtml = function (ctx, title, rows) {
    var h = title !== undefined && title !== null && title !== '' ? '<div style="font-weight:600;margin-bottom:4px">' + escapeHtml(title) + '</div>' : '';
    return h + rows.map(function (r) {
      var dot = r.color ? '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + r.color + ';margin-right:7px"></span>' : '';
      return '<div style="display:flex;align-items:center;gap:16px;justify-content:space-between;line-height:1.6">' +
        '<span>' + dot + escapeHtml(r.name) + '</span><b style="font-variant-numeric:tabular-nums">' + escapeHtml(r.value) + '</b></div>';
    }).join('');
  };

  // Сумма/максимум/минимум с пропуском пустых значений
  VS.stats = function (arr) {
    var min = Infinity, max = -Infinity, sum = 0, n = 0;
    arr.forEach(function (v) {
      if (v === null || v === undefined || isNaN(v)) return;
      n++;
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    });
    return { min: n ? min : 0, max: n ? max : 0, sum: sum, count: n };
  };

  // ---------------------------------------------------------------- статистика и регрессии
  // Общие для шаблонов (ящик с усами, кросс-плот, корреляции, диагностика) — лежат в ядре,
  // чтобы попадать в автономный HTML вместе с любым шаблоном.
  function quantile(sorted, p) {
    if (!sorted.length) return null;
    var pos = (sorted.length - 1) * p;
    var lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function mean(a) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return a.length ? s / a.length : null;
  }
  function sd(a) {
    if (a.length < 2) return 0;
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }
  // Метод наименьших квадратов для y = c + k·x
  function linreg(xs, ys) {
    var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (var i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; syy += ys[i] * ys[i]; }
    var d = n * sxx - sx * sx;
    if (n < 2 || !d) return null;
    var k = (n * sxy - sx * sy) / d;
    var c = (sy - k * sx) / n;
    var dy = n * syy - sy * sy;
    return { k: k, c: c, r2: dy > 0 ? Math.pow(n * sxy - sx * sy, 2) / (d * dy) : 1, n: n };
  }
  // Решение системы линейных уравнений методом Гаусса с выбором главного элемента
  function solve(A, b) {
    var n = b.length, M = A.map(function (r, i) { return r.slice().concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c;
      for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-14) return null;
      var tmp = M[c]; M[c] = M[p]; M[p] = tmp;
      for (var r2 = c + 1; r2 < n; r2++) {
        var f = M[r2][c] / M[c][c];
        for (var k = c; k <= n; k++) M[r2][k] -= f * M[c][k];
      }
    }
    var x = new Array(n);
    for (var i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (var j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }
  // Полином степени deg: коэффициенты [a0, a1, …] для y = a0 + a1·x + a2·x² …
  function polyfit(xs, ys, deg) {
    var n = xs.length;
    if (n <= deg) return null;
    // центрирование и масштабирование x для устойчивости
    var m = mean(xs), sc = 0;
    xs.forEach(function (x) { sc = Math.max(sc, Math.abs(x - m)); });
    sc = sc || 1;
    var A = [], b = [];
    for (var r = 0; r <= deg; r++) {
      A.push([]);
      for (var c = 0; c <= deg; c++) {
        var s = 0;
        for (var i = 0; i < n; i++) s += Math.pow((xs[i] - m) / sc, r + c);
        A[r].push(s);
      }
      var t = 0;
      for (var i2 = 0; i2 < n; i2++) t += ys[i2] * Math.pow((xs[i2] - m) / sc, r);
      b.push(t);
    }
    var u = solve(A, b);
    if (!u) return null;
    // обратно к коэффициентам по исходному x: разложение (x − m)^k / sc^k
    var out = new Array(deg + 1).fill(0);
    for (var k = 0; k <= deg; k++) {
      var ck = u[k] / Math.pow(sc, k);
      for (var j = 0; j <= k; j++) out[j] += ck * binom(k, j) * Math.pow(-m, k - j);
    }
    return out;
  }
  function binom(n, k) {
    var r = 1;
    for (var i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  }
  // Подбор модели тренда. pts — [[x, y], …]. R² — в пространстве подбора (как в Excel).
  var MODELS = {
    linear: { name: 'Линейная', need: '' },
    exp: { name: 'Экспоненциальная', need: 'y' },
    power: { name: 'Степенная', need: 'xy' },
    log: { name: 'Логарифмическая', need: 'x' },
    poly2: { name: 'Полином 2-й степени', need: '' },
    poly3: { name: 'Полином 3-й степени', need: '' },
  };
  function fitModel(model, pts) {
    var need = (MODELS[model] || MODELS.linear).need;
    var p = pts.filter(function (q) {
      return isFinite(q[0]) && isFinite(q[1]) && (need.indexOf('x') < 0 || q[0] > 0) && (need.indexOf('y') < 0 || q[1] > 0);
    });
    if (p.length < 3) return null;
    var xs = p.map(function (q) { return q[0]; }), ys = p.map(function (q) { return q[1]; });
    var r, f, coef;
    if (model === 'exp') {
      r = linreg(xs, ys.map(Math.log));
      if (!r) return null;
      coef = { a: Math.exp(r.c), b: r.k };
      f = function (x) { return coef.a * Math.exp(coef.b * x); };
    } else if (model === 'power') {
      r = linreg(xs.map(Math.log), ys.map(Math.log));
      if (!r) return null;
      coef = { a: Math.exp(r.c), b: r.k };
      f = function (x) { return x > 0 ? coef.a * Math.pow(x, coef.b) : NaN; };
    } else if (model === 'log') {
      r = linreg(xs.map(Math.log), ys);
      if (!r) return null;
      coef = { a: r.c, b: r.k };
      f = function (x) { return x > 0 ? coef.a + coef.b * Math.log(x) : NaN; };
    } else if (model === 'poly2' || model === 'poly3') {
      var c = polyfit(xs, ys, model === 'poly2' ? 2 : 3);
      if (!c) return null;
      coef = { c: c };
      f = function (x) {
        var y = 0;
        for (var i = c.length - 1; i >= 0; i--) y = y * x + c[i];
        return y;
      };
      var my = mean(ys), sst = 0, sse = 0;
      for (var i = 0; i < xs.length; i++) { sst += (ys[i] - my) * (ys[i] - my); sse += (ys[i] - f(xs[i])) * (ys[i] - f(xs[i])); }
      r = { r2: sst > 0 ? 1 - sse / sst : 1 };
    } else {
      model = 'linear';
      r = linreg(xs, ys);
      if (!r) return null;
      coef = { a: r.c, b: r.k };
      f = function (x) { return coef.a + coef.b * x; };
    }
    return { model: model, f: f, coef: coef, r2: r.r2, n: p.length, xMin: Math.min.apply(null, xs), xMax: Math.max.apply(null, xs) };
  }
  // Число с заданным количеством значащих цифр: 0,0123 · 1,23·10⁻⁵ · 12 300
  var SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function formatSig(v, digits, comma) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    if (v === 0) return '0';
    var a = Math.abs(v), str;
    if (a >= 1e-3 && a < 1e7) {
      str = String(Number(v.toPrecision(digits || 4)));
      if (/e/.test(str)) str = String(Number(Number(str).toFixed(8)));
    } else {
      var e = v.toExponential((digits || 4) - 1).split('e');
      str = String(Number(e[0])) + '·10' + String(Number(e[1])).replace(/./g, function (ch) { return SUP[ch] || ch; });
    }
    if (comma !== false) str = str.replace('.', ',');
    return str.replace(/^-/, '−');
  }
  // Уравнение тренда текстом: y = 1,23·e^(0,45x)
  function equation(fit, comma, xName, yName) {
    var F = function (v) { return formatSig(v, 4, comma); };
    var sign = function (v) { return v < 0 ? ' − ' + F(-v) : ' + ' + F(v); };
    var x = xName || 'x', y = yName || 'y', c = fit.coef;
    switch (fit.model) {
      case 'exp': return y + ' = ' + F(c.a) + '·e^(' + F(c.b) + '·' + x + ')';
      case 'power': return y + ' = ' + F(c.a) + '·' + x + '^' + F(c.b);
      case 'log': return y + ' = ' + F(c.a) + sign(c.b) + '·ln(' + x + ')';
      case 'poly2':
      case 'poly3':
        var t = y + ' = ' + F(c.c[c.c.length - 1]) + '·' + x + (c.c.length - 1 === 3 ? '³' : '²');
        for (var i = c.c.length - 2; i >= 0; i--) t += sign(c.c[i]) + (i ? '·' + x + (i === 2 ? '²' : '') : '');
        return t;
      default: return y + ' = ' + F(c.b) + '·' + x + sign(c.a);
    }
  }
  // Ядерная оценка плотности (гауссово ядро, ширина окна по Сильвермену)
  function kde(values, steps, lo, hi) {
    var n = values.length;
    if (n < 2) return [];
    var s = sd(values);
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
    var h = 0.9 * Math.min(s, iqr / 1.34 || s) * Math.pow(n, -0.2) || (sorted[n - 1] - sorted[0]) / 10 || 1;
    if (lo === undefined) { lo = sorted[0]; hi = sorted[n - 1]; }
    var out = [];
    for (var k = 0; k <= steps; k++) {
      var x = lo + ((hi - lo) * k) / steps, d = 0;
      for (var i = 0; i < n; i++) {
        var u = (x - sorted[i]) / h;
        if (u > -5 && u < 5) d += Math.exp(-0.5 * u * u);
      }
      out.push([x, d / (n * h * Math.sqrt(2 * Math.PI))]);
    }
    return out;
  }
  // Ранги с усреднением одинаковых значений (для корреляции Спирмена)
  function ranks(a) {
    var idx = a.map(function (v, i) { return i; }).sort(function (i, j) { return a[i] - a[j]; });
    var r = new Array(a.length);
    for (var i = 0; i < idx.length;) {
      var j = i;
      while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++;
      for (var k = i; k <= j; k++) r[idx[k]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  }
  // Корреляция по парам непустых значений: { r, n }
  function correlation(xs, ys, method) {
    var a = [], b = [];
    for (var i = 0; i < xs.length; i++) {
      if (xs[i] === null || ys[i] === null || xs[i] === undefined || ys[i] === undefined || !isFinite(xs[i]) || !isFinite(ys[i])) continue;
      a.push(xs[i]);
      b.push(ys[i]);
    }
    if (a.length < 3) return { r: null, n: a.length };
    if (method === 'spearman') {
      a = ranks(a);
      b = ranks(b);
    }
    var ma = mean(a), mb = mean(b), sab = 0, saa = 0, sbb = 0;
    for (var k = 0; k < a.length; k++) {
      sab += (a[k] - ma) * (b[k] - mb);
      saa += (a[k] - ma) * (a[k] - ma);
      sbb += (b[k] - mb) * (b[k] - mb);
    }
    return { r: saa && sbb ? sab / Math.sqrt(saa * sbb) : null, n: a.length };
  }
  // Функция распределения стандартного нормального закона (Абрамовиц–Стиган 7.1.26)
  function normCdf(z) {
    var t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
    return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  }
  // Двусторонний p-уровень значимости коэффициента корреляции (преобразование Фишера)
  function corrPValue(r, n) {
    if (r === null || n < 4) return 1;
    if (Math.abs(r) >= 1) return 0;
    var z = Math.abs(0.5 * Math.log((1 + r) / (1 - r))) * Math.sqrt(n - 3);
    return 2 * (1 - normCdf(z));
  }
  VS.math = {
    quantile: quantile, mean: mean, sd: sd, linreg: linreg, solve: solve, polyfit: polyfit,
    models: MODELS, fit: fitModel, equation: equation, formatSig: formatSig,
    kde: kde, ranks: ranks, correlation: correlation, normCdf: normCdf, corrPValue: corrPValue,
  };
  VS.quantile = quantile;

  // Дерево из «плоской» таблицы: уровни иерархии — колонки, значение суммируется по листьям
  VS.buildTree = function (ctx, levelsKey, valueKey) {
    var levels = ctx.columnsOf(levelsKey);
    var val = ctx.column(valueKey);
    if (!levels.length) return null;
    var root = { name: '', children: [], _map: new Map(), value: 0 };
    ctx.rows.forEach(function (_, i) {
      var v = val ? val.num[i] : 1;
      if (v === null || v <= 0) return;
      var node = root;
      for (var l = 0; l < levels.length; l++) {
        var name = levels[l].raw[i];
        if (!name) break;
        if (!node._map) node._map = new Map();
        var child = node._map.get(name);
        if (!child) {
          child = { name: name, value: 0, children: [], _map: new Map() };
          if (l === levels.length - 1) child.rowIndex = i;
          node._map.set(name, child);
          node.children.push(child);
        }
        child.value += v;
        node = child;
      }
      root.value += v;
    });
    (function clean(n) {
      delete n._map;
      if (!n.children.length) delete n.children;
      else n.children.forEach(clean);
    })(root);
    return root.children ? root : null;
  };

  // Группировка строк по ключу (дате/периоду) с суммированием или усреднением колонок.
  // specs: { имя: { col: колонка из ctx.column(), how: 'sum'|'avg'|'last' } }
  // Ключи-даты сортируются по времени; возвращает { keys, dates, values: {имя: [...]}, rows: [[индексы строк]] }
  VS.aggregate = function (ctx, keyCol, specs) {
    var order = [];
    var groups = new Map();
    keyCol.raw.forEach(function (k, i) {
      if (k === '' || k === null || k === undefined) return;
      if (!groups.has(k)) {
        groups.set(k, []);
        order.push(k);
      }
      groups.get(k).push(i);
    });
    var dates = order.map(function (k) { return VS.parseDate(k); });
    var allDates = dates.length && dates.every(Boolean);
    if (allDates) {
      var idx = order.map(function (_, i) { return i; }).sort(function (a, b) { return dates[a] - dates[b]; });
      order = idx.map(function (i) { return order[i]; });
      dates = idx.map(function (i) { return dates[i]; });
    } else if (order.every(function (k) { return VS.parseNumber(k) !== null; })) {
      order.sort(function (a, b) { return VS.parseNumber(a) - VS.parseNumber(b); });
      dates = order.map(function () { return null; });
    }
    var values = {};
    Object.keys(specs).forEach(function (name) {
      var sp = specs[name];
      if (!sp || !sp.col) return;
      values[name] = order.map(function (k) {
        var list = groups.get(k);
        var sum = 0, n = 0, last = null;
        list.forEach(function (i) {
          var v = sp.col.num[i];
          if (v === null) return;
          sum += v;
          n++;
          last = v;
        });
        if (!n) return null;
        return sp.how === 'avg' ? sum / n : sp.how === 'last' ? last : sum;
      });
    });
    return { keys: order, dates: allDates ? dates : null, values: values, rows: order.map(function (k) { return groups.get(k); }) };
  };

  // Число дней в периоде по ключу даты (для пересчёта месячных объёмов в суточные дебиты)
  VS.periodDays = function (dates, i) {
    if (!dates || !dates[i]) return 1;
    if (dates[i + 1]) return Math.max(1, Math.round((dates[i + 1] - dates[i]) / 86400000));
    if (i > 0 && dates[i - 1]) return Math.max(1, Math.round((dates[i] - dates[i - 1]) / 86400000));
    return 30.4375;
  };

  // ---------------------------------------------------------------- статичная отрисовка (HTML-шаблоны → PNG/SVG)
  // Список примитивов, который умеет превращаться в SVG и рисоваться на canvas.
  VS.drawList = function (width) {
    var items = [];
    return {
      width: width,
      items: items,
      rect: function (x, y, w, h, fill, stroke, r) { items.push({ t: 'rect', x: x, y: y, w: w, h: h, fill: fill, stroke: stroke, r: r || 0 }); },
      line: function (x1, y1, x2, y2, color, width) { items.push({ t: 'line', x1: x1, y1: y1, x2: x2, y2: y2, color: color, width: width || 1 }); },
      text: function (x, y, text, o) { items.push({ t: 'text', x: x, y: y, text: String(text), font: o.font, size: o.size, weight: o.weight || 'normal', color: o.color, align: o.align || 'left' }); },
    };
  };
  VS.drawListToSvg = function (d, height, bg) {
    var esc = escapeHtml;
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + d.width + '" height="' + height + '" viewBox="0 0 ' + d.width + ' ' + height + '">'];
    out.push('<rect width="100%" height="100%" fill="' + esc(bg) + '"/>');
    d.items.forEach(function (it) {
      if (it.t === 'rect') out.push('<rect x="' + it.x + '" y="' + it.y + '" width="' + Math.max(0, it.w) + '" height="' + Math.max(0, it.h) + '"' + (it.r ? ' rx="' + it.r + '"' : '') + ' fill="' + esc(it.fill || 'none') + '"' + (it.stroke ? ' stroke="' + esc(it.stroke) + '"' : '') + '/>');
      else if (it.t === 'line') out.push('<line x1="' + it.x1 + '" y1="' + it.y1 + '" x2="' + it.x2 + '" y2="' + it.y2 + '" stroke="' + esc(it.color) + '" stroke-width="' + it.width + '"/>');
      else out.push('<text x="' + it.x + '" y="' + it.y + '" dominant-baseline="middle" text-anchor="' + (it.align === 'right' ? 'end' : it.align === 'center' ? 'middle' : 'start') + '" font-family="' + esc(it.font) + '" font-size="' + it.size + '" font-weight="' + it.weight + '" fill="' + esc(it.color) + '">' + esc(it.text) + '</text>');
    });
    out.push('</svg>');
    return out.join('');
  };
  VS.drawListToCanvas = function (d, height, bg, ratio, type) {
    var c = document.createElement('canvas');
    c.width = Math.round(d.width * ratio);
    c.height = Math.round(height * ratio);
    var g = c.getContext('2d');
    g.scale(ratio, ratio);
    g.fillStyle = bg;
    g.fillRect(0, 0, d.width, height);
    d.items.forEach(function (it) {
      if (it.t === 'rect') {
        g.beginPath();
        if (it.r && g.roundRect) g.roundRect(it.x, it.y, Math.max(0, it.w), Math.max(0, it.h), it.r);
        else g.rect(it.x, it.y, Math.max(0, it.w), Math.max(0, it.h));
        if (it.fill) { g.fillStyle = it.fill; g.fill(); }
        if (it.stroke) { g.strokeStyle = it.stroke; g.lineWidth = 1; g.stroke(); }
      } else if (it.t === 'line') {
        g.beginPath();
        g.moveTo(it.x1, it.y1);
        g.lineTo(it.x2, it.y2);
        g.strokeStyle = it.color;
        g.lineWidth = it.width;
        g.stroke();
      } else {
        g.font = it.weight + ' ' + it.size + 'px ' + it.font;
        g.fillStyle = it.color;
        g.textAlign = it.align;
        g.textBaseline = 'middle';
        g.fillText(it.text, it.x, it.y);
      }
    });
    return c.toDataURL(type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92);
  };

  // Заголовок/подзаголовок/примечание для статичной отрисовки HTML-шаблонов
  function staticHeader(ctx, d, y) {
    var s = ctx.s;
    var pad = Number(s['layout.padding']);
    if (isNaN(pad)) pad = 16;
    var maxW = d.width - pad * 2;
    var center = s['layout.align'] === 'center';
    function block(text, size, weight, color) {
      if (isEmpty(text)) return;
      var lh = Math.round(size * 1.28);
      VS.wrapText(text, weight + ' ' + size + 'px ' + ctx.font, maxW).forEach(function (line) {
        d.text(center ? d.width / 2 : pad, y + lh / 2, line, { font: ctx.font, size: size, weight: weight, color: color, align: center ? 'center' : 'left' });
        y += lh;
      });
    }
    block(s.title, Number(s['layout.titleSize']) || 22, 'bold', ctx.theme.text);
    if (!isEmpty(s.title)) y += 4;
    block(s.subtitle, Number(s['layout.subtitleSize']) || 15, 'normal', ctx.theme.muted);
    if (ctx.filterValue !== null && ctx.filterValue !== VS.ALL) {
      y += 8;
      block(String(ctx.filterValue), ctx.fontSize + 2, 'bold', ctx.theme.text);
    }
    return y > pad ? y + 14 : pad;
  }
  function staticFooter(ctx, d, y) {
    var s = ctx.s;
    if (isEmpty(s.footer)) return y;
    var pad = Number(s['layout.padding']);
    if (isNaN(pad)) pad = 16;
    var size = Math.max(10, ctx.fontSize - 1);
    var lh = Math.round(size * 1.35);
    var center = s['layout.align'] === 'center';
    y += 10;
    VS.wrapText(s.footer, size + 'px ' + ctx.font, d.width - pad * 2).forEach(function (line) {
      d.text(center ? d.width / 2 : pad, y + lh / 2, line, { font: ctx.font, size: size, color: ctx.theme.muted, align: center ? 'center' : 'left' });
      y += lh;
    });
    return y;
  }

  // Элемент управления фильтром (список или кнопки) — общий для графиков и HTML-шаблонов
  function buildFilterControl(values, current, s, onChange) {
    var opts = (s['filter.all'] ? [[VS.ALL, s['filter.allLabel'] || 'Все']] : []).concat(values.map(function (v) { return [v, v]; }));
    if (s['filter.control'] === 'buttons') {
      var wrap = document.createElement('div');
      wrap.className = 'vs-buttons';
      opts.forEach(function (o) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = o[1];
        if (o[0] === current) b.className = 'active';
        b.onclick = function () { onChange(o[0]); };
        wrap.appendChild(b);
      });
      return wrap;
    }
    var sel = document.createElement('select');
    opts.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0];
      op.textContent = o[1];
      if (o[0] === current) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () { onChange(sel.value); };
    return sel;
  }

  // ===================================================================== подсказки
  function applyTemplate(tplStr, ctx, p) {
    var data = p.data || {};
    var row = data.rowIndex !== undefined ? ctx.rows[data.rowIndex] : null;
    var val = Array.isArray(p.value) ? (data.displayValue !== undefined ? data.displayValue : p.value[p.value.length - 1]) : p.value;
    if (data.rawValue !== undefined) val = data.rawValue;
    var map = {
      name: escapeHtml(p.name),
      series: escapeHtml(p.seriesName),
      value: escapeHtml(typeof val === 'number' ? ctx.fmt(val) : val),
      percent: p.percent !== undefined ? ctx.fmt(p.percent, { noAffix: true, noCompact: true, decimals: 1 }) + '%' : '',
    };
    return tplStr
      .replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, name) {
        if (!row) return '';
        var col = ctx.columns.find(function (c) { return c.name === name || c.letter === name; });
        if (!col) return '';
        var v = row[col.index];
        return escapeHtml(col.type === 'number' ? ctx.fmt(VS.parseNumber(v)) : v);
      })
      .replace(/\{(name|series|value|percent)\}/g, function (_, k) { return map[k]; });
  }

  function tooltipBase(ctx, tplOpt) {
    var s = ctx.s;
    if (!s['tooltip.show']) return { show: false };
    var t = ctx.theme;
    var tip = {
      show: true,
      trigger: 'item',
      confine: true,
      backgroundColor: t.isDark ? '#2a2a28' : '#ffffff',
      borderColor: t.isDark ? '#444' : '#e3e3e0',
      borderWidth: 1,
      padding: [8, 12],
      extraCssText: 'box-shadow:0 4px 18px rgba(0,0,0,.12);border-radius:8px;',
      textStyle: { color: t.text, fontFamily: ctx.font, fontSize: ctx.fontSize + 1 },
      valueFormatter: function (v) { return typeof v === 'number' ? ctx.fmt(v) : v; },
    };
    for (var k in tplOpt || {}) tip[k] = tplOpt[k];
    var custom = s['tooltip.template'];
    if (!isEmpty(custom)) {
      tip.formatter = function (params) {
        var list = Array.isArray(params) ? params : [params];
        return list.map(function (p) { return applyTemplate(custom, ctx, p); }).join('<br>');
      };
    }
    return tip;
  }

  // ===================================================================== сборка опций
  VS.buildOption = function (project, opts) {
    opts = opts || {};
    var tpl = VS.templates[project.template];
    if (!tpl) throw new Error('Шаблон «' + project.template + '» не найден');
    var ctx = VS.createContext(project, opts);
    if (tpl.html) return { option: null, html: true, ctx: ctx, layout: null, frames: null, warnings: ctx.warnings };
    var s = ctx.s;
    var hasFilter = ctx.filterValue !== null;
    var frames = tpl.frames ? tpl.frames(ctx) : null;
    if (frames && frames.length) {
      ctx.frames = frames;
      ctx.frame = clamp(opts.frame === undefined ? 0 : opts.frame, 0, frames.length - 1);
    }
    var L = headerLayout(ctx, {
      filter: hasFilter,
      filterHeight: s['filter.control'] === 'buttons' ? 44 : 40,
      player: frames && frames.length > 1,
    });
    L.left = L.pad;
    L.right = L.pad;

    // Шаблон может заранее сообщить имена для легенды (series names)
    var legendNames = tpl.legendNames ? tpl.legendNames(ctx) : null;
    var legend = tpl.legend === false ? null : legendLayout(ctx, L, legendNames, tpl.legendKind);

    ctx.area = {
      top: L.top,
      bottom: L.bottom,
      left: L.left,
      right: L.right,
      width: Math.max(10, ctx.width - L.left - L.right),
      height: Math.max(10, ctx.height - L.top - L.bottom),
    };
    ctx.area.cx = L.left + ctx.area.width / 2;
    ctx.area.cy = L.top + ctx.area.height / 2;

    var anim = s['animation.enabled'] && !ctx.forExport;
    var option = {
      backgroundColor: ctx.theme.background,
      textStyle: { fontFamily: ctx.font, color: ctx.theme.text, fontSize: ctx.fontSize },
      color: ctx.palette,
      animation: anim,
      animationDuration: Number(s['animation.duration']) || 800,
      animationDurationUpdate: Math.min(Number(s['animation.duration']) || 800, 900),
      animationEasing: s['animation.easing'] || 'cubicOut',
      animationEasingUpdate: 'cubicInOut',
      title: L.titles,
      aria: { enabled: true, decal: { show: false } },
    };
    if (legend) option.legend = legend;
    option.tooltip = tpl.common.indexOf('tooltip') >= 0 ? tooltipBase(ctx, tpl.tooltip ? tpl.tooltip(ctx) : null) : { confine: true };

    var built = tpl.build(ctx) || {};
    for (var k in built) {
      if (!hasOwn.call(built, k)) continue;
      if (k === 'legend') {
        if (built.legend === false) delete option.legend;
        else if (option.legend) Object.assign(option.legend, built.legend);
        else option.legend = built.legend;
      } else if (k === 'tooltip') {
        Object.assign(option.tooltip, built.tooltip);
      } else if (k === 'title') {
        option.title = option.title.concat(built.title);
      } else if (k === 'animation' && built.animation === false) {
        option.animation = false;
      } else {
        option[k] = built[k];
      }
    }
    if (!option.title.length) delete option.title;
    delete option.__notMerge;
    return { option: option, ctx: ctx, layout: L, frames: frames, notMerge: built.__notMerge, warnings: ctx.warnings };
  };

  // ===================================================================== контроллер визуализации
  // VS.render(container, project, {width?, height?, renderer?, interactive?})
  VS.render = function (container, project, opts) {
    opts = opts || {};
    var echarts = global.echarts;
    container.innerHTML = '';
    container.classList.add('vs-viz');
    var root = document.createElement('div');
    root.className = 'vs-root';
    root.style.position = 'relative';
    root.style.width = '100%';
    root.style.height = '100%';
    var chartEl = document.createElement('div');
    chartEl.className = 'vs-chart';
    chartEl.style.position = 'absolute';
    chartEl.style.inset = '0';
    var controlsEl = document.createElement('div');
    controlsEl.className = 'vs-controls';
    var playerEl = document.createElement('div');
    playerEl.className = 'vs-player';
    var htmlEl = document.createElement('div');
    htmlEl.className = 'vs-html';
    htmlEl.style.display = 'none';
    root.appendChild(htmlEl);
    root.appendChild(chartEl);
    root.appendChild(controlsEl);
    root.appendChild(playerEl);
    container.appendChild(root);
    injectStyles();

    var state = { project: project, filterValue: undefined, frame: 0, playing: false, timer: null, chart: null, last: null, error: null, htmlState: {} };
    var chart = echarts.init(chartEl, null, { renderer: opts.renderer || 'canvas', locale: echarts.registerLocale && global.__VS_LOCALE_RU ? 'RU' : undefined });
    state.chart = chart;

    function size() {
      return { width: chartEl.clientWidth || container.clientWidth || 800, height: chartEl.clientHeight || container.clientHeight || 500 };
    }

    function showError(msg) {
      chart.clear();
      controlsEl.innerHTML = '';
      playerEl.innerHTML = '';
      var t = document.createElement('div');
      t.className = 'vs-error';
      t.textContent = msg;
      controlsEl.appendChild(t);
      controlsEl.style.top = '40%';
    }

    var drawSeq = 0;
    function draw(full) {
      var seq = ++drawSeq;
      var pending = VS.prepare(state.project);
      if (pending) {
        pending.then(function () { if (seq === drawSeq) drawNow(full); }, function (e) {
          if (seq === drawSeq) showError(e.message);
        });
        return;
      }
      drawNow(full);
    }
    function drawNow(full) {
      var sz = size();
      var res;
      var tpl = VS.templates[state.project.template];
      if (tpl && tpl.html) return drawHtml(tpl, sz);
      htmlEl.style.display = 'none';
      htmlEl.innerHTML = '';
      chartEl.style.visibility = '';
      try {
        res = VS.buildOption(state.project, { width: sz.width, height: sz.height, filterValue: state.filterValue, frame: state.frame });
        if (res.frames) state.frame = res.ctx.frame;
        chart.setOption(res.option, { notMerge: full !== false || res.notMerge, lazyUpdate: false });
      } catch (e) {
        console.error(e);
        state.error = e;
        state.last = null;
        showError('Не удалось построить график: ' + e.message);
        if (opts.onRender) opts.onRender(null, e);
        return;
      }
      state.error = null;
      state.last = res;
      renderControls(res);
      if (opts.onRender) opts.onRender(res);
    }

    // HTML-шаблоны (таблица): заголовок, фильтр, тело, примечание — обычной вёрсткой
    function drawHtml(tpl, sz) {
      chart.clear();
      chartEl.style.visibility = 'hidden';
      controlsEl.style.display = 'none';
      controlsEl.dataset.key = '';
      playerEl.style.display = 'none';
      var ctx;
      try {
        ctx = VS.createContext(state.project, { width: sz.width, height: sz.height, filterValue: state.filterValue });
      } catch (e) {
        showError('Не удалось построить: ' + e.message);
        return;
      }
      var s = ctx.s;
      var pad = Number(s['layout.padding']);
      if (isNaN(pad)) pad = 16;
      htmlEl.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;box-sizing:border-box;padding:' + pad + 'px;' +
        'background:' + ctx.theme.background + ';color:' + ctx.theme.text + ';font-family:' + ctx.font + ';font-size:' + ctx.fontSize + 'px;' +
        'text-align:' + (s['layout.align'] === 'center' ? 'center' : 'left');
      htmlEl.style.setProperty('--vs-text', ctx.theme.text);
      htmlEl.style.setProperty('--vs-bg', ctx.theme.background);
      htmlEl.style.setProperty('--vs-line', ctx.theme.grid);
      htmlEl.innerHTML = '';
      function add(cls, text, css) {
        var d = document.createElement('div');
        d.className = cls;
        if (text !== undefined) d.textContent = text;
        if (css) d.style.cssText = css;
        htmlEl.appendChild(d);
        return d;
      }
      if (!isEmpty(s.title)) add('vs-h-title', s.title, 'font-size:' + (Number(s['layout.titleSize']) || 22) + 'px;font-weight:bold;line-height:1.28;margin-bottom:4px;flex:none');
      if (!isEmpty(s.subtitle)) add('vs-h-sub', s.subtitle, 'font-size:' + (Number(s['layout.subtitleSize']) || 15) + 'px;color:' + ctx.theme.muted + ';line-height:1.3;white-space:pre-line;flex:none');
      var bar = add('vs-h-bar', undefined, 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0 10px;flex:none;justify-content:' + (s['layout.align'] === 'center' ? 'center' : 'flex-start'));
      if (ctx.filterValue !== null) bar.appendChild(buildFilterControl(VS.filterValues(state.project), ctx.filterValue, s, setFilter));
      var body = add('vs-h-body', undefined, 'flex:1;min-height:0;overflow:auto;text-align:left');
      if (!isEmpty(s.footer)) add('vs-h-foot', s.footer, 'font-size:' + Math.max(10, ctx.fontSize - 1) + 'px;color:' + ctx.theme.muted + ';margin-top:10px;white-space:pre-line;flex:none');
      try {
        tpl.renderHtml(body, ctx, { state: state.htmlState, bar: bar, root: htmlEl, rerender: function () { drawHtml(tpl, size()); } });
      } catch (e) {
        console.error(e);
        body.innerHTML = '';
        var t = document.createElement('div');
        t.className = 'vs-error';
        t.textContent = 'Не удалось построить: ' + e.message;
        body.appendChild(t);
        if (opts.onRender) opts.onRender(null, e);
        return;
      }
      if (!bar.firstChild) bar.style.display = 'none';
      htmlEl.style.display = 'flex';
      state.error = null;
      state.last = { html: true, ctx: ctx, frames: null, warnings: ctx.warnings };
      if (opts.onRender) opts.onRender(state.last);
    }

    function renderControls(res) {
      var L = res.layout;
      var ctx = res.ctx;
      var s = ctx.s;
      controlsEl.style.top = '';
      // --- фильтр
      if (ctx.filterValue !== null) {
        var values = VS.filterValues(state.project);
        var current = ctx.filterValue;
        var key = JSON.stringify([values, current, s['filter.control'], s['filter.all'], s['filter.allLabel'], ctx.font]);
        if (controlsEl.dataset.key !== key) {
          controlsEl.dataset.key = key;
          controlsEl.innerHTML = '';
          controlsEl.appendChild(buildFilterControl(values, current, s, setFilter));
        }
        controlsEl.style.display = '';
        controlsEl.style.top = L.controlsTop + 'px';
        controlsEl.style.left = L.pad + 'px';
        controlsEl.style.right = L.pad + 'px';
        controlsEl.style.justifyContent = L.align === 'center' ? 'center' : 'flex-start';
        controlsEl.style.fontFamily = ctx.font;
        controlsEl.style.setProperty('--vs-text', ctx.theme.text);
        controlsEl.style.setProperty('--vs-bg', ctx.theme.background);
        controlsEl.style.setProperty('--vs-line', ctx.theme.grid);
      } else {
        controlsEl.innerHTML = '';
        controlsEl.dataset.key = '';
        controlsEl.style.display = 'none';
      }
      // --- проигрыватель кадров
      if (res.frames && res.frames.length > 1) {
        if (!playerEl.firstChild) {
          playerEl.innerHTML = '<button type="button" class="vs-play" aria-label="Воспроизвести"></button><input type="range" min="0" step="1"><span class="vs-frame"></span>';
          playerEl.querySelector('.vs-play').onclick = function () { state.playing ? pause() : play(); };
          playerEl.querySelector('input').oninput = function (e) {
            pause();
            setFrame(Number(e.target.value));
          };
        }
        playerEl.style.display = '';
        playerEl.style.bottom = L.playerBottom + 'px';
        playerEl.style.left = L.pad + 'px';
        playerEl.style.right = L.pad + 'px';
        playerEl.style.fontFamily = ctx.font;
        playerEl.style.setProperty('--vs-text', ctx.theme.text);
        playerEl.style.setProperty('--vs-accent', ctx.palette[0]);
        playerEl.style.setProperty('--vs-bg', ctx.theme.background);
        var range = playerEl.querySelector('input');
        range.max = String(res.frames.length - 1);
        range.value = String(state.frame);
        playerEl.querySelector('.vs-frame').textContent = res.frames[state.frame];
        playerEl.querySelector('.vs-play').classList.toggle('playing', state.playing);
      } else {
        playerEl.innerHTML = '';
        playerEl.style.display = 'none';
      }
    }

    function setFilter(v) {
      state.filterValue = v;
      draw(true);
    }
    function setFrame(i) {
      state.frame = i;
      draw(false);
    }
    function frameDelay() {
      var ctx = state.last && state.last.ctx;
      return ctx ? Number(ctx.s['race.duration']) || 1000 : 1000;
    }
    function play() {
      var res = state.last;
      if (!res || !res.frames) return;
      if (state.frame >= res.frames.length - 1) {
        state.frame = 0;
        draw(true);
      }
      state.playing = true;
      renderControls(state.last);
      clearInterval(state.timer);
      state.timer = setInterval(function () {
        var n = state.last.frames.length;
        if (state.frame >= n - 1) {
          if (state.last.ctx.s['race.loop']) {
            state.frame = 0;
            draw(true);
          } else pause();
          return;
        }
        setFrame(state.frame + 1);
      }, frameDelay());
    }
    function pause() {
      state.playing = false;
      clearInterval(state.timer);
      if (state.last) renderControls(state.last);
    }

    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () {
      chart.resize();
      draw(true);
    }) : null;
    if (ro) ro.observe(chartEl);

    draw(true);
    if (state.last && state.last.frames && state.last.ctx.s['race.autoplay'] && opts.autoplay !== false) {
      setTimeout(play, 600);
    }

    return {
      chart: chart,
      get state() { return state; },
      update: function (p) {
        var templateChanged = p.template !== state.project.template;
        state.project = p;
        if (templateChanged) {
          state.frame = 0;
          state.htmlState = {};
          pause();
        }
        draw(true);
      },
      resize: function () {
        chart.resize();
        draw(true);
      },
      play: play,
      pause: pause,
      setFilter: setFilter,
      current: function () { return { filterValue: state.filterValue, frame: state.frame }; },
      dispose: function () {
        pause();
        if (ro) ro.disconnect();
        chart.dispose();
        container.innerHTML = '';
      },
    };
  };

  // Асинхронная подготовка (например, загрузка карты). Возвращает Promise или null, если всё готово.
  VS.prepare = function (project) {
    var tpl = VS.templates[project.template];
    if (!tpl || !tpl.prepare) return null;
    try {
      var p = tpl.prepare(project, VS.resolveSettings(tpl, project.settings));
      return p && typeof p.then === 'function' ? p : null;
    } catch (e) {
      return Promise.reject(e);
    }
  };

  // Статичный рендер для экспорта: PNG (dataURL) или SVG (строка)
  VS.renderStatic = function (project, o) {
    var echarts = global.echarts;
    var tpl = VS.templates[project.template];
    if (tpl && tpl.html) {
      // HTML-шаблон: собираем примитивы; высота — по содержимому (не меньше заданной, если указано o.fitHeight)
      var ctx = VS.createContext(project, { width: o.width, height: o.height, filterValue: o.filterValue, forExport: true });
      var d = VS.drawList(o.width);
      var pad = Number(ctx.s['layout.padding']);
      if (isNaN(pad)) pad = 16;
      var y = staticHeader(ctx, d, pad);
      y = tpl.drawStatic(ctx, d, { x: pad, y: y, width: o.width - pad * 2 });
      y = staticFooter(ctx, d, y) + pad;
      var h = o.clip ? Math.min(o.height, y) : Math.max(y, o.minHeight || 0);
      if (o.type === 'svg') return VS.drawListToSvg(d, h, ctx.theme.background);
      return VS.drawListToCanvas(d, h, ctx.theme.background, o.pixelRatio || 2, o.type);
    }
    var res = VS.buildOption(project, { width: o.width, height: o.height, filterValue: o.filterValue, frame: o.frame, forExport: true });
    res.option.animation = false;
    if (o.type === 'svg') {
      var c = echarts.init(null, null, { renderer: 'svg', ssr: true, width: o.width, height: o.height });
      c.setOption(res.option);
      var svg = c.renderToSVGString();
      c.dispose();
      return svg;
    }
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + o.width + 'px;height:' + o.height + 'px;';
    document.body.appendChild(el);
    var chart = echarts.init(el, null, { renderer: 'canvas', width: o.width, height: o.height, devicePixelRatio: o.pixelRatio || 2 });
    chart.setOption(res.option);
    var url = chart.getDataURL({ type: o.type === 'jpeg' ? 'jpeg' : 'png', pixelRatio: o.pixelRatio || 2, backgroundColor: res.option.backgroundColor });
    chart.dispose();
    el.remove();
    return url;
  };

  // ===================================================================== стили элементов управления
  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected || typeof document === 'undefined') return;
    stylesInjected = true;
    var css =
      '.vs-viz{position:relative;overflow:hidden}' +
      '.vs-controls{position:absolute;display:flex;z-index:2;gap:8px;flex-wrap:wrap}' +
      '.vs-controls select{font:inherit;font-size:14px;color:var(--vs-text);background:var(--vs-bg);border:1px solid var(--vs-line);border-radius:6px;padding:6px 30px 6px 10px;max-width:100%;appearance:none;-webkit-appearance:none;' +
      'background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 15px) 52%,calc(100% - 10px) 52%;background-size:5px 5px;background-repeat:no-repeat;cursor:pointer}' +
      '.vs-buttons{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:4px;max-width:100%;scrollbar-width:thin}' +
      '.vs-buttons button{font:inherit;font-size:13px;white-space:nowrap;color:var(--vs-text);background:transparent;border:1px solid var(--vs-line);border-radius:6px;padding:6px 12px;cursor:pointer}' +
      '.vs-buttons button.active{background:var(--vs-text);color:var(--vs-bg);border-color:var(--vs-text)}' +
      '.vs-player{position:absolute;display:flex;align-items:center;gap:12px;height:36px;z-index:2;color:var(--vs-text)}' +
      '.vs-player input{flex:1;accent-color:var(--vs-accent)}' +
      '.vs-player .vs-frame{font-size:13px;font-weight:600;min-width:48px;text-align:right;font-variant-numeric:tabular-nums}' +
      '.vs-play{width:34px;height:34px;border-radius:50%;border:none;background:var(--vs-text);cursor:pointer;position:relative;flex:none}' +
      '.vs-play::before{content:"";position:absolute;left:13px;top:10px;border-left:11px solid var(--vs-bg,#fff);border-top:7px solid transparent;border-bottom:7px solid transparent}' +
      '.vs-play.playing::before{left:11px;top:11px;width:4px;height:12px;border:none;background:var(--vs-bg,#fff);box-shadow:8px 0 0 var(--vs-bg,#fff)}' +
      '.vs-error{width:100%;text-align:center;color:#b42318;font:14px/1.4 system-ui,sans-serif;padding:0 24px}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }
})(typeof window !== 'undefined' ? window : globalThis);

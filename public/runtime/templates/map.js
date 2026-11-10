(function (VS) {
  'use strict';

  // ------------------------------------------------------------------ источники карт
  // Встроенная карта мира + пользовательские GeoJSON (загружаются в редакторе, хранятся на сервере).
  VS.mapData = VS.mapData || {}; // key -> GeoJSON (в экспорте HTML сюда встраиваются данные)
  VS.mapSources = VS.mapSources || {
    world: { name: 'Мир (страны)', url: '/maps/world.json', nameProp: 'name_ru' },
  };
  var registered = {};
  var loading = {};

  function sourceKey(s) {
    return s['map.source'] || 'world';
  }
  function fetchSource(key) {
    if (VS.mapData[key]) return Promise.resolve(VS.mapData[key]);
    if (loading[key]) return loading[key];
    var url;
    if (VS.mapSources[key]) url = VS.mapSources[key].url;
    else if (key.indexOf('custom:') === 0) url = '/api/maps/' + encodeURIComponent(key.slice(7));
    else return Promise.reject(new Error('Неизвестная карта: ' + key));
    loading[key] = fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('Не удалось загрузить карту (' + r.status + ')');
        return r.json();
      })
      .then(function (j) {
        var geo = j.type === 'FeatureCollection' ? j : j.geojson;
        VS.mapData[key] = geo;
        delete loading[key];
        return geo;
      }, function (e) {
        delete loading[key];
        throw e;
      });
    return loading[key];
  }

  function norm(v) {
    return String(v == null ? '' : v).toLowerCase().replace(/ё/g, 'е').replace(/[«»"'().,–—-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Регистрирует карту в ECharts с выбранным свойством-названием; строит индекс для сопоставления
  function registerKey(s) {
    var key = sourceKey(s);
    var nameProp = s['map.nameProp'] || (VS.mapSources[key] && VS.mapSources[key].nameProp) || 'name';
    var hideAnt = key === 'world' && s['map.antarctica'] === false;
    return key + '|' + nameProp + (hideAnt ? '|noata' : '');
  }
  function ensureRegistered(s) {
    var rk = registerKey(s);
    if (registered[rk]) return registered[rk];
    var key = sourceKey(s);
    var geo = VS.mapData[key];
    if (!geo) return null;
    var parts = rk.split('|');
    var nameProp = parts[1];
    var hideAnt = parts[2] === 'noata';
    var index = new Map();
    var names = [];
    var features = [];
    geo.features.forEach(function (f, i) {
      var p = f.properties || {};
      if (hideAnt && (p.iso3 === 'ATA' || p.name === 'Antarctica')) return;
      var name = p[nameProp] != null && p[nameProp] !== '' ? String(p[nameProp]) : p.name != null ? String(p.name) : 'Регион ' + (i + 1);
      var props = {};
      for (var k in p) props[k] = p[k];
      props.__vsname = name;
      features.push({ type: 'Feature', properties: props, geometry: f.geometry });
      names.push(name);
      for (var k2 in p) {
        var v = p[k2];
        if (typeof v !== 'string' && typeof v !== 'number') continue;
        // несколько синонимов в одном свойстве разделяются «;»
        String(v).split(';').forEach(function (part) {
          var n = norm(part);
          if (n && !index.has(n)) index.set(n, name);
        });
      }
    });
    global().echarts.registerMap(rk, { type: 'FeatureCollection', features: features });
    // границы геометрии — чтобы вписать карту без искажения пропорций
    var bbox = [Infinity, Infinity, -Infinity, -Infinity];
    (function walk(c) {
      if (typeof c[0] === 'number') {
        if (c[0] < bbox[0]) bbox[0] = c[0];
        if (c[1] < bbox[1]) bbox[1] = c[1];
        if (c[0] > bbox[2]) bbox[2] = c[0];
        if (c[1] > bbox[3]) bbox[3] = c[1];
      } else c.forEach(walk);
    })(features.map(function (f) { return f.geometry ? f.geometry.coordinates : []; }).filter(function (c) { return c.length; }));
    registered[rk] = { name: rk, index: index, names: names, normNames: names.map(norm), bbox: bbox };
    return registered[rk];
  }
  function global() {
    return typeof window !== 'undefined' ? window : globalThis;
  }

  function matchRegion(reg, value) {
    var n = norm(value);
    if (!n) return null;
    if (reg.index.has(n)) return reg.index.get(n);
    // частичное совпадение: «Татарстан» ↔ «Республика Татарстан»
    var hits = [];
    for (var i = 0; i < reg.normNames.length && hits.length < 2; i++) {
      var m = reg.normNames[i];
      if (n.length >= 4 && (m.indexOf(n) >= 0 || n.indexOf(m) >= 0)) hits.push(reg.names[i]);
    }
    return hits.length === 1 ? hits[0] : null;
  }

  var MERCATOR = {
    project: function (p) {
      var lat = Math.max(-85, Math.min(85, p[1]));
      return [p[0], (-Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI];
    },
    unproject: function (p) {
      return [p[0], ((2 * Math.atan(Math.exp((-p[1] * Math.PI) / 180)) - Math.PI / 2) * 180) / Math.PI];
    },
  };

  VS.registerTemplate({
    id: 'map',
    order: 45,
    name: 'Карта',
    category: 'География',
    description: 'Раскраска регионов по значению (хороплет) и/или точки по координатам. Свои карты — в формате GeoJSON.',
    icon: '<svg viewBox="0 0 48 36"><path d="M6 10 L14 6 L20 9 L26 5 L34 8 L42 6 L42 26 L34 30 L26 27 L20 31 L14 27 L6 30 Z" fill="var(--c1)" opacity=".25"/><path d="M14 6 L20 9 L20 31 L14 27 Z" fill="var(--c1)" opacity=".75"/><path d="M26 5 L34 8 L34 30 L26 27 Z" fill="var(--c1)" opacity=".5"/><circle cx="38" cy="15" r="3" fill="var(--c2)"/></svg>',
    variants: [
      { name: 'Карта по регионам', settings: {} },
      {
        name: 'Карта с точками', settings: { 'map.labels': 'none' },
        icon: '<svg viewBox="0 0 48 36"><path d="M6 10 L14 6 L20 9 L26 5 L34 8 L42 6 L42 26 L34 30 L26 27 L20 31 L14 27 L6 30 Z" fill="currentColor" opacity=".12"/><circle cx="14" cy="15" r="4" fill="var(--c2)" opacity=".85"/><circle cx="28" cy="20" r="6" fill="var(--c2)" opacity=".85"/><circle cx="36" cy="12" r="2.5" fill="var(--c2)" opacity=".85"/></svg>',
        sampleData: [
          ['Город', 'Широта', 'Долгота', 'Население, млн'],
          ['Москва', '55,76', '37,62', '13,1'], ['Стамбул', '41,01', '28,98', '15,7'], ['Лондон', '51,51', '-0,13', '9,0'],
          ['Нью-Йорк', '40,71', '-74,01', '8,3'], ['Токио', '35,68', '139,69', '14,0'], ['Дели', '28,61', '77,21', '32,9'],
          ['Сан-Паулу', '-23,55', '-46,63', '12,3'], ['Лагос', '6,52', '3,38', '15,4'], ['Сидней', '-33,87', '151,21', '5,3'],
          ['Ташкент', '41,30', '69,24', '3,0'], ['Каир', '30,04', '31,24', '10,2'], ['Мехико', '19,43', '-99,13', '9,2'],
        ],
        sampleBindings: { name: 0, lat: 1, lon: 2, size: 3 },
        sampleSettings: { title: 'Крупные города мира', subtitle: 'Население в административных границах, млн', footer: 'Источник: демонстрационные данные' },
      },
    ],
    bindings: [
      { key: 'region', name: 'Регион', dataType: 'text', optional: true, description: 'Название или код (ISO) региона/страны' },
      { key: 'value', name: 'Значение для цвета', dataType: 'any', optional: true, description: 'Число — цветовая шкала, текст — категории' },
      { key: 'lat', name: 'Широта', dataType: 'number', optional: true, description: 'Для точек на карте' },
      { key: 'lon', name: 'Долгота', dataType: 'number', optional: true },
      { key: 'size', name: 'Размер точки', dataType: 'number', optional: true },
      { key: 'name', name: 'Название точки', dataType: 'text', optional: true },
      { key: 'filter', name: 'Фильтр', optional: true },
    ],
    autoBind: function (cols) {
      var find = function (re) { return cols.find(function (c) { return re.test(c.name); }); };
      var lat = find(/^(lat|latitude|широта)/i);
      var lon = find(/^(lon|lng|long|longitude|долгота)/i);
      var num = cols.filter(function (c) { return c.type === 'number' && c !== lat && c !== lon; });
      var txt = cols.find(function (c) { return c.type !== 'number'; });
      if (lat && lon) return { lat: lat.index, lon: lon.index, name: txt ? txt.index : undefined, size: num[0] ? num[0].index : undefined };
      return { region: txt ? txt.index : undefined, value: num[0] ? num[0].index : undefined };
    },
    common: ['layout', 'colors', 'tooltip', 'number', 'animation', 'appearance'],
    sections: [
      {
        id: 'map',
        title: 'Карта',
        items: [
          { key: 'map.source', label: 'Карта', type: 'map', default: 'world' },
          { key: 'map.nameProp', label: 'Свойство с названием региона', type: 'mapprop', default: '', help: 'Из GeoJSON; для сопоставления используются все свойства' },
          { key: 'map.antarctica', label: 'Показывать Антарктиду', type: 'toggle', default: false, show: function (s) { return (s['map.source'] || 'world') === 'world'; } },
          { key: 'map.projection', label: 'Проекция', type: 'radio', options: [['mercator', 'Меркатор'], ['flat', 'Плоская']], default: 'mercator' },
          { key: 'map.roam', label: 'Масштаб и перемещение мышью', type: 'toggle', default: true },
          { key: 'map.labels', label: 'Подписи регионов', type: 'radio', options: [['none', 'Нет'], ['data', 'С данными'], ['all', 'Все']], default: 'none' },
          { key: 'map.empty', label: 'Цвет регионов без данных', type: 'color', default: '#e8e7e3' },
          { key: 'map.border', label: 'Цвет границ', type: 'color', default: '#ffffff' },
          { type: 'heading', label: 'Цветовая шкала' },
          { key: 'map.scale', label: 'Шкала', type: 'scale', default: 'blues' },
          { key: 'map.mode', label: 'Тип шкалы', type: 'radio', options: [['continuous', 'Плавная'], ['pieces', 'Ступени']], default: 'continuous' },
          { key: 'map.pieces', label: 'Число ступеней', type: 'range', min: 3, max: 9, default: 5, show: function (s) { return s['map.mode'] === 'pieces'; } },
          { key: 'map.min', label: 'Минимум', type: 'text', default: '', placeholder: 'авто' },
          { key: 'map.max', label: 'Максимум', type: 'text', default: '', placeholder: 'авто' },
          { key: 'map.legend', label: 'Показывать шкалу', type: 'toggle', default: true },
          { type: 'heading', label: 'Точки' },
          { key: 'map.pointColor', label: 'Цвет точек', type: 'color', default: '#eb6834' },
          { key: 'map.pointSize', label: 'Размер точки', type: 'range', min: 3, max: 30, default: 8 },
          { key: 'map.pointMax', label: 'Максимальный размер', type: 'range', min: 10, max: 80, default: 40 },
          { key: 'map.pointLabels', label: 'Подписи точек', type: 'toggle', default: false },
        ],
      },
    ],
    sample: {
      data: [
        ['Страна', 'ВВП на душу населения, тыс. $'],
        ['Россия', '14,4'], ['Казахстан', '13,1'], ['Узбекистан', '2,5'], ['Китай', '12,6'], ['Индия', '2,5'],
        ['Германия', '52,7'], ['Франция', '44,4'], ['Великобритания', '48,9'], ['Италия', '38,4'], ['Испания', '33,5'],
        ['Польша', '22,1'], ['Турция', '13,1'], ['США', '80,4'], ['Канада', '53,4'], ['Мексика', '13,8'],
        ['Бразилия', '10,0'], ['Аргентина', '13,3'], ['Чили', '17,1'], ['Австралия', '64,7'], ['Япония', '33,8'],
        ['Корея', '33,1'], ['Индонезия', '4,9'], ['Египет', '3,5'], ['Нигерия', '1,6'], ['ЮАР', '6,0'],
        ['Саудовская Аравия', '32,6'], ['Иран', '4,5'], ['Пакистан', '1,4'], ['Норвегия', '87,9'], ['Швеция', '55,5'],
        ['Финляндия', '52,9'], ['Украина', '5,2'], ['Беларусь', '7,9'], ['Монголия', '5,9'], ['Кыргызстан', '2,0'],
      ],
      bindings: { region: 0, value: 1 },
      settings: { title: 'ВВП на душу населения', subtitle: 'тыс. долларов США, оценка', footer: 'Источник: демонстрационные данные (округлённые оценки)' },
    },
    legend: false,
    prepare: function (project, s) {
      var key = sourceKey(s);
      if (VS.mapData[key]) {
        ensureRegistered(s);
        return null;
      }
      return fetchSource(key).then(function () { ensureRegistered(s); });
    },
    build: function (ctx) {
      var s = ctx.s;
      var reg = ensureRegistered(s);
      if (!reg) return VS.empty(ctx, 'Карта загружается…');
      var R = ctx.column('region'), V = ctx.column('value');
      var LAT = ctx.column('lat'), LON = ctx.column('lon');
      var SZ = ctx.column('size'), NM = ctx.column('name');
      var a = ctx.area;
      var series = [];
      var visualMap = null;
      var legendH = 0;
      var categorical = V && V.type !== 'number';

      // --- регионы
      if (R) {
        var data = [];
        var missing = [];
        var used = new Map();
        R.raw.forEach(function (rv, i) {
          if (!rv) return;
          var name = matchRegion(reg, rv);
          if (!name) {
            missing.push(rv);
            return;
          }
          if (used.has(name)) return;
          used.set(name, true);
          var item = { name: name, rowIndex: i, label0: rv };
          if (V) {
            if (categorical) item.cat = V.raw[i];
            else item.value = V.num[i] === null ? NaN : V.num[i];
          } else item.value = 1;
          data.push(item);
        });
        if (missing.length) ctx.warnings.push('Не найдены на карте (' + missing.length + '): ' + missing.slice(0, 12).join(', ') + (missing.length > 12 ? '…' : ''));

        var showLegend = s['map.legend'] && V;
        legendH = showLegend ? (categorical ? 30 : 46) : 0;
        if (categorical) {
          var cats = VS.util.uniq(data.map(function (d) { return d.cat; }).filter(Boolean));
          data.forEach(function (d) { d.value = cats.indexOf(d.cat); });
          visualMap = {
            type: 'piecewise', show: !!showLegend, seriesIndex: 0, orient: 'horizontal',
            left: a.left, bottom: a.bottom, itemGap: 14, itemWidth: 12, itemHeight: 12, itemSymbol: 'circle',
            textStyle: { color: ctx.theme.text, fontFamily: ctx.font, fontSize: ctx.fontSize },
            pieces: cats.map(function (c, i) { return { value: i, label: c, color: ctx.color(c, i) }; }),
          };
        } else if (V) {
          var st = VS.stats(data.map(function (d) { return d.value; }).filter(function (v) { return !isNaN(v); }));
          var mn = VS.parseNumber(s['map.min']);
          var mx = VS.parseNumber(s['map.max']);
          if (mn === null) mn = st.min;
          if (mx === null) mx = st.max;
          if (mx === mn) mx = mn + 1;
          visualMap = {
            type: s['map.mode'] === 'pieces' ? 'piecewise' : 'continuous',
            show: !!showLegend,
            seriesIndex: 0,
            min: mn, max: mx,
            orient: 'horizontal',
            left: a.left, bottom: a.bottom,
            calculable: true,
            itemWidth: 12, itemHeight: Math.min(240, a.width * 0.45),
            inRange: { color: ctx.seqScale(s['map.scale']) },
            textStyle: { color: ctx.theme.muted, fontFamily: ctx.font, fontSize: ctx.fontSize - 1 },
            formatter: function (x, y) { return y !== undefined ? ctx.fmt(x) + ' – ' + ctx.fmt(y) : ctx.fmt(x); },
          };
          if (visualMap.type === 'piecewise') {
            visualMap.splitNumber = Number(s['map.pieces']) || 5;
            visualMap.itemWidth = 16;
            visualMap.itemHeight = 12;
          }
        } else {
          // без значений — просто подсвечиваем перечисленные регионы
          data.forEach(function (d) { d.itemStyle = { areaColor: ctx.palette[0] }; });
        }
        var lbl = s['map.labels'];
        if (lbl === 'data') data.forEach(function (d) { d.label = { show: true }; });
        series.push({
          type: 'map',
          geoIndex: 0,
          map: reg.name,
          nameProperty: '__vsname',
          data: data,
          tooltip: {
            formatter: function (p) {
              if (!p.data) return VS.util.escapeHtml(p.name);
              var rows = [];
              if (V) rows.push({ name: V.name, value: categorical ? p.data.cat : ctx.fmt(p.data.value), color: p.color });
              return VS.tooltipHtml(ctx, p.name, rows);
            },
          },
        });
      }

      // --- точки
      if (LAT && LON) {
        var szStats = SZ ? VS.stats(SZ.num) : null;
        var base = Number(s['map.pointSize']) || 8;
        var maxS = Number(s['map.pointMax']) || 40;
        var pts = [];
        LAT.num.forEach(function (la, i) {
          var lo = LON.num[i];
          if (la === null || lo === null) return;
          pts.push({
            name: NM ? NM.raw[i] : '',
            value: [lo, la, SZ ? SZ.num[i] : null],
            rowIndex: i,
            symbolSize: SZ && szStats.max ? Math.max(4, Math.sqrt(Math.max(0, SZ.num[i] || 0) / szStats.max) * maxS) : base,
          });
        });
        pts.sort(function (x, y) { return (y.value[2] || 0) - (x.value[2] || 0); });
        series.push({
          type: 'scatter',
          coordinateSystem: 'geo',
          geoIndex: 0,
          data: pts,
          itemStyle: { color: s['map.pointColor'] || ctx.palette[1], opacity: 0.85, borderColor: '#fff', borderWidth: 1 },
          label: VS.labelStyle(ctx, { show: !!s['map.pointLabels'], position: 'right', fontSize: ctx.fontSize - 1, formatter: function (p) { return p.name; } }),
          labelLayout: { hideOverlap: true },
          tooltip: {
            formatter: function (p) {
              var rows = [];
              if (SZ) rows.push({ name: SZ.name, value: ctx.fmt(p.value[2]), color: p.color });
              rows.push({ name: 'Координаты', value: ctx.fmt(p.value[1], { noAffix: true, noCompact: true, decimals: 2 }) + ', ' + ctx.fmt(p.value[0], { noAffix: true, noCompact: true, decimals: 2 }) });
              return VS.tooltipHtml(ctx, p.name, rows);
            },
          },
        });
      }
      if (!series.length) return VS.empty(ctx, 'Привяжите колонку «Регион» или колонки «Широта» и «Долгота»');

      // вписываем карту в область с сохранением пропорций
      var mercator = s['map.projection'] === 'mercator';
      var b = reg.bbox;
      var gw = Math.max(1e-6, b[2] - b[0]);
      var gh = mercator ? Math.abs(MERCATOR.project([0, b[1]])[1] - MERCATOR.project([0, b[3]])[1]) : (b[3] - b[1]);
      var aspect = mercator ? gw / Math.max(1e-6, gh) : (gw / Math.max(1e-6, gh)) * 0.82;
      var availW = a.width;
      var availH = Math.max(40, a.height - legendH);
      var size = aspect >= 1 ? Math.min(availW, availH * aspect) : Math.min(availH, availW / aspect);
      var geo = {
        map: reg.name,
        nameProperty: '__vsname',
        roam: !!s['map.roam'],
        scaleLimit: { min: 0.8, max: 12 },
        layoutCenter: [a.left + availW / 2, a.top + availH / 2],
        layoutSize: Math.max(40, size),
        itemStyle: { areaColor: s['map.empty'] || '#e8e7e3', borderColor: s['map.border'] || '#fff', borderWidth: 0.6 },
        emphasis: { itemStyle: { areaColor: VS.color.mix(s['map.empty'] || '#e8e7e3', ctx.theme.text, 0.15) }, label: { show: true, color: ctx.theme.text } },
        select: { disabled: true },
        label: { show: s['map.labels'] === 'all', color: ctx.theme.text, fontSize: ctx.fontSize - 2, fontFamily: ctx.font },
      };
      if (mercator) geo.projection = MERCATOR;
      else geo.aspectScale = 0.82;
      var out = { geo: geo, series: series, tooltip: { trigger: 'item' } };
      if (visualMap) out.visualMap = visualMap;
      return out;
    },
  });
})(window.VS);

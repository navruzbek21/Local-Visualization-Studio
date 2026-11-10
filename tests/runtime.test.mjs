// Тесты ядра рендеринга: разбор чисел/дат, форматирование, подготовка таблиц,
// и главное — каждый шаблон собирает option из своих демонстрационных данных.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadRuntime() {
  const registered = [];
  const ctx = {
    console,
    Map, Set, Date, Math, JSON, Number, String, Array, Object, Promise, isNaN, isFinite, parseInt, parseFloat,
    echarts: { registerMap: (name) => registered.push(name) },
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const run = (file) => vm.runInContext(readFileSync(file, 'utf8'), ctx, { filename: file });
  run(join(root, 'public/runtime/core.js'));
  for (const dir of ['public/runtime/templates', 'templates']) {
    for (const f of readdirSync(join(root, dir)).filter((x) => x.endsWith('.js')).sort()) run(join(root, dir, f));
  }
  return ctx.VS;
}

const VS = loadRuntime();
// значения из vm-контекста имеют «чужие» прототипы — сравниваем через JSON
const plain = (x) => JSON.parse(JSON.stringify(x));

test('parseNumber понимает русский и английский форматы', () => {
  const cases = [
    ['1 234,56', 1234.56], ['1 234 567', 1234567], ['1,234.5', 1234.5], ['1.234.567', 1234567],
    ['12,5%', 12.5], ['−3,2', -3.2], ['(150)', -150], ['₽ 1 000', 1000], ['2024', 2024], ['-0.5', -0.5],
    ['1e3', 1000], [42, 42], ['', null], ['abc', null], ['12abc', null], ['3а', null], [null, null],
    ['12 шт.', 12], ['100 руб.', 100], ['USD 250', 250], ['№ 7', 7],
  ];
  for (const [input, expected] of cases) assert.equal(VS.parseNumber(input), expected, `parseNumber(${JSON.stringify(input)})`);
});

test('parseDate: ISO, российский формат, год-месяц', () => {
  const d1 = VS.parseDate('2024-03-15');
  assert.deepEqual([d1.getFullYear(), d1.getMonth(), d1.getDate()], [2024, 2, 15]);
  const d2 = VS.parseDate('15.03.2024');
  assert.deepEqual([d2.getFullYear(), d2.getMonth(), d2.getDate()], [2024, 2, 15]);
  const d3 = VS.parseDate('2024-03');
  assert.deepEqual([d3.getFullYear(), d3.getMonth(), d3.getDate()], [2024, 2, 1]);
  assert.equal(VS.parseDate('31.13.2024'), null);
  assert.equal(VS.parseDate('Москва'), null);
});

test('inferType определяет числа, даты и текст', () => {
  assert.equal(VS.inferType(['1 000', '2,5', '', '7']), 'number');
  assert.equal(VS.inferType(['2024-01-01', '2024-02-01']), 'date');
  assert.equal(VS.inferType(['Москва', '12']), 'text');
  assert.equal(VS.inferType([]), 'text');
});

test('makeFormatter: разделители, префиксы, сокращения', () => {
  const ru = VS.makeFormatter({ 'number.decimals': 'auto', 'number.thousands': 'space', 'number.decimal': 'comma' });
  assert.equal(ru(1234567.891), '1 234 568');
  assert.equal(ru(12.345), '12,35');
  assert.equal(ru(-5), '−5');
  assert.equal(ru(0.000123), '0,000123');
  const money = VS.makeFormatter({ 'number.decimals': '2', 'number.thousands': 'comma', 'number.decimal': 'dot', 'number.prefix': '$' });
  assert.equal(money(1234.5), '$1,234.50');
  const compact = VS.makeFormatter({ 'number.decimals': 'auto', 'number.thousands': 'space', 'number.compact': 'ru', 'number.suffix': ' ₽' });
  assert.equal(compact(2500000), '2,5 млн ₽');
  assert.equal(compact(1500), '1,5 тыс. ₽');
  assert.equal(compact(''), '');
});

test('prepareTable: пустые строки отбрасываются, типы определяются', () => {
  const t = VS.prepareTable([['Город', 'Значение', ''], ['Москва', '10', ''], ['', '', ''], ['Казань', '5,5']]);
  assert.equal(t.rows.length, 2);
  assert.equal(t.columns.length, 3);
  assert.equal(t.columns[0].type, 'text');
  assert.equal(t.columns[1].type, 'number');
  assert.equal(t.columns[2].name, 'C');
});

test('colLetter: как в Excel', () => {
  assert.deepEqual(plain([0, 25, 26, 27, 701, 702].map(VS.colLetter)), ['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
});

test('autoBind привязывает текст к категориям, числа к значениям', () => {
  const t = VS.prepareTable([['Регион', '2023', '2024'], ['А', '1', '2']]);
  assert.deepEqual(plain(VS.autoBind(VS.templates.bar, t.columns)), { label: 0, values: [1, 2] });
  assert.deepEqual(plain(VS.autoBind(VS.templates.pie, t.columns)), { label: 0, value: 1 });
});

test('фильтр: значения и отбор строк', () => {
  const p = {
    template: 'bar',
    data: [['Город', 'Год', 'Значение'], ['Москва', '2024', '1'], ['Казань', '2024', '2'], ['Москва', '2025', '3']],
    bindings: { label: 1, values: [2], filter: 0 },
    settings: {},
  };
  assert.deepEqual(plain(VS.filterValues(p)), ['Москва', 'Казань']);
  const ctx = VS.createContext(p, { filterValue: 'Казань' });
  assert.equal(ctx.rows.length, 1);
  const all = VS.createContext({ ...p, settings: { 'filter.all': true } }, {});
  assert.equal(all.rows.length, 3);
});

test('каждый шаблон собирает option из своих демо-данных (все варианты)', () => {
  const ids = VS.sortedTemplates().map((t) => t.id);
  assert.ok(ids.length >= 31, 'ожидается не меньше 31 шаблона, есть ' + ids.length);
  for (const tpl of VS.sortedTemplates()) {
    tpl.variants.forEach((v, vi) => {
      const project = VS.newProject(tpl.id, vi);
      if (tpl.id === 'map') return; // карта требует загруженный GeoJSON — проверяется отдельно
      if (tpl.html) {
        // HTML-шаблоны (таблица) проверяем через статичную отрисовку в SVG
        const svg = VS.renderStatic(project, { type: 'svg', width: 900, height: 520 });
        assert.match(svg, /^<svg/, `${tpl.id}: нет SVG`);
        assert.ok(svg.includes('<text'), `${tpl.id}: пустая таблица`);
        return;
      }
      const res = VS.buildOption(project, { width: 900, height: 520 });
      assert.ok(res.option, `${tpl.id}/${v.name}: нет option`);
      assert.ok(Array.isArray(res.option.series) && res.option.series.length > 0, `${tpl.id}/${v.name}: нет серий`);
      const empty = (res.option.title || []).find((t) => /Привяжите|Нет данных|ошибка/i.test(t.text || ''));
      assert.ok(!empty, `${tpl.id}/${v.name}: пустое состояние «${empty && empty.text}»`);
      // для экспорта в JSON option должен сериализоваться (функции отбрасываются)
      assert.doesNotThrow(() => JSON.stringify(res.option));
    });
  }
});

test('шаблон карты: сопоставление регионов по русским названиям и кодам', () => {
  const world = JSON.parse(readFileSync(join(root, 'public/maps/world.json'), 'utf8'));
  VS.mapData.world = world;
  const p = {
    template: 'map',
    data: [['Страна', 'Значение'], ['Россия', '1'], ['США', '2'], ['DEU', '3'], ['Кыргызстан', '4'], ['Атлантида', '5']],
    bindings: { region: 0, value: 1 },
    settings: {},
  };
  VS.prepare(p);
  const res = VS.buildOption(p, { width: 900, height: 520 });
  const names = plain(res.option.series[0].data.map((d) => d.name)).sort();
  assert.deepEqual(names, ['Германия', 'Киргизия', 'Россия', 'Соединённые Штаты Америки'].sort());
  assert.ok(res.warnings.some((w) => w.includes('Атлантида')));
});

test('санкей: цикл в данных даёт понятное сообщение, а не падение', () => {
  const p = { template: 'sankey', data: [['A', 'B', 'V'], ['x', 'y', '1'], ['y', 'x', '1']], bindings: { source: 0, target: 1, value: 2 }, settings: {} };
  const res = VS.buildOption(p, { width: 800, height: 500 });
  assert.match(res.option.title.map((t) => t.text).join(' '), /цикл/);
});

test('гонка столбцов: кадры по колонкам значений', () => {
  const p = VS.newProject('race', 0);
  const res = VS.buildOption(p, { width: 900, height: 520, frame: 3 });
  assert.deepEqual(plain(res.frames), ['1970', '1980', '1990', '2000', '2010', '2020', '2025']);
  assert.equal(res.ctx.frame, 3);
});

test('Арпс: подбор восстанавливает параметры экспоненциальной, гармонической и гиперболической кривых', () => {
  const ts = Array.from({ length: 48 }, (_, i) => i * 30.44);
  const cases = [{ b: 0, qi: 500, D: 0.002 }, { b: 1, qi: 300, D: 0.004 }, { b: 0.4, qi: 800, D: 0.003 }];
  for (const m of cases) {
    const qs = ts.map((t) => VS.arps.rate(m, t));
    const f = VS.arps.fit(ts, qs, 'auto');
    assert.ok(Math.abs(f.b - m.b) < 0.051, `b: ожидалось ${m.b}, получено ${f.b}`);
    assert.ok(Math.abs(f.qi - m.qi) / m.qi < 0.02, `qi: ${f.qi}`);
    assert.ok(Math.abs(f.D - m.D) / m.D < 0.05, `D: ${f.D}`);
    assert.ok(f.r2 > 0.999);
  }
  // накопленная по формуле совпадает с численным интегралом
  const m = { b: 0.5, qi: 400, D: 0.002 };
  let num = 0;
  for (let t = 0; t < 3000; t += 0.5) num += VS.arps.rate(m, t + 0.25) * 0.5;
  assert.ok(Math.abs(VS.arps.cumulative(m, 3000) - num) / num < 1e-4);
});

test('характеристика вытеснения (Сазонов): предельная точка удовлетворяет условию по обводнённости', () => {
  const p = VS.newProject('displacement', 0);
  const res = VS.buildOption(p, { width: 900, height: 520 });
  const d = res.ctx.displacement;
  assert.ok(d && d.limit, 'нет предельной точки');
  // dQн/dQж = b/Qж = 1 − 0,98
  assert.ok(Math.abs(d.b / d.limit.x - 0.02) < 1e-9);
  assert.ok(d.limit.qo > d.current.qo);
});

test('профиль добычи: «Все» суммирует скважины по дате, обводнённость считается из сумм', () => {
  const p = {
    template: 'production',
    data: [['Скважина', 'Дата', 'Нефть', 'Вода'], ['A', '2024-01', '10', '10'], ['B', '2024-01', '30', '0'], ['A', '2024-02', '8', '12']],
    bindings: { filter: 0, date: 1, oil: 2, water: 3 },
    settings: { 'filter.all': true },
  };
  const res = VS.buildOption(p, { width: 900, height: 600, filterValue: VS.ALL });
  const oil = res.option.series.find((x) => x.name === 'Нефть');
  const wc = res.option.series.find((x) => x.name === 'Обводнённость');
  assert.equal(oil.data[0][1], 40);
  assert.equal(wc.data[0][1], 20);
  assert.equal(wc.data[1][1], 60);
});

test('VS.math: регрессии восстанавливают параметры моделей', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} ≠ ${b}`);
  const lin = VS.math.fit('linear', xs.map((x) => [x, 3 + 2 * x]));
  near(lin.coef.a, 3, 1e-9, 'linear a'); near(lin.coef.b, 2, 1e-9, 'linear b'); near(lin.r2, 1, 1e-12, 'linear r2');
  const ex = VS.math.fit('exp', xs.map((x) => [x, 0.5 * Math.exp(0.3 * x)]));
  near(ex.coef.a, 0.5, 1e-9, 'exp a'); near(ex.coef.b, 0.3, 1e-9, 'exp b');
  const pw = VS.math.fit('power', xs.map((x) => [x, 4 * Math.pow(x, 1.7)]));
  near(pw.coef.a, 4, 1e-9, 'power a'); near(pw.coef.b, 1.7, 1e-9, 'power b');
  const lg = VS.math.fit('log', xs.map((x) => [x, 1 + 5 * Math.log(x)]));
  near(lg.coef.a, 1, 1e-9, 'log a'); near(lg.coef.b, 5, 1e-9, 'log b');
  const p3 = VS.math.fit('poly3', xs.map((x) => [x + 100, 2 - (x + 100) + 0.5 * (x + 100) ** 2 - 0.01 * (x + 100) ** 3]));
  near(p3.f(105), 2 - 105 + 0.5 * 105 ** 2 - 0.01 * 105 ** 3, 1e-6, 'poly3 f');
  // модели с логарифмами пропускают неположительные значения
  assert.equal(VS.math.fit('exp', [[1, -1], [2, 0], [3, 5]]), null);
  assert.match(VS.math.equation(ex, true), /^y = 0,5·e\^\(0,3·x\)$/);
  assert.equal(VS.math.formatSig(0.000012345, 3, true), '1,23·10⁻⁵');
  assert.equal(VS.math.formatSig(-1234.5, 3, true), '−1230');
});

test('VS.math: корреляции Пирсона и Спирмена, значимость', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.equal(VS.math.correlation(x, x.map((v) => 3 * v + 1)).r, 1);
  assert.ok(Math.abs(VS.math.correlation(x, x.map((v) => -v)).r + 1) < 1e-12);
  // монотонная нелинейная связь: Спирмен = 1, Пирсон < 1
  const y = x.map((v) => Math.exp(v));
  assert.ok(Math.abs(VS.math.correlation(x, y, 'spearman').r - 1) < 1e-12);
  assert.ok(VS.math.correlation(x, y).r < 0.95);
  // пропуски исключаются попарно
  const c = VS.math.correlation([1, 2, null, 4, 5], [2, 4, 6, null, 10]);
  assert.equal(c.n, 3);
  assert.deepEqual(plain(VS.math.ranks([10, 20, 20, 30])), [1, 2.5, 2.5, 4]);
  assert.ok(VS.math.corrPValue(0.1, 20) > 0.05);
  assert.ok(VS.math.corrPValue(0.8, 20) < 0.001);
  assert.ok(Math.abs(VS.math.normCdf(1.96) - 0.975) < 1e-3);
});

test('ящик с усами: квартили, усы по Тьюки и выбросы', () => {
  const p = {
    template: 'boxplot',
    data: [['Группа', 'Значение'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 100].map((v) => ['A', String(v)])],
    bindings: { group: 0, values: [1] },
    settings: { 'box.points': 'outliers' },
  };
  const res = VS.buildOption(p, { width: 800, height: 500 });
  const box = res.option.series[0].data[0];
  const st = box.st;
  assert.equal(st.med, 5.5);
  assert.equal(st.q1, 3.25);
  assert.equal(st.q3, 7.75);
  assert.equal(st.hi, 9, 'верхний ус — до последнего значения внутри 1,5 IQR');
  assert.equal(st.lo, 1);
  const pts = res.option.series[1].data;
  assert.deepEqual(plain(pts.map((d) => d.value[1])), [100]);
  // на логарифмической шкале значения ≤ 0 пропускаются с предупреждением
  const lg = VS.buildOption({ ...p, data: [...p.data, ['A', '0']], settings: { 'yAxis.log': true } }, { width: 800, height: 500 });
  assert.ok(lg.warnings.some((w) => /≤ 0/.test(w)));
});

test('несколько осей Y: стороны, смещения, панели и автопривязка', () => {
  const p = VS.newProject('multiaxis', 0);
  const res = VS.buildOption(p, { width: 1000, height: 560 });
  const y = res.option.yAxis;
  assert.equal(y.length, 4);
  assert.deepEqual(plain(y.map((a) => a.position)), ['left', 'right', 'left', 'right']);
  assert.equal(y[0].offset, 0);
  assert.ok(y[2].offset > 30, 'третья ось смещена от первой');
  // ось 1 с двумя сериями не окрашивается в цвет одной из них
  assert.notEqual(y[0].axisLabel.color, res.option.series[0].color);
  const panels = VS.buildOption(VS.newProject('multiaxis', 1), { width: 1000, height: 700 });
  assert.equal(panels.option.grid.length, 4);
  assert.equal(new Set(panels.option.grid.map((g) => g.left)).size, 1, 'панели выровнены по левому краю');
  const t = VS.prepareTable([['Дата', 'Qн, м3/сут', 'Qж, м3/сут', 'Обводненность, %', 'Pзаб, атм', 'ГФ, м3/т', 'Скважина'], ['2024-01', '10', '20', '50', '100', '80', 'Скв. 1']]);
  const b = plain(VS.autoBind(VS.templates.multiaxis, t.columns));
  assert.equal(b.label, 0);
  assert.deepEqual(b.values, [1, 2]);
  assert.deepEqual(b.y2, [3]);
  assert.deepEqual(b.y3, [4]);
  assert.deepEqual(b.y4, [5]);
  assert.equal(b.filter, 6);
  // кириллица в начале названия: «Qн», «ГФ», «Дата» (граница слова \b в JS — только латиница)
  assert.equal(VS.findColumn(t.columns, VS.petroPatterns.oil).name, 'Qн, м3/сут');
  assert.equal(VS.findColumn(t.columns, VS.petroPatterns.liquid).name, 'Qж, м3/сут');
  // разделы настроек осей видны, только если к оси привязаны колонки
  const sec3 = VS.templates.multiaxis.sections.find((x) => x.id === 'ax3');
  assert.equal(sec3.show({}, { values: [1] }), false);
  assert.equal(sec3.show({}, { values: [1], y3: [2] }), true);
});

test('Парето: сортировка, накопленная доля, ABC и «Прочие»', () => {
  const p = {
    template: 'pareto',
    data: [['Причина', 'Потери'], ['B', '30'], ['A', '50'], ['C', '10'], ['A', '0'], ['D', '6'], ['E', '4']],
    bindings: { label: 0, value: 1 },
    settings: { 'pareto.abc': true, 'pareto.top': 3 },
  };
  const res = VS.buildOption(p, { width: 900, height: 500 });
  const bars = res.option.series[0].data;
  assert.deepEqual(plain(bars.map((d) => d.item.name)), ['A', 'B', 'C', 'Прочие']);
  // до «Прочих» накоплено 90 % < 95 % — они ещё в группе B
  assert.deepEqual(plain(bars.map((d) => d.item.cls)), ['A', 'A', 'B', 'B']);
  assert.equal(bars[3].value, 10);
  assert.deepEqual(plain(res.option.series[1].data), [50, 80, 90, 100]);
});

test('матрица корреляций: коэффициенты, незначимые связи и кластеризация', () => {
  const rows = [['a', 'b', 'c', 'd']];
  for (let i = 0; i < 30; i++) rows.push([i, 2 * i + (i % 3), Math.sin(i * 7.3), -i + (i % 5)].map(String));
  const p = { template: 'correlation', data: rows, bindings: { values: [0, 2, 1, 3] }, settings: { 'corr.order': 'cluster', 'corr.triangle': 'full' } };
  const res = VS.buildOption(p, { width: 900, height: 600 });
  const c = res.ctx.correlation;
  assert.ok(c.r[0][2] > 0.99);
  assert.ok(c.r[0][3] < -0.98);
  assert.ok(c.p[0][1] >= 0.05, 'синус не связан с остальными');
  // связанные a, b, d встают рядом, независимая c — с краю
  const ord = c.order;
  assert.ok(ord[0] === 1 || ord[3] === 1, 'порядок: ' + ord);
  assert.equal(res.option.series.length, 2);
  const splom = VS.buildOption({ ...p, settings: { 'corr.view': 'splom' } }, { width: 900, height: 600 });
  assert.equal(splom.option.grid.length, 10, '4 гистограммы + 6 диаграмм рассеяния');
});

test('диагностика по Чену: наклоны ВНФ и ВНФ′ для степенного закона', () => {
  // ВНФ = c·t^2 → наклон ВНФ = 2, наклон ВНФ′ = 1 (каналирование)
  const rows = [['Дата', 'Нефть', 'Вода']];
  for (let m = 0; m < 120; m++) {
    const d = new Date(Date.UTC(2010, m, 1));
    const t = (Date.UTC(2010, m + 1, 1) - Date.UTC(2010, 0, 1)) / 86400000;
    const wor = 1e-6 * t * t;
    rows.push([d.toISOString().slice(0, 7), '100', String(100 * wor)]);
  }
  const res = VS.buildOption({ template: 'chan', data: rows, bindings: { date: 0, oil: 1, water: 2 }, settings: {} }, { width: 900, height: 520 });
  const c = res.ctx.chan;
  assert.ok(Math.abs(c.slopeWor - 2) < 0.05, 'наклон ВНФ ' + c.slopeWor);
  assert.ok(Math.abs(c.slopeDer - 1) < 0.1, 'наклон ВНФ′ ' + c.slopeDer);
  assert.match(c.verdict, /растёт/);
});

test('график Холла: наклон равен репрессии, делённой на приёмистость', () => {
  const rows = [['Дата', 'Закачка', 'Давление', 'ГТМ']];
  for (let m = 0; m < 24; m++) rows.push([`20${20 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`, m < 12 ? '200' : '400', '100', m === 12 ? 'ОПЗ' : '']);
  const res = VS.buildOption({ template: 'hall', data: rows, bindings: { date: 0, inj: 1, pressure: 2, event: 3 }, settings: { 'hall.pres': '20' } }, { width: 900, height: 520 });
  const segs = res.ctx.hall.segments;
  assert.equal(segs.length, 2);
  assert.ok(Math.abs(segs[0].slope - 80 / 200) < 1e-9, 'наклон 1: ' + segs[0].slope);
  assert.ok(Math.abs(segs[1].slope - 80 / 400) < 1e-9, 'наклон 2: ' + segs[1].slope);
  assert.ok(Math.abs(segs[1].change + 50) < 1e-6);
});

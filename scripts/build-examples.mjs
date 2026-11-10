// Собирает примеры визуализаций в examples/*.json.
//
//   node scripts/build-examples.mjs [путь к «Volve production data.xlsx»] [путь к oil-production-by-country.csv]
//
// Источники реальных данных (скачиваются вручную на машине с интернетом):
//   • Equinor, месторождение Volve — «Volve production data.xlsx» (Equinor Open Data Licence;
//     например, копия в репозитории github.com/Nhiento/volve-production-analytics, data/raw/).
//   • Energy Institute — Statistical Review of World Energy, выгрузка Our World in Data:
//     https://ourworldindata.org/grapher/oil-production-by-country.csv?v=1&csvType=full&useColumnShortNames=true
// Без файлов собираются только примеры на демонстрационных данных (существующие файлы не удаляются).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'examples');
mkdirSync(outDir, { recursive: true });
const require = createRequire(import.meta.url);

// --- загрузка ядра и шаблонов (чтобы брать их демонстрационные данные)
const ctx = { console, Map, Set, Date, Math, JSON, Number, String, Array, Object, Promise, isNaN, isFinite };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
const run = (f) => vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
run(join(root, 'public/runtime/core.js'));
for (const dir of ['public/runtime/templates', 'templates']) {
  for (const f of readdirSync(join(root, dir)).filter((x) => x.endsWith('.js')).sort()) run(join(root, dir, f));
}
const VS = ctx.VS;
const plain = (x) => JSON.parse(JSON.stringify(x));

let order = 0;
function save(id, meta, project) {
  const doc = { id, order: ++order, ...meta, project: plain(project) };
  writeFileSync(join(outDir, id + '.json'), JSON.stringify(doc));
  console.log(`✓ ${id} — ${meta.title}`);
}
const fromSample = (tpl, variant, patch = {}) => {
  const p = VS.newProject(tpl, variant);
  p.settings = { ...p.settings, ...(patch.settings || {}) };
  if (patch.title) p.title = patch.title;
  if (patch.data) p.data = patch.data;
  if (patch.bindings) p.bindings = patch.bindings;
  return p;
};
const r1 = (v) => Math.round(v * 10) / 10;

// ================================================================= Volve (Equinor)
const volvePath = process.argv[2];
if (volvePath && existsSync(volvePath)) {
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(volvePath);
  const raw = XLSX.utils.sheet_to_json(wb.Sheets['Monthly Production Data'], { header: 1, raw: true }).slice(2).filter((r) => r[0] && r[2]);
  const num = (v) => (typeof v === 'number' ? v : Number(v) || 0);
  const rows = raw.map((r) => ({ well: String(r[0]), y: r[2], m: r[3], hrs: num(r[4]), oil: num(r[5]), gas: num(r[6]), water: num(r[7]), wi: num(r[9]) }))
    .sort((a, b) => a.well.localeCompare(b.well) || a.y - b.y || a.m - b.m);
  const key = (r) => `${r.y}-${String(r.m).padStart(2, '0')}`;
  const SRC = 'Источник: Equinor и партнёры по лицензии Volve, открытые данные (Equinor Open Data Licence). Объёмы — м³ в стандартных условиях.';
  const wells = [...new Set(rows.map((r) => r.well))];

  // 1. Профиль добычи по месторождению и скважинам (длинный формат + переключатель скважин)
  const long = [['Скважина', 'Дата', 'Нефть, м³', 'Вода, м³', 'Газ, м³', 'Закачка воды, м³', 'Часы работы']];
  rows.forEach((r) => long.push([r.well, key(r), r1(r.oil), r1(r.water), Math.round(r.gas), r1(r.wi), r1(r.hrs)]));
  save('volve-production', {
    title: 'Volve: профиль добычи месторождения и скважин',
    description: 'Реальные помесячные данные Equinor 2007–2016: нефть, вода, газ, закачка, обводнённость. Переключатель скважин, «Всё месторождение» — сумма.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: профиль добычи', template: 'production', data: long,
    bindings: { filter: 0, date: 1, oil: 2, water: 3, gas: 4, inj: 5 },
    settings: {
      title: 'Месторождение Volve: профиль добычи', subtitle: 'Среднесуточные дебиты по месяцам, обводнённость продукции',
      footer: SRC, 'prod.input': 'volume', 'prod.layout': 'panels', 'prod.cum': true, 'prod.cumUnit': 'тыс. м³',
      'filter.all': true, 'filter.allLabel': 'Всё месторождение', 'layout.aspect': '4:3',
    },
  });

  // 2. Анализ падения по скважинам
  const prodWells = wells.filter((w) => rows.filter((r) => r.well === w).reduce((a, r) => a + r.oil, 0) > 100000);
  const dcaData = [['Скважина', 'Дата', 'Добыча нефти, м³']];
  rows.filter((r) => prodWells.includes(r.well)).forEach((r) => dcaData.push([r.well, key(r), r1(r.oil)]));
  save('volve-dca', {
    title: 'Volve: анализ падения добычи (Арпс)',
    description: 'Аппроксимация кривой Арпса по помесячной добыче скважины 15/9-F-14 с 2013 г. и прогноз; переключатель — другие скважины.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: анализ падения добычи', template: 'dca', data: dcaData,
    bindings: { filter: 0, date: 1, rate: 2 },
    settings: {
      title: 'Анализ падения добычи нефти', subtitle: 'Месторождение Volve, аппроксимация кривой Арпса по фактической добыче',
      footer: SRC, 'dca.input': 'volume', 'dca.from': '2013-01', 'dca.years': 5, 'dca.qlim': '50', 'filter.default': '15/9-F-14',
    },
  });

  // 3. Характеристика вытеснения по месторождению
  const months = [...new Set(rows.map(key))].sort();
  const field = months.map((k) => {
    const list = rows.filter((r) => key(r) === k);
    return [k, r1(list.reduce((a, r) => a + r.oil, 0)), r1(list.reduce((a, r) => a + r.water, 0))];
  }).filter((r) => r[1] > 0);
  save('volve-displacement', {
    title: 'Volve: характеристика вытеснения (метод Сазонова)',
    description: 'Накопленная нефть от накопленной жидкости, прогноз извлекаемых запасов при обводнённости 98%.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: характеристика вытеснения', template: 'displacement', data: [['Месяц', 'Добыча нефти, м³', 'Добыча воды, м³'], ...field],
    bindings: { date: 0, oil: 1, water: 2 },
    settings: {
      title: 'Характеристика вытеснения месторождения Volve', subtitle: 'Метод Сазонова: Qн = a + b·ln Qж, предельная обводнённость 98%',
      footer: SRC, 'disp.method': 'sazonov', 'disp.input': 'period', 'disp.minWc': 60, 'disp.div': '1000', 'disp.unit': 'тыс. м³',
    },
  });

  // 4. Гонка накопленной добычи по годам
  const years = [...new Set(rows.filter((r) => r.oil > 0).map((r) => r.y))].sort();
  const race = [['Скважина', ...years.map(String)]];
  prodWells.forEach((w) => {
    let acc = 0;
    race.push([w, ...years.map((y) => {
      acc += rows.filter((r) => r.well === w && r.y === y).reduce((a, r) => a + r.oil, 0);
      return r1(acc / 1000);
    })]);
  });
  save('volve-race', {
    title: 'Volve: накопленная добыча нефти по скважинам',
    description: 'Гонка столбцов 2008–2016: как скважины обгоняли друг друга по накопленной добыче.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: накопленная добыча по скважинам', template: 'race', data: race,
    bindings: { label: 0, values: years.map((_, i) => i + 1) },
    settings: { title: 'Накопленная добыча нефти по скважинам', subtitle: 'Месторождение Volve, тыс. м³ на конец года', footer: SRC, 'race.bars': 8, 'race.duration': 1500, 'race.colorBy': 'name' },
  });

  // 5. Сводная таблица по скважинам
  const tbl = [['Скважина', 'Назначение', 'Начало работы', 'Месяцев в работе', 'Накопленная нефть, тыс. м³', 'Накопленная вода, тыс. м³', 'Накопленный газ, млн м³', 'Закачка воды, тыс. м³', 'Макс. дебит нефти, м³/сут', 'Обводнённость (посл. месяц), %']];
  wells.forEach((w) => {
    const list = rows.filter((r) => r.well === w);
    const sum = (f) => list.reduce((a, r) => a + r[f], 0);
    const active = list.filter((r) => r.oil + r.water + r.wi > 0);
    const lastLiq = [...list].reverse().find((r) => r.oil + r.water > 0);
    const maxQ = Math.max(...list.map((r) => r.oil / new Date(r.y, r.m, 0).getDate()));
    const inj = sum('wi') > sum('oil');
    tbl.push([w, inj ? 'Нагнетательная' : 'Добывающая', active.length ? key(active[0]) : '', active.length,
      r1(sum('oil') / 1000), r1(sum('water') / 1000), r1(sum('gas') / 1e6), r1(sum('wi') / 1000),
      inj ? '' : r1(maxQ), inj || !lastLiq ? '' : r1((lastLiq.water / (lastLiq.oil + lastLiq.water)) * 100)]);
  });
  save('volve-table', {
    title: 'Volve: сводка по скважинам',
    description: 'Таблица с поиском и сортировкой: накопленная добыча, закачка, максимальный дебит, текущая обводнённость.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: сводка по скважинам', template: 'table', data: tbl,
    bindings: { columns: tbl[0].map((_, i) => i), heat: [9], bars: [4, 7], totalsCols: [4, 5, 6, 7] },
    settings: {
      title: 'Месторождение Volve: сводка по скважинам', subtitle: 'Итоги разработки 2007–2016 по данным месячных рапортов', footer: SRC,
      'table.sortCol': 'Накопленная нефть, тыс. м³', 'table.sortDir': 'desc', 'table.totals': 'sum', 'table.heatScale': 'blues', 'table.search': false, 'layout.aspect': '16:9',
    },
  });

  // 6. Тепловая карта обводнённости по скважинам и годам
  const heat = [['Скважина', ...years.map(String)]];
  prodWells.forEach((w) => {
    heat.push([w, ...years.map((y) => {
      const list = rows.filter((r) => r.well === w && r.y === y);
      const o = list.reduce((a, r) => a + r.oil, 0), wt = list.reduce((a, r) => a + r.water, 0);
      return o + wt > 0 ? r1((wt / (o + wt)) * 100) : '';
    })]);
  });
  save('volve-watercut', {
    title: 'Volve: обводнённость по скважинам и годам',
    description: 'Тепловая карта годовой обводнённости продукции добывающих скважин.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: обводнённость по годам', template: 'heatmap', data: heat,
    bindings: { label: 0, values: years.map((_, i) => i + 1) },
    settings: { title: 'Обводнённость продукции по скважинам', subtitle: 'Месторождение Volve, % за год', footer: SRC, 'heat.scale': 'blues', 'number.suffix': '%', 'number.decimals': '0', 'heat.min': '0', 'heat.max': '100' },
  });

  // 7. Доли скважин в накопленной добыче
  const shares = [['Скважина', 'Накопленная нефть, тыс. м³']];
  prodWells.concat(wells.filter((w) => !prodWells.includes(w))).forEach((w) => {
    const v = rows.filter((r) => r.well === w).reduce((a, r) => a + r.oil, 0) / 1000;
    if (v > 0) shares.push([w, r1(v)]);
  });
  save('volve-shares', {
    title: 'Volve: вклад скважин в добычу',
    description: 'Кольцевая диаграмма долей скважин в накопленной добыче нефти.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: вклад скважин', template: 'pie', data: shares, bindings: { label: 0, value: 1 },
    settings: { title: 'Вклад скважин в накопленную добычу нефти', subtitle: 'Месторождение Volve, тыс. м³, 2008–2016', footer: SRC, 'pie.inner': 55, 'pie.centerTotal': true, 'pie.centerLabel': 'тыс. м³', 'labels.value': true },
  });

  // ---------- суточные рапорты: давление, штуцер, режим работы
  const daily = XLSX.utils.sheet_to_json(wb.Sheets['Daily Production Data'], { header: 1, raw: true }).slice(1)
    .filter((r) => r[23] === 'OP' && typeof r[0] === 'number')
    .map((r) => {
      const d = new Date(Math.round((r[0] - 25569) * 864e5));
      return { well: String(r[3]), date: d.toISOString().slice(0, 10), ym: d.toISOString().slice(0, 7), hrs: num(r[8]), bhp: num(r[9]), whp: num(r[15]), wht: num(r[16]), choke: num(r[13]), dpt: num(r[11]), oil: num(r[18]), gas: num(r[19]), water: num(r[20]) };
    })
    .sort((a, b) => a.well.localeCompare(b.well) || a.date.localeCompare(b.date));
  const opWells = [...new Set(daily.map((r) => r.well))].filter((w) => daily.filter((r) => r.well === w && r.oil > 0).length > 300);
  const avgPos = (list, f) => {
    const v = list.map((r) => r[f]).filter((x) => x > 0);
    return v.length ? r1(v.reduce((a, x) => a + x, 0) / v.length) : '';
  };

  // 8. Несколько осей Y: режим работы скважины по месяцам
  const regime = [['Скважина', 'Месяц', 'Нефть, м³/сут', 'Вода, м³/сут', 'Обводнённость, %', 'Забойное давление, бар', 'Устьевое давление, бар', 'Открытие штуцера, %']];
  opWells.forEach((w) => {
    const list = daily.filter((r) => r.well === w);
    [...new Set(list.map((r) => r.ym))].forEach((ym) => {
      const m = list.filter((r) => r.ym === ym);
      const on = m.filter((r) => r.hrs > 0);
      const days = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
      const o = m.reduce((a, r) => a + r.oil, 0), wt = m.reduce((a, r) => a + r.water, 0);
      if (o + wt <= 0) return;
      regime.push([w, ym, r1(o / days), r1(wt / days), r1((wt / (o + wt)) * 100), avgPos(on, 'bhp'), avgPos(on, 'whp'), avgPos(on, 'choke')]);
    });
  });
  save('volve-regime', {
    title: 'Volve: режим работы скважины на нескольких осях',
    description: 'Дебиты, обводнённость, забойное и устьевое давление, штуцер — панели с общей осью времени; переключатель скважин.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: режим работы скважины', template: 'multiaxis', data: regime,
    bindings: { filter: 0, label: 1, values: [2, 3], y2: [4], y3: [5, 6], y4: [7] },
    settings: {
      title: 'Режим работы добывающей скважины', subtitle: 'Месторождение Volve, среднемесячные значения по суточным рапортам', footer: SRC + ' Давление — бар.',
      'multi.layout': 'panels', 'layout.aspect': '4:3', 'filter.default': '15/9-F-14', 'multi.zoom': true, 'multi.symbols': 'none',
      'ax1.title': 'Дебиты, м³/сут', 'ax1.unit': 'м³/сут', 'ax1.weight': 1.4,
      'ax2.title': 'Обводнённость, %', 'ax2.unit': '%', 'ax2.min': '0', 'ax2.max': '100',
      'ax3.title': 'Давление, бар', 'ax3.unit': 'бар', 'ax3.zero': false, 'ax3.weight': 1.2,
      'ax4.title': 'Штуцер, %', 'ax4.unit': '%', 'ax4.type': 'step', 'ax4.min': '0', 'ax4.max': '100', 'ax4.weight': 0.7,
    },
  });

  // 9. Ящик с усами: суточные дебиты нефти по скважинам (полные сутки работы)
  const box = [['Скважина', 'Дата', 'Дебит нефти, м³/сут']];
  daily.filter((r) => r.hrs >= 23 && r.oil > 0 && opWells.includes(r.well)).forEach((r, i) => { if (i % 3 === 0) box.push([r.well, r.date, r1(r.oil)]); });
  save('volve-boxplot', {
    title: 'Volve: разброс суточных дебитов по скважинам',
    description: 'Ящик с усами на логарифмической шкале: медиана, квартили и выбросы суточной добычи нефти (полные сутки работы).',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: суточные дебиты по скважинам', template: 'boxplot', data: box,
    bindings: { group: 0, label: 1, values: [2] },
    settings: {
      title: 'Суточные дебиты нефти по скважинам', subtitle: 'Месторождение Volve, сутки с полной работой (выборка каждых третьих суток), м³/сут',
      footer: SRC, 'yAxis.log': true, 'yAxis.title': 'Дебит нефти, м³/сут', 'box.sort': 'desc', 'box.mean': 'geo',
    },
  });

  // 10. Диагностика обводнения по Чену
  const chan = [['Скважина', 'Месяц', 'Добыча нефти, м³', 'Добыча воды, м³']];
  rows.filter((r) => prodWells.includes(r.well) && r.oil > 0).forEach((r) => chan.push([r.well, key(r), r1(r.oil), r1(r.water)]));
  save('volve-chan', {
    title: 'Volve: диагностика обводнения по Чену',
    description: 'ВНФ и производная ВНФ′ в логарифмических координатах по скважинам; наклон на поздней стадии и подсказка по механизму обводнения.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: диагностика по Чену', template: 'chan', data: chan,
    bindings: { filter: 0, date: 1, oil: 2, water: 3 },
    settings: {
      title: 'Диагностика обводнения по Чену', subtitle: 'Месторождение Volve, помесячные данные', footer: SRC + ' Метод: K. S. Chan, SPE 30775 (1995).',
      'filter.default': '15/9-F-14', 'filter.control': 'buttons', 'chan.smooth': 3,
    },
  });

  // 11. Корреляции режимных параметров скважины
  const corr = [['Дата', 'Забойное давление, бар', 'Устьевое давление, бар', 'Перепад в НКТ, бар', 'Штуцер, %', 'Температура на устье, °C', 'Нефть, м³/сут', 'Вода, м³/сут', 'Газ, тыс. м³/сут']];
  daily.filter((r) => r.well === '15/9-F-14' && r.hrs >= 23 && r.oil > 0 && r.bhp > 0).forEach((r, i) => {
    if (i % 3 === 0) corr.push([r.date, r1(r.bhp), r1(r.whp), r1(r.dpt), r1(r.choke), r1(r.wht), r1(r.oil), r1(r.water), r1(r.gas / 1000)]);
  });
  save('volve-correlation', {
    title: 'Volve: связь режимных параметров скважины',
    description: 'Матрица корреляций Спирмена для суточных параметров скважины F-14 с группировкой связанных параметров.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: корреляции параметров F-14', template: 'correlation', data: corr,
    bindings: { name: 0, values: [1, 2, 3, 4, 5, 6, 7, 8] },
    settings: {
      title: 'Связь режимных параметров скважины 15/9-F-14', subtitle: 'Коэффициенты корреляции Спирмена, сутки с полной работой (выборка каждых третьих суток)',
      footer: SRC, 'corr.method': 'spearman', 'corr.order': 'cluster',
    },
  });

  // 12. Парето: какие скважины дают основную добычу
  save('volve-pareto', {
    title: 'Volve: ABC-анализ скважин по добыче',
    description: 'Диаграмма Парето накопленной добычи нефти: какие скважины дают 80% и 95% нефти месторождения.',
    group: 'Реальные данные: месторождение Volve',
  }, {
    title: 'Volve: Парето по скважинам', template: 'pareto', data: shares, bindings: { label: 0, value: 1 },
    settings: { title: 'Вклад скважин в добычу нефти: ABC-анализ', subtitle: 'Месторождение Volve, накопленная добыча 2008–2016, тыс. м³', footer: SRC, 'pareto.abc': true, 'yAxis.title': 'Нефть, тыс. м³' },
  });
} else {
  console.log('… Volve: файл не указан — примеры Volve не пересобираются');
}

// ================================================================= Energy Institute / Our World in Data
const owidPath = process.argv[3];
if (owidPath && existsSync(owidPath)) {
  const world = JSON.parse(readFileSync(join(root, 'public/maps/world.json'), 'utf8'));
  const byIso = new Map(world.features.map((f) => [f.properties.iso3, f.properties]));
  const REG = { Asia: 'Азия', Europe: 'Европа', Americas: 'Америка', Africa: 'Африка', Oceania: 'Океания' };
  const lines = readFileSync(owidPath, 'utf8').trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
  const recs = lines.filter((r) => r[1] && !r[1].startsWith('OWID')).map((r) => ({ name: r[0], iso: r[1], year: +r[2], twh: +r[3] }));
  const ru = (iso, en) => (byIso.get(iso) ? byIso.get(iso).name_ru : en);
  const MTOE = 11.63; // ТВт·ч в 1 млн т н.э.
  const lastYear = Math.max(...recs.map((r) => r.year));
  const SRC = `Источник: Energy Institute — Statistical Review of World Energy (2026); U.S. EIA; обработка Our World in Data. Пересчёт: 1 млн т н.э. = ${MTOE} ТВт·ч.`;

  const latest = recs.filter((r) => r.year === lastYear && r.twh > 0).sort((a, b) => b.twh - a.twh);
  save('world-oil-map', {
    title: `Мировая добыча нефти, ${lastYear}`,
    description: 'Карта мира: добыча нефти, газового конденсата и ШФЛУ по странам (Energy Institute).',
    group: 'Реальные данные: мировая нефтедобыча',
  }, {
    title: `Мировая добыча нефти ${lastYear}`, template: 'map',
    data: [['Страна', 'Код ISO', 'Добыча, млн т н.э.'], ...latest.map((r) => [ru(r.iso, r.name), r.iso, r1(r.twh / MTOE)])],
    bindings: { region: 1, value: 2 },
    settings: {
      title: `Добыча нефти по странам, ${lastYear} г.`, subtitle: 'Нефть, конденсат и ШФЛУ, млн т нефтяного эквивалента', footer: SRC,
      'map.scale': 'oranges', 'map.mode': 'pieces', 'map.pieces': 6, 'map.antarctica': false,
    },
  });

  // гонка: страны, входившие в топ-12 хотя бы в одном году с 1965
  const years = [...new Set(recs.map((r) => r.year))].filter((y) => y >= 1965).sort((a, b) => a - b);
  const top = new Set();
  years.forEach((y) => recs.filter((r) => r.year === y).sort((a, b) => b.twh - a.twh).slice(0, 12).forEach((r) => top.add(r.iso)));
  const race = [['Страна', 'Регион', ...years.map(String)]];
  [...top].forEach((iso) => {
    const name = ru(iso, recs.find((r) => r.iso === iso).name);
    const reg = REG[byIso.get(iso)?.region] || 'Прочие';
    race.push([name, reg, ...years.map((y) => {
      const r = recs.find((x) => x.iso === iso && x.year === y);
      return r ? r1(r.twh / MTOE) : 0;
    })]);
  });
  save('world-oil-race', {
    title: `Крупнейшие нефтедобывающие страны, 1965–${lastYear}`,
    description: 'Гонка столбцов по годам: смена лидеров мировой нефтедобычи за 60 лет.',
    group: 'Реальные данные: мировая нефтедобыча',
  }, {
    title: 'Лидеры нефтедобычи 1965–' + lastYear, template: 'race', data: race,
    bindings: { label: 0, group: 1, values: years.map((_, i) => i + 2) },
    settings: { title: 'Крупнейшие нефтедобывающие страны', subtitle: 'Добыча нефти, конденсата и ШФЛУ, млн т н.э.', footer: SRC, 'race.bars': 12, 'race.duration': 600, 'race.colorBy': 'group', 'number.decimals': '0' },
  });
} else {
  console.log('… OWID/EI: файл не указан — мировые примеры не пересобираются');
}

// ================================================================= учебное месторождение (демонстрационные данные)
const DEMO = 'Учебное месторождение (демонстрационные данные)';
save('demo-production', { title: 'Профиль добычи с ППД и ГТМ', description: 'Нефть, вода, закачка, пластовое давление и отметки мероприятий (начало ППД, ГРП).', group: DEMO }, fromSample('production', 0));
save('demo-wellmap', { title: 'Карта текущих отборов', description: 'Круговые диаграммы нефть/вода по скважинам, нагнетательные скважины, карта нефтенасыщенных толщин с изолиниями.', group: DEMO }, fromSample('wellmap', 0));
save('demo-thickness', { title: 'Карта нефтенасыщенных толщин', description: 'Интерполяция (IDW) толщины между скважинами с изолиниями.', group: DEMO }, fromSample('wellmap', 1, { settings: { title: 'Карта нефтенасыщенных толщин', subtitle: 'Пласт ЮС1, интерполяция по данным ГИС, м' } }));
save('demo-welllog', { title: 'Планшет ГИС', description: 'ГК, сопротивление (лог. шкала), нейтронная пористость, плотность; литология и отметка ВНК.', group: DEMO }, fromSample('welllog', 0));
save('demo-dca', { title: 'Анализ падения дебита скважины', description: 'Гиперболическая кривая Арпса, прогноз до экономического предела, EUR.', group: DEMO }, fromSample('dca', 0));
save('demo-displacement', { title: 'Характеристика вытеснения', description: 'Метод Сазонова, НИЗ и КИН при обводнённости 98%.', group: DEMO }, fromSample('displacement', 0));
save('demo-tornado', { title: 'Анализ чувствительности NPV', description: 'Торнадо-диаграмма: цена нефти, запасы, дебиты, CAPEX, темп падения.', group: DEMO }, fromSample('tornado', 0));
save('demo-reserves', { title: 'Вероятностная оценка запасов', description: '1 500 реализаций Монте-Карло объёмного метода, P90 / P50 / P10.', group: DEMO }, fromSample('histogram', 0));
save('demo-table', { title: 'Технологический режим скважин', description: 'Таблица с мини-гистограммами дебитов, раскраской обводнённости и итогами.', group: DEMO }, fromSample('table', 0));

save('demo-factor', { title: 'Факторный анализ изменения добычи', description: 'Каскадная диаграмма: падение базовой добычи и эффект ГТМ (ГРП, ЗБС, ВНС, оптимизация).', group: DEMO }, {
  title: 'Факторный анализ добычи нефти', template: 'waterfall',
  data: [['Фактор', 'тыс. т'], ['Добыча 2024', '2 480'], ['Естественное падение', '-410'], ['Рост обводнённости', '-95'], ['ГРП', '168'], ['Зарезка боковых стволов', '112'], ['Ввод новых скважин', '205'], ['Оптимизация насосов', '41'], ['Остановки и ремонты', '-37']],
  bindings: { label: 0, value: 1 },
  settings: { title: 'Факторный анализ изменения добычи нефти', subtitle: '2025 к 2024 году, тыс. т', footer: 'Источник: демонстрационные данные', 'wf.totalLabel': 'Добыча 2025', 'wf.up': '#1baf7a', 'wf.down': '#e34948', 'wf.totalColor': '#7a4a1e' },
});
save('demo-stock', { title: 'Структура фонда скважин', description: 'Солнечные лучи: добывающий, нагнетательный и прочий фонд по состояниям.', group: DEMO }, {
  title: 'Структура фонда скважин', template: 'sunburst',
  data: [['Фонд', 'Состояние', 'Способ', 'Скважин'],
    ['Добывающий', 'Действующий', 'ЭЦН', '412'], ['Добывающий', 'Действующий', 'ШГН', '96'], ['Добывающий', 'Действующий', 'Фонтан', '14'],
    ['Добывающий', 'Бездействующий', 'Ожидание ремонта', '38'], ['Добывающий', 'Бездействующий', 'Нерентабельные', '22'],
    ['Нагнетательный', 'Действующий', 'Под закачкой', '171'], ['Нагнетательный', 'Бездействующий', 'Ремонт', '19'],
    ['Прочий', 'Консервация', 'Консервация', '27'], ['Прочий', 'Наблюдательные', 'Пьезометрические', '31'], ['Прочий', 'Водозаборные', 'Водозаборные', '9']],
  bindings: { levels: [0, 1, 2], value: 3 },
  settings: { title: 'Структура фонда скважин', subtitle: 'На 1 октября 2025 г., скважин', footer: 'Источник: демонстрационные данные', 'sun.inner': 18 },
});
save('demo-gas-balance', { title: 'Баланс попутного нефтяного газа', description: 'Санкей: от добычи ПНГ до продуктов переработки, собственных нужд и факела.', group: DEMO }, {
  title: 'Баланс попутного газа', template: 'sankey',
  data: [['Откуда', 'Куда', 'млн м³'],
    ['Добыча ПНГ', 'Газоперерабатывающий завод', '1 420'], ['Добыча ПНГ', 'Собственные нужды', '310'], ['Добыча ПНГ', 'Закачка в пласт', '185'], ['Добыча ПНГ', 'Сжигание на факеле', '62'],
    ['Газоперерабатывающий завод', 'Сухой отбензиненный газ', '1 080'], ['Газоперерабатывающий завод', 'ШФЛУ', '290'], ['Газоперерабатывающий завод', 'Потери', '50'],
    ['Собственные нужды', 'Газотурбинные электростанции', '240'], ['Собственные нужды', 'Котельные и печи', '70']],
  bindings: { source: 0, target: 1, value: 2 },
  settings: { title: 'Баланс использования попутного нефтяного газа', subtitle: 'Уровень полезного использования 96,9%, млн м³ за 2025 г.', footer: 'Источник: демонстрационные данные', 'sankey.linkColor': 'source' },
});
const scen = [['Год', 'Базовый вариант', 'Вариант 2: ППД', 'Вариант 3: ППД + ГРП + бурение']];
for (let y = 2026; y <= 2045; y++) {
  const t = y - 2026;
  const base = 1250 * Math.exp(-0.16 * t);
  const v2 = 1250 * Math.pow(1 + 0.6 * 0.11 * t, -1 / 0.6);
  const v3 = (t < 4 ? 1250 + 180 * t : 1970 * Math.pow(1 + 0.7 * 0.13 * (t - 3), -1 / 0.7));
  scen.push([String(y), r1(base), r1(v2), r1(v3)]);
}
save('demo-scenarios', { title: 'Сравнение вариантов разработки', description: 'Прогноз годовой добычи нефти по трём вариантам разработки с подписями у линий.', group: DEMO }, {
  title: 'Варианты разработки', template: 'line', data: scen, bindings: { label: 0, values: [1, 2, 3] },
  settings: { title: 'Прогноз добычи нефти по вариантам разработки', subtitle: 'тыс. т в год', footer: 'Источник: демонстрационные данные', 'line.endLabels': true, 'line.symbols': 'none', 'line.width': 2.5, 'yAxis.min': '0', 'ref.value': '500', 'ref.label': 'Минимально рентабельный уровень' },
});

// новые аналитические шаблоны — на их демонстрационных данных
save('demo-multiaxis', { title: 'Режим скважины: четыре оси Y', description: 'Дебиты, обводнённость, забойное давление и газовый фактор на одном графике с отдельными шкалами; отметки ГРП и смены ЭЦН.', group: DEMO }, fromSample('multiaxis', 0));
save('demo-panels', { title: 'Режим скважины: панели', description: 'Те же данные в виде панелей с общей осью времени — нагляднее, когда шкал больше трёх.', group: DEMO }, fromSample('multiaxis', 1));
save('demo-boxplot', { title: 'Проницаемость по пластам', description: 'Ящик с усами на логарифмической шкале: медиана, квартили, выбросы и среднее геометрическое.', group: DEMO }, fromSample('boxplot', 0));
save('demo-violin', { title: 'Распределение проницаемости (скрипичная)', description: 'Форма распределения проницаемости по пластам: ядерная оценка плотности и квартили.', group: DEMO }, fromSample('boxplot', 2, { settings: { subtitle: 'Исследования керна, мД. Контур — плотность распределения, внутри — квартили и медиана' } }));
save('demo-crossplot', { title: 'Кросс-плот пористость — проницаемость', description: 'Экспоненциальная регрессия по литотипам: уравнение, R² и число образцов на графике.', group: DEMO }, fromSample('scatter', 1));
save('demo-pareto', { title: 'Потери добычи по причинам (Парето)', description: 'Какие причины дают 80% потерь нефти; ABC-группы.', group: DEMO }, fromSample('pareto', 1));
save('demo-correlation', { title: 'Матрица корреляций параметров скважин', description: 'ФЕС, насыщенность и показатели работы: коэффициенты Спирмена, незначимые связи приглушены.', group: DEMO }, fromSample('correlation', 0));
save('demo-splom', { title: 'Матрица диаграмм рассеяния', description: 'Попарные кросс-плоты параметров по пластам, гистограммы и коэффициенты корреляции.', group: DEMO }, fromSample('correlation', 1));
save('demo-chan', { title: 'Диагностика обводнения по Чену', description: 'Две скважины: прорыв по высокопроницаемому пропластку и конус подошвенной воды.', group: DEMO }, fromSample('chan', 0));
save('demo-hall', { title: 'График Холла нагнетательной скважины', description: 'Наклоны по участкам: кольматация призабойной зоны и эффект ОПЗ.', group: DEMO }, fromSample('hall', 0));
console.log(`Готово: ${readdirSync(outDir).filter((f) => f.endsWith('.json')).length} примеров в examples/`);

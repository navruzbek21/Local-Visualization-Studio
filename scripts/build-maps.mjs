// Собирает public/maps/world.json: границы стран (Natural Earth через world-atlas)
// + русские/английские названия и ISO-коды (world-countries) для сопоставления с данными.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const topo = read('node_modules/world-atlas/countries-50m.json');
const countries = read('node_modules/world-countries/countries.json');
const byNumeric = new Map(countries.map((c) => [c.ccn3, c]));

const round = (coords) =>
  typeof coords[0] === 'number'
    ? [Math.round(coords[0] * 100) / 100, Math.round(coords[1] * 100) / 100]
    : coords.map(round);

// Распространённые русские варианты названий (для сопоставления с данными пользователя)
const ALIASES = {
  USA: ['США', 'Соединенные Штаты', 'Америка'], GBR: ['Великобритания', 'Англия', 'Соединённое Королевство'],
  KOR: ['Корея', 'Республика Корея'], PRK: ['КНДР', 'Северная Корея'], ZAF: ['ЮАР'], KGZ: ['Кыргызстан', 'Кыргызская Республика'],
  BLR: ['Беларусь', 'Белоруссия', 'Республика Беларусь'], MDA: ['Молдова', 'Республика Молдова'], ARE: ['ОАЭ', 'Эмираты'],
  CZE: ['Чешская Республика'], COD: ['ДР Конго', 'Конго (Киншаса)'], COG: ['Конго', 'Конго (Браззавиль)'], MMR: ['Бирма'],
  MKD: ['Македония'], IRN: ['Исламская Республика Иран'], SYR: ['Сирийская Арабская Республика'], LAO: ['Лаосская НДР'],
  TZA: ['Объединённая Республика Танзания'], RUS: ['РФ', 'Российская Федерация'], CHN: ['КНР'], VNM: ['Вьетнам'],
  CIV: ["Кот-д'Ивуар", 'Берег Слоновой Кости'], TUR: ['Турецкая Республика', 'Türkiye'], NLD: ['Голландия'],
  KAZ: ['Республика Казахстан'], UZB: ['Республика Узбекистан'], TJK: ['Республика Таджикистан'], TKM: ['Туркмения'],
  AZE: ['Азербайджанская Республика'], GEO: ['Грузия'], ARM: ['Республика Армения'], BIH: ['Босния'], DOM: ['Доминиканская Республика'],
};

// Кольца, пересекающие 180° меридиан, «разворачиваем», чтобы на плоской карте не было горизонтальных полос
function unwrap(ring) {
  const out = [ring[0].slice()];
  let shift = 0;
  for (let i = 1; i < ring.length; i++) {
    const d = ring[i][0] - ring[i - 1][0];
    if (d > 180) shift -= 360;
    else if (d < -180) shift += 360;
    out.push([ring[i][0] + shift, ring[i][1]]);
  }
  return out;
}
function fixAntimeridian(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const fixed = polys.map((poly) => poly.map((ring) => {
    const u = unwrap(ring);
    // если после разворота кольцо ушло в отрицательную сторону — сдвигаем целиком на восток
    const minX = Math.min(...u.map((p) => p[0]));
    return minX < -180 ? u.map((p) => [p[0] + 360, p[1]]) : u;
  }));
  return geometry.type === 'Polygon' ? { type: 'Polygon', coordinates: fixed[0] } : { type: 'MultiPolygon', coordinates: fixed };
}

const geo = feature(topo, topo.objects.countries);
geo.features = geo.features
  .filter((f) => f.geometry)
  .map((f) => {
    const c = byNumeric.get(f.id);
    const props = {
      name: c?.name.common ?? f.properties.name,
      name_ru: c?.translations?.rus?.common ?? f.properties.name,
      name_official: c?.name.official ?? '',
      iso2: c?.cca2 ?? '',
      iso3: c?.cca3 ?? '',
      iso_n: f.id ?? '',
      region: c?.region ?? '',
      alt_ru: (ALIASES[c?.cca3] ?? []).join(';'),
    };
    let geometry = { type: f.geometry.type, coordinates: round(f.geometry.coordinates) };
    if (props.iso3 !== 'ATA') geometry = fixAntimeridian(geometry);
    return { type: 'Feature', properties: props, geometry };
  });

mkdirSync(join(root, 'public', 'maps'), { recursive: true });
const out = join(root, 'public', 'maps', 'world.json');
writeFileSync(out, JSON.stringify(geo));
console.log(`✓ maps/world.json — ${geo.features.length} стран, ${(JSON.stringify(geo).length / 1024).toFixed(0)} КБ`);

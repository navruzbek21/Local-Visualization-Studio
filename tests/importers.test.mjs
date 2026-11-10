// Тесты разбора файлов: CSV (кодировки, разделители, кавычки), JSON, Excel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let XLSX = null;
try {
  XLSX = require('xlsx'); // dev-зависимость; без неё тест Excel пропускается
} catch {}
globalThis.window = { XLSX };

const imp = await import('../public/js/importers.js');
const fixture = (name) => readFileSync(join(root, 'tests/fixtures', name));

test('parseCsv: кавычки, переносы строк и удвоенные кавычки внутри поля', () => {
  const rows = imp.parseCsv('a,b\n"x, y","say ""hi"""\n"line1\nline2",3\n', ',');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'say "hi"'], ['line1\nline2', '3']]);
});

test('detectDelimiter: «;», табуляция, запятая', () => {
  assert.equal(imp.detectDelimiter('a;b;c\n1;2;3\n4;5;6'), ';');
  assert.equal(imp.detectDelimiter('a\tb\n1\t2'), '\t');
  assert.equal(imp.detectDelimiter('a,b\n1,2'), ',');
  // «;» побеждает, даже если в числах есть запятые (русский Excel)
  assert.equal(imp.detectDelimiter('Город;Сумма\nМосква;1 234,5\nКазань;99,9'), ';');
});

test('decodeText: UTF-8 и Windows-1251 определяются автоматически', () => {
  const utf = imp.decodeText(new TextEncoder().encode('Привет').buffer);
  assert.equal(utf.encoding, 'utf-8');
  assert.equal(utf.text, 'Привет');
  const cp = imp.decodeText(fixture('sales-1251.csv'));
  assert.equal(cp.encoding, 'windows-1251');
  assert.match(cp.text, /^Месяц;Выручка/);
});

test('parseBuffer: CSV в Windows-1251 с русскими числами', () => {
  const r = imp.parseBuffer(fixture('sales-1251.csv'), { name: 'sales.csv' });
  assert.equal(r.delimiter, ';');
  assert.deepEqual(r.table[0], ['Месяц', 'Выручка, руб.', 'Расходы, руб.', 'Филиал']);
  assert.equal(r.table.length, 6);
  assert.equal(r.table[5][0], 'Май "лучший"');
  assert.equal(r.table[1][1], '1 234 567,89');
});

test('jsonToTable: массив объектов с вложенностью, {columns, rows}, объект массивов', () => {
  assert.deepEqual(imp.jsonToTable([{ a: 1, b: { c: 2 } }, { a: 3, d: [1, 2] }]), [['a', 'b.c', 'd'], [1, 2, ''], [3, '', '1, 2']]);
  assert.deepEqual(imp.jsonToTable({ columns: ['x'], rows: [[1]] }), [['x'], [1]]);
  assert.deepEqual(imp.jsonToTable({ year: [2023, 2024], v: [1, 2] }), [['year', 'v'], [2023, 1], [2024, 2]]);
  assert.deepEqual(imp.jsonToTable({ data: [{ k: 'v' }] }), [['k'], ['v']]);
});

test('normalizeTable: обрезает пустые строки снизу и пустые колонки справа', () => {
  assert.deepEqual(imp.normalizeTable([['a', 'b', ''], ['1', '', ''], ['', '', '']]), [['a', 'b'], ['1', '']]);
});

test('toCsv: экранирование', () => {
  assert.equal(imp.toCsv([['a;b', 'x'], ['"q"', '1']], ';'), '"a;b";x\r\n"""q""";1');
});

test('Excel: листы, числа и даты', { skip: !XLSX && 'нет пакета xlsx' }, () => {
  const r = imp.parseBuffer(fixture('departments.xlsx'), { name: 'departments.xlsx' });
  assert.deepEqual(r.sheets, ['Отделы', 'Динамика']);
  assert.deepEqual(r.table[0], ['Отдел', 'Сотрудники', 'Бюджет', 'Дата']);
  assert.deepEqual(r.table[1], ['ИТ', 42, 1250000.5, '2025-01-15']);
  const second = imp.parseBuffer(fixture('departments.xlsx'), { name: 'departments.xlsx', sheet: 'Динамика' });
  assert.deepEqual(second.table, [['Год', 'Показатель'], [2023, 10], [2024, 15]]);
});

test('LAS 2.0: кривые с единицами, NULL → пусто', () => {
  const r = imp.parseBuffer(fixture('well-1012.las'), { name: 'well-1012.las' });
  assert.equal(r.kind, 'las');
  assert.equal(r.well, '1012');
  assert.deepEqual(r.table[0], ['DEPT, M', 'GR, GAPI', 'RT, OHMM', 'NPHI, V/V']);
  assert.equal(r.table.length, 7);
  assert.deepEqual(r.table[3], [2440.4, '', 2.98, 0.349]);
  assert.equal(r.table[5][3], '');
});

test('LAS: перенос строк (WRAP YES)', () => {
  const text = '~V\n VERS. 2.0 :\n WRAP. YES :\n~W\n NULL. -999.25 :\n~C\n DEPT.M :\n A.U :\n B.U :\n~A\n 100.0\n 1 2\n 100.5\n 3 -999.25\n';
  const r = imp.parseLas(text);
  assert.deepEqual(r.table.slice(1), [[100, 1, 2], [100.5, 3, '']]);
});

test('RSM (tNavigator/Eclipse): страницы объединяются, даты и множители', () => {
  const r = imp.parseBuffer(fixture('model.rsm'), { name: 'model.rsm' });
  assert.equal(r.kind, 'rsm');
  assert.deepEqual(r.table[0], ['DATE', 'TIME, DAYS', 'FOPR, SM3/DAY', 'FWCT', 'WOPR:P1, SM3/DAY', 'WOPR:P2, SM3/DAY', 'WBHP:P1, BARSA', 'FWPR, SM3/DAY', 'FWIR, SM3/DAY', 'BPR:10,5,3, BARSA']);
  assert.equal(r.table.length, 4);
  assert.equal(r.table[1][0], '2020-01-01');
  assert.equal(r.table[2][4], 760.5);
  assert.equal(r.table[1][6], 245); // ×10^-1
  assert.equal(r.table[3][8], 1400); // ×10^3
  assert.equal(r.table[2][9], 249.5);
});

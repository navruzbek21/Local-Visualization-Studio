// Интеграционные тесты сервера: запускаем на свободном порту с временным каталогом данных.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(join(tmpdir(), 'vstudio-test-'));
const port = 37000 + Math.floor(Math.random() * 2000);
const base = `http://127.0.0.1:${port}`;
let proc;

async function startServer(env = {}) {
  const p = spawn(process.execPath, [join(root, 'server.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('сервер не запустился')), 8000);
    p.stdout.on('data', (d) => {
      if (String(d).includes('запущена')) {
        clearTimeout(t);
        resolve();
      }
    });
    p.on('exit', (code) => reject(new Error('сервер завершился: ' + code)));
  });
  return p;
}

const json = async (path, opts = {}) => {
  const r = await fetch(base + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    body: opts.body && typeof opts.body !== 'string' && !(opts.body instanceof Uint8Array) ? JSON.stringify(opts.body) : opts.body,
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
};

before(async () => {
  proc = await startServer();
});
after(() => {
  proc?.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

test('статические файлы и SPA', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Visualization Studio/);
  assert.equal((await fetch(base + '/vendor/echarts.min.js')).status, 200);
  assert.equal((await fetch(base + '/runtime/core.js')).status, 200);
  assert.equal((await fetch(base + '/maps/world.json')).status, 200);
  assert.equal((await fetch(base + '/%2e%2e/server.js')).status, 404);
  assert.equal((await fetch(base + '/view/abc12345')).status, 200);
});

test('список шаблонов', async () => {
  const { body } = await json('/api/templates');
  assert.ok(body.builtin.length >= 15);
  assert.ok(body.custom.some((u) => u.endsWith('calendar.js')));
});

test('проекты: создание, чтение, сохранение, дублирование, удаление', async () => {
  const created = await json('/api/projects', { method: 'POST', body: { title: 'Тест', template: 'bar', data: [['a', 'b'], ['x', 1]], bindings: { label: 0, values: [1] }, settings: {} } });
  assert.equal(created.status, 200);
  const id = created.body.id;
  assert.match(id, /^[a-z0-9]+$/);
  const got = await json('/api/projects/' + id);
  assert.equal(got.body.title, 'Тест');
  const saved = await json('/api/projects/' + id, { method: 'PUT', body: { ...got.body, title: 'Новое имя' } });
  assert.equal(saved.body.title, 'Новое имя');
  assert.equal(saved.body.createdAt, got.body.createdAt);
  const dup = await json(`/api/projects/${id}/duplicate`, { method: 'POST' });
  assert.equal(dup.body.title, 'Новое имя (копия)');
  const list = await json('/api/projects');
  assert.equal(list.body.length, 2);
  // миниатюра принимает только PNG
  const bad = await fetch(`${base}/api/projects/${id}/thumbnail`, { method: 'PUT', body: 'not png' });
  assert.equal(bad.status, 400);
  assert.equal((await json('/api/projects/' + id, { method: 'DELETE' })).status, 200);
  assert.equal((await json('/api/projects/' + id)).status, 404);
  assert.equal((await json('/api/projects/..%2F..%2Fetc')).status, 400);
});

test('примеры: список, чтение, копия в проекты', async () => {
  const list = await json('/api/examples');
  assert.ok(list.body.length >= 10, 'примеров: ' + list.body.length);
  assert.ok(list.body.every((e) => e.id && e.title && e.template));
  const ex = await json('/api/examples/' + list.body[0].id);
  assert.ok(Array.isArray(ex.body.project.data));
  const copy = await json(`/api/examples/${list.body[0].id}/copy`, { method: 'POST' });
  assert.equal(copy.status, 200);
  assert.equal(copy.body.template, ex.body.project.template);
  assert.equal((await json('/api/examples/nope-nope')).status, 404);
  await json('/api/projects/' + copy.body.id, { method: 'DELETE' });
});

test('мои шаблоны (пресеты)', async () => {
  const p = await json('/api/presets', { method: 'POST', body: { name: 'Фирменный', template: 'line', settings: { 'colors.palette': 'corporate' } } });
  assert.equal(p.status, 200);
  assert.equal((await json('/api/presets')).body.length, 1);
  await json('/api/presets/' + p.body.id, { method: 'DELETE' });
  assert.equal((await json('/api/presets')).body.length, 0);
});

test('карты: проверка формата GeoJSON', async () => {
  const bad = await json('/api/maps', { method: 'POST', body: { name: 'x', geojson: { type: 'Topology' } } });
  assert.equal(bad.status, 400);
  const ok = await json('/api/maps', { method: 'POST', body: { name: 'Зоны', geojson: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { zone: 'A' }, geometry: { type: 'Point', coordinates: [0, 0] } }] } } });
  assert.deepEqual(ok.body.properties, ['zone']);
});

test('SQLite: подключение, таблицы, запрос и защита от записи', async () => {
  const dbFile = join(dataDir, 'sales.db');
  copyFileSync(join(root, 'tests/fixtures/sales.db'), dbFile);
  const c = await json('/api/db/connections', { method: 'POST', body: { type: 'sqlite', name: 'Продажи', file: dbFile } });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const tables = await json(`/api/db/connections/${c.body.id}/tables`);
  assert.deepEqual(tables.body.map((t) => t.name), ['sales', 'totals']);
  const q = await json(`/api/db/connections/${c.body.id}/query`, { method: 'POST', body: { sql: 'SELECT region, SUM(revenue) AS total FROM sales GROUP BY region ORDER BY total DESC', limit: 2 } });
  assert.deepEqual(q.body.columns, ['region', 'total']);
  assert.equal(q.body.rows.length, 2);
  assert.equal(q.body.truncated, true);
  const del = await json(`/api/db/connections/${c.body.id}/query`, { method: 'POST', body: { sql: 'DELETE FROM sales' } });
  assert.equal(del.status, 400);
  const sneaky = await json(`/api/db/connections/${c.body.id}/query`, { method: 'POST', body: { sql: 'WITH x AS (SELECT 1) DELETE FROM sales' } });
  assert.equal(sneaky.status, 400);
  const after = await json(`/api/db/connections/${c.body.id}/query`, { method: 'POST', body: { sql: 'SELECT COUNT(*) AS n FROM sales' } });
  assert.ok(after.body.rows[0][0] > 0, 'данные не должны удаляться');
  const notDb = await json('/api/db/connections', { method: 'POST', body: { type: 'sqlite', file: join(root, 'package.json') } });
  assert.equal(notDb.status, 400);
  // пароли не отдаются клиенту
  const list = await json('/api/db/connections');
  assert.ok(list.body.every((x) => !('password' in x)));
});

test('базовая авторизация (AUTH_USER/AUTH_PASS)', async () => {
  proc.kill();
  await new Promise((r) => proc.once('exit', r));
  proc = await startServer({ AUTH_USER: 'admin', AUTH_PASS: 's3cret' });
  assert.equal((await fetch(base + '/api/health')).status, 401);
  const ok = await fetch(base + '/api/health', { headers: { authorization: 'Basic ' + Buffer.from('admin:s3cret').toString('base64') } });
  assert.equal(ok.status, 200);
  const wrong = await fetch(base + '/api/health', { headers: { authorization: 'Basic ' + Buffer.from('admin:nope').toString('base64') } });
  assert.equal(wrong.status, 401);
});

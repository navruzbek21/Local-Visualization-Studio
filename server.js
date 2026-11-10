// Visualization Studio — локальный сервер.
// Запуск: node server.js   (переменные окружения: PORT, HOST, DATA_DIR, AUTH_USER, AUTH_PASS)
import { createServer } from 'node:http';
import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { Router, HttpError, readBody, readJson, sendJson, serveFile } from './server/http.js';
import { Store, checkId, newId } from './server/store.js';
import { Databases, loadDrivers, driverStatus, isSqliteFile } from './server/db.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3700;
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
const PUBLIC_DIR = join(ROOT, 'public');
const CUSTOM_TEMPLATES_DIR = join(ROOT, 'templates');
const EXAMPLES_DIR = join(ROOT, 'examples');
const AUTH = process.env.AUTH_USER && process.env.AUTH_PASS
  ? Buffer.from(`${process.env.AUTH_USER}:${process.env.AUTH_PASS}`)
  : null;

const store = new Store(DATA_DIR);
const dbs = new Databases(store);
const api = new Router();

// ---------------------------------------------------------------- служебное
api.get('/api/health', () => ({ ok: true, version: '1.2.0', drivers: driverStatus() }));

// Список скриптов шаблонов: встроенные (public/runtime/templates) + пользовательские (templates/)
function listScripts(dir, prefix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => `${prefix}${encodeURIComponent(f)}`);
}
api.get('/api/templates', () => ({
  builtin: listScripts(join(PUBLIC_DIR, 'runtime', 'templates'), '/runtime/templates/'),
  custom: listScripts(CUSTOM_TEMPLATES_DIR, '/custom-templates/'),
}));

// ---------------------------------------------------------------- проекты
api.get('/api/projects', () => store.listProjects());
api.post('/api/projects', async (req) => store.createProject(await readJson(req)));
api.get('/api/projects/:id', (req, p) => store.getProject(p.id));
api.put('/api/projects/:id', async (req, p) => store.saveProject(p.id, await readJson(req)));
api.delete('/api/projects/:id', (req, p) => {
  store.deleteProject(p.id);
  return { ok: true };
});
api.post('/api/projects/:id/duplicate', (req, p) => store.duplicateProject(p.id));
api.put('/api/projects/:id/thumbnail', async (req, p) => {
  store.saveThumb(p.id, await readBody(req, 8 * 1048576));
  return { ok: true };
});

// ---------------------------------------------------------------- примеры (examples/*.json, только чтение)
function readExample(id) {
  checkId(id);
  const file = join(EXAMPLES_DIR, `${id}.json`);
  if (!existsSync(file)) throw new HttpError(404, 'Пример не найден');
  return JSON.parse(readFileSync(file, 'utf8'));
}
api.get('/api/examples', () => {
  if (!existsSync(EXAMPLES_DIR)) return [];
  return readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const e = JSON.parse(readFileSync(join(EXAMPLES_DIR, f), 'utf8'));
        return { id: e.id, order: e.order, title: e.title, description: e.description, group: e.group, template: e.project?.template };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
});
api.get('/api/examples/:id', (req, p) => readExample(p.id));
api.post('/api/examples/:id/copy', (req, p) => {
  const e = readExample(p.id);
  return store.createProject({ ...e.project, title: e.project.title || e.title });
});

// ---------------------------------------------------------------- мои шаблоны
api.get('/api/presets', () => store.listPresets());
api.post('/api/presets', async (req) => store.createPreset(await readJson(req)));
api.delete('/api/presets/:id', (req, p) => {
  store.deletePreset(p.id);
  return { ok: true };
});

// ---------------------------------------------------------------- карты
api.get('/api/maps', () => store.listMaps());
api.get('/api/maps/:id', (req, p) => store.getMap(p.id));
api.post('/api/maps', async (req) => store.createMap(await readJson(req, 200 * 1048576)));
api.delete('/api/maps/:id', (req, p) => {
  store.deleteMap(p.id);
  return { ok: true };
});

// ---------------------------------------------------------------- базы данных
api.get('/api/db/drivers', () => driverStatus());
api.get('/api/db/connections', () => dbs.list());
api.post('/api/db/connections', async (req) => dbs.create(await readJson(req)));
api.put('/api/db/connections/:id', async (req, p) => dbs.update(p.id, await readJson(req)));
api.delete('/api/db/connections/:id', (req, p) => {
  dbs.remove(p.id);
  return { ok: true };
});
api.get('/api/db/connections/:id/tables', (req, p) => dbs.tables(p.id));
api.post('/api/db/connections/:id/test', (req, p) => dbs.test(p.id));
api.post('/api/db/connections/:id/query', async (req, p) => {
  const { sql, limit } = await readJson(req);
  return dbs.query(p.id, sql, limit);
});
// Загрузка файла SQLite (тело запроса — сам файл)
api.post('/api/db/upload', async (req, p, url) => {
  const original = basename(url.searchParams.get('name') || 'database.sqlite').replace(/[^\p{L}\p{N}._-]+/gu, '_');
  const buf = await readBody(req, 1024 * 1048576);
  if (buf.subarray(0, 16).toString('latin1') !== 'SQLite format 3\0') {
    throw new HttpError(400, 'Файл не является базой SQLite');
  }
  const file = store.databaseFile(`${newId()}_${original}`);
  writeFileSync(file, buf);
  if (!isSqliteFile(file)) throw new HttpError(400, 'Не удалось сохранить базу');
  return dbs.create({ type: 'sqlite', name: original.replace(extname(original), ''), file });
});

// ---------------------------------------------------------------- загрузка данных по URL (интранет-API, CSV, JSON)
api.get('/api/fetch', async (req, p, url, res) => {
  const target = url.searchParams.get('url') || '';
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw new HttpError(400, 'Некорректный адрес');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new HttpError(400, 'Поддерживаются только http(s)-адреса');
  // адреса служб метаданных облаков/гипервизоров (link-local) — не загружаем
  if (/^(169\.254\.|\[?fe80:)/i.test(parsed.hostname) || /^metadata(\.google\.internal)?$/i.test(parsed.hostname)) {
    throw new HttpError(400, 'Этот адрес запрещён');
  }
  let r;
  try {
    r = await fetch(parsed, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
  } catch (e) {
    throw new HttpError(502, `Не удалось загрузить: ${e.cause?.code || e.message}`);
  }
  if (!r.ok) throw new HttpError(502, `Источник ответил ${r.status} ${r.statusText}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 100 * 1048576) throw new HttpError(413, 'Файл больше 100 МБ');
  res.writeHead(200, {
    'Content-Type': r.headers.get('content-type') || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(buf);
  return undefined;
});

// ---------------------------------------------------------------- HTTP-сервер
function authorized(req) {
  if (!AUTH) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const given = Buffer.from(h.slice(6), 'base64');
  return given.length === AUTH.length && timingSafeEqual(given, AUTH);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (!authorized(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Visualization Studio", charset="UTF-8"' });
    res.end('Требуется авторизация');
    return;
  }

  try {
    if (path.startsWith('/api/')) {
      const m = api.match(req.method, path);
      if (!m) throw new HttpError(404, 'Метод API не найден');
      const result = await m.handler(req, m.params, url, res);
      if (result !== undefined) sendJson(res, 200, result);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Метод не поддерживается');

    if (path.startsWith('/thumbs/')) {
      const id = checkId(basename(path, '.png'));
      if (serveFile(req, res, store.paths.thumbs, `${id}.png`)) return;
      throw new HttpError(404, 'Нет миниатюры');
    }
    if (path.startsWith('/custom-templates/')) {
      if (serveFile(req, res, CUSTOM_TEMPLATES_DIR, decodeURIComponent(path.slice(18)))) return;
      throw new HttpError(404, 'Шаблон не найден');
    }
    if (/^\/view\/[^/]+$/.test(path)) {
      serveFile(req, res, PUBLIC_DIR, 'view.html');
      return;
    }
    const rel = path === '/' ? 'index.html' : decodeURIComponent(path);
    const cache = rel.startsWith('/vendor/') || rel.startsWith('/maps/') ? 'public, max-age=86400' : 'no-cache';
    if (serveFile(req, res, PUBLIC_DIR, rel, { cache })) return;
    // SPA: любые неизвестные пути без расширения отдаём index.html
    if (!extname(rel)) {
      serveFile(req, res, PUBLIC_DIR, 'index.html');
      return;
    }
    throw new HttpError(404, 'Не найдено');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) sendJson(res, status, { error: e.message || 'Внутренняя ошибка' });
    else res.end();
  }
});

const drivers = await loadDrivers();
server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST;
  const list = Object.entries(drivers).filter(([, v]) => v).map(([k]) => k).join(', ') || 'нет';
  console.log(`\n  Visualization Studio запущена: http://${shown}:${PORT}`);
  console.log(`  Данные: ${DATA_DIR}`);
  console.log(`  Драйверы БД: ${list}`);
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !AUTH) {
    console.log('  ⚠ Сервер доступен из сети без пароля. Задайте AUTH_USER и AUTH_PASS для защиты.');
  }
  console.log('');
});

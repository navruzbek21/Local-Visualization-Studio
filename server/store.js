// Файловое хранилище: проекты, пользовательские шаблоны, карты, подключения к БД.
// Всё лежит в каталоге data/ в виде JSON — легко бэкапить и переносить.
import { randomBytes } from 'node:crypto';
import {
  mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync, existsSync, statSync,
} from 'node:fs';
import { join } from 'node:path';
import { HttpError } from './http.js';

const ID_RE = /^[a-z0-9_-]{4,64}$/i;

export function newId() {
  return Date.now().toString(36) + randomBytes(5).toString('hex');
}

export function checkId(id) {
  if (!ID_RE.test(id)) throw new HttpError(400, 'Некорректный идентификатор');
  return id;
}

export function writeAtomic(file, data, mode) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, data, mode ? { mode } : undefined);
  renameSync(tmp, file);
}

export class Store {
  constructor(dataDir) {
    this.dir = dataDir;
    this.paths = {
      projects: join(dataDir, 'projects'),
      thumbs: join(dataDir, 'thumbs'),
      presets: join(dataDir, 'presets'),
      maps: join(dataDir, 'maps'),
      databases: join(dataDir, 'databases'),
    };
    for (const p of Object.values(this.paths)) mkdirSync(p, { recursive: true });
    this.connectionsFile = join(dataDir, 'connections.json');
  }

  // ---------- общие коллекции JSON-документов ----------
  #list(kind, summarize) {
    const dir = this.paths[kind];
    const out = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const doc = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        out.push(summarize ? summarize(doc) : doc);
      } catch {
        /* битый файл пропускаем */
      }
    }
    return out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }
  #get(kind, id) {
    const file = join(this.paths[kind], `${checkId(id)}.json`);
    if (!existsSync(file)) throw new HttpError(404, 'Не найдено');
    return JSON.parse(readFileSync(file, 'utf8'));
  }
  #put(kind, doc) {
    writeAtomic(join(this.paths[kind], `${checkId(doc.id)}.json`), JSON.stringify(doc));
    return doc;
  }
  #delete(kind, id) {
    const file = join(this.paths[kind], `${checkId(id)}.json`);
    if (!existsSync(file)) throw new HttpError(404, 'Не найдено');
    unlinkSync(file);
  }

  // ---------- проекты ----------
  listProjects() {
    return this.#list('projects', (p) => ({
      id: p.id,
      title: p.title,
      template: p.template,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      rows: p.data?.rows?.length ?? 0,
      hasThumb: existsSync(join(this.paths.thumbs, `${p.id}.png`)),
    }));
  }
  getProject(id) {
    return this.#get('projects', id);
  }
  createProject(body) {
    const now = new Date().toISOString();
    const doc = { ...body, id: newId(), createdAt: now, updatedAt: now };
    if (!doc.title) doc.title = 'Без названия';
    return this.#put('projects', doc);
  }
  saveProject(id, body) {
    const prev = this.getProject(id);
    const doc = { ...body, id, createdAt: prev.createdAt, updatedAt: new Date().toISOString() };
    return this.#put('projects', doc);
  }
  deleteProject(id) {
    this.#delete('projects', id);
    const thumb = join(this.paths.thumbs, `${id}.png`);
    if (existsSync(thumb)) unlinkSync(thumb);
  }
  duplicateProject(id) {
    const src = this.getProject(id);
    const copy = this.createProject({ ...src, title: `${src.title} (копия)` });
    const thumb = join(this.paths.thumbs, `${id}.png`);
    if (existsSync(thumb)) writeFileSync(join(this.paths.thumbs, `${copy.id}.png`), readFileSync(thumb));
    return copy;
  }
  saveThumb(id, pngBuffer) {
    if (!existsSync(join(this.paths.projects, `${checkId(id)}.json`))) throw new HttpError(404, 'Не найдено');
    if (pngBuffer.subarray(1, 4).toString() !== 'PNG') throw new HttpError(400, 'Ожидается PNG');
    writeAtomic(join(this.paths.thumbs, `${id}.png`), pngBuffer);
  }

  // ---------- пользовательские шаблоны (пресеты) ----------
  listPresets() {
    return this.#list('presets');
  }
  createPreset(body) {
    const now = new Date().toISOString();
    return this.#put('presets', { ...body, id: newId(), createdAt: now, updatedAt: now });
  }
  deletePreset(id) {
    this.#delete('presets', id);
  }

  // ---------- пользовательские карты (GeoJSON) ----------
  listMaps() {
    return this.#list('maps', (m) => ({
      id: m.id,
      name: m.name,
      updatedAt: m.updatedAt,
      features: m.geojson?.features?.length ?? 0,
      properties: m.properties ?? [],
    }));
  }
  getMap(id) {
    return this.#get('maps', id);
  }
  createMap({ name, geojson }) {
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      throw new HttpError(400, 'Нужен GeoJSON типа FeatureCollection');
    }
    const props = new Set();
    for (const f of geojson.features.slice(0, 200)) Object.keys(f.properties || {}).forEach((k) => props.add(k));
    const now = new Date().toISOString();
    return this.#put('maps', {
      id: newId(), name: name || 'Карта', geojson, properties: [...props], createdAt: now, updatedAt: now,
    });
  }
  deleteMap(id) {
    this.#delete('maps', id);
  }

  // ---------- подключения к БД ----------
  readConnections() {
    if (!existsSync(this.connectionsFile)) return [];
    try {
      return JSON.parse(readFileSync(this.connectionsFile, 'utf8'));
    } catch {
      return [];
    }
  }
  writeConnections(list) {
    writeAtomic(this.connectionsFile, JSON.stringify(list, null, 2), 0o600);
  }
  databaseFile(name) {
    return join(this.paths.databases, name);
  }
  fileSize(path) {
    try {
      return statSync(path).size;
    } catch {
      return null;
    }
  }
}

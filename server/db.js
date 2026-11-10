// Подключения к локальным/корпоративным БД. Все запросы — только на чтение.
// SQLite работает «из коробки» (node:sqlite, Node ≥ 22.13).
// PostgreSQL / MySQL / MS SQL подключаются, если установлены пакеты pg / mysql2 / mssql.
import { openSync, readSync, closeSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { HttpError } from './http.js';
import { newId, checkId } from './store.js';

const DEFAULT_LIMIT = 50000;
const MAX_LIMIT = 500000;
const READ_ONLY_START = /^\s*(?:--[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*(select|with|values|pragma|show|explain|describe|desc)\b/i;
const WRITE_WORDS = /\b(insert|update|delete|merge|drop|alter|create|truncate|grant|revoke|exec|execute|into)\b/i;

const drivers = {};

async function tryImport(name) {
  try {
    return await import(name);
  } catch {
    return null;
  }
}

export async function loadDrivers() {
  const sqlite = await tryImport('node:sqlite');
  drivers.sqlite = sqlite?.DatabaseSync ? sqlite : null;
  drivers.postgres = await tryImport('pg');
  drivers.mysql = await tryImport('mysql2/promise');
  drivers.mssql = await tryImport('mssql');
  return driverStatus();
}

export function driverStatus() {
  return {
    sqlite: !!drivers.sqlite,
    postgres: !!drivers.postgres,
    mysql: !!drivers.mysql,
    mssql: !!drivers.mssql,
  };
}

export function isSqliteFile(path) {
  if (!existsSync(path)) return false;
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(16);
    readSync(fd, buf, 0, 16, 0);
    return buf.toString('latin1') === 'SQLite format 3\0';
  } finally {
    closeSync(fd);
  }
}

function assertReadOnly(sql, strict) {
  if (!READ_ONLY_START.test(sql)) {
    throw new HttpError(400, 'Разрешены только запросы на чтение (SELECT / WITH)');
  }
  // SQLite открывается в режиме readOnly, PostgreSQL/MySQL — в READ ONLY транзакции.
  // Для MS SQL такой гарантии нет, поэтому дополнительно запрещаем «пишущие» слова вне строк.
  if (!strict) return;
  const stripped = sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|\[[^\]]*\]/g, '');
  if (WRITE_WORDS.test(stripped)) {
    throw new HttpError(400, 'Запрос содержит команды изменения данных — разрешено только чтение');
  }
}

function normalizeValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'bigint') return Number.isSafeInteger(Number(v)) ? Number(v) : v.toString();
  if (v instanceof Date) return isNaN(v) ? '' : v.toISOString().replace('T00:00:00.000Z', '').replace('.000Z', 'Z');
  if (Buffer.isBuffer(v) || v instanceof Uint8Array) return '[двоичные данные]';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function toTable(columns, objects, limit) {
  const truncated = objects.length > limit;
  const rows = objects.slice(0, limit).map((o) => columns.map((c) => normalizeValue(o[c])));
  return { columns, rows, truncated };
}

// ---------------------------------------------------------------- SQLite
function sqliteOpen(conn) {
  if (!drivers.sqlite) throw new HttpError(501, 'SQLite недоступен: нужен Node.js ≥ 22.13');
  if (!isSqliteFile(conn.file)) throw new HttpError(400, `Файл не найден или не является базой SQLite: ${conn.file}`);
  return new drivers.sqlite.DatabaseSync(conn.file, { readOnly: true });
}

const sqlite = {
  async tables(conn) {
    const db = sqliteOpen(conn);
    try {
      const list = db
        .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all();
      return list.map((t) => ({
        name: t.name,
        type: t.type,
        columns: db.prepare(`PRAGMA table_info("${t.name.replace(/"/g, '""')}")`).all().map((c) => c.name),
      }));
    } finally {
      db.close();
    }
  },
  async query(conn, sql, limit) {
    const db = sqliteOpen(conn);
    try {
      const stmt = db.prepare(sql);
      const columns = stmt.columns().map((c) => c.name);
      const objects = [];
      for (const row of stmt.iterate()) {
        objects.push(row);
        if (objects.length > limit) break;
      }
      return toTable(columns, objects, limit);
    } finally {
      db.close();
    }
  },
};

// ---------------------------------------------------------------- PostgreSQL
const postgres = {
  async client(conn) {
    if (!drivers.postgres) throw new HttpError(501, 'Драйвер PostgreSQL не установлен: npm install pg');
    const { Client } = drivers.postgres.default ?? drivers.postgres;
    const client = new Client({
      host: conn.host, port: Number(conn.port) || 5432, database: conn.database,
      user: conn.user, password: conn.password, ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
      statement_timeout: 60000, connectionTimeoutMillis: 10000,
    });
    await client.connect();
    return client;
  },
  async run(conn, sql) {
    const client = await this.client(conn);
    try {
      await client.query('BEGIN READ ONLY');
      const r = await client.query(sql);
      await client.query('ROLLBACK');
      return r;
    } finally {
      await client.end().catch(() => {});
    }
  },
  async tables(conn) {
    const r = await this.run(conn, `SELECT table_schema, table_name, string_agg(column_name, '|' ORDER BY ordinal_position) AS cols
      FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema')
      GROUP BY table_schema, table_name ORDER BY table_schema, table_name`);
    return r.rows.map((t) => ({
      name: t.table_schema === 'public' ? t.table_name : `${t.table_schema}.${t.table_name}`,
      type: 'table', columns: t.cols.split('|'),
    }));
  },
  async query(conn, sql, limit) {
    const r = await this.run(conn, sql);
    return toTable(r.fields.map((f) => f.name), r.rows, limit);
  },
};

// ---------------------------------------------------------------- MySQL / MariaDB
const mysql = {
  async run(conn, sql) {
    if (!drivers.mysql) throw new HttpError(501, 'Драйвер MySQL не установлен: npm install mysql2');
    const c = await drivers.mysql.createConnection({
      host: conn.host, port: Number(conn.port) || 3306, database: conn.database,
      user: conn.user, password: conn.password, connectTimeout: 10000, dateStrings: true,
    });
    try {
      await c.query('START TRANSACTION READ ONLY');
      const [rows, fields] = await c.query({ sql, timeout: 60000 });
      await c.query('ROLLBACK');
      return { rows, fields };
    } finally {
      await c.end().catch(() => {});
    }
  },
  async tables(conn) {
    const { rows } = await this.run(conn, `SELECT table_name AS t, GROUP_CONCAT(column_name ORDER BY ordinal_position SEPARATOR '|') AS cols
      FROM information_schema.columns WHERE table_schema = DATABASE() GROUP BY table_name ORDER BY table_name`);
    return rows.map((r) => ({ name: r.t, type: 'table', columns: String(r.cols).split('|') }));
  },
  async query(conn, sql, limit) {
    const { rows, fields } = await this.run(conn, sql);
    return toTable(fields.map((f) => f.name), rows, limit);
  },
};

// ---------------------------------------------------------------- MS SQL Server
const mssql = {
  async run(conn, sql) {
    if (!drivers.mssql) throw new HttpError(501, 'Драйвер MS SQL не установлен: npm install mssql');
    const lib = drivers.mssql.default ?? drivers.mssql;
    const pool = await new lib.ConnectionPool({
      server: conn.host, port: Number(conn.port) || 1433, database: conn.database,
      user: conn.user, password: conn.password, requestTimeout: 60000, connectionTimeout: 10000,
      options: { encrypt: !!conn.ssl, trustServerCertificate: true },
    }).connect();
    try {
      return await pool.request().query(sql);
    } finally {
      await pool.close().catch(() => {});
    }
  },
  async tables(conn) {
    const r = await this.run(conn, `SELECT TABLE_SCHEMA s, TABLE_NAME t, COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`);
    const map = new Map();
    for (const row of r.recordset) {
      const name = row.s === 'dbo' ? row.t : `${row.s}.${row.t}`;
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(row.c);
    }
    return [...map].map(([name, columns]) => ({ name, type: 'table', columns }));
  },
  async query(conn, sql, limit) {
    const r = await this.run(conn, sql);
    const columns = Object.keys(r.recordset.columns || r.recordset[0] || {});
    return toTable(columns, r.recordset, limit);
  },
};

const engines = { sqlite, postgres, mysql, mssql };

// ---------------------------------------------------------------- API-фасад
export class Databases {
  constructor(store) {
    this.store = store;
  }

  #public(c) {
    const { password, ...rest } = c;
    return { ...rest, hasPassword: !!password, size: c.type === 'sqlite' ? this.store.fileSize(c.file) : undefined };
  }

  list() {
    return this.store.readConnections().map((c) => this.#public(c));
  }

  #find(id) {
    checkId(id);
    const c = this.store.readConnections().find((x) => x.id === id);
    if (!c) throw new HttpError(404, 'Подключение не найдено');
    return c;
  }

  #validate(c) {
    if (!engines[c.type]) throw new HttpError(400, 'Неизвестный тип БД');
    if (c.type === 'sqlite') {
      if (!c.file) throw new HttpError(400, 'Укажите путь к файлу SQLite');
      if (!isSqliteFile(c.file)) throw new HttpError(400, `Файл не найден или не является базой SQLite: ${c.file}`);
    } else if (!c.host) {
      throw new HttpError(400, 'Укажите адрес сервера');
    }
  }

  create(body) {
    const c = {
      id: newId(),
      name: String(body.name || '').trim() || basename(body.file || body.host || 'БД'),
      type: body.type,
      file: body.file, host: body.host, port: body.port, database: body.database,
      user: body.user, password: body.password, ssl: !!body.ssl,
      createdAt: new Date().toISOString(),
    };
    this.#validate(c);
    const list = this.store.readConnections();
    list.push(c);
    this.store.writeConnections(list);
    return this.#public(c);
  }

  update(id, body) {
    const list = this.store.readConnections();
    const i = list.findIndex((x) => x.id === checkId(id));
    if (i < 0) throw new HttpError(404, 'Подключение не найдено');
    const next = { ...list[i] };
    for (const k of ['name', 'file', 'host', 'port', 'database', 'user', 'ssl']) if (k in body) next[k] = body[k];
    if (body.password) next.password = body.password; // пустой пароль = не менять
    this.#validate(next);
    list[i] = next;
    this.store.writeConnections(list);
    return this.#public(next);
  }

  remove(id) {
    const list = this.store.readConnections();
    const c = list.find((x) => x.id === checkId(id));
    if (!c) throw new HttpError(404, 'Подключение не найдено');
    this.store.writeConnections(list.filter((x) => x.id !== id));
    return c;
  }

  async tables(id) {
    const c = this.#find(id);
    return engines[c.type].tables(c);
  }

  async query(id, sql, limit) {
    const c = this.#find(id);
    sql = String(sql || '').trim().replace(/;\s*$/, '');
    if (!sql) throw new HttpError(400, 'Пустой запрос');
    assertReadOnly(sql, c.type === 'mssql');
    const lim = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    try {
      return await engines[c.type].query(c, sql, lim);
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, `Ошибка запроса: ${e.message}`);
    }
  }

  async test(id) {
    const c = this.#find(id);
    try {
      const tables = await engines[c.type].tables(c);
      return { ok: true, tables: tables.length };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, `Не удалось подключиться: ${e.message}`);
    }
  }
}

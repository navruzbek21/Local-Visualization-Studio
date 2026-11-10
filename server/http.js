// Мини-роутер и утилиты HTTP поверх node:http — без внешних зависимостей.
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class Router {
  constructor() {
    this.routes = [];
  }
  add(method, pattern, handler) {
    const keys = [];
    const re = new RegExp(
      '^' +
        pattern.replace(/\/:(\w+)/g, (_, k) => {
          keys.push(k);
          return '/([^/]+)';
        }) +
        '$'
    );
    this.routes.push({ method, re, keys, handler });
  }
  get(p, h) { this.add('GET', p, h); }
  post(p, h) { this.add('POST', p, h); }
  put(p, h) { this.add('PUT', p, h); }
  delete(p, h) { this.add('DELETE', p, h); }

  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(pathname);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { handler: r.handler, params };
    }
    return null;
  }
}

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, `Слишком большой запрос (лимит ${Math.round(limit / 1048576)} МБ)`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req, limit = 64 * 1048576) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'Некорректный JSON');
  }
}

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(text);
}

// Безопасная раздача файлов из каталога (защита от выхода за пределы root).
export function serveFile(req, res, root, relPath, { cache = 'no-cache' } = {}) {
  const safe = normalize(relPath).replace(/^([/\\])+/, '');
  const full = join(root, safe);
  if (!full.startsWith(root + sep) && full !== root) return false;
  let st;
  try {
    st = statSync(full);
  } catch {
    return false;
  }
  if (st.isDirectory()) return false;
  const etag = `"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304);
    res.end();
    return true;
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(full).toLowerCase()] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': cache,
    ETag: etag,
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(full).pipe(res);
  return true;
}

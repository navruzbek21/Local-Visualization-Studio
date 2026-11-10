// Обёртки над REST API локального сервера.

async function request(method, url, body, opts = {}) {
  const init = { method, headers: {} };
  if (body instanceof Blob || body instanceof ArrayBuffer) {
    init.body = body;
    init.headers['Content-Type'] = opts.type || 'application/octet-stream';
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  let r;
  try {
    r = await fetch(url, init);
  } catch {
    throw new Error('Сервер недоступен. Проверьте, что Visualization Studio запущена.');
  }
  const isJson = (r.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await r.json() : await r.text();
  if (!r.ok) throw new Error((data && data.error) || `Ошибка ${r.status}`);
  return data;
}

export const api = {
  templates: () => request('GET', '/api/templates'),
  health: () => request('GET', '/api/health'),

  projects: () => request('GET', '/api/projects'),
  project: (id) => request('GET', `/api/projects/${encodeURIComponent(id)}`),
  createProject: (p) => request('POST', '/api/projects', p),
  saveProject: (id, p) => request('PUT', `/api/projects/${encodeURIComponent(id)}`, p),
  deleteProject: (id) => request('DELETE', `/api/projects/${encodeURIComponent(id)}`),
  duplicateProject: (id) => request('POST', `/api/projects/${encodeURIComponent(id)}/duplicate`),
  saveThumb: (id, blob) => request('PUT', `/api/projects/${encodeURIComponent(id)}/thumbnail`, blob, { type: 'image/png' }),

  examples: () => request('GET', '/api/examples'),
  example: (id) => request('GET', `/api/examples/${encodeURIComponent(id)}`),
  copyExample: (id) => request('POST', `/api/examples/${encodeURIComponent(id)}/copy`),

  presets: () => request('GET', '/api/presets'),
  createPreset: (p) => request('POST', '/api/presets', p),
  deletePreset: (id) => request('DELETE', `/api/presets/${encodeURIComponent(id)}`),

  maps: () => request('GET', '/api/maps'),
  createMap: (m) => request('POST', '/api/maps', m),
  deleteMap: (id) => request('DELETE', `/api/maps/${encodeURIComponent(id)}`),

  drivers: () => request('GET', '/api/db/drivers'),
  connections: () => request('GET', '/api/db/connections'),
  createConnection: (c) => request('POST', '/api/db/connections', c),
  updateConnection: (id, c) => request('PUT', `/api/db/connections/${encodeURIComponent(id)}`, c),
  deleteConnection: (id) => request('DELETE', `/api/db/connections/${encodeURIComponent(id)}`),
  testConnection: (id) => request('POST', `/api/db/connections/${encodeURIComponent(id)}/test`),
  tables: (id) => request('GET', `/api/db/connections/${encodeURIComponent(id)}/tables`),
  query: (id, sql, limit) => request('POST', `/api/db/connections/${encodeURIComponent(id)}/query`, { sql, limit }),
  uploadSqlite: (file) => request('POST', `/api/db/upload?name=${encodeURIComponent(file.name)}`, file),

  // Загрузка по URL через сервер (обходит CORS); возвращает Response
  async fetchUrl(url) {
    let r;
    try {
      r = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`);
    } catch {
      throw new Error('Сервер недоступен');
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `Ошибка ${r.status}`);
    }
    return r;
  },
};

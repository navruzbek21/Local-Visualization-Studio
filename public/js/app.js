// Точка входа: загрузка шаблонов и маршрутизация (#/, #/presets, #/sources, #/edit/:id).
import { h, toast } from './ui.js';
import { api } from './api.js';
import { renderHome } from './home.js';
import { openEditor } from './editor.js';

const root = document.getElementById('app');
let cleanup = null;

async function boot() {
  root.appendChild(h('div.empty-state', 'Загрузка…'));
  try {
    const t = await api.templates();
    await window.VS.loadScripts([...t.builtin, ...t.custom]);
  } catch (e) {
    root.innerHTML = '';
    root.appendChild(h('div.empty-state', h('h3', 'Не удалось запустить студию'), h('p', e.message)));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

async function route() {
  if (cleanup) {
    const c = cleanup;
    cleanup = null;
    try {
      c();
    } catch (e) {
      console.error(e);
    }
  }
  const hash = location.hash.replace(/^#/, '') || '/';
  const m = /^\/edit\/([^/]+)$/.exec(hash);
  try {
    if (m) cleanup = await openEditor(root, decodeURIComponent(m[1]));
    else if (hash === '/examples') await renderHome(root, 'examples');
    else if (hash === '/presets') await renderHome(root, 'presets');
    else if (hash === '/sources') await renderHome(root, 'sources');
    else await renderHome(root, 'projects');
  } catch (e) {
    console.error(e);
    toast(e.message, 'error');
  }
}

window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast(e.reason?.message || String(e.reason), 'error');
});

boot();

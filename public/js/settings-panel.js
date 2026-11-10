// Панель настроек, генерируемая по схеме шаблона (VS.sectionsFor).
import { h, icon, button, debounce } from './ui.js';

const openSections = new Set(['layout']);

export function renderSettings(container, { tpl, settings, onChange, env }) {
  const VS = window.VS;
  container.innerHTML = '';
  const controls = [];
  let current = VS.resolveSettings(tpl, settings);

  const search = h('input.input.sm', { type: 'search', placeholder: 'Найти настройку…', 'aria-label': 'Поиск по настройкам' });
  container.appendChild(h('div.side-search', search));

  const sections = VS.sectionsFor(tpl);
  const sectionEls = [];
  sections.forEach((sec, i) => {
    const det = h('details.section', { open: openSections.has(sec.id) || (i === 0 && !openSections.size) });
    det.addEventListener('toggle', () => {
      if (search.value) return;
      if (det.open) openSections.add(sec.id);
      else openSections.delete(sec.id);
    });
    const content = h('div.content');
    det.append(h('summary', sec.title, icon('chev', 'chev')), content);
    sec.items.forEach((item) => {
      const el = control(item);
      if (!el) return;
      content.appendChild(el);
      controls.push({ item, el, section: det });
    });
    container.appendChild(det);
    sectionEls.push(det);
  });

  function set(key, value, opts) {
    current = { ...current, [key]: value };
    onChange(key, value, opts);
    updateVisibility();
  }

  // show(settings, bindings) — видимость зависит от настроек и привязанных колонок
  const bindings = () => (env && env.bindings ? env.bindings() : {}) || {};

  function updateVisibility() {
    const q = search.value.trim().toLowerCase();
    const b = bindings();
    const secVisible = sections.map((sec) => !sec.show || sec.show(current, b));
    for (const { item, el } of controls) {
      let vis = !item.show || item.show(current, b);
      if (q && item.type !== 'heading') vis = vis && (item.label || '').toLowerCase().includes(q);
      if (q && item.type === 'heading') vis = false;
      el.hidden = !vis;
    }
    if (q) {
      sectionEls.forEach((d, i) => {
        const any = secVisible[i] && controls.some((c) => c.section === d && !c.el.hidden);
        d.hidden = !any;
        d.open = any;
      });
    } else {
      sectionEls.forEach((d, i) => {
        d.hidden = !secVisible[i];
        d.open = openSections.has(sections[i].id);
      });
    }
  }
  search.addEventListener('input', updateVisibility);

  // ------------------------------------------------------------ элементы управления
  function wrap(item, input, inline) {
    return h('div.ctl', { class: inline ? 'inline' : '' },
      h('div.lbl', item.label),
      input,
      item.help && !inline ? h('div.help', item.help) : null,
    );
  }

  function control(item) {
    const v = current[item.key];
    switch (item.type) {
      case 'heading':
        return h('div.ctl-heading', item.label);

      case 'text': {
        const inp = h('input.input', { type: 'text', placeholder: item.placeholder || '' });
        inp.value = v ?? '';
        const commit = debounce(() => set(item.key, inp.value, { history: true }), 600);
        inp.addEventListener('input', () => {
          onChange(item.key, inp.value, { transient: true });
          current = { ...current, [item.key]: inp.value };
          updateVisibility();
          commit();
        });
        return wrap(item, inp);
      }

      case 'textarea': {
        const inp = h('textarea.textarea', { rows: 3, placeholder: item.placeholder || '' });
        inp.value = v ?? '';
        const commit = debounce(() => set(item.key, inp.value, { history: true }), 600);
        inp.addEventListener('input', () => {
          onChange(item.key, inp.value, { transient: true });
          current = { ...current, [item.key]: inp.value };
          commit();
        });
        return wrap(item, inp);
      }

      case 'code': {
        const inp = h('textarea.textarea.code-area', { spellcheck: false });
        inp.value = v ?? '';
        const apply = debounce(() => set(item.key, inp.value, { history: true }), 700);
        inp.addEventListener('input', apply);
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const s = inp.selectionStart;
            inp.setRangeText('  ', s, inp.selectionEnd, 'end');
            apply();
          }
        });
        return wrap(item, inp);
      }

      case 'number': {
        const inp = h('input.input', { type: 'number', min: item.min, max: item.max, step: item.step || 1 });
        inp.value = v ?? '';
        inp.addEventListener('change', () => set(item.key, inp.value === '' ? '' : Number(inp.value), { history: true }));
        return wrap(item, inp);
      }

      case 'range': {
        const r = h('input', { type: 'range', min: item.min, max: item.max, step: item.step || 1 });
        const n = h('input.input.sm', { type: 'number', min: item.min, max: item.max, step: item.step || 1 });
        r.value = n.value = v ?? item.default;
        r.addEventListener('input', () => {
          n.value = r.value;
          onChange(item.key, Number(r.value), { transient: true });
          current = { ...current, [item.key]: Number(r.value) };
        });
        r.addEventListener('change', () => set(item.key, Number(r.value), { history: true }));
        n.addEventListener('change', () => {
          r.value = n.value;
          set(item.key, Number(n.value), { history: true });
        });
        return wrap(item, h('div.range-row', r, n));
      }

      case 'toggle': {
        const inp = h('input', { type: 'checkbox', checked: !!v });
        inp.addEventListener('change', () => set(item.key, inp.checked, { history: true }));
        const el = h('label.ctl.inline', h('span.lbl', item.label), h('span.switch', inp, h('span')));
        if (item.help) el.title = item.help;
        return el;
      }

      case 'select': {
        const sel = h('select.select', item.options.map(([val, label]) => h('option', { value: val }, label)));
        sel.value = v ?? '';
        sel.addEventListener('change', () => set(item.key, sel.value, { history: true }));
        return wrap(item, sel);
      }

      case 'radio': {
        const seg = h('div.seg', { role: 'radiogroup' });
        item.options.forEach(([val, label]) => {
          const b = h('button', { type: 'button', role: 'radio', title: label }, label);
          if (String(val) === String(v)) b.classList.add('active');
          b.onclick = () => {
            seg.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
            b.classList.add('active');
            set(item.key, val, { history: true });
          };
          seg.appendChild(b);
        });
        return wrap(item, seg);
      }

      case 'color': {
        const pick = h('input', { type: 'color' });
        const txt = h('input.input', { type: 'text', spellcheck: false });
        pick.value = toHex6(v);
        txt.value = v ?? '';
        pick.addEventListener('input', () => {
          txt.value = pick.value;
          onChange(item.key, pick.value, { transient: true });
        });
        pick.addEventListener('change', () => set(item.key, pick.value, { history: true }));
        txt.addEventListener('change', () => {
          if (/^#[0-9a-f]{3,8}$/i.test(txt.value.trim()) || txt.value.trim() === '') {
            pick.value = toHex6(txt.value.trim());
            set(item.key, txt.value.trim(), { history: true });
          }
        });
        return wrap(item, h('div.color-row', pick, txt));
      }

      case 'palette':
      case 'scale': {
        const list = item.type === 'palette' ? VS.palettes : VS.scales;
        const box = h('div.palettes');
        Object.entries(list).forEach(([id, p]) => {
          const b = h('button.palette-opt', { type: 'button' },
            h('span.swatches', p.colors.slice(0, 8).map((c) => h('i', { style: { background: c } }))),
            h('span', p.name));
          if (id === v) b.classList.add('active');
          b.onclick = () => {
            box.querySelectorAll('.palette-opt').forEach((x) => x.classList.remove('active'));
            b.classList.add('active');
            set(item.key, id, { history: true });
          };
          box.appendChild(b);
        });
        return wrap(item, box);
      }

      case 'map': {
        const sel = h('select.select');
        const fill = () => {
          sel.innerHTML = '';
          Object.entries(VS.mapSources).forEach(([id, m]) => sel.appendChild(h('option', { value: id }, m.name)));
          (env.maps || []).forEach((m) => sel.appendChild(h('option', { value: 'custom:' + m.id }, m.name + ' (' + m.features + ')')));
          sel.value = current[item.key] || 'world';
        };
        fill();
        sel.addEventListener('change', () => set(item.key, sel.value, { history: true }));
        const up = button('Загрузить GeoJSON…', {
          icon: 'upload', cls: 'sm',
          onClick: async () => {
            const m = await env.uploadMap?.();
            if (m) {
              fill();
              sel.value = 'custom:' + m.id;
              set(item.key, sel.value, { history: true });
              set('map.nameProp', '', { history: false });
            }
          },
        });
        return wrap({ ...item, help: 'Свои карты (регионы, районы, филиалы) — файлы GeoJSON' }, h('div.stack', sel, up));
      }

      case 'mapprop': {
        const sel = h('select.select');
        const fill = () => {
          const src = current['map.source'] || 'world';
          let props = [];
          if (src === 'world') props = ['name_ru', 'name', 'name_official', 'iso2', 'iso3'];
          else {
            const m = (env.maps || []).find((x) => 'custom:' + x.id === src);
            props = m ? m.properties : [];
          }
          sel.innerHTML = '';
          sel.appendChild(h('option', { value: '' }, 'По умолчанию'));
          props.forEach((p) => sel.appendChild(h('option', { value: p }, p)));
          sel.value = current[item.key] || '';
        };
        fill();
        sel.addEventListener('focus', fill);
        sel.addEventListener('change', () => set(item.key, sel.value, { history: true }));
        return wrap(item, sel);
      }

      default:
        return null;
    }
  }

  updateVisibility();
  return {
    // внешние изменения (например, undo) — обновляем значения без пересборки
    refresh(nextSettings) {
      renderSettings(container, { tpl, settings: nextSettings, onChange, env });
    },
  };
}

function toHex6(v) {
  const s = String(v || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s.slice(1).replace(/./g, '$&$&');
  if (/^#[0-9a-f]{8}$/i.test(s)) return s.slice(0, 7);
  return '#ffffff';
}

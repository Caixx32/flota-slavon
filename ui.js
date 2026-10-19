'use strict';

/* Piezas de la interfaz: íconos, avisos breves, hojas, formularios y fotos. */

const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
  doc: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9.5 13h6M9.5 17h6"/>',
  car: '<path d="M4 16.5l1.6-5.1A2 2 0 0 1 7.5 10h9a2 2 0 0 1 1.9 1.4l1.6 5.1V19h-2.5v-1.5h-11V19H4z"/><path d="M4 16.5h16"/><path d="M7 7.5l1-1.5h8l1 1.5"/>',
  van: '<path d="M2.5 16.5V8a2 2 0 0 1 2-2h9.5l4 4.5 3 1.2a1 1 0 0 1 .5.9v3.9h-2"/><path d="M14 6v4.5h4M2.5 16.5h2.2M10 16.5h6"/><circle cx="7.3" cy="16.8" r="2.1"/><circle cx="18.6" cy="16.8" r="2.1"/><path d="M6 10.5h5"/>',
  moto: '<circle cx="5.5" cy="16" r="3.2"/><circle cx="18.5" cy="16" r="3.2"/><path d="M5.5 16l4-6h4.5l4.5 6M14 10l-1.5-3.5H10M15 7h3l1 2.5"/><path d="M9.5 10l2.5 6h3"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3M7 7h4"/>',
  gauge: '<path d="M12 14l4-4M3.5 18a9 9 0 1 1 17 0"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  road: '<path d="M8 3L4 21M16 3l4 18M12 4v3M12 10v3M12 16v3"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10"/>',
  ticket: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M9 10h6M9 14h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  alert: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  clip: '<path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15 6.9"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4"/><path d="M12 8v4.5l3 2"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  building: '<path d="M4 21V5l8-2v18M12 8h8v13M2 21h20M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/>',
  stop: '<circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
  dollar: '<path d="M12 3v18M16.5 7.5c-.8-1.3-2.4-2-4.5-2-2.5 0-4 1.3-4 3s1.4 2.5 4 3 4 1.4 4 3.2-1.6 3.3-4 3.3c-2.2 0-3.8-.8-4.6-2.2"/>',
  google: '<path d="M21 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-7z" fill="#4285f4" stroke="none"/><path d="M12 21.5c2.6 0 4.7-.9 6.3-2.3l-3.1-2.4c-.9.6-2 .9-3.2.9-2.5 0-4.6-1.7-5.3-3.9H3.5v2.5A9.5 9.5 0 0 0 12 21.5z" fill="#34a853" stroke="none"/><path d="M6.7 13.8a5.7 5.7 0 0 1 0-3.6V7.7H3.5a9.5 9.5 0 0 0 0 8.6z" fill="#fbbc05" stroke="none"/><path d="M12 6.3c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9.5 9.5 0 0 0 3.5 7.7l3.2 2.5C7.4 8 9.5 6.3 12 6.3z" fill="#ea4335" stroke="none"/>',
};

function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll('svg[data-icon]').forEach((svg) => {
    svg.outerHTML = icon(svg.dataset.icon);
  });
}

const vehicleIcon = (v) => (v?.type === 'moto' ? 'moto' : v?.type === 'auto' ? 'car' : 'van');

function badge(st) {
  return `<span class="badge ${st.level}">${esc(st.label)}</span>`;
}

function statusBadge(v) {
  const lvl = { disponible: 'ok', uso: 'uso', taller: 'warn' }[v.status] || 'none';
  return `<span class="badge ${lvl}">${esc(VEHICLE_STATUS[v.status] || 'Disponible')}</span>`;
}

function pageHead(title, text = '', eyebrow = '') {
  return `<div class="page-head">${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<h1>${esc(title)}</h1>${text ? `<p>${text}</p>` : ''}</div>`;
}

function segmented(name, options, value) {
  return `<div class="seg" role="tablist">${Object.entries(options).map(([k, label]) => `<button type="button" data-seg="${name}" data-value="${k}" class="${k === value ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
}

/* ---------- Aviso breve ---------- */

const toastEl = document.getElementById('toast');
let toastTimer = null;

function toast(msg, { error = false, ms = 3500 } = {}) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('error', error);
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}

/* ---------- Fotos guardadas (vehículos, tableros, tickets, papeles) ---------- */

const urlCache = new Map(); // id del archivo → URL de objeto (dura toda la sesión)

async function attachmentUrl(meta) {
  if (urlCache.has(meta.id)) return urlCache.get(meta.id);
  const url = URL.createObjectURL(await loadAttachment(meta));
  urlCache.set(meta.id, url);
  return url;
}

// Completa las fotos de vehículo de la pantalla: <div class="vphoto" data-vphoto="id">
function fillVehiclePhotos(root = document) {
  root.querySelectorAll('[data-vphoto]').forEach(async (el) => {
    const v = byId(state.vehicles, el.dataset.vphoto);
    if (!v?.photo) return;
    try {
      el.style.backgroundImage = `url("${await attachmentUrl(v.photo)}")`;
      el.innerHTML = '';
    } catch (e) {
      // queda el ícono
    }
  });
}

function vphoto(v, big = false) {
  return `<div class="vphoto ${big ? 'big' : ''}" data-vphoto="${v.id}">${icon(vehicleIcon(v))}</div>`;
}

function attachmentSlots(files, caption = null) {
  return files.filter(Boolean).map((f) => `<div class="att-view" data-att="${f.id}">${caption ? `<div class="cap">${esc(caption)}</div>` : ''}<div class="sub">Cargando ${esc(f.name || 'foto')}…</div></div>`).join('');
}

async function fillAttachments(container, files) {
  for (const meta of files.filter(Boolean)) {
    const slot = container.querySelector(`[data-att="${meta.id}"]`);
    if (!slot) continue;
    const cap = slot.querySelector('.cap')?.outerHTML || '';
    try {
      const url = await attachmentUrl(meta);
      if (meta.type.startsWith('image/')) {
        slot.innerHTML = `${cap}<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${esc(meta.name)}"></a>`;
      } else {
        slot.innerHTML = `${cap}${window.innerWidth >= 700 ? `<iframe src="${url}" title="${esc(meta.name)}"></iframe>` : ''}
          <a class="btn dark" href="${url}" target="_blank" rel="noopener">${icon('external')}Abrir PDF «${esc(meta.name)}»</a>`;
      }
    } catch (e) {
      slot.innerHTML = `${cap}<div class="sub">No se pudo abrir: ${esc(e.message)}</div>`;
    }
  }
}

/* ---------- Hoja inferior (detalles) ---------- */

const sheet = document.getElementById('sheet');
const sheetBody = document.getElementById('sheet-body');
let sheetHandler = null;
let sheetRefresh = null; // función para volver a dibujar la hoja cuando cambian los datos

function openSheet(html, { onClick = null, refresh = null } = {}) {
  sheetBody.innerHTML = html;
  sheetHandler = onClick;
  sheetRefresh = refresh;
  if (!sheet.open) sheet.showModal();
  fillVehiclePhotos(sheetBody);
}

function closeSheet() {
  if (sheet.open) sheet.close();
}

sheet.addEventListener('close', () => {
  sheetHandler = null;
  sheetRefresh = null;
});

sheet.addEventListener('click', (ev) => {
  if (ev.target === sheet || ev.target.closest('[data-sheet-close]')) {
    closeSheet();
    return;
  }
  if (ev.target.closest('a[href]')) return;
  if (sheetHandler) sheetHandler(ev);
});

/* ---------- Formularios ---------- */

const modal = document.getElementById('modal');
const modalForm = document.getElementById('modal-form');
const modalFields = document.getElementById('modal-fields');
const modalDelete = document.getElementById('modal-delete');
const modalSave = document.getElementById('modal-save');
const modalError = document.getElementById('modal-error');
let modalHandlers = {};
let formFiles = null;   // adjuntos múltiples (papeles, multas, gastos)
let formPhotos = {};    // fotos obligatorias por campo (tablero, ticket, vehículo)

/*
 * fields: [{ name, label, type, value, required, options, hint, min, step, placeholder, disabled, capture }]
 * Tipos: text, number, date, time, datetime, select, textarea, hidden, check, email, photo, files, html
 * onSubmit(values) puede tirar un Error: el mensaje se muestra arriba de los botones y el formulario queda abierto.
 */
function openForm({ title, fields, onSubmit, onDelete, onInput, submitLabel = 'Guardar', deleteLabel = 'Eliminar' }) {
  document.getElementById('modal-title').textContent = title;
  formFiles = null;
  formPhotos = {};
  modalFields.innerHTML = fields.map(fieldHtml).join('');
  modalDelete.hidden = !onDelete;
  modalDelete.textContent = deleteLabel;
  modalSave.disabled = false;
  modalSave.textContent = submitLabel;
  modalSave.dataset.label = submitLabel;
  modalError.hidden = true;
  modalHandlers = { onSubmit, onDelete, onInput };
  const filesField = fields.find((f) => f.type === 'files');
  if (filesField) initFilesField(filesField.value || []);
  for (const f of fields.filter((x) => x.type === 'photo' && x.value)) {
    formPhotos[f.name] = { existing: f.value };
    showPhotoPreview(f.name, f.value);
  }
  if (sheet.open) closeSheet();
  modal.showModal();
  if (onInput) onInput(modalForm);
}

function fieldHtml(f) {
  const req = f.required ? ' <span class="req">*</span>' : '';
  if (f.type === 'html') return f.html;
  if (f.type === 'photo') {
    return `
      <div class="field photo-field" data-photo-field="${f.name}">
        <span>${esc(f.label)}${req}</span>
        <label class="photo-box" data-photo-box="${f.name}">
          ${icon('camera')}<span data-photo-text>${esc(f.placeholder || 'Tocá para sacar la foto')}</span>
          <input type="file" accept="image/*" ${f.capture === false ? '' : 'capture="environment"'} hidden data-photo-input="${f.name}">
        </label>
        <small data-hint="${f.name}">${esc(f.hint || '')}</small>
      </div>`;
  }
  if (f.type === 'files') {
    return `
      <div class="field files-field">
        <span>${esc(f.label)}</span>
        <div class="att-list"></div>
        <div class="actions" style="margin-top:8px">
          <label class="btn small">${icon('camera')}Sacar foto<input type="file" accept="image/*" capture="environment" hidden data-add-files></label>
          <label class="btn small">${icon('clip')}Adjuntar foto o PDF<input type="file" accept="image/*,application/pdf" multiple hidden data-add-files></label>
        </div>
        <small class="att-msg"></small>
      </div>`;
  }
  if (f.type === 'check') {
    return `<label class="check"><input type="checkbox" name="${f.name}" ${f.value ? 'checked' : ''} ${f.disabled ? 'disabled' : ''}><span>${esc(f.label)}</span></label>`;
  }
  if (f.type === 'hidden') return `<input type="hidden" name="${f.name}" value="${esc(f.value ?? '')}">`;
  const type = f.type === 'datetime' ? 'datetime-local' : f.type === 'number' ? 'text' : (f.type || 'text');
  const attrs = [
    `name="${f.name}"`,
    f.required ? 'required' : '',
    f.disabled ? 'disabled' : '',
    f.min != null ? `min="${f.min}"` : '',
    f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '',
    f.type === 'number' ? `inputmode="${f.step === 1 ? 'numeric' : 'decimal'}" autocomplete="off"` : '',
  ].join(' ');
  let control;
  if (f.type === 'select') {
    control = `<select ${attrs}>${Object.entries(f.options).map(([k, label]) => `<option value="${esc(k)}" ${String(k) === String(f.value ?? '') ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    control = `<textarea ${attrs} rows="3">${esc(f.value)}</textarea>`;
  } else {
    control = `<input type="${type}" value="${esc(f.value ?? '')}" ${attrs}>`;
  }
  return `<label class="field" data-field="${f.name}" ${f.hidden ? 'hidden' : ''}><span>${esc(f.label)}${req}</span>${control}<small data-hint="${f.name}">${esc(f.hint || '')}</small></label>`;
}

function setHint(name, text, cls = '') {
  const el = modalFields.querySelector(`[data-hint="${name}"]`);
  if (!el) return;
  el.textContent = text || '';
  el.className = cls;
}

function showField(name, show) {
  const el = modalFields.querySelector(`[data-field="${name}"]`);
  if (el) el.hidden = !show;
}

async function showPhotoPreview(name, metaOrBlob) {
  const box = modalFields.querySelector(`[data-photo-box="${name}"]`);
  if (!box) return;
  try {
    const url = metaOrBlob instanceof Blob ? URL.createObjectURL(metaOrBlob) : await attachmentUrl(metaOrBlob);
    box.style.backgroundImage = `url("${url}")`;
    box.classList.add('has');
  } catch (e) {
    // sin vista previa
  }
}

modalFields.addEventListener('change', async (ev) => {
  const photoInput = ev.target.closest('[data-photo-input]');
  if (photoInput) {
    const name = photoInput.dataset.photoInput;
    const file = photoInput.files[0];
    photoInput.value = '';
    if (!file) return;
    setHint(name, 'Procesando foto…');
    try {
      const att = await prepareAttachment(file, { imagesOnly: true });
      formPhotos[name] = { ...(formPhotos[name] || {}), added: att };
      showPhotoPreview(name, att.blob);
      setHint(name, `Foto lista (${Math.round(att.meta.size / 1024)} KB). Tocá de nuevo para cambiarla.`, '');
    } catch (e) {
      setHint(name, e.message, 'error');
    }
    return;
  }
  if (ev.target.matches('[data-add-files]')) {
    const files = [...ev.target.files];
    ev.target.value = '';
    const msg = modalFields.querySelector('.att-msg');
    msg.textContent = 'Procesando…';
    const errors = [];
    for (const file of files) {
      try {
        formFiles.added.push(await prepareAttachment(file));
      } catch (e) {
        errors.push(e.message);
      }
    }
    msg.textContent = errors.join(' ');
    msg.classList.toggle('error', errors.length > 0);
    renderFormFiles();
  }
  if (modalHandlers.onInput) modalHandlers.onInput(modalForm, ev);
});

modalFields.addEventListener('input', (ev) => {
  if (modalHandlers.onInput) modalHandlers.onInput(modalForm, ev);
});

function initFilesField(existing) {
  formFiles = { existing: [...existing], removed: [], added: [] };
  renderFormFiles();
}

async function renderFormFiles() {
  const list = modalFields.querySelector('.att-list');
  if (!list || !formFiles) return;
  const items = [
    ...formFiles.existing.map((m) => ({ meta: m, blob: null })),
    ...formFiles.added,
  ];
  list.innerHTML = items.length ? items.map(({ meta }) => `
    <div class="att-thumb" data-thumb="${meta.id}">
      <div class="att-prev">${meta.type.startsWith('image/') ? '' : icon('doc')}</div>
      <div class="att-name">${esc(meta.name)}<br><span class="sub">${Math.round(meta.size / 1024)} KB</span></div>
      <button type="button" class="btn icon-only ghost" data-remove-att="${meta.id}" aria-label="Quitar">${icon('close')}</button>
    </div>`).join('') : '<div class="sub">Sin archivos todavía.</div>';
  for (const { meta, blob } of items) {
    if (!meta.type.startsWith('image/')) continue;
    try {
      const url = blob ? URL.createObjectURL(blob) : await attachmentUrl(meta);
      const prev = list.querySelector(`[data-thumb="${meta.id}"] .att-prev`);
      if (prev) prev.style.backgroundImage = `url("${url}")`;
    } catch (e) {
      // sin vista previa
    }
  }
}

modalFields.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-remove-att]');
  if (!b) return;
  const id = b.dataset.removeAtt;
  const ex = formFiles.existing.find((m) => m.id === id);
  if (ex) {
    formFiles.existing = formFiles.existing.filter((m) => m !== ex);
    formFiles.removed.push(ex);
  } else {
    formFiles.added = formFiles.added.filter((a) => a.meta.id !== id);
  }
  renderFormFiles();
});

// Operaciones para guardar los adjuntos nuevos y borrar los quitados, y la lista final.
async function commitFormFiles(kind) {
  if (!formFiles) return { ops: [], files: [] };
  const ops = [];
  for (const att of formFiles.added) ops.push(...await attachmentOps(att, kind));
  for (const m of formFiles.removed) ops.push(...removeAttachmentOps(m));
  return { ops, files: [...formFiles.existing, ...formFiles.added.map((a) => a.meta)] };
}

// Foto obligatoria: devuelve { meta, ops } con la foto nueva (o la que ya estaba).
async function commitFormPhoto(name, kind) {
  const p = formPhotos[name];
  if (!p) return { meta: null, ops: [] };
  if (!p.added) return { meta: p.existing || null, ops: [] };
  const ops = await attachmentOps(p.added, kind);
  if (p.existing) ops.push(...removeAttachmentOps(p.existing));
  return { meta: p.added.meta, ops };
}

const hasPhoto = (name) => !!(formPhotos[name]?.added || formPhotos[name]?.existing);

class FormError extends Error {}

modalForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const values = Object.fromEntries(new FormData(modalForm).entries());
  modalForm.querySelectorAll('input[type=checkbox]').forEach((c) => { values[c.name] = c.checked; });
  // Campos obligatorios vacíos
  const missing = [...modalForm.querySelectorAll('[required]')].filter((el) => !el.disabled && !String(el.value).trim() && !el.closest('[hidden]'));
  if (missing.length) {
    showFormError(`Completá: ${missing.map((el) => el.closest('.field')?.querySelector('span')?.textContent.replace('*', '').trim()).join(', ')}.`);
    missing[0].focus();
    return;
  }
  modalSave.disabled = true;
  modalSave.textContent = 'Guardando…';
  try {
    if ((await modalHandlers.onSubmit(values)) === false) return;
    modal.close();
    scheduleRender();
  } catch (e) {
    if (e instanceof FormError) showFormError(e.message);
    else {
      console.error(e);
      showFormError(`No se pudo guardar: ${e.message}`);
    }
  } finally {
    modalSave.disabled = false;
    modalSave.textContent = modalSave.dataset.label || 'Guardar';
  }
});

function showFormError(msg) {
  modalError.textContent = msg;
  modalError.hidden = false;
  modalError.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

document.getElementById('modal-cancel').addEventListener('click', () => modal.close());

modalDelete.addEventListener('click', async () => {
  if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
  await modalHandlers.onDelete();
  modal.close();
  scheduleRender();
});

/* ---------- Descargas ---------- */

function download(name, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar (¿sin internet?).'));
    document.head.appendChild(s);
  });
}

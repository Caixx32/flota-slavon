'use strict';

/* Datos de Flota Slavon: constantes, utilidades, fotos, dólar, estados, avisos y calendario. */

const RATE_KEY = 'flota-dolar';        // última cotización del dólar blue conocida
const DEVICE_KEY = 'flota-dispositivo'; // preferencias de este dispositivo

const ROLES = { admin: 'Admin', encargado: 'Encargado', chofer: 'Chofer' };
const VEHICLE_TYPES = { utilitario: 'Utilitario', moto: 'Moto', auto: 'Auto' };
const VEHICLE_STATUS = { disponible: 'Disponible', uso: 'En uso', taller: 'En taller' };
const USO_STATUS = { abierto: 'En curso', cerrado: 'Cerrado', sin_cerrar: 'Sin cerrar' };
const FINE_STATUS = { pendiente: 'Pendiente', pagada: 'Pagada', descargo: 'En descargo' };

const CATEGORIES = {
  combustible: { label: 'Combustible', icon: 'fuel', color: '#3987e5' },
  service: { label: 'Service y taller', icon: 'wrench', color: '#d95926' },
  seguro: { label: 'Seguro', icon: 'shield', color: '#c98500' },
  patente: { label: 'Patente', icon: 'receipt', color: '#d55181' },
  vtv: { label: 'VTV', icon: 'check', color: '#199e70' },
  peaje: { label: 'Peajes y estacionamiento', icon: 'road', color: '#008300' },
  multa: { label: 'Multas', icon: 'ticket', color: '#e66767' },
  otro: { label: 'Otro', icon: 'box', color: '#8b95a5' },
};

const DEFAULT_CONFIG = { openHours: 12, maxKmUso: 500, kmTolerance: 0 };

// Tareas de service por tipo de vehículo: [nombre, cada km, cada meses]
const DEFAULT_TASKS = {
  utilitario: [
    ['Aceite y filtro de aceite', 10000, 12],
    ['Filtro de aire', 20000, 24],
    ['Filtro de habitáculo', 15000, 12],
    ['Rotación de neumáticos', 10000, 0],
    ['Líquido de frenos', 0, 24],
    ['Correa de distribución', 60000, 60],
  ],
  moto: [
    ['Aceite y filtro de aceite', 4000, 6],
    ['Kit de arrastre / cadena', 15000, 0],
    ['Lubricar y tensar cadena', 1000, 0],
    ['Filtro de aire', 10000, 12],
    ['Bujía', 10000, 12],
    ['Frenos (pastillas y líquido)', 10000, 24],
  ],
};
DEFAULT_TASKS.auto = DEFAULT_TASKS.utilitario;

const DEFAULT_DOCS = [
  ['Cédula verde / azul', 30],
  ['Seguro', 15],
  ['VTV', 30],
  ['Patente', 10],
];

// Avisar cuando falte este margen para un vencimiento.
const SOON_KM_RATIO = 0.1;
const SOON_KM_MAX = 1000;
const SOON_DAYS = 30;
const FINE_SOON_DAYS = 10;

// Fotos comprimidas en el navegador (máx. 1600 px, JPEG 0,7) y PDF hasta 3 MB.
const IMAGE_MAX_PX = 1600;
const IMAGE_QUALITY = 0.7;
const IMAGE_MAX_BYTES = 900 * 1024;
const PDF_MAX_BYTES = 3 * 1024 * 1024;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- Formatos ---------- */

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', currencyDisplay: 'code', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

function fmtUsd(n) {
  return usd.format(n).replace('USD', 'US$').replace(/\s+/, ' ');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function today() {
  return toISO(new Date());
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addMonths(iso, months) {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

function addDays(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function daysUntil(iso) {
  return Math.round((parseISO(iso) - parseISO(today())) / 86400000);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return parseISO(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtTime(ms) {
  return ms ? new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function fmtKm(n) {
  return n == null ? '—' : `${Math.round(n).toLocaleString('es-AR')} km`;
}

function fmtHours(h) {
  if (h == null) return '—';
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return hh ? `${hh} h ${String(mm).padStart(2, '0')} min` : `${mm} min`;
}

function daysText(days) {
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days === -1) return 'ayer';
  return days > 0 ? `en ${days} días` : `hace ${-days} días`;
}

function numOrNull(v) {
  if (v === '' || v == null) return null;
  let s = String(v).trim();
  // «1.234,5» (con coma decimal) → 1234.5 ; «1234.5» queda igual
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  // «57.750» o «1.234.567» (puntos de miles, sin coma) → 57750
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Para <input type="datetime-local">
function toLocalInput(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${toISO(d)}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromLocalInput(v) {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function levelOrder(level) {
  return { bad: 0, warn: 1, none: 2, ok: 3 }[level];
}

/* ---------- Preferencias del dispositivo ---------- */

function loadDevice() {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

const device = loadDevice();

function saveDevice() {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
  } catch (e) {
    // sin almacenamiento: las preferencias duran hasta cerrar
  }
}

/* ---------- Estado ---------- */

const state = {
  me: null,           // { email, name, role }
  config: { ...DEFAULT_CONFIG },
  vehicles: [],
  obras: [],
  usos: [],           // admin/encargado: todos. chofer: sólo sus usos abiertos.
  expenses: [],
  tasks: [],
  docs: [],
  fines: [],
  users: [],
};

const isStaff = () => state.me && (state.me.role === 'admin' || state.me.role === 'encargado');
const isAdmin = () => state.me && state.me.role === 'admin';

const byId = (list, id) => list.find((x) => x.id === id);
const activeVehicles = () => state.vehicles.filter((v) => v.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
const vehicleName = (id) => byId(state.vehicles, id)?.name || 'Vehículo dado de baja';

function stamp() {
  return { email: state.me.email, name: state.me.name || state.me.email };
}

/* ---------- Fotos y PDF ---------- */

function idb(mode_, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('flota-slavon', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('files', mode_);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

const idbGet = (key) => idb('readonly', (s) => s.get(key)).catch(() => null);
const idbPut = (key, val) => idb('readwrite', (s) => s.put(val, key)).catch(() => null);
const idbDel = (key) => idb('readwrite', (s) => s.delete(key)).catch(() => null);

function loadImage(file) {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadImageElement(file));
  }
  return loadImageElement(file);
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = URL.createObjectURL(file);
  });
}

async function compressImage(file) {
  const img = await loadImage(file);
  let maxPx = IMAGE_MAX_PX;
  let quality = IMAGE_QUALITY;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (blob && blob.size <= IMAGE_MAX_BYTES) return blob;
    maxPx = Math.round(maxPx * 0.8);
    quality = Math.max(0.5, quality - 0.08);
  }
  throw new Error('La foto no se pudo achicar lo suficiente.');
}

// Devuelve { meta, blob } listo para guardar, o tira un error con un mensaje para mostrar.
async function prepareAttachment(file, { imagesOnly = false } = {}) {
  const meta = { id: uid(), name: file.name || 'foto', type: file.type, size: 0, added: today() };
  let blob;
  if (file.type.startsWith('image/')) {
    blob = await compressImage(file);
    meta.type = 'image/jpeg';
    meta.name = meta.name.replace(/\.\w+$/, '') + '.jpg';
  } else if (!imagesOnly && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) {
    if (file.size > PDF_MAX_BYTES) {
      throw new Error(`«${file.name}» pesa ${(file.size / 1048576).toFixed(1)} MB y el máximo para un PDF es ${PDF_MAX_BYTES / 1048576} MB. Sacale una foto al papel o achicá el PDF y probá de nuevo.`);
    }
    blob = file;
    meta.type = 'application/pdf';
  } else {
    throw new Error(imagesOnly ? `«${file.name}» no es una foto.` : `«${file.name}» no es una foto ni un PDF.`);
  }
  meta.size = blob.size;
  return { meta, blob };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// Guarda el archivo en el dispositivo y devuelve las operaciones para subirlo junto con el registro.
async function attachmentOps(att, kind) {
  await idbPut(`att:${att.meta.id}`, att.blob);
  const { ops, n } = FlotaCloud.fileOps(att.meta.id, await blobToBase64(att.blob), { kind, owner: state.me.email });
  att.meta.chunks = n;
  return ops;
}

async function loadAttachment(meta) {
  const cached = await idbGet(`att:${meta.id}`);
  if (cached) return cached;
  if (!meta.chunks) throw new Error('El archivo no está disponible.');
  const blob = base64ToBlob(await FlotaCloud.getFile(meta.id, meta.chunks), meta.type);
  idbPut(`att:${meta.id}`, blob);
  return blob;
}

function removeAttachmentOps(meta) {
  if (!meta) return [];
  idbDel(`att:${meta.id}`);
  return meta.chunks ? FlotaCloud.delFileOps(meta.id, meta.chunks) : [];
}

/* ---------- Dólar blue ---------- */

function lastRate() {
  try {
    return JSON.parse(localStorage.getItem(RATE_KEY));
  } catch (e) {
    return null;
  }
}

async function fetchBlueRate() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue', { signal: ctrl.signal, cache: 'no-store' });
    const data = await res.json();
    const value = Number(data.venta);
    if (!value) throw new Error('Respuesta sin cotización');
    localStorage.setItem(RATE_KEY, JSON.stringify({ value, date: today() }));
    return value;
  } finally {
    clearTimeout(timer);
  }
}

// Cotización para un gasto. Es aproximada si no es del mismo día del gasto o si no hubo internet.
async function rateFor(dateISO) {
  try {
    const value = await fetchBlueRate();
    return { usdRate: value, rateApprox: dateISO !== today() };
  } catch (e) {
    const last = lastRate();
    return last ? { usdRate: last.value, rateApprox: true } : { usdRate: null, rateApprox: false };
  }
}

function inUsd(e) {
  return e.usdRate ? (Number(e.amount) || 0) / e.usdRate : null;
}

/* ---------- Estado de service, papeles y multas ---------- */

function taskNextDate(t) {
  return t.everyMonths > 0 && t.lastDate ? addMonths(t.lastDate, t.everyMonths) : null;
}

function recomputeLast(t) {
  const sorted = [...(t.history || [])].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.km ?? 0) - (b.km ?? 0));
  const last = sorted[sorted.length - 1];
  t.lastDate = last ? last.date : null;
  t.lastKm = last ? last.km : null;
}

function taskStatus(t) {
  const km = byId(state.vehicles, t.vehicleId)?.km || 0;
  if (t.lastKm == null && !t.lastDate) {
    return { level: 'none', label: 'Sin registro', detail: 'Cargá cuándo se hizo por última vez', progress: 0, due: null };
  }
  const parts = [];
  let level = 'ok';
  let progress = 0;
  if (t.everyKm > 0 && t.lastKm != null) {
    const nextKm = t.lastKm + t.everyKm;
    const kmLeft = nextKm - km;
    progress = Math.max(progress, (km - t.lastKm) / t.everyKm);
    parts.push(kmLeft < 0 ? `pasado por ${fmtKm(-kmLeft)}` : `faltan ${fmtKm(kmLeft)} (a los ${fmtKm(nextKm)})`);
    if (kmLeft <= 0) level = 'bad';
    else if (kmLeft <= Math.min(t.everyKm * SOON_KM_RATIO, SOON_KM_MAX)) level = 'warn';
  }
  const nextDate = taskNextDate(t);
  if (nextDate) {
    const daysLeft = daysUntil(nextDate);
    const total = daysUntil(nextDate) - daysUntil(t.lastDate);
    progress = Math.max(progress, total > 0 ? 1 - daysLeft / total : 1);
    parts.push(`${daysLeft < 0 ? 'venció' : 'vence'} ${daysText(daysLeft)} (${fmtDate(nextDate)})`);
    if (daysLeft < 0) level = 'bad';
    else if (daysLeft <= SOON_DAYS && level !== 'bad') level = 'warn';
  }
  if (!parts.length) return { level: 'none', label: 'Incompleto', detail: 'Falta el km o la fecha del último service', progress: 0, due: null };
  const label = { ok: 'Al día', warn: 'Pronto', bad: 'Vencido' }[level];
  return { level, label, detail: parts.join(' · '), progress: Math.min(Math.max(progress, 0), 1), due: nextDate };
}

function intervalText(t) {
  const parts = [];
  if (t.everyKm > 0) parts.push(`cada ${fmtKm(t.everyKm)}`);
  if (t.everyMonths > 0) parts.push(`cada ${t.everyMonths} ${t.everyMonths === 1 ? 'mes' : 'meses'}`);
  return parts.length ? `Se hace ${parts.join(' o ')}` : 'Sin intervalo';
}

function docStatus(d) {
  if (!d.expiry) return { level: 'none', label: 'Sin vencimiento', detail: 'No tiene fecha de vencimiento cargada', days: null, due: null };
  const days = daysUntil(d.expiry);
  const level = days < 0 ? 'bad' : days <= (d.notifyDays ?? SOON_DAYS) ? 'warn' : 'ok';
  const label = { ok: 'Vigente', warn: 'Por vencer', bad: 'Vencido' }[level];
  return { level, label, detail: `${days < 0 ? 'Venció' : 'Vence'} ${daysText(days)} · ${fmtDate(d.expiry)}`, days, due: d.expiry };
}

function fineStatus(f) {
  if (f.status !== 'pendiente' || !f.dueDate) {
    const level = f.status === 'pagada' ? 'ok' : 'none';
    return { level, label: FINE_STATUS[f.status] || 'Pendiente', detail: f.dueDate ? `Vencimiento del pago: ${fmtDate(f.dueDate)}` : 'Sin fecha de pago', due: null };
  }
  const days = daysUntil(f.dueDate);
  const level = days < 0 ? 'bad' : days <= FINE_SOON_DAYS ? 'warn' : 'ok';
  const label = { ok: 'Pendiente', warn: 'Por vencer', bad: 'Vencida' }[level];
  return { level, label, detail: `Pago ${days < 0 ? 'vencido' : 'vence'} ${daysText(days)} · ${fmtDate(f.dueDate)}`, due: f.dueDate };
}

/* ---------- Usos ---------- */

function usoHours(u) {
  if (!u.startAt || !u.endAt) return null;
  return Math.max(0, (u.endAt - u.startAt) / 3600000);
}

function usoKm(u) {
  return u.kmEnd != null && u.kmStart != null ? u.kmEnd - u.kmStart : null;
}

// Problemas de un uso que tiene que revisar un admin o encargado.
function usoIssues(u) {
  const out = [];
  const cfg = state.config;
  if (u.status === 'sin_cerrar') {
    out.push({ level: 'bad', code: 'sin_cerrar', text: `Quedó sin cerrar: ${u.flaggedBy?.name || 'otro chofer'} inició un uso nuevo` });
  }
  if (u.status === 'abierto') {
    const h = (Date.now() - u.startAt) / 3600000;
    if (h > (cfg.openHours || 12)) out.push({ level: 'bad', code: 'abierto', text: `Abierto hace ${fmtHours(h)} (límite ${cfg.openHours} h)` });
  }
  if (u.kmPrev != null && u.kmStart != null && Math.abs(u.kmStart - u.kmPrev) > (cfg.kmTolerance || 0)) {
    const diff = u.kmStart - u.kmPrev;
    out.push({ level: 'warn', code: 'km_subida', text: `Km de subida ${fmtKm(u.kmStart)} y el último de bajada era ${fmtKm(u.kmPrev)} (${diff > 0 ? '+' : ''}${diff.toLocaleString('es-AR')} km)` });
  }
  const km = usoKm(u);
  if (km != null && km > (cfg.maxKmUso || 500)) {
    out.push({ level: 'warn', code: 'km_salto', text: `Recorrió ${fmtKm(km)} en un uso (más de ${fmtKm(cfg.maxKmUso)})` });
  }
  return u.reviewed ? out.filter((i) => i.code === 'abierto') : out;
}

// Quién tenía el vehículo en un momento dado (para las multas).
function driverAt(vehicleId, ms) {
  const u = state.usos
    .filter((x) => x.vehicleId === vehicleId && x.startAt <= ms && (x.endAt ? x.endAt >= ms : true))
    .sort((a, b) => b.startAt - a.startAt)[0];
  return u ? { email: u.driverEmail, name: u.driverName, usoId: u.id } : null;
}

/* ---------- Avisos ---------- */

function alerts() {
  const vActive = new Set(activeVehicles().map((v) => v.id));
  const list = [
    ...state.tasks.filter((t) => vActive.has(t.vehicleId)).map((t) => ({ kind: 'task', item: t, title: `${vehicleName(t.vehicleId)}: ${t.name}`, st: taskStatus(t) })),
    ...state.docs.filter((d) => vActive.has(d.vehicleId)).map((d) => ({ kind: 'doc', item: d, title: `${vehicleName(d.vehicleId)}: ${d.name}`, st: docStatus(d) })),
    ...state.fines.map((f) => ({ kind: 'fine', item: f, title: `Multa ${vehicleName(f.vehicleId)}: ${f.reason || 'sin detalle'}`, st: fineStatus(f) })),
  ].filter((a) => a.st.level === 'bad' || a.st.level === 'warn');
  for (const u of state.usos) {
    for (const issue of usoIssues(u)) {
      list.push({
        kind: 'uso',
        item: u,
        code: issue.code,
        title: `${vehicleName(u.vehicleId)} · ${u.driverName || u.driverEmail}`,
        st: { level: issue.level, label: issue.code === 'sin_cerrar' ? 'Sin cerrar' : issue.code === 'abierto' ? 'Abierto' : 'Km raro', detail: `${issue.text} · ${fmtDateTime(u.startAt)}`, due: null },
      });
    }
  }
  return list.sort((a, b) => levelOrder(a.st.level) - levelOrder(b.st.level));
}

/* ---------- Calendario ---------- */

function deadlines() {
  const out = [];
  const vActive = new Set(activeVehicles().map((v) => v.id));
  for (const t of state.tasks) {
    if (!vActive.has(t.vehicleId)) continue;
    const date = taskNextDate(t);
    if (date) out.push({ key: `task:${t.id}`, title: `Service ${vehicleName(t.vehicleId)}: ${t.name}`, date, notifyDays: SOON_DAYS, details: `Último service: ${fmtDate(t.lastDate)}${t.lastKm != null ? ` a los ${fmtKm(t.lastKm)}` : ''}. ${intervalText(t)}.` });
  }
  for (const d of state.docs) {
    if (vActive.has(d.vehicleId) && d.expiry) out.push({ key: `doc:${d.id}`, title: `Vence ${d.name} (${vehicleName(d.vehicleId)})`, date: d.expiry, notifyDays: d.notifyDays ?? SOON_DAYS, details: [d.number && `Número: ${d.number}`, d.note].filter(Boolean).join('. ') });
  }
  for (const f of state.fines) {
    if (f.status === 'pendiente' && f.dueDate) out.push({ key: `fine:${f.id}`, title: `Pagar multa ${vehicleName(f.vehicleId)}: ${f.reason || ''}`.trim(), date: f.dueDate, notifyDays: FINE_SOON_DAYS, details: f.amount ? `Monto: ${money.format(f.amount)}` : '' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function gcalLink(dl) {
  const start = dl.date.replace(/-/g, '');
  const end = addDays(dl.date, 1).replace(/-/g, '');
  const details = `${dl.details ? `${dl.details}\n\n` : ''}Recordatorio: avisame ${dl.notifyDays} días antes.\nCargado desde Flota Slavon.`;
  const params = new URLSearchParams({ action: 'TEMPLATE', text: dl.title, details });
  return `https://calendar.google.com/calendar/render?${params}&dates=${start}/${end}`;
}

function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
}

function buildIcs(list) {
  const stampNow = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Flota Slavon//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Flota Slavon - vencimientos'];
  for (const dl of list) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${dl.key.replace(':', '-')}@flota-slavon`,
      `DTSTAMP:${stampNow}`,
      `DTSTART;VALUE=DATE:${dl.date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${addDays(dl.date, 1).replace(/-/g, '')}`,
      `SUMMARY:${icsEscape(dl.title)}`,
      `DESCRIPTION:${icsEscape(dl.details)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(dl.title)}`,
      `TRIGGER:-P${Math.max(0, dl.notifyDays)}D`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/* ---------- Notificaciones del navegador (sólo admin y encargado) ---------- */

function notificationsSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

async function notify(title, options) {
  const reg = await navigator.serviceWorker.ready;
  return reg.showNotification(title, { icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', ...options });
}

// Avisa una sola vez cada cambio de estado. El service worker usa la misma clave y firma en segundo plano.
async function checkNotifications() {
  if (!isStaff()) return;
  idbPut('schedule', deadlines());
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  const notified = (await idbGet('notified')) || {};
  const keys = new Set();
  for (const a of alerts()) {
    const key = a.kind === 'uso' ? `uso:${a.item.id}:${a.code}` : `${a.kind}:${a.item.id}`;
    const sig = `${a.st.level}:${a.st.due || ''}`;
    keys.add(key);
    if (notified[key] === sig) continue;
    notified[key] = sig;
    const verb = a.kind === 'uso' ? a.st.label : a.st.level === 'bad' ? 'Vencido' : 'Por vencer';
    try {
      await notify(`${verb}: ${a.title}`, { body: a.st.detail, tag: key, data: { url: './' } });
    } catch (e) {
      // sin permiso o sin service worker: queda el aviso dentro de la app
    }
  }
  for (const k of Object.keys(notified)) if (!keys.has(k)) delete notified[k];
  await idbPut('notified', notified);
}

async function enablePeriodicSync() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!('periodicSync' in reg)) return false;
    const perm = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (perm.state !== 'granted') return false;
    await reg.periodicSync.register('vencimientos', { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch (e) {
    return false;
  }
}

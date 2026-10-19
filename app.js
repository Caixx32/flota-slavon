'use strict';

/* Arranque: login con Google, rol del usuario, sincronización con Firestore y eventos. */

const tabsEl = document.getElementById('tabs');
const authScreen = document.getElementById('auth-screen');
const meBtn = document.getElementById('me-btn');
const OWNER = (FLOTA_CONFIG.ownerEmail || '').toLowerCase();

hydrateIcons();

/* ---------- Dibujar ---------- */

let renderQueued = false;

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function render() {
  if (!state.me) return;
  updateChrome();
  if (!isStaff()) {
    renderDriver();
  } else {
    ({ home: renderHome, usos: renderUsos, vehicles: renderVehicles, reports: renderReports, more: renderMore })[ui.tab]();
    if (sheet.open && sheetRefresh) sheetRefresh();
  }
  fillVehiclePhotos(view);
}

function updateChrome() {
  const staff = isStaff();
  tabsEl.hidden = !staff;
  document.body.classList.toggle('no-tabs', !staff);
  tabsEl.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === ui.tab));
  const initials = (state.me.name || state.me.email).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  meBtn.hidden = false;
  meBtn.innerHTML = `<span class="avatar">${state.me.photoURL ? `<img src="${esc(state.me.photoURL)}" alt="" referrerpolicy="no-referrer">` : esc(initials)}</span><span class="who">${esc(ROLES[state.me.role])}</span>`;
  document.getElementById('offline-chip').hidden = navigator.onLine;
  document.getElementById('pending-chip').hidden = !pendingWrites || !navigator.onLine;
  // Banner y número de avisos sólo para admin y encargado
  const banner = document.getElementById('alert-banner');
  const usosTab = tabsEl.querySelector('[data-tab="usos"]');
  if (staff) {
    const list = alerts();
    const bad = list.filter((a) => a.st.level === 'bad').length;
    banner.hidden = !bad || ui.tab === 'home';
    banner.innerHTML = `${icon('alert')}<span class="grow">${bad} aviso${bad === 1 ? '' : 's'} urgente${bad === 1 ? '' : 's'} para revisar</span>${icon('chev')}`;
    const review = state.usos.filter((u) => usoIssues(u).length).length;
    usosTab.querySelector('.dot')?.remove();
    if (review) usosTab.insertAdjacentHTML('beforeend', `<span class="dot">${review}</span>`);
  } else {
    banner.hidden = true;
  }
}

// Apariencia de este celular: automático (sigue al sistema), claro u oscuro.
function setTheme(theme) {
  device.theme = theme === 'auto' ? undefined : theme;
  saveDevice();
  applyTheme(theme);
}

function goTo(tab) {
  ui.tab = tab;
  if (tab !== 'vehicles') ui.vehicleId = null;
  window.scrollTo(0, 0);
  render();
}

/* ---------- Escrituras pendientes y errores ---------- */

let pendingWrites = 0;
const origWrite = FlotaCloud.write;
FlotaCloud.write = (ops) => {
  pendingWrites++;
  const p = origWrite(ops);
  p.catch(() => {}).finally(() => {
    pendingWrites--;
    scheduleRender();
  });
  scheduleRender();
  return p;
};

FlotaCloud.setWriteErrorHandler((e) => {
  console.warn('Escritura rechazada', e);
  const msg = e.code === 'permission-denied'
    ? 'No se pudo guardar: tu usuario no tiene permiso para eso (o el registro ya estaba cerrado).'
    : `No se pudo guardar (${e.code || e.message}).`;
  toast(msg, { error: true, ms: 7000 });
});

/* ---------- Eventos ---------- */

const actions = {
  'pick-vehicle': (el) => {
    ui.driverVehicle = el.dataset.id;
    render();
    // Lleva los botones a la vista para no tener que buscarlos.
    document.getElementById('driver-actions')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  },
  'go-vehicles': () => goTo('vehicles'),
  'go-reports': () => goTo('reports'),
  'start-uso': (el) => startUsoForm(el.dataset.id || ui.driverVehicle),
  'end-uso': (el) => el.dataset.id && endUsoForm(el.dataset.id),
  'end-uso-pick': () => openEndUsoPicker(),
  fuel: (el) => fuelForm(el.dataset.id || ui.driverVehicle),
  'open-alert': (el) => openAlert(el.dataset.kind, el.dataset.id),
  'all-alerts': () => openAllAlerts(),
  'open-vehicle': (el) => {
    if (!el.dataset.id) return;
    ui.tab = 'vehicles';
    ui.vehicleId = el.dataset.id;
    ui.vehicleSeg = el.dataset.segOpen || 'resumen';
    window.scrollTo(0, 0);
    render();
  },
  'back-vehicles': () => { ui.vehicleId = null; render(); },
  'add-vehicle': () => vehicleForm(null),
  'edit-vehicle': (el) => vehicleForm(el.dataset.id),
  'toggle-active': (el) => toggleVehicleActive(el.dataset.id),
  'toggle-inactive': () => { ui.showInactive = !ui.showInactive; render(); },
  'toggle-taller': (el) => {
    const v = byId(state.vehicles, el.dataset.id);
    FlotaCloud.patch('vehicles', v.id, { status: v.status === 'taller' ? 'disponible' : 'taller', updatedBy: stamp(), updatedAt: FlotaCloud.serverTime() });
  },
  'open-uso': (el) => openUsoSheet(el.dataset.id),
  'open-carga': (el) => openCargaSheet(el.dataset.id),
  'open-task': (el) => openTaskSheet(el.dataset.id),
  'add-task': (el) => taskForm(null, el.dataset.id),
  'open-doc': (el) => openDocSheet(el.dataset.id),
  'add-doc': (el) => docForm(null, el.dataset.id),
  'add-expense': (el) => expenseForm(null, el.dataset.id),
  'edit-expense': (el) => expenseForm(el.dataset.id),
  'open-fine': (el) => openFineSheet(el.dataset.id),
  'add-fine': (el) => fineForm(null, el.dataset.id),
  users: () => openUsersSheet(),
  obras: () => openObrasSheet(),
  config: () => configForm(),
  calendar: () => openCalendarSheet(),
  'enable-notif': () => askNotifications(),
  'refresh-rate': async () => {
    try {
      await fetchBlueRate();
      render();
    } catch (e) {
      toast('No se pudo traer la cotización (¿sin internet?).', { error: true });
    }
  },
  'export-xlsx': () => exportXlsx(false),
  'export-xlsx-all': () => exportXlsx(true),
  'sign-out': async () => {
    if (!confirm('¿Cerrar sesión en este celular?')) return;
    await FlotaCloud.signOut();
  },
};

view.addEventListener('click', (ev) => {
  if (ev.target.closest('a[href]')) return;
  const el = ev.target.closest('[data-action], [data-seg], [data-month], [data-select-month], [data-repmonth]');
  if (!el) return;
  if (el.dataset.action && actions[el.dataset.action]) {
    ev.stopPropagation();
    actions[el.dataset.action](el);
  } else if (el.dataset.seg) {
    const v = el.dataset.value;
    if (el.dataset.seg === 'vseg') ui.vehicleSeg = v;
    else if (el.dataset.seg === 'usosseg') ui.usosSeg = v;
    else if (el.dataset.seg === 'usostatus') ui.usosFilter.status = v;
    else if (el.dataset.seg === 'repmode') rep.mode = v;
    else if (el.dataset.seg === 'currency') { ui.currency = v; device.currency = v; saveDevice(); }
    else if (el.dataset.seg === 'theme') setTheme(v);
    render();
  } else if (el.dataset.selectMonth) {
    if (ui.tab === 'reports') { rep.mode = 'mes'; rep.month = el.dataset.selectMonth; } else ui.expMonth = el.dataset.selectMonth;
    render();
  } else if (el.dataset.month) {
    ui.expMonth = shiftMonth(ui.expMonth, Number(el.dataset.month));
    render();
  } else if (el.dataset.repmonth) {
    rep.month = shiftMonth(rep.month, Number(el.dataset.repmonth));
    render();
  }
});

view.addEventListener('change', (ev) => {
  const f = ev.target.dataset.filter;
  if (f) {
    ui.usosFilter[f] = ev.target.value;
    render();
  }
  const r = ev.target.dataset.rep;
  if (r) {
    rep[r] = ev.target.value;
    render();
  }
});

view.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.getAttribute('role') === 'button') ev.target.click();
});

tabsEl.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tab]');
  if (b) goTo(b.dataset.tab);
});

document.getElementById('alert-banner').addEventListener('click', () => {
  goTo('home');
  setTimeout(() => document.getElementById('attention')?.scrollIntoView({ behavior: 'smooth' }), 50);
});

meBtn.addEventListener('click', () => {
  if (isStaff()) return goTo('more');
  openSheet(`
    <h2>${esc(state.me.name || state.me.email)}</h2>
    <p class="sub">${esc(state.me.email)} · ${esc(ROLES[state.me.role])}</p>
    <p class="sub">Todo lo que cargás se guarda en el celular y se sube solo cuando hay señal. Una vez guardado no se puede modificar: si te equivocaste, avisale al encargado.</p>
    <div class="section-title">Apariencia</div>
    ${segmented('theme', THEMES, device.theme || 'auto')}
    <div class="actions"><button class="btn danger" data-act="out">${icon('logout')}Cerrar sesión</button><span class="spacer"></span><button class="btn ghost" data-sheet-close>Cerrar</button></div>`, {
    onClick: async (ev) => {
      const seg = ev.target.closest('[data-seg="theme"]');
      if (seg) {
        setTheme(seg.dataset.value);
        sheetBody.querySelectorAll('[data-seg="theme"]').forEach((b) => b.classList.toggle('on', b === seg));
        return;
      }
      if (ev.target.closest('[data-act="out"]') && confirm('¿Cerrar sesión en este celular?')) await FlotaCloud.signOut();
    },
  });
});

window.addEventListener('online', scheduleRender);
window.addEventListener('offline', scheduleRender);
initChartTips(view);
// Los avisos por tiempo (uso abierto hace más de N horas) cambian solos: se revisan cada minuto.
setInterval(() => {
  if (!isStaff()) return;
  if (!modal.open) scheduleRender();
  checkNotifications();
}, 60000);

async function askNotifications() {
  if (!notificationsSupported()) {
    alert('Este navegador no permite notificaciones. En iPhone, primero agregá la app a la pantalla de inicio (Compartir → Agregar a inicio).');
    return;
  }
  if (Notification.permission === 'denied') {
    alert('Las notificaciones están bloqueadas para este sitio. Habilitalas desde la configuración del navegador.');
    return;
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    await enablePeriodicSync();
    await checkNotifications();
    toast('Notificaciones activadas.');
  }
  render();
}

/* ---------- Sincronización según el rol ---------- */

let unsubs = [];
let subscribedRole = null;
let notifTimer = null;

function stopData() {
  unsubs.forEach((u) => u());
  unsubs = [];
  subscribedRole = null;
}

function onDataError(e) {
  console.warn('Error de lectura', e);
  if (e.code === 'permission-denied') showAuth('denied', state.me?.email || '');
}

function startData() {
  if (subscribedRole === state.me.role) return;
  stopData();
  subscribedRole = state.me.role;
  const set = (key) => (items) => {
    state[key] = items;
    scheduleRender();
    clearTimeout(notifTimer);
    notifTimer = setTimeout(checkNotifications, 1500);
  };
  unsubs.push(FlotaCloud.subscribe('vehicles', set('vehicles'), onDataError));
  unsubs.push(FlotaCloud.subscribe('obras', set('obras'), onDataError));
  if (isStaff()) {
    for (const c of ['usos', 'expenses', 'tasks', 'docs', 'fines', 'users', 'locks']) unsubs.push(FlotaCloud.subscribe(c, set(c), onDataError));
    unsubs.push(FlotaCloud.subscribeDoc('config', 'general', (data, meta) => {
      state.config = { ...DEFAULT_CONFIG, ...(data || {}) };
      if (!data && !meta.fromCache && state.me.email === OWNER) seedFleet();
      scheduleRender();
    }, onDataError));
  } else {
    // El chofer sólo ve sus usos abiertos (las reglas no le dejan ver más).
    unsubs.push(FlotaCloud.subscribe('usos', set('usos'), onDataError, [['driverEmail', '==', state.me.email], ['status', 'in', ['abierto', 'sin_cerrar']]]));
    unsubs.push(FlotaCloud.subscribeDoc('locks', state.me.email, (data) => {
      state.locks = data ? [data] : [];
      scheduleRender();
    }, onDataError));
    for (const c of ['expenses', 'tasks', 'docs', 'fines', 'users']) state[c] = [];
  }
}

// Primera vez: 2 utilitarios y 1 moto con sus tareas de service y papeles básicos. Después se editan.
// Se crea sólo si el servidor confirma que no hay ningún vehículo (la caché del celular puede estar vacía o vieja).
let seeded = false;
async function seedFleet() {
  if (seeded) return;
  seeded = true;
  let serverVehicles;
  try {
    serverVehicles = await FlotaCloud.getAllFromServer('vehicles');
  } catch (e) {
    seeded = false; // sin señal: se reintenta la próxima vez
    return;
  }
  const ops = [{ op: 'set', col: 'config', id: 'general', data: { ...DEFAULT_CONFIG, seededAt: Date.now(), seededBy: stamp() } }];
  if (!serverVehicles.length) {
    [['Utilitario 1', 'utilitario'], ['Utilitario 2', 'utilitario'], ['Moto', 'moto']].forEach(([name, type], i) => {
      ops.push(...newVehicleOps({ id: uid(), name, type, plate: '', brand: '', year: null, km: 0, status: 'disponible', active: true, openUsoId: null, order: i, photo: null, notes: '', createdBy: stamp(), createdAt: FlotaCloud.serverTime() }));
    });
  }
  FlotaCloud.write(ops);
  if (!serverVehicles.length) toast('Cargué los 3 vehículos de la flota. Editá nombre, patente y km desde «Vehículos».', { ms: 7000 });
}

/* ---------- Ingreso ---------- */

function showAuth(name, detail = '') {
  const msg = {
    loading: ['Conectando…', ''],
    login: ['Entrá con tu cuenta de Google', 'Usá el mail que te dio de alta el administrador.'],
    sync: ['Trayendo los datos…', 'La primera vez puede tardar unos segundos.'],
    denied: ['No tenés acceso', `${detail ? `${detail} no está habilitado. ` : ''}Pedíselo al administrador.`],
    error: ['No se pudo conectar', detail],
  }[name];
  authScreen.querySelector('[data-auth-title]').textContent = msg[0];
  authScreen.querySelector('[data-auth-text]').textContent = msg[1];
  authScreen.querySelector('[data-auth-login]').hidden = name !== 'login';
  authScreen.querySelector('[data-auth-other]').hidden = name !== 'denied';
  authScreen.querySelector('[data-auth-retry]').hidden = name !== 'error';
  authScreen.querySelector('.auth-spinner').hidden = !['loading', 'sync'].includes(name);
  authScreen.querySelector('.auth-emu').hidden = !(FlotaCloud.useEmulator && ['login', 'denied'].includes(name));
  if (name !== 'login') authScreen.querySelector('[data-auth-ios]').hidden = true;
  authScreen.hidden = false;
  if (name === 'denied') {
    stopData();
    state.me = null;
    tabsEl.hidden = true;
    meBtn.hidden = true;
    view.innerHTML = '';
  }
}

authScreen.addEventListener('click', async (ev) => {
  if (ev.target.closest('[data-auth-login]')) {
    // En iPhone con la app instalada, si Google no vuelve en unos segundos, se explica qué hacer.
    clearTimeout(iosTimer);
    if (IS_IOS_STANDALONE) iosTimer = setTimeout(() => { if (!state.me) showIosHelp(); }, 12000);
    try {
      await FlotaCloud.signIn();
    } catch (e) {
      if (IS_IOS_STANDALONE) showIosHelp();
      else if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) showAuth('error', `No se pudo entrar con Google (${e.code || e.message}).`);
    }
  } else if (ev.target.closest('[data-auth-other]')) {
    await FlotaCloud.signOut();
  } else if (ev.target.closest('[data-auth-retry]')) {
    location.reload();
  } else if (ev.target.closest('[data-emu-login]')) {
    const email = authScreen.querySelector('[data-emu-email]').value.trim().toLowerCase();
    if (email) {
      if (FlotaCloud.useEmulator) await FlotaCloud.signOut();
      await FlotaCloud.testSignIn(email);
    }
  }
});

let unsubMe = null;

const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_IOS_STANDALONE = IS_IOS && (navigator.standalone === true || matchMedia('(display-mode: standalone)').matches);
let iosTimer = null;

function showIosHelp() {
  const box = authScreen.querySelector('[data-auth-ios]');
  box.hidden = false;
}

async function start() {
  showAuth('loading');
  try {
    await FlotaCloud.init();
  } catch (e) {
    showAuth('error', 'No se pudo cargar Firebase. Revisá la conexión a internet y probá de nuevo (la primera vez hace falta internet).');
    return;
  }
  FlotaCloud.onAuth((user) => {
    clearTimeout(iosTimer);
    if (unsubMe) { unsubMe(); unsubMe = null; }
    stopData();
    closeSheet();
    if (modal.open) modal.close();
    if (!user) {
      state.me = null;
      tabsEl.hidden = true;
      meBtn.hidden = true;
      view.innerHTML = '';
      showAuth('login');
      return;
    }
    const email = (user.email || '').toLowerCase();
    showAuth('sync');
    let touched = false;
    unsubMe = FlotaCloud.subscribeDoc('users', email, (data, meta) => {
      const owner = email === OWNER;
      if (!data && meta.fromCache) return; // esperar la respuesta del servidor
      if (!data && owner) {
        FlotaCloud.put('users', email, { email, name: user.displayName || '', photoURL: user.photoURL || '', role: 'admin', active: true, addedAt: Date.now(), lastLogin: Date.now() });
        return;
      }
      if (!data || (data.active === false && !owner)) {
        showAuth('denied', email);
        return;
      }
      // El dueño siempre entra: si su documento quedó inactivo o con otro rol, se repara.
      if (owner && (data.active === false || data.role !== 'admin')) FlotaCloud.patch('users', email, { active: true, role: 'admin' });
      state.me = { email, name: data.name || user.displayName || email, role: owner ? 'admin' : data.role, photoURL: user.photoURL || data.photoURL || '' };
      // Completa el nombre y la foto de Google una vez por sesión (las reglas sólo dejan tocar esos campos).
      if (!touched) {
        touched = true;
        const upd = { lastLogin: Date.now() };
        // El nombre lo pone el admin; sólo un admin completa el suyo con el de Google.
        if ((owner || data.role === 'admin') && user.displayName && !data.name) upd.name = user.displayName;
        if (user.photoURL && data.photoURL !== user.photoURL) upd.photoURL = user.photoURL;
        FlotaCloud.patch('users', email, upd);
      }
      if (!isStaff() && ['reports', 'usos', 'vehicles', 'more'].includes(ui.tab)) ui.tab = 'home';
      startData();
      authScreen.hidden = true;
      render();
      if (isStaff() && notificationsSupported() && Notification.permission === 'granted') enablePeriodicSync();
    }, (e) => {
      console.warn(e);
      showAuth(e.code === 'permission-denied' ? 'denied' : 'error', e.code === 'permission-denied' ? email : `No se pudo leer tu usuario (${e.code || e.message}).`);
    });
  });
}

if ('serviceWorker' in navigator && !FlotaCloud.useEmulator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();

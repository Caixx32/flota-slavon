'use strict';

/* Pantallas. El chofer tiene una sola; admin y encargado tienen pestañas. */

const view = document.getElementById('view');
const ui = {
  tab: 'home',
  driverVehicle: null,     // vehículo elegido por el chofer
  vehicleId: null,         // detalle de vehículo abierto (admin/encargado)
  vehicleSeg: 'resumen',
  usosSeg: 'usos',
  usosFilter: { vehicle: '', driver: '', status: 'todos', from: addDays(today(), -30), to: today() },
  showInactive: false,
  expMonth: today().slice(0, 7),
  currency: device.currency || 'ARS',
};

function monthLabel(ym, opts = { month: 'long', year: 'numeric' }) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', opts);
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  return toISO(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

function fmtCur(n, cur) {
  return cur === 'USD' ? fmtUsd(n) : money.format(n);
}

function expenseValue(e, cur) {
  return cur === 'USD' ? (inUsd(e) ?? 0) : (Number(e.amount) || 0);
}

function amountLine(e) {
  const u = inUsd(e);
  return `${money.format(e.amount || 0)}${u != null ? ` <span class="sub">· ${fmtUsd(u)}${e.rateApprox ? ' aprox.' : ''}</span>` : ''}`;
}

/* ===================== CHOFER ===================== */

function renderDriver() {
  const mine = state.usos.filter((u) => u.driverEmail === state.me.email && !u.anulado).sort((a, b) => b.startAt - a.startAt);
  const myLock = lockOf(state.me.email);
  const vehicles = activeVehicles();
  const first = (state.me.name || '').split(' ')[0];
  const hello = `
    <div class="driver-hello">
      <div class="eyebrow">${esc(new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))}</div>
      <h1>Hola${first ? `, ${esc(first)}` : ''}</h1>
    </div>`;

  // 1) Tiene un uso en curso: eso es lo único importante. Terminar uso bien grande y, abajo, cargar nafta.
  if (mine.length) {
    const u = mine[0];
    const unclosed = u.status === 'sin_cerrar';
    view.innerHTML = `
      ${hello}
      <div class="current-uso ${unclosed ? 'unclosed' : ''}">
        <div class="label">Estás usando</div>
        <div class="veh">${esc(u.vehicleName || vehicleName(u.vehicleId))}</div>
        <div class="since">Desde las ${esc(fmtTime(u.startAt))} · subiste con ${esc(fmtKm(u.kmStart))}</div>
        <div class="since">${esc(u.obraName || '')}</div>
        ${unclosed ? '<div class="note">Otra persona tomó el vehículo. Cerralo igual con los km que marcaba cuando lo dejaste.</div>' : ''}
        <button class="go" data-action="end-uso" data-id="${u.id}">${icon('stop')}Terminar uso</button>
      </div>
      <div class="big-actions">
        <button class="big-btn fuel" data-action="fuel" data-id="${u.vehicleId}">
          ${icon('fuel')}<span>Cargar nafta<small>Litros, monto y foto del ticket</small></span>
        </button>
      </div>
      <p class="sub" style="text-align:center;margin-top:16px">Para usar otro vehículo, primero terminá este uso.</p>`;
    return;
  }

  // 2) Hay un candado pero el uso no aparece (por ejemplo, sin señal todavía): avisar en lugar de dejar la pantalla vacía.
  if (myLock) {
    view.innerHTML = `
      ${hello}
      <div class="card flag-warn">
        <div class="name">Tenés un uso abierto en ${esc(vehicleName(myLock.vehicleId))}</div>
        <p class="sub">Todavía no se terminó de sincronizar. Esperá a tener señal; si no aparece, avisale al encargado.</p>
      </div>`;
    return;
  }

  // 3) Sin uso abierto: elegir el vehículo con tarjetas grandes y después qué hacer.
  if (!ui.driverVehicle || !byId(vehicles, ui.driverVehicle)) ui.driverVehicle = vehicles.length === 1 ? vehicles[0].id : null;
  const sel = byId(vehicles, ui.driverVehicle);
  view.innerHTML = `
    ${hello}
    <div class="section-title">¿Qué vehículo vas a usar?</div>
    <div class="pick-grid">
      ${vehicles.map((v) => {
        const taller = v.status === 'taller';
        const who = taller ? 'En taller' : v.status === 'uso' && v.driverName ? `Lo tiene ${v.driverName}` : 'Disponible';
        return `
          <button class="pick ${v.id === ui.driverVehicle ? 'selected' : ''} ${taller ? 'disabled' : ''}" data-action="pick-vehicle" data-id="${v.id}">
            ${vphoto(v)}
            <div class="body">
              <div class="grow">
                <div class="nm ellipsis">${esc(v.name)}</div>
                <div class="who">${v.plate ? `<span class="plate">${esc(v.plate)}</span> · ` : ''}${esc(who)}</div>
              </div>
              <span class="tick">${icon('check')}</span>
            </div>
          </button>`;
      }).join('') || '<div class="empty">Todavía no hay vehículos cargados. Avisale al administrador.</div>'}
    </div>
    ${sel ? `
      <div class="big-actions" id="driver-actions" style="margin-top:18px">
        <button class="big-btn start" data-action="start-uso" data-id="${sel.id}" ${sel.status === 'taller' ? 'disabled' : ''}>
          ${icon('play')}<span>Iniciar uso<small>${sel.status === 'taller' ? 'Está en taller' : `${esc(sel.name)} · km, foto del tablero y destino`}</small></span>
        </button>
        <button class="big-btn fuel" data-action="fuel" data-id="${sel.id}">
          ${icon('fuel')}<span>Cargar nafta<small>Litros, monto y foto del ticket</small></span>
        </button>
      </div>` : vehicles.length ? '<p class="sub" style="text-align:center;margin-top:16px">Tocá el vehículo para seguir.</p>' : ''}
  `;
}

/* ===================== ADMIN / ENCARGADO ===================== */

function alertRow(a) {
  const ic = { task: 'wrench', doc: 'doc', fine: 'ticket', uso: a.code === 'abierto' || a.code === 'sin_cerrar' ? 'history' : 'gauge' }[a.kind];
  const dl = a.kind !== 'uso' ? deadlines().find((d) => d.key === `${a.kind}:${a.item.id}`) : null;
  return `
    <div class="list-item tap" data-action="open-alert" data-kind="${a.kind}" data-id="${a.item.id}" role="button" tabindex="0">
      <div class="icon-bubble ${a.st.level}">${icon(ic)}</div>
      <div class="grow"><div class="name ellipsis">${esc(a.title)}</div><div class="sub">${esc(a.st.detail)}</div></div>
      ${dl ? `<a class="btn small icon-only" href="${gcalLink(dl)}" target="_blank" rel="noopener" title="Agregar a Google Calendar">${icon('calendar')}</a>` : badge(a.st)}
    </div>`;
}

function renderHome() {
  const list = alerts();
  const vehicles = activeVehicles();
  const month = today().slice(0, 7);
  const monthExp = state.expenses.filter((e) => toISO(new Date(expenseTime(e))).startsWith(month)).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const monthUsos = activeUsos().filter((u) => toISO(new Date(u.startAt)).startsWith(month));
  const missing = missingData();
  const monthKm = monthUsos.reduce((s, u) => s + (usoKm(u) || 0), 0);
  const inUse = vehicles.filter((v) => v.status === 'uso').length;
  const taller = vehicles.filter((v) => v.status === 'taller').length;
  const bad = list.filter((a) => a.st.level === 'bad').length;
  const showNotif = notificationsSupported() && Notification.permission === 'default';
  const summary = [`${inUse} en uso`, `${vehicles.length - inUse - taller} disponible${vehicles.length - inUse - taller === 1 ? '' : 's'}`, taller ? `${taller} en taller` : ''].filter(Boolean).join(' · ');

  view.innerHTML = `
    ${pageHead('Flota', esc(summary), new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))}

    <div class="quick">
      <button class="q-start" data-action="start-uso">${icon('play')}Iniciar uso</button>
      <button class="q-end" data-action="end-uso-pick">${icon('stop')}Terminar uso</button>
      <button class="q-fuel" data-action="fuel">${icon('fuel')}Cargar nafta</button>
    </div>

    <div class="section-title"><span>La flota ahora</span><button class="link" data-action="go-vehicles">Ver todo</button></div>
    <div class="fleet">${vehicles.map(fleetCard).join('') || '<div class="empty">No hay vehículos.</div>'}</div>

    ${isAdmin() ? firstStepsCard() : ''}

    <div class="section-title" id="attention"><span>Avisos${list.length ? ` · ${list.length}` : ''}</span>${list.length > 5 ? '<button class="link" data-action="all-alerts">Ver todos</button>' : ''}</div>
    <div class="card ${bad ? 'flag-bad' : list.length ? 'flag-warn' : ''}">${list.slice(0, 5).map(alertRow).join('')}${missingRow(missing, !list.length)}</div>
    ${alertsNote()}

    ${showNotif ? `<div class="card row" style="margin-top:14px"><div class="icon-bubble">${icon('bell')}</div><div class="grow"><div class="name">Activá las notificaciones</div><div class="sub">Para enterarte de vencimientos, usos sin cerrar y km raros.</div></div><button class="btn small primary" data-action="enable-notif">Activar</button></div>` : ''}

    <div class="section-title"><span>Este mes</span><button class="link" data-action="go-reports">Reportes</button></div>
    <div class="tiles" style="grid-template-columns:repeat(3,1fr)">
      <div class="tile"><div class="label">Usos</div><div class="value">${monthUsos.length}</div></div>
      <div class="tile"><div class="label">Km</div><div class="value">${Math.round(monthKm).toLocaleString('es-AR')}</div></div>
      <div class="tile"><div class="label">Gasto</div><div class="value">${esc(shortMoney(monthExp, 'ARS'))}</div></div>
    </div>
  `;
}

// Tarjeta grande de cada vehículo en el Inicio: foto, estado, quién lo tiene y avisos.
function fleetCard(v) {
  const vAlerts = alerts().filter((a) => a.item.vehicleId === v.id);
  const worst = vAlerts.some((a) => a.st.level === 'bad') ? 'bad' : vAlerts.length ? 'warn' : '';
  const line = v.status === 'uso'
    ? `${icon('user', 'tiny')} ${esc(v.driverName || '')} · desde ${esc(fmtTime(v.usoStartAt))}`
    : v.status === 'taller' ? 'En el taller' : `${esc(fmtKm(v.km))}`;
  return `
    <div class="card tap fleet-card st-${v.status || 'disponible'}" data-action="open-vehicle" data-id="${v.id}" role="button" tabindex="0">
      ${vphoto(v)}
      <span class="status-band">${statusBadge(v)}</span>
      <div class="body">
        <div class="row" style="gap:8px"><div class="name grow ellipsis" style="font-size:1.05rem">${esc(v.name)}</div>${v.plate ? `<span class="plate">${esc(v.plate)}</span>` : ''}</div>
        <div class="meta sub">${line}${vAlerts.length ? ` · <b style="color:var(--${worst})">${vAlerts.length} aviso${vAlerts.length > 1 ? 's' : ''}</b>` : ''}</div>
      </div>
    </div>`;
}

// Mientras falten datos de service o papeles, no se puede decir «todo en orden».
function missingRow(missing, alone) {
  if (!missing.total) return alone ? `<div class="empty">${icon('check')}<br>Todo en orden.</div>` : '';
  const parts = [];
  if (missing.tasks.length) parts.push(`${missing.tasks.length} tarea${missing.tasks.length === 1 ? '' : 's'} de service sin último registro`);
  if (missing.docs.length) parts.push(`${missing.docs.length} papel${missing.docs.length === 1 ? '' : 'es'} sin vencimiento`);
  const first = missing.tasks[0] || missing.docs[0];
  return `
    <div class="list-item tap" data-action="open-vehicle" data-id="${first.vehicleId}" data-seg-open="${missing.tasks.length ? 'service' : 'papeles'}" role="button" tabindex="0">
      <div class="icon-bubble none">${icon('alert')}</div>
      <div class="grow"><div class="name">Faltan datos</div><div class="sub">${esc(parts.join(' y '))}. Sin esos datos no se puede avisar cuándo vence cada cosa.</div></div>
      ${icon('chev', 'chev')}
    </div>`;
}

function alertsNote() {
  return `<p class="sub small" style="margin:6px 2px 0">Los avisos de usos abiertos hace más de ${state.config.openHours} h y de km raros se calculan cuando alguien abre la app: llegan como notificación con la app abierta o al abrirla. En iPhone no hay avisos con la app cerrada; en Android (Chrome con la app instalada) los vencimientos pueden avisar en segundo plano.</p>`;
}

// Tarjeta de «Primeros pasos» para el admin, hasta que esté todo cargado.
function firstSteps() {
  const vehicles = activeVehicles();
  const missing = missingData();
  const incomplete = vehicles.find((v) => !v.plate || !(v.km > 0) || !v.photo);
  return [
    { done: state.users.some((u) => u.role === 'chofer' && u.active !== false), text: 'Dar de alta a los choferes', action: 'users' },
    { done: state.obras.some((o) => o.active !== false), text: 'Cargar las obras y destinos', action: 'obras' },
    { done: !incomplete, text: 'Completar patente, km y foto de cada vehículo', action: 'open-vehicle', id: incomplete?.id, seg: 'resumen', detail: incomplete ? `Falta en ${incomplete.name}` : '' },
    { done: !missing.tasks.length, text: 'Cargar el último service de cada tarea', action: 'open-vehicle', id: missing.tasks[0]?.vehicleId, seg: 'service', detail: missing.tasks.length ? `${missing.tasks.length} sin datos` : '' },
    { done: !missing.docs.length, text: 'Cargar los vencimientos de los papeles', action: 'open-vehicle', id: missing.docs[0]?.vehicleId, seg: 'papeles', detail: missing.docs.length ? `${missing.docs.length} sin fecha` : '' },
  ];
}

function firstStepsCard() {
  const steps = firstSteps();
  const done = steps.filter((x) => x.done).length;
  if (done === steps.length) return '';
  return `
    <div class="section-title"><span>Primeros pasos</span><span>${done} de ${steps.length}</span></div>
    <div class="card accent">
      ${steps.map((x) => `
        <div class="list-item ${x.done ? '' : 'tap'}" ${x.done ? '' : `data-action="${x.action}" data-id="${x.id || ''}" data-seg-open="${x.seg || ''}" role="button" tabindex="0"`}>
          <div class="icon-bubble ${x.done ? 'ok' : 'none'}">${icon(x.done ? 'check' : 'chev')}</div>
          <div class="grow"><div class="name" style="${x.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.text)}</div>${!x.done && x.detail ? `<div class="sub">${esc(x.detail)}</div>` : ''}</div>
        </div>`).join('')}
    </div>`;
}

function vehicleCard(v) {
  const vAlerts = alerts().filter((a) => a.item.vehicleId === v.id);
  const worst = vAlerts.find((a) => a.st.level === 'bad') ? 'bad' : vAlerts.length ? 'warn' : '';
  return `
    <div class="card tap ${worst ? `flag-${worst}` : ''}" data-action="open-vehicle" data-id="${v.id}" role="button" tabindex="0">
      <div class="vehicle-card">
        ${vphoto(v)}
        <div class="grow">
          <div class="row" style="gap:8px"><div class="name grow ellipsis">${esc(v.name)}</div>${statusBadge(v)}</div>
          <div class="sub">${v.plate ? `<span class="plate">${esc(v.plate)}</span> · ` : ''}${esc(fmtKm(v.km))}</div>
          <div class="sub small">${v.status === 'uso' ? `${esc(v.driverName || '')} desde ${esc(fmtTime(v.usoStartAt))}` : esc(v.brand || VEHICLE_TYPES[v.type] || '')}${vAlerts.length ? ` · <b style="color:var(--${worst})">${vAlerts.length} aviso${vAlerts.length > 1 ? 's' : ''}</b>` : ''}</div>
        </div>
      </div>
    </div>`;
}

/* ---------- Usos y cargas ---------- */

function inRange(ms, from, to) {
  const d = toISO(new Date(ms));
  return (!from || d >= from) && (!to || d <= to);
}

function filteredUsos() {
  const f = ui.usosFilter;
  return state.usos.filter((u) => {
    if (f.vehicle && u.vehicleId !== f.vehicle) return false;
    if (f.status === 'anulado') return !!u.anulado && inRange(u.startAt, f.from, f.to);
    if (u.anulado && f.status !== 'todos') return false;
    if (f.driver && u.driverEmail !== f.driver) return false;
    const issues = usoIssues(u);
    if (f.status === 'revisar') return issues.length > 0;
    if (f.status !== 'todos' && u.status !== f.status) return false;
    // Los abiertos y sin cerrar se ven siempre, sin importar las fechas.
    if (u.status !== 'cerrado' && !u.anulado && f.status === 'todos') return true;
    return inRange(u.startAt, f.from, f.to);
  }).sort((a, b) => b.startAt - a.startAt);
}

function usoCard(u) {
  const issues = usoIssues(u);
  const worst = issues.find((i) => i.level === 'bad') ? 'bad' : issues.length ? 'warn' : '';
  const km = usoKm(u);
  const st = { abierto: 'uso', cerrado: 'none', sin_cerrar: 'bad' }[u.status];
  return `
    <div class="card tap ${worst ? `flag-${worst}` : ''}" style="${u.anulado ? 'opacity:.6' : ''}" data-action="open-uso" data-id="${u.id}" role="button" tabindex="0">
      <div class="row top">
        <div class="grow">
          <div class="name ellipsis">${esc(u.driverName || u.driverEmail)} · ${esc(u.vehicleName || vehicleName(u.vehicleId))}</div>
          <div class="sub">${esc(fmtDateTime(u.startAt))}${u.endAt ? ` → ${esc(fmtTime(u.endAt))}` : ''} · ${esc(u.obraName || '')}</div>
          <div class="sub nums">${esc(fmtKm(u.kmStart))} → ${esc(u.kmEnd != null ? fmtKm(u.kmEnd) : '…')}${km != null ? ` · <b>${esc(fmtKm(km))}</b>` : ''}${usoHours(u) != null ? ` · ${esc(fmtHours(usoHours(u)))}` : ''}</div>
        </div>
        ${u.anulado ? '<span class="badge none">Anulado</span>' : `<span class="badge ${st}">${esc(USO_STATUS[u.status])}</span>`}
      </div>
      ${u.anulado ? `<div class="sub small" style="margin-top:6px">Anulado por ${esc(u.anuladoPor?.name || '')}: ${esc(u.motivo || '')}</div>` : ''}
      ${issues.map((i) => `<div class="issue ${i.level}">${icon('alert')}<span>${esc(i.text)}</span></div>`).join('')}
      ${u.corrections?.length ? `<div class="sub small" style="margin-top:6px">${icon('edit', 'tiny')} Corregido por ${esc(u.corrections[u.corrections.length - 1].by.name)}</div>` : ''}
    </div>`;
}

function renderUsos() {
  const f = ui.usosFilter;
  const vehOpts = `<option value="">Todos</option>${state.vehicles.map((v) => `<option value="${v.id}" ${f.vehicle === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}`;
  const drvOpts = `<option value="">Todos</option>${Object.entries(peopleOptions()).map(([k, n]) => `<option value="${esc(k)}" ${f.driver === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}`;
  const filters = `
    <div class="filters">
      <label>Vehículo<select data-filter="vehicle">${vehOpts}</select></label>
      <label>${ui.usosSeg === 'usos' ? 'Chofer' : 'Cargó'}<select data-filter="driver">${drvOpts}</select></label>
      <label>Desde<input type="date" data-filter="from" value="${f.from}"></label>
      <label>Hasta<input type="date" data-filter="to" value="${f.to}"></label>
    </div>`;
  let body;
  if (ui.usosSeg === 'usos') {
    const list = filteredUsos();
    const counted = list.filter((u) => !u.anulado);
    const toReview = state.usos.filter((u) => usoIssues(u).length).length;
    body = `
      ${segmented('usostatus', { todos: 'Todos', revisar: `A revisar${toReview ? ` (${toReview})` : ''}`, abierto: 'En curso', sin_cerrar: 'Sin cerrar', cerrado: 'Cerrados', anulado: 'Anulados' }, f.status)}
      ${filters}
      <div class="sub" style="margin:0 2px 8px">${counted.length} uso${counted.length === 1 ? '' : 's'} · ${esc(fmtKm(counted.reduce((s, u) => s + (usoKm(u) || 0), 0)))}${list.length > counted.length ? ` · ${list.length - counted.length} anulado${list.length - counted.length === 1 ? '' : 's'} (no cuentan)` : ''}</div>
      ${list.map(usoCard).join('') || '<div class="empty">No hay usos con estos filtros.</div>'}`;
  } else {
    const list = state.expenses.filter((e) => e.source === 'carga'
      && (!f.vehicle || e.vehicleId === f.vehicle) && (!f.driver || e.createdBy?.email === f.driver)
      && inRange(expenseTime(e), f.from, f.to)).sort((a, b) => expenseTime(b) - expenseTime(a));
    const liters = list.reduce((s, e) => s + (e.liters || 0), 0);
    const total = list.reduce((s, e) => s + (e.amount || 0), 0);
    body = `
      ${filters}
      <div class="sub" style="margin:0 2px 8px">${list.length} carga${list.length === 1 ? '' : 's'} · ${num.format(liters)} l · ${money.format(total)}</div>
      ${list.map((e) => `
        <div class="card tap" data-action="open-carga" data-id="${e.id}" role="button" tabindex="0">
          <div class="row">
            <div class="icon-bubble">${icon('fuel')}</div>
            <div class="grow"><div class="name ellipsis">${esc(e.vehicleName || vehicleName(e.vehicleId))} · ${num.format(e.liters || 0)} l</div>
            <div class="sub">${esc(fmtDateTime(e.at))} · ${esc(e.createdBy?.name || '')} · ${esc(e.station || '')}</div></div>
            <div class="amount">${money.format(e.amount || 0)}</div>
          </div>
        </div>`).join('') || '<div class="empty">No hay cargas con estos filtros.</div>'}`;
  }
  view.innerHTML = `${pageHead('Usos y cargas')}${segmented('usosseg', { usos: 'Usos', cargas: 'Cargas de nafta' }, ui.usosSeg)}${body}`;
}

function openUsoSheet(id) {
  const draw = () => {
    const u = byId(state.usos, id);
    if (!u) return closeSheet();
    const issues = usoIssues(u);
    openSheet(`
      <h2>${esc(u.vehicleName || vehicleName(u.vehicleId))}</h2>
      <div style="margin-bottom:10px">${u.anulado ? '' : `<span class="badge ${{ abierto: 'uso', cerrado: 'none', sin_cerrar: 'bad' }[u.status]}">${esc(USO_STATUS[u.status])}</span>`} ${u.reviewed ? '<span class="badge ok">Revisado</span>' : ''} ${u.anulado ? '<span class="badge bad">Anulado</span>' : ''}</div>
      ${u.anulado ? `<div class="card flag-bad" style="box-shadow:none"><b>Uso anulado</b><div class="sub">${esc(u.anuladoPor?.name || '')} · ${esc(fmtDateTime(u.anuladoEn))}<br>Motivo: ${esc(u.motivo || '—')}</div><div class="sub small">No cuenta en reportes ni avisos.</div></div>` : ''}
      ${issues.map((i) => `<div class="issue ${i.level}">${icon('alert')}<span>${esc(i.text)}</span></div>`).join('')}
      <dl class="kv" style="margin-top:12px">
        <dt>Chofer</dt><dd>${esc(u.driverName || u.driverEmail)}</dd>
        <dt>Obra / destino</dt><dd>${esc(u.obraName || '—')}</dd>
        <dt>Inicio</dt><dd>${esc(fmtDateTime(u.startAt))}</dd>
        <dt>Fin</dt><dd>${esc(fmtDateTime(u.endAt))}</dd>
        <dt>Km subida</dt><dd>${esc(fmtKm(u.kmStart))}</dd>
        <dt>Último km de bajada</dt><dd>${esc(fmtKm(u.kmPrev))}</dd>
        <dt>Km bajada</dt><dd>${esc(fmtKm(u.kmEnd))}</dd>
        <dt>Recorrido</dt><dd>${esc(fmtKm(usoKm(u)))}</dd>
        <dt>Duración</dt><dd>${esc(fmtHours(usoHours(u)))}</dd>
      </dl>
      ${u.notes ? `<div class="section-title">Observaciones / daños</div><div class="card" style="box-shadow:none">${esc(u.notes)}</div>` : ''}
      <div class="section-title">Fotos del tablero</div>
      <div class="photos-2">${attachmentSlots([u.photoStart], 'Al subir')}${u.photoEnd ? attachmentSlots([u.photoEnd], 'Al bajar') : '<div class="sub">Sin foto de bajada todavía.</div>'}</div>
      <div class="section-title">Registro</div>
      <div class="log">Iniciado por ${esc(u.createdBy?.name || '—')} ${u.createdAt?.toMillis ? `· ${esc(fmtDateTime(u.createdAt.toMillis()))}` : '(sin sincronizar)'}</div>
      ${u.flaggedBy ? `<div class="log">Marcado sin cerrar cuando ${esc(u.flaggedBy.name)} tomó el vehículo${u.flaggedAt?.toMillis ? ` · ${esc(fmtDateTime(u.flaggedAt.toMillis()))}` : ''}</div>` : ''}
      ${u.closedBy ? `<div class="log">Cerrado por ${esc(u.closedBy.name)}${u.closedAt?.toMillis ? ` · ${esc(fmtDateTime(u.closedAt.toMillis()))}` : ''}</div>` : ''}
      ${(u.corrections || []).map((c) => `<div class="log"><b>${esc(c.by.name)}</b> · ${esc(fmtDateTime(c.at))}${c.reason ? ` · «${esc(c.reason)}»` : ''}<br>${Object.entries(c.changes || {}).map(([k, [a, b]]) => `${esc(USO_FIELDS[k] || k)}: ${esc(fmtUsoValue(k, a))} → ${esc(fmtUsoValue(k, b))}`).join('<br>') || (c.reviewed ? 'Marcado como revisado' : '')}</div>`).join('')}
      <div class="actions">
        <button class="btn primary" data-act="correct">${icon('edit')}Corregir</button>
        ${u.status !== 'cerrado' && !u.anulado ? `<button class="btn dark" data-act="close">${icon('stop')}Cerrar</button>` : ''}
        ${issues.some((i) => i.code !== 'abierto') && !u.reviewed ? `<button class="btn" data-act="reviewed">${icon('check')}Revisado</button>` : ''}
        <span class="spacer"></span>
        ${u.anulado ? '<button class="btn" data-act="unannul">Quitar anulación</button>' : '<button class="btn danger" data-act="annul">Anular</button>'}
        <button class="btn ghost" data-sheet-close>Cerrar</button>
      </div>`, {
      refresh: draw,
      onClick: (ev) => {
        const act = ev.target.closest('[data-act]')?.dataset.act;
        if (act === 'correct') usoCorrectionForm(id);
        else if (act === 'close') endUsoForm(id);
        else if (act === 'reviewed') markUsoReviewed(id);
        else if (act === 'annul') annulUsoForm(id);
        else if (act === 'unannul') unannulUso(id);
      },
    });
    fillAttachments(sheetBody, [u.photoStart, u.photoEnd]);
  };
  draw();
}

function openCargaSheet(id) {
  const e = byId(state.expenses, id);
  if (!e) return;
  openSheet(`
    <h2>Carga de nafta</h2>
    <dl class="kv">
      <dt>Vehículo</dt><dd>${esc(e.vehicleName || vehicleName(e.vehicleId))}</dd>
      <dt>Fecha</dt><dd>${esc(fmtDateTime(e.at))}</dd>
      <dt>Cargó</dt><dd>${esc(e.createdBy?.name || '—')}</dd>
      <dt>Km</dt><dd>${esc(fmtKm(e.km))}</dd>
      <dt>Litros</dt><dd>${num.format(e.liters || 0)} l</dd>
      <dt>Monto</dt><dd>${amountLine(e)}</dd>
      <dt>Precio por litro</dt><dd>${e.liters ? money.format(e.amount / e.liters) : '—'}</dd>
      <dt>Estación</dt><dd>${esc(e.station || '—')}</dd>
    </dl>
    <div class="section-title">Ticket</div>
    ${e.photo ? attachmentSlots([e.photo]) : '<div class="sub">Sin foto.</div>'}
    <div class="actions"><button class="btn primary" data-act="edit">${icon('edit')}Editar</button><span class="spacer"></span><button class="btn ghost" data-sheet-close>Cerrar</button></div>`, {
    onClick: (ev) => { if (ev.target.closest('[data-act="edit"]')) expenseForm(id); },
  });
  if (e.photo) fillAttachments(sheetBody, [e.photo]);
}

function openEndUsoPicker() {
  const open = state.usos.filter((u) => u.status !== 'cerrado' && !u.anulado).sort((a, b) => b.startAt - a.startAt);
  if (open.length === 1) return endUsoForm(open[0].id);
  openSheet(`
    <h2>¿Qué uso terminás?</h2>
    ${open.map((u) => `<div class="card tap" data-pick="${u.id}"><div class="name">${esc(u.vehicleName)} · ${esc(u.driverName)}</div><div class="sub">Desde ${esc(fmtDateTime(u.startAt))} · ${esc(USO_STATUS[u.status])}</div></div>`).join('') || '<div class="empty">No hay usos abiertos.</div>'}
    <div class="actions"><span class="spacer"></span><button class="btn ghost" data-sheet-close>Cerrar</button></div>`, {
    onClick: (ev) => { const p = ev.target.closest('[data-pick]'); if (p) endUsoForm(p.dataset.pick); },
  });
}

/* ---------- Vehículos ---------- */

function renderVehicles() {
  if (ui.vehicleId && byId(state.vehicles, ui.vehicleId)) return renderVehicleDetail();
  ui.vehicleId = null;
  const inactive = state.vehicles.filter((v) => v.active === false);
  view.innerHTML = `
    ${pageHead('Vehículos', 'Service, papeles, gastos y multas de cada uno.')}
    <div class="fleet">${activeVehicles().map(fleetCard).join('') || '<div class="empty">No hay vehículos.</div>'}</div>
    <div class="actions"><button class="btn primary" data-action="add-vehicle">${icon('plus')}Agregar vehículo</button>
    ${inactive.length ? `<button class="btn ghost" data-action="toggle-inactive">${ui.showInactive ? 'Ocultar' : 'Ver'} dados de baja (${inactive.length})</button>` : ''}</div>
    ${ui.showInactive ? `<div class="section-title">Dados de baja</div>${inactive.map(vehicleCard).join('')}` : ''}`;
}

function renderVehicleDetail() {
  const v = byId(state.vehicles, ui.vehicleId);
  const segs = { resumen: 'Resumen', service: 'Service', papeles: 'Papeles', gastos: 'Gastos', multas: 'Multas' };
  const body = { resumen: vehicleSummary, service: vehicleService, papeles: vehicleDocs, gastos: vehicleExpenses, multas: vehicleFines }[ui.vehicleSeg](v);
  view.innerHTML = `
    <button class="btn ghost small" data-action="back-vehicles" style="margin-left:-8px">${icon('left')}Vehículos</button>
    <div class="row" style="margin:6px 2px 12px"><h1 class="grow" style="margin:0;font-size:1.45rem">${esc(v.name)}</h1>${v.active === false ? '<span class="badge none">Dado de baja</span>' : statusBadge(v)}</div>
    ${segmented('vseg', segs, ui.vehicleSeg)}
    ${body}`;
}

function vehicleSummary(v) {
  const usos = state.usos.filter((u) => u.vehicleId === v.id).sort((a, b) => b.startAt - a.startAt);
  return `
    ${vphoto(v, true)}
    <div class="card">
      <dl class="kv">
        <dt>Patente</dt><dd>${v.plate ? `<span class="plate">${esc(v.plate)}</span>` : '—'}</dd>
        <dt>Marca y modelo</dt><dd>${esc(v.brand || '—')}</dd>
        <dt>Año</dt><dd>${esc(v.year || '—')}</dd>
        <dt>Tipo</dt><dd>${esc(VEHICLE_TYPES[v.type] || '—')}</dd>
        <dt>Km actual</dt><dd>${esc(fmtKm(v.km))}</dd>
        <dt>Estado</dt><dd>${esc(VEHICLE_STATUS[v.status] || '—')}${v.status === 'uso' && v.driverName ? ` · ${esc(v.driverName)}` : ''}</dd>
      </dl>
      ${v.notes ? `<p class="sub" style="margin:10px 0 0">${esc(v.notes)}</p>` : ''}
      <div class="actions">
        <button class="btn primary" data-action="edit-vehicle" data-id="${v.id}">${icon('edit')}Editar</button>
        ${v.status !== 'uso' ? `<button class="btn" data-action="toggle-taller" data-id="${v.id}">${icon('wrench')}${v.status === 'taller' ? 'Salió del taller' : 'Mandar a taller'}</button>` : ''}
        <button class="btn danger" data-action="toggle-active" data-id="${v.id}">${v.active === false ? 'Reactivar' : 'Dar de baja'}</button>
      </div>
    </div>
    <div class="section-title">Últimos usos</div>
    ${usos.slice(0, 5).map(usoCard).join('') || '<div class="empty">Sin usos todavía.</div>'}`;
}

function vehicleService(v) {
  const tasks = state.tasks.filter((t) => t.vehicleId === v.id).map((t) => ({ t, st: taskStatus(t) })).sort((a, b) => levelOrder(a.st.level) - levelOrder(b.st.level));
  return `
    <div class="sub" style="margin:0 2px 10px">Km actual: <b>${esc(fmtKm(v.km))}</b></div>
    ${tasks.map(({ t, st }) => `
      <div class="card tap" data-action="open-task" data-id="${t.id}" role="button" tabindex="0">
        <div class="row"><div class="icon-bubble ${st.level}">${icon('wrench')}</div>
          <div class="grow"><div class="name">${esc(t.name)}</div><div class="sub">${esc(st.detail)}</div></div>${badge(st)}</div>
        ${st.level !== 'none' ? `<div class="progress ${st.level}"><i style="width:${Math.round(st.progress * 100)}%"></i></div>` : ''}
      </div>`).join('') || '<div class="empty">Sin tareas.</div>'}
    <div class="actions"><button class="btn primary" data-action="add-task" data-id="${v.id}">${icon('plus')}Agregar tarea</button></div>`;
}

function openTaskSheet(id) {
  const draw = () => {
    const t = byId(state.tasks, id);
    if (!t) return closeSheet();
    const st = taskStatus(t);
    const dl = deadlines().find((d) => d.key === `task:${t.id}`);
    const hist = [...(t.history || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    openSheet(`
      <h2>${esc(t.name)}</h2>
      <div class="row" style="margin-bottom:8px">${badge(st)}<span class="sub">${esc(intervalText(t))}</span></div>
      <p class="sub">${esc(st.detail)}</p>
      ${t.createdBy || t.updatedBy ? `<p class="sub small">${t.createdBy ? `Creada por ${esc(t.createdBy.name)}${t.createdAt ? ` · ${esc(fmtDateTime(t.createdAt))}` : ''}` : ''}${t.updatedBy ? `<br>Última edición: ${esc(t.updatedBy.name)}${t.updatedAt ? ` · ${esc(fmtDateTime(t.updatedAt))}` : ''}` : ''}</p>` : ''}
      <div class="actions">
        <button class="btn primary" data-act="done">${icon('check')}Registrar service</button>
        <button class="btn" data-act="edit">${icon('edit')}Editar</button>
        ${dl ? `<a class="btn" href="${gcalLink(dl)}" target="_blank" rel="noopener">${icon('calendar')}Google Calendar</a>` : ''}
      </div>
      <div class="section-title">Historial</div>
      <div class="card" style="box-shadow:none">
        ${hist.map((h) => `<div class="list-item"><div class="grow"><div class="name">${esc(fmtDate(h.date))}${h.km != null ? ` · ${esc(fmtKm(h.km))}` : ''}</div>
          <div class="sub">${[h.shop, h.cost ? money.format(h.cost) : '', h.note].filter(Boolean).map(esc).join(' · ') || 'Sin detalle'}</div>${h.by ? `<div class="sub small">Cargó ${esc(h.by.name)}</div>` : ''}</div>
          <button class="btn icon-only ghost" data-del-entry="${h.id}" aria-label="Borrar">${icon('trash')}</button></div>`).join('') || '<div class="empty">Sin registros.</div>'}
      </div>
      <div class="actions"><span class="spacer"></span><button class="btn ghost" data-sheet-close>Cerrar</button></div>`, {
      refresh: draw,
      onClick: (ev) => {
        const act = ev.target.closest('[data-act]')?.dataset.act;
        const del = ev.target.closest('[data-del-entry]');
        if (act === 'done') doneTaskForm(id);
        else if (act === 'edit') taskForm(id);
        else if (del) removeTaskEntry(id, del.dataset.delEntry);
      },
    });
  };
  draw();
}

function vehicleDocs(v) {
  const docs = state.docs.filter((d) => d.vehicleId === v.id).map((d) => ({ d, st: docStatus(d) })).sort((a, b) => levelOrder(a.st.level) - levelOrder(b.st.level));
  return `
    ${docs.map(({ d, st }) => `
      <div class="card tap" data-action="open-doc" data-id="${d.id}" role="button" tabindex="0">
        <div class="row"><div class="icon-bubble ${st.level}">${icon('doc')}</div>
          <div class="grow"><div class="name">${esc(d.name)}</div><div class="sub">${esc(st.detail)}${d.files?.length ? ` · ${icon('clip', 'tiny')} ${d.files.length}` : ''}</div></div>${badge(st)}</div>
      </div>`).join('') || '<div class="empty">Sin papeles.</div>'}
    <div class="actions"><button class="btn primary" data-action="add-doc" data-id="${v.id}">${icon('plus')}Agregar papel</button></div>`;
}

function openDocSheet(id) {
  const d = byId(state.docs, id);
  if (!d) return;
  const st = docStatus(d);
  const dl = deadlines().find((x) => x.key === `doc:${d.id}`);
  openSheet(`
    <h2>${esc(d.name)}</h2>
    <div class="row" style="margin-bottom:8px">${badge(st)}<span class="sub">${esc(st.detail)}</span></div>
    ${d.number ? `<p class="sub">Número: <b>${esc(d.number)}</b></p>` : ''}
    ${d.note ? `<p class="sub">${esc(d.note)}</p>` : ''}
    <div class="actions">
      <button class="btn primary" data-act="edit">${icon('edit')}Editar</button>
      ${dl ? `<a class="btn" href="${gcalLink(dl)}" target="_blank" rel="noopener">${icon('calendar')}Google Calendar</a>` : ''}
    </div>
    ${attachmentSlots(d.files || []) || '<p class="sub">Sin fotos ni PDF adjuntos.</p>'}
    <div class="actions"><span class="spacer"></span><button class="btn ghost" data-sheet-close>Cerrar</button></div>`, {
    onClick: (ev) => { if (ev.target.closest('[data-act="edit"]')) docForm(id); },
  });
  fillAttachments(sheetBody, d.files || []);
}

function vehicleExpenses(v) {
  const cur = ui.currency;
  const list = state.expenses.filter((e) => e.vehicleId === v.id && (e.date || '').startsWith(ui.expMonth)).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.at || 0) - (a.at || 0));
  const total = list.reduce((s, e) => s + expenseValue(e, cur), 0);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(ui.expMonth, i - 11)).map((key) => {
    const value = state.expenses.filter((e) => e.vehicleId === v.id && (e.date || '').startsWith(key)).reduce((s, e) => s + expenseValue(e, cur), 0);
    return { key, label: monthLabel(key, { month: 'short' }).replace('.', ''), value, tip: `${monthLabel(key)}: ${fmtCur(value, cur)}` };
  });
  const byCat = Object.entries(CATEGORIES).map(([k, c]) => ({ key: k, label: c.label, color: c.color, value: list.filter((e) => e.cat === k).reduce((s, e) => s + expenseValue(e, cur), 0) }))
    .filter((s) => s.value > 0).sort((a, b) => b.value - a.value).map((s) => ({ ...s, display: fmtCur(s.value, cur) }));
  return `
    ${segmented('currency', { ARS: 'Pesos', USD: 'Dólares (blue)' }, cur)}
    <div class="card">${barChart(months, { selected: ui.expMonth, currency: cur, ariaLabel: 'Gastos de los últimos 12 meses' })}</div>
    <div class="month-nav"><button class="btn icon-only" data-month="-1">${icon('left')}</button><span class="label">${esc(monthLabel(ui.expMonth))}</span><button class="btn icon-only" data-month="1">${icon('chev')}</button></div>
    <div class="tiles" style="grid-template-columns:1fr 1fr"><div class="tile"><div class="label">Total del mes</div><div class="value">${esc(fmtCur(total, cur))}</div></div><div class="tile"><div class="label">Registros</div><div class="value">${list.length}</div></div></div>
    ${byCat.length ? `<div class="card" style="margin-top:10px">${donutChart(byCat, { total: shortMoney(total, cur), totalLabel: 'en el mes' })}</div>` : ''}
    <div class="actions"><button class="btn primary" data-action="add-expense" data-id="${v.id}">${icon('plus')}Agregar gasto</button></div>
    <div class="card" style="margin-top:10px">
      ${list.map((e) => `<div class="list-item tap" data-action="${e.source === 'carga' ? 'open-carga' : 'edit-expense'}" data-id="${e.id}" role="button" tabindex="0">
        <div class="icon-bubble" style="background:${CATEGORIES[e.cat]?.color}1a;color:${CATEGORIES[e.cat]?.color}">${icon(CATEGORIES[e.cat]?.icon || 'box')}</div>
        <div class="grow"><div class="name ellipsis">${esc(CATEGORIES[e.cat]?.label || e.cat)}${e.note ? ` · ${esc(e.note)}` : ''}${e.liters ? ` · ${num.format(e.liters)} l` : ''}</div>
        <div class="sub">${esc(fmtDate(e.date))}${e.createdBy ? ` · ${esc(e.createdBy.name)}` : ''}</div></div>
        <div class="amount" style="text-align:right">${amountLine(e)}</div></div>`).join('') || '<div class="empty">Sin gastos este mes.</div>'}
    </div>`;
}

function vehicleFines(v) {
  const list = state.fines.filter((f) => f.vehicleId === v.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `
    ${list.map((f) => {
      const st = fineStatus(f);
      return `<div class="card tap" data-action="open-fine" data-id="${f.id}" role="button" tabindex="0">
        <div class="row"><div class="icon-bubble ${st.level}">${icon('ticket')}</div>
        <div class="grow"><div class="name ellipsis">${esc(f.reason || 'Multa')}</div><div class="sub">${esc(fmtDate(f.date))}${f.time ? ` ${esc(f.time)}` : ''} · ${esc(f.driverName || 'chofer sin identificar')}</div><div class="sub">${esc(st.detail)}</div></div>
        <div style="text-align:right"><div class="amount">${f.amount ? money.format(f.amount) : '—'}</div>${badge(st)}</div></div></div>`;
    }).join('') || '<div class="empty">Sin multas.</div>'}
    <div class="actions"><button class="btn primary" data-action="add-fine" data-id="${v.id}">${icon('plus')}Agregar multa</button></div>`;
}

function openFineSheet(id) {
  const f = byId(state.fines, id);
  if (!f) return;
  const st = fineStatus(f);
  const dl = deadlines().find((x) => x.key === `fine:${f.id}`);
  openSheet(`
    <h2>${esc(f.reason || 'Multa')}</h2>
    <div class="row" style="margin-bottom:8px">${badge(st)}<span class="sub">${esc(st.detail)}</span></div>
    <dl class="kv">
      <dt>Vehículo</dt><dd>${esc(vehicleName(f.vehicleId))}</dd>
      <dt>Fecha</dt><dd>${esc(fmtDate(f.date))} ${esc(f.time || '')}</dd>
      <dt>Chofer</dt><dd>${esc(f.driverName || '—')}</dd>
      <dt>Lugar</dt><dd>${esc(f.place || '—')}</dd>
      <dt>Monto</dt><dd>${f.amount ? money.format(f.amount) : '—'}</dd>
    </dl>
    ${f.note ? `<p class="sub">${esc(f.note)}</p>` : ''}
    <div class="actions"><button class="btn primary" data-act="edit">${icon('edit')}Editar</button>${dl ? `<a class="btn" href="${gcalLink(dl)}" target="_blank" rel="noopener">${icon('calendar')}Google Calendar</a>` : ''}</div>
    ${attachmentSlots(f.files || [])}
    <div class="actions"><span class="spacer"></span><button class="btn ghost" data-sheet-close>Cerrar</button></div>`, {
    onClick: (ev) => { if (ev.target.closest('[data-act="edit"]')) fineForm(id); },
  });
  fillAttachments(sheetBody, f.files || []);
}

/* ---------- Más ---------- */

function renderMore() {
  const notifState = !notificationsSupported() ? 'No disponible' : { granted: 'Activadas', denied: 'Bloqueadas', default: 'Desactivadas' }[Notification.permission];
  const rate = lastRate();
  view.innerHTML = `
    ${pageHead('Más')}
    <div class="settings">
      ${isAdmin() ? `<div class="set-row" data-action="users">${icon('users')}<span class="grow">Usuarios y permisos</span><span class="val">${state.users.length}</span>${icon('chev', 'chev')}</div>` : ''}
      <div class="set-row" data-action="obras">${icon('building')}<span class="grow">Obras y destinos</span><span class="val">${state.obras.filter((o) => o.active !== false).length}</span>${icon('chev', 'chev')}</div>
      <div class="set-row" data-action="config">${icon('settings')}<span class="grow">Avisos de usos y km</span><span class="val">${state.config.openHours} h · ${state.config.maxKmUso} km</span>${icon('chev', 'chev')}</div>
    </div>
    <div class="settings">
      <div class="set-row" data-action="enable-notif">${icon('bell')}<span class="grow">Notificaciones<br><span class="sub small">Usos sin cerrar y km raros llegan al abrir la app. En iPhone no hay avisos con la app cerrada.</span></span><span class="val">${notifState}</span>${icon('chev', 'chev')}</div>
      <div class="set-row" data-action="calendar">${icon('calendar')}<span class="grow">Vencimientos en el calendario</span><span class="val">${deadlines().length}</span>${icon('chev', 'chev')}</div>
      <div class="set-row" data-action="refresh-rate">${icon('dollar')}<span class="grow">Dólar blue</span><span class="val">${rate ? `${money.format(rate.value)} · ${esc(fmtDate(rate.date))}` : 'Sin dato'}</span></div>
    </div>
    <div class="settings">
      <div class="set-row static">${icon('palette')}<span class="grow">Apariencia</span><span class="val">${esc(THEMES[device.theme || 'auto'])}</span>
        ${segmented('theme', THEMES, device.theme || 'auto')}</div>
    </div>
    <div class="settings">
      <div class="set-row" data-action="sign-out">${icon('logout')}<span class="grow">Cerrar sesión</span><span class="val">${esc(state.me.email)}</span></div>
    </div>
    <p class="sub small" style="text-align:center;margin-top:18px">Flota Slavon · <span id="app-version"></span><br>Slavon High Sport Performance</p>`;
  showAppVersion();
}

async function showAppVersion() {
  try {
    const keys = await caches.keys();
    const el = document.getElementById('app-version');
    if (el) el.textContent = keys.find((k) => k.startsWith('flota-')) || 'sin caché';
  } catch (e) {
    // sin caché disponible
  }
}

function openUsersSheet() {
  const draw = () => {
    const users = [...state.users].sort((a, b) => (a.active === false) - (b.active === false) || a.role.localeCompare(b.role) || (a.name || a.email).localeCompare(b.name || b.email));
    openSheet(`
      <h2>Usuarios y permisos</h2>
      <p class="sub">Sólo entran los mails de esta lista. El resto ve «No tenés acceso».</p>
      <div class="actions" style="margin-bottom:10px"><button class="btn primary" data-act="add">${icon('plus')}Dar de alta</button></div>
      <div class="card" style="box-shadow:none">
        ${users.map((u) => `<div class="list-item tap" data-user="${esc(u.email)}">
          <div class="icon-bubble ${u.active === false ? 'none' : ''}">${icon(u.role === 'chofer' ? 'van' : 'user')}</div>
          <div class="grow"><div class="name ellipsis">${esc(u.name || u.email)}</div><div class="sub ellipsis">${esc(u.email)}${u.lastLogin ? ` · entró ${esc(fmtDateTime(u.lastLogin))}` : ' · todavía no entró'}</div></div>
          <span class="badge ${u.active === false ? 'none' : u.role === 'chofer' ? 'uso' : 'ok'}">${u.active === false ? 'Inactivo' : esc(ROLES[u.role])}</span></div>`).join('')}
      </div>
      <div class="actions"><span class="spacer"></span><button class="btn ghost" data-sheet-close>Cerrar</button></div>`, {
      refresh: draw,
      onClick: (ev) => {
        if (ev.target.closest('[data-act="add"]')) userForm(null);
        const row = ev.target.closest('[data-user]');
        if (row) userForm(row.dataset.user);
      },
    });
  };
  draw();
}

function openObrasSheet() {
  const draw = () => {
    const obras = [...state.obras].sort((a, b) => (a.active === false) - (b.active === false) || a.name.localeCompare(b.name));
    const counts = {};
    for (const u of activeUsos()) counts[u.obraName] = (counts[u.obraName] || 0) + 1;
    const others = Object.keys(counts).filter((n) => n && !state.obras.some((o) => o.name === n));
    openSheet(`
      <h2>Obras y destinos</h2>
      <p class="sub">Los choferes eligen de esta lista al iniciar un uso, o escriben otra.</p>
      <div class="actions" style="margin-bottom:10px"><button class="btn primary" data-act="add">${icon('plus')}Nueva obra</button></div>
      <div class="card" style="box-shadow:none">
        ${obras.map((o) => `<div class="list-item tap" data-obra="${o.id}"><div class="icon-bubble ${o.active === false ? 'none' : ''}">${icon('building')}</div><div class="grow"><div class="name">${esc(o.name)}</div><div class="sub">${counts[o.name] || 0} usos${o.active === false ? ' · inactiva' : ''}${o.updatedBy || o.createdBy ? ` · editada por ${esc((o.updatedBy || o.createdBy).name)}${o.updatedAt || o.createdAt ? ` el ${esc(fmtDateTime(o.updatedAt || o.createdAt))}` : ''}` : ''}</div></div>${icon('chev', 'chev')}</div>`).join('') || '<div class="empty">Todavía no hay obras.</div>'}
      </div>
      ${others.length ? `<div class="section-title">Escritas a mano por los choferes</div><div class="card" style="box-shadow:none">${others.map((n) => `<div class="list-item"><div class="grow">${esc(n)} <span class="sub">· ${counts[n]} usos</span></div><button class="btn small" data-promote="${esc(n)}">Agregar a la lista</button></div>`).join('')}</div>` : ''}
      <div class="actions"><span class="spacer"></span><button class="btn ghost" data-sheet-close>Cerrar</button></div>`, {
      refresh: draw,
      onClick: (ev) => {
        if (ev.target.closest('[data-act="add"]')) return obraForm(null);
        const row = ev.target.closest('[data-obra]');
        if (row) return obraForm(row.dataset.obra);
        const p = ev.target.closest('[data-promote]');
        if (p) {
          const id = uid();
          FlotaCloud.put('obras', id, { id, name: p.dataset.promote, active: true, createdBy: stamp(), createdAt: Date.now(), updatedBy: stamp(), updatedAt: Date.now() });
        }
      },
    });
  };
  draw();
}

function openCalendarSheet() {
  const list = deadlines();
  openSheet(`
    <h2>Vencimientos</h2>
    <p class="sub">Agregá cada uno a Google Calendar, o bajá todos juntos en un archivo .ics (sirve para Google, Outlook y el calendario del iPhone).</p>
    <div class="actions" style="margin-bottom:10px"><button class="btn primary" data-act="ics">${icon('download')}Descargar .ics</button></div>
    <div class="card" style="box-shadow:none">
      ${list.map((dl) => `<div class="list-item"><div class="grow"><div class="name">${esc(dl.title)}</div><div class="sub">${esc(fmtDate(dl.date))} · ${esc(daysText(daysUntil(dl.date)))}</div></div><a class="btn small icon-only" href="${gcalLink(dl)}" target="_blank" rel="noopener" title="Google Calendar">${icon('calendar')}</a></div>`).join('') || '<div class="empty">No hay vencimientos con fecha.</div>'}
    </div>
    <div class="actions"><span class="spacer"></span><button class="btn ghost" data-sheet-close>Cerrar</button></div>`, {
    onClick: (ev) => {
      if (!ev.target.closest('[data-act="ics"]')) return;
      if (!list.length) return toast('No hay vencimientos con fecha.');
      download('flota-slavon-vencimientos.ics', buildIcs(list), 'text/calendar');
    },
  });
}

function openAllAlerts() {
  const list = alerts();
  openSheet(`<h2>Avisos</h2><div class="card" style="box-shadow:none">${list.map(alertRow).join('')}${missingRow(missingData(), !list.length)}</div>${alertsNote()}<div class="actions"><span class="spacer"></span><button class="btn ghost" data-sheet-close>Cerrar</button></div>`, {
    onClick: (ev) => { const el = ev.target.closest('[data-action="open-alert"]'); if (el) openAlert(el.dataset.kind, el.dataset.id); },
  });
}

function openAlert(kind, id) {
  if (kind === 'uso') return openUsoSheet(id);
  if (kind === 'task') return openTaskSheet(id);
  if (kind === 'doc') return openDocSheet(id);
  if (kind === 'fine') return openFineSheet(id);
}

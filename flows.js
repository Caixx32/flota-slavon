'use strict';

/* Cargas: iniciar y terminar uso, cargar nafta, y los formularios de admin y encargado. */

const OTRA = '__otra';

function vehicleOptions(list = activeVehicles()) {
  return Object.fromEntries(list.map((v) => [v.id, `${v.name}${v.plate ? ` · ${v.plate}` : ''}`]));
}

function obraOptions(current = '') {
  const opts = { '': 'Elegí la obra o destino…' };
  for (const o of state.obras.filter((x) => x.active !== false).sort((a, b) => a.name.localeCompare(b.name))) opts[o.id] = o.name;
  if (current && !opts[current] && current !== OTRA) opts[current] = byId(state.obras, current)?.name || current;
  opts[OTRA] = 'Otra (escribir el nombre)';
  return opts;
}

// Personas que pueden figurar como chofer: usuarios dados de alta + los que aparecen en usos viejos.
function peopleOptions(includeEmpty = false) {
  const map = new Map();
  for (const u of state.users) if (u.active !== false) map.set(u.email, u.name || u.email);
  for (const u of state.usos) if (u.driverEmail && !map.has(u.driverEmail)) map.set(u.driverEmail, u.driverName || u.driverEmail);
  if (state.me && !map.has(state.me.email)) map.set(state.me.email, state.me.name || state.me.email);
  const opts = includeEmpty ? { '': 'Sin chofer / no se sabe' } : {};
  [...map.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([k, v]) => { opts[k] = v; });
  return opts;
}

function personName(email) {
  return peopleOptions()[email] || email;
}

const savedMsg = () => (navigator.onLine ? 'Guardado.' : 'Guardado en el celular. Se sube solo cuando vuelva la señal.');

/* ---------- Iniciar uso ---------- */

function startUsoForm(vehicleId) {
  const list = activeVehicles();
  const v = byId(list, vehicleId) || list[0];
  if (!v) return toast('No hay vehículos cargados.', { error: true });
  const staff = isStaff();
  openForm({
    title: 'Iniciar uso',
    submitLabel: 'Iniciar uso',
    fields: [
      { name: 'vehicleId', label: 'Vehículo', type: 'select', options: vehicleOptions(list), value: v.id, required: true },
      ...(staff ? [{ name: 'driver', label: 'Chofer', type: 'select', options: peopleOptions(), value: state.me.email }] : []),
      { name: 'startAt', label: 'Fecha y hora de inicio', type: 'datetime', value: toLocalInput(Date.now()), disabled: !staff, hint: staff ? '' : 'Se toma la hora del celular.' },
      { name: 'kmStart', label: 'Km al subir (lo que marca el tablero)', type: 'number', step: 1, value: '', placeholder: String(v.km ?? ''), required: true },
      { name: 'photoStart', label: 'Foto del tablero al subir', type: 'photo', required: true },
      { name: 'obraId', label: 'Destino / obra', type: 'select', options: obraOptions(), value: '', required: true },
      { name: 'obraOther', label: 'Nombre de la obra o destino', type: 'text', hidden: true, placeholder: 'Ej.: Obra calle Rivadavia' },
    ],
    onInput: (form) => {
      const veh = byId(state.vehicles, form.vehicleId.value);
      showField('obraOther', form.obraId.value === OTRA);
      const km = numOrNull(form.kmStart.value);
      form.kmStart.placeholder = String(veh?.km ?? '');
      let hint = veh ? `Último km registrado: ${fmtKm(veh.km)}` : '';
      let cls = '';
      if (veh && km != null && km !== veh.km) {
        hint = `Ojo: el último km de bajada fue ${fmtKm(veh.km)} (diferencia de ${(km - veh.km).toLocaleString('es-AR')} km). Revisá el número; si está bien, se puede guardar igual.`;
        cls = 'warn';
      }
      if (veh?.status === 'taller') { hint = 'Este vehículo está en taller.'; cls = 'error'; }
      else if (veh?.openUsoId && veh.driverEmail) hint += ` · Ahora lo tiene ${veh.driverName || veh.driverEmail}.`;
      setHint('kmStart', hint, cls);
    },
    onSubmit: async (val) => {
      const veh = byId(state.vehicles, val.vehicleId);
      if (!veh) throw new FormError('Elegí el vehículo.');
      if (veh.status === 'taller' && !staff) throw new FormError('Este vehículo está en taller y no se puede usar.');
      const kmStart = numOrNull(val.kmStart);
      if (kmStart == null || kmStart < 0) throw new FormError('Cargá los km que marca el tablero.');
      if (!hasPhoto('photoStart')) throw new FormError('Falta la foto del tablero.');
      const obraName = val.obraId === OTRA ? (val.obraOther || '').trim() : byId(state.obras, val.obraId)?.name;
      if (!obraName) throw new FormError('Elegí la obra o escribí el destino.');
      const driverEmail = staff ? val.driver : state.me.email;
      const driverName = staff ? personName(val.driver) : (state.me.name || state.me.email);
      if (veh.openUsoId && veh.driverEmail === driverEmail) {
        throw new FormError(`${driverEmail === state.me.email ? 'Ya tenés' : 'Esa persona ya tiene'} un uso abierto en este vehículo. Primero terminalo.`);
      }
      const prev = veh.openUsoId || null;
      if (prev && !confirm(`Este vehículo figura en uso por ${veh.driverName || 'otro chofer'} y ese uso no se cerró.\n\nSe va a iniciar tu uso igual y el anterior queda marcado «sin cerrar» para que lo revise un encargado. ¿Seguimos?`)) return false;
      const startAt = staff ? (fromLocalInput(val.startAt) || Date.now()) : Date.now();
      const id = uid();
      const photo = await commitFormPhoto('photoStart', 'tablero');
      const uso = {
        id,
        vehicleId: veh.id,
        vehicleName: veh.name,
        driverEmail,
        driverName,
        startAt,
        kmStart,
        kmPrev: veh.km ?? null,
        photoStart: photo.meta,
        obraId: val.obraId === OTRA ? null : val.obraId,
        obraName,
        status: 'abierto',
        createdBy: stamp(),
        createdAt: FlotaCloud.serverTime(),
      };
      const ops = [
        ...photo.ops,
        { op: 'set', col: 'usos', id, data: uso },
        { op: 'update', col: 'vehicles', id: veh.id, data: { status: 'uso', openUsoId: id, driverEmail, driverName, usoStartAt: startAt } },
      ];
      if (prev) ops.push({ op: 'update', col: 'usos', id: prev, data: { status: 'sin_cerrar', flaggedBy: stamp(), flaggedAt: FlotaCloud.serverTime() } });
      FlotaCloud.write(ops);
      toast(`Uso iniciado en ${veh.name}. ${savedMsg()}`);
    },
  });
}

/* ---------- Terminar uso ---------- */

function endUsoForm(usoId) {
  const u = byId(state.usos, usoId);
  if (!u) return toast('No se encontró el uso abierto.', { error: true });
  const staff = isStaff();
  openForm({
    title: 'Terminar uso',
    submitLabel: 'Terminar uso',
    fields: [
      { type: 'html', html: `<div class="card" style="box-shadow:none"><div class="name">${esc(u.vehicleName || vehicleName(u.vehicleId))}</div><div class="sub">Desde ${esc(fmtDateTime(u.startAt))} · subió con ${esc(fmtKm(u.kmStart))} · ${esc(u.obraName || '')}</div>${u.status === 'sin_cerrar' ? '<div class="issue bad">Este uso quedó marcado «sin cerrar» porque otra persona tomó el vehículo. Podés cerrarlo igual.</div>' : ''}</div>` },
      { name: 'endAt', label: 'Fecha y hora de fin', type: 'datetime', value: toLocalInput(Date.now()), disabled: !staff, hint: staff ? '' : 'Se toma la hora del celular.' },
      { name: 'kmEnd', label: 'Km al bajar (lo que marca el tablero)', type: 'number', step: 1, value: '', required: true, placeholder: `Más de ${u.kmStart}` },
      { name: 'photoEnd', label: 'Foto del tablero al bajar', type: 'photo', required: true },
      { name: 'notes', label: 'Observaciones o daños (opcional)', type: 'textarea', value: '', placeholder: 'Ej.: ruido en el freno, rayón en la puerta trasera…' },
    ],
    onInput: (form) => {
      const km = numOrNull(form.kmEnd.value);
      if (km == null) setHint('kmEnd', `Subió con ${fmtKm(u.kmStart)}.`);
      else if (km <= u.kmStart) setHint('kmEnd', `Tiene que ser mayor a ${fmtKm(u.kmStart)} (los km de cuando subiste).`, 'error');
      else setHint('kmEnd', `Recorrido: ${fmtKm(km - u.kmStart)}.`);
    },
    onSubmit: async (val) => {
      const kmEnd = numOrNull(val.kmEnd);
      if (kmEnd == null) throw new FormError('Cargá los km que marca el tablero.');
      if (kmEnd <= u.kmStart) throw new FormError(`Los km al bajar (${fmtKm(kmEnd)}) tienen que ser mayores que los de subida (${fmtKm(u.kmStart)}).`);
      if (!hasPhoto('photoEnd')) throw new FormError('Falta la foto del tablero.');
      const endAt = staff ? (fromLocalInput(val.endAt) || Date.now()) : Date.now();
      if (endAt < u.startAt) throw new FormError('La hora de fin no puede ser anterior a la de inicio.');
      const photo = await commitFormPhoto('photoEnd', 'tablero');
      const data = {
        status: 'cerrado',
        endAt,
        kmEnd,
        photoEnd: photo.meta,
        notes: (val.notes || '').trim().slice(0, 2000),
        closedBy: stamp(),
        closedAt: FlotaCloud.serverTime(),
      };
      if (u.status === 'sin_cerrar') data.wasUnclosed = true;
      const ops = [...photo.ops, { op: 'update', col: 'usos', id: u.id, data }];
      const veh = byId(state.vehicles, u.vehicleId);
      if (veh && veh.openUsoId === u.id) {
        ops.push({ op: 'update', col: 'vehicles', id: veh.id, data: { status: 'disponible', openUsoId: null, driverEmail: null, driverName: null, usoStartAt: null, km: kmEnd, kmAt: Date.now() } });
      }
      FlotaCloud.write(ops);
      toast(`Uso terminado: ${fmtKm(kmEnd - u.kmStart)} recorridos. ${savedMsg()}`);
    },
  });
}

/* ---------- Cargar nafta ---------- */

function fuelForm(vehicleId) {
  const list = activeVehicles();
  const v = byId(list, vehicleId) || list[0];
  if (!v) return toast('No hay vehículos cargados.', { error: true });
  const staff = isStaff();
  openForm({
    title: 'Cargar nafta',
    fields: [
      { name: 'vehicleId', label: 'Vehículo', type: 'select', options: vehicleOptions(list), value: v.id, required: true },
      { name: 'at', label: 'Fecha y hora', type: 'datetime', value: toLocalInput(Date.now()), disabled: !staff, hint: staff ? '' : 'Se toma la hora del celular.' },
      { name: 'km', label: 'Km actual', type: 'number', step: 1, value: '', placeholder: String(v.km ?? ''), required: true },
      { type: 'html', html: '<div class="field-row">' },
      { name: 'liters', label: 'Litros', type: 'number', value: '', required: true, placeholder: '0,0' },
      { name: 'amount', label: 'Monto ($)', type: 'number', value: '', required: true, placeholder: '0' },
      { type: 'html', html: '</div>' },
      { name: 'station', label: 'Estación o lugar', type: 'text', value: '', required: true, placeholder: 'Ej.: YPF Av. San Martín' },
      { name: 'photo', label: 'Foto del ticket', type: 'photo', required: true },
    ],
    onInput: (form) => {
      const l = numOrNull(form.liters.value);
      const a = numOrNull(form.amount.value);
      setHint('amount', l > 0 && a > 0 ? `${money.format(a / l)} por litro` : '');
    },
    onSubmit: async (val) => {
      const veh = byId(state.vehicles, val.vehicleId);
      const km = numOrNull(val.km);
      const liters = numOrNull(val.liters);
      const amount = numOrNull(val.amount);
      if (!veh) throw new FormError('Elegí el vehículo.');
      if (km == null || km < 0) throw new FormError('Cargá los km actuales.');
      if (!(liters > 0) || liters >= 500) throw new FormError('Revisá los litros.');
      if (!(amount > 0)) throw new FormError('Revisá el monto.');
      if (!hasPhoto('photo')) throw new FormError('Falta la foto del ticket.');
      const at = staff ? (fromLocalInput(val.at) || Date.now()) : Date.now();
      const date = toISO(new Date(at));
      const id = uid();
      const [rate, photo] = await Promise.all([rateFor(date), commitFormPhoto('photo', 'ticket')]);
      const doc = {
        id, vehicleId: veh.id, vehicleName: veh.name, cat: 'combustible', source: 'carga', date, at, km, liters, amount,
        station: (val.station || '').trim(), photo: photo.meta, usdRate: rate.usdRate, rateApprox: rate.rateApprox,
        createdBy: stamp(), createdAt: FlotaCloud.serverTime(),
      };
      FlotaCloud.write([...photo.ops, { op: 'set', col: 'expenses', id, data: doc }]);
      toast(`Carga guardada: ${num.format(liters)} l por ${money.format(amount)}. ${savedMsg()}`);
    },
  });
}

/* ---------- Vehículos ---------- */

function defaultTasksFor(vehicleId, type) {
  return (DEFAULT_TASKS[type] || DEFAULT_TASKS.utilitario).map(([name, everyKm, everyMonths]) => ({
    id: uid(), vehicleId, name, everyKm, everyMonths, lastKm: null, lastDate: null, history: [],
  }));
}

function defaultDocsFor(vehicleId) {
  return DEFAULT_DOCS.map(([name, notifyDays]) => ({ id: uid(), vehicleId, name, number: '', expiry: '', notifyDays, note: '', files: [] }));
}

function newVehicleOps(v) {
  return [
    { op: 'set', col: 'vehicles', id: v.id, data: v },
    ...defaultTasksFor(v.id, v.type).map((t) => ({ op: 'set', col: 'tasks', id: t.id, data: t })),
    ...defaultDocsFor(v.id).map((d) => ({ op: 'set', col: 'docs', id: d.id, data: d })),
  ];
}

function vehicleForm(id) {
  const v = byId(state.vehicles, id);
  openForm({
    title: v ? `Editar ${v.name}` : 'Agregar vehículo',
    fields: [
      { name: 'name', label: 'Nombre', value: v?.name || '', required: true, placeholder: 'Ej.: Kangoo blanca' },
      { name: 'type', label: 'Tipo', type: 'select', options: VEHICLE_TYPES, value: v?.type || 'utilitario', hint: v ? '' : 'Define las tareas de service que se cargan por defecto.' },
      { type: 'html', html: '<div class="field-row">' },
      { name: 'plate', label: 'Patente', value: v?.plate || '', placeholder: 'AB 123 CD' },
      { name: 'year', label: 'Año', type: 'number', step: 1, value: v?.year ?? '' },
      { type: 'html', html: '</div>' },
      { name: 'brand', label: 'Marca y modelo', value: v?.brand || '', placeholder: 'Ej.: Renault Kangoo II' },
      { name: 'km', label: 'Km actual', type: 'number', step: 1, value: v?.km ?? 0, hint: v ? 'Normalmente se actualiza solo con el km de bajada de cada uso.' : '' },
      { name: 'status', label: 'Estado', type: 'select', options: VEHICLE_STATUS, value: v?.status || 'disponible' },
      { name: 'photo', label: 'Foto (opcional)', type: 'photo', value: v?.photo || null, capture: false, placeholder: 'Tocá para elegir una foto' },
      { name: 'notes', label: 'Notas', type: 'textarea', value: v?.notes || '' },
    ],
    onSubmit: async (val) => {
      const km = numOrNull(val.km) ?? 0;
      const photo = await commitFormPhoto('photo', 'vehicle');
      const base = v ? { ...v } : { id: uid(), active: true, openUsoId: null, order: state.vehicles.length, createdBy: stamp(), createdAt: FlotaCloud.serverTime() };
      const data = {
        ...base,
        name: val.name.trim(), type: val.type, plate: val.plate.trim().toUpperCase(), year: numOrNull(val.year), brand: val.brand.trim(),
        km, status: val.status, photo: photo.meta, notes: val.notes.trim(), updatedBy: stamp(), updatedAt: FlotaCloud.serverTime(),
      };
      if (v && v.status === 'uso' && val.status !== 'uso') Object.assign(data, { openUsoId: null, driverEmail: null, driverName: null, usoStartAt: null });
      if (v && km !== v.km) data.kmAt = Date.now();
      FlotaCloud.write([...photo.ops, ...(v ? [{ op: 'set', col: 'vehicles', id: data.id, data }] : newVehicleOps(data))]);
      toast(v ? 'Vehículo actualizado.' : `${data.name} agregado, con sus tareas de service y papeles básicos.`);
    },
  });
}

function toggleVehicleActive(id) {
  const v = byId(state.vehicles, id);
  if (!v) return;
  if (v.active !== false && !confirm(`¿Dar de baja ${v.name}? Deja de aparecer para los choferes y en los avisos. El historial se conserva y lo podés reactivar.`)) return;
  FlotaCloud.patch('vehicles', id, { active: v.active === false, updatedBy: stamp(), updatedAt: FlotaCloud.serverTime() });
  toast(v.active === false ? 'Vehículo reactivado.' : 'Vehículo dado de baja.');
}

/* ---------- Service ---------- */

function taskForm(id, vehicleId) {
  const t = byId(state.tasks, id);
  openForm({
    title: t ? 'Editar tarea' : 'Nueva tarea de service',
    fields: [
      { name: 'name', label: 'Tarea', value: t?.name || '', required: true, placeholder: 'Ej.: Cambio de pastillas' },
      { type: 'html', html: '<div class="field-row">' },
      { name: 'everyKm', label: 'Cada (km)', type: 'number', step: 1, value: t?.everyKm || '', placeholder: '0 = no' },
      { name: 'everyMonths', label: 'Cada (meses)', type: 'number', step: 1, value: t?.everyMonths || '', placeholder: '0 = no' },
      { type: 'html', html: '</div>' },
    ],
    onSubmit: (val) => {
      const data = { ...(t || { id: uid(), vehicleId, history: [], lastKm: null, lastDate: null }), name: val.name.trim(), everyKm: numOrNull(val.everyKm) || 0, everyMonths: numOrNull(val.everyMonths) || 0 };
      FlotaCloud.put('tasks', data.id, data);
    },
    onDelete: t ? () => FlotaCloud.del('tasks', t.id) : null,
  });
}

function doneTaskForm(id) {
  const t = byId(state.tasks, id);
  const v = byId(state.vehicles, t?.vehicleId);
  if (!t) return;
  openForm({
    title: `Registrar: ${t.name}`,
    fields: [
      { type: 'html', html: '<div class="field-row">' },
      { name: 'date', label: 'Fecha', type: 'date', value: today(), required: true },
      { name: 'km', label: 'Km', type: 'number', step: 1, value: v?.km ?? '' },
      { type: 'html', html: '</div>' },
      { name: 'shop', label: 'Taller', value: '', placeholder: 'Ej.: Lubricentro Norte' },
      { name: 'cost', label: 'Costo ($)', type: 'number', value: '', hint: 'Si ponés el costo, se carga también como gasto de service.' },
      { name: 'note', label: 'Notas', type: 'textarea', value: '' },
    ],
    onSubmit: async (val) => {
      const cost = numOrNull(val.cost);
      const entry = { id: uid(), date: val.date, km: numOrNull(val.km), shop: val.shop.trim(), cost, note: val.note.trim(), expenseId: null, by: stamp(), at: Date.now() };
      const ops = [];
      if (cost) {
        const rate = await rateFor(val.date);
        entry.expenseId = uid();
        ops.push({ op: 'set', col: 'expenses', id: entry.expenseId, data: { id: entry.expenseId, vehicleId: t.vehicleId, vehicleName: v?.name || '', cat: 'service', date: val.date, amount: cost, note: `${t.name}${entry.shop ? ` · ${entry.shop}` : ''}`, km: entry.km, taskId: t.id, ...rate, files: [], createdBy: stamp(), createdAt: FlotaCloud.serverTime() } });
      }
      const nt = { ...t, history: [...(t.history || []), entry] };
      recomputeLast(nt);
      ops.push({ op: 'set', col: 'tasks', id: t.id, data: nt });
      if (v && entry.km != null && entry.km > (v.km || 0)) ops.push({ op: 'update', col: 'vehicles', id: v.id, data: { km: entry.km, kmAt: Date.now() } });
      FlotaCloud.write(ops);
      toast('Service registrado.');
    },
  });
}

function removeTaskEntry(taskId, entryId) {
  const t = byId(state.tasks, taskId);
  const entry = t?.history.find((h) => h.id === entryId);
  if (!entry || !confirm('¿Borrar este registro del historial?')) return;
  const nt = { ...t, history: t.history.filter((h) => h.id !== entryId) };
  recomputeLast(nt);
  const ops = [{ op: 'set', col: 'tasks', id: t.id, data: nt }];
  if (entry.expenseId && byId(state.expenses, entry.expenseId) && confirm('¿Borrar también el gasto de service asociado?')) ops.push({ op: 'delete', col: 'expenses', id: entry.expenseId });
  FlotaCloud.write(ops);
}

/* ---------- Papeles ---------- */

function docForm(id, vehicleId) {
  const d = byId(state.docs, id);
  openForm({
    title: d ? `Editar ${d.name}` : 'Nuevo papel',
    fields: [
      { name: 'name', label: 'Papel', value: d?.name || '', required: true, placeholder: 'Ej.: Póliza de seguro' },
      { name: 'number', label: 'Número', value: d?.number || '' },
      { type: 'html', html: '<div class="field-row">' },
      { name: 'expiry', label: 'Vencimiento', type: 'date', value: d?.expiry || '' },
      { name: 'notifyDays', label: 'Avisar días antes', type: 'number', step: 1, value: d?.notifyDays ?? SOON_DAYS },
      { type: 'html', html: '</div>' },
      { name: 'note', label: 'Notas', type: 'textarea', value: d?.note || '' },
      { name: 'files', label: 'Fotos o PDF', type: 'files', value: d?.files || [] },
    ],
    onSubmit: async (val) => {
      const { ops, files } = await commitFormFiles('doc');
      const data = { ...(d || { id: uid(), vehicleId }), name: val.name.trim(), number: val.number.trim(), expiry: val.expiry, notifyDays: numOrNull(val.notifyDays) ?? SOON_DAYS, note: val.note.trim(), files, updatedBy: stamp(), updatedAt: FlotaCloud.serverTime() };
      FlotaCloud.write([...ops, { op: 'set', col: 'docs', id: data.id, data }]);
    },
    onDelete: d ? () => FlotaCloud.write([...d.files.flatMap(removeAttachmentOps), { op: 'delete', col: 'docs', id: d.id }]) : null,
  });
}

/* ---------- Gastos ---------- */

function expenseForm(id, vehicleId, presetCat = 'combustible') {
  const e = byId(state.expenses, id);
  const isCarga = e?.source === 'carga';
  const vid = e?.vehicleId || vehicleId || activeVehicles()[0]?.id;
  openForm({
    title: e ? (isCarga ? 'Editar carga de nafta' : 'Editar gasto') : 'Nuevo gasto',
    fields: [
      { name: 'vehicleId', label: 'Vehículo', type: 'select', options: vehicleOptions(state.vehicles), value: vid, required: true },
      { name: 'cat', label: 'Categoría', type: 'select', options: Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, c.label])), value: e?.cat || presetCat, disabled: isCarga },
      { type: 'html', html: '<div class="field-row">' },
      { name: 'date', label: 'Fecha', type: 'date', value: e?.date || today(), required: true },
      { name: 'amount', label: 'Monto ($)', type: 'number', value: e?.amount ?? '', required: true },
      { type: 'html', html: '</div>' },
      { type: 'html', html: '<div class="field-row" data-fuel-row>' },
      { name: 'liters', label: 'Litros', type: 'number', value: e?.liters ?? '' },
      { name: 'km', label: 'Km', type: 'number', step: 1, value: e?.km ?? '' },
      { type: 'html', html: '</div>' },
      { name: 'station', label: 'Estación / lugar', value: e?.station || '' },
      { name: 'note', label: 'Detalle', value: e?.note || '' },
      ...(isCarga ? [] : [{ name: 'files', label: 'Comprobante', type: 'files', value: e?.files || [] }]),
      ...(e?.createdBy ? [{ type: 'html', html: `<p class="sub small">Cargado por ${esc(e.createdBy.name)} · ${esc(fmtDateTime(e.at || e.createdAt?.toMillis?.()))}${e.usdRate ? ` · dólar blue ${money.format(e.usdRate)}${e.rateApprox ? ' (aprox.)' : ''}` : ''}</p>` }] : []),
    ],
    onInput: (form) => {
      const fuel = (form.cat.value || e?.cat) === 'combustible';
      const row = modalFields.querySelector('[data-fuel-row]');
      if (row) row.hidden = !fuel;
      showField('station', fuel || form.cat.value === 'peaje');
    },
    onSubmit: async (val) => {
      const amount = numOrNull(val.amount);
      if (!(amount > 0)) throw new FormError('Revisá el monto.');
      const { ops, files } = await commitFormFiles('expense');
      const cat = isCarga ? 'combustible' : val.cat;
      const rate = !e || e.date !== val.date || !e.usdRate ? await rateFor(val.date) : { usdRate: e.usdRate, rateApprox: e.rateApprox };
      const data = {
        ...(e || { id: uid(), createdBy: stamp(), createdAt: FlotaCloud.serverTime() }),
        vehicleId: val.vehicleId, vehicleName: vehicleName(val.vehicleId), cat, date: val.date, amount,
        liters: cat === 'combustible' ? numOrNull(val.liters) : null, km: numOrNull(val.km), station: (val.station || '').trim(), note: (val.note || '').trim(),
        ...rate, updatedBy: stamp(), updatedAt: FlotaCloud.serverTime(),
      };
      if (!isCarga) data.files = files;
      FlotaCloud.write([...ops, { op: 'set', col: 'expenses', id: data.id, data }]);
    },
    onDelete: e ? () => FlotaCloud.write([...(e.files || []).flatMap(removeAttachmentOps), ...removeAttachmentOps(e.photo), { op: 'delete', col: 'expenses', id: e.id }]) : null,
  });
}

/* ---------- Multas ---------- */

function fineForm(id, vehicleId) {
  const f = byId(state.fines, id);
  const vid = f?.vehicleId || vehicleId || activeVehicles()[0]?.id;
  const guess = (vId, date, time) => (date ? driverAt(vId, new Date(`${date}T${time || '12:00'}`).getTime()) : null);
  openForm({
    title: f ? 'Editar multa' : 'Nueva multa',
    fields: [
      { name: 'vehicleId', label: 'Vehículo', type: 'select', options: vehicleOptions(state.vehicles), value: vid, required: true },
      { type: 'html', html: '<div class="field-row">' },
      { name: 'date', label: 'Fecha de la infracción', type: 'date', value: f?.date || today(), required: true },
      { name: 'time', label: 'Hora', type: 'time', value: f?.time || '' },
      { type: 'html', html: '</div>' },
      { name: 'driverEmail', label: 'Chofer que lo tenía', type: 'select', options: peopleOptions(true), value: f?.driverEmail || '' },
      { name: 'reason', label: 'Motivo', value: f?.reason || '', required: true, placeholder: 'Ej.: Exceso de velocidad' },
      { name: 'place', label: 'Lugar', value: f?.place || '' },
      { type: 'html', html: '<div class="field-row">' },
      { name: 'amount', label: 'Monto ($)', type: 'number', value: f?.amount ?? '' },
      { name: 'dueDate', label: 'Vence el pago', type: 'date', value: f?.dueDate || '' },
      { type: 'html', html: '</div>' },
      { name: 'status', label: 'Estado', type: 'select', options: FINE_STATUS, value: f?.status || 'pendiente', hint: 'Al marcarla pagada se carga como gasto de multas.' },
      { name: 'note', label: 'Notas', type: 'textarea', value: f?.note || '' },
      { name: 'files', label: 'Foto del acta', type: 'files', value: f?.files || [] },
    ],
    onInput: (form, ev) => {
      const g = guess(form.vehicleId.value, form.date.value, form.time.value);
      setHint('driverEmail', g ? `Según los usos, lo tenía ${g.name || g.email}.` : 'No hay un uso registrado en ese momento.', g ? '' : 'warn');
      const touched = ev?.target?.name;
      if (g && (!f || ['vehicleId', 'date', 'time'].includes(touched)) && (!form.driverEmail.value || touched)) {
        if (!form.driverEmail.querySelector(`option[value="${CSS.escape(g.email)}"]`)) form.driverEmail.add(new Option(g.name || g.email, g.email));
        form.driverEmail.value = g.email;
      }
    },
    onSubmit: async (val) => {
      const { ops, files } = await commitFormFiles('fine');
      const amount = numOrNull(val.amount);
      const data = {
        ...(f || { id: uid(), createdBy: stamp(), createdAt: FlotaCloud.serverTime(), expenseId: null }),
        vehicleId: val.vehicleId, date: val.date, time: val.time, driverEmail: val.driverEmail || null, driverName: val.driverEmail ? personName(val.driverEmail) : null,
        reason: val.reason.trim(), place: val.place.trim(), amount, dueDate: val.dueDate, status: val.status, note: val.note.trim(), files, updatedBy: stamp(), updatedAt: FlotaCloud.serverTime(),
      };
      if (val.status === 'pagada' && amount) {
        const exp = data.expenseId && byId(state.expenses, data.expenseId);
        const eid = data.expenseId || uid();
        const rate = exp?.usdRate ? { usdRate: exp.usdRate, rateApprox: exp.rateApprox } : await rateFor(today());
        data.expenseId = eid;
        ops.push({ op: 'set', col: 'expenses', id: eid, data: { ...(exp || { id: eid, createdBy: stamp(), createdAt: FlotaCloud.serverTime(), files: [] }), vehicleId: data.vehicleId, vehicleName: vehicleName(data.vehicleId), cat: 'multa', date: exp?.date || today(), amount, note: `Multa: ${data.reason}`, fineId: data.id, ...rate } });
      }
      FlotaCloud.write([...ops, { op: 'set', col: 'fines', id: data.id, data }]);
    },
    onDelete: f ? () => FlotaCloud.write([...f.files.flatMap(removeAttachmentOps), { op: 'delete', col: 'fines', id: f.id }]) : null,
  });
}

/* ---------- Revisar y corregir usos ---------- */

const USO_FIELDS = {
  driverEmail: 'Chofer', vehicleId: 'Vehículo', startAt: 'Inicio', kmStart: 'Km subida', obraName: 'Obra', endAt: 'Fin', kmEnd: 'Km bajada', status: 'Estado', notes: 'Observaciones',
};

function fmtUsoValue(k, v) {
  if (v == null || v === '') return '—';
  if (k === 'startAt' || k === 'endAt') return fmtDateTime(v);
  if (k === 'kmStart' || k === 'kmEnd') return fmtKm(v);
  if (k === 'status') return USO_STATUS[v] || v;
  if (k === 'vehicleId') return vehicleName(v);
  if (k === 'driverEmail') return personName(v);
  return String(v);
}

function usoCorrectionForm(id) {
  const u = byId(state.usos, id);
  if (!u) return;
  const obraValue = u.obraId && byId(state.obras, u.obraId) ? u.obraId : OTRA;
  openForm({
    title: 'Corregir uso',
    fields: [
      { name: 'driverEmail', label: 'Chofer', type: 'select', options: { ...peopleOptions(), [u.driverEmail]: u.driverName || u.driverEmail }, value: u.driverEmail },
      { name: 'vehicleId', label: 'Vehículo', type: 'select', options: vehicleOptions(state.vehicles), value: u.vehicleId },
      { type: 'html', html: '<div class="field-row">' },
      { name: 'startAt', label: 'Inicio', type: 'datetime', value: toLocalInput(u.startAt), required: true },
      { name: 'kmStart', label: 'Km subida', type: 'number', step: 1, value: u.kmStart ?? '', required: true },
      { type: 'html', html: '</div><div class="field-row">' },
      { name: 'endAt', label: 'Fin', type: 'datetime', value: u.endAt ? toLocalInput(u.endAt) : '' },
      { name: 'kmEnd', label: 'Km bajada', type: 'number', step: 1, value: u.kmEnd ?? '' },
      { type: 'html', html: '</div>' },
      { name: 'obraId', label: 'Obra / destino', type: 'select', options: obraOptions(obraValue), value: obraValue },
      { name: 'obraOther', label: 'Nombre de la obra', value: obraValue === OTRA ? (u.obraName || '') : '', hidden: obraValue !== OTRA },
      { name: 'status', label: 'Estado', type: 'select', options: USO_STATUS, value: u.status },
      { name: 'notes', label: 'Observaciones', type: 'textarea', value: u.notes || '' },
      { name: 'reviewed', label: 'Marcar como revisado (saca los avisos de km raros y «sin cerrar»)', type: 'check', value: true },
      { name: 'reason', label: 'Motivo de la corrección', value: '', placeholder: 'Ej.: el chofer se olvidó de cerrar' },
    ],
    onInput: (form) => showField('obraOther', form.obraId.value === OTRA),
    onSubmit: (val) => {
      const next = {
        driverEmail: val.driverEmail,
        vehicleId: val.vehicleId,
        // Si no se tocó la hora, se conserva la original (el formulario no muestra segundos).
        startAt: val.startAt === toLocalInput(u.startAt) ? u.startAt : fromLocalInput(val.startAt),
        kmStart: numOrNull(val.kmStart),
        endAt: !val.endAt ? null : u.endAt && val.endAt === toLocalInput(u.endAt) ? u.endAt : fromLocalInput(val.endAt),
        kmEnd: numOrNull(val.kmEnd),
        obraName: val.obraId === OTRA ? val.obraOther.trim() : byId(state.obras, val.obraId)?.name || u.obraName,
        status: val.status,
        notes: val.notes.trim(),
      };
      if (next.status === 'cerrado' && (next.kmEnd == null || !next.endAt)) throw new FormError('Para cerrarlo hacen falta el fin y el km de bajada.');
      if (next.kmEnd != null && next.kmEnd <= next.kmStart) throw new FormError('El km de bajada tiene que ser mayor que el de subida.');
      if (next.endAt && next.endAt < next.startAt) throw new FormError('El fin no puede ser anterior al inicio.');
      const changes = {};
      for (const k of Object.keys(next)) {
        const before = k === 'notes' ? (u.notes || '') : (u[k] ?? null);
        if (before !== (next[k] ?? null)) changes[k] = [before, next[k] ?? null];
      }
      const reviewNow = val.reviewed && !u.reviewed;
      if (!Object.keys(changes).length && !reviewNow) return;
      const data = {
        ...next,
        driverName: personName(next.driverEmail),
        vehicleName: vehicleName(next.vehicleId),
        obraId: val.obraId === OTRA ? null : val.obraId,
        reviewed: !!val.reviewed,
        corrections: [...(u.corrections || []), { by: stamp(), at: Date.now(), changes, reviewed: reviewNow, reason: val.reason.trim() }],
      };
      const ops = [{ op: 'update', col: 'usos', id: u.id, data }];
      // Si este uso era el abierto del vehículo y se cerró, el vehículo queda libre con su km de bajada.
      const veh = byId(state.vehicles, u.vehicleId);
      if (veh && veh.openUsoId === u.id && next.status !== 'abierto') {
        ops.push({ op: 'update', col: 'vehicles', id: veh.id, data: { status: veh.status === 'uso' ? 'disponible' : veh.status, openUsoId: null, driverEmail: null, driverName: null, usoStartAt: null, ...(next.kmEnd != null && next.kmEnd > (veh.km || 0) ? { km: next.kmEnd, kmAt: Date.now() } : {}) } });
      } else if (veh && !veh.openUsoId && changes.kmEnd && isLatestUso(u)) {
        ops.push({ op: 'update', col: 'vehicles', id: veh.id, data: { km: next.kmEnd, kmAt: Date.now() } });
      }
      FlotaCloud.write(ops);
      toast('Uso corregido. Quedó registrado quién y cuándo.');
    },
  });
}

function isLatestUso(u) {
  const last = state.usos.filter((x) => x.vehicleId === u.vehicleId && x.endAt).sort((a, b) => b.endAt - a.endAt)[0];
  return last?.id === u.id;
}

function markUsoReviewed(id) {
  const u = byId(state.usos, id);
  if (!u) return;
  FlotaCloud.patch('usos', id, { reviewed: true, corrections: [...(u.corrections || []), { by: stamp(), at: Date.now(), changes: {}, reviewed: true, reason: 'Revisado sin cambios' }] });
  toast('Marcado como revisado.');
}

function deleteUso(id) {
  const u = byId(state.usos, id);
  if (!u || !confirm('¿Eliminar este uso? No se puede deshacer.')) return;
  const ops = [...removeAttachmentOps(u.photoStart), ...removeAttachmentOps(u.photoEnd), { op: 'delete', col: 'usos', id }];
  const veh = byId(state.vehicles, u.vehicleId);
  if (veh?.openUsoId === id) ops.push({ op: 'update', col: 'vehicles', id: veh.id, data: { status: 'disponible', openUsoId: null, driverEmail: null, driverName: null, usoStartAt: null } });
  FlotaCloud.write(ops);
  closeSheet();
}

/* ---------- Usuarios, obras y configuración ---------- */

function userForm(email) {
  const u = state.users.find((x) => x.email === email);
  const isOwnerRow = email && email === FLOTA_CONFIG.ownerEmail;
  openForm({
    title: u ? 'Editar usuario' : 'Dar de alta un usuario',
    fields: [
      { name: 'email', label: 'Mail de Google', type: 'email', value: u?.email || '', required: true, disabled: !!u, placeholder: 'nombre@gmail.com' },
      { name: 'name', label: 'Nombre', value: u?.name || '', placeholder: 'Se completa solo cuando entra por primera vez' },
      { name: 'role', label: 'Rol', type: 'select', options: { chofer: 'Chofer — iniciar/terminar uso y cargar nafta', encargado: 'Encargado — todo menos usuarios', admin: 'Admin — todo' }, value: u?.role || 'chofer', disabled: isOwnerRow },
      { name: 'active', label: 'Activo (puede entrar)', type: 'check', value: u ? u.active !== false : true, disabled: isOwnerRow },
      ...(isOwnerRow ? [{ type: 'html', html: '<p class="sub small">Es el dueño de la app: siempre es admin.</p>' }] : []),
    ],
    onSubmit: (val) => {
      const mail = (u?.email || val.email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new FormError('Revisá el mail.');
      if (!u && state.users.some((x) => x.email === mail)) throw new FormError('Ese mail ya está dado de alta.');
      const data = {
        ...(u || { email: mail, addedBy: stamp(), addedAt: Date.now() }),
        name: val.name.trim() || u?.name || '',
        role: isOwnerRow ? 'admin' : val.role,
        active: isOwnerRow ? true : !!val.active,
        updatedBy: stamp(),
        updatedAt: Date.now(),
      };
      FlotaCloud.put('users', mail, data);
      toast(u ? 'Usuario actualizado.' : `Listo: ${mail} ya puede entrar como ${ROLES[data.role].toLowerCase()}.`);
    },
    onDelete: u && !isOwnerRow ? () => FlotaCloud.del('users', u.email) : null,
  });
}

function obraForm(id) {
  const o = byId(state.obras, id);
  openForm({
    title: o ? 'Editar obra' : 'Nueva obra',
    fields: [
      { name: 'name', label: 'Nombre', value: o?.name || '', required: true },
      { name: 'active', label: 'Activa (aparece para elegir)', type: 'check', value: o ? o.active !== false : true },
    ],
    onSubmit: (val) => {
      const data = { ...(o || { id: uid(), createdBy: stamp() }), name: val.name.trim(), active: !!val.active };
      FlotaCloud.put('obras', data.id, data);
    },
    onDelete: o ? () => FlotaCloud.del('obras', o.id) : null,
  });
}

function configForm() {
  const c = state.config;
  openForm({
    title: 'Configuración de avisos',
    fields: [
      { name: 'openHours', label: 'Avisar si un uso sigue abierto más de (horas)', type: 'number', step: 1, value: c.openHours },
      { name: 'maxKmUso', label: 'Avisar si un uso recorre más de (km)', type: 'number', step: 1, value: c.maxKmUso },
      { name: 'kmTolerance', label: 'Diferencia de km tolerada entre bajada y la siguiente subida', type: 'number', step: 1, value: c.kmTolerance, hint: '0 = avisar ante cualquier diferencia.' },
    ],
    onSubmit: (val) => {
      const data = {
        ...c,
        openHours: Math.max(1, numOrNull(val.openHours) || 12),
        maxKmUso: Math.max(1, numOrNull(val.maxKmUso) || 500),
        kmTolerance: Math.max(0, numOrNull(val.kmTolerance) || 0),
        updatedBy: stamp(),
      };
      FlotaCloud.put('config', 'general', data);
    },
  });
}

'use strict';

/* Reportes (admin y encargado) y exportación a Excel con SheetJS. */

const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';

const rep = { mode: 'mes', month: today().slice(0, 7), from: addDays(today(), -30), to: today() };

function reportRange() {
  if (rep.mode === 'mes') {
    const [y, m] = rep.month.split('-').map(Number);
    return { from: `${rep.month}-01`, to: toISO(new Date(y, m, 0)), label: monthLabel(rep.month) };
  }
  const from = rep.from <= rep.to ? rep.from : rep.to;
  const to = rep.from <= rep.to ? rep.to : rep.from;
  return { from, to, label: `${fmtDate(from)} al ${fmtDate(to)}` };
}

function reportData({ from, to }) {
  // Los usos anulados no cuentan en los reportes.
  const usos = activeUsos().filter((u) => inRange(u.startAt, from, to));
  const expenses = state.expenses.filter((e) => inRange(expenseTime(e), from, to));
  const cargas = expenses.filter((e) => e.cat === 'combustible');

  const group = (list, keyFn, init) => {
    const m = new Map();
    for (const x of list) {
      const k = keyFn(x);
      if (!m.has(k)) m.set(k, init(x));
      m.get(k).items.push(x);
    }
    return [...m.values()];
  };

  const drivers = group(usos, (u) => u.driverEmail, (u) => ({ name: u.driverName || u.driverEmail, items: [] })).map((g) => ({
    name: g.name, usos: g.items.length, km: g.items.reduce((s, u) => s + (usoKm(u) || 0), 0), hours: g.items.reduce((s, u) => s + (usoHours(u) || 0), 0),
  })).sort((a, b) => b.km - a.km);

  const vehicles = state.vehicles.map((v) => {
    const vu = usos.filter((u) => u.vehicleId === v.id);
    const ve = expenses.filter((e) => e.vehicleId === v.id);
    const liters = cargas.filter((e) => e.vehicleId === v.id).reduce((s, e) => s + (e.liters || 0), 0);
    const km = vu.reduce((s, u) => s + (usoKm(u) || 0), 0);
    const total = ve.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totalUsd = ve.reduce((s, e) => s + (inUsd(e) || 0), 0);
    return { id: v.id, name: v.name, usos: vu.length, km, liters, total, totalUsd, kml: liters ? km / liters : null, perKm: km ? total / km : null };
  }).filter((v) => v.usos || v.total);

  const obras = group(usos, (u) => u.obraName || 'Sin obra', (u) => ({ name: u.obraName || 'Sin obra', items: [] })).map((g) => ({
    name: g.name, usos: g.items.length, km: g.items.reduce((s, u) => s + (usoKm(u) || 0), 0), hours: g.items.reduce((s, u) => s + (usoHours(u) || 0), 0),
  })).sort((a, b) => b.usos - a.usos || b.km - a.km);

  const byCat = Object.entries(CATEGORIES).map(([k, c]) => ({ key: k, label: c.label, color: c.color, value: expenses.filter((e) => e.cat === k).reduce((s, e) => s + (Number(e.amount) || 0), 0) }))
    .filter((s) => s.value > 0).sort((a, b) => b.value - a.value).map((s) => ({ ...s, display: money.format(s.value) }));

  return {
    usos, expenses, cargas, drivers, vehicles, obras, byCat,
    totalKm: usos.reduce((s, u) => s + (usoKm(u) || 0), 0),
    totalHours: usos.reduce((s, u) => s + (usoHours(u) || 0), 0),
    totalExp: expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    totalUsd: expenses.reduce((s, e) => s + (inUsd(e) || 0), 0),
  };
}

function renderReports() {
  const range = reportRange();
  const d = reportData(range);
  const endMonth = rep.mode === 'mes' ? rep.month : range.to.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(endMonth, i - 11)).map((key) => {
    const value = state.expenses.filter((e) => (e.date || '').startsWith(key)).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { key, label: monthLabel(key, { month: 'short' }).replace('.', ''), value, tip: `${monthLabel(key)}: ${money.format(value)}` };
  });
  const n = (x, digits = 0) => (x == null ? '—' : x.toLocaleString('es-AR', { maximumFractionDigits: digits }));

  view.innerHTML = `
    ${pageHead('Reportes', esc(range.label))}
    ${segmented('repmode', { mes: 'Por mes', rango: 'Rango de fechas' }, rep.mode)}
    ${rep.mode === 'mes'
      ? `<div class="month-nav"><button class="btn icon-only" data-repmonth="-1">${icon('left')}</button><span class="label">${esc(monthLabel(rep.month))}</span><button class="btn icon-only" data-repmonth="1">${icon('chev')}</button></div>`
      : `<div class="filters"><label>Desde<input type="date" data-rep="from" value="${rep.from}"></label><label>Hasta<input type="date" data-rep="to" value="${rep.to}"></label></div>`}

    <div class="tiles">
      <div class="tile"><div class="label">Usos</div><div class="value">${d.usos.length}</div></div>
      <div class="tile"><div class="label">Km</div><div class="value">${n(d.totalKm)}</div></div>
      <div class="tile"><div class="label">Horas</div><div class="value">${n(d.totalHours, 1)}</div></div>
      <div class="tile"><div class="label">Gasto</div><div class="value">${esc(shortMoney(d.totalExp, 'ARS'))}<small> · ${esc(shortMoney(d.totalUsd, 'USD'))}</small></div></div>
    </div>

    <div class="actions"><button class="btn primary" data-action="export-xlsx">${icon('sheet')}Exportar a Excel</button><button class="btn" data-action="export-xlsx-all">Exportar todo</button></div>

    <div class="section-title">Por chofer</div>
    <div class="card">
      ${hBarChart(d.drivers.map((x) => ({ label: x.name, value: x.km, display: fmtKm(x.km) })))}
      ${d.drivers.length ? `<div class="table-wrap" style="margin-top:12px"><table class="report"><tr><th>Chofer</th><th class="n">Usos</th><th class="n">Km</th><th class="n">Horas</th></tr>
        ${d.drivers.map((x) => `<tr><td>${esc(x.name)}</td><td class="n">${x.usos}</td><td class="n">${n(x.km)}</td><td class="n">${esc(fmtHours(x.hours))}</td></tr>`).join('')}</table></div>` : ''}
    </div>

    <div class="section-title">Por vehículo</div>
    <div class="card">
      ${hBarChart(d.vehicles.map((x) => ({ label: x.name, value: x.total, display: money.format(x.total) })))}
      ${d.vehicles.length ? `<div class="table-wrap" style="margin-top:12px"><table class="report"><tr><th>Vehículo</th><th class="n">Km</th><th class="n">Gasto</th><th class="n">Litros</th><th class="n">km/l</th><th class="n">$/km</th></tr>
        ${d.vehicles.map((x) => `<tr><td>${esc(x.name)}</td><td class="n">${n(x.km)}</td><td class="n">${money.format(x.total)}<br><span class="sub small">${fmtUsd(x.totalUsd)}</span></td><td class="n">${n(x.liters, 1)}</td><td class="n">${n(x.kml, 1)}</td><td class="n">${x.perKm != null ? money.format(x.perKm) : '—'}</td></tr>`).join('')}</table></div>
        <p class="sub small" style="margin:8px 0 0">km/l = km de los usos del período ÷ litros cargados en el período. $/km = gasto total ÷ km.</p>` : ''}
    </div>

    <div class="section-title">Por obra</div>
    <div class="card">
      ${hBarChart(d.obras.map((x) => ({ label: x.name, value: x.usos, display: `${x.usos} usos · ${fmtKm(x.km)}` })))}
    </div>

    <div class="section-title">Gastos</div>
    <div class="card">${barChart(months, { selected: rep.mode === 'mes' ? rep.month : null, currency: 'ARS', ariaLabel: 'Gastos de la flota por mes' })}</div>
    ${d.byCat.length ? `<div class="card">${donutChart(d.byCat, { total: shortMoney(d.totalExp, 'ARS'), totalLabel: 'en el período' })}</div>` : ''}
  `;
}

/* ---------- Excel ---------- */

const xDate = (ms) => (ms ? new Date(ms) : null);
const xDay = (iso) => (iso ? parseISO(iso) : null);

function usoRows(list) {
  return list.sort((a, b) => a.startAt - b.startAt).map((u) => ({
    Vehículo: u.vehicleName || vehicleName(u.vehicleId),
    Chofer: u.driverName || '',
    'Mail chofer': u.driverEmail || '',
    'Obra / destino': u.obraName || '',
    Inicio: xDate(u.startAt),
    Fin: xDate(u.endAt),
    'Km subida': u.kmStart ?? null,
    'Km bajada': u.kmEnd ?? null,
    'Km recorridos': usoKm(u),
    Horas: usoHours(u) != null ? Math.round(usoHours(u) * 100) / 100 : null,
    'Último km de bajada previo': u.kmPrev ?? null,
    Estado: USO_STATUS[u.status] || u.status,
    Observaciones: u.notes || '',
    Avisos: usoIssues(u).map((i) => i.text).join(' | '),
    Revisado: u.reviewed ? 'Sí' : '',
    'Cargado por': u.createdBy?.name || '',
    'Cerrado por': u.closedBy?.name || '',
    Correcciones: (u.corrections || []).map((c) => `${c.by.name} ${fmtDateTime(c.at)}: ${Object.keys(c.changes || {}).map((k) => USO_FIELDS[k] || k).join(', ') || 'revisado'}`).join(' | '),
  }));
}

function cargaRows(list) {
  return list.sort((a, b) => expenseTime(a) - expenseTime(b)).map((e) => ({
    Vehículo: e.vehicleName || vehicleName(e.vehicleId),
    'Fecha y hora': xDate(expenseTime(e)),
    Km: e.km ?? null,
    Litros: e.liters ?? null,
    'Monto $': e.amount ?? null,
    '$ por litro': e.liters ? Math.round((e.amount / e.liters) * 100) / 100 : null,
    'Monto US$': inUsd(e) != null ? Math.round(inUsd(e) * 100) / 100 : null,
    'Dólar blue': e.usdRate ?? null,
    Estación: e.station || '',
    'Cargó': e.createdBy?.name || '',
    'Mail': e.createdBy?.email || '',
  }));
}

function expenseRows(list) {
  return list.sort((a, b) => expenseTime(a) - expenseTime(b)).map((e) => ({
    Fecha: e.at ? xDate(e.at) : xDay(e.date),
    Vehículo: e.vehicleName || vehicleName(e.vehicleId),
    Categoría: CATEGORIES[e.cat]?.label || e.cat,
    Detalle: [e.note, e.station, e.liters ? `${num.format(e.liters)} l` : ''].filter(Boolean).join(' · '),
    'Monto $': e.amount ?? null,
    'Monto US$': inUsd(e) != null ? Math.round(inUsd(e) * 100) / 100 : null,
    'Dólar blue': e.usdRate ?? null,
    'Cotización aprox.': e.rateApprox ? 'Sí' : '',
    'Cargado por': e.createdBy?.name || '',
  }));
}

function summaryRows(d) {
  const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
  return {
    drivers: d.drivers.map((x) => ({ Chofer: x.name, Usos: x.usos, Km: x.km, Horas: r2(x.hours) })),
    vehicles: d.vehicles.map((x) => ({
      Vehículo: x.name, Usos: x.usos, Km: x.km, 'Gasto $': r2(x.total), 'Gasto US$': r2(x.totalUsd), Litros: r2(x.liters), 'km/l': r2(x.kml), '$ por km': r2(x.perKm),
    })),
    obras: d.obras.map((x) => ({ 'Obra / destino': x.name, Usos: x.usos, Km: x.km, Horas: r2(x.hours) })),
  };
}

function fineRows({ from, to }) {
  return state.fines.filter((f) => f.date >= from && f.date <= to).sort((a, b) => a.date.localeCompare(b.date)).map((f) => ({
    Fecha: xDay(f.date),
    Hora: f.time || '',
    Vehículo: vehicleName(f.vehicleId),
    Chofer: f.driverName || '',
    Motivo: f.reason || '',
    Lugar: f.place || '',
    'Monto $': f.amount ?? null,
    'Vence el pago': xDay(f.dueDate),
    Estado: FINE_STATUS[f.status] || f.status,
    Notas: f.note || '',
    'Cargada por': f.createdBy?.name || '',
  }));
}

function serviceRows({ from, to }) {
  const rows = [];
  for (const t of state.tasks) {
    for (const h of t.history || []) {
      if (!h.date || h.date < from || h.date > to) continue;
      rows.push({
        Fecha: xDay(h.date), Vehículo: vehicleName(t.vehicleId), Tarea: t.name, Km: h.km ?? null, Taller: h.shop || '', 'Costo $': h.cost ?? null, Notas: h.note || '', 'Cargado por': h.by?.name || '',
      });
    }
  }
  return rows.sort((a, b) => a.Fecha - b.Fecha);
}

async function exportXlsx(all = false) {
  if (!window.XLSX) {
    toast('Preparando Excel…');
    try {
      await loadScript(SHEETJS_URL);
    } catch (e) {
      return toast('No se pudo cargar el generador de Excel. Probá con internet.', { error: true });
    }
  }
  const range = all ? { from: '0000-01-01', to: '9999-12-31' } : reportRange();
  const d = reportData(range);
  const wb = XLSX.utils.book_new();
  const add = (name, rows, fallback) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [fallback], { cellDates: true, dateNF: 'dd/mm/yyyy hh:mm' });
    const keys = Object.keys(rows[0] || fallback);
    ws['!cols'] = keys.map((k) => ({ wch: Math.min(40, Math.max(k.length + 2, ...rows.slice(0, 200).map((r) => String(r[k] ?? '').length > 30 ? 30 : String(r[k] ?? '').length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('Usos', usoRows(d.usos), { Vehículo: 'Sin usos en el período' });
  add('Cargas de nafta', cargaRows(d.cargas.filter((e) => e.source === 'carga' || e.liters)), { Vehículo: 'Sin cargas en el período' });
  add('Gastos', expenseRows(d.expenses), { Fecha: 'Sin gastos en el período' });
  const sum = summaryRows(d);
  add('Resumen por chofer', sum.drivers, { Chofer: 'Sin usos en el período' });
  add('Resumen por vehículo', sum.vehicles, { Vehículo: 'Sin datos en el período' });
  add('Resumen por obra', sum.obras, { 'Obra / destino': 'Sin usos en el período' });
  add('Multas', fineRows(range), { Fecha: 'Sin multas en el período' });
  add('Historial de service', serviceRows(range), { Fecha: 'Sin service en el período' });
  const name = all ? `flota-slavon-todo-${today()}.xlsx` : `flota-slavon-${range.from}-a-${range.to}.xlsx`;
  XLSX.writeFile(wb, name, { compression: true });
}

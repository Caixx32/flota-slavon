'use strict';

/*
 * Gráficos en SVG propio (sin librerías), pensados para el celular.
 * Cada marca lleva data-tip con el texto del tooltip; un único manejador muestra el globito.
 */

function shortMoney(n, currency) {
  const prefix = currency === 'USD' ? 'US$' : '$';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${prefix}${num.format(n / 1e6)}M`;
  if (abs >= 1e3) return `${prefix}${Math.round(n / 1e3)}k`;
  return `${prefix}${Math.round(n)}`;
}

// Escala "linda" para el eje: 0, paso, 2·paso… cubriendo el máximo.
function niceTicks(max, count = 3) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

// Barra con las dos esquinas de arriba redondeadas (4px) y la base recta sobre el eje.
function barPath(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/*
 * months: [{ key: '2026-10', label: 'oct', value, tip }]
 * selected: key del mes elegido (se resalta).
 */
function barChart(months, { selected, currency, ariaLabel }) {
  const W = 340;
  const H = 168;
  const pad = { l: 44, r: 6, t: 10, b: 24 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(0, ...months.map((m) => m.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const slot = iw / months.length;
  const bw = Math.max(4, slot - 6);
  const y = (v) => pad.t + ih - (v / top) * ih;

  const grid = ticks.map((t) => `
    <line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/>
    <text x="${pad.l - 6}" y="${y(t) + 3.5}" text-anchor="end" class="axis">${esc(shortMoney(t, currency))}</text>`).join('');

  const bars = months.map((m, i) => {
    const x = pad.l + i * slot + (slot - bw) / 2;
    const h = ih * (m.value / top);
    const sel = m.key === selected;
    return `
      <g class="bar ${sel ? 'sel' : ''}" data-tip="${esc(m.tip)}" data-select-month="${m.key}">
        <rect x="${pad.l + i * slot}" y="${pad.t}" width="${slot}" height="${ih + pad.b}" class="hit"/>
        <path d="${barPath(x, y(m.value), bw, h)}"/>
        <text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle" class="axis ${sel ? 'strong' : ''}">${esc(m.label)}</text>
      </g>`;
  }).join('');

  return `
    <div class="chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel || 'Gastos por mes')}">${grid}${bars}</svg>
      <div class="chart-tip" hidden></div>
    </div>`;
}

function arcPath(cx, cy, r, r0, a0, a1) {
  const p = (rad, a) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r, a0);
  const [x1, y1] = p(r, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  return `M${x0},${y0}A${r},${r} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${large} 0 ${x3},${y3}Z`;
}

/*
 * slices: [{ key, label, value, color, display }] ya ordenadas de mayor a menor.
 * El color sigue a la categoría (no al orden), así cada una conserva su color en todos los meses.
 */
function donutChart(slices, { total, totalLabel }) {
  const S = 160;
  const c = S / 2;
  const r = 74;
  const r0 = 50;
  const sum = slices.reduce((a, s) => a + s.value, 0);
  let a = 0;
  const paths = slices.map((s) => {
    const span = (s.value / sum) * Math.PI * 2;
    const a0 = a;
    a += span;
    const pct = Math.round((s.value / sum) * 100);
    const d = slices.length === 1
      ? `${arcPath(c, c, r, r0, 0, Math.PI)}${arcPath(c, c, r, r0, Math.PI, Math.PI * 2 - 0.0001)}`
      : arcPath(c, c, r, r0, a0, a);
    return `<path d="${d}" fill="${s.color}" class="slice" data-tip="${esc(`${s.label}: ${s.display} (${pct}%)`)}"/>`;
  }).join('');

  const legend = slices.map((s) => `
    <div class="legend-row" data-tip="${esc(`${s.label}: ${s.display}`)}">
      <span class="swatch-dot" style="background:${s.color}"></span>
      <span class="grow">${esc(s.label)}</span>
      <span class="amt">${esc(s.display)}</span>
      <span class="pct">${Math.round((s.value / sum) * 100)}%</span>
    </div>`).join('');

  return `
    <div class="chart donut-wrap">
      <svg viewBox="0 0 ${S} ${S}" class="donut" role="img" aria-label="Gastos por categoría">
        ${paths}
        <text x="${c}" y="${c - 2}" text-anchor="middle" class="donut-total">${esc(total)}</text>
        <text x="${c}" y="${c + 15}" text-anchor="middle" class="axis">${esc(totalLabel)}</text>
      </svg>
      <div class="legend">${legend}</div>
      <div class="chart-tip" hidden></div>
    </div>`;
}

// Tooltip compartido: sigue al puntero en la compu y aparece al tocar en el celular.
function initChartTips(root) {
  const show = (ev) => {
    const mark = ev.target.closest('[data-tip]');
    const chart = ev.target.closest('.chart');
    if (!chart) return;
    const tip = chart.querySelector('.chart-tip');
    if (!mark) {
      tip.hidden = true;
      return;
    }
    const box = chart.getBoundingClientRect();
    tip.textContent = mark.dataset.tip;
    tip.hidden = false;
    const x = Math.min(Math.max(ev.clientX - box.left, 70), box.width - 70);
    tip.style.left = `${x}px`;
    tip.style.top = `${Math.max(ev.clientY - box.top - 44, 0)}px`;
    chart.querySelectorAll('.hover').forEach((n) => n.classList.remove('hover'));
    mark.classList.add('hover');
  };
  root.addEventListener('pointermove', show);
  root.addEventListener('pointerdown', show);
  root.addEventListener('pointerleave', () => {
    root.querySelectorAll('.chart-tip').forEach((t) => { t.hidden = true; });
    root.querySelectorAll('.chart .hover').forEach((n) => n.classList.remove('hover'));
  });
}

// Barras horizontales para comparar choferes, vehículos u obras. rows: [{ label, value, display, color? }]
function hBarChart(rows) {
  if (!rows.length) return '<div class="empty">Sin datos en este período.</div>';
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<div class="chart hbars">${rows.map((r) => `
    <div class="hbar" data-tip="${esc(`${r.label}: ${r.display}`)}">
      <span class="hbar-label">${esc(r.label)}</span>
      <span class="hbar-track"><i style="width:${Math.max(2, (r.value / max) * 100)}%;${r.color ? `background:${r.color}` : ''}"></i></span>
      <span class="hbar-val">${esc(r.display)}</span>
    </div>`).join('')}<div class="chart-tip" hidden></div></div>`;
}

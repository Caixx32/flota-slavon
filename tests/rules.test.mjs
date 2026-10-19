// Pruebas de las reglas de Firestore con el emulador.
// Cómo correrlas (desde la carpeta tests/):
//   npm install
//   npx firebase emulators:exec --only firestore --project demo-flota "node --test rules.test.mjs"

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore';

const OWNER = 'juanmarcospaterno@gmail.com';
const ENC = 'encargado@test.com';
const CH1 = 'chofer1@test.com';
const CH2 = 'chofer2@test.com';
const OFF = 'inactivo@test.com';
const RANDOM = 'cualquiera@test.com';

let env;

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-flota',
    firestore: { host, port: Number(port), rules: readFileSync(fileURLToPath(new URL('../firestore.rules', import.meta.url)), 'utf8') },
  });
});

after(() => env.cleanup());

const db = (email) => env.authenticatedContext(email, { email, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const stamp = (email) => ({ email, name: email.split('@')[0] });
const file = (id) => ({ id: `foto-${id}`, name: 'foto.jpg', type: 'image/jpeg', size: 1000, chunks: 1 });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'users', ENC), { email: ENC, role: 'encargado', active: true });
    await setDoc(doc(f, 'users', CH1), { email: CH1, role: 'chofer', active: true });
    await setDoc(doc(f, 'users', CH2), { email: CH2, role: 'chofer', active: true });
    await setDoc(doc(f, 'users', OFF), { email: OFF, role: 'chofer', active: false });
    await setDoc(doc(f, 'vehicles', 'v1'), { id: 'v1', name: 'Kangoo', km: 1000, status: 'disponible', active: true, openUsoId: null });
    await setDoc(doc(f, 'vehicles', 'v3'), { id: 'v3', name: 'Partner', km: 3000, status: 'disponible', active: true, openUsoId: null });
    await setDoc(doc(f, 'vehicles', 'v2'), { id: 'v2', name: 'Moto', km: 500, status: 'taller', active: true, openUsoId: null });
    await setDoc(doc(f, 'obras', 'o1'), { id: 'o1', name: 'Obra Norte', active: true });
    await setDoc(doc(f, 'tasks', 't1'), { id: 't1', vehicleId: 'v1', name: 'Aceite' });
    await setDoc(doc(f, 'docs', 'd1'), { id: 'd1', vehicleId: 'v1', name: 'Seguro' });
    await setDoc(doc(f, 'fines', 'f1'), { id: 'f1', vehicleId: 'v1', amount: 1000 });
    await setDoc(doc(f, 'config', 'general'), { openHours: 12 });
    await setDoc(doc(f, 'expenses', 'e1'), { id: 'e1', vehicleId: 'v1', cat: 'seguro', amount: 5000 });
    await setDoc(doc(f, 'usos', 'u-old'), { id: 'u-old', vehicleId: 'v1', driverEmail: CH1, status: 'cerrado', kmStart: 900, kmEnd: 1000, startAt: Date.now() - 86400000 });
    await setDoc(doc(f, 'files', 'pic_0'), { fileId: 'pic', i: 0, n: 1, kind: 'vehicle', data: 'AAA' });
    await setDoc(doc(f, 'files', 'tab_0'), { fileId: 'tab', i: 0, n: 1, kind: 'tablero', owner: CH1, data: 'AAA' });
  });
});

function newUso(email, id, extra = {}) {
  return {
    id, vehicleId: 'v1', vehicleName: 'Kangoo', driverEmail: email, driverName: 'x', startAt: Date.now(),
    kmStart: 1000, kmPrev: 1000, photoStart: file(`${id}-a`), obraId: 'o1', obraName: 'Obra Norte',
    status: 'abierto', createdBy: stamp(email), createdAt: serverTimestamp(), ...extra,
  };
}

// Inicia un uso como lo hace la app: uso nuevo + vehículo «en uso» (+ marca el anterior si había).
function startBatch(f, email, id, prevOpen = null, vehicleId = 'v1', km = null) {
  const b = writeBatch(f);
  const kmPrev = { v1: 1000, v2: 500, v3: 3000 }[vehicleId];
  b.set(doc(f, 'usos', id), newUso(email, id, { vehicleId, kmPrev: km ?? kmPrev }));
  b.update(doc(f, 'vehicles', vehicleId), { status: 'uso', openUsoId: id, driverEmail: email, driverName: 'x', usoStartAt: Date.now() });
  b.set(doc(f, 'locks', email), { usoId: id, vehicleId, at: Date.now() });
  if (prevOpen) b.update(doc(f, 'usos', prevOpen), { status: 'sin_cerrar', flaggedBy: stamp(email), flaggedAt: serverTimestamp() });
  return b.commit();
}

function endBatch(f, email, id, kmEnd, vehicleKm = kmEnd, withVehicle = true) {
  const b = writeBatch(f);
  b.delete(doc(f, 'locks', email));
  b.update(doc(f, 'usos', id), {
    status: 'cerrado', endAt: Date.now(), kmEnd, photoEnd: file(`${id}-b`), notes: '', closedBy: stamp(email), closedAt: serverTimestamp(),
  });
  if (withVehicle) b.update(doc(f, 'vehicles', 'v1'), { status: 'disponible', openUsoId: null, driverEmail: null, driverName: null, usoStartAt: null, km: vehicleKm, kmAt: Date.now() });
  return b.commit();
}

/* ---------- Sin acceso ---------- */

test('sin login o con un mail no dado de alta no se lee nada', async () => {
  await assertFails(getDoc(doc(anon(), 'vehicles', 'v1')));
  await assertFails(getDoc(doc(db(RANDOM), 'vehicles', 'v1')));
  await assertFails(getDocs(collection(db(RANDOM), 'obras')));
  // pero puede leer su propio documento de usuario (inexistente) para saber que no tiene acceso
  await assertSucceeds(getDoc(doc(db(RANDOM), 'users', RANDOM)));
});

test('un chofer desactivado no entra', async () => {
  await assertFails(getDoc(doc(db(OFF), 'vehicles', 'v1')));
  await assertFails(startBatch(db(OFF), OFF, 'u-off'));
});

test('nadie puede darse de alta solo ni subirse de rol', async () => {
  await assertFails(setDoc(doc(db(RANDOM), 'users', RANDOM), { email: RANDOM, role: 'admin', active: true }));
  await assertFails(updateDoc(doc(db(CH1), 'users', CH1), { role: 'admin' }));
  await assertFails(setDoc(doc(db(CH1), 'users', 'otro@test.com'), { email: 'otro@test.com', role: 'chofer', active: true }));
  // el chofer no se cambia el nombre (sólo admin); sí se actualizan su foto y último ingreso
  await assertFails(updateDoc(doc(db(CH1), 'users', CH1), { name: 'Chofer Uno' }));
  await assertSucceeds(updateDoc(doc(db(CH1), 'users', CH1), { photoURL: 'https://x/y.jpg', lastLogin: Date.now() }));
  await assertSucceeds(updateDoc(doc(db(OWNER), 'users', CH1), { name: 'Chofer Uno' }));
});

/* ---------- Chofer: lo que NO puede leer ---------- */

test('chofer no lee historial, gastos, service, papeles, multas, config ni usuarios', async () => {
  const f = db(CH1);
  await assertFails(getDocs(collection(f, 'usos')));
  await assertFails(getDoc(doc(f, 'usos', 'u-old'))); // ni su propio uso cerrado
  await assertFails(getDocs(query(collection(f, 'usos'), where('driverEmail', '==', CH1))));
  await assertFails(getDocs(collection(f, 'expenses')));
  await assertFails(getDoc(doc(f, 'expenses', 'e1')));
  await assertFails(getDocs(collection(f, 'tasks')));
  await assertFails(getDocs(collection(f, 'docs')));
  await assertFails(getDocs(collection(f, 'fines')));
  await assertFails(getDoc(doc(f, 'config', 'general')));
  await assertFails(getDocs(collection(f, 'users')));
  await assertFails(getDoc(doc(f, 'users', CH2)));
  await assertFails(getDoc(doc(f, 'files', 'tab_0'))); // ni la foto del tablero que subió
  await assertFails(getDocs(collection(f, 'files')));
});

test('chofer sí ve vehículos, obras, fotos de vehículos y su propio uso abierto', async () => {
  const f = db(CH1);
  await assertSucceeds(getDocs(collection(f, 'vehicles')));
  await assertSucceeds(getDocs(collection(f, 'obras')));
  await assertSucceeds(getDoc(doc(f, 'files', 'pic_0')));
  await assertSucceeds(startBatch(f, CH1, 'u1'));
  await assertSucceeds(getDoc(doc(f, 'usos', 'u1')));
  await assertSucceeds(getDocs(query(collection(f, 'usos'), where('driverEmail', '==', CH1), where('status', 'in', ['abierto', 'sin_cerrar']))));
  await assertFails(getDoc(doc(db(CH2), 'usos', 'u1'))); // otro chofer no lo ve
});

/* ---------- Chofer: iniciar y terminar uso ---------- */

test('iniciar uso: se crea el uso y el vehículo pasa a en uso', async () => {
  await assertSucceeds(startBatch(db(CH1), CH1, 'u1'));
});

// Lote completo de inicio (uso + vehículo + candado) con algo del uso cambiado, para probar cada validación.
function startWith(f, email, id, overrides = {}, { vehicleId = 'v1', lock = true, vehicle = true } = {}) {
  const b = writeBatch(f);
  b.set(doc(f, 'usos', id), newUso(email, id, { vehicleId, kmPrev: { v1: 1000, v2: 500, v3: 3000 }[vehicleId], ...overrides }));
  if (vehicle) b.update(doc(f, 'vehicles', vehicleId), { status: 'uso', openUsoId: id, driverEmail: email, driverName: 'x', usoStartAt: Date.now() });
  if (lock) b.set(doc(f, 'locks', email), { usoId: id, vehicleId, at: Date.now() });
  return b.commit();
}

test('iniciar uso: no se puede a nombre de otro, sin foto, con hora vieja o en un vehículo en taller', async () => {
  const f = db(CH1);
  await assertFails(startWith(f, CH1, 'x1', { driverEmail: CH2 }));
  await assertFails(startWith(f, CH1, 'x2', { photoStart: null }));
  await assertFails(startWith(f, CH1, 'x3', { startAt: Date.now() - 10 * 86400000 }));
  await assertFails(startWith(f, CH1, 'x4', { status: 'cerrado' }));
  await assertFails(startWith(f, CH1, 'x5', {}, { vehicleId: 'v2' })); // v2 está en taller
  await assertFails(startWith(f, CH1, 'x6', { photoStart: { id: 'foto-x6', chunks: 9 } })); // foto demasiado grande
  await assertSucceeds(startWith(f, CH1, 'ok1')); // el mismo lote sin trampas pasa
});

test('iniciar uso: kmPrev tiene que ser el km real del vehículo (no se puede esconder el aviso de km raros)', async () => {
  const f = db(CH1);
  await assertFails(startWith(f, CH1, 'k1', { kmStart: 1500, kmPrev: 1500 }));
  await assertFails(startWith(f, CH1, 'k2', { kmPrev: null }));
  await assertSucceeds(startWith(f, CH1, 'k3', { kmStart: 1500, kmPrev: 1000 })); // km distinto: se permite, queda el aviso
});

test('iniciar uso: no se pueden crear usos sueltos (sin actualizar el vehículo o sin candado)', async () => {
  const f = db(CH1);
  await assertFails(setDoc(doc(f, 'usos', 's1'), newUso(CH1, 's1')));
  await assertFails(startWith(f, CH1, 's2', {}, { vehicle: false }));
  await assertFails(startWith(f, CH1, 's3', {}, { lock: false }));
  // tampoco el encargado puede crear un uso sin que el vehículo apunte a él
  await assertFails(setDoc(doc(db(ENC), 'usos', 's4'), newUso(ENC, 's4')));
});

test('un chofer no puede tener dos usos abiertos a la vez', async () => {
  const f = db(CH1);
  await assertSucceeds(startBatch(f, CH1, 'u1', null, 'v1'));
  await assertFails(startBatch(f, CH1, 'u2', null, 'v3'));
  // no puede borrar el candado sin cerrar el uso
  await assertFails(deleteDoc(doc(f, 'locks', CH1)));
  // cerrando el primero, ya puede iniciar otro
  await assertSucceeds(endBatch(f, CH1, 'u1', 1080));
  await assertSucceeds(startBatch(f, CH1, 'u3', null, 'v3'));
  // el candado de otro no lo puede leer ni tocar
  await assertFails(getDoc(doc(db(CH2), 'locks', CH1)));
  await assertFails(setDoc(doc(db(CH2), 'locks', CH1), { usoId: 'zz', vehicleId: 'v1', at: Date.now() }));
});

test('iniciar uso con otro uso abierto: se permite y el anterior queda «sin cerrar»', async () => {
  await assertSucceeds(startBatch(db(CH1), CH1, 'u1'));
  await assertSucceeds(startBatch(db(CH2), CH2, 'u2', 'u1'));
  let u1;
  await env.withSecurityRulesDisabled(async (ctx) => { u1 = (await getDoc(doc(ctx.firestore(), 'usos', 'u1'))).data(); });
  assert.equal(u1.status, 'sin_cerrar');
  // el chofer 1 todavía puede cerrar su uso, pero ya no toca el km del vehículo (lo tiene el chofer 2)
  const f = db(CH1);
  await assertSucceeds(updateDoc(doc(f, 'usos', 'u1'), {
    status: 'cerrado', endAt: Date.now(), kmEnd: 1050, photoEnd: file('b'), notes: '', wasUnclosed: true, closedBy: stamp(CH1), closedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(f, 'vehicles', 'v1'), { km: 1050 }));
});

test('un chofer no puede marcar «sin cerrar» un uso ajeno sin tomar el vehículo', async () => {
  await assertSucceeds(startBatch(db(CH1), CH1, 'u1'));
  await assertFails(updateDoc(doc(db(CH2), 'usos', 'u1'), { status: 'sin_cerrar', flaggedBy: stamp(CH2), flaggedAt: serverTimestamp() }));
});

test('terminar uso: km de bajada mayor al de subida y el vehículo queda con ese km', async () => {
  await assertSucceeds(startBatch(db(CH1), CH1, 'u1'));
  await assertFails(endBatch(db(CH1), CH1, 'u1', 1000)); // igual al de subida
  await assertFails(endBatch(db(CH1), CH1, 'u1', 990)); // menor
  await assertFails(endBatch(db(CH1), CH1, 'u1', 1080, 5000)); // el km del vehículo no coincide
  await assertSucceeds(endBatch(db(CH1), CH1, 'u1', 1080));
});

test('terminar uso: otro chofer no puede cerrar un uso ajeno', async () => {
  await assertSucceeds(startBatch(db(CH1), CH1, 'u1'));
  await assertFails(endBatch(db(CH2), CH2, 'u1', 1080));
});

test('después de guardado, el chofer no edita ni borra nada', async () => {
  await assertSucceeds(startBatch(db(CH1), CH1, 'u1'));
  await assertSucceeds(endBatch(db(CH1), CH1, 'u1', 1080));
  const f = db(CH1);
  await assertFails(updateDoc(doc(f, 'usos', 'u1'), { kmEnd: 2000 }));
  await assertFails(updateDoc(doc(f, 'usos', 'u1'), { status: 'cerrado', kmEnd: 1100, endAt: Date.now(), photoEnd: file('z'), closedBy: stamp(CH1), closedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(f, 'usos', 'u1')));
  await assertFails(updateDoc(doc(f, 'usos', 'u-old'), { kmEnd: 1 }));
  await assertFails(updateDoc(doc(f, 'vehicles', 'v1'), { km: 99999 }));
  await assertFails(updateDoc(doc(f, 'vehicles', 'v1'), { status: 'taller' }));
  await assertFails(updateDoc(doc(f, 'vehicles', 'v1'), { name: 'Hackeado' }));
  await assertFails(deleteDoc(doc(f, 'vehicles', 'v1')));
  await assertFails(setDoc(doc(f, 'obras', 'o2'), { name: 'Nueva' }));
});

/* ---------- Chofer: carga de nafta ---------- */

function carga(email, id, extra = {}) {
  return {
    id, vehicleId: 'v1', vehicleName: 'Kangoo', cat: 'combustible', source: 'carga', date: '2026-10-19', at: Date.now(),
    km: 1100, liters: 40, amount: 60000, station: 'YPF', photo: file(`${id}-t`), usdRate: 1300, rateApprox: false,
    createdBy: stamp(email), createdAt: serverTimestamp(), ...extra,
  };
}

test('cargar nafta: puede crearla pero no leerla, editarla ni borrarla', async () => {
  const f = db(CH1);
  await assertSucceeds(setDoc(doc(f, 'expenses', 'c1'), carga(CH1, 'c1')));
  await assertFails(getDoc(doc(f, 'expenses', 'c1')));
  await assertFails(updateDoc(doc(f, 'expenses', 'c1'), { amount: 1 }));
  await assertFails(setDoc(doc(f, 'expenses', 'c1'), carga(CH1, 'c1', { amount: 1 })));
  await assertFails(deleteDoc(doc(f, 'expenses', 'c1')));
});

test('cargar nafta: no puede cargar otro tipo de gasto ni a nombre de otro', async () => {
  const f = db(CH1);
  await assertFails(setDoc(doc(f, 'expenses', 'c2'), carga(CH1, 'c2', { cat: 'seguro' })));
  await assertFails(setDoc(doc(f, 'expenses', 'c3'), carga(CH1, 'c3', { createdBy: stamp(CH2) })));
  await assertFails(setDoc(doc(f, 'expenses', 'c4'), carga(CH1, 'c4', { liters: 0 })));
  await assertFails(setDoc(doc(f, 'expenses', 'c5'), carga(CH1, 'c5', { photo: null })));
});

test('fotos: el chofer sube la del tablero/ticket pero no la pisa, no sube otra cosa y respeta tamaño y cantidad', async () => {
  const f = db(CH1);
  const chunk = (fileId, i, extra = {}) => ({ fileId, i, n: 1, kind: 'tablero', owner: CH1, data: 'AAA', ...extra });
  await assertSucceeds(setDoc(doc(f, 'files', 'foto-new_0'), chunk('foto-new', 0)));
  await assertFails(setDoc(doc(f, 'files', 'foto-new_0'), chunk('foto-new', 0, { data: 'BBB' }))); // no la pisa
  await assertFails(setDoc(doc(f, 'files', 'pic_0'), chunk('pic', 0, { kind: 'vehicle' })));
  await assertFails(setDoc(doc(f, 'files', 'foto-x_0'), chunk('foto-x', 0, { kind: 'vehicle' })));
  await assertFails(setDoc(doc(f, 'files', 'foto-y_0'), chunk('foto-y', 0, { kind: 'ticket', owner: CH2 })));
  await assertFails(setDoc(doc(f, 'files', 'foto-z_0'), chunk('foto-z', 0, { n: 5 }))); // demasiados pedazos
  await assertFails(setDoc(doc(f, 'files', 'foto-z_3'), chunk('foto-z', 3, { n: 2 }))); // pedazo fuera de rango
  await assertFails(setDoc(doc(f, 'files', 'otro-id_0'), chunk('foto-w', 0))); // el id no coincide
  await assertFails(setDoc(doc(f, 'files', 'foto-v_0'), chunk('foto-v', 0, { data: 'A'.repeat(700001) }))); // muy grande
  await assertFails(setDoc(doc(f, 'files', 'foto-u_0'), chunk('foto-u', 0, { extra: 'x' }))); // campos de más
  await assertSucceeds(setDoc(doc(f, 'files', 'foto-t_1'), chunk('foto-t', 1, { n: 2 })));
});

test('cargar nafta: valida vehículo y fecha', async () => {
  const f = db(CH1);
  await assertFails(setDoc(doc(f, 'expenses', 'c6'), carga(CH1, 'c6', { vehicleId: 'no-existe' })));
  await assertFails(setDoc(doc(f, 'expenses', 'c7'), carga(CH1, 'c7', { date: 'ayer' })));
  await assertFails(setDoc(doc(f, 'expenses', 'c8'), carga(CH1, 'c8', { date: null })));
  await assertSucceeds(setDoc(doc(f, 'expenses', 'c9'), carga(CH1, 'c9')));
});

test('los usos no se borran (ni admin): se anulan, y un uso anulado el chofer ya no lo cierra', async () => {
  await assertSucceeds(startBatch(db(CH1), CH1, 'u1'));
  await assertFails(deleteDoc(doc(db(OWNER), 'usos', 'u1')));
  await assertFails(deleteDoc(doc(db(ENC), 'usos', 'u1')));
  await assertSucceeds(updateDoc(doc(db(ENC), 'usos', 'u1'), { anulado: true, anuladoPor: stamp(ENC), anuladoEn: Date.now(), motivo: 'Cargado por error' }));
  await assertFails(updateDoc(doc(db(CH1), 'usos', 'u1'), {
    status: 'cerrado', endAt: Date.now(), kmEnd: 1050, photoEnd: file('b'), notes: '', closedBy: stamp(CH1), closedAt: serverTimestamp(),
  }));
});

test('el dueño entra aunque su documento diga inactivo', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users', OWNER), { email: OWNER, role: 'chofer', active: false }));
  const f = db(OWNER);
  await assertSucceeds(getDocs(collection(f, 'usos')));
  await assertSucceeds(getDocs(collection(f, 'users')));
  await assertSucceeds(updateDoc(doc(f, 'users', OWNER), { role: 'admin', active: true }));
});

/* ---------- Encargado y admin ---------- */

test('encargado lee y edita todo menos usuarios', async () => {
  const f = db(ENC);
  await assertSucceeds(getDocs(collection(f, 'usos')));
  await assertSucceeds(getDocs(collection(f, 'expenses')));
  await assertSucceeds(getDocs(collection(f, 'files')));
  await assertSucceeds(setDoc(doc(f, 'tasks', 't2'), { id: 't2', vehicleId: 'v1', name: 'Frenos' }));
  await assertSucceeds(updateDoc(doc(f, 'usos', 'u-old'), { kmEnd: 1001, corrections: [{ by: ENC }] }));
  await assertSucceeds(updateDoc(doc(f, 'vehicles', 'v1'), { status: 'taller' }));
  await assertSucceeds(setDoc(doc(f, 'obras', 'o2'), { name: 'Obra Sur' }));
  await assertSucceeds(getDocs(collection(f, 'users')));
  await assertFails(setDoc(doc(f, 'users', 'nuevo@test.com'), { email: 'nuevo@test.com', role: 'chofer', active: true }));
  await assertFails(updateDoc(doc(f, 'users', CH1), { role: 'encargado' }));
  await assertFails(updateDoc(doc(f, 'users', ENC), { role: 'admin' }));
});

test('admin (dueño) crea su usuario y da de alta a otros', async () => {
  const f = db(OWNER);
  await assertSucceeds(setDoc(doc(f, 'users', OWNER), { email: OWNER, role: 'admin', active: true }));
  await assertSucceeds(setDoc(doc(f, 'users', 'nuevo@test.com'), { email: 'nuevo@test.com', role: 'chofer', active: true }));
  await assertSucceeds(updateDoc(doc(f, 'users', CH1), { active: false }));
  await assertFails(getDoc(doc(db(CH1), 'vehicles', 'v1'))); // el chofer desactivado ya no entra
  await assertFails(setDoc(doc(f, 'users', 'x@test.com'), { email: 'x@test.com', role: 'superadmin', active: true }));
  await assertFails(setDoc(doc(f, 'users', 'Mayus@test.com'), { email: 'Mayus@test.com', role: 'chofer', active: true }));
});

test('un admin dado de alta (no dueño) también gestiona usuarios', async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users', 'admin2@test.com'), { email: 'admin2@test.com', role: 'admin', active: true }));
  await assertSucceeds(setDoc(doc(db('admin2@test.com'), 'users', 'nuevo@test.com'), { email: 'nuevo@test.com', role: 'chofer', active: true }));
});

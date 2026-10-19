'use strict';

// Conexión con Firebase (Auth con Google + Firestore con caché offline).
// El SDK se carga por CDN con import() dinámico: si no hay internet y todavía no está en caché,
// la app muestra un error claro en lugar de romperse.

const FIREBASE_VERSION = '10.14.1';
const FIREBASE_CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

// Cada documento de Firestore admite hasta 1 MiB: los archivos se parten en pedazos de base64 más chicos.
const CHUNK_CHARS = 700000;

window.FlotaCloud = (() => {
  const cfg = window.FLOTA_CONFIG || {};
  const params = new URLSearchParams(location.search);
  // Sólo para probar en la computadora con los emuladores de Firebase (nunca en el sitio publicado).
  const useEmulator = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && params.has('emu');
  const firebaseConfig = useEmulator
    ? { apiKey: 'demo-key', authDomain: 'demo-flota.firebaseapp.com', projectId: 'demo-flota', appId: 'demo' }
    : cfg.firebase;

  let fb = null;
  let auth = null;
  let db = null;
  let onWriteError = (e) => console.warn(e);

  async function init() {
    if (fb) return;
    const [app, authMod, fs] = await Promise.all([
      import(`${FIREBASE_CDN}/firebase-app.js`),
      import(`${FIREBASE_CDN}/firebase-auth.js`),
      import(`${FIREBASE_CDN}/firebase-firestore.js`),
    ]);
    fb = { ...app, ...authMod, ...fs };
    const fApp = fb.initializeApp(firebaseConfig);
    auth = fb.getAuth(fApp);
    auth.languageCode = 'es';
    db = fb.initializeFirestore(fApp, {
      localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }),
    });
    if (useEmulator) {
      fb.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      fb.connectFirestoreEmulator(db, '127.0.0.1', 8081);
    }
    // Si el login fue por redirección (cuando el navegador bloquea la ventana emergente).
    fb.getRedirectResult(auth).catch(() => {});
  }

  function onAuth(cb) {
    return fb.onAuthStateChanged(auth, cb);
  }

  async function signIn() {
    const provider = new fb.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await fb.signInWithPopup(auth, provider);
    } catch (e) {
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
        await fb.signInWithRedirect(auth, provider);
        return;
      }
      throw e;
    }
  }

  function signOut() {
    return fb.signOut(auth);
  }

  const ref = (name, id) => fb.doc(db, name, id);

  // Datos del documento con su id como propiedad oculta (_id): no se copia al guardar con {...item}.
  const withId = (snap) => Object.defineProperty(snap.data(), '_id', { value: snap.id, enumerable: false });

  // Escucha una colección (o una consulta). cb(items, { fromCache, pending })
  function subscribe(name, cb, onError, filters = null) {
    let q = fb.collection(db, name);
    if (filters) q = fb.query(q, ...filters.map(([f, op, v]) => fb.where(f, op, v)));
    return fb.onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      cb(snap.docs.map(withId), { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites });
    }, onError);
  }

  function subscribeDoc(name, id, cb, onError) {
    return fb.onSnapshot(ref(name, id), { includeMetadataChanges: true }, (snap) => {
      cb(snap.exists() ? withId(snap) : null, { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites });
    }, onError);
  }

  async function getOne(name, id, fromServer = false) {
    const snap = fromServer ? await fb.getDocFromServer(ref(name, id)) : await fb.getDoc(ref(name, id));
    return snap.exists() ? snap.data() : null;
  }

  // Lee una colección completa confirmada por el servidor (no de la caché). Sin señal, tira error.
  async function getAllFromServer(name) {
    const snap = await fb.getDocsFromServer(fb.collection(db, name));
    return snap.docs.map(withId);
  }

  /*
   * Escribe varias cosas juntas: o se guarda todo o nada. ops: [{ op: 'set'|'update'|'delete', col, id, data }]
   * No se espera la respuesta: con la caché offline queda en cola y se sube cuando hay señal.
   * Si las reglas la rechazan, se avisa con onWriteError.
   */
  function write(ops) {
    const b = fb.writeBatch(db);
    for (const o of ops) {
      const r = ref(o.col, o.id);
      if (o.op === 'delete') b.delete(r);
      else if (o.op === 'update') b.update(r, o.data);
      else b.set(r, o.data);
    }
    const p = b.commit();
    p.catch((e) => onWriteError(e));
    return p;
  }

  const put = (col, id, data) => write([{ op: 'set', col, id, data }]);
  const patch = (col, id, data) => write([{ op: 'update', col, id, data }]);
  const del = (col, id) => write([{ op: 'delete', col, id }]);

  /* ----- Archivos partidos en varios documentos ----- */

  // Devuelve las operaciones para guardar el archivo (para meterlas en el mismo lote que el registro).
  function fileOps(fileId, base64, extra = {}) {
    const n = Math.max(1, Math.ceil(base64.length / CHUNK_CHARS));
    const ops = [];
    for (let i = 0; i < n; i++) {
      ops.push({ op: 'set', col: 'files', id: `${fileId}_${i}`, data: { fileId, i, n, ...extra, data: base64.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS) } });
    }
    return { ops, n };
  }

  async function getFile(fileId, n) {
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => getOne('files', `${fileId}_${i}`)));
    if (parts.some((p) => !p)) throw new Error('Faltan partes del archivo (todavía no se sincronizó).');
    return parts.map((p) => p.data).join('');
  }

  function delFileOps(fileId, n) {
    return Array.from({ length: n }, (_, i) => ({ op: 'delete', col: 'files', id: `${fileId}_${i}` }));
  }

  // Sólo con emuladores: entra con una cuenta de Google de mentira para las pruebas.
  async function testSignIn(email) {
    if (!useEmulator) throw new Error('Sólo disponible con emuladores');
    const cred = fb.GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name: email.split('@')[0] }));
    await fb.signInWithCredential(auth, cred);
  }

  return {
    useEmulator,
    init,
    onAuth,
    signIn,
    signOut,
    subscribe,
    subscribeDoc,
    getOne,
    getAllFromServer,
    write,
    put,
    patch,
    del,
    fileOps,
    getFile,
    delFileOps,
    testSignIn,
    serverTime: () => fb.serverTimestamp(),
    setWriteErrorHandler: (fn) => { onWriteError = fn; },
  };
})();

// Guarda la app en el celular para que abra sin señal y manda avisos en segundo plano.
// Al cambiar cualquier archivo, subí este número para que los dispositivos bajen la versión nueva.
const CACHE = 'flota-v1';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'config.js',
  'cloud.js',
  'store.js',
  'charts.js',
  'ui.js',
  'flows.js',
  'views.js',
  'reports.js',
  'app.js',
  'manifest.webmanifest',
  'icons/logo.png',
  'icons/logo-white.png',
  'icons/favicon.png',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

// SDK de Firebase por CDN: se guarda aparte para que la app abra sin señal.
const FIREBASE = 'https://www.gstatic.com/firebasejs/10.14.1/';
// Generador de Excel: se guarda la primera vez que se exporta.
const SHEETJS = 'https://cdn.sheetjs.com/';
const FIREBASE_FILES = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map((f) => FIREBASE + f);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    // Si el CDN no responde, la instalación sigue igual: se guarda la próxima vez que se use.
    await Promise.all(FIREBASE_FILES.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // El SDK de Firebase tiene la versión en la dirección: si está guardado, no hace falta pedirlo.
  if (request.url.startsWith(FIREBASE) || request.url.startsWith(SHEETJS)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })),
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Archivos de la app: primero la red (para recibir cambios); si no hay conexión, lo guardado.
  // «no-cache» obliga a preguntarle al servidor si hay versión nueva: GitHub Pages deja que el navegador
  // guarde los archivos 10 minutos y, sin esto, el celular podía seguir con el código viejo.
  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});

/* ---------- Avisos en segundo plano (Periodic Background Sync, Chrome en Android) ---------- */

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('flota-slavon', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('files');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

function isoToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysUntil(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const [ty, tm, td] = isoToday().split('-').map(Number);
  return Math.round((new Date(y, m - 1, d) - new Date(ty, tm - 1, td)) / 86400000);
}

// La app deja en IndexedDB la lista de vencimientos con fecha; acá se revisa sin abrirla.
// Usa la misma clave y firma que la app para no avisar dos veces lo mismo.
async function checkDeadlines() {
  const schedule = (await idb('readonly', (s) => s.get('schedule'))) || [];
  const notified = (await idb('readonly', (s) => s.get('notified'))) || {};
  let changed = false;
  for (const dl of schedule) {
    const days = daysUntil(dl.date);
    const level = days < 0 ? 'bad' : days <= dl.notifyDays ? 'warn' : null;
    if (!level) continue;
    const sig = `${level}:${dl.date}`;
    if (notified[dl.key] === sig) continue;
    notified[dl.key] = sig;
    changed = true;
    const when = days < 0 ? `venció hace ${-days} días` : days === 0 ? 'vence hoy' : `vence en ${days} días`;
    await self.registration.showNotification(`${level === 'bad' ? 'Vencido' : 'Por vencer'}: ${dl.title.replace(/^(Vence|Service) /, '')}`, {
      body: `${dl.title} ${when}.`,
      tag: dl.key,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: './' },
    });
  }
  if (changed) await idb('readwrite', (s) => s.put(notified, 'notified'));
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'vencimientos') event.waitUntil(checkDeadlines());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = wins.find((w) => w.url.startsWith(self.registration.scope));
    if (open) return open.focus();
    return self.clients.openWindow(event.notification.data?.url || './');
  })());
});

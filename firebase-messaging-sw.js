importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCcV_ds81xCnEMYjOt0R7qdSw9SVqxTEBs",
  authDomain: "hogar-finanzas-christian.firebaseapp.com",
  projectId: "hogar-finanzas-christian",
  storageBucket: "hogar-finanzas-christian.firebasestorage.app",
  messagingSenderId: "297318843633",
  appId: "1:297318843633:web:7e649c8ebd3ca2ec3d9550"
});

const messaging = firebase.messaging();
const CACHE_NAME = 'hogar-finanzas-v35-beta8-tarjetas-canonicas';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './css/styles.css?v=10.0',
  './js/data.js?v=10.0',
  './js/app.js?v=10.0',
  './css/importaciones.css?v=11.1',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/app-icon.svg?v=34.0',
  './icons/app-icon-maskable.svg?v=34.0',
  './css/deudas-inteligentes.css?v=11.2.1',
  './js/modelo-financiero.js?v=11.5.4',
  './js/motor-conciliacion.js?v=11.5.4',
  './js/reglas-bancarias.js?v=11.5.4',
  './js/importaciones.js?v=11.5.4',
  './js/vinculacion-tarjetas-outlook.js?v=11.5.4',
  './js/pipeline-outlook.js?v=11.5.4',
  './js/outlook-graph.js?v=11.5.4',
  './js/actualizador-tarjetas-outlook.js?v=11.5.4',
  './js/outlook-ui.js?v=11.5.4',
  './js/deudas-inteligentes.js?v=11.2.1',
  './js/sincronizacion-financiera-ui.js?v=33.4',
  './js/bootstrap-avanzado.js?v=33.4',
  './js/deudas-familiares.js?v=33.4',
  './js/deudas-coordinator-v33-4.js?v=33.4',
  './js/experiencia-financiera-14.js?v=33.4',
  './js/diagnostico-etapa-14.js?v=20.0',
  './css/experiencia-financiera-14.css?v=20.0',
  './css/experiencia-unificada-v32.css?v=32.1',
  './css/identidad-navegacion-v34.css?v=34.1-beta.2',
  './css/estados-pagados-ahorro-real-v35.css?v=35.0-beta.8',
  './css/hotfix-etapa-18-beta2.css?v=35.0-beta.8',
  './css/etapa-18-beta8.css?v=35.0-beta.8',
  './js/experiencia-unificada-v32.js?v=35.0-beta.8',
  './js/movimientos-unificados-v33.js?v=33.4',
  './js/experiencia-auxiliar-v33.js?v=33.4',
  './js/hotfix-v33-1.js?v=33.4',
  './js/avatar-random-v33-2.js?v=33.4',
  './js/identidad-navegacion-v34.js?v=34.0',
  './js/etapa-18-beta5.js?v=35.0-beta.5',
  './js/etapa-18-beta6.js?v=35.0-beta.6',
  './js/etapa-18-beta6-bridge.js?v=35.0-beta.6',
  './js/etapa-18-beta7.js?v=35.0-beta.7',
  './js/etapa-18-beta8.js?v=35.0-beta.8',
  './js/ahorro-resumen-v35.js?v=35.0-beta.8',
  './js/diagnostico-etapa-18.js?v=35.0-beta.8',
  './css/experiencia-integrada-v30.css?v=31.2',
  './css/experiencia-integrada-v29.css?v=29.3',
  './css/experiencia-integrada-v28.css?v=28.0',
  './css/experiencia-integrada-v27.css?v=27.0',
  './css/tarjetas-consistencia-v26.css?v=26.0',
  './js/tarjetas-consistencia-v26.js?v=33.3',
  './css/deudas-fixes-v25.css?v=25.0',
  './js/deudas-fixes-v25.js?v=25.0',
  './css/deudas-redesign-v23.css?v=24.0',
  './js/deudas-redesign-v23.js?v=24.0',
  './css/experiencia-financiera-v2.css?v=33.2',
  './js/experiencia-financiera-v2.js?v=33.2',
  './js/motor-predictivo-financiero.js?v=11.5.4',
  './js/panel-predicciones-financieras.js?v=11.5.4',
  './js/optimizador-pagos.js?v=11.5.4'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => null));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    clients.claim(),
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => null);
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});

messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  const title = data.title || 'Hogar Finanzas';
  const options = {
    body: data.body || 'Hay una actualización en las finanzas del hogar.',
    icon: './icons/app-icon.svg?v=34.0',
    badge: './icons/icon-192.png',
    tag: data.tag || 'hogar-finanzas',
    renotify: true,
    data: { url: data.url || './index.html' }
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './index.html', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const abierta = windows.find(client => client.url.startsWith(self.location.origin));
      if (abierta) {
        abierta.focus();
        if ('navigate' in abierta) return abierta.navigate(target);
        return abierta;
      }
      return clients.openWindow(target);
    })
  );
});
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
const CACHE_NAME = 'hogar-finanzas-v3-etapa11-1';
const APP_SHELL = [
  './', './index.html', './css/styles.css?v=10.0', './js/data.js?v=10.0', './js/app.js?v=10.0',
  './js/importaciones.js?v=11.1', './css/importaciones.css?v=11.1', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'
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
    fetch(event.request).then(response => {
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
    icon: './icons/icon-192.png',
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

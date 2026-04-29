// sw.js mejorado
self.addEventListener('fetch', (event) => {
  // Responde con el contenido de la red normalmente
  event.respondWith(fetch(event.request));
});
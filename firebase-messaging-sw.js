importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCcV_ds81xCnEMYjOt0R7qdSw9SVqxTEBs",
  authDomain: "hogar-finanzas-christian.firebaseapp.com",
  projectId: "hogar-finanzas-christian",
  storageBucket: "hogar-finanzas-christian.firebasestorage.app",
  messagingSenderId: "297318843633",
  appId: "1:297318843633:web:7e649c8ebd3ca2d9550"
});

const messaging = firebase.messaging();

// Notificación en segundo plano (cuando la app NO está abierta)
messaging.onBackgroundMessage((payload) => {
  console.log('📩 Mensaje en segundo plano recibido:', payload);
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '💰'
  });
});
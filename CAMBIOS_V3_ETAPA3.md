# Hogar Finanzas v3 — Etapa 3: dispositivos y notificaciones

## Cambios principales

- Se eliminó la solicitud automática de permiso al abrir la app.
- Se utiliza un único service worker para PWA, caché y Firebase Messaging.
- El permiso se solicita únicamente después de pulsar “Activar notificaciones”.
- Se añadió una guía específica para instalar la PWA en iPhone.
- Cada instalación tiene un ID de dispositivo estable y un nombre editable.
- Los tokens se guardan en `hogares/{hogarId}/dispositivos/{dispositivoId}`.
- Cada dispositivo queda asociado a `miembroId`, plataforma, tipo de instalación y preferencias.
- Se pueden consultar los dispositivos registrados del hogar.
- Se añadieron preferencias para movimientos, vencimientos, presupuesto y estados de cuenta.
- La Cloud Function envía mensajes al miembro correcto y elimina tokens inválidos.
- Se mantiene compatibilidad temporal con la colección antigua `tokens`.
- Se añadieron iconos locales de 192 y 512 px y se mejoró el manifiesto PWA.

## Importante para iPhone

Las notificaciones web requieren iOS 16.4 o posterior y que la página haya sido agregada a la pantalla de inicio desde Safari. El permiso debe solicitarse dentro de la app instalada.

## Despliegue de Cloud Functions

Después de publicar los archivos web, la función actualizada debe desplegarse desde la carpeta del proyecto:

```bash
firebase deploy --only functions:enviarNotificacionPago
```

La app puede instalarse sin desplegar la función, pero las notificaciones remotas no se enviarán hasta actualizarla.

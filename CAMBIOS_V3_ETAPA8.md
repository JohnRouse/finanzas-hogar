# Etapa 8 — Blaze y notificaciones operativas

- Cloud Functions movidas a `southamerica-east1`.
- Recordatorios diarios programados a las 08:00 (America/Lima).
- Avisos automáticos para tarjetas y préstamos a 7, 3, 1 y 0 días del vencimiento, y durante los 3 primeros días de atraso.
- Notificaciones idempotentes: no se repiten el mismo día.
- Respeto de preferencias por dispositivo y miembro.
- Limpieza automática de tokens FCM inválidos.
- Estado de procesamiento guardado en cada solicitud de notificación.
- Botón para enviar una notificación de prueba.
- Mensajes recibidos con la app abierta se muestran como aviso interno.
- Caché actualizado a la versión 8.0.

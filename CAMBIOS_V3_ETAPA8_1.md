# Hogar Finanzas v3 — Etapa 8.1

## Prueba push por dispositivo

- El botón de prueba ya no envía el aviso a todos los equipos del miembro.
- La notificación de prueba se dirige exclusivamente al dispositivo actual mediante `dispositivoDestino`.
- Si el dispositivo no tiene token push válido, no crea una prueba engañosa y explica que los avisos internos siguen disponibles.
- La Cloud Function filtra por el documento exacto del dispositivo cuando corresponde.
- Mensaje más claro para errores `AbortError` en equipos sin servicio push compatible.
- Caché actualizado a la versión 8.1.

## Despliegue

Después de publicar los archivos web, volver a desplegar las funciones:

```bash
npx firebase-tools deploy --only functions:enviarNotificacionPago
```

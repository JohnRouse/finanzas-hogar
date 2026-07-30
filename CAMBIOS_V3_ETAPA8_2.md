# Hogar Finanzas v3 — Etapa 8.2

## Prueba real en segundo plano

- Se añade una prueba retrasada de 10 segundos dirigida al dispositivo actual.
- Permite cerrar la PWA antes de que Firebase envíe el mensaje.
- La prueba inmediata y la prueba en segundo plano usan exclusivamente el token del dispositivo elegido.
- No se consulta la colección legacy de tokens cuando existe `dispositivoDestino`.
- Nuevos estados de diagnóstico: `dispositivo-sin-push`, `token-invalido` y `fallida`.
- Se guarda el nombre del dispositivo probado.
- Se mejora la detección de ejecución como PWA instalada.
- Caché actualizada a 8.2.

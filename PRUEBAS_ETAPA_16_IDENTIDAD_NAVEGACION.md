# Pruebas — Etapa 16: identidad y navegación

Versión de prueba: `34.0-beta.1`

Rama: `etapa-16-identidad-y-navegacion`

## Objetivo

Validar el avatar central de la navegación y la nueva identidad visual de la PWA sin modificar la versión estable `V33.4` publicada en `master`.

## Navegación

1. Abrir la aplicación en una pantalla móvil.
2. Confirmar que la barra inferior tenga cinco posiciones:
   - Resumen
   - Movimientos
   - Avatar
   - Deudas
   - Plan
3. Confirmar que el avatar sobresalga ligeramente de la barra y no tape el contenido.
4. Pulsar el avatar y verificar que se abra el menú de configuración.
5. Cerrar configuración y comprobar que la sección activa no cambie.
6. Repetir la prueba desde Resumen, Movimientos, Deudas y Plan.
7. Confirmar que el engranaje del encabezado siga funcionando como acceso alternativo durante esta etapa.

## Sincronización del avatar

1. Abrir Configuración.
2. Cambiar el avatar Micah.
3. Guardar el avatar.
4. Confirmar que se actualice en:
   - Resumen.
   - Configuración.
   - Botón central de navegación.
5. Recargar la página y verificar que el avatar elegido se conserve.

## Icono de la PWA

1. Abrir la aplicación con `?v=34.0-beta.1`.
2. En DevTools, revisar Application > Manifest.
3. Confirmar que se carguen:
   - `icons/app-icon.svg`
   - `icons/app-icon-maskable.svg`
4. Desinstalar temporalmente la PWA anterior del dispositivo de prueba.
5. Instalar nuevamente la aplicación.
6. Confirmar que el icono sea azul, sin texto, con una casa blanca y una moneda dorada.
7. Verificar que el recorte circular o redondeado no corte la casa ni la moneda.

## Regresión

Comprobar que continúen funcionando:

- Registro y edición de movimientos.
- Historial y detalle de movimientos.
- Tarjetas y préstamos.
- Menús de editar y eliminar.
- Detalles de Deudas sin cierre automático.
- Selector de mes.
- FAB contextual.
- Generación aleatoria de avatares.

## Consola y red

No deben aparecer:

- Errores JavaScript.
- Solicitudes 404 para los nuevos SVG, CSS o JavaScript.
- Bucles de consultas a Firestore.
- Parpadeos entre versiones visuales.

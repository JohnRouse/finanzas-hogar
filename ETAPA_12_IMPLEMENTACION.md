# Etapa 12 · Implementación inicial

Esta rama incorpora la primera versión funcional del cierre financiero mensual sin modificar el núcleo monolítico de `app.js`.

## Arquitectura

- `js/cierre-financiero-mensual.js`: lógica, interfaz y persistencia.
- `css/cierre-financiero-mensual.css`: estilos mobile-first independientes.
- `js/diagnostico-etapa-12.js`: pruebas deterministas del nuevo módulo.
- `js/bootstrap-avanzado.js`: carga controlada de la etapa 12.
- `js/sincronizacion-financiera-ui.js`: actualización ligera después de guardar un cierre.

## Decisiones de seguridad

- Los cierres históricos son de solo lectura.
- Solo el mes vigente puede actualizar los saldos actuales de las tarjetas.
- Saldos y fotografía mensual se guardan mediante un único batch de Firestore.
- No se añadieron parches dentro de `app.js` ni se reemplazaron funciones de gastos o deudas.
- No se integra con correo ni con Microsoft Entra.

## Pendiente de validación humana

- Distribución visual en móvil y escritorio.
- Correspondencia de los campos de préstamos existentes con saldo, cuota y vencimiento.
- Persistencia real en Firebase del hogar de prueba.
- Consulta de un cierre después de cambiar de mes.

La rama no debe fusionarse hasta completar `PRUEBAS_ETAPA_12_CIERRE_MENSUAL.md`.
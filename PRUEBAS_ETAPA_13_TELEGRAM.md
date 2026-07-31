# Pruebas · Etapa 13 Bot de Telegram

## Antes del despliegue

```bash
cd functions
npm test
```

Resultado esperado:

```text
Pruebas del parser de Telegram: OK
```

## Aplicación sin bot desplegado

Descarga la rama `etapa-13-bot-telegram`, abre una carpeta nueva con Live Server y aplica `Ctrl + F5`.

```js
HFDiagnosticoVisual.limpiarCapturas();
await HFDiagnosticoVisual.ejecutar();
await HFDiagnosticoEtapa12.ejecutar();
await HFDiagnosticoEtapa13.ejecutar();
```

Resultados esperados:

- general: `24/24`;
- etapa 12: `15/15`;
- etapa 13: `5/5`.

La sección **Gastos → Por revisar** permanece oculta mientras no existan pendientes.

## Prueba de texto después del despliegue

Envía al bot:

```text
Gasté 35 soles en Metro con la Visa BCP hoy
```

Debe ocurrir lo siguiente:

1. El bot confirma que guardó un movimiento para revisar.
2. En Firestore aparece un documento en `movimientos_pendientes` con estado `pendiente`.
3. En el perfil administrador aparece **Gastos → Por revisar**.
4. El formulario permite corregir monto, descripción, fecha, categoría, medio y tarjeta.
5. Al aprobar se crea un único documento en `gastos` y el pendiente cambia a `aprobado`.
6. Al recargar no se duplica el gasto.

## Prueba de voz

Envía una nota de voz breve:

```text
Pagué 89 soles de internet Win con Yape ayer
```

Revisa que:

- la transcripción sea razonable;
- la fecha sea la de ayer;
- el medio sugerido sea Yape;
- la categoría sugerida sea Servicios;
- el audio no se guarde en Firestore ni Storage.

## Seguridad

- Una cuenta no incluida en `TELEGRAM_USER_BINDINGS` debe ser rechazada.
- El bot solo debe aceptar chats privados.
- Un webhook sin el encabezado secreto debe responder `403`.
- El token del bot no debe aparecer en archivos del cliente, consola ni repositorio.

## Descarte

Abre un pendiente, pulsa **Descartar** y confirma en el modal de la aplicación. El documento debe cambiar a `descartado` y desaparecer de la lista sin crear un gasto.

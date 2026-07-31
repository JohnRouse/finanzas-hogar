# Etapa 13 · Bot privado de Telegram y transcripción

## Alcance

- Recibe mensajes privados de texto o notas de voz.
- Transcribe notas de voz en español de Perú con Cloud Speech-to-Text.
- Detecta monto, moneda, fecha, medio de pago, posible tarjeta y categoría sugerida.
- Guarda un movimiento en `hogares/{hogarId}/movimientos_pendientes`.
- No crea gastos definitivos desde Telegram.
- El administrador revisa, corrige, aprueba o descarta desde **Gastos → Por revisar**.
- La aprobación y el cambio de estado se realizan en una transacción para evitar duplicados.
- El audio no se almacena: se descarga en memoria, se transcribe y se descarta.

## Seguridad

Los secretos nunca deben escribirse en `index.html`, JavaScript del cliente, GitHub ni mensajes de soporte.

Secretos utilizados:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_USER_BINDINGS`

Ejemplo de `TELEGRAM_USER_BINDINGS`:

```json
{
  "123456789": {
    "hogarId": "HOGAR-XXXXXXXX",
    "miembroId": "ID_INTERNO_OPCIONAL",
    "quien": "yo",
    "nombre": "Christian"
  },
  "987654321": {
    "hogarId": "HOGAR-XXXXXXXX",
    "miembroId": "ID_INTERNO_OPCIONAL",
    "quien": "pareja",
    "nombre": "Sydney"
  }
}
```

Solo los IDs incluidos en ese secreto pueden registrar pendientes. El webhook valida además `X-Telegram-Bot-Api-Secret-Token`.

## Preparación de Google Cloud

1. En Google Cloud Console, selecciona `hogar-finanzas-christian`.
2. Habilita **Cloud Speech-to-Text API**.
3. Verifica que la cuenta de servicio de ejecución de Cloud Functions tenga el rol **Cloud Speech Client** (`roles/speech.client`).
4. Conserva `maxInstances: 2` para limitar consumo accidental.

## Crear el bot

1. Abre una conversación privada con `@BotFather`.
2. Ejecuta `/newbot`.
3. Guarda el token en un administrador de contraseñas.
4. No pegues el token en el repositorio ni en la aplicación.

## Configurar secretos

Desde la raíz del proyecto:

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET
firebase functions:secrets:set TELEGRAM_USER_BINDINGS
```

Para la primera implementación, `TELEGRAM_USER_BINDINGS` puede ser temporalmente `{}`.

El secreto del webhook debe tener entre 1 y 256 caracteres y usar únicamente letras, números, `_` o `-`.

## Despliegue inicial

```bash
firebase use hogar-finanzas-christian
firebase deploy --only functions:telegramWebhook
```

La CLI mostrará una URL similar a:

```text
https://southamerica-east1-hogar-finanzas-christian.cloudfunctions.net/telegramWebhook
```

## Vincular el webhook

En PowerShell, dentro de `functions`:

```powershell
$env:TELEGRAM_BOT_TOKEN="TOKEN_GUARDADO"
$env:TELEGRAM_WEBHOOK_SECRET="SECRETO_DEL_WEBHOOK"
$env:TELEGRAM_WEBHOOK_URL="URL_DE_LA_FUNCION"
npm run telegram:webhook
```

Las variables solo viven en esa terminal. No las guardes en archivos del repositorio.

## Obtener los IDs de Telegram

1. Escribe `/id` al bot desde la cuenta de Christian.
2. Repite desde la cuenta de Sydney.
3. Actualiza `TELEGRAM_USER_BINDINGS` con ambos IDs.
4. Vuelve a desplegar `telegramWebhook` para que la función use la nueva versión del secreto.

El `miembroId` es opcional. En la consola de la aplicación puedes consultar:

```js
DB.hogarId
obtenerMiembroActual()
```

## Prueba del bot

Texto:

```text
Gasté 35 soles en Metro con la Visa BCP hoy
```

Voz:

```text
Pagué 89 soles de internet Win con Yape ayer
```

El bot debe responder que el movimiento fue guardado para revisar. En la app debe aparecer en:

```text
Gastos → Por revisar → Revisar
```

Para montos detectados en dólares, la app exige introducir el equivalente en soles antes de aprobar para evitar mezclar monedas en los totales.

## Comandos

- `/id`: muestra el ID numérico de Telegram.
- `/ayuda`: explica el formato recomendado.
- `/pendientes`: indica cuántos movimientos esperan revisión.

## Pruebas locales del parser

```bash
cd functions
npm test
```

## Diagnóstico en la aplicación

```js
HFDiagnosticoVisual.limpiarCapturas();
await HFDiagnosticoVisual.ejecutar();
await HFDiagnosticoEtapa12.ejecutar();
await HFDiagnosticoEtapa13.ejecutar();
```

Resultados esperados:

- diagnóstico general: `24/24`;
- etapa 12: `15/15`;
- etapa 13: `5/5`.

## Límites de la primera versión

- Notas de voz de hasta 60 segundos y 6 MB.
- Solo conversaciones privadas con el bot.
- La categoría es una sugerencia y siempre puede corregirse.
- El bot no consulta ni revela deuda, ingresos ni saldos.
- No se guarda el audio ni el `file_id` de Telegram.

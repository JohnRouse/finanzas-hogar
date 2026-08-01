# Pruebas · Ajustes posteriores a la validación móvil

Versión esperada: `19.3`.

## Preparación

1. Abrir la rama `ajustes-post-prueba-movil` con Live Server.
2. Recargar sin caché.
3. Comprobar en consola:

```js
HFBootstrapAvanzado.version
HFAjustesPostPruebaMovil.version
```

Ambas respuestas deben ser `19.3`.

## Pruebas visuales

- El contador de **Por revisar** aparece como insignia pequeña junto al encabezado.
- **Movimientos del mes** se distribuye correctamente en móvil.
- Los KPI de Deudas aparecen uno debajo del otro en pantallas angostas.
- La lista de movimientos acepta fechas de texto y timestamps de Firestore sin errores.

## Telegram · efectivo digital

1. Enviar: “Gasté 2 soles en pasaje con Yape”.
2. Aprobarlo como Transporte.
3. Confirmar que aparece con icono de Transporte.
4. Editarlo y comprobar que el medio figura como **Efectivo / transferencia**.

## Telegram · tarjeta de crédito

1. Anotar la deuda y el disponible actuales de la tarjeta.
2. Enviar y aprobar un gasto nuevo con esa tarjeta.
3. Confirmar que:
   - el gasto aparece con la insignia de la tarjeta;
   - la deuda aumenta exactamente por el monto registrado;
   - el disponible disminuye por el mismo monto;
   - una recarga adicional no vuelve a aumentar la deuda.

Los movimientos de Telegram ya aprobados con tarjeta y sin impacto registrado se concilian una sola vez. Cada gasto queda marcado con `impactoTarjetaAplicado: true` para impedir duplicados.

## Consola

No debe aparecer `localeCompare is not a function` ni un error al aplicar el impacto de la tarjeta. Los avisos de `manifest.json`, `favicon.ico` y dominio OAuth de Cloud Workstations no forman parte de esta prueba.
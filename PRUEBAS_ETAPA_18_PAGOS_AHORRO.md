# Pruebas Etapa 18 — estados pagados y ahorro reservado real

Versión de prueba: `35.0-beta.2`

## Objetivo

Validar que una obligación atendida deje de aparecer como vencida cuando existe evidencia de pago y que el ahorro reservado se comporte como dinero realmente separado del disponible, sin convertirse en gasto.

## 1. Estado de tarjetas después de pagar

1. Abrir **Deudas**.
2. Revisar las tarjetas que ya tengan pagos registrados.
3. Estados esperados:
   - `Pagada`: el pago cubrió el total del estado o dejó la obligación del estado satisfecha.
   - `Mínimo pagado`: los abonos cubren el mínimo informado, aunque continúe existiendo deuda.
   - `Pago registrado`: existe evidencia de pago, pero falta información para afirmar que cubrió mínimo o total.
   - `Pago parcial`: existe pago, pero el mínimo informado todavía no se cubrió y el vencimiento ya pasó.
   - `Vencida`: solo debe mantenerse cuando no se encontró un pago que permita considerar atendida la obligación.
4. La detección revisa movimientos actuales, pagos antiguos compatibles y `ultimoPagoFecha` / `ultimoPagoMonto` de la tarjeta.
5. Abrir **Ver detalles** y comprobar que aparezca el resumen del pago reconocido.
6. Una tarjeta puede estar pagada y seguir con utilización alta por compras posteriores; el porcentaje de línea y el estado del pago son conceptos distintos.

## 2. Persistencia visual del estado

1. Cambiar entre Resumen, Movimientos y Deudas varias veces.
2. Esperar unos segundos en Deudas.
3. Confirmar que el badge reconocido no vuelva a `Vencida` por un render posterior.

## 3. Préstamos

1. Abrir un préstamo con una cuota registrada.
2. Cuando el pago haya avanzado `proximoVencimientoPosterior`, debe quedar `Al día` y usar el nuevo vencimiento.
3. Si el saldo llegó a cero, debe mostrarse `Pagado`.

## 4. Meta creada en beta 1 con saldo inicial

Si ya existe la meta creada durante `35.0-beta.1` con S/ 100 de saldo pero sin `reservadoMeses`:

1. Recargar `35.0-beta.2`.
2. La aplicación debe migrar ese saldo una sola vez al mes visible.
3. Con los datos de la prueba reportada, `Disponible hoy` debe pasar de S/ 872.03 a S/ 772.03.
4. El historial de la meta debe incluir `Saldo inicial reservado`.

## 5. Crear una meta nueva

1. Abrir **Plan**.
2. Crear una meta nueva.
3. El campo debe decir `Monto inicial a reservar (opcional)`.
4. Si se escribe S/ 100 al crear la meta, esos S/ 100 deben descontarse inmediatamente del `Disponible hoy`.
5. No debe permitirse reservar un monto inicial superior al dinero disponible.

## 6. Apartar dinero

1. En una meta activa pulsar **Apartar dinero**.
2. Anotar **Disponible hoy** antes de continuar.
3. Apartar S/ 100.
4. Confirmar que:
   - la meta aumenta exactamente S/ 100;
   - `Ahorro reservado` aumenta S/ 100;
   - `Disponible hoy` disminuye exactamente S/ 100;
   - no aparece un gasto nuevo en **Movimientos**;
   - en **Movimientos** de la meta aparece `Dinero apartado`;
   - no aparece `ReferenceError: nota is not defined`.

## 7. Retirar de una meta

1. Pulsar **Retirar**.
2. Retirar S/ 100.
3. Confirmar que el saldo de la meta disminuye S/ 100 y el disponible aumenta exactamente S/ 100.
4. Con el ejemplo reportado, si antes de retirar había S/ 672.03 disponibles y S/ 200 reservados, después deben quedar S/ 772.03 disponibles y S/ 100 reservados; nunca S/ 972.03.
5. El retiro debe aparecer en el historial de la meta y no como ingreso ordinario.

## 8. Limpieza visual

El mensaje `El ahorro ahora se separa de verdad` ya no debe aparecer en la pantalla de Plan.

## 9. Diagnóstico

Desde la consola ejecutar:

```js
await HFDiagnosticoEtapa18.ejecutar()
```

Revisar dos partes:

- la tabla de tarjetas calculadas;
- `domCards`, que muestra la etiqueta que realmente quedó pintada en cada tarjeta.

Si el cálculo dice `Mínimo pagado` o `Pago registrado` pero `domCards` muestra otra cosa, conservar la salida completa del diagnóstico.

## 10. Persistencia

1. Recargar la aplicación.
2. Confirmar que saldos reservados, disponible y movimientos de meta se mantienen.
3. Cambiar de mes y volver al actual para comprobar que el ahorro histórico no vuelva a descontarse como un aporte nuevo.
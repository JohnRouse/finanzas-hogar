# Pruebas Etapa 18 — estados pagados y ahorro reservado real

Versión de prueba: `35.0-beta.1`

## Objetivo

Validar que una obligación pagada deje de aparecer como vencida y que el ahorro reservado se comporte como dinero realmente separado del disponible, sin convertirse en un gasto.

## 1. Estado de tarjetas después de pagar

1. Abrir **Deudas**.
2. Revisar una tarjeta que ya tenga un movimiento `pagoTarjeta` registrado para el estado de cuenta vigente.
3. Confirmar que el badge ya no diga `Vencida` cuando el pago correspondiente ya fue realizado.
4. Estados esperados:
   - `Pagada`: el pago cubrió el total del estado o el movimiento dejó la deuda posterior en cero.
   - `Mínimo pagado`: los abonos del ciclo cubren el mínimo informado, pero no el total.
   - `Pago registrado`: existe un abono, pero no hay información suficiente para afirmar que cubrió mínimo o total.
   - `Vencida`: solo debe conservarse cuando pasó el vencimiento y no existe un pago suficiente registrado para ese ciclo.
5. Abrir **Ver detalles** y verificar el resumen del pago reconocido.
6. Una tarjeta pagada puede seguir mostrando una utilización alta si después del pago tiene deuda o nuevas compras; eso no debe convertirla nuevamente en vencida.

## 2. Préstamos

1. Abrir un préstamo con una cuota registrada.
2. Confirmar que, cuando el pago avanzó `proximoVencimientoPosterior`, la tarjeta del préstamo quede `Al día` y muestre el nuevo vencimiento.
3. Si el saldo llegó a cero, debe mostrarse `Pagado`.

## 3. Crear una meta

1. Abrir **Plan**.
2. Crear una meta si todavía no existe.
3. El campo anterior `Ya ahorrado` debe aparecer como `Saldo ya reservado antes de crear la meta (opcional)`.
4. Este campo se usa solo para dinero que ya estaba separado antes de comenzar a usar esta función.

## 4. Apartar dinero

1. En una meta activa pulsar **Apartar dinero**.
2. Anotar el valor de **Disponible hoy** antes de continuar.
3. Apartar un monto pequeño de prueba, por ejemplo S/ 10.00.
4. Confirmar:
   - El saldo de la meta aumenta exactamente S/ 10.00.
   - `Ahorro reservado` aumenta S/ 10.00.
   - `Disponible hoy` disminuye exactamente S/ 10.00.
   - No aparece un gasto nuevo en **Movimientos** por esos S/ 10.00.
   - En **Movimientos** de la meta aparece un `Dinero apartado` de S/ 10.00.

## 5. Retirar de una meta

1. Pulsar **Retirar** en la misma meta.
2. Retirar, por ejemplo, S/ 5.00.
3. Confirmar:
   - La meta disminuye S/ 5.00.
   - `Disponible hoy` aumenta S/ 5.00.
   - El historial de la meta muestra un retiro de S/ 5.00.
   - No se crea un ingreso ni un gasto ordinario; es una transferencia interna.

## 6. Acceso desde Resumen

Al final de **Plan del mes**, dentro del bloque **Metas**, debe aparecer una acción:

- `Crear una meta` si todavía no hay metas.
- `Apartar dinero` si solo hay una meta activa.
- `Elegir meta para apartar` cuando existen varias metas activas.
- `Metas completadas` cuando todas alcanzaron su objetivo.

## 7. Persistencia

1. Recargar la aplicación.
2. Confirmar que el saldo reservado, el disponible corregido y los movimientos de la meta se mantienen.
3. Cambiar de mes y volver al actual para comprobar que el ahorro histórico no se descuenta otra vez de los ingresos del mes actual.

## 8. Diagnóstico

Desde la consola ejecutar:

```js
await HFDiagnosticoEtapa18.ejecutar()
```

El diagnóstico muestra:

- estado calculado de cada tarjeta;
- importe reconocido como pagado;
- pago total y mínimo usados para la comparación;
- utilización de línea;
- estado de préstamos;
- saldo de cada meta y neto apartado durante el mes;
- `Disponible hoy` corregido.

Si una tarjeta no obtiene el estado esperado, conservar la salida del diagnóstico junto con el HAR para revisar el ciclo y los movimientos que se asociaron.
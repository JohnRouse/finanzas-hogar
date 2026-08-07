# Pruebas Etapa 18 — estados pagados y ahorro reservado real

Versión de prueba: `35.0-beta.4`

## Objetivo

Validar que una obligación atendida deje de aparecer como vencida cuando existe evidencia de pago y que el ahorro reservado se comporte como dinero realmente separado del disponible, sin convertirse en gasto.

## 1. Estabilidad antes de probar funciones

1. Abrir la aplicación y dejarla sin tocar durante al menos 60 segundos.
2. Confirmar que Chrome no muestre `La página no responde`.
3. Abrir Configuración desde el avatar y navegar por varias opciones.
4. La interfaz debe seguir respondiendo con normalidad.

Causa raíz corregida en beta 4: el hotfix beta 2 instalaba un `MutationObserver` sobre el modal de metas y, dentro de su callback, volvía a asignar `textContent` a un nodo observado. Esa escritura generaba una nueva mutación y podía repetirse indefinidamente, consumiendo el hilo principal aunque el modal de metas no estuviera visible. Beta 4 ya no carga los hotfix beta 2 ni beta 3 y usa operaciones idempotentes y refrescos explícitos.

## 2. Estado de tarjetas después de pagar

1. Abrir **Deudas**.
2. Revisar las tarjetas que ya tengan pagos registrados.
3. Estados esperados:
   - `Pagada`: el pago cubrió el total del estado o dejó la obligación del estado satisfecha.
   - `Mínimo pagado`: los abonos cubren el mínimo informado, aunque continúe existiendo deuda.
   - `Pago registrado`: existe evidencia de pago, pero falta información para afirmar que cubrió mínimo o total.
   - `Pago parcial`: existe pago, pero el mínimo informado todavía no se cubrió y el vencimiento ya pasó.
   - `Vencida`: solo debe mantenerse cuando no se encontró un pago que permita considerar atendida la obligación.
4. Una tarjeta puede estar pagada y seguir con utilización alta por compras posteriores; utilización y estado del pago son conceptos distintos.

## 3. Préstamos

1. Abrir un préstamo con una cuota registrada.
2. Cuando el pago haya avanzado el próximo vencimiento, debe quedar `Al día`.
3. Si el saldo llegó a cero, debe mostrarse `Pagado`.

## 4. Meta existente con saldo inicial

Si existe una meta con saldo, pero sin `reservadoMeses`, beta 4 la migra una sola vez.

Con el caso probado de S/100 reservados y S/872.03 disponibles antes de contabilizar el ahorro, el resultado esperado es:

- Ahorro reservado: S/100.00
- Disponible hoy: S/772.03

## 5. Crear una meta nueva

1. Abrir **Plan**.
2. Crear una meta nueva.
3. El campo debe decir `Monto inicial a reservar (opcional)`.
4. Un monto inicial se descuenta inmediatamente del disponible.
5. No debe permitirse reservar más que el dinero disponible.

## 6. Apartar y retirar

1. Pulsar **Apartar dinero**.
2. Apartar un monto pequeño y comprobar que la meta suba y el disponible baje por el mismo importe.
3. Confirmar que no se registra como gasto.
4. Pulsar **Retirar** y retirar el mismo monto.
5. Confirmar que la meta baje y el disponible vuelva a subir exactamente por ese importe.

## 7. Diagnóstico

Desde la consola ejecutar:

```js
await HFDiagnosticoEtapa18.ejecutar()
```

Revisar las tablas de tarjetas, metas y `domCards`. El diagnóstico de beta 4 no depende de los hotfix retirados.

## 8. Persistencia

1. Recargar la aplicación.
2. Confirmar que saldos reservados, disponible y estados de pago se mantienen.
3. Cambiar de mes y volver al actual para comprobar que el ahorro histórico no vuelva a descontarse como un aporte nuevo.

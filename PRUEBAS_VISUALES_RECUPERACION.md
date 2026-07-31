# Pruebas visuales — recuperación de Deudas

Rama a probar: `recuperacion-deudas-core`

## Preparación

1. Descarga esta rama o actualiza tu copia local.
2. Abre `index.html` mediante Live Server usando `http://127.0.0.1:5500` o `http://localhost:5500`.
3. Realiza una recarga completa con `Ctrl + F5` para evitar archivos antiguos en caché.
4. Abre las herramientas del navegador y confirma que no aparecen errores rojos.
5. En la consola ejecuta:

```js
await HFDiagnosticoVisual.ejecutar()
```

El resultado debe indicar `listo: true` o señalar exactamente qué comprobación necesita atención.

## Resultado visual esperado

### Deudas

La pestaña Deudas debe mostrar únicamente:

- Deuda total.
- Compromisos del mes.
- Estado actualizado de tarjetas.
- Tarjetas de crédito.
- Préstamos activos.
- Proyección libre de deuda.
- Un único botón para abrir el Centro financiero.

No debe aparecer ningún botón de Outlook, Client ID, Tenant ni Microsoft Entra.

### Tarjetas

Cada tarjeta debe mostrar:

- Nombre y responsable.
- Deuda estimada hoy o saldo registrado.
- Estado facturado, compras posteriores y pagos posteriores cuando exista un estado de cuenta.
- Pago mínimo y pago total informado.
- Línea, disponible, cierre y vencimiento.
- Acciones: Detalles, Pagar, Estado, Conciliar e Historial.

### Préstamos

Cada préstamo debe mostrar:

- Saldo pendiente.
- Cuota mensual.
- Próximo vencimiento.
- Cuotas pagadas y totales.
- Acciones para pagar cuota e historial.

### Centro financiero

Debe abrirse en un modal separado. Incluye:

- Simulador de pago de una tarjeta.
- Comparación de estrategias de pago.

Los cálculos del Centro financiero son informativos y no modifican los datos.

## Pruebas funcionales

1. Crear una tarjeta.
2. Editar la tarjeta.
3. Registrar un estado de cuenta.
4. Registrar una compra con esa tarjeta.
5. Comprobar que aparezca en compras posteriores al estado.
6. Registrar un pago de tarjeta.
7. Comprobar que aparezca en pagos posteriores y reduzca la deuda estimada.
8. Abrir el historial de la tarjeta.
9. Crear un préstamo.
10. Registrar una cuota.
11. Abrir el Centro financiero y ejecutar una simulación.
12. Comparar estrategias con un presupuesto mensual.

## Fórmula usada

```text
Saldo facturado
+ compras posteriores al estado
- pagos posteriores al estado
= deuda estimada hoy
```

Cuando una tarjeta todavía no tiene estado de cuenta, la aplicación muestra el saldo registrado manualmente.
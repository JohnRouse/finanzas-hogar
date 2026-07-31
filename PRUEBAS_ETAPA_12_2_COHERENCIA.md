# Etapa 12.2 · Coherencia financiera

## Objetivo

Evitar que la aplicación llame ahorro a un sobrante todavía no reservado y que la proyección de deuda omita tarjetas o préstamos.

## Prueba visual

1. Abrir **Resumen**.
2. Confirmar que **Necesita atención** muestre filas breves y un máximo de tres antes de “Ver todas”.
3. Revisar **Distribución del ingreso**:
   - consumo pagado con dinero del mes;
   - pagos de deuda realmente registrados;
   - disponible según movimientos;
   - compras con crédito separadas.
4. Abrir **Ahorro**.
5. Confirmar que el bloque ya no diga “Meta de ahorro cumplida” por el dinero disponible.
6. Comprobar que se distingan:
   - ahorro reservado;
   - pagos de deuda;
   - disponible según movimientos.
7. Verificar que **Tendencia del ahorro reservado** permanezca sin gráfico hasta tener tres cierres con ahorro real.
8. Abrir **Deudas** y revisar la referencia global:
   - debe mencionar mínimos y cuotas;
   - debe referirse a todas las deudas;
   - debe aclarar que no incluye intereses futuros.
9. En el perfil administrador abrir **Administrar → Calcular cómo pagar**.
10. Seleccionar una tarjeta, indicar pago mensual y TEA, agregar un monto adicional y pulsar **Comparar**.

## Diagnósticos

```js
HFDiagnosticoVisual.limpiarCapturas();
await HFDiagnosticoVisual.ejecutar();
await HFDiagnosticoEtapa12.ejecutar();
```

Resultados esperados:

- diagnóstico general: `24/24`, `listo: true`;
- etapa 12: `10/10`, `listo: true`.

## Regla contable aplicada

- **Ahorro reservado**: únicamente dinero registrado en metas.
- **Pagado a deudas**: únicamente pagos de tarjetas o préstamos registrados.
- **Disponible según movimientos**: ingresos menos consumos pagados con dinero del mes y pagos de deuda.
- **Compras con crédito**: aumentan deuda, pero no reducen el efectivo inmediatamente.

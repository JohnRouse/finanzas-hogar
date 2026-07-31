# Etapa 12 · Cierre financiero mensual

## Objetivo

Guardar una fotografía confiable de la deuda al finalizar cada mes, sin alterar cierres históricos cuando se registren movimientos nuevos.

## Flujo manual

1. Abre la pestaña **Deudas**.
2. En **Cierre del mes**, pulsa **Revisar**.
3. Confirma para cada tarjeta:
   - deuda total que muestra el banco;
   - pago mínimo;
   - fecha de vencimiento.
4. Revisa el resumen:
   - deuda de tarjetas y préstamos;
   - compromisos informados;
   - compras con crédito del mes;
   - pagos de deuda del mes;
   - vencimientos en 7, 15 y 30 días;
   - variación frente al cierre anterior, cuando exista.
5. Marca la casilla de revisión y pulsa **Guardar cierre**.
6. Cierra el modal y vuelve a abrirlo. Debe mostrar el cierre guardado o permitir actualizar el mes vigente.
7. Cambia a un mes anterior:
   - si existe cierre, debe mostrarse en modo consulta;
   - si no existe, la app debe explicar que no se puede crear un cierre histórico desde ese mes;
   - un mes anterior nunca debe modificar los saldos actuales de las tarjetas.

## Diagnósticos

Ejecuta primero el diagnóstico general:

```js
HFDiagnosticoVisual.limpiarCapturas();
await HFDiagnosticoVisual.ejecutar();
```

Resultado base esperado:

```text
24/24 · listo: true
```

Después ejecuta el diagnóstico de esta etapa:

```js
await HFDiagnosticoEtapa12.ejecutar();
```

Resultado esperado:

```text
4/4 · listo: true
```

## Persistencia

Los cierres se guardan en:

```text
hogares/{hogarId}/cierres_financieros/{AAAA-MM}
```

Cada documento conserva los saldos confirmados, préstamos, pagos mínimos, cuotas, vencimientos, movimientos resumidos y comparación con el cierre anterior.

## Condición para integrar

No fusionar con `master` hasta completar el flujo manual, obtener ambos diagnósticos aprobados y comprobar que los datos del hogar continúan intactos.
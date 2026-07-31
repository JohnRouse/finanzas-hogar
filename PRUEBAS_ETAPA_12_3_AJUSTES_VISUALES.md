# Etapa 12.3 · Ajustes de lectura inmediata

## Objetivo

Eliminar duplicidades y hacer que Resumen, Deudas y Ahorro puedan entenderse sin conocer el origen técnico de cada cálculo.

## Prueba visual

1. Abrir **Deudas** con el perfil administrador.
2. Confirmar que ya no aparezca el botón **Administrar** junto al título.
3. Pulsar el FAB rojo y comprobar que abra **Administrar deudas** con todas las opciones.
4. Cambiar al perfil miembro y verificar que el FAB no aparezca en Deudas.
5. Abrir **Resumen** y revisar **Necesita atención**:
   - filas blancas y compactas;
   - indicador rojo o amarillo pequeño;
   - máximo tres alertas inicialmente;
   - **Ver todas** y **Ver menos** funcionan.
6. Revisar **Distribución del ingreso** y confirmar que los cuatro conceptos usan el mismo formato de barra.
7. Revisar **Plan del mes**:
   - gastos esenciales: referencia de 50% de ingresos;
   - gastos flexibles: referencia de 30% de ingresos;
   - pagos de deuda: mínimos y cuotas informados;
   - ahorro reservado: metas configuradas.
8. Abrir **Ahorro** y confirmar que:
   - no aparezca el mensaje “El dinero solo cuenta…”;
   - no aparezca la línea de necesidades y gustos al final;
   - los KPI distingan ahorro reservado y lo que falta para las metas.

## Diagnósticos

```js
HFDiagnosticoVisual.limpiarCapturas();
await HFDiagnosticoVisual.ejecutar();
await HFDiagnosticoEtapa12.ejecutar();
```

Resultados esperados:

- diagnóstico general: `24/24`, `listo: true`;
- etapa 12: `15/15`, `listo: true`.

## Consola opcional

```js
HFDeudasFamiliares.obtenerEstado();
HFCoherenciaFinanciera.obtenerEstado();
```

La versión esperada de ambos módulos es `18.3`.
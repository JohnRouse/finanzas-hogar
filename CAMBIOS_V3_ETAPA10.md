# Hogar Finanzas v3 · Etapa 10

## Alertas inteligentes en tiempo real

- Nueva Cloud Function `generarAlertasInteligentes`, activada al registrar un gasto.
- Aviso único por mes e integrante al alcanzar 80% y 100% del presupuesto de hogar/servicios o entretenimiento.
- Aviso único cuando el disponible baja al 20% de los ingresos.
- Aviso inmediato cuando los gastos superan los ingresos.
- Los pagos de deuda no se consideran consumo para estas alertas.
- Se utiliza la preferencia existente `presupuesto`; cada dispositivo puede activarla o desactivarla.
- IDs deterministas evitan notificaciones repetidas durante el mismo mes y umbral.
- Recursos web actualizados a la versión 10.0.

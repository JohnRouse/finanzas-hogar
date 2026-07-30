# Hogar Finanzas v3 — Etapa 11.1

## Bandeja de movimientos detectados

Se añade una bandeja segura para revisar operaciones procedentes de correos bancarios antes de registrarlas.

### Incluye

- Colección Firestore `hogares/{hogarId}/movimientosImportados`.
- Estados: pendiente, confirmado, descartado, duplicado y requiere-revisión.
- Contador de pendientes en la pantalla Gastos.
- Edición de banco, tipo, monto, moneda, fecha, comercio, últimos dígitos, categoría, responsable y tarjeta.
- Huella SHA-256 para detectar duplicados.
- Confirmación explícita antes de crear un gasto o ingreso.
- Trazabilidad con `origenImportacionId`.
- La bandeja funciona en tiempo real mediante Firestore.
- Ningún correo actualiza automáticamente tarjetas, gastos o deudas.

## Aplicación

```bash
python3 APLICAR_ETAPA11_1.py ~/finanzas-hogar
```

Luego:

```bash
cd ~/finanzas-hogar
git add .
git commit -m "Etapa 11.1: bandeja de movimientos importados"
git push origin master
```

Esta etapa prepara la interfaz y el modelo de datos. La conexión OAuth con Outlook y los extractores de correos se implementan en la siguiente etapa.

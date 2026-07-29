# Hogar Finanzas v3 — Etapa 2

## Ajustes reorganizados

- Ajustes deja de mostrar nombres y sueldos como un formulario único.
- Nueva portada de Ajustes con accesos separados:
  - Hogar e integrantes
  - Ingresos fijos
  - Hogar y dispositivos
  - Notificaciones
  - Datos y seguridad
- Cada sección guarda sus propios cambios.

## Hogar e integrantes

- Edición independiente del nombre del hogar.
- Identificación visual de administrador y miembro.
- Conserva los IDs internos de los integrantes al cambiar sus nombres.

## Ingresos fijos

- Los montos mensuales se administran fuera de Configuración general.
- Se mantienen los campos de datos existentes (`ingresoYo` e `ingresoElla`) para no alterar cálculos ni historial.
- Se aclara la diferencia entre ingresos fijos automáticos e ingresos manuales del mes.

## Dispositivos y datos

- Código del hogar en una pantalla propia.
- Copiado compatible con navegadores que no ofrecen Clipboard API.
- Unión a otro hogar con explicación más clara.
- Exportación, cambio de perfil y borrado agrupados en Datos y seguridad.

## Compatibilidad

- No requiere migración adicional de datos.
- Compatible con el esquema de identidad de la Etapa 1.
- Se agregó un getter de `hogarId` al objeto DB para que la interfaz pueda mostrar correctamente el código del hogar.

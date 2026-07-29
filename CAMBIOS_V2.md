# Cambios Hogar Finanzas 2.0

## Botón flotante contextual

- **Resumen:** Registrar ingreso.
- **Gastos:** Gasto rápido.
- **Deudas:** Nueva deuda.
- **Ahorro:** Nueva meta.
- La etiqueta, el color y la acción cambian automáticamente al navegar.

## Alertas trasladadas al Resumen

- El estado financiero y las alertas generales de tarjetas ya no aparecen en **Deudas**.
- Ahora se muestran en **Resumen**, donde funcionan como avisos generales.
- Al cerrar cualquier modal, el botón flotante contextual vuelve a mostrarse correctamente, incluso en Resumen.

## Alertas de tarjetas plegables

- El Resumen muestra únicamente el estado compacto y las etiquetas principales.
- El detalle de cada tarjeta se abre con **Ver detalle** y puede volver a ocultarse.
- Se retiró la alerta general “Las tarjetas de crédito están al 100 % del límite”.
- Los KPI permanecen más arriba y el detalle solo ocupa espacio cuando se necesita.

## Tarjetas más compactas

- El exceso se muestra en un aviso reducido.
- Se indica cuánto falta pagar para volver dentro de la línea.
- La barra fue reemplazada por un indicador visual de línea de crédito.
- Los botones ahora son más pequeños: **Pagar** y **Conciliar**.

## Estado de conciliación

- Después de registrar un pago, la tarjeta muestra **Saldo estimado**.
- La tarjeta queda marcada como **Pendiente de conciliar con el banco**.
- Al conciliar, la marca pendiente desaparece.
- Después se muestra la fecha de la última conciliación.
- Las tarjetas antiguas sin conciliación muestran una indicación neutral.

## Pago de tarjeta simplificado

- Se retiró **Crédito liberado (opcional)**.
- Registrar un pago resta siempre el monto completo de la deuda estimada.
- La tarjeta queda pendiente de conciliación hasta verificar el disponible mostrado por el banco.
- El botón del modal ahora dice simplemente **Registrar pago**.

## Historial por tarjeta

- Cada tarjeta tiene una opción **Historial**.
- Muestra pagos registrados y conciliaciones recientes.
- Las conciliaciones incluyen deuda calculada, disponible del banco y diferencia detectada.
- El historial se abre en un modal y no recarga la pantalla principal.

## Historial robusto

- Los nuevos pagos quedan vinculados a la tarjeta mediante `tarjetaId`.
- El historial continúa funcionando aunque se cambie el nombre de la tarjeta.
- Los pagos antiguos siguen apareciendo mediante una búsqueda de compatibilidad.
- El modal muestra cantidad de pagos, total pagado, conciliaciones y última deuda conciliada.

## Fechas próximas de tarjetas

- Cada tarjeta muestra cuántos días faltan para el vencimiento y el cierre.
- Se usan estados compactos para fechas normales, próximas y urgentes.
- Las tarjetas se ordenan automáticamente por el vencimiento más cercano.
- Los días inexistentes en algunos meses, como 31, se ajustan al último día válido.

## Edición de tarjetas y préstamos

- Se reemplazó la X directa por un menú de tres puntos.
- El menú contiene **Editar** y **Eliminar**.
- Editar carga los datos existentes en el mismo formulario.
- Guardar cambios actualiza el registro original y no crea duplicados.
- Al crear un registro nuevo, el formulario vuelve a abrirse limpio.

## Gasto rápido y gasto detallado

- El botón contextual de Gastos ahora abre un selector.
- **Gasto rápido** conserva el flujo reducido.
- **Gasto detallado** permite descripción, fecha, responsable, categoría, medio de pago, tarjeta y voucher.
- Desde el gasto detallado se puede crear un gasto recurrente mensual.
- El formulario restablece la categoría y desactiva la recurrencia al abrir un registro nuevo.

## Administración de gastos recurrentes

- La opción **Recurrentes** permite ver todas las programaciones mensuales.
- Muestra cantidad de activos, pausados y total mensual programado.
- Cada recurrencia puede pausarse, reactivarse o eliminarse.
- Eliminar una recurrencia no borra los movimientos que ya fueron registrados.
- Los recurrentes pausados se conservan para poder reactivarlos posteriormente.

## Edición de gastos

- Cada movimiento tiene un menú de tres puntos con **Editar** y **Eliminar**.
- Editar reutiliza el formulario detallado y actualiza el movimiento original.
- Si cambia el monto, la tarjeta o el medio de pago, la deuda estimada se corrige automáticamente.
- Eliminar una compra con tarjeta revierte su efecto en la deuda estimada.
- Los pagos de tarjeta no se editan desde Gastos para evitar alterar su historial financiero; sí pueden eliminarse con reversión de deuda.

## Edición de gastos recurrentes

- Cada programación mensual ahora incluye la opción **Editar**.
- Se pueden cambiar descripción, monto, día mensual, categoría, responsable y medio de pago.
- Cuando se elige tarjeta de crédito, puede modificarse también la tarjeta asociada.
- Los cambios afectan únicamente las próximas generaciones; los movimientos ya registrados permanecen intactos.

## Gestión de ingresos manuales

- Se añadió **Ver ingresos** en el Resumen.
- Muestra los ingresos manuales del mes y su total acumulado.
- Cada ingreso puede editarse o eliminarse.
- La edición reutiliza el formulario de ingreso y actualiza el registro original.
- Los remanentes automáticos quedan protegidos y no aparecen en esta administración.

## Corrección crítica de funciones base

- Se restauraron `setVal`, `openModal`, `closeModal` y `closeModalOutside`.
- Se restauraron los controles de gasto rápido, selector de mes, pagos y conciliación.
- Se restauraron los helpers de gráficos, alertas y presupuesto que habían desaparecido al editar el bloque de gastos.
- Se verificaron todos los manejadores `onclick`, `onchange` y `oninput` del HTML.

## Corrección del estado global de modales

- Se restauró `_modalCount`, utilizado al abrir y cerrar ventanas.
- Se restauró `_bodyScrollY` y el estado auxiliar de la interfaz.
- Se restauraron las variables de conciliación, pagos y selector mensual vinculadas a las funciones recuperadas.
- El año y mes del selector ahora se inicializan usando la fecha actual.

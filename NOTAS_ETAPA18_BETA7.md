# Etapa 18 · Beta 7

Objetivo: eliminar el parpadeo del Resumen y hacer que eliminar una meta devuelva correctamente su saldo reservado al disponible.

- La fuente canónica de `Disponible hoy` se calcula desde `renderTodo`: ingresos menos salidas de efectivo menos saldo actualmente reservado en metas.
- Los textos auxiliares del Resumen se mantienen iguales desde el primer render hasta los módulos posteriores.
- La eliminación de una meta espera a que Firebase confirme el borrado antes de recalcular la interfaz.
- Si una meta tenía saldo reservado, el mensaje de confirmación indica que ese importe volverá al disponible.

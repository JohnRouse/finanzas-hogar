# Etapa 5.2 — optimización de navegación y renderizado

- Cambiar de pestaña ya no vuelve a consultar Firebase ni reconstruye toda la aplicación.
- Se evita la segunda carga causada por la primera instantánea de `onSnapshot`.
- Se mantiene una sola escucha en tiempo real de gastos.
- Se agrupan renderizados simultáneos para evitar parpadeos y consultas duplicadas.
- La comprobación del remanente se ejecuta una sola vez por mes durante la sesión.
- Se actualizó la versión de caché de los scripts a 5.2.

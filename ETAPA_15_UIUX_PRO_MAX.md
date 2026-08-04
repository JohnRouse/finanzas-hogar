# Etapa 15 · Corrección visual basada en UI/UX Pro Max

## Estado real

- Rama de validación: `etapa-15-correccion-visual-v2`.
- No fusionada con `etapa-14-experiencia-financiera`.
- Versión visual y caché PWA: `22.0`.
- Objetivo: mejorar la presentación sin modificar la lógica financiera ni los datos de Firebase.

## Fuente de diseño

Se revisó el repositorio `ui-ux-pro-max-skill-main.zip`, especialmente:

- reglas de prioridad de accesibilidad, interacción, responsive, tipografía, navegación y gráficos;
- producto `Personal Finance Tracker`;
- estilo `Minimalism + Accessible & Ethical`;
- patrón `Financial Dashboard`;
- tipografía recomendada `IBM Plex Sans` para banca, finanzas y datos;
- iconografía outline mediante SVG, evitando emojis como controles;
- arquitectura de tokens en tres niveles: primitivos, semánticos y de componente.

La recomendación automática de glassmorphism oscuro no se adoptó porque no responde al uso cotidiano de esta PWA ni al feedback visual recibido. Se conservó una interfaz clara, sobria y de alto contraste.

## Hallazgos de las capturas anteriores

1. Reapareció el bloque editorial `Vamos bien`, aunque ya había sido retirado.
2. En Deudas reaparecieron `Así están nuestras deudas`, `Lo que necesita atención` y la referencia global al final.
3. Las tarjetas mostraban demasiada información al mismo tiempo y generaban una pantalla excesivamente larga.
4. El rojo se repetía en casi todas las tarjetas y perdía su significado de urgencia.
5. No aparecía el menú de tres puntos para editar o eliminar tarjetas y préstamos.
6. Los movimientos seguían pareciendo tarjetas dentro de otra tarjeta.
7. La tipografía y la iconografía no mantenían un lenguaje financiero uniforme.

## Cambios implementados

### Sistema visual

- IBM Plex Sans para toda la interfaz.
- Paleta de confianza con azul marino, verde de progreso, ámbar de atención y rojo solo para situaciones críticas.
- Fondo gris azulado claro y superficies blancas.
- Escala de espaciado basada en 4 px.
- Radios, sombras y bordes definidos mediante tokens.
- Contraste de textos y foco visible.
- Áreas táctiles mínimas de 44 × 44 px.
- Compatibilidad con `prefers-reduced-motion`.

### Resumen

- Se fuerza la eliminación visual de `#estado-mes`, incluido el bloque `Vamos bien`.
- `Disponible hoy` permanece como cifra principal sin usar una tarjeta azul eléctrica.
- Compras con crédito y ahorro reservado se agrupan como indicadores secundarios compactos.
- `Participación del hogar` se renombra visualmente a `Gastos registrados por persona`.

### Movimientos

- Las operaciones se presentan como filas con divisores, no como tarjetas independientes.
- Se conserva descripción, categoría, fecha, importe, persona y medio.
- La fuente `Telegram` se muestra como `Automático`, con explicación mediante `title`.
- Los filtros se mantienen desplazables y táctiles.

### Deudas

- Se fuerza la eliminación de los bloques redundantes:
  - `Así están nuestras deudas`;
  - `Lo que necesita atención` dentro de Deudas;
  - `Referencia para todas las deudas`.
- Las tarjetas y préstamos se muestran compactos por defecto.
- `Ver detalles` expande vencimiento, mínimo, consejo y otros datos.
- Se mantiene una acción primaria visible:
  - `Registrar pago` para tarjetas;
  - `Pagar cuota` para préstamos.
- Se agrega un menú de tres puntos en tarjetas y préstamos para:
  - Editar;
  - Eliminar.
- El menú se reinyecta después de cada render dinámico de `HFDeudasFamiliares`.
- Las acciones antiguas de cuatro botones se ocultan para evitar duplicidad.

### Navegación y encabezado

- Navegación inferior con cuatro iconos SVG outline coherentes.
- Etiquetas: Resumen, Movimientos, Deudas y Plan.
- Botón de configuración con SVG y área táctil de 44 px.
- Selector de mes legible y sin texto pixelado.

### Gráficos

- Chart.js adopta IBM Plex Sans y colores neutrales.
- La evolución temporal conserva gráfico de línea.
- Las categorías mantienen barras horizontales, adecuadas para comparar y ordenar magnitudes.

## Archivos modificados

- `css/experiencia-financiera-v2.css`
- `js/experiencia-financiera-v2.js`
- `scripts/aplicar_correccion_visual_v2.py`
- `index.html` — actualizado automáticamente por workflow.
- `firebase-messaging-sw.js` — caché renovada automáticamente.

## Pruebas requeridas

### Terminal

```bash
node --check js/app.js
node --check js/experiencia-financiera-v2.js
python3 scripts/aplicar_correccion_visual_v2.py
```

### Navegador móvil

Probar en 330 px, 375 px y 430 px:

1. El bloque `Vamos bien` no aparece.
2. Deudas no muestra encabezado editorial, lista redundante ni referencia global.
3. Cada tarjeta y préstamo muestra el botón de tres puntos.
4. Editar abre el formulario correcto.
5. Eliminar abre la confirmación existente y no borra sin confirmación.
6. Registrar pago y pagar cuota conservan su flujo actual.
7. Ver detalles expande y contrae cada obligación.
8. Los movimientos no tienen desplazamiento horizontal.
9. La navegación inferior no tapa contenido.
10. El FAB no tapa la última fila visible.
11. Los gráficos mantienen leyenda, etiquetas y valores legibles.
12. `Ctrl + Shift + R` carga recursos `v=22.0`.

### Diagnósticos existentes

```js
await HFDiagnosticoVisual.ejecutar();
await HFDiagnosticoEtapa12.ejecutar();
await HFDiagnosticoEtapa13.ejecutar();
await HFDiagnosticoEtapa14.ejecutar();
```

## Resultado esperado

Una PWA financiera doméstica, sobria y clara, con menos información simultánea, acciones prioritarias visibles y detalles bajo demanda. La lógica de deuda, pagos, movimientos, Telegram, estados de cuenta y Firebase debe permanecer intacta.

## Riesgos

- La aplicación tiene varias capas históricas de CSS y módulos que vuelven a renderizar el DOM.
- `HFDeudasFamiliares` reemplaza completamente sus tarjetas al actualizar datos.
- El service worker puede mostrar una versión anterior si no se renueva la caché.
- El perfil no administrador no debe recibir acciones destructivas.

Las mejoras usan un observador y una reparación temporal durante el arranque para sobrevivir a los renders dinámicos sin modificar datos.

## Reversión

Para descartar esta validación y volver a la rama anterior:

```bash
git switch etapa-14-experiencia-financiera
```

Para revertir solo la capa visual dentro de esta rama:

1. retirar del `index.html` las referencias a `experiencia-financiera-v2.css` y `experiencia-financiera-v2.js`;
2. retirar esos dos recursos del `APP_SHELL` del service worker;
3. renovar `CACHE_NAME`;
4. limpiar el service worker y los datos del sitio en el navegador.

## Criterio de terminado

La etapa no se considera terminada ni debe fusionarse hasta recibir capturas aprobadas de Resumen, Movimientos, Deudas y Plan, y verificar los menús Editar/Eliminar en una tarjeta y un préstamo reales.

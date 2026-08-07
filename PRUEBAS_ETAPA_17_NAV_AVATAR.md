# Etapa 17 · Avatar flotante y navegación compacta

Versión de prueba: `34.1-beta.2`

## Resultado visual validado hasta beta.1

- El avatar sobresale por encima de la línea superior del nav.
- Resumen, Movimientos, Deudas y Plan recuperan una posición vertical más natural.
- El avatar continúa abriendo Configuración.
- El FAB mantiene separación suficiente respecto al avatar.
- Se revisó el comportamiento en emulación iPhone 15 Pro Max y Samsung Galaxy S8+.

## Hallazgo en preferencia de color oscura

La aplicación V34 usa un sistema visual claro definido por los tokens `--hf-*`, mientras que `styles.css` conservaba un bloque oscuro heredado que cambiaba únicamente variables antiguas como `--text`, `--text2`, `--text3`, `--surface` y `--bg`.

Al activar `prefers-color-scheme: dark`, algunos componentes seguían teniendo superficies claras pero heredaban textos claros. Esto producía textos casi invisibles, especialmente en objetivos financieros, distribución del ingreso y plan del mes.

### Solución beta.2

Hasta desarrollar un tema oscuro completo, V34.1 mantiene de forma explícita la paleta clara cuando el sistema solicita modo oscuro. De esta manera no existe un estado visual híbrido y se preserva el contraste de toda la interfaz.

## Logs revisados

El HAR de la prueba no contiene respuestas HTTP fallidas. Las solicitudes de Firestore se concentran en la carga inicial y en acciones ejecutadas durante la prueba.

Lighthouse mostró oportunidades de rendimiento y contraste. La prueba se realizó a través del túnel de Cloud Workstations y terminó con advertencia de tiempo de carga, por lo que las métricas de rendimiento deben tomarse como referencia y no como medición final de GitHub Pages.

## Próxima validación

1. Abrir la beta.2 en modo claro.
2. Activar `prefers-color-scheme: dark` o el modo oscuro del sistema.
3. Confirmar que la interfaz permanezca visualmente clara y que ningún texto pierda contraste.
4. Revisar Resumen, Movimientos, Deudas y Plan.
5. Abrir Configuración desde el avatar.
6. Confirmar que el avatar flotante y el FAB conservan sus posiciones.

# 🏠 Hogar Finanzas

App web para gestionar los gastos del hogar en pareja.
Funciona en cualquier navegador (iOS Safari, Android Chrome, PC).

---

## 📁 Estructura del proyecto

```
hogar-finanzas/
├── index.html        ← Página principal (estructura)
├── css/
│   └── styles.css    ← Todos los estilos visuales
└── js/
    ├── data.js       ← Base de datos local (localStorage)
    └── app.js        ← Lógica y funciones de la app
```

---

## 💾 ¿Dónde se guardan los datos?

Los datos se guardan en el **localStorage del navegador** en el dispositivo
que se use. Esto significa:

- ✅ No necesita internet para funcionar (salvo la primera carga de fuentes)
- ✅ Completamente gratuito, sin servidores propios
- ⚠️  Los datos son por dispositivo. Si tu pareja entra desde su celular,
     verá datos distintos a los tuyos.

### 👫 Para usarlo en pareja sincronizado:
La solución más simple es usar el mismo dispositivo, o compartir el acceso
por un hosting y que ambos usen la misma URL.
(En una futura versión se puede agregar sincronización con Firebase).

---

## 🚀 Cómo publicar en internet (GRATIS)

### Opción 1 — Netlify Drop (la más fácil, sin cuenta)
1. Ve a https://app.netlify.com/drop
2. Arrastra la carpeta `hogar-finanzas/` completa
3. Netlify te da una URL pública en segundos (ej: `algo-bonito.netlify.app`)
4. ¡Listo! Ábrela desde cualquier celular.

Para cambiar la URL a algo personalizado:
- Crea una cuenta gratuita en netlify.com
- En Site settings → Change site name → pon algo como `finanzas-luis-ana`
- Tu URL queda como `finanzas-luis-ana.netlify.app`

### Opción 2 — Cloudflare Pages (más rápido globalmente)
1. Crea cuenta en https://dash.cloudflare.com
2. Ve a Pages → Upload assets
3. Sube la carpeta `hogar-finanzas/`
4. Te da URL tipo `hogar-finanzas.pages.dev`

### Opción 3 — GitHub Pages (si sabes usar GitHub)
1. Crea un repositorio público en github.com
2. Sube los archivos
3. Ve a Settings → Pages → Source: main
4. URL: `tu-usuario.github.io/hogar-finanzas`

---

## 📱 Cómo instalarlo como app en el celular

### En iPhone (iOS Safari):
1. Abre la URL en Safari
2. Toca el botón de compartir (□↑)
3. Selecciona "Agregar a pantalla de inicio"
4. Aparece como una app nativa

### En Android (Chrome):
1. Abre la URL en Chrome
2. Toca el menú (⋮)
3. Selecciona "Agregar a pantalla de inicio"

---

## ✏️ Cómo personalizar

### Cambiar moneda (S/ → $, €, etc.)
En `js/app.js`, busca la función `fmt`:
```js
function fmt(v) { return `S/ ${Math.round(v).toLocaleString()}`; }
```
Cámbiala por:
```js
function fmt(v) { return `$ ${Math.round(v).toLocaleString()}`; }
```

### Cambiar colores principales
En `css/styles.css`, modifica las variables CSS al inicio:
```css
--blue: #2a7de1;   /* color principal */
--green: #3e7d2a;  /* ahorro */
--red: #c43030;    /* gastos / alertas */
```

### Agregar nuevas categorías de gasto
En `js/app.js`, busca el objeto `CATS`:
```js
const CATS = {
  'Alimentación': { icon:'🛒', color:'#2a7de1' },
  // agrega aquí:
  'Mascotas': { icon:'🐾', color:'#8b5cf6' },
};
```
Y en `index.html`, agrega el chip en el modal de gasto:
```html
<button class="chip" onclick="selectChip(this,'cat-chips')">🐾 Mascotas</button>
```

---

## 🔮 Próximas mejoras posibles

- [ ] Sincronización en la nube (Firebase Firestore)
- [ ] Exportar datos a Excel
- [ ] Notificaciones de vencimiento de tarjetas
- [ ] Modo de edición de gastos registrados
- [ ] Historial de meses anteriores con comparativas
- [ ] Gráfico de tendencia de deuda por tarjeta

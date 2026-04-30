# 🏠 Hogar Finanzas

**Aplicación web progresiva (PWA)** diseñada para la **gestión financiera compartida en pareja**.  

Registra ingresos, gastos, deudas y metas de ahorro de forma colaborativa y en tiempo real.

---

## ✨ Características principales

### 📊 Resumen Mensual
- KPIs clave: Ingresos, Gastos, Entretenimiento y Ahorro
- Gráfico de distribución de ingresos (gastos fijos + deudas, ocio y ahorro)
- Comparativa de gastos por categoría entre ambos miembros
- Presupuesto mensual con barras de progreso
- Registro de **ingresos extras** (freelance, clases, etc.)

### 💳 Gastos
- Registro detallado de movimientos con categorías, responsable y medio de pago
- **Gastos recurrentes** automáticos (se generan según día fijo del mes)
- Escaneo inteligente de vouchers mediante **Mindee OCR**
- Gráficos interactivos de evolución semanal y por categoría (Chart.js)

### 🏦 Deudas
- Gestión de tarjetas de crédito y préstamos
- Seguimiento de saldo disponible y cuotas pendientes
- Proyección de reducción de deuda
- Action sheet unificado para agregar deudas o registrar pagos
- Ordenamiento automático por nivel de utilización (riesgo)

### 🎯 Ahorro
- Metas de ahorro personalizables con iconos y progreso visual
- Fondo total de ahorro
- Progreso anual mes a mes
- Análisis inteligente de la **Regla 50/30/20** con detección de desvíos

### 🔄 Sincronización en Pareja
- Código de hogar único para conectar ambos dispositivos
- Identificación por usuario (cada celular sabe quién es)
- Actualizaciones en tiempo real mediante Firestore

---

## 🛠️ Tecnologías utilizadas

| Tecnología              | Uso |
|------------------------|-----|
| **HTML5 + CSS3**       | Interfaz mobile-first, dark mode y animaciones |
| **JavaScript (Vanilla)** | Lógica completa sin frameworks |
| **Chart.js**           | Gráficos interactivos |
| **Firebase**           | Firestore (base de datos) + Auth (anónima) |
| **Mindee API**         | OCR para escaneo de vouchers |
| **PWA**                | Instalación en pantalla de inicio |

---

## 📁 Estructura del proyecto

```bash
hogar-finanzas-ch/
├── index.html          # Estructura principal y modales
├── css/
│   └── styles.css      # Estilos (mobile-first + dark mode)
├── js/
│   ├── app.js          # Lógica de UI, gráficos y eventos
│   └── data.js         # Conexión con Firebase y CRUD
├── manifest.json       # Configuración PWA
├── sw.js               # Service Worker (offline)
└── README.md
```

## 🚀 Instalación y configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/johnrouse/hogar-finanzas-ch.git
cd hogar-finanzas-ch

### 2. Configurar Firebase
1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilita **Firestore Database** y **Authentication** (método Anónimo)
3. Copia las credenciales de tu proyecto y pégalas en la sección `firebaseConfig` dentro de `index.html`

```javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "XXXXXXXXXXXX",
  appId: "TU_APP_ID"
};

### 3. Configurar Mindee (opcional)
- Regístrate en [Mindee](https://www.mindee.com/)
- Crea un flujo de extracción para tickets/recibos
- Reemplaza la `API_KEY` y `MODEL_ID` en la función `procesarVoucher()` dentro de `js/app.js`

### 4. Ejecutar localmente
- Recomendado: Usa la extensión **Live Server** de Visual Studio Code
- O cualquier servidor estático (Vite, Python, etc.)

> ⚠️ **Importante**: No abras el archivo directamente desde el explorador (`file://`) porque Firebase Auth no funcionará correctamente.

---

## 📱 Cómo usar la aplicación

### Primera vez
1. Abre la aplicación en tu navegador o instálala como PWA.
2. Selecciona tu identidad (**Christian** o **Sydney**).
3. Ve al ⚙️ **Configuración** y define los nombres y sueldos base de cada uno.
4. Se generará automáticamente un **código de hogar**.

En el segundo dispositivo:
- Ingresa el código de hogar
- Selecciona la identidad de la otra persona

### Uso diario
- **Gastos**: Presiona + para registrar compras o pagos. Usa la cámara para escanear vouchers.
- **Recurrentes**: Los gastos marcados como recurrentes se generarán automáticamente cada mes.
- **Deudas**: Agrega tarjetas de crédito o préstamos y registra pagos fácilmente.
- **Ahorro**: Crea metas personalizadas y sigue su progreso.
- **Ingresos extras**: Regístralos en el Resumen mensual para que se sumen al total.

---

## 🧪 Próximas mejoras (Roadmap)

- [ ] Exportación de datos a CSV y PDF
- [ ] Gráficos de tendencia interanual
- [ ] Recordatorios de fecha de corte de tarjetas
- [ ] Notificaciones push
- [ ] Modo offline completo con sincronización diferida

---

## 👥 Créditos

Desarrollado por **Christian** con el apoyo y feedback constante de **Sydney y Santiago ♥️**.  
Diseño UX/UI revisado y optimizado en colaboración con inteligencia artificial.

---

## 📄 Licencia

Este proyecto es de uso **personal**. Puedes modificarlo y usarlo libremente siempre que mantengas la atribución al autor original.
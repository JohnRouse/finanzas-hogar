# 🏠 Hogar Finanzas CH

Aplicación web progresiva (PWA) para la gestión de finanzas en pareja.  
Registra ingresos, gastos, deudas y metas de ahorro de forma compartida y en tiempo real.

**Stack:** HTML5, CSS3, JavaScript (Vanilla), Firebase (Firestore + Auth), Chart.js, Mindee (OCR de vouchers)

---

## ✨ Funcionalidades principales

### 📊 Resumen mensual
- Indicadores clave (KPIs) de **ingresos**, **gastos**, **entretenimiento** y **ahorro**
- Gráfico de **distribución del ingreso** (gastos fijos + deudas, ocio y ahorro)
- Comparativa de gastos por categoría entre ambos miembros de la pareja
- **Presupuesto del mes** con barras de progreso y límites realistas
- Registro de **ingresos extras** (freelance, clases particulares) que se suman al ingreso total

### 💳 Gastos
- Lista de movimientos filtrada por mes, con categorías, responsable y medio de pago
- **Gastos recurrentes** configurables (día fijo del mes) que se generan automáticamente
- Escaneo de vouchers con inteligencia artificial (Mindee) para autocompletar montos y comercios
- Evolución semanal y total por categoría en gráficos interactivos (Chart.js)

### 🏦 Deudas
- Registro de **tarjetas de crédito** y **préstamos activos** con seguimiento de saldo disponible y cuotas
- Proyección de reducción de deuda a lo largo de los meses
- Action sheet unificado para **agregar** o **registrar pagos** a cualquier deuda
- Orden automático por nivel de utilización (riesgo)

### 🎯 Ahorro
- Metas de ahorro personalizables con iconos y barras de progreso
- **Fondo total** que suma todas las metas activas
- **Progreso anual** del ahorro mes a mes
- **Regla 50/30/20** inteligente: analiza gastos reales vs. presupuesto recomendado y detecta desvíos

### 🔄 Sincronización en pareja
- Código de hogar único para conectar dos dispositivos a la misma base de datos
- Identificación por dispositivo (cada celular sabe quién es el usuario principal)
- Notificaciones en tiempo real entre dispositivos (Firestore)

---

## 📁 Estructura del proyecto
# 🏠 Hogar Finanzas CH

Aplicación web progresiva (PWA) para la gestión de finanzas en pareja.  
Registra ingresos, gastos, deudas y metas de ahorro de forma compartida y en tiempo real.

**Stack:** HTML5, CSS3, JavaScript (Vanilla), Firebase (Firestore + Auth), Chart.js, Mindee (OCR de vouchers)

---

## ✨ Funcionalidades principales

### 📊 Resumen mensual
- Indicadores clave (KPIs) de **ingresos**, **gastos**, **entretenimiento** y **ahorro**
- Gráfico de **distribución del ingreso** (gastos fijos + deudas, ocio y ahorro)
- Comparativa de gastos por categoría entre ambos miembros de la pareja
- **Presupuesto del mes** con barras de progreso y límites realistas
- Registro de **ingresos extras** (freelance, clases particulares) que se suman al ingreso total

### 💳 Gastos
- Lista de movimientos filtrada por mes, con categorías, responsable y medio de pago
- **Gastos recurrentes** configurables (día fijo del mes) que se generan automáticamente
- Escaneo de vouchers con inteligencia artificial (Mindee) para autocompletar montos y comercios
- Evolución semanal y total por categoría en gráficos interactivos (Chart.js)

### 🏦 Deudas
- Registro de **tarjetas de crédito** y **préstamos activos** con seguimiento de saldo disponible y cuotas
- Proyección de reducción de deuda a lo largo de los meses
- Action sheet unificado para **agregar** o **registrar pagos** a cualquier deuda
- Orden automático por nivel de utilización (riesgo)

### 🎯 Ahorro
- Metas de ahorro personalizables con iconos y barras de progreso
- **Fondo total** que suma todas las metas activas
- **Progreso anual** del ahorro mes a mes
- **Regla 50/30/20** inteligente: analiza gastos reales vs. presupuesto recomendado y detecta desvíos

### 🔄 Sincronización en pareja
- Código de hogar único para conectar dos dispositivos a la misma base de datos
- Identificación por dispositivo (cada celular sabe quién es el usuario principal)
- Notificaciones en tiempo real entre dispositivos (Firestore)

---

## 📁 Estructura del proyecto

hogar-finanzas-ch/
├── index.html # Punto de entrada, estructura de todas las pantallas y modales
├── css/
│ └── styles.css # Estilos completos, mobile-first, dark mode, animaciones
├── js/
│ ├── app.js # Lógica de UI, renderizado, gráficos, modales y gestos
│ └── data.js # Capa de acceso a Firebase, operaciones CRUD y gestión de estado
├── manifest.json # Configuración de la PWA (iconos, colores, nombre)
├── sw.js # Service Worker para caché offline (opcional)
└── README.md


---

## 🚀 Instalación y configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/johnrouse/hogar-finanzas-ch.git
cd hogar-finanzas-ch

 2. Configurar Firebase
Crea un proyecto en Firebase Console

Habilita Firestore Database y Authentication (anónimo)

Copia las credenciales de tu proyecto y pégalas en el script de inicialización dentro de index.html

javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  ...
};

3. Configurar Mindee (opcional)
Regístrate en Mindee y crea un flujo de extracción de tickets/recibos.

Reemplaza API_KEY y MODEL_ID en la función procesarVoucher() de app.js.

4. Ejecutar localmente
Simplemente abre index.html con Live Server (Visual Studio Code) o cualquier servidor estático.

⚠️ No abras el archivo directamente desde el sistema de archivos (file://) porque Firebase Auth puede fallar.

📱 Uso paso a paso
Primera vez
Abre la app en tu navegador o instálala como PWA desde el menú del navegador.

Al abrir, te pedirá elegir quién eres (Christian o Sydney). Esto configura qué avatar se muestra y asigna automáticamente los gastos al dueño del dispositivo.

Ve al engranaje (⚙️) y configura los nombres y sueldos base de cada uno. Se generará un código de hogar.

En el otro dispositivo, ingresa el código de hogar y elige la identidad de la otra persona.

Día a día
En Gastos, presiona + para agregar una compra o pago recurrente.

Si es un pago con tarjeta de crédito, selecciona la tarjeta y automáticamente se descontará del disponible.

Los gastos marcados como recurrentes se regenerarán solos al cambiar de mes.

En Deudas, usa el mismo + para agregar tarjetas/préstamos o para registrar un pago a una deuda existente.

En Ahorro, crea metas (ej. "Viaje Cusco") y ve su progreso. El ahorro mensual se calcula automáticamente como Ingreso - Gastos - Pagos de deudas.

En Resumen, si tuviste ingresos extras por fuera del sueldo, añádelos con el botón + Ingreso extra. Todo se recalculará al instante.

🧩 Tecnologías utilizadas
Tecnología	Uso
HTML5 + CSS3	Interfaz móvil adaptativa (mobile-first), soporte para dark mode y animaciones suaves.
JavaScript (Vanilla)	Toda la lógica del lado del cliente sin dependencias de frameworks.
Chart.js 4	Gráficos de dona, barras, líneas y barras horizontales.
Firebase (Firestore)	Base de datos NoSQL en tiempo real para gastos, tarjetas, préstamos, metas e ingresos extras.
Firebase Auth	Autenticación anónima automática.
Mindee API	OCR de vouchers/tickets para extraer monto, comercio y fecha.
Service Worker	Soporte offline básico (cacheo) y preparación para notificaciones push.
PWA (manifest.json)	Permite instalar la app en la pantalla de inicio del celular como una aplicación nativa.

🛠️ Mejoras recientes (2026)

✅ Cálculo de ahorro realista descontando pagos de deudas

✅ Registro de ingresos extras (freelance, clases particulares)

✅ Gastos recurrentes automáticos (fecha fija mensual)

✅ Action sheet unificado en Deudas: agregar o pagar desde un solo botón

✅ Ordenamiento de tarjetas por porcentaje de utilización (riesgo)

✅ Regla 50/30/20 con barras de progreso y mensajes contextuales

✅ Scroll suave al cerrar modales (sin saltos)

✅ Presupuesto del mes con etiquetas claras (Gastado / Ahorrado vs Presupuesto)

✅ Modal de historial de gastos con buscador incorporado

🧪 Próximos pasos (ideas)

Exportación de datos a CSV/PDF

Gráficos de tendencia interanual

Recordatorios de fecha de corte de tarjetas

Notificaciones push (ya configurada la base en Firebase)

Modo offline completo con sincronización diferida

👥 Créditos
Desarrollado por Christian con el apoyo de Sydney.
Diseño UX/UI revisado y optimizado en colaboración con asistente de inteligencia artificial.

📄 Licencia
Este proyecto es de uso personal. Puedes modificarlo libremente respetando la atribución.
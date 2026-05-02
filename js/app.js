/* ══════════════════════════════════════════
   HOGAR FINANZAS — app.js (VERSIÓN FINAL CON TARJETAS, PRÉSTAMOS Y METAS)
   ══════════════════════════════════════════ */

/* ── CATEGORÍAS ── */
const CATS = {
  'Alimentación': { icon:'🛒', color:'#2a7de1' },
  'Servicios':    { icon:'⚡', color:'#3e7d2a' },
  'Entret.':      { icon:'🎬', color:'#b06a10' },
  'Transporte':   { icon:'⛽', color:'#888780' },
  'Salud':        { icon:'💊', color:'#c94b7b' },
  'Hogar':        { icon:'🏠', color:'#c43030' },
  'Otros':        { icon:'📦', color:'#6b6a66' },
};

const COLORES_METAS = [
  { bg:'#e8f2fc', fill:'#2a7de1' },
  { bg:'#e8f5e0', fill:'#3e7d2a' },
  { bg:'#fdf0dc', fill:'#b06a10' },
  { bg:'#faebf2', fill:'#c94b7b' },
  { bg:'#f0ede8', fill:'#888780' },
];


/* ── CACHE DE TARJETAS para el modal de gastos ── */
let tarjetasCacheGasto = [];

/* ── INSTANCIAS DE GRÁFICOS (para destruir antes de re-crear) ── */
let chartDonut = null;
let chartBar   = null;
let chartLine  = null;
let chartHbar  = null;
let chartDebt  = null;
let gastosDelMesCache = []; // Guardará los gastos para el modal
let configCache = {};       // Guardará los nombres (Tú/Pareja) para el modal
let renderChartsAbort = false;  // para cancelar renders anteriores

Object.defineProperty(window, 'hogarId', {
  get: () => window.DB ? window.DB.hogarId || null : null  // temporal (mejorar después)
});

/* ── ESTADO GLOBAL ── */
let mesActual = DB.getMesActual();

// Al principio de app.js, debajo de "use strict" o al inicio
const BASE_URL = new URL(document.baseURI).pathname; // ej: "/finanzas-hogar/"

/* ══════════════════════
   INICIO
══════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('g-fecha').value = new Date().toISOString().split('T')[0];
  document.querySelector('.app-logo').onclick = () => openAjustesModal();

  verificarConfiguracion();
  initGestures();
  revisarIdentidad();
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./firebase-messaging-sw.js')
      .then((registration) => {
        console.log('✅ Firebase Messaging SW registrado correctamente');
        registration.update();
      })
      .catch((err) => {
        console.error('❌ Error registrando Firebase Messaging SW:', err);
      });
  }
});

async function verificarConfiguracion() {
  const cfg = await DB.getConfig();
  
  if (cfg) {
    // Si hay configuración pero no hay identidad guardada localmente
    if (!localStorage.getItem('miUsuarioTipo')) {
      mostrarModalIdentificacion(cfg);
    } else {
      iniciarApp(cfg);
    }
  } else {
    ocultarSplash();
    openAjustesModal();
  }
}

// Función para mostrar el selector de quién es quién
function mostrarModalIdentificacion(cfg) {
  ocultarSplash();
  const modal = document.getElementById('identificacionModal');
  modal.style.display = 'flex';
  
  // Personalizar nombres en el modal según la configuración
  document.getElementById('name-choice-yo').textContent = cfg.nombreYo;
  document.getElementById('name-choice-ella').textContent = cfg.nombreElla;
  document.getElementById('avatar-choice-yo').textContent = cfg.nombreYo.slice(0,2).toUpperCase();
  document.getElementById('avatar-choice-ella').textContent = cfg.nombreElla.slice(0,2).toUpperCase();
}

// Función que se llama al hacer clic en un nombre
function establecerIdentidad(tipo) {
  localStorage.setItem('miUsuarioTipo', tipo); // Guarda 'yo' o 'pareja'
  document.getElementById('identificacionModal').style.display = 'none';
  location.reload(); // Recargamos para aplicar cambios
}

function vibrar() {
  if (navigator.vibrate) {
    navigator.vibrate(10); // Una vibración casi imperceptible de 10ms
  }
}

async function solicitarPermisoYGuardarToken() {
  try {
    const messaging = firebase.messaging();
    
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await messaging.getToken({
        vapidKey: 'BJ2hOCo0ghqObiVlmWBrGd0QXux17QV8bzk6KxjT-1MwOhmPJHXCD3ArCbR_NeaSj2aFPr_jcQI7iyBdD_O_hl8'
      });

      if (token && hogarId) {
        // Guardar el token en Firestore (asociado al hogar)
        await db.collection("hogares").doc(hogarId)
          .collection("tokens").doc(token).set({
            token: token,
            dispositivo: navigator.userAgent,
            ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp(),
            userId: auth.currentUser ? auth.currentUser.uid : 'anonimo'
          });
        console.log("✅ Token FCM guardado:", token);
      }
    } else {
      console.log("Permiso de notificaciones denegado");
    }
  } catch (error) {
    console.error("Error al obtener token FCM:", error);
  }
}

async function registrarTokenFCM() {
  try {
    // 1. Pedir permiso explícitamente si no está concedido
    if (Notification.permission !== 'granted') {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        console.warn('Permiso de notificación denegado');
        return;
      }
    }

    const messaging = firebase.messaging();
    // 2. Obtener token ACTUAL
    const registration = await navigator.serviceWorker.getRegistration();
if (!registration) {
  console.warn('No se encontró registro previo del SW');
  return;
}
const token = await messaging.getToken({
  vapidKey: 'BJ2hOCo0ghqObiVlmWBrGd0QXux17QV8bzk6KxjT-1MwOhmPJHXCD3ArCbR_NeaSj2aFPr_jcQI7iyBdD_O_hl8',
  serviceWorkerRegistration: registration
});

    if (token && hogarId) {
      const miTipo = localStorage.getItem('miUsuarioTipo') || 'yo';
      // 3. Guardar token en Firestore bajo el hogar, con el tipo de usuario
      console.log('Intentando guardar token:', token, 'usuario:', miTipo);
      await db.collection("hogares").doc(hogarId).collection("tokens").doc(token).set({
        token: token,
        usuario: miTipo,  // 'yo' o 'pareja'
        fecha: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Token FCM guardado (${miTipo}):`, token);
    } else {
      console.warn('No se pudo obtener el token FCM.');
    }
  } catch (error) {
  console.error('❌ Error al guardar token:', error);
  }
}

function openAjustesModal() {
  // Valores por defecto solo la primera vez
  if (!DB.hogarId) {
    document.getElementById('aj-nombre-yo').value = 'Christian';
    document.getElementById('aj-nombre-ella').value = 'Sydney';
    document.getElementById('aj-ingreso-yo').value = '1500';
    document.getElementById('aj-ingreso-ella').value = '1200';
  }

  // Mostrar el código actual
  const displayId = document.getElementById('display-hogar-id');
  if (displayId) {
    displayId.textContent = DB.hogarId || "Se generará al guardar";
  }

  openModal('ajustesModal');
}

// Nueva función para copiar el código al portapapeles
function copyHogarId() {
  if (!DB.hogarId) return;
  navigator.clipboard.writeText(DB.hogarId);
  showToast("Código copiado al portapapeles ✓");
}

// Nueva función para procesar la unión a un hogar
async function unirseAHogar() {
  const input = document.getElementById('join-id-input');
  const code = input.value.trim().toUpperCase();
  
  if (!code) return;
  
  if (confirm("¿Estás seguro? Se borrará el acceso a los datos actuales de este dispositivo para unirte al nuevo hogar.")) {
    await DB.joinHogar(code);
  }
}

async function guardarAjustes() {
  const nombreYo = document.getElementById('aj-nombre-yo').value.trim();
  const nombreElla = document.getElementById('aj-nombre-ella').value.trim();
  const ingresoYo = parseFloat(document.getElementById('aj-ingreso-yo').value) || 0;
  const ingresoElla = parseFloat(document.getElementById('aj-ingreso-ella').value) || 0;

  if (!nombreYo || !nombreElla) {
    alert('Por favor ingresa el nombre de ambos');
    return;
  }

  const cfg = {
    nombreYo: nombreYo,
    nombreElla: nombreElla,
    ingresoYo: ingresoYo,
    ingresoElla: ingresoElla,
    presupEntret: 300,
    metaAhorro: 200
  };

  const saved = await DB.saveConfig(cfg);
  if (saved) {
    closeModal('ajustesModal');
    showToast('Configuración guardada correctamente ✓');

    const freshCfg = await DB.getConfig();
    if (freshCfg) {
      iniciarApp(freshCfg);
      actualizarNombresEnFormularios(freshCfg);
      actualizarNombresEnDeudas(freshCfg);
    }
  }
}

function iniciarApp(cfg) {
  aplicarNombres(cfg);
  actualizarNombresEnFormularios(cfg);   // si ya la tienes
  actualizarNombresEnDeudas(cfg);        // ← Nueva línea
  actualizarMesBtn();
  renderTodo();
  registrarTokenFCM(); // <--- ¡Añade esto aquí!
  iniciarEscuchaNotificaciones();

   // 🔥 ESCUCHA EN TIEMPO REAL: Si el hogar cambia en Firebase, refresca la UI
  db.collection("hogares").doc(hogarId).collection("gastos")
    .onSnapshot(() => {
      console.log("🔄 Cambio detectado en la nube, actualizando...");
      renderTodo();
    });
}

// Se llama al cargar la app para ver si ya sabemos quién es el usuario
function revisarIdentidad() {
  const miTipo = localStorage.getItem('miUsuarioTipo');
  if (!miTipo) {
    // Si no hay identidad, mostramos el modal de selección
    const overlay = document.getElementById('identidad-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      // Intentar poner los nombres reales de la config si ya existen
      DB.getConfig().then(cfg => {
        if (cfg) {
          document.getElementById('identidad-nombre-yo').textContent = cfg.nombreYo;
          document.getElementById('identidad-nombre-ella').textContent = cfg.nombreElla;
        }
      });
    }
  }
}

// Se llama cuando el usuario hace clic en su nombre en el modal inicial
function definirIdentidad(tipo) {
  localStorage.setItem('miUsuarioTipo', tipo);
  document.getElementById('identidad-overlay').style.display = 'none';
  showToast("Identidad confirmada ✓");
  renderTodo(); // Para actualizar el avatar del header
}

function iniciarEscuchaNotificaciones() {
  if (!hogarId) return;

  // Solo nos interesan las notificaciones creadas DESPUÉS de abrir la app
  const ahora = firebase.firestore.Timestamp.now();

  db.collection("hogares").doc(hogarId).collection("notificaciones")
    .where("fecha", ">", ahora)
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          
          // 👇 AQUÍ ESTÁ LA CORRECCIÓN: usamos change.doc.data()
          const notif = change.doc.data(); 
          
          // Solo mostramos si el mensaje es de OTRO usuario
          if (notif.usuarioId !== auth.currentUser?.uid) {
            mostrarToast(`🔔 ${notif.texto}`);
          }
        }
      });
    });
}

function aplicarNombres(cfg) {
  const miTipo = localStorage.getItem('miUsuarioTipo') || 'yo';
  const yo = cfg.nombreYo || 'Tú';
  const ella = cfg.nombreElla || 'Pareja';

  const avatarYo = document.getElementById('avatarYo');
  const avatarElla = document.getElementById('avatarElla');

  // Lógica: Solo mostrar el círculo de quien está usando la app
  if (miTipo === 'yo') {
    avatarYo.style.display = 'flex';
    avatarYo.textContent = yo.slice(0,2).toUpperCase();
    avatarElla.style.display = 'none';
  } else {
    avatarYo.style.display = 'none';
    avatarElla.style.display = 'flex';
    avatarElla.textContent = ella.slice(0,2).toUpperCase();
  }

  // El resto de etiquetas (Tú/Pareja) se mantienen igual en los gráficos
  ['label-yo','label-yo-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = cfg.nombreYo;
  });
  ['label-ella','label-ella-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = cfg.nombreElla;
  });
}

function actualizarNombresEnFormularios(cfg) {
  const nombreYo = cfg.nombreYo || 'Christian';
  const nombreElla = cfg.nombreElla || 'Sydney';

  // Actualizar selector del modal de gasto
  const selectQuien = document.getElementById('g-quien');
  if (selectQuien) {
    selectQuien.options[0].text = nombreYo;     // Yo
    selectQuien.options[1].text = nombreElla;   // Pareja
  }

  // También actualizar los labels en la leyenda (por si acaso)
  document.getElementById('label-yo').textContent = nombreYo;
  document.getElementById('label-yo-2').textContent = nombreYo;
  document.getElementById('label-ella').textContent = nombreElla;
  document.getElementById('label-ella-2').textContent = nombreElla;

  // Actualizar avatares
  document.getElementById('avatarYo').textContent = nombreYo.slice(0,2).toUpperCase();
  document.getElementById('avatarElla').textContent = nombreElla.slice(0,2).toUpperCase();
}

// Actualiza los nombres en los selectores de Tarjetas y Préstamos
function actualizarNombresEnDeudas(cfg) {
  const nombreYo = cfg.nombreYo || 'Christian';
  const nombreElla = cfg.nombreElla || 'Sydney';

  // Modal Tarjeta
  const tQuien = document.getElementById('t-quien');
  if (tQuien) {
    tQuien.options[0].text = nombreYo;
    tQuien.options[1].text = nombreElla;
  }

  // Modal Préstamo
  const pQuien = document.getElementById('p-quien');
  if (pQuien) {
    pQuien.options[0].text = nombreYo;
    pQuien.options[1].text = nombreElla;
  }
}

function cerrarSesionIdentidad() {
  localStorage.removeItem('miUsuarioTipo');
  location.reload();
}

let activeTab = 'resumen';

function showPage(id, idx) {
  vibrar(); // Feedback háptico para móvil
  activeTab = id; // Actualizamos la variable global para que el FAB sepa qué abrir

  // 1. Gestionar clases activas (Páginas, Tabs superiores y Bottom Nav)
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));

  const targetPage = document.getElementById('page-' + id);
  if (targetPage) targetPage.classList.add('active');
  
  const tabs = document.querySelectorAll('.tab');
  if (tabs[idx]) tabs[idx].classList.add('active');
  
  const bnavBtns = document.querySelectorAll('.bnav-btn');
  if (bnavBtns[idx]) bnavBtns[idx].classList.add('active');

  // 2. Lógica del Botón Flotante (FAB)
  const fab = document.getElementById('fab-global');
  if (fab) {
    if (id === 'resumen') {
      fab.style.display = 'none';
    } else {
      fab.style.display = 'flex';
      
      // Mapeo de colores: más limpio que usar muchos if/else
      const coloresFAB = {
        'gastos': '#2563eb', // Azul
        'deudas': '#dc2626', // Rojo
        'ahorro': '#059669'  // Verde
      };
      
      fab.style.backgroundColor = coloresFAB[id] || '#2563eb';
    }
  }

  // 3. UX de navegación: Volver al inicio del scroll al cambiar de pestaña
  window.scrollTo({ top: 0, behavior: 'instant' });

  // 4. Actualizar datos de la pantalla
  renderTodo();
}

// Lógica de qué abrir al tocar el +
function handleFabClick() {
  vibrar();
  switch (activeTab) {
    case 'gastos':
      openGastoModal();
      break;
    case 'deudas':
      openModal('deudaChoiceModal'); // Abrimos el selector de tarjetas o préstamos
      break;
    case 'ahorro':
      openModal('metaModal');
      break;
  }
}

function cycleMonth() {
  alert("Función de cambio de mes en desarrollo.");
}

function actualizarMesBtn() {
  document.getElementById('monthBtn').textContent = DB.formatMes(mesActual) + ' ▾';
}

function mostrarSkeletons() {
  const el = document.getElementById('expenseList');
  if (!el) return;

  // Creamos 5 elementos de esqueleto (el mismo número que el resumen)
  let html = '';
  for (let i = 0; i < 5; i++) {
    html += `
      <div class="skeleton-item">
        <div class="skeleton skeleton-icon"></div>
        <div style="flex: 1">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-subtext"></div>
        </div>
        <div class="skeleton skeleton-amount"></div>
      </div>`;
  }
  el.innerHTML = html;
}

async function procesarRecurrentes(mes) {

  if (await DB.yaProcesadosRecurrentes(mes)) return;

  const recurrentes = await DB.getRecurrentes();
  const gastosMes = await DB.getGastos(mes); // ya tenemos los gastos actuales

  for (const rec of recurrentes) {
    if (!rec.activo) continue;

    // Construir fecha para este mes
    const [year, month] = mes.split('-');
    const dia = rec.dia;
    // Ajustar día máximo del mes (ej. 31 en abril => 30)
    const fecha = new Date(parseInt(year), parseInt(month)-1, Math.min(dia, new Date(parseInt(year), parseInt(month), 0).getDate()));
    const fechaStr = fecha.toISOString().split('T')[0];

    // Verificar si ya existe un gasto con la misma descripción, categoría y monto en este mes
    const duplicado = gastosMes.some(g => g.recurrenteId === rec.id);

    if (!duplicado) {
      const nuevoGasto = {
        desc: rec.desc,
        monto: rec.monto,
        quien: rec.quien,
        cat: rec.cat,
        icono: rec.icono,
        medio: rec.medio,
        tarjetaId: rec.tarjetaId || null,
        tarjetaNombre: rec.tarjetaNombre || null,
        fecha: fechaStr,
        creadoEn: new Date().toISOString(),
        recurrenteId: rec.id  // <-- CLAVE
      };
      await DB.addGasto(nuevoGasto);

      // Si es con tarjeta, aumentar deuda (igual que en agregarGasto)
      if (nuevoGasto.medio === 'tarjeta' && nuevoGasto.tarjetaId) {
        const tarjeta = (await DB.getTarjetas()).find(t => t.id === nuevoGasto.tarjetaId);
        if (tarjeta) {
          const nuevaDeuda = (parseFloat(tarjeta.deuda) || 0) + nuevoGasto.monto;
          await db.collection("hogares").doc(hogarId).collection("tarjetas").doc(nuevoGasto.tarjetaId).update({ deuda: nuevaDeuda });
        }
      }
      console.log(`✅ Recurrente generado: ${rec.desc} para ${fechaStr}`);
    }
  }
  await DB.marcarRecurrentesProcesados(mes);
}

/* ══════════════════════
   RENDER PRINCIPAL (COMPLETO)
══════════════════════ */
async function renderTodo() {
  mostrarSkeletons();

  const kpiIds = ['kpi-ingresos', 'kpi-gastos', 'kpi-entret', 'kpi-ahorro', 'kpi-deuda-total', 'kpi-pago-mensual', 'kpi-fondo'];
  kpiIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton" style="width:80px; height:20px; display:inline-block"></span>';
  });

  const cfg = await DB.getConfig();
  if (!cfg) return;

  let [gastos, tarjetas, prestamos, metas] = await Promise.all([
    DB.getGastos(mesActual),
    DB.getTarjetas(),
    DB.getPrestamos(),
    DB.getMetas()
  ]);

  await procesarRecurrentes(mesActual);
  gastos = await DB.getGastos(mesActual);
  
  await DB.generarArrastreSiNecesario(mesActual);

  const ingresosMes = await DB.getIngresosMes(mesActual);
  const ingresoTotal = ingresosMes.reduce((sum, ing) => sum + (parseFloat(ing.monto) || 0), 0);

  const gastoTotal = Array.isArray(gastos) ? gastos.reduce((a,g) => a + (g.monto||0), 0) : 0;
  const gastoEntret = Array.isArray(gastos) ? gastos.filter(g => g.cat === 'Entret.').reduce((a,g) => a + (g.monto||0), 0) : 0;
  
  const ahorro = Math.max(0, ingresoTotal - gastoTotal);

  setVal('kpi-ingresos', `S/ ${ingresoTotal.toLocaleString()}`);
  const elSubIngreso = document.getElementById('kpi-ingresos')?.nextElementSibling;
  if (elSubIngreso && elSubIngreso.classList.contains('kpi-sub')) {
    elSubIngreso.textContent = 'Total ingresos del mes';
  }
  
  setVal('kpi-gastos', `S/ ${gastoTotal.toLocaleString()}`);
  setVal('kpi-gastos-sub', ingresoTotal > 0 ? `${Math.round(gastoTotal / ingresoTotal * 100)}% del ingreso` : '0%');
  
  const presupEntret = parseFloat(cfg.presupEntret) || 300;
  setVal('kpi-entret', `S/ ${gastoEntret.toLocaleString()}`);
  setVal('kpi-entret-sub', `Presupuesto: S/ ${presupEntret.toLocaleString()} · Gastado: S/ ${gastoEntret.toLocaleString()}`);

  setVal('kpi-ahorro', `S/ ${ahorro.toLocaleString()}`);
  setVal('kpi-ahorro-sub', `${Math.round(ahorro / (cfg.metaAhorro||200) * 100)}% de meta`);
  setVal('kpi-ahorro2', `S/ ${ahorro.toLocaleString()}`);
  setVal('kpi-ahorro2-sub', `${Math.round(ahorro / (cfg.metaAhorro||200) * 100)}% de la meta`);

  const deudaTotal = [...tarjetas, ...prestamos].reduce((a, d) => a + (parseFloat(d.deuda || d.saldo) || 0), 0);
  const pagoMensual = [
    ...tarjetas.map(t => parseFloat(t.cuotaMin) || 0),
    ...prestamos.map(p => parseFloat(p.cuota) || 0)
  ].reduce((a, b) => a + b, 0);

  setVal('kpi-deuda-total', `S/ ${deudaTotal.toLocaleString()}`);
  setVal('kpi-pago-mensual', `S/ ${pagoMensual.toLocaleString()}`);
  setVal('kpi-pago-sub', ingresoTotal > 0 ? `${Math.round(pagoMensual / ingresoTotal * 100)}% del ingreso` : '0%');

  const fondoTotal = metas.reduce((a, m) => a + (parseFloat(m.actual) || 0), 0);
  setVal('kpi-fondo', `S/ ${fondoTotal.toLocaleString()}`);

  renderGastos(gastos, cfg);
  renderTarjetas(tarjetas, cfg);
  renderPrestamos(prestamos, cfg);
  renderMetas(metas);
  await renderCharts(gastos, cfg, tarjetas, prestamos, ingresoTotal, 0);
  renderDistribucion(ingresoTotal, gastoTotal, gastoEntret, ahorro, deudaTotal, 0);
  renderPresupuesto(gastos, cfg, tarjetas, prestamos, ingresoTotal, ahorro, 0);
  renderAlertas(tarjetas, prestamos, gastoTotal, ingresoTotal);

  ocultarSplash();
  
  console.log(`Renderizado completado - Ingresos: ${ingresoTotal} | Deuda Total: ${deudaTotal} | Ahorro: ${ahorro}`);
}

/* ── RENDER PRÉSTAMOS ── */
function generarGastoHTML(g, cfg) {
  const yo = cfg.nombreYo || 'Tú';
  const ella = cfg.nombreElla || 'Pareja';
  const quienLabel = g.quien === 'yo' ? yo : g.quien === 'pareja' ? ella : 'Ambos';
  const fechaStr = g.fecha ? new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '';
  const badgeTarjeta = g.medio === 'tarjeta' && g.tarjetaNombre
    ? `<span class="expense-badge-tarjeta">💳 ${g.tarjetaNombre}</span>`
    : '';

  return `
  <div class="expense-item" data-id="${g.id}">
    <div class="expense-swipe-wrap">
      <div class="expense-item-inner">
        <div class="expense-icon">${g.icono || '📦'}</div>
        <div class="expense-info">
          <div class="expense-name">${g.desc}</div>
          <div class="expense-cat"><span class="expense-cat-text">${g.cat}</span><span class="expense-cat-date"> · ${fechaStr}</span></div>
          ${badgeTarjeta}
        </div>
        <div class="expense-right">
          <div class="expense-amount">S/ ${g.monto}</div>
          <span class="expense-who">${quienLabel}</span>
        </div>
        <!-- X visible solo en desktop (hover) -->
        <button class="expense-delete" onclick="eliminarGasto('${g.id}')" title="Eliminar gasto" aria-label="Eliminar gasto">
          ✕
        </button>
      </div>
    </div>
  </div>`;
}

function ocultarSplash() {
  const splash = document.getElementById('pwa-splash');
  if (splash) {
    splash.style.opacity = '0';
    splash.style.visibility = 'hidden';
    document.body.classList.remove('loading');
    
    // Opcional: eliminar del DOM después de la transición para ahorrar memoria
    setTimeout(() => splash.remove(), 500);
  }
}

// 2. Tu función principal modificada
function renderGastos(gastos, cfg) {
  const el = document.getElementById('expenseList');
  if (!el) return;

  // Guardamos en cache para el modal
  // Ordenar: primero por fecha desc, luego por timestamp preciso desc para desempatar mismo día
  gastosDelMesCache = [...gastos].sort((a, b) => {
    const fechaDiff = (b.fecha || '').localeCompare(a.fecha || '');
    if (fechaDiff !== 0) return fechaDiff;
    // Mismo día → usar creadoEn para desempatar (más reciente primero)
    return (b.creadoEn || '').localeCompare(a.creadoEn || '');
  });
  configCache = cfg;

  if (gastosDelMesCache.length === 0) {
    el.innerHTML = '<div class="empty-state">Sin gastos registrados este mes.<br>Presiona "+ Agregar" para empezar.</div>';
    return;
  }

  // Tomamos solo los primeros 5 para la vista principal
  const resumen = gastosDelMesCache.slice(0, 5);
  
  let html = resumen.map(g => generarGastoHTML(g, cfg)).join('');

  // Si hay más de 5, añadimos el botón "Ver todo"
  if (gastosDelMesCache.length > 5) {
    const mesTexto = DB.formatMes(mesActual); // mesActual es global, definido al inicio
html += `
  <div class="ver-todo-container">
    <button class="btn-ver-todo" onclick="abrirHistorialCompleto()">
      Ver todos los movimientos de ${mesTexto}
    </button>
  </div>`;
  }

  el.innerHTML = html;
  // RE-INICIALIZAR GESTOS DESPUÉS DE RENDERIZAR
  setTimeout(initGestures, 100); 
}

// 3. Función para llenar y abrir el modal
function abrirHistorialCompleto() {
  const listaFull = document.getElementById('listaCompletaGastos');
  const displayMes = document.getElementById('month-display').textContent;

  if (document.getElementById('historialTitle')) {
    document.getElementById('historialTitle').textContent = `Movimientos de ${displayMes}`;
  }

  // Limpiar buscador al abrir
  const searchInput = document.getElementById('historial-search');
  const clearBtn    = document.getElementById('historial-search-clear');
  if (searchInput) searchInput.value = '';
  if (clearBtn)    clearBtn.style.display = 'none';
  const noRes = document.getElementById('historial-no-resultados');
  if (noRes) noRes.style.display = 'none';

  // Renderizamos TODOS los gastos guardados en el cache
  listaFull.innerHTML = gastosDelMesCache.map(g => generarGastoHTML(g, configCache)).join('');

  openModal('modalHistorial');

  // Inicializar gestos de swipe DENTRO del modal, después de renderizar
  // Usamos requestAnimationFrame para asegurar que el DOM esté pintado
  requestAnimationFrame(() => {
    setTimeout(initGesturesModal, 50);
  });
}

/* ── BUSCADOR DE HISTORIAL ── */
function filtrarHistorial(query) {
  const clearBtn = document.getElementById('historial-search-clear');
  if (clearBtn) clearBtn.style.display = query.length > 0 ? 'inline-block' : 'none';

  const q = query.trim().toLowerCase();
  const listaFull = document.getElementById('listaCompletaGastos');
  const noResultados = document.getElementById('historial-no-resultados');

  if (!q) {
    listaFull.innerHTML = gastosDelMesCache.map(g => generarGastoHTML(g, configCache)).join('');
    if (noResultados) noResultados.style.display = 'none';
    setTimeout(initGesturesModal, 50);
    return;
  }

  const filtrados = gastosDelMesCache.filter(g => {
    const nombre = (g.desc  || '').toLowerCase();
    const cat    = (g.cat   || '').toLowerCase();
    const tarj   = (g.tarjetaNombre || '').toLowerCase();
    return nombre.startsWith(q) || cat.startsWith(q) || nombre.includes(q) || cat.includes(q) || tarj.includes(q);
  });

  if (filtrados.length === 0) {
    listaFull.innerHTML = '';
    if (noResultados) noResultados.style.display = 'block';
  } else {
    if (noResultados) noResultados.style.display = 'none';
    listaFull.innerHTML = filtrados.map(g => generarGastoHTML(g, configCache)).join('');
    setTimeout(initGesturesModal, 50);
  }
}

function limpiarBusquedaHistorial() {
  const input = document.getElementById('historial-search');
  if (input) { input.value = ''; input.focus(); }
  filtrarHistorial('');
}

/* ── RENDER TARJETAS (VERSIÓN ACTUALIZADA) ── */
function renderTarjetas(tarjetas, cfg) {
  const el = document.getElementById('tarjetas-grid');
  if (!el) return;

  if (tarjetas.length === 0) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Sin tarjetas registradas. Presiona "+ Agregar".</div>';
    return;
  }

   // ✅ ORDENAR: de mayor a menor porcentaje de utilización (riesgo)
  const ordenadas = [...tarjetas].sort((a, b) => {
    const usoA = (parseFloat(a.limite) || 0) > 0 ? (parseFloat(a.deuda) || 0) / (parseFloat(a.limite) || 1) : 0;
    const usoB = (parseFloat(b.limite) || 0) > 0 ? (parseFloat(b.deuda) || 0) / (parseFloat(b.limite) || 1) : 0;
    return usoB - usoA; // descendente
  });

  const nombreYo = cfg.nombreYo || 'Christian';
  const nombreElla = cfg.nombreElla || 'Sydney';

  let html = '';
  ordenadas.forEach(t => {
    const deuda = parseFloat(t.deuda) || 0;
    const limite = parseFloat(t.limite) || 0;
    const disponible = Math.max(0, limite - deuda);
    
    const uso = limite > 0 ? Math.round((deuda / limite) * 100) : 0;
    const color = uso > 80 ? '#c43030' : uso > 60 ? '#b06a10' : '#2a7de1';

    // Determinar nombre correcto
    let quienTexto = '';
    if (t.quien === 'yo') quienTexto = nombreYo.toUpperCase();
    else if (t.quien === 'pareja') quienTexto = nombreElla.toUpperCase();
    else quienTexto = 'COMPARTIDA';

    html += `
      <div class="debt-card">
        <button class="debt-delete" onclick="eliminarTarjeta('${t.id}')">✕</button>
        <div class="debt-type">TARJETA · ${quienTexto}</div>
        <div class="debt-name">${t.nombre}</div>
        
        <!-- CAMBIO PRINCIPAL: Mostrar Saldo Disponible -->
        <div class="debt-total" style="color: ${disponible > 0 ? 'var(--text)' : '#c43030'}">
          S/ ${disponible.toLocaleString()}
        </div>
        <div class="debt-sub">
          Disponible · Límite: S/ ${limite.toLocaleString()} 
          <span style="color:#888">· Vence día ${t.vence||'—'}</span>
        </div>
        
        <div class="debt-prog-bg">
          <div class="debt-prog-fill" style="width:${uso}%; background:${color};"></div>
        </div>
        <div class="debt-hint">${uso}% utilizado</div>
      </div>`;
  });
  el.innerHTML = html;
}

/* ── RENDER PRÉSTAMOS (con nombres reales) ── */
function renderPrestamos(prestamos, cfg) {
  const el = document.getElementById('prestamos-grid');
  if (!el) return;

  if (prestamos.length === 0) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Sin préstamos registrados.</div>';
    return;
  }

  const nombreYo = cfg.nombreYo || 'Christian';
  const nombreElla = cfg.nombreElla || 'Sydney';
  
  let html = '';

  prestamos.forEach(p => {
    let quienTexto = '';
    if (p.quien === 'yo') quienTexto = nombreYo.toUpperCase();
    else if (p.quien === 'pareja') quienTexto = nombreElla.toUpperCase();
    else quienTexto = 'COMPARTIDO';

    const saldo = parseFloat(p.saldo) || 0;
    const cuota = parseFloat(p.cuota) || 0;
    const progreso = p.total > 0 ? Math.round((p.pagadas / p.total) * 100) : 0;
    
    html += `
      <div class="debt-card">
        <button class="debt-delete" onclick="eliminarPrestamo('${p.id}')">✕</button>
        <div class="debt-type">PRÉSTAMO · ${quienTexto}</div>
        <div class="debt-name">${p.nombre}</div>
        <div class="debt-total">S/ ${saldo.toLocaleString()}</div>
        <div class="debt-sub">
          Cuota mensual: S/ ${parseFloat(p.cuota||0).toLocaleString()} 
          · ${p.pagadas || 0}/${p.total || '?'} cuotas
        </div>
        <div class="debt-prog-bg"><div class="debt-prog-fill" style="width:${progreso}%; background:#3e7d2a;"></div></div>
        <div class="debt-hint">${p.pagadas} de ${p.total} cuotas pagadas · ${progreso}%</div>     
        </div>`;
  });
  el.innerHTML = html;
}

/* ── RENDER METAS ── */
function renderMetas(metas) {
  const el = document.getElementById('savingGoals');
  if (metas.length === 0) {
    el.innerHTML = '<div class="empty-state">🎯 Sin metas aún.<br>Pulsa el botón <strong>+</strong> para crear tu primer objetivo de ahorro.</div>';
    return;
  }

  let html = '';
  metas.forEach((m, i) => {
    const colors = COLORES_METAS[i % COLORES_METAS.length];
    const progreso = m.objetivo > 0 ? Math.round((m.actual / m.objetivo) * 100) : 0;
    html += `
      <div class="saving-goal">
        <div class="saving-icon" style="background:${colors.bg};">${m.icono}</div>
        <div class="saving-info">
          <div class="saving-name">${m.nombre}</div>
          <div class="saving-pct">${progreso}% completado</div>
          <div class="saving-bar-bg"><div class="saving-bar" style="width:${progreso}%; background:${colors.fill};"></div></div>
          <div class="saving-amounts">
            <span>S/ ${parseFloat(m.actual||0).toLocaleString()}</span>
            <span>S/ ${parseFloat(m.objetivo||0).toLocaleString()}</span>
          </div>
        </div>
        <button class="saving-delete" onclick="eliminarMeta('${m.id}')">✕</button>
      </div>`;
  });
  el.innerHTML = html;
}

/* ══════════════════════
   ACCIONES
══════════════════════ */
/* ── MODAL GASTO: poblar tarjetas y toggle selector ── */
async function openGastoModal() {
  // ── Limpiar todos los campos del formulario ──
  document.getElementById('g-desc').value  = '';
  document.getElementById('g-monto').value = '';
  document.getElementById('g-fecha').value = new Date().toISOString().split('T')[0];

  // --- LÓGICA DE IDENTIDAD POR DEFECTO ---
  const miTipo = localStorage.getItem('miUsuarioTipo'); // Esto devuelve 'yo' o 'pareja'
  const selectQuien = document.getElementById('g-quien');

  if (miTipo && selectQuien) {
    selectQuien.value = miTipo; 
    // Esto marcará automáticamente a Christian (si es su cel) o Sydney (si es el suyo).
    // Como es un <select> estándar, el usuario puede hacer clic y cambiarlo a 
    // la otra persona o a "Ambos" en cualquier momento.
  }

  // Deseleccionar categoría (chips)
  document.querySelectorAll('#cat-chips .chip').forEach(c => c.classList.remove('selected'));

  // Cerrar y limpiar panel del voucher
  const voucherPanel = document.getElementById('voucher-panel');
  if (voucherPanel) voucherPanel.style.display = 'none';
  const voucherArrow = document.getElementById('voucher-arrow');
  if (voucherArrow) voucherArrow.style.transform = 'rotate(0deg)';
  const voucherToggle = document.getElementById('voucher-toggle');
  if (voucherToggle) voucherToggle.classList.remove('voucher-toggle-active');
  limpiarVoucher();

  // Resetear medio de pago
  const medioEl = document.getElementById('g-medio');
  if (medioEl) medioEl.value = 'efectivo';
  toggleSelectorTarjeta();

  // Cargar tarjetas frescas desde Firebase
  tarjetasCacheGasto = await DB.getTarjetas();
  const select = document.getElementById('g-tarjeta-id');
  if (!select) { openModal('gastoModal'); return; }

  // Solo tarjetas con crédito disponible (límite > deuda)
  const conCredito = tarjetasCacheGasto.filter(t => {
    const disponible = (parseFloat(t.limite) || 0) - (parseFloat(t.deuda) || 0);
    return disponible > 0;
  });

  if (conCredito.length === 0) {
    select.innerHTML = '<option value="">— Sin tarjetas con crédito disponible —</option>';
  } else {
    select.innerHTML = conCredito.map(t => {
      const disponible = (parseFloat(t.limite) || 0) - (parseFloat(t.deuda) || 0);
      return `<option value="${t.id}" data-disponible="${disponible}">
        ${t.nombre} · S/ ${disponible.toLocaleString()} disponible
      </option>`;
    }).join('');
    // Mostrar info de la primera tarjeta seleccionada
    actualizarInfoTarjeta();
  }

  openModal('gastoModal');
}

function toggleSelectorTarjeta() {
  const medio = document.getElementById('g-medio')?.value;
  const rowTarjeta = document.getElementById('row-tarjeta-selector');
  if (!rowTarjeta) return;
  rowTarjeta.style.display = medio === 'tarjeta' ? 'block' : 'none';
  if (medio === 'tarjeta') actualizarInfoTarjeta();
}

function actualizarInfoTarjeta() {
  const select = document.getElementById('g-tarjeta-id');
  const infoEl = document.getElementById('g-tarjeta-credito-info');
  if (!select || !infoEl) return;
  const opt = select.options[select.selectedIndex];
  const disponible = parseFloat(opt?.dataset?.disponible) || 0;
  infoEl.textContent = disponible > 0
    ? `✓ Crédito disponible: S/ ${disponible.toLocaleString()}`
    : '';
}



/* ══════════════════════════════════════════
   VOUCHER SCANNER — MINDEE (UX FINAL)
   ══════════════════════════════════════════ */

// 1. Asegúrate de poner tu API Key aquí
async function procesarVoucher(input) {
  const file = input.files[0];
  if (!file) return;

  // 1. Configuración (Usa tus datos reales)
  const API_KEY = "md_MCh1IkQlapcWkCtPfw925EgpxtD9EVwsyNrt4uv4CKc"; // Tu clave que empieza con md_
  const MODEL_ID = "4b676248-f73d-411e-a480-a11a6b993ac0"; 
  
  mostrarToast("Subiendo voucher a la nube... ☁️");

  const form = new FormData();
  form.append("model_id", MODEL_ID);
  form.append("file", file, file.name); // Enviamos el archivo real

  try {
    // PASO 1: Enviar el archivo (Enqueue)
    const enqueueRes = await fetch("https://api-v2.mindee.net/v2/products/extraction/enqueue", {
      method: "POST",
      headers: { "Authorization": API_KEY },
      body: form,
    });

    if (!enqueueRes.ok) {
      const err = await enqueueRes.json();
      throw new Error(err.api_request?.error?.message || "Error al subir");
    }

    const enqueueJson = await enqueueRes.json();
    const pollingUrl = enqueueJson.job.polling_url;

    mostrarToast("IA analizando el ticket... 🧠");

    // PASO 2: Esperar el resultado (Polling)
    let intentos = 0;
    while (intentos < 15) { // Límite de 30 segundos aprox
      const pollRes = await fetch(`${pollingUrl}?redirect=false`, {
        headers: { "Authorization": API_KEY },
      });
      
      const pollJson = await pollRes.json();
      const job = pollJson.job;

      if (job.status === "Failed") throw new Error("El procesamiento falló en la nube.");
      
      if (job.status === "Processed" && job.result_url) {
        // PASO 3: Obtener el resultado final
        const resultRes = await fetch(job.result_url, {
          headers: { "Authorization": API_KEY },
        });
        const result = await resultRes.json();

        // Extraer campos (ajustado a la estructura de campos de la v2)
        const fields = result.inference.result.fields;
        
        // Asignamos a tus inputs (Mindee v2 suele devolver .content o .value)
        const monto    = fields.total_amount?.content  || fields.total_amount?.value  || "";
        const comercio  = fields.supplier_name?.content || fields.supplier_name?.value || "Voucher Escaneado";
        const fechaRaw  = fields.date?.content || fields.date?.value || fields.purchase_date?.content || "";

        document.getElementById('g-monto').value = monto;
        document.getElementById('g-desc').value  = comercio;

        // Asignar fecha del recibo si Mindee la detectó, si no dejar la de hoy
        if (fechaRaw) {
          // Mindee devuelve formato ISO YYYY-MM-DD o DD/MM/YYYY
          let fechaISO = fechaRaw;
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaRaw)) {
            const [d, m, y] = fechaRaw.split('/');
            fechaISO = y + '-' + m + '-' + d;
          }
          document.getElementById('g-fecha').value = fechaISO;
        }

        mostrarToast("¡Escaneo exitoso! ✅");
        return; 
      }

      // Esperar 2 segundos antes de volver a preguntar
      await new Promise((r) => setTimeout(r, 2000));
      intentos++;
    }

    throw new Error("Tiempo de espera agotado.");

  } catch (error) {
    console.error("Error en Mindee v2:", error);
    mostrarToast("Error: " + error.message + " ❌");
  } finally {
    input.value = ""; 
  }
}

function mapearCategoriaMindee(categoriaMindee) {
  const c = categoriaMindee.toLowerCase();

  if (c.includes('restaurant') || c.includes('grocery') || c.includes('food'))
    return 'Alimentación';

  if (c.includes('transport') || c.includes('fuel'))
    return 'Transporte';

  if (c.includes('health') || c.includes('pharmacy'))
    return 'Salud';

  if (c.includes('utility') || c.includes('electric') || c.includes('water'))
    return 'Servicios';

  if (c.includes('entertain'))
    return 'Entret.';

  if (c.includes('home'))
    return 'Hogar';

  return 'Otros';
}



function mostrarBannerAutofill(datos) {
  // Eliminar banner anterior si existe
  document.getElementById('voucher-autofill-banner')?.remove();

  const campos = [];
  if (datos.desc)   campos.push('descripción');
  if (datos.monto)  campos.push('monto');
  if (datos.fecha)  campos.push('fecha');
  if (datos.categoria) campos.push('categoría');

  if (campos.length === 0) return;

  const banner = document.createElement('div');
  banner.id = 'voucher-autofill-banner';
  banner.className = 'voucher-autofill-banner';
  banner.innerHTML = `✨ <span>Datos detectados: <b>${campos.join(', ')}</b>. Revisa y ajusta si es necesario.</span>`;

  const voucherArea = document.getElementById('voucher-area');
  voucherArea.insertAdjacentElement('afterend', banner);
}

function toggleVoucherPanel() {
  const panel = document.getElementById('voucher-panel');
  const arrow = document.getElementById('voucher-arrow');
  const btn   = document.getElementById('voucher-toggle');
  const open  = panel.style.display === 'none' || panel.style.display === '';
  panel.style.display = open ? 'block' : 'none';
  if (arrow) arrow.style.transform = open ? 'rotate(90deg)' : 'rotate(0deg)';
  btn.classList.toggle('voucher-toggle-active', open);
  if (!open) limpiarVoucher(); // limpiar al cerrar
}

function limpiarVoucher() {
  document.getElementById('voucher-input').value = '';
  document.getElementById('voucher-preview').style.display = 'none';
  document.getElementById('voucher-loading').style.display = 'none';
  document.querySelector('.voucher-btn').style.display = 'flex';
  document.getElementById('voucher-autofill-banner')?.remove();
}

async function agregarGasto() {
  const desc  = document.getElementById('g-desc').value.trim();
  const monto = parseFloat(document.getElementById('g-monto').value);
  const quien = document.getElementById('g-quien').value;
  const fecha = document.getElementById('g-fecha').value;
  const catEl = document.querySelector('#cat-chips .chip.selected');
  const medio = document.getElementById('g-medio')?.value || 'efectivo';

  if (!desc || isNaN(monto) || monto <= 0 || !fecha) {
    alert('Por favor completa descripción, monto y fecha');
    return;
  }

  // Validar tarjeta si el pago es con crédito
  let tarjetaSeleccionada = null;
  if (medio === 'tarjeta') {
    const tarjetaId = document.getElementById('g-tarjeta-id')?.value;
    if (!tarjetaId) {
      alert('Selecciona una tarjeta de crédito');
      return;
    }
    tarjetaSeleccionada = tarjetasCacheGasto.find(t => t.id === tarjetaId);
    if (!tarjetaSeleccionada) {
      alert('Tarjeta no encontrada');
      return;
    }
    const disponible = (parseFloat(tarjetaSeleccionada.limite) || 0) - (parseFloat(tarjetaSeleccionada.deuda) || 0);
    if (monto > disponible) {
      alert(`La tarjeta ${tarjetaSeleccionada.nombre} solo tiene S/ ${disponible.toLocaleString()} disponible.\nNo puedes registrar S/ ${monto.toLocaleString()}.`);
      return;
    }
  }

  const cat   = Object.keys(CATS).find(c => catEl && catEl.textContent.includes(c)) || 'Otros';
  const icono = CATS[cat] ? CATS[cat].icon : '📦';

  const nuevoGasto = await DB.addGasto({
    desc,
    monto,
    quien,
    cat,
    icono,
    fecha,
    medio,
    tarjetaId:     tarjetaSeleccionada?.id     || null,
    tarjetaNombre: tarjetaSeleccionada?.nombre || null,
    creadoEn: new Date().toISOString(), // timestamp preciso para ordenar
  });

  const esRecurrente = document.getElementById('checkRecurrente')?.checked;
  if (esRecurrente && nuevoGasto) {
  await DB.addRecurrente({ ...nuevoGasto, fecha: nuevoGasto.fecha });
}

  // Si se usó tarjeta, aumentar la deuda de esa tarjeta en Firebase
  if (nuevoGasto && tarjetaSeleccionada) {
    const nuevaDeuda = (parseFloat(tarjetaSeleccionada.deuda) || 0) + monto;
    try {
      await db.collection("hogares").doc(hogarId)
        .collection("tarjetas")
        .doc(tarjetaSeleccionada.id)
        .update({ deuda: nuevaDeuda });
    } catch(e) {
      console.error("Error actualizando deuda de tarjeta:", e);
    }
  }

  if (nuevoGasto) {
    closeModal('gastoModal');
    limpiarVoucher();
    showToast(
      tarjetaSeleccionada
        ? `Gasto con ${tarjetaSeleccionada.nombre} registrado ✓`
        : 'Gasto agregado correctamente ✓'
    );
    document.getElementById('g-desc').value = '';
    document.getElementById('g-monto').value = '';
    renderTodo();
    document.querySelectorAll('#cat-chips .chip').forEach(c => c.classList.remove('selected'));
    document.querySelector('#cat-chips .chip:first-child').classList.add('selected'); // Opcional: marca la primera por defecto
  }
}

/* Tarjetas */
async function agregarTarjeta() {
  const nombre = document.getElementById('t-nombre').value.trim();
  const deuda = parseFloat(document.getElementById('t-deuda').value) || 0;
  const limite = parseFloat(document.getElementById('t-limite').value) || 0;
  const cuotaMin = parseFloat(document.getElementById('t-cuota').value) || 0;
  const vence = document.getElementById('t-vence').value || '';
  const quien = document.getElementById('t-quien').value;

  if (!nombre) {
    alert('Escribe el nombre de la tarjeta');
    return;
  }

  await DB.addTarjeta({ nombre, deuda, limite, cuotaMin, vence, quien });
  closeModal('tarjetaModal');
  // Limpiar campos
  document.getElementById('t-nombre').value = '';
  document.getElementById('t-deuda').value = '';
  document.getElementById('t-limite').value = '';
  document.getElementById('t-cuota').value = '';
  document.getElementById('t-vence').value = '';
  renderTodo();
}

/* Préstamos */
async function agregarPrestamo() {
  const nombre = document.getElementById('p-nombre').value.trim();
  const saldo = parseFloat(document.getElementById('p-saldo').value) || 0;
  const cuota = parseFloat(document.getElementById('p-cuota').value) || 0;
  const pagadas = parseInt(document.getElementById('p-pagadas').value) || 0;
  const total = parseInt(document.getElementById('p-total').value) || 0;
  const quien = document.getElementById('p-quien').value;

  if (!nombre) {
    alert('Escribe el nombre del préstamo');
    return;
  }

  await DB.addPrestamo({ nombre, saldo, cuota, pagadas, total, quien });
  closeModal('prestamoModal');
  // Limpiar campos
  document.getElementById('p-nombre').value = '';
  document.getElementById('p-saldo').value = '';
  document.getElementById('p-cuota').value = '';
  document.getElementById('p-pagadas').value = '';
  document.getElementById('p-total').value = '';
  renderTodo();
}

/* Metas */
async function agregarMeta() {
  const nombre = document.getElementById('m-nombre').value.trim();
  const objetivo = parseFloat(document.getElementById('m-objetivo').value) || 0;
  const actual = parseFloat(document.getElementById('m-actual').value) || 0;
  const icono = document.querySelector('#icon-chips .chip.selected')?.textContent.trim() || '🎯';

  if (!nombre || objetivo <= 0) {
    alert('Completa nombre y monto objetivo');
    return;
  }

  await DB.addMeta({ nombre, objetivo, actual, icono });
  closeModal('metaModal');
  // Limpiar campos
  document.getElementById('m-nombre').value = '';
  document.getElementById('m-objetivo').value = '';
  document.getElementById('m-actual').value = '';
  renderTodo();
}

/* Eliminar */
/* ══════════════════════════════════════════
   MODAL DE CONFIRMACIÓN PERSONALIZADO
   ══════════════════════════════════════════ */
function showConfirm({ icon = '🗑️', title = '¿Eliminar?', msg = 'Esta acción no se puede deshacer.', labelOk = 'Eliminar', danger = true, onOk }) {
  document.getElementById('confirm-icon').textContent  = icon;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent   = msg;
  const btnOk = document.getElementById('confirm-btn-ok');
  btnOk.textContent = labelOk;
  btnOk.className = danger ? 'confirm-btn-ok confirm-btn-danger' : 'confirm-btn-ok confirm-btn-primary';
  btnOk.onclick = () => { closeConfirmModal(); onOk(); };
  document.getElementById('modalConfirm').classList.add('open');
}

function closeConfirmModal() {
  document.getElementById('modalConfirm').classList.remove('open');
}

function eliminarGasto(id) {
  showConfirm({
    icon: '🗑️',
    title: '¿Eliminar gasto?',
    msg: 'El gasto será eliminado permanentemente.',
    labelOk: 'Sí, eliminar',
    danger: true,
    onOk: () => {
      // Animación de salida antes de eliminar del DOM
      const el = document.querySelector(`.expense-item[data-id="${id}"]`);
      if (el) {
        el.style.transition = 'opacity 0.2s ease, transform 0.2s ease, max-height 0.3s ease 0.1s, margin 0.3s ease 0.1s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(-20px)';
        el.style.maxHeight = el.offsetHeight + 'px';
        el.style.overflow = 'hidden';
        requestAnimationFrame(() => {
          el.style.maxHeight = '0';
          el.style.marginBottom = '0';
          el.style.paddingTop = '0';
          el.style.paddingBottom = '0';
        });
        setTimeout(() => el.remove(), 400);
      }

      DB.deleteGasto(id);
      gastosDelMesCache = gastosDelMesCache.filter(g => g.id !== id);

      const listaFull = document.getElementById('listaCompletaGastos');
      const modalHistorialOpen = document.getElementById('modalHistorial')?.classList.contains('open');

      if (listaFull && modalHistorialOpen) {
        const query = document.getElementById('historial-search')?.value || '';
        if (query.trim()) {
          filtrarHistorial(query); // filtrarHistorial ya llama initGesturesModal
        } else {
          listaFull.innerHTML = gastosDelMesCache.map(g => generarGastoHTML(g, configCache)).join('');
          setTimeout(initGesturesModal, 50); // Re-registrar gestos tras re-render
        }
      }

      // Delay para que la animación termine antes de re-renderizar la vista principal
      setTimeout(() => renderTodo(), 450);
    }
  });
}
function eliminarTarjeta(id) {
  showConfirm({
    icon: '💳',
    title: '¿Eliminar tarjeta?',
    msg: 'Se eliminará la tarjeta y su historial de pagos.',
    labelOk: 'Sí, eliminar',
    danger: true,
    onOk: () => { DB.deleteTarjeta(id); renderTodo(); }
  });
}
function eliminarPrestamo(id) {
  showConfirm({
    icon: '🏦',
    title: '¿Eliminar préstamo?',
    msg: 'Se eliminará el préstamo y su historial.',
    labelOk: 'Sí, eliminar',
    danger: true,
    onOk: () => { DB.deletePrestamo(id); renderTodo(); }
  });
}
function eliminarMeta(id) {
  showConfirm({
    icon: '🎯',
    title: '¿Eliminar meta?',
    msg: 'Se eliminará esta meta de ahorro.',
    labelOk: 'Sí, eliminar',
    danger: true,
    onOk: () => { DB.deleteMeta(id); renderTodo(); }
  });
}

/* ==================== MODALES Y UTILIDADES ==================== */

// ── MODAL CON SCROLL LOCK SIN FLICKER ──
let _modalCount = 0;
let _bodyScrollY = 0;
let _wasModalOpen = false;

// Asegúrate de que openModal y closeModal manejen el FAB con display
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  const fab = document.getElementById('fab-global');
  if (fab) fab.style.display = 'none';

  _modalCount++;
  if (_modalCount === 1) {
    // Guardamos la posición de scroll actual (aunque no la usaremos para restaurar, solo informativo)
    _bodyScrollY = window.scrollY;
    // Bloqueamos el scroll del body
    document.body.classList.add('modal-open');
    // Prevenimos que el overlay permita scroll al fondo
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
  }

  const fab = document.getElementById('fab-global');
  if (fab && activeTab !== 'resumen') {
    fab.style.display = 'flex';
  }

  _modalCount = Math.max(0, _modalCount - 1);
  if (_modalCount === 0) {
    document.body.classList.remove('modal-open');
    // No necesitamos hacer scrollTo porque el body nunca se movió
  }
}

// Función auxiliar para bloquear el scroll de fondo
function preventBackgroundScroll(e) {
  e.preventDefault();
}

function closeModalOutside(e, id) { 
  if (e.target.id === id) closeModal(id); 
}

function selectChip(el, groupId) {
  document.getElementById(groupId).querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ==================== TOAST MEJORADO (versión más robusta) ====================
let toastTimeout = null;

function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    console.warn("Toast no encontrado, reintentando...");
    setTimeout(() => showToast(message, type), 100);
    return;
  }

  const toastMessage = document.getElementById('toast-message');
  if (!toastMessage) return;

  if (toastTimeout) clearTimeout(toastTimeout);

  // Limpiar clases anteriores
  toast.className = 'toast';
  if (type === 'success') toast.classList.add('success');
  if (type === 'info') toast.classList.add('info');
  if (type === 'warning') toast.classList.add('warning');

  // Contenido con icono
  const icono = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  toastMessage.innerHTML = `<span class="toast-icon">${icono}</span> ${message}`;

  // Mostrar con animación
  toast.style.display = 'block';
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast && !toast.classList.contains('show')) {
        toast.style.display = 'none';
      }
    }, 400);
  }, 4000);
}

function hideToast() {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.classList.remove('show');
    toast.style.display = 'none';
  }
}

// Variables globales para el modal de pago
let tarjetaActualId = null;
let tarjetaActualNombre = '';
let tarjetaDeudaMax = 0;

function abrirPagoTarjeta(id, nombre, deudaActual) {
  tarjetaActualId = id;
  tarjetaActualNombre = nombre;
  tarjetaDeudaMax = parseFloat(deudaActual) || 0;

  document.getElementById('pago-tarjeta-info').innerHTML = `
    <strong>${nombre}</strong><br>
    <small>Deuda actual: <b>S/ ${tarjetaDeudaMax.toLocaleString()}</b></small>
  `;

  const inputMonto = document.getElementById('pago-monto');
  inputMonto.value = '';
  inputMonto.max = tarjetaDeudaMax;
  inputMonto.placeholder = `Máx. S/ ${tarjetaDeudaMax.toLocaleString()}`;

  document.getElementById('pago-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('pago-nota').value = '';

  openModal('pagoTarjetaModal');
}


async function registrarPagoTarjeta() {
  const monto = parseFloat(document.getElementById('pago-monto').value);
  const fecha = document.getElementById('pago-fecha').value;
  const nota = document.getElementById('pago-nota').value.trim();

  if (!monto || monto <= 0) {
    alert('Ingresa un monto válido');
    return;
  }

  if (monto > tarjetaDeudaMax) {
    alert(`El monto no puede superar la deuda actual de S/ ${tarjetaDeudaMax.toLocaleString()}`);
    return;
  }

  if (!tarjetaActualId) return;

  try {
    // 1. Registrar el pago como gasto
    await DB.addGasto({
      desc: `Pago Tarjeta: ${tarjetaActualNombre} ${nota ? '- ' + nota : ''}`,
      monto: monto,
      quien: 'yo',
      cat: 'Otros',
      icono: '💳',
      fecha: fecha,
      creadoEn: new Date().toISOString(),
    });

    // 2. Reducir la deuda de la tarjeta
    const tarjetas = await DB.getTarjetas();
    const tarjeta = tarjetas.find(t => t.id === tarjetaActualId);

    if (tarjeta) {
      const nuevaDeuda = Math.max(0, parseFloat(tarjeta.deuda) - monto);
      
      await db.collection("hogares").doc(hogarId)
        .collection("tarjetas")
        .doc(tarjetaActualId)
        .update({ deuda: nuevaDeuda });

      console.log(`Deuda reducida: ${tarjeta.deuda} → ${nuevaDeuda}`);
    }

    await DB.enviarNotificacion(`Se pagó S/ ${monto} de la tarjeta ${tarjetaActualNombre}`);
    // Cerrar el modal primero
    closeModal('pagoTarjetaModal');

    // ✅ Mostrar el toast después (ya sin el overlay encima)
    showToast('Pago de tarjeta registrado exitosamente ✓');

    // Actualizar la pantalla
    renderTodo();
    const cfg = configCache || await DB.getConfig();
    await notificarAlOtro(`${cfg.nombreYo} pagó S/ ${monto} de la tarjeta ${tarjetaActualNombre}`);

  } catch (e) {
    console.error("Error al registrar pago:", e);
    alert("Error al procesar el pago. Inténtalo nuevamente.");
  }
}

// Variables temporales para pago de préstamo
let prestamoActualId = null;
let prestamoActualNombre = '';
let prestamoSaldoMax = 0;
let cuotaMensual = 0;

function abrirPagoPrestamo(id, nombre, saldoActual, cuota) {
  prestamoActualId = id;
  prestamoActualNombre = nombre;
  prestamoSaldoMax = parseFloat(saldoActual) || 0;
  cuotaMensual = parseFloat(cuota) || 0;

  document.getElementById('pago-prestamo-info').innerHTML = `
    <strong>${nombre}</strong><br>
    <small>Deuda Total: <b>S/ ${prestamoSaldoMax.toLocaleString()}</b><br>
    Cuota mensual: S/ ${parseFloat(cuota).toLocaleString()}</small>
  `;

  const inputMonto = document.getElementById('prestamo-pago-monto');
  inputMonto.max = prestamoSaldoMax;
  inputMonto.value = Math.min(parseFloat(cuota) || 0, prestamoSaldoMax);
  inputMonto.placeholder = `Máx. S/ ${prestamoSaldoMax.toLocaleString()}`;

  document.getElementById('prestamo-pago-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('prestamo-pago-nota').value = '';

  openModal('pagoPrestamoModal');
}

async function abrirSelectorPago() {
  const [tarjetas, prestamos, cfg] = await Promise.all([
    DB.getTarjetas(),
    DB.getPrestamos(),
    DB.getConfig()
  ]);
  
  const nombreYo = cfg?.nombreYo || 'Christian';
  const nombreElla = cfg?.nombreElla || 'Sydney';
  
  const contenedor = document.getElementById('lista-deudas-pago');
  let html = '';
  
  // Tarjetas
  tarjetas.forEach(t => {
    const deuda = parseFloat(t.deuda) || 0;
    if (deuda <= 0) return; // solo mostrar si hay deuda pendiente
    html += `
      <div class="debt-card">
        <div class="debt-type">TARJETA · ${t.quien === 'yo' ? nombreYo.toUpperCase() : t.quien === 'pareja' ? nombreElla.toUpperCase() : 'COMPARTIDA'}</div>
        <div class="debt-name">${t.nombre}</div>
        <div class="debt-total">S/ ${deuda.toLocaleString()}</div>
        <button class="debt-pay-btn" onclick="closeModal('selectorPagoModal'); abrirPagoTarjeta('${t.id}', '${t.nombre}', ${deuda})">
          + Pagar esta tarjeta
        </button>
      </div>`;
  });
  
  // Préstamos
  prestamos.forEach(p => {
    const saldo = parseFloat(p.saldo) || 0;
    if (saldo <= 0) return;
    html += `
      <div class="debt-card">
        <div class="debt-type">PRÉSTAMO · ${p.quien === 'yo' ? nombreYo.toUpperCase() : p.quien === 'pareja' ? nombreElla.toUpperCase() : 'COMPARTIDO'}</div>
        <div class="debt-name">${p.nombre}</div>
        <div class="debt-total">S/ ${saldo.toLocaleString()}</div>
        <button class="debt-pay-btn" onclick="closeModal('selectorPagoModal'); abrirPagoPrestamo('${p.id}', '${p.nombre}', ${saldo}, ${parseFloat(p.cuota)||0})">
          + Pagar este préstamo
        </button>
      </div>`;
  });
  
  if (html === '') {
    html = '<div class="empty-state" style="grid-column:1/-1;">No hay deudas pendientes 😎</div>';
  }
  
  contenedor.innerHTML = html;
  openModal('selectorPagoModal');
}

async function registrarPagoPrestamo() {
  const monto = parseFloat(document.getElementById('prestamo-pago-monto').value);
  const fecha = document.getElementById('prestamo-pago-fecha').value;
  const nota = document.getElementById('prestamo-pago-nota').value.trim();

  if (!monto || monto <= 0) {
    alert('Ingresa un monto válido');
    return;
  }

  if (monto > prestamoSaldoMax) {
    alert(`El monto no puede superar el saldo actual de S/ ${prestamoSaldoMax.toLocaleString()}`);
    return;
  }

  if (!prestamoActualId) return;

  try {
    // 1. Registrar el pago como gasto
    await DB.addGasto({
      desc: `Pago Préstamo: ${prestamoActualNombre} ${nota ? '- ' + nota : ''}`,
      monto: monto,
      quien: 'yo',
      cat: 'Otros',
      icono: '🏦',
      fecha: fecha,
      creadoEn: new Date().toISOString(),
    });

    // 2. Actualizar el préstamo
    const prestamos = await DB.getPrestamos();
    const prestamo = prestamos.find(p => p.id === prestamoActualId);

    if (prestamo) {
      const nuevoSaldo = Math.max(0, parseFloat(prestamo.saldo) - monto);
      const nuevasPagadas = parseInt(prestamo.pagadas) + 1;

      await db.collection("hogares").doc(hogarId)
        .collection("prestamos")
        .doc(prestamoActualId)
        .update({
          saldo: nuevoSaldo,
          pagadas: nuevasPagadas
        });
    }

    // Cerrar modal primero
    closeModal('pagoPrestamoModal');

    // Mostrar toast después (ya sin el overlay encima)
    showToast('Pago de préstamo registrado exitosamente ✓');

    // Actualizar la interfaz
    renderTodo();
    const cfg = configCache || await DB.getConfig();
    await notificarAlOtro(`${cfg.nombreYo} pagó S/ ${monto} del préstamo ${prestamoActualNombre}`);

  } catch (e) {
    console.error("Error al registrar pago de préstamo:", e);
    alert("Error al procesar el pago. Inténtalo nuevamente.");
  }
}

function confirmarReset() {
  if (confirm("¿Estás seguro de borrar TODOS los datos del hogar?\nEsta acción no se puede deshacer.")) {
    if (confirm("¡Última confirmación! ¿Realmente quieres eliminar todo?")) {
      DB.resetAll();
      location.reload();
    }
  }
}

console.log("✅ app.js cargado correctamente con Tarjetas, Préstamos y Metas");


/* ══════════════════════════════════════════
   PRESUPUESTO DEL MES
   ══════════════════════════════════════════ */
function renderPresupuesto(gastos, cfg, tarjetas, prestamos, ingresoTotal, ahorro) {
  const el = document.getElementById('presupuesto-list');
  if (!el) return;

  if (ingresoTotal === 0 && gastos.length === 0) {
    el.innerHTML = '<div class="empty-state">Agrega gastos para ver el presupuesto</div>';
    return;
  }

  // ── Calcular reales ──
  const gastoHogar    = gastos.filter(g => ['Hogar','Servicios'].includes(g.cat)).reduce((s,g)=>s+(g.monto||0), 0);
  const gastoEntret   = gastos.filter(g => g.cat === 'Entret.').reduce((s,g)=>s+(g.monto||0), 0);
  const deudaTarjetas = tarjetas.reduce((s,t)=>s+(parseFloat(t.deuda)||0), 0);
  const limiteTarjetas= tarjetas.reduce((s,t)=>s+(parseFloat(t.limite)||0), 0);
  const cuotasPrest   = prestamos.reduce((s,p)=>s+(parseFloat(p.cuota)||0), 0);
  const ahorroReal    = Math.max(0, ahorro);

  // ── Límites (de config o calculados) ──
  const limHogar   = parseFloat(cfg.presupHogar)   || Math.max(gastoHogar,   ingresoTotal * 0.40);
  const limTarjeta = limiteTarjetas > 0 ? limiteTarjetas : Math.max(deudaTarjetas, 1);
  const limEntret  = parseFloat(cfg.presupEntret)  || Math.max(gastoEntret,  ingresoTotal * 0.10);
  const limPrest   = cuotasPrest > 0 ? cuotasPrest : 1;
  const limAhorro  = parseFloat(cfg.metaAhorro)    || Math.max(ahorroReal,   ingresoTotal * 0.20);

  // ── Función para generar cada fila ──
  function filaPresupuesto(label, real, limite, colorOk, colorMid, colorMal, esAhorro = false) {
    const pct     = limite > 0 ? Math.min(100, Math.round(real / limite * 100)) : 0;

    // Para ahorro: buen color si real >= limite (cumplió meta), malo si no llegó
    // Para gastos/deudas: buen color si real < limite, malo si excede
    let barColor;
    if (esAhorro) {
      barColor = real >= limite ? colorOk : (pct >= 60 ? colorMid : colorMal);
    } else {
      barColor = pct >= 100 ? colorMal : (pct >= 75 ? colorMid : colorOk);
    }

    const prefijo = esAhorro ? 'Ahorrado' : 'Gastado';

    return `
      <div class="presup-fila">
        <div class="presup-header">
          <span class="presup-label">${label}</span>
          <span class="presup-montos">${prefijo} S/ ${Math.round(real).toLocaleString()} / Presupuesto S/ ${Math.round(limite).toLocaleString()}</span>
        </div>
        <div class="presup-bar-bg">
          <div class="presup-bar-fill" style="width:${pct}%; background:${barColor};"></div>
        </div>
      </div>`;
  }

  el.innerHTML =
    filaPresupuesto('Gastos fijos del hogar',    gastoHogar,    limHogar,    '#c43030', '#e8850a', '#c43030') +
    filaPresupuesto('Tarjetas de crédito',        deudaTarjetas, limTarjeta,  '#e8850a', '#e8850a', '#c43030') +
    filaPresupuesto('Entretenimiento y salidas',  gastoEntret,   limEntret,   '#2a7de1', '#e8850a', '#c43030') +
    filaPresupuesto('Cuotas de préstamos',        cuotasPrest,   limPrest,    '#c43030', '#c43030', '#c43030') +
    filaPresupuesto('Ahorro mensual',             ahorroReal,    limAhorro,   '#2d6a2d', '#4a9a4a', '#888780', true);
}

/* ══════════════════════════════════════════
   DISTRIBUCIÓN DEL INGRESO
   ══════════════════════════════════════════ */
function renderDistribucion(ingresos, gastoTotal, gastoEntret, ahorro) {
  const el = document.getElementById('distribucion-content');
  if (!el) return;

  if (ingresos === 0) {
    el.innerHTML = '<div class="empty-state">Configura tus ingresos y gastos para ver la distribución</div>';
    return;
  }

  // Gastos fijos = todos los gastos que no son entretenimiento
  const gastosFijos = gastoTotal - gastoEntret;
  const extras      = gastoEntret;
  const ahorroReal  = Math.max(0, ahorro);

  function fila(label, monto, color) {
    const pct = ingresos > 0 ? Math.min(100, Math.round(monto / ingresos * 100)) : 0;
    return `
      <div class="dist-fila">
        <div class="dist-header">
          <span class="dist-label">${label}</span>
          <span class="dist-montos">S/ ${Math.round(monto).toLocaleString()} · ${pct}%</span>
        </div>
        <div class="dist-bar-bg">
          <div class="dist-bar-fill" style="width:${pct}%; background:${color};"></div>
        </div>
      </div>`;
  }

  el.innerHTML =
    fila('Gastos fijos y deudas',    gastosFijos, '#2a7de1') +
    fila('Entretenimiento y extras', extras,      '#b06a10') +
    fila('Ahorro',                   ahorroReal,  '#2d6a2d');
}

/* ══════════════════════════════════════════
   ALERTAS INTELIGENTES
   ══════════════════════════════════════════ */
function renderAlertas(tarjetas, prestamos, gastoTotal, ingresos) {
  renderAlertasResumen(tarjetas, prestamos, gastoTotal, ingresos);
  renderAlertasDeuda(tarjetas, prestamos);
}

function renderAlertasResumen(tarjetas, prestamos, gastoTotal, ingresos) {
  const el = document.getElementById('alertas-resumen');
  if (!el) return;

  const alertas = [];
  const hoy = new Date();
  const diaHoy = hoy.getDate();

  // Alerta: tarjetas al límite
  const usoMax = tarjetas.reduce((max, t) => {
    const limite = parseFloat(t.limite) || 0;
    const deuda  = parseFloat(t.deuda)  || 0;
    if (limite === 0) return max;
    return Math.max(max, deuda / limite);
  }, 0);
  if (usoMax >= 1.0) {
    alertas.push({ tipo: 'danger', msg: `⛔ Las tarjetas de crédito están al 100% del límite. No puedes hacer más cargos hasta pagar.` });
  } else if (usoMax >= 0.9) {
    alertas.push({ tipo: 'warning', msg: `Las tarjetas de crédito están al ${Math.round(usoMax*100)}% del límite este mes. Considera reducir gastos variables.` });
  } else if (usoMax >= 0.7) {
    alertas.push({ tipo: 'info', msg: `Las tarjetas de crédito llevan un ${Math.round(usoMax*100)}% de uso. Estás dentro del rango, pero monitorea.` });
  }

  // Alerta: gasto total supera 80% del ingreso
  if (ingresos > 0 && gastoTotal / ingresos > 0.8) {
    alertas.push({ tipo: 'warning', msg: `Este mes ya gastaste el ${Math.round(gastoTotal/ingresos*100)}% de tus ingresos. Quedan S/ ${Math.round(ingresos-gastoTotal).toLocaleString()} disponibles.` });
  }

  // Alerta: próximas fechas de pago de tarjetas (dentro de 5 días)
  tarjetas.forEach(t => {
    const diaPago = parseInt(t.diaCierre) || parseInt(t.vence) || 0;
    if (!diaPago) return;
    const diasFaltan = diaPago >= diaHoy ? diaPago - diaHoy : (30 - diaHoy + diaPago);
    if (diasFaltan <= 5 && diasFaltan >= 0) {
      const deuda = parseFloat(t.deuda) || 0;
      if (deuda > 0)
        alertas.push({ tipo: 'info', msg: `Fecha de pago de ${t.nombre} en ${diasFaltan === 0 ? 'hoy' : diasFaltan + (diasFaltan === 1 ? ' día' : ' días')}. Deuda actual: S/ ${deuda.toLocaleString()}.` });
    }
  });

  // Alerta: préstamos con cuota alta respecto al ingreso
  prestamos.forEach(p => {
    const cuota  = parseFloat(p.cuota) || 0;
    const cuotas = parseInt(p.cuotasPagadas) || 0;
    const total  = parseInt(p.cuotas) || 0;
    if (total > 0 && cuotas >= total - 1) {
      alertas.push({ tipo: 'success', msg: `¡El préstamo "${p.nombre}" está casi pagado! Solo queda ${total - cuotas} cuota(s).` });
    }
  });

  if (alertas.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = alertas.map(a => `
    <div class="alerta alerta-${a.tipo}">
      <span class="alerta-icon">${a.tipo === 'danger' ? '🔴' : a.tipo === 'warning' ? '⚠️' : a.tipo === 'success' ? '🎉' : 'ℹ️'}</span>
      <span class="alerta-msg">${a.msg}</span>
    </div>`).join('');
}

function renderAlertasDeuda(tarjetas, prestamos) {
  const el = document.getElementById('alertas-deuda');
  if (!el) return;

  const alertas = [];
  const hoy = new Date();
  const diaHoy = hoy.getDate();

  // Tarjetas cercanas al límite
  tarjetas.forEach(t => {
    const limite = parseFloat(t.limite) || 0;
    const deuda  = parseFloat(t.deuda)  || 0;
    if (limite === 0) return;
    const uso = deuda / limite;
    if (uso >= 1.0) {
      alertas.push({ tipo: 'danger', msg: `${t.nombre} al límite máximo. Sin crédito disponible.` });
    } else if (uso >= 0.9) {
      alertas.push({ tipo: 'warning', msg: `${t.nombre} al ${Math.round(uso*100)}% del límite. Solo S/ ${Math.round(limite-deuda).toLocaleString()} disponibles.` });
    }

    // Próximo vencimiento
    const diaPago = parseInt(t.diaCierre) || parseInt(t.vence) || 0;
    if (diaPago) {
      const diasFaltan = diaPago >= diaHoy ? diaPago - diaHoy : (30 - diaHoy + diaPago);
      if (diasFaltan <= 5) {
        alertas.push({ tipo: 'info', msg: `${t.nombre} vence ${diasFaltan === 0 ? 'hoy' : 'en ' + diasFaltan + (diasFaltan===1?' día':' días')}. Monto: S/ ${deuda.toLocaleString()}.` });
      }
    }
  });

  // Préstamos casi terminados
  prestamos.forEach(p => {
    const cuotas = parseInt(p.cuotasPagadas) || 0;
    const total  = parseInt(p.cuotas) || 0;
    if (total > 0 && cuotas >= total - 1 && cuotas < total) {
      alertas.push({ tipo: 'success', msg: `"${p.nombre}" casi terminado. Queda ${total - cuotas} cuota(s).` });
    }
  });

  if (alertas.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = alertas.map(a => `
    <div class="alerta alerta-${a.tipo}">
      <span class="alerta-icon">${a.tipo === 'danger' ? '🔴' : a.tipo === 'warning' ? '⚠️' : a.tipo === 'success' ? '🎉' : 'ℹ️'}</span>
      <span class="alerta-msg">${a.msg}</span>
    </div>`).join('');
}

/* ══════════════════════════════════════════
   GRÁFICOS — Chart.js
   ══════════════════════════════════════════ */

function getComputedColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function destroyChart(chart) {
  if (chart) {
    try { chart.destroy(); } catch(e) {}
  }
  return null;
}

/* ── HELPER: expande gastos "ambos" en 50/50 para los gráficos ── */
function expandirGastos(gastos) {
  const resultado = [];
  gastos.forEach(g => {
    if (g.quien === 'ambos') {
      const mitad = (parseFloat(g.monto) || 0) / 2;
      resultado.push({ ...g, quien: 'yo',     monto: mitad });
      resultado.push({ ...g, quien: 'pareja', monto: mitad });
    } else {
      resultado.push(g);
    }
  });
  return resultado;
}

/* ══════════════════════════════════════════
   GRÁFICOS — Versión Ultra Robusta Corregida
   ══════════════════════════════════════════ */

async function renderCharts(gastos, cfg, tarjetas, prestamos, ingresoTotal, pagoDeudasMes) {
  // Cancelar cualquier render anterior que aún esté corriendo
  renderChartsAbort = true;
  // Nuevo token para esta ejecución
  const token = Symbol();
  renderChartsAbort = false;
  const currentToken = token;

  gastos = expandirGastos(gastos || []);

  const textColor     = getComputedColor('--text');
  const text2Color    = getComputedColor('--text2');
  const text3Color    = getComputedColor('--text3');
  const borderColor   = getComputedColor('--border');
  const surfaceColor  = getComputedColor('--surface');

  const CAT_COLORS = {
    'Alimentación': '#2a7de1',
    'Servicios':    '#3e7d2a',
    'Entret.':      '#b06a10',
    'Transporte':   '#888780',
    'Salud':        '#c94b7b',
    'Hogar':        '#c43030',
    'Otros':        '#6b6a66'
  };

  function resetAndGetCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'block';
    const emptyMsg = canvas.parentElement.querySelector('.empty-chart-msg');
    if (emptyMsg) emptyMsg.style.display = 'none';
    return canvas;
  }

  function showEmptyState(canvas, height, text) {
    canvas.style.display = 'none';
    let msg = canvas.parentElement.querySelector('.empty-chart-msg');
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'empty-state empty-chart-msg';
      canvas.parentElement.appendChild(msg);
    }
    msg.style.display = 'flex';
    msg.style.alignItems = 'center';
    msg.style.justifyContent = 'center';
    msg.style.height = height;
    msg.innerHTML = text;
  }

  /* 1. DONUT — 5 grupos de gasto */
  (function() {
    const canvas = resetAndGetCanvas('donutChart');
    if (!canvas) return;

    const GRUPOS = [
      { label: 'Vivienda',  cats: ['Hogar', 'Servicios'],            color: '#2a7de1' },
      { label: 'Tarjetas',  cats: ['_tarjeta_'],                     color: '#c94b7b' },
      { label: 'Ahorro',    cats: ['_ahorro_'],                      color: '#2d6a2d' },
      { label: 'Entret.',   cats: ['Entret.'],                       color: '#b06a10' },
      { label: 'Otros',     cats: ['Alimentación','Transporte','Salud','Otros'], color: '#888780' },
    ];

    const totalesPorGrupo = GRUPOS.map(g => {
      if (g.cats.includes('_tarjeta_')) {
        return gastos.filter(x => x.medio === 'tarjeta').reduce((s, x) => s + (parseFloat(x.monto)||0), 0);
      }
      if (g.cats.includes('_ahorro_')) {
        return Math.max(0, ingresoTotal - gastos.reduce((s, x) => s + (parseFloat(x.monto)||0), 0));
      }
      return gastos.filter(x => g.cats.includes(x.cat || 'Otros')).reduce((s, x) => s + (parseFloat(x.monto)||0), 0);
    });

    const total = totalesPorGrupo.reduce((a, b) => a + b, 0);
    if (total === 0) {
      showEmptyState(canvas, '230px', 'Sin gastos este mes');
      return;
    }

    const gruposFiltrados = GRUPOS.map((g, i) => ({ ...g, valor: totalesPorGrupo[i] })).filter(g => g.valor > 0);

    const legendEl = document.getElementById('legend-donut');
    if (legendEl) {
      legendEl.innerHTML = GRUPOS.map(g =>
        '<div class="legend-item">' +
          '<div class="legend-dot" style="background:' + g.color + ';"></div>' +
          '<span>' + g.label + '</span>' +
        '</div>'
      ).join('');
    }

    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: gruposFiltrados.map(g => g.label),
        datasets: [{
          data: gruposFiltrados.map(g => g.valor),
          backgroundColor: gruposFiltrados.map(g => g.color),
          borderColor: surfaceColor,
          borderWidth: 4,
          hoverOffset: 10,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: surfaceColor,
            titleColor: textColor,
            bodyColor: text2Color,
            borderColor: borderColor,
            borderWidth: 1,
            padding: 10,
            bodyFont: { family: 'DM Sans' },
            callbacks: {
              label: function(ctx) {
                const pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
                return ' S/ ' + ctx.parsed.toLocaleString('es-PE') + ' · ' + pct + '%';
              }
            }
          }
        }
      }
    });
  })();

  /* 2. BAR — Tú vs Pareja (sin cambios) */
  (function() {
    const canvas = resetAndGetCanvas('barChart');
    if (!canvas) return;
    const yo = cfg.nombreYo || 'Christian';
    const ella = cfg.nombreElla || 'Sydney';
    const cats = Object.keys(CATS);
    const dataYo = cats.map(c => gastos.filter(g => g.cat === c && g.quien === 'yo').reduce((a,g) => a + (parseFloat(g.monto)||0), 0));
    const dataElla = cats.map(c => gastos.filter(g => g.cat === c && g.quien === 'pareja').reduce((a,g) => a + (parseFloat(g.monto)||0), 0));
    if (dataYo.every(v => v === 0) && dataElla.every(v => v === 0)) {
      showEmptyState(canvas, '210px', 'Sin datos este mes');
      return;
    }
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: cats,
        datasets: [
          { label: yo, data: dataYo, backgroundColor: '#2a7de1cc', borderRadius: 6 },
          { label: ella, data: dataElla, backgroundColor: '#c94b7bcc', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: text3Color } },
          y: { grid: { color: borderColor }, ticks: { color: text3Color, callback: v => 'S/' + v } }
        }
      }
    });
  })();

  /* 3. LINE — Evolución Semanal (sin cambios) */
  (function() {
    const canvas = resetAndGetCanvas('lineChart');
    if (!canvas) return;
    const semanas = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
    const dataYo = [0,0,0,0];
    const dataElla = [0,0,0,0];
    gastos.forEach(g => {
      if (!g.fecha) return;
      const d = new Date(g.fecha + 'T12:00:00');
      const week = Math.min(Math.floor((d.getDate() - 1) / 7), 3);
      const monto = parseFloat(g.monto) || 0;
      if (g.quien === 'yo') dataYo[week] += monto;
      else if (g.quien === 'pareja') dataElla[week] += monto;
    });
    if (dataYo.every(v=>v===0) && dataElla.every(v=>v===0)) {
      showEmptyState(canvas, '200px', '📊<br><br>Registra tus gastos semanales<br>para ver la evolución aquí');
      const legendLine = document.getElementById('legend-line');
      if (legendLine) legendLine.style.display = 'none';
      return;
    }
    const legendLine = document.getElementById('legend-line');
    if (legendLine) legendLine.style.display = 'flex';
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: semanas,
        datasets: [
          { label: cfg.nombreYo || 'Christian', data: dataYo, borderColor: '#2a7de1', tension: 0.4, borderWidth: 3 },
          { label: cfg.nombreElla || 'Sydney', data: dataElla, borderColor: '#c94b7b', tension: 0.4, borderWidth: 3 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: text3Color } },
          y: { grid: { color: borderColor }, ticks: { color: text3Color, callback: v => 'S/' + v } }
        }
      }
    });
  })();

  /* 4. HBAR — Total por Categoría (sin cambios) */
  (function() {
    const canvas = resetAndGetCanvas('hbarChart');
    if (!canvas) return;
    const totales = {};
    gastos.forEach(g => {
      const cat = g.cat || 'Otros';
      totales[cat] = (totales[cat] || 0) + (parseFloat(g.monto) || 0);
    });
    const sorted = Object.entries(totales).sort((a,b) => b[1] - a[1]);
    if (sorted.length === 0) {
      showEmptyState(canvas, '260px', '📋<br><br>Tus gastos organizados<br>por categoría aparecerán aquí');
      return;
    }
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: sorted.map(e => e[0]),
        datasets: [{ 
          data: sorted.map(e => e[1]), 
          backgroundColor: sorted.map(e => (CAT_COLORS[e[0]] || '#888780') + 'cc'),
          borderRadius: 8 
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: borderColor }, ticks: { color: text3Color, callback: v => 'S/' + v } },
          y: { grid: { display: false }, ticks: { color: textColor } }
        }
      }
    });
  })();

  /* 5. Proyección de Deuda (sin cambios) */
  (function() {
    const canvas = resetAndGetCanvas('debtChart');
    if (!canvas) return;
    const ingresoTotal = (parseFloat(cfg.ingresoYo)||0) + (parseFloat(cfg.ingresoElla)||0);
    const pagoMensual = [...(tarjetas||[]).map(t => parseFloat(t.cuotaMin)||0),
                         ...(prestamos||[]).map(p => parseFloat(p.cuota)||0)]
                        .reduce((a,b) => a + b, 0);
    const deudaInicial = [...(tarjetas||[]).map(t => parseFloat(t.deuda)||0),
                          ...(prestamos||[]).map(p => parseFloat(p.saldo)||0)]
                         .reduce((a,b) => a + b, 0);
    if (deudaInicial === 0) {
      showEmptyState(canvas, '190px', '¡Sin deudas este mes! 🎉');
      return;
    }
    const labels = ['Actual'];
    const dataDeuda = [deudaInicial];
    let saldo = deudaInicial;
    const reduccion = pagoMensual > 0 ? pagoMensual : Math.max(100, ingresoTotal * 0.15);
    for (let i = 1; i <= 24 && saldo > 0; i++) {
      saldo = Math.max(0, saldo - reduccion);
      labels.push(`Mes ${i}`);
      dataDeuda.push(Math.round(saldo));
    }
    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Deuda proyectada',
          data: dataDeuda,
          borderColor: '#c43030',
          backgroundColor: '#c4303018',
          tension: 0.3,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: text3Color } },
          y: { grid: { color: borderColor }, ticks: { color: text3Color, callback: v => 'S/' + v } }
        }
      }
    });
  })();

  /* ── PROGRESO ANUAL (savingChart) ── */
  (async function() {
    const canvas = resetAndGetCanvas('savingChart');
    if (!canvas) return;

    const mesesNombres = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const anyoActual = new Date().getFullYear();
    const mesActualNum = new Date().getMonth();

    // Obtener datos reales de todo el año
    const todosIngresos = await DB.getIngresosMes(null);
    if (renderChartsAbort || currentToken !== token) return; // cancelar si se inició otro render

    const ingresosPorMes = {};
    todosIngresos.forEach(ing => {
      if (!ing.fecha) return;
      const mesStr = ing.fecha.substring(0, 7);
      if (mesStr.startsWith(anyoActual.toString())) {
        ingresosPorMes[mesStr] = (ingresosPorMes[mesStr] || 0) + (parseFloat(ing.monto) || 0);
      }
    });

    const todosGastos = await DB.getGastos(null);
    if (renderChartsAbort || currentToken !== token) return;

    const gastosPorMes = {};
    todosGastos.forEach(g => {
      if (!g.fecha) return;
      const mesStr = g.fecha.substring(0, 7);
      if (mesStr.startsWith(anyoActual.toString())) {
        gastosPorMes[mesStr] = (gastosPorMes[mesStr] || 0) + (parseFloat(g.monto) || 0);
      }
    });

    const dataAhorro = mesesNombres.map((_, i) => {
      if (i > mesActualNum) return null;
      const mesStr = `${anyoActual}-${String(i+1).padStart(2, '0')}`;
      const ing = ingresosPorMes[mesStr] || 0;
      const gas = gastosPorMes[mesStr] || 0;
      return Math.max(0, ing - gas);
    });

    if (dataAhorro.every(v => v === null || v === 0)) {
      showEmptyState(canvas, '200px', '📈<br><br>Registra ingresos y gastos<br>para ver el progreso anual');
      return;
    }

    // Destruir el gráfico existente justo antes de crear uno nuevo (seguro extra)
    Chart.getChart(canvas)?.destroy();

    const barColors = dataAhorro.map(v => v === null ? 'transparent' : '#2d6a2d');

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: mesesNombres,
        datasets: [{
          data: dataAhorro,
          backgroundColor: barColors,
          borderRadius: 5,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(c) { return c.parsed.y !== null ? ' S/ ' + c.parsed.y.toLocaleString() : ' Sin datos'; }
            },
            backgroundColor: surfaceColor, titleColor: textColor,
            bodyColor: text2Color, borderColor: borderColor, borderWidth: 1, padding: 10,
            bodyFont: { family: 'DM Sans' },
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { 
              color: text3Color, 
              font: { family: 'DM Sans', size: 11 },
              maxRotation: 0,
              autoSkip: false
            },
            border: { display: false },
          },
          y: {
            grid: { color: borderColor, drawTicks: false },
            ticks: { color: text3Color, font: { family: 'DM Sans', size: 11 }, callback: function(v) { return 'S/'+v; } },
            border: { display: false },
            min: 0,
          }
        }
      }
    });
  })();

  /* ── REGLA 50/30/20 ── */
  (function() {
    const el = document.getElementById('regla-502030');
    if (!el) return;

    const ingresos = ingresoTotal;
    if (ingresos === 0) {
      el.innerHTML = '<div class="empty-state">Configura tus ingresos para ver el análisis.</div>';
      return;
    }

    const NECESIDADES_CATS = ['Alimentación', 'Servicios', 'Transporte', 'Salud', 'Hogar'];
    const GUSTOS_CATS = ['Entret.', 'Otros'];

    let totalNecesidades = 0, totalGustos = 0;
(gastos || []).forEach(function(g) {
  // Excluir pagos de deuda (no son consumo)
  const desc = (g.desc || '').toLowerCase();
  if (desc.includes('pago tarjeta') || desc.includes('préstamo')) return;
  
  const monto = g.monto || 0;
  if (NECESIDADES_CATS.indexOf(g.cat) >= 0)  totalNecesidades += monto;
  else if (GUSTOS_CATS.indexOf(g.cat) >= 0)   totalGustos += monto;
});
    const totalAhorro = Math.max(0, ingresos - totalNecesidades - totalGustos);

    const metaNecesidades = ingresos * 0.50;
    const metaGustos      = ingresos * 0.30;
    const metaAhorro50    = ingresos * 0.20;

    function buildFila(label, meta, actual, esAhorro = false) {
      const pct = Math.min(100, Math.round(actual / meta * 100));
      let barColor, statusIcon, statusTxt, statusColor;
      if (esAhorro) {
        if (actual >= meta) {
          barColor = '#2d6a2d'; statusIcon = '✅'; statusTxt = 'Meta de ahorro cumplida'; statusColor = '#2d6a2d';
        } else {
          barColor = '#2a7de1'; statusIcon = '☑️'; statusTxt = `En camino, faltan S/ ${Math.round(meta - actual).toLocaleString()} para la meta ideal`; statusColor = '#2a7de1';
        }
      } else {
        if (actual > meta) {
          barColor = '#c43030'; statusIcon = '⚠️'; statusTxt = `Excedido en S/ ${Math.round(actual - meta).toLocaleString()}`; statusColor = '#c43030';
        } else if (actual >= meta * 0.8) {
          barColor = '#e8850a'; statusIcon = '⚠️'; statusTxt = 'Acercándose al límite'; statusColor = '#e8850a';
        } else {
          barColor = '#2a7de1'; statusIcon = '✅'; statusTxt = `Quedan S/ ${Math.round(meta - actual).toLocaleString()} del presupuesto`; statusColor = '#2d6a2d';
        }
      }
      return `
        <div class="regla-fila">
          <div class="regla-header">
            <span class="regla-label">${label}</span>
            <span class="regla-montos">S/ ${Math.round(meta).toLocaleString()} · Actual: S/ ${Math.round(actual).toLocaleString()}</span>
          </div>
          <div class="regla-bar-bg">
            <div class="regla-bar-fill" style="width:${pct}%; background:${barColor}; transition: width 0.5s ease;"></div>
          </div>
          <div class="regla-status" style="color:${statusColor}; margin-top:6px;">
            ${statusIcon} <span>${statusTxt}</span>
          </div>
        </div>`;
    }

    el.innerHTML =
      buildFila('Necesidades (50%)', metaNecesidades, totalNecesidades) +
      buildFila('Gustos (30%)',      metaGustos,      totalGustos) +
      buildFila('Ahorro (20%)',      metaAhorro50,    totalAhorro, true);
  })();
}

/* ====================== SELECTOR DE MES/AÑO ====================== */

let currentYear = 2026;
let currentMonth = 4; // abril = 4

function openMonthPicker() {
  currentYear = parseInt(mesActual.substring(0,4));
  currentMonth = parseInt(mesActual.substring(5,7));

  document.getElementById('selected-year').textContent = currentYear;
  renderMonthGrid();
  openModal('monthPickerModal');
}

function renderMonthGrid() {
  const grid = document.getElementById('month-grid');
  grid.innerHTML = '';

  const meses = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  for (let i = 1; i <= 12; i++) {
    const isSelected = (i === currentMonth);
    const btn = document.createElement('button');
    btn.textContent = meses[i-1];
    btn.style.cssText = `
      padding: 12px 8px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: ${isSelected ? '600' : '500'};
      background: ${isSelected ? 'var(--blue)' : 'var(--surface2)'};
      color: ${isSelected ? 'white' : 'var(--text)'};
      border: none;
      cursor: pointer;
    `;
    btn.onclick = () => {
      selectMonth(i);
    };
    grid.appendChild(btn);
  }
}

function selectMonth(month) {
  mesActual = `${currentYear}-${String(month).padStart(2, '0')}`;
  actualizarMesBtn();
  closeModal('monthPickerModal');
  renderTodo();   // ← Actualiza toda la pantalla con el nuevo mes
}

function prevYear() {
  currentYear--;
  document.getElementById('selected-year').textContent = currentYear;
  renderMonthGrid();
}

function nextYear() {
  currentYear++;
  document.getElementById('selected-year').textContent = currentYear;
  renderMonthGrid();
}

function toggleYearSelector() {
  const selector = document.getElementById('year-selector');
  selector.style.display = selector.style.display === 'none' ? 'block' : 'none';
  
  if (selector.style.display === 'block') {
    const select = document.getElementById('year-select');
    select.innerHTML = '';
    for (let y = 2024; y <= 2028; y++) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === currentYear) opt.selected = true;
      select.appendChild(opt);
    }
  }
}

function changeYear(newYear) {
  currentYear = parseInt(newYear);
  document.getElementById('selected-year').textContent = currentYear;
  renderMonthGrid();
  document.getElementById('year-selector').style.display = 'none';
}

// Actualizar el texto del botón del header
function actualizarMesBtn() {
  const display = document.getElementById('month-display');
  if (display) {
    display.textContent = DB.formatMes(mesActual);
  }
}

function mostrarToast(mensaje) {
  // Crea el elemento si no existe
  let toast = document.getElementById('toast-notificacion');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notificacion';
    toast.style = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: #333; color: white; padding: 12px 24px; border-radius: 25px;
      z-index: 10000; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);
  }
  
  toast.textContent = mensaje;
  toast.style.display = 'block';
  toast.style.opacity = '1';

  // Desaparece después de 3 segundos
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => { toast.style.display = 'none'; }, 300);
  }, 3000);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('✅ Service Worker registrado'))
      .catch(err => console.error('❌ Error al registrar SW', err));
  });
}

async function configurarNotificaciones() {
    try {
        const messaging = firebase.messaging();
        
        // Pedir permiso al usuario
        const permiso = await Notification.requestPermission();
        
        if (permiso === 'granted') {
            // Obtener el token único de este celular
            // Reemplaza 'TU_VAPID_KEY' por la que generaste en la consola de Firebase
            const token = await messaging.getToken({ 
                vapidKey: 'BJ2hOCo0ghqObiVlmWBrGd0QXux17QV8bzk6KxjT-1MwOhmPJHXCD3ArCbR_NeaSj2aFPr_jcQI7iyBdD_O_hl8' 
            });

            if (token) {
                console.log("Token obtenido:", token);
                // Aquí deberíamos guardar el token en Firestore asociado al usuario
                guardarTokenEnDB(token);
            }
        }
    } catch (error) {
        console.error("Error al configurar notificaciones:", error);
    }
}

async function guardarTokenEnDB(token) {
    if (!hogarId) return;
    // Guardamos el token en una colección de "dispositivos" dentro del hogar
    await db.collection("hogares").doc(hogarId).collection("tokens").doc(token).set({
        fechaActualizacion: new Date(),
        usuario: auth.currentUser ? auth.currentUser.uid : 'anonimo'
    });
}

/* ══════════════════════════════════════════
   GESTOS TÁCTILES — VERSIÓN SIMPLIFICADA (Sin Swipe)
   ══════════════════════════════════════════ */

/**
 * Inicializa gestos en la lista principal de gastos.
 * En mobile: swipe izquierdo revela botón de borrar.
 * En desktop: el botón X aparece en hover (CSS).
 */

const SWIPE_THRESHOLD = 60; // px mínimos para considerar swipe válido

/** Registra el gesto de swipe en un .expense-item */
function addSwipeToItem(item) {
  // Solo en dispositivos touch
  if (!('ontouchstart' in window)) return;

  const inner = item.querySelector('.expense-item-inner');
  if (!inner) return;

  let startX = 0, startY = 0, tracking = false, moved = false;

  item.addEventListener('touchstart', e => {
    startX   = e.touches[0].clientX;
    startY   = e.touches[0].clientY;
    tracking = true;
    moved    = false;
    inner.style.transition = 'none';
  }, { passive: true });

  item.addEventListener('touchmove', e => {
    if (!tracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // Si el gesto es más vertical, dejamos scroll normal
    if (!moved && Math.abs(dy) > Math.abs(dx) + 8) {
      tracking = false;
      return;
    }

    // Solo permitir deslizamiento hacia la izquierda
    if (dx < 0) {
      moved = true;
      const clamp = Math.max(-120, dx);
      inner.style.transform = `translateX(${clamp}px)`;
    }
  }, { passive: true });

  item.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;

    const dx = e.changedTouches[0].clientX - startX;

    // Animar regreso a posición original siempre
    inner.style.transition = 'transform 0.3s ease';
    inner.style.transform  = 'translateX(0)';

    // Si superó el umbral → abrir modal de confirmación
    if (moved && dx < -SWIPE_THRESHOLD) {
      const id = item.dataset.id;
      // Pequeño delay para que la animación de regreso se vea antes del modal
      setTimeout(() => eliminarGasto(id), 280);
    }

    moved = false;
  });
}

function initGestures() {
  document.querySelectorAll('#expenseList .expense-item').forEach(addSwipeToItem);
}

/**
 * Inicializa gestos en el modal de historial completo.
 * Se llama cada vez que se abre el modal.
 */
function initGesturesModal() {
  document.querySelectorAll('#listaCompletaGastos .expense-item').forEach(addSwipeToItem);
}

function openIngresoExtraModal() {
  document.getElementById('ie-desc').value = '';
  document.getElementById('ie-monto').value = '';
  document.getElementById('ie-fecha').value = new Date().toISOString().split('T')[0];
  const miTipo = localStorage.getItem('miUsuarioTipo') || 'yo';
  const selectQuien = document.getElementById('ie-quien');
  if (selectQuien) {
    selectQuien.value = miTipo;
  }
  openModal('ingresoExtraModal');
}

async function agregarIngresoExtra() {
  const desc = document.getElementById('ie-desc').value.trim();
  const monto = parseFloat(document.getElementById('ie-monto').value);
  const quien = document.getElementById('ie-quien').value;
  const fecha = document.getElementById('ie-fecha').value;

  if (isNaN(monto) || monto <= 0 || !fecha) {
    alert('Por favor ingresa un monto válido y fecha');
    return;
  }

  await DB.addIngreso({
    desc: desc || 'Ingreso',
    monto,
    quien,
    fecha,
    tipo: 'manual',
    creadoEn: new Date().toISOString()
  });
  closeModal('ingresoExtraModal');
  showToast('Ingreso registrado ✓');
  renderTodo();
}

async function refrescarListaRecurrentes() {
  const recurrentes = await DB.getRecurrentes();
  const cfg = await DB.getConfig();
  const nombreYo = cfg?.nombreYo || 'Tú';
  const nombreElla = cfg?.nombreElla || 'Pareja';
  const contenedor = document.getElementById('lista-recurrentes');
  if (!contenedor) return;

  if (recurrentes.length === 0) {
    contenedor.innerHTML = '<div class="empty-state">No hay gastos fijos configurados.</div>';
  } else {
    contenedor.innerHTML = recurrentes.map(r => {
      const quien = r.quien === 'yo' ? nombreYo : r.quien === 'pareja' ? nombreElla : 'Ambos';
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border);">
          <div>
            <div style="font-weight:500;">${r.desc}</div>
            <div style="font-size:12px; color:var(--text2);">${r.cat} · S/ ${r.monto} · Día ${r.dia} · ${quien}</div>
          </div>
          <button onclick="eliminarRecurrente('${r.id}')" style="background:none; border:none; color:var(--text3); font-size:18px; cursor:pointer;">✕</button>
        </div>`;
    }).join('');
  }
}

async function abrirGestionRecurrentes() {
  await refrescarListaRecurrentes();
  openModal('recurrentesModal');
}

async function eliminarRecurrente(id) {
  await DB.deleteRecurrente(id);
  showToast('Gasto fijo eliminado ✓');
  await refrescarListaRecurrentes(); // solo actualiza la lista dentro del modal abierto
}

async function exportarAExcel() {
  try {
    const cfg = await DB.getConfig();
    if (!cfg) return alert('Configura primero la app.');

    const [gastos, tarjetas, prestamos, metas, ingresosExtras] = await Promise.all([
      DB.getGastos(mesActual),
      DB.getTarjetas(),
      DB.getPrestamos(),
      DB.getMetas(),
      DB.getIngresosExtras(mesActual)
    ]);

    const sueldos = (parseFloat(cfg.ingresoYo)||0) + (parseFloat(cfg.ingresoElla)||0);
    const extras = ingresosExtras.reduce((s, i) => s + (parseFloat(i.monto)||0), 0);
    const ingresoTotal = sueldos + extras;
    const totalGastos = gastos.reduce((s,g) => s + (g.monto||0), 0);
    const pagoMinTarjetas = tarjetas.reduce((s,t) => s + Math.min(parseFloat(t.deuda)||0, parseFloat(t.cuotaMin)||0), 0);
    const pagoPrestamos = prestamos.reduce((s,p) => s + (parseFloat(p.cuota)||0), 0);
    const ahorro = Math.max(0, ingresoTotal - totalGastos - pagoMinTarjetas - pagoPrestamos);

    // Crear libro
    const wb = XLSX.utils.book_new();

    // --- Hoja 1: Gastos del mes ---
    const gHeader = ['Fecha', 'Descripción', 'Categoría', 'Quién', 'Monto', 'Medio'];
    const gData = gastos.map(g => [
      g.fecha || '', g.desc || '', g.cat || '',
      g.quien === 'yo' ? cfg.nombreYo : (g.quien === 'pareja' ? cfg.nombreElla : 'Ambos'),
      g.monto || 0, g.medio || 'efectivo'
    ]);
    const wsG = XLSX.utils.aoa_to_sheet([gHeader, ...gData]);
    wsG['!cols'] = [{wch:12},{wch:30},{wch:15},{wch:15},{wch:12},{wch:15}];
    XLSX.utils.book_append_sheet(wb, wsG, 'Gastos');

    // --- Hoja 2: Deudas ---
    const dHeader = ['Tipo', 'Nombre', 'Deuda/Saldo', 'Límite', 'Cuota', 'Progreso'];
    const dData = [
      ...tarjetas.map(t => ['Tarjeta', t.nombre, t.deuda, t.limite, t.cuotaMin, `${Math.round((t.deuda/t.limite)*100)}%`]),
      ...prestamos.map(p => ['Préstamo', p.nombre, p.saldo, '', p.cuota, `${p.pagadas}/${p.total} cuotas`])
    ];
    const wsD = XLSX.utils.aoa_to_sheet([dHeader, ...dData]);
    wsD['!cols'] = [{wch:12},{wch:20},{wch:15},{wch:15},{wch:12},{wch:18}];
    XLSX.utils.book_append_sheet(wb, wsD, 'Deudas');

    // --- Hoja 3: Metas de ahorro ---
    const mHeader = ['Meta', 'Objetivo', 'Actual', 'Progreso'];
    const mData = metas.map(m => [m.nombre, m.objetivo, m.actual, `${Math.round((m.actual/m.objetivo)*100)}%`]);
    const wsM = XLSX.utils.aoa_to_sheet([mHeader, ...mData]);
    wsM['!cols'] = [{wch:20},{wch:15},{wch:15},{wch:12}];
    XLSX.utils.book_append_sheet(wb, wsM, 'Ahorro');

    // --- Hoja 4: Ingresos extras ---
    const iHeader = ['Fecha', 'Descripción', 'Quién', 'Monto'];
    const iData = ingresosExtras.map(i => [
      i.fecha || '', i.desc || '',
      i.quien === 'yo' ? cfg.nombreYo : cfg.nombreElla,
      i.monto || 0
    ]);
    const wsI = XLSX.utils.aoa_to_sheet([iHeader, ...iData]);
    wsI['!cols'] = [{wch:12},{wch:25},{wch:15},{wch:12}];
    XLSX.utils.book_append_sheet(wb, wsI, 'Ingresos Extras');

    // --- Hoja 5: Resumen Mensual ---
    const rHeader = ['Concepto', 'Monto (S/)'];
    const rData = [
      ['Ingresos (Sueldos)', sueldos],
      ['Ingresos (Extras)', extras],
      ['Ingreso Total', ingresoTotal],
      ['Gastos del mes', totalGastos],
      ['Pago mínimo tarjetas', pagoMinTarjetas],
      ['Pago préstamos', pagoPrestamos],
      ['Ahorro estimado', ahorro]
    ];
    const wsR = XLSX.utils.aoa_to_sheet([rHeader, ...rData]);
    wsR['!cols'] = [{wch:25},{wch:15}];
    XLSX.utils.book_append_sheet(wb, wsR, 'Resumen');

    // Descargar archivo
    XLSX.writeFile(wb, `HogarFinanzas_${mesActual}.xlsx`);
    showToast('Excel exportado correctamente 📥');
  } catch (e) {
    console.error(e);
    alert('Error al exportar. Revisa la consola.');
  }
}

async function notificarAlOtro(mensaje, cfg) {
  if (!hogarId) return;
  const miTipo = localStorage.getItem('miUsuarioTipo');
  const tipoDestino = miTipo === 'yo' ? 'pareja' : 'yo';

  // Guardar notificación en Firestore (la Cloud Function la detectará)
  try {
    await db.collection("hogares").doc(hogarId).collection("notificaciones").add({
      texto: mensaje,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      usuarioDestino: tipoDestino,
      usuarioId: auth.currentUser ? auth.currentUser.uid : 'anonimo'
    });
    console.log("📩 Solicitud de notificación enviada a Cloud Function");
  } catch (e) {
    console.error("Error al crear notificación:", e);
  }
}




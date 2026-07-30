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
  'Deudas':       { icon:'🏦', color:'#b06a10' },  // <-- nueva
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

/* ── ESTADO GLOBAL DE INTERFAZ RESTAURADO ── */
let _modalCount = 0;
let _bodyScrollY = 0;
let _wasModalOpen = false;
let toastTimeout = null;

let tarjetaAjusteId = null;
let tarjetaAjusteNombre = '';
let tarjetaAjusteDeudaAnterior = 0;
let tarjetaAjusteLimite = 0;

let tarjetaActualId = null;
let tarjetaActualNombre = '';
let tarjetaDeudaMax = 0;

let prestamoActualId = null;
let prestamoActualNombre = '';
let prestamoSaldoMax = 0;
let cuotaMensual = 0;

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
const SWIPE_THRESHOLD = 60;

function escapeInlineString(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, ' ');
}

/* ── IDENTIDAD DEL HOGAR Y PERFIL DEL DISPOSITIVO ── */
const IDENTITY_SCHEMA_VERSION = 3;

function crearIdMiembro(nombre, fallback) {
  const limpio = String(nombre || fallback || 'miembro')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return limpio || fallback || `miembro-${Date.now()}`;
}

function normalizarConfigIdentidad(cfg = {}) {
  const nombrePrincipal = cfg.nombreYo || 'Christian';
  const nombrePareja = cfg.nombreElla || 'Sydney';
  const miembrosExistentes = cfg.miembros && typeof cfg.miembros === 'object' ? cfg.miembros : {};
  const ids = Object.keys(miembrosExistentes);
  const principalExistente = ids.find(id => miembrosExistentes[id]?.legacyTipo === 'yo');
  const parejaExistente = ids.find(id => miembrosExistentes[id]?.legacyTipo === 'pareja');
  const principalId = principalExistente || crearIdMiembro(nombrePrincipal, 'christian');
  let parejaId = parejaExistente || crearIdMiembro(nombrePareja, 'sydney');
  if (parejaId === principalId) parejaId = `${parejaId}-2`;

  const miembros = {
    ...miembrosExistentes,
    [principalId]: {
      ...(miembrosExistentes[principalId] || {}),
      id: principalId,
      nombre: nombrePrincipal,
      rol: 'administrador',
      legacyTipo: 'yo',
      activo: true
    },
    [parejaId]: {
      ...(miembrosExistentes[parejaId] || {}),
      id: parejaId,
      nombre: nombrePareja,
      rol: 'miembro',
      legacyTipo: 'pareja',
      activo: true
    }
  };

  return {
    ...cfg,
    schemaVersion: Math.max(Number(cfg.schemaVersion) || 0, IDENTITY_SCHEMA_VERSION),
    nombreHogar: cfg.nombreHogar || `Hogar de ${nombrePrincipal} y ${nombrePareja}`,
    miembros,
    miembroPrincipalId: principalId,
    miembroParejaId: parejaId
  };
}

function obtenerMiembroActual(cfg = configCache) {
  const normalizada = normalizarConfigIdentidad(cfg || {});
  let miembroId = localStorage.getItem('miembroActualId');
  if (!miembroId) {
    const legacy = localStorage.getItem('miUsuarioTipo');
    miembroId = legacy === 'pareja' ? normalizada.miembroParejaId : legacy === 'yo' ? normalizada.miembroPrincipalId : null;
    if (miembroId) localStorage.setItem('miembroActualId', miembroId);
  }
  return miembroId ? normalizada.miembros[miembroId] || null : null;
}

function legacyTipoDeMiembro(miembroId, cfg = configCache) {
  const normalizada = normalizarConfigIdentidad(cfg || {});
  return normalizada.miembros[miembroId]?.legacyTipo || 'yo';
}

function guardarPerfilDispositivo(miembroId, cfg = configCache) {
  const normalizada = normalizarConfigIdentidad(cfg || {});
  const miembro = normalizada.miembros[miembroId];
  if (!miembro) return false;
  localStorage.setItem('miembroActualId', miembroId);
  // Compatibilidad temporal con movimientos y filtros anteriores.
  localStorage.setItem('miUsuarioTipo', miembro.legacyTipo || 'yo');
  localStorage.setItem('perfilDispositivoConfigurado', '1');
  return true;
}

async function migrarEsquemaIdentidad(cfg) {
  const normalizada = normalizarConfigIdentidad(cfg);
  const requiereGuardar = Number(cfg?.schemaVersion || 0) < IDENTITY_SCHEMA_VERSION || !cfg?.miembros;
  if (requiereGuardar && DB.hogarId) {
    await DB.updateConfig({
      schemaVersion: normalizada.schemaVersion,
      nombreHogar: normalizada.nombreHogar,
      miembros: normalizada.miembros,
      miembroPrincipalId: normalizada.miembroPrincipalId,
      miembroParejaId: normalizada.miembroParejaId
    });
  }
  return normalizada;
}

/* ══════════════════════
   INICIO
══════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('g-fecha').value = new Date().toISOString().split('T')[0];
  document.querySelector('.app-logo').onclick = () => openAjustesModal();

  verificarConfiguracion();
  initGestures();
  revisarIdentidad();
  actualizarFabContextual(activeTab);
  
  registrarServiceWorkerMensajeria();
});

async function verificarConfiguracion() {
  const cfgOriginal = await DB.getConfig();

  if (cfgOriginal) {
    const cfg = await migrarEsquemaIdentidad(cfgOriginal);
    configCache = cfg;

    // Migra silenciosamente dispositivos que ya habían elegido “yo” o “pareja”.
    obtenerMiembroActual(cfg);

    if (!localStorage.getItem('miembroActualId')) {
      mostrarModalIdentificacion(cfg);
    } else {
      iniciarApp(cfg);
    }
  } else {
    ocultarSplash();
    openAjustesModal();
  }
}

function mostrarModalIdentificacion(cfg) {
  ocultarSplash();
  const normalizada = normalizarConfigIdentidad(cfg);
  configCache = normalizada;
  const overlay = document.getElementById('identidad-overlay');
  if (!overlay) return;

  const principal = normalizada.miembros[normalizada.miembroPrincipalId];
  const pareja = normalizada.miembros[normalizada.miembroParejaId];
  document.getElementById('identidad-nombre-yo').textContent = principal.nombre;
  document.getElementById('identidad-nombre-ella').textContent = pareja.nombre;
  document.getElementById('identidad-avatar-yo').textContent = principal.nombre.slice(0,2).toUpperCase();
  document.getElementById('identidad-avatar-ella').textContent = pareja.nombre.slice(0,2).toUpperCase();
  document.getElementById('identidad-hogar-nombre').textContent = normalizada.nombreHogar;
  overlay.style.display = 'flex';
}

function establecerIdentidad(tipo) {
  definirIdentidad(tipo);
}

function vibrar() {
  if (navigator.vibrate) {
    navigator.vibrate(10); // Una vibración casi imperceptible de 10ms
  }
}

const FCM_VAPID_KEY = 'BJ2hOCo0ghqObiVlmWBrGd0QXux17QV8bzk6KxjT-1MwOhmPJHXCD3ArCbR_NeaSj2aFPr_jcQI7iyBdD_O_hl8';
let messagingServiceWorkerRegistration = null;

function obtenerIdDispositivo() {
  let id = localStorage.getItem('hogarDispositivoId');
  if (!id) {
    const aleatorio = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    id = `disp_${aleatorio.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    localStorage.setItem('hogarDispositivoId', id);
  }
  return id;
}

function detectarPlataforma() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function estaEnModoInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://');
}

function nombrePredeterminadoDispositivo() {
  const plataforma = detectarPlataforma();
  const perfil = obtenerMiembroActual(configCache || {});
  const propietario = perfil?.nombre || 'Hogar';
  if (plataforma === 'ios') return `iPhone de ${propietario}`;
  if (plataforma === 'android') return `Android de ${propietario}`;
  return `Navegador de ${propietario}`;
}

function capacidadesNotificaciones() {
  const plataforma = detectarPlataforma();
  const instalada = estaEnModoInstalado();
  const compatible = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && firebase?.messaging?.isSupported?.() !== false;
  const requiereInstalacion = plataforma === 'ios' && !instalada;
  return { plataforma, instalada, compatible, requiereInstalacion };
}

async function registrarServiceWorkerMensajeria() {
  if (!('serviceWorker' in navigator)) return null;
  if (messagingServiceWorkerRegistration) return messagingServiceWorkerRegistration;
  try {
    messagingServiceWorkerRegistration = await navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    return messagingServiceWorkerRegistration;
  } catch (error) {
    console.error('❌ No se pudo registrar el service worker:', error);
    return null;
  }
}

async function guardarDispositivo(token = null, cambios = {}) {
  if (!DB.hogarId) return false;
  const cfg = normalizarConfigIdentidad(configCache || await DB.getConfig() || {});
  const miembro = obtenerMiembroActual(cfg);
  if (!miembro) return false;
  const dispositivoId = obtenerIdDispositivo();
  const preferenciasGuardadas = JSON.parse(localStorage.getItem('preferenciasNotificaciones') || '{}');
  return DB.saveDispositivo(dispositivoId, {
    miembroId: miembro.id,
    usuario: miembro.legacyTipo,
    nombre: cambios.nombre || localStorage.getItem('nombreDispositivo') || nombrePredeterminadoDispositivo(),
    plataforma: detectarPlataforma(),
    tipoInstalacion: estaEnModoInstalado() ? 'pwa' : 'navegador',
    token: token || null,
    notificacionesActivas: Notification.permission === 'granted' && !!token,
    preferencias: {
      movimientos: preferenciasGuardadas.movimientos !== false,
      vencimientos: preferenciasGuardadas.vencimientos !== false,
      presupuesto: preferenciasGuardadas.presupuesto !== false,
      estadosCuenta: preferenciasGuardadas.estadosCuenta !== false,
      ...cambios.preferencias
    },
    userAgent: navigator.userAgent,
    authUid: auth.currentUser?.uid || null,
    ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function obtenerTokenMensajeria() {
  const registro = await registrarServiceWorkerMensajeria();
  if (!registro) throw new Error('No se pudo preparar el servicio de notificaciones.');
  const messaging = firebase.messaging();
  return messaging.getToken({ vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: registro });
}

async function sincronizarDispositivoSiAutorizado() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const token = await obtenerTokenMensajeria();
    if (token) await guardarDispositivo(token);
  } catch (error) {
    console.warn('No se pudo sincronizar el token autorizado:', error);
  }
}


let escuchaMensajesPrimerPlanoIniciada = false;
function iniciarEscuchaMensajesPrimerPlano() {
  if (escuchaMensajesPrimerPlanoIniciada || !firebase?.messaging) return;
  try {
    const messaging = firebase.messaging();
    messaging.onMessage(payload => {
      const data = payload?.data || {};
      showToast(`${data.title || 'Hogar Finanzas'}: ${data.body || 'Tienes una nueva notificación'}`);
    });
    escuchaMensajesPrimerPlanoIniciada = true;
  } catch (error) {
    console.warn('No se pudo iniciar la escucha de mensajes en primer plano:', error);
  }
}

async function probarNotificacionEnEsteDispositivo(pruebaEnSegundoPlano = false) {
  if (!hogarId || Notification.permission !== 'granted') {
    showToast('Primero activa las notificaciones en este dispositivo');
    return;
  }
  try {
    const cfg = normalizarConfigIdentidad(configCache || await DB.getConfig() || {});
    const miembro = obtenerMiembroActual(cfg);
    if (!miembro) throw new Error('No hay un perfil asociado a este dispositivo.');

    const dispositivoId = obtenerIdDispositivo();
    const dispositivoSnap = await db.collection('hogares').doc(hogarId)
      .collection('dispositivos').doc(dispositivoId).get();
    const dispositivo = dispositivoSnap.exists ? dispositivoSnap.data() : null;

    if (!dispositivo?.notificacionesActivas || !dispositivo?.token) {
      showToast('Este dispositivo no tiene un canal push activo. Los avisos internos seguirán disponibles al abrir la app.');
      await actualizarModalNotificaciones();
      return;
    }

    const retrasoSegundos = pruebaEnSegundoPlano ? 10 : 0;
    await db.collection('hogares').doc(hogarId).collection('notificaciones').add({
      titulo: pruebaEnSegundoPlano ? 'Prueba en segundo plano' : 'Prueba correcta',
      texto: pruebaEnSegundoPlano
        ? 'La notificación llegó con Hogar Finanzas cerrado o en segundo plano.'
        : 'Este dispositivo ya puede recibir avisos de Hogar Finanzas.',
      categoria: 'vencimientos',
      miembroDestino: miembro.id,
      usuarioDestino: miembro.legacyTipo,
      dispositivoDestino: dispositivoId,
      nombreDispositivoDestino: dispositivo.nombre || nombrePredeterminadoDispositivo(),
      retrasoSegundos,
      url: './index.html',
      tag: `${pruebaEnSegundoPlano ? 'prueba-fondo' : 'prueba'}-${dispositivoId}-${Date.now()}`,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      origen: pruebaEnSegundoPlano ? 'prueba-segundo-plano' : 'prueba-dispositivo'
    });

    if (pruebaEnSegundoPlano) {
      showToast(`Prueba programada para ${dispositivo.nombre || 'este dispositivo'}. Cierra la app ahora; llegará en unos 10 segundos.`);
      setTimeout(() => closeModal('notificacionesModal'), 900);
    } else {
      showToast(`Prueba enviada únicamente a ${dispositivo.nombre || 'este dispositivo'}.`);
    }
  } catch (error) {
    console.error('Error enviando prueba:', error);
    showToast('No se pudo enviar la prueba a este dispositivo');
  }
}
async function activarNotificacionesDesdeBoton() {
  const capacidades = capacidadesNotificaciones();
  if (!capacidades.compatible) {
    showToast('Este navegador no admite notificaciones web');
    actualizarModalNotificaciones();
    return;
  }
  if (capacidades.requiereInstalacion) {
    mostrarGuiaInstalacionIOS();
    return;
  }
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      showToast('El permiso no fue concedido');
      actualizarModalNotificaciones();
      return;
    }
    const token = await obtenerTokenMensajeria();
    if (!token) throw new Error('El dispositivo no devolvió un token.');
    const nombre = document.getElementById('notif-device-name')?.value.trim() || nombrePredeterminadoDispositivo();
    localStorage.setItem('nombreDispositivo', nombre);
    await guardarDispositivo(token, { nombre });
    iniciarEscuchaMensajesPrimerPlano();
    showToast('Notificaciones activadas en este dispositivo ✓');
    await actualizarModalNotificaciones();
  } catch (error) {
    console.error('Error activando notificaciones:', error);
    showToast(error?.name === 'AbortError' ? 'El servicio push del dispositivo no pudo registrarse. La app seguirá mostrando avisos internos.' : 'No se pudieron activar. Revisa el navegador y vuelve a intentar.');
    await actualizarModalNotificaciones();
  }
}

async function desactivarNotificacionesDispositivo() {
  try {
    const registro = await registrarServiceWorkerMensajeria();
    if (registro) {
      const messaging = firebase.messaging();
      const token = await messaging.getToken({ vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: registro }).catch(() => null);
      if (token) await messaging.deleteToken(token).catch(() => false);
    }
    await DB.updateDispositivo(obtenerIdDispositivo(), { token: null, notificacionesActivas: false, ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Notificaciones desactivadas para este dispositivo');
    await actualizarModalNotificaciones();
  } catch (error) {
    console.error(error);
    showToast('No se pudieron desactivar');
  }
}

async function configurarNotificaciones() {
  closeModal('ajustesModal');
  openModal('notificacionesModal');
  await actualizarModalNotificaciones();
}

function mostrarGuiaInstalacionIOS() {
  const guia = document.getElementById('notif-install-guide');
  if (guia) guia.classList.remove('hidden');
}

async function actualizarPreferenciasNotificaciones() {
  const preferencias = {
    movimientos: !!document.getElementById('notif-pref-movimientos')?.checked,
    vencimientos: !!document.getElementById('notif-pref-vencimientos')?.checked,
    presupuesto: !!document.getElementById('notif-pref-presupuesto')?.checked,
    estadosCuenta: !!document.getElementById('notif-pref-estados')?.checked
  };
  localStorage.setItem('preferenciasNotificaciones', JSON.stringify(preferencias));
  await guardarDispositivo(null, { preferencias });
}

async function actualizarNombreDispositivo() {
  const input = document.getElementById('notif-device-name');
  const nombre = input?.value.trim();
  if (!nombre) return;
  localStorage.setItem('nombreDispositivo', nombre);
  await guardarDispositivo(null, { nombre });
  showToast('Nombre del dispositivo actualizado');
}

async function actualizarModalNotificaciones() {
  const capacidades = capacidadesNotificaciones();
  const status = document.getElementById('notif-status');
  const detail = document.getElementById('notif-status-detail');
  const button = document.getElementById('notif-primary-btn');
  const disable = document.getElementById('notif-disable-btn');
  const guide = document.getElementById('notif-install-guide');
  const testButton = document.getElementById('notif-test-btn');
  const backgroundTestButton = document.getElementById('notif-test-background-btn');
  const nameInput = document.getElementById('notif-device-name');
  if (testButton) testButton.style.display = 'none';
  if (backgroundTestButton) backgroundTestButton.style.display = 'none';
  if (nameInput) nameInput.value = localStorage.getItem('nombreDispositivo') || nombrePredeterminadoDispositivo();

  const prefs = JSON.parse(localStorage.getItem('preferenciasNotificaciones') || '{}');
  const map = [['notif-pref-movimientos','movimientos'],['notif-pref-vencimientos','vencimientos'],['notif-pref-presupuesto','presupuesto'],['notif-pref-estados','estadosCuenta']];
  map.forEach(([id,key]) => { const el=document.getElementById(id); if(el) el.checked = prefs[key] !== false; });

  if (!capacidades.compatible) {
    status.textContent = 'No disponibles';
    detail.textContent = 'Este navegador no ofrece las funciones necesarias para recibir notificaciones.';
    button.style.display = 'none';
    disable.style.display = 'none';
  } else if (capacidades.requiereInstalacion) {
    status.textContent = 'Falta instalar la app';
    detail.textContent = 'En iPhone, las notificaciones solo funcionan desde la app agregada a la pantalla de inicio.';
    button.textContent = 'Ver cómo instalar';
    button.style.display = '';
    disable.style.display = 'none';
  } else if (Notification.permission === 'granted') {
    status.textContent = 'Activadas';
    detail.textContent = 'Este dispositivo puede recibir avisos aunque la aplicación esté cerrada.';
    button.textContent = 'Sincronizar nuevamente';
    button.style.display = '';
    disable.style.display = '';
    if (testButton) testButton.style.display = '';
    if (backgroundTestButton) backgroundTestButton.style.display = '';
    iniciarEscuchaMensajesPrimerPlano();
    await sincronizarDispositivoSiAutorizado();
  } else if (Notification.permission === 'denied') {
    status.textContent = 'Bloqueadas';
    detail.textContent = 'Actívalas desde los ajustes del navegador o del sistema y vuelve a abrir la aplicación.';
    button.style.display = 'none';
    disable.style.display = 'none';
  } else {
    status.textContent = 'No activadas';
    detail.textContent = 'Actívalas para recibir movimientos y recordatorios importantes.';
    button.textContent = 'Activar notificaciones';
    button.style.display = '';
    disable.style.display = 'none';
  }
  if (guide) guide.classList.toggle('hidden', !capacidades.requiereInstalacion);
}

async function openDispositivosRegistradosModal() {
  const lista = document.getElementById('lista-dispositivos');
  closeModal('hogarDispositivosModal');
  openModal('dispositivosRegistradosModal');
  lista.innerHTML = '<div class="empty-state">Cargando dispositivos…</div>';
  const dispositivos = await DB.getDispositivos();
  const cfg = normalizarConfigIdentidad(configCache || await DB.getConfig() || {});
  if (!dispositivos.length) {
    lista.innerHTML = '<div class="empty-state">Todavía no hay dispositivos registrados.</div>';
    return;
  }
  lista.innerHTML = dispositivos.map(d => {
    const miembro = cfg.miembros?.[d.miembroId];
    const actual = d.id === obtenerIdDispositivo();
    const estado = d.notificacionesActivas ? 'Notificaciones activas' : 'Sin notificaciones';
    return `<div class="registered-device-card">
      <div class="registered-device-icon">${d.plataforma === 'ios' ? '📱' : d.plataforma === 'android' ? '📲' : '💻'}</div>
      <div class="registered-device-copy"><strong>${escapeHTML(d.nombre || 'Dispositivo')}</strong><small>${escapeHTML(miembro?.nombre || 'Sin perfil')} · ${estado}${actual ? ' · Este dispositivo' : ''}</small></div>
      ${actual ? '<span class="current-device-badge">Actual</span>' : ''}
    </div>`;
  }).join('');
}
async function openAjustesModal() {
  const cfgGuardada = await DB.getConfig();
  const cfg = normalizarConfigIdentidad(cfgGuardada || {});
  configCache = cfg;

  const perfil = obtenerMiembroActual(cfg);
  const perfilNombre = document.getElementById('aj-perfil-nombre');
  const perfilRol = document.getElementById('aj-perfil-rol');
  const perfilAvatar = document.getElementById('aj-perfil-avatar');
  const hogarResumen = document.getElementById('aj-hogar-resumen');
  const ingresosResumen = document.getElementById('aj-ingresos-resumen');
  const dispositivosResumen = document.getElementById('aj-dispositivos-resumen');
  const notifResumen = document.getElementById('aj-notificaciones-resumen');

  if (perfilNombre) perfilNombre.textContent = perfil?.nombre || 'Sin vincular';
  if (perfilRol) perfilRol.textContent = perfil?.rol === 'administrador' ? 'Administrador del hogar' : 'Miembro del hogar';
  if (perfilAvatar) perfilAvatar.textContent = perfil?.nombre ? perfil.nombre.slice(0, 2).toUpperCase() : '👤';
  if (hogarResumen) hogarResumen.textContent = `${cfg.nombreYo || 'Christian'} y ${cfg.nombreElla || 'Sydney'}`;

  const totalFijo = (parseFloat(cfg.ingresoYo) || 0) + (parseFloat(cfg.ingresoElla) || 0);
  if (ingresosResumen) ingresosResumen.textContent = totalFijo > 0
    ? `S/ ${totalFijo.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} al mes`
    : 'Aún no hay ingresos mensuales configurados';
  if (dispositivosResumen) dispositivosResumen.textContent = DB.hogarId ? `Código ${DB.hogarId}` : 'Vincular otro dispositivo';

  if (notifResumen) {
    const cap = capacidadesNotificaciones();
    notifResumen.textContent = !cap.compatible ? 'No disponibles en este navegador'
      : cap.requiereInstalacion ? 'Instala la app en el iPhone'
      : Notification.permission === 'granted' ? 'Activadas en este dispositivo'
      : Notification.permission === 'denied' ? 'Bloqueadas en este dispositivo'
      : 'Configurar en este dispositivo';
  }

  openModal('ajustesModal');
}

async function obtenerConfigActualizada() {
  const guardada = await DB.getConfig();
  const cfg = normalizarConfigIdentidad(guardada || configCache || {});
  configCache = cfg;
  return cfg;
}

async function openIntegrantesModal() {
  const cfg = await obtenerConfigActualizada();
  document.getElementById('hogar-nombre').value = cfg.nombreHogar || `Hogar de ${cfg.nombreYo || 'Christian'} y ${cfg.nombreElla || 'Sydney'}`;
  document.getElementById('hogar-nombre-yo').value = cfg.nombreYo || '';
  document.getElementById('hogar-nombre-ella').value = cfg.nombreElla || '';
  closeModal('ajustesModal');
  openModal('integrantesModal');
}

async function guardarIntegrantes() {
  const nombreHogar = document.getElementById('hogar-nombre').value.trim();
  const nombreYo = document.getElementById('hogar-nombre-yo').value.trim();
  const nombreElla = document.getElementById('hogar-nombre-ella').value.trim();
  if (!nombreYo || !nombreElla) {
    alert('Ingresa el nombre de ambos integrantes.');
    return;
  }

  const anterior = await obtenerConfigActualizada();
  const principalId = anterior.miembroPrincipalId || crearIdMiembro(nombreYo, 'christian');
  const parejaId = anterior.miembroParejaId || crearIdMiembro(nombreElla, 'sydney');
  const cambios = normalizarConfigIdentidad({
    ...anterior,
    nombreHogar: nombreHogar || `Hogar de ${nombreYo} y ${nombreElla}`,
    nombreYo,
    nombreElla,
    miembros: {
      ...(anterior.miembros || {}),
      [principalId]: { ...(anterior.miembros?.[principalId] || {}), id: principalId, nombre: nombreYo, rol: 'administrador', legacyTipo: 'yo', activo: true },
      [parejaId]: { ...(anterior.miembros?.[parejaId] || {}), id: parejaId, nombre: nombreElla, rol: 'miembro', legacyTipo: 'pareja', activo: true }
    }
  });

  const saved = await DB.saveConfig(cambios);
  if (!saved) {
    alert('No se pudieron guardar los integrantes.');
    return;
  }
  configCache = cambios;
  actualizarNombresEnFormularios(cambios);
  actualizarNombresEnDeudas(cambios);
  aplicarNombres(cambios);
  closeModal('integrantesModal');
  showToast('Integrantes actualizados ✓');
  renderTodo();
}

async function openIngresosFijosModal() {
  const cfg = await obtenerConfigActualizada();
  const nombreYo = cfg.nombreYo || 'Christian';
  const nombreElla = cfg.nombreElla || 'Sydney';
  document.getElementById('if-nombre-yo').textContent = nombreYo;
  document.getElementById('if-nombre-ella').textContent = nombreElla;
  document.getElementById('if-avatar-yo').textContent = nombreYo.slice(0,2).toUpperCase();
  document.getElementById('if-avatar-ella').textContent = nombreElla.slice(0,2).toUpperCase();
  document.getElementById('if-ingreso-yo').value = Number(cfg.ingresoYo || 0);
  document.getElementById('if-ingreso-ella').value = Number(cfg.ingresoElla || 0);
  closeModal('ajustesModal');
  openModal('ingresosFijosModal');
}

async function guardarIngresosFijos() {
  const ingresoYo = Math.max(0, parseFloat(document.getElementById('if-ingreso-yo').value) || 0);
  const ingresoElla = Math.max(0, parseFloat(document.getElementById('if-ingreso-ella').value) || 0);
  const cfg = await obtenerConfigActualizada();
  const actualizado = await DB.updateConfig({ ingresoYo, ingresoElla });
  if (!actualizado) {
    alert('No se pudieron guardar los ingresos fijos.');
    return;
  }
  configCache = normalizarConfigIdentidad({ ...cfg, ...actualizado, ingresoYo, ingresoElla });
  closeModal('ingresosFijosModal');
  showToast('Ingresos fijos actualizados ✓');
  renderTodo();
}

async function openHogarDispositivosModal() {
  const displayId = document.getElementById('display-hogar-id');
  if (displayId) displayId.textContent = DB.hogarId || 'Sin código';
  const input = document.getElementById('join-id-input');
  if (input) input.value = '';
  closeModal('ajustesModal');
  openModal('hogarDispositivosModal');
}

function openDatosSeguridadModal() {
  closeModal('ajustesModal');
  openModal('datosSeguridadModal');
}

// Copia el código del hogar. En navegadores sin Clipboard API usa un método alternativo.
async function copyHogarId() {
  if (!DB.hogarId) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(DB.hogarId);
    } else {
      const temporal = document.createElement('textarea');
      temporal.value = DB.hogarId;
      temporal.style.position = 'fixed';
      temporal.style.opacity = '0';
      document.body.appendChild(temporal);
      temporal.select();
      document.execCommand('copy');
      temporal.remove();
    }
    showToast('Código copiado ✓');
  } catch (error) {
    console.error('No se pudo copiar el código:', error);
    showToast('Mantén pulsado el código para copiarlo');
  }
}

async function unirseAHogar() {
  const input = document.getElementById('join-id-input');
  const code = input.value.trim().toUpperCase();
  if (!code) {
    showToast('Ingresa el código del hogar');
    return;
  }
  if (confirm('¿Vincular este dispositivo a otro hogar? El hogar actual no se eliminará.')) {
    await DB.joinHogar(code);
  }
}

// Compatibilidad con llamadas antiguas: guarda únicamente nombres e ingresos si aún existe algún formulario legado.
async function guardarAjustes() {
  const nombreYoEl = document.getElementById('aj-nombre-yo');
  const nombreEllaEl = document.getElementById('aj-nombre-ella');
  if (!nombreYoEl || !nombreEllaEl) {
    showToast('Los ajustes ahora se guardan por sección');
    return;
  }
}

let gastosRealtimeUnsubscribe = null;
const arrastresVerificadosEnSesion = new Set();
let renderTodoEnCurso = false;
let renderTodoPendiente = false;

async function iniciarApp(cfg) {
  aplicarNombres(cfg);
  actualizarNombresEnFormularios(cfg);   // si ya la tienes
  actualizarNombresEnDeudas(cfg);        // ← Nueva línea
  actualizarMesBtn();
  await renderTodo();
  sincronizarDispositivoSiAutorizado();
  iniciarEscuchaNotificaciones();

  // Mantener una sola escucha activa. La primera instantánea solo confirma el estado
  // que acabamos de cargar y no necesita provocar un segundo renderizado.
  if (typeof gastosRealtimeUnsubscribe === 'function') {
    gastosRealtimeUnsubscribe();
  }
  let primeraInstantanea = true;
  gastosRealtimeUnsubscribe = db.collection("hogares").doc(hogarId).collection("gastos")
    .onSnapshot(() => {
      if (primeraInstantanea) {
        primeraInstantanea = false;
        return;
      }
      console.log("🔄 Cambio detectado en la nube, actualizando...");
      renderTodo();
    });
}

// Se llama al cargar la app para ver si ya sabemos quién es el usuario
function revisarIdentidad() {
  // La verificación principal ocurre después de cargar la configuración.
  // Aquí solo migramos la selección local de versiones anteriores.
  const legacy = localStorage.getItem('miUsuarioTipo');
  if (!localStorage.getItem('miembroActualId') && legacy && Object.keys(configCache || {}).length) {
    const cfg = normalizarConfigIdentidad(configCache);
    guardarPerfilDispositivo(legacy === 'pareja' ? cfg.miembroParejaId : cfg.miembroPrincipalId, cfg);
  }
}

function definirIdentidad(tipoOMiembroId) {
  const cfg = normalizarConfigIdentidad(configCache || {});
  const miembroId = tipoOMiembroId === 'pareja'
    ? cfg.miembroParejaId
    : tipoOMiembroId === 'yo'
      ? cfg.miembroPrincipalId
      : tipoOMiembroId;

  if (!guardarPerfilDispositivo(miembroId, cfg)) {
    showToast('No se pudo vincular este dispositivo');
    return;
  }

  const overlay = document.getElementById('identidad-overlay');
  if (overlay) overlay.style.display = 'none';
  const miembro = cfg.miembros[miembroId];
  showToast(`Dispositivo vinculado a ${miembro.nombre} ✓`);
  iniciarApp(cfg);
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
  const miembroActual = obtenerMiembroActual(cfg);
  const miTipo = miembroActual?.legacyTipo || localStorage.getItem('miUsuarioTipo') || 'yo';
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

  // Actualizar solo los elementos que existan en la vista actual.
  // Algunos labels fueron retirados del Inicio en la etapa 4.
  const textos = {
    'label-yo': nombreYo,
    'label-yo-2': nombreYo,
    'label-ella': nombreElla,
    'label-ella-2': nombreElla,
    'avatarYo': nombreYo.slice(0, 2).toUpperCase(),
    'avatarElla': nombreElla.slice(0, 2).toUpperCase()
  };

  Object.entries(textos).forEach(([id, texto]) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
  });
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
  if (!confirm('¿Cambiar el perfil vinculado a este dispositivo? Los datos del hogar no se borrarán.')) return;
  localStorage.removeItem('miembroActualId');
  localStorage.removeItem('miUsuarioTipo');
  localStorage.removeItem('perfilDispositivoConfigurado');
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

  // 2. Botón flotante contextual: una acción principal por sección
  actualizarFabContextual(id);

  // 3. UX de navegación: Volver al inicio del scroll al cambiar de pestaña
  window.scrollTo({ top: 0, behavior: 'instant' });

  // 4. Los datos ya están sincronizados en memoria. Cambiar de pestaña no debe
  // volver a consultar Firebase ni reconstruir todos los KPI y gráficos.
}

const FAB_CONFIG = {
  resumen: {
    label: 'Registrar ingreso',
    color: '#2563eb',
    action: () => openIngresoExtraModal()
  },
  gastos: {
    label: 'Agregar gasto',
    color: '#2563eb',
    action: () => openModal('gastoChoiceModal')
  },
  deudas: {
    label: 'Nueva deuda',
    color: '#dc2626',
    action: () => openModal('deudaChoiceModal')
  },
  ahorro: {
    label: 'Nueva meta',
    color: '#059669',
    action: () => openModal('metaModal')
  }
};

function actualizarFabContextual(tab = activeTab) {
  const fab = document.getElementById('fab-global');
  const config = FAB_CONFIG[tab];
  if (!fab || !config) return;

  fab.style.display = 'flex';
  fab.style.backgroundColor = config.color;
  fab.dataset.label = config.label;
  fab.setAttribute('aria-label', config.label);
  fab.setAttribute('title', config.label);
}

function handleFabClick() {
  vibrar();
  const config = FAB_CONFIG[activeTab];
  if (config) config.action();
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
  // Evita renderizados superpuestos cuando una escritura local y Firestore
  // notifican el mismo cambio casi al mismo tiempo.
  if (renderTodoEnCurso) {
    renderTodoPendiente = true;
    return;
  }
  renderTodoEnCurso = true;

  try {
    mostrarSkeletons();

  const kpiIds = ['kpi-disponible', 'kpi-credito-mes', 'kpi-ahorro-real', 'kpi-deuda-total', 'kpi-pago-mensual', 'kpi-fondo'];
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
  
  if (!arrastresVerificadosEnSesion.has(mesActual)) {
    await DB.generarArrastreSiNecesario(mesActual);
    arrastresVerificadosEnSesion.add(mesActual);
  }

  const ingresosMes = await DB.getIngresosMes(mesActual);
  const ingresoTotal = ingresosMes.reduce((sum, ing) => sum + (parseFloat(ing.monto) || 0), 0);

  const gastosConsumo = Array.isArray(gastos) ? gastos.filter(g => !esPagoDeuda(g)) : [];
  const pagosDeuda = Array.isArray(gastos) ? gastos.filter(esPagoDeuda) : [];
  const gastoTotal = gastosConsumo.reduce((a,g) => a + (Number(g.monto)||0), 0);

  // El efectivo disponible sí disminuye por consumos pagados y por pagos de deudas.
  const gastosEfectivoConsumo = gastosConsumo
    .filter(g => g.medio !== 'tarjeta')
    .reduce((a,g) => a + (Number(g.monto)||0), 0);
  const pagosDeudaEfectivo = pagosDeuda.reduce((a,g) => a + (Number(g.monto)||0), 0);
  const gastosEfectivo = gastosEfectivoConsumo + pagosDeudaEfectivo;

  // Compras con crédito del mes: solo consumos nuevos, nunca pagos de deuda.
  const gastosTarjeta = gastosConsumo
    .filter(g => g.medio === 'tarjeta')
    .reduce((a,g) => a + (Number(g.monto)||0), 0);

  const gastoEntret = Array.isArray(gastos) ? gastos.filter(g => g.cat === 'Entret.').reduce((a,g) => a + (g.monto||0), 0) : 0;
  
  const disponible = ingresoTotal - gastosEfectivo;
  const ahorroEstimado = Math.max(0, disponible);

  const fondoReservado = metas.reduce((a, m) => a + (parseFloat(m.actual) || 0), 0);
  setVal('kpi-disponible', `S/ ${disponible.toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  setVal('kpi-credito-mes', `S/ ${gastosTarjeta.toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  setVal('kpi-ahorro-real', `S/ ${fondoReservado.toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  setVal('kpi-ahorro2', `S/ ${fondoReservado.toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  setVal('kpi-ahorro2-sub', 'Total reservado en metas');

  const deudaTotal = [...tarjetas, ...prestamos].reduce((a, d) => a + (parseFloat(d.deuda || d.saldo) || 0), 0);
  const pagoPrestamos = prestamos.reduce((s,p) => s + (parseFloat(p.cuota) || 0), 0);
  const minimosInformados = tarjetas.reduce((s,t) => s + (Number(t.estadoCuenta?.pagoMinimo) || 0), 0);
  const pagoMensual = pagoPrestamos + minimosInformados;

  setVal('kpi-deuda-total', `S/ ${deudaTotal.toLocaleString()}`);
  setVal('kpi-pago-mensual', `S/ ${pagoMensual.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
  setVal('kpi-pago-sub', minimosInformados > 0
    ? `Cuotas + S/ ${minimosInformados.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})} en mínimos`
    : 'Cuotas de préstamos; mínimos aún no informados');

  const fondoTotal = fondoReservado;
  setVal('kpi-fondo', `S/ ${fondoTotal.toLocaleString()}`);

  renderGastos(gastos, cfg);
  renderResumenClaro({ gastos: gastosConsumo, tarjetas, prestamos, metas, cfg, ingresoTotal, gastoTotal, gastosEfectivo, gastosTarjeta, disponible });
  renderEstadoFinanciero(tarjetas);
  renderTarjetas(tarjetas, cfg);
  renderPrestamos(prestamos, cfg);
  renderMetas(metas);
  await renderCharts(gastosConsumo, cfg, tarjetas, prestamos, ingresoTotal, 0);
  renderDistribucion(ingresoTotal, gastoTotal, gastoEntret, ahorroEstimado, deudaTotal, 0);
  renderPresupuesto(gastosConsumo, cfg, tarjetas, prestamos, ingresoTotal, ahorroEstimado, 0);
  renderAlertas(tarjetas, prestamos, gastoTotal, ingresoTotal);

    console.log(`Renderizado completado - Ingresos: ${ingresoTotal} | Disponible: ${disponible} | Crédito del mes: ${gastosTarjeta}`);
  } catch (error) {
    console.error('Error al renderizar la aplicación:', error);
    if (typeof showToast === 'function') {
      showToast('Ocurrió un error al cargar algunos datos. Revisa la consola.');
    }
  } finally {
    ocultarSplash();
    renderTodoEnCurso = false;
    if (renderTodoPendiente) {
      renderTodoPendiente = false;
      queueMicrotask(() => renderTodo());
    }
  }
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
  const badgeMovimiento = esPagoDeuda(g) ? `<span class="expense-badge-debt">Pago de deuda · no suma al consumo</span>` : '';

  return `
  <div class="expense-item" data-id="${g.id}">
    <div class="expense-swipe-wrap">
      <div class="expense-item-inner">
        <div class="expense-icon">${g.icono || '📦'}</div>
        <div class="expense-info">
          <div class="expense-name">${g.desc}</div>
          <div class="expense-cat"><span class="expense-cat-text">${g.cat}</span><span class="expense-cat-date"> · ${fechaStr}</span></div>
          ${badgeTarjeta}
          ${badgeMovimiento}
        </div>
        <div class="expense-right">
          <div class="expense-amount">S/ ${g.monto}</div>
          <span class="expense-who">${quienLabel}</span>
        </div>
        <div class="expense-more-wrap">
          <button class="expense-more-btn" onclick="toggleExpenseMenu(event, 'expense-menu-${g.id}')" aria-label="Opciones de ${g.desc}">⋮</button>
          <div class="expense-more-menu" id="expense-menu-${g.id}">
            ${esPagoDeuda(g)
              ? `<span class="expense-menu-note">${g.tipoMovimiento === 'pagoPrestamo' ? 'Pago de préstamo' : 'Pago de tarjeta'}</span>`
              : `<button onclick="abrirEditarGasto('${g.id}')">Editar</button>`}
            <button class="danger" onclick="eliminarGasto('${g.id}')">Eliminar</button>
          </div>
        </div>
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
let filtroGastosActivo = 'todos';

function setFiltroGastos(filtro, boton) {
  filtroGastosActivo = filtro;
  document.querySelectorAll('.expense-filter').forEach(b => b.classList.remove('active'));
  if (boton) boton.classList.add('active');
  renderGastos(gastosDelMesCache, configCache || {});
}

function aplicarFiltroGastos(lista) {
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - ((hoy.getDay()+6)%7));
  if (filtroGastosActivo === 'yo' || filtroGastosActivo === 'pareja') return lista.filter(g => g.quien === filtroGastosActivo);
  if (filtroGastosActivo === 'hoy') return lista.filter(g => g.fecha === hoy.toISOString().slice(0,10));
  if (filtroGastosActivo === 'semana') return lista.filter(g => { const d = fechaLocalISO(g.fecha); return d && d >= inicioSemana && d <= hoy; });
  return lista;
}

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

  const gastosFiltrados = aplicarFiltroGastos(gastosDelMesCache);
  if (gastosFiltrados.length === 0) {
    el.innerHTML = '<div class="empty-state">No hay movimientos para este filtro.</div>';
    return;
  }

  // Tomamos solo los primeros 5 para la vista principal
  const resumen = gastosFiltrados.slice(0, 5);
  
  let html = resumen.map(g => generarGastoHTML(g, cfg)).join('');

  // Si hay más de 5, añadimos el botón "Ver todo"
  if (gastosFiltrados.length > 5) {
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

function obtenerEstadoTarjeta(uso) {
  if (uso > 1) return { clave:'excedida', etiqueta:'Excedida', clase:'danger' };
  if (uso === 1) return { clave:'limite', etiqueta:'Al límite', clase:'danger' };
  if (uso >= 0.8) return { clave:'alta', etiqueta:'Alta utilización', clase:'warning' };
  if (uso >= 0.5) return { clave:'atencion', etiqueta:'Atención', clase:'caution' };
  return { clave:'saludable', etiqueta:'Saludable', clase:'success' };
}

function renderResumenClaro({ gastos, tarjetas, prestamos, metas, cfg, ingresoTotal, gastoTotal, gastosEfectivo, gastosTarjeta, disponible }) {
  const moneda = n => `S/ ${(parseFloat(n) || 0).toLocaleString('es-PE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  const pctConsumido = ingresoTotal > 0 ? Math.round((gastosEfectivo / ingresoTotal) * 100) : 0;
  const estadoEl = document.getElementById('estado-mes');
  if (estadoEl) {
    let tono = 'good', titulo = 'Vamos bien', texto = 'Todavía hay margen para los gastos del mes.';
    if (disponible < 0) { tono = 'danger'; titulo = 'Gastamos más de lo ingresado'; texto = `Faltan ${moneda(Math.abs(disponible))} para cubrir los pagos realizados.`; }
    else if (pctConsumido >= 85) { tono = 'warning'; titulo = 'Debemos cuidar los gastos'; texto = `Ya utilizamos el ${pctConsumido}% del dinero disponible del mes.`; }
    else if (pctConsumido >= 65) { tono = 'caution'; titulo = 'Vamos ajustados'; texto = `Queda ${moneda(disponible)} para el resto del mes.`; }
    else if (ingresoTotal > 0) {
      const hoy = new Date();
      const diasTranscurridos = Math.max(1, hoy.getDate());
      const diasMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate();
      const proyeccion = gastosEfectivo / diasTranscurridos * diasMes;
      const cierreEstimado = ingresoTotal - proyeccion;
      texto = cierreEstimado >= 0
        ? `Al ritmo actual podrías cerrar el mes con ${moneda(cierreEstimado)} libres.`
        : `Al ritmo actual faltarían ${moneda(Math.abs(cierreEstimado))} al cierre del mes.`;
    }
    estadoEl.innerHTML = `<div class="month-status-card ${tono}"><div class="month-status-eyebrow">Estado del mes</div><div class="month-status-title">${titulo}</div><div class="month-status-text">${texto}</div><div class="month-status-progress"><span style="width:${Math.min(100, Math.max(0, pctConsumido))}%"></span></div><div class="month-status-foot"><span>${pctConsumido}% utilizado</span><span>${moneda(disponible)} disponible</span></div></div>`;
  }

  const atencion = [];
  tarjetas.forEach(t => {
    const deuda = parseFloat(t.deuda) || 0, limite = parseFloat(t.limite) || 0;
    const uso = limite > 0 ? deuda / limite : 0;
    const dias = diasHastaFechaMensual(t.vence || t.diaCierre || t.cierre);
    if (deuda > limite && limite > 0) atencion.push({nivel:'danger', titulo:`${t.nombre} está excedida`, detalle:`Supera el límite por ${moneda(deuda-limite)}.`});
    else if (uso >= .8) atencion.push({nivel:'warning', titulo:`${t.nombre} necesita atención`, detalle:`Está usando el ${Math.round(uso*100)}% de su línea.`});
    if (deuda > 0 && dias !== null && dias <= 5) atencion.push({nivel:'info', titulo:`Pago próximo: ${t.nombre}`, detalle:dias === 0 ? 'Vence hoy.' : `Vence en ${dias} día${dias===1?'':'s'}.`});
  });
  if (disponible < 0) atencion.unshift({nivel:'danger', titulo:'Dinero del mes insuficiente', detalle:`El faltante actual es ${moneda(Math.abs(disponible))}.`});
  else if (ingresoTotal > 0 && gastosEfectivo / ingresoTotal >= .8) atencion.unshift({nivel:'warning', titulo:'Presupuesto casi consumido', detalle:`Solo queda ${moneda(disponible)} del dinero ingresado.`});
  const attEl = document.getElementById('necesita-atencion');
  const conteoAtencion = atencion.reduce((acc, item) => { acc[item.nivel] = (acc[item.nivel] || 0) + 1; return acc; }, {});
  const attSection = document.getElementById('atencion-section');
  if (attEl) attEl.innerHTML = atencion.length ? atencion.slice(0,4).map(x=>`<div class="attention-item ${x.nivel}"><div><strong>${x.titulo}</strong><span>${x.detalle}</span></div></div>`).join('') : '<div class="attention-empty">No hay alertas importantes por ahora.</div>';
  if (attSection) attSection.style.display = '';

  const porCategoria = {};
  (gastos || []).forEach(g => porCategoria[g.cat || 'Otros'] = (porCategoria[g.cat || 'Otros'] || 0) + (parseFloat(g.monto)||0));
  const categorias = Object.entries(porCategoria).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const max = categorias[0]?.[1] || 1;
  const catEl = document.getElementById('categorias-resumen');
  if (catEl) catEl.innerHTML = categorias.length ? categorias.map(([cat,monto])=>`<div class="category-row"><div class="category-row-head"><span>${cat}</span><strong>${moneda(monto)}</strong></div><div class="category-row-track"><span style="width:${Math.max(4, Math.round(monto/max*100))}%"></span></div></div>`).join('') : '<div class="empty-state">Todavía no hay gastos registrados este mes.</div>';

  const nombres = [cfg.nombreYo || 'Tú', cfg.nombreElla || 'Pareja'];
  const totales = [0,0];
  (gastos || []).forEach(g => { if (g.quien === 'yo') totales[0] += parseFloat(g.monto)||0; else if (g.quien === 'pareja') totales[1] += parseFloat(g.monto)||0; else if (g.quien === 'ambos') { totales[0] += (parseFloat(g.monto)||0)/2; totales[1] += (parseFloat(g.monto)||0)/2; } });
  const totalMiembros = totales[0] + totales[1];
  const partEl = document.getElementById('participacion-hogar');
  if (partEl) partEl.innerHTML = nombres.map((nombre,i)=>{ const pct=totalMiembros>0?Math.round(totales[i]/totalMiembros*100):0; return `<div class="participation-row"><div><strong>${nombre}</strong><span>${moneda(totales[i])} registrado</span></div><div class="participation-pct">${pct}%</div></div>`; }).join('') + (gastosTarjeta>0 ? `<div class="participation-note">De los gastos del mes, ${moneda(gastosTarjeta)} fueron compras con tarjeta de crédito.</div>` : '');
}

function renderEstadoFinanciero(tarjetas) {
  const el = document.getElementById('estado-financiero');
  if (!el) return;
  if (!tarjetas.length) { el.innerHTML = ''; return; }

  const resumen = { excedida:0, limite:0, alta:0, atencion:0, saludable:0 };
  tarjetas.forEach(t => {
    const limite = parseFloat(t.limite) || 0;
    const deuda = parseFloat(t.deuda) || 0;
    const uso = limite > 0 ? deuda / limite : 0;
    resumen[obtenerEstadoTarjeta(uso).clave]++;
  });

  const riesgo = resumen.excedida + resumen.limite + resumen.alta;
  const titulo = resumen.excedida > 0
    ? `${resumen.excedida} tarjeta${resumen.excedida === 1 ? '' : 's'} excedida${resumen.excedida === 1 ? '' : 's'}`
    : riesgo > 0
      ? `${riesgo} tarjeta${riesgo === 1 ? '' : 's'} requieren atención`
      : 'Tus tarjetas están controladas';

  el.innerHTML = `
    <details class="financial-health-details">
      <summary class="financial-health-card">
        <div class="financial-health-main">
          <div>
            <div class="financial-health-label">Estado de tarjetas</div>
            <div class="financial-health-title">${titulo}</div>
          </div>
          <span class="financial-health-toggle" aria-hidden="true">Ver detalle</span>
        </div>
        <div class="financial-health-chips">
          ${resumen.excedida ? `<span class="health-chip health-danger">${resumen.excedida} excedida${resumen.excedida===1?'':'s'}</span>` : ''}
          ${resumen.limite ? `<span class="health-chip health-danger">${resumen.limite} al límite</span>` : ''}
          ${resumen.alta ? `<span class="health-chip health-warning">${resumen.alta} alta utilización</span>` : ''}
          ${resumen.atencion ? `<span class="health-chip health-caution">${resumen.atencion} atención</span>` : ''}
          ${resumen.saludable ? `<span class="health-chip health-success">${resumen.saludable} saludable${resumen.saludable===1?'':'s'}</span>` : ''}
        </div>
      </summary>
      <div id="alertas-deuda" class="financial-health-content"></div>
    </details>`;
}

function toggleDebtDetails(event, cardId) {
  event?.stopPropagation();
  const card = document.getElementById(cardId);
  if (!card) return;
  const open = card.classList.toggle('expanded');
  const btn = card.querySelector('.debt-details-toggle');
  if (btn) btn.textContent = open ? 'Ocultar' : 'Detalles';
}

/* ── RENDER TARJETAS (VERSIÓN ACTUALIZADA) ── */

function proximaFechaMensual(dia) {
  const numeroDia = parseInt(dia, 10);
  if (!numeroDia || numeroDia < 1 || numeroDia > 31) return null;

  const ahora = new Date();
  const crearFechaValida = (anio, mes) => {
    const ultimoDia = new Date(anio, mes + 1, 0).getDate();
    return new Date(anio, mes, Math.min(numeroDia, ultimoDia), 12, 0, 0, 0);
  };

  let fecha = crearFechaValida(ahora.getFullYear(), ahora.getMonth());
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 12, 0, 0, 0);

  if (fecha < hoy) {
    const siguiente = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
    fecha = crearFechaValida(siguiente.getFullYear(), siguiente.getMonth());
  }

  return fecha;
}

function diasHastaFechaMensual(dia) {
  const fecha = proximaFechaMensual(dia);
  if (!fecha) return null;
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12, 0, 0, 0);
  return Math.round((fecha - inicioHoy) / 86400000);
}

function etiquetaFechaTarjeta(dia, tipo) {
  const dias = diasHastaFechaMensual(dia);
  if (dias === null) return '';

  let texto = '';
  if (dias === 0) texto = `${tipo} hoy`;
  else if (dias === 1) texto = `${tipo} mañana`;
  else texto = `${tipo} en ${dias} días`;

  const clase = dias <= 2 ? 'urgent' : dias <= 5 ? 'soon' : 'normal';
  return `<span class="card-date-chip ${clase}">${texto}</span>`;
}

function formatoSoles(valor) {
  return `S/ ${(Number(valor)||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

function diasHastaFechaISO(fechaISO) {
  if (!fechaISO) return null;
  const [y,m,d] = fechaISO.split('-').map(Number);
  const objetivo = new Date(y,m-1,d,12);
  const hoy = new Date();
  const base = new Date(hoy.getFullYear(),hoy.getMonth(),hoy.getDate(),12);
  return Math.round((objetivo-base)/86400000);
}

function prioridadTarjeta(t) {
  const deuda=Number(t.deuda)||0, limite=Number(t.limite)||0;
  const ec=t.estadoCuenta||{};
  const dias=diasHastaFechaISO(ec.fechaVencimiento);
  if (limite>0 && deuda>limite) return {nivel:0,clase:'critical',texto:'Excedida'};
  if (dias!==null && dias<0 && (Number(ec.pagoTotal)||Number(ec.pagoMinimo))) return {nivel:0,clase:'critical',texto:'Vencida'};
  if (dias!==null && dias<=3) return {nivel:1,clase:'urgent',texto:dias===0?'Vence hoy':`Vence en ${dias} días`};
  if (limite>0 && deuda/limite>=.8) return {nivel:2,clase:'warning',texto:'Uso alto'};
  if (dias!==null && dias<=7) return {nivel:3,clase:'soon',texto:`Vence en ${dias} días`};
  return {nivel:4,clase:'normal',texto:'Al día'};
}

let estadoCuentaTarjetaId = null;
async function abrirEstadoCuenta(id) {
  cerrarMenusDeuda();
  const t=(await DB.getTarjetas()).find(x=>x.id===id);
  if(!t) return;
  estadoCuentaTarjetaId=id;
  const ec=t.estadoCuenta||{};
  document.getElementById('estado-cuenta-tarjeta').textContent=t.nombre;
  document.getElementById('ec-minimo').value=ec.pagoMinimo ?? '';
  document.getElementById('ec-total').value=ec.pagoTotal ?? '';
  document.getElementById('ec-fecha').value=ec.fechaEstado || '';
  document.getElementById('ec-vence').value=ec.fechaVencimiento || '';
  document.getElementById('ec-periodo').value=ec.periodo || '';
  openModal('estadoCuentaModal');
}

async function guardarEstadoCuenta() {
  if(!estadoCuentaTarjetaId) return;
  const minimo=document.getElementById('ec-minimo').value;
  const total=document.getElementById('ec-total').value;
  const fechaEstado=document.getElementById('ec-fecha').value;
  const fechaVencimiento=document.getElementById('ec-vence').value;
  const periodo=document.getElementById('ec-periodo').value.trim();
  if(!minimo && !total){ alert('Ingresa el pago mínimo o el pago total informado por el banco.'); return; }
  const tarjetas=await DB.getTarjetas();
  const actual=tarjetas.find(t=>t.id===estadoCuentaTarjetaId);
  const anterior=actual?.estadoCuenta;
  const historial=[...(actual?.historialEstados||[])];
  if(anterior && (anterior.pagoMinimo!=null || anterior.pagoTotal!=null)) historial.unshift(anterior);
  await DB.updateTarjeta(estadoCuentaTarjetaId,{
    estadoCuenta:{pagoMinimo:minimo===''?null:Number(minimo),pagoTotal:total===''?null:Number(total),fechaEstado,fechaVencimiento,periodo,actualizadoEn:new Date().toISOString()},
    historialEstados:historial.slice(0,24), actualizadoEn:new Date().toISOString()
  });
  closeModal('estadoCuentaModal');
  showToast('Estado de cuenta actualizado');
  renderTodo();
}

function renderTarjetas(tarjetas, cfg) {
  const el = document.getElementById('tarjetas-grid');
  tarjetas = [...tarjetas].sort((a, b) => {
    const diasA = diasHastaFechaMensual(a.vence);
    const diasB = diasHastaFechaMensual(b.vence);
    if (diasA === null && diasB === null) return 0;
    if (diasA === null) return 1;
    if (diasB === null) return -1;
    return diasA - diasB;
  });
  if (!el) return;

  if (tarjetas.length === 0) {
    el.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Sin tarjetas registradas. Presiona "+ Agregar".</div>';
    return;
  }

   // ✅ ORDENAR: de mayor a menor porcentaje de utilización (riesgo)
  const ordenadas = [...tarjetas].sort((a,b) => prioridadTarjeta(a).nivel - prioridadTarjeta(b).nivel);

  const nombreYo = cfg.nombreYo || 'Christian';
  const nombreElla = cfg.nombreElla || 'Sydney';

  let html = '';
  ordenadas.forEach(t => {
    const deuda = parseFloat(t.deuda) || 0;
    const limite = parseFloat(t.limite) || 0;
    const disponible = limite - deuda;
    const exceso = Math.max(0, deuda - limite);
    const uso = limite > 0 ? Math.round((deuda / limite) * 100) : 0;
    const anchoBarra = Math.min(100, Math.max(0, uso));
    const color = uso >= 100 ? '#c43030' : uso > 80 ? '#c43030' : uso > 60 ? '#b06a10' : '#2a7de1';
    const estado = obtenerEstadoTarjeta(limite > 0 ? deuda / limite : 0);
    const prioridad = prioridadTarjeta(t);
    const ec = t.estadoCuenta || {};
    const pendienteConciliar = t.pendienteConciliar === true || t.saldoEstimado === true;
    const ultimaConciliacion = t.ultimaConciliacion
      ? new Date(t.ultimaConciliacion).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
      : '';

    // Determinar nombre correcto
    let quienTexto = '';
    if (t.quien === 'yo') quienTexto = nombreYo.toUpperCase();
    else if (t.quien === 'pareja') quienTexto = nombreElla.toUpperCase();
    else quienTexto = 'COMPARTIDA';

    html += `
      <div class="debt-card collapsible" id="tarjeta-card-${t.id}">
        <div class="debt-more-wrap">
          <button class="debt-more-btn" aria-label="Opciones de ${t.nombre}" onclick="toggleDebtMenu(event, 'tarjeta-menu-${t.id}')">⋮</button>
          <div class="debt-more-menu" id="tarjeta-menu-${t.id}">
            <button onclick="abrirEditarTarjeta('${t.id}', '${escapeInlineString(t.nombre)}', ${deuda}, ${limite}, '${t.cierre || ''}', '${t.vence || ''}', '${t.quien || 'yo'}')">Editar</button>
            <button class="danger" onclick="eliminarTarjeta('${t.id}')">Eliminar</button>
          </div>
        </div>
        <div class="debt-type">TARJETA · ${quienTexto}</div>
        <div class="debt-name-row"><div class="debt-name">${t.nombre}</div><span class="priority-badge ${prioridad.clase}">${prioridad.texto}</span></div>
        
        <div class="debt-label-main">Deuda actual</div>
        <div class="debt-total" style="color:${deuda > limite && limite > 0 ? '#c43030' : 'var(--text)'}">
          S/ ${deuda.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
        </div>
        <div class="statement-summary ${ec.pagoMinimo==null && ec.pagoTotal==null ? 'empty' : ''}">
          ${ec.pagoMinimo!=null || ec.pagoTotal!=null ? `
            <div><small>Pago mínimo informado</small><strong>${ec.pagoMinimo!=null ? formatoSoles(ec.pagoMinimo) : 'No informado'}</strong></div>
            <div><small>Pago total del estado</small><strong>${ec.pagoTotal!=null ? formatoSoles(ec.pagoTotal) : 'No informado'}</strong></div>
            <span>${ec.periodo || 'Periodo no indicado'}${ec.fechaVencimiento ? ` · vence ${new Date(ec.fechaVencimiento+'T12:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short'})}` : ''}</span>` : `
            <span>Sin estado de cuenta registrado. Añádelo para conocer el mínimo real y su vencimiento.</span>`}
        </div>
        <div class="debt-sub debt-card-details">
          <span>Línea: S/ ${limite.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          <span style="color:${disponible < 0 ? '#c43030' : 'var(--text3)'}">Disponible: ${disponible < 0 ? '− ' : ''}S/ ${Math.abs(disponible).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          <span>Cierre: día ${t.cierre||'—'} · Vence: día ${t.vence||'—'}</span>
        </div>
        <div class="card-date-status">
          ${etiquetaFechaTarjeta(t.vence, 'Vence')}
          ${etiquetaFechaTarjeta(t.cierre, 'Cierra')}
        </div>
        ${pendienteConciliar
          ? `<div class="reconcile-status pending">
              <span>Saldo estimado</span>
              <small>Pendiente de conciliar con el banco</small>
            </div>`
          : ultimaConciliacion
            ? `<div class="reconcile-status reconciled">
                <span>Saldo conciliado</span>
                <small>Última conciliación: ${ultimaConciliacion}</small>
              </div>`
            : `<div class="reconcile-status neutral">
                <span>Sin conciliación registrada</span>
                <small>Usa “Conciliar” para verificar el saldo del banco</small>
              </div>`}
        ${exceso > 0 ? `
          <div class="credit-overflow compact">
            <span>⚠ Exceso: S/ ${exceso.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
            <small>Te faltan S/ ${exceso.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} para volver al límite.</small>
          </div>` : ''}
        <div class="credit-line-visual" aria-label="${uso}% de la línea utilizada">
          <div class="credit-line-track">
            <div class="credit-line-fill" style="width:${anchoBarra}%; background:${color};"></div>
            <span class="credit-line-limit" aria-hidden="true"></span>
          </div>
          <div class="credit-line-labels">
            <span>${uso}% utilizado</span>
            <span>Límite S/ ${limite.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          </div>
        </div>
        <div class="debt-card-actions compact-actions">
          <button class="debt-details-toggle" onclick="toggleDebtDetails(event, 'tarjeta-card-${t.id}')">Detalles</button>
          <button class="debt-action-primary" onclick="abrirPagoTarjeta('${t.id}', '${escapeInlineString(t.nombre)}', ${deuda})">Pagar</button>
          <button class="debt-action-statement" onclick="abrirEstadoCuenta('${t.id}')">Estado</button>
          <button class="debt-action-secondary" onclick="abrirAjusteTarjeta('${t.id}', '${escapeInlineString(t.nombre)}', ${deuda}, ${limite})">Conciliar</button>
          <button class="debt-action-history" onclick="abrirHistorialTarjeta('${t.id}', '${escapeInlineString(t.nombre)}')">Historial</button>
        </div>
      </div>`;
  });
  el.innerHTML = html;
}

function esPagoDeuda(g) {
  return g?.tipoMovimiento === 'pagoTarjeta' || g?.tipoMovimiento === 'pagoPrestamo';
}

function fechaLocalISO(fecha) {
  if (!fecha) return null;
  const d = new Date(`${fecha}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diasHastaFecha(fecha) {
  const destino = fechaLocalISO(fecha);
  if (!destino) return null;
  const hoy = new Date();
  hoy.setHours(12,0,0,0);
  return Math.ceil((destino - hoy) / 86400000);
}

function avanzarVencimiento(fecha, frecuencia='mensual') {
  const d = fechaLocalISO(fecha) || new Date();
  if (frecuencia === 'semanal') d.setDate(d.getDate() + 7);
  else if (frecuencia === 'quincenal') d.setDate(d.getDate() + 15);
  else d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function estadoPrestamo(p) {
  const saldo = Number(p.saldo) || 0;
  if (saldo <= 0) return { nivel: 5, clase: 'paid', texto: 'Pagado' };
  const dias = diasHastaFecha(p.proximoVencimiento);
  if (dias !== null && dias < 0) return { nivel: 0, clase: 'critical', texto: 'Vencido' };
  if (dias === 0) return { nivel: 1, clase: 'critical', texto: 'Vence hoy' };
  if (dias !== null && dias <= 5) return { nivel: 2, clase: 'warning', texto: `Vence en ${dias} d` };
  if (dias !== null && dias <= 12) return { nivel: 3, clase: 'attention', texto: 'Próximo' };
  return { nivel: 4, clase: 'ok', texto: p.proximoVencimiento ? 'Al día' : 'Sin fecha' };
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
  const ordenados = [...prestamos].sort((a,b) => estadoPrestamo(a).nivel - estadoPrestamo(b).nivel);
  let html = '';

  ordenados.forEach(p => {
    let quienTexto = p.quien === 'yo' ? nombreYo.toUpperCase() : p.quien === 'pareja' ? nombreElla.toUpperCase() : 'COMPARTIDO';
    const saldo = Number(p.saldo) || 0;
    const cuota = Number(p.cuota) || 0;
    const pagadas = Number(p.pagadas) || 0;
    const total = Number(p.total) || 0;
    const progreso = total > 0 ? Math.min(100, Math.round((pagadas / total) * 100)) : 0;
    const estado = estadoPrestamo(p);
    const vencimiento = p.proximoVencimiento
      ? new Date(`${p.proximoVencimiento}T12:00:00`).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'})
      : 'No informado';

    html += `
      <div class="debt-card loan-card collapsible ${estado.clase}" id="prestamo-card-${p.id}">
        <div class="debt-more-wrap">
          <button class="debt-more-btn" aria-label="Opciones de ${p.nombre}" onclick="toggleDebtMenu(event, 'prestamo-menu-${p.id}')">⋮</button>
          <div class="debt-more-menu" id="prestamo-menu-${p.id}">
            <button onclick="abrirEditarPrestamo('${p.id}', '${escapeInlineString(p.nombre)}', ${saldo}, ${cuota}, ${pagadas}, ${total}, '${p.quien || 'yo'}', '${p.proximoVencimiento || ''}', '${p.frecuencia || 'mensual'}')">Editar</button>
            <button onclick="abrirHistorialPrestamo('${p.id}', '${escapeInlineString(p.nombre)}', ${saldo})">Historial</button>
            <button class="danger" onclick="eliminarPrestamo('${p.id}')">Eliminar</button>
          </div>
        </div>
        <div class="debt-type">PRÉSTAMO · ${quienTexto}</div>
        <div class="loan-status-row"><span class="debt-status ${estado.clase}">${estado.texto}</span><span>Vence: ${vencimiento}</span></div>
        <div class="debt-name">${p.nombre}</div>
        <div class="debt-total">S/ ${saldo.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="debt-sub">Cuota: S/ ${cuota.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})} · ${pagadas}/${total || '?'} cuotas</div>
        <div class="debt-prog-bg"><div class="debt-prog-fill" style="width:${progreso}%; background:#3e7d2a;"></div></div>
        <div class="debt-hint">${progreso}% del plan completado</div>
        <div class="debt-card-actions">
          <button class="debt-details-toggle" onclick="toggleDebtDetails(event, 'prestamo-card-${p.id}')">Detalles</button>
          <button class="debt-action-primary" onclick="abrirPagoPrestamo('${p.id}', '${escapeInlineString(p.nombre)}', ${saldo}, ${cuota}, '${p.proximoVencimiento || ''}', '${p.frecuencia || 'mensual'}', '${p.quien || 'yo'}')">Pagar cuota</button>
          <button class="debt-action-history" onclick="abrirHistorialPrestamo('${p.id}', '${escapeInlineString(p.nombre)}', ${saldo})">Historial</button>
        </div>
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
          <div class="saving-goal-head"><div class="saving-pct">${progreso}% completado</div><strong>${progreso >= 100 ? 'Meta cumplida' : `Faltan S/ ${Math.max(0,(Number(m.objetivo)||0)-(Number(m.actual)||0)).toLocaleString('es-PE')}`}</strong></div>
          <div class="saving-bar-bg"><div class="saving-bar" style="width:${Math.min(100,progreso)}%; background:${colors.fill};"></div></div>
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
let gastoEditandoId = null;
let gastoOriginalEditando = null;

function cerrarMenusGasto() {
  document.querySelectorAll('.expense-more-menu.open').forEach(menu => menu.classList.remove('open'));
}

function toggleExpenseMenu(event, menuId) {
  event.stopPropagation();
  const menu = document.getElementById(menuId);
  const estabaAbierto = menu?.classList.contains('open');
  cerrarMenusGasto();
  if (menu && !estabaAbierto) menu.classList.add('open');
}

document.addEventListener('click', cerrarMenusGasto);

function seleccionarCategoriaGasto(categoria) {
  const chips = document.querySelectorAll('#cat-chips .chip');
  chips.forEach(chip => {
    const coincide = chip.textContent.includes(categoria);
    chip.classList.toggle('selected', coincide);
  });
  if (![...chips].some(chip => chip.classList.contains('selected')) && chips[0]) {
    chips[0].classList.add('selected');
  }
}

async function abrirEditarGasto(id) {
  cerrarMenusGasto();
  const gasto = gastosDelMesCache.find(g => g.id === id);
  if (!gasto) {
    alert('No se encontró el movimiento.');
    return;
  }

  gastoEditandoId = id;
  gastoOriginalEditando = { ...gasto };

  document.getElementById('g-desc').value = gasto.desc || '';
  document.getElementById('g-monto').value = parseFloat(gasto.monto) || 0;
  document.getElementById('g-fecha').value = gasto.fecha || new Date().toISOString().split('T')[0];
  document.getElementById('g-quien').value = gasto.quien || 'yo';
  document.getElementById('g-medio').value = gasto.medio || 'efectivo';
  seleccionarCategoriaGasto(gasto.cat || 'Otros');

  const checkRecurrente = document.getElementById('checkRecurrente');
  if (checkRecurrente) checkRecurrente.checked = false;
  const recurrenteBox = document.getElementById('gasto-recurrente-box');
  if (recurrenteBox) recurrenteBox.style.display = 'none';

  document.getElementById('gasto-modal-title').textContent = 'Editar gasto';
  document.getElementById('gasto-submit-btn').textContent = 'Guardar cambios';

  tarjetasCacheGasto = await DB.getTarjetas();
  const select = document.getElementById('g-tarjeta-id');
  if (select) {
    select.innerHTML = tarjetasCacheGasto.length
      ? tarjetasCacheGasto.map(t => {
          const disponible = (parseFloat(t.limite) || 0) - (parseFloat(t.deuda) || 0);
          const estado = disponible < 0
            ? `excedida por S/ ${Math.abs(disponible).toLocaleString()}`
            : `S/ ${disponible.toLocaleString()} disponible`;
          return `<option value="${t.id}" data-disponible="${disponible}">${t.nombre} · ${estado}</option>`;
        }).join('')
      : '<option value="">— No hay tarjetas registradas —</option>';
    if (gasto.tarjetaId) select.value = gasto.tarjetaId;
  }

  toggleSelectorTarjeta();
  actualizarInfoTarjeta();
  openModal('gastoModal');
}

async function openGastoModal() {
  gastoEditandoId = null;
  gastoOriginalEditando = null;
  document.getElementById('gasto-modal-title').textContent = 'Agregar gasto detallado';
  document.getElementById('gasto-submit-btn').textContent = 'Agregar gasto';
  const recurrenteBox = document.getElementById('gasto-recurrente-box');
  if (recurrenteBox) recurrenteBox.style.display = '';

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

  // Restablecer categoría predeterminada.
  const chipsCategoria = document.querySelectorAll('#cat-chips .chip');
  chipsCategoria.forEach(c => c.classList.remove('selected'));
  if (chipsCategoria[0]) chipsCategoria[0].classList.add('selected');

  // Un gasto nuevo no debe heredar la recurrencia del registro anterior.
  const checkRecurrente = document.getElementById('checkRecurrente');
  if (checkRecurrente) checkRecurrente.checked = false;

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

  // Mostrar todas las tarjetas, incluso si superaron su línea de crédito.
  if (tarjetasCacheGasto.length === 0) {
    select.innerHTML = '<option value="">— No hay tarjetas registradas —</option>';
  } else {
    select.innerHTML = tarjetasCacheGasto.map(t => {
      const disponible = (parseFloat(t.limite) || 0) - (parseFloat(t.deuda) || 0);
      const estado = disponible < 0
        ? `excedida por S/ ${Math.abs(disponible).toLocaleString()}`
        : `S/ ${disponible.toLocaleString()} disponible`;
      return `<option value="${t.id}" data-disponible="${disponible}">
        ${t.nombre} · ${estado}
      </option>`;
    }).join('');
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
  infoEl.textContent = disponible >= 0
    ? `Crédito disponible: S/ ${disponible.toLocaleString()}`
    : `Tarjeta excedida por S/ ${Math.abs(disponible).toLocaleString()}. El gasto se registrará igualmente.`;
  infoEl.style.color = disponible < 0 ? '#c43030' : 'var(--text3)';
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

async function ajustarDeudaPorEdicionGasto(gastoAnterior, gastoNuevo) {
  const tarjetas = await DB.getTarjetas();
  const cambios = new Map();

  const acumular = (tarjetaId, delta) => {
    if (!tarjetaId || !delta) return;
    cambios.set(tarjetaId, (cambios.get(tarjetaId) || 0) + delta);
  };

  // Revertir el efecto anterior.
  if (gastoAnterior?.medio === 'tarjeta' && gastoAnterior.tarjetaId) {
    acumular(gastoAnterior.tarjetaId, -(parseFloat(gastoAnterior.monto) || 0));
  }

  // Aplicar el nuevo efecto.
  if (gastoNuevo?.medio === 'tarjeta' && gastoNuevo.tarjetaId) {
    acumular(gastoNuevo.tarjetaId, parseFloat(gastoNuevo.monto) || 0);
  }

  for (const [tarjetaId, delta] of cambios.entries()) {
    const tarjeta = tarjetas.find(t => t.id === tarjetaId);
    if (!tarjeta) continue;
    const nuevaDeuda = Math.max(0, (parseFloat(tarjeta.deuda) || 0) + delta);
    await DB.updateTarjeta(tarjetaId, {
      deuda: nuevaDeuda,
      saldoEstimado: true,
      pendienteConciliar: true,
      actualizadoEn: new Date().toISOString()
    });
  }
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
  }

  const cat = Object.keys(CATS).find(c => catEl && catEl.textContent.includes(c)) || 'Otros';
  const icono = CATS[cat] ? CATS[cat].icon : '📦';
  const datos = {
    desc,
    monto,
    quien,
    cat,
    icono,
    fecha,
    medio,
    tarjetaId: tarjetaSeleccionada?.id || null,
    tarjetaNombre: tarjetaSeleccionada?.nombre || null,
    actualizadoEn: new Date().toISOString()
  };

  if (gastoEditandoId) {
    const actualizado = await DB.updateGasto(gastoEditandoId, datos);
    if (!actualizado) {
      alert('No se pudo actualizar el gasto.');
      return;
    }

    await ajustarDeudaPorEdicionGasto(gastoOriginalEditando, datos);
    closeModal('gastoModal');
    showToast('Gasto actualizado correctamente ✓');
    gastoEditandoId = null;
    gastoOriginalEditando = null;
    renderTodo();
    return;
  }

  const nuevoGasto = await DB.addGasto({
    ...datos,
    creadoEn: new Date().toISOString()
  });

  const esRecurrente = document.getElementById('checkRecurrente')?.checked;
  if (esRecurrente && nuevoGasto) {
    await DB.addRecurrente({ ...nuevoGasto, fecha: nuevoGasto.fecha });
  }

  if (nuevoGasto && tarjetaSeleccionada) {
    const nuevaDeuda = (parseFloat(tarjetaSeleccionada.deuda) || 0) + monto;
    await DB.updateTarjeta(tarjetaSeleccionada.id, {
      deuda: nuevaDeuda,
      saldoEstimado: true,
      pendienteConciliar: true,
      actualizadoEn: new Date().toISOString()
    });
  }

  if (nuevoGasto) {
    closeModal('gastoModal');
    limpiarVoucher();
    showToast(
      esRecurrente
        ? 'Gasto agregado y programado cada mes ✓'
        : tarjetaSeleccionada
          ? `Gasto con ${tarjetaSeleccionada.nombre} registrado ✓`
          : 'Gasto agregado correctamente ✓'
    );
    document.getElementById('g-desc').value = '';
    document.getElementById('g-monto').value = '';
    renderTodo();
    seleccionarCategoriaGasto('Alimentación');
  }
}

/* Tarjetas */
let tarjetaEditandoId = null;
let prestamoEditandoId = null;

function limpiarFormularioTarjeta() {
  tarjetaEditandoId = null;
  document.getElementById('t-nombre').value = '';
  document.getElementById('t-deuda').value = '';
  document.getElementById('t-limite').value = '';
  document.getElementById('t-cierre').value = '';
  document.getElementById('t-vence').value = '';
  document.getElementById('t-quien').value = 'yo';
  ['t-pago-minimo','t-pago-total','t-estado-vence','t-periodo'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
  document.getElementById('tarjeta-modal-title').textContent = 'Nueva tarjeta de crédito';
  document.getElementById('tarjeta-submit-btn').textContent = 'Guardar tarjeta';
}

function abrirNuevaTarjeta() {
  limpiarFormularioTarjeta();
  openModal('tarjetaModal');
}

async function abrirEditarTarjeta(id, nombre, deuda, limite, cierre, vence, quien) {
  cerrarMenusDeuda();
  tarjetaEditandoId = id;
  document.getElementById('t-nombre').value = nombre;
  document.getElementById('t-deuda').value = deuda;
  document.getElementById('t-limite').value = limite;
  document.getElementById('t-cierre').value = cierre;
  document.getElementById('t-vence').value = vence;
  document.getElementById('t-quien').value = quien || 'yo';
  const tarjeta = (await DB.getTarjetas()).find(x => x.id === id);
  const ec = tarjeta?.estadoCuenta || {};
  document.getElementById('t-pago-minimo').value = ec.pagoMinimo ?? '';
  document.getElementById('t-pago-total').value = ec.pagoTotal ?? '';
  document.getElementById('t-estado-vence').value = ec.fechaVencimiento || '';
  document.getElementById('t-periodo').value = ec.periodo || '';
  document.getElementById('tarjeta-modal-title').textContent = 'Editar tarjeta';
  document.getElementById('tarjeta-submit-btn').textContent = 'Guardar cambios';
  openModal('tarjetaModal');
}

async function agregarTarjeta() {
  const nombre = document.getElementById('t-nombre').value.trim();
  const deuda = parseFloat(document.getElementById('t-deuda').value) || 0;
  const limite = parseFloat(document.getElementById('t-limite').value) || 0;
  const cierre = document.getElementById('t-cierre').value || '';
  const vence = document.getElementById('t-vence').value || '';
  const quien = document.getElementById('t-quien').value;
  const pagoMinimoRaw = document.getElementById('t-pago-minimo')?.value;
  const pagoTotalRaw = document.getElementById('t-pago-total')?.value;
  const estadoVence = document.getElementById('t-estado-vence')?.value || '';
  const periodo = document.getElementById('t-periodo')?.value.trim() || '';

  if (!nombre) {
    alert('Escribe el nombre de la tarjeta');
    return;
  }

  const datos = {
    nombre, deuda, limite, cierre, vence, quien,
    estadoCuenta: (pagoMinimoRaw || pagoTotalRaw || estadoVence || periodo) ? {
      pagoMinimo: pagoMinimoRaw === '' ? null : Number(pagoMinimoRaw),
      pagoTotal: pagoTotalRaw === '' ? null : Number(pagoTotalRaw),
      fechaVencimiento: estadoVence, periodo, actualizadoEn: new Date().toISOString()
    } : null,
    actualizadoEn: new Date().toISOString()
  };

  if (tarjetaEditandoId) {
    await DB.updateTarjeta(tarjetaEditandoId, datos);
    showToast('Tarjeta actualizada correctamente');
  } else {
    await DB.addTarjeta(datos);
    showToast('Tarjeta guardada correctamente');
  }

  closeModal('tarjetaModal');
  limpiarFormularioTarjeta();
  renderTodo();
}

function limpiarFormularioPrestamo() {
  prestamoEditandoId = null;
  document.getElementById('p-nombre').value = '';
  document.getElementById('p-saldo').value = '';
  document.getElementById('p-cuota').value = '';
  document.getElementById('p-pagadas').value = '';
  document.getElementById('p-total').value = '';
  document.getElementById('p-quien').value = 'yo';
  document.getElementById('p-proximo-vencimiento').value = '';
  document.getElementById('p-frecuencia').value = 'mensual';
  document.getElementById('prestamo-modal-title').textContent = 'Nuevo préstamo';
  document.getElementById('prestamo-submit-btn').textContent = 'Guardar préstamo';
}

function abrirNuevoPrestamo() {
  limpiarFormularioPrestamo();
  openModal('prestamoModal');
}

function abrirEditarPrestamo(id, nombre, saldo, cuota, pagadas, total, quien, proximoVencimiento='', frecuencia='mensual') {
  cerrarMenusDeuda();
  prestamoEditandoId = id;
  document.getElementById('p-nombre').value = nombre;
  document.getElementById('p-saldo').value = saldo;
  document.getElementById('p-cuota').value = cuota;
  document.getElementById('p-pagadas').value = pagadas;
  document.getElementById('p-total').value = total;
  document.getElementById('p-quien').value = quien || 'yo';
  document.getElementById('p-proximo-vencimiento').value = proximoVencimiento || '';
  document.getElementById('p-frecuencia').value = frecuencia || 'mensual';
  document.getElementById('prestamo-modal-title').textContent = 'Editar préstamo';
  document.getElementById('prestamo-submit-btn').textContent = 'Guardar cambios';
  openModal('prestamoModal');
}

async function agregarPrestamo() {
  const nombre = document.getElementById('p-nombre').value.trim();
  const saldo = parseFloat(document.getElementById('p-saldo').value) || 0;
  const cuota = parseFloat(document.getElementById('p-cuota').value) || 0;
  const pagadas = parseInt(document.getElementById('p-pagadas').value) || 0;
  const total = parseInt(document.getElementById('p-total').value) || 0;
  const quien = document.getElementById('p-quien').value;
  const proximoVencimiento = document.getElementById('p-proximo-vencimiento').value;
  const frecuencia = document.getElementById('p-frecuencia').value || 'mensual';

  if (!nombre) {
    alert('Escribe el nombre del préstamo');
    return;
  }

  const datos = {
    nombre, saldo, cuota, pagadas, total, quien, proximoVencimiento, frecuencia,
    actualizadoEn: new Date().toISOString()
  };

  if (prestamoEditandoId) {
    await DB.updatePrestamo(prestamoEditandoId, datos);
    showToast('Préstamo actualizado correctamente');
  } else {
    await DB.addPrestamo(datos);
    showToast('Préstamo guardado correctamente');
  }

  closeModal('prestamoModal');
  limpiarFormularioPrestamo();
  renderTodo();
}

function cerrarMenusDeuda() {
  document.querySelectorAll('.debt-more-menu.open').forEach(menu => menu.classList.remove('open'));
}

function toggleDebtMenu(event, menuId) {
  event.stopPropagation();
  const menu = document.getElementById(menuId);
  const estabaAbierto = menu?.classList.contains('open');
  cerrarMenusDeuda();
  if (menu && !estabaAbierto) menu.classList.add('open');
}

document.addEventListener('click', cerrarMenusDeuda);

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
  const gasto = gastosDelMesCache.find(g => g.id === id);

  showConfirm({
    icon: '🗑️',
    title: '¿Eliminar gasto?',
    msg: gasto?.medio === 'tarjeta'
      ? 'El gasto será eliminado y la deuda estimada de la tarjeta se ajustará.'
      : 'El gasto será eliminado permanentemente.',
    labelOk: 'Sí, eliminar',
    danger: true,
    onOk: async () => {
      if (gasto?.tarjetaId) {
        const tarjetas = await DB.getTarjetas();
        const tarjeta = tarjetas.find(t => t.id === gasto.tarjetaId);
        if (tarjeta) {
          let nuevaDeuda;
          if (gasto.tipoMovimiento === 'pagoTarjeta') {
            nuevaDeuda = (parseFloat(tarjeta.deuda) || 0) + (parseFloat(gasto.monto) || 0);
          } else if (gasto.medio === 'tarjeta') {
            nuevaDeuda = Math.max(0, (parseFloat(tarjeta.deuda) || 0) - (parseFloat(gasto.monto) || 0));
          }
          if (nuevaDeuda !== undefined) {
            await DB.updateTarjeta(gasto.tarjetaId, {
              deuda: nuevaDeuda,
              saldoEstimado: true,
              pendienteConciliar: true,
              actualizadoEn: new Date().toISOString()
            });
          }
        }
      }

      if (gasto?.tipoMovimiento === 'pagoPrestamo' && gasto.prestamoId) {
        const prestamos = await DB.getPrestamos();
        const prestamo = prestamos.find(p => p.id === gasto.prestamoId);
        if (prestamo) {
          await DB.revertirPagoPrestamo(gasto.prestamoId, gasto.pagoRegistroId, {
            saldo: (Number(prestamo.saldo)||0) + (Number(gasto.monto)||0),
            pagadas: Math.max(0, (Number(prestamo.pagadas)||0) - (gasto.cuotaMarcada ? 1 : 0)),
            proximoVencimiento: gasto.proximoVencimientoAnterior || prestamo.proximoVencimiento || ''
          });
        }
      }

      await DB.deleteGasto(id);
      gastosDelMesCache = gastosDelMesCache.filter(g => g.id !== id);

      const el = document.querySelector(`.expense-item[data-id="${id}"]`);
      if (el) el.remove();

      const listaFull = document.getElementById('listaCompletaGastos');
      const modalHistorialOpen = document.getElementById('modalHistorial')?.classList.contains('open');
      if (listaFull && modalHistorialOpen) {
        listaFull.innerHTML = gastosDelMesCache.map(g => generarGastoHTML(g, configCache)).join('');
        setTimeout(initGesturesModal, 50);
      }

      showToast('Gasto eliminado ✓');
      renderTodo();
    }
  });
}

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

let ingresoEditandoId = null;
let ingresosManualCache = [];

function limpiarFormularioIngreso() {
  ingresoEditandoId = null;
  document.getElementById('ie-desc').value = '';
  document.getElementById('ie-monto').value = '';
  document.getElementById('ie-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('ie-quien').value = localStorage.getItem('miUsuarioTipo') || 'yo';
  document.getElementById('ingreso-modal-title').textContent = 'Registrar ingreso extra';
  document.getElementById('ingreso-submit-btn').textContent = 'Agregar ingreso';
}

function openIngresoExtraModal() {
  limpiarFormularioIngreso();
  openModal('ingresoExtraModal');
}

function abrirEditarIngreso(id) {
  const ingreso = ingresosManualCache.find(i => i.id === id);
  if (!ingreso) {
    alert('No se encontró el ingreso.');
    return;
  }

  ingresoEditandoId = id;
  document.getElementById('ie-desc').value = ingreso.desc || '';
  document.getElementById('ie-monto').value = parseFloat(ingreso.monto) || 0;
  document.getElementById('ie-fecha').value = ingreso.fecha || new Date().toISOString().split('T')[0];
  document.getElementById('ie-quien').value = ingreso.quien || 'yo';
  document.getElementById('ingreso-modal-title').textContent = 'Editar ingreso';
  document.getElementById('ingreso-submit-btn').textContent = 'Guardar cambios';

  closeModal('gestionIngresosModal');
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

  const datos = {
    desc: desc || 'Ingreso',
    monto,
    quien,
    fecha,
    tipo: 'manual',
    actualizadoEn: new Date().toISOString()
  };

  if (ingresoEditandoId) {
    const actualizado = await DB.updateIngresoExtra(ingresoEditandoId, datos);
    if (!actualizado) {
      alert('No se pudo actualizar el ingreso.');
      return;
    }
    closeModal('ingresoExtraModal');
    showToast('Ingreso actualizado ✓');
    ingresoEditandoId = null;
    renderTodo();
    return;
  }

  await DB.addIngreso({
    ...datos,
    creadoEn: new Date().toISOString()
  });
  closeModal('ingresoExtraModal');
  showToast('Ingreso registrado ✓');
  renderTodo();
}

async function abrirGestionIngresos() {
  const lista = document.getElementById('lista-ingresos-manuales');
  lista.innerHTML = '<div class="empty-state">Cargando ingresos…</div>';
  openModal('gestionIngresosModal');

  const cfg = await DB.getConfig();
  const ingresos = await DB.getIngresosExtras(mesActual);
  ingresosManualCache = ingresos
    .filter(i => i.tipo === 'manual' || !i.tipo)
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

  const total = ingresosManualCache.reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);
  document.getElementById('ingresos-manuales-resumen').innerHTML = `
    <div><span>Registros</span><strong>${ingresosManualCache.length}</strong></div>
    <div><span>Total del mes</span><strong>S/ ${total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
  `;

  if (!ingresosManualCache.length) {
    lista.innerHTML = '<div class="empty-state">No hay ingresos manuales registrados este mes.</div>';
    return;
  }

  const nombreYo = cfg?.nombreYo || 'Tú';
  const nombreElla = cfg?.nombreElla || 'Pareja';

  lista.innerHTML = ingresosManualCache.map(i => {
    const quien = i.quien === 'pareja' ? nombreElla : i.quien === 'ambos' ? 'Ambos' : nombreYo;
    const fecha = i.fecha
      ? new Date(`${i.fecha}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Sin fecha';
    return `
      <div class="income-manage-item">
        <div class="income-manage-main">
          <strong>${i.desc || 'Ingreso'}</strong>
          <span>${fecha} · ${quien}</span>
        </div>
        <div class="income-manage-right">
          <strong>S/ ${(parseFloat(i.monto)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>
          <div class="income-manage-actions">
            <button onclick="abrirEditarIngreso('${i.id}')">Editar</button>
            <button class="danger" onclick="eliminarIngresoManual('${i.id}', '${escapeInlineString(i.desc || 'Ingreso')}')">Eliminar</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function eliminarIngresoManual(id, nombre) {
  if (!confirm(`¿Eliminar el ingreso “${nombre}”?`)) return;
  await DB.deleteIngresoExtra(id);
  showToast('Ingreso eliminado ✓');
  await abrirGestionIngresos();
  renderTodo();
}

let recurrentesCache = [];
let recurrenteEditandoId = null;

async function refrescarListaRecurrentes() {
  const recurrentes = await DB.getRecurrentes();
  recurrentesCache = recurrentes;
  const cfg = await DB.getConfig();
  const nombreYo = cfg?.nombreYo || 'Tú';
  const nombreElla = cfg?.nombreElla || 'Pareja';
  const contenedor = document.getElementById('lista-recurrentes');
  const resumen = document.getElementById('recurrentes-resumen');
  if (!contenedor) return;

  const ordenados = [...recurrentes].sort((a, b) => {
    if ((a.activo !== false) !== (b.activo !== false)) return a.activo === false ? 1 : -1;
    return (parseInt(a.dia) || 0) - (parseInt(b.dia) || 0);
  });

  const activos = ordenados.filter(r => r.activo !== false);
  const pausados = ordenados.filter(r => r.activo === false);
  const totalMensual = activos.reduce((suma, r) => suma + (parseFloat(r.monto) || 0), 0);

  if (resumen) {
    resumen.innerHTML = `
      <div><span>Activos</span><strong>${activos.length}</strong></div>
      <div><span>Pausados</span><strong>${pausados.length}</strong></div>
      <div><span>Total mensual</span><strong>S/ ${totalMensual.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
    `;
  }

  if (ordenados.length === 0) {
    contenedor.innerHTML = '<div class="empty-state">No hay gastos recurrentes configurados.</div>';
    return;
  }

  contenedor.innerHTML = ordenados.map(r => {
    const quien = r.quien === 'yo' ? nombreYo : r.quien === 'pareja' ? nombreElla : 'Ambos';
    const activo = r.activo !== false;
    const medio = r.medio === 'tarjeta'
      ? `Tarjeta${r.tarjetaNombre ? ` · ${r.tarjetaNombre}` : ''}`
      : 'Efectivo / transferencia';

    return `
      <div class="recurring-item ${activo ? '' : 'paused'}">
        <div class="recurring-main">
          <div class="recurring-title-row">
            <strong>${r.icono || '🔄'} ${r.desc}</strong>
            <span class="recurring-status ${activo ? 'active' : 'paused'}">${activo ? 'Activo' : 'Pausado'}</span>
          </div>
          <span>${r.cat} · S/ ${(parseFloat(r.monto)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          <small>Día ${r.dia} de cada mes · ${quien} · ${medio}</small>
        </div>
        <div class="recurring-actions">
          <button onclick="abrirEditarRecurrente('${r.id}')">Editar</button>
          <button onclick="cambiarEstadoRecurrente('${r.id}', ${activo ? 'false' : 'true'})">${activo ? 'Pausar' : 'Reactivar'}</button>
          <button class="danger" onclick="eliminarRecurrente('${r.id}', '${escapeInlineString(r.desc)}')">Eliminar</button>
        </div>
      </div>`;
  }).join('');
}


async function abrirEditarRecurrente(id) {
  const recurrente = recurrentesCache.find(r => r.id === id);
  if (!recurrente) {
    alert('No se encontró el gasto recurrente.');
    return;
  }

  recurrenteEditandoId = id;
  document.getElementById('er-desc').value = recurrente.desc || '';
  document.getElementById('er-monto').value = parseFloat(recurrente.monto) || 0;
  document.getElementById('er-dia').value = parseInt(recurrente.dia) || 1;
  document.getElementById('er-quien').value = recurrente.quien || 'yo';
  document.getElementById('er-cat').value = recurrente.cat || 'Otros';
  document.getElementById('er-medio').value = recurrente.medio || 'efectivo';

  const tarjetas = await DB.getTarjetas();
  const select = document.getElementById('er-tarjeta');
  if (tarjetas.length) {
    select.innerHTML = tarjetas.map(t => {
      const deuda = parseFloat(t.deuda) || 0;
      const limite = parseFloat(t.limite) || 0;
      const disponible = limite - deuda;
      return `<option value="${t.id}" data-nombre="${escapeInlineString(t.nombre)}">${t.nombre} · S/ ${disponible.toFixed(2)} disponible</option>`;
    }).join('');
    if (recurrente.tarjetaId) select.value = recurrente.tarjetaId;
  } else {
    select.innerHTML = '<option value="">No hay tarjetas registradas</option>';
  }

  actualizarMedioRecurrente();
  closeModal('recurrentesModal');
  openModal('editarRecurrenteModal');
}

function actualizarMedioRecurrente() {
  const esTarjeta = document.getElementById('er-medio')?.value === 'tarjeta';
  const row = document.getElementById('er-tarjeta-row');
  if (row) row.style.display = esTarjeta ? 'block' : 'none';
}

async function guardarEdicionRecurrente() {
  const desc = document.getElementById('er-desc').value.trim();
  const monto = parseFloat(document.getElementById('er-monto').value);
  const dia = parseInt(document.getElementById('er-dia').value);
  const quien = document.getElementById('er-quien').value;
  const cat = document.getElementById('er-cat').value;
  const medio = document.getElementById('er-medio').value;
  const tarjetaSelect = document.getElementById('er-tarjeta');

  if (!desc || !Number.isFinite(monto) || monto <= 0) {
    alert('Completa una descripción y un monto válido.');
    return;
  }
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    alert('El día mensual debe estar entre 1 y 31.');
    return;
  }
  if (medio === 'tarjeta' && !tarjetaSelect?.value) {
    alert('Selecciona una tarjeta de crédito.');
    return;
  }

  const icono = CATS[cat]?.icon || '📦';
  const tarjetaOption = tarjetaSelect?.selectedOptions?.[0];
  const cambios = {
    desc,
    monto,
    dia,
    quien,
    cat,
    icono,
    medio,
    tarjetaId: medio === 'tarjeta' ? tarjetaSelect.value : null,
    tarjetaNombre: medio === 'tarjeta'
      ? (tarjetaOption?.dataset?.nombre || tarjetaOption?.textContent?.split(' · ')[0] || '')
      : null
  };

  const actualizado = await DB.updateRecurrente(recurrenteEditandoId, cambios);
  if (!actualizado) {
    alert('No se pudo actualizar el gasto recurrente.');
    return;
  }

  closeModal('editarRecurrenteModal');
  openModal('recurrentesModal');
  showToast('Gasto recurrente actualizado ✓');
  await refrescarListaRecurrentes();
}

function cancelarEdicionRecurrente() {
  closeModal('editarRecurrenteModal');
  openModal('recurrentesModal');
}

async function abrirGestionRecurrentes() {
  document.getElementById('lista-recurrentes').innerHTML = '<div class="empty-state">Cargando gastos recurrentes…</div>';
  openModal('recurrentesModal');
  await refrescarListaRecurrentes();
}

async function cambiarEstadoRecurrente(id, activo) {
  const actualizado = await DB.updateRecurrente(id, { activo });
  if (!actualizado) {
    alert('No se pudo actualizar el gasto recurrente.');
    return;
  }
  showToast(activo ? 'Gasto recurrente reactivado ✓' : 'Gasto recurrente pausado ✓');
  await refrescarListaRecurrentes();
}

async function eliminarRecurrente(id, nombre = '') {
  const mensaje = nombre
    ? `¿Eliminar el gasto recurrente “${nombre}”? Los movimientos ya registrados no se borrarán.`
    : '¿Eliminar este gasto recurrente? Los movimientos ya registrados no se borrarán.';
  if (!confirm(mensaje)) return;

  await DB.deleteRecurrente(id);
  showToast('Gasto recurrente eliminado ✓');
  await refrescarListaRecurrentes();
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
    const pagoMinTarjetas = 0; // Las tarjetas no tienen una cuota fija confiable.
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
      ...tarjetas.map(t => ['Tarjeta', t.nombre, t.deuda, t.limite, '', `${Math.round((t.deuda/t.limite)*100)}%`]),
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
      ['Pago fijo tarjetas', pagoMinTarjetas],
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

async function notificarAlOtro(mensaje, cfg, categoria = 'movimientos', url = './index.html') {
  if (!hogarId) return;
  const config = normalizarConfigIdentidad(cfg || configCache || await DB.getConfig() || {});
  const miembroActual = obtenerMiembroActual(config);
  if (!miembroActual) return;
  const miembroDestino = miembroActual.id === config.miembroPrincipalId ? config.miembroParejaId : config.miembroPrincipalId;
  const tipoDestino = miembroActual.legacyTipo === 'yo' ? 'pareja' : 'yo';

  try {
    await db.collection("hogares").doc(hogarId).collection("notificaciones").add({
      texto: mensaje,
      titulo: 'Hogar Finanzas',
      categoria,
      url,
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      miembroOrigen: miembroActual.id,
      miembroDestino,
      usuarioDestino: tipoDestino,
      usuarioId: auth.currentUser ? auth.currentUser.uid : 'anonimo'
    });
    console.log("📩 Solicitud de notificación enviada a Cloud Function");
  } catch (e) {
    console.error("Error al crear notificación:", e);
  }
}





/* ── FUNCIONES BASE RESTAURADAS ── */
function abrirAjusteTarjeta(id, nombre, deudaActual, limite) {
  tarjetaAjusteId = id;
  tarjetaAjusteNombre = nombre;
  tarjetaAjusteDeudaAnterior = parseFloat(deudaActual) || 0;
  tarjetaAjusteLimite = parseFloat(limite) || 0;
  const disponibleEstimado = tarjetaAjusteLimite - tarjetaAjusteDeudaAnterior;
  document.getElementById('ajuste-tarjeta-info').innerHTML = `
    <strong>${nombre}</strong>
    <span>Línea de crédito: S/ ${moneda2(tarjetaAjusteLimite)}</span>
    <span>Deuda registrada: S/ ${moneda2(tarjetaAjusteDeudaAnterior)}</span>
    <b>Disponible estimado: ${disponibleEstimado < 0 ? '− ' : ''}S/ ${moneda2(Math.abs(disponibleEstimado))}</b>`;
  const input = document.getElementById('ajuste-tarjeta-disponible');
  input.value = disponibleEstimado.toFixed(2);
  input.oninput = actualizarVistaConciliacion;
  openModal('ajusteTarjetaModal');
  actualizarVistaConciliacion();
  setTimeout(() => input.select(), 100);
}

async function abrirHistorialTarjeta(id, nombre) {
  document.getElementById('historial-tarjeta-titulo').textContent = nombre;
  document.getElementById('historial-tarjeta-resumen').innerHTML = 'Pagos y conciliaciones recientes';
  document.getElementById('historial-tarjeta-lista').innerHTML = '<div class="empty-state">Cargando historial…</div>';
  openModal('historialTarjetaModal');

  const [pagos, conciliaciones] = await Promise.all([
    DB.getPagosTarjeta(id, nombre),
    DB.getConciliacionesTarjeta(id)
  ]);

  const movimientos = [
    ...pagos.map(p => ({
      tipo: 'pago',
      fecha: p.fecha || p.creadoEn || '',
      titulo: 'Pago registrado',
      monto: parseFloat(p.monto) || 0,
      detalle: p.nota || p.desc?.replace(`Pago Tarjeta: ${p.tarjetaNombre || nombre}`, '').replace(/^\s*-\s*/, '') || ''
    })),
    ...conciliaciones.map(c => ({
      tipo: 'conciliacion',
      fecha: c.fecha || c.creadoEn || '',
      titulo: 'Saldo conciliado',
      monto: parseFloat(c.deudaCalculada) || 0,
      diferencia: parseFloat(c.diferencia) || 0,
      disponible: parseFloat(c.disponibleBanco) || 0
    }))
  ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  const totalPagado = pagos.reduce((suma, p) => suma + (parseFloat(p.monto) || 0), 0);
  const ultimaConciliacion = conciliaciones[0];
  document.getElementById('historial-tarjeta-resumen').innerHTML = `
    <div class="history-summary-grid">
      <div><span>Pagos registrados</span><strong>${pagos.length}</strong></div>
      <div><span>Total pagado</span><strong>S/ ${totalPagado.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>
      <div><span>Conciliaciones</span><strong>${conciliaciones.length}</strong></div>
      <div><span>Última deuda conciliada</span><strong>${ultimaConciliacion ? `S/ ${(parseFloat(ultimaConciliacion.deudaCalculada)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'}</strong></div>
    </div>`;

  const lista = document.getElementById('historial-tarjeta-lista');
  if (!movimientos.length) {
    lista.innerHTML = '<div class="empty-state">Todavía no hay pagos ni conciliaciones registradas.</div>';
    return;
  }

  lista.innerHTML = movimientos.map(m => {
    if (m.tipo === 'pago') {
      return `
        <div class="card-history-item payment">
          <div class="card-history-icon">↓</div>
          <div class="card-history-info">
            <strong>${m.titulo}</strong>
            <span>${formatearFechaHistorial(m.fecha)}${m.detalle ? ` · ${m.detalle}` : ''}</span>
          </div>
          <div class="card-history-amount">− S/ ${m.monto.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        </div>`;
    }

    const diferenciaTexto = Math.abs(m.diferencia) < 0.005
      ? 'Sin diferencia'
      : `${m.diferencia > 0 ? '+' : '−'} S/ ${Math.abs(m.diferencia).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

    return `
      <div class="card-history-item reconciliation">
        <div class="card-history-icon">✓</div>
        <div class="card-history-info">
          <strong>${m.titulo}</strong>
          <span>${formatearFechaHistorial(m.fecha)} · Disponible banco: S/ ${m.disponible.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
          <small>Diferencia detectada: ${diferenciaTexto}</small>
        </div>
        <div class="card-history-amount">S/ ${m.monto.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      </div>`;
  }).join('');
}

function abrirPagoPrestamo(id, nombre, saldoActual, cuota, proximoVencimiento='', frecuencia='mensual', quien='yo') {
  prestamoActualId = id;
  prestamoActualNombre = nombre;
  prestamoSaldoMax = Number(saldoActual) || 0;
  cuotaMensual = Number(cuota) || 0;
  window.prestamoPagoContexto = { proximoVencimiento, frecuencia, quien };

  const venceTexto = proximoVencimiento
    ? new Date(`${proximoVencimiento}T12:00:00`).toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'})
    : 'No informado';
  document.getElementById('pago-prestamo-info').innerHTML = `
    <strong>${nombre}</strong><br>
    <small>Saldo: <b>S/ ${prestamoSaldoMax.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}</b><br>
    Cuota: S/ ${cuotaMensual.toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}<br>
    Próximo vencimiento: ${venceTexto}</small>`;

  const inputMonto = document.getElementById('prestamo-pago-monto');
  inputMonto.max = prestamoSaldoMax;
  inputMonto.value = Math.min(cuotaMensual || prestamoSaldoMax, prestamoSaldoMax);
  inputMonto.placeholder = `Máx. S/ ${prestamoSaldoMax.toLocaleString()}`;
  document.getElementById('prestamo-pago-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('prestamo-pago-nota').value = '';
  document.getElementById('prestamo-pago-completa').checked = cuotaMensual > 0 && Number(inputMonto.value) >= cuotaMensual;
  openModal('pagoPrestamoModal');
}

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

function actualizarInfoTarjetaRapida() {
  const option = document.getElementById('gr-tarjeta')?.selectedOptions?.[0];
  const info = document.getElementById('gr-tarjeta-info');
  if (!option || !option.value) { info.textContent = ''; return; }
  const deuda = parseFloat(option.dataset.deuda) || 0;
  const limite = parseFloat(option.dataset.limite) || 0;
  const disponible = limite - deuda;
  info.textContent = disponible < 0
    ? `Excedida por S/ ${Math.abs(disponible).toFixed(2)}. La compra aumentará la deuda.`
    : `Disponible actual: S/ ${disponible.toFixed(2)}`;
  info.style.color = disponible < 0 ? '#c43030' : 'var(--text3)';
}

async function actualizarTarjetasGastoRapido() {
  const medio = document.getElementById('gr-medio').value;
  const row = document.getElementById('gr-tarjeta-row');
  if (medio !== 'tarjeta') {
    row.style.display = 'none';
    return;
  }
  row.style.display = 'block';
  const tarjetas = await DB.getTarjetas();
  const select = document.getElementById('gr-tarjeta');
  if (!tarjetas.length) {
    select.innerHTML = '<option value="">No hay tarjetas registradas</option>';
    document.getElementById('gr-tarjeta-info').textContent = '';
    return;
  }
  select.innerHTML = tarjetas.map(t => {
    const deuda = parseFloat(t.deuda) || 0;
    const limite = parseFloat(t.limite) || 0;
    const disponible = limite - deuda;
    return `<option value="${t.id}" data-deuda="${deuda}" data-limite="${limite}" data-nombre="${escapeInlineString(t.nombre)}">${t.nombre} · ${disponible < 0 ? 'excedida S/ ' + Math.abs(disponible).toFixed(2) : 'disp. S/ ' + disponible.toFixed(2)}</option>`;
  }).join('');
  select.onchange = actualizarInfoTarjetaRapida;
  actualizarInfoTarjetaRapida();
}

function actualizarVistaConciliacion() {
  const calculo = calcularConciliacionDesdeDisponible();
  const panel = document.getElementById('ajuste-tarjeta-diferencia');
  const boton = document.getElementById('btn-confirmar-conciliacion');
  if (!panel || !boton) return;

  if (!calculo || calculo.deudaReal < 0) {
    panel.className = 'reconcile-difference neutral';
    panel.innerHTML = '<span>Ingresa el saldo disponible que muestra el banco. Puede ser negativo si excediste la línea.</span>';
    boton.disabled = true;
    return;
  }

  const { disponibleBanco, deudaReal, diferencia } = calculo;
  const abs = Math.abs(diferencia);
  boton.disabled = abs < 0.005;
  const disponibleTexto = disponibleBanco < 0
    ? `− S/ ${moneda2(Math.abs(disponibleBanco))}`
    : `S/ ${moneda2(disponibleBanco)}`;

  if (abs < 0.005) {
    panel.className = 'reconcile-difference neutral';
    panel.innerHTML = `<strong>Los saldos ya coinciden.</strong><span>Disponible del banco: ${disponibleTexto} · Deuda calculada: S/ ${moneda2(deudaReal)}</span>`;
  } else if (diferencia > 0) {
    panel.className = 'reconcile-difference increase';
    panel.innerHTML = `<strong>Deuda real calculada: S/ ${moneda2(deudaReal)}</strong><span>Diferencia no registrada: + S/ ${moneda2(abs)}. Puede corresponder a intereses, comisiones o compras pendientes.</span>`;
  } else {
    panel.className = 'reconcile-difference decrease';
    panel.innerHTML = `<strong>Deuda real calculada: S/ ${moneda2(deudaReal)}</strong><span>Diferencia a favor: − S/ ${moneda2(abs)}. Puede corresponder a pagos o devoluciones aún no registrados.</span>`;
  }
}

async function agregarGastoRapido() {
  const monto = parseFloat(document.getElementById('gr-monto').value);
  const cat = document.getElementById('gr-cat').value;
  const quien = document.getElementById('gr-quien').value;
  const medio = document.getElementById('gr-medio').value;
  if (!Number.isFinite(monto) || monto <= 0) { alert('Ingresa un monto válido.'); return; }

  let tarjetaId = null;
  let tarjetaNombre = null;
  let tarjetaDeuda = 0;
  if (medio === 'tarjeta') {
    const option = document.getElementById('gr-tarjeta')?.selectedOptions?.[0];
    if (!option || !option.value) { alert('Selecciona una tarjeta.'); return; }
    tarjetaId = option.value;
    tarjetaNombre = option.dataset.nombre || option.textContent.split(' · ')[0];
    tarjetaDeuda = parseFloat(option.dataset.deuda) || 0;
  }

  const gasto = await DB.addGasto({
    desc: `Gasto rápido · ${cat}`, monto, quien, cat,
    icono: CATS[cat]?.icon || '📦', medio, tarjetaId, tarjetaNombre,
    fecha: new Date().toISOString().split('T')[0], creadoEn: new Date().toISOString()
  });
  if (!gasto) { alert('No se pudo guardar el gasto. Revisa tu conexión.'); return; }

  if (medio === 'tarjeta') {
    const actualizado = await DB.updateTarjeta(tarjetaId, {
      deuda: tarjetaDeuda + monto,
      actualizadoEn: new Date().toISOString()
    });
    if (!actualizado) {
      alert('El gasto se guardó, pero no se pudo actualizar la deuda de la tarjeta. Ajusta el saldo manualmente.');
    }
  }

  localStorage.setItem('ultimoGastoRapidoCat', cat);
  localStorage.setItem('ultimoGastoRapidoMedio', medio);
  closeModal('gastoRapidoModal');
  showToast('Gasto rápido registrado ✓');
  renderTodo();
}

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

function calcularConciliacionDesdeDisponible() {
  const disponibleBanco = parseFloat(document.getElementById('ajuste-tarjeta-disponible')?.value);
  if (!Number.isFinite(disponibleBanco)) return null;
  const deudaReal = tarjetaAjusteLimite - disponibleBanco;
  const diferencia = deudaReal - tarjetaAjusteDeudaAnterior;
  return { disponibleBanco, deudaReal, diferencia };
}

function changeYear(newYear) {
  currentYear = parseInt(newYear);
  document.getElementById('selected-year').textContent = currentYear;
  renderMonthGrid();
  document.getElementById('year-selector').style.display = 'none';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
  }

  _modalCount = Math.max(0, _modalCount - 1);
  if (_modalCount === 0) {
    document.body.classList.remove('modal-open');
    actualizarFabContextual(activeTab);
    // No necesitamos hacer scrollTo porque el body nunca se movió
  }
}

function closeModalOutside(e, id) { 
  if (e.target.id === id) closeModal(id); 
}

function confirmarReset() {
  if (confirm("¿Estás seguro de borrar TODOS los datos del hogar?\nEsta acción no se puede deshacer.")) {
    if (confirm("¡Última confirmación! ¿Realmente quieres eliminar todo?")) {
      DB.resetAll();
      location.reload();
    }
  }
}

function destroyChart(chart) {
  if (chart) {
    try { chart.destroy(); } catch(e) {}
  }
  return null;
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

function formatearFechaHistorial(valor) {
  if (!valor) return 'Sin fecha';
  const fecha = new Date(String(valor).length === 10 ? `${valor}T12:00:00` : valor);
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
  return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getComputedColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

async function guardarAjusteTarjeta() {
  const calculo = calcularConciliacionDesdeDisponible();
  if (!calculo || calculo.deudaReal < 0 || !tarjetaAjusteId) {
    alert('Ingresa un saldo disponible válido.');
    return;
  }

  const { disponibleBanco, deudaReal, diferencia } = calculo;
  if (Math.abs(diferencia) < 0.005) {
    showToast('El saldo ya coincide con el banco.');
    return;
  }

  const disponibleTexto = disponibleBanco < 0
    ? `− S/ ${moneda2(Math.abs(disponibleBanco))}`
    : `S/ ${moneda2(disponibleBanco)}`;
  const concepto = diferencia > 0
    ? 'intereses, comisiones o movimientos no registrados'
    : 'pagos, devoluciones o ajustes a favor no registrados';
  const confirmado = confirm(
    `${tarjetaAjusteNombre}\n\n` +
    `Línea de crédito: S/ ${moneda2(tarjetaAjusteLimite)}\n` +
    `Disponible según banco: ${disponibleTexto}\n` +
    `Deuda real calculada: S/ ${moneda2(deudaReal)}\n` +
    `Deuda registrada: S/ ${moneda2(tarjetaAjusteDeudaAnterior)}\n` +
    `Diferencia: ${diferencia > 0 ? '+' : '−'} S/ ${moneda2(Math.abs(diferencia))}\n\n` +
    `La diferencia puede corresponder a ${concepto}. ¿Actualizar la tarjeta?`
  );
  if (!confirmado) return;

  const boton = document.getElementById('btn-confirmar-conciliacion');
  boton.disabled = true;
  boton.textContent = 'Guardando…';

  const resultado = await DB.conciliarTarjeta(tarjetaAjusteId, {
    tarjetaNombre: tarjetaAjusteNombre,
    limiteCredito: tarjetaAjusteLimite,
    saldoAnterior: tarjetaAjusteDeudaAnterior,
    disponibleBanco,
    deudaCalculada: deudaReal,
    diferencia,
    fecha: new Date().toISOString(),
    mes: new Date().toISOString().slice(0, 7),
    usuario: localStorage.getItem('miUsuarioTipo') || 'yo'
  });

  boton.textContent = 'Confirmar conciliación';
  boton.disabled = false;

  if (!resultado) {
    alert('No se pudo guardar la conciliación. Revisa tu conexión.');
    return;
  }

  closeModal('ajusteTarjetaModal');
  showToast(`Deuda conciliada: S/ ${moneda2(deudaReal)} ✓`);
  renderTodo();
}

async function guardarTokenEnDB(token) {
    if (!hogarId) return;
    // Guardamos el token en una colección de "dispositivos" dentro del hogar
    await db.collection("hogares").doc(hogarId).collection("tokens").doc(token).set({
        fechaActualizacion: new Date(),
        usuario: auth.currentUser ? auth.currentUser.uid : 'anonimo'
    });
}

function hideToast() {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.classList.remove('show');
    toast.style.display = 'none';
  }
}

function moneda2(valor) {
  return (parseFloat(valor) || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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

function nextYear() {
  currentYear++;
  document.getElementById('selected-year').textContent = currentYear;
  renderMonthGrid();
}

function openGastoRapidoModal() {
  document.getElementById('gr-monto').value = '';
  document.getElementById('gr-quien').value = localStorage.getItem('miUsuarioTipo') || 'yo';
  document.getElementById('gr-cat').value = localStorage.getItem('ultimoGastoRapidoCat') || 'Alimentación';
  document.getElementById('gr-medio').value = localStorage.getItem('ultimoGastoRapidoMedio') || 'efectivo';
  openModal('gastoRapidoModal');
  actualizarTarjetasGastoRapido();
  setTimeout(() => document.getElementById('gr-monto')?.focus(), 100);
}

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

function openMonthPicker() {
  currentYear = parseInt(mesActual.substring(0,4));
  currentMonth = parseInt(mesActual.substring(5,7));

  document.getElementById('selected-year').textContent = currentYear;
  renderMonthGrid();
  openModal('monthPickerModal');
}

function prevYear() {
  currentYear--;
  document.getElementById('selected-year').textContent = currentYear;
  renderMonthGrid();
}

function preventBackgroundScroll(e) {
  e.preventDefault();
}

async function registrarPagoPrestamo() {
  const monto = Number(document.getElementById('prestamo-pago-monto').value);
  const fecha = document.getElementById('prestamo-pago-fecha').value;
  const nota = document.getElementById('prestamo-pago-nota').value.trim();
  const marcarCuota = document.getElementById('prestamo-pago-completa').checked;

  if (!monto || monto <= 0) { alert('Ingresa un monto válido'); return; }
  if (monto > prestamoSaldoMax) { alert(`El monto no puede superar el saldo actual de S/ ${prestamoSaldoMax.toLocaleString()}`); return; }
  if (!fecha) { alert('Selecciona la fecha del pago'); return; }
  if (!prestamoActualId) return;

  try {
    const prestamos = await DB.getPrestamos();
    const prestamo = prestamos.find(p => p.id === prestamoActualId);
    if (!prestamo) throw new Error('Préstamo no encontrado');

    const nuevoSaldo = Math.max(0, (Number(prestamo.saldo)||0) - monto);
    const nuevasPagadas = (Number(prestamo.pagadas)||0) + (marcarCuota ? 1 : 0);
    const proximoVencimiento = marcarCuota && prestamo.proximoVencimiento
      ? avanzarVencimiento(prestamo.proximoVencimiento, prestamo.frecuencia || 'mensual')
      : (prestamo.proximoVencimiento || '');

    const ok = await DB.registrarPagoPrestamo(prestamoActualId, {
      monto, fecha, nota,
      prestamoNombre: prestamoActualNombre,
      quien: prestamo.quien || window.prestamoPagoContexto?.quien || 'yo',
      cuotaMarcada: marcarCuota,
      saldoAnterior: Number(prestamo.saldo)||0,
      saldoPosterior: nuevoSaldo,
      proximoVencimientoAnterior: prestamo.proximoVencimiento || '',
      proximoVencimientoPosterior: proximoVencimiento,
      creadoEn: new Date().toISOString()
    }, {
      saldo: nuevoSaldo,
      pagadas: nuevasPagadas,
      proximoVencimiento
    });
    if (!ok) throw new Error('No se pudo guardar el pago');

    closeModal('pagoPrestamoModal');
    showToast(marcarCuota ? 'Cuota registrada y vencimiento actualizado ✓' : 'Abono registrado correctamente ✓');
    renderTodo();
    const cfg = configCache || await DB.getConfig();
    await notificarAlOtro(`${cfg.nombreYo} pagó S/ ${monto} del préstamo ${prestamoActualNombre}`);
  } catch (e) {
    console.error('Error al registrar pago de préstamo:', e);
    alert('Error al procesar el pago. Inténtalo nuevamente.');
  }
}

async function abrirHistorialPrestamo(id, nombre, saldoActual) {
  cerrarMenusDeuda();
  document.getElementById('historial-prestamo-titulo').textContent = `Historial · ${nombre}`;
  document.getElementById('historial-prestamo-resumen').innerHTML = '<span class="skeleton" style="width:100%;height:68px;display:block"></span>';
  document.getElementById('historial-prestamo-lista').innerHTML = '<span class="skeleton" style="width:100%;height:120px;display:block"></span>';
  openModal('historialPrestamoModal');

  const pagos = await DB.getPagosPrestamo(id);
  const totalPagado = pagos.reduce((s,p)=>s+(Number(p.monto)||0),0);
  document.getElementById('historial-prestamo-resumen').innerHTML = `
    <div><span>Pagos registrados</span><strong>${pagos.length}</strong></div>
    <div><span>Total pagado</span><strong>${formatoSoles(totalPagado)}</strong></div>
    <div><span>Saldo actual</span><strong>${formatoSoles(saldoActual)}</strong></div>`;
  document.getElementById('historial-prestamo-lista').innerHTML = pagos.length ? pagos.map(p=>`
    <div class="card-history-item payment">
      <div class="card-history-icon">↓</div>
      <div class="card-history-info"><strong>${p.cuotaMarcada ? 'Cuota pagada' : 'Abono al préstamo'}</strong><span>${formatearFechaHistorial(p.fecha)}${p.nota ? ' · '+p.nota : ''}</span><small>Saldo después: ${formatoSoles(p.saldoPosterior)}</small></div>
      <div class="card-history-amount">− ${formatoSoles(p.monto)}</div>
    </div>`).join('') : '<div class="empty-state">Todavía no hay pagos registrados.</div>';
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
  cat: 'Deudas',
  icono: '💳',
  tipoMovimiento: 'pagoTarjeta',
  tarjetaId: tarjetaActualId,
  tarjetaNombre: tarjetaActualNombre,
  nota: nota,
  fecha: fecha,
  creadoEn: new Date().toISOString(),
});

    
    // 2. Reducir la deuda de la tarjeta (usando el crédito realmente liberado)
const tarjetas = await DB.getTarjetas();
const tarjeta = tarjetas.find(t => t.id === tarjetaActualId);

if (tarjeta) {
  const deudaAnterior = parseFloat(tarjeta.deuda) || 0;
  const nuevaDeuda = Math.max(0, deudaAnterior - monto);

  await db.collection("hogares").doc(hogarId)
    .collection("tarjetas")
    .doc(tarjetaActualId)
    .update({
      deuda: nuevaDeuda,
      saldoEstimado: true,
      pendienteConciliar: true,
      ultimoPagoFecha: fecha,
      ultimoPagoMonto: monto,
      actualizadoEn: new Date().toISOString()
    });

  console.log(`Deuda estimada: ${deudaAnterior} → ${nuevaDeuda} (pago registrado: ${monto})`);
}

    await DB.enviarNotificacion(`Se pagó S/ ${monto} de la tarjeta ${tarjetaActualNombre}`);
    // Cerrar el modal primero
    closeModal('pagoTarjetaModal');

    // ✅ Mostrar el toast después (ya sin el overlay encima)
    showToast('Pago registrado. El saldo queda estimado hasta conciliarlo con el banco.', 'info');

    // Actualizar la pantalla
    renderTodo();
    const cfg = configCache || await DB.getConfig();
    await notificarAlOtro(`${cfg.nombreYo} pagó S/ ${monto} de la tarjeta ${tarjetaActualNombre}`);

  } catch (e) {
    console.error("Error al registrar pago:", e);
    alert("Error al procesar el pago. Inténtalo nuevamente.");
  }
}

function renderAlertas(tarjetas, prestamos, gastoTotal, ingresos) {
  renderAlertasResumen(tarjetas, prestamos, gastoTotal, ingresos);
  renderAlertasDeuda(tarjetas, prestamos);
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
    const disponible = limite - deuda;
    if (deuda > limite) {
      alertas.push({
        tipo: 'danger',
        msg: `${t.nombre} excedida por S/ ${Math.abs(disponible).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}.`
      });
    } else if (deuda === limite) {
      alertas.push({ tipo: 'danger', msg: `${t.nombre} llegó al límite máximo. Sin crédito disponible.` });
    } else if (uso >= 0.9) {
      alertas.push({
        tipo: 'warning',
        msg: `${t.nombre} al ${Math.round(uso*100)}% del límite. Solo S/ ${disponible.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} disponibles.`
      });
    }

    // Próximo vencimiento. Las tarjetas nuevas guardan el día de cierre en "cierre".
    const diaPago = parseInt(t.vence) || parseInt(t.cierre) || parseInt(t.diaCierre) || 0;
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

function renderAlertasResumen(tarjetas, prestamos, gastoTotal, ingresos) {
  const el = document.getElementById('alertas-resumen');
  if (!el) return;

  const alertas = [];
  const hoy = new Date();
  const diaHoy = hoy.getDate();

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

 /* 2. BAR — Tú vs Pareja (Versión Original) */
  (function() {
    const canvas = resetAndGetCanvas('barChart');
    if (!canvas) return;
    
    const yo = cfg.nombreYo || 'Christian';
    const ella = cfg.nombreElla || 'Sydney';
    const cats = Object.keys(CATS);

    // Suma total de gastos por categoría para cada persona
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
          { 
            label: yo, 
            data: dataYo, 
            backgroundColor: '#2a7de1cc', 
            borderRadius: 6 
          },
          { 
            label: ella, 
            data: dataElla, 
            backgroundColor: '#c94b7bcc', 
            borderRadius: 6 
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { 
            display: false 
          } 
        },
        scales: {
          x: { 
            grid: { display: false }, 
            ticks: { color: text3Color } 
          },
          y: { 
            grid: { color: borderColor }, 
            ticks: { color: text3Color, callback: v => 'S/' + v } 
          }
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
    const pagoMensual = [...(prestamos||[]).map(p => parseFloat(p.cuota)||0)]
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

    const NECESIDADES_CATS = ['Alimentación', 'Servicios', 'Transporte', 'Salud', 'Hogar', 'Deudas'];
    const GUSTOS_CATS = ['Entret.', 'Otros'];

    let totalNecesidades = 0, totalGustos = 0;
(gastos || []).forEach(function(g) {
  const monto = g.monto || 0;
  if (NECESIDADES_CATS.indexOf(g.cat) >= 0) {
    totalNecesidades += monto;
  } else if (GUSTOS_CATS.indexOf(g.cat) >= 0) {
    totalGustos += monto;
  }
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
    '<div class="budget-group-title">Consumo del hogar</div>' +
    filaPresupuesto('Gastos fijos del hogar',    gastoHogar,    limHogar,    '#2a7de1', '#e8850a', '#c43030') +
    filaPresupuesto('Entretenimiento y salidas', gastoEntret,   limEntret,   '#2a7de1', '#e8850a', '#c43030') +
    '<div class="budget-group-title">Compromisos financieros</div>' +
    filaPresupuesto('Tarjetas de crédito',       deudaTarjetas, limTarjeta,  '#e8850a', '#e8850a', '#c43030') +
    filaPresupuesto('Cuotas de préstamos',       cuotasPrest,   limPrest,    '#c43030', '#c43030', '#c43030') +
    '<div class="budget-group-title">Construcción de patrimonio</div>' +
    filaPresupuesto('Ahorro mensual',            ahorroReal,    limAhorro,   '#2d6a2d', '#4a9a4a', '#888780', true);
}

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

function selectChip(el, groupId) {
  document.getElementById(groupId).querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function selectMonth(month) {
  mesActual = `${currentYear}-${String(month).padStart(2, '0')}`;
  actualizarMesBtn();
  closeModal('monthPickerModal');
  renderTodo();   // ← Actualiza toda la pantalla con el nuevo mes
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
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

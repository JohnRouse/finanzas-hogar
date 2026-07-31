/* Hogar Finanzas — Etapa 13.3: estabilidad, diagnóstico y carga segura */
(() => {
  'use strict';

  const CLAVE_ERRORES = 'hf_diagnostico_errores';
  const CLAVE_ESTADO = 'hf_diagnostico_estado';
  const MAX_ERRORES = 100;
  let iniciado = false;

  const ahora = () => new Date().toISOString();

  function leerJSON(clave, respaldo) {
    try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? respaldo; }
    catch { return respaldo; }
  }

  function guardarJSON(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); }
    catch (error) { console.warn('No se pudo persistir el diagnóstico:', error); }
  }

  function serializarError(error) {
    if (!error) return { mensaje: 'Error desconocido' };
    if (typeof error === 'string') return { mensaje: error };
    return {
      nombre: error.name || 'Error',
      mensaje: error.message || String(error),
      stack: error.stack || null
    };
  }

  function registrarError(origen, error, contexto = {}) {
    const errores = leerJSON(CLAVE_ERRORES, []);
    const registro = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fecha: ahora(),
      origen,
      error: serializarError(error),
      contexto
    };
    guardarJSON(CLAVE_ERRORES, [registro, ...errores].slice(0, MAX_ERRORES));
    window.dispatchEvent(new CustomEvent('hf:error-diagnosticado', { detail: registro }));
    return registro;
  }

  function elemento(id) {
    return document.getElementById(id);
  }

  function textoSeguro(id, respaldo = '') {
    return elemento(id)?.textContent?.trim() || respaldo;
  }

  function htmlSeguro(id, html) {
    const nodo = elemento(id);
    if (!nodo) return false;
    nodo.innerHTML = html;
    return true;
  }

  function ejecutarSeguro(nombre, funcion, respaldo = null) {
    try {
      return typeof funcion === 'function' ? funcion() : respaldo;
    } catch (error) {
      registrarError(nombre, error);
      return respaldo;
    }
  }

  async function ejecutarSeguroAsync(nombre, funcion, respaldo = null) {
    try {
      return typeof funcion === 'function' ? await funcion() : respaldo;
    } catch (error) {
      registrarError(nombre, error);
      return respaldo;
    }
  }

  function repararHistorialGastos() {
    const original = window.abrirHistorialCompleto;
    window.abrirHistorialCompleto = function abrirHistorialCompletoSeguro() {
      const listaFull = elemento('listaCompletaGastos');
      if (!listaFull) {
        registrarError('abrirHistorialCompleto', new Error('No existe #listaCompletaGastos'));
        if (typeof window.showToast === 'function') window.showToast('No se pudo abrir el historial de movimientos.');
        return;
      }

      const mesRespaldo = ejecutarSeguro(
        'formatear-mes-historial',
        () => window.DB?.formatMes?.(window.mesActual || null),
        'este mes'
      );
      const displayMes = textoSeguro('month-display', mesRespaldo || 'este mes');
      const titulo = elemento('historialTitle');
      if (titulo) titulo.textContent = `Movimientos de ${displayMes}`;

      const searchInput = elemento('historial-search');
      const clearBtn = elemento('historial-search-clear');
      const noRes = elemento('historial-no-resultados');
      if (searchInput) searchInput.value = '';
      if (clearBtn) clearBtn.style.display = 'none';
      if (noRes) noRes.style.display = 'none';

      const gastos = Array.isArray(window.gastosDelMesCache)
        ? window.gastosDelMesCache
        : (typeof gastosDelMesCache !== 'undefined' && Array.isArray(gastosDelMesCache) ? gastosDelMesCache : []);
      const cfg = window.configCache || (typeof configCache !== 'undefined' ? configCache : {});
      const generador = window.generarGastoHTML || (typeof generarGastoHTML === 'function' ? generarGastoHTML : null);

      if (!generador) {
        registrarError('abrirHistorialCompleto', new Error('generarGastoHTML no está disponible'));
        listaFull.innerHTML = '<div class="empty-state">No se pudo preparar el historial.</div>';
      } else {
        listaFull.innerHTML = gastos.length
          ? gastos.map(g => ejecutarSeguro('generarGastoHTML', () => generador(g, cfg), '')).join('')
          : '<div class="empty-state">No hay movimientos para mostrar.</div>';
      }

      if (typeof window.openModal === 'function') window.openModal('modalHistorial');
      else elemento('modalHistorial')?.classList.add('active');

      requestAnimationFrame(() => {
        setTimeout(() => ejecutarSeguro('initGesturesModal', () => {
          const inicializador = window.initGesturesModal || (typeof initGesturesModal === 'function' ? initGesturesModal : null);
          return inicializador?.();
        }), 50);
      });
    };
    return Boolean(original);
  }

  const MODULOS = [
    ['HFAsistenteFinanciero', 'js/asistente-financiero.js?v=13.3'],
    ['HFCentroInteligenciaFinanciera', 'js/centro-inteligencia-financiera.js?v=13.3'],
    ['HFMotorFlujoCajaPredictivo', 'js/motor-flujo-caja-predictivo.js?v=13.3'],
    ['HFCalendarioFinancieroInteligente', 'js/calendario-financiero-inteligente.js?v=13.3'],
    ['HFMotorRecomendacionesFinancieras', 'js/motor-recomendaciones-financieras.js?v=13.3'],
    ['HFChatFinancieroInteligente', 'js/chat-financiero-inteligente.js?v=13.3'],
    ['HFInsightsFinancierosAutomaticos', 'js/insights-financieros-automaticos.js?v=13.3'],
    ['HFMotorObjetivosFinancieros', 'js/motor-objetivos-financieros.js?v=13.3'],
    ['HFPlanificadorFinancieroInteligente', 'js/planificador-financiero-inteligente.js?v=13.3'],
    ['HFDirectorFinancieroIA', 'js/director-financiero-ia.js?v=13.3'],
    ['HFMemoriaFinancieraInteligente', 'js/memoria-financiera-inteligente.js?v=13.3']
  ];

  function cargarScript(globalEsperado, ruta) {
    if (window[globalEsperado]) return Promise.resolve({ globalEsperado, estado: 'ya-cargado' });
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = new URL(ruta, document.baseURI).href;
      script.async = false;
      script.onload = () => resolve({ globalEsperado, estado: window[globalEsperado] ? 'cargado' : 'sin-global' });
      script.onerror = () => {
        registrarError('carga-modulo', new Error(`No se pudo cargar ${ruta}`), { globalEsperado, ruta });
        resolve({ globalEsperado, estado: 'error' });
      };
      document.body.appendChild(script);
    });
  }

  async function cargarModulosAvanzados() {
    const resultados = [];
    for (const [globalEsperado, ruta] of MODULOS) {
      resultados.push(await cargarScript(globalEsperado, ruta));
    }
    const estado = {
      fecha: ahora(),
      version: '13.3',
      modulos: resultados,
      disponibles: resultados.filter(r => ['cargado', 'ya-cargado'].includes(r.estado)).length,
      fallidos: resultados.filter(r => r.estado === 'error').length
    };
    guardarJSON(CLAVE_ESTADO, estado);
    window.dispatchEvent(new CustomEvent('hf:modulos-avanzados-cargados', { detail: estado }));
    return estado;
  }

  function instalarCapturaGlobal() {
    window.addEventListener('error', event => {
      registrarError('window.error', event.error || event.message, {
        archivo: event.filename,
        linea: event.lineno,
        columna: event.colno
      });
    });
    window.addEventListener('unhandledrejection', event => {
      registrarError('unhandledrejection', event.reason);
    });
  }

  function diagnosticar() {
    const requeridos = [
      'DB', 'HFModeloFinanciero', 'HFOptimizadorPagos',
      'HFMotorObjetivosFinancieros', 'HFPlanificadorFinancieroInteligente',
      'HFDirectorFinancieroIA', 'HFMemoriaFinancieraInteligente'
    ];
    return {
      fecha: ahora(),
      version: '13.3',
      dom: {
        monthDisplay: Boolean(elemento('month-display')),
        modalHistorial: Boolean(elemento('modalHistorial')),
        listaCompletaGastos: Boolean(elemento('listaCompletaGastos'))
      },
      modulos: Object.fromEntries(requeridos.map(nombre => [nombre, Boolean(window[nombre])])),
      erroresRecientes: leerJSON(CLAVE_ERRORES, []).slice(0, 10)
    };
  }

  async function iniciar() {
    if (iniciado) return diagnosticar();
    iniciado = true;
    instalarCapturaGlobal();
    repararHistorialGastos();
    const estadoCarga = await cargarModulosAvanzados();
    const diagnostico = diagnosticar();
    guardarJSON(CLAVE_ESTADO, { ...estadoCarga, diagnostico });
    window.dispatchEvent(new CustomEvent('hf:estabilidad-app-lista', { detail: diagnostico }));
    return diagnostico;
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 500));
  setTimeout(iniciar, 1400);

  window.HFEstabilidadApp = Object.freeze({
    iniciar,
    diagnosticar,
    registrarError,
    ejecutarSeguro,
    ejecutarSeguroAsync,
    elemento,
    textoSeguro,
    htmlSeguro,
    repararHistorialGastos,
    obtenerErrores: () => leerJSON(CLAVE_ERRORES, []),
    limpiarErrores: () => guardarJSON(CLAVE_ERRORES, [])
  });
})();
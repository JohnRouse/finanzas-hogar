/* Hogar Finanzas — sincronización financiera estable V35 beta 8.2 */
(() => {
  'use strict';

  const VERSION = '35.0-beta.8.2';
  if (window.HFSincronizacionFinancieraUI?.version === VERSION) return;

  let temporizador = null;
  let bootstrapSolicitado = false;
  let refrescoEnCurso = false;
  let opcionesPendientes = null;
  let causaPendiente = '';
  let refrescosEjecutados = 0;
  let refrescosPrincipales = 0;
  let solicitudesCoalescidas = 0;

  function combinarOpciones(base = null, nuevas = {}) {
    const anterior = base || { principal:false, deudas:false, coherencia:false };
    return {
      principal:Boolean(anterior.principal || nuevas.principal),
      deudas:Boolean(anterior.deudas || nuevas.deudas),
      coherencia:Boolean(anterior.coherencia || nuevas.coherencia)
    };
  }

  function programarRefresco(opciones = {}, causa = 'manual', delay = 220) {
    opcionesPendientes = combinarOpciones(opcionesPendientes, opciones);
    causaPendiente = causa || causaPendiente || 'manual';

    // Si ya hay un refresco ejecutándose, solo acumulamos la intención.
    // No creamos otro timer que pueda dispararse mientras el anterior sigue activo.
    if (refrescoEnCurso) {
      solicitudesCoalescidas += 1;
      return;
    }

    clearTimeout(temporizador);
    temporizador = setTimeout(ejecutarPendiente, Math.max(80, Number(delay) || 220));
  }

  async function ejecutarPendiente() {
    if (refrescoEnCurso) return;

    const opciones = opcionesPendientes || { principal:false, deudas:false, coherencia:false };
    const causa = causaPendiente || 'manual';
    opcionesPendientes = null;
    causaPendiente = '';
    refrescoEnCurso = true;
    refrescosEjecutados += 1;
    if (opciones.principal) refrescosPrincipales += 1;

    try {
      // El render principal muestra skeletons y reconstruye varias secciones. Debe
      // reservarse para cambios reales de movimientos/metas, no para eventos derivados
      // del propio motor de deuda.
      if (opciones.principal && typeof window.renderTodo === 'function') {
        await window.renderTodo();
      }

      // Deudas se repinta usando los datos existentes. No llamamos aquí a
      // actualizarCentroTarjetas(), porque ese recálculo emite nuevos eventos de deuda
      // y puede alimentar un ciclo de refrescos.
      if (opciones.deudas) {
        await window.HFDeudasFamiliares?.renderizar?.();
      }

      if (opciones.coherencia) {
        await window.HFCoherenciaFinanciera?.actualizar?.();
      }
    } catch (error) {
      console.warn(`No se pudo refrescar la interfaz financiera (${causa}):`, error);
    } finally {
      refrescoEnCurso = false;

      // Si durante el refresco llegó otro cambio real, ejecutamos una única pasada
      // coalescida. Nunca encadenamos timers vacíos ni refrescos autorreferenciales.
      if (opcionesPendientes) {
        clearTimeout(temporizador);
        temporizador = setTimeout(ejecutarPendiente, 260);
      }
    }
  }

  function refrescarVistas(forzar = true) {
    programarRefresco({ principal:Boolean(forzar), deudas:false, coherencia:false }, 'api:refrescarVistas');
  }

  function refrescarSoloDeudas() {
    programarRefresco({ principal:false, deudas:true, coherencia:true }, 'api:refrescarSoloDeudas');
  }

  function cargarBootstrapAvanzado() {
    if (bootstrapSolicitado) return;
    bootstrapSolicitado = true;

    if (window.HFBootstrapAvanzado) return window.HFBootstrapAvanzado.iniciar?.();

    const script = document.createElement('script');
    script.src = new URL('js/bootstrap-avanzado.js?v=33.4', document.baseURI).href;
    script.async = false;
    script.dataset.hfBootstrapPrincipal = 'true';
    script.onload = () => window.HFBootstrapAvanzado?.iniciar?.();
    script.onerror = () => {
      bootstrapSolicitado = false;
      console.warn('No se pudo cargar el arranque avanzado.');
    };
    document.body.appendChild(script);
  }

  // Cambios de movimientos o metas sí necesitan reconstruir el Resumen completo.
  ['hf:gastos-actualizados', 'hf:objetivo-financiero-guardado'].forEach(nombre => {
    window.addEventListener(nombre, () => programarRefresco({
      principal:true,
      deudas:false,
      coherencia:false
    }, nombre));
  });

  // Estos eventos ya son resultados de un cambio de deuda. Volver a ejecutar
  // renderTodo() desde aquí generaba skeletons, nuevas lecturas y otro evento derivado.
  // Solo actualizamos Deudas + coherencia, sin reconstruir toda la aplicación.
  ['hf:deuda-actualizada', 'hf:deudas-recalculadas', 'hf:estado-cuenta-confirmado', 'hf:cierre-mensual-guardado']
    .forEach(nombre => {
      window.addEventListener(nombre, () => programarRefresco({
        principal:false,
        deudas:true,
        coherencia:true
      }, nombre));
    });

  window.addEventListener('hf:deudas-core-actualizadas', () => {
    programarRefresco({ principal:false, deudas:false, coherencia:true }, 'hf:deudas-core-actualizadas');
  });

  function obtenerEstado() {
    return {
      version:VERSION,
      refrescoEnCurso,
      pendiente:Boolean(opcionesPendientes),
      refrescosEjecutados,
      refrescosPrincipales,
      solicitudesCoalescidas
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(cargarBootstrapAvanzado, 160), { once:true });
  } else {
    setTimeout(cargarBootstrapAvanzado, 160);
  }

  window.HFSincronizacionFinancieraUI = Object.freeze({
    refrescarVistas,
    refrescarSoloDeudas,
    cargarBootstrapAvanzado,
    obtenerEstado,
    version:VERSION
  });
})();
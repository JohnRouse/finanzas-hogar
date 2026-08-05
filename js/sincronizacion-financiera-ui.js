/* Hogar Finanzas — sincronización financiera estable V33.4 */
(() => {
  'use strict';

  const VERSION = '33.4';
  let temporizador = null;
  let bootstrapSolicitado = false;
  let refrescoEnCurso = false;
  let refrescoPendiente = false;

  function programarRefresco(opciones = {}) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => ejecutarRefresco(opciones), 220);
  }

  async function ejecutarRefresco({ principal = true, deudas = true, coherencia = false } = {}) {
    if (refrescoEnCurso) {
      refrescoPendiente = true;
      return;
    }

    refrescoEnCurso = true;
    try {
      if (principal && typeof window.renderTodo === 'function') {
        await window.renderTodo();
      }

      if (deudas) {
        if (typeof window.actualizarCentroTarjetas === 'function') {
          await window.actualizarCentroTarjetas(false);
        }
        await window.HFDeudasFamiliares?.renderizar?.();
      }

      if (coherencia) {
        await window.HFCoherenciaFinanciera?.actualizar?.();
      }
    } catch (error) {
      console.warn('No se pudo refrescar la interfaz financiera:', error);
    } finally {
      refrescoEnCurso = false;
      if (refrescoPendiente) {
        refrescoPendiente = false;
        programarRefresco({ principal, deudas, coherencia });
      }
    }
  }

  function refrescarVistas(forzar = true) {
    programarRefresco({ principal: forzar, deudas: true, coherencia: false });
  }

  function refrescarSoloDeudas() {
    programarRefresco({ principal: false, deudas: true, coherencia: true });
  }

  function cargarBootstrapAvanzado() {
    if (bootstrapSolicitado) return;
    bootstrapSolicitado = true;

    if (window.HFBootstrapAvanzado) return window.HFBootstrapAvanzado.iniciar?.();

    const script = document.createElement('script');
    script.src = new URL(`js/bootstrap-avanzado.js?v=${VERSION}`, document.baseURI).href;
    script.async = false;
    script.dataset.hfBootstrapPrincipal = 'true';
    script.onload = () => window.HFBootstrapAvanzado?.iniciar?.();
    script.onerror = () => {
      bootstrapSolicitado = false;
      console.warn('No se pudo cargar el arranque avanzado.');
    };
    document.body.appendChild(script);
  }

  ['hf:gastos-actualizados', 'hf:objetivo-financiero-guardado'].forEach(nombre => {
    window.addEventListener(nombre, () => programarRefresco({
      principal: true,
      deudas: nombre === 'hf:gastos-actualizados',
      coherencia: false
    }));
  });

  ['hf:deuda-actualizada', 'hf:deudas-recalculadas', 'hf:estado-cuenta-confirmado', 'hf:cierre-mensual-guardado']
    .forEach(nombre => {
      window.addEventListener(nombre, () => programarRefresco({
        principal: true,
        deudas: true,
        coherencia: nombre !== 'hf:gastos-actualizados'
      }));
    });

  window.addEventListener('hf:deudas-core-actualizadas', () => {
    programarRefresco({ principal: false, deudas: true, coherencia: true });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(cargarBootstrapAvanzado, 160), { once:true });
  } else {
    setTimeout(cargarBootstrapAvanzado, 160);
  }

  window.HFSincronizacionFinancieraUI = Object.freeze({
    refrescarVistas,
    refrescarSoloDeudas,
    cargarBootstrapAvanzado,
    version:VERSION
  });
})();

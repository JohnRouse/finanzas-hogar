/* Hogar Finanzas — sincronización ligera sin recargas innecesarias */
(() => {
  'use strict';

  const VERSION = '20.0';
  let temporizador = null;
  let bootstrapSolicitado = false;

  function refrescarVistas(forzar = true) {
    clearTimeout(temporizador);
    temporizador = setTimeout(async () => {
      try {
        if (forzar && typeof window.renderTodo === 'function') await window.renderTodo();
        if (typeof window.actualizarCentroTarjetas === 'function') await window.actualizarCentroTarjetas(forzar);
        window.HFRecuperacionProducto?.aplicar?.();
        window.HFCierreFinancieroMensual?.iniciar?.();
        await window.HFDeudasFamiliares?.renderizar?.();
        await window.HFCoherenciaFinanciera?.actualizar?.();
        window.HFSimuladorPagoExtra?.iniciar?.();
        window.HFTelegramPendientes?.conectar?.();
        window.HFExperienciaFinanciera14?.iniciar?.();
      } catch (error) {
        console.warn('No se pudo refrescar la interfaz financiera:', error);
      }
    }, 180);
  }

  function refrescarSoloDeudas() {
    clearTimeout(temporizador);
    temporizador = setTimeout(async () => {
      try {
        if (typeof window.actualizarCentroTarjetas === 'function') await window.actualizarCentroTarjetas(false);
        window.HFRecuperacionProducto?.aplicar?.();
        window.HFCierreFinancieroMensual?.iniciar?.();
        await window.HFDeudasFamiliares?.renderizar?.();
        await window.HFCoherenciaFinanciera?.actualizar?.();
        window.HFExperienciaFinanciera14?.iniciar?.();
      } catch (error) {
        console.warn('No se pudo actualizar el resumen de deudas:', error);
      }
    }, 180);
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

  [
    'hf:deuda-actualizada',
    'hf:deudas-recalculadas',
    'hf:estado-cuenta-confirmado',
    'hf:gastos-actualizados',
    'hf:cierre-mensual-guardado',
    'hf:objetivo-financiero-guardado'
  ].forEach(nombre => {
    window.addEventListener(nombre, () => refrescarVistas(true));
  });

  window.addEventListener('hf:deudas-core-actualizadas', () => {
    window.HFRecuperacionProducto?.aplicar?.();
    window.HFCierreFinancieroMensual?.iniciar?.();
    window.HFDeudasFamiliares?.renderizar?.();
    window.HFCoherenciaFinanciera?.actualizar?.();
    window.HFExperienciaFinanciera14?.iniciar?.();
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
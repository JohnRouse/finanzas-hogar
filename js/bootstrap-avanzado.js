/* Hogar Finanzas — Etapa 13.5: bootstrap oficial de módulos avanzados */
(() => {
  'use strict';

  if (window.__HF_BOOTSTRAP_AVANZADO__) return;
  window.__HF_BOOTSTRAP_AVANZADO__ = true;

  const MODULOS = [
    ['HFEstabilidadApp', 'js/estabilidad-app.js?v=13.5'],
    ['HFIntegracionFinancieraTotal', 'js/integracion-financiera-total.js?v=13.5']
  ];

  function cargar(globalEsperado, ruta) {
    if (window[globalEsperado]) return Promise.resolve({ globalEsperado, estado: 'ya-cargado' });
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = new URL(ruta, document.baseURI).href;
      script.async = false;
      script.dataset.hfBootstrap = globalEsperado;
      script.onload = () => resolve({
        globalEsperado,
        estado: window[globalEsperado] ? 'cargado' : 'sin-global'
      });
      script.onerror = () => resolve({ globalEsperado, estado: 'error' });
      document.body.appendChild(script);
    });
  }

  async function iniciar() {
    const resultados = [];
    for (const [globalEsperado, ruta] of MODULOS) {
      resultados.push(await cargar(globalEsperado, ruta));
    }

    try {
      await window.HFEstabilidadApp?.iniciar?.();
      window.HFEstabilidadApp?.repararHistorialGastos?.();
      await window.HFIntegracionFinancieraTotal?.ejecutarIntegracion?.({ motivo: 'bootstrap-avanzado' });
    } catch (error) {
      window.HFEstabilidadApp?.registrarError?.('bootstrap-avanzado', error, { resultados });
      console.warn('Bootstrap avanzado completado con incidencias:', error);
    }

    window.dispatchEvent(new CustomEvent('hf:bootstrap-avanzado-completado', { detail: { resultados } }));
    return resultados;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 100));
  } else {
    setTimeout(iniciar, 100);
  }

  window.HFBootstrapAvanzado = Object.freeze({ iniciar });
})();
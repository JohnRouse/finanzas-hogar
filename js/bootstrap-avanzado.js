/* Hogar Finanzas — Etapa 15.1: bootstrap oficial e integración del refactor */
(() => {
  'use strict';

  if (window.__HF_BOOTSTRAP_AVANZADO__) return;
  window.__HF_BOOTSTRAP_AVANZADO__ = true;

  const MODULOS = [
    ['HFEstabilidadApp', 'js/estabilidad-app.js?v=15.1'],
    ['HFIntegracionFinancieraTotal', 'js/integracion-financiera-total.js?v=15.1'],
    ['HFHistorialGastos', 'js/modulo-historial-gastos.js?v=15.1'],
    ['HFModuloGastos', 'js/modulo-gastos.js?v=15.1'],
    ['HFModuloDeudas', 'js/modulo-deudas.js?v=15.1'],
    ['HFModuloDashboard', 'js/modulo-dashboard.js?v=15.1']
  ];

  const ESTADO = {
    iniciando: null,
    iniciado: false,
    resultados: []
  };

  function cargar(globalEsperado, ruta) {
    if (window[globalEsperado]) {
      return Promise.resolve({ globalEsperado, ruta, estado: 'ya-cargado' });
    }

    const existente = document.querySelector(`script[data-hf-bootstrap="${globalEsperado}"]`);
    if (existente) {
      return new Promise(resolve => {
        const comprobar = () => resolve({
          globalEsperado,
          ruta,
          estado: window[globalEsperado] ? 'cargado' : 'sin-global'
        });
        existente.addEventListener('load', comprobar, { once: true });
        existente.addEventListener('error', () => resolve({ globalEsperado, ruta, estado: 'error' }), { once: true });
        setTimeout(comprobar, 1500);
      });
    }

    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = new URL(ruta, document.baseURI).href;
      script.async = false;
      script.dataset.hfBootstrap = globalEsperado;
      script.onload = () => resolve({
        globalEsperado,
        ruta,
        estado: window[globalEsperado] ? 'cargado' : 'sin-global'
      });
      script.onerror = () => resolve({ globalEsperado, ruta, estado: 'error' });
      document.body.appendChild(script);
    });
  }

  function diagnosticar(resultados) {
    const errores = resultados.filter(item => item.estado === 'error' || item.estado === 'sin-global');
    const diagnostico = {
      fecha: new Date().toISOString(),
      total: resultados.length,
      cargados: resultados.filter(item => ['cargado', 'ya-cargado'].includes(item.estado)).length,
      errores,
      listo: errores.length === 0
    };

    try {
      localStorage.setItem('hf_bootstrap_diagnostico', JSON.stringify(diagnostico));
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('hf:diagnostico-bootstrap', { detail: diagnostico }));
    return diagnostico;
  }

  async function iniciar() {
    if (ESTADO.iniciando) return ESTADO.iniciando;

    ESTADO.iniciando = (async () => {
      const resultados = [];
      for (const [globalEsperado, ruta] of MODULOS) {
        resultados.push(await cargar(globalEsperado, ruta));
      }

      ESTADO.resultados = resultados;
      const diagnostico = diagnosticar(resultados);

      try {
        await window.HFEstabilidadApp?.iniciar?.();
        await window.HFIntegracionFinancieraTotal?.ejecutarIntegracion?.({ motivo: 'bootstrap-avanzado' });
        window.HFModuloGastos?.instalarDecoradores?.();
        window.HFModuloDeudas?.instalarDecoradores?.();
        window.HFModuloDashboard?.programar?.('bootstrap-completado', 120);
      } catch (error) {
        window.HFEstabilidadApp?.registrarError?.('bootstrap-avanzado', error, { resultados });
        console.warn('Bootstrap avanzado completado con incidencias:', error);
      }

      ESTADO.iniciado = true;
      const detalle = { resultados, diagnostico };
      window.dispatchEvent(new CustomEvent('hf:bootstrap-avanzado-completado', { detail: detalle }));
      return detalle;
    })();

    return ESTADO.iniciando;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 100), { once: true });
  } else {
    setTimeout(iniciar, 100);
  }

  window.HFBootstrapAvanzado = Object.freeze({
    iniciar,
    obtenerEstado: () => ({
      iniciado: ESTADO.iniciado,
      resultados: [...ESTADO.resultados]
    })
  });
})();
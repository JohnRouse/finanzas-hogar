/* Hogar Finanzas — Recuperación: bootstrap estable y enfocado */
(() => {
  'use strict';

  if (window.__HF_BOOTSTRAP_AVANZADO__) return;
  window.__HF_BOOTSTRAP_AVANZADO__ = true;

  const MODULOS = [
    ['HFEstabilidadApp', 'js/estabilidad-app.js?v=16.0'],
    ['HFHistorialGastos', 'js/modulo-historial-gastos.js?v=16.0'],
    ['HFModuloGastos', 'js/modulo-gastos.js?v=16.0'],
    ['HFModuloDeudas', 'js/modulo-deudas.js?v=16.0'],
    ['HFModuloDashboard', 'js/modulo-dashboard.js?v=16.0'],
    ['HFRecuperacionProducto', 'js/recuperacion-producto.js?v=16.0']
  ];

  const ESTADO = { iniciando:null, iniciado:false, resultados:[] };

  function cargar(globalEsperado, ruta) {
    if (window[globalEsperado]) return Promise.resolve({ globalEsperado, ruta, estado:'ya-cargado' });
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = new URL(ruta, document.baseURI).href;
      script.async = false;
      script.dataset.hfBootstrap = globalEsperado;
      script.onload = () => resolve({ globalEsperado, ruta, estado:window[globalEsperado] ? 'cargado' : 'sin-global' });
      script.onerror = () => resolve({ globalEsperado, ruta, estado:'error' });
      document.body.appendChild(script);
    });
  }

  function diagnosticar(resultados) {
    const errores = resultados.filter(x => ['error','sin-global'].includes(x.estado));
    const diagnostico = {
      fecha:new Date().toISOString(),
      total:resultados.length,
      cargados:resultados.filter(x => ['cargado','ya-cargado'].includes(x.estado)).length,
      errores,
      listo:errores.length === 0
    };
    try { localStorage.setItem('hf_bootstrap_diagnostico', JSON.stringify(diagnostico)); } catch (_) {}
    window.dispatchEvent(new CustomEvent('hf:diagnostico-bootstrap', { detail:diagnostico }));
    return diagnostico;
  }

  async function iniciar() {
    if (ESTADO.iniciando) return ESTADO.iniciando;
    ESTADO.iniciando = (async () => {
      const resultados = [];
      for (const [globalEsperado, ruta] of MODULOS) resultados.push(await cargar(globalEsperado, ruta));
      ESTADO.resultados = resultados;
      const diagnostico = diagnosticar(resultados);
      try {
        await window.HFEstabilidadApp?.iniciar?.();
        window.HFModuloGastos?.instalarDecoradores?.();
        window.HFModuloDeudas?.instalarDecoradores?.();
        window.HFRecuperacionProducto?.iniciar?.();
        window.HFModuloDashboard?.programar?.('bootstrap-recuperacion', 120);
      } catch (error) {
        window.HFEstabilidadApp?.registrarError?.('bootstrap-recuperacion', error, { resultados });
        console.warn('Bootstrap de recuperación completado con incidencias:', error);
      }
      ESTADO.iniciado = true;
      const detalle = { resultados, diagnostico };
      window.dispatchEvent(new CustomEvent('hf:bootstrap-avanzado-completado', { detail:detalle }));
      return detalle;
    })();
    return ESTADO.iniciando;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar,100), { once:true });
  else setTimeout(iniciar,100);

  window.HFBootstrapAvanzado = Object.freeze({ iniciar, obtenerEstado:() => ({ iniciado:ESTADO.iniciado, resultados:[...ESTADO.resultados] }) });
})();
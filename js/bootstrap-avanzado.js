/* Hogar Finanzas — Recuperación: arranque mínimo y estable */
(() => {
  'use strict';

  if (window.__HF_BOOTSTRAP_AVANZADO__) return;
  window.__HF_BOOTSTRAP_AVANZADO__ = true;

  let promesaInicio = null;

  function cargarCSS(ruta) {
    if (document.querySelector('link[href*="ux-recuperacion.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(ruta, document.baseURI).href;
    link.dataset.hfUxRecuperacion = 'true';
    document.head.appendChild(link);
  }

  function cargar(globalEsperado, ruta) {
    if (window[globalEsperado]) return Promise.resolve({ globalEsperado, estado:'ya-cargado' });
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = new URL(ruta, document.baseURI).href;
      script.async = false;
      script.dataset.hfBootstrap = globalEsperado;
      script.onload = () => resolve({ globalEsperado, estado:window[globalEsperado] ? 'cargado' : 'sin-global' });
      script.onerror = () => resolve({ globalEsperado, estado:'error' });
      document.body.appendChild(script);
    });
  }

  async function iniciar() {
    if (promesaInicio) return promesaInicio;
    promesaInicio = (async () => {
      cargarCSS('css/ux-recuperacion.css?v=17.3');
      const resultados = [];
      resultados.push(await cargar('HFModalStack', 'js/modal-stack.js?v=17.3'));
      resultados.push(await cargar('HFConfirmacionesApp', 'js/confirmaciones-app.js?v=17.3'));
      resultados.push(await cargar('HFGastosSinVoucher', 'js/gastos-sin-voucher.js?v=17.3'));
      resultados.push(await cargar('HFRecuperacionProducto', 'js/recuperacion-producto.js?v=17.3'));
      resultados.push(await cargar('HFActualizadorSaldosTarjetas', 'js/actualizador-saldos-tarjetas.js?v=17.3'));
      resultados.push(await cargar('HFDiagnosticoVisual', 'js/diagnostico-visual.js?v=17.3'));
      try {
        window.HFModalStack?.iniciar?.();
        window.HFConfirmacionesApp?.iniciar?.();
        window.HFGastosSinVoucher?.instalar?.();
        window.HFRecuperacionProducto?.iniciar?.();
        window.HFActualizadorSaldosTarjetas?.iniciar?.();
        await window.HFDeudasActuales?.actualizar?.(true);
      } catch (error) {
        console.warn('La recuperación inició con una incidencia:', error);
      }
      const diagnostico = { fecha:new Date().toISOString(), resultados, listo:resultados.every(r=>['cargado','ya-cargado'].includes(r.estado)) };
      try { localStorage.setItem('hf_bootstrap_diagnostico', JSON.stringify(diagnostico)); } catch (_) {}
      window.dispatchEvent(new CustomEvent('hf:bootstrap-avanzado-completado',{detail:diagnostico}));
      return diagnostico;
    })();
    return promesaInicio;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(iniciar,100),{once:true});
  else setTimeout(iniciar,100);

  window.HFBootstrapAvanzado=Object.freeze({iniciar});
})();
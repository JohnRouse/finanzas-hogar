/* Hogar Finanzas — arranque estable de módulos avanzados */
(() => {
  'use strict';

  if (window.__HF_BOOTSTRAP_AVANZADO__) return;
  window.__HF_BOOTSTRAP_AVANZADO__ = true;

  const VERSION = '18.1';
  let promesaInicio = null;

  function cargarCSS(ruta, clave) {
    if (document.querySelector(`link[data-hf-css="${clave}"]`) || document.querySelector(`link[href*="${ruta.split('?')[0]}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(ruta, document.baseURI).href;
    link.dataset.hfCss = clave;
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
      cargarCSS(`css/ux-recuperacion.css?v=${VERSION}`, 'ux-recuperacion');
      cargarCSS(`css/cierre-financiero-mensual.css?v=${VERSION}`, 'cierre-financiero-mensual');
      cargarCSS(`css/deudas-familiares.css?v=${VERSION}`, 'deudas-familiares');

      const resultados = [];
      resultados.push(await cargar('HFModalStack', `js/modal-stack.js?v=${VERSION}`));
      resultados.push(await cargar('HFConfirmacionesApp', `js/confirmaciones-app.js?v=${VERSION}`));
      resultados.push(await cargar('HFGastosSinVoucher', `js/gastos-sin-voucher.js?v=${VERSION}`));
      resultados.push(await cargar('HFRecuperacionProducto', `js/recuperacion-producto.js?v=${VERSION}`));
      resultados.push(await cargar('HFActualizadorSaldosTarjetas', `js/actualizador-saldos-tarjetas.js?v=${VERSION}`));
      resultados.push(await cargar('HFCierreFinancieroMensual', `js/cierre-financiero-mensual.js?v=${VERSION}`));
      resultados.push(await cargar('HFDeudasFamiliares', `js/deudas-familiares.js?v=${VERSION}`));
      resultados.push(await cargar('HFDiagnosticoVisual', `js/diagnostico-visual.js?v=${VERSION}`));
      resultados.push(await cargar('HFDiagnosticoEtapa12', `js/diagnostico-etapa-12.js?v=${VERSION}`));

      try {
        window.HFModalStack?.iniciar?.();
        window.HFConfirmacionesApp?.iniciar?.();
        window.HFGastosSinVoucher?.instalar?.();
        window.HFRecuperacionProducto?.iniciar?.();
        window.HFActualizadorSaldosTarjetas?.iniciar?.();
        window.HFCierreFinancieroMensual?.iniciar?.();
        window.HFDeudasFamiliares?.iniciar?.();
        await window.HFDeudasActuales?.actualizar?.(true);
        await window.HFDeudasFamiliares?.renderizar?.();
      } catch (error) {
        console.warn('El arranque avanzado inició con una incidencia:', error);
      }

      const diagnostico = {
        version:VERSION,
        fecha:new Date().toISOString(),
        resultados,
        listo:resultados.every(r => ['cargado','ya-cargado'].includes(r.estado))
      };
      try { localStorage.setItem('hf_bootstrap_diagnostico', JSON.stringify(diagnostico)); } catch (_) {}
      window.dispatchEvent(new CustomEvent('hf:bootstrap-avanzado-completado', { detail:diagnostico }));
      return diagnostico;
    })();
    return promesaInicio;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 100), { once:true });
  else setTimeout(iniciar, 100);

  window.HFBootstrapAvanzado = Object.freeze({ iniciar, version:VERSION });
})();
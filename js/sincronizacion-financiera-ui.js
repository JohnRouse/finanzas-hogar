/* Hogar Finanzas — Etapa 11.4.3: sincronización reactiva entre Outlook, deuda y UI */
(() => {
  'use strict';

  let temporizador = null;
  let ultimoResumen = null;

  function toast(mensaje) {
    if (typeof window.showToast === 'function') window.showToast(mensaje);
    else console.info(mensaje);
  }

  function moneda(valor, codigo = 'PEN') {
    const numero = Number(valor || 0);
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: codigo === 'USD' ? 'USD' : 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numero);
  }

  function refrescarVistas(forzar = true) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      try {
        if (typeof window.actualizarCentroTarjetas === 'function') window.actualizarCentroTarjetas(forzar);
        if (typeof window.renderDeudas === 'function') window.renderDeudas();
        if (typeof window.cargarDeudas === 'function') window.cargarDeudas();
        if (typeof window.actualizarDashboard === 'function') window.actualizarDashboard();
      } catch (error) {
        console.warn('No se pudieron refrescar todas las vistas financieras:', error);
      }
    }, 120);
  }

  function destacarTarjeta(tarjetaId) {
    if (!tarjetaId) return;
    setTimeout(() => {
      const nodos = document.querySelectorAll('.hf-card-status');
      nodos.forEach(nodo => {
        const coincide = nodo.dataset.tarjetaId === tarjetaId || nodo.querySelector(`[data-tarjeta-id="${tarjetaId}"]`);
        if (!coincide) return;
        nodo.animate([
          { transform: 'scale(1)', boxShadow: '0 0 0 rgba(59,130,246,0)' },
          { transform: 'scale(1.012)', boxShadow: '0 0 0 4px rgba(59,130,246,.18)' },
          { transform: 'scale(1)', boxShadow: '0 0 0 rgba(59,130,246,0)' }
        ], { duration: 1300, easing: 'ease-out' });
      });
    }, 350);
  }

  function anunciarCambio(resumen = {}) {
    const anterior = ultimoResumen?.tarjetaId === resumen.tarjetaId ? ultimoResumen.deudaEstimada : null;
    const actual = Number(resumen.deudaEstimada || 0);
    let mensaje = `Tarjeta actualizada: deuda estimada ${moneda(actual, resumen.estadoCuenta?.moneda)}.`;
    if (anterior !== null && Number.isFinite(Number(anterior))) {
      const diferencia = actual - Number(anterior);
      if (Math.abs(diferencia) >= 0.01) mensaje += ` Cambio: ${diferencia > 0 ? '+' : '−'}${moneda(Math.abs(diferencia), resumen.estadoCuenta?.moneda)}.`;
    }
    ultimoResumen = resumen;
    toast(mensaje);
  }

  window.addEventListener('hf:deuda-actualizada', event => {
    const resumen = event.detail?.resumen || {};
    refrescarVistas(true);
    destacarTarjeta(event.detail?.tarjetaId || resumen.tarjetaId);
    anunciarCambio(resumen);
  });

  window.addEventListener('hf:deudas-recalculadas', event => {
    refrescarVistas(true);
    const total = event.detail?.totales?.deudaEstimada;
    if (Number.isFinite(Number(total))) toast(`Deudas recalculadas. Total estimado: ${moneda(total)}.`);
  });

  window.addEventListener('hf:estado-cuenta-confirmado', event => {
    refrescarVistas(true);
    destacarTarjeta(event.detail?.tarjetaId);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.getElementById('page-deudas')?.classList.contains('active')) refrescarVistas(false);
  });

  window.HFSincronizacionFinancieraUI = Object.freeze({ refrescarVistas, destacarTarjeta });
})();
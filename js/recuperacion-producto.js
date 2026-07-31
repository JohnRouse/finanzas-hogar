/* Hogar Finanzas — Recuperación del producto: limpieza y acciones esenciales */
(() => {
  'use strict';
  if (window.HFRecuperacionProducto) return;

  const estado = { iniciado: false, observer: null, timer: null, historialInstalado: false };
  const normalizar = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

  function limpiarOutlook() {
    document.getElementById('btn-outlook')?.remove();
    document.getElementById('outlookModal')?.remove();
    document.getElementById('hf-outlook-styles')?.remove();
    document.querySelectorAll('.modal-overlay,.modal,[role="dialog"]').forEach(el => {
      const texto = normalizar(el.textContent);
      if (texto.includes('microsoft entra') || texto.includes('client id') || texto.includes('tenant id')) el.remove();
    });
  }

  function limpiarExperimentosAnteriores() {
    document.getElementById('hf-centro-tarjetas')?.remove();
    document.getElementById('hf-centro-financiero-modal')?.remove();
    document.querySelectorAll('[data-hf-abrir-centro],.hf-mobile-fold').forEach(el => {
      if (el.classList.contains('hf-mobile-fold')) {
        const cuerpo = el.querySelector('.hf-mobile-fold-body');
        if (cuerpo && el.parentNode) {
          [...cuerpo.children].forEach(hijo => el.parentNode.insertBefore(hijo, el));
        }
      }
      el.remove();
    });
  }

  function agregarAccion(contenedor, texto, accion, clave) {
    if (!contenedor || contenedor.querySelector(`[data-hf-core-action="${clave}"]`)) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn-recurrentes';
    boton.dataset.hfCoreAction = clave;
    boton.textContent = texto;
    boton.addEventListener('click', () => {
      if (typeof window[accion] === 'function') window[accion]();
      else if (typeof window.showToast === 'function') window.showToast('Esta acción todavía no está disponible.');
    });
    contenedor.appendChild(boton);
  }

  function asegurarAccionesDeudas() {
    const pagina = document.getElementById('page-deudas');
    if (!pagina) return;

    const seccionTarjetas = document.getElementById('tarjetas-grid')?.closest('.section');
    const cabeceraTarjetas = seccionTarjetas?.querySelector('.section-head');
    agregarAccion(cabeceraTarjetas, '+ Tarjeta', 'abrirNuevaTarjeta', 'nueva-tarjeta');

    const seccionPrestamos = document.getElementById('prestamos-grid')?.closest('.section');
    const cabeceraPrestamos = seccionPrestamos?.querySelector('.section-head');
    agregarAccion(cabeceraPrestamos, '+ Préstamo', 'abrirNuevoPrestamo', 'nuevo-prestamo');
  }

  function nombreMesActual() {
    const visible = document.getElementById('month-display')?.textContent?.trim();
    if (visible) return visible;
    try {
      if (typeof DB?.formatMes === 'function' && typeof mesActual !== 'undefined') return DB.formatMes(mesActual);
    } catch (_) {}
    return new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  }

  function instalarHistorialSeguro() {
    if (estado.historialInstalado) return;
    if (typeof window.generarGastoHTML !== 'function' || typeof window.openModal !== 'function') return;

    window.abrirHistorialCompleto = function abrirHistorialCompletoSeguro() {
      const lista = document.getElementById('listaCompletaGastos');
      const modal = document.getElementById('modalHistorial');
      if (!lista || !modal) {
        window.showToast?.('No se pudo abrir el historial. Recarga la aplicación.');
        return false;
      }

      const titulo = document.getElementById('historialTitle');
      if (titulo) titulo.textContent = `Movimientos de ${nombreMesActual()}`;

      const buscador = document.getElementById('historial-search');
      const limpiar = document.getElementById('historial-search-clear');
      const sinResultados = document.getElementById('historial-no-resultados');
      if (buscador) buscador.value = '';
      if (limpiar) limpiar.style.display = 'none';
      if (sinResultados) sinResultados.style.display = 'none';

      let gastos = [];
      let configuracion = {};
      try {
        if (typeof gastosDelMesCache !== 'undefined' && Array.isArray(gastosDelMesCache)) gastos = gastosDelMesCache;
        if (typeof configCache !== 'undefined' && configCache) configuracion = configCache;
      } catch (_) {}

      lista.innerHTML = gastos.length
        ? gastos.map(gasto => window.generarGastoHTML(gasto, configuracion)).join('')
        : '<div class="empty-state">Sin movimientos registrados en este mes.</div>';

      window.openModal('modalHistorial');
      requestAnimationFrame(() => {
        try {
          if (typeof window.initGesturesModal === 'function') setTimeout(window.initGesturesModal, 50);
        } catch (_) {}
      });
      return true;
    };

    estado.historialInstalado = true;
  }

  function aplicar() {
    limpiarOutlook();
    limpiarExperimentosAnteriores();
    asegurarAccionesDeudas();
    instalarHistorialSeguro();
  }

  function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado = true;
    aplicar();
    estado.observer = new MutationObserver(() => {
      clearTimeout(estado.timer);
      estado.timer = setTimeout(aplicar, 120);
    });
    estado.observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hf:dashboard-actualizado', aplicar);
    window.addEventListener('hf:deudas-core-actualizadas', aplicar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.HFRecuperacionProducto = Object.freeze({ iniciar, aplicar, instalarHistorialSeguro });
})();
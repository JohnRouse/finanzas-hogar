/* Hogar Finanzas — Recuperación del producto: limpieza y acciones esenciales */
(() => {
  'use strict';
  if (window.HFRecuperacionProducto) return;

  const estado = { iniciado: false, observer: null, timer: null };
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

  function aplicar() {
    limpiarOutlook();
    limpiarExperimentosAnteriores();
    asegurarAccionesDeudas();
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

  window.HFRecuperacionProducto = Object.freeze({ iniciar, aplicar });
})();
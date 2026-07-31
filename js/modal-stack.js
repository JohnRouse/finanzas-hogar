/* Hogar Finanzas — Gestor de modales anidados */
(() => {
  'use strict';
  if (window.HFModalStack) return;

  const BASE_Z = 12000;
  let secuencia = 0;
  let instalado = false;
  let observer = null;

  const estaAbierto = modal => modal?.classList.contains('open') || modal?.classList.contains('active');

  function modalesAbiertos() {
    return [...document.querySelectorAll('.modal-overlay')].filter(estaAbierto);
  }

  function asegurarOrden(modal, elevar = false) {
    if (!modal) return;
    if (elevar || !modal.dataset.hfModalOrder) {
      modal.dataset.hfModalOrder = String(++secuencia);
    }
  }

  function aplicarPila() {
    const abiertos = modalesAbiertos();
    abiertos.forEach(modal => asegurarOrden(modal));
    abiertos.sort((a, b) => Number(a.dataset.hfModalOrder || 0) - Number(b.dataset.hfModalOrder || 0));

    document.querySelectorAll('.modal-overlay.hf-modal-top,.modal-overlay.hf-modal-under').forEach(modal => {
      modal.classList.remove('hf-modal-top', 'hf-modal-under');
      modal.removeAttribute('aria-hidden');
      modal.style.removeProperty('--hf-modal-z');
    });

    abiertos.forEach((modal, indice) => {
      const esSuperior = indice === abiertos.length - 1;
      modal.style.setProperty('--hf-modal-z', String(BASE_Z + indice * 20));
      modal.classList.add(esSuperior ? 'hf-modal-top' : 'hf-modal-under');
      modal.setAttribute('aria-hidden', esSuperior ? 'false' : 'true');
      modal.dataset.hfObservedOpen = '1';
    });

    document.querySelectorAll('.modal-overlay:not(.open):not(.active)').forEach(modal => {
      modal.dataset.hfObservedOpen = '0';
    });

    document.body.classList.toggle('hf-has-stacked-modals', abiertos.length > 1);
    return abiertos;
  }

  function envolverFunciones() {
    if (typeof window.openModal === 'function' && !window.openModal.__hfModalStack) {
      const originalOpen = window.openModal;
      const envuelta = function(id, ...args) {
        const modal = document.getElementById(id);
        asegurarOrden(modal, true);
        const resultado = originalOpen.call(this, id, ...args);
        requestAnimationFrame(aplicarPila);
        return resultado;
      };
      envuelta.__hfModalStack = true;
      envuelta.__hfOriginal = originalOpen;
      window.openModal = envuelta;
    }

    if (typeof window.closeModal === 'function' && !window.closeModal.__hfModalStack) {
      const originalClose = window.closeModal;
      const envuelta = function(id, ...args) {
        const resultado = originalClose.call(this, id, ...args);
        const modal = document.getElementById(id);
        if (modal) {
          delete modal.dataset.hfModalOrder;
          modal.dataset.hfObservedOpen = '0';
        }
        requestAnimationFrame(aplicarPila);
        return resultado;
      };
      envuelta.__hfModalStack = true;
      envuelta.__hfOriginal = originalClose;
      window.closeModal = envuelta;
    }
  }

  function inyectarEstilos() {
    if (document.getElementById('hf-modal-stack-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-modal-stack-styles';
    style.textContent = `
      .modal-overlay.hf-modal-top,
      .modal-overlay.hf-modal-under { z-index:var(--hf-modal-z)!important; }
      .modal-overlay.hf-modal-under { pointer-events:none!important; }
      .modal-overlay.hf-modal-under::before { pointer-events:none!important; }
      .modal-overlay.hf-modal-top { pointer-events:auto!important; }
      body.hf-has-stacked-modals .modal-overlay.hf-modal-under {
        background:rgba(15,23,42,.18)!important;
        -webkit-backdrop-filter:none!important;
        backdrop-filter:none!important;
      }
      body.hf-has-stacked-modals .modal-overlay.hf-modal-top {
        background:rgba(15,23,42,.48)!important;
        -webkit-backdrop-filter:blur(5px)!important;
        backdrop-filter:blur(5px)!important;
      }
    `;
    document.head.appendChild(style);
  }

  function instalarObserver() {
    if (observer) return;
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.dataset.hfObservedOpen = estaAbierto(modal) ? '1' : '0';
    });

    observer = new MutationObserver(cambios => {
      let requiereActualizar = false;
      cambios.forEach(cambio => {
        if (cambio.type !== 'attributes' || cambio.attributeName !== 'class') return;
        const modal = cambio.target;
        if (!modal.classList?.contains('modal-overlay')) return;

        const abierto = estaAbierto(modal);
        const observado = modal.dataset.hfObservedOpen === '1';
        if (abierto === observado) return;

        modal.dataset.hfObservedOpen = abierto ? '1' : '0';
        if (abierto) asegurarOrden(modal, true);
        else delete modal.dataset.hfModalOrder;
        requiereActualizar = true;
      });
      if (requiereActualizar) requestAnimationFrame(aplicarPila);
    });
    observer.observe(document.body, { subtree:true, attributes:true, attributeFilter:['class'] });
  }

  function cerrarSuperiorConEscape(event) {
    if (event.key !== 'Escape') return;
    const abiertos = aplicarPila();
    const superior = abiertos[abiertos.length - 1];
    if (!superior) return;
    event.preventDefault();
    if (typeof window.closeModal === 'function') window.closeModal(superior.id);
    else superior.classList.remove('open', 'active');
  }

  function iniciar() {
    if (instalado) return;
    instalado = true;
    inyectarEstilos();
    envolverFunciones();
    instalarObserver();
    document.addEventListener('keydown', cerrarSuperiorConEscape);
    aplicarPila();
  }

  window.HFModalStack = Object.freeze({ iniciar, aplicarPila, obtenerAbiertos:modalesAbiertos });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();
})();
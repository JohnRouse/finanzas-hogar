/* Hogar Finanzas — Gestor accesible de modales anidados sin parpadeos */
(() => {
  'use strict';
  if (window.HFModalStack) return;

  const BASE_Z = 12000;
  const focoPrevioPorModal = new WeakMap();
  let secuencia = 0;
  let instalado = false;
  let observer = null;

  const estaAbierto = modal => modal?.classList.contains('open') || modal?.classList.contains('active');
  const resolverModal = valor => typeof valor === 'string' ? document.getElementById(valor) : valor;

  function modalesAbiertos() {
    return [...document.querySelectorAll('.modal-overlay')].filter(estaAbierto);
  }

  function asegurarOrden(modal, elevar = false) {
    if (!modal) return;
    if (elevar || !modal.dataset.hfModalOrder) modal.dataset.hfModalOrder = String(++secuencia);
  }

  function esVisible(elemento) {
    if (!elemento) return false;
    const estilo = getComputedStyle(elemento);
    return estilo.display !== 'none' && estilo.visibility !== 'hidden' && elemento.getClientRects().length > 0;
  }

  function primerEnfocable(modal) {
    if (!modal) return null;
    const selector = [
      '[autofocus]',
      '.modal-close:not([disabled])',
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return [...modal.querySelectorAll(selector)].find(esVisible) || null;
  }

  function quitarFocoSiQuedaraInerte(modalSuperior, lista) {
    const activo = document.activeElement;
    if (!activo || activo === document.body || modalSuperior?.contains(activo)) return;
    const contenedor = activo.closest?.('.modal-overlay');
    if (!contenedor || !lista.includes(contenedor) || contenedor === modalSuperior) return;
    try { activo.blur(); } catch (_) {}
  }

  function enfocarSuperior(modal, forzar = false) {
    if (!modal || !estaAbierto(modal)) return false;
    const activo = document.activeElement;
    if (!forzar && activo && modal.contains(activo)) return true;
    const destino = primerEnfocable(modal);
    if (!destino) return false;
    try {
      destino.focus({ preventScroll: true });
      return true;
    } catch (_) {
      try { destino.focus(); return true; } catch (_) { return false; }
    }
  }

  function programarFoco(modal, forzar = false) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => enfocarSuperior(modal, forzar));
    });
  }

  function limpiarEstadoModal(modal) {
    if (!modal) return;
    modal.inert = false;
    modal.removeAttribute('inert');
    modal.removeAttribute('aria-hidden');
    modal.classList.remove('hf-modal-top', 'hf-modal-under');
    modal.style.removeProperty('--hf-modal-z');
  }

  function pintarPila(lista, preparado = null) {
    const unicos = [...new Set(lista.filter(Boolean))];
    unicos.forEach(modal => asegurarOrden(modal));
    unicos.sort((a, b) => Number(a.dataset.hfModalOrder || 0) - Number(b.dataset.hfModalOrder || 0));
    const superior = unicos[unicos.length - 1] || null;

    quitarFocoSiQuedaraInerte(superior, unicos);

    document.querySelectorAll('.modal-overlay.hf-modal-top,.modal-overlay.hf-modal-under').forEach(modal => {
      if (modal === preparado || unicos.includes(modal)) return;
      limpiarEstadoModal(modal);
    });

    unicos.forEach((modal, indice) => {
      const esSuperior = modal === superior;
      modal.style.setProperty('--hf-modal-z', String(BASE_Z + indice * 20));
      modal.classList.toggle('hf-modal-top', esSuperior);
      modal.classList.toggle('hf-modal-under', !esSuperior);

      // `inert` impide interacción y navegación por teclado en los modales que
      // quedan debajo. No usamos aria-hidden, porque ocultar un ancestro que aún
      // conserva el foco genera advertencias y una experiencia incorrecta para
      // lectores de pantalla.
      modal.inert = !esSuperior;
      if (esSuperior) modal.removeAttribute('inert');
      else modal.setAttribute('inert', '');
      modal.removeAttribute('aria-hidden');

      if (estaAbierto(modal)) modal.dataset.hfObservedOpen = '1';
    });

    document.body.classList.toggle('hf-has-stacked-modals', unicos.length > 1);
    return unicos;
  }

  function aplicarPila() {
    const abiertos = modalesAbiertos();
    abiertos.forEach(modal => asegurarOrden(modal));

    document.querySelectorAll('.modal-overlay:not(.open):not(.active)').forEach(modal => {
      modal.dataset.hfObservedOpen = '0';
      if (modal.dataset.hfPreparedOpen !== '1') limpiarEstadoModal(modal);
    });

    return pintarPila(abiertos);
  }

  function prepararApertura(valor) {
    const modal = resolverModal(valor);
    if (!modal) return false;

    const focoActual = document.activeElement;
    if (focoActual && focoActual !== document.body && focoActual.isConnected) {
      focoPrevioPorModal.set(modal, focoActual);
    }

    const abiertos = modalesAbiertos().filter(actual => actual !== modal);
    asegurarOrden(modal, true);
    modal.dataset.hfPreparedOpen = '1';

    // Se asignan la posición y el estado inerte antes de que el nuevo modal sea
    // visible, evitando que aparezca un fotograma detrás de otro modal.
    pintarPila([...abiertos, modal], modal);
    return true;
  }

  function confirmarApertura(modal) {
    if (!modal) return;
    delete modal.dataset.hfPreparedOpen;
    aplicarPila();
    programarFoco(modal);
  }

  function restaurarFoco(modalCerrado, abiertos) {
    const superior = abiertos[abiertos.length - 1] || null;
    const previo = focoPrevioPorModal.get(modalCerrado);
    focoPrevioPorModal.delete(modalCerrado);

    requestAnimationFrame(() => {
      if (previo?.isConnected && !previo.closest?.('[inert]') && (!superior || superior.contains(previo))) {
        try { previo.focus({ preventScroll: true }); return; } catch (_) {
          try { previo.focus(); return; } catch (_) {}
        }
      }
      if (superior) enfocarSuperior(superior, true);
    });
  }

  function envolverFunciones() {
    if (typeof window.openModal === 'function' && !window.openModal.__hfModalStack) {
      const originalOpen = window.openModal;
      const envuelta = function(id, ...args) {
        const modal = document.getElementById(id);
        prepararApertura(modal);
        const resultado = originalOpen.call(this, id, ...args);
        confirmarApertura(modal);
        return resultado;
      };
      envuelta.__hfModalStack = true;
      envuelta.__hfOriginal = originalOpen;
      window.openModal = envuelta;
    }

    if (typeof window.closeModal === 'function' && !window.closeModal.__hfModalStack) {
      const originalClose = window.closeModal;
      const envuelta = function(id, ...args) {
        const modal = document.getElementById(id);
        const activo = document.activeElement;
        if (modal?.contains(activo)) {
          try { activo.blur(); } catch (_) {}
        }

        const resultado = originalClose.call(this, id, ...args);
        if (modal) {
          delete modal.dataset.hfModalOrder;
          delete modal.dataset.hfPreparedOpen;
          modal.dataset.hfObservedOpen = '0';
          limpiarEstadoModal(modal);
        }
        const abiertos = aplicarPila();
        restaurarFoco(modal, abiertos);
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
      const recienAbiertos = [];

      cambios.forEach(cambio => {
        if (cambio.type !== 'attributes' || cambio.attributeName !== 'class') return;
        const modal = cambio.target;
        if (!modal.classList?.contains('modal-overlay')) return;

        const abierto = estaAbierto(modal);
        const observado = modal.dataset.hfObservedOpen === '1';
        if (abierto === observado) return;

        modal.dataset.hfObservedOpen = abierto ? '1' : '0';
        if (abierto) {
          if (modal.dataset.hfPreparedOpen !== '1') asegurarOrden(modal, true);
          delete modal.dataset.hfPreparedOpen;
          recienAbiertos.push(modal);
        } else {
          const activo = document.activeElement;
          if (modal.contains(activo)) {
            try { activo.blur(); } catch (_) {}
          }
          delete modal.dataset.hfModalOrder;
          delete modal.dataset.hfPreparedOpen;
          limpiarEstadoModal(modal);
        }
        requiereActualizar = true;
      });

      if (requiereActualizar) {
        const abiertos = aplicarPila();
        const superior = abiertos[abiertos.length - 1];
        if (recienAbiertos.includes(superior)) programarFoco(superior);
      }
    });
    observer.observe(document.body, { subtree:true, attributes:true, attributeFilter:['class'] });
  }

  function anticiparAccionesHistorial(event) {
    const boton = event.target?.closest?.('#hfExpenseMenuPortal button');
    if (!boton) return;
    const texto = String(boton.textContent || '').toLowerCase();
    if (texto.includes('editar')) prepararApertura('gastoModal');
    if (texto.includes('eliminar')) prepararApertura('modalConfirm');
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

  function obtenerEstadoAccesibilidad() {
    const fondos = [...document.querySelectorAll('.modal-overlay.hf-modal-under')];
    return {
      usaInert: fondos.every(modal => modal.inert || modal.hasAttribute('inert')),
      fondosConAriaHidden: fondos.filter(modal => modal.hasAttribute('aria-hidden')).map(modal => modal.id || '(sin id)'),
      focoEnFondo: fondos.some(modal => modal.contains(document.activeElement)),
      modalesAbiertos: modalesAbiertos().length
    };
  }

  function iniciar() {
    if (instalado) return;
    instalado = true;
    inyectarEstilos();
    envolverFunciones();
    instalarObserver();
    document.addEventListener('click', anticiparAccionesHistorial, true);
    document.addEventListener('keydown', cerrarSuperiorConEscape);
    aplicarPila();
  }

  window.HFModalStack = Object.freeze({
    iniciar,
    aplicarPila,
    prepararApertura,
    obtenerAbiertos:modalesAbiertos,
    obtenerEstadoAccesibilidad
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();
})();
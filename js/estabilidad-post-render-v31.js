(() => {
  'use strict';

  const VERSION = '31.0';
  if (window.HFEstabilidadPostRender31?.version === VERSION) return;

  const state = {
    repairTimer: null,
    movementTimer: null,
    debtTimer: null,
    observer: null,
    repairingMovements: false,
    repairingDebts: false,
    lastMovementRepair: 0,
    lastDebtRepair: 0
  };

  const $ = id => document.getElementById(id);
  const now = () => Date.now();

  function normalize(value = '') {
    return String(value).toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function classicCategoryIcon(item = {}) {
    const category = normalize(item.cat || item.categoria || 'otros');

    if (item.tipoMovimiento === 'pagoTarjeta' || /^pago\s+tarjeta:/i.test(item.desc || '')) return '💳';
    if (item.tipoMovimiento === 'pagoPrestamo' || /^pago\s+prestamo:/i.test(normalize(item.desc || ''))) return '🏦';
    if (category.includes('aliment')) return '🛒';
    if (category.includes('servicio')) return '⚡';
    if (category.includes('entret') || category.includes('ocio')) return '🎬';
    if (category.includes('transport')) return '🚕';
    if (category.includes('salud') || category.includes('medic')) return '💊';
    if (category.includes('hogar') || category.includes('casa')) return '🏠';
    if (category.includes('educ')) return '🎓';
    if (category.includes('deuda')) return '💳';

    const stored = String(item.icono || '').trim();
    const paymentMethodIcons = new Set(['💳', '✈️', '💸', '💵', '📲', '💰']);
    if (stored && !stored.includes('<svg') && !paymentMethodIcons.has(stored)) return stored;
    return '📦';
  }

  function currentMovementElements(root = document) {
    return [...root.querySelectorAll?.('.hf-v28-movement') || []];
  }

  function movementDomIsLegacy() {
    const summary = $('expenseList');
    if (!summary) return false;
    if (summary.querySelector('.expense-item, .hf-v27-movement, .expense-swipe-wrap')) return true;
    if (summary.children.length && !summary.querySelector('.hf-v28-movement') && !summary.querySelector('.empty-state, .skeleton-item')) return true;
    return false;
  }

  function patchMovementIcons(root = document) {
    const source = window.HFExperienciaIntegrada29;
    const movements = source?.getMovements?.() || null;
    const byId = movements ? new Map(movements.map(item => [String(item.id), item])) : null;

    currentMovementElements(root).forEach(element => {
      const id = String(element.dataset.movementId || '');
      const item = byId?.get(id);
      const icon = element.querySelector('.hf-v28-movement-icon');
      if (!icon) return;

      if (item) {
        icon.innerHTML = `<span class="hf-v29-classic-icon" aria-hidden="true">${classicCategoryIcon(item)}</span>`;
        icon.classList.add('hf-v29-classic-category');
      }

      const amount = element.querySelector('.hf-v28-movement-amount strong');
      if (amount) amount.style.setProperty('color', '#172033', 'important');
    });
  }

  async function repairMovements(forceReload = false) {
    if (state.repairingMovements) return;
    const elapsed = now() - state.lastMovementRepair;
    if (!forceReload && elapsed < 120) return;

    state.repairingMovements = true;
    state.lastMovementRepair = now();
    try {
      if (forceReload || movementDomIsLegacy()) {
        await window.HFExperienciaIntegrada28?.reloadMovements?.();
      } else {
        window.HFExperienciaIntegrada28?.repair?.();
      }
      await window.HFExperienciaIntegrada29?.reload?.();
      window.HFExperienciaIntegrada29?.patchRenderedMovements?.();
      patchMovementIcons();
      window.HFExperienciaIntegrada30?.repair?.();
    } catch (error) {
      console.warn('No se pudo estabilizar Movimientos V31:', error);
    } finally {
      state.repairingMovements = false;
    }
  }

  function debtDomIsLegacy() {
    const view = $('hf-family-debt-view');
    if (!view) return false;
    return [...view.querySelectorAll('.hf-family-card')].some(card => {
      const isLatest = card.classList.contains('hf-v24-debt-card')
        && !!card.querySelector('.hf-v24-card-head')
        && !!card.querySelector('.hf-v24-actions');
      return !isLatest;
    });
  }

  function invalidateLegacyDebtSignatures() {
    const view = $('hf-family-debt-view');
    if (!view) return;
    view.querySelectorAll('.hf-family-card').forEach(card => {
      const isLatest = card.classList.contains('hf-v24-debt-card')
        && !!card.querySelector('.hf-v24-card-head')
        && !!card.querySelector('.hf-v24-actions');
      if (!isLatest) {
        delete card.dataset.hfV24Signature;
        delete card.dataset.hfV25Normalized;
      }
    });
  }

  async function repairDebts(force = false) {
    if (state.repairingDebts) return;
    const elapsed = now() - state.lastDebtRepair;
    if (!force && elapsed < 120) return;

    state.repairingDebts = true;
    state.lastDebtRepair = now();
    try {
      if (force || debtDomIsLegacy()) invalidateLegacyDebtSignatures();
      await window.HFDeudasRedesign24?.renderDebtPage?.();
      window.HFDeudasFixes25?.repair?.();
      window.HFTarjetasConsistencia26?.repair?.();
      window.HFExperienciaIntegrada30?.repair?.();
    } catch (error) {
      console.warn('No se pudo estabilizar Deudas V31:', error);
    } finally {
      state.repairingDebts = false;
    }
  }

  function repairAll(force = false) {
    clearTimeout(state.repairTimer);
    state.repairTimer = setTimeout(() => {
      repairMovements(force);
      repairDebts(force);
    }, force ? 20 : 100);
  }

  function scheduleMovementRepair(force = false) {
    clearTimeout(state.movementTimer);
    state.movementTimer = setTimeout(() => repairMovements(force), force ? 20 : 90);
  }

  function scheduleDebtRepair(force = false) {
    clearTimeout(state.debtTimer);
    state.debtTimer = setTimeout(() => repairDebts(force), force ? 20 : 90);
  }

  function installMutationObserver() {
    if (state.observer) return;
    state.observer = new MutationObserver(mutations => {
      let movementsChanged = false;
      let debtsChanged = false;

      for (const mutation of mutations) {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (!target) continue;
        if (target.closest('#expenseList, #listaCompletaGastos')) movementsChanged = true;
        if (target.closest('#hf-family-debt-view')) debtsChanged = true;

        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches?.('#expenseList, #listaCompletaGastos, .expense-item, .hf-v27-movement, .hf-v28-movement')
            || node.querySelector?.('.expense-item, .hf-v27-movement, .hf-v28-movement')) movementsChanged = true;
          if (node.matches?.('#hf-family-debt-view, .hf-family-card')
            || node.querySelector?.('.hf-family-card')) debtsChanged = true;
        });
      }

      if (movementsChanged) scheduleMovementRepair(movementDomIsLegacy());
      if (debtsChanged) scheduleDebtRepair(debtDomIsLegacy());
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function installPostSaveHooks() {
    const events = [
      'hf:gastos-actualizados',
      'hf:deuda-actualizada',
      'hf:deudas-core-actualizadas',
      'hf:estado-cuenta-confirmado',
      'hf:deudas-recalculadas'
    ];
    events.forEach(name => window.addEventListener(name, () => repairAll(true)));

    document.addEventListener('click', event => {
      if (event.target.closest('#gasto-submit-btn, #gastoModal .modal-btn.primary, #editGastoModal .modal-btn.primary')) {
        setTimeout(() => repairAll(true), 180);
        setTimeout(() => repairAll(true), 700);
        setTimeout(() => repairAll(true), 1600);
      }
    }, true);
  }

  function start() {
    installMutationObserver();
    installPostSaveHooks();
    repairAll(true);

    let attempts = 0;
    const bootstrap = setInterval(() => {
      repairAll(true);
      attempts += 1;
      if (attempts >= 24) clearInterval(bootstrap);
    }, 500);
  }

  window.HFEstabilidadPostRender31 = Object.freeze({
    version: VERSION,
    repairAll,
    repairMovements,
    repairDebts,
    invalidateLegacyDebtSignatures,
    classicCategoryIcon
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
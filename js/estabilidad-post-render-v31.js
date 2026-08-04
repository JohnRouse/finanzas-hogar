(() => {
  'use strict';

  const VERSION = '31.2';
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

  function currentMovementElements(root = document) {
    return [...(root.querySelectorAll?.('.hf-v28-movement') || [])];
  }

  function movementDomIsLegacy() {
    const summary = $('expenseList');
    if (!summary) return false;
    if (summary.querySelector('.expense-item, .hf-v27-movement, .expense-swipe-wrap')) return true;
    if (summary.children.length && !summary.querySelector('.hf-v28-movement') && !summary.querySelector('.empty-state, .skeleton-item')) return true;
    return false;
  }

  function normalizeMovementAppearance(root = document) {
    currentMovementElements(root).forEach(element => {
      element.querySelector('.hf-v28-movement-icon')?.classList.add('hf-v29-classic-category');
      const amount = element.querySelector('.hf-v28-movement-amount strong');
      if (amount) amount.style.setProperty('color', '#172033', 'important');
    });
  }

  async function repairMovements(forceReload = false) {
    if (state.repairingMovements) return;
    const elapsed = now() - state.lastMovementRepair;
    if (!forceReload && elapsed < 180) return;

    state.repairingMovements = true;
    state.lastMovementRepair = now();
    try {
      const legacy = movementDomIsLegacy();
      if (forceReload || legacy) {
        await window.HFExperienciaIntegrada28?.reloadMovements?.();
        await window.HFExperienciaIntegrada29?.reload?.();
      } else {
        window.HFExperienciaIntegrada28?.repair?.();
      }
      window.HFExperienciaIntegrada29?.patchRenderedMovements?.();
      normalizeMovementAppearance();
      window.HFExperienciaIntegrada30?.repair?.();
    } catch (error) {
      console.warn('No se pudo estabilizar Movimientos V31.2:', error);
    } finally {
      state.repairingMovements = false;
    }
  }

  function debtDomIsLegacy() {
    const view = $('hf-family-debt-view');
    if (!view) return false;
    return [...view.querySelectorAll('.hf-family-card')].some(card => {
      return !(card.classList.contains('hf-v24-debt-card')
        && card.querySelector('.hf-v24-card-head')
        && card.querySelector('.hf-v24-actions'));
    });
  }

  function invalidateLegacyDebtSignatures() {
    const view = $('hf-family-debt-view');
    if (!view) return;
    view.querySelectorAll('.hf-family-card').forEach(card => {
      const latest = card.classList.contains('hf-v24-debt-card')
        && card.querySelector('.hf-v24-card-head')
        && card.querySelector('.hf-v24-actions');
      if (!latest) {
        delete card.dataset.hfV24Signature;
        delete card.dataset.hfV25Normalized;
      }
    });
  }

  async function repairDebts(force = false) {
    if (state.repairingDebts) return;
    const elapsed = now() - state.lastDebtRepair;
    if (!force && elapsed < 180) return;

    state.repairingDebts = true;
    state.lastDebtRepair = now();
    try {
      if (force || debtDomIsLegacy()) invalidateLegacyDebtSignatures();
      await window.HFDeudasRedesign24?.renderDebtPage?.();
      window.HFDeudasFixes25?.repair?.();
      window.HFTarjetasConsistencia26?.repair?.();
      window.HFExperienciaIntegrada30?.repair?.();
    } catch (error) {
      console.warn('No se pudo estabilizar Deudas V31.2:', error);
    } finally {
      state.repairingDebts = false;
    }
  }

  function repairAll(force = false) {
    clearTimeout(state.repairTimer);
    state.repairTimer = setTimeout(() => {
      repairMovements(force);
      repairDebts(force);
    }, force ? 30 : 120);
  }

  function scheduleMovementRepair(force = false) {
    clearTimeout(state.movementTimer);
    state.movementTimer = setTimeout(() => repairMovements(force), force ? 30 : 110);
  }

  function scheduleDebtRepair(force = false) {
    clearTimeout(state.debtTimer);
    state.debtTimer = setTimeout(() => repairDebts(force), force ? 30 : 110);
  }

  function installMutationObserver() {
    if (state.observer) return;
    state.observer = new MutationObserver(mutations => {
      let movementsChanged = false;
      let debtsChanged = false;

      for (const mutation of mutations) {
        const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (target?.closest('#expenseList, #listaCompletaGastos')) movementsChanged = true;
        if (target?.closest('#hf-family-debt-view')) debtsChanged = true;

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

    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  function installPostSaveHooks() {
    [
      'hf:gastos-actualizados',
      'hf:deuda-actualizada',
      'hf:deudas-core-actualizadas',
      'hf:estado-cuenta-confirmado',
      'hf:deudas-recalculadas'
    ].forEach(name => window.addEventListener(name, () => repairAll(false)));

    document.addEventListener('click', event => {
      if (!event.target.closest('#gasto-submit-btn, #gastoModal .modal-btn.primary, #editGastoModal .modal-btn.primary')) return;
      setTimeout(() => repairAll(false), 260);
      setTimeout(() => repairAll(false), 950);
    }, true);
  }

  function start() {
    installMutationObserver();
    installPostSaveHooks();
    repairAll(true);
  }

  window.HFEstabilidadPostRender31 = Object.freeze({
    version: VERSION,
    repairAll,
    repairMovements,
    repairDebts,
    invalidateLegacyDebtSignatures
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
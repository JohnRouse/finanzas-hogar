(() => {
  'use strict';

  const VERSION = '33.2';
  if (window.HFHotfix331?.version === VERSION) return;

  const state = {
    timer: null,
    rendering: false,
    retries: 0
  };

  function visibleFinalCards() {
    return document.querySelectorAll('#hf-family-debt-view .hf-v24-debt-card').length > 0;
  }

  function syncReadyState() {
    document.body?.classList.toggle('hf-debt-v33-ready', visibleFinalCards());
  }

  async function renderDebtSafely(force = false) {
    if (state.rendering) return;
    if (!force && visibleFinalCards()) {
      syncReadyState();
      return;
    }

    const view = document.getElementById('hf-family-debt-view');
    const lists = view?.querySelectorAll('.hf-family-card-list');
    const renderer = window.HFDeudasRedesign24?.renderDebtPage;

    if (!view || !lists || lists.length < 2 || typeof renderer !== 'function') {
      syncReadyState();
      return;
    }

    state.rendering = true;
    try {
      await renderer();
    } catch (error) {
      console.warn('La vista final de Deudas no pudo reconstruirse; se conserva la vista de respaldo.', error);
    } finally {
      state.rendering = false;
      syncReadyState();
    }
  }

  function scheduleDebtRender(delay = 0, force = false) {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => renderDebtSafely(force), delay);
  }

  function retryUntilReady() {
    if (visibleFinalCards() || state.retries >= 4) {
      syncReadyState();
      return;
    }
    state.retries += 1;
    renderDebtSafely(false).finally(() => {
      if (!visibleFinalCards()) setTimeout(retryUntilReady, 450);
    });
  }

  function preserveFabSymbol() {
    const fab = document.getElementById('fab-global');
    if (!fab) return;
    if (!fab.textContent.trim()) fab.textContent = '+';
    fab.style.setProperty('text-indent', '0', 'important');
    fab.style.setProperty('overflow', 'visible', 'important');
  }

  function start() {
    preserveFabSymbol();
    retryUntilReady();

    ['hf:deuda-actualizada', 'hf:deudas-core-actualizadas', 'hf:estado-cuenta-confirmado', 'hf:deudas-recalculadas']
      .forEach(name => window.addEventListener(name, () => scheduleDebtRender(60, true)));

    document.addEventListener('click', event => {
      if (!event.target.closest('.tab, .bnav-btn')) return;
      preserveFabSymbol();
      const debtPage = document.getElementById('page-deudas');
      if (debtPage?.classList.contains('active') && !visibleFinalCards()) {
        scheduleDebtRender(0, false);
      }
    });
  }

  window.HFHotfix331 = Object.freeze({
    version: VERSION,
    renderDebtSafely,
    syncReadyState
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

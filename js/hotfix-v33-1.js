(() => {
  'use strict';

  const VERSION = '33.1';
  if (window.HFHotfix331?.version === VERSION) return;

  const state = {
    observer: null,
    timer: null,
    rendering: false
  };

  function visibleFinalCards() {
    return document.querySelectorAll('#hf-family-debt-view .hf-v24-debt-card').length > 0;
  }

  function syncReadyState() {
    document.body?.classList.toggle('hf-debt-v33-ready', visibleFinalCards());
  }

  async function renderDebtSafely() {
    if (state.rendering) return;
    const view = document.getElementById('hf-family-debt-view');
    const lists = view?.querySelectorAll('.hf-family-card-list');
    if (!view || !lists || lists.length < 2) {
      syncReadyState();
      return;
    }

    state.rendering = true;
    try {
      const renderer = window.HFDeudasRedesign24?.renderDebtPage;
      if (typeof renderer === 'function') await renderer();
    } catch (error) {
      console.warn('La vista final de Deudas no pudo reconstruirse; se conserva la vista de respaldo.', error);
    } finally {
      state.rendering = false;
      syncReadyState();
    }
  }

  function scheduleDebtRender(delay = 0) {
    clearTimeout(state.timer);
    state.timer = setTimeout(renderDebtSafely, delay);
  }

  function observeDebtPage() {
    const page = document.getElementById('page-deudas');
    if (!page || state.observer) return;

    state.observer = new MutationObserver(mutations => {
      const changed = mutations.some(mutation => mutation.type === 'childList' && mutation.addedNodes.length);
      if (changed) scheduleDebtRender(0);
    });
    state.observer.observe(page, { childList: true, subtree: true });
  }

  function preserveFabSymbol() {
    const fab = document.getElementById('fab-global');
    if (!fab) return;
    if (!fab.textContent.trim()) fab.textContent = '+';
    fab.style.setProperty('text-indent', '0', 'important');
    fab.style.setProperty('overflow', 'visible', 'important');
  }

  function start() {
    observeDebtPage();
    preserveFabSymbol();
    scheduleDebtRender(0);

    [150, 450, 1000, 2000].forEach(delay => setTimeout(renderDebtSafely, delay));

    ['hf:deuda-actualizada', 'hf:deudas-core-actualizadas', 'hf:estado-cuenta-confirmado', 'hf:deudas-recalculadas']
      .forEach(name => window.addEventListener(name, () => scheduleDebtRender(0)));

    document.addEventListener('click', event => {
      if (event.target.closest('.tab, .bnav-btn')) {
        preserveFabSymbol();
        setTimeout(renderDebtSafely, 0);
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

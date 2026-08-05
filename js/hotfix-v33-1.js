(() => {
  'use strict';

  const VERSION = '33.3';
  if (window.HFHotfix331?.version === VERSION) return;

  const state = {
    timer: null,
    rendering: false,
    retries: 0,
    debtObserver: null
  };

  function visibleFinalCards() {
    return document.querySelectorAll('#hf-family-debt-view .hf-v24-debt-card').length > 0;
  }

  function visibleLegacyCards() {
    return document.querySelectorAll('#hf-family-debt-view .hf-family-card:not(.hf-v24-debt-card)').length > 0;
  }

  function syncReadyState() {
    document.body?.classList.toggle('hf-debt-v33-ready', visibleFinalCards());
  }

  async function renderDebtSafely(force = false) {
    if (state.rendering) return;
    if (!force && visibleFinalCards() && !visibleLegacyCards()) {
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
      observeDebtView();
      return;
    }
    state.retries += 1;
    renderDebtSafely(false).finally(() => {
      if (!visibleFinalCards()) setTimeout(retryUntilReady, 450);
      else observeDebtView();
    });
  }

  function observeDebtView() {
    const view = document.getElementById('hf-family-debt-view');
    if (!view || state.debtObserver) return;

    state.debtObserver = new MutationObserver(() => {
      if (visibleLegacyCards() && !state.rendering) {
        scheduleDebtRender(0, true);
      } else {
        syncReadyState();
      }
    });
    state.debtObserver.observe(view, { childList: true, subtree: true });
  }

  function preserveFabSymbol() {
    const fab = document.getElementById('fab-global');
    if (!fab) return;
    if (!fab.textContent.trim()) fab.textContent = '+';
    fab.style.setProperty('text-indent', '0', 'important');
    fab.style.setProperty('overflow', 'visible', 'important');
  }

  function restoreMovementDetailIcon(row) {
    const detailIcon = document.getElementById('hf-v33-detail-icon');
    if (!detailIcon || !row) return;

    [...detailIcon.classList]
      .filter(className => className.startsWith('cat-'))
      .forEach(className => detailIcon.classList.remove(className));

    const categoryClass = [...row.classList].find(className => className.startsWith('cat-')) || 'cat-other';
    detailIcon.classList.add(categoryClass);

    const glyph = row.querySelector('.hf-v32-category-glyph');
    detailIcon.innerHTML = `<span class="hf-v32-category-glyph">${glyph?.textContent || '📦'}</span>`;
  }

  function start() {
    preserveFabSymbol();
    retryUntilReady();

    window.addEventListener('hf:bootstrap-avanzado-completado', () => {
      observeDebtView();
      scheduleDebtRender(0, true);
    });

    ['hf:deuda-actualizada', 'hf:deudas-core-actualizadas', 'hf:estado-cuenta-confirmado', 'hf:deudas-recalculadas']
      .forEach(name => window.addEventListener(name, () => scheduleDebtRender(60, true)));

    document.addEventListener('click', event => {
      const navigation = event.target.closest('.tab, .bnav-btn');
      if (navigation) {
        preserveFabSymbol();
        observeDebtView();
        const debtPage = document.getElementById('page-deudas');
        if (debtPage?.classList.contains('active') && (!visibleFinalCards() || visibleLegacyCards())) {
          scheduleDebtRender(0, true);
        }
        return;
      }

      const movement = event.target.closest('.hf-v33-movement');
      const isMovementAction = event.target.closest('.hf-v28-movement-more, [data-action]');
      if (movement && !isMovementAction) {
        setTimeout(() => restoreMovementDetailIcon(movement), 0);
      }
    });
  }

  window.HFHotfix331 = Object.freeze({
    version: VERSION,
    renderDebtSafely,
    syncReadyState,
    restoreMovementDetailIcon
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

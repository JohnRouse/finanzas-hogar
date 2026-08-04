(() => {
  'use strict';

  const VERSION = '31.0';
  if (window.HFExperienciaIntegrada30?.version === VERSION) return;

  const state = {
    observer: null,
    timer: null,
    attempts: 0,
    loadingV31: false
  };

  function normalizeCardBadges(root = document) {
    root.querySelectorAll?.('.hf-v28-method-badge.card').forEach(badge => {
      badge.classList.remove('card');
      badge.classList.add('method-card');
    });
  }

  function normalizeViewAll(root = document) {
    root.querySelectorAll?.('[data-v28-open-history], .ver-todo-container .btn-ver-todo').forEach(button => {
      if (button.textContent.trim() !== 'Ver todos los movimientos') {
        button.textContent = 'Ver todos los movimientos';
      }
      button.setAttribute('aria-label', 'Ver todos los movimientos del mes seleccionado');
      button.removeAttribute('title');
    });
  }

  function hideFabLabels() {
    const fab = document.getElementById('fab-global');
    if (!fab) return;
    fab.classList.add('hf-v30-icon-only');
  }

  function enforceKpiGrid(pageId) {
    const page = document.getElementById(pageId);
    const grid = page?.querySelector(':scope > .kpi-grid');
    if (!grid) return;

    grid.style.setProperty('display', 'grid', 'important');
    grid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
    grid.style.setProperty('gap', window.innerWidth <= 360 ? '8px' : '10px', 'important');
    grid.style.setProperty('align-items', 'stretch', 'important');
    grid.style.setProperty('width', '100%', 'important');

    grid.querySelectorAll(':scope > .kpi').forEach(card => {
      card.style.setProperty('width', '100%', 'important');
      card.style.setProperty('min-width', '0', 'important');
      card.style.setProperty('height', '100%', 'important');
      card.style.setProperty('min-height', window.innerWidth <= 360 ? '104px' : '108px', 'important');
    });
  }

  function enforceKpis() {
    if (window.innerWidth <= 300) return;
    enforceKpiGrid('page-deudas');
    enforceKpiGrid('page-ahorro');
  }

  function loadStability31() {
    if (window.HFEstabilidadPostRender31 || state.loadingV31) return;
    state.loadingV31 = true;
    const script = document.createElement('script');
    script.src = 'js/estabilidad-post-render-v31.js?v=31.0';
    script.async = false;
    script.onload = () => {
      state.loadingV31 = false;
      window.HFEstabilidadPostRender31?.repairAll?.(true);
    };
    script.onerror = () => {
      state.loadingV31 = false;
      console.warn('No se pudo cargar la estabilización V31.');
    };
    document.body.appendChild(script);
  }

  function repair(root = document) {
    normalizeCardBadges(root);
    normalizeViewAll(root);
    hideFabLabels();
    enforceKpis();
    loadStability31();
    document.body?.classList.add('hf-experiencia-integrada-v30');
  }

  function scheduleRepair(root = document) {
    clearTimeout(state.timer);
    state.timer = setTimeout(() => repair(root), 60);
  }

  function start() {
    repair();

    state.observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) repair(node);
        });
      });
      scheduleRepair();
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-label']
    });

    window.addEventListener('resize', () => scheduleRepair(), { passive: true });
    ['hf:gastos-actualizados', 'hf:deuda-actualizada', 'hf:deudas-core-actualizadas']
      .forEach(name => window.addEventListener(name, () => scheduleRepair()));

    const stabilizer = setInterval(() => {
      repair();
      state.attempts += 1;
      if (state.attempts >= 40) clearInterval(stabilizer);
    }, 350);
  }

  window.HFExperienciaIntegrada30 = Object.freeze({
    version: VERSION,
    repair,
    normalizeCardBadges,
    normalizeViewAll,
    enforceKpis,
    loadStability31
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
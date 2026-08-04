(() => {
  'use strict';

  const VERSION = '25.0';
  if (window.HFDeudasFixes25?.version === VERSION) return;

  let observer = null;
  let timer = null;

  function normalizeCard(card) {
    if (!(card instanceof Element)) return;

    const brand = card.querySelector('.hf-v24-brand');
    if (brand) {
      brand.hidden = true;
      brand.setAttribute('aria-hidden', 'true');
    }

    card.querySelectorAll('.hf-card-menu-wrap, .debt-more-wrap').forEach(menu => {
      menu.hidden = true;
      menu.setAttribute('aria-hidden', 'true');
      menu.dataset.hfV25LegacyMenu = 'true';
      if ('inert' in menu) menu.inert = true;
    });

    const currentMenus = [...card.querySelectorAll('.hf-v24-menu-wrap')];
    currentMenus.slice(1).forEach(menu => {
      menu.hidden = true;
      menu.setAttribute('aria-hidden', 'true');
      if ('inert' in menu) menu.inert = true;
    });

    const activeMenu = currentMenus[0];
    if (activeMenu) {
      activeMenu.hidden = false;
      activeMenu.removeAttribute('aria-hidden');
      if ('inert' in activeMenu) activeMenu.inert = false;
    }

    card.dataset.hfV25Normalized = VERSION;
  }

  function repair() {
    document.querySelectorAll('#hf-family-debt-view .hf-v24-debt-card').forEach(normalizeCard);
    document.body?.classList.add('hf-deudas-fixes-v25');
  }

  function scheduleRepair() {
    clearTimeout(timer);
    timer = setTimeout(repair, 60);
  }

  function start() {
    repair();

    observer = new MutationObserver(scheduleRepair);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });

    [
      'hf:deuda-actualizada',
      'hf:deudas-core-actualizadas',
      'hf:estado-cuenta-confirmado',
      'hf:deudas-recalculadas'
    ].forEach(eventName => window.addEventListener(eventName, scheduleRepair));
  }

  window.HFDeudasFixes25 = Object.freeze({ version: VERSION, repair });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

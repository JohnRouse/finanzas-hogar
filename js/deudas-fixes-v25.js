(() => {
  'use strict';

  const VERSION = '33.0';
  if (window.HFDeudasFixes25?.version === VERSION) return;

  function normalizeCard(card) {
    if (!(card instanceof Element)) return;

    card.querySelectorAll('.hf-v24-brand, .hf-card-menu-wrap, .debt-more-wrap').forEach(element => {
      element.hidden = true;
      element.setAttribute('aria-hidden', 'true');
      if ('inert' in element) element.inert = true;
    });

    const menus = [...card.querySelectorAll('.hf-v24-menu-wrap')];
    menus.slice(1).forEach(menu => menu.remove());
    const active = menus[0];
    if (active) {
      active.hidden = false;
      active.removeAttribute('aria-hidden');
      if ('inert' in active) active.inert = false;
    }
  }

  function repair() {
    document.querySelectorAll('#hf-family-debt-view .hf-v24-debt-card').forEach(normalizeCard);
    document.body?.classList.add('hf-deudas-fixes-v25');
  }

  function start() {
    repair();
    ['hf:deuda-actualizada','hf:deudas-core-actualizadas','hf:estado-cuenta-confirmado','hf:deudas-recalculadas']
      .forEach(name => window.addEventListener(name, () => setTimeout(repair, 0)));
  }

  window.HFDeudasFixes25 = Object.freeze({ version: VERSION, repair });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

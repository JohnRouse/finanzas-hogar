(() => {
  'use strict';

  const VERSION = '33.4';
  if (window.HFHotfix331?.version === VERSION) return;

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

    document.addEventListener('click', event => {
      if (event.target.closest('.tab, .bnav-btn')) {
        preserveFabSymbol();
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
    restoreMovementDetailIcon
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

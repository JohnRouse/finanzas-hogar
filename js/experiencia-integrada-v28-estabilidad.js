(() => {
  'use strict';

  const VERSION = '28.1';
  if (window.HFEstabilidadExperiencia28?.version === VERSION) return;

  let timer = null;
  let observer = null;

  function applyLast() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      window.HFExperienciaIntegrada28?.repair?.();
    }, 240);
  }

  function start() {
    window.HFExperienciaIntegrada28?.repair?.();
    observer = new MutationObserver(applyLast);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });

    [
      'hf:gastos-actualizados',
      'hf:deuda-actualizada',
      'hf:deudas-core-actualizadas',
      'hf:estado-cuenta-confirmado'
    ].forEach(name => window.addEventListener(name, applyLast));

    let attempts = 0;
    const bootstrap = setInterval(() => {
      window.HFExperienciaIntegrada28?.repair?.();
      attempts += 1;
      if (attempts >= 40) clearInterval(bootstrap);
    }, 500);
  }

  window.HFEstabilidadExperiencia28 = Object.freeze({
    version: VERSION,
    apply: applyLast
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

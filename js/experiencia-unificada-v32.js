(() => {
  'use strict';

  const VERSION = '33.1';
  if (window.HFExperienciaUnificada?.version === VERSION) return;

  function loadScript(path) {
    if ([...document.scripts].some(script => script.src.includes(path.split('?')[0]))) return;

    if (document.readyState === 'loading') {
      document.write(`<script src="${path}"><\/script>`);
      return;
    }

    const script = document.createElement('script');
    script.src = path;
    script.async = false;
    document.head.appendChild(script);
  }

  loadScript('js/movimientos-unificados-v33.js?v=33.1');
  loadScript('js/experiencia-auxiliar-v33.js?v=33.1');
  loadScript('js/hotfix-v33-1.js?v=33.1');

  window.HFExperienciaUnificada = Object.freeze({ version: VERSION });
})();

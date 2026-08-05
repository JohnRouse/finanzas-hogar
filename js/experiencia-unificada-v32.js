(() => {
  'use strict';

  const VERSION = '34.1-beta.1';
  if (window.HFExperienciaUnificada?.version === VERSION) return;

  function loadStylesheet(path) {
    const cleanPath = path.split('?')[0];
    if ([...document.styleSheets].some(sheet => sheet.href?.includes(cleanPath))) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = path;
    link.dataset.hfIdentityNavigation = VERSION;
    document.head.appendChild(link);
  }

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

  loadStylesheet('css/identidad-navegacion-v34.css?v=34.1-beta.1');

  loadScript('js/movimientos-unificados-v33.js?v=33.4');
  loadScript('js/experiencia-auxiliar-v33.js?v=33.4');
  loadScript('js/hotfix-v33-1.js?v=33.4');
  loadScript('js/avatar-random-v33-2.js?v=33.4');
  loadScript('js/identidad-navegacion-v34.js?v=34.0');

  window.HFExperienciaUnificada = Object.freeze({ version: VERSION });
})();
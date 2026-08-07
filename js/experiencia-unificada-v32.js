(() => {
  'use strict';

  const VERSION = '35.0-beta.7';
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

  loadStylesheet('css/identidad-navegacion-v34.css?v=34.1-beta.2');
  loadStylesheet('css/estados-pagados-ahorro-real-v35.css?v=35.0-beta.7');
  loadStylesheet('css/hotfix-etapa-18-beta2.css?v=35.0-beta.7');

  loadScript('js/movimientos-unificados-v33.js?v=33.4');
  loadScript('js/experiencia-auxiliar-v33.js?v=33.4');
  loadScript('js/hotfix-v33-1.js?v=33.4');
  loadScript('js/avatar-random-v33-2.js?v=33.4');
  loadScript('js/identidad-navegacion-v34.js?v=34.0');

  // Beta 5 conserva la corrección estable de estados de pago de tarjetas.
  loadScript('js/etapa-18-beta5.js?v=35.0-beta.5');
  // Beta 6 define la contabilidad canónica: disponible = efectivo libre - saldo reservado.
  loadScript('js/etapa-18-beta6.js?v=35.0-beta.6');
  loadScript('js/etapa-18-beta6-bridge.js?v=35.0-beta.6');
  // Beta 7 evita el parpadeo del Resumen y corrige la eliminación de metas con saldo.
  loadScript('js/etapa-18-beta7.js?v=35.0-beta.7');

  loadScript('js/ahorro-resumen-v35.js?v=35.0-beta.7');
  loadScript('js/diagnostico-etapa-18.js?v=35.0-beta.7');

  window.HFExperienciaUnificada = Object.freeze({ version: VERSION });
})();
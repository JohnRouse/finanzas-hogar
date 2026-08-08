(() => {
  'use strict';

  const VERSION = '35.0-beta.8.3';
  if (window.HFExperienciaUnificada?.version === VERSION) return;

  function loadStylesheet(path) {
    const cleanPath = path.split('?')[0];
    if ([...document.styleSheets].some(sheet => sheet.href?.includes(cleanPath)) || document.querySelector(`link[href*="${cleanPath}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(path, document.baseURI).href;
    link.dataset.hfIdentityNavigation = VERSION;
    (document.head || document.documentElement).appendChild(link);
  }

  function appendScript(path, { force = false } = {}) {
    const cleanPath = path.split('?')[0];
    if (!force && [...document.scripts].some(script => script.src.includes(cleanPath))) {
      return Promise.resolve({ path, status:'already-present' });
    }

    return new Promise(resolve => {
      const script = document.createElement('script');
      script.src = new URL(path, document.baseURI).href;
      script.async = false;
      script.dataset.hfBootstrap = cleanPath;
      script.onload = () => resolve({ path, status:'loaded' });
      script.onerror = () => {
        console.error(`❌ No se pudo cargar ${path}`);
        resolve({ path, status:'error' });
      };
      (document.head || document.body || document.documentElement).appendChild(script);
    });
  }

  loadStylesheet('css/identidad-navegacion-v34.css?v=34.1-beta.2');
  loadStylesheet('css/estados-pagados-ahorro-real-v35.css?v=35.0-beta.8');
  loadStylesheet('css/hotfix-etapa-18-beta2.css?v=35.0-beta.8');
  loadStylesheet('css/etapa-18-beta8.css?v=35.0-beta.8.3');

  const scripts = [
    'js/movimientos-unificados-v33.js?v=33.4',
    'js/experiencia-auxiliar-v33.js?v=33.4',
    'js/hotfix-v33-1.js?v=33.4',
    'js/avatar-random-v33-2.js?v=33.4',
    'js/identidad-navegacion-v34.js?v=34.0',
    'js/etapa-18-beta5.js?v=35.0-beta.5',
    'js/etapa-18-beta6.js?v=35.0-beta.6',
    'js/etapa-18-beta6-bridge.js?v=35.0-beta.6',
    'js/etapa-18-beta7.js?v=35.0-beta.7',
    'js/etapa-18-beta8.js?v=35.0-beta.8.3',
    'js/etapa-18-beta8-3.js?v=35.0-beta.8.3',
    'js/ahorro-resumen-v35.js?v=35.0-beta.8',
    'js/diagnostico-etapa-18.js?v=35.0-beta.8.2'
  ];

  const ready = (async () => {
    for (const path of scripts) await appendScript(path);

    if (!window.HFTarjetasCanonicasBeta8) {
      const retry = `js/etapa-18-beta8.js?v=35.0-beta.8.3&retry=${Date.now()}`;
      await appendScript(retry, { force:true });
    }

    if (!window.HFEtapa18Beta83) {
      const retry = `js/etapa-18-beta8-3.js?v=35.0-beta.8.3&retry=${Date.now()}`;
      await appendScript(retry, { force:true });
    }

    if (window.HFTarjetasCanonicasBeta8) {
      console.info('✅ Tarjetas canónicas beta 8 cargadas:', window.HFTarjetasCanonicasBeta8.version);
    } else {
      console.error('❌ Beta 8 no quedó disponible después del reintento.');
    }

    if (window.HFEtapa18Beta83) {
      console.info('✅ Ajustes beta 8.3 cargados:', window.HFEtapa18Beta83.version);
    } else {
      console.error('❌ Beta 8.3 no quedó disponible después del reintento.');
    }

    return {
      version:VERSION,
      beta8:Boolean(window.HFTarjetasCanonicasBeta8),
      beta83:Boolean(window.HFEtapa18Beta83)
    };
  })();

  window.HFExperienciaUnificada = Object.freeze({ version: VERSION, ready });
})();
/* Compatibilidad: el renderizador antiguo fue retirado en V33.4. */
(() => {
  'use strict';

  const VERSION = '33.4';
  if (window.HFDeudasFamiliares?.version === VERSION) return;

  let loading = false;
  let loadPromise = null;

  function loadCoordinator() {
    if (window.HFDeudasFamiliares?.version === VERSION) {
      return Promise.resolve(window.HFDeudasFamiliares);
    }
    if (loadPromise) return loadPromise;

    loading = true;
    loadPromise = new Promise(resolve => {
      const existing = [...document.scripts].find(script => script.src.includes('deudas-coordinator-v33-4.js'));
      if (existing) {
        const wait = setInterval(() => {
          if (window.HFDeudasFamiliares?.version === VERSION) {
            clearInterval(wait);
            loading = false;
            resolve(window.HFDeudasFamiliares);
          }
        }, 25);
        return;
      }

      const script = document.createElement('script');
      script.src = new URL(`js/deudas-coordinator-v33-4.js?v=${VERSION}`, document.baseURI).href;
      script.async = false;
      script.onload = () => {
        loading = false;
        resolve(window.HFDeudasFamiliares);
      };
      script.onerror = () => {
        loading = false;
        console.warn('No se pudo cargar el coordinador final de Deudas.');
        resolve(null);
      };
      document.body.appendChild(script);
    });
    return loadPromise;
  }

  const shim = Object.freeze({
    version: `${VERSION}-shim`,
    iniciar: () => loadCoordinator(),
    renderizar: async () => {
      const coordinator = await loadCoordinator();
      return coordinator?.version === VERSION ? coordinator.renderizar?.() : undefined;
    },
    abrirAdministracion: async () => {
      const coordinator = await loadCoordinator();
      return coordinator?.abrirAdministracion?.();
    },
    aplicarFabAdministracion: async () => {
      const coordinator = await loadCoordinator();
      return coordinator?.aplicarFabAdministracion?.();
    },
    obtenerEstado: () => ({ version: `${VERSION}-shim`, loading })
  });

  window.HFDeudasFamiliares = shim;
  loadCoordinator();
})();

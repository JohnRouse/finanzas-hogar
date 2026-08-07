/* Hogar Finanzas — puente de compatibilidad V35.0-beta.6 */
(() => {
  'use strict';
  const VERSION = '35.0-beta.6';
  if (window.HFEtapa18Beta6Bridge?.version === VERSION) return;

  function install() {
    const beta6 = window.HFEtapa18Beta6;
    const current = window.HFEstadosPagadosAhorroReal35;
    if (!beta6 || !current) return false;

    window.HFEstadosPagadosAhorroReal35 = Object.freeze({
      ...current,
      version:VERSION,
      openSavingTransfer:beta6.openSavingTransfer,
      totalReserved:beta6.totalReserved,
      netReservedForMonth:beta6.netReservedMonth,
      getState:() => ({
        version:VERSION,
        ...(typeof beta6.getState === 'function' ? beta6.getState() : {})
      })
    });
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 50) clearInterval(timer);
  }, 100);

  window.HFEtapa18Beta6Bridge = Object.freeze({ version:VERSION, install });
})();
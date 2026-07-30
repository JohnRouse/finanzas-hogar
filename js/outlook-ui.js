/* Hogar Finanzas — Recuperación: Outlook/Microsoft Entra deshabilitado */
(() => {
  'use strict';

  function aviso() {
    const mensaje = 'La conexión directa con Outlook no está disponible. Usa la bandeja de movimientos detectados o registra la información manualmente.';
    if (typeof window.showToast === 'function') window.showToast(mensaje);
    else console.info(mensaje);
    return false;
  }

  function limpiarInterfazAnterior() {
    document.getElementById('btn-outlook')?.remove();
    document.getElementById('outlookModal')?.remove();
    document.getElementById('hf-outlook-styles')?.remove();
  }

  window.abrirOutlook = aviso;
  window.conectarOutlook = aviso;
  window.sincronizarOutlook = aviso;
  window.desconectarOutlook = aviso;
  window.nuevaVinculacionOutlook = aviso;
  window.editarVinculacionOutlook = aviso;
  window.guardarVinculacionOutlook = aviso;
  window.eliminarVinculacionOutlook = aviso;
  window.probarVinculacionOutlook = aviso;
  window.reprocesarAmbiguosOutlook = aviso;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', limpiarInterfazAnterior, { once: true });
  } else {
    limpiarInterfazAnterior();
  }

  window.HFOutlookUI = Object.freeze({ habilitado: false, aviso, limpiarInterfazAnterior });
})();
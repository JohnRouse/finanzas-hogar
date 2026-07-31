/* Hogar Finanzas — Compatibilidad segura tras retirar el escáner de voucher */
(() => {
  'use strict';
  if (window.HFGastosSinVoucher) return;

  function retirarInterfaz() {
    document.getElementById('voucher-toggle')?.remove();
    document.getElementById('voucher-panel')?.remove();
    document.getElementById('voucher-input')?.remove();
    document.getElementById('voucher-autofill-banner')?.remove();
  }

  function limpiarVoucherSeguro() {
    const input = document.getElementById('voucher-input');
    const preview = document.getElementById('voucher-preview');
    const loading = document.getElementById('voucher-loading');
    const boton = document.querySelector('.voucher-btn');

    if (input) input.value = '';
    if (preview) preview.style.display = 'none';
    if (loading) loading.style.display = 'none';
    if (boton) boton.style.display = 'flex';
    document.getElementById('voucher-autofill-banner')?.remove();
    return true;
  }

  function funcionDeshabilitada() {
    limpiarVoucherSeguro();
    return false;
  }

  function instalar() {
    retirarInterfaz();

    // app.js todavía llama limpiarVoucher() al preparar un gasto nuevo. Se
    // reemplaza por una versión compatible con la ausencia total del escáner.
    window.limpiarVoucher = limpiarVoucherSeguro;
    window.toggleVoucherPanel = funcionDeshabilitada;
    window.procesarVoucher = funcionDeshabilitada;

    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', instalar, { once: true });
  } else {
    instalar();
  }

  window.HFGastosSinVoucher = Object.freeze({ instalar, retirarInterfaz, limpiarVoucherSeguro });
})();
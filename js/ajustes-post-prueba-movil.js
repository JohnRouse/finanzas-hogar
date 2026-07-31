/* Hogar Finanzas — ajustes derivados de la prueba móvil de Telegram */
(() => {
  'use strict';
  if (window.HFAjustesPostPruebaMovil) return;

  const VERSION = '19.1';
  const ICONOS = Object.freeze({
    'Alimentación':'🛒',
    'Servicios':'⚡',
    'Entret.':'🎬',
    'Transporte':'⛽',
    'Salud':'💊',
    'Hogar':'🏠',
    'Deudas':'🏦',
    'Otros':'📦'
  });
  const MEDIOS_DINERO = new Set(['yape','plin','debito','transferencia']);
  let reparando = false;
  let observer = null;

  function medioCompatible(medio) {
    return MEDIOS_DINERO.has(String(medio || '').toLowerCase()) ? 'efectivo' : (medio || 'efectivo');
  }

  function iconoCategoria(categoria) {
    return ICONOS[categoria] || ICONOS.Otros;
  }

  function prepararModalRevision() {
    const modal = document.getElementById('hfTelegramReviewModal');
    if (!modal || modal.dataset.hfMovilAjustado === 'true') return;
    modal.dataset.hfMovilAjustado = 'true';

    const select = document.getElementById('hf-tg-method');
    if (select) {
      const etiquetas = {
        efectivo:'Efectivo / transferencia',
        yape:'Yape',
        plin:'Plin',
        debito:'Débito',
        tarjeta:'Tarjeta de crédito'
      };
      [...select.options].forEach(opcion => {
        if (etiquetas[opcion.value]) opcion.textContent = etiquetas[opcion.value];
      });
    }

    const aprobar = document.getElementById('hf-tg-approve');
    aprobar?.addEventListener('click', () => {
      const medio = document.getElementById('hf-tg-method');
      if (medio && MEDIOS_DINERO.has(medio.value)) medio.value = 'efectivo';
    }, true);
  }

  async function repararGasto(id) {
    if (!id || !window.db || !window.DB?.hogarId) return false;
    const ref = db.collection('hogares').doc(DB.hogarId).collection('gastos').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    const gasto = snap.data() || {};
    if (gasto.fuente !== 'telegram') return false;

    const cambios = {};
    const icono = iconoCategoria(gasto.cat);
    if (gasto.icono !== icono) cambios.icono = icono;
    const medio = medioCompatible(gasto.medio);
    if (gasto.medio !== medio) {
      cambios.medioOriginalTelegram = gasto.medio || null;
      cambios.medio = medio;
    }
    if (!Object.keys(cambios).length) return false;
    cambios.normalizadoEn = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set(cambios, { merge:true });
    return true;
  }

  async function repararMovimientosTelegram() {
    if (reparando || !window.db || !window.DB?.hogarId) return;
    reparando = true;
    try {
      const snap = await db.collection('hogares').doc(DB.hogarId)
        .collection('gastos').where('fuente', '==', 'telegram').get();
      let cambios = 0;
      for (const doc of snap.docs) {
        if (await repararGasto(doc.id)) cambios += 1;
      }
      if (cambios && typeof window.renderTodo === 'function') await window.renderTodo();
    } catch (error) {
      console.warn('No se pudieron normalizar algunos movimientos de Telegram:', error);
    } finally {
      reparando = false;
    }
  }

  function instalar() {
    prepararModalRevision();
    observer = new MutationObserver(prepararModalRevision);
    observer.observe(document.body, { childList:true, subtree:true });

    window.addEventListener('hf:gastos-actualizados', async event => {
      const id = event.detail?.id;
      try {
        const cambio = await repararGasto(id);
        if (cambio && typeof window.renderTodo === 'function') await window.renderTodo();
      } catch (error) {
        console.warn('No se pudo completar el icono del movimiento de Telegram:', error);
      }
    });

    setTimeout(repararMovimientosTelegram, 1200);
    return true;
  }

  window.HFAjustesPostPruebaMovil = Object.freeze({
    instalar,
    repararMovimientosTelegram,
    medioCompatible,
    iconoCategoria,
    version:VERSION
  });
})();
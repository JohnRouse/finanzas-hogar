/* Hogar Finanzas — ajustes derivados de la prueba móvil de Telegram */
(() => {
  'use strict';
  if (window.HFAjustesPostPruebaMovil) return;

  const VERSION = '19.3';
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
  const CATEGORIAS_APP = new Set(Object.keys(ICONOS));
  const MEDIOS_DINERO = new Set(['yape','plin','debito','transferencia']);
  let reparando = false;
  let observer = null;

  function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  }

  function redondearDinero(valor) {
    return Math.round(numero(valor) * 100) / 100;
  }

  function medioCompatible(medio) {
    return MEDIOS_DINERO.has(String(medio || '').toLowerCase()) ? 'efectivo' : (medio || 'efectivo');
  }

  function categoriaCompatible(categoria) {
    return CATEGORIAS_APP.has(categoria) ? categoria : 'Otros';
  }

  function iconoCategoria(categoria) {
    return ICONOS[categoriaCompatible(categoria)] || ICONOS.Otros;
  }

  function valorTemporal(valor) {
    if (!valor) return 0;
    if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
    if (typeof valor === 'string') {
      const fecha = Date.parse(valor);
      return Number.isFinite(fecha) ? fecha : 0;
    }
    if (valor instanceof Date) return valor.getTime();
    if (typeof valor.toMillis === 'function') {
      const ms = Number(valor.toMillis());
      return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof valor.toDate === 'function') {
      const fecha = valor.toDate();
      return fecha instanceof Date ? fecha.getTime() : 0;
    }
    if (Number.isFinite(Number(valor.seconds))) {
      return Number(valor.seconds) * 1000 + Number(valor.nanoseconds || 0) / 1000000;
    }
    return 0;
  }

  function fechaISOCompatible(valor) {
    const ms = valorTemporal(valor);
    return ms > 0 ? new Date(ms).toISOString() : null;
  }

  function instalarRenderGastosSeguro() {
    if (window.__HF_RENDER_GASTOS_SEGURO__) return;
    window.__HF_RENDER_GASTOS_SEGURO__ = true;

    window.renderGastos = function renderGastosSeguro(gastos, cfg) {
      const el = document.getElementById('expenseList');
      if (!el) return;

      gastosDelMesCache = [...(Array.isArray(gastos) ? gastos : [])].sort((a, b) => {
        const fechaDiff = String(b.fecha || '').localeCompare(String(a.fecha || ''));
        if (fechaDiff !== 0) return fechaDiff;
        return valorTemporal(b.creadoEn) - valorTemporal(a.creadoEn);
      });
      configCache = cfg || {};

      if (gastosDelMesCache.length === 0) {
        el.innerHTML = '<div class="empty-state">Sin gastos registrados este mes.<br>Presiona "+ Agregar" para empezar.</div>';
        return;
      }

      const gastosFiltrados = aplicarFiltroGastos(gastosDelMesCache);
      if (gastosFiltrados.length === 0) {
        el.innerHTML = '<div class="empty-state">No hay movimientos para este filtro.</div>';
        return;
      }

      const resumen = gastosFiltrados.slice(0, 5);
      let html = resumen.map(g => generarGastoHTML(g, configCache)).join('');

      if (gastosFiltrados.length > 5) {
        const mesTexto = DB.formatMes(mesActual);
        html += `
          <div class="ver-todo-container">
            <button class="btn-ver-todo" onclick="abrirHistorialCompleto()">
              Ver todos los movimientos de ${mesTexto}
            </button>
          </div>`;
      }

      el.innerHTML = html;
      setTimeout(initGestures, 100);
    };
  }

  function prepararModalRevision() {
    const modal = document.getElementById('hfTelegramReviewModal');
    if (!modal || modal.dataset.hfMovilAjustado === 'true') return;
    modal.dataset.hfMovilAjustado = 'true';

    const categoria = document.getElementById('hf-tg-category');
    if (categoria) {
      [...categoria.options].forEach(opcion => {
        if (!CATEGORIAS_APP.has(opcion.value)) opcion.remove();
      });
      if (!CATEGORIAS_APP.has(categoria.value)) categoria.value = 'Otros';
    }

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
      const cat = document.getElementById('hf-tg-category');
      if (cat && !CATEGORIAS_APP.has(cat.value)) cat.value = 'Otros';
    }, true);
  }

  async function aplicarImpactoTarjetaSiFalta(gastoRef) {
    let detalle = null;
    const aplicado = await db.runTransaction(async transaction => {
      const gastoSnap = await transaction.get(gastoRef);
      if (!gastoSnap.exists) return false;
      const gasto = gastoSnap.data() || {};
      const monto = redondearDinero(gasto.monto);
      const esCompraTarjeta = gasto.fuente === 'telegram'
        && (gasto.tipoMovimiento || 'gasto') === 'gasto'
        && gasto.medio === 'tarjeta'
        && gasto.tarjetaId
        && monto > 0;

      if (!esCompraTarjeta || gasto.impactoTarjetaAplicado === true) return false;

      const tarjetaRef = db.collection('hogares').doc(DB.hogarId)
        .collection('tarjetas').doc(String(gasto.tarjetaId));
      const tarjetaSnap = await transaction.get(tarjetaRef);
      if (!tarjetaSnap.exists) throw new Error('La tarjeta vinculada al gasto de Telegram ya no existe.');

      const tarjeta = tarjetaSnap.data() || {};
      const deudaAnterior = redondearDinero(tarjeta.deuda);
      const deudaNueva = redondearDinero(deudaAnterior + monto);
      const actualizadoEn = new Date().toISOString();

      transaction.update(tarjetaRef, {
        deuda:deudaNueva,
        saldoEstimado:true,
        pendienteConciliar:true,
        actualizadoEn
      });
      transaction.set(gastoRef, {
        impactoTarjetaAplicado:true,
        impactoTarjetaMonto:monto,
        impactoTarjetaDeudaAnterior:deudaAnterior,
        impactoTarjetaDeudaNueva:deudaNueva,
        impactoTarjetaAplicadoEn:firebase.firestore.FieldValue.serverTimestamp()
      }, { merge:true });

      detalle = {
        gastoId:gastoRef.id,
        tarjetaId:String(gasto.tarjetaId),
        monto,
        deudaAnterior,
        deudaNueva
      };
      return true;
    });

    if (aplicado && detalle) {
      window.dispatchEvent(new CustomEvent('hf:deuda-actualizada', {
        detail:{ fuente:'telegram', ...detalle }
      }));
    }
    return aplicado;
  }

  async function repararGasto(id) {
    if (!id || !window.db || !window.DB?.hogarId) return false;
    const ref = db.collection('hogares').doc(DB.hogarId).collection('gastos').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return false;
    const gasto = snap.data() || {};
    if (gasto.fuente !== 'telegram') return false;

    const cambios = {};
    const categoria = categoriaCompatible(gasto.cat);
    if (gasto.cat !== categoria) cambios.cat = categoria;
    const icono = iconoCategoria(categoria);
    if (gasto.icono !== icono) cambios.icono = icono;
    const medio = medioCompatible(gasto.medio);
    if (gasto.medio !== medio) {
      cambios.medioOriginalTelegram = gasto.medio || null;
      cambios.medio = medio;
    }
    if (gasto.creadoEn && typeof gasto.creadoEn !== 'string') {
      const creadoEnISO = fechaISOCompatible(gasto.creadoEn);
      if (creadoEnISO) cambios.creadoEn = creadoEnISO;
    }

    let normalizado = false;
    if (Object.keys(cambios).length) {
      cambios.normalizadoEn = firebase.firestore.FieldValue.serverTimestamp();
      await ref.set(cambios, { merge:true });
      normalizado = true;
    }

    const impactoTarjeta = await aplicarImpactoTarjetaSiFalta(ref);
    return normalizado || impactoTarjeta;
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
      if (cambios) await window.HFDeudasFamiliares?.renderizar?.();
    } catch (error) {
      console.warn('No se pudieron normalizar algunos movimientos de Telegram:', error);
    } finally {
      reparando = false;
    }
  }

  function instalar() {
    instalarRenderGastosSeguro();
    prepararModalRevision();
    observer = new MutationObserver(prepararModalRevision);
    observer.observe(document.body, { childList:true, subtree:true });

    window.addEventListener('hf:gastos-actualizados', async event => {
      const id = event.detail?.id;
      try {
        const cambio = await repararGasto(id);
        if (cambio && typeof window.renderTodo === 'function') await window.renderTodo();
        if (cambio) await window.HFDeudasFamiliares?.renderizar?.();
      } catch (error) {
        console.warn('No se pudo completar el movimiento de Telegram:', error);
      }
    });

    setTimeout(async () => {
      await repararMovimientosTelegram();
      if (typeof window.renderTodo === 'function') await window.renderTodo();
    }, 350);
    return true;
  }

  window.HFAjustesPostPruebaMovil = Object.freeze({
    instalar,
    repararMovimientosTelegram,
    medioCompatible,
    categoriaCompatible,
    iconoCategoria,
    valorTemporal,
    aplicarImpactoTarjetaSiFalta,
    version:VERSION
  });
})();
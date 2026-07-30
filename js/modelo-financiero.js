/* Hogar Finanzas — Etapa 11.4.2: modelo financiero unificado y recálculo persistente */
(() => {
  'use strict';

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const fechaISO = valor => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) ? String(valor) : '';
  const ahoraISO = () => new Date().toISOString();

  function hogarId() {
    return window.DB?.hogarId || localStorage.getItem('hogarId') || null;
  }

  function hogarRef() {
    const id = hogarId();
    if (!id || !window.db) throw new Error('No hay un hogar activo.');
    return db.collection('hogares').doc(id);
  }

  function obtenerCampo(objeto, nombres, fallback = null) {
    for (const nombre of nombres) {
      const valor = objeto?.[nombre];
      if (valor !== undefined && valor !== null && valor !== '') return valor;
    }
    return fallback;
  }

  function normalizarEstadoCuenta(datos = {}) {
    const pagoTotal = numero(obtenerCampo(datos, ['pagoTotal', 'deudaFacturada', 'totalFacturado', 'montoFacturado'], 0));
    const pagoMinimo = numero(obtenerCampo(datos, ['pagoMinimo', 'minimo', 'montoMinimo'], 0));
    const fechaCierre = fechaISO(obtenerCampo(datos, ['fechaCierre', 'fechaEstado', 'fechaFacturacion'], ''));
    const fechaVencimiento = fechaISO(obtenerCampo(datos, ['fechaVencimiento', 'vencimiento'], ''));
    const lineaTotal = numero(obtenerCampo(datos, ['lineaTotal', 'limiteCredito', 'linea', 'limite'], 0));
    const lineaDisponible = numero(obtenerCampo(datos, ['lineaDisponible', 'disponible'], 0));

    return {
      periodo: String(obtenerCampo(datos, ['periodo', 'periodoFacturacion'], '') || ''),
      fechaCierre,
      fechaVencimiento,
      pagoMinimo,
      pagoTotal,
      deudaFacturada: pagoTotal,
      lineaTotal,
      lineaDisponible,
      moneda: String(datos.moneda || 'PEN'),
      banco: String(datos.banco || ''),
      origen: String(datos.origen || 'manual'),
      origenId: datos.origenId || null,
      actualizadoEn: datos.actualizadoEn || ahoraISO()
    };
  }

  function esPagoTarjeta(movimiento = {}) {
    return movimiento.tipoMovimiento === 'pagoTarjeta' || movimiento.tipo === 'pago-tarjeta';
  }

  function esCompraCredito(movimiento = {}) {
    if (esPagoTarjeta(movimiento)) return false;
    return movimiento.metodo === 'credito' || movimiento.medio === 'tarjeta' || movimiento.tipo === 'consumo-credito' || !!movimiento.tarjetaId;
  }

  function perteneceATarjeta(movimiento, tarjeta) {
    if (movimiento.tarjetaId && tarjeta.id) return movimiento.tarjetaId === tarjeta.id;
    const digitosMovimiento = String(movimiento.ultimosDigitos || '').slice(-4);
    const digitosTarjeta = String(tarjeta.ultimosDigitos || tarjeta.ultimos4 || '').slice(-4);
    return !!digitosMovimiento && !!digitosTarjeta && digitosMovimiento === digitosTarjeta;
  }

  function fechaMovimiento(movimiento = {}) {
    return String(movimiento.fecha || movimiento.fechaOperacion || movimiento.creadoEn || '').slice(0, 10);
  }

  function calcularResumenTarjeta(tarjeta = {}, movimientos = []) {
    const estado = normalizarEstadoCuenta({
      ...(tarjeta.estadoCuenta || {}),
      pagoTotal: obtenerCampo(tarjeta.estadoCuenta || {}, ['pagoTotal', 'deudaFacturada'], tarjeta.deudaFacturada ?? tarjeta.deuda ?? 0),
      pagoMinimo: obtenerCampo(tarjeta.estadoCuenta || {}, ['pagoMinimo'], tarjeta.pagoMinimo ?? 0),
      lineaTotal: obtenerCampo(tarjeta.estadoCuenta || {}, ['lineaTotal'], tarjeta.limite ?? tarjeta.lineaTotal ?? 0),
      lineaDisponible: obtenerCampo(tarjeta.estadoCuenta || {}, ['lineaDisponible'], tarjeta.lineaDisponible ?? 0)
    });

    const vinculados = movimientos.filter(m => perteneceATarjeta(m, tarjeta));
    const posteriores = vinculados.filter(m => !estado.fechaCierre || fechaMovimiento(m) > estado.fechaCierre);
    const compras = posteriores.filter(esCompraCredito);
    const pagos = posteriores.filter(esPagoTarjeta);
    const comprasPosteriores = compras.reduce((s, m) => s + numero(m.monto), 0);
    const pagosPosteriores = pagos.reduce((s, m) => s + numero(m.monto), 0);
    const deudaEstimada = Math.max(0, estado.deudaFacturada + comprasPosteriores - pagosPosteriores);
    const lineaDisponibleEstimada = estado.lineaTotal > 0
      ? Math.max(0, estado.lineaTotal - deudaEstimada)
      : estado.lineaDisponible;
    const utilizacion = estado.lineaTotal > 0 ? Math.min(999, (deudaEstimada / estado.lineaTotal) * 100) : 0;

    return {
      tarjetaId: tarjeta.id || null,
      tarjetaNombre: tarjeta.nombre || tarjeta.banco || 'Tarjeta',
      estadoCuenta: estado,
      deudaFacturada: estado.deudaFacturada,
      pagoMinimo: estado.pagoMinimo,
      comprasPosteriores,
      pagosPosteriores,
      deudaEstimada,
      lineaTotal: estado.lineaTotal,
      lineaDisponible: lineaDisponibleEstimada,
      lineaDisponibleInformada: estado.lineaDisponible,
      utilizacion,
      cantidadComprasPosteriores: compras.length,
      cantidadPagosPosteriores: pagos.length,
      calculadoEn: ahoraISO()
    };
  }

  async function guardarEstadoCuenta(tarjetaId, datos = {}) {
    if (!tarjetaId) throw new Error('Falta la tarjeta vinculada.');
    const tarjetaRef = hogarRef().collection('tarjetas').doc(tarjetaId);
    const historialRef = tarjetaRef.collection('estadosCuenta').doc();
    const estado = normalizarEstadoCuenta(datos);
    const batch = db.batch();

    batch.set(historialRef, { ...estado, creadoEn: firebase.firestore.FieldValue.serverTimestamp() });
    batch.set(tarjetaRef, {
      estadoCuenta: estado,
      deudaFacturada: estado.deudaFacturada,
      pagoMinimo: estado.pagoMinimo,
      fechaCierre: estado.fechaCierre,
      fechaVencimiento: estado.fechaVencimiento,
      periodoEstadoCuenta: estado.periodo,
      lineaTotal: estado.lineaTotal || firebase.firestore.FieldValue.delete(),
      lineaDisponible: estado.lineaDisponible || firebase.firestore.FieldValue.delete(),
      ultimoEstadoCuentaId: historialRef.id,
      actualizadoEn: estado.actualizadoEn,
      fuenteActualizacion: estado.origen
    }, { merge: true });

    await batch.commit();
    return { id: historialRef.id, ...estado };
  }

  async function listarEstadosCuenta(tarjetaId, limite = 24) {
    if (!tarjetaId) return [];
    const snap = await hogarRef().collection('tarjetas').doc(tarjetaId)
      .collection('estadosCuenta').orderBy('actualizadoEn', 'desc').limit(limite).get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function obtenerMovimientos() {
    const snap = await hogarRef().collection('gastos').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function recalcularTarjeta(tarjetaId, opciones = {}) {
    if (!tarjetaId) throw new Error('Falta la tarjeta a recalcular.');
    const tarjetaRef = hogarRef().collection('tarjetas').doc(tarjetaId);
    const [tarjetaDoc, movimientos] = await Promise.all([tarjetaRef.get(), obtenerMovimientos()]);
    if (!tarjetaDoc.exists) throw new Error('La tarjeta no existe.');

    const resumen = calcularResumenTarjeta({ id: tarjetaDoc.id, ...tarjetaDoc.data() }, movimientos);
    if (opciones.persistir !== false) {
      await tarjetaRef.set({
        deudaEstimada: resumen.deudaEstimada,
        comprasPosteriores: resumen.comprasPosteriores,
        pagosPosteriores: resumen.pagosPosteriores,
        lineaDisponibleEstimada: resumen.lineaDisponible,
        utilizacionLinea: resumen.utilizacion,
        resumenDeuda: resumen,
        recalculadoEn: resumen.calculadoEn,
        versionCalculo: '11.4.2'
      }, { merge: true });
    }

    window.dispatchEvent(new CustomEvent('hf:deuda-actualizada', { detail: { tarjetaId, resumen } }));
    return resumen;
  }

  async function obtenerResumenGlobal() {
    const [tarjetas, movimientos] = await Promise.all([DB.getTarjetas(), obtenerMovimientos()]);
    const tarjetasResumen = tarjetas.map(t => calcularResumenTarjeta(t, movimientos));
    const totales = tarjetasResumen.reduce((acc, item) => {
      acc.deudaFacturada += item.deudaFacturada;
      acc.pagoMinimo += item.pagoMinimo;
      acc.comprasPosteriores += item.comprasPosteriores;
      acc.pagosPosteriores += item.pagosPosteriores;
      acc.deudaEstimada += item.deudaEstimada;
      acc.lineaTotal += item.lineaTotal;
      acc.lineaDisponible += item.lineaDisponible;
      return acc;
    }, { deudaFacturada: 0, pagoMinimo: 0, comprasPosteriores: 0, pagosPosteriores: 0, deudaEstimada: 0, lineaTotal: 0, lineaDisponible: 0 });

    return { tarjetas: tarjetasResumen, totales, movimientos, calculadoEn: ahoraISO() };
  }

  async function recalcularTodo(opciones = {}) {
    const tarjetas = await DB.getTarjetas();
    const movimientos = await obtenerMovimientos();
    const batch = db.batch();
    const resumenes = tarjetas.map(t => calcularResumenTarjeta(t, movimientos));

    if (opciones.persistir !== false) {
      resumenes.forEach(resumen => {
        const ref = hogarRef().collection('tarjetas').doc(resumen.tarjetaId);
        batch.set(ref, {
          deudaEstimada: resumen.deudaEstimada,
          comprasPosteriores: resumen.comprasPosteriores,
          pagosPosteriores: resumen.pagosPosteriores,
          lineaDisponibleEstimada: resumen.lineaDisponible,
          utilizacionLinea: resumen.utilizacion,
          resumenDeuda: resumen,
          recalculadoEn: resumen.calculadoEn,
          versionCalculo: '11.4.2'
        }, { merge: true });
      });
      if (resumenes.length) await batch.commit();
    }

    const totales = resumenes.reduce((acc, r) => {
      acc.deudaFacturada += r.deudaFacturada;
      acc.pagoMinimo += r.pagoMinimo;
      acc.comprasPosteriores += r.comprasPosteriores;
      acc.pagosPosteriores += r.pagosPosteriores;
      acc.deudaEstimada += r.deudaEstimada;
      acc.lineaTotal += r.lineaTotal;
      acc.lineaDisponible += r.lineaDisponible;
      return acc;
    }, { deudaFacturada: 0, pagoMinimo: 0, comprasPosteriores: 0, pagosPosteriores: 0, deudaEstimada: 0, lineaTotal: 0, lineaDisponible: 0 });

    const resultado = { tarjetas: resumenes, totales, calculadoEn: ahoraISO() };
    window.dispatchEvent(new CustomEvent('hf:deudas-recalculadas', { detail: resultado }));
    return resultado;
  }

  async function registrarImportacionEstadoCuenta(importacion = {}) {
    if (importacion.tipo !== 'estado-cuenta') throw new Error('La importación no es un estado de cuenta.');
    if (!importacion.tarjetaId) throw new Error('Debes vincular una tarjeta antes de confirmar.');
    const estado = await guardarEstadoCuenta(importacion.tarjetaId, {
      pagoTotal: importacion.pagoTotal ?? importacion.deudaFacturada ?? importacion.monto,
      pagoMinimo: importacion.pagoMinimo ?? importacion.minimo,
      fechaCierre: importacion.fechaCierre ?? importacion.fechaOperacion,
      fechaVencimiento: importacion.fechaVencimiento,
      periodo: importacion.periodo,
      lineaTotal: importacion.lineaTotal,
      lineaDisponible: importacion.lineaDisponible,
      moneda: importacion.moneda,
      banco: importacion.banco,
      origen: importacion.origen || 'outlook',
      origenId: importacion.id || importacion.messageId
    });
    const resumen = await recalcularTarjeta(importacion.tarjetaId);
    return { tipoRegistro: 'estado-cuenta', estadoCuentaId: estado.id, tarjetaId: importacion.tarjetaId, resumen };
  }

  window.HFModeloFinanciero = Object.freeze({
    normalizarEstadoCuenta,
    calcularResumenTarjeta,
    guardarEstadoCuenta,
    listarEstadosCuenta,
    obtenerResumenGlobal,
    recalcularTarjeta,
    recalcularTodo,
    registrarImportacionEstadoCuenta,
    esPagoTarjeta,
    esCompraCredito
  });
})();
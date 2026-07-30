/* Hogar Finanzas — Etapa 11.2.3: motor de conciliación */
(() => {
  'use strict';

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const texto = valor => String(valor || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const fecha = movimiento => String(movimiento.fecha || movimiento.fechaOperacion || '').slice(0, 10);
  const monto = movimiento => Math.round(numero(movimiento.monto) * 100) / 100;

  function hogarId() {
    return window.DB?.hogarId || localStorage.getItem('hogarId') || null;
  }

  function refGastos() {
    const id = hogarId();
    if (!id || !window.db) throw new Error('No hay un hogar activo.');
    return db.collection('hogares').doc(id).collection('gastos');
  }

  function normalizarMetodo(tipo, metodoActual = '') {
    if (metodoActual) return metodoActual;
    return ({
      'consumo-credito': 'credito',
      'consumo-debito': 'debito',
      yape: 'yape',
      transferencia: 'transferencia',
      'pago-servicio': 'transferencia',
      'pago-tarjeta': 'transferencia'
    })[tipo] || 'efectivo';
  }

  function nombreComparable(movimiento = {}) {
    return texto(movimiento.comercio || movimiento.descripcion || movimiento.desc || movimiento.destinatario);
  }

  function mismaTarjeta(a = {}, b = {}) {
    if (a.tarjetaId && b.tarjetaId) return a.tarjetaId === b.tarjetaId;
    const da = String(a.ultimosDigitos || a.ultimos4 || '').slice(-4);
    const dbb = String(b.ultimosDigitos || b.ultimos4 || '').slice(-4);
    return !!da && !!dbb && da === dbb;
  }

  function diferenciaDias(a, b) {
    const da = new Date(`${fecha(a)}T12:00:00`);
    const dbb = new Date(`${fecha(b)}T12:00:00`);
    if (Number.isNaN(da.getTime()) || Number.isNaN(dbb.getTime())) return 999;
    return Math.abs((da - dbb) / 86400000);
  }

  function puntuarCoincidencia(importado = {}, existente = {}) {
    let puntaje = 0;
    const detalles = [];
    const montoA = monto(importado);
    const montoB = monto(existente);
    const diferenciaMonto = Math.abs(montoA - montoB);

    if (diferenciaMonto <= 0.01) { puntaje += 45; detalles.push('mismo monto'); }
    else if (diferenciaMonto <= Math.max(1, montoA * 0.01)) { puntaje += 25; detalles.push('monto muy parecido'); }

    const dias = diferenciaDias(importado, existente);
    if (dias === 0) { puntaje += 25; detalles.push('misma fecha'); }
    else if (dias <= 2) { puntaje += 15; detalles.push('fecha cercana'); }
    else if (dias <= 5) { puntaje += 5; detalles.push('fecha posible'); }

    if (mismaTarjeta(importado, existente)) { puntaje += 20; detalles.push('misma tarjeta'); }

    const nombreA = nombreComparable(importado);
    const nombreB = nombreComparable(existente);
    if (nombreA && nombreB) {
      if (nombreA === nombreB) { puntaje += 20; detalles.push('mismo comercio'); }
      else if (nombreA.includes(nombreB) || nombreB.includes(nombreA)) { puntaje += 12; detalles.push('comercio parecido'); }
    }

    const tipoImportado = importado.tipoMovimiento || importado.tipo;
    const tipoExistente = existente.tipoMovimiento || existente.tipo;
    if (tipoImportado && tipoExistente && tipoImportado === tipoExistente) puntaje += 5;

    return { puntaje: Math.min(100, puntaje), detalles };
  }

  function clasificarCoincidencia(resultado) {
    if (resultado.puntaje >= 80) return 'duplicado-probable';
    if (resultado.puntaje >= 55) return 'requiere-revision';
    return 'sin-coincidencia';
  }

  async function buscarCoincidencias(importado = {}, opciones = {}) {
    const ventanaDias = Number(opciones.ventanaDias || 7);
    const snap = await refGastos().get();
    const candidatos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => diferenciaDias(importado, item) <= ventanaDias)
      .map(item => ({ item, ...puntuarCoincidencia(importado, item) }))
      .filter(resultado => resultado.puntaje >= 40)
      .sort((a, b) => b.puntaje - a.puntaje);

    return candidatos.map(resultado => ({
      gastoId: resultado.item.id,
      puntaje: resultado.puntaje,
      clasificacion: clasificarCoincidencia(resultado),
      detalles: resultado.detalles,
      gasto: resultado.item
    }));
  }

  async function prepararImportacion(datos = {}) {
    const preparado = {
      ...datos,
      metodo: normalizarMetodo(datos.tipo, datos.metodo),
      conciliacion: {
        revisadoEn: new Date().toISOString(),
        estado: 'sin-coincidencia',
        coincidencias: []
      }
    };

    if (datos.tipo === 'estado-cuenta') {
      preparado.conciliacion.estado = datos.tarjetaId ? 'lista-para-confirmar' : 'requiere-tarjeta';
      return preparado;
    }

    const coincidencias = await buscarCoincidencias(datos);
    preparado.conciliacion.coincidencias = coincidencias.slice(0, 5).map(c => ({
      gastoId: c.gastoId,
      puntaje: c.puntaje,
      clasificacion: c.clasificacion,
      detalles: c.detalles
    }));
    preparado.conciliacion.estado = coincidencias[0]?.clasificacion || 'sin-coincidencia';
    preparado.duplicadoDe = coincidencias[0]?.clasificacion === 'duplicado-probable' ? coincidencias[0].gastoId : null;
    return preparado;
  }

  function calcularPeriodoMovimiento(movimiento = {}, estadoCuenta = {}) {
    const f = fecha(movimiento);
    if (!f || !estadoCuenta.fechaCierre) return 'sin-clasificar';
    if (f <= estadoCuenta.fechaCierre) return 'facturado';
    if (estadoCuenta.fechaVencimiento && f <= estadoCuenta.fechaVencimiento) return 'posterior-al-cierre';
    return 'siguiente-ciclo';
  }

  async function confirmarEstadoCuenta(importacion = {}) {
    if (!window.HFModeloFinanciero) throw new Error('El modelo financiero no está cargado.');
    return HFModeloFinanciero.registrarImportacionEstadoCuenta(importacion);
  }

  window.HFMotorConciliacion = Object.freeze({
    normalizarMetodo,
    puntuarCoincidencia,
    buscarCoincidencias,
    prepararImportacion,
    calcularPeriodoMovimiento,
    confirmarEstadoCuenta
  });
})();

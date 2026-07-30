/* Hogar Finanzas — Etapa 11.4.1: actualización segura de tarjetas desde Outlook */
(() => {
  'use strict';

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const fechaISO = valor => String(valor || '').slice(0, 10);
  const ahoraISO = () => new Date().toISOString();

  function hogarId() {
    return window.DB?.hogarId || localStorage.getItem('hogarId') || null;
  }

  function hogarRef() {
    const id = hogarId();
    if (!id || !window.db) throw new Error('No hay un hogar activo.');
    return db.collection('hogares').doc(id);
  }

  function refImportaciones() {
    return hogarRef().collection('movimientosImportados');
  }

  function extraerEstado(importacion = {}) {
    const datos = importacion.datosEstadoCuenta || {};
    return {
      tarjetaId: importacion.tarjetaId || null,
      banco: importacion.banco || '',
      moneda: importacion.moneda || 'PEN',
      pagoTotal: numero(datos.pagoTotal ?? importacion.pagoTotal ?? importacion.deudaFacturada ?? importacion.monto),
      pagoMinimo: numero(datos.pagoMinimo ?? importacion.pagoMinimo ?? importacion.minimo),
      fechaCierre: fechaISO(datos.fechaCierre || importacion.fechaCierre || importacion.fechaOperacion),
      fechaVencimiento: fechaISO(datos.fechaVencimiento || importacion.fechaVencimiento),
      lineaTotal: numero(datos.lineaTotal ?? importacion.lineaTotal),
      lineaDisponible: numero(datos.lineaDisponible ?? importacion.lineaDisponible),
      periodo: String(datos.periodo || importacion.periodo || ''),
      origen: 'outlook',
      origenId: importacion.id || importacion.messageId || null,
      messageId: importacion.messageId || null,
      actualizadoEn: ahoraISO()
    };
  }

  function evaluarCalidad(estado = {}) {
    const faltantes = [];
    if (!estado.tarjetaId) faltantes.push('tarjeta');
    if (!estado.fechaCierre) faltantes.push('fecha de cierre');
    if (!(estado.pagoTotal > 0)) faltantes.push('pago total');
    if (!estado.fechaVencimiento) faltantes.push('fecha de vencimiento');

    let puntaje = 0;
    if (estado.tarjetaId) puntaje += 25;
    if (estado.fechaCierre) puntaje += 20;
    if (estado.pagoTotal > 0) puntaje += 25;
    if (estado.pagoMinimo > 0) puntaje += 10;
    if (estado.fechaVencimiento) puntaje += 10;
    if (estado.lineaTotal > 0 || estado.lineaDisponible > 0) puntaje += 5;
    if (estado.periodo) puntaje += 5;

    return {
      puntaje,
      faltantes,
      completo: faltantes.length === 0,
      advertencias: [
        ...(estado.pagoMinimo > estado.pagoTotal && estado.pagoTotal > 0 ? ['El pago mínimo supera al pago total.'] : []),
        ...(estado.lineaDisponible > estado.lineaTotal && estado.lineaTotal > 0 ? ['La línea disponible supera la línea total.'] : []),
        ...(estado.fechaVencimiento && estado.fechaCierre && estado.fechaVencimiento < estado.fechaCierre ? ['La fecha de vencimiento es anterior al cierre.'] : [])
      ]
    };
  }

  function compararRecencia(nuevo = {}, actual = {}) {
    const cierreNuevo = fechaISO(nuevo.fechaCierre);
    const cierreActual = fechaISO(actual.fechaCierre || actual.estadoCuenta?.fechaCierre);
    if (!cierreActual) return { aplicar: true, motivo: 'sin-estado-previo' };
    if (!cierreNuevo) return { aplicar: false, motivo: 'sin-fecha-cierre' };
    if (cierreNuevo > cierreActual) return { aplicar: true, motivo: 'estado-mas-reciente' };
    if (cierreNuevo === cierreActual) return { aplicar: true, motivo: 'mismo-cierre-actualizacion' };
    return { aplicar: false, motivo: 'estado-mas-antiguo', cierreActual, cierreNuevo };
  }

  async function previsualizarImportacion(id) {
    if (!id) throw new Error('Falta el identificador de la importación.');
    const doc = await refImportaciones().doc(id).get();
    if (!doc.exists) throw new Error('La importación no existe.');
    const importacion = { id: doc.id, ...doc.data() };
    if (importacion.tipo !== 'estado-cuenta') throw new Error('La importación no es un estado de cuenta.');

    const estado = extraerEstado(importacion);
    const calidad = evaluarCalidad(estado);
    let tarjeta = null;
    let recencia = { aplicar: false, motivo: 'sin-tarjeta' };

    if (estado.tarjetaId) {
      const tarjetaDoc = await hogarRef().collection('tarjetas').doc(estado.tarjetaId).get();
      if (tarjetaDoc.exists) {
        tarjeta = { id: tarjetaDoc.id, ...tarjetaDoc.data() };
        recencia = compararRecencia(estado, tarjeta);
      } else {
        recencia = { aplicar: false, motivo: 'tarjeta-no-existe' };
      }
    }

    return { importacion, estado, calidad, tarjeta, recencia, puedeAplicar: calidad.completo && calidad.advertencias.length === 0 && recencia.aplicar };
  }

  async function confirmarImportacion(id, opciones = {}) {
    if (!window.HFModeloFinanciero?.guardarEstadoCuenta) throw new Error('El modelo financiero no está cargado.');
    const vista = await previsualizarImportacion(id);
    const forzar = opciones.forzar === true;

    if (!vista.calidad.completo && !forzar) {
      throw new Error(`Faltan datos obligatorios: ${vista.calidad.faltantes.join(', ')}.`);
    }
    if (vista.calidad.advertencias.length && !forzar) {
      throw new Error(vista.calidad.advertencias.join(' '));
    }
    if (!vista.recencia.aplicar && !forzar) {
      if (vista.recencia.motivo === 'estado-mas-antiguo') throw new Error('Este estado de cuenta es anterior al registrado actualmente.');
      throw new Error('El estado de cuenta no puede aplicarse automáticamente.');
    }

    const resultado = await HFModeloFinanciero.guardarEstadoCuenta(vista.estado.tarjetaId, vista.estado);
    await refImportaciones().doc(id).set({
      estado: 'confirmado',
      tipoRegistro: 'estado-cuenta',
      confirmadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      aplicadoATarjetaEn: firebase.firestore.FieldValue.serverTimestamp(),
      estadoCuentaId: resultado.id,
      calidadEstadoCuenta: vista.calidad,
      resultadoEstadoCuenta: resultado,
      versionActualizador: '11.4.1'
    }, { merge: true });

    return { importacionId: id, tarjetaId: vista.estado.tarjetaId, estadoCuentaId: resultado.id, estadoCuenta: resultado, calidad: vista.calidad };
  }

  async function listarPendientesAplicables(limite = 100) {
    const snap = await refImportaciones().where('tipo', '==', 'estado-cuenta').limit(limite).get();
    const resultados = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!['pendiente', 'requiere-revision'].includes(data.estado || 'pendiente')) continue;
      try {
        const vista = await previsualizarImportacion(doc.id);
        resultados.push({ id: doc.id, puedeAplicar: vista.puedeAplicar, calidad: vista.calidad, recencia: vista.recencia, estado: vista.estado });
      } catch (error) {
        resultados.push({ id: doc.id, puedeAplicar: false, error: error.message });
      }
    }
    return resultados;
  }

  async function aplicarPendientesConfirmados(opciones = {}) {
    const candidatos = await listarPendientesAplicables(Number(opciones.limite || 100));
    const resumen = { revisados: candidatos.length, aplicados: 0, omitidos: 0, errores: 0, resultados: [] };
    for (const candidato of candidatos) {
      if (!candidato.puedeAplicar) {
        resumen.omitidos += 1;
        resumen.resultados.push({ id: candidato.id, estado: 'omitido', motivo: candidato.error || candidato.recencia?.motivo || candidato.calidad?.faltantes?.join(', ') });
        continue;
      }
      try {
        const resultado = await confirmarImportacion(candidato.id, opciones);
        resumen.aplicados += 1;
        resumen.resultados.push({ id: candidato.id, estado: 'aplicado', resultado });
      } catch (error) {
        resumen.errores += 1;
        resumen.resultados.push({ id: candidato.id, estado: 'error', error: error.message });
      }
    }
    return resumen;
  }

  window.HFActualizadorTarjetasOutlook = Object.freeze({
    extraerEstado,
    evaluarCalidad,
    compararRecencia,
    previsualizarImportacion,
    confirmarImportacion,
    listarPendientesAplicables,
    aplicarPendientesConfirmados
  });
})();
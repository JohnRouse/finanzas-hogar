/* Hogar Finanzas — Etapa 11.3.6: pipeline Outlook con autoasignación de tarjetas */
(() => {
  'use strict';

  const ahoraISO = () => new Date().toISOString();

  function hogarActual() {
    return window.DB?.hogarId || localStorage.getItem('hogarId') || null;
  }

  function refImportaciones() {
    const hogarId = hogarActual();
    if (!hogarId || !window.db) throw new Error('No hay un hogar activo.');
    return db.collection('hogares').doc(hogarId).collection('movimientosImportados');
  }

  async function sha256(texto) {
    const bytes = new TextEncoder().encode(texto);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function textoNormalizado(valor) {
    return String(valor || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  async function construirHuella(datos = {}) {
    const identificadorCorreo = datos.messageId || datos.internetMessageId || datos.idCorreo || '';
    const base = identificadorCorreo
      ? `outlook-message|${identificadorCorreo}`
      : [
          datos.banco,
          datos.tipo,
          Number(datos.monto || datos.pagoTotal || 0).toFixed(2),
          datos.moneda || 'PEN',
          datos.fechaOperacion || datos.fechaCierre || '',
          textoNormalizado(datos.comercio || datos.descripcion),
          datos.ultimosDigitos || ''
        ].join('|');
    return sha256(base);
  }

  async function buscarImportacionExistente(huella) {
    const snap = await refImportaciones().where('huella', '==', huella).limit(1).get();
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  function validarDependencias() {
    if (!window.HFReglasBancarias) throw new Error('HFReglasBancarias no está cargado.');
    if (!window.HFMotorConciliacion) throw new Error('HFMotorConciliacion no está cargado.');
  }

  async function autoasignarTarjeta(datos = {}, opciones = {}) {
    if (datos.tarjetaId || opciones.autoasignarTarjeta === false) return datos;
    if (!window.HFVinculacionTarjetasOutlook?.resolverTarjeta) {
      return {
        ...datos,
        vinculacionTarjeta: {
          tarjetaId: null,
          confianza: 0,
          origen: 'modulo-no-disponible'
        }
      };
    }

    try {
      const resolucion = await HFVinculacionTarjetasOutlook.resolverTarjeta(datos);
      return {
        ...datos,
        tarjetaId: resolucion.tarjetaId || null,
        vinculacionTarjeta: {
          tarjetaId: resolucion.tarjetaId || null,
          confianza: Number(resolucion.confianza || 0),
          origen: resolucion.origen || 'sin-coincidencia',
          detalles: resolucion.detalles || [],
          candidatos: resolucion.candidatos || [],
          resueltaEn: ahoraISO()
        }
      };
    } catch (error) {
      console.warn('No se pudo resolver la tarjeta automáticamente:', error);
      return {
        ...datos,
        vinculacionTarjeta: {
          tarjetaId: null,
          confianza: 0,
          origen: 'error',
          error: error.message,
          resueltaEn: ahoraISO()
        }
      };
    }
  }

  function resolverEstado(preparado = {}) {
    if (preparado.tipo === 'otro') return 'requiere-revision';
    if (preparado.requiereRevision) return 'requiere-revision';
    if (preparado.vinculacionTarjeta?.origen === 'ambiguo') return 'requiere-revision';
    if (preparado.conciliacion?.estado === 'duplicado-probable') return 'duplicado';
    if (preparado.conciliacion?.estado === 'requiere-revision') return 'requiere-revision';
    if (preparado.tipo === 'estado-cuenta' && !preparado.tarjetaId) return 'requiere-revision';
    return 'pendiente';
  }

  function adaptarParaBandeja(preparado = {}, correo = {}) {
    const esEstadoCuenta = preparado.tipo === 'estado-cuenta';
    return {
      ...preparado,
      monto: Number(preparado.monto ?? preparado.pagoTotal ?? 0),
      descripcion: preparado.descripcion || preparado.asunto || `${preparado.banco || 'Banco'} · correo detectado`,
      categoriaSugerida: preparado.categoriaSugerida || (preparado.tipo === 'pago-tarjeta' ? 'Deudas' : 'Otros'),
      origen: 'outlook',
      proveedorOrigen: 'microsoft-graph',
      messageId: preparado.messageId || correo.messageId || correo.id || null,
      internetMessageId: correo.internetMessageId || null,
      recibidoEn: correo.recibidoEn || correo.receivedDateTime || null,
      enlaceCorreo: correo.webLink || correo.enlace || null,
      datosEstadoCuenta: esEstadoCuenta ? {
        pagoTotal: preparado.pagoTotal ?? null,
        pagoMinimo: preparado.pagoMinimo ?? null,
        fechaCierre: preparado.fechaCierre || '',
        fechaVencimiento: preparado.fechaVencimiento || '',
        lineaTotal: preparado.lineaTotal ?? null,
        lineaDisponible: preparado.lineaDisponible ?? null,
        periodo: preparado.periodo || ''
      } : null,
      versionPipeline: '11.3.6'
    };
  }

  async function procesarCorreo(correo = {}, opciones = {}) {
    validarDependencias();

    const interpretado = HFReglasBancarias.interpretarCorreo(correo);
    const vinculado = await autoasignarTarjeta(interpretado, opciones);
    const conciliado = await HFMotorConciliacion.prepararImportacion(vinculado);
    const preparado = adaptarParaBandeja(conciliado, correo);
    const huella = await construirHuella(preparado);
    const existente = await buscarImportacionExistente(huella);

    if (existente) {
      return {
        estado: 'ya-importado',
        creado: false,
        importacionId: existente.id,
        importacion: existente,
        resultado: preparado
      };
    }

    const estado = resolverEstado(preparado);
    const payload = {
      ...preparado,
      huella,
      estado,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      procesadoEnCliente: ahoraISO(),
      procesadoPorPipeline: true
    };

    if (opciones.simular === true) {
      return { estado, creado: false, simulado: true, importacion: payload, resultado: preparado };
    }

    const doc = await refImportaciones().add(payload);
    return {
      estado,
      creado: true,
      importacionId: doc.id,
      importacion: { id: doc.id, ...payload },
      resultado: preparado
    };
  }

  async function procesarLote(correos = [], opciones = {}) {
    const resumen = {
      total: correos.length,
      creados: 0,
      duplicados: 0,
      revision: 0,
      pendientes: 0,
      autoasignados: 0,
      ambiguos: 0,
      sinTarjeta: 0,
      errores: 0,
      resultados: []
    };

    for (const correo of correos) {
      try {
        const resultado = await procesarCorreo(correo, opciones);
        resumen.resultados.push(resultado);
        if (resultado.estado === 'ya-importado') resumen.duplicados += 1;
        else if (resultado.creado) resumen.creados += 1;
        if (resultado.estado === 'requiere-revision') resumen.revision += 1;
        if (resultado.estado === 'pendiente') resumen.pendientes += 1;
        if (resultado.estado === 'duplicado') resumen.duplicados += 1;

        const vinculacion = resultado.resultado?.vinculacionTarjeta;
        if (vinculacion?.origen === 'vinculacion-outlook' && resultado.resultado?.tarjetaId) resumen.autoasignados += 1;
        if (vinculacion?.origen === 'ambiguo') resumen.ambiguos += 1;
        if (!resultado.resultado?.tarjetaId && ['estado-cuenta', 'consumo-credito', 'pago-tarjeta'].includes(resultado.resultado?.tipo)) resumen.sinTarjeta += 1;
      } catch (error) {
        resumen.errores += 1;
        resumen.resultados.push({
          estado: 'error',
          creado: false,
          error: error.message,
          correoId: correo?.messageId || correo?.id || null
        });
        if (opciones.detenerEnError) throw error;
      }
    }

    return resumen;
  }

  async function reprocesarImportacion(id, opciones = {}) {
    validarDependencias();
    const doc = await refImportaciones().doc(id).get();
    if (!doc.exists) throw new Error('La importación no existe.');
    const anterior = { id: doc.id, ...doc.data() };
    const correo = {
      id: anterior.messageId,
      messageId: anterior.messageId,
      internetMessageId: anterior.internetMessageId,
      subject: anterior.asunto,
      from: anterior.remitente,
      body: anterior.cuerpoOriginal || anterior.descripcion,
      receivedDateTime: anterior.recibidoEn,
      webLink: anterior.enlaceCorreo
    };
    const interpretado = HFReglasBancarias.interpretarCorreo(correo);
    const base = { ...interpretado, tarjetaId: anterior.tarjetaId || null };
    const vinculado = await autoasignarTarjeta(base, opciones);
    const conciliado = await HFMotorConciliacion.prepararImportacion(vinculado);
    const preparado = adaptarParaBandeja(conciliado, correo);
    const estado = resolverEstado(preparado);
    await refImportaciones().doc(id).set({
      ...preparado,
      estado,
      reprocesadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { id, estado, resultado: preparado };
  }

  async function confirmarEstadoCuenta(id) {
    validarDependencias();
    const doc = await refImportaciones().doc(id).get();
    if (!doc.exists) throw new Error('La importación no existe.');
    const importacion = { id: doc.id, ...doc.data() };
    if (importacion.tipo !== 'estado-cuenta') throw new Error('La importación no es un estado de cuenta.');
    if (!importacion.tarjetaId) throw new Error('Debes vincular una tarjeta antes de confirmar.');

    const datos = {
      tarjetaId: importacion.tarjetaId,
      banco: importacion.banco,
      moneda: importacion.moneda,
      pagoTotal: importacion.datosEstadoCuenta?.pagoTotal ?? importacion.pagoTotal ?? importacion.monto,
      pagoMinimo: importacion.datosEstadoCuenta?.pagoMinimo ?? importacion.pagoMinimo,
      fechaCierre: importacion.datosEstadoCuenta?.fechaCierre || importacion.fechaCierre,
      fechaVencimiento: importacion.datosEstadoCuenta?.fechaVencimiento || importacion.fechaVencimiento,
      lineaTotal: importacion.datosEstadoCuenta?.lineaTotal ?? importacion.lineaTotal,
      lineaDisponible: importacion.datosEstadoCuenta?.lineaDisponible ?? importacion.lineaDisponible,
      periodo: importacion.datosEstadoCuenta?.periodo || importacion.periodo,
      origen: 'outlook',
      importacionId: id,
      messageId: importacion.messageId
    };

    const resultado = await HFMotorConciliacion.confirmarEstadoCuenta(datos);
    await refImportaciones().doc(id).set({
      estado: 'confirmado',
      tipoRegistro: 'estado-cuenta',
      confirmadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      resultadoEstadoCuenta: resultado || null
    }, { merge: true });
    return resultado;
  }

  window.HFPipelineOutlook = Object.freeze({
    procesarCorreo,
    procesarLote,
    reprocesarImportacion,
    confirmarEstadoCuenta,
    construirHuella,
    autoasignarTarjeta
  });
})();

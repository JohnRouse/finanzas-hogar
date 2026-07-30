/* Hogar Finanzas — Etapa 11.3.5: vinculación inteligente de tarjetas Outlook */
(() => {
  'use strict';

  const normalizar = valor => String(valor || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const ultimos4 = valor => (String(valor || '').match(/\d{4}/g) || []).pop() || '';

  function hogarId() {
    return window.DB?.hogarId || localStorage.getItem('hogarId') || null;
  }

  function refVinculaciones() {
    const id = hogarId();
    if (!id || !window.db) throw new Error('No hay un hogar activo.');
    return db.collection('hogares').doc(id).collection('vinculacionesOutlook');
  }

  async function obtenerTarjetas() {
    if (!window.DB?.getTarjetas) return [];
    const tarjetas = await DB.getTarjetas();
    return (tarjetas || []).map(t => ({ id: t.id, ...t }));
  }

  async function listarVinculaciones() {
    const snap = await refVinculaciones().orderBy('prioridad', 'desc').get().catch(async error => {
      if (error?.code === 'failed-precondition') return refVinculaciones().get();
      throw error;
    });
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async function guardarVinculacion(datos = {}) {
    if (!datos.tarjetaId) throw new Error('Selecciona una tarjeta.');
    const payload = {
      tarjetaId: datos.tarjetaId,
      banco: normalizar(datos.banco),
      aliasBanco: String(datos.aliasBanco || '').trim(),
      ultimosDigitos: ultimos4(datos.ultimosDigitos),
      moneda: String(datos.moneda || 'PEN').toUpperCase(),
      prioridad: Number(datos.prioridad || 0),
      activa: datos.activa !== false,
      actualizadaEn: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (datos.id) {
      await refVinculaciones().doc(datos.id).set(payload, { merge: true });
      return datos.id;
    }
    payload.creadaEn = firebase.firestore.FieldValue.serverTimestamp();
    const doc = await refVinculaciones().add(payload);
    return doc.id;
  }

  async function eliminarVinculacion(id) {
    if (!id) return;
    await refVinculaciones().doc(id).delete();
  }

  function puntuar(vinculo = {}, movimiento = {}, tarjeta = {}) {
    let puntaje = Number(vinculo.prioridad || 0);
    const detalles = [];
    const bancoMovimiento = normalizar(movimiento.banco || movimiento.remitente || movimiento.asunto);
    const bancoVinculo = normalizar(vinculo.banco || vinculo.aliasBanco || tarjeta.banco || tarjeta.nombre);
    const digitosMovimiento = ultimos4(movimiento.ultimosDigitos || movimiento.tarjeta || movimiento.descripcion || movimiento.asunto);
    const digitosVinculo = ultimos4(vinculo.ultimosDigitos || tarjeta.ultimosDigitos || tarjeta.ultimos4);
    const monedaMovimiento = String(movimiento.moneda || '').toUpperCase();

    if (digitosMovimiento && digitosVinculo && digitosMovimiento === digitosVinculo) {
      puntaje += 100;
      detalles.push('mismos últimos 4 dígitos');
    } else if (digitosMovimiento && digitosVinculo) {
      return { puntaje: -1, detalles: ['dígitos distintos'] };
    }

    if (bancoMovimiento && bancoVinculo && (bancoMovimiento.includes(bancoVinculo) || bancoVinculo.includes(bancoMovimiento))) {
      puntaje += 40;
      detalles.push('mismo banco');
    }

    if (monedaMovimiento && vinculo.moneda && monedaMovimiento === String(vinculo.moneda).toUpperCase()) {
      puntaje += 10;
      detalles.push('misma moneda');
    }

    return { puntaje, detalles };
  }

  async function resolverTarjeta(movimiento = {}) {
    if (movimiento.tarjetaId) return { tarjetaId: movimiento.tarjetaId, confianza: 100, origen: 'preasignada' };
    const [vinculos, tarjetas] = await Promise.all([listarVinculaciones(), obtenerTarjetas()]);
    const mapa = new Map(tarjetas.map(t => [t.id, t]));
    const candidatos = vinculos
      .filter(v => v.activa !== false && mapa.has(v.tarjetaId))
      .map(v => ({ vinculo: v, tarjeta: mapa.get(v.tarjetaId), ...puntuar(v, movimiento, mapa.get(v.tarjetaId)) }))
      .filter(c => c.puntaje >= 40)
      .sort((a, b) => b.puntaje - a.puntaje);

    const mejor = candidatos[0];
    if (!mejor) return { tarjetaId: null, confianza: 0, origen: 'sin-coincidencia', candidatos: [] };
    const empate = candidatos[1] && candidatos[1].puntaje === mejor.puntaje;
    return {
      tarjetaId: empate ? null : mejor.tarjeta.id,
      tarjeta: empate ? null : mejor.tarjeta,
      confianza: mejor.puntaje,
      origen: empate ? 'ambiguo' : 'vinculacion-outlook',
      detalles: mejor.detalles,
      candidatos: candidatos.slice(0, 3).map(c => ({ tarjetaId: c.tarjeta.id, nombre: c.tarjeta.nombre || c.tarjeta.banco, puntaje: c.puntaje }))
    };
  }

  window.HFVinculacionTarjetasOutlook = Object.freeze({
    obtenerTarjetas,
    listarVinculaciones,
    guardarVinculacion,
    eliminarVinculacion,
    resolverTarjeta,
    normalizar,
    ultimos4
  });
})();

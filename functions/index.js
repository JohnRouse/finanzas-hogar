const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 });

const db = admin.firestore();
const REGION = 'southamerica-east1';
const TIME_ZONE = 'America/Lima';

const esperar = ms => new Promise(resolve => setTimeout(resolve, ms));

function fechaLima(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function diasEntre(fechaISO, hoyISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO || '')) return null;
  const objetivo = new Date(`${fechaISO}T12:00:00-05:00`);
  const hoy = new Date(`${hoyISO}T12:00:00-05:00`);
  return Math.round((objetivo - hoy) / 86400000);
}

function destinosParaResponsable(quien, config = {}) {
  const principal = config.miembroPrincipalId || null;
  const pareja = config.miembroParejaId || null;
  if (quien === 'pareja') return pareja ? [pareja] : [];
  if (quien === 'ambos' || quien === 'compartida') return [principal, pareja].filter(Boolean);
  return principal ? [principal] : [];
}

function textoDias(dias) {
  if (dias < 0) return `está vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${dias} días`;
}

async function crearNotificacionUnica(hogarRef, id, datos) {
  const ref = hogarRef.collection('notificaciones').doc(id);
  try {
    await ref.create({
      ...datos,
      fecha: admin.firestore.FieldValue.serverTimestamp(),
      origen: 'recordatorio-programado',
      estado: 'pendiente'
    });
    return true;
  } catch (error) {
    if (error.code === 6 || error.code === 'already-exists') return false;
    throw error;
  }
}

exports.enviarNotificacionPago = onDocumentCreated(
  {
    document: 'hogares/{hogarId}/notificaciones/{notifId}',
    region: REGION,
    retry: false
  },
  async (event) => {
    const snap = event.data;
    const notif = snap?.data();
    const hogarId = event.params.hogarId;
    if (!notif || notif.estado === 'enviada') return;

    const retrasoSegundos = Math.min(Math.max(Number(notif.retrasoSegundos) || 0, 0), 30);
    if (retrasoSegundos > 0) await esperar(retrasoSegundos * 1000);

    const miembroDestino = notif.miembroDestino || null;
    const usuarioDestino = notif.usuarioDestino || null;
    if (!miembroDestino && !usuarioDestino) {
      await snap.ref.set({ estado: 'sin-destinatario' }, { merge: true });
      return;
    }

    const dispositivosSnap = await db.collection('hogares').doc(hogarId)
      .collection('dispositivos').get();

    const categoria = notif.categoria || 'movimientos';
    const dispositivoDestino = notif.dispositivoDestino || null;
    const docsDestino = dispositivosSnap.docs.filter(doc => {
      const d = doc.data();
      const coincideMiembro = miembroDestino ? d.miembroId === miembroDestino : d.usuario === usuarioDestino;
      const coincideDispositivo = !dispositivoDestino || doc.id === dispositivoDestino;
      const permitido = d.preferencias?.[categoria] !== false;
      return coincideMiembro && coincideDispositivo && permitido && d.notificacionesActivas === true && !!d.token;
    });

    let tokens = docsDestino.map(doc => doc.data().token).filter(Boolean);
    if (!tokens.length && usuarioDestino && !dispositivoDestino) {
      const legacy = await db.collection('hogares').doc(hogarId)
        .collection('tokens').where('usuario', '==', usuarioDestino).get();
      tokens = legacy.docs.map(doc => doc.data().token).filter(Boolean);
    }

    tokens = [...new Set(tokens)];
    if (!tokens.length) {
      await snap.ref.set({
        estado: dispositivoDestino ? 'dispositivo-sin-push' : 'sin-dispositivos',
        procesadaEn: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return;
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        title: notif.titulo || 'Hogar Finanzas',
        body: String(notif.texto || 'Hay una actualización en el hogar.'),
        categoria,
        url: notif.url || './index.html',
        tag: notif.tag || `hogar-${categoria}`
      },
      webpush: {
        headers: { Urgency: categoria === 'vencimientos' ? 'high' : 'normal' },
        fcmOptions: { link: notif.url || './index.html' }
      }
    });

    const invalidCodes = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/invalid-argument'
    ]);
    const batch = db.batch();
    response.responses.forEach((result, index) => {
      if (!result.success && invalidCodes.has(result.error?.code)) {
        const doc = docsDestino.find(d => d.data().token === tokens[index]);
        if (doc) batch.set(doc.ref, { token: null, notificacionesActivas: false }, { merge: true });
      }
    });
    const primerError = response.responses.find(r => !r.success)?.error?.code || null;
    const tokenInvalido = !response.successCount && invalidCodes.has(primerError);
    batch.set(snap.ref, {
      estado: response.successCount ? 'enviada' : tokenInvalido ? 'token-invalido' : 'fallida',
      exitosas: response.successCount,
      fallidas: response.failureCount,
      errorCodigo: primerError,
      procesadaEn: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await batch.commit();
  }
);

exports.generarRecordatoriosDiarios = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: TIME_ZONE,
    region: REGION,
    retryCount: 1,
    memory: '256MiB',
    timeoutSeconds: 540
  },
  async () => {
    const hoy = fechaLima();
    const hogares = await db.collection('hogares').get();
    let creadas = 0;

    for (const hogarDoc of hogares.docs) {
      const hogarRef = hogarDoc.ref;
      const [configDoc, tarjetasSnap, prestamosSnap] = await Promise.all([
        hogarRef.collection('data').doc('config').get(),
        hogarRef.collection('tarjetas').get(),
        hogarRef.collection('prestamos').get()
      ]);
      const config = configDoc.exists ? configDoc.data() : {};

      for (const tarjetaDoc of tarjetasSnap.docs) {
        const tarjeta = tarjetaDoc.data();
        const fechaVencimiento = tarjeta.estadoCuenta?.fechaVencimiento || '';
        const dias = diasEntre(fechaVencimiento, hoy);
        if (dias === null || ![-3, -2, -1, 0, 1, 3, 7].includes(dias)) continue;

        const destinos = destinosParaResponsable(tarjeta.quien, config);
        for (const miembroDestino of destinos) {
          const id = `tarjeta-${tarjetaDoc.id}-${miembroDestino}-${hoy}`;
          const creada = await crearNotificacionUnica(hogarRef, id, {
            titulo: dias < 0 ? 'Pago de tarjeta vencido' : 'Próximo pago de tarjeta',
            texto: `${tarjeta.nombre || 'Tu tarjeta'} ${textoDias(dias)}. Revisa el pago mínimo informado.`,
            categoria: 'vencimientos',
            miembroDestino,
            url: './index.html#deudas',
            tag: `tarjeta-${tarjetaDoc.id}`,
            recursoTipo: 'tarjeta',
            recursoId: tarjetaDoc.id,
            fechaObjetivo: fechaVencimiento
          });
          if (creada) creadas++;
        }
      }

      for (const prestamoDoc of prestamosSnap.docs) {
        const prestamo = prestamoDoc.data();
        const fechaVencimiento = prestamo.proximoVencimiento || '';
        const dias = diasEntre(fechaVencimiento, hoy);
        if (dias === null || ![-3, -2, -1, 0, 1, 3, 7].includes(dias)) continue;

        const destinos = destinosParaResponsable(prestamo.quien, config);
        for (const miembroDestino of destinos) {
          const id = `prestamo-${prestamoDoc.id}-${miembroDestino}-${hoy}`;
          const creada = await crearNotificacionUnica(hogarRef, id, {
            titulo: dias < 0 ? 'Cuota de préstamo vencida' : 'Próxima cuota de préstamo',
            texto: `${prestamo.nombre || 'Tu préstamo'} ${textoDias(dias)}. Cuota: S/ ${Number(prestamo.cuota || 0).toFixed(2)}.`,
            categoria: 'vencimientos',
            miembroDestino,
            url: './index.html#deudas',
            tag: `prestamo-${prestamoDoc.id}`,
            recursoTipo: 'prestamo',
            recursoId: prestamoDoc.id,
            fechaObjetivo: fechaVencimiento
          });
          if (creada) creadas++;
        }
      }
    }

    console.log(`Recordatorios diarios: ${creadas} notificaciones creadas para ${hoy}.`);
  }
);

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

exports.enviarNotificacionPago = onDocumentCreated(
  {
    document: 'hogares/{hogarId}/notificaciones/{notifId}',
    region: 'us-central1'
  },
  async (event) => {
    const notif = event.data?.data();
    const hogarId = event.params.hogarId;
    if (!notif) return;

    const miembroDestino = notif.miembroDestino || null;
    const usuarioDestino = notif.usuarioDestino || null; // compatibilidad v2
    if (!miembroDestino && !usuarioDestino) return;

    const snapshot = await admin.firestore()
      .collection('hogares').doc(hogarId)
      .collection('dispositivos')
      .get();

    const categoria = notif.categoria || 'movimientos';
    const docsDestino = snapshot.docs.filter(doc => {
      const d = doc.data();
      const coincide = miembroDestino ? d.miembroId === miembroDestino : d.usuario === usuarioDestino;
      const permitido = d.preferencias?.[categoria] !== false;
      return coincide && permitido && d.notificacionesActivas === true && !!d.token;
    });

    // Compatibilidad temporal con tokens de la versión anterior.
    let tokens = docsDestino.map(doc => doc.data().token);
    if (!tokens.length && usuarioDestino) {
      const legacy = await admin.firestore()
        .collection('hogares').doc(hogarId)
        .collection('tokens').where('usuario', '==', usuarioDestino).get();
      tokens = legacy.docs.map(doc => doc.data().token).filter(Boolean);
    }

    tokens = [...new Set(tokens)];
    if (!tokens.length) {
      console.log('No hay dispositivos activos para el destinatario.');
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
    const batch = admin.firestore().batch();
    response.responses.forEach((result, index) => {
      if (!result.success && invalidCodes.has(result.error?.code)) {
        const doc = docsDestino.find(d => d.data().token === tokens[index]);
        if (doc) batch.set(doc.ref, { token: null, notificacionesActivas: false }, { merge: true });
      }
    });
    await batch.commit();
    console.log(`Notificaciones: ${response.successCount} correctas, ${response.failureCount} fallidas.`);
  }
);

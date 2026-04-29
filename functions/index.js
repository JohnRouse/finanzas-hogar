const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

exports.enviarNotificacionPago = onDocumentCreated(
  {
    document: 'hogares/{hogarId}/notificaciones/{notifId}',
    region: 'us-central1'
  },
  async (event) => {
    const notif = event.data.data();
    const hogarId = event.params.hogarId;

    if (!notif.usuarioDestino) return;

    const tokensSnapshot = await admin.firestore()
      .collection('hogares').doc(hogarId)
      .collection('tokens')
      .where('usuario', '==', notif.usuarioDestino)
      .get();

    if (tokensSnapshot.empty) {
      console.log('No hay tokens para el usuario destino');
      return;
    }

    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);

    const message = {
      notification: {
        title: 'Hogar Finanzas',
        body: notif.texto
      },
      tokens: tokens
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Notificaciones: ${response.successCount} ok, ${response.failureCount} fallidas`);
    } catch (error) {
      console.error('Error enviando notificación:', error);
    }
  }
);
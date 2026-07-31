'use strict';

const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineJsonSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { analizarMensaje, fechaLima } = require('./lib/telegram-parser');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const REGION = 'southamerica-east1';
const TELEGRAM_BOT_TOKEN = defineSecret('TELEGRAM_BOT_TOKEN');
const TELEGRAM_WEBHOOK_SECRET = defineSecret('TELEGRAM_WEBHOOK_SECRET');
const TELEGRAM_USER_BINDINGS = defineJsonSecret('TELEGRAM_USER_BINDINGS');
const MAX_VOICE_SECONDS = 60;
const MAX_FILE_BYTES = 6 * 1024 * 1024;
const SPEECH_ENDPOINT = 'https://speech.googleapis.com/v1/speech:recognize';
const speechCredential = admin.credential.applicationDefault();

function seguroIgual(a, b) {
  const izquierda = Buffer.from(String(a || ''), 'utf8');
  const derecha = Buffer.from(String(b || ''), 'utf8');
  if (!izquierda.length || izquierda.length !== derecha.length) return false;
  return crypto.timingSafeEqual(izquierda, derecha);
}

function normalizarVinculos(valor) {
  if (Array.isArray(valor)) {
    return Object.fromEntries(valor
      .filter(item => item && item.telegramUserId)
      .map(item => [String(item.telegramUserId), item]));
  }
  return valor && typeof valor === 'object' ? valor : {};
}

function vinculoPara(usuarioId) {
  const vinculos = normalizarVinculos(TELEGRAM_USER_BINDINGS.value());
  const vinculo = vinculos[String(usuarioId)] || null;
  if (!vinculo?.hogarId) return null;
  return {
    hogarId:String(vinculo.hogarId),
    miembroId:vinculo.miembroId ? String(vinculo.miembroId) : null,
    quien:vinculo.quien === 'pareja' ? 'pareja' : 'yo',
    nombre:vinculo.nombre ? String(vinculo.nombre) : null
  };
}

async function telegramApi(metodo, datos = {}) {
  const token = TELEGRAM_BOT_TOKEN.value();
  const respuesta = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body:JSON.stringify(datos),
    signal:AbortSignal.timeout(20000)
  });
  const payload = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || payload.ok === false) {
    throw new Error(`Telegram ${metodo}: ${payload.description || respuesta.status}`);
  }
  return payload.result;
}

async function responder(chatId, texto, opciones = {}) {
  if (!chatId) return;
  await telegramApi('sendMessage', {
    chat_id:chatId,
    text:String(texto).slice(0, 3900),
    disable_web_page_preview:true,
    ...opciones
  });
}

async function descargarVoz(voice) {
  if (!voice?.file_id) throw new Error('La nota de voz no contiene file_id.');
  if (Number(voice.duration || 0) > MAX_VOICE_SECONDS) {
    throw new Error(`La nota de voz supera el máximo de ${MAX_VOICE_SECONDS} segundos.`);
  }
  if (Number(voice.file_size || 0) > MAX_FILE_BYTES) {
    throw new Error('La nota de voz es demasiado grande para el registro rápido.');
  }

  const archivo = await telegramApi('getFile', { file_id:voice.file_id });
  if (!archivo?.file_path) throw new Error('Telegram no devolvió la ruta del audio.');
  const token = TELEGRAM_BOT_TOKEN.value();
  const respuesta = await fetch(`https://api.telegram.org/file/bot${token}/${archivo.file_path}`, {
    signal:AbortSignal.timeout(25000)
  });
  if (!respuesta.ok) throw new Error(`No se pudo descargar el audio (${respuesta.status}).`);
  const buffer = Buffer.from(await respuesta.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw new Error('El audio descargado no es válido.');
  return buffer;
}

async function obtenerAccessToken() {
  const token = await speechCredential.getAccessToken();
  if (!token?.access_token) throw new Error('No se obtuvo autorización para Speech-to-Text.');
  return token.access_token;
}

async function transcribirVoz(buffer) {
  const accessToken = await obtenerAccessToken();
  const respuesta = await fetch(SPEECH_ENDPOINT, {
    method:'POST',
    headers:{
      authorization:`Bearer ${accessToken}`,
      'content-type':'application/json; charset=utf-8'
    },
    body:JSON.stringify({
      config:{
        encoding:'OGG_OPUS',
        sampleRateHertz:48000,
        languageCode:'es-PE',
        enableAutomaticPunctuation:true,
        speechContexts:[{
          phrases:[
            'Yape', 'Plin', 'BCP', 'BBVA', 'Ripley', 'Falabella', 'Santander',
            'Visa', 'Mastercard', 'pago mínimo', 'tarjeta de crédito', 'préstamo',
            'soles', 'dólares', 'Metro', 'Plaza Vea', 'Tottus', 'Win'
          ],
          boost:14
        }]
      },
      audio:{ content:buffer.toString('base64') }
    }),
    signal:AbortSignal.timeout(45000)
  });

  const payload = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(payload?.error?.message || `Speech-to-Text respondió ${respuesta.status}.`);
  }

  const alternativas = (payload.results || [])
    .map(resultado => resultado.alternatives?.[0])
    .filter(Boolean);
  const transcripcion = alternativas.map(item => item.transcript || '').join(' ').trim();
  const confianza = alternativas.length
    ? alternativas.reduce((s, item) => s + Number(item.confidence || 0), 0) / alternativas.length
    : 0;
  if (!transcripcion) throw new Error('No se pudo reconocer una frase en el audio.');
  return { transcripcion, confianza:Math.round(confianza * 100) };
}

async function obtenerTarjetas(hogarId) {
  const snapshot = await db.collection('hogares').doc(hogarId).collection('tarjetas').get();
  return snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));
}

function resumenDetectado(analisis) {
  const lineas = ['Guardado para revisar en Hogar Finanzas.'];
  lineas.push(`Monto: ${analisis.monto ? `${analisis.moneda === 'USD' ? 'US$' : 'S/'} ${analisis.monto.toFixed(2)}` : 'por completar'}`);
  lineas.push(`Descripción: ${analisis.descripcion || 'por completar'}`);
  lineas.push(`Fecha: ${analisis.fecha}`);
  lineas.push(`Medio: ${analisis.medio || 'por completar'}`);
  lineas.push(`Categoría sugerida: ${analisis.categoriaSugerida || 'Otros'}`);
  if (analisis.tarjetaNombre) lineas.push(`Tarjeta: ${analisis.tarjetaNombre}`);
  if (analisis.camposFaltantes.length) lineas.push(`Falta revisar: ${analisis.camposFaltantes.join(', ')}`);
  return lineas.join('\n');
}

async function crearPendiente({ update, message, vinculo, transcripcion, voz = null, confianzaVoz = null }) {
  const updateId = String(update.update_id);
  const hogarRef = db.collection('hogares').doc(vinculo.hogarId);
  const pendienteRef = hogarRef.collection('movimientos_pendientes').doc(`telegram-${updateId}`);

  try {
    await pendienteRef.create({
      fuente:'telegram',
      estado:'procesando',
      updateId,
      telegramMessageId:String(message.message_id || ''),
      telegramUserId:String(message.from?.id || ''),
      telegramChatId:String(message.chat?.id || ''),
      miembroId:vinculo.miembroId,
      quien:vinculo.quien,
      nombreMiembro:vinculo.nombre,
      recibidoEn:admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    if (error.code === 6 || error.code === 'already-exists') return { duplicado:true, ref:pendienteRef };
    throw error;
  }

  try {
    const tarjetas = await obtenerTarjetas(vinculo.hogarId);
    const analisis = analizarMensaje(transcripcion, { tarjetas, hoy:fechaLima() });
    const datos = {
      fuente:'telegram',
      estado:'pendiente',
      updateId,
      telegramMessageId:String(message.message_id || ''),
      telegramUserId:String(message.from?.id || ''),
      telegramChatId:String(message.chat?.id || ''),
      miembroId:vinculo.miembroId,
      quien:vinculo.quien,
      nombreMiembro:vinculo.nombre,
      transcripcion,
      transcripcionConfianza:confianzaVoz,
      tipoMovimiento:analisis.tipoMovimiento,
      montoDetectado:analisis.monto,
      monedaDetectada:analisis.moneda,
      descripcionDetectada:analisis.descripcion,
      categoriaSugerida:analisis.categoriaSugerida,
      medioDetectado:analisis.medio,
      tarjetaIdDetectada:analisis.tarjetaId,
      tarjetaNombreDetectada:analisis.tarjetaNombre,
      fechaDetectada:analisis.fecha,
      camposFaltantes:analisis.camposFaltantes,
      confianzaDeteccion:analisis.confianza,
      voz:voz ? {
        duracionSegundos:Number(voz.duration || 0),
        tamanoBytes:Number(voz.file_size || 0),
        mimeType:voz.mime_type || 'audio/ogg'
      } : null,
      listoParaRevisarEn:admin.firestore.FieldValue.serverTimestamp()
    };
    // Nunca se guarda el archivo ni el file_id de Telegram; solo metadatos mínimos.
    await pendienteRef.set(datos, { merge:true });
    return { duplicado:false, ref:pendienteRef, analisis };
  } catch (error) {
    await pendienteRef.set({
      estado:'error',
      error:String(error.message || error).slice(0, 500),
      errorEn:admin.firestore.FieldValue.serverTimestamp()
    }, { merge:true });
    throw error;
  }
}

async function manejarComando(message, vinculo) {
  const texto = String(message.text || '').trim();
  const comando = texto.split(/\s+/)[0].toLowerCase().split('@')[0];
  if (comando === '/id') {
    await responder(message.chat.id, `Tu ID de Telegram es: ${message.from.id}`);
    return true;
  }
  if (!vinculo) return false;
  if (comando === '/start' || comando === '/ayuda') {
    await responder(message.chat.id,
      'Envía una nota de voz o un mensaje como:\n“Gasté 35 soles en Metro con la Visa BCP hoy”.\n\nEl movimiento quedará pendiente para revisarlo en la pestaña Gastos. También puedes usar /pendientes.');
    return true;
  }
  if (comando === '/pendientes') {
    const snap = await db.collection('hogares').doc(vinculo.hogarId)
      .collection('movimientos_pendientes').where('estado', '==', 'pendiente').get();
    await responder(message.chat.id, snap.size
      ? `Hay ${snap.size} movimiento${snap.size === 1 ? '' : 's'} pendiente${snap.size === 1 ? '' : 's'} de revisión.`
      : 'No hay movimientos pendientes de revisión.');
    return true;
  }
  return texto.startsWith('/');
}

exports.telegramWebhook = onRequest({
  region:REGION,
  secrets:[TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_USER_BINDINGS],
  timeoutSeconds:60,
  memory:'512MiB',
  minInstances:0,
  maxInstances:2,
  concurrency:10,
  cors:false
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const header = req.get('X-Telegram-Bot-Api-Secret-Token');
  if (!seguroIgual(header, TELEGRAM_WEBHOOK_SECRET.value())) return res.status(403).send('Forbidden');

  const update = req.body || {};
  const message = update.message;
  if (!message?.from?.id || !message?.chat?.id) return res.status(200).send('ok');

  try {
    if (message.chat.type !== 'private') {
      await responder(message.chat.id, 'Por seguridad, envíame los gastos por mensaje privado.');
      return res.status(200).send('ok');
    }

    const vinculo = vinculoPara(message.from.id);
    if (message.text?.startsWith('/')) {
      const atendido = await manejarComando(message, vinculo);
      if (atendido) return res.status(200).send('ok');
    }

    if (!vinculo) {
      await responder(message.chat.id, 'Esta cuenta todavía no está vinculada con Hogar Finanzas. Usa /id y agrega ese número a la configuración privada del bot.');
      return res.status(200).send('ok');
    }

    let transcripcion = '';
    let voz = null;
    let confianzaVoz = null;

    if (message.voice) {
      voz = message.voice;
      await responder(message.chat.id, 'Recibí el audio. Estoy preparando el movimiento para revisión…');
      const buffer = await descargarVoz(message.voice);
      const resultado = await transcribirVoz(buffer);
      transcripcion = resultado.transcripcion;
      confianzaVoz = resultado.confianza;
    } else if (message.text) {
      transcripcion = String(message.text).trim();
    } else {
      await responder(message.chat.id, 'Envía una nota de voz o un mensaje de texto con el gasto.');
      return res.status(200).send('ok');
    }

    const creado = await crearPendiente({ update, message, vinculo, transcripcion, voz, confianzaVoz });
    if (creado.duplicado) {
      await responder(message.chat.id, 'Ese mensaje ya había sido recibido y no se duplicó.');
    } else {
      await responder(message.chat.id, `${resumenDetectado(creado.analisis)}\n\nTranscripción: “${transcripcion}”`);
    }
    return res.status(200).send('ok');
  } catch (error) {
    console.error('Telegram webhook:', error);
    try {
      await responder(message.chat.id, `No pude preparar ese movimiento: ${String(error.message || error).slice(0, 240)}`);
    } catch (_) {}
    return res.status(200).send('ok');
  }
});
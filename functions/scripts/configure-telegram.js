'use strict';

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || process.argv[2];

  if (!token || !secret || !webhookUrl) {
    throw new Error('Define TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET y TELEGRAM_WEBHOOK_URL.');
  }
  if (!/^https:\/\//i.test(webhookUrl)) throw new Error('TELEGRAM_WEBHOOK_URL debe usar HTTPS.');
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET solo admite letras, números, guion y guion bajo.');
  }

  const respuesta = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method:'POST',
    headers:{ 'content-type':'application/json' },
    body:JSON.stringify({
      url:webhookUrl,
      secret_token:secret,
      allowed_updates:['message'],
      drop_pending_updates:false,
      max_connections:10
    })
  });
  const payload = await respuesta.json();
  if (!respuesta.ok || !payload.ok) throw new Error(payload.description || `Telegram respondió ${respuesta.status}`);
  console.log('Webhook configurado:', payload.description || payload.result);

  const infoRespuesta = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRespuesta.json();
  console.log(JSON.stringify(info.result || info, null, 2));
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
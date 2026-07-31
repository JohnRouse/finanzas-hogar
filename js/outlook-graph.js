/* Hogar Finanzas — Etapa 11.3.4: Microsoft Graph + OAuth PKCE + Delta API */
(() => {
  'use strict';

  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const LOGIN = 'https://login.microsoftonline.com';
  const STORAGE = {
    config: 'hf_outlook_config',
    token: 'hf_outlook_token',
    verifier: 'hf_outlook_pkce_verifier',
    state: 'hf_outlook_oauth_state',
    returnUrl: 'hf_outlook_return_url',
    delta: 'hf_outlook_delta_inbox',
    ultimaSync: 'hf_outlook_ultima_sync'
  };

  const DEFAULT_SCOPES = ['openid', 'profile', 'offline_access', 'User.Read', 'Mail.Read'];
  const MESSAGE_SELECT = 'id,internetMessageId,subject,from,receivedDateTime,lastModifiedDateTime,body,bodyPreview,hasAttachments,webLink,isRead';

  function configurar(opciones = {}) {
    const actual = leerConfig();
    const config = {
      tenant: opciones.tenant || actual.tenant || 'common',
      clientId: opciones.clientId || actual.clientId || '',
      redirectUri: opciones.redirectUri || actual.redirectUri || `${location.origin}${location.pathname}`,
      scopes: opciones.scopes || actual.scopes || DEFAULT_SCOPES
    };
    localStorage.setItem(STORAGE.config, JSON.stringify(config));
    return config;
  }

  function leerConfig() {
    try { return JSON.parse(localStorage.getItem(STORAGE.config) || '{}'); }
    catch { return {}; }
  }

  function validarConfig() {
    const config = configurar({});
    if (!config.clientId) throw new Error('Falta configurar el Client ID de Microsoft Entra.');
    return config;
  }

  function base64Url(bytes) {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function aleatorio(longitud = 64) {
    const bytes = new Uint8Array(longitud);
    crypto.getRandomValues(bytes);
    return base64Url(bytes);
  }

  async function sha256(valor) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor)));
  }

  async function iniciarSesion(opciones = {}) {
    const config = validarConfig();
    const verifier = aleatorio(64);
    const challenge = base64Url(await sha256(verifier));
    const state = aleatorio(32);

    sessionStorage.setItem(STORAGE.verifier, verifier);
    sessionStorage.setItem(STORAGE.state, state);
    sessionStorage.setItem(STORAGE.returnUrl, opciones.returnUrl || location.href.split('?')[0].split('#')[0]);

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: 'code',
      redirect_uri: config.redirectUri,
      response_mode: 'query',
      scope: config.scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: opciones.prompt || 'select_account'
    });

    location.assign(`${LOGIN}/${config.tenant}/oauth2/v2.0/authorize?${params}`);
  }

  async function procesarCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const error = params.get('error');
    if (!code && !error) return { procesado: false };
    if (error) throw new Error(params.get('error_description') || error);

    const recibido = params.get('state');
    const esperado = sessionStorage.getItem(STORAGE.state);
    if (!recibido || recibido !== esperado) throw new Error('El estado OAuth no coincide.');

    const verifier = sessionStorage.getItem(STORAGE.verifier);
    if (!verifier) throw new Error('No se encontró el verificador PKCE.');

    const config = validarConfig();
    const body = new URLSearchParams({
      client_id: config.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
      scope: config.scopes.join(' ')
    });

    const respuesta = await fetch(`${LOGIN}/${config.tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error_description || datos.error || 'No se pudo obtener el token.');

    guardarToken(datos);
    limpiarDelta();
    sessionStorage.removeItem(STORAGE.verifier);
    sessionStorage.removeItem(STORAGE.state);
    const returnUrl = sessionStorage.getItem(STORAGE.returnUrl) || config.redirectUri;
    sessionStorage.removeItem(STORAGE.returnUrl);
    history.replaceState({}, document.title, returnUrl);
    return { procesado: true, conectado: true };
  }

  function guardarToken(datos) {
    const actual = leerToken();
    const token = {
      accessToken: datos.access_token,
      refreshToken: datos.refresh_token || actual.refreshToken || null,
      idToken: datos.id_token || actual.idToken || null,
      scope: datos.scope || actual.scope || '',
      expiresAt: Date.now() + Math.max(60, Number(datos.expires_in || 3600) - 120) * 1000
    };
    localStorage.setItem(STORAGE.token, JSON.stringify(token));
    return token;
  }

  function leerToken() {
    try { return JSON.parse(localStorage.getItem(STORAGE.token) || '{}'); }
    catch { return {}; }
  }

  async function renovarToken() {
    const config = validarConfig();
    const token = leerToken();
    if (!token.refreshToken) throw new Error('La sesión de Outlook expiró. Vuelve a conectar la cuenta.');

    const body = new URLSearchParams({
      client_id: config.clientId,
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
      scope: config.scopes.join(' ')
    });
    const respuesta = await fetch(`${LOGIN}/${config.tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) {
      cerrarSesion();
      throw new Error(datos.error_description || 'No se pudo renovar la sesión de Outlook.');
    }
    return guardarToken(datos).accessToken;
  }

  async function accessToken() {
    const token = leerToken();
    if (!token.accessToken) throw new Error('Outlook no está conectado.');
    if (Date.now() < Number(token.expiresAt || 0)) return token.accessToken;
    return renovarToken();
  }

  async function graph(ruta, opciones = {}) {
    const token = await accessToken();
    const url = /^https:\/\//i.test(ruta) ? ruta : `${GRAPH}${ruta}`;
    const respuesta = await fetch(url, {
      ...opciones,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opciones.headers || {})
      }
    });

    if (respuesta.status === 401 && !opciones.__reintento) {
      await renovarToken();
      return graph(ruta, { ...opciones, __reintento: true });
    }
    if (respuesta.status === 429 || respuesta.status >= 500) {
      const espera = Math.min(30, Number(respuesta.headers.get('Retry-After') || 2));
      if (!opciones.__reintentoServidor) {
        await new Promise(resolve => setTimeout(resolve, espera * 1000));
        return graph(ruta, { ...opciones, __reintentoServidor: true });
      }
    }

    const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const error = new Error(datos?.error?.message || `Microsoft Graph respondió ${respuesta.status}.`);
      error.status = respuesta.status;
      error.codigo = datos?.error?.code || null;
      throw error;
    }
    return datos;
  }

  async function obtenerPerfil() {
    return graph('/me?$select=id,displayName,mail,userPrincipalName');
  }

  function limpiarHtml(html = '') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function adaptarMensaje(mensaje = {}) {
    const cuerpo = mensaje.body?.contentType === 'html'
      ? limpiarHtml(mensaje.body.content)
      : (mensaje.body?.content || mensaje.bodyPreview || '');
    return {
      id: mensaje.id,
      messageId: mensaje.id,
      internetMessageId: mensaje.internetMessageId || null,
      asunto: mensaje.subject || '',
      subject: mensaje.subject || '',
      remitente: mensaje.from?.emailAddress?.address || '',
      from: mensaje.from?.emailAddress?.address || '',
      nombreRemitente: mensaje.from?.emailAddress?.name || '',
      cuerpo,
      body: cuerpo,
      html: mensaje.body?.contentType === 'html' ? mensaje.body.content : '',
      recibidoEn: mensaje.receivedDateTime || null,
      receivedDateTime: mensaje.receivedDateTime || null,
      modificadoEn: mensaje.lastModifiedDateTime || null,
      webLink: mensaje.webLink || null,
      tieneAdjuntos: Boolean(mensaje.hasAttachments)
    };
  }

  async function listarMensajes(opciones = {}) {
    const top = Math.min(100, Math.max(1, Number(opciones.top || 50)));
    const desde = opciones.desde ? new Date(opciones.desde).toISOString() : null;
    const filtros = [];
    if (desde) filtros.push(`receivedDateTime ge ${desde}`);
    if (opciones.noLeidos) filtros.push('isRead eq false');

    const params = new URLSearchParams({
      '$top': String(top),
      '$orderby': 'receivedDateTime desc',
      '$select': MESSAGE_SELECT
    });
    if (filtros.length) params.set('$filter', filtros.join(' and '));
    if (opciones.buscar) params.set('$search', `"${String(opciones.buscar).replace(/"/g, '')}"`);

    let siguiente = `/me/mailFolders/inbox/messages?${params}`;
    const mensajes = [];
    while (siguiente && mensajes.length < Number(opciones.maximo || top)) {
      const pagina = await graph(siguiente, opciones.buscar ? { headers: { ConsistencyLevel: 'eventual' } } : {});
      mensajes.push(...(pagina.value || []).map(adaptarMensaje));
      siguiente = pagina['@odata.nextLink'] || null;
    }
    return mensajes.slice(0, Number(opciones.maximo || top));
  }

  function leerDelta() {
    try { return JSON.parse(localStorage.getItem(STORAGE.delta) || '{}'); }
    catch { return {}; }
  }

  function guardarDelta(datos = {}) {
    const estado = {
      deltaLink: datos.deltaLink || null,
      cuentaId: datos.cuentaId || null,
      actualizadoEn: new Date().toISOString()
    };
    localStorage.setItem(STORAGE.delta, JSON.stringify(estado));
    return estado;
  }

  function limpiarDelta() {
    localStorage.removeItem(STORAGE.delta);
    localStorage.removeItem(STORAGE.ultimaSync);
  }

  function obtenerEstadoSincronizacion() {
    const delta = leerDelta();
    let ultima = {};
    try { ultima = JSON.parse(localStorage.getItem(STORAGE.ultimaSync) || '{}'); }
    catch { ultima = {}; }
    return {
      inicializada: Boolean(delta.deltaLink),
      deltaActualizadoEn: delta.actualizadoEn || null,
      ...ultima
    };
  }

  async function descargarCambiosDelta(opciones = {}, reintento = false) {
    const perfil = await obtenerPerfil();
    const estado = leerDelta();
    const mismaCuenta = !estado.cuentaId || estado.cuentaId === perfil.id;
    let siguiente = mismaCuenta ? estado.deltaLink : null;
    const esInicial = !siguiente;

    if (!siguiente) {
      const top = Math.min(100, Math.max(10, Number(opciones.top || 50)));
      siguiente = `/me/mailFolders/inbox/messages/delta?$select=${encodeURIComponent(MESSAGE_SELECT)}&$top=${top}`;
    }

    const mensajes = [];
    const eliminados = [];
    let paginas = 0;
    let deltaLink = null;
    const maxPaginas = Math.max(1, Number(opciones.maxPaginas || 100));

    try {
      while (siguiente) {
        if (++paginas > maxPaginas) {
          throw new Error('La sincronización inicial contiene demasiados correos. Aumenta maxPaginas para completarla.');
        }
        const pagina = await graph(siguiente);
        for (const item of pagina.value || []) {
          if (item['@removed']) eliminados.push({ id: item.id, razon: item['@removed'].reason || 'deleted' });
          else mensajes.push(adaptarMensaje(item));
        }
        siguiente = pagina['@odata.nextLink'] || null;
        deltaLink = pagina['@odata.deltaLink'] || deltaLink;
      }
    } catch (error) {
      if (!reintento && (error.status === 410 || error.codigo === 'SyncStateNotFound')) {
        limpiarDelta();
        return descargarCambiosDelta(opciones, true);
      }
      throw error;
    }

    if (!deltaLink) throw new Error('Microsoft Graph no devolvió un deltaLink válido.');
    guardarDelta({ deltaLink, cuentaId: perfil.id });
    return { mensajes, eliminados, paginas, esInicial, deltaLinkGuardado: true };
  }

  async function sincronizarIncremental(opciones = {}) {
    if (!window.HFPipelineOutlook) throw new Error('HFPipelineOutlook no está cargado.');
    const cambios = await descargarCambiosDelta(opciones);
    const resumen = cambios.mensajes.length
      ? await HFPipelineOutlook.procesarLote(cambios.mensajes, opciones.pipeline || {})
      : {};

    const resultado = {
      ...resumen,
      mensajesLeidos: cambios.mensajes.length,
      eliminados: cambios.eliminados.length,
      paginas: cambios.paginas,
      sincronizacionInicial: cambios.esInicial,
      modo: 'incremental',
      sincronizadoEn: new Date().toISOString()
    };
    localStorage.setItem(STORAGE.ultimaSync, JSON.stringify(resultado));
    return resultado;
  }

  async function sincronizarCompleta(opciones = {}) {
    if (!window.HFPipelineOutlook) throw new Error('HFPipelineOutlook no está cargado.');
    const mensajes = await listarMensajes(opciones);
    const resumen = await HFPipelineOutlook.procesarLote(mensajes, opciones.pipeline || {});
    const resultado = {
      ...resumen,
      mensajesLeidos: mensajes.length,
      eliminados: 0,
      modo: 'completa',
      sincronizadoEn: new Date().toISOString()
    };
    localStorage.setItem(STORAGE.ultimaSync, JSON.stringify(resultado));
    return resultado;
  }

  async function sincronizar(opciones = {}) {
    return opciones.incremental === false
      ? sincronizarCompleta(opciones)
      : sincronizarIncremental(opciones);
  }

  function estaConectado() {
    const token = leerToken();
    return Boolean(token.accessToken || token.refreshToken);
  }

  function cerrarSesion() {
    localStorage.removeItem(STORAGE.token);
    limpiarDelta();
  }

  window.HFOutlookGraph = Object.freeze({
    configurar,
    leerConfig,
    iniciarSesion,
    procesarCallback,
    obtenerPerfil,
    listarMensajes,
    descargarCambiosDelta,
    sincronizarIncremental,
    sincronizarCompleta,
    sincronizar,
    leerDelta,
    limpiarDelta,
    obtenerEstadoSincronizacion,
    estaConectado,
    cerrarSesion,
    graph
  });
})();

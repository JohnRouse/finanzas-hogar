/* Hogar Finanzas — Etapa 11.3.2: interfaz Outlook */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  function toast(mensaje) {
    if (typeof window.showToast === 'function') window.showToast(mensaje);
    else console.info(mensaje);
  }

  function inyectarEstilos() {
    if ($('hf-outlook-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-outlook-styles';
    style.textContent = `
      .hf-outlook-btn{display:inline-flex;align-items:center;gap:.45rem}
      .hf-outlook-dot{width:9px;height:9px;border-radius:50%;background:#9ca3af;display:inline-block}
      .hf-outlook-dot.on{background:#16a34a}
      .hf-outlook-card{border:1px solid rgba(148,163,184,.25);border-radius:18px;padding:16px;margin:12px 0;background:rgba(255,255,255,.03)}
      .hf-outlook-status{display:flex;gap:12px;align-items:center;margin-bottom:12px}
      .hf-outlook-status strong{display:block}
      .hf-outlook-status small{opacity:.72}
      .hf-outlook-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
      .hf-outlook-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .hf-outlook-grid label{display:flex;flex-direction:column;gap:6px;font-size:.85rem}
      .hf-outlook-grid input{width:100%;box-sizing:border-box}
      .hf-outlook-result{margin-top:14px;padding:12px;border-radius:14px;background:rgba(148,163,184,.12);font-size:.9rem;white-space:pre-line}
      @media(max-width:640px){.hf-outlook-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function inyectarBoton() {
    if ($('btn-outlook')) return;
    const toolbar = document.querySelector('#page-gastos .section-head > div[style*="display:flex"]')
      || document.querySelector('#page-gastos .section-head');
    if (!toolbar) return;
    const btn = document.createElement('button');
    btn.id = 'btn-outlook';
    btn.className = 'btn-recurrentes hf-outlook-btn';
    btn.innerHTML = '<span id="hf-outlook-dot" class="hf-outlook-dot"></span> Outlook';
    btn.onclick = abrirOutlook;
    toolbar.appendChild(btn);
  }

  function inyectarModal() {
    if ($('outlookModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="outlookModal" onclick="closeModalOutside(event,'outlookModal')">
        <div class="modal-sheet" style="position:relative;max-width:620px">
          <button class="modal-close" onclick="closeModal('outlookModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="modal-title">Conexión con Outlook</div>
          <p style="opacity:.75;margin-top:4px">Conecta tu cuenta para detectar estados de cuenta, consumos y pagos bancarios.</p>

          <div class="hf-outlook-card">
            <div class="hf-outlook-status">
              <span id="hf-outlook-status-dot" class="hf-outlook-dot"></span>
              <div>
                <strong id="hf-outlook-status-title">No conectado</strong>
                <small id="hf-outlook-status-detail">Configura Microsoft Entra y conecta tu cuenta.</small>
              </div>
            </div>

            <div class="hf-outlook-grid">
              <label>Client ID de Microsoft Entra
                <input id="hf-outlook-client-id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
              </label>
              <label>Tenant
                <input id="hf-outlook-tenant" value="common" placeholder="common">
              </label>
            </div>

            <div class="hf-outlook-actions">
              <button class="btn-ingreso-extra" id="hf-outlook-connect" onclick="conectarOutlook()">Conectar Outlook</button>
              <button class="btn-recurrentes" id="hf-outlook-sync" onclick="sincronizarOutlook()">Sincronizar ahora</button>
              <button class="btn-recurrentes secondary" id="hf-outlook-disconnect" onclick="desconectarOutlook()">Desconectar</button>
            </div>

            <div class="hf-outlook-result" id="hf-outlook-result" style="display:none"></div>
          </div>

          <div class="hf-outlook-card">
            <strong>URL de redirección para Microsoft Entra</strong>
            <p style="opacity:.72;margin:.5rem 0">Copia exactamente esta dirección en la plataforma SPA de tu registro de aplicación.</p>
            <input id="hf-outlook-redirect" readonly style="width:100%;box-sizing:border-box">
          </div>
        </div>
      </div>
    `);
  }

  function configActual() {
    return window.HFOutlookGraph?.leerConfig?.() || {};
  }

  async function actualizarEstado() {
    const conectado = Boolean(window.HFOutlookGraph?.estaConectado?.());
    const dot = $('hf-outlook-dot');
    const statusDot = $('hf-outlook-status-dot');
    dot?.classList.toggle('on', conectado);
    statusDot?.classList.toggle('on', conectado);

    const title = $('hf-outlook-status-title');
    const detail = $('hf-outlook-status-detail');
    if (title) title.textContent = conectado ? 'Outlook conectado' : 'No conectado';
    if (detail) detail.textContent = conectado ? 'La cuenta está lista para sincronizar.' : 'Configura Microsoft Entra y conecta tu cuenta.';

    $('hf-outlook-sync')?.toggleAttribute('disabled', !conectado);
    $('hf-outlook-disconnect')?.toggleAttribute('disabled', !conectado);

    if (conectado) {
      try {
        const perfil = await HFOutlookGraph.obtenerPerfil();
        if (detail) detail.textContent = perfil.mail || perfil.userPrincipalName || perfil.displayName || 'Cuenta conectada';
      } catch (error) {
        if (detail) detail.textContent = error.message;
      }
    }
  }

  window.abrirOutlook = async function() {
    inyectarModal();
    const config = configActual();
    $('hf-outlook-client-id').value = config.clientId || '';
    $('hf-outlook-tenant').value = config.tenant || 'common';
    $('hf-outlook-redirect').value = config.redirectUri || `${location.origin}${location.pathname}`;
    await actualizarEstado();
    if (typeof openModal === 'function') openModal('outlookModal');
    else $('outlookModal').style.display = 'flex';
  };

  window.conectarOutlook = async function() {
    try {
      const clientId = $('hf-outlook-client-id').value.trim();
      const tenant = $('hf-outlook-tenant').value.trim() || 'common';
      if (!clientId) return toast('Ingresa el Client ID de Microsoft Entra');
      HFOutlookGraph.configurar({
        clientId,
        tenant,
        redirectUri: `${location.origin}${location.pathname}`
      });
      await HFOutlookGraph.iniciarSesion();
    } catch (error) {
      console.error(error);
      toast(error.message || 'No se pudo iniciar la conexión con Outlook');
    }
  };

  window.sincronizarOutlook = async function() {
    const btn = $('hf-outlook-sync');
    const result = $('hf-outlook-result');
    try {
      btn.disabled = true;
      btn.textContent = 'Sincronizando…';
      result.style.display = 'block';
      result.textContent = 'Leyendo correos bancarios y preparando movimientos…';

      const desde = new Date();
      desde.setDate(desde.getDate() - 120);
      const resumen = await HFOutlookGraph.sincronizar({
        desde,
        maximo: 100,
        top: 50
      });

      result.textContent = [
        `Correos revisados: ${resumen.mensajesLeidos || 0}`,
        `Movimientos nuevos: ${resumen.creados || 0}`,
        `Pendientes: ${resumen.pendientes || 0}`,
        `Requieren revisión: ${resumen.revision || 0}`,
        `Duplicados: ${resumen.duplicados || 0}`,
        `Errores: ${resumen.errores || 0}`
      ].join('\n');
      toast('Sincronización de Outlook finalizada');
    } catch (error) {
      console.error(error);
      result.style.display = 'block';
      result.textContent = error.message || 'No se pudo sincronizar Outlook.';
      toast('No se pudo sincronizar Outlook');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sincronizar ahora';
      await actualizarEstado();
    }
  };

  window.desconectarOutlook = function() {
    if (!confirm('¿Desconectar la cuenta de Outlook de este dispositivo?')) return;
    HFOutlookGraph.cerrarSesion();
    actualizarEstado();
    toast('Outlook desconectado');
  };

  async function procesarCallback() {
    if (!window.HFOutlookGraph) return;
    try {
      const resultado = await HFOutlookGraph.procesarCallback();
      if (resultado.procesado) {
        toast('Outlook conectado correctamente');
        setTimeout(() => abrirOutlook(), 250);
      }
    } catch (error) {
      console.error(error);
      toast(error.message || 'No se pudo completar la conexión con Outlook');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      inyectarEstilos();
      inyectarBoton();
      inyectarModal();
      actualizarEstado();
      procesarCallback();
    }, 1400);
  });
})();

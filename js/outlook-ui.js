/* Hogar Finanzas — Etapa 11.3.7: interfaz Outlook y vinculaciones de tarjetas */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = valor => String(valor ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  let tarjetasCache = [];
  let vinculacionesCache = [];
  let vinculacionEditando = null;

  function toast(mensaje) {
    if (typeof window.showToast === 'function') window.showToast(mensaje);
    else console.info(mensaje);
  }

  function hogarActual() {
    return window.DB?.hogarId || localStorage.getItem('hogarId') || null;
  }

  function inyectarEstilos() {
    if ($('hf-outlook-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-outlook-styles';
    style.textContent = `
      .hf-outlook-btn{display:inline-flex;align-items:center;gap:.45rem}
      .hf-outlook-dot{width:9px;height:9px;border-radius:50%;background:#9ca3af;display:inline-block;flex:none}
      .hf-outlook-dot.on{background:#16a34a}.hf-outlook-dot.warn{background:#f59e0b}
      .hf-outlook-card{border:1px solid rgba(148,163,184,.25);border-radius:18px;padding:16px;margin:12px 0;background:rgba(255,255,255,.03)}
      .hf-outlook-status{display:flex;gap:12px;align-items:center;margin-bottom:12px}.hf-outlook-status strong{display:block}.hf-outlook-status small{opacity:.72}
      .hf-outlook-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
      .hf-outlook-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.hf-outlook-grid.three{grid-template-columns:1.4fr 1fr .7fr}
      .hf-outlook-grid label{display:flex;flex-direction:column;gap:6px;font-size:.85rem}.hf-outlook-grid input,.hf-outlook-grid select{width:100%;box-sizing:border-box}
      .hf-outlook-result{margin-top:14px;padding:12px;border-radius:14px;background:rgba(148,163,184,.12);font-size:.9rem;white-space:pre-line}
      .hf-outlook-section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
      .hf-vinculo-list{display:grid;gap:10px;margin-top:12px}.hf-vinculo-item{display:flex;justify-content:space-between;gap:12px;padding:12px;border-radius:14px;background:rgba(148,163,184,.09);border:1px solid rgba(148,163,184,.16)}
      .hf-vinculo-item strong{display:block}.hf-vinculo-item small{display:block;opacity:.72;margin-top:3px}.hf-vinculo-actions{display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap}
      .hf-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:.72rem;background:rgba(59,130,246,.14);margin-right:5px;margin-top:6px}.hf-badge.ok{background:rgba(22,163,74,.14)}.hf-badge.warn{background:rgba(245,158,11,.16)}
      .hf-empty{text-align:center;opacity:.7;padding:18px 8px}.hf-confidence{font-weight:700;font-size:1.1rem}.hf-divider{height:1px;background:rgba(148,163,184,.2);margin:16px 0}
      @media(max-width:640px){.hf-outlook-grid,.hf-outlook-grid.three{grid-template-columns:1fr}.hf-vinculo-item{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function inyectarBoton() {
    if ($('btn-outlook')) return;
    const toolbar = document.querySelector('#page-gastos .section-head > div[style*="display:flex"]') || document.querySelector('#page-gastos .section-head');
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
        <div class="modal-sheet" style="position:relative;max-width:760px;max-height:92vh;overflow:auto">
          <button class="modal-close" onclick="closeModal('outlookModal')">✕</button><div class="modal-handle"></div>
          <div class="modal-title">Outlook y tarjetas</div>
          <p style="opacity:.75;margin-top:4px">Conecta tu cuenta y define cómo reconocer cada tarjeta bancaria.</p>

          <div class="hf-outlook-card">
            <div class="hf-outlook-status"><span id="hf-outlook-status-dot" class="hf-outlook-dot"></span><div><strong id="hf-outlook-status-title">No conectado</strong><small id="hf-outlook-status-detail">Configura Microsoft Entra y conecta tu cuenta.</small></div></div>
            <div class="hf-outlook-grid"><label>Client ID de Microsoft Entra<input id="hf-outlook-client-id" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></label><label>Tenant<input id="hf-outlook-tenant" value="common" placeholder="common"></label></div>
            <div class="hf-outlook-actions"><button class="btn-ingreso-extra" id="hf-outlook-connect" onclick="conectarOutlook()">Conectar Outlook</button><button class="btn-recurrentes" id="hf-outlook-sync" onclick="sincronizarOutlook()">Sincronizar ahora</button><button class="btn-recurrentes secondary" id="hf-outlook-disconnect" onclick="desconectarOutlook()">Desconectar</button></div>
            <div class="hf-outlook-result" id="hf-outlook-result" style="display:none"></div>
          </div>

          <div class="hf-outlook-card">
            <div class="hf-outlook-section-title"><div><strong>Vinculaciones de tarjetas</strong><div style="opacity:.7;font-size:.82rem">Indica qué banco y últimos dígitos corresponden a cada tarjeta.</div></div><button class="btn-recurrentes" onclick="nuevaVinculacionOutlook()">Nueva</button></div>
            <div id="hf-vinculo-form" style="display:none">
              <div class="hf-divider"></div>
              <input type="hidden" id="hf-vinculo-id">
              <div class="hf-outlook-grid"><label>Tarjeta<select id="hf-vinculo-tarjeta"></select></label><label>Banco o identificador<input id="hf-vinculo-banco" placeholder="BBVA, BCP, Santander..."></label></div>
              <div class="hf-outlook-grid three" style="margin-top:12px"><label>Alias adicional<input id="hf-vinculo-alias" placeholder="Ej. Interbank Visa"></label><label>Últimos 4 dígitos<input id="hf-vinculo-digitos" inputmode="numeric" maxlength="4" placeholder="1234"></label><label>Moneda<select id="hf-vinculo-moneda"><option value="PEN">Soles</option><option value="USD">Dólares</option></select></label></div>
              <div class="hf-outlook-grid" style="margin-top:12px"><label>Prioridad<input id="hf-vinculo-prioridad" type="number" min="0" max="100" value="0"></label><label style="justify-content:flex-end"><span><input id="hf-vinculo-activa" type="checkbox" checked style="width:auto"> Vinculación activa</span></label></div>
              <div class="hf-outlook-actions"><button class="btn-ingreso-extra" id="hf-vinculo-guardar" onclick="guardarVinculacionOutlook()">Guardar vinculación</button><button class="btn-recurrentes secondary" onclick="cancelarVinculacionOutlook()">Cancelar</button></div>
            </div>
            <div id="hf-vinculo-list" class="hf-vinculo-list"><div class="hf-empty">Cargando vinculaciones…</div></div>
          </div>

          <div class="hf-outlook-card">
            <strong>Probar reconocimiento</strong><p style="opacity:.72;margin:.4rem 0 12px">Simula los datos encontrados en un correo y comprueba qué tarjeta elegiría el motor.</p>
            <div class="hf-outlook-grid three"><label>Banco<input id="hf-prueba-banco" placeholder="Santander"></label><label>Últimos 4<input id="hf-prueba-digitos" maxlength="4" inputmode="numeric" placeholder="1234"></label><label>Moneda<select id="hf-prueba-moneda"><option value="PEN">PEN</option><option value="USD">USD</option></select></label></div>
            <div class="hf-outlook-actions"><button class="btn-recurrentes" onclick="probarVinculacionOutlook()">Probar coincidencia</button><button class="btn-recurrentes secondary" id="hf-reprocesar" onclick="reprocesarAmbiguosOutlook()">Reprocesar pendientes</button></div>
            <div class="hf-outlook-result" id="hf-prueba-result" style="display:none"></div>
          </div>

          <div class="hf-outlook-card"><strong>URL de redirección para Microsoft Entra</strong><p style="opacity:.72;margin:.5rem 0">Copia exactamente esta dirección en la plataforma SPA de tu registro de aplicación.</p><input id="hf-outlook-redirect" readonly style="width:100%;box-sizing:border-box"></div>
        </div>
      </div>`);
  }

  function configActual() { return window.HFOutlookGraph?.leerConfig?.() || {}; }
  function nombreTarjeta(t) { return t.nombre || t.alias || `${t.banco || 'Tarjeta'} ${t.ultimosDigitos || t.ultimos4 ? '•••• ' + (t.ultimosDigitos || t.ultimos4) : ''}`.trim(); }

  async function actualizarEstado() {
    const conectado = Boolean(window.HFOutlookGraph?.estaConectado?.());
    $('hf-outlook-dot')?.classList.toggle('on', conectado); $('hf-outlook-status-dot')?.classList.toggle('on', conectado);
    if ($('hf-outlook-status-title')) $('hf-outlook-status-title').textContent = conectado ? 'Outlook conectado' : 'No conectado';
    if ($('hf-outlook-status-detail')) $('hf-outlook-status-detail').textContent = conectado ? 'La cuenta está lista para sincronizar.' : 'Configura Microsoft Entra y conecta tu cuenta.';
    $('hf-outlook-sync')?.toggleAttribute('disabled', !conectado); $('hf-outlook-disconnect')?.toggleAttribute('disabled', !conectado);
    if (conectado) try { const p = await HFOutlookGraph.obtenerPerfil(); $('hf-outlook-status-detail').textContent = p.mail || p.userPrincipalName || p.displayName || 'Cuenta conectada'; } catch (e) { $('hf-outlook-status-detail').textContent = e.message; }
  }

  async function cargarVinculaciones() {
    const list = $('hf-vinculo-list');
    if (!list || !window.HFVinculacionTarjetasOutlook) return;
    try {
      [tarjetasCache, vinculacionesCache] = await Promise.all([HFVinculacionTarjetasOutlook.obtenerTarjetas(), HFVinculacionTarjetasOutlook.listarVinculaciones()]);
      const select = $('hf-vinculo-tarjeta');
      if (select) select.innerHTML = '<option value="">Selecciona una tarjeta</option>' + tarjetasCache.map(t => `<option value="${esc(t.id)}">${esc(nombreTarjeta(t))}</option>`).join('');
      if (!vinculacionesCache.length) { list.innerHTML = '<div class="hf-empty">Aún no hay vinculaciones. Crea una para que Outlook reconozca tus tarjetas automáticamente.</div>'; return; }
      const mapa = new Map(tarjetasCache.map(t => [t.id, t]));
      list.innerHTML = vinculacionesCache.map(v => {
        const t = mapa.get(v.tarjetaId) || {};
        return `<div class="hf-vinculo-item"><div><strong>${esc(nombreTarjeta(t) || 'Tarjeta no encontrada')}</strong><small>${esc(v.aliasBanco || v.banco || 'Banco sin especificar')} · ${v.ultimosDigitos ? '•••• ' + esc(v.ultimosDigitos) : 'sin últimos dígitos'} · ${esc(v.moneda || 'PEN')}</small><span class="hf-badge ${v.activa === false ? 'warn' : 'ok'}">${v.activa === false ? 'Inactiva' : 'Activa'}</span><span class="hf-badge">Prioridad ${Number(v.prioridad || 0)}</span></div><div class="hf-vinculo-actions"><button class="btn-recurrentes" onclick="editarVinculacionOutlook('${esc(v.id)}')">Editar</button><button class="btn-recurrentes secondary" onclick="eliminarVinculacionOutlook('${esc(v.id)}')">Eliminar</button></div></div>`;
      }).join('');
    } catch (error) { console.error(error); list.innerHTML = `<div class="hf-empty">${esc(error.message || 'No se pudieron cargar las vinculaciones.')}</div>`; }
  }

  window.abrirOutlook = async function() {
    inyectarModal(); const c = configActual();
    $('hf-outlook-client-id').value = c.clientId || ''; $('hf-outlook-tenant').value = c.tenant || 'common'; $('hf-outlook-redirect').value = c.redirectUri || `${location.origin}${location.pathname}`;
    await Promise.all([actualizarEstado(), cargarVinculaciones()]);
    if (typeof openModal === 'function') openModal('outlookModal'); else $('outlookModal').style.display = 'flex';
  };

  window.nuevaVinculacionOutlook = function() {
    vinculacionEditando = null; $('hf-vinculo-id').value = ''; $('hf-vinculo-tarjeta').value = ''; $('hf-vinculo-banco').value = ''; $('hf-vinculo-alias').value = ''; $('hf-vinculo-digitos').value = ''; $('hf-vinculo-moneda').value = 'PEN'; $('hf-vinculo-prioridad').value = '0'; $('hf-vinculo-activa').checked = true; $('hf-vinculo-form').style.display = 'block';
  };
  window.cancelarVinculacionOutlook = function() { vinculacionEditando = null; $('hf-vinculo-form').style.display = 'none'; };
  window.editarVinculacionOutlook = function(id) {
    const v = vinculacionesCache.find(x => x.id === id); if (!v) return;
    vinculacionEditando = id; $('hf-vinculo-id').value = id; $('hf-vinculo-tarjeta').value = v.tarjetaId || ''; $('hf-vinculo-banco').value = v.banco || ''; $('hf-vinculo-alias').value = v.aliasBanco || ''; $('hf-vinculo-digitos').value = v.ultimosDigitos || ''; $('hf-vinculo-moneda').value = v.moneda || 'PEN'; $('hf-vinculo-prioridad').value = Number(v.prioridad || 0); $('hf-vinculo-activa').checked = v.activa !== false; $('hf-vinculo-form').style.display = 'block'; $('hf-vinculo-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  window.guardarVinculacionOutlook = async function() {
    const btn = $('hf-vinculo-guardar');
    try {
      btn.disabled = true;
      const digitos = $('hf-vinculo-digitos').value.trim(); if (digitos && !/^\d{4}$/.test(digitos)) throw new Error('Los últimos dígitos deben contener exactamente 4 números.');
      await HFVinculacionTarjetasOutlook.guardarVinculacion({ id: vinculacionEditando, tarjetaId: $('hf-vinculo-tarjeta').value, banco: $('hf-vinculo-banco').value, aliasBanco: $('hf-vinculo-alias').value, ultimosDigitos: digitos, moneda: $('hf-vinculo-moneda').value, prioridad: Number($('hf-vinculo-prioridad').value || 0), activa: $('hf-vinculo-activa').checked });
      cancelarVinculacionOutlook(); await cargarVinculaciones(); toast('Vinculación guardada');
    } catch (error) { console.error(error); toast(error.message || 'No se pudo guardar la vinculación'); } finally { btn.disabled = false; }
  };
  window.eliminarVinculacionOutlook = async function(id) {
    if (!confirm('¿Eliminar esta vinculación de Outlook?')) return;
    try { await HFVinculacionTarjetasOutlook.eliminarVinculacion(id); await cargarVinculaciones(); toast('Vinculación eliminada'); } catch (e) { toast(e.message || 'No se pudo eliminar'); }
  };

  window.probarVinculacionOutlook = async function() {
    const result = $('hf-prueba-result');
    try {
      result.style.display = 'block'; result.textContent = 'Analizando coincidencias…';
      const r = await HFVinculacionTarjetasOutlook.resolverTarjeta({ banco: $('hf-prueba-banco').value, ultimosDigitos: $('hf-prueba-digitos').value, moneda: $('hf-prueba-moneda').value, tipo: 'consumo-credito' });
      const tarjeta = r.tarjeta || tarjetasCache.find(t => t.id === r.tarjetaId);
      const lineas = [r.tarjetaId ? `Tarjeta elegida: ${nombreTarjeta(tarjeta || {})}` : r.origen === 'ambiguo' ? 'Resultado: coincidencia ambigua' : 'Resultado: sin coincidencia', `Confianza: ${Number(r.confianza || 0)} puntos`, `Origen: ${r.origen || 'sin-coincidencia'}`];
      if (r.detalles?.length) lineas.push(`Coincidencias: ${r.detalles.join(', ')}`);
      if (r.candidatos?.length) lineas.push('', 'Candidatos:', ...r.candidatos.map(c => `• ${c.nombre || c.tarjetaId}: ${c.puntaje} puntos`));
      result.textContent = lineas.join('\n');
    } catch (e) { result.style.display = 'block'; result.textContent = e.message || 'No se pudo ejecutar la prueba.'; }
  };

  window.reprocesarAmbiguosOutlook = async function() {
    const btn = $('hf-reprocesar'); const result = $('hf-prueba-result');
    try {
      if (!hogarActual() || !window.db || !window.HFPipelineOutlook?.reprocesarImportacion) throw new Error('El motor de reprocesamiento no está disponible.');
      btn.disabled = true; result.style.display = 'block'; result.textContent = 'Buscando importaciones pendientes…';
      const ref = db.collection('hogares').doc(hogarActual()).collection('movimientosImportados');
      const snap = await ref.where('estado', '==', 'requiere-revision').limit(100).get();
      let procesados = 0, resueltos = 0, errores = 0;
      for (const doc of snap.docs) {
        const datos = doc.data();
        if (datos.origen !== 'outlook' && datos.proveedorOrigen !== 'microsoft-graph') continue;
        try { const r = await HFPipelineOutlook.reprocesarImportacion(doc.id); procesados++; if (r.estado !== 'requiere-revision') resueltos++; } catch (e) { errores++; console.warn(e); }
      }
      result.textContent = `Importaciones reprocesadas: ${procesados}\nResueltas automáticamente: ${resueltos}\nAún pendientes: ${Math.max(0, procesados - resueltos)}\nErrores: ${errores}`;
      toast('Reprocesamiento finalizado');
    } catch (e) { result.style.display = 'block'; result.textContent = e.message || 'No se pudieron reprocesar las importaciones.'; } finally { btn.disabled = false; }
  };

  window.conectarOutlook = async function() { try { const clientId = $('hf-outlook-client-id').value.trim(); const tenant = $('hf-outlook-tenant').value.trim() || 'common'; if (!clientId) return toast('Ingresa el Client ID de Microsoft Entra'); HFOutlookGraph.configurar({ clientId, tenant, redirectUri: `${location.origin}${location.pathname}` }); await HFOutlookGraph.iniciarSesion(); } catch (e) { console.error(e); toast(e.message || 'No se pudo iniciar la conexión con Outlook'); } };
  window.sincronizarOutlook = async function() {
    const btn = $('hf-outlook-sync'), result = $('hf-outlook-result');
    try { btn.disabled = true; btn.textContent = 'Sincronizando…'; result.style.display = 'block'; result.textContent = 'Leyendo correos bancarios y preparando movimientos…'; const desde = new Date(); desde.setDate(desde.getDate() - 120); const r = await HFOutlookGraph.sincronizar({ desde, maximo: 100, top: 50 }); result.textContent = [`Correos revisados: ${r.mensajesLeidos || 0}`, `Movimientos nuevos: ${r.creados || 0}`, `Autoasignados: ${r.autoasignados || 0}`, `Sin tarjeta: ${r.sinTarjeta || 0}`, `Pendientes: ${r.pendientes || 0}`, `Requieren revisión: ${r.revision || 0}`, `Duplicados: ${r.duplicados || 0}`, `Errores: ${r.errores || 0}`].join('\n'); toast('Sincronización de Outlook finalizada'); } catch (e) { console.error(e); result.style.display = 'block'; result.textContent = e.message || 'No se pudo sincronizar Outlook.'; toast('No se pudo sincronizar Outlook'); } finally { btn.disabled = false; btn.textContent = 'Sincronizar ahora'; await actualizarEstado(); }
  };
  window.desconectarOutlook = function() { if (!confirm('¿Desconectar la cuenta de Outlook de este dispositivo?')) return; HFOutlookGraph.cerrarSesion(); actualizarEstado(); toast('Outlook desconectado'); };

  async function procesarCallback() { if (!window.HFOutlookGraph) return; try { const r = await HFOutlookGraph.procesarCallback(); if (r.procesado) { toast('Outlook conectado correctamente'); setTimeout(() => abrirOutlook(), 250); } } catch (e) { console.error(e); toast(e.message || 'No se pudo completar la conexión con Outlook'); } }
  document.addEventListener('DOMContentLoaded', () => { setTimeout(() => { inyectarEstilos(); inyectarBoton(); inyectarModal(); actualizarEstado(); procesarCallback(); }, 1400); });
})();
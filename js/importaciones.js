
/* Hogar Finanzas — Etapa 11.1: Bandeja de importaciones */
(() => {
  'use strict';

  const ESTADOS = {
    pendiente: 'Pendiente',
    confirmado: 'Confirmado',
    descartado: 'Descartado',
    duplicado: 'Duplicado',
    'requiere-revision': 'Requiere revisión'
  };

  let importaciones = [];
  let filtroEstado = 'pendiente';
  let unsubscribe = null;

  const $ = (id) => document.getElementById(id);
  const escape = (value='') => String(value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));

  function hogarActual() {
    return window.DB?.hogarId || localStorage.getItem('hogarId') || null;
  }

  function miembroActual() {
    const cfg = window.configCache || {};
    const id = localStorage.getItem('miembroActualId');
    const miembro = cfg.miembros?.[id];
    return {
      id: miembro?.id || id || null,
      nombre: miembro?.nombre || (localStorage.getItem('miUsuarioTipo') === 'pareja' ? 'Sydney' : 'Christian'),
      legacyTipo: miembro?.legacyTipo || localStorage.getItem('miUsuarioTipo') || 'yo'
    };
  }

  function refImportaciones() {
    const hogarId = hogarActual();
    if (!hogarId || !window.db) throw new Error('No hay un hogar activo.');
    return db.collection('hogares').doc(hogarId).collection('movimientosImportados');
  }

  async function sha256(texto) {
    const bytes = new TextEncoder().encode(texto);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  async function construirHuella(datos) {
    const base = [
      (datos.banco || '').toLowerCase().trim(),
      (datos.tipo || '').toLowerCase().trim(),
      Number(datos.monto || 0).toFixed(2),
      datos.moneda || 'PEN',
      datos.fechaOperacion || '',
      (datos.comercio || datos.descripcion || '').toLowerCase().replace(/\s+/g,' ').trim(),
      datos.ultimosDigitos || '',
      datos.messageId || datos.idCorreo || ''
    ].join('|');
    return sha256(base);
  }

  function inyectarInterfaz() {
    if ($('importacionesModal')) return;

    const toolbar = document.querySelector('#page-gastos .section-head > div[style*="display:flex"]')
      || document.querySelector('#page-gastos .section-head');
    if (toolbar) {
      const btn = document.createElement('button');
      btn.className = 'btn-recurrentes hf-import-btn';
      btn.id = 'btn-importaciones';
      btn.innerHTML = '📥 Detectados <span id="import-pending-count" class="hf-import-count">0</span>';
      btn.onclick = abrirBandejaImportaciones;
      toolbar.appendChild(btn);
    }

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="importacionesModal" onclick="closeModalOutside(event,'importacionesModal')">
        <div class="modal-sheet hf-import-sheet" style="position:relative;">
          <button class="modal-close" onclick="closeModal('importacionesModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="modal-title">Movimientos detectados</div>
          <p class="hf-import-help">Nada se registra automáticamente. Revisa, edita y confirma cada movimiento.</p>

          <div class="hf-import-toolbar">
            <div class="hf-import-filters" id="import-filters">
              ${Object.entries(ESTADOS).map(([k,v]) => `<button data-state="${k}" onclick="filtrarImportaciones('${k}',this)">${v}</button>`).join('')}
            </div>
            <button class="btn-recurrentes" onclick="abrirImportacionManual()">+ Añadir detectado</button>
          </div>

          <div id="importaciones-lista" class="hf-import-list">
            <div class="empty-state">Cargando movimientos…</div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" id="importacionEditorModal" onclick="closeModalOutside(event,'importacionEditorModal')">
        <div class="modal-sheet hf-import-editor" style="position:relative;">
          <button class="modal-close" onclick="closeModal('importacionEditorModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="modal-title" id="import-editor-title">Movimiento detectado</div>
          <input type="hidden" id="imp-id">
          <div class="form-grid">
            <label>Banco o fuente<input id="imp-banco" placeholder="BCP, Yape, Santander…"></label>
            <label>Tipo
              <select id="imp-tipo">
                <option value="consumo-credito">Consumo con tarjeta de crédito</option>
                <option value="consumo-debito">Consumo con débito</option>
                <option value="yape">Yape</option>
                <option value="pago-servicio">Pago de servicio</option>
                <option value="deposito">Depósito o ingreso</option>
                <option value="pago-tarjeta">Pago de tarjeta</option>
                <option value="estado-cuenta">Estado de cuenta</option>
                <option value="credito">Crédito o préstamo</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label>Monto<input id="imp-monto" type="number" min="0" step="0.01"></label>
            <label>Moneda
              <select id="imp-moneda"><option value="PEN">Soles</option><option value="USD">Dólares</option></select>
            </label>
            <label>Fecha de operación<input id="imp-fecha" type="date"></label>
            <label>Últimos dígitos<input id="imp-digitos" maxlength="4" inputmode="numeric" placeholder="1234"></label>
            <label class="wide">Comercio o destinatario<input id="imp-comercio" placeholder="Plaza Vea, persona, servicio…"></label>
            <label class="wide">Descripción<textarea id="imp-descripcion" rows="3"></textarea></label>
            <label>Categoría
              <select id="imp-categoria">
                <option>Alimentación</option><option>Servicios</option><option>Entret.</option>
                <option>Transporte</option><option>Salud</option><option>Hogar</option>
                <option>Deudas</option><option selected>Otros</option>
              </select>
            </label>
            <label>Responsable
              <select id="imp-quien"><option value="yo">Christian</option><option value="pareja">Sydney</option></select>
            </label>
            <label class="wide">Tarjeta vinculada<select id="imp-tarjeta"><option value="">Sin tarjeta vinculada</option></select></label>
          </div>
          <div class="hf-import-actions">
            <button class="btn-recurrentes secondary" onclick="guardarImportacionPendiente()">Guardar pendiente</button>
            <button class="btn-ingreso-extra" onclick="confirmarImportacionDesdeEditor()">Confirmar y registrar</button>
          </div>
        </div>
      </div>
    `);
  }

  function iniciarEscucha() {
    if (unsubscribe || !hogarActual()) return;
    unsubscribe = refImportaciones().orderBy('creadoEn','desc').limit(200)
      .onSnapshot(snap => {
        importaciones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        actualizarContador();
        renderImportaciones();
      }, error => {
        console.error('Error escuchando importaciones:', error);
        const lista = $('importaciones-lista');
        if (lista) lista.innerHTML = '<div class="empty-state">No se pudo cargar la bandeja.</div>';
      });
  }

  function actualizarContador() {
    const n = importaciones.filter(x => ['pendiente','requiere-revision'].includes(x.estado || 'pendiente')).length;
    const el = $('import-pending-count');
    if (el) {
      el.textContent = n;
      el.style.display = n ? '' : 'none';
    }
  }

  window.abrirBandejaImportaciones = function() {
    inyectarInterfaz();
    iniciarEscucha();
    filtroEstado = 'pendiente';
    document.querySelectorAll('#import-filters button').forEach(b => b.classList.toggle('active', b.dataset.state === filtroEstado));
    renderImportaciones();
    if (typeof openModal === 'function') openModal('importacionesModal');
    else $('importacionesModal').style.display = 'flex';
  };

  window.filtrarImportaciones = function(estado, btn) {
    filtroEstado = estado;
    document.querySelectorAll('#import-filters button').forEach(b => b.classList.toggle('active', b === btn));
    renderImportaciones();
  };

  function fechaLegible(iso) {
    if (!iso) return 'Sin fecha';
    const d = new Date(`${iso}T12:00:00`);
    return isNaN(d) ? iso : d.toLocaleDateString('es-PE', {day:'2-digit',month:'short',year:'numeric'});
  }

  function iconoTipo(tipo) {
    return ({
      'consumo-credito':'💳','consumo-debito':'💳','yape':'📲','pago-servicio':'🧾',
      deposito:'💰','pago-tarjeta':'🏦','estado-cuenta':'📄',credito:'🤝',otro:'📩'
    })[tipo] || '📩';
  }

  function renderImportaciones() {
    const lista = $('importaciones-lista');
    if (!lista) return;
    const items = importaciones.filter(x => (x.estado || 'pendiente') === filtroEstado);
    if (!items.length) {
      lista.innerHTML = `<div class="empty-state">No hay movimientos en “${ESTADOS[filtroEstado]}”.</div>`;
      return;
    }
    lista.innerHTML = items.map(x => `
      <article class="hf-import-card ${escape(x.estado || 'pendiente')}">
        <div class="hf-import-icon">${iconoTipo(x.tipo)}</div>
        <div class="hf-import-main">
          <div class="hf-import-top">
            <strong>${escape(x.comercio || x.descripcion || 'Movimiento sin descripción')}</strong>
            <span class="hf-import-amount">${x.moneda === 'USD' ? '$' : 'S/'} ${Number(x.monto || 0).toFixed(2)}</span>
          </div>
          <small>${escape(x.banco || 'Fuente desconocida')} · ${fechaLegible(x.fechaOperacion)}${x.ultimosDigitos ? ` · •••• ${escape(x.ultimosDigitos)}` : ''}</small>
          <div class="hf-import-tags">
            <span>${escape(ESTADOS[x.estado || 'pendiente'])}</span>
            <span>${escape(x.tipo || 'otro')}</span>
            ${x.duplicadoDe ? '<span class="danger">Posible duplicado</span>' : ''}
          </div>
          <div class="hf-import-card-actions">
            ${['pendiente','requiere-revision'].includes(x.estado || 'pendiente') ? `
              <button onclick="editarImportacion('${x.id}')">Revisar</button>
              <button class="confirm" onclick="confirmarImportacion('${x.id}')">Confirmar</button>
              <button class="discard" onclick="descartarImportacion('${x.id}')">Descartar</button>
            ` : `<button onclick="editarImportacion('${x.id}')">Ver detalle</button>`}
          </div>
        </div>
      </article>
    `).join('');
  }

  async function cargarTarjetasSeleccion(seleccion='') {
    const select = $('imp-tarjeta');
    if (!select) return;
    const tarjetas = await DB.getTarjetas();
    select.innerHTML = '<option value="">Sin tarjeta vinculada</option>' + tarjetas.map(t =>
      `<option value="${escape(t.id)}" data-name="${escape(t.nombre || '')}" ${t.id === seleccion ? 'selected' : ''}>${escape(t.nombre || 'Tarjeta')}</option>`
    ).join('');
  }

  window.abrirImportacionManual = async function() {
    limpiarEditor();
    $('import-editor-title').textContent = 'Añadir movimiento detectado';
    await cargarTarjetasSeleccion();
    closeModal('importacionesModal');
    openModal('importacionEditorModal');
  };

  window.editarImportacion = async function(id) {
    const x = importaciones.find(i => i.id === id);
    if (!x) return;
    $('imp-id').value = x.id;
    $('imp-banco').value = x.banco || '';
    $('imp-tipo').value = x.tipo || 'otro';
    $('imp-monto').value = Number(x.monto || 0);
    $('imp-moneda').value = x.moneda || 'PEN';
    $('imp-fecha').value = x.fechaOperacion || '';
    $('imp-digitos').value = x.ultimosDigitos || '';
    $('imp-comercio').value = x.comercio || '';
    $('imp-descripcion').value = x.descripcion || '';
    $('imp-categoria').value = x.categoriaSugerida || 'Otros';
    $('imp-quien').value = x.quien || miembroActual().legacyTipo;
    await cargarTarjetasSeleccion(x.tarjetaId || '');
    $('import-editor-title').textContent = 'Revisar movimiento detectado';
    closeModal('importacionesModal');
    openModal('importacionEditorModal');
  };

  function limpiarEditor() {
    ['imp-id','imp-banco','imp-digitos','imp-comercio','imp-descripcion'].forEach(id => $(id).value = '');
    $('imp-tipo').value = 'consumo-credito';
    $('imp-monto').value = '';
    $('imp-moneda').value = 'PEN';
    $('imp-fecha').value = new Date().toISOString().slice(0,10);
    $('imp-categoria').value = 'Otros';
    $('imp-quien').value = miembroActual().legacyTipo;
  }

  function datosEditor() {
    const tarjeta = $('imp-tarjeta');
    const selected = tarjeta?.selectedOptions?.[0];
    return {
      banco: $('imp-banco').value.trim(),
      tipo: $('imp-tipo').value,
      monto: Number($('imp-monto').value || 0),
      moneda: $('imp-moneda').value,
      fechaOperacion: $('imp-fecha').value,
      ultimosDigitos: $('imp-digitos').value.replace(/\D/g,'').slice(-4),
      comercio: $('imp-comercio').value.trim(),
      descripcion: $('imp-descripcion').value.trim(),
      categoriaSugerida: $('imp-categoria').value,
      quien: $('imp-quien').value,
      tarjetaId: tarjeta?.value || null,
      tarjetaNombre: tarjeta?.value ? (selected?.dataset?.name || selected?.textContent || '') : null
    };
  }

  async function detectarDuplicado(datos, excluirId='') {
    const huella = await construirHuella(datos);
    const snap = await refImportaciones().where('huella','==',huella).limit(3).get();
    const duplicado = snap.docs.find(d => d.id !== excluirId);
    return { huella, duplicado: duplicado || null };
  }

  window.guardarImportacionPendiente = async function() {
    try {
      const id = $('imp-id').value;
      const datos = datosEditor();
      if (!datos.monto || !datos.fechaOperacion) return showToast('Completa el monto y la fecha');
      const { huella, duplicado } = await detectarDuplicado(datos, id);
      const payload = {
        ...datos,
        huella,
        estado: duplicado ? 'duplicado' : 'pendiente',
        duplicadoDe: duplicado?.id || null,
        origen: id ? undefined : 'registro-manual',
        actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (id) await refImportaciones().doc(id).set(payload, {merge:true});
      else await refImportaciones().add({...payload, creadoEn: firebase.firestore.FieldValue.serverTimestamp()});
      showToast(duplicado ? 'Guardado como posible duplicado' : 'Movimiento guardado como pendiente');
      closeModal('importacionEditorModal');
      abrirBandejaImportaciones();
    } catch (e) {
      console.error(e);
      showToast('No se pudo guardar el movimiento');
    }
  };

  async function registrarMovimiento(x) {
    const descripcion = x.comercio || x.descripcion || `${x.banco || 'Banco'} · movimiento importado`;
    const esIngreso = x.tipo === 'deposito';
    if (esIngreso) {
      const miembro = miembroActual();
      await db.collection('hogares').doc(hogarActual()).collection('ingresosExtra').add({
        desc: descripcion,
        monto: Number(x.monto),
        quien: x.quien || miembro.legacyTipo,
        fecha: x.fechaOperacion,
        mes: x.fechaOperacion.slice(0,7),
        origenImportacionId: x.id,
        creadoEn: new Date().toISOString()
      });
      return { tipoRegistro:'ingreso' };
    }

    const gasto = {
      desc: descripcion,
      monto: Number(x.monto),
      quien: x.quien || miembroActual().legacyTipo,
      cat: x.tipo === 'pago-tarjeta' ? 'Deudas' : (x.categoriaSugerida || 'Otros'),
      icono: x.tipo === 'yape' ? '📲' : x.tipo === 'pago-servicio' ? '🧾' : x.tipo === 'pago-tarjeta' ? '🏦' : '💳',
      fecha: x.fechaOperacion,
      nota: x.descripcion || '',
      origen: 'correo-importado',
      origenImportacionId: x.id,
      bancoOrigen: x.banco || '',
      ultimosDigitos: x.ultimosDigitos || '',
      moneda: x.moneda || 'PEN',
      metodo: x.tipo === 'consumo-credito' ? 'credito' : 'efectivo'
    };
    if (x.tarjetaId) {
      gasto.tarjetaId = x.tarjetaId;
      gasto.tarjetaNombre = x.tarjetaNombre || '';
      gasto.metodo = 'credito';
    }
    if (x.tipo === 'pago-tarjeta') gasto.tipoMovimiento = 'pagoTarjeta';
    const creado = await DB.addGasto(gasto);
    if (!creado) throw new Error('No se pudo crear el gasto.');
    return { tipoRegistro:'gasto', registroId: creado.id };
  }

  window.confirmarImportacion = async function(id) {
    const x = importaciones.find(i => i.id === id);
    if (!x) return;
    if (x.estado === 'duplicado' && !confirm('Este movimiento parece duplicado. ¿Deseas registrarlo de todos modos?')) return;
    try {
      const resultado = await registrarMovimiento(x);
      await refImportaciones().doc(id).set({
        estado:'confirmado',
        confirmadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        confirmadoPor: miembroActual().id,
        ...resultado
      }, {merge:true});
      showToast('Movimiento confirmado y registrado');
      if (typeof renderTodo === 'function') renderTodo();
    } catch (e) {
      console.error(e);
      showToast('No se pudo registrar el movimiento');
    }
  };

  window.confirmarImportacionDesdeEditor = async function() {
    const id = $('imp-id').value;
    if (!id) {
      await guardarImportacionPendiente();
      return showToast('Revisa el movimiento guardado y confírmalo desde la bandeja');
    }
    const datos = datosEditor();
    await refImportaciones().doc(id).set({...datos, actualizadoEn:firebase.firestore.FieldValue.serverTimestamp()}, {merge:true});
    const x = { id, ...(importaciones.find(i=>i.id===id)||{}), ...datos };
    try {
      const resultado = await registrarMovimiento(x);
      await refImportaciones().doc(id).set({
        estado:'confirmado', confirmadoEn:firebase.firestore.FieldValue.serverTimestamp(),
        confirmadoPor:miembroActual().id, ...resultado
      }, {merge:true});
      closeModal('importacionEditorModal');
      showToast('Movimiento confirmado y registrado');
      if (typeof renderTodo === 'function') renderTodo();
    } catch(e) {
      console.error(e); showToast('No se pudo confirmar');
    }
  };

  window.descartarImportacion = async function(id) {
    if (!confirm('¿Descartar este movimiento detectado?')) return;
    await refImportaciones().doc(id).set({
      estado:'descartado',
      descartadoEn:firebase.firestore.FieldValue.serverTimestamp(),
      descartadoPor:miembroActual().id
    }, {merge:true});
    showToast('Movimiento descartado');
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      inyectarInterfaz();
      iniciarEscucha();
    }, 1200);
  });
})();

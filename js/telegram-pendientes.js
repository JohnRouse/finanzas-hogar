/* Hogar Finanzas — movimientos pendientes recibidos desde Telegram */
(() => {
  'use strict';
  if (window.HFTelegramPendientes) return;

  const VERSION = '19.0';
  const $ = id => document.getElementById(id);
  const estado = {
    iniciado:false,
    unsubscribe:null,
    hogarId:null,
    pendientes:[],
    tarjetas:[],
    prestamos:[],
    actual:null,
    observer:null,
    timer:null
  };

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const dinero = (valor, moneda = 'PEN') => `${moneda === 'USD' ? 'US$' : 'S/'} ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const escapar = (valor = '') => String(valor).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  function miembroActual() {
    try { return typeof window.obtenerMiembroActual === 'function' ? window.obtenerMiembroActual() : null; }
    catch (_) { return null; }
  }

  function esAdministrador() {
    const miembro = miembroActual();
    if (miembro) return miembro.rol === 'administrador' || miembro.legacyTipo === 'yo';
    return localStorage.getItem('miUsuarioTipo') !== 'pareja';
  }

  function idMiembroActual() {
    return miembroActual()?.id || localStorage.getItem('miembroActualId') || null;
  }

  function fechaLegible(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return 'Fecha por revisar';
    return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-PE', { day:'2-digit', month:'short' });
  }

  function mostrarToast(texto, tipo = 'success') {
    if (typeof window.showToast === 'function') window.showToast(texto, tipo);
    else console.log(texto);
  }

  function inyectarSeccion() {
    const pagina = $('page-gastos');
    if (!pagina) return null;
    let seccion = $('hf-telegram-pending-section');
    if (seccion) return seccion;

    seccion = document.createElement('div');
    seccion.id = 'hf-telegram-pending-section';
    seccion.className = 'section hf-telegram-pending-section';
    seccion.hidden = true;
    seccion.innerHTML = `
      <div class="section-head hf-telegram-pending-head">
        <div><div class="section-title">Por revisar</div><small>Movimientos enviados al bot de Telegram</small></div>
        <span id="hf-telegram-pending-count" class="hf-telegram-pending-count">0</span>
      </div>
      <div id="hf-telegram-pending-list" class="hf-telegram-pending-list"></div>`;
    pagina.insertBefore(seccion, pagina.firstElementChild);
    return seccion;
  }

  function opcionesCategorias() {
    return ['Alimentación','Servicios','Transporte','Salud','Hogar','Educación','Entret.','Otros'];
  }

  function inyectarModal() {
    if ($('hfTelegramReviewModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfTelegramReviewModal" onclick="closeModalOutside(event,'hfTelegramReviewModal')">
        <div class="modal-sheet hf-app-sheet hf-telegram-review-sheet" role="dialog" aria-modal="true" aria-labelledby="hf-telegram-review-title">
          <button class="modal-close hf-sheet-close" type="button" data-tg-close aria-label="Cerrar">✕</button>
          <div class="modal-handle"></div>
          <div class="hf-telegram-review-heading">
            <span>🎙</span>
            <div><div class="modal-title" id="hf-telegram-review-title">Revisar movimiento</div><p>Completa o corrige los datos antes de registrarlo.</p></div>
          </div>
          <div id="hf-telegram-original" class="hf-telegram-original"></div>
          <div class="hf-telegram-form-grid">
            <label class="hf-telegram-field"><span>Tipo</span><select id="hf-tg-type">
              <option value="gasto">Gasto</option>
              <option value="pagoTarjeta">Pago de tarjeta</option>
              <option value="pagoPrestamo">Pago de préstamo</option>
            </select></label>
            <label class="hf-telegram-field"><span>Monto en soles para registrar</span><input id="hf-tg-amount" type="number" min="0" step="0.01" inputmode="decimal"></label>
            <label class="hf-telegram-field hf-telegram-wide"><span>Descripción</span><input id="hf-tg-description" type="text" maxlength="120"></label>
            <label class="hf-telegram-field"><span>Fecha</span><input id="hf-tg-date" type="date"></label>
            <label class="hf-telegram-field"><span>Quién</span><select id="hf-tg-who"><option value="yo">Christian</option><option value="pareja">Sydney</option></select></label>
            <label class="hf-telegram-field" id="hf-tg-category-wrap"><span>Categoría</span><select id="hf-tg-category">${opcionesCategorias().map(c => `<option value="${escapar(c)}">${escapar(c)}</option>`).join('')}</select></label>
            <label class="hf-telegram-field" id="hf-tg-method-wrap"><span>Medio de pago</span><select id="hf-tg-method">
              <option value="">Seleccionar</option><option value="efectivo">Efectivo</option><option value="yape">Yape</option><option value="plin">Plin</option><option value="debito">Débito</option><option value="tarjeta">Tarjeta de crédito</option>
            </select></label>
            <label class="hf-telegram-field hf-telegram-wide" id="hf-tg-obligation-wrap"><span id="hf-tg-obligation-label">Tarjeta</span><select id="hf-tg-obligation"></select></label>
          </div>
          <div id="hf-telegram-review-error" class="hf-telegram-review-error" role="alert"></div>
          <div class="hf-telegram-review-actions">
            <button type="button" class="hf-telegram-discard" id="hf-tg-discard">Descartar</button>
            <button type="button" class="hf-telegram-approve" id="hf-tg-approve">Registrar movimiento</button>
          </div>
        </div>
      </div>`);

    document.querySelector('#hfTelegramReviewModal [data-tg-close]')?.addEventListener('click', cerrarModal);
    $('hf-tg-type')?.addEventListener('change', actualizarCampos);
    $('hf-tg-method')?.addEventListener('change', actualizarCampos);
    $('hf-tg-approve')?.addEventListener('click', aprobarActual);
    $('hf-tg-discard')?.addEventListener('click', descartarActual);
  }

  function cerrarModal() {
    if (typeof window.closeModal === 'function') window.closeModal('hfTelegramReviewModal');
    else $('hfTelegramReviewModal')?.classList.remove('open');
    estado.actual = null;
  }

  function obtenerNombreTarjeta(t = {}) { return t.nombre || t.banco || 'Tarjeta'; }
  function obtenerNombrePrestamo(p = {}) { return p.nombre || p.entidad || p.banco || 'Préstamo'; }

  function llenarObligaciones() {
    const tipo = $('hf-tg-type')?.value || 'gasto';
    const medio = $('hf-tg-method')?.value || '';
    const select = $('hf-tg-obligation');
    const wrap = $('hf-tg-obligation-wrap');
    const etiqueta = $('hf-tg-obligation-label');
    if (!select || !wrap || !etiqueta) return;

    const requiereTarjeta = tipo === 'pagoTarjeta' || (tipo === 'gasto' && medio === 'tarjeta');
    const requierePrestamo = tipo === 'pagoPrestamo';
    wrap.hidden = !(requiereTarjeta || requierePrestamo);
    if (wrap.hidden) {
      select.innerHTML = '';
      return;
    }

    const anterior = select.value || estado.actual?.tarjetaIdDetectada || '';
    const items = requierePrestamo
      ? estado.prestamos.map(p => ({ id:p.id, nombre:obtenerNombrePrestamo(p) }))
      : estado.tarjetas.map(t => ({ id:t.id, nombre:obtenerNombreTarjeta(t) }));
    etiqueta.textContent = requierePrestamo ? 'Préstamo' : 'Tarjeta';
    select.innerHTML = `<option value="">Seleccionar ${requierePrestamo ? 'préstamo' : 'tarjeta'}</option>${items.map(item => `<option value="${escapar(item.id)}">${escapar(item.nombre)}</option>`).join('')}`;
    if (items.some(item => String(item.id) === String(anterior))) select.value = String(anterior);
  }

  function actualizarCampos() {
    const tipo = $('hf-tg-type')?.value || 'gasto';
    const categoryWrap = $('hf-tg-category-wrap');
    const methodWrap = $('hf-tg-method-wrap');
    if (categoryWrap) categoryWrap.hidden = tipo !== 'gasto';
    if (methodWrap) methodWrap.hidden = tipo !== 'gasto';
    llenarObligaciones();
  }

  async function cargarObligaciones() {
    const [tarjetas, prestamos] = await Promise.all([
      window.DB?.getTarjetas?.().catch(() => []) || [],
      window.DB?.getPrestamos?.().catch(() => []) || []
    ]);
    estado.tarjetas = Array.isArray(tarjetas) ? tarjetas : [];
    estado.prestamos = Array.isArray(prestamos) ? prestamos : [];
  }

  async function abrirRevision(id) {
    const pendiente = estado.pendientes.find(item => item.id === id);
    if (!pendiente) return;
    estado.actual = pendiente;
    inyectarModal();
    await cargarObligaciones();

    const montoDetectado = numero(pendiente.montoDetectado);
    $('hf-tg-type').value = pendiente.tipoMovimiento || 'gasto';
    $('hf-tg-amount').value = pendiente.monedaDetectada === 'USD' ? '' : (montoDetectado > 0 ? montoDetectado : '');
    $('hf-tg-description').value = pendiente.descripcionDetectada || pendiente.transcripcion || '';
    $('hf-tg-date').value = pendiente.fechaDetectada || new Date().toLocaleDateString('en-CA', { timeZone:'America/Lima' });
    $('hf-tg-who').value = pendiente.quien === 'pareja' ? 'pareja' : 'yo';
    $('hf-tg-category').value = opcionesCategorias().includes(pendiente.categoriaSugerida) ? pendiente.categoriaSugerida : 'Otros';
    $('hf-tg-method').value = ['efectivo','yape','plin','debito','tarjeta'].includes(pendiente.medioDetectado) ? pendiente.medioDetectado : '';
    $('hf-telegram-review-error').textContent = '';
    $('hf-telegram-original').innerHTML = `
      <div><span>Telegram</span><strong>${escapar(pendiente.transcripcion || 'Sin transcripción')}</strong></div>
      <div class="hf-telegram-detected-row">
        <span>${pendiente.montoDetectado ? escapar(dinero(pendiente.montoDetectado, pendiente.monedaDetectada)) : 'Monto pendiente'}</span>
        <span>${escapar(fechaLegible(pendiente.fechaDetectada))}</span>
        ${pendiente.camposFaltantes?.length ? `<span>Falta: ${escapar(pendiente.camposFaltantes.join(', '))}</span>` : '<span>Datos principales detectados</span>'}
      </div>
      ${pendiente.monedaDetectada === 'USD' ? '<p>El audio indicó dólares. Ingresa arriba el equivalente en soles antes de registrar.</p>' : ''}`;

    actualizarCampos();
    if (typeof window.openModal === 'function') window.openModal('hfTelegramReviewModal');
    else $('hfTelegramReviewModal')?.classList.add('open');
  }

  function datosFormulario() {
    const tipo = $('hf-tg-type')?.value || 'gasto';
    const monto = numero($('hf-tg-amount')?.value);
    const descripcion = String($('hf-tg-description')?.value || '').trim();
    const fecha = String($('hf-tg-date')?.value || '');
    const quien = $('hf-tg-who')?.value === 'pareja' ? 'pareja' : 'yo';
    const categoria = $('hf-tg-category')?.value || 'Otros';
    const medio = $('hf-tg-method')?.value || '';
    const obligacionId = $('hf-tg-obligation')?.value || '';
    return { tipo, monto, descripcion, fecha, quien, categoria, medio, obligacionId };
  }

  function validarFormulario(datos) {
    if (!(datos.monto > 0)) return 'Ingresa el monto en soles que debe usar la aplicación.';
    if (!datos.descripcion) return 'Completa la descripción.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) return 'Selecciona una fecha válida.';
    if (datos.tipo === 'gasto' && !datos.medio) return 'Selecciona el medio de pago.';
    if (datos.tipo === 'gasto' && datos.medio === 'tarjeta' && !datos.obligacionId) return 'Selecciona la tarjeta utilizada.';
    if (datos.tipo === 'pagoTarjeta' && !datos.obligacionId) return 'Selecciona la tarjeta pagada.';
    if (datos.tipo === 'pagoPrestamo' && !datos.obligacionId) return 'Selecciona el préstamo pagado.';
    return null;
  }

  function construirGasto(pendiente, datos) {
    const base = {
      desc:datos.descripcion,
      monto:Math.round(datos.monto * 100) / 100,
      cat:datos.tipo === 'gasto' ? datos.categoria : 'Deudas',
      quien:datos.quien,
      fecha:datos.fecha,
      mes:datos.fecha.slice(0, 7),
      medio:datos.tipo === 'gasto' ? datos.medio : 'transferencia',
      tipoMovimiento:datos.tipo === 'gasto' ? 'gasto' : datos.tipo,
      fuente:'telegram',
      telegramPendienteId:pendiente.id,
      telegramUpdateId:pendiente.updateId || null,
      transcripcionTelegram:pendiente.transcripcion || '',
      montoOriginal:numero(pendiente.montoDetectado) || null,
      monedaOriginal:pendiente.monedaDetectada || 'PEN',
      creadoEn:firebase.firestore.FieldValue.serverTimestamp()
    };

    if (datos.tipo === 'gasto' && datos.medio === 'tarjeta') {
      const tarjeta = estado.tarjetas.find(t => String(t.id) === String(datos.obligacionId));
      base.tarjetaId = datos.obligacionId;
      base.tarjetaNombre = tarjeta ? obtenerNombreTarjeta(tarjeta) : null;
    }
    if (datos.tipo === 'pagoTarjeta') {
      const tarjeta = estado.tarjetas.find(t => String(t.id) === String(datos.obligacionId));
      const nombre = tarjeta ? obtenerNombreTarjeta(tarjeta) : 'Tarjeta';
      base.tarjetaId = datos.obligacionId;
      base.tarjetaNombre = nombre;
      base.desc = `Pago Tarjeta: ${nombre}`;
    }
    if (datos.tipo === 'pagoPrestamo') {
      const prestamo = estado.prestamos.find(p => String(p.id) === String(datos.obligacionId));
      const nombre = prestamo ? obtenerNombrePrestamo(prestamo) : 'Préstamo';
      base.prestamoId = datos.obligacionId;
      base.prestamoNombre = nombre;
      base.desc = `Pago Préstamo: ${nombre}`;
    }
    return Object.fromEntries(Object.entries(base).filter(([, valor]) => valor !== undefined));
  }

  async function aprobarActual() {
    const pendiente = estado.actual;
    if (!pendiente || !window.db || !window.DB?.hogarId) return;
    const datos = datosFormulario();
    const error = validarFormulario(datos);
    const errorEl = $('hf-telegram-review-error');
    if (error) {
      if (errorEl) errorEl.textContent = error;
      return;
    }

    const boton = $('hf-tg-approve');
    if (boton) { boton.disabled = true; boton.textContent = 'Registrando…'; }
    if (errorEl) errorEl.textContent = '';

    try {
      const hogarRef = db.collection('hogares').doc(DB.hogarId);
      const pendienteRef = hogarRef.collection('movimientos_pendientes').doc(pendiente.id);
      const gastoRef = hogarRef.collection('gastos').doc(pendiente.id);
      const gasto = construirGasto(pendiente, datos);

      await db.runTransaction(async transaction => {
        const [pendienteSnap, gastoSnap] = await Promise.all([
          transaction.get(pendienteRef),
          transaction.get(gastoRef)
        ]);
        if (!pendienteSnap.exists) throw new Error('El movimiento pendiente ya no existe.');
        if (pendienteSnap.data().estado !== 'pendiente') throw new Error('Este movimiento ya fue revisado.');
        if (!gastoSnap.exists) transaction.set(gastoRef, gasto);
        transaction.update(pendienteRef, {
          estado:'aprobado',
          gastoId:gastoRef.id,
          aprobadoPor:idMiembroActual(),
          aprobadoEn:firebase.firestore.FieldValue.serverTimestamp(),
          datosFinales:{
            monto:gasto.monto,
            fecha:gasto.fecha,
            cat:gasto.cat,
            medio:gasto.medio,
            quien:gasto.quien,
            tipoMovimiento:gasto.tipoMovimiento
          }
        });
      });

      cerrarModal();
      mostrarToast('Movimiento de Telegram registrado.');
      window.dispatchEvent(new CustomEvent('hf:gastos-actualizados', { detail:{ fuente:'telegram', id:pendiente.id } }));
      if (typeof window.renderTodo === 'function') await window.renderTodo();
    } catch (e) {
      console.error('No se pudo aprobar el movimiento de Telegram:', e);
      if (errorEl) errorEl.textContent = e.message || 'No se pudo registrar el movimiento.';
    } finally {
      if (boton) { boton.disabled = false; boton.textContent = 'Registrar movimiento'; }
    }
  }

  async function descartarActual() {
    const pendiente = estado.actual;
    if (!pendiente || !window.db || !window.DB?.hogarId) return;
    const aceptar = await window.HFConfirmacionesApp?.confirmar?.({
      icono:'🗑',
      titulo:'¿Descartar movimiento de Telegram?',
      mensaje:'El audio o mensaje dejará de aparecer en la lista de pendientes.',
      detalle:'No se creará ningún gasto y la transcripción quedará marcada como descartada.',
      aceptar:'Descartar',
      danger:true
    });
    if (!aceptar) return;

    try {
      await db.collection('hogares').doc(DB.hogarId)
        .collection('movimientos_pendientes').doc(pendiente.id)
        .update({
          estado:'descartado',
          descartadoPor:idMiembroActual(),
          descartadoEn:firebase.firestore.FieldValue.serverTimestamp()
        });
      cerrarModal();
      mostrarToast('Movimiento descartado.');
    } catch (e) {
      console.error(e);
      $('hf-telegram-review-error').textContent = e.message || 'No se pudo descartar el movimiento.';
    }
  }

  function tarjetaPendienteHTML(p) {
    const monto = p.montoDetectado ? dinero(p.montoDetectado, p.monedaDetectada) : 'Monto pendiente';
    const faltan = Array.isArray(p.camposFaltantes) ? p.camposFaltantes : [];
    return `<article class="hf-telegram-pending-card" data-tg-pending-id="${escapar(p.id)}">
      <div class="hf-telegram-pending-icon">🎙</div>
      <div class="hf-telegram-pending-body">
        <div><strong>${escapar(p.descripcionDetectada || 'Movimiento por completar')}</strong><b>${escapar(monto)}</b></div>
        <p>${escapar(p.transcripcion || '')}</p>
        <small>${escapar(p.nombreMiembro || (p.quien === 'pareja' ? 'Sydney' : 'Christian'))} · ${escapar(fechaLegible(p.fechaDetectada))}${faltan.length ? ` · Falta ${escapar(faltan.join(', '))}` : ''}</small>
      </div>
      <button type="button">Revisar</button>
    </article>`;
  }

  function renderizar() {
    const seccion = inyectarSeccion();
    if (!seccion) return;
    if (!esAdministrador()) {
      seccion.hidden = true;
      return;
    }
    const pendientes = estado.pendientes;
    seccion.hidden = pendientes.length === 0;
    $('hf-telegram-pending-count').textContent = String(pendientes.length);
    const lista = $('hf-telegram-pending-list');
    if (!lista) return;
    lista.innerHTML = pendientes.map(tarjetaPendienteHTML).join('');
    lista.querySelectorAll('[data-tg-pending-id]').forEach(tarjeta => {
      tarjeta.querySelector('button')?.addEventListener('click', () => abrirRevision(tarjeta.dataset.tgPendingId));
    });
  }

  function timestampValor(p = {}) {
    const fecha = p.listoParaRevisarEn || p.recibidoEn;
    if (fecha?.toMillis) return fecha.toMillis();
    if (fecha?.seconds) return fecha.seconds * 1000;
    return 0;
  }

  function desconectar() {
    estado.unsubscribe?.();
    estado.unsubscribe = null;
    estado.hogarId = null;
    estado.pendientes = [];
    renderizar();
  }

  function conectar() {
    const hogarId = window.DB?.hogarId;
    if (!esAdministrador() || !window.db || !hogarId) {
      desconectar();
      return false;
    }
    if (estado.unsubscribe && estado.hogarId === hogarId) {
      renderizar();
      return true;
    }

    desconectar();
    estado.hogarId = hogarId;
    estado.unsubscribe = db.collection('hogares').doc(hogarId)
      .collection('movimientos_pendientes')
      .where('estado', '==', 'pendiente')
      .onSnapshot(snapshot => {
        estado.pendientes = snapshot.docs
          .map(doc => ({ id:doc.id, ...doc.data() }))
          .sort((a,b) => timestampValor(b) - timestampValor(a));
        renderizar();
      }, error => {
        console.warn('No se pudieron cargar los pendientes de Telegram:', error);
        estado.pendientes = [];
        renderizar();
      });
    return true;
  }

  function programarConexion() {
    clearTimeout(estado.timer);
    estado.timer = setTimeout(conectar, 180);
  }

  function iniciar() {
    if (estado.iniciado) {
      programarConexion();
      return true;
    }
    estado.iniciado = true;
    inyectarSeccion();
    inyectarModal();
    programarConexion();

    ['hf:bootstrap-avanzado-completado','hf:gastos-actualizados','hf:perfil-actualizado','hf:miembro-cambiado']
      .forEach(nombre => window.addEventListener(nombre, programarConexion));
    window.addEventListener('storage', event => {
      if (['hogarId','miembroActualId','miUsuarioTipo'].includes(event.key)) programarConexion();
    });

    const pagina = $('page-gastos');
    if (pagina && !estado.observer) {
      estado.observer = new MutationObserver(() => {
        if (pagina.classList.contains('active')) programarConexion();
      });
      estado.observer.observe(pagina, { attributes:true, attributeFilter:['class'] });
    }
    return true;
  }

  function obtenerEstado() {
    return {
      version:VERSION,
      iniciado:estado.iniciado,
      administrador:esAdministrador(),
      conectado:Boolean(estado.unsubscribe),
      hogarId:estado.hogarId,
      pendientes:estado.pendientes.length,
      seccionDisponible:Boolean($('hf-telegram-pending-section')),
      modalDisponible:Boolean($('hfTelegramReviewModal'))
    };
  }

  window.HFTelegramPendientes = Object.freeze({
    iniciar,
    conectar,
    renderizar,
    abrirRevision,
    obtenerEstado
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 420), { once:true });
  else setTimeout(iniciar, 220);
})();
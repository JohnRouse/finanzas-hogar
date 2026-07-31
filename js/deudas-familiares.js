/* Hogar Finanzas — Vista familiar de deudas y centro de administración */
(() => {
  'use strict';
  if (window.HFDeudasFamiliares) return;

  const VERSION = '18.1';
  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const escapar = (valor = '') => String(valor).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const fechaValida = valor => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) ? String(valor) : '';
  const estado = { iniciado:false, renderizando:false, timer:null, observer:null, tarjetas:[], prestamos:[], admin:false };

  function nombreTarjeta(t = {}) { return t.nombre || t.banco || 'Tarjeta'; }
  function nombrePrestamo(p = {}) { return p.nombre || p.entidad || p.banco || 'Préstamo'; }
  function saldoPrestamo(p = {}) {
    const valores = [p.saldoPendiente, p.saldo, p.deuda, p.capitalPendiente, p.montoPendiente, p.monto, p.total];
    return Math.max(0, numero(valores.find(v => v !== undefined && v !== null && v !== '')));
  }
  function cuotaPrestamo(p = {}) {
    const valores = [p.cuotaMensual, p.cuota, p.pagoMensual, p.minimo];
    return Math.max(0, numero(valores.find(v => v !== undefined && v !== null && v !== '')));
  }
  function vencimientoPrestamo(p = {}) { return fechaValida(p.proximoVencimiento || p.fechaVencimiento || p.vencimiento); }

  function miembroActual() {
    try { return typeof window.obtenerMiembroActual === 'function' ? window.obtenerMiembroActual() : null; }
    catch (_) { return null; }
  }

  function esAdministrador() {
    const miembro = miembroActual();
    if (miembro) return miembro.rol === 'administrador' || miembro.legacyTipo === 'yo';
    return localStorage.getItem('miUsuarioTipo') !== 'pareja';
  }

  function diasHasta(fecha) {
    if (!fechaValida(fecha)) return null;
    const hoy = new Date();
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12);
    const destino = new Date(`${fecha}T12:00:00`);
    return Math.ceil((destino - base) / 86400000);
  }

  function fechaCorta(fecha) {
    if (!fechaValida(fecha)) return 'No informada';
    return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-PE', { day:'2-digit', month:'short' });
  }

  function resumenTarjeta(tarjeta = {}) {
    const vivo = window.HFDeudasActuales?.obtenerTarjeta?.(tarjeta.id);
    const deuda = Math.max(0, numero(vivo?.deudaEstimada ?? tarjeta.deuda ?? tarjeta.saldo));
    const linea = Math.max(0, numero(vivo?.lineaTotal ?? tarjeta.limite ?? tarjeta.lineaTotal));
    const disponible = linea > 0 ? linea - deuda : 0;
    const minimo = Math.max(0, numero(vivo?.pagoMinimo ?? tarjeta.estadoCuenta?.pagoMinimo ?? tarjeta.pagoMinimo));
    const vencimiento = fechaValida(vivo?.fechaVencimiento ?? tarjeta.estadoCuenta?.fechaVencimiento ?? tarjeta.fechaVencimiento);
    const uso = linea > 0 ? deuda / linea * 100 : 0;
    const dias = diasHasta(vencimiento);

    let nivel = 'good';
    let etiqueta = 'Bien';
    let consejo = 'Tiene saldo disponible y no está cerca del límite.';
    if (linea > 0 && disponible < 0) {
      nivel = 'danger'; etiqueta = 'Excedida'; consejo = `Supera la línea por ${moneda(Math.abs(disponible))}. Conviene no usarla hasta reducir la deuda.`;
    } else if (dias !== null && dias < 0) {
      nivel = 'danger'; etiqueta = 'Vencida'; consejo = `El vencimiento fue hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}. Revisa si el pago ya fue realizado.`;
    } else if ((dias !== null && dias <= 3) || uso >= 85) {
      nivel = 'danger'; etiqueta = dias !== null && dias <= 3 ? 'Vence pronto' : 'Casi al límite';
      consejo = dias !== null && dias <= 3 ? `Vence ${dias === 0 ? 'hoy' : `en ${dias} día${dias === 1 ? '' : 's'}`}.` : 'Queda muy poco crédito disponible; evita nuevas compras.';
    } else if ((dias !== null && dias <= 7) || uso >= 65) {
      nivel = 'watch'; etiqueta = 'Atención';
      consejo = dias !== null && dias <= 7 ? `El pago vence en ${dias} días.` : 'La tarjeta ya usa una parte importante de su línea.';
    }

    return { tarjeta, deuda, linea, disponible, minimo, vencimiento, uso, dias, nivel, etiqueta, consejo };
  }

  function resumenPrestamo(prestamo = {}) {
    const saldo = saldoPrestamo(prestamo);
    const cuota = cuotaPrestamo(prestamo);
    const vencimiento = vencimientoPrestamo(prestamo);
    const dias = diasHasta(vencimiento);
    let nivel = 'good';
    let etiqueta = 'Al día';
    let consejo = cuota > 0 ? `La próxima cuota es ${moneda(cuota)}.` : 'Registra la cuota para mostrar cuánto toca pagar.';
    if (dias !== null && dias < 0) {
      nivel = 'danger'; etiqueta = 'Vencido'; consejo = `La cuota venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}.`;
    } else if (dias !== null && dias <= 3) {
      nivel = 'danger'; etiqueta = 'Vence pronto'; consejo = dias === 0 ? 'La cuota vence hoy.' : `La cuota vence en ${dias} días.`;
    } else if (dias !== null && dias <= 7) {
      nivel = 'watch'; etiqueta = 'Próximo'; consejo = `La cuota vence en ${dias} días.`;
    }
    return { prestamo, saldo, cuota, vencimiento, dias, nivel, etiqueta, consejo };
  }

  function claseEstado(nivel) { return nivel === 'danger' ? 'status-danger' : nivel === 'watch' ? 'status-watch' : ''; }

  function tarjetaHTML(r) {
    const porcentaje = Math.max(0, Math.min(100, r.uso));
    const disponibleTexto = r.linea > 0 ? (r.disponible < 0 ? `− ${moneda(Math.abs(r.disponible))}` : moneda(r.disponible)) : 'No informada';
    return `
      <article class="hf-family-card ${claseEstado(r.nivel)}">
        <div class="hf-family-card-head">
          <span><strong>${escapar(nombreTarjeta(r.tarjeta))}</strong><small>${r.tarjeta.ultimosDigitos ? `Termina en ${escapar(r.tarjeta.ultimosDigitos)}` : 'Tarjeta de crédito'}</small></span>
          <span class="hf-family-status">${escapar(r.etiqueta)}</span>
        </div>
        <div class="hf-family-card-main">
          <div class="debt"><span>Deuda total</span><strong>${moneda(r.deuda)}</strong></div>
          <div><span>Disponible</span><strong>${disponibleTexto}</strong></div>
        </div>
        ${r.linea > 0 ? `<div class="hf-family-credit-bar"><i style="width:${porcentaje.toFixed(1)}%"></i></div><div class="hf-family-credit-labels"><span>${Math.round(r.uso)}% utilizado</span><span>Línea ${moneda(r.linea)}</span></div>` : ''}
        <div class="hf-family-card-foot">
          <div><span>Vencimiento</span><strong>${fechaCorta(r.vencimiento)}</strong></div>
          <div><span>Pago mínimo</span><strong>${r.minimo > 0 ? moneda(r.minimo) : 'No informado'}</strong></div>
        </div>
        <div class="hf-family-advice"><b>●</b><span>${escapar(r.consejo)}</span></div>
      </article>`;
  }

  function prestamoHTML(r) {
    const total = numero(r.prestamo.montoOriginal || r.prestamo.montoInicial || r.prestamo.total);
    const pagado = total > 0 ? Math.max(0, total - r.saldo) : 0;
    const progreso = total > 0 ? Math.max(0, Math.min(100, pagado / total * 100)) : 0;
    return `
      <article class="hf-family-card hf-family-loan-card ${claseEstado(r.nivel)}">
        <div class="hf-family-card-head">
          <span><strong>${escapar(nombrePrestamo(r.prestamo))}</strong><small>Préstamo</small></span>
          <span class="hf-family-status">${escapar(r.etiqueta)}</span>
        </div>
        <div class="hf-family-card-main">
          <div class="debt"><span>Falta pagar</span><strong>${moneda(r.saldo)}</strong></div>
          <div><span>Próxima cuota</span><strong>${r.cuota > 0 ? moneda(r.cuota) : 'No informada'}</strong></div>
        </div>
        ${total > 0 ? `<div class="hf-family-credit-bar"><i style="width:${progreso.toFixed(1)}%"></i></div><div class="hf-family-credit-labels"><span>${Math.round(progreso)}% pagado</span><span>Original ${moneda(total)}</span></div>` : ''}
        <div class="hf-family-card-foot">
          <div><span>Vencimiento</span><strong>${fechaCorta(r.vencimiento)}</strong></div>
          <div><span>Cuotas restantes</span><strong>${r.prestamo.cuotasRestantes ?? r.prestamo.cuotasPendientes ?? 'No informadas'}</strong></div>
        </div>
        <div class="hf-family-advice"><b>●</b><span>${escapar(r.consejo)}</span></div>
      </article>`;
  }

  function prioridadesHTML(tarjetas, prestamos) {
    const items = [];
    tarjetas.forEach(r => {
      if (r.nivel === 'danger') items.push({ prioridad:0, fecha:r.vencimiento, icono:'💳', nombre:nombreTarjeta(r.tarjeta), detalle:r.consejo, monto:r.minimo || r.deuda });
      else if (r.dias !== null && r.dias <= 15) items.push({ prioridad:1, fecha:r.vencimiento, icono:'💳', nombre:nombreTarjeta(r.tarjeta), detalle:`Vence ${fechaCorta(r.vencimiento)}`, monto:r.minimo });
    });
    prestamos.forEach(r => {
      if (r.nivel === 'danger' || (r.dias !== null && r.dias <= 15)) items.push({ prioridad:r.nivel === 'danger' ? 0 : 1, fecha:r.vencimiento, icono:'🏦', nombre:nombrePrestamo(r.prestamo), detalle:r.consejo, monto:r.cuota });
    });
    items.sort((a,b) => a.prioridad - b.prioridad || String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')));
    if (!items.length) return '<div class="hf-family-priority-empty">No hay vencimientos cercanos ni tarjetas excedidas con la información registrada.</div>';
    return `<div class="hf-family-priority-list">${items.slice(0,4).map(item => `<div class="hf-family-priority-item"><i>${item.icono}</i><div><strong>${escapar(item.nombre)}</strong><small>${escapar(item.detalle)}</small></div><b>${item.monto > 0 ? moneda(item.monto) : ''}</b></div>`).join('')}</div>`;
  }

  function rutaHTML(deudaTotal, pagoMensual) {
    if (deudaTotal <= 0) return '<section class="hf-family-route"><span>Ruta de deuda</span><strong>No hay deuda pendiente registrada.</strong><p>Las tarjetas y préstamos aparecerán aquí cuando tengan saldo.</p></section>';
    if (pagoMensual <= 0) return `<section class="hf-family-route"><span>Ruta de deuda</span><strong>Deben ${moneda(deudaTotal)} en total.</strong><p>Falta registrar pagos mínimos o cuotas para estimar un tiempo de pago comprensible.</p></section>`;
    const meses = Math.ceil(deudaTotal / pagoMensual);
    const avance = Math.min(100, pagoMensual / deudaTotal * 100);
    return `<section class="hf-family-route"><span>Una referencia sencilla</span><strong>Pagando ${moneda(pagoMensual)} al mes, tomaría cerca de ${meses} mes${meses === 1 ? '' : 'es'}.</strong><p>La estimación supone que no aumenta la deuda y no incluye intereses futuros. Sirve para entender el orden de magnitud, no como fecha exacta.</p><div class="hf-family-route-bar"><i style="width:${avance.toFixed(1)}%"></i></div><small>Un pago mensual equivale aproximadamente al ${avance.toFixed(1)}% de la deuda actual.</small></section>`;
  }

  function marcarInterfazOriginal() {
    const pagina = $('page-deudas');
    if (!pagina) return;
    pagina.classList.add('hf-family-debt-page');
    ['tarjetas-grid','prestamos-grid','debtChart'].forEach(id => $(id)?.closest('.section')?.setAttribute('data-hf-family-hidden','true'));
    $('hf-resumen-deuda-actual')?.setAttribute('data-hf-family-hidden','true');
    $('hf-month-close-launcher')?.setAttribute('data-hf-family-hidden','true');
    document.querySelector('[data-hf-finance-launcher]')?.setAttribute('data-hf-family-hidden','true');

    const kpis = pagina.querySelector('.kpi-grid');
    const etiquetas = kpis?.querySelectorAll('.kpi-label');
    const subs = kpis?.querySelectorAll('.kpi-sub');
    if (etiquetas?.[0]) etiquetas[0].textContent = 'Debemos en total';
    if (etiquetas?.[1]) etiquetas[1].textContent = 'Pagos próximos';
    if (subs?.[0]) subs[0].textContent = 'Tarjetas + préstamos';
  }

  function inyectarVista() {
    const pagina = $('page-deudas');
    const kpis = pagina?.querySelector('.kpi-grid');
    if (!pagina || !kpis) return null;
    let vista = $('hf-family-debt-view');
    if (!vista) {
      vista = document.createElement('div');
      vista.id = 'hf-family-debt-view';
      vista.className = 'hf-family-debt-view';
      kpis.insertAdjacentElement('afterend', vista);
    }
    return vista;
  }

  function inyectarAdminModal() {
    if ($('hfDebtAdminModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfDebtAdminModal" onclick="closeModalOutside(event,'hfDebtAdminModal')">
        <div class="modal-sheet hf-app-sheet hf-debt-admin-sheet" style="position:relative">
          <button class="modal-close hf-sheet-close" type="button" onclick="closeModal('hfDebtAdminModal')" aria-label="Cerrar">✕</button>
          <div class="modal-handle"></div>
          <div class="hf-debt-admin-heading"><span class="hf-debt-admin-icon">⚙</span><div><div class="modal-title">Administrar deudas</div><p>Actualiza información bancaria, registra pagos y usa las herramientas de decisión.</p></div></div>
          <div class="hf-debt-admin-note">Esta zona es para quien administra las tarjetas. La pantalla principal se mantiene simple para que cualquier integrante entienda cuánto se debe, cuánto queda disponible y qué vence pronto.</div>
          <div class="hf-debt-admin-actions">
            <button class="hf-debt-admin-action" type="button" data-admin-action="actualizar"><span>↻</span><div><strong>Actualizar información bancaria</strong><small>Saldos, pago mínimo y vencimiento de las tarjetas.</small></div><em>›</em></button>
            <button class="hf-debt-admin-action" type="button" data-admin-action="cierre"><span>▣</span><div><strong>Guardar historial del mes</strong><small>Conserva una fotografía para comparar cómo cambia la deuda.</small></div><em>›</em></button>
            <button class="hf-debt-admin-action" type="button" data-admin-action="plan"><span>📉</span><div><strong>Calcular cómo pagar</strong><small>Simula cuotas, tiempo e intereses por tarjeta.</small></div><em>›</em></button>
            <button class="hf-debt-admin-action" type="button" data-admin-action="tarjeta"><span>💳</span><div><strong>Agregar tarjeta</strong><small>Registra una nueva línea de crédito.</small></div><em>›</em></button>
            <button class="hf-debt-admin-action" type="button" data-admin-action="prestamo"><span>🏦</span><div><strong>Agregar préstamo</strong><small>Registra saldo, cuota y vencimiento.</small></div><em>›</em></button>
          </div>
          <div class="hf-debt-admin-separator">Registrar pagos</div>
          <div id="hf-admin-card-actions" class="hf-admin-card-actions"></div>
        </div>
      </div>`);

    document.querySelectorAll('#hfDebtAdminModal [data-admin-action]').forEach(boton => boton.addEventListener('click', () => ejecutarAccionAdmin(boton.dataset.adminAction)));
  }

  function ejecutarDespuesDeCerrar(funcion) {
    if (typeof window.closeModal === 'function') closeModal('hfDebtAdminModal');
    else $('hfDebtAdminModal')?.classList.remove('open');
    setTimeout(() => { try { funcion?.(); } catch (error) { console.error(error); } }, 90);
  }

  function ejecutarAccionAdmin(accion) {
    const acciones = {
      actualizar:() => window.abrirActualizacionTarjetas?.(),
      cierre:() => window.HFCierreFinancieroMensual?.abrir?.(),
      plan:() => (window.abrirCentroFinanciero || window.abrirPlanificadorDeudas)?.(),
      tarjeta:() => window.abrirNuevaTarjeta?.(),
      prestamo:() => window.abrirNuevoPrestamo?.()
    };
    ejecutarDespuesDeCerrar(acciones[accion]);
  }

  function renderAdminPagos(tarjetas) {
    const contenedor = $('hf-admin-card-actions');
    if (!contenedor) return;
    if (!tarjetas.length) {
      contenedor.innerHTML = '<div class="hf-family-priority-empty">No hay tarjetas registradas.</div>';
      return;
    }
    contenedor.innerHTML = tarjetas.map(r => `<div class="hf-admin-card-row" data-admin-card-id="${escapar(r.tarjeta.id)}"><div><strong>${escapar(nombreTarjeta(r.tarjeta))}</strong><small>Deuda ${moneda(r.deuda)}</small></div><button type="button">Registrar pago</button></div>`).join('');
    contenedor.querySelectorAll('[data-admin-card-id]').forEach(fila => fila.querySelector('button')?.addEventListener('click', () => {
      const r = tarjetas.find(item => String(item.tarjeta.id) === String(fila.dataset.adminCardId));
      if (!r) return;
      ejecutarDespuesDeCerrar(() => window.abrirPagoTarjeta?.(r.tarjeta.id, nombreTarjeta(r.tarjeta), r.deuda));
    }));
  }

  async function abrirAdministracion() {
    if (!esAdministrador()) return;
    inyectarAdminModal();
    renderAdminPagos(estado.tarjetas.map(resumenTarjeta));
    if (typeof window.openModal === 'function') openModal('hfDebtAdminModal');
    else $('hfDebtAdminModal')?.classList.add('open');
  }

  async function renderizar() {
    if (estado.renderizando) return;
    const vista = inyectarVista();
    if (!vista || !window.DB) return;
    estado.renderizando = true;
    marcarInterfazOriginal();
    try {
      const [tarjetas, prestamos] = await Promise.all([
        window.DB.getTarjetas?.().catch(() => []) || [],
        window.DB.getPrestamos?.().catch(() => []) || []
      ]);
      estado.tarjetas = Array.isArray(tarjetas) ? tarjetas : [];
      estado.prestamos = Array.isArray(prestamos) ? prestamos : [];
      estado.admin = esAdministrador();

      const rt = estado.tarjetas.map(resumenTarjeta);
      const rp = estado.prestamos.map(resumenPrestamo);
      const deudaTotal = rt.reduce((s,r) => s + r.deuda, 0) + rp.reduce((s,r) => s + r.saldo, 0);
      const pagoMensual = rt.reduce((s,r) => s + r.minimo, 0) + rp.reduce((s,r) => s + r.cuota, 0);

      vista.innerHTML = `
        <div class="hf-family-debt-head"><div><h2>Así están nuestras deudas</h2><p>Una vista sencilla para saber cuánto debemos, cuánto crédito queda y qué pagos se acercan.</p></div>${estado.admin ? '<button type="button" class="hf-family-admin-button" id="hf-open-debt-admin">Administrar</button>' : ''}</div>
        <section class="hf-family-priority"><strong>Lo que necesita atención</strong>${prioridadesHTML(rt,rp)}</section>
        <div class="hf-family-section-title"><strong>Tarjetas de crédito</strong><small>${rt.length} registrada${rt.length === 1 ? '' : 's'}</small></div>
        <div class="hf-family-card-list">${rt.length ? rt.map(tarjetaHTML).join('') : '<div class="hf-family-priority-empty">No hay tarjetas registradas.</div>'}</div>
        <div class="hf-family-section-title"><strong>Préstamos</strong><small>${rp.length} registrado${rp.length === 1 ? '' : 's'}</small></div>
        <div class="hf-family-card-list">${rp.length ? rp.map(prestamoHTML).join('') : '<div class="hf-family-priority-empty">No hay préstamos registrados.</div>'}</div>
        ${rutaHTML(deudaTotal,pagoMensual)}`;
      $('hf-open-debt-admin')?.addEventListener('click', abrirAdministracion);
      renderAdminPagos(rt);
    } catch (error) {
      console.error('No se pudo preparar la vista familiar de deudas:', error);
      vista.innerHTML = '<div class="hf-family-priority"><strong>No se pudo cargar la información</strong><div class="hf-family-priority-empty">Revisa la conexión e inténtalo nuevamente.</div></div>';
    } finally {
      estado.renderizando = false;
    }
  }

  function programar() {
    clearTimeout(estado.timer);
    estado.timer = setTimeout(renderizar, 140);
  }

  function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado = true;
    inyectarAdminModal();
    programar();
    ['hf:deudas-core-actualizadas','hf:deuda-actualizada','hf:estado-cuenta-confirmado','hf:cierre-mensual-guardado','hf:gastos-actualizados'].forEach(nombre => window.addEventListener(nombre, programar));
    const pagina = $('page-deudas');
    if (pagina && !estado.observer) {
      estado.observer = new MutationObserver(programar);
      ['tarjetas-grid','prestamos-grid'].forEach(id => { const nodo = $(id); if (nodo) estado.observer.observe(nodo,{childList:true}); });
    }
  }

  function obtenerEstado() {
    return { version:VERSION, iniciado:estado.iniciado, vistaDisponible:Boolean($('hf-family-debt-view')), admin:estado.admin, modalAdminDisponible:Boolean($('hfDebtAdminModal')), tarjetas:estado.tarjetas.length, prestamos:estado.prestamos.length };
  }

  window.HFDeudasFamiliares = Object.freeze({ iniciar, renderizar, abrirAdministracion, obtenerEstado, resumenTarjeta, resumenPrestamo });
  window.abrirAdministracionDeudas = abrirAdministracion;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 300), { once:true });
  else setTimeout(iniciar, 160);
})();

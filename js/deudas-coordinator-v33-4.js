/* Hogar Finanzas — Coordinador único de la pantalla Deudas V33.4 */
(() => {
  'use strict';

  const VERSION = '33.4';
  if (window.HFDeudasFamiliares?.version === VERSION) return;

  const state = {
    iniciado: false,
    renderizando: false,
    pendiente: false,
    timer: null,
    retryTimer: null,
    pageObserver: null,
    fabListener: false,
    tarjetas: [],
    prestamos: []
  };

  const $ = id => document.getElementById(id);

  function esAdministrador() {
    try {
      const miembro = window.obtenerMiembroActual?.();
      if (miembro) return miembro.rol === 'administrador' || miembro.legacyTipo === 'yo';
    } catch (_) {}
    return localStorage.getItem('miUsuarioTipo') !== 'pareja';
  }

  function paginaDeudasActiva() {
    return Boolean($('page-deudas')?.classList.contains('active'));
  }

  function marcarInterfazOriginal() {
    const pagina = $('page-deudas');
    if (!pagina) return;
    pagina.classList.add('hf-family-debt-page');

    ['tarjetas-grid', 'prestamos-grid', 'debtChart'].forEach(id => {
      $(id)?.closest('.section')?.setAttribute('data-hf-family-hidden', 'true');
    });

    const kpis = pagina.querySelector('.kpi-grid');
    const etiquetas = kpis?.querySelectorAll('.kpi-label');
    const subs = kpis?.querySelectorAll('.kpi-sub');
    if (etiquetas?.[0]) etiquetas[0].textContent = 'Debemos en total';
    if (etiquetas?.[1]) etiquetas[1].textContent = 'Pagos próximos';
    if (subs?.[0]) subs[0].textContent = 'Tarjetas + préstamos';
  }

  function asegurarVista() {
    const pagina = $('page-deudas');
    const kpis = pagina?.querySelector('.kpi-grid');
    if (!pagina || !kpis) return null;

    marcarInterfazOriginal();

    let vista = $('hf-family-debt-view');
    if (!vista) {
      vista = document.createElement('div');
      vista.id = 'hf-family-debt-view';
      vista.className = 'hf-family-debt-view';
      vista.innerHTML = `
        <div class="hf-family-section-title"><strong>Tarjetas de crédito</strong><small data-hf-card-count>0 registradas</small></div>
        <div class="hf-family-card-list"><div class="hf-family-priority-empty">Cargando tarjetas…</div></div>
        <div class="hf-family-section-title"><strong>Préstamos</strong><small data-hf-loan-count>0 registrados</small></div>
        <div class="hf-family-card-list"><div class="hf-family-priority-empty">Cargando préstamos…</div></div>`;
      kpis.insertAdjacentElement('afterend', vista);
    }
    return vista;
  }

  function actualizarContadores() {
    const vista = $('hf-family-debt-view');
    const tarjetas = state.tarjetas.length;
    const prestamos = state.prestamos.length;
    const cardCount = vista?.querySelector('[data-hf-card-count]');
    const loanCount = vista?.querySelector('[data-hf-loan-count]');
    if (cardCount) cardCount.textContent = `${tarjetas} registrada${tarjetas === 1 ? '' : 's'}`;
    if (loanCount) loanCount.textContent = `${prestamos} registrado${prestamos === 1 ? '' : 's'}`;
  }

  function cerrarAdmin() {
    if (typeof window.closeModal === 'function') window.closeModal('hfDebtAdminModal');
    else $('hfDebtAdminModal')?.classList.remove('open');
  }

  function ejecutarAdmin(accion) {
    cerrarAdmin();
    setTimeout(() => {
      if (accion === 'states') window.HFExperienciaFinanciera14?.abrirCentroEstados?.();
      else if (accion === 'plan') (window.abrirCentroFinanciero || window.abrirPlanificadorDeudas)?.();
      else if (accion === 'card') window.abrirNuevaTarjeta?.();
      else if (accion === 'loan') window.abrirNuevoPrestamo?.();
    }, 80);
  }

  function asegurarAdminModal() {
    if ($('hfDebtAdminModal')) {
      window.HFDeudasRedesign24?.enhanceAdminModal?.();
      return;
    }

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfDebtAdminModal" onclick="closeModalOutside(event,'hfDebtAdminModal')">
        <div class="modal-sheet hf-app-sheet hf-debt-admin-sheet" style="position:relative">
          <button class="modal-close hf-sheet-close" type="button" onclick="closeModal('hfDebtAdminModal')" aria-label="Cerrar">✕</button>
          <div class="modal-handle"></div>
          <div class="hf-debt-admin-heading">
            <span class="hf-debt-admin-icon">⚙</span>
            <div><div class="modal-title">Administrar deudas</div><p>Registra obligaciones, consulta su evolución y organiza los pagos.</p></div>
          </div>
          <div class="hf-debt-admin-actions">
            <button class="hf-debt-admin-action" type="button" data-coordinator-action="states"><span>▥</span><div><strong>Estados de cuenta y evolución</strong><small>Compara saldos confirmados y pagos por mes.</small></div><em>›</em></button>
            <button class="hf-debt-admin-action" type="button" data-coordinator-action="plan"><span>▦</span><div><strong>Calcular cómo pagar</strong><small>Simula cuotas, tiempo e intereses.</small></div><em>›</em></button>
            <button class="hf-debt-admin-action" type="button" data-coordinator-action="card"><span>▣</span><div><strong>Agregar tarjeta</strong><small>Registra línea, fechas y TEA.</small></div><em>›</em></button>
            <button class="hf-debt-admin-action" type="button" data-coordinator-action="loan"><span>▤</span><div><strong>Agregar préstamo</strong><small>Registra saldo, cuota y vencimiento.</small></div><em>›</em></button>
          </div>
        </div>
      </div>`);

    $('hfDebtAdminModal')?.querySelectorAll('[data-coordinator-action]').forEach(button => {
      button.addEventListener('click', () => ejecutarAdmin(button.dataset.coordinatorAction));
    });

    window.HFDeudasRedesign24?.enhanceAdminModal?.();
  }

  function aplicarFabAdministracion() {
    const fab = $('fab-global');
    if (!fab || !paginaDeudasActiva()) return;

    if (!esAdministrador()) {
      fab.style.display = 'none';
      fab.removeAttribute('data-hf-debt-admin');
      return;
    }

    fab.style.display = 'flex';
    fab.style.backgroundColor = '#2447c6';
    fab.dataset.label = 'Administrar deudas';
    fab.dataset.hfDebtAdmin = 'true';
    fab.setAttribute('aria-label', 'Administrar deudas');
    fab.setAttribute('title', 'Administrar deudas');
  }

  function abrirAdministracion() {
    if (!esAdministrador()) return;
    asegurarAdminModal();
    window.HFDeudasRedesign24?.enhanceAdminModal?.();
    if (typeof window.openModal === 'function') window.openModal('hfDebtAdminModal');
    else $('hfDebtAdminModal')?.classList.add('open');
  }

  function instalarFab() {
    const fab = $('fab-global');
    if (fab && !state.fabListener) {
      state.fabListener = true;
      fab.addEventListener('click', event => {
        if (!paginaDeudasActiva()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        abrirAdministracion();
      }, true);
    }
    aplicarFabAdministracion();
  }

  async function renderizar() {
    asegurarVista();

    if (state.renderizando) {
      state.pendiente = true;
      return;
    }

    const renderer = window.HFDeudasRedesign24?.renderDebtPage;
    if (typeof renderer !== 'function' || !window.DB?.getTarjetas || !window.DB?.getPrestamos) {
      clearTimeout(state.retryTimer);
      state.retryTimer = setTimeout(renderizar, 120);
      return;
    }

    state.renderizando = true;
    try {
      const [tarjetas, prestamos] = await Promise.all([
        window.DB.getTarjetas(),
        window.DB.getPrestamos()
      ]);
      state.tarjetas = Array.isArray(tarjetas) ? tarjetas : [];
      state.prestamos = Array.isArray(prestamos) ? prestamos : [];

      await renderer(state.tarjetas, state.prestamos);
      actualizarContadores();
      document.body?.classList.add('hf-debt-v33-ready');
      window.HFDeudasRedesign24?.enhanceAdminModal?.();
    } catch (error) {
      console.warn('No se pudo actualizar la vista final de Deudas:', error);
    } finally {
      state.renderizando = false;
      if (state.pendiente) {
        state.pendiente = false;
        programar(60);
      }
    }
  }

  function programar(delay = 80) {
    clearTimeout(state.timer);
    state.timer = setTimeout(renderizar, delay);
  }

  function iniciar() {
    if (state.iniciado) return;
    state.iniciado = true;

    asegurarVista();
    asegurarAdminModal();
    instalarFab();
    programar(0);

    window.addEventListener('hf:gastos-actualizados', () => programar(140));
    window.addEventListener('hf:cierre-mensual-guardado', () => programar(140));

    const page = $('page-deudas');
    if (page && !state.pageObserver) {
      state.pageObserver = new MutationObserver(() => aplicarFabAdministracion());
      state.pageObserver.observe(page, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function obtenerEstado() {
    return {
      version: VERSION,
      iniciado: state.iniciado,
      renderizando: state.renderizando,
      tarjetas: state.tarjetas.length,
      prestamos: state.prestamos.length,
      renderer: 'HFDeudasRedesign24'
    };
  }

  function resumenTarjeta(tarjeta = {}) {
    return { tarjeta, deuda: Number(tarjeta.deuda || tarjeta.saldo || 0) };
  }

  function resumenPrestamo(prestamo = {}) {
    return { prestamo, saldo: Number(prestamo.saldoPendiente || prestamo.saldo || prestamo.deuda || 0) };
  }

  window.HFDeudasFamiliares = Object.freeze({
    version: VERSION,
    iniciar,
    renderizar,
    programar,
    abrirAdministracion,
    aplicarFabAdministracion,
    obtenerEstado,
    resumenTarjeta,
    resumenPrestamo
  });
  window.abrirAdministracionDeudas = abrirAdministracion;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();

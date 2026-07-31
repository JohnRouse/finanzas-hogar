/* Hogar Finanzas — Recuperación del producto: UX estable y acciones contextuales */
(() => {
  'use strict';
  if (window.HFRecuperacionProducto) return;

  const estado = { iniciado:false, observer:null, timer:null, historialInstalado:false, menusInstalados:false, fabInstalado:false };
  const normalizar = (s='') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

  function limpiarOutlook() {
    document.getElementById('btn-outlook')?.remove();
    document.getElementById('outlookModal')?.remove();
    document.getElementById('hf-outlook-styles')?.remove();
    document.querySelectorAll('.modal-overlay,.modal,[role="dialog"]').forEach(el => {
      const texto = normalizar(el.textContent);
      if (texto.includes('microsoft entra') || texto.includes('client id') || texto.includes('tenant id')) el.remove();
    });
  }

  function limpiarRedundancias() {
    document.getElementById('hf-centro-tarjetas')?.remove();
    document.getElementById('hf-centro-financiero-modal')?.remove();
    document.querySelectorAll('[data-hf-abrir-centro],.hf-mobile-fold').forEach(el => el.remove());

    document.querySelector('#page-resumen .income-toolbar')?.classList.add('hf-hidden-by-fab');
    document.querySelectorAll('#page-deudas [data-hf-core-action]').forEach(el => el.remove());
    document.querySelectorAll('#page-deudas .hf-finance-launcher').forEach(el => el.classList.add('hf-hidden-by-fab'));

    document.querySelectorAll('#page-gastos button').forEach(btn => {
      if (normalizar(btn.textContent).includes('detectados')) btn.classList.add('hf-feature-paused');
    });
  }

  function prepararModalIngresos() {
    if (document.getElementById('hfIngresoChoiceModal')) return;
    const modal = document.createElement('div');
    modal.id = 'hfIngresoChoiceModal';
    modal.className = 'modal-overlay';
    modal.setAttribute('onclick', "closeModalOutside(event,'hfIngresoChoiceModal')");
    modal.innerHTML = `
      <div class="modal-sheet action-sheet hf-action-sheet">
        <div class="modal-handle"></div>
        <div class="hf-action-sheet-icon income">S/</div>
        <div class="modal-title">Ingresos</div>
        <p class="hf-action-sheet-help">Registra dinero recibido o revisa los ingresos que ya forman parte del mes.</p>
        <div class="action-buttons">
          <button class="choice-btn" type="button" onclick="closeModal('hfIngresoChoiceModal'); openIngresoExtraModal()">
            <span class="choice-icon">＋</span><div class="choice-text"><strong>Registrar ingreso</strong><p>Agregar sueldo, adelanto u otro ingreso.</p></div>
          </button>
          <button class="choice-btn" type="button" onclick="closeModal('hfIngresoChoiceModal'); abrirGestionIngresos()">
            <span class="choice-icon">≡</span><div class="choice-text"><strong>Ver y administrar ingresos</strong><p>Consulta, edita o elimina ingresos registrados.</p></div>
          </button>
        </div>
        <button class="modal-btn-cancel" type="button" onclick="closeModal('hfIngresoChoiceModal')">Cancelar</button>
      </div>`;
    document.body.appendChild(modal);
  }

  function prepararModalDeudas() {
    const modal = document.getElementById('deudaChoiceModal');
    const sheet = modal?.querySelector('.modal-sheet');
    if (!modal || !sheet || sheet.dataset.hfPreparado) return;
    sheet.dataset.hfPreparado = 'true';
    sheet.classList.add('hf-action-sheet');
    sheet.innerHTML = `
      <div class="modal-handle"></div>
      <div class="hf-action-sheet-icon debt">↘</div>
      <div class="modal-title">Deudas</div>
      <p class="hf-action-sheet-help">Elige qué necesitas hacer. Los saldos existentes se actualizan desde el recuadro “Confirma tus saldos”.</p>
      <div class="action-buttons">
        <button class="choice-btn" type="button" onclick="closeModal('deudaChoiceModal'); abrirNuevaTarjeta()">
          <span class="choice-icon">💳</span><div class="choice-text"><strong>Agregar tarjeta</strong><p>Registrar una nueva tarjeta de crédito.</p></div>
        </button>
        <button class="choice-btn" type="button" onclick="closeModal('deudaChoiceModal'); abrirNuevoPrestamo()">
          <span class="choice-icon">🏦</span><div class="choice-text"><strong>Agregar préstamo</strong><p>Registrar un préstamo y sus cuotas.</p></div>
        </button>
        <button class="choice-btn featured" type="button" onclick="closeModal('deudaChoiceModal'); abrirCentroFinanciero()">
          <span class="choice-icon">📉</span><div class="choice-text"><strong>Planificar cómo pagar</strong><p>Calcula una cuota y decide qué tarjeta priorizar.</p></div>
        </button>
      </div>
      <button class="modal-btn-cancel" type="button" onclick="closeModal('deudaChoiceModal')">Cancelar</button>`;
  }

  function instalarFabContextual() {
    if (estado.fabInstalado) return;
    prepararModalIngresos();
    prepararModalDeudas();
    const original = window.handleFabClick;
    window.handleFabClick = function() {
      try {
        if (typeof window.vibrar === 'function') window.vibrar();
        if (window.activeTab === 'resumen' || (typeof activeTab !== 'undefined' && activeTab === 'resumen')) return window.openModal('hfIngresoChoiceModal');
        if (window.activeTab === 'deudas' || (typeof activeTab !== 'undefined' && activeTab === 'deudas')) return window.openModal('deudaChoiceModal');
      } catch (_) {}
      return typeof original === 'function' ? original() : undefined;
    };
    estado.fabInstalado = true;
  }

  function cerrarMenusGasto() {
    document.querySelectorAll('.expense-more-menu.open').forEach(menu => {
      menu.classList.remove('open','hf-menu-fixed');
      menu.style.removeProperty('top'); menu.style.removeProperty('right'); menu.style.removeProperty('left');
    });
  }

  function abrirMenuGasto(event, menuId) {
    event?.preventDefault(); event?.stopPropagation();
    const boton = event?.currentTarget || event?.target?.closest('.expense-more-btn');
    const menu = document.getElementById(menuId);
    if (!boton || !menu) return false;
    const abierto = menu.classList.contains('open');
    cerrarMenusGasto();
    if (abierto) return false;
    const rect = boton.getBoundingClientRect();
    menu.classList.add('open','hf-menu-fixed');
    const ancho = Math.max(132, menu.offsetWidth || 132);
    const alto = Math.max(86, menu.offsetHeight || 86);
    const izquierda = Math.min(window.innerWidth - ancho - 10, Math.max(10, rect.right - ancho));
    const arriba = rect.bottom + alto + 10 > window.innerHeight ? Math.max(10, rect.top - alto - 6) : rect.bottom + 4;
    menu.style.left = `${izquierda}px`;
    menu.style.top = `${arriba}px`;
    menu.style.right = 'auto';
    return true;
  }

  function instalarMenusGasto() {
    window.toggleExpenseMenu = abrirMenuGasto;
    if (estado.menusInstalados) return;
    document.addEventListener('click', cerrarMenusGasto);
    document.addEventListener('scroll', cerrarMenusGasto, true);
    estado.menusInstalados = true;
  }

  function nombreMesActual() {
    const visible = document.getElementById('month-display')?.textContent?.trim();
    if (visible) return visible;
    try { if (typeof DB?.formatMes === 'function' && typeof mesActual !== 'undefined') return DB.formatMes(mesActual); } catch (_) {}
    return new Date().toLocaleDateString('es-PE',{month:'long',year:'numeric'});
  }

  function instalarHistorialSeguro() {
    if (estado.historialInstalado || typeof window.generarGastoHTML !== 'function' || typeof window.openModal !== 'function') return;
    window.abrirHistorialCompleto = function() {
      const lista = document.getElementById('listaCompletaGastos');
      const modal = document.getElementById('modalHistorial');
      if (!lista || !modal) return window.showToast?.('No se pudo abrir el historial. Recarga la aplicación.');
      const titulo = document.getElementById('historialTitle');
      if (titulo) titulo.textContent = `Movimientos de ${nombreMesActual()}`;
      document.getElementById('historial-search') && (document.getElementById('historial-search').value='');
      document.getElementById('historial-search-clear') && (document.getElementById('historial-search-clear').style.display='none');
      document.getElementById('historial-no-resultados') && (document.getElementById('historial-no-resultados').style.display='none');
      let gastos=[]; let configuracion={};
      try { if (Array.isArray(gastosDelMesCache)) gastos=gastosDelMesCache; if (configCache) configuracion=configCache; } catch (_) {}
      lista.innerHTML = gastos.length ? gastos.map(g=>window.generarGastoHTML(g,configuracion)).join('') : '<div class="empty-state">Sin movimientos registrados en este mes.</div>';
      window.openModal('modalHistorial');
      return true;
    };
    estado.historialInstalado=true;
  }

  function aplicar() {
    limpiarOutlook();
    limpiarRedundancias();
    prepararModalIngresos();
    prepararModalDeudas();
    instalarFabContextual();
    instalarMenusGasto();
    instalarHistorialSeguro();
  }

  function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado=true; aplicar();
    estado.observer=new MutationObserver(()=>{ clearTimeout(estado.timer); estado.timer=setTimeout(aplicar,160); });
    estado.observer.observe(document.body,{childList:true,subtree:true});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true}); else iniciar();
  window.HFRecuperacionProducto=Object.freeze({iniciar,aplicar,instalarHistorialSeguro});
})();
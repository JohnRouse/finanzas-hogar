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
    document.querySelectorAll('#page-deudas [data-hf-core-action],#page-deudas [data-hf-update-all]').forEach(el => el.remove());
    document.querySelectorAll('#page-deudas .hf-finance-launcher').forEach(el => el.classList.add('hf-hidden-by-fab'));

    document.querySelectorAll('#page-gastos button').forEach(btn => {
      if (normalizar(btn.textContent).includes('detectados')) btn.classList.add('hf-feature-paused');
    });
  }

  function contenidoAccion({ icono, tono, titulo, ayuda, acciones, modalId }) {
    return `
      <button class="modal-close hf-sheet-close" type="button" onclick="closeModal('${modalId}')" aria-label="Cerrar">✕</button>
      <div class="modal-handle"></div>
      <div class="hf-sheet-heading">
        <div class="hf-action-sheet-icon ${tono}">${icono}</div>
        <div class="hf-sheet-heading-copy">
          <div class="modal-title">${titulo}</div>
          <p class="hf-action-sheet-help">${ayuda}</p>
        </div>
      </div>
      <div class="hf-action-list">
        ${acciones.map(a => `
          <button class="hf-action-row ${a.destacada ? 'featured' : ''}" type="button" onclick="${a.onclick}">
            <span class="hf-action-row-icon ${a.tono || ''}">${a.icono}</span>
            <span class="hf-action-row-copy"><strong>${a.titulo}</strong><small>${a.ayuda}</small></span>
            <span class="hf-action-row-chevron" aria-hidden="true">›</span>
          </button>`).join('')}
      </div>
      <button class="hf-sheet-cancel" type="button" onclick="closeModal('${modalId}')">Cancelar</button>`;
  }

  function prepararModalIngresos() {
    let modal = document.getElementById('hfIngresoChoiceModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'hfIngresoChoiceModal';
      modal.className = 'modal-overlay';
      modal.setAttribute('onclick', "closeModalOutside(event,'hfIngresoChoiceModal')");
      modal.innerHTML = '<div class="modal-sheet"></div>';
      document.body.appendChild(modal);
    }
    const sheet = modal.querySelector('.modal-sheet');
    if (!sheet || sheet.dataset.hfPreparado === '16.9') return;
    sheet.dataset.hfPreparado = '16.9';
    sheet.className = 'modal-sheet hf-app-sheet hf-action-sheet';
    sheet.innerHTML = contenidoAccion({
      modalId:'hfIngresoChoiceModal', icono:'S/', tono:'income', titulo:'Ingresos',
      ayuda:'Registra dinero recibido o revisa los ingresos que ya forman parte del mes.',
      acciones:[
        { icono:'＋', tono:'income', titulo:'Registrar ingreso', ayuda:'Agrega sueldo, adelanto u otro ingreso.', onclick:"closeModal('hfIngresoChoiceModal'); openIngresoExtraModal()" },
        { icono:'≡', tono:'neutral', titulo:'Ver y administrar ingresos', ayuda:'Consulta, edita o elimina ingresos registrados.', onclick:"closeModal('hfIngresoChoiceModal'); abrirGestionIngresos()" }
      ]
    });
  }

  function prepararModalGastos() {
    const modal = document.getElementById('gastoChoiceModal');
    const sheet = modal?.querySelector('.modal-sheet');
    if (!modal || !sheet || sheet.dataset.hfPreparado === '16.9') return;
    sheet.dataset.hfPreparado = '16.9';
    sheet.className = 'modal-sheet hf-app-sheet hf-action-sheet';
    sheet.innerHTML = contenidoAccion({
      modalId:'gastoChoiceModal', icono:'S/', tono:'expense', titulo:'Agregar gasto',
      ayuda:'Elige una forma rápida o completa de registrar el movimiento.',
      acciones:[
        { icono:'⚡', tono:'expense', titulo:'Gasto rápido', ayuda:'Monto, categoría y medio de pago en pocos pasos.', onclick:"closeModal('gastoChoiceModal'); openGastoRapidoModal()", destacada:true },
        { icono:'🧾', tono:'neutral', titulo:'Gasto detallado', ayuda:'Añade descripción, fecha, tarjeta y recurrencia.', onclick:"closeModal('gastoChoiceModal'); openGastoModal()" }
      ]
    });
  }

  function prepararModalDeudas() {
    const modal = document.getElementById('deudaChoiceModal');
    const sheet = modal?.querySelector('.modal-sheet');
    if (!modal || !sheet || sheet.dataset.hfPreparado === '16.9') return;
    sheet.dataset.hfPreparado = '16.9';
    sheet.className = 'modal-sheet hf-app-sheet hf-action-sheet';
    sheet.innerHTML = contenidoAccion({
      modalId:'deudaChoiceModal', icono:'S/', tono:'debt', titulo:'Deudas',
      ayuda:'Agrega una obligación o abre el planificador. Los saldos se actualizan desde el recuadro superior.',
      acciones:[
        { icono:'💳', tono:'debt', titulo:'Agregar tarjeta', ayuda:'Registra una nueva tarjeta de crédito.', onclick:"closeModal('deudaChoiceModal'); abrirNuevaTarjeta()" },
        { icono:'🏦', tono:'neutral', titulo:'Agregar préstamo', ayuda:'Registra un préstamo y sus cuotas.', onclick:"closeModal('deudaChoiceModal'); abrirNuevoPrestamo()" },
        { icono:'📉', tono:'plan', titulo:'Planificar cómo pagar', ayuda:'Calcula una cuota y decide qué tarjeta priorizar.', onclick:"closeModal('deudaChoiceModal'); abrirCentroFinanciero()", destacada:true }
      ]
    });
  }

  function retirarEscanerVoucher() {
    const input = document.getElementById('voucher-input');
    const toggle = document.getElementById('voucher-toggle');
    const panel = document.getElementById('voucher-panel');
    const posibleContenedor = toggle?.parentElement || panel?.parentElement || null;

    // No se elimina el contenedor antes de retirar sus hijos. En el HTML heredado,
    // el bloque del escáner puede envolver accidentalmente el resto del formulario.
    input?.remove();
    toggle?.remove();
    panel?.remove();

    // Solo retiramos el envoltorio cuando quedó realmente vacío.
    if (posibleContenedor && posibleContenedor.children.length === 0 && !posibleContenedor.textContent.trim()) {
      posibleContenedor.remove();
    } else if (posibleContenedor && !posibleContenedor.querySelector('#voucher-toggle,#voucher-panel,#voucher-input')) {
      posibleContenedor.style.removeProperty('margin-bottom');
    }
  }

  function prepararFormulariosFab() {
    retirarEscanerVoucher();

    const ids = ['ingresoExtraModal','gestionIngresosModal','gastoRapidoModal','gastoModal','tarjetaModal','prestamoModal','metaModal'];
    ids.forEach(id => {
      const sheet = document.getElementById(id)?.querySelector('.modal-sheet');
      if (!sheet) return;
      sheet.classList.add('hf-app-sheet','hf-form-sheet');
    });

    const meta = document.getElementById('metaModal')?.querySelector('.modal-sheet');
    const tituloMeta = meta?.querySelector('.modal-title');
    if (meta && tituloMeta && !meta.querySelector('.hf-form-intro')) {
      tituloMeta.insertAdjacentHTML('afterend','<p class="hf-form-intro">Define el objetivo y cuánto ya tienes reservado. Podrás actualizarlo después.</p>');
    }
  }

  function instalarFabContextual() {
    if (estado.fabInstalado) return;
    const original = window.handleFabClick;
    window.handleFabClick = function() {
      try {
        if (typeof window.vibrar === 'function') window.vibrar();
        const tab = typeof activeTab !== 'undefined' ? activeTab : window.activeTab;
        if (tab === 'resumen') return window.openModal('hfIngresoChoiceModal');
        if (tab === 'deudas') return window.openModal('deudaChoiceModal');
      } catch (_) {}
      return typeof original === 'function' ? original() : undefined;
    };
    estado.fabInstalado = true;
  }

  function asegurarPortalMenu() {
    let portal = document.getElementById('hfExpenseMenuPortal');
    if (portal) return portal;
    portal = document.createElement('div');
    portal.id = 'hfExpenseMenuPortal';
    portal.className = 'hf-expense-menu-portal';
    portal.setAttribute('role','menu');
    portal.addEventListener('click', event => {
      event.stopPropagation();
      if (event.target.closest('button')) setTimeout(cerrarMenusGasto, 0);
    });
    document.body.appendChild(portal);
    return portal;
  }

  function cerrarMenusGasto() {
    document.querySelectorAll('.expense-more-menu.open').forEach(menu => menu.classList.remove('open','hf-menu-fixed'));
    const portal = document.getElementById('hfExpenseMenuPortal');
    if (portal) {
      portal.classList.remove('open');
      portal.innerHTML = '';
      portal.style.removeProperty('top');
      portal.style.removeProperty('left');
    }
  }

  function abrirMenuGasto(event, menuId) {
    event?.preventDefault();
    event?.stopPropagation();
    const boton = event?.currentTarget || event?.target?.closest('.expense-more-btn');
    const menuOriginal = document.getElementById(menuId);
    if (!boton || !menuOriginal) return false;

    const portal = asegurarPortalMenu();
    const mismoMenu = portal.dataset.menuId === menuId && portal.classList.contains('open');
    cerrarMenusGasto();
    if (mismoMenu) return false;

    portal.dataset.menuId = menuId;
    portal.innerHTML = menuOriginal.innerHTML;
    portal.classList.add('open');
    portal.style.visibility = 'hidden';

    const rect = boton.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const ancho = Math.max(144, portal.offsetWidth || 144);
    const alto = Math.max(92, portal.offsetHeight || 92);
    const izquierda = Math.min(viewportWidth - ancho - 12, Math.max(12, rect.right - ancho));
    const espacioAbajo = viewportHeight - rect.bottom;
    const arriba = espacioAbajo >= alto + 12 ? rect.bottom + 6 : Math.max(12, rect.top - alto - 6);

    portal.style.left = `${izquierda}px`;
    portal.style.top = `${arriba}px`;
    portal.style.visibility = 'visible';
    return true;
  }

  function instalarMenusGasto() {
    window.toggleExpenseMenu = abrirMenuGasto;
    if (estado.menusInstalados) return;
    asegurarPortalMenu();
    document.addEventListener('click', cerrarMenusGasto);
    document.addEventListener('scroll', cerrarMenusGasto, true);
    window.addEventListener('resize', cerrarMenusGasto);
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
    prepararModalGastos();
    prepararModalDeudas();
    prepararFormulariosFab();
    instalarFabContextual();
    instalarMenusGasto();
    instalarHistorialSeguro();
  }

  function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado=true;
    aplicar();
    estado.observer=new MutationObserver(()=>{ clearTimeout(estado.timer); estado.timer=setTimeout(aplicar,140); });
    estado.observer.observe(document.body,{childList:true,subtree:true});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true}); else iniciar();
  window.HFRecuperacionProducto=Object.freeze({iniciar,aplicar,instalarHistorialSeguro,cerrarMenusGasto,retirarEscanerVoucher});
})();
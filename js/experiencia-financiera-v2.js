(() => {
  'use strict';

  if (window.HFVisualUIUX22) return;

  const VERSION = '22.0';
  const state = {
    observer: null,
    timer: null,
    healing: null,
    healingCount: 0,
    debtLoading: false,
    debtSignature: ''
  };

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5.5 9.5V21h13V9.5"></path><path d="M9 21v-6h6v6"></path></svg>',
    movements: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14"></path><path d="M5 10h14"></path><path d="M5 15h10"></path><path d="M5 20h7"></path></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18"></path><path d="M7 15h3"></path></svg>',
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"></path><path d="M17 7.5C17 5.5 15.2 4 12 4S7 5.4 7 7.5 8.7 11 12 11s5 1.4 5 3.5S15.2 18 12 18s-5-1.6-5-3.5"></path></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1H9.6V21a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1V9.6H3a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.25.37.46.78.6 1 .13.34.2.7.2 1v1c0 .36-.07.72-.2 1-.14.22-.35.63-.6 1Z"></path></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"></path></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 15H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg>'
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeText(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isAdmin() {
    try {
      const member = typeof window.obtenerMiembroActual === 'function'
        ? window.obtenerMiembroActual()
        : null;
      if (member) return member.rol === 'administrador' || member.legacyTipo === 'yo';
    } catch (_) {}
    return localStorage.getItem('miUsuarioTipo') !== 'pareja';
  }

  function forceHide(element) {
    if (!element) return;
    element.hidden = true;
    element.setAttribute('aria-hidden', 'true');
    element.dataset.hfObsolete = 'true';
    element.style.setProperty('display', 'none', 'important');
    element.style.setProperty('visibility', 'hidden', 'important');
  }

  function hideRemovedBlocks() {
    forceHide(byId('estado-mes'));
    document.querySelectorAll(
      '#hf-family-debt-view .hf-family-debt-head,' +
      '#hf-family-debt-view .hf-family-priority,' +
      '#hf-family-debt-view .hf-family-route'
    ).forEach(forceHide);
  }

  function enhanceHeader() {
    const settings = document.querySelector('.settings-btn');
    if (settings && settings.dataset.hfUiux !== VERSION) {
      settings.dataset.hfUiux = VERSION;
      settings.innerHTML = ICONS.settings;
      settings.setAttribute('aria-label', 'Abrir configuración');
      settings.setAttribute('title', 'Configuración');
    }

    const monthButton = byId('monthBtn');
    const monthText = byId('month-display');
    if (monthButton && monthText && !monthButton.querySelector('.hf-month-chevron')) {
      const wrapper = document.createElement('span');
      wrapper.className = 'hf-month-chevron';
      wrapper.innerHTML = ICONS.chevron;
      monthButton.appendChild(wrapper);
      monthButton.setAttribute('aria-label', 'Cambiar mes');
    }
  }

  function enhanceNavigation() {
    const tabs = [...document.querySelectorAll('.tabs .tab')];
    const config = [
      ['home', 'Resumen'],
      ['movements', 'Movimientos'],
      ['card', 'Deudas'],
      ['plan', 'Plan']
    ];

    tabs.forEach((tab, index) => {
      const [icon, label] = config[index] || config[0];
      if (tab.dataset.hfUiux === VERSION) return;
      tab.dataset.hfUiux = VERSION;
      tab.innerHTML = `<span class="nav-icon">${ICONS[icon]}</span><span class="nav-label">${label}</span>`;
      tab.setAttribute('aria-label', label);
    });
  }

  function arrangeSummary() {
    const grid = document.querySelector('#page-resumen .month-money-grid');
    if (!grid) return;

    let secondary = grid.querySelector('.summary-secondary-list');
    const cards = [...grid.children].filter(element => element.classList.contains('month-money-card'));

    if (!secondary && cards.length >= 3) {
      secondary = document.createElement('div');
      secondary.className = 'summary-secondary-list';
      secondary.setAttribute('aria-label', 'Indicadores complementarios del mes');
      secondary.append(cards[1], cards[2]);
      grid.appendChild(secondary);
    }
  }

  function updateCopy() {
    document.querySelectorAll('.section-title').forEach(title => {
      const text = title.textContent.trim();
      if (text === 'Participación del hogar') title.textContent = 'Gastos registrados por persona';
      if (text === 'Gastos') title.textContent = 'Movimientos';
    });

    document.querySelectorAll('#expenseList *, #listaCompletaGastos *').forEach(node => {
      if (node.children.length || node.textContent.trim() !== 'Telegram') return;
      node.textContent = 'Automático';
      node.classList.add('expense-source-auto');
      node.setAttribute('title', 'Registrado por el bot de Telegram');
    });
  }

  function setChartDefaults() {
    if (!window.Chart?.defaults) return;
    window.Chart.defaults.font.family = 'IBM Plex Sans, system-ui, sans-serif';
    window.Chart.defaults.font.size = 12;
    window.Chart.defaults.color = '#64748b';
    window.Chart.defaults.borderColor = 'rgba(203, 213, 225, .55)';
    if (window.Chart.defaults.animation) window.Chart.defaults.animation.duration = 220;
  }

  function closeAllMenus(except = null) {
    document.querySelectorAll('.hf-card-menu.open, .debt-more-menu.open').forEach(menu => {
      if (menu === except) return;
      menu.classList.remove('open');
      menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
    });
  }

  function createMenuButton(name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hf-card-menu-button';
    button.innerHTML = ICONS.more;
    button.setAttribute('aria-label', `Editar o eliminar ${name}`);
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    return button;
  }

  function createMenu(name, editAction, deleteAction) {
    const wrap = document.createElement('div');
    wrap.className = 'hf-card-menu-wrap';

    const button = createMenuButton(name);
    const menu = document.createElement('div');
    menu.className = 'hf-card-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <button type="button" data-action="edit" role="menuitem">${ICONS.edit}<span>Editar</span></button>
      <button type="button" class="danger" data-action="delete" role="menuitem">${ICONS.trash}<span>Eliminar</span></button>`;

    button.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = !menu.classList.contains('open');
      closeAllMenus(menu);
      menu.classList.toggle('open', willOpen);
      button.setAttribute('aria-expanded', String(willOpen));
    });

    menu.querySelector('[data-action="edit"]')?.addEventListener('click', event => {
      event.stopPropagation();
      closeAllMenus();
      editAction();
    });

    menu.querySelector('[data-action="delete"]')?.addEventListener('click', event => {
      event.stopPropagation();
      closeAllMenus();
      deleteAction();
    });

    wrap.append(button, menu);
    return wrap;
  }

  function editCard(card) {
    if (window.HFExperienciaFinanciera14?.editarTarjeta) {
      window.HFExperienciaFinanciera14.editarTarjeta(card.id);
      return;
    }
    window.abrirEditarTarjeta?.(
      card.id,
      card.nombre || card.banco || '',
      number(card.deuda),
      number(card.limite || card.lineaTotal),
      card.cierre || card.diaCierre || '',
      card.vence || card.diaVencimiento || '',
      card.quien || 'yo'
    );
  }

  function payCard(card) {
    window.abrirPagoTarjeta?.(
      card.id,
      card.nombre || card.banco || 'Tarjeta',
      number(card.deuda || card.saldo)
    );
  }

  function editLoan(loan) {
    window.abrirEditarPrestamo?.(
      loan.id,
      loan.nombre || loan.entidad || loan.banco || '',
      number(loan.saldo || loan.saldoPendiente || loan.deuda),
      number(loan.cuota || loan.cuotaMensual || loan.pagoMensual),
      number(loan.pagadas),
      number(loan.total || loan.cuotasTotales),
      loan.quien || 'yo',
      loan.proximoVencimiento || loan.fechaVencimiento || '',
      loan.frecuencia || 'mensual'
    );
  }

  function payLoan(loan) {
    window.abrirPagoPrestamo?.(
      loan.id,
      loan.nombre || loan.entidad || loan.banco || 'Préstamo',
      number(loan.saldo || loan.saldoPendiente || loan.deuda),
      number(loan.cuota || loan.cuotaMensual || loan.pagoMensual),
      loan.proximoVencimiento || loan.fechaVencimiento || '',
      loan.frecuencia || 'mensual',
      loan.quien || 'yo'
    );
  }

  function addCardActions(element, type, item) {
    if (!element || !item) return;

    element.querySelector('.hf-stage14-debt-actions')?.remove();
    element.dataset.hfDebtId = String(item.id || '');
    element.dataset.hfDebtType = type;

    const name = type === 'card'
      ? (item.nombre || item.banco || 'tarjeta')
      : (item.nombre || item.entidad || item.banco || 'préstamo');

    if (!element.querySelector('.hf-card-menu-wrap') && isAdmin()) {
      const menu = createMenu(
        name,
        () => type === 'card' ? editCard(item) : editLoan(item),
        () => type === 'card'
          ? window.eliminarTarjeta?.(item.id)
          : window.eliminarPrestamo?.(item.id)
      );
      element.appendChild(menu);
    }

    if (!element.querySelector('.hf-card-actions')) {
      const actions = document.createElement('div');
      actions.className = 'hf-card-actions';

      const primary = document.createElement('button');
      primary.type = 'button';
      primary.className = 'hf-card-primary-action';
      primary.textContent = type === 'card' ? 'Registrar pago' : 'Pagar cuota';
      primary.addEventListener('click', event => {
        event.stopPropagation();
        type === 'card' ? payCard(item) : payLoan(item);
      });

      const expand = document.createElement('button');
      expand.type = 'button';
      expand.className = 'hf-card-expand';
      expand.innerHTML = `<span>Ver detalles</span>${ICONS.down}`;
      expand.setAttribute('aria-expanded', 'false');
      expand.addEventListener('click', event => {
        event.stopPropagation();
        const expanded = element.classList.toggle('is-expanded');
        expand.setAttribute('aria-expanded', String(expanded));
        expand.querySelector('span').textContent = expanded ? 'Ocultar detalles' : 'Ver detalles';
      });

      actions.append(primary, expand);
      element.appendChild(actions);
    }
  }

  async function enhanceFamilyDebtCards() {
    if (state.debtLoading || !window.DB) return;
    const view = byId('hf-family-debt-view');
    if (!view) return;

    const lists = view.querySelectorAll('.hf-family-card-list');
    if (lists.length < 2) return;

    state.debtLoading = true;
    try {
      const [cards, loans] = await Promise.all([
        window.DB.getTarjetas?.().catch(() => []) || [],
        window.DB.getPrestamos?.().catch(() => []) || []
      ]);

      const cardElements = [...lists[0].querySelectorAll('.hf-family-card')];
      const loanElements = [...lists[1].querySelectorAll('.hf-family-card')];
      const signature = `${cards.map(item => item.id).join(',')}|${loans.map(item => item.id).join(',')}|${cardElements.length}|${loanElements.length}`;

      cardElements.forEach((element, index) => addCardActions(element, 'card', cards[index]));
      loanElements.forEach((element, index) => addCardActions(element, 'loan', loans[index]));
      state.debtSignature = signature;
    } catch (error) {
      console.warn('No se pudieron preparar las acciones visuales de deudas:', error);
    } finally {
      state.debtLoading = false;
    }
  }

  function enhanceLegacyDebtMenus() {
    document.querySelectorAll('.debt-more-btn').forEach(button => {
      if (button.dataset.hfUiux === VERSION) return;
      button.dataset.hfUiux = VERSION;
      button.innerHTML = ICONS.more;
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
    });

    document.querySelectorAll('.debt-more-menu button').forEach(button => {
      if (button.textContent.trim().toLowerCase().includes('eliminar')) button.classList.add('danger');
    });
  }

  function repair() {
    try { hideRemovedBlocks(); } catch (error) { console.warn(error); }
    try { enhanceHeader(); } catch (error) { console.warn(error); }
    try { enhanceNavigation(); } catch (error) { console.warn(error); }
    try { arrangeSummary(); } catch (error) { console.warn(error); }
    try { updateCopy(); } catch (error) { console.warn(error); }
    try { setChartDefaults(); } catch (error) { console.warn(error); }
    try { enhanceLegacyDebtMenus(); } catch (error) { console.warn(error); }
    enhanceFamilyDebtCards();
    document.body?.classList.add('hf-uiux-pro-max');
  }

  function scheduleRepair() {
    clearTimeout(state.timer);
    state.timer = setTimeout(repair, 90);
  }

  function installObserver() {
    if (state.observer || !document.body) return;
    state.observer = new MutationObserver(scheduleRepair);
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
  }

  function startSelfHealing() {
    clearInterval(state.healing);
    state.healingCount = 0;
    state.healing = setInterval(() => {
      repair();
      state.healingCount += 1;
      if (state.healingCount >= 30) clearInterval(state.healing);
    }, 400);
  }

  function start() {
    repair();
    installObserver();
    startSelfHealing();

    document.addEventListener('click', event => {
      if (event.target.closest('.hf-card-menu-wrap, .debt-more-wrap')) return;
      closeAllMenus();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeAllMenus();
    });

    [
      'hf:gastos-actualizados',
      'hf:deuda-actualizada',
      'hf:deudas-core-actualizadas',
      'hf:estado-cuenta-confirmado',
      'hf:deudas-recalculadas'
    ].forEach(name => window.addEventListener(name, scheduleRepair));
  }

  window.HFVisualUIUX22 = Object.freeze({
    version: VERSION,
    repair,
    enhanceFamilyDebtCards,
    hideRemovedBlocks
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

(() => {
  'use strict';

  const VERSION = '28.0';
  if (window.HFExperienciaIntegrada28?.version === VERSION) return;

  const state = {
    movements: [],
    config: {},
    filter: 'todos',
    historyQuery: '',
    currentMonth: '',
    repairTimer: null,
    reloadTimer: null,
    observer: null,
    fabFallback: null,
    avatarSaving: false
  };

  const ICONS = {
    food: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l2 11h9l2-7H7"></path><circle cx="10" cy="20" r="1.4"></circle><circle cx="17" cy="20" r="1.4"></circle></svg>',
    services: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 12h7l-1 8 8-12h-7Z"></path></svg>',
    entertainment: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="m10 9 5 3-5 3Z"></path></svg>',
    transport: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16-1-4 2-5h12l2 5-1 4"></path><path d="M5 16h14v3H5z"></path><path d="M7 19v2M17 19v2M7.5 12h.01M16.5 12h.01"></path></svg>',
    health: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z"></path></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5.5 9.5V21h13V9.5"></path><path d="M9 21v-6h6v6"></path></svg>',
    education: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-5 9 5-9 5Z"></path><path d="M7 12v5c3 2 7 2 10 0v-5M21 9v7"></path></svg>',
    other: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 7 8-4 8 4-8 4Z"></path><path d="M4 7v10l8 4 8-4V7M12 11v10"></path></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18"></path><path d="M7 15h3"></path></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-7.3 18-4.2-7.2L3 10.6 21 3Z"></path><path d="m9.5 13.8 4.4-4.1"></path></svg>',
    cash: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><path d="M6 9h.01M18 15h.01"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    transfer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h15"></path><path d="m16 5 3 3-3 3"></path><path d="M20 16H5"></path><path d="m8 13-3 3 3 3"></path></svg>',
    cardPayment: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="3"></rect><path d="M3 9h18"></path><path d="m12 14 3 3 3-3"></path><path d="M15 12v7"></path></svg>',
    loanPayment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-5 9 5"></path><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"></path><path d="m12 11 2 2-2 2"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>',
    person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
    category: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"></path></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5z"></path><path d="M8 8h8M8 12h8M8 16h5"></path></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 15H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>',
    yape: '<span aria-hidden="true" class="hf-v28-yape-letter">Y</span>'
  };

  const $ = id => document.getElementById(id);
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => `S/ ${number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const normalize = (value = '') => String(value).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function parseDisplayedMonth() {
    const text = normalize($('month-display')?.textContent || '');
    const year = text.match(/20\d{2}/)?.[0];
    const monthIndex = MONTHS.findIndex(month => text.includes(month));
    if (year && monthIndex >= 0) return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    return window.DB?.getMesActual?.() || new Date().toISOString().slice(0, 7);
  }

  function formatDate(value, withYear = true) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'No registrada';
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', ...(withYear ? { year: 'numeric' } : {})
    });
  }

  function movementTimestamp(item = {}) {
    const value = item.creadoEn;
    if (value?.toMillis) return value.toMillis();
    if (value?.toDate) return value.toDate().getTime();
    if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
    return Date.parse(value || item.fecha || '') || 0;
  }

  function currentNames() {
    return {
      mine: state.config?.nombreYo || 'Christian',
      partner: state.config?.nombreElla || 'Sydney'
    };
  }

  function personName(value) {
    const names = currentNames();
    if (value === 'pareja') return names.partner;
    if (value === 'ambos') return 'Ambos';
    return names.mine;
  }

  function isCardPayment(item = {}) {
    return item.tipoMovimiento === 'pagoTarjeta' || /^pago\s+tarjeta:/i.test(item.desc || '');
  }

  function isLoanPayment(item = {}) {
    return item.tipoMovimiento === 'pagoPrestamo' || /^pago\s+prestamo:/i.test(normalize(item.desc || ''));
  }

  function movementTitle(item = {}) {
    if (isCardPayment(item)) return `Pago a ${item.tarjetaNombre || 'tarjeta'}`;
    if (isLoanPayment(item)) return `Pago de ${item.prestamoNombre || 'préstamo'}`;
    return item.desc || item.descripcion || 'Movimiento';
  }

  function sourceText(item = {}) {
    return [item.medio, item.metodoPago, item.formaPago, item.fuente, item.origen, item.canal]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function categoryData(item = {}) {
    if (isCardPayment(item)) return { key: 'debt', label: 'Pago de tarjeta', icon: ICONS.cardPayment };
    if (isLoanPayment(item)) return { key: 'debt', label: 'Pago de préstamo', icon: ICONS.loanPayment };

    const original = item.cat || item.categoria || 'Otros';
    const value = normalize(original);
    if (value.includes('aliment')) return { key: 'food', label: 'Alimentación', icon: ICONS.food };
    if (value.includes('servicio')) return { key: 'services', label: 'Servicios', icon: ICONS.services };
    if (value.includes('entret') || value.includes('ocio')) return { key: 'entertainment', label: 'Entretenimiento', icon: ICONS.entertainment };
    if (value.includes('transport')) return { key: 'transport', label: 'Transporte', icon: ICONS.transport };
    if (value.includes('salud') || value.includes('medic')) return { key: 'health', label: 'Salud', icon: ICONS.health };
    if (value.includes('hogar') || value.includes('casa')) return { key: 'home', label: 'Hogar', icon: ICONS.home };
    if (value.includes('educ')) return { key: 'education', label: 'Educación', icon: ICONS.education };
    if (value.includes('deuda')) return { key: 'debt', label: 'Deudas', icon: ICONS.cardPayment };
    return { key: 'other', label: original || 'Otros', icon: ICONS.other };
  }

  function shortCardName(value = '') {
    const cleaned = String(value || 'Tarjeta')
      .replace(/^tarjeta\s+/i, '')
      .replace(/^visa\s+/i, '')
      .replace(/^mastercard\s+/i, '')
      .trim();
    return cleaned || 'Tarjeta';
  }

  function badge(icon, label, kind, title = label) {
    return `<span class="hf-v28-method-badge ${kind}" title="${escapeHTML(title)}"><span class="hf-v28-badge-icon">${icon}</span><span class="hf-v28-badge-label">${escapeHTML(label)}</span></span>`;
  }

  function movementBadges(item = {}) {
    const source = sourceText(item);
    const result = [];
    const cardPayment = isCardPayment(item);
    const loanPayment = isLoanPayment(item);
    const telegram = source.includes('telegram') || item.fuente === 'telegram';
    const yape = source.includes('yape') || /\byape\b/i.test(item.desc || '');
    const plin = source.includes('plin');
    const card = !cardPayment && !loanPayment && (item.medio === 'tarjeta' || !!item.tarjetaId || !!item.tarjetaNombre);
    const debit = source.includes('debito') || source.includes('débito');
    const transfer = source.includes('transfer');
    const cash = source.includes('efectivo') || source.includes('cash');

    if (cardPayment) result.push(badge(ICONS.cardPayment, 'Pago de tarjeta', 'payment'));
    else if (loanPayment) result.push(badge(ICONS.loanPayment, 'Pago de préstamo', 'payment'));
    else if (card) {
      const full = item.tarjetaNombre || 'Tarjeta';
      result.push(badge(ICONS.card, shortCardName(full), 'card', full));
    } else if (yape) result.push(badge(ICONS.yape, 'Yape', 'yape'));
    else if (plin) result.push(badge(ICONS.transfer, 'Plin', 'yape'));
    else if (debit) result.push(badge(ICONS.card, 'Débito', 'debit'));
    else if (transfer) result.push(badge(ICONS.transfer, 'Transferencia', 'transfer'));
    else if (cash) result.push(badge(ICONS.cash, 'Efectivo', 'cash'));

    if (telegram) result.push(badge(ICONS.telegram, 'Telegram', 'telegram'));
    return result.join('');
  }

  function paymentMethodLabel(item = {}) {
    if (isCardPayment(item)) return 'Pago de tarjeta';
    if (isLoanPayment(item)) return 'Pago de préstamo';
    const source = sourceText(item);
    if (item.medio === 'tarjeta' || item.tarjetaNombre) return item.tarjetaNombre || 'Tarjeta de crédito';
    if (source.includes('yape')) return 'Yape';
    if (source.includes('plin')) return 'Plin';
    if (source.includes('debito') || source.includes('débito')) return 'Tarjeta de débito';
    if (source.includes('transfer')) return 'Transferencia';
    if (source.includes('efectivo')) return 'Efectivo';
    return '';
  }

  function movementMarkup(item = {}) {
    const id = escapeHTML(item.id || '');
    const category = categoryData(item);
    const badges = movementBadges(item);
    return `
      <article class="hf-v28-movement cat-${category.key}" data-movement-id="${id}" tabindex="0" role="button" aria-label="Ver detalle de ${escapeHTML(movementTitle(item))}">
        <span class="hf-v28-movement-icon">${category.icon}</span>
        <div class="hf-v28-movement-copy">
          <strong>${escapeHTML(movementTitle(item))}</strong>
          <span>${escapeHTML(category.label)}${item.fecha ? ` · ${escapeHTML(formatDate(item.fecha))}` : ''}</span>
        </div>
        <div class="hf-v28-movement-amount">
          <strong>${money(item.monto)}</strong>
          <span>${escapeHTML(personName(item.quien))}</span>
        </div>
        ${badges ? `<div class="hf-v28-movement-badges">${badges}</div>` : '<div class="hf-v28-movement-badges is-empty"></div>'}
        <div class="hf-v28-movement-menu-wrap">
          <button type="button" class="hf-v28-movement-more" aria-label="Opciones" aria-expanded="false">${ICONS.more}</button>
          <div class="hf-v28-movement-menu">
            ${isCardPayment(item) || isLoanPayment(item) ? '' : `<button type="button" data-action="edit">${ICONS.edit}<span>Editar</span></button>`}
            <button type="button" class="danger" data-action="delete">${ICONS.trash}<span>Eliminar</span></button>
          </div>
        </div>
      </article>`;
  }

  function sortedMovements(list = []) {
    return [...list].sort((a, b) => {
      const byDate = String(b.fecha || '').localeCompare(String(a.fecha || ''));
      return byDate || movementTimestamp(b) - movementTimestamp(a);
    });
  }

  function activeFilter() {
    return state.filter || document.querySelector('.expense-filter.active')?.dataset.filter || 'todos';
  }

  function filteredMovements(list = state.movements) {
    const filter = activeFilter();
    if (filter === 'yo' || filter === 'pareja') return list.filter(item => item.quien === filter);
    if (filter === 'hoy') {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      return list.filter(item => item.fecha === today);
    }
    if (filter === 'semana') {
      const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      const today = new Date(`${todayISO}T12:00:00`);
      const start = new Date(today);
      start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      return list.filter(item => {
        const date = new Date(`${item.fecha || ''}T12:00:00`);
        return !Number.isNaN(date.getTime()) && date >= start && date <= today;
      });
    }
    return list;
  }

  function renderSummary() {
    const container = $('expenseList');
    if (!container) return;
    const list = filteredMovements();
    if (!list.length) {
      container.innerHTML = '<div class="empty-state hf-v28-empty">No hay movimientos para este filtro.</div>';
      return;
    }
    const visible = list.slice(0, 5);
    container.innerHTML = visible.map(movementMarkup).join('') + (list.length > 5 ? `
      <div class="ver-todo-container hf-v28-view-all">
        <button type="button" class="btn-ver-todo" data-v28-open-history>Ver todos los movimientos de ${escapeHTML($('month-display')?.textContent || '')}</button>
      </div>` : '');
  }

  function receiveMovements(list, cfg = {}) {
    state.movements = sortedMovements(Array.isArray(list) ? list : []);
    state.config = cfg || state.config || {};
    renderSummary();
  }

  async function reloadMovements() {
    if (!window.DB?.getGastos) return;
    const month = parseDisplayedMonth();
    state.currentMonth = month;
    const [list, cfg] = await Promise.all([
      window.DB.getGastos(month),
      window.DB.getConfig?.().catch(() => null)
    ]);
    receiveMovements(list || [], cfg || state.config || {});
  }

  function renderHistory() {
    const container = $('listaCompletaGastos');
    if (!container) return;
    const query = normalize(state.historyQuery);
    const list = filteredMovements(state.movements).filter(item => {
      if (!query) return true;
      return normalize([
        movementTitle(item), categoryData(item).label, item.tarjetaNombre,
        item.prestamoNombre, item.nota, personName(item.quien), sourceText(item)
      ].filter(Boolean).join(' ')).includes(query);
    });
    container.innerHTML = list.length
      ? list.map(movementMarkup).join('')
      : '<div class="empty-state hf-v28-empty">No hay movimientos que coincidan con la búsqueda.</div>';
    const noResults = $('historial-no-resultados');
    if (noResults) noResults.style.display = 'none';
  }

  async function openHistory() {
    await reloadMovements();
    state.historyQuery = '';
    const search = $('historial-search');
    if (search) search.value = '';
    const clear = $('historial-search-clear');
    if (clear) clear.style.display = 'none';
    const title = $('historialTitle');
    if (title) title.textContent = `Movimientos de ${$('month-display')?.textContent || ''}`;
    renderHistory();
    window.openModal?.('modalHistorial');
  }

  function filterHistory() {
    state.historyQuery = String($('historial-search')?.value || '');
    const clear = $('historial-search-clear');
    if (clear) clear.style.display = state.historyQuery ? 'grid' : 'none';
    renderHistory();
  }

  function clearHistorySearch() {
    const search = $('historial-search');
    if (search) search.value = '';
    state.historyQuery = '';
    const clear = $('historial-search-clear');
    if (clear) clear.style.display = 'none';
    renderHistory();
    search?.focus();
  }

  function detailRow(icon, label, value) {
    if (value === null || value === undefined || value === '') return '';
    return `<div class="hf-v28-detail-row"><span>${icon}</span><div><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong></div></div>`;
  }

  function ensureDetailModal() {
    let modal = $('hfMovementDetailModal');
    if (!modal) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="hfMovementDetailModal" onclick="closeModalOutside(event,'hfMovementDetailModal')">
          <div class="modal-sheet hf-v28-detail-sheet" style="position:relative;">
            <button class="modal-close" type="button" onclick="closeModal('hfMovementDetailModal')">✕</button>
            <div class="modal-handle"></div>
            <div class="hf-v28-detail-hero">
              <span id="hf-v27-detail-icon" class="hf-v28-detail-icon"></span>
              <div><small id="hf-v27-detail-type">Movimiento</small><h2 id="hf-v27-detail-title">Detalle</h2><strong id="hf-v27-detail-amount">S/ 0.00</strong></div>
            </div>
            <div id="hf-v27-detail-badges" class="hf-v28-detail-badges"></div>
            <div id="hf-v27-detail-content" class="hf-v28-detail-content"></div>
          </div>
        </div>`);
      modal = $('hfMovementDetailModal');
    }
    modal?.querySelector('.modal-sheet')?.classList.add('hf-v28-detail-sheet');
    modal?.querySelector('#hf-v27-detail-icon')?.classList.add('hf-v28-detail-icon');
    modal?.querySelector('#hf-v27-detail-badges')?.classList.add('hf-v28-detail-badges');
    modal?.querySelector('#hf-v27-detail-content')?.classList.add('hf-v28-detail-content');
    return modal;
  }

  function openMovementDetail(id) {
    const item = state.movements.find(movement => String(movement.id) === String(id));
    if (!item) return;
    ensureDetailModal();
    const category = categoryData(item);
    $('hf-v27-detail-icon').innerHTML = category.icon;
    $('hf-v27-detail-icon').className = `hf-v27-detail-icon hf-v28-detail-icon cat-${category.key}`;
    $('hf-v27-detail-type').textContent = isCardPayment(item)
      ? 'Pago de tarjeta'
      : isLoanPayment(item) ? 'Pago de préstamo' : category.label;
    $('hf-v27-detail-title').textContent = movementTitle(item);
    $('hf-v27-detail-amount').textContent = money(item.monto);
    $('hf-v27-detail-badges').innerHTML = movementBadges(item);

    const method = paymentMethodLabel(item);
    const rows = [
      detailRow(ICONS.category, 'Categoría', category.label),
      detailRow(ICONS.calendar, 'Fecha', formatDate(item.fecha)),
      detailRow(ICONS.person, 'Registrado por', personName(item.quien)),
      method ? detailRow(ICONS.cash, 'Medio de pago', method) : '',
      item.tarjetaNombre ? detailRow(ICONS.card, 'Tarjeta', item.tarjetaNombre) : '',
      item.prestamoNombre ? detailRow(ICONS.loanPayment, 'Préstamo', item.prestamoNombre) : '',
      item.nota ? detailRow(ICONS.note, 'Nota', item.nota) : '',
      item.fuente ? detailRow(ICONS.telegram, 'Origen', normalize(item.fuente) === 'telegram' ? 'Telegram' : item.fuente) : '',
      item.creadoEn ? detailRow(ICONS.calendar, 'Registrado', new Date(movementTimestamp(item)).toLocaleString('es-PE')) : ''
    ].filter(Boolean);
    $('hf-v27-detail-content').innerHTML = rows.join('');
    window.openModal?.('hfMovementDetailModal');
  }

  function closeMovementMenus(except = null) {
    document.querySelectorAll('.hf-v28-movement-menu.open').forEach(menu => {
      if (menu === except) return;
      menu.classList.remove('open');
      menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
    });
  }

  function handleMovementClick(event) {
    const viewAll = event.target.closest('[data-v28-open-history]');
    if (viewAll) {
      event.preventDefault();
      openHistory();
      return;
    }

    const card = event.target.closest('.hf-v28-movement');
    if (!card) return;
    const id = card.dataset.movementId;
    const more = event.target.closest('.hf-v28-movement-more');
    if (more) {
      event.stopPropagation();
      const menu = more.nextElementSibling;
      const willOpen = !menu.classList.contains('open');
      closeMovementMenus(menu);
      menu.classList.toggle('open', willOpen);
      more.setAttribute('aria-expanded', String(willOpen));
      return;
    }

    const action = event.target.closest('[data-action]');
    if (action) {
      event.stopPropagation();
      closeMovementMenus();
      if (action.dataset.action === 'edit') window.abrirEditarGasto?.(id);
      if (action.dataset.action === 'delete') window.eliminarGasto?.(id);
      return;
    }
    if (!event.target.closest('.hf-v28-movement-menu')) openMovementDetail(id);
  }

  function setFilter(filter, button) {
    state.filter = filter || 'todos';
    document.querySelectorAll('.expense-filter').forEach(item => {
      item.classList.toggle('active', item === button || item.dataset.filter === state.filter);
    });
    renderSummary();
  }

  function removeQuickExpenseUI() {
    document.querySelectorAll('#page-gastos button, #gastoChoiceModal button').forEach(button => {
      if (normalize(button.textContent).includes('gasto rapido')) button.remove();
    });
    const modal = $('gastoChoiceModal');
    const help = modal?.querySelector('.hf-action-sheet-help');
    if (help) help.textContent = 'Registra el movimiento con su descripción, fecha, categoría y medio de pago.';
    const detailed = [...(modal?.querySelectorAll('.hf-action-row') || [])]
      .find(button => normalize(button.textContent).includes('gasto detallado'));
    if (detailed) detailed.classList.add('featured');
  }

  function openDetailedExpense() {
    try { window.closeModal?.('gastoChoiceModal'); } catch (_) {}
    if (typeof window.openGastoModal === 'function') return window.openGastoModal();
    return window.openModal?.('gastoModal');
  }

  function currentTab() {
    try {
      if (typeof activeTab !== 'undefined') return activeTab;
    } catch (_) {}
    return window.activeTab || '';
  }

  function v28FabHandler() {
    if (currentTab() === 'gastos') {
      try { window.vibrar?.(); } catch (_) {}
      return openDetailedExpense();
    }
    return typeof state.fabFallback === 'function' ? state.fabFallback() : undefined;
  }

  function installFabOverride() {
    if (window.handleFabClick !== v28FabHandler) {
      if (!state.fabFallback || state.fabFallback === v28FabHandler) state.fabFallback = window.handleFabClick;
      window.handleFabClick = v28FabHandler;
    }
    window.openGastoChoiceModal = openDetailedExpense;
    window.openGastoRapidoModal = openDetailedExpense;
  }

  function removeDebtQuickPayments() {
    const modal = $('hfDebtAdminModal');
    if (!modal) return;
    modal.querySelector('.hf-debt-admin-separator')?.remove();
    modal.querySelector('#hf-admin-card-actions')?.remove();
  }

  function avatarUrl(seed, size = 112) {
    return `https://api.dicebear.com/10.x/micah/svg?seed=${encodeURIComponent(seed || 'Hogar Finanzas')}&size=${size}&backgroundColor=dbeafe,e0e7ff,fce7f3,d1fae5&borderRadius=50`;
  }

  function updateAvatarImages(seed) {
    const url128 = avatarUrl(seed, 128);
    const url96 = avatarUrl(seed, 96);
    const home = document.querySelector('#hf-v27-home-profile img');
    const settings = document.querySelector('#hf-v27-avatar-settings img');
    const profile = document.querySelector('#aj-perfil-avatar img');
    if (home) home.src = url128;
    if (settings) settings.src = url96;
    if (profile) profile.src = url96;
  }

  async function saveAvatarV28() {
    if (state.avatarSaving) return;
    const selected = document.querySelector('#hf-v27-avatar-grid .hf-v27-avatar-option.selected')?.dataset.avatarSeed
      || document.querySelector('#hf-v27-avatar-grid [aria-pressed="true"]')?.dataset.avatarSeed;
    if (!selected) return window.showToast?.('Selecciona un avatar.', 'error');

    const button = $('hf-v27-save-avatar');
    state.avatarSaving = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'Guardando…';
    }
    updateAvatarImages(selected);

    try {
      const raw = await window.DB?.getConfig?.() || {};
      const cfg = typeof window.normalizarConfigIdentidad === 'function'
        ? window.normalizarConfigIdentidad(raw)
        : raw;
      const storedId = localStorage.getItem('miembroActualId');
      const legacy = localStorage.getItem('miUsuarioTipo');
      const memberId = storedId || (legacy === 'pareja' ? cfg.miembroParejaId : cfg.miembroPrincipalId) || 'usuario';
      const members = { ...(cfg.miembros || {}) };
      const fallbackName = legacy === 'pareja' ? (cfg.nombreElla || 'Sydney') : (cfg.nombreYo || 'Christian');
      const current = members[memberId] || { id: memberId, nombre: fallbackName, legacyTipo: legacy || 'yo' };
      members[memberId] = { ...current, avatarMicahSeed: selected };
      await window.DB.updateConfig({ miembros: members });
      state.config = { ...cfg, miembros: members };
      try {
        if (typeof configCache !== 'undefined') configCache = { ...cfg, miembros: members };
      } catch (_) {}
      await window.HFExperienciaIntegrada27?.updateAvatarUI?.();
      window.closeModal?.('hfAvatarModal');
      window.showToast?.('Avatar actualizado');
    } catch (error) {
      console.error('No se pudo guardar el avatar:', error);
      window.showToast?.('No se pudo guardar el avatar. Intenta nuevamente.', 'error');
      await window.HFExperienciaIntegrada27?.updateAvatarUI?.();
    } finally {
      state.avatarSaving = false;
      if (button) {
        button.disabled = false;
        button.textContent = 'Guardar avatar';
      }
    }
  }

  function handleCaptureClick(event) {
    if (!event.target.closest('#hf-v27-save-avatar')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    saveAvatarV28();
  }

  function handleDocumentClick(event) {
    if (event.target.closest('#expenseList, #listaCompletaGastos')) handleMovementClick(event);
    else closeMovementMenus();
  }

  function handleDocumentKey(event) {
    if (event.key === 'Escape') closeMovementMenus();
    const card = event.target.closest('.hf-v28-movement');
    if (card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openMovementDetail(card.dataset.movementId);
    }
  }

  function installHistoryInput() {
    const input = $('historial-search');
    if (!input || input.dataset.hfV28Input === VERSION) return;
    input.dataset.hfV28Input = VERSION;
    input.addEventListener('input', event => {
      event.stopImmediatePropagation();
      filterHistory();
    }, true);
  }

  function installOverrides() {
    window.renderGastos = receiveMovements;
    window.generarGastoHTML = movementMarkup;
    window.abrirHistorialCompleto = openHistory;
    window.filtrarHistorial = filterHistory;
    window.limpiarBusquedaHistorial = clearHistorySearch;
    window.setFiltroGastos = setFilter;
    installFabOverride();
  }

  function repair() {
    installOverrides();
    installHistoryInput();
    removeQuickExpenseUI();
    removeDebtQuickPayments();

    const summary = $('expenseList');
    if (summary && (summary.querySelector('.hf-v27-movement, .expense-item') || !summary.querySelector('.hf-v28-movement') && state.movements.length)) {
      renderSummary();
    }
    const history = $('listaCompletaGastos');
    if (history && $('modalHistorial')?.classList.contains('open') && (history.querySelector('.hf-v27-movement, .expense-item') || !history.querySelector('.hf-v28-movement') && state.movements.length)) {
      renderHistory();
    }
    document.body?.classList.add('hf-experiencia-integrada-v28');
  }

  function scheduleRepair() {
    clearTimeout(state.repairTimer);
    state.repairTimer = setTimeout(repair, 70);
  }

  function scheduleReload() {
    clearTimeout(state.reloadTimer);
    state.reloadTimer = setTimeout(reloadMovements, 120);
  }

  function start() {
    installOverrides();
    removeQuickExpenseUI();
    reloadMovements();
    repair();

    document.addEventListener('click', handleCaptureClick, true);
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleDocumentKey);
    installHistoryInput();

    const month = $('month-display');
    if (month) new MutationObserver(scheduleReload).observe(month, { childList: true, characterData: true, subtree: true });

    state.observer = new MutationObserver(scheduleRepair);
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });

    ['hf:gastos-actualizados','hf:deuda-actualizada','hf:deudas-core-actualizadas','hf:estado-cuenta-confirmado']
      .forEach(name => window.addEventListener(name, () => {
        scheduleRepair();
        scheduleReload();
      }));

    let retries = 0;
    const stabilizer = setInterval(() => {
      repair();
      retries += 1;
      if (retries >= 60) clearInterval(stabilizer);
    }, 300);
  }

  window.HFExperienciaIntegrada28 = Object.freeze({
    version: VERSION,
    repair,
    reloadMovements,
    openHistory,
    openMovementDetail,
    saveAvatar: saveAvatarV28
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

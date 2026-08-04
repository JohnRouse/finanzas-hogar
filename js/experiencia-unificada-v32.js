(() => {
  'use strict';

  const VERSION = '32.0';
  if (window.HFExperienciaUnificada?.version === VERSION) return;

  const state = {
    movements: [],
    config: {},
    filter: 'todos',
    historyQuery: '',
    activeMemberId: '',
    selectedAvatarSeed: '',
    avatarSaving: false,
    originalFabHandler: typeof window.handleFabClick === 'function' ? window.handleFabClick : null
  };

  const $ = id => document.getElementById(id);
  const normalize = (value = '') => String(value).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => `S/ ${number(value).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  const ICONS = {
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18"></path><path d="M7 15h3"></path></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-7.3 18-4.2-7.2L3 10.6 21 3Z"></path><path d="m9.5 13.8 4.4-4.1"></path></svg>',
    cash: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><path d="M6 9h.01M18 15h.01"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    transfer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h15"></path><path d="m16 5 3 3-3 3"></path><path d="M20 16H5"></path><path d="m8 13-3 3 3 3"></path></svg>',
    cardPayment: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="3"></rect><path d="M3 9h18"></path><path d="m12 14 3 3 3-3"></path><path d="M15 12v7"></path></svg>',
    loanPayment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-5 9 5"></path><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>',
    person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
    category: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"></path></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5z"></path><path d="M8 8h8M8 12h8M8 16h5"></path></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 15H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>'
  };

  const AVATAR_SEEDS = [
    'Luna tranquila', 'Cielo amable', 'Menta feliz', 'Sol de casa',
    'Nube serena', 'Azul hogar', 'Brisa suave', 'Mora alegre',
    'Rio claro', 'Dia bonito', 'Violeta calma', 'Mar en casa'
  ];

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'No registrada';
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function movementTimestamp(item = {}) {
    const value = item.creadoEn;
    if (value?.toMillis) return value.toMillis();
    if (value?.toDate) return value.toDate().getTime();
    if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
    return Date.parse(value || item.fecha || '') || 0;
  }

  function sortMovements(list = []) {
    return [...list].sort((a, b) => {
      const byDate = String(b.fecha || '').localeCompare(String(a.fecha || ''));
      return byDate || movementTimestamp(b) - movementTimestamp(a);
    });
  }

  function syncLegacyCaches() {
    try {
      gastosDelMesCache = [...state.movements];
      configCache = state.config || {};
      filtroGastosActivo = state.filter;
    } catch (error) {
      console.warn('No se pudo sincronizar la caché de movimientos:', error);
    }
  }

  function personName(value) {
    if (value === 'pareja') return state.config?.nombreElla || 'Sydney';
    if (value === 'ambos') return 'Ambos';
    return state.config?.nombreYo || 'Christian';
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
    if (isCardPayment(item)) return { key: 'debt', label: 'Pago de tarjeta', icon: '💳' };
    if (isLoanPayment(item)) return { key: 'debt', label: 'Pago de préstamo', icon: '🏦' };

    const original = item.cat || item.categoria || 'Otros';
    const category = normalize(original);
    if (category.includes('aliment')) return { key: 'food', label: 'Alimentación', icon: '🛒' };
    if (category.includes('servicio')) return { key: 'services', label: 'Servicios', icon: '⚡' };
    if (category.includes('entret') || category.includes('ocio')) return { key: 'entertainment', label: 'Entretenimiento', icon: '🎬' };
    if (category.includes('transport')) return { key: 'transport', label: 'Transporte', icon: '🚕' };
    if (category.includes('salud') || category.includes('medic')) return { key: 'health', label: 'Salud', icon: '💊' };
    if (category.includes('hogar') || category.includes('casa')) return { key: 'home', label: 'Hogar', icon: '🏠' };
    if (category.includes('educ')) return { key: 'education', label: 'Educación', icon: '🎓' };
    if (category.includes('deuda')) return { key: 'debt', label: 'Deudas', icon: '💳' };
    return { key: 'other', label: original || 'Otros', icon: '📦' };
  }

  function shortCardName(value = '') {
    return String(value || 'Tarjeta')
      .replace(/^tarjeta\s+/i, '')
      .replace(/^visa\s+/i, '')
      .replace(/^mastercard\s+/i, '')
      .trim() || 'Tarjeta';
  }

  function badge(icon, label, kind, title = label) {
    return `<span class="hf-v28-method-badge ${kind}" title="${escapeHTML(title)}"><span class="hf-v28-badge-icon">${icon}</span><span class="hf-v28-badge-label">${escapeHTML(label)}</span></span>`;
  }

  function movementBadges(item = {}) {
    const source = sourceText(item);
    const badges = [];
    const telegram = source.includes('telegram') || normalize(item.fuente) === 'telegram';
    const yape = source.includes('yape') || /\byape\b/i.test(item.desc || '');
    const plin = source.includes('plin');
    const card = !isCardPayment(item) && !isLoanPayment(item)
      && (item.medio === 'tarjeta' || !!item.tarjetaId || !!item.tarjetaNombre);
    const debit = source.includes('debito') || source.includes('débito');
    const transfer = source.includes('transfer');
    const cash = source.includes('efectivo') || source.includes('cash');

    if (isCardPayment(item)) badges.push(badge(ICONS.cardPayment, 'Pago de tarjeta', 'payment'));
    else if (isLoanPayment(item)) badges.push(badge(ICONS.loanPayment, 'Pago de préstamo', 'payment'));
    else if (card) {
      const full = item.tarjetaNombre || 'Tarjeta';
      badges.push(badge(ICONS.card, shortCardName(full), 'method-card', full));
    } else if (yape) badges.push(badge('<span class="hf-v28-yape-letter">Y</span>', 'Yape', 'yape'));
    else if (plin) badges.push(badge(ICONS.transfer, 'Plin', 'transfer'));
    else if (debit) badges.push(badge(ICONS.card, 'Débito', 'debit'));
    else if (transfer) badges.push(badge(ICONS.transfer, 'Transferencia', 'transfer'));
    else if (cash || !source) badges.push(badge(ICONS.cash, 'Efectivo', 'cash'));

    if (telegram) badges.push(badge(ICONS.telegram, 'Telegram', 'telegram'));
    return badges.join('');
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
    return 'Efectivo';
  }

  function movementMarkup(item = {}) {
    const category = categoryData(item);
    const id = escapeHTML(item.id || '');
    const badges = movementBadges(item);
    return `
      <article class="hf-v28-movement hf-v32-movement cat-${category.key}" data-movement-id="${id}" tabindex="0" role="button" aria-label="Ver detalle de ${escapeHTML(movementTitle(item))}">
        <span class="hf-v28-movement-icon hf-v29-classic-category"><span class="hf-v32-category-glyph" aria-hidden="true">${category.icon}</span></span>
        <div class="hf-v28-movement-copy">
          <strong>${escapeHTML(movementTitle(item))}</strong>
          <span>${escapeHTML(category.label)}${item.fecha ? ` · ${escapeHTML(formatDate(item.fecha))}` : ''}</span>
        </div>
        <div class="hf-v28-movement-amount"><strong>${money(item.monto)}</strong><span>${escapeHTML(personName(item.quien))}</span></div>
        <div class="hf-v28-movement-badges">${badges}</div>
        <div class="hf-v28-movement-menu-wrap">
          <button type="button" class="hf-v28-movement-more" aria-label="Opciones" aria-expanded="false">${ICONS.more}</button>
          <div class="hf-v28-movement-menu">
            ${isCardPayment(item) || isLoanPayment(item) ? '' : `<button type="button" data-action="edit">${ICONS.edit}<span>Editar</span></button>`}
            <button type="button" class="danger" data-action="delete">${ICONS.trash}<span>Eliminar</span></button>
          </div>
        </div>
      </article>`;
  }

  function filteredMovements(list = state.movements) {
    const filter = state.filter || 'todos';
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
        <button type="button" class="btn-ver-todo" data-v32-open-history>Ver todos los movimientos</button>
      </div>` : '');
  }

  function renderGastosUnified(list, cfg = {}) {
    state.movements = sortMovements(Array.isArray(list) ? list : []);
    state.config = cfg || state.config || {};
    syncLegacyCaches();
    renderSummary();
  }

  async function reloadMovements() {
    if (!window.DB?.getGastos) return;
    let month;
    try { month = mesActual; } catch (_) { month = window.DB.getMesActual?.(); }
    const [list, cfg] = await Promise.all([
      window.DB.getGastos(month || window.DB.getMesActual()),
      window.DB.getConfig?.().catch(() => null)
    ]);
    renderGastosUnified(list || [], cfg || state.config || {});
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
    const empty = $('historial-no-resultados');
    if (empty) empty.style.display = 'none';
  }

  async function openHistory() {
    await reloadMovements();
    state.historyQuery = '';
    if ($('historialTitle')) $('historialTitle').textContent = 'Movimientos';
    if ($('historial-search')) $('historial-search').value = '';
    if ($('historial-search-clear')) $('historial-search-clear').style.display = 'none';
    renderHistory();
    window.openModal?.('modalHistorial');
  }

  function filterHistory(query = '') {
    state.historyQuery = String(query || $('historial-search')?.value || '');
    if ($('historial-search-clear')) $('historial-search-clear').style.display = state.historyQuery ? 'grid' : 'none';
    renderHistory();
  }

  function clearHistorySearch() {
    if ($('historial-search')) {
      $('historial-search').value = '';
      $('historial-search').focus();
    }
    state.historyQuery = '';
    if ($('historial-search-clear')) $('historial-search-clear').style.display = 'none';
    renderHistory();
  }

  function setFilter(filter, button) {
    state.filter = filter || 'todos';
    document.querySelectorAll('.expense-filter').forEach(item => item.classList.toggle('active', item === button));
    syncLegacyCaches();
    renderSummary();
  }

  function detailRow(icon, label, value) {
    if (value === null || value === undefined || value === '') return '';
    return `<div class="hf-v28-detail-row"><span>${icon}</span><div><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong></div></div>`;
  }

  function ensureDetailModal() {
    let modal = $('hfMovementDetailModal');
    if (modal) return modal;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfMovementDetailModal" onclick="closeModalOutside(event,'hfMovementDetailModal')">
        <div class="modal-sheet hf-v28-detail-sheet" style="position:relative;">
          <button class="modal-close" type="button" onclick="closeModal('hfMovementDetailModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="hf-v28-detail-hero">
            <span id="hf-v32-detail-icon" class="hf-v28-detail-icon"></span>
            <div><small id="hf-v32-detail-type">Movimiento</small><h2 id="hf-v32-detail-title">Detalle</h2><strong id="hf-v32-detail-amount">S/ 0.00</strong></div>
          </div>
          <div id="hf-v32-detail-badges" class="hf-v28-detail-badges"></div>
          <div id="hf-v32-detail-content" class="hf-v28-detail-content"></div>
        </div>
      </div>`);
    return $('hfMovementDetailModal');
  }

  function openMovementDetail(id) {
    const item = state.movements.find(movement => String(movement.id) === String(id));
    if (!item) return;
    ensureDetailModal();
    const category = categoryData(item);
    $('hf-v32-detail-icon').className = `hf-v28-detail-icon cat-${category.key}`;
    $('hf-v32-detail-icon').innerHTML = `<span class="hf-v32-category-glyph" aria-hidden="true">${category.icon}</span>`;
    $('hf-v32-detail-type').textContent = category.label;
    $('hf-v32-detail-title').textContent = movementTitle(item);
    $('hf-v32-detail-amount').textContent = money(item.monto);
    $('hf-v32-detail-badges').innerHTML = movementBadges(item);

    const method = paymentMethodLabel(item);
    $('hf-v32-detail-content').innerHTML = [
      detailRow(ICONS.category, 'Categoría', category.label),
      detailRow(ICONS.calendar, 'Fecha', formatDate(item.fecha)),
      detailRow(ICONS.person, 'Registrado por', personName(item.quien)),
      detailRow(ICONS.cash, 'Medio de pago', method),
      item.tarjetaNombre ? detailRow(ICONS.card, 'Tarjeta', item.tarjetaNombre) : '',
      item.prestamoNombre ? detailRow(ICONS.loanPayment, 'Préstamo', item.prestamoNombre) : '',
      item.nota ? detailRow(ICONS.note, 'Nota', item.nota) : '',
      item.fuente ? detailRow(ICONS.telegram, 'Origen', normalize(item.fuente) === 'telegram' ? 'Telegram' : item.fuente) : '',
      item.creadoEn ? detailRow(ICONS.calendar, 'Registrado', new Date(movementTimestamp(item)).toLocaleString('es-PE')) : ''
    ].filter(Boolean).join('');
    window.openModal?.('hfMovementDetailModal');
  }

  function closeMenus(except = null) {
    document.querySelectorAll('.hf-v28-movement-menu.open').forEach(menu => {
      if (menu === except) return;
      menu.classList.remove('open');
      menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
    });
  }

  async function editMovement(id) {
    syncLegacyCaches();
    if (!state.movements.some(item => String(item.id) === String(id))) await reloadMovements();
    syncLegacyCaches();
    if (typeof window.abrirEditarGasto === 'function') return window.abrirEditarGasto(String(id));
    window.showToast?.('El formulario de edición no está disponible.', 'error');
  }

  function handleMovementClick(event) {
    const openAll = event.target.closest('[data-v32-open-history]');
    if (openAll) {
      event.preventDefault();
      openHistory();
      return true;
    }

    const movement = event.target.closest('.hf-v32-movement');
    if (!movement) return false;
    const id = movement.dataset.movementId;
    const more = event.target.closest('.hf-v28-movement-more');
    if (more) {
      event.preventDefault();
      event.stopPropagation();
      const menu = more.nextElementSibling;
      const opening = !menu.classList.contains('open');
      closeMenus(menu);
      menu.classList.toggle('open', opening);
      more.setAttribute('aria-expanded', String(opening));
      return true;
    }

    const action = event.target.closest('[data-action]');
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      closeMenus();
      if (action.dataset.action === 'edit') editMovement(id);
      else if (action.dataset.action === 'delete') window.eliminarGasto?.(String(id));
      return true;
    }

    if (!event.target.closest('.hf-v28-movement-menu')) openMovementDetail(id);
    return true;
  }

  function removeQuickExpenseUI() {
    document.querySelectorAll('#page-gastos button, #gastoChoiceModal button').forEach(button => {
      if (normalize(button.textContent).includes('gasto rapido')) button.remove();
    });
  }

  function removeDebtQuickPayments() {
    $('hfDebtAdminModal')?.querySelector('.hf-debt-admin-separator')?.remove();
    $('hfDebtAdminModal')?.querySelector('#hf-admin-card-actions')?.remove();
  }

  function wrapperFor(input) {
    return input?.closest('.hf-v27-payment-available, .form-group, .input-group, .field-group, .input-row, .form-row') || input?.parentElement;
  }

  function normalizePaymentModal() {
    const modal = $('pagoTarjetaModal');
    if (!modal) return;
    const availableInputs = [...modal.querySelectorAll('#pago-disponible-banco')];
    if (availableInputs.length) {
      const preferred = availableInputs.find(input => input.closest('.hf-v27-payment-available')) || availableInputs.at(-1);
      availableInputs.forEach(input => {
        if (input !== preferred) wrapperFor(input)?.remove();
      });
      const availableWrapper = wrapperFor(preferred);
      availableWrapper?.classList.add('hf-v27-payment-available');
      const label = availableWrapper?.querySelector('label');
      if (label) label.textContent = 'Línea disponible después del pago (opcional)';
      const noteInput = modal.querySelector('#pago-nota, [name="nota"]');
      const noteWrapper = wrapperFor(noteInput);
      if (noteWrapper && availableWrapper && noteWrapper.nextElementSibling !== availableWrapper) {
        noteWrapper.after(availableWrapper);
      }
    }
  }

  function currentPageIsMovements() {
    return $('page-gastos')?.classList.contains('active');
  }

  function openDetailedExpense() {
    try { window.closeModal?.('gastoChoiceModal'); } catch (_) {}
    if (typeof window.openGastoModal === 'function') return window.openGastoModal();
    return window.openModal?.('gastoModal');
  }

  function unifiedFabHandler() {
    if (currentPageIsMovements()) {
      try { window.vibrar?.(); } catch (_) {}
      return openDetailedExpense();
    }
    return state.originalFabHandler?.();
  }

  function avatarUrl(seed, size = 112) {
    return `https://api.dicebear.com/10.x/micah/svg?seed=${encodeURIComponent(seed || 'Hogar Finanzas')}&size=${size}&backgroundColor=dbeafe,e0e7ff,fce7f3,d1fae5&borderRadius=50`;
  }

  async function profileContext() {
    const raw = await window.DB?.getConfig?.() || {};
    const cfg = typeof window.normalizarConfigIdentidad === 'function' ? window.normalizarConfigIdentidad(raw) : raw;
    let member = typeof window.obtenerMiembroActual === 'function' ? window.obtenerMiembroActual(cfg) : null;
    const storedId = localStorage.getItem('miembroActualId');
    const legacy = localStorage.getItem('miUsuarioTipo');
    const id = member?.id || storedId || (legacy === 'pareja' ? cfg.miembroParejaId : cfg.miembroPrincipalId) || 'usuario';
    member = member || cfg.miembros?.[id] || {
      id,
      nombre: legacy === 'pareja' ? (cfg.nombreElla || 'Sydney') : (cfg.nombreYo || 'Christian'),
      legacyTipo: legacy || 'yo'
    };
    return { cfg, member, id, seed: member.avatarMicahSeed || `${id}-${member.nombre}` };
  }

  function ensureHomeProfile() {
    const page = $('page-resumen');
    const grid = page?.querySelector('.month-money-grid');
    if (!page || !grid) return null;
    let profile = $('hf-v27-home-profile');
    if (!profile) {
      grid.insertAdjacentHTML('beforebegin', `
        <section id="hf-v27-home-profile" class="hf-v27-home-profile">
          <button type="button" class="hf-v27-home-avatar" data-v32-open-avatar aria-label="Cambiar avatar"><img alt="Avatar del perfil"></button>
          <div><small>Tu resumen del mes</small><strong id="hf-v32-home-greeting">Hola</strong><span>Así van tus finanzas en este mes.</span></div>
        </section>`);
      profile = $('hf-v27-home-profile');
    }
    return profile;
  }

  function ensureAvatarSetting() {
    const profileCard = document.querySelector('#ajustesModal .settings-profile-card');
    if (!profileCard) return null;
    let setting = $('hf-v27-avatar-settings');
    if (!setting) {
      profileCard.insertAdjacentHTML('afterend', `
        <button type="button" id="hf-v27-avatar-settings" class="hf-v27-avatar-settings" data-v32-open-avatar>
          <span class="hf-v27-settings-avatar"><img alt="Avatar Micah"></span>
          <span><small>Personalización</small><strong>Avatar del perfil</strong><em>Elige cómo aparecerás en el Resumen.</em></span>
          <b aria-hidden="true">›</b>
        </button>`);
      setting = $('hf-v27-avatar-settings');
    }
    return setting;
  }

  function ensureAvatarModal() {
    let modal = $('hfAvatarModal');
    if (modal) return modal;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfAvatarModal" onclick="closeModalOutside(event,'hfAvatarModal')">
        <div class="modal-sheet hf-v27-avatar-sheet" style="position:relative;">
          <button class="modal-close" type="button" onclick="closeModal('hfAvatarModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="modal-title">Elige tu avatar</div>
          <p class="hf-v27-avatar-intro">Selecciona un avatar Micah para este integrante del hogar.</p>
          <div id="hf-v27-avatar-grid" class="hf-v27-avatar-grid">
            ${AVATAR_SEEDS.map(seed => `<button type="button" class="hf-v27-avatar-option" data-avatar-seed="${escapeHTML(seed)}" aria-pressed="false"><img src="${avatarUrl(seed, 96)}" alt="Opción de avatar"></button>`).join('')}
          </div>
          <button type="button" id="hf-v27-save-avatar" class="modal-btn primary">Guardar avatar</button>
          <small class="hf-v27-avatar-credit">Avatares Micah generados con DiceBear.</small>
        </div>
      </div>`);
    return $('hfAvatarModal');
  }

  async function updateAvatarUI() {
    try {
      const context = await profileContext();
      state.activeMemberId = context.id;
      state.selectedAvatarSeed = context.seed;
      state.config = context.cfg || state.config;
      const profile = ensureHomeProfile();
      const setting = ensureAvatarSetting();
      const url = avatarUrl(context.seed, 128);
      profile?.querySelector('img')?.setAttribute('src', url);
      if ($('hf-v32-home-greeting')) $('hf-v32-home-greeting').textContent = `Hola, ${context.member.nombre}`;
      setting?.querySelector('img')?.setAttribute('src', avatarUrl(context.seed, 96));
      const settingsProfile = document.querySelector('#aj-perfil-avatar');
      if (settingsProfile) settingsProfile.innerHTML = `<img src="${avatarUrl(context.seed, 96)}" alt="Avatar del perfil">`;
    } catch (error) {
      console.warn('No se pudo actualizar el avatar:', error);
    }
  }

  async function openAvatarModal() {
    await updateAvatarUI();
    ensureAvatarModal();
    document.querySelectorAll('#hf-v27-avatar-grid .hf-v27-avatar-option').forEach(option => {
      const selected = option.dataset.avatarSeed === state.selectedAvatarSeed;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
    window.openModal?.('hfAvatarModal');
  }

  async function saveAvatar() {
    if (state.avatarSaving) return;
    const selected = document.querySelector('#hf-v27-avatar-grid .hf-v27-avatar-option.selected')?.dataset.avatarSeed;
    if (!selected) return window.showToast?.('Selecciona un avatar.', 'error');
    const button = $('hf-v27-save-avatar');
    state.avatarSaving = true;
    if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
    try {
      const context = await profileContext();
      const members = { ...(context.cfg.miembros || {}) };
      members[context.id] = { ...context.member, avatarMicahSeed: selected };
      await window.DB.updateConfig({ miembros: members });
      state.selectedAvatarSeed = selected;
      await updateAvatarUI();
      window.closeModal?.('hfAvatarModal');
      window.showToast?.('Avatar actualizado');
    } catch (error) {
      console.error('No se pudo guardar el avatar:', error);
      window.showToast?.('No se pudo guardar el avatar.', 'error');
    } finally {
      state.avatarSaving = false;
      if (button) { button.disabled = false; button.textContent = 'Guardar avatar'; }
    }
  }

  function handleDocumentClick(event) {
    if (handleMovementClick(event)) return;
    if (event.target.closest('[data-v32-open-avatar]')) {
      event.preventDefault();
      openAvatarModal();
      return;
    }
    const avatarOption = event.target.closest('.hf-v27-avatar-option');
    if (avatarOption) {
      document.querySelectorAll('.hf-v27-avatar-option').forEach(option => {
        const selected = option === avatarOption;
        option.classList.toggle('selected', selected);
        option.setAttribute('aria-pressed', String(selected));
      });
      return;
    }
    if (event.target.closest('#hf-v27-save-avatar')) {
      event.preventDefault();
      saveAvatar();
      return;
    }
    if (event.target.closest('.settings-btn, .app-logo')) setTimeout(updateAvatarUI, 0);
    if (event.target.closest('[onclick*="registrarPagoTarjeta"], [onclick*="abrirPagoTarjeta"], .hf-v24-primary-action')) {
      setTimeout(normalizePaymentModal, 0);
    }
    closeMenus();
  }

  function installOverrides() {
    window.generarGastoHTML = movementMarkup;
    window.renderGastos = renderGastosUnified;
    window.setFiltroGastos = setFilter;
    window.abrirHistorialCompleto = openHistory;
    window.filtrarHistorial = filterHistory;
    window.limpiarBusquedaHistorial = clearHistorySearch;
    window.handleFabClick = unifiedFabHandler;
    window.openGastoChoiceModal = openDetailedExpense;
    window.openGastoRapidoModal = openDetailedExpense;
  }

  function start() {
    installOverrides();
    removeQuickExpenseUI();
    removeDebtQuickPayments();
    normalizePaymentModal();
    ensureAvatarModal();
    updateAvatarUI();

    if ($('historialTitle')) $('historialTitle').textContent = 'Movimientos';
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenus();
      const movement = event.target.closest('.hf-v32-movement');
      if (movement && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        openMovementDetail(movement.dataset.movementId);
      }
    });

    ['hf:gastos-actualizados', 'hf:deuda-actualizada', 'hf:deudas-core-actualizadas']
      .forEach(name => window.addEventListener(name, () => {
        if (name === 'hf:gastos-actualizados') reloadMovements();
        removeDebtQuickPayments();
        normalizePaymentModal();
      }));

    setTimeout(() => {
      installOverrides();
      removeQuickExpenseUI();
      updateAvatarUI();
    }, 500);
  }

  installOverrides();

  window.HFExperienciaUnificada = Object.freeze({
    version: VERSION,
    reloadMovements,
    renderGastos: renderGastosUnified,
    openHistory,
    openMovementDetail,
    updateAvatarUI,
    normalizePaymentModal
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

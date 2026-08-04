(() => {
  'use strict';

  const VERSION = '27.0';
  if (window.HFExperienciaIntegrada27?.version === VERSION) return;

  const state = {
    movements: [],
    config: {},
    filter: 'todos',
    historyQuery: '',
    observer: null,
    repairTimer: null,
    reloadTimer: null,
    currentMonth: '',
    selectedAvatarSeed: '',
    activeMemberId: '',
    profileLoaded: false
  };

  const ICONS = {
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18"></path><path d="M7 15h3"></path></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-7.3 18-4.2-7.2L3 10.6 21 3Z"></path><path d="m9.5 13.8 4.4-4.1"></path></svg>',
    cash: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><path d="M6 9h.01M18 15h.01"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    transfer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h15"></path><path d="m16 5 3 3-3 3"></path><path d="M20 16H5"></path><path d="m8 13-3 3 3 3"></path></svg>',
    yape: '<span aria-hidden="true" class="hf-v27-yape-letter">Y</span>',
    cardPayment: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="3"></rect><path d="M3 9h18"></path><path d="m12 14 3 3 3-3"></path><path d="M15 12v7"></path></svg>',
    loanPayment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-5 9 5"></path><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"></path><path d="m12 11 2 2-2 2"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>',
    person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
    category: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"></path></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5z"></path><path d="M8 8h8M8 12h8M8 16h5"></path></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 15H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>'
  };

  const $ = id => document.getElementById(id);
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => `S/ ${number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const AVATAR_SEEDS = [
    'Luna tranquila', 'Cielo amable', 'Menta feliz', 'Sol de casa',
    'Nube serena', 'Azul hogar', 'Brisa suave', 'Mora alegre',
    'Río claro', 'Día bonito', 'Violeta calma', 'Mar en casa'
  ];

  function parseDisplayedMonth() {
    const text = String($('month-display')?.textContent || '').trim().toLowerCase();
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
    const cfg = state.config || {};
    return {
      mine: cfg.nombreYo || 'Christian',
      partner: cfg.nombreElla || 'Sydney'
    };
  }

  function personName(value) {
    const names = currentNames();
    if (value === 'pareja') return names.partner;
    if (value === 'ambos') return 'Ambos';
    return names.mine;
  }

  function movementTitle(item = {}) {
    if (item.tipoMovimiento === 'pagoTarjeta') return `Pago a ${item.tarjetaNombre || 'tarjeta'}`;
    if (item.tipoMovimiento === 'pagoPrestamo') return `Pago de ${item.prestamoNombre || 'préstamo'}`;
    return item.desc || item.descripcion || 'Movimiento';
  }

  function textSource(item = {}) {
    return [item.medio, item.metodoPago, item.formaPago, item.fuente, item.origen, item.canal]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function badge(icon, label, kind) {
    return `<span class="hf-v27-method-badge ${kind}"><span class="hf-v27-badge-icon">${icon}</span><span>${escapeHTML(label)}</span></span>`;
  }

  function movementBadges(item = {}) {
    const source = textSource(item);
    const badges = [];
    const isCardPayment = item.tipoMovimiento === 'pagoTarjeta';
    const isLoanPayment = item.tipoMovimiento === 'pagoPrestamo';
    const isTelegram = source.includes('telegram') || item.fuente === 'telegram';
    const isYape = source.includes('yape') || /\byape\b/i.test(item.desc || '');
    const isCard = item.medio === 'tarjeta' || !!item.tarjetaId || !!item.tarjetaNombre;
    const isTransfer = source.includes('transfer');

    if (isCardPayment) badges.push(badge(ICONS.cardPayment, 'Pago de tarjeta', 'payment'));
    else if (isLoanPayment) badges.push(badge(ICONS.loanPayment, 'Pago de préstamo', 'payment'));
    else if (isCard) badges.push(badge(ICONS.card, item.tarjetaNombre || 'Tarjeta', 'card'));
    else if (isYape) badges.push(badge(ICONS.yape, 'Yape', 'yape'));
    else if (isTransfer) badges.push(badge(ICONS.transfer, 'Transferencia', 'transfer'));
    else badges.push(badge(ICONS.cash, 'Efectivo', 'cash'));

    if (isTelegram) badges.push(badge(ICONS.telegram, 'Telegram', 'telegram'));
    return badges.join('');
  }

  function categoryIcon(item = {}) {
    if (item.tipoMovimiento === 'pagoTarjeta') return ICONS.cardPayment;
    if (item.tipoMovimiento === 'pagoPrestamo') return ICONS.loanPayment;
    const source = textSource(item);
    if (source.includes('yape')) return ICONS.yape;
    if (item.medio === 'tarjeta') return ICONS.card;
    if (source.includes('telegram')) return ICONS.telegram;
    return item.icono || '•';
  }

  function movementMarkup(item = {}) {
    const id = escapeHTML(item.id || '');
    const category = item.tipoMovimiento === 'pagoTarjeta' || item.tipoMovimiento === 'pagoPrestamo'
      ? 'Pago de deuda'
      : (item.cat || item.categoria || 'Otros');
    const isCreditExpense = item.medio === 'tarjeta' && !item.tipoMovimiento;
    const paymentClass = item.tipoMovimiento ? 'is-payment' : '';
    const creditClass = isCreditExpense ? 'is-credit' : '';

    return `
      <article class="hf-v27-movement ${paymentClass} ${creditClass}" data-movement-id="${id}" tabindex="0" role="button" aria-label="Ver detalle de ${escapeHTML(movementTitle(item))}">
        <span class="hf-v27-movement-icon">${categoryIcon(item)}</span>
        <div class="hf-v27-movement-copy">
          <strong>${escapeHTML(movementTitle(item))}</strong>
          <span>${escapeHTML(category)}${item.fecha ? ` · ${escapeHTML(formatDate(item.fecha))}` : ''}</span>
          <div class="hf-v27-movement-badges">${movementBadges(item)}</div>
        </div>
        <div class="hf-v27-movement-amount">
          <strong>${money(item.monto)}</strong>
          <span>${escapeHTML(personName(item.quien))}</span>
        </div>
        <div class="hf-v27-movement-menu-wrap">
          <button type="button" class="hf-v27-movement-more" aria-label="Opciones" aria-expanded="false">${ICONS.more}</button>
          <div class="hf-v27-movement-menu">
            ${item.tipoMovimiento ? '' : `<button type="button" data-action="edit">${ICONS.edit}<span>Editar</span></button>`}
            <button type="button" class="danger" data-action="delete">${ICONS.trash}<span>Eliminar</span></button>
          </div>
        </div>
      </article>`;
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

  function sortedMovements(list = []) {
    return [...list].sort((a, b) => {
      const dateOrder = String(b.fecha || '').localeCompare(String(a.fecha || ''));
      return dateOrder || movementTimestamp(b) - movementTimestamp(a);
    });
  }

  function renderSummary() {
    const container = $('expenseList');
    if (!container) return;
    const list = filteredMovements();

    if (!list.length) {
      container.innerHTML = '<div class="empty-state hf-v27-empty">No hay movimientos para este filtro.</div>';
      return;
    }

    const visible = list.slice(0, 5);
    container.innerHTML = visible.map(movementMarkup).join('') + (list.length > 5 ? `
      <div class="ver-todo-container hf-v27-view-all">
        <button type="button" class="btn-ver-todo" data-v27-open-history>Ver todos los movimientos de ${escapeHTML($('month-display')?.textContent || '')}</button>
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
    const query = state.historyQuery.trim().toLowerCase();
    const list = filteredMovements(state.movements).filter(item => {
      if (!query) return true;
      return [movementTitle(item), item.cat, item.tarjetaNombre, item.nota, personName(item.quien), textSource(item)]
        .filter(Boolean).join(' ').toLowerCase().includes(query);
    });

    container.innerHTML = list.length
      ? list.map(movementMarkup).join('')
      : '<div class="empty-state hf-v27-empty">No hay movimientos que coincidan con la búsqueda.</div>';

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
    return `<div class="hf-v27-detail-row"><span>${icon}</span><div><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong></div></div>`;
  }

  function ensureMovementDetailModal() {
    if ($('hfMovementDetailModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfMovementDetailModal" onclick="closeModalOutside(event,'hfMovementDetailModal')">
        <div class="modal-sheet hf-v27-detail-sheet" style="position:relative;">
          <button class="modal-close" type="button" onclick="closeModal('hfMovementDetailModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="hf-v27-detail-hero">
            <span id="hf-v27-detail-icon" class="hf-v27-detail-icon"></span>
            <div><small id="hf-v27-detail-type">Movimiento</small><h2 id="hf-v27-detail-title">Detalle</h2><strong id="hf-v27-detail-amount">S/ 0.00</strong></div>
          </div>
          <div id="hf-v27-detail-badges" class="hf-v27-detail-badges"></div>
          <div id="hf-v27-detail-content" class="hf-v27-detail-content"></div>
        </div>
      </div>`);
  }

  function openMovementDetail(id) {
    const item = state.movements.find(movement => String(movement.id) === String(id));
    if (!item) return;
    ensureMovementDetailModal();

    const category = item.tipoMovimiento ? 'Pago de deuda' : (item.cat || item.categoria || 'Otros');
    $('hf-v27-detail-icon').innerHTML = categoryIcon(item);
    $('hf-v27-detail-type').textContent = item.tipoMovimiento === 'pagoTarjeta'
      ? 'Pago de tarjeta'
      : item.tipoMovimiento === 'pagoPrestamo'
        ? 'Pago de préstamo'
        : 'Movimiento';
    $('hf-v27-detail-title').textContent = movementTitle(item);
    $('hf-v27-detail-amount').textContent = money(item.monto);
    $('hf-v27-detail-badges').innerHTML = movementBadges(item);

    const rows = [
      detailRow(ICONS.category, 'Categoría', category),
      detailRow(ICONS.calendar, 'Fecha', formatDate(item.fecha)),
      detailRow(ICONS.person, 'Registrado por', personName(item.quien)),
      item.tarjetaNombre ? detailRow(ICONS.card, 'Tarjeta', item.tarjetaNombre) : '',
      item.prestamoNombre ? detailRow(ICONS.loanPayment, 'Préstamo', item.prestamoNombre) : '',
      item.nota ? detailRow(ICONS.note, 'Nota', item.nota) : '',
      item.fuente ? detailRow(ICONS.telegram, 'Origen', item.fuente === 'telegram' ? 'Telegram' : item.fuente) : '',
      item.creadoEn ? detailRow(ICONS.calendar, 'Registrado', new Date(movementTimestamp(item)).toLocaleString('es-PE')) : ''
    ].filter(Boolean);

    $('hf-v27-detail-content').innerHTML = rows.join('');
    window.openModal?.('hfMovementDetailModal');
  }

  function closeMovementMenus(except = null) {
    document.querySelectorAll('.hf-v27-movement-menu.open').forEach(menu => {
      if (menu === except) return;
      menu.classList.remove('open');
      menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
    });
  }

  function handleMovementClick(event) {
    const viewAll = event.target.closest('[data-v27-open-history]');
    if (viewAll) {
      event.preventDefault();
      openHistory();
      return;
    }

    const card = event.target.closest('.hf-v27-movement');
    if (!card) return;
    const id = card.dataset.movementId;
    const more = event.target.closest('.hf-v27-movement-more');
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

    if (!event.target.closest('.hf-v27-movement-menu')) openMovementDetail(id);
  }

  function handleMovementKey(event) {
    if (!event.target.matches('.hf-v27-movement')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMovementDetail(event.target.dataset.movementId);
    }
  }

  function setFilter(filter, button) {
    state.filter = filter || 'todos';
    document.querySelectorAll('.expense-filter').forEach(item => item.classList.toggle('active', item === button || item.dataset.filter === state.filter));
    renderSummary();
  }

  function removeDebtQuickPayments() {
    const modal = $('hfDebtAdminModal');
    if (!modal) return;
    modal.querySelector('.hf-debt-admin-separator')?.remove();
    modal.querySelector('#hf-admin-card-actions')?.remove();
    modal.dataset.hfV27NoQuickPayments = 'true';
  }

  function normalizePaymentModal() {
    const modal = $('pagoTarjetaModal');
    if (!modal) return;
    const dateRow = $('pago-fecha')?.closest('.input-row');
    const noteRow = $('pago-nota')?.closest('.input-row');
    if (!dateRow || !noteRow) return;

    const inputs = [...modal.querySelectorAll('[id="pago-disponible-banco"]')];
    let canonical = inputs.find(input => input.closest('.hf-payment-bank-balance')?.querySelector('#hf-v24-payment-preview'))
      || inputs[inputs.length - 1];

    if (!canonical) {
      noteRow.insertAdjacentHTML('afterend', `
        <div class="input-row hf-payment-bank-balance hf-v27-payment-available">
          <label class="input-label" for="pago-disponible-banco">Línea disponible después del pago (opcional)</label>
          <input type="number" step="0.01" inputmode="decimal" class="input-field" id="pago-disponible-banco" placeholder="Ej.: 209.73">
          <small class="field-help">Escribe el disponible que muestra el banco después del pago. Con la línea de crédito, la app confirmará la deuda real.</small>
          <div class="hf-v24-payment-preview" id="hf-v24-payment-preview" aria-live="polite"></div>
        </div>`);
      canonical = $('pago-disponible-banco');
    }

    const canonicalRow = canonical.closest('.input-row');
    inputs.forEach(input => {
      if (input === canonical) return;
      const row = input.closest('.input-row');
      if (row && row !== canonicalRow) row.remove();
      else input.remove();
    });

    modal.querySelectorAll('#hf-v24-payment-preview').forEach((preview, index) => {
      if (index > 0) preview.remove();
    });

    canonicalRow?.classList.add('hf-v27-payment-available');
    dateRow.insertAdjacentElement('afterend', noteRow);
    noteRow.insertAdjacentElement('afterend', canonicalRow);
    modal.dataset.hfV27PaymentOrder = VERSION;
  }

  function avatarUrl(seed, size = 112) {
    const safeSeed = encodeURIComponent(seed || 'Hogar Finanzas');
    return `https://api.dicebear.com/10.x/micah/svg?seed=${safeSeed}&size=${size}&backgroundColor=dbeafe,e0e7ff,fce7f3,d1fae5&borderRadius=50`;
  }

  async function profileContext() {
    const raw = await window.DB?.getConfig?.() || {};
    const cfg = typeof window.normalizarConfigIdentidad === 'function'
      ? window.normalizarConfigIdentidad(raw)
      : raw;
    state.config = cfg;
    const storedId = localStorage.getItem('miembroActualId');
    const member = storedId && cfg.miembros?.[storedId]
      ? cfg.miembros[storedId]
      : (typeof window.obtenerMiembroActual === 'function' ? window.obtenerMiembroActual(cfg) : null);
    const id = member?.id || storedId || cfg.miembroPrincipalId || 'usuario';
    const fallback = `${id}-${member?.nombre || 'Hogar'}`;
    return { cfg, member: member || { id, nombre: cfg.nombreYo || 'Christian' }, id, seed: member?.avatarMicahSeed || fallback };
  }

  function ensureHomeProfile() {
    const page = $('page-resumen');
    const grid = page?.querySelector('.month-money-grid');
    if (!page || !grid) return null;
    let profile = $('hf-v27-home-profile');
    if (!profile) {
      profile = document.createElement('section');
      profile.id = 'hf-v27-home-profile';
      profile.className = 'hf-v27-home-profile';
      profile.innerHTML = `
        <button type="button" class="hf-v27-home-avatar" data-open-avatar aria-label="Elegir avatar"><img alt="Avatar del perfil"></button>
        <div><small>Tu resumen del mes</small><strong id="hf-v27-home-greeting">Hola</strong><span id="hf-v27-home-subtitle">Así van las finanzas de tu hogar.</span></div>`;
      grid.insertAdjacentElement('beforebegin', profile);
    }
    return profile;
  }

  function ensureAvatarSettingsRow() {
    const settings = $('ajustesModal');
    const profileCard = settings?.querySelector('.settings-profile-card');
    if (!settings || !profileCard) return;
    if ($('hf-v27-avatar-settings')) return;

    profileCard.insertAdjacentHTML('afterend', `
      <div class="settings-section-label hf-v27-avatar-label">Personalización</div>
      <div class="settings-menu hf-v27-avatar-menu">
        <button type="button" class="settings-menu-row" id="hf-v27-avatar-settings" data-open-avatar>
          <span class="hf-v27-settings-avatar"><img alt="Avatar seleccionado"></span>
          <span class="settings-menu-copy"><strong>Avatar del perfil</strong><small>Elige un avatar Micah para personalizar tu inicio.</small></span>
          <span class="settings-menu-arrow">›</span>
        </button>
      </div>`);
  }

  function ensureAvatarModal() {
    if ($('hfAvatarModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfAvatarModal" onclick="closeModalOutside(event,'hfAvatarModal')">
        <div class="modal-sheet hf-v27-avatar-sheet" style="position:relative;">
          <button class="modal-close" type="button" onclick="closeModal('hfAvatarModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="modal-title">Elige tu avatar</div>
          <p class="settings-intro">Selecciona el avatar que aparecerá en tu pantalla principal. Se sincroniza con tu perfil del hogar.</p>
          <div id="hf-v27-avatar-grid" class="hf-v27-avatar-grid"></div>
          <button type="button" class="modal-btn primary" id="hf-v27-save-avatar">Guardar avatar</button>
          <small class="hf-v27-avatar-credit">Avatares Micah generados con DiceBear.</small>
        </div>
      </div>`);
  }

  async function updateAvatarUI() {
    const context = await profileContext();
    state.activeMemberId = context.id;
    state.selectedAvatarSeed = context.seed;
    state.profileLoaded = true;

    const profile = ensureHomeProfile();
    const image = profile?.querySelector('img');
    if (image) image.src = avatarUrl(context.seed, 128);
    if ($('hf-v27-home-greeting')) $('hf-v27-home-greeting').textContent = `Hola, ${context.member.nombre || 'Christian'}`;
    const monthName = $('month-display')?.textContent || 'este mes';
    if ($('hf-v27-home-subtitle')) $('hf-v27-home-subtitle').textContent = `Así van tus finanzas en ${monthName.toLowerCase()}.`;

    ensureAvatarSettingsRow();
    const settingsImage = $('hf-v27-avatar-settings')?.querySelector('img');
    if (settingsImage) settingsImage.src = avatarUrl(context.seed, 96);

    const profileAvatar = $('aj-perfil-avatar');
    if (profileAvatar) profileAvatar.innerHTML = `<img src="${avatarUrl(context.seed, 96)}" alt="Avatar de ${escapeHTML(context.member.nombre || 'perfil')}">`;
  }

  async function openAvatarPicker() {
    ensureAvatarModal();
    const context = await profileContext();
    state.activeMemberId = context.id;
    state.selectedAvatarSeed = context.seed;
    const grid = $('hf-v27-avatar-grid');
    grid.innerHTML = AVATAR_SEEDS.map((seed, index) => {
      const value = `${context.id}-${seed}`;
      const selected = value === context.seed;
      return `<button type="button" class="hf-v27-avatar-option ${selected ? 'selected' : ''}" data-avatar-seed="${escapeHTML(value)}" aria-label="Avatar ${index + 1}" aria-pressed="${selected}"><img src="${avatarUrl(value, 120)}" alt="Opción de avatar ${index + 1}"></button>`;
    }).join('');
    window.openModal?.('hfAvatarModal');
  }

  async function saveAvatar() {
    const selected = state.selectedAvatarSeed;
    if (!selected || !state.activeMemberId) return;
    const raw = await window.DB?.getConfig?.() || {};
    const cfg = typeof window.normalizarConfigIdentidad === 'function'
      ? window.normalizarConfigIdentidad(raw)
      : raw;
    const members = { ...(cfg.miembros || {}) };
    const current = members[state.activeMemberId] || { id: state.activeMemberId, nombre: 'Usuario' };
    members[state.activeMemberId] = { ...current, avatarMicahSeed: selected };
    await window.DB.updateConfig({ miembros: members });
    state.config = { ...cfg, miembros };
    window.closeModal?.('hfAvatarModal');
    await updateAvatarUI();
    window.showToast?.('Avatar actualizado');
  }

  function handleGlobalClick(event) {
    const avatarTrigger = event.target.closest('[data-open-avatar]');
    if (avatarTrigger) {
      event.preventDefault();
      openAvatarPicker();
      return;
    }

    const avatarOption = event.target.closest('[data-avatar-seed]');
    if (avatarOption) {
      const grid = avatarOption.closest('.hf-v27-avatar-grid');
      grid?.querySelectorAll('.hf-v27-avatar-option').forEach(option => {
        const selected = option === avatarOption;
        option.classList.toggle('selected', selected);
        option.setAttribute('aria-pressed', String(selected));
      });
      state.selectedAvatarSeed = avatarOption.dataset.avatarSeed;
      return;
    }

    if (event.target.closest('#hf-v27-save-avatar')) {
      saveAvatar();
      return;
    }

    if (event.target.closest('#expenseList, #listaCompletaGastos')) handleMovementClick(event);
    else closeMovementMenus();
  }

  function installOverrides() {
    window.renderGastos = receiveMovements;
    window.generarGastoHTML = movementMarkup;
    window.abrirHistorialCompleto = openHistory;
    window.filtrarHistorial = filterHistory;
    window.limpiarBusquedaHistorial = clearHistorySearch;
    window.setFiltroGastos = setFilter;
  }

  function repair() {
    installOverrides();
    removeDebtQuickPayments();
    normalizePaymentModal();
    ensureMovementDetailModal();
    ensureAvatarSettingsRow();
    ensureHomeProfile();
    if (!state.profileLoaded) updateAvatarUI();
    document.body?.classList.add('hf-experiencia-integrada-v27');
  }

  function scheduleRepair() {
    clearTimeout(state.repairTimer);
    state.repairTimer = setTimeout(repair, 80);
  }

  function scheduleReload() {
    clearTimeout(state.reloadTimer);
    state.reloadTimer = setTimeout(reloadMovements, 130);
  }

  function start() {
    installOverrides();
    repair();
    reloadMovements();
    updateAvatarUI();

    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', event => {
      handleMovementKey(event);
      if (event.key === 'Escape') closeMovementMenus();
    });

    $('historial-search')?.addEventListener('input', filterHistory);

    const monthDisplay = $('month-display');
    if (monthDisplay) {
      new MutationObserver(scheduleReload).observe(monthDisplay, { childList: true, characterData: true, subtree: true });
    }

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
      installOverrides();
      repair();
      retries += 1;
      if (retries >= 24) clearInterval(stabilizer);
    }, 400);
  }

  window.HFExperienciaIntegrada27 = Object.freeze({
    version: VERSION,
    repair,
    reloadMovements,
    openMovementDetail,
    openAvatarPicker,
    updateAvatarUI
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

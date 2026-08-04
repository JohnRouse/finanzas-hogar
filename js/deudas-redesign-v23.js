(() => {
  'use strict';

  const VERSION = '24.0';
  if (window.HFDeudasRedesign24?.version === VERSION) return;

  const state = {
    observer: null,
    timer: null,
    healingTimer: null,
    healingRuns: 0,
    rendering: false,
    editingCardId: null,
    paymentCard: null
  };

  const ICONS = {
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9"></path><path d="M10 19V5"></path><path d="M16 19v-7"></path><path d="M22 19H2"></path></svg>',
    calculator: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="3"></rect><path d="M8 6h8"></path><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4"></path></svg>',
    addCard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18"></path><path d="M12 13v4M10 15h4"></path></svg>',
    bank: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-6 9 6"></path><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>',
    coins: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="8" cy="7" rx="5" ry="3"></ellipse><path d="M3 7v4c0 1.7 2.2 3 5 3 .8 0 1.5-.1 2.2-.3"></path><path d="M3 11v4c0 1.7 2.2 3 5 3 .7 0 1.3-.1 1.9-.2"></path><ellipse cx="16" cy="14" rx="5" ry="3"></ellipse><path d="M11 14v4c0 1.7 2.2 3 5 3s5-1.3 5-3v-4"></path></svg>',
    layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 5-9 5-9-5Z"></path><path d="m3 12 9 5 9-5"></path><path d="m3 17 9 5 9-5"></path></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7h.01"></path></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 15H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"></path></svg>',
    history: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l3 2"></path></svg>'
  };

  const $ = id => document.getElementById(id);
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const money = value => `S/ ${number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  function toast(message, type = 'success') {
    if (typeof window.showToast === 'function') window.showToast(message, type);
    else if (typeof window.mostrarToast === 'function') window.mostrarToast(message, type);
    else console.info(message);
  }

  function isAdmin() {
    try {
      const member = typeof window.obtenerMiembroActual === 'function' ? window.obtenerMiembroActual() : null;
      if (member) return member.rol === 'administrador' || member.legacyTipo === 'yo';
    } catch (_) {}
    return localStorage.getItem('miUsuarioTipo') !== 'pareja';
  }

  function dateShort(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'No informado';
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  }

  function daysUntil(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    const target = new Date(`${value}T12:00:00`);
    return Math.ceil((target - base) / 86400000);
  }

  function closeAdminThen(callback) {
    if (typeof window.closeModal === 'function') window.closeModal('hfDebtAdminModal');
    else $('hfDebtAdminModal')?.classList.remove('open');
    setTimeout(() => callback?.(), 110);
  }

  function actionMarkup(icon, title, subtitle) {
    return `<span class="hf-v24-admin-icon">${icon}</span><div><strong>${title}</strong><small>${subtitle}</small></div><em>›</em>`;
  }

  function enhanceAdminModal() {
    const modal = $('hfDebtAdminModal');
    if (!modal) return;

    const heading = modal.querySelector('.hf-debt-admin-heading p');
    if (heading) heading.textContent = 'Registra obligaciones, consulta su evolución y organiza los pagos.';

    const actions = modal.querySelector('.hf-debt-admin-actions');
    if (!actions) return;

    if (actions.dataset.hfV24 !== VERSION || actions.querySelector('[data-admin-action="actualizar"], [data-admin-action="cierre"]')) {
      actions.dataset.hfV24 = VERSION;
      actions.innerHTML = `
        <button class="hf-debt-admin-action hf-v24-featured" type="button" data-v24-action="states">
          ${actionMarkup(ICONS.chart, 'Estados de cuenta y evolución', 'Compara saldos confirmados y pagos por mes.')}
        </button>
        <button class="hf-debt-admin-action" type="button" data-v24-action="plan">
          ${actionMarkup(ICONS.calculator, 'Calcular cómo pagar', 'Simula cuotas, tiempo e intereses con la TEA registrada.')}
        </button>
        <button class="hf-debt-admin-action" type="button" data-v24-action="card">
          ${actionMarkup(ICONS.addCard, 'Agregar tarjeta', 'Registra línea, fechas y TEA de la tarjeta.')}
        </button>
        <button class="hf-debt-admin-action" type="button" data-v24-action="loan">
          ${actionMarkup(ICONS.bank, 'Agregar préstamo', 'Registra saldo, cuota y vencimiento.')}
        </button>`;

      actions.querySelector('[data-v24-action="states"]')?.addEventListener('click', () => {
        closeAdminThen(() => {
          if (window.HFExperienciaFinanciera14?.abrirCentroEstados) window.HFExperienciaFinanciera14.abrirCentroEstados();
          else toast('La vista de estados todavía no está disponible.', 'error');
        });
      });
      actions.querySelector('[data-v24-action="plan"]')?.addEventListener('click', () => {
        closeAdminThen(() => (window.abrirCentroFinanciero || window.abrirPlanificadorDeudas)?.());
      });
      actions.querySelector('[data-v24-action="card"]')?.addEventListener('click', () => closeAdminThen(openNewCard));
      actions.querySelector('[data-v24-action="loan"]')?.addEventListener('click', () => closeAdminThen(() => window.abrirNuevoPrestamo?.()));
    }

    const separator = modal.querySelector('.hf-debt-admin-separator');
    if (separator) separator.textContent = 'Pagos rápidos';
    modal.dataset.hfRedesign = VERSION;
  }

  function ensureCardFields() {
    const modal = $('tarjetaModal');
    if (!modal) return;

    if (!$('t-tea')) {
      const limitsRow = $('t-limite')?.closest('.input-row');
      const ownerRow = $('t-quien')?.closest('.input-row');
      const target = limitsRow || ownerRow;
      target?.insertAdjacentHTML('afterend', `
        <div class="input-row input-row-two hf-v24-card-finance-fields">
          <div>
            <label class="input-label" for="t-tea">TEA anual (%)</label>
            <input type="number" min="0" step="0.01" inputmode="decimal" class="input-field" id="t-tea" placeholder="Ej.: 89.90">
            <small class="field-help">Se usa para simulaciones de tiempo e intereses.</small>
          </div>
          <div>
            <label class="input-label" for="t-ultimos4">Últimos 4 dígitos</label>
            <input type="text" inputmode="numeric" maxlength="4" class="input-field" id="t-ultimos4" placeholder="1234">
            <small class="field-help">Solo para identificar la tarjeta.</small>
          </div>
        </div>`);
    }

    const tea = $('t-tea');
    if (tea) {
      tea.min = '0';
      tea.step = '0.01';
      tea.placeholder = 'Ej.: 89.90';
    }

    const statementBox = modal.querySelector('.statement-initial-box');
    if (statementBox) {
      statementBox.hidden = true;
      statementBox.style.setProperty('display', 'none', 'important');
      statementBox.setAttribute('aria-hidden', 'true');
    }

    if (!modal.querySelector('.hf-v24-statement-note')) {
      const daysRow = $('t-cierre')?.closest('.input-row');
      daysRow?.insertAdjacentHTML('afterend', `
        <div class="hf-v24-statement-note">
          ${ICONS.history}
          <div><strong>Estados mensuales separados</strong><span>Pago mínimo, pago total, saldo confirmado y comparaciones por mes se registran desde “Estados de cuenta y evolución”.</span></div>
        </div>`);
    }

    modal.dataset.hfV24Fields = VERSION;
  }

  function clearCardForm() {
    state.editingCardId = null;
    ['t-nombre','t-deuda','t-limite','t-cierre','t-vence','t-tea','t-ultimos4'].forEach(id => {
      if ($(id)) $(id).value = '';
    });
    if ($('t-quien')) $('t-quien').value = localStorage.getItem('miUsuarioTipo') || 'yo';
    if ($('tarjeta-modal-title')) $('tarjeta-modal-title').textContent = 'Nueva tarjeta de crédito';
    if ($('tarjeta-submit-btn')) $('tarjeta-submit-btn').textContent = 'Guardar tarjeta';
  }

  function openNewCard() {
    ensureCardFields();
    clearCardForm();
    window.openModal?.('tarjetaModal');
  }

  async function openEditCard(id) {
    ensureCardFields();
    const cards = await window.DB?.getTarjetas?.();
    const card = (cards || []).find(item => String(item.id) === String(id));
    if (!card) return toast('No se encontró la tarjeta.', 'error');

    state.editingCardId = card.id;
    if ($('t-nombre')) $('t-nombre').value = card.nombre || card.banco || '';
    if ($('t-deuda')) $('t-deuda').value = number(card.deuda || card.saldo);
    if ($('t-limite')) $('t-limite').value = number(card.limite || card.lineaTotal);
    if ($('t-cierre')) $('t-cierre').value = card.cierre || card.diaCierre || '';
    if ($('t-vence')) $('t-vence').value = card.vence || card.diaVencimiento || '';
    if ($('t-quien')) $('t-quien').value = card.quien || 'yo';
    if ($('t-tea')) $('t-tea').value = number(card.tea || card.tasaEfectivaAnual) || '';
    if ($('t-ultimos4')) $('t-ultimos4').value = card.ultimosDigitos || card.ultimos4 || '';
    if ($('tarjeta-modal-title')) $('tarjeta-modal-title').textContent = 'Editar tarjeta';
    if ($('tarjeta-submit-btn')) $('tarjeta-submit-btn').textContent = 'Guardar cambios';
    window.openModal?.('tarjetaModal');
  }

  async function saveCard() {
    ensureCardFields();
    if (!window.DB) return toast('No se pudo acceder a los datos del hogar.', 'error');

    const name = String($('t-nombre')?.value || '').trim();
    const debt = round($('t-deuda')?.value);
    const limit = round($('t-limite')?.value);
    const closeDay = String($('t-cierre')?.value || '').trim();
    const dueDay = String($('t-vence')?.value || '').trim();
    const owner = $('t-quien')?.value || 'yo';
    const teaRaw = String($('t-tea')?.value || '').trim();
    const tea = teaRaw === '' ? 0 : round(teaRaw);
    const last4 = String($('t-ultimos4')?.value || '').replace(/\D/g, '').slice(-4);

    if (!name) return toast('Escribe el nombre de la tarjeta.', 'error');
    if (debt < 0 || limit < 0) return toast('La deuda y la línea no pueden ser negativas.', 'error');
    if (tea < 0) return toast('La TEA no puede ser negativa.', 'error');

    const cards = await window.DB.getTarjetas();
    const current = (cards || []).find(item => String(item.id) === String(state.editingCardId));
    const data = {
      nombre: name,
      deuda: debt,
      limite: limit,
      lineaTotal: limit,
      cierre: closeDay,
      diaCierre: closeDay,
      vence: dueDay,
      diaVencimiento: dueDay,
      quien: owner,
      tea,
      tasaEfectivaAnual: tea,
      ultimosDigitos: last4,
      estadoCuenta: current?.estadoCuenta || null,
      historialEstados: current?.historialEstados || [],
      fechaCierre: current?.fechaCierre || current?.estadoCuenta?.fechaCierre || '',
      fechaVencimiento: current?.fechaVencimiento || current?.estadoCuenta?.fechaVencimiento || '',
      actualizadoEn: new Date().toISOString()
    };

    if (state.editingCardId) {
      await window.DB.updateTarjeta(state.editingCardId, data);
      toast('Tarjeta actualizada.');
    } else {
      await window.DB.addTarjeta(data);
      toast('Tarjeta guardada.');
    }

    window.closeModal?.('tarjetaModal');
    clearCardForm();
    await window.renderTodo?.();
    await window.HFDeudasFamiliares?.renderizar?.();
    scheduleRepair();
  }

  function installCardFormHandlers() {
    ensureCardFields();
    if (window.abrirNuevaTarjeta !== openNewCard) window.abrirNuevaTarjeta = openNewCard;
    if (window.abrirEditarTarjeta !== openEditCard) window.abrirEditarTarjeta = openEditCard;
    if (window.agregarTarjeta !== saveCard) window.agregarTarjeta = saveCard;
  }

  function ensureAvailableBalanceField() {
    const modal = $('pagoTarjetaModal');
    if (!modal) return;

    let input = $('pago-disponible-banco');
    if (!input) {
      const dateRow = $('pago-fecha')?.closest('.input-row');
      if (!dateRow) return;
      dateRow.insertAdjacentHTML('afterend', `
        <div class="input-row hf-payment-bank-balance">
          <label class="input-label" for="pago-disponible-banco">Línea disponible después del pago (opcional)</label>
          <input type="number" step="0.01" inputmode="decimal" class="input-field" id="pago-disponible-banco" placeholder="Ej.: 209.73">
          <small class="field-help">Escribe el disponible que muestra el banco después del pago. Con la línea de crédito, la app confirmará la deuda real.</small>
          <div class="hf-v24-payment-preview" id="hf-v24-payment-preview" aria-live="polite"></div>
        </div>`);
      input = $('pago-disponible-banco');
    }

    const row = input?.closest('.hf-payment-bank-balance, .input-row');
    const label = row?.querySelector('label');
    const help = row?.querySelector('.field-help');
    if (label) label.textContent = 'Línea disponible después del pago (opcional)';
    if (help) help.textContent = 'Escribe el disponible que muestra el banco después del pago. Con la línea de crédito, la app confirmará la deuda real.';
    if (input) input.placeholder = 'Ej.: 209.73';

    if (row && !$('hf-v24-payment-preview')) {
      row.insertAdjacentHTML('beforeend', '<div class="hf-v24-payment-preview" id="hf-v24-payment-preview" aria-live="polite"></div>');
    }

    const amount = $('pago-monto');
    [input, amount].filter(Boolean).forEach(field => {
      if (field.dataset.hfV24Preview === VERSION) return;
      field.dataset.hfV24Preview = VERSION;
      field.addEventListener('input', updatePaymentPreview);
    });
  }

  function updatePaymentPreview() {
    const preview = $('hf-v24-payment-preview');
    const card = state.paymentCard;
    if (!preview || !card) return;

    const availableRaw = String($('pago-disponible-banco')?.value || '').trim();
    const amount = number($('pago-monto')?.value);
    const debt = number(card.deuda || card.saldo);
    const limit = number(card.limite || card.lineaTotal);

    let resultingDebt = Math.max(0, debt - amount);
    let text = `Deuda estimada después del pago: ${money(resultingDebt)}.`;

    if (availableRaw !== '' && Number.isFinite(Number(availableRaw)) && limit > 0) {
      resultingDebt = Math.max(0, round(limit - Number(availableRaw)));
      text = `Con el disponible del banco, la deuda quedará confirmada en ${money(resultingDebt)}.`;
    }

    preview.textContent = text;
  }

  function cardName(item = {}) {
    return item.nombre || item.banco || 'Tarjeta';
  }

  function loanName(item = {}) {
    return item.nombre || item.entidad || item.banco || 'Préstamo';
  }

  function bankTone(name = '') {
    const normalized = name.toLowerCase();
    if (normalized.includes('bbva')) return 'bbva';
    if (normalized.includes('bcp')) return 'bcp';
    if (normalized.includes('ripley')) return 'ripley';
    if (normalized.includes('falabella')) return 'falabella';
    if (normalized.includes('santander')) return 'santander';
    if (normalized.includes('portuaria')) return 'portuaria';
    return 'default';
  }

  function initials(name = '') {
    const meaningful = name.replace(/\b(visa|mastercard|tarjeta|préstamo|prestamo)\b/gi, '').trim();
    const words = meaningful.split(/\s+/).filter(Boolean);
    if (!words.length) return 'HF';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  }

  function cardSummary(item = {}) {
    const live = window.HFDeudasActuales?.obtenerTarjeta?.(item.id);
    const debt = Math.max(0, number(live?.deudaEstimada ?? item.deuda ?? item.saldo));
    const limit = Math.max(0, number(live?.lineaTotal ?? item.limite ?? item.lineaTotal));
    const available = limit > 0 ? limit - debt : null;
    const minimum = Math.max(0, number(live?.pagoMinimo ?? item.estadoCuenta?.pagoMinimo ?? item.pagoMinimo));
    const due = live?.fechaVencimiento ?? item.fechaVencimiento ?? item.estadoCuenta?.fechaVencimiento ?? '';
    const usage = limit > 0 ? debt / limit * 100 : 0;
    const days = daysUntil(due);

    let tone = 'good';
    let label = 'Al día';
    if (available !== null && available < 0) {
      tone = 'danger';
      label = 'Línea excedida';
    } else if (days !== null && days < 0) {
      tone = 'danger';
      label = 'Vencida';
    } else if (days !== null && days <= 3) {
      tone = 'warning';
      label = 'Vence pronto';
    } else if (usage >= 90) {
      tone = 'warning';
      label = 'Casi al límite';
    } else if ((days !== null && days <= 7) || usage >= 75) {
      tone = 'warning';
      label = 'Atención';
    }

    return { item, debt, limit, available, minimum, due, usage, days, tone, label };
  }

  function loanSummary(item = {}) {
    const balance = Math.max(0, number(item.saldoPendiente ?? item.saldo ?? item.deuda ?? item.capitalPendiente ?? item.montoPendiente ?? item.monto));
    const installment = Math.max(0, number(item.cuotaMensual ?? item.cuota ?? item.pagoMensual ?? item.minimo));
    const due = item.proximoVencimiento || item.fechaVencimiento || item.vencimiento || '';
    const days = daysUntil(due);
    const paidInstallments = number(item.pagadas ?? item.cuotasPagadas);
    const totalInstallments = number(item.total ?? item.cuotasTotales);
    const originalAmount = number(item.montoOriginal ?? item.montoInicial ?? item.capitalInicial ?? item.principal);
    const progress = totalInstallments > 0
      ? Math.max(0, Math.min(100, paidInstallments / totalInstallments * 100))
      : originalAmount > 0
        ? Math.max(0, Math.min(100, (originalAmount - balance) / originalAmount * 100))
        : 0;

    let tone = 'good';
    let label = 'Al día';
    if (days !== null && days < 0) {
      tone = 'danger';
      label = 'Vencido';
    } else if (days !== null && days <= 3) {
      tone = 'warning';
      label = 'Vence pronto';
    } else if (days !== null && days <= 7) {
      tone = 'warning';
      label = 'Próximo';
    }

    return { item, balance, installment, due, days, paidInstallments, totalInstallments, originalAmount, progress, tone, label };
  }

  function detailCell(label, value) {
    return `<div class="hf-v24-detail-cell"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value || 'No informado')}</strong></div>`;
  }

  function cardDetails(summary) {
    const item = summary.item;
    const closeDate = item.fechaCierre || item.estadoCuenta?.fechaCierre || '';
    const closeDay = item.cierre || item.diaCierre || '';
    const dueDay = item.vence || item.diaVencimiento || '';
    const last4 = item.ultimosDigitos || item.ultimos4 || '';
    const tea = number(item.tea || item.tasaEfectivaAnual);
    const period = item.estadoCuenta?.periodo || item.ultimoEstadoMes || '';

    return `
      <div class="hf-v24-detail-grid">
        ${detailCell('Próximo cierre', closeDate ? dateShort(closeDate) : closeDay ? `Día ${closeDay}` : '')}
        ${detailCell('Día habitual de pago', dueDay ? `Día ${dueDay}` : '')}
        ${detailCell('Tarjeta', last4 ? `•••• ${last4}` : '')}
        ${detailCell('TEA anual', tea > 0 ? `${tea.toFixed(2)}%` : '')}
        ${detailCell('Último estado', period)}
        ${detailCell('Pago total informado', number(item.estadoCuenta?.pagoTotal) > 0 ? money(item.estadoCuenta.pagoTotal) : '')}
      </div>
      <button type="button" class="hf-v24-history-action">${ICONS.history}<span>Ver estados y evolución mensual</span></button>`;
  }

  function loanDetails(summary) {
    const item = summary.item;
    const remaining = item.cuotasRestantes ?? item.cuotasPendientes;
    const frequency = String(item.frecuencia || '').trim();
    return `
      <div class="hf-v24-detail-grid">
        ${detailCell('Monto original', summary.originalAmount > 0 ? money(summary.originalAmount) : '')}
        ${detailCell('Frecuencia', frequency ? frequency.charAt(0).toUpperCase() + frequency.slice(1) : '')}
        ${detailCell('Cuotas pagadas', summary.totalInstallments > 0 ? String(summary.paidInstallments) : '')}
        ${detailCell('Total de cuotas', summary.totalInstallments > 0 ? String(summary.totalInstallments) : '')}
        ${detailCell('Cuotas restantes', remaining != null ? String(remaining) : '')}
        ${detailCell('Próximo vencimiento', dateShort(summary.due))}
      </div>`;
  }

  function menuMarkup() {
    return `
      <div class="hf-v24-menu-wrap">
        <button type="button" class="hf-v24-menu-button" aria-label="Editar o eliminar" aria-expanded="false">${ICONS.more}</button>
        <div class="hf-v24-menu" role="menu">
          <button type="button" data-menu-action="edit" role="menuitem">${ICONS.edit}<span>Editar</span></button>
          <button type="button" class="danger" data-menu-action="delete" role="menuitem">${ICONS.trash}<span>Eliminar</span></button>
        </div>
      </div>`;
  }

  function closeMenus(except = null) {
    document.querySelectorAll('.hf-v24-menu.open').forEach(menu => {
      if (menu === except) return;
      menu.classList.remove('open');
      menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
    });
  }

  function attachCommonCardEvents(card, type, item, summary) {
    const menuButton = card.querySelector('.hf-v24-menu-button');
    const menu = card.querySelector('.hf-v24-menu');
    menuButton?.addEventListener('click', event => {
      event.stopPropagation();
      const open = !menu.classList.contains('open');
      closeMenus(menu);
      menu.classList.toggle('open', open);
      menuButton.setAttribute('aria-expanded', String(open));
    });

    card.querySelector('[data-menu-action="edit"]')?.addEventListener('click', event => {
      event.stopPropagation();
      closeMenus();
      if (type === 'card') openEditCard(item.id);
      else window.abrirEditarPrestamo?.(
        item.id,
        loanName(item),
        summary.balance,
        summary.installment,
        number(item.pagadas),
        number(item.total || item.cuotasTotales),
        item.quien || 'yo',
        item.proximoVencimiento || item.fechaVencimiento || '',
        item.frecuencia || 'mensual'
      );
    });

    card.querySelector('[data-menu-action="delete"]')?.addEventListener('click', event => {
      event.stopPropagation();
      closeMenus();
      if (type === 'card') window.eliminarTarjeta?.(item.id);
      else window.eliminarPrestamo?.(item.id);
    });

    const details = card.querySelector('.hf-v24-details');
    const detailsButton = card.querySelector('.hf-v24-details-button');
    detailsButton?.addEventListener('click', () => {
      const opening = details.hidden;
      details.hidden = !opening;
      card.classList.toggle('is-expanded', opening);
      detailsButton.setAttribute('aria-expanded', String(opening));
      detailsButton.querySelector('span').textContent = opening ? 'Ocultar detalles' : 'Ver detalles';
    });

    if (type === 'card') {
      card.querySelector('.hf-v24-primary-action')?.addEventListener('click', () => {
        state.paymentCard = item;
        window.abrirPagoTarjeta?.(item.id, cardName(item), summary.debt);
        setTimeout(() => {
          ensureAvailableBalanceField();
          updatePaymentPreview();
        }, 180);
      });
      card.querySelector('.hf-v24-history-action')?.addEventListener('click', () => {
        if (window.HFExperienciaFinanciera14?.abrirEstadosTarjeta) window.HFExperienciaFinanciera14.abrirEstadosTarjeta(item.id);
        else toast('La evolución mensual todavía no está disponible.', 'error');
      });
    } else {
      card.querySelector('.hf-v24-primary-action')?.addEventListener('click', () => {
        window.abrirPagoPrestamo?.(
          item.id,
          loanName(item),
          summary.balance,
          summary.installment,
          item.proximoVencimiento || item.fechaVencimiento || '',
          item.frecuencia || 'mensual',
          item.quien || 'yo'
        );
      });
    }
  }

  function renderCard(card, summary) {
    const item = summary.item;
    const name = cardName(item);
    const availableText = summary.available == null ? 'No informada' : money(summary.available);
    const percentage = Math.max(0, Math.min(100, summary.usage));
    const signature = JSON.stringify([item.id, summary.debt, summary.limit, summary.minimum, summary.due, item.tea, item.ultimosDigitos, VERSION]);
    if (card.dataset.hfV24Signature === signature) return;

    card.dataset.hfV24Signature = signature;
    card.className = `hf-family-card hf-v24-debt-card hf-v24-${summary.tone}`;
    card.innerHTML = `
      <div class="hf-v24-card-head">
        <div class="hf-v24-brand hf-v24-brand-${bankTone(name)}">${escapeHTML(initials(name))}</div>
        <div class="hf-v24-identity">
          <div class="hf-v24-title-row"><strong>${escapeHTML(name)}</strong><span class="hf-v24-status">${escapeHTML(summary.label)}</span></div>
          <small>Tarjeta de crédito</small>
        </div>
        ${isAdmin() ? menuMarkup() : ''}
      </div>
      <div class="hf-v24-metrics">
        <div><span>Deuda total</span><strong>${money(summary.debt)}</strong></div>
        <div><span>Disponible</span><strong>${availableText}</strong></div>
      </div>
      ${summary.limit > 0 ? `
        <div class="hf-v24-progress"><i style="width:${percentage.toFixed(1)}%"></i></div>
        <div class="hf-v24-progress-labels"><span>${Math.round(summary.usage)}% utilizado</span><span>Línea ${money(summary.limit)}</span></div>` : ''}
      <div class="hf-v24-glance">
        <div><span>${ICONS.calendar}</span><div><small>Vencimiento</small><strong>${dateShort(summary.due)}</strong></div></div>
        <div><span>${ICONS.coins}</span><div><small>Pago mínimo</small><strong>${summary.minimum > 0 ? money(summary.minimum) : 'No informado'}</strong></div></div>
      </div>
      <div class="hf-v24-details" hidden>${cardDetails(summary)}</div>
      <div class="hf-v24-actions">
        <button type="button" class="hf-v24-primary-action">Registrar pago</button>
        <button type="button" class="hf-v24-details-button" aria-expanded="false"><span>Ver detalles</span>${ICONS.down}</button>
      </div>`;

    attachCommonCardEvents(card, 'card', item, summary);
  }

  function renderLoan(card, summary) {
    const item = summary.item;
    const name = loanName(item);
    const signature = JSON.stringify([item.id, summary.balance, summary.installment, summary.due, summary.progress, VERSION]);
    if (card.dataset.hfV24Signature === signature) return;

    const progressRight = summary.totalInstallments > 0
      ? `${summary.paidInstallments} de ${summary.totalInstallments} cuotas`
      : summary.originalAmount > 0
        ? `Original ${money(summary.originalAmount)}`
        : 'Progreso sin datos';

    card.dataset.hfV24Signature = signature;
    card.className = `hf-family-card hf-v24-debt-card hf-v24-loan hf-v24-${summary.tone}`;
    card.innerHTML = `
      <div class="hf-v24-card-head">
        <div class="hf-v24-brand hf-v24-brand-portuaria">${escapeHTML(initials(name))}</div>
        <div class="hf-v24-identity">
          <div class="hf-v24-title-row"><strong>${escapeHTML(name)}</strong><span class="hf-v24-status">${escapeHTML(summary.label)}</span></div>
          <small>Préstamo</small>
        </div>
        ${isAdmin() ? menuMarkup() : ''}
      </div>
      <div class="hf-v24-metrics">
        <div><span>Falta pagar</span><strong>${money(summary.balance)}</strong></div>
        <div><span>Próxima cuota</span><strong>${summary.installment > 0 ? money(summary.installment) : 'No informada'}</strong></div>
      </div>
      <div class="hf-v24-progress"><i style="width:${summary.progress.toFixed(1)}%"></i></div>
      <div class="hf-v24-progress-labels"><span>${Math.round(summary.progress)}% pagado</span><span>${escapeHTML(progressRight)}</span></div>
      <div class="hf-v24-glance">
        <div><span>${ICONS.calendar}</span><div><small>Vencimiento</small><strong>${dateShort(summary.due)}</strong></div></div>
        <div><span>${ICONS.layers}</span><div><small>Cuotas restantes</small><strong>${item.cuotasRestantes ?? item.cuotasPendientes ?? 'No informadas'}</strong></div></div>
      </div>
      <div class="hf-v24-details" hidden>${loanDetails(summary)}</div>
      <div class="hf-v24-actions">
        <button type="button" class="hf-v24-primary-action">Pagar cuota</button>
        <button type="button" class="hf-v24-details-button" aria-expanded="false"><span>Ver detalles</span>${ICONS.down}</button>
      </div>`;

    attachCommonCardEvents(card, 'loan', item, summary);
  }

  async function renderDebtPage() {
    if (state.rendering || !window.DB) return;
    const view = $('hf-family-debt-view');
    if (!view) return;
    const lists = view.querySelectorAll('.hf-family-card-list');
    if (lists.length < 2) return;

    state.rendering = true;
    try {
      const [cards, loans] = await Promise.all([
        window.DB.getTarjetas?.().catch(() => []) || [],
        window.DB.getPrestamos?.().catch(() => []) || []
      ]);

      const cardElements = [...lists[0].querySelectorAll('.hf-family-card')];
      const loanElements = [...lists[1].querySelectorAll('.hf-family-card')];
      cardElements.forEach((element, index) => cards[index] && renderCard(element, cardSummary(cards[index])));
      loanElements.forEach((element, index) => loans[index] && renderLoan(element, loanSummary(loans[index])));
    } catch (error) {
      console.warn('No se pudo aplicar el rediseño de Deudas V24:', error);
    } finally {
      state.rendering = false;
    }
  }

  function enhancePaymentRows() {
    document.querySelectorAll('#hf-admin-card-actions .hf-admin-card-row').forEach(row => {
      row.classList.add('hf-v24-admin-payment-row');
      const button = row.querySelector('button');
      if (button) button.textContent = 'Registrar pago';
    });
  }

  function repair() {
    try { enhanceAdminModal(); } catch (error) { console.warn(error); }
    try { installCardFormHandlers(); } catch (error) { console.warn(error); }
    try { ensureAvailableBalanceField(); } catch (error) { console.warn(error); }
    try { enhancePaymentRows(); } catch (error) { console.warn(error); }
    renderDebtPage();
    document.body?.classList.add('hf-deudas-redesign-v24');
  }

  function scheduleRepair() {
    clearTimeout(state.timer);
    state.timer = setTimeout(repair, 90);
  }

  function startHealing() {
    clearInterval(state.healingTimer);
    state.healingRuns = 0;
    state.healingTimer = setInterval(() => {
      repair();
      state.healingRuns += 1;
      if (state.healingRuns >= 40) clearInterval(state.healingTimer);
    }, 350);
  }

  function start() {
    repair();
    startHealing();

    if (!state.observer) {
      state.observer = new MutationObserver(scheduleRepair);
      state.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden']
      });
    }

    document.addEventListener('click', event => {
      if (event.target.closest('.hf-v24-menu-wrap')) return;
      closeMenus();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenus();
    });

    ['hf:deuda-actualizada','hf:deudas-core-actualizadas','hf:estado-cuenta-confirmado','hf:deudas-recalculadas']
      .forEach(eventName => window.addEventListener(eventName, scheduleRepair));
  }

  window.HFDeudasRedesign24 = Object.freeze({
    version: VERSION,
    repair,
    renderDebtPage,
    enhanceAdminModal,
    ensureCardFields,
    ensureAvailableBalanceField,
    openEditCard,
    saveCard
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

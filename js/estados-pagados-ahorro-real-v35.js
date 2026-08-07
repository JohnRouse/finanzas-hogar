/* Hogar Finanzas — Estados pagados + ahorro reservado real V35 */
(() => {
  'use strict';

  const VERSION = '35.0-beta.1';
  if (window.HFEstadosPagadosAhorroReal35?.version === VERSION) return;

  const state = {
    started: false,
    syncingDebts: false,
    debtTimer: null,
    cards: [],
    loans: [],
    movements: [],
    cardPayments: new Map(),
    loanPayments: new Map(),
    goals: [],
    baseSummary: null,
    correctedSummary: null,
    originalRenderMetas: null,
    transferGoalId: null,
    transferType: 'aporte',
    goalObserver: null
  };

  const $ = id => document.getElementById(id);
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const money = value => `S/ ${number(value).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));

  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
  }

  function dateMs(value) {
    const date = validDate(value);
    return date ? new Date(`${date}T12:00:00`).getTime() : 0;
  }

  function addDays(value, days) {
    const date = validDate(value);
    if (!date) return '';
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + Number(days || 0));
    return d.toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function addMonths(value, months = 1) {
    const date = validDate(value);
    if (!date) return '';
    const d = new Date(`${date}T12:00:00`);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d.toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function todayISO() {
    return new Date().toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function visibleMonth() {
    const text = String($('month-display')?.textContent || '').toLowerCase();
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const found = months.findIndex(month => text.includes(month));
    const year = text.match(/\b(20\d{2})\b/)?.[1];
    if (found >= 0 && year) return `${year}-${String(found + 1).padStart(2, '0')}`;
    return window.DB?.getMesActual?.() || todayISO().slice(0, 7);
  }

  function normalizeMonth(value, fallbackDate = '') {
    const direct = String(value || '').trim();
    if (/^\d{4}-\d{2}$/.test(direct)) return direct;
    if (/^\d{4}-\d{2}-\d{2}/.test(direct)) return direct.slice(0, 7);
    const clean = direct.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const index = months.findIndex(month => clean.includes(month));
    const year = clean.match(/\b(20\d{2})\b/)?.[1];
    if (index >= 0 && year) return `${year}-${String(index + 1).padStart(2, '0')}`;
    const fallback = validDate(String(fallbackDate || '').slice(0, 10));
    return fallback ? fallback.slice(0, 7) : '';
  }

  function cardName(card = {}) {
    return card.nombre || card.banco || 'Tarjeta';
  }

  function loanName(loan = {}) {
    return loan.nombre || loan.entidad || loan.banco || 'Préstamo';
  }

  function currentMember() {
    try {
      const member = window.obtenerMiembroActual?.();
      if (member) return { id:member.id || '', legacy:member.legacyTipo || 'yo', name:member.nombre || '' };
    } catch (_) {}
    const legacy = localStorage.getItem('miUsuarioTipo') || 'yo';
    return { id:localStorage.getItem('miembroActualId') || '', legacy, name:legacy === 'pareja' ? 'Sydney' : 'Christian' };
  }

  function isCardPayment(movement, card) {
    if (!movement || !card) return false;
    if (movement.tipoMovimiento === 'pagoTarjeta' && String(movement.tarjetaId || '') === String(card.id)) return true;
    if (movement.tipoMovimiento === 'pagoTarjeta' && !movement.tarjetaId && String(movement.tarjetaNombre || '').toLowerCase() === cardName(card).toLowerCase()) return true;
    const description = String(movement.desc || '').toLowerCase();
    return movement.cat === 'Deudas' && description.startsWith(`pago tarjeta: ${cardName(card).toLowerCase()}`);
  }

  function isLoanPayment(movement, loan) {
    if (!movement || !loan) return false;
    if (movement.tipoMovimiento === 'pagoPrestamo' && String(movement.prestamoId || '') === String(loan.id)) return true;
    if (movement.tipoMovimiento === 'pagoPrestamo' && !movement.prestamoId && String(movement.prestamoNombre || '').toLowerCase() === loanName(loan).toLowerCase()) return true;
    const description = String(movement.desc || '').toLowerCase();
    return movement.cat === 'Deudas' && /^pago pr[eé]stamo:/i.test(description) && description.includes(loanName(loan).toLowerCase());
  }

  function statementWindow(card = {}) {
    const statement = card.estadoCuenta || {};
    const due = validDate(statement.fechaVencimiento || card.fechaVencimiento);
    const close = validDate(statement.fechaCierre || card.fechaCierre);
    const month = normalizeMonth(card.ultimoEstadoMes || statement.mes || statement.periodo, close || due || card.actualizadoEn);
    let start = close;
    if (!start && due) start = addDays(due, -35);
    if (!start && month) start = `${month}-01`;
    const end = close ? addMonths(close, 1) : (start ? addMonths(start, 1) : '');
    return { statement, due, close, month, start, end };
  }

  function deriveCardPaymentState(card, allMovements = state.movements) {
    const windowInfo = statementWindow(card);
    const payments = allMovements
      .filter(movement => isCardPayment(movement, card))
      .filter(movement => {
        const when = dateMs(movement.fecha);
        if (!when) return false;
        if (windowInfo.start && when < dateMs(windowInfo.start)) return false;
        if (windowInfo.end && when >= dateMs(windowInfo.end)) return false;
        return true;
      })
      .sort((a, b) => dateMs(b.fecha) - dateMs(a.fecha));

    const paid = round(payments.reduce((sum, payment) => sum + number(payment.monto), 0));
    const totalTarget = Math.max(0, number(
      windowInfo.statement.pagoTotal
      ?? windowInfo.statement.deudaFacturada
      ?? windowInfo.statement.deudaConfirmadaPEN
      ?? windowInfo.statement.deudaActualPEN
    ));
    const minimumTarget = Math.max(0, number(windowInfo.statement.pagoMinimo ?? card.pagoMinimo));
    const latest = payments[0] || null;
    const latestFull = payments.some(payment => {
      const before = number(payment.deudaAnterior);
      const after = payment.deudaPosterior === null || payment.deudaPosterior === undefined ? null : number(payment.deudaPosterior);
      return (after !== null && after <= 0.01)
        || (before > 0 && number(payment.monto) >= before - 0.01);
    });

    let status = 'pendiente';
    let label = '';
    if (latestFull || (totalTarget > 0 && paid >= totalTarget - 0.01)) {
      status = 'pagada';
      label = 'Pagada';
    } else if (minimumTarget > 0 && paid >= minimumTarget - 0.01) {
      status = 'minimo';
      label = 'Mínimo pagado';
    } else if (paid > 0) {
      status = 'pago';
      label = 'Pago registrado';
    }

    const debt = Math.max(0, number(window.HFDeudasActuales?.obtenerTarjeta?.(card.id)?.deudaEstimada ?? card.deuda ?? card.saldo));
    const limit = Math.max(0, number(card.limite ?? card.lineaTotal));
    const usage = limit > 0 ? debt / limit * 100 : 0;
    const satisfied = status !== 'pendiente';
    const remainingStatement = totalTarget > 0 ? Math.max(0, round(totalTarget - paid)) : null;

    return {
      cardId:String(card.id),
      name:cardName(card),
      status,
      label,
      satisfied,
      paid,
      totalTarget,
      minimumTarget,
      remainingStatement,
      latestPaymentDate:latest?.fecha || '',
      statementMonth:windowInfo.month,
      statementDue:windowInfo.due,
      usage,
      debt,
      limit
    };
  }

  function deriveLoanPaymentState(loan, allMovements = state.movements) {
    const payments = allMovements
      .filter(movement => isLoanPayment(movement, loan))
      .sort((a, b) => dateMs(b.fecha) - dateMs(a.fecha));
    const latest = payments[0] || null;
    const balance = Math.max(0, number(loan.saldoPendiente ?? loan.saldo ?? loan.deuda ?? loan.montoPendiente ?? loan.monto));
    const due = validDate(loan.proximoVencimiento || loan.fechaVencimiento || loan.vencimiento);
    const advancedDue = validDate(latest?.proximoVencimientoPosterior);
    const effectiveDue = advancedDue && (!due || dateMs(advancedDue) > dateMs(due)) ? advancedDue : due;
    const marked = Boolean(latest?.cuotaMarcada);
    return {
      loanId:String(loan.id),
      name:loanName(loan),
      balance,
      latestPaymentDate:latest?.fecha || '',
      effectiveDue,
      advanced:marked && advancedDue && advancedDue !== due,
      status:balance <= 0 ? 'pagado' : marked ? 'cuota-pagada' : 'pendiente',
      label:balance <= 0 ? 'Pagado' : marked ? 'Cuota pagada' : ''
    };
  }

  async function syncDebtPaymentStates() {
    if (state.syncingDebts || !window.DB?.getTarjetas || !window.DB?.getPrestamos || !window.DB?.getGastos) return;
    state.syncingDebts = true;
    document.body?.classList.add('hf-v35-status-loading');
    try {
      const [cards, loans, movements] = await Promise.all([
        DB.getTarjetas(),
        DB.getPrestamos(),
        DB.getGastos(null)
      ]);
      state.cards = Array.isArray(cards) ? cards : [];
      state.loans = Array.isArray(loans) ? loans : [];
      state.movements = Array.isArray(movements) ? movements : [];
      state.cardPayments = new Map(state.cards.map(card => [String(card.id), deriveCardPaymentState(card, state.movements)]));
      state.loanPayments = new Map(state.loans.map(loan => [String(loan.id), deriveLoanPaymentState(loan, state.movements)]));
      patchDebtDOM();
      patchAttentionAlerts();
      document.body?.classList.add('hf-v35-status-ready');
    } catch (error) {
      console.warn('No se pudo calcular el estado real de los pagos:', error);
    } finally {
      state.syncingDebts = false;
      document.body?.classList.remove('hf-v35-status-loading');
    }
  }

  function scheduleDebtSync(delay = 180) {
    clearTimeout(state.debtTimer);
    state.debtTimer = setTimeout(syncDebtPaymentStates, delay);
  }

  function paymentDetailHTML(paymentState) {
    if (!paymentState?.satisfied) return '';
    let detail = paymentState.paid > 0 ? `${money(paymentState.paid)} registrado` : 'Pago registrado';
    if (paymentState.totalTarget > 0) detail += ` de ${money(paymentState.totalTarget)} del estado`;
    else if (paymentState.minimumTarget > 0) detail += ` · mínimo ${money(paymentState.minimumTarget)}`;
    if (paymentState.latestPaymentDate) detail += ` · ${new Date(`${paymentState.latestPaymentDate}T12:00:00`).toLocaleDateString('es-PE', { day:'2-digit', month:'short' })}`;
    return `<div class="hf-v35-paid-summary ${escapeHTML(paymentState.status)}"><span>✓</span><div><strong>${escapeHTML(paymentState.label)}</strong><small>${escapeHTML(detail)}</small></div></div>`;
  }

  function patchDebtDOM() {
    const root = $('hf-family-debt-view');
    if (!root) return;

    root.querySelectorAll('.hf-v24-debt-card[data-debt-type="card"]').forEach(cardNode => {
      const payment = state.cardPayments.get(String(cardNode.dataset.debtId));
      if (!payment) return;
      const badge = cardNode.querySelector('.hf-v24-status');
      const currentlyExceeded = payment.limit > 0 && payment.debt > payment.limit + 0.01;
      if (payment.satisfied && !currentlyExceeded && badge) {
        badge.textContent = payment.label;
        cardNode.classList.remove('hf-v24-danger', 'hf-v24-warning', 'hf-v24-good');
        cardNode.classList.add(payment.status === 'pagada' ? 'hf-v24-good' : 'hf-v24-warning');
      }
      const details = cardNode.querySelector('.hf-v24-details');
      if (details) {
        details.querySelector('.hf-v35-paid-summary')?.remove();
        const html = paymentDetailHTML(payment);
        if (html) details.insertAdjacentHTML('afterbegin', html);
      }
    });

    root.querySelectorAll('.hf-v24-debt-card[data-debt-type="loan"]').forEach(loanNode => {
      const payment = state.loanPayments.get(String(loanNode.dataset.debtId));
      if (!payment) return;
      if (payment.status === 'pagado' || payment.advanced) {
        const badge = loanNode.querySelector('.hf-v24-status');
        if (badge) badge.textContent = payment.status === 'pagado' ? 'Pagado' : 'Al día';
        loanNode.classList.remove('hf-v24-danger', 'hf-v24-warning');
        loanNode.classList.add('hf-v24-good');
        if (payment.effectiveDue) {
          const glance = [...loanNode.querySelectorAll('.hf-v24-glance > div')].find(node => /vencimiento/i.test(node.textContent || ''));
          const value = glance?.querySelector('strong');
          if (value) value.textContent = new Date(`${payment.effectiveDue}T12:00:00`).toLocaleDateString('es-PE', { day:'2-digit', month:'short' });
        }
      }
    });
  }

  function patchAttentionAlerts() {
    const list = document.querySelector('#necesita-atencion .hf-compact-alert-list');
    if (!list) return;
    [...list.querySelectorAll('.hf-compact-alert')].forEach(alert => {
      const name = String(alert.querySelector('strong')?.textContent || '').trim().toLowerCase();
      const detailNode = alert.querySelector('small');
      const detail = String(detailNode?.textContent || '').toLowerCase();
      const payment = [...state.cardPayments.values()].find(item => item.name.toLowerCase() === name);
      if (!payment?.satisfied || !/venc/.test(detail)) return;

      if (payment.usage >= 90) {
        if (detailNode) detailNode.textContent = `${payment.label} · ${Math.round(payment.usage)}% de la línea utilizada`;
        alert.classList.remove('danger');
        alert.classList.add('warning');
      } else {
        alert.remove();
      }
    });

    if (!list.querySelector('.hf-compact-alert')) {
      const container = $('necesita-atencion');
      if (container) container.innerHTML = '<div class="hf-compact-alert-empty"><span>✓</span><div><strong>Todo está al día</strong><small>No hay vencimientos pendientes ni tarjetas excedidas.</small></div></div>';
    }
  }

  function installDebtRenderWrapper() {
    const current = window.HFDeudasRedesign24;
    if (!current || current.__hfV35Wrapped) return false;
    const originalRender = current.renderDebtPage?.bind(current);
    if (typeof originalRender !== 'function') return false;
    window.HFDeudasRedesign24 = Object.freeze({
      ...current,
      __hfV35Wrapped:true,
      renderDebtPage:async (...args) => {
        const result = await originalRender(...args);
        patchDebtDOM();
        return result;
      }
    });
    return true;
  }

  function netReservedForMonth(goals = state.goals, month = visibleMonth()) {
    return round((goals || []).reduce((sum, goal) => sum + number(goal?.reservadoMeses?.[month]), 0));
  }

  function totalReserved(goals = state.goals) {
    return round((goals || []).reduce((sum, goal) => sum + number(goal.actual), 0));
  }

  function correctSummary(base) {
    if (!base) return null;
    const month = visibleMonth();
    const savedThisMonth = netReservedForMonth(state.goals, month);
    const cashBeforeSaving = round(number(base.ingresoTotal) - number(base.consumosEfectivo) - number(base.pagosDeudaMes));
    const available = round(cashBeforeSaving - savedThisMonth);
    return {
      ...base,
      ahorroReservado:totalReserved(state.goals),
      ahorroApartadoMes:savedThisMonth,
      disponibleSinAsignar:available
    };
  }

  function patchAvailableUI() {
    const corrected = correctSummary(state.baseSummary);
    if (!corrected) return;
    state.correctedSummary = corrected;

    const available = corrected.disponibleSinAsignar;
    const mainValue = $('kpi-disponible');
    if (mainValue) mainValue.textContent = money(available);
    const mainCard = mainValue?.closest('.month-money-card');
    const mainHelp = mainCard?.querySelector('.month-money-help');
    if (mainHelp) mainHelp.textContent = 'Ingresos menos gastos, pagos de deuda y dinero apartado este mes';

    const savingValue = $('kpi-ahorro-real');
    if (savingValue) savingValue.textContent = money(corrected.ahorroReservado);
    const savingHelp = savingValue?.closest('.month-money-card')?.querySelector('.month-money-help');
    if (savingHelp) {
      savingHelp.textContent = corrected.ahorroApartadoMes === 0
        ? 'Dinero reservado en tus metas'
        : `Fondo reservado · Este mes ${corrected.ahorroApartadoMes >= 0 ? '+' : '−'} ${money(Math.abs(corrected.ahorroApartadoMes))}`;
    }

    const objective = document.querySelector('#regla-502030 .hf-financial-objective.available');
    const objectiveValue = objective?.querySelector('strong');
    const objectiveHelp = objective?.querySelector('small');
    if (objectiveValue) objectiveValue.textContent = money(Math.max(0, available));
    if (objectiveHelp) objectiveHelp.textContent = 'Después de gastos, pagos de deuda y ahorro apartado';

    const distribution = document.querySelector('#distribucion-content .hf-coherent-dist-row.available');
    if (distribution) {
      const strong = distribution.querySelector('div > strong');
      const bar = distribution.querySelector('.hf-coherent-dist-track i');
      const help = distribution.querySelector('small');
      const pct = corrected.ingresoTotal > 0 ? Math.max(0, available / corrected.ingresoTotal * 100) : 0;
      if (strong) strong.textContent = `${money(Math.max(0, available))} · ${Math.round(pct)}%`;
      if (bar) bar.style.width = `${Math.min(100, pct).toFixed(1)}%`;
      if (help) help.textContent = 'Dinero del mes que todavía no está gastado, pagado ni reservado.';
    }

    window.dispatchEvent(new CustomEvent('hf:disponible-real-actualizado', { detail:corrected }));
  }

  function patchGoalCreationCopy() {
    const input = $('m-actual');
    const wrapper = input?.closest('div');
    const label = wrapper?.querySelector('.input-label');
    if (label) label.textContent = 'Saldo ya reservado antes de crear la meta (opcional)';
    if (input) input.placeholder = '0.00';
    if (wrapper && !wrapper.querySelector('.hf-v35-legacy-saving-help')) {
      wrapper.insertAdjacentHTML('beforeend', '<small class="field-help hf-v35-legacy-saving-help">Úsalo solo si ese dinero ya estaba separado. Los nuevos aportes se harán desde “Apartar dinero”.</small>');
    }
  }

  function goalById(id) {
    return state.goals.find(goal => String(goal.id) === String(id)) || null;
  }

  function decorateGoals(goals = state.goals) {
    state.goals = Array.isArray(goals) ? goals : [];
    const container = $('savingGoals');
    if (!container) return;
    const cards = [...container.querySelectorAll('.saving-goal')];
    cards.forEach((card, index) => {
      const goal = state.goals[index];
      if (!goal) return;
      card.dataset.hfGoalId = goal.id;
      card.querySelector('.hf-v35-saving-actions')?.remove();
      const current = Math.max(0, number(goal.actual));
      const remaining = Math.max(0, round(number(goal.objetivo) - current));
      const actions = document.createElement('div');
      actions.className = 'hf-v35-saving-actions';
      actions.innerHTML = `
        <button type="button" class="primary" data-hf-saving="aporte" data-goal-id="${escapeHTML(goal.id)}" ${remaining <= 0 ? 'disabled' : ''}>${remaining <= 0 ? 'Meta cumplida' : 'Apartar dinero'}</button>
        <button type="button" data-hf-saving="retiro" data-goal-id="${escapeHTML(goal.id)}" ${current <= 0 ? 'disabled' : ''}>Retirar</button>
        <button type="button" class="history" data-hf-saving="historial" data-goal-id="${escapeHTML(goal.id)}" aria-label="Ver movimientos de ${escapeHTML(goal.nombre || 'la meta')}">Movimientos</button>`;
      card.appendChild(actions);
    });

    let note = $('hf-v35-saving-accounting-note');
    if (!note && state.goals.length) {
      note = document.createElement('div');
      note.id = 'hf-v35-saving-accounting-note';
      note.className = 'hf-v35-saving-accounting-note';
      note.innerHTML = '<span>↔</span><p><strong>El ahorro ahora se separa de verdad.</strong> Lo que apartes deja de contar como disponible; al retirarlo vuelve al dinero disponible.</p>';
      container.before(note);
    }
    patchGoalCreationCopy();
  }

  function installGoalRenderWrapper() {
    if (state.originalRenderMetas || typeof window.renderMetas !== 'function') return false;
    state.originalRenderMetas = window.renderMetas;
    window.renderMetas = function renderMetasV35(goals) {
      state.goals = Array.isArray(goals) ? goals : [];
      const result = state.originalRenderMetas.apply(this, arguments);
      queueMicrotask(() => {
        decorateGoals(state.goals);
        patchAvailableUI();
      });
      return result;
    };
    return true;
  }

  function ensureSavingModals() {
    if (!$('hfSavingTransferModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="hfSavingTransferModal" onclick="closeModalOutside(event,'hfSavingTransferModal')">
          <div class="modal-sheet hf-v35-saving-sheet" style="position:relative">
            <button class="modal-close" type="button" onclick="closeModal('hfSavingTransferModal')">✕</button>
            <div class="modal-handle"></div>
            <div class="modal-title" id="hf-v35-saving-title">Apartar dinero</div>
            <div class="hf-v35-saving-context" id="hf-v35-saving-context"></div>
            <div class="input-row">
              <label class="input-label" for="hf-v35-saving-amount">Monto (S/)</label>
              <input class="input-field" id="hf-v35-saving-amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00">
            </div>
            <div class="input-row">
              <label class="input-label" for="hf-v35-saving-date">Fecha</label>
              <input class="input-field" id="hf-v35-saving-date" type="date">
            </div>
            <div class="input-row">
              <label class="input-label" for="hf-v35-saving-note">Nota (opcional)</label>
              <input class="input-field" id="hf-v35-saving-note" type="text" maxlength="120" placeholder="Ej.: Aporte de agosto">
            </div>
            <div class="hf-v35-saving-preview" id="hf-v35-saving-preview" aria-live="polite"></div>
            <button class="modal-btn primary" id="hf-v35-saving-submit" type="button">Apartar dinero</button>
          </div>
        </div>`);
      $('hf-v35-saving-amount')?.addEventListener('input', updateSavingPreview);
      $('hf-v35-saving-date')?.addEventListener('change', updateSavingPreview);
      $('hf-v35-saving-submit')?.addEventListener('click', submitSavingTransfer);
    }

    if (!$('hfSavingHistoryModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="hfSavingHistoryModal" onclick="closeModalOutside(event,'hfSavingHistoryModal')">
          <div class="modal-sheet hf-v35-saving-sheet" style="position:relative">
            <button class="modal-close" type="button" onclick="closeModal('hfSavingHistoryModal')">✕</button>
            <div class="modal-handle"></div>
            <div class="modal-title" id="hf-v35-history-title">Movimientos de la meta</div>
            <div class="hf-v35-saving-history" id="hf-v35-saving-history"><div class="empty-state">Cargando movimientos…</div></div>
          </div>
        </div>`);
    }
  }

  async function ensureCorrectedSummary() {
    if (state.correctedSummary) return state.correctedSummary;
    try {
      const result = await window.HFCoherenciaFinanciera?.actualizar?.();
      if (result) {
        state.baseSummary = result;
        patchAvailableUI();
      }
    } catch (_) {}
    return state.correctedSummary;
  }

  async function openSavingTransfer(goalId, type) {
    ensureSavingModals();
    let goal = goalById(goalId);
    if (!goal) {
      state.goals = await DB.getMetas();
      goal = goalById(goalId);
    }
    if (!goal) return window.showToast?.('No se encontró la meta.', 'error');
    await ensureCorrectedSummary();
    state.transferGoalId = String(goalId);
    state.transferType = type === 'retiro' ? 'retiro' : 'aporte';

    const available = number(state.correctedSummary?.disponibleSinAsignar);
    const current = Math.max(0, number(goal.actual));
    const objective = Math.max(0, number(goal.objetivo));
    const remaining = Math.max(0, round(objective - current));
    const isContribution = state.transferType === 'aporte';

    $('hf-v35-saving-title').textContent = isContribution ? 'Apartar dinero' : 'Retirar de la meta';
    $('hf-v35-saving-context').innerHTML = `
      <div><span>Meta</span><strong>${escapeHTML(goal.nombre || 'Meta')}</strong></div>
      <div><span>Reservado</span><strong>${money(current)}</strong></div>
      <div><span>${isContribution ? 'Disponible hoy' : 'Puede retirarse'}</span><strong>${money(isContribution ? Math.max(0, available) : current)}</strong></div>`;
    const amount = $('hf-v35-saving-amount');
    amount.value = '';
    amount.max = isContribution ? Math.max(0, Math.min(available, remaining || available)) : current;
    amount.placeholder = isContribution && remaining > 0 ? `Máx. ${money(Math.min(Math.max(0, available), remaining))}` : `Máx. ${money(current)}`;
    $('hf-v35-saving-date').value = todayISO();
    $('hf-v35-saving-note').value = '';
    $('hf-v35-saving-submit').textContent = isContribution ? 'Apartar dinero' : 'Retirar dinero';
    updateSavingPreview();
    window.openModal?.('hfSavingTransferModal');
  }

  function updateSavingPreview() {
    const goal = goalById(state.transferGoalId);
    const preview = $('hf-v35-saving-preview');
    if (!goal || !preview) return;
    const amount = Math.max(0, number($('hf-v35-saving-amount')?.value));
    const current = Math.max(0, number(goal.actual));
    const available = number(state.correctedSummary?.disponibleSinAsignar);
    const contribution = state.transferType === 'aporte';
    const nextReserved = contribution ? current + amount : Math.max(0, current - amount);
    const nextAvailable = contribution ? available - amount : available + amount;
    preview.innerHTML = `
      <div><span>La meta quedará en</span><strong>${money(nextReserved)}</strong></div>
      <div><span>Disponible después</span><strong class="${nextAvailable < 0 ? 'danger' : ''}">${money(nextAvailable)}</strong></div>`;
  }

  async function submitSavingTransfer() {
    const goal = goalById(state.transferGoalId);
    if (!goal || !window.db || !window.DB?.hogarId) return window.showToast?.('No se pudo preparar la meta.', 'error');
    await ensureCorrectedSummary();
    const amount = round($('hf-v35-saving-amount')?.value);
    const date = validDate($('hf-v35-saving-date')?.value);
    const note = String($('hf-v35-saving-note')?.value || '').trim();
    if (!(amount > 0)) return window.showToast?.('Ingresa un monto mayor que cero.', 'error');
    if (!date) return window.showToast?.('Selecciona una fecha válida.', 'error');

    const contribution = state.transferType === 'aporte';
    const available = number(state.correctedSummary?.disponibleSinAsignar);
    const current = Math.max(0, number(goal.actual));
    const objective = Math.max(0, number(goal.objetivo));
    if (contribution && amount > available + 0.01) return window.showToast?.(`Solo hay ${money(Math.max(0, available))} disponibles para apartar.`, 'error');
    if (contribution && objective > 0 && current + amount > objective + 0.01) return window.showToast?.(`A la meta le faltan ${money(Math.max(0, objective - current))}.`, 'error');
    if (!contribution && amount > current + 0.01) return window.showToast?.(`Solo hay ${money(current)} reservados en esta meta.`, 'error');

    const button = $('hf-v35-saving-submit');
    if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
    try {
      const member = currentMember();
      const month = date.slice(0, 7);
      const goalRef = db.collection('hogares').doc(DB.hogarId).collection('metas').doc(String(goal.id));
      const movementRef = goalRef.collection('movimientos').doc();
      await db.runTransaction(async transaction => {
        const snap = await transaction.get(goalRef);
        if (!snap.exists) throw new Error('La meta ya no existe.');
        const data = snap.data() || {};
        const actualBefore = Math.max(0, number(data.actual));
        const objectiveNow = Math.max(0, number(data.objetivo));
        const currentMonthMap = { ...(data.reservadoMeses || {}) };
        const netBefore = number(currentMonthMap[month]);
        const signed = contribution ? amount : -amount;
        const actualAfter = round(actualBefore + signed);
        if (actualAfter < -0.01) throw new Error('El retiro supera lo reservado.');
        if (contribution && objectiveNow > 0 && actualAfter > objectiveNow + 0.01) throw new Error('El aporte supera el monto objetivo.');
        currentMonthMap[month] = round(netBefore + signed);
        transaction.update(goalRef, {
          actual:Math.max(0, actualAfter),
          reservadoMeses:currentMonthMap,
          actualizadoEn:new Date().toISOString()
        });
        transaction.set(movementRef, {
          tipo:contribution ? 'aporte' : 'retiro',
          monto:amount,
          fecha:date,
          mes:month,
          nota,
          quien:member.legacy,
          miembroId:member.id || null,
          miembroNombre:member.name || '',
          saldoAnterior:actualBefore,
          saldoPosterior:Math.max(0, actualAfter),
          creadoEn:firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      window.closeModal?.('hfSavingTransferModal');
      state.correctedSummary = null;
      state.goals = await DB.getMetas();
      window.showToast?.(contribution ? 'Dinero apartado en la meta.' : 'Dinero devuelto al disponible.');
      window.dispatchEvent(new CustomEvent('hf:ahorro-reservado-actualizado', { detail:{ goalId:goal.id, type:state.transferType, amount, month } }));
      await window.renderTodo?.();
      await window.HFCoherenciaFinanciera?.actualizar?.();
      decorateGoals(state.goals);
    } catch (error) {
      console.error('No se pudo mover el dinero de la meta:', error);
      window.showToast?.(error?.message || 'No se pudo actualizar la meta.', 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = state.transferType === 'aporte' ? 'Apartar dinero' : 'Retirar dinero'; }
    }
  }

  async function openSavingHistory(goalId) {
    ensureSavingModals();
    let goal = goalById(goalId);
    if (!goal) {
      state.goals = await DB.getMetas();
      goal = goalById(goalId);
    }
    if (!goal || !window.db || !window.DB?.hogarId) return;
    $('hf-v35-history-title').textContent = `Movimientos · ${goal.nombre || 'Meta'}`;
    const container = $('hf-v35-saving-history');
    container.innerHTML = '<div class="empty-state">Cargando movimientos…</div>';
    window.openModal?.('hfSavingHistoryModal');
    try {
      const snapshot = await db.collection('hogares').doc(DB.hogarId).collection('metas').doc(String(goal.id))
        .collection('movimientos').orderBy('fecha', 'desc').limit(80).get();
      const items = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));
      if (!items.length) {
        container.innerHTML = '<div class="empty-state">Todavía no hay aportes ni retiros registrados desde la app.</div>';
        return;
      }
      container.innerHTML = items.map(item => {
        const contribution = item.tipo !== 'retiro';
        return `<div class="hf-v35-history-row ${contribution ? 'aporte' : 'retiro'}">
          <span>${contribution ? '↓' : '↑'}</span>
          <div><strong>${contribution ? 'Dinero apartado' : 'Retiro de la meta'}</strong><small>${escapeHTML(item.fecha || '')}${item.miembroNombre ? ` · ${escapeHTML(item.miembroNombre)}` : ''}${item.nota ? ` · ${escapeHTML(item.nota)}` : ''}</small></div>
          <b>${contribution ? '+' : '−'} ${money(item.monto)}</b>
        </div>`;
      }).join('');
    } catch (error) {
      console.warn('No se pudo cargar el historial de la meta:', error);
      container.innerHTML = '<div class="empty-state">No se pudo cargar el historial en este momento.</div>';
    }
  }

  function handleGlobalClick(event) {
    const button = event.target.closest('[data-hf-saving]');
    if (!button) return;
    event.preventDefault();
    const action = button.dataset.hfSaving;
    const goalId = button.dataset.goalId;
    if (action === 'historial') openSavingHistory(goalId);
    else openSavingTransfer(goalId, action);
  }

  function installGoalObserver() {
    const container = $('savingGoals');
    if (!container || state.goalObserver) return;
    state.goalObserver = new MutationObserver(() => decorateGoals(state.goals));
    state.goalObserver.observe(container, { childList:true, subtree:false });
  }

  async function initialGoals() {
    try {
      state.goals = await DB.getMetas();
      decorateGoals(state.goals);
      patchAvailableUI();
    } catch (_) {}
  }

  function installWrappersWhenReady() {
    let attempts = 0;
    const timer = setInterval(() => {
      const goalReady = installGoalRenderWrapper();
      const debtReady = installDebtRenderWrapper();
      attempts += 1;
      if ((goalReady || state.originalRenderMetas) && (debtReady || window.HFDeudasRedesign24?.__hfV35Wrapped)) {
        clearInterval(timer);
        syncDebtPaymentStates();
        initialGoals();
      } else if (attempts >= 40) {
        clearInterval(timer);
      }
    }, 125);
  }

  function start() {
    if (state.started) return;
    state.started = true;
    ensureSavingModals();
    patchGoalCreationCopy();
    installGoalObserver();
    installWrappersWhenReady();
    document.addEventListener('click', handleGlobalClick);

    window.addEventListener('hf:coherencia-financiera-actualizada', event => {
      state.baseSummary = event.detail || null;
      patchAvailableUI();
      patchAttentionAlerts();
    });
    ['hf:deuda-actualizada','hf:gastos-actualizados','hf:estado-cuenta-confirmado','hf:deudas-core-actualizadas','hf:deudas-recalculadas']
      .forEach(name => window.addEventListener(name, () => scheduleDebtSync(180)));
    window.addEventListener('hf:ahorro-reservado-actualizado', () => {
      state.correctedSummary = null;
      patchAvailableUI();
    });

    setTimeout(() => {
      initialGoals();
      syncDebtPaymentStates();
      window.HFCoherenciaFinanciera?.actualizar?.();
    }, 650);
  }

  window.HFEstadosPagadosAhorroReal35 = Object.freeze({
    version:VERSION,
    syncDebtPaymentStates,
    deriveCardPaymentState,
    deriveLoanPaymentState,
    patchDebtDOM,
    patchAvailableUI,
    netReservedForMonth,
    totalReserved,
    openSavingTransfer,
    openSavingHistory,
    getState:() => ({
      version:VERSION,
      cards:state.cardPayments.size,
      loans:state.loanPayments.size,
      goals:state.goals.length,
      correctedSummary:state.correctedSummary
    })
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

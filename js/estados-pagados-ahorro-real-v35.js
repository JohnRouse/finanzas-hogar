/* Hogar Finanzas — Estados pagados + ahorro reservado real V35 */
(() => {
  'use strict';

  const VERSION = '35.0-beta.1';
  if (window.HFEstadosPagadosAhorroReal35?.version === VERSION) return;

  const state = {
    started:false,
    syncingDebts:false,
    debtTimer:null,
    cards:[],
    loans:[],
    movements:[],
    cardPayments:new Map(),
    loanPayments:new Map(),
    goals:[],
    baseSummary:null,
    correctedSummary:null,
    originalRenderMetas:null,
    goalObserver:null,
    transferGoalId:null,
    transferType:'aporte'
  };

  const $ = id => document.getElementById(id);
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const money = value => `S/ ${num(value).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
  const dateMs = value => validDate(value) ? new Date(`${value}T12:00:00`).getTime() : 0;

  function toISO(date) {
    return date.toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function addDays(value, amount) {
    if (!validDate(value)) return '';
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + Number(amount || 0));
    return toISO(date);
  }

  function addMonths(value, amount = 1) {
    if (!validDate(value)) return '';
    const date = new Date(`${value}T12:00:00`);
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    return toISO(date);
  }

  function todayISO() {
    return toISO(new Date());
  }

  function visibleMonth() {
    const text = String($('month-display')?.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const index = months.findIndex(month => text.includes(month));
    const year = text.match(/\b(20\d{2})\b/)?.[1];
    if (index >= 0 && year) return `${year}-${String(index + 1).padStart(2, '0')}`;
    return window.DB?.getMesActual?.() || todayISO().slice(0, 7);
  }

  function normalizeMonth(value, fallback = '') {
    const direct = String(value || '').trim();
    if (/^\d{4}-\d{2}$/.test(direct)) return direct;
    if (/^\d{4}-\d{2}-\d{2}/.test(direct)) return direct.slice(0, 7);
    const clean = direct.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const index = months.findIndex(month => clean.includes(month));
    const year = clean.match(/\b(20\d{2})\b/)?.[1];
    if (index >= 0 && year) return `${year}-${String(index + 1).padStart(2, '0')}`;
    const fallbackDate = validDate(String(fallback || '').slice(0, 10));
    return fallbackDate ? fallbackDate.slice(0, 7) : '';
  }

  function monthLastDay(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return '';
    const [year, number] = month.split('-').map(Number);
    const last = new Date(year, number, 0).getDate();
    return `${month}-${String(last).padStart(2, '0')}`;
  }

  const cardName = card => card?.nombre || card?.banco || 'Tarjeta';
  const loanName = loan => loan?.nombre || loan?.entidad || loan?.banco || 'Préstamo';

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
    if (movement.tipoMovimiento === 'pagoTarjeta') {
      if (movement.tarjetaId && String(movement.tarjetaId) === String(card.id)) return true;
      if (!movement.tarjetaId && String(movement.tarjetaNombre || '').toLowerCase() === cardName(card).toLowerCase()) return true;
    }
    const description = String(movement.desc || '').toLowerCase();
    return movement.cat === 'Deudas' && description.startsWith(`pago tarjeta: ${cardName(card).toLowerCase()}`);
  }

  function isLoanPayment(movement, loan) {
    if (!movement || !loan) return false;
    if (movement.tipoMovimiento === 'pagoPrestamo') {
      if (movement.prestamoId && String(movement.prestamoId) === String(loan.id)) return true;
      if (!movement.prestamoId && String(movement.prestamoNombre || '').toLowerCase() === loanName(loan).toLowerCase()) return true;
    }
    const description = String(movement.desc || '').toLowerCase();
    return movement.cat === 'Deudas' && /^pago pr[eé]stamo:/i.test(description) && description.includes(loanName(loan).toLowerCase());
  }

  function statementWindow(card = {}) {
    const statement = card.estadoCuenta || {};
    const live = window.HFDeudasActuales?.obtenerTarjeta?.(card.id) || {};
    const due = validDate(statement.fechaVencimiento || card.fechaVencimiento || live.fechaVencimiento);
    const close = validDate(statement.fechaCierre || card.fechaCierre || live.fechaCierre);
    const month = normalizeMonth(card.ultimoEstadoMes || statement.mes || statement.periodo, close || due || card.actualizadoEn) || visibleMonth();
    const start = close || (due ? addDays(due, -35) : `${month}-01`);
    /* Sin fecha de cierre exacta no se corta el ciclo antes del vencimiento.
       Se deja margen hasta 25 días después para reconocer pagos tardíos registrados. */
    const end = close ? addMonths(close, 1) : (due ? addDays(due, 25) : addMonths(`${month}-01`, 1));
    return { statement, due, close, month, start, end };
  }

  function deriveCardPaymentState(card, movements = state.movements) {
    const cycle = statementWindow(card);
    const payments = (movements || [])
      .filter(movement => isCardPayment(movement, card))
      .filter(movement => {
        const when = dateMs(movement.fecha);
        if (!when) return false;
        return (!cycle.start || when >= dateMs(cycle.start)) && (!cycle.end || when < dateMs(cycle.end));
      })
      .sort((a, b) => dateMs(b.fecha) - dateMs(a.fecha));

    const paid = round(payments.reduce((sum, payment) => sum + num(payment.monto), 0));
    const totalTarget = Math.max(0, num(
      cycle.statement.pagoTotal
      ?? cycle.statement.deudaFacturada
      ?? cycle.statement.deudaConfirmadaPEN
      ?? cycle.statement.deudaActualPEN
    ));
    const minimumTarget = Math.max(0, num(cycle.statement.pagoMinimo ?? card.pagoMinimo));
    const latest = payments[0] || null;
    const fullPayment = payments.some(payment => {
      const before = num(payment.deudaAnterior);
      const afterKnown = payment.deudaPosterior !== null && payment.deudaPosterior !== undefined;
      const after = afterKnown ? num(payment.deudaPosterior) : null;
      return (afterKnown && after <= 0.01) || (before > 0 && num(payment.monto) >= before - 0.01);
    });

    let status = 'pendiente';
    let label = '';
    if (fullPayment || (totalTarget > 0 && paid >= totalTarget - 0.01)) {
      status = 'pagada';
      label = 'Pagada';
    } else if (minimumTarget > 0 && paid >= minimumTarget - 0.01) {
      status = 'minimo';
      label = 'Mínimo pagado';
    } else if (paid > 0) {
      status = 'pago';
      label = 'Pago registrado';
    }

    const debt = Math.max(0, num(window.HFDeudasActuales?.obtenerTarjeta?.(card.id)?.deudaEstimada ?? card.deuda ?? card.saldo));
    const limit = Math.max(0, num(card.limite ?? card.lineaTotal));
    return {
      cardId:String(card.id),
      name:cardName(card),
      status,
      label,
      satisfied:status !== 'pendiente',
      paid,
      totalTarget,
      minimumTarget,
      remainingStatement:totalTarget > 0 ? Math.max(0, round(totalTarget - paid)) : null,
      latestPaymentDate:latest?.fecha || '',
      statementMonth:cycle.month,
      statementDue:cycle.due,
      usage:limit > 0 ? debt / limit * 100 : 0,
      debt,
      limit
    };
  }

  function deriveLoanPaymentState(loan, movements = state.movements) {
    const payments = (movements || []).filter(movement => isLoanPayment(movement, loan)).sort((a, b) => dateMs(b.fecha) - dateMs(a.fecha));
    const latest = payments[0] || null;
    const balance = Math.max(0, num(loan.saldoPendiente ?? loan.saldo ?? loan.deuda ?? loan.capitalPendiente ?? loan.montoPendiente ?? loan.monto));
    const due = validDate(loan.proximoVencimiento || loan.fechaVencimiento || loan.vencimiento);
    const advancedDue = validDate(latest?.proximoVencimientoPosterior);
    const effectiveDue = advancedDue && (!due || dateMs(advancedDue) > dateMs(due)) ? advancedDue : due;
    const advanced = Boolean(latest?.cuotaMarcada && advancedDue && advancedDue !== due);
    return {
      loanId:String(loan.id),
      name:loanName(loan),
      balance,
      latestPaymentDate:latest?.fecha || '',
      effectiveDue,
      advanced,
      status:balance <= 0 ? 'pagado' : advanced ? 'cuota-pagada' : 'pendiente',
      label:balance <= 0 ? 'Pagado' : advanced ? 'Cuota pagada' : ''
    };
  }

  function paymentDetailHTML(payment) {
    if (!payment?.satisfied) return '';
    let detail = payment.paid > 0 ? `${money(payment.paid)} registrado` : 'Pago registrado';
    if (payment.totalTarget > 0) detail += ` de ${money(payment.totalTarget)} del estado`;
    else if (payment.minimumTarget > 0) detail += ` · mínimo ${money(payment.minimumTarget)}`;
    if (payment.latestPaymentDate) detail += ` · ${new Date(`${payment.latestPaymentDate}T12:00:00`).toLocaleDateString('es-PE', { day:'2-digit', month:'short' })}`;
    return `<div class="hf-v35-paid-summary ${esc(payment.status)}"><span>✓</span><div><strong>${esc(payment.label)}</strong><small>${esc(detail)}</small></div></div>`;
  }

  function patchDebtDOM() {
    const root = $('hf-family-debt-view');
    if (!root) return;

    root.querySelectorAll('.hf-v24-debt-card[data-debt-type="card"]').forEach(node => {
      const payment = state.cardPayments.get(String(node.dataset.debtId));
      if (!payment) return;
      const badge = node.querySelector('.hf-v24-status');
      const exceeded = payment.limit > 0 && payment.debt > payment.limit + 0.01;
      if (payment.satisfied && !exceeded && badge) {
        badge.textContent = payment.label;
        node.classList.remove('hf-v24-danger', 'hf-v24-warning', 'hf-v24-good');
        node.classList.add(payment.status === 'pagada' ? 'hf-v24-good' : 'hf-v24-warning');
      }
      const details = node.querySelector('.hf-v24-details');
      if (details) {
        details.querySelector('.hf-v35-paid-summary')?.remove();
        const html = paymentDetailHTML(payment);
        if (html) details.insertAdjacentHTML('afterbegin', html);
      }
    });

    root.querySelectorAll('.hf-v24-debt-card[data-debt-type="loan"]').forEach(node => {
      const payment = state.loanPayments.get(String(node.dataset.debtId));
      if (!payment || (payment.status !== 'pagado' && !payment.advanced)) return;
      const badge = node.querySelector('.hf-v24-status');
      if (badge) badge.textContent = payment.status === 'pagado' ? 'Pagado' : 'Al día';
      node.classList.remove('hf-v24-danger', 'hf-v24-warning');
      node.classList.add('hf-v24-good');
      if (payment.effectiveDue) {
        const glance = [...node.querySelectorAll('.hf-v24-glance > div')].find(item => /vencimiento/i.test(item.textContent || ''));
        const value = glance?.querySelector('strong');
        if (value) value.textContent = new Date(`${payment.effectiveDue}T12:00:00`).toLocaleDateString('es-PE', { day:'2-digit', month:'short' });
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
      } else alert.remove();
    });
    if (!list.querySelector('.hf-compact-alert')) {
      const container = $('necesita-atencion');
      if (container) container.innerHTML = '<div class="hf-compact-alert-empty"><span>✓</span><div><strong>Todo está al día</strong><small>No hay vencimientos pendientes ni tarjetas excedidas.</small></div></div>';
    }
  }

  async function syncDebtPaymentStates() {
    if (state.syncingDebts || !window.DB?.getTarjetas || !window.DB?.getPrestamos || !window.DB?.getGastos) return;
    state.syncingDebts = true;
    document.body?.classList.add('hf-v35-status-loading');
    try {
      const [cards, loans, movements] = await Promise.all([DB.getTarjetas(), DB.getPrestamos(), DB.getGastos(null)]);
      state.cards = cards || [];
      state.loans = loans || [];
      state.movements = movements || [];
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

  function installDebtRenderWrapper() {
    const current = window.HFDeudasRedesign24;
    if (!current || current.__hfV35Wrapped || typeof current.renderDebtPage !== 'function') return Boolean(current?.__hfV35Wrapped);
    const original = current.renderDebtPage.bind(current);
    window.HFDeudasRedesign24 = Object.freeze({
      ...current,
      __hfV35Wrapped:true,
      renderDebtPage:async (...args) => {
        const result = await original(...args);
        patchDebtDOM();
        return result;
      }
    });
    return true;
  }

  function totalReserved(goals = state.goals) {
    return round((goals || []).reduce((sum, goal) => sum + num(goal.actual), 0));
  }

  function netReservedForMonth(goals = state.goals, month = visibleMonth()) {
    return round((goals || []).reduce((sum, goal) => sum + num(goal?.reservadoMeses?.[month]), 0));
  }

  function correctSummary(base) {
    if (!base) return null;
    const savedThisMonth = netReservedForMonth(state.goals, visibleMonth());
    const cashBeforeSaving = round(num(base.ingresoTotal) - num(base.consumosEfectivo) - num(base.pagosDeudaMes));
    return {
      ...base,
      ahorroReservado:totalReserved(state.goals),
      ahorroApartadoMes:savedThisMonth,
      disponibleSinAsignar:round(cashBeforeSaving - savedThisMonth)
    };
  }

  function patchAvailableUI() {
    const corrected = correctSummary(state.baseSummary);
    if (!corrected) return;
    state.correctedSummary = corrected;
    const available = corrected.disponibleSinAsignar;

    const mainValue = $('kpi-disponible');
    if (mainValue) mainValue.textContent = money(available);
    const mainHelp = mainValue?.closest('.month-money-card')?.querySelector('.month-money-help');
    if (mainHelp) mainHelp.textContent = 'Ingresos menos gastos, pagos de deuda y dinero apartado este mes';

    const savingValue = $('kpi-ahorro-real');
    if (savingValue) savingValue.textContent = money(corrected.ahorroReservado);
    const savingHelp = savingValue?.closest('.month-money-card')?.querySelector('.month-money-help');
    if (savingHelp) savingHelp.textContent = corrected.ahorroApartadoMes === 0
      ? 'Dinero reservado en tus metas'
      : `Fondo reservado · Este mes ${corrected.ahorroApartadoMes >= 0 ? '+' : '−'} ${money(Math.abs(corrected.ahorroApartadoMes))}`;

    const objective = document.querySelector('#regla-502030 .hf-financial-objective.available');
    if (objective?.querySelector('strong')) objective.querySelector('strong').textContent = money(Math.max(0, available));
    if (objective?.querySelector('small')) objective.querySelector('small').textContent = 'Después de gastos, pagos de deuda y ahorro apartado';

    const distribution = document.querySelector('#distribucion-content .hf-coherent-dist-row.available');
    if (distribution) {
      const pct = corrected.ingresoTotal > 0 ? Math.max(0, available / corrected.ingresoTotal * 100) : 0;
      const strong = distribution.querySelector('div > strong');
      const bar = distribution.querySelector('.hf-coherent-dist-track i');
      const help = distribution.querySelector('small');
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

  const goalById = id => state.goals.find(goal => String(goal.id) === String(id)) || null;

  function decorateGoals(goals = state.goals) {
    state.goals = Array.isArray(goals) ? goals : [];
    const container = $('savingGoals');
    if (!container) return;
    [...container.querySelectorAll('.saving-goal')].forEach((card, index) => {
      const goal = state.goals[index];
      if (!goal) return;
      card.dataset.hfGoalId = goal.id;
      card.querySelector('.hf-v35-saving-actions')?.remove();
      const current = Math.max(0, num(goal.actual));
      const objective = Math.max(0, num(goal.objetivo));
      const remaining = objective > 0 ? Math.max(0, round(objective - current)) : Infinity;
      const actions = document.createElement('div');
      actions.className = 'hf-v35-saving-actions';
      actions.innerHTML = `
        <button type="button" class="primary" data-hf-saving="aporte" data-goal-id="${esc(goal.id)}" ${remaining <= 0 ? 'disabled' : ''}>${remaining <= 0 ? 'Meta cumplida' : 'Apartar dinero'}</button>
        <button type="button" data-hf-saving="retiro" data-goal-id="${esc(goal.id)}" ${current <= 0 ? 'disabled' : ''}>Retirar</button>
        <button type="button" class="history" data-hf-saving="historial" data-goal-id="${esc(goal.id)}">Movimientos</button>`;
      card.appendChild(actions);
    });
    if (!$('hf-v35-saving-accounting-note') && state.goals.length) {
      container.insertAdjacentHTML('beforebegin', '<div id="hf-v35-saving-accounting-note" class="hf-v35-saving-accounting-note"><span>↔</span><p><strong>El ahorro ahora se separa de verdad.</strong> Lo que apartes deja de contar como disponible; al retirarlo vuelve al dinero disponible.</p></div>');
    }
    patchGoalCreationCopy();
  }

  function installGoalRenderWrapper() {
    if (state.originalRenderMetas || typeof window.renderMetas !== 'function') return Boolean(state.originalRenderMetas);
    state.originalRenderMetas = window.renderMetas;
    window.renderMetas = function(goals) {
      state.goals = Array.isArray(goals) ? goals : [];
      const result = state.originalRenderMetas.apply(this, arguments);
      queueMicrotask(() => { decorateGoals(state.goals); patchAvailableUI(); });
      return result;
    };
    return true;
  }

  function ensureSavingModals() {
    if (!$('hfSavingTransferModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="hfSavingTransferModal" onclick="closeModalOutside(event,'hfSavingTransferModal')">
          <div class="modal-sheet hf-v35-saving-sheet" style="position:relative">
            <button class="modal-close" type="button" onclick="closeModal('hfSavingTransferModal')">✕</button><div class="modal-handle"></div>
            <div class="modal-title" id="hf-v35-saving-title">Apartar dinero</div>
            <div class="hf-v35-saving-context" id="hf-v35-saving-context"></div>
            <div class="input-row"><label class="input-label" for="hf-v35-saving-amount">Monto (S/)</label><input class="input-field" id="hf-v35-saving-amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></div>
            <div class="input-row"><label class="input-label" for="hf-v35-saving-date">Fecha</label><input class="input-field" id="hf-v35-saving-date" type="date"></div>
            <div class="input-row"><label class="input-label" for="hf-v35-saving-note">Nota (opcional)</label><input class="input-field" id="hf-v35-saving-note" type="text" maxlength="120" placeholder="Ej.: Aporte de agosto"></div>
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
            <button class="modal-close" type="button" onclick="closeModal('hfSavingHistoryModal')">✕</button><div class="modal-handle"></div>
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
      if (result) { state.baseSummary = result; patchAvailableUI(); }
    } catch (_) {}
    return state.correctedSummary;
  }

  async function openSavingTransfer(goalId, type = 'aporte') {
    ensureSavingModals();
    let goal = goalById(goalId);
    if (!goal) { state.goals = await DB.getMetas(); goal = goalById(goalId); }
    if (!goal) return window.showToast?.('No se encontró la meta.', 'error');
    await ensureCorrectedSummary();
    state.transferGoalId = String(goalId);
    state.transferType = type === 'retiro' ? 'retiro' : 'aporte';

    const contribution = state.transferType === 'aporte';
    const available = num(state.correctedSummary?.disponibleSinAsignar);
    const current = Math.max(0, num(goal.actual));
    const objective = Math.max(0, num(goal.objetivo));
    const remaining = objective > 0 ? Math.max(0, round(objective - current)) : Math.max(0, available);
    const month = visibleMonth();
    const today = todayISO();
    const defaultDate = today.slice(0, 7) === month ? today : `${month}-01`;

    $('hf-v35-saving-title').textContent = contribution ? 'Apartar dinero' : 'Retirar de la meta';
    $('hf-v35-saving-context').innerHTML = `<div><span>Meta</span><strong>${esc(goal.nombre || 'Meta')}</strong></div><div><span>Reservado</span><strong>${money(current)}</strong></div><div><span>${contribution ? 'Disponible hoy' : 'Puede retirarse'}</span><strong>${money(contribution ? Math.max(0, available) : current)}</strong></div>`;
    const amount = $('hf-v35-saving-amount');
    amount.value = '';
    amount.max = contribution ? Math.max(0, Math.min(available, remaining)) : current;
    amount.placeholder = `Máx. ${money(amount.max)}`;
    const date = $('hf-v35-saving-date');
    date.value = defaultDate;
    date.min = `${month}-01`;
    date.max = monthLastDay(month);
    $('hf-v35-saving-note').value = '';
    $('hf-v35-saving-submit').textContent = contribution ? 'Apartar dinero' : 'Retirar dinero';
    updateSavingPreview();
    window.openModal?.('hfSavingTransferModal');
  }

  function updateSavingPreview() {
    const goal = goalById(state.transferGoalId);
    const preview = $('hf-v35-saving-preview');
    if (!goal || !preview) return;
    const amount = Math.max(0, num($('hf-v35-saving-amount')?.value));
    const current = Math.max(0, num(goal.actual));
    const available = num(state.correctedSummary?.disponibleSinAsignar);
    const contribution = state.transferType === 'aporte';
    preview.innerHTML = `<div><span>La meta quedará en</span><strong>${money(contribution ? current + amount : Math.max(0, current - amount))}</strong></div><div><span>Disponible después</span><strong class="${(contribution ? available - amount : available + amount) < 0 ? 'danger' : ''}">${money(contribution ? available - amount : available + amount)}</strong></div>`;
  }

  async function submitSavingTransfer() {
    const goal = goalById(state.transferGoalId);
    if (!goal || !window.db || !window.DB?.hogarId) return window.showToast?.('No se pudo preparar la meta.', 'error');
    await ensureCorrectedSummary();
    const amount = round($('hf-v35-saving-amount')?.value);
    const date = validDate($('hf-v35-saving-date')?.value);
    const note = String($('hf-v35-saving-note')?.value || '').trim();
    if (!(amount > 0)) return window.showToast?.('Ingresa un monto mayor que cero.', 'error');
    if (!date || date.slice(0, 7) !== visibleMonth()) return window.showToast?.('La fecha debe pertenecer al mes que estás viendo.', 'error');

    const contribution = state.transferType === 'aporte';
    const available = num(state.correctedSummary?.disponibleSinAsignar);
    const current = Math.max(0, num(goal.actual));
    const objective = Math.max(0, num(goal.objetivo));
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
        const snapshot = await transaction.get(goalRef);
        if (!snapshot.exists) throw new Error('La meta ya no existe.');
        const data = snapshot.data() || {};
        const before = Math.max(0, num(data.actual));
        const target = Math.max(0, num(data.objetivo));
        const signed = contribution ? amount : -amount;
        const after = round(before + signed);
        if (after < -0.01) throw new Error('El retiro supera lo reservado.');
        if (contribution && target > 0 && after > target + 0.01) throw new Error('El aporte supera el monto objetivo.');
        const byMonth = { ...(data.reservadoMeses || {}) };
        byMonth[month] = round(num(byMonth[month]) + signed);
        transaction.update(goalRef, { actual:Math.max(0, after), reservadoMeses:byMonth, actualizadoEn:new Date().toISOString() });
        transaction.set(movementRef, {
          tipo:contribution ? 'aporte' : 'retiro', monto:amount, fecha:date, mes:month, nota,
          quien:member.legacy, miembroId:member.id || null, miembroNombre:member.name || '',
          saldoAnterior:before, saldoPosterior:Math.max(0, after),
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
    if (!goal) { state.goals = await DB.getMetas(); goal = goalById(goalId); }
    if (!goal || !window.db || !window.DB?.hogarId) return;
    $('hf-v35-history-title').textContent = `Movimientos · ${goal.nombre || 'Meta'}`;
    const container = $('hf-v35-saving-history');
    container.innerHTML = '<div class="empty-state">Cargando movimientos…</div>';
    window.openModal?.('hfSavingHistoryModal');
    try {
      const snapshot = await db.collection('hogares').doc(DB.hogarId).collection('metas').doc(String(goal.id)).collection('movimientos').orderBy('fecha', 'desc').limit(80).get();
      const items = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));
      container.innerHTML = items.length ? items.map(item => {
        const contribution = item.tipo !== 'retiro';
        return `<div class="hf-v35-history-row ${contribution ? 'aporte' : 'retiro'}"><span>${contribution ? '↓' : '↑'}</span><div><strong>${contribution ? 'Dinero apartado' : 'Retiro de la meta'}</strong><small>${esc(item.fecha || '')}${item.miembroNombre ? ` · ${esc(item.miembroNombre)}` : ''}${item.nota ? ` · ${esc(item.nota)}` : ''}</small></div><b>${contribution ? '+' : '−'} ${money(item.monto)}</b></div>`;
      }).join('') : '<div class="empty-state">Todavía no hay aportes ni retiros registrados desde la app.</div>';
    } catch (error) {
      console.warn('No se pudo cargar el historial de la meta:', error);
      container.innerHTML = '<div class="empty-state">No se pudo cargar el historial en este momento.</div>';
    }
  }

  function installGoalObserver() {
    const container = $('savingGoals');
    if (!container || state.goalObserver) return;
    state.goalObserver = new MutationObserver(() => decorateGoals(state.goals));
    state.goalObserver.observe(container, { childList:true, subtree:false });
  }

  async function initialGoals() {
    try { state.goals = await DB.getMetas(); decorateGoals(state.goals); patchAvailableUI(); }
    catch (_) {}
  }

  function installWrappersWhenReady() {
    let attempts = 0;
    const timer = setInterval(() => {
      const goalsReady = installGoalRenderWrapper();
      const debtsReady = installDebtRenderWrapper();
      attempts += 1;
      if ((goalsReady || state.originalRenderMetas) && (debtsReady || window.HFDeudasRedesign24?.__hfV35Wrapped)) {
        clearInterval(timer);
        syncDebtPaymentStates();
        initialGoals();
      } else if (attempts >= 40) clearInterval(timer);
    }, 125);
  }

  function start() {
    if (state.started) return;
    state.started = true;
    ensureSavingModals();
    patchGoalCreationCopy();
    installGoalObserver();
    installWrappersWhenReady();
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-hf-saving]');
      if (!button) return;
      event.preventDefault();
      button.dataset.hfSaving === 'historial'
        ? openSavingHistory(button.dataset.goalId)
        : openSavingTransfer(button.dataset.goalId, button.dataset.hfSaving);
    });

    window.addEventListener('hf:coherencia-financiera-actualizada', event => {
      state.baseSummary = event.detail || null;
      patchAvailableUI();
      patchAttentionAlerts();
    });
    ['hf:deuda-actualizada','hf:gastos-actualizados','hf:estado-cuenta-confirmado','hf:deudas-core-actualizadas','hf:deudas-recalculadas']
      .forEach(name => window.addEventListener(name, () => scheduleDebtSync(180)));
    window.addEventListener('hf:ahorro-reservado-actualizado', () => { state.correctedSummary = null; patchAvailableUI(); });

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
      cards:[...state.cardPayments.values()],
      loans:[...state.loanPayments.values()],
      goals:state.goals.map(goal => ({ id:goal.id, nombre:goal.nombre, actual:num(goal.actual), objetivo:num(goal.objetivo), reservadoMeses:goal.reservadoMeses || {} })),
      correctedSummary:state.correctedSummary
    })
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
/* Hogar Finanzas — Etapa 18 V35.0-beta.5: contabilidad de ahorro + pagos estables */
(() => {
  'use strict';

  const VERSION = '35.0-beta.5';
  if (window.HFEtapa18Beta5?.version === VERSION) return;

  const state = {
    started:false,
    installTimer:null,
    financeTimer:null,
    debtTimer:null,
    financeInFlight:null,
    debtInFlight:null,
    cards:new Map(),
    goals:[],
    transferGoalId:'',
    transferType:'aporte',
    originalRenderTodo:null,
    originalRenderMetas:null,
    originalAddGoal:null,
    coherenceWrapped:false,
    debtRendererWrapped:false,
    lastContext:null
  };

  const $ = id => document.getElementById(id);
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const money = value => `S/ ${num(value).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
  const dateMs = value => validDate(value) ? new Date(`${value}T12:00:00`).getTime() : 0;

  function todayISO() {
    return new Date().toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function visibleMonth() {
    const fromDb = window.DB?.getMesActual?.();
    if (/^\d{4}-\d{2}$/.test(String(fromDb || ''))) return fromDb;
    const text = String($('month-display')?.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const index = months.findIndex(m => text.includes(m));
    const year = text.match(/\b(20\d{2})\b/)?.[1];
    return index >= 0 && year ? `${year}-${String(index + 1).padStart(2,'0')}` : todayISO().slice(0,7);
  }

  function monthLastDay(month) {
    const [year, number] = String(month).split('-').map(Number);
    if (!year || !number) return '';
    return `${month}-${String(new Date(year, number, 0).getDate()).padStart(2,'0')}`;
  }

  function addDays(value, amount) {
    if (!validDate(value)) return '';
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + Number(amount || 0));
    return date.toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function addMonths(value, amount=1) {
    if (!validDate(value)) return '';
    const date = new Date(`${value}T12:00:00`);
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth()+1, 0).getDate()));
    return date.toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function currentMember() {
    try {
      const member = window.obtenerMiembroActual?.();
      if (member) return { id:member.id || '', legacy:member.legacyTipo || 'yo', name:member.nombre || '' };
    } catch (_) {}
    const legacy = localStorage.getItem('miUsuarioTipo') || 'yo';
    return { id:localStorage.getItem('miembroActualId') || '', legacy, name:legacy === 'pareja' ? 'Sydney' : 'Christian' };
  }

  function isDebtPayment(g={}) {
    return g.tipoMovimiento === 'pagoTarjeta'
      || g.tipoMovimiento === 'pagoPrestamo'
      || g.tipo === 'pago-tarjeta'
      || g.tipo === 'pago-prestamo'
      || (g.cat === 'Deudas' && /^pago (tarjeta|pr[eé]stamo):/i.test(String(g.desc || '')));
  }

  function reservedTotal(goals=[]) {
    return round(goals.reduce((sum, goal) => sum + Math.max(0, num(goal.actual)), 0));
  }

  function reservedNetMonth(goals=[], month=visibleMonth()) {
    return round(goals.reduce((sum, goal) => sum + num(goal?.reservadoMeses?.[month]), 0));
  }

  function trackedReservedTotal(goal={}) {
    const months = goal.reservadoMeses && typeof goal.reservadoMeses === 'object' ? goal.reservadoMeses : {};
    return round(Object.values(months).reduce((sum, value) => sum + num(value), 0));
  }

  async function reconcileSavingsLedger() {
    if (!window.db || !window.DB?.hogarId || !window.DB?.getMetas) return [];
    const month = visibleMonth();
    const goals = await DB.getMetas();
    const hogarRef = db.collection('hogares').doc(DB.hogarId);
    let changed = false;

    for (const goal of goals || []) {
      const actual = Math.max(0, round(goal.actual));
      const tracked = trackedReservedTotal(goal);
      const diff = round(actual - tracked);
      if (Math.abs(diff) < 0.01) continue;

      const byMonth = { ...(goal.reservadoMeses || {}) };
      byMonth[month] = round(num(byMonth[month]) + diff);
      await hogarRef.collection('metas').doc(String(goal.id)).update({
        reservadoMeses:byMonth,
        contabilidadAhorroV35:'beta5',
        reconciliadoEn:new Date().toISOString()
      });
      changed = true;
      console.info(`ℹ️ Ahorro reconciliado: ${goal.nombre || goal.id} · ${month} ${diff >= 0 ? '+' : ''}${diff}`);
    }

    const fresh = changed ? await DB.getMetas() : goals;
    state.goals = fresh || [];
    return state.goals;
  }

  async function financialContext() {
    if (state.financeInFlight) return state.financeInFlight;
    state.financeInFlight = (async () => {
      const month = visibleMonth();
      const [incomes, expenses, goals] = await Promise.all([
        DB.getIngresosMes?.(month) || [],
        DB.getGastos?.(month) || [],
        DB.getMetas?.() || []
      ]);

      const incomeTotal = round((incomes || []).reduce((sum, item) => sum + num(item.monto), 0));
      const cashOut = round((expenses || []).reduce((sum, item) => {
        if (isDebtPayment(item)) return sum + num(item.monto);
        return item.medio === 'tarjeta' ? sum : sum + num(item.monto);
      }, 0));
      const savedThisMonth = reservedNetMonth(goals || [], month);
      const totalSaved = reservedTotal(goals || []);
      const targetTotal = round((goals || []).reduce((sum, goal) => sum + Math.max(0, num(goal.objetivo)), 0));
      const availableBeforeSaving = round(incomeTotal - cashOut);
      const available = round(availableBeforeSaving - savedThisMonth);
      const context = { month, incomes:incomes || [], expenses:expenses || [], goals:goals || [], incomeTotal, cashOut, savedThisMonth, totalSaved, targetTotal, availableBeforeSaving, available };
      state.goals = goals || [];
      state.lastContext = context;
      return context;
    })();
    try { return await state.financeInFlight; }
    finally { state.financeInFlight = null; }
  }

  function patchFinancialUI(context) {
    if (!context) return;
    const { available, totalSaved, targetTotal, savedThisMonth, incomeTotal } = context;

    const availableNode = $('kpi-disponible');
    if (availableNode) availableNode.textContent = money(available);
    const availableHelp = availableNode?.closest('.month-money-card')?.querySelector('.month-money-help');
    if (availableHelp) availableHelp.textContent = 'Ingresos menos gastos, pagos de deuda y dinero apartado este mes';

    const savedNode = $('kpi-ahorro-real');
    if (savedNode) savedNode.textContent = money(totalSaved);
    const savedHelp = savedNode?.closest('.month-money-card')?.querySelector('.month-money-help');
    if (savedHelp) savedHelp.textContent = savedThisMonth === 0
      ? 'Dinero reservado en tus metas'
      : `Fondo reservado · Este mes ${savedThisMonth > 0 ? '+' : '−'} ${money(Math.abs(savedThisMonth))}`;

    if ($('kpi-ahorro2')) $('kpi-ahorro2').textContent = money(totalSaved);
    if ($('kpi-ahorro2-sub')) $('kpi-ahorro2-sub').textContent = totalSaved > 0 ? 'Total reservado en metas' : 'Todavía no hay dinero reservado';
    if ($('kpi-fondo')) $('kpi-fondo').textContent = targetTotal > 0 ? money(Math.max(0, targetTotal - totalSaved)) : 'Sin meta';

    const objectiveAvailable = document.querySelector('#regla-502030 .hf-financial-objective.available');
    if (objectiveAvailable?.querySelector('strong')) objectiveAvailable.querySelector('strong').textContent = money(Math.max(0, available));
    if (objectiveAvailable?.querySelector('small')) objectiveAvailable.querySelector('small').textContent = 'Después de gastos, pagos de deuda y ahorro apartado';

    const objectives = [...document.querySelectorAll('#regla-502030 .hf-financial-objective')];
    const objectiveSaving = objectives.find(node => /ahorro reservado/i.test(node.querySelector('span')?.textContent || ''));
    if (objectiveSaving?.querySelector('strong')) objectiveSaving.querySelector('strong').textContent = money(totalSaved);

    const distribution = document.querySelector('#distribucion-content .hf-coherent-dist-row.available');
    if (distribution) {
      const pct = incomeTotal > 0 ? Math.max(0, available / incomeTotal * 100) : 0;
      const strong = distribution.querySelector('div > strong');
      const bar = distribution.querySelector('.hf-coherent-dist-track i');
      const help = distribution.querySelector('small');
      if (strong) strong.textContent = `${money(Math.max(0, available))} · ${Math.round(pct)}%`;
      if (bar) bar.style.width = `${Math.min(100, pct).toFixed(1)}%`;
      if (help) help.textContent = 'Dinero que todavía no está gastado, pagado ni reservado.';
    }

    const planSaving = document.querySelector('#presupuesto-list .hf-month-plan-row.saving');
    if (planSaving) {
      const strong = planSaving.querySelector('.hf-month-plan-head strong');
      if (strong) strong.textContent = targetTotal > 0 ? `${money(totalSaved)} de ${money(targetTotal)}` : money(totalSaved);
    }
  }

  async function refreshFinancialUI() {
    try {
      const context = await financialContext();
      patchFinancialUI(context);
      return context;
    } catch (error) {
      console.warn('No se pudo refrescar la contabilidad de ahorro V35 beta 5:', error);
      return null;
    }
  }

  function scheduleFinanceRefresh(delay=80) {
    clearTimeout(state.financeTimer);
    state.financeTimer = setTimeout(refreshFinancialUI, delay);
  }

  function wrapRenderTodo() {
    if (state.originalRenderTodo || typeof window.renderTodo !== 'function') return Boolean(state.originalRenderTodo);
    state.originalRenderTodo = window.renderTodo;
    window.renderTodo = async function renderTodoV35Beta5(...args) {
      const result = await state.originalRenderTodo.apply(this, args);
      await refreshFinancialUI();
      await refreshDebtStates();
      return result;
    };
    return true;
  }

  function wrapCoherence() {
    const current = window.HFCoherenciaFinanciera;
    if (!current || state.coherenceWrapped || typeof current.actualizar !== 'function') return Boolean(current && state.coherenceWrapped);
    const originalUpdate = current.actualizar.bind(current);
    const originalCalc = typeof current.calcularResumen === 'function' ? current.calcularResumen.bind(current) : null;

    const correctedCalc = args => {
      const result = originalCalc ? originalCalc(args) : {};
      const goals = args?.metas || [];
      const month = visibleMonth();
      const saved = reservedNetMonth(goals, month);
      return { ...result, ahorroApartadoMes:saved, disponibleSinAsignar:round(num(result.disponibleSinAsignar) - saved) };
    };

    const wrappedUpdate = async (...args) => {
      const result = await originalUpdate(...args);
      const context = await refreshFinancialUI();
      if (!context) return result;
      return { ...(result || {}), ahorroReservado:context.totalSaved, ahorroApartadoMes:context.savedThisMonth, disponibleSinAsignar:context.available };
    };

    window.HFCoherenciaFinanciera = Object.freeze({ ...current, calcularResumen:correctedCalc, actualizar:wrappedUpdate, __hfV35Beta5:true });
    state.coherenceWrapped = true;
    return true;
  }

  const cardName = card => card?.nombre || card?.banco || 'Tarjeta';

  function statementWindow(card={}) {
    const statement = card.estadoCuenta || {};
    const live = window.HFDeudasActuales?.obtenerTarjeta?.(card.id) || {};
    const due = validDate(statement.fechaVencimiento || card.fechaVencimiento || live.fechaVencimiento);
    const close = validDate(statement.fechaCierre || card.fechaCierre || live.fechaCierre);
    const rawMonth = String(card.ultimoEstadoMes || statement.mes || statement.periodo || '');
    const month = rawMonth.match(/^\d{4}-\d{2}/)?.[0] || close.slice(0,7) || due.slice(0,7) || visibleMonth();
    return { statement, due, close, month, start:close || (due ? addDays(due,-35) : `${month}-01`), end:close ? addMonths(close,1) : (due ? addDays(due,25) : addMonths(`${month}-01`,1)) };
  }

  function isCardPayment(movement, card) {
    if (!movement || !card) return false;
    const name = cardName(card).toLowerCase();
    const desc = String(movement.desc || '').toLowerCase();
    const type = String(movement.tipoMovimiento || '').toLowerCase();
    const category = String(movement.cat || '').toLowerCase();
    const idMatches = movement.tarjetaId && String(movement.tarjetaId) === String(card.id);
    const nameMatches = String(movement.tarjetaNombre || '').toLowerCase() === name;
    const descriptionMatches = desc.includes('pago') && desc.includes(name);
    return type === 'pagotarjeta' ? Boolean(idMatches || nameMatches || descriptionMatches) : category === 'deudas' && Boolean(idMatches || nameMatches || descriptionMatches);
  }

  function deriveCardState(card, movements=[]) {
    const cycle = statementWindow(card);
    const seen = new Set();
    const payments = (movements || []).filter(m => isCardPayment(m, card)).filter(m => {
      const when = dateMs(m.fecha);
      return when && (!cycle.start || when >= dateMs(cycle.start)) && (!cycle.end || when < dateMs(cycle.end));
    }).filter(m => {
      const key = m.id || `${m.fecha}-${m.monto}-${m.desc || ''}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    if (!payments.length && num(card.ultimoPagoMonto) > 0) {
      const when = dateMs(card.ultimoPagoFecha);
      if (when && (!cycle.start || when >= dateMs(cycle.start)) && (!cycle.end || when < dateMs(cycle.end))) {
        payments.push({ id:'ultimo-pago-tarjeta', monto:num(card.ultimoPagoMonto), fecha:card.ultimoPagoFecha, deudaPosterior:card.deudaPosteriorUltimoPago });
      }
    }

    payments.sort((a,b) => dateMs(b.fecha)-dateMs(a.fecha));
    const paid = round(payments.reduce((sum,p) => sum + num(p.monto), 0));
    const totalTarget = Math.max(0, num(cycle.statement.pagoTotal ?? cycle.statement.deudaFacturada ?? cycle.statement.deudaConfirmadaPEN ?? cycle.statement.deudaActualPEN));
    const minimumTarget = Math.max(0, num(cycle.statement.pagoMinimo ?? card.pagoMinimo));
    const fullPayment = payments.some(p => {
      const before = num(p.deudaAnterior);
      const afterKnown = p.deudaPosterior !== null && p.deudaPosterior !== undefined;
      return (afterKnown && num(p.deudaPosterior) <= 0.01) || (before > 0 && num(p.monto) >= before - 0.01);
    });

    let status='pendiente', label='';
    if (fullPayment || (totalTarget > 0 && paid >= totalTarget - 0.01)) { status='pagada'; label='Pagada'; }
    else if (minimumTarget > 0 && paid >= minimumTarget - 0.01) { status='minimo'; label='Mínimo pagado'; }
    else if (paid > 0) { status='pago'; label='Pago registrado'; }

    const live = window.HFDeudasActuales?.obtenerTarjeta?.(card.id) || {};
    const debt = Math.max(0, num(live.deudaEstimada ?? card.deuda ?? card.saldo));
    const limit = Math.max(0, num(live.lineaTotal ?? card.limite ?? card.lineaTotal));
    const usage = limit > 0 ? debt / limit * 100 : 0;
    const days = cycle.due ? Math.ceil((dateMs(cycle.due)-dateMs(todayISO()))/86400000) : null;
    return { cardId:String(card.id), name:cardName(card), status, label, paid, totalTarget, minimumTarget, latestPaymentDate:payments[0]?.fecha || '', statementDue:cycle.due, statementMonth:cycle.month, debt, limit, usage, days, hasPayment:paid > 0 };
  }

  function patchDebtDOM() {
    const root = $('hf-family-debt-view');
    if (!root || !state.cards.size) return;
    root.querySelectorAll('.hf-v24-debt-card[data-debt-type="card"]').forEach(node => {
      const payment = state.cards.get(String(node.dataset.debtId));
      if (!payment?.hasPayment) return;
      const badge = node.querySelector('.hf-v24-status');
      if (!badge) return;
      const exceeded = payment.limit > 0 && payment.debt > payment.limit + 0.01;
      let label = payment.label;
      let tone = 'warning';
      if (exceeded) { label='Línea excedida'; tone='danger'; }
      else if (payment.status === 'pagada' || payment.status === 'minimo') tone = payment.usage >= 75 ? 'warning' : 'good';
      else if (payment.days !== null && payment.days < 0 && payment.minimumTarget > payment.paid + 0.01) { label='Pago parcial'; tone='danger'; }
      node.classList.remove('hf-v24-danger','hf-v24-warning','hf-v24-good');
      node.classList.add(`hf-v24-${tone}`);
      badge.textContent = label;
      badge.classList.add('hf-v35b2-payment-status');
    });
  }

  async function refreshDebtStates() {
    if (state.debtInFlight) return state.debtInFlight;
    if (!window.DB?.getTarjetas || !window.DB?.getGastos) return null;
    state.debtInFlight = (async () => {
      const [cards, movements] = await Promise.all([DB.getTarjetas(), DB.getGastos(null)]);
      state.cards = new Map((cards || []).map(card => [String(card.id), deriveCardState(card, movements || [])]));
      patchDebtDOM();
      return state.cards;
    })();
    try { return await state.debtInFlight; }
    catch (error) { console.warn('No se pudieron actualizar estados de tarjeta V35 beta 5:', error); return null; }
    finally { state.debtInFlight = null; }
  }

  function scheduleDebtRefresh(delay=100) {
    clearTimeout(state.debtTimer);
    state.debtTimer = setTimeout(refreshDebtStates, delay);
  }

  function wrapDebtRenderer() {
    const current = window.HFDeudasRedesign24;
    if (!current || state.debtRendererWrapped || typeof current.renderDebtPage !== 'function') return Boolean(current && state.debtRendererWrapped);
    const original = current.renderDebtPage.bind(current);
    window.HFDeudasRedesign24 = Object.freeze({
      ...current,
      __hfV35Beta5Wrapped:true,
      renderDebtPage:async (...args) => {
        const result = await original(...args);
        await refreshDebtStates();
        return result;
      }
    });
    state.debtRendererWrapped = true;
    return true;
  }

  function ensureSavingModals() {
    if (!$('hfSavingTransferModal')) {
      document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="hfSavingTransferModal" onclick="closeModalOutside(event,'hfSavingTransferModal')"><div class="modal-sheet hf-v35-saving-sheet" style="position:relative"><button class="modal-close" type="button" onclick="closeModal('hfSavingTransferModal')">✕</button><div class="modal-handle"></div><div class="modal-title" id="hf-v35-saving-title">Apartar dinero</div><div class="hf-v35-saving-context" id="hf-v35-saving-context"></div><div class="input-row"><label class="input-label" for="hf-v35-saving-amount">Monto (S/)</label><input class="input-field" id="hf-v35-saving-amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></div><div class="input-row"><label class="input-label" for="hf-v35-saving-date">Fecha</label><input class="input-field" id="hf-v35-saving-date" type="date"></div><div class="input-row"><label class="input-label" for="hf-v35-saving-note">Nota (opcional)</label><input class="input-field" id="hf-v35-saving-note" type="text" maxlength="120" placeholder="Ej.: Aporte de agosto"></div><div class="hf-v35-saving-preview" id="hf-v35-saving-preview" aria-live="polite"></div><button class="modal-btn primary" id="hf-v35-saving-submit" type="button">Apartar dinero</button></div></div>`);
      $('hf-v35-saving-amount')?.addEventListener('input', updateSavingPreview);
      $('hf-v35-saving-date')?.addEventListener('change', updateSavingPreview);
      $('hf-v35-saving-submit')?.addEventListener('click', submitSavingTransfer);
    }
    if (!$('hfSavingHistoryModal')) {
      document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="hfSavingHistoryModal" onclick="closeModalOutside(event,'hfSavingHistoryModal')"><div class="modal-sheet hf-v35-saving-sheet" style="position:relative"><button class="modal-close" type="button" onclick="closeModal('hfSavingHistoryModal')">✕</button><div class="modal-handle"></div><div class="modal-title" id="hf-v35-history-title">Movimientos de la meta</div><div class="hf-v35-saving-history" id="hf-v35-saving-history"></div></div></div>`);
    }
  }

  function patchGoalCopy() {
    const input = $('m-actual');
    const wrapper = input?.closest('div');
    const label = wrapper?.querySelector('.input-label');
    if (label) label.textContent = 'Monto inicial a reservar (opcional)';
    if (input) input.placeholder = '0.00';
    const expected = 'Este monto se descontará del Disponible hoy y quedará reservado en la meta.';
    const old = wrapper?.querySelector('.hf-v35-legacy-saving-help, .hf-v35b4-goal-help, .hf-v35b5-goal-help');
    if (old) { old.textContent = expected; old.classList.add('hf-v35b5-goal-help'); }
    else if (wrapper) wrapper.insertAdjacentHTML('beforeend', `<small class="field-help hf-v35b5-goal-help">${expected}</small>`);
    $('hf-v35-saving-accounting-note')?.remove();
  }

  function decorateGoals(goals=state.goals) {
    state.goals = Array.isArray(goals) ? goals : [];
    const container = $('savingGoals');
    if (!container) return;
    [...container.querySelectorAll('.saving-goal')].forEach((card,index) => {
      const goal = state.goals[index];
      if (!goal) return;
      card.dataset.hfGoalId = goal.id;
      card.querySelector('.hf-v35-saving-actions')?.remove();
      const current = Math.max(0,num(goal.actual));
      const target = Math.max(0,num(goal.objetivo));
      const remaining = target > 0 ? Math.max(0,round(target-current)) : Infinity;
      const actions = document.createElement('div');
      actions.className = 'hf-v35-saving-actions';
      actions.innerHTML = `<button type="button" class="primary" data-hf-saving="aporte" data-goal-id="${esc(goal.id)}" ${remaining <= 0 ? 'disabled' : ''}>${remaining <= 0 ? 'Meta cumplida' : 'Apartar dinero'}</button><button type="button" data-hf-saving="retiro" data-goal-id="${esc(goal.id)}" ${current <= 0 ? 'disabled' : ''}>Retirar</button><button type="button" class="history" data-hf-saving="historial" data-goal-id="${esc(goal.id)}">Movimientos</button>`;
      card.appendChild(actions);
    });
  }

  function wrapRenderMetas() {
    if (state.originalRenderMetas || typeof window.renderMetas !== 'function') return Boolean(state.originalRenderMetas);
    state.originalRenderMetas = window.renderMetas;
    window.renderMetas = function renderMetasV35Beta5(goals) {
      const result = state.originalRenderMetas.apply(this, arguments);
      state.goals = Array.isArray(goals) ? goals : [];
      decorateGoals(state.goals);
      return result;
    };
    return true;
  }

  async function openSavingTransfer(goalId, type='aporte') {
    ensureSavingModals();
    const context = await financialContext();
    const goal = context.goals.find(item => String(item.id) === String(goalId));
    if (!goal) return window.showToast?.('No se encontró la meta.', 'error');
    state.transferGoalId = String(goalId);
    state.transferType = type === 'retiro' ? 'retiro' : 'aporte';
    const contribution = state.transferType === 'aporte';
    const current = Math.max(0,num(goal.actual));
    const target = Math.max(0,num(goal.objetivo));
    const remaining = target > 0 ? Math.max(0,round(target-current)) : Math.max(0,context.available);
    const month = context.month;
    const today = todayISO();
    const date = today.slice(0,7) === month ? today : `${month}-01`;

    $('hf-v35-saving-title').textContent = contribution ? 'Apartar dinero' : 'Retirar de la meta';
    $('hf-v35-saving-context').innerHTML = `<div><span>Meta</span><strong>${esc(goal.nombre || 'Meta')}</strong></div><div><span>Reservado</span><strong>${money(current)}</strong></div><div><span>${contribution ? 'Disponible hoy' : 'Puede retirarse'}</span><strong>${money(contribution ? Math.max(0,context.available) : current)}</strong></div>`;
    const amount = $('hf-v35-saving-amount');
    amount.value = '';
    amount.max = contribution ? Math.max(0,Math.min(context.available,remaining)) : current;
    amount.placeholder = `Máx. ${money(amount.max)}`;
    const dateNode = $('hf-v35-saving-date');
    dateNode.value = date; dateNode.min = `${month}-01`; dateNode.max = monthLastDay(month);
    $('hf-v35-saving-note').value = '';
    $('hf-v35-saving-submit').textContent = contribution ? 'Apartar dinero' : 'Retirar dinero';
    updateSavingPreview();
    window.openModal?.('hfSavingTransferModal');
  }

  async function updateSavingPreview() {
    const preview = $('hf-v35-saving-preview');
    if (!preview || !state.transferGoalId) return;
    const context = await financialContext();
    const goal = context.goals.find(item => String(item.id) === String(state.transferGoalId));
    if (!goal) return;
    const amount = Math.max(0,num($('hf-v35-saving-amount')?.value));
    const current = Math.max(0,num(goal.actual));
    const contribution = state.transferType === 'aporte';
    const nextGoal = contribution ? current + amount : Math.max(0,current-amount);
    const nextAvailable = contribution ? context.available - amount : context.available + amount;
    preview.innerHTML = `<div><span>La meta quedará en</span><strong>${money(nextGoal)}</strong></div><div><span>Disponible después</span><strong class="${nextAvailable < 0 ? 'danger' : ''}">${money(nextAvailable)}</strong></div>`;
  }

  async function submitSavingTransfer() {
    if (!state.transferGoalId || !window.db || !window.DB?.hogarId) return window.showToast?.('Selecciona la meta nuevamente.', 'error');
    const context = await financialContext();
    const goal = context.goals.find(item => String(item.id) === String(state.transferGoalId));
    if (!goal) return window.showToast?.('No se encontró la meta.', 'error');
    const amount = round($('hf-v35-saving-amount')?.value);
    const date = validDate($('hf-v35-saving-date')?.value);
    const note = String($('hf-v35-saving-note')?.value || '').trim();
    const month = context.month;
    const contribution = state.transferType === 'aporte';
    const current = Math.max(0,num(goal.actual));
    const target = Math.max(0,num(goal.objetivo));
    if (!(amount > 0)) return window.showToast?.('Ingresa un monto mayor que cero.', 'error');
    if (!date || date.slice(0,7) !== month) return window.showToast?.('La fecha debe pertenecer al mes que estás viendo.', 'error');
    if (contribution && amount > context.available + 0.01) return window.showToast?.(`Solo hay ${money(Math.max(0,context.available))} disponibles para apartar.`, 'error');
    if (contribution && target > 0 && current + amount > target + 0.01) return window.showToast?.(`A la meta le faltan ${money(Math.max(0,target-current))}.`, 'error');
    if (!contribution && amount > current + 0.01) return window.showToast?.(`Solo hay ${money(current)} reservados en esta meta.`, 'error');

    const button = $('hf-v35-saving-submit');
    if (button) { button.disabled=true; button.textContent='Guardando…'; }
    try {
      const member = currentMember();
      const ref = db.collection('hogares').doc(DB.hogarId).collection('metas').doc(String(goal.id));
      const movementRef = ref.collection('movimientos').doc();
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error('La meta ya no existe.');
        const data = snapshot.data() || {};
        const before = Math.max(0,num(data.actual));
        const objective = Math.max(0,num(data.objetivo));
        const signed = contribution ? amount : -amount;
        const after = round(before + signed);
        if (after < -0.01) throw new Error('El retiro supera lo reservado.');
        if (contribution && objective > 0 && after > objective + 0.01) throw new Error('El aporte supera el monto objetivo.');
        const byMonth = { ...(data.reservadoMeses || {}) };
        byMonth[month] = round(num(byMonth[month]) + signed);
        transaction.update(ref, { actual:Math.max(0,after), reservadoMeses:byMonth, contabilidadAhorroV35:'beta5', actualizadoEn:new Date().toISOString() });
        transaction.set(movementRef, { tipo:contribution?'aporte':'retiro', monto:amount, fecha:date, mes:month, nota:note, quien:member.legacy, miembroId:member.id || null, miembroNombre:member.name || '', saldoAnterior:before, saldoPosterior:Math.max(0,after), creadoEn:firebase.firestore.FieldValue.serverTimestamp() });
      });
      window.closeModal?.('hfSavingTransferModal');
      window.showToast?.(contribution ? 'Dinero apartado en la meta.' : 'Dinero devuelto al disponible.');
      await window.renderTodo?.();
      window.dispatchEvent(new CustomEvent('hf:ahorro-reservado-actualizado', { detail:{ goalId:goal.id, type:contribution?'aporte':'retiro', amount, month } }));
      setTimeout(() => window.HFAhorroResumen35?.refreshGoals?.(),80);
    } catch (error) {
      console.error('No se pudo mover dinero de la meta V35 beta 5:', error);
      window.showToast?.(error?.message || 'No se pudo actualizar la meta.', 'error');
    } finally {
      if (button) { button.disabled=false; button.textContent = state.transferType === 'retiro' ? 'Retirar dinero' : 'Apartar dinero'; }
    }
  }

  async function openSavingHistory(goalId) {
    ensureSavingModals();
    const goals = await DB.getMetas();
    const goal = goals.find(item => String(item.id) === String(goalId));
    if (!goal || !window.db || !window.DB?.hogarId) return;
    $('hf-v35-history-title').textContent = `Movimientos · ${goal.nombre || 'Meta'}`;
    const container = $('hf-v35-saving-history');
    container.innerHTML = '<div class="empty-state">Cargando movimientos…</div>';
    window.openModal?.('hfSavingHistoryModal');
    try {
      const snapshot = await db.collection('hogares').doc(DB.hogarId).collection('metas').doc(String(goal.id)).collection('movimientos').orderBy('fecha','desc').limit(80).get();
      const items = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));
      container.innerHTML = items.length ? items.map(item => {
        const contribution = item.tipo !== 'retiro';
        return `<div class="hf-v35-history-row ${contribution?'aporte':'retiro'}"><span>${contribution?'↓':'↑'}</span><div><strong>${contribution?'Dinero apartado':'Retiro de la meta'}</strong><small>${esc(item.fecha || '')}${item.miembroNombre?` · ${esc(item.miembroNombre)}`:''}${item.nota?` · ${esc(item.nota)}`:''}</small></div><b>${contribution?'+':'−'} ${money(item.monto)}</b></div>`;
      }).join('') : '<div class="empty-state">Todavía no hay aportes ni retiros registrados.</div>';
    } catch (error) {
      console.warn('No se pudo cargar historial de ahorro:', error);
      container.innerHTML = '<div class="empty-state">No se pudo cargar el historial.</div>';
    }
  }

  function overrideAddGoal() {
    if (state.originalAddGoal || typeof window.agregarMeta !== 'function') return Boolean(state.originalAddGoal);
    state.originalAddGoal = window.agregarMeta;
    window.agregarMeta = async function agregarMetaV35Beta5() {
      const name = String($('m-nombre')?.value || '').trim();
      const target = round($('m-objetivo')?.value);
      const initial = Math.max(0,round($('m-actual')?.value));
      const icon = document.querySelector('#icon-chips .chip.selected')?.textContent.trim() || '🎯';
      if (!name || !(target > 0)) return window.showToast?.('Completa nombre y monto objetivo.','error');
      if (initial > target + 0.01) return window.showToast?.('El monto inicial no puede superar la meta.','error');
      const context = await financialContext();
      if (initial > context.available + 0.01) return window.showToast?.(`Solo hay ${money(Math.max(0,context.available))} disponibles para reservar.`,'error');
      if (!window.db || !window.DB?.hogarId) return window.showToast?.('No se pudo preparar el hogar.','error');
      const month = context.month;
      const member = currentMember();
      const today = todayISO();
      const date = today.slice(0,7) === month ? today : `${month}-01`;
      const now = new Date().toISOString();
      const ref = await db.collection('hogares').doc(DB.hogarId).collection('metas').add({ nombre:name, objetivo:target, actual:initial, icono:icon, reservadoMeses:initial>0?{[month]:initial}:{}, contabilidadAhorroV35:'beta5', creadoEn:now, actualizadoEn:now });
      if (initial > 0) await ref.collection('movimientos').add({ tipo:'aporte', monto:initial, fecha:date, mes:month, nota:'Monto inicial reservado', origen:'creacion-meta', quien:member.legacy, miembroId:member.id || null, miembroNombre:member.name || '', saldoAnterior:0, saldoPosterior:initial, creadoEn:firebase.firestore.FieldValue.serverTimestamp() });
      window.closeModal?.('metaModal');
      ['m-nombre','m-objetivo','m-actual'].forEach(id => { if ($(id)) $(id).value=''; });
      await window.renderTodo?.();
      window.dispatchEvent(new CustomEvent('hf:objetivo-financiero-guardado',{detail:{goalId:ref.id,initial,month}}));
      window.showToast?.(initial>0?`Meta creada y ${money(initial)} reservados.`:'Meta creada.');
    };
    return true;
  }

  function installCompatibilityApi() {
    window.HFEstadosPagadosAhorroReal35 = Object.freeze({
      version:VERSION,
      deriveCardPaymentState:deriveCardState,
      syncDebtPaymentStates:refreshDebtStates,
      patchDebtDOM,
      openSavingTransfer,
      openSavingHistory,
      totalReserved:reservedTotal,
      netReservedForMonth:reservedNetMonth,
      getState:() => ({ version:VERSION, cards:[...state.cards.values()], goals:state.goals, correctedSummary:state.lastContext ? { ingresoTotal:state.lastContext.incomeTotal, ahorroReservado:state.lastContext.totalSaved, ahorroApartadoMes:state.lastContext.savedThisMonth, disponibleSinAsignar:state.lastContext.available } : null })
    });
  }

  function installClickHandler() {
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-hf-saving]');
      if (!button) return;
      event.preventDefault();
      if (button.dataset.hfSaving === 'historial') openSavingHistory(button.dataset.goalId);
      else openSavingTransfer(button.dataset.goalId, button.dataset.hfSaving);
    });
  }

  function installWhenReady() {
    let attempts=0;
    clearInterval(state.installTimer);
    state.installTimer = setInterval(() => {
      attempts += 1;
      const ok = [wrapRenderTodo(), wrapRenderMetas(), overrideAddGoal(), wrapCoherence(), wrapDebtRenderer()].every(Boolean);
      patchGoalCopy();
      if (ok || attempts >= 60) {
        clearInterval(state.installTimer); state.installTimer=null;
        reconcileSavingsLedger().then(async goals => {
          state.goals=goals;
          await refreshFinancialUI();
          await refreshDebtStates();
          decorateGoals(goals);
        }).catch(error => console.warn('No se pudo reconciliar el ahorro V35 beta 5:',error));
      }
    },100);
  }

  function start() {
    if (state.started) return;
    state.started=true;
    ensureSavingModals();
    installCompatibilityApi();
    installClickHandler();
    installWhenReady();
    ['hf:gastos-actualizados','hf:deuda-actualizada','hf:estado-cuenta-confirmado','hf:deudas-core-actualizadas','hf:deudas-recalculadas']
      .forEach(name => window.addEventListener(name, () => scheduleDebtRefresh(120)));
    ['hf:ahorro-reservado-actualizado','hf:objetivo-financiero-guardado']
      .forEach(name => window.addEventListener(name, () => scheduleFinanceRefresh(100)));
  }

  window.HFEtapa18Beta5 = Object.freeze({
    version:VERSION,
    reconcileSavingsLedger,
    financialContext,
    refreshFinancialUI,
    refreshDebtStates,
    deriveCardState,
    patchDebtDOM,
    openSavingTransfer,
    openSavingHistory,
    getState:() => ({ version:VERSION, context:state.lastContext, cards:[...state.cards.values()], goals:state.goals.map(goal => ({ id:goal.id,nombre:goal.nombre,actual:num(goal.actual),reservadoMeses:goal.reservadoMeses || {},tracked:trackedReservedTotal(goal) })) })
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
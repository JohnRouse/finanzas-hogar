/* Hogar Finanzas — Etapa 18 V35.0-beta.4: pagos + ahorro estable */
(() => {
  'use strict';

  const VERSION = '35.0-beta.4';
  if (window.HFEtapa18Beta4?.version === VERSION) return;

  const state = {
    started:false,
    installTimer:null,
    debtTimer:null,
    transferGoalId:'',
    transferType:'aporte',
    cards:new Map(),
    available:null,
    migrationRunning:false,
    rendererWrapped:false,
    engineWrapped:false,
    originalAddGoal:null
  };

  const $ = id => document.getElementById(id);
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const money = value => `S/ ${num(value).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
  const dateMs = value => validDate(value) ? new Date(`${value}T12:00:00`).getTime() : 0;

  function todayISO() {
    return new Date().toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function addDays(value, amount) {
    if (!validDate(value)) return '';
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + Number(amount || 0));
    return date.toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function addMonths(value, amount = 1) {
    if (!validDate(value)) return '';
    const date = new Date(`${value}T12:00:00`);
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + amount);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    return date.toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function visibleMonth() {
    const text = String($('month-display')?.textContent || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const index = months.findIndex(month => text.includes(month));
    const year = text.match(/\b(20\d{2})\b/)?.[1];
    if (index >= 0 && year) return `${year}-${String(index + 1).padStart(2, '0')}`;
    return window.DB?.getMesActual?.() || todayISO().slice(0, 7);
  }

  function monthLastDay(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return '';
    const [year, number] = month.split('-').map(Number);
    return `${month}-${String(new Date(year, number, 0).getDate()).padStart(2, '0')}`;
  }

  function currentMember() {
    try {
      const member = window.obtenerMiembroActual?.();
      if (member) return { id:member.id || '', legacy:member.legacyTipo || 'yo', name:member.nombre || '' };
    } catch (_) {}
    const legacy = localStorage.getItem('miUsuarioTipo') || 'yo';
    return { id:localStorage.getItem('miembroActualId') || '', legacy, name:legacy === 'pareja' ? 'Sydney' : 'Christian' };
  }

  const cardName = card => card?.nombre || card?.banco || 'Tarjeta';

  function statementWindow(card = {}) {
    const statement = card.estadoCuenta || {};
    const live = window.HFDeudasActuales?.obtenerTarjeta?.(card.id) || {};
    const due = validDate(statement.fechaVencimiento || card.fechaVencimiento || live.fechaVencimiento);
    const close = validDate(statement.fechaCierre || card.fechaCierre || live.fechaCierre);
    const rawMonth = String(card.ultimoEstadoMes || statement.mes || statement.periodo || '');
    const month = rawMonth.match(/^\d{4}-\d{2}/)?.[0] || close.slice(0,7) || due.slice(0,7) || visibleMonth();
    return {
      statement,
      due,
      close,
      month,
      start:close || (due ? addDays(due, -35) : `${month}-01`),
      end:close ? addMonths(close, 1) : (due ? addDays(due, 25) : addMonths(`${month}-01`, 1))
    };
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
    return type === 'pagotarjeta'
      ? Boolean(idMatches || nameMatches || descriptionMatches)
      : category === 'deudas' && Boolean(idMatches || nameMatches || descriptionMatches);
  }

  function deriveCardState(card, movements = []) {
    const cycle = statementWindow(card);
    const seen = new Set();
    const payments = (movements || [])
      .filter(movement => isCardPayment(movement, card))
      .filter(movement => {
        const when = dateMs(movement.fecha);
        if (!when) return false;
        return (!cycle.start || when >= dateMs(cycle.start)) && (!cycle.end || when < dateMs(cycle.end));
      })
      .filter(movement => {
        const key = movement.id || `${movement.fecha}-${movement.monto}-${movement.desc || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    if (!payments.length && num(card.ultimoPagoMonto) > 0) {
      const when = dateMs(card.ultimoPagoFecha);
      if (when && (!cycle.start || when >= dateMs(cycle.start)) && (!cycle.end || when < dateMs(cycle.end))) {
        payments.push({
          id:'ultimo-pago-tarjeta',
          monto:num(card.ultimoPagoMonto),
          fecha:card.ultimoPagoFecha,
          deudaPosterior:card.deudaPosteriorUltimoPago
        });
      }
    }

    payments.sort((a,b) => dateMs(b.fecha) - dateMs(a.fecha));
    const paid = round(payments.reduce((sum, payment) => sum + num(payment.monto), 0));
    const totalTarget = Math.max(0, num(cycle.statement.pagoTotal ?? cycle.statement.deudaFacturada ?? cycle.statement.deudaConfirmadaPEN ?? cycle.statement.deudaActualPEN));
    const minimumTarget = Math.max(0, num(cycle.statement.pagoMinimo ?? card.pagoMinimo));
    const fullPayment = payments.some(payment => {
      const before = num(payment.deudaAnterior);
      const afterKnown = payment.deudaPosterior !== null && payment.deudaPosterior !== undefined;
      return (afterKnown && num(payment.deudaPosterior) <= 0.01) || (before > 0 && num(payment.monto) >= before - 0.01);
    });

    let status = 'pendiente';
    let label = '';
    if (fullPayment || (totalTarget > 0 && paid >= totalTarget - 0.01)) {
      status = 'pagada'; label = 'Pagada';
    } else if (minimumTarget > 0 && paid >= minimumTarget - 0.01) {
      status = 'minimo'; label = 'Mínimo pagado';
    } else if (paid > 0) {
      status = 'pago'; label = 'Pago registrado';
    }

    const live = window.HFDeudasActuales?.obtenerTarjeta?.(card.id) || {};
    const debt = Math.max(0, num(live.deudaEstimada ?? card.deuda ?? card.saldo));
    const limit = Math.max(0, num(live.lineaTotal ?? card.limite ?? card.lineaTotal));
    const usage = limit > 0 ? debt / limit * 100 : 0;
    const days = cycle.due ? Math.ceil((dateMs(cycle.due) - dateMs(todayISO())) / 86400000) : null;
    return { cardId:String(card.id), name:cardName(card), status, label, paid, totalTarget, minimumTarget, latestPaymentDate:payments[0]?.fecha || '', statementDue:cycle.due, debt, limit, usage, days, hasPayment:paid > 0 };
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
      if (exceeded) { label = 'Línea excedida'; tone = 'danger'; }
      else if (payment.status === 'pagada' || payment.status === 'minimo') tone = payment.usage >= 75 ? 'warning' : 'good';
      else if (payment.days !== null && payment.days < 0 && payment.minimumTarget > payment.paid + 0.01) { label = 'Pago parcial'; tone = 'danger'; }
      node.classList.remove('hf-v24-danger','hf-v24-warning','hf-v24-good');
      node.classList.add(`hf-v24-${tone}`);
      badge.textContent = label;
      badge.classList.add('hf-v35b2-payment-status');
    });
  }

  async function refreshDebtStates() {
    if (!window.DB?.getTarjetas || !window.DB?.getGastos) return;
    try {
      const [cards, movements] = await Promise.all([DB.getTarjetas(), DB.getGastos(null)]);
      state.cards = new Map((cards || []).map(card => [String(card.id), deriveCardState(card, movements || [])]));
      patchDebtDOM();
    } catch (error) {
      console.warn('No se pudieron actualizar los estados de tarjetas V35 beta 4:', error);
    }
  }

  function scheduleDebtRefresh(delay = 120) {
    clearTimeout(state.debtTimer);
    state.debtTimer = setTimeout(refreshDebtStates, delay);
  }

  function wrapDebtRenderer() {
    const current = window.HFDeudasRedesign24;
    if (!current || current.__hfV35Beta4Wrapped || typeof current.renderDebtPage !== 'function') return Boolean(current?.__hfV35Beta4Wrapped);
    const original = current.renderDebtPage.bind(current);
    window.HFDeudasRedesign24 = Object.freeze({
      ...current,
      __hfV35Beta4Wrapped:true,
      renderDebtPage:async (...args) => {
        const result = await original(...args);
        patchDebtDOM();
        return result;
      }
    });
    state.rendererWrapped = true;
    return true;
  }

  async function summaryContext() {
    const month = visibleMonth();
    const [incomes, expenses, goals, cards, loans] = await Promise.all([
      DB.getIngresosMes?.(month) || [],
      DB.getGastos?.(month) || [],
      DB.getMetas?.() || [],
      DB.getTarjetas?.() || [],
      DB.getPrestamos?.() || []
    ]);
    const base = window.HFCoherenciaFinanciera?.calcularResumen?.({ ingresos:incomes || [], gastos:expenses || [], metas:goals || [], tarjetas:cards || [], prestamos:loans || [] }) || {};
    const savedThisMonth = round((goals || []).reduce((sum, goal) => sum + num(goal?.reservadoMeses?.[month]), 0));
    const cashBeforeSaving = round(num(base.ingresoTotal) - num(base.consumosEfectivo) - num(base.pagosDeudaMes));
    return { base, goals:goals || [], month, savedThisMonth, available:round(cashBeforeSaving - savedThisMonth) };
  }

  async function refreshAvailable() {
    try {
      const context = await summaryContext();
      state.available = context.available;
      return context;
    } catch (error) {
      console.warn('No se pudo calcular el disponible V35 beta 4:', error);
      return { base:{}, goals:[], month:visibleMonth(), savedThisMonth:0, available:num(state.available) };
    }
  }

  function patchGoalCopy() {
    const input = $('m-actual');
    const wrapper = input?.closest('div');
    const label = wrapper?.querySelector('.input-label');
    if (label && label.textContent !== 'Monto inicial a reservar (opcional)') label.textContent = 'Monto inicial a reservar (opcional)';
    if (input && input.placeholder !== '0.00') input.placeholder = '0.00';
    const expected = 'Este monto se apartará del Disponible hoy al crear la meta.';
    const oldHelp = wrapper?.querySelector('.hf-v35-legacy-saving-help');
    if (oldHelp && oldHelp.textContent !== expected) oldHelp.textContent = expected;
    if (wrapper && !oldHelp && !wrapper.querySelector('.hf-v35b4-goal-help')) {
      wrapper.insertAdjacentHTML('beforeend', `<small class="field-help hf-v35b4-goal-help">${expected}</small>`);
    }
    $('hf-v35-saving-accounting-note')?.remove();
  }

  async function migrateUntrackedGoalBalances() {
    if (state.migrationRunning || !window.db || !window.DB?.hogarId || !window.DB?.getMetas) return;
    state.migrationRunning = true;
    try {
      const month = visibleMonth();
      const goals = await DB.getMetas();
      const member = currentMember();
      const today = todayISO();
      const date = today.slice(0,7) === month ? today : `${month}-01`;
      for (const goal of goals || []) {
        const months = goal?.reservadoMeses && typeof goal.reservadoMeses === 'object' ? Object.keys(goal.reservadoMeses) : [];
        if (!(num(goal.actual) > 0 && months.length === 0 && !goal.saldoInicialContabilizadoV35)) continue;
        const ref = db.collection('hogares').doc(DB.hogarId).collection('metas').doc(String(goal.id));
        const movementRef = ref.collection('movimientos').doc();
        const batch = db.batch();
        batch.update(ref, {
          reservadoMeses:{ [month]:round(goal.actual) },
          saldoInicialContabilizadoV35:true,
          saldoInicialMesV35:month,
          actualizadoEn:new Date().toISOString()
        });
        batch.set(movementRef, {
          tipo:'aporte', monto:round(goal.actual), fecha:date, mes:month,
          nota:'Saldo inicial reservado', origen:'migracion-v35-beta4',
          quien:member.legacy, miembroId:member.id || null, miembroNombre:member.name || '',
          saldoAnterior:0, saldoPosterior:round(goal.actual),
          creadoEn:firebase.firestore.FieldValue.serverTimestamp()
        });
        await batch.commit();
      }
    } finally {
      state.migrationRunning = false;
    }
  }

  async function submitSavingTransfer() {
    if (!state.transferGoalId || !window.db || !window.DB?.hogarId) return window.showToast?.('Selecciona la meta nuevamente.', 'error');
    const context = await refreshAvailable();
    const goal = context.goals.find(item => String(item.id) === String(state.transferGoalId));
    if (!goal) return window.showToast?.('No se encontró la meta.', 'error');
    const amount = round($('hf-v35-saving-amount')?.value);
    const date = validDate($('hf-v35-saving-date')?.value);
    const note = String($('hf-v35-saving-note')?.value || '').trim();
    const month = context.month;
    if (!(amount > 0)) return window.showToast?.('Ingresa un monto mayor que cero.', 'error');
    if (!date || date.slice(0,7) !== month) return window.showToast?.('La fecha debe pertenecer al mes que estás viendo.', 'error');
    const contribution = state.transferType !== 'retiro';
    const current = Math.max(0, num(goal.actual));
    const target = Math.max(0, num(goal.objetivo));
    if (contribution && amount > context.available + 0.01) return window.showToast?.(`Solo hay ${money(Math.max(0, context.available))} disponibles para apartar.`, 'error');
    if (contribution && target > 0 && current + amount > target + 0.01) return window.showToast?.(`A la meta le faltan ${money(Math.max(0, target - current))}.`, 'error');
    if (!contribution && amount > current + 0.01) return window.showToast?.(`Solo hay ${money(current)} reservados en esta meta.`, 'error');

    const button = $('hf-v35-saving-submit');
    if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
    try {
      const member = currentMember();
      const ref = db.collection('hogares').doc(DB.hogarId).collection('metas').doc(String(goal.id));
      const movementRef = ref.collection('movimientos').doc();
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) throw new Error('La meta ya no existe.');
        const data = snapshot.data() || {};
        const before = Math.max(0, num(data.actual));
        const objective = Math.max(0, num(data.objetivo));
        const signed = contribution ? amount : -amount;
        const after = round(before + signed);
        if (after < -0.01) throw new Error('El retiro supera lo reservado.');
        if (contribution && objective > 0 && after > objective + 0.01) throw new Error('El aporte supera el monto objetivo.');
        const byMonth = { ...(data.reservadoMeses || {}) };
        byMonth[month] = round(num(byMonth[month]) + signed);
        transaction.update(ref, { actual:Math.max(0, after), reservadoMeses:byMonth, actualizadoEn:new Date().toISOString() });
        transaction.set(movementRef, {
          tipo:contribution ? 'aporte' : 'retiro', monto:amount, fecha:date, mes:month, nota:note,
          quien:member.legacy, miembroId:member.id || null, miembroNombre:member.name || '',
          saldoAnterior:before, saldoPosterior:Math.max(0, after),
          creadoEn:firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      window.closeModal?.('hfSavingTransferModal');
      window.showToast?.(contribution ? 'Dinero apartado en la meta.' : 'Dinero devuelto al disponible.');
      window.dispatchEvent(new CustomEvent('hf:ahorro-reservado-actualizado', { detail:{ goalId:goal.id, type:contribution ? 'aporte' : 'retiro', amount, month } }));
      await window.renderTodo?.();
      setTimeout(() => window.HFAhorroResumen35?.refreshGoals?.(), 80);
    } catch (error) {
      console.error('No se pudo mover el dinero de la meta V35 beta 4:', error);
      window.showToast?.(error?.message || 'No se pudo actualizar la meta.', 'error');
    } finally {
      if (button) { button.disabled = false; button.textContent = state.transferType === 'retiro' ? 'Retirar dinero' : 'Apartar dinero'; }
    }
  }

  function rebindSavingSubmit() {
    const current = $('hf-v35-saving-submit');
    if (!current || current.dataset.hfV35Beta4 === VERSION) return Boolean(current);
    const clean = current.cloneNode(true);
    clean.dataset.hfV35Beta4 = VERSION;
    current.replaceWith(clean);
    clean.addEventListener('click', submitSavingTransfer);
    return true;
  }

  async function updateTransferPreview() {
    const preview = $('hf-v35-saving-preview');
    if (!preview || !state.transferGoalId) return;
    const context = await refreshAvailable();
    const goal = context.goals.find(item => String(item.id) === String(state.transferGoalId));
    if (!goal) return;
    const amount = Math.max(0, num($('hf-v35-saving-amount')?.value));
    const current = Math.max(0, num(goal.actual));
    const contribution = state.transferType !== 'retiro';
    preview.innerHTML = `<div><span>La meta quedará en</span><strong>${money(contribution ? current + amount : Math.max(0, current - amount))}</strong></div><div><span>Disponible después</span><strong>${money(contribution ? context.available - amount : context.available + amount)}</strong></div>`;
  }

  function captureSavingContext(event) {
    const button = event.target.closest?.('[data-hf-saving]');
    if (!button || button.dataset.hfSaving === 'historial') return;
    state.transferGoalId = String(button.dataset.goalId || '');
    state.transferType = button.dataset.hfSaving === 'retiro' ? 'retiro' : 'aporte';
    setTimeout(() => {
      rebindSavingSubmit();
      updateTransferPreview();
      const amount = $('hf-v35-saving-amount');
      if (amount && !amount.dataset.hfV35Beta4) {
        amount.dataset.hfV35Beta4 = VERSION;
        amount.addEventListener('input', updateTransferPreview);
      }
    }, 40);
  }

  function wrapEngine() {
    const engine = window.HFEstadosPagadosAhorroReal35;
    if (!engine || state.engineWrapped) return Boolean(engine && state.engineWrapped);
    const originalOpen = engine.openSavingTransfer?.bind(engine);
    window.HFEstadosPagadosAhorroReal35 = Object.freeze({
      ...engine,
      version:VERSION,
      deriveCardPaymentState:deriveCardState,
      openSavingTransfer:async (goalId, type = 'aporte') => {
        state.transferGoalId = String(goalId);
        state.transferType = type === 'retiro' ? 'retiro' : 'aporte';
        const result = await originalOpen?.(goalId, type);
        setTimeout(() => { rebindSavingSubmit(); updateTransferPreview(); }, 30);
        return result;
      },
      syncDebtPaymentStates:refreshDebtStates,
      getState:() => ({ version:VERSION, cards:[...state.cards.values()], available:state.available })
    });
    state.engineWrapped = true;
    return true;
  }

  function overrideAddGoal() {
    if (state.originalAddGoal || typeof window.agregarMeta !== 'function') return Boolean(state.originalAddGoal);
    state.originalAddGoal = window.agregarMeta;
    window.agregarMeta = async function agregarMetaV35Beta4() {
      const name = String($('m-nombre')?.value || '').trim();
      const target = round($('m-objetivo')?.value);
      const initial = Math.max(0, round($('m-actual')?.value));
      const icon = document.querySelector('#icon-chips .chip.selected')?.textContent.trim() || '🎯';
      if (!name || !(target > 0)) return window.showToast?.('Completa nombre y monto objetivo.', 'error');
      if (initial > target + 0.01) return window.showToast?.('El monto inicial no puede superar la meta.', 'error');
      const context = await refreshAvailable();
      if (initial > context.available + 0.01) return window.showToast?.(`Solo hay ${money(Math.max(0, context.available))} disponibles para reservar.`, 'error');
      if (!window.db || !window.DB?.hogarId) return window.showToast?.('No se pudo preparar el hogar.', 'error');
      const month = context.month;
      const member = currentMember();
      const today = todayISO();
      const date = today.slice(0,7) === month ? today : `${month}-01`;
      const now = new Date().toISOString();
      const ref = await db.collection('hogares').doc(DB.hogarId).collection('metas').add({
        nombre:name, objetivo:target, actual:initial, icono:icon,
        reservadoMeses:initial > 0 ? { [month]:initial } : {},
        saldoInicialContabilizadoV35:initial > 0,
        saldoInicialMesV35:initial > 0 ? month : '',
        creadoEn:now, actualizadoEn:now
      });
      if (initial > 0) {
        await ref.collection('movimientos').add({
          tipo:'aporte', monto:initial, fecha:date, mes:month, nota:'Monto inicial reservado', origen:'creacion-meta',
          quien:member.legacy, miembroId:member.id || null, miembroNombre:member.name || '', saldoAnterior:0, saldoPosterior:initial,
          creadoEn:firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      window.closeModal?.('metaModal');
      if ($('m-nombre')) $('m-nombre').value = '';
      if ($('m-objetivo')) $('m-objetivo').value = '';
      if ($('m-actual')) $('m-actual').value = '';
      window.dispatchEvent(new CustomEvent('hf:objetivo-financiero-guardado', { detail:{ goalId:ref.id, initial, month } }));
      window.dispatchEvent(new CustomEvent('hf:ahorro-reservado-actualizado', { detail:{ goalId:ref.id, type:'creacion', amount:initial, month } }));
      await window.renderTodo?.();
      window.showToast?.(initial > 0 ? `Meta creada y ${money(initial)} reservados.` : 'Meta creada.');
    };
    return true;
  }

  function installWhenReady() {
    let attempts = 0;
    clearInterval(state.installTimer);
    state.installTimer = setInterval(() => {
      attempts += 1;
      const engineReady = wrapEngine();
      const rendererReady = wrapDebtRenderer();
      const goalReady = overrideAddGoal();
      patchGoalCopy();
      rebindSavingSubmit();
      if (engineReady && rendererReady && goalReady) {
        clearInterval(state.installTimer);
        state.installTimer = null;
        migrateUntrackedGoalBalances()
          .then(() => Promise.all([refreshAvailable(), refreshDebtStates()]))
          .catch(error => console.warn('No se pudo completar la inicialización V35 beta 4:', error));
      } else if (attempts >= 40) {
        clearInterval(state.installTimer);
        state.installTimer = null;
      }
    }, 125);
  }

  function start() {
    if (state.started) return;
    state.started = true;
    document.addEventListener('click', captureSavingContext, true);
    ['hf:gastos-actualizados','hf:deuda-actualizada','hf:estado-cuenta-confirmado','hf:deudas-core-actualizadas','hf:deudas-recalculadas']
      .forEach(name => window.addEventListener(name, () => scheduleDebtRefresh(160)));
    window.addEventListener('hf:ahorro-reservado-actualizado', () => {
      setTimeout(() => { refreshAvailable(); window.HFAhorroResumen35?.refreshGoals?.(); }, 120);
    });
    window.addEventListener('hf:objetivo-financiero-guardado', () => setTimeout(refreshAvailable, 120));
    installWhenReady();
  }

  window.HFEtapa18Beta4 = Object.freeze({
    version:VERSION,
    refreshAvailable,
    refreshDebtStates,
    deriveCardState,
    patchDebtDOM,
    migrateUntrackedGoalBalances,
    getState:() => ({ version:VERSION, available:state.available, cards:[...state.cards.values()] })
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

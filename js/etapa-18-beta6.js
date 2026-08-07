/* Hogar Finanzas — Etapa 18 V35.0-beta.6: disponible = efectivo libre - ahorro reservado */
(() => {
  'use strict';

  const VERSION = '35.0-beta.6';
  if (window.HFEtapa18Beta6?.version === VERSION) return;

  const state = {
    started:false,
    installTimer:null,
    financeTimer:null,
    originalRenderTodo:null,
    coherenceWrapped:false,
    transferGoalId:'',
    transferType:'aporte',
    transferContext:null,
    lastContext:null
  };

  const $ = id => document.getElementById(id);
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const money = value => `S/ ${num(value).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';

  function todayISO() {
    return new Date().toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  }

  function visibleMonth() {
    const fromDb = window.DB?.getMesActual?.();
    if (/^\d{4}-\d{2}$/.test(String(fromDb || ''))) return String(fromDb);
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

  function totalReserved(goals=[]) {
    return round((goals || []).reduce((sum, goal) => sum + Math.max(0, num(goal?.actual)), 0));
  }

  function netReservedMonth(goals=[], month=visibleMonth()) {
    return round((goals || []).reduce((sum, goal) => sum + num(goal?.reservadoMeses?.[month]), 0));
  }

  async function financialContext() {
    if (!window.DB) return null;
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
    const availableBeforeSaving = round(incomeTotal - cashOut);
    const reserved = totalReserved(goals || []);
    const savedThisMonth = netReservedMonth(goals || [], month);
    const targetTotal = round((goals || []).reduce((sum, goal) => sum + Math.max(0, num(goal?.objetivo)), 0));

    /*
      Regla contable canónica:
      - el arrastre mensual actual incluye el efectivo que no se gastó;
      - las metas NO son un gasto y por eso también viajan dentro de ese arrastre;
      - por tanto, para saber qué dinero sigue realmente libre hoy hay que restar
        TODO el saldo que permanece reservado en metas, no solo el neto apartado
        durante el mes visible.

      Esto evita el error 872 -> 972 al retirar S/100 de una meta cuyo movimiento
      mensual quedó asociado a otro mes por versiones beta anteriores.
    */
    const available = round(availableBeforeSaving - reserved);

    const context = {
      version:VERSION,
      month,
      incomes:incomes || [],
      expenses:expenses || [],
      goals:goals || [],
      incomeTotal,
      cashOut,
      availableBeforeSaving,
      totalSaved:reserved,
      savedThisMonth,
      targetTotal,
      available
    };
    state.lastContext = context;
    return context;
  }

  function patchFinancialUI(context) {
    if (!context) return;
    const { available, totalSaved:reserved, targetTotal, incomeTotal } = context;

    const availableNode = $('kpi-disponible');
    if (availableNode) availableNode.textContent = money(available);
    const availableHelp = availableNode?.closest('.month-money-card')?.querySelector('.month-money-help');
    if (availableHelp) availableHelp.textContent = 'Ingresos menos gastos, pagos de deuda y dinero reservado en metas';

    const savedNode = $('kpi-ahorro-real');
    if (savedNode) savedNode.textContent = money(reserved);
    const savedHelp = savedNode?.closest('.month-money-card')?.querySelector('.month-money-help');
    if (savedHelp) savedHelp.textContent = reserved > 0 ? 'Dinero que permanece apartado en tus metas' : 'Todavía no hay dinero reservado';

    if ($('kpi-ahorro2')) $('kpi-ahorro2').textContent = money(reserved);
    if ($('kpi-ahorro2-sub')) $('kpi-ahorro2-sub').textContent = reserved > 0 ? 'Total reservado en metas' : 'Todavía no hay dinero reservado';
    if ($('kpi-fondo')) $('kpi-fondo').textContent = targetTotal > 0 ? money(Math.max(0, targetTotal - reserved)) : 'Sin meta';

    const objectiveAvailable = document.querySelector('#regla-502030 .hf-financial-objective.available');
    if (objectiveAvailable?.querySelector('strong')) objectiveAvailable.querySelector('strong').textContent = money(Math.max(0, available));
    if (objectiveAvailable?.querySelector('small')) objectiveAvailable.querySelector('small').textContent = 'Después de gastos, pagos de deuda y dinero reservado';

    const objectives = [...document.querySelectorAll('#regla-502030 .hf-financial-objective')];
    const objectiveSaving = objectives.find(node => /ahorro reservado/i.test(node.querySelector('span')?.textContent || ''));
    if (objectiveSaving?.querySelector('strong')) objectiveSaving.querySelector('strong').textContent = money(reserved);

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
      if (strong) strong.textContent = targetTotal > 0 ? `${money(reserved)} de ${money(targetTotal)}` : money(reserved);
    }
  }

  async function refreshFinancialUI() {
    try {
      const context = await financialContext();
      patchFinancialUI(context);
      return context;
    } catch (error) {
      console.warn('No se pudo refrescar la contabilidad V35 beta 6:', error);
      return null;
    }
  }

  function scheduleFinanceRefresh(delay=180) {
    clearTimeout(state.financeTimer);
    state.financeTimer = setTimeout(refreshFinancialUI, delay);
  }

  function wrapRenderTodo() {
    if (state.originalRenderTodo || typeof window.renderTodo !== 'function') return Boolean(state.originalRenderTodo);
    state.originalRenderTodo = window.renderTodo;
    window.renderTodo = async function renderTodoV35Beta6(...args) {
      const result = await state.originalRenderTodo.apply(this, args);
      await refreshFinancialUI();
      return result;
    };
    return true;
  }

  function wrapCoherence() {
    const current = window.HFCoherenciaFinanciera;
    if (!current || state.coherenceWrapped || typeof current.calcularResumen !== 'function') return Boolean(current && state.coherenceWrapped);
    if (current.__hfV35Beta6) { state.coherenceWrapped = true; return true; }

    const previousCalc = current.calcularResumen.bind(current);
    const previousUpdate = typeof current.actualizar === 'function' ? current.actualizar.bind(current) : null;
    const beta5AlreadySubtractsMonthly = current.__hfV35Beta5 === true;

    const correctedCalc = args => {
      const result = previousCalc(args) || {};
      const goals = args?.metas || [];
      const month = visibleMonth();
      const monthNet = netReservedMonth(goals, month);
      const reserved = totalReserved(goals);
      const base = num(result.disponibleSinAsignar);
      const available = beta5AlreadySubtractsMonthly
        ? round(base - (reserved - monthNet))
        : round(base - reserved);
      return {
        ...result,
        ahorroReservado:reserved,
        ahorroApartadoMes:monthNet,
        disponibleSinAsignar:available
      };
    };

    const correctedUpdate = previousUpdate ? async (...args) => {
      const result = await previousUpdate(...args);
      const context = await refreshFinancialUI();
      if (!context) return result;
      return {
        ...(result || {}),
        ahorroReservado:context.totalSaved,
        ahorroApartadoMes:context.savedThisMonth,
        disponibleSinAsignar:context.available
      };
    } : undefined;

    window.HFCoherenciaFinanciera = Object.freeze({
      ...current,
      calcularResumen:correctedCalc,
      ...(correctedUpdate ? { actualizar:correctedUpdate } : {}),
      __hfV35Beta6:true
    });
    state.coherenceWrapped = true;
    return true;
  }

  function ensureSavingModal() {
    if ($('hfSavingTransferModal')) return;
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="hfSavingTransferModal" onclick="closeModalOutside(event,'hfSavingTransferModal')"><div class="modal-sheet hf-v35-saving-sheet" style="position:relative"><button class="modal-close" type="button" onclick="closeModal('hfSavingTransferModal')">✕</button><div class="modal-handle"></div><div class="modal-title" id="hf-v35-saving-title">Apartar dinero</div><div class="hf-v35-saving-context" id="hf-v35-saving-context"></div><div class="input-row"><label class="input-label" for="hf-v35-saving-amount">Monto (S/)</label><input class="input-field" id="hf-v35-saving-amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="0.00"></div><div class="input-row"><label class="input-label" for="hf-v35-saving-date">Fecha</label><input class="input-field" id="hf-v35-saving-date" type="date"></div><div class="input-row"><label class="input-label" for="hf-v35-saving-note">Nota (opcional)</label><input class="input-field" id="hf-v35-saving-note" type="text" maxlength="120" placeholder="Ej.: Aporte de agosto"></div><div class="hf-v35-saving-preview" id="hf-v35-saving-preview" aria-live="polite"></div><button class="modal-btn primary" id="hf-v35-saving-submit" type="button">Apartar dinero</button></div></div>`);
  }

  function replaceControl(id, eventName, handler) {
    const current = $(id);
    if (!current) return null;
    if (current.dataset.hfV35Beta6 === VERSION) return current;
    const clean = current.cloneNode(true);
    clean.dataset.hfV35Beta6 = VERSION;
    current.replaceWith(clean);
    clean.addEventListener(eventName, handler);
    return clean;
  }

  function bindTransferControls() {
    ensureSavingModal();
    replaceControl('hf-v35-saving-amount', 'input', updateSavingPreview);
    replaceControl('hf-v35-saving-date', 'change', updateSavingPreview);
    replaceControl('hf-v35-saving-submit', 'click', submitSavingTransfer);
  }

  function updateSavingPreview() {
    const context = state.transferContext;
    const preview = $('hf-v35-saving-preview');
    if (!context || !preview || !state.transferGoalId) return;
    const goal = context.goals.find(item => String(item.id) === String(state.transferGoalId));
    if (!goal) return;
    const amount = Math.max(0, num($('hf-v35-saving-amount')?.value));
    const current = Math.max(0, num(goal.actual));
    const contribution = state.transferType === 'aporte';
    const nextGoal = contribution ? current + amount : Math.max(0, current - amount);
    const nextAvailable = contribution ? context.available - amount : context.available + amount;
    preview.innerHTML = `<div><span>La meta quedará en</span><strong>${money(nextGoal)}</strong></div><div><span>Disponible después</span><strong class="${nextAvailable < 0 ? 'danger' : ''}">${money(nextAvailable)}</strong></div>`;
  }

  async function openSavingTransfer(goalId, type='aporte') {
    bindTransferControls();
    const context = await financialContext();
    if (!context) return window.showToast?.('No se pudo calcular el disponible.', 'error');
    const goal = context.goals.find(item => String(item.id) === String(goalId));
    if (!goal) return window.showToast?.('No se encontró la meta.', 'error');

    state.transferGoalId = String(goalId);
    state.transferType = type === 'retiro' ? 'retiro' : 'aporte';
    state.transferContext = context;

    const contribution = state.transferType === 'aporte';
    const current = Math.max(0, num(goal.actual));
    const target = Math.max(0, num(goal.objetivo));
    const remaining = target > 0 ? Math.max(0, round(target - current)) : Math.max(0, context.available);
    const month = context.month;
    const today = todayISO();
    const date = today.slice(0,7) === month ? today : `${month}-01`;

    $('hf-v35-saving-title').textContent = contribution ? 'Apartar dinero' : 'Retirar de la meta';
    $('hf-v35-saving-context').innerHTML = `<div><span>Meta</span><strong>${esc(goal.nombre || 'Meta')}</strong></div><div><span>Reservado</span><strong>${money(current)}</strong></div><div><span>${contribution ? 'Disponible hoy' : 'Puede retirarse'}</span><strong>${money(contribution ? Math.max(0, context.available) : current)}</strong></div>`;

    const amountNode = $('hf-v35-saving-amount');
    amountNode.value = '';
    amountNode.max = contribution ? Math.max(0, Math.min(context.available, remaining)) : current;
    amountNode.placeholder = `Máx. ${money(amountNode.max)}`;

    const dateNode = $('hf-v35-saving-date');
    dateNode.value = date;
    dateNode.min = `${month}-01`;
    dateNode.max = monthLastDay(month);
    $('hf-v35-saving-note').value = '';
    $('hf-v35-saving-submit').textContent = contribution ? 'Apartar dinero' : 'Retirar dinero';
    updateSavingPreview();
    window.openModal?.('hfSavingTransferModal');
  }

  async function submitSavingTransfer() {
    if (!state.transferGoalId || !window.db || !window.DB?.hogarId) return window.showToast?.('Selecciona la meta nuevamente.', 'error');
    const context = await financialContext();
    if (!context) return window.showToast?.('No se pudo calcular el disponible.', 'error');
    const goal = context.goals.find(item => String(item.id) === String(state.transferGoalId));
    if (!goal) return window.showToast?.('No se encontró la meta.', 'error');

    const amount = round($('hf-v35-saving-amount')?.value);
    const date = validDate($('hf-v35-saving-date')?.value);
    const note = String($('hf-v35-saving-note')?.value || '').trim();
    const month = context.month;
    const contribution = state.transferType === 'aporte';
    const current = Math.max(0, num(goal.actual));
    const target = Math.max(0, num(goal.objetivo));

    if (!(amount > 0)) return window.showToast?.('Ingresa un monto mayor que cero.', 'error');
    if (!date || date.slice(0,7) !== month) return window.showToast?.('La fecha debe pertenecer al mes que estás viendo.', 'error');
    if (contribution && amount > context.available + 0.01) return window.showToast?.(`Solo hay ${money(Math.max(0, context.available))} disponibles para apartar.`, 'error');
    if (contribution && target > 0 && current + amount > target + 0.01) return window.showToast?.(`A la meta le faltan ${money(Math.max(0, target-current))}.`, 'error');
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

        transaction.update(ref, {
          actual:Math.max(0, after),
          reservadoMeses:byMonth,
          contabilidadAhorroV35:'beta6-saldo-canonico',
          actualizadoEn:new Date().toISOString()
        });
        transaction.set(movementRef, {
          tipo:contribution ? 'aporte' : 'retiro',
          monto:amount,
          fecha:date,
          mes:month,
          nota:note,
          quien:member.legacy,
          miembroId:member.id || null,
          miembroNombre:member.name || '',
          saldoAnterior:before,
          saldoPosterior:Math.max(0, after),
          origen:'etapa-18-beta6',
          creadoEn:firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      window.closeModal?.('hfSavingTransferModal');
      state.transferContext = null;
      window.showToast?.(contribution ? 'Dinero apartado en la meta.' : 'Dinero devuelto al disponible.');
      await window.renderTodo?.();
      window.dispatchEvent(new CustomEvent('hf:ahorro-reservado-actualizado', {
        detail:{ goalId:goal.id, type:contribution ? 'aporte' : 'retiro', amount, month, version:VERSION }
      }));
      setTimeout(() => window.HFAhorroResumen35?.refreshGoals?.(), 100);
      setTimeout(refreshFinancialUI, 220);
    } catch (error) {
      console.error('No se pudo mover dinero de la meta V35 beta 6:', error);
      window.showToast?.(error?.message || 'No se pudo actualizar la meta.', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = state.transferType === 'retiro' ? 'Retirar dinero' : 'Apartar dinero';
      }
    }
  }

  function interceptSavingActions() {
    document.addEventListener('click', event => {
      const button = event.target.closest?.('[data-hf-saving]');
      if (!button || button.dataset.hfSaving === 'historial') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openSavingTransfer(button.dataset.goalId, button.dataset.hfSaving);
    }, true);
  }

  function installWhenReady() {
    let attempts = 0;
    clearInterval(state.installTimer);
    state.installTimer = setInterval(() => {
      attempts += 1;
      const beta5Ready = Boolean(window.HFEtapa18Beta5);
      const renderReady = wrapRenderTodo();
      const coherenceReady = wrapCoherence();
      if ((beta5Ready && renderReady && coherenceReady) || attempts >= 60) {
        clearInterval(state.installTimer);
        state.installTimer = null;
        refreshFinancialUI();
      }
    }, 100);
  }

  function start() {
    if (state.started) return;
    state.started = true;
    ensureSavingModal();
    interceptSavingActions();
    installWhenReady();
    ['hf:ahorro-reservado-actualizado','hf:objetivo-financiero-guardado','hf:gastos-actualizados','hf:deuda-actualizada']
      .forEach(name => window.addEventListener(name, () => scheduleFinanceRefresh(220)));
  }

  window.HFEtapa18Beta6 = Object.freeze({
    version:VERSION,
    financialContext,
    refreshFinancialUI,
    openSavingTransfer,
    totalReserved,
    netReservedMonth,
    getState:() => ({ version:VERSION, context:state.lastContext })
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
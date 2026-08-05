(() => {
  'use strict';

  const VERSION = '33.0';
  if (window.HFDeudasRedesign24?.version === VERSION) return;

  const state = {
    rendering: false,
    editingCardId: null,
    paymentCard: null,
    observer: null,
    scheduled: false
  };

  const $ = id => document.getElementById(id);
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const money = value => `S/ ${number(value).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));

  const ICONS = {
    chart:'<svg viewBox="0 0 24 24"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"></path></svg>',
    calculator:'<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="3"></rect><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4"></path></svg>',
    addCard:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18M12 13v4M10 15h4"></path></svg>',
    bank:'<svg viewBox="0 0 24 24"><path d="m3 10 9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"></path></svg>',
    calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>',
    coins:'<svg viewBox="0 0 24 24"><ellipse cx="8" cy="7" rx="5" ry="3"></ellipse><path d="M3 7v4c0 1.7 2.2 3 5 3M11 14c0-1.7 2.2-3 5-3s5 1.3 5 3-2.2 3-5 3-5-1.3-5-3Zm0 0v4c0 1.7 2.2 3 5 3s5-1.3 5-3v-4"></path></svg>',
    layers:'<svg viewBox="0 0 24 24"><path d="m12 2 9 5-9 5-9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"></path></svg>',
    more:'<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>',
    edit:'<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>',
    trash:'<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 5v5m4-5v5"></path></svg>',
    down:'<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"></path></svg>',
    history:'<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"></path></svg>'
  };

  function toast(message, type = 'success') {
    if (typeof window.showToast === 'function') window.showToast(message, type);
    else if (typeof window.mostrarToast === 'function') window.mostrarToast(message, type);
  }

  function dateShort(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'No informado';
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-PE', { day:'2-digit', month:'short' });
  }

  function daysUntil(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    return Math.ceil((new Date(`${value}T12:00:00`) - base) / 86400000);
  }

  function isAdmin() {
    try {
      const member = window.obtenerMiembroActual?.();
      if (member) return member.rol === 'administrador' || member.legacyTipo === 'yo';
    } catch (_) {}
    return localStorage.getItem('miUsuarioTipo') !== 'pareja';
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
    if (actions && actions.dataset.hfFinal !== VERSION) {
      actions.dataset.hfFinal = VERSION;
      actions.innerHTML = `
        <button class="hf-debt-admin-action hf-v24-featured" type="button" data-final-action="states">${actionMarkup(ICONS.chart,'Estados de cuenta y evolución','Compara saldos confirmados y pagos por mes.')}</button>
        <button class="hf-debt-admin-action" type="button" data-final-action="plan">${actionMarkup(ICONS.calculator,'Calcular cómo pagar','Simula cuotas, tiempo e intereses con la TEA registrada.')}</button>
        <button class="hf-debt-admin-action" type="button" data-final-action="card">${actionMarkup(ICONS.addCard,'Agregar tarjeta','Registra línea, fechas y TEA de la tarjeta.')}</button>
        <button class="hf-debt-admin-action" type="button" data-final-action="loan">${actionMarkup(ICONS.bank,'Agregar préstamo','Registra saldo, cuota y vencimiento.')}</button>`;

      actions.querySelector('[data-final-action="states"]')?.addEventListener('click', () => {
        window.closeModal?.('hfDebtAdminModal');
        setTimeout(() => window.HFExperienciaFinanciera14?.abrirCentroEstados?.(), 80);
      });
      actions.querySelector('[data-final-action="plan"]')?.addEventListener('click', () => {
        window.closeModal?.('hfDebtAdminModal');
        setTimeout(() => (window.abrirCentroFinanciero || window.abrirPlanificadorDeudas)?.(), 80);
      });
      actions.querySelector('[data-final-action="card"]')?.addEventListener('click', () => {
        window.closeModal?.('hfDebtAdminModal');
        setTimeout(openNewCard, 80);
      });
      actions.querySelector('[data-final-action="loan"]')?.addEventListener('click', () => {
        window.closeModal?.('hfDebtAdminModal');
        setTimeout(() => window.abrirNuevoPrestamo?.(), 80);
      });
    }

    modal.querySelector('.hf-debt-admin-separator')?.remove();
    modal.querySelector('#hf-admin-card-actions')?.remove();
  }

  function ensureCardFields() {
    const modal = $('tarjetaModal');
    if (!modal) return;

    if (!$('t-tea')) {
      const row = $('t-limite')?.closest('.input-row') || $('t-quien')?.closest('.input-row');
      row?.insertAdjacentHTML('afterend', `
        <div class="input-row input-row-two hf-v24-card-finance-fields">
          <div><label class="input-label" for="t-tea">TEA anual (%)</label><input type="number" min="0" step="0.01" inputmode="decimal" class="input-field" id="t-tea" placeholder="Ej.: 89.90"><small class="field-help">Se usa para simulaciones de tiempo e intereses.</small></div>
          <div><label class="input-label" for="t-ultimos4">Últimos 4 dígitos</label><input type="text" inputmode="numeric" maxlength="4" class="input-field" id="t-ultimos4" placeholder="1234"><small class="field-help">Solo para identificar la tarjeta.</small></div>
        </div>`);
    }

    modal.querySelector('.statement-initial-box')?.style.setProperty('display','none','important');
    if (!modal.querySelector('.hf-v24-statement-note')) {
      const row = $('t-cierre')?.closest('.input-row');
      row?.insertAdjacentHTML('afterend', `<div class="hf-v24-statement-note">${ICONS.history}<div><strong>Estados mensuales separados</strong><span>Pago mínimo, pago total, saldo confirmado y comparaciones por mes se registran desde “Estados de cuenta y evolución”.</span></div></div>`);
    }
  }

  function clearCardForm() {
    state.editingCardId = null;
    ['t-nombre','t-deuda','t-limite','t-cierre','t-vence','t-tea','t-ultimos4'].forEach(id => { if ($(id)) $(id).value = ''; });
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
    const card = (await window.DB?.getTarjetas?.() || []).find(item => String(item.id) === String(id));
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
    const name = String($('t-nombre')?.value || '').trim();
    if (!name) return toast('Escribe el nombre de la tarjeta.', 'error');

    const cards = await window.DB.getTarjetas();
    const current = cards.find(item => String(item.id) === String(state.editingCardId));
    const tea = round($('t-tea')?.value);
    const limit = round($('t-limite')?.value);
    const closeDay = String($('t-cierre')?.value || '').trim();
    const dueDay = String($('t-vence')?.value || '').trim();
    const data = {
      nombre:name,
      deuda:round($('t-deuda')?.value),
      limite:limit,
      lineaTotal:limit,
      cierre:closeDay,
      diaCierre:closeDay,
      vence:dueDay,
      diaVencimiento:dueDay,
      quien:$('t-quien')?.value || 'yo',
      tea,
      tasaEfectivaAnual:tea,
      ultimosDigitos:String($('t-ultimos4')?.value || '').replace(/\D/g,'').slice(-4),
      estadoCuenta:current?.estadoCuenta || null,
      historialEstados:current?.historialEstados || [],
      actualizadoEn:new Date().toISOString()
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
    scheduleRender();
  }

  function ensureAvailableBalanceField() {
    const modal = $('pagoTarjetaModal');
    if (!modal) return;

    let inputs = [...modal.querySelectorAll('#pago-disponible-banco')];
    let input = inputs.find(item => item.closest('.hf-payment-bank-balance, .hf-v27-payment-available')) || inputs.at(-1);
    inputs.forEach(item => { if (item !== input) item.closest('.input-row, .form-row, .form-group')?.remove(); });

    if (!input) {
      const noteRow = $('pago-nota')?.closest('.input-row');
      const dateRow = $('pago-fecha')?.closest('.input-row');
      const anchor = noteRow || dateRow;
      anchor?.insertAdjacentHTML('afterend', `<div class="input-row hf-payment-bank-balance hf-v27-payment-available"><label class="input-label" for="pago-disponible-banco">Línea disponible después del pago (opcional)</label><input type="number" step="0.01" inputmode="decimal" class="input-field" id="pago-disponible-banco" placeholder="Ej.: 209.73"><small class="field-help">Escribe el disponible que muestra el banco después del pago. Con la línea de crédito, la app confirmará la deuda real.</small><div class="hf-v24-payment-preview" id="hf-v24-payment-preview" aria-live="polite"></div></div>`);
      input = $('pago-disponible-banco');
    }

    const row = input?.closest('.input-row, .hf-payment-bank-balance');
    const noteRow = $('pago-nota')?.closest('.input-row');
    if (noteRow && row && noteRow.nextElementSibling !== row) noteRow.after(row);
    if (!$('hf-v24-payment-preview')) row?.insertAdjacentHTML('beforeend','<div class="hf-v24-payment-preview" id="hf-v24-payment-preview" aria-live="polite"></div>');

    [input, $('pago-monto')].filter(Boolean).forEach(field => {
      if (field.dataset.hfPreview === VERSION) return;
      field.dataset.hfPreview = VERSION;
      field.addEventListener('input', updatePaymentPreview);
    });
  }

  function updatePaymentPreview() {
    const preview = $('hf-v24-payment-preview');
    if (!preview || !state.paymentCard) return;
    const debt = number(state.paymentCard.deuda || state.paymentCard.saldo);
    const limit = number(state.paymentCard.limite || state.paymentCard.lineaTotal);
    const amount = number($('pago-monto')?.value);
    const availableRaw = String($('pago-disponible-banco')?.value || '').trim();
    let result = Math.max(0, debt - amount);
    let text = `Deuda estimada después del pago: ${money(result)}.`;
    if (availableRaw !== '' && Number.isFinite(Number(availableRaw)) && limit > 0) {
      result = Math.max(0, round(limit - Number(availableRaw)));
      text = `Con el disponible del banco, la deuda quedará confirmada en ${money(result)}.`;
    }
    preview.textContent = text;
  }

  function cardName(item = {}) { return item.nombre || item.banco || 'Tarjeta'; }
  function loanName(item = {}) { return item.nombre || item.entidad || item.banco || 'Préstamo'; }

  function cardSummary(item = {}) {
    const live = window.HFDeudasActuales?.obtenerTarjeta?.(item.id);
    const debt = Math.max(0, number(live?.deudaEstimada ?? item.deuda ?? item.saldo));
    const limit = Math.max(0, number(live?.lineaTotal ?? item.limite ?? item.lineaTotal));
    const available = limit > 0 ? limit - debt : null;
    const minimum = Math.max(0, number(live?.pagoMinimo ?? item.estadoCuenta?.pagoMinimo ?? item.pagoMinimo));
    const due = live?.fechaVencimiento ?? item.fechaVencimiento ?? item.estadoCuenta?.fechaVencimiento ?? '';
    const usage = limit > 0 ? debt / limit * 100 : 0;
    const days = daysUntil(due);
    let tone='good', label='Al día';
    if (available !== null && available < 0) { tone='danger'; label='Línea excedida'; }
    else if (days !== null && days < 0) { tone='danger'; label='Vencida'; }
    else if (days !== null && days <= 3) { tone='warning'; label='Vence pronto'; }
    else if (usage >= 90) { tone='warning'; label='Casi al límite'; }
    else if ((days !== null && days <= 7) || usage >= 75) { tone='warning'; label='Atención'; }
    return { item, debt, limit, available, minimum, due, usage, tone, label };
  }

  function loanSummary(item = {}) {
    const balance = Math.max(0, number(item.saldoPendiente ?? item.saldo ?? item.deuda ?? item.montoPendiente ?? item.monto));
    const installment = Math.max(0, number(item.cuotaMensual ?? item.cuota ?? item.pagoMensual));
    const due = item.proximoVencimiento || item.fechaVencimiento || item.vencimiento || '';
    const days = daysUntil(due);
    const paid = number(item.pagadas ?? item.cuotasPagadas);
    const total = number(item.total ?? item.cuotasTotales);
    const original = number(item.montoOriginal ?? item.montoInicial ?? item.capitalInicial);
    const progress = total > 0 ? Math.min(100, Math.max(0, paid / total * 100)) : original > 0 ? Math.min(100, Math.max(0, (original-balance)/original*100)) : 0;
    let tone='good', label='Al día';
    if (days !== null && days < 0) { tone='danger'; label='Vencido'; }
    else if (days !== null && days <= 3) { tone='warning'; label='Vence pronto'; }
    else if (days !== null && days <= 7) { tone='warning'; label='Próximo'; }
    return { item, balance, installment, due, paid, total, original, progress, tone, label };
  }

  function detailCell(label, value) {
    return `<div class="hf-v24-detail-cell"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value || 'No informado')}</strong></div>`;
  }

  function menuMarkup() {
    return `<div class="hf-v24-menu-wrap"><button type="button" class="hf-v24-menu-button" aria-label="Editar o eliminar">${ICONS.more}</button><div class="hf-v24-menu"><button type="button" data-menu-action="edit">${ICONS.edit}<span>Editar</span></button><button type="button" class="danger" data-menu-action="delete">${ICONS.trash}<span>Eliminar</span></button></div></div>`;
  }

  function closeMenus(except = null) {
    document.querySelectorAll('.hf-v24-menu.open').forEach(menu => {
      if (menu !== except) menu.classList.remove('open');
    });
  }

  function cardDetails(summary) {
    const item = summary.item;
    const closeDate = item.fechaCierre || item.estadoCuenta?.fechaCierre || '';
    const closeDay = item.cierre || item.diaCierre || '';
    const dueDay = item.vence || item.diaVencimiento || '';
    const last4 = item.ultimosDigitos || item.ultimos4 || '';
    const tea = number(item.tea || item.tasaEfectivaAnual);
    return `<div class="hf-v24-detail-grid">${detailCell('Próximo cierre',closeDate?dateShort(closeDate):closeDay?`Día ${closeDay}`:'')}${detailCell('Día habitual de pago',dueDay?`Día ${dueDay}`:'')}${detailCell('Tarjeta',last4?`•••• ${last4}`:'')}${detailCell('TEA anual',tea>0?`${tea.toFixed(2)}%`:'')}${detailCell('Último estado',item.estadoCuenta?.periodo||'')}${detailCell('Pago total informado',number(item.estadoCuenta?.pagoTotal)>0?money(item.estadoCuenta.pagoTotal):'')}</div><button type="button" class="hf-v24-history-action">${ICONS.history}<span>Ver estados y evolución mensual</span></button>`;
  }

  function loanDetails(summary) {
    const item = summary.item;
    return `<div class="hf-v24-detail-grid">${detailCell('Monto original',summary.original>0?money(summary.original):'')}${detailCell('Frecuencia',item.frecuencia||'')}${detailCell('Cuotas pagadas',summary.total>0?String(summary.paid):'')}${detailCell('Total de cuotas',summary.total>0?String(summary.total):'')}${detailCell('Cuotas restantes',item.cuotasRestantes??item.cuotasPendientes??'')}${detailCell('Próximo vencimiento',dateShort(summary.due))}</div>`;
  }

  function cardMarkup(summary) {
    const item=summary.item, name=cardName(item), pct=Math.max(0,Math.min(100,summary.usage));
    return `<article class="hf-family-card hf-v24-debt-card hf-v24-${summary.tone}" data-debt-id="${escapeHTML(item.id)}" data-debt-type="card"><div class="hf-v24-card-head"><div class="hf-v24-identity"><div class="hf-v24-title-row"><strong>${escapeHTML(name)}</strong><span class="hf-v24-status">${escapeHTML(summary.label)}</span></div><small>Tarjeta de crédito</small></div>${isAdmin()?menuMarkup():''}</div><div class="hf-v24-metrics"><div><span>Deuda total</span><strong>${money(summary.debt)}</strong></div><div><span>Disponible</span><strong>${summary.available==null?'No informada':money(summary.available)}</strong></div></div>${summary.limit>0?`<div class="hf-v24-progress"><i style="width:${pct.toFixed(1)}%"></i></div><div class="hf-v24-progress-labels"><span>${Math.round(summary.usage)}% utilizado</span><span>Línea ${money(summary.limit)}</span></div>`:''}<div class="hf-v24-glance"><div><span>${ICONS.calendar}</span><div><small>Vencimiento</small><strong>${dateShort(summary.due)}</strong></div></div><div><span>${ICONS.coins}</span><div><small>Pago mínimo</small><strong>${summary.minimum>0?money(summary.minimum):'No informado'}</strong></div></div></div><div class="hf-v24-details" hidden>${cardDetails(summary)}</div><div class="hf-v24-actions"><button type="button" class="hf-v24-primary-action">Registrar pago</button><button type="button" class="hf-v24-details-button"><span>Ver detalles</span>${ICONS.down}</button></div></article>`;
  }

  function loanMarkup(summary) {
    const item=summary.item, name=loanName(item);
    const progressRight=summary.total>0?`${summary.paid} de ${summary.total} cuotas`:summary.original>0?`Original ${money(summary.original)}`:'Progreso sin datos';
    return `<article class="hf-family-card hf-v24-debt-card hf-v24-loan hf-v24-${summary.tone}" data-debt-id="${escapeHTML(item.id)}" data-debt-type="loan"><div class="hf-v24-card-head"><div class="hf-v24-identity"><div class="hf-v24-title-row"><strong>${escapeHTML(name)}</strong><span class="hf-v24-status">${escapeHTML(summary.label)}</span></div><small>Préstamo</small></div>${isAdmin()?menuMarkup():''}</div><div class="hf-v24-metrics"><div><span>Falta pagar</span><strong>${money(summary.balance)}</strong></div><div><span>Próxima cuota</span><strong>${summary.installment>0?money(summary.installment):'No informada'}</strong></div></div><div class="hf-v24-progress"><i style="width:${summary.progress.toFixed(1)}%"></i></div><div class="hf-v24-progress-labels"><span>${Math.round(summary.progress)}% pagado</span><span>${escapeHTML(progressRight)}</span></div><div class="hf-v24-glance"><div><span>${ICONS.calendar}</span><div><small>Vencimiento</small><strong>${dateShort(summary.due)}</strong></div></div><div><span>${ICONS.layers}</span><div><small>Cuotas restantes</small><strong>${item.cuotasRestantes??item.cuotasPendientes??'No informadas'}</strong></div></div></div><div class="hf-v24-details" hidden>${loanDetails(summary)}</div><div class="hf-v24-actions"><button type="button" class="hf-v24-primary-action">Pagar cuota</button><button type="button" class="hf-v24-details-button"><span>Ver detalles</span>${ICONS.down}</button></div></article>`;
  }

  function attachEvents(root, cards, loans) {
    root.querySelectorAll('.hf-v24-debt-card').forEach(card => {
      const id=card.dataset.debtId, type=card.dataset.debtType;
      const item=(type==='card'?cards:loans).find(value=>String(value.id)===String(id));
      if (!item) return;
      const summary=type==='card'?cardSummary(item):loanSummary(item);
      const menu=card.querySelector('.hf-v24-menu');
      card.querySelector('.hf-v24-menu-button')?.addEventListener('click',event=>{event.stopPropagation();const open=!menu.classList.contains('open');closeMenus(menu);menu.classList.toggle('open',open);});
      card.querySelector('[data-menu-action="edit"]')?.addEventListener('click',event=>{event.stopPropagation();closeMenus();if(type==='card')openEditCard(id);else window.abrirEditarPrestamo?.(item.id,loanName(item),summary.balance,summary.installment,number(item.pagadas),number(item.total||item.cuotasTotales),item.quien||'yo',item.proximoVencimiento||item.fechaVencimiento||'',item.frecuencia||'mensual');});
      card.querySelector('[data-menu-action="delete"]')?.addEventListener('click',event=>{event.stopPropagation();closeMenus();if(type==='card')window.eliminarTarjeta?.(id);else window.eliminarPrestamo?.(id);});
      card.querySelector('.hf-v24-details-button')?.addEventListener('click',()=>{const details=card.querySelector('.hf-v24-details');const opening=details.hidden;details.hidden=!opening;card.querySelector('.hf-v24-details-button span').textContent=opening?'Ocultar detalles':'Ver detalles';});
      if(type==='card'){
        card.querySelector('.hf-v24-primary-action')?.addEventListener('click',()=>{state.paymentCard=item;window.abrirPagoTarjeta?.(item.id,cardName(item),summary.debt);setTimeout(()=>{ensureAvailableBalanceField();updatePaymentPreview();},0);});
        card.querySelector('.hf-v24-history-action')?.addEventListener('click',()=>window.HFExperienciaFinanciera14?.abrirEstadosTarjeta?.(item.id));
      }else{
        card.querySelector('.hf-v24-primary-action')?.addEventListener('click',()=>window.abrirPagoPrestamo?.(item.id,loanName(item),summary.balance,summary.installment,item.proximoVencimiento||item.fechaVencimiento||'',item.frecuencia||'mensual',item.quien||'yo'));
      }
    });
  }

  async function renderDebtPage(cardsInput=null, loansInput=null) {
    if(state.rendering) return;
    const view=$('hf-family-debt-view');
    if(!view) return;
    const lists=view.querySelectorAll('.hf-family-card-list');
    if(lists.length<2) return;
    state.rendering=true;
    try{
      const cards=Array.isArray(cardsInput)?cardsInput:await window.DB.getTarjetas();
      const loans=Array.isArray(loansInput)?loansInput:await window.DB.getPrestamos();
      lists[0].innerHTML=cards.length?cards.map(item=>cardMarkup(cardSummary(item))).join(''):'<div class="hf-family-priority-empty">No hay tarjetas registradas.</div>';
      lists[1].innerHTML=loans.length?loans.map(item=>loanMarkup(loanSummary(item))).join(''):'<div class="hf-family-priority-empty">No hay préstamos registrados.</div>';
      attachEvents(view,cards,loans);
      window.HFDeudasFixes25?.repair?.();
    }catch(error){console.warn('No se pudo renderizar Deudas V33:',error);}finally{state.rendering=false;}
  }

  function scheduleRender() {
    if(state.scheduled) return;
    state.scheduled=true;
    queueMicrotask(async()=>{state.scheduled=false;await renderDebtPage();});
  }

  function installObserver() {
    const page=$('page-deudas');
    if(!page||state.observer) return;
    state.observer=new MutationObserver(mutations=>{
      const oldCards=mutations.some(mutation=>[...mutation.addedNodes].some(node=>node instanceof Element&&(node.matches?.('.hf-family-card:not(.hf-v24-debt-card)')||node.querySelector?.('.hf-family-card:not(.hf-v24-debt-card)'))));
      if(oldCards) scheduleRender();
      if($('hfDebtAdminModal')) enhanceAdminModal();
    });
    state.observer.observe(page,{childList:true,subtree:true});
  }

  function start() {
    ensureCardFields();
    ensureAvailableBalanceField();
    enhanceAdminModal();
    installObserver();
    window.abrirNuevaTarjeta=openNewCard;
    window.abrirEditarTarjeta=openEditCard;
    window.agregarTarjeta=saveCard;
    document.addEventListener('click',event=>{if(!event.target.closest('.hf-v24-menu-wrap'))closeMenus();});
    ['hf:deuda-actualizada','hf:deudas-core-actualizadas','hf:estado-cuenta-confirmado','hf:deudas-recalculadas']
      .forEach(name=>window.addEventListener(name,()=>{enhanceAdminModal();ensureAvailableBalanceField();scheduleRender();}));
    scheduleRender();
  }

  window.HFDeudasRedesign24=Object.freeze({version:VERSION,renderDebtPage,repair:scheduleRender,enhanceAdminModal,ensureCardFields,ensureAvailableBalanceField,openEditCard,saveCard});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

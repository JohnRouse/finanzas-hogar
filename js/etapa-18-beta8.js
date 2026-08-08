/* Hogar Finanzas — Etapa 18 V35.0-beta.8
   - Una edición siempre actualiza la tarjeta original y nunca crea una copia.
   - El planificador recibe TEA y metadatos desde la tarjeta canónica.
   - Detecta y puede consolidar duplicados creados por el conflicto de editores.
   - Al tocar una tarjeta abre su libro de movimientos.
*/
(() => {
  'use strict';

  const VERSION = '35.0-beta.8';
  if (window.HFTarjetasCanonicasBeta8?.version === VERSION) return;

  const state = {
    started:false,
    saving:false,
    editingId:'',
    modelWrapped:false,
    plannerTimer:null,
    duplicatePrompted:false
  };

  const $ = id => document.getElementById(id);
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((num(value) + Number.EPSILON) * 100) / 100;
  const money = value => `S/ ${num(value).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = (value='') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function cardName(card={}) {
    return String(card.nombre || card.banco || 'Tarjeta').trim();
  }

  function cardLimit(card={}) {
    return round(card.limite ?? card.lineaTotal ?? card.estadoCuenta?.lineaTotal ?? 0);
  }

  function cardLast4(card={}) {
    return String(card.ultimosDigitos || card.ultimos4 || '').replace(/\D/g,'').slice(-4);
  }

  function setEditingId(id='') {
    state.editingId = String(id || '');
    const modal = $('tarjetaModal');
    if (modal) modal.dataset.hfCanonicalEditingId = state.editingId;
  }

  function getEditingId() {
    return String($('tarjetaModal')?.dataset?.hfCanonicalEditingId || state.editingId || '');
  }

  function clearEditingId() {
    setEditingId('');
  }

  function statementScore(card={}) {
    const ec = card.estadoCuenta || {};
    let score = 0;
    if (num(ec.pagoMinimo) > 0 || num(card.pagoMinimo) > 0) score += 10;
    if (num(ec.pagoTotal) > 0 || num(ec.deudaFacturada) > 0) score += 6;
    if (ec.fechaVencimiento || card.fechaVencimiento) score += 6;
    if (ec.periodo || card.ultimoEstadoMes || card.periodoEstadoCuenta) score += 4;
    if (card.saldoConfirmadoEn || card.ultimaConciliacion) score += 3;
    if (Array.isArray(card.historialEstados) && card.historialEstados.length) score += 2;
    return score;
  }

  function metadataScore(card={}) {
    let score = 0;
    if (num(card.tea || card.tasaEfectivaAnual) > 0) score += 5;
    if (cardLast4(card)) score += 5;
    if (card.cierre || card.diaCierre) score += 3;
    if (card.vence || card.diaVencimiento) score += 3;
    return score;
  }

  function duplicateKey(card={}) {
    return [normalize(cardName(card)), String(card.quien || 'yo'), cardLimit(card).toFixed(2)].join('|');
  }

  function classifyDuplicateGroups(cards=[]) {
    const groups = new Map();
    (cards || []).forEach(card => {
      const key = duplicateKey(card);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    });

    const confident = [];
    const suspicious = [];
    for (const [key, items] of groups.entries()) {
      if (items.length < 2) continue;
      const last4s = [...new Set(items.map(cardLast4).filter(Boolean))];
      const hasStatement = items.some(item => statementScore(item) > 0);
      const hasMetadata = items.some(item => metadataScore(item) > 0);
      const eligible = last4s.length <= 1 && hasStatement && hasMetadata;
      const entry = { key, items:[...items] };
      (eligible ? confident : suspicious).push(entry);
    }
    return { confident, suspicious };
  }

  async function diagnosticar() {
    const cards = await window.DB?.getTarjetas?.() || [];
    const groups = classifyDuplicateGroups(cards);
    const rows = cards.map(card => ({
      id:card.id,
      tarjeta:cardName(card),
      deuda:round(card.deuda ?? card.saldo),
      linea:cardLimit(card),
      tea:round(card.tea || card.tasaEfectivaAnual),
      ultimos4:cardLast4(card),
      minimo:round(card.estadoCuenta?.pagoMinimo || card.pagoMinimo),
      vence:card.estadoCuenta?.fechaVencimiento || card.fechaVencimiento || '',
      cierre:card.cierre || card.diaCierre || '',
      scoreEstado:statementScore(card),
      scoreFicha:metadataScore(card)
    }));
    console.group(`Hogar Finanzas · Diagnóstico tarjetas ${VERSION}`);
    console.table(rows);
    console.log('Duplicados seguros para consolidar:', groups.confident.map(g => g.items.map(x => x.id)));
    console.log('Coincidencias no consolidadas automáticamente:', groups.suspicious.map(g => g.items.map(x => x.id)));
    console.groupEnd();
    return { version:VERSION, cards:rows, confidentDuplicates:groups.confident, suspiciousDuplicates:groups.suspicious };
  }

  function firstNonEmpty(items, getter) {
    for (const item of items) {
      const value = getter(item);
      if (value !== undefined && value !== null && value !== '' && value !== 0) return value;
    }
    return null;
  }

  async function copySubcollection(sourceRef, targetRef, name) {
    const snap = await sourceRef.collection(name).get();
    for (const doc of snap.docs) {
      const targetDoc = targetRef.collection(name).doc(doc.id);
      const targetSnap = await targetDoc.get();
      if (!targetSnap.exists) await targetDoc.set(doc.data());
      await doc.ref.delete();
    }
  }

  async function repointMovements(fromId, toId, canonicalName) {
    const root = db.collection('hogares').doc(DB.hogarId).collection('gastos');
    const snap = await root.where('tarjetaId','==',String(fromId)).get();
    for (const doc of snap.docs) {
      await doc.ref.update({
        tarjetaId:String(toId),
        tarjetaNombre:canonicalName,
        actualizadoEn:new Date().toISOString(),
        tarjetaConsolidadaBeta8:true
      });
    }
  }

  async function consolidateGroup(group) {
    const items = [...group.items];
    const canonical = [...items].sort((a,b) => {
      const statementDelta = statementScore(b) - statementScore(a);
      if (statementDelta) return statementDelta;
      return metadataScore(b) - metadataScore(a);
    })[0];
    const duplicates = items.filter(item => String(item.id) !== String(canonical.id));
    const ordered = [canonical, ...duplicates.sort((a,b) => metadataScore(b) - metadataScore(a))];
    const root = db.collection('hogares').doc(DB.hogarId).collection('tarjetas');
    const canonicalRef = root.doc(String(canonical.id));

    const tea = round(firstNonEmpty(ordered, item => num(item.tea || item.tasaEfectivaAnual)) || 0);
    const ultimos = firstNonEmpty(ordered, cardLast4) || '';
    const cierre = String(firstNonEmpty(ordered, item => item.cierre || item.diaCierre) || '');
    const vence = String(firstNonEmpty(ordered, item => item.vence || item.diaVencimiento) || '');
    const fechaCierre = String(canonical.fechaCierre || canonical.estadoCuenta?.fechaCierre || firstNonEmpty(ordered, item => item.fechaCierre || item.estadoCuenta?.fechaCierre) || '');
    const fechaVencimiento = String(canonical.fechaVencimiento || canonical.estadoCuenta?.fechaVencimiento || firstNonEmpty(ordered, item => item.fechaVencimiento || item.estadoCuenta?.fechaVencimiento) || '');

    const patch = {
      nombre:cardName(canonical),
      limite:cardLimit(canonical) || cardLimit(ordered.find(item => cardLimit(item) > 0) || {}),
      lineaTotal:cardLimit(canonical) || cardLimit(ordered.find(item => cardLimit(item) > 0) || {}),
      tea,
      tasaEfectivaAnual:tea,
      ultimosDigitos:ultimos,
      cierre,
      diaCierre:cierre,
      vence,
      diaVencimiento:vence,
      fechaCierre,
      fechaVencimiento,
      consolidadoBeta8:true,
      consolidadoDesde:duplicates.map(item => String(item.id)),
      actualizadoEn:new Date().toISOString()
    };

    await canonicalRef.set(patch, { merge:true });

    for (const duplicate of duplicates) {
      const duplicateRef = root.doc(String(duplicate.id));
      await repointMovements(duplicate.id, canonical.id, cardName(canonical));
      await copySubcollection(duplicateRef, canonicalRef, 'estadosCuenta');
      await copySubcollection(duplicateRef, canonicalRef, 'conciliaciones');
      await duplicateRef.delete();
    }
    return { canonicalId:canonical.id, removed:duplicates.map(item => item.id), name:cardName(canonical) };
  }

  async function consolidarDuplicados({ ask=false }={}) {
    const cards = await DB.getTarjetas();
    const { confident } = classifyDuplicateGroups(cards);
    if (!confident.length) {
      window.showToast?.('No hay duplicados seguros para consolidar.', 'info');
      return [];
    }

    const execute = async () => {
      const results = [];
      for (const group of confident) results.push(await consolidateGroup(group));
      await window.HFModeloFinanciero?.recalcularTodo?.({ persistir:true }).catch(() => null);
      await window.renderTodo?.();
      await window.HFDeudasFamiliares?.renderizar?.();
      window.dispatchEvent(new CustomEvent('hf:tarjetas-consolidadas-beta8', { detail:{ version:VERSION, results } }));
      window.showToast?.(`${results.length} grupo${results.length===1?'':'s'} de tarjetas duplicadas consolidado${results.length===1?'':'s'}.`, 'success');
      return results;
    };

    if (ask && typeof window.showConfirm === 'function') {
      return new Promise(resolve => {
        window.showConfirm({
          icon:'💳',
          title:'¿Unir tarjetas duplicadas?',
          msg:`Se detectaron ${confident.length} grupos creados por el conflicto de edición. Se conservará el registro con estado de cuenta y se copiarán TEA, últimos 4 dígitos y días habituales del otro registro.`,
          labelOk:'Unir duplicados',
          danger:false,
          onOk:async () => resolve(await execute())
        });
      });
    }
    return execute();
  }

  function canonicalCardData(current=null) {
    const name = String($('t-nombre')?.value || '').trim();
    if (!name) throw new Error('Escribe el nombre de la tarjeta.');
    const debt = Math.max(0, round($('t-deuda')?.value));
    const limit = Math.max(0, round($('t-limite')?.value));
    const closeDay = String($('t-cierre')?.value || '').trim();
    const dueDay = String($('t-vence')?.value || '').trim();
    const tea = Math.max(0, round($('t-tea')?.value));
    const last4 = String($('t-ultimos4')?.value || '').replace(/\D/g,'').slice(-4);
    const closeDateInput = String($('t-fecha-cierre')?.value || '').trim();
    const dueDateInput = String($('t-fecha-vencimiento')?.value || '').trim();
    const currentStatement = current?.estadoCuenta || null;
    const fechaCierre = closeDateInput || current?.fechaCierre || currentStatement?.fechaCierre || '';
    const fechaVencimiento = dueDateInput || current?.fechaVencimiento || currentStatement?.fechaVencimiento || '';
    const estadoCuenta = currentStatement ? {
      ...currentStatement,
      fechaCierre:fechaCierre || currentStatement.fechaCierre || '',
      fechaVencimiento:fechaVencimiento || currentStatement.fechaVencimiento || '',
      lineaTotal:limit || currentStatement.lineaTotal || 0
    } : null;

    return {
      nombre:name,
      deuda:debt,
      limite:limit,
      lineaTotal:limit,
      cierre:closeDay,
      diaCierre:closeDay,
      vence:dueDay,
      diaVencimiento:dueDay,
      fechaCierre,
      fechaVencimiento,
      quien:$('t-quien')?.value || current?.quien || 'yo',
      tea,
      tasaEfectivaAnual:tea,
      ultimosDigitos:last4,
      estadoCuenta,
      historialEstados:current?.historialEstados || [],
      actualizadoEn:new Date().toISOString(),
      fichaCanonicaBeta8:true
    };
  }

  async function saveCanonicalCard() {
    if (state.saving) return;
    const button = $('tarjeta-submit-btn');
    state.saving = true;
    if (button) { button.disabled = true; button.dataset.hfOldText = button.textContent || ''; button.textContent = 'Guardando…'; }
    try {
      const editingId = getEditingId();
      const cards = await DB.getTarjetas();
      const current = editingId ? cards.find(card => String(card.id) === String(editingId)) : null;
      if (editingId && !current) throw new Error('La tarjeta que intentas editar ya no existe. Recarga la página.');
      const data = canonicalCardData(current);

      if (editingId) {
        const ok = await DB.updateTarjeta(editingId, data);
        if (!ok) throw new Error('No se pudo actualizar la tarjeta.');
        window.showToast?.('Tarjeta actualizada sin crear duplicados.', 'success');
      } else {
        await DB.addTarjeta(data);
        window.showToast?.('Tarjeta guardada.', 'success');
      }

      window.closeModal?.('tarjetaModal');
      clearEditingId();
      await window.HFModeloFinanciero?.recalcularTodo?.({ persistir:true }).catch(() => null);
      await window.renderTodo?.();
      await window.HFDeudasFamiliares?.renderizar?.();
      window.dispatchEvent(new CustomEvent('hf:tarjeta-canonica-guardada', { detail:{ id:editingId || null, version:VERSION } }));
    } catch (error) {
      console.error('No se pudo guardar la tarjeta beta 8:', error);
      window.showToast?.(error?.message || 'No se pudo guardar la tarjeta.', 'warning');
    } finally {
      state.saving = false;
      if (button) { button.disabled = false; button.textContent = button.dataset.hfOldText || 'Guardar cambios'; }
    }
  }

  function installCardFormGuard() {
    document.addEventListener('click', event => {
      const card = event.target.closest?.('.hf-v24-debt-card[data-debt-type="card"]');
      const edit = event.target.closest?.('[data-menu-action="edit"]');
      if (card && edit) {
        setEditingId(card.dataset.debtId || '');
        return;
      }

      const newCard = event.target.closest?.('[data-final-action="card"], [data-coordinator-action="card"], [onclick*="abrirNuevaTarjeta"]');
      if (newCard) {
        clearEditingId();
        return;
      }

      const save = event.target.closest?.('#tarjeta-submit-btn');
      if (save) {
        event.preventDefault();
        event.stopImmediatePropagation();
        saveCanonicalCard();
      }
    }, true);
  }

  function wrapFinancialModel() {
    if (state.modelWrapped || !window.HFModeloFinanciero?.obtenerResumenGlobal) return false;
    const original = window.HFModeloFinanciero;
    const originalGlobal = original.obtenerResumenGlobal.bind(original);
    const wrappedGlobal = async (...args) => {
      const [summary, rawCards] = await Promise.all([originalGlobal(...args), DB.getTarjetas()]);
      const rawMap = new Map((rawCards || []).map(card => [String(card.id), card]));
      const cards = (summary?.tarjetas || []).map(item => {
        const raw = rawMap.get(String(item.tarjetaId || item.id)) || {};
        return {
          ...item,
          tea:round(raw.tea || raw.tasaEfectivaAnual || item.tea || item.tasaEfectivaAnual),
          tasaEfectivaAnual:round(raw.tasaEfectivaAnual || raw.tea || item.tasaEfectivaAnual || item.tea),
          ultimosDigitos:cardLast4(raw),
          cierre:raw.cierre || raw.diaCierre || '',
          diaCierre:raw.diaCierre || raw.cierre || '',
          vence:raw.vence || raw.diaVencimiento || '',
          diaVencimiento:raw.diaVencimiento || raw.vence || '',
          fechaCierre:raw.fechaCierre || raw.estadoCuenta?.fechaCierre || item.estadoCuenta?.fechaCierre || '',
          fechaVencimiento:raw.fechaVencimiento || raw.estadoCuenta?.fechaVencimiento || item.estadoCuenta?.fechaVencimiento || '',
          pagoMinimo:round(raw.estadoCuenta?.pagoMinimo || raw.pagoMinimo || item.pagoMinimo),
          tarjetaOriginal:raw
        };
      });
      return { ...summary, tarjetas:cards };
    };

    window.HFModeloFinanciero = Object.freeze({ ...original, obtenerResumenGlobal:wrappedGlobal });
    state.modelWrapped = true;
    return true;
  }

  async function syncPlannerFields() {
    const modal = $('hfCentroFinancieroModal');
    if (!modal?.classList.contains('open')) return;
    const cards = await DB.getTarjetas();
    const map = new Map(cards.map(card => [String(card.id), card]));
    const selected = map.get(String($('hf-finance-card')?.value || ''));
    if (selected) {
      if ($('hf-finance-tea')) $('hf-finance-tea').value = round(selected.tea || selected.tasaEfectivaAnual || 0);
      const minimum = round(selected.estadoCuenta?.pagoMinimo || selected.pagoMinimo || 0);
      if ($('hf-finance-payment') && minimum > 0) $('hf-finance-payment').value = minimum;
    }
    document.querySelectorAll('#hf-plan-cards .hf-plan-card-row').forEach(row => {
      const card = map.get(String(row.dataset.tarjetaId || ''));
      const input = row.querySelector('.hf-plan-card-tea');
      if (card && input) input.value = round(card.tea || card.tasaEfectivaAnual || 0);
    });
  }

  function schedulePlannerSync(delay=80) {
    clearTimeout(state.plannerTimer);
    state.plannerTimer = setTimeout(() => syncPlannerFields().catch(error => console.warn('No se pudo sincronizar el planificador beta 8:', error)), delay);
  }

  function timeValue(value) {
    if (!value) return 0;
    if (typeof value === 'string') return Date.parse(value) || 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (Number.isFinite(Number(value.seconds))) return Number(value.seconds) * 1000;
    return 0;
  }

  function dateLabel(value) {
    if (!value) return 'Sin fecha';
    const raw = typeof value === 'string' ? value : (typeof value.toDate === 'function' ? value.toDate().toISOString() : '');
    const date = new Date(String(raw).length === 10 ? `${raw}T12:00:00` : raw);
    return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
  }

  function ensureLedgerModal() {
    if ($('hfCardMovementsModal')) return $('hfCardMovementsModal');
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfCardMovementsModal" onclick="closeModalOutside(event,'hfCardMovementsModal')">
        <div class="modal-sheet hf-beta8-ledger-sheet" role="dialog" aria-modal="true">
          <button class="modal-close" type="button" onclick="closeModal('hfCardMovementsModal')" aria-label="Cerrar">✕</button>
          <div class="modal-handle"></div>
          <div class="modal-title" id="hf-beta8-ledger-title">Movimientos de la tarjeta</div>
          <div id="hf-beta8-ledger-summary" class="hf-beta8-ledger-summary"></div>
          <div class="hf-beta8-ledger-help">Las compras aumentan la deuda; los pagos y ajustes a favor la reducen.</div>
          <div id="hf-beta8-ledger-list" class="hf-beta8-ledger-list"><div class="empty-state">Cargando movimientos…</div></div>
        </div>
      </div>`);
    return $('hfCardMovementsModal');
  }

  async function abrirMovimientosTarjeta(id) {
    ensureLedgerModal();
    const cards = await DB.getTarjetas();
    const card = cards.find(item => String(item.id) === String(id));
    if (!card) return window.showToast?.('No se encontró la tarjeta.', 'warning');
    const [expenses, reconciliations] = await Promise.all([
      DB.getGastos(null),
      DB.getConciliacionesTarjeta?.(id) || []
    ]);
    const name = normalize(cardName(card));
    const movements = [];

    (expenses || []).forEach(item => {
      const byId = item.tarjetaId && String(item.tarjetaId) === String(id);
      const legacyByName = !item.tarjetaId && normalize(item.tarjetaNombre || '') === name;
      if (!byId && !legacyByName) return;
      const payment = item.tipoMovimiento === 'pagoTarjeta' || item.tipo === 'pago-tarjeta';
      if (!payment && item.medio !== 'tarjeta' && item.metodo !== 'credito' && item.tipo !== 'consumo-credito') return;
      const amount = Math.abs(num(item.monto));
      movements.push({
        type:payment ? 'payment' : 'purchase',
        delta:payment ? -amount : amount,
        amount,
        title:payment ? (item.nota || 'Pago de tarjeta') : (item.desc || 'Compra con tarjeta'),
        detail:payment ? 'Redujo la deuda' : `${item.cat || 'Compra'} · aumentó la deuda`,
        date:item.fecha || item.creadoEn || '',
        sort:timeValue(item.creadoEn) || timeValue(item.fecha),
        before:item.deudaAnterior,
        after:item.deudaPosterior
      });
    });

    (reconciliations || []).forEach(item => {
      const difference = round(item.diferencia || 0);
      movements.push({
        type:'reconciliation',
        delta:difference,
        amount:Math.abs(difference),
        title:'Conciliación con el banco',
        detail:Math.abs(difference) < 0.005 ? 'Saldo confirmado sin diferencia' : difference > 0 ? 'Aumentó la deuda registrada' : 'Redujo la deuda registrada',
        date:item.fecha || item.creadoEn || '',
        sort:timeValue(item.creadoEn) || timeValue(item.fecha),
        before:item.saldoAnterior,
        after:item.deudaCalculada
      });
    });

    movements.sort((a,b) => b.sort - a.sort || String(b.date).localeCompare(String(a.date)));
    const debt = round(card.deuda ?? card.saldo);
    const limit = cardLimit(card);
    const available = limit > 0 ? round(limit - debt) : null;
    const tea = round(card.tea || card.tasaEfectivaAnual || 0);
    const last4 = cardLast4(card);

    $('hf-beta8-ledger-title').textContent = `Movimientos · ${cardName(card)}`;
    $('hf-beta8-ledger-summary').innerHTML = `
      <div><span>Deuda actual</span><strong>${money(debt)}</strong></div>
      <div><span>Disponible</span><strong>${available === null ? 'No informado' : money(available)}</strong></div>
      <div><span>Tarjeta</span><strong>${last4 ? `•••• ${esc(last4)}` : 'Sin últimos 4'}</strong></div>
      <div><span>TEA</span><strong>${tea > 0 ? `${tea.toFixed(2)}%` : 'No informada'}</strong></div>`;

    const list = $('hf-beta8-ledger-list');
    if (!movements.length) {
      list.innerHTML = '<div class="empty-state">Todavía no hay compras, pagos ni conciliaciones vinculados a esta tarjeta.</div>';
    } else {
      list.innerHTML = movements.slice(0,100).map(item => {
        const zero = Math.abs(item.delta) < 0.005;
        const sign = zero ? '' : item.delta > 0 ? '+' : '−';
        const tone = zero ? 'neutral' : item.delta > 0 ? 'increase' : 'decrease';
        const balance = Number.isFinite(Number(item.after)) ? `<small>Saldo después: ${money(item.after)}</small>` : '';
        return `<article class="hf-beta8-ledger-row ${tone}">
          <div class="hf-beta8-ledger-icon">${item.type === 'purchase' ? '↑' : item.type === 'payment' ? '↓' : '↔'}</div>
          <div class="hf-beta8-ledger-copy"><strong>${esc(item.title)}</strong><span>${esc(dateLabel(item.date))} · ${esc(item.detail)}</span>${balance}</div>
          <b>${zero ? 'Sin cambio' : `${sign} ${money(item.amount)}`}</b>
        </article>`;
      }).join('');
    }
    window.openModal?.('hfCardMovementsModal');
  }

  function installCardClickLedger() {
    document.addEventListener('click', event => {
      const card = event.target.closest?.('.hf-v24-debt-card[data-debt-type="card"]');
      if (!card) return;
      if (event.target.closest('button,a,input,select,textarea,.hf-v24-menu,.hf-v24-actions,.hf-v24-details')) return;
      abrirMovimientosTarjeta(card.dataset.debtId);
    });
  }

  function installPlannerHooks() {
    document.addEventListener('change', event => {
      if (event.target?.id === 'hf-finance-card') schedulePlannerSync(0);
    });
    const observer = new MutationObserver(mutations => {
      const modal = $('hfCentroFinancieroModal');
      if (modal?.classList.contains('open')) schedulePlannerSync(80);
      const addedCards = mutations.some(m => [...m.addedNodes].some(node => node instanceof Element && (node.id === 'hf-plan-cards' || node.querySelector?.('#hf-plan-cards'))));
      if (addedCards) schedulePlannerSync(80);
    });
    observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  }

  async function maybeOfferDuplicateRepair() {
    if (state.duplicatePrompted || sessionStorage.getItem('hf-beta8-duplicate-prompted')) return;
    const cards = await DB.getTarjetas();
    const { confident } = classifyDuplicateGroups(cards);
    if (!confident.length) return;
    state.duplicatePrompted = true;
    sessionStorage.setItem('hf-beta8-duplicate-prompted','1');
    setTimeout(() => consolidarDuplicados({ ask:true }), 400);
  }

  function start() {
    if (state.started) return;
    state.started = true;
    ensureLedgerModal();
    installCardFormGuard();
    installCardClickLedger();
    installPlannerHooks();
    wrapFinancialModel();

    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      wrapFinancialModel();
      if (window.DB?.getTarjetas && window.HFDeudasRedesign24 && window.HFExperienciaFinanciera14) {
        clearInterval(timer);
        setTimeout(maybeOfferDuplicateRepair, 500);
      } else if (attempts >= 80) {
        clearInterval(timer);
        setTimeout(maybeOfferDuplicateRepair, 500);
      }
    }, 100);

    ['hf:tarjeta-canonica-guardada','hf:tarjetas-consolidadas-beta8','hf:estado-cuenta-confirmado','hf:deuda-actualizada']
      .forEach(name => window.addEventListener(name, () => schedulePlannerSync(120)));
  }

  window.HFTarjetasCanonicasBeta8 = Object.freeze({
    version:VERSION,
    diagnosticar,
    consolidarDuplicados,
    abrirMovimientosTarjeta,
    saveCanonicalCard,
    syncPlannerFields,
    classifyDuplicateGroups
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
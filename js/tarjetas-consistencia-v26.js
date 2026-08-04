(() => {
  'use strict';

  const VERSION = '26.0';
  if (window.HFTarjetasConsistencia26?.version === VERSION) return;

  const state = {
    observer: null,
    timer: null,
    migrationStarted: false,
    detailsBusy: false
  };

  const $ = id => document.getElementById(id);
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = value => Math.round((number(value) + Number.EPSILON) * 100) / 100;

  function firstValue(root, id) {
    const fields = [...root.querySelectorAll(`[id="${id}"]`)];
    const nonEmpty = fields.find(field => String(field.value ?? '').trim() !== '');
    return String((nonEmpty || fields[0])?.value ?? '');
  }

  function ownerOptions(root) {
    const selects = [...root.querySelectorAll('[id="t-quien"]')];
    return selects.find(select => select.options?.length)?.innerHTML || `
      <option value="yo">Christian</option>
      <option value="pareja">Sydney</option>
      <option value="ambos">Compartida</option>`;
  }

  function removeLegacyCardFields(sheet, canonical) {
    const directLegacy = sheet.querySelectorAll(
      ':scope > .input-row, ' +
      ':scope > .statement-initial-box, ' +
      ':scope > .hf-stage14-statement-note, ' +
      ':scope > .hf-v24-statement-note, ' +
      ':scope > .hf-stage14-card-extra, ' +
      ':scope > .hf-v24-card-finance-fields'
    );

    directLegacy.forEach(element => {
      if (canonical && canonical.contains(element)) return;
      element.remove();
    });
  }

  function cardProfileMarkup(options) {
    return `
      <div class="input-row">
        <label class="input-label" for="t-nombre">Banco / Nombre</label>
        <input type="text" class="input-field" id="t-nombre" placeholder="Ej.: Visa BCP">
      </div>

      <div class="input-row">
        <label class="input-label" for="t-quien">¿De quién es?</label>
        <select class="select-field" id="t-quien">${options}</select>
      </div>

      <div class="input-row input-row-two">
        <div>
          <label class="input-label" for="t-deuda">Deuda actual (S/)</label>
          <input type="number" min="0" step="0.01" inputmode="decimal" class="input-field" id="t-deuda" placeholder="0.00">
        </div>
        <div>
          <label class="input-label" for="t-limite">Límite de crédito (S/)</label>
          <input type="number" min="0" step="0.01" inputmode="decimal" class="input-field" id="t-limite" placeholder="0.00">
        </div>
      </div>

      <div class="input-row input-row-two hf-v26-card-identifiers">
        <div>
          <label class="input-label" for="t-tea">TEA anual (%)</label>
          <input type="number" min="0" step="0.01" inputmode="decimal" class="input-field" id="t-tea" placeholder="Ej.: 89.90">
          <small class="field-help">Es propia de esta tarjeta y se usa en los simuladores.</small>
        </div>
        <div>
          <label class="input-label" for="t-ultimos4">Últimos 4 dígitos</label>
          <input type="text" inputmode="numeric" maxlength="4" class="input-field" id="t-ultimos4" placeholder="1234">
          <small class="field-help">Solo identifica esta tarjeta; no se guarda el número completo.</small>
        </div>
      </div>

      <div class="input-row input-row-two">
        <div>
          <label class="input-label" for="t-cierre">Día habitual de cierre</label>
          <input type="number" min="1" max="31" inputmode="numeric" class="input-field" id="t-cierre" placeholder="25">
        </div>
        <div>
          <label class="input-label" for="t-vence">Día habitual de vencimiento</label>
          <input type="number" min="1" max="31" inputmode="numeric" class="input-field" id="t-vence" placeholder="5">
        </div>
      </div>

      <div class="hf-v26-profile-note">
        <strong>Ficha permanente de la tarjeta</strong>
        <span>Las fechas exactas, pagos mínimos, pagos totales y saldos confirmados cambian cada mes y se registran en “Estados de cuenta y evolución”.</span>
      </div>`;
  }

  function normalizeCardForm() {
    const modal = $('tarjetaModal');
    const sheet = modal?.querySelector('.modal-sheet');
    const submit = $('tarjeta-submit-btn');
    if (!modal || !sheet || !submit) return;

    modal.dataset.hfStage14Fields = 'true';
    modal.dataset.hfV24Fields = '24.0';

    let canonical = $('hf-v26-card-profile-form');
    if (!canonical) {
      const values = {
        nombre: firstValue(modal, 't-nombre'),
        quien: firstValue(modal, 't-quien'),
        deuda: firstValue(modal, 't-deuda'),
        limite: firstValue(modal, 't-limite'),
        tea: firstValue(modal, 't-tea'),
        ultimos4: firstValue(modal, 't-ultimos4'),
        cierre: firstValue(modal, 't-cierre'),
        vence: firstValue(modal, 't-vence')
      };
      const options = ownerOptions(modal);

      removeLegacyCardFields(sheet, null);

      canonical = document.createElement('div');
      canonical.id = 'hf-v26-card-profile-form';
      canonical.className = 'hf-v26-card-profile-form';
      canonical.innerHTML = cardProfileMarkup(options);
      submit.insertAdjacentElement('beforebegin', canonical);

      const assign = (id, value) => {
        const field = $(id);
        if (field && value !== '') field.value = value;
      };
      assign('t-nombre', values.nombre);
      assign('t-quien', values.quien || 'yo');
      assign('t-deuda', values.deuda);
      assign('t-limite', values.limite);
      assign('t-tea', values.tea);
      assign('t-ultimos4', values.ultimos4);
      assign('t-cierre', values.cierre);
      assign('t-vence', values.vence);
    }

    removeLegacyCardFields(sheet, canonical);

    const uniqueIds = ['t-nombre','t-quien','t-deuda','t-limite','t-tea','t-ultimos4','t-cierre','t-vence'];
    uniqueIds.forEach(id => {
      const fields = [...modal.querySelectorAll(`[id="${id}"]`)];
      fields.slice(1).forEach(field => field.closest('.input-row')?.remove());
    });

    modal.dataset.hfV26Profile = VERSION;
  }

  function replaceLabelText(label, text) {
    if (!label) return;
    [...label.childNodes].forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    });
    const input = label.querySelector('input, select, textarea');
    label.insertBefore(document.createTextNode(text), input || label.firstChild);
  }

  function normalizeStatementModal() {
    const modal = $('hfCardStatementModal');
    if (!modal) return;

    const labels = {
      'hf-st-month': 'Mes del estado',
      'hf-st-debt-pen': 'Saldo total confirmado por el banco (S/)',
      'hf-st-debt-usd': 'Saldo total confirmado por el banco (US$)',
      'hf-st-total-pen': 'Pago total del estado (S/)',
      'hf-st-total-usd': 'Pago total del estado (US$)',
      'hf-st-min-pen': 'Pago mínimo del estado (S/)',
      'hf-st-min-usd': 'Pago mínimo del estado (US$)',
      'hf-st-available': 'Línea disponible informada por el banco (S/)',
      'hf-st-close': 'Fecha de cierre del estado',
      'hf-st-due': 'Fecha de vencimiento del estado',
      'hf-st-note': 'Nota opcional'
    };

    Object.entries(labels).forEach(([id, text]) => {
      replaceLabelText($(id)?.closest('label'), text);
    });

    const form = modal.querySelector('.hf-statement-form');
    if (form && !modal.querySelector('.hf-v26-state-scope')) {
      const note = document.createElement('div');
      note.className = 'hf-v26-state-scope';
      note.innerHTML = '<strong>Registro mensual de una sola tarjeta</strong><span>Los valores y fechas deben copiarse del estado bancario del mes seleccionado. No son fechas estimadas ni datos permanentes de la tarjeta.</span>';
      form.insertAdjacentElement('beforebegin', note);
    }

    const adminNote = $('hf-st-admin-note');
    if (adminNote) {
      adminNote.textContent = 'Este estado se guarda únicamente para la tarjeta indicada y el mes seleccionado. Se utiliza en comparaciones mensuales y no modifica la TEA ni los días habituales.';
    }

    modal.dataset.hfV26State = VERSION;
  }

  function dateLabel(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'No registrada';
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function setDetailCell(cell, label, value) {
    if (!cell) return;
    const small = cell.querySelector('small');
    const strong = cell.querySelector('strong');
    if (small) small.textContent = label;
    if (strong) strong.textContent = value;
  }

  async function normalizeDebtDetails() {
    if (state.detailsBusy || !window.DB) return;
    const view = $('hf-family-debt-view');
    const cardList = view?.querySelectorAll('.hf-family-card-list')?.[0];
    if (!cardList) return;

    state.detailsBusy = true;
    try {
      const cards = await window.DB.getTarjetas?.() || [];
      const elements = [...cardList.querySelectorAll('.hf-v24-debt-card')];

      elements.forEach((element, index) => {
        const item = cards[index];
        if (!item) return;
        const cells = [...element.querySelectorAll('.hf-v24-details .hf-v24-detail-cell')];
        if (cells.length < 6) return;

        const statement = item.estadoCuenta || {};
        const closeFromStatement = statement.fechaCierre || '';
        const legacyClose = item.fechaCierre || '';
        const close = closeFromStatement || legacyClose;
        const closeLabel = closeFromStatement
          ? 'Cierre del último estado'
          : legacyClose
            ? 'Última fecha registrada'
            : 'Cierre del último estado';
        const dueDay = item.diaVencimiento || item.vence || '';
        const last4 = item.ultimosDigitos || item.ultimos4 || '';
        const teaRaw = item.tea ?? item.tasaEfectivaAnual;
        const tea = teaRaw !== null && teaRaw !== undefined && teaRaw !== '' && Number.isFinite(Number(teaRaw))
          ? `${Number(teaRaw).toFixed(2)}%`
          : 'No registrada';
        const period = statement.periodo || statement.mes || item.ultimoEstadoMes || 'No registrado';
        const total = Number(statement.pagoTotal);

        setDetailCell(cells[0], closeLabel, dateLabel(close));
        setDetailCell(cells[1], 'Día habitual de vencimiento', dueDay ? `Día ${dueDay}` : 'No registrado');
        setDetailCell(cells[2], 'Últimos 4 dígitos', last4 ? `•••• ${last4}` : 'No registrados');
        setDetailCell(cells[3], 'TEA anual', tea);
        setDetailCell(cells[4], 'Periodo del último estado', period);
        setDetailCell(cells[5], 'Pago total informado', Number.isFinite(total) && total > 0
          ? `S/ ${total.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : 'No informado');
      });
    } catch (error) {
      console.warn('No se pudieron normalizar los detalles de las tarjetas:', error);
    } finally {
      state.detailsBusy = false;
    }
  }

  async function normalizeCardAliases() {
    if (state.migrationStarted || !window.DB) return;
    state.migrationStarted = true;

    try {
      const cards = await window.DB.getTarjetas?.() || [];
      let changed = false;

      for (const card of cards) {
        const update = {};

        const teaRaw = card.tea ?? card.tasaEfectivaAnual;
        if (teaRaw !== null && teaRaw !== undefined && teaRaw !== '' && Number.isFinite(Number(teaRaw))) {
          const tea = round(teaRaw);
          if (Number(card.tea) !== tea) update.tea = tea;
          if (Number(card.tasaEfectivaAnual) !== tea) update.tasaEfectivaAnual = tea;
        }

        const last4 = String(card.ultimosDigitos || card.ultimos4 || '').replace(/\D/g, '').slice(-4);
        if (last4) {
          if (card.ultimosDigitos !== last4) update.ultimosDigitos = last4;
          if (card.ultimos4 !== last4) update.ultimos4 = last4;
        }

        const closeDay = String(card.cierre || card.diaCierre || '').trim();
        if (closeDay) {
          if (String(card.cierre || '') !== closeDay) update.cierre = closeDay;
          if (String(card.diaCierre || '') !== closeDay) update.diaCierre = closeDay;
        }

        const dueDay = String(card.vence || card.diaVencimiento || '').trim();
        if (dueDay) {
          if (String(card.vence || '') !== dueDay) update.vence = dueDay;
          if (String(card.diaVencimiento || '') !== dueDay) update.diaVencimiento = dueDay;
        }

        if (Object.keys(update).length) {
          update.actualizadoEn = new Date().toISOString();
          await window.DB.updateTarjeta(card.id, update);
          changed = true;
        }
      }

      if (changed) {
        await window.HFDeudasFamiliares?.renderizar?.();
      }
    } catch (error) {
      state.migrationStarted = false;
      console.warn('No se pudo normalizar el esquema de las tarjetas:', error);
    }
  }

  function repair() {
    normalizeCardForm();
    normalizeStatementModal();
    normalizeDebtDetails();
    normalizeCardAliases();
    document.body?.classList.add('hf-tarjetas-consistencia-v26');
  }

  function scheduleRepair() {
    clearTimeout(state.timer);
    state.timer = setTimeout(repair, 80);
  }

  function start() {
    repair();

    state.observer = new MutationObserver(scheduleRepair);
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });

    [
      'hf:deuda-actualizada',
      'hf:deudas-core-actualizadas',
      'hf:estado-cuenta-confirmado',
      'hf:deudas-recalculadas'
    ].forEach(eventName => window.addEventListener(eventName, scheduleRepair));
  }

  window.HFTarjetasConsistencia26 = Object.freeze({
    version: VERSION,
    repair,
    normalizeCardForm,
    normalizeStatementModal,
    normalizeDebtDetails
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

(() => {
  'use strict';

  const VERSION = '33.3';
  if (window.HFTarjetasConsistencia26?.version === VERSION) return;

  const state = {
    timer: null,
    migrationStarted: false,
    migrationFinished: false
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
    ['t-nombre','t-quien','t-deuda','t-limite','t-tea','t-ultimos4','t-cierre','t-vence'].forEach(id => {
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

    Object.entries(labels).forEach(([id, text]) => replaceLabelText($(id)?.closest('label'), text));

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

  async function normalizeCardAliases() {
    if (state.migrationStarted || state.migrationFinished || !window.DB?.getTarjetas) return;
    state.migrationStarted = true;

    try {
      const cards = await window.DB.getTarjetas();
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

      state.migrationFinished = true;
      if (changed) {
        await window.HFDeudasRedesign24?.renderDebtPage?.();
      }
    } catch (error) {
      console.warn('No se pudo normalizar el esquema de las tarjetas:', error);
    } finally {
      state.migrationStarted = false;
    }
  }

  function normalizeDebtDetails() {
    // V33 genera los detalles con los datos correctos durante el render principal.
    // Se conserva esta función solo para compatibilidad con módulos anteriores.
  }

  function repair() {
    normalizeCardForm();
    normalizeStatementModal();
    document.body?.classList.add('hf-tarjetas-consistencia-v26');
  }

  function scheduleRepair(delay = 0) {
    clearTimeout(state.timer);
    state.timer = setTimeout(repair, delay);
  }

  function start() {
    repair();
    normalizeCardAliases();

    ['hf:deuda-actualizada','hf:deudas-core-actualizadas','hf:estado-cuenta-confirmado','hf:deudas-recalculadas']
      .forEach(eventName => window.addEventListener(eventName, () => scheduleRepair(0)));

    document.addEventListener('click', event => {
      if (event.target.closest('[onclick*="abrirNuevaTarjeta"], [onclick*="abrirEditarTarjeta"], [data-final-action="card"], .hf-v24-menu-button, .hf-v24-history-action')) {
        scheduleRepair(0);
      }
    });
  }

  window.HFTarjetasConsistencia26 = Object.freeze({
    version: VERSION,
    repair,
    normalizeCardForm,
    normalizeStatementModal,
    normalizeDebtDetails,
    normalizeCardAliases
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

(() => {
  'use strict';

  if (window.HFDeudasRedesign23) return;

  const VERSION = '23.0';
  const state = {
    observer: null,
    timer: null,
    enhancing: false
  };

  const ICONS = {
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9"></path><path d="M10 19V5"></path><path d="M16 19v-7"></path><path d="M22 19H2"></path></svg>',
    calculator: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="3"></rect><path d="M8 6h8"></path><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4"></path></svg>',
    addCard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18"></path><path d="M12 13v4M10 15h4"></path></svg>',
    bank: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-6 9 6"></path><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>',
    coins: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="8" cy="7" rx="5" ry="3"></ellipse><path d="M3 7v4c0 1.7 2.2 3 5 3 .8 0 1.5-.1 2.2-.3"></path><path d="M3 11v4c0 1.7 2.2 3 5 3 .7 0 1.3-.1 1.9-.2"></path><ellipse cx="16" cy="14" rx="5" ry="3"></ellipse><path d="M11 14v4c0 1.7 2.2 3 5 3s5-1.3 5-3v-4"></path></svg>',
    layers: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 9 5-9 5-9-5Z"></path><path d="m3 12 9 5 9-5"></path><path d="m3 17 9 5 9-5"></path></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7h.01"></path></svg>'
  };

  function $(id) {
    return document.getElementById(id);
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function money(value) {
    return `S/ ${number(value).toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function dateShort(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'No informado';
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short'
    });
  }

  function closeAdminThen(callback) {
    if (typeof window.closeModal === 'function') window.closeModal('hfDebtAdminModal');
    else $('hfDebtAdminModal')?.classList.remove('open');
    setTimeout(() => callback?.(), 100);
  }

  function replaceActionContent(button, icon, title, subtitle) {
    if (!button) return;
    button.innerHTML = `<span class="hf-admin-action-icon">${icon}</span><div><strong>${title}</strong><small>${subtitle}</small></div><em>›</em>`;
  }

  function enhanceAdminModal() {
    const modal = $('hfDebtAdminModal');
    if (!modal) return;

    const heading = modal.querySelector('.hf-debt-admin-heading p');
    if (heading) heading.textContent = 'Registra obligaciones, consulta estados y organiza tus pagos.';

    modal.querySelector('[data-admin-action="actualizar"]')?.remove();
    modal.querySelector('[data-admin-action="cierre"]')?.remove();

    const actions = modal.querySelector('.hf-debt-admin-actions');
    if (!actions) return;

    let statements = actions.querySelector('[data-uiux-action="statements"]');
    if (!statements) {
      statements = document.createElement('button');
      statements.type = 'button';
      statements.className = 'hf-debt-admin-action hf-admin-featured-action';
      statements.dataset.uiuxAction = 'statements';
      replaceActionContent(
        statements,
        ICONS.chart,
        'Estados de cuenta y evolución',
        'Guarda saldos confirmados y revisa cómo cambia cada tarjeta.'
      );
      statements.addEventListener('click', () => {
        closeAdminThen(() => window.HFExperienciaFinanciera14?.abrirCentroEstados?.());
      });
      actions.prepend(statements);
    }

    const plan = actions.querySelector('[data-admin-action="plan"]');
    const card = actions.querySelector('[data-admin-action="tarjeta"]');
    const loan = actions.querySelector('[data-admin-action="prestamo"]');

    replaceActionContent(plan, ICONS.calculator, 'Calcular cómo pagar', 'Compara cuotas, plazo e intereses.');
    replaceActionContent(card, ICONS.addCard, 'Agregar tarjeta', 'Registra una nueva línea de crédito.');
    replaceActionContent(loan, ICONS.bank, 'Agregar préstamo', 'Registra saldo, cuota y vencimiento.');

    [statements, plan, card, loan].filter(Boolean).forEach(button => actions.appendChild(button));

    const separator = modal.querySelector('.hf-debt-admin-separator');
    if (separator) separator.textContent = 'Pagos rápidos';

    modal.dataset.hfRedesign = VERSION;
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
          <small class="field-help">Escribe el disponible que muestra el banco después del pago. La app usará la línea de crédito para confirmar la deuda real.</small>
        </div>`);
      input = $('pago-disponible-banco');
      modal.dataset.hfStage14Payment = 'true';
    }

    const row = input?.closest('.hf-payment-bank-balance, .input-row');
    const label = row?.querySelector('label');
    const help = row?.querySelector('.field-help, small');
    if (label) label.textContent = 'Línea disponible después del pago (opcional)';
    if (help) help.textContent = 'Escribe el disponible que muestra el banco después del pago. Con la línea de crédito, la app confirmará la deuda real.';
    if (input) input.placeholder = 'Ej.: 209.73';
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

  function createBrand(name, type) {
    const brand = document.createElement('div');
    brand.className = `hf-debt-brand hf-debt-brand-${bankTone(name)} ${type === 'loan' ? 'is-loan' : ''}`;
    brand.setAttribute('aria-hidden', 'true');
    brand.textContent = initials(name);
    return brand;
  }

  function createGlance(type, item) {
    const glance = document.createElement('div');
    glance.className = 'hf-debt-glance';

    if (type === 'card') {
      const due = item.fechaVencimiento || item.estadoCuenta?.fechaVencimiento || '';
      const minimum = item.estadoCuenta?.pagoMinimo ?? item.pagoMinimo;
      glance.innerHTML = `
        <div class="hf-debt-glance-item">
          <span>${ICONS.calendar}</span>
          <div><small>Vencimiento</small><strong>${dateShort(due)}</strong></div>
        </div>
        <div class="hf-debt-glance-item">
          <span>${ICONS.coins}</span>
          <div><small>Pago mínimo</small><strong>${number(minimum) > 0 ? money(minimum) : 'No informado'}</strong></div>
        </div>`;
    } else {
      const due = item.proximoVencimiento || item.fechaVencimiento || item.vencimiento || '';
      const remaining = item.cuotasRestantes ?? item.cuotasPendientes;
      glance.innerHTML = `
        <div class="hf-debt-glance-item">
          <span>${ICONS.calendar}</span>
          <div><small>Próximo vencimiento</small><strong>${dateShort(due)}</strong></div>
        </div>
        <div class="hf-debt-glance-item">
          <span>${ICONS.layers}</span>
          <div><small>Cuotas restantes</small><strong>${remaining ?? 'No informadas'}</strong></div>
        </div>`;
    }

    return glance;
  }

  function detailItem(label, value) {
    return `<div><small>${label}</small><strong>${value || 'No informado'}</strong></div>`;
  }

  function createMoreDetails(type, item, originalAdvice) {
    const details = document.createElement('div');
    details.className = 'hf-debt-more-details';

    if (type === 'card') {
      const closeDate = item.fechaCierre || item.estadoCuenta?.fechaCierre;
      const closeDay = item.cierre || item.diaCierre;
      const dueDay = item.vence || item.diaVencimiento;
      const last4 = item.ultimosDigitos || item.ultimos4;
      const tea = number(item.tea || item.tasaEfectivaAnual);
      details.innerHTML = `
        <div class="hf-debt-detail-grid">
          ${detailItem('Próximo cierre', closeDate ? dateShort(closeDate) : closeDay ? `Día ${closeDay}` : '')}
          ${detailItem('Día habitual de pago', dueDay ? `Día ${dueDay}` : '')}
          ${detailItem('Tarjeta', last4 ? `•••• ${last4}` : '')}
          ${detailItem('TEA', tea > 0 ? `${tea.toFixed(2)}%` : '')}
        </div>`;
    } else {
      const original = number(item.montoOriginal || item.montoInicial || item.total);
      const frequency = String(item.frecuencia || '').trim();
      const paid = item.pagadas ?? item.cuotasPagadas;
      const total = item.total ?? item.cuotasTotales;
      details.innerHTML = `
        <div class="hf-debt-detail-grid">
          ${detailItem('Monto original', original > 0 ? money(original) : '')}
          ${detailItem('Frecuencia', frequency ? frequency.charAt(0).toUpperCase() + frequency.slice(1) : '')}
          ${detailItem('Cuotas pagadas', paid ?? '')}
          ${detailItem('Total de cuotas', total ?? '')}
        </div>`;
    }

    if (originalAdvice) {
      details.insertAdjacentHTML('beforeend', `
        <div class="hf-debt-detail-note">${ICONS.info}<span>${originalAdvice}</span></div>`);
    }

    return details;
  }

  function restructureTitle(card, name, type) {
    const head = card.querySelector('.hf-family-card-head');
    if (!head || head.dataset.hfRedesign === VERSION) return;

    const nameBlock = head.querySelector(':scope > span:first-child');
    const status = head.querySelector('.hf-family-status');
    const title = nameBlock?.querySelector('strong');
    const subtitle = nameBlock?.querySelector('small');

    if (!nameBlock || !title) return;

    nameBlock.classList.add('hf-debt-name-block');
    const line = document.createElement('div');
    line.className = 'hf-debt-title-line';
    line.appendChild(title);
    if (status) line.appendChild(status);
    nameBlock.prepend(line);

    if (subtitle) {
      subtitle.textContent = type === 'card' ? 'Tarjeta de crédito' : 'Préstamo';
    }

    head.prepend(createBrand(name, type));
    head.dataset.hfRedesign = VERSION;
  }

  function enhanceDebtCard(card, type, item) {
    if (!card || !item) return;
    if (card.dataset.hfDebtRedesign === VERSION) return;

    const name = type === 'card'
      ? (item.nombre || item.banco || 'Tarjeta')
      : (item.nombre || item.entidad || item.banco || 'Préstamo');

    card.classList.add('hf-debt-card-premium');
    card.dataset.hfDebtRedesign = VERSION;
    restructureTitle(card, name, type);

    const labels = card.querySelector('.hf-family-credit-labels');
    if (labels && !card.querySelector('.hf-debt-glance')) {
      labels.insertAdjacentElement('afterend', createGlance(type, item));
    }

    const advice = card.querySelector('.hf-family-advice span')?.textContent?.trim() || '';
    const actions = card.querySelector('.hf-card-actions');
    if (actions && !card.querySelector('.hf-debt-more-details')) {
      actions.insertAdjacentElement('beforebegin', createMoreDetails(type, item, advice));
    }
  }

  async function enhanceDebtPage() {
    if (state.enhancing || !window.DB) return;
    const view = $('hf-family-debt-view');
    if (!view) return;

    const lists = view.querySelectorAll('.hf-family-card-list');
    if (lists.length < 2) return;

    state.enhancing = true;
    try {
      const [cards, loans] = await Promise.all([
        window.DB.getTarjetas?.().catch(() => []) || [],
        window.DB.getPrestamos?.().catch(() => []) || []
      ]);

      [...lists[0].querySelectorAll('.hf-family-card')].forEach((card, index) => {
        enhanceDebtCard(card, 'card', cards[index]);
      });
      [...lists[1].querySelectorAll('.hf-family-card')].forEach((card, index) => {
        enhanceDebtCard(card, 'loan', loans[index]);
      });
    } catch (error) {
      console.warn('No se pudo completar el rediseño de Deudas:', error);
    } finally {
      state.enhancing = false;
    }
  }

  function enhancePaymentRows() {
    document.querySelectorAll('#hf-admin-card-actions .hf-admin-card-row').forEach(row => {
      row.classList.add('hf-admin-payment-row');
      const button = row.querySelector('button');
      if (button) button.textContent = 'Pagar';
    });
  }

  function repair() {
    enhanceAdminModal();
    ensureAvailableBalanceField();
    enhancePaymentRows();
    enhanceDebtPage();
    document.body?.classList.add('hf-deudas-redesign-v23');
  }

  function scheduleRepair() {
    clearTimeout(state.timer);
    state.timer = setTimeout(repair, 100);
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

  window.HFDeudasRedesign23 = Object.freeze({
    version: VERSION,
    repair,
    enhanceAdminModal,
    ensureAvailableBalanceField,
    enhanceDebtPage
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

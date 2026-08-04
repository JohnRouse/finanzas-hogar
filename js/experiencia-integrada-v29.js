(() => {
  'use strict';

  const VERSION = '29.2';
  if (window.HFExperienciaIntegrada29?.version === VERSION) return;

  const state = {
    movements: [],
    config: {},
    byId: new Map(),
    loading: false,
    repairTimer: null,
    reloadTimer: null,
    observer: null
  };

  const originalEditMovement = window.abrirEditarGasto;
  const $ = id => document.getElementById(id);
  const normalize = (value = '') => String(value).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function displayedMonth() {
    const text = normalize($('month-display')?.textContent || '');
    const year = text.match(/20\d{2}/)?.[0];
    const index = MONTHS.findIndex(month => text.includes(month));
    if (year && index >= 0) return `${year}-${String(index + 1).padStart(2, '0')}`;
    return window.DB?.getMesActual?.() || new Date().toISOString().slice(0, 7);
  }

  function timestamp(item = {}) {
    const value = item.creadoEn;
    if (value?.toMillis) return value.toMillis();
    if (value?.toDate) return value.toDate().getTime();
    if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
    return Date.parse(value || item.fecha || '') || 0;
  }

  function sortMovements(list = []) {
    return [...list].sort((a, b) => {
      const dateOrder = String(b.fecha || '').localeCompare(String(a.fecha || ''));
      return dateOrder || timestamp(b) - timestamp(a);
    });
  }

  function syncLegacyCaches() {
    try {
      if (typeof gastosDelMesCache !== 'undefined') gastosDelMesCache = [...state.movements];
      if (typeof configCache !== 'undefined') configCache = state.config || {};
    } catch (error) {
      console.warn('No se pudo sincronizar la caché heredada de movimientos:', error);
    }
  }

  async function reload() {
    if (state.loading || !window.DB?.getGastos) return;
    state.loading = true;
    try {
      const [movements, config] = await Promise.all([
        window.DB.getGastos(displayedMonth()),
        window.DB.getConfig?.().catch(() => null)
      ]);
      state.movements = sortMovements(Array.isArray(movements) ? movements : []);
      state.config = config || state.config || {};
      state.byId = new Map(state.movements.map(item => [String(item.id), item]));
      syncLegacyCaches();
      patchRenderedMovements();
    } catch (error) {
      console.error('No se pudieron actualizar los movimientos para edición:', error);
    } finally {
      state.loading = false;
    }
  }

  function isCardPayment(item = {}) {
    return item.tipoMovimiento === 'pagoTarjeta' || /^pago\s+tarjeta:/i.test(item.desc || '');
  }

  function isLoanPayment(item = {}) {
    return item.tipoMovimiento === 'pagoPrestamo' || /^pago\s+prestamo:/i.test(normalize(item.desc || ''));
  }

  function classicIcon(item = {}) {
    if (isCardPayment(item)) return '💳';
    if (isLoanPayment(item)) return '🏦';

    const category = normalize(item.cat || item.categoria || 'otros');
    if (category.includes('aliment')) return '🛒';
    if (category.includes('servicio')) return '⚡';
    if (category.includes('entret') || category.includes('ocio')) return '🎬';
    if (category.includes('transport')) return '🚕';
    if (category.includes('salud') || category.includes('medic')) return '💊';
    if (category.includes('hogar') || category.includes('casa')) return '🏠';
    if (category.includes('educ')) return '🎓';
    if (category.includes('deuda')) return '💳';

    const stored = String(item.icono || '').trim();
    const paymentMethodIcons = new Set(['💳', '✈️', '💸', '💵', '📲', '💰']);
    if (stored && !stored.includes('<svg') && !paymentMethodIcons.has(stored)) return stored;
    return '📦';
  }

  function patchOneMovement(element) {
    const item = state.byId.get(String(element.dataset.movementId || ''));
    if (!item) return;

    const desiredIcon = classicIcon(item);
    const icon = element.querySelector('.hf-v28-movement-icon');
    if (icon) {
      const currentIcon = icon.textContent.trim();
      if (currentIcon !== desiredIcon || !icon.classList.contains('hf-v29-classic-category')) {
        icon.innerHTML = `<span class="hf-v29-classic-icon" aria-hidden="true">${desiredIcon}</span>`;
        icon.classList.add('hf-v29-classic-category');
      }
    }

    const amount = element.querySelector('.hf-v28-movement-amount strong');
    if (amount && amount.style.getPropertyValue('color') !== '#172033') {
      amount.style.setProperty('color', '#172033', 'important');
    }
    element.classList.add('hf-v29-movement');
  }

  function patchRenderedMovements(root = document) {
    root.querySelectorAll?.('.hf-v28-movement').forEach(patchOneMovement);
  }

  function patchDetailIcon(id) {
    const item = state.byId.get(String(id));
    const icon = $('hf-v27-detail-icon');
    if (!item || !icon) return;
    const desiredIcon = classicIcon(item);
    if (icon.textContent.trim() !== desiredIcon || !icon.classList.contains('hf-v29-classic-category')) {
      icon.innerHTML = `<span class="hf-v29-classic-detail-icon" aria-hidden="true">${desiredIcon}</span>`;
      icon.classList.add('hf-v29-classic-category');
    }
  }

  async function editMovement(id) {
    if (!id) return;
    let item = state.byId.get(String(id));
    if (!item) {
      await reload();
      item = state.byId.get(String(id));
    }
    if (!item) {
      window.showToast?.('No se pudo cargar el movimiento. Actualiza la página e inténtalo nuevamente.', 'error');
      return;
    }

    syncLegacyCaches();
    const editor = originalEditMovement || window.abrirEditarGasto;
    if (typeof editor !== 'function') {
      window.showToast?.('El formulario de edición no está disponible.', 'error');
      return;
    }
    await editor(String(id));
  }

  function handleCaptureClick(event) {
    const edit = event.target.closest('.hf-v28-movement [data-action="edit"]');
    if (!edit) return;
    const movement = edit.closest('.hf-v28-movement');
    if (!movement) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    editMovement(movement.dataset.movementId);
  }

  function handleBubbleClick(event) {
    const movement = event.target.closest('.hf-v28-movement');
    if (!movement || event.target.closest('.hf-v28-movement-menu-wrap')) return;
    setTimeout(() => patchDetailIcon(movement.dataset.movementId), 0);
  }

  function scheduleRepair() {
    clearTimeout(state.repairTimer);
    state.repairTimer = setTimeout(() => {
      patchRenderedMovements();
      syncLegacyCaches();
    }, 80);
  }

  function scheduleReload() {
    clearTimeout(state.reloadTimer);
    state.reloadTimer = setTimeout(reload, 130);
  }

  function start() {
    reload();
    document.addEventListener('click', handleCaptureClick, true);
    document.addEventListener('click', handleBubbleClick);

    const month = $('month-display');
    if (month) new MutationObserver(scheduleReload).observe(month, {
      childList: true,
      characterData: true,
      subtree: true
    });

    state.observer = new MutationObserver(mutations => {
      let needsRepair = false;
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches?.('.hf-v28-movement') || node.querySelector?.('.hf-v28-movement')) {
          needsRepair = true;
        }
      }));
      if (needsRepair) scheduleRepair();
    });
    state.observer.observe(document.body, { childList: true, subtree: true });

    ['hf:gastos-actualizados','hf:deuda-actualizada','hf:deudas-core-actualizadas']
      .forEach(name => window.addEventListener(name, scheduleReload));
  }

  window.HFExperienciaIntegrada29 = Object.freeze({
    version: VERSION,
    reload,
    editMovement,
    patchRenderedMovements,
    classicIcon,
    getMovements: () => [...state.movements]
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
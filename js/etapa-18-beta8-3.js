/* Hogar Finanzas — Etapa 18 V35.0-beta.8.3
   - Evita mostrar estados antiguos de tarjetas mientras se repinta Deudas.
   - Convierte las estrategias del planificador en opciones seleccionables.
   - Deja Estados de cuenta dedicado solo a estados/evolución; los movimientos viven en el libro de cada tarjeta.
*/
(() => {
  'use strict';

  const VERSION = '35.0-beta.8.3';
  if (window.HFEtapa18Beta83?.version === VERSION) return;

  const state = {
    started:false,
    debtWrapped:false,
    selectedStrategy:'',
    installTimer:null,
    planTimers:[]
  };

  const $ = id => document.getElementById(id);

  function strategyTitle(id='') {
    return ({
      avalancha:'Ahorrar más intereses',
      'bola-nieve':'Cerrar una tarjeta más rápido',
      hibrida:'Plan equilibrado'
    })[id] || 'Plan elegido';
  }

  function cleanStatementMovements() {
    const modal = $('hfCardStatementModal');
    if (!modal) return false;

    const movements = $('hf-st-movements');
    if (movements) {
      const previous = movements.previousElementSibling;
      if (previous?.classList.contains('hf-stage14-subtitle') && /movimientos\s+de\s+la\s+tarjeta/i.test(previous.textContent || '')) {
        previous.remove();
      }
      movements.remove();
    }

    // Compatibilidad por si el título quedó sin el contenedor en una renderización anterior.
    modal.querySelectorAll('.hf-stage14-subtitle').forEach(node => {
      if (/movimientos\s+de\s+la\s+tarjeta/i.test(node.textContent || '')) node.remove();
    });
    modal.dataset.hfBeta83HistoryOnly = 'true';
    return true;
  }

  function selectionNote() {
    const output = $('hf-plan-output');
    if (!output) return null;
    let note = $('hf-plan-selection-note');
    if (!note) {
      note = document.createElement('div');
      note.id = 'hf-plan-selection-note';
      note.className = 'hf-plan-selection-note';
      const list = output.querySelector('.hf-strategy-list');
      if (list) list.insertAdjacentElement('beforebegin', note);
      else output.appendChild(note);
    }
    return note;
  }

  function selectStrategy(item, emit=true) {
    if (!item) return false;
    const list = item.closest('.hf-strategy-list');
    if (!list) return false;

    list.querySelectorAll('.hf-strategy-item[data-hf-strategy]').forEach(node => {
      const selected = node === item;
      node.classList.toggle('selected', selected);
      node.setAttribute('aria-checked', String(selected));
      node.tabIndex = selected ? 0 : -1;
    });

    state.selectedStrategy = item.dataset.hfStrategy || '';
    const recommended = item.dataset.hfRecommended === 'true';
    const note = selectionNote();
    if (note) {
      note.innerHTML = `<span>Plan elegido</span><strong>${strategyTitle(state.selectedStrategy)}</strong>${recommended ? '<small>Es también la opción recomendada por menor costo estimado.</small>' : '<small>Elegiste esta alternativa aunque no sea la de menor interés estimado.</small>'}`;
    }

    if (emit) {
      window.dispatchEvent(new CustomEvent('hf:estrategia-plan-seleccionada', {
        detail:{ estrategia:state.selectedStrategy, titulo:strategyTitle(state.selectedStrategy), version:VERSION }
      }));
    }
    return true;
  }

  function decoratePlanStrategies() {
    const output = $('hf-plan-output');
    const list = output?.querySelector('.hf-strategy-list');
    if (!list) return false;

    const ids = ['avalancha','bola-nieve','hibrida'];
    const items = [...list.querySelectorAll('.hf-strategy-item')];
    if (!items.length) return false;

    items.forEach((item,index) => {
      const id = ids[index] || `estrategia-${index + 1}`;
      item.dataset.hfStrategy = id;
      item.dataset.hfRecommended = item.classList.contains('best') ? 'true' : 'false';
      item.setAttribute('role','radio');
      item.setAttribute('aria-label', `Elegir ${strategyTitle(id)}`);
      item.setAttribute('aria-checked','false');
      item.tabIndex = -1;
    });

    const preferred = items.find(item => item.dataset.hfStrategy === state.selectedStrategy)
      || items.find(item => item.dataset.hfRecommended === 'true')
      || items[0];
    selectStrategy(preferred, false);
    return true;
  }

  function schedulePlanDecorate() {
    state.planTimers.forEach(clearTimeout);
    state.planTimers = [0, 80, 240].map(delay => setTimeout(decoratePlanStrategies, delay));
  }

  function wrapDebtRenderer() {
    const current = window.HFDeudasRedesign24;
    if (!current || typeof current.renderDebtPage !== 'function') return false;
    if (current.__hfBeta83StableStatuses) {
      state.debtWrapped = true;
      return true;
    }

    // Esperamos a que beta 5 haya instalado el cálculo canónico de pagos. Así la
    // pantalla permanece oculta únicamente durante la misma pasada que ya refresca
    // los estados correctos, en lugar de añadir otra consulta.
    if (!current.__hfV35Beta5Wrapped) return false;

    const original = current.renderDebtPage.bind(current);
    const wrapped = async (...args) => {
      const root = $('hf-family-debt-view');
      root?.classList.add('hf-beta83-status-settling');
      try {
        const result = await original(...args);
        window.HFEtapa18Beta5?.patchDebtDOM?.();
        return result;
      } finally {
        // Reaplica el estado ya calculado antes de permitir que el badge vuelva a verse.
        window.HFEtapa18Beta5?.patchDebtDOM?.();
        requestAnimationFrame(() => root?.classList.remove('hf-beta83-status-settling'));
      }
    };

    window.HFDeudasRedesign24 = Object.freeze({
      ...current,
      __hfBeta83StableStatuses:true,
      renderDebtPage:wrapped
    });
    state.debtWrapped = true;
    return true;
  }

  function installInteractions() {
    document.addEventListener('click', event => {
      const strategy = event.target.closest?.('.hf-strategy-item[data-hf-strategy]');
      if (strategy) {
        event.preventDefault();
        selectStrategy(strategy, true);
        return;
      }

      if (event.target.closest?.('#hf-plan-run, [data-hf-finance-tab="plan"]')) {
        schedulePlanDecorate();
      }

      // Los modales pueden haberse creado justo después del click.
      if (event.target.closest?.('[data-coordinator-action="states"], [data-hf-stage14-statements], .hf-v24-history-action')) {
        setTimeout(cleanStatementMovements, 0);
        setTimeout(cleanStatementMovements, 120);
      }
    });

    document.addEventListener('keydown', event => {
      const strategy = event.target.closest?.('.hf-strategy-item[data-hf-strategy]');
      if (!strategy || !['Enter',' '].includes(event.key)) return;
      event.preventDefault();
      selectStrategy(strategy, true);
    });
  }

  function installWhenReady() {
    let attempts = 0;
    clearInterval(state.installTimer);
    state.installTimer = setInterval(() => {
      attempts += 1;
      cleanStatementMovements();
      decoratePlanStrategies();
      const wrapped = wrapDebtRenderer();
      if ((wrapped && window.HFExperienciaFinanciera14 && window.HFPanelPrediccionesFinancieras) || attempts >= 100) {
        clearInterval(state.installTimer);
        state.installTimer = null;
      }
    }, 100);
  }

  function getState() {
    return {
      version:VERSION,
      debtWrapped:state.debtWrapped,
      selectedStrategy:state.selectedStrategy || null,
      statementHistoryOnly:$('hfCardStatementModal')?.dataset?.hfBeta83HistoryOnly === 'true',
      selectableStrategies:document.querySelectorAll('.hf-strategy-item[data-hf-strategy]').length
    };
  }

  function start() {
    if (state.started) return;
    state.started = true;
    installInteractions();
    cleanStatementMovements();
    installWhenReady();
  }

  window.HFEtapa18Beta83 = Object.freeze({
    version:VERSION,
    wrapDebtRenderer,
    cleanStatementMovements,
    decoratePlanStrategies,
    selectStrategy,
    getState
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
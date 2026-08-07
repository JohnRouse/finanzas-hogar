/* Hogar Finanzas — acceso rápido a metas desde Resumen V35 */
(() => {
  'use strict';

  const VERSION = '35.0-beta.1';
  if (window.HFAhorroResumen35?.version === VERSION) return;

  const state = { goals:[], timer:null };
  const $ = id => document.getElementById(id);
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => `S/ ${number(value).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  function ensurePicker() {
    if ($('hfSavingPickerModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfSavingPickerModal" onclick="closeModalOutside(event,'hfSavingPickerModal')">
        <div class="modal-sheet hf-v35-saving-sheet" style="position:relative">
          <button class="modal-close" type="button" onclick="closeModal('hfSavingPickerModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="modal-title">¿Para qué meta quieres apartar?</div>
          <p class="hf-v35-picker-intro">Elige la meta que recibirá el dinero del disponible de este mes.</p>
          <div class="hf-v35-goal-picker" id="hf-v35-goal-picker"></div>
        </div>
      </div>`);
  }

  async function refreshGoals() {
    try { state.goals = await window.DB?.getMetas?.() || []; }
    catch (_) { state.goals = []; }
    decorateSummary();
  }

  function openPicker() {
    ensurePicker();
    const container = $('hf-v35-goal-picker');
    const active = state.goals.filter(goal => number(goal.objetivo) <= 0 || number(goal.actual) < number(goal.objetivo) - 0.01);
    if (!active.length) {
      container.innerHTML = '<div class="empty-state">Todas las metas registradas están completas.</div>';
    } else {
      container.innerHTML = active.map(goal => {
        const current = Math.max(0, number(goal.actual));
        const target = Math.max(0, number(goal.objetivo));
        const remaining = target > 0 ? Math.max(0, target - current) : 0;
        return `<button type="button" class="hf-v35-goal-picker-item" data-goal-id="${escapeHTML(goal.id)}">
          <span>${escapeHTML(goal.icono || '🎯')}</span>
          <div><strong>${escapeHTML(goal.nombre || 'Meta')}</strong><small>${money(current)} reservado${target > 0 ? ` · faltan ${money(remaining)}` : ''}</small></div>
          <b>›</b>
        </button>`;
      }).join('');
      container.querySelectorAll('[data-goal-id]').forEach(button => {
        button.addEventListener('click', () => {
          window.closeModal?.('hfSavingPickerModal');
          setTimeout(() => window.HFEstadosPagadosAhorroReal35?.openSavingTransfer?.(button.dataset.goalId, 'aporte'), 80);
        });
      });
    }
    window.openModal?.('hfSavingPickerModal');
  }

  function activateSummaryAction() {
    if (!state.goals.length) {
      window.openModal?.('metaModal');
      return;
    }
    const active = state.goals.filter(goal => number(goal.objetivo) <= 0 || number(goal.actual) < number(goal.objetivo) - 0.01);
    if (active.length === 1) {
      window.HFEstadosPagadosAhorroReal35?.openSavingTransfer?.(active[0].id, 'aporte');
      return;
    }
    openPicker();
  }

  function decorateSummary() {
    const row = document.querySelector('#presupuesto-list .hf-month-plan-row.saving');
    if (!row) return;
    let action = row.querySelector('.hf-v35-summary-saving-action');
    if (!action) {
      action = document.createElement('button');
      action.type = 'button';
      action.className = 'hf-v35-summary-saving-action';
      action.addEventListener('click', event => {
        event.preventDefault();
        activateSummaryAction();
      });
      row.appendChild(action);
    }
    const active = state.goals.filter(goal => number(goal.objetivo) <= 0 || number(goal.actual) < number(goal.objetivo) - 0.01);
    action.textContent = !state.goals.length ? 'Crear una meta' : active.length === 1 ? 'Apartar dinero' : active.length > 1 ? 'Elegir meta para apartar' : 'Metas completadas';
    action.disabled = state.goals.length > 0 && active.length === 0;
  }

  function schedule(delay = 120) {
    clearTimeout(state.timer);
    state.timer = setTimeout(refreshGoals, delay);
  }

  function start() {
    ensurePicker();
    schedule(350);
    ['hf:coherencia-financiera-actualizada','hf:ahorro-reservado-actualizado','hf:objetivo-financiero-guardado']
      .forEach(name => window.addEventListener(name, () => schedule(100)));
  }

  window.HFAhorroResumen35 = Object.freeze({ version:VERSION, refreshGoals, decorateSummary, openPicker });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
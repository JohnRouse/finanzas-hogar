/* Hogar Finanzas — Etapa 18 V35.0-beta.7
   - Eliminar una meta espera a Firebase y devuelve su saldo al disponible.
   - El Resumen oculta temporalmente valores financieros mientras se recalculan,
     evitando mostrar copias/montos de una versión anterior durante un render.
*/
(() => {
  'use strict';

  const VERSION = '35.0-beta.7';
  if (window.HFEtapa18Beta7?.version === VERSION) return;

  const state = {
    originalRenderTodo: null,
    installed: false,
    renderDepth: 0
  };

  const $ = id => document.getElementById(id);
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => `S/ ${num(value).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;

  function ensureStyle() {
    if ($('hf-beta7-finance-style')) return;
    const style = document.createElement('style');
    style.id = 'hf-beta7-finance-style';
    style.textContent = `
      html.hf-finance-settling #page-resumen .month-money-value,
      html.hf-finance-settling #page-resumen .month-money-help {
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
  }

  function setSettling(active) {
    document.documentElement.classList.toggle('hf-finance-settling', !!active);
  }

  function stabilizeCopy(context = null) {
    const availableNode = $('kpi-disponible');
    const creditNode = $('kpi-credito-mes');
    const savedNode = $('kpi-ahorro-real');

    const availableHelp = availableNode?.closest('.month-money-card')?.querySelector('.month-money-help');
    const creditHelp = creditNode?.closest('.month-money-card')?.querySelector('.month-money-help');
    const savedHelp = savedNode?.closest('.month-money-card')?.querySelector('.month-money-help');

    if (availableHelp) availableHelp.textContent = 'Ingresos menos gastos, pagos de deuda y dinero reservado en metas';
    if (creditHelp) creditHelp.textContent = 'Aumentan la deuda, pero no reducen el efectivo de inmediato';

    const reserved = context?.totalSaved ?? (() => {
      const raw = String(savedNode?.textContent || '').replace(/[^0-9.,-]/g, '').replace(/,/g, '');
      return Number(raw) || 0;
    })();
    if (savedHelp) savedHelp.textContent = reserved > 0
      ? 'Dinero que permanece apartado en tus metas'
      : 'Todavía no hay dinero reservado';
  }

  async function settleFinancialUI() {
    let context = null;
    try {
      context = await window.HFEtapa18Beta6?.refreshFinancialUI?.();
    } catch (error) {
      console.warn('No se pudo estabilizar el Resumen beta 7:', error);
    }
    stabilizeCopy(context);
    return context;
  }

  function wrapRenderTodo() {
    if (state.originalRenderTodo || typeof window.renderTodo !== 'function') return Boolean(state.originalRenderTodo);
    state.originalRenderTodo = window.renderTodo;

    window.renderTodo = async function renderTodoV35Beta7(...args) {
      state.renderDepth += 1;
      setSettling(true);
      try {
        return await state.originalRenderTodo.apply(this, args);
      } finally {
        try {
          await settleFinancialUI();
        } finally {
          state.renderDepth = Math.max(0, state.renderDepth - 1);
          if (state.renderDepth === 0) {
            requestAnimationFrame(() => setSettling(false));
          }
        }
      }
    };
    return true;
  }

  async function eliminarMetaBeta7(id) {
    const goals = await window.DB?.getMetas?.() || [];
    const goal = goals.find(item => String(item.id) === String(id));
    if (!goal) {
      window.showToast?.('La meta ya no existe.', 'warning');
      return;
    }

    const reserved = Math.max(0, num(goal.actual));
    const title = `¿Eliminar ${goal.nombre || 'esta meta'}?`;
    const msg = reserved > 0
      ? `Esta meta tiene ${money(reserved)} reservados. Al eliminarla, ese dinero dejará de estar reservado y volverá a Disponible hoy.`
      : 'Se eliminará esta meta de ahorro. No tiene dinero reservado.';

    const execute = async () => {
      try {
        setSettling(true);
        await DB.deleteMeta(id);
        await window.renderTodo?.();
        await window.HFAhorroResumen35?.refreshGoals?.();
        window.dispatchEvent(new CustomEvent('hf:ahorro-reservado-actualizado', {
          detail: { goalId:id, type:'meta-eliminada', released:reserved, version:VERSION }
        }));
        await settleFinancialUI();
        window.showToast?.(
          reserved > 0
            ? `Meta eliminada. ${money(reserved)} volvieron a Disponible hoy.`
            : 'Meta eliminada.',
          'success'
        );
      } catch (error) {
        console.error('No se pudo eliminar la meta beta 7:', error);
        window.showToast?.('No se pudo eliminar la meta.', 'warning');
      } finally {
        requestAnimationFrame(() => setSettling(false));
      }
    };

    if (typeof window.showConfirm === 'function') {
      window.showConfirm({
        icon:'🎯',
        title,
        msg,
        labelOk: reserved > 0 ? `Eliminar y liberar ${money(reserved)}` : 'Sí, eliminar',
        danger:true,
        onOk: execute
      });
    } else if (window.confirm(`${title}\n\n${msg}`)) {
      await execute();
    }
  }

  function installDeleteOverride() {
    window.eliminarMeta = eliminarMetaBeta7;
  }

  function start() {
    if (state.installed) return;
    state.installed = true;
    ensureStyle();
    wrapRenderTodo();
    installDeleteOverride();
    stabilizeCopy();

    ['hf:ahorro-reservado-actualizado', 'hf:objetivo-financiero-guardado']
      .forEach(name => window.addEventListener(name, () => {
        setTimeout(() => settleFinancialUI(), 80);
      }));
  }

  window.HFEtapa18Beta7 = Object.freeze({
    version:VERSION,
    settleFinancialUI,
    eliminarMeta:eliminarMetaBeta7,
    stabilizeCopy
  });

  // Se ejecuta inmediatamente porque app.js ya declaró renderTodo antes de este módulo.
  start();
})();
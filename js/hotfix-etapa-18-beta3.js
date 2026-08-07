/* Hogar Finanzas — Hotfix de estabilidad Etapa 18 V35.0-beta.3 */
(() => {
  'use strict';

  const VERSION = '35.0-beta.3';
  if (window.HFHotfixEtapa18Beta3?.version === VERSION) return;

  const state = {
    started:false,
    guardInstalled:false,
    attempts:0,
    lastRunAt:0,
    lastResult:null,
    inFlight:null
  };

  function installCoherenceGuard() {
    const current = window.HFCoherenciaFinanciera;
    if (!current || typeof current.actualizar !== 'function') return false;
    if (current.__hfV35Beta3Guarded) {
      state.guardInstalled = true;
      return true;
    }

    const originalUpdate = current.actualizar.bind(current);
    const originalState = current.obtenerEstado?.bind(current);
    const initialResult = originalState?.()?.resumen || null;
    if (initialResult) {
      state.lastResult = initialResult;
      state.lastRunAt = Date.now();
    }

    async function safeUpdate(...args) {
      if (state.inFlight) return state.inFlight;

      const now = Date.now();
      if (state.lastResult && now - state.lastRunAt < 300) {
        return state.lastResult;
      }

      state.inFlight = (async () => {
        try {
          const result = await originalUpdate(...args);
          if (result && typeof result === 'object') state.lastResult = result;
          else state.lastResult = originalState?.()?.resumen || state.lastResult;
          state.lastRunAt = Date.now();
          return result || state.lastResult;
        } finally {
          state.inFlight = null;
        }
      })();

      return state.inFlight;
    }

    window.HFCoherenciaFinanciera = Object.freeze({
      ...current,
      actualizar:safeUpdate,
      __hfV35Beta3Guarded:true
    });

    state.guardInstalled = true;
    console.info('✅ Guard de coherencia financiera V35 beta 3 activo');
    return true;
  }

  function startGuardPolling() {
    const timer = setInterval(() => {
      state.attempts += 1;
      if (installCoherenceGuard() || state.attempts >= 400) {
        clearInterval(timer);
      }
    }, 15);
  }

  function start() {
    if (state.started) return;
    state.started = true;
    startGuardPolling();
  }

  window.HFHotfixEtapa18Beta3 = Object.freeze({
    version:VERSION,
    installCoherenceGuard,
    getState:() => ({
      version:VERSION,
      started:state.started,
      guardInstalled:state.guardInstalled,
      attempts:state.attempts,
      lastRunAt:state.lastRunAt,
      hasCachedResult:Boolean(state.lastResult),
      inFlight:Boolean(state.inFlight)
    })
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

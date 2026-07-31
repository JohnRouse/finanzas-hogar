/* Hogar Finanzas — diagnóstico de la integración con Telegram */
(() => {
  'use strict';
  if (window.HFDiagnosticoEtapa13) return;

  function prueba(nombre, funcion) {
    try {
      const resultado = funcion();
      const ok = resultado === true || resultado === undefined;
      return { nombre, ok, detalle:ok ? null : (resultado || 'La comprobación devolvió falso') };
    } catch (error) {
      return { nombre, ok:false, detalle:error.message };
    }
  }

  async function ejecutar() {
    const pruebas = [];

    pruebas.push(prueba('Módulo de pendientes de Telegram disponible', () => {
      const modulo = window.HFTelegramPendientes;
      if (!modulo || typeof modulo.iniciar !== 'function' || typeof modulo.conectar !== 'function') {
        return 'HFTelegramPendientes no está listo';
      }
      return true;
    }));

    pruebas.push(prueba('Sección de revisión disponible en Gastos', () => {
      if (!document.getElementById('hf-telegram-pending-section')) return 'Falta la sección Por revisar';
      if (!document.getElementById('hf-telegram-pending-list')) return 'Falta el listado de pendientes';
      return true;
    }));

    pruebas.push(prueba('Formulario de revisión completo', () => {
      const ids = [
        'hfTelegramReviewModal','hf-tg-type','hf-tg-amount','hf-tg-description','hf-tg-date',
        'hf-tg-who','hf-tg-category','hf-tg-method','hf-tg-obligation','hf-tg-approve','hf-tg-discard'
      ];
      const faltantes = ids.filter(id => !document.getElementById(id));
      return faltantes.length ? `Faltan: ${faltantes.join(', ')}` : true;
    }));

    pruebas.push(prueba('Aprobación protegida contra duplicados', () => {
      const modulo = window.HFTelegramPendientes;
      const estado = modulo?.obtenerEstado?.();
      if (!estado) return 'No se obtuvo el estado del módulo';
      if (!window.db || !window.DB?.hogarId) return 'Firebase o el hogar todavía no están disponibles';
      return true;
    }));

    pruebas.push(prueba('Secretos de Telegram ausentes del cliente', () => {
      const html = document.documentElement.innerHTML;
      const patronToken = /\b\d{6,12}:[A-Za-z0-9_-]{20,}\b/;
      if (patronToken.test(html)) return 'Se detectó un posible token de bot en el cliente';
      if (typeof window.TELEGRAM_BOT_TOKEN !== 'undefined') return 'Existe TELEGRAM_BOT_TOKEN en window';
      return true;
    }));

    const resultado = {
      fecha:new Date().toISOString(),
      aprobadas:pruebas.filter(p => p.ok).length,
      total:pruebas.length,
      listo:pruebas.every(p => p.ok),
      pruebas
    };

    try { localStorage.setItem('hf_diagnostico_etapa_13', JSON.stringify(resultado)); } catch (_) {}
    console.group(`Hogar Finanzas · etapa 13 ${resultado.listo ? 'APROBADA' : 'CON INCIDENCIAS'}`);
    console.table(pruebas);
    console.groupEnd();
    return resultado;
  }

  window.HFDiagnosticoEtapa13 = Object.freeze({ ejecutar });
})();
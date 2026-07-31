/* Hogar Finanzas — Etapa 14.4: dashboard reactivo y coordinador de refrescos */
(() => {
  'use strict';

  if (window.HFModuloDashboard) return;

  const ESTADO = {
    temporizador: null,
    actualizando: false,
    pendiente: false,
    ultimaActualizacion: null,
    motivos: []
  };

  function registrarError(origen, error, contexto = {}) {
    if (window.HFEstabilidadApp?.registrarError) {
      window.HFEstabilidadApp.registrarError(`modulo-dashboard:${origen}`, error, contexto);
    } else {
      console.warn(`[modulo-dashboard:${origen}]`, error, contexto);
    }
  }

  function ejecutar(nombre, ...args) {
    const funcion = window[nombre];
    if (typeof funcion !== 'function') return { nombre, estado: 'no-disponible' };
    try {
      funcion(...args);
      return { nombre, estado: 'ejecutada' };
    } catch (error) {
      registrarError(nombre, error);
      return { nombre, estado: 'error', mensaje: error.message };
    }
  }

  async function actualizar(motivo = 'manual') {
    if (ESTADO.actualizando) {
      ESTADO.pendiente = true;
      ESTADO.motivos.push(motivo);
      return false;
    }

    ESTADO.actualizando = true;
    const inicio = Date.now();
    const resultados = [];

    try {
      resultados.push(ejecutar('actualizarDashboard'));
      resultados.push(ejecutar('renderResumen'));
      resultados.push(ejecutar('renderGastos'));
      resultados.push(ejecutar('renderDeudas'));
      resultados.push(ejecutar('renderAhorro'));
      resultados.push(ejecutar('actualizarCentroTarjetas', false));

      window.HFHistorialGastos?.actualizar?.();

      ESTADO.ultimaActualizacion = {
        motivo,
        fecha: new Date().toISOString(),
        duracionMs: Date.now() - inicio,
        resultados
      };

      window.dispatchEvent(new CustomEvent('hf:dashboard-actualizado', {
        detail: ESTADO.ultimaActualizacion
      }));
      return true;
    } catch (error) {
      registrarError('actualizar', error, { motivo });
      return false;
    } finally {
      ESTADO.actualizando = false;
      if (ESTADO.pendiente) {
        ESTADO.pendiente = false;
        const motivos = ESTADO.motivos.splice(0).join(', ') || 'pendiente';
        setTimeout(() => actualizar(motivos), 80);
      }
    }
  }

  function programar(motivo = 'evento', demora = 120) {
    clearTimeout(ESTADO.temporizador);
    ESTADO.motivos.push(motivo);
    ESTADO.temporizador = setTimeout(() => {
      const motivos = [...new Set(ESTADO.motivos.splice(0))].join(', ');
      actualizar(motivos || motivo);
    }, demora);
  }

  const EVENTOS = [
    'hf:gastos-actualizados',
    'hf:deudas-actualizadas',
    'hf:deuda-actualizada',
    'hf:deudas-recalculadas',
    'hf:estado-cuenta-confirmado',
    'hf:importacion-confirmada',
    'hf:sincronizacion-finalizada',
    'hf:mes-cambiado'
  ];

  EVENTOS.forEach(nombre => {
    window.addEventListener(nombre, () => programar(nombre));
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) programar('app-visible', 80);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => programar('inicio-dashboard', 250));
  } else {
    programar('inicio-dashboard', 250);
  }

  window.HFModuloDashboard = Object.freeze({
    actualizar,
    programar,
    obtenerEstado: () => ({
      actualizando: ESTADO.actualizando,
      pendiente: ESTADO.pendiente,
      ultimaActualizacion: ESTADO.ultimaActualizacion
    })
  });
})();
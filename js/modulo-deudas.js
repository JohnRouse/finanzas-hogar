/* Hogar Finanzas — Etapa 14.3: módulo de dominio para deudas */
(() => {
  'use strict';

  if (window.HFModuloDeudas) return;

  const ESTADO = {
    decoradas: new Set(),
    ultimaOperacion: null,
    instalado: false
  };

  const numero = valor => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : 0;
  };

  function registrarError(origen, error, contexto = {}) {
    if (window.HFEstabilidadApp?.registrarError) {
      window.HFEstabilidadApp.registrarError(`modulo-deudas:${origen}`, error, contexto);
    } else {
      console.warn(`[modulo-deudas:${origen}]`, error, contexto);
    }
  }

  function publicar(nombre, detalle = {}) {
    const payload = { fecha: new Date().toISOString(), ...detalle };
    window.dispatchEvent(new CustomEvent(nombre, { detail: payload }));
    return payload;
  }

  function obtenerResumenDOM() {
    return {
      deudaTotal: numero(document.getElementById('kpi-deuda-total')?.textContent?.replace(/[^0-9.-]/g, '')),
      compromisoMensual: numero(document.getElementById('kpi-pago-mensual')?.textContent?.replace(/[^0-9.-]/g, '')),
      tarjetas: document.querySelectorAll('#tarjetas-grid .debt-card, #tarjetas-grid .hf-card-status').length,
      prestamos: document.querySelectorAll('#prestamos-grid .debt-card').length
    };
  }

  function prepararOperacion(nombre, tipo, args) {
    const operacion = {
      nombre,
      tipo,
      args,
      inicio: new Date().toISOString(),
      resumenAntes: obtenerResumenDOM()
    };
    ESTADO.ultimaOperacion = operacion;
    publicar('hf:deuda-operacion-iniciada', operacion);
    return operacion;
  }

  function finalizarOperacion(operacion, resultado, error = null) {
    const detalle = {
      ...operacion,
      fin: new Date().toISOString(),
      resultado: resultado ?? null,
      error: error ? { nombre: error.name, mensaje: error.message } : null,
      resumenDespues: obtenerResumenDOM()
    };

    ESTADO.ultimaOperacion = detalle;
    publicar(error ? 'hf:deuda-operacion-fallida' : 'hf:deuda-operacion-completada', detalle);

    if (!error) {
      publicar('hf:deudas-actualizadas', {
        origen: operacion.nombre,
        tipo: operacion.tipo,
        resumen: detalle.resumenDespues
      });
      window.HFSincronizacionFinancieraUI?.refrescarVistas?.(true);
      window.HFIntegracionFinancieraTotal?.programar?.('deuda-actualizada', detalle, true);
    }

    return resultado;
  }

  function decorar(nombre, tipo) {
    if (ESTADO.decoradas.has(nombre)) return true;
    const original = window[nombre];
    if (typeof original !== 'function') return false;

    window[nombre] = async function funcionDeudaDecorada(...args) {
      const operacion = prepararOperacion(nombre, tipo, args);
      try {
        const resultado = await original.apply(this, args);
        return finalizarOperacion(operacion, resultado);
      } catch (error) {
        registrarError(nombre, error, { tipo, args });
        finalizarOperacion(operacion, null, error);
        throw error;
      }
    };

    ESTADO.decoradas.add(nombre);
    return true;
  }

  function instalarDecoradores() {
    const mapa = {
      agregarTarjeta: 'tarjeta-creada',
      guardarEstadoCuenta: 'estado-cuenta-actualizado',
      guardarAjusteTarjeta: 'tarjeta-conciliada',
      registrarPagoTarjeta: 'pago-tarjeta',
      agregarPrestamo: 'prestamo-creado',
      registrarPagoPrestamo: 'pago-prestamo',
      eliminarTarjeta: 'tarjeta-eliminada',
      eliminarPrestamo: 'prestamo-eliminado'
    };

    const resultados = {};
    Object.entries(mapa).forEach(([nombre, tipo]) => {
      resultados[nombre] = decorar(nombre, tipo);
    });

    ESTADO.instalado = Object.values(resultados).some(Boolean);
    publicar('hf:modulo-deudas-listo', { resultados });
    return resultados;
  }

  function observarFunciones() {
    let intentos = 0;
    const intervalo = setInterval(() => {
      intentos += 1;
      const resultados = instalarDecoradores();
      const encontradas = Object.values(resultados).filter(Boolean).length;
      if (encontradas >= 4 || intentos >= 24) clearInterval(intervalo);
    }, 250);
  }

  window.addEventListener('hf:deuda-actualizada', event => {
    publicar('hf:deudas-actualizadas', {
      origen: 'motor-conciliacion',
      tarjetaId: event.detail?.tarjetaId || event.detail?.resumen?.tarjetaId || null,
      resumen: event.detail?.resumen || null
    });
  });

  window.addEventListener('hf:estado-cuenta-confirmado', event => {
    publicar('hf:deudas-actualizadas', {
      origen: 'estado-cuenta-confirmado',
      tarjetaId: event.detail?.tarjetaId || null
    });
  });

  observarFunciones();

  window.HFModuloDeudas = Object.freeze({
    instalarDecoradores,
    obtenerResumenDOM,
    obtenerEstado: () => ({
      instalado: ESTADO.instalado,
      decoradas: [...ESTADO.decoradas],
      ultimaOperacion: ESTADO.ultimaOperacion
    })
  });
})();
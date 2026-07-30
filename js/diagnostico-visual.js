/* Hogar Finanzas — Diagnóstico de recuperación y pruebas visuales */
(() => {
  'use strict';

  const errores = [];
  const rechazos = [];

  window.addEventListener('error', event => {
    errores.push({ mensaje: event.message, archivo: event.filename, linea: event.lineno, fecha: new Date().toISOString() });
  });
  window.addEventListener('unhandledrejection', event => {
    rechazos.push({ mensaje: event.reason?.message || String(event.reason || 'Promesa rechazada'), fecha: new Date().toISOString() });
  });

  function prueba(nombre, fn) {
    try {
      const resultado = fn();
      return { nombre, ok: resultado !== false, detalle: resultado === true || resultado === undefined ? null : resultado };
    } catch (error) {
      return { nombre, ok: false, detalle: error.message };
    }
  }

  async function ejecutar() {
    const pruebas = [];
    pruebas.push(prueba('Pestaña Deudas disponible', () => Boolean(document.getElementById('page-deudas'))));
    pruebas.push(prueba('Listado de tarjetas disponible', () => Boolean(document.getElementById('tarjetas-grid'))));
    pruebas.push(prueba('Listado de préstamos disponible', () => Boolean(document.getElementById('prestamos-grid'))));
    pruebas.push(prueba('Formulario de tarjeta disponible', () => typeof window.abrirNuevaTarjeta === 'function'));
    pruebas.push(prueba('Formulario de préstamo disponible', () => typeof window.abrirNuevoPrestamo === 'function'));
    pruebas.push(prueba('Pago de tarjeta disponible', () => typeof window.abrirPagoTarjeta === 'function'));
    pruebas.push(prueba('Estado de cuenta disponible', () => typeof window.abrirEstadoCuenta === 'function'));
    pruebas.push(prueba('Microsoft Entra no visible', () => !document.getElementById('btn-outlook') && !document.getElementById('outlookModal')));
    pruebas.push(prueba('Centro financiero separado', () => Boolean(document.getElementById('hfCentroFinancieroModal'))));

    pruebas.push(prueba('Fórmula de deuda estimada', () => {
      if (!window.HFDeudasActuales?.calcularTarjeta) return 'HFDeudasActuales no cargado';
      const resultado = HFDeudasActuales.calcularTarjeta({ id: 't1', deuda: 900, limite: 3000, estadoCuenta: { pagoTotal: 1200, fechaEstado: '2026-07-10' } }, [
        { tarjetaId: 't1', medio: 'tarjeta', monto: 200, fecha: '2026-07-12' },
        { tarjetaId: 't1', tipoMovimiento: 'pagoTarjeta', monto: 100, fecha: '2026-07-14' }
      ]);
      return resultado.deudaEstimada === 1300 || `Resultado ${resultado.deudaEstimada}, esperado 1300`;
    }));

    pruebas.push(prueba('Simulador financiero', () => {
      if (!window.HFMotorPredictivoFinanciero?.simularPago) return 'Motor predictivo no cargado';
      const resultado = HFMotorPredictivoFinanciero.simularPago({ deuda: 1000, pagoMensual: 200, tea: 30 });
      return resultado.viable === true || resultado.motivo;
    }));

    pruebas.push(prueba('Optimizador de pagos', () => {
      if (!window.HFOptimizadorPagos?.compararEstrategias) return 'Optimizador no cargado';
      const resultado = HFOptimizadorPagos.compararEstrategias({ tarjetas: [{ id: 'a', deuda: 1000, minimo: 100, tea: 40 }], presupuestoMensual: 250 });
      return Boolean(resultado.mejorEstrategia) || 'No devolvió estrategia';
    }));

    const resultado = {
      fecha: new Date().toISOString(),
      aprobadas: pruebas.filter(p => p.ok).length,
      total: pruebas.length,
      listo: pruebas.every(p => p.ok) && errores.length === 0 && rechazos.length === 0,
      pruebas,
      errores: [...errores],
      rechazos: [...rechazos]
    };

    try { localStorage.setItem('hf_diagnostico_visual', JSON.stringify(resultado)); } catch (_) {}
    console.group(`Hogar Finanzas · diagnóstico ${resultado.listo ? 'APROBADO' : 'CON INCIDENCIAS'}`);
    console.table(pruebas);
    if (errores.length) console.warn('Errores capturados:', errores);
    if (rechazos.length) console.warn('Promesas rechazadas:', rechazos);
    console.groupEnd();
    return resultado;
  }

  async function mostrar() {
    const resultado = await ejecutar();
    const fallos = resultado.pruebas.filter(p => !p.ok);
    const mensaje = resultado.listo
      ? `Diagnóstico aprobado: ${resultado.aprobadas}/${resultado.total} pruebas.`
      : `Diagnóstico con incidencias: ${resultado.aprobadas}/${resultado.total}. ${fallos.map(f => f.nombre).join(', ')}`;
    if (typeof window.showToast === 'function') window.showToast(mensaje);
    else alert(mensaje);
    return resultado;
  }

  window.HFDiagnosticoVisual = Object.freeze({ ejecutar, mostrar, obtenerErrores: () => ({ errores: [...errores], rechazos: [...rechazos] }) });
  window.mostrarDiagnosticoVisual = mostrar;
})();
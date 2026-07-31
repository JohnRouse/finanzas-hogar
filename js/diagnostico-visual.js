/* Hogar Finanzas — Diagnóstico de recuperación y pruebas visuales */
(() => {
  'use strict';

  const errores = [];
  const rechazos = [];

  window.addEventListener('error', event => {
    errores.push({ mensaje:event.message || 'Error de recurso o script', archivo:event.filename || '', linea:event.lineno || null, fecha:new Date().toISOString() });
  });
  window.addEventListener('unhandledrejection', event => {
    rechazos.push({ mensaje:event.reason?.message || String(event.reason || 'Promesa rechazada'), fecha:new Date().toISOString() });
  });

  function prueba(nombre, fn) {
    try {
      const resultado = fn();
      const ok = resultado === true || resultado === undefined;
      return { nombre, ok, detalle:ok ? null : (resultado || 'La comprobación devolvió falso') };
    } catch (error) {
      return { nombre, ok:false, detalle:error.message };
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
    pruebas.push(prueba('Actualización conjunta disponible', () => typeof window.abrirActualizacionTarjetas === 'function' && Boolean(document.getElementById('hfActualizarSaldosModal'))));
    pruebas.push(prueba('Sin actualización duplicada', () => !document.querySelector('#page-deudas [data-hf-update-all]') && !document.querySelector('#page-deudas .debt-action-statement')));
    pruebas.push(prueba('Menú global de movimientos', () => typeof window.toggleExpenseMenu === 'function' && Boolean(document.getElementById('hfExpenseMenuPortal'))));
    pruebas.push(prueba('Pila de modales sin parpadeo', () => typeof window.HFModalStack?.aplicarPila === 'function' && typeof window.HFModalStack?.prepararApertura === 'function' && Boolean(document.getElementById('hf-modal-stack-styles'))));
    pruebas.push(prueba('Escáner de voucher retirado', () => !document.getElementById('voucher-toggle') && !document.getElementById('voucher-panel') && !document.getElementById('voucher-input')));
    pruebas.push(prueba('Formulario de gasto íntegro', () => {
      const requeridos = ['gastoModal','gasto-modal-title','gasto-submit-btn','g-desc','g-monto','g-fecha','g-quien','g-medio','cat-chips'];
      const faltantes = requeridos.filter(id => !document.getElementById(id));
      return faltantes.length === 0 ? true : `Faltan: ${faltantes.join(', ')}`;
    }));
    pruebas.push(prueba('Modales FAB unificados', () => Boolean(document.querySelector('#gastoChoiceModal .hf-app-sheet')) && Boolean(document.querySelector('#deudaChoiceModal .hf-app-sheet')) && Boolean(document.querySelector('#hfIngresoChoiceModal .hf-app-sheet'))));
    pruebas.push(prueba('Microsoft Entra no visible', () => !document.getElementById('btn-outlook') && !document.getElementById('outlookModal')));
    pruebas.push(prueba('Planificador separado', () => Boolean(document.getElementById('hfCentroFinancieroModal'))));

    pruebas.push(prueba('Fórmula de deuda estimada', () => {
      if (!window.HFDeudasActuales?.calcularTarjeta) return 'HFDeudasActuales no cargado';
      const resultado = HFDeudasActuales.calcularTarjeta({ id:'t1', deuda:900, limite:3000, estadoCuenta:{ pagoTotal:1200, fechaEstado:'2026-07-10' } }, [
        { tarjetaId:'t1', medio:'tarjeta', monto:200, fecha:'2026-07-12' },
        { tarjetaId:'t1', tipoMovimiento:'pagoTarjeta', monto:100, fecha:'2026-07-14' }
      ]);
      return resultado.deudaEstimada === 1300 ? true : `Resultado ${resultado.deudaEstimada}, esperado 1300`;
    }));

    pruebas.push(prueba('Saldo confirmado prevalece sobre estado antiguo', () => {
      if (!window.HFDeudasActuales?.calcularTarjeta) return 'HFDeudasActuales no cargado';
      const resultado = HFDeudasActuales.calcularTarjeta({ id:'t2', deuda:500, saldoConfirmadoEn:'2026-07-30T20:00:00Z', estadoCuenta:{ pagoTotal:900, fechaEstado:'2026-07-10', actualizadoEn:'2026-07-10T12:00:00Z' } }, []);
      return resultado.deudaEstimada === 500 && resultado.fuente === 'saldo-confirmado' ? true : `Resultado ${resultado.deudaEstimada}, fuente ${resultado.fuente}`;
    }));

    pruebas.push(prueba('Simulador financiero', () => {
      if (!window.HFMotorPredictivoFinanciero?.simularPago) return 'Motor predictivo no cargado';
      const resultado = HFMotorPredictivoFinanciero.simularPago({ deuda:1000, pagoMensual:200, tea:30 });
      return resultado.viable === true ? true : `Simulación no viable: ${resultado.motivo || 'sin motivo'}`;
    }));

    pruebas.push(prueba('Optimizador de pagos', () => {
      if (!window.HFOptimizadorPagos?.compararEstrategias) return 'Optimizador no cargado';
      const resultado = HFOptimizadorPagos.compararEstrategias({ tarjetas:[{ id:'a', deuda:1000, minimo:100, tea:40 }], presupuestoMensual:250 });
      return resultado.mejorEstrategia ? true : 'No devolvió estrategia';
    }));

    const resultado = {
      fecha:new Date().toISOString(),
      aprobadas:pruebas.filter(p => p.ok).length,
      total:pruebas.length,
      listo:pruebas.every(p => p.ok) && errores.length === 0 && rechazos.length === 0,
      pruebas,
      errores:[...errores],
      rechazos:[...rechazos]
    };

    try { localStorage.setItem('hf_diagnostico_visual', JSON.stringify(resultado)); } catch (_) {}
    console.group(`Hogar Finanzas · diagnóstico ${resultado.listo ? 'APROBADO' : 'CON INCIDENCIAS'}`);
    console.table(pruebas);
    if (errores.length) console.warn('Errores capturados:', errores);
    if (rechazos.length) console.warn('Promesas rechazadas:', rechazos);
    console.groupEnd();
    return resultado;
  }

  function limpiarCapturas() {
    errores.length = 0;
    rechazos.length = 0;
    return true;
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

  window.HFDiagnosticoVisual = Object.freeze({ ejecutar, mostrar, limpiarCapturas, obtenerErrores:() => ({ errores:[...errores], rechazos:[...rechazos] }) });
  window.mostrarDiagnosticoVisual = mostrar;
})();
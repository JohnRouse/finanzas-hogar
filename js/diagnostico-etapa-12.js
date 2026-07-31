/* Hogar Finanzas — diagnóstico específico de la etapa 12 */
(() => {
  'use strict';
  if (window.HFDiagnosticoEtapa12) return;

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
    pruebas.push(prueba('Módulo de cierre mensual disponible', () => {
      const modulo = window.HFCierreFinancieroMensual;
      return modulo && typeof modulo.abrir === 'function' && typeof modulo.calcularResumen === 'function'
        ? true : 'HFCierreFinancieroMensual no está listo';
    }));

    pruebas.push(prueba('Entrada y modal de cierre disponibles', () => {
      const estado = window.HFCierreFinancieroMensual?.obtenerEstado?.();
      if (!estado) return 'No se obtuvo el estado del módulo';
      if (!estado.lanzadorDisponible) return 'Falta la tarjeta de cierre en Deudas';
      if (!estado.modalDisponible) return 'Falta el modal del cierre';
      return true;
    }));

    pruebas.push(prueba('Cálculo del cierre mensual', () => {
      const resultado = window.HFCierreFinancieroMensual?.calcularResumen?.({
        tarjetas:[{ id:'t1', nombre:'Tarjeta', deudaConfirmada:1000, pagoMinimo:100, fechaVencimiento:'2026-08-05' }],
        prestamos:[{ id:'p1', nombre:'Préstamo', saldoPendiente:500, cuota:50, fechaVencimiento:'2026-08-10' }],
        gastos:[
          { medio:'tarjeta', monto:200, tipoMovimiento:'compra', fecha:'2026-07-20' },
          { tipoMovimiento:'pagoTarjeta', monto:100, fecha:'2026-07-22' },
          { tipoMovimiento:'pagoPrestamo', monto:50, fecha:'2026-07-24' }
        ],
        hoy:new Date('2026-07-31T12:00:00')
      });
      if (!resultado) return 'No se obtuvo un resumen';
      if (resultado.totales.deudaTotal !== 1500) return `Deuda total ${resultado.totales.deudaTotal}, esperado 1500`;
      if (resultado.totales.compromisosMes !== 150) return `Compromisos ${resultado.totales.compromisosMes}, esperado 150`;
      if (resultado.totales.comprasCreditoMes !== 200) return `Compras ${resultado.totales.comprasCreditoMes}, esperado 200`;
      if (resultado.totales.pagosDeudaMes !== 150) return `Pagos ${resultado.totales.pagosDeudaMes}, esperado 150`;
      return true;
    }));

    pruebas.push(prueba('Protección de cierres históricos', () => {
      const actual = window.DB?.getMesActual?.();
      if (!actual) return 'No se pudo resolver el mes actual';
      const [anio, mes] = actual.split('-').map(Number);
      const anteriorFecha = new Date(anio, mes - 2, 1);
      const anterior = `${anteriorFecha.getFullYear()}-${String(anteriorFecha.getMonth() + 1).padStart(2, '0')}`;
      if (!window.HFCierreFinancieroMensual.puedeEditarMes(actual)) return 'El mes actual quedó bloqueado';
      if (window.HFCierreFinancieroMensual.puedeEditarMes(anterior)) return 'Un mes histórico se puede modificar';
      return true;
    }));

    const resultado = {
      fecha:new Date().toISOString(),
      aprobadas:pruebas.filter(p => p.ok).length,
      total:pruebas.length,
      listo:pruebas.every(p => p.ok),
      pruebas
    };
    try { localStorage.setItem('hf_diagnostico_etapa_12', JSON.stringify(resultado)); } catch (_) {}
    console.group(`Hogar Finanzas · etapa 12 ${resultado.listo ? 'APROBADA' : 'CON INCIDENCIAS'}`);
    console.table(pruebas);
    console.groupEnd();
    return resultado;
  }

  window.HFDiagnosticoEtapa12 = Object.freeze({ ejecutar });
})();
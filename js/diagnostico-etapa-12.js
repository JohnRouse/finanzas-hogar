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

    pruebas.push(prueba('Cierre mensual disponible desde administración', () => {
      const estado = window.HFCierreFinancieroMensual?.obtenerEstado?.();
      if (!estado) return 'No se obtuvo el estado del módulo';
      if (!estado.modalDisponible) return 'Falta el modal del cierre';
      if (!document.querySelector('#hfDebtAdminModal [data-admin-action="cierre"]')) {
        return 'Falta el acceso al historial mensual en Administración';
      }
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

    pruebas.push(prueba('Vista familiar de deudas disponible', () => {
      const modulo = window.HFDeudasFamiliares;
      const vista = document.getElementById('hf-family-debt-view');
      const pagina = document.getElementById('page-deudas');
      if (!modulo || typeof modulo.renderizar !== 'function') return 'HFDeudasFamiliares no está listo';
      if (!vista) return 'Falta la vista familiar';
      if (!pagina?.classList.contains('hf-family-debt-page')) return 'La página Deudas no está en modo familiar';
      if (!document.querySelector('.hf-family-card-list')) return 'Falta el listado sencillo de deudas';
      return true;
    }));

    pruebas.push(prueba('Herramientas técnicas separadas', () => {
      const estado = window.HFDeudasFamiliares?.obtenerEstado?.();
      if (!estado?.modalAdminDisponible) return 'Falta el modal Administrar deudas';
      const originales = ['tarjetas-grid','prestamos-grid','debtChart']
        .map(id => document.getElementById(id)?.closest('.section'))
        .filter(Boolean);
      if (originales.some(seccion => seccion.getAttribute('data-hf-family-hidden') !== 'true')) {
        return 'Una sección técnica sigue en la vista familiar';
      }
      const pruebaEstado = window.HFDeudasFamiliares?.resumenTarjeta?.({
        id:'prueba', nombre:'Prueba', limite:1000, deuda:1200
      });
      if (pruebaEstado?.etiqueta !== 'Excedida') return 'La ayuda visual no identifica una tarjeta excedida';
      return true;
    }));

    pruebas.push(prueba('Administración centralizada en el FAB', () => {
      const modulo = window.HFDeudasFamiliares;
      const estado = modulo?.obtenerEstado?.();
      if (!modulo || typeof modulo.aplicarFabAdministracion !== 'function') {
        return 'Falta la integración administrativa del FAB';
      }
      if (estado?.botonAdministrarVisible) return 'El botón Administrar sigue duplicado en la cabecera';
      if (typeof window.abrirAdministracionDeudas !== 'function') return 'Falta la acción administrativa del FAB';
      if (!document.getElementById('fab-global')) return 'No existe el FAB global';
      return true;
    }));

    pruebas.push(prueba('Ahorro real separado del disponible', () => {
      const modulo = window.HFCoherenciaFinanciera;
      if (!modulo?.calcularResumen) return 'HFCoherenciaFinanciera no está listo';
      const r = modulo.calcularResumen({
        ingresos:[{monto:2000}],
        gastos:[
          {monto:500,medio:'efectivo',cat:'Hogar'},
          {monto:300,medio:'tarjeta',cat:'Otros'},
          {monto:400,tipoMovimiento:'pagoTarjeta',cat:'Deudas'}
        ],
        metas:[{actual:100,objetivo:1000}],
        tarjetas:[{deuda:1000,estadoCuenta:{pagoMinimo:100}}],
        prestamos:[{saldo:500,cuota:50}]
      });
      if (r.ahorroReservado !== 100) return `Ahorro reservado ${r.ahorroReservado}, esperado 100`;
      if (r.pagosDeudaMes !== 400) return `Pagado a deudas ${r.pagosDeudaMes}, esperado 400`;
      if (r.disponibleSinAsignar !== 1100) return `Disponible ${r.disponibleSinAsignar}, esperado 1100`;
      if (r.comprasCredito !== 300) return `Crédito ${r.comprasCredito}, esperado 300`;
      return true;
    }));

    pruebas.push(prueba('Distribución con barras uniformes', () => {
      const estado = window.HFCoherenciaFinanciera?.obtenerEstado?.();
      if (!estado?.distribucionUniforme) return 'Compras con crédito no usa el mismo formato de barra';
      if (document.querySelector('#distribucion-content .hf-credit-separate')) {
        return 'Permanece el componente separado de crédito';
      }
      return true;
    }));

    pruebas.push(prueba('Plan del mes con fuentes claras', () => {
      const estado = window.HFCoherenciaFinanciera?.obtenerEstado?.();
      if (!estado?.planIntuitivo) return 'Falta el nuevo Plan del mes';
      const texto = document.getElementById('presupuesto-list')?.textContent || '';
      if (!/50% de los ingresos/i.test(texto)) return 'No se explica el origen de la referencia de gastos esenciales';
      if (!/mínimos y cuotas/i.test(texto)) return 'No se explica el origen de los compromisos de deuda';
      return true;
    }));

    pruebas.push(prueba('Objetivos financieros sin mensajes editoriales', () => {
      const estado = window.HFCoherenciaFinanciera?.obtenerEstado?.();
      if (!estado?.objetivosSinMensajes) return 'Siguen visibles mensajes explicativos innecesarios';
      if (document.querySelector('#regla-502030 .hf-objectives-intro, #regla-502030 .hf-objectives-note')) {
        return 'El bloque aún contiene introducción o nota final';
      }
      return true;
    }));

    pruebas.push(prueba('Alertas de Resumen compactas e interactivas', () => {
      const modulo = window.HFCoherenciaFinanciera;
      const estado = modulo?.obtenerEstado?.();
      if (!estado?.alertasCompactas) return 'Falta la lista compacta de alertas';
      if (typeof modulo?.toggleAlertas !== 'function') return 'Falta la acción Ver todas / Ver menos';
      const boton = document.querySelector('#necesita-atencion .hf-alert-toggle');
      if (boton?.hasAttribute('onclick')) return 'El botón depende de un onclick inline';
      return true;
    }));

    pruebas.push(prueba('Tendencia requiere historial real', () => {
      const modulo = window.HFCoherenciaFinanciera;
      if (!modulo?.puedeMostrarTendencia) return 'Falta la regla de tendencia';
      const dos = [{totales:{ahorroReservado:10}},{totales:{ahorroReservado:20}}];
      const tres = [...dos,{totales:{ahorroReservado:30}}];
      if (modulo.puedeMostrarTendencia(dos)) return 'El gráfico aparece con menos de 3 cierres';
      if (!modulo.puedeMostrarTendencia(tres)) return 'El gráfico no aparece con 3 cierres reales';
      return true;
    }));

    pruebas.push(prueba('Proyección global usa mínimos y cuotas', () => {
      const p = window.HFCoherenciaFinanciera?.proyeccionGlobal?.(8263.53, 1068.89);
      if (!p) return 'No se obtuvo la proyección global';
      if (p.meses !== 8) return `Resultado ${p.meses} meses, esperado 8`;
      const texto = document.querySelector('#hf-family-debt-view .hf-family-route')?.textContent || '';
      if (document.querySelector('#hf-family-debt-view .hf-family-route')
        && !/mínimos y cuotas|Referencia para todas/i.test(texto)) {
        return 'La vista no explica que la referencia incluye todas las deudas';
      }
      return true;
    }));

    pruebas.push(prueba('Comparador de pago adicional', () => {
      const modulo = window.HFSimuladorPagoExtra;
      if (!modulo?.compararEscenarios) return 'HFSimuladorPagoExtra no está listo';
      const r = modulo.compararEscenarios({ deuda:1000, pagoBase:250, pagoExtra:250, tea:0 });
      if (!r.base?.viable || !r.mejorado?.viable) return 'Un escenario de prueba no fue viable';
      if (r.mejorado.meses >= r.base.meses) return 'El pago adicional no reduce el plazo';
      if (!document.getElementById('hf-extra-payment-box')) return 'Falta el comparador dentro del simulador';
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
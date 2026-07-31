/* Hogar Finanzas — Etapa 11.5.1: motor predictivo financiero */
(() => {
  'use strict';

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const hoyISO = () => new Date().toISOString().slice(0, 10);

  function diasEntre(inicio, fin) {
    const a = new Date(`${inicio}T12:00:00`);
    const b = new Date(`${fin}T12:00:00`);
    const dias = Math.ceil((b - a) / 86400000);
    return Number.isFinite(dias) ? dias : 0;
  }

  function tasaMensualDesdeTEA(tea) {
    const tasa = Math.max(0, numero(tea)) / 100;
    return Math.pow(1 + tasa, 1 / 12) - 1;
  }

  function simularPago({ deuda = 0, pagoMensual = 0, tea = 0, maxMeses = 600 } = {}) {
    let saldo = Math.max(0, numero(deuda));
    const pago = Math.max(0, numero(pagoMensual));
    const tasaMensual = tasaMensualDesdeTEA(tea);
    const meses = [];
    let interesesTotales = 0;

    if (!saldo) return { viable: true, meses: 0, interesesTotales: 0, totalPagado: 0, cronograma: [] };
    if (!pago) return { viable: false, motivo: 'pago-cero', meses: null, interesesTotales: null, totalPagado: null, cronograma: [] };
    if (tasaMensual > 0 && pago <= saldo * tasaMensual) {
      return { viable: false, motivo: 'pago-no-cubre-interes', meses: null, interesesTotales: null, totalPagado: null, cronograma: [] };
    }

    for (let mes = 1; mes <= maxMeses && saldo > 0.005; mes += 1) {
      const interes = saldo * tasaMensual;
      const pagoReal = Math.min(pago, saldo + interes);
      const capital = Math.max(0, pagoReal - interes);
      saldo = Math.max(0, saldo + interes - pagoReal);
      interesesTotales += interes;
      meses.push({ mes, pago: redondear(pagoReal), interes: redondear(interes), capital: redondear(capital), saldo: redondear(saldo) });
    }

    const viable = saldo <= 0.005;
    return {
      viable,
      motivo: viable ? null : 'plazo-superior-al-limite',
      meses: viable ? meses.length : null,
      interesesTotales: viable ? redondear(interesesTotales) : null,
      totalPagado: viable ? redondear(numero(deuda) + interesesTotales) : null,
      cronograma: meses
    };
  }

  function estimarProximoCierre(resumen = {}, opciones = {}) {
    const estado = resumen.estadoCuenta || {};
    const fechaCierre = estado.fechaCierre || opciones.fechaCierre || '';
    const fechaObjetivo = opciones.fechaObjetivo || opciones.proximoCierre || '';
    const hoy = opciones.hoy || hoyISO();
    const diasObservados = Math.max(1, fechaCierre ? diasEntre(fechaCierre, hoy) : 1);
    const gastoDiario = numero(resumen.comprasPosteriores) / diasObservados;
    const diasRestantes = fechaObjetivo ? Math.max(0, diasEntre(hoy, fechaObjetivo)) : 0;
    const comprasProyectadas = gastoDiario * diasRestantes;
    const deudaProyectada = Math.max(0, numero(resumen.deudaEstimada) + comprasProyectadas - numero(opciones.pagosPlanificados));
    const utilizacionProyectada = numero(resumen.lineaTotal) > 0 ? (deudaProyectada / numero(resumen.lineaTotal)) * 100 : 0;

    return {
      fechaBase: hoy,
      fechaObjetivo: fechaObjetivo || null,
      diasObservados,
      diasRestantes,
      gastoDiarioPromedio: redondear(gastoDiario),
      comprasProyectadas: redondear(comprasProyectadas),
      pagosPlanificados: redondear(opciones.pagosPlanificados),
      deudaProyectada: redondear(deudaProyectada),
      utilizacionProyectada: redondear(utilizacionProyectada)
    };
  }

  function analizarRiesgo({ utilizacion = 0, pagoMinimo = 0, deuda = 0, fechaVencimiento = '', hoy = hoyISO() } = {}) {
    const alertas = [];
    const uso = numero(utilizacion);
    const saldo = numero(deuda);
    const minimo = numero(pagoMinimo);
    const diasVencimiento = fechaVencimiento ? diasEntre(hoy, fechaVencimiento) : null;

    if (uso >= 80) alertas.push({ nivel: 'critico', codigo: 'utilizacion-80', mensaje: 'La utilización de la línea supera el 80 %.' });
    else if (uso >= 50) alertas.push({ nivel: 'alto', codigo: 'utilizacion-50', mensaje: 'La utilización de la línea supera el 50 %.' });
    else if (uso >= 30) alertas.push({ nivel: 'medio', codigo: 'utilizacion-30', mensaje: 'La utilización de la línea supera el 30 %.' });

    if (saldo > 0 && minimo > 0 && minimo / saldo < 0.05) alertas.push({ nivel: 'medio', codigo: 'minimo-bajo', mensaje: 'El pago mínimo representa menos del 5 % de la deuda.' });
    if (diasVencimiento !== null && diasVencimiento < 0) alertas.push({ nivel: 'critico', codigo: 'vencida', mensaje: 'La fecha de vencimiento ya pasó.' });
    else if (diasVencimiento !== null && diasVencimiento <= 3) alertas.push({ nivel: 'alto', codigo: 'vence-pronto', mensaje: `El pago vence en ${diasVencimiento} día(s).` });

    return { nivel: alertas[0]?.nivel || 'normal', diasVencimiento, alertas };
  }

  function promedioHistorico(estados = [], campo = 'pagoTotal', limite = 6) {
    const valores = estados.slice(0, limite).map(e => numero(e[campo] ?? e.deudaFacturada)).filter(v => v > 0);
    return valores.length ? redondear(valores.reduce((a, b) => a + b, 0) / valores.length) : 0;
  }

  async function proyectarTarjeta(tarjetaId, opciones = {}) {
    const global = await window.HFModeloFinanciero.obtenerResumenGlobal();
    const resumen = global.tarjetas.find(t => t.tarjetaId === tarjetaId);
    if (!resumen) throw new Error('No se encontró la tarjeta solicitada.');
    const historico = await window.HFModeloFinanciero.listarEstadosCuenta(tarjetaId, opciones.limiteHistorico || 12);
    const pagoSugerido = numero(opciones.pagoMensual) || numero(resumen.pagoMinimo);
    const proyeccion = estimarProximoCierre(resumen, opciones);
    const amortizacion = simularPago({ deuda: resumen.deudaEstimada, pagoMensual: pagoSugerido, tea: opciones.tea || 0 });
    const riesgo = analizarRiesgo({ utilizacion: proyeccion.utilizacionProyectada || resumen.utilizacion, pagoMinimo: resumen.pagoMinimo, deuda: proyeccion.deudaProyectada, fechaVencimiento: resumen.estadoCuenta?.fechaVencimiento });

    const resultado = {
      tarjetaId,
      resumenActual: resumen,
      promedioFacturado6M: promedioHistorico(historico, 'pagoTotal', 6),
      cantidadEstadosHistoricos: historico.length,
      proyeccionCierre: proyeccion,
      amortizacion,
      riesgo,
      calculadoEn: new Date().toISOString(),
      version: '11.5.1'
    };
    window.dispatchEvent(new CustomEvent('hf:proyeccion-financiera', { detail: resultado }));
    return resultado;
  }

  async function proyectarTodo(opcionesPorTarjeta = {}) {
    const global = await window.HFModeloFinanciero.obtenerResumenGlobal();
    const resultados = [];
    for (const tarjeta of global.tarjetas) {
      resultados.push(await proyectarTarjeta(tarjeta.tarjetaId, opcionesPorTarjeta[tarjeta.tarjetaId] || {}));
    }
    const totalProyectado = redondear(resultados.reduce((s, r) => s + numero(r.proyeccionCierre.deudaProyectada), 0));
    const resultado = { tarjetas: resultados, totalProyectado, calculadoEn: new Date().toISOString(), version: '11.5.1' };
    window.dispatchEvent(new CustomEvent('hf:proyecciones-financieras', { detail: resultado }));
    return resultado;
  }

  window.HFMotorPredictivoFinanciero = Object.freeze({
    tasaMensualDesdeTEA,
    simularPago,
    estimarProximoCierre,
    analizarRiesgo,
    promedioHistorico,
    proyectarTarjeta,
    proyectarTodo
  });
})();
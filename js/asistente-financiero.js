/* Hogar Finanzas — Etapa 12.0.1: asistente financiero inteligente */
(() => {
  'use strict';

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const limitar = (valor, min, max) => Math.min(max, Math.max(min, valor));
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

  function diasEntre(inicio, fin) {
    const a = new Date(`${inicio}T12:00:00`);
    const b = new Date(`${fin}T12:00:00`);
    const dias = Math.ceil((b - a) / 86400000);
    return Number.isFinite(dias) ? dias : 0;
  }

  function calcularScore({ utilizacionPromedio = 0, vencidas = 0, proximasAVencer = 0, coberturaMinimos = 1, tendenciaDeuda = 0 } = {}) {
    let score = 100;
    const uso = numero(utilizacionPromedio);
    if (uso > 80) score -= 35;
    else if (uso > 50) score -= 22;
    else if (uso > 30) score -= 10;

    score -= Math.min(35, numero(vencidas) * 18);
    score -= Math.min(15, numero(proximasAVencer) * 5);
    if (numero(coberturaMinimos) < 1) score -= 25;
    else if (numero(coberturaMinimos) < 1.2) score -= 8;
    if (numero(tendenciaDeuda) > 10) score -= 12;
    else if (numero(tendenciaDeuda) > 0) score -= 5;
    else if (numero(tendenciaDeuda) < -10) score += 4;

    score = Math.round(limitar(score, 0, 100));
    const nivel = score >= 80 ? 'saludable' : score >= 60 ? 'estable' : score >= 40 ? 'riesgo' : 'critico';
    return { score, nivel };
  }

  function analizarTarjeta(resumen = {}, opciones = {}) {
    const hoy = opciones.hoy || hoyISO();
    const deuda = numero(resumen.deudaEstimada);
    const linea = numero(resumen.lineaTotal);
    const utilizacion = linea > 0 ? (deuda / linea) * 100 : numero(resumen.utilizacion);
    const vencimiento = resumen.estadoCuenta?.fechaVencimiento || resumen.fechaVencimiento || '';
    const cierre = resumen.estadoCuenta?.fechaCierre || resumen.fechaCierre || '';
    const diasVencimiento = vencimiento ? diasEntre(hoy, vencimiento) : null;
    const diasCierre = cierre ? diasEntre(hoy, cierre) : null;
    const alertas = [];

    if (diasVencimiento !== null && diasVencimiento < 0 && deuda > 0) alertas.push({ prioridad: 100, tipo: 'vencida', mensaje: 'La tarjeta tiene un pago vencido.' });
    else if (diasVencimiento !== null && diasVencimiento <= 3 && deuda > 0) alertas.push({ prioridad: 85, tipo: 'vence-pronto', mensaje: `El pago vence en ${diasVencimiento} día(s).` });
    if (utilizacion >= 80) alertas.push({ prioridad: 90, tipo: 'uso-critico', mensaje: 'La utilización de la línea supera el 80 %.' });
    else if (utilizacion >= 50) alertas.push({ prioridad: 70, tipo: 'uso-alto', mensaje: 'La utilización de la línea supera el 50 %.' });
    else if (utilizacion >= 30) alertas.push({ prioridad: 45, tipo: 'uso-medio', mensaje: 'La utilización de la línea supera el 30 %.' });

    const disponible = Math.max(0, numero(resumen.lineaDisponibleEstimada ?? resumen.lineaDisponible ?? linea - deuda));
    return {
      tarjetaId: resumen.tarjetaId,
      nombre: resumen.tarjetaNombre || resumen.nombre || resumen.banco || 'Tarjeta',
      deuda: redondear(deuda),
      pagoMinimo: redondear(resumen.pagoMinimo),
      lineaTotal: redondear(linea),
      disponible: redondear(disponible),
      utilizacion: redondear(utilizacion),
      vencimiento: vencimiento || null,
      cierre: cierre || null,
      diasVencimiento,
      diasCierre,
      alertas
    };
  }

  function priorizarAcciones(tarjetas = [], presupuestoDisponible = 0) {
    const acciones = [];
    const presupuesto = numero(presupuestoDisponible);
    const minimos = tarjetas.reduce((s, t) => s + numero(t.pagoMinimo), 0);

    tarjetas.forEach(t => {
      t.alertas.forEach(a => acciones.push({ ...a, tarjetaId: t.tarjetaId, tarjetaNombre: t.nombre }));
    });

    if (presupuesto < minimos) {
      acciones.push({ prioridad: 110, tipo: 'presupuesto-insuficiente', mensaje: `Faltan S/ ${redondear(minimos - presupuesto).toFixed(2)} para cubrir todos los pagos mínimos.` });
    } else if (presupuesto > minimos) {
      acciones.push({ prioridad: 35, tipo: 'pago-extra', mensaje: `Hay S/ ${redondear(presupuesto - minimos).toFixed(2)} disponibles para adelantar deuda.` });
    }

    return acciones.sort((a, b) => b.prioridad - a.prioridad);
  }

  function recomendarTarjetaParaCompra(tarjetas = [], montoCompra = 0, opciones = {}) {
    const monto = Math.max(0, numero(montoCompra));
    const hoy = opciones.hoy || hoyISO();
    const candidatas = tarjetas
      .filter(t => t.disponible >= monto && t.lineaTotal > 0)
      .map(t => {
        const usoPosterior = ((t.deuda + monto) / t.lineaTotal) * 100;
        const diasDesdeCierre = t.cierre ? diasEntre(t.cierre, hoy) : null;
        const puntajeUso = Math.max(0, 100 - usoPosterior);
        const puntajeCiclo = diasDesdeCierre !== null && diasDesdeCierre >= 0 ? Math.min(20, diasDesdeCierre) : 0;
        return { ...t, usoPosterior: redondear(usoPosterior), puntaje: redondear(puntajeUso + puntajeCiclo) };
      })
      .sort((a, b) => b.puntaje - a.puntaje);

    const mejor = candidatas[0] || null;
    return {
      viable: Boolean(mejor),
      monto: redondear(monto),
      tarjeta: mejor,
      motivo: mejor ? `Mantendría una utilización aproximada de ${mejor.usoPosterior} % después de la compra.` : 'Ninguna tarjeta tiene línea suficiente para la compra.'
    };
  }

  async function analizarSituacion({ presupuestoDisponible = 0, montoCompra = 0, tasas = {} } = {}) {
    if (!window.HFModeloFinanciero) throw new Error('El modelo financiero no está disponible.');
    const global = await HFModeloFinanciero.obtenerResumenGlobal();
    const tarjetas = (global.tarjetas || []).map(t => analizarTarjeta(t));
    const deudaTotal = tarjetas.reduce((s, t) => s + t.deuda, 0);
    const lineaTotal = tarjetas.reduce((s, t) => s + t.lineaTotal, 0);
    const minimos = tarjetas.reduce((s, t) => s + t.pagoMinimo, 0);
    const vencidas = tarjetas.filter(t => t.diasVencimiento !== null && t.diasVencimiento < 0 && t.deuda > 0).length;
    const proximasAVencer = tarjetas.filter(t => t.diasVencimiento !== null && t.diasVencimiento >= 0 && t.diasVencimiento <= 3 && t.deuda > 0).length;
    const utilizacionPromedio = lineaTotal > 0 ? (deudaTotal / lineaTotal) * 100 : 0;
    const coberturaMinimos = minimos > 0 ? numero(presupuestoDisponible) / minimos : 1;
    const salud = calcularScore({ utilizacionPromedio, vencidas, proximasAVencer, coberturaMinimos });
    const acciones = priorizarAcciones(tarjetas, presupuestoDisponible);
    const compra = montoCompra > 0 ? recomendarTarjetaParaCompra(tarjetas, montoCompra) : null;

    let planPagos = null;
    if (window.HFOptimizadorPagos && numero(presupuestoDisponible) > 0) {
      try {
        planPagos = await HFOptimizadorPagos.optimizarDesdeModelo({ presupuestoMensual: presupuestoDisponible, tasas });
      } catch (error) {
        console.warn('No se pudo generar el plan de pagos:', error);
      }
    }

    const resultado = {
      salud,
      resumen: {
        deudaTotal: redondear(deudaTotal),
        lineaTotal: redondear(lineaTotal),
        utilizacionPromedio: redondear(utilizacionPromedio),
        pagoMinimoTotal: redondear(minimos),
        presupuestoDisponible: redondear(presupuestoDisponible),
        vencidas,
        proximasAVencer
      },
      tarjetas,
      acciones,
      recomendacionCompra: compra,
      planPagos,
      calculadoEn: new Date().toISOString(),
      version: '12.0.1'
    };

    window.dispatchEvent(new CustomEvent('hf:diagnostico-financiero', { detail: resultado }));
    return resultado;
  }

  window.HFAsistenteFinanciero = Object.freeze({
    calcularScore,
    analizarTarjeta,
    priorizarAcciones,
    recomendarTarjetaParaCompra,
    analizarSituacion
  });
})();
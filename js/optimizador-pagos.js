/* Hogar Finanzas — Etapa 11.5.3: optimizador inteligente de pagos */
(() => {
  'use strict';

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;

  function tasaMensual(tea) {
    const tasa = Math.max(0, numero(tea)) / 100;
    return Math.pow(1 + tasa, 1 / 12) - 1;
  }

  function normalizarTarjeta(tarjeta = {}, tasas = {}) {
    const id = tarjeta.tarjetaId || tarjeta.id;
    const tea = numero(tasas[id] ?? tarjeta.tea ?? tarjeta.tasaEfectivaAnual ?? 0);
    return {
      id,
      nombre: tarjeta.tarjetaNombre || tarjeta.nombre || tarjeta.banco || 'Tarjeta',
      deuda: Math.max(0, numero(tarjeta.deudaEstimada ?? tarjeta.deuda ?? tarjeta.saldo)),
      minimo: Math.max(0, numero(tarjeta.pagoMinimo ?? tarjeta.minimo)),
      tea,
      tasaMensual: tasaMensual(tea)
    };
  }

  function ordenarTarjetas(tarjetas, estrategia = 'avalancha') {
    const copia = [...tarjetas].filter(t => t.deuda > 0);
    if (estrategia === 'bola-nieve') return copia.sort((a, b) => a.deuda - b.deuda || b.tea - a.tea);
    if (estrategia === 'hibrida') {
      return copia.sort((a, b) => {
        const puntajeA = (a.tea * 0.65) + ((1 / Math.max(a.deuda, 1)) * 10000 * 0.35);
        const puntajeB = (b.tea * 0.65) + ((1 / Math.max(b.deuda, 1)) * 10000 * 0.35);
        return puntajeB - puntajeA;
      });
    }
    return copia.sort((a, b) => b.tea - a.tea || a.deuda - b.deuda);
  }

  function simularEstrategia({ tarjetas = [], presupuestoMensual = 0, estrategia = 'avalancha', maxMeses = 600 } = {}) {
    const preparadas = tarjetas.map(t => Number.isFinite(Number(t.tasaMensual))
      ? { ...t, tasaMensual: numero(t.tasaMensual), tea: numero(t.tea), deuda: numero(t.deuda), minimo: numero(t.minimo) }
      : normalizarTarjeta(t));
    const normalizadas = ordenarTarjetas(preparadas, estrategia);
    const presupuesto = Math.max(0, numero(presupuestoMensual));
    const sumaMinimos = normalizadas.reduce((s, t) => s + t.minimo, 0);

    if (!normalizadas.length) return { viable: true, meses: 0, interesesTotales: 0, totalPagado: 0, cronograma: [], orden: [] };
    if (presupuesto < sumaMinimos) {
      return { viable: false, motivo: 'presupuesto-menor-a-minimos', presupuesto, sumaMinimos, cronograma: [], orden: normalizadas.map(t => t.id) };
    }

    const estado = normalizadas.map(t => ({ ...t, saldo: t.deuda }));
    const cronograma = [];
    let interesesTotales = 0;
    let totalPagado = 0;

    for (let mes = 1; mes <= maxMeses; mes += 1) {
      const activas = estado.filter(t => t.saldo > 0.005);
      if (!activas.length) break;

      const detalle = [];
      let disponible = presupuesto;

      activas.forEach(t => {
        const interes = t.saldo * t.tasaMensual;
        t.saldo += interes;
        interesesTotales += interes;
        detalle.push({ tarjetaId: t.id, nombre: t.nombre, interes, pago: 0, saldoInicialConInteres: t.saldo });
      });

      activas.forEach(t => {
        const pagoBase = Math.min(t.minimo, t.saldo, disponible);
        t.saldo -= pagoBase;
        disponible -= pagoBase;
        totalPagado += pagoBase;
        const fila = detalle.find(d => d.tarjetaId === t.id);
        fila.pago += pagoBase;
      });

      const prioridad = ordenarTarjetas(activas.map(t => ({ ...t, deuda: t.saldo })), estrategia);
      for (const objetivo of prioridad) {
        if (disponible <= 0.005) break;
        const tarjeta = estado.find(t => t.id === objetivo.id);
        if (!tarjeta || tarjeta.saldo <= 0.005) continue;
        const extra = Math.min(disponible, tarjeta.saldo);
        tarjeta.saldo -= extra;
        disponible -= extra;
        totalPagado += extra;
        const fila = detalle.find(d => d.tarjetaId === tarjeta.id);
        fila.pago += extra;
      }

      cronograma.push({
        mes,
        pagoTotal: redondear(presupuesto - disponible),
        intereses: redondear(detalle.reduce((s, d) => s + d.interes, 0)),
        saldoTotal: redondear(estado.reduce((s, t) => s + Math.max(0, t.saldo), 0)),
        detalle: detalle.map(d => ({ tarjetaId: d.tarjetaId, nombre: d.nombre, pago: redondear(d.pago), interes: redondear(d.interes), saldo: redondear(Math.max(0, estado.find(t => t.id === d.tarjetaId)?.saldo || 0)) }))
      });
    }

    const saldoFinal = estado.reduce((s, t) => s + Math.max(0, t.saldo), 0);
    const viable = saldoFinal <= 0.005;
    return {
      viable,
      motivo: viable ? null : 'plazo-superior-al-limite',
      estrategia,
      presupuesto,
      sumaMinimos: redondear(sumaMinimos),
      meses: viable ? cronograma.length : null,
      interesesTotales: viable ? redondear(interesesTotales) : null,
      totalPagado: viable ? redondear(totalPagado) : null,
      ahorroVsMinimos: null,
      orden: normalizadas.map(t => t.id),
      cronograma
    };
  }

  function compararEstrategias({ tarjetas = [], presupuestoMensual = 0 } = {}) {
    const estrategias = ['avalancha', 'bola-nieve', 'hibrida'];
    const resultados = estrategias.map(estrategia => simularEstrategia({ tarjetas, presupuestoMensual, estrategia }));
    const viables = resultados.filter(r => r.viable);
    const mejor = viables.sort((a, b) => a.interesesTotales - b.interesesTotales || a.meses - b.meses)[0] || null;
    return { resultados, mejorEstrategia: mejor?.estrategia || null, calculadoEn: new Date().toISOString(), version: '11.5.3' };
  }

  function generarRecomendaciones(comparacion) {
    const mejor = comparacion.resultados.find(r => r.estrategia === comparacion.mejorEstrategia);
    if (!mejor) return ['El presupuesto actual no alcanza para cubrir los pagos mínimos.'];
    const etiquetas = { avalancha: 'Avalancha', 'bola-nieve': 'Bola de nieve', hibrida: 'Híbrida' };
    const recomendaciones = [`La estrategia ${etiquetas[mejor.estrategia]} es la más eficiente con el presupuesto indicado.`];
    recomendaciones.push(`Permite cancelar las deudas en aproximadamente ${mejor.meses} meses.`);
    recomendaciones.push(`El costo estimado en intereses sería de S/ ${mejor.interesesTotales.toFixed(2)}.`);
    if (mejor.orden.length) recomendaciones.push(`La primera tarjeta a priorizar es ${mejor.orden[0]}.`);
    return recomendaciones;
  }

  async function optimizarDesdeModelo({ presupuestoMensual = 0, tasas = {} } = {}) {
    if (!window.HFModeloFinanciero) throw new Error('El modelo financiero no está disponible.');
    const global = await HFModeloFinanciero.obtenerResumenGlobal();
    const tarjetas = global.tarjetas.map(t => normalizarTarjeta(t, tasas));
    const comparacion = compararEstrategias({ tarjetas, presupuestoMensual });
    const resultado = { ...comparacion, recomendaciones: generarRecomendaciones(comparacion), tarjetas, presupuestoMensual: numero(presupuestoMensual) };
    window.dispatchEvent(new CustomEvent('hf:plan-pagos-optimizado', { detail: resultado }));
    return resultado;
  }

  window.HFOptimizadorPagos = Object.freeze({
    tasaMensual,
    normalizarTarjeta,
    ordenarTarjetas,
    simularEstrategia,
    compararEstrategias,
    generarRecomendaciones,
    optimizarDesdeModelo
  });
})();
/* Hogar Finanzas — Etapa 12.2.1: motor de recomendaciones financieras */
(() => {
  'use strict';

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const moneda = valor => `S/ ${redondear(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

  function normalizarPregunta(texto = '') {
    return String(texto)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñáéíóúü\s.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extraerMonto(texto = '') {
    const limpio = String(texto).replace(/,/g, '');
    const coincidencias = [...limpio.matchAll(/(?:s\/?\.?\s*)?(\d+(?:\.\d{1,2})?)/gi)];
    return coincidencias.length ? numero(coincidencias[0][1]) : 0;
  }

  function extraerDias(texto = '') {
    const normalizado = normalizarPregunta(texto);
    const match = normalizado.match(/(?:en|dentro de)\s+(\d+)\s+dias?/);
    if (match) return Math.max(1, Number(match[1]));
    if (normalizado.includes('proximo mes')) return 30;
    if (normalizado.includes('dos meses')) return 60;
    if (normalizado.includes('tres meses')) return 90;
    return 30;
  }

  function detectarIntencion(pregunta = '') {
    const texto = normalizarPregunta(pregunta);
    if (/(pago|abono|adelanto).*(extra|adicional)|que pasa si pago/.test(texto)) return 'simular-pago-extra';
    if (/(que|cual).*(tarjeta).*(usar|conviene)|mejor tarjeta/.test(texto)) return 'recomendar-tarjeta';
    if (/(deuda).*(primero|priorizar|cancelar)|cual deuda/.test(texto)) return 'priorizar-deuda';
    if (/(ahorro|ahorraria).*(interes)|intereses.*ahorro/.test(texto)) return 'ahorro-intereses';
    if (/(cuando|fecha).*(comprar|compra)|puedo hacer.*compra/.test(texto)) return 'fecha-segura-compra';
    if (/(cuanto).*(quedara|tendre|saldo).*(dias|mes)/.test(texto)) return 'saldo-futuro';
    if (/(gasto|gastando).*(mas|menos).*(mes pasado|anterior)/.test(texto)) return 'comparar-gasto';
    if (/(probabilidad|posibilidad|riesgo).*(llegar|pagar|vencimiento)/.test(texto)) return 'riesgo-vencimiento';
    return 'diagnostico-general';
  }

  function resumenTarjetas(global = {}) {
    return (global.tarjetas || []).map(t => window.HFAsistenteFinanciero
      ? HFAsistenteFinanciero.analizarTarjeta(t)
      : {
          tarjetaId: t.tarjetaId,
          nombre: t.tarjetaNombre || t.nombre || t.banco || 'Tarjeta',
          deuda: redondear(t.deudaEstimada),
          pagoMinimo: redondear(t.pagoMinimo),
          lineaTotal: redondear(t.lineaTotal),
          disponible: redondear(t.lineaDisponibleEstimada ?? t.lineaDisponible),
          utilizacion: redondear(t.utilizacion),
          vencimiento: t.estadoCuenta?.fechaVencimiento || t.fechaVencimiento || null,
          alertas: []
        });
  }

  function elegirPrioridad(tarjetas = [], tasas = {}) {
    return [...tarjetas]
      .filter(t => t.deuda > 0)
      .map(t => ({ ...t, tasa: numero(tasas[t.tarjetaId] ?? tasas[t.nombre] ?? 0) }))
      .sort((a, b) => {
        if (a.alertas?.some(x => x.tipo === 'vencida') !== b.alertas?.some(x => x.tipo === 'vencida')) {
          return a.alertas?.some(x => x.tipo === 'vencida') ? -1 : 1;
        }
        if (b.tasa !== a.tasa) return b.tasa - a.tasa;
        if (b.utilizacion !== a.utilizacion) return b.utilizacion - a.utilizacion;
        return a.deuda - b.deuda;
      })[0] || null;
  }

  async function obtenerContexto(opciones = {}) {
    if (!window.HFModeloFinanciero) throw new Error('El modelo financiero no está disponible.');
    const global = await HFModeloFinanciero.obtenerResumenGlobal();
    const tarjetas = resumenTarjetas(global);
    let diagnostico = null;
    if (window.HFAsistenteFinanciero) {
      diagnostico = await HFAsistenteFinanciero.analizarSituacion({
        presupuestoDisponible: opciones.presupuestoDisponible || 0,
        montoCompra: opciones.montoCompra || 0,
        tasas: opciones.tasas || {}
      });
    }
    return { global, tarjetas, diagnostico };
  }

  async function simularPagoExtra(monto, opciones = {}) {
    const { tarjetas } = await obtenerContexto(opciones);
    const prioridad = elegirPrioridad(tarjetas, opciones.tasas || {});
    if (!prioridad) return { tipo: 'simulacion', titulo: 'No hay deuda por reducir', respuesta: 'No se encontraron tarjetas con saldo pendiente.' };

    const aplicado = Math.min(numero(monto), prioridad.deuda);
    const deudaPosterior = Math.max(0, prioridad.deuda - aplicado);
    const usoPosterior = prioridad.lineaTotal > 0 ? deudaPosterior / prioridad.lineaTotal * 100 : 0;
    let ahorroEstimado = 0;
    const tasaAnual = numero(opciones.tasas?.[prioridad.tarjetaId] ?? opciones.tasas?.[prioridad.nombre] ?? 0);
    if (tasaAnual > 0) ahorroEstimado = aplicado * (tasaAnual / 100 / 12);

    return {
      tipo: 'simulacion',
      titulo: `Pago extra en ${prioridad.nombre}`,
      respuesta: `Conviene aplicar ${moneda(aplicado)} a ${prioridad.nombre}. La deuda bajaría de ${moneda(prioridad.deuda)} a ${moneda(deudaPosterior)} y su utilización quedaría cerca de ${redondear(usoPosterior)} %.${ahorroEstimado > 0 ? ` El ahorro aproximado de intereses del siguiente mes sería ${moneda(ahorroEstimado)}.` : ''}`,
      datos: { tarjeta: prioridad, montoAplicado: aplicado, deudaPosterior, usoPosterior, ahorroEstimado }
    };
  }

  async function recomendarTarjeta(monto, opciones = {}) {
    const { tarjetas } = await obtenerContexto({ ...opciones, montoCompra: monto });
    const recomendacion = window.HFAsistenteFinanciero
      ? HFAsistenteFinanciero.recomendarTarjetaParaCompra(tarjetas, monto)
      : null;
    if (!recomendacion?.viable) {
      return { tipo: 'compra', titulo: 'Compra no recomendable', respuesta: recomendacion?.motivo || 'No hay suficiente información para recomendar una tarjeta.' };
    }
    return {
      tipo: 'compra',
      titulo: `Usa ${recomendacion.tarjeta.nombre}`,
      respuesta: `${recomendacion.tarjeta.nombre} es la mejor opción para una compra de ${moneda(monto)}. ${recomendacion.motivo}`,
      datos: recomendacion
    };
  }

  async function priorizarDeuda(opciones = {}) {
    const { tarjetas } = await obtenerContexto(opciones);
    const prioridad = elegirPrioridad(tarjetas, opciones.tasas || {});
    if (!prioridad) return { tipo: 'prioridad', titulo: 'Sin deuda pendiente', respuesta: 'No se encontraron saldos pendientes.' };
    return {
      tipo: 'prioridad',
      titulo: `Prioriza ${prioridad.nombre}`,
      respuesta: `La primera deuda a atacar debería ser ${prioridad.nombre}, con saldo de ${moneda(prioridad.deuda)} y utilización de ${redondear(prioridad.utilizacion)} %. Mantén al día los mínimos de las demás tarjetas y dirige el excedente a esta deuda.`,
      datos: prioridad
    };
  }

  async function saldoFuturo(dias, opciones = {}) {
    if (!window.HFMotorFlujoCajaPredictivo) throw new Error('El motor predictivo de flujo de caja no está disponible.');
    const proyeccion = await HFMotorFlujoCajaPredictivo.proyectarDesdeModelo({
      saldoInicial: opciones.saldoInicial || 0,
      colchónMinimo: opciones.colchónMinimo || 0,
      dias,
      movimientos: opciones.movimientos || [],
      recurrentes: opciones.recurrentes || []
    });
    return {
      tipo: 'flujo',
      titulo: `Saldo estimado en ${dias} días`,
      respuesta: `El saldo proyectado es ${moneda(proyeccion.saldoFinal)}. El punto más bajo sería ${moneda(proyeccion.saldoMinimo)} el ${proyeccion.fechaSaldoMinimo}. ${proyeccion.diasNegativos > 0 ? `Se detectan ${proyeccion.diasNegativos} día(s) con saldo negativo.` : 'No se detectan días con saldo negativo.'}`,
      datos: proyeccion
    };
  }

  async function fechaSeguraCompra(monto, opciones = {}) {
    if (!window.HFMotorFlujoCajaPredictivo) throw new Error('El motor predictivo de flujo de caja no está disponible.');
    const horizonte = opciones.dias || 90;
    const base = await HFMotorFlujoCajaPredictivo.proyectarDesdeModelo({
      saldoInicial: opciones.saldoInicial || 0,
      colchónMinimo: opciones.colchónMinimo || 0,
      dias: horizonte,
      movimientos: opciones.movimientos || [],
      recurrentes: opciones.recurrentes || []
    });
    const margen = numero(opciones.colchónMinimo || 0) + numero(monto);
    const candidato = base.puntos.find(p => p.saldo >= margen && !p.negativo && !p.bajoColchon);
    if (!candidato) return { tipo: 'fecha-compra', titulo: 'No hay fecha segura detectada', respuesta: `No encontré una fecha dentro de los próximos ${horizonte} días en la que una compra de ${moneda(monto)} mantenga intacto tu colchón de seguridad.` };
    return {
      tipo: 'fecha-compra',
      titulo: `Fecha sugerida: ${candidato.fecha}`,
      respuesta: `La primera fecha razonablemente segura sería el ${candidato.fecha}. Ese día el saldo proyectado es ${moneda(candidato.saldo)}, suficiente para cubrir la compra de ${moneda(monto)} y conservar el colchón configurado.`,
      datos: candidato
    };
  }

  async function riesgoVencimiento(opciones = {}) {
    const { diagnostico } = await obtenerContexto(opciones);
    if (!diagnostico) return { tipo: 'riesgo', titulo: 'Riesgo no disponible', respuesta: 'No se pudo calcular el diagnóstico financiero.' };
    const cobertura = diagnostico.resumen.pagoMinimoTotal > 0 ? diagnostico.resumen.presupuestoDisponible / diagnostico.resumen.pagoMinimoTotal : 1;
    let probabilidad = 15;
    if (cobertura < 1) probabilidad = 85;
    else if (cobertura < 1.2) probabilidad = 60;
    else if (diagnostico.resumen.vencidas > 0) probabilidad = 90;
    else if (diagnostico.resumen.proximasAVencer > 0) probabilidad = 45;
    else if (diagnostico.salud.nivel === 'riesgo') probabilidad = 55;
    else if (diagnostico.salud.nivel === 'critico') probabilidad = 80;
    return {
      tipo: 'riesgo',
      titulo: 'Riesgo estimado de incumplimiento',
      respuesta: `El riesgo estimado es ${probabilidad} %. Tu presupuesto cubre ${redondear(cobertura)} veces los pagos mínimos y actualmente tienes ${diagnostico.resumen.vencidas} tarjeta(s) vencida(s) y ${diagnostico.resumen.proximasAVencer} próxima(s) a vencer.`,
      datos: { probabilidad, cobertura, diagnostico }
    };
  }

  async function diagnosticoGeneral(opciones = {}) {
    const { diagnostico } = await obtenerContexto(opciones);
    if (!diagnostico) return { tipo: 'diagnostico', titulo: 'Diagnóstico no disponible', respuesta: 'No se pudo generar un diagnóstico completo.' };
    const principal = diagnostico.acciones?.[0];
    return {
      tipo: 'diagnostico',
      titulo: `Salud financiera: ${diagnostico.salud.nivel}`,
      respuesta: `Tu score financiero es ${diagnostico.salud.score}/100. La deuda total estimada es ${moneda(diagnostico.resumen.deudaTotal)} y el pago mínimo conjunto es ${moneda(diagnostico.resumen.pagoMinimoTotal)}.${principal ? ` La prioridad actual es: ${principal.mensaje}` : ''}`,
      datos: diagnostico
    };
  }

  async function responderPregunta(pregunta, opciones = {}) {
    const intencion = detectarIntencion(pregunta);
    const monto = opciones.monto || extraerMonto(pregunta);
    let resultado;

    if (intencion === 'simular-pago-extra' || intencion === 'ahorro-intereses') resultado = await simularPagoExtra(monto, opciones);
    else if (intencion === 'recomendar-tarjeta') resultado = await recomendarTarjeta(monto, opciones);
    else if (intencion === 'priorizar-deuda') resultado = await priorizarDeuda(opciones);
    else if (intencion === 'saldo-futuro') resultado = await saldoFuturo(extraerDias(pregunta), opciones);
    else if (intencion === 'fecha-segura-compra') resultado = await fechaSeguraCompra(monto, opciones);
    else if (intencion === 'riesgo-vencimiento') resultado = await riesgoVencimiento(opciones);
    else resultado = await diagnosticoGeneral(opciones);

    const respuesta = {
      pregunta,
      intencion,
      monto: redondear(monto),
      ...resultado,
      generadoEn: new Date().toISOString(),
      version: '12.2.1'
    };
    window.dispatchEvent(new CustomEvent('hf:recomendacion-financiera', { detail: respuesta }));
    return respuesta;
  }

  window.HFMotorRecomendacionesFinancieras = Object.freeze({
    normalizarPregunta,
    extraerMonto,
    extraerDias,
    detectarIntencion,
    elegirPrioridad,
    simularPagoExtra,
    recomendarTarjeta,
    priorizarDeuda,
    saldoFuturo,
    fechaSeguraCompra,
    riesgoVencimiento,
    diagnosticoGeneral,
    responderPregunta
  });
})();
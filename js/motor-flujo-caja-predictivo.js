/* Hogar Finanzas — Etapa 12.1.1: motor predictivo de flujo de caja */
(() => {
  'use strict';

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const fechaISO = fecha => new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const hoyISO = () => fechaISO(new Date());

  function sumarDias(fecha, dias) {
    const base = new Date(`${fecha}T12:00:00`);
    base.setDate(base.getDate() + Number(dias || 0));
    return fechaISO(base);
  }

  function rangoFechas(inicio, dias) {
    return Array.from({ length: Math.max(1, Number(dias || 1)) }, (_, indice) => sumarDias(inicio, indice));
  }

  function normalizarMovimiento(movimiento = {}) {
    const tipoOriginal = String(movimiento.tipo || movimiento.categoria || '').toLowerCase();
    const monto = Math.abs(numero(movimiento.monto));
    const ingreso = movimiento.esIngreso === true || ['ingreso', 'abono', 'sueldo', 'deposito'].some(t => tipoOriginal.includes(t));
    return {
      id: movimiento.id || movimiento.movimientoId || `${movimiento.fecha || ''}-${movimiento.descripcion || ''}-${monto}`,
      fecha: movimiento.fecha || movimiento.fechaMovimiento || movimiento.fechaVencimiento || hoyISO(),
      descripcion: movimiento.descripcion || movimiento.nombre || movimiento.concepto || 'Movimiento',
      monto: ingreso ? monto : -monto,
      tipo: ingreso ? 'ingreso' : 'egreso',
      categoria: movimiento.categoria || movimiento.tipo || 'otros',
      recurrente: Boolean(movimiento.recurrente),
      origen: movimiento.origen || 'manual'
    };
  }

  function expandirRecurrentes(recurrentes = [], inicio = hoyISO(), dias = 90) {
    const fin = sumarDias(inicio, dias - 1);
    const resultado = [];

    recurrentes.forEach(item => {
      const base = normalizarMovimiento(item);
      const frecuencia = String(item.frecuencia || 'mensual').toLowerCase();
      let fecha = item.proximaFecha || item.fechaInicio || base.fecha || inicio;
      let guardia = 0;

      while (fecha <= fin && guardia < 500) {
        if (fecha >= inicio) resultado.push({ ...base, fecha, recurrente: true, origen: 'recurrente' });
        const actual = new Date(`${fecha}T12:00:00`);
        if (frecuencia === 'semanal') actual.setDate(actual.getDate() + 7);
        else if (frecuencia === 'quincenal') actual.setDate(actual.getDate() + 15);
        else if (frecuencia === 'anual') actual.setFullYear(actual.getFullYear() + 1);
        else actual.setMonth(actual.getMonth() + 1);
        fecha = fechaISO(actual);
        guardia += 1;
      }
    });

    return resultado;
  }

  function construirPagosTarjetas(tarjetas = [], opciones = {}) {
    const usarMinimo = opciones.usarPagoMinimo !== false;
    return tarjetas
      .map(t => {
        const fecha = t.estadoCuenta?.fechaVencimiento || t.fechaVencimiento;
        if (!fecha) return null;
        const monto = usarMinimo ? numero(t.pagoMinimo) : numero(t.deudaEstimada);
        if (monto <= 0) return null;
        return normalizarMovimiento({
          id: `pago-tarjeta-${t.tarjetaId}-${fecha}`,
          fecha,
          descripcion: `Pago ${t.tarjetaNombre || t.nombre || t.banco || 'tarjeta'}`,
          monto,
          tipo: 'egreso',
          categoria: 'tarjetas',
          origen: 'modelo-financiero'
        });
      })
      .filter(Boolean);
  }

  function proyectarFlujo({ saldoInicial = 0, movimientos = [], recurrentes = [], tarjetas = [], dias = 90, fechaInicio = hoyISO(), colchónMinimo = 0 } = {}) {
    const fechas = rangoFechas(fechaInicio, dias);
    const todos = [
      ...movimientos.map(normalizarMovimiento),
      ...expandirRecurrentes(recurrentes, fechaInicio, dias),
      ...construirPagosTarjetas(tarjetas)
    ].filter(m => m.fecha >= fechaInicio && m.fecha <= fechas[fechas.length - 1]);

    const porFecha = todos.reduce((acc, movimiento) => {
      (acc[movimiento.fecha] ||= []).push(movimiento);
      return acc;
    }, {});

    let saldo = numero(saldoInicial);
    let saldoMinimo = saldo;
    let fechaSaldoMinimo = fechaInicio;
    const puntos = fechas.map(fecha => {
      const eventos = porFecha[fecha] || [];
      const ingresos = eventos.filter(e => e.monto > 0).reduce((s, e) => s + e.monto, 0);
      const egresos = Math.abs(eventos.filter(e => e.monto < 0).reduce((s, e) => s + e.monto, 0));
      saldo += ingresos - egresos;
      if (saldo < saldoMinimo) {
        saldoMinimo = saldo;
        fechaSaldoMinimo = fecha;
      }
      return {
        fecha,
        ingresos: redondear(ingresos),
        egresos: redondear(egresos),
        flujoNeto: redondear(ingresos - egresos),
        saldo: redondear(saldo),
        bajoColchon: saldo < numero(colchónMinimo),
        negativo: saldo < 0,
        eventos
      };
    });

    const diasNegativos = puntos.filter(p => p.negativo);
    const diasBajoColchon = puntos.filter(p => p.bajoColchon);
    const primerRiesgo = puntos.find(p => p.negativo || p.bajoColchon) || null;
    const ingresosTotales = puntos.reduce((s, p) => s + p.ingresos, 0);
    const egresosTotales = puntos.reduce((s, p) => s + p.egresos, 0);

    return {
      fechaInicio,
      fechaFin: fechas[fechas.length - 1],
      dias,
      saldoInicial: redondear(saldoInicial),
      saldoFinal: redondear(saldo),
      saldoMinimo: redondear(saldoMinimo),
      fechaSaldoMinimo,
      ingresosTotales: redondear(ingresosTotales),
      egresosTotales: redondear(egresosTotales),
      flujoNeto: redondear(ingresosTotales - egresosTotales),
      diasNegativos: diasNegativos.length,
      diasBajoColchon: diasBajoColchon.length,
      primerRiesgo,
      puntos,
      calculadoEn: new Date().toISOString(),
      version: '12.1.1'
    };
  }

  function generarAlertas(proyeccion, colchónMinimo = 0) {
    const alertas = [];
    if (proyeccion.diasNegativos > 0) {
      alertas.push({
        nivel: 'critico',
        codigo: 'saldo-negativo',
        mensaje: `Se proyectan ${proyeccion.diasNegativos} día(s) con saldo negativo.`,
        fecha: proyeccion.primerRiesgo?.fecha || null
      });
    } else if (proyeccion.diasBajoColchon > 0) {
      alertas.push({
        nivel: 'alto',
        codigo: 'bajo-colchon',
        mensaje: `El saldo caería por debajo del colchón de S/ ${redondear(colchónMinimo).toFixed(2)}.`,
        fecha: proyeccion.primerRiesgo?.fecha || null
      });
    }
    if (proyeccion.flujoNeto < 0) {
      alertas.push({ nivel: 'medio', codigo: 'flujo-negativo', mensaje: 'Los egresos proyectados superan los ingresos del periodo.' });
    }
    if (proyeccion.saldoFinal > proyeccion.saldoInicial && !alertas.length) {
      alertas.push({ nivel: 'normal', codigo: 'flujo-saludable', mensaje: 'El flujo proyectado mantiene una tendencia positiva.' });
    }
    return alertas;
  }

  function resumirVentanas(proyeccion, ventanas = [30, 60, 90]) {
    return ventanas
      .filter(dias => dias <= proyeccion.puntos.length)
      .map(dias => {
        const puntos = proyeccion.puntos.slice(0, dias);
        return {
          dias,
          saldoFinal: puntos.at(-1)?.saldo ?? proyeccion.saldoInicial,
          saldoMinimo: Math.min(...puntos.map(p => p.saldo)),
          ingresos: redondear(puntos.reduce((s, p) => s + p.ingresos, 0)),
          egresos: redondear(puntos.reduce((s, p) => s + p.egresos, 0)),
          diasNegativos: puntos.filter(p => p.negativo).length
        };
      });
  }

  async function proyectarDesdeModelo(opciones = {}) {
    if (!window.HFModeloFinanciero) throw new Error('El modelo financiero no está disponible.');
    const global = await HFModeloFinanciero.obtenerResumenGlobal();
    const proyeccion = proyectarFlujo({
      saldoInicial: opciones.saldoInicial,
      movimientos: opciones.movimientos || [],
      recurrentes: opciones.recurrentes || [],
      tarjetas: global.tarjetas || [],
      dias: opciones.dias || 90,
      fechaInicio: opciones.fechaInicio || hoyISO(),
      colchónMinimo: opciones.colchónMinimo || 0
    });
    const resultado = {
      ...proyeccion,
      alertas: generarAlertas(proyeccion, opciones.colchónMinimo || 0),
      ventanas: resumirVentanas(proyeccion)
    };
    window.dispatchEvent(new CustomEvent('hf:flujo-caja-proyectado', { detail: resultado }));
    return resultado;
  }

  window.HFMotorFlujoCajaPredictivo = Object.freeze({
    sumarDias,
    rangoFechas,
    normalizarMovimiento,
    expandirRecurrentes,
    construirPagosTarjetas,
    proyectarFlujo,
    generarAlertas,
    resumirVentanas,
    proyectarDesdeModelo
  });
})();
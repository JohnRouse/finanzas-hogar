/* Hogar Finanzas — Etapa 13.2: Memoria Financiera Inteligente */
(() => {
  'use strict';

  const CLAVE = 'hf_memoria_financiera';
  const CLAVE_CONFIG = 'hf_memoria_financiera_config';
  const MAX_EVENTOS = 500;
  const MAX_PATRONES = 120;

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const ahora = () => new Date().toISOString();

  function leerJSON(clave, respaldo) {
    try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? respaldo; }
    catch { return respaldo; }
  }

  function guardarJSON(clave, valor) {
    localStorage.setItem(clave, JSON.stringify(valor));
  }

  function memoriaBase() {
    return {
      version: '13.2',
      creadaEn: ahora(),
      actualizadaEn: ahora(),
      eventos: [],
      patrones: {},
      preferencias: {},
      metricas: {}
    };
  }

  function obtenerMemoria() {
    return { ...memoriaBase(), ...leerJSON(CLAVE, {}) };
  }

  function guardarMemoria(memoria) {
    memoria.actualizadaEn = ahora();
    guardarJSON(CLAVE, memoria);
    window.dispatchEvent(new CustomEvent('hf:memoria-financiera-actualizada', { detail: memoria }));
    return memoria;
  }

  function registrarEvento(tipo, detalle = {}) {
    const memoria = obtenerMemoria();
    memoria.eventos = [{
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tipo,
      fecha: ahora(),
      detalle
    }, ...(memoria.eventos || [])].slice(0, MAX_EVENTOS);
    recalcularPatrones(memoria);
    return guardarMemoria(memoria);
  }

  function agruparPor(lista, selector) {
    return lista.reduce((acc, item) => {
      const clave = selector(item) || 'sin-dato';
      (acc[clave] ||= []).push(item);
      return acc;
    }, {});
  }

  function promedio(valores) {
    const validos = valores.map(numero).filter(v => Number.isFinite(v));
    return validos.length ? validos.reduce((s, v) => s + v, 0) / validos.length : 0;
  }

  function recalcularPatrones(memoria = obtenerMemoria()) {
    const eventos = memoria.eventos || [];
    const movimientos = eventos.filter(e => ['compra', 'pago', 'ingreso', 'movimiento-importado'].includes(e.tipo));
    const compras = movimientos.filter(e => e.tipo === 'compra' || e.detalle?.tipo === 'gasto');
    const pagos = movimientos.filter(e => e.tipo === 'pago' || e.detalle?.categoria === 'Pago de tarjeta');

    const porCategoria = agruparPor(compras, e => e.detalle?.categoria);
    const porTarjeta = agruparPor(compras, e => e.detalle?.tarjetaId || e.detalle?.tarjeta);
    const pagosPorTarjeta = agruparPor(pagos, e => e.detalle?.tarjetaId || e.detalle?.tarjeta);

    const categorias = Object.entries(porCategoria).map(([categoria, items]) => ({
      categoria,
      frecuencia: items.length,
      promedio: promedio(items.map(i => i.detalle?.monto)),
      total: items.reduce((s, i) => s + numero(i.detalle?.monto), 0),
      ultimaFecha: items.map(i => i.detalle?.fecha || i.fecha).sort().reverse()[0]
    })).sort((a, b) => b.total - a.total).slice(0, MAX_PATRONES);

    const tarjetas = Object.entries(porTarjeta).map(([tarjetaId, items]) => ({
      tarjetaId,
      frecuenciaUso: items.length,
      gastoPromedio: promedio(items.map(i => i.detalle?.monto)),
      gastoTotal: items.reduce((s, i) => s + numero(i.detalle?.monto), 0)
    })).sort((a, b) => b.frecuenciaUso - a.frecuenciaUso).slice(0, MAX_PATRONES);

    const habitosPago = Object.entries(pagosPorTarjeta).map(([tarjetaId, items]) => ({
      tarjetaId,
      cantidadPagos: items.length,
      pagoPromedio: promedio(items.map(i => i.detalle?.monto)),
      diaPromedio: promedio(items.map(i => {
        const fecha = new Date(i.detalle?.fecha || i.fecha);
        return Number.isFinite(fecha.getTime()) ? fecha.getDate() : 0;
      }))
    })).slice(0, MAX_PATRONES);

    memoria.patrones = {
      categorias,
      tarjetas,
      habitosPago,
      categoriaPrincipal: categorias[0] || null,
      tarjetaMasUsada: tarjetas[0] || null,
      actualizadoEn: ahora()
    };

    memoria.metricas = {
      totalEventos: eventos.length,
      totalCompras: compras.length,
      totalPagos: pagos.length,
      gastoPromedio: promedio(compras.map(i => i.detalle?.monto)),
      pagoPromedio: promedio(pagos.map(i => i.detalle?.monto))
    };
    return memoria;
  }

  function detectarAnomaliaMovimiento(movimiento = {}) {
    const memoria = obtenerMemoria();
    const categoria = movimiento.categoria || 'sin-dato';
    const patron = memoria.patrones?.categorias?.find(p => p.categoria === categoria);
    if (!patron || patron.frecuencia < 3) return { anomalo: false, confianza: 'baja' };
    const monto = numero(movimiento.monto);
    const limite = patron.promedio * 2.2;
    return {
      anomalo: monto > limite && monto - patron.promedio >= 50,
      confianza: patron.frecuencia >= 8 ? 'alta' : 'media',
      promedioCategoria: patron.promedio,
      limiteEstimado: limite,
      diferencia: monto - patron.promedio
    };
  }

  function recomendarMomentoCompra({ monto = 0, categoria = 'Otros' } = {}) {
    const memoria = obtenerMemoria();
    const patron = memoria.patrones?.categorias?.find(p => p.categoria === categoria);
    const plan = leerJSON('hf_plan_financiero_activo', null);
    const presupuesto = numero(plan?.presupuestoMensual);
    const pagoProximo = numero(plan?.cronograma?.[0]?.pagoTotal);
    const margen = Math.max(0, presupuesto - pagoProximo);
    const riesgoHistorico = patron && numero(monto) > patron.promedio * 1.5;
    return {
      recomendable: numero(monto) <= margen && !riesgoHistorico,
      margenEstimado: margen,
      gastoPromedioCategoria: patron?.promedio || 0,
      motivo: numero(monto) > margen
        ? 'La compra supera el margen disponible después del pago planificado.'
        : riesgoHistorico
          ? 'El monto es considerablemente mayor que tu gasto habitual en esta categoría.'
          : 'La compra parece compatible con el margen y el patrón histórico actuales.'
    };
  }

  function obtenerResumen() {
    const memoria = obtenerMemoria();
    return {
      metricas: memoria.metricas || {},
      categoriaPrincipal: memoria.patrones?.categoriaPrincipal || null,
      tarjetaMasUsada: memoria.patrones?.tarjetaMasUsada || null,
      habitosPago: memoria.patrones?.habitosPago || [],
      actualizadoEn: memoria.actualizadaEn
    };
  }

  const EVENTOS = {
    'hf:compra-registrada': 'compra',
    'hf:pago-registrado': 'pago',
    'hf:ingreso-registrado': 'ingreso',
    'hf:importacion-confirmada': 'movimiento-importado',
    'hf:plan-financiero-generado': 'plan-generado',
    'hf:objetivo-financiero-guardado': 'objetivo-guardado',
    'hf:director-ejecucion-completada': 'director-ejecutado'
  };

  function iniciar() {
    Object.entries(EVENTOS).forEach(([evento, tipo]) => {
      window.addEventListener(evento, e => registrarEvento(tipo, e.detail || {}));
    });
    const memoria = obtenerMemoria();
    recalcularPatrones(memoria);
    guardarMemoria(memoria);
    window.dispatchEvent(new CustomEvent('hf:memoria-financiera-lista', { detail: obtenerResumen() }));
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 2200));
  setTimeout(iniciar, 3600);

  window.HFMemoriaFinancieraInteligente = Object.freeze({
    registrarEvento,
    recalcularPatrones,
    detectarAnomaliaMovimiento,
    recomendarMomentoCompra,
    obtenerMemoria,
    obtenerResumen,
    configurar: cambios => {
      const config = { ...leerJSON(CLAVE_CONFIG, {}), ...cambios };
      guardarJSON(CLAVE_CONFIG, config);
      return config;
    },
    iniciar
  });
})();
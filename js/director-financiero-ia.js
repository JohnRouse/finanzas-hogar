/* Hogar Finanzas — Etapa 13.1: Director Financiero IA */
(() => {
  'use strict';

  const CLAVE_ESTADO = 'hf_director_financiero_estado';
  const CLAVE_CONFIG = 'hf_director_financiero_config';
  const CLAVE_HISTORIAL = 'hf_director_financiero_historial';
  const MAX_HISTORIAL = 80;
  const ESPERA_RECALCULO = 700;

  let procesando = false;
  let temporizador = null;
  let pendiente = null;

  const ahora = () => new Date().toISOString();

  function leerJSON(clave, respaldo) {
    try {
      return JSON.parse(localStorage.getItem(clave) || 'null') ?? respaldo;
    } catch {
      return respaldo;
    }
  }

  function guardarJSON(clave, valor) {
    localStorage.setItem(clave, JSON.stringify(valor));
  }

  function configuracion() {
    return {
      activo: true,
      recalcularFlujo: true,
      recalcularObjetivos: true,
      regenerarPlan: true,
      calendarizarPlan: true,
      recalcularInsights: true,
      actualizarChat: true,
      ...leerJSON(CLAVE_CONFIG, {})
    };
  }

  function actualizarConfiguracion(cambios = {}) {
    const nueva = { ...configuracion(), ...cambios };
    guardarJSON(CLAVE_CONFIG, nueva);
    window.dispatchEvent(new CustomEvent('hf:director-configuracion-actualizada', { detail: nueva }));
    return nueva;
  }

  function registrarHistorial(registro) {
    const historial = leerJSON(CLAVE_HISTORIAL, []);
    const siguiente = [{ id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, fecha: ahora(), ...registro }, ...historial].slice(0, MAX_HISTORIAL);
    guardarJSON(CLAVE_HISTORIAL, siguiente);
    return siguiente[0];
  }

  function estadoInicial() {
    return {
      estado: 'inactivo',
      ultimoMotivo: null,
      ultimaEjecucion: null,
      ultimaEjecucionExitosa: null,
      pasos: [],
      errores: [],
      version: '13.1'
    };
  }

  function obtenerEstado() {
    return { ...estadoInicial(), ...leerJSON(CLAVE_ESTADO, {}) };
  }

  function guardarEstado(estado) {
    guardarJSON(CLAVE_ESTADO, estado);
    window.dispatchEvent(new CustomEvent('hf:director-estado-actualizado', { detail: estado }));
    return estado;
  }

  async function ejecutarPaso(nombre, habilitado, funcion) {
    const inicio = performance.now();
    if (!habilitado) return { nombre, estado: 'omitido', duracionMs: 0 };
    if (typeof funcion !== 'function') return { nombre, estado: 'no-disponible', duracionMs: 0 };
    try {
      const resultado = await funcion();
      return { nombre, estado: 'completado', duracionMs: Math.round(performance.now() - inicio), resultado };
    } catch (error) {
      return {
        nombre,
        estado: 'error',
        duracionMs: Math.round(performance.now() - inicio),
        error: error?.message || String(error)
      };
    }
  }

  async function recalcularFlujo() {
    if (!window.HFMotorFlujoCajaPredictivo) return null;
    if (typeof HFMotorFlujoCajaPredictivo.proyectarDesdeModelo === 'function') return HFMotorFlujoCajaPredictivo.proyectarDesdeModelo();
    if (typeof HFMotorFlujoCajaPredictivo.proyectar === 'function') return HFMotorFlujoCajaPredictivo.proyectar();
    return null;
  }

  async function recalcularObjetivos() {
    if (!window.HFMotorObjetivosFinancieros?.evaluarTodos) return null;
    return HFMotorObjetivosFinancieros.evaluarTodos();
  }

  async function regenerarPlan() {
    if (!window.HFPlanificadorFinancieroInteligente?.generarPlan) return null;
    return HFPlanificadorFinancieroInteligente.generarPlan();
  }

  async function calendarizarPlan(plan) {
    if (!plan || !window.HFPlanificadorFinancieroInteligente?.convertirPlanAMovimientos) return null;
    return HFPlanificadorFinancieroInteligente.convertirPlanAMovimientos(plan);
  }

  async function recalcularInsights() {
    if (!window.HFInsightsFinancierosAutomaticos) return null;
    if (typeof HFInsightsFinancierosAutomaticos.analizar === 'function') return HFInsightsFinancierosAutomaticos.analizar();
    if (typeof HFInsightsFinancierosAutomaticos.actualizarPanel === 'function') return HFInsightsFinancierosAutomaticos.actualizarPanel();
    if (typeof HFInsightsFinancierosAutomaticos.generarInsights === 'function') return HFInsightsFinancierosAutomaticos.generarInsights();
    return null;
  }

  async function actualizarChat(resumen) {
    const detalle = {
      tipo: 'actualizacion-director-financiero',
      titulo: 'Plan financiero actualizado',
      mensaje: construirMensajeChat(resumen),
      resumen,
      fecha: ahora()
    };
    window.dispatchEvent(new CustomEvent('hf:director-mensaje-chat', { detail: detalle }));
    return detalle;
  }

  function construirMensajeChat(resumen) {
    const plan = resumen.plan;
    const errores = resumen.pasos.filter(p => p.estado === 'error').length;
    if (plan?.mesesEstimados) {
      return `Actualicé tu plan financiero. Con el presupuesto actual, la deuda se cancelaría aproximadamente en ${plan.mesesEstimados} meses.${errores ? ` Hubo ${errores} componente(s) que no pudieron actualizarse.` : ''}`;
    }
    return errores
      ? `Actualicé la información disponible, pero ${errores} componente(s) presentaron errores.`
      : 'La información financiera y sus recomendaciones fueron actualizadas.';
  }

  async function ejecutar({ motivo = 'manual', detalle = null, forzar = false } = {}) {
    const config = configuracion();
    if (!config.activo && !forzar) return { omitido: true, motivo: 'director-desactivado' };
    if (procesando) {
      pendiente = { motivo, detalle };
      return { enCola: true };
    }

    procesando = true;
    const inicio = ahora();
    guardarEstado({ ...obtenerEstado(), estado: 'procesando', ultimoMotivo: motivo, ultimaEjecucion: inicio, pasos: [], errores: [] });
    window.dispatchEvent(new CustomEvent('hf:director-ejecucion-iniciada', { detail: { motivo, detalle, inicio } }));

    const pasos = [];
    let plan = null;

    pasos.push(await ejecutarPaso('flujo-caja', config.recalcularFlujo, recalcularFlujo));
    pasos.push(await ejecutarPaso('objetivos', config.recalcularObjetivos, recalcularObjetivos));

    const pasoPlan = await ejecutarPaso('plan-financiero', config.regenerarPlan, regenerarPlan);
    pasos.push(pasoPlan);
    if (pasoPlan.estado === 'completado') plan = pasoPlan.resultado;

    pasos.push(await ejecutarPaso('calendario-financiero', config.calendarizarPlan, () => calendarizarPlan(plan)));
    pasos.push(await ejecutarPaso('insights', config.recalcularInsights, recalcularInsights));

    const resumen = {
      motivo,
      detalle,
      inicio,
      fin: ahora(),
      plan,
      pasos,
      exitosos: pasos.filter(p => p.estado === 'completado').length,
      errores: pasos.filter(p => p.estado === 'error'),
      omitidos: pasos.filter(p => ['omitido', 'no-disponible'].includes(p.estado)).length
    };

    pasos.push(await ejecutarPaso('chat-financiero', config.actualizarChat, () => actualizarChat(resumen)));
    resumen.fin = ahora();
    resumen.exitosos = pasos.filter(p => p.estado === 'completado').length;
    resumen.errores = pasos.filter(p => p.estado === 'error');
    resumen.omitidos = pasos.filter(p => ['omitido', 'no-disponible'].includes(p.estado)).length;

    const estadoFinal = guardarEstado({
      estado: resumen.errores.length ? 'completado-con-errores' : 'completado',
      ultimoMotivo: motivo,
      ultimaEjecucion: inicio,
      ultimaEjecucionExitosa: resumen.errores.length ? obtenerEstado().ultimaEjecucionExitosa : resumen.fin,
      pasos,
      errores: resumen.errores,
      version: '13.1'
    });

    registrarHistorial({
      motivo,
      detalle,
      estado: estadoFinal.estado,
      exitosos: resumen.exitosos,
      errores: resumen.errores.length,
      omitidos: resumen.omitidos,
      planId: plan?.id || null
    });

    window.dispatchEvent(new CustomEvent('hf:director-ejecucion-completada', { detail: resumen }));
    procesando = false;

    if (pendiente) {
      const siguiente = pendiente;
      pendiente = null;
      setTimeout(() => ejecutar(siguiente), 250);
    }
    return resumen;
  }

  function programarEjecucion(motivo, detalle = null) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => ejecutar({ motivo, detalle }), ESPERA_RECALCULO);
  }

  const EVENTOS_ENTRADA = {
    'hf:importacion-confirmada': 'importacion-confirmada',
    'hf:sincronizacion-financiera-completada': 'sincronizacion-completada',
    'hf:deuda-actualizada': 'deuda-actualizada',
    'hf:deudas-recalculadas': 'deudas-recalculadas',
    'hf:objetivo-financiero-guardado': 'objetivo-guardado',
    'hf:objetivo-financiero-eliminado': 'objetivo-eliminado',
    'hf:pago-registrado': 'pago-registrado',
    'hf:compra-registrada': 'compra-registrada'
  };

  function iniciar() {
    Object.entries(EVENTOS_ENTRADA).forEach(([evento, motivo]) => {
      window.addEventListener(evento, e => programarEjecucion(motivo, e.detail || null));
    });
    window.dispatchEvent(new CustomEvent('hf:director-financiero-listo', { detail: { configuracion: configuracion(), estado: obtenerEstado() } }));
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 1800));
  setTimeout(iniciar, 3000);

  window.HFDirectorFinancieroIA = Object.freeze({
    ejecutar,
    programarEjecucion,
    configuracion,
    actualizarConfiguracion,
    obtenerEstado,
    obtenerHistorial: () => leerJSON(CLAVE_HISTORIAL, []),
    iniciar
  });
})();
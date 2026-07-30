/* Hogar Finanzas — Etapa 13.4: Integración Financiera Total */
(() => {
  'use strict';

  const CLAVE_CONTEXTOS = 'hf_integracion_contextos';
  const MAX_CONTEXTOS = 60;
  let iniciado = false;
  let temporizador = null;

  const ahora = () => new Date().toISOString();
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;

  function leerJSON(clave, respaldo) {
    try { return JSON.parse(localStorage.getItem(clave) || 'null') ?? respaldo; }
    catch { return respaldo; }
  }

  function guardarJSON(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); }
    catch (error) { console.warn('No se pudo guardar el contexto integrado:', error); }
  }

  function invocar(objeto, metodos = [], ...args) {
    for (const metodo of metodos) {
      if (typeof objeto?.[metodo] === 'function') {
        try { return objeto[metodo](...args); }
        catch (error) {
          window.HFEstabilidadApp?.registrarError?.(`integracion:${metodo}`, error);
        }
      }
    }
    return null;
  }

  function obtenerPlan() {
    return invocar(window.HFPlanificadorFinancieroInteligente, ['obtenerPlanActivo', 'obtenerPlan', 'cargarPlan'])
      || leerJSON('hf_plan_financiero_activo', null)
      || leerJSON('hf_plan_financiero', null);
  }

  function obtenerObjetivos() {
    return invocar(window.HFMotorObjetivosFinancieros, ['listar', 'obtenerObjetivos', 'cargarObjetivos']) || [];
  }

  function obtenerFlujo() {
    return invocar(window.HFMotorFlujoCajaPredictivo, ['obtenerUltimaProyeccion', 'obtenerProyeccion', 'cargarProyeccion'])
      || leerJSON('hf_flujo_caja_predictivo', null);
  }

  function obtenerInsights() {
    return invocar(window.HFInsightsFinancierosAutomaticos, ['obtenerInsights', 'listar', 'cargar'])
      || leerJSON('hf_insights_financieros', []);
  }

  function construirContexto(motivo = 'manual', detalle = null) {
    const memoria = window.HFMemoriaFinancieraInteligente?.obtenerResumen?.() || null;
    const plan = obtenerPlan();
    const objetivos = obtenerObjetivos();
    const flujo = obtenerFlujo();
    const insights = obtenerInsights();
    const diagnostico = window.HFEstabilidadApp?.diagnosticar?.() || null;

    const contexto = {
      id: `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fecha: ahora(),
      motivo,
      detalle,
      memoria,
      plan,
      objetivos,
      flujo,
      insights,
      diagnostico,
      resumen: {
        deudaObjetivo: numero(plan?.deudaInicial || plan?.deudaTotal || 0),
        mesesEstimados: numero(plan?.mesesEstimados || 0),
        presupuestoMensual: numero(plan?.presupuestoMensual || plan?.presupuesto || 0),
        categoriaPrincipal: memoria?.categoriaPrincipal?.categoria || null,
        tarjetaMasUsada: memoria?.tarjetaMasUsada?.tarjetaId || null,
        erroresRecientes: diagnostico?.erroresRecientes?.length || 0
      }
    };

    const anteriores = leerJSON(CLAVE_CONTEXTOS, []);
    guardarJSON(CLAVE_CONTEXTOS, [contexto, ...anteriores].slice(0, MAX_CONTEXTOS));
    window.dispatchEvent(new CustomEvent('hf:contexto-financiero-integrado', { detail: contexto }));
    return contexto;
  }

  function generarRecomendacionesIntegradas(contexto) {
    const recomendaciones = [];
    const memoria = contexto.memoria;
    const plan = contexto.plan;
    const flujo = contexto.flujo;

    if (memoria?.categoriaPrincipal?.total > 0) {
      recomendaciones.push({
        tipo: 'patron-gasto',
        prioridad: 'media',
        titulo: `Revisar gasto en ${memoria.categoriaPrincipal.categoria}`,
        descripcion: `Es la categoría con mayor gasto histórico registrado: S/ ${numero(memoria.categoriaPrincipal.total).toFixed(2)}.`
      });
    }

    if (plan?.mesesEstimados > 24) {
      recomendaciones.push({
        tipo: 'deuda-largo-plazo',
        prioridad: 'alta',
        titulo: 'Acelerar el plan de deuda',
        descripcion: `El plan actual estima aproximadamente ${plan.mesesEstimados} meses. Conviene evaluar un pago adicional sostenible.`
      });
    }

    const saldoMinimo = numero(flujo?.saldoMinimo || flujo?.minimo || 0);
    if (saldoMinimo < 0) {
      recomendaciones.push({
        tipo: 'flujo-negativo',
        prioridad: 'alta',
        titulo: 'Corregir déficit proyectado',
        descripcion: `La proyección muestra un punto mínimo de S/ ${saldoMinimo.toFixed(2)}.`
      });
    }

    if (contexto.resumen.erroresRecientes > 0) {
      recomendaciones.push({
        tipo: 'salud-sistema',
        prioridad: 'baja',
        titulo: 'Revisar diagnóstico de la aplicación',
        descripcion: `Hay ${contexto.resumen.erroresRecientes} error(es) recientes registrados.`
      });
    }

    return recomendaciones;
  }

  function publicarParaChat(contexto, recomendaciones) {
    const payload = {
      fecha: ahora(),
      contexto,
      recomendaciones,
      mensaje: construirResumenConversacional(contexto, recomendaciones)
    };
    window.dispatchEvent(new CustomEvent('hf:chat-contexto-financiero', { detail: payload }));
    return payload;
  }

  function construirResumenConversacional(contexto, recomendaciones = []) {
    const partes = [];
    if (contexto.resumen.mesesEstimados) partes.push(`el plan estima ${contexto.resumen.mesesEstimados} meses para completar la estrategia actual`);
    if (contexto.resumen.categoriaPrincipal) partes.push(`${contexto.resumen.categoriaPrincipal} es la categoría de mayor peso histórico`);
    if (contexto.resumen.tarjetaMasUsada) partes.push(`la tarjeta más utilizada es ${contexto.resumen.tarjetaMasUsada}`);
    if (!partes.length) partes.push('todavía no hay suficiente historial para identificar patrones sólidos');
    const accion = recomendaciones[0]?.descripcion;
    return `Contexto financiero actualizado: ${partes.join('; ')}.${accion ? ` Recomendación principal: ${accion}` : ''}`;
  }

  function sincronizarCalendario(contexto) {
    const calendario = window.HFCalendarioFinancieroInteligente;
    if (!calendario) return null;
    const plan = contexto.plan;
    if (!plan) return null;
    return invocar(calendario, ['sincronizarPlan', 'generarDesdePlan', 'actualizarDesdePlan', 'generarCalendario'], plan);
  }

  function sincronizarInsights(contexto, recomendaciones) {
    const motor = window.HFInsightsFinancierosAutomaticos;
    if (!motor) return null;
    const resultado = invocar(motor, ['integrarContexto', 'actualizarConContexto'], contexto, recomendaciones);
    if (resultado !== null) return resultado;
    window.dispatchEvent(new CustomEvent('hf:insights-contexto-integrado', { detail: { contexto, recomendaciones } }));
    return true;
  }

  async function ejecutarIntegracion({ motivo = 'manual', detalle = null, ejecutarDirector = false } = {}) {
    if (ejecutarDirector && window.HFDirectorFinancieroIA?.ejecutar) {
      await window.HFDirectorFinancieroIA.ejecutar({ motivo: `integracion:${motivo}`, detalle });
    }

    const contexto = construirContexto(motivo, detalle);
    const recomendaciones = generarRecomendacionesIntegradas(contexto);
    const calendario = sincronizarCalendario(contexto);
    const insights = sincronizarInsights(contexto, recomendaciones);
    const chat = publicarParaChat(contexto, recomendaciones);

    const resultado = { fecha: ahora(), motivo, contexto, recomendaciones, calendario, insights, chat };
    window.dispatchEvent(new CustomEvent('hf:integracion-financiera-completada', { detail: resultado }));
    return resultado;
  }

  function programar(motivo, detalle = null, ejecutarDirector = false) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => ejecutarIntegracion({ motivo, detalle, ejecutarDirector }), 500);
  }

  const EVENTOS = {
    'hf:director-ejecucion-completada': ['director-completado', false],
    'hf:memoria-financiera-actualizada': ['memoria-actualizada', false],
    'hf:plan-financiero-generado': ['plan-generado', false],
    'hf:deuda-actualizada': ['deuda-actualizada', true],
    'hf:importacion-confirmada': ['importacion-confirmada', true],
    'hf:sincronizacion-financiera-completada': ['sincronizacion-completada', true]
  };

  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    Object.entries(EVENTOS).forEach(([evento, [motivo, ejecutarDirector]]) => {
      window.addEventListener(evento, e => programar(motivo, e.detail || null, ejecutarDirector));
    });
    setTimeout(() => ejecutarIntegracion({ motivo: 'inicio-aplicacion' }), 1200);
    window.dispatchEvent(new CustomEvent('hf:integracion-financiera-lista'));
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 2400));
  setTimeout(iniciar, 4200);

  window.HFIntegracionFinancieraTotal = Object.freeze({
    iniciar,
    ejecutarIntegracion,
    programar,
    construirContexto,
    generarRecomendacionesIntegradas,
    obtenerUltimoContexto: () => leerJSON(CLAVE_CONTEXTOS, [])[0] || null,
    obtenerHistorial: () => leerJSON(CLAVE_CONTEXTOS, [])
  });
})();
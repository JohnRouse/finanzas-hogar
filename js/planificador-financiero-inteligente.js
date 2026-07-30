/* Hogar Finanzas — Etapa 12.4.2: planificador financiero inteligente */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const CLAVE_PLAN = 'hf_plan_financiero_activo';
  const CLAVE_CONFIG = 'hf_planificador_config';
  const CLAVE_MOVIMIENTOS = 'hf_movimientos_planificados';
  let calculando = false;

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const moneda = valor => `S/ ${redondear(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

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

  function sumarMeses(fechaISO, meses) {
    const fecha = new Date(`${fechaISO}T12:00:00`);
    fecha.setMonth(fecha.getMonth() + meses);
    return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  }

  function fechaPagoMes(fechaBase, mes, diaPreferido = 5) {
    const fecha = new Date(`${fechaBase}T12:00:00`);
    fecha.setMonth(fecha.getMonth() + mes - 1);
    const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
    fecha.setDate(Math.min(Math.max(1, diaPreferido), ultimoDia));
    return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  }

  function obtenerConfiguracion() {
    const guardada = leerJSON(CLAVE_CONFIG, {});
    return {
      objetivoId: $('hf-planificador-objetivo')?.value || guardada.objetivoId || '',
      estrategia: $('hf-planificador-estrategia')?.value || guardada.estrategia || 'avalancha',
      presupuestoMensual: numero($('hf-planificador-presupuesto')?.value ?? guardada.presupuestoMensual),
      horizonteMeses: Math.max(1, Math.min(36, numero($('hf-planificador-horizonte')?.value ?? guardada.horizonteMeses ?? 12))),
      diaPago: Math.max(1, Math.min(28, numero($('hf-planificador-dia')?.value ?? guardada.diaPago ?? 5)))
    };
  }

  function guardarConfiguracion(config) {
    guardarJSON(CLAVE_CONFIG, config);
  }

  function objetivoAplicable(objetivo) {
    return ['salir_de_deudas', 'reducir_utilizacion', 'limitar_pago_mensual'].includes(objetivo.tipo);
  }

  async function obtenerObjetivo(config) {
    if (!window.HFMotorObjetivosFinancieros) throw new Error('El motor de objetivos no está disponible.');
    const objetivos = HFMotorObjetivosFinancieros.listarObjetivos().filter(o => o.estado === 'activo' && objetivoAplicable(o));
    if (!objetivos.length) throw new Error('Primero crea un objetivo de deuda o utilización.');
    return objetivos.find(o => o.id === config.objetivoId) || objetivos[0];
  }

  function presupuestoObjetivo(objetivo, evaluacion, contexto, config) {
    const candidato = config.presupuestoMensual
      || objetivo.pagoMaximoMensual
      || objetivo.aporteMensual
      || evaluacion.aporteRequerido
      || contexto.pagoMinimoTotal;
    return Math.max(contexto.pagoMinimoTotal, numero(candidato));
  }

  function normalizarTarjetasOptimizador(contexto) {
    return contexto.tarjetas.map(t => ({
      id: t.id,
      tarjetaId: t.id,
      nombre: t.nombre,
      tarjetaNombre: t.nombre,
      deuda: t.deuda,
      deudaEstimada: t.deuda,
      minimo: t.pagoMinimo,
      pagoMinimo: t.pagoMinimo,
      tea: t.tasa
    }));
  }

  function limitarCronograma(cronograma, horizonte) {
    return (cronograma || []).slice(0, horizonte).map(mes => ({
      mes: mes.mes,
      fecha: fechaPagoMes(hoyISO(), mes.mes),
      pagoTotal: redondear(mes.pagoTotal),
      intereses: redondear(mes.intereses),
      saldoTotal: redondear(mes.saldoTotal),
      detalle: (mes.detalle || []).filter(d => numero(d.pago) > 0).map(d => ({
        tarjetaId: d.tarjetaId,
        nombre: d.nombre,
        pago: redondear(d.pago),
        interes: redondear(d.interes),
        saldo: redondear(d.saldo)
      }))
    }));
  }

  function construirHitos(plan, objetivo) {
    const hitos = [];
    const cronograma = plan.cronograma || [];
    const saldoInicial = plan.contexto.deudaTotal;
    [75, 50, 25, 0].forEach(porcentaje => {
      const umbral = saldoInicial * porcentaje / 100;
      const mes = cronograma.find(item => item.saldoTotal <= umbral);
      if (mes) {
        hitos.push({
          porcentajeRestante: porcentaje,
          mes: mes.mes,
          fecha: mes.fecha,
          saldo: mes.saldoTotal,
          titulo: porcentaje === 0 ? 'Deuda cancelada' : `Deuda reducida al ${porcentaje} %`
        });
      }
    });
    if (objetivo.tipo === 'reducir_utilizacion') {
      const deudaMeta = plan.contexto.lineaTotal * objetivo.utilizacionMeta / 100;
      const mesMeta = cronograma.find(item => item.saldoTotal <= deudaMeta);
      if (mesMeta) hitos.unshift({ porcentajeRestante: null, mes: mesMeta.mes, fecha: mesMeta.fecha, saldo: mesMeta.saldoTotal, titulo: `Utilización objetivo de ${objetivo.utilizacionMeta} %` });
    }
    return hitos;
  }

  function construirAlertas({ objetivo, evaluacion, contexto, simulacion, presupuesto }) {
    const alertas = [];
    if (presupuesto < contexto.pagoMinimoTotal) alertas.push({ nivel: 'critica', mensaje: 'El presupuesto no cubre todos los pagos mínimos.' });
    if (!simulacion.viable) alertas.push({ nivel: 'alta', mensaje: 'El plan no logra cancelar la deuda dentro del límite de simulación.' });
    if (!evaluacion.viable) alertas.push({ nivel: 'alta', mensaje: `El aporte actual está por debajo del requerido por ${moneda(Math.abs(evaluacion.desviacionMensual))}.` });
    if (simulacion.meses && evaluacion.mesesMeta && simulacion.meses > evaluacion.mesesMeta) alertas.push({ nivel: 'media', mensaje: `El plan se extendería ${simulacion.meses - evaluacion.mesesMeta} mes(es) más que la fecha objetivo.` });
    if (!alertas.length) alertas.push({ nivel: 'baja', mensaje: 'El plan es coherente con el presupuesto y la meta seleccionada.' });
    return alertas;
  }

  async function generarPlan(opciones = {}) {
    if (!window.HFOptimizadorPagos) throw new Error('El optimizador de pagos no está disponible.');
    const config = { ...obtenerConfiguracion(), ...opciones };
    guardarConfiguracion(config);
    const objetivo = await obtenerObjetivo(config);
    const contexto = await HFMotorObjetivosFinancieros.obtenerContexto();
    const evaluacion = HFMotorObjetivosFinancieros.evaluarObjetivo(objetivo, contexto);
    const presupuesto = presupuestoObjetivo(objetivo, evaluacion, contexto, config);
    const tarjetas = normalizarTarjetasOptimizador(contexto);
    const simulacion = HFOptimizadorPagos.simularEstrategia({ tarjetas: tarjetas.map(t => HFOptimizadorPagos.normalizarTarjeta(t)), presupuestoMensual: presupuesto, estrategia: config.estrategia });
    const cronograma = limitarCronograma(simulacion.cronograma, config.horizonteMeses).map(m => ({ ...m, fecha: fechaPagoMes(hoyISO(), m.mes, config.diaPago) }));
    const plan = {
      id: `plan-${objetivo.id}`,
      objetivo,
      evaluacion,
      contexto,
      configuracion: config,
      estrategia: config.estrategia,
      presupuestoMensual: redondear(presupuesto),
      viable: Boolean(simulacion.viable && evaluacion.viable),
      mesesEstimados: simulacion.meses,
      fechaEstimadaFin: simulacion.meses ? sumarMeses(hoyISO(), simulacion.meses) : null,
      interesesEstimados: simulacion.interesesTotales,
      totalEstimado: simulacion.totalPagado,
      cronograma,
      ordenPrioridad: simulacion.orden || [],
      alertas: construirAlertas({ objetivo, evaluacion, contexto, simulacion, presupuesto }),
      generadoEn: new Date().toISOString(),
      version: '12.4.2'
    };
    plan.hitos = construirHitos(plan, objetivo);
    guardarJSON(CLAVE_PLAN, plan);
    window.dispatchEvent(new CustomEvent('hf:plan-financiero-generado', { detail: plan }));
    return plan;
  }

  function convertirPlanAMovimientos(plan) {
    const existentes = leerJSON(CLAVE_MOVIMIENTOS, []);
    const otros = Array.isArray(existentes) ? existentes.filter(m => m.origen !== 'planificador-financiero' || m.planId !== plan.id) : [];
    const nuevos = [];
    plan.cronograma.forEach(mes => {
      mes.detalle.forEach(item => {
        nuevos.push({
          id: `plan-${plan.id}-${mes.mes}-${item.tarjetaId}`,
          tipo: 'egreso',
          categoria: 'Pago de tarjeta',
          descripcion: `Pago planificado ${item.nombre}`,
          monto: item.pago,
          fecha: mes.fecha,
          tarjetaId: item.tarjetaId,
          origen: 'planificador-financiero',
          planId: plan.id,
          objetivoId: plan.objetivo.id,
          estado: 'planificado'
        });
      });
    });
    const resultado = [...otros, ...nuevos];
    guardarJSON(CLAVE_MOVIMIENTOS, resultado);
    window.dispatchEvent(new CustomEvent('hf:plan-financiero-calendarizado', { detail: { plan, movimientos: nuevos } }));
    return nuevos;
  }

  function escapar(texto = '') {
    return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function etiquetaEstrategia(valor) {
    return ({ avalancha: 'Avalancha', 'bola-nieve': 'Bola de nieve', hibrida: 'Híbrida' })[valor] || valor;
  }

  function inyectarEstilos() {
    if ($('hf-planificador-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-planificador-styles';
    style.textContent = `
      .hf-planificador-panel{margin-bottom:18px}.hf-planificador-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
      .hf-planificador-config{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px}.hf-planificador-config label{display:flex;flex-direction:column;gap:6px;font-size:.78rem}.hf-planificador-config input,.hf-planificador-config select{width:100%;box-sizing:border-box}
      .hf-planificador-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px}.hf-planificador-kpi{padding:12px;border-radius:14px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.13)}.hf-planificador-kpi span{display:block;font-size:.7rem;opacity:.65}.hf-planificador-kpi strong{display:block;margin-top:4px;font-size:1rem}
      .hf-plan-alerts{display:grid;gap:7px;margin-top:12px}.hf-plan-alert{padding:10px 12px;border-radius:12px;background:rgba(148,163,184,.07);border-left:4px solid #3b82f6}.hf-plan-alert.critica{border-left-color:#ef4444}.hf-plan-alert.alta{border-left-color:#f59e0b}.hf-plan-alert.baja{border-left-color:#22c55e}
      .hf-plan-meses{display:grid;gap:12px;margin-top:14px}.hf-plan-mes{padding:14px;border-radius:16px;border:1px solid rgba(148,163,184,.14);background:rgba(148,163,184,.05)}.hf-plan-mes-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.hf-plan-mes-title{font-weight:800}.hf-plan-detalle{display:grid;gap:7px;margin-top:10px}.hf-plan-pago{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:9px;border-radius:11px;background:rgba(148,163,184,.07);font-size:.82rem}.hf-plan-saldo{font-size:.72rem;opacity:.65}.hf-plan-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.hf-plan-empty{padding:18px;text-align:center;opacity:.68}
      @media(max-width:980px){.hf-planificador-config{grid-template-columns:repeat(2,minmax(0,1fr))}.hf-planificador-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){.hf-planificador-config,.hf-planificador-kpis{grid-template-columns:1fr}.hf-plan-pago{grid-template-columns:1fr auto}.hf-plan-saldo{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function cargarOpcionesObjetivos() {
    const select = $('hf-planificador-objetivo');
    if (!select || !window.HFMotorObjetivosFinancieros) return;
    const config = obtenerConfiguracion();
    const objetivos = HFMotorObjetivosFinancieros.listarObjetivos().filter(o => o.estado === 'activo' && objetivoAplicable(o));
    select.innerHTML = objetivos.length
      ? objetivos.map(o => `<option value="${escapar(o.id)}">${escapar(o.nombre)}</option>`).join('')
      : '<option value="">Sin objetivos compatibles</option>';
    if (objetivos.some(o => o.id === config.objetivoId)) select.value = config.objetivoId;
  }

  function inyectarPanel() {
    if ($('hf-planificador-financiero')) return;
    const pagina = $('page-deudas');
    if (!pagina) return;
    const config = obtenerConfiguracion();
    const panel = document.createElement('section');
    panel.id = 'hf-planificador-financiero';
    panel.className = 'section hf-planificador-panel';
    panel.innerHTML = `
      <div class="hf-planificador-head">
        <div><div class="section-title">Planificador financiero inteligente</div><div class="hf-debt-subtitle">Convierte una meta en un cronograma mensual de pagos por tarjeta.</div></div>
        <button class="btn-recurrentes" id="hf-planificador-generar" type="button">Generar plan</button>
      </div>
      <div class="hf-planificador-config">
        <label>Objetivo<select id="hf-planificador-objetivo"></select></label>
        <label>Estrategia<select id="hf-planificador-estrategia"><option value="avalancha">Avalancha</option><option value="bola-nieve">Bola de nieve</option><option value="hibrida">Híbrida</option></select></label>
        <label>Presupuesto mensual<input id="hf-planificador-presupuesto" type="number" min="0" step="10" value="${config.presupuestoMensual || ''}" placeholder="Usar monto del objetivo"></label>
        <label>Horizonte visible<input id="hf-planificador-horizonte" type="number" min="1" max="36" value="${config.horizonteMeses || 12}"></label>
        <label>Día de pago<input id="hf-planificador-dia" type="number" min="1" max="28" value="${config.diaPago || 5}"></label>
      </div>
      <div class="hf-planificador-kpis" id="hf-planificador-kpis"></div>
      <div class="hf-plan-alerts" id="hf-plan-alerts"></div>
      <div class="hf-plan-actions"><button class="btn-recurrentes secondary" id="hf-planificador-calendarizar" type="button" disabled>Enviar al calendario financiero</button></div>
      <div class="hf-plan-meses" id="hf-plan-meses"><div class="hf-plan-empty">Selecciona un objetivo y genera el plan.</div></div>`;
    const referencia = $('hf-objetivos-financieros') || $('hf-insights-financieros');
    if (referencia?.nextSibling) pagina.insertBefore(panel, referencia.nextSibling);
    else pagina.appendChild(panel);
    $('hf-planificador-estrategia').value = config.estrategia;
    cargarOpcionesObjetivos();
    $('hf-planificador-generar').addEventListener('click', actualizarPanel);
    $('hf-planificador-calendarizar').addEventListener('click', () => {
      const plan = leerJSON(CLAVE_PLAN, null);
      if (plan) convertirPlanAMovimientos(plan);
    });
    ['hf-planificador-objetivo','hf-planificador-estrategia','hf-planificador-presupuesto','hf-planificador-horizonte','hf-planificador-dia'].forEach(id => $(id)?.addEventListener('change', () => guardarConfiguracion(obtenerConfiguracion())));
  }

  function renderPlan(plan) {
    const kpis = $('hf-planificador-kpis');
    const alertas = $('hf-plan-alerts');
    const meses = $('hf-plan-meses');
    const calendarizar = $('hf-planificador-calendarizar');
    if (!kpis || !alertas || !meses) return;
    kpis.innerHTML = `
      <div class="hf-planificador-kpi"><span>Presupuesto mensual</span><strong>${moneda(plan.presupuestoMensual)}</strong></div>
      <div class="hf-planificador-kpi"><span>Estrategia</span><strong>${escapar(etiquetaEstrategia(plan.estrategia))}</strong></div>
      <div class="hf-planificador-kpi"><span>Meses estimados</span><strong>${plan.mesesEstimados ?? '—'}</strong></div>
      <div class="hf-planificador-kpi"><span>Intereses estimados</span><strong>${plan.interesesEstimados == null ? '—' : moneda(plan.interesesEstimados)}</strong></div>
      <div class="hf-planificador-kpi"><span>Fecha estimada</span><strong>${escapar(plan.fechaEstimadaFin || '—')}</strong></div>`;
    alertas.innerHTML = plan.alertas.map(a => `<div class="hf-plan-alert ${escapar(a.nivel)}">${escapar(a.mensaje)}</div>`).join('');
    if (!plan.cronograma.length) {
      meses.innerHTML = '<div class="hf-plan-empty">No fue posible construir un cronograma con el presupuesto actual.</div>';
      if (calendarizar) calendarizar.disabled = true;
      return;
    }
    meses.innerHTML = plan.cronograma.map(mes => `
      <article class="hf-plan-mes">
        <div class="hf-plan-mes-head"><div><div class="hf-plan-mes-title">Mes ${mes.mes} · ${escapar(mes.fecha)}</div><div class="hf-debt-subtitle">Pago total: ${moneda(mes.pagoTotal)} · Intereses: ${moneda(mes.intereses)}</div></div><strong>${moneda(mes.saldoTotal)}</strong></div>
        <div class="hf-plan-detalle">${mes.detalle.map(item => `<div class="hf-plan-pago"><strong>${escapar(item.nombre)}</strong><span>${moneda(item.pago)}</span><span class="hf-plan-saldo">Saldo: ${moneda(item.saldo)}</span></div>`).join('')}</div>
      </article>`).join('');
    if (calendarizar) calendarizar.disabled = false;
  }

  async function actualizarPanel() {
    if (calculando) return;
    calculando = true;
    const boton = $('hf-planificador-generar');
    if (boton) { boton.disabled = true; boton.textContent = 'Generando…'; }
    try {
      cargarOpcionesObjetivos();
      renderPlan(await generarPlan());
    } catch (error) {
      console.error('No se pudo generar el plan financiero.', error);
      const meses = $('hf-plan-meses');
      if (meses) meses.innerHTML = `<div class="hf-plan-empty">${escapar(error.message || 'No se pudo generar el plan.')}</div>`;
    } finally {
      calculando = false;
      if (boton) { boton.disabled = false; boton.textContent = 'Generar plan'; }
    }
  }

  function iniciar() {
    inyectarEstilos();
    inyectarPanel();
    cargarOpcionesObjetivos();
    const ultimo = leerJSON(CLAVE_PLAN, null);
    if (ultimo) renderPlan(ultimo);
  }

  ['hf:objetivo-financiero-guardado','hf:objetivo-financiero-eliminado','hf:deuda-actualizada','hf:deudas-recalculadas','hf:importacion-confirmada','hf:sincronizacion-financiera-completada'].forEach(evento => {
    window.addEventListener(evento, () => setTimeout(() => { cargarOpcionesObjetivos(); actualizarPanel(); }, 250));
  });
  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 1600));
  setTimeout(iniciar, 2600);

  window.HFPlanificadorFinancieroInteligente = Object.freeze({
    generarPlan,
    convertirPlanAMovimientos,
    obtenerConfiguracion,
    actualizarPanel,
    iniciar
  });
})();
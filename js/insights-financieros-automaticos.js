/* Hogar Finanzas — Etapa 12.3.1: insights financieros automáticos */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const moneda = valor => `S/ ${redondear(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const CLAVE_CONFIG = 'hf_insights_config';
  const CLAVE_ULTIMO = 'hf_insights_ultimo_resultado';
  let calculando = false;

  function leerJSON(clave, respaldo) {
    try {
      const valor = JSON.parse(localStorage.getItem(clave) || 'null');
      return valor ?? respaldo;
    } catch {
      return respaldo;
    }
  }

  function obtenerConfiguracion() {
    const guardada = leerJSON(CLAVE_CONFIG, {});
    return {
      saldoInicial: numero($('hf-insights-saldo')?.value ?? guardada.saldoInicial),
      colchonMinimo: numero($('hf-insights-colchon')?.value ?? guardada.colchonMinimo),
      presupuestoDisponible: numero($('hf-insights-presupuesto')?.value ?? guardada.presupuestoDisponible),
      horizonte: Math.max(7, numero($('hf-insights-horizonte')?.value ?? guardada.horizonte ?? 30)),
      umbralUsoAlto: numero(guardada.umbralUsoAlto || 75),
      umbralUsoMedio: numero(guardada.umbralUsoMedio || 50)
    };
  }

  function guardarConfiguracion(config) {
    localStorage.setItem(CLAVE_CONFIG, JSON.stringify(config));
  }

  function prioridadValor(prioridad) {
    return ({ critica: 100, alta: 75, media: 50, baja: 25 })[prioridad] || 0;
  }

  function crearInsight({ id, tipo, prioridad = 'media', titulo, mensaje, metrica = null, accion = null, entidad = null }) {
    return { id, tipo, prioridad, titulo, mensaje, metrica, accion, entidad, generadoEn: new Date().toISOString() };
  }

  function normalizarTarjetas(global = {}) {
    return (global.tarjetas || []).map(t => {
      if (window.HFAsistenteFinanciero) return HFAsistenteFinanciero.analizarTarjeta(t);
      const deuda = numero(t.deudaEstimada ?? t.deudaActual ?? t.saldo);
      const linea = numero(t.lineaTotal ?? t.limiteCredito);
      return {
        tarjetaId: t.tarjetaId || t.id,
        nombre: t.tarjetaNombre || t.nombre || t.banco || 'Tarjeta',
        deuda,
        pagoMinimo: numero(t.pagoMinimo),
        lineaTotal: linea,
        utilizacion: linea > 0 ? deuda / linea * 100 : numero(t.utilizacion),
        vencimiento: t.estadoCuenta?.fechaVencimiento || t.fechaVencimiento || null,
        cierre: t.estadoCuenta?.fechaCierre || t.fechaCierre || null,
        alertas: []
      };
    });
  }

  function diasEntre(inicio, fin) {
    if (!inicio || !fin) return null;
    const a = new Date(`${inicio}T12:00:00`);
    const b = new Date(`${fin}T12:00:00`);
    const dias = Math.ceil((b - a) / 86400000);
    return Number.isFinite(dias) ? dias : null;
  }

  function insightsTarjetas(tarjetas, config) {
    const insights = [];
    const hoy = hoyISO();

    tarjetas.forEach(t => {
      if (t.deuda <= 0) return;
      const diasVencimiento = t.vencimiento ? diasEntre(hoy, t.vencimiento) : null;
      if (diasVencimiento !== null && diasVencimiento < 0) {
        insights.push(crearInsight({
          id: `vencida-${t.tarjetaId || t.nombre}`,
          tipo: 'vencimiento', prioridad: 'critica', titulo: `${t.nombre} está vencida`,
          mensaje: `Tiene una deuda estimada de ${moneda(t.deuda)} y el vencimiento ya pasó.`,
          accion: 'Realiza al menos el pago mínimo y confirma si ya existe un abono pendiente de registrar.', entidad: t.nombre
        }));
      } else if (diasVencimiento !== null && diasVencimiento <= 3) {
        insights.push(crearInsight({
          id: `vence-${t.tarjetaId || t.nombre}`,
          tipo: 'vencimiento', prioridad: 'alta', titulo: `${t.nombre} vence pronto`,
          mensaje: `Faltan ${diasVencimiento} día(s) para el vencimiento y el pago mínimo es ${moneda(t.pagoMinimo)}.`,
          accion: 'Separa el importe del pago antes de realizar nuevas compras.', entidad: t.nombre
        }));
      }

      if (t.utilizacion >= config.umbralUsoAlto) {
        insights.push(crearInsight({
          id: `uso-alto-${t.tarjetaId || t.nombre}`,
          tipo: 'utilizacion', prioridad: t.utilizacion >= 90 ? 'critica' : 'alta', titulo: `Uso elevado en ${t.nombre}`,
          mensaje: `La utilización aproximada es ${redondear(t.utilizacion)} % con una deuda de ${moneda(t.deuda)}.`,
          accion: 'Evita nuevas compras y dirige pagos adicionales a esta tarjeta.', entidad: t.nombre,
          metrica: redondear(t.utilizacion)
        }));
      } else if (t.utilizacion >= config.umbralUsoMedio) {
        insights.push(crearInsight({
          id: `uso-medio-${t.tarjetaId || t.nombre}`,
          tipo: 'utilizacion', prioridad: 'media', titulo: `${t.nombre} supera la mitad de su línea`,
          mensaje: `La utilización aproximada es ${redondear(t.utilizacion)} %.`,
          accion: 'Controla las compras posteriores al cierre para evitar que el uso siga aumentando.', entidad: t.nombre
        }));
      }
    });

    const deudaTotal = tarjetas.reduce((s, t) => s + numero(t.deuda), 0);
    const lineaTotal = tarjetas.reduce((s, t) => s + numero(t.lineaTotal), 0);
    const usoGlobal = lineaTotal > 0 ? deudaTotal / lineaTotal * 100 : 0;
    if (usoGlobal >= 70) {
      insights.push(crearInsight({
        id: 'uso-global-alto', tipo: 'endeudamiento', prioridad: 'alta', titulo: 'Endeudamiento global elevado',
        mensaje: `Estás utilizando aproximadamente ${redondear(usoGlobal)} % de la línea total disponible.`,
        accion: 'Prioriza reducir saldos antes de asumir nuevas cuotas.', metrica: redondear(usoGlobal)
      }));
    }

    return insights;
  }

  function extraerPuntos(proyeccion) {
    return proyeccion?.puntos || proyeccion?.timeline || proyeccion?.lineaTiempo || [];
  }

  function insightsFlujo(proyeccion, config) {
    const insights = [];
    if (!proyeccion) return insights;
    const puntos = extraerPuntos(proyeccion);
    const negativo = puntos.find(p => numero(p.saldo) < 0 || p.negativo);
    const bajoColchon = puntos.find(p => numero(p.saldo) < config.colchonMinimo || p.bajoColchon || p.bajoColchonMinimo);
    const saldoFinal = numero(proyeccion.saldoFinal ?? puntos.at(-1)?.saldo);
    const saldoMinimo = numero(proyeccion.saldoMinimo ?? Math.min(...puntos.map(p => numero(p.saldo)), saldoFinal));

    if (negativo) {
      insights.push(crearInsight({
        id: 'flujo-negativo', tipo: 'liquidez', prioridad: 'critica', titulo: 'Riesgo de saldo negativo',
        mensaje: `La proyección cae por debajo de cero el ${negativo.fecha || negativo.dia || 'periodo proyectado'}.`,
        accion: 'Reduce gastos planificados o mueve pagos no urgentes antes de esa fecha.', entidad: negativo.fecha || null
      }));
    } else if (bajoColchon) {
      insights.push(crearInsight({
        id: 'flujo-bajo-colchon', tipo: 'liquidez', prioridad: 'alta', titulo: 'El colchón de seguridad se verá afectado',
        mensaje: `El saldo proyectado baja a ${moneda(bajoColchon.saldo)} el ${bajoColchon.fecha || bajoColchon.dia || 'periodo proyectado'}.`,
        accion: 'Reserva ingresos próximos y evita compras discrecionales hasta recuperar el colchón.'
      }));
    } else if (saldoFinal > config.colchonMinimo && saldoMinimo >= config.colchonMinimo) {
      insights.push(crearInsight({
        id: 'flujo-estable', tipo: 'liquidez', prioridad: 'baja', titulo: 'Liquidez estable en el horizonte analizado',
        mensaje: `El saldo final estimado es ${moneda(saldoFinal)} y el mínimo sería ${moneda(saldoMinimo)}.`,
        accion: 'El excedente sobre el colchón puede destinarse a ahorro o reducción de deuda.'
      }));
    }

    return insights;
  }

  function insightsPresupuesto(tarjetas, config) {
    const minimos = tarjetas.reduce((s, t) => s + numero(t.pagoMinimo), 0);
    if (minimos <= 0) return [];
    const cobertura = config.presupuestoDisponible / minimos;
    if (cobertura < 1) {
      return [crearInsight({
        id: 'presupuesto-insuficiente', tipo: 'presupuesto', prioridad: 'critica', titulo: 'El presupuesto no cubre los pagos mínimos',
        mensaje: `Faltan ${moneda(minimos - config.presupuestoDisponible)} para cubrir un total mínimo de ${moneda(minimos)}.`,
        accion: 'Revisa pagos ya realizados, reduce gastos y contacta al banco antes del vencimiento.', metrica: redondear(cobertura)
      })];
    }
    if (cobertura >= 1.2) {
      return [crearInsight({
        id: 'presupuesto-excedente', tipo: 'presupuesto', prioridad: 'baja', titulo: 'Hay margen para un pago adicional',
        mensaje: `Después de cubrir los mínimos quedarían ${moneda(config.presupuestoDisponible - minimos)} disponibles.`,
        accion: 'Aplica el excedente a la tarjeta con mayor tasa o mayor utilización.', metrica: redondear(cobertura)
      })];
    }
    return [];
  }

  async function generarInsights(opciones = {}) {
    if (!window.HFModeloFinanciero) throw new Error('El modelo financiero no está disponible.');
    const config = { ...obtenerConfiguracion(), ...opciones };
    guardarConfiguracion(config);
    const global = await HFModeloFinanciero.obtenerResumenGlobal();
    const tarjetas = normalizarTarjetas(global);
    let proyeccion = null;

    if (window.HFMotorFlujoCajaPredictivo) {
      try {
        const movimientos = leerJSON('hf_movimientos_planificados', []);
        let recurrentes = [];
        for (const clave of ['hf_recurrentes', 'recurrentes', 'hf_gastos_recurrentes']) {
          const valor = leerJSON(clave, null);
          if (Array.isArray(valor)) { recurrentes = valor; break; }
        }
        proyeccion = await HFMotorFlujoCajaPredictivo.proyectarDesdeModelo({
          saldoInicial: config.saldoInicial,
          colchónMinimo: config.colchonMinimo,
          colchonMinimo: config.colchonMinimo,
          dias: config.horizonte,
          movimientos,
          recurrentes
        });
      } catch (error) {
        console.warn('No se pudo calcular el flujo para los insights.', error);
      }
    }

    const insights = [
      ...insightsTarjetas(tarjetas, config),
      ...insightsPresupuesto(tarjetas, config),
      ...insightsFlujo(proyeccion, config)
    ].sort((a, b) => prioridadValor(b.prioridad) - prioridadValor(a.prioridad));

    const resultado = {
      insights,
      resumen: {
        total: insights.length,
        criticos: insights.filter(i => i.prioridad === 'critica').length,
        altos: insights.filter(i => i.prioridad === 'alta').length,
        deudaTotal: redondear(tarjetas.reduce((s, t) => s + numero(t.deuda), 0)),
        pagoMinimoTotal: redondear(tarjetas.reduce((s, t) => s + numero(t.pagoMinimo), 0))
      },
      config,
      proyeccion,
      generadoEn: new Date().toISOString(),
      version: '12.3.1'
    };

    localStorage.setItem(CLAVE_ULTIMO, JSON.stringify(resultado));
    window.dispatchEvent(new CustomEvent('hf:insights-financieros', { detail: resultado }));
    return resultado;
  }

  function inyectarEstilos() {
    if ($('hf-insights-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-insights-styles';
    style.textContent = `
      .hf-insights-panel{margin-bottom:18px}
      .hf-insights-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
      .hf-insights-config{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}
      .hf-insights-config label{display:flex;flex-direction:column;gap:6px;font-size:.78rem}
      .hf-insights-config input,.hf-insights-config select{width:100%;box-sizing:border-box}
      .hf-insights-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}
      .hf-insights-kpi{padding:12px;border-radius:14px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.13)}
      .hf-insights-kpi span{display:block;font-size:.72rem;opacity:.66}.hf-insights-kpi strong{display:block;margin-top:4px;font-size:1.1rem}
      .hf-insights-list{display:grid;gap:10px;margin-top:14px}
      .hf-insight-card{padding:13px 14px;border-radius:15px;border:1px solid rgba(148,163,184,.14);background:rgba(148,163,184,.055)}
      .hf-insight-card.critica{border-left:4px solid #ef4444}.hf-insight-card.alta{border-left:4px solid #f59e0b}.hf-insight-card.media{border-left:4px solid #3b82f6}.hf-insight-card.baja{border-left:4px solid #22c55e}
      .hf-insight-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.hf-insight-title{font-weight:800}.hf-insight-priority{font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;opacity:.65}
      .hf-insight-message{margin-top:5px;line-height:1.42}.hf-insight-action{margin-top:7px;font-size:.78rem;opacity:.78}
      .hf-insights-empty{padding:18px;text-align:center;opacity:.68}
      @media(max-width:820px){.hf-insights-config,.hf-insights-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){.hf-insights-config,.hf-insights-kpis{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function inyectarPanel() {
    if ($('hf-insights-financieros')) return;
    const pagina = $('page-deudas');
    if (!pagina) return;
    const config = obtenerConfiguracion();
    const panel = document.createElement('section');
    panel.id = 'hf-insights-financieros';
    panel.className = 'section hf-insights-panel';
    panel.innerHTML = `
      <div class="hf-insights-head">
        <div><div class="section-title">Insights financieros automáticos</div><div class="hf-debt-subtitle">Alertas y oportunidades calculadas con tus datos actuales.</div></div>
        <button class="btn-recurrentes" id="hf-insights-refresh" type="button">Analizar ahora</button>
      </div>
      <div class="hf-insights-config">
        <label>Saldo disponible<input id="hf-insights-saldo" type="number" min="0" step="10" value="${config.saldoInicial || ''}"></label>
        <label>Colchón mínimo<input id="hf-insights-colchon" type="number" min="0" step="10" value="${config.colchonMinimo || ''}"></label>
        <label>Presupuesto para pagos<input id="hf-insights-presupuesto" type="number" min="0" step="10" value="${config.presupuestoDisponible || ''}"></label>
        <label>Horizonte<select id="hf-insights-horizonte"><option value="30">30 días</option><option value="60">60 días</option><option value="90">90 días</option></select></label>
      </div>
      <div class="hf-insights-kpis" id="hf-insights-kpis"></div>
      <div class="hf-insights-list" id="hf-insights-list"><div class="hf-insights-empty">Analizando tu situación financiera…</div></div>
    `;
    const referencia = $('hf-chat-financiero') || $('hf-calendario-financiero');
    if (referencia?.nextSibling) pagina.insertBefore(panel, referencia.nextSibling);
    else pagina.appendChild(panel);
    $('hf-insights-horizonte').value = String(config.horizonte || 30);
    $('hf-insights-refresh').addEventListener('click', actualizarPanel);
    ['hf-insights-saldo','hf-insights-colchon','hf-insights-presupuesto','hf-insights-horizonte'].forEach(id => $(id)?.addEventListener('change', () => guardarConfiguracion(obtenerConfiguracion())));
  }

  function escapar(texto = '') {
    return String(texto).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function renderResultado(resultado) {
    const kpis = $('hf-insights-kpis');
    const lista = $('hf-insights-list');
    if (!kpis || !lista) return;
    kpis.innerHTML = `
      <div class="hf-insights-kpi"><span>Insights</span><strong>${resultado.resumen.total}</strong></div>
      <div class="hf-insights-kpi"><span>Críticos</span><strong>${resultado.resumen.criticos}</strong></div>
      <div class="hf-insights-kpi"><span>Deuda estimada</span><strong>${moneda(resultado.resumen.deudaTotal)}</strong></div>
      <div class="hf-insights-kpi"><span>Pagos mínimos</span><strong>${moneda(resultado.resumen.pagoMinimoTotal)}</strong></div>`;
    if (!resultado.insights.length) {
      lista.innerHTML = '<div class="hf-insights-empty">No se detectaron alertas importantes con la información disponible.</div>';
      return;
    }
    lista.innerHTML = resultado.insights.map(i => `
      <article class="hf-insight-card ${escapar(i.prioridad)}">
        <div class="hf-insight-top"><div class="hf-insight-title">${escapar(i.titulo)}</div><div class="hf-insight-priority">${escapar(i.prioridad)}</div></div>
        <div class="hf-insight-message">${escapar(i.mensaje)}</div>
        ${i.accion ? `<div class="hf-insight-action"><strong>Acción sugerida:</strong> ${escapar(i.accion)}</div>` : ''}
      </article>`).join('');
  }

  async function actualizarPanel() {
    if (calculando) return;
    calculando = true;
    const boton = $('hf-insights-refresh');
    if (boton) { boton.disabled = true; boton.textContent = 'Analizando…'; }
    try {
      const resultado = await generarInsights();
      renderResultado(resultado);
    } catch (error) {
      console.error('No se pudieron generar insights financieros.', error);
      const lista = $('hf-insights-list');
      if (lista) lista.innerHTML = `<div class="hf-insights-empty">${escapar(error.message || 'No se pudo completar el análisis.')}</div>`;
    } finally {
      calculando = false;
      if (boton) { boton.disabled = false; boton.textContent = 'Analizar ahora'; }
    }
  }

  function iniciar() {
    inyectarEstilos();
    inyectarPanel();
    setTimeout(actualizarPanel, 250);
  }

  ['hf:deuda-actualizada','hf:deudas-recalculadas','hf:flujo-caja-proyectado','hf:importacion-confirmada','hf:sincronizacion-financiera-completada'].forEach(evento => {
    window.addEventListener(evento, () => setTimeout(actualizarPanel, 200));
  });
  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 1200));
  setTimeout(iniciar, 2200);

  window.HFInsightsFinancierosAutomaticos = Object.freeze({
    generarInsights,
    actualizarPanel,
    obtenerConfiguracion,
    normalizarTarjetas,
    insightsTarjetas,
    insightsPresupuesto,
    insightsFlujo
  });
})();
/* Hogar Finanzas — Etapa 12.0.2: centro de inteligencia financiera */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const numero = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const moneda = value => `S/ ${numero(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let ultimoDiagnostico = null;

  function inyectarEstilos() {
    if ($('hf-inteligencia-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-inteligencia-styles';
    style.textContent = `
      .hf-intelligence-center{margin-bottom:18px}
      .hf-intelligence-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
      .hf-intelligence-controls{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-top:14px}
      .hf-intelligence-controls label{display:flex;flex-direction:column;gap:6px;font-size:.8rem;min-width:150px}
      .hf-intelligence-controls input{width:100%;box-sizing:border-box}
      .hf-intelligence-summary{display:grid;grid-template-columns:1.15fr repeat(4,1fr);gap:12px;margin-top:16px}
      .hf-score-card,.hf-intelligence-kpi{border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:16px;background:rgba(148,163,184,.08)}
      .hf-score-card{display:flex;align-items:center;gap:16px}
      .hf-score-ring{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--hf-score-color,#22c55e) calc(var(--hf-score,0)*1%),rgba(148,163,184,.18) 0)}
      .hf-score-ring::before{content:'';width:62px;height:62px;border-radius:50%;background:var(--card-bg,#fff);position:absolute}
      .hf-score-ring strong{position:relative;font-size:1.4rem}
      .hf-score-card small,.hf-intelligence-kpi small{display:block;opacity:.7}.hf-intelligence-kpi strong{display:block;font-size:1.2rem;margin-top:5px}
      .hf-intelligence-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px;margin-top:14px}
      .hf-intelligence-block{border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:16px;background:rgba(148,163,184,.05)}
      .hf-action-list,.hf-card-advice-list{display:grid;gap:9px;margin-top:12px}
      .hf-action-item{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-radius:14px;background:rgba(148,163,184,.08)}
      .hf-action-item.critical{background:rgba(239,68,68,.12)}.hf-action-item.high{background:rgba(245,158,11,.13)}
      .hf-action-badge{font-size:.72rem;font-weight:700;padding:3px 7px;border-radius:999px;background:rgba(148,163,184,.18);white-space:nowrap}
      .hf-plan-table{width:100%;border-collapse:collapse;margin-top:12px;font-size:.84rem}.hf-plan-table th,.hf-plan-table td{padding:8px;border-bottom:1px solid rgba(148,163,184,.16);text-align:left}
      .hf-purchase-result{margin-top:12px;padding:12px;border-radius:14px;background:rgba(34,197,94,.1)}
      .hf-purchase-result.invalid{background:rgba(239,68,68,.1)}
      .hf-intelligence-empty{padding:18px;text-align:center;opacity:.7}
      @media(max-width:900px){.hf-intelligence-summary{grid-template-columns:1fr 1fr}.hf-score-card{grid-column:1/-1}.hf-intelligence-grid{grid-template-columns:1fr}}
      @media(max-width:520px){.hf-intelligence-summary{grid-template-columns:1fr}.hf-score-card{grid-column:auto}.hf-intelligence-controls{display:grid;grid-template-columns:1fr}.hf-intelligence-controls label{min-width:0}}
    `;
    document.head.appendChild(style);
  }

  function inyectarPanel() {
    if ($('hf-centro-inteligencia')) return;
    const pagina = $('page-deudas');
    if (!pagina) return;
    const primera = pagina.querySelector('.section');
    const panel = document.createElement('section');
    panel.id = 'hf-centro-inteligencia';
    panel.className = 'section hf-intelligence-center';
    panel.innerHTML = `
      <div class="hf-intelligence-head">
        <div>
          <div class="section-title">Centro de inteligencia financiera</div>
          <div class="hf-debt-subtitle">Diagnóstico, prioridades y decisiones recomendadas para tus tarjetas.</div>
        </div>
        <button class="btn-recurrentes" id="hf-intelligence-refresh" type="button">Actualizar diagnóstico</button>
      </div>
      <div class="hf-intelligence-controls">
        <label>Presupuesto mensual para tarjetas<input id="hf-intelligence-budget" type="number" min="0" step="10" placeholder="Ej. 1500"></label>
        <label>Compra que deseas evaluar<input id="hf-intelligence-purchase" type="number" min="0" step="10" placeholder="Ej. 300"></label>
        <button class="btn-recurrentes secondary" id="hf-intelligence-analyze" type="button">Analizar escenario</button>
      </div>
      <div id="hf-intelligence-content" class="hf-intelligence-empty">Ingresa tu presupuesto mensual para generar un diagnóstico completo.</div>
    `;
    if (primera) pagina.insertBefore(panel, primera);
    else pagina.appendChild(panel);

    $('hf-intelligence-refresh').addEventListener('click', analizar);
    $('hf-intelligence-analyze').addEventListener('click', analizar);
  }

  function colorScore(nivel) {
    return nivel === 'saludable' ? '#22c55e' : nivel === 'estable' ? '#3b82f6' : nivel === 'riesgo' ? '#f59e0b' : '#ef4444';
  }

  function prioridadClase(prioridad) {
    if (prioridad >= 90) return 'critical';
    if (prioridad >= 70) return 'high';
    return '';
  }

  function etiquetaEstrategia(valor) {
    return ({ avalancha: 'Avalancha', 'bola-nieve': 'Bola de nieve', hibrida: 'Híbrida' })[valor] || valor || '—';
  }

  function render(diagnostico) {
    ultimoDiagnostico = diagnostico;
    const contenedor = $('hf-intelligence-content');
    if (!contenedor) return;
    const { salud, resumen, acciones, recomendacionCompra, planPagos } = diagnostico;
    const mejorPlan = planPagos?.resultados?.find(r => r.estrategia === planPagos.mejorEstrategia) || null;
    const accionesHtml = acciones.length ? acciones.slice(0, 8).map(a => `
      <div class="hf-action-item ${prioridadClase(a.prioridad)}">
        <span class="hf-action-badge">${a.prioridad >= 90 ? 'Urgente' : a.prioridad >= 70 ? 'Importante' : 'Sugerencia'}</span>
        <div><strong>${a.tarjetaNombre || 'Finanzas del hogar'}</strong><div>${a.mensaje}</div></div>
      </div>`).join('') : '<div class="hf-intelligence-empty">No hay acciones urgentes.</div>';

    const planHtml = mejorPlan ? `
      <div><strong>${etiquetaEstrategia(mejorPlan.estrategia)}</strong> es la estrategia recomendada.</div>
      <table class="hf-plan-table">
        <tr><th>Duración</th><td>${mejorPlan.meses} meses</td></tr>
        <tr><th>Intereses estimados</th><td>${moneda(mejorPlan.interesesTotales)}</td></tr>
        <tr><th>Pago mensual</th><td>${moneda(mejorPlan.presupuesto)}</td></tr>
        <tr><th>Primera prioridad</th><td>${mejorPlan.orden?.[0] || '—'}</td></tr>
      </table>` : '<div class="hf-intelligence-empty">Añade un presupuesto suficiente para generar el plan óptimo.</div>';

    let compraHtml = '<div class="hf-intelligence-empty">Ingresa un monto para evaluar qué tarjeta conviene usar.</div>';
    if (recomendacionCompra) {
      compraHtml = recomendacionCompra.viable ? `
        <div class="hf-purchase-result">
          <strong>${recomendacionCompra.tarjeta.nombre}</strong>
          <div>${recomendacionCompra.motivo}</div>
          <small>Disponible: ${moneda(recomendacionCompra.tarjeta.disponible)} · Uso posterior: ${recomendacionCompra.tarjeta.usoPosterior}%</small>
        </div>` : `<div class="hf-purchase-result invalid"><strong>No recomendable</strong><div>${recomendacionCompra.motivo}</div></div>`;
    }

    contenedor.className = '';
    contenedor.innerHTML = `
      <div class="hf-intelligence-summary">
        <div class="hf-score-card">
          <div class="hf-score-ring" style="--hf-score:${salud.score};--hf-score-color:${colorScore(salud.nivel)}"><strong>${salud.score}</strong></div>
          <div><small>Salud financiera</small><strong style="text-transform:capitalize">${salud.nivel}</strong><small>Score interno sobre 100</small></div>
        </div>
        <div class="hf-intelligence-kpi"><small>Deuda total</small><strong>${moneda(resumen.deudaTotal)}</strong></div>
        <div class="hf-intelligence-kpi"><small>Pago mínimo total</small><strong>${moneda(resumen.pagoMinimoTotal)}</strong></div>
        <div class="hf-intelligence-kpi"><small>Uso global</small><strong>${resumen.utilizacionPromedio.toFixed(1)}%</strong></div>
        <div class="hf-intelligence-kpi"><small>Vencimientos críticos</small><strong>${resumen.vencidas + resumen.proximasAVencer}</strong></div>
      </div>
      <div class="hf-intelligence-grid">
        <div class="hf-intelligence-block">
          <div class="hf-card-title">Acciones prioritarias</div>
          <div class="hf-action-list">${accionesHtml}</div>
        </div>
        <div class="hf-intelligence-block">
          <div class="hf-card-title">Plan óptimo de pagos</div>
          <div style="margin-top:12px">${planHtml}</div>
        </div>
        <div class="hf-intelligence-block">
          <div class="hf-card-title">Mejor tarjeta para la compra</div>
          ${compraHtml}
        </div>
        <div class="hf-intelligence-block">
          <div class="hf-card-title">Lectura rápida</div>
          <div class="hf-card-advice-list">
            <div>Presupuesto indicado: <strong>${moneda(resumen.presupuestoDisponible)}</strong></div>
            <div>Cobertura de mínimos: <strong>${resumen.pagoMinimoTotal ? (resumen.presupuestoDisponible / resumen.pagoMinimoTotal).toFixed(2) : '—'}x</strong></div>
            <div>Tarjetas vencidas: <strong>${resumen.vencidas}</strong></div>
            <div>Próximas a vencer: <strong>${resumen.proximasAVencer}</strong></div>
          </div>
        </div>
      </div>
    `;
  }

  async function analizar() {
    const contenedor = $('hf-intelligence-content');
    if (!window.HFAsistenteFinanciero) {
      if (contenedor) contenedor.textContent = 'El asistente financiero todavía no está disponible.';
      return;
    }
    const presupuestoDisponible = numero($('hf-intelligence-budget')?.value);
    const montoCompra = numero($('hf-intelligence-purchase')?.value);
    if (contenedor) {
      contenedor.className = 'hf-intelligence-empty';
      contenedor.textContent = 'Analizando tu situación financiera…';
    }
    try {
      const diagnostico = await HFAsistenteFinanciero.analizarSituacion({ presupuestoDisponible, montoCompra });
      render(diagnostico);
    } catch (error) {
      console.error(error);
      if (contenedor) contenedor.textContent = error.message || 'No se pudo generar el diagnóstico.';
    }
  }

  function iniciar() {
    inyectarEstilos();
    inyectarPanel();
  }

  window.addEventListener('hf:diagnostico-financiero', event => event.detail && render(event.detail));
  window.addEventListener('hf:deuda-actualizada', () => ultimoDiagnostico && analizar());
  window.addEventListener('hf:deudas-recalculadas', () => ultimoDiagnostico && analizar());
  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 800));
  setTimeout(iniciar, 1400);

  window.HFCentroInteligenciaFinanciera = Object.freeze({ iniciar, analizar, render });
})();
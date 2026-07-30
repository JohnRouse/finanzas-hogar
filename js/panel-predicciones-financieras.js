/* Hogar Finanzas — Etapa 11.5.2: panel interactivo de predicciones */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let grafico = null;
  let tarjetas = [];

  function toast(mensaje) {
    if (typeof window.showToast === 'function') window.showToast(mensaje);
    else console.info(mensaje);
  }

  function inyectarEstilos() {
    if ($('hf-predicciones-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-predicciones-styles';
    style.textContent = `
      .hf-predict-panel{margin-top:18px}
      .hf-predict-grid{display:grid;grid-template-columns:1.2fr .8fr .8fr .8fr;gap:12px;margin-top:14px}
      .hf-predict-grid label{display:flex;flex-direction:column;gap:6px;font-size:.82rem}
      .hf-predict-grid input,.hf-predict-grid select{width:100%;box-sizing:border-box}
      .hf-predict-results{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}
      .hf-predict-result{padding:14px;border-radius:16px;background:rgba(148,163,184,.1);border:1px solid rgba(148,163,184,.18)}
      .hf-predict-result span,.hf-predict-result small{display:block;opacity:.72}.hf-predict-result strong{display:block;font-size:1.25rem;margin:.25rem 0}
      .hf-predict-risk{margin-top:14px;padding:13px 14px;border-radius:14px;background:rgba(34,197,94,.1)}
      .hf-predict-risk.medio{background:rgba(245,158,11,.13)}.hf-predict-risk.alto,.hf-predict-risk.critico{background:rgba(239,68,68,.13)}
      .hf-predict-chart{height:280px;margin-top:16px}
      .hf-predict-empty{padding:18px;text-align:center;opacity:.7}
      @media(max-width:760px){.hf-predict-grid,.hf-predict-results{grid-template-columns:1fr 1fr}.hf-predict-chart{height:240px}}
      @media(max-width:480px){.hf-predict-grid,.hf-predict-results{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function inyectarPanel() {
    if ($('hf-panel-predicciones')) return;
    const centro = $('hf-centro-tarjetas');
    if (!centro) return;
    const seccion = document.createElement('div');
    seccion.id = 'hf-panel-predicciones';
    seccion.className = 'card hf-predict-panel';
    seccion.innerHTML = `
      <div class="hf-chart-title-row">
        <div>
          <div class="hf-card-title">Simulador de deuda y próximos cierres</div>
          <small>Prueba cuánto tardarías en pagar y cómo evolucionaría el saldo.</small>
        </div>
      </div>
      <div class="hf-predict-grid">
        <label>Tarjeta<select id="hf-predict-card"></select></label>
        <label>Pago mensual<input id="hf-predict-payment" type="number" min="0" step="10" placeholder="500"></label>
        <label>TEA estimada (%)<input id="hf-predict-tea" type="number" min="0" step="0.1" placeholder="65"></label>
        <label>Próximo cierre<input id="hf-predict-close" type="date"></label>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
        <button class="btn-recurrentes" id="hf-predict-run" type="button">Calcular escenario</button>
        <button class="btn-recurrentes secondary" id="hf-predict-minimum" type="button">Usar pago mínimo</button>
      </div>
      <div id="hf-predict-output" class="hf-predict-empty">Selecciona una tarjeta y calcula un escenario.</div>
      <div class="hf-predict-chart"><canvas id="hf-predict-chart"></canvas></div>
    `;
    const desglose = $('hf-card-breakdown');
    if (desglose) centro.insertBefore(seccion, desglose);
    else centro.appendChild(seccion);

    $('hf-predict-run').addEventListener('click', calcular);
    $('hf-predict-minimum').addEventListener('click', usarMinimo);
    $('hf-predict-card').addEventListener('change', cargarValoresTarjeta);
  }

  async function cargarTarjetas() {
    if (!window.HFModeloFinanciero) return;
    const global = await HFModeloFinanciero.obtenerResumenGlobal();
    tarjetas = global.tarjetas || [];
    const select = $('hf-predict-card');
    if (!select) return;
    select.innerHTML = '<option value="">Selecciona una tarjeta</option>' + tarjetas.map(t => `<option value="${t.tarjetaId}">${String(t.tarjetaNombre || 'Tarjeta')}</option>`).join('');
  }

  function tarjetaActual() {
    return tarjetas.find(t => t.tarjetaId === $('hf-predict-card')?.value) || null;
  }

  function cargarValoresTarjeta() {
    const tarjeta = tarjetaActual();
    if (!tarjeta) return;
    $('hf-predict-payment').value = tarjeta.pagoMinimo || '';
    $('hf-predict-close').value = '';
  }

  function usarMinimo() {
    const tarjeta = tarjetaActual();
    if (!tarjeta) return toast('Selecciona una tarjeta.');
    $('hf-predict-payment').value = tarjeta.pagoMinimo || 0;
    calcular();
  }

  function renderGrafico(cronograma) {
    const canvas = $('hf-predict-chart');
    if (!canvas || !window.Chart) return;
    if (grafico) grafico.destroy();
    const datos = (cronograma || []).slice(0, 60);
    grafico = new Chart(canvas, {
      type: 'line',
      data: {
        labels: datos.map(x => `Mes ${x.mes}`),
        datasets: [{ label: 'Saldo estimado', data: datos.map(x => x.saldo), tension: .25, fill: false }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  async function calcular() {
    const tarjetaId = $('hf-predict-card')?.value;
    if (!tarjetaId) return toast('Selecciona una tarjeta.');
    const pagoMensual = numero($('hf-predict-payment')?.value);
    const tea = numero($('hf-predict-tea')?.value);
    const fechaObjetivo = $('hf-predict-close')?.value || '';
    const salida = $('hf-predict-output');
    salida.className = 'hf-predict-empty';
    salida.textContent = 'Calculando escenario…';

    try {
      const resultado = await HFMotorPredictivoFinanciero.proyectarTarjeta(tarjetaId, { pagoMensual, tea, fechaObjetivo });
      const amort = resultado.amortizacion;
      const riesgo = resultado.riesgo;
      const proy = resultado.proyeccionCierre;
      const mesesTexto = amort.viable ? `${amort.meses} meses` : 'Pago insuficiente';
      const interesTexto = amort.viable ? moneda(amort.interesesTotales) : '—';
      salida.className = '';
      salida.innerHTML = `
        <div class="hf-predict-results">
          <div class="hf-predict-result"><span>Deuda actual</span><strong>${moneda(resultado.resumenActual.deudaEstimada)}</strong><small>Saldo estimado hoy</small></div>
          <div class="hf-predict-result"><span>Tiempo para pagar</span><strong>${mesesTexto}</strong><small>Con ${moneda(pagoMensual)} al mes</small></div>
          <div class="hf-predict-result"><span>Intereses estimados</span><strong>${interesTexto}</strong><small>Con TEA de ${tea || 0}%</small></div>
          <div class="hf-predict-result"><span>Próximo cierre</span><strong>${moneda(proy.deudaProyectada)}</strong><small>Uso proyectado: ${proy.utilizacionProyectada.toFixed(1)}%</small></div>
        </div>
        <div class="hf-predict-risk ${riesgo.nivel}"><strong>Riesgo: ${String(riesgo.nivel).toUpperCase()}</strong>${riesgo.alertas.length ? `<div style="margin-top:6px">${riesgo.alertas.map(a => a.mensaje).join('<br>')}</div>` : '<div style="margin-top:6px">No se detectaron alertas relevantes.</div>'}</div>
      `;
      renderGrafico(amort.cronograma);
    } catch (error) {
      console.error(error);
      salida.className = 'hf-predict-empty';
      salida.textContent = error.message || 'No se pudo calcular el escenario.';
    }
  }

  async function iniciar() {
    inyectarEstilos();
    inyectarPanel();
    await cargarTarjetas();
  }

  window.addEventListener('hf:deuda-actualizada', cargarTarjetas);
  window.addEventListener('hf:deudas-recalculadas', cargarTarjetas);
  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 700));
  setTimeout(iniciar, 1200);

  window.HFPanelPrediccionesFinancieras = Object.freeze({ iniciar, calcular, cargarTarjetas });
})();
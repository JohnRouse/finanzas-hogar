/* Hogar Finanzas — Recuperación: Centro financiero separado del control de deudas */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let tarjetas = [];
  let grafico = null;

  function toast(mensaje) {
    if (typeof window.showToast === 'function') window.showToast(mensaje);
    else console.info(mensaje);
  }

  function crearLanzador(pagina, texto) {
    if (!pagina || pagina.querySelector('[data-hf-finance-launcher]')) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'hf-finance-launcher';
    boton.dataset.hfFinanceLauncher = 'true';
    boton.textContent = texto;
    boton.addEventListener('click', abrirCentroFinanciero);
    pagina.appendChild(boton);
  }

  function inyectarLanzadores() {
    crearLanzador($('page-deudas'), 'Abrir Centro financiero');
    crearLanzador($('page-resumen'), 'Analizar y planificar mis finanzas');
  }

  function inyectarModal() {
    if ($('hfCentroFinancieroModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfCentroFinancieroModal" onclick="closeModalOutside(event,'hfCentroFinancieroModal')">
        <div class="modal-sheet hf-finance-center-sheet" style="position:relative">
          <button class="modal-close" type="button" onclick="closeModal('hfCentroFinancieroModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="modal-title">Centro financiero</div>
          <p class="hf-finance-intro">Este espacio reúne simulaciones y planes. No modifica tus tarjetas ni préstamos; solo analiza los datos registrados.</p>

          <div class="hf-finance-tabs" role="tablist">
            <button class="hf-finance-tab active" type="button" data-hf-finance-tab="simulador">Simular tarjeta</button>
            <button class="hf-finance-tab" type="button" data-hf-finance-tab="plan">Plan de pagos</button>
          </div>

          <section class="hf-finance-panel active" data-hf-finance-panel="simulador">
            <div class="hf-finance-card">
              <h3>¿Cuánto tardaría en pagar?</h3>
              <p>Calcula un escenario usando la deuda estimada de una tarjeta, un pago mensual y una TEA referencial.</p>
              <div class="hf-finance-form">
                <label class="wide">Tarjeta<select id="hf-finance-card"><option value="">Selecciona una tarjeta</option></select></label>
                <label>Pago mensual<input id="hf-finance-payment" type="number" min="0" step="10" inputmode="decimal" placeholder="500"></label>
                <label>TEA referencial (%)<input id="hf-finance-tea" type="number" min="0" step="0.1" inputmode="decimal" placeholder="65"></label>
                <label class="wide">Fecha objetivo para el próximo cierre<input id="hf-finance-close" type="date"></label>
              </div>
              <div class="hf-finance-actions">
                <button class="primary" id="hf-finance-run" type="button">Calcular escenario</button>
                <button class="secondary" id="hf-finance-minimum" type="button">Usar pago mínimo</button>
              </div>
              <div id="hf-finance-output" class="hf-finance-empty">Selecciona una tarjeta para comenzar.</div>
              <div class="hf-finance-chart"><canvas id="hf-finance-chart"></canvas></div>
            </div>
          </section>

          <section class="hf-finance-panel" data-hf-finance-panel="plan">
            <div class="hf-finance-card">
              <h3>Orden recomendado de pagos</h3>
              <p>Compara avalancha, bola de nieve y estrategia híbrida. El cálculo es orientativo y no realiza pagos.</p>
              <div class="hf-finance-form">
                <label>Presupuesto mensual para tarjetas<input id="hf-plan-budget" type="number" min="0" step="10" inputmode="decimal" placeholder="1000"></label>
                <label>TEA referencial general (%)<input id="hf-plan-tea" type="number" min="0" step="0.1" inputmode="decimal" placeholder="65"></label>
              </div>
              <div class="hf-finance-actions"><button class="primary" id="hf-plan-run" type="button">Comparar estrategias</button></div>
              <div id="hf-plan-output" class="hf-finance-empty">Indica cuánto puedes destinar cada mes.</div>
            </div>
          </section>
        </div>
      </div>`);

    document.querySelectorAll('[data-hf-finance-tab]').forEach(btn => {
      btn.addEventListener('click', () => seleccionarTab(btn.dataset.hfFinanceTab));
    });
    $('hf-finance-run')?.addEventListener('click', calcularEscenario);
    $('hf-finance-minimum')?.addEventListener('click', usarMinimo);
    $('hf-finance-card')?.addEventListener('change', cargarValoresTarjeta);
    $('hf-plan-run')?.addEventListener('click', calcularPlan);
  }

  function seleccionarTab(tab) {
    document.querySelectorAll('[data-hf-finance-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.hfFinanceTab === tab));
    document.querySelectorAll('[data-hf-finance-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.hfFinancePanel === tab));
  }

  async function cargarTarjetas() {
    const select = $('hf-finance-card');
    if (!select) return [];
    try {
      if (!window.HFModeloFinanciero?.obtenerResumenGlobal) throw new Error('El modelo financiero todavía no está disponible.');
      const global = await HFModeloFinanciero.obtenerResumenGlobal();
      tarjetas = global.tarjetas || [];
      select.innerHTML = '<option value="">Selecciona una tarjeta</option>' + tarjetas.map(t => `<option value="${String(t.tarjetaId)}">${String(t.tarjetaNombre || 'Tarjeta')} · ${moneda(t.deudaEstimada)}</option>`).join('');
      if (!tarjetas.length) {
        $('hf-finance-output').className = 'hf-finance-empty';
        $('hf-finance-output').textContent = 'Registra una tarjeta y su saldo para utilizar las simulaciones.';
      }
      return tarjetas;
    } catch (error) {
      console.warn(error);
      select.innerHTML = '<option value="">No se pudieron cargar las tarjetas</option>';
      return [];
    }
  }

  function tarjetaActual() {
    return tarjetas.find(t => String(t.tarjetaId) === String($('hf-finance-card')?.value)) || null;
  }

  function cargarValoresTarjeta() {
    const tarjeta = tarjetaActual();
    if (!tarjeta) return;
    $('hf-finance-payment').value = tarjeta.pagoMinimo || '';
  }

  function usarMinimo() {
    const tarjeta = tarjetaActual();
    if (!tarjeta) return toast('Selecciona una tarjeta.');
    $('hf-finance-payment').value = tarjeta.pagoMinimo || 0;
    calcularEscenario();
  }

  function renderGrafico(cronograma = []) {
    const canvas = $('hf-finance-chart');
    if (!canvas || !window.Chart) return;
    if (grafico) grafico.destroy();
    const datos = cronograma.slice(0, 60);
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

  async function calcularEscenario() {
    const tarjetaId = $('hf-finance-card')?.value;
    if (!tarjetaId) return toast('Selecciona una tarjeta.');
    const pagoMensual = numero($('hf-finance-payment')?.value);
    const tea = numero($('hf-finance-tea')?.value);
    const fechaObjetivo = $('hf-finance-close')?.value || '';
    const salida = $('hf-finance-output');
    salida.className = 'hf-finance-empty';
    salida.textContent = 'Calculando escenario…';

    try {
      if (!window.HFMotorPredictivoFinanciero?.proyectarTarjeta) throw new Error('El simulador todavía no está disponible.');
      const resultado = await HFMotorPredictivoFinanciero.proyectarTarjeta(tarjetaId, { pagoMensual, tea, fechaObjetivo });
      const amort = resultado.amortizacion;
      const riesgo = resultado.riesgo;
      const proy = resultado.proyeccionCierre;
      salida.className = 'hf-finance-output';
      salida.innerHTML = `
        <div class="hf-finance-results">
          <div class="hf-finance-result"><span>Deuda actual</span><strong>${moneda(resultado.resumenActual.deudaEstimada)}</strong><small>Estimación registrada</small></div>
          <div class="hf-finance-result"><span>Tiempo para pagar</span><strong>${amort.viable ? `${amort.meses} meses` : 'Pago insuficiente'}</strong><small>Con ${moneda(pagoMensual)} al mes</small></div>
          <div class="hf-finance-result"><span>Intereses estimados</span><strong>${amort.viable ? moneda(amort.interesesTotales) : '—'}</strong><small>TEA referencial ${tea || 0}%</small></div>
          <div class="hf-finance-result"><span>Próximo cierre</span><strong>${moneda(proy.deudaProyectada)}</strong><small>Uso proyectado ${numero(proy.utilizacionProyectada).toFixed(1)}%</small></div>
        </div>
        <div class="hf-finance-risk ${riesgo.nivel}"><strong>Riesgo: ${String(riesgo.nivel).toUpperCase()}</strong><div>${riesgo.alertas.length ? riesgo.alertas.map(a => a.mensaje).join('<br>') : 'No se detectaron alertas relevantes.'}</div></div>`;
      renderGrafico(amort.cronograma || []);
    } catch (error) {
      console.error(error);
      salida.className = 'hf-finance-empty';
      salida.textContent = error.message || 'No se pudo calcular el escenario.';
    }
  }

  const etiquetaEstrategia = valor => ({ avalancha: 'Avalancha', 'bola-nieve': 'Bola de nieve', hibrida: 'Híbrida' }[valor] || valor);

  async function calcularPlan() {
    const presupuestoMensual = numero($('hf-plan-budget')?.value);
    const tea = numero($('hf-plan-tea')?.value);
    const salida = $('hf-plan-output');
    if (presupuestoMensual <= 0) return toast('Ingresa un presupuesto mensual.');
    salida.className = 'hf-finance-empty';
    salida.textContent = 'Comparando estrategias…';

    try {
      if (!window.HFOptimizadorPagos?.optimizarDesdeModelo) throw new Error('El optimizador todavía no está disponible.');
      const global = await HFModeloFinanciero.obtenerResumenGlobal();
      const tasas = Object.fromEntries((global.tarjetas || []).map(t => [t.tarjetaId, tea]));
      const resultado = await HFOptimizadorPagos.optimizarDesdeModelo({ presupuestoMensual, tasas });
      salida.className = 'hf-finance-output';
      salida.innerHTML = `
        <strong>${resultado.mejorEstrategia ? `Mejor opción: ${etiquetaEstrategia(resultado.mejorEstrategia)}` : 'El presupuesto no cubre todos los mínimos'}</strong>
        <div class="hf-strategy-list">${resultado.resultados.map(r => `
          <div class="hf-strategy-item ${r.estrategia === resultado.mejorEstrategia ? 'best' : ''}">
            <strong>${etiquetaEstrategia(r.estrategia)}</strong>
            <span>${r.viable ? `${r.meses} meses · intereses ${moneda(r.interesesTotales)}` : `No viable: los mínimos suman ${moneda(r.sumaMinimos)}`}</span>
          </div>`).join('')}</div>
        ${resultado.recomendaciones?.length ? `<div class="hf-finance-risk"><strong>Recomendación</strong><div>${resultado.recomendaciones.join('<br>')}</div></div>` : ''}`;
    } catch (error) {
      console.error(error);
      salida.className = 'hf-finance-empty';
      salida.textContent = error.message || 'No se pudo generar el plan.';
    }
  }

  async function abrirCentroFinanciero() {
    inyectarModal();
    await cargarTarjetas();
    if (typeof window.openModal === 'function') openModal('hfCentroFinancieroModal');
    else $('hfCentroFinancieroModal')?.classList.add('open');
  }

  function iniciar() {
    inyectarModal();
    inyectarLanzadores();
  }

  window.abrirCentroFinanciero = abrirCentroFinanciero;
  window.addEventListener('hf:deudas-core-actualizadas', cargarTarjetas);
  window.addEventListener('hf:deuda-actualizada', cargarTarjetas);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 350), { once: true });
  else setTimeout(iniciar, 100);

  window.HFPanelPrediccionesFinancieras = Object.freeze({ iniciar, abrir: abrirCentroFinanciero, cargarTarjetas, calcularEscenario, calcularPlan });
})();
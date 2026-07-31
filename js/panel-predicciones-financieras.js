/* Hogar Finanzas — Planificador de deudas claro y separado */
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

  function crearLanzador() {
    const pagina = $('page-deudas');
    if (!pagina || pagina.querySelector('[data-hf-finance-launcher]')) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'hf-finance-launcher';
    boton.dataset.hfFinanceLauncher = 'true';
    boton.innerHTML = '<strong>Planificar cómo pagar mis deudas</strong><small>Calcula una cuota o decide qué tarjeta priorizar</small>';
    boton.addEventListener('click', abrirPlanificador);
    pagina.appendChild(boton);
  }

  function inyectarModal() {
    if ($('hfCentroFinancieroModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfCentroFinancieroModal" onclick="closeModalOutside(event,'hfCentroFinancieroModal')">
        <div class="modal-sheet hf-finance-center-sheet" style="position:relative">
          <button class="modal-close" type="button" onclick="closeModal('hfCentroFinancieroModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="modal-title">Planificador de deudas</div>
          <p class="hf-finance-intro">Responde dos preguntas: cuánto tardarías en pagar una tarjeta y cuál conviene priorizar. Los cálculos son orientativos y no modifican tus datos.</p>

          <div class="hf-finance-tabs" role="tablist">
            <button class="hf-finance-tab active" type="button" data-hf-finance-tab="simulador">Calcular una tarjeta</button>
            <button class="hf-finance-tab" type="button" data-hf-finance-tab="plan">Ordenar mis tarjetas</button>
          </div>

          <section class="hf-finance-panel active" data-hf-finance-panel="simulador">
            <div class="hf-finance-card">
              <h3>¿En cuánto tiempo terminaría de pagarla?</h3>
              <p>Elige una tarjeta e indica cuánto podrías pagar cada mes. La TEA aparece en el estado de cuenta; si no la conoces, déjala en 0 para calcular sin intereses.</p>
              <div class="hf-finance-form">
                <label class="wide">Tarjeta<select id="hf-finance-card"><option value="">Selecciona una tarjeta</option></select></label>
                <label>Pago mensual<input id="hf-finance-payment" type="number" min="0" step="10" inputmode="decimal" placeholder="500"></label>
                <label>TEA de la tarjeta (%)<input id="hf-finance-tea" type="number" min="0" step="0.1" inputmode="decimal" value="0"></label>
              </div>
              <div class="hf-finance-actions">
                <button class="primary" id="hf-finance-run" type="button">Calcular tiempo y costo</button>
                <button class="secondary" id="hf-finance-minimum" type="button">Usar pago mínimo</button>
              </div>
              <div id="hf-finance-output" class="hf-finance-empty">Selecciona una tarjeta para comenzar.</div>
              <div class="hf-finance-chart"><canvas id="hf-finance-chart"></canvas></div>
            </div>
          </section>

          <section class="hf-finance-panel" data-hf-finance-panel="plan">
            <div class="hf-finance-card">
              <h3>¿Cuál tarjeta debería pagar primero?</h3>
              <p>Indica tu presupuesto total para tarjetas y, cuando la conozcas, la TEA de cada una. Si solo tienes una tarjeta o todas tienen la misma tasa, no habrá tres planes diferentes.</p>
              <div class="hf-finance-form"><label class="wide">Presupuesto mensual total<input id="hf-plan-budget" type="number" min="0" step="10" inputmode="decimal" placeholder="1000"></label></div>
              <div id="hf-plan-cards" class="hf-plan-cards"><div class="hf-finance-empty">Cargando tarjetas…</div></div>
              <div class="hf-finance-actions"><button class="primary" id="hf-plan-run" type="button">Crear mi plan</button></div>
              <div id="hf-plan-output" class="hf-finance-empty">Completa el presupuesto y revisa las tasas.</div>
            </div>
          </section>
        </div>
      </div>`);

    document.querySelectorAll('[data-hf-finance-tab]').forEach(btn => btn.addEventListener('click', () => seleccionarTab(btn.dataset.hfFinanceTab)));
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
      tarjetas = (global.tarjetas || []).filter(t => numero(t.deudaEstimada) > 0);
      select.innerHTML = '<option value="">Selecciona una tarjeta</option>' + tarjetas.map(t => `<option value="${String(t.tarjetaId)}">${String(t.tarjetaNombre || 'Tarjeta')} · debes ${moneda(t.deudaEstimada)}</option>`).join('');
      renderTarjetasPlan();
      if (!tarjetas.length) {
        $('hf-finance-output').className = 'hf-finance-empty';
        $('hf-finance-output').textContent = 'No hay tarjetas con deuda pendiente.';
      }
      return tarjetas;
    } catch (error) {
      console.warn(error);
      select.innerHTML = '<option value="">No se pudieron cargar las tarjetas</option>';
      $('hf-plan-cards').innerHTML = '<div class="hf-finance-empty">No se pudieron cargar las tarjetas.</div>';
      return [];
    }
  }

  function renderTarjetasPlan() {
    const contenedor = $('hf-plan-cards');
    if (!contenedor) return;
    if (!tarjetas.length) {
      contenedor.innerHTML = '<div class="hf-finance-empty">No hay tarjetas con deuda pendiente.</div>';
      return;
    }
    contenedor.innerHTML = tarjetas.map(t => `
      <div class="hf-plan-card-row" data-tarjeta-id="${String(t.tarjetaId)}">
        <div><strong>${String(t.tarjetaNombre || 'Tarjeta')}</strong><small>Deuda ${moneda(t.deudaEstimada)} · mínimo ${moneda(t.pagoMinimo)}</small></div>
        <label>TEA (%)<input class="hf-plan-card-tea" type="number" min="0" step="0.1" inputmode="decimal" value="${numero(t.tea || t.tasaEfectivaAnual || 0)}"></label>
      </div>`).join('');
  }

  function tarjetaActual() {
    return tarjetas.find(t => String(t.tarjetaId) === String($('hf-finance-card')?.value)) || null;
  }

  function cargarValoresTarjeta() {
    const tarjeta = tarjetaActual();
    if (!tarjeta) return;
    $('hf-finance-payment').value = tarjeta.pagoMinimo || '';
    $('hf-finance-tea').value = numero(tarjeta.tea || tarjeta.tasaEfectivaAnual || 0);
  }

  function usarMinimo() {
    const tarjeta = tarjetaActual();
    if (!tarjeta) return toast('Selecciona una tarjeta.');
    if (numero(tarjeta.pagoMinimo) <= 0) return toast('Esta tarjeta no tiene un pago mínimo registrado.');
    $('hf-finance-payment').value = tarjeta.pagoMinimo;
    calcularEscenario();
  }

  function renderGrafico(cronograma = []) {
    const contenedor = $('hf-finance-chart')?.closest('.hf-finance-chart');
    const canvas = $('hf-finance-chart');
    if (!canvas || !window.Chart) return;
    if (grafico) grafico.destroy();
    if (!cronograma.length) {
      if (contenedor) contenedor.style.display = 'none';
      return;
    }
    if (contenedor) contenedor.style.display = '';
    const datos = cronograma.slice(0, 60);
    grafico = new Chart(canvas, {
      type: 'line',
      data: { labels: datos.map(x => `Mes ${x.mes}`), datasets: [{ label: 'Saldo pendiente', data: datos.map(x => x.saldo), tension: .25, fill: false }] },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } }
    });
  }

  async function calcularEscenario() {
    const tarjeta = tarjetaActual();
    if (!tarjeta) return toast('Selecciona una tarjeta.');
    const pagoMensual = numero($('hf-finance-payment')?.value);
    const tea = numero($('hf-finance-tea')?.value);
    const salida = $('hf-finance-output');
    if (pagoMensual <= 0) return toast('Ingresa cuánto puedes pagar al mes.');
    salida.className = 'hf-finance-empty';
    salida.textContent = 'Calculando…';

    try {
      if (!window.HFMotorPredictivoFinanciero?.simularPago) throw new Error('El simulador todavía no está disponible.');
      const deuda = numero(tarjeta.deudaEstimada);
      const amort = HFMotorPredictivoFinanciero.simularPago({ deuda, pagoMensual, tea });
      if (!amort.viable) {
        salida.className = 'hf-finance-output';
        salida.innerHTML = `<div class="hf-finance-warning"><strong>Ese pago no alcanza para reducir la deuda.</strong><span>${amort.motivo === 'pago-no-cubre-interes' ? 'El pago mensual es menor que los intereses estimados. Aumenta la cuota o revisa la TEA.' : 'Ingresa un pago mensual mayor.'}</span></div>`;
        renderGrafico([]);
        return;
      }
      const utilizacion = numero(tarjeta.lineaTotal) > 0 ? deuda / numero(tarjeta.lineaTotal) * 100 : 0;
      salida.className = 'hf-finance-output';
      salida.innerHTML = `
        <div class="hf-finance-answer"><strong>Con ${moneda(pagoMensual)} al mes terminarías en aproximadamente ${amort.meses} mes${amort.meses === 1 ? '' : 'es'}.</strong><span>Este cálculo supone que no haces nuevas compras con la tarjeta.</span></div>
        <div class="hf-finance-results three">
          <div class="hf-finance-result"><span>Deuda pendiente</span><strong>${moneda(deuda)}</strong><small>La que registra la app</small></div>
          <div class="hf-finance-result"><span>Total pagado</span><strong>${moneda(amort.totalPagado)}</strong><small>Capital más intereses</small></div>
          <div class="hf-finance-result"><span>Intereses aproximados</span><strong>${moneda(amort.interesesTotales)}</strong><small>Usando TEA ${tea}%</small></div>
        </div>
        ${utilizacion >= 80 ? `<div class="hf-finance-risk alto"><strong>La línea está muy utilizada</strong><div>La tarjeta usa aproximadamente ${utilizacion.toFixed(1)}% de su línea. Evita nuevas compras mientras sigues este plan.</div></div>` : ''}`;
      renderGrafico(amort.cronograma || []);
    } catch (error) {
      console.error(error);
      salida.className = 'hf-finance-empty';
      salida.textContent = error.message || 'No se pudo calcular el escenario.';
    }
  }

  const estrategiaInfo = {
    avalancha: { titulo:'Ahorrar más intereses', subtitulo:'Prioriza primero la tarjeta con la TEA más alta.' },
    'bola-nieve': { titulo:'Cerrar una tarjeta más rápido', subtitulo:'Prioriza primero la deuda más pequeña.' },
    hibrida: { titulo:'Plan equilibrado', subtitulo:'Combina tasa de interés y tamaño de la deuda.' }
  };

  function tarjetasParaPlan() {
    const tasas = new Map([...document.querySelectorAll('.hf-plan-card-row')].map(fila => [String(fila.dataset.tarjetaId), numero(fila.querySelector('.hf-plan-card-tea')?.value)]));
    return tarjetas.map(t => ({
      id: String(t.tarjetaId),
      nombre: String(t.tarjetaNombre || 'Tarjeta'),
      deuda: numero(t.deudaEstimada),
      minimo: numero(t.pagoMinimo),
      tea: tasas.get(String(t.tarjetaId)) || 0
    })).filter(t => t.deuda > 0);
  }

  function firmaResultado(r = {}) {
    return `${r.viable}|${r.meses ?? 'x'}|${numero(r.interesesTotales).toFixed(2)}|${numero(r.totalPagado).toFixed(2)}`;
  }

  function nombresOrden(orden = [], mapa = new Map()) {
    return orden.map(id => mapa.get(String(id)) || String(id));
  }

  async function calcularPlan() {
    const presupuestoMensual = numero($('hf-plan-budget')?.value);
    const salida = $('hf-plan-output');
    if (presupuestoMensual <= 0) return toast('Ingresa el presupuesto mensual total.');
    const base = tarjetasParaPlan();
    if (!base.length) return toast('No hay tarjetas con deuda pendiente.');
    salida.className = 'hf-finance-empty';
    salida.textContent = 'Preparando tu plan…';

    try {
      if (!window.HFOptimizadorPagos?.compararEstrategias) throw new Error('El planificador todavía no está disponible.');
      const sumaMinimos = base.reduce((s, t) => s + t.minimo, 0);
      if (presupuestoMensual < sumaMinimos) {
        salida.className = 'hf-finance-output';
        salida.innerHTML = `<div class="hf-finance-warning"><strong>El presupuesto no cubre los pagos mínimos.</strong><span>Los mínimos registrados suman ${moneda(sumaMinimos)}. Faltan ${moneda(sumaMinimos - presupuestoMensual)}.</span></div>`;
        return;
      }

      if (base.length === 1) {
        const t = base[0];
        const amort = HFMotorPredictivoFinanciero.simularPago({ deuda:t.deuda, pagoMensual:presupuestoMensual, tea:t.tea });
        salida.className = 'hf-finance-output';
        salida.innerHTML = amort.viable ? `
          <div class="hf-finance-answer"><strong>Tienes una sola tarjeta; no hay un orden que comparar.</strong><span>Destina el presupuesto a ${t.nombre}. La terminarías en aproximadamente ${amort.meses} mes${amort.meses === 1 ? '' : 'es'} y pagarías ${moneda(amort.interesesTotales)} en intereses.</span></div>` : `
          <div class="hf-finance-warning"><strong>El pago no reduce la deuda.</strong><span>Aumenta el presupuesto o revisa la TEA ingresada.</span></div>`;
        return;
      }

      const comparacion = HFOptimizadorPagos.compararEstrategias({ tarjetas:base, presupuestoMensual });
      const mapaNombres = new Map(base.map(t => [String(t.id), t.nombre]));
      const firmas = new Set(comparacion.resultados.map(firmaResultado));
      const todosIguales = firmas.size === 1;
      const mejor = comparacion.resultados.find(r => r.estrategia === comparacion.mejorEstrategia) || comparacion.resultados[0];

      if (todosIguales) {
        const info = estrategiaInfo[mejor.estrategia] || estrategiaInfo.avalancha;
        const orden = nombresOrden(mejor.orden, mapaNombres);
        salida.className = 'hf-finance-output';
        salida.innerHTML = `
          <div class="hf-finance-answer"><strong>Con los datos ingresados, las tres estrategias dan el mismo resultado.</strong><span>Esto ocurre cuando las tasas son iguales o las diferencias entre tarjetas no cambian el costo total.</span></div>
          <div class="hf-strategy-item best"><strong>${info.titulo}</strong><span>${mejor.viable ? `${mejor.meses} meses · intereses ${moneda(mejor.interesesTotales)}` : 'El plan no es viable con este presupuesto.'}</span>${orden.length ? `<small>Orden sugerido: ${orden.join(' → ')}</small>` : ''}</div>
          <div class="hf-finance-note">Para comparar realmente “ahorrar intereses” contra “cerrar una tarjeta rápido”, escribe la TEA específica de cada tarjeta.</div>`;
        return;
      }

      salida.className = 'hf-finance-output';
      salida.innerHTML = `
        <div class="hf-finance-answer"><strong>La opción que menos intereses genera es: ${estrategiaInfo[comparacion.mejorEstrategia]?.titulo || 'Plan recomendado'}.</strong><span>Puedes elegir otra si prefieres cerrar una tarjeta pequeña antes.</span></div>
        <div class="hf-strategy-list">${comparacion.resultados.map(r => {
          const info = estrategiaInfo[r.estrategia] || { titulo:r.estrategia, subtitulo:'' };
          const orden = nombresOrden(r.orden, mapaNombres);
          return `<div class="hf-strategy-item ${r.estrategia === comparacion.mejorEstrategia ? 'best' : ''}"><strong>${info.titulo}</strong><span>${info.subtitulo}</span><span>${r.viable ? `${r.meses} meses · intereses ${moneda(r.interesesTotales)}` : 'No viable con este presupuesto'}</span>${orden.length ? `<small>Orden: ${orden.join(' → ')}</small>` : ''}</div>`;
        }).join('')}</div>`;
    } catch (error) {
      console.error(error);
      salida.className = 'hf-finance-empty';
      salida.textContent = error.message || 'No se pudo generar el plan.';
    }
  }

  async function abrirPlanificador() {
    inyectarModal();
    await cargarTarjetas();
    if (typeof window.openModal === 'function') openModal('hfCentroFinancieroModal');
    else $('hfCentroFinancieroModal')?.classList.add('open');
  }

  function iniciar() {
    inyectarModal();
    crearLanzador();
  }

  window.abrirCentroFinanciero = abrirPlanificador;
  window.abrirPlanificadorDeudas = abrirPlanificador;
  window.addEventListener('hf:deudas-core-actualizadas', cargarTarjetas);
  window.addEventListener('hf:deuda-actualizada', cargarTarjetas);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 350), { once:true });
  else setTimeout(iniciar, 100);

  window.HFPanelPrediccionesFinancieras = Object.freeze({ iniciar, abrir:abrirPlanificador, cargarTarjetas, calcularEscenario, calcularPlan });
})();
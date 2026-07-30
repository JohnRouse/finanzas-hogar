/* Hogar Finanzas — Etapa 11.2: Centro integral de tarjetas y medios de pago */
(() => {
  'use strict';

  let chartTarjetasMensual = null;
  let ultimaFirma = '';
  const $ = id => document.getElementById(id);
  const numero = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const moneda = value => `S/ ${numero(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fechaValida = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
  const mesActualISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit' }).slice(0, 7);

  function campoEstado(tarjeta, nombres, fallback = 0) {
    const estado = tarjeta?.estadoCuenta || {};
    for (const nombre of nombres) {
      if (estado[nombre] !== undefined && estado[nombre] !== null && estado[nombre] !== '') return estado[nombre];
      if (tarjeta?.[nombre] !== undefined && tarjeta[nombre] !== null && tarjeta[nombre] !== '') return tarjeta[nombre];
    }
    return fallback;
  }

  function esPagoTarjeta(gasto) {
    return gasto?.tipoMovimiento === 'pagoTarjeta' ||
      String(gasto?.cat || gasto?.categoria || '').toLowerCase() === 'deudas' &&
      /pago.*tarjeta|abono.*tarjeta/i.test(String(gasto?.desc || gasto?.descripcion || ''));
  }

  function esCredito(gasto) {
    return gasto?.medio === 'tarjeta' || gasto?.metodo === 'credito' || gasto?.tarjetaId || gasto?.tipo === 'consumo-credito';
  }

  function medioPago(gasto) {
    if (esPagoTarjeta(gasto)) return 'pago-tarjeta';
    if (esCredito(gasto)) return 'credito';
    const texto = `${gasto?.medio || ''} ${gasto?.metodo || ''} ${gasto?.tipo || ''} ${gasto?.origen || ''}`.toLowerCase();
    if (texto.includes('yape')) return 'yape';
    if (texto.includes('debito') || texto.includes('débito')) return 'debito';
    if (texto.includes('transfer')) return 'transferencia';
    return 'efectivo';
  }

  function inyectarPanel() {
    const pagina = $('page-deudas');
    if (!pagina || $('hf-centro-tarjetas')) return;
    const primeraSeccion = pagina.querySelector('.section');
    const panel = document.createElement('section');
    panel.id = 'hf-centro-tarjetas';
    panel.className = 'section hf-debt-center';
    panel.innerHTML = `
      <div class="section-head hf-debt-head">
        <div>
          <div class="section-title">Situación real de tarjetas</div>
          <div class="hf-debt-subtitle">Facturado, compras posteriores, pagos y deuda estimada hasta hoy.</div>
        </div>
        <button class="btn-recurrentes" type="button" onclick="actualizarCentroTarjetas(true)">Actualizar</button>
      </div>

      <div class="hf-debt-kpis" id="hf-debt-kpis">
        <div class="hf-debt-kpi"><span>Deuda facturada</span><strong>—</strong><small>Últimos estados de cuenta</small></div>
        <div class="hf-debt-kpi"><span>Pago mínimo total</span><strong>—</strong><small>Próximos vencimientos</small></div>
        <div class="hf-debt-kpi"><span>Compras después del cierre</span><strong>—</strong><small>Entrarán en la siguiente facturación</small></div>
        <div class="hf-debt-kpi primary"><span>Deuda estimada actual</span><strong>—</strong><small>Facturado + compras − pagos</small></div>
      </div>

      <div class="hf-payment-summary card">
        <div class="hf-card-title">Gastos del mes por medio de pago</div>
        <div id="hf-payment-grid" class="hf-payment-grid"><div class="empty-state">Cargando…</div></div>
      </div>

      <div class="hf-card-breakdown" id="hf-card-breakdown"></div>

      <div class="card hf-chart-card">
        <div class="hf-chart-title-row">
          <div>
            <div class="hf-card-title">Consumos y pagos de tarjetas por mes</div>
            <small>Compara cuánto compraste con crédito y cuánto pagaste en los últimos 12 meses.</small>
          </div>
        </div>
        <div class="chart-wrap hf-debt-chart-wrap"><canvas id="hf-card-spending-chart"></canvas></div>
      </div>
    `;
    if (primeraSeccion) pagina.insertBefore(panel, primeraSeccion);
    else pagina.appendChild(panel);
  }

  async function cargarDatos() {
    const hogarId = window.DB?.hogarId || localStorage.getItem('hogarId');
    if (!hogarId || !window.db || !window.DB) return { tarjetas: [], gastos: [] };
    const [tarjetas, gastos] = await Promise.all([
      DB.getTarjetas().catch(() => []),
      db.collection('hogares').doc(hogarId).collection('gastos').get()
        .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))
        .catch(() => DB.getGastos().catch(() => []))
    ]);
    return { tarjetas, gastos };
  }

  function calcularTarjeta(tarjeta, gastos) {
    const cierre = fechaValida(campoEstado(tarjeta, ['fechaCierre', 'cierre', 'fechaFacturacion'], ''));
    const vencimiento = fechaValida(campoEstado(tarjeta, ['fechaVencimiento', 'vencimiento'], ''));
    const facturada = numero(campoEstado(tarjeta, ['pagoTotal', 'deudaFacturada', 'totalFacturado', 'montoFacturado', 'deuda'], tarjeta.deuda || tarjeta.saldo || 0));
    const minimo = numero(campoEstado(tarjeta, ['pagoMinimo', 'minimo', 'montoMinimo'], tarjeta.pagoMinimo || 0));
    const lineaTotal = numero(campoEstado(tarjeta, ['lineaTotal', 'limiteCredito', 'limite', 'linea'], tarjeta.limite || 0));
    const lineaDisponibleInformada = numero(campoEstado(tarjeta, ['lineaDisponible', 'disponible'], 0));

    const vinculados = gastos.filter(g => g.tarjetaId === tarjeta.id || (
      !g.tarjetaId && g.ultimosDigitos && tarjeta.ultimosDigitos && String(g.ultimosDigitos) === String(tarjeta.ultimosDigitos)
    ));
    const posteriores = vinculados.filter(g => !esPagoTarjeta(g) && esCredito(g) && (!cierre || String(g.fecha || '') > cierre));
    const pagos = vinculados.filter(g => esPagoTarjeta(g) && (!cierre || String(g.fecha || '') > cierre));
    const comprasPosteriores = posteriores.reduce((s, g) => s + numero(g.monto), 0);
    const pagosPosteriores = pagos.reduce((s, g) => s + numero(g.monto), 0);
    const deudaEstimada = Math.max(0, facturada + comprasPosteriores - pagosPosteriores);
    const disponible = lineaDisponibleInformada || Math.max(0, lineaTotal - deudaEstimada);

    return { tarjeta, cierre, vencimiento, facturada, minimo, lineaTotal, disponible, comprasPosteriores, pagosPosteriores, deudaEstimada };
  }

  function renderKPIs(resumenes) {
    const totales = resumenes.reduce((a, r) => {
      a.facturada += r.facturada;
      a.minimo += r.minimo;
      a.posteriores += r.comprasPosteriores;
      a.pagos += r.pagosPosteriores;
      a.estimada += r.deudaEstimada;
      return a;
    }, { facturada: 0, minimo: 0, posteriores: 0, pagos: 0, estimada: 0 });

    const kpis = $('hf-debt-kpis');
    if (!kpis) return totales;
    kpis.innerHTML = `
      <div class="hf-debt-kpi"><span>Deuda facturada</span><strong>${moneda(totales.facturada)}</strong><small>Últimos estados de cuenta</small></div>
      <div class="hf-debt-kpi"><span>Pago mínimo total</span><strong>${moneda(totales.minimo)}</strong><small>Suma de mínimos informados</small></div>
      <div class="hf-debt-kpi"><span>Compras después del cierre</span><strong>${moneda(totales.posteriores)}</strong><small>Pagos posteriores: ${moneda(totales.pagos)}</small></div>
      <div class="hf-debt-kpi primary"><span>Deuda estimada actual</span><strong>${moneda(totales.estimada)}</strong><small>Lo que realmente debes hasta hoy</small></div>
    `;
    return totales;
  }

  function renderTarjetas(resumenes) {
    const contenedor = $('hf-card-breakdown');
    if (!contenedor) return;
    if (!resumenes.length) {
      contenedor.innerHTML = '<div class="card empty-state">Registra tus tarjetas para ver el cálculo completo.</div>';
      return;
    }
    contenedor.innerHTML = resumenes.map(r => {
      const t = r.tarjeta;
      const uso = r.lineaTotal > 0 ? Math.min(100, Math.round((r.deudaEstimada / r.lineaTotal) * 100)) : 0;
      const actualizada = campoEstado(t, ['actualizadoEn', 'fechaEstadoCuenta', 'periodo'], 'Sin actualización automática');
      return `
        <article class="card hf-card-status">
          <div class="hf-card-status-head">
            <div>
              <strong>${String(t.nombre || t.banco || 'Tarjeta')}</strong>
              <small>${t.ultimosDigitos ? `•••• ${t.ultimosDigitos}` : 'Sin últimos dígitos'} · ${String(t.titular || t.quien || '')}</small>
            </div>
            <span class="hf-card-debt">${moneda(r.deudaEstimada)}</span>
          </div>
          <div class="hf-card-metrics">
            <div><span>Facturado</span><strong>${moneda(r.facturada)}</strong></div>
            <div><span>Pago mínimo</span><strong>${moneda(r.minimo)}</strong></div>
            <div><span>Después del cierre</span><strong>${moneda(r.comprasPosteriores)}</strong></div>
            <div><span>Pagos posteriores</span><strong>− ${moneda(r.pagosPosteriores)}</strong></div>
          </div>
          <div class="hf-card-dates">
            <span>Cierre: <b>${r.cierre || 'No informado'}</b></span>
            <span>Vence: <b>${r.vencimiento || 'No informado'}</b></span>
          </div>
          ${r.lineaTotal ? `<div class="hf-credit-line"><div><span>Uso de línea ${uso}%</span><span>${moneda(r.disponible)} disponible</span></div><progress max="100" value="${uso}"></progress></div>` : ''}
          <small class="hf-card-updated">Último dato: ${String(actualizada)}</small>
        </article>`;
    }).join('');
  }

  function renderMedios(gastos) {
    const mes = mesActualISO();
    const delMes = gastos.filter(g => String(g.mes || g.fecha || '').startsWith(mes) && !esPagoTarjeta(g));
    const grupos = delMes.reduce((acc, g) => {
      const medio = medioPago(g);
      acc[medio] = (acc[medio] || 0) + numero(g.monto);
      return acc;
    }, {});
    const etiquetas = {
      credito: ['Tarjetas de crédito', '💳'], debito: ['Débito', '🏧'], yape: ['Yape', '📲'],
      transferencia: ['Transferencias', '↗'], efectivo: ['Efectivo / otros', '💵']
    };
    const total = Object.values(grupos).reduce((s, n) => s + n, 0);
    const grid = $('hf-payment-grid');
    if (!grid) return;
    grid.innerHTML = Object.entries(etiquetas).map(([key, [label, icon]]) => `
      <div class="hf-payment-item">
        <span class="hf-payment-icon">${icon}</span>
        <div><small>${label}</small><strong>${moneda(grupos[key] || 0)}</strong></div>
      </div>`).join('') + `<div class="hf-payment-total"><span>Total del mes</span><strong>${moneda(total)}</strong></div>`;
  }

  function meses12() {
    const base = new Date();
    const items = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      items.push({ iso, label: d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }).replace('.', '') });
    }
    return items;
  }

  function renderGrafico(gastos) {
    const canvas = $('hf-card-spending-chart');
    if (!canvas || !window.Chart) return;
    const meses = meses12();
    const compras = meses.map(m => gastos.filter(g => String(g.mes || g.fecha || '').startsWith(m.iso) && esCredito(g) && !esPagoTarjeta(g)).reduce((s, g) => s + numero(g.monto), 0));
    const pagos = meses.map(m => gastos.filter(g => String(g.mes || g.fecha || '').startsWith(m.iso) && esPagoTarjeta(g)).reduce((s, g) => s + numero(g.monto), 0));
    if (chartTarjetasMensual) chartTarjetasMensual.destroy();
    chartTarjetasMensual = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: meses.map(m => m.label),
        datasets: [
          { label: 'Compras con tarjeta', data: compras, borderRadius: 6, maxBarThickness: 26 },
          { label: 'Pagos de tarjeta', data: pagos, borderRadius: 6, maxBarThickness: 26 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${moneda(ctx.raw)}` } }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: value => `S/ ${Number(value).toLocaleString('es-PE')}` } }
        }
      }
    });
  }

  window.actualizarCentroTarjetas = async function(forzar = false) {
    try {
      inyectarPanel();
      const { tarjetas, gastos } = await cargarDatos();
      const firma = JSON.stringify([tarjetas.map(t => [t.id, t.estadoCuenta, t.deuda, t.saldo]), gastos.map(g => [g.id, g.monto, g.fecha, g.tarjetaId, g.tipoMovimiento])]);
      if (!forzar && firma === ultimaFirma) return;
      ultimaFirma = firma;
      const resumenes = tarjetas.map(t => calcularTarjeta(t, gastos));
      renderKPIs(resumenes);
      renderTarjetas(resumenes);
      renderMedios(gastos);
      renderGrafico(gastos);
    } catch (error) {
      console.error('No se pudo actualizar el centro de tarjetas:', error);
      if (forzar && typeof showToast === 'function') showToast('No se pudo actualizar el resumen de tarjetas');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => actualizarCentroTarjetas(true), 1600);
    document.addEventListener('click', event => {
      const boton = event.target.closest?.('[onclick*="showPage(\'deudas\'"]');
      if (boton) setTimeout(() => actualizarCentroTarjetas(), 250);
    });
    setInterval(() => {
      if ($('page-deudas')?.classList.contains('active')) actualizarCentroTarjetas();
    }, 15000);
  });
})();

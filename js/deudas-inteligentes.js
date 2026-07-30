/* Hogar Finanzas — Recuperación: núcleo de deuda actual, sin paneles duplicados */
(() => {
  'use strict';

  const cache = new Map();
  let actualizando = false;
  let temporizador = null;
  let observer = null;
  let pagoDecorado = false;

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fechaISO = valor => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) ? String(valor) : '';

  function estadoCuenta(tarjeta = {}) {
    return tarjeta.estadoCuenta && typeof tarjeta.estadoCuenta === 'object' ? tarjeta.estadoCuenta : {};
  }

  function esPagoTarjeta(gasto = {}) {
    return gasto.tipoMovimiento === 'pagoTarjeta' || gasto.tipo === 'pago-tarjeta';
  }

  function esCompraCredito(gasto = {}) {
    return !esPagoTarjeta(gasto) && (gasto.medio === 'tarjeta' || gasto.metodo === 'credito' || gasto.tipo === 'consumo-credito');
  }

  function fechaMovimiento(gasto = {}) {
    return fechaISO(gasto.fechaOperacion) || fechaISO(gasto.fecha) || '';
  }

  function coincideTarjeta(gasto = {}, tarjeta = {}) {
    if (gasto.tarjetaId && tarjeta.id) return gasto.tarjetaId === tarjeta.id;
    const gd = String(gasto.ultimosDigitos || gasto.ultimos4 || '');
    const td = String(tarjeta.ultimosDigitos || tarjeta.ultimos4 || '');
    return Boolean(gd && td && gd === td);
  }

  function calcularTarjeta(tarjeta = {}, gastos = []) {
    const ec = estadoCuenta(tarjeta);
    const fechaBase = fechaISO(ec.fechaCierre) || fechaISO(ec.fechaEstado) || '';
    const facturadaInformada = ec.pagoTotal !== null && ec.pagoTotal !== undefined && ec.pagoTotal !== '';
    const facturada = facturadaInformada ? numero(ec.pagoTotal) : numero(tarjeta.deuda || tarjeta.saldo);
    const vinculados = gastos.filter(g => coincideTarjeta(g, tarjeta));
    const posteriores = fechaBase ? vinculados.filter(g => fechaMovimiento(g) && fechaMovimiento(g) > fechaBase) : [];
    const comprasPosteriores = posteriores.filter(esCompraCredito).reduce((s, g) => s + numero(g.monto), 0);
    const pagosPosteriores = posteriores.filter(esPagoTarjeta).reduce((s, g) => s + numero(g.monto), 0);
    const deudaEstimada = facturadaInformada
      ? Math.max(0, facturada + comprasPosteriores - pagosPosteriores)
      : Math.max(0, numero(tarjeta.deuda || tarjeta.saldo));
    const lineaTotal = numero(tarjeta.limite || tarjeta.lineaTotal || ec.lineaTotal);
    const disponible = lineaTotal ? lineaTotal - deudaEstimada : 0;

    return {
      tarjetaId: tarjeta.id,
      tarjeta,
      estadoCuenta: ec,
      fechaBase,
      tieneEstado: facturadaInformada,
      facturada,
      comprasPosteriores,
      pagosPosteriores,
      deudaRegistrada: numero(tarjeta.deuda || tarjeta.saldo),
      deudaEstimada,
      pagoMinimo: numero(ec.pagoMinimo || tarjeta.pagoMinimo),
      fechaVencimiento: fechaISO(ec.fechaVencimiento),
      lineaTotal,
      disponible
    };
  }

  async function cargarDatos() {
    if (!window.DB) return { tarjetas: [], prestamos: [], gastos: [] };
    const hogarId = DB.hogarId || localStorage.getItem('hogarId');
    const [tarjetas, prestamos, gastos] = await Promise.all([
      DB.getTarjetas?.().catch(() => []) || [],
      DB.getPrestamos?.().catch(() => []) || [],
      hogarId && window.db
        ? db.collection('hogares').doc(hogarId).collection('gastos').get()
            .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))
            .catch(() => DB.getGastos?.().catch(() => []) || [])
        : (DB.getGastos?.().catch(() => []) || [])
    ]);
    return { tarjetas: tarjetas || [], prestamos: prestamos || [], gastos: gastos || [] };
  }

  function asegurarResumen() {
    const pagina = document.getElementById('page-deudas');
    const kpis = pagina?.querySelector('.kpi-grid');
    if (!pagina || !kpis) return null;
    let resumen = document.getElementById('hf-resumen-deuda-actual');
    if (resumen) return resumen;
    resumen = document.createElement('section');
    resumen.id = 'hf-resumen-deuda-actual';
    resumen.className = 'hf-debt-current-summary';
    resumen.innerHTML = '<div class="hf-debt-current-head"><div><strong>Estado actualizado de tarjetas</strong><small>Basado en estados de cuenta y movimientos registrados.</small></div><button type="button" onclick="actualizarCentroTarjetas(true)">Actualizar</button></div><div class="hf-debt-current-grid"><div><span>Facturado</span><strong>—</strong></div><div><span>Compras posteriores</span><strong>—</strong></div><div><span>Pagos posteriores</span><strong>—</strong></div><div class="primary"><span>Estimado hoy</span><strong>—</strong></div></div>';
    kpis.insertAdjacentElement('afterend', resumen);
    return resumen;
  }

  function renderResumen(resumenes, prestamos) {
    const totales = resumenes.reduce((acc, r) => {
      acc.facturada += r.facturada;
      acc.compras += r.comprasPosteriores;
      acc.pagos += r.pagosPosteriores;
      acc.estimada += r.deudaEstimada;
      acc.minimos += r.pagoMinimo;
      return acc;
    }, { facturada: 0, compras: 0, pagos: 0, estimada: 0, minimos: 0 });
    const deudaPrestamos = prestamos.reduce((s, p) => s + numero(p.saldo), 0);
    const cuotasPrestamos = prestamos.reduce((s, p) => s + numero(p.cuota), 0);

    const resumen = asegurarResumen();
    if (resumen) {
      const valores = resumen.querySelectorAll('.hf-debt-current-grid strong');
      [totales.facturada, totales.compras, totales.pagos, totales.estimada].forEach((v, i) => {
        if (valores[i]) valores[i].textContent = i === 2 && v > 0 ? `− ${moneda(v)}` : moneda(v);
      });
      resumen.classList.toggle('sin-estados', !resumenes.some(r => r.tieneEstado));
    }

    const deudaTotal = document.getElementById('kpi-deuda-total');
    const pagoMensual = document.getElementById('kpi-pago-mensual');
    const pagoSub = document.getElementById('kpi-pago-sub');
    if (deudaTotal) deudaTotal.textContent = moneda(totales.estimada + deudaPrestamos);
    if (pagoMensual) pagoMensual.textContent = moneda(totales.minimos + cuotasPrestamos);
    if (pagoSub) pagoSub.textContent = `${moneda(totales.minimos)} mínimos + ${moneda(cuotasPrestamos)} cuotas`;

    return { ...totales, deudaPrestamos, cuotasPrestamos, deudaTotal: totales.estimada + deudaPrestamos };
  }

  function actualizarLinea(card, resumen) {
    const uso = resumen.lineaTotal > 0 ? Math.max(0, Math.round((resumen.deudaEstimada / resumen.lineaTotal) * 100)) : 0;
    const barra = card.querySelector('.credit-line-fill');
    if (barra) {
      barra.style.width = `${Math.min(100, uso)}%`;
      barra.style.background = uso >= 100 ? '#c43030' : uso > 80 ? '#c43030' : uso > 60 ? '#b06a10' : '#2a7de1';
    }
    const etiquetas = card.querySelectorAll('.credit-line-labels span');
    if (etiquetas[0]) etiquetas[0].textContent = `${uso}% utilizado`;
    const detalles = card.querySelectorAll('.debt-sub span');
    if (detalles[1] && resumen.lineaTotal > 0) {
      detalles[1].textContent = `Disponible: ${resumen.disponible < 0 ? '− ' : ''}${moneda(Math.abs(resumen.disponible))}`;
      detalles[1].style.color = resumen.disponible < 0 ? '#c43030' : 'var(--text3)';
    }
  }

  function enriquecerTarjeta(resumen) {
    const card = document.getElementById(`tarjeta-card-${resumen.tarjetaId}`);
    if (!card) return;
    const label = card.querySelector('.debt-label-main');
    const total = card.querySelector('.debt-total');
    if (label) label.textContent = resumen.tieneEstado ? 'Deuda estimada hoy' : 'Saldo registrado';
    if (total) total.textContent = moneda(resumen.deudaEstimada);

    let detalle = card.querySelector('.hf-live-debt-breakdown');
    if (!detalle) {
      detalle = document.createElement('div');
      detalle.className = 'hf-live-debt-breakdown';
      total?.insertAdjacentElement('afterend', detalle);
    }

    detalle.innerHTML = resumen.tieneEstado ? `
      <div><span>Estado facturado</span><strong>${moneda(resumen.facturada)}</strong></div>
      <div><span>Compras posteriores</span><strong>+ ${moneda(resumen.comprasPosteriores)}</strong></div>
      <div><span>Pagos posteriores</span><strong>− ${moneda(resumen.pagosPosteriores)}</strong></div>
      <small>Saldo registrado en la app: ${moneda(resumen.deudaRegistrada)}${resumen.fechaBase ? ` · base ${new Date(`${resumen.fechaBase}T12:00:00`).toLocaleDateString('es-PE')}` : ''}</small>` : `
      <small>Registra el estado de cuenta para separar saldo facturado, compras posteriores y pagos.</small>`;

    card.dataset.deudaEstimada = String(resumen.deudaEstimada);
    actualizarLinea(card, resumen);
  }

  function decorarAcciones() {
    if (pagoDecorado) return;
    const originalPago = window.abrirPagoTarjeta;
    const originalAjuste = window.abrirAjusteTarjeta;
    if (typeof originalPago === 'function') {
      window.abrirPagoTarjeta = function(id, nombre, deuda) {
        return originalPago.call(this, id, nombre, cache.get(id)?.deudaEstimada ?? deuda);
      };
    }
    if (typeof originalAjuste === 'function') {
      window.abrirAjusteTarjeta = function(id, nombre, deuda, limite) {
        return originalAjuste.call(this, id, nombre, cache.get(id)?.deudaEstimada ?? deuda, limite);
      };
    }
    pagoDecorado = true;
  }

  async function actualizar(forzar = false) {
    if (actualizando) return false;
    if (!forzar && !document.getElementById('page-deudas')) return false;
    actualizando = true;
    try {
      document.getElementById('hf-centro-tarjetas')?.remove();
      const { tarjetas, prestamos, gastos } = await cargarDatos();
      const resumenes = tarjetas.map(t => calcularTarjeta(t, gastos));
      cache.clear();
      resumenes.forEach(r => cache.set(r.tarjetaId, r));
      const totales = renderResumen(resumenes, prestamos);
      resumenes.forEach(enriquecerTarjeta);
      decorarAcciones();
      const detalle = { tarjetas: resumenes, totales, actualizadoEn: new Date().toISOString() };
      window.dispatchEvent(new CustomEvent('hf:deudas-core-actualizadas', { detail: detalle }));
      return detalle;
    } catch (error) {
      console.warn('No se pudo actualizar el resumen de deudas:', error);
      return false;
    } finally {
      actualizando = false;
    }
  }

  function programar(motivo = 'evento', demora = 120) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => actualizar(motivo === 'manual'), demora);
  }

  window.actualizarCentroTarjetas = forzar => actualizar(Boolean(forzar));
  window.HFDeudasActuales = Object.freeze({
    calcularTarjeta,
    actualizar,
    programar,
    obtenerTarjeta: id => cache.get(id) || null,
    obtenerResumenes: () => [...cache.values()]
  });

  function iniciar() {
    decorarAcciones();
    programar('inicio', 500);
    const pagina = document.getElementById('page-deudas');
    if (pagina) {
      observer = new MutationObserver(() => programar('render', 90));
      observer.observe(pagina, { childList: true, subtree: true });
    }
  }

  ['hf:deuda-actualizada', 'hf:deudas-recalculadas', 'hf:estado-cuenta-confirmado', 'hf:gastos-actualizados'].forEach(nombre => {
    window.addEventListener(nombre, () => programar(nombre, 100));
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) programar('visible', 100); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
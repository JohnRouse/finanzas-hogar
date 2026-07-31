/* Hogar Finanzas — Núcleo claro de deuda actual */
(() => {
  'use strict';

  const cache = new Map();
  let actualizando = false;
  let temporizador = null;
  let observer = null;
  let accionesDecoradas = false;

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fechaISO = valor => /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) ? String(valor) : '';
  const tiempo = valor => {
    const n = Date.parse(String(valor || ''));
    return Number.isFinite(n) ? n : 0;
  };

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
    const pagoTotalInformado = ec.pagoTotal !== null && ec.pagoTotal !== undefined && ec.pagoTotal !== '';
    const estadoActualizadoEn = tiempo(ec.actualizadoEn || ec.fechaEstado || ec.fechaCierre);
    const saldoConfirmadoEn = tiempo(tarjeta.saldoConfirmadoEn || tarjeta.ultimaConciliacion);
    const usarEstado = pagoTotalInformado && estadoActualizadoEn >= saldoConfirmadoEn;
    const deudaRegistrada = Math.max(0, numero(tarjeta.deuda || tarjeta.saldo));
    const facturada = usarEstado ? numero(ec.pagoTotal) : deudaRegistrada;
    const vinculados = gastos.filter(g => coincideTarjeta(g, tarjeta));
    const posteriores = usarEstado && fechaBase
      ? vinculados.filter(g => fechaMovimiento(g) && fechaMovimiento(g) > fechaBase)
      : [];
    const comprasPosteriores = posteriores.filter(esCompraCredito).reduce((s, g) => s + numero(g.monto), 0);
    const pagosPosteriores = posteriores.filter(esPagoTarjeta).reduce((s, g) => s + numero(g.monto), 0);
    const deudaEstimada = usarEstado
      ? Math.max(0, facturada + comprasPosteriores - pagosPosteriores)
      : deudaRegistrada;
    const lineaTotal = numero(tarjeta.limite || tarjeta.lineaTotal || ec.lineaTotal);
    const fuente = usarEstado
      ? 'estado-cuenta'
      : saldoConfirmadoEn
        ? (tarjeta.pendienteConciliar ? 'saldo-confirmado-con-movimientos' : 'saldo-confirmado')
        : 'saldo-app';

    return {
      tarjetaId: tarjeta.id,
      tarjeta,
      estadoCuenta: ec,
      fechaBase,
      tieneEstado: usarEstado,
      fuente,
      facturada,
      comprasPosteriores,
      pagosPosteriores,
      deudaRegistrada,
      deudaEstimada,
      pagoMinimo: numero(ec.pagoMinimo || tarjeta.pagoMinimo),
      fechaVencimiento: fechaISO(ec.fechaVencimiento),
      lineaTotal,
      disponible: lineaTotal ? lineaTotal - deudaEstimada : 0,
      saldoConfirmadoEn: tarjeta.saldoConfirmadoEn || tarjeta.ultimaConciliacion || null
    };
  }

  async function cargarDatos() {
    if (!window.DB) return { tarjetas: [], prestamos: [], gastos: [] };
    const hogarId = DB.hogarId || localStorage.getItem('hogarId');
    const promesaTarjetas = typeof DB.getTarjetas === 'function' ? DB.getTarjetas().catch(() => []) : Promise.resolve([]);
    const promesaPrestamos = typeof DB.getPrestamos === 'function' ? DB.getPrestamos().catch(() => []) : Promise.resolve([]);
    const promesaGastos = hogarId && window.db
      ? db.collection('hogares').doc(hogarId).collection('gastos').get()
          .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))
          .catch(() => typeof DB.getGastos === 'function' ? DB.getGastos().catch(() => []) : [])
      : (typeof DB.getGastos === 'function' ? DB.getGastos().catch(() => []) : Promise.resolve([]));
    const [tarjetas, prestamos, gastos] = await Promise.all([promesaTarjetas, promesaPrestamos, promesaGastos]);
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
    resumen.innerHTML = `
      <div class="hf-debt-current-copy">
        <strong>Confirma tus saldos en un solo paso</strong>
        <small>El monto de cada tarjeta es la deuda total pendiente. No representa lo gastado este mes ni solo el exceso de línea.</small>
      </div>
      <button type="button" data-hf-open-balance-update>Actualizar saldos</button>`;
    resumen.querySelector('[data-hf-open-balance-update]')?.addEventListener('click', () => {
      if (typeof window.abrirActualizacionTarjetas === 'function') window.abrirActualizacionTarjetas();
      else window.actualizarCentroTarjetas?.(true);
    });
    kpis.insertAdjacentElement('afterend', resumen);
    return resumen;
  }

  function renderResumen(resumenes, prestamos) {
    asegurarResumen();
    const totales = resumenes.reduce((acc, r) => {
      acc.estimada += r.deudaEstimada;
      acc.minimos += r.pagoMinimo;
      return acc;
    }, { estimada: 0, minimos: 0 });
    const deudaPrestamos = prestamos.reduce((s, p) => s + numero(p.saldo), 0);
    const cuotasPrestamos = prestamos.reduce((s, p) => s + numero(p.cuota), 0);

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
    if (etiquetas[0]) etiquetas[0].textContent = `${uso}% de la línea utilizada`;
    const detalles = card.querySelectorAll('.debt-sub span');
    if (detalles[1] && resumen.lineaTotal > 0) {
      detalles[1].textContent = `Disponible: ${resumen.disponible < 0 ? '− ' : ''}${moneda(Math.abs(resumen.disponible))}`;
      detalles[1].style.color = resumen.disponible < 0 ? '#c43030' : 'var(--text3)';
    }
  }

  function textoFuente(resumen) {
    if (resumen.fuente === 'estado-cuenta') return 'Calculada desde el último estado de cuenta y los movimientos posteriores.';
    if (resumen.fuente === 'saldo-confirmado') return `Confirmada manualmente${resumen.saldoConfirmadoEn ? ` el ${new Date(resumen.saldoConfirmadoEn).toLocaleDateString('es-PE')}` : ''}.`;
    if (resumen.fuente === 'saldo-confirmado-con-movimientos') return 'Parte del último saldo confirmado y ya incluye movimientos registrados después.';
    return 'Calculada con el saldo inicial, las compras y los pagos registrados en la app.';
  }

  function enriquecerTarjeta(resumen) {
    const card = document.getElementById(`tarjeta-card-${resumen.tarjetaId}`);
    if (!card) return;
    const label = card.querySelector('.debt-label-main');
    const total = card.querySelector('.debt-total');
    if (label) label.textContent = 'Deuda total pendiente';
    if (total) total.textContent = moneda(resumen.deudaEstimada);

    let detalle = card.querySelector('.hf-live-debt-breakdown');
    if (!detalle) {
      detalle = document.createElement('div');
      detalle.className = 'hf-live-debt-breakdown';
      total?.insertAdjacentElement('afterend', detalle);
    }

    const contenido = resumen.tieneEstado ? `
      <div><span>Facturado</span><strong>${moneda(resumen.facturada)}</strong></div>
      <div><span>Compras nuevas</span><strong>+ ${moneda(resumen.comprasPosteriores)}</strong></div>
      <div><span>Pagos registrados</span><strong>− ${moneda(resumen.pagosPosteriores)}</strong></div>
      <small><b>Qué significa:</b> este es el total que todavía debes. ${textoFuente(resumen)}</small>` : `
      <small><b>Qué significa:</b> este es el total que todavía debes en la tarjeta; no es el gasto del mes ni el monto excedido. ${textoFuente(resumen)}</small>`;
    if (detalle.innerHTML !== contenido) detalle.innerHTML = contenido;

    const exceso = resumen.lineaTotal > 0 ? Math.max(0, resumen.deudaEstimada - resumen.lineaTotal) : 0;
    const bloqueExceso = card.querySelector('.credit-overflow');
    if (bloqueExceso && exceso > 0) {
      bloqueExceso.innerHTML = `<span>Exceso sobre la línea: ${moneda(exceso)}</span><small>La deuda total es ${moneda(resumen.deudaEstimada)} y supera la línea por este monto.</small>`;
    }

    card.dataset.deudaEstimada = String(resumen.deudaEstimada);
    actualizarLinea(card, resumen);
  }

  function decorarAcciones() {
    if (accionesDecoradas) return;
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
    accionesDecoradas = true;
  }

  function conectarObserver() {
    if (!observer) observer = new MutationObserver(() => programar('render', 90));
    observer.disconnect();
    const tarjetas = document.getElementById('tarjetas-grid');
    const prestamos = document.getElementById('prestamos-grid');
    if (tarjetas) observer.observe(tarjetas, { childList: true });
    if (prestamos) observer.observe(prestamos, { childList: true });
  }

  async function actualizar(forzar = false) {
    if (actualizando) return false;
    if (!forzar && !document.getElementById('page-deudas')) return false;
    actualizando = true;
    observer?.disconnect();
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
      conectarObserver();
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
    conectarObserver();
    programar('inicio', 500);
  }

  ['hf:deuda-actualizada', 'hf:deudas-recalculadas', 'hf:estado-cuenta-confirmado', 'hf:gastos-actualizados'].forEach(nombre => {
    window.addEventListener(nombre, () => programar(nombre, 100));
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) programar('visible', 100); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
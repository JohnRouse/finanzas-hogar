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
    if (resumen.fuente === 'estado-cuenta') return 'Último estado de cuenta más compras y pagos posteriores.';
    if (resumen.fuente === 'saldo-confirmado') return `Saldo confirmado${resumen.saldoConfirmadoEn ? ` el ${new Date(resumen.saldoConfirmadoEn).toLocaleDateString('es-PE')}` : ''}.`;
    if (resumen.fuente === 'saldo-confirmado-con-movimientos') return 'Último saldo confirmado más movimientos nuevos.';
    return 'Saldo calculado con los movimientos registrados en la app.';
  }

  function actualizarDatosPago(card, resumen) {
    const bloque = card.querySelector('.statement-summary');
    if (!bloque) return;
    const minimo = resumen.pagoMinimo;
    const vence = resumen.fechaVencimiento;
    if (minimo > 0 || vence) {
      bloque.classList.remove('empty');
      bloque.innerHTML = `
        <div><small>Pago mínimo</small><strong>${minimo > 0 ? moneda(minimo) : 'No informado'}</strong></div>
        <div><small>Próximo vencimiento</small><strong>${vence ? new Date(`${vence}T12:00:00`).toLocaleDateString('es-PE', { day:'2-digit', month:'short' }) : 'No informado'}</strong></div>
        <span>Puedes cambiar estos datos desde “Actualizar saldos”, en la parte superior.</span>`;
    } else {
      bloque.classList.add('empty');
      bloque.innerHTML = '<span>Pago mínimo y vencimiento no informados. Puedes agregarlos desde “Actualizar saldos”, en la parte superior.</span>';
    }
  }

  function actualizarEstadoVisual(card, resumen) {
    const estado = card.querySelector('.reconcile-status');
    if (!estado) return;
    if (resumen.fuente === 'estado-cuenta') {
      estado.className = 'reconcile-status reconciled';
      estado.innerHTML = '<span>Saldo basado en información bancaria</span><small>Incluye las compras y pagos registrados posteriormente.</small>';
      return;
    }
    if (resumen.fuente === 'saldo-confirmado') {
      estado.className = 'reconcile-status reconciled';
      estado.innerHTML = '<span>Saldo confirmado</span><small>Coincide con la última actualización manual.</small>';
      return;
    }
    estado.className = resumen.fuente === 'saldo-confirmado-con-movimientos' ? 'reconcile-status pending' : 'reconcile-status neutral';
    estado.innerHTML = resumen.fuente === 'saldo-confirmado-con-movimientos'
      ? '<span>Saldo estimado por movimientos nuevos</span><small>Confírmalo nuevamente desde el recuadro superior cuando revises el banco.</small>'
      : '<span>Saldo calculado por la app</span><small>Confírmalo desde el recuadro superior cuando revises el banco.</small>';
  }

  function enriquecerTarjeta(resumen) {
    const card = document.getElementById(`tarjeta-card-${resumen.tarjetaId}`);
    if (!card) return;
    const label = card.querySelector('.debt-label-main');
    const total = card.querySelector('.debt-total');
    if (label) label.textContent = 'Deuda total pendiente';
    if (total) total.textContent = moneda(resumen.deudaEstimada);

    let detalle = card.querySelector('.hf-live-debt-breakdown');
    if (resumen.tieneEstado) {
      if (!detalle) {
        detalle = document.createElement('div');
        detalle.className = 'hf-live-debt-breakdown';
        total?.insertAdjacentElement('afterend', detalle);
      }
      const contenido = `
        <div><span>Facturado</span><strong>${moneda(resumen.facturada)}</strong></div>
        <div><span>Compras nuevas</span><strong>+ ${moneda(resumen.comprasPosteriores)}</strong></div>
        <div><span>Pagos registrados</span><strong>− ${moneda(resumen.pagosPosteriores)}</strong></div>
        <small>${textoFuente(resumen)}</small>`;
      if (detalle.innerHTML !== contenido) detalle.innerHTML = contenido;
    } else {
      detalle?.remove();
    }

    actualizarDatosPago(card, resumen);
    actualizarEstadoVisual(card, resumen);

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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
})();
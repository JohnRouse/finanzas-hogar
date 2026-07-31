/* Hogar Finanzas — Etapa 12: cierre financiero mensual */
(() => {
  'use strict';
  if (window.HFCierreFinancieroMensual) return;

  const VERSION = '18.0';
  const COLECCION = 'cierres_financieros';
  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const escapar = (valor = '') => String(valor).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const normalizar = (valor = '') => String(valor).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const estado = {
    iniciado:false,
    observer:null,
    timer:null,
    paso:1,
    mes:'',
    tarjetas:[],
    prestamos:[],
    gastos:[],
    cierreExistente:null,
    cierreAnterior:null,
    resumen:null,
    guardando:false
  };

  function toast(mensaje) {
    if (typeof window.showToast === 'function') window.showToast(mensaje);
    else console.info(mensaje);
  }

  function nombreMes(mes) {
    if (!/^\d{4}-\d{2}$/.test(String(mes || ''))) return String(mes || '');
    const [anio, indice] = mes.split('-').map(Number);
    return `${MESES[indice - 1].charAt(0).toUpperCase()}${MESES[indice - 1].slice(1)} ${anio}`;
  }

  function mesAnterior(mes) {
    const [anio, indice] = String(mes).split('-').map(Number);
    const fecha = new Date(anio, indice - 2, 1);
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  }

  function mesVisible() {
    const texto = normalizar($('month-display')?.textContent || '');
    const coincidencia = texto.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})/);
    if (coincidencia) {
      const indice = MESES.indexOf(coincidencia[1]) + 1;
      return `${coincidencia[2]}-${String(indice).padStart(2, '0')}`;
    }
    return typeof window.DB?.getMesActual === 'function' ? DB.getMesActual() : new Date().toISOString().slice(0, 7);
  }

  function puedeEditarMes(mes) {
    const actual = typeof window.DB?.getMesActual === 'function' ? DB.getMesActual() : new Date().toISOString().slice(0, 7);
    return String(mes) === String(actual);
  }

  function valorPrestamo(prestamo = {}) {
    const candidatos = [prestamo.saldoPendiente, prestamo.saldo, prestamo.deuda, prestamo.capitalPendiente, prestamo.montoPendiente, prestamo.monto, prestamo.total];
    const encontrado = candidatos.find(valor => valor !== undefined && valor !== null && valor !== '');
    return Math.max(0, numero(encontrado));
  }

  function cuotaPrestamo(prestamo = {}) {
    const candidatos = [prestamo.cuotaMensual, prestamo.cuota, prestamo.pagoMensual, prestamo.minimo];
    const encontrado = candidatos.find(valor => valor !== undefined && valor !== null && valor !== '');
    return Math.max(0, numero(encontrado));
  }

  function vencimientoPrestamo(prestamo = {}) {
    return prestamo.proximoVencimiento || prestamo.fechaVencimiento || prestamo.vencimiento || '';
  }

  function nombreTarjeta(tarjeta = {}) {
    return tarjeta.nombre || tarjeta.banco || 'Tarjeta';
  }

  function nombrePrestamo(prestamo = {}) {
    return prestamo.nombre || prestamo.entidad || prestamo.banco || 'Préstamo';
  }

  function deudaTarjeta(tarjeta = {}) {
    const calculada = window.HFDeudasActuales?.obtenerTarjeta?.(tarjeta.id);
    return Math.max(0, numero(calculada?.deudaEstimada ?? tarjeta.deuda ?? tarjeta.saldo));
  }

  function esPagoTarjeta(gasto = {}) {
    return gasto.tipoMovimiento === 'pagoTarjeta' || (gasto.cat === 'Deudas' && /^pago tarjeta:/i.test(String(gasto.desc || '')));
  }

  function esPagoPrestamo(gasto = {}) {
    return gasto.tipoMovimiento === 'pagoPrestamo' || (gasto.cat === 'Deudas' && /^pago pr[eé]stamo:/i.test(String(gasto.desc || '')));
  }

  function esCompraCredito(gasto = {}) {
    return gasto.medio === 'tarjeta' && !esPagoTarjeta(gasto) && !esPagoPrestamo(gasto);
  }

  function diasHasta(fecha, hoy = new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ''))) return null;
    const destino = new Date(`${fecha}T12:00:00`);
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12, 0, 0);
    return Math.ceil((destino - base) / 86400000);
  }

  function calcularVencimientos(tarjetas = [], prestamos = [], hoy = new Date()) {
    const obligaciones = [
      ...tarjetas.map(t => ({ monto:numero(t.pagoMinimo), fecha:t.fechaVencimiento })),
      ...prestamos.map(p => ({ monto:numero(p.cuota), fecha:p.fechaVencimiento }))
    ].filter(item => item.monto > 0 && item.fecha);

    const sumarHasta = limite => redondear(obligaciones.reduce((total, item) => {
      const dias = diasHasta(item.fecha, hoy);
      return total + (dias !== null && dias >= 0 && dias <= limite ? item.monto : 0);
    }, 0));

    return { proximos7:sumarHasta(7), proximos15:sumarHasta(15), proximos30:sumarHasta(30) };
  }

  function normalizarTarjetas(tarjetas = []) {
    return tarjetas.map(t => ({
      id:String(t.id || ''),
      nombre:nombreTarjeta(t),
      ultimosDigitos:t.ultimosDigitos || '',
      limite:redondear(t.limite),
      deudaConfirmada:redondear(t.deudaConfirmada ?? deudaTarjeta(t)),
      pagoMinimo:redondear(t.pagoMinimo ?? t.estadoCuenta?.pagoMinimo),
      fechaVencimiento:t.fechaVencimiento ?? t.estadoCuenta?.fechaVencimiento ?? ''
    }));
  }

  function normalizarPrestamos(prestamos = []) {
    return prestamos.map(p => ({
      id:String(p.id || ''),
      nombre:nombrePrestamo(p),
      saldoPendiente:redondear(p.saldoPendiente ?? valorPrestamo(p)),
      cuota:redondear(p.cuota ?? cuotaPrestamo(p)),
      fechaVencimiento:p.fechaVencimiento ?? vencimientoPrestamo(p) ?? ''
    }));
  }

  function calcularResumen({ tarjetas = [], prestamos = [], gastos = [], cierreAnterior = null, hoy = new Date() } = {}) {
    const tarjetasNormalizadas = normalizarTarjetas(tarjetas);
    const prestamosNormalizados = normalizarPrestamos(prestamos);
    const deudaTarjetas = redondear(tarjetasNormalizadas.reduce((suma, t) => suma + t.deudaConfirmada, 0));
    const deudaPrestamos = redondear(prestamosNormalizados.reduce((suma, p) => suma + p.saldoPendiente, 0));
    const pagoMinimoTarjetas = redondear(tarjetasNormalizadas.reduce((suma, t) => suma + t.pagoMinimo, 0));
    const cuotasPrestamos = redondear(prestamosNormalizados.reduce((suma, p) => suma + p.cuota, 0));
    const comprasCreditoMes = redondear(gastos.filter(esCompraCredito).reduce((suma, g) => suma + numero(g.monto), 0));
    const pagosTarjetasMes = redondear(gastos.filter(esPagoTarjeta).reduce((suma, g) => suma + numero(g.monto), 0));
    const pagosPrestamosMes = redondear(gastos.filter(esPagoPrestamo).reduce((suma, g) => suma + numero(g.monto), 0));
    const deudaTotal = redondear(deudaTarjetas + deudaPrestamos);
    const compromisosMes = redondear(pagoMinimoTarjetas + cuotasPrestamos);
    const deudaAnterior = cierreAnterior?.totales?.deudaTotal;
    const variacionDeuda = deudaAnterior === undefined || deudaAnterior === null ? null : redondear(deudaTotal - numero(deudaAnterior));

    return {
      tarjetas:tarjetasNormalizadas,
      prestamos:prestamosNormalizados,
      totales:{
        deudaTarjetas,
        deudaPrestamos,
        deudaTotal,
        pagoMinimoTarjetas,
        cuotasPrestamos,
        compromisosMes,
        comprasCreditoMes,
        pagosTarjetasMes,
        pagosPrestamosMes,
        pagosDeudaMes:redondear(pagosTarjetasMes + pagosPrestamosMes),
        movimientosMes:gastos.length
      },
      vencimientos:calcularVencimientos(tarjetasNormalizadas, prestamosNormalizados, hoy),
      comparacion:{ deudaAnterior:deudaAnterior == null ? null : redondear(deudaAnterior), variacionDeuda }
    };
  }

  async function obtenerCierre(mes) {
    if (!window.db || !window.DB?.hogarId || !mes) return null;
    const documento = await window.db.collection('hogares').doc(DB.hogarId).collection(COLECCION).doc(mes).get();
    return documento.exists ? { id:documento.id, ...documento.data() } : null;
  }

  async function obtenerUltimosCierres(limite = 12) {
    if (!window.db || !window.DB?.hogarId) return [];
    const snapshot = await window.db.collection('hogares').doc(DB.hogarId).collection(COLECCION).orderBy('mes', 'desc').limit(limite).get();
    return snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));
  }

  function inyectarModal() {
    if ($('hfCierreMensualModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfCierreMensualModal" onclick="closeModalOutside(event,'hfCierreMensualModal')">
        <div class="modal-sheet hf-app-sheet hf-form-sheet hf-month-close-sheet" style="position:relative">
          <button class="modal-close hf-sheet-close" type="button" onclick="closeModal('hfCierreMensualModal')" aria-label="Cerrar">✕</button>
          <div class="modal-handle"></div>
          <header class="hf-month-close-header">
            <span class="hf-month-close-icon">✓</span>
            <div><div class="modal-title">Cierre financiero</div><p id="hf-month-close-subtitle">Revisa y guarda una fotografía del mes.</p></div>
          </header>
          <div id="hf-month-close-progress" class="hf-month-close-progress" aria-label="Progreso del cierre"></div>
          <div id="hf-month-close-content" class="hf-month-close-content"><div class="hf-close-loading">Cargando información…</div></div>
          <footer id="hf-month-close-footer" class="hf-month-close-footer"></footer>
        </div>
      </div>`);
  }

  function inyectarLanzador() {
    const pagina = $('page-deudas');
    const kpis = pagina?.querySelector('.kpi-grid');
    if (!pagina || !kpis || $('hf-month-close-launcher')) return;
    kpis.insertAdjacentHTML('afterend', `
      <section id="hf-month-close-launcher" class="hf-month-close-launcher">
        <div class="hf-month-close-launcher-icon">✓</div>
        <div class="hf-month-close-launcher-copy">
          <span>Cierre del mes</span>
          <strong id="hf-month-close-launcher-title">Revisar información financiera</strong>
          <small id="hf-month-close-launcher-help">Confirma saldos, vencimientos y guarda el resumen mensual.</small>
        </div>
        <button id="hf-month-close-open" type="button" onclick="HFCierreFinancieroMensual.abrir()">Revisar</button>
      </section>`);
    actualizarLanzador();
  }

  async function actualizarLanzador() {
    const lanzador = $('hf-month-close-launcher');
    if (!lanzador || !window.DB?.hogarId) return;
    const mes = mesVisible();
    const titulo = $('hf-month-close-launcher-title');
    const ayuda = $('hf-month-close-launcher-help');
    const boton = $('hf-month-close-open');
    if (titulo) titulo.textContent = nombreMes(mes);
    if (ayuda) ayuda.textContent = puedeEditarMes(mes)
      ? 'Confirma saldos, pagos mínimos y vencimientos antes de guardar.'
      : 'Consulta la fotografía financiera guardada para este mes.';
    if (boton) boton.textContent = puedeEditarMes(mes) ? 'Revisar' : 'Consultar';

    try {
      const cierre = await obtenerCierre(mes);
      lanzador.classList.toggle('is-closed', Boolean(cierre));
      if (cierre && ayuda) ayuda.textContent = `Cierre guardado · deuda total ${moneda(cierre.totales?.deudaTotal)}`;
      if (cierre && boton) boton.textContent = puedeEditarMes(mes) ? 'Ver o actualizar' : 'Ver cierre';
    } catch (_) {}
  }

  function renderProgreso() {
    const progreso = $('hf-month-close-progress');
    if (!progreso) return;
    const pasos = estado.paso >= 4
      ? [{n:1,t:'Saldos'},{n:2,t:'Resumen'},{n:3,t:'Guardar'}]
      : [{n:1,t:'Saldos'},{n:2,t:'Resumen'},{n:3,t:'Guardar'}];
    progreso.innerHTML = pasos.map(p => `<span class="${estado.paso >= p.n ? 'active' : ''} ${estado.paso === p.n ? 'current' : ''}"><i>${p.n}</i>${p.t}</span>`).join('');
  }

  function renderCargando() {
    $('hf-month-close-content').innerHTML = '<div class="hf-close-loading"><span></span>Cargando saldos y movimientos…</div>';
    $('hf-month-close-footer').innerHTML = '';
  }

  function renderPasoSaldos() {
    const contenido = $('hf-month-close-content');
    const pie = $('hf-month-close-footer');
    if (!contenido || !pie) return;

    if (!puedeEditarMes(estado.mes) && !estado.cierreExistente) {
      contenido.innerHTML = `<div class="hf-close-empty"><strong>No existe un cierre para ${escapar(nombreMes(estado.mes))}</strong><p>Los cierres nuevos solo se crean desde el mes actual para evitar que un saldo antiguo reemplace la deuda de hoy.</p></div>`;
      pie.innerHTML = '<button class="modal-btn secondary" type="button" onclick="closeModal(\'hfCierreMensualModal\')">Cerrar</button>';
      return;
    }

    if (!puedeEditarMes(estado.mes) && estado.cierreExistente) {
      estado.resumen = {
        tarjetas:estado.cierreExistente.tarjetas || [],
        prestamos:estado.cierreExistente.prestamos || [],
        totales:estado.cierreExistente.totales || {},
        vencimientos:estado.cierreExistente.vencimientos || {},
        comparacion:estado.cierreExistente.comparacion || {}
      };
      estado.paso = 2;
      render();
      return;
    }

    const tarjetas = estado.tarjetas;
    const prestamos = normalizarPrestamos(estado.prestamos);
    contenido.innerHTML = `
      <div class="hf-close-step-intro"><strong>1. Confirma lo que debes hoy</strong><p>Copia la deuda total que muestra cada banco. El cierre también guardará los pagos mínimos y vencimientos.</p></div>
      <div class="hf-close-card-list">
        ${tarjetas.length ? tarjetas.map(t => {
          const ec = t.estadoCuenta || {};
          const deuda = deudaTarjeta(t);
          return `<article class="hf-close-debt-card" data-close-card-id="${escapar(t.id)}">
            <div class="hf-close-debt-head"><div><strong>${escapar(nombreTarjeta(t))}</strong><small>${t.ultimosDigitos ? `•••• ${escapar(t.ultimosDigitos)}` : 'Tarjeta de crédito'}</small></div><span>${moneda(deuda)}</span></div>
            <label>Deuda total confirmada<input class="hf-close-card-debt" type="number" min="0" step="0.01" inputmode="decimal" value="${deuda.toFixed(2)}"></label>
            <div class="hf-close-two-fields">
              <label>Pago mínimo<input class="hf-close-card-minimum" type="number" min="0" step="0.01" inputmode="decimal" value="${ec.pagoMinimo == null ? '' : numero(ec.pagoMinimo).toFixed(2)}" placeholder="Opcional"></label>
              <label>Vencimiento<input class="hf-close-card-due" type="date" value="${escapar(ec.fechaVencimiento || '')}"></label>
            </div>
          </article>`;
        }).join('') : '<div class="hf-close-empty"><strong>No hay tarjetas registradas</strong><p>El cierre continuará con los préstamos y movimientos existentes.</p></div>'}
      </div>
      ${prestamos.length ? `<div class="hf-close-readonly-title">Préstamos incluidos</div><div class="hf-close-loan-list">${prestamos.map(p => `<div><span><strong>${escapar(p.nombre)}</strong><small>${p.fechaVencimiento ? `Vence ${escapar(p.fechaVencimiento)}` : 'Sin vencimiento informado'}</small></span><b>${moneda(p.saldoPendiente)}</b><em>Cuota ${moneda(p.cuota)}</em></div>`).join('')}</div>` : ''}`;
    pie.innerHTML = '<button class="modal-btn primary" type="button" id="hf-close-next">Continuar al resumen</button>';
    $('hf-close-next')?.addEventListener('click', avanzarDesdeSaldos);
  }

  function recogerTarjetasFormulario() {
    const filas = [...document.querySelectorAll('#hf-month-close-content [data-close-card-id]')];
    return filas.map(fila => {
      const original = estado.tarjetas.find(t => String(t.id) === String(fila.dataset.closeCardId)) || {};
      return {
        ...original,
        deudaConfirmada:Math.max(0, numero(fila.querySelector('.hf-close-card-debt')?.value)),
        pagoMinimo:Math.max(0, numero(fila.querySelector('.hf-close-card-minimum')?.value)),
        fechaVencimiento:fila.querySelector('.hf-close-card-due')?.value || ''
      };
    });
  }

  function avanzarDesdeSaldos() {
    const tarjetas = recogerTarjetasFormulario();
    const invalida = tarjetas.find(t => !Number.isFinite(Number(t.deudaConfirmada)) || Number(t.deudaConfirmada) < 0);
    if (invalida) return toast('Revisa los saldos ingresados.');
    estado.resumen = calcularResumen({ tarjetas, prestamos:estado.prestamos, gastos:estado.gastos, cierreAnterior:estado.cierreAnterior });
    estado.paso = 2;
    render();
  }

  function variacionHTML() {
    const variacion = estado.resumen?.comparacion?.variacionDeuda;
    if (variacion === null || variacion === undefined) return '<span class="neutral">Sin cierre anterior para comparar</span>';
    if (variacion === 0) return '<span class="neutral">La deuda no cambió frente al cierre anterior</span>';
    return variacion < 0
      ? `<span class="good">La deuda bajó ${moneda(Math.abs(variacion))}</span>`
      : `<span class="bad">La deuda aumentó ${moneda(variacion)}</span>`;
  }

  function renderPasoResumen() {
    const r = estado.resumen;
    const t = r?.totales || {};
    const v = r?.vencimientos || {};
    const soloLectura = !puedeEditarMes(estado.mes);
    $('hf-month-close-content').innerHTML = `
      <div class="hf-close-step-intro"><strong>2. Resumen de ${escapar(nombreMes(estado.mes))}</strong><p>${soloLectura ? 'Esta es la fotografía guardada para el mes.' : 'Comprueba los totales antes de guardar el cierre.'}</p></div>
      <div class="hf-close-total-card"><span>Deuda total del hogar</span><strong>${moneda(t.deudaTotal)}</strong>${variacionHTML()}</div>
      <div class="hf-close-metric-grid">
        <div><span>Tarjetas</span><strong>${moneda(t.deudaTarjetas)}</strong></div>
        <div><span>Préstamos</span><strong>${moneda(t.deudaPrestamos)}</strong></div>
        <div><span>Pagos mínimos</span><strong>${moneda(t.pagoMinimoTarjetas)}</strong></div>
        <div><span>Cuotas</span><strong>${moneda(t.cuotasPrestamos)}</strong></div>
        <div><span>Compras con crédito</span><strong>${moneda(t.comprasCreditoMes)}</strong></div>
        <div><span>Pagado a deudas</span><strong>${moneda(t.pagosDeudaMes)}</strong></div>
      </div>
      <div class="hf-close-due-card"><strong>Próximos vencimientos</strong><div><span>7 días<b>${moneda(v.proximos7)}</b></span><span>15 días<b>${moneda(v.proximos15)}</b></span><span>30 días<b>${moneda(v.proximos30)}</b></span></div></div>
      <div class="hf-close-source-note">Se revisaron ${numero(t.movimientosMes)} movimientos del mes. Las compras con crédito aumentan deuda; los pagos de tarjetas y préstamos la reducen.</div>`;

    $('hf-month-close-footer').innerHTML = soloLectura
      ? '<button class="modal-btn secondary" type="button" onclick="closeModal(\'hfCierreMensualModal\')">Cerrar</button>'
      : '<button class="modal-btn secondary" type="button" id="hf-close-back">Volver</button><button class="modal-btn primary" type="button" id="hf-close-next">Confirmar cierre</button>';
    $('hf-close-back')?.addEventListener('click', () => { estado.paso = 1; render(); });
    $('hf-close-next')?.addEventListener('click', () => { estado.paso = 3; render(); });
  }

  function renderPasoConfirmar() {
    const t = estado.resumen?.totales || {};
    $('hf-month-close-content').innerHTML = `
      <div class="hf-close-confirm-card">
        <span class="hf-close-confirm-icon">✓</span>
        <strong>Guardar cierre de ${escapar(nombreMes(estado.mes))}</strong>
        <p>Se actualizarán los saldos actuales de las tarjetas y se guardará una fotografía histórica que después no cambiará cuando registres nuevos movimientos.</p>
        <div><span>Deuda total</span><b>${moneda(t.deudaTotal)}</b></div>
        <div><span>Compromisos informados</span><b>${moneda(t.compromisosMes)}</b></div>
        <label class="hf-close-check"><input type="checkbox" id="hf-close-reviewed"> He revisado los saldos y vencimientos mostrados.</label>
      </div>`;
    $('hf-month-close-footer').innerHTML = '<button class="modal-btn secondary" type="button" id="hf-close-back">Volver</button><button class="modal-btn primary" type="button" id="hf-close-save">Guardar cierre</button>';
    $('hf-close-back')?.addEventListener('click', () => { estado.paso = 2; render(); });
    $('hf-close-save')?.addEventListener('click', guardarCierre);
  }

  function renderExito() {
    $('hf-month-close-content').innerHTML = `
      <div class="hf-close-success"><span>✓</span><strong>Cierre guardado</strong><p>La fotografía de ${escapar(nombreMes(estado.mes))} quedó registrada. Podrás consultarla al volver a ese mes.</p><div>Deuda total <b>${moneda(estado.resumen?.totales?.deudaTotal)}</b></div></div>`;
    $('hf-month-close-footer').innerHTML = '<button class="modal-btn primary" type="button" onclick="closeModal(\'hfCierreMensualModal\')">Listo</button>';
  }

  function render() {
    renderProgreso();
    const subtitulo = $('hf-month-close-subtitle');
    if (subtitulo) subtitulo.textContent = nombreMes(estado.mes);
    if (estado.paso === 1) renderPasoSaldos();
    else if (estado.paso === 2) renderPasoResumen();
    else if (estado.paso === 3) renderPasoConfirmar();
    else renderExito();
  }

  async function cargar(mes) {
    estado.mes = mes;
    estado.paso = 1;
    estado.resumen = null;
    renderCargando();
    renderProgreso();
    const [tarjetas, prestamos, gastos, cierreExistente, cierreAnterior] = await Promise.all([
      window.DB?.getTarjetas?.() || [],
      window.DB?.getPrestamos?.() || [],
      window.DB?.getGastos?.(mes) || [],
      obtenerCierre(mes),
      obtenerCierre(mesAnterior(mes))
    ]);
    estado.tarjetas = Array.isArray(tarjetas) ? tarjetas : [];
    estado.prestamos = Array.isArray(prestamos) ? prestamos : [];
    estado.gastos = Array.isArray(gastos) ? gastos : [];
    estado.cierreExistente = cierreExistente;
    estado.cierreAnterior = cierreAnterior;
    render();
  }

  async function abrir() {
    inyectarModal();
    const mes = mesVisible();
    if (typeof window.openModal === 'function') openModal('hfCierreMensualModal');
    else $('hfCierreMensualModal')?.classList.add('open');
    try {
      await cargar(mes);
    } catch (error) {
      console.error('No se pudo preparar el cierre mensual:', error);
      $('hf-month-close-content').innerHTML = '<div class="hf-close-empty"><strong>No se pudo cargar el cierre</strong><p>Revisa la conexión e inténtalo nuevamente.</p></div>';
      $('hf-month-close-footer').innerHTML = '<button class="modal-btn secondary" type="button" onclick="closeModal(\'hfCierreMensualModal\')">Cerrar</button>';
    }
  }

  async function guardarCierre() {
    if (estado.guardando) return;
    if (!$('hf-close-reviewed')?.checked) return toast('Marca la confirmación después de revisar los datos.');
    if (!puedeEditarMes(estado.mes)) return toast('Solo se puede actualizar el cierre del mes actual.');
    if (!window.db || !window.DB?.hogarId) return toast('No se encontró el hogar vinculado.');

    const boton = $('hf-close-save');
    estado.guardando = true;
    try {
      if (boton) { boton.disabled = true; boton.textContent = 'Guardando…'; }
      const ahora = new Date().toISOString();
      const hogarRef = window.db.collection('hogares').doc(DB.hogarId);
      const batch = window.db.batch();
      const resumen = estado.resumen;

      for (const tarjeta of resumen.tarjetas) {
        const original = estado.tarjetas.find(t => String(t.id) === String(tarjeta.id)) || {};
        batch.set(hogarRef.collection('tarjetas').doc(tarjeta.id), {
          deuda:tarjeta.deudaConfirmada,
          saldoConfirmadoEn:ahora,
          saldoConfirmadoManual:true,
          origenSaldo:'cierre-mensual',
          saldoEstimado:false,
          pendienteConciliar:false,
          ultimaConciliacion:ahora,
          estadoCuenta:{
            ...(original.estadoCuenta || {}),
            pagoMinimo:tarjeta.pagoMinimo || null,
            fechaVencimiento:tarjeta.fechaVencimiento || '',
            actualizadoDatosPagoEn:ahora
          },
          actualizadoEn:ahora
        }, { merge:true });
      }

      const cierre = {
        schemaVersion:1,
        mes:estado.mes,
        estado:'cerrado',
        cerradoEn:ahora,
        cerradoPor:localStorage.getItem('miembroActualId') || localStorage.getItem('miUsuarioTipo') || 'dispositivo',
        tarjetas:resumen.tarjetas,
        prestamos:resumen.prestamos,
        totales:resumen.totales,
        vencimientos:resumen.vencimientos,
        comparacion:resumen.comparacion,
        fuente:'cierre-financiero-mensual',
        actualizadoServidor:window.firebase?.firestore?.FieldValue?.serverTimestamp?.() || ahora
      };
      batch.set(hogarRef.collection(COLECCION).doc(estado.mes), cierre, { merge:true });
      await batch.commit();

      estado.cierreExistente = cierre;
      estado.paso = 4;
      render();
      await window.HFDeudasActuales?.actualizar?.(true);
      if (typeof window.renderTodo === 'function') await window.renderTodo();
      window.dispatchEvent(new CustomEvent('hf:cierre-mensual-guardado', { detail:{ mes:estado.mes, cierre } }));
      actualizarLanzador();
    } catch (error) {
      console.error('No se pudo guardar el cierre mensual:', error);
      toast('No se pudo guardar el cierre. Revisa la conexión.');
    } finally {
      estado.guardando = false;
      if (boton && estado.paso !== 4) { boton.disabled = false; boton.textContent = 'Guardar cierre'; }
    }
  }

  function decorar() {
    inyectarModal();
    inyectarLanzador();
  }

  function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado = true;
    decorar();
    const display = $('month-display');
    if (display) new MutationObserver(() => actualizarLanzador()).observe(display, { childList:true, characterData:true, subtree:true });
    estado.observer = new MutationObserver(() => {
      clearTimeout(estado.timer);
      estado.timer = setTimeout(decorar, 120);
    });
    estado.observer.observe(document.body, { childList:true, subtree:true });
  }

  function obtenerEstado() {
    return {
      version:VERSION,
      coleccion:COLECCION,
      iniciado:estado.iniciado,
      mesVisible:mesVisible(),
      hogarVinculado:Boolean(window.DB?.hogarId),
      modalDisponible:Boolean($('hfCierreMensualModal')),
      lanzadorDisponible:Boolean($('hf-month-close-launcher'))
    };
  }

  window.HFCierreFinancieroMensual = Object.freeze({
    iniciar,
    abrir,
    guardarCierre,
    obtenerCierre,
    obtenerUltimosCierres,
    calcularResumen,
    puedeEditarMes,
    obtenerEstado
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 240), { once:true });
  else setTimeout(iniciar, 120);
})();
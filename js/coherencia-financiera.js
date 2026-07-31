/* Hogar Finanzas — Etapa 12.2: coherencia financiera de Resumen y Ahorro */
(() => {
  'use strict';
  if (window.HFCoherenciaFinanciera) return;

  const VERSION = '18.2';
  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const escapar = (valor = '') => String(valor).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const estado = { iniciado:false, actualizando:false, timer:null, observer:null, alertasExpandidas:false, ultimoResumen:null };

  function esPagoTarjeta(g = {}) {
    return g.tipoMovimiento === 'pagoTarjeta' || g.tipo === 'pago-tarjeta' || (g.cat === 'Deudas' && /^pago tarjeta:/i.test(String(g.desc || '')));
  }

  function esPagoPrestamo(g = {}) {
    return g.tipoMovimiento === 'pagoPrestamo' || g.tipo === 'pago-prestamo' || (g.cat === 'Deudas' && /^pago pr[eé]stamo:/i.test(String(g.desc || '')));
  }

  function esPagoDeuda(g = {}) { return esPagoTarjeta(g) || esPagoPrestamo(g); }

  function saldoPrestamo(p = {}) {
    const valores = [p.saldoPendiente, p.saldo, p.deuda, p.capitalPendiente, p.montoPendiente, p.monto];
    return Math.max(0, numero(valores.find(v => v !== undefined && v !== null && v !== '')));
  }

  function cuotaPrestamo(p = {}) {
    const valores = [p.cuotaMensual, p.cuota, p.pagoMensual, p.minimo];
    return Math.max(0, numero(valores.find(v => v !== undefined && v !== null && v !== '')));
  }

  function calcularResumen({ ingresos = [], gastos = [], metas = [], tarjetas = [], prestamos = [] } = {}) {
    const ingresoTotal = redondear(ingresos.reduce((s, i) => s + numero(i.monto), 0));
    const pagos = gastos.filter(esPagoDeuda);
    const consumos = gastos.filter(g => !esPagoDeuda(g));
    const consumosEfectivo = consumos.filter(g => g.medio !== 'tarjeta').reduce((s, g) => s + numero(g.monto), 0);
    const comprasCredito = consumos.filter(g => g.medio === 'tarjeta').reduce((s, g) => s + numero(g.monto), 0);
    const pagosDeudaMes = pagos.reduce((s, g) => s + numero(g.monto), 0);
    const ahorroReservado = metas.reduce((s, m) => s + numero(m.actual), 0);
    const objetivoMetas = metas.reduce((s, m) => s + numero(m.objetivo), 0);
    const disponibleSinAsignar = ingresoTotal - consumosEfectivo - pagosDeudaMes;
    const necesidades = consumos.filter(g => ['Alimentación','Servicios','Transporte','Salud','Hogar'].includes(g.cat)).reduce((s,g) => s + numero(g.monto), 0);
    const gustos = consumos.filter(g => ['Entret.','Otros'].includes(g.cat)).reduce((s,g) => s + numero(g.monto), 0);
    const minimos = tarjetas.reduce((s,t) => s + numero(t.estadoCuenta?.pagoMinimo ?? t.pagoMinimo), 0);
    const cuotas = prestamos.reduce((s,p) => s + cuotaPrestamo(p), 0);
    const deudaTarjetas = tarjetas.reduce((s,t) => {
      const viva = window.HFDeudasActuales?.obtenerTarjeta?.(t.id);
      return s + Math.max(0, numero(viva?.deudaEstimada ?? t.deuda ?? t.saldo));
    }, 0);
    const deudaPrestamos = prestamos.reduce((s,p) => s + saldoPrestamo(p), 0);

    return {
      ingresoTotal,
      consumosEfectivo:redondear(consumosEfectivo),
      comprasCredito:redondear(comprasCredito),
      pagosDeudaMes:redondear(pagosDeudaMes),
      ahorroReservado:redondear(ahorroReservado),
      objetivoMetas:redondear(objetivoMetas),
      disponibleSinAsignar:redondear(disponibleSinAsignar),
      necesidades:redondear(necesidades),
      gustos:redondear(gustos),
      objetivoFinanciero20:redondear(ingresoTotal * 0.20),
      minimos:redondear(minimos),
      cuotas:redondear(cuotas),
      compromisos:redondear(minimos + cuotas),
      deudaTotal:redondear(deudaTarjetas + deudaPrestamos)
    };
  }

  function proyeccionGlobal(deudaTotal, pagoMensual) {
    const deuda = Math.max(0, numero(deudaTotal));
    const pago = Math.max(0, numero(pagoMensual));
    return {
      deudaTotal:redondear(deuda), pagoMensual:redondear(pago),
      meses:deuda > 0 && pago > 0 ? Math.ceil(deuda / pago) : null,
      porcentaje:deuda > 0 ? Math.min(100, pago / deuda * 100) : 0
    };
  }

  function asignarHTML(elemento, html) {
    if (elemento && elemento.innerHTML !== html) elemento.innerHTML = html;
  }

  function asignarTexto(elemento, texto) {
    if (elemento && elemento.textContent !== texto) elemento.textContent = texto;
  }

  function filaObjetivo(titulo, valor, detalle, tono = '') {
    return `<div class="hf-financial-objective ${tono}"><span>${escapar(titulo)}</span><strong>${moneda(valor)}</strong><small>${escapar(detalle)}</small></div>`;
  }

  function aplicarObjetivos(r) {
    const bloque = $('regla-502030');
    if (!bloque) return;
    asignarTexto(bloque.closest('.section')?.querySelector('.section-title'), 'Objetivos financieros del mes');
    asignarHTML(bloque, `
      <div class="hf-objectives-financial">
        <div class="hf-objectives-intro"><strong>El dinero solo cuenta cuando tiene un destino real</strong><p>El disponible no es ahorro hasta registrarlo en una meta, ni pago de deuda hasta registrar el abono.</p></div>
        <div class="hf-objectives-grid">
          ${filaObjetivo('Ahorro reservado', r.ahorroReservado, r.objetivoMetas > 0 ? `Fondo acumulado de metas por ${moneda(r.objetivoMetas)}` : 'Dinero registrado realmente en metas', r.ahorroReservado > 0 ? 'good' : '')}
          ${filaObjetivo('Pagado a deudas', r.pagosDeudaMes, r.compromisos > 0 ? `Compromisos informados: ${moneda(r.compromisos)}` : 'Pagos registrados durante el mes', r.pagosDeudaMes > 0 ? 'debt' : '')}
          ${filaObjetivo('Disponible según movimientos', r.disponibleSinAsignar, `Referencia sugerida del 20%: ${moneda(r.objetivoFinanciero20)}`, r.disponibleSinAsignar < 0 ? 'danger' : 'available')}
        </div>
        <div class="hf-objectives-note">Necesidades pagadas: <b>${moneda(r.necesidades)}</b> · Gustos pagados: <b>${moneda(r.gustos)}</b>. Las compras con tarjeta por ${moneda(r.comprasCredito)} aumentan deuda, pero no reducen el efectivo de inmediato.</div>
      </div>`);
  }

  function barraDistribucion(label, valor, ingreso, clase, ayuda) {
    const pct = ingreso > 0 ? Math.max(0, Math.min(100, valor / ingreso * 100)) : 0;
    return `<div class="hf-coherent-dist-row ${clase}"><div><span>${escapar(label)}</span><strong>${moneda(valor)} · ${Math.round(pct)}%</strong></div><div class="hf-coherent-dist-track"><i style="width:${pct.toFixed(1)}%"></i></div><small>${escapar(ayuda)}</small></div>`;
  }

  function aplicarDistribucion(r) {
    const bloque = $('distribucion-content');
    if (!bloque) return;
    if (r.ingresoTotal <= 0) return asignarHTML(bloque, '<div class="empty-state">Configura tus ingresos para ver la distribución real.</div>');
    asignarHTML(bloque, `
      <div class="hf-coherent-distribution">
        ${barraDistribucion('Consumo pagado con dinero del mes', r.consumosEfectivo, r.ingresoTotal, 'consumption', 'Gastos que sí redujeron el efectivo disponible.')}
        ${barraDistribucion('Pagado a deudas', r.pagosDeudaMes, r.ingresoTotal, 'debt', 'Pagos de tarjetas y préstamos realmente registrados.')}
        ${barraDistribucion('Disponible según movimientos', Math.max(0, r.disponibleSinAsignar), r.ingresoTotal, 'available', 'Aún puede destinarse a gastos, ahorro o pagos adicionales.')}
        <div class="hf-credit-separate"><span>Compras con crédito</span><strong>${moneda(r.comprasCredito)}</strong><small>No salen del efectivo hoy; aumentan la deuda pendiente.</small></div>
      </div>`);
  }

  function aplicarPresupuesto(r) {
    const bloque = $('presupuesto-list');
    if (!bloque) return;
    [...bloque.querySelectorAll('.budget-group-title')].forEach(el => {
      if (/construcci[oó]n de patrimonio/i.test(el.textContent || '')) asignarTexto(el, 'Objetivos financieros');
    });
    const ahorro = [...bloque.querySelectorAll('.presup-fila')].find(f => /ahorro mensual|ahorro reservado/i.test(f.querySelector('.presup-label')?.textContent || ''));
    if (!ahorro) return;
    const objetivo = r.objetivoMetas;
    const pct = objetivo > 0 ? Math.min(100, r.ahorroReservado / objetivo * 100) : 0;
    ahorro.classList.add('hf-real-saving-row');
    asignarTexto(ahorro.querySelector('.presup-label'), 'Ahorro reservado');
    asignarTexto(ahorro.querySelector('.presup-montos'), objetivo > 0 ? `Reservado ${moneda(r.ahorroReservado)} / Metas ${moneda(objetivo)}` : `Reservado ${moneda(r.ahorroReservado)} · Sin metas configuradas`);
    const barra = ahorro.querySelector('.presup-bar-fill');
    if (barra) {
      const ancho = `${pct.toFixed(1)}%`;
      if (barra.style.width !== ancho) barra.style.width = ancho;
      barra.style.background = r.ahorroReservado > 0 ? '#2d6a2d' : '#cbd5e1';
    }

    let deuda = bloque.querySelector('.hf-debt-payment-budget-row');
    if (!deuda) {
      deuda = document.createElement('div');
      deuda.className = 'presup-fila hf-debt-payment-budget-row';
      ahorro.insertAdjacentElement('beforebegin', deuda);
    }
    const cumplimiento = r.compromisos > 0 ? Math.min(100, r.pagosDeudaMes / r.compromisos * 100) : 0;
    asignarHTML(deuda, `<div class="presup-header"><span class="presup-label">Pago de deudas este mes</span><span class="presup-montos">Pagado ${moneda(r.pagosDeudaMes)}${r.compromisos > 0 ? ` / Compromisos ${moneda(r.compromisos)}` : ''}</span></div><div class="presup-bar-bg"><div class="presup-bar-fill" style="width:${cumplimiento.toFixed(1)}%;background:#b06a10"></div></div>`);
  }

  function fechaISO(valor) { return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) ? String(valor) : ''; }

  function diasHasta(fecha) {
    if (!fechaISO(fecha)) return null;
    const hoy = new Date();
    return Math.ceil((new Date(`${fecha}T12:00:00`) - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12)) / 86400000);
  }

  function alertaTarjeta(t = {}) {
    const viva = window.HFDeudasActuales?.obtenerTarjeta?.(t.id);
    const deuda = Math.max(0, numero(viva?.deudaEstimada ?? t.deuda ?? t.saldo));
    const linea = Math.max(0, numero(viva?.lineaTotal ?? t.limite ?? t.lineaTotal));
    const disponible = linea > 0 ? linea - deuda : 0;
    const uso = linea > 0 ? deuda / linea * 100 : 0;
    const vence = fechaISO(viva?.fechaVencimiento ?? t.estadoCuenta?.fechaVencimiento ?? t.fechaVencimiento);
    const dias = diasHasta(vence);
    const nombre = t.nombre || t.banco || 'Tarjeta';
    if (linea > 0 && disponible < 0) return { prioridad:0, tipo:'danger', nombre, detalle:`Excedida por ${moneda(Math.abs(disponible))}` };
    if (dias !== null && dias < 0) return { prioridad:0, tipo:'danger', nombre, detalle:`Vencida hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}` };
    if (dias !== null && dias <= 7) return { prioridad:1, tipo:'warning', nombre, detalle:dias === 0 ? 'Vence hoy' : `Vence en ${dias} días` };
    if (uso >= 90) return { prioridad:2, tipo:'warning', nombre, detalle:`${Math.round(uso)}% utilizado` };
    return null;
  }

  function alertaPrestamo(p = {}) {
    const dias = diasHasta(fechaISO(p.proximoVencimiento || p.fechaVencimiento || p.vencimiento));
    if (dias === null || dias > 7) return null;
    const nombre = p.nombre || p.entidad || p.banco || 'Préstamo';
    const cuota = cuotaPrestamo(p);
    if (dias < 0) return { prioridad:0, tipo:'danger', nombre, detalle:`Cuota vencida · ${cuota > 0 ? moneda(cuota) : 'monto no informado'}` };
    return { prioridad:1, tipo:'warning', nombre, detalle:`${dias === 0 ? 'Vence hoy' : `Vence en ${dias} días`}${cuota > 0 ? ` · ${moneda(cuota)}` : ''}` };
  }

  function aplicarAlertas(tarjetas, prestamos) {
    const bloque = $('necesita-atencion');
    if (!bloque) return;
    const alertas = [...tarjetas.map(alertaTarjeta), ...prestamos.map(alertaPrestamo)].filter(Boolean).sort((a,b) => a.prioridad - b.prioridad || a.nombre.localeCompare(b.nombre));
    if (!alertas.length) return asignarHTML(bloque, '<div class="hf-compact-alert-empty"><span>✓</span><div><strong>No hay alertas urgentes</strong><small>No se detectaron vencimientos cercanos ni tarjetas excedidas.</small></div></div>');
    const visibles = estado.alertasExpandidas ? alertas : alertas.slice(0, 3);
    asignarHTML(bloque, `<div class="hf-compact-alert-list">${visibles.map(a => `<div class="hf-compact-alert ${a.tipo}"><i>${a.tipo === 'danger' ? '!' : '•'}</i><div><strong>${escapar(a.nombre)}</strong><small>${escapar(a.detalle)}</small></div></div>`).join('')}</div>${alertas.length > 3 ? `<button type="button" class="hf-alert-toggle" onclick="HFCoherenciaFinanciera.toggleAlertas()">${estado.alertasExpandidas ? 'Ver menos' : `Ver todas (${alertas.length})`}</button>` : ''}`);
  }

  function puedeMostrarTendencia(cierres = []) {
    return cierres.filter(c => Number.isFinite(Number(c?.totales?.ahorroReservado ?? c?.totales?.fondoReservado))).length >= 3;
  }

  async function aplicarTendenciaAhorro() {
    const canvas = $('savingChart');
    if (!canvas) return;
    asignarTexto(canvas.closest('.section')?.querySelector('.section-title'), 'Tendencia del ahorro reservado');
    const contenedor = canvas.parentElement;
    let estadoEl = $('hf-saving-trend-state');
    if (!estadoEl) {
      estadoEl = document.createElement('div');
      estadoEl.id = 'hf-saving-trend-state';
      estadoEl.className = 'hf-saving-trend-state';
      contenedor?.appendChild(estadoEl);
    }

    let cierres = [];
    try { cierres = await window.HFCierreFinancieroMensual?.obtenerUltimosCierres?.(24) || []; } catch (_) {}
    const datos = cierres
      .filter(c => Number.isFinite(Number(c?.totales?.ahorroReservado ?? c?.totales?.fondoReservado)))
      .map(c => ({ mes:c.mes || c.id, valor:numero(c.totales.ahorroReservado ?? c.totales.fondoReservado) }))
      .filter(x => /^\d{4}-\d{2}$/.test(String(x.mes || '')))
      .sort((a,b) => a.mes.localeCompare(b.mes));

    window.Chart?.getChart?.(canvas)?.destroy?.();
    if (datos.length < 3) {
      canvas.style.display = 'none';
      estadoEl.style.display = 'flex';
      asignarHTML(estadoEl, `<span>📈</span><strong>Aún no hay suficiente historial real</strong><p>El gráfico aparecerá después de guardar ahorro reservado en al menos 3 cierres mensuales. Actualmente hay ${datos.length}.</p>${datos.length ? `<div>${datos.map(d => `<b>${escapar(d.mes)} · ${moneda(d.valor)}</b>`).join('')}</div>` : ''}`);
      return;
    }

    estadoEl.style.display = 'none';
    canvas.style.display = 'block';
    if (!window.Chart) return;
    new Chart(canvas, {
      type:'bar',
      data:{ labels:datos.map(d => d.mes), datasets:[{ label:'Ahorro reservado', data:datos.map(d => d.valor), backgroundColor:'#2d6a2d', borderRadius:6, borderSkipped:false }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:c => ` ${moneda(c.parsed.y)}` } } }, scales:{ x:{ grid:{display:false} }, y:{ beginAtZero:true, ticks:{ callback:v => `S/${v}` } } } }
    });
  }

  function aplicarRutaDeuda(r) {
    const ruta = document.querySelector('#hf-family-debt-view .hf-family-route');
    if (!ruta) return;
    const p = proyeccionGlobal(r.deudaTotal, r.compromisos);
    if (p.deudaTotal <= 0) return asignarHTML(ruta, '<span>Ruta de deuda</span><strong>No hay deuda pendiente registrada.</strong><p>Las tarjetas y préstamos aparecerán aquí cuando tengan saldo.</p>');
    if (!p.meses) return asignarHTML(ruta, `<span>Ruta de deuda</span><strong>Deben ${moneda(p.deudaTotal)} en total.</strong><p>Falta registrar pagos mínimos o cuotas para calcular una referencia global.</p>`);
    asignarHTML(ruta, `<span>Referencia para todas las deudas</span><strong>Entre mínimos y cuotas tienen registrados ${moneda(p.pagoMensual)} al mes.</strong><p>La deuda actual equivale aproximadamente a ${p.meses} meses de esos pagos, suponiendo que no hagan nuevas compras y sin incluir intereses futuros.</p><div class="hf-family-route-bar"><i style="width:${p.porcentaje.toFixed(1)}%"></i></div><small>Es una referencia de tamaño, no una fecha exacta para quedar libres de deuda.</small>`);
  }

  function mesVisible() {
    const texto = String($('month-display')?.textContent || '').toLowerCase();
    const nombres = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const match = texto.match(new RegExp(`(${nombres.join('|')})\\s+(\\d{4})`));
    return match ? `${match[2]}-${String(nombres.indexOf(match[1]) + 1).padStart(2,'0')}` : (DB.getMesActual?.() || new Date().toISOString().slice(0,7));
  }

  async function seguro(fn) {
    try { return typeof fn === 'function' ? await fn() : []; } catch (_) { return []; }
  }

  async function cargarDatos() {
    if (!window.DB) return { ingresos:[], gastos:[], metas:[], tarjetas:[], prestamos:[] };
    const mes = mesVisible();
    const [ingresos, gastos, metas, tarjetas, prestamos] = await Promise.all([
      seguro(() => DB.getIngresosMes(mes)), seguro(() => DB.getGastos(mes)), seguro(() => DB.getMetas()), seguro(() => DB.getTarjetas()), seguro(() => DB.getPrestamos())
    ]);
    return { ingresos, gastos, metas, tarjetas, prestamos, mes };
  }

  async function enriquecerCierre(evento) {
    const mes = evento?.detail?.mes;
    if (!mes || !window.db || !window.DB?.hogarId) return;
    try {
      const [ingresos, gastos, metas, tarjetas, prestamos] = await Promise.all([
        seguro(() => DB.getIngresosMes(mes)), seguro(() => DB.getGastos(mes)), seguro(() => DB.getMetas()), seguro(() => DB.getTarjetas()), seguro(() => DB.getPrestamos())
      ]);
      const r = calcularResumen({ ingresos, gastos, metas, tarjetas, prestamos });
      await db.collection('hogares').doc(DB.hogarId).collection('cierres_financieros').doc(mes).update({
        'totales.ahorroReservado':r.ahorroReservado,
        'totales.disponibleSinAsignar':r.disponibleSinAsignar,
        'totales.pagosDeudaMes':r.pagosDeudaMes,
        actualizadoCoherenciaEn:new Date().toISOString()
      });
    } catch (error) {
      console.warn('No se pudo añadir la información coherente al cierre:', error);
    }
  }

  function conectarObserver() {
    if (!estado.observer) estado.observer = new MutationObserver(programar);
    estado.observer.disconnect();
    ['page-resumen','page-ahorro','page-deudas'].forEach(id => {
      const nodo = $(id);
      if (nodo) estado.observer.observe(nodo,{childList:true,subtree:true});
    });
  }

  async function actualizar() {
    if (estado.actualizando) return false;
    estado.actualizando = true;
    estado.observer?.disconnect();
    try {
      const datos = await cargarDatos();
      const r = calcularResumen(datos);
      estado.ultimoResumen = r;
      aplicarObjetivos(r);
      aplicarDistribucion(r);
      aplicarPresupuesto(r);
      aplicarAlertas(datos.tarjetas, datos.prestamos);
      aplicarRutaDeuda(r);
      await aplicarTendenciaAhorro();
      window.dispatchEvent(new CustomEvent('hf:coherencia-financiera-actualizada', { detail:r }));
      return r;
    } catch (error) {
      console.warn('No se pudo aplicar la coherencia financiera:', error);
      return false;
    } finally {
      estado.actualizando = false;
      conectarObserver();
    }
  }

  function programar() {
    clearTimeout(estado.timer);
    estado.timer = setTimeout(actualizar, 220);
  }

  function toggleAlertas() {
    estado.alertasExpandidas = !estado.alertasExpandidas;
    programar();
  }

  function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado = true;
    conectarObserver();
    programar();
    ['hf:deudas-core-actualizadas','hf:deuda-actualizada','hf:gastos-actualizados','hf:cierre-mensual-guardado'].forEach(nombre => window.addEventListener(nombre, programar));
    window.addEventListener('hf:cierre-mensual-guardado', enriquecerCierre);
  }

  function obtenerEstado() {
    return {
      version:VERSION,
      iniciado:estado.iniciado,
      resumen:estado.ultimoResumen,
      objetivosDisponibles:Boolean(document.querySelector('#regla-502030 .hf-objectives-financial')),
      tendenciaDisponible:Boolean($('hf-saving-trend-state')),
      alertasCompactas:Boolean(document.querySelector('#necesita-atencion .hf-compact-alert-list, #necesita-atencion .hf-compact-alert-empty'))
    };
  }

  window.HFCoherenciaFinanciera = Object.freeze({ iniciar, actualizar, calcularResumen, proyeccionGlobal, puedeMostrarTendencia, toggleAlertas, obtenerEstado });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 360), { once:true });
  else setTimeout(iniciar, 180);
})();
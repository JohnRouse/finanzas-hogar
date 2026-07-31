/* Hogar Finanzas — Etapa 12.3: coherencia financiera y lectura inmediata */
(() => {
  'use strict';
  if (window.HFCoherenciaFinanciera) return;

  const VERSION = '18.3';
  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const escapar = (valor = '') => String(valor).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const estado = {
    iniciado:false,
    actualizando:false,
    timer:null,
    observer:null,
    alertasExpandidas:false,
    ultimoResumen:null,
    ultimasTarjetas:[],
    ultimosPrestamos:[]
  };

  function esPagoTarjeta(g = {}) {
    return g.tipoMovimiento === 'pagoTarjeta'
      || g.tipo === 'pago-tarjeta'
      || (g.cat === 'Deudas' && /^pago tarjeta:/i.test(String(g.desc || '')));
  }

  function esPagoPrestamo(g = {}) {
    return g.tipoMovimiento === 'pagoPrestamo'
      || g.tipo === 'pago-prestamo'
      || (g.cat === 'Deudas' && /^pago pr[eé]stamo:/i.test(String(g.desc || '')));
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
    const consumosEfectivo = consumos
      .filter(g => g.medio !== 'tarjeta')
      .reduce((s, g) => s + numero(g.monto), 0);
    const comprasCredito = consumos
      .filter(g => g.medio === 'tarjeta')
      .reduce((s, g) => s + numero(g.monto), 0);
    const pagosDeudaMes = pagos.reduce((s, g) => s + numero(g.monto), 0);
    const ahorroReservado = metas.reduce((s, m) => s + numero(m.actual), 0);
    const objetivoMetas = metas.reduce((s, m) => s + numero(m.objetivo), 0);
    const disponibleSinAsignar = ingresoTotal - consumosEfectivo - pagosDeudaMes;
    const necesidades = consumos
      .filter(g => ['Alimentación','Servicios','Transporte','Salud','Hogar'].includes(g.cat))
      .reduce((s,g) => s + numero(g.monto), 0);
    const gustos = consumos
      .filter(g => ['Entret.','Otros'].includes(g.cat))
      .reduce((s,g) => s + numero(g.monto), 0);
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
      metasCantidad:metas.length,
      disponibleSinAsignar:redondear(disponibleSinAsignar),
      necesidades:redondear(necesidades),
      gustos:redondear(gustos),
      referenciaNecesidades:redondear(ingresoTotal * 0.50),
      referenciaGustos:redondear(ingresoTotal * 0.30),
      referenciaObjetivos:redondear(ingresoTotal * 0.20),
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
      deudaTotal:redondear(deuda),
      pagoMensual:redondear(pago),
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
    return `<div class="hf-financial-objective ${tono}">
      <span>${escapar(titulo)}</span>
      <strong>${moneda(valor)}</strong>
      <small>${escapar(detalle)}</small>
    </div>`;
  }

  function aplicarKpisAhorro(r) {
    const pagina = $('page-ahorro');
    if (!pagina) return;
    const etiquetas = pagina.querySelectorAll('.kpi-label');
    const subs = pagina.querySelectorAll('.kpi-sub');
    if (etiquetas[0]) etiquetas[0].textContent = 'Ahorro reservado';
    if (etiquetas[1]) etiquetas[1].textContent = r.objetivoMetas > 0 ? 'Falta para metas' : 'Meta de ahorro';
    asignarTexto($('kpi-ahorro2'), moneda(r.ahorroReservado));
    asignarTexto($('kpi-fondo'), r.objetivoMetas > 0 ? moneda(Math.max(0, r.objetivoMetas - r.ahorroReservado)) : 'Sin meta');
    if (subs[0]) subs[0].textContent = r.metasCantidad > 0 ? `Dinero en ${r.metasCantidad} meta${r.metasCantidad === 1 ? '' : 's'}` : 'Todavía no hay dinero reservado';
    if (subs[1]) subs[1].textContent = r.objetivoMetas > 0 ? `Objetivo total ${moneda(r.objetivoMetas)}` : 'Crea una meta cuando lo necesites';

    [...pagina.children].forEach(el => {
      if (el.matches?.('div') && /Ahorro este mes[\s\S]*Ingresos/i.test(el.textContent || '')) {
        el.style.display = 'none';
        el.dataset.hfLegacySavingHelp = 'hidden';
      }
    });
  }

  function aplicarObjetivos(r) {
    const bloque = $('regla-502030');
    if (!bloque) return;
    asignarTexto(bloque.closest('.section')?.querySelector('.section-title'), 'Objetivos financieros del mes');
    asignarHTML(bloque, `
      <div class="hf-objectives-financial">
        <div class="hf-objectives-grid">
          ${filaObjetivo(
            'Ahorro reservado',
            r.ahorroReservado,
            r.objetivoMetas > 0 ? `Meta total ${moneda(r.objetivoMetas)}` : 'Sin metas configuradas',
            r.ahorroReservado > 0 ? 'good' : ''
          )}
          ${filaObjetivo(
            'Pagado a deudas',
            r.pagosDeudaMes,
            r.compromisos > 0 ? `Programado ${moneda(r.compromisos)}` : 'Sin compromisos informados',
            r.pagosDeudaMes > 0 ? 'debt' : ''
          )}
          ${filaObjetivo(
            'Disponible hoy',
            Math.max(0, r.disponibleSinAsignar),
            'Según ingresos y movimientos registrados',
            r.disponibleSinAsignar < 0 ? 'danger' : 'available'
          )}
        </div>
      </div>`);
    aplicarKpisAhorro(r);
  }

  function barraDistribucion(label, valor, ingreso, clase, ayuda) {
    const pct = ingreso > 0 ? Math.max(0, valor / ingreso * 100) : 0;
    const ancho = Math.min(100, pct);
    return `<div class="hf-coherent-dist-row ${clase}">
      <div><span>${escapar(label)}</span><strong>${moneda(valor)} · ${Math.round(pct)}%</strong></div>
      <div class="hf-coherent-dist-track"><i style="width:${ancho.toFixed(1)}%"></i></div>
      <small>${escapar(ayuda)}</small>
    </div>`;
  }

  function aplicarDistribucion(r) {
    const bloque = $('distribucion-content');
    if (!bloque) return;
    if (r.ingresoTotal <= 0) {
      return asignarHTML(bloque, '<div class="empty-state">Configura tus ingresos para ver la distribución real.</div>');
    }
    asignarHTML(bloque, `
      <div class="hf-coherent-distribution">
        ${barraDistribucion('Consumo con dinero del mes', r.consumosEfectivo, r.ingresoTotal, 'consumption', 'Gastos pagados con efectivo o débito.')}
        ${barraDistribucion('Pagos de deudas', r.pagosDeudaMes, r.ingresoTotal, 'debt', 'Abonos registrados en tarjetas y préstamos.')}
        ${barraDistribucion('Disponible hoy', Math.max(0, r.disponibleSinAsignar), r.ingresoTotal, 'available', 'Dinero que todavía no tiene un destino registrado.')}
        ${barraDistribucion('Compras con crédito', r.comprasCredito, r.ingresoTotal, 'credit', 'No reducen el efectivo; aumentan la deuda.')}
      </div>`);
  }

  function filaPlan({ label, actual, referencia, origen, clase = '' }) {
    const tieneReferencia = referencia > 0;
    const pct = tieneReferencia ? Math.max(0, actual / referencia * 100) : 0;
    const ancho = Math.min(100, pct);
    return `<div class="hf-month-plan-row ${clase}">
      <div class="hf-month-plan-head">
        <span>${escapar(label)}</span>
        <strong>${moneda(actual)}${tieneReferencia ? ` de ${moneda(referencia)}` : ''}</strong>
      </div>
      ${tieneReferencia ? `<div class="hf-month-plan-track"><i style="width:${ancho.toFixed(1)}%"></i></div>` : ''}
      <small>${escapar(origen)}</small>
    </div>`;
  }

  function aplicarPresupuesto(r) {
    const bloque = $('presupuesto-list');
    if (!bloque) return;
    asignarTexto(bloque.closest('.section')?.querySelector('.section-title'), 'Plan del mes');

    const ahorroOrigen = r.objetivoMetas > 0
      ? `Meta definida por ustedes: ${moneda(r.objetivoMetas)}`
      : 'Sin una meta de ahorro configurada';

    asignarHTML(bloque, `
      <div class="hf-month-plan">
        <div class="hf-month-plan-group">
          <b>Gastos del mes</b>
          ${filaPlan({
            label:'Gastos esenciales',
            actual:r.necesidades,
            referencia:r.referenciaNecesidades,
            origen:'Referencia automática: 50% de los ingresos.',
            clase:'essential'
          })}
          ${filaPlan({
            label:'Gastos flexibles',
            actual:r.gustos,
            referencia:r.referenciaGustos,
            origen:'Referencia automática: 30% de los ingresos.',
            clase:'flexible'
          })}
        </div>
        <div class="hf-month-plan-group">
          <b>Compromisos</b>
          ${filaPlan({
            label:'Pagos de deuda',
            actual:r.pagosDeudaMes,
            referencia:r.compromisos,
            origen:r.compromisos > 0 ? 'Programado según mínimos y cuotas informados.' : 'Todavía no hay mínimos o cuotas informados.',
            clase:'debt'
          })}
        </div>
        <div class="hf-month-plan-group">
          <b>Metas</b>
          ${filaPlan({
            label:'Ahorro reservado',
            actual:r.ahorroReservado,
            referencia:r.objetivoMetas,
            origen:ahorroOrigen,
            clase:'saving'
          })}
        </div>
      </div>`);
  }

  function fechaISO(valor) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) ? String(valor) : '';
  }

  function diasHasta(fecha) {
    if (!fechaISO(fecha)) return null;
    const hoy = new Date();
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12);
    return Math.ceil((new Date(`${fecha}T12:00:00`) - base) / 86400000);
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

    if (linea > 0 && disponible < 0) {
      return { prioridad:0, tipo:'danger', nombre, detalle:`Excedida por ${moneda(Math.abs(disponible))}` };
    }
    if (dias !== null && dias < 0) {
      return { prioridad:0, tipo:'danger', nombre, detalle:`Vencida hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}` };
    }
    if (dias !== null && dias <= 7) {
      return { prioridad:1, tipo:'warning', nombre, detalle:dias === 0 ? 'Vence hoy' : `Vence en ${dias} días` };
    }
    if (uso >= 90) {
      return { prioridad:2, tipo:'warning', nombre, detalle:`${Math.round(uso)}% utilizado` };
    }
    return null;
  }

  function alertaPrestamo(p = {}) {
    const dias = diasHasta(fechaISO(p.proximoVencimiento || p.fechaVencimiento || p.vencimiento));
    if (dias === null || dias > 7) return null;
    const nombre = p.nombre || p.entidad || p.banco || 'Préstamo';
    const cuota = cuotaPrestamo(p);
    if (dias < 0) {
      return { prioridad:0, tipo:'danger', nombre, detalle:`Cuota vencida${cuota > 0 ? ` · ${moneda(cuota)}` : ''}` };
    }
    return {
      prioridad:1,
      tipo:'warning',
      nombre,
      detalle:`${dias === 0 ? 'Vence hoy' : `Vence en ${dias} días`}${cuota > 0 ? ` · ${moneda(cuota)}` : ''}`
    };
  }

  function aplicarAlertas(tarjetas = estado.ultimasTarjetas, prestamos = estado.ultimosPrestamos) {
    const bloque = $('necesita-atencion');
    if (!bloque) return;
    estado.ultimasTarjetas = Array.isArray(tarjetas) ? tarjetas : [];
    estado.ultimosPrestamos = Array.isArray(prestamos) ? prestamos : [];
    bloque.classList.add('hf-attention-clean');

    const alertas = [
      ...estado.ultimasTarjetas.map(alertaTarjeta),
      ...estado.ultimosPrestamos.map(alertaPrestamo)
    ].filter(Boolean).sort((a,b) => a.prioridad - b.prioridad || a.nombre.localeCompare(b.nombre));

    if (!alertas.length) {
      asignarHTML(bloque, '<div class="hf-compact-alert-empty"><span>✓</span><div><strong>Todo está al día</strong><small>No hay vencimientos cercanos ni tarjetas excedidas.</small></div></div>');
      return;
    }

    const visibles = estado.alertasExpandidas ? alertas : alertas.slice(0, 3);
    asignarHTML(bloque, `
      <div class="hf-compact-alert-list">
        ${visibles.map(a => `<div class="hf-compact-alert ${a.tipo}">
          <i aria-hidden="true"></i>
          <div><strong>${escapar(a.nombre)}</strong><small>${escapar(a.detalle)}</small></div>
        </div>`).join('')}
      </div>
      ${alertas.length > 3 ? `<button type="button" class="hf-alert-toggle">${estado.alertasExpandidas ? 'Ver menos' : `Ver todas (${alertas.length})`}</button>` : ''}
    `);

    bloque.querySelector('.hf-alert-toggle')?.addEventListener('click', () => {
      estado.alertasExpandidas = !estado.alertasExpandidas;
      aplicarAlertas();
    }, { once:true });
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
    try {
      cierres = await window.HFCierreFinancieroMensual?.obtenerUltimosCierres?.(24) || [];
    } catch (_) {}

    const datos = cierres
      .filter(c => Number.isFinite(Number(c?.totales?.ahorroReservado ?? c?.totales?.fondoReservado)))
      .map(c => ({ mes:c.mes || c.id, valor:numero(c.totales.ahorroReservado ?? c.totales.fondoReservado) }))
      .filter(x => /^\d{4}-\d{2}$/.test(String(x.mes || '')))
      .sort((a,b) => a.mes.localeCompare(b.mes));

    window.Chart?.getChart?.(canvas)?.destroy?.();

    if (datos.length < 3) {
      canvas.style.display = 'none';
      estadoEl.style.display = 'flex';
      asignarHTML(estadoEl, `<span>📈</span><strong>La tendencia aparecerá con 3 meses</strong><p>Historial disponible: ${datos.length} de 3 cierres con ahorro reservado.</p>${datos.length ? `<div>${datos.map(d => `<b>${escapar(d.mes)} · ${moneda(d.valor)}</b>`).join('')}</div>` : ''}`);
      return;
    }

    estadoEl.style.display = 'none';
    canvas.style.display = 'block';
    if (!window.Chart) return;

    new Chart(canvas, {
      type:'bar',
      data:{
        labels:datos.map(d => d.mes),
        datasets:[{
          label:'Ahorro reservado',
          data:datos.map(d => d.valor),
          backgroundColor:'#2d6a2d',
          borderRadius:6,
          borderSkipped:false
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:c => ` ${moneda(c.parsed.y)}` } } },
        scales:{ x:{ grid:{display:false} }, y:{ beginAtZero:true, ticks:{ callback:v => `S/${v}` } } }
      }
    });
  }

  function aplicarRutaDeuda(r) {
    const ruta = document.querySelector('#hf-family-debt-view .hf-family-route');
    if (!ruta) return;
    const p = proyeccionGlobal(r.deudaTotal, r.compromisos);

    if (p.deudaTotal <= 0) {
      return asignarHTML(ruta, '<span>Ruta de deuda</span><strong>No hay deuda pendiente registrada.</strong><p>Las tarjetas y préstamos aparecerán aquí cuando tengan saldo.</p>');
    }
    if (!p.meses) {
      return asignarHTML(ruta, `<span>Ruta de deuda</span><strong>Deben ${moneda(p.deudaTotal)} en total.</strong><p>Falta registrar pagos mínimos o cuotas para calcular una referencia global.</p>`);
    }

    asignarHTML(ruta, `<span>Referencia para todas las deudas</span>
      <strong>Entre mínimos y cuotas tienen registrados ${moneda(p.pagoMensual)} al mes.</strong>
      <p>La deuda actual equivale aproximadamente a ${p.meses} meses de esos pagos, suponiendo que no hagan nuevas compras y sin incluir intereses futuros.</p>
      <div class="hf-family-route-bar"><i style="width:${p.porcentaje.toFixed(1)}%"></i></div>
      <small>Es una referencia de tamaño, no una fecha exacta para quedar libres de deuda.</small>`);
  }

  function mesVisible() {
    const texto = String($('month-display')?.textContent || '').toLowerCase();
    const nombres = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const match = texto.match(new RegExp(`(${nombres.join('|')})\\s+(\\d{4})`));
    return match
      ? `${match[2]}-${String(nombres.indexOf(match[1]) + 1).padStart(2,'0')}`
      : (DB.getMesActual?.() || new Date().toISOString().slice(0,7));
  }

  async function seguro(fn) {
    try { return typeof fn === 'function' ? await fn() : []; }
    catch (_) { return []; }
  }

  async function cargarDatos() {
    if (!window.DB) return { ingresos:[], gastos:[], metas:[], tarjetas:[], prestamos:[] };
    const mes = mesVisible();
    const [ingresos, gastos, metas, tarjetas, prestamos] = await Promise.all([
      seguro(() => DB.getIngresosMes(mes)),
      seguro(() => DB.getGastos(mes)),
      seguro(() => DB.getMetas()),
      seguro(() => DB.getTarjetas()),
      seguro(() => DB.getPrestamos())
    ]);
    return { ingresos, gastos, metas, tarjetas, prestamos, mes };
  }

  async function enriquecerCierre(evento) {
    const mes = evento?.detail?.mes;
    if (!mes || !window.db || !window.DB?.hogarId) return;
    try {
      const [ingresos, gastos, metas, tarjetas, prestamos] = await Promise.all([
        seguro(() => DB.getIngresosMes(mes)),
        seguro(() => DB.getGastos(mes)),
        seguro(() => DB.getMetas()),
        seguro(() => DB.getTarjetas()),
        seguro(() => DB.getPrestamos())
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
      if (nodo) estado.observer.observe(nodo, { childList:true, subtree:true });
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
    aplicarAlertas();
  }

  function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado = true;
    conectarObserver();
    programar();
    ['hf:deudas-core-actualizadas','hf:deuda-actualizada','hf:gastos-actualizados','hf:cierre-mensual-guardado']
      .forEach(nombre => window.addEventListener(nombre, programar));
    window.addEventListener('hf:cierre-mensual-guardado', enriquecerCierre);
  }

  function obtenerEstado() {
    return {
      version:VERSION,
      iniciado:estado.iniciado,
      resumen:estado.ultimoResumen,
      objetivosDisponibles:Boolean(document.querySelector('#regla-502030 .hf-objectives-financial')),
      objetivosSinMensajes:Boolean(document.querySelector('#regla-502030 .hf-objectives-financial'))
        && !document.querySelector('#regla-502030 .hf-objectives-intro, #regla-502030 .hf-objectives-note'),
      tendenciaDisponible:Boolean($('hf-saving-trend-state')),
      alertasCompactas:Boolean(document.querySelector('#necesita-atencion .hf-compact-alert-list, #necesita-atencion .hf-compact-alert-empty')),
      distribucionUniforme:document.querySelectorAll('#distribucion-content .hf-coherent-dist-row').length === 4
        && !document.querySelector('#distribucion-content .hf-credit-separate'),
      planIntuitivo:Boolean(document.querySelector('#presupuesto-list .hf-month-plan'))
    };
  }

  window.HFCoherenciaFinanciera = Object.freeze({
    iniciar,
    actualizar,
    calcularResumen,
    proyeccionGlobal,
    puedeMostrarTendencia,
    toggleAlertas,
    obtenerEstado
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 360), { once:true });
  } else {
    setTimeout(iniciar, 180);
  }
})();
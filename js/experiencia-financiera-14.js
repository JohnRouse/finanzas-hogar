/* Hogar Finanzas — Etapa 14: experiencia financiera multidispositivo */
(() => {
  'use strict';
  if (window.HFExperienciaFinanciera14) return;

  const VERSION = '20.0';
  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const dinero = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const escapar = (valor = '') => String(valor).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone:'America/Lima' });
  const mesISO = () => hoyISO().slice(0, 7);
  const estado = {
    iniciado:false,
    observer:null,
    timer:null,
    tarjetas:[],
    prestamos:[],
    gastos:[],
    config:{},
    tarjetaEditandoId:null,
    tarjetaEstadoId:null,
    tarjetaPago:null,
    chartGlobal:null,
    chartTarjeta:null,
    estadosTarjeta:[],
    movimientosTarjeta:[],
    originales:{}
  };

  function hogarRef() {
    if (!window.db || !window.DB?.hogarId) throw new Error('No hay un hogar activo.');
    return db.collection('hogares').doc(DB.hogarId);
  }

  function esAdministrador() {
    try {
      const miembro = typeof window.obtenerMiembroActual === 'function' ? window.obtenerMiembroActual() : null;
      if (miembro) return miembro.rol === 'administrador' || miembro.legacyTipo === 'yo';
    } catch (_) {}
    return localStorage.getItem('miUsuarioTipo') !== 'pareja';
  }

  function mostrarToast(texto, tipo = 'success') {
    if (typeof window.showToast === 'function') window.showToast(texto, tipo);
    else if (typeof window.mostrarToast === 'function') window.mostrarToast(texto);
    else console.info(texto);
  }

  function fechaLegible(fecha) {
    if (!fecha) return '';
    const valor = String(fecha).slice(0, 10);
    const d = new Date(`${valor}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
  }

  function mesLegible(mes) {
    if (!/^\d{4}-\d{2}$/.test(String(mes || ''))) return String(mes || '');
    const [anio, numeroMes] = mes.split('-').map(Number);
    return new Date(anio, numeroMes - 1, 1, 12).toLocaleDateString('es-PE', { month:'long', year:'numeric' });
  }

  function normalizarMes(valor, fallbackFecha = '') {
    const directo = String(valor || '').trim();
    if (/^\d{4}-\d{2}$/.test(directo)) return directo;
    if (/^\d{4}-\d{2}-\d{2}/.test(directo)) return directo.slice(0, 7);
    const limpio = directo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const nombres = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const encontrado = nombres.findIndex(nombre => limpio.includes(nombre));
    const anio = limpio.match(/\b(20\d{2})\b/)?.[1];
    if (encontrado >= 0 && anio) return `${anio}-${String(encontrado + 1).padStart(2, '0')}`;
    const fecha = String(fallbackFecha || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha.slice(0, 7) : '';
  }

  function valorOpcional(id) {
    const raw = String($(id)?.value ?? '').trim();
    return raw === '' || !Number.isFinite(Number(raw)) ? null : redondear(raw);
  }

  function tiempo(valor) {
    if (!valor) return 0;
    if (typeof valor === 'string') return Date.parse(valor) || 0;
    if (valor instanceof Date) return valor.getTime();
    if (typeof valor.toMillis === 'function') return numero(valor.toMillis());
    if (typeof valor.toDate === 'function') return valor.toDate().getTime();
    if (Number.isFinite(Number(valor.seconds))) return Number(valor.seconds) * 1000;
    return 0;
  }

  function filtroActivo() {
    return document.querySelector('.expense-filter.active')?.dataset?.filter || 'todos';
  }

  function filtrarMovimientos(lista) {
    const filtro = filtroActivo();
    if (filtro === 'yo' || filtro === 'pareja') return lista.filter(g => g.quien === filtro);
    const hoy = hoyISO();
    if (filtro === 'hoy') return lista.filter(g => g.fecha === hoy);
    if (filtro === 'semana') {
      const base = new Date(`${hoy}T12:00:00`);
      const inicio = new Date(base);
      inicio.setDate(base.getDate() - ((base.getDay() + 6) % 7));
      return lista.filter(g => {
        const d = new Date(`${g.fecha || ''}T12:00:00`);
        return !Number.isNaN(d.getTime()) && d >= inicio && d <= base;
      });
    }
    return lista;
  }

  function movimientoHTML(g, cfg = {}) {
    const esPagoTarjeta = g.tipoMovimiento === 'pagoTarjeta';
    const esPagoPrestamo = g.tipoMovimiento === 'pagoPrestamo';
    const esPago = esPagoTarjeta || esPagoPrestamo;
    const esCredito = !esPago && g.medio === 'tarjeta';
    const nombreYo = cfg.nombreYo || 'Christian';
    const nombreElla = cfg.nombreElla || 'Sydney';
    const quien = g.quien === 'pareja' ? nombreElla : g.quien === 'ambos' ? 'Ambos' : nombreYo;
    const titulo = esPagoTarjeta
      ? `Pago a ${g.tarjetaNombre || 'tarjeta'}`
      : esPagoPrestamo
        ? `Pago de ${g.prestamoNombre || 'préstamo'}`
        : (g.desc || 'Movimiento');
    const categoria = esPago ? 'Pago de deuda' : (g.cat || 'Otros');
    const icono = esPagoTarjeta ? '💳' : esPagoPrestamo ? '🏦' : (g.icono || '📦');
    const tarjeta = esCredito && g.tarjetaNombre
      ? `<span class="hf-movement-badge card">💳 ${escapar(g.tarjetaNombre)}</span>` : '';
    const fuente = g.fuente === 'telegram'
      ? '<span class="hf-movement-badge source">Telegram</span>' : '';
    const tipo = esPago
      ? `<span class="hf-movement-badge payment">${esPagoTarjeta ? 'Pago de tarjeta' : 'Pago de préstamo'}</span>` : '';
    const id = String(g.id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    return `
      <div class="expense-item hf-movement-card ${esPago ? 'is-payment' : ''} ${esCredito ? 'is-credit' : ''}" data-id="${escapar(g.id || '')}">
        <div class="expense-swipe-wrap">
          <div class="expense-item-inner">
            <div class="expense-icon">${icono}</div>
            <div class="expense-info">
              <div class="expense-name">${escapar(titulo)}</div>
              <div class="expense-cat"><span>${escapar(categoria)}</span>${g.fecha ? `<span> · ${escapar(fechaLegible(g.fecha))}</span>` : ''}</div>
              <div class="hf-movement-badges">${tarjeta}${tipo}${fuente}</div>
            </div>
            <div class="expense-right">
              <div class="expense-amount">${dinero(g.monto)}</div>
              <span class="expense-who">${escapar(quien)}</span>
            </div>
            <div class="expense-more-wrap">
              <button class="expense-more-btn" onclick="toggleExpenseMenu(event,'expense-menu-${id}')" aria-label="Opciones">⋮</button>
              <div class="expense-more-menu" id="expense-menu-${id}">
                ${esPago
                  ? `<span class="expense-menu-note">${esPagoTarjeta ? 'Pago de tarjeta' : 'Pago de préstamo'}</span>`
                  : `<button onclick="abrirEditarGasto('${escapar(g.id || '')}')">Editar</button>`}
                <button class="danger" onclick="eliminarGasto('${escapar(g.id || '')}')">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderGastosMejorado(gastos, cfg = {}) {
    const contenedor = $('expenseList');
    if (!contenedor) return;
    estado.gastos = [...(Array.isArray(gastos) ? gastos : [])].sort((a, b) => {
      const porFecha = String(b.fecha || '').localeCompare(String(a.fecha || ''));
      return porFecha || tiempo(b.creadoEn) - tiempo(a.creadoEn);
    });
    estado.config = cfg || {};
    const filtrados = filtrarMovimientos(estado.gastos);
    if (!filtrados.length) {
      contenedor.innerHTML = '<div class="empty-state">No hay movimientos para este filtro.</div>';
      return;
    }
    const resumen = filtrados.slice(0, 5);
    contenedor.innerHTML = resumen.map(g => movimientoHTML(g, estado.config)).join('') +
      (filtrados.length > 5 ? `
        <div class="ver-todo-container">
          <button class="btn-ver-todo" onclick="abrirHistorialCompleto()">Ver todos los movimientos de ${escapar($('month-display')?.textContent || '')}</button>
        </div>` : '');
    setTimeout(() => window.initGestures?.(), 80);
  }

  function abrirHistorialMejorado() {
    const lista = $('listaCompletaGastos');
    if (!lista) return;
    const titulo = $('historialTitle');
    if (titulo) titulo.textContent = `Movimientos de ${$('month-display')?.textContent || ''}`;
    const buscador = $('historial-search');
    if (buscador) buscador.value = '';
    const limpiar = $('historial-search-clear');
    if (limpiar) limpiar.style.display = 'none';
    const sinResultados = $('historial-no-resultados');
    if (sinResultados) sinResultados.style.display = 'none';
    lista.innerHTML = filtrarMovimientos(estado.gastos).map(g => movimientoHTML(g, estado.config)).join('');
    window.openModal?.('modalHistorial');
    requestAnimationFrame(() => setTimeout(() => window.initGesturesModal?.(), 50));
  }

  function instalarMovimientos() {
    window.generarGastoHTML = movimientoHTML;
    window.renderGastos = renderGastosMejorado;
    window.abrirHistorialCompleto = abrirHistorialMejorado;
  }

  function ocultarBloquesRedundantes() {
    const estadoMes = $('estado-mes');
    if (estadoMes) {
      estadoMes.hidden = true;
      estadoMes.dataset.hfStage14Hidden = 'true';
    }
    document.querySelectorAll('#hf-family-debt-view .hf-family-debt-head, #hf-family-debt-view .hf-family-priority, #hf-family-debt-view .hf-family-route')
      .forEach(el => {
        el.hidden = true;
        el.dataset.hfStage14Hidden = 'true';
      });
  }

  function inyectarCamposTarjeta() {
    const modal = $('tarjetaModal');
    if (!modal || modal.dataset.hfStage14Fields === 'true') return;
    modal.dataset.hfStage14Fields = 'true';

    const nombre = $('t-nombre')?.closest('.input-row');
    nombre?.insertAdjacentHTML('afterend', `
      <div class="input-row input-row-two hf-stage14-card-extra">
        <div>
          <label class="input-label">Últimos 4 dígitos</label>
          <input type="text" inputmode="numeric" maxlength="4" class="input-field" id="t-ultimos4" placeholder="1234">
        </div>
        <div>
          <label class="input-label">TEA anual (%)</label>
          <input type="number" min="0" step="0.01" inputmode="decimal" class="input-field" id="t-tea" placeholder="Ej.: 89.90">
        </div>
      </div>`);

    const filaDias = $('t-cierre')?.closest('.input-row');
    filaDias?.insertAdjacentHTML('afterend', `
      <div class="input-row input-row-two hf-stage14-card-extra">
        <div>
          <label class="input-label">Próxima fecha de cierre</label>
          <input type="date" class="input-field" id="t-fecha-cierre">
        </div>
        <div>
          <label class="input-label">Próxima fecha de vencimiento</label>
          <input type="date" class="input-field" id="t-fecha-vencimiento">
        </div>
      </div>`);

    const etiquetaCierre = $('t-cierre')?.closest('div')?.querySelector('.input-label');
    const etiquetaVence = $('t-vence')?.closest('div')?.querySelector('.input-label');
    if (etiquetaCierre) etiquetaCierre.textContent = 'Día habitual de cierre';
    if (etiquetaVence) etiquetaVence.textContent = 'Día habitual de vencimiento';

    const estadoInicial = modal.querySelector('.statement-initial-box');
    if (estadoInicial) {
      estadoInicial.hidden = true;
      estadoInicial.insertAdjacentHTML('afterend', `
        <div class="hf-stage14-statement-note">
          Los estados de cuenta se guardan por tarjeta y por mes desde <strong>Estados</strong>. Así no se mezclan con la ficha básica.
        </div>`);
    }
  }

  function limpiarFormularioTarjeta14() {
    estado.tarjetaEditandoId = null;
    ['t-nombre','t-deuda','t-limite','t-cierre','t-vence','t-ultimos4','t-tea','t-fecha-cierre','t-fecha-vencimiento']
      .forEach(id => { if ($(id)) $(id).value = ''; });
    if ($('t-quien')) $('t-quien').value = localStorage.getItem('miUsuarioTipo') || 'yo';
    if ($('tarjeta-modal-title')) $('tarjeta-modal-title').textContent = 'Nueva tarjeta de crédito';
    if ($('tarjeta-submit-btn')) $('tarjeta-submit-btn').textContent = 'Guardar tarjeta';
  }

  function abrirNuevaTarjeta14() {
    inyectarCamposTarjeta();
    limpiarFormularioTarjeta14();
    window.openModal?.('tarjetaModal');
  }

  async function abrirEditarTarjeta14(id) {
    inyectarCamposTarjeta();
    const tarjetas = await DB.getTarjetas();
    const tarjeta = tarjetas.find(t => String(t.id) === String(id));
    if (!tarjeta) return mostrarToast('No se encontró la tarjeta.', 'error');
    estado.tarjetaEditandoId = tarjeta.id;
    if ($('t-nombre')) $('t-nombre').value = tarjeta.nombre || '';
    if ($('t-deuda')) $('t-deuda').value = numero(tarjeta.deuda);
    if ($('t-limite')) $('t-limite').value = numero(tarjeta.limite || tarjeta.lineaTotal);
    if ($('t-cierre')) $('t-cierre').value = tarjeta.cierre || tarjeta.diaCierre || '';
    if ($('t-vence')) $('t-vence').value = tarjeta.vence || tarjeta.diaVencimiento || '';
    if ($('t-quien')) $('t-quien').value = tarjeta.quien || 'yo';
    if ($('t-ultimos4')) $('t-ultimos4').value = tarjeta.ultimosDigitos || tarjeta.ultimos4 || '';
    if ($('t-tea')) $('t-tea').value = numero(tarjeta.tea || tarjeta.tasaEfectivaAnual) || '';
    if ($('t-fecha-cierre')) $('t-fecha-cierre').value = tarjeta.fechaCierre || tarjeta.estadoCuenta?.fechaCierre || '';
    if ($('t-fecha-vencimiento')) $('t-fecha-vencimiento').value = tarjeta.fechaVencimiento || tarjeta.estadoCuenta?.fechaVencimiento || '';
    if ($('tarjeta-modal-title')) $('tarjeta-modal-title').textContent = 'Editar tarjeta';
    if ($('tarjeta-submit-btn')) $('tarjeta-submit-btn').textContent = 'Guardar cambios';
    window.openModal?.('tarjetaModal');
  }

  async function guardarTarjeta14() {
    const nombre = String($('t-nombre')?.value || '').trim();
    const deuda = redondear($('t-deuda')?.value);
    const limite = redondear($('t-limite')?.value);
    const cierre = String($('t-cierre')?.value || '');
    const vence = String($('t-vence')?.value || '');
    const quien = $('t-quien')?.value || 'yo';
    const ultimosDigitos = String($('t-ultimos4')?.value || '').replace(/\D/g, '').slice(-4);
    const tea = redondear($('t-tea')?.value);
    const fechaCierre = String($('t-fecha-cierre')?.value || '');
    const fechaVencimiento = String($('t-fecha-vencimiento')?.value || '');
    if (!nombre) return mostrarToast('Escribe el nombre de la tarjeta.', 'error');
    if (limite < 0 || deuda < 0) return mostrarToast('La deuda y la línea no pueden ser negativas.', 'error');

    const existentes = await DB.getTarjetas();
    const actual = existentes.find(t => String(t.id) === String(estado.tarjetaEditandoId));
    const datos = {
      nombre,
      deuda,
      limite,
      lineaTotal:limite,
      cierre,
      vence,
      diaCierre:cierre,
      diaVencimiento:vence,
      fechaCierre,
      fechaVencimiento,
      quien,
      ultimosDigitos,
      tea,
      tasaEfectivaAnual:tea,
      estadoCuenta:{
        ...(actual?.estadoCuenta || {}),
        fechaCierre:fechaCierre || actual?.estadoCuenta?.fechaCierre || '',
        fechaVencimiento:fechaVencimiento || actual?.estadoCuenta?.fechaVencimiento || '',
        lineaTotal:limite,
        actualizadoEn:actual?.estadoCuenta?.actualizadoEn || new Date().toISOString()
      },
      historialEstados:actual?.historialEstados || [],
      actualizadoEn:new Date().toISOString()
    };

    if (estado.tarjetaEditandoId) {
      await DB.updateTarjeta(estado.tarjetaEditandoId, datos);
      mostrarToast('Tarjeta actualizada.');
    } else {
      await DB.addTarjeta(datos);
      mostrarToast('Tarjeta guardada.');
    }
    window.closeModal?.('tarjetaModal');
    limpiarFormularioTarjeta14();
    await window.renderTodo?.();
    await window.HFDeudasFamiliares?.renderizar?.();
    programarMejoras();
  }

  function instalarFormularioTarjeta() {
    inyectarCamposTarjeta();
    window.abrirNuevaTarjeta = abrirNuevaTarjeta14;
    window.abrirEditarTarjeta = abrirEditarTarjeta14;
    window.agregarTarjeta = guardarTarjeta14;
  }

  function inyectarCampoPago() {
    const modal = $('pagoTarjetaModal');
    if (!modal || modal.dataset.hfStage14Payment === 'true') return;
    modal.dataset.hfStage14Payment = 'true';
    const fecha = $('pago-fecha')?.closest('.input-row');
    fecha?.insertAdjacentHTML('afterend', `
      <div class="input-row hf-payment-bank-balance">
        <label class="input-label">Nuevo saldo disponible según el banco (opcional)</label>
        <input type="number" step="0.01" inputmode="decimal" class="input-field" id="pago-disponible-banco" placeholder="Ej.: 209.73 o -122.98">
        <small class="field-help">Al completarlo, la deuda quedará confirmada con la línea de crédito y no solo estimada por el monto pagado.</small>
      </div>`);
  }

  async function abrirPagoTarjeta14(id, nombre, deudaActual) {
    inyectarCampoPago();
    const tarjetas = await DB.getTarjetas();
    const tarjeta = tarjetas.find(t => String(t.id) === String(id));
    const deuda = numero(window.HFDeudasActuales?.obtenerTarjeta?.(id)?.deudaEstimada ?? tarjeta?.deuda ?? deudaActual);
    estado.tarjetaPago = { id:String(id), nombre:nombre || tarjeta?.nombre || 'Tarjeta', deuda, tarjeta };
    const linea = numero(tarjeta?.limite || tarjeta?.lineaTotal);
    const disponible = linea ? linea - deuda : null;
    if ($('pago-tarjeta-info')) {
      $('pago-tarjeta-info').innerHTML = `
        <strong>${escapar(estado.tarjetaPago.nombre)}</strong><br>
        <small>Deuda actual: <b>${dinero(deuda)}</b>${disponible === null ? '' : `<br>Disponible estimado: <b>${dinero(disponible)}</b>`}</small>`;
    }
    if ($('pago-monto')) {
      $('pago-monto').value = '';
      $('pago-monto').max = deuda;
      $('pago-monto').placeholder = `Máx. ${dinero(deuda)}`;
    }
    if ($('pago-fecha')) $('pago-fecha').value = hoyISO();
    if ($('pago-nota')) $('pago-nota').value = '';
    if ($('pago-disponible-banco')) $('pago-disponible-banco').value = '';
    window.openModal?.('pagoTarjetaModal');
  }

  async function registrarPagoTarjeta14() {
    const contexto = estado.tarjetaPago;
    if (!contexto?.id) return mostrarToast('Selecciona la tarjeta nuevamente.', 'error');
    const monto = redondear($('pago-monto')?.value);
    const fecha = String($('pago-fecha')?.value || '');
    const nota = String($('pago-nota')?.value || '').trim();
    const disponibleRaw = String($('pago-disponible-banco')?.value ?? '').trim();
    const tieneDisponible = disponibleRaw !== '' && Number.isFinite(Number(disponibleRaw));
    const disponibleBanco = tieneDisponible ? redondear(disponibleRaw) : null;
    if (!(monto > 0)) return mostrarToast('Ingresa un monto válido.', 'error');
    if (!fecha) return mostrarToast('Selecciona la fecha del pago.', 'error');

    const cardRef = hogarRef().collection('tarjetas').doc(contexto.id);
    const cardSnap = await cardRef.get();
    if (!cardSnap.exists) return mostrarToast('La tarjeta ya no existe.', 'error');
    const tarjeta = { id:cardSnap.id, ...cardSnap.data() };
    const deudaAnterior = numero(window.HFDeudasActuales?.obtenerTarjeta?.(contexto.id)?.deudaEstimada ?? tarjeta.deuda);
    if (monto > deudaAnterior + 0.01) return mostrarToast(`El pago no puede superar la deuda actual de ${dinero(deudaAnterior)}.`, 'error');
    const linea = numero(tarjeta.limite || tarjeta.lineaTotal);
    if (tieneDisponible && !(linea > 0)) return mostrarToast('Primero registra la línea de crédito para confirmar el disponible del banco.', 'error');

    const deudaPosterior = tieneDisponible
      ? Math.max(0, redondear(linea - disponibleBanco))
      : Math.max(0, redondear(deudaAnterior - monto));
    const gastoRef = hogarRef().collection('gastos').doc();
    const batch = db.batch();
    const creadoEn = new Date().toISOString();
    batch.set(gastoRef, {
      desc:`Pago Tarjeta: ${contexto.nombre}${nota ? ` - ${nota}` : ''}`,
      monto,
      quien:localStorage.getItem('miUsuarioTipo') || 'yo',
      cat:'Deudas',
      icono:'💳',
      medio:'efectivo',
      tipoMovimiento:'pagoTarjeta',
      tarjetaId:contexto.id,
      tarjetaNombre:contexto.nombre,
      nota,
      fecha,
      mes:fecha.slice(0, 7),
      deudaAnterior,
      deudaPosterior,
      disponibleBancoPosterior:tieneDisponible ? disponibleBanco : null,
      creadoEn
    });
    batch.update(cardRef, {
      deuda:deudaPosterior,
      ultimoPagoFecha:fecha,
      ultimoPagoMonto:monto,
      ultimoDisponibleBanco:tieneDisponible ? disponibleBanco : (tarjeta.ultimoDisponibleBanco ?? null),
      saldoEstimado:!tieneDisponible,
      pendienteConciliar:!tieneDisponible,
      saldoConfirmadoEn:tieneDisponible ? creadoEn : (tarjeta.saldoConfirmadoEn || null),
      ultimaConciliacion:tieneDisponible ? creadoEn : (tarjeta.ultimaConciliacion || null),
      actualizadoEn:creadoEn
    });
    if (tieneDisponible) {
      const conciliacionRef = cardRef.collection('conciliaciones').doc();
      batch.set(conciliacionRef, {
        tarjetaNombre:contexto.nombre,
        limiteCredito:linea,
        saldoAnterior:deudaAnterior,
        disponibleBanco,
        deudaCalculada:deudaPosterior,
        diferencia:redondear(deudaPosterior - Math.max(0, deudaAnterior - monto)),
        fecha:creadoEn,
        mes:fecha.slice(0, 7),
        usuario:localStorage.getItem('miUsuarioTipo') || 'yo',
        origen:'pago-tarjeta',
        creadoEn:firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
    window.closeModal?.('pagoTarjetaModal');
    mostrarToast(tieneDisponible ? 'Pago registrado y saldo confirmado con el banco.' : 'Pago registrado; el saldo queda estimado hasta confirmarlo.', 'info');
    await window.renderTodo?.();
    await window.HFDeudasFamiliares?.renderizar?.();
    programarMejoras();
  }

  function instalarPagoTarjeta() {
    inyectarCampoPago();
    window.abrirPagoTarjeta = abrirPagoTarjeta14;
    window.registrarPagoTarjeta = registrarPagoTarjeta14;
  }

  function inyectarModalesEstados() {
    if (!$('hfStatementCenterModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="hfStatementCenterModal" onclick="closeModalOutside(event,'hfStatementCenterModal')">
          <div class="modal-sheet hf-stage14-sheet" role="dialog" aria-modal="true">
            <button class="modal-close" type="button" onclick="closeModal('hfStatementCenterModal')">✕</button>
            <div class="modal-handle"></div>
            <div class="modal-title">Estados de cuenta y evolución</div>
            <p class="hf-stage14-intro">Cada estado queda guardado dentro de su tarjeta y en el mes que corresponde.</p>
            <div class="hf-stage14-chart-card">
              <div><strong>Deuda total confirmada por mes</strong><small>Suma de los estados guardados de todas las tarjetas.</small></div>
              <div class="hf-stage14-chart-wrap"><canvas id="hf-st-global-chart"></canvas></div>
              <div id="hf-st-global-empty" class="empty-state" hidden>Guarda al menos un estado de cuenta para comenzar la comparación.</div>
            </div>
            <div id="hf-st-card-list" class="hf-stage14-card-list"></div>
          </div>
        </div>`);
    }

    if (!$('hfCardStatementModal')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="hfCardStatementModal" onclick="closeModalOutside(event,'hfCardStatementModal')">
          <div class="modal-sheet hf-stage14-sheet" role="dialog" aria-modal="true">
            <button class="modal-close" type="button" onclick="closeModal('hfCardStatementModal')">✕</button>
            <div class="modal-handle"></div>
            <div class="modal-title" id="hf-st-card-title">Estado de cuenta</div>
            <div class="hf-statement-form">
              <label class="wide">Mes del estado<input id="hf-st-month" type="month"></label>
              <label>Deuda total actual según el banco (S/)<input id="hf-st-debt-pen" type="number" min="0" step="0.01" inputmode="decimal"></label>
              <label>Deuda total actual según el banco (US$)<input id="hf-st-debt-usd" type="number" min="0" step="0.01" inputmode="decimal"></label>
              <label>Pago total del estado (S/)<input id="hf-st-total-pen" type="number" min="0" step="0.01" inputmode="decimal"></label>
              <label>Pago total del estado (US$)<input id="hf-st-total-usd" type="number" min="0" step="0.01" inputmode="decimal"></label>
              <label>Pago mínimo (S/)<input id="hf-st-min-pen" type="number" min="0" step="0.01" inputmode="decimal"></label>
              <label>Pago mínimo (US$)<input id="hf-st-min-usd" type="number" min="0" step="0.01" inputmode="decimal"></label>
              <label>Disponible según el banco (S/)<input id="hf-st-available" type="number" step="0.01" inputmode="decimal"></label>
              <label>Fecha de cierre<input id="hf-st-close" type="date"></label>
              <label>Fecha de vencimiento<input id="hf-st-due" type="date"></label>
              <label class="wide">Nota opcional<input id="hf-st-note" type="text" maxlength="180" placeholder="Ej.: incluye compra en cuotas"></label>
            </div>
            <div id="hf-st-admin-note" class="hf-stage14-statement-note">La deuda total sirve para el gráfico mensual. El pago total y el mínimo son los importes que figuran en el estado de cuenta.</div>
            <button id="hf-st-save" class="modal-btn primary" type="button">Guardar estado de cuenta</button>
            <div class="hf-stage14-chart-card compact">
              <div><strong>Evolución de esta tarjeta</strong><small>Deuda total confirmada por mes.</small></div>
              <div class="hf-stage14-chart-wrap"><canvas id="hf-st-card-chart"></canvas></div>
            </div>
            <div class="hf-stage14-subtitle">Estados guardados</div>
            <div id="hf-st-history" class="hf-statement-history"></div>
            <div class="hf-stage14-subtitle">Movimientos de la tarjeta</div>
            <div id="hf-st-movements" class="hf-card-bank-history"></div>
          </div>
        </div>`);
      $('hf-st-save')?.addEventListener('click', guardarEstadoTarjeta);
      $('hf-st-month')?.addEventListener('change', cargarMesEstadoSeleccionado);
    }
  }

  async function listarEstados(tarjetaId) {
    try {
      const snap = await hogarRef().collection('tarjetas').doc(String(tarjetaId))
        .collection('estadosCuenta').get();
      return snap.docs.map(doc => {
        const datos = { id:doc.id, ...doc.data() };
        return { ...datos, mesNormalizado:normalizarMes(datos.mes || datos.periodo || doc.id, datos.fechaCierre || datos.fechaEstado || datos.actualizadoEn) };
      }).sort((a, b) => String(b.mesNormalizado || '').localeCompare(String(a.mesNormalizado || '')) || tiempo(b.actualizadoEn || b.creadoEn) - tiempo(a.actualizadoEn || a.creadoEn));
    } catch (error) {
      console.warn('No se pudieron leer los estados de cuenta:', error);
      return [];
    }
  }

  async function cargarTodosLosEstados(tarjetas) {
    const pares = await Promise.all(tarjetas.map(async tarjeta => [tarjeta, await listarEstados(tarjeta.id)]));
    return pares.map(([tarjeta, estados]) => ({ tarjeta, estados }));
  }

  function renderGrafico(canvasId, datos, clave) {
    const canvas = $(canvasId);
    if (!canvas || !window.Chart) return;
    if (estado[clave]) estado[clave].destroy();
    if (!datos.length) {
      estado[clave] = null;
      return;
    }
    estado[clave] = new Chart(canvas, {
      type:'line',
      data:{
        labels:datos.map(x => mesLegible(x.mes)),
        datasets:[{
          data:datos.map(x => x.total),
          borderWidth:3,
          tension:.25,
          fill:false,
          pointRadius:4
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:ctx => ` ${dinero(ctx.parsed.y)}` } } },
        scales:{ y:{ beginAtZero:true, ticks:{ callback:v => `S/${v}` } }, x:{ grid:{ display:false } } }
      }
    });
  }

  async function abrirCentroEstados() {
    inyectarModalesEstados();
    const lista = $('hf-st-card-list');
    if (lista) lista.innerHTML = '<div class="empty-state">Cargando tarjetas y estados…</div>';
    if (!$('hfStatementCenterModal')?.classList.contains('open')) window.openModal?.('hfStatementCenterModal');
    const tarjetas = await DB.getTarjetas();
    estado.tarjetas = tarjetas;
    const grupos = await cargarTodosLosEstados(tarjetas);
    const porMes = new Map();
    grupos.forEach(({ estados }) => {
      const ultimoPorMes = new Map();
      estados.forEach(item => {
        const mes = item.mesNormalizado || normalizarMes(item.mes || item.periodo, item.fechaCierre || item.actualizadoEn);
        if (!/^\d{4}-\d{2}$/.test(mes)) return;
        const anterior = ultimoPorMes.get(mes);
        if (!anterior || tiempo(item.actualizadoEn || item.creadoEn) >= tiempo(anterior.actualizadoEn || anterior.creadoEn)) ultimoPorMes.set(mes, item);
      });
      ultimoPorMes.forEach((item, mes) => {
        const total = numero(item.deudaConfirmadaPEN ?? item.deudaActualPEN ?? item.deudaTotalPEN ?? item.pagoTotal ?? item.deudaFacturada);
        porMes.set(mes, redondear((porMes.get(mes) || 0) + total));
      });
    });
    const global = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, total]) => ({ mes, total }));
    const empty = $('hf-st-global-empty');
    if (empty) empty.hidden = global.length > 0;
    renderGrafico('hf-st-global-chart', global, 'chartGlobal');

    if (!lista) return;
    if (!tarjetas.length) {
      lista.innerHTML = '<div class="empty-state">No hay tarjetas registradas.</div>';
      return;
    }
    lista.innerHTML = grupos.map(({ tarjeta, estados }) => {
      const ultimo = estados[0];
      return `
        <article class="hf-stage14-card-row" data-st-card="${escapar(tarjeta.id)}">
          <div>
            <strong>${escapar(tarjeta.nombre || 'Tarjeta')}</strong>
            <small>${ultimo ? `${mesLegible(ultimo.mesNormalizado || ultimo.mes || ultimo.periodo)} · deuda ${dinero(ultimo.deudaConfirmadaPEN ?? ultimo.deudaActualPEN ?? ultimo.pagoTotal)}` : 'Sin estados mensuales guardados'}</small>
          </div>
          <button type="button">Ver detalle</button>
        </article>`;
    }).join('');
    lista.querySelectorAll('[data-st-card]').forEach(row => {
      row.querySelector('button')?.addEventListener('click', () => abrirEstadosTarjeta(row.dataset.stCard));
    });
  }

  function limpiarFormularioEstado() {
    ['hf-st-debt-pen','hf-st-debt-usd','hf-st-total-pen','hf-st-total-usd','hf-st-min-pen','hf-st-min-usd','hf-st-available','hf-st-close','hf-st-due','hf-st-note']
      .forEach(id => { if ($(id)) $(id).value = ''; });
  }

  async function abrirEstadosTarjeta(id) {
    inyectarModalesEstados();
    const tarjetas = await DB.getTarjetas();
    const tarjeta = tarjetas.find(t => String(t.id) === String(id));
    if (!tarjeta) return mostrarToast('No se encontró la tarjeta.', 'error');
    estado.tarjetaEstadoId = tarjeta.id;
    if ($('hf-st-card-title')) $('hf-st-card-title').textContent = `Detalle · ${tarjeta.nombre}`;
    if ($('hf-st-month')) $('hf-st-month').value = mesISO();
    limpiarFormularioEstado();
    const admin = esAdministrador();
    document.querySelector('#hfCardStatementModal .hf-statement-form')?.toggleAttribute('hidden', !admin);
    $('hf-st-admin-note')?.toggleAttribute('hidden', !admin);
    $('hf-st-save')?.toggleAttribute('hidden', !admin);
    if ($('hf-st-history')) $('hf-st-history').innerHTML = '<div class="empty-state">Cargando estados…</div>';
    if ($('hf-st-movements')) $('hf-st-movements').innerHTML = '<div class="empty-state">Cargando movimientos…</div>';
    window.openModal?.('hfCardStatementModal');
    await Promise.all([renderHistorialEstados(), renderMovimientosTarjeta(tarjeta)]);
    if (admin) await cargarMesEstadoSeleccionado();
  }

  async function cargarMesEstadoSeleccionado() {
    if (!estado.tarjetaEstadoId) return;
    const mes = $('hf-st-month')?.value || mesISO();
    let e = estado.estadosTarjeta.find(item => item.mesNormalizado === mes) || null;
    if (!e) {
      const ref = hogarRef().collection('tarjetas').doc(String(estado.tarjetaEstadoId)).collection('estadosCuenta').doc(mes);
      const snap = await ref.get();
      if (snap.exists) e = { id:snap.id, ...snap.data(), mesNormalizado:mes };
    }
    limpiarFormularioEstado();
    if (!e) return;
    if ($('hf-st-debt-pen')) $('hf-st-debt-pen').value = numero(e.deudaConfirmadaPEN ?? e.deudaActualPEN ?? e.deudaTotalPEN) || '';
    if ($('hf-st-debt-usd')) $('hf-st-debt-usd').value = numero(e.deudaConfirmadaUSD ?? e.deudaActualUSD) || '';
    if ($('hf-st-total-pen')) $('hf-st-total-pen').value = numero(e.pagoTotal ?? e.deudaFacturada) || '';
    if ($('hf-st-total-usd')) $('hf-st-total-usd').value = numero(e.pagoTotalUSD ?? e.deudaFacturadaUSD) || '';
    if ($('hf-st-min-pen')) $('hf-st-min-pen').value = numero(e.pagoMinimo) || '';
    if ($('hf-st-min-usd')) $('hf-st-min-usd').value = numero(e.pagoMinimoUSD) || '';
    if ($('hf-st-available')) $('hf-st-available').value = e.lineaDisponible ?? '';
    if ($('hf-st-close')) $('hf-st-close').value = e.fechaCierre || e.fechaEstado || '';
    if ($('hf-st-due')) $('hf-st-due').value = e.fechaVencimiento || '';
    if ($('hf-st-note')) $('hf-st-note').value = e.nota || '';
  }

  async function guardarEstadoTarjeta() {
    const id = estado.tarjetaEstadoId;
    const mes = String($('hf-st-month')?.value || '');
    if (!id || !/^\d{4}-\d{2}$/.test(mes)) return mostrarToast('Selecciona el mes del estado.', 'error');
    const tarjetas = await DB.getTarjetas();
    const tarjeta = tarjetas.find(t => String(t.id) === String(id));
    if (!tarjeta) return mostrarToast('La tarjeta ya no existe.', 'error');
    const lineaTotal = numero(tarjeta.limite || tarjeta.lineaTotal);
    const lineaDisponible = valorOpcional('hf-st-available');
    let deudaPEN = valorOpcional('hf-st-debt-pen');
    if (deudaPEN === null && lineaDisponible !== null && lineaTotal > 0) deudaPEN = Math.max(0, redondear(lineaTotal - lineaDisponible));
    if (deudaPEN === null || deudaPEN < 0) return mostrarToast('Ingresa la deuda total actual o el disponible del banco.', 'error');
    const deudaUSD = valorOpcional('hf-st-debt-usd') || 0;
    const pagoTotalPEN = valorOpcional('hf-st-total-pen');
    const pagoTotalUSD = valorOpcional('hf-st-total-usd') || 0;
    const minimoPEN = valorOpcional('hf-st-min-pen') || 0;
    const minimoUSD = valorOpcional('hf-st-min-usd') || 0;
    const fechaCierre = String($('hf-st-close')?.value || '');
    const fechaVencimiento = String($('hf-st-due')?.value || '');
    const nota = String($('hf-st-note')?.value || '').trim();
    const actualizadoEn = new Date().toISOString();
    const estadoCuenta = {
      mes,
      periodo:mesLegible(mes),
      tarjetaId:id,
      tarjetaNombre:tarjeta.nombre || 'Tarjeta',
      deudaConfirmadaPEN:deudaPEN,
      deudaConfirmadaUSD:deudaUSD,
      deudaActualPEN:deudaPEN,
      deudaActualUSD:deudaUSD,
      pagoTotal:pagoTotalPEN,
      pagoTotalUSD,
      deudaFacturada:pagoTotalPEN,
      deudaFacturadaUSD:pagoTotalUSD,
      pagoMinimo:minimoPEN,
      pagoMinimoUSD:minimoUSD,
      fechaCierre,
      fechaVencimiento,
      lineaTotal,
      lineaDisponible,
      nota,
      moneda:'PEN',
      origen:'manual-mensual',
      actualizadoEn
    };
    const cardRef = hogarRef().collection('tarjetas').doc(String(id));
    const stateRef = cardRef.collection('estadosCuenta').doc(mes);
    const ultimoMes = normalizarMes(tarjeta.ultimoEstadoMes || tarjeta.estadoCuenta?.mes || tarjeta.estadoCuenta?.periodo, tarjeta.estadoCuenta?.fechaCierre || tarjeta.actualizadoEn);
    const esEstadoMasReciente = !ultimoMes || mes >= ultimoMes;
    const batch = db.batch();
    batch.set(stateRef, { ...estadoCuenta, creadoEn:firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    if (esEstadoMasReciente) {
      batch.set(cardRef, {
        deuda:deudaPEN,
        deudaConfirmada:deudaPEN,
        estadoCuenta,
        pagoMinimo:minimoPEN,
        fechaCierre,
        fechaVencimiento,
        ultimoEstadoMes:mes,
        ultimoDisponibleBanco:lineaDisponible,
        saldoEstimado:false,
        pendienteConciliar:false,
        saldoConfirmadoEn:actualizadoEn,
        ultimaConciliacion:actualizadoEn,
        actualizadoEn
      }, { merge:true });
    }
    await batch.commit();
    mostrarToast(`Estado de ${mesLegible(mes)} guardado.${esEstadoMasReciente ? ' La deuda actual fue confirmada.' : ' Se conservó como histórico.'}`);
    await renderHistorialEstados();
    if (esEstadoMasReciente) {
      await window.renderTodo?.();
      await window.HFDeudasFamiliares?.renderizar?.();
      window.dispatchEvent(new CustomEvent('hf:estado-cuenta-confirmado', { detail:{ tarjetaId:id, mes } }));
    }
  }

  function valorEstado(objeto, campos) {
    for (const campo of campos) {
      const valor = objeto?.[campo];
      if (valor !== null && valor !== undefined && valor !== '' && Number.isFinite(Number(valor))) return redondear(valor);
    }
    return null;
  }

  async function renderHistorialEstados() {
    const id = estado.tarjetaEstadoId;
    const contenedor = $('hf-st-history');
    if (!id || !contenedor) return;
    const estados = await listarEstados(id);
    estado.estadosTarjeta = estados;
    if (!estados.length) {
      contenedor.innerHTML = '<div class="empty-state">Todavía no hay estados guardados para esta tarjeta.</div>';
      renderGrafico('hf-st-card-chart', [], 'chartTarjeta');
      return;
    }
    contenedor.innerHTML = estados.map(e => {
      const mes = e.mesNormalizado || normalizarMes(e.mes || e.periodo || e.id, e.fechaCierre || e.actualizadoEn);
      const totalEstado = valorEstado(e, ['pagoTotal','deudaFacturada']);
      return `
        <article class="hf-statement-history-row" data-st-month="${escapar(mes)}" data-st-id="${escapar(e.id)}">
          <div>
            <strong>${escapar(mesLegible(mes || e.periodo))}</strong>
            <span>Deuda total ${dinero(e.deudaConfirmadaPEN ?? e.deudaActualPEN ?? e.deudaTotalPEN ?? totalEstado)}</span>
            <small>${totalEstado !== null ? `Pago total ${dinero(totalEstado)} · ` : ''}Mínimo ${dinero(e.pagoMinimo)}${e.fechaVencimiento ? ` · vence ${fechaLegible(e.fechaVencimiento)}` : ''}${e.deudaConfirmadaUSD ? ` · US$ ${numero(e.deudaConfirmadaUSD).toFixed(2)}` : ''}</small>
          </div>
          ${esAdministrador() ? '<button type="button">Consultar</button>' : ''}
        </article>`;
    }).join('');
    contenedor.querySelectorAll('[data-st-month] button').forEach(boton => {
      boton.addEventListener('click', async () => {
        const row = boton.closest('[data-st-month]');
        if ($('hf-st-month')) $('hf-st-month').value = row.dataset.stMonth;
        await cargarMesEstadoSeleccionado();
        $('hf-st-month')?.scrollIntoView({ behavior:'smooth', block:'center' });
      });
    });
    const datos = [...estados].reverse().map(e => ({
      mes:e.mesNormalizado || normalizarMes(e.mes || e.periodo, e.fechaCierre || e.actualizadoEn),
      total:numero(e.deudaConfirmadaPEN ?? e.deudaActualPEN ?? e.deudaTotalPEN ?? e.pagoTotal ?? e.deudaFacturada)
    })).filter(x => /^\d{4}-\d{2}$/.test(String(x.mes)));
    renderGrafico('hf-st-card-chart', datos, 'chartTarjeta');
  }

  async function listarMovimientosTarjeta(tarjeta) {
    const gastos = await DB.getGastos(null);
    const nombre = String(tarjeta.nombre || '').toLowerCase();
    return gastos.filter(g => {
      if (g.tarjetaId && String(g.tarjetaId) === String(tarjeta.id)) return true;
      if (g.tipoMovimiento === 'pagoTarjeta' && String(g.tarjetaNombre || '').toLowerCase() === nombre) return true;
      return false;
    }).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || tiempo(b.creadoEn) - tiempo(a.creadoEn));
  }

  async function renderMovimientosTarjeta(tarjeta) {
    const contenedor = $('hf-st-movements');
    if (!contenedor) return;
    const movimientos = await listarMovimientosTarjeta(tarjeta);
    estado.movimientosTarjeta = movimientos;
    if (!movimientos.length) {
      contenedor.innerHTML = '<div class="empty-state">Todavía no hay compras ni pagos vinculados a esta tarjeta.</div>';
      return;
    }
    contenedor.innerHTML = movimientos.slice(0, 60).map(m => {
      const pago = m.tipoMovimiento === 'pagoTarjeta';
      const titulo = pago ? (m.nota || 'Pago realizado') : (m.desc || 'Compra con tarjeta');
      const detalle = pago ? 'Reduce la deuda y recupera línea' : `${m.cat || 'Compra'}${m.quien ? ` · ${m.quien === 'pareja' ? 'Sydney' : 'Christian'}` : ''}`;
      return `
        <article class="hf-bank-movement ${pago ? 'credit' : 'debit'}">
          <div class="hf-bank-movement-icon">${pago ? '↓' : (m.icono || '💳')}</div>
          <div><strong>${escapar(titulo)}</strong><span>${escapar(fechaLegible(m.fecha))}</span><small>${escapar(detalle)}</small></div>
          <b>${pago ? '+' : '−'} ${dinero(m.monto)}</b>
        </article>`;
    }).join('');
  }

  function editarPrestamo(prestamo) {
    window.abrirEditarPrestamo?.(
      prestamo.id,
      prestamo.nombre || '',
      numero(prestamo.saldo),
      numero(prestamo.cuota),
      numero(prestamo.pagadas),
      numero(prestamo.total),
      prestamo.quien || 'yo',
      prestamo.proximoVencimiento || '',
      prestamo.frecuencia || 'mensual'
    );
  }

  async function mejorarTarjetasDeuda() {
    ocultarBloquesRedundantes();
    const vista = $('hf-family-debt-view');
    if (!vista) return;
    const [tarjetas, prestamos] = await Promise.all([DB.getTarjetas(), DB.getPrestamos()]);
    estado.tarjetas = tarjetas;
    estado.prestamos = prestamos;
    const listas = vista.querySelectorAll('.hf-family-card-list');
    const listaTarjetas = listas[0];
    const listaPrestamos = listas[1];
    const admin = esAdministrador();

    listaTarjetas?.querySelectorAll('.hf-family-card').forEach(card => {
      const nombre = card.querySelector('.hf-family-card-head strong')?.textContent?.trim();
      const tarjeta = tarjetas.find(t => String(t.nombre || t.banco || '').trim() === nombre);
      if (!tarjeta || card.querySelector('.hf-stage14-debt-actions')) return;
      const acciones = document.createElement('div');
      acciones.className = 'hf-stage14-debt-actions';
      acciones.innerHTML = `
        <button type="button" data-action="estado">Detalle</button>
        ${admin ? '<button type="button" data-action="pagar">Pagar</button><button type="button" data-action="editar">Editar</button><button type="button" class="danger" data-action="eliminar">Eliminar</button>' : ''}`;
      acciones.querySelector('[data-action="estado"]')?.addEventListener('click', () => abrirEstadosTarjeta(tarjeta.id));
      acciones.querySelector('[data-action="pagar"]')?.addEventListener('click', () => abrirPagoTarjeta14(tarjeta.id, tarjeta.nombre, tarjeta.deuda));
      acciones.querySelector('[data-action="editar"]')?.addEventListener('click', () => abrirEditarTarjeta14(tarjeta.id));
      acciones.querySelector('[data-action="eliminar"]')?.addEventListener('click', () => window.eliminarTarjeta?.(tarjeta.id));
      card.appendChild(acciones);
    });

    listaPrestamos?.querySelectorAll('.hf-family-card').forEach(card => {
      const nombre = card.querySelector('.hf-family-card-head strong')?.textContent?.trim();
      const prestamo = prestamos.find(p => String(p.nombre || p.entidad || p.banco || '').trim() === nombre);
      if (!prestamo || card.querySelector('.hf-stage14-debt-actions')) return;
      const acciones = document.createElement('div');
      acciones.className = 'hf-stage14-debt-actions';
      acciones.innerHTML = admin ? `
        <button type="button" data-action="pagar">Pagar</button>
        <button type="button" data-action="historial">Historial</button>
        <button type="button" data-action="editar">Editar</button>
        <button type="button" class="danger" data-action="eliminar">Eliminar</button>` : `
        <button type="button" data-action="historial">Historial</button>`;
      acciones.querySelector('[data-action="pagar"]')?.addEventListener('click', () => window.abrirPagoPrestamo?.(
        prestamo.id, prestamo.nombre, numero(prestamo.saldo), numero(prestamo.cuota),
        prestamo.proximoVencimiento || '', prestamo.frecuencia || 'mensual', prestamo.quien || 'yo'
      ));
      acciones.querySelector('[data-action="historial"]')?.addEventListener('click', () => window.abrirHistorialPrestamo?.(prestamo.id, prestamo.nombre, numero(prestamo.saldo)));
      acciones.querySelector('[data-action="editar"]')?.addEventListener('click', () => editarPrestamo(prestamo));
      acciones.querySelector('[data-action="eliminar"]')?.addEventListener('click', () => window.eliminarPrestamo?.(prestamo.id));
      card.appendChild(acciones);
    });
  }

  function actualizarAdminDeudas() {
    const modal = $('hfDebtAdminModal');
    if (!modal) return;
    const intro = modal.querySelector('.hf-debt-admin-heading p');
    if (intro) intro.textContent = 'Edita tarjetas y préstamos, registra pagos y consulta la evolución de la deuda.';
    const acciones = modal.querySelector('.hf-debt-admin-actions');
    if (!acciones) return;
    acciones.querySelector('[data-admin-action="actualizar"]')?.remove();
    acciones.querySelector('[data-admin-action="cierre"]')?.remove();
    if (!acciones.querySelector('[data-hf-stage14-statements]')) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'hf-debt-admin-action';
      boton.dataset.hfStage14Statements = 'true';
      boton.innerHTML = '<span>📈</span><div><strong>Estados de cuenta y evolución</strong><small>Guarda la deuda confirmada de cada tarjeta y compárala por mes.</small></div><em>›</em>';
      boton.addEventListener('click', () => {
        window.closeModal?.('hfDebtAdminModal');
        setTimeout(abrirCentroEstados, 90);
      });
      acciones.prepend(boton);
    }
  }

  async function completarPlanificador() {
    const modal = $('hfCentroFinancieroModal');
    if (!modal || !modal.classList.contains('open')) return;
    const tarjetas = await DB.getTarjetas();
    const mapa = new Map(tarjetas.map(t => [String(t.id), t]));
    const select = $('hf-finance-card');
    const aplicarSeleccion = () => {
      const tarjeta = mapa.get(String(select?.value || ''));
      if (!tarjeta) return;
      if ($('hf-finance-tea')) $('hf-finance-tea').value = numero(tarjeta.tea || tarjeta.tasaEfectivaAnual);
      const minimo = numero(tarjeta.estadoCuenta?.pagoMinimo || tarjeta.pagoMinimo);
      if ($('hf-finance-payment') && minimo > 0) $('hf-finance-payment').value = minimo;
    };
    if (select && select.dataset.hfStage14Listener !== 'true') {
      select.dataset.hfStage14Listener = 'true';
      select.addEventListener('change', aplicarSeleccion);
    }
    aplicarSeleccion();
    document.querySelectorAll('.hf-plan-card-row').forEach(row => {
      const tarjeta = mapa.get(String(row.dataset.tarjetaId || ''));
      const input = row.querySelector('.hf-plan-card-tea');
      if (tarjeta && input) input.value = numero(tarjeta.tea || tarjeta.tasaEfectivaAnual);
    });
  }

  function programarMejoras() {
    clearTimeout(estado.timer);
    estado.timer = setTimeout(async () => {
      ocultarBloquesRedundantes();
      inyectarCamposTarjeta();
      inyectarCampoPago();
      inyectarModalesEstados();
      actualizarAdminDeudas();
      await mejorarTarjetasDeuda();
      await completarPlanificador();
    }, 120);
  }

  function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado = true;
    instalarMovimientos();
    instalarFormularioTarjeta();
    instalarPagoTarjeta();
    inyectarModalesEstados();
    ocultarBloquesRedundantes();
    programarMejoras();

    if (!estado.observer) {
      estado.observer = new MutationObserver(programarMejoras);
      estado.observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    }
    ['hf:gastos-actualizados','hf:deuda-actualizada','hf:estado-cuenta-confirmado','hf:deudas-recalculadas']
      .forEach(nombre => window.addEventListener(nombre, programarMejoras));
  }

  function obtenerEstado() {
    return {
      version:VERSION,
      iniciado:estado.iniciado,
      estadoMesOculto:Boolean($('estado-mes')?.hidden || $('estado-mes')?.dataset.hfStage14Hidden),
      movimientosMejorados:window.renderGastos === renderGastosMejorado,
      formularioTarjetaCompleto:Boolean($('t-tea') && $('t-fecha-cierre') && $('t-fecha-vencimiento')),
      campoDisponiblePago:Boolean($('pago-disponible-banco')),
      centroEstados:Boolean($('hfStatementCenterModal') && $('hfCardStatementModal')),
      accionesDeuda:document.querySelectorAll('.hf-stage14-debt-actions').length,
      adminSimplificado:Boolean(document.querySelector('[data-hf-stage14-statements]'))
    };
  }

  window.HFExperienciaFinanciera14 = Object.freeze({
    iniciar,
    obtenerEstado,
    abrirCentroEstados,
    abrirEstadosTarjeta,
    editarTarjeta:abrirEditarTarjeta14,
    registrarPagoTarjeta:registrarPagoTarjeta14,
    guardarEstadoTarjeta,
    version:VERSION
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 520), { once:true });
  else setTimeout(iniciar, 320);
})();
/* Hogar Finanzas — Confirmaciones consistentes sin window.confirm */
(() => {
  'use strict';
  if (window.HFConfirmacionesApp) return;

  const NOMBRES_INTERCEPTADOS = [
    'unirseAHogar',
    'cerrarSesionIdentidad',
    'eliminarIngresoManual',
    'eliminarRecurrente',
    'confirmarReset',
    'guardarAjusteTarjeta',
    'confirmarImportacion',
    'descartarImportacion'
  ];

  const originales = new Map();
  const instaladas = new Set();
  const cola = [];
  let activa = null;
  let cerrando = false;
  let instalado = false;
  let auditoriaCache = null;

  function texto(valor = '') {
    return String(valor ?? '').trim();
  }

  function inyectarEstilos() {
    if (document.getElementById('hf-confirmaciones-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-confirmaciones-styles';
    style.textContent = `
      #hfConfirmacionAppModal{padding:18px;align-items:center;background:rgba(15,23,42,.52);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}
      .hf-confirm-app-sheet{position:relative!important;width:100%!important;max-width:390px!important;margin:auto!important;padding:22px!important;border:1px solid rgba(15,23,42,.08)!important;border-radius:24px!important;background:linear-gradient(180deg,#fff 0%,#f8faff 100%)!important;box-shadow:0 26px 80px rgba(15,23,42,.30)!important;overflow:visible!important}
      .hf-confirm-close{position:absolute!important;top:14px!important;right:14px!important;left:auto!important;bottom:auto!important;transform:none!important;width:38px!important;height:38px!important;border-radius:50%!important;background:#eef1f6!important;color:#4d5667!important}
      .hf-confirm-icon{width:52px;height:52px;border-radius:17px;display:flex;align-items:center;justify-content:center;margin-bottom:15px;background:#edf3ff;color:#2563eb;font-size:23px;font-weight:800}
      .hf-confirm-icon.danger{background:#ffeded;color:#c43232}
      .hf-confirm-icon.warning{background:#fff4dd;color:#a86100}
      .hf-confirm-title{padding-right:42px;margin:0;color:#171b24;font-size:21px;line-height:1.2;letter-spacing:-.25px}
      .hf-confirm-message{margin:9px 0 0;color:#657083;font-size:12px;line-height:1.55;white-space:pre-line}
      .hf-confirm-detail{display:none;margin-top:13px;padding:11px 12px;border-radius:13px;background:#f0f3f8;color:#4f5a6c;font-size:11px;line-height:1.5;white-space:pre-line}
      .hf-confirm-detail.visible{display:block}
      .hf-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:20px}
      .hf-confirm-actions button{min-height:46px;border:0;border-radius:14px;padding:10px 12px;font-size:13px;font-weight:800;cursor:pointer}
      .hf-confirm-cancel{background:#edf0f5;color:#4f5969}
      .hf-confirm-ok{background:#2563eb;color:#fff;box-shadow:0 8px 20px rgba(37,99,235,.22)}
      .hf-confirm-ok.danger{background:#d83232;box-shadow:0 8px 20px rgba(216,50,50,.20)}
      .hf-confirm-ok.warning{background:#b66b00;box-shadow:0 8px 20px rgba(182,107,0,.18)}
      @media(max-width:380px){.hf-confirm-actions{grid-template-columns:1fr}.hf-confirm-cancel{order:2}}
      @media(prefers-color-scheme:dark){
        .hf-confirm-app-sheet{background:linear-gradient(180deg,#1c2026 0%,#15181d 100%)!important;border-color:rgba(255,255,255,.08)!important}
        .hf-confirm-title{color:#f3f5f8}.hf-confirm-message{color:#aeb7c5}.hf-confirm-detail{background:#242932;color:#c5ccd6}.hf-confirm-cancel{background:#292e36;color:#e2e6ec}
      }
    `;
    document.head.appendChild(style);
  }

  function inyectarModal() {
    let modal = document.getElementById('hfConfirmacionAppModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'hfConfirmacionAppModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet hf-confirm-app-sheet" role="alertdialog" aria-modal="true" aria-labelledby="hf-confirm-title" aria-describedby="hf-confirm-message">
        <button class="modal-close hf-confirm-close" type="button" aria-label="Cerrar">✕</button>
        <div class="hf-confirm-icon" id="hf-confirm-icon">?</div>
        <h2 class="hf-confirm-title" id="hf-confirm-title">Confirmar acción</h2>
        <p class="hf-confirm-message" id="hf-confirm-message"></p>
        <div class="hf-confirm-detail" id="hf-confirm-detail"></div>
        <div class="hf-confirm-actions">
          <button class="hf-confirm-cancel" type="button">Cancelar</button>
          <button class="hf-confirm-ok" type="button">Continuar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target === modal) finalizar(false);
    });
    modal.querySelector('.hf-confirm-close')?.addEventListener('click', () => finalizar(false));
    modal.querySelector('.hf-confirm-cancel')?.addEventListener('click', () => finalizar(false));
    modal.querySelector('.hf-confirm-ok')?.addEventListener('click', () => finalizar(true));

    const observer = new MutationObserver(() => {
      if (!activa || cerrando) return;
      const abierto = modal.classList.contains('open') || modal.classList.contains('active');
      if (!abierto) resolverActiva(false);
    });
    observer.observe(modal, { attributes:true, attributeFilter:['class'] });
    return modal;
  }

  function mostrarSiguiente() {
    if (activa || !cola.length) return;
    activa = cola.shift();
    const modal = inyectarModal();
    const opciones = activa.opciones;
    const tono = opciones.tono || (opciones.danger ? 'danger' : 'primary');
    const icono = modal.querySelector('#hf-confirm-icon');
    const titulo = modal.querySelector('#hf-confirm-title');
    const mensaje = modal.querySelector('#hf-confirm-message');
    const detalle = modal.querySelector('#hf-confirm-detail');
    const cancelar = modal.querySelector('.hf-confirm-cancel');
    const aceptar = modal.querySelector('.hf-confirm-ok');

    icono.textContent = opciones.icono || (tono === 'danger' ? '!' : tono === 'warning' ? '!' : '?');
    icono.className = `hf-confirm-icon ${tono === 'primary' ? '' : tono}`.trim();
    titulo.textContent = opciones.titulo || 'Confirmar acción';
    mensaje.textContent = opciones.mensaje || '¿Deseas continuar?';
    detalle.textContent = opciones.detalle || '';
    detalle.classList.toggle('visible', Boolean(opciones.detalle));
    cancelar.textContent = opciones.cancelar || 'Cancelar';
    aceptar.textContent = opciones.aceptar || 'Continuar';
    aceptar.className = `hf-confirm-ok ${tono === 'primary' ? '' : tono}`.trim();

    window.HFModalStack?.prepararApertura?.(modal);
    if (typeof window.openModal === 'function') window.openModal(modal.id);
    else modal.classList.add('open');
    setTimeout(() => aceptar.focus(), 40);
  }

  function resolverActiva(resultado) {
    const solicitud = activa;
    activa = null;
    solicitud?.resolve(Boolean(resultado));
    setTimeout(mostrarSiguiente, 0);
  }

  function finalizar(resultado) {
    if (!activa) return;
    const modal = document.getElementById('hfConfirmacionAppModal');
    cerrando = true;
    if (modal) {
      if (typeof window.closeModal === 'function' && (modal.classList.contains('open') || modal.classList.contains('active'))) window.closeModal(modal.id);
      else modal.classList.remove('open', 'active');
    }
    cerrando = false;
    resolverActiva(resultado);
  }

  function confirmar(opciones = {}) {
    return new Promise(resolve => {
      cola.push({ opciones, resolve });
      mostrarSiguiente();
    });
  }

  function confirmBloqueado(mensaje) {
    console.warn('Se bloqueó una confirmación nativa no migrada:', mensaje);
    if (typeof window.showToast === 'function') window.showToast('Esta acción necesita una confirmación dentro de la app.');
    return false;
  }
  confirmBloqueado.__hfConfirmBloqueado = true;

  function ejecutarOriginal(nombre, contexto, argumentos) {
    const original = originales.get(nombre);
    if (typeof original !== 'function') return undefined;
    window.confirm = () => true;
    try {
      return original.apply(contexto, argumentos);
    } finally {
      window.confirm = confirmBloqueado;
    }
  }

  function envolver(nombre, creadorOpciones, cantidad = 1, condicion = null) {
    const original = window[nombre];
    if (typeof original !== 'function' || original.__hfConfirmacionApp) return false;
    originales.set(nombre, original);

    const envuelta = async function(...args) {
      if (typeof condicion === 'function' && !condicion(...args)) return original.apply(this, args);
      const opciones = typeof creadorOpciones === 'function' ? creadorOpciones(...args) : creadorOpciones;
      const pasos = Array.isArray(opciones) ? opciones : [opciones];
      const requeridos = Math.min(cantidad, pasos.length);
      for (let i = 0; i < requeridos; i++) {
        if (!await confirmar(pasos[i])) return false;
      }
      return ejecutarOriginal(nombre, this, args);
    };
    envuelta.__hfConfirmacionApp = true;
    envuelta.__hfOriginal = original;
    window[nombre] = envuelta;
    instaladas.add(nombre);
    return true;
  }

  function esImportacionDuplicada(id) {
    const botones = [...document.querySelectorAll('.hf-import-card button')];
    const boton = botones.find(el => String(el.getAttribute('onclick') || '').includes(`confirmarImportacion('${id}')`));
    const tarjeta = boton?.closest('.hf-import-card');
    return !tarjeta || tarjeta.classList.contains('duplicado');
  }

  function instalarEnvolturas() {
    envolver('unirseAHogar', () => ({
      icono:'↔', titulo:'¿Vincular este dispositivo?',
      mensaje:'La aplicación comenzará a usar el hogar indicado por el nuevo código.',
      detalle:'El hogar actual no se eliminará. Podrás volver a vincular el dispositivo más adelante.',
      aceptar:'Vincular dispositivo', tono:'warning'
    }));

    envolver('cerrarSesionIdentidad', () => ({
      icono:'👤', titulo:'¿Cambiar el perfil del dispositivo?',
      mensaje:'Tendrás que elegir nuevamente quién usa este dispositivo.',
      detalle:'Los movimientos y datos del hogar no se borrarán.',
      aceptar:'Cambiar perfil', tono:'warning'
    }));

    envolver('eliminarIngresoManual', (_id, nombre) => ({
      icono:'S/', titulo:'¿Eliminar ingreso?',
      mensaje:`Se eliminará “${texto(nombre) || 'Ingreso'}” del mes.`,
      detalle:'Los totales y el disponible se recalcularán inmediatamente.',
      aceptar:'Sí, eliminar', danger:true
    }));

    envolver('eliminarRecurrente', (_id, nombre) => ({
      icono:'↻', titulo:'¿Eliminar gasto recurrente?',
      mensaje:nombre ? `Se dejará de generar “${texto(nombre)}” en los próximos meses.` : 'Este gasto dejará de generarse en los próximos meses.',
      detalle:'Los movimientos que ya fueron registrados permanecerán en el historial.',
      aceptar:'Eliminar recurrente', danger:true
    }));

    envolver('confirmarReset', () => ([
      {
        icono:'🗑', titulo:'¿Borrar todos los datos del hogar?',
        mensaje:'Se eliminarán gastos, ingresos, tarjetas, préstamos, metas y configuraciones.',
        detalle:'Esta acción afecta a todos los dispositivos vinculados y no se puede deshacer.',
        aceptar:'Continuar', danger:true
      },
      {
        icono:'!', titulo:'Última confirmación',
        mensaje:'¿Realmente deseas eliminar toda la información del hogar?',
        detalle:'Al confirmar, el borrado comenzará inmediatamente.',
        aceptar:'Borrar todo', danger:true
      }
    ]), 2);

    envolver('guardarAjusteTarjeta', () => ({
      icono:'↻', titulo:'¿Actualizar la deuda de la tarjeta?',
      mensaje:'La deuda registrada se reemplazará por el cálculo basado en la línea y el disponible que muestra el banco.',
      detalle:texto(document.getElementById('ajuste-tarjeta-diferencia')?.textContent),
      aceptar:'Actualizar tarjeta', tono:'warning'
    }));

    envolver('confirmarImportacion', id => ({
      icono:'!', titulo:'Movimiento posiblemente duplicado',
      mensaje:'Este movimiento se parece a otro que ya fue detectado.',
      detalle:'Revísalo antes de registrarlo para evitar duplicar un gasto o pago.',
      aceptar:'Registrar de todos modos', tono:'warning'
    }), 1, esImportacionDuplicada);

    envolver('descartarImportacion', () => ({
      icono:'🗑', titulo:'¿Descartar movimiento detectado?',
      mensaje:'El movimiento pasará a la lista de descartados y no se registrará como gasto, ingreso o pago.',
      aceptar:'Descartar movimiento', danger:true
    }));

    window.confirm = confirmBloqueado;
    return NOMBRES_INTERCEPTADOS.filter(nombre => instaladas.has(nombre));
  }

  async function auditar({ forzar = false } = {}) {
    if (auditoriaCache && !forzar) return auditoriaCache;
    const scripts = [...document.scripts]
      .map(script => script.src)
      .filter(Boolean)
      .filter(src => {
        try { return new URL(src, document.baseURI).origin === location.origin && /\.js(?:\?|$)/i.test(src); }
        catch (_) { return false; }
      });
    const unicos = [...new Set(scripts)];
    const hallazgos = [];
    const erroresLectura = [];
    const patron = /(?:window\s*\.\s*)?confirm\s*\(/g;

    for (const src of unicos) {
      try {
        const respuesta = await fetch(src, { cache:'no-store' });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        const contenido = await respuesta.text();
        const coincidencias = contenido.match(patron) || [];
        if (coincidencias.length) hallazgos.push({ archivo:new URL(src).pathname.split('/').pop(), src, cantidad:coincidencias.length });
      } catch (error) {
        erroresLectura.push({ src, error:error.message });
      }
    }

    const permitidosLegados = new Set(['app.js', 'importaciones.js']);
    const inesperados = hallazgos.filter(item => !permitidosLegados.has(item.archivo));
    const funcionesFaltantes = NOMBRES_INTERCEPTADOS.filter(nombre => !instaladas.has(nombre));
    auditoriaCache = {
      fecha:new Date().toISOString(),
      scriptsRevisados:unicos.length,
      hallazgos,
      inesperados,
      erroresLectura,
      funcionesInterceptadas:[...instaladas],
      funcionesFaltantes,
      confirmNativoBloqueado:Boolean(window.confirm?.__hfConfirmBloqueado),
      listo:inesperados.length === 0 && funcionesFaltantes.length === 0 && Boolean(window.confirm?.__hfConfirmBloqueado)
    };
    try { localStorage.setItem('hf_auditoria_confirmaciones', JSON.stringify(auditoriaCache)); } catch (_) {}
    return auditoriaCache;
  }

  function iniciar() {
    if (instalado) {
      instalarEnvolturas();
      return true;
    }
    instalado = true;
    inyectarEstilos();
    inyectarModal();
    instalarEnvolturas();
    setTimeout(() => {
      instalarEnvolturas();
      auditar({ forzar:true }).catch(error => console.warn('No se pudo auditar las confirmaciones:', error));
    }, 500);
    return true;
  }

  window.HFConfirmacionesApp = Object.freeze({
    iniciar,
    confirmar,
    auditar,
    obtenerEstado:() => ({ instaladas:[...instaladas], faltantes:NOMBRES_INTERCEPTADOS.filter(nombre => !instaladas.has(nombre)), confirmNativoBloqueado:Boolean(window.confirm?.__hfConfirmBloqueado) })
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();
})();
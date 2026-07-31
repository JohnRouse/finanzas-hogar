/* Hogar Finanzas — Actualización rápida y conjunta de tarjetas */
(() => {
  'use strict';
  if (window.HFActualizadorSaldosTarjetas) return;

  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let tarjetas = [];
  let funcionEstadoOriginal = null;
  let observer = null;
  let timer = null;

  function toast(mensaje) {
    if (typeof window.showToast === 'function') window.showToast(mensaje);
    else console.info(mensaje);
  }

  function escapar(valor = '') {
    return String(valor).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function inyectarModal() {
    if ($('hfActualizarSaldosModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfActualizarSaldosModal" onclick="closeModalOutside(event,'hfActualizarSaldosModal')">
        <div class="modal-sheet hf-app-sheet hf-form-sheet hf-update-balances-sheet" style="position:relative">
          <button class="modal-close" type="button" onclick="closeModal('hfActualizarSaldosModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="hf-form-sheet-heading">
            <span class="hf-form-sheet-icon debt">↻</span>
            <div><div class="modal-title">Actualizar saldos</div><p>Confirma en una sola pantalla cuánto debes actualmente en cada tarjeta.</p></div>
          </div>
          <div class="hf-update-help"><strong>¿Qué monto debes copiar?</strong><span>La deuda total pendiente que aparece en la app o web del banco. No es solo el exceso ni lo gastado durante el mes.</span></div>
          <div id="hf-update-balances-list" class="hf-update-balances-list"><div class="hf-finance-empty">Cargando tarjetas…</div></div>
          <button class="modal-btn primary" id="hf-update-balances-save" type="button">Guardar saldos</button>
        </div>
      </div>`);
    $('hf-update-balances-save')?.addEventListener('click', guardar);
  }

  function tarjetaNombre(t = {}) {
    return t.nombre || t.banco || 'Tarjeta';
  }

  function renderTarjetas(focoId = null) {
    const lista = $('hf-update-balances-list');
    if (!lista) return;
    if (!tarjetas.length) {
      lista.innerHTML = '<div class="hf-finance-empty">Todavía no hay tarjetas registradas.</div>';
      return;
    }

    lista.innerHTML = tarjetas.map(t => {
      const resumen = window.HFDeudasActuales?.obtenerTarjeta?.(t.id);
      const deuda = numero(resumen?.deudaEstimada ?? t.deuda ?? t.saldo);
      const ec = t.estadoCuenta || {};
      return `
        <article class="hf-update-balance-card" data-tarjeta-id="${escapar(t.id)}">
          <div class="hf-update-balance-head">
            <div><strong>${escapar(tarjetaNombre(t))}</strong><small>${t.ultimosDigitos ? `•••• ${escapar(t.ultimosDigitos)}` : ''}${t.limite ? `${t.ultimosDigitos ? ' · ' : ''}Línea ${moneda(t.limite)}` : ''}</small></div>
            <span>En la app: ${moneda(deuda)}</span>
          </div>
          <label>Deuda total que muestra el banco
            <input class="hf-update-debt" type="number" min="0" step="0.01" inputmode="decimal" value="${deuda.toFixed(2)}" data-inicial="${deuda.toFixed(2)}">
          </label>
          <div class="hf-update-secondary-fields">
            <label>Pago mínimo <span>(opcional)</span>
              <input class="hf-update-minimum" type="number" min="0" step="0.01" inputmode="decimal" value="${ec.pagoMinimo == null ? '' : numero(ec.pagoMinimo).toFixed(2)}" data-inicial="${ec.pagoMinimo == null ? '' : numero(ec.pagoMinimo).toFixed(2)}">
            </label>
            <label>Próximo vencimiento <span>(opcional)</span>
              <input class="hf-update-due" type="date" value="${escapar(ec.fechaVencimiento || '')}" data-inicial="${escapar(ec.fechaVencimiento || '')}">
            </label>
          </div>
        </article>`;
    }).join('');

    if (focoId) setTimeout(() => lista.querySelector(`[data-tarjeta-id="${CSS.escape(String(focoId))}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' }), 100);
  }

  async function abrir(focoId = null) {
    inyectarModal();
    try {
      tarjetas = typeof window.DB?.getTarjetas === 'function' ? await DB.getTarjetas() : [];
      renderTarjetas(focoId);
      if (typeof window.openModal === 'function') openModal('hfActualizarSaldosModal');
      else $('hfActualizarSaldosModal')?.classList.add('open');
    } catch (error) {
      console.error(error);
      toast('No se pudieron cargar las tarjetas.');
    }
  }

  async function guardar() {
    const boton = $('hf-update-balances-save');
    const filas = [...document.querySelectorAll('#hf-update-balances-list [data-tarjeta-id]')];
    const cambios = [];

    for (const fila of filas) {
      const deudaInput = fila.querySelector('.hf-update-debt');
      const minimoInput = fila.querySelector('.hf-update-minimum');
      const venceInput = fila.querySelector('.hf-update-due');
      const deuda = numero(deudaInput?.value);
      if (deuda < 0) return toast('La deuda no puede ser negativa.');
      const cambioDeuda = String(deudaInput?.value || '') !== String(deudaInput?.dataset.inicial || '');
      const cambioMinimo = String(minimoInput?.value || '') !== String(minimoInput?.dataset.inicial || '');
      const cambioVence = String(venceInput?.value || '') !== String(venceInput?.dataset.inicial || '');
      if (cambioDeuda || cambioMinimo || cambioVence) cambios.push({ fila, tarjetaId:fila.dataset.tarjetaId, deuda, minimo:minimoInput?.value || '', vence:venceInput?.value || '' });
    }

    if (!cambios.length) {
      closeModal('hfActualizarSaldosModal');
      return toast('No había cambios por guardar.');
    }

    try {
      if (boton) { boton.disabled = true; boton.textContent = 'Guardando…'; }
      const ahora = new Date().toISOString();
      for (const cambio of cambios) {
        const tarjeta = tarjetas.find(t => String(t.id) === String(cambio.tarjetaId));
        if (!tarjeta) continue;
        const ec = tarjeta.estadoCuenta || {};
        await DB.updateTarjeta(cambio.tarjetaId, {
          deuda: cambio.deuda,
          saldoConfirmadoEn: ahora,
          saldoConfirmadoManual: true,
          origenSaldo: 'actualizacion-conjunta',
          saldoEstimado: false,
          pendienteConciliar: false,
          ultimaConciliacion: ahora,
          estadoCuenta: {
            ...ec,
            pagoMinimo: cambio.minimo === '' ? null : numero(cambio.minimo),
            fechaVencimiento: cambio.vence,
            actualizadoDatosPagoEn: ahora
          },
          actualizadoEn: ahora
        });
      }
      closeModal('hfActualizarSaldosModal');
      toast(`${cambios.length} tarjeta${cambios.length === 1 ? '' : 's'} actualizada${cambios.length === 1 ? '' : 's'}.`);
      if (typeof window.renderTodo === 'function') await window.renderTodo();
      await window.HFDeudasActuales?.actualizar?.(true);
    } catch (error) {
      console.error(error);
      toast('No se pudieron guardar todos los cambios.');
    } finally {
      if (boton) { boton.disabled = false; boton.textContent = 'Guardar saldos'; }
    }
  }

  function eliminarBotonesDuplicados() {
    document.querySelectorAll('#page-deudas [data-hf-update-all]').forEach(boton => boton.remove());
  }

  function decorarTarjetas() {
    document.querySelectorAll('#tarjetas-grid .debt-card').forEach(card => {
      const actualizarIndividual = card.querySelector('.debt-action-statement');
      const conciliar = card.querySelector('.debt-action-secondary');
      const pagar = card.querySelector('.debt-action-primary');
      const historial = card.querySelector('.debt-action-history');
      const detalles = card.querySelector('.debt-details-toggle');

      actualizarIndividual?.remove();
      conciliar?.remove();
      if (pagar) pagar.textContent = 'Registrar pago';
      if (historial) historial.textContent = 'Movimientos';
      if (detalles) detalles.textContent = card.classList.contains('expanded') ? 'Ver menos' : 'Ver más';
    });
  }

  function decorar() {
    eliminarBotonesDuplicados();
    decorarTarjetas();
  }

  function iniciar() {
    inyectarModal();
    if (!funcionEstadoOriginal && typeof window.abrirEstadoCuenta === 'function') funcionEstadoOriginal = window.abrirEstadoCuenta;
    window.abrirEstadoCuentaDetallado = funcionEstadoOriginal;
    window.abrirEstadoCuenta = id => abrir(id);
    decorar();
    if (!observer) observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(decorar, 80);
    });
    const pagina = $('page-deudas');
    if (pagina) observer.observe(pagina, { childList:true, subtree:true });
  }

  window.abrirActualizacionTarjetas = abrir;
  window.HFActualizadorSaldosTarjetas = Object.freeze({ iniciar, abrir, guardar, decorar });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 200), { once:true });
  else setTimeout(iniciar, 100);
})();
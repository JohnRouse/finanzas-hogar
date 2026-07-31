/* Hogar Finanzas — Comparador de pago adicional */
(() => {
  'use strict';
  if (window.HFSimuladorPagoExtra) return;

  const VERSION = '18.2';
  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  let observer = null;

  function compararEscenarios({ deuda = 0, pagoBase = 0, pagoExtra = 0, tea = 0 } = {}) {
    if (!window.HFMotorPredictivoFinanciero?.simularPago) throw new Error('El motor de simulación no está disponible.');
    const base = HFMotorPredictivoFinanciero.simularPago({ deuda:numero(deuda), pagoMensual:numero(pagoBase), tea:numero(tea) });
    const mejorado = HFMotorPredictivoFinanciero.simularPago({ deuda:numero(deuda), pagoMensual:numero(pagoBase) + numero(pagoExtra), tea:numero(tea) });
    return {
      base,
      mejorado,
      mesesAhorrados:base.viable && mejorado.viable ? Math.max(0, numero(base.meses) - numero(mejorado.meses)) : null,
      interesesAhorrados:base.viable && mejorado.viable ? Math.max(0, numero(base.interesesTotales) - numero(mejorado.interesesTotales)) : null,
      pagoNuevo:numero(pagoBase) + numero(pagoExtra)
    };
  }

  function inyectar() {
    const tarjeta = document.querySelector('#hfCentroFinancieroModal [data-hf-finance-panel="simulador"] .hf-finance-card');
    if (!tarjeta || $('hf-extra-payment-box')) return false;
    const grafico = tarjeta.querySelector('.hf-finance-chart');
    const caja = document.createElement('div');
    caja.id = 'hf-extra-payment-box';
    caja.className = 'hf-extra-payment-box';
    caja.innerHTML = `
      <h4>¿Qué cambia si pago un monto adicional?</h4>
      <p>Compara el plan actual con un abono mensual extra. No registra pagos ni modifica las deudas.</p>
      <div class="hf-extra-payment-controls">
        <input id="hf-extra-payment" type="number" min="0" step="10" inputmode="decimal" placeholder="Ej.: 500 adicionales">
        <button id="hf-extra-payment-run" type="button">Comparar</button>
      </div>
      <div id="hf-extra-payment-output" class="hf-extra-payment-output"></div>`;
    if (grafico) grafico.insertAdjacentElement('beforebegin', caja);
    else tarjeta.appendChild(caja);
    $('hf-extra-payment-run')?.addEventListener('click', compararDesdeFormulario);
    return true;
  }

  async function obtenerTarjetaSeleccionada() {
    const id = $('hf-finance-card')?.value;
    if (!id || !window.HFModeloFinanciero?.obtenerResumenGlobal) return null;
    const global = await HFModeloFinanciero.obtenerResumenGlobal();
    return (global.tarjetas || []).find(t => String(t.tarjetaId || t.id) === String(id)) || null;
  }

  async function compararDesdeFormulario() {
    const salida = $('hf-extra-payment-output');
    const tarjeta = await obtenerTarjetaSeleccionada();
    if (!tarjeta) {
      if (salida) salida.innerHTML = '<div class="hf-finance-warning"><strong>Selecciona una tarjeta primero.</strong></div>';
      return;
    }
    const pagoBase = numero($('hf-finance-payment')?.value);
    const pagoExtra = numero($('hf-extra-payment')?.value);
    const tea = numero($('hf-finance-tea')?.value);
    const deuda = numero(tarjeta.deudaEstimada ?? tarjeta.deudaActual ?? tarjeta.deuda ?? tarjeta.saldo);
    if (pagoBase <= 0 || pagoExtra <= 0) {
      salida.innerHTML = '<div class="hf-finance-warning"><strong>Ingresa el pago mensual actual y un monto adicional mayor que cero.</strong></div>';
      return;
    }

    try {
      const r = compararEscenarios({ deuda, pagoBase, pagoExtra, tea });
      if (!r.mejorado.viable) {
        salida.innerHTML = '<div class="hf-finance-warning"><strong>Ni siquiera con el pago adicional se logra reducir la deuda.</strong><span>Revisa la TEA o aumenta el monto mensual.</span></div>';
        return;
      }
      const baseTexto = r.base.viable ? `${r.base.meses} meses` : 'No viable';
      const interesesTexto = r.interesesAhorrados === null ? 'No calculable' : moneda(r.interesesAhorrados);
      salida.innerHTML = `
        <div class="hf-extra-payment-result">
          <div><span>Plan actual</span><strong>${baseTexto}</strong></div>
          <div><span>Con ${moneda(pagoExtra)} extra</span><strong>${r.mejorado.meses} meses</strong></div>
          <div><span>Tiempo que ahorrarías</span><strong>${r.mesesAhorrados === null ? '—' : `${r.mesesAhorrados} meses`}</strong></div>
          <div><span>Intereses que ahorrarías</span><strong>${interesesTexto}</strong></div>
        </div>
        <div class="hf-extra-payment-note">El nuevo pago mensual sería ${moneda(r.pagoNuevo)}. ${tea > 0 ? 'El cálculo usa la TEA ingresada y supone que no realizas nuevas compras.' : 'La TEA está en 0; la comparación no incluye intereses. Añádela para un resultado más realista.'}</div>`;
    } catch (error) {
      console.error(error);
      salida.innerHTML = `<div class="hf-finance-warning"><strong>No se pudo realizar la comparación.</strong><span>${String(error.message || error)}</span></div>`;
    }
  }

  function iniciar() {
    inyectar();
    if (!observer) {
      observer = new MutationObserver(inyectar);
      observer.observe(document.body, { childList:true, subtree:true });
    }
  }

  function obtenerEstado() {
    return { version:VERSION, disponible:Boolean($('hf-extra-payment-box')), motorDisponible:Boolean(window.HFMotorPredictivoFinanciero?.simularPago) };
  }

  window.HFSimuladorPagoExtra = Object.freeze({ iniciar, compararEscenarios, compararDesdeFormulario, obtenerEstado });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 420), { once:true });
  else setTimeout(iniciar, 220);
})();
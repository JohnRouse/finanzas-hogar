/* Hogar Finanzas — Etapa 12.1.2: calendario financiero inteligente */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const moneda = valor => `S/ ${numero(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fechaLocal = valor => new Date(`${valor}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
  const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  let proyeccionActual = null;
  let vistaDias = 30;

  function inyectarEstilos() {
    if ($('hf-calendar-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-calendar-styles';
    style.textContent = `
      .hf-calendar-panel{margin-bottom:18px}
      .hf-calendar-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
      .hf-calendar-controls{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-top:14px}
      .hf-calendar-controls label{display:flex;flex-direction:column;gap:6px;font-size:.8rem;min-width:145px}
      .hf-calendar-controls input,.hf-calendar-controls select{width:100%;box-sizing:border-box}
      .hf-calendar-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
      .hf-calendar-tab{border:1px solid rgba(148,163,184,.2);background:rgba(148,163,184,.08);border-radius:999px;padding:7px 12px;cursor:pointer}
      .hf-calendar-tab.active{background:rgba(59,130,246,.16);border-color:rgba(59,130,246,.4)}
      .hf-calendar-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}
      .hf-calendar-kpi{padding:14px;border-radius:16px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.16)}
      .hf-calendar-kpi small{display:block;opacity:.7}.hf-calendar-kpi strong{display:block;margin-top:5px;font-size:1.1rem}
      .hf-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;margin-top:14px}
      .hf-calendar-day{min-height:112px;padding:9px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:rgba(148,163,184,.04);overflow:hidden}
      .hf-calendar-day.today{outline:2px solid rgba(59,130,246,.5)}
      .hf-calendar-day.risk{background:rgba(245,158,11,.1)}
      .hf-calendar-day.negative{background:rgba(239,68,68,.12)}
      .hf-calendar-date{display:flex;justify-content:space-between;gap:8px;font-size:.78rem;font-weight:700}
      .hf-calendar-balance{font-size:.78rem;margin-top:5px}.hf-calendar-balance.negative{color:#ef4444}
      .hf-calendar-events{display:grid;gap:4px;margin-top:7px}
      .hf-calendar-event{font-size:.7rem;padding:4px 6px;border-radius:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:rgba(148,163,184,.12)}
      .hf-calendar-event.income{background:rgba(34,197,94,.14)}.hf-calendar-event.expense{background:rgba(239,68,68,.1)}
      .hf-calendar-alerts{display:grid;gap:8px;margin-top:14px}
      .hf-calendar-alert{padding:11px 12px;border-radius:12px;background:rgba(148,163,184,.08)}
      .hf-calendar-alert.critico{background:rgba(239,68,68,.12)}.hf-calendar-alert.alto{background:rgba(245,158,11,.13)}
      .hf-calendar-empty{text-align:center;padding:18px;opacity:.7}
      @media(max-width:900px){.hf-calendar-summary{grid-template-columns:1fr 1fr}.hf-calendar-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){.hf-calendar-summary{grid-template-columns:1fr}.hf-calendar-grid{grid-template-columns:1fr}.hf-calendar-controls{display:grid;grid-template-columns:1fr}.hf-calendar-controls label{min-width:0}}
    `;
    document.head.appendChild(style);
  }

  function inyectarPanel() {
    if ($('hf-calendario-financiero')) return;
    const pagina = $('page-deudas');
    if (!pagina) return;

    const panel = document.createElement('section');
    panel.id = 'hf-calendario-financiero';
    panel.className = 'section hf-calendar-panel';
    panel.innerHTML = `
      <div class="hf-calendar-head">
        <div>
          <div class="section-title">Calendario financiero inteligente</div>
          <div class="hf-debt-subtitle">Visualiza pagos, ingresos, gastos y días de riesgo antes de que ocurran.</div>
        </div>
        <button class="btn-recurrentes" id="hf-calendar-refresh" type="button">Actualizar calendario</button>
      </div>
      <div class="hf-calendar-controls">
        <label>Saldo disponible hoy<input id="hf-calendar-balance" type="number" min="0" step="10" placeholder="Ej. 2500"></label>
        <label>Colchón de seguridad<input id="hf-calendar-buffer" type="number" min="0" step="10" placeholder="Ej. 500"></label>
        <label>Horizonte<select id="hf-calendar-days"><option value="30">30 días</option><option value="60">60 días</option><option value="90">90 días</option></select></label>
        <button class="btn-recurrentes secondary" id="hf-calendar-project" type="button">Proyectar</button>
      </div>
      <div class="hf-calendar-tabs">
        <button class="hf-calendar-tab active" data-days="30" type="button">Primeros 30 días</button>
        <button class="hf-calendar-tab" data-days="60" type="button">Primeros 60 días</button>
        <button class="hf-calendar-tab" data-days="90" type="button">Primeros 90 días</button>
      </div>
      <div id="hf-calendar-content" class="hf-calendar-empty">Ingresa tu saldo disponible para generar el calendario.</div>
    `;

    const referencia = $('hf-centro-inteligencia');
    if (referencia?.nextSibling) pagina.insertBefore(panel, referencia.nextSibling);
    else pagina.appendChild(panel);

    $('hf-calendar-refresh').addEventListener('click', proyectar);
    $('hf-calendar-project').addEventListener('click', proyectar);
    $('hf-calendar-days').addEventListener('change', event => {
      vistaDias = Number(event.target.value || 30);
      proyectar();
    });
    panel.querySelectorAll('.hf-calendar-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        vistaDias = Number(btn.dataset.days || 30);
        panel.querySelectorAll('.hf-calendar-tab').forEach(b => b.classList.toggle('active', b === btn));
        if (proyeccionActual) render(proyeccionActual);
      });
    });
  }

  function obtenerMovimientosConfigurados() {
    const movimientos = [];
    try {
      const guardados = JSON.parse(localStorage.getItem('hf_movimientos_planificados') || '[]');
      if (Array.isArray(guardados)) movimientos.push(...guardados);
    } catch (error) {
      console.warn('No se pudieron leer los movimientos planificados.', error);
    }
    return movimientos;
  }

  function obtenerRecurrentesConfigurados() {
    const claves = ['hf_recurrentes', 'recurrentes', 'hf_gastos_recurrentes'];
    for (const clave of claves) {
      try {
        const valor = JSON.parse(localStorage.getItem(clave) || 'null');
        if (Array.isArray(valor)) return valor;
      } catch (error) {
        console.warn(`No se pudo leer ${clave}.`, error);
      }
    }
    return [];
  }

  function render(proyeccion) {
    proyeccionActual = proyeccion;
    const contenedor = $('hf-calendar-content');
    if (!contenedor) return;

    const puntos = proyeccion.puntos.slice(0, vistaDias);
    const ultimo = puntos.at(-1) || {};
    const saldoMinimo = puntos.length ? Math.min(...puntos.map(p => p.saldo)) : proyeccion.saldoInicial;
    const negativos = puntos.filter(p => p.negativo).length;
    const bajoColchon = puntos.filter(p => p.bajoColchon).length;
    const hoy = hoyISO();

    const diasHtml = puntos.map(p => {
      const clases = ['hf-calendar-day'];
      if (p.fecha === hoy) clases.push('today');
      if (p.negativo) clases.push('negative');
      else if (p.bajoColchon) clases.push('risk');
      const eventos = p.eventos.slice(0, 3).map(e => `<div class="hf-calendar-event ${e.monto > 0 ? 'income' : 'expense'}" title="${e.descripcion}">${e.monto > 0 ? '+' : '-'} ${moneda(Math.abs(e.monto))} · ${e.descripcion}</div>`).join('');
      const extra = p.eventos.length > 3 ? `<div class="hf-calendar-event">+${p.eventos.length - 3} evento(s)</div>` : '';
      return `
        <div class="${clases.join(' ')}">
          <div class="hf-calendar-date"><span>${fechaLocal(p.fecha)}</span><span>${new Date(`${p.fecha}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'short' })}</span></div>
          <div class="hf-calendar-balance ${p.saldo < 0 ? 'negative' : ''}">Saldo: <strong>${moneda(p.saldo)}</strong></div>
          <div class="hf-calendar-events">${eventos}${extra}</div>
        </div>`;
    }).join('');

    const alertasHtml = (proyeccion.alertas || []).length ? proyeccion.alertas.map(a => `<div class="hf-calendar-alert ${a.nivel}"><strong>${a.nivel === 'critico' ? 'Riesgo crítico' : a.nivel === 'alto' ? 'Atención' : 'Aviso'}</strong><div>${a.mensaje}${a.fecha ? ` Fecha estimada: ${fechaLocal(a.fecha)}.` : ''}</div></div>`).join('') : '<div class="hf-calendar-alert">No se detectaron alertas importantes en el periodo.</div>';

    contenedor.className = '';
    contenedor.innerHTML = `
      <div class="hf-calendar-summary">
        <div class="hf-calendar-kpi"><small>Saldo al final</small><strong>${moneda(ultimo.saldo ?? proyeccion.saldoFinal)}</strong></div>
        <div class="hf-calendar-kpi"><small>Saldo mínimo</small><strong>${moneda(saldoMinimo)}</strong></div>
        <div class="hf-calendar-kpi"><small>Días con saldo negativo</small><strong>${negativos}</strong></div>
        <div class="hf-calendar-kpi"><small>Días bajo el colchón</small><strong>${bajoColchon}</strong></div>
      </div>
      <div class="hf-calendar-alerts">${alertasHtml}</div>
      <div class="hf-calendar-grid">${diasHtml}</div>
    `;
  }

  async function proyectar() {
    const contenedor = $('hf-calendar-content');
    if (!window.HFMotorFlujoCajaPredictivo) {
      if (contenedor) contenedor.textContent = 'El motor predictivo de flujo de caja todavía no está disponible.';
      return;
    }

    const saldoInicial = numero($('hf-calendar-balance')?.value);
    const colchónMinimo = numero($('hf-calendar-buffer')?.value);
    const dias = numero($('hf-calendar-days')?.value) || 30;
    vistaDias = dias;
    document.querySelectorAll('.hf-calendar-tab').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.days) === vistaDias));

    if (contenedor) {
      contenedor.className = 'hf-calendar-empty';
      contenedor.textContent = 'Construyendo calendario y detectando riesgos…';
    }

    try {
      const resultado = await HFMotorFlujoCajaPredictivo.proyectarDesdeModelo({
        saldoInicial,
        colchónMinimo,
        dias,
        fechaInicio: hoyISO(),
        movimientos: obtenerMovimientosConfigurados(),
        recurrentes: obtenerRecurrentesConfigurados()
      });
      render(resultado);
    } catch (error) {
      console.error(error);
      if (contenedor) contenedor.textContent = error.message || 'No se pudo generar el calendario financiero.';
    }
  }

  function iniciar() {
    inyectarEstilos();
    inyectarPanel();
  }

  window.addEventListener('hf:flujo-caja-proyectado', event => event.detail && render(event.detail));
  window.addEventListener('hf:deuda-actualizada', () => proyeccionActual && proyectar());
  window.addEventListener('hf:deudas-recalculadas', () => proyeccionActual && proyectar());
  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 900));
  setTimeout(iniciar, 1600);

  window.HFCalendarioFinancieroInteligente = Object.freeze({ iniciar, proyectar, render });
})();
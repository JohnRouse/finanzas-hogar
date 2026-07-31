/* Hogar Finanzas — Etapa 12.4.1: motor de objetivos financieros */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const CLAVE = 'hf_objetivos_financieros';
  const CLAVE_CONFIG = 'hf_objetivos_config';
  const CLAVE_ULTIMO = 'hf_objetivos_ultimo_resultado';
  const MS_DIA = 86400000;
  let calculando = false;

  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const redondear = valor => Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  const moneda = valor => `S/ ${redondear(valor).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

  function leerJSON(clave, respaldo) {
    try {
      return JSON.parse(localStorage.getItem(clave) || 'null') ?? respaldo;
    } catch {
      return respaldo;
    }
  }

  function guardarJSON(clave, valor) {
    localStorage.setItem(clave, JSON.stringify(valor));
  }

  function sumarMeses(fechaISO, meses) {
    const fecha = new Date(`${fechaISO}T12:00:00`);
    fecha.setMonth(fecha.getMonth() + meses);
    return fecha.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  }

  function mesesEntre(inicioISO, finISO) {
    if (!inicioISO || !finISO) return 0;
    const inicio = new Date(`${inicioISO}T12:00:00`);
    const fin = new Date(`${finISO}T12:00:00`);
    if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fin.getTime()) || fin <= inicio) return 0;
    return Math.max(1, Math.ceil((fin - inicio) / (MS_DIA * 30.4375)));
  }

  function normalizarObjetivo(objetivo = {}) {
    const tipo = objetivo.tipo || 'salir_de_deudas';
    const fechaInicio = objetivo.fechaInicio || hoyISO();
    const fechaObjetivo = objetivo.fechaObjetivo || sumarMeses(fechaInicio, numero(objetivo.plazoMeses || 12));
    return {
      id: objetivo.id || `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nombre: objetivo.nombre || nombrePredeterminado(tipo),
      tipo,
      meta: numero(objetivo.meta),
      progresoManual: numero(objetivo.progresoManual),
      aporteMensual: numero(objetivo.aporteMensual),
      pagoMaximoMensual: numero(objetivo.pagoMaximoMensual),
      utilizacionMeta: numero(objetivo.utilizacionMeta || 30),
      fechaInicio,
      fechaObjetivo,
      prioridad: objetivo.prioridad || 'media',
      estado: objetivo.estado || 'activo',
      notas: objetivo.notas || '',
      creadoEn: objetivo.creadoEn || new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    };
  }

  function nombrePredeterminado(tipo) {
    return ({
      salir_de_deudas: 'Salir de deudas',
      ahorrar: 'Meta de ahorro',
      reducir_utilizacion: 'Reducir uso de tarjetas',
      limitar_pago_mensual: 'Limitar pagos mensuales',
      fondo_emergencia: 'Crear fondo de emergencia'
    })[tipo] || 'Objetivo financiero';
  }

  function listarObjetivos() {
    const datos = leerJSON(CLAVE, []);
    return Array.isArray(datos) ? datos.map(normalizarObjetivo) : [];
  }

  function guardarObjetivo(objetivo) {
    const normalizado = normalizarObjetivo(objetivo);
    const objetivos = listarObjetivos();
    const indice = objetivos.findIndex(item => item.id === normalizado.id);
    if (indice >= 0) objetivos[indice] = normalizado;
    else objetivos.push(normalizado);
    guardarJSON(CLAVE, objetivos);
    window.dispatchEvent(new CustomEvent('hf:objetivo-financiero-guardado', { detail: normalizado }));
    return normalizado;
  }

  function eliminarObjetivo(id) {
    const objetivos = listarObjetivos().filter(item => item.id !== id);
    guardarJSON(CLAVE, objetivos);
    window.dispatchEvent(new CustomEvent('hf:objetivo-financiero-eliminado', { detail: { id } }));
    return objetivos;
  }

  async function obtenerContexto() {
    if (!window.HFModeloFinanciero) throw new Error('El modelo financiero no está disponible.');
    const global = await HFModeloFinanciero.obtenerResumenGlobal();
    const tarjetas = (global.tarjetas || []).map(t => {
      const analizada = window.HFAsistenteFinanciero ? HFAsistenteFinanciero.analizarTarjeta(t) : null;
      const deuda = numero(analizada?.deuda ?? t.deudaEstimada ?? t.deudaActual ?? t.saldo);
      const linea = numero(analizada?.lineaTotal ?? t.lineaTotal ?? t.limiteCredito);
      const pagoMinimo = numero(analizada?.pagoMinimo ?? t.pagoMinimo);
      return {
        id: analizada?.tarjetaId || t.tarjetaId || t.id,
        nombre: analizada?.nombre || t.tarjetaNombre || t.nombre || t.banco || 'Tarjeta',
        deuda,
        linea,
        pagoMinimo,
        utilizacion: linea > 0 ? deuda / linea * 100 : numero(analizada?.utilizacion ?? t.utilizacion),
        tasa: numero(t.tasaAnual ?? t.tea ?? t.tasa)
      };
    });
    return {
      global,
      tarjetas,
      deudaTotal: tarjetas.reduce((s, t) => s + t.deuda, 0),
      lineaTotal: tarjetas.reduce((s, t) => s + t.linea, 0),
      pagoMinimoTotal: tarjetas.reduce((s, t) => s + t.pagoMinimo, 0)
    };
  }

  function calcularInteresMensual(contexto) {
    const deuda = contexto.deudaTotal;
    if (deuda <= 0) return 0;
    const ponderada = contexto.tarjetas.reduce((s, t) => s + t.deuda * (numero(t.tasa) / 12 / 100), 0);
    if (ponderada > 0) return ponderada;
    return deuda * 0.025;
  }

  function proyectarDeuda(deudaInicial, pagoMensual, tasaMensual, maxMeses = 360) {
    let saldo = Math.max(0, numero(deudaInicial));
    const pago = Math.max(0, numero(pagoMensual));
    const tasa = Math.max(0, numero(tasaMensual));
    const puntos = [];
    let intereses = 0;
    let mes = 0;

    while (saldo > 0.01 && mes < maxMeses) {
      mes += 1;
      const interes = saldo * tasa;
      intereses += interes;
      saldo += interes;
      const abono = Math.min(saldo, pago);
      saldo -= abono;
      puntos.push({ mes, interes: redondear(interes), pago: redondear(abono), saldo: redondear(Math.max(0, saldo)) });
      if (pago <= interes && saldo > 0) break;
    }

    return {
      meses: saldo <= 0.01 ? mes : null,
      saldoFinal: redondear(Math.max(0, saldo)),
      intereses: redondear(intereses),
      puntos,
      viable: saldo <= 0.01
    };
  }

  function escenarioDeuda(objetivo, contexto) {
    const mesesMeta = mesesEntre(objetivo.fechaInicio, objetivo.fechaObjetivo);
    const deuda = contexto.deudaTotal;
    const tasaMensual = deuda > 0 ? calcularInteresMensual(contexto) / deuda : 0;
    const pagoBase = objetivo.pagoMaximoMensual || objetivo.aporteMensual || contexto.pagoMinimoTotal;
    const pagoRequeridoSinInteres = mesesMeta > 0 ? deuda / mesesMeta : deuda;
    const pagoRequerido = mesesMeta > 0 && tasaMensual > 0
      ? deuda * (tasaMensual * Math.pow(1 + tasaMensual, mesesMeta)) / (Math.pow(1 + tasaMensual, mesesMeta) - 1)
      : pagoRequeridoSinInteres;
    const esperado = proyectarDeuda(deuda, pagoBase, tasaMensual);
    const optimista = proyectarDeuda(deuda, pagoBase * 1.15, tasaMensual * 0.95);
    const conservador = proyectarDeuda(deuda, pagoBase * 0.9, tasaMensual * 1.05);
    const progreso = deuda <= 0 ? 100 : Math.max(0, Math.min(100, numero(objetivo.progresoManual)));

    return {
      tipo: objetivo.tipo,
      progreso,
      valorActual: deuda,
      valorMeta: 0,
      aporteActual: redondear(pagoBase),
      aporteRequerido: redondear(pagoRequerido),
      mesesMeta,
      viable: deuda <= 0 || pagoBase >= pagoRequerido,
      desviacionMensual: redondear(pagoBase - pagoRequerido),
      fechaEstimada: esperado.meses ? sumarMeses(hoyISO(), esperado.meses) : null,
      escenarios: { optimista, esperado, conservador },
      mensaje: deuda <= 0
        ? 'No hay deuda pendiente registrada.'
        : pagoBase >= pagoRequerido
          ? `Con un pago mensual de ${moneda(pagoBase)} el objetivo es alcanzable dentro del plazo.`
          : `Faltan aproximadamente ${moneda(pagoRequerido - pagoBase)} mensuales para alcanzar la fecha objetivo.`,
      recomendacion: deuda <= 0
        ? 'Puedes redirigir el presupuesto hacia ahorro o fondo de emergencia.'
        : pagoBase >= pagoRequerido
          ? 'Mantén el pago y dirige cualquier ingreso extraordinario a la deuda con mayor tasa.'
          : 'Amplía el plazo, aumenta el pago mensual o reduce nuevas compras hasta cerrar la brecha.'
    };
  }

  function escenarioAhorro(objetivo) {
    const mesesMeta = mesesEntre(objetivo.fechaInicio, objetivo.fechaObjetivo);
    const actual = objetivo.progresoManual;
    const pendiente = Math.max(0, objetivo.meta - actual);
    const requerido = mesesMeta > 0 ? pendiente / mesesMeta : pendiente;
    const aporte = objetivo.aporteMensual;
    const mesesEstimados = aporte > 0 ? Math.ceil(pendiente / aporte) : null;
    const progreso = objetivo.meta > 0 ? Math.min(100, actual / objetivo.meta * 100) : 0;
    const construir = factor => {
      const mensual = aporte * factor;
      const meses = mensual > 0 ? Math.ceil(pendiente / mensual) : null;
      return { meses, aporteMensual: redondear(mensual), fechaEstimada: meses ? sumarMeses(hoyISO(), meses) : null };
    };
    return {
      tipo: objetivo.tipo,
      progreso: redondear(progreso),
      valorActual: actual,
      valorMeta: objetivo.meta,
      aporteActual: aporte,
      aporteRequerido: redondear(requerido),
      mesesMeta,
      viable: pendiente <= 0 || aporte >= requerido,
      desviacionMensual: redondear(aporte - requerido),
      fechaEstimada: mesesEstimados ? sumarMeses(hoyISO(), mesesEstimados) : null,
      escenarios: {
        optimista: construir(1.15),
        esperado: construir(1),
        conservador: construir(0.85)
      },
      mensaje: pendiente <= 0
        ? 'La meta ya fue alcanzada.'
        : aporte >= requerido
          ? `El aporte mensual actual permite alcanzar ${moneda(objetivo.meta)} dentro del plazo.`
          : `Necesitas aumentar el aporte en ${moneda(requerido - aporte)} al mes.`,
      recomendacion: pendiente <= 0
        ? 'Define la siguiente meta o protege el monto en una cuenta separada.'
        : aporte >= requerido
          ? 'Automatiza el aporte mensual y evita usar el fondo para gastos cotidianos.'
          : 'Reduce el objetivo, amplía la fecha o crea un aporte extraordinario inicial.'
    };
  }

  function escenarioUtilizacion(objetivo, contexto) {
    const meta = Math.max(0, objetivo.utilizacionMeta);
    const deudaMeta = contexto.lineaTotal * meta / 100;
    const reduccion = Math.max(0, contexto.deudaTotal - deudaMeta);
    const mesesMeta = mesesEntre(objetivo.fechaInicio, objetivo.fechaObjetivo);
    const requerido = mesesMeta > 0 ? reduccion / mesesMeta : reduccion;
    const aporte = objetivo.aporteMensual || objetivo.pagoMaximoMensual;
    const usoActual = contexto.lineaTotal > 0 ? contexto.deudaTotal / contexto.lineaTotal * 100 : 0;
    return {
      tipo: objetivo.tipo,
      progreso: usoActual <= meta ? 100 : redondear(Math.max(0, 100 - ((usoActual - meta) / Math.max(1, usoActual)) * 100)),
      valorActual: redondear(usoActual),
      valorMeta: meta,
      aporteActual: aporte,
      aporteRequerido: redondear(requerido),
      mesesMeta,
      viable: reduccion <= 0 || aporte >= requerido,
      desviacionMensual: redondear(aporte - requerido),
      fechaEstimada: aporte > 0 ? sumarMeses(hoyISO(), Math.ceil(reduccion / aporte)) : null,
      escenarios: {
        optimista: { meses: aporte > 0 ? Math.ceil(reduccion / (aporte * 1.15)) : null },
        esperado: { meses: aporte > 0 ? Math.ceil(reduccion / aporte) : null },
        conservador: { meses: aporte > 0 ? Math.ceil(reduccion / (aporte * 0.85)) : null }
      },
      mensaje: reduccion <= 0
        ? `La utilización actual ya está en ${redondear(usoActual)} %, dentro de la meta.`
        : `Debes reducir aproximadamente ${moneda(reduccion)} para llegar a ${meta} % de utilización.`,
      recomendacion: reduccion <= 0
        ? 'Mantén el saldo controlado y evita concentrar compras en una sola tarjeta.'
        : 'Paga primero las tarjetas con mayor utilización y pausa nuevas compras en ellas.'
    };
  }

  function escenarioLimitePago(objetivo, contexto) {
    const limite = objetivo.pagoMaximoMensual || objetivo.meta;
    const minimo = contexto.pagoMinimoTotal;
    const diferencia = limite - minimo;
    return {
      tipo: objetivo.tipo,
      progreso: minimo <= limite ? 100 : redondear(Math.max(0, limite / Math.max(1, minimo) * 100)),
      valorActual: minimo,
      valorMeta: limite,
      aporteActual: limite,
      aporteRequerido: minimo,
      mesesMeta: 1,
      viable: minimo <= limite,
      desviacionMensual: redondear(diferencia),
      fechaEstimada: hoyISO(),
      escenarios: {
        optimista: { pago: redondear(minimo * 0.9) },
        esperado: { pago: redondear(minimo) },
        conservador: { pago: redondear(minimo * 1.1) }
      },
      mensaje: minimo <= limite
        ? `Los pagos mínimos actuales de ${moneda(minimo)} están dentro del límite de ${moneda(limite)}.`
        : `Los pagos mínimos superan el límite mensual en ${moneda(minimo - limite)}.`,
      recomendacion: minimo <= limite
        ? 'Usa el margen para amortizar la deuda más costosa sin superar el presupuesto.'
        : 'Reduce deuda, refinancia con cuidado o amplía temporalmente el presupuesto para evitar mora.'
    };
  }

  function evaluarObjetivo(objetivo, contexto) {
    const normalizado = normalizarObjetivo(objetivo);
    if (normalizado.tipo === 'salir_de_deudas') return escenarioDeuda(normalizado, contexto);
    if (normalizado.tipo === 'reducir_utilizacion') return escenarioUtilizacion(normalizado, contexto);
    if (normalizado.tipo === 'limitar_pago_mensual') return escenarioLimitePago(normalizado, contexto);
    return escenarioAhorro(normalizado);
  }

  async function evaluarTodos() {
    const contexto = await obtenerContexto();
    const objetivos = listarObjetivos().filter(item => item.estado === 'activo');
    const evaluaciones = objetivos.map(objetivo => ({ objetivo, evaluacion: evaluarObjetivo(objetivo, contexto) }));
    const resultado = {
      evaluaciones,
      resumen: {
        total: evaluaciones.length,
        viables: evaluaciones.filter(item => item.evaluacion.viable).length,
        enRiesgo: evaluaciones.filter(item => !item.evaluacion.viable).length,
        deudaTotal: redondear(contexto.deudaTotal),
        pagoMinimoTotal: redondear(contexto.pagoMinimoTotal)
      },
      generadoEn: new Date().toISOString(),
      version: '12.4.1'
    };
    guardarJSON(CLAVE_ULTIMO, resultado);
    window.dispatchEvent(new CustomEvent('hf:objetivos-financieros-evaluados', { detail: resultado }));
    return resultado;
  }

  function escapar(texto = '') {
    return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function inyectarEstilos() {
    if ($('hf-objetivos-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-objetivos-styles';
    style.textContent = `
      .hf-objetivos-panel{margin-bottom:18px}.hf-objetivos-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
      .hf-objetivos-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.hf-objetivos-form label{display:flex;flex-direction:column;gap:6px;font-size:.78rem}
      .hf-objetivos-form input,.hf-objetivos-form select{width:100%;box-sizing:border-box}.hf-objetivos-actions{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}
      .hf-objetivos-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}.hf-objetivos-kpi{padding:12px;border-radius:14px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.13)}
      .hf-objetivos-kpi span{display:block;font-size:.72rem;opacity:.65}.hf-objetivos-kpi strong{display:block;margin-top:4px;font-size:1.05rem}.hf-objetivos-list{display:grid;gap:12px;margin-top:14px}
      .hf-objetivo-card{padding:14px;border-radius:16px;border:1px solid rgba(148,163,184,.14);background:rgba(148,163,184,.05)}.hf-objetivo-card.riesgo{border-left:4px solid #ef4444}.hf-objetivo-card.viable{border-left:4px solid #22c55e}
      .hf-objetivo-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.hf-objetivo-title{font-weight:800}.hf-objetivo-status{font-size:.68rem;text-transform:uppercase;opacity:.65}
      .hf-objetivo-progress{height:9px;border-radius:999px;background:rgba(148,163,184,.16);overflow:hidden;margin-top:10px}.hf-objetivo-progress>span{display:block;height:100%;background:currentColor;border-radius:999px}
      .hf-objetivo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.hf-objetivo-metric{padding:9px;border-radius:11px;background:rgba(148,163,184,.07)}.hf-objetivo-metric span{display:block;font-size:.68rem;opacity:.62}.hf-objetivo-metric strong{font-size:.88rem}
      .hf-objetivo-message,.hf-objetivo-action{margin-top:9px;line-height:1.42}.hf-objetivo-action{font-size:.78rem;opacity:.8}.hf-objetivo-buttons{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}.hf-objetivos-empty{padding:18px;text-align:center;opacity:.68}
      @media(max-width:900px){.hf-objetivos-form{grid-template-columns:repeat(2,minmax(0,1fr))}.hf-objetivos-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:560px){.hf-objetivos-form,.hf-objetivos-summary,.hf-objetivo-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function inyectarPanel() {
    if ($('hf-objetivos-financieros')) return;
    const pagina = $('page-deudas');
    if (!pagina) return;
    const panel = document.createElement('section');
    panel.id = 'hf-objetivos-financieros';
    panel.className = 'section hf-objetivos-panel';
    panel.innerHTML = `
      <div class="hf-objetivos-head">
        <div><div class="section-title">Objetivos financieros</div><div class="hf-debt-subtitle">Define una meta y calcula si el plan actual permite alcanzarla.</div></div>
        <button class="btn-recurrentes" id="hf-objetivos-evaluar" type="button">Evaluar objetivos</button>
      </div>
      <div class="hf-objetivos-form">
        <label>Tipo<select id="hf-objetivo-tipo"><option value="salir_de_deudas">Salir de deudas</option><option value="ahorrar">Ahorrar una cantidad</option><option value="fondo_emergencia">Fondo de emergencia</option><option value="reducir_utilizacion">Reducir utilización</option><option value="limitar_pago_mensual">Limitar pago mensual</option></select></label>
        <label>Nombre<input id="hf-objetivo-nombre" type="text" placeholder="Ej. Salir de deudas en 14 meses"></label>
        <label>Meta o límite<input id="hf-objetivo-meta" type="number" min="0" step="10" placeholder="Ej. 15000"></label>
        <label>Aporte o pago mensual<input id="hf-objetivo-aporte" type="number" min="0" step="10" placeholder="Ej. 1200"></label>
        <label>Progreso actual<input id="hf-objetivo-progreso" type="number" min="0" step="10" placeholder="Ej. 2500"></label>
        <label>Utilización meta (%)<input id="hf-objetivo-utilizacion" type="number" min="0" max="100" step="1" value="30"></label>
        <label>Fecha objetivo<input id="hf-objetivo-fecha" type="date" value="${sumarMeses(hoyISO(), 12)}"></label>
        <div class="hf-objetivos-actions"><button class="btn-recurrentes" id="hf-objetivo-guardar" type="button">Guardar objetivo</button></div>
      </div>
      <div class="hf-objetivos-summary" id="hf-objetivos-summary"></div>
      <div class="hf-objetivos-list" id="hf-objetivos-list"><div class="hf-objetivos-empty">Aún no hay objetivos guardados.</div></div>`;
    const referencia = $('hf-insights-financieros') || $('hf-chat-financiero') || $('hf-calendario-financiero');
    if (referencia?.nextSibling) pagina.insertBefore(panel, referencia.nextSibling);
    else pagina.appendChild(panel);
    $('hf-objetivo-guardar').addEventListener('click', guardarDesdeFormulario);
    $('hf-objetivos-evaluar').addEventListener('click', actualizarPanel);
  }

  function guardarDesdeFormulario() {
    const tipo = $('hf-objetivo-tipo').value;
    const objetivo = guardarObjetivo({
      tipo,
      nombre: $('hf-objetivo-nombre').value.trim() || nombrePredeterminado(tipo),
      meta: numero($('hf-objetivo-meta').value),
      aporteMensual: numero($('hf-objetivo-aporte').value),
      pagoMaximoMensual: tipo === 'limitar_pago_mensual' || tipo === 'salir_de_deudas' ? numero($('hf-objetivo-aporte').value) : 0,
      progresoManual: numero($('hf-objetivo-progreso').value),
      utilizacionMeta: numero($('hf-objetivo-utilizacion').value),
      fechaInicio: hoyISO(),
      fechaObjetivo: $('hf-objetivo-fecha').value
    });
    $('hf-objetivo-nombre').value = '';
    actualizarPanel();
    return objetivo;
  }

  function formatoValor(tipo, valor) {
    return tipo === 'reducir_utilizacion' ? `${redondear(valor)} %` : moneda(valor);
  }

  function renderResultado(resultado) {
    const summary = $('hf-objetivos-summary');
    const lista = $('hf-objetivos-list');
    if (!summary || !lista) return;
    summary.innerHTML = `
      <div class="hf-objetivos-kpi"><span>Objetivos activos</span><strong>${resultado.resumen.total}</strong></div>
      <div class="hf-objetivos-kpi"><span>Viables</span><strong>${resultado.resumen.viables}</strong></div>
      <div class="hf-objetivos-kpi"><span>En riesgo</span><strong>${resultado.resumen.enRiesgo}</strong></div>
      <div class="hf-objetivos-kpi"><span>Deuda actual</span><strong>${moneda(resultado.resumen.deudaTotal)}</strong></div>`;
    if (!resultado.evaluaciones.length) {
      lista.innerHTML = '<div class="hf-objetivos-empty">Crea un objetivo para comenzar la planificación.</div>';
      return;
    }
    lista.innerHTML = resultado.evaluaciones.map(({ objetivo, evaluacion }) => `
      <article class="hf-objetivo-card ${evaluacion.viable ? 'viable' : 'riesgo'}">
        <div class="hf-objetivo-top"><div><div class="hf-objetivo-title">${escapar(objetivo.nombre)}</div><div class="hf-debt-subtitle">Fecha objetivo: ${escapar(objetivo.fechaObjetivo)}</div></div><div class="hf-objetivo-status">${evaluacion.viable ? 'viable' : 'en riesgo'}</div></div>
        <div class="hf-objetivo-progress"><span style="width:${Math.max(0, Math.min(100, evaluacion.progreso))}%"></span></div>
        <div class="hf-objetivo-grid">
          <div class="hf-objetivo-metric"><span>Actual</span><strong>${formatoValor(objetivo.tipo, evaluacion.valorActual)}</strong></div>
          <div class="hf-objetivo-metric"><span>Meta</span><strong>${formatoValor(objetivo.tipo, evaluacion.valorMeta)}</strong></div>
          <div class="hf-objetivo-metric"><span>Requerido al mes</span><strong>${moneda(evaluacion.aporteRequerido)}</strong></div>
        </div>
        <div class="hf-objetivo-message">${escapar(evaluacion.mensaje)}</div>
        <div class="hf-objetivo-action"><strong>Recomendación:</strong> ${escapar(evaluacion.recomendacion)}</div>
        <div class="hf-objetivo-buttons"><button class="btn-recurrentes secondary hf-objetivo-eliminar" data-id="${escapar(objetivo.id)}" type="button">Eliminar</button></div>
      </article>`).join('');
    lista.querySelectorAll('.hf-objetivo-eliminar').forEach(btn => btn.addEventListener('click', () => { eliminarObjetivo(btn.dataset.id); actualizarPanel(); }));
  }

  async function actualizarPanel() {
    if (calculando) return;
    calculando = true;
    const boton = $('hf-objetivos-evaluar');
    if (boton) { boton.disabled = true; boton.textContent = 'Evaluando…'; }
    try {
      renderResultado(await evaluarTodos());
    } catch (error) {
      console.error('No se pudieron evaluar los objetivos financieros.', error);
      const lista = $('hf-objetivos-list');
      if (lista) lista.innerHTML = `<div class="hf-objetivos-empty">${escapar(error.message || 'No se pudo completar la evaluación.')}</div>`;
    } finally {
      calculando = false;
      if (boton) { boton.disabled = false; boton.textContent = 'Evaluar objetivos'; }
    }
  }

  function iniciar() {
    inyectarEstilos();
    inyectarPanel();
    setTimeout(actualizarPanel, 300);
  }

  ['hf:deuda-actualizada', 'hf:deudas-recalculadas', 'hf:importacion-confirmada', 'hf:sincronizacion-financiera-completada'].forEach(evento => {
    window.addEventListener(evento, () => setTimeout(actualizarPanel, 250));
  });
  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 1400));
  setTimeout(iniciar, 2400);

  window.HFMotorObjetivosFinancieros = Object.freeze({
    listarObjetivos,
    guardarObjetivo,
    eliminarObjetivo,
    evaluarObjetivo,
    evaluarTodos,
    proyectarDeuda,
    obtenerContexto,
    actualizarPanel,
    iniciar
  });
})();
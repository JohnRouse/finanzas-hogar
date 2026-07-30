/* Hogar Finanzas — Etapa 12.2.2: chat financiero inteligente */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0;
  const CLAVE_HISTORIAL = 'hf_chat_financiero_historial';
  const MAX_HISTORIAL = 30;
  let enviando = false;

  function escapar(texto = '') {
    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function leerHistorial() {
    try {
      const datos = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL) || '[]');
      return Array.isArray(datos) ? datos.slice(-MAX_HISTORIAL) : [];
    } catch (error) {
      console.warn('No se pudo leer el historial del chat financiero.', error);
      return [];
    }
  }

  function guardarHistorial(historial = []) {
    localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(historial.slice(-MAX_HISTORIAL)));
  }

  function agregarAlHistorial(mensaje) {
    const historial = leerHistorial();
    historial.push({
      id: mensaje.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      rol: mensaje.rol,
      texto: mensaje.texto,
      titulo: mensaje.titulo || null,
      intencion: mensaje.intencion || null,
      fecha: mensaje.fecha || new Date().toISOString()
    });
    guardarHistorial(historial);
    return historial;
  }

  function obtenerConfiguracion() {
    const movimientos = (() => {
      try {
        const valor = JSON.parse(localStorage.getItem('hf_movimientos_planificados') || '[]');
        return Array.isArray(valor) ? valor : [];
      } catch {
        return [];
      }
    })();

    const recurrentes = (() => {
      for (const clave of ['hf_recurrentes', 'recurrentes', 'hf_gastos_recurrentes']) {
        try {
          const valor = JSON.parse(localStorage.getItem(clave) || 'null');
          if (Array.isArray(valor)) return valor;
        } catch {
          // Continúa con la siguiente clave.
        }
      }
      return [];
    })();

    return {
      saldoInicial: numero($('hf-chat-saldo')?.value),
      colchónMinimo: numero($('hf-chat-colchon')?.value),
      presupuestoDisponible: numero($('hf-chat-presupuesto')?.value),
      movimientos,
      recurrentes,
      tasas: leerTasas()
    };
  }

  function leerTasas() {
    try {
      const valor = JSON.parse(localStorage.getItem('hf_tasas_tarjetas') || '{}');
      return valor && typeof valor === 'object' ? valor : {};
    } catch {
      return {};
    }
  }

  function inyectarEstilos() {
    if ($('hf-chat-financiero-styles')) return;
    const style = document.createElement('style');
    style.id = 'hf-chat-financiero-styles';
    style.textContent = `
      .hf-chat-panel{margin-bottom:18px}
      .hf-chat-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .hf-chat-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:rgba(59,130,246,.12);font-size:.76rem;font-weight:700}
      .hf-chat-config{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
      .hf-chat-config label{display:flex;flex-direction:column;gap:6px;font-size:.78rem}
      .hf-chat-config input{width:100%;box-sizing:border-box}
      .hf-chat-shell{display:grid;grid-template-rows:minmax(280px,430px) auto;margin-top:14px;border:1px solid rgba(148,163,184,.16);border-radius:18px;overflow:hidden;background:rgba(148,163,184,.035)}
      .hf-chat-messages{padding:16px;overflow:auto;display:flex;flex-direction:column;gap:12px}
      .hf-chat-message{max-width:min(82%,720px);padding:11px 13px;border-radius:16px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
      .hf-chat-message.user{align-self:flex-end;background:rgba(59,130,246,.18);border-bottom-right-radius:5px}
      .hf-chat-message.assistant{align-self:flex-start;background:rgba(148,163,184,.12);border-bottom-left-radius:5px}
      .hf-chat-message.error{background:rgba(239,68,68,.12)}
      .hf-chat-message small{display:block;margin-top:6px;opacity:.58;font-size:.68rem}
      .hf-chat-message strong{display:block;margin-bottom:4px}
      .hf-chat-composer{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px;border-top:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.03)}
      .hf-chat-composer textarea{min-height:48px;max-height:130px;resize:vertical;width:100%;box-sizing:border-box}
      .hf-chat-actions{display:flex;flex-direction:column;gap:7px}
      .hf-chat-suggestions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .hf-chat-suggestion{border:1px solid rgba(148,163,184,.18);background:rgba(148,163,184,.07);border-radius:999px;padding:7px 10px;cursor:pointer;font-size:.75rem}
      .hf-chat-typing{display:flex;gap:4px;align-items:center;min-height:18px}
      .hf-chat-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.35;animation:hfChatPulse 1.2s infinite}
      .hf-chat-dot:nth-child(2){animation-delay:.15s}.hf-chat-dot:nth-child(3){animation-delay:.3s}
      @keyframes hfChatPulse{0%,80%,100%{transform:scale(.75);opacity:.3}40%{transform:scale(1);opacity:.8}}
      @media(max-width:760px){.hf-chat-config{grid-template-columns:1fr}.hf-chat-message{max-width:92%}.hf-chat-composer{grid-template-columns:1fr}.hf-chat-actions{flex-direction:row}.hf-chat-actions button{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function inyectarPanel() {
    if ($('hf-chat-financiero')) return;
    const pagina = $('page-deudas');
    if (!pagina) return;

    const panel = document.createElement('section');
    panel.id = 'hf-chat-financiero';
    panel.className = 'section hf-chat-panel';
    panel.innerHTML = `
      <div class="hf-chat-head">
        <div>
          <div class="section-title">Asistente financiero</div>
          <div class="hf-debt-subtitle">Pregunta sobre tus deudas, pagos, compras y flujo de caja.</div>
        </div>
        <div class="hf-chat-badge">Motor local · Sin enviar datos externos</div>
      </div>

      <div class="hf-chat-config">
        <label>Saldo disponible hoy<input id="hf-chat-saldo" type="number" min="0" step="10" placeholder="Ej. 2500"></label>
        <label>Colchón de seguridad<input id="hf-chat-colchon" type="number" min="0" step="10" placeholder="Ej. 500"></label>
        <label>Presupuesto para pagos<input id="hf-chat-presupuesto" type="number" min="0" step="10" placeholder="Ej. 1200"></label>
      </div>

      <div class="hf-chat-suggestions" id="hf-chat-suggestions">
        <button class="hf-chat-suggestion" type="button">¿Qué deuda debo pagar primero?</button>
        <button class="hf-chat-suggestion" type="button">¿Qué pasa si pago S/ 500 adicionales?</button>
        <button class="hf-chat-suggestion" type="button">¿Cuánto dinero tendré dentro de 30 días?</button>
        <button class="hf-chat-suggestion" type="button">¿Cuál es mi riesgo de no llegar al próximo vencimiento?</button>
      </div>

      <div class="hf-chat-shell">
        <div class="hf-chat-messages" id="hf-chat-messages" aria-live="polite"></div>
        <div class="hf-chat-composer">
          <textarea id="hf-chat-input" placeholder="Ejemplo: ¿Qué tarjeta conviene usar para una compra de S/ 800?" aria-label="Pregunta financiera"></textarea>
          <div class="hf-chat-actions">
            <button class="btn-recurrentes" id="hf-chat-send" type="button">Preguntar</button>
            <button class="btn-recurrentes secondary" id="hf-chat-clear" type="button">Limpiar</button>
          </div>
        </div>
      </div>
    `;

    const referencia = $('hf-calendario-financiero');
    if (referencia?.nextSibling) pagina.insertBefore(panel, referencia.nextSibling);
    else pagina.appendChild(panel);

    $('hf-chat-send').addEventListener('click', enviarPregunta);
    $('hf-chat-clear').addEventListener('click', limpiarHistorial);
    $('hf-chat-input').addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        enviarPregunta();
      }
    });
    panel.querySelectorAll('.hf-chat-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        $('hf-chat-input').value = btn.textContent.trim();
        enviarPregunta();
      });
    });

    renderHistorial();
  }

  function hora(fecha) {
    try {
      return new Date(fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function crearMensajeHtml(mensaje) {
    const clase = mensaje.rol === 'usuario' ? 'user' : mensaje.rol === 'error' ? 'assistant error' : 'assistant';
    const titulo = mensaje.titulo ? `<strong>${escapar(mensaje.titulo)}</strong>` : '';
    return `<div class="hf-chat-message ${clase}">${titulo}${escapar(mensaje.texto)}<small>${hora(mensaje.fecha)}</small></div>`;
  }

  function renderHistorial() {
    const contenedor = $('hf-chat-messages');
    if (!contenedor) return;
    const historial = leerHistorial();
    if (!historial.length) {
      contenedor.innerHTML = crearMensajeHtml({
        rol: 'asistente',
        titulo: 'Hola',
        texto: 'Puedo ayudarte a priorizar deudas, simular pagos, recomendar una tarjeta y proyectar tu saldo futuro.',
        fecha: new Date().toISOString()
      });
    } else {
      contenedor.innerHTML = historial.map(crearMensajeHtml).join('');
    }
    contenedor.scrollTop = contenedor.scrollHeight;
  }

  function mostrarTemporal() {
    const contenedor = $('hf-chat-messages');
    if (!contenedor) return;
    const temporal = document.createElement('div');
    temporal.id = 'hf-chat-typing';
    temporal.className = 'hf-chat-message assistant';
    temporal.innerHTML = '<div class="hf-chat-typing"><span class="hf-chat-dot"></span><span class="hf-chat-dot"></span><span class="hf-chat-dot"></span></div>';
    contenedor.appendChild(temporal);
    contenedor.scrollTop = contenedor.scrollHeight;
  }

  function quitarTemporal() {
    $('hf-chat-typing')?.remove();
  }

  async function enviarPregunta() {
    if (enviando) return;
    const input = $('hf-chat-input');
    const pregunta = input?.value.trim();
    if (!pregunta) return;

    if (!window.HFMotorRecomendacionesFinancieras) {
      agregarAlHistorial({ rol: 'error', texto: 'El motor de recomendaciones financieras todavía no está disponible.' });
      renderHistorial();
      return;
    }

    enviando = true;
    $('hf-chat-send').disabled = true;
    agregarAlHistorial({ rol: 'usuario', texto: pregunta });
    input.value = '';
    renderHistorial();
    mostrarTemporal();

    try {
      const respuesta = await HFMotorRecomendacionesFinancieras.responderPregunta(pregunta, obtenerConfiguracion());
      quitarTemporal();
      agregarAlHistorial({
        rol: 'asistente',
        titulo: respuesta.titulo,
        texto: respuesta.respuesta,
        intencion: respuesta.intencion
      });
      renderHistorial();
    } catch (error) {
      console.error('Error en el asistente financiero:', error);
      quitarTemporal();
      agregarAlHistorial({ rol: 'error', titulo: 'No pude completar el análisis', texto: error.message || 'Ocurrió un error inesperado.' });
      renderHistorial();
    } finally {
      enviando = false;
      $('hf-chat-send').disabled = false;
      input?.focus();
    }
  }

  function limpiarHistorial() {
    localStorage.removeItem(CLAVE_HISTORIAL);
    renderHistorial();
  }

  function iniciar() {
    inyectarEstilos();
    inyectarPanel();
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(iniciar, 1000));
  setTimeout(iniciar, 1800);

  window.HFChatFinancieroInteligente = Object.freeze({
    iniciar,
    enviarPregunta,
    limpiarHistorial,
    leerHistorial,
    obtenerConfiguracion
  });
})();
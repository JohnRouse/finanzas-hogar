/* Hogar Finanzas — Recuperación del producto: Deudas simples + Centro financiero separado */
(() => {
  'use strict';
  if (window.HFRecuperacionProducto) return;

  const estado = { iniciado:false, observer:null, timer:null };

  const norm = (s='') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();

  function ocultarOutlook() {
    document.querySelectorAll('button,a,[role="button"]').forEach(el => {
      const t = norm(el.textContent);
      if (t === 'outlook' || t.includes('conectar outlook') || t.includes('sincronizar outlook')) el.remove();
    });

    document.querySelectorAll('[id*="outlook" i],[class*="outlook" i]').forEach(el => {
      if (el.closest('script')) return;
      el.remove();
    });

    document.querySelectorAll('.modal-overlay,.modal,.dialog,[role="dialog"]').forEach(el => {
      const t = norm(el.textContent);
      if (t.includes('client id') || t.includes('microsoft entra') || t.includes('tenant id')) el.remove();
    });
  }

  function esNucleoDeudas(el) {
    if (!el) return false;
    if (el.matches('.kpi-grid')) return true;
    if (el.querySelector('#tarjetas-grid,#prestamos-grid,#debtChart')) return true;
    const t = norm(el.textContent.slice(0,240));
    return t.includes('tarjetas de credito') || t.includes('prestamos activos') || t.includes('proyeccion libre de deuda');
  }

  function esInteligencia(el) {
    const t = norm(el.textContent.slice(0,500));
    return [
      'centro inteligente','asistente financiero','optimizador','prediccion','recomendacion',
      'simulador','director financiero','memoria financiera','objetivos financieros',
      'calendario financiero','insights financieros','flujo de caja predictivo'
    ].some(x => t.includes(x));
  }

  function crearCentro() {
    let modal = document.getElementById('hf-centro-financiero-modal');
    if (modal) return modal.querySelector('.hf-centro-financiero-contenido');

    modal = document.createElement('div');
    modal.id = 'hf-centro-financiero-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-sheet hf-centro-financiero-sheet" style="position:relative;max-height:90vh;overflow:auto">
        <button class="modal-close" type="button" data-hf-cerrar-centro>✕</button>
        <div class="modal-handle"></div>
        <div class="modal-title">Centro financiero</div>
        <p style="font-size:13px;color:var(--text2);line-height:1.5;margin:0 0 14px">Herramientas de análisis, proyección y recomendaciones. Estas funciones están separadas del registro cotidiano de tus deudas.</p>
        <div class="hf-centro-financiero-contenido"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('[data-hf-cerrar-centro]')) modal.classList.remove('active');
    });
    return modal.querySelector('.hf-centro-financiero-contenido');
  }

  function crearBoton(pagina) {
    if (pagina.querySelector('[data-hf-abrir-centro]')) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.dataset.hfAbrirCentro = 'true';
    boton.className = 'btn-recurrentes';
    boton.textContent = 'Centro financiero';
    boton.style.cssText = 'width:100%;margin:14px 0 2px;min-height:44px';
    boton.addEventListener('click', () => document.getElementById('hf-centro-financiero-modal')?.classList.add('active'));
    pagina.appendChild(boton);
  }

  function reorganizarDeudas() {
    const pagina = document.getElementById('page-deudas');
    if (!pagina) return;
    const centro = crearCentro();

    [...pagina.children].forEach(el => {
      if (el.dataset.hfAbrirCentro || esNucleoDeudas(el)) return;
      if (esInteligencia(el)) centro.appendChild(el);
    });

    pagina.querySelectorAll('[id*="outlook" i],[class*="outlook" i]').forEach(el => el.remove());
    crearBoton(pagina);
  }

  function aplicar() {
    ocultarOutlook();
    reorganizarDeudas();
  }

  function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado = true;
    aplicar();
    estado.observer = new MutationObserver(() => {
      clearTimeout(estado.timer);
      estado.timer = setTimeout(aplicar, 100);
    });
    estado.observer.observe(document.body, { childList:true, subtree:true });
    window.addEventListener('hf:dashboard-actualizado', aplicar);
    window.addEventListener('hf:deudas-actualizadas', aplicar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, {once:true});
  else iniciar();

  window.HFRecuperacionProducto = Object.freeze({ iniciar, aplicar });
})();
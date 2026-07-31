/* Hogar Finanzas — Etapa 15.3: reorganización mobile-first de Deudas */
(() => {
  'use strict';
  if (window.HFModuloDeudasMobile) return;

  const TITULOS = [
    ['tarjetas','Mis tarjetas'],
    ['préstamos','Mis préstamos'],
    ['prestamos','Mis préstamos'],
    ['asistente','Asistente financiero'],
    ['recomendaciones','Recomendaciones'],
    ['optimiza','Plan de pagos'],
    ['proyección','Proyecciones'],
    ['proyeccion','Proyecciones'],
    ['simulador','Simuladores'],
    ['centro','Centro inteligente'],
    ['objetivos','Objetivos financieros'],
    ['outlook','Outlook'],
    ['importa','Movimientos detectados']
  ];

  function cargarCSS() {
    if (document.querySelector('link[data-hf-deudas-mobile]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('css/deudas-mobile.css?v=15.3', document.baseURI).href;
    link.dataset.hfDeudasMobile = 'true';
    document.head.appendChild(link);
  }

  function normalizar(texto='') {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  }

  function tituloPara(elemento) {
    const texto = normalizar(elemento.querySelector('.section-title,.hf-card-title,h2,h3,h4')?.textContent || elemento.textContent.slice(0,160));
    const hallado = TITULOS.find(([clave]) => texto.includes(normalizar(clave)));
    return hallado?.[1] || 'Más herramientas';
  }

  function esPrincipal(elemento) {
    return elemento.matches('.kpi-grid') || elemento.querySelector('#tarjetas-grid,#prestamos-grid') || /tarjetas de credito|prestamos activos/.test(normalizar(elemento.textContent.slice(0,180)));
  }

  function plegar(elemento) {
    if (!elemento || elemento.dataset.hfMobileProcesado || esPrincipal(elemento)) return;
    elemento.dataset.hfMobileProcesado = 'true';

    const details = document.createElement('details');
    details.className = 'hf-mobile-fold';
    const summary = document.createElement('summary');
    summary.textContent = tituloPara(elemento);
    const body = document.createElement('div');
    body.className = 'hf-mobile-fold-body';

    elemento.parentNode.insertBefore(details, elemento);
    details.append(summary, body);
    body.appendChild(elemento);
  }

  function ajustarOutlook(raiz) {
    raiz.querySelectorAll('[id*="outlook" i],[class*="outlook" i]').forEach(el => {
      const texto = normalizar(el.textContent);
      if (!texto.includes('client id') && !texto.includes('tenant')) return;
      el.classList.add('hf-outlook-technical-hidden');
      if (el.previousElementSibling?.classList.contains('hf-outlook-pending')) return;
      const aviso = document.createElement('div');
      aviso.className = 'hf-outlook-pending';
      aviso.innerHTML = '<strong>Integración pendiente</strong><p>La conexión automática con Outlook no está habilitada todavía. Puedes seguir registrando y probando tarjetas, pagos y estados de cuenta de forma manual.</p>';
      el.parentNode.insertBefore(aviso, el);
    });
  }

  function organizar() {
    const pagina = document.getElementById('page-deudas');
    if (!pagina) return false;

    ajustarOutlook(document);

    [...pagina.children].forEach(el => {
      if (el.matches('.section') && !esPrincipal(el)) plegar(el);
    });

    pagina.querySelectorAll('.hf-debt-center,.card.section,[data-module],[id*="panel" i]').forEach(el => {
      if (el.closest('.hf-mobile-fold') || el.closest('#tarjetas-grid,#prestamos-grid')) return;
      if (el.parentElement === pagina || el.parentElement?.classList.contains('section')) plegar(el);
    });

    window.dispatchEvent(new CustomEvent('hf:deudas-mobile-organizadas'));
    return true;
  }

  cargarCSS();
  const observer = new MutationObserver(() => {
    clearTimeout(observer._t);
    observer._t = setTimeout(organizar, 120);
  });

  function iniciar() {
    organizar();
    observer.observe(document.body, { childList:true, subtree:true });
    window.addEventListener('hf:deudas-actualizadas', organizar);
    window.addEventListener('hf:dashboard-actualizado', organizar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();

  window.HFModuloDeudasMobile = Object.freeze({ organizar });
})();
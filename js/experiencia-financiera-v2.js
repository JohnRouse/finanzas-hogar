(() => {
  'use strict';

  const ICONS = {
    resumen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5.5 9.5V21h13V9.5"></path><path d="M9 21v-6h6v6"></path></svg>',
    movimientos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14"></path><path d="M5 9h14"></path><path d="M5 14h9"></path><path d="M5 19h6"></path></svg>',
    deudas: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18"></path><path d="M7 15h3"></path></svg>',
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"></path><path d="M17 7.5c0-1.9-1.8-3.5-5-3.5S7 5.4 7 7.5 8.7 11 12 11s5 1.4 5 3.5S15.2 18 12 18s-5-1.6-5-3.5"></path></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1H9.6V21a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1V9.6H3a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.25.37.46.78.6 1 .13.34.2.7.2 1v1c0 .36-.07.72-.2 1-.14.22-.35.63-.6 1Z"></path></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"></path></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>'
  };

  function mejorarNavegacion() {
    const tabs = [...document.querySelectorAll('.tabs .tab')];
    const config = [
      ['resumen', 'Resumen'],
      ['movimientos', 'Movimientos'],
      ['deudas', 'Deudas'],
      ['plan', 'Plan']
    ];

    tabs.forEach((tab, index) => {
      const [icono, etiqueta] = config[index] || config[0];
      tab.innerHTML = `<span class="nav-icon">${ICONS[icono]}</span><span class="nav-label">${etiqueta}</span>`;
      tab.setAttribute('aria-label', etiqueta);
    });
  }

  function mejorarEncabezado() {
    const settings = document.querySelector('.settings-btn');
    if (settings) {
      settings.innerHTML = ICONS.settings;
      settings.setAttribute('aria-label', 'Configuración');
      settings.setAttribute('title', 'Configuración');
    }

    const monthButton = document.getElementById('monthBtn');
    const monthText = document.getElementById('month-display');
    if (monthButton && monthText) {
      monthButton.innerHTML = '';
      monthButton.append(monthText, crearNodoSvg(ICONS.chevron));
      monthButton.setAttribute('aria-label', 'Cambiar mes');
    }
  }

  function crearNodoSvg(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  }

  function agruparMetricasResumen() {
    const grid = document.querySelector('#page-resumen .month-money-grid');
    if (!grid || grid.querySelector('.summary-secondary-list')) return;

    const cards = [...grid.children].filter(el => el.classList.contains('month-money-card'));
    if (cards.length < 3) return;

    const secondary = document.createElement('div');
    secondary.className = 'summary-secondary-list';
    secondary.setAttribute('aria-label', 'Indicadores complementarios del mes');
    secondary.append(cards[1], cards[2]);
    grid.appendChild(secondary);
  }

  function actualizarTitulos() {
    const titles = [...document.querySelectorAll('.section-title')];
    titles.forEach(title => {
      const texto = title.textContent.trim();
      if (texto === 'Participación del hogar') {
        title.textContent = 'Gastos registrados por persona';
      }
    });
  }

  function mejorarMenusDeuda(root = document) {
    root.querySelectorAll?.('.debt-more-btn').forEach(button => {
      if (button.dataset.v2Ready === '1') return;
      button.dataset.v2Ready = '1';
      button.innerHTML = ICONS.more;
      const card = button.closest('.debt-card');
      const nombre = card?.querySelector('.debt-name')?.textContent?.trim();
      button.setAttribute('aria-label', nombre ? `Opciones de ${nombre}` : 'Opciones');
      button.setAttribute('title', nombre ? `Editar o eliminar ${nombre}` : 'Editar o eliminar');
    });

    root.querySelectorAll?.('.debt-more-menu button').forEach(button => {
      const texto = button.textContent.trim().toLowerCase();
      if (texto.includes('eliminar')) button.classList.add('danger');
    });
  }

  function humanizarOrigenTelegram(root = document) {
    const scope = root.querySelectorAll ? root : document;
    const candidates = scope.querySelectorAll('#expenseList span, #expenseList div, #listaCompletaGastos span, #listaCompletaGastos div');
    candidates.forEach(node => {
      if (node.children.length > 0) return;
      if (node.textContent.trim() !== 'Telegram') return;
      node.textContent = 'Automático';
      node.classList.add('expense-source-auto');
      node.setAttribute('title', 'Registrado por el bot de Telegram');
    });
  }

  function vigilarContenidoDinamico() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          mejorarMenusDeuda(node);
          humanizarOrigenTelegram(node);
        });
      }
      mejorarMenusDeuda();
      humanizarOrigenTelegram();
    });

    ['tarjetas-grid', 'prestamos-grid', 'expenseList', 'listaCompletaGastos']
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .forEach(element => observer.observe(element, { childList: true, subtree: true }));
  }

  function cerrarMenusAlTocarFuera() {
    document.addEventListener('click', event => {
      if (event.target.closest('.debt-more-wrap')) return;
      document.querySelectorAll('.debt-more-menu.open').forEach(menu => menu.classList.remove('open'));
    });
  }

  function iniciar() {
    mejorarNavegacion();
    mejorarEncabezado();
    agruparMetricasResumen();
    actualizarTitulos();
    mejorarMenusDeuda();
    humanizarOrigenTelegram();
    vigilarContenidoDinamico();
    cerrarMenusAlTocarFuera();
    document.body.classList.add('experiencia-v2-activa');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();

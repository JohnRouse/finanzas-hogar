(() => {
  'use strict';

  const VERSION = '33.2';
  if (window.HFVisualUIUX22?.version === VERSION) return;

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5.5 9.5V21h13V9.5"></path><path d="M9 21v-6h6v6"></path></svg>',
    movements: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14"></path><path d="M5 10h14"></path><path d="M5 15h10"></path><path d="M5 20h7"></path></svg>',
    card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18"></path><path d="M7 15h3"></path></svg>',
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"></path><path d="M17 7.5C17 5.5 15.2 4 12 4S7 5.4 7 7.5 8.7 11 12 11s5 1.4 5 3.5S15.2 18 12 18s-5-1.6-5-3.5"></path></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1H9.6V21a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1V9.6H3a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.25.37.46.78.6 1 .13.34.2.7.2 1v1c0 .36-.07.72-.2 1-.14.22-.35.63-.6 1Z"></path></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"></path></svg>'
  };

  function hideRemovedBlocks() {
    ['estado-mes', 'atencion-section', 'estado-financiero'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.style.setProperty('display', 'none', 'important');
    });
  }

  function enhanceHeader() {
    const settings = document.querySelector('.settings-btn');
    if (settings && settings.dataset.hfUiux !== VERSION) {
      settings.dataset.hfUiux = VERSION;
      settings.innerHTML = ICONS.settings;
      settings.setAttribute('aria-label', 'Abrir configuración');
      settings.setAttribute('title', 'Configuración');
    }

    const monthButton = document.getElementById('monthBtn');
    if (!monthButton) return;

    [...monthButton.childNodes].forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.nodeValue = String(node.nodeValue || '').replace(/[▾▼⌄]/g, '');
      }
    });

    const chevrons = [...monthButton.querySelectorAll('.hf-month-chevron')];
    chevrons.slice(1).forEach(node => node.remove());

    if (!chevrons.length) {
      const chevron = document.createElement('span');
      chevron.className = 'hf-month-chevron';
      chevron.innerHTML = ICONS.chevron;
      monthButton.appendChild(chevron);
    }

    monthButton.setAttribute('aria-label', 'Cambiar mes');
  }

  function enhanceNavigation() {
    const config = [
      ['home', 'Resumen'],
      ['movements', 'Movimientos'],
      ['card', 'Deudas'],
      ['plan', 'Plan']
    ];

    document.querySelectorAll('.tabs .tab').forEach((tab, index) => {
      const [icon, label] = config[index] || config[0];
      if (tab.dataset.hfUiux === VERSION) return;
      tab.dataset.hfUiux = VERSION;
      tab.innerHTML = `<span class="nav-icon">${ICONS[icon]}</span><span class="nav-label">${label}</span>`;
      tab.setAttribute('aria-label', label);
    });

    document.querySelectorAll('.bottom-nav .bnav-btn').forEach((button, index) => {
      const [icon, label] = config[index] || config[0];
      button.setAttribute('aria-label', label);
      const iconNode = button.querySelector('.bnav-icon');
      if (iconNode) iconNode.innerHTML = ICONS[icon];
      const textNode = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (textNode) textNode.textContent = label;
    });
  }

  function arrangeSummary() {
    const grid = document.querySelector('#page-resumen .month-money-grid');
    if (!grid) return;

    let secondary = grid.querySelector('.summary-secondary-list');
    const cards = [...grid.children].filter(element => element.classList.contains('month-money-card'));

    if (!secondary && cards.length >= 3) {
      secondary = document.createElement('div');
      secondary.className = 'summary-secondary-list';
      secondary.setAttribute('aria-label', 'Indicadores complementarios del mes');
      secondary.append(cards[1], cards[2]);
      grid.appendChild(secondary);
    }
  }

  function setChartDefaults() {
    if (!window.Chart?.defaults) return;
    window.Chart.defaults.font.family = 'IBM Plex Sans, system-ui, sans-serif';
    window.Chart.defaults.font.size = 12;
    window.Chart.defaults.color = '#64748b';
    window.Chart.defaults.borderColor = 'rgba(203, 213, 225, .55)';
  }

  function repair() {
    hideRemovedBlocks();
    enhanceHeader();
    enhanceNavigation();
    arrangeSummary();
    setChartDefaults();
    document.body?.classList.add('hf-uiux-pro-max');
  }

  function start() {
    repair();
    ['hf:gastos-actualizados', 'hf:deuda-actualizada', 'hf:deudas-core-actualizadas']
      .forEach(name => window.addEventListener(name, repair));
  }

  window.HFVisualUIUX22 = Object.freeze({ version: VERSION, repair });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

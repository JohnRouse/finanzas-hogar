(() => {
  'use strict';
  const VERSION = '33.0';
  if (window.HFVisualUIUX22?.version === VERSION) return;

  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5M9 21v-6h6v6"></path></svg>',
    movements: '<svg viewBox="0 0 24 24"><path d="M5 5h14M5 10h14M5 15h10M5 20h7"></path></svg>',
    card: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18M7 15h3"></path></svg>',
    plan: '<svg viewBox="0 0 24 24"><path d="M12 3v18M17 7.5C17 5.5 15.2 4 12 4S7 5.4 7 7.5 8.7 11 12 11s5 1.4 5 3.5S15.2 18 12 18s-5-1.6-5-3.5"></path></svg>'
  };

  function repair() {
    ['estado-mes','atencion-section','estado-financiero'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.style.display = 'none';
    });

    document.querySelector('.app-header')?.classList.add('hf-v22-header');
    const items = [
      ['resumen', ICONS.home, 'Resumen'],
      ['gastos', ICONS.movements, 'Movimientos'],
      ['deudas', ICONS.card, 'Deudas'],
      ['ahorro', ICONS.plan, 'Plan']
    ];
    document.querySelectorAll('.bottom-nav .bnav-btn').forEach((button, index) => {
      const item = items[index];
      if (!item) return;
      button.dataset.hfTab = item[0];
      button.setAttribute('aria-label', item[2]);
      const icon = button.querySelector('.bnav-icon');
      const label = button.querySelector('.bnav-label');
      if (icon) icon.innerHTML = item[1];
      if (label) label.textContent = item[2];
    });
    if (window.Chart?.defaults) {
      window.Chart.defaults.font.family = 'IBM Plex Sans, system-ui, sans-serif';
      window.Chart.defaults.color = '#64748b';
    }
    document.body?.classList.add('hf-uiux-pro-max');
  }

  function start() {
    repair();
    ['hf:gastos-actualizados','hf:deuda-actualizada','hf:deudas-core-actualizadas']
      .forEach(name => window.addEventListener(name, repair));
  }

  window.HFVisualUIUX22 = Object.freeze({ version: VERSION, repair });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

(() => {
  'use strict';

  const VERSION = '33.2';
  if (window.HFAvatarRandom332?.version === VERSION) return;

  const ADJECTIVES = [
    'brisa', 'luna', 'menta', 'cielo', 'mora', 'nube',
    'violeta', 'coral', 'ambar', 'azul', 'oliva', 'arena'
  ];
  const NOUNS = [
    'hogar', 'sonrisa', 'calma', 'viaje', 'estrella', 'jardin',
    'rio', 'bosque', 'mar', 'sol', 'noche', 'aurora'
  ];

  function avatarUrl(seed, size = 96) {
    return `https://api.dicebear.com/10.x/micah/svg?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=dbeafe,e0e7ff,fce7f3,d1fae5&borderRadius=50`;
  }

  function randomHex() {
    if (window.crypto?.getRandomValues) {
      const values = new Uint32Array(2);
      window.crypto.getRandomValues(values);
      return [...values].map(value => value.toString(16).padStart(8, '0')).join('');
    }
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  }

  function generateSeeds(amount = 12) {
    const seeds = new Set();
    while (seeds.size < amount) {
      const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
      const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
      seeds.add(`${adjective}-${noun}-${randomHex().slice(0, 10)}`);
    }
    return [...seeds];
  }

  function optionHTML(seed, selected = false) {
    const safeSeed = String(seed).replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[char]));
    return `<button type="button" class="hf-v27-avatar-option${selected ? ' selected' : ''}" data-avatar-seed="${safeSeed}" aria-pressed="${selected}"><img src="${avatarUrl(seed)}" alt="Opción de avatar Micah"></button>`;
  }

  function randomizeAvatars() {
    const grid = document.getElementById('hf-v27-avatar-grid');
    if (!grid) return;
    const seeds = generateSeeds(12);
    grid.innerHTML = seeds.map((seed, index) => optionHTML(seed, index === 0)).join('');
    grid.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function installButton() {
    const modal = document.getElementById('hfAvatarModal');
    const grid = document.getElementById('hf-v27-avatar-grid');
    if (!modal || !grid || document.getElementById('hf-v33-randomize-avatars')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'hf-v33-randomize-avatars';
    button.className = 'hf-v33-avatar-randomize';
    button.innerHTML = '<span aria-hidden="true">↻</span><span>Generar 12 avatares nuevos</span>';
    button.addEventListener('click', event => {
      event.preventDefault();
      randomizeAvatars();
    });
    grid.before(button);
  }

  function start() {
    installButton();
    document.addEventListener('click', event => {
      if (event.target.closest('[data-hf-open-avatar]')) setTimeout(installButton, 0);
    });
  }

  window.HFAvatarRandom332 = Object.freeze({
    version: VERSION,
    randomizeAvatars,
    generateSeeds
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

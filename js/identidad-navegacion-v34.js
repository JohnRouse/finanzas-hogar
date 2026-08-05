(() => {
  'use strict';

  const VERSION = '34.0-beta.1';
  if (window.HFIdentidadNavegacion34?.version === VERSION) return;

  const state = {
    observer: null,
    retries: 0,
    updating: false
  };

  const $ = id => document.getElementById(id);

  function avatarUrl(seed, size = 112) {
    return `https://api.dicebear.com/10.x/micah/svg?seed=${encodeURIComponent(seed || 'Hogar Finanzas')}&size=${size}&backgroundColor=dbeafe,e0e7ff,fce7f3,d1fae5&borderRadius=50`;
  }

  async function profileContext() {
    const raw = await window.DB?.getConfig?.() || {};
    const cfg = typeof window.normalizarConfigIdentidad === 'function'
      ? window.normalizarConfigIdentidad(raw)
      : raw;

    let member = typeof window.obtenerMiembroActual === 'function'
      ? window.obtenerMiembroActual(cfg)
      : null;

    const storedId = localStorage.getItem('miembroActualId');
    const legacy = localStorage.getItem('miUsuarioTipo');
    const id = member?.id
      || storedId
      || (legacy === 'pareja' ? cfg.miembroParejaId : cfg.miembroPrincipalId)
      || 'usuario';

    member = member || cfg.miembros?.[id] || {
      id,
      nombre: legacy === 'pareja' ? (cfg.nombreElla || 'Sydney') : (cfg.nombreYo || 'Christian'),
      legacyTipo: legacy || 'yo'
    };

    return {
      member,
      seed: member.avatarMicahSeed || `${id}-${member.nombre}`
    };
  }

  function openSettings() {
    const button = $('hf-nav-avatar');
    button?.setAttribute('aria-expanded', 'true');

    try {
      if (typeof window.openAjustesModal === 'function') {
        window.openAjustesModal();
      } else if (typeof window.openModal === 'function') {
        window.openModal('ajustesModal');
      } else {
        $('ajustesModal')?.classList.add('open');
      }
    } finally {
      setTimeout(() => button?.setAttribute('aria-expanded', 'false'), 350);
    }
  }

  function ensureNavigationAvatar() {
    const tabs = document.querySelector('.tabs');
    if (!tabs) return null;

    let button = $('hf-nav-avatar');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'hf-nav-avatar';
      button.className = 'hf-nav-avatar-slot';
      button.setAttribute('aria-label', 'Abrir configuración');
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = `
        <span class="hf-nav-avatar-ring" aria-hidden="true">
          <img alt="" loading="eager" decoding="async">
        </span>
        <span class="hf-nav-avatar-label">Ajustes</span>`;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openSettings();
      });

      const tabsOnly = [...tabs.querySelectorAll(':scope > .tab')];
      const debtsTab = tabsOnly[2];
      if (debtsTab) tabs.insertBefore(button, debtsTab);
      else tabs.appendChild(button);
    }

    tabs.classList.add('hf-nav-avatar-ready');
    return button;
  }

  function sourceAvatar() {
    return document.querySelector(
      '#hf-v27-home-profile img, #hf-v27-avatar-settings img, #aj-perfil-avatar img'
    );
  }

  function mirrorSourceAvatar() {
    const source = sourceAvatar();
    const target = $('hf-nav-avatar')?.querySelector('img');
    if (!source?.src || !target) return false;
    if (target.src !== source.src) target.src = source.src;
    return true;
  }

  function observeSourceAvatar() {
    const source = sourceAvatar();
    if (!source || state.observer) return;

    state.observer = new MutationObserver(() => mirrorSourceAvatar());
    state.observer.observe(source, { attributes: true, attributeFilter: ['src'] });
  }

  async function updateAvatar() {
    if (state.updating) return;
    state.updating = true;
    try {
      ensureNavigationAvatar();

      try {
        await window.HFExperienciaAuxiliar33?.updateAvatarUI?.();
      } catch (_) {}

      if (!mirrorSourceAvatar()) {
        const context = await profileContext();
        const target = $('hf-nav-avatar')?.querySelector('img');
        if (target) target.src = avatarUrl(context.seed, 112);
      }

      observeSourceAvatar();
    } catch (error) {
      console.warn('No se pudo actualizar el avatar de navegación:', error);
    } finally {
      state.updating = false;
    }
  }

  function updateFavicon() {
    const href = './icons/app-icon.svg?v=34.0-beta.1';
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.type = 'image/svg+xml';
    favicon.href = href;
  }

  function limitedRetry() {
    updateAvatar();
    if ($('hf-nav-avatar') || state.retries >= 6) return;
    state.retries += 1;
    setTimeout(limitedRetry, 250);
  }

  function start() {
    updateFavicon();
    limitedRetry();

    document.addEventListener('click', event => {
      if (event.target.closest('#hf-v27-save-avatar')) {
        setTimeout(updateAvatar, 650);
      }
      if (event.target.closest('.settings-btn, .app-logo')) {
        setTimeout(updateAvatar, 0);
      }
    });

    window.addEventListener('hf:avatar-actualizado', updateAvatar);
    window.addEventListener('hf:bootstrap-avanzado-completado', updateAvatar);
  }

  window.HFIdentidadNavegacion34 = Object.freeze({
    version: VERSION,
    updateAvatar,
    ensureNavigationAvatar,
    openSettings
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

(() => {
  'use strict';

  const VERSION = '33.0';
  if (window.HFExperienciaUnificada?.version === VERSION) return;

  const state = {
    originalFabHandler: typeof window.handleFabClick === 'function' ? window.handleFabClick : null,
    activeMemberId: '',
    selectedAvatarSeed: '',
    avatarSaving: false
  };

  const $ = id => document.getElementById(id);
  const normalize = (value = '') => String(value).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));

  const AVATAR_SEEDS = [
    'Luna tranquila', 'Cielo amable', 'Menta feliz', 'Sol de casa',
    'Nube serena', 'Azul hogar', 'Brisa suave', 'Mora alegre',
    'Rio claro', 'Dia bonito', 'Violeta calma', 'Mar en casa'
  ];

  function wrapperFor(input) {
    return input?.closest('.hf-v27-payment-available, .hf-payment-bank-balance, .form-group, .input-group, .field-group, .input-row, .form-row') || input?.parentElement;
  }

  function normalizePaymentModal() {
    const modal = $('pagoTarjetaModal');
    if (!modal) return;
    const availableInputs = [...modal.querySelectorAll('#pago-disponible-banco')];
    if (!availableInputs.length) return;

    const preferred = availableInputs.find(input => input.closest('.hf-v27-payment-available, .hf-payment-bank-balance')) || availableInputs.at(-1);
    availableInputs.forEach(input => {
      if (input !== preferred) wrapperFor(input)?.remove();
    });

    const availableWrapper = wrapperFor(preferred);
    availableWrapper?.classList.add('hf-v27-payment-available');
    const label = availableWrapper?.querySelector('label');
    if (label) label.textContent = 'Línea disponible después del pago (opcional)';

    const noteInput = modal.querySelector('#pago-nota, [name="nota"]');
    const noteWrapper = wrapperFor(noteInput);
    if (noteWrapper && availableWrapper && noteWrapper.nextElementSibling !== availableWrapper) noteWrapper.after(availableWrapper);
  }

  function removeQuickExpenseUI() {
    document.querySelectorAll('#page-gastos button, #gastoChoiceModal button').forEach(button => {
      if (normalize(button.textContent).includes('gasto rapido')) button.remove();
    });
  }

  function removeDebtQuickPayments() {
    const modal = $('hfDebtAdminModal');
    modal?.querySelector('.hf-debt-admin-separator')?.remove();
    modal?.querySelector('#hf-admin-card-actions')?.remove();
  }

  function currentPageIsMovements() {
    return $('page-gastos')?.classList.contains('active');
  }

  function openDetailedExpense() {
    try { window.closeModal?.('gastoChoiceModal'); } catch (_) {}
    if (typeof window.openGastoModal === 'function') return window.openGastoModal();
    return window.openModal?.('gastoModal');
  }

  function unifiedFabHandler() {
    if (currentPageIsMovements()) {
      try { window.vibrar?.(); } catch (_) {}
      return openDetailedExpense();
    }
    return state.originalFabHandler?.();
  }

  function avatarUrl(seed, size = 112) {
    return `https://api.dicebear.com/10.x/micah/svg?seed=${encodeURIComponent(seed || 'Hogar Finanzas')}&size=${size}&backgroundColor=dbeafe,e0e7ff,fce7f3,d1fae5&borderRadius=50`;
  }

  async function profileContext() {
    const raw = await window.DB?.getConfig?.() || {};
    const cfg = typeof window.normalizarConfigIdentidad === 'function' ? window.normalizarConfigIdentidad(raw) : raw;
    let member = typeof window.obtenerMiembroActual === 'function' ? window.obtenerMiembroActual(cfg) : null;
    const storedId = localStorage.getItem('miembroActualId');
    const legacy = localStorage.getItem('miUsuarioTipo');
    const id = member?.id || storedId || (legacy === 'pareja' ? cfg.miembroParejaId : cfg.miembroPrincipalId) || 'usuario';
    member = member || cfg.miembros?.[id] || {
      id,
      nombre: legacy === 'pareja' ? (cfg.nombreElla || 'Sydney') : (cfg.nombreYo || 'Christian'),
      legacyTipo: legacy || 'yo'
    };
    return { cfg, member, id, seed: member.avatarMicahSeed || `${id}-${member.nombre}` };
  }

  function ensureHomeProfile() {
    const page = $('page-resumen');
    const grid = page?.querySelector('.month-money-grid');
    if (!page || !grid) return null;
    let profile = $('hf-v27-home-profile');
    if (!profile) {
      grid.insertAdjacentHTML('beforebegin', `
        <section id="hf-v27-home-profile" class="hf-v27-home-profile">
          <button type="button" class="hf-v27-home-avatar" data-hf-open-avatar aria-label="Cambiar avatar"><img alt="Avatar del perfil"></button>
          <div><small>Tu resumen del mes</small><strong id="hf-home-greeting">Hola</strong><span>Así van tus finanzas en este mes.</span></div>
        </section>`);
      profile = $('hf-v27-home-profile');
    }
    return profile;
  }

  function ensureAvatarSetting() {
    const profileCard = document.querySelector('#ajustesModal .settings-profile-card');
    if (!profileCard) return null;
    let setting = $('hf-v27-avatar-settings');
    if (!setting) {
      profileCard.insertAdjacentHTML('afterend', `
        <button type="button" id="hf-v27-avatar-settings" class="hf-v27-avatar-settings" data-hf-open-avatar>
          <span class="hf-v27-settings-avatar"><img alt="Avatar Micah"></span>
          <span><small>Personalización</small><strong>Avatar del perfil</strong><em>Elige cómo aparecerás en el Resumen.</em></span>
          <b aria-hidden="true">›</b>
        </button>`);
      setting = $('hf-v27-avatar-settings');
    }
    return setting;
  }

  function ensureAvatarModal() {
    let modal = $('hfAvatarModal');
    if (modal) return modal;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="hfAvatarModal" onclick="closeModalOutside(event,'hfAvatarModal')">
        <div class="modal-sheet hf-v27-avatar-sheet" style="position:relative;">
          <button class="modal-close" type="button" onclick="closeModal('hfAvatarModal')">✕</button>
          <div class="modal-handle"></div>
          <div class="modal-title">Elige tu avatar</div>
          <p class="hf-v27-avatar-intro">Selecciona un avatar Micah para este integrante del hogar.</p>
          <div id="hf-v27-avatar-grid" class="hf-v27-avatar-grid">
            ${AVATAR_SEEDS.map(seed => `<button type="button" class="hf-v27-avatar-option" data-avatar-seed="${escapeHTML(seed)}" aria-pressed="false"><img src="${avatarUrl(seed, 96)}" alt="Opción de avatar"></button>`).join('')}
          </div>
          <button type="button" id="hf-v27-save-avatar" class="modal-btn primary">Guardar avatar</button>
          <small class="hf-v27-avatar-credit">Avatares Micah generados con DiceBear.</small>
        </div>
      </div>`);
    return $('hfAvatarModal');
  }

  async function updateAvatarUI() {
    try {
      const context = await profileContext();
      state.activeMemberId = context.id;
      state.selectedAvatarSeed = context.seed;
      const profile = ensureHomeProfile();
      const setting = ensureAvatarSetting();
      profile?.querySelector('img')?.setAttribute('src', avatarUrl(context.seed, 128));
      if ($('hf-home-greeting')) $('hf-home-greeting').textContent = `Hola, ${context.member.nombre}`;
      setting?.querySelector('img')?.setAttribute('src', avatarUrl(context.seed, 96));
      const settingsProfile = document.querySelector('#aj-perfil-avatar');
      if (settingsProfile) settingsProfile.innerHTML = `<img src="${avatarUrl(context.seed, 96)}" alt="Avatar del perfil">`;
    } catch (error) {
      console.warn('No se pudo actualizar el avatar:', error);
    }
  }

  async function openAvatarModal() {
    await updateAvatarUI();
    ensureAvatarModal();
    document.querySelectorAll('#hf-v27-avatar-grid .hf-v27-avatar-option').forEach(option => {
      const selected = option.dataset.avatarSeed === state.selectedAvatarSeed;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
    window.openModal?.('hfAvatarModal');
  }

  async function saveAvatar() {
    if (state.avatarSaving) return;
    const selected = document.querySelector('#hf-v27-avatar-grid .hf-v27-avatar-option.selected')?.dataset.avatarSeed;
    if (!selected) return window.showToast?.('Selecciona un avatar.', 'error');
    const button = $('hf-v27-save-avatar');
    state.avatarSaving = true;
    if (button) { button.disabled = true; button.textContent = 'Guardando…'; }
    try {
      const context = await profileContext();
      const members = { ...(context.cfg.miembros || {}) };
      members[context.id] = { ...context.member, avatarMicahSeed: selected };
      await window.DB.updateConfig({ miembros: members });
      state.selectedAvatarSeed = selected;
      await updateAvatarUI();
      window.closeModal?.('hfAvatarModal');
      window.showToast?.('Avatar actualizado');
    } catch (error) {
      console.error('No se pudo guardar el avatar:', error);
      window.showToast?.('No se pudo guardar el avatar.', 'error');
    } finally {
      state.avatarSaving = false;
      if (button) { button.disabled = false; button.textContent = 'Guardar avatar'; }
    }
  }

  function handleDocumentClick(event) {
    const avatarLauncher = event.target.closest('[data-hf-open-avatar]');
    if (avatarLauncher) {
      event.preventDefault();
      openAvatarModal();
      return;
    }

    const option = event.target.closest('.hf-v27-avatar-option');
    if (option) {
      document.querySelectorAll('.hf-v27-avatar-option').forEach(item => {
        const selected = item === option;
        item.classList.toggle('selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      return;
    }

    if (event.target.closest('#hf-v27-save-avatar')) {
      event.preventDefault();
      saveAvatar();
      return;
    }

    if (event.target.closest('.settings-btn, .app-logo')) setTimeout(updateAvatarUI, 0);
    if (event.target.closest('[onclick*="registrarPagoTarjeta"], [onclick*="abrirPagoTarjeta"], .hf-v24-primary-action')) setTimeout(normalizePaymentModal, 0);
  }

  function start() {
    removeQuickExpenseUI();
    removeDebtQuickPayments();
    normalizePaymentModal();
    ensureAvatarModal();
    updateAvatarUI();
    if ($('historialTitle')) $('historialTitle').textContent = 'Movimientos';

    window.handleFabClick = unifiedFabHandler;
    window.openGastoChoiceModal = openDetailedExpense;
    window.openGastoRapidoModal = openDetailedExpense;

    document.addEventListener('click', handleDocumentClick);
    ['hf:deuda-actualizada', 'hf:deudas-core-actualizadas', 'hf:estado-cuenta-confirmado']
      .forEach(name => window.addEventListener(name, () => {
        removeDebtQuickPayments();
        normalizePaymentModal();
      }));
  }

  window.HFExperienciaUnificada = Object.freeze({
    version: VERSION,
    updateAvatarUI,
    normalizePaymentModal,
    removeDebtQuickPayments
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();

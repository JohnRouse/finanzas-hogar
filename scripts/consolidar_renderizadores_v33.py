from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "js/app.js"
DEBT_FAMILY = ROOT / "js/deudas-familiares.js"
DEBT_REDESIGN = ROOT / "js/deudas-redesign-v23.js"

MOVEMENT_TEMPLATE_BLOCK = r'''/* ── MOVIMIENTOS: COMPONENTE ÚNICO V33 ── */
const HF_MOVEMENT_ICONS = {
  card: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18"></path><path d="M7 15h3"></path></svg>',
  telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-7.3 18-4.2-7.2L3 10.6 21 3Z"></path><path d="m9.5 13.8 4.4-4.1"></path></svg>',
  cash: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><path d="M6 9h.01M18 15h.01"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  transfer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h15"></path><path d="m16 5 3 3-3 3"></path><path d="M20 16H5"></path><path d="m8 13-3 3 3 3"></path></svg>',
  cardPayment: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="3"></rect><path d="M3 9h18"></path><path d="m12 14 3 3 3-3"></path><path d="M15 12v7"></path></svg>',
  loanPayment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-5 9 5"></path><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"></path></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>',
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
  category: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"></path></svg>',
  note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5z"></path><path d="M8 8h8M8 12h8M8 16h5"></path></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 15H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>'
};

function hfMovNormalize(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function hfMovEscape(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
}

function hfMovMoney(value) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
}

function hfMovTimestamp(item = {}) {
  const value = item.creadoEn;
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (Number.isFinite(Number(value?.seconds))) return Number(value.seconds) * 1000;
  return Date.parse(value || item.fecha || '') || 0;
}

function hfMovIsCardPayment(item = {}) {
  return item.tipoMovimiento === 'pagoTarjeta' || /^pago\s+tarjeta:/i.test(item.desc || '');
}

function hfMovIsLoanPayment(item = {}) {
  return item.tipoMovimiento === 'pagoPrestamo' || /^pago\s+prestamo:/i.test(hfMovNormalize(item.desc || ''));
}

function hfMovTitle(item = {}) {
  if (hfMovIsCardPayment(item)) return `Pago a ${item.tarjetaNombre || 'tarjeta'}`;
  if (hfMovIsLoanPayment(item)) return `Pago de ${item.prestamoNombre || 'préstamo'}`;
  return item.desc || item.descripcion || 'Movimiento';
}

function hfMovCategory(item = {}) {
  if (hfMovIsCardPayment(item)) return { key:'debt', label:'Pago de tarjeta', icon:'💳' };
  if (hfMovIsLoanPayment(item)) return { key:'debt', label:'Pago de préstamo', icon:'🏦' };
  const original = item.cat || item.categoria || 'Otros';
  const category = hfMovNormalize(original);
  if (category.includes('aliment')) return { key:'food', label:'Alimentación', icon:'🛒' };
  if (category.includes('servicio')) return { key:'services', label:'Servicios', icon:'⚡' };
  if (category.includes('entret') || category.includes('ocio')) return { key:'entertainment', label:'Entretenimiento', icon:'🎬' };
  if (category.includes('transport')) return { key:'transport', label:'Transporte', icon:'🚕' };
  if (category.includes('salud') || category.includes('medic')) return { key:'health', label:'Salud', icon:'💊' };
  if (category.includes('hogar') || category.includes('casa')) return { key:'home', label:'Hogar', icon:'🏠' };
  if (category.includes('educ')) return { key:'education', label:'Educación', icon:'🎓' };
  if (category.includes('deuda')) return { key:'debt', label:'Deudas', icon:'💳' };
  return { key:'other', label:original || 'Otros', icon:'📦' };
}

function hfMovSource(item = {}) {
  return [item.medio, item.metodoPago, item.formaPago, item.fuente, item.origen, item.canal]
    .filter(Boolean).join(' ').toLowerCase();
}

function hfMovShortCard(value = '') {
  return String(value || 'Tarjeta').replace(/^tarjeta\s+/i, '').replace(/^visa\s+/i, '').replace(/^mastercard\s+/i, '').trim() || 'Tarjeta';
}

function hfMovBadge(icon, label, kind, title = label) {
  return `<span class="hf-v28-method-badge ${kind}" title="${hfMovEscape(title)}"><span class="hf-v28-badge-icon">${icon}</span><span class="hf-v28-badge-label">${hfMovEscape(label)}</span></span>`;
}

function hfMovBadges(item = {}) {
  const source = hfMovSource(item);
  const badges = [];
  const telegram = source.includes('telegram') || hfMovNormalize(item.fuente) === 'telegram';
  const yape = source.includes('yape') || /\byape\b/i.test(item.desc || '');
  const plin = source.includes('plin');
  const card = !hfMovIsCardPayment(item) && !hfMovIsLoanPayment(item) && (item.medio === 'tarjeta' || item.tarjetaId || item.tarjetaNombre);
  const debit = source.includes('debito') || source.includes('débito');
  const transfer = source.includes('transfer');
  const cash = source.includes('efectivo') || source.includes('cash');

  if (hfMovIsCardPayment(item)) badges.push(hfMovBadge(HF_MOVEMENT_ICONS.cardPayment, 'Pago de tarjeta', 'payment'));
  else if (hfMovIsLoanPayment(item)) badges.push(hfMovBadge(HF_MOVEMENT_ICONS.loanPayment, 'Pago de préstamo', 'payment'));
  else if (card) {
    const full = item.tarjetaNombre || 'Tarjeta';
    badges.push(hfMovBadge(HF_MOVEMENT_ICONS.card, hfMovShortCard(full), 'method-card', full));
  } else if (yape) badges.push(hfMovBadge('<span class="hf-v28-yape-letter">Y</span>', 'Yape', 'yape'));
  else if (plin) badges.push(hfMovBadge(HF_MOVEMENT_ICONS.transfer, 'Plin', 'transfer'));
  else if (debit) badges.push(hfMovBadge(HF_MOVEMENT_ICONS.card, 'Débito', 'debit'));
  else if (transfer) badges.push(hfMovBadge(HF_MOVEMENT_ICONS.transfer, 'Transferencia', 'transfer'));
  else if (cash || !source) badges.push(hfMovBadge(HF_MOVEMENT_ICONS.cash, 'Efectivo', 'cash'));

  if (telegram) badges.push(hfMovBadge(HF_MOVEMENT_ICONS.telegram, 'Telegram', 'telegram'));
  return badges.join('');
}

function hfMovPerson(item = {}, cfg = configCache || {}) {
  if (item.quien === 'pareja') return cfg.nombreElla || 'Sydney';
  if (item.quien === 'ambos') return 'Ambos';
  return cfg.nombreYo || 'Christian';
}

function hfMovDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
}

function generarGastoHTML(g, cfg = configCache || {}) {
  const category = hfMovCategory(g);
  return `
    <article class="hf-v28-movement hf-v32-movement cat-${category.key}" data-movement-id="${hfMovEscape(g.id || '')}" tabindex="0" role="button" aria-label="Ver detalle de ${hfMovEscape(hfMovTitle(g))}">
      <span class="hf-v28-movement-icon hf-v29-classic-category"><span class="hf-v32-category-glyph" aria-hidden="true">${category.icon}</span></span>
      <div class="hf-v28-movement-copy"><strong>${hfMovEscape(hfMovTitle(g))}</strong><span>${hfMovEscape(category.label)}${g.fecha ? ` · ${hfMovEscape(hfMovDate(g.fecha))}` : ''}</span></div>
      <div class="hf-v28-movement-amount"><strong>${hfMovMoney(g.monto)}</strong><span>${hfMovEscape(hfMovPerson(g, cfg))}</span></div>
      <div class="hf-v28-movement-badges">${hfMovBadges(g)}</div>
      <div class="hf-v28-movement-menu-wrap">
        <button type="button" class="hf-v28-movement-more" aria-label="Opciones" aria-expanded="false">${HF_MOVEMENT_ICONS.more}</button>
        <div class="hf-v28-movement-menu">
          ${hfMovIsCardPayment(g) || hfMovIsLoanPayment(g) ? '' : `<button type="button" data-action="edit">${HF_MOVEMENT_ICONS.edit}<span>Editar</span></button>`}
          <button type="button" class="danger" data-action="delete">${HF_MOVEMENT_ICONS.trash}<span>Eliminar</span></button>
        </div>
      </div>
    </article>`;
}
'''

MOVEMENT_RENDER_BLOCK = r'''function hfMovCloseMenus(except = null) {
  document.querySelectorAll('.hf-v28-movement-menu.open').forEach(menu => {
    if (menu === except) return;
    menu.classList.remove('open');
    menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
  });
}

function hfMovDetailRow(icon, label, value) {
  if (value === null || value === undefined || value === '') return '';
  return `<div class="hf-v28-detail-row"><span>${icon}</span><div><small>${hfMovEscape(label)}</small><strong>${hfMovEscape(value)}</strong></div></div>`;
}

function hfMovEnsureDetailModal() {
  let modal = document.getElementById('hfMovementDetailModal');
  if (modal) return modal;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="hfMovementDetailModal" onclick="closeModalOutside(event,'hfMovementDetailModal')">
      <div class="modal-sheet hf-v28-detail-sheet" style="position:relative;">
        <button class="modal-close" type="button" onclick="closeModal('hfMovementDetailModal')">✕</button>
        <div class="modal-handle"></div>
        <div class="hf-v28-detail-hero">
          <span id="hf-movement-detail-icon" class="hf-v28-detail-icon"></span>
          <div><small id="hf-movement-detail-type">Movimiento</small><h2 id="hf-movement-detail-title">Detalle</h2><strong id="hf-movement-detail-amount">S/ 0.00</strong></div>
        </div>
        <div id="hf-movement-detail-badges" class="hf-v28-detail-badges"></div>
        <div id="hf-movement-detail-content" class="hf-v28-detail-content"></div>
      </div>
    </div>`);
  return document.getElementById('hfMovementDetailModal');
}

function abrirDetalleMovimiento(id) {
  const item = gastosDelMesCache.find(gasto => String(gasto.id) === String(id));
  if (!item) return;
  hfMovEnsureDetailModal();
  const category = hfMovCategory(item);
  const icon = document.getElementById('hf-movement-detail-icon');
  icon.className = `hf-v28-detail-icon cat-${category.key}`;
  icon.innerHTML = `<span class="hf-v32-category-glyph" aria-hidden="true">${category.icon}</span>`;
  document.getElementById('hf-movement-detail-type').textContent = category.label;
  document.getElementById('hf-movement-detail-title').textContent = hfMovTitle(item);
  document.getElementById('hf-movement-detail-amount').textContent = hfMovMoney(item.monto);
  document.getElementById('hf-movement-detail-badges').innerHTML = hfMovBadges(item);
  const source = hfMovSource(item);
  let method = 'Efectivo';
  if (item.medio === 'tarjeta' || item.tarjetaNombre) method = item.tarjetaNombre || 'Tarjeta de crédito';
  else if (source.includes('yape')) method = 'Yape';
  else if (source.includes('plin')) method = 'Plin';
  else if (source.includes('debito') || source.includes('débito')) method = 'Tarjeta de débito';
  else if (source.includes('transfer')) method = 'Transferencia';

  document.getElementById('hf-movement-detail-content').innerHTML = [
    hfMovDetailRow(HF_MOVEMENT_ICONS.category, 'Categoría', category.label),
    hfMovDetailRow(HF_MOVEMENT_ICONS.calendar, 'Fecha', hfMovDate(item.fecha)),
    hfMovDetailRow(HF_MOVEMENT_ICONS.person, 'Registrado por', hfMovPerson(item, configCache || {})),
    hfMovDetailRow(HF_MOVEMENT_ICONS.cash, 'Medio de pago', method),
    item.tarjetaNombre ? hfMovDetailRow(HF_MOVEMENT_ICONS.card, 'Tarjeta', item.tarjetaNombre) : '',
    item.prestamoNombre ? hfMovDetailRow(HF_MOVEMENT_ICONS.loanPayment, 'Préstamo', item.prestamoNombre) : '',
    item.nota ? hfMovDetailRow(HF_MOVEMENT_ICONS.note, 'Nota', item.nota) : '',
    item.fuente ? hfMovDetailRow(HF_MOVEMENT_ICONS.telegram, 'Origen', hfMovNormalize(item.fuente) === 'telegram' ? 'Telegram' : item.fuente) : '',
    item.creadoEn ? hfMovDetailRow(HF_MOVEMENT_ICONS.calendar, 'Registrado', new Date(hfMovTimestamp(item)).toLocaleString('es-PE')) : ''
  ].filter(Boolean).join('');
  openModal('hfMovementDetailModal');
}

let hfMovEventsInstalled = false;
function instalarEventosMovimientos() {
  if (hfMovEventsInstalled) return;
  hfMovEventsInstalled = true;
  document.addEventListener('click', event => {
    const openHistory = event.target.closest('[data-hf-open-history]');
    if (openHistory) {
      event.preventDefault();
      abrirHistorialCompleto();
      return;
    }

    const movement = event.target.closest('.hf-v32-movement');
    if (!movement) {
      hfMovCloseMenus();
      return;
    }

    const id = movement.dataset.movementId;
    const more = event.target.closest('.hf-v28-movement-more');
    if (more) {
      event.preventDefault();
      event.stopPropagation();
      const menu = more.nextElementSibling;
      const opening = !menu.classList.contains('open');
      hfMovCloseMenus(menu);
      menu.classList.toggle('open', opening);
      more.setAttribute('aria-expanded', String(opening));
      return;
    }

    const action = event.target.closest('[data-action]');
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      hfMovCloseMenus();
      if (action.dataset.action === 'edit') abrirEditarGasto(String(id));
      else if (action.dataset.action === 'delete') eliminarGasto(String(id));
      return;
    }

    if (!event.target.closest('.hf-v28-movement-menu')) abrirDetalleMovimiento(id);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hfMovCloseMenus();
    const movement = event.target.closest('.hf-v32-movement');
    if (movement && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      abrirDetalleMovimiento(movement.dataset.movementId);
    }
  });
}

function renderGastos(gastos, cfg) {
  const el = document.getElementById('expenseList');
  if (!el) return;
  instalarEventosMovimientos();

  gastosDelMesCache = [...(Array.isArray(gastos) ? gastos : [])].sort((a, b) => {
    const byDate = String(b.fecha || '').localeCompare(String(a.fecha || ''));
    return byDate || hfMovTimestamp(b) - hfMovTimestamp(a);
  });
  configCache = cfg || {};

  if (!gastosDelMesCache.length) {
    el.innerHTML = '<div class="empty-state">Sin movimientos registrados este mes.<br>Presiona el botón + para empezar.</div>';
    return;
  }

  const filtered = aplicarFiltroGastos(gastosDelMesCache);
  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state">No hay movimientos para este filtro.</div>';
    return;
  }

  const visible = filtered.slice(0, 5);
  el.innerHTML = visible.map(gasto => generarGastoHTML(gasto, configCache)).join('') + (filtered.length > 5 ? `
    <div class="ver-todo-container hf-v28-view-all">
      <button type="button" class="btn-ver-todo" data-hf-open-history>Ver todos los movimientos</button>
    </div>` : '');
}

function abrirHistorialCompleto() {
  instalarEventosMovimientos();
  const title = document.getElementById('historialTitle');
  const list = document.getElementById('listaCompletaGastos');
  const search = document.getElementById('historial-search');
  const clear = document.getElementById('historial-search-clear');
  const empty = document.getElementById('historial-no-resultados');
  if (title) title.textContent = 'Movimientos';
  if (search) search.value = '';
  if (clear) clear.style.display = 'none';
  if (empty) empty.style.display = 'none';
  if (list) list.innerHTML = aplicarFiltroGastos(gastosDelMesCache).map(gasto => generarGastoHTML(gasto, configCache)).join('');
  openModal('modalHistorial');
}

function filtrarHistorial(query = '') {
  const clear = document.getElementById('historial-search-clear');
  const list = document.getElementById('listaCompletaGastos');
  const empty = document.getElementById('historial-no-resultados');
  const normalized = hfMovNormalize(query);
  if (clear) clear.style.display = normalized ? 'grid' : 'none';
  const filtered = aplicarFiltroGastos(gastosDelMesCache).filter(gasto => {
    if (!normalized) return true;
    return hfMovNormalize([
      hfMovTitle(gasto), hfMovCategory(gasto).label, gasto.tarjetaNombre,
      gasto.prestamoNombre, gasto.nota, hfMovPerson(gasto, configCache), hfMovSource(gasto)
    ].filter(Boolean).join(' ')).includes(normalized);
  });
  if (list) list.innerHTML = filtered.map(gasto => generarGastoHTML(gasto, configCache)).join('');
  if (empty) empty.style.display = filtered.length ? 'none' : 'block';
}

function limpiarBusquedaHistorial() {
  const input = document.getElementById('historial-search');
  if (input) { input.value = ''; input.focus(); }
  filtrarHistorial('');
}

'''


def replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"No se pudo reemplazar {label}; coincidencias: {count}")
    return updated


def patch_app() -> None:
    text = APP.read_text(encoding="utf-8")
    text = replace_once(
        text,
        r'/\* ── RENDER PRÉSTAMOS ── \*/\s*function generarGastoHTML\(g, cfg\) \{.*?\n\}\n\nfunction ocultarSplash',
        MOVEMENT_TEMPLATE_BLOCK + '\nfunction ocultarSplash',
        'el generador de movimientos',
    )
    text = replace_once(
        text,
        r'function renderGastos\(gastos, cfg\) \{.*?\nfunction obtenerEstadoTarjeta',
        MOVEMENT_RENDER_BLOCK + 'function obtenerEstadoTarjeta',
        'el render e historial de movimientos',
    )
    APP.write_text(text, encoding="utf-8")


def patch_family_debts() -> None:
    text = DEBT_FAMILY.read_text(encoding="utf-8")
    old = """      renderAdminPagos(rt);\n      instalarFab();"""
    new = """      // La misma carga de datos se transforma antes de devolver el control al navegador.\n      // Así nunca se pinta una tarjeta heredada antes del componente aprobado.\n      window.HFDeudasRedesign24?.renderDebtPage?.(estado.tarjetas, estado.prestamos);\n      renderAdminPagos(rt);\n      instalarFab();"""
    if old not in text:
        raise RuntimeError('No se encontró el punto de integración de Deudas familiares')
    text = text.replace(old, new, 1)

    text = replace_once(
        text,
        r"    const pagina = \$\('page-deudas'\);\n    if \(pagina && !estado\.observer\) \{.*?\n    \}\n  \}\n\n  function obtenerEstado",
        """    const pagina = $('page-deudas');
    if (pagina && !estado.observer) {
      estado.observer = new MutationObserver(mutations => {
        const activated = mutations.some(m => m.type === 'attributes' && pagina.classList.contains('active'));
        if (activated && !$('hf-family-debt-view')?.querySelector('.hf-family-card')) programar();
        setTimeout(aplicarFabAdministracion, 40);
      });
      estado.observer.observe(pagina, { attributes:true, attributeFilter:['class'] });
    }
  }

  function obtenerEstado""",
        'el observador repetitivo de Deudas familiares',
    )
    DEBT_FAMILY.write_text(text, encoding="utf-8")


def patch_debt_redesign() -> None:
    text = DEBT_REDESIGN.read_text(encoding="utf-8")
    text = replace_once(
        text,
        r'  async function renderDebtPage\(\) \{.*?\n  \}\n\n  function enhancePaymentRows',
        r'''  async function renderDebtPage(cardsInput = null, loansInput = null) {
    if (state.rendering) return;
    const view = $('hf-family-debt-view');
    if (!view) return;
    const lists = view.querySelectorAll('.hf-family-card-list');
    if (lists.length < 2) return;

    state.rendering = true;
    try {
      const cards = Array.isArray(cardsInput)
        ? cardsInput
        : await (window.DB?.getTarjetas?.().catch(() => []) || []);
      const loans = Array.isArray(loansInput)
        ? loansInput
        : await (window.DB?.getPrestamos?.().catch(() => []) || []);

      if (lists[0].querySelectorAll('.hf-family-card').length !== cards.length) {
        lists[0].innerHTML = cards.length ? cards.map(() => '<article class="hf-family-card"></article>').join('') : '<div class="hf-family-priority-empty">No hay tarjetas registradas.</div>';
      }
      if (lists[1].querySelectorAll('.hf-family-card').length !== loans.length) {
        lists[1].innerHTML = loans.length ? loans.map(() => '<article class="hf-family-card"></article>').join('') : '<div class="hf-family-priority-empty">No hay préstamos registrados.</div>';
      }

      [...lists[0].querySelectorAll('.hf-family-card')].forEach((element, index) => cards[index] && renderCard(element, cardSummary(cards[index])));
      [...lists[1].querySelectorAll('.hf-family-card')].forEach((element, index) => loans[index] && renderLoan(element, loanSummary(loans[index])));
    } catch (error) {
      console.warn('No se pudo renderizar Deudas V24:', error);
    } finally {
      state.rendering = false;
    }
  }

  function enhancePaymentRows''',
        'el render directo de Deudas',
    )

    text = replace_once(
        text,
        r'  function startHealing\(\) \{.*?\n  \}\n\n  function start\(\) \{.*?\n  \}\n\n  window\.HFDeudasRedesign24',
        r'''  function start() {
    // Formularios y acciones se preparan una sola vez. Las tarjetas se generan
    // desde Deudas familiares con los mismos datos, sin ciclos de reparación.
    try { enhanceAdminModal(); } catch (error) { console.warn(error); }
    try { installCardFormHandlers(); } catch (error) { console.warn(error); }
    try { ensureAvailableBalanceField(); } catch (error) { console.warn(error); }
    document.body?.classList.add('hf-deudas-redesign-v24');

    document.addEventListener('click', event => {
      if (event.target.closest('.hf-v24-menu-wrap')) return;
      closeMenus();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenus();
    });

    ['hf:deuda-actualizada','hf:deudas-core-actualizadas','hf:estado-cuenta-confirmado','hf:deudas-recalculadas']
      .forEach(eventName => window.addEventListener(eventName, () => {
        try { enhanceAdminModal(); } catch (_) {}
        try { ensureAvailableBalanceField(); } catch (_) {}
      }));
  }

  window.HFDeudasRedesign24''',
        'el ciclo de reparación de Deudas',
    )
    DEBT_REDESIGN.write_text(text, encoding="utf-8")


def main() -> None:
    patch_app()
    patch_family_debts()
    patch_debt_redesign()
    print('✓ Movimientos se renderiza directamente desde app.js')
    print('✓ Historial comparte el mismo componente y título definitivo')
    print('✓ Deudas transforma los datos antes del primer pintado')
    print('✓ Ciclos y observadores de reparación retirados')


if __name__ == '__main__':
    main()

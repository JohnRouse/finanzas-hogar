(() => {
  'use strict';
  const VERSION = '33.0';
  if (window.HFMovimientosUnificados?.version === VERSION) return;

  const state = { gastos: [], config: {}, filtro: 'todos', query: '', instalado: false };
  const $ = id => document.getElementById(id);
  const norm = (v = '') => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const money = v => `S/ ${num(v).toLocaleString('es-PE', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const ICON = {
    card:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"></rect><path d="M3 10h18M7 15h3"></path></svg>',
    telegram:'<svg viewBox="0 0 24 24"><path d="m21 3-7.3 18-4.2-7.2L3 10.6 21 3Z"></path><path d="m9.5 13.8 4.4-4.1"></path></svg>',
    cash:'<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.5"></rect><circle cx="12" cy="12" r="3"></circle></svg>',
    transfer:'<svg viewBox="0 0 24 24"><path d="M4 8h15m-3-3 3 3-3 3M20 16H5m3-3-3 3 3 3"></path></svg>',
    payment:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="3"></rect><path d="M3 9h18m-6 3v7m-3-4 3 3 3-3"></path></svg>',
    more:'<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8"></circle><circle cx="12" cy="12" r="1.8"></circle><circle cx="12" cy="19" r="1.8"></circle></svg>',
    edit:'<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>',
    trash:'<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 5v5m4-5v5"></path></svg>',
    calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M16 3v4M8 3v4M3 10h18"></path></svg>',
    person:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
    category:'<svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"></path></svg>',
    note:'<svg viewBox="0 0 24 24"><path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"></path></svg>'
  };

  function timestamp(g = {}) {
    const v = g.creadoEn;
    if (v?.toMillis) return v.toMillis();
    if (v?.toDate) return v.toDate().getTime();
    if (Number.isFinite(Number(v?.seconds))) return Number(v.seconds) * 1000;
    return Date.parse(v || g.fecha || '') || 0;
  }

  function esPagoTarjeta(g = {}) { return g.tipoMovimiento === 'pagoTarjeta' || /^pago\s+tarjeta:/i.test(g.desc || ''); }
  function esPagoPrestamo(g = {}) { return g.tipoMovimiento === 'pagoPrestamo' || /^pago\s+prestamo:/i.test(norm(g.desc || '')); }
  function titulo(g = {}) {
    if (esPagoTarjeta(g)) return `Pago a ${g.tarjetaNombre || 'tarjeta'}`;
    if (esPagoPrestamo(g)) return `Pago de ${g.prestamoNombre || 'préstamo'}`;
    return g.desc || g.descripcion || 'Movimiento';
  }
  function categoria(g = {}) {
    if (esPagoTarjeta(g)) return { key:'debt', label:'Pago de tarjeta', icon:'💳' };
    if (esPagoPrestamo(g)) return { key:'debt', label:'Pago de préstamo', icon:'🏦' };
    const raw = g.cat || g.categoria || 'Otros';
    const c = norm(raw);
    if (c.includes('aliment')) return { key:'food', label:'Alimentación', icon:'🛒' };
    if (c.includes('servicio')) return { key:'services', label:'Servicios', icon:'⚡' };
    if (c.includes('entret') || c.includes('ocio')) return { key:'entertainment', label:'Entretenimiento', icon:'🎬' };
    if (c.includes('transport')) return { key:'transport', label:'Transporte', icon:'🚕' };
    if (c.includes('salud') || c.includes('medic')) return { key:'health', label:'Salud', icon:'💊' };
    if (c.includes('hogar') || c.includes('casa')) return { key:'home', label:'Hogar', icon:'🏠' };
    if (c.includes('educ')) return { key:'education', label:'Educación', icon:'🎓' };
    if (c.includes('deuda')) return { key:'debt', label:'Deudas', icon:'💳' };
    return { key:'other', label:raw || 'Otros', icon:'📦' };
  }
  function fecha(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))) return '';
    return new Date(`${v}T12:00:00`).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' });
  }
  function persona(g) {
    if (g.quien === 'pareja') return state.config.nombreElla || 'Sydney';
    if (g.quien === 'ambos') return 'Ambos';
    return state.config.nombreYo || 'Christian';
  }
  function fuente(g = {}) { return [g.medio,g.metodoPago,g.formaPago,g.fuente,g.origen,g.canal].filter(Boolean).join(' ').toLowerCase(); }
  function badge(icon, label, kind, full = label) {
    return `<span class="hf-v28-method-badge ${kind}" title="${esc(full)}"><span class="hf-v28-badge-icon">${icon}</span><span class="hf-v28-badge-label">${esc(label)}</span></span>`;
  }
  function badges(g = {}) {
    const f = fuente(g); const out = [];
    const telegram = f.includes('telegram') || norm(g.fuente) === 'telegram';
    const card = !esPagoTarjeta(g) && !esPagoPrestamo(g) && (g.medio === 'tarjeta' || g.tarjetaId || g.tarjetaNombre);
    if (esPagoTarjeta(g)) out.push(badge(ICON.payment,'Pago de tarjeta','payment'));
    else if (esPagoPrestamo(g)) out.push(badge(ICON.payment,'Pago de préstamo','payment'));
    else if (card) {
      const full = g.tarjetaNombre || 'Tarjeta';
      const short = full.replace(/^tarjeta\s+/i,'').replace(/^visa\s+/i,'').replace(/^mastercard\s+/i,'').trim() || 'Tarjeta';
      out.push(badge(ICON.card,short,'method-card',full));
    } else if (f.includes('yape')) out.push(badge('<span class="hf-v28-yape-letter">Y</span>','Yape','yape'));
    else if (f.includes('plin')) out.push(badge(ICON.transfer,'Plin','transfer'));
    else if (f.includes('debito') || f.includes('débito')) out.push(badge(ICON.card,'Débito','debit'));
    else if (f.includes('transfer')) out.push(badge(ICON.transfer,'Transferencia','transfer'));
    else out.push(badge(ICON.cash,'Efectivo','cash'));
    if (telegram) out.push(badge(ICON.telegram,'Telegram','telegram'));
    return out.join('');
  }

  function itemHTML(g) {
    const c = categoria(g);
    return `<article class="hf-v28-movement hf-v32-movement hf-v33-movement cat-${c.key}" data-movement-id="${esc(g.id || '')}" tabindex="0" role="button">
      <span class="hf-v28-movement-icon"><span class="hf-v32-category-glyph">${c.icon}</span></span>
      <div class="hf-v28-movement-copy"><strong>${esc(titulo(g))}</strong><span>${esc(c.label)}${g.fecha ? ` · ${esc(fecha(g.fecha))}` : ''}</span></div>
      <div class="hf-v28-movement-amount"><strong>${money(g.monto)}</strong><span>${esc(persona(g))}</span></div>
      <div class="hf-v28-movement-badges">${badges(g)}</div>
      <div class="hf-v28-movement-menu-wrap"><button type="button" class="hf-v28-movement-more" aria-label="Opciones">${ICON.more}</button><div class="hf-v28-movement-menu">
        ${esPagoTarjeta(g)||esPagoPrestamo(g)?'':`<button type="button" data-action="edit">${ICON.edit}<span>Editar</span></button>`}
        <button type="button" class="danger" data-action="delete">${ICON.trash}<span>Eliminar</span></button>
      </div></div></article>`;
  }

  function filtro(lista = state.gastos) {
    const f = state.filtro;
    if (f === 'yo' || f === 'pareja') return lista.filter(g => g.quien === f);
    if (f === 'hoy') {
      const hoy = new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'});
      return lista.filter(g => g.fecha === hoy);
    }
    if (f === 'semana') {
      const hoyISO = new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'});
      const hoy = new Date(`${hoyISO}T12:00:00`); const inicio = new Date(hoy);
      inicio.setDate(hoy.getDate()-((hoy.getDay()+6)%7));
      return lista.filter(g => { const d = new Date(`${g.fecha||''}T12:00:00`); return !Number.isNaN(d.getTime()) && d>=inicio && d<=hoy; });
    }
    return lista;
  }

  function syncCaches() {
    try { gastosDelMesCache = [...state.gastos]; configCache = state.config; filtroGastosActivo = state.filtro; } catch (_) {}
  }
  function render(gastos, cfg = {}) {
    const el = $('expenseList'); if (!el) return;
    state.gastos = [...(Array.isArray(gastos)?gastos:[])].sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))||timestamp(b)-timestamp(a));
    state.config = cfg || {}; syncCaches();
    const list = filtro();
    if (!list.length) { el.innerHTML = '<div class="empty-state">No hay movimientos para este filtro.</div>'; return; }
    el.innerHTML = list.slice(0,5).map(itemHTML).join('') + (list.length>5?'<div class="ver-todo-container hf-v28-view-all"><button type="button" class="btn-ver-todo" data-v33-history>Ver todos los movimientos</button></div>':'');
  }
  async function reload() {
    if (!window.DB?.getGastos) return;
    let mes; try { mes = mesActual; } catch (_) { mes = DB.getMesActual(); }
    const [gastos,cfg] = await Promise.all([DB.getGastos(mes),DB.getConfig().catch(()=>({}))]); render(gastos,cfg||{});
  }
  function renderHistory() {
    const el = $('listaCompletaGastos'); if (!el) return;
    const q = norm(state.query);
    const list = filtro().filter(g=>!q||norm([titulo(g),categoria(g).label,g.tarjetaNombre,g.nota,persona(g),fuente(g)].filter(Boolean).join(' ')).includes(q));
    el.innerHTML = list.map(itemHTML).join('');
    if ($('historial-no-resultados')) $('historial-no-resultados').style.display = list.length?'none':'block';
  }
  async function openHistory() {
    await reload(); state.query='';
    if ($('historialTitle')) $('historialTitle').textContent='Movimientos';
    if ($('historial-search')) $('historial-search').value='';
    if ($('historial-search-clear')) $('historial-search-clear').style.display='none';
    renderHistory(); window.openModal?.('modalHistorial');
  }
  function setFilter(f,button) {
    state.filtro=f||'todos';
    document.querySelectorAll('.expense-filter').forEach(b=>b.classList.toggle('active',b===button));
    syncCaches(); render(state.gastos,state.config);
  }
  function searchHistory(q='') { state.query=q; if ($('historial-search-clear')) $('historial-search-clear').style.display=q?'grid':'none'; renderHistory(); }
  function clearSearch() { if ($('historial-search')) { $('historial-search').value=''; $('historial-search').focus(); } searchHistory(''); }

  function detailRow(icon,label,value) { return value?`<div class="hf-v28-detail-row"><span>${icon}</span><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></div>`:''; }
  function ensureDetail() {
    if ($('hfMovementDetailModal')) return;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" id="hfMovementDetailModal" onclick="closeModalOutside(event,'hfMovementDetailModal')"><div class="modal-sheet hf-v28-detail-sheet" style="position:relative"><button class="modal-close" type="button" onclick="closeModal('hfMovementDetailModal')">✕</button><div class="modal-handle"></div><div class="hf-v28-detail-hero"><span id="hf-v33-detail-icon" class="hf-v28-detail-icon"></span><div><small id="hf-v33-detail-type"></small><h2 id="hf-v33-detail-title"></h2><strong id="hf-v33-detail-amount"></strong></div></div><div id="hf-v33-detail-badges" class="hf-v28-detail-badges"></div><div id="hf-v33-detail-content" class="hf-v28-detail-content"></div></div></div>`);
  }
  function openDetail(id) {
    const g=state.gastos.find(x=>String(x.id)===String(id)); if(!g)return; ensureDetail(); const c=categoria(g);
    $('hf-v33-detail-icon').innerHTML=`<span class="hf-v32-category-glyph">${c.icon}</span>`; $('hf-v33-detail-type').textContent=c.label; $('hf-v33-detail-title').textContent=titulo(g); $('hf-v33-detail-amount').textContent=money(g.monto); $('hf-v33-detail-badges').innerHTML=badges(g);
    const f=fuente(g); let method=g.tarjetaNombre||'Efectivo'; if(f.includes('yape'))method='Yape'; else if(f.includes('plin'))method='Plin'; else if(f.includes('transfer'))method='Transferencia';
    $('hf-v33-detail-content').innerHTML=[detailRow(ICON.category,'Categoría',c.label),detailRow(ICON.calendar,'Fecha',fecha(g.fecha)),detailRow(ICON.person,'Registrado por',persona(g)),detailRow(ICON.cash,'Medio de pago',method),detailRow(ICON.card,'Tarjeta',g.tarjetaNombre),detailRow(ICON.note,'Nota',g.nota),detailRow(ICON.telegram,'Origen',g.fuente==='telegram'?'Telegram':g.fuente)].join(''); window.openModal?.('hfMovementDetailModal');
  }
  function closeMenus(except=null){document.querySelectorAll('.hf-v28-movement-menu.open').forEach(m=>{if(m!==except)m.classList.remove('open');});}
  function handleClick(e){
    if(e.target.closest('[data-v33-history]')){e.preventDefault();openHistory();return;}
    const row=e.target.closest('.hf-v33-movement'); if(!row){closeMenus();return;}
    const more=e.target.closest('.hf-v28-movement-more'); if(more){e.preventDefault();e.stopPropagation();const menu=more.nextElementSibling;const open=!menu.classList.contains('open');closeMenus(menu);menu.classList.toggle('open',open);return;}
    const action=e.target.closest('[data-action]'); if(action){e.preventDefault();e.stopPropagation();closeMenus();syncCaches();if(action.dataset.action==='edit')window.abrirEditarGasto?.(row.dataset.movementId);else window.eliminarGasto?.(row.dataset.movementId);return;}
    openDetail(row.dataset.movementId);
  }
  function install() {
    window.generarGastoHTML=itemHTML; window.renderGastos=render; window.setFiltroGastos=setFilter; window.abrirHistorialCompleto=openHistory; window.filtrarHistorial=searchHistory; window.limpiarBusquedaHistorial=clearSearch;
    if(!state.instalado){state.instalado=true;document.addEventListener('click',handleClick);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});}
    if(state.gastos.length)render(state.gastos,state.config); else reload();
  }
  window.addEventListener('hf:bootstrap-avanzado-completado',()=>{install();reload();});
  ['hf:gastos-actualizados','hf:deuda-actualizada'].forEach(name=>window.addEventListener(name,reload));
  window.HFMovimientosUnificados=Object.freeze({version:VERSION,install,reload,render,openHistory});
  install();
})();

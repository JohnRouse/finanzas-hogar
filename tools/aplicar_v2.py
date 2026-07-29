from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"No se encontró el bloque: {label}")
    return text.replace(old, new, 1)


app_path = Path("js/app.js")
app = app_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    """    const disponible = Math.max(0, limite - deuda);\n    \n    const uso = limite > 0 ? Math.round((deuda / limite) * 100) : 0;\n    const color = uso > 80 ? '#c43030' : uso > 60 ? '#b06a10' : '#2a7de1';""",
    """    const disponible = limite - deuda;\n    const exceso = Math.max(0, deuda - limite);\n    const uso = limite > 0 ? Math.round((deuda / limite) * 100) : 0;\n    const anchoBarra = Math.min(100, Math.max(0, uso));\n    const color = uso >= 100 ? '#c43030' : uso > 80 ? '#c43030' : uso > 60 ? '#b06a10' : '#2a7de1';""",
    "cálculo de disponible",
)

app = replace_once(
    app,
    """        <!-- CAMBIO PRINCIPAL: Mostrar Saldo Disponible -->\n        <div class=\"debt-total\" style=\"color: ${disponible > 0 ? 'var(--text)' : '#c43030'}\">\n          S/ ${disponible.toLocaleString()}\n        </div>\n        <div class=\"debt-sub\">\n          Disponible · Límite: S/ ${limite.toLocaleString()} \n          <span style=\"color:#888\">· Vence día ${t.vence||'—'}</span>\n        </div>\n        \n        <div class=\"debt-prog-bg\">\n          <div class=\"debt-prog-fill\" style=\"width:${uso}%; background:${color};\"></div>\n        </div>\n        <div class=\"debt-hint\">${uso}% utilizado</div>""",
    """        <div class=\"debt-label-main\">Deuda actual</div>\n        <div class=\"debt-total\" style=\"color:${deuda > limite && limite > 0 ? '#c43030' : 'var(--text)'}\">\n          S/ ${deuda.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}\n        </div>\n        <div class=\"debt-sub debt-card-details\">\n          <span>Línea: S/ ${limite.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>\n          <span style=\"color:${disponible < 0 ? '#c43030' : 'var(--text3)'}\">Disponible: ${disponible < 0 ? '− ' : ''}S/ ${Math.abs(disponible).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>\n          <span>Cierre: día ${t.cierre||'—'} · Vence: día ${t.vence||'—'}</span>\n        </div>\n        ${exceso > 0 ? `<div class=\"credit-overflow\">Exceso sobre la línea: S/ ${exceso.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>` : ''}\n        <div class=\"debt-prog-bg\">\n          <div class=\"debt-prog-fill\" style=\"width:${anchoBarra}%; background:${color};\"></div>\n        </div>\n        <div class=\"debt-hint\">${uso}% utilizado</div>\n        <div class=\"debt-card-actions\">\n          <button onclick=\"abrirPagoTarjeta('${t.id}', '${t.nombre.replace(/'/g,\"\\\\'\")}', ${deuda})\">Registrar pago</button>\n          <button onclick=\"abrirAjusteTarjeta('${t.id}', '${t.nombre.replace(/'/g,\"\\\\'\")}', ${deuda})\">Ajustar saldo</button>\n        </div>""",
    "tarjeta visual",
)

start_marker = "  // Solo tarjetas con crédito disponible (límite > deuda)"
end_marker = "  openModal('gastoModal');"
start = app.find(start_marker)
end = app.find(end_marker, start)
if start < 0 or end < 0:
    raise RuntimeError("No se encontró el selector de tarjetas")
selector = """  // Mostrar todas las tarjetas, incluso si superaron su línea de crédito.\n  if (tarjetasCacheGasto.length === 0) {\n    select.innerHTML = '<option value=\"\">— No hay tarjetas registradas —</option>';\n  } else {\n    select.innerHTML = tarjetasCacheGasto.map(t => {\n      const disponible = (parseFloat(t.limite) || 0) - (parseFloat(t.deuda) || 0);\n      const estado = disponible < 0\n        ? `excedida por S/ ${Math.abs(disponible).toLocaleString()}`\n        : `S/ ${disponible.toLocaleString()} disponible`;\n      return `<option value=\"${t.id}\" data-disponible=\"${disponible}\">\n        ${t.nombre} · ${estado}\n      </option>`;\n    }).join('');\n    actualizarInfoTarjeta();\n  }\n\n"""
app = app[:start] + selector + app[end:]

app = replace_once(
    app,
    """  infoEl.textContent = disponible > 0\n    ? `✓ Crédito disponible: S/ ${disponible.toLocaleString()}`\n    : '';""",
    """  infoEl.textContent = disponible >= 0\n    ? `Crédito disponible: S/ ${disponible.toLocaleString()}`\n    : `Tarjeta excedida por S/ ${Math.abs(disponible).toLocaleString()}. El gasto se registrará igualmente.`;\n  infoEl.style.color = disponible < 0 ? '#c43030' : 'var(--text3)';""",
    "información de tarjeta",
)

validation = """    const disponible = (parseFloat(tarjetaSeleccionada.limite) || 0) - (parseFloat(tarjetaSeleccionada.deuda) || 0);\n    if (monto > disponible) {\n      alert(`La tarjeta ${tarjetaSeleccionada.nombre} solo tiene S/ ${disponible.toLocaleString()} disponible.\\nNo puedes registrar S/ ${monto.toLocaleString()}.`);\n      return;\n    }\n"""
if validation in app:
    app = app.replace(validation, "", 1)

app = replace_once(app, "  const cuotaMin = parseFloat(document.getElementById('t-cuota').value) || 0;\n  const vence", "  const cierre = document.getElementById('t-cierre').value || '';\n  const vence", "campo cuota")
app = replace_once(app, "  await DB.addTarjeta({ nombre, deuda, limite, cuotaMin, vence, quien });", "  await DB.addTarjeta({ nombre, deuda, limite, cierre, vence, quien });", "guardar tarjeta")
app = replace_once(app, "  document.getElementById('t-cuota').value = '';", "  document.getElementById('t-cierre').value = '';", "limpiar tarjeta")
app = app.replace("    ...tarjetas.map(t => parseFloat(t.cuotaMin) || 0),\n    ...prestamos.map(p => parseFloat(p.cuota) || 0)", "    ...prestamos.map(p => parseFloat(p.cuota) || 0)")
app = app.replace("const pagoMensual = [...(tarjetas||[]).map(t => parseFloat(t.cuotaMin)||0),\n                         ...(prestamos||[]).map(p => parseFloat(p.cuota)||0)]", "const pagoMensual = [...(prestamos||[]).map(p => parseFloat(p.cuota)||0)]")
app = app.replace("const pagoMinTarjetas = tarjetas.reduce((s,t) => s + Math.min(parseFloat(t.deuda)||0, parseFloat(t.cuotaMin)||0), 0);", "const pagoMinTarjetas = 0; // Las tarjetas no tienen una cuota fija confiable.")
app = app.replace("['Tarjeta', t.nombre, t.deuda, t.limite, t.cuotaMin,", "['Tarjeta', t.nombre, t.deuda, t.limite, '',")

marker = "// Variables globales para el modal de pago\n"
addition = """// Ajuste manual para conciliar la deuda con el saldo real del banco\nlet tarjetaAjusteId = null;\nlet tarjetaAjusteDeudaAnterior = 0;\n\nfunction abrirAjusteTarjeta(id, nombre, deudaActual) {\n  tarjetaAjusteId = id;\n  tarjetaAjusteDeudaAnterior = parseFloat(deudaActual) || 0;\n  document.getElementById('ajuste-tarjeta-info').innerHTML = `<strong>${nombre}</strong><br><small>Saldo registrado: S/ ${tarjetaAjusteDeudaAnterior.toLocaleString(undefined,{minimumFractionDigits:2})}</small>`;\n  document.getElementById('ajuste-tarjeta-saldo').value = tarjetaAjusteDeudaAnterior.toFixed(2);\n  openModal('ajusteTarjetaModal');\n}\n\nasync function guardarAjusteTarjeta() {\n  const saldo = parseFloat(document.getElementById('ajuste-tarjeta-saldo').value);\n  if (!Number.isFinite(saldo) || saldo < 0 || !tarjetaAjusteId) { alert('Ingresa un saldo válido.'); return; }\n  const ok = await DB.updateTarjeta(tarjetaAjusteId, { deuda: saldo, actualizadoEn: new Date().toISOString() });\n  if (!ok) { alert('No se pudo actualizar la tarjeta.'); return; }\n  const diferencia = saldo - tarjetaAjusteDeudaAnterior;\n  closeModal('ajusteTarjetaModal');\n  showToast(`Saldo actualizado (${diferencia >= 0 ? '+' : '−'} S/ ${Math.abs(diferencia).toLocaleString(undefined,{minimumFractionDigits:2})}) ✓`);\n  renderTodo();\n}\n\nfunction openGastoRapidoModal() {\n  document.getElementById('gr-monto').value = '';\n  document.getElementById('gr-quien').value = localStorage.getItem('miUsuarioTipo') || 'yo';\n  openModal('gastoRapidoModal');\n  setTimeout(() => document.getElementById('gr-monto')?.focus(), 100);\n}\n\nasync function agregarGastoRapido() {\n  const monto = parseFloat(document.getElementById('gr-monto').value);\n  const cat = document.getElementById('gr-cat').value;\n  const quien = document.getElementById('gr-quien').value;\n  const medio = document.getElementById('gr-medio').value;\n  if (!monto || monto <= 0) { alert('Ingresa un monto válido.'); return; }\n  await DB.addGasto({ desc: `Gasto rápido · ${cat}`, monto, quien, cat, icono: CATS[cat]?.icon || '📦', medio, fecha: new Date().toISOString().split('T')[0], creadoEn: new Date().toISOString() });\n  closeModal('gastoRapidoModal');\n  showToast('Gasto rápido registrado ✓');\n  renderTodo();\n}\n\n"""
app = replace_once(app, marker, addition + marker, "funciones v2")
app_path.write_text(app, encoding="utf-8")

# DB: permitir ajustes de tarjeta
data_path = Path("js/data.js")
data = data_path.read_text(encoding="utf-8")
needle = """  async deleteTarjeta(id) {\n    if (!hogarId) return;\n    try {\n      await db.collection(\"hogares\").doc(hogarId).collection(\"tarjetas\").doc(id).delete();\n    } catch (e) {\n      console.error(\"Error deleteTarjeta:\", e);\n    }\n  },"""
addition_db = needle + """\n\n  async updateTarjeta(id, cambios) {\n    if (!hogarId || !id) return false;\n    try {\n      await db.collection(\"hogares\").doc(hogarId).collection(\"tarjetas\").doc(id).update(cambios);\n      return true;\n    } catch (e) {\n      console.error(\"Error updateTarjeta:\", e);\n      return false;\n    }\n  },"""
data = replace_once(data, needle, addition_db, "updateTarjeta")
data_path.write_text(data, encoding="utf-8")

# HTML: campos y modales
html_path = Path("index.html")
html = html_path.read_text(encoding="utf-8")
html = replace_once(html, """        <label class=\"input-label\">Cuota mínima (S/)</label>\n        <input type=\"number\" inputmode=\"decimal\" pattern=\"[0-9]*\" class=\"input-field\" id=\"t-cuota\" placeholder=\"0\">""", """        <label class=\"input-label\">Día de cierre</label>\n        <input type=\"number\" class=\"input-field\" id=\"t-cierre\" placeholder=\"25\" min=\"1\" max=\"31\">""", "formulario tarjeta")
html = replace_once(html, '<button class="btn-recurrentes" onclick="abrirGestionRecurrentes()">⚙️ Gastos Fijos</button>', '<div style="display:flex;gap:8px"><button class="btn-recurrentes" onclick="openGastoRapidoModal()">⚡ Gasto rápido</button><button class="btn-recurrentes" onclick="abrirGestionRecurrentes()">⚙️ Gastos Fijos</button></div>', "botón rápido")
modal_marker = "<!-- MODAL: REGISTRAR PAGO DE TARJETA -->"
modals = """<!-- MODAL: AJUSTAR SALDO DE TARJETA -->\n<div class=\"modal-overlay\" id=\"ajusteTarjetaModal\" onclick=\"closeModalOutside(event,'ajusteTarjetaModal')\">\n  <div class=\"modal-sheet\" style=\"position:relative;\">\n    <button class=\"modal-close\" onclick=\"closeModal('ajusteTarjetaModal')\">✕</button>\n    <div class=\"modal-handle\"></div><div class=\"modal-title\">Ajustar saldo de tarjeta</div>\n    <div id=\"ajuste-tarjeta-info\" style=\"margin-bottom:16px;padding:12px;background:var(--surface2);border-radius:10px\"></div>\n    <div class=\"input-row\"><label class=\"input-label\">Saldo actual según el banco (S/)</label><input type=\"number\" step=\"0.01\" inputmode=\"decimal\" class=\"input-field\" id=\"ajuste-tarjeta-saldo\"></div>\n    <small style=\"display:block;color:var(--text3);margin-bottom:16px\">Úsalo para conciliar compras pequeñas que no registraste individualmente.</small>\n    <button class=\"modal-btn\" onclick=\"guardarAjusteTarjeta()\">Actualizar deuda real</button>\n  </div>\n</div>\n\n<!-- MODAL: GASTO RÁPIDO -->\n<div class=\"modal-overlay\" id=\"gastoRapidoModal\" onclick=\"closeModalOutside(event,'gastoRapidoModal')\">\n  <div class=\"modal-sheet\" style=\"position:relative;\">\n    <button class=\"modal-close\" onclick=\"closeModal('gastoRapidoModal')\">✕</button><div class=\"modal-handle\"></div><div class=\"modal-title\">Gasto rápido</div>\n    <div class=\"input-row\"><label class=\"input-label\">Monto (S/)</label><input type=\"number\" step=\"0.01\" inputmode=\"decimal\" class=\"input-field\" id=\"gr-monto\" placeholder=\"0.00\"></div>\n    <div class=\"input-row input-row-two\"><div><label class=\"input-label\">Categoría</label><select class=\"select-field\" id=\"gr-cat\"><option>Alimentación</option><option>Transporte</option><option>Servicios</option><option>Entret.</option><option>Salud</option><option>Hogar</option><option>Otros</option></select></div><div><label class=\"input-label\">¿Quién?</label><select class=\"select-field\" id=\"gr-quien\"><option value=\"yo\">Yo</option><option value=\"pareja\">Pareja</option><option value=\"ambos\">Ambos</option></select></div></div>\n    <div class=\"input-row\"><label class=\"input-label\">Medio</label><select class=\"select-field\" id=\"gr-medio\"><option value=\"efectivo\">Efectivo / transferencia</option><option value=\"tarjeta\">Tarjeta (sin ajustar saldo)</option></select></div>\n    <button class=\"modal-btn\" onclick=\"agregarGastoRapido()\">Guardar gasto rápido</button>\n  </div>\n</div>\n\n"""
html = replace_once(html, modal_marker, modals + modal_marker, "modales v2")
html_path.write_text(html, encoding="utf-8")

css_path = Path("css/styles.css")
css = css_path.read_text(encoding="utf-8")
css += """\n/* Finanzas 2.0 */\n.debt-label-main{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin-top:12px}\n.debt-card-details{display:flex;flex-direction:column;gap:3px;margin-top:4px}\n.credit-overflow{margin-top:9px;padding:7px 9px;border-radius:8px;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:600}\n.debt-card-actions{display:flex;gap:8px;margin-top:12px}\n.debt-card-actions button{flex:1;border:1px solid var(--border);background:var(--surface2);border-radius:8px;padding:8px 6px;font-size:11px;cursor:pointer;color:var(--text)}\n.debt-card-actions button:hover{background:var(--surface3)}\n"""
css_path.write_text(css, encoding="utf-8")

print("Finanzas 2.0 aplicada correctamente")

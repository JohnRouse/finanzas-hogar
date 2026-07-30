#!/usr/bin/env python3
from pathlib import Path
import re, sys, json

repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
app = repo / "js/app.js"
styles = repo / "css/styles.css"
imports_css = repo / "css/importaciones.css"
sw = repo / "firebase-messaging-sw.js"
manifest = repo / "manifest.json"

for p in (app, styles, imports_css):
    if not p.exists():
        raise SystemExit(f"No se encontró {p}")

text = app.read_text(encoding="utf-8")
pat = re.compile(r"function aplicarFiltroGastos\(lista\) \{.*?\n\}", re.S)
new = """function aplicarFiltroGastos(lista) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const finHoy = new Date(hoy);
  finHoy.setHours(23, 59, 59, 999);

  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));

  if (filtroGastosActivo === 'yo' || filtroGastosActivo === 'pareja') {
    return lista.filter(g => g.quien === filtroGastosActivo);
  }

  const hoyISO = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0')
  ].join('-');

  if (filtroGastosActivo === 'hoy') {
    return lista.filter(g => g.fecha === hoyISO);
  }

  if (filtroGastosActivo === 'semana') {
    return lista.filter(g => {
      const d = fechaLocalISO(g.fecha);
      return d && d >= inicioSemana && d <= finHoy;
    });
  }

  return lista;
}"""
if not pat.search(text):
    raise SystemExit("No se encontró aplicarFiltroGastos")
app.write_text(pat.sub(new, text, count=1), encoding="utf-8")

css_marker = "/* ETAPA 11.1.1 — AJUSTES RESPONSIVE Y FILTRO SEMANA */"
css = """
/* ETAPA 11.1.1 — AJUSTES RESPONSIVE Y FILTRO SEMANA */
#page-gastos > .section:first-child .section-head {
  display:grid;
  grid-template-columns:1fr;
  gap:10px;
  align-items:stretch;
  margin-bottom:12px;
}
#page-gastos > .section:first-child .section-head > .section-title {
  width:100%;
  line-height:1.25;
}
#page-gastos > .section:first-child .section-head > div[style*="display:flex"] {
  display:grid !important;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px !important;
  width:100%;
}
#page-gastos > .section:first-child .section-head .btn-recurrentes {
  min-width:0;
  width:100%;
  min-height:42px;
  padding:7px 6px;
  line-height:1.15;
  white-space:normal;
  text-align:center;
  justify-content:center;
}
#page-gastos .expense-filter-bar {
  display:flex;
  gap:8px;
  overflow-x:auto;
  padding:1px 1px 7px;
  margin-bottom:9px;
  scrollbar-width:none;
  -webkit-overflow-scrolling:touch;
}
#page-gastos .expense-filter-bar::-webkit-scrollbar { display:none; }
#page-gastos .expense-filter {
  flex:0 0 auto;
  padding-left:14px;
  padding-right:14px;
  white-space:nowrap;
}
@media (min-width:700px) {
  #page-gastos > .section:first-child .section-head {
    grid-template-columns:minmax(180px,1fr) minmax(330px,auto);
    align-items:center;
  }
  #page-gastos > .section:first-child .section-head > div[style*="display:flex"] {
    width:auto;
  }
}
@media (max-width:390px) {
  #page-gastos > .section:first-child .section-head .btn-recurrentes {
    font-size:11px;
    padding-left:4px;
    padding-right:4px;
  }
}
"""
s = styles.read_text(encoding="utf-8")
if css_marker not in s:
    styles.write_text(s + "\n" + css, encoding="utf-8")

imp_marker = "/* ETAPA 11.1.1 — PULIDO BANDEJA DETECTADOS */"
imp = """
/* ETAPA 11.1.1 — PULIDO BANDEJA DETECTADOS */
.hf-import-toolbar {
  display:grid;
  grid-template-columns:1fr;
  gap:10px;
}
.hf-import-filters {
  width:100%;
  max-width:100%;
  overflow-x:auto;
  flex-wrap:nowrap;
  padding:1px 1px 6px;
  scrollbar-width:none;
  -webkit-overflow-scrolling:touch;
}
.hf-import-filters::-webkit-scrollbar { display:none; }
.hf-import-filters button {
  flex:0 0 auto;
  max-width:none;
  white-space:nowrap;
}
.hf-import-toolbar > .btn-recurrentes {
  width:100%;
  min-height:40px;
  justify-content:center;
  border:1px dashed #9bbcf5;
  background:#f7faff;
  color:#2563eb;
}
.hf-import-sheet {
  padding-bottom:calc(24px + env(safe-area-inset-bottom));
}
@media (min-width:700px) {
  .hf-import-toolbar {
    grid-template-columns:minmax(0,1fr) auto;
    align-items:start;
  }
  .hf-import-toolbar > .btn-recurrentes {
    width:auto;
    min-width:150px;
  }
}
"""
it = imports_css.read_text(encoding="utf-8")
if imp_marker not in it:
    imports_css.write_text(it + "\n" + imp, encoding="utf-8")

if sw.exists():
    st = sw.read_text(encoding="utf-8")
    st = re.sub(r"const CACHE_NAME = ['\"][^'\"]+['\"];", "const CACHE_NAME = 'hogar-finanzas-v3-etapa11-1-1';", st, count=1)
    sw.write_text(st, encoding="utf-8")

if manifest.exists():
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
        data["version"] = "11.1.1"
        manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception:
        pass

print("Etapa 11.1.1 aplicada correctamente.")
print("Filtro Semana corregido y diseño móvil mejorado.")

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "css" / "styles.css"
INDEX = ROOT / "index.html"
APP = ROOT / "js" / "app.js"

MARK_START = "/* === ETAPA 15: EXPERIENCIA FINANCIERA MODERNA === */"
MARK_END = "/* === FIN ETAPA 15 === */"

css_block = r'''
/* === ETAPA 15: EXPERIENCIA FINANCIERA MODERNA === */
:root {
  --bg: #f4f6fa;
  --surface: #ffffff;
  --surface2: #f7f9fc;
  --surface-glass: rgba(255,255,255,.94);
  --border: #e7ebf2;
  --border2: #dfe5ee;
  --text: #162033;
  --text2: #667085;
  --text3: #98a2b3;
  --blue: #315efb;
  --blue-dark: #2347cc;
  --blue-bg: #edf2ff;
  --blue-text: #2448d8;
  --pink-bg: #fff0f5;
  --pink-text: #bd3c6c;
  --green: #168563;
  --green-bg: #eaf8f2;
  --amber: #b66a00;
  --amber-bg: #fff5df;
  --danger: #cf3c4f;
  --danger-bg: #fff0f2;
  --radius: 18px;
  --shadow-sm: 0 1px 2px rgba(16,24,40,.03);
  --shadow-md: 0 8px 24px rgba(16,24,40,.06);
  --container-padding: clamp(16px,4vw,22px);
}

html { background: var(--bg); }
body {
  font-family: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  font-feature-settings: 'tnum' 1, 'lnum' 1;
  letter-spacing: -.01em;
}

/* Encabezado más claro y estable */
.app-header {
  height: 68px;
  padding: env(safe-area-inset-top) var(--container-padding) 0;
  background: var(--surface-glass);
  border-bottom: 1px solid rgba(16,24,40,.06);
  box-shadow: none;
  backdrop-filter: blur(18px) saturate(145%);
  -webkit-backdrop-filter: blur(18px) saturate(145%);
}
.app-logo { font-size: 23px; letter-spacing: -.5px; white-space: nowrap; }
.app-logo span { font-size: 12px; font-weight: 500; margin-left: 2px; color: var(--text2); }
.header-right { gap: 7px; min-width: 0; }
.avatar-row { margin-right: 0; }
.avatar { width: 30px; height: 30px; font-size: 9px; box-shadow: none; }
.month-btn {
  min-height: 38px;
  max-width: 132px;
  padding: 8px 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--surface2);
  border: 1px solid var(--border);
  color: var(--text);
  box-shadow: none;
}
.settings-btn { width: 40px; height: 40px; font-size: 18px; color: var(--text2); }

.main { max-width: 720px; padding: 18px var(--container-padding) 110px; }
.page { padding-bottom: 28px !important; }
.section { margin-bottom: 24px; }
.section-title {
  color: #7a8496;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
}

/* Barra inferior: una sola familia visual */
.tabs {
  position: fixed;
  z-index: 250;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  height: calc(68px + env(safe-area-inset-bottom));
  padding: 7px 12px env(safe-area-inset-bottom);
  border-radius: 0;
  border-top: 1px solid rgba(16,24,40,.08);
  background: rgba(255,255,255,.96);
  box-shadow: 0 -8px 26px rgba(16,24,40,.06);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  gap: 2px;
}
.tab {
  position: relative;
  min-height: 52px;
  padding: 27px 4px 5px;
  border-radius: 12px;
  color: #8a94a6;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}
.tab::before {
  position: absolute;
  left: 50%;
  top: 6px;
  transform: translateX(-50%);
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  font-size: 20px;
  line-height: 1;
  filter: grayscale(1);
  opacity: .72;
}
.tab:nth-child(1)::before { content: '⌂'; font-family: system-ui, sans-serif; font-weight: 700; }
.tab:nth-child(2)::before { content: '≡'; font-family: system-ui, sans-serif; font-weight: 700; }
.tab:nth-child(3)::before { content: '▣'; font-family: system-ui, sans-serif; }
.tab:nth-child(4)::before { content: '◇'; font-family: system-ui, sans-serif; font-weight: 700; }
.tab.active {
  background: transparent;
  color: var(--blue);
  box-shadow: none;
}
.tab.active::before { filter: none; opacity: 1; }
.tab.active::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 50%;
  width: 34px;
  height: 3px;
  border-radius: 999px;
  background: var(--blue);
  transform: translateX(-50%);
}

/* Resumen: un dato protagonista y dos secundarios compactos */
.month-money-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-bottom: 24px; }
.month-money-card {
  min-height: 108px;
  padding: 15px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
.month-money-card.primary {
  grid-column: 1 / -1;
  min-height: 138px;
  padding: 21px;
  color: #fff;
  border: 0;
  background: linear-gradient(135deg,#234fe6 0%,#3d70ff 100%);
  box-shadow: 0 14px 30px rgba(49,94,251,.22);
}
.month-money-label { color: var(--text2); font-size: 12px; font-weight: 600; }
.month-money-value { margin-top: 8px; color: var(--text); font-size: clamp(22px,7vw,31px); font-weight: 700; letter-spacing: -.04em; }
.month-money-help { margin-top: 7px; color: var(--text3); font-size: 11px; line-height: 1.35; }
.month-money-card.primary .month-money-label,
.month-money-card.primary .month-money-help { color: rgba(255,255,255,.78); }
.month-money-card.primary .month-money-value { color: #fff; font-size: clamp(34px,10vw,44px); }

/* Superficies: menos cajas dentro de cajas */
.card {
  padding: 17px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
.category-bars, .household-participation { box-shadow: var(--shadow-sm); }
.category-bar-track, .progress-bg, .debt-prog-bg { background: #edf0f5 !important; }
.category-bar-fill, .progress-fill { border-radius: 999px; }
.income-toolbar { gap: 10px; }

/* Movimientos: apariencia de lista móvil, no tarjetas independientes */
.expense-card-shell { padding: 4px 8px; overflow: hidden; }
.expense-item { margin: 0; padding: 0; border-bottom: 1px solid var(--border); }
.expense-item:last-child { border-bottom: 0; }
.expense-item-inner {
  min-height: 68px;
  padding: 11px 7px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
.expense-filter-bar { scrollbar-width: none; padding-bottom: 3px; }
.expense-filter-bar::-webkit-scrollbar { display: none; }
.expense-filter {
  min-height: 38px;
  padding: 8px 14px;
  border-color: var(--border);
  background: var(--surface);
  color: var(--text2);
}
.expense-filter.active { background: var(--blue-bg); border-color: #bfd0ff; color: var(--blue-dark); }

/* Deudas y préstamos: tarjetas compactas y menú de tres puntos visible */
.debt-grid { gap: 12px; }
.debt-card {
  position: relative;
  padding: 17px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  background: var(--surface);
  overflow: visible;
}
.debt-card:hover { box-shadow: var(--shadow-md); }
.debt-card::before { height: 3px !important; border-radius: var(--radius) var(--radius) 0 0; opacity: .75; }
.debt-name { max-width: calc(100% - 48px); font-size: 16px; font-weight: 700; color: var(--text); }
.debt-total { margin-top: 8px; font-size: 27px; font-weight: 700; letter-spacing: -.04em; }
.debt-sub { color: var(--text2); font-size: 12px; }
.debt-more-wrap { position: absolute; top: 10px; right: 10px; z-index: 12; }
.debt-more-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text2);
  font-size: 25px;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.debt-more-btn:hover, .debt-more-btn:focus-visible { background: var(--surface2); color: var(--text); outline: none; }
.debt-more-menu {
  display: none;
  position: absolute;
  top: 42px;
  right: 0;
  min-width: 154px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 14px 36px rgba(16,24,40,.16);
  overflow: hidden;
  z-index: 50;
}
.debt-more-menu.open { display: block; animation: debtMenuIn .16s ease-out; }
.debt-more-menu button {
  width: 100%;
  min-height: 40px;
  padding: 9px 11px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text);
  text-align: left;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}
.debt-more-menu button:hover { background: var(--surface2); }
.debt-more-menu button.danger { color: var(--danger); }
.debt-more-menu button.danger:hover { background: var(--danger-bg); }
@keyframes debtMenuIn { from { opacity:0; transform:translateY(-5px) scale(.97); } to { opacity:1; transform:none; } }
.debt-card-actions { margin-top: 15px; gap: 8px; }
.debt-card-actions button { min-height: 40px; border-radius: 11px; font-weight: 650; }
.debt-action-primary { background: var(--blue) !important; color: #fff !important; }
.debt-action-primary:hover { background: var(--blue-dark) !important; }
.debt-details-toggle, .debt-action-secondary, .debt-action-statement, .debt-action-history {
  border-color: var(--border2) !important;
  background: var(--surface2) !important;
  color: var(--text2) !important;
}
.kpi-grid { gap: 10px; margin-bottom: 22px; }
.kpi { min-height: 105px; padding: 15px; border: 1px solid var(--border); border-top-width: 1px !important; box-shadow: var(--shadow-sm); background: var(--surface) !important; }
.kpi-val { font-size: 23px; }

/* Formularios y modales */
.modal-sheet { border-radius: 24px 24px 0 0; background: var(--surface); box-shadow: 0 -18px 60px rgba(16,24,40,.18); }
input, select, textarea { border-color: var(--border2) !important; background: var(--surface2) !important; color: var(--text) !important; }
input:focus, select:focus, textarea:focus { border-color: #9db3ff !important; box-shadow: 0 0 0 4px rgba(49,94,251,.10) !important; outline: none; }

@media (max-width: 390px) {
  .app-logo { font-size: 21px; }
  .app-logo span { font-size: 11px; }
  .avatar-row { display: none; }
  .month-btn { max-width: 123px; padding-inline: 10px; }
  .main { padding-inline: 14px; }
  .month-money-card { padding: 13px; }
  .month-money-help { font-size: 10.5px; }
}

@media (prefers-reduced-motion: reduce) {
  *,*::before,*::after { scroll-behavior:auto !important; animation-duration:.01ms !important; transition-duration:.01ms !important; }
}
/* === FIN ETAPA 15 === */
'''


def replace_marked(text: str, block: str) -> str:
    pattern = re.compile(re.escape(MARK_START) + r".*?" + re.escape(MARK_END), re.S)
    if pattern.search(text):
        return pattern.sub(block.strip(), text)
    return text.rstrip() + "\n\n" + block.strip() + "\n"


css = CSS.read_text(encoding="utf-8")
css = css.replace("transition: transform 0.2s;/", "transition: transform 0.2s;")
css = replace_marked(css, css_block)
CSS.write_text(css, encoding="utf-8")

index = INDEX.read_text(encoding="utf-8")
index = re.sub(r'href="css/styles\.css(?:\?v=[^"]+)?"', 'href="css/styles.css?v=15.0"', index, count=1)
index = index.replace('>Gastos</button>', '>Movimientos</button>')
index = index.replace('>Ahorro</button>', '>Plan</button>')
INDEX.write_text(index, encoding="utf-8")

# La rama etapa 14 ya contiene los menús de tres puntos. Verificamos que no se pierdan.
app = APP.read_text(encoding="utf-8")
required = [
    'class="debt-more-btn"',
    'function toggleDebtMenu',
    'abrirEditarTarjeta',
    'eliminarTarjeta',
    'abrirEditarPrestamo',
    'eliminarPrestamo',
]
missing = [token for token in required if token not in app]
if missing:
    raise SystemExit("Faltan funciones requeridas para editar/eliminar deudas: " + ", ".join(missing))

print("Etapa 15 aplicada: sistema visual, resumen, navegación, movimientos y menús de deudas.")

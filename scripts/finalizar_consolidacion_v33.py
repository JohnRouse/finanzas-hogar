from __future__ import annotations

import re
import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "js/app.js"
DEBT_FAMILY = ROOT / "js/deudas-familiares.js"
DEBT_REDESIGN = ROOT / "js/deudas-redesign-v23.js"
VISUAL = ROOT / "js/experiencia-financiera-v2.js"
DEBT_FIXES = ROOT / "js/deudas-fixes-v25.js"
CARD_CONSISTENCY = ROOT / "js/tarjetas-consistencia-v26.js"
INDEX = ROOT / "index.html"
SERVICE_WORKER = ROOT / "firebase-messaging-sw.js"

VERSION = "33.0"
CACHE_NAME = "hogar-finanzas-v33-render-unico"


def replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f"No se pudo actualizar {label}; coincidencias: {count}")
    return updated


def run_structural_consolidation_if_needed() -> None:
    app_text = APP.read_text(encoding="utf-8")
    debt_text = DEBT_REDESIGN.read_text(encoding="utf-8")
    app_ready = "MOVIMIENTOS: COMPONENTE ÚNICO V33" in app_text
    debt_ready = "renderDebtPage(cardsInput = null, loansInput = null)" in debt_text
    if app_ready and debt_ready:
        return
    runpy.run_path(str(ROOT / "scripts/consolidar_renderizadores_v33.py"), run_name="__main__")


def patch_visual_controller() -> None:
    text = VISUAL.read_text(encoding="utf-8")

    stable_repair = '''  function repair() {
    try { hideRemovedBlocks(); } catch (error) { console.warn(error); }
    try { enhanceHeader(); } catch (error) { console.warn(error); }
    try { enhanceNavigation(); } catch (error) { console.warn(error); }
    try { arrangeSummary(); } catch (error) { console.warn(error); }
    try { setChartDefaults(); } catch (error) { console.warn(error); }
    document.body?.classList.add('hf-uiux-pro-max');
  }

  function scheduleRepair() {
    clearTimeout(state.timer);
    state.timer = setTimeout(repair, 70);
  }

  function start() {
    repair();

    document.addEventListener('click', event => {
      if (event.target.closest('.hf-card-menu-wrap, .debt-more-wrap')) return;
      closeAllMenus();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeAllMenus();
    });

    [
      'hf:gastos-actualizados',
      'hf:deuda-actualizada',
      'hf:deudas-core-actualizadas',
      'hf:estado-cuenta-confirmado',
      'hf:deudas-recalculadas'
    ].forEach(name => window.addEventListener(name, scheduleRepair));
  }

'''

    if "startSelfHealing" in text or "installObserver" in text:
        text = replace_once(
            text,
            r"  function repair\(\) \{.*?\n  function start\(\) \{.*?\n  \}\n\n  window\.HFVisualUIUX22",
            stable_repair + "  window.HFVisualUIUX22",
            "el controlador visual V22",
        )
    VISUAL.write_text(text, encoding="utf-8")


def patch_event_driven_helper(path: Path, global_name: str) -> None:
    text = path.read_text(encoding="utf-8")
    if "new MutationObserver" not in text:
        return

    events = """[
      'hf:deuda-actualizada',
      'hf:deudas-core-actualizadas',
      'hf:estado-cuenta-confirmado',
      'hf:deudas-recalculadas'
    ].forEach(eventName => window.addEventListener(eventName, scheduleRepair));"""

    replacement = f'''  function scheduleRepair() {{
    clearTimeout({"timer" if global_name == "HFDeudasFixes25" else "state.timer"});
    {"timer" if global_name == "HFDeudasFixes25" else "state.timer"} = setTimeout(repair, 60);
  }}

  function start() {{
    repair();
    {events}
  }}

  window.{global_name}'''

    text = replace_once(
        text,
        rf"  function scheduleRepair\(\) \{{.*?\n  window\.{re.escape(global_name)}",
        replacement,
        f"el observador de {path.name}",
    )
    path.write_text(text, encoding="utf-8")


def patch_versions() -> None:
    text = INDEX.read_text(encoding="utf-8")
    versions = {
        "js/app.js": VERSION,
        "js/deudas-familiares.js": VERSION,
        "js/experiencia-financiera-v2.js": VERSION,
        "js/deudas-redesign-v23.js": VERSION,
        "js/deudas-fixes-v25.js": VERSION,
        "js/tarjetas-consistencia-v26.js": VERSION,
        "js/experiencia-unificada-v32.js": VERSION,
    }
    for path, version in versions.items():
        text = re.sub(
            rf'<script src="{re.escape(path)}\?v=[^"]+"></script>',
            f'<script src="{path}?v={version}"></script>',
            text,
        )
    text = re.sub(
        r'\s*<script src="js/movimientos-unificados-v33\.js\?v=[^"]+"></script>',
        '',
        text,
    )
    INDEX.write_text(text, encoding="utf-8")

    if SERVICE_WORKER.exists():
        sw = SERVICE_WORKER.read_text(encoding="utf-8")
        sw = re.sub(r"const CACHE_NAME = '[^']+';", f"const CACHE_NAME = '{CACHE_NAME}';", sw, count=1)
        for path, version in versions.items():
            sw = re.sub(
                rf"'\./{re.escape(path)}\?v=[^']+'",
                f"'./{path}?v={version}'",
                sw,
            )
        sw = re.sub(r"\s*'\./js/movimientos-unificados-v33\.js\?v=[^']+',", '', sw)
        SERVICE_WORKER.write_text(sw, encoding="utf-8")


def main() -> None:
    run_structural_consolidation_if_needed()
    patch_visual_controller()
    patch_event_driven_helper(DEBT_FIXES, "HFDeudasFixes25")
    patch_event_driven_helper(CARD_CONSISTENCY, "HFTarjetasConsistencia26")
    patch_versions()
    print("✓ Movimientos e historial usan el render principal definitivo")
    print("✓ Deudas usa el componente aprobado antes del primer pintado")
    print("✓ Observadores y ciclos visuales repetitivos retirados")
    print(f"✓ Recursos publicados como V{VERSION}")


if __name__ == "__main__":
    main()

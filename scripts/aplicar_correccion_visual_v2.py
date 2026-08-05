from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SERVICE_WORKER = ROOT / "firebase-messaging-sw.js"

BASE_VERSION = "22.0"
DEBT_VERSION = "24.0"
FIX_VERSION = "25.0"
CARD_DATA_VERSION = "26.0"
UNIFIED_VERSION = "32.1"

# Las hojas históricas se conservan temporalmente porque contienen la apariencia
# aprobada. La lógica de interfaz, en cambio, queda concentrada en un solo archivo.
RESOURCES = [
    ("css", "css/experiencia-financiera-v2.css", BASE_VERSION),
    ("css", "css/deudas-redesign-v23.css", DEBT_VERSION),
    ("css", "css/deudas-fixes-v25.css", FIX_VERSION),
    ("css", "css/tarjetas-consistencia-v26.css", CARD_DATA_VERSION),
    ("css", "css/experiencia-integrada-v27.css", "27.0"),
    ("css", "css/experiencia-integrada-v28.css", "28.0"),
    ("css", "css/experiencia-integrada-v29.css", "29.3"),
    ("css", "css/experiencia-integrada-v30.css", "31.2"),
    ("css", "css/experiencia-unificada-v32.css", UNIFIED_VERSION),
    ("js", "js/experiencia-financiera-v2.js", BASE_VERSION),
    ("js", "js/deudas-redesign-v23.js", DEBT_VERSION),
    ("js", "js/deudas-fixes-v25.js", FIX_VERSION),
    ("js", "js/tarjetas-consistencia-v26.js", CARD_DATA_VERSION),
    ("js", "js/experiencia-unificada-v32.js", "32.0"),
]

OBSOLETE_UI_SCRIPTS = [
    "js/experiencia-integrada-v27.js",
    "js/experiencia-integrada-v28.js",
    "js/experiencia-integrada-v28-estabilidad.js",
    "js/experiencia-integrada-v29.js",
    "js/experiencia-integrada-v30.js",
    "js/estabilidad-post-render-v31.js",
]

FONT_TAG = (
    '<link href="https://fonts.googleapis.com/css2?'
    'family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">'
)

MANIFEST_BLOCK = """  <!-- HF_MANIFEST_START -->
  <script>
    (() => {
      const isCloudWorkstation = location.hostname.endsWith('.cloudworkstations.dev');
      if (!isCloudWorkstation) {
        const manifest = document.createElement('link');
        manifest.rel = 'manifest';
        manifest.href = './manifest.json';
        document.head.appendChild(manifest);
      }
    })();
  </script>
  <link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png">
  <!-- HF_MANIFEST_END -->"""


def resource_tag(kind: str, path: str, version: str) -> str:
    if kind == "css":
        return f'  <link rel="stylesheet" href="{path}?v={version}">'
    return f'  <script src="{path}?v={version}"></script>'


def upsert_html_resource(text: str, kind: str, path: str, version: str) -> str:
    tag = resource_tag(kind, path, version)
    if kind == "css":
        pattern = rf'\s*<link rel="stylesheet" href="{re.escape(path)}\?v=[^"]+">'
        if re.search(pattern, text):
            return re.sub(pattern, f"\n{tag}", text, count=1)
        return text.replace("</head>", f"{tag}\n</head>", 1)

    pattern = rf'\s*<script src="{re.escape(path)}\?v=[^"]+"></script>'
    if re.search(pattern, text):
        return re.sub(pattern, f"\n{tag}", text, count=1)
    return text.replace("</body>", f"{tag}\n</body>", 1)


def remove_obsolete_html_scripts(text: str) -> str:
    for path in OBSOLETE_UI_SCRIPTS:
        text = re.sub(
            rf'\s*<script src="{re.escape(path)}\?v=[^"]+"></script>',
            '',
            text,
        )
    return text


def patch_manifest_and_favicon(text: str) -> str:
    marker_pattern = r'\s*<!-- HF_MANIFEST_START -->.*?<!-- HF_MANIFEST_END -->'
    if re.search(marker_pattern, text, flags=re.DOTALL):
        return re.sub(marker_pattern, f"\n{MANIFEST_BLOCK}", text, count=1, flags=re.DOTALL)

    static_manifest = r'\s*<link\s+rel=["\']manifest["\']\s+href=["\'][^"\']+["\']\s*/?>'
    if re.search(static_manifest, text, flags=re.IGNORECASE):
        return re.sub(static_manifest, f"\n{MANIFEST_BLOCK}", text, count=1, flags=re.IGNORECASE)

    return text.replace("</head>", f"{MANIFEST_BLOCK}\n</head>", 1)


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")
    text = remove_obsolete_html_scripts(text)

    text = re.sub(
        r'<link href="https://fonts\.googleapis\.com/css2\?[^\"]+" rel="stylesheet">',
        FONT_TAG,
        text,
        count=1,
    )
    text = re.sub(
        r'<meta name="theme-color" content="#[0-9A-Fa-f]{6}">',
        '<meta name="theme-color" content="#1E40AF">',
        text,
        count=1,
    )
    text = patch_manifest_and_favicon(text)

    # El HTML base ya nace con la opción final; no espera a que JavaScript retire
    # controles antiguos después de mostrarlos.
    text = re.sub(
        r'<div style="display:flex;gap:8px"><button class="btn-recurrentes" onclick="openGastoRapidoModal\(\)">.*?</button><button class="btn-recurrentes" onclick="abrirGestionRecurrentes\(\)">',
        '<div style="display:flex;gap:8px"><button class="btn-recurrentes" onclick="abrirGestionRecurrentes()">',
        text,
        count=1,
        flags=re.DOTALL,
    )
    text = re.sub(
        r'(<h2 id="historialTitle">).*?(</h2>)',
        r'\1Movimientos\2',
        text,
        count=1,
    )

    for kind, path, version in RESOURCES:
        text = upsert_html_resource(text, kind, path, version)

    text = text.replace(
        '<button class="tab" onclick="showPage(\'gastos\',1)">Gastos</button>',
        '<button class="tab" onclick="showPage(\'gastos\',1)">Movimientos</button>',
        1,
    )
    text = text.replace(
        '<button class="tab" onclick="showPage(\'ahorro\',3)">Ahorro</button>',
        '<button class="tab" onclick="showPage(\'ahorro\',3)">Plan</button>',
        1,
    )

    INDEX.write_text(text, encoding="utf-8")


def remove_obsolete_sw_assets(text: str) -> str:
    for path in OBSOLETE_UI_SCRIPTS:
        text = re.sub(rf"\s*'\./{re.escape(path)}\?v=[^']+',", '', text)
    return text


def patch_service_worker() -> None:
    if not SERVICE_WORKER.exists():
        return

    text = SERVICE_WORKER.read_text(encoding="utf-8")
    text = remove_obsolete_sw_assets(text)
    text = re.sub(
        r"const CACHE_NAME = '[^']+';",
        "const CACHE_NAME = 'hogar-finanzas-v32-1-sin-renders-heredados';",
        text,
        count=1,
    )
    text = re.sub(r"\s*'\./manifest\.json',", "", text, count=1)

    assets: list[str] = []
    for _, path, version in RESOURCES:
        text = re.sub(
            rf"'\./{re.escape(path)}\?v=[^']+'",
            f"'./{path}?v={version}'",
            text,
        )
        assets.append(f"  './{path}?v={version}',")

    missing = [asset for asset in assets if asset not in text]
    if missing:
        marker = "  './css/experiencia-financiera-14.css?v=20.0',"
        fallback = "  './css/styles.css?v=10.0',"
        target = marker if marker in text else fallback
        if target not in text:
            raise RuntimeError("No se encontró dónde añadir los recursos visuales en el service worker")
        text = text.replace(target, target + "\n" + "\n".join(missing), 1)

    SERVICE_WORKER.write_text(text, encoding="utf-8")


def main() -> None:
    patch_index()
    patch_service_worker()
    print("✓ Apariencia aprobada conservada")
    print("✓ Un solo controlador de Movimientos, historial, avatar y formularios")
    print(f"✓ Experiencia unificada {UNIFIED_VERSION}")
    print("✓ Renders heredados ocultos antes de llegar a pantalla")
    print("✓ Scripts visuales históricos retirados de la carga")
    print("✓ Caché PWA renovada")


if __name__ == "__main__":
    main()

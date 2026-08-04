from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SERVICE_WORKER = ROOT / "firebase-messaging-sw.js"

BASE_VERSION = "22.0"
DEBT_VERSION = "24.0"
RESOURCES = [
    ("css", "css/experiencia-financiera-v2.css", BASE_VERSION),
    ("css", "css/deudas-redesign-v23.css", DEBT_VERSION),
    ("js", "js/experiencia-financiera-v2.js", BASE_VERSION),
    ("js", "js/deudas-redesign-v23.js", DEBT_VERSION),
]

FONT_TAG = (
    '<link href="https://fonts.googleapis.com/css2?'
    'family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">'
)


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


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")

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


def patch_service_worker() -> None:
    if not SERVICE_WORKER.exists():
        return

    text = SERVICE_WORKER.read_text(encoding="utf-8")
    text = re.sub(
        r"const CACHE_NAME = '[^']+';",
        "const CACHE_NAME = 'hogar-finanzas-v24-deudas-detalles-tea';",
        text,
        count=1,
    )

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
    print("✓ Sistema visual UIUX Pro Max aplicado")
    print(f"✓ Rediseño de Deudas actualizado a {DEBT_VERSION}")
    print("✓ Caché PWA renovada")


if __name__ == "__main__":
    main()

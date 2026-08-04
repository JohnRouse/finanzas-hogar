from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SERVICE_WORKER = ROOT / "firebase-messaging-sw.js"
VERSION = "22.0"
CSS_PATH = "css/experiencia-financiera-v2.css"
JS_PATH = "js/experiencia-financiera-v2.js"
CSS_TAG = f'  <link rel="stylesheet" href="{CSS_PATH}?v={VERSION}">'
JS_TAG = f'  <script src="{JS_PATH}?v={VERSION}"></script>'
FONT_TAG = (
    '<link href="https://fonts.googleapis.com/css2?'
    'family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">'
)


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

    css_pattern = rf'\s*<link rel="stylesheet" href="{re.escape(CSS_PATH)}\?v=[^"]+">'
    if re.search(css_pattern, text):
        text = re.sub(css_pattern, f"\n{CSS_TAG}", text, count=1)
    else:
        text = text.replace("</head>", f"{CSS_TAG}\n</head>", 1)

    js_pattern = rf'\s*<script src="{re.escape(JS_PATH)}\?v=[^"]+"></script>'
    if re.search(js_pattern, text):
        text = re.sub(js_pattern, f"\n{JS_TAG}", text, count=1)
    else:
        text = text.replace("</body>", f"{JS_TAG}\n</body>", 1)

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
        "const CACHE_NAME = 'hogar-finanzas-v22-uiux-pro-max';",
        text,
        count=1,
    )

    text = re.sub(
        rf"'\./{re.escape(CSS_PATH)}\?v=[^']+'",
        f"'./{CSS_PATH}?v={VERSION}'",
        text,
    )
    text = re.sub(
        rf"'\./{re.escape(JS_PATH)}\?v=[^']+'",
        f"'./{JS_PATH}?v={VERSION}'",
        text,
    )

    assets = [
        f"  './{CSS_PATH}?v={VERSION}',",
        f"  './{JS_PATH}?v={VERSION}',",
    ]
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
    print(f"✓ Recursos actualizados a {VERSION}")
    print("✓ Caché PWA renovada")


if __name__ == "__main__":
    main()

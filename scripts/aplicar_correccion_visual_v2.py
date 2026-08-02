from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SERVICE_WORKER = ROOT / "firebase-messaging-sw.js"

CSS_TAG = '  <link rel="stylesheet" href="css/experiencia-financiera-v2.css?v=21.0">'
JS_TAG = '  <script src="js/experiencia-financiera-v2.js?v=21.0"></script>'


def replace_once(text: str, old: str, new: str, description: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise RuntimeError(f"No se encontró el marcador para {description}")
    return text.replace(old, new, 1)


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")

    old_font = (
        '<link href="https://fonts.googleapis.com/css2?'
        'family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600'
        '&family=DM+Serif+Display&display=swap" rel="stylesheet">'
    )
    new_font = (
        '<link href="https://fonts.googleapis.com/css2?'
        'family=DM+Serif+Display&family=Inter:wght@400;500;600;700;800&display=swap" '
        'rel="stylesheet">'
    )
    text = replace_once(text, old_font, new_font, "actualizar la tipografía")

    text = text.replace('<meta name="theme-color" content="#2563eb">',
                        '<meta name="theme-color" content="#2457a7">', 1)

    if CSS_TAG not in text:
        text = replace_once(text, "</head>", f"{CSS_TAG}\n</head>", "insertar el CSS V2")

    if JS_TAG not in text:
        text = replace_once(text, "</body>", f"{JS_TAG}\n</body>", "insertar el JavaScript V2")

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

    import re
    text = re.sub(
        r"const CACHE_NAME = '[^']+';",
        "const CACHE_NAME = 'hogar-finanzas-v21-correccion-visual-v2';",
        text,
        count=1,
    )

    assets = [
        "  './css/experiencia-financiera-v2.css?v=21.0',",
        "  './js/experiencia-financiera-v2.js?v=21.0',",
    ]

    missing = [asset for asset in assets if asset not in text]
    if missing:
        marker = "  './css/experiencia-financiera-14.css?v=20.0',"
        fallback = "  './css/styles.css?v=10.0',"
        target = marker if marker in text else fallback
        if target not in text:
            raise RuntimeError("No se encontró dónde añadir los recursos V2 en el service worker")
        text = text.replace(target, target + "\n" + "\n".join(missing), 1)

    SERVICE_WORKER.write_text(text, encoding="utf-8")


def main() -> None:
    patch_index()
    patch_service_worker()
    print("✓ Corrección visual V2 aplicada")
    print("✓ index.html actualizado")
    print("✓ caché PWA actualizada")


if __name__ == "__main__":
    main()

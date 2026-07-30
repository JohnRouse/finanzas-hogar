#!/usr/bin/env python3
from pathlib import Path
import re, sys

root = Path(__file__).resolve().parent
repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
index = repo / "index.html"
if not index.exists():
    raise SystemExit("No se encontró index.html. Ejecuta: python3 APLICAR_ETAPA11_1.py ~/finanzas-hogar")

# Copiar recursos
for rel in ["js/importaciones.js", "css/importaciones.css", "CAMBIOS_V3_ETAPA11_1.md"]:
    src = root / rel
    dst = repo / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(src.read_bytes())

text = index.read_text(encoding="utf-8")
if "css/importaciones.css" not in text:
    text = text.replace("</head>", '  <link rel="stylesheet" href="css/importaciones.css?v=11.1">\n</head>')
if "js/importaciones.js" not in text:
    text = text.replace("</body>", '  <script src="js/importaciones.js?v=11.1"></script>\n</body>')
index.write_text(text, encoding="utf-8")

# Agregar recursos al service worker si existe
sw = repo / "firebase-messaging-sw.js"
if sw.exists():
    s = sw.read_text(encoding="utf-8")
    s = re.sub(r"const CACHE_NAME = '[^']+';", "const CACHE_NAME = 'hogar-finanzas-v3-etapa11-1';", s)
    if "js/importaciones.js?v=11.1" not in s:
        s = s.replace("'./manifest.json'", "'./js/importaciones.js?v=11.1', './css/importaciones.css?v=11.1', './manifest.json'")
    sw.write_text(s, encoding="utf-8")

print("Etapa 11.1 aplicada en:", repo)
print("Archivos añadidos: js/importaciones.js, css/importaciones.css")
print("index.html actualizado.")

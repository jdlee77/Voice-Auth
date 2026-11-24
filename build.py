#!/usr/bin/env python3
"""Assemble src/ into self-contained pages:
   voice-auth.html / index.html : custodian tool (index.html is the GitHub Pages copy)
   card/                        : phone card page (installable: manifest, icons, service worker)
   print/                       : far-end printing page (one self-contained file, not installable)
"""
from pathlib import Path
root = Path(__file__).parent
src = lambda p: (root / 'src' / p).read_text()

tool = (src('template.html').replace('/*CARDSHEETCSS*/', src('cardsheet.css')).replace('/*QRLIB*/', src('vendor/qrcode-generator.js'))
        .replace('/*CORE*/', src('core.js')).replace('/*ENROLLMENTCODE*/', src('enrollmentcode.js'))
        .replace('/*CARDSHEET*/', src('cardsheet.js')).replace('/*ENROLL*/', src('enroll.js')).replace('/*APP*/', src('app.js')))
for name in ('voice-auth.html', 'index.html'):
    (root / name).write_text(tool)

card = (src('card.html').replace('/*JSQR*/', src('vendor/jsQR.js'))
        .replace('/*CORE*/', src('core.js')).replace('/*ENROLLMENTCODE*/', src('enrollmentcode.js')).replace('/*QRSCAN*/', src('qrscan.js'))
        .replace('/*DEVICEKEY*/', src('devicekey.js')).replace('/*CARDAPP*/', src('card.js')))
(root / 'card').mkdir(exist_ok=True)
(root / 'card/index.html').write_text(card)

printpage = (src('print.html').replace('/*CARDSHEETCSS*/', src('cardsheet.css')).replace('/*JSQR*/', src('vendor/jsQR.js'))
             .replace('/*CORE*/', src('core.js')).replace('/*ENROLLMENTCODE*/', src('enrollmentcode.js')).replace('/*QRSCAN*/', src('qrscan.js'))
             .replace('/*CARDSHEET*/', src('cardsheet.js')).replace('/*PRINTAPP*/', src('print.js')))
(root / 'print').mkdir(exist_ok=True)
(root / 'print/index.html').write_text(printpage)

# Installable web app files for card/: manifest, icons, and a service worker stamped with the page version
import hashlib, shutil
version = hashlib.sha256(card.encode()).hexdigest()[:12]
(root / 'card/sw.js').write_text(src('pwa/sw.js').replace('__VERSION__', version))
for f in ('manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'):
    shutil.copyfile(root / 'src/pwa' / f, root / 'card' / f)
print(f'tool {len(tool)} bytes, card {len(card)} bytes, print {len(printpage)} bytes, card version {version}')

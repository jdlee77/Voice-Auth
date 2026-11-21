#!/usr/bin/env python3
"""Assemble src/ into self-contained pages:
   voice-auth.html / index.html : custodian tool (index.html is the GitHub Pages copy)
   card/index.html              : phone card page
"""
from pathlib import Path
root = Path(__file__).parent
src = lambda p: (root / 'src' / p).read_text()

tool = (src('template.html').replace('/*QRLIB*/', src('vendor/qrcode-generator.js'))
        .replace('/*CORE*/', src('core.js')).replace('/*VAULT*/', src('vault.js')).replace('/*APP*/', src('app.js')))
for name in ('voice-auth.html', 'index.html'):
    (root / name).write_text(tool)

card = (src('card.html').replace('/*JSQR*/', src('vendor/jsQR.js'))
        .replace('/*CORE*/', src('core.js')).replace('/*VAULT*/', src('vault.js')).replace('/*CARDAPP*/', src('card.js')))
(root / 'card').mkdir(exist_ok=True)
(root / 'card/index.html').write_text(card)
print(f'tool {len(tool)} bytes, card {len(card)} bytes')

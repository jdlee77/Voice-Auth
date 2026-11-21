#!/usr/bin/env python3
"""Assemble src/ into the single offline file voice-auth.html."""
from pathlib import Path
root = Path(__file__).parent
page = (root / 'src/template.html').read_text()
page = page.replace('/*CORE*/', (root / 'src/core.js').read_text()).replace('/*APP*/', (root / 'src/app.js').read_text())
(root / 'voice-auth.html').write_text(page)
print('wrote voice-auth.html', len(page), 'bytes')

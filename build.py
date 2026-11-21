#!/usr/bin/env python3
"""Assemble src/ into the single offline file voice-auth.html (and index.html for GitHub Pages)."""
from pathlib import Path
root = Path(__file__).parent
page = (root / 'src/template.html').read_text()
page = page.replace('/*CORE*/', (root / 'src/core.js').read_text()).replace('/*APP*/', (root / 'src/app.js').read_text())
# voice-auth.html is the download copy; index.html is the same page for GitHub Pages
for name in ('voice-auth.html', 'index.html'):
    (root / name).write_text(page)
print('wrote voice-auth.html and index.html', len(page), 'bytes')

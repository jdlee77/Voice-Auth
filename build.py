#!/usr/bin/env python3
"""Assemble src/ into the self-contained custodian tool:
   voice-auth.html / index.html : custodian tool (index.html is the GitHub Pages copy)
"""
from pathlib import Path
root = Path(__file__).parent
src = lambda p: (root / 'src' / p).read_text()

tool = (src('template.html').replace('/*CARDSHEETCSS*/', src('cardsheet.css')).replace('/*TUTORIALCSS*/', src('tutorial.css'))
        .replace('/*CORE*/', src('core.js')).replace('/*CARDSHEET*/', src('cardsheet.js')).replace('/*TUTORIAL*/', src('tutorial.js'))
        .replace('/*APP*/', src('app.js')).replace('/*ONBOARDING*/', src('onboarding.js')))
for marker in ('/*CARDSHEETCSS*/', '/*TUTORIALCSS*/', '/*CORE*/', '/*CARDSHEET*/', '/*TUTORIAL*/', '/*APP*/', '/*ONBOARDING*/'):
    assert marker not in tool, 'unfilled placeholder ' + marker
for name in ('voice-auth.html', 'index.html'):
    (root / name).write_text(tool)
print(f'tool {len(tool)} bytes')

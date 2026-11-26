(() => {
  const $ = (id) => document.getElementById(id);
  const S = { key: null, secret: '', version: 0, created: '', exported: true, cards: null, source: '' };
  const listeners = [];
  const notify = () => listeners.forEach((fn) => fn());
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const when = (iso) => iso ? new Date(iso).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const intIn = (id, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(+$(id).value || lo)));

  // ---------- key handling ----------
  function setKey(bytes, version, created) {
    S.key = bytes; S.secret = VA.b32encode(bytes); S.version = version; S.created = created;
    $('secretBox').hidden = true; $('btnShow').textContent = 'Show secret';
    ['btnExport', 'btnRotate', 'btnShow', 'btnBuild'].forEach((b) => ($(b).disabled = false));
    renderKeyInfo(); clearCards();
  }
  function renderKeyInfo() {
    setTimeout(notify, 0);
    $('keyInfo').innerHTML = S.key
      ? `<dt>Fingerprint</dt><dd class="mono"><b>${VA.fingerprint(S.key)}</b> (read aloud to confirm everyone has the same key)</dd>
         <dt>Version</dt><dd>v${S.version}${S.exported ? '' : ' · <span style="color:var(--bad)">not exported</span>'}</dd>
         <dt>Created</dt><dd>${esc(when(S.created))}</dd>`
      : '<dt>Key</dt><dd>None loaded</dd>';
  }
  function newKey(version) {
    const b = new Uint8Array(20); crypto.getRandomValues(b);
    S.exported = false; S.source = 'new'; setKey(b, version, new Date().toISOString());
  }
  $('btnNew').onclick = () => {
    if (S.key && !confirm('Replace the loaded key? Cards printed with it will no longer match this tool.')) return;
    newKey(1);
  };
  $('btnRotate').onclick = () => {
    if (!confirm('Rotate the key?\n\nEvery printed card stops working. Reprint the cards and announce the new fingerprint.')) return;
    newKey(S.version + 1);
  };
  $('btnShow').onclick = () => {
    const box = $('secretBox'); box.hidden = !box.hidden;
    box.textContent = 'Secret (Base32): ' + S.secret.replace(/(.{4})/g, '$1 ').trim();
    $('btnShow').textContent = box.hidden ? 'Show secret' : 'Hide secret';
  };
  $('btnExport').onclick = () => {
    const data = { format: 'voiceauth-key', spec: 2, incident: $('incName').value, incidentNo: $('incNo').value,
      custodian: $('custodian').value, version: S.version, created: S.created, fingerprint: VA.fingerprint(S.key),
      secret: S.secret, dailyCodes: 31, challengesPerCard: intIn('nCh', 4, 100),
      note: 'CONTROLLED. Authentication key. Anyone with this file can print valid cards.' };
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const slug = ($('incName').value || 'key').replace(/[^a-z0-9]+/gi, '-');
    a.download = `voiceauth-key-${slug}-v${S.version}-${VA.fingerprint(S.key)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    S.exported = true; renderKeyInfo();
  };
  $('btnImport').onclick = () => $('fileIn').click();
  $('fileIn').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d.format !== 'voiceauth-key') throw new Error('Not a Voice Auth key file');
        if (d.spec !== 2) throw new Error('This key file is from the older time-based version');
        const bytes = VA.b32decode(d.secret);
        if (bytes.length < 16) throw new Error('Key too short');
        if (d.fingerprint && d.fingerprint !== VA.fingerprint(bytes)) throw new Error('Fingerprint mismatch: file is damaged');
        $('incName').value = d.incident || ''; $('incNo').value = d.incidentNo || ''; $('custodian').value = d.custodian || '';
        if (d.challengesPerCard) $('nCh').value = String(d.challengesPerCard);
        S.exported = true; S.source = 'import'; setKey(bytes, d.version || 1, d.created || '');
      } catch (err) { alert('Could not import key: ' + err.message); }
      e.target.value = '';
    };
    r.readAsText(f);
  };
  window.addEventListener('beforeunload', (e) => { if (S.key && !S.exported) { e.preventDefault(); e.returnValue = ''; } });
  ['incName', 'incNo', 'custodian', 'nCh', 'fromCard', 'cardCount', 'cardSize'].forEach((id) => $(id).addEventListener('change', clearCards));

  function clearCards() { if (!S.cards) return; S.cards = null; $('cards').innerHTML = ''; $('btnPrint').disabled = true;
    $('cardsNote').textContent = 'Settings changed. Build cards again.'; }

  // ---------- cards ----------
  $('btnBuild').onclick = () => {
    const from = intIn('fromCard', 1, 9999), count = +$('cardCount').value;
    const { html, note } = CardSheet.html(S.key, { from, count, challenges: intIn('nCh', 4, 100), size: $('cardSize').value,
      version: S.version, fingerprint: VA.fingerprint(S.key), incident: $('incName').value, incidentNo: $('incNo').value, custodian: $('custodian').value });
    $('cards').innerHTML = html; S.cards = true; $('btnPrint').disabled = false;
    $('cardsNote').textContent = note;
  };
  // Printing: cards and the tutorial are separate print jobs. body.print-tutorial switches the print view to the tutorial.
  function printCards() {
    if (!S.cards) $('btnBuild').click();
    document.body.classList.remove('print-tutorial');
    window.print();
  }
  function printTutorial() {
    $('tutorialPrint').innerHTML = Tutorial.html({ size: $('cardSize').value, custodian: $('custodian').value });
    document.body.classList.add('print-tutorial');
    window.addEventListener('afterprint', () => document.body.classList.remove('print-tutorial'), { once: true });
    window.print();
  }
  $('btnPrint').onclick = printCards;
  $('btnTutorial').onclick = printTutorial;

  // For the setup slides (onboarding.js): read state, run the same actions as the main screen, hear about key changes.
  window.VAApp = {
    hasKey: () => !!S.key, exported: () => S.exported, source: () => S.source,
    fingerprint: () => (S.key ? VA.fingerprint(S.key) : ''), version: () => S.version,
    newKey: () => $('btnNew').click(), importKey: () => $('btnImport').click(), exportKey: () => $('btnExport').click(),
    printCards, printTutorial, onChange: (fn) => listeners.push(fn),
  };

  // ---------- self-test ----------
  (() => {
    const { ok, failed } = VA.selfTest();
    const el = $('selftest'); el.className = 'result ' + (ok ? 'ok' : 'bad');
    el.textContent = ok ? '✔ Self-test passed: SHA-256, RFC 4231 HMAC-SHA256, Base32 and Voice Auth test vectors match.'
      : '✘ SELF-TEST FAILED. Do not use this copy. Failed: ' + failed.join(', ');
  })();
})();

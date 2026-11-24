// ===== Voice Auth custodian tool: enrollment code panel =====
// Seals the loaded key into an enrollment code and shows it as a QR code. The same QR and passphrase serve
// the phone app (/card/) and far-end printing (/print/).
//   EnrollPanel.attach(getKey)   getKey() -> { key, version, incident } for the loaded key, or null
//   EnrollPanel.reset()          clears a shown QR (call when the key changes)
const EnrollPanel = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reset = () => { $('enrollOut').innerHTML = ''; };

  function attach(getKey) {
    $('btnEnroll').onclick = async () => {
      const k = getKey(); if (!k) return;
      const p1 = $('encPass').value, p2 = $('encPass2').value, out = $('enrollOut');
      if (p1 !== p2) { out.innerHTML = '<div class="result bad">The passphrases don\'t match.</div>'; return; }
      $('btnEnroll').disabled = true; out.innerHTML = '<div class="note">Encrypting…</div>';
      try {
        const r = await EnrollmentCode.seal(k.key, { version: k.version, incident: k.incident }, p1);
        if (r.status === 'passphrase-too-short') out.innerHTML = '<div class="result bad">Use a passphrase of at least 12 characters.</div>';
        else {
          const q = qrcode(0, 'M'); q.addData(r.code); q.make();
          out.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) +
            `<div class="note">Key v${esc(k.version)} · fingerprint <b class="mono">${VA.fingerprint(k.key)}</b>. Scan this code on a phone at <b>/card/</b>, or at a far end at <b>/print/</b> on this site.</div>
             <label>Or copy the enrollment code (still needs the passphrase)</label><textarea readonly id="enrollCode">${esc(r.code)}</textarea>
             <button id="btnHideEnroll">Hide QR</button>`;
          $('btnHideEnroll').onclick = reset;
          $('encPass').value = $('encPass2').value = '';
        }
      } catch (e) { out.innerHTML = `<div class="result bad">${esc(e.message)}</div>`; }
      $('btnEnroll').disabled = false;
    };
  }

  return { attach, reset };
})();

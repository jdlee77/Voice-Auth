(() => {
  const $ = (id) => document.getElementById(id);
  const S = { key: null, secret: '', version: 0, created: '', exported: true, cards: null };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');
  const when = (iso) => iso ? new Date(iso).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const intIn = (id, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(+$(id).value || lo)));

  // ---------- key handling ----------
  function setKey(bytes, version, created) {
    S.key = bytes; S.secret = VA.b32encode(bytes); S.version = version; S.created = created;
    $('secretBox').hidden = true; $('btnShow').textContent = 'Show secret';
    ['btnExport', 'btnRotate', 'btnShow', 'btnBuild', 'btnEnroll'].forEach((b) => ($(b).disabled = false));
    $('enrollOut').innerHTML = '';
    renderKeyInfo(); clearCards(); refreshConsole();
  }
  function renderKeyInfo() {
    $('keyInfo').innerHTML = S.key
      ? `<dt>Fingerprint</dt><dd class="mono"><b>${VA.fingerprint(S.key)}</b> (read aloud to confirm everyone has the same key)</dd>
         <dt>Version</dt><dd>v${S.version}${S.exported ? '' : ' · <span style="color:var(--bad)">not exported</span>'}</dd>
         <dt>Created</dt><dd>${esc(when(S.created))}</dd>`
      : '<dt>Key</dt><dd>None loaded</dd>';
  }
  function newKey(version) {
    const b = new Uint8Array(20); crypto.getRandomValues(b);
    S.exported = false; setKey(b, version, new Date().toISOString());
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
        S.exported = true; setKey(bytes, d.version || 1, d.created || '');
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
  // Badge size (85.6 x 54 mm): front = all 31 daily codes, back = up to BADGE_MAX challenge/response pairs.
  // No phonetics: they don't fit, and operators read the letters in NATO phonetics anyway.
  const BADGE_MAX = 32;
  function badgeHtml(card, nCh, inc, incNo, fp) {
    const days = card.dailyCodes().map((c, i) => `<div><span>${pad2(i + 1)}</span>${c}</div>`).join('');
    const ch = card.challenges(Math.min(nCh, BADGE_MAX));
    const cols = ch.length <= 8 ? 1 : ch.length <= 16 ? 2 : ch.length <= 24 ? 3 : 4;
    const fs = ['9pt', '8.5pt', '7.5pt', '6.5pt'][cols - 1];
    const pairs = ch.map((x) => `<div>☐ ${x}<i>→</i>${card.respond(x).response}</div>`).join('');
    const top = `<div class="no"><small>CARD</small>${card.no}</div>
        <div class="meta"><div><b>CONTROLLED · VOICE AUTH</b></div><div>${inc}${incNo !== '—' ? ' · #' + incNo : ''}</div><div>Key v${S.version} · FP ${fp}</div></div>`;
    return `<div class="badge-pair">
      <div class="badge front"><div class="top">${top}</div>
        <h4>Daily codes · day of month</h4><div class="days">${days}</div>
        <div class="rule">Use only the card announced by the custodian. Wrong code or response = NOT authenticated. Report a lost card at once.</div></div>
      <div class="badge back"><div class="top">${top}</div>
        <h4>Challenge → response · strike after use</h4><div class="pairs" style="grid-template-columns:repeat(${cols},auto);justify-content:space-around;--fs:${fs}">${pairs}</div>
        <div class="rule">Never reuse a struck challenge. Unsure? Confirm the card and day, then confirm by another path.</div></div>
    </div>`;
  }

  $('btnBuild').onclick = () => {
    const nCh = intIn('nCh', 4, 100), badge = $('cardSize').value === 'badge';
    const from = intIn('fromCard', 1, 9999), count = +$('cardCount').value;
    const inc = esc($('incName').value || '—'), incNo = esc($('incNo').value || '—'), cust = esc($('custodian').value || '—');
    const fp = VA.fingerprint(S.key); let html = '';
    for (let cardNo = from; cardNo < from + count; cardNo++) {
      if (badge) { html += badgeHtml(VA.card(S.key, cardNo), nCh, inc, incNo, fp); continue; }
      const card = VA.card(S.key, cardNo);
      const days = card.dailyCodes();
      const codes = days.map((oc, i) =>
        `<div><span class="ln">Day ${pad2(i + 1)}</span><b>${oc}</b><i>${VA.phon(oc)}</i></div>`).join('');
      const ch = card.challenges(nCh), half = Math.ceil(ch.length / 2);
      const tbl = (list) => `<table><tr><th></th><th>Challenge</th><th>Response</th></tr>${list.map((x) => {
        const r = card.respond(x).response;
        return `<tr><td class="box">☐</td><td><b>${x}</b> <span>${VA.phon(x)}</span></td><td><b>${r}</b> <span>${VA.phon(r)}</span></td></tr>`; }).join('')}</table>`;
      html += `<div class="card">
        <div class="banner">CONTROLLED · VOICE AUTHENTICATION CARD</div>
        <div class="hd">
          <div class="cardno"><b>Card</b>${cardNo}</div>
          <div><b>Incident</b>${inc}<br><b style="margin-top:4px">Incident #</b>${incNo}</div>
          <div><b>Key</b>v${S.version} · FP ${fp}<br><b style="margin-top:4px">Key custodian</b>${cust}</div>
        </div>
        <h3>1 · Daily order codes: use the code for today's day of the month. Sender says "Auth KILO BRAVO"; receiver checks it against today</h3>
        <div class="codes">${codes}</div>
        <h3>2 · Challenge / response: pick an unused challenge, strike it after use</h3>
        <div class="cr">${tbl(ch.slice(0, half))}${tbl(ch.slice(half))}</div>
        <div class="ft"><b>Rules:</b> Use only the card number announced by the key custodian. It stays in effect until a new card is announced. Around midnight, or when units are in different time zones, the day announced by the key custodian governs. Strike each challenge line after use and never reuse it. A wrong code or response means NOT authenticated: first confirm you are on the same card and day, then confirm by another path. Do not act on unauthenticated traffic. Report a lost card immediately to the key custodian, who will switch cards or rotate the key.</div>
      </div>`;
    }
    $('cards').innerHTML = html; S.cards = true; $('btnPrint').disabled = false;
    $('cardsNote').textContent = `Card${count > 1 ? 's' : ''} ${from}${count > 1 ? '–' + (from + count - 1) : ''} built for key v${S.version} (FP ${fp}). `
      + (badge ? `Badge size, 4 per page${nCh > BADGE_MAX ? `, first ${BADGE_MAX} challenges` : ''}. Print at 100% scale (Actual size), cut on the solid outline and fold on the dashed line.`
        : 'One page per card.');
  };
  $('btnPrint').onclick = () => window.print();

  // ---------- phone enrollment ----------
  $('btnEnroll').onclick = async () => {
    const p1 = $('encPass').value, p2 = $('encPass2').value, out = $('enrollOut');
    if (p1 !== p2) { out.innerHTML = '<div class="result bad">The passphrases don\'t match.</div>'; return; }
    $('btnEnroll').disabled = true; out.innerHTML = '<div class="note">Encrypting…</div>';
    try {
      const r = await EnrollmentCode.seal(S.key, { version: S.version, incident: $('incName').value || '' }, p1);
      if (r.status === 'passphrase-too-short') { out.innerHTML = '<div class="result bad">Use a passphrase of at least 12 characters.</div>'; $('btnEnroll').disabled = false; return; }
      const code = r.code;
      const q = qrcode(0, 'M'); q.addData(code); q.make();
      out.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) +
        `<div class="note">Key v${S.version} · fingerprint <b class="mono">${VA.fingerprint(S.key)}</b>. On the phone, open <b>/card/</b> on this site and scan this code.</div>
         <label>Or copy the enrollment code (still needs the passphrase)</label><textarea readonly id="enrollCode">${esc(code)}</textarea>
         <button id="btnHideEnroll">Hide QR</button>`;
      $('btnHideEnroll').onclick = () => { out.innerHTML = ''; };
      $('encPass').value = $('encPass2').value = '';
    } catch (e) { out.innerHTML = `<div class="result bad">${esc(e.message)}</div>`; }
    $('btnEnroll').disabled = false;
  };

  // ---------- card console ----------
  function refreshConsole() {
    const no = intIn('conCard', 1, 9999);
    $('conTitle').textContent = S.key ? `Card ${no} in effect` : 'Load a key first';
    $('chkLine').dispatchEvent(new Event('input')); $('chkCh').dispatchEvent(new Event('input'));
  }
  $('conCard').addEventListener('input', refreshConsole);
  const lineLookup = () => {
    const el = $('chkLineRes'), day = Math.floor(+$('chkLine').value), code = $('chkCode').value.toUpperCase().replace(/[^A-Z]/g, '');
    $('chkCode').value = code;
    if (!S.key || !day) { el.textContent = ''; el.className = 'result'; return; }
    if (day < 1 || day > 31) { el.className = 'result bad'; el.textContent = 'Day must be 1–31.'; return; }
    const no = intIn('conCard', 1, 9999), exp = VA.card(S.key, no).dailyCode(day);
    if (code.length < 2) { el.className = 'result'; el.textContent = `Card ${no}, day ${pad2(day)} = ${exp} (${VA.phon(exp)})`; return; }
    el.className = 'result ' + (code === exp ? 'ok' : 'bad');
    el.textContent = code === exp ? `✔ VALID: Card ${no}, day ${pad2(day)}`
      : `✘ NOT VALID for Card ${no}, day ${pad2(day)}. Confirm the card and day, then confirm by another path.`;
  };
  $('chkLine').addEventListener('input', lineLookup); $('chkCode').addEventListener('input', lineLookup);
  $('chkCh').addEventListener('input', () => {
    const v = $('chkCh').value.toUpperCase().replace(/[^A-Z0-9]/g, ''), el = $('chkChRes');
    $('chkCh').value = v;
    if (!S.key || v.length < 3) { el.textContent = ''; el.className = 'result'; return; }
    const no = intIn('conCard', 1, 9999), res = VA.card(S.key, no).respond(v);
    if (res.status === 'bad-format') { el.className = 'result bad'; el.textContent = 'Format is letter-number-letter, e.g. A3C'; return; }
    const r = res.response;
    el.className = 'result ok'; el.textContent = `Card ${no}: ${VA.phon(v)} → respond ${r} (${VA.phon(r)})`;
  });
  $('chkLine').value = new Date().getDate();
  refreshConsole();

  // ---------- self-test ----------
  (() => {
    const { ok, failed } = VA.selfTest();
    const el = $('selftest'); el.className = 'result ' + (ok ? 'ok' : 'bad');
    el.textContent = ok ? '✔ Self-test passed: SHA-256, RFC 4231 HMAC-SHA256, Base32 and Voice Auth test vectors match.'
      : '✘ SELF-TEST FAILED. Do not use this copy. Failed: ' + failed.join(', ');
  })();
})();

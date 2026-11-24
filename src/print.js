// ===== Voice Auth far-end printing: open an enrollment code, print cards, keep nothing =====
(() => {
  const $ = (id) => document.getElementById(id);
  let key = null, info = null;   // the key lives only here, in memory, until cleared or the page closes

  const show = (id) => {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
    $('main').classList.toggle('wide', id === 'scrPrint');
  };
  const msg = (id, text, cls = '') => { const el = $(id); el.textContent = text; el.className = 'msg ' + cls; };
  const intIn = (id, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(+$(id).value || lo)));
  const clearCards = () => { $('cards').innerHTML = ''; $('cardsNote').textContent = ''; $('btnPrint').disabled = true; };

  function clearKey() {
    if (key) key.fill(0);
    key = null; info = null; clearCards();
    ['codeIn', 'passIn', 'incNo', 'custodian'].forEach((id) => ($(id).value = ''));
  }

  // ---------- 1. open the enrollment code ----------
  QrScan.attach({
    onCode: (code) => { $('codeIn').value = code; msg('openMsg', 'QR code read. Now enter the passphrase.', 'ok'); $('passIn').focus(); },
    onMsg: (text, cls) => msg('openMsg', text, cls),
  });
  $('btnOpen').onclick = async () => {
    const code = $('codeIn').value.trim(), pass = $('passIn').value;
    if (!code) return msg('openMsg', 'Scan the QR code or paste the enrollment code first.', 'bad');
    if (!pass) return msg('openMsg', 'Enter the passphrase from the custodian.', 'bad');
    msg('openMsg', 'Checking…'); $('btnOpen').disabled = true;
    try {
      const r = await EnrollmentCode.open(code, pass);
      if (r.status === 'not-a-code') msg('openMsg', 'That is not a Voice Auth enrollment code.', 'bad');
      else if (r.status === 'wrong-passphrase') msg('openMsg', 'Wrong passphrase, or the code is damaged.', 'bad');
      else if (r.status === 'damaged') msg('openMsg', 'The code is damaged.', 'bad');
      else {
        key = r.key; info = { version: r.version, fingerprint: r.fingerprint, incident: r.incident };
        $('codeIn').value = ''; $('passIn').value = ''; msg('openMsg', '');
        $('keyInfo').textContent = `Key v${r.version} · fingerprint ${r.fingerprint}${r.incident ? ' · ' + r.incident : ''}`;
        clearCards(); show('scrPrint');
      }
    } catch (e) { msg('openMsg', e.message, 'bad'); }
    $('btnOpen').disabled = false;
  };

  // ---------- 2. print cards ----------
  $('btnBuild').onclick = () => {
    if (!key) return;
    const { html, note } = CardSheet.html(key, {
      from: intIn('fromCard', 1, 9999), count: +$('cardCount').value, challenges: intIn('nCh', 4, 100), size: $('cardSize').value,
      version: info.version, fingerprint: info.fingerprint, incident: info.incident, incidentNo: $('incNo').value, custodian: $('custodian').value });
    $('cards').innerHTML = html; $('cardsNote').textContent = note; $('btnPrint').disabled = false;
  };
  ['fromCard', 'cardCount', 'nCh', 'cardSize', 'incNo', 'custodian'].forEach((id) => ['input', 'change'].forEach((ev) => $(id).addEventListener(ev, clearCards)));
  $('btnPrint').onclick = () => window.print();
  $('btnClear').onclick = () => { clearKey(); msg('openMsg', 'Key cleared.', 'ok'); show('scrOpen'); };
  window.addEventListener('pagehide', clearKey);

  // ---------- start ----------
  const st = VA.selfTest();
  if (!st.ok) { $('brokenChecks').textContent = st.failed.join(', '); show('scrBroken'); return; }
  if (!window.crypto || !crypto.subtle) { msg('openMsg', 'Open this page from its https:// address (the GitHub Pages site), or as a saved file. It cannot run here.', 'bad'); }
  show('scrOpen');
})();

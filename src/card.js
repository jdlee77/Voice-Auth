(() => {
  const $ = (id) => document.getElementById(id);
  const IDLE_MS = 120000;
  let meta = null, secret = null, pending = null, cardNo = 1, day = new Date().getDate(), idleTimer = null;

  // ---------- small IndexedDB key/value store ----------
  const dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('This browser cannot store data for this page.'));
    const r = indexedDB.open('voiceauth', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => { const db = await dbp; return new Promise((res, rej) => {
    const t = db.transaction('kv', mode), st = t.objectStore('kv'), q = fn(st);
    t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  const store = {
    get: (k) => tx('readonly', (s) => s.get(k)),
    put: (k, v) => tx('readwrite', (s) => s.put(v, k)),
    delete: (k) => tx('readwrite', (s) => s.delete(k)),
  };
  const deviceKey = DeviceKey.create(store);

  // ---------- screens ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
    $('btnLock').hidden = id !== 'scrCard';
  }
  const msg = (id, text, cls = '') => { const el = $(id); el.textContent = text; el.className = 'msg ' + cls; };
  const metaText = (m) => `Key v${m.v} · fingerprint ${m.f}${m.n ? ' · ' + m.n : ''}`;

  // ---------- QR reading (camera or photo) ----------
  QrScan.attach({
    onCode: (code) => { $('codeIn').value = code; msg('enrollMsg', 'QR code read. Now enter the passphrase.', 'ok'); $('passIn').focus(); },
    onMsg: (text, cls) => msg('enrollMsg', text, cls),
  });

  // ---------- enroll ----------
  $('btnOpen').onclick = async () => {
    const code = $('codeIn').value.trim(), pass = $('passIn').value;
    if (!code) return msg('enrollMsg', 'Scan the QR code or paste the enrollment code first.', 'bad');
    if (!pass) return msg('enrollMsg', 'Enter the passphrase from the custodian.', 'bad');
    msg('enrollMsg', 'Checking…'); $('btnOpen').disabled = true;
    try {
      const r = await EnrollmentCode.open(code, pass);
      if (r.status === 'not-a-code') msg('enrollMsg', 'That is not a Voice Auth enrollment code.', 'bad');
      else if (r.status === 'wrong-passphrase') msg('enrollMsg', 'Wrong passphrase, or the code is damaged.', 'bad');
      else if (r.status === 'damaged') msg('enrollMsg', 'The code is damaged.', 'bad');
      else {
        pending = { bytes: r.key, meta: { f: r.fingerprint, v: r.version, n: r.incident } };   // stored with the device key
        $('passIn').value = ''; $('codeIn').value = ''; msg('enrollMsg', '');
        $('pinKeyInfo').textContent = metaText(pending.meta) + '. Confirm this fingerprint with your custodian.';
        show('scrPin'); $('pin1').focus();
      }
    } catch (e) { msg('enrollMsg', e.message, 'bad'); }
    $('btnOpen').disabled = false;
  };
  $('btnSavePin').onclick = async () => {
    const a = $('pin1').value, b = $('pin2').value;
    if (a !== b) return msg('pinMsg', 'The PINs don\'t match.', 'bad');
    msg('pinMsg', 'Saving…'); $('btnSavePin').disabled = true;
    try {
      const r = await deviceKey.enroll(pending.bytes, pending.meta, a);
      if (r.status === 'invalid-pin') msg('pinMsg', 'Use 6 to 12 digits.', 'bad');
      else {
        meta = pending.meta; secret = pending.bytes; pending = null; $('pin1').value = $('pin2').value = ''; msg('pinMsg', '');
        openCard();
      }
    } catch (e) { msg('pinMsg', 'Could not save the key on this phone: ' + e.message, 'bad'); }
    $('btnSavePin').disabled = false;
  };

  // ---------- unlock / lock ----------
  function showUnlock(text = '', cls = '') {
    $('unlockInfo').textContent = metaText(meta);
    $('pinIn').value = ''; msg('unlockMsg', text, cls); show('scrUnlock');
  }
  $('btnUnlock').onclick = async () => {
    const pin = $('pinIn').value; if (!pin) return;
    msg('unlockMsg', 'Checking…'); $('btnUnlock').disabled = true;
    try {
      const r = await deviceKey.unlock(pin);
      $('pinIn').value = '';
      if (r.status === 'open') { secret = r.secret; msg('unlockMsg', ''); openCard(); }
      else if (r.status === 'wrong-pin') msg('unlockMsg', `Wrong PIN. ${r.triesLeft} ${r.triesLeft === 1 ? 'try' : 'tries'} left before the key is erased.`, 'bad');
      else if (r.status === 'erased') { meta = null; msg('enrollMsg', 'Too many wrong PINs. The key was erased from this phone.', 'bad'); show('scrEnroll'); }
      else msg('unlockMsg', 'The stored key can\'t be read on this phone. Erase it and enroll again.', 'bad');
    } catch (e) { msg('unlockMsg', 'Could not read the stored key: ' + e.message, 'bad'); }
    $('btnUnlock').disabled = false;
  };
  $('pinIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnUnlock').click(); });
  function lock() {
    if (!secret) return;
    secret.fill(0); secret = null; clearTimeout(idleTimer);
    $('dailyCode').textContent = '——'; $('dailyPh').textContent = ''; $('chIn').value = ''; $('respCode').textContent = ''; $('respPh').textContent = '';
    showUnlock('Locked.');
  }
  $('btnLock').onclick = lock;
  document.addEventListener('visibilitychange', () => { if (document.hidden) lock(); });
  const bump = () => { if (!secret) return; clearTimeout(idleTimer); idleTimer = setTimeout(lock, IDLE_MS); };
  ['pointerdown', 'keydown', 'input'].forEach((ev) => document.addEventListener(ev, bump, true));
  $('btnForget').onclick = async () => {
    if (!confirm('Erase the key from this phone? You will need a new enrollment QR code and passphrase from the custodian.')) return;
    await deviceKey.forget(); meta = null; msg('enrollMsg', 'Key erased.', 'ok'); show('scrEnroll');
  };

  // ---------- card ----------
  async function openCard() {
    cardNo = (await store.get('card')) || 1; day = new Date().getDate();
    $('keyMeta').textContent = metaText(meta);
    render(); show('scrCard'); bump();
  }
  function render() {
    if (!secret) return;
    $('cardNo').textContent = cardNo; $('dayNo').textContent = day;
    const code = VA.card(secret, cardNo).dailyCode(day);
    $('dailyCode').textContent = code; $('dailyPh').textContent = VA.phon(code);
    respond();
  }
  const setCard = (n) => { cardNo = Math.max(1, Math.min(9999, n)); render(); store.put('card', cardNo).catch(() => {}); };
  $('cardUp').onclick = () => setCard(cardNo + 1);
  $('cardDn').onclick = () => setCard(cardNo - 1);
  $('dayUp').onclick = () => { day = day % 31 + 1; render(); };
  $('dayDn').onclick = () => { day = (day + 29) % 31 + 1; render(); };
  $('dayToday').onclick = () => { day = new Date().getDate(); render(); };
  function respond() {
    const v = $('chIn').value.toUpperCase().replace(/[^A-Z0-9]/g, ''); $('chIn').value = v;
    $('respCode').textContent = ''; $('respPh').textContent = ''; msg('chMsg', '');
    if (!secret || v.length < 3) return;
    const r = VA.card(secret, cardNo).respond(v);
    if (r.status === 'bad-format') return msg('chMsg', 'Format is letter-number-letter, e.g. A3C', 'bad');
    $('respCode').textContent = r.response; $('respPh').textContent = VA.phon(r.response);
  }
  $('chIn').addEventListener('input', respond);

  // ---------- install ----------
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let deferredPrompt = null;
  function installHint() {
    if (standalone()) { $('installBox').hidden = true; return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    $('installHow').innerHTML = (ios
      ? 'In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. Then open Voice Auth from your home screen and set it up there.'
      : deferredPrompt ? 'Tap <b>Install app</b>, then open Voice Auth from your home screen and set it up there.'
        : 'In your browser menu, choose <b>Install app</b> or <b>Add to Home screen</b>. Then open Voice Auth from your home screen and set it up there.')
      + ' A key set up in the browser does not carry over to the installed app.';
    $('btnInstall').hidden = !deferredPrompt;
    $('installBox').hidden = !!meta;   // already set up here: don't nag
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installHint(); });
  $('btnInstall').onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installHint(); };
  window.addEventListener('appinstalled', () => { $('installBox').hidden = true; });
  // Service workers only run on https (or localhost); elsewhere this quietly does nothing.
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});

  // ---------- start ----------
  (async () => {
    const st = VA.selfTest();
    if (!st.ok) { $('brokenChecks').textContent = st.failed.join(', '); show('scrBroken'); return; }
    if (!window.crypto || !crypto.subtle) { msg('enrollMsg', 'Open this page from its https:// address (the GitHub Pages site). It cannot run here.', 'bad'); show('scrEnroll'); return; }
    try { meta = await deviceKey.load(); } catch (e) { msg('enrollMsg', e.message + ' Private browsing may block storage.', 'bad'); show('scrEnroll'); return; }
    meta ? showUnlock() : show('scrEnroll');
    installHint();
  })();
})();

(() => {
  const $ = (id) => document.getElementById(id);
  const IDLE_MS = 120000;
  let meta = null, secret = null, pending = null, cardNo = 1, day = new Date().getDate(), idleTimer = null, stream = null;

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
  function decodeFrom(source, w, h) {
    const scale = Math.min(1, 1600 / Math.max(w, h)), cw = Math.round(w * scale), ch = Math.round(h * scale);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0, cw, ch);
    const qr = jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: 'attemptBoth' });
    return qr && qr.data.startsWith('VAUTH1.') ? qr.data : null;
  }
  function gotCode(code) {
    stopCamera(); $('codeIn').value = code;
    msg('enrollMsg', 'QR code read. Now enter the passphrase.', 'ok'); $('passIn').focus();
  }
  function stopCamera() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } $('video').style.display = 'none'; }
  $('btnScan').onclick = async () => {
    if (stream) { stopCamera(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      const v = $('video'); v.srcObject = stream; v.style.display = 'block'; await v.play();
      msg('enrollMsg', 'Point the camera at the QR code.');
      const loop = () => {
        if (!stream) return;
        if (v.videoWidth) { const code = decodeFrom(v, v.videoWidth, v.videoHeight); if (code) return gotCode(code); }
        requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { stopCamera(); msg('enrollMsg', 'Camera not available. Use a photo of the QR code, or paste the code instead.', 'bad'); }
  };
  $('btnPhoto').onclick = () => $('photoIn').click();
  $('photoIn').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => { const code = decodeFrom(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url);
      code ? gotCode(code) : msg('enrollMsg', 'No Voice Auth QR code found in that photo. Try again closer and in focus.', 'bad'); };
    img.onerror = () => { URL.revokeObjectURL(url); msg('enrollMsg', 'Could not read that image.', 'bad'); };
    img.src = url; e.target.value = '';
  };

  // ---------- enroll ----------
  $('btnOpen').onclick = async () => {
    const code = $('codeIn').value.trim(), pass = $('passIn').value;
    if (!code) return msg('enrollMsg', 'Scan the QR code or paste the enrollment code first.', 'bad');
    if (!pass) return msg('enrollMsg', 'Enter the passphrase from the custodian.', 'bad');
    msg('enrollMsg', 'Checking…'); $('btnOpen').disabled = true;
    try {
      const p = await Vault.open(code, pass);
      const bytes = VA.b32decode(p.s);
      if (bytes.length < 16 || VA.fingerprint(bytes) !== p.f) throw new Error('The code is damaged.');
      pending = { bytes, meta: { f: p.f, v: p.v, n: p.n || '' } };
      $('passIn').value = ''; $('codeIn').value = ''; msg('enrollMsg', '');
      $('pinKeyInfo').textContent = metaText(pending.meta) + '. Confirm this fingerprint with your custodian.';
      show('scrPin'); $('pin1').focus();
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
    const code = VA.orderLines(secret, cardNo, 31)[day - 1];
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
    if (!/^[A-Z][0-9][A-Z]$/.test(v)) return msg('chMsg', 'Format is letter-number-letter, e.g. A3C', 'bad');
    const r = VA.crResponse(secret, VA.cardLabel(cardNo), v);
    $('respCode').textContent = r; $('respPh').textContent = VA.phon(r);
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
    if (!window.crypto || !crypto.subtle) { msg('enrollMsg', 'Open this page from its https:// address (the GitHub Pages site). It cannot run here.', 'bad'); show('scrEnroll'); return; }
    try { meta = await deviceKey.load(); } catch (e) { msg('enrollMsg', e.message + ' Private browsing may block storage.', 'bad'); show('scrEnroll'); return; }
    meta ? showUnlock() : show('scrEnroll');
    installHint();
  })();
})();

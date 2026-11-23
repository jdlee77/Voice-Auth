// ===== Voice Auth enrollment code: a key sealed with a passphrase, to carry it from the custodian to a phone =====
// Format:  VAUTH1.<salt>.<iterations>.<iv>.<ciphertext>   (base64url parts)
// Encryption: AES-256-GCM, key from PBKDF2-SHA256(passphrase, salt, iterations). Inside: {"s": Base32 key,
// "f": fingerprint, "v": key version, "n": incident}. This format is fixed: codes already handed out must keep opening.
//
//   seal(key, { version, incident }, passphrase) -> { status: 'sealed', code } | { status: 'passphrase-too-short' }
//   open(code, passphrase) -> { status: 'open', key, fingerprint, version, incident }
//                           | { status: 'not-a-code' } | { status: 'wrong-passphrase' } | { status: 'damaged' }
//   looks(text) -> true if text has the shape of an enrollment code (for the QR scanner)
const EnrollmentCode = (() => {
  const core = typeof VA !== 'undefined' ? VA : require('./core.js');
  const te = new TextEncoder(), td = new TextDecoder();
  const ITER = 310000, MIN_ITER = 100000, MAX_ITER = 2000000, MIN_PASSPHRASE = 12, MIN_KEY_BYTES = 16;
  const SHAPE = /^VAUTH1\.[A-Za-z0-9_-]+\.\d+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - (s.length % 4)) % 4);
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function deriveKey(pass, salt, iter) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  const looks = (text) => typeof text === 'string' && SHAPE.test(text.trim());

  async function seal(key, { version, incident = '' }, passphrase) {
    if (String(passphrase).length < MIN_PASSPHRASE) return { status: 'passphrase-too-short' };
    const payload = { s: core.b32encode(key), f: core.fingerprint(key), v: version, n: incident };
    const salt = rand(16), iv = rand(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv },
      await deriveKey(passphrase, salt, ITER), te.encode(JSON.stringify(payload))));
    return { status: 'sealed', code: ['VAUTH1', b64u(salt), ITER, b64u(iv), b64u(ct)].join('.') };
  }

  async function open(code, passphrase) {
    code = String(code).trim();
    if (!looks(code)) return { status: 'not-a-code' };
    const p = code.split('.'), iter = Number(p[2]);
    if (!(iter >= MIN_ITER && iter <= MAX_ITER)) return { status: 'not-a-code' };   // refused before any slow work
    let salt, iv, ct;
    try { salt = unb64u(p[1]); iv = unb64u(p[3]); ct = unb64u(p[4]); } catch (e) { return { status: 'not-a-code' }; }
    if (salt.length !== 16 || iv.length !== 12) return { status: 'not-a-code' };
    let plain;
    try { plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await deriveKey(passphrase, salt, iter), ct); }
    catch (e) { return { status: 'wrong-passphrase' }; }   // also a code changed in transit: AES-GCM can't tell them apart
    try {
      const d = JSON.parse(td.decode(plain)), key = core.b32decode(d.s);
      if (key.length < MIN_KEY_BYTES || core.fingerprint(key) !== d.f) return { status: 'damaged' };
      return { status: 'open', key, fingerprint: d.f, version: d.v, incident: d.n || '' };
    } catch (e) { return { status: 'damaged' }; }
  }

  return { seal, open, looks };
})();
if (typeof module !== 'undefined') module.exports = EnrollmentCode;

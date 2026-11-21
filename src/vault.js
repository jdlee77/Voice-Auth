// ===== Voice Auth vault: passphrase/PIN encryption using the browser's built-in WebCrypto =====
// Enrollment code format:  VAUTH1.<salt>.<iterations>.<iv>.<ciphertext>   (base64url parts)
// Encryption: AES-256-GCM, key from PBKDF2-SHA256(passphrase, salt, iterations).
const Vault = (() => {
  const te = new TextEncoder(), td = new TextDecoder();
  const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - (s.length % 4)) % 4);
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const ITER = 310000;

  async function deriveKey(pass, salt, iter) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const enc = async (key, iv, data) => new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const dec = async (key, iv, data) => new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data));

  // Enrollment code: protects the key while it travels from custodian to phone
  async function seal(obj, pass, iter = ITER) {
    const salt = rand(16), iv = rand(12);
    const ct = await enc(await deriveKey(pass, salt, iter), iv, te.encode(JSON.stringify(obj)));
    return ['VAUTH1', b64u(salt), iter, b64u(iv), b64u(ct)].join('.');
  }
  async function open(code, pass) {
    const p = String(code).trim().split('.');
    if (p.length !== 5 || p[0] !== 'VAUTH1') throw new Error('That is not a Voice Auth enrollment code.');
    try {
      const pt = await dec(await deriveKey(pass, unb64u(p[1]), +p[2]), unb64u(p[3]), unb64u(p[4]));
      return JSON.parse(td.decode(pt));
    } catch (e) { throw new Error('Wrong passphrase, or the code is damaged.'); }
  }

  // On-device storage: key wrapped twice, by a PIN-derived key and by a non-extractable device key
  async function wrapForDevice(secretBytes, pin) {
    const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const salt = rand(16), iv1 = rand(12), iv2 = rand(12);
    const inner = await enc(await deriveKey(pin, salt, ITER), iv1, secretBytes);
    const outer = await enc(deviceKey, iv2, inner);
    return { deviceKey, salt, iv1, iv2, outer };
  }
  async function unwrapOnDevice(rec, pin) {
    const inner = await dec(rec.deviceKey, rec.iv2, rec.outer);
    try { return await dec(await deriveKey(pin, rec.salt, ITER), rec.iv1, inner); }
    catch (e) { throw new Error('Wrong PIN'); }
  }

  return { seal, open, wrapForDevice, unwrapOnDevice };
})();
if (typeof module !== 'undefined') module.exports = Vault;

// ===== Voice Auth device key: the enrolled key as stored on one phone =====
// The key is locked twice: with a key derived from the user's PIN (PBKDF2-SHA256, AES-256-GCM), and with a
// device wrapping key that the phone generates at enrollment and that page scripts cannot read out.
// 5 wrong PINs in a row erase it. Each attempt is counted before the PIN is checked.
//
// DeviceKey.create(store), where store is { get(name), put(name, value), delete(name) } (all async).
// The device key lives under the name 'key'; nothing else in the store is touched.
const DeviceKey = (() => {
  const te = new TextEncoder();
  const ITER = 310000, MAX_FAILS = 5, NAME = 'key';
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const validPin = (pin) => /^\d{6,12}$/.test(pin);

  async function pinKey(pin, salt) {
    const base = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const enc = async (key, iv, data) => new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const dec = async (key, iv, data) => new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data));

  function create(store) {
    // -> metadata of the enrolled device key, or null
    async function load() {
      const rec = await store.get(NAME);
      return rec ? rec.meta : null;
    }

    // -> { status: 'saved' } | { status: 'invalid-pin' }
    async function enroll(secretBytes, meta, pin) {
      if (!validPin(pin)) return { status: 'invalid-pin' };
      const deviceKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      const salt = rand(16), iv1 = rand(12), iv2 = rand(12);
      const inner = await enc(await pinKey(pin, salt), iv1, secretBytes);
      const outer = await enc(deviceKey, iv2, inner);
      await store.put(NAME, { deviceKey, salt, iv1, iv2, outer, meta, fails: 0, created: new Date().toISOString() });
      return { status: 'saved' };
    }

    // -> { status: 'open', secret } | { status: 'wrong-pin', triesLeft } | { status: 'erased' } | { status: 'unreadable' }
    async function unlock(pin) {
      const rec = await store.get(NAME);
      if (!rec) throw new Error('No device key is enrolled on this phone.');
      let inner;
      try { inner = await dec(rec.deviceKey, rec.iv2, rec.outer); }
      catch (e) { return { status: 'unreadable' }; }   // damaged, or not readable on this phone: not a PIN failure
      rec.fails = (rec.fails || 0) + 1;
      await store.put(NAME, rec);                      // count the attempt before checking it
      let secret;
      try { secret = await dec(await pinKey(pin, rec.salt), rec.iv1, inner); }
      catch (e) {
        if (rec.fails >= MAX_FAILS) { await store.delete(NAME); return { status: 'erased' }; }
        return { status: 'wrong-pin', triesLeft: MAX_FAILS - rec.fails };
      }
      rec.fails = 0;
      await store.put(NAME, rec);
      return { status: 'open', secret };
    }

    const forget = () => store.delete(NAME);

    return { load, enroll, unlock, forget };
  }

  return { create };
})();
if (typeof module !== 'undefined') module.exports = DeviceKey;

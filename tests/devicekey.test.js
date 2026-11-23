// Run: node tests/devicekey.test.js
// Device key: the enrolled key as stored on one phone, locked by a PIN, erased after 5 wrong PINs in a row.
const DeviceKey = require('../src/devicekey.js');
const { subtle } = globalThis.crypto;
let fail = 0;
const check = (name, ok, detail = '') => { if (!ok) { fail++; console.log('FAIL', name, detail); } else console.log('ok  ', name); };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// In-memory adapter for the store seam. Clones on the way in and out, as IndexedDB does.
function memoryStore() {
  const map = new Map();
  return {
    map,
    get: async (k) => (map.has(k) ? structuredClone(map.get(k)) : undefined),
    put: async (k, v) => { map.set(k, structuredClone(v)); },
    delete: async (k) => { map.delete(k); },
  };
}
const KEY = Uint8Array.from({ length: 20 }, (_, i) => i + 1);
const META = { f: '6ED6', v: 3, n: 'Test incident' };
const PIN = '246810', WRONG = '135791';

async function enrolled() {
  const store = memoryStore(), dk = DeviceKey.create(store);
  const r = await dk.enroll(KEY.slice(), META, PIN);
  if (r.status !== 'saved') throw new Error('setup: enroll returned ' + r.status);
  return { store, dk };
}

const tests = {
  async 'enroll then unlock with the right PIN returns the same key'() {
    const { dk } = await enrolled();
    check('load() gives the metadata', JSON.stringify(await dk.load()) === JSON.stringify(META));
    const r = await dk.unlock(PIN);
    check('status open', r.status === 'open', r.status);
    check('same bytes', r.secret && same(r.secret, KEY));
  },

  async 'load() is null when nothing is enrolled'() {
    check('null', (await DeviceKey.create(memoryStore()).load()) === null);
  },

  async 'wrong PINs count down, then the 5th erases the device key'() {
    const { store, dk } = await enrolled();
    for (const left of [4, 3, 2, 1]) {
      const r = await dk.unlock(WRONG);
      check(`wrong-pin, ${left} left`, r.status === 'wrong-pin' && r.triesLeft === left, JSON.stringify(r));
    }
    const r = await dk.unlock(WRONG);
    check('5th wrong PIN: erased', r.status === 'erased', r.status);
    check('key record gone', !store.map.has('key'));
    check('load() is null', (await dk.load()) === null);
  },

  async 'the right PIN resets the count'() {
    const { store, dk } = await enrolled();
    await dk.unlock(WRONG); await dk.unlock(WRONG);
    check('open', (await dk.unlock(PIN)).status === 'open');
    check('fails back to 0', store.map.get('key').fails === 0);
    const r = await dk.unlock(WRONG);
    check('full 4 tries left again', r.status === 'wrong-pin' && r.triesLeft === 4, JSON.stringify(r));
  },

  async 'an attempt is counted before the PIN check finishes'() {
    const { store, dk } = await enrolled();
    let settled = false;
    const p = dk.unlock(WRONG).then((r) => { settled = true; return r; });
    const start = Date.now();
    while (!(store.map.get('key').fails >= 1) && Date.now() - start < 5000) await new Promise((r) => setImmediate(r));
    check('fails saved while check still running', store.map.get('key').fails === 1 && !settled);
    await p;
  },

  async 'a damaged record is unreadable and does not count as a failure'() {
    const { store, dk } = await enrolled();
    store.map.get('key').outer[0] ^= 1;
    const r = await dk.unlock(PIN);
    check('unreadable', r.status === 'unreadable', r.status);
    check('fails not raised', store.map.get('key').fails === 0, store.map.get('key').fails);
  },

  async 'forget() erases only the device key'() {
    const { store, dk } = await enrolled();
    await store.put('card', 7);
    await dk.forget();
    check('key gone', !store.map.has('key'));
    check('card number kept', store.map.get('card') === 7);
  },

  async 'the 5-PIN wipe keeps the card number'() {
    const { store, dk } = await enrolled();
    await store.put('card', 7);
    for (let i = 0; i < 5; i++) await dk.unlock(WRONG);
    check('card number kept', store.map.get('card') === 7);
  },

  async 'a record in the format already on enrolled phones still unlocks'() {
    // Built by hand the way Vault.wrapForDevice has stored it since the phone card shipped.
    const te = new TextEncoder(), rand = (n) => crypto.getRandomValues(new Uint8Array(n));
    const deviceKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const salt = rand(16), iv1 = rand(12), iv2 = rand(12);
    const base = await subtle.importKey('raw', te.encode(PIN), 'PBKDF2', false, ['deriveKey']);
    const pinKey = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const inner = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv1 }, pinKey, KEY));
    const outer = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: iv2 }, deviceKey, inner));
    const store = memoryStore();
    await store.put('key', { deviceKey, salt, iv1, iv2, outer, meta: META, fails: 0, created: '2026-11-01T00:00:00.000Z' });
    const r = await DeviceKey.create(store).unlock(PIN);
    check('open', r.status === 'open' && same(r.secret, KEY), r.status);
  },

  async 'enroll refuses a PIN that is not 6 to 12 digits'() {
    for (const pin of ['12345', '1234567890123', 'abcdef', '12 3456', '']) {
      const store = memoryStore();
      const r = await DeviceKey.create(store).enroll(KEY.slice(), META, pin);
      check(`invalid-pin for "${pin}"`, r.status === 'invalid-pin' && !store.map.has('key'), r.status);
    }
    for (const pin of ['123456', '123456789012']) {
      const r = await DeviceKey.create(memoryStore()).enroll(KEY.slice(), META, pin);
      check(`saved for "${pin}"`, r.status === 'saved', r.status);
    }
  },
};

(async () => {
  for (const [name, t] of Object.entries(tests)) {
    try { await t(); } catch (e) { fail++; console.log('FAIL', name, e.message); }
  }
  console.log(fail ? fail + ' FAILURES' : 'ALL PASS');
  process.exit(fail ? 1 : 0);
})();

// Run: node tests/enrollmentcode.test.js
// Enrollment code: a key sealed with a passphrase so it can travel from the custodian to a phone.
const EnrollmentCode = require('../src/enrollmentcode.js');
const VA = require('../src/core.js');
const { subtle } = globalThis.crypto;
let fail = 0;
const check = (name, ok, detail = '') => { if (!ok) { fail++; console.log('FAIL', name, detail); } else console.log('ok  ', name); };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const KEY = VA.enc('12345678901234567890'), PASS = 'correct horse battery staple';
// Made by Vault.seal before this module existed. Codes already handed out must keep opening.
const FIXTURE = 'VAUTH1.5_Dm-AOPaM4kbrV5Y_A0hw.310000.lwVf4J8JfR7LiW3x.mGkzRrKGl-FKCyHq8hU_Q07AXdPG5yD71uJ_l4BxGvXcO4rdOIURpXiR8f1kOcD5lWcwZu7u_By8ebE6zgtUuMxr_oCjgQKKZgn4ZUHEiURfuqaKR95qSPTzdpwLN1K4';

// Seals any payload the way the format is defined, so tests can build codes with bad contents.
const b64u = (u8) => Buffer.from(u8).toString('base64url');
async function sealRaw(payload, pass, iter = 310000) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const k = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(payload))));
  return ['VAUTH1', b64u(salt), iter, b64u(iv), b64u(ct)].join('.');
}
const withIter = (code, iter) => { const p = code.split('.'); p[2] = String(iter); return p.join('.'); };

const tests = {
  async 'seal then open gives back the key and its details'() {
    const s = await EnrollmentCode.seal(KEY, { version: 3, incident: 'Ridge fire' }, PASS);
    check('sealed', s.status === 'sealed' && typeof s.code === 'string', s.status);
    const r = await EnrollmentCode.open(s.code, PASS);
    check('open', r.status === 'open', r.status);
    check('same key', r.key && same(r.key, KEY));
    check('details', r.fingerprint === VA.fingerprint(KEY) && r.version === 3 && r.incident === 'Ridge fire', JSON.stringify(r));
  },

  async 'a wrong passphrase is refused'() {
    const { code } = await EnrollmentCode.seal(KEY, { version: 1, incident: '' }, PASS);
    const r = await EnrollmentCode.open(code, 'not the passphrase');
    check('wrong-passphrase', r.status === 'wrong-passphrase', r.status);
  },

  async 'a code changed in transit is refused like a wrong passphrase'() {
    const { code } = await EnrollmentCode.seal(KEY, { version: 1, incident: '' }, PASS);
    const i = code.length - 5, bad = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    const r = await EnrollmentCode.open(bad, PASS);
    check('wrong-passphrase', r.status === 'wrong-passphrase', r.status);
  },

  async 'text that is not an enrollment code'() {
    const { code } = await EnrollmentCode.seal(KEY, { version: 1, incident: '' }, PASS);
    for (const t of ['', 'hello', 'https://example.com', code.replace('VAUTH1', 'VAUTH2'), code.split('.').slice(0, 4).join('.'),
      code + '.extra', 'VAUTH1.!!!.310000.@@@.###']) {
      const r = await EnrollmentCode.open(t, PASS);
      check(`not-a-code: ${t.slice(0, 24)}`, r.status === 'not-a-code', r.status);
    }
  },

  async 'iteration counts out of range are refused before any slow work'() {
    const { code } = await EnrollmentCode.seal(KEY, { version: 1, incident: '' }, PASS);
    for (const iter of [1, 99999, 2000001, 1e9, 'abc', '310000.5']) {
      const t = Date.now(), r = await EnrollmentCode.open(withIter(code, iter), PASS);
      check(`not-a-code for ${iter}, fast`, r.status === 'not-a-code' && Date.now() - t < 200, `${r.status} in ${Date.now() - t}ms`);
    }
    const r = await EnrollmentCode.open(await sealRaw({ s: VA.b32encode(KEY), f: VA.fingerprint(KEY), v: 1, n: '' }, PASS, 100000), PASS);
    check('100,000 is accepted', r.status === 'open', r.status);
  },

  async 'a code that decrypts but holds a bad key is damaged'() {
    const cases = {
      'fingerprint mismatch': { s: VA.b32encode(KEY), f: 'FFFF', v: 1, n: '' },
      'key under 16 bytes': { s: VA.b32encode(KEY.slice(0, 15)), f: VA.fingerprint(KEY.slice(0, 15)), v: 1, n: '' },
      'not Base32': { s: 'not base32!', f: 'FFFF', v: 1, n: '' },
      'no key': { f: 'FFFF', v: 1 },
    };
    for (const [name, payload] of Object.entries(cases)) {
      const r = await EnrollmentCode.open(await sealRaw(payload, PASS), PASS);
      check(`damaged: ${name}`, r.status === 'damaged', r.status);
    }
  },

  async 'seal refuses a passphrase under 12 characters'() {
    const r = await EnrollmentCode.seal(KEY, { version: 1, incident: '' }, 'elevenchars');
    check('passphrase-too-short', r.status === 'passphrase-too-short' && !r.code, r.status);
    const ok = await EnrollmentCode.seal(KEY, { version: 1, incident: '' }, 'twelve chars');
    check('12 characters accepted', ok.status === 'sealed', ok.status);
  },

  async 'looks() tells a code from other scanned text'() {
    const { code } = await EnrollmentCode.seal(KEY, { version: 1, incident: '' }, PASS);
    check('real code', EnrollmentCode.looks(code) === true);
    check('fixture', EnrollmentCode.looks(FIXTURE) === true);
    for (const t of ['', 'https://example.com', 'VAUTH1', 'vauth1.a.b.c.d', null, undefined])
      check(`not a code: ${t}`, EnrollmentCode.looks(t) === false);
  },

  async 'a code made before this module still opens'() {
    const r = await EnrollmentCode.open(FIXTURE, PASS);
    check('open', r.status === 'open', r.status);
    check('same key and details', r.key && same(r.key, KEY) && r.fingerprint === '6ED6' && r.version === 4 && r.incident === 'Fixture incident', JSON.stringify(r));
  },
};

(async () => {
  for (const [name, t] of Object.entries(tests)) {
    try { await t(); } catch (e) { fail++; console.log('FAIL', name, e.message); }
  }
  console.log(fail ? fail + ' FAILURES' : 'ALL PASS');
  process.exit(fail ? 1 : 0);
})();

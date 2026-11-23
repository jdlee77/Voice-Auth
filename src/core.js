// ===== Voice Auth core: pure JS, no network, no dependencies =====
const VA = (() => {
  const enc = (s) => new TextEncoder().encode(s);

  function pad(msg) {
    const ml = msg.length, len = ((ml + 9 + 63) >> 6) << 6;
    const b = new Uint8Array(len); b.set(msg); b[ml] = 0x80;
    const dv = new DataView(b.buffer), bits = ml * 8;
    dv.setUint32(len - 4, bits >>> 0); dv.setUint32(len - 8, Math.floor(bits / 0x100000000));
    return dv;
  }
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  const K256 = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);

  function sha256(msg) {
    const dv = pad(msg), w = new Uint32Array(64);
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    for (let off = 0; off < dv.byteLength; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3);
        const s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h = h.map((v, i) => (v + [a, b, c, d, e, f, g, hh][i]) >>> 0);
    }
    const out = new Uint8Array(32), o = new DataView(out.buffer);
    h.forEach((v, i) => o.setUint32(i * 4, v)); return out;
  }

  function hmac(hash, key, msg) {
    const B = 64;
    if (key.length > B) key = hash(key);
    const k = new Uint8Array(B); k.set(key);
    const inner = new Uint8Array(B + msg.length), outerKey = new Uint8Array(B);
    for (let i = 0; i < B; i++) { inner[i] = k[i] ^ 0x36; outerKey[i] = k[i] ^ 0x5c; }
    inner.set(msg, B);
    const ih = hash(inner), outer = new Uint8Array(B + ih.length);
    outer.set(outerKey); outer.set(ih, B);
    return hash(outer);
  }

  // RFC 4648 Base32 (no padding)
  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function b32encode(bytes) {
    let bits = 0, val = 0, out = '';
    for (const b of bytes) { val = (val << 8) | b; bits += 8;
      while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits > 0) out += B32[(val << (5 - bits)) & 31];
    return out;
  }
  function b32decode(s) {
    s = s.toUpperCase().replace(/[\s=-]/g, '');
    let bits = 0, val = 0; const out = [];
    for (const ch of s) { const i = B32.indexOf(ch);
      if (i < 0) throw new Error('Invalid Base32 character: ' + ch);
      val = (val << 5) | i; bits += 5;
      if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
    return new Uint8Array(out);
  }

  // Challenge/response (HMAC-SHA256, letter-digit-letter e.g. A3C)
  const PHON = { A:'ALFA',B:'BRAVO',C:'CHARLIE',D:'DELTA',E:'ECHO',F:'FOXTROT',G:'GOLF',H:'HOTEL',
    I:'INDIA',J:'JULIETT',K:'KILO',L:'LIMA',M:'MIKE',N:'NOVEMBER',O:'OSCAR',P:'PAPA',Q:'QUEBEC',
    R:'ROMEO',S:'SIERRA',T:'TANGO',U:'UNIFORM',V:'VICTOR',W:'WHISKEY',X:'XRAY',Y:'YANKEE',Z:'ZULU',
    0:'ZERO',1:'ONE',2:'TWO',3:'THREE',4:'FOUR',5:'FIVE',6:'SIX',7:'SEVEN',8:'EIGHT',9:'NINER' };
  const ldl = (h) => { const n = ((h[0] << 16) | (h[1] << 8) | h[2]) % 6760;
    return AZ[Math.floor(n / 260)] + (Math.floor(n / 26) % 10) + AZ[n % 26]; };
  const phon = (s) => s.split('').map((c) => PHON[c] || c).join(' ');
  const crResponse = (key, label, ch) =>
    ldl(hmac(sha256, key, enc('VAUTH1-R|' + label + '|' + ch.toUpperCase())));
  function crChallenges(key, label, n) {
    const out = [], seen = new Set();
    for (let i = 0; out.length < n && i < 5000; i++) {
      const c = ldl(hmac(sha256, key, enc('VAUTH1-C|' + label + '|' + i)));
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }
  // Time-free cards: everything derives from key + card number
  const cardLabel = (no) => 'CARD-' + no;
  const two = (h) => { const n = ((h[0] << 8) | h[1]) % 676; return AZ[Math.floor(n / 26)] + AZ[n % 26]; };
  function dailyCodes(key, no, n) {
    const out = [], seen = new Set();
    for (let i = 0; out.length < n && i < 5000; i++) {
      const c = two(hmac(sha256, key, enc('VAUTH1-O|' + cardLabel(no) + '|' + i)));
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }

  // A Card: card(key, no) -> { no, dailyCode(day), dailyCodes(), challenges(n), respond(challenge) }
  //   dailyCode(day): the daily code for day 1-31 of the month. respond('a3c') -> { status: 'ok', response } | { status: 'bad-format' }
  //   A card number outside 1-9999 or a day outside 1-31 can only come from a bug, so they throw RangeError.
  const CHALLENGE = /^[A-Z][0-9][A-Z]$/;
  function card(key, no) {
    if (!Number.isInteger(no) || no < 1 || no > 9999) throw new RangeError('Card number must be a whole number 1-9999: ' + no);
    const label = cardLabel(no);
    let days = null;
    const all = () => (days = days || dailyCodes(key, no, 31));
    return {
      no,
      dailyCodes: () => all().slice(),
      dailyCode(day) {
        if (!Number.isInteger(day) || day < 1 || day > 31) throw new RangeError('Day must be a whole number 1-31: ' + day);
        return all()[day - 1];
      },
      challenges: (n) => crChallenges(key, label, n),
      respond(challenge) {
        const ch = String(challenge).toUpperCase();
        return CHALLENGE.test(ch) ? { status: 'ok', response: crResponse(key, label, ch) } : { status: 'bad-format' };
      },
    };
  }
  const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  const fingerprint = (key) => hex(sha256(key).slice(0, 2));

  // Self-test: fixed vectors both pages check when they open. A copy that fails must not be used.
  // -> { ok, failed: [names of the checks that did not match] }
  function selfTest() {
    const k = enc('12345678901234567890'), c1 = card(k, 1);
    const hm = (key, m) => hex(hmac(sha256, key, enc(m)));
    const checks = {
      'sha256 abc (FIPS 180)': () => hex(sha256(enc('abc'))) === 'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD',
      'rfc4231 case 1': () => hm(new Uint8Array(20).fill(11), 'Hi There') === 'B0344C61D8DB38535CA8AFCEAF0BF12B881DC200C9833DA726E9376C2E32CFF7',
      'rfc4231 case 2': () => hm(enc('Jefe'), 'what do ya want for nothing?') === '5BDCC146BF60754E6A042426089575C75A003F089D2739839DEC58B964EC3843',
      'base32 foobar (RFC 4648)': () => b32encode(enc('foobar')) === 'MZXW6YTBOI' && hex(b32decode('MZXW6YTBOI')) === hex(enc('foobar')),
      'daily codes card 1': () => c1.dailyCodes().slice(0, 3).join(',') === 'RZ,YB,WT',
      'challenges card 1': () => c1.challenges(3).join(',') === 'A6A,W2F,X8O',
      'response A3C card 1': () => c1.respond('A3C').response === 'I7J',
      'fingerprint': () => fingerprint(k) === '6ED6',
    };
    const failed = Object.keys(checks).filter((name) => { try { return !checks[name](); } catch (e) { return true; } });
    return { ok: failed.length === 0, failed };
  }

  return { enc, sha256, hmac, hex, b32encode, b32decode, fingerprint, phon, card, selfTest };
})();
if (typeof module !== 'undefined') module.exports = VA;

// Run: node tests/test.js
const VA = require('../src/core.js');
const crypto = require('crypto');
let fail = 0;
const eq = (name, a, b) => { if (a !== b) { fail++; console.log('FAIL', name, a, b); } };

// Hashes and HMAC against Node's crypto, across many lengths
for (let n = 0; n < 300; n++) {
  const m = crypto.randomBytes(n), k = crypto.randomBytes(n % 100);
  eq('sha256 ' + n, VA.hex(VA.sha256(m)), crypto.createHash('sha256').update(m).digest('hex').toUpperCase());
  eq('hmac-sha256 ' + n, VA.hex(VA.hmac(VA.sha256, k, m)), crypto.createHmac('sha256', k).update(m).digest('hex').toUpperCase());
}
// RFC 4231 HMAC-SHA256 test case 2
eq('rfc4231', VA.hex(VA.hmac(VA.sha256, VA.enc('Jefe'), VA.enc('what do ya want for nothing?'))).toLowerCase(),
   '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
// Base32 round trip
for (let n = 1; n < 40; n++) { const b = crypto.randomBytes(n); eq('b32 ' + n, VA.hex(VA.b32decode(VA.b32encode(b))), VA.hex(b)); }

// Voice Auth test vectors (also in the in-app spec)
const key = VA.enc('12345678901234567890');
const card1 = VA.card(key, 1);
eq('daily codes card 1', card1.dailyCodes().slice(0, 3).join(','), 'RZ,YB,WT');
eq('challenges card 1', card1.challenges(3).join(','), 'A6A,W2F,X8O');
eq('response card 1 A3C', card1.respond('A3C').response, 'I7J');
eq('fingerprint', VA.fingerprint(key), '6ED6');

// Cards already printed must keep matching: made by orderLines/crChallenges/crResponse before card() existed
const PRINTED = {
  1: { daily: 'RZYBWTZZMPXAXFHQMMBVALKKQDILZETQONNMPAOSNPKHTUVVROVPKDZTWEPIRM',
       cr: 'A6AN6Z,W2FS0Q,X8OQ1N,G7YG9D,M8XD7J,R7TQ0V,G9EG4M,S7NZ7H,P7KT3F,Q3OD7Y' },
  7: { daily: 'MQEFDODADHDYMADDBCTPEGOOKRHUNLIXLKFVBDEYKPUZJCTYKUUUESKYKHGJWZ',
       cr: 'T3GR8R,K1WF8R,O0SG9K,B8WS9B,D1UL3F,X0CO2W,Z8CR2N,U9UD0L,J8UA7O,E7RW4C' },
  9999: { daily: 'FEAUDSKYBSBWBJGHQOTFWCYGSDXWCEOXTUJHAQIEYJDERPRKCBBTJJFPROGWNJ',
          cr: 'C9XS1C,K2YE9C,C2MN6U,D8XU8M,Q7JE8C,B8AD1R,M1WE9S,O2EO9A,N9VI0A,H4XT5M' },
};
for (const [no, want] of Object.entries(PRINTED)) {
  const c = VA.card(key, +no);
  eq('printed daily codes card ' + no, c.dailyCodes().join(''), want.daily);
  eq('printed challenges card ' + no, c.challenges(10).map((x) => x + c.respond(x).response).join(','), want.cr);
  eq('card number ' + no, c.no, +no);
}

// Properties
const card4 = VA.card(key, 4), days = card4.dailyCodes();
eq('31 distinct daily codes', new Set(days).size, 31);
days.forEach((c) => { if (!/^[A-Z]{2}$/.test(c)) eq('daily format', c, 'AA'); });
for (let d = 1; d <= 31; d++) eq('dailyCode(' + d + ')', card4.dailyCode(d), days[d - 1]);
eq('cards differ', VA.card(key, 5).dailyCodes().join() !== days.join(), true);
days[0] = 'XX'; eq('dailyCodes() returns a copy', card4.dailyCode(1) !== 'XX', true);
for (let i = 1; i < 500; i++) { const r = VA.card(key, i).respond('B' + (i % 10) + 'Q'); if (r.status !== 'ok' || !/^[A-Z][0-9][A-Z]$/.test(r.response)) eq('response format', JSON.stringify(r), 'A0A'); }

// Challenge input
eq('lower case accepted', card1.respond('a3c').response, 'I7J');
for (const bad of ['A33', 'AB3', '', 'A3CD', '3AC', 'A-3C']) eq('bad-format "' + bad + '"', card1.respond(bad).status, 'bad-format');

// Out of range: only a bug can produce these, so they throw
const throws = (name, fn) => { try { fn(); eq(name, 'no throw', 'RangeError'); } catch (e) { eq(name, e instanceof RangeError, true); } };
for (const d of [0, 32, 1.5, NaN]) throws('dailyCode(' + d + ') throws', () => card1.dailyCode(d));
for (const n of [0, 10000, 2.5, -1, NaN]) throws('card(' + n + ') throws', () => VA.card(key, n));
VA.card(key, 9999); VA.card(key, 1);

// The underlying functions are no longer part of the interface
for (const gone of ['orderLines', 'crChallenges', 'crResponse', 'cardLabel', 'hotp', 'totp', 'totpCounter', 'orderCode', 'periodLabel', 'sha1'])
  eq('not exported: ' + gone, VA[gone], undefined);

console.log(fail ? fail + ' FAILURES' : 'ALL PASS');
process.exit(fail ? 1 : 0);

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
eq('daily codes card 1', VA.orderLines(key, 1, 3).join(','), 'RZ,YB,WT');
eq('challenges card 1', VA.crChallenges(key, VA.cardLabel(1), 3).join(','), 'A6A,W2F,X8O');
eq('response card 1 A3C', VA.crResponse(key, VA.cardLabel(1), 'A3C'), 'I7J');
eq('fingerprint', VA.fingerprint(key), '6ED6');

// Properties
const days = VA.orderLines(key, 4, 31);
eq('31 distinct daily codes', new Set(days).size, 31);
days.forEach((c) => { if (!/^[A-Z]{2}$/.test(c)) eq('daily format', c, 'AA'); });
eq('cards differ', VA.orderLines(key, 5, 31).join() !== days.join(), true);
for (let i = 0; i < 500; i++) { const r = VA.crResponse(key, VA.cardLabel(i), 'B' + (i % 10) + 'Q'); if (!/^[A-Z][0-9][A-Z]$/.test(r)) eq('response format', r, 'A0A'); }

console.log(fail ? fail + ' FAILURES' : 'ALL PASS');
process.exit(fail ? 1 : 0);

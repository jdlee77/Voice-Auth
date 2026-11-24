// Run: node tests/cardsheet.test.js
// Card sheet: the printed cards (full page or badge size) built by the custodian tool.
const CardSheet = require('../src/cardsheet.js');
const VA = require('../src/core.js');
let fail = 0;
const check = (name, ok, detail = '') => { if (!ok) { fail++; console.log('FAIL', name, detail); } else console.log('ok  ', name); };
const KEY = VA.enc('12345678901234567890');
const base = { from: 3, count: 2, challenges: 10, version: 2, fingerprint: VA.fingerprint(KEY), incident: 'Ridge fire', incidentNo: '0412', custodian: 'J. Lee' };
const strip = (html) => html.replace(/<[^>]+>/g, ' ');
const count = (s, re) => (s.match(re) || []).length;

for (const size of ['page', 'badge']) {
  const { html } = CardSheet.html(KEY, { ...base, size });
  const text = strip(html);
  for (const no of [3, 4]) {
    const c = VA.card(KEY, no);
    check(`${size}: card ${no} has all 31 daily codes in order`, new RegExp(c.dailyCodes().join('[\\s\\S]*?')).test(text));
    check(`${size}: card ${no} has its 10 challenges with the right responses`,
      c.challenges(10).every((x) => new RegExp(x + '[\\s\\S]{0,120}?' + c.respond(x).response).test(text)));
  }
  check(`${size}: key version and fingerprint`, text.includes('v2') && text.includes(base.fingerprint));
  check(`${size}: incident shown`, text.includes('Ridge fire'));
}
{
  const { html } = CardSheet.html(KEY, { ...base, size: 'page' });
  check('page: one .card per card', count(html, /class="card"/g) === 2);
  check('page: custodian shown', strip(html).includes('J. Lee'));
}
{
  const { html, note } = CardSheet.html(KEY, { ...base, size: 'badge', challenges: 100, count: 1 });
  check('badge: one pair per card', count(html, /class="badge-pair"/g) === 1);
  check('badge: at most 32 challenges', count(html, /☐/g) === 32, count(html, /☐/g));
  check('badge note: says first 32 and how to print', /first 32/.test(note) && /100% scale/.test(note), note);
}
{
  const { note } = CardSheet.html(KEY, { ...base, size: 'page' });
  check('page note: cards 3–4, one page each', /3–4/.test(note) && /One page per card/.test(note), note);
}
{
  const evil = '<img src=x onerror=alert(1)>';
  for (const size of ['page', 'badge']) {
    const { html } = CardSheet.html(KEY, { ...base, size, incident: evil, incidentNo: evil, custodian: evil });
    check(`${size}: details are escaped`, !html.includes('<img') && html.includes('&lt;img'));
  }
}
{
  const { html } = CardSheet.html(KEY, { ...base, size: 'page', incident: '', incidentNo: '', custodian: '' });
  check('blank details print as —', count(strip(html), /—/g) >= 3);
}
console.log(fail ? fail + ' FAILURES' : 'ALL PASS');
process.exit(fail ? 1 : 0);

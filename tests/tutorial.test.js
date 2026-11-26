// Run: node tests/tutorial.test.js
// Tutorial: the two-page card holder sheet. It must never use a real key, and its examples must agree with its example card.
const Tutorial = require('../src/tutorial.js');
const VA = require('../src/core.js');
let fail = 0;
const check = (name, ok, detail = '') => { if (!ok) { fail++; console.log('FAIL', name, detail); } else console.log('ok  ', name); };
const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const e = Tutorial.example();
const testCard = VA.card(VA.enc('12345678901234567890'), e.no);

check('example uses the published test key (fingerprint 6ED6)', e.fp === '6ED6');
check('example daily code is the test card\'s code for that day', e.daily === testCard.dailyCode(e.day));
check('example responses come from the test card', testCard.respond(e.ch1).response === e.r1 && testCard.respond(e.ch2).response === e.r2);
check('the two example challenges differ', e.ch1 !== e.ch2);

for (const size of ['page', 'badge']) {
  const html = Tutorial.html({ size, custodian: 'J. Lee' });
  const text = strip(html);
  check(`${size}: two pages`, (html.match(/class="tut-page"/g) || []).length === 2);
  check(`${size}: stamped EXAMPLE CARD — NOT VALID`, text.includes('EXAMPLE CARD — NOT VALID'));
  check(`${size}: draws the example card in that size`, size === 'badge' ? /class="badge-pair"/.test(html) : /class="card"/.test(html));
  check(`${size}: quotes the example daily code and a challenge/response`, text.includes(VA.phon(e.daily)) && text.includes(e.ch1) && text.includes(e.r1));
  check(`${size}: always-challenge rule`, /always challenge before acting/i.test(text));
  check(`${size}: fingerprint check`, /Check the fingerprint/.test(text));
  check(`${size}: custodian name and How to reach line`, text.includes('J. Lee') && text.includes('How to reach'));
  check(`${size}: uses CONTEXT.md words, not avoided ones`, !/\b(operator|station)s?\b/i.test(text) && !/\bCOML\b|ICS 205|ATAK/.test(text), text.match(/\b(operator|station)s?\b/i));
}
{
  const evil = '<img src=x onerror=alert(1)>';
  const html = Tutorial.html({ size: 'page', custodian: evil });
  check('custodian text is escaped', !html.includes(evil) && html.includes('&lt;img'));
  check('no custodian leaves a blank to fill in', (Tutorial.html({ size: 'page' }).match(/tut-blank/g) || []).length === 2);
}
console.log(fail ? fail + ' FAILURES' : 'ALL PASS');
process.exit(fail ? 1 : 0);

// ===== Voice Auth tutorial: the printed sheet that teaches card holders how the cards work =====
// Tutorial.html({ size: 'page' | 'badge', custodian }) -> html for two pages (front: how your card works; back: on the radio).
// It never uses the real key: the example card is built from the published test key and stamped EXAMPLE — NOT VALID.
// Styles: tutorial.css. Words follow CONTEXT.md (card holder, key custodian, card in effect, daily code, challenge, response).
const Tutorial = (() => {
  const core = typeof VA !== 'undefined' ? VA : require('./core.js');
  const sheet = typeof CardSheet !== 'undefined' ? CardSheet : require('./cardsheet.js');
  const EXAMPLE_KEY = core.enc('12345678901234567890');   // published test key (see the spec): never a real key
  const EXAMPLE_CARD = 4, EXAMPLE_DAY = 21;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NUM = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
  const sayNo = (n) => String(n).split('').map((d) => NUM[+d]).join(' ');

  // Everything the examples quote, taken from the example card so the sheet always agrees with itself.
  function example() {
    const card = core.card(EXAMPLE_KEY, EXAMPLE_CARD);
    const [ch1, ch2] = card.challenges(2);
    return {
      fp: core.fingerprint(EXAMPLE_KEY), no: EXAMPLE_CARD, day: EXAMPLE_DAY, daily: card.dailyCode(EXAMPLE_DAY),
      ch1, r1: card.respond(ch1).response, ch2, r2: card.respond(ch2).response,
    };
  }

  function exampleCard(size, fp) {
    const { html } = sheet.html(EXAMPLE_KEY, { from: EXAMPLE_CARD, count: 1, challenges: 10, size, version: 1, fingerprint: fp,
      incident: 'EXAMPLE', incidentNo: '', custodian: 'Example custodian' });
    return `<div class="tut-example ${size}"><div class="tut-stamp">EXAMPLE CARD — NOT VALID</div><div class="tut-scale">${html}</div></div>`;
  }

  const say = (who, words, note = '') =>
    `<div class="tut-line"><b>${who}:</b> “${words}”${note ? `<span class="tut-note">${note}</span>` : ''}</div>`;

  function html(o = {}) {
    const size = o.size === 'badge' ? 'badge' : 'page';
    const e = example(), P = core.phon;
    const cust = o.custodian ? esc(o.custodian) : '<span class="tut-blank"></span>';
    const where = size === 'badge'
      ? 'Front: card number, fingerprint (FP) and the 31 daily codes. Back: the challenges and their responses.'
      : 'Top: card number, fingerprint (FP) and key custodian. Then the 31 daily codes, then the challenges and their responses.';

    const front = `<section class="tut-page">
      <div class="tut-hd"><h1>Voice Auth · How your card works</h1><span>For card holders · keep with your card</span></div>
      <p class="tut-lead">Your card lets you prove on the radio that you are who you say you are, and check that others are too.
        Anyone can say they're Command. Only someone holding the card in effect can give the right code.</p>
      ${exampleCard(size, e.fp)}
      <p class="tut-small">${where}</p>
      <div class="tut-cols">
        <div>
          <h2>1 · Use only the card in effect</h2>
          <p>The key custodian announces which card to use: <i>“Authentication is Card ${sayNo(e.no)}.”</i>
            That card stays in effect until a new card is announced. Cards have no dates or times on them.</p>
          <h2>2 · Check the fingerprint</h2>
          <p>Every card shows a fingerprint, such as <b>FP ${e.fp}</b>. When you receive a card, and whenever a new card is announced,
            check that it matches the fingerprint the key custodian announces (<i>“fingerprint ${P(e.fp)}”</i>).
            <b>If it doesn't match, don't use the card.</b> Tell the key custodian.</p>
          <h2>3 · Daily code: routine traffic</h2>
          <p>Find today's day of the month on your card. On day ${e.day} of the example card the daily code is
            <b>${e.daily}</b>, said <i>“Authentication ${P(e.daily)}.”</i> The receiving card holder checks it against the same day on their card.
            Near midnight, or when card holders are in different time zones, use the day the key custodian announces.</p>
        </div>
        <div>
          <h2>4 · Challenge and response: prove it now</h2>
          <p>To make someone prove they hold the card, pick an <b>unused</b> challenge from your card and send it:
            <i>“Authenticate ${P(e.ch1)}.”</i> They find ${e.ch1} on their card and answer with its response,
            <i>“${P(e.r1)}.”</i> If it matches your card (${e.ch1} → <b>${e.r1}</b>), they're authenticated.
            <b>Both of you strike that line.</b> A struck challenge is never used again, so a recording of it is useless.</p>
          <h2>5 · When you must challenge</h2>
          <p>A daily code can be overheard and repeated for the rest of the day. So <b>always challenge before acting on an order that is
            unusual, critical or life-safety</b> (an evacuation, moving a resource, shutting down a channel), or whenever the voice
            or the situation seems wrong.</p>
          <h2>6 · Wrong or no answer = NOT authenticated</h2>
          <p>Don't act on it. First confirm you're both on the same card (and day), then confirm by another path. See the back.</p>
        </div>
      </div>
    </section>`;

    const back = `<section class="tut-page">
      <div class="tut-hd"><h1>Voice Auth · On the radio</h1><span>Example card ${e.no}, day ${e.day} · not valid</span></div>
      <div class="tut-ex">
        <h2>A · Routine order with the daily code</h2>
        ${say('Command', `Engine 42, Command. Move to Staging Area 2. Authentication ${P(e.daily)}.`)}
        ${say('Engine 42', 'Command, Engine 42. Copy Staging Area 2, authentication good.', `Checked day ${e.day} on card ${e.no}: ${e.daily}. It matches.`)}
      </div>
      <div class="tut-ex">
        <h2>B · Unusual order: challenge first</h2>
        ${say('Caller', 'Medic 7, this is Command. Shut down and leave the scene immediately.')}
        ${say('Medic 7', `Command, Medic 7. Authenticate ${P(e.ch2)}.`, 'An unusual, life-safety order, so Medic 7 challenges before acting.')}
        ${say('Caller', P(e.r2), `Finds ${e.ch2} on card ${e.no}. The response is ${e.r2}.`)}
        ${say('Medic 7', 'Authentication good. Leaving the scene.', `Both strike the ${e.ch2} line.`)}
      </div>
      <div class="tut-ex">
        <h2>C · When it fails</h2>
        ${say('Medic 7', `Authenticate ${P(e.ch1)}.`)}
        ${say('Caller', 'MIKE TWO BRAVO.', `Wrong: card ${e.no} says ${e.ch1} → ${e.r1}.`)}
        ${say('Medic 7', `Authentication failed. Confirm you are on Card ${sayNo(e.no)}.`)}
        <p class="tut-small">If the caller was on the wrong card, they change to the card in effect and you challenge again with a <b>new</b> line.
          If there's still no correct answer, <b>do not act</b>: confirm through another path (a known supervisor, a phone call, in person)
          and report a possible impostor to the key custodian.</p>
      </div>
      <div class="tut-rules">
        <h2>Rules</h2>
        <ul>
          <li><b>Lost or exposed card:</b> tell the key custodian at once. They will announce a new card or replace the key.</li>
          <li><b>Never reuse</b> a struck challenge. Running low on challenges? Tell the key custodian.</li>
          <li><b>Protect the card:</b> keep it on you. Don't photograph, copy or share it, and don't read it out except to authenticate.</li>
          <li><b>Destroy cards</b> (shred or burn) when the key custodian says they're no longer needed.</li>
        </ul>
      </div>
      <div class="tut-contact">
        <div><b>Key custodian</b>${cust}</div>
        <div><b>How to reach</b><span class="tut-blank"></span></div>
      </div>
      <div class="tut-nato">${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => `<span><b>${c}</b> ${P(c)}</span>`).join('')}</div>
    </section>`;

    return front + back;
  }

  return { html, example };
})();
if (typeof module !== 'undefined') module.exports = Tutorial;

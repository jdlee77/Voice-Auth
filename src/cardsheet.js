// ===== Voice Auth card sheet: the printed cards (full page or badge size) built by the custodian tool =====
// CardSheet.html(key, { from, count, challenges, size: 'page' | 'badge', version, fingerprint, incident, incidentNo, custodian })
//   -> { html, note }   html goes in #cards; note says what was built and how to print it. Styles: cardsheet.css.
// Full page: one page per card, with phonetics. Badge: 85.6 x 54 mm (ISO/IEC 7810 ID-1), front = all 31 daily codes,
// back = up to BADGE_MAX challenge/response pairs; no phonetics (they don't fit, and card holders read NATO phonetics anyway).
const CardSheet = (() => {
  const core = typeof VA !== 'undefined' ? VA : require('./core.js');
  const BADGE_MAX = 32;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');

  function badgeHtml(card, nCh, inc, incNo, version, fp) {
    const days = card.dailyCodes().map((c, i) => `<div><span>${pad2(i + 1)}</span>${c}</div>`).join('');
    const ch = card.challenges(Math.min(nCh, BADGE_MAX));
    const cols = ch.length <= 8 ? 1 : ch.length <= 16 ? 2 : ch.length <= 24 ? 3 : 4;
    const fs = ['9pt', '8.5pt', '7.5pt', '6.5pt'][cols - 1];
    const pairs = ch.map((x) => `<div>☐ ${x}<i>→</i>${card.respond(x).response}</div>`).join('');
    const top = `<div class="no"><small>CARD</small>${card.no}</div>
        <div class="meta"><div><b>CONTROLLED · VOICE AUTH</b></div><div>${inc}${incNo !== '—' ? ' · #' + incNo : ''}</div><div>Key v${version} · FP ${fp}</div></div>`;
    return `<div class="badge-pair">
      <div class="badge front"><div class="top">${top}</div>
        <h4>Daily codes · day of month</h4><div class="days">${days}</div>
        <div class="rule">Use only the card announced by the custodian. Wrong code or response = NOT authenticated. Report a lost card at once.</div></div>
      <div class="badge back"><div class="top">${top}</div>
        <h4>Challenge → response · strike after use</h4><div class="pairs" style="grid-template-columns:repeat(${cols},auto);justify-content:space-around;--fs:${fs}">${pairs}</div>
        <div class="rule">Never reuse a struck challenge. Unsure? Confirm the card and day, then confirm by another path.</div></div>
    </div>`;
  }

  function pageHtml(card, nCh, inc, incNo, cust, version, fp) {
    const codes = card.dailyCodes().map((oc, i) =>
      `<div><span class="ln">Day ${pad2(i + 1)}</span><b>${oc}</b><i>${core.phon(oc)}</i></div>`).join('');
    const ch = card.challenges(nCh), half = Math.ceil(ch.length / 2);
    const tbl = (list) => `<table><tr><th></th><th>Challenge</th><th>Response</th></tr>${list.map((x) => {
      const r = card.respond(x).response;
      return `<tr><td class="box">☐</td><td><b>${x}</b> <span>${core.phon(x)}</span></td><td><b>${r}</b> <span>${core.phon(r)}</span></td></tr>`; }).join('')}</table>`;
    return `<div class="card">
        <div class="banner">CONTROLLED · VOICE AUTHENTICATION CARD</div>
        <div class="hd">
          <div class="cardno"><b>Card</b>${card.no}</div>
          <div><b>Incident</b>${inc}<br><b style="margin-top:4px">Incident #</b>${incNo}</div>
          <div><b>Key</b>v${version} · FP ${fp}<br><b style="margin-top:4px">Key custodian</b>${cust}</div>
        </div>
        <h3>1 · Daily order codes: use the code for today's day of the month. Sender says "Auth KILO BRAVO"; receiver checks it against today</h3>
        <div class="codes">${codes}</div>
        <h3>2 · Challenge / response: pick an unused challenge, strike it after use</h3>
        <div class="cr">${tbl(ch.slice(0, half))}${tbl(ch.slice(half))}</div>
        <div class="ft"><b>Rules:</b> Use only the card number announced by the key custodian. It stays in effect until a new card is announced. Around midnight, or when units are in different time zones, the day announced by the key custodian governs. Strike each challenge line after use and never reuse it. A wrong code or response means NOT authenticated: first confirm you are on the same card and day, then confirm by another path. Do not act on unauthenticated traffic. Report a lost card immediately to the key custodian, who will switch cards or rotate the key.</div>
      </div>`;
  }

  function html(key, o) {
    const badge = o.size === 'badge';
    const inc = esc(o.incident || '—'), incNo = esc(o.incidentNo || '—'), cust = esc(o.custodian || '—');
    const fp = esc(o.fingerprint), version = esc(o.version);
    let out = '';
    for (let no = o.from; no < o.from + o.count; no++) {
      const card = core.card(key, no);
      out += badge ? badgeHtml(card, o.challenges, inc, incNo, version, fp) : pageHtml(card, o.challenges, inc, incNo, cust, version, fp);
    }
    const note = `Card${o.count > 1 ? 's' : ''} ${o.from}${o.count > 1 ? '–' + (o.from + o.count - 1) : ''} built for key v${o.version} (FP ${o.fingerprint}). `
      + (badge ? `Badge size, 4 per page${o.challenges > BADGE_MAX ? `, first ${BADGE_MAX} challenges` : ''}. Print at 100% scale (Actual size), cut on the solid outline and fold on the dashed line.`
        : 'One page per card.');
    return { html: out, note };
  }

  return { html };
})();
if (typeof module !== 'undefined') module.exports = CardSheet;

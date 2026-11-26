// ===== Voice Auth setup slides: a guided first-time setup for the key custodian =====
// Each slide is a real step: it fills the main screen's fields and runs its buttons (through window.VAApp in app.js),
// so when the last slide is done the cards are ready to print. Opens on start unless the custodian chose
// "Skip, I know the tool" on this computer (remembered in localStorage); the Setup guide button reopens it.
(() => {
  const $ = (id) => document.getElementById(id);
  const SKIP_KEY = 'voiceauth.skipSetup';
  const remembered = {
    get: () => { try { return localStorage.getItem(SKIP_KEY) === '1'; } catch (e) { return false; } },
    set: () => { try { localStorage.setItem(SKIP_KEY, '1'); } catch (e) { /* storage blocked: just don't remember */ } },
  };
  const STEPS = ['welcome', 'incident', 'key', 'save', 'fp', 'cards', 'print'];
  let at = 0;

  // The save step only applies to a newly generated key; an imported key already has its key file.
  const steps = () => STEPS.filter((s) => s !== 'save' || VAApp.source() !== 'import');
  const step = () => steps()[Math.min(at, steps().length - 1)];

  // Fields on the slides mirror fields on the main screen.
  const MIRROR = { oIncName: 'incName', oIncNo: 'incNo', oCust: 'custodian', oFrom: 'fromCard', oCount: 'cardCount', oNch: 'nCh' };
  function pullFields() {
    Object.entries(MIRROR).forEach(([o, m]) => { $(o).value = $(m).value; });
    document.querySelectorAll('input[name="oSize"]').forEach((r) => { r.checked = r.value === $('cardSize').value; });
  }
  const push = (mainId, value) => { $(mainId).value = value; $(mainId).dispatchEvent(new Event('change')); };
  Object.entries(MIRROR).forEach(([o, m]) => $(o).addEventListener('input', () => { push(m, $(o).value); render(); }));
  document.querySelectorAll('input[name="oSize"]').forEach((r) => r.addEventListener('change', () => { push('cardSize', r.value); render(); }));

  function canNext(s) {
    if (s === 'key') return VAApp.hasKey();
    if (s === 'save') return VAApp.exported();
    return true;
  }

  function render() {
    const list = steps(), s = step(), badge = $('cardSize').value === 'badge';
    at = list.indexOf(s);
    document.querySelectorAll('.onb-slide').forEach((el) => { el.hidden = el.dataset.step !== s; });
    $('onbDots').innerHTML = list.map((x, i) => `<i class="${i === at ? 'on' : i < at ? 'done' : ''}"></i>`).join('');
    $('onbStep').textContent = at === 0 ? '' : `Step ${at} of ${list.length - 1}`;
    $('onbBack').hidden = at === 0;
    $('onbSkip').hidden = at !== 0;
    $('onbNext').textContent = at === 0 ? 'Start setup' : s === 'print' ? 'Finish' : 'Next';
    $('onbNext').disabled = !canNext(s);

    const fp = VAApp.fingerprint();
    $('oKeyStatus').innerHTML = VAApp.hasKey()
      ? `<span class="ok">✔ Key loaded</span> (${VAApp.source() === 'import' ? 'imported from a key file' : 'new key'}, version ${VAApp.version()}, fingerprint <b>${fp}</b>)`
      : 'No key yet. Choose one of the options above.';
    $('oSaveStatus').innerHTML = VAApp.exported()
      ? '<span class="ok">✔ Key file saved.</span> Keep it with the key custodian: an encrypted USB drive, never email.'
      : 'You can\'t continue until the key file is saved. Without it, these cards can never be reprinted.';
    $('oFp').textContent = fp || '----';
    $('oFpSay').textContent = fp ? VA.phon(fp) : '';
    $('oBadgeNote').hidden = !badge;
    $('oPrintBadge').hidden = !badge;
    const from = +$('fromCard').value || 1, n = +$('cardCount').value || 1;
    $('oSummary').innerHTML = `<b>${n === 1 ? 'Card ' + from : `Cards ${from}–${from + n - 1}`}</b>, ${badge ? 'badge size (4 per page)' : 'full page'},
      ${$('nCh').value} challenges each${badge && +$('nCh').value > 32 ? ' (badges fit the first 32)' : ''}. Key fingerprint <b>${fp}</b>.`;
  }

  function go(delta) {
    const list = steps();
    if (delta > 0 && !canNext(step())) return;
    if (delta > 0 && step() === 'print') return close();
    at = Math.max(0, Math.min(list.length - 1, at + delta));
    render();
    const first = document.querySelector(`.onb-slide[data-step="${step()}"] input, .onb-slide[data-step="${step()}"] button`);
    if (first) first.focus();
  }
  function open() { pullFields(); at = 0; $('onb').hidden = false; render(); $('onbNext').focus(); }
  function close() { $('onb').hidden = true; }

  $('onbNext').onclick = () => go(1);
  $('onbBack').onclick = () => go(-1);
  $('onbSkip').onclick = () => { remembered.set(); close(); };
  $('onbClose').onclick = close;
  $('btnGuide').onclick = open;
  $('onb').addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  $('oNew').onclick = () => VAApp.newKey();
  $('oImport').onclick = () => VAApp.importKey();
  $('oSave').onclick = () => VAApp.exportKey();
  $('oPrintCards').onclick = () => VAApp.printCards();
  $('oPrintTut').onclick = () => VAApp.printTutorial();

  // A key change (new, imported, saved) may fill fields from the key file and changes which steps apply.
  VAApp.onChange(() => { if (!$('onb').hidden) { pullFields(); render(); } });

  if (!remembered.get()) open();
})();

# Voice Auth: project briefing for Claude Code

## Who you're working with

Jon Lee, Oregon's Statewide Interoperability Coordinator (SWIC) and an All-Hazards COML. He is not a software developer: explain terms and processes in plain language, and keep him informed of decisions.

## What this is

An offline tool for **radio voice authentication** on public safety interop channels. It defends against spoofing: impersonators issuing fake orders, such as false evacuation orders. The team is **nationwide**, so nothing may depend on time zones.

There is one deliverable, built from `src/` by `build.py`:

| File | What it is |
|---|---|
| `voice-auth.html` / `index.html` | **Custodian tool.** Generates the key, exports and imports the key file, and prints cards. It's a single self-contained offline file, and checks itself against test vectors when it opens. `index.html` is the GitHub Pages copy. |
| Printed cards | From the custodian tool, in one of two sizes. **Full page:** one page per card, with phonetics. **Badge:** 85.6 × 54 mm (credit card size), four to a page, with the daily codes on the front and up to 32 challenge/response pairs on the back. Badges are cut on the solid outline and folded on the dashed line, and must be printed at 100% scale. Paper is the only medium (PACE). |

## Removed at Jon's request: don't bring back without asking

- **Card console** (November 2026): its look-up/check boxes were confusing.
- **Phone enrollment, the phone card app (`/card/`) and far-end printing (`/print/`)** (November 2026): the enrollment QR code and passphrase, the installable phone app with PIN and device key, and the page where a far end printed its own cards. Jon chose to do nothing to phones that had already installed the app. They keep working offline with the key they had until the custodian **rotates the key**.

## Card design: decided, don't change without asking

- **Cards are numbered and time-free.** The key custodian (usually the COML) announces "Authentication: Card Four". It stays in effect until a new card is announced. There are no dates, times or time zones on cards. Jon explicitly rejected time-based, op-period, card-day and UTC-grid designs.
- **Daily codes:** 31 per card, one for each day of the month (Day 01–31). Each is **two letters**, read in NATO phonetics ("SIERRA HOTEL"). Near midnight, or when units are in different time zones, the day announced by the custodian governs. The printed full-page card still calls them "daily order codes".
- **Challenge/response:** letter-digit-letter format (e.g. A3C → I7J). There are 10 printed challenges per card by default, and each line is struck after use.
- Keep the terms ATAK, ICS 205 and COML out of the app's UI. Jon wants it standalone and generic. "Key custodian" is the UI term.
- Domain terms (key, fingerprint, card, daily code, challenge, response) are defined in `CONTEXT.md`. Use them as written there.

## Algorithm (see the spec in the app, section 4, and `tests/test.js`)

- **Key:** 20 random bytes, exchanged as Base32. The fingerprint is the first 2 bytes of SHA-256(key), in hex.
- **Card label:** `"CARD-" + N`.
- **Daily codes:** `HMAC-SHA256(key, "VAUTH1-O|" + label + "|" + i)` → `((h0<<8)|h1) mod 676` → two letters. Duplicates within a card are skipped. The d-th distinct code is day d.
- **Response:** `HMAC-SHA256(key, "VAUTH1-R|" + label + "|" + CH)` → `((h0<<16)|(h1<<8)|h2) mod 6760` → letter-digit-letter. Printed challenges use `"VAUTH1-C|"…`, skipping duplicates.
- **Test vectors:** key = ASCII "12345678901234567890". Card 1 days 1–3 are RZ, YB, WT. Challenges are A6A, W2F, X8O. A3C → I7J. Fingerprint 6ED6.
- **Never change derivation strings or mappings.** Doing so silently invalidates every printed card. If a change is truly needed, add a new versioned scheme. `tests/test.js` checks every code on cards 1, 7 and 9999 against a fixture made before the code was restructured.

## Files

- `src/core.js`: pure-JS SHA-256, HMAC and Base32, and the card derivation (`VA`).
  - `VA.card(key, no)` returns `{ no, dailyCode(day), dailyCodes(), challenges(n), respond(challenge) }`.
  - `VA.selfTest()` returns `{ ok, failed }` and checks the fixed test vectors.
- `src/cardsheet.js` + `src/cardsheet.css`: the printed cards (full page and badge) and their print styles. `CardSheet.html(key, options)` returns `{ html, note }`.
- `src/app.js` + `src/template.html`: the custodian tool (key, key file, card settings, preview, self-test and spec).
- `tests/test.js`: hashes against Node's crypto, the self-test, and the printed-card fixture and card properties. `tests/cardsheet.test.js`: printed card contents in both sizes, and escaping of incident and custodian text.
- `CONTEXT.md`: the glossary of domain terms.

## Rules

- **Build and test before every commit:** `python3 build.py && node tests/test.js && node tests/cardsheet.test.js`. Commit the built files too, because GitHub Pages serves them from `main`.
- Pages must stay **self-contained and offline**: inline scripts only and no CDNs. Keep the strict CSP meta tag (`connect-src 'none'`). If the CSP blocks something, fix the code, not the policy.
- **Never commit key files.** `*.json` is git-ignored on purpose. The repo is **public**.
- To check behavior, test in a real browser (e.g. Playwright against `python3 -m http.server`). For printing, check the badge size (85.6 × 53.98 mm) and print to PDF.
- **Workflow:** work on a branch, push, and open a PR. Jon merges from his phone, often quickly, so check whether the last PR has merged before adding to its branch.
- Commit trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Open items (ask Jon before starting)

1. **Card-sharing security** was proposed and not yet built:
   - Passphrase-encrypted key file export.
   - Per-incident keys derived from a master key, so card numbers aren't reused across incidents.
   - Copy numbering plus a hand-receipt sheet.
   - Printing the recipient's name on cards.
   - A published SHA-256 hash for each release.
2. **Key file handling** (from an architecture review): the key file is written in one click handler in `app.js` and read in another, and no test checks that it reads back. Import accepts a file with no fingerprint, and doesn't check the version or challenge count. A key file module with round-trip tests was proposed.
3. **Possible 3-letter daily codes.** Two letters means 1-in-676 guessing odds, and a daily code can be replayed for the rest of its day.
4. **The custodian tool isn't installable.** It works offline when saved as a file.
5. **ATAK plugin: a later phase.** It must implement the exact same spec.

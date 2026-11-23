# Voice Auth: project briefing for Claude Code

## Who you're working with

Jon Lee, Oregon's Statewide Interoperability Coordinator (SWIC) and an All-Hazards COML. He is not a software developer: explain terms and processes in plain language, and keep him informed of decisions.

## What this is

An offline tool for **radio voice authentication** on public safety interop channels. It defends against spoofing: impersonators issuing fake orders, such as false evacuation orders. The team is **nationwide**, so nothing may depend on time zones.

There are three deliverables, all built from `src/` by `build.py`:

| File | What it is |
|---|---|
| `voice-auth.html` / `index.html` | **Custodian tool.** Generates the key, prints cards, runs a card console, and creates phone enrollment QR codes. Single self-contained offline file. `index.html` is the GitHub Pages copy. |
| `card/` | **Phone card.** An installable web app (manifest + service worker) at https://jdlee77.github.io/Voice-Auth/card/ that shows the same codes as the paper card. |
| Printed cards | One page per card, from the custodian tool. Paper is always the backup (PACE). |

## Card design: decided, don't change without asking

- **Cards are numbered and time-free.** The key custodian (usually the COML) announces "Authentication: Card Four". It stays in effect until a new card is announced. There are no dates, times or time zones on cards. Jon explicitly rejected time-based, op-period, card-day and UTC-grid designs.
- **Daily order codes:** 31 per card, one for each day of the month (Day 01–31). Each is **two letters**, read in NATO phonetics ("SIERRA HOTEL"). Near midnight, or when units are in different time zones, the day announced by the custodian governs.
- **Challenge/response:** letter-digit-letter format (e.g. A3C → I7J). There are 10 printed challenges per card by default, and each line is struck after use. The phone can answer *any* challenge.
- Keep the terms ATAK, ICS 205 and COML out of the app's UI. Jon wants it standalone and generic. "Key custodian" is the UI term.

## Algorithm (see the spec in the app, section 6, and `tests/test.js`)

- **Key:** 20 random bytes, exchanged as Base32. The fingerprint is the first 2 bytes of SHA-256(key), in hex.
- **Card label:** `"CARD-" + N`.
- **Daily codes:** `HMAC-SHA256(key, "VAUTH1-O|" + label + "|" + i)` → `((h0<<8)|h1) mod 676` → two letters. Duplicates within a card are skipped. The d-th distinct code is day d.
- **Response:** `HMAC-SHA256(key, "VAUTH1-R|" + label + "|" + CH)` → `((h0<<16)|(h1<<8)|h2) mod 6760` → letter-digit-letter. Printed challenges use `"VAUTH1-C|"…`, skipping duplicates.
- **Test vectors:** key = ASCII "12345678901234567890". Card 1 days 1–3 are RZ, YB, WT. Challenges are A6A, W2F, X8O. A3C → I7J. Fingerprint 6ED6.
- **Never change derivation strings or mappings.** Doing so silently invalidates every printed card. If a change is truly needed, add a new versioned scheme.
- **Phone enrollment code:** `VAUTH1.salt.iter.iv.ct`, using AES-256-GCM with PBKDF2-SHA256 (310k iterations) from the custodian's passphrase. On the phone, the key is wrapped by a PIN-derived key *and* a non-extractable WebCrypto device key in IndexedDB. 5 wrong PINs erase it. The phone auto-locks after 2 minutes idle or when the page is hidden.

## Files

- `src/core.js`: pure-JS SHA-1/SHA-256/HMAC/Base32 and the card derivation (`VA`). It also still contains unused TOTP helpers from earlier designs.
- `src/vault.js`: WebCrypto passphrase/PIN encryption (`Vault`).
- `src/app.js` + `src/template.html`: the custodian tool.
- `src/card.js` + `src/card.html`: the phone card.
- `src/pwa/`: manifest, icons, and the `sw.js` template. `build.py` stamps the cache version from a page hash.
- `src/vendor/`: qrcode-generator (MIT) and jsQR (Apache-2.0).

## Rules

- **Build and test before every commit:** `python3 build.py && node tests/test.js`. Commit the built files too, because GitHub Pages serves them from `main`.
- Pages must stay **self-contained and offline**: inline scripts only and no CDNs. Keep the strict CSP meta tags (`connect-src 'none'`). If the CSP blocks something, fix the code, not the policy.
- **Never commit key files.** `*.json` is git-ignored on purpose. The repo is **public**.
- To check behavior, test in a real browser (e.g. Playwright against `python3 -m http.server`). The service worker needs `localhost` or https.
- **Workflow:** work on a branch, push, and open a PR. Jon merges from his phone.
- Commit trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Open items (ask Jon before starting)

1. **Phone vs paper confusion.** Jon reported that the phone's challenge responses didn't match the paper. Testing showed they match exactly when both use the same key and card. The cause was most likely a different key or card number. Proposed fixes, not yet approved:
   - Show the printed challenge list on the phone, with strike boxes.
   - Show the key fingerprint in large type on the phone card screen and the enrollment QR screen.
2. **Card-sharing security** was proposed and not yet built:
   - Passphrase-encrypted key file export.
   - Per-incident keys derived from a master key, so card numbers aren't reused across incidents.
   - Copy numbering plus a hand-receipt sheet.
   - Printing the recipient's name on cards.
   - A published SHA-256 hash for each release.
3. **Possible 3-letter daily codes.** Two letters means 1-in-676 guessing odds, and a daily code can be replayed for the rest of its day.
4. **The custodian tool isn't installable.** Only `/card/` is.
5. **ATAK plugin: a later phase.** It must implement the exact same spec.

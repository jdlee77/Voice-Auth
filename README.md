# Voice Auth

Offline tool for printing numbered radio voice authentication cards.

**Use it online:** https://jdlee77.github.io/Voice-Auth/. To use it offline, save the page from your browser, or download `voice-auth.html` from this repository.

Open it in Chrome, Edge or Firefox. It runs entirely in the browser with no network access. The page blocks all outside connections, and nothing is saved when it closes.

## What a card contains

- **Card number.** The key custodian announces which card is in effect ("Authentication: Card Four"). It stays in effect until a new card is announced. Cards carry no times or time zones.
- **Daily order codes.** 31 two-letter codes, one for each day of the month. The sender says "Auth SIERRA HOTEL" and the receiver checks it against today's code.
- **Challenge / response.** Letter-number-letter pairs (e.g. challenge A3C → response I7J). Each line is struck after one use.

## Phone card (no app to install)

Phones can show the same cards using **https://jdlee77.github.io/Voice-Auth/card/**. It can be installed to the home screen like an app, with no app store, and once installed it opens with no signal.

**Install it first, then enroll from the installed app.** On iPhone, an installed web app has its own storage, so a key set up in Safari does not carry over.

- **iPhone (Safari):** open the link, tap **Share → Add to Home Screen**, then open **Voice Auth** from the home screen.
- **Android (Chrome):** open the link and tap **Install app** on the page (or **⋮ → Install app**), then open it from the home screen.

Then:

1. **Create an enrollment QR code.** The custodian goes to section 3 of the tool and sets a passphrase. The QR code holds the key, encrypted with that passphrase (AES-256-GCM, PBKDF2-SHA256 with 310,000 iterations).
2. **Enroll the phone.** The user opens `/card/`, scans the QR code (or uses a photo of it, or pastes the code) and enters the passphrase. Give the QR code and passphrase separately.
3. **Choose a PIN.** The user picks a 6–12 digit PIN. The key is stored on the phone, encrypted with the PIN and with a device wrapping key that page scripts can't read out. 5 wrong PINs in a row erase it.
4. **Use the card.** It shows the card in effect, today's daily code, and the response to **any** challenge. The page locks after 2 minutes idle or when you leave it.

The phone card checks itself against fixed test vectors each time it opens, and refuses to run if any fail.

Limits:
- Installed: opens and works with no signal. In the browser only: needs a connection to open.
- If used in the iPhone browser instead of installed, Safari may clear the stored key after about 7 days without a visit.
- Updates: when the page changes, the installed app picks up the new version the next time it's opened with a connection, and uses it from the following launch.
- Browser storage is weaker than a native app's secure storage, so treat a lost phone like a lost card: the custodian switches cards or rotates the key.

## Using the tool

1. **Generate a key.** Then export the key file and keep it under the custodian's control. Without it, cards can't be reprinted.
2. **Choose and print.** Pick the cards to print, then print or save them as PDF. You get one page per card, or choose **Card size: Badge** for credit-card-size cards (85.6 × 54 mm) to carry with an ID badge: four to a page, daily codes on the front and challenge/response on the back. Print at 100% scale (Actual size), cut on the solid outline and fold on the dashed line. Badge cards hold up to 32 challenges and leave out the phonetics.
3. **Use the card console.** It looks up or checks a daily code for any card and day, and answers challenges.
4. **Rotate the key if a set of cards is lost.**

## Security notes

- Codes are derived from a 160-bit random key with HMAC-SHA256. The full algorithm and test vectors are in the app (section 5).
- Guessing odds: 1 in 676 for a daily code, 1 in 6,760 for a challenge response. A daily code can be replayed for the rest of its day by anyone who overhears it, so use challenge/response for critical orders.
- Switch cards at least monthly, because daily codes repeat each month on the same card.
- The printed cards and the key file are controlled items. Never commit a key file to this repository.

## Third-party code

- `src/vendor/qrcode-generator.js`: QR code generation (MIT, Kazuhiko Arase)
- `src/vendor/jsQR.js`: QR code scanning (Apache-2.0, see `src/vendor/jsQR.LICENSE`)

## Development

The page is built from `src/`:

```
python3 build.py      # writes voice-auth.html, index.html and card/ (page, manifest, icons, service worker)
node tests/test.js    # crypto and test-vector checks
node tests/devicekey.test.js   # device key: PIN unlock, 5-wrong-PIN erase, stored format
node tests/enrollmentcode.test.js   # enrollment code: seal/open, failure cases, codes already handed out
```

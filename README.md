# Voice Auth

Offline tool for printing numbered radio voice authentication cards.

**Use it online:** https://jdlee77.github.io/Voice-Auth/. To use it offline, save the page from your browser, or download `voice-auth.html` from this repository.

Open it in Chrome, Edge or Firefox. It runs entirely in the browser with no network access. The page blocks all outside connections, and nothing is saved when it closes.

## What a card contains

- **Card number.** The key custodian announces which card is in effect ("Authentication: Card Four"). It stays in effect until a new card is announced. Cards carry no times or time zones.
- **Daily order codes.** 31 two-letter codes, one for each day of the month. The sender says "Auth SIERRA HOTEL" and the receiver checks it against today's code.
- **Challenge / response.** Letter-number-letter pairs (e.g. challenge A3C → response I7J). Each line is struck after one use.

## Using the tool

The first time you open the tool, **setup slides** walk you through it: name the incident, make or load the key, save the key file, note the fingerprint, choose your cards, and print. Choose **Skip, I know the tool** to stop them opening on that computer; the **Setup guide** button brings them back.

1. **Generate a key.** Then export the key file and keep it under the custodian's control. Without it, cards can't be reprinted.
2. **Choose and print.** Pick the cards to print, then print or save them as PDF. You get one page per card, or choose **Card size: Badge** for credit-card-size cards (85.6 × 54 mm) to carry with an ID badge: four to a page, daily codes on the front and challenge/response on the back. Print at 100% scale (Actual size), cut on the solid outline and fold on the dashed line. Badge cards hold up to 32 challenges and leave out the phonetics.
3. **Print the tutorial for card holders.** It's one sheet (print it double-sided) explaining the card in effect, the fingerprint check, daily codes, challenge and response, and what to do when authentication fails. It shows an example card made from the published test key, never your key.
4. **Rotate the key if a set of cards is lost.**

## Security notes

- Codes are derived from a 160-bit random key with HMAC-SHA256. The full algorithm and test vectors are in the app (section 4).
- Guessing odds: 1 in 676 for a daily code, 1 in 6,760 for a challenge response. A daily code can be replayed for the rest of its day by anyone who overhears it, so use challenge/response for critical orders.
- Switch cards at least monthly, because daily codes repeat each month on the same card.
- The printed cards and the key file are controlled items. Never commit a key file to this repository.

## Development

The page is built from `src/`:

```
python3 build.py      # writes voice-auth.html and index.html
node tests/test.js    # crypto and test-vector checks
node tests/cardsheet.test.js   # printed cards (full page and badge)
node tests/tutorial.test.js    # card holder tutorial
```

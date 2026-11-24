# Voice Auth

Radio voice authentication: a key custodian issues numbered cards, and operators prove who they are on air with codes derived from a shared key.

## Language

### Keys and cards

**Key**:
The shared secret held by the key custodian, from which every card's codes are derived.
_Avoid_: secret, master key

**Fingerprint**:
A short code derived from a key, read aloud so everyone can confirm they hold the same key.

**Card**:
One numbered set of daily codes and challenge/response pairs, all derived from the key and the card number.

**Daily code**:
The two-letter code a card gives for one day of the month (1 to 31); the sender says it to prove they hold the card in effect.
_Avoid_: order code, order line

**Challenge**:
A letter-digit-letter group (such as A3C) one station sends to make the other prove it holds the card in effect.

**Response**:
The letter-digit-letter group a card gives for a challenge; each printed challenge is struck after one use.

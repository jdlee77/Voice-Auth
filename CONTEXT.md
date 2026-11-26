# Voice Auth

Radio voice authentication: a key custodian issues numbered cards, and card holders prove who they are on air with codes derived from a shared key.

## Language

### People

**Key custodian**:
The person who holds the key, prints and issues cards, and announces which card is in effect.
_Avoid_: COML (in the tool and printed material), admin, issuer

**Card holder**:
A person issued a card who uses it to authenticate on the radio.
_Avoid_: operator, station, user

### Keys and cards

**Key**:
The shared secret held by the key custodian, from which every card's codes are derived.
_Avoid_: secret, master key

**Fingerprint**:
A short code derived from a key, read aloud so everyone can confirm they hold the same key.

**Card**:
One numbered set of daily codes and challenge/response pairs, all derived from the key and the card number.

**Card in effect**:
The card number the key custodian has announced for use; it stays in effect until a new card is announced.
_Avoid_: current card, active card, today's card

**Rotate**:
To replace the key with a new one, which makes every card printed from the old key useless.
_Avoid_: rekey, reset

**Daily code**:
The two-letter code a card gives for one day of the month (1 to 31); the sender says it to prove they hold the card in effect.
_Avoid_: order code, order line

**Challenge**:
A letter-digit-letter group (such as A3C) one station sends to make the other prove it holds the card in effect.

**Response**:
The letter-digit-letter group a card gives for a challenge; each printed challenge is struck after one use.

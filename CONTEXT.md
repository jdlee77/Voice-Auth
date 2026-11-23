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

### Phone card

**Enrollment code**:
A key sealed with a passphrase so it can travel from the custodian to a phone, shown as a QR code.
_Avoid_: enrollment QR (the QR is just how it is displayed)

**Passphrase**:
The secret of at least 12 characters the custodian sets to seal an enrollment code, given to the user separately from the code.
_Avoid_: password, PIN

**Device key**:
The key as stored on one enrolled phone, locked by the user's PIN and erased after 5 wrong PINs in a row.
_Avoid_: stored key, phone vault

**Device wrapping key**:
A key that the phone generates when it enrolls and that cannot be read out of that phone; the device key is also locked with it, so a copy of the stored data is useless elsewhere.
_Avoid_: device key (that term means the enrolled key itself)

**PIN**:
The 6 to 12 digits the user chooses to unlock the device key on their phone.
_Avoid_: passphrase (that protects the enrollment code)

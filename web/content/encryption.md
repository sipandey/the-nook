# How your journal is actually encrypted

Not “we encrypt data in transit and at rest” — that’s true of almost every app and tells you almost nothing, since the operator usually holds the key too. Here’s the specific, checkable claim: entries are encrypted on your device, with a key derived from a passphrase only you know, before anything is sent anywhere. The server stores ciphertext it cannot read.

> **The threat model**
>
> The goal is that the operator — the database, the backend code, and anyone who compromises either, including us, under a data breach or a legal demand — cannot read your journal entries. That’s the bar this is designed against.

### 1. Two separate secrets, on purpose

Your account password (used to sign in) and your journal passphrase (used to unlock your entries) are deliberately different secrets. Resetting your account password never gives anyone access to your journal — only the passphrase does that, and it never leaves your device.

### 2. Your passphrase never touches a server

When you set your journal passphrase, your device runs it through Argon2id (a deliberately slow, memory-hard function built to resist brute-force and GPU cracking) to derive an encryption key. That derivation happens entirely in your browser. The passphrase itself is never transmitted.

### 3. A separate random key actually encrypts your entries

Your device generates a random 256-bit key (the “data key”) once, and that’s what encrypts and decrypts your entries with AES-256-GCM — an authenticated cipher, so tampering with stored ciphertext is detectable, not just unreadable. The passphrase-derived key doesn’t encrypt your entries directly; it “wraps” (encrypts) this data key, so changing your passphrase later doesn’t mean re-encrypting your whole journal.

### 4. What actually sits on the server

Only ciphertext: the wrapped data key, and each entry’s encrypted content. A handful of fields stay in the clear because the app genuinely needs to query them — mood score, tags, and timestamps — never the words you wrote. If our database were fully exposed tomorrow, an attacker would have encrypted blobs and some mood numbers and dates, not your journal.

### 5. A recovery phrase is the only backup — by design

There is no “forgot your journal passphrase” server-side reset. That’s not an oversight; a resettable passphrase would mean someone other than you could eventually get in. The one backup path is a 12-word recovery phrase, shown once when you set things up, which wraps the same data key under a second, independently-derived key. Lose both the passphrase and the recovery phrase, and the entries are permanently unreadable — including to us.

### 6. AI features are the one place plaintext exists off your device — briefly

To generate a daily prompt or a playback story, your device decrypts the relevant entries locally, then sends that plaintext over an encrypted connection to a serverless function for exactly one request to OpenAI. That function is built not to log or persist what it receives, and OpenAI processes it as part of generating the response, not to train on it as a matter of policy for API traffic. This is a real, deliberate exception to “we never see your plaintext” — named here plainly rather than glossed over, because a privacy claim you have to squint to find the caveat in isn’t an honest one.

## What this doesn’t protect against

This protects your journal from us and from anyone who compromises our infrastructure. It doesn’t protect you from someone who has your unlocked device in hand, from malware running on your own machine, or from choosing a weak, guessable passphrase — Argon2id makes brute-forcing expensive, not impossible against a trivial passphrase. Security is a chain; this is the strongest link we control, not a substitute for the ones you do.

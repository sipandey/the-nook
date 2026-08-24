The short version is on the [encryption page](/encryption): your entries are encrypted on your device before they reach us, and we cannot read them. This page covers everything else — what other data exists, who else touches it, and what your options are.

## What we collect

**Account information.** When you sign up, our authentication provider, Clerk, collects your email address and (if you use it) sign-in details from Google or Apple. We use this to identify your account; we don’t see or store your account password ourselves.

**Your journal content — encrypted.** Entry text and manifestation text are encrypted on your device before they’re sent to us. We store the ciphertext. We do not have the key.

**Metadata, in the clear.** A small set of fields are stored unencrypted because the app needs to query or display them: mood score, tags, entry and manifestation timestamps, your chosen AI tone (Coach/Friend/Mirror/Minimal), and your notification preferences. None of these reveal what you actually wrote.

**Nothing else.** We don’t run analytics or tracking scripts of any kind on this app, and we don’t have an advertising or “personalization” pipeline. There’s no marketing pixel counting your visits.

## Who else touches your data

**Clerk** — handles sign-in and account sessions. They see your email and authentication details; they never see your journal passphrase or your entries.

**Supabase** — hosts our database. They store your encrypted entries and the in-the-clear metadata above. They don’t have your encryption key either.

**OpenAI** — powers the optional AI features (daily prompts, playback story generation, voice transcription, manifestation-signal detection). To do this, your device decrypts the relevant entry text locally and sends it, over an encrypted connection, for that one request only. This is the one point where your written words exist outside your device, even briefly — see the [encryption page](/encryption) for the full detail. We don’t log or store what’s sent. If you never use the AI features, this never happens.

**Vercel** — hosts the app itself.

We don’t sell your data to anyone, for any reason. There is no data broker relationship, no ad network integration, and no data-sharing arrangement beyond the operational vendors named above.

## How long we keep it

Your account and journal data are kept for as long as your account exists. Deleting your account (see below) permanently removes everything — there is no “soft delete” or retained backup on our side once that finishes.

Content sent to OpenAI for an AI feature is not retained by us after that request completes.

## Your data, your options

**Export.** From Settings, you can decrypt and download your entire journal as a file, entirely on your device — we don’t need to be involved in generating it, since we never had the plaintext to begin with.

**Delete.** From Settings, you can permanently delete your account and all associated data. See [deleting your information](/delete-my-data) for exactly what that does and how to request it if you can’t sign in.

**Access and correction.** Because your entry content is encrypted with a key we don’t have, we can’t view or edit it on your behalf even if asked — the export and in-app editing tools are the access path. For the in-the-clear metadata (email, tags, mood scores, preferences), contact us at the address below and we’ll help directly.

If you’re in a jurisdiction with specific statutory privacy rights (for example, GDPR in the EU/UK, or CCPA/CPRA in California), the mechanisms above are how you exercise access, portability, and deletion in practice. If you believe you have a right this page doesn’t clearly address, contact us and we’ll work through it.

## Children’s privacy

The Nook isn’t directed at children, and we don’t knowingly collect information from anyone under 13. If you believe a child has created an account, contact us and we’ll delete it.

## Changes to this policy

If this policy changes in a way that matters to how your data is handled, we’ll update the date at the top of this page. Continuing to use the app after a change means you’ve accepted the update; if you don’t agree with a change, your options are the export and deletion tools described above.

## Contact

For anything on this page — access requests, deletion requests you can’t complete yourself, or a question this policy didn’t answer — reach us at [sipandey.sape006@gmail.com](mailto:sipandey.sape006@gmail.com).

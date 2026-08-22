# UX Design Brief — The Nook

Copy-paste this whole document as a prompt to a UX/UI design agent. It's self-contained: product context, brand constraints, every screen and scenario that needs designing, and what "done" looks like.

---

## The prompt

You are designing the complete visual UX for **The Nook**, a mobile-first, AI-assisted journaling app. A functional version already exists — a working Next.js app with every screen wired to real data, plus a low-fidelity design canvas that established the information architecture and interaction model. Your job is **not** to invent the product from scratch — it's to take the established IA and turn it into something genuinely beautiful, polished, and distinctive, while preserving every functional detail below (nothing here is decorative filler; each item reflects a real product or security decision).

### Reference materials (read these first)

- **Existing design canvas** (current low-fi mockups, all screens): https://claude.ai/code/artifact/36d63c97-7c7c-4fd6-8234-b35ea36ed857
- **Architecture & product spec** (data model, encryption model, full feature rationale): `docs/ARCHITECTURE.md` in this repo
- **What's actually built**: `web/README.md` in this repo

### Product in one paragraph

The Nook is a private journal that helps people see their own growth. You write (or speak) entries; the app plays them back to you — a story-format weekly/monthly/yearly recap, resurfaced "manifestations" (goals you wrote down, with the app quietly noticing when your own entries show real progress toward them), and a long-form archive you can search and re-read. Entries are encrypted client-side — the operator genuinely cannot read them, even under compulsion. That privacy model isn't a footnote; it should be legible and reassuring in the UI at the moments it matters, not buried in a settings page.

### Who uses this

Someone who already journals occasionally, or wants to but finds blank-page journaling apps sterile. They're trusting the app with genuinely private material. They are *not* looking for a productivity/streak-gamification app — reject any pattern that reads as guilt-tripping, streak-shaming, or "engagement-maximizing." Calm and trustworthy beats flashy and sticky.

### Brand constraints (already decided — work within these, don't relitigate)

- **Palette**: light, warm, calm "sage" direction — soft greens, cream, warm neutral text. Explicitly **not** violet/purple, not a dark-mode-first gradient look, not the generic "AI product" aesthetic (warm cream + serif + terracotta is also overused — feel free to push further than our current wireframes did).
- **Motif**: soft rolling hills at dawn/dusk, established as a recurring hero illustration across screens. You can evolve the *execution* (better illustration, more sophisticated gradients, subtle motion) but the "quiet nature, growth over time" metaphor should stay legible — it's doing real conceptual work (personal growth = landscape you're moving through).
- **Typography**: currently System UI/Geist by default — wide open for you to establish a real type system. Avoid Inter/Roboto/Arial as the whole system; this brand can support more character.
- **Tone options are user-selectable** (Coach / Friend / Mirror / Minimal) — the AI's voice changes, but the *visual* design should stay consistent across tone choices. Don't design four different visual moods.
- **Platform**: mobile-first PWA (installable web app), built in React/Next.js + Tailwind. Deliverables should be translatable into that stack — real spacing/type scale/color tokens, not just polish-for-polish's-sake.

### Non-negotiable UX principles (from how the product is actually built)

1. **No fake affordances.** Every element must reflect a real state. If there's no comparison data yet, that card doesn't render — it doesn't render empty or fake. If signal detection hasn't found anything, it says so honestly ("No signals detected yet"), never a manufactured number.
2. **Privacy reassurance belongs in the flow, not just Settings.** The moment right after saving an entry, the moment of unlocking on a new device, the moment of recovery-code setup — these are trust-critical beats and deserve real design attention, not a generic "success" toast.
3. **Two secrets, never conflated.** The account password (sign-in) and the journal passphrase (decryption) are different things with different recovery paths. The UI must never blur this distinction, especially in onboarding and Settings.
4. **Notifications are restrained by design.** No streak-shaming, no "we miss you," at most one nudge a day, generic-by-default lock-screen text. Design the notification/permission screens to make this restraint feel like a *feature*, not an apology.
5. **Destructive actions get real weight.** Account deletion is type-to-confirm; entry/manifestation deletion gets inline (not modal-interrupt) confirmation. Don't soften these into throwaway dismiss-button treatment, but don't make them scary theater either.
6. **The story-format playback is the signature moment.** It's the one place the app gets to feel a little cinematic/delightful — full-bleed, swipeable, dark "night" palette contrasted against the app's otherwise light daytime feel. This is the screen most worth your best work.

---

## Complete screen & scenario inventory

Every item below needs a designed screen (or a clearly-specified state of an existing screen). Group them into whatever page/frame structure your tool uses, but don't skip any.

### A. Onboarding & Authentication

1. Account signup (email/password + social login)
2. Account sign-in (returning user)
3. Journal passphrase setup — **step 1**: create passphrase (explicit "this is different from your account password" messaging)
4. Journal passphrase setup — **step 2**: recovery code display, with "I've saved this" confirmation gate and a real-feeling warning about permanent loss
5. AI tone selection (Coach / Friend / Mirror / Minimal — show the actual copy differences, not just labels)
6. Notification permission (soft pre-permission ask, per-type toggles: daily prompt w/ time picker, playback ready, manifestation resurfaced)
7. Lock-screen push notification appearance (a device-frame mockup, 2–3 notification types)

### B. Unlocking (returning device / new device)

8. Unlock screen — enter journal passphrase
9. Unlock screen — "forgot passphrase" → recovery code entry
10. Unlock screen — "sync from another device" → QR code display + waiting state
11. Sync confirmation screen (on the *already-unlocked* device that scanned the code) — success and expired/error states

### C. Core loop — Home & Journal

12. Home / Today — greeting, streak, AI daily prompt, mood check-in, recent entries
13. Home — empty state (brand-new account, zero entries)
14. Journal list — month-grouped, with search
15. Journal list — empty state, and "no search results" state
16. Entry detail (long-form reader) — with tags/mood chips, and the "on this day, N years ago" memory callout when one exists
17. Entry detail — delete confirmation (inline, not modal)

### D. Entry composer

18. Composer — text entry (mood dots, tag input, save)
19. Composer — voice recording state (live waveform, timer, pause/cancel/done)
20. Composer — transcribing state (post-recording, waiting on Whisper)
21. Composer — saved confirmation (privacy reassurance + mood/tag recap + streak)
22. Composer — save error state

### E. Playback (the signature moment)

23. Playback hub — Week/Month/Year selector, real stats (entry count, mood direction, top theme)
24. Playback hub — empty state ("write a few entries to unlock a recap")
25. Playback story — mood trend card (data-driven trend line, not decorative)
26. Playback story — highlight quote card (verbatim quote + "read full entry" link)
27. Playback story — then-vs-now comparison card (**only exists when real data supports it** — design what "this card doesn't appear" looks like in the sequence, e.g. does the progress bar just have fewer segments)
28. Playback story — "letter from your past self" card, with a "write to future self" CTA
29. Playback story — generating/loading state (this can take a few seconds — make the wait feel intentional, not broken)

### F. Manifestations

30. Manifestations list — cards with category, signal count ("no signals yet" vs. "N entries show this happening")
31. Manifestations list — empty state
32. Manifestation add/edit form — goal text, category chips (+ custom), cadence radio, auto-detect toggle
33. Manifestation delete confirmation

### G. Settings

34. Settings home — AI tone, privacy/encryption info, notifications, account section
35. Change journal passphrase (standalone flow, explains why the old passphrase isn't needed)
36. Account & sign-in (this can be a lighter-touch wrapper around Clerk's account UI — design the wrapper/framing, not necessarily Clerk's internals)
37. Data export confirmation
38. Delete account — type-to-confirm destructive flow

### H. System states worth explicit design (not afterthoughts)

- Generic loading/skeleton states for: entries list, playback generation, AI prompt fetch, decryption-in-progress
- Generic error states: failed save, failed AI call, network offline
- The "decrypting…" micro-state that appears briefly whenever content unlocks on screen

---

## User journeys to walk through end-to-end

Don't just design isolated screens — sanity-check these full paths for consistency and pacing:

1. **First-time setup**: sign up → passphrase → recovery code → tone → notifications → land on empty Home
2. **Daily habit**: open app (already unlocked) → Home → write a text entry → saved confirmation → back to Home
3. **Voice entry**: Home → mic → record → transcribing → review/edit transcript → save
4. **New device**: sign in on new phone → locked → choose passphrase, recovery code, or QR sync → unlocked → Home
5. **Weekly ritual**: Playback hub → watch recap → swipe through story cards → land back on hub
6. **Manifestation loop**: add a manifestation → (time passes, entries get written) → open Manifestations → see a signal was detected → tap through to the entry that triggered it
7. **Leaving**: Settings → export data OR delete account, both taken seriously

---

## What "beautiful" means for this brief

Calm, warm, a little literary — think a well-made physical journal or a good editorial app, not a SaaS dashboard. Confident use of whitespace over density. The playback sequence is where you can be more expressive (motion, full-bleed imagery); everywhere else should feel quiet and unhurried. Avoid: AI-slop visual tropes (generic gradient blobs, purple/blue everything, emoji-as-icons, aggressive rounded-corner-plus-shadow card soup). Prefer: real illustrated/photographic warmth in the hero moments, restrained iconography (thin-stroke, consistent grid), a type system with actual personality.

## Deliverables requested

- A cohesive design system: color tokens, type scale, spacing scale, iconography style, motion principles
- High-fidelity screens for every item in the inventory above (or explicit reuse notes where states share a template)
- Redlines/specs usable by a frontend engineer working in Tailwind (exact values, not just visual comps)
- If prototyping: the playback story sequence and the unlock/sync flow are the two most worth an interactive prototype

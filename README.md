# The Nook

A mobile-first, AI-assisted journal. You write (or speak) entries; the app turns that archive into reflection — playing back your growth over time and reinforcing the things you said you were working toward, in your own words, not generic affirmations. Entries are encrypted client-side — the server never has anything but ciphertext.

Design direction: light, calm, "sage" palette (soft green hills / forest motif) — deliberately not the violet/gradient look common to AI products.

**Visual reference:** [Journal App Mobile Flow](https://claude.ai/code/artifact/36d63c97-7c7c-4fd6-8234-b35ea36ed857) — every screen in the design canvas.

## Where to start

| If you want... | Go to |
|---|---|
| Product intent, data model, encryption design, sequence diagrams | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| What's actually built vs. known gaps, setup instructions | [`web/README.md`](web/README.md) |
| The full mobile screen designs (source `.dc.html` files) | [`design/mobile-flow/`](design/mobile-flow/) |
| The app itself | [`web/`](web/) — Next.js, run `npm install && npm run dev` there |

## Repo layout

```
design/mobile-flow/   Design canvas — every screen as a standalone mockup
docs/ARCHITECTURE.md  Source of truth: product spec, schema, encryption, sequence diagrams
web/                  The Next.js app — Clerk auth, Supabase, OpenAI, client-side encryption
```

## What it does

Text or voice entries, an AI daily prompt in a tone you pick (Coach / Friend / Mirror / Minimal), a story-format weekly/monthly/yearly playback, manifestations with automatic (conservative) progress detection, and a privacy model where losing your journal passphrase *and* recovery code means the entries are genuinely, permanently gone — a stated tradeoff of true end-to-end encryption, not an oversight. See `docs/ARCHITECTURE.md` §5 for the full model, including multi-device sync via QR handoff.

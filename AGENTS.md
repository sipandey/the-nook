# Agent Instructions — journal (JavaScript)

This file supplements the base AGENTS.md with JavaScript-specific guidance.

## JavaScript-specific workflow

1. **Modules:** Prefer ES modules (`import`/`export`) in new code; match the project's existing module system.
2. **Testing:** Use the project's test runner (Jest, Vitest, or Node's built-in `node --test`); write tests first (TDD), then implement.
3. **Linting:** Run ESLint before committing; fix errors — don't disable rules without a logged decision.
4. **Dependencies:** Pin versions in `package-lock.json`; review security advisories (`npm audit`).
5. **Async:** Prefer `async`/`await` over raw Promise chains; handle rejection paths explicitly.

## Language-specific principles

- **Explicit over clever:** Readable code beats one-liners; name functions for intent.
- **Strict equality:** Use `===` / `!==` unless you have a documented reason for coercion.
- **Immutability by default:** Avoid mutating shared objects; copy before modify when unsure.
- **Small modules:** One responsibility per file; keep public surfaces narrow.
- **No silent failures:** Log or throw — don't swallow errors in empty `catch` blocks.

## Common pitfalls

- ❌ Mixing CommonJS and ESM in the same package without a plan
- ❌ Relying on hoisting or implicit globals
- ❌ Committing `node_modules/` or local `.env` files
- ❌ Using `var` in new code
- ✅ Use `node --test` or the repo's existing runner — don't add a second framework casually

## Git rules

**Hard rule — never skip this before any commit, not just at session start:**

```
git config user.name "Siddharth Pandey"
git config user.email "siddharth.pandey06@gmail.com"
git config user.name && git config user.email
```

Run this immediately before *every* `git commit` in this repo, not just once
per session — a global config change, a fresh clone, or an unrelated tool
resetting local config mid-session can silently revert it. After committing,
confirm the identity actually landed on the commit
(`git log -1 --format='%an <%ae>'`); if it doesn't match, fix the local
config and amend before doing anything else — an unpushed commit with the
wrong identity must be corrected immediately, not left for later cleanup.

- Do not run `git push` unless explicitly asked.
- Do not amend or rewrite history on shared/pushed branches without being asked. Amending an unpushed local commit to fix its identity is fine.

## Stack detection

This room was scaffolded for JavaScript. Detected configuration:
- **Package Manager:** npm
- **Test Command:** npm test
- **Lint Command:** npm run lint

See `.agent-room/principles.md` and `workflow-classifier.md` for the full playbook.

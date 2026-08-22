# CLAUDE.md — journal

This file is read automatically by Claude Code. The actual guidance lives in
[`AGENTS.md`](AGENTS.md) and [`.agent-room/`](.agent-room/) — read those
first, this file only adds Claude Code-specific mechanics.

## Skills

The skills in `.agent-room/skills/` are mirrored into `.claude/skills/` so
Claude Code can discover and invoke them (`/brainstorming`,
`/writing-plans`, `/test-driven-development`, `/systematic-debugging`,
`/verification-before-completion`, `/closing-the-loop`).

`.agent-room/skills/` is the source of truth. If you edit a skill, re-run
`create-agent-room sync` to refresh the `.claude/skills/` copies — don't
edit the `.claude/skills/` copies directly, they'll be overwritten.

## Closing-the-loop hook

A `Stop` hook is wired up in `.claude/settings.json`, running
`.agent-room/hooks/close-the-loop-check.js` at the end of every turn. If the
turn changed tracked files outside the agent-room scaffold but didn't touch
`.agent-room/anti-patterns.md` or `.agent-room/decisions.md`, the hook
blocks the turn from ending and explains why. This is mechanical
enforcement of `.agent-room/skills/closing-the-loop.md` — it can't judge
whether an entry is *good*, only that the check wasn't silently skipped.

The exit hatch is a one-line waiver in `decisions.md`:
`<!-- no-log: routine change, no decision or anti-pattern worth recording -->`

The hook only looks at `git status --porcelain`, so unrelated pre-existing
dirty files in the work tree will also trigger it — commit or stash them
first if that gets noisy.

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

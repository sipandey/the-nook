# Guardrails Bypass Log — create-agent-room

Append-only, machine-written record of every commit that used
`GUARDRAILS_BYPASS=1` (or `SKIP_GUARDRAILS_CHECK=1`) to override a blocked
commit. Written automatically by `.agent-room/hooks/guardrails-check.js` -
do not edit by hand; edits here don't reflect what actually happened.

Review this periodically (or in code review) so bypasses stay visible
instead of scrolling off a terminal and being forgotten.

<!-- Entries below this line, newest first, appended automatically. -->
- 2026-08-22T08:03:08.147Z | author: Siddharth Pandey <siddharth.pandey06@gmail.com> | bypassed: Protected path violation: .agent-room/guardrails.json; Protected path violation: .agent-room/guardrails.md; Protected path violation: .agent-room/hooks/close-the-loop-check.js; Protected path violation: .agent-room/hooks/closing-the-loop-evidence.js; Protected path violation: .agent-room/hooks/guardrails-check.js; Protected path violation: .claude/settings.json; Protected path violation: .github/workflows/agent-room-validate.yml; Change scope exceeds guidance: 29 files changed (limit 20); Change scope exceeds guidance: 2036 lines changed (limit 500)
- 2026-08-22T08:40:07.495Z | author: Siddharth Pandey <siddharth.pandey06@gmail.com> | bypassed: Change scope exceeds guidance: 26 files changed (limit 20); Change scope exceeds guidance: 971 lines changed (limit 500)
- 2026-08-22T08:48:35.697Z | author: Siddharth Pandey <siddharth.pandey06@gmail.com> | bypassed: Change scope exceeds guidance: 737 lines changed (limit 500)
- 2026-08-22T09:00:13.471Z | author: Siddharth Pandey <siddharth.pandey06@gmail.com> | bypassed: Change scope exceeds guidance: 576 lines changed (limit 500)

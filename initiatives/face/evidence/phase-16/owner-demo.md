# Phase 16 -- owner demo (live, main clone)

- **When:** 2026-10-13, main clone at `b509f261`.
- **Server:** the owner's own `node .claude/scripts/hq/arc-face.mjs` from Git Bash, `http://localhost:5180`.
- **Who read it:** the agent, at the owner's instruction ("neeye check pannu pages", then "sari pannu").

## Inbox room (`#/inbox`)

- Reads **0 waiting · 145 decisions ever · 94% approve rate · 77 B average reason**.
- `node .claude/scripts/hq/arc-inbox.mjs --all` on the same spine agrees: every request on it carries a
  `decision.recorded`; none is open.

## Declared gap

No request on the live spine is undecided, so no `WAITING`, `STALE` or `DUPLICATE_OF` badge can render live today.
Those five states are proven on CI only (`tests/face/approval-bindings.mjs` and the inbox fold fixtures, PR #413,
run 38333928130, 19/19). The agent did not plant a request to make one appear: a fake approval on the owner's real
spine would be a lie in his decision log. Closed on that declared gap, as Phase 13 closed on its own.
The first real dependent or plan-bound approval after this close is the live check.

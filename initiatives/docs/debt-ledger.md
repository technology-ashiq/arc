# Debt ledger — the docs lane

LOW findings left after the two attack rounds a PR is allowed (memory: attack rounds capped at two),
one line each, with where they came from. Each is paid in a later slice or closed with a reason.

## Phase 00 -- the logic surface that never ran

- **DOC-K half-met on Phase 00.** The logic attacker (ADR-0226, `--driver generic-api --trial-model $ARC_ATTACK_TRIAL_MODEL`) failed on transport twice: HTTP 503 on round 1, HTTP 429 on a direct `arc-run` retry against the merged squash `f32d8957`. No substitute agent was used. Owner ruled 2026-09-25 to close with this recorded. Pay: the first Phase 01 logic round that runs is given `--base f32d8957^` as well, or a working model is set and Phase 00's diff attacked on its own.

## Phase 00 (attack fb17189, round 2, boundary)

- **B5** — a crash and a real refusal share exit 2 in the writer tests; the assertions check the message text, not a crash-free run. Pay: assert no `wiki-build: ` stack line in each refusal test.
- **B6** — the "resolves outside the tree" and the non-ENOENT read-failure branches have no test that only they decide (outside-tree needs a linked parent; EACCES needs a non-Windows chmod). Pay: two POSIX-only fixture cases.
- **B9** — a closed STDERR turns a usage exit 2 into an uncaught EPIPE exit 1. Pay: guard stderr writes the way `say()` guards stdout.
- **B10** — only a UTF-8 BOM is handled; a UTF-16 file (PowerShell 5.1's default `Out-File`) parses as garbage facts at exit 0. Pay: refuse a UTF-16 BOM by name.
- **B11** — stdout mode inherits the console's newline handling; the byte guarantee is proven only for `--out`. Pay: say so in `--help`, or test stdout bytes on the Windows leg.

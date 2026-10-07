# Debt ledger — the policy lane

LOW findings left open after an attack's second round (ADR-0226: max two rounds per PR; LOW leftovers land here).
Each row names the finding, why it was not fixed now, and what would reopen it.

| # | Opened | Finding | Why not now | Reopens when |
|---|---|---|---|---|
| 1 | 2026-10-07 | r2 L9: a headless refusal citing an incident from the previous IST day (a run straddling midnight) is `unverified` | The same-day rule is stricter than ULID order and fails toward BELOW-BAR, never toward a false PASS; the window is one run's length at midnight | A real refusal is observed `unverified` for this reason on the canonical spine |
| 2 | 2026-10-07 | r2 B6: two concurrent denied runs can both pass the writer's day bound before either emit lands, sealing two refusals | Mode B (concurrent emitters) is uncertified (ADR-0056); a duplicate refusal is extra evidence, not false evidence. A day-keyed idem is Phase 02's design for the hook and can extend to arc-run then | The scheduler runs two jobs for the same pair at once, or Phase 02 lands the day-keyed idem |
| 3 | 2026-10-07 | r2 B8: "canonical" is inferred from `.git` being a directory, so a plain second clone's spine reads as canonical and a submodule is refused | Fails toward a visible, named refusal or a reading of a real (if secondary) spine; `git rev-parse --git-common-dir` adds a git dependency to every reader including the face door | A second full clone of arc is in use, or arc is consumed as a submodule |

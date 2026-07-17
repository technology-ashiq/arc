# Phase 01 — Composable hooks + stable settings.json

**Goal (one line):** the 6 monolithic hooks become per-event fragment dirs with loud-SKIP guards so a partial install (core+council only) runs every hook event clean, inside the <30s budget.
**Appetite:** 0.5 weeks — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] Hooks split into core dispatchers + `<event>.d/NN-*.sh` fragments (SessionStart, PreToolUse, PreToolUse-edit, PostToolUse, SessionEnd, PreCompact); execution order deterministic by NN- prefix
- [ ] Missing product fragment/script → loud `SKIP <product>: <reason>` line, exit 0 — never silent, never fatal (REQ-06)
- [ ] settings.json is the stable core-owned template; product hook registrations are guard-safe (a registered-but-absent product cannot brick an event)
- [ ] core+council-only scratch install: all 6 hook events fire exit 0 with SKIP lines for plan/review/qa/git
- [ ] Hook-tier wall time measured before/after on the owner's Windows box: < 30s (ADR-0006 budget, assumption row 3)
- [ ] tests added & green; live demo run + output checked; tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/hooks-dispatch.bats --print-output-on-failure`
- **Expected failure first:** dispatcher cases written first fail with `hooks.d: No such file or directory` on the unsplit hooks — proves the test sees the new layout, red → green.
- **Live demo scenario:** in a core+council-only scratch install, trigger a session start + an edit through the PreToolUse chain; expect SKIP lines naming each absent product and exit 0; run `time` on the full hook chain on the real machine → wall time printed < 30s.
- **Real-system check:** the arc mold's own session hooks keep working after the split (dogfood: this very repo's next session runs on the fragment dispatchers).
- **Expected evidence:** bats green output, demo transcript with SKIP lines, before/after timing numbers recorded in the done-log.

## Rabbit holes in this phase

- Settings-merge engine temptation — NO (No-go); template + guards only.
- Per-fragment subshell overhead on Git Bash — measure first; only optimize if the 30s budget is actually threatened.

## Out of scope for this phase

Registry (Phase 2) · file moves (Phase 3).

## Your-setup / pending

Nothing — all local.

## Non-negotiables (verbatim from PLAN)

- Bare `sync-to-project TARGET` output stays byte-identical to pre-initiative — golden-output bats case green on every PR of this initiative (products are additive under the umbrella, ADR-0014); the golden fixture may only be regenerated via a reviewed diff naming the intentional change — silently re-recording it to match new output is a gate failure, not a fix.
- Every new parser (manifest reader, resolver, product-lint) AND the byte-diff/golden-output comparison gates get an adversarial construct-a-breaking-input pass; found holes fixed + pinned as red fixtures BEFORE any FAIL-mode promotion (council v2+v3: 43 holes in gates that passed their own tests).
- Physical re-homing lands only behind the byte-diff gate — defined as: per-file SHA-256 over content with line endings normalized to LF before hashing, executable bit compared separately, symlinks resolved before hashing; installed tree provably unchanged, per product move (ADR-0018).
- Consumer repos: never delete — attic move to `.claude/attic/DATE/` only, report before mutate.
- Every hook/script change ships with a bats test. CI red = no merge on the arc repo.
- Cross-platform: Git Bash (Windows) + ubuntu + macos CI; bash-3.2/POSIX; no new PowerShell logic beyond the dumb copy loop (ADR-0015).
- New lint checks start WARN in the TRIAL set; FAIL promotion only via docs/trial-ledger.md evidence.
- Engine scripts assume no Claude (ADR-0013 writing rule, inherited).
- Every `/arc-phase-done` on this initiative commits an evidence bundle.

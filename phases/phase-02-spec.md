# Phase 02 — Registry-aware core

**Goal (one line):** targets carry an `arc-registry.json` ground truth and core scripts (ledger, toolcheck, /arc) read it instead of guessing from file presence.
**Appetite:** 1 week — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-01

## Exit criteria (Definition of Done)

- [ ] Sync writes `.claude/arc-registry.json` (products, versions, per-product file lists, source commit) into targets; re-sync updates it (REQ-08)
- [ ] review-ledger.sh derives VALID_KINDS + command hints from the registry when present; today's hardcoded list remains the no-registry fallback (old installs unbroken)
- [ ] ~~per-product toolcheck tags~~ CUT (no REQ requires them — REQ-05 needs only INSTALLED/HEALTH from the registry); route through `/arc-change` post-Phase-4 if still wanted
- [ ] `/arc` INSTALLED column reads the registry — zero file-presence guessing (REQ-05)
- [ ] CI tree-diff invariant job: install `--products all` into a temp dir → diff vs the repo checkout CI is running in (resolved explicitly from the job's own workspace root — never an unrelated worktree's copy) → any divergence fails CI
- [ ] tests added & green; live demo run + output checked; tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse (refined at phase start via /arc-change): registry round-trip bats (write → re-sync → assert update), ledger fallback case (no registry → hardcoded kinds), live demo = `/arc` against a council-only target showing INSTALLED=core,council from the registry file.

## Rabbit holes in this phase

Registry schema creep — v1 fields only (PLAN rabbit hole). Mold self-registry — NO: the mold is the source of truth, not an install target.

## Out of scope for this phase

File moves (Phase 3) · external repos (Phase 4).

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

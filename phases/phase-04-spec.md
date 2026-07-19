# Phase 04 — Dogfood: two real external consumers

**Goal (one line):** council-alone and core+plan each installed into a REAL external repo (venturemind / InvoiceFly) and used for real work — the ADR-0013 "second concrete consumer" evidence, manufactured.
**Appetite:** 0.5 weeks — blown appetite = cut scope or kill, never extend silently.
**Depends on:** phase-03

## Exit criteria (Definition of Done)

- [ ] council-alone installed into external repo #1; one REAL council session (a genuine decision, not a fixture) runs end-to-end; session file committed there (REQ-09)
- [ ] core+plan installed into external repo #2; one small real `/arc-kickoff` runs (S-tier acceptable)
- [ ] If a target already has an older full-arc install: additive re-sync only — the registry written covers THIS sync's products and is diffed against what this sync actually installed; classifying PRE-EXISTING legacy files is explicitly out of scope (that capability is Phase 5's prune-report) and recorded as a known-gap in docs/evidence/phase-04/, retried after Phase 5 ships
- [x] **REQ-10 — `--prune-report` (pulled forward from Phase 5 by ADR-0020).** Phase 03 re-homed every product, so any already-installed consumer now carries stale *executable* copies of the old flat scripts, and the registry reports them clean. `sync-to-project.sh TARGET --prune-report` (and the ps1 `-PruneReport`) lists every file present under `.claude/` that no installed product owns, exit 0, writing and deleting nothing. Degrades loudly on a target with no registry rather than guessing ownership from file presence. Proven on venturemind: **21 unowned files**, including the 6 the Phase-03 re-home left behind. Attic/quarantine is REQ-11, Phase 5.
- [ ] Issues found → fixed in the mold with a regression test each
- [ ] Evidence bundles committed to docs/evidence/phase-04/; tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

Coarse (refined at phase start): target assignment between venturemind and InvoiceFly decided
then (assumption row 5 fires if either is unsuitable); evidence = install transcripts +
registry files + the real session/kickoff artifacts in each target repo.

## Rabbit holes in this phase

Fixing target-repo product issues (their code) — out of scope; only arc-install issues count.

## Out of scope for this phase

Docs rewrite + prune (Phase 5).

## Your-setup / pending

Confirm venturemind + InvoiceFly access on this machine; pick which repo gets council vs core+plan at phase start.

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

# Phase 01 — The proof floor: a gate that can fail, and a parser that survives attack

**Goal (one line):** `develop-lint` refuses a slice that claims done without a declared proof, its
pasted evidence and its commit — and its ledger parser has been attacked with hand-built breaking
inputs before it ships, not after.
**Appetite:** 1.25 days
**Depends on:** phase-00

Serves **REQ-05** (floor blocks), **REQ-06** (adversarial-proof parser), **REQ-07** (evidence tiers).

## What this phase actually builds

- `.claude/scripts/develop/develop-lint.mjs` — lane-aware via `resolveLane` (never re-implemented),
  `[check-name] FILE:LINE — Expected/Found/Example` output, lane echo first.
- **BLOCK from v1** (exit 1), per ADR-0101: `ledger-unparseable` · `brief-stale` (recorded spec hash
  vs `phase-NN-spec.md`) · `slice-unproven` (a ticked slice missing `proof:`, `tier:` or `commit:`).
- **WARN-first** (exit 0, `[trial]` suffix, promotes only via `docs/trial-ledger.md`):
  `self-declared-number` · `tier-floor` (a UI REQ below `e2e-visual`, an external-dep REQ below
  `contract`).
- The ADR-0100 parser hardened: tolerant detection (bullet, emphasis, whitespace and heading-level
  variants treated as one), strict value grammar (near-misses fail closed), all-of for repeated
  sections, anchored line regexes with no `$` under `/m`.
- `tests/fixtures/develop/breaking/` — ≥20 pinned breaking inputs.
- `tests/fixtures/develop/negative-control/` — one fixture per BLOCK, proving the check *can* fail.
- A `docs/trial-ledger.md` entry registering develop-lint's WARN-first groups.

## The adversarial pass is part of this phase, not of its close

The rule since 2026-07-16 is that every hand-authored gate, lint or parser gets a
construct-a-breaking-input pass. On 2026-08-02 that pass was skipped on three gates in one phase and
nothing noticed until the close refused — it then found 61 issues, 5 live in shipped code. So the
pass is bound here, to the section that ships the parser: **the parser is not done until ≥20 breaking
inputs exist, every hole found is fixed, and every one is pinned as a fixture.**

Input classes to construct, at minimum: heading-level variants (`##` vs `###` vs bolded text) ·
emphasis and bullet variants around a key · case-flipped keys (`Proof:` / `PROOF:`) · trailing and
non-breaking whitespace in values · a key repeated inside one slice block · a slice block repeated ·
two slice blocks sharing one id but differing in content ·
a fenced block inside a proof value · CRLF and mixed line endings · a value that is only a placeholder (`<...>`,
`(...)`, `TBD`) · a `commit:` field holding something that is not a SHA · unicode lookalikes in a
tier name · an empty ledger with a valid brief · a brief with no ledger.

## Exit criteria (Definition of Done)

- [ ] `node .claude/scripts/develop/develop-lint.mjs --lane develop` exits 1 on each of the three
      BLOCK mutations and exits 0 on the good fixture
- [ ] each BLOCK has a **negative-control fixture** that proves the check can fail — a control that
      has never been seen to fail is a coin, not a gate (retro-log 2026-08-02)
- [ ] ≥20 breaking inputs pinned under `tests/fixtures/develop/breaking/`, each FAILing the lint,
      with the good fixture still passing
- [ ] every proof carries a tier from `static|unit|contract|integration|e2e-visual|verified-real`
      and its slice a `kind:`; the fake-phase fixture carries one `ui` slice and one `external-dep`
      slice so both tier floors are actually exercised, plus one slice with no `kind:` to prove the
      missing-classification WARN fires instead of a silent skip
- [ ] WARN groups registered in `docs/trial-ledger.md` with their promotion criteria
- [ ] tests added & green: `bash tests/develop-lint.bats` on all 3 CI legs
- [ ] `.github/workflows/ci.yml`'s test-count floor raised to cover the new `@test` lines
- [ ] `tree-manifest.txt` regenerated as a named step
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bash tests/develop-lint.bats`
- **Expected failure first:** `not ok 1 lint exits 1 on a ticked slice with no proof` — fails before
  any code with `Cannot find module '.claude/scripts/develop/develop-lint.mjs'`. The load-bearing red
  is the negative-control pair: `not ok 2 good fixture passes` and `not ok 3 mutated fixture fails`
  must BOTH be red first, because a lint that always exits 0 would silently pass test 2 alone.
- **Live demo scenario:** take the Phase-00 fake-phase ledger, delete one slice's `proof:` line, run
  the lint — expect exit 1 naming the slice id and line number; restore it, re-run — expect exit 0.
- **Real-system check:** run the lint against this lane's own real `phase-00-tasks.md` produced in
  Phase 00, and confirm it passes without special-casing.
- **Expected evidence:** bats output for all 3 legs, the exit-1 and exit-0 lint output pasted, a
  listing of the breaking-input fixture directory, and the trial-ledger diff.

## Rabbit holes in this phase

- **Building a general markdown parser.** It parses one grammar (ADR-0100) and rejects everything
  else. Fail closed.
- **Chasing the `self-declared-number` regex to perfection.** It is WARN-first precisely because it
  will be wrong sometimes; log false positives rather than tuning it into a BLOCK.
- **Adding checks nobody asked for.** The floor is four groups. New ideas go to `/arc-change`.
- **Testing the good fixture only.** Every check needs its mutation asserted — that is the
  2026-07-30 "PASS is an absence" failure in its purest form.

## Out of scope for this phase

- Prediction scoring and `spec-fidelity` → Phase 02.
- Marker lint for the debt ledger → Phase 03 (it is a different ledger with a different grammar).
- Promoting any WARN group to BLOCK → needs the trial ledger and a retro, next cycle at the earliest.

## Your-setup / pending

Nothing. Offline, fixtures only.

**Tripwire:** at 1.75 days inside this phase, ship the three BLOCKs with their negative controls and
cut the two WARN groups to Phase 02 — the floor matters more than the advisories.

## Non-negotiables (verbatim from PLAN)

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever (ADR-0105).
- develop never closes a phase, never intakes scope and never creates a lane — `/arc-phase-done`, `/arc-change` and `/arc-kickoff` keep those jobs.
- Every slice declares its acceptance proof BEFORE implementation; `proof: none` is not a slice (ADR-0100).
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in a ledger row is a lint finding (ADR-0101).
- Any gate, lint or parser this build ships gets an adversarial construct-a-breaking-input pass in the same section that ships it, with every hole pinned as a fixture.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion.
- The whole lifecycle runs offline on a committed fixture; `--lane` is the only lane input and root-mode output stays byte-identical (ADR-0104).

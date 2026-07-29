# PROGRESS.md — Cycle 3 · arc-design "The Designer"

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (Cycle 2 · Receipt Spine) CLOSED 2026-07-28: `docs/archive/PROGRESS-2026-07-28.md`.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: read-only vision critic + edit-hook scope + spine receipt + warn gate + minimal brief template → one real route inspected e2e | 1.25 days | ✅ 2026-07-28 |
| 01 | Brief mode (4 contracts) + design-lint v0 (adversarially passed) + `products/design/` manifest module | 1 day | ✅ 2026-07-29 |
| 02 | Explore: theses → 3 isolated variants → critique loop → blind ranking → pick + prediction receipt (GATE: spine dedup fix landed, ADR-0044) | 1.5 days | ✅ 2026-07-29 |
| 03 | Intelligence library + LexOS pilot e2e + blind-test launch (evidence may trail, ADR-0041) | 0.75 days | pending |

**Appetite burn:** ~2.0 of 5 days used (Phases 00 + 01 + 02 closed). The kill tripwire
(2.5 days with Phase 01 not done) is PERMANENTLY CLEARED. Phase 02 came in at **~0.4 days
against a 1.5-day appetite** — the widest underspend of the cycle, and worth reading
correctly: the run's own working window was 3h 17m (12:06→14:57 plus 26m of infra the night
before); the 8-hour gap in the commit log is an owner park, not build time. Remaining:
0.75 days of declared appetite for Phase 03 against 3.0 days of wall clock — the cycle now
has real slack it did not have at Phase 01 close.

## Done log

- 2026-07-29 — **Phase 02 CLOSED** (`/arc-phase-done 2`). Shipped: `design-explore.sh`
  (init/check/render/status) · agents `design-director` / `ui-composer` / `design-jury` ·
  and the first real explore run `hq-dashboard-v1` end to end: 3 theses assigned with the
  IA matrix written **at assignment time**, 3 blind composers one variant dir each, one
  shared render command, critique loop, director call **5 of 7**, 3 blind jurors
  (unanimous a > c > b), owner pick sealed as `decision.recorded`
  (`01KYPJ91H7TX0GTKW0J3HA4E53` → variant-a, prediction: daily clear ~10 min → under 4).
  **Tests: 436 across 38 suites, green on 5 CI legs / 3 OS** (run `30440965804`, all 6 jobs
  success incl. windows). **Time: ~0.4 days vs 1.5 appetite.** Evidence bundle written and
  verified at `docs/evidence/phase-02`.
  **amendments: 4** (#57 render determinism · #58 brief declares disclosure for an
  undeclared surface · #59 ADR-0042 retirement due · #60 ADR-0043 kickoff hook due) ·
  **reopened: n**
  - **ADR-0044 satisfied live, not attested:** 7 `review.completed` across 3 routes, every
    idem distinct — variant-b alone carries three rounds. The retro called a merged-PR
    attestation insufficient; this no longer rests on one.
  - **REQ-08 proven in both directions:** variant-c ran FAIL → PASS inside 2 rounds (the
    contract); variant-b exhausted 2 and escalated to the owner, who authorised the third
    (the escape hatch). Critic sessions changed zero product files, verified each round.
  - **Two real defects found by the run itself.** `design-explore check` matched "director
    call" as a substring, so the matrix's own prose saying the call was *deliberately
    absent* satisfied the gate — the gate certified its own absence. Fixed, anchored, 4
    fixtures pinned, sync-golden regenerated. And render non-determinism (same static bytes
    → two hashes, once mid-critique into a sealed receipt) fired the ledger's
    screenshots-are-deterministic assumption.
  - **The instruments disagreed, and that is the keeper:** variant-b holds a design PASS and
    finished last on every ballot; variant-a carries one open VIOLATION and won every
    ballot. Two jurors independently caught a `k`-bound-twice keyboard legend that three
    critique rounds missed. Contract compliance and preference measure different things.
  - **Cost note for /arc-retro:** the Windows CI leg ran bats in ~20 min against ~90s on
    every Linux/macOS leg — an 11× spread, all of it in test execution, not setup (Windows
    setup was 48s). It is the whole reason a green CI takes 20 minutes rather than 3.

- 2026-07-29 — **Phase 01 CLOSED** (`/arc-phase-done 1`). Shipped: `design-lint.mjs` v0
  (4-section strict grammar, fence-stripped structural parsing, live drift gate vs the
  template, real-calendar dates, strict platform values, lorem in briefs + critiqued
  product routes, contrast computed from declared pairs vs the BRIEF-declared floor,
  `--floors` JSON export as the number authority — ADR-0048) · first real brief
  (`docs/design/briefs/docs--strategy--arc-hq-mockup-html/`, closes Phase 00's
  "none declared" gap) · template upgraded to strict grammar · one `design` gate row runs
  both halves (ADR-0046) · module proof (scratch install 9/9, resolver reads registry, old
  surface byte-untouched — ADR-0042). **Adversarial pass: 10 attacks, 4 real holes fixed +
  all 10 pinned** (fenced-heading bypass the worst: delete a section, quote its heading in
  a fence, pass). **Tests: 417 full-suite green on 3 OS, CI run `30390662479`, FIRST
  attempt** — Phase 00's cross-OS lessons (no path-string compares, `-text` fixture
  exemption) paid for themselves. **Time: ~0.5 days vs 1 day appetite.** Evidence bundle
  verified at `c855aee`. REQ-05/06 → validated.
  `amendments: 2` (ADR-0048 contrast-deferral reversal · build-time scoping note: lint owns
  computed contrast + exported floors, browser-measured pixels wait for Phase 2) ·
  `reopened: n`.
  Follow-ups routed at close: freeze-check traversal hole → issue #54 · spine dedup
  (ADR-0044 Phase-2 gate) → issue #55.
- 2026-07-28 — **Phase 00 CLOSED** (`/arc-phase-done 0`). Shipped: `design-critic` agent
  (no Edit, scoped receipt Bash) · write boundary (`10-design-critic.sh` +
  `critic-scope-check.sh`, marker-scoped) · deterministic full-page render
  (`design-render.sh`) with blank + stale-duplicate refusals · runner
  (`design-critique.sh begin|finish`, PASS ≡ zero VIOLATION) · `design` warn gate + its
  `arc.gates.yaml` row · minimal brief template · planted-defect fixture (regenerable).
  **Tests: 389 full-suite green on 3 OS** (CI run `30364828766`, the authority — local runs
  are touched-files only). 29 of those are this phase's own `design-steel-thread.bats`.
  **Time: ~1.1 days vs 1.25 appetite** — inside it. Evidence bundle verified at `fa794ea`.
  REQ-02/03/04 → validated. Live proof: critic caught the planted lorem ipsum; the real
  route went 2 VIOLATION → 1 → 0 across three rounds ending in a live PASS with the ledger
  stamped; the hook blocked a real out-of-boundary write.
  `amendments: 2` (ADR-0047 verdict ownership, ADR-0048 agents-judge-scripts-measure —
  both amended phase specs) · `reopened: n` · `t-to-phase0: 0 days` (kickoff and Phase 00
  both 2026-07-28).
  **Cost of the close: 3 CI rounds.** Two cross-OS path bugs that no local run could catch
  (macOS `/var` symlink, Windows 8.3 names + MSYS argv/env conversion). Both were the same
  mistake — comparing path strings instead of resolving them.
- 2026-07-28 — Kickoff complete (`/arc-kickoff`, tier M): Cycle-2 tracker archived;
  ADR-0033..0046 written (8 locked DES decisions + 4 owner forks + 2 auto-decides);
  PLAN.md + 4 phase specs on branch `feat/design-kickoff`. Design source:
  `docs/strategy/plans/PLAN-design.md` (frozen 2026-07-26).

## Now

**Phase 02 CLOSED 2026-07-29. Phase 03 is NEXT but deliberately NOT YET OPEN** — it opens
with two of its own preconditions unmet, and opening it before they are settled would burn
its 0.75-day appetite against a blocked first exit criterion.

REQ-07 and REQ-08 are `validated`; 3 of 4 phases done; 2.0 of 5 days burnt with 0.75 days
of appetite left against 3.0 days of wall clock. PR #61 open on `feat/design-phase-02`,
CI green (run `30440965804`, 6/6 jobs, 436 tests × 5 legs / 3 OS). **The branch is not
merged yet** — merging it is the first mechanical step of whatever comes next.

**Three FIRED assumption/ADR triggers are routed but NOT actioned. All three are owner
decisions, none is a code task I can take unilaterally:**

- **#57 — render non-determinism.** `design-render.sh` renders the same static bytes to two
  different hashes; one flip landed inside a sealed `review.completed`. Fires PLAN's
  "screenshots are deterministic enough to critique" row. The ledger's own prescribed remedy
  is *harden the render script before proceeding* — and Phase 03 runs this same renderer for
  its pilot evidence, so this is the one with a real claim on being fixed first.
- **#59 — ADR-0042 retirement due.** Two clean explore-critique runs fired it. Whether
  "retire the old `/arc-design` + design-reviewer" means retire or repoint-and-keep is
  unresolved: the old reviewer *fixes and commits*, the new critic is read-only by
  construction (ADR-0034). Different jobs.
- **#60 — ADR-0043 kickoff hook due.** One clean brief→critique→receipt run fired it. The
  condition for *considering* the wiring is met; the shape of the wiring is not designed.

**Phase 03's own blocker, fired at this close:** the ledger row "a real Stream-B contact
(LexOS lawyer) is identified and reachable before Phase-3 opens" is **FIRED 2026-07-29** —
no contact is named anywhere in the plan, the specs or the tracker. The consequence is the
one the trigger already wrote: Phase 03 opens with its pilot-brief upgrade blocked. The
fallback is pre-designed and legitimate (case-primary marked PROVISIONAL, per PLAN's
External dependencies row) but taking it is a deliberate owner decision on the record, not
a default.

**Also still owed by the owner before Phase 03 (`phases/phase-03-spec.md` Your-setup):**
LexOS repo checked out locally with its `docs/design/` drafts current, and ₹0 recruiting
channels identified for Stream A (design peers) and Stream B (LexOS lawyer contacts).

**Recommended next action:** merge PR #61, then settle #57 before Phase 03 opens — its
evidence depends on the renderer the issue calls into question. #59 and #60 can wait for
`/arc-retro`; the Stream-B contact cannot, because Phase 03's first exit criterion is
blocked without it.

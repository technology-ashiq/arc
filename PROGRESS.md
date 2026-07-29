# PROGRESS.md — Cycle 3 · arc-design "The Designer"

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Predecessor (Cycle 2 · Receipt Spine) CLOSED 2026-07-28: `docs/archive/PROGRESS-2026-07-28.md`.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: read-only vision critic + edit-hook scope + spine receipt + warn gate + minimal brief template → one real route inspected e2e | 1.25 days | ✅ 2026-07-28 |
| 01 | Brief mode (4 contracts) + design-lint v0 (adversarially passed) + `products/design/` manifest module | 1 day | ✅ 2026-07-29 |
| 02 | Explore: theses → 3 isolated variants → critique loop → blind ranking → pick + prediction receipt (GATE: spine dedup fix landed, ADR-0044) | 1.5 days | pending |
| 03 | Intelligence library + LexOS pilot e2e + blind-test launch (evidence may trail, ADR-0041) | 0.75 days | pending |

**Appetite burn:** ~1.6 of 5 days used (Phases 00 + 01 closed). The kill tripwire (2.5 days
with Phase 01 not done) is now PERMANENTLY CLEARED — Phase 01 is done with 0.9 days of
tripwire headroom to spare. Remaining: 2.25 days of declared appetite for Phases 02+03
against 3.4 days of wall clock.

## Done log

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

**Phase 02 RUN COMPLETE — awaiting `/arc-phase-done 2`** (2026-07-29). The explore run
`hq-dashboard-v1` went all eight steps on `feat/design-phase-02`; 12 commits, tree clean,
`design-explore check` green.

- **Steps 1–8 done.** Director assigned 3 theses + the IA matrix at assignment time
  (canvas + ambient assistant rejected as structurally absurd / vocabulary-breaking;
  guided workflow held as the named reserve) → 3 blind composers, one variant dir each →
  shared render → critic round 1 (all three FAIL, 7 VIOLATIONs) → creation-side fixes →
  round 2 (c PASS; a and b each carrying one NEW violation) → owner authorised one
  surgical round 3 for b (PASS) → director call **5 of 7** → 3 blind jurors, unanimous
  **a > c > b** → owner pick sealed as `decision.recorded`
  (`01KYPJ91H7TX0GTKW0J3HA4E53`, decides `01KYPJ8QRYKMRJQB5TP16A43E4`): variant-a, with
  the prediction that the daily clear drops from ~10 minutes to under 4 because all seven
  decisions carry their three facts as columns on one screen.
- **ADR-0044 gate satisfied live, not attested.** Spine holds 7 `review.completed` across
  3 routes, every idem distinct — b alone carries three rounds. The merged-PR attestation
  the retro called insufficient is no longer what this rests on.
- **REQ-08 proven in both directions.** c ran FAIL → PASS inside 2 rounds (the contract);
  b exhausted 2 and escalated to the owner, who authorised the third (the escape hatch).
  Critic sessions changed zero product files, verified each round.
- **Two real defects found by the run itself.** (1) `design-explore check` matched
  "director call" as a substring, so the matrix's own prose saying the call was
  *deliberately absent* satisfied the gate — the gate certified its own absence. Fixed,
  anchored, 4 fixtures pinned, sync-golden regenerated; both directions now proven live.
  (2) Render non-determinism → **ledger assumption FIRED**, routed to issue #57.
- **Instruments disagree, and that is the finding.** b holds a design PASS and finished
  last on every ballot; a carries one open VIOLATION and won every ballot. Two jurors
  independently caught a `k`-bound-twice keyboard-legend conflict that three critique
  rounds missed.

**Routed before close (`/arc-change`):** issue **#57** — `design-render.sh` renders the
same static bytes to two different hashes, which falsifies PLAN's "screenshots are
deterministic enough to critique" assumption (marked FIRED 2026-07-29 in the ledger);
remedy due before Phase 3, which runs the same renderer for its pilot evidence. Issue
**#58** — the brief declares "revenue chart tooltips" on a chart it never declares as a
surface, so no variant built one and only one of three critics noticed; candidate
`design-lint` rule plus an open product question for the Phase-3 brief.

**Next:** `/arc-phase-done 2` — it runs the spec's verification plan, writes the evidence
bundle, flips the phase row and REQ-07/REQ-08 to validated, and updates the appetite-burn
line. Neither routed issue blocks this close; both are due before Phase 03 opens.

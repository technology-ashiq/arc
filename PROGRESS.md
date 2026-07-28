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

**Phase 02 OPEN, mid-run — BLOCKED on a session restart** (2026-07-29). Everything up to
the first agent spawn is done and committed on `feat/design-phase-02`:

- ADR-0044 resolved **fix-first** (owner): dedup fix merged (PR #56), mechanism proven
  live twice (scratch spine + bats pin: same-route receipts, distinct idems). Phase 01
  signed off (`01KYN8MYRYM93BZDG4PB9MA2Q2`); PRs #53 + #56 merged; merged-main golden
  verified EXACT against a real sync.
- Phase-open decisions recorded in the spec: full 2-round scope · isolation =
  route-namespace fallback (ADR-0037) · verification plan refined.
- Infra (`7d42c2d`, inside the 0.5-day timebox): `design-explore.sh`
  (init/check/render/status; adversarial pass found + fixed 4 real holes — rgb()/hsl()/
  named-colour smuggles past the hex-only check, `..` in --brief; all pinned) · agents
  `design-director` / `ui-composer` / `design-jury` · manifest + golden regenerated ·
  design-explore 12 · sync 23 · products 34 green.
- The real run `hq-dashboard-v1` is scaffolded (base `7d42c2d`, brief = the Phase-01 ARC HQ
  brief).

**WHY BLOCKED:** the agent registry loads new agent TYPES only at session start (Phase-0
evidence, reconfirmed). The three explore agents were created this session, so spawning
them fails; the classifier correctly refused the inline-role workaround (it would sidestep
the registry's per-agent tool restrictions).

**Resume (fresh session):** `design-director` / `ui-composer` / `design-jury` will be
registered. Continue the run: (1) director assignment on `hq-dashboard-v1` (theses +
matrix at assignment time + rejected-theses notes), (2) composers ×3 fresh-context, one
variant dir each, (3) `design-explore.sh check` + `render`, (4) critic round 1 per variant
via `design-critique.sh` — expect real VIOLATIONs, (5) creation fixes → critic round 2
(same routes → the distinct-idem close evidence), (6) director divergence call, (7) jury
×3 blind, (8) owner pick + falsifiable prediction via the REQ-06 pattern. REQ-07 + REQ-08
from this ONE run.

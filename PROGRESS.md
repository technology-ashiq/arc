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

**Phase 02 CLOSED 2026-07-29, PR #61 merged (`5106d5e`). #57 CLOSED, PR #62 merged
(`d2d8a85`). Phase 03 is NEXT and still NOT OPEN — but it is now down to ONE unmet
precondition, not two.** The renderer its pilot evidence depends on is fixed; the Stream-B
contact is not. Opening before that is settled burns its 0.75-day appetite against a blocked
first exit criterion.

REQ-07 and REQ-08 are `validated`; 3 of 4 phases done; 2.0 of 5 days burnt with 0.75 days
of appetite left against 3.0 days of wall clock.

**LANDED — issue #57 (render determinism), `b3a961e` → merged `d2d8a85`, CI 6/6 on 3 OS.**
Routed via `/arc-change` and classed a BUG (no new REQ: it restores a guarantee the script
already claimed, it does not add capability). Root cause found and reproduced, not guessed:
`design-render.sh` injects its determinism CSS *after* `_ab open` returns and then captures
**without ever waiting for that CSS to be applied and painted**, so the screenshot can catch
either the pre-injection or the post-injection paint of the same bytes.
- **Proof (variant-b):** injecting the CSS changes pixels — `901e48cc` → `ed1b1100` — with
  **zero layout change** (`scrollHeight` 1528 before and after). Nothing in the pipeline
  forces a settle, so nothing makes the capture wait.
- **Rule-by-rule isolation:** font-pin alone (`ed1b1100`) and antialiasing-off alone
  (`2b102da4`) each change pixels; `animation`/`transition` and `caret-color` change nothing
  (baseline `901e48cc`). The recipe's pixel-moving rules are the two nobody was waiting on.
- **Why only variant-b flipped in the wild:** it is the only variant that already declares
  `font-family: Arial…` itself, so the injection moved its pixels without moving its
  document height. Variants a and c gained height (1387→1402, 1428→1453) and settled.
- **The settle step alone did NOT close it, and that is the useful part.** With settle-only,
  variant-b still drifted once in four runs to a third value (`95e5805d`). Shipping on
  "6/6 green in a probe" would have re-sealed the same class of unreproducible hash with more
  confidence behind it. (That value is since accounted for: it is the injection applied with
  the paint unfinished — an intermediate state, not a fourth cause.)
- **So the fix is layered, and only the last layer is the guarantee:**
  1. *rules applied* — **fail-closed**. A silently failed injection used to leave the render
     running with no determinism rules at all and nothing said so.
  2. *paint settled* — **best-effort, deliberately not fail-closed**. `requestAnimationFrame`
     is throttled in headless Chromium about 1 run in 10 here, and those runs still produced
     the correct identical hash; refusing them would trade a wrong number for a command that
     randomly does not work.
  3. *stable shutter* — **the actual guarantee**. Shoot twice, publish only a hash both
     captures agree on, retry ×3, refuse otherwise. This holds for causes nobody has
     enumerated — and enumerating paint races in a browser is not a finishable task, while
     "this number is reproducible" is exactly what the receipt needs.
- **Rejected, not untried:** `agent-browser open --init-script` (inject before first paint) is
  the cleaner shape; the style never appeared on this transport across 12 runs.
- **Rejected, not untried:** `agent-browser open --init-script` (inject before first paint) is
  the cleaner shape; the style never appeared on this transport across 12 runs.
- **Evidence:** 24 consecutive renders across 5 routes (3 variants, the mockup, the defect
  fixture) — one hash each, zero refusals. 10 new cases in `design-steel-thread.bats` §7 drive
  a **fake agent-browser** (`tests/fixtures/design/fake-agent-browser.sh`) because CI installs
  no browser at all, so a browser-only test would skip on every leg and guard nothing.
  **Red-first: 5 fail against the pre-fix script.** The real-browser render case is the
  weakest — it *passed* against the buggy script more than once, which is the intermittency
  that made #57 hard to see and the reason the faked cases carry the guard.
- **The committed reproducer needed two attempts, and that is the lesson worth keeping.** The
  first `57-repro.html` was measured byte-identical under the pin — a page on which #57 cannot
  happen, behind a case that therefore could not fail while reading as a passing guard. The
  property is two-sided: layout-neutral pin AND at least one element whose font the pin still
  changes (`button`/`kbd`/`code`/`input`, none of which inherit the body font). A case now
  asserts the fixture still moves pixels, proven by stripping its controls and watching it go
  red. A fixture nobody checks is a fixture that decays.
- **Landed:** settle + measured-applied + stable-shutter + refusal cleanup + signal traps +
  SHA-256 shape guard; `recipe` now ends `;settle-paint`; sync-golden regenerated (delta was
  exactly the one intended path). Old recorded hashes are non-comparable across the recipe
  change — the designed meaning of a recipe bump.
- **Reviewed over 4 rounds** (`docs/reviews/2026-07-29-2024-feat-render-determinism.md`).
  Three rounds found a defect in the previous round's fix, and **two of those were in the
  verification method rather than the code** — a gate that measured the wrong thing, and a
  reproducer that reproduced nothing. Worth remembering next time "I verified it" is the claim.
  Standing gap: **`shellcheck` is not installed** and was skipped in all four rounds; for a
  shell-only diff it is the scanner most likely to catch what reading did not.

**#57 is CLOSED (above). Two FIRED ADR triggers remain routed but NOT actioned — both are
owner decisions, neither is a code task I can take unilaterally:**

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

**Sealed receipt — settled by the owner 2026-07-29, correction appended.** Variant-b's round-2
`review.completed` (`01KYPE05Y416G5RVP65CEWN9D4`) seals `52e507ee`, a pre-injection capture the
hardened renderer will never reproduce. Owner chose to correct rather than leave it: a
`note.logged` receipt-correction is on the spine (`01KYPWJNK45E17ETJG1GSV7ZW1`) naming the
corrected event, its idem, the unreproducible hash and why. Phase 02's finding stands — the
critic judged real pixels and the FAIL is real — but that hash must never be a regression
baseline. **Worth knowing what this is and is not:** `.claude/state/` is gitignored, so both the
bad receipt and its correction live only in local spine state, and the Phase-02 evidence bundle
attests only the scan files. The durable, in-git record of this is issue #57, the ledger row,
and this tracker.

**Recommended next action — there is exactly ONE thing left before Phase 03 can open, and it
is not a code task.** #57 is landed and merged, so the renderer Phase 03's pilot evidence
comes out of is no longer in question. What remains is the **Stream-B contact**: either a
named, reachable LexOS lawyer, or the pre-designed fallback (case-primary marked PROVISIONAL)
taken deliberately and on the record. Phase 03's first exit criterion is blocked either way
until that call is made. #59 and #60 can wait for `/arc-retro`.

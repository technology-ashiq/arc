# PROGRESS.md — Cycle 7 · arc-evolve "The Self-Improvement Engine"

status: IDLE
cycle: arc-evolve (Cycle 7, closed 2026-08-04)
phase: — (cycle closed, merged as 8e80927 / PR #108; fixture-proven, unexercised)
appetite: 7d
burn: 7.0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane evolve` on 2026-08-03 and claims **ADR band
> 0300–0399**. Company organs (`docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`,
> `tests/`) stay at root and are never copied here (ADR-0053); evidence is lane-scoped at
> `initiatives/evolve/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-evolve.md` (v1.0, frozen — the decision record, not
> this cycle). Model policy is inherited from `docs/adr/0069-balanced-model-policy.md`.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Contract + steel thread — manifest schema, `product-lint` extension, 8 kinds + validators, grammar, one receipt end-to-end | 1.5 days | ✅ closed 2026-08-04 |
| 01 | Board — reader-only reducer; `PENDING` / staleness / `MISSING` / `insufficient evidence`; stream separation | 1.0 days | ✅ closed 2026-08-04 |
| 02 | Runner + verdict math — assignment, seal, floors, TTL, the pinned test + reference vectors | 1.5 days | ✅ closed 2026-08-04 |
| 03 | Promotion safety — four-hop SHA lineage, evidence table, inbox, watch, freeze, revert path | 1.5 days | ✅ closed 2026-08-04 |
| 04 | Council bridge — the designated cut, BUILT rather than cut | 1.5 days | ✅ closed 2026-08-04 |

**Appetite burn: 7.0 of 7 days used (100%).** Phases 00–03 (the core engine) allocate **5.5 days**.
Phase 04 allocates the remaining 1.5d and is the designated cut — it is simultaneously the only
slack in the cycle. That is deliberate and it is the lesson `arc-portfolio` paid for: Cycle 4
allocated 100% with zero slack, `appetite-sum` warned on every run, Phase 02 overran 0.35d with
nothing to absorb it, and the cycle closed at ~112%. Here the overrun absorber is a phase that
was pre-decided as cuttable, rather than slack nobody named.

**Kill checkpoint: at 3.5 days burned (50%), is REQ-02 met?** — i.e. does a wiped-and-replayed
spine produce a byte-identical board? If not, the reader-only derivation is fighting the spine:
bank the contract, lint and vocabulary ADRs as documentation, stop, retro.

## Done log

- **2026-08-03 — kickoff.** `PLAN.md`, 11 ADRs (0300–0310), 5 phase specs. STOPPED for owner
  approval per the kickoff contract; approved as `01KZ3NAV2BVM7REMZFDAZGW9W1`
  (`decision.recorded`, verdict approve).
- **2026-08-04 — Phase 00 CLOSED.** 13/13 slices proven, CI green (run 30843916974, 19 jobs,
  0 failures), evidence bundled and verified at `initiatives/evolve/evidence/phase-00/`.
  Delivered: the `evolve` manifest section (ADR-0301), the eight experiment receipts
  (ADR-0304/0309, `KINDS` 22 -> 30), the variant grammar (ADR-0303), and the steel thread — one
  `experiment.opened` emitted, landed and read back through the reader on the REAL spine, sealed
  with a real file's sha256. Prediction calibration: 1 hit, 1 miss, 3 unforeseen.

- **2026-08-04 - Phase 01 CLOSED.** 12/12 slices, CI run 30851431809 green. `arc-evolve board`
  folds the spine into an honest status board; `products/evolve/manifest.json` is born.
  A fresh agent found **15 breaks** in the first version and all are pinned as fixtures; CI then
  found a 16th the agent missed - an order dependency in the fold itself.
  Prediction calibration: 2 hit, 2 miss, 1 unforeseen.

- **2026-08-04 - Phase 02 CLOSED.** 9/9 slices, CI run 30856255831 green. Deterministic
  assignment, the canonical seal, TTL, the concurrency cap, and `newcombe-wilson-difference-v1`
  with reference vectors derived by TWO independent agents and committed BEFORE any
  implementation existed. Those derivations disagreed on 6 of 8 cases, which is what ADR-0311
  records: bit-for-bit as REQ-04 words it is unachievable across independent implementations,
  so acceptance is bit-for-bit against ONE pinned expression tree PLUS absolute agreement with
  the independent derivation. A third fresh agent found **15 more breaks**, all fixed and pinned.
  Prediction calibration: 4 hit, 0 miss, 1 unforeseen.

- **2026-08-04 - Phase 03 CLOSED.** 11/11 slices, CI green. The four-hop SHA chain, every hop
  with a negative control. A fourth fresh agent found **13 breaks**, three of them on things this
  lane had already claimed were fixed - including the propose-only GUARD itself, which was a grep
  a mutant module walked straight past. Prediction calibration: 2 hit, 2 miss, 1 unforeseen.
- **2026-08-04 - Phase 04 CLOSED.** 8/8 slices, CI green. The designated cut was BUILT, not cut:
  `council.outcome` (KINDS 30 -> 31), both council payloads closed, calibration from receipts with
  `unresolved` excluded rather than scored as a miss, and `insufficient evidence` below floor.
  Prediction calibration: 4 hit, 1 miss, 0 unforeseen.

## Now

**Current position: all five phases CLOSED. The cycle is ready for `/arc-retro` and merge.**
Burn 7.0d of 7.0d - exactly the appetite, with zero slack, which the `appetite-sum` warning
flagged at kickoff and which stayed true.

### Inbox from the `policy` lane, 2026-08-07 — ten evolve kinds have no `arc brief` group

`arc-brief.mjs` sorts every event kind into one of four sections — `needs-you`, `money`,
`progress`, `background` — and that table is **22 kinds behind the closed vocabulary of 44**.
Ten of the 22 are this lane's: the eight experiment receipts (`experiment.opened`, `assigned`,
`measured`, `verdict`, `promoted`, `rolled_back`, `closed`, plus `promotion.proposed`),
`council.outcome` (ADR-0310) and `metric.observed` (ADR-0308).

**The urgent half is already fixed and needs nothing from you.** Until 2026-08-07 the renderer
used `if (group) push`, so a kind missing from the table rendered as *nothing at all* — every
one of these ten has been silently absent from the brief since this lane shipped, and a day full
of them read exactly like a quiet day. That matters more here than in most lanes: this cycle
closed with all five phases green and eight experiment receipts fixture-proven but unexercised,
so the first real experiment run would have produced a brief showing no experiment at all.
Unmapped kinds now fall through to a catch-all that names them, and the catch-all collapses to a
count so it cannot bury the sections above it (`6d3e3fb`, PR #125). Nothing is dropped any more.

**What is left is a decision only this lane can make.** The ten sit in a catch-all rather than a
section, so the brief can show them but cannot rank them — an `experiment.verdict` and a routine
`experiment.measured` arrive at identical weight. Two look worth real thought rather than a
default: `promotion.proposed`, which is a proposal awaiting a human and therefore plausibly
`needs-you` rather than `progress`; and `metric.observed`, which ADR-0308 already has opinions
about and which is high-volume enough that `background` may be the honest home. The policy lane
deliberately did not guess. A wrong guess does not break anything — it makes the daily brief
quietly misrepresent this lane's work, which is worse than the catch-all it would replace.

Cost when someone picks it up: ten entries in the `GROUPS` table at the top of
`.claude/scripts/hq/arc-brief.mjs`. The tests guarding that table are in `tests/policy-brief.bats`,
including a control that fails if a change ever collapses `needs-you`.

**Phase 04 was the designated cut and was built anyway.** ADR-0307 named it as the thing to drop
under burn pressure. It was not dropped, so the cut was never spent - and that is worth stating
plainly rather than quietly banking as good news, because it means this cycle carried no slack at
all and finished only because nothing went badly wrong for long.

**Five phases, five fresh-agent passes, 58 real breaks.** 15 in the contract and receipts, 15 in
the board, 15 in the assignment layer and verdict gate, 13 in the lineage chain. Every one was in
code that had already passed every test its author wrote. In three of the five phases one of
those tests was itself wrong in a way that hid a severe defect, and in Phase 03 the wrong test
was the one guarding the lane's single most important rule.

**The four recurring failure classes, now with a fifth:**

1. **In-band separators in a hash preimage.** Fixed by `canon.mjs`... and then `canon.mjs` itself
   turned out to be non-total: JSON.stringify folds NaN and -Infinity to null, so a DISABLED
   effect floor hashed identically to an unset one.
2. **A refusal sharing a channel with an answer** (`null` read as "not expired").
3. **A gate that throws instead of refusing.**
4. **The read path is not the write path** - consumers must re-assert grammars on read.
5. **VALIDATE ONE READ, COMPARE ANOTHER.** Fixed in `verdict.mjs` in Phase 02, and not applied in
   `lineage.mjs` until Phase 03's agent walked three hops with an accessor. A fix recorded in one
   file is not a fix applied in the lane.

**This cycle is built ahead of its trigger, and that is on the record (ADR-0300).** The
pre-kickoff gate was verified in-tree at kickoff and **all five rows are unevidenced**: no client
module is named, `metric.observed` is not in `KINDS` (so 4 weeks of receipts are technically
impossible, not merely absent), and rows 3–5 have nothing to derive from. The owner was shown
this evidence and directed the build forward twice. The build proceeds fixture-proven; the
operational runway does not start.

**What that costs, stated up front so the close cannot be surprised by it:** Phase 03's "first
real experiment OPENED on the chosen surface" is **cut and banked**, not delivered. This cycle
must close saying its north-star claim is *fixture-proven, unexercised* — the `engine` lane's
REQ-08 partial is the precedent for reporting a partial claim as partial rather than waiving it,
and this lane inherits that standard.

**CYCLE CLOSED 2026-08-04 at `/arc-retro`.** Merged as `8e80927` (PR #108). The company layer
carries the findings: 7 pattern lines and the scoreboard row in `docs/retro-log.md`, the C7 entry
in `docs/HISTORY.md`, the Cycle 7 promotion decision (no flip) in `docs/trial-ledger.md`. Two
permanent setup upgrades landed from it — the bats non-ASCII drop and the CI-only rule in
`.claude/rules/testing.md`, and the adversarial pass now attacking the test that protects a rule
plus carrying the lane's already-fixed defect list, in `CLAUDE.md`.

**Six debt rows** carry forward, each with a named pay-down trigger. The one that matters most:
`lineage.mjs` has **no production caller**, so every default in it is a default the first caller
inherits without choosing it — not hypothetical, since `requiresDeploy` defaulted fail-open and
would have opened the deploy gate for whoever wired it first.

**Next cycle's entry condition, unchanged from ADR-0300:** this engine is fixture-proven and
unexercised. The runway starts when a real client names a surface and `metric.observed` enters
`KINDS` — that enablement is the client cycle's REQ (ADR-0308), not evolve's.

> Correction applied at close: this block previously read "**To start Phase 02:** …", four phases
> stale. The close script that was supposed to replace it used a Python `str.replace` against an
> anchor naming Phase 03, which did not match — and `str.replace` returns the string unchanged
> rather than erroring, so the whole edit was a silent no-op that reported success.

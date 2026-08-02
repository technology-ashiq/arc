# PLAN (design source) — Balanced Model Policy: pre-engine model discipline

> **Freeze log:** v1 2026-08-01 (first draft) → v2 2026-08-01 (external review's 5
> amendments merged: A1 fixed cost envelope · A2 paired A/B redesign — two shared-thesis
> runs because the explore tooling is 3-variant-shaped · A3 model fingerprint ·
> A4 no-forced-outcomes · A5 emergency exception; plus provider-neutral tiers + reject
> taxonomy refinements) → **v2.1 2026-08-02, FINAL for commit — content frozen,
> decisions MP-A..F locked; real ADR numbers assigned at kickoff from the next free slot.**
>
> **Scope honesty:** this cycle delivers policy + evidence discipline, NOT runtime model
> efficiency. Hard budgets, routing, escalation and benchmarking stay in
> `PLAN-engine-process-layer.md` / `BRIEF-bench.md`, which sleep untouched on their own
> triggers. Roadmap: **this policy cycle → engine cycle → bench cycle → runtime metrics.**
>
> **Trigger (pull):** Cycle 4 (portfolio) closes with its retro done — this cycle starts in
> the freed slot, before the next design/develop cycle. **Prerequisites:** none new (spine
> live since C2; council v3 machinery live; ADR-0049 design freedoms in place).
> **Do not start mid-C4** — the portfolio lane owns the live slot (Constitution A9, one
> live plan).
>
> **Relationship to existing plans (important — this is NOT the engine):** this cycle is
> the **policy layer** the engine and bench inherit: the routing table `router.yaml` will
> later encode, and the first receipted quality/cost data point the bench will later
> systematize. Zero router/driver/bench code here (see No-gos).

## Goal

One sentence: arc's model usage stops being taste-encoded-in-frontmatter — a written,
adopted Balanced Model Policy (which seat gets which tier, why, what would change it, and
the receipt discipline every future model decision must carry), plus the four cheapest
discipline fixes the audit surfaced (council middle tier with a fixed cost envelope,
calibration loop unblocked honestly, composer tier answered by a fair paired experiment,
attacker reject trace) — so that when the engine trigger fires, it implements a policy
that already exists instead of inventing one.

## Current state (verified 2026-08-01 — re-verify at kickoff)

- Model census: 27 agents — cheap-scan ×1 (`codebase-surveyor`, haiku), workhorse ×22
  (sonnet — incl. every creative/research seat), high-judgment ×4 (`code-reviewer`,
  `council-verifier`, `design-director`, `security-auditor`, opus). Session model
  personal-pinned (settings.local.json). All static.
- Cost is **displayed, never enforced**: statusline shows tokens/$/duration/effort; no
  budget stop, no escalation ladder at the LLM-call level (engine REQ-04/05, sleeping).
- Council cost knob is all-or-nothing: `deep` (~12+ agents) or `quick` (no research, no
  verifier). No middle tier — gap verified 2026-07-19, still open.
- Calibration scoreboard is **empty**: session 001 predates Review-by/Resolution lines, so
  `council-calibrate --overdue` can never surface it; zero verdicts ever graded. The
  in-place fix is already sanctioned (council-v2 ADR-0010) and was never executed.
- ADR-0049 (2026-07-30) proved the design pipeline's own constraints were net-negative and
  restored composer freedom — but the composer seat still runs the workhorse tier while
  both judging seats run the high-judgment tier. Untested lever.
- Kickoff attack panel: rejected findings are dropped **silently, no log**
  (`arc-kickoff.md` step 5) — attacker reasoning is unrecoverable.
- The explore tooling is **3-variant-shaped** (variant-a/b/c dirs, matrix.md, rankings) —
  any A/B design must respect that or it is rewriting the tooling (out of appetite).

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase | Status |
|---|---|---|---|---|
| REQ-01 | Owner can point any session, agent, or future engine at ONE written model policy | `docs/adr/NNNN-balanced-model-policy.md` merged containing: **(a)** provider-neutral tier definitions — *cheap-scan · balanced-workhorse · high-judgment · independent-family-verifier* — with the current claude mapping (haiku/sonnet/opus) recorded as "implementation v1", plus the seat→tier table matching the live census with a one-line *why* per seat-class; **(b)** the never-do list (no auto-switching, no LLM-judge-as-sole-metric, no silent tier changes, same-model consensus ≠ independent truth, absent data is never estimated); **(c)** 5 metric definitions with formula + data source named (cost/accepted-output, retry rate, escalation rate, review escape rate, council Brier) — defined, not yet instrumented; **(d)** the engine trigger restated as numbers (monthly AI spend > ₹N, or public-prep start, or provider event) with where each number is checked; **(e)** the **model-fingerprint block** definition (MP-F); **(f)** the **emergency fallback clause** (MP-A); **(g)** the **exploratory-trial freedom clause** (MP-A); non-negotiables cite Constitution A1/A2/A4/A6/A7/A9; kickoff-lint exit 0 | 0 | active |
| REQ-02 | A council question that needs verification but not a full panel costs a **fixed, predictable** middle price | `/arc-council standard "<q>"` documented in `arc-council.md` and run once for real inside its envelope: **≤2 researchers + 3 stances + 1 verifier — max 6 seats, ≤7 model calls** (the existing send-back-once-if-nothing-contested guard is the only extra call); **no domain experts, no juror, no rebuttal round** — post-verifier `Contested`/`DISPUTED` IDs go straight to `## UNRESOLVED`, never debated; **no auto-upgrade**: if 2 researchers can't cover the question, the run says so and the human explicitly chooses `deep`; saved session passes `council-lint --verdict` (any new lint check WARN-first) and carries a `Mode: standard` line; `deep` stays default (ADR-0002 untouched) | 1 | active |
| REQ-03 | The composer-tier question is answered by a **fair paired experiment**, not a historic comparison | **Paired same-commit design (supersedes v1's historic-baseline comparison):** at one pinned commit, on the existing `lexos-case-workspace` brief, the director assigns the 3 theses + art directions ONCE; then two explore runs share them verbatim — run-S (3 workhorse composers) and run-O (3 high-judgment composers), same renderer recipe, same reference screen. Owner pre-registers a one-line PREDICTION, then blind-ranks all **7 items** (6 pages + reference, shuffled labels) before any arm identity is revealed; jury ranking runs the same 7 blind. Each arm records its **fingerprint (MP-F) + wall-clock duration + visible statusline cost** (absent fields stay absent). Keep/revert decided in a one-page ADR by the fixed formula: **keep high-judgment tier only if the blind ordering shows a material, owner-visible quality gain AND the owner explicitly accepts the recorded cost/time delta** — "slightly better" alone reverts. Historic `explore/lexos-case-workspace-v2` is context, never a comparison arm | 2 | active |
| REQ-04 | The council's honesty loop starts producing data **without manufacturing any** | Session 001 retrofitted in place per council-v2 ADR-0010 (Review-by + Resolution appended); `council-calibrate --overdue` surfaces it (mechanism proven). Then the honesty fork: **if** the Resolution criterion is genuinely observable today → grade the real HIT/MISS via `/arc-council review`; **if not** → record `RESULT: UNRESOLVED` with a fresh future `Review-by:` and the cycle still passes — *the DoD is the working mechanism plus an honest grade, never a filled scoreboard*. A forced or vague HIT/MISS is a Truth-Law (E3) violation and fails this REQ | 1 | active |
| REQ-05 | Rejected attacker findings leave a trace | `arc-kickoff.md` step 5 (and the `/arc-change` mirror) changed from "reject → drop silently" to one line per rejection: `REJECTED: <finding> — <reason>` where reason is from the **fixed taxonomy**: `duplicate · out-of-appetite · unsupported · violates-no-go · already-covered · non-actionable`; proven on the next kickoff by ≥1 recorded rejection; any lint that learns to look for it starts WARN-first | 3 | active |

## Appetite

**3 days hard cap.** **Tier:** S
**Kill criteria:** at 1.5d (50%) if REQ-01 is not merged, the policy itself is contested —
STOP, take the contested article to `/arc-council standard`, bank nothing, retro. If the
REQ-03 paired runs cannot both complete by 2.5d, bank whichever arm finished as evidence,
drop the REQ to `BRIEF-composer-ab.md` with the partial receipts attached — never extend.

## Decisions to ADR at kickoff

| ID | Decision |
|---|---|
| MP-A | Policy outranks implementation: engine `router.yaml` and every future frontmatter `model:` change must cite or amend the policy ADR. **Two carve-outs, both part of the same decision:** (1) *Exploratory freedom* — a trial may use ANY candidate model in an isolated, receipted experiment (branch/worktree + fingerprint); only **production** tier changes require policy amendment. (2) *Emergency fallback* — on provider outage / security incident / severe model regression, a temporary tier/provider swap is allowed when a human explicitly approves it, it carries an expiry, its receipt records the reason, and a follow-up ADR lands within 48h. Neither carve-out is auto-switching. |
| MP-B | Seat-tier principle: judgment/irreversibility seats get the strongest tier; mechanical/scan seats the cheapest; **creative seats earn their tier through receipted A/B**, not through default frugality. REQ-03 is the first application. |
| MP-C | Council mode ladder fixed at three: `quick` (unverified take) / `standard` (fixed envelope: ≤2 researchers + 3 stances + 1 verifier, ≤7 calls, no experts/juror/rebuttal, contested → UNRESOLVED) / `deep` (full panel + juror, default). One-way-door decisions are always `deep`. No automatic classifier — the human picks the word, and an under-powered `standard` run recommends `deep`, never silently becomes it. |
| MP-D | Session-001 retrofit executes council-v2 ADR-0010 as written (in-place, append-only OUTCOME preserved) — this row pins that reading; no new sanction ADR needed. |
| MP-E | Reject-log format: exactly one line per rejected attacker finding, reason from the fixed six-word taxonomy (REQ-05), no rebuttal, no debate — a trace, not a process. |
| MP-F | **Model fingerprint discipline:** every experiment arm, calibration-relevant run, and policy exception records — provider · exact model id · agent role · agent-file/prompt commit SHA · input/brief SHA · timestamp · wall-clock duration · effort setting if visible · statusline cost if visible. **Forward-only** (never backfilled onto historic runs), and an unavailable field stays absent — recorded, estimated and fabricated are three different things and only the first is allowed (ADR-0048 spirit). Rides existing spine kinds' payloads — the closed vocabulary (ADR-0023) is not extended. |

## Non-negotiables

- **No engine code.** Nothing under `processes/`, no drivers, no `router.yaml`, no budget
  enforcement, no bench runner — those plans sleep until their own triggers (A8).
- **No auto model switching anywhere.** Every production tier change is a reviewed diff
  citing MP-A; the two MP-A carve-outs are the only exceptions and both are human-approved.
- The session-model pin stays personal (`settings.local.json`) — shared settings never gain
  a `model` key this cycle.
- Council remains additive-only; ADR-0002 (deep default) and the juror contract
  (ADR-0015..0018) untouched; `standard` never weakens `deep`.
- REQ-03 verdicts follow ADR-0047/0048/0049: blind ordering + owner's own eyes on the
  artifact; no absolute scores inside the loop; PREDICTION pre-registered before reveal.
- Fingerprints are forward-only and never estimated (MP-F).
- Every phase close leaves its receipt on the spine (existing kinds only).

## No-gos (this cycle)

Router/drivers/bench (own plans) · per-call cost enforcement · automatic complexity
classifier or auto-escalation · external-juror expansion · changing the design pipeline
beyond the REQ-03 paired runs · rewriting the 3-variant explore tooling · touching `terse`
output style or hooks · new spine event kinds · re-tiering any seat other than the REQ-03
experiment arm.

## Rabbit holes (named detours)

- **Benchmarking temptation** — REQ-03 is one paired experiment with receipts, not a
  paper. Sample-size and multi-model sweeps belong to `BRIEF-bench.md`.
- **Metric instrumentation** — REQ-01 *defines* five metrics; wiring them is engine
  territory. Define, link, stop.
- **Mode-ladder debates** — one fixed `standard` envelope (MP-C); refinements are retro
  material.
- **Fingerprint tooling** — MP-F is a discipline (fields in receipts humans/agents already
  write), not a collector script. Building a collector = engine work.

## Assumptions ledger

| Assumption | How we'd know it's wrong (trigger) | Phase that tests it |
|---|---|---|
| The workhorse composer seat is a live quality bottleneck | REQ-03 blind ordering interleaves the arms (no arm dominates) → assumption dead; workhorse stays, ADR records it with the fingerprints | 2 |
| A 2-researcher envelope covers a real slice of council use | 3 consecutive real `standard` runs each end "recommend deep" → envelope wrong, revisit at retro | 1 |
| Owner sustains ~30 min/week for calibration dogfood | 2 consecutive skipped weeks after REQ-04 → cadence unrealistic, shrink to fortnightly by ADR note | 3 |

## Pre-mortem (top 5 — seeded from history first)

| # | Failure cause | Mitigation or accepted |
|---|---|---|
| 1 | Policy becomes a poster (constitution draft precedent: unadopted for weeks) | Adoption IS Phase 0's exit: ADR merged + receipt emitted; kill criteria names it |
| 2 | Paired A/B still confounded (theses drift between runs, renderer recipe differs) | ONE director assignment shared verbatim by both runs; same pinned commit; RECIPE field equality checked before ranking; any drift = re-run the arm, not "note it" |
| 3 | Retrofit read as violating append-only law, or graded under scoreboard pressure | MP-D pins the ADR-0010 precedent; REQ-04's honesty fork makes UNRESOLVED a passing outcome — E3 outranks a pretty scoreboard |
| 4 | Scope creeps into the engine ("while we're here, one small driver…") | No-gos + kill criteria; engine-shaped asks route via `/arc-change` into the engine plan's queue |
| 5 | `standard` cannibalizes `deep` and calibration data thins out | MP-C maps one-way doors to `deep` mandatorily; retro checks the mode mix after 2 weeks |

## External dependencies

None real (all internal machinery). The optional cross-model juror env stays optional and
untouched.

## Phases (risk-ordered)

| Phase | Capability | Appetite |
|---|---|---|
| 0 | **Steel thread = the policy itself.** Balanced Model Policy ADR written (all seven content blocks a–g), linted, merged; receipt emitted (REQ-01) | 0.5d |
| 1 | Council `standard` mode live inside its envelope + one real run; session-001 retrofit + honest grade-or-UNRESOLVED; overdue discovery proven (REQ-02, REQ-04) | 0.75d |
| 2 | Paired composer A/B: shared director assignment, run-S + run-O at one commit, blind 7-item rankings, fingerprints + duration + visible cost, keep/revert ADR (REQ-03) | 1.25d |
| 3 | Attacker reject-log with taxonomy (REQ-05) + one dogfood pass over the mode ladder + retro; trial-ledger rows for anything WARN-first | 0.5d |

**North-star:** when the engine trigger eventually fires, its kickoff copies its routing
table, escalation defaults AND receipt schema FROM the policy ADR instead of deciding
them — measured by the engine kickoff needing zero new "which model where" forks.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (only after C4 closes)

```
/arc-kickoff --lane model-policy Balanced Model Policy — pre-engine model discipline

Design source: docs/strategy/plans/PLAN-model-policy.md (v2, approved; trigger fired: C4
closed <date>). Read it fully. Decisions MP-A..F are locked; assign them the next free ADR
numbers. REQ-01 is the steel thread — the policy ADR merges in Phase 0 or the cycle stops.
REQ-02's envelope and REQ-03's paired same-commit design are fixed — do not substitute a
historic-baseline comparison. No engine code of any kind (see No-gos); anything
engine-shaped becomes a note in PLAN-engine-process-layer.md's queue. STOP after PLAN.md +
phase specs + kickoff-lint pass — I approve before Phase 0 work.
```

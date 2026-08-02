# PROGRESS.md — Cycle 5 · model-policy "Balanced Model Policy"

status: IDLE
cycle: model-policy (Cycle 5, closed 2026-08-02)
phase: — (cycle closed)
appetite: 3d
burn: 0.7d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green + live demo + exit criteria + evidence). Evidence over assertion.
> Design source: [`docs/strategy/plans/PLAN-model-policy.md`](../../docs/strategy/plans/PLAN-model-policy.md)
> (v2.1 FINAL, owner-approved) — an input to this cycle, never a second truth.
> Predecessor (Cycle 4 · arc-portfolio) CLOSED 2026-08-02 at ~112% appetite.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — the Balanced Model Policy ADR-0069 written (blocks a–g), linted, merged (REQ-01) | 0.5 days | ✅ done 2026-08-02 |
| 01 | Council `standard` mode + one real run; session-001 retrofit + honest grade-or-UNRESOLVED (REQ-02, REQ-04) | 0.75 days | ✅ done 2026-08-02 |
| 02 | Paired composer A/B at one pinned commit; blind 7-item rankings; keep/revert ADR (REQ-03) | 1.25 days | ✅ done 2026-08-02 |
| 03 | Attacker reject-log with fixed taxonomy (REQ-05) + mode-ladder dogfood + retro | 0.5 days | ✅ done 2026-08-02 |

**Appetite burn: ~0.7 of 3 days used (~23%) — CYCLE CLOSED UNDER APPETITE.**

Basis, so it can be audited rather than believed: kickoff commit `61995eb` landed 15:32 IST
2026-08-02 and the cycle closed at 21:08 — **~5.6 hours wall clock**, counted at an 8-hour
day. Not one of the four kill-criteria tripwires fired (1.25d Phase-01, 1.5d REQ-01, 2.5d
REQ-03, 100%).

**Read that number with its caveat, which is large.** This is *agent* wall-clock, not
owner-hours, and it is the first cycle in arc's history where most of the execution was
agent-parallel: six composers built simultaneously, two researchers and three council stances
ran in single batches. The owner's own time in this cycle was roughly one approval, one
council question, and one 6-item blind ranking. Comparing 0.7d here against Cycle 4's 3.35d
is comparing two different units, and the retro should say so rather than celebrate a 4×.

The one thing the number genuinely shows: **zero-slack planning did not blow up.** Phase
appetites summed to exactly 3.0 of 3.0, which `kickoff-lint` warned was "its own fiction" —
and the fiction never had to be tested, because nothing overran.

## Done-log

**Phase 00 — closed 2026-08-02.** `docs/adr/0069-balanced-model-policy.md` merged with all
seven blocks (a–g); `kickoff-lint` exit 0; census reconciled 27 = 1 haiku + 22 sonnet + 4
opus against the live tree.

*Red→green, as specified:* the 0069 index row was added **before** the file existed, which
failed `[adr]` with `ADR 0069 in index but docs/adr/0069-*.md not found`. Writing the ADR
turned it green. Evidence: `evidence/phase-00/01-lint-RED.txt` → `02-lint-GREEN.txt`.
The spec had predicted `[adr-wired]` would fire; the real run proved it is `[adr]`
(`[adr-wired]` is WARN-only and returns before it is reached) — the spec was corrected to
match the code before the phase closed, not after.

*What the verification pass caught, after the phase looked done.* Two fresh-context agents
read ADR-0069 against the tree and found **7 defects the author could not see**, all fixed:
- `ADR-0023` cited for the closed event vocabulary — it is **ADR-0026**. The same error was
  in ADR-0068, corrected there too.
- metric 1 named spine kind `phase.done`, which **does not exist** in the closed 18-kind
  vocabulary → `phase.closed`.
- metric 5's formula read `PREDICTION` vs `RESULT`; `council-calibrate.mjs` actually buckets
  **`CONFIDENCE:`** against the terminal `## OUTCOME`'s `RESULT:` and never reads PREDICTION.
- the ADR asserted "Cycle 5 Phase 1 starts the first graded session" — predicting data REQ-04
  explicitly permits *not* to exist. Block (b)(5)'s own prohibition, broken by its own ADR.
- metrics 3 and 5 contradicted each other on which one this cycle produces data for.
- **`ADR-0015..0018` and `ADR-0002` resolved to the root namespace** (manifest ADRs, "Noise
  defense") when they meant council-v3 / council. This is precisely the cross-namespace trap
  MP-D was written to warn about, walked into by the cycle that wrote MP-D. Corrected in
  ADR-0069, ADR-0065, and all 5 lane files (byte-identical, `nonneg-drift` holds).
- ADR-0069 promised the engine inherits "escalation defaults" that **no block of it defines**
  — and could not define them, since auto-escalation is a standing no-go. It now hands over a
  *constraint* instead, and flags that `PLAN-engine-process-layer.md`'s ENG-E ladder
  (`retry-once-same → one-tier-up → flag human`) conflicts with block (b)(1). Queued in that
  plan for its own kickoff; not edited into its body.

*Adoption, not just authorship (pre-mortem row 1).* A drift sweep found that **nothing an
agent loads every session pointed at ADR-0069** — the law existed and the reader who would
break it never met it. One rule added to `CLAUDE.md` Code standards. Without it, block (b)(3)
("a `model:` edit that arrives without citing this policy is a defect") had no surface.

*Known drift left deliberately unfixed:* ~10 further docs still name bare model products
(`docs/blueprint.md`, `docs/usermanual.md`, `docs/council/README.md`,
`docs/gstack-vs-arc-comparison.md` — which also says "7 agents" when the census is 27,
`docs/kickoff-v3-plan.md`'s competing `cheap/mid/sonnet-class` tier vocabulary,
`PLAN-design.md`'s creative-seat rows). None of it is *law*, all of it is stale prose. It is
a docs-drift sweep, not Phase 00's steel thread — carried to Phase 03 / `/arc-docs`.

## Assumptions status

| ID | Assumption | State |
|---|---|---|
| A-01 | Workhorse composer seat is a live quality bottleneck | **DEAD** — its own falsification trigger fired. Both blind rankings interleaved perfectly (owner `S O S O S O`, jury `O S O S O S`); neither arm dominates. Owner ranked workhorse above high-judgment 3–0 on same-thesis pairs. Recorded in [ADR-0070](../../docs/adr/0070-composer-seat-stays-balanced-workhorse.md) |
| A-02 | A 2-researcher envelope covers a real slice of council use | **open — supported by ONE data point, not validated.** Session 002 fitted a real, consequential question inside the envelope at 6 calls of a 7 ceiling. Its trigger (3 consecutive runs ending "recommend deep") cannot fire on one run |
| A-03 | Owner sustains ~30 min/week for calibration dogfood | **open — untestable this cycle.** The cycle ran in one day; "2 consecutive skipped weeks" needs two weeks to elapse. Carried forward unchanged |
| A-04 | No rupee spend threshold needed; the two event triggers suffice | **open — honoured** in ADR-0069 block (d), which names both event triggers with their check location and states plainly that no spend figure is set. Trigger unfired |
| A-05 | `arc-kickoff.md` is the only surface where a finding is rejected | **open — HELD, re-verified at phase time.** `/arc-change.md` still contains zero occurrences of reject/attacker/panel. No mirror was invented to satisfy the parenthetical |
| A-06 | A real kickoff will run within 14 days of close to exercise the REQ-05 reject line | **open — LIVE and now load-bearing.** REQ-05 closes "implemented, unproven": the reject line exists but no kickoff has produced one yet. Trigger: 14 days with no `REJECTED:` line recorded anywhere → re-validate or re-scope |

## Now

**Position: CYCLE 5 CLOSED.** All four phases done, all five REQs validated, burn ~0.7 of
3 days, no tripwire fired. Nine ADRs landed: 0063–0068 (MP-A..F), 0069 (the policy itself),
0070 (the composer verdict).

arc's model usage is no longer taste encoded in 27 frontmatter lines. There is one written
policy that an agent actually **meets** — `CLAUDE.md` points at it, which a drift sweep found
nothing else did. All four discipline fixes landed: council `standard` tier, the calibration
loop unblocked and honestly graded, the composer tier answered by a paired A/B, and a trace
on rejected attacker findings.

**What this cycle did NOT establish — recorded so nobody claims otherwise later:**

- **No absolute design quality bar.** No reference screen existed, so ADR-0070 compares the
  two arms and nothing more. Ranking N candidates always yields a winner and never a bar.
- **No cost figure.** `statusline cost: absent` on both arms, deliberately not estimated.
  "Cheaper" rests on public list prices, not on anything arc recorded.
- **No mode mix.** One `standard` run, zero `quick`, zero `deep`. ADR-0065's cannibalisation
  trigger cannot be read on one run and stays armed and unfired.
- **REQ-05 is implemented but UNPROVEN.** A-06 is live: no kickoff has yet produced a real
  `REJECTED:` line.

**Next:** lane is IDLE. `/arc-kickoff --lane model-policy` when a new cycle pulls it. The
engine cycle inherits ADR-0069 instead of deciding it — and inherits one flagged conflict:
`PLAN-engine-process-layer.md`'s ENG-E ladder has an auto-switching middle step that block
(b)(1) forbids, queued there for its own kickoff.

---

## Cycle record

Phase 01 delivered both its REQs and turned up two things the plan had wrong:

- **MP-D cited the wrong sanction.** Council-v2 ADR-0010 is the `CONFIDENCE` High→Medium cap
  and it was already executed 2026-07-15; it never covered `Review-by:`/`Resolution:`. The
  real authority is ADR-0012, which makes the retrofit an **append** rather than the one-way
  edit MP-D was built to justify. Corrected in ADR-0066, PLAN and this phase's spec.
- **A live false-positive in a shipped gate.** The retrofit note mentions `## OUTCOME` in
  prose, and `council-lint`'s section regex was unanchored — so it failed a *correct* session
  for documenting the contract it enforces. `council-calibrate` carried the identical regex
  and survived only by reading the last section. Both anchored; pinned in
  `tests/council-lint-outcome-anchor.bats` with a negative control and a `/m`-regression test.

**Session 001 graded `UNRESOLVED`, scoreboard still 0 scored — and that is the pass
condition, not a shortfall.** The verdict was CONDITIONAL and its condition was never
exercised. `council-calibrate` excludes UNRESOLVED from scoring rather than counting it a
miss. A forced HIT/MISS would have violated Truth-Law E3 and failed REQ-04.

**The `standard` mode was proven on a real owner question, not a test string** (assumption
A-02's whole point): *"should arc reach a self-standing good shape before any revenue
venture starts?"* → `docs/council/sessions/002-arc-first-vs-venture-first-sequencing.md`.
Ran inside the envelope at **6 seats / 6 model calls** (ceiling 6/7 — the send-back guard
was not needed because the verifier contested 6 of 15 points on its own). Verdict **NO /
Medium**; the Chair's pre-registered prediction was CONDITIONAL and **did not hold** —
recorded in the session rather than quietly dropped.

Two honesty items from that run are recorded in the session file itself: the Chair put a
**wrong date in the Evidence Brief at [High] confidence** (anchoring the venture trigger to
Cycle 2's *kickoff* instead of its *close*), which all three members inherited and the
verifier caught; and the brief's own framing **leaned against** the proposition, which is why
confidence is held at Medium.

Plan approved by the owner 2026-08-02 (spine `01KZ0VF0ZN0PC1RXS43SZF1EMX`). Burn ~0.35 of
3 days — see the basis and its caveats above before reading that as slack.

**What was decided without asking:** MP-A..F were locked by the owner in the design source
and are recorded as ADR-0063..0068. Two forks the fork-planner raised were, at the owner's
explicit instruction, put into the assumptions ledger with falsification triggers rather
than answered now — **A-04** (the engine trigger's ₹N spend figure, which exists nowhere in
the repo) and **A-05** (REQ-05's `/arc-change` mirror, which does not exist in
`arc-change.md` under any name).

**Phase 02 — the paired composer A/B (REQ-03).** The `design-jury` 4-vs-7 fork was resolved
as option **(a)**: a per-invocation prompt override, agent file untouched, logged as a
documented deviation. It became a **6**-item ranking, not 7, because no reference screen
existed and fabricating one was refused.

Every fairness condition was asserted **before** either arm ran: same pinned commit
`e46bbda` · one director assignment · `thesis.txt` SHA-256 equality per variant · identical
prompts differing only in tier · one render command, identical recipe on all six ·
`PIN_FONT=0` so typography survived into the judgement.

**The result went against the intuition that motivated the experiment.** The owner's blind
ranking put workhorse above high-judgment in **all three** same-thesis pairs (3–0); the jury,
ranking the same six blind and independently, came out 2–1 the other way. Both rankings
alternate perfectly — neither arm dominates, which is A-01's own death condition. The owner
was shown the unsealed result, told plainly his ranking had gone 3–0 against the premium
tier, offered a documented override, and **chose to follow the pre-registered formula**.
→ [ADR-0070](../../docs/adr/0070-composer-seat-stays-balanced-workhorse.md).

Recorded honestly in that ADR: **no owner PREDICTION was pre-registered** (REQ-03 required
one; the ranking was submitted directly, so the prediction-vs-result comparison does not
exist and cannot be reconstructed), high-judgment was **not slower** (58.0 min vs 80.5 min
total), and the **rupee delta is unmeasured**.

**Phase 03 — reject-log (REQ-05).** `arc-kickoff.md` step 5 now records one line per rejected
attacker finding against the fixed six-word taxonomy. A-05 re-verified at phase time:
`/arc-change` still has no mirror, and none was invented. The mode-ladder dogfood is recorded
as **partially met and not padded** — running a `quick` and a `deep` purely to tick the row
would be manufacturing usage, the same thing REQ-04 refused.

**Carried out of Phase 01, unrelated to this cycle's REQs:** the council's `NO` verdict names
a 5-minute action with outsized leverage — define what *"Cycle 2 closed"* means. That one
word fixes when the venture trigger fires and settles whether four inserted cycles were
compliant. It is the owner's call, not this lane's work.

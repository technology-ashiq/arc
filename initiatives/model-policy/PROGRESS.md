# PROGRESS.md — Cycle 5 · model-policy "Balanced Model Policy"

status: LIVE
cycle: model-policy (Cycle 5, opened 2026-08-02)
phase: 02
appetite: 3d
burn: 0.35d
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
| 02 | Paired composer A/B at one pinned commit; blind 7-item rankings; keep/revert ADR (REQ-03) | 1.25 days | 🔨 in progress — both arms building |
| 03 | Attacker reject-log with fixed taxonomy (REQ-05) + mode-ladder dogfood + retro | 0.5 days | 🔨 REQ-05 done; dogfood + retro pending cycle close |

**Appetite burn: ~0.05 of 3 days used (~2%).** Basis, so it can be audited rather than
believed: Phase 00 ran 15:32→15:52 IST on 2026-08-02 (kickoff commit `61995eb` → final green
lint), ~20 minutes wall clock against a 0.5d appetite. Two honest caveats: this is *agent*
wall-clock, not owner-hours, and Phase 00 was pure document authoring — the cheapest phase
this cycle has. Phases 01–02 need real council runs, real explore runs and the owner's own
eyes on 7 pages; none of that will scale like this. Do not read 2% as "on track for 6x under".

Kill criteria are live from the first hour: at **1.25d** if Phase 01 has not closed →
re-forecast Phase 02 explicitly. At
**1.5d** REQ-01 unmerged → STOP, take the contested article to `/arc-council standard`,
bank nothing, retro. At **2.5d** if both REQ-03 arms cannot finish → bank the finished arm
to `BRIEF-composer-ab.md` with its receipts and drop the REQ. Never extend.

Phase appetites sum to exactly 3.0 of 3.0 days — there is no slack, by design. The two
tripwires above are the release valves.

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
| A-01 | Workhorse composer seat is a live quality bottleneck | open — tested Phase 02 |
| A-02 | A 2-researcher envelope covers a real slice of council use | open — tested Phase 01 |
| A-03 | Owner sustains ~30 min/week for calibration dogfood | open — tested Phase 03 |
| A-04 | No rupee spend threshold needed; the two event triggers suffice | **open — honoured** in ADR-0069 block (d), which names both event triggers with their check location and states plainly that no spend figure is set. Trigger unfired |
| A-05 | `arc-kickoff.md` is the only surface where a finding is rejected | open — ledgered at owner's instruction, tested Phase 03 |
| A-06 | A real kickoff will run within 14 days of close to exercise the REQ-05 reject line | open — added by the attack panel; carries Phase 03's "implemented, unproven" fallback |

## Now

**Position:** **Phases 00 and 01 are CLOSED.** REQ-01, REQ-02 and REQ-04 → validated.
Remaining: REQ-03 (Phase 02, the paired composer A/B) and REQ-05 (Phase 03, reject-log).

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

**Next step:** Phase 02 (REQ-03, the paired composer A/B), appetite 1.25d — **awaiting the
owner's sign-off to move past Phase 01**, a human gate by design.

Phase 02 is the cycle's most expensive phase and it has **one decision that must be made
before either arm runs**, not during: `.claude/agents/design-jury.md` is hard-coded for
exactly FOUR items ("one line, four entries, exactly this form"), while REQ-03 asks for a
7-item blind ranking. The spec requires choosing **(a)** a per-invocation prompt-only
override to `item-a`…`item-g`, logged as a documented deviation, or **(b)** two separate
4-item panels with the ADR stating plainly that no single 7-item ordering was produced.
Left undecided it surfaces mid-run inside a phase with zero slack.

The owner also owns three non-delegable steps in Phase 02: writing the PREDICTION before
seeing any output, blind-ranking the pages **with their own eyes** (retro 2026-07-30 — an
agent's report about a screenshot is not the screenshot), and accepting or rejecting the
recorded cost/time delta.

**Carried out of Phase 01, unrelated to this cycle's REQs:** the council's `NO` verdict names
a 5-minute action with outsized leverage — define what *"Cycle 2 closed"* means. That one
word fixes when the venture trigger fires and settles whether four inserted cycles were
compliant. It is the owner's call, not this lane's work.

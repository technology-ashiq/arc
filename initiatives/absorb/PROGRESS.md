# PROGRESS.md — arc-absorb "the technique refinery"

status: LIVE
cycle: arc-absorb (Cycle 10, born 2026-08-09)
phase: 04 — CLOSED (all five phases done, 8 of 8 REQ met)
appetite: 8d
burn: 6.5d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane absorb` on 2026-08-09 and claims **ADR band
> 0600–0699** (ADR-0600..0606). Company organs (`docs/adr/`, `docs/retro-log.md`,
> `docs/trial-ledger.md`, `tests/`) stay at root and are never copied here (ADR-0053); evidence
> is lane-scoped at `initiatives/absorb/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-absorb.md` v1.0 (frozen — the decision record, not
> the cycle). ABS-A..F are locked there; **ABS-G was decided at this kickoff as ADR-0606**.
>
> **Birth condition — read this before questioning the cycle's legitimacy.** None of the design
> source's three gates passed on 2026-08-09: the live slot was held by leads and policy, the
> venture clock ran to 2026-08-11, and **no trigger arm had fired**. The owner was shown that
> audit and ruled arc-first. **ADR-0074** records the ruling, defers the venture clock explicitly,
> waives the four-arm trigger gate for this cycle only, and **flags the A8 tension for the owner
> rather than resolving it**. A later session that notices "no arm fired" should read ADR-0074,
> not reopen the question.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread: the matrix and its paperwork — DEV-B/C boundary audit, registry shape finalized, ADR-0601 template + `report-lint` (WARN-first) | 1d | ✅ CLOSED 2026-08-09 |
| 01 | Study harness, hostile-input-first — read-only pipeline, injection red corpus, adversarial pass, no-execution boundary fixture-proven **or STOP** | 2d | ✅ CLOSED 2026-08-09 |
| 02 | Registry and guards — status lint (cap 12, displacement, decision-ref), allowlist lint, license/attribution gate, PLANOFF skeleton | 1d | ✅ CLOSED 2026-08-09 |
| 03 | Governance drop — ADR-0603 owner-judge profile + blind mechanics + inbox chain, REQ-05 `PLAN-develop` addendum + freeze-log line + Toolbox template | 1d | ✅ CLOSED 2026-08-09, one row open by owner decision |
| 04 | The real absorb — ADR-0606's target end-to-end, 3-fixture A/B, sealed-blind judgement, adoption proposal, decision recorded, retro | 1.5d | ✅ CLOSED 2026-08-10 |

**Appetite burn: 6.5 of 8 days used — the cycle closes with 1.5d unspent.** *(Was 5.0 here and in the machine header while the Now
section and the retro scoreboard row both said 5.5 — the retro day was worked and never counted.
Caught by `board-lint`, which compares the board against this header and cannot see a header
disagreeing with its own file. Three sources, one of them wrong, and the number nobody recomputed
started lying — which is the thing `PORTFOLIO.md`'s own preamble warns about.)* Planned allocation
6.5d, leaving 1.5d slack. Kill tripwire at
4d (50%): if Phase 02 is not done, a scope-cut conversation is mandatory. **Phase 00: ~0.5d against
1d** (pre-planned cut order never needed, no cut taken). **Phase 01: ~1.5d against 2d**, and the
adversarial pass was paid for out of the phase rather than out of slack, which is what the plan
requires.

## Done-log

- **2026-08-10 — Phase 04 CLOSED ✅** *The real absorb, end to end — and the result went against the
  technique before the owner overruled it.*
  **The rebuild was never blocked by the allowlist.** Amendment 1's last word on T-01 was "blocked",
  and `docs/playbooks/**` had been allowlisted since ADR-0602 was written — it only read as
  unavailable because the directory did not exist. Landed as
  `docs/playbooks/finding-verification.md` with `.claude/commands/arc-audit.md` as its caller
  (**ADR-0602 Amendment 2**, route 2 taken unchanged). Allowlist byte-identical, `.claude/agents/**`
  still off it, **the DO-NOT-WIDEN ruling of 2026-08-09 unreversed.**
  **REQ-03 and REQ-08 now MET — 8 of 8.** The loop ran end to end: study → report → classification →
  rebuild → 3-fixture A/B → sealed-blind judgement → adoption proposal → decision recorded.
  **The measurement, and the number that argues against it.** `ab-run` on 22 candidates across 3
  fixtures built by an agent held blind to the rebuild: the claimed class removed **3/3**,
  `true-lost` **0**, verdict **NEW-WINS** against a pass condition committed in `fd82315` *before the
  harness existed*. And the main report goes **22 findings at 63.6% true → 13 at 61.5%**, because
  **6 of the 9 demoted are TRUE**. Computed after the run, reported ABOVE the verdict line, with a
  test pinning that position so a later tidy-up cannot bury it. 5 of 8 false findings are untouched:
  a byte-match cannot judge whether a quote supports its claim, and the playbook says so.
  **TWO OWNER RECEIPTS POINT DIFFERENT WAYS AND BOTH STAND.** The blind A/B pick
  (`01KZN380GP5EDF58H6VRTT0S0T`) chose the **OLD-WAY** report — *"findings neraya iruku"*. The
  adoption decision (`01KZN5H1E2RDHT9ZGQ4CSR85ZB`, *"adopt; appendix irundhaalum ok"*) **overruled my
  retire recommendation**. `RESULTS.md` had already recorded, *before the adoption existed*, that the
  pick looked like a judgement about presentation rather than about the rule — and refused to let that
  inference overturn it. The adoption settles it with a second receipt rather than by editing the first.
  **32 adversarial findings, two fresh agents, two surfaces, every one of this cycle's 15 defect
  classes recurring.** CI was 19/19 GREEN before either ran — fifth time in five phases. Three would
  have shipped harm: the rule was **strictly worse than no rule** on the ship gate (an unquotable
  CRITICAL in a severity-less appendix satisfied "zero CRITICAL remain open" and stamped the security
  ledger green) · an unguarded `rsync` aborted the whole sync on ubuntu/macOS when
  `docs/playbooks/` was absent, leaving a half-installed consumer repo · **my own negative control was
  vacuous** — the mutant's `SRC` resolved to an empty temp dir, so it copied nothing and "no playbook
  present" passed on total failure.
  **Four things the rebuild surfaced that outlive it:** the two sync twins disagreed about `docs/`, so
  the playbook shipped selectively and not in full mode — and the golden manifest is generated BY full
  mode, so the byte-identity gate structurally could not have seen it · `docs` was the only payload
  channel with a free-form dest, and `CLAUDE.md` / `.claude/settings.json` are traversal-free, pass
  every check, and get force-overwritten by both twins (confined in `product-lint` **and** the
  resolver, because the sync consumes the plan while the lint runs in CI) · `report-lint` required a
  citation to be *present* and never *resolvable*, the twin of T-01's own defect, which then caught a
  real one in this cycle's report · **ADR-0605 required "the results table travels WITH the adoption
  proposal" and nothing implemented it** — the fourth guard-with-no-caller of this cycle, in an ADR's
  own requirement, found while raising the artifact it governs.
  **Tests: 2022 → 2216.** **CI 19/19 green** on `675a07f`; merged as **`9535307`** (PR #149, a merge
  commit deliberately — squashing would destroy the protocol-before-harness ordering `RESULTS.md`
  cites). **Actual ~1.0d vs 1.5d.** `amendments: 1` (`/arc-change`, trivial & in-scope) · **2 ADR
  amendments** (ADR-0602 A2, and ADR-0605's lint implemented) · `reopened: 1` (Phase 04 itself).
  **Evidence:** `initiatives/absorb/evidence/phase-04/` (extraction-report, live-demo with verbatim
  command output, manifest — bundle **verified, 2 artifacts**) + the full PLANOFF bundle at
  `initiatives/absorb/evidence/planoff/PHASE04-T01/` (PROTOCOL, RESULTS, commitment, mapping, both
  rendered reports under their sealed labels). `phase.closed` **`01KZN5XRW9A61FPBJYSZQYD28M`** on the canonical spine in the main clone, read back out of `events/2026-08-10.jsonl`, 0 quarantined.

- **2026-08-09** — lane born. ADR-0074 (company: arc-first ruling, venture clock deferred, trigger
  gate waived for this cycle, A8 tension flagged) and ADR-0600..0606 (ABS-A..G) recorded. PLAN.md,
  five phase specs and this tracker written. `kickoff-lint` passed. Attack panel: 3 fresh agents,
  **18 findings, 17 accepted, 1 rejected** (`defer REQ-05 — unsupported`). Simulation gate:
  **8 blockers → 0** in one round.
- **2026-08-09 — Phase 00 CLOSED ✅** *Steel thread: the matrix and its paperwork.*
  **Shipped:** DEV-B/C boundary audit · `products/absorb/registry.json` (schema + zero rows) ·
  `products/absorb/manifest.json` · ADR-0601 template · `report-lint.mjs` (5 headings, 3 row
  fields, WARN-first) · `registry-ref.mjs` (resolution + A5 no-duplication) ·
  `tests/fixtures/absorb/lock-fixture.json` · two bats suites with mutant negative controls ·
  steel thread demonstrated end to end.
  **Tests: 31 added** (14 report-lint + 17 registry-ref); repo total 1934. **CI green 19/19 jobs**,
  read per-JOB conclusion on run `31300644910` — never the watcher's exit code.
  **Actual ~0.5d vs 1d appetite.** `amendments: 0` (/arc-change) · **1 ADR amendment**
  (ADR-0606 A1, forced by the audit) · `reopened: n` · `t-to-phase0: 0d`.
  **Two CI reds on the way, both instructive:** `sedi` is a per-file helper, not a `test_helper`
  export — assuming otherwise cost one cycle. And `products.bats:75` caught a product manifest
  landing with no CATALOG entry, which is exactly the defect its own comment predicts; it could
  only notice because it derives its expectation from `ls products/` instead of freezing a list.
  **Evidence:** `initiatives/absorb/evidence/phase-00/` — `dev-bc-audit.md`, `sample-report.md`,
  `steel-thread-demo.txt`. No `arc-evidence.sh` bundle: those begin at Phase 02 (ADR-0002).
- **2026-08-09 — Phase 01 CLOSED ✅** *Study harness, hostile-input-first.*
  **Shipped:** `study.mjs` (confined read-only walk, `--inventory` / `--read` / `--scaffold`) ·
  `.claude/commands/arc-absorb.md` · the hostile corpus at `tests/fixtures/absorb/hostile/` with a
  5-column `INDEX` (6 attack families committed, 2 constructed at run time and named) ·
  `absorb-study-boundary.bats` (27) · `absorb-hostile.bats` (8) driver.
  **Tests: 31 → 78 absorb tests**; repo total 1981. **CI green 19/19**, run `31303232950`, per-JOB.
  **Actual ~1.5d vs 2d appetite.** `amendments: 0` · `reopened: n`.
  **THE KILL CRITERION DID NOT FIRE.** The no-execution boundary IS fixture-proven: three mutants
  (install / import / eval), each asserted to trip an env-supplied absolute sentinel, plus a positive
  control proving the sentinels fire when executed directly — without which "no sentinel" and "the
  sentinel is broken" are the same observation. Assumptions row 1 is therefore **validated**, and it
  was the row whose failure would have STOPped the cycle.
  **The adversarial pass (2 fresh agents, different surfaces) rewrote most of the phase** — see the
  commit for the full list. The three that matter: `walk()` never recursed at all (every directory
  failed a file-only confinement check, so `--inventory` saw depth 1 while the report attested to a
  full walk); a report consisting entirely of a studied README quoted inside a code fence linted with
  **zero warnings**; and the hostile driver passed a stub that opened **no file**, proving the
  envelope's shape while claiming to prove the outcome.
  **Evidence:** the four suites and the corpus INDEX are the evidence for this phase; the two agents'
  findings are quoted in the commit body rather than duplicated into a file.

- **2026-08-09 — Phase 02 CLOSED ✅** *Registry and guards.*
  **Shipped:** `rebuild-lint.mjs` (ADR-0602 allowlist + parse-based dependency check + per-file
  attribution gate) · `registry-ref.mjs` extended with the status lifecycle, the 12-per-lane cap and
  its displacement rule · `products/absorb/allowlist.txt` as ADR-0602's single lint-readable copy,
  held against the ADR by a test **including the pattern count** · the PLANOFF skeleton.
  **Tests: 78 → 119 absorb tests**; repo total 2022. **CI green 19/19** on run `31304789752` at
  `e0677846`, verified to be this HEAD rather than an earlier commit. **Actual ~1.0d vs 1d.**
  `amendments: 0` (/arc-change) · **1 ADR amendment** (ADR-0605 A1) · `reopened: n`.
  **Evidence bundle written and verified** (ADR-0002, first phase owing one):
  `evidence/phase-02/` — `adversarial-pass.md`, `lint-demo.txt`, `manifest.json`.
  **ADR-0605 AMENDMENT 1 — I had put the PLANOFF bundle in a FROZEN directory.** `docs/evidence/**`
  is the sole canonical copy of pre-portfolio history (ADR-0058) and evidence is lane-scoped forward
  (ADR-0055). `planner-bench` sits there because it PREDATES the portfolio split. Mirroring its
  layout was right; mirroring its location was an inference I never checked. The bundle is
  `initiatives/absorb/evidence/planoff/`, and comparability is a LINK rather than an extension.
  **The adversarial pass returned 21 findings, 7 serious, and FOUR were my own fixes reopening** —
  full record in `evidence/phase-02/adversarial-pass.md`. Two claimed properties were falsified: the
  cap of 12 was evaded by varying the lane string, and lock-owned data nested under any key other
  than `lock_ref` was invisible. **And the gate had no caller at all** — `rebuild-lint` was
  reachable only from its own bats suite.

- **2026-08-09 — Phase 03 CLOSED ✅, with ONE ROW OPEN by the owner's decision.** *Governance drop.*
  **Shipped:** ADR-0603's payload profile at the SPINE boundary (`validate-absorb.mjs`, two lines in
  the shared validator) · the hash-commitment seal/reveal (`judgement.mjs`) · REQ-05's four-part
  cross-lane diff — `PLAN-develop` §7.1a, its freeze-log line, the `technique` verdict
  `capability-scout.md` never had, and `docs/templates/toolbox-template.md`.
  **Tests: 26 in `absorb-judgement.bats`**; repo 2077. **CI green 19/19**, run `31310632368`.
  **Actual ~1.5d vs 1d appetite.** `amendments: 0` (/arc-change) · **1 ADR amendment** (ADR-0603 A1,
  plus its enforcement clause) · `reopened: n`.
  **REQ-05 and REQ-07 VALIDATED. REQ-06 stays `active`** — its mechanism is fixture-proven but its
  live demo needs a real owner judgement on the real spine, and flipping it would assert a receipt
  that does not exist, in the phase whose whole subject is that a judgement must be a receipt rather
  than a memory. Approval `01KZJXBNKT6PEYC87TW5D53QTP` is queued and open.
  **Closed by the owner's explicit decision** — the leads Phase 04 precedent, where closing with a
  row open was likewise the owner's call and not the lane's.
  **Its adversarial pass: 22 findings, 6 HIGH, three falsifying properties outright** — the
  commitment preimage was not injective so `verify` said OK on a tampered mapping; a `--correlation`
  traversal wrote the plaintext into a git-tracked path; the blinding test survived blinding being
  deleted. Then two named blockers fixed: `--decision` accepted any string, and Amendment 1's
  `pick=` prefix was enforced nowhere — I wrote that sentence and did not implement it.
  **Evidence:** `evidence/phase-03/chain-proof.md` + manifest, verified.

## Now

**Current position: ALL FIVE PHASES CLOSED. 8 of 8 REQs met. The cycle is done at 6.5 of 8 days.**
`phase.closed` `01KZN5XRW9A61FPBJYSZQYD28M`. Phases 00–03 merged as `30dc9a9` (PR #138, main
re-verified `31353611593`); Phase 04's rebuild and A/B merged as `9535307` (PR #149).

**What this cycle actually proved, in one line: the machinery said yes, the owner's first receipt said
no, and neither was allowed to overwrite the other.** `ab-run` cleared the pass condition committed
before it existed. The blind A/B pick went to the OLD way. The adoption decision then overruled a
*retire* recommendation. Three receipts, three different positions, and the record carries all three
rather than the one that reads best. A refinery whose first candidate could only ever be adopted would
not have been a refinery.

**Phase 04 was REOPENED to get there** — not by reversing the owner's DO-NOT-WIDEN ruling, but by
taking a route ADR-0602 Amendment 1 had already recorded as legitimate and that nobody had noticed was
reachable.

**The rebuild was never blocked by the allowlist. It was blocked by the two targets the study
happened to name.** Amendment 1 listed three routes out; route 2 — a playbook under
`docs/playbooks/**` — has been allowlisted since ADR-0602 was written. It read as unavailable only
because `docs/playbooks/` did not exist, and because Amendment 1's own last word on T-01 was
"blocked". Amendment 1 also named route 2's failure mode ("a playbook nothing references is a guard
with no caller") and left a standing check ("any rebuild aimed at `.claude/commands/**` must first
check whether that body is compiled from `processes/`"). Both are answered by the same choice:
`.claude/commands/arc-audit.md` is the caller, and it is hand-written rather than generated — checked,
not assumed. Recorded as **ADR-0602 Amendment 2**. The allowlist is byte-identical; `.claude/agents/**`
stays off it; **the DO-NOT-WIDEN ruling of 2026-08-09 stands.**

**Assumptions ledger row 7, arm 2, FIRED 2026-08-09 — and went unmarked for a day.** Its trigger read
"finds the advantage came from outside the ADR-0602 allowlist", which is exactly what the study found
about T-01's *natural* home. Marked now, with what rested on it re-checked: REQ-03, REQ-08, Phase 04's
rebuild bullet and ADR-0606's target choice all survive, because firing arm 2 rules out the natural
home rather than every home. Arm 1 — whether the malformed-escape catch reproduces across three
fixtures or was one lucky probe — is the live one, and it is what the A/B tests.

**`/arc-change` classified this `trivial & in-scope`:** it executes Phase 04's existing "rebuild diff
confined to the allowlist" bullet on an allowlisted path. No new REQ, no new phase, no scope-cut
conversation — burn 5.5 of 8 (69%), the 4d/50% tripwire was conditional on Phase 02 being unfinished
and Phase 02 closed, and ~1d of the remaining 2.5d covers this.

**All owner actions on this lane were done as of 2026-08-09**, and one new one is coming: the
sealed-blind judgement on the A/B (REQ-03/REQ-08), which is a single command paste like the last two.

### ADR-0074's two waiver conditions, closed out BY NAME — neither on silence

Phase 04's DoD requires both stated explicitly, because *"this cycle was born because a clock and a
flag were both left to documents nothing re-read"*. Read from the board on 2026-08-10, not remembered:

**(a) The venture clock — the revisit trigger has NOT fired. The deferral stands.** Its two arms:
*the owner reprioritizes* — the opposite happened, arc-first was reaffirmed on 2026-08-10 (*"ne
concentrate panni complete panna vendiyathu absorb"*); *every arc lane reads IDLE with no open phase* —
**not met**, three of nine lanes are LIVE (absorb, leads, policy). The deferral's stated reason, that
the factory has unfinished work, is still literally true on the board rather than as a judgement. The
clock's own date, 2026-08-11, is also not yet past.

**(b) The A8 tension — STILL OPEN, and "arc first" is not the same statement as "A8 is resolved".**
ADR-0074 flagged A8 (*capability is built when a venture pulls it*) without touching it, because the
Constitution's amendment process is explicit that machines never amend, and recorded one reading as
the basis the cycle proceeds on: *lexos is the venture, it runs a root-mode arc install, so arc's gaps
are lexos's gaps*. **The owner has never been asked to confirm or reject that reading, and has not.**
He has reaffirmed arc-first three times — 2026-08-09 and twice on 2026-08-10 — which is a priority
call, not a ruling on whether the pull exists. Reading the second out of the first is exactly the
close-on-silence this bullet forbids. **Status: flagged, unconfirmed, and correctly still the owner's.**

### The assumptions ledger, all seven stated

| # | Assumption | Status |
|---|---|---|
| 1 | Read-only study is fixture-provable | **VALIDATED** — Phase 01, three mutants plus a positive control. This was the STOP kill criterion and it did not fire. |
| 2 | The 4-bucket matrix classifies real findings cleanly | **VALIDATED** — the real study produced 1 ABSORB, 2 SKIP, 1 ROUTE with no finding shoehorned and no bucket added. |
| 3 | Blind owner-judging costs minutes, not hours, and the owner is not queued behind another lane | **FIRED, on the second arm.** Phase 03's and Phase 04's picks did queue: the Phase 04 request also had to be handed over **twice**, because the first command carried no directory and the approval lived on a spine the paste could not see. Minutes-not-hours held; not-queued did not. Retro input. |
| 4 | 12 adopted per lane is the right cap | **MOOT this cycle** — the registry holds one row and it is `candidate`. Displacement was never exercised against real data, only fixtures. Untested, not validated. |
| 5 | The develop addendum is an uncontroversial cross-lane diff | **VALIDATED** — landed in Phase 03, no objection raised. |
| 6 | `report-lint` and the registry lint fail on a malformed input rather than passing it through | **VALIDATED, and then extended by an adversarial pass.** Both fail as designed; the pass then found `report-lint` required a citation to be *present* and never *resolvable*, which it now warns on. |
| 7 | PLANOFF-01's catch is a repeatable technique advantage, not sampling noise | **arm 2 FIRED 2026-08-09** (the advantage's natural home is outside the allowlist). **Arm 1 answered by the A/B on 2026-08-10:** not noise — the claimed class was removed 3/3 across three fixtures — but the main report's precision moved **-2.1 points**, because six of the nine demoted findings are true. Reproducible, and smaller than the framing implied. |

**REQ-06 is VALIDATED — mechanism fixture-proven AND live-exercised.** Approval
`01KZK9EPKCN0DJBW91QB67RYNP`, decision `01KZKBYSQ5J46Y82PRN7W3AJNH`, reason
**`pick=meridian; read clearer`**. The mapping revealed only after the decision landed:

```
meridian = reviewproc-with-verification-gate
crimson  = reviewproc-as-it-stands
```

**THE OWNER PICKED THE VARIANT CARRYING T-01, BLIND.** The labels come from a fixed pool of
information-free words, randomised per seal; nothing in the request said which was which, and the
mapping sat behind a hash commitment until a real decision existed. That is a genuine — if small —
blind preference for the review step carrying the pre-emit verification gate, and it is a receipt
rather than a recollection. Recorded in
`evidence/planoff/PHASE03-CHAIN-V2/RESULTS.md` and the planoff ledger.

**It is NOT an adoption and NOT REQ-03's A/B.** No fixture was executed — there is no absorbed-way to
execute, because ADR-0602 A1 leaves T-01 with no landing site. `T-01` stays `candidate` with
`decision_refs` deliberately EMPTY: filling it would let the cap lint read this as an adopted row.
**REQ-08 remains NOT MET.** One blind preference on wording is not evidence that a technique works,
and saying otherwise here would be the exact overclaim this lane exists to refuse.

**Two tools refused me today, and both were right.** `verify` caught that the first queued approval
was unrevealable *before* the owner spent a decision on it — its commitment predated the v2 preimage
fix. And `arc-evidence.sh` REFUSED to re-bundle Phase 03's evidence because that bundle belongs to the
close commit and rewriting it would overwrite evidence from another commit; the judgement went to the
PLANOFF bundle instead, which is where A/B evidence belongs. Respecting both guards cost two extra
steps and produced a cleaner record.

**Final REQ status:** REQ-01, 02, 04, 05, 06, 07 **validated**. REQ-03 and REQ-08 **active and NOT
MET**, by the owner's allowlist ruling rather than by running out of time.

**Next and last step: the retro.** The cycle ends at 5.5d of an 8d appetite with the mechanics banked,
one real study on the record, one real owner receipt, and two REQs honestly unmet.

**Five retro inputs banked, and a sixth from today.** CI was GREEN before three of the four
adversarial passes found their serious holes · four of Phase 02's seven serious findings were earlier
fixes of mine REOPENING · `arc-evidence.sh` reports "verified" on a zero-artifact bundle · a test that
only passes while the defect is present is a test FOR the defect · an allowlist can admit a path that
another lane's proof has frozen · **and a hash-format fix silently invalidates every outstanding
commitment, so a versioned preimage is not optional.**

**Unchanged and owner-owned elsewhere:** leads Phase 03 waits on the `_dmarc.automemory.ai` record;
policy Phase 04 on three `.claude/settings.json` edits.

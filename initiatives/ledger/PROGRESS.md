# PROGRESS.md — arc-ledger "the money brain"

status: IDLE
cycle: arc-ledger (opened 2026-08-12, closed 2026-08-13)
phase: 03
appetite: 8d
burn: 7d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> Evidence is lane-scoped at `initiatives/ledger/evidence/phase-NN/` (ADR-0055). ADRs, the
> retro-log, HISTORY and the trial-ledger stay at repo root (ADR-0053). This lane holds ADR
> century **1000–1099**; ADR-1000..1018 are locked there — 1016..1018 were written DURING the build, each because the implementation contradicted a decision made before it.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Money math core — payload contract + PII validator, normalization, pnl math on pinned fixtures, `arc pnl` v0, 2 export parsers, twin-determinism | 3d | ✅ CLOSED 2026-08-13 |
| 01 | Kill-distance — `ventures.yaml` schema + parser, distance / warning / crossing render, brief needs-you integration, receipt enforcement | 2d | ✅ CLOSED 2026-08-13 |
| 02 | Close and costs — reconciliation gate, `month.closed` (44 to 45), cost trichotomy + Overhead, daily spend line, `--explain` CUT | 2d | ✅ CLOSED 2026-08-13 |
| 03 | Proof — real-spine replay rendering honest-empty, `--simulated` demo view, evidence bundle, retro | 1d | ✅ CLOSED 2026-08-13 |

Phases sum to **8d against an 8d cap — there is no reserve.** That is deliberate and is recorded as
such: the shock absorber is the pre-authorized cut order (REQ-07, then REQ-08, then REQ-03's
80%-warning line), spent before the cap is rather than after.

## Appetite burn

**7d of 8d used (88%).** Phase 00 landed exactly on its 3d line; 01, 02 and 03 have run to 4d
between them against 5d planned, so the cycle is INSIDE its cap with 1d of headroom.

The 50% tripwire at 4d was satisfied rather than merely passed: REQ-01 and REQ-02 were green on
fixtures at the Phase 00 close, which is the condition it named.

**ONE cut order was spent, and spent on purpose: REQ-07 (`--explain`).** That is the first item on
the pre-authorized list, it was taken as a decision against the remaining day rather than discovered
after an overrun, and it is the whole reason the list exists. REQ-08 (`--simulated`) shipped, so the
second cut was never reached.

At 100% we cut or kill, never extend.

## Phase 00 adversarial pass — two fresh surfaces, 30 findings

Run 2026-08-13, two agents, neither having seen the implementation written. Their findings
overlapped on **nothing**, which is the two-surface rule earning its keep (retro 2026-08-03:
7 passes, 77 holes, near-disjoint by surface).

**Decision logic — the PII control did not work.** Through the real ingest path, a mobile number,
a dotted personal name, a name-plus-date-of-birth, a PAN and an Aadhaar number all reached the
spine, as did a mobile number in the *required* `provider_payment_id`. The comment beside the
grammar asserted they could not be spelled in it; two of its three claims were false. Tokens now
need the shape a machine issues, and the residual limit (`ashiq_ahmed1994` still passes) is
written down rather than implied.

**And the suite could not have caught it.** 34 of 37 fixture ids were rejected by the lane's own
grammar, so the whole MRR section and 3 of 5 determinism tests died at the validator before
reaching the code they test. **CI confirmed this independently** on run 31633673658: `not ok`
817-821 plus the four determinism tests, exactly the nine the attacker predicted, and nothing else
in the repo. Nothing in this lane had ever exercised MRR — which is why four money defects were
sitting behind it (MRR in native currency rendered as rupees, the all-time view counting every
subscription that ever existed, a refund booked to the wrong venture, a fully refunded charge
still reporting MRR).

**Shell and byte boundary — a file git could not diff.** A literal NUL byte in `pnl.mjs` made git
classify the money core as binary: `0 insertions, 0 deletions` on a 1473-byte change, invisible to
ripgrep, and silently exempt from the repo's LF policy. Separately, data after a closing quote was
concatenated onto the value, so `"1180"00` became 118000 minor units — 100x, while leaving
`net == gross - tax - fees` intact so every other check passed it.

**Three of my own tests were vacuous**, each green with the implementation deleted: the runner
could not tell a missing parser from a rejected input; the CRLF test asserted `rows=*`, which a
header-only file satisfies; and half the PII cross-assertions named a column their fixture never
had. All four suites now assert their own registered count, derived rather than pinned.

## Done log

**2026-08-13 — ALL FOUR PHASES CLOSED, cycle closed.** 00 (money math core, REQ-01/02/04) ·
01 (kill-distance, REQ-03) · 02 (close and costs, REQ-05/06) · 03 (the live-spine proof, REQ-08).
Green on run 31691123814, head `cf724d0`, 19 of 19 jobs read per JOB with the head SHA confirmed;
that run carries scheduler's Cycle 12 merge, so it is a fact about the merged tree. Evidence at
`initiatives/ledger/evidence/phase-03/`. Retro in `docs/retro-log.md`, four entries, each naming a
recurrence and the mechanism now in the tree that answers it. ADRs 1000–1018.

**2026-08-12** — `/arc-kickoff` completed: PLAN.md, ADR-1000..1015 and
phases/phase-00..03-spec.md written; `kickoff-lint` green (one WARN, the zero-slack line, kept
deliberately); `board-lint` clean.

**Attack panel ×3 (tier M): 20 findings, 19 accepted, 1 rejected.** Focus A (edge cases) 7/7 —
including that the over-refund comparison had no defined currency, so FX drift between a charge and
its refund could fire or suppress the flag on rate movement alone. Focus B (scope and hidden
dependencies) 5 of 6 — two CI-red dependencies verified against the tree before acceptance:
`tests/policy-brief.bats` derives its coverage list from `KINDS`, so `month.closed` without an
`arc-brief.mjs` `GROUPS` entry fails that suite shut; and `tree-manifest.txt` carries 32
`.claude/scripts/hq/` entries. Focus C (pre-mortem, retro-seeded) 7/7 — the sharpest being that
Phase 3's entire acceptance IS a zero, and retro 2026-07-28 is the record of a zero explained away
for four days inside the phase built to catch it.

```
REJECTED: shared root organs belong in the External dependencies table — duplicate
```

**Simulation gate: TWO NON-ZERO ROUNDS — 7 blockers, then 6.** All 13 were closed by spec and PLAN
edits, but the gate never returned zero and, per the kickoff process, a third round was NOT run:
two non-zero rounds make it the owner's call. Round 2's findings included three defects introduced
by round 1's own fixes — an Appendix A example that violated the grammar written to constrain it, a
100x prose-to-JSON mismatch in the money example, and a Verification plan naming `arc-pnl` as the
binary under test when PLAN said ingest runs through `arc-event`. Round 2 also forced two real
design answers: the PII validator belongs in `validate-ledger.mjs` inside the emitter's own
validation path (the per-family pattern already in the tree), making it unskippable; and the money
fields carry a stated invariant (`gross == amount + tax`, `net == gross - tax - fees`) rather than
one example to reverse-engineer.

Spine receipts on the canonical spine (main clone), both confirmed present in
`events/2026-08-12.jsonl` and absent from `_quarantine/`:
`kickoff.done` `01KZVJZ6X4C0KJ1Y0K9RM69S50` · `approval.requested` `01KZVJZFTJ85GDVAWBBDAPN751`.

## Requirements

| REQ | Phase | Status |
|---|---|---|
| REQ-01 P&L is true and reproducible | 0 | validated |
| REQ-02 MRR math survives its edge cases | 0 | validated |
| REQ-03 Kill-distance is visible and tamper-evident | 1 | validated |
| REQ-04 Currency honesty | 0 | validated |
| REQ-05 A month closes only behind a green reconciliation | 2 | validated |
| REQ-06 Costs are honest three ways | 2 | validated |
| REQ-07 Every number explains itself | 2 | **DROPPED — the first pre-authorized cut, taken** |
| REQ-08 Demo without lies | 3 | validated |

**REQ-07 is cut, and it is a cut rather than an overrun.** `--explain` was the phase's own declared
first cut, and at 7d of 8d there is one day left, which the Phase 03 retro and close need. The cut
order existed precisely so this decision is made against the cap rather than discovered past it.
REQ-08 (`--simulated`) shipped instead, so the second cut was never reached — it renders the same
views over `revenue.simulated` only, watermarked on every line, structurally separate rather than
filtered, and it is running against the live spine in the Phase 03 evidence.

## Phase 00 — CLOSED 2026-08-13

**Green on run 31641578789, head `b65772b`, 18 of 18 selftest jobs, read per JOB and the run's
head SHA confirmed equal to local HEAD.** The nineteenth job (`ci-tier`) failed on a docker build
fetching trivy — `curl` exit 56, a network read failure — and passed on rerun with no code change.
This branch touches no workflow, no Dockerfile and no tools image, which was verified rather than
assumed: treating an infrastructure blip as a code defect is the anomaly-explained-away shape in
reverse.

**REQ-01, REQ-02 and REQ-04 green.** Shipped: `validate-ledger.mjs` wired into the emitter's own
validation path so the PII contract cannot be bypassed · `money.mjs` (integer minor units, BigInt
FX, half-up pinned) · `normalize.mjs` (the one place a zone conversion happens) · `pnl.mjs` ·
`arc-pnl.mjs` and its wrapper · two export parsers over one summable row type · 16 fixtures ·
four bats suites, 70 tests.

**Five CI cycles, and every one caught something this box could not:** `product-lint` (8 files
synced into no product — bats never ran at all), the nine MRR and determinism tests, `spine-brief`
(hyphenated C2 ids after the grammar tightened), and the digest fixture a bulk rename had mangled.
Four of the five were invisible locally, which is the lane's own CI-is-the-only-gate rule paying
for itself.

**Shard weights measured, not guessed** (the promise `_known_gap` was written to keep):
money-math 47s, pii-validator 31s, parsers 30s, determinism 7s — against a default of 16.
money-math was under-weighted nearly threefold.

**Assumption FIRED — row 1.** No real provider export was obtainable offline, so both parsers are
pinned against a documented synthetic corpus and say so at the top of each file. Real redacted
samples remain owed before the first live ingest.

## Phase 01 — CLOSED 2026-08-13

**Green on run 31685435167, head `b529c41`, 19 of 19 jobs, read per JOB with the run's head SHA
confirmed equal to local HEAD.** REQ-03 green.

Shipped: `ventures.yaml` as a root company organ · a strict YAML-subset parser with no dependency
(duplicate keys refused rather than last-wins, tabs, leading zeros, anchors, flow style and Windows
device names all refused by name) · the criteria digest over PARSED values so comments and CRLF
cannot invalidate a receipt while any number does · the receipt gate · distance / 80%-warning /
crossing render · the brief needs-you integration · 51 tests across two suites.

**Two decisions this phase forced, both recorded rather than settled in code.** ADR-1017: ADR-1008
asked for a `decision.recorded` "naming the change", which is not implementable against a payload
closed to `decides|verdict|reason` — the digest rides an `approval.requested` PROFILE instead, the
third instance of a pattern already in the tree, and it costs ZERO event kinds. ADR-1018: ledger can
observe only one of the two v1 criteria, so ABSENT is a first-class status with a mandatory reason
that renders and is counted — absent-as-OK is the kill switch silently disabled forever, and
absent-as-CROSSED is a meter that is red on day one and muted by week two.

**The adversarial pass found three separate ways the kill switch disarmed itself at exit 0**, and
the parser survived everything else thrown at it (27 hostile byte-level documents, homoglyphs,
UTF-16, 100k ventures, digest-collision attempts). The worst was that `ARC_SPINE_ROOT` deleted the
panel AND the refusal — and this checkout is a linked worktree where that is the only way to run
the command, so the guard was off by default in the tree that wrote it. Also: a lint that never read
the file asserting in its own header that it was governed by that lint.

**A twin-fix miss cost a red CI cycle.** The two Phase 01 suites were updated for the venturesPath
change; the two PHASE 00 suites that call the same binary were not. 24 tests red. "Grep the pattern,
not the file", third recurrence in this lane.

## Phase 02 — the close and the cost trichotomy

Code green on run 31685435167 (19/19). Adversarial pass run afterwards found **four separate ways a
month closed GREEN that had no business closing**: an export whose period was never read (the repo's
own September fixture closed July), the P&L's own needs-you flags computed and discarded (an
over-refund, a cross-month duplicate, and every unlinked refund all invisible on the green path),
a guard that counted ROWS instead of MONEY, and `--simulated` silently dropped beside `--close`.
All fixed; re-verification on CI pending.

## Phase 03 — the live-spine proof

`arc pnl` on the **canonical spine** renders honest-empty, and the zero is corroborated rather than
accepted: a raw `readFileSync` + `JSON.parse` count over the day files is compared against the
reader's, agreeing on all 11 kinds and 1038 events, with the liveness control asserted FIRST — a
reader returning nothing would agree with a zero on every money kind while being completely broken.

`revenue.received` 0 · `revenue.simulated` 0 · `cost.incurred` 0 · **`month.closed` 0**. The
mechanism is proven against fixtures and has never run on a real month, because there has never been
a real month to close. That number is stated here rather than discovered later.

The genesis criteria receipt is on the canonical spine — `approval.requested[ledger.criteria]`
**`01KZX6D7J1D1FGKX8YGA4WQX1W`**, approved, confirmed present in `events/` and absent from
`events/_quarantine/` by listing both. Without it the merge would have made `arc-pnl` exit 3 and
`arc-brief` print NOT EVALUATED repo-wide; the worktree hid that because its spine guard fires
first. Evidence: `initiatives/ledger/evidence/phase-03/`.

## Assumption-ledger audit, 2026-08-13 — every count read from the live spine, not assumed

**2 VALIDATED · 3 NOT EVALUABLE · 1 FIRED · 1 HELD.** Full output in
`evidence/phase-03/assumption-audit.txt`. The three NOT EVALUABLE rows are dogfood-gated and are
recorded that way rather than as VALIDATED, which is the DoD's own wording and the harder half of
this step:

- **LexOS pricing lands subscription-shaped** — `revenue.received = 0`. The MRR path is
  fixture-proven only.
- **Fixture volumes are representative** — the spine holds 1040 events of all kinds and 0 revenue.
  No render can be near the 5s trigger until there is volume.
- **`month.closed` is accepted by the live validator** — `month.closed` on the live spine is **0**.
  The trigger is specifically "the first emission lands in `_quarantine` with `UNKNOWN_KIND`", and
  there has been no first emission. So this is UNTESTED IN PRODUCTION, not passing. Retro 2026-08-10
  records an engine shipping with four kinds and zero real emissions; this row is that number said
  out loud instead of discovered later.

**FIRED — provider exports obtainable.** No real export was reachable offline, so both parsers and
the `--reconcile-file` sum are pinned to a documented synthetic corpus and say so at the top of each
file. Real redacted samples are owed before the first live ingest.

Noted in passing, not this lane's to fix: the live spine's `events/_quarantine/` holds **241
records**. Retro 2026-07-28 records 22 quarantine entries that turned out to be 100 lost real
receipts, so the number is worth somebody's eyes.

## Now

**CYCLE CLOSED 2026-08-13. Mechanism proven, live value pending.**

All four phases closed. 7 of 8 REQs validated; REQ-07 (`--explain`) taken as the declared first
pre-authorized cut, against the cap rather than after an overrun. Burn 7d of 8d.

Green on run 31691123814, head `cf724d0`, **19 of 19 jobs**, read per JOB with the head SHA
confirmed — that run carries the scheduler merge, so the number is a fact about the MERGED tree
rather than about this lane in isolation.

**What is owed next, and it is not a gate on this closure:** the first real month closed behind a
green reconciliation, expected around September or October 2026 when LexOS earns. Real redacted
provider exports before the first live ingest. Both are live-value milestones, and the whole lane
was built so that neither has to be faked in the meantime.

**Closure language, verbatim and deliberate: mechanism proven, live value pending.** Every gate in
this lane has been exercised against fixtures and against the real spine, and not one rupee has
moved through it, because none exists yet. The live-value milestone is the first real month closed
behind a green reconciliation -- expected around September or October 2026 when LexOS earns -- and
it is explicitly NOT a gate on this closure.

**Assumption row 1 remains FIRED.** No real provider export was obtainable offline, so both parsers
and the reconciliation file path are pinned against a documented synthetic corpus and say so at the
top of each file. Real redacted samples are owed before the first live ingest. The adversarial pass
made this concrete rather than theoretical: nobody in this lane has seen whether a real settlement
file states gross or net, so the gate ships the net reading and prints all three numbers on every
blocker so the other convention is diagnosable in one read.

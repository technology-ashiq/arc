# PROGRESS.md — arc-policy "Enforced capability vectors"

status: LIVE
cycle: arc-policy (born 2026-08-06)
phase: 03 — in progress (00, 01, 02 all CLOSED)
appetite: 7d
burn: 4.6d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence over assertion.
> This lane was born by `/arc-kickoff --lane policy` on 2026-08-06 and claims **ADR band
> 0500–0599** (ADR-0500). Company organs (`docs/adr/`, `docs/retro-log.md`,
> `docs/trial-ledger.md`, `tests/`) stay at root and are never copied here (ADR-0053); evidence
> is lane-scoped at `initiatives/policy/evidence/phase-NN/` (ADR-0055).
> Design source: `docs/strategy/plans/PLAN-policy.md` v1.0 (frozen — the decision record, not
> the cycle). POL-A..POL-J are locked there; POL-K was decided at kickoff as ADR-0500.
> Prerequisite gate cleared before birth: the Constitution is **ADOPTED v1.0**, receipt
> `01KZ9V0QXNNMB3ZH18MSH8DKH3`.

## Phase table

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — the law, its parser **and the decision**: schema, canonical L0–L3 table, `policy-lint` (FAILs from birth), `resolveEffectivePolicy` + `authorizeAction` against fakes, hostile corpus green (static **and** runtime families), hook feasibility matrix generated from `.mcp.json` | 2 days | ✅ done 2026-08-06 |
| 01 | Headless enforcement — wire the Phase-0 decision into `arc-run` before any driver call, capability fixture matrix, deny-by-default at runtime, money guard with reservation flow and double-spend fixtures | 1.25 days | ✅ done 2026-08-07 |
| 02 | Receipts and interactive — vocab ADR (+4 kinds), promotion chain end-to-end through the inbox, automatic demotion, hook fragments, static deny floor and its cross-check | 1.25 days | ✅ done 2026-08-07 |
| 03 | Birth-rule and cap inventory, migration deferred by evidence | 0.25 days | ⬜ not started |
| 04 | **Adversarial security pass — two full days, untouchable** | 2 days | ⬜ not started |

**Appetite burn: ~4.5 of 7 days used (64%).** Phases allocate **6.75 of 7 days; 0.25 days of slack**,
**never taken from Phase 4**. The allocation changed at kickoff, after the simulation gate: Phase
0 went 1 → 2 days because a law-and-parser-only phase could not run its own runtime hostile
families or exercise its own reducer, and Phase 3 went 0.5 → 0.25 because its migration is
deferred by evidence rather than conditional. Phase 0's extra day is **not new budget** — it is
the day the kill criterion was already lending it, now allocated in the open.

**Tripwires:** REQ-01's exit not reached by end of day 2 → STOP and retro the schema scope —
and note that with Phase 0 now *allocated* 2 days, this means **no overrun room at all**. At 50%
burn (day 3.5) Phase 1 must be done, or the scope-cut conversation is mandatory. Phase 4 finding
an unclosable bypass class → STOP.

## Done-log

| Date | What closed | Evidence |
|---|---|---|
| 2026-08-07 | **Phase 02 CLOSED.** The four authority receipts (ADR-0508, vocabulary 40 → 44) and the emitter branch that makes them writable; the promotion chain live end-to-end through `arc-inbox`; automatic demotion on an overreach; both ADR-0501 layers with the cross-check; brief and inbox rendering. **The phase found that none of the four kinds could be emitted at all** — `arc-event` had no idem branch, so every policy receipt was rejected and quarantined while the emitter exited 0. 5 bats suites, 67 tests. `amendments: 0` · `reopened: n` | CI **31155440978, 19/19 green**; main re-verified **31155949595** · `initiatives/policy/evidence/phase-02/` (live-demo.md, handoff.md, manifest) |
| 2026-08-07 | **Phase 01 CLOSED.** The headless gate at `arc-run` **and** at `runDriver`, the governing root pinned to the code rather than `--root`, the money guard reserving under a lock that re-reads, and the demotion emitter at the action boundary. ~30 escalations from two fresh adversarial agents, all closed and pinned. 4 bats suites, 83 tests. `amendments: 2` (the demotion surface and the absence-matrix scope, both decided by the owner on 2026-08-07) · `reopened: n` | CI **31155440978, 19/19 green**; main re-verified **31155949595** · `initiatives/policy/evidence/phase-01/` (live-demo.md, handoff.md, manifest) |
| 2026-08-07 | **Phases 00–02 landed on `main`.** Not a phase close — 01 and 02 still owe their DoD (live demo + evidence bundle). Recorded because the code is now in the trunk and the CI story around it is the cycle's most expensive lesson: merged without CI (#117), reverted (#118), re-proposed and made genuinely green (#119) | CI **31148958597, 19/19 green** on `0f2d53d` · merge `8064706` · main re-verified by `workflow_dispatch` |
| 2026-08-06 | **Phase 00 CLOSED.** The law, its parser and the decision. `policy-lint` FAILs from birth; `authorizeAction` returns deny/propose/execute with everything injected; 54 hostile fixtures (30 static + 24 runtime, incl. 2 controls); 63-row feasibility matrix generated from `.mcp.json`; 88 new tests across 6 bats suites. **Two fresh agents found ~24 capability escalations against code that was green on its own tests** — all closed, all pinned. Red-first proven on CI run 31102122394 before any implementation existed | CI **31108185564, 19/19 green** · `initiatives/policy/evidence/phase-00/` (live-demo.md, handoff.md, hook-matrix.json/.md) |
| 2026-08-06 | Lane born. PLAN.md + 5 phase specs + **ADR-0500..0507** written. Verification: 4 plan-attackers (27 findings, 24 accepted, 3 rejected) and **8 plan-simulator rounds** — blocker count 7 → 6 → 6 → 3 → 2 → 2 → 3 → **1 HARD**, closed by naming which of two E2 readings wins. `kickoff-lint` green on every run. **Not a phase close** — recorded so the kickoff itself has a receipt | `kickoff.done` `01KZB1805TC27WCCMF3DHQRVM0` · `approval.requested` `01KZB1878PENK4YZ98VKQYPK1J` |

## Now

**Current position: Phases 00, 01 and 02 are CLOSED. Phase 03 is IN PROGRESS in this session and
Phase 04 follows on the same branch — the owner reassigned both here on 2026-08-07, superseding
the earlier note that Phase 03 belonged to a separate session. Nothing merges until 04 is done:
one branch, `feat/arc-policy-phase-03-04`, PR #130 held as a draft so CI runs on every push
without landing a half-finished security phase on main.**

**PHASE 03 — the birth rule is built and the cap inventory is taken.**
`kickoff-lint` carries `[birth-rule]`, WARN-first in TRIAL: a `processes/*.process.yaml` with no
`process:NAME` row in `hq.policy.yaml` is flagged. `policy-lint` already FAILed the *other*
direction of that relation — a row naming a process that does not exist — and nobody had ever
walked it this way, so a process could land ungoverned and no gate said a word. Deny-by-default
means such a module is read-only at L1, so this was never an escalation; it was a **silent
capability gap**, the module quietly unable to do what it was written for.

The resolution now lives once, in `.claude/scripts/hq/lib/policy/subjects.mjs`, and `policy-lint`
imports the function it used to keep private. Two gates reading one relation from two files is
the drift POL-D forbids, and its failure mode is the quiet one: both keep passing while the pair
of them stops covering the middle.

There is **no date and no git-history boundary** for "born after policy went live". All three
processes already carry rows, so the set is complete today and any new process without one flags
on arrival — no clock, and it survives a shallow CI checkout where `git log --diff-filter=A`
returns nothing.

**The gate may never FAIL, and the reason is not the usual one.** `kickoff-lint.mjs` is run by
every lane and is synced into consumer repos that have no policy engine at all, so a wrong FAIL
breaks a sibling lane's kickoff over a file it never touched. By the structural-vs-heuristic
principle in `docs/trial-ledger.md` this check would qualify to BLOCK from v1 — a file either has
a row or it does not. It is in TRIAL on blast radius, not on false-positive risk, and that
distinction is written into the ledger so `/arc-retro` does not promote it as trivially safe.

**Its silence today is worth nothing as evidence.** The gate printed nothing across all eight
lanes, which is correct and also tautological: it is same-author silence on a tree written
against the check, which `docs/trial-ledger.md` already refuses to score as accuracy twice over.
The ledger records those eight runs as **not counted** — the promotion count stays at zero until
a process is born in some other lane's change and the gate fires on it.

**THE INVENTORY'S ONE FINDING, AND IT CONTRADICTS THIS PLAN.**
`initiatives/policy/evidence/phase-03/cap-inventory.md` — 53 cited `file:line` rows reopened and
checked against the claim (53 matched, 0 missing), and the three load-bearing *negatives*
re-derived by grep rather than accepted, because a negative is where a survey is weakest: no
driver reads the budget it is handed, so `--budget inr` is a post-hoc stop rather than an
authorization and the money is already spent when `arc-run.mjs:438` checks; `concurrencyRefusal`
has no production caller at all; and the council `Seats: 6 max. Model calls: 7 max.` envelope has
no counter anywhere, enforced only by the agent choosing to obey.

REQ-07 defers migration on the stated ground that **no live cap-bearing module exists**. That
premise is false. `leads` is LIVE and ships the whole shape under ADR-0403 — ceilings frozen in
code, floors because *lowering* a window weakens a cap, env and flag overrides refused outright,
and `guardSend` throwing before the provider is contacted, reached from `sequencer.mjs:83` in
production rather than a test.

**The deferral holds anyway, and the reopening condition is now this.** REQ-07's own words are
that migration "reopens as new work the day a real module exists, never hunted for inside this
cycle's 0.25 days". The day has arrived, so the deferral stops resting on *"there is nothing to
migrate"* and starts resting on *"this is out of budget"* — a different and more honest sentence.
**What reopens it:** a new cycle, scoped to migrating `.claude/scripts/leads/lib/caps.mjs` and
`guard.mjs` onto the policy engine, owned by the `leads` lane and not by this one —
`initiatives/leads/**` is do-not-touch here, and ADR-0403 is their band. It is not conditional on
any further trigger; the trigger fired.

**Retired cap paths: none.** Nothing in the four surveyed areas is superseded or dead, so nothing
is attic'd (A10, ADR-0023). `concurrencyRefusal` is the nearest candidate and is explicitly **not**
retired — it is unborn rather than dead, never wired in the first place, and atticing another
lane's un-wired cap is not this lane's call.

**A harness defect found in passing, recorded rather than fixed.** `/arc-develop next` resolves
its ledger with `findLedger`, which returns the FIRST `phase-NN-tasks.md` holding any unproven
slice — for this lane that is phase 01, whose ledger was never filled because 01 and 02 were
built before the harness was used. So `next` is permanently pinned to a CLOSED phase, and it
wrote a Context Pack line into that closed phase's ledger before I reverted it. Phase 03 was
driven by editing `phase-03-tasks.md` directly. Fixing `develop.mjs` is the engine lane's call
and is not being done mid-phase from here; backfilling 01 and 02's ledgers to unstick it would
be fabricating evidence for closed phases, which is worse than the bug.

**CLOSED 2026-08-07, merged as `cf82928` (PR #128), main re-verified green by `workflow_dispatch`
run `31182279167`, 19/19 jobs — all 22 ungrouped kinds now hold a section, and the coverage gate
widened from `POLICY_KINDS` to the full derived `KINDS`, so the catch-all cannot silently refill.**
Filed 2026-08-07 through `/arc-change` and fixed the same day. The two entries below record the
catch-all being given a budget; this is the follow-through the second of them left open. Classified
a **bug** on the same grounds: the renderer's contract is to rank the day, and for exactly half the
vocabulary it did not.

**The assignments are not this lane's guesses.** The owner routed the question to each lane's own
session and relayed three answers back — `develop` (4 kinds), `evolve` (10), `leads` (7), plus
`constitution.adopted`, which is company-level and belongs to no lane. Every row below is that
lane's call. Two guesses were overruled with evidence and both overrules are adopted:

| Kind | Guessed | Lane's answer | The evidence that moved it |
|---|---|---|---|
| `outreach.replied` | `needs-you` | **`progress`** | Triage is fully automatic and `ingest.mjs:301` already emits `approval.requested` — a `needs-you` kind — for the one class of five that needs a human. Putting the parent kind there too double-surfaces one demand and drags the other four classes into the never-collapse tier with it. `bounce` is a `triage_class`, not its own kind, so one bad sending day would put twenty bounce receipts into the group that must never be buried |
| `deal.won` | `money` (hedged) | **`money`** (hedge rejected) | The hedge framed `money` as cash that moved. `revenue.simulated` is already in that group and ADR-0026 marks it *never in P&L*, and `spend.reserved` is an earmark — so the section's real rule is the money **view**, not cash movement. A `deal.won` with no matching `revenue.received` is an unpaid invoice visible in one glance, and that reconciliation only works if both sit in the same never-collapsing section |

`experiment.assigned` and `experiment.measured` went to `background` rather than `progress` for a
reason worth keeping: they are **per-unit**, not per-experiment (`validate-experiment.mjs:118-119`
require `unit_id`), so one live experiment is an N-hundred-line stream. `background` collapses
before the line budget is measured and `progress` collapses after — so a high-volume kind in
`progress` does not only collapse itself, it pushes `phase.closed`, `ship.done` and every other
lane's progress into a count on the same day. Group choice for a high-volume kind is a cross-lane
side effect, not a local preference.

**Three claims in those replies were checked against the tree rather than taken:**

| Claim | Source | Verdict |
|---|---|---|
| `metric.observed` is not in `KINDS` yet, so the assignment is advisory | evolve | **Wrong.** It is in the closed 44, via `LEADS_KINDS` (`validate-leads.mjs:44`, ADR-0400/0408). ADR-0308 made implementing it a no-go for *evolve*; the leads lane shipped it. `background` is adopted on evolve's volume reasoning, but the lane that may overrule it is `leads` |
| The `ungrouped` entry still carries a comment saying it never collapses | evolve | **Right, and it is this lane's own defect** — left stale by PR #125, one line under the code that contradicts it. Fixed in the same change |
| `amount_inr` is a non-negative integer in paise | leads | **Right** (`validate-leads.mjs:307`). Minor units, exactly what `moneyLine` reads — only the field *name* differs, so `deal.won` renders as a bare line in `money` until the leads lane widens the payload. That is their ADR band; not folded in here |
| The progress collapse will systematically eat rare state-change kinds | develop | **Already handled.** The collapsed head names every distinct kind with its count, sorted — `progress: 13 (commit.done 12 · phase.closed 1)`, verified on a sandbox spine. Nothing is dropped |

**Then the gate, which is the part that stops this recurring.** The coverage test in
`tests/policy-brief.bats` was deliberately scoped to `POLICY_KINDS` when it was written, because a
wider scope would have handed four other lanes a red test for a table this lane did not own. With
every kind assigned that reason expires, so it widens to the full derived `KINDS`. A lane adding a
kind now gives it a section in the same change or CI refuses — the obligation attached to the code
rather than to a line in a brief nobody was assigned to read. That is the honest answer to *who is
responsible for the catch-all*: until now, nobody, which is why it ran 22 kinds deep.

`slice.stuck` carries a caveat worth recording for whoever hits it next: develop reports it is two
signals under one name (`backstop: fingerprint-3x` is machine-directed, `attempts-5` is
human-directed), the section table keys on kind rather than payload, and so the more severe reading
wins. It has fired zero times to date, so a never-collapsing section costs nothing today. If it
ever fires at volume, it is the first kind in the vocabulary that will need payload-level routing.

**CLOSED 2026-08-07, merged as `6d3e3fb` (PR #125), main re-verified green by `workflow_dispatch`
run `31169800528`, 19/19 jobs — the catch-all group had no line budget.** Filed through
`/arc-change` and fixed the same day. Left in full below rather than deleted, because the defect is
a better record than its absence: it is the second time in two days that closing one failure in
this renderer opened another.

Phase 02 replaced `arc-brief`'s `if (group) push` with a fall-through to an `ungrouped` group, so a
kind the table does not know is now named instead of dropped. That closed a silent omission and
opened a loud one: `ungrouped` was placed in the never-collapse tier beside `needs-you` and
`money`, and those two are exempt for a reason that does not transfer — every one of their lines
needs human eyes. An ungrouped line does not; it is a kind waiting for its own lane to claim a
group, and the count plus the kind names carry all of it.

Measured rather than argued, on a sandbox spine: **50 `develop.started` / `slice.done` receipts on
one day render a 53-line brief against the 40-line one-screen budget**, 50 of those lines identical
and individually empty. With `leads` LIVE and 22 kinds routing to the catch-all, that is an
ordinary day rather than a pathological one, and the group that overflows is the one group holding
nothing a human must act on.

Fix, as shipped: `ungrouped` collapses on the same always-collapse rule as `background`, and the
collapsed head keeps its `— no group assigned in arc-brief.mjs` instruction, which is the only part
of that line telling another lane what it owes. The same 50-receipt spine now renders 3 lines;
`--full` still renders 53. Classified a **bug**, not new scope — a defect against the renderer's own
documented contract, shipped hours earlier inside Phase 02, so it took the `/arc-fix-issue` shape
(root cause → failing test → fix) rather than a REQ row. Cost ~0.05 days against the 0.25 days of
slack, never from Phase 04. Assumptions ledger scanned at intake: no trigger fired.

Four tests in `tests/policy-brief.bats` (13 → 17), and **two of them are controls rather than
coverage**, recorded as such because counting them as regression proof would overstate what this
change is guarded by. `BUDGET` and `COLLAPSED` were run against a sandbox holding the pre-fix file
and go red there. `FULL` and `CONTROL` pass on both trees by design — `FULL` guards that the
collapse hides detail rather than destroying it, and `CONTROL` asserts the tier boundary from the
other side, so a rule that ever swallowed `needs-you` fails there and nowhere else. That pre-fix
check itself misfired once and is worth keeping: the first attempt crashed on unresolved relative
imports, printed nothing, and the budget assertion **passed on the crash** — so it now copies the
whole `scripts/` tree and asserts exit 0 before reading any output.

**Giving the other 22 kinds real groups stays those lanes' call, not this one's.** `develop` (4
kinds) and `evolve` (10) have the ask filed in their own `## Now` as of `afc1852` (PR #126).
`leads` (7 kinds, including `deal.won`, which carries an optional `amount_inr` and is the one
uncovered kind arguably belonging in `money`) is **deliberately not filed**: it is the one LIVE
lane, this PLAN lists `initiatives/leads/**` do-not-touch, and `feat/leads-phase-02` is four commits
ahead of main with two of them editing the very file the note would land in. Writing it from here
hands a live lane a merge conflict instead of a message. It is owed once that branch merges.
`constitution.adopted` (ADR-0073) is company-level and belongs to no lane at all.

**Superseded by the entry at the top of `## Now`.** All three lanes answered — the owner routed the
question to each lane's own session rather than this one guessing, `leads` included, so the debt
recorded in the paragraph above is paid. Left in place rather than rewritten: a stale line under
the code that contradicts it is the exact defect `evolve` caught this lane shipping in PR #125, and
the cheap fix for it is a marker, not a deletion.

**Kill-criterion check at this close.** Burn is 4.5 of 7 days (64%), past the 50% tripwire — and
the tripwire's condition is *"at 50% burn, Phase 1 must be done, or the scope-cut conversation is
mandatory."* Phase 1 **is** done, and so is Phase 2. **No scope cut is triggered.** What remains
is 0.25 days for Phase 3 and the 2 untouchable days for Phase 4, which is 2.25 against 2.5 days
of appetite left. Phase 4's two days are not available to borrow from, so Phase 3 is the only
place slack can come from if it is needed.

**Everything below is the record of how 00–02 got here.** It is kept in full rather than
summarised, because most of it is defects that looked like working code.

**How that took two attempts, and the rule it cost.** PR #117 was merged on 2026-08-06 with
eleven commits that had never completed a CI run — GitHub Actions was in a major outage and
every job died at `Set up job`. The thing nobody said out loud is that **`arc-ci` runs on
`pull_request` and `workflow_dispatch` only, so a push to `main` is never tested at all**:
merging did not "get it tested later", it removed the last chance to test it. Main was reverted
(PR #118, `02d12cd`) back to its last green tree and the branch re-proposed as PR #119.

That second run then went red on 7 of 19 jobs — and **not one of the four failures was the
policy engine**. Every one was a fixture that never built the condition it claimed to test:

| Test | What it actually measured |
|---|---|
| `END TO END -- arc-run refuses a denied process` | A `sed` that never lowered `write` to L0, so the gate correctly permitted a run the test called a fail-open |
| `BYPASS -- a driver invoked DIRECTLY` | Same `sed`, plus `ARC_DRIVER_FAKE` handed a JSON document where the contract wants a directory — the driver died on its own fake check |
| `BYPASS -- a tree with no policy library` | A missing `yaml-subset.mjs` stack trace. Its only assertion was "the output does not say policy denied", which a crash satisfies |
| `the unknown-kind message reports the DERIVED size` | Its own fixture factory: `policyIdem` knows four kinds and threw on the deliberately-unknown one, so `validateEvent` was never reached |

The `sed` was `0,/re/` plus an empty `s//.../`. BSD sed rejects a line-0 address outright, and
`//` means *the last regex used* — on CI that resolved to the rename expression rather than the
range's. Fixed in `0f2d53d`: one `awk` pass with no implicit state, asserting its own output,
**scoped to the kind's own block** because a bare `grep 'level: L0'` is already satisfied by
`process:commit-msg-draft` and holds whether or not the edit landed.

Two of those four are textbook `.claude/rules/testing.md` vacuous passes, and the general lesson
is sharper than "assert it ran": **a fixture that silently fails to build its condition is a pass
generator pointed either way.** Here it made a working gate look broken. The next one makes a
broken gate look fine.

**Phase 01 — built, both surfaces attacked, all findings closed.**
The gate sits at `invoke()` in `arc-run` AND at `runDriver` in `drivers/common.mjs`, because
arc-run was never the only door — the repo's own engine suite invokes a driver directly. The
money guard reserves under a lock that re-reads the chain, and never guesses about a crash.
Two fresh agents found ~30 escalations between them; the worst were `ARC_ROOT=/tmp/x` disarming
the whole gate in one variable, a forged JSONL line raising a cap, and three concurrent
reservations charging 240 against a cap of 100.

**Phase 02 — vocabulary, interactive surface, promotion chain, and now the rendering.** ADR-0508
takes the closed vocabulary 40 → 44; `validate-policy.mjs` holds the four payloads. The PreToolUse
fragment and the static deny floor are both in (ADR-0501's two layers), with a cross-check test
that they never contradict. `arc brief` and the inbox now render the four receipts — the exit
criterion the spec marked "cut this first if the appetite is going".

**Writing that renderer found the phase's worst defect: none of the four kinds could be emitted
at all.** `arc-event` derives an idem per kind family — leads, experiment, everything else — and
had no branch for the policy kinds, so it produced `sha256(contentPre|ms)` while `validateEvent`
re-derived `policyIdem` and refused the mismatch. **Every policy receipt was REJECTED and
quarantined.** The vocabulary was extended, the payload validators were written, the promotion
module built the events, and nothing could write one to the spine.

It was invisible for the same reason four CI failures were: every test drove the modules
*directly*. Not one drove the sanctioned emitter, which is precisely what `phase-02-spec`'s
verification plan asked for — *"read back from the spine directory rather than from emitter
return values"*. The fix mirrors the two existing branches exactly, including refusing a
caller-supplied `--idem` (anti-preclaim: an attacker who can emit could otherwise claim a real
receipt's stable key, and the genuine receipt would collide on `DUP_IDEM` and vanish — a
demotion that vanishes is a cap that never drops).

**A second finding, larger than this lane.** `arc-brief` mapped kinds to groups with
`if (group) push`, silently skipping anything unmapped — and the table is **22 kinds behind the
closed vocabulary**. Every `develop.*`, `slice.*`, `experiment.*` and leads-pipeline receipt has
been dropped from the brief since those lanes shipped. The catch-all group now surfaces them by
name instead. **Assigning them real groups is those lanes' call, not this one's** — flagging it
here rather than guessing.

**Still owed on 02 — and the first version of this line said "nothing", which was wrong.** I
wrote it, then audited the spec's checklist against the code and found two criteria genuinely
open. Correcting it here rather than letting a tracker claim something the tree does not support:

| Exit criterion | Real state |
|---|---|
| Promotion chain **live end-to-end through `arc-inbox`** | ✅ now done — driven through the real CLIs, decision made through the inbox, `policy.level.changed` sealed, and the reducer folds it back off the spine to move the cap L1 → L2. It could not have passed before the emitter fix |
| **Automatic demotion** on incident | ❌ **open, and it needs a decision.** `buildDemotion` exists in the library with **no caller**. Wiring it into `arc-run`'s gate would be theatre: that gate denies only at L0, and `buildDemotion` correctly returns null when there is nothing left to take, so the call could never fire. The level a denial can actually cost is one taken at the **action** boundary — where a pair still holding L2/L3 is refused for a resource or invariant reason — and that means spine writes inside the blocking `PreToolUse` path. Latency and a new failure mode on an interactive session is a design call, not an implementation detail |

The demotion fixtures themselves — cap-above-ceiling bite, same-run double incident, the
append-order race, cross-capability isolation — are all green in `policy-reducer.bats`. What is
missing is only the thing that turns a real incident into a real receipt.

**BOTH OPEN ITEMS WERE DECIDED BY THE OWNER ON 2026-08-07, option A on each, and both are now
built.**

**1 — the demotion emitter goes in the hook's deny path.** `.claude/scripts/hq/lib/policy/incident.mjs`
raises the incident and seals the demotion citing it, and `policy-hook.mjs` calls it. The rule
turned out to be narrower than "deny above L0": it fires only when the level would otherwise have
**executed**. Denies land at L1 too — the integrity checks are hoisted out of the L2 branch, so a
pair at its birth cap still gets a hard deny for touching the settings file — and reading that as
an overreach would make the first such attempt in any fresh repo cost the session its ability
even to propose. `decisionForLevel(effective) === "execute"` is the test, and it is the library's
function rather than a rank comparison, because "would this level have executed" is exactly what
that function answers (POL-D).

Three properties are pinned in `policy-demotion.bats` because each one, wrong, breaks the engine
rather than a test: a **propose never demotes** (else the policy walks itself to L0 in a handful
of ordinary tool calls); the bite is **self-limiting** (repeating one mistake stops costing
levels once the pair can no longer execute); and a **receipt that cannot be written still denies,
loudly** — the first cut printed nothing on that path, because both report branches keyed on an
incident id the failure means you never got, so a lost authority receipt read exactly like a
routine deny.

**2 — the absence matrix is narrowed to the classes with a live code path.** `write`, `shell`,
`spend`. The other four are deferred with the obligation attached to the code rather than
dropped: *the phase that puts `network`, `message`, `publish` or `deploy` behind a real call
takes its matrix row with it, in the same change.* Reason in `phase-01-spec.md`: those rows all
observe a fake that a policed code path was supposed to have called, no policed sender exists
here, and a fake that sees nothing sees exactly the same nothing when the fixture is broken, when
the gate is deleted, and when the file is skipped. And `write`'s row was completed rather than
assumed — the existing `policy-matrix` test asserted the exit code and the message but never that
the target file was unchanged, which a guard that refuses *after* writing would also satisfy.

The audit that produced those two items is kept below, because it is the more useful record.

**Phase 01 audit, 2026-08-07.** The line above this one used to say 01 owed only "live demo +
evidence". It did not.

| Phase 01 exit criterion | Real state |
|---|---|
| `authorizeAction` before `spawnSync`, one call site, others searched for | ✅ — and a second gate at `runDriver`, because arc-run was never the only door |
| declared ∩ grant, POL-D cross-check lint | ✅ |
| A denied action produces no side effect and emits `incident.raised` | ✅ |
| …**and the same run's next authorization sees the demoted level** | ✅ built 2026-08-07 — pinned by `PHASE 01 REQ-03` in `policy-demotion.bats` |
| **Capability fixture matrix, one row per class, each asserting an absence** | ✅ for the classes with a live code path (write · shell · spend); the other four deferred with the obligation attached to the code. Was: **only `spend` had one** (31 fixtures). `network`, `message`, `publish`, `deploy` have no fake-backed absence fixture — "the fake server logs 0 requests", "the fake provider has 0 send records", "the fake publisher has 0 releases" were never built. `write` and `shell` are covered at the decision layer but not as runtime absence rows |
| Bypass fixtures — direct driver · nested denied command · env-var injection · alternate driver path | ✅ all four |
| Deny-by-default at runtime | ✅ with a **recorded deviation**: a *missing* policy file makes the engine not-in-force rather than blocking (`6755768`). Deliberate and well-reasoned, but the spec still said the opposite until now — a spec that contradicts the tree makes the tree look wrong. Deviation note now written into `phase-01-spec.md` |
| Money guard + its nine fixture families | ✅ |
| Tests green on CI, per-job conclusions read | ✅ |
| Two fresh adversarial agents, different surfaces | ✅ ~54 escalations closed |
| `tree-manifest` · tracker · **phase-close receipt** | manifest ✅ · tracker ✅ · receipt ❌ (the phase is not closed) |

**So: neither 01 nor 02 can close, and they are blocked on two things, not five.**

1. **The demotion emitter** — one decision (below), then a small amount of code. Unblocks the
   third criterion of 01 and the automatic-demotion criterion of 02.
2. **The capability fixture matrix for `network` / `message` / `publish` / `deploy`** — this one
   is a scoping question, not an oversight. Those classes need a *fake provider to observe*, and
   the only real senders in this repo belong to the `leads` lane. Building fakes for capabilities
   no policed code path exercises yet risks fixtures that assert nothing, which is the failure
   this whole cycle keeps finding. The honest options are: build the fakes anyway as the contract
   for future senders · narrow the criterion to the classes with a live code path and say so ·
   hand it to Phase 04, where the adversarial pass will name the classes that actually matter.

Both need Ashiq. Everything that did not need him is done.

Burn ~4 of 7 days.

Original Phase-0 note, kept because the appetite arithmetic still rests on it: 2 of 7 days was
Phase 0's full allocation and no more — the day-2 kill criterion did not fire.

Phase 0 shipped the steel thread: a request goes into `authorizeAction` and a reasoned
`deny` / `propose` / `execute` comes out, against fakes. What it cost to get there is the part
worth carrying forward — **two fresh agents on two surfaces found ~24 capability escalations in
code that was green on its own tests**, including prototype pollution that made `policy-lint`
print "is law" over a file granting L3 spend, with a `policy_hash` identical to the honest
file. Every one is closed and pinned. Four separate CI runs went red on cross-platform issues
invisible on the dev box.

**Next steps, in order.** Phase 01 and Phase 02 are *built and green*, which is not the same as
*closed*: neither has been through `/arc-phase-done`, so neither has a live demo or an evidence
bundle. Phase 02 also still owes the `arc brief` / inbox rendering of a pending promotion. Phase
03 (birth rule + cap inventory) is deferred to a separate session by the owner. Phase 04 — the
two untouchable adversarial days — has not started, and this cycle has just supplied it with a
fifth surface worth attacking: the fixtures themselves.

Original Phase-0 handover note, kept for the record:

**`/arc-develop start 1`.** Phase 1 wires the Phase-0 decision function into
`arc-run` **before** the `spawnSync("bash", [sh, "run", …])` driver call — the wiring and its
proof, not the building of the check, which is done. Then the capability fixture matrix (one
absence assertion per class), the bypass fixtures, and the money guard with its crash-window
cases. Nothing in Phase 1 writes policy logic: a second interpretation at the call site is the
POL-D violation the phase exists to avoid.

**What Phase 0 hands over:** `authorizeAction({kind, capability, resource}, {policy, events})`
reads no file and no global state, so Phase 1 supplies the real `hq.policy.yaml` and the real
spine and changes nothing else. The tool-to-capability table and the 63-row matrix say which
classes need which enforcement.

**Context that shaped the build**, in order of how much it matters:

1. **The interactive surface is weaker than the design source assumed.** A PreToolUse hook
   blocks only on `exit 2`; timeout, crash, missing script and malformed JSON all let the tool
   through. The plan's original non-negotiable ("a hook that errors denies") was not
   implementable. It is now a two-layer contract (ADR-0501) and the owner chose the
   high-blast-radius backstop scope.
2. **MCP is in scope** (ADR-0503), bounded to this repo's four `.mcp.json` servers —
   `stripe` is real money and `supabase` is real data. That is roughly 40 extra matrix rows in
   Phase 0, which is the phase with the tightest kill criterion.
3. **The policy library lives in `hq`, not in a new `products/policy`** (ADR-0500), reversing
   the design source's stated lean. Reason: `engine` already requires `hq`, so an optional
   policy product would be an install-time fail-open.
4. **A hole the panel found and the plan now closes:** ADR-0502's un-grantable resource list
   originally bound only `write`, so a `shell` grant could have edited
   `.claude/settings.json` with `git checkout --` or `sed -i` and removed its own cage.
5. **Phase 0 was under-scoped and is now 2 days** (ADR-0505, ADR-0506 and the boundary move).
   The simulation gate showed a law-and-parser-only Phase 0 could not run over half its own
   hostile corpus — those are runtime authorization attacks and needed `authorizeAction`, which
   sat in Phase 1 — and that its reducer test would have been vacuous. `authorizeAction` and
   `resolveEffectivePolicy` moved into Phase 0 against fakes; `arc-run` wiring and the money
   flow stayed in Phase 1. **Slack is now 0.25 days, down from 1.**
6. **Two schema decisions the gate forced:** authority is keyed per **(action kind, capability)**
   pair, not per kind, and a demotion bites only the capability involved (ADR-0505) — the first
   draft's event payloads had no `capability` field at all, which would have silently flattened
   seven of the eight vectors. And E2 binds through a **mandatory `e2:` declaration** per kind,
   with drift caught by hashing `CONSTITUTION.md` *then* parsing it (ADR-0506) — the first
   draft compared the file's hash and called that a quote-drift check, which it is not.
7. **The biggest single finding of the whole kickoff, and it came last** (ADR-0507). A fresh
   attacker aimed at the newly-written schema built a total bypass out of the schema's *own*
   worked example: `argv0_allow: ["git","node","bats"]` plus
   `node -e "require('fs').writeFileSync('.claude/settings.json',…)"`. No chaining metacharacter,
   so the shell rule never fires; no discrete path argument, so the filesystem-identity check has
   nothing to `stat`; not a `write` action, so the write roots are never consulted. Write roots,
   the un-grantable resource list and the deny floor all bypassed at once, by a binary the
   example allowlisted. The fix is an invariant — **no capability may be used to exceed another
   capability's grant** — and it also repairs ADR-0505's premise, which had assumed the eight
   capabilities were independent.

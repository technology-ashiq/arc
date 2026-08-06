# PROGRESS.md — arc-policy "Enforced capability vectors"

status: LIVE
cycle: arc-policy (born 2026-08-06)
phase: 00 — approved, not yet started
appetite: 7d
burn: 0d
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
| 00 | ▶ **NEXT** · Steel thread — the law, its parser **and the decision**: schema, canonical L0–L3 table, `policy-lint` (FAILs from birth), `resolveEffectivePolicy` + `authorizeAction` against fakes, hostile corpus green (static **and** runtime families), hook feasibility matrix generated from `.mcp.json` | 2 days | ⬜ not started |
| 01 | Headless enforcement — wire the Phase-0 decision into `arc-run` before any driver call, capability fixture matrix, deny-by-default at runtime, money guard with reservation flow and double-spend fixtures | 1.25 days | ⬜ not started |
| 02 | Receipts and interactive — vocab ADR (+4 kinds), promotion chain end-to-end through the inbox, automatic demotion, hook fragments, static deny floor and its cross-check | 1.25 days | ⬜ not started |
| 03 | Birth-rule and cap inventory, migration deferred by evidence | 0.25 days | ⬜ not started |
| 04 | **Adversarial security pass — two full days, untouchable** | 2 days | ⬜ not started |

**Appetite burn: 0 of 7 days used (0%).** Phases allocate **6.75 of 7 days; 0.25 days of slack**,
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

_(nothing yet — the lane was born 2026-08-06 and has not been approved to build)_

| Date | What closed | Evidence |
|---|---|---|
| 2026-08-06 | Lane born. PLAN.md + 5 phase specs + **ADR-0500..0507** written. Verification: 4 plan-attackers (27 findings, 24 accepted, 3 rejected) and **8 plan-simulator rounds** — blocker count 7 → 6 → 6 → 3 → 2 → 2 → 3 → **1 HARD**, closed by naming which of two E2 readings wins. `kickoff-lint` green on every run. **Not a phase close** — recorded so the kickoff itself has a receipt | `kickoff.done` `01KZB1805TC27WCCMF3DHQRVM0` · `approval.requested` `01KZB1878PENK4YZ98VKQYPK1J` |

## Now

**Current position: plan APPROVED 2026-08-06, Phase 0 is next and not yet started.** The
approval is a receipt, not a recollection: `approval.requested` `01KZB1878PENK4YZ98VKQYPK1J`
answered by `decision.recorded` `01KZBFDM37P135EQPBBZNTP3JH`, verdict `approve`, reason
`policy-plan-approved`. Burn is 0 of 7 days.

**Next step: `/arc-develop start 0`.** Phase 0's **five** bats files go **red first** — the two
expected failures are named verbatim in `phases/phase-00-spec.md` (`policy-lint.bats` first case
at exit 127, and `policy-authorize.bats` on the hardlink case). No implementation before those
two are red. Day 2 ends at the kill criterion: REQ-01's exit not reached → STOP and retro the
schema scope, with the pre-planned cut list in the spec taken in its written order first.

**Context the executor needs**, in order of how much it shaped the build:

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

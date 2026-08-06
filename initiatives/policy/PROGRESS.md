# PROGRESS.md — arc-policy "Enforced capability vectors"

status: LIVE
cycle: arc-policy (born 2026-08-06)
phase: 02 — in progress (01 built + hardened, awaiting CI)
appetite: 7d
burn: 3.5d
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
| 01 | Headless enforcement — wire the Phase-0 decision into `arc-run` before any driver call, capability fixture matrix, deny-by-default at runtime, money guard with reservation flow and double-spend fixtures | 1.25 days | 🔨 built + hardened, awaiting CI |
| 02 | Receipts and interactive — vocab ADR (+4 kinds), promotion chain end-to-end through the inbox, automatic demotion, hook fragments, static deny floor and its cross-check | 1.25 days | 🔨 in progress |
| 03 | Birth-rule and cap inventory, migration deferred by evidence | 0.25 days | ⬜ not started |
| 04 | **Adversarial security pass — two full days, untouchable** | 2 days | ⬜ not started |

**Appetite burn: ~3.5 of 7 days used (50%).** Phases allocate **6.75 of 7 days; 0.25 days of slack**,
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
| 2026-08-06 | **Phase 00 CLOSED.** The law, its parser and the decision. `policy-lint` FAILs from birth; `authorizeAction` returns deny/propose/execute with everything injected; 54 hostile fixtures (30 static + 24 runtime, incl. 2 controls); 63-row feasibility matrix generated from `.mcp.json`; 88 new tests across 6 bats suites. **Two fresh agents found ~24 capability escalations against code that was green on its own tests** — all closed, all pinned. Red-first proven on CI run 31102122394 before any implementation existed | CI **31108185564, 19/19 green** · `initiatives/policy/evidence/phase-00/` (live-demo.md, handoff.md, hook-matrix.json/.md) |
| 2026-08-06 | Lane born. PLAN.md + 5 phase specs + **ADR-0500..0507** written. Verification: 4 plan-attackers (27 findings, 24 accepted, 3 rejected) and **8 plan-simulator rounds** — blocker count 7 → 6 → 6 → 3 → 2 → 2 → 3 → **1 HARD**, closed by naming which of two E2 readings wins. `kickoff-lint` green on every run. **Not a phase close** — recorded so the kickoff itself has a receipt | `kickoff.done` `01KZB1805TC27WCCMF3DHQRVM0` · `approval.requested` `01KZB1878PENK4YZ98VKQYPK1J` |

## Now

**Current position: Phase 00 CLOSED. Phase 01 built and adversarially hardened; Phase 02 in
progress. CI IS THE BLOCKER, and it is not ours** — every job on the last four runs failed at
`Set up job` with GitHub's `Failed to resolve action download info: Service Unavailable`, before
a single test executed. Two runs are queued behind it. Nothing since the Phase-1 gate commit has
been through CI, so everything below is verified by running the modules directly (which
`.claude/rules/testing.md` permits) and not by the gate that actually counts.

**Phase 01 — built, both surfaces attacked, all findings closed.**
The gate sits at `invoke()` in `arc-run` AND at `runDriver` in `drivers/common.mjs`, because
arc-run was never the only door — the repo's own engine suite invokes a driver directly. The
money guard reserves under a lock that re-reads the chain, and never guesses about a crash.
Two fresh agents found ~30 escalations between them; the worst were `ARC_ROOT=/tmp/x` disarming
the whole gate in one variable, a forged JSONL line raising a cap, and three concurrent
reservations charging 240 against a cap of 100.

**Phase 02 — vocabulary and interactive surface landed.** ADR-0508 takes the closed vocabulary
40 → 44; `validate-policy.mjs` holds the four payloads. The PreToolUse fragment and the static
deny floor are both in (ADR-0501's two layers), with a cross-check test that they never
contradict. **Still owed: the promotion chain end-to-end through the inbox, and automatic
demotion on incident.**

Burn ~3.5 of 7 days.

Original Phase-0 note, kept because the appetite arithmetic still rests on it: 2 of 7 days was
Phase 0's full allocation and no more — the day-2 kill criterion did not fire.

Phase 0 shipped the steel thread: a request goes into `authorizeAction` and a reasoned
`deny` / `propose` / `execute` comes out, against fakes. What it cost to get there is the part
worth carrying forward — **two fresh agents on two surfaces found ~24 capability escalations in
code that was green on its own tests**, including prototype pollution that made `policy-lint`
print "is law" over a file granting L3 spend, with a `policy_hash` identical to the honest
file. Every one is closed and pinned. Four separate CI runs went red on cross-platform issues
invisible on the dev box.

**Next step: `/arc-develop start 1`.** Phase 1 wires the Phase-0 decision function into
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

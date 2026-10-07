# Phase 04 — handoff

## What Phase 04 delivered

| Piece | Where |
|---|---|
| The full attempt list, 26 findings with verdicts | [`findings.md`](findings.md) |
| Eight attacks run for real against a throwaway root | [`live-demo.md`](live-demo.md) |
| 23 fixes, each with a regression fixture | `tests/policy-hardening.bats` · `policy-hook.bats` · `policy-demotion.bats` · `policy-spend.bats` |
| The corpus, grown 54 → 64 rows | `tests/fixtures/policy/hostile/INDEX` |
| Two findings rejected after measurement, with the reasoning recorded at the call site | `spend.mjs` comment · commit `e008dbe` |
| The three edits an agent is refused, written up for the owner | [`docs/owner-action-settings-json.md`](../../../../docs/owner-action-settings-json.md) |

## The one-way door

**The engine now refuses on identity, not only on strings.** A trailing dot, a trailing space, an
8.3 short name and a case-variant directory are all *rejected* rather than normalised. That is
deliberate and hard to walk back: normalising means this module deciding which of two names the OS
meant, and the aliasing is the attack. If a legitimate workflow ever needs one of those names, the
fix is the workflow, not the guard.

**`argv0_allow` is now enforced at every level, not only at L2.** For shell that is the correct
reading — ADR-0507 derives the level *from* the list — but it does narrow what an L3 shell grant
means, from "any program" to "the declared programs". No shipped grant is affected: every `shell`
in `hq.policy.yaml` sits at L1 with no allowlist at all.

## What the next phase inherits

- **The hook is still disarmed by default** (`ARC_POLICY_HOOK=1`). Every scenario in the live demo
  is proved with it armed, and the tests set it, so the enforcement path runs on every CI leg. But
  the shipped default is inert, and the honest sentence stays in `policy-decide.sh`: *the engine is
  safe because it is disarmed, not because it enforces.* Arming it for real means raising the
  `session:interactive` ceiling, which is a human edit in a reviewed diff (POL-A).
- **Layer 2 does not yet backstop the paths layer 1 protects.** The deny floor carries entries for
  `settings.json` and `hq.policy.yaml` and none for `.claude/hooks/**` or the policy library. Until
  the owner action lands, one disarmed session can permanently disarm every future armed one.
- **The MCP surface is live code that no matcher reaches.** `policy-hook.mjs` has a complete
  per-server capability table; nothing routes an MCP call to it. Same shape as the Edit/Write hole
  this phase closed, one surface over.
- **`encode` coerces `Map`, `Set` and `Date` to `{}`** — raised on day two, real, and not closed
  here: nothing in the policy path constructs one today, so closing it is a change to the hashing
  contract with no current caller. Recorded rather than fixed.
- **`reserveAndSpend` calls a provider at L1.** POL-F bans real-money movement above L1 in v1, and
  the reservation path is reachable below it. Recorded as owed; the money phase owns it.
- **`..process.yaml` yields the stem `"."`.** Cosmetic today — no such file exists and the birth
  rule reports it — but it is a subject name the runtime would accept.

## What this phase deliberately did NOT do

The spec's out-of-scope list held: no new capability, kind or feature; no scheduler work; no
cap-bearing module migrated; the MCP scope not widened beyond `.mcp.json`. Finding 26 is the one
place the phase changed behaviour rather than adding a fixture, and it is a defect fix inside the
phase's own mandated activity, not a feature.

## Needed from the owner

**One thing, and it is genuinely un-delegable:** the three `.claude/settings.json` edits in
[`docs/owner-action-settings-json.md`](../../../../docs/owner-action-settings-json.md). That file
is on the un-grantable resource list *and* in the harness's own `permissions.deny`, so an agent is
refused it by two independent layers. That is the rule working, and it is why these three findings
are written out instead of committed.

Do them in order — the deny floor first, the matcher second, the MCP matcher last and separately,
because it will be noisy and you want to know which edit caused what.

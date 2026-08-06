# ADR 0501 — Fail-closed at the interactive surface is two layers: hooks decide, `permissions.deny` is the floor

**Status:** accepted
**Date:** 2026-08-06
**Product:** `policy`
**Reversibility:** two-way
**Revisit trigger:** Claude Code changes PreToolUse failure semantics so that a hook timeout,
crash, or missing script **blocks** the tool call. Re-run REQ-01's feasibility fixtures; if
fail-closed holds without the second layer, the static backstop can be collapsed into the hooks
and this ADR superseded.

## Context

`PLAN-policy.md` carries the non-negotiable "**a hook that errors denies (E3, A1)**" and POL-H's
"unproven = denied". Both were written before anyone checked what the platform actually does
when a hook misbehaves. Checked at kickoff, against the official Claude Code documentation:

| PreToolUse outcome | Result | Posture |
|---|---|---|
| hook exits `2` | tool is **blocked**, stderr becomes the reason | fail-closed |
| hook exits `0` with `permissionDecision: "deny"` | tool is **blocked** | fail-closed |
| hook exits `1` or `3`-`255` | logged as a hook error, **tool proceeds** | **fail-open** |
| hook times out (10 min default) | logged, **tool proceeds** | **fail-open** |
| hook command file missing / cannot spawn | logged, **tool proceeds** | **fail-open** |
| hook emits malformed JSON on exit `0` | logged, **tool proceeds** | **fail-open** |

So the plan's non-negotiable, read literally, **cannot be implemented from inside a hook**: a
hook that never runs cannot deny anything, and no code we write inside it changes that. Writing
"hooks are fail-closed" into the plan and shipping would be exactly the poster-document failure
this build exists to end.

The same check found the layer that *is* fail-closed. `permissions.deny` rules are evaluated
**before** hook decisions, a hook returning `allow` cannot override a deny rule, deny rules
**merge** across settings scopes (they only ever get stricter), and they continue to hold under
`bypassPermissions`. PreToolUse also fires for MCP tools via `mcp__SERVER__TOOL` matchers, and a
hook may rewrite tool input via `updatedInput` but cannot use that to escape a deny rule.

## Options considered

1. **A — static deny backstop for every one of the 8 capability classes.** Literal
   "fail-closed everywhere". Cons: the deny list and the YAML grants become two representations
   of one rule, which is precisely the drift POL-D exists to forbid, duplicated onto the
   interactive side; and Phase 0 grows a whole second design surface against a 7-day cap.
2. **B — hooks first, static deny only where the feasibility matrix cannot prove interception**
   (POL-H as written). Cheapest. Cons: "provable" now only means "provable when the hook runs",
   and four of the six outcomes above are the hook not running. Most of the failure space stays
   fail-open, which contradicts the plan's own non-negotiable.
3. **C — hooks for every class, plus a mandatory static deny backstop for the high-blast-radius
   classes**: `spend`, `deploy`, `publish`, and every E2-adjacent action. Proportionate to
   consequence; matches the asymmetric treatment POL-F already gives money.

## Decision

**Option C.** Fail-closed at the interactive surface is a **two-layer contract**, and the plan's
non-negotiable is restated in terms that are actually achievable:

- **Layer 1 — the hook decides.** Every capability class gets a PreToolUse fragment in
  `.claude/hooks/PreToolUse.d/` calling the one shared policy library (POL-D). The fragment
  **exits 2 on its own internal error** — a policy check that throws denies, never proceeds.
  This is the expressive layer: it knows kinds, levels, caps and resources.
- **Layer 2 — `permissions.deny` is the floor.** `spend`, `deploy`, `publish` and E2-adjacent
  actions each carry a static deny rule that holds when the hook does not run at all. This layer
  is dumb by design: it cannot read the policy file, and it is not supposed to.
- **The honest wording, which replaces "a hook that errors denies":** *a hook that errors
  denies; a hook that never runs cannot, so every capability whose misuse is not cheaply
  reversible also carries a static deny rule that does not depend on the hook running.*
- Layer 2's coverage is not a judgement call at build time: REQ-01's feasibility matrix assigns
  every side-effect tool class to layer 1, layer 2, or both, and a class with no assignment is a
  Phase-0 exit failure. "Hook later" remains not a state.

**Evidence:** `https://code.claude.com/docs/en/hooks.md` (exit-2 blocking contract,
`hookSpecificOutput.permissionDecision` values `allow|deny|ask|defer`, `updatedInput`, MCP
`mcp__SERVER__TOOL` matchers, non-blocking error handling for other exit codes),
`https://code.claude.com/docs/en/permissions.md` (deny evaluated first, deny cannot be overridden
by a hook `allow`, deny holds under `bypassPermissions`),
`https://code.claude.com/docs/en/settings.md` (scope precedence; deny rules merge across scopes).
Checked 2026-08-06. Local corroboration: `.claude/settings.json` already carries 12 deny rules
and PreToolUse matchers `["Bash","Edit|Write"]`; the fragment mechanism this decision uses
already exists (`.claude/hooks/PreToolUse.d/00-destructive.sh`, `50-deploy.sh`).
**Confidence:** medium — the blocking contract and the deny precedence are documented and
consistent across three pages, but the *failure* behaviours (timeout, crash, missing script,
malformed JSON) are documented prose, not something this repo has observed. Ten specific claims
were flagged as untrusted by the research pass; they become REQ-01's feasibility-matrix rows and
are proven by fixture in Phase 0, not assumed. Tracked in the Assumptions ledger.
**Rejected because:** A — creates a second representation of one rule, the exact drift POL-D
forbids, and spends Phase 0 budget the day-2 kill criterion cannot afford. B — leaves the
majority of the failure space fail-open while claiming fail-closed.

## Evidence note added after Phase 0 measured it (2026-08-06)

The table above describes the **platform** contract, read from the docs. Phase 0's feasibility
fixtures measured this repo's own dispatcher against it and found one mode narrower than the
documentation implies, in our favour:

- **A fragment with an unusable shebang still BLOCKS here.** `.claude/hooks/_dispatch.sh`
  invokes `bash "$f"` rather than exec'ing the fragment, so the shebang is never consulted and
  a fragment that would be unspawnable on its own still runs and can exit 2. The fixture was
  written expecting a fail-open and was corrected by CI on all three legs.
- The genuine missing-script fail-open remains, one level up: a fragment **file** that is not
  there is skipped by the glob, the chain runs zero fragments and returns 0, and nothing
  announces that a guard which was supposed to be present is absent. That is why ADR-0502 makes
  `.claude/hooks/**` an un-grantable target — deleting a fragment is the cheapest way to disarm
  the expressive layer.
- `PreToolUse.sh` exits 0 with a written warning when the dispatcher itself is missing. Loud,
  but still open.

The decision is unchanged: the static floor is still required, because timeout, crash and
absent-fragment remain open. What changed is that the claim is now measured rather than
recalled, which is what the matrix exists for.

## Consequences

Easier: the interactive surface has a floor that survives a broken hook, a hung hook, a deleted
hook script and `bypassPermissions` — none of which the policy library could have handled. MCP
tools become interceptable rather than an unenforced channel (ADR-0503). Harder: Phase 0 owes a
deny-rule design as well as a schema, and Phase 2 owes a cross-check that layer 2 never
contradicts layer 1 for the classes that have both. The static rules are also a tamper target,
which is why they are covered by ADR-0502. If the revisit trigger fires, layer 2 collapses into
layer 1 and this ADR is superseded rather than edited.

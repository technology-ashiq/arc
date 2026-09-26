# ADR 1419 — The composer read and write boundaries bind only a ui-composer caller

**Status:** proposed
**Date:** 2026-09-26
**Product:** `design`
**Reversibility:** two-way
**Revisit trigger:** a measured probe shows the PreToolUse payload's `agent_id` is stable for one
subagent's whole life, AND the harness can bind that id to one variant before the composer's
first tool call. Then parallel composition is a new decision, not an amendment of this one.

## Context

[ADR-1415](1415-the-composer-iron-law-gains-a-read-path-allowlist.md) gave `ui-composer` a read
boundary, and its amendments added a write boundary and a Bash boundary. The Bash boundary
(`composer-bash-check.sh`) knows who is calling: it reads the payload's `agent_type`, which the
harness writes, which is present for a subagent and absent for the main session (measured
2026-09-17 with an owner-approved probe).

The read and write boundaries (`composer-scope-check.sh`, `composer-write-check.sh`) do not.
They enforce whenever a marker is armed, against **every** caller. Two costs follow:

- **The operator lock.** While a compose is armed, the main session's own Read, Grep, Glob and
  Write outside the variant are refused. A compose that dies before `compose-done` leaves the
  whole tree locked until a person releases it. `lexos-p01/variant-a` sat armed for three weeks
  that way.
- **Serial composition only.** A marker cannot say which composer is calling, so two armed
  markers refuse everything. Explore mode runs three composers.

## Options considered

1. **Bind the read and write checks to `agent_type` = `ui-composer`, as the Bash check already
   does.** Every other caller passes. A payload that names `ui-composer` but whose identity
   cannot be read exactly refuses (the Bash check's BL-3/BL-7 rule, reused, not re-written).
   Pros: it ends the operator lock, and the identity is harness-written, so a composer cannot
   forge its way out. Cons: it does not by itself make composition parallel.
2. **Option 1 plus per-composer binding by `agent_id`.** Record the `agent_id` at a composer's
   first call, and refuse a mismatch (adversarial-open BL-8). Cons: with three markers armed, the
   first call is the composer's own choice of variant, so a composer that opens with a sibling's
   path claims the sibling. Binding needs an id-to-variant link that the composer does not
   choose, and nothing measured yet provides one.
3. **Keep the global marker.** Cons: the lock stays, and it has already cost three weeks once.

## Decision

**Option 1.** The read and write boundaries enforce only for a caller whose `agent_type` is
`ui-composer`, case-blind and with an optional namespace, parsed by the same code as the Bash
check. The main session and every other agent are never refused by a composer marker.

Composition stays **serial**. More than one armed marker still refuses, but only a composer's
call. Parallel composition (option 2) is deferred to the revisit trigger above.

## Consequences

- The operator can read, grep and edit the tree while a compose is armed or abandoned.
- An abandoned marker now stops only the next composer, and says so. It no longer blocks the
  session that has to clean it up.
- The identity parser becomes shared by three checks. One copy, or three copies checked
  byte-identical, is a build choice for the slice; a second hand-written parser is not allowed
  (the twin-fix rule).
- The negative controls still hold: a composer reading or writing a sibling is refused. New
  control: the main session reading a sibling while a marker is armed is allowed.
- BL-8 stays ACCEPTED, and it now points here.

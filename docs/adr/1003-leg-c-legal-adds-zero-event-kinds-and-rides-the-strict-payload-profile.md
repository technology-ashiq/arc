# ADR 1003 — LEG-C: legal adds ZERO event kinds and rides the strict payload profile

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** a cross-venture legal query is actually needed — "which ventures are on
template set v4", "which pages changed since date X" — and answering it means scanning every
`note.logged` body. At that point a first-class `legal.updated` kind is earned and gets its own
micro ADR against the live `KINDS.length`.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1000). Locked at the v1.1 freeze as LEG-C.

The spine's kind vocabulary is closed (ADR-0026) and grows only by ADR against the **live**
`KINDS.length`, never a number quoted from a plan (ADR-0107). Read live in this session from
`.claude/scripts/hq/lib/validate.mjs`: the core vocabulary is **24 kinds**, with three further
family validators (`experiment` 7, `leads` 8, `policy` 4). The design source's own note that
"ADR-0026 caps kinds at 18" is stale — which is precisely why the rule says read it, and why the
number is recorded here with its source rather than carried forward.

Every kind this module needs is already live: `approval.requested`, `decision.recorded`,
`note.logged`.

The failure this decision avoids is on the record twice. `arc-develop` 2026-08-02: *"a receipt
emitter reported success while every receipt was silently quarantined — `develop.started` was
rejected with UNKNOWN_KIND, but the emitting command still exited 0."* And `arc-policy` 2026-08-10:
*"an entire enforcement engine shipped fixture-proven and never once exercised: 4 new spine kinds,
0 real emissions."* A new kind is a liability until something emits it for real.

## Options considered

1. **A `legal.published` kind (+ validator + policy row)** — clean queries later, at the cost of a
   vocabulary extension whose only emissions this cycle would be fixtures.
2. **Zero new kinds; strict payload profile on the existing three** — no vocabulary growth, and the
   publish annotation is a tagged `note.logged` that a future migration can promote losslessly.

## Decision

**Option 2.**

- **Approval chain:** `approval.requested` carrying a **strict payload profile**
  `subject: "legal.publish"` — venture · page set · `facts_sha` · `template_set_sha` · output
  hashes · evidence-bundle path · diff summary; **unknown keys rejected** (the POL-E / ABS-D
  pattern, already proven) → the owner decides through the existing inbox → `decision.recorded`
  with a mandatory reason.
- **Publish annotation:** `note.logged` with tags `[legal, publish, <venture>]` carrying the render
  receipt.
- **`decision.recorded` is never emitted by the raw emitter.** Engine's Phase 04 established why,
  the hard way: the emitter enforces `decision.idem == sha256("decision.recorded|" + decides)` and
  does not compute it, so a raw emit is rejected with `BAD_DECISION` and quarantined while exiting
  cleanly. `arc-inbox approve <id> --reason …` is the only correct path, and it is the owner's act,
  not the module's.
- **Every emit is verified where it landed.** After any wiring change, `events/` *and*
  `events/_quarantine/` are both read and the event id is matched — never a substring grep for the
  ULID, because a quarantined rejection contains the same string (engine's own proof file records
  exactly this trap).

**Evidence:** live vocabulary read from `.claude/scripts/hq/lib/validate.mjs` this session (24 core
kinds; `approval.requested` / `decision.recorded` / `note.logged` all present) ·
`initiatives/engine/evidence/phase-04/mandate-ulid.txt` for the idem-welding and the
substring-grep trap · `docs/retro-log.md` 2026-08-02 (`arc-develop`), 2026-08-10 (`arc-policy`).
**Confidence:** high
**Rejected because:** Option 1 — ships a kind whose production emission count at close would be
zero, which is the exact shape `arc-policy`'s retro named.

## Consequences

Easier: nothing to migrate, no validator to write, no policy row to add, and the module inherits a
proven strict-profile pattern rather than inventing one.

Harder: cross-venture legal queries are a `note.logged` scan until the revisit trigger fires. That
is accepted, and the tag set (`legal`, `publish`, `<venture>`) is chosen so the eventual promotion
is a projection over existing events rather than a rewrite.

**A policy-surface note, from the kickoff audit:** `hq.policy.yaml` carries `targets.publish: []` —
an empty allow-list — and Constitution E2 lists *"publishing under Ashiq's name"* as ungrantable.
This module needs **no new policy row and no grant**: it writes local files under the operator's own
invocation, emits through the existing emitter, and has no execution capability to request. The
empty `targets.publish` list stays empty. A legal module that quietly created arc's first permitted
publish target would be the worst possible place to create one.

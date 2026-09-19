# ADR 1344 — The live lanes: a send is bound to its plan, and the full-read gate reaches the inbox

**Status:** accepted
**Date:** 2026-09-20
**Product:** face (with additive changes in the leads and legal lanes, under ADR-1339's routing)
**Reversibility:** two-way
**Revisit trigger:** the leads lane evidences a warmed sending domain (ADR-0413's Phase 03 gate row 2) — the send then
runs instead of refusing, and this ADR's "refuses everywhere today" note stops being true.

## Context

Two verb-pending cards were left in the live lanes: "Send today's outreach" (leads) and "Stamp the full-read gate"
(legal). Both had a CLI, and neither could be driven from the face:

- `arc-leads daily <campaign>` sent immediately, with no plan step. An op whose apply is a send must show what will go
  out and then send exactly that; ADR-1339 already requires the owner's click for it.
- `arc-legal propose` rendered the pages, wrote `_approval.json`, and then printed a command naming a script that does
  not exist (`arc-inbox.sh`) with an id nothing produced. Nothing raised the question onto the spine, so the inbox the
  face already stamps through never carried it — and `publish --request ULID` asked for an id no verb could give.

## Decision

1. **The daily send is bound to its plan.** `arc-leads daily <campaign> (--dry-run | --expect DIGEST)`: the plan lists
   every approved draft with the sha the owner approved and the IST day the cap buckets by, and prints the digest;
   the apply refuses unless that digest still holds. A plan with nothing to send is a refusal, so nothing can be bound
   to an empty plan. The caps, the suppression ledger, the send window and the jurisdiction check stay where they are —
   per draft, at the send, each able to refuse it there.
2. **The full-read gate reaches the inbox.** `arc-legal propose … (--dry-run | --expect DIGEST)` renders (into a temp
   directory for a plan, so a plan writes nothing where the operator chose), writes the payload `publish` re-derives,
   and raises ONE `approval.requested` (gate `legal`, subject `legal.publish`) naming that payload's sha, with a welded
   idem. The same bytes twice is refused BEFORE the write. It never records the decision (REQ-06): the stamp is the
   owner's, in the inbox, and `publish` then checks it against these bytes.
3. **A real venture's facts stay out of this public repository.** `propose` takes `--venture-dir`, or
   `ARC_LEGAL_VENTURE_DIR`, and prints only WHICH source it used — never the directory. The face's op renders under the
   gitignored state directory for the same reason.

## Consequences

- The leads room keeps three cards (research, move, suppress); the legal room keeps two (a gate's mode, the lints).
- **The send refuses on every tree today**, at the leads lane's own gate: no warmed sending domain is evidenced
  (ADR-0402/0413). That is the honest state, and it is what the face's card shows. The plan and the binding are proven
  on a scratch config in `tests/face/live-work.mjs`; a real send waits for that lane's Phase 03.
- `arc-leads daily` now refuses a bare invocation. Nothing scheduled it, and one test that ran it bare fails earlier for
  its own reason, so no caller changes.

## Amendment, PR 5c round 1 (same day)

Two fresh attackers found three HIGH between them. One decision is new: **the door's effect taxonomy gains a fourth
kind, `leavesMachine`** -- an apply that acts outside the spine and outside a proposal branch (a send; a render written
into this checkout). A sim door refuses it like any other effect, the card says it, and the work-door suite derives it
from the apply script so a row cannot quietly drop it. Two more: a render is staged in a temp directory and reaches
`--out` only after every check has passed, and a real venture's facts directory is resolved in ONE place for every verb,
so a gate raised for a real venture can actually be published.

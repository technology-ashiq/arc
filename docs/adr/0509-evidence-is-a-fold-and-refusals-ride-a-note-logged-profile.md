# ADR 0509 — Evidence is a fold over existing kinds, and a refusal rides a `note.logged` profile

**Status:** accepted
**Date:** 2026-10-07
**Product:** `policy`
**Reversibility:** one-way
**Revisit trigger:** a `policy.refusal` receipt that is honest and complete cannot be expressed
in the profile's closed shape (e.g. a capability decision with two subjects), OR more than 50
`policy.refusal` receipts land on one IST day on the canonical spine. Either one means the
profile is carrying a second fact, and a dedicated kind has to be argued for under ADR-0508's
bar.

## Context

POL-L (PLAN-policy v1.1) needs, per (subject × capability) pair, when it last succeeded, when
it was last refused correctly, and when it was last audited, with **zero new spine kinds**.
Success and audit have carriers already. Refusal mostly does not. The canonical spine (main
clone, 2026-10-07, 1,695 events) holds 0 `incident.raised` and 0 of the four policy kinds, and
the two places that refuse write either nothing (`policy-hook.mjs` on a propose, and on a deny
the pair could not lose) or a prose `what` string (`arc-run`'s gate) that names the capability
only inside free text.

Fork POL-L1: which existing kind records a refusal honestly?

## Options considered

1. **`incident.raised`.** Right severity vocabulary. Wrong fact: `incident.mjs` rules out a
   propose and any deny at a level that could not execute on purpose, because an incident is
   evidence about trust and a routine refusal is the system working. Recording every refusal
   there would bury the four real incident readers (brief, inbox, demotion, face).
2. **`approval.requested`.** Every propose would land in the inbox as a needs-you item. The
   inbox stops being a real surface within a session.
3. **`note.logged` with a strict `subject: "policy.refusal"` profile.** It reuses the profile
   pattern the spine already validates three times (`policy.promotion`, `absorb.ab-judgement`,
   `ledger.criteria`, ADR-1017): a generic kind, and only a payload declaring that subject is
   held to a closed shape. A near-miss subject (case or whitespace) is refused, not normalized.
   `note.logged` sits in the brief's `background` group, which collapses first.
4. **A new kind `policy.refused`.** Cleanest typing, and it breaks this amendment's one hard
   constraint (zero new kinds).

## Decision

**Option 3.** A refusal is `note.logged` with this closed payload, validated first-party in
its own module and wired into `validateEvent` beside the other profiles:

| Field | Type |
|---|---|
| `subject` | exactly `"policy.refusal"` |
| `action_kind` | the policy subject (ADR-0504 grammar), e.g. `process:review-diff` or `session:interactive` |
| `capability` | one of the closed eight |
| `level` | the effective level at the decision, `L0`..`L3` |
| `decision` | `deny` \| `propose` |
| `surface` | `headless` \| `interactive` \| `scheduler` |
| `reason` | string, 1..300 chars, the authorizer's own reason |
| `incident_ref` | ULID of the `incident.raised` written for the same refusal — **required when `surface` is `headless`**, absent otherwise |

Unknown keys are rejected. **The fold attributes a refusal only from these typed fields and
never parses prose**, so the existing `incident.raised` from `arc-run`'s gate does not count.

**Forgery is detected, not prevented.** Anyone holding the emitter can write a note. The fold
folds only events that pass `validateEvent` and an `eventSha` recompute, deduped on `idem`; a
headless refusal counts only when its `incident_ref` resolves to an accepted `incident.raised`
from `arc-run policy gate` on the same process and IST day. On top of that it discards a `policy.refusal` whose `(decision, level)` is inconsistent with the reducer's
effective level for that pair at the receipt's spine position (a `propose` needs effective
L1; a `deny` at L2+ needs a cited resource reason). A forged receipt that is consistent still
refreshes a cell, and that residual is attacked by name in the phase's adversarial pass.

**Volume is bounded at the writer:** at most one `policy.refusal` per (action_kind, capability,
decision, IST day). The writer checks that day's file before emitting. The fold needs the
latest per day and nothing finer.

POL-L3 is decided here too: a scheduler `incident.raised` with `class: "policy-declined"`
counts only if its `denials` carry `capability` as a typed field. Otherwise its cells read
`unknown` for that surface, and the scheduler lane owns adding the field.

## Consequences

Easier: zero vocabulary change; `KINDS.length` and every derived-count test are untouched;
the brief already groups the kind.

Harder: a refusal is now a profile someone must know to look for, and a reader that counts
`note.logged` alone sees refusals mixed with ADR notes. The face and the guard read through
the fold, never by kind.

What we'd revisit: the trigger above. If refusals become a real stream, they are a distinct
truth source, and ADR-0508's bar for a fifth policy kind applies.

# ADR 1012 — Exactly two recurring human gates, and one-time setup approvals are not gates

**Status:** accepted
**Date:** 2026-08-12
**Product:** `growth`
**Reversibility:** two-way
**Revisit trigger:** review-pack median time exceeds 5 minutes across a full week of articles —
then the friction is real and the *contents* of a gate are redesigned, never a third gate added.

## Context

GRO-J caps human gates at exactly two. The failure it prevents is pre-mortem row 2: review fatigue
→ rubber-stamping, where a gate that exists on paper stops being a gate in practice. Constitution
**A3** points the same way — a feature that adds human hours is a regression, however impressive.

An ambiguity would otherwise sink this: several one-time acts in this cycle also ask the owner to
choose something — picking the domain (ADR-1105), approving the voice exemplars (ADR-1114),
choosing the brand assets (REQ-06). Counted naively, the cap is blown at kickoff.

## Options considered

1. **Cap the two gates in the *recurring publishing loop*; one-time setup approvals are named
   and excluded.**
2. Count every approval. Con: the cap is broken before the first article and becomes a number
   nobody believes, which is worse than no cap.
3. Drop the cap. Con: gates accrete one reasonable addition at a time, which is exactly how
   review fatigue arrives.

## Decision

**Option 1.** The two recurring gates, and only these two, repeat per unit of work:

| # | Gate | Cadence | Artifact |
|---|---|---|---|
| 1 | **Cluster approval** — the keyword/cluster plan, before any generation runs | once per cluster | ONE inbox item, every row evidence-linked |
| 2 | **Review-pack approval** — per article, before merge | once per article | ONE inbox item: preview URL · lint report · citation report · diff · POV line. Target ≤5 min |

**One-time setup approvals are not gates and are enumerated here so the exclusion cannot be used
to smuggle in a third:** the domain choice · the voice exemplars · the brand-asset pick. Each
happens **once for the lane's lifetime**, not once per article or per cluster. Any approval that
recurs per article or per cluster **is** a gate and is therefore forbidden without an ADR.

The human **merge** is not a gate in this count — it is E2 (ADR-1102), a constitutional act that
exists whether or not growth has an opinion about gate counts.

Both gates ride the existing inbox: `arc-inbox approve|reject <ULID> --reason` with a mandatory
reason, decisions final, corrections by `supersedes`. Growth adds no new approval surface.

**Evidence:** design source GRO-J, REQ-01, REQ-03, pre-mortem row 2 · `CONSTITUTION.md:41` (A3) ·
`CONSTITUTION.md:21-24` (E2) · existing inbox contract.
**Confidence:** high.
**Rejected because:** option 2 makes the cap arithmetic nobody trusts; option 3 is how gate creep
happens.

## Consequences

Easier: the weekly cost of running growth is knowable in advance — one cluster approval plus 2–3
five-minute reviews. Harder: any genuinely useful future checkpoint has to displace one of the two
or justify itself with its own ADR, and "just one more quick confirmation" is now a decision with
a paper trail.

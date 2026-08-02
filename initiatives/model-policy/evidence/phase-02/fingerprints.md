# MP-F fingerprints — REQ-03 paired composer A/B

Per [ADR-0068](../../../../docs/adr/0068-mp-f-model-fingerprint-forward-only-never-estimated.md)
and [ADR-0069](../../../../docs/adr/0069-balanced-model-policy.md) block (e).

> **Forward-only, and an unavailable field stays ABSENT.** Recorded, estimated and fabricated
> are three different things and only the first is allowed. Every `absent` below is a fact
> about the instrument, not a gap to be filled in later from memory.

## Shared across both arms (the control)

| Field | Value |
|---|---|
| Pinned commit | `e46bbda` — recorded by `design-explore.sh init` into both arms' `base-revision.txt`, asserted equal before either run |
| Brief | `docs/design/briefs/lexos-case-workspace/brief.md` |
| Director | `design-director`, run **once**, into run-S only |
| Assignment transfer | `thesis.txt` copied byte-for-byte into run-O; SHA-256 equality asserted per variant before any composer started |
| `thesis.txt` SHA-256 (a) | `18986dd2be0871fe…` — identical both arms |
| `thesis.txt` SHA-256 (b) | `c1fc653c7c113e83…` — identical both arms |
| `thesis.txt` SHA-256 (c) | `c7545095cd116ef7…` — identical both arms |
| Composer prompt | Identical text for both arms, per variant. The ONLY intended difference between arms is the model tier. |
| Renderer recipe | `PIN_FONT=0` → `font-true;aa-on` (typography preserved — retro-log 2026-07-30) |

## Arm S — balanced-workhorse tier

| Field | Value |
|---|---|
| provider | anthropic |
| exact model id | `sonnet` (tier alias as passed to the agent runner; the runner resolves it) |
| agent role | `ui-composer` ×3 (variant-a, variant-b, variant-c) |
| agent-file commit SHA | `e46bbda` (`.claude/agents/ui-composer.md` at the pinned commit) |
| input/brief SHA | per-variant `thesis.txt` SHA-256 above |
| timestamp (spawn) | 2026-08-02, after the byte-identity assertion |
| wall-clock duration | *pending — recorded on completion* |
| effort setting | **absent** — not surfaced to this session |
| statusline cost | **absent** — the statusline reports per-session totals, not per-agent; a per-arm figure cannot be read out, and ADR-0069 block (c) already records that per-item cost attribution does not exist today |

## Arm O — high-judgment tier

| Field | Value |
|---|---|
| provider | anthropic |
| exact model id | `opus` (tier alias as passed to the agent runner; the runner resolves it) |
| agent role | `ui-composer` ×3 (variant-a, variant-b, variant-c) |
| agent-file commit SHA | `e46bbda` — **the same agent file**; the frontmatter `model:` was NOT edited |
| input/brief SHA | per-variant `thesis.txt` SHA-256 above — identical to arm S |
| timestamp (spawn) | 2026-08-02, same batch as arm S |
| wall-clock duration | *pending — recorded on completion* |
| effort setting | **absent** — not surfaced to this session |
| statusline cost | **absent** — same reason as arm S |

## Policy note

This is an **MP-A exploratory-freedom trial** (ADR-0063 carve-out 1, ADR-0069 block **g**):
an isolated, receipted experiment on a branch, with a fingerprint. The tier was applied as a
**per-invocation override at spawn time**; `.claude/agents/ui-composer.md` frontmatter is
untouched. No production tier change occurred, so no policy amendment is required — that is
exactly the boundary block (g) draws.

**Cost honesty.** Both arms record `statusline cost: absent`. That is not an oversight and
must not be filled in later: arc has no per-item cost attribution (ADR-0069 block (c) names
`cost.incurred` as a defined kind with no emitter). REQ-03's keep/revert formula requires the
owner to *accept a recorded cost/time delta* — so what the owner will actually be given is a
**wall-clock delta, and an explicit statement that the rupee delta is unmeasured**. Presenting
an estimated cost as recorded would violate MP-F and Truth-Law E3, and would corrupt the one
decision this whole phase exists to inform.

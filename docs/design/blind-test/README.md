# Blind test — the two external evidence streams, and how a result becomes a receipt

This directory holds the evidence files for REQ-01's two external blind streams (ADR-0040) and
documents the **outcome-evidence path**: how a result that arrives in one of these files becomes
a `note.logged` receipt on the spine, scored against the prediction the owner sealed at pick time.

Nothing here judges design. These files receive what people outside arc said, and the receipt
path makes that answer permanent and attributable. Arc grading arc is not evidence — that is the
whole reason this directory exists.

## The two streams are not interchangeable

| | **Stream A** | **Stream B** |
|---|---|---|
| Who | Experienced designers (peers) | Target users — practising litigation lawyers |
| What they are asked | Judge coherence, distinctiveness, feasibility, craft | Attempt the key task on the surface |
| PASS bar | **≥2 of 3 directions taken seriously** | **Task completed without intervention** |
| Evidence file | `<explore-id>/stream-a-designers.md` | `<explore-id>/stream-b-users.md` |
| What it can NOT prove | That anyone can use it | That it is well made |

Both must pass for REQ-01 to leave `active` (ADR-0040). A peer saying "looks good" is never user
validation, and a user finishing a task is never craft evaluation — that is why row 9's single
mixed panel was killed, and why merging these two files would destroy the distinction the ADR
was written to protect.

**Arc's authorship is undisclosed to both streams.** A respondent who knows an AI system made
these is answering a different question than the one being asked.

## Timing — launch is not wait

| Rule | Where | What it means here |
|---|---|---|
| Launch ≠ wait | ADR-0041 | The phase does not hold its appetite open waiting for replies. Requests SENT is the criterion; replies arriving is not. |
| 14-day window | ADR-0040 revisit trigger | If either stream proves impossible to recruit at ₹0 within 14 days of Phase-3 build-complete, the **evidence standard itself** returns to the owner. It never silently weakens. |
| REQ-01 stays `active` | ADR-0041 | Until BOTH streams pass. A half-passed REQ-01 is not a passed one. |

## The outcome-evidence path — `note.logged` (ADR-0035, ADR-0038)

Design rides the closed spine vocabulary (ADR-0026/0035). There is no `blind.test.result` kind
and there will not be one; outcome evidence is a `note.logged` carrying a design payload.

**When a stream's results are in**, fill the evidence file first, then emit ONE receipt per
stream. The receipt points at the file rather than restating it — the file is the evidence, the
receipt is what makes it findable, ordered and permanent.

```
node .claude/scripts/hq/arc-event.mjs emit note.logged \
  --payload '{"lens":"design","note":"blind-test-outcome","stream":"A","explore":"lexos-case-workspace-v1","scores":"01KYRX3HYM2BYMHKEZZD1RDHN9","result":"pass","prediction":"held"}' \
  --evidence docs/design/blind-test/lexos-case-workspace-v1/stream-a-designers.md \
  --process "arc-blind-test@1.0.0" \
  --strict
```

| Field | Why it is there |
|---|---|
| `lens: design` | Same convention `review.completed` uses, so design receipts are one filterable set across kinds |
| `note: blind-test-outcome` | Distinguishes this from every other `note.logged` — the kind is generic, the payload is not |
| `stream` | `A` or `B`. Two receipts, never one merged receipt (ADR-0038: two ledgers, never merged) |
| `scores` | The ULID of the `decision.recorded` holding the pick + prediction. **Without this the outcome floats free and the prediction can never be settled.** |
| `result` | `pass` / `fail` — against that stream's own bar in the table above, not against a general impression |
| `prediction` | `held` / `falsified` — a SEPARATE judgment from `result`, see below |
| `--evidence` | Path to the filled evidence file. The receipt carries the pointer; the file carries the detail |
| `--strict` | Exits non-zero on a malformed receipt instead of quarantining it. Use it for anything deliberate. |

### `result` and `prediction` are two different questions — do not collapse them

| | Asks | Can be |
|---|---|---|
| `result` | Did this stream clear ITS bar? (≥2 of 3 taken seriously / task completed) | The direction is fine even if arc predicted the ranking wrong |
| `prediction` | Was the owner's sealed claim right? | The prediction can be falsified while the stream still passes — and that is a normal, useful outcome |

Collapsing these would make a wrong prediction look like a failed design, or a passing stream
look like a validated prediction. Neither is true, and the second is the more dangerous.

### The prediction being wrong is not a failure to hide

The prediction sealed for `lexos-case-workspace-v1` predicts a **disagreement between the two
streams**. If it is falsified because both streams agree, arc's loop looks *better*, not worse.
Record `prediction: falsified` plainly and say in the evidence file which clause failed. A
prediction ledger that only ever records hits is not calibrating anything (ADR-0038).

## What must never happen in this directory

| Never | Why |
|---|---|
| Write a result nobody sent | A fabricated respondent is worse than no evidence — it looks like proof |
| Merge Stream A and Stream B into one file or one receipt | ADR-0040's entire decision; two ledgers never merge (ADR-0038) |
| Emit an outcome receipt without `scores` | The prediction it settles becomes unfindable, and the pick can never be scored |
| Edit a sealed `decision.recorded` | Impossible by construction — a second decision on the same approval collides as `DUP_IDEM`. Corrections go on as a new `note.logged` naming what they correct |
| Soften a PASS bar because results were disappointing | The bars are in ADR-0040. Changing them is an owner decision on the record, never an edit here |

# Extraction report -- SPECIMEN (Phase 00 steel thread, not a study)

> **This is a SPECIMEN, deliberately synthetic, and it is not a study of anything.** Its only job
> is to be a well-formed report so the Phase-00 steel thread has something real to run end to end:
> a named source goes in, `report-lint` returns a verdict, the verdict is the evidence.
>
> **Why it is synthetic rather than a real source.** A real study must go through the read-only,
> injection-aware harness that does not exist until Phase 01, and the ADR-0606 first target
> (gstack's post-build review pass) belongs to Phase 04. Hand-studying either one here would be
> doing a later phase's work without the boundary that makes it safe, and it would produce evidence
> the cycle would then have to disown. The steel thread needs a well-formed report, not a true one.
>
> The fields below are shaped exactly as ADR-0601 requires, so the lint exercises every check it
> owns in this phase: five headings in order, and the `citation` / `verdict` / `license note` fields
> populated on the row.

## Source

- **Identity:** `specimen-source` -- a fictional repository, invented for this file
- **Pin:** `0000000`, 2026-08-09 (a real pin field carrying an obviously fake pin, so nobody mistakes
  this for a fetched source)
- **License:** MIT, stated here as a field-shape example only -- nothing was read and nothing was
  copied

## Study scope

- **Read:** nothing. No source was fetched, opened or parsed to write this file.
- **Not read:** everything. See the note at the top -- the read-only harness is Phase 01.
- **Archaeology budget spent:** 0 hours

## Technique inventory

| id | name | what it does | why it wins | citation | verdict | reason | license note | risk note |
|---|---|---|---|---|---|---|---|---|
| T-01 | specimen-technique | stands in for a real technique so the report has one complete row | it does not win anything; it is a shape, not a finding | specimen-source/README.md:1 | SKIP | synthetic specimen, nothing to absorb -- SKIP is the honest verdict for a source that was never read | MIT, nothing copied, nothing re-expressed | none: no code was read, so no risk was taken |

## Verdict summary

| verdict | count |
|---|---|
| ABSORB | 0 |
| INTEGRATE | 0 |
| ROUTE | 0 |
| SKIP | 1 |

## SKIP and refusal log

- **T-01 SKIPped** -- synthetic specimen row. No source existed to study, so there was nothing to
  absorb, integrate or route. Recorded rather than omitted, because a SKIP that is not written down
  did not happen (A10).
- **Refusals:** none. No license was evaluated, because no code was read.

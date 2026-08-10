# Extraction report — SOURCE NAME HERE

<!-- ADR-0601 (ABS-B). The five headings below are REQUIRED, verbatim and in this order, and
     `report-lint` names any one that is missing. Do not rename, reorder or add a required
     heading without amending ADR-0601 — the lint reads this contract, not this comment.

     THIS FILE IS THE TEMPLATE, so it deliberately does NOT pass report-lint clean: its
     inventory row is a placeholder with empty required fields, which is exactly what the lint
     exists to report. A filled report passes with zero warnings. -->

## Source

- **Identity:** name of the repo, docs set or transcript
- **Pin:** commit SHA, or URL plus retrieval date — a source with no pin is not a source
- **License:** the actual license text found, and where it was found. Not an assumption from
  the ecosystem it lives in.

## Study scope

- **Read:** which files, which directories
- **Not read:** what was skipped, and why — an omission recorded is honest, an omission
  inferred later is not
- **Archaeology budget spent:** hours. More than 1 day means SKIP with a reason (PLAN rabbit
  hole), never a longer study.

## Technique inventory

One row per technique. `id` is `T-01`, `T-02`, zero-padded and unique within this report — it is
the string a `report-lint` warning names when it reports a row.

`verdict` is one of **ABSORB · INTEGRATE · ROUTE · SKIP**.

| id | name | what it does | why it wins | citation | verdict | reason | license note | risk note |
|---|---|---|---|---|---|---|---|---|
| T-01 |  |  |  |  |  |  |  |  |

## Verdict summary

| verdict | count |
|---|---|
| ABSORB | 0 |
| INTEGRATE | 0 |
| ROUTE | 0 |
| SKIP | 0 |

## SKIP and refusal log

Every SKIP and every license refusal, with its reason. A refusal that is not written here did not
happen — and refusals are never deleted (A10).

- none

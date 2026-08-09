# ADR 0601 — ABS-B: the extraction report is a fixed, lint-checkable template, and attribution law lives in it

**Status:** accepted
**Date:** 2026-08-09
**Product:** `absorb`
**Reversibility:** two-way
**Revisit trigger:** a real study produces a finding that no required field can hold honestly —
recorded in the report, then the template is extended by an amendment to this ADR rather than by
a field quietly appearing.

## Context

The report is the artifact the owner reads *instead of* reading the source. That makes it a trust
surface: if it can omit a citation, a license, or a refusal, then "I studied this" is an assertion
rather than evidence. arc's standing lesson is that a pass condition which is only an absence
cannot detect insufficiency, so the template must require presence of specific fields, checked by
a script rather than by the author's care.

The second job is license hygiene. Copying an incompatible-licensed implementation into arc is a
contamination event that no later diff can undo cleanly, so the rule has to sit where the study
happens, not in a policy document nobody opens mid-study.

## Options considered

1. **Free-form report, reviewed by a human.** Pros: no template work. Cons: the reviewer is the
   same person the report exists to save; a missing citation is invisible.
2. **Fixed headings + required per-row fields, validated by `report-lint`.** Pros: deterministic;
   a missing license note fails rather than passes quietly. Cons: template rigidity, and v1 will
   guess some fields wrong.
3. **Full taxonomy of technique types up front.** Rejected as the plan's own named rabbit hole —
   taxonomy elegance is stale on arrival, and only fields with live consumers earn a place in v1.

## Decision

**Fixed headings, every one required:**

- **Source** — identity + pin (commit / URL / date) + license
- **Study scope** — what was and was not read; archaeology budget spent
- **Technique inventory** — one row per technique: `id` · `name` · what it does · why it wins ·
  **evidence citation** (`file:line` or transcript ref) · classification verdict + reason ·
  license note · risk note
- **Verdict summary** — counts per bucket (ABSORB / INTEGRATE / ROUTE / SKIP)
- **SKIP / refusal log** — including the reason, never an omission

**Attribution law lives here, stated once:** ideas are re-expressed by default. Permissive-license
copying (MIT / BSD / Apache) records attribution in **two** places — the registry row's
`attribution` field **and** a source comment in the rebuilt file. An incompatible license is a
**refusal**, logged in the registry with its reason; there is no third option and no judgement
call at study time.

`report-lint` validates headings and required per-row fields. **WARN-first in TRIAL** per the
standing rule — promotion to FAIL goes through `/arc-retro` against `docs/trial-ledger.md`, never
by editing the gate.

## Consequences

**Easier.** The owner can trust a report without re-reading the source, because the fields that
would let it lie are the fields a script checks. A refusal is recorded rather than forgotten,
which is what makes the registry an honest ledger rather than a trophy shelf.

**Harder.** Every study now pays a fixed paperwork cost, including small ones — and a WARN-first
lint means v1 reports can ship incomplete, so the first real study is also the template's first
honest test. The `why it wins` field is prose and therefore unverifiable by lint; the A/B is what
arbitrates it (ADR-0605), not the report's own confidence.

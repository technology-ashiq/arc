# ADR 0018 — Script-written juror artifact + run-record; disagreement is signal, never failure

**Status:** accepted
**Date:** 2026-07-16
**Reversibility:** one-way
**Revisit trigger:** an adversarial pass demonstrates a trivial forgery path the run-record does not
surface (forcing checksums/signing), or UNRESOLVED-surfaced juror disagreements prove so frequent on
real runs that they need their own resolution protocol.

## Context
The anti-fabrication value of the juror depends on WHO writes its output. If a Task agent grades and the
Chair transcribes the result into the verdict, the juror is exactly as fabricable as the REBUTTAL LOG was
before ADR-0014. And once two graders exist, something must define what happens when they disagree —
requiring agreement would let either grader (or a prompt quirk) veto honest verdicts.

## Options considered
1. **`council-juror.mjs` writes the artifact + run-record itself; lint treats disagreement as
   surfaced signal** — the script calls the provider, writes `## JUROR RATINGS` + a run-record (UTC
   timestamp, base-url host, model, request/response sizes, latency — never the key) to the artifact
   file directly; juror-vs-verifier disagreements MUST be surfaced under `## UNRESOLVED`, and lint
   verifies presence/parse/consistency — never agreement — pros: fabrication now requires forging a
   mechanically-produced artifact with a run-record, a higher and auditable bar; honest disagreement
   between model families (the point of diversity) is displayed, not suppressed; cons: local files
   remain editable — this raises the bar, it is not cryptographic (named honestly, as in ADR-0014).
2. **Chair-transcribed juror output** — cons: reopens the exact ADR-0014 fabrication class.
3. **Lint requires juror-verifier agreement** — cons: turns diversity into a veto; a Chair could also
   game "agreement" by feeding the juror the verifier's answers.

## Decision
Option 1. The juror artifact is produced by the script, referenced from the verdict (`Juror:` line +
`## JUROR RATINGS`), and disagreement with the verifier's ratings is recorded under `## UNRESOLVED` as
genuine signal. The carrying reason: mechanical production is what makes the juror an ANCHOR rather than
another Chair-authored section.

**Reconcile note (2026-07-16, attack panel, pre-STOP):** the revisit trigger's first clause FIRED at
kickoff — the panel proved a hand-typed `## JUROR RATINGS` (no byte tie to the artifact) defeats the
design outright. The **SHA-256 verdict↔artifact binding** (`Juror-Artifact-SHA256:` line, checked by
`council-lint --verdict --juror-artifact <file>`) is therefore IN scope for v3 (REQ-05). Cryptographic
signing beyond the hash remains out.

## Consequences
Easier: the ADR-0014 fabrication probe becomes checkable (a fabricated first-pass contest now has to
survive an independently-produced artifact); disagreement enriches UNRESOLVED instead of blocking runs.
Harder: the script owns a failure taxonomy + retry; the run-record must be scrubbed of secrets; the
honest residual (post-hoc file editing) is documented and stays until signing is ever justified.

# Suppressions

Findings explicitly waived from blocking. Every row **must** carry a `fingerprint`,
a non-empty `justification`, and a `date`. An entry without a justification does
**not** suppress — the finding still blocks, and the scan reports it as an
unjustified suppression. No silent ignores (ADR-0002).

How to suppress a finding: copy its `arcFingerprint` from `.claude/state/scan/scan-result.sarif`,
add a row below with a real justification, and commit it. To un-suppress, delete the row.

| fingerprint | justification | date | by |
|---|---|---|---|
| example000_0 | EXAMPLE ROW — remove me. Shows the required columns. | 2026-07-09 | arc |

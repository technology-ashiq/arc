# Suppressions

Findings explicitly waived from blocking. Every row **must** carry a `fingerprint`,
a non-empty `justification`, and a `date`. An entry without a justification does
**not** suppress — the finding still blocks, and the scan reports it as an
unjustified suppression. No silent ignores (ADR-0002).

How to suppress a finding: copy its `arcFingerprint` from `.claude/state/scan/scan-result.sarif`,
add a row below with a real justification, and commit it. To un-suppress, delete the row.

| fingerprint | justification | date | by |
|---|---|---|---|
| 540d4d16b8296869f0c326732847fc334bf0b6ff | test fixture — planted GitHub PAT used by tests/baseline.bats; not a live secret | 2026-07-10 | arc |
| 74710d05728400a9a1e949fb8c38d9df843e6708 | test fixture — planted GitHub PAT used by tests/suppress.bats; not a live secret | 2026-07-10 | arc |
| 79dadf7f242e87dcb7d6c344c2abe3b122de84b4 | test fixture — planted GitHub PAT used by tests/triage-llm.bats; not a live secret | 2026-07-10 | arc |
| a4e214153c8dde5c54e3902d7df4d080152b32de | test fixture — planted GitHub PAT used by tests/arc-scan.bats; not a live secret | 2026-07-10 | arc |
| aaed20bd333ca76fd48e50c2d8dfe06b4ae34447 | test fixture — planted GitHub PAT used by tests/arc-scan.bats; not a live secret | 2026-07-10 | arc |
| ad6215f35f36e7edd4fd76cb0ec27adb980be8b0 | test fixture — planted GitHub PAT used by tests/arc-profile.bats; not a live secret | 2026-07-10 | arc |
| d0a6174c191f002ebfd6b2378640c88305423261 | test fixture — planted GitHub PAT used by tests/arc-scan.bats; not a live secret | 2026-07-10 | arc |
| dd315f9976538f05a513333cb1f3a92d5a9e71e5 | test fixture — planted GitHub PAT used by tests/suppress.bats; not a live secret | 2026-07-10 | arc |

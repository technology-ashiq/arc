# discover — debt ledger

LOW findings accepted after the attack-round cap (two rounds per PR). Each names the finding and where it would be paid.

| Finding | Where | Why deferred | Paid when |
|---|---|---|---|
| L3 (8bb1a72 r1): the manifest test checks `name` + `face.room` only, not ring/stations/kinds | tests/discover-birth.bats | `face-sections.mjs --check` and `face-coverage.bats` already assert the whole face section against the contract on CI | if face-sections ever stops writing the section |
| L6 (8bb1a72 r1): `^discover` misses a process named e.g. `hunt-discover` | tests/discover-birth.bats | ADR-1913's trigger is a discover process born with its row in one PR; the test is a tripwire, not the control | Phase 02 if council wiring adds a process file |
| L3/L4/L8 (5e1d529 r2): prefix-only process tripwire, file-wide test-count grep, CATALOG grep brittle to a reflow | tests/discover-birth.bats | tripwires, not the control; face-coverage and products.bats hold the real checks | when any of them goes red on a legitimate refactor |
| L6/L12 (5e1d529 r2): stub test does not prove a module-level import throw would still print the exact refusal | tests/discover-birth.bats | Phase 01 replaces the stub with the real CLI and its own flag tests | Phase 01 |
| B3/B4/B5 (5e1d529 r2): cd inside a test, guarded main exits 0 silently on a realpath throw, hostile strings in attack evidence JSON | tests/, arc-discover.mjs, evidence | bats runs each test in a subshell; a non-main import is the documented behaviour; evidence is data never executed | if a caller treats a silent exit 0 as success |

Rejected round-2 findings (fixed taxonomy, ADR-0067):

```
REJECTED: L9 arc-hunt.md still interpolates $ARGUMENTS into the shell line — already-covered
REJECTED: L11 fixed-defects claims a fix that was never applied — already-covered
```
(the committed doc at 5e1d529 runs `--niche-file`; the attacker read the diff's removed line as current)

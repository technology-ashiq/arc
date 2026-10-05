# discover — debt ledger

LOW findings accepted after the attack-round cap (two rounds per PR). Each names the finding and where it would be paid.

| Finding | Where | Why deferred | Paid when |
|---|---|---|---|
| L3 (8bb1a72 r1): the manifest test checks `name` + `face.room` only, not ring/stations/kinds | tests/discover-birth.bats | `face-sections.mjs --check` and `face-coverage.bats` already assert the whole face section against the contract on CI | if face-sections ever stops writing the section |
| L6 (8bb1a72 r1): `^discover` misses a process named e.g. `hunt-discover` | tests/discover-birth.bats | ADR-1913's trigger is a discover process born with its row in one PR; the test is a tripwire, not the control | Phase 02 if council wiring adds a process file |

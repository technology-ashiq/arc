# SERVED — face v2 Phase 04

Phase 04 (REQ-06, ADR-1324). Every panel a door read route now fills, with the route it reads. It is the other half
of `residue.md`: a panel Phase 03 listed as NOT SERVED is in exactly one of the two files, by module and panel.

It is derived, never typed: `tests/face/module-frame.mjs` folds every shipped module with nothing loaded and requires
the rows below to EQUAL the `servedTable()` panels the folds return, both ways (`registry.servedOf`). The browser
suite counts the same panels in the page per mood (`smoke: served mood=M panels=N rooms=...`) and holds that count,
room by room, against this list.

| module | panel | route |
|---|---|---|
| `board` | Ventures | `/api/ventures` |
| `today` | Policy | `/api/policy` |
| `today` | Learned this week | `/api/learn` |
| `absorb` | The registry | `/api/absorb` |
| `absorb` | Adopted per lane | `/api/absorb` |
| `bench` | The bench | `/api/bench` |
| `engine-room` | Drivers, routers and budgets | `/api/engine` |
| `engine-room` | Drivers on disk | `/api/engine` |
| `engine-room` | Budgets | `/api/engine` |
| `evolve` | Experiments | `/api/evolve` |
| `evolve` | Experiment contract | `/api/evolve` |
| `memory` | Lessons | `/api/memory` |
| `model-policy` | The tier table | `/api/model-policy` |
| `model-policy` | Process routes | `/api/model-policy` |
| `policy` | The subject table | `/api/policy` |
| `policy` | The ladder | `/api/policy` |
| `scheduler` | Next fire and cadence | `/api/jobs` |
| `scheduler` | The heartbeat | `/api/jobs` |
| `council-chamber` | The verdict ledger | `/api/council` |
| `council-chamber` | Calibration | `/api/council` |
| `develop` | Slices | `/api/slices` |
| `develop` | The Definition of Done | `/api/slices` |
| `executor` | Hires on the books | `/api/roster` |
| `executor` | Runs | `/api/roster` |
| `factory` | Gate modes and the profile | `/api/gates` |
| `review-ship` | Gate modes and the profile | `/api/gates` |
| `growth` | The pipeline | `/api/growth` |
| `leads` | The funnel by lead | `/api/leads` |
| `leads` | The caps | `/api/leads` |
| `leads` | Suppression ledger | `/api/leads` |
| `legal` | The gates | `/api/gates` |
| `legal` | The publish gate | `/api/legal` |
| `legal` | The seals | `/api/legal` |
| `money` | Fourteen days | `/api/pnl` |
| `money` | Fourteen days, simulated | `/api/pnl` |
| `money` | Fourteen days, cost lines | `/api/pnl` |
| `ventures` | The rules of the file | `/api/ventures` |
| `learn` | Playbook rules | `/api/learn` |
| `strategy` | The decision record | `/api/adrs` |

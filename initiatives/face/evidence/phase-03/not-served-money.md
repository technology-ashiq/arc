# NOT SERVED — money ring

Phase 03, ring 4 of 5 (face v2 Cycle 16, ADR-1324, REQ-05). Every panel of the money ring's served modules that
renders `NOT SERVED`, with the route it needs. **This list, not PLAN-face-v2 §5.2's table, is what Phase 04
builds.**

It is derived, never typed: `tests/face/module-frame.mjs` folds every money module with nothing loaded and
requires the rows below to EQUAL the `notServed()` entries the folds return, both ways, including the sentence.
The smoke counts the same panels in the page per room, per mood.

| module | panel | route it needs | what it would show |
|---|---|---|---|
| `growth` | The pipeline | `/api/growth` | Every piece from draft to review pack to published, its status moving only on receipts, with the approved sha beside the published one. |
| `leads` | The funnel by lead | `/api/leads` | Each lead in its current stage with its touches in the rolling window, folded by the leads lane from its own receipts and keyed by its HMAC id, never a raw contact. |
| `leads` | The caps | `/api/leads` | The daily send cap and the per-lead touch cap from the leads config, against today's sends counted from receipts -- values in config, enforcement in code, nothing to reset. |
| `leads` | Suppression ledger | `/api/leads` | Every suppressed lead, why, and since when -- event-backed and derived, with no way to reset it. A suppressed lead lands here and never leaves. |
| `legal` | The gates | `/api/gates` | Every enforcement gate with its mode -- block, warn, profile or off -- its tier and its evidence, parsed from arc.gates.yaml, where a mode changes only by a reviewed diff. |
| `legal` | The publish gate | `/api/legal` | The pieces held between draft and the internet right now -- awaiting a review pack, or approved with their sha pinned and awaiting a person's merge -- with the legal lints' results beside each. |
| `legal` | The five seals | `/api/legal` | The actions no level of proven autonomy ever includes, as the constitution states them -- moving money, killing a venture, changing a price, unlocking real-money trading, publishing under the owner's name. |
| `legal` | Hash chain | `/api/legal` | The legal lane's verification chain: how many receipts it covers and whether it is intact, from the lane's own verify run -- append-only, a correction supersedes, a closed day never changes. |
| `money` | Fourteen days | `/api/pnl?by=day` | Simulated revenue, cost and real revenue by day on one axis -- three substances, three marks, never one line -- each point derived by the money brain, which serves months today and no daily series. |
| `money` | The milestone line | `/api/strategy` | The honest ranges the company has written down for when money arrives, read from its strategy documents rather than typed into this screen. |
| `money` | Where money comes from | `/api/ventures` | Each venture's revenue model and price, and what the factory itself may earn, from each venture's own record -- never a sentence typed into this room. |
| `ventures` | Passports | `/api/ventures` | Each venture's passport -- live, candidate or attic, its stage and its own repo -- as ventures.yaml records it, with a row that leaves only by your stamp and never by deletion. |
| `ventures` | The rules of the file | `/api/ventures` | ventures.yaml's own rules, read from the file rather than typed here: criteria only, money never lives in it, and the digest is over parsed values so it cannot be edited silently. |

Two routes here are not new door routes but a new shape of one: `/api/pnl?by=day` is the money brain's daily series
on the P&L route the door already serves, and `/api/gates` is the gates table the factory ring's review-and-ship
room already named. The three planned rooms (`ops`, `trader`, `discover`) name no route at all: a planned room is
drawn from the planned-rooms registry, and its flows are REHEARSAL (`rehearsal-money.md`), never a route to build.

## What the ring reads from routes the door already serves

`money` and `ventures` read the kinds that have ever fired (`/api/health`), the real P&L with its kill panel
(`/api/pnl`) and the simulated one (`/api/pnl?simulated=1`) -- two reads of two kinds, never merged, a body of the
other substance refused as `WRONG_SUBSTANCE` -- and `ventures` adds ventures.yaml's provenance through
`/api/file/ventures`. `growth`, `leads` and `legal` are lane rooms (`face/src/lib/lane-room.mjs`): their lane's
PROGRESS header and phase specs through `/api/lane/:id` and the receipts of the kinds the registry homes in them
through `/api/spine` -- counted by kind on the page the door sent, and `growth`'s published pieces by the channel
each receipt names -- with `legal` adding the constitution's provenance through `/api/file/constitution`. The
planned rooms read one allow-listed file, `/api/file/planned-rooms`.

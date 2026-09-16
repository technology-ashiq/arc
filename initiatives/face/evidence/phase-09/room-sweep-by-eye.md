# Phase 09 — room sweep, by eye (verification item 5)

- **Date:** 2026-09-16, ~21:45 IST
- **Where:** MAIN clone `E:/Work_Hub/01_Automemory/arc` at `34d2fb46` (tree-identical to the
  Phase 09 CI run on every face path), started with `node .claude/scripts/hq/arc-face.mjs`
  → door `127.0.0.1:8317` (spine: canonical) + app `localhost:5180`, fresh `npm ci` from the
  tracked lockfile.
- **Browser:** Playwright MCP, headless Chromium. (`/browse` could not start here: every
  directory named `.gstack` comes back permission-denied in this sandbox, so its lock file can
  never be created.)
- **Why this file exists:** the earlier `live-demo.md` sweep counted characters per room. Item
  5 says "a screenshot is not a substitute for opening it", and main had moved since then
  (`PLAN-face-v2.md` landed, strategy plans 24 → 25). This time the rooms were opened and the
  screenshots were looked at.

## Result

| check | measured | verdict |
|---|---|---|
| served registry | `/api/rooms` → **34** (33 in the rail + the `lane` template, reachable from ⌘K) | ✔ |
| every rail room opens | 33 of 33 clicked in order; each shows its own h1, so the click really changed the room | ✔ |
| console | **0 errors** across the whole sweep; 2 warnings, both `THREE.Clock` deprecation from a library | ✔ |
| broken-render strings | `undefined` · `NaN` · `[object Object]` · `Something went wrong` · `crashed` · `TypeError` → **0 hits in 33 rooms** | ✔ |
| `board` → ADR map | **14 bands** render as rows, 0000–1399 (screenshot looked at) | ✔ rows · see F1 |
| `scheduler` → jobs | both jobs from `hq.jobs.yaml` render as rows under RUNS UNATTENDED: `brief-materialize`, `day-close-roll` | ✔ rows · see F2 |
| `ventures` → passports | `lexos` passport: real / MRR / simulated all read NEVER with the route each comes from; both kill lines "not evaluated" with a reason; the factory overhead is shown separately | ✔ |
| `strategy` → plans queue | **25 plans**, including `PLAN-face-v2` | ✔ |
| CI | homed in **Review & Ship**, not in a room of its own: "whether the last run was green is not instrumented here, and this room will not imply it from a list of names" | ✔ honest state · wording note below |
| `/api/lane/:name` phases | `face` → 9 spec files (00, 01, 03–09); `design` → `phases: []`, so the key is present and the list is empty. Those are different answers | ✔ |
| `chat-mcp` | in the rail, dimmed as planned, and opens | ✔ |

**Wording note (CI):** the exit criterion says "A CI room". What shipped is CI's honest state
inside Review & Ship, which is where `face-coverage` homes the 4 workflows / 168 bats suites.
The honest vocabulary is in place. It is just not a separate room.

## Findings: defects only opening the rooms could show

None of these fails a Phase 09 exit criterion. All three move to face v2, because P03 rebuilds
the `board`, `scheduler` and `trader` rooms as modules.

- **F1: the ADR map shows room names where it promises lane names.** The panel says the band
  answers "which lane owned this decision", and then shows the room each band is homed in:
  `1300–1399 → Toolbelt` (that is face's band), `1000–1099 → Money` (ledger's),
  `0000–0099 → Board`. Cause: `contracts/expected-set.json` `adrs.map` homes bands to ROOMS,
  and the panel prints that map. ADR-1317 decision 4 says "one row per band, **each naming its
  lane**".
- **F2: the scheduler's lede promises more than the room shows.** "jobs, their next fire, their
  last outcome, and the heartbeat" — the two jobs are listed, but next fire and last outcome
  are shown nowhere, and nothing says they are missing.
- **F3: a planned room wears a LIVE pill.** `trader` shows `● LIVE` at the top ("39 receipts
  across 1 of 1 kinds", which is company-wide `day.closed`), while its own lede says "planned,
  drawn dotted". `ops` and `discover` read `unexercised`. The pill measures whether the kinds
  the room lists have fired, not whether the room exists. On a planned room that reads as a
  real room (ADR-1313; face v2 FV2-K).

Screenshots are local-only (gitignored `.playwright-mcp/`): `sweep-board.png`,
`sweep-scheduler.png`, `sweep-ventures.png`, `sweep-strategy.png`, `sweep-trader.png`.

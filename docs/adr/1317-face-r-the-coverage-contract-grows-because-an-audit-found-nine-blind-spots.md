# ADR-1317 — face-R: the coverage contract grows, because a fresh audit found nine blind spots

- **Status:** accepted
- **Date:** 2026-08-23
- **Lane:** face (Cycle 15)
- **Supersedes:** nothing. **Amends:** the frozen coverage contract at
  `initiatives/face/contracts/expected-set.json` and the exclusion note in
  `initiatives/face/contracts/room-map.md` §"what the gate does not read".
- **Related:** ADR-1306 (planned rooms) · ADR-1311 (the Map) · ADR-1316 (L3 in-repo) ·
  ADR-0053 (company organs belong to no lane)

## The owner's requirement, in his words

> arc oru full product ah maranum — entha products, features, flow, pipelines nu arc la iruka
> entha concepts nu **ethume miss aga kodathu**.

Nothing that exists in arc may be missing from the face. That is not a nice-to-have in this
cycle; it is the one thing he kept for himself when he handed over every other decision.

## What we claimed, and what was actually true

`face-coverage.mjs` reads **eleven** inventories out of the frozen contract and reports:

```
face-coverage: 46 kinds, 16 lanes, 26 commands, 30 agents, 16 products, 7 rules,
6 processes, 164 homed contract rows -- all covered
```

That sentence is true and it is not the claim the owner asked for. It says *every row in the
contract has a room*. It cannot say *every thing in arc is in the contract* — and a gate that
can only see its own list will report "all covered" forever, no matter what grows outside it.

A fresh agent with no stake in the gate was asked the harder question — what exists in this
repository that appears in **no** inventory the gate reads — and measured nine answers.

## The nine, with the measurement that found each

| # | what is invisible | measured | the harm |
|---|---|---|---|
| 1 | **265 ADRs** — arc's entire decision record | `ls docs/adr/*.md` = 265; `grep -c adr arc-dash.mjs` = **0** | the `board` room ships a station named "ADR map" that renders nothing, and `strategy`'s lede promises "the ADRs behind them". The owner asks "why did we decide X" inside the face and has to leave for the terminal — the exact failure the face exists to end |
| 2 | **7 ship gates** in `arc.gates.yaml` | `grep -c '^  - name:'` = **7**, exactly the 7 contract keys | an 8th gate gets no room and no failure. The stated exclusion reason — "their on-disk spelling does not map 1:1" — is true of lints and **false of gates**: that file is a machine-readable registry |
| 3 | **2 scheduled jobs** in `hq.jobs.yaml` | 2 declared; contract has no `jobs` key at all | the only things in the company that run unattended. `scheduler` promises a "jobs table" station and shows a lints list |
| 4 | **1 venture** in `ventures.yaml` | 1 venture, 1 passport row in PORTFOLIO; `ventures` room `itemCount: 4`, **zero** ventures | money and kill decisions are the highest-consequence thing in arc |
| 5 | **a planned room declared in three places and generated in none** | `planned-rooms.json` declares 4 (ops · trader · discover · **chat-mcp**); `grep -c chat-mcp rooms.generated.json` = **0**, and it is absent from `expected-set.json` and `room-copy.json` too | the Map draws 33 stations and silently omits a declared dotted one. A map that hides a gap is precisely what the Map contract says a map cannot be |
| 6 | **CI** — 168 bats suites, 4 workflows | none manifest-owned, no inventory, no room, no route | arc's own law is "tests green means green on CI, read per JOB". The face cannot say whether the last run was green |
| 7 | **24 strategy plans** | `docs/strategy/plans/*.md` = 24; the `strategy` room holds `itemCount: 2` | the room the plan itself specified as "plans queue (21 PLANs + 2 BRIEFs)" |
| 8 | **107 phase specs** | `initiatives/*/phases/*.md` = 107; `apiLane()` returns the machine header, PROGRESS and PLAN — never `phases/` | the owner opens a lane mid-cycle to read what the current phase promised and finds only the tracker's summary of it |
| 9 | **capability surfaces** — 1 skill, 4 MCP servers, 1 pinned image | none is an inventory row | `/arc-capability` and `/arc-toolcheck` exist as commands; nothing shows what arc actually *has* |

Two findings were cleared rather than counted, and they matter as much: `.claude/**` is 100%
product-owned (327 tracked files, **0** unmapped, enforced by `product-lint`), so every script
reaches a room transitively; and `rooms.generated.json` does not drift from `expected-set.json`
(32 list ids identical, plus the `lane` template = 33).

## Decision

**1. The frozen contract grows by seven inventories**, and "frozen" is amended rather than
broken: `adrs`, `gates`, `jobs`, `ventures`, `plans`, `capabilities`, `planned-rooms`. Freezing
a contract is meant to stop it drifting silently, not to stop it being corrected in the open —
which is what this record is for.

**2. `face-coverage` reads the WORLD, not only the contract.** The gate's failure was
structural, not an oversight: it compared a list against itself. Every new inventory is derived
from the on-disk source of truth (`arc.gates.yaml`, `hq.jobs.yaml`, `ventures.yaml`,
`docs/adr/`, `docs/strategy/plans/`, `planned-rooms.json`), so a thing added to arc without a
room becomes a named failure without anyone remembering to update a list.

**3. The exclusion note is narrowed, not deleted.** `lints` keeps its exemption with the
reason restated (`legal-lints (4)` is deliberately one row for four scripts). `gates` loses it,
because the reason was measured false. **An exclusion must now name the file that makes it
true**, so the next one cannot be inherited by a row it was never written about.

**4. ADRs are homed by BAND, not one row per file.** 265 rows would drown the contract and
tell the owner nothing; the century bands already exist in `PORTFOLIO.md` and are how a person
actually navigates them. One row per band, each naming its lane.

**5. `chat-mcp` is generated as a planned room** — the declaration in `planned-rooms.json` and
ADR-1306 is the record, and a registry that disagrees with it is the thing that is wrong.

**6. CI gets the honest-state vocabulary, not a fake feed.** One room, whose state is
`not instrumented` until a real run feed exists. `MISSING` is not `0`, and "never wired" is not
"measured green" — the same law the rest of the face already lives under.

## What this costs, and what it does not

It does not touch the reserved-hue contract (ADR-1313), the room registry's shape, or the L2
route table's single mutating route. It is additive: seven inventories, one generated room, one
door route extended to carry `phases`, and a gate that now fails on a class it previously could
not represent.

## The consequence worth stating plainly

`face-coverage` could report "all covered" while nine whole surfaces of arc were invisible.
Every gate in this repo that validates a list against itself has that shape, and this is the
second time this cycle a green check turned out to mean "broke no rule I know about" rather
than "the thing is complete". **A completeness gate must derive its expected set from the
world, or it is measuring its own memory.**

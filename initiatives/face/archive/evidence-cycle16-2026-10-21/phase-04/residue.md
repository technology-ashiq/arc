# RESIDUE — face v2 Phase 04

Phase 04 (REQ-06, ADR-1324). Every panel still NOT SERVED after Phase 04, with the route it would read and the
sentence it draws in the room. It is derived, never typed: `tests/face/module-frame.mjs` folds every shipped module
with nothing loaded and requires the rows below to EQUAL the `notServed()` entries the folds return, both ways; the
browser suite counts the same panels in the page per mood and holds that count, room by room, against this list.
Phase 03's five lists were Phase 04's input and stay frozen as it found them; module-frame requires every panel they
named to be here or in `served.md`, none dropped.

| module | panel | route it needs | what it would show, and why it is not served |
|---|---|---|---|
| `board` | The base rate | `/api/ventures` | How many ventures the kill criteria were planned to expect to live, written before the first launch -- so a death is a data point, not a surprise. The criteria file does not state it: the figure is prose in the master execution plan, which no parser reads -- filed to the ledger lane. |
| `memory` | Recall cost | `/api/memory` | What one recall costs today, measured rather than estimated. The recall golden gate measures top-3 hits against a grep baseline, not cost, and no receipt records what a recall cost -- filed to the memory lane. |
| `model-policy` | Egress allowlist | `/api/model-policy` | The exact host and port each driver may reach. The router file carries no egress block; the allowlist is engine/egress-allowlist.txt, which only the egress proxy parses, in Python, so no parser exists for the door to import -- filed to the engine lane. |
| `agents` | Tiers and who is switched on | `/api/roster` | Each agent's tier -- cheap scan, balanced workhorse, high judgment, independent-family verifier -- and whether it is enabled. An agent's frontmatter carries its name, tools and model, but no tier and no enabled flag, and no importable parser reads it -- filed to the engine lane. |
| `design-studio` | The studio floor | `/api/design` | Each submitted surface with its three explore variants and their theses, the read-only critique's findings by class, and the blind jury's ranking against a reference item. The design lane counts these in bash scripts and its lint cannot be imported, so no parser exists for the door to use -- filed to the design lane. |
| `executor` | Certification | `/api/roster` | The certification each hire passes before it is dispatched anything, fixture by fixture, and which fixture a failed one missed. The engine lane writes it as Markdown evidence, and no parser reads that into a table yet -- filed to the engine lane. |
| `legal` | Hash chain | `/api/legal` | The legal lane's verification chain: how many receipts it covers and whether it is intact, from the lane's own verify run -- append-only, a correction supersedes, a closed day never changes. That run needs a fresh render and the published directory in each venture's own repo, so the door cannot compute it -- filed to the legal lane. |
| `money` | The milestone line | `/api/strategy` | The honest ranges the company has written down for when money arrives, read from its strategy documents rather than typed into this screen. They are prose in the master execution plan, and no parser reads them -- filed to the plan lane. |
| `money` | Where money comes from | `/api/ventures` | Each venture's revenue model and price, and what the factory itself may earn, from each venture's own record -- never a sentence typed into this room. No venture record carries a revenue model or a price: ventures.yaml holds kill criteria only -- filed to the ledger lane. |
| `ventures` | Passports | `/api/ventures` | Each venture's passport -- live, candidate or attic, its stage and its own repo -- with a row that leaves only by your stamp and never by deletion. ventures.yaml holds kill criteria only; the passports are a PORTFOLIO.md table that only the board lint's awk reads -- filed to the ledger lane. |
| `ventures` | The base rate | `/api/ventures` | How many ventures the kill criteria were planned to expect to live, written before the first launch -- so a death is a data point, not a surprise. The criteria file does not state it: the figure is prose in the master execution plan, which no parser reads -- filed to the ledger lane. |
| `learn` | Juror calibration | `/api/learn` | Each council juror's hit rate, Brier-scored against how the verdict turned out, and the weight that earns it -- no figure at all below the scoring floor. No receipt or file records a verdict per juror: the council's calibration is per confidence bucket, drawn in the council chamber -- filed to the evolve lane. |
| `learn` | The sleeping queue | `/api/learn` | Every capability asleep until something pulls it, and the alarm that would wake it -- earn before build (A8), an alarm rather than a deadline. The queue is prose in docs/strategy/plans/README.md, and no parser reads it -- filed to the plan lane. |
| `org` | Receipts per lane today | `/api/lanes` | Which lanes fired a receipt today, counted per lane -- so a lane whose header says IDLE and that emitted today reads awake, and one whose header says LIVE and fired nothing reads quiet. A receipt carries no lane: the spine's envelope has no lane field and only three develop kinds name one in their payload, so no count per lane can be derived -- filed to the spine lane. |
| `strategy` | Too expensive to revisit | `/api/adrs` | The one-way and expensive decisions, the ones a new plan has to live with rather than reopen, each with the ADR that made it. Reversibility is parsed only by kickoff-lint, which runs at import and cannot be imported, so no parser exists for the door to use -- filed to the plan lane. |

## Why each route is residue, and the lane it is filed to

REQ-06 allows a residue only where the parser the route would import does not exist, each named with the lane it is
filed to and each approved by the owner. Two kinds of gap sit below: a parser that exists but cannot be imported (the
lint runs its command line at import), and data that no file or receipt records at all -- no parser could serve that
without inventing it.

- **/api/ventures** (4 panels: two base rates, passports, where money comes from) -- ledger lane. `ventures.yaml` holds
  kill criteria only. The base rate is prose in `docs/strategy/arc-master-execution-plan.md`; the passports are a
  `PORTFOLIO.md` table only `board-lint.sh`'s awk reads; no venture record carries a revenue model or a price.
- **/api/roster** (2 panels: agent tiers, certification) -- engine lane. Agent frontmatter carries no tier and no
  enabled flag, and its only parser is private to `council-lint.mjs`; certification results are Markdown evidence.
- **/api/learn** (2 panels: juror calibration, the sleeping queue) -- evolve lane and plan lane. No receipt records a
  verdict per juror; the sleeping queue is prose in `docs/strategy/plans/README.md` that no parser reads.
- **/api/memory** (recall cost) -- memory lane. The recall golden gate measures hits against a grep baseline, not cost.
- **/api/model-policy** (egress allowlist) -- engine lane. `engine/egress-allowlist.txt` is parsed only by the egress
  proxy, in Python.
- **/api/design** (the studio floor) -- design lane. Variants, theses and findings are counted in bash, and
  `design-lint.mjs` exits at import.
- **/api/legal** (hash chain) -- legal lane. The chain is computed only by the lane's verify run, against a fresh render
  and the published directory in each venture's own repo.
- **/api/adrs** (too expensive to revisit) -- plan lane. Reversibility is parsed only inside `kickoff-lint.mjs`, which
  exits at import; no ADR header says "expensive".
- **/api/lanes** (receipts per lane today) -- spine lane. The spine envelope carries no lane, and only three develop
  kinds name one in their payload.
- **/api/strategy** (the milestone line) -- plan lane. The honest ranges are prose in the master execution plan.

**Approved by the owner as a whole, 2026-09-18** -- option A of the two put to him after the build measured the residue:
"un recommand A pannu machi". REQ-06's bound of three routes is amended to "named and filed" by ADR-1338.

<!-- facts: appetite=c68c3357 blocked-on=a68c9074 burn=e02f5370 cycle=32c7a505 depends-on=a68c9074 hasPlan=b5bea41b phase=0b3aa5a1 status=4c1abf59 title=b02da083 -->

# ledger — the money brain

## In plain words

Think of it as a shopkeeper's notebook: one page a day, ink only, never erased. <!-- plain -->

Ledger is the part of arc that turns raw spine receipts into a venture's P&L: real revenue split
gross, fees, tax and net, MRR with full churn transitions, AI and fixed costs labelled by source, and
kill-distance meters against machine-readable kill criteria — rendered as `arc pnl` and inside the
daily brief, byte-reproducible from replay, with a month-close ritual that freezes each month behind
a reconciliation gate so a closed number can never silently change, and with the rule that not one
byte of any customer's personal data ever lands on the spine. <!-- src: initiatives/ledger/PLAN.md -->

### What it is building

Ledger builds `arc pnl`, one CLI under `hq` with no new slash command, plus the reconciliation and
cost machinery behind it — a reader-only derivation layer that emits exactly one new spine kind,
`month.closed`, and only from behind a green reconciliation gate. <!-- src: initiatives/ledger/PLAN.md; ADR-1000; ADR-1009 -->

It mattered because, at the moment this lane was born, the money side of the live spine held zero
`revenue.received`, zero `revenue.simulated`, zero `cost.incurred` and zero `run.completed` events,
and no `ventures.yaml` or pnl code existed anywhere — arc had a spine full of receipts and no way to
read a venture's true financial state out of it. <!-- src: initiatives/ledger/PLAN.md -->

## arc words → normal words

| arc calls it | It is really | Meaning |
|---|---|---|
| `arc pnl` | the report | Renders per-venture P&L from the spine; ships as an `hq` CLI, with no new slash command in v1. <!-- src: initiatives/ledger/PLAN.md; ADR-1009 --> |
| `ventures.yaml` | the kill-criteria sheet | The one config file this lane adds, at the repo root, holding each venture's kill criteria; any edit needs an accompanying `decision.recorded` receipt. <!-- src: initiatives/ledger/PLAN.md; ADR-1008 --> |
| MRR | the recurring-revenue number | The ex-tax recurring amount, tracked through five transitions: new, expansion, contraction, churn, reactivation. <!-- src: initiatives/ledger/PLAN.md --> |
| kill-distance | how close to the cliff | Distance to each venture's own kill criterion, printed by `arc pnl`, with a warning line once a criterion sits at 80% or closer. <!-- src: initiatives/ledger/PLAN.md --> |
| reconciliation gate | the closing ritual | A month closes only once every rail's real settlement total is checked both ways against the spine; a rail with no input blocks the close exactly like a mismatched one. <!-- src: initiatives/ledger/PLAN.md --> |
| `month.closed` | the seal | The one new spine kind this lane may emit, and only from behind a green reconciliation gate. <!-- src: initiatives/ledger/PLAN.md; ADR-1004 --> |
| cost trichotomy | three honest cost lines | Measured run costs, declared fixed and subscription costs, and apportioned costs are labelled separately and never summed into one number. <!-- src: initiatives/ledger/PLAN.md; ADR-1006 --> |
| twin-determinism | delete it and get the same answer back | Deleting the derived state and replaying the spine must reproduce an identical P&L, checked in CI from Phase 0 onward. <!-- src: initiatives/ledger/PLAN.md; ADR-1014 --> |
| closed schema | no field you didn't name | The schema is CLOSED: a `revenue.*` payload's keys are the whole vocabulary, and any key not listed is a strict-mode rejection, whatever it contains — which is how the validator refuses PII-shaped fields without trying to recognise them. <!-- src: initiatives/ledger/PLAN.md#CLOSED --> |

## How the work was planned

Appetite: eight days part-time, hard cap — the owner's one and a half weeks — and the four phases
sum to exactly that cap, with no schedule slack; the slack instead lives in a pre-authorized cut
order. <!-- src: initiatives/ledger/PLAN.md -->

Kill criteria: at fifty percent burn (four days) without REQ-01 and REQ-02 green on fixtures, the
cycle would cut to the P&L-math library alone and bank kill-distance and month-close for a later
slot; the pre-authorized cut order was REQ-07 first, REQ-08 second, then REQ-03's 80%-warning line
third, with crossing detection staying regardless; any phase running at twice its estimate stops,
banks, and runs `/arc-retro`. <!-- src: initiatives/ledger/PLAN.md -->

| REQ | User outcome | Phase | Status |
|---|---|---|---|
| REQ-01 | P&L is true and reproducible | 0 | validated <!-- src: initiatives/ledger/PLAN.md --> |
| REQ-02 | MRR math survives its edge cases | 0 | validated <!-- src: initiatives/ledger/PLAN.md --> |
| REQ-03 | Kill-distance is visible and tamper-evident | 1 | validated <!-- src: initiatives/ledger/PLAN.md --> |
| REQ-04 | Currency honesty | 0 | validated <!-- src: initiatives/ledger/PLAN.md --> |
| REQ-05 | A month closes only behind a green reconciliation | 2 | validated <!-- src: initiatives/ledger/PLAN.md --> |
| REQ-06 | Costs are honest three ways | 2 | validated <!-- src: initiatives/ledger/PLAN.md --> |
| REQ-07 | Every number explains itself | 2 | dropped <!-- src: initiatives/ledger/PLAN.md --> |
| REQ-08 | Demo without lies | 3 | validated <!-- src: initiatives/ledger/PLAN.md --> |

Four phases, listed risk-ordered: Phase 0, money math core — payload contract, PII validator,
normalization, pnl math, `arc pnl` v0, 2 export parsers, twin-determinism; Phase 1, kill-distance —
`ventures.yaml` schema and parser, distance/warning/crossing render, brief needs-you integration;
Phase 2, close and costs — reconciliation gate, `month.closed` emission, cost trichotomy and
Overhead, daily spend line; Phase 3, proof — replay the real live spine, `--simulated` demo view,
evidence bundle, retro. <!-- src: initiatives/ledger/PLAN.md#risk-ordered -->

## The phases, one by one

Phase 0 — money math core, 3-day appetite. It set out to build the payload contract, the PII
validator, normalization, the P&L math library, `arc pnl` v0, two export parsers and
twin-determinism. It landed exactly on its 3-day line and closed 2026-08-13 with REQ-01, REQ-02 and
REQ-04 green: `validate-ledger.mjs` wired into the emitter's own validation path, `money.mjs`,
`normalize.mjs`, `pnl.mjs`, 16 fixtures and 4 bats suites totalling 70 tests. Its own two-surface
adversarial pass found 30 findings that overlapped on nothing between the two agents, the worst being
that the PII control did not work — a mobile number, a name plus date of birth, a PAN and an Aadhaar
number all reached the spine through the real ingest path. <!-- src: initiatives/ledger/PROGRESS.md#INSIDE -->

Phase 1 — kill-distance, 2-day appetite. It set out to build the `ventures.yaml` schema and parser,
the distance/warning/crossing render, and the brief's needs-you integration. It closed 2026-08-13
with REQ-03 green: a strict dependency-free YAML-subset parser, a receipt gate tying edits to an
`approval.requested`-shaped record after ADR-1008's own `decision.recorded` shape proved
unimplementable against the closed payload, and 51 tests across two suites. The adversarial pass found three
separate ways the kill switch could disarm itself at exit 0, the worst being that `ARC_SPINE_ROOT`
deleted both the panel and the refusal in the very worktree where that is the only way to run the
command. <!-- src: initiatives/ledger/PROGRESS.md -->

Phase 2 — close and costs, 2-day appetite. It set out to build the reconciliation gate, `month.closed`
emission, the cost trichotomy and Overhead section, and the daily spend line. Code went green on run
31685435167 (19 of 19), and its own adversarial pass afterward found four separate ways a month could
close green with no business closing — an export whose period was never actually read, needs-you
flags computed and then discarded, a guard counting rows instead of money, and `--simulated` silently
dropped beside `--close`. All four were fixed, with re-verification on CI still pending. <!-- src: initiatives/ledger/PROGRESS.md -->

Phase 3 — the live-spine proof, 1-day appetite. It set out to replay the real spine, add a
`--simulated` demo view, and close the cycle with an evidence bundle and retro. It closed 2026-08-13
with `arc pnl` rendering the live spine honest-empty — zero `revenue.received`, zero
`revenue.simulated`, zero `cost.incurred`, zero `month.closed` — a zero corroborated by comparing the
reader's count against a raw file read, with a liveness control checked first so a broken reader
could not agree with a real zero by accident. <!-- src: initiatives/ledger/PROGRESS.md#corroborated -->

## What it decided

Ledger holds ADR century 1000–1099; ADR-1000 through 1015 were written at kickoff, and 1016 through
1018 were written during the build, each one because the implementation contradicted a decision made
before it. <!-- src: initiatives/ledger/PROGRESS.md#board-lint -->

| # | Decision |
|---|---|
| 1000 | LED-A: ledger is a reader-only derivation layer that emits exactly one kind. <!-- src: initiatives/ledger/PLAN.md; ADR-1000 --> |
| 1001 | LED-B: money data lives only on the spine; the only config file is `ventures.yaml`. <!-- src: initiatives/ledger/PLAN.md; ADR-1001 --> |
| 1002 | LED-C: revenue payloads are PII-free by construction, and the validator ships first. <!-- src: initiatives/ledger/PLAN.md; ADR-1002 --> |
| 1003 | LED-D: FX conversion facts are recorded at ingest, never looked up at render. <!-- src: initiatives/ledger/PLAN.md; ADR-1003 --> |
| 1004 | LED-E: the spine vocabulary grows from 44 to 45 kinds for `month.closed`, on IST boundaries, never restated. <!-- src: initiatives/ledger/PLAN.md; ADR-1004 --> |
| 1005 | LED-F: reconciliation is a blocking close gate, both directions, per rail. <!-- src: initiatives/ledger/PLAN.md; ADR-1005 --> |
| 1006 | LED-G: costs carry a source label, and the three sources never sum into one number. <!-- src: initiatives/ledger/PLAN.md; ADR-1006 --> |
| 1007 | LED-H: MRR definitions are pinned in fixtures, with cash-in reported beside them. <!-- src: initiatives/ledger/PLAN.md; ADR-1007 --> |
| 1008 | LED-I: `ventures.yaml` is a root company organ whose edits need a receipt. <!-- src: initiatives/ledger/PLAN.md; ADR-1008 --> |
| 1009 | LED-J: ledger ships as `arc pnl` under `hq`, with no slash command in v1. <!-- src: initiatives/ledger/PLAN.md; ADR-1009 --> |
| 1010 | LED-K: natural-key duplicate detection lives in the derived layer. <!-- src: initiatives/ledger/PLAN.md; ADR-1010 --> |
| 1011 | LED-L: ledger adds no policy subject, and must never self-authorize money. <!-- src: initiatives/ledger/PLAN.md; ADR-1011 --> |
| 1012 | LED-M: money is an integer count of minor units; rates are decimal strings. <!-- src: initiatives/ledger/PLAN.md; ADR-1012 --> |
| 1013 | LED-N: the one foreign currency in v1 is USD. <!-- src: initiatives/ledger/PLAN.md; ADR-1013 --> |
| 1014 | LED-O: `arc pnl` keeps no cache, and its determinism proof must name which engine actually ran. <!-- src: initiatives/ledger/PLAN.md; ADR-1014 --> |
| 1015 | LED-P: reconciliation takes both input paths over one summable parser result. <!-- src: initiatives/ledger/PLAN.md; ADR-1015 --> |
| 1016 | LED-Q: a refund is a linked positive fact carrying `refund_of`, never a superseding negative. <!-- src: initiatives/ledger/PLAN.md; ADR-1016 --> |
| 1017 | The criteria receipt rides an `approval.requested` profile rather than a new decision shape, because ADR-1008's own wording asked for something the decision payload's closed schema could not carry, and this costs zero new event kinds. <!-- src: initiatives/ledger/PROGRESS.md; ADR-1017 --> |
| 1018 | A criterion ledger cannot observe is rendered ABSENT with a mandatory reason, never treated as safe or as already crossed. <!-- src: initiatives/ledger/PROGRESS.md; ADR-1018 --> |

## Where it stands now

Status: IDLE. The cycle (arc-ledger) opened 2026-08-12 and closed 2026-08-13, with burn at 7 of 8
days (88%). <!-- src: initiatives/ledger/PROGRESS.md -->

All four phases closed the same day, 7 of 8 REQs validated and REQ-07 (`--explain`) taken as the
declared first pre-authorized cut, against the cap rather than discovered after an overrun. <!-- src: initiatives/ledger/PROGRESS.md -->

Closure language, stated deliberately: mechanism proven, live value pending. Every gate has been
exercised against fixtures and against the real spine, and not one rupee has moved through it,
because none exists yet — the live-value milestone is the first real month closed behind a green
reconciliation, expected around September or October 2026 when LexOS earns, and it is explicitly not
a gate on this closure. <!-- src: initiatives/ledger/PROGRESS.md -->

Owed next, and not a gate on the closure: real redacted provider export samples before the first live
ingest, since no real export was reachable offline and both parsers are pinned against a documented
synthetic corpus instead. <!-- src: initiatives/ledger/PROGRESS.md -->

## The bigger loop

### What went wrong and what was learned

- A fix touched the `--criteria-digest` EISDIR safeguard but not its mirrored counterpart,
  `--reconcile-file`, seventy-five lines beyond, within one-file-over reach. `Phase-00`'s two suites
  remained unpatched when `arc-pnl`'s resolution shifted: `24-tests-red` followed. `arc-brief` never
  got the absent-rows-rule `arc-pnl` states. <!-- src: docs/retro-log.md#EISDIR -->
- CI stopped starting a `run` for five-in-a-row pushes, and a guessed account — that the PR was a
  draft — got entered into a standing playbook before the culprit, `mergeable: CONFLICTING`, was
  verified. The `pull_request` cue targets a clashing ref, and GitHub is unable to assemble it while
  the PR clashes with its target-branch, so it creates no `run` at all and displays none-at-all. <!-- src: docs/retro-log.md#CONFLICTING -->
- One rule-line proved the token `needs-you` absent-entirely — true-only while arc-ledger was this
  group's sole-producer. Afterward, scheduler's cadence joined and an overdue job opened that one
  group, so the rule-line went-red for a fact about a workstream while what it guarded
  remained-intact. <!-- src: docs/retro-log.md#needs-you -->
- The wording of a .md region was assembled within a one-off runner, and every backticked span in
  that wording ran quietly as a substitution, put back blank — the .md was saved, the routine
  signaled all-clear, and 4 phrases had vanished. <!-- src: docs/retro-log.md#vanished -->

### How it connects to the rest of arc

- Ledger reads the spine through the same one reader every other product uses, and writes to it
  through the same emitter — the only new event kind it ever produces is `month.closed`, and only
  from behind its own reconciliation gate. <!-- src: initiatives/ledger/PLAN.md; ADR-1000 -->
- It touches three files that belong to no lane — root `ventures.yaml`, the `KINDS` list in
  `.claude/scripts/hq/lib/validate.mjs`, and the `GROUPS` table in `arc-brief.mjs` — and is bound by
  the same rule every lane follows there: check what another live lane touched first, and take the
  stronger version at any merge collision. <!-- src: initiatives/ledger/PLAN.md -->
- `ventures.yaml`'s venture set is meant to stay identical to `PORTFOLIO.md`'s Venture passports
  table; a mismatch between the two is one of this lane's own assumption-ledger triggers. <!-- src: initiatives/ledger/PLAN.md -->
- The lane explicitly built on the prior `arc-policy` retro's lesson — that an engine can ship
  fixture-proven and never be exercised — by writing its own Phase 3 acceptance around an
  honest-empty render of the real spine, rather than mitigating the risk away. <!-- src: initiatives/ledger/PLAN.md -->

## Glossary

- **venture** — A revenue-generating standalone app, each in its-own repository, operating its own
  arc-install (root-mode); its passport row sits in `PORTFOLIO.md`. <!-- src: PORTFOLIO.md#passports -->
- Each venture's kill criteria live in `ventures.yaml`, the one config file this lane
  adds. <!-- src: initiatives/ledger/PLAN.md; ADR-1008 -->
- **MRR** — The recurring, ex-tax base of a subscription, tracked through five transitions: new,
  expansion, contraction, churn, reactivation. <!-- src: initiatives/ledger/PLAN.md -->
- **kill-distance** — How close a venture sits to one of its own kill criteria, rendered by
  `arc pnl`. <!-- src: initiatives/ledger/PLAN.md -->
- **reconciliation gate** — The check that blocks a month's close until every rail's settlement total
  agrees with the spine in both directions. <!-- src: initiatives/ledger/PLAN.md; ADR-1005 -->
- **`month.closed`** — The one spine kind ledger may emit, only once per month, only behind a green
  reconciliation gate. <!-- src: initiatives/ledger/PLAN.md; ADR-1004 -->
- **cost trichotomy** — Measured, declared and apportioned costs, kept on separate labelled lines and
  never summed into one figure. <!-- src: initiatives/ledger/PLAN.md; ADR-1006 -->
- **twin-determinism** — Deleting the derived index and replaying the spine must produce a
  byte-identical P&L. <!-- src: initiatives/ledger/PLAN.md; ADR-1014 -->
- **natural-key duplicate** — A repeated payment caught by its own identity in the derived layer,
  never by trusting the ingest call not to repeat it. <!-- src: initiatives/ledger/PLAN.md; ADR-1010 -->

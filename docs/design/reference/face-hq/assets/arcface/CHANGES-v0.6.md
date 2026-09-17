# v0.6 — the whole company (2026-08-25)

**Ask:** "innum konja lanes miss aaguthu — develop, discover, evolve, executor,
ledger, memory, model policy, ops, scheduler, policy, trader, company
hierarchy/department" → checked against arc's own registry
(`initiatives/face/contracts/expected-set.json`, 32 rooms + lane template,
5 rings; `room-copy.json`; `planned-rooms.json`) → 19 rooms were missing, 1
partial. **All 19 built, policy upgraded, executor kept.**

## Rooms (20 → 36, arc's five rings, arc's read order)

| ring | new | notes |
| --- | --- | --- |
| command | inbox · map · board · ask arc | board absorbs the old portfolio room; ask arc = the brain with NO hands (`answer(text, {hands:false})` refuses approve/reject/promote/speed) |
| kernel | model policy · **policy** · scheduler · memory · evolve | policy absorbs the old autonomy room (ladder panel kept) + the 7-subject × 8-capability table with ceiling / cap / effective = min |
| factory | develop · review · ship · toolbelt | |
| money | ventures · ops · trader · discover | ops/trader/discover are **planned** (lanes not born): drawn dotted, every write says REHEARSAL, no manifest invented |
| company | strategy · org · concepts | org = "company hierarchy": 16 lanes awake / idle / blocked with waiting-on |

Old ids resolve through aliases (`autonomy → policy`, `portfolio → board`,
`today → overview`, …) so no link, voice action or ⌘K word 404s.

## Spine

- `kinds.js`: +44 kinds for the new rooms (policy.proposed/changed, tier.*, job.*,
  heartbeat.ok, lesson.logged, rule.promoted, recall.ran, experiment.*, slice.*,
  phase.refused, profile.switched, venture.*, plan.adopted, adr.recorded,
  lane.status/born, concept.defined, incident.acked/resolved, support.dropped,
  ops.report, question.opened, backtest.completed, strategy.registered,
  trade.verdict, idea.scored/shortlisted, ask.answered, tool.pinned).
- `registries.js` (new): the pure folds behind every new room — repo-fact seeds
  + your persisted events → rows. Approval subjects the inbox folds back:
  `policy.change`, `tier.change`, `memory.promote`, `evolve.conclude`,
  `venture.kill`, `discover.kickoff`, `ops.reply`.
- `data/arcFacts.js` (GENERATED, 133 KB): 16 lanes with phases/appetite/burn,
  policy subjects, router tiers/classes, jobs, retro-log + trial-ledger rows,
  DoD, 26 commands / 30 agents / 7 hooks / 7 rules / 29 lints, 107 concepts,
  gates + profiles, ventures.yaml, 25 plans + 265 ADRs, planned rooms, room
  copy, the 46-kind map, inbox law, ask-arc grants — every value with a `src`
  pointer into the arc repo. Regenerate with `scripts/trim-facts.mjs`.

## Shell

- `roomRegistry.js` (new): one list owns ids, names, rings, icons, sentences,
  aliases, the 16-lane → room map. HQ rail, ⌘K, the map, the brain's
  `open_room` action list and the org roster all read it.
- `#hq/<room>` deep links; the rail keeps the hash current.
- ⌘K: room names/aliases, `ask: …` → ask arc, and any of the 107 concept terms
  jump to the room that homes them (checked last, so a model/hire/lead is
  never mistaken for a glossary word).
- Brief gains a `company` line (lanes awake/blocked, jobs, experiments, rules,
  open incidents).

## Fixes

- `Btn` inside a `<form>` double-submitted on click (onClick + implicit submit)
  — now `type="button"` when it has an onClick, `submit` otherwise. Affected
  every existing write-path form.
- Non-money meters were green (contract: green = REAL money only) → blue.

## Verification (headless Chrome, raw CDP — `scripts/smoke.mjs`)

- 36/36 rooms render with arc's sentence, **0 exceptions / console errors**.
- 20/20 write-path flows pass end to end (register job + grammar refusal +
  idem@slot; lesson ×2 → rule proposal; experiment open → measure → conclude;
  slice → proof → phase refused then closed; policy cap proposal → inbox;
  tier proposal; venture register + kill review; lane status + birth; plan
  adopt + ADR 1317; concept defined + searchable; tool pinned; review → qa →
  ship; incident raise/ack/resolve + support drop/classify/stamp; trader
  question/register/backtest with the lock display-only and the word never
  rendered; idea hunt/dedupe/score; ask arc answers offline with cites; inbox
  refuses an empty reason then stamps).
- 47 owner receipts survive a reload.

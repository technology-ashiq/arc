# Phase 05 residue -- the work verbs that did not ship

**Residue: none.** All 31 work verbs in `cli-probe.md` (its 46 verbs minus the 15 SESSION rows, which are Phase 06's)
ship as ops in `.claude/scripts/hq/face-ops.mjs`, one op per verb, each driven through the door by its ring's suite
with its no-second-path fixture. Mapped by hand on 2026-09-23 from the probe's tables to the registry's 31 ids, after
all eight Phase 05 PRs merged (#252 · #253 · #254 · #255 · #257 · #258 · #259 · #261; `main` at `7c70122c`).

REQ-07 asks for each verb to ship OR be a residue row the owner approves as a whole. With no rows, that approval at
`/arc-phase-done 05` is an approval of an empty list -- stated here so it is read, not assumed.

## The mapping

| ring | probe verb (room) | bucket | op id |
|---|---|---|---|
| kernel | driver switch (engine) | BIG-GAP | `engine-room.driver-switch` |
| kernel | tier proposal (model-policy) | SMALL-GAP | `model-policy.tier-proposal` |
| kernel | cap proposal (policy) | BIG-GAP | `policy.cap-proposal` |
| kernel | register job (scheduler) | SMALL-GAP | `scheduler.register-job` |
| kernel | open experiment (evolve) | SMALL-GAP | `evolve.open-experiment` |
| kernel | measure (evolve) | BIG-GAP | `evolve.measure` |
| kernel | conclude (evolve) | BIG-GAP | `evolve.conclude` |
| kernel | paste model -> run (bench) | READY | `bench.run-model` |
| kernel | propose (bench) | SMALL-GAP | `bench.propose` |
| kernel | pin source (absorb) | SMALL-GAP | `absorb.pin-source` |
| kernel | trial (absorb) | SMALL-GAP | `absorb.trial` |
| factory | send-to-council (council) | BIG-GAP | `council-chamber.send-to-council` |
| factory | slice (develop) | SMALL-GAP | `develop.slice` |
| factory | checkpoint (develop) | SMALL-GAP | `develop.checkpoint` |
| factory | open brief (design-studio) | SMALL-GAP | `design-studio.open-brief` |
| factory | record pick (design-studio) | BIG-GAP | `design-studio.record-pick` |
| factory | pin tool (toolbelt) | BIG-GAP | `toolbelt.pin-tool` |
| factory | switch profile (factory) | BIG-GAP | `factory.switch-profile` |
| factory | terminate (executor) | BIG-GAP | `executor.terminate` |
| factory | add agent (agents) | BIG-GAP | `agents.add-agent` |
| money · company · command | capture idea (overview) | SMALL-GAP | `today.capture-idea` |
| money · company · command | ingest (money) | SMALL-GAP | `money.ingest` |
| money · company · command | criteria (money) | SMALL-GAP | `money.criteria` |
| money · company · command | close month (money) | READY | `money.close-month` |
| money · company · command | review pack -> publish (growth) | SMALL-GAP | `growth.publish` |
| money · company · command | daily send (leads) | SMALL-GAP | `leads.daily-send` |
| money · company · command | full-read gate stamp (legal) | SMALL-GAP | `legal.full-read` |
| money · company · command | register (ventures) | BIG-GAP | `ventures.register` |
| money · company · command | kill review (ventures) | BIG-GAP | `ventures.kill-review` |
| money · company · command | set lane status (org) | BIG-GAP | `org.lane-status` |
| money · company · command | define concept (concepts) | BIG-GAP | `concepts.define-term` |

11 kernel + 9 factory + 11 money · company · command = 31, and the registry lists 31 ids.

## The fixture

`tests/face/work-door.mjs` reads this table and the probe's ring tables: the op ids here equal the registry's both
ways, the row count equals the probe's non-SESSION count, and two mutant controls (an op dropped, an op invented) are
caught. A verb that vanishes from the registry, or one added without a probe row, turns that suite red.

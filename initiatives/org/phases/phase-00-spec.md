# Phase 00 — The catalog + its gate

**Goal (one line):** every job arc's company needs exists as a valid role card, and a FAIL-FROM-BIRTH
gate proves the cards and the tree agree in both directions — red on every mutant, green on the tree.
**Appetite:** 2.5 days
**Depends on:** none
**REQs closed here:** REQ-01 (absorbs REQ-02), REQ-03, REQ-04, REQ-13. REQ-11's mutant arms are
built here (the gate owns them) but REQ-11 closes in Phase 02 with the interview.

## Build order (the steel thread — each step ends runnable)

1. **Ruling on the spine (first act, ADR-1600).** From the MAIN clone (a worktree has its own empty
   spine), after a fetch: emit an `approval.requested` (subject `org.role`) carrying the 2026-09-29
   owner ruling verbatim, then the owner records it through `arc-inbox approve` — `decision.recorded`
   is closed to `decides`/`verdict`/`reason` and must decide an existing request. Both ULIDs are read
   back on the main clone and cited in the Phase 00 PR body.
2. **`products/org` is born (ADR-1613).** `products/org/manifest.json` (`requires: [core, hq]`,
   `scripts`, `files: [org/**]`, `face`); `initiatives/face/contracts/expected-set.json` gains
   `products.org`; `tests/fixtures/sync-golden/tree-manifest.txt` gains its lines; wiki regenerated.
3. **Card schema** fixed as `org/schema/role.schema.md` + validator in `.claude/scripts/org/lib/card.mjs`:
   `id · title · dept · mission · stages · seat (agent|skill|script|process|human|partial|vacant) ·
   origin (own|hired) · hire (null | {runtime, source, vetted_by}) · binds {agents, skills, scripts,
   process, tier} · reports_to · escalate_to · e2 · produces {kind, schema, receipt} · consumes ·
   fixtures (list | pending) · kpi (list | pending) · autonomy_ceiling · review_by · history`.
   `tier` must be one of the four ADR-0069 router tiers; any field value matching a model-string shape
   (`claude-*`, `gpt-*`, `*/*:*` provider slugs, …) FAILs (ADR-1614).
4. **`treeScripts(repo)` additive export** in `.claude/scripts/core/face-coverage.mjs` (ADR-1620).
   Before editing: `git log origin/main --oneline -5 -- .claude/scripts/core/face-coverage.mjs`; after:
   a paste-ready note to the face session. No existing export changes.
5. **71 cards** under `org/roles/<dept>/<role>.role.yaml`, 10 departments A–J per the design source's
   chart. Seated cards: bindings **extracted mechanically** by `.claude/scripts/org/org-catalog.mjs
   --draft` from agent frontmatter + product manifests; owner accepts mission + KPI lines. Vacant cards:
   generated stubs (`seat: vacant`, `kpi: pending`, `fixtures: pending`, mission line, `produces`
   declared). The social card per ADR-1622 (vacant, `history:` names the expired hire). E2 cards per
   ADR-1609 seated `human:ashiq`. Heads (`solution-architect`, `design-director`, `head-of-growth`)
   carry `tier: high-judgment` (ADR-1615).
6. **`org-coverage.mjs`** (`.claude/scripts/org/`), importing every walker from `face-coverage.mjs`
   (ADR-1610): every agent ∈ ≥ 1 role · every binding resolves (agents, skills, scripts, processes,
   tiers) · every venture in `ventures.yaml` ↔ a team manifest, OR a printed, counted
   `unstaffed:SLUG` exception — legal only while no card is seated for that venture, never for a
   venture with a seated card (covers lexos now and Nilluvai between registration and Phase 02; no
   `lexos.team.yaml` stub, since the team schema is Phase 02's and LexOS is out of scope, ADR-1619) · E2 ⇒ `human:ashiq`, `e2` strings verbatim against `hq.policy.yaml` read at gate time ·
   hired ⇒ `hire.runtime` ∈ `arc-run` drivers + tier + fixture verdict · consumed kind has a producer ·
   head seat ⇒ ≥ 2 staffed workers · no model strings. Refuses unknown flags (exit 2); realpath main
   guard. Exit 0 covered / 1 findings / 2 usage.
7. **`--mutant-selftest`** in a scratch copy, arms: M0 clean tree covered · M1 orphan agent · M2
   `ghost-agent` binding · M3 E2 seated by agent · M4 non-verbatim `e2: [publish]` · M5 `origin: hired`
   with no `hire.runtime` · M6 staffed with no fixture verdict · M7 consumes `ghost-brief` · M8 head over
   < 2 staffed workers · M9 a model string in `tier` · M10 the imported `agents` / `treeScripts`
   walkers stubbed to `[]` inside the collector → exit 1 `WALKER EMPTY`, never `covered: 0` · M11 a
   venture with a seated card and no manifest · M12 a plant placed AFTER the newest code path of
   `org-coverage.mjs`, not only at a fixed early spot. Each FAIL arm must name its plant; the selftest
   asserts the gate RAN before asserting what it printed. Floors: the walker's agent count is
   cross-checked against an independent `readdirSync('.claude/agents')` count. The arm count is
   DERIVED from the arm table and printed beside the expected count — no literal `10`, `30` or `71` is
   pinned in bats or demo text; bats test names are ASCII and the suite asserts its own test count.
8. **Generated org chart** `org/CHART.md` + `org/chart.json` from `org-catalog.mjs --chart`: counts
   staffed / partial / vacant / human and own / hired, derived; a `VACANT` banner per vacant role;
   `--check` fails on a hand edit. Blueprint `docs/strategy/arc-company-org-blueprint.md` §4 → a
   pointer to `org/CHART.md` (rest of the blueprint kept as history).
9. **Genesis (REQ-09, carried in REQ-11).** `node .claude/scripts/org/org-catalog.mjs --digest` →
   `approval.requested` (subject `org.role`, digest) → owner approves in `arc-inbox` → the catalog's
   ~20 already-seated agent roles are legitimised once. No genesis exemption (ADR-1017 rule).

## Inputs, grammar and commands (the executor's reference — kickoff simulation round 1)

**I-1 · The role list (input file).** The 71 roles are the chart in `docs/strategy/plans/PLAN-org.md`
§ "The org chart — 10 departments, 71 roles" (lines 430–458): read it, never retype it from memory.
Role `id` = kebab-case of the title (e.g. "SEO strategist" → `seo-strategist`). Department dirs:
`a-board` · `b-ceo-office` · `c-research` · `d-product` · `e-engineering` · `f-design` · `g-growth` ·
`h-sales` · `i-support` · `j-finance-legal-people`. Seat letter → `seat`: A→`agent`, S→`script` or
`skill`, P→`process`, H→`human`, V→`vacant`, "P+A"→`partial`. The chart's parentheses name the bound
agents / scripts / processes. E2 roles (seated `human:ashiq`): `pricing-strategist` ("changing prices"),
`performance-ads` ("moving money"), `account-executive` ("changing prices", "moving money"); `ceo` is
human; `constitution-keeper` and `tax-gst` are `human (owner choice)` (`seat: human`,
`owner_choice: true`, `e2: []`). An agent the chart does not place, or a role the chart lacks, is an A-02
event: add the role, list it in the bundle.

**I-2 · Card fields** (validated by `.claude/scripts/org/lib/card.mjs`; unknown keys FAIL):

| Field | Type / grammar | Req. |
|---|---|---|
| `id` | `^[a-z][a-z0-9-]{1,63}$`, equals file stem | yes |
| `title`, `mission` | one line, ≤ 200 chars; vacant stubs keep mission only | yes |
| `dept` | one of the ten dir names in I-1 | yes |
| `stages` | subset of `discover validate build launch grow sell support operate` (ADR-1606) | yes |
| `seat` | `agent skill script process human partial vacant` | yes |
| `owner_choice` | boolean, only with `seat: human` | no |
| `byline` | `ashiq` or `arc` — whose name published output carries (ADR-1609) | iff the role publishes |
| `origin` | `own` or `hired` | yes |
| `hire` | `null`, or `{runtime, source, vetted_by}` — `runtime` ∈ driver stems (I-6), `source` `^(openrouter|omniroute|mcp|skill|codex):[a-z0-9._/-]+$`, `vetted_by: capability-scout` | iff hired |
| `binds` | `{agents: [stem], skills: [name], scripts: [repo path], process: stem or null, tier}` | yes |
| `binds.tier` | `cheap-scan` · `balanced-workhorse` · `high-judgment` · `independent-family-verifier` (`engine/router.yaml` `models:`), or `null` | iff seat ∈ {agent, skill, partial} |
| `reports_to`, `escalate_to` | a role `id` or `human:ashiq` | yes |
| `e2` | list of verbatim `ungrantable_actions` strings read from `hq.policy.yaml` at gate time | yes (may be `[]`) |
| `produces` | `{kind: kebab id, schema: docs/schemas/KIND.md or pending, receipt: handoff.ready}` or `null` | yes |
| `consumes` | list of kebab ids | yes (may be `[]`) |
| `fixtures` | list of bench fixture paths, or `pending` | yes |
| `legitimacy` | `genesis` or `interview:ULID` (the ULID of the approving `decision.recorded`) | iff seat ∉ {vacant, human} |
| `ventures` | list of venture slugs this card is seated for; `[]` = company-wide | yes |
| `kpi` | `pending`, or list of `{name, over: KIND, via: attribution-map or payload, where?}` with `over` ∈ spine `KINDS` | yes |
| `autonomy_ceiling` | `L0`–`L3` | yes |
| `review_by` | `YYYY-MM-DD`, legitimacy date + 30 days (ADR-1607) | iff legitimacy set |
| `history` | list of one-line strings | yes (may be `[]`) |

**Derived, never typed:** a role is **staffed** iff `seat` ∈ {agent, skill, script, process} AND
`legitimacy` is set; **partial** iff `seat: partial`; heads (≥ 2 staffed workers) count staffed
workers with `reports_to: HEAD`. **Model-string FAIL** (ADR-1614): any value outside `hire.source`
matching `/\b(claude|gpt|o[1-9]|gemini|llama|mistral|deepseek|qwen|glm|grok|haiku|sonnet|opus)\b/i`.
**One worked example** is `org/schema/example-seo-strategist.role.yaml`, a copy of the design source's §"A role card"
with these field names; the validator's own test loads it.

**I-3 · Producer scope.** Phase 00: a consumed kind needs ≥ 1 producer anywhere in the catalog. From
Phase 02: on the same team.

**I-4 · Walkers (ADR-1610, ADR-1620).** `agents` and `processes` come from the same primitives
`treeWorld` itself uses, `mdStems(.claude/agents)` and `yamlStems(processes)`, imported from
`face-coverage.mjs` (build note: `treeWorld` also reads the face contract, which a scratch self-test
tree does not carry, and the primitives are the same code); skills from `treeCapabilities(repo)`;
`KINDS` from `treeKinds(repo)`; ventures from `treeVentures(repo)`. The one new export is
`treeScripts(repo)` → a sorted array of repo-relative POSIX paths of `*.mjs|*.js|*.sh` under
`.claude/scripts/**`, symlinks not followed. M10 stubs `.agents` and `treeScripts` in the collector.

**I-5 · Ruling + profiles.** The ruling text is the design source's line 3–4 quote, verbatim. From the
MAIN clone `E:/Work_Hub/01_Automemory/arc` after `git pull`:
`node .claude/scripts/hq/arc-event.mjs emit approval.requested --payload-file RULING.json` with
`{"subject":"org.role","what":"record the owner ruling of 2026-09-29 that founds the org lane","ruling":"…verbatim…"}`,
then the owner runs `node .claude/scripts/hq/arc-inbox.mjs approve ULID --reason "..."`. `org.role` /
`org.team` / `org.dispatch` are registered nowhere: `approval.requested` is generic
(`validate.mjs:410`), `hq.policy.yaml` is not touched for them, and org's own readers refuse any
subject that differs only by case or whitespace.

**I-6 · Drivers + verdicts.** Legal `hire.runtime` values = stems of `.claude/scripts/engine/drivers/*.mjs`
minus `common` and `mock`. In Phase 00 the gate checks `legitimacy` GRAMMAR only; the spine
lookup of `interview:ULID` (a `decision.recorded` approving an `approval.requested` whose payload
names the role) starts in Phase 02.

**I-7 · Genesis digest (step 9).** `org-catalog.mjs --digest` = sha256 over the canonical JSON of the
PARSED cards (keys sorted, cards sorted by `id`), so reformatting a card never invalidates the receipt
and changing any value does (the ADR-1017 rule: digest the parsed values, no genesis exemption).
Payload `{"subject":"org.role","digest":"…","what":"genesis: legitimise N seated roles"}`, N derived.
Every card with `legitimacy: genesis` is covered by that one decision.

**I-8 · `--draft` extraction.** Agent frontmatter `name` → `binds.agents`; `model` → `binds.tier`
(haiku→cheap-scan · sonnet→balanced-workhorse · opus→high-judgment · absent→balanced-workhorse, listed
for owner review); product `manifest.json` `scripts` of the product owning the agent → candidate
`binds.scripts`; the chart row → `seat`, `dept`, `reports_to` (the dept head's id). Mission: drafted
one line per seated card, owner accepts line by line (no-go: no unreviewed model-authored card).

**I-8b · Defaults for every card (simulation round 2 — deterministic, no model):**
`autonomy_ceiling: L1` · `escalate_to` = `reports_to` · `ventures: []` · `kpi: pending` on unstaffed
cards; a genesis-staffed card gets `kpi: [{name: runs, over: run.completed, via: attribution-map}]`
because the gate FAILs a staffed seat with no KPI (ORG-J), and the owner refines KPI lines at review · `consumes: []` and `produces: {kind: ID-output,
schema: pending, receipt: handoff.ready}` until the pilot chain is written in Phase 02 (REQ-13 is
proven in Phase 00 by its mutant arm M7) · `binds.tier` required iff `seat` ∈ {agent, skill, partial},
otherwise `null` · `review_by` for genesis cards = **2026-10-29** (ruling date + 30, fixed at draft time
so the digest never moves). `stages` by department: a-board, b-ceo-office → all eight · c-research →
discover, validate · d-product → discover, validate, build · e-engineering → build, launch, support,
operate · f-design → build, launch · g-growth → launch, grow · h-sales → sell · i-support → support,
operate · j-finance-legal-people → launch, operate. **Mission:** vacant stubs get the deterministic line
`Owns the TITLE job in DEPT.`; seated cards get one line hand-drafted by the executing session, and
the owner accepts each line by line. The `e2` string "publishing under Ashiq's name" goes on
`build-in-public-social` and `launch-pr` only when their card's `byline:` field reads `ashiq`
(ADR-1609, ADR-1622). `--draft` writes only files that do not exist yet; a hand-edited card is never
overwritten.

**Legitimacy rules (M5/M6):** `legitimacy: genesis` is legal only with `origin: own`, and exempts that
card from `fixtures`. `origin: hired` with `legitimacy: genesis` FAILs. `legitimacy: interview:ULID`
requires `fixtures` to be a non-empty list. **M6's plant** is a hired, seated card with
`fixtures: pending`. **M12's plant** re-plants M2 (`ghost-agent`) in the LAST card in sort order and
must FAIL naming it. The selftest's scratch copy lives under `$TMPDIR/org-selftest-PID`, removed
on exit.

**I-9 · Commands.** Wiki: `node .claude/scripts/docs/wiki-build.mjs` then `--check`; face:
`node .claude/scripts/core/face-sections.mjs` then `--check`, and
`node .claude/scripts/core/face-coverage.mjs`; sync golden: rebuild `tests/fixtures/sync-golden/tree-manifest.txt`
by the procedure `tests/sync.bats:140-153` uses for `actual.txt`; product manifest: the shape of
`products/docs/manifest.json` (`name, version, requires, commands, agents, scripts, files, docs, face`);
`products.org` maps to the `toolbelt` room (build notes, CI 36643308697 and 36649278109: the `org`
room is an INDEX room and broke face-l3; leaving the product unmapped broke face-coverage.bats's
"every product mapped"; toolbelt is generic and lists agents, which cards bind; no new ring), and `arc-products.mjs` CATALOG gains `org`; CI read: `node .claude/scripts/review/ci-digest.mjs` in a background loop; close:
`/arc-phase-done 0 --lane org`. Tracker files at close: `initiatives/org/PROGRESS.md`,
`PORTFOLIO.md` (lane row + band row), `docs/HISTORY.md`.

**I-10 · Test files.** `tests/org-coverage.bats` (gate + selftest), `tests/org-card.bats` (field grammar,
the example card, model-string FAIL), `tests/org-chart.bats` (derived counts, `VACANT` banner, `--check`
FAILs a hand edit). Each red-first against a stub that exits 0 and prints success. Bats names ASCII;
each suite's first test asserts the suite's own test count.

## Exit criteria (Definition of Done)
- [ ] ruling `decision.recorded` ULID in the bundle, from the canonical spine
- [ ] 71 cards validate; `org-coverage` exits 0 on the tree (REQ-01)
- [ ] `--mutant-selftest` M0 covered, M1–M12 each exit 1 naming the plant, on all three CI legs (REQ-01, REQ-03, REQ-13; REQ-11 arms)
- [ ] every birth row landed in this PR: `products/org/manifest.json`, `expected-set.json` (`products.org`), `face-sections.mjs` regen + `rooms.generated.json`, sync-golden `tree-manifest.txt`, wiki regen — each shared path checked with `git log origin/main --oneline -5` first
- [ ] `org/CHART.md` shows derived staffed/partial/vacant/human + own/hired counts, `VACANT` banners (REQ-04)
- [ ] `face-coverage`, `face-sections --check`, `wiki-build --check`, `wiki-coverage` green with `products/org` born
- [ ] genesis `decision.recorded` over the catalog digest (profile `org.role`)
- [ ] two-surface `/arc-attack` on `org-coverage` + its selftest, ≤ 2 rounds, findings fixed or in `debt-ledger.md` (ADR-1611)
- [ ] CI green per JOB, head SHA asserted; the Phase 00 PR merged before Phase 01 opens
- [ ] tracker updated in the SAME commit as the close: PROGRESS row ✅ + done-log, lane header, the PORTFOLIO `org` row AND the 1600 band row, HISTORY row; wiki regenerated; `portfolio-board.bats` green per JOB

## Verification plan

- **Test command:** `bats tests/org-coverage.bats` (CI only — three OS legs; never on the dev box)
- **Expected failure first:** the tests-only commit ships a STUB `.claude/scripts/org/org-coverage.mjs` that exits 0 and prints `covered` for every input, so each mutant arm M1–M12 goes `not ok` on its ASSERTION text (e.g. `expected exit 1 naming ghost-agent, got exit 0`), never on a missing module; that red CI run id is recorded in the bundle before the implementation commit.
- **Live demo scenario:** (1) `node .claude/scripts/org/org-coverage.mjs` → `covered: N roles, M agents, 0 findings`, exit 0, where N = card files on disk and M = `.claude/agents/*.md`, both derived and compared in the test; (2) `node .claude/scripts/org/org-coverage.mjs --mutant-selftest` → `arms ran: K of K` (K derived from the arm table), M1…M12 each `FAIL` naming its role, agent or venture; (3) `node .claude/scripts/org/org-catalog.mjs --chart --check` exit 0 and `org/CHART.md` shows the counts.
- **Real-system check:** read the ruling + genesis receipts back with `arc-event` from the main clone; confirm `expected-set.json` and `rooms.generated.json` diff only by the `org` rows.
- **Expected evidence:** `initiatives/org/evidence/phase-00/bundle.md` — red CI run id, green CI run id + head SHA, selftest output, chart counts, two receipt ULIDs, attack JSON.

## Rabbit holes in this phase
- Hand-writing 71 full cards → mechanical extraction + generated stubs (RH-5).
- Perfect KPIs on vacant roles → `kpi: pending`, rendered (RH-4).
- A second walker because the import is awkward → ADR-1620, export it there.

## Out of scope for this phase
Attribution map and scorecard (Phase 01) · team manifests, sync `--team`, interviews, skills (Phase 02) · dispatcher (Phase 03).

## Your-setup / pending
- Owner: approve the ruling record and the genesis digest in `arc-inbox`; accept the mission + KPI lines of seated cards.
- Owner, **before Phase 00 closes**: register Nilluvai via `venture-register` and approve its `ledger.criteria` receipt (ADR-1612), so the Phase 01 pilot gate is a read, not a wait. Missing at Phase 00 close → PROGRESS `## Now` says `PAUSE-RISK: pilot`, told once in one line; Phase 01 still runs.
- Engine lane / owner: rejustify-or-retire the expired `build-in-public-draft` router hire (ADR-1622) — not a Phase 00 blocker.

## Non-negotiables (verbatim from PLAN)

- ORG-A: a role card binds existing agents / skills / scripts / processes / router tier and never rewrites `.claude/agents/*.md` (ADR-1601).
- ORG-B: all 71 roles get cards in Phase 00, vacant ones included; a vacancy fills only after three dispatcher demands; no mass hiring (ADR-1602).
- ORG-C / ORG-D: zero new spine kinds; `validate.mjs` untouched; the `actor` field is never rewritten — attribution is the map, then `payload.role`; a needed kind is a vocab ADR with its `GROUPS` row in the same commit (ADR-1603, ADR-1604).
- ORG-E: the dispatcher is a deterministic script-job at ₹0 — proposals only, goal ancestry on every one, queue cap 7, scheduler heartbeat, budget-capped seats skipped, no agent-to-agent calls (ADR-1605).
- ORG-I / ORG-J: `org-coverage.mjs` is FAIL-FROM-BIRTH with `--mutant-selftest`, imports its walkers from `.claude/scripts/core/face-coverage.mjs`, and FAILs any E2 role seated by an agent (ADR-1609, ADR-1610, ADR-1620).
- ORG-N: a seat's `origin` is `own` or `hired`, nothing else; a hired seat names an `arc-run` driver and a router tier, is vetted by `capability-scout`, and is staffed only in the same branch as a bench run over the role's `fixtures` with a human verdict (REQ-11); no seat names a model string (ADR-1614, ADR-1621).
- ORG-O: a department head is a judge, never a relay — the dispatcher proposes to workers directly; the head reads `handoff.ready` and emits `review.completed`; a head seat is proposed only over ≥2 staffed workers and coverage FAILs otherwise; head = `high-judgment`, workers cheaper tiers (ADR-1615).
- ORG-P / ORG-Q: per-seat `budget` in the team manifest is read from `cost.incurred` (zero kinds) and over-cap = stop-and-propose; every card declares `produces` / `consumes` / `escalate_to`, and coverage FAILs an unproduced consumed kind (REQ-13) (ADR-1616, ADR-1617).
- ORG-R: the process `role:` slot, `arc skill import`, head-judge emission and the hire-to-own command are v2 — not built this cycle, triggers recorded (ADR-1618).
- Phase order is catalog+gate → attribution+scorecard → staffing → dispatcher+review; it is never reordered.
- The day-3 kill checkpoint asks whether the attribution map places today's live-spine receipts on at least three seated roles; if not, the cycle STOPs and the finding is recorded (ADR-1604).
- ORG-L: the pilot is Nilluvai, registered through `venture-register` before Phase 02; arc itself is never the pilot (`venture-register.mjs:73`); if it is not registered, the cycle pauses after Phase 01 (ADR-1612).
- ORG-M: the org is its own product — `products/org`, data under `org/`, scripts under `.claude/scripts/org/` (ADR-1613).
- The owner ruling of 2026-09-29 is recorded on the spine as a `decision.recorded` before any org file ships, and ADR century 1600–1699 is this lane's only band (ADR-1600).
- Nothing about an unannounced venture's positioning is committed to this public repo; team manifests carry ids, stages, heads and budgets only (ADR-1619).
- `engine/router.yaml` is not edited by this lane; the expired social hire is recorded as it stands (ADR-1622).
- Every gate and the dispatcher get a two-surface adversarial pass by fresh agents, max two rounds per PR (ADR-1611).
- Owner-facing decisions this cycle introduces ride `approval.requested` → `decision.recorded` profiles `org.role` / `org.team` / `org.dispatch`; nothing is auto-approved, auto-renewed or auto-fired (ADR-1603, ADR-1606, ADR-1607, ADR-1608).
- "Tests green" means green on CI, read per JOB with the head SHA asserted; no suite runs on the dev box.
- Phase 00 and Phase 01 each merge on green CI before the next phase opens, so P00–P01 are banked on `main` before the pilot gate; every spine emit (ruling, genesis, `org.*` approvals, phase closes) runs from the MAIN clone after a fetch, never from a worktree.
- The dispatcher's scheduler subject is `process:org-dispatch` on a `job_stub: true` process, and its `hq.policy.yaml` row is authored by the owner — no session edits that file (ADR-1623).

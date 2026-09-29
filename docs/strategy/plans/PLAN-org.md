# PLAN (design source) — `org` v1: arc's company layer — every role named, every seat honest, every venture staffed

> **Trigger FIRED — owner ruling, 2026-09-29.** *"Oru new idea vantha antha product ah create panni,
> deploy panni, SEO panni, sales panni, support panra — full-time company maari — ovvoru task kum oru
> separate skilled agent."* The ruling goes on the spine as a `decision.recorded` in Phase 0 and every
> kickoff ADR cites it, the same pattern the Build-out Mandate set.
>
> **v1.1 — owner review round 2, 2026-09-29.** Owner asked for three things the v1.0 draft did not hold:
> department heads with multiple workers, the same process run by different agents, and seats that
> can be *own* or *hired* from outside. A scan of the 2026 "AI company" tools (Paperclip, CrewAI,
> MetaGPT/ChatDev, OpenClaw/Hermes, Relevance, TeamDay) was folded in as **ideas, never as
> dependencies**. Result: **ORG-N…R added, REQ-11…13 added, role-card and team-manifest shapes
> extended, P00 and P02 each +0.5 d.** Owner ruling on the "converted" seat state: *rejected* — a hire
> that becomes own **is** own; conversion is an event with provenance, not a third state (ORG-N).
>
> **Status: DRAFT for owner review — NOT landed.** On landing, decisions **ORG-A…L and ORG-N…R lock**;
> **ORG-M stays open by design** and is decided at kickoff. This file then becomes the frozen decision
> record; the buildable cycle is cut from it into `initiatives/org/PLAN.md` at kickoff. Attack findings
> mutate that file, never this one.
>
> **Honesty note.** There is no measured "org pain" baseline and none is invented. The spine on
> 2026-09-29 holds **zero** `revenue.received`, `deal.won` or `month.closed`; this plan does not claim
> the org layer produces money. The falsifiable claims it makes are mechanical: **REQ-05** (every staffed
> role's performance is derived from real receipts, not asserted), **REQ-08** (a dispatcher staffs a
> real venture for five days and the owner accepts at least half of what it proposes) and **REQ-11**
> (a hired seat reaches the company only through the engine and only after passing its role's fixtures).
>
> **ADR band.** `org` holds no band. Claim **1600–1699** — PORTFOLIO's "next lane to be born" row —
> at kickoff, **after sweeping sibling worktrees.** Note the docs-band row reads "1500–1512 taken" while
> `1513` exists on disk: the board is already one file stale, which is exactly why the sweep is mandatory.

---

## Read this first — arc already has every organ of a company except the one that binds them

Walk a real company's org and look for its arc equivalent. Almost every organ **already exists and is
already gated**:

| A company has… | arc already has… | Where |
|---|---|---|
| A board | council + Constitution (adopted v1.0, 2026-08-06) | `/arc-council`, `CONSTITUTION.md`, `constitution.adopted` receipt |
| An audit trail | the spine — append-only, closed vocabulary of 46 kinds | `.claude/scripts/hq/lib/validate.mjs:39` |
| Onboarding a new hire | `agent-scaffold.mjs` — tier declared at birth, proposal branch, gate `agent-roster` | `.claude/scripts/engine/agent-scaffold.mjs`, ADR-0069, ADR-1341 §4 |
| Contractors with a contract end date | router "hires" — `cap / hosted / judge / review_by`, tenure enforced at load | `engine/router.yaml`, ADR-0216, ADR-0217 |
| A staffing agency | `arc-run` + three drivers behind one interface (`claude-code` / `codex` / `generic-api`), a 4th is a stub by design | ADR-0203, ADR-0212, ADR-0220 trial seam |
| A hiring interview | bench — fixture-driven A/B with human verdicts | `products/bench`, ADR-0900..0914 |
| Authority levels | the autonomy ladder L0–L3, two keys (human ceiling × earned cap) | `hq.policy.yaml:24`, PLAN-policy |
| Performance review & promotion | trial-ledger (fixture-proven + 3 clean runs) + retro | `docs/trial-ledger.md`, `/arc-retro` |
| Automatic demotion after an incident | A4 + `policy.demoted` | `CONSTITUTION.md`, `validate-policy.mjs` |
| A standup / manager | `arc brief` + inbox | `products/hq` |
| A heartbeat / working hours | the scheduler | `hq.jobs.yaml`, `arc-jobs` |
| Company memory | `arc-recall` | `products/memory` |
| Things only the owner may do | E2 Human Sovereignty — money, prices, kills, publishing under Ashiq's name | `CONSTITUTION.md` E2, `hq.policy.yaml` `ungrantable_actions` |

**What does not exist anywhere in the tree** (grep for `role`, `team`, `org`, `staff`, `coo`,
`roster`-as-org returns nothing): the thing that says **"this is a job, this is who holds it, where they
came from, what they are measured on, what they hand to whom, and this venture is staffed by these jobs
at this stage."**

That missing binding is why the owner sees 30 agents, 28 commands and 17 products and feels *"ellame
oru proper shape la illa."* Agents today are grouped by the **product that ships them** (a tool view),
never by the **job they do** (a company view). Growth, leads, legal and ledger have **zero agents** —
they are scripts with no one assigned to run them. And `sync-to-project` can install products into a
venture, but nothing can say which **people** that venture has.

**So this cycle builds almost no new machinery.** It builds one canonical object — the **role card** —
and wires it to organs that already work. The best companies in the world are not distinguished by
having more departments; they are distinguished by every seat having a clear owner, a clear measure,
and a clear way to be promoted or removed. That is the whole scope.

**The shape is flat, on purpose.** One dispatcher (the COO seat) proposes work; on-demand specialists do
it and leave; handoffs are receipts, never conversations; the owner is the board and the CEO.
**Department heads exist, but as judges, not relays** (ORG-O). **Roles are a catalog, not headcount** —
the blueprint's §5 rule, kept and made enforceable. Why flat and not an agent hierarchy is in *External
evidence* below.

**What the 2026 tools taught and what was refused.** Paperclip contributes goal ancestry, heartbeat
wake-ups, per-seat budget breakers and "any runtime that can receive a heartbeat is hired"; arc takes all
four, the last one rewritten as *"if it can emit a receipt through `arc-run`, it is hired."* MetaGPT /
ChatDev contribute "Code = SOP(Team)": every role produces a named artifact the next role consumes, no
chat; arc takes it as `produces` / `consumes` on the card. CrewAI's Crews (agents conversing) and
Paperclip's CEO-agent → VP-agent → worker relay are refused — that is the relay chain the evidence says
loses accuracy at every hop. Relevance AI's confidence-based autonomy is already exceeded by L0–L3 +
earned cap. OpenClaw's skill marketplace is a v2 supply line (ORG-R). **Nothing is installed; ideas are
hired, tools are not.**

---

## Goal

Every job a product company needs — from market research to support to the books — exists as a
**role card** with a mission, a stage, a seat (agent · skill · script · human · vacant), a seat
**origin** (own · hired), a KPI derived from the spine, what it **produces and consumes**, a budget and
an autonomy ceiling; a **team manifest** staffs one real venture from those cards by lifecycle stage,
with department heads seated only where they have workers to judge; a **dispatcher** proposes that
venture's next jobs with full goal ancestry at L1; and a **monthly review** scores every staffed role
from its own receipts — so "who does this job, where did they come from, how well, and should they be
promoted or retired" is answered by the tree, not by memory.

---

## Current state (verified 2026-09-29 against the live tree — re-verify at kickoff)

| Thing | Count | Relevant fact |
|---|---|---|
| Agents (`.claude/agents/*.md`) | 30 | Frontmatter keys: `name`, `description`, `tools`, `model` (29/30 — `spec-fidelity` has none). Tiers: 24 sonnet · 4 opus · 1 haiku. |
| Agents by product | council 12 · plan 5 · design 4 · develop 3 · review 2 · qa 2 · core 2 | growth · leads · legal · hq/ledger · memory · evolve · docs → **0 agents** |
| Skills (`.claude/skills/`) | 1 | `seo-article-writer` only |
| Commands | 28 | kickoff, council and one more generated from `processes/*.process.yaml` (ADR-0201) |
| Processes | 13 | the `agent.invoke` list is the only existing "who may call whom" declaration; it names **agents, not roles** |
| Products | 17 | each `manifest.json` lists `agents:`; `face.room/ring` |
| Router | 3 drivers · 4 tiers · classes hand-edited | `claude-code` pinned (haiku/sonnet/opus); `codex` + `generic-api` **unpinned, unreachable** (ADR-0914); `independent-family-verifier` tier **empty** |
| Router hires | 1 | `build-in-public-draft` on `hermes` — **`review_by: 2026-08-31`, expired** |
| External seats (non-Claude model, MCP tool, imported skill) | **0** | no hire path exists beyond router rows; no skill import command |
| Policy subjects | `session:interactive` + 13 `process:*` | ADR-0504 closes the set; **agents and roles have no policy identity** |
| Spine actor field | 1 | `actor` matches `/^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/` — e.g. `human:ashiq`. The only identity on an event. |
| Ventures | 1 (`lexos`, paused, outside arc) | ADR-0059: a venture never gets a lane; it runs its own root-mode install |
| Role / team / org objects | **0** | nothing to migrate, nothing to reconcile |
| Spine actors today | `arc-event` 1385 · `scheduler:day-close-roll` 34 · `arc-leads` 20 · `scheduler:brief-materialize` 5 · `ashiq` 4 · `human:ashiq` 1 | owner decisions arrive as `arc-event` via `arc-inbox`; `arc-jobs.mjs:756` forces `scheduler:<name>` and `lib/jobs/audit.mjs:166` counts any other actor as a MANUAL start |
| Scheduler budget | `hq.jobs.yaml` `monthly_ceiling_inr: 0` | any `type: process` job needs `budget.inr` (`schema.mjs:338`); a positive value breaches the ceiling |
| `face-coverage.mjs` walkers | `treeWorld` · `treeVentures` · `treeCapabilities` (skills) · `dirNames` / `mdStems` / `yamlStems` … | **no scripts walker** |
| Blueprint | `docs/strategy/arc-company-org-blueprint.md` (2026-07-25) | "~50 roles, 9 departments", states now stale; §5 shape rule is correct and is kept in spirit |

**Overlap that must be resolved, not ignored.** The blueprint's §4 org chart is a hand-maintained
inventory whose states rotted within a week (audit 2026-08-03: design/develop/engine/model-policy all
jumped to EXISTS with no row). ORG-J makes that a Phase 00 exit criterion: §4 becomes a pointer to the
generated org chart, the rest of the blueprint (honest frame, grades, §5, evidence) stays as history.
**The blueprint does not move at landing time** — it moves when the generated chart that replaces it
exists.

---

## Success requirements

| # | Requirement | How it is proven |
|---|---|---|
| **REQ-01** | Every job in the catalog has a valid role card, and every agent in the tree belongs to at least one role. | `org-coverage` exits 0 on a clean tree. |
| **REQ-02** | An agent with no role, or a role naming an agent / skill / script / process that does not exist, FAILS CI naming it. | Mutant tree with an orphan agent **and** a role citing `ghost-agent` FAILs naming BOTH. |
| **REQ-03** | No role that touches an E2 action can be seated by anything but a human. | Mutant role with `e2: ["publishing under Ashiq's name"]` and `seat: agent` FAILs naming the role and the E2 action; a mutant with a non-verbatim string (`e2: [publish]`) FAILs too. |
| **REQ-04** | Vacancy is rendered, never hidden. | The generated org chart prints staffed / partial / vacant / human counts **and own / hired counts**, and a vacant role renders with a visible `VACANT` banner. |
| **REQ-05** | A staffed role's performance is **derived from receipts**, never typed. | `org review --role R` re-derives runs, accepts, rejects, incidents and cost from the spine; `--audit` recomputes every number and diffs it. A role with zero attributable receipts prints `no evidence`, never `0% / 100%`. |
| **REQ-06** | A team manifest cannot change silently. | Mutant edit to `<venture>.team.yaml` without an approving `decision.recorded` over its digest FAILs (same profile pattern as `ventures.yaml`, ADR-1017). |
| **REQ-07** | Installing a team installs its staffed roles and only what they need. | `sync-to-project <dir> --team <venture>` resolves the products owning the bound agents / skills / scripts through the existing `arc-products.mjs` resolver; golden test: installed = that product closure + `core`, nothing else. (`--products` has no per-agent granularity and v1 does not add one.) |
| **REQ-08** | The dispatcher proposes real work a human wants. | Pilot venture, 5 consecutive elapsed days: every proposal names role · task · goal ancestry · budget; **zero executions**; owner accept rate ≥ 50% recorded. |
| **REQ-09** | Filling a vacancy is a hire, not an edit — and the seats that exist today are legitimised once. | A vacancy is filled only through `agent-scaffold` (or the router hire path) and the role card changes in **the same proposal branch**; a card flipped to `staffed` without it FAILs. **Genesis:** the ~20 already-seated agent roles have no `agent-roster` receipt, so P00 closes with one owner `decision.recorded` over the catalog digest (profile `org.role`) — the `ventures.yaml` "no genesis exemption" rule, applied. |
| **REQ-10** | The company does not eat the CEO. | Owner load per day = `decision.recorded` count **by kind** (owner decisions arrive as `arc-event` via `arc-inbox`, so counting by actor would read zero); the dispatcher's queue cap holds proposals at ≤ 7/day, and a day over cap is printed, not hidden. |
| **REQ-11** | A hired seat reaches the company only through the engine, and only after an interview. | A card with `origin: hired` must name an `arc-run` driver and a router tier; every receipt it emits carries `model_source: router \| trial` (ADR-0220), never `none`; and the seat is flipped to `staffed` only in the same branch as a bench run over the role's `fixtures` with a recorded human verdict. Mutant: `origin: hired` with no `hire.runtime`, or staffed with no fixture verdict, FAILs naming the role. |
| **REQ-12** | A seat cannot spend past its line. | Per-seat `budget` in the team manifest is compared against `cost.incurred` receipts attributed to that role (ORG-D); over cap, the dispatcher stops proposing that role and emits one `approval.requested` (`org.dispatch`, `why_now: budget-cap`). `org review` prints cost per role; a role with no cost receipts prints `no evidence`. |
| **REQ-13** | Every handoff has a producer. | Every artifact kind a role `consumes` is `produces`-declared by at least one role on the same team; `org-coverage` FAILs naming the unproduced kind. Mutant: a role consuming `ghost-brief` FAILs. |

---

## Decisions (letters — real ADR numbers assigned at kickoff from the claimed century)

**ORG-A · The role card is the one canonical object; it binds, it does not replace.**
A role card is a small YAML file per job. It **points at** the things that already exist — agent files,
skills, scripts, processes, a router tier, a policy subject — and adds only what nothing else holds:
mission, stage, KPI, seat, origin, reports-to, E2 exposure, tenure, produces / consumes, budget. Agent
files stay exactly where and what they are. *Generating* agent files from role cards is a named rabbit
hole (RH-3), not v1.

**ORG-B · The catalog is complete from birth; staffing is pulled.**
All 71 roles get a card in P00 — including every vacant one. A complete catalog with honest vacancies
is the org chart; a partial catalog is a wish list. **Seated roles get full cards** (bindings extracted
mechanically from agent frontmatter and product manifests; the owner accepts only the mission and KPI
lines). **Vacant roles get generated stubs** — `seat: vacant`, `kpi: pending`, mission line only — so
the catalog is complete without 25 cards of invented detail and without an A3-breaking review load. But a
vacancy is **filled only when real work pulls it**: the dispatcher records every time it wanted a vacant
role (the *vacancy demand counter*), and a hire is proposed only after **three** distinct demands. This is
A8 (earn before build) applied to headcount, and it is the direct answer to Rabbit hole 1.

**ORG-C · Zero new spine kinds.**
Staffing changes, hires, reviews and dispatch ride `approval.requested` → `decision.recorded` with three
named `subject` profiles — `org.role` (catalog + genesis + hires), `org.team` (team manifests),
`org.dispatch` (the dispatcher's proposals, including budget-cap stops) — exactly as ADR-0217 did for
hires and ADR-1017 for `ledger.criteria`: "costs zero kinds". `validate.mjs` is **not touched** in v1 —
it is a shared organ, and the file itself records a 44→46 two-lane collision. Performance reads existing
kinds (`run.completed`, `approval.requested` / `decision.recorded`, `review.completed`,
`incident.raised`, `cost.incurred`, `handoff.ready`, `slice.done`, `content.published`,
`outreach.sent`, …). If P01 proves a role cannot be measured without a new kind, that is a **vocab ADR**
with its `GROUPS` row in `arc-brief.mjs` in the same commit — never a silent kind.

**ORG-D · Attribution is a derived map first, a payload field second — the `actor` field is never touched.**
`actor` already carries load-bearing meaning: `arc-jobs.mjs:756` forces `scheduler:<name>` and
`lib/jobs/audit.mjs:166` counts any other actor as a MANUAL start — rewriting it to `role:<id>` would
break the scheduler's own audit. So attribution comes in two layers:
1. **The attribution map** (`org/attribution.yaml`, generated where possible, reviewed where not):
   existing `actor` / process / kind combinations → role. `arc-leads` → lead-researcher / SDR ·
   `review.completed` from `/arc-review` → code-reviewer · `kickoff.done` → product-manager ·
   `phase.closed` → the lane's developer seat · `scheduler:*` → PMO. This is what lets the scorecard read
   **today's** spine, before any emitter changes.
2. **`payload.role`** on receipts emitted by newly staffed roles (from P02), where the kind's validator
   accepts it (A-01).
A receipt neither layer can place is counted **unattributed** — printed with its count, never guessed.

**ORG-E · The COO is a deterministic dispatcher script-job, not a boss agent and not a model.**
Its whole job is arithmetic: read the team manifest, the stage's exit criteria and the spine; find which
criteria are unmet; propose the role whose card owns each one; skip a role whose budget line is spent
(REQ-12). That needs no model, which also means it fits `hq.jobs.yaml`'s `monthly_ceiling_inr: 0` — a
`type: process` job would need `budget.inr` (`schema.mjs:338`) and breach the ceiling. It emits
**proposals only** — `approval.requested`, profile `org.dispatch`, payload `{role, task, goal_ancestry:
[mission, stage, exit_criterion, task], budget, why_now}` — with its actor left as
`scheduler:org-dispatch` so the scheduler audit stays true. It never executes, never calls an agent,
never chats. It reads the spine and emits one kind, the ADR-0703 reader-only pattern; and like ledger
(ADR-1011) and bench (ADR-0912) it **adds no policy subject** and must never become a money path.
Hub-and-spoke, one hub, no relay. A model-written proposal is a later cycle, and only if the owner's
accept rate says the deterministic one is too blunt.

**ORG-F · Eight lifecycle stages, each with receipt-measured exit criteria; stage change is human.**
`discover → validate → build → launch → grow → sell → support → operate`. Each stage names the roles
"on shift" and an exit criterion the spine can check (e.g. build→launch: `ship.done` + legal pages
rendered; launch→grow: first `content.published`; operate: first `revenue.received`). The dispatcher
may *propose* a stage change when the criterion reads true; only an owner `decision.recorded` moves it.
Stages overlap by design (support starts at the first user, not at stage 7) — the manifest lists
`on_shift` per stage, not a waterfall.

**ORG-G · Every staffed seat has tenure, and every review ends in one of four verdicts.**
ADR-0216's rule — every hire is planned obsolescence, `review_by` enforced at load — extends from router
hires to **every staffed role, own or hired** (period decided at kickoff; 30 days proposed). The monthly
`org review` derives each role's scorecard and proposes exactly one of: **keep · promote** (ask to raise
the policy cap, citing trial-ledger evidence) **· retrain** (change a skill or prompt) **· retire** (seat
back to vacant, agent to attic per A10). Propose-only both ways, never auto-renew, never auto-fire —
except A4's automatic demotion on incident, which already exists and is not re-implemented.

**ORG-H · Skills are how know-how moves between roles.**
A role composes skills; skills are the open `SKILL.md` format, so the know-how is not locked to one
runtime (in the spirit of A7's "everything is replaceable"). v1 proves the contract with **three skills
at the real extremes**, not twenty:
1. **`council-consult`** — the owner's "council as a base skill" ask, done honestly. `arc-council` is a
   hand-written command (not one of the three generated ones), `council-convene.process.yaml` takes only
   a `question` (never a mode word), and a headless role at L1 cannot shell out to `arc-run`. So v1
   `council-consult` does the one thing it legally can: it **drafts the question and emits an
   `approval.requested` asking the owner to convene** — or runs interactively when the owner is in the
   session. Any role can reach the board; no role can convene it alone.
2. **one skill over existing scripts** — the operator side has scripts and no hands; the skill is what
   lets a role run them (candidate: `outreach-draft` over `arc-leads`, or `seo-brief` over `arc-growth`
   — picked by what the pilot pulls first).
3. **one brand-new know-how skill** — `support-reply` (department I, Customer Success & Support, has
   nothing at all today).

**ORG-I · Human seats are first-class and some are permanent.**
`seat: human` is a legal, honest state — not a vacancy. A role's `e2:` list may hold **only the five
verbatim `ungrantable_actions` strings** from `hq.policy.yaml` ("moving money" · "killing a venture" ·
"changing prices" · "unlocking real-money trading" · "publishing under Ashiq's name"), and where the role
binds a process, `e2` is **derived from that process's policy row, not re-declared** — one source of
truth (A5). Any role with a non-empty `e2` **can only** be seated `human:ashiq`, enforced by
`org-coverage`, FAIL-FROM-BIRTH. Human seats that are the owner's *choice* rather than E2 (tax, the
constitution keeper) are marked `human (owner choice)`, so the chart never pretends a preference is law.
Build-in-public / social and launch / PR carry "publishing under Ashiq's name" **only if they post under
his byline** — the card states which byline, and the gate reads it. The agent may prepare; the human
decides.

**ORG-J · Coverage is bidirectional, FAIL-FROM-BIRTH, with its mutant — and imports its walkers.**
`org-coverage.mjs` imports agent / skill / process / product / venture discovery from
`.claude/scripts/core/face-coverage.mjs` (the DOC-A precedent — a second walker is the recurring
"validate one read, compare another" defect). It exposes no **scripts** walker today; the one P00 needs
is **exported there**, not written here (A-07). Checks: every agent ∈ ≥1 role; every role reference
resolves; every venture in `ventures.yaml` has a team manifest and vice-versa; no E2 role seated by an
agent; every staffed role has a KPI expressible over `KINDS`; every hired seat names a driver, a tier and
a fixture verdict (REQ-11); every consumed artifact kind has a producer (REQ-13); a head seat has ≥2
staffed workers (ORG-O). Named exception to WARN-first, same stated reason as `face-coverage`,
`policy-lint`, `jobs-lint`: *a coverage lint that only warns is a hope.* Ships `--mutant-selftest`. P00
exit also moves the blueprint's §4 to a pointer at the generated chart.

**ORG-K · Two-surface adversarial pass on the dispatcher and on each gate.**
One agent on decision logic (stage criteria, scorecard math, vacancy counter, budget arithmetic), one on
the filesystem / spine / policy boundary. **Neither may be the code's author.**

**ORG-L · The pilot venture is Nilluvai, registered before P02.**
REQ-08 needs a real venture staffed for five days, and there is exactly one legal candidate: **Nilluvai**
(Indian exporter stuck-money tracker — the owner's chosen next venture). arc itself cannot be the pilot:
`venture-register.mjs:73` refuses `--slug arc` ("the factory's overhead, never a venture") and LED-G
books `venture: arc` as Overhead. LexOS is paused and outside arc. So Nilluvai goes through the existing
`venture-register` + approval as a kickoff gate. If it is not registered when P02 would start, **the cycle
pauses at the end of P01** — P00 and P01 still bank a complete catalog and a working scorecard over arc's
own lanes — and never substitutes a fake pilot.

**ORG-M · OPEN at kickoff — where the org lives.**
A new `products/org/` product with `org/roles/**.role.yaml` and `org/teams/*.team.yaml` beside the
manifest, **or** role cards under `hq` beside `ventures.yaml` (the org is a company organ like the
ledger). The first keeps `hq` from growing again (74 scripts); the second keeps company-governance
files together. Decided at kickoff, recorded as an ADR.

**ORG-N · A seat has an origin — `own` or `hired` — and a hire enters only through the engine.**
`origin: own` is an agent, skill or script that lives in this tree. `origin: hired` is anything from
outside: a non-Claude model on `generic-api` (OmniRoute / OpenRouter), an agent runtime on `codex`, an
MCP tool, an imported `SKILL.md`. Paperclip's rule, rewritten for arc: **"if it can emit a receipt through
`arc-run`, it is hired."** A hired seat therefore names an `arc-run` driver and a router tier on its
card (`hire.runtime`, `hire.source`), is vetted by `capability-scout` (ADR-0110) before seating, carries
ADR-0216 tenure, and never calls a model directly — the engine is the only door, so ADR-0069's
no-auto-switch law and ADR-0220's `model_source` receipt apply to it unchanged. **There is no third
state.** A hire that is later rewritten as an own agent (through absorb + `agent-scaffold`, in a
proposal branch, with an ADR) simply becomes `origin: own`; the card's `history:` line and the ADR carry
the provenance. The owner rejected "converted" as a state on 2026-09-29: a hire that becomes own is
own. **Interview = bench.** Every role card lists `fixtures:`; a seat — own or hired — is flipped to
`staffed` only in the same branch as a bench run over those fixtures with a human verdict recorded
(REQ-11). v1 writes fixtures only for the pilot's staffed roles (RH-4 applies); the rest carry
`fixtures: pending`, rendered.

**ORG-O · A department head is a judge, not a relay.**
The owner asked for heads with multiple workers. The evidence says a head that *delegates* (CEO-agent →
VP-agent → worker-agent) loses accuracy at every hop, so arc's head never briefs anyone. The dispatcher
proposes work **directly** to workers with goal ancestry from the manifest; the worker's `handoff.ready`
artifact is what the head reads; the head emits `review.completed` — the shape `/arc-review` and the
design jury already use, lifted to department level. Two hops maximum, both receipted, no
conversation. Consequences: the head's scorecard is the aggregate of its workers' receipts (a dept
number exists); the head seat binds `high-judgment` while workers bind `balanced-workhorse` or
`cheap-scan` — the owner's *brain = Claude, hands = cheap model* split, made structural; and **a head
seat is proposed only when its department has ≥2 staffed workers** (`org-coverage` FAILs a head
seated over fewer — a head without workers is decoration). The head reviews only `handoff.ready`
artifacts, never every run (pre-mortem 6). Team manifests carry `heads:` per department.

**ORG-P · Every seat has a budget line, read from `cost.incurred`, enforced by the dispatcher.**
Paperclip's per-agent monthly budget breaker, arc-style: the team manifest carries `budget` per seat
(`tokens_month`, `inr_month`, `cap_action: stop-and-propose`); the amount spent is derived from
`cost.incurred` receipts placed on the role by the attribution map (ORG-D) — never typed, zero new
kinds. Over cap, the dispatcher stops proposing that role and emits one `approval.requested`
(`org.dispatch`, `why_now: budget-cap`); nothing is killed, nothing auto-renews. Cost per role is a
column on the scorecard, which is the evidence `org review` needs to say *retire* about a seat that
costs more than it returns. Budgets are token and rupee caps, not salaries (no-go 8).

**ORG-Q · A role declares what it produces and what it consumes; handoffs are the SOP.**
MetaGPT / ChatDev's one durable lesson — "Code = SOP(Team)": roles exchange **named artifacts**, not
messages. Each card carries `produces: {kind, schema, receipt: handoff.ready}` and `consumes: [kinds]`.
`org-coverage` proves every consumed kind has a producer on the same team (REQ-13), which is how a team
manifest is shown to be a working chain and not a list of titles. Each card also carries
`escalate_to:` — the head, or `human:ashiq` — the seat the dispatcher proposes to when the role's
fixture fails, its budget caps, or it emits `handoff.ready` with `blocked: true`. Schemas are markdown
files under `docs/schemas/`; v1 writes schemas only for the pilot's chain (RH-4).

**ORG-R · What v2 holds, written down now so v1 does not creep.**
Four things were designed in review and deliberately deferred, each with its trigger:
1. **The process `role:` slot + seat trial** — `processes/*.process.yaml` steps name a *role* resolved
   deterministically to the best-scoring bound agent, and `arc-run --trial-seat <agent>` runs the same
   process under a different seat with `seat_source: trial` on the receipt (the ADR-0220 pattern). This
   is "same process, different agents". Touches 13 process files + process-lint; *trigger:* the pilot
   records ≥1 role with two candidate agents wanting the same process.
2. **`arc skill import <source>`** — pulls a `SKILL.md` from an external registry into a proposal
   branch, vets it with `capability-scout` (ToxicSkills is the named threat model), lands it with the
   role card change in the same branch (REQ-09 pattern). *Trigger:* the vacancy demand counter hits 3 on
   a role whose know-how exists as a public skill.
3. **Head-judge wiring** — ORG-O's rule is enforced by coverage in v1; the actual `review.completed`
   emission by a head over a worker's artifact is v2, once two workers exist under one head.
4. **The hire-to-own rewrite command** — v1 does it by hand through absorb + `agent-scaffold`; a
   command is earned only after the second such rewrite.

---

## The three layers

```
LAYER 3 · GATES + LOOPS   org-coverage.mjs   — nothing unowned, no E2 leak, no ghost refs,
                                               no unproduced handoff, no head without workers,
                                               no hire without driver+fixtures            BLOCK  (ORG-J, I, N, O, Q)
                          org review         — monthly scorecard incl. cost/role
                                               → keep/promote/retrain/retire              PROPOSE (ORG-G, P)
                          org-dispatch       — heartbeat → next jobs with goal ancestry,
                                               skips budget-capped seats                  L1     (ORG-E, P)

LAYER 2 · STAFFING        <venture>.team.yaml — stage · on_shift · seats · heads · budget/seat · human gates
                                                                                          digest-governed (ORG-F, O, P, REQ-06)
                          vacancy demand counter — 3 real demands before a hire is proposed (ORG-B)
                          interview = bench over role fixtures before any seat is staffed  (ORG-N, REQ-11)

LAYER 1 · THE CATALOG     roles/<dept>/<role>.role.yaml — 71 cards, vacant ones included   (ORG-A, B)
                          points at: .claude/agents · .claude/skills · scripts · processes · router tier
                                     · arc-run driver (hired) · policy subject
                          declares: origin · produces/consumes · escalate_to · fixtures   (ORG-N, Q)
```

### A role card (shape, not final schema — P00 fixes it)

```yaml
id: seo-strategist
title: SEO Strategist
dept: growth
mission: "Turn real search demand into a ranked content plan the venture can win."
stages: [launch, grow]
seat: partial            # agent | skill | script | process | human | partial | vacant
origin: own              # own | hired  — no third state (ORG-N)
hire: null               # only when origin: hired —
                         #   {runtime: generic-api, source: "openrouter:<slug>", vetted_by: capability-scout}
binds:
  agents: []             # none yet — vacancy demand counter decides
  skills: [seo-article-writer]
  scripts: [.claude/scripts/growth/arc-growth.mjs]
  process: null
  tier: balanced-workhorse   # a router tier ADR-0069 names — never a model string; the engine is the only door
reports_to: head-of-growth
escalate_to: head-of-growth   # or human:ashiq (ORG-Q)
e2: []                   # verbatim ungrantable_actions only; derived when a process is bound; non-empty ⇒ human seat (ORG-I)
produces: {kind: seo-brief, schema: docs/schemas/seo-brief.md, receipt: handoff.ready}   # ORG-Q
consumes: [growth-cluster-row]
fixtures: pending        # bench fixture set = the interview (ORG-N); written for pilot roles only in v1
kpi:                     # derived from the spine, never typed (REQ-05)
  - {name: pieces shipped, over: content.published, via: attribution-map}   # ORG-D
  - {name: indexed clicks, over: metric.observed, where: {metric: clicks}}
autonomy_ceiling: L1     # the policy engine owns the real ladder; this is the card's declared max
review_by: 2026-10-29    # tenure (ORG-G) — only when staffed
history: []              # e.g. "hired 2026-10-01 generic-api → own 2026-11-02 ADR-16xx" — provenance, not state
```

### A team manifest (shape)

```yaml
venture: <slug>          # must exist in ventures.yaml (ORG-J)
stage: build             # moved only by owner decision.recorded (ORG-F)
mission: "…one line…"
on_shift:
  build:  [product-manager, architect, developer, code-reviewer, qa-tester, security-engineer, ui-designer]
  launch: [devops-release, legal-counsel, tech-writer, seo-strategist, launch-pr]
  # …
heads:                   # judge seats — proposed only where ≥2 workers are staffed (ORG-O)
  engineering: solution-architect
  growth: head-of-growth
seats:
  pricing-strategist: human:ashiq
  account-executive:  human:ashiq
  content-writer:
    budget: {tokens_month: 400000, inr_month: 0, cap_action: stop-and-propose}   # ORG-P, read from cost.incurred
budget:                  # per stage, same source — no new kinds
  build: {tokens: …, cap_action: stop-and-propose}
dispatch:
  heartbeat: daily
  queue_cap: 7           # REQ-10
```

---

## The org chart — 10 departments, 71 roles, and who holds each seat today

Seat today: **A** agent · **S** script/skill only · **P** process/command · **H** human (permanent or
E2) · **V** vacant. Every seat listed is `origin: own` today — **external seats: 0**. Every row becomes
a card in P00; nothing below is "built" by this plan except where a phase says so. Head roles (marked
*head*) are judge seats under ORG-O and stay vacant until their department has two staffed workers.

**A · Board & Governance** — Board / advisors **A** (council ×12) · Internal auditor **A** (council-verifier + lints) · Calibration keeper **P** (`council-calibrate`, 0 scored) · Policy officer **P** (policy engine) · Constitution keeper **H** (owner choice)

**B · CEO Office** — CEO **H** (Ashiq) · COO / dispatcher **V → P03** · Chief of staff **P** (`arc brief`, inbox) · Knowledge manager **P** (`arc-recall`) · PMO / scheduler **P** (`arc-jobs`)

**C · Research & Strategy** — Market researcher **V** · Pain-point miner **V** · Competitive intel **V** · Strategy analyst **A** (council-strategist) · Risk analyst **A** (council-risk-analyst) · Pricing strategist **H** (E2: changing prices)

**D · Product** — Product manager **P+A** (kickoff, question-planner) · Business analyst **A** (product-challenger) · Plan attacker **A** (plan-attacker, plan-simulator) · UX researcher **V** · Technical writer **P** (docs lane) · UX writer **V**

**E · Engineering** — Solution architect **P+A** *head* (kickoff ADRs, codebase-surveyor) · Developer **P+A** (`/arc-develop`, pattern-miner) · Spec-fidelity checker **A** · Code reviewer **A** · Security engineer **A** (security-auditor) · QA tester **A** · DevOps / release **P** (`arc-ship`, `arc-canary`) · SRE / on-call **V** · Data engineer **V** · AI/ML engineer **V** · Capability scout **A** · Log analyst **A** (log-analyzer)

**F · Design** — Design director **A** *head* · UI designer **A** (ui-composer) · Design critic **A** · Design jury **A** · Design reviewer **A** · Brand designer **V** · Graphics / video **V**

**G · Growth & Marketing** — Head of growth **V** *head* · SEO strategist **S** (`arc-growth` mine/cluster) · Content writer **S** (`seo-article-writer`) · Content editor **S** (slop-lint) · Build-in-public / social **S** (hire expired 08-31) · Email / lifecycle **V** · Marketing analyst **S** (GSC ingest) · Launch / PR **V** · Community manager **V** · Performance ads **H** (E2: moving money)

**H · Sales** — Lead researcher **S** (`arc-leads`, 15 researched) · SDR / outbound **S** (`arc-leads`, 9 sent) · Proposal writer **V** · Sales engineer / demo **V** · RevOps / CRM **V** · Account executive / closer **H** (E2: changing prices · moving money)

**I · Customer Success & Support** — Support L1 **V** · Support L2 (bug → fix) **P** (develop + review) · KB writer **V** · Onboarding specialist **V** · Customer success / retention **V** · Voice-of-customer analyst **V**

**J · Finance, Legal & People-Ops** — Bookkeeper **S** (`arc-pnl`, 0 `month.closed`) · Billing / payments ops **V** · FinOps / token cost **P** (router tiers) · Tax / GST **H** (owner choice) · Legal counsel **S** (`arc-legal render`) · Compliance / DPDP **V** · HR / performance **P** (trial-ledger + retro → `org review` in P03) · Recruiter **P** (`agent-scaffold` + bench interview)

**Totals today:** 20 agent-backed · 11 process-only · 9 script/skill-only · 6 human · 25 vacant · **0 hired**. The generated chart
replaces these hand counts in P00 (REQ-04) — *a number nobody recomputes is a number that starts lying.*

---

## How a new idea becomes a staffed company — six steps, and the owner makes three decisions

1. **Idea → venture.** `venture-register` (existing) writes kill lines + passport. *Owner decision 1.*
2. **Venture → team.** `org team init <venture>` proposes a `team.yaml` from the catalog for stage
   `discover`, with E2 seats pre-filled `human:ashiq`, heads left vacant until workers exist, and a
   default budget line per seat. *Owner decision 2 (digest approval, REQ-06).*
3. **Vacancy → hire.** When the demand counter hits 3, a hire is proposed: an own agent via
   `agent-scaffold`, or a hired seat via a router row on an `arc-run` driver. Either way the candidate
   runs the role's fixtures on bench first — the interview — and the card, the fixture verdict and the
   seat change land in one proposal branch (REQ-09, REQ-11).
4. **Team → install.** `sync-to-project <venture-dir> --team <venture>` installs exactly the staffed
   seats (REQ-07). The venture repo now has its people.
5. **Heartbeat → work.** `org-dispatch` wakes daily, reads stage + spine, proposes ≤7 jobs with goal
   ancestry, skipping budget-capped seats. The owner accepts or rejects each; accepted jobs run through
   the existing commands and processes, and their receipts are placed on a role by the attribution map
   (ORG-D). Worker artifacts go to the head as `handoff.ready`; blocked ones go to `escalate_to`.
   Wanted-but-vacant roles tick the demand counter.
6. **Month → review.** `org review` scores every staffed seat from its receipts — runs, accepts,
   rejects, incidents, **cost** — and proposes keep · promote · retrain · retire; three demands on a
   vacancy propose a hire. *Owner decision 3.*

---

## Phases (risk-ordered; appetites are ceilings)

**The cycle ends at P03.** Hiring for the 25 vacancies is deliberately *outside* it — that is
throughput pulled by the demand counter, and a cycle that ends when every seat is filled has no end.

| Phase | Capability | Appetite | Why here |
|---|---|---|---|
| **P00** | **The catalog + its gate.** Role-card schema incl. `origin` / `hire` / `produces` / `consumes` / `escalate_to` / `fixtures`; 71 cards (vacant ones included); `org-coverage.mjs` importing `face-coverage` walkers, with `--mutant-selftest` covering REQ-01…04, 11, 13 and the head-needs-workers rule (ORG-I, J, N, O, Q); generated org chart with own/hired counts; blueprint §4 → pointer. | 2.5 d | Highest risk: every later phase reads this shape. A wrong schema surfaces in P03 and costs the cycle. The +0.5 d is the four new fields and their three coverage checks. |
| **P01** | **Attribution + scorecard.** The attribution map over today's actors / processes / kinds (ORG-D); `org review --role` deriving runs / accepts / rejects / incidents / **cost** with `--audit` (REQ-05, REQ-12 read side, ORG-D, ORG-P). | 1.5 d | Second-highest risk: this *is* the "real employee" claim. An org whose seats cannot be measured is decoration. |
| **P02** | **Staffing.** `team.yaml` schema incl. `heads:` and per-seat `budget` + digest governance (REQ-06); `sync-to-project --team` golden (REQ-07); pilot team staffed (ORG-L); hire path wired to role cards **with the bench interview** — fixtures written for the pilot's staffed roles only, one hired-seat dry run through `generic-api` if a driver is reachable, otherwise recorded as unproven (REQ-09, REQ-11, ORG-N); pilot chain's `produces`/`consumes` schemas (ORG-Q); three skills (ORG-H). | 2.5 d | Low risk once P00/P01 hold — every mechanism reused (`venture-register`, `agent-scaffold`, bench market, `ledger.criteria` pattern). The +0.5 d is fixtures + one interview run. |
| **P03** | **The COO + the review loop.** `org-dispatch` deterministic script-job on a scheduler heartbeat, proposals only, queue cap, vacancy counter, stage criteria, **budget-cap skip** (ORG-E, ORG-F, ORG-P, REQ-10, REQ-12); five pilot days (REQ-08); first `org review` run; retro and seal. | 2 d + 5 elapsed | Last because it consumes everything; the five live pilot days are the proof and are elapsed time, not effort. |

**Planned 8.5 d effort + 5 elapsed pilot days · cap 10 d effort · 1.5 d slack.**

### Kill checkpoint — read at day 3, not at the 50% mark

Day 3 lands inside P01 and asks one question: **does the attribution map place real receipts from
today's live spine on at least three seated roles, so their scorecards read something other than
`no evidence`?** It must work on *today's* actors (`arc-event`, `arc-leads`, `scheduler:*`) because no
emitter has changed yet and no pilot is staffed until P02 — which is exactly why the map comes before
`payload.role`. If fewer than three roles can be measured, the premise that roles can be managed like
employees is unproven, and the cycle STOPs with that finding recorded. A company layer whose people
cannot be measured is a slide deck — and this repo has already shipped an organ that is "fixture-proven,
unexercised" three times (policy, evolve, ledger).

---

## No-gos (v1)

- **No standing agents.** Nothing runs in a loop. Heartbeat → proposals → human → on-demand spawn → gone.
- **No agent-to-agent conversation.** Handoffs are artifacts and receipts (`handoff.ready` exists).
  No manager-agent delegating to worker-agents — a head **judges** artifacts, it never briefs a worker (ORG-O).
- **No execution by the dispatcher.** L1 means propose. Rising is a policy-ladder decision, not this cycle.
- **No new spine kinds** unless P01 proves one necessary (ORG-C) — then a vocab ADR, never silently.
- **No mass hiring.** No vacancy is filled in this cycle except those the pilot pulls through the demand
  counter (ORG-B).
- **No seat calls a model directly.** Own or hired, the engine (`arc-run` + router tier) is the only door;
  a role card naming a model string instead of a tier FAILs (ORG-N).
- **No unvetted external seat.** A hire without `capability-scout` vetting and a fixture verdict never
  reaches `staffed` (REQ-11).
- **No process rewrites.** The 13 `process.yaml` files keep naming agents; the `role:` slot is v2 (ORG-R).
- **No generated agent files.** Role cards bind; they do not rewrite `.claude/agents/` (RH-3).
- **No face ring before the generator.** Org chart renders as plain markdown/JSON first; the face room
  is a later cycle and arguably the `face` lane's.
- **No "agent payroll" theatre.** Budgets are token caps read from existing cost receipts, not simulated salaries.
- **No model-authored role card ships unreviewed.** Drafting assistance, human accepts line by line —
  a card carries the company's authority about who may do what.

---

## Rabbit holes (named detours)

**1. "Hire everyone now — 25 vacancies, 25 new agents."** — *the one that would sink it.*
It looks like progress and it is the exact failure the blueprint's §5 and the 2026 evidence warn about:
thin agents nobody calls, ~15× tokens when they are called, and a roster that rots faster than it is
used. The demand counter exists so that **the venture hires, not the plan.** Cheap hired seats make
this hole *more* tempting, not less — the fixture interview is the second lock.

**2. The org-chart delegation tree.** A CEO-agent that briefs a CTO-agent that briefs an engineer-agent
reads beautifully on a diagram and loses accuracy at every hop. arc's CEO is a human, its COO is a
proposal process, its heads are judges, and everyone else is a specialist spawned for one task.

**3. Generating `.claude/agents/*.md` from role cards.** Tempting for single-source purity; it rewrites
30 working files, drags ADR-0201's generated-file machinery into every agent, and risks the council's
hardened prompts. Bind first; generate only if drift is *measured* after a cycle of use.

**4. Perfect KPIs, fixtures and schemas before any run.** Write KPIs, fixtures and handoff schemas for
the pilot's staffed roles, run five days, fix the grammar from what broke. The other cards may carry
`kpi: pending`, `fixtures: pending` — recorded absence, rendered.

**5. Folding council/kickoff hardening into this cycle.** Their gaps (0 scored verdicts; 8 WARN-trial
gates) are real and belong to their own lanes. This cycle only *consumes* them — `council-consult` is a
wrapper, not a rewrite.

**6. Hiring the tool instead of the idea.** Paperclip is a Node server + React UI with its own org
store; installing it would put a second spine beside arc's. CrewAI would put a second process runner
beside `arc-run`. Every mechanism worth having from them fits in a YAML field on a card that arc's
existing organs already read. The moment a dependency on one of them appears, this hole is open.

---

## Assumptions ledger (cap 8 — each with a falsification trigger)

| # | Assumption | Falsified when |
|---|---|---|
| A-01 | The kinds newly staffed roles emit accept an extra `payload.role` field. | A kind's validator rejects unknown payload fields → that kind is attributed by the map alone; `validate.mjs` is still not touched (ORG-C). |
| A-02 | Each of the 30 agents maps to ≥1 catalog role without inventing roles. | More than 3 need a role not in the chart → the catalog grows, each addition recorded; the chart above is not sacred. |
| A-03 | An `approval.requested` profile can govern `team.yaml` with zero new kinds (ADR-1017 precedent). | The digest pattern cannot express per-stage edits → one ADR for a finer profile, still zero kinds. |
| A-04 | `org-dispatch` registers as a script-job (with its `job_stub`) that `jobs-lint` and `policy-lint` accept at ₹0, adding no policy subject. | Either lint refuses → the fix is a reviewed diff to `hq.jobs.yaml` / `hq.policy.yaml` citing ADR-0504; `job:` subject prefixes stay forbidden and the INR ceiling is never raised to make it fit. |
| A-05 | Nilluvai (ORG-L) is registered and approved before P02 starts. | Not registered by the end of P01 → the cycle pauses there with P00–P01 banked; no substitute pilot. |
| A-06 | The owner accepts ≥ 50% of dispatch proposals over five days. | Below 50% → the dispatcher stays L1, the misses are classified in retro, and REQ-08 is reported **failed**, not re-scoped. |
| A-07 | `face-coverage.mjs` exports stay stable during the cycle (face v2 is live). | Face Cycle 16 changes them → coordinate at kickoff; add any missing walker *there*, not here. |
| A-08 | The bench market can run a role's fixture set as an ordinary bench event and record a human verdict, with no new event type and no router row written (ADR-0912 / ADR-0220). | Bench needs a new event shape for role fixtures → the interview is recorded by hand in P02 (`decision.recorded`, profile `org.role`) and the bench change is a bench-lane item; REQ-11 still holds through the hand record. |

---

## Pre-mortem — top 6, seeded from this repo's own history

1. **The org chart becomes decoration** — cards written once, read never.
   *Mitigation:* cards are *inputs to machines* (coverage, dispatcher, review, sync, bench); a card no
   machine reads is caught by the day-3 checkpoint.
2. **A hiring spree** — someone fills vacancies to make the chart look green, now with cheap external
   seats.
   *Mitigation:* ORG-B's demand counter; REQ-09 makes every fill a reviewed hire; REQ-11 makes every
   fill pass an interview.
3. **The dispatcher floods the inbox** and the CEO's day disappears.
   *Mitigation:* queue cap 7, REQ-10 measured from the spine, A3 as the stated test.
4. **Two truths about who does what** — role cards say one thing, agent frontmatter or router rows another.
   *Mitigation:* ORG-J bidirectional coverage importing the same walkers; tier on the card must be a
   router tier ADR-0069 names; a hired seat's driver must be one `arc-run` knows.
5. **E2 leaks through a friendly role** — "launch PR" quietly posts under Ashiq's name.
   *Mitigation:* ORG-I FAIL-FROM-BIRTH, mirroring `ungrantable_actions`; mutant in REQ-03.
6. **The head-judge doubles cost and latency** — every cheap worker run is followed by an Opus review,
   and the weekly Claude quota goes in three days.
   *Mitigation:* ORG-O — the head reads only `handoff.ready` artifacts, never every run; ORG-P's budget
   line on the head seat caps it; `org review` prints the head's cost beside its workers' so the ratio
   is visible.

---

## External evidence (checked 2026-09-29; re-check at kickoff)

- **Hub-and-spoke survived production; peer-to-peer agent teams collapsed.** Orchestration (a lead
  agent with parallel subagents) is the pattern that held across research, equity-research and support
  systems; relay chains of agents that add no fresh information lose accuracy at each hop (reported
  90.7% → 22.5% across relay stages). — Lanham, *Multi-Agent in Production in 2026: What Actually
  Survived* (medium.com/@Micheal-Lanham).
- **Paperclip** (agencyenterprise/paperclip-ai, open source) — org chart with titles and reporting lines,
  heartbeat wake-ups, goal ancestry on every task, monthly budget per agent that stops it atomically at
  the cap, board-style approvals with versioned config, and "any agent, any runtime, one org chart — if
  it can receive a heartbeat, it's hired." arc takes goal ancestry, heartbeats, the budget breaker
  (ORG-P) and the bring-your-own-runtime hire (ORG-N, through `arc-run`), and refuses its CEO → VP →
  worker delegation. Its own limits: no single-agent use, provider switch needs agent redesign.
- **CrewAI** — Crews (agents collaborating) vs Flows (deterministic, event-driven). arc's processes are
  already Flows; Crews are the refused conversation pattern. Nothing installed.
- **MetaGPT / ChatDev** — "Code = SOP(Team)": roles exchange structured artifacts (PRD → design → code),
  never free chat. Taken as `produces` / `consumes` + `handoff.ready` (ORG-Q).
- **OpenClaw / Hermes** — skills as files, a public skill registry (ClawHub, 13k+), an agent that
  extracts solutions into reusable skills. The registry is v2 supply (`arc skill import`, ORG-R); the
  self-extraction belongs to the evolve lane, not org. ToxicSkills (36% of sampled public skills
  unsafe) is the named threat model for any import.
- **Relevance AI / TeamDay / Lindy** — confidence-based autonomy, named "characters" on missions,
  workflow graphs. All already exceeded by L0–L3 + earned cap, the scheduler and processes; nothing
  taken. Their reviews converge on one failure: unpredictable, credit-based spend — which is why ORG-P
  reads real `cost.incurred` and stops at a line the owner set.
- **Cost and reliability math** already recorded in the blueprint's §7: multi-agent ≈ 15× single-chat
  tokens; 90% per step over five steps ≈ 59%.

## Gates at kickoff (checked in-file before the prompt is pasted)

- Owner ruling on the spine as `decision.recorded` (Phase 0's first act), cited by every kickoff ADR
- WIP line read (ADR-0052 — informational; 7 lanes LIVE on 2026-09-26) and acknowledged
- **Century 1600 claimed** per `PORTFOLIO.md`, swept across sibling worktrees; board's stale docs-band row noted
- **Nilluvai registered** through `venture-register` and its approval decided (ORG-L) — or the owner accepts that the cycle pauses after P01
- **ORG-M answered** — `products/org` vs `hq` (drafting recommendation: `products/org`; `hq` is at 74 scripts and the org is a company organ like ledger)
- `face-coverage.mjs` exports confirmed present and unchanged since 2026-09-29 (A-07)
- Bench market confirmed able to run a fixture set with a human verdict and no new event type (A-08) — or the hand-record fallback accepted
- Adjacent check: the one router hire `build-in-public-draft` expired 2026-08-31 — its rejustify-or-retire
  decision is taken before P00 so the catalog's social seat is written against the truth
- Adjacent check: whether `generic-api` is reachable (ADR-0914 revisit) — decides whether P02's hired-seat dry run is real or recorded unproven

---

## Note on the model question (kept separate on purpose)

**v1 needs no model.** The dispatcher is stage-criteria and budget arithmetic and the monthly `org
review` is receipt arithmetic — neither is judgment, and both run at ₹0 under `hq.jobs.yaml`'s ceiling.
The roles themselves keep the tiers their agents already declare (ADR-0069); a hired seat declares a tier
too and gets its concrete model from `router.yaml` like everyone else — **the org never names a model
string.** If a later cycle wants model-written proposals, that is a router class `org-dispatch` added by
reviewed diff citing ADR-0069, an owner decision raising `monthly_ceiling_inr`, and any cheaper-model
attempt run first as `--trial-model` under **ADR-0220** — no router row written, `model_source: trial`
on the receipt. The head-judge / cheap-worker split (ORG-O) is the same law seen from the org side: which
family sits in which tier is ADR-0069's question, and the org only says which *tier* a seat binds.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (after the gates above clear)

> Read `docs/strategy/plans/PLAN-org.md` end to end before doing anything, then run
> `/arc-kickoff "arc's company layer: every role a card, every venture a staffed team, a dispatcher that
> proposes the next jobs, and a review that scores every seat from its receipts" --lane org`.
>
> Write PLAN.md and PROGRESS.md, then **stop and wait for my approval before any code.**
>
> These are locked and must appear in the PLAN you write:
>
> 1. **ORG-A** — the role card binds existing agents / skills / scripts / processes / router tier; it
>    never rewrites `.claude/agents/*.md`.
> 2. **ORG-B** — all 71 roles get cards in P00, vacant ones included; vacancies fill only after three
>    dispatcher demands. No mass hiring.
> 3. **ORG-C / ORG-D** — zero new spine kinds; `validate.mjs` untouched; the `actor` field is never
>    rewritten — attribution is the map, then `payload.role`. A needed kind is a vocab
>    ADR with its `GROUPS` row in the same commit.
> 4. **ORG-E** — the dispatcher is a deterministic script-job at ₹0: proposals only, goal ancestry on every one, queue cap
>    7, scheduler heartbeat, budget-capped seats skipped, no agent-to-agent calls.
> 5. **ORG-I / ORG-J** — `org-coverage.mjs` is FAIL-FROM-BIRTH with `--mutant-selftest`, imports its
>    walkers from `.claude/scripts/core/face-coverage.mjs`, and FAILs any E2 role seated by an agent.
> 6. **ORG-N** — a seat's `origin` is `own` or `hired`, nothing else; a hired seat names an `arc-run`
>    driver and a router tier, is vetted by `capability-scout`, and is staffed only in the same branch
>    as a bench run over the role's `fixtures` with a human verdict (REQ-11). No seat names a model string.
> 7. **ORG-O** — a department head is a judge, never a relay: the dispatcher proposes to workers
>    directly; the head reads `handoff.ready` and emits `review.completed`; a head seat is proposed only
>    over ≥2 staffed workers, coverage FAILs otherwise; head = `high-judgment`, workers cheaper tiers.
> 8. **ORG-P / ORG-Q** — per-seat `budget` in the team manifest read from `cost.incurred` (zero kinds),
>    over-cap = stop-and-propose; every card declares `produces` / `consumes` / `escalate_to`, and
>    coverage FAILs an unproduced consumed kind (REQ-13).
> 9. **ORG-R** — the process `role:` slot, `arc skill import`, head-judge emission and the hire-to-own
>    command are v2. Do not build them; record their triggers.
> 10. Phase order is catalog+gate → attribution+scorecard → staffing → dispatcher+review. Do not reorder.
> 11. The **day-3 kill checkpoint** question is: *does the attribution map place today's live-spine
>    receipts on at least three seated roles?* If not, STOP and record the finding.
> 12. **ORG-L** — the pilot is Nilluvai, registered through `venture-register` before P02; arc itself is
>    never the pilot (`venture-register.mjs:73`). If it is not registered, the cycle pauses after P01.
> 13. **ORG-M** (`products/org` vs `hq`) is yours to answer in the PLAN, recorded as an ADR.
> 14. Claim ADR century **1600** from `PORTFOLIO.md`, **after sweeping sibling worktrees**.
>
> Appetite: 8.5 days effort + 5 elapsed pilot days, 10 cap.

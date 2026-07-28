# PLAN — arc-develop · "The Developer" (the execution harness — arc's `develop` product)

> Written 2026-07-28, grounded against the repo during Cycle-2 Phase-04 dogfood.
> **Status: kickoff-grade, FROZEN (review-freeze v5).** Consolidated over 4 external
> review rounds, every point adjudicated (history: Appendix A; rejected ideas: §11).
> Attack this plan at kickoff, don't re-litigate the record — attack-panel /
> plan-simulator findings mutate the PLAN it produces, not this file. Post-v1 growth is
> governed by the Feature Admission Rule (§2, rule 5).
> Decisions are named **DEV-A…DEV-K** below (presented in execution-flow order; letters
> kept stable across the review rounds) and get real ADR numbers at kickoff from the
> next free slot (pack convention — see `../README.md` correction #2).
> Recommended appetite: **M-tier** (final number = owner's call at kickoff step 1).
> Built via `/arc-kickoff` using the paste-ready prompt in Appendix B.

**Product promise:** `/arc-develop` turns an approved phase into small, spec-anchored,
independently **proven** increments, with visible progress and controlled escalation.

**Identity:** an execution harness, not "an agent that develops." The main session writes
the code; `develop` supplies context, discipline, checkpoints, and evidence.

---

## 1 · Why this product exists

Arc's product line today:

| Stage | Owner | Protection |
|---|---|---|
| Intent (plan) | `plan` — `/arc-kickoff`, `/arc-change` | attack panels, simulation gate, kickoff-lint |
| **Execution (build)** | **nobody** | advisory CLAUDE.md rules only |
| Outcome (inspect) | `review`, `qa` | code-reviewer, audits, QA — after the fact |

`plan` = architect. `review`/`qa` = independent auditor. The execution loop between them —
the longest, most expensive stretch — has no owner. Council v2+v3's measured cost of that
gap: **43 real holes in code that looked correct and passed its own tests.** `develop` is
the engineering operating system that owns the middle.

## 2 · Doctrine and governing rules

1. **Anchored creation** — the main session writes the code. No separate coder subagent,
   ever: a subagent loses the plan context that makes code correct.
2. **Unanchored verification** — fresh agents, blind to the author's reasoning, attack
   the work (spec-fidelity checkpoints, learning-candidate evaluation).
3. **Deterministic gates** — scripts decide; prose assurances don't count
   (develop-lint, path-glob risk triggers, ceilings, marker lint).
4. **Computed or earned, never self-declared** — every number in this product is either
   computed by a tool (complexity delta, dep count, churn) or earned from scored outcomes
   (prediction calibration, dogfood metrics). A number the model invents about itself
   ("confidence 87%", "~6 months maintenance") is lint-rejected in ledger rows.
   *(Noted as a candidate for arc-wide doctrine — that adoption is owned by
   `plan`/`council`, not here.)*
5. **The Feature Admission Rule** — after v1 ships, The Developer gains new features,
   gates, or layers through exactly one route: its own Learning System promotion loop
   (candidate → evidence it reduces escaped defects or rework → Ashiq promotes). Review
   suggestions from any source become candidates, not plan edits. This plan is the
   review-freeze version: further pre-build reviews may correct errors; expansion ideas
   queue as candidates.

## 3 · Product shape

- **Product:** `develop` (requires `core`; composes with `plan`, `review`, `qa` when installed)
- **Command:** `/arc-develop <mode> [phase]` (+ `/arc-capability`, expansion)
- **New agents:** `spec-fidelity` (v1) · `capability-scout`, `pattern-miner` (expansion)
- **Reused agents:** `log-analyzer` (stuck protocol) · `design-critic`/`design-reviewer`
  (UI checkpoints) · `researcher` (docs verification)
- **Scripts:** `scripts/develop/develop-lint.mjs` (v1) · `stuck-counter.sh` (v1.1) ·
  `capability-vet.sh` (expansion)
- **Runtime state:** `.claude/state/develop/` (stuck counters, fingerprints, capability cache)
- **Non-goals:** no coder subagent · never closes phases (`/arc-phase-done` owns that) ·
  never intakes scope (`/arc-change` owns that) · never re-implements review/design logic
  (develop scripts may CALL them) · no autonomous capability installs.

### Runtime stance
Arc is **Claude Code–primary today**. Durable project artifacts are host-neutral
(`phases/`, `docs/`); runtime integration remains `.claude`-native until explicit
Claude/Codex adapters exist (`.codex/` is an early multi-tool experiment, not a peer
runtime). Cross-runtime adapters = future ADR at the public/SaaS milestone.

### Durable source of truth

| Artifact | Where | Nature |
|---|---|---|
| Build Brief (incl. predictions) | header of `phases/phase-NN-tasks.md` | committed, versioned |
| Slice ledger (slices, proofs, tiers, evidence, micro-decisions) | `phases/phase-NN-tasks.md` | committed, machine-readable (lint-parsed) |
| Debt ledger | `docs/develop/debt-ledger.md` | committed |
| Learning ledger (tagged + linked) | `docs/develop/learning-ledger.md` | committed |
| Evaluation suite fixtures | `tests/fixtures/develop-evals/` | committed |
| Receipts (`develop.started`, `slice.done`, `slice.stuck`, …) | existing spine (`arc-event.sh emit`) | durable, append-only — **audit telemetry, not the sole truth** |
| Stuck counters, capability cache | `.claude/state/develop/` | local runtime, disposable |
| Chat output | — | a readable VIEW of the above, never the truth |

## 4 · Lifecycle — multi-session by design (v1)

- **`/arc-develop start <n>`** — validate inputs (plan approved, spec exists, kickoff-lint
  green; refuses on a drifted plan) → build the Build Brief → decompose the spec into the
  slice ledger.
- **`/arc-develop next`** — select the next unproven slice (ordering rules, §5.2) →
  assemble its Context Pack → run the slice loop.
- **`/arc-develop status`** — read-only reconstruction: position, slice progress,
  blockers, stuck state, last receipts. Works cold after any context reset.
  (`/arc-resume` links here when a develop run is active — resume is session-level,
  status is phase-interior; one owner per job.)
- **`/arc-develop checkpoint`** — run fidelity + health checks now (also auto-triggered, §7).
- **`/arc-develop handoff <n>`** — score the Build Brief predictions, run the mandatory
  spec-fidelity pass, assemble the evidence pack (proofs + tiers + debt summary) for
  `/arc-phase-done <n>`. Develop never closes the phase.

## 5 · The execution core

### 5.1 · DEV-A — Build Brief · Context Pack · Predictions (v1; retrieval deepens later)

**Build Brief** (`start`, deterministic): this phase's REQs + non-negotiables + no-gos +
relevant ADRs + assumptions → blast radius from the code graph (Graphify/codegraph; grep
fallback, stated) → ≤1-screen brief written into the ledger header. Brief stale vs spec
(mtime/hash) = lint failure. What Ashiq sees = what the build runs on.

**Context Pack** (`next`, per slice — world-class execution wins on context retrieval,
not process). Assembled from EXISTING memory owners (no new graph infrastructure):

```
requirement
  → code-graph neighborhood of the files touched
  → matching ADRs (index scan)
  → tagged learning-ledger / retro-log hits
  → related past-bug fixtures
  → highest-churn files in the blast radius (git log frequency — computed)
  → the slice
```

Where matched records carry typed links (§8.4), the pack follows them **one hop**
deterministically — an auth slice pulls the auth-area learnings and, through their links,
the specific ADRs, rules, and fixtures past auth failures produced. Retrieval sources are
listed in the ledger row.

**Prediction block** (brief footer, cheap and compounding): most likely failure mode ·
most likely regression site · riskiest file · expected blockers · expected proof
failures. Scored at `handoff` (hit / miss / unforeseen). **This is where confidence comes
from — calibration earned over time, never self-declared scores.** Misses and unforeseen
events feed §8 as learning candidates.

### 5.2 · DEV-E — Proof-first Slice Engine (v1)

Spec → slice ledger, **risk-ordered with sequencing heuristics** (risk primary;
tiebreakers stated, not scored: unlocks-later-work · reduces-unknowns-first ·
file-overlap adjacency. No numeric "value score" — a ranked list with reasons beats
invented numbers). Per slice:

1. **Micro-plan** (2–3 lines) — including the standing Execution-Intelligence questions:
   *simpler solution? reuse existing code? does this need to exist at all?*
   (REQ-level existence questions route to `plan`/`/arc-change` — not re-owned here.)
2. **Approach sketches** — risk-triggered slices only (§7 globs): 2–3 approaches,
   ~10 lines each — approach · trade-offs · blast radius · **economics** — pick one,
   record pick + rejected-because as a micro-decision line. Sketch-level comparison,
   never parallel full implementations.
   **Economics fields (qualitative + computed proxies only):** maintenance burden in
   words ("touches 3 call sites, no new pattern") · operational surface as counts
   (deps/services/config added — computed) · **deletion opportunity** ("what does this
   let us delete?"). Invented cost durations are banned; long-run economics are earned
   from §8 outcome data (stuck-time per area, churn, debt pay-down records).
3. **Declare the acceptance proof BEFORE implementation.** Proof types: unit/contract
   test · Playwright assertion · build/typecheck proof · migration up-down verification ·
   visual render + accessibility check · demo output vs expected · declared performance
   budget (only when the phase/REQ names a perf constraint). **"Proof: none" is invalid** —
   a slice that can't state its proof isn't a slice yet.
   **Evidence strength tiers** (recorded per proof):
   `static < unit < contract < integration < E2E/visual < verified-in-real-place`.
   Deterministic handoff rule: a REQ's strongest evidence must meet its type's floor
   (external-dep REQ ≥ contract-against-real · UI REQ ≥ visual) — lint-checked, WARN-first.
4. **Implement** (main session — anchored creation).
5. **Run the proof, paste output.** Evidence over assertion.
6. **Tick the ledger row** (proof type + tier + command + result + context sources) ·
   spine `slice.done` receipt · statusline `phase 02 · slice 4/9`.

Offline-first unchanged: external deps get interface + fake first; real impls stay behind
the adapter.

### 5.3 · DEV-F — Design integration (v1 sliver; expansion checkpoints)

- **v1 sliver:** any UI slice's proof includes a visual artifact (screenshot/render) +
  basic accessibility check — proof-first applied to UI.
- **Expansion:** full `design-critic` gate at meaningful checkpoints only — new route ·
  new component family · changed interaction model · pre-handoff — reusing
  `scripts/design/*` (delegate, never duplicate). Not a serial blocker per tiny slice.

## 6 · Safety systems (v1.1)

### 6.1 · DEV-H — Stuck Protocol

Track per slice: **error fingerprint** (normalized) + **attempted hypothesis** + elapsed.

- **Primary signal:** the same fingerprint recurs with no new evidence-backed hypothesis →
  root-cause mode (`log-analyzer`: read the actual error and file, build a minimal repro,
  THEN fix). Three failures fixing three different causes is not flailing; one failure
  three times with recycled guesses is.
- **Deterministic backstops** (hypothesis novelty is claimable, so a floor holds):
  same fingerprint 3× → forced root-cause regardless · ≥5 total attempts on one slice →
  escalate to Ashiq with a one-screen diagnosis (tried / current hypothesis / options).
- Every stuck event → spine `slice.stuck` (retro sees where builds bleed time).

### 6.2 · DEV-I — Fidelity checkpoints + deterministic floor

**v1 minimum:** one mandatory `spec-fidelity` pass at `handoff` — fresh context, reads
ONLY spec + diff: built-what-spec-says? scope creep? exit-criteria drift? non-negotiables
intact? Its report also states changes in **user-visible-behavior terms** ("login flow
behavior changed", "cache policy changed") — a semantic-diff narrative by prompt, not a
diff engine.

**v1.1 risk-triggered checkpoints:** immediate checkpoint when a slice's diff touches
deterministic risk globs — `rules/security-sensitive.md` paths (reused) · migrations ·
auth · public-API surface files — **plus a hard ceiling backstop:** ≥5 slices since the
last checkpoint → forced; always before handoff. Risk is path-matched by script, never
self-assessed.

**Checkpoint health checks** (develop-lint, all WARN-first — architecture guardianship as
scripts, not a standing agent): circular-dependency check (madge/dep-cruiser) ·
complexity/coupling **delta** vs last checkpoint (deltas, not absolutes) · **public-API
surface diff** (exported signatures / route table vs phase start) · contract-test diff
for owned external deps · perf-smell scan (N+1 patterns, unbounded loops) on touched
files. The judgment half — *is the architecture conceptually degrading? over-engineered?
can anything be deleted?* — belongs to the spec-fidelity checklist, unanchored.

Gate-like code built in a phase (lints/parsers/validators) additionally gets the
mandatory adversarial construct-a-breaking-input pass (existing CLAUDE.md rule), findings
pinned as fixtures.

**develop-lint floor (v1):** ticked slice without declared proof or evidence line → FAIL ·
brief missing/stale → FAIL · ledger unparseable → FAIL · self-declared numbers in ledger
rows → FAIL.

### 6.3 · DEV-K — Technical Debt Ledger

Intentional shortcuts are debts; unrecorded debts are forgotten forever. Every deliberate
compromise — temporary fix · known issue · accepted TODO · deferred cleanup · performance
compromise — gets a row in `docs/develop/debt-ledger.md`: what · where · why accepted ·
cost of leaving it · pay-down trigger. **Deterministic enforcement:** develop-lint greps
the slice diff for TODO/FIXME/HACK/XXX markers — a new marker with no ledger row = WARN
(trial route to BLOCK). `handoff` includes the phase's debt summary; `/arc-retro` reads
the ledger and the appetite conversation decides pay-down. Deferred suggestions (§7.3)
also land here — deferral is a debt, not a deletion.

## 7 · Intelligence layers (expansion)

### 7.1 · DEV-B/C — Capability acquisition (triggered service, not mandatory preflight)

Runs only when the Build Brief declares a capability gap or a dependency is stale — or on
explicit `/arc-capability`. The `capability-scout` searches the live ecosystems — skills
registries (`npx skills` / agentskills.io / mcpmarket), the MCP registry (Context7,
Playwright, shadcn, Supabase, Figma, …), community agent definitions — and returns a
**Capability Proposal table**: need → candidate → source → quality evidence → verdict.

**Vetting gate (`capability-vet.sh`, BLOCK):** allowlist + **pinned version + hash +
provenance** recorded in `capability-lock.json` · content scan of the skill/MCP
definition itself (exfil patterns, curl-pipe-sh, undeclared tool scopes) · least
privilege · **write-capable MCPs require explicit Ashiq OK**. Stars/repo-age = advisory
context only, never a pass criterion. Lint blocks any capability used without a PASS row.
Same-stack reuse via the lockfile; staleness re-check after 30 days.

### 7.2 · DEV-D — Pattern mining (decision-triggered)

Mirrors kickoff's research gate: runs only for genuine product/UX/architecture/
external-API decisions inside the phase — never ambient "trend research." Max 3 parallel
`pattern-miner` agents. Source hierarchy: **primary documentation > engineering blogs of
the products studied > teardowns > trend commentary.** External API usage verified
against current docs (Context7) with versions. Output: ≤20-line **Pattern Annex** on the
brief — every row = source + **adopted/rejected with reason** (a row without a decision
is lint-invalid).

### 7.3 · DEV-G — Suggestion engine

The Developer advises like a senior, but suggestions batch at slice boundaries only.
Each carries: evidence · the same economics fields as sketches (qualitative + computed,
no invented durations) · a default, so "skip" costs one word. NEVER coded ad-hoc —
routed via spec-note / `/arc-change` / ADR (existing change discipline, applied to the
harness's own ideas). Standing questions it keeps asking: *easier solution? over-
engineered? can this be deleted? can this reuse existing code? will this survive?*

## 8 · DEV-J — The Learning System (expansion machinery; contract binds from v1)

Metrics and retrospectives don't make a system self-improving — a controlled
learning-and-evaluation loop does.

### 8.1 · The contract (non-negotiable)
> The Developer may learn from failures and outcomes, but may NEVER silently modify its
> own policies, gates, skills, or trusted capabilities. Every improvement is proposed,
> evaluated against regression fixtures and a retained holdout, then promoted or rejected
> by Ashiq with recorded evidence.

### 8.2 · The loop
```
real phase outcome
  → failure / delay / escape classification
  → learning candidate (authored in-session — anchored creation)
  → replay against known fixtures + withheld-set evaluation
      (run by a FRESH unanchored agent — the author never grades its own candidate)
  → Ashiq-approved promotion (trial count / retro talk / confidence NEVER promote alone)
  → versioned rule | fixture | checklist | template | skill | capability policy
      (a git commit — versioned and rollbackable by construction)
  → forward measurement: did subsequent phases actually improve?
```

### 8.3 · The learning record
`docs/develop/learning-ledger.md`, one row per candidate: what failed/escaped · why the
existing process missed it · proposed reusable prevention · type (rule/fixture/checklist/
template/skill/capability policy) · which historical cases it catches · cost (false
blocks, added time) · verdict (promoted / rejected / rolled back) + evidence link.
"We had a retro" is not a record.

### 8.4 · Linked records — the root-cause graph as cross-references, not an engine
Isolated records don't compound; linked records do. Every learning row, debt row, and
fixture carries **typed link fields** over arc's existing IDs:
`area:` (controlled vocabulary — auth · data · api · ui · infra · build) · `adr: NNNN` ·
`rule: <file>` · `fixture: <path>` · `phase: NN`. That encodes the causal chain
(bug → root cause → area → ADR → rule → fixture → future phases) as committed,
host-neutral markdown — no graph database, no new owner. Lint nudges: a learning row with
zero links = WARN. Links are claims — the unanchored evaluator verifies them at
promotion. The Context Pack follows links one hop; eval-suite seeding writes link fields
from day one, so the graph is populated from the first batch.

### 8.5 · Developer Evaluation Suite
`tests/fixtures/develop-evals/` — council v2+v3's **43 real holes** converted into
categorized replay fixtures: spec drift · false confidence · missing edge cases · bad
gates · UI failures · capability failures · flailing. A new safeguard is promoted only if
it catches relevant historical failures WITHOUT breaking unrelated work (false-block cost
recorded). Where the failing surface is pure logic, the fixture gains **input variants**
(property-based tests) so the class of bug is pinned, not just the instance;
cross-platform/dependency-version replay matrices are an L-tier option.
*Dependency:* conversion draws on council session records; the first batch covers what
those records preserve in reproducible detail.

### 8.6 · Holdout — honest implementation
A cryptographically blind holdout is impossible in a single repo the candidate-authoring
session can read. Blindness is **process-enforced**, three ways: (1) withheld fixtures
live in a directory excluded from candidate-generation context (lint-checked at eval
time); (2) evaluation runs unanchored — a fresh agent receives only the candidate +
fixture results; (3) **time-forward holdout** — the truest test: escaped-miss and rework
rates in phases AFTER promotion vs pre-promotion baseline; a "learning" that doesn't
generalize forward is rolled back (verdict recorded).

### 8.7 · Calibration, memory, staging
- **Calibration:** prediction blocks scored at every handoff accumulate into a real
  record of where The Developer's judgment is trustworthy — council's Brier-ledger
  discipline, finally with data flowing.
- **Memory (no second store):** arc's existing owners (CLAUDE.md/rules · ADRs · retro-log
  · learning ledger · Graphify · claude-mem) stay the memory. DEV-J adds **tags**
  (`pattern` / `anti-pattern` / `library-verdict` / `fix-recipe` / `common-mistake`) +
  links (§8.4) so the Context Pack can retrieve them. Promoted learnings graduate into
  rules/templates/fixtures — their permanent owners.
- **Staging:** design lands whole; machinery grows in steps — ledger + fixtures + manual
  replay first, automated pipelines only after the loop proves its own value. The
  Learning System never delays the steel thread.
- **Boundary:** `/arc-retro` stays the human ritual; the learning ledger is the evidence
  store it reads and writes.

## 9 · Tiering (S/M/L — depth follows appetite, mirrors kickoff)

| Feature | S | M | L |
|---|---|---|---|
| Build Brief + predictions | ✅ short | ✅ | ✅ |
| Slice ledger | optional (≥3 slices) | ✅ | ✅ |
| Proof-first + evidence tiers | ✅ always | ✅ | ✅ |
| Context Pack | basic (graph + ADR) | ✅ | ✅ + 2-hop links |
| Risk-triggered checkpoints | handoff only | ✅ | ✅ |
| Ceiling backstop | — | 5 slices | 3 slices |
| Approach sketches | on request | risk-triggered | risk-triggered |
| Capability scout | lockfile reuse only | triggered | triggered |
| Pattern miner | on request | ≤2 decisions | ≤3 + trend check |
| Design-critic checkpoints | pre-handoff only | ✅ | ✅ |
| Eval-suite replay matrices | — | — | optional |

## 10 · Risks (pre-mortem seeds)

1. **Process tax** — tiering, risk-triggered (not per-slice) checkpoints, checkpoint-only
   design gates, dogfood tripwire with a "lose weight" rule.
2. **Judgment-dodging** — model lowballs risk / claims novel hypotheses → deterministic
   path-glob triggers + ceilings are the floor.
3. **Supply chain** — vet gate BLOCKs; hash+provenance pinning; write-MCP human OK.
4. **Research theater** — decision-triggered mining, primary-docs hierarchy,
   adopted/rejected mandatory.
5. **Harness drift** — boundaries lint; delegate-never-duplicate.
6. **Host lock-in** — Claude-primary today; durable truth host-neutral; adapters = future ADR.
7. **Learning-system failure modes** — self-grading (→ unanchored evaluation) ·
   overfitting to own history (→ withheld set + time-forward holdout) · silent
   self-modification (→ contract + promotion gate) · learning infra outweighing the
   harness (→ staging, its own value measured).
8. **False precision** — self-declared scores read as measurement but are vibes; the
   governing rule + ledger lint reject them.
9. **Discipline decay** — links, debt rows, predictions only work if consistently
   recorded; lint nudges (WARN on linkless/markerless) are the counterweight, and the
   dogfood metrics expose decay (evidence completeness).

## 11 · Rejected ideas registry (recorded so they don't return unexamined)

| Rejected | Because | Adopted instead |
|---|---|---|
| Per-slice self-declared confidence scores (5 axes) | no ground truth behind the numbers | evidence tiers (objective) + prediction calibration (earned) |
| Second "engineering memory" store | duplicate owner over the existing five-layer stack | tags + typed links + Context Pack retrieval |
| Standing Performance Brain | premature machinery pre-PMF; known rabbit hole | declared perf budgets as proofs + checkpoint perf-smell scan · revisit trigger: first real perf SLO |
| Full semantic/behavior-diff engine | research-project scope | API-surface + contract diffs (deterministic 20%) + fidelity behavior narrative |
| Numeric Execution Value Score for ordering | invented number | ranked-with-reasons heuristics |
| Parallel full A/B/C implementations | 3× cost for marginal gain | approach sketches on risk-triggered slices |
| Invented cost durations ("~6 months maintenance") | false precision — same trap as confidence scores | qualitative fields + computed proxies + earned long-run economics |
| Graph engine/database for root-cause links | duplicate owner (Graphify) + heavy infra | typed link fields on existing records + one-hop follow |

## 12 · Gate maturity, dogfood, metrics

**WARN-first, promoted by evidence** (arc's proven v3.5 / v4 F1 mechanism): every
develop-lint gate ships WARN and promotes to BLOCK only via `docs/trial-ledger.md` —
fixture-proven + ≥3 clean dogfood runs + retro sign-off by Ashiq. DEV-J tightens this for
anything learned mid-flight: fixture-proven + withheld-set eval + cost accounting —
clean-run count alone never promotes.

**Dogfood plan:** (1) a fake offline phase proves the machinery runs (Phase 0 exit);
(2) **2–3 real phases** (Cycle-3 / LexOS work) are the **tripwire**, not the proof —
enough to catch ceremony, not enough to claim world-class. World-class is a trendline,
not a launch claim.

**Outcome metrics — defined BEFORE testing, baselined on recent pre-develop phases:**
escaped spec misses · rework/stuck time · time to first independently proven slice ·
**false-block rate** · evidence completeness · **ceremony cost per validated slice**.
Rule: if a gate adds time without reducing escaped misses or rework, it is removed or
downgraded — data decides, not vibes.

## 13 · Delivery order (risk-first; the steel thread never waits)

1. **Steel thread (v1):** lifecycle command (`start/next/status/handoff`) + Build Brief
   with prediction block + basic Context Pack (graph + ADR scan) + durable proof-first
   slice ledger with evidence tiers + spine receipts + develop-lint floor + one
   pre-handoff spec-fidelity pass (scores predictions). Runs end-to-end offline on a
   fake phase.
2. **Safety (v1.1):** stuck protocol + risk-triggered checkpoints with ceiling +
   checkpoint health checks + debt ledger with marker lint + approach sketches (with
   economics) + **seed the Evaluation Suite** (first council-record batch → fixtures
   with typed links from day one; they double as acceptance tests for spec-fidelity and
   develop-lint themselves).
3. **Capability:** triggered scout + allowlist/hash lockfile + vet gate + least-privilege
   policy.
4. **Quality intelligence:** decision-triggered pattern mining + design-critic
   checkpoints + full Context Pack retrieval (tags + one-hop links + churn).
5. **Learning System:** tagged+linked learning ledger + candidate→eval→promotion loop +
   calibration record + suggestion engine + outcome metrics + retro integration.
   **From here on, the Feature Admission Rule governs all further growth.**

Then: dogfood on 2–3 real phases before any gate promotes to BLOCK.

## 14 · Worked example — one slice through the system

Phase 03 of a SaaS build: "session management." Slice 4: *refresh-token rotation*.

1. `next` picks slice 4 (risk order: it touches auth). **Context Pack** assembles: the
   token-service code neighborhood · that build's JWT-strategy ADR · learning row L-031
   ("JWT expiry bug, area: auth") → one hop → Rule `security-sensitive.md`, Fixture-18 ·
   churn note: `auth/middleware.ts` is the hottest file in the blast radius.
2. Slice diff will touch `auth/` → **risk glob trips** → approach sketches: (A) rotate in
   middleware — no new deps, touches hot file · (B) rotate in a new token service —
   +1 module, cleaner seam, lets us delete two helper functions (deletion opportunity).
   Pick B; micro-decision recorded with rejected-because.
3. **Proof declared first:** contract test — expired refresh token → new pair issued,
   old token rejected (tier: contract). Plus fixture-18 replay must stay green.
4. Implement. First run fails; same fingerprint twice (`TokenReuseError`), a second
   hypothesis is evidence-backed, passes on attempt 3 — stuck counter never hits the
   backstop.
5. Proof output pasted → ledger tick (proof, tier, sources) → `slice.done` receipt →
   statusline `phase 03 · slice 4/9`.
6. Checkpoint (auth trigger): health checks pass; API-surface diff shows one new export —
   noted. spec-fidelity report: "matches spec; user-visible change: sessions now expire
   after 30 days of inactivity."
7. At `handoff`: prediction "riskiest file = middleware.ts" scored a MISS (the risk was
   in the token service) → logged; becomes a learning candidate about where auth risk
   actually lives.

Nothing above asked anyone's permission to be smart — and nothing self-certified.

---

## Appendix A · Review history (4 rounds, 2026-07-28)

| Round | Focus | Outcome |
|---|---|---|
| 1 | Structure & scope | execution-harness framing sharpened · MVP tightened · **proof-first** replaced test-first · lifecycle modes + resume · durable-truth table · capability scouting demoted to triggered service · risk-based cadence + ceiling (mod: deterministic globs) · hypothesis-based stuck (mod: backstops) · checkpoint-only design gates |
| 2 | Self-improvement | runtime stance corrected ("Claude-primary, host-neutral artifacts, future adapters") · **Learning System** added with contract, eval suite, two safeguards (mods: staging, process-enforced holdout, unanchored evaluation) |
| 3 | "World-best" (15 suggestions) | accepted: Context Pack · prediction calibration · debt ledger · evidence tiers · checkpoint health checks · approach sketches · EI standing questions. Rejected (registry §11): confidence scores, second memory store, perf brain, semantic-diff engine, value score, parallel implementations. Governing rule crystallized |
| 4 | Final two + weight warning | **linked records** (typed links, not a graph engine) · **engineering economics** (lens + proxies, no invented numbers) · **Feature Admission Rule** codified · v5 declared review-freeze |

Reviewer trajectory: 9.5 → 9.8. The Developer's own verdict: design 9/10; the product's
score is earned in dogfood, per its own doctrine.

## Appendix B · Kickoff prompt (run AFTER this file lands in the repo via PR)

```
/arc-kickoff Build arc's `develop` product ("The Developer") per docs/strategy/plans/PLAN-develop.md —
an execution harness that turns an approved phase into small, spec-anchored, independently proven
increments with visible progress and controlled escalation. v1 = lifecycle command
(start/next/status/checkpoint/handoff) + Build Brief with prediction block (scored at handoff —
calibration, never self-declared confidence) + Context Pack (retrieval over existing memory owners —
no new graph infra) + durable proof-first slice ledger in phases/phase-NN-tasks.md with evidence
strength tiers + spine receipts + develop-lint floor + pre-handoff spec-fidelity pass. Expansion
layers per the plan's delivery order: stuck protocol (fingerprint+hypothesis+backstops),
risk-triggered checkpoints + deterministic health checks, debt ledger with marker lint, approach
sketches with economics fields, eval-suite seeding with typed links, triggered capability scout +
vet gate + lockfile, decision-triggered pattern mining, design-critic checkpoints, Learning System
(tagged+linked ledger, unanchored evaluation, withheld + time-forward holdout, Ashiq-only promotion).
Learning contract binds from v1: no silent self-modification of policies/gates/skills/capabilities.
Post-v1 growth obeys the Feature Admission Rule: new harness features enter only via the promotion
loop with evidence they reduce escaped defects or rework. All gates WARN-first, promoted via
trial-ledger + retro. Governing rule: every number is computed or earned, never self-declared.
Runtime stance: Claude Code-primary, host-neutral durable artifacts, future adapters.
Appetite: [Ashiq sets — recommend M]. Phase 0 = steel thread running end-to-end offline on a fake phase.
```

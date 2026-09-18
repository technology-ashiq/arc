# PLAN (design source) — `docs` v1: arc's own reference, generated and complete by construction

> **Trigger FIRED — owner ruling, 2026-09-18.** A wiki over every product, lane and feature where
> nothing is missing, and where anything newly born appears without anyone remembering to add it.
> The ruling goes on the spine as a `decision.recorded` in Phase 0 and every kickoff ADR cites it,
> the same pattern the Build-out Mandate set.
>
> **Landed** 2026-09-19 (owner-instructed). Decisions **DOC-A…K locked**, **DOC-L open by design**
> and decided at kickoff. This file is the frozen decision record; the buildable cycle is cut from
> it into `initiatives/docs/PLAN.md` at kickoff. Attack findings mutate that file, never this one.
>
> **Honesty note.** Unlike most conversions in this pack, this trigger needs no receipt-hunting:
> the owner asked for it directly and the request is the decision. What is *not* claimed is a
> measured documentation-pain baseline — none exists, and none is invented. The falsifiable claim
> this cycle makes instead is mechanical: **REQ-04**, a fixture product appears in the wiki with
> zero hand-written input.
>
> **ADR band.** `docs` holds no band. Claim the next free century at kickoff per `PORTFOLIO.md`,
> from the real next free slot — **and sweep sibling worktrees before claiming it.** The engine
> lane lost time to exactly this: its worktree read "highest is 0206" while `0207` existed on
> another, because the band table and `wip-line` each see one worktree alone.

---

## Read this first — the finding that shapes the whole plan

`.claude/scripts/core/face-coverage.mjs` already solves the hard half of this problem, for the
face app, and its header states the goal in the owner's own words:

> *"Every born lane, every spine kind, every command, every agent in the TREE must have a home
> in `initiatives/face/contracts/expected-set.json`. A part of arc with no room is a FAIL, not a
> review comment — 'onnu vidama' as CI."*

It is **FAIL-FROM-BIRTH** — a named exception to the WARN-first trial rule, because "a coverage
lint that only warns is a hope" — and it ships a **mutant negative control**: run it against a
tree carrying a lane and a kind the contract does not name and it must FAIL naming BOTH.

And it does this by **exporting its tree discovery**: `treeKinds`, `treeGates`, `treeJobs`,
`treeVentures`, `treeAdrBands`, `treePlans`, `treeCapabilities`, `treeHooks`, `treeLints`,
`treeCi`, `treePlannedRooms`, plus `dirNames`, `mdStems`, `yamlStems`.

**So this cycle writes no discovery code.** It imports those functions (DOC-A). Two consequences,
and both are the point:

1. A new product, lane, command or agent is discovered by code **already in production and
   already gated**. Nothing needs to be told it exists.
2. The wiki and the face app **cannot disagree about what exists**, because they read the tree
   through one function. Re-globbing would be the "validate one read, compare another" defect
   this repo has now fixed in `verdict.mjs`, in `lineage.mjs` and inside `arc-run.mjs` — a fourth
   recurrence, in a new lane, after the rule was written down, would be indefensible.

---

## Goal

`node .claude/scripts/docs/wiki-build.mjs` emits one `wiki.json` derived entirely from the tree,
renders a page per product, lane, process and decision band into `docs/wiki/`, and
`wiki-coverage.mjs` fails CI when any part of arc has no page **or** any page has no part of arc —
so a thing born on Monday is documented on Monday, before anyone writes a word about it.

---

## Current state (verified 2026-09-18 against the live tree — re-verify at kickoff)

| Thing | Count | Machine-readable today |
|---|---|---|
| Products (`products/*/manifest.json`) | 17 | ✅ name · version · `requires` · commands · agents · scripts · `face{room,ring,kinds,stations,concepts,sanctioned}` |
| Lanes (`initiatives/*/`) | 16 | ✅ `PLAN.md` + `PROGRESS.md` (status · cycle · phase · appetite · burn · blocked-on) + `phases/phase-NN-spec.md` |
| Processes (`processes/*.process.yaml`) | 6 | ✅ tools · output schema · evals · baseline · body |
| ADRs (`docs/adr/*.md`) | 285 | ✅ Status · Date · Product · Reversibility · Revisit trigger |
| Commands (`.claude/commands/*.md`) | 27 | ✅ — 3 are generated from `processes/*.process.yaml` (ADR-0201) |
| Agents (`.claude/agents/*.md`) | 30 | ✅ frontmatter incl. `model:` tier |
| Rules (`.claude/rules/*.md`) | 7 | ✅ |
| Gates (`arc.gates.yaml`) | — | ✅ already parsed by `treeGates` |
| Test files (`tests/*.bats`) | 169 | ✅ |
| Markdown in repo | 1,308 | — |

**Overlap that must be resolved, not ignored.** Four documents already try to be this:
`docs/how-it-works.md` (135 lines) · `docs/how-arc-works-simple.md` (160) ·
`docs/usermanual.md` (547) · `docs/blueprint.md` (264). Shipping a wiki beside them recreates the
three-artifact identity crisis `BRIEF-dashboard` already recorded. DOC-J makes that a P02 exit
criterion, not a follow-up. **None of the four moves at landing time** — they move when the wiki
that replaces them exists.

---

## Success requirements

| # | Requirement | How it is proven |
|---|---|---|
| **REQ-01** | Every product, lane, process and ADR band in the tree has a page. | `wiki-coverage` exits 0 on a clean tree. |
| **REQ-02** | A part of arc with no page FAILS CI, naming it. | Mutant tree carrying an unknown product **and** an unknown lane FAILs naming BOTH. |
| **REQ-03** | A page with no part of arc behind it FAILS CI, naming it. | Mutant tree with a product directory removed FAILs naming the orphan page. |
| **REQ-04** | A newly born product appears with real facts and **zero hand-written input**. | Add a fixture product; rebuild; its page exists carrying its manifest facts and a visible `narrative pending` banner. |
| **REQ-05** | A hand-written paragraph naming a script, driver, class or ADR that no longer exists FAILS CI. | Mutant narrative citing `ADR-9999` and `drivers/ghost.mjs` FAILs naming both. |
| **REQ-06** | Generated pages cannot be edited in place. | CI regenerates; a dirty `git diff` under `docs/wiki/` fails the build. |
| **REQ-07** | No count on any page is copied; all are derived. | `--audit-counts` re-derives every number and diffs it against the rendered page. |
| **REQ-08** | The four overlapping documents no longer compete with the wiki. | Each is archived or reduced to a stub pointing into `docs/wiki/`, and the strategy file map records the move. |

---

## Decisions (letters — real ADR numbers assigned at kickoff from the claimed century)

**DOC-A · Discovery is imported, never re-globbed.**
`wiki-build` imports its tree walkers from `.claude/scripts/core/face-coverage.mjs`. If an entity
type is needed that it does not expose, the fix is to **export it there**, not to write a second
walker. A test asserts the import and fails if `wiki-build` reads directories itself.

**DOC-B · No hand-maintained inventory of what exists.**
Not a JSON contract, not a nav file, not a README table. Every list is derived at build time.
*A number nobody recomputes is a number that starts lying* (retro 2026-07-22).

**DOC-C · Coverage is bidirectional and FAIL-FROM-BIRTH, with its mutant.**
Entity-without-page and page-without-entity are both failures. No WARN-first trial period — same
named exception and same stated reason as `face-coverage`, `policy-lint` and `jobs-lint`. The gate
ships with `--mutant-selftest`; a gate that has never been observed to fail proves nothing.

**DOC-D · Generated output is never hand-edited.**
Do-not-edit banner on every generated file, and CI proves it by regenerating and failing on a
dirty diff — ADR-0201's rule for generated commands, applied to a second generated surface.

**DOC-E · Narrative lives in separate files, and absence is a legal state.**
`docs/wiki/_narrative/<entity>.md`, hand-written, optional. A marked region *inside* a generated
page invites an edit next to it that the next regeneration deletes; separate files make "never
edit this one" enforceable by path rather than by discipline.

**DOC-F · A newly born entity is documented before anyone writes about it.**
It renders from whatever is machine-readable, with a visible `narrative pending` banner. The
banner is the design, not a placeholder: *"this exists, here are its real declared facts, nobody
has written the why yet"* is recorded absence, which Constitution E3 separates from both estimate
and fabrication. Silent absence is the failure this lane exists to prevent.

**DOC-G · Drift BLOCKS, staleness WARNs.**
`wiki-drift` fails when narrative names a thing that does not exist. `wiki-stale` fingerprints the
generated facts each narrative block describes and WARNs on divergence. WARN, not BLOCK —
**blocking on prose makes people write none**, and the cure would be worse than the rot.

**DOC-H · No model-authored narrative ships.**
Extraction is a model's job; prose that carries arc's authority is not. See Rabbit hole 1 — this
is the decision most likely to be argued with under deadline, and it does not move.

**DOC-I · The wiki renders build-time tree state. Live state belongs to the face.**
No burn charts, no live counts, no status widgets. The moment the wiki shows live state it is
competing with the face app and one of them will be wrong.

**DOC-J · The four overlapping documents are resolved inside the cycle.**
REQ-08 is a Phase 02 exit criterion. Superseded files move to `docs/archive/` and are marked in
the strategy file map — never deleted.

**DOC-K · Two-surface adversarial pass on the extractor and on each gate.**
One agent on parsing and decision logic, one on the filesystem/shell boundary, each carrying the
lane's running list of already-fixed defects with instructions to check each one in *every other
file*. **Neither may be the code's author** — an author's 26 breaking inputs found 0 holes where
an unanchored agent found 9.

**DOC-L · OPEN at kickoff — where this code lives.**
Is `docs` a new lane with its own product manifest and `.claude/scripts/docs/`, or does the
generator live in `core` beside `face-coverage` as a second consumer of the same walkers? Both are
defensible; the second avoids a product whose only job is documentation, the first keeps `core`
from growing a UI concern. Decided at kickoff, recorded as an ADR, not guessed here.

---

## The three layers

```
LAYER 3 · GATES      wiki-coverage.mjs  — nothing missing, nothing orphaned   BLOCK  (DOC-C)
                     wiki-drift.mjs     — narrative names only live things    BLOCK  (DOC-G)
                     wiki-stale.mjs     — narrative older than its facts      WARN   (DOC-G)

LAYER 2 · NARRATIVE  docs/wiki/_narrative/<entity>.md                                (DOC-E)
                     hand-written only. absent is legal and rendered.                 (DOC-F, H)

LAYER 1 · GENERATED  wiki.json  →  docs/wiki/**.md                                    (DOC-A, B, D)
                     rebuilt every run. do-not-edit banner. never hand-touched.
```

## How a newly born thing reaches the docs — four steps, and none of them is a person

1. The thing is born the normal arc way (`/arc-kickoff --lane x`, or a new
   `products/x/manifest.json`).
2. `wiki-build` imports the `face-coverage` walkers on its next run and sees it — **no registry
   to update** (DOC-B).
3. It renders a page from whatever is machine-readable, with the `narrative pending` banner
   (DOC-F).
4. `wiki-coverage` counts it covered — it has a page — and reports it in the narrative-debt
   figure, because it has no prose yet.

---

## Phases (risk-ordered; appetites are ceilings)

**The cycle ends at P03.** Narrative authoring for the remaining ~30 entities is deliberately
*outside* it — that is throughput, not risk, and a cycle that ends when the last page is prose
is a cycle with no end condition.

| Phase | Capability | Appetite | Why here |
|---|---|---|---|
| **P00** | **The extractor.** Import the `face-coverage` walkers (DOC-A); emit ONE `wiki.json` over products · lanes · processes · ADR bands · commands · agents · rules · gates. Two-surface adversarial pass (DOC-K). | 1.5 d | Highest risk by far. Every later phase consumes this shape; a wrong data model surfaces in P03 and costs the cycle. |
| **P01** | **The coverage gate — before any renderer.** `wiki-coverage.mjs` with `--mutant-selftest`, both directions (REQ-02, REQ-03), FAIL-FROM-BIRTH. | 1.5 d | Second-highest risk: this gate *is* the requirement. Built before the renderer, the renderer is written against a proven invariant instead of the gate being retro-fitted to whatever happened to render. |
| **P02** | **The renderer.** `wiki.json` → `docs/wiki/` markdown, one page per entity, do-not-edit banner, CI dirty-diff check (DOC-D). **Exit includes REQ-08/DOC-J.** | 1 d | Low risk once P00 and P01 hold. |
| **P03** | **Drift + stale gates and three real narratives.** `wiki-drift` BLOCK, `wiki-stale` WARN. Narrative for `engine` (richest), one thin product, one sleeper lane — the shape proven at both extremes. Retro and seal. | 1.5 d | Three proves the template. Thirty-three is throughput. |

**Planned 5.5 d · cap 6.5 d · 1 d slack.**

### Kill checkpoint — read at day 3, not at the 50% mark

Day 3 lands at the end of P01, and asks one question: **does `--mutant-selftest` fail closed?**
If the coverage gate cannot be made to fail on a tree it should reject, the premise is unproven
and the cycle STOPs with that finding recorded. A generated wiki whose completeness gate is
vacuous is worse than no wiki, because it certifies the thing it does not check — and this repo
has shipped the vacuous pass three times, twice inside suites written to prevent it. 50% falls
mid-P01 while it is still on schedule, and a tripwire that fires on an on-track run is one that
learns to be ignored.

---

## No-gos (v1)

- **No search.** It is a repo. `grep` works, and `graphify query` already owns `.md` while
  `codegraph` owns code (ADR-0075). A third index is a fourth truth.
- **No page history or versioning.** Git has it.
- **No public publishing.** This wiki is internal. Publishing outward is irreversible and needs an
  explicit owner decision at that time — outside this cycle's scope, and the LexOS-mockups
  near-miss is why that sentence is here.
- **No pretty before complete.** P02 renders plain markdown. Visual treatment and any face ring
  are a later cycle, and arguably the `face` lane's.
- **No wiki for the wiki.** The `docs` lane is documented by the same generator as everything
  else, or it gets no page.

---

## Rabbit holes (named detours)

**1. "Let a model write the thirty-odd narratives."** — *the one that would sink it.*
A model produces fluent pages that are each ~90% right, and the 10% is indistinguishable from the
90% by reading. That is precisely the false-comment class this repo keeps recording: the
`review_by` comment stating ninety days against an ADR saying two weeks · the termination spec
that was false when measured · the `hosted: local` field that had quietly stopped being true.
Those were **single lines**, and each cost real time. Thirty pages of them, carrying arc's own
authority and cited by future cycles, would be the most expensive artifact in the repo.
**Where a model is allowed:** extraction (deterministic, gate-verified), draft *assistance* a
human accepts line by line, and bulk mechanical work. Never unattended prose that ships (DOC-H).

**2. Building the face ring first.** The UI will demand data-model changes for display reasons and
those changes will be wrong. Generator first, renderers after.

**3. A page per script.** 185 scripts listed by manifest and explained by the product page that
owns them. A page each is inventory, not understanding.

**4. Perfecting the narrative template before writing three.** Write three at real extremes, then
fix the template from what broke.

---

## Assumptions ledger (cap 7 — each with a falsification trigger)

| # | Assumption | Falsified when |
|---|---|---|
| A-01 | The `face-coverage` exports cover every entity type the wiki needs. | P00 finds a type with no exported walker → export it there (a face-lane touch; flag at kickoff, and it interacts with DOC-L). |
| A-02 | ADR headers are regular enough across all 285 to parse without per-file exceptions. | More than 5 need a special case → the parse is reported as partial and the unparsed count is **printed on the page**, never hidden. |
| A-03 | `PROGRESS.md` status/cycle/phase/appetite lines are regular across all 16 lanes. | More than 3 lanes need bespoke parsing → lane pages carry only what parses, and say so. |
| A-04 | A thin product still yields a page worth reading. | The sleeper-lane narrative in P03 reads as filler → the template gets a short form, decided then. |
| A-05 | Regenerate-and-diff is stable in CI (no timestamps, no ordering churn). | The dirty-diff check flaps → sort everything, strip build times. A flapping gate is ignored within a week. |
| A-06 | The face lane will not move `face-coverage.mjs` or change its exports mid-cycle. | face v2 (Cycle 16) touches it → coordinate at kickoff; face v2 is the adjacent live lane. |

---

## Pre-mortem — top 5, seeded from this repo's own history

1. **The gate is vacuous** — it passes because it checks something always true.
   *Mitigation:* the mutant is a P01 exit criterion and the day-3 checkpoint asks this exact
   question.
2. **A second discovery walker appears** because importing was inconvenient one afternoon; the two
   then disagree and the gate certifies a tree it never read.
   *Mitigation:* DOC-A, plus the test that asserts the import.
3. **Narrative rots silently** — facts move, prose does not, and the wiki lies with authority.
   *Mitigation:* `wiki-stale` (DOC-G).
4. **The four old documents survive** and readers find two answers.
   *Mitigation:* DOC-J makes it a P02 exit criterion, not a follow-up.
5. **The page becomes a dashboard** — someone adds live counts and a burn chart, and now the wiki
   competes with the face.
   *Mitigation:* DOC-I.

---

## Gates at kickoff (checked in-file before the prompt is pasted)

- Owner ruling on the spine as `decision.recorded` (Phase 0's first act), cited by every kickoff ADR
- Live slot free (A9) — `PORTFOLIO.md` WIP acknowledged
- **Century claim** per `PORTFOLIO.md`, swept across sibling worktrees
- **DOC-L answered** — new lane vs `core` home
- `face-coverage.mjs` exports confirmed present and unchanged since 2026-09-18
- Adjacent-lane check: face v2 (Cycle 16) status, per A-06

---

## Note on the model question (kept separate on purpose)

This lane is the natural first real workload for a cheap-model trial: bulk, verifiable,
high-volume, every output judged by a deterministic gate rather than by taste. Run it as
`--trial-model` under **ADR-0220** — a trial writes no router row and changes no tier, and the
receipt records `model_source: trial`. If it wins, promoting it is a **separate reviewed diff
citing ADR-0069**, and it is not part of this cycle.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (after the gates above clear)

> Read `docs/strategy/plans/PLAN-docs.md` end to end before doing anything, then run
> `/arc-kickoff "arc's own reference: a generated wiki over every product, lane, process and
> decision, complete by construction" --lane docs`.
>
> Write PLAN.md and PROGRESS.md, then **stop and wait for my approval before any code.**
>
> These are locked and must appear in the PLAN you write:
>
> 1. **DOC-A** — the extractor **imports** tree discovery from
>    `.claude/scripts/core/face-coverage.mjs` (`treeAdrBands`, `treePlans`, `treeGates`,
>    `dirNames`, `mdStems`, `yamlStems`, and the rest). It does not walk directories itself.
>    Add the test that asserts this.
> 2. **DOC-C** — `wiki-coverage.mjs` is FAIL-FROM-BIRTH with `--mutant-selftest`, modelled on
>    `face-coverage.mjs`, checking **both** directions: an entity with no page, and a page with
>    no entity.
> 3. Phase order is extractor → **coverage gate** → renderer → drift/stale + three narratives.
>    The gate comes before the renderer. Do not reorder it for convenience.
> 4. The **day-3 kill checkpoint** question is: *does the mutant self-test fail closed?* If not,
>    STOP and record the finding.
> 5. **DOC-D** — generated output carries a do-not-edit banner; CI regenerates and fails on a
>    dirty diff.
> 6. **DOC-E / DOC-H** — narrative lives in separate files and is hand-written or absent. No
>    model-authored prose ships. Read Rabbit hole 1 before arguing with this.
> 7. **DOC-J** — Phase 02 does not close until `docs/how-it-works.md`,
>    `docs/how-arc-works-simple.md`, `docs/usermanual.md` and `docs/blueprint.md` are archived or
>    stubbed into the wiki (REQ-08), with the strategy file map updated in the same drop.
> 8. **DOC-L** is yours to answer in the PLAN: new `docs` lane, or the generator lives in `core`
>    beside `face-coverage`. Record it as an ADR either way.
> 9. Claim the ADR century from the real next free slot per `PORTFOLIO.md`, **after sweeping
>    sibling worktrees**.
>
> Appetite: 5.5 days planned, 6.5 cap.

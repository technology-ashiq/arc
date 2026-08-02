# PLAN.md — arc `develop` · "The Developer"

> Cycle 5 · lane `develop` — arc's first natively-born lane. Design source (frozen, not editable
> here): `docs/strategy/plans/PLAN-develop.md`. That file is the decision record (DEV-A…K, 4 review
> rounds, §11 rejected-ideas registry); **this** file is the buildable cycle cut from it at a 5-day
> appetite. Attack findings mutate this plan, never the source.

## Goal

An execution harness for whoever is building an approved arc phase: `/arc-develop` turns that phase
into small, spec-anchored, independently **proven** increments with visible progress and controlled
escalation — so the longest stretch of the build, today owned by nobody, stops relying on the model
remembering to be careful.

## Current state

- **Stack:** arc itself — an AI build harness. Node 18+, bash-3.2 safe, **zero external deps in
  core**. Cycle 4 (portfolio) closed 2026-08-02; lanes `design` and `portfolio` are IDLE.
- **Entry points:** `.claude/commands/arc-*.md` (commands are markdown prompt files) →
  `.claude/scripts/core/lane-resolve.sh|.mjs` (routing) → `.claude/scripts/hq/arc-event.sh` (receipts).
  Lints live in `.claude/scripts/plan/` and `.claude/scripts/core/`. Products are declared in
  a per-product `manifest.json` (e.g. `products/design/manifest.json`) and validated by `product-lint.mjs`.
- **Conventions:** every lane surface calls `lane-resolve.sh --for` with its surface name first and echoes
  `Selected lane:` before anything else; `--for` is a free-form string and only `kickoff` is
  special-cased (→ `status=create`), so a new surface needs **no resolver edit** (ADR-0068). Node
  callers import `resolveLane` from `lane-resolve.mjs`. Exit codes: `0` resolved · `3` ambiguous ·
  `4` unknown lane · `5` invalid name. WARN format `[check-name] FILE:LINE — Expected/Found/Example`,
  exit 0. Gates ship WARN-first and promote to BLOCK only via `docs/trial-ledger.md` (fixture-proven +
  ≥3 clean dogfood runs). `PROGRESS.md`'s `key: value` machine header is the board's only truth
  source (ADR-0051). Tests are bats under `tests/`; CI is a 19-job ubuntu/macos/windows matrix.
- **Hot / high blast radius:** `lane-resolve.sh` + `.mjs` are byte-identical twins — any drift blocks
  every command. `kickoff-lint.mjs` gates every phase open and close. `arc-event.*` carries all
  receipts.
- **Do-not-touch:** `docs/adr/`, `docs/retro-log.md`, `docs/trial-ledger.md`, `tests/` stay **root
  organs, never per-lane** (ADR-0053). `docs/evidence/**` and `docs/archive/**` are frozen
  (ADR-0058). `tests/fixtures/sync-golden/tree-manifest.txt` is a SHA256 byte-identity gate — editing
  any product-shipped file means a named regeneration step.
- **Absent today:** no `.claude/scripts/develop/`, no `.claude/commands/arc-develop.md`, no
  `products/develop/`, no `.claude/agents/spec-fidelity.md`, no `.claude/state/develop/` — this lane
  builds all five from nothing. Root `CLAUDE.md`'s `## Commands` list and its "only the five command
  lines showing the lane flag" sentence both become false the moment `/arc-develop` ships.

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase | Status |
|---|---|---|---|---|
| REQ-01 | I start a phase and get its Build Brief and slice ledger without hand-writing either | `/arc-develop start 0 --lane develop` on the committed fake phase writes `phases/phase-00-tasks.md` with a brief header (REQs · non-negotiables · no-gos · ADR list · blast radius · prediction block · the spec hash REQ-05 checks staleness against) and 5 slice blocks each carrying `proof:`, `tier:` and `kind:`; exits non-zero when the phase spec is absent; `start` against the `fake-phase-midway` ledger (which holds 2 proven slices) exits non-zero and writes nothing, rather than orphaning those slices' `commit:` SHAs | 00 | active |
| REQ-02 | My venture repos keep today's behaviour while arc's lanes get theirs | `--lane` is the only lane input: `/arc-develop status --lane nope` exits 4, `--lane a --lane b` exits 5, `--lane CON` exits 5 on all 3 CI OS legs, and each creates nothing; the root-mode fixture (a tree with no `initiatives/`) produces output byte-identical to its recorded golden | 00 | active |
| REQ-03 | I pick the build back up after a context reset without re-reading the session | on the `fake-phase-midway` fixture (5 slices, 2 proven), `/arc-develop status` prints the phase, `slice 2/5` where X counts proven slices, the next unproven slice id `03`, and the last 3 receipt kinds — reading only committed files | 00 | active |
| REQ-04 | Every lifecycle transition leaves an audit trail nobody has to remember to write | `develop.started`, `slice.done` and `handoff.ready` land in `.claude/state/hq/events/` as one dated `.jsonl` per day, carrying the lane in the payload; a spine write failure never changes the command's exit code, and `status` names any expected receipt kind that is missing instead of reporting position as though it landed | 00 | active |
| REQ-05 | A slice cannot be marked done without a declared proof and its pasted output | `node .claude/scripts/develop/develop-lint.mjs --lane develop` exits 1 on a ticked slice missing `proof:`, `tier:` or `commit:`, on an unparseable ledger, and on a brief whose recorded spec hash has moved; when one slice block among several valid ones is malformed, the exit-1 output names that slice's id and line rather than failing the whole file with no location; exits 0 on the good fixture | 01 | active |
| REQ-06 | The gate cannot be walked past by an artifact that only looks legitimate | ≥20 hand-built breaking inputs (heading-level and emphasis variants, repeated sections, case-flipped keys, trailing-whitespace values, CRLF and mixed line endings, duplicate slice ids) are pinned under `tests/fixtures/develop/breaking/`; each one FAILs `develop-lint` and the good fixture stays green | 01 | active |
| REQ-07 | Proof strength is recorded, so "tested" stops meaning six different things | every proof carries a tier from `static` / `unit` / `contract` / `integration` / `e2e-visual` / `verified-real`, and its slice carries `kind:` from `ui` / `external-dep` / `logic` / `infra`; a `ui` slice whose strongest tier is below `e2e-visual` and an `external-dep` slice below `contract` each raise a WARN naming the slice, and a slice with no `kind:` raises its own WARN rather than being skipped in silence | 01 | active |
| REQ-08 | Confidence comes from a scored record instead of a number the model picked | `/arc-develop handoff 0` marks each prediction `hit`, `miss` or `unforeseen` against the ledger line that settles it, and `develop-lint` flags any self-declared numeric score in a ledger row | 02 | active |
| REQ-09 | Something with no stake in the work checks it against the spec before handoff | the `spec-fidelity` agent reads only `phase-NN-spec.md` and the phase diff, and returns built-what-spec-says · scope creep · exit-criteria drift · non-negotiables intact · 1 user-visible-behaviour line; its report is in the handoff evidence pack | 02 | active |
| REQ-10 | A build that is going wrong escalates on a trigger instead of grinding | 4 deterministic backstops fire on the fixture: same error fingerprint 3× forces root-cause mode · 5 attempts on one slice escalates with a 1-screen diagnosis · a diff touching a risk glob runs a checkpoint before the next slice · a new debt marker with no debt-ledger row raises a WARN naming the file (the 4-marker set is enumerated in `phase-03-spec.md`) | 03 | active |

## Appetite

**5 days total** (owner-set at kickoff, 2026-08-02). A constraint, not an estimate: if it is blown we
cut scope or kill a phase, never silently extend. Phases allocate **4.0 of the 5 days** — the 1.0-day
slack is deliberate, because Cycle 4 closed at 112% with zero slack to absorb one bad afternoon.

**Tier:** M

**Kill criteria:** a literal 50% tripwire would be a broken instrument here — Phase 00 (1.5d) and
Phase 01 (1.25d) sum to 2.75d, so "at 2.5 days, is Phase 01 done?" fires on every perfectly
on-schedule run and cannot tell on-track from in-trouble. That is the shape the trial ledger already
recorded for `appetite-sum`: a gate that has learned to be ignored. The checkpoint is therefore
**at 3.0 days burned: if Phase 01 is not done → mandatory scope-cut conversation**, and the
pre-decided cut is Phase 03 in full. At 100% → cut or kill, never extend. Per-phase tripwires are in
each phase spec and are read at the phase's start, not admired after (Cycle 4's Phase-02 tripwire
fired and was never applied).

## Architecture (C4 concepts, Mermaid flowchart)

```mermaid
flowchart TB
  ashiq([Person: Ashiq — building an approved phase])

  subgraph develop [System: develop · The Developer]
    cmd[Container: /arc-develop<br/>start · next · status · checkpoint · handoff]
    lint[Container: develop-lint.mjs<br/>structural BLOCK · heuristic WARN]
    fidelity[Container: spec-fidelity agent<br/>fresh context, spec + diff only]
  end

  subgraph tracker [Container: the lane tracker — durable truth]
    spec[phase-NN-spec.md]
    ledger[phase-NN-tasks.md<br/>Build Brief + slice ledger]
  end

  subgraph core [System: arc core — reused, never re-implemented]
    resolve[lane-resolve.sh / .mjs<br/>--for develop]
    spine[arc-event.sh<br/>append-only receipts]
    phasedone[/arc-phase-done — owns closing]
  end

  ashiq --> cmd
  cmd --> resolve
  cmd --> spec
  cmd --> ledger
  cmd --> lint
  lint --> ledger
  cmd --> spine
  cmd -->|handoff| fidelity
  fidelity --> ledger
  cmd -->|evidence pack| phasedone
  ashiq -->|commits each proven slice| ledger
```

## Key decisions (ADR index)

| # | Decision | Status |
|---|---|---|
| 0063 | Slice ledger is a `key: value` block per slice, not a table | accepted |
| 0064 | develop-lint floor: structural checks BLOCK, heuristic checks WARN-first | accepted |
| 0065 | One local commit per proven slice; the session commits, never the harness | accepted |
| 0066 | Risk-triggered checkpoints run inline at the slice boundary | accepted |
| 0067 | The Phase-0 fake phase is a committed fixture, not a throwaway demo | accepted |
| 0068 | `develop` ships as its own product and rides `--for develop` with no resolver edit | accepted |

## Non-negotiables

- The main session writes the code — develop supplies context, discipline, checkpoints and evidence; there is no coder subagent, ever (ADR-0068).
- develop never closes a phase, never intakes scope and never creates a lane — `/arc-phase-done`, `/arc-change` and `/arc-kickoff` keep those jobs.
- Every slice declares its acceptance proof BEFORE implementation; `proof: none` is not a slice (ADR-0063).
- Every number is computed by a tool or earned from a scored outcome — a self-declared score in a ledger row is a lint finding (ADR-0064).
- Any gate, lint or parser this build ships gets an adversarial construct-a-breaking-input pass in the same section that ships it, with every hole pinned as a fixture.
- develop never modifies its own policies, gates, skills or capabilities without a recorded, Ashiq-approved promotion.
- The whole lifecycle runs offline on a committed fixture; `--lane` is the only lane input and root-mode output stays byte-identical (ADR-0067).

## No-gos (explicitly out of scope)

- **Delivery-order layers 3–5** of the design source: capability scout + vet gate + lockfile,
  decision-triggered pattern mining, design-critic checkpoints, and the entire Learning System
  (learning ledger, candidate→eval→promotion loop, withheld + time-forward holdout, calibration
  record). Not started, not stubbed.
- **Full Context Pack retrieval** — churn ranking, tags, one-hop typed-link following, codegraph
  wiring. The Build Brief ships a grep-based blast radius; that is the whole retrieval story this
  cycle.
- **Evaluation-suite seeding** (`tests/fixtures/develop-evals/`). Converting council v2+v3's 43 holes
  is record archaeology and belongs to the Learning System, not the steel thread.
- **Approach sketches with economics fields.** The risk-glob machinery lands in Phase 03; the sketch
  ritual does not.
- **Every checkpoint health check that needs to understand code.** Circular-dependency and
  complexity-delta checks need madge or dependency-cruiser, and arc core is zero-dep; the public-API
  surface diff needs the same machinery to be worth anything, and does not fit Phase 03's 0.5 days
  beside the three backstops it must also ship. Checkpoints ship the half that needs no code
  understanding at all: risk-glob trigger and marker scan.
- **Dogfooding on real phases.** The design source's 2–3 real-phase tripwire is the next cycle's job;
  this cycle's proof is the committed fixture.
- **Promoting any gate to BLOCK** beyond ADR-0064's three structural checks. Everything else is
  WARN-first and needs the trial ledger.

## Rabbit holes

- **A semantic-diff engine** for the fidelity pass → the design source already rejected it (§11).
  One prose behaviour line is the whole of it this cycle; the deterministic half it was meant to pair
  with (the public-API surface diff) is a no-go above until something here can read code.
- **A general-purpose task system.** The ledger holds the slices of one phase and nothing else — no
  cross-phase rollups, no dependencies between slices, no priorities beyond the risk ordering.
- **Perfecting the prediction taxonomy** before any data exists → 5 fixed fields, scored
  hit/miss/unforeseen, revisited after the first real phase has scored them.
- **Teaching `lane-resolve` about surfaces** (ADR-0068) → ride the generic `--for` path; the twins
  stay untouched and the sync-golden manifest does not move for the resolver.
- **Making the fake-phase fixture realistic** enough to be a second product → it is a miniature with
  one slice per lint state, and it asserts the rule while branching on state, never a snapshot of
  today's repo (retro-log 2026-08-02).

## Assumptions ledger

| Assumption | How we'd know it's wrong (trigger) | Phase that tests it |
|---|---|---|
| `--for develop` needs no change to `lane-resolve.sh`/`.mjs` — verified by reading the resolver on 2026-08-02 (only `kickoff` is special-cased) | any Phase-00 lane test needs an edit to either twin to pass | 00 |
| 4.0 days of allocated build fits inside the 5-day appetite, leaving 1.0 day of slack | Phase 00 and Phase 01 together pass 3.0 days | 01 |
| A grep-based blast radius is enough for a useful Build Brief, so codegraph can wait | a Phase-01 slice has to touch a file its own brief's blast radius never listed | 01 |
| Slices are coarse enough that one commit each leaves phase history readable | a phase produces more than 15 slices | 02 |
| `spec-fidelity` can judge fidelity from spec + diff alone, with no build context | it states a confident verdict resting on a non-negotiable or blast-radius claim whose text is nowhere in `phase-NN-spec.md` — confabulating instead of asking is the failure that looks identical to a real verdict (retro-log 2026-07-30) | 02 |

## External dependencies

<!-- Genuinely none: the build is offline by construction and arc core is zero-dep. git, node and
     bash are local tooling, not external services. codegraph would have been the one real dep —
     it is a no-go this cycle, so it gets no row rather than an aspirational one. The empty-table
     WARN is the honest outcome. -->

| Dep | Interface | Fake impl | Real impl | Contract test |
|---|---|---|---|---|

## Pre-mortem (Klein)

| # | Failure cause | Mitigation or accepted |
|---|---|---|
| 1 | The ledger parser ships with a hole a doctored artifact walks straight through — the cosmetic-variant class that recurred across council v2 and v3, and that was skipped on three gates in one portfolio phase until the close found 61 issues, 5 live in shipped code | **Mitigated:** REQ-06 binds the adversarial breaking-input pass to the section that ships the parser, never to the phase close (retro-log 2026-08-02); ≥20 inputs pinned as fixtures before Phase 01 closes; ADR-0063 mandates tolerant detection + strict grammar from the first line, not after the first bug |
| 2 | develop-lint passes because it can only detect absence — the 2026-07-30 failure where `PASS = zero VIOLATION` let characterless work through five consecutive runs, and the 2026-08-02 negative control that passed six CI legs by luck | **Mitigated:** each of ADR-0064's three structural BLOCKs ships with a negative-control fixture proving the check *can* fail; REQ-05 asserts exit 1 on named mutations, not only exit 0 on the good fixture |
| 3 | The harness ships proven only against its own committed fixture and is never run on a real phase — the shape that let council v2/v3's gates pass their own fixtures while hiding 43 real holes (retro-log 2026-07-16), and that let a blind panel compare three invented fixtures instead of the real thing (2026-07-30). Real-phase dogfooding is a declared no-go this cycle, so first real use would also be first discovery | **Mitigated by self-hosting:** once Phase 01 is green, Phase 02 opens by running the shipped harness against its own real `phase-02-spec.md`, and the brief it produces is read against this plan — the same move portfolio Phase 01 made. If it cannot produce a usable brief, that is Phase 02's first finding and gets recorded, not routed around |
| 4 | Phase 00 over-runs and eats the whole appetite — Cycle 4 closed at 112% because one phase ran 1.1d against 0.75d with no slack anywhere to absorb it | **Mitigated:** only 4.0 of 5 days are allocated; phase-00's own tripwire at 2.0 days cuts the Build Brief to the grep fallback and defers `checkpoint` mode to Phase 03 |
| 5 | The fake-phase fixture asserts a snapshot of repo state instead of a rule, so opening or closing any cycle turns CI red with nothing broken — exactly what cost 5 of 19 legs on 2026-08-02 | **Mitigated:** ADR-0067 requires the fixture to assert the rule and branch on state; REQ-02's root-mode golden is a tree with no `initiatives/` directory, never a claim about which lanes exist today |

## Phases (risk-ordered)

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | Steel thread — `/arc-develop` runs start → next → status → handoff end-to-end offline on the committed fake phase, lane-native, writing a durable brief + slice ledger and emitting receipts | 1.5 days | pending |
| 01 | The proof floor — `develop-lint` with structural BLOCKs, evidence tiers, and a parser that survives ≥20 adversarial breaking inputs | 1.25 days | pending |
| 02 | Earned judgment — predictions scored at handoff, and a fresh unanchored `spec-fidelity` pass over spec + diff | 0.75 days | pending |
| 03 | Controlled escalation — stuck backstops, inline risk-triggered checkpoints, debt-ledger marker lint | 0.5 days | pending |

Phase 0 is the steel thread: the thinnest end-to-end slice of the real lifecycle, running offline
against a committed fixture. There are no external dependencies, so it ships the slice without
contract tests against fakes — the fixture is the equivalent firewall.

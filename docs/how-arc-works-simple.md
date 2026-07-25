# How arc works — the simple map

> Owner's orientation page. When lost, read this, then `PLAN.md`.
> Not the same as `how-it-works.md` (that's the product explainer synced to consumer repos).
> Last updated: 2026-07-25

## 1. The one rule

**Exactly ONE plan is ever live: the root `PLAN.md`.**

Everything under `docs/strategy/plans/` is a queue of sleeping work. If it's not in root
`PLAN.md`, it is not happening right now — no matter how detailed the strategy doc is.

## 2. Three time layers

| Layer   | Where                                            | Question it answers      |
| ------- | ------------------------------------------------ | ------------------------ |
| FUTURE  | `docs/strategy/` + `docs/strategy/plans/`        | What might we do?        |
| PRESENT | root `PLAN.md` + `phases/` + `PROGRESS.md`       | What are we doing NOW?   |
| PAST    | `docs/HISTORY.md` (logbook) + `docs/evidence/` + `docs/adr/` + `retro-log.md` | What did we do, and why? |

Most confusion comes from mixing these layers. A strategy plan is not work; a phase spec
is not strategy; evidence is not a plan.

## 3. Folder map

```
arc/
├── PLAN.md              ← the ONE live cycle (filled by /arc-kickoff)
├── phases/              ← that cycle's phase specs only (phase-NN-spec.md)
├── PROGRESS.md          ← where the live cycle stands
├── products/            ← NOT apps — arc's internal modules (see §4)
│   └── <name>/manifest.json   ← list of which .claude/ files belong to the module
├── .claude/             ← the actual machinery (commands, scripts, hooks, agents)
├── sync-to-project.sh   ← installs selected modules into consumer repos
├── tests/               ← central bats tests (ADR-0021)
└── docs/
    ├── HISTORY.md       ← company logbook — what's been done, one entry per cycle
    ├── strategy/        ← ACTIVE vision docs (constitution, architecture, org blueprint)
    │   ├── plans/       ← THE QUEUE: PLAN-*.md + BRIEF-*.md + README (trigger index)
    │   └── records/     ← rationale history — closed analysis briefs still cite
    ├── adr/             ← permanent decisions — the "why is it like this" answers
    ├── evidence/        ← proof bundles emitted by /arc-phase-done
    ├── archive/         ← closed/parked initiatives — do not read, do not touch
    ├── council/         ← council sessions + historical eval work
    └── *.md             ← manuals & logs (usermanual, retro-log, trial-ledger, …)
```

## 4. `products/` are NOT products

- `products/<name>/` is one of arc's internal modules (core, plan, review, qa, git,
  council, hq, …). Each folder holds only a `manifest.json` — a list of which `.claude/`
  files make up that module. The real files live in `.claude/`.
- `sync-to-project.sh` reads the manifests and installs chosen modules into **consumer
  repos** (venturemind, Opportunity-Scout).
- **Revenue products = ventures = separate repos.** Venture code never lives inside arc.
  arc is the factory; a venture is a thing the factory's tools get installed into.

## 5. Lifecycle — how anything gets built

```
BRIEF (sleeping, has a pull-trigger)
  → trigger fires → expand BRIEF into a full PLAN → owner approves
  → /arc-kickoff  → fills root PLAN.md + phases/*.md
  → build phase by phase → /arc-phase-done N  (evidence bundle → docs/evidence/)
  → /arc-retro    → cycle closed, plan archived → next cycle
```

**Phases never live inside `products/`.** They always live at root `phases/`, one cycle
at a time. Two build cases:

- **arc module** (e.g. a future growth module): the cycle runs here in arc. Output lands
  in `.claude/`, gets registered in `products/<name>/manifest.json`.
- **venture** (revenue app): the cycle runs **in the venture's own repo** (Cycle-3
  onward). arc stays frozen except retro fixes.

## 6. BRIEF vs PLAN

- `BRIEF-*.md` — a seed: problem, rough shape, appetite, **pull-trigger**, paste-ready
  kickoff prompt. It sleeps. Don't open it until its trigger fires.
- `PLAN-*.md` — fully expanded and ready for `/arc-kickoff`.
- The index with the trigger table is `docs/strategy/plans/README.md`.

A large number of BRIEFs is not backlog pressure — they are alarms set for later.

## 7. When lost, read in this order (~2 minutes)

1. `PLAN.md` — which cycle is live
2. `PROGRESS.md` — how far along it is
3. `phases/phase-NN-spec.md` (highest NN) — this week's actual work
4. `docs/strategy/plans/README.md` — what's queued next

Not needed daily: `docs/strategy/*` (reference only), `docs/archive/*` (dead).

## 8. Rules that prevent confusion

1. One live plan — the root `PLAN.md`. Strategy is a queue, not work.
2. Phases at root, never inside `products/`.
3. `products/` = arc modules. Ventures = separate repos.
4. BRIEFs sleep until their pull-trigger fires.
5. Nothing is built straight from a strategy doc — it must pass through `/arc-kickoff`.
6. Every change: `feat/*` branch → review → PR. Never straight to main.

# How arc works — the simple map

> Owner's orientation page. When lost, read this, then `PLAN.md`.
> Not the same as `how-it-works.md` (that's the product explainer synced to consumer repos).
> Last updated: 2026-08-02

## 1. The one rule

**Exactly ONE plan is ever live per lane: that lane's `initiatives/<lane>/PLAN.md`.**

A lane is one product's workspace, and each lane runs one live cycle at a time — never
two. Everything under `docs/strategy/plans/` is still a queue of sleeping work: if it is
not in a lane's `PLAN.md`, it is not happening right now, no matter how detailed the
strategy doc is. `PORTFOLIO.md` lists every lane in priority order, but it is
**the index view, not the truth** (ADR-0051) — every value on it is derived from a lane's
`PROGRESS.md`, and on any mismatch the lane files win and the board lint says so. The board
also only ever shows lanes that exist; a lane is born by `/arc-kickoff --lane <name>` and
gets its board row in that same commit (ADR-0061). A repo with no `initiatives/` directory
keeps the old single-root law byte-for-byte — root `PLAN.md` is that repo's one live plan
(ADR-0054).

## 2. Three time layers

| Layer   | Where                                            | Question it answers      |
| ------- | ------------------------------------------------ | ------------------------ |
| FUTURE  | `docs/strategy/` + `docs/strategy/plans/`        | What might we do?        |
| PRESENT | the live lane's `PLAN.md` + `phases/` + `PROGRESS.md` (root-mode: at the root) | What are we doing NOW?   |
| PAST    | `docs/HISTORY.md` (logbook) + `docs/evidence/` + `docs/adr/` + `retro-log.md` | What did we do, and why? |

Most confusion comes from mixing these layers. A strategy plan is not work; a phase spec
is not strategy; evidence is not a plan.

## 3. Folder map

```
arc/
├── PORTFOLIO.md         ← the company board: every lane, in priority order (a view, not the truth)
├── initiatives/         ← one workspace per product — a "lane"
│   └── <lane>/
│       ├── PLAN.md      ← that lane's ONE live cycle (filled by /arc-kickoff --lane <lane>)
│       ├── PROGRESS.md  ← where that cycle stands; its machine header is what the board reads
│       ├── phases/      ← that cycle's phase specs only (phase-NN-spec.md)
│       ├── evidence/    ← proof bundles from this lane's cycles (phase-NN/)
│       ├── docs/        ← product-specific notes
│       └── archive/     ← cycles this lane closed AFTER it existed — never older history
├── products/            ← NOT apps — arc's internal modules (see §4)
│   └── <name>/manifest.json   ← list of which .claude/ files belong to the module
├── .claude/             ← the actual machinery (commands, scripts, hooks, agents)
├── sync-to-project.sh   ← installs selected modules into consumer repos
├── tests/               ← central bats tests (ADR-0021)
└── docs/
    ├── HISTORY.md       ← company logbook — one entry per cycle, tagged with its [lane]
    ├── strategy/        ← ACTIVE vision docs (constitution, architecture, org blueprint)
    │   ├── plans/       ← THE QUEUE: PLAN-*.md + BRIEF-*.md + README (trigger index)
    │   └── records/     ← rationale history — closed analysis briefs still cite
    ├── adr/             ← permanent decisions — the "why is it like this" answers
    ├── evidence/        ← FROZEN — pre-lane proof bundles, the sole copy. Link, never copy.
    ├── archive/         ← FROZEN — closed/parked initiatives, the sole copy. Link, never copy.
    ├── council/         ← council sessions + historical eval work
    └── *.md             ← manuals & logs (usermanual, retro-log, trial-ledger, …)
```

- A lane is born **only** by `/arc-kickoff --lane <name>`. Every other command handed a
  lane it does not know stops, lists the lanes that exist, and creates nothing.
- `docs/evidence/**` and `docs/archive/**` are **frozen** (ADR-0055, ADR-0058): history
  from before the lanes stays exactly where it is, as the only copy. A lane with a past
  gets `initiatives/<lane>/HISTORY-INDEX.md` — links and one-line summaries pointing at
  the frozen locations, never copies of them. **Frozen is about *this* repo:** in a
  root-mode repo `docs/evidence/phase-NN/` is still the live path `/arc-phase-done`
  writes to, and it refuses to overwrite an existing bundle (ADR-0060).
- No `initiatives/` directory at all — LexOS, venturemind, any consumer repo — means
  root-mode: `PLAN.md`, `PROGRESS.md` and `phases/` sit at the repo root exactly as
  before (ADR-0054).

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
  → /arc-kickoff  → fills the lane's PLAN.md + phases/*.md (root PLAN.md in root-mode)
  → build phase by phase → /arc-phase-done N  (evidence bundle → that lane's evidence/)
  → /arc-retro    → cycle closed, plan archived → next cycle
```

**Phases never live inside `products/`.** They live under the lane that owns them —
`initiatives/<lane>/phases/`, or root `phases/` in root-mode — one cycle at a time.
Two build cases:

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

0. `PORTFOLIO.md` — which lane is live (lane-mode only; skip it in root-mode)
1. `PLAN.md` — which cycle is live
2. `PROGRESS.md` — how far along it is
3. `phases/phase-NN-spec.md` (highest NN) — this week's actual work
4. `docs/strategy/plans/README.md` — what's queued next

Items 1–3 are the live lane's files (`initiatives/<lane>/…`); in root-mode they sit at the
repo root.

Not needed daily: `docs/strategy/*` (reference only), `docs/archive/*` (dead).

## 8. Rules that prevent confusion

1. One live plan **per lane** — that lane's `initiatives/<lane>/PLAN.md`. Strategy is a
   queue, not work. No `initiatives/` directory means root-mode: root `PLAN.md` is the one.
2. Phases live under the lane that owns them (`initiatives/<lane>/phases/`, or root
   `phases/` in root-mode), never inside `products/`.
3. `products/` = arc modules. Ventures = separate repos.
4. BRIEFs sleep until their pull-trigger fires.
5. Nothing is built straight from a strategy doc — it must pass through `/arc-kickoff`.
6. Every change: `feat/*` branch → review → PR. Never straight to main.

**Truth hierarchy — one source of truth per question** (same wording as `PORTFOLIO.md`'s
own header):

- `initiatives/<lane>/PROGRESS.md` = **where the work is**
- `initiatives/<lane>/PLAN.md` = **what the cycle is**
- `PORTFOLIO.md` = **index + priority** — a view, never the truth
- `docs/HISTORY.md` = **the immutable company log** (entries tagged with their `[lane]`)

Every value on the board is derived from a lane's `PROGRESS.md` machine header — nothing
is copied from prose and nothing originates on the board. On any mismatch the lane files
win and the board lint flags the drift (ADR-0051).

**Locked vocabulary** — these four words mean exactly one thing each:

| Term | Means | Not the same as |
|---|---|---|
| **Lane** (= initiative) | One product's active work **workspace**: `initiatives/<lane>/` — its work diary (`PLAN.md`, `PROGRESS.md`, `phases/`, `evidence/`, product docs, `archive/`). The only way to name one is `--lane <name>`. | `products/<name>/` — a lane holds *tracker state*, never code ownership |
| **Module** | A product's implementation **body**, registered in `products/<name>/manifest.json`; the files themselves live in the shared machinery (`.claude/`, `tests/`). | a lane, and an app — `products/` is arc's module registry, not a folder of products (see §4) |
| **Company layer** | arc-wide and always single: constitution, commands, CI, ADR ledger, council, spine + inbox, `docs/HISTORY.md`, retro-log, trial-ledger, templates, strategy queue (ADR-0053). | per-lane state — these never split per lane, and no lane writes into another lane |
| **Venture** | A revenue app in its **own repo**, running its own root-mode arc install; never a lane, never tracker state or code inside arc — at most a passport row on the board (ADR-0059). | a lane, and a module — arc is the factory; a venture is what the factory's tools get installed into |

**The rule under the table:** a lane owns *tracker state*, never *code ownership*. Bodies
stay manifest-owned — a lane folder never replaces `products/<name>/manifest.json` as the
ownership map.

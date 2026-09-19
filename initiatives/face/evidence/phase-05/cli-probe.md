# Phase 05 — day-1 CLI probe: every §5.2 verb against the real tools

**Read 2026-09-19, before any door code**, by three read-only agents (kernel · factory · money + company +
command), which read source only and executed no arc script. Every claim below carries the `path:line` the agent
read. Nine claims were then re-read by hand: `arc-profile.sh` is read-only (`:17-21`), `develop.mjs` emits only
`develop.started` · `slice.done` · `handoff.ready` (`:257`, `:298`, `:446`), no `pin-tool` script exists, `arc-legal
propose` prints a script that does not exist (`arc-legal.mjs:484` names `hq/arc-inbox.sh`), `arc-event.mjs` has no
dry-run, and `arc-pnl --close` never emits (`arc-pnl.mjs:411-414`). The verb set is PLAN-face-v2 §5.2; `bench` is split
into run and propose because the two steps behave differently, and `develop checkpoint` is added because the owner's
flagship six names it. KINDS = `.claude/scripts/hq/lib/validate.mjs:39-83`.

**Buckets.** READY: a CLI with a plan mode that runs nothing and an existing kind. SMALL-GAP: the CLI exists and the
kind exists; an additive flag, receipt or wrapper in the owning lane closes it. BIG-GAP: no CLI does it. SESSION: the
real tool is a model-driven session, so it belongs to the session door (Phase 06). NEEDS-KIND: none found.

## Totals — 46 verbs

| | READY | SMALL-GAP | BIG-GAP | SESSION | NEEDS-KIND |
|---|---|---|---|---|---|
| kernel (14) | 1 | 6 | 4 | 3 | 0 |
| factory (17) | 0 | 3 | 6 | 8 | 0 |
| money · company · command (15) | 1 | 6 | 4 | 4 | 0 |
| **all (46)** | **2** | **15** | **14** | **15** | **0** |

Three SMALL-GAP rows (`develop checkpoint`, `design open brief`, `absorb pin source`) are honest only if the generic
`note.logged` is an acceptable receipt; if it is refused they become NEEDS-KIND. The work door's share is the 31
non-session verbs; the session door's is the 15 SESSION verbs.

## The owner's flagship six (PLAN-face-v2 §13 item 4, option A, ADR-1339)

| op | bucket | what closes it |
|---|---|---|
| `bench-a-model` (bench run) | READY | `arc-bench.mjs --driver D --model M --dry-run` (`:461`, `:1605`); plan mode omits `--out` |
| `close month` | READY | `arc-pnl --close` renders the seal and never emits (`:411-414`); apply is the printed `arc-event emit month.closed` line (`:457-458`), run only by the owner's click |
| `growth publish` | SMALL-GAP | the review pack is read-only (`arc-growth.mjs:475-555`); the `content.published` payload is typed by hand from `initiatives/growth/RUNBOOK.md:66-79` — needs a growth command that builds it from the merged tree |
| `ledger criteria` | SMALL-GAP | `arc-pnl --criteria-digest` (`:381-392`) is the plan; apply is `approval.requested` under the existing `ledger.criteria` profile (`validate.mjs:390`) — needs the exact emit line printed, as `--close` already does |
| `capture-idea` | SMALL-GAP | no capture script exists; `arc-event emit idea.captured` (`arc-event.mjs:391-397`) is the tool — needs `--dry-run` on `arc-event` |
| `develop checkpoint` | SMALL-GAP | `develop.mjs checkpoint` (`:531-574`) already writes nothing; the gap is a receipt, not a dry-run (the 2026-09-18 calibration was wrong) — `note.logged` |

## Kernel ring

| room | verb | CLI | bucket | the gap |
|---|---|---|---|---|
| engine | driver switch | NONE — `arc-bench.mjs:1964` "no write path to engine/router.yaml, ever"; `arc-run --driver` is per run (`arc-run.mjs:175`) | BIG-GAP | no script edits `classes.<c>.driver`; ships as propose-only (branch diff + `approval.requested`) |
| model-policy | tier proposal | generic `arc-event emit approval.requested`; engine's own proposal fires only on a failed run (`arc-run.mjs:1725-1751`) | SMALL-GAP | `--dry-run` on `arc-event`, or an engine `propose-tier` reusing that payload |
| policy | cap proposal | NONE — `buildPromotionRequest` (`policy/promotion.mjs:34`) is called only from tests | BIG-GAP | needs a policy CLI computing `policy_hash` + `trial_ledger_ref` for the `policy.promotion` profile (`validate-policy.mjs:198-203`); `hq.policy.yaml` stays unwritable (`policy/resources.mjs:4-7`) |
| scheduler | register job | `arc-jobs.mjs register` (`:325-380`) | SMALL-GAP | `--dry-run`, `--json`, a `note.logged` receipt; registers only rows already in `hq.jobs.yaml` (`:329`) |
| memory | log lesson | NONE — step 3 of `/arc-retro` | SESSION | `lesson.logged` is an invented kind (ADR-1334) |
| memory | promote rule | NONE — `/arc-retro` proposes, the owner approves | SESSION | model-proposed diff |
| evolve | open experiment | `arc-event emit experiment.opened --strict` by hand; `arc-evolve.mjs` has only `board` (`:89`) | SMALL-GAP | an `arc-evolve open --dry-run` that works out `base_sha` (`validate-experiment.mjs:117`) |
| evolve | measure | NONE — library only (`assign.mjs:84`, `verdict.mjs:259`) | BIG-GAP | a CLI over the library; raw emit would put the metric math in the door |
| evolve | conclude | NONE — `verdict.mjs decide` (`:95`), `configHash` (`:231`) | BIG-GAP | same |
| bench | paste model → run | `arc-bench.mjs --driver --model` | READY | (flagship) |
| bench | propose | `arc-bench --propose --champion --out` (`:505-513`) | SMALL-GAP | `--propose` refuses `--dry-run` (`:531`) and always re-runs the bench (spends money) — needs a no-invoke plan, or propose from an existing `--out` |
| absorb | pin source | `study.mjs --scaffold --pin` (`:392-399`) | SMALL-GAP | `--dry-run` + a receipt (`note.logged`, UNSURE) |
| absorb | trial | `judgement.mjs seal` + read-only `ab-run.mjs --json` | SMALL-GAP | seal prints the payload by design (`:165-166`); apply is seal then `arc-event emit --payload-file`; seal has no dry-run |
| absorb | adopt | NONE — "no code path here writes them" (`arc-absorb.md:84-86`) | SESSION | the session assembles `ab_decision` |

## Factory ring

| room | verb | CLI | bucket | the gap |
|---|---|---|---|---|
| council | convene | `/arc-council` | SESSION | its `council.verdict` payload fails the closed shape (`validate.mjs:316`) — would be rejected as BAD_COUNCIL; Phase 06 fixes the payload |
| council | send-to-council | NONE (`arc-inbox.mjs:203-208`) | BIG-GAP | nothing puts a question before the council |
| develop | slice | `develop.mjs start` / `next` (`:183`, `:281`) | SMALL-GAP | `--dry-run` + `--json`. **Hazard:** an unknown `--dry-run` is swallowed as a positional (`lane-resolve.mjs:218`) and `start` really writes — the flag must be parsed, not hoped for |
| develop | proof | filled by hand in the session | SESSION | a `prove` mode over `setSliceField` (`ledger.mjs:305`) would make it SMALL-GAP |
| develop | close phase | `/arc-phase-done` | SESSION | the DoD check is judgement |
| develop | checkpoint | `develop.mjs checkpoint` | SMALL-GAP | (flagship) |
| review-ship | review | `arc-run --process review-diff` (`arc-run.mjs:203`) | SESSION | |
| review-ship | qa | `/arc-qa` | SESSION | no process yaml, so `arc-run` cannot start it yet |
| review-ship | ship | `/arc-ship` (lint · build · test · `vercel --prod`) | SESSION | outward-facing deploy; no process yaml |
| design-studio | open brief | `design-explore.sh init --brief` (`:17`, `:50-98`) | SMALL-GAP | unknown args are skipped (`:53`), so a `--dry-run` would still create folders; needs `--dry-run`, `--json`, a receipt (`note.logged`, UNSURE) |
| design-studio | record pick | NONE in the design lane | BIG-GAP | a design emitter that raises the `approval.requested` the pick decides |
| toolbelt | pin tool | NONE (UI text only, `toolbelt/fold.mjs:114-116`) | BIG-GAP | no CLI at all |
| factory | switch profile | `arc-profile.sh` reads only (`:17-21`) | BIG-GAP | an additive `set <p> --reason` in core |
| executor | hire wizard | NONE — "a hire is a session" | SESSION | |
| executor | dispatch | `arc-run --process P --driver hermes --dry-run` (`:174-205`, `:1506-1555`) | SESSION | the session door itself |
| executor | terminate | NONE — retiring a row is a hand edit of `router.yaml` | BIG-GAP | propose-only, as driver switch |
| agents | add agent | NONE | BIG-GAP | no agent scaffold in any lane |

## Money · company · command

| room | verb | CLI | bucket | the gap |
|---|---|---|---|---|
| overview | capture idea | `arc-event emit idea.captured` | SMALL-GAP | (flagship) |
| money | ingest | `arc-event ingest revenue.received --json` (`arc-event.mjs:16`) | SMALL-GAP | no ledger ingest CLI (`validate.mjs:383`); parsers are library-only (`razorpay.mjs:287`, `mor.mjs:293`) — a ledger wrapper with a dry-run |
| money | criteria | `arc-pnl --criteria-digest` | SMALL-GAP | (flagship) |
| money | close month | `arc-pnl --close` | READY | (flagship) |
| growth | draft | `arc-growth generate` writes a prompt file; the article is written by a skill | SESSION | |
| growth | review pack → publish | `arc-growth publish --preview` | SMALL-GAP | (flagship); a human still merges the PR (`arc-growth.mjs:10-18`) |
| leads | daily send | `arc-leads daily <campaign>` (`:897`) | SMALL-GAP | a `--plan` listing approved drafts and guard verdicts without sending; the caps and send window already refuse (`caps.mjs:29-37`, `guard.mjs:655`); human-started only (`:864`) |
| legal | full-read gate stamp | `arc-legal propose` then `arc-inbox approve` | SMALL-GAP | **bug:** `propose` prints `hq/arc-inbox.sh approve --id` (`arc-legal.mjs:484`) — no such script, and `arc-inbox.mjs` rejects `--id` (`:191`) |
| ventures | register | NONE | BIG-GAP | `venture.registered` is not a kind; the honest route is `approval.requested` `ledger.criteria` after the `ventures.yaml` edit |
| ventures | kill review | NONE — `arc-pnl` only displays the kill panel | BIG-GAP | no kill-proposal command or profile |
| strategy | adopt plan | `/arc-kickoff` | SESSION | |
| strategy | record ADR | inside `/arc-kickoff` and `/arc-change` | SESSION | `adr.recorded` is not a kind |
| org | set lane status | NONE — the `status:` header is hand-edited | BIG-GAP | no CLI writes it |
| org | lane birth | `/arc-kickoff` only (`lanes.md`) | SESSION | |
| concepts | define concept | NONE — terms are hand-edited in `expected-set.json` | BIG-GAP | `concept.defined` is not a kind |

## Shared unlocks

- **`arc-event --dry-run`** (hq lane): validate, seal and print the event with no append. It is the plan step for
  capture idea, tier proposal, open experiment, ingest and the absorb trial emit.
- **The legal `propose` bug** is a one-line fix in the legal lane, found by this probe and filed there.

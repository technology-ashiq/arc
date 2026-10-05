# PLAN (design source) — discover v2: the idea engine, first link of the money chain

> **v2 — redrafted 2026-10-06 against the live tree.** v1 (2026-07-22) is superseded in place; its
> delta is recorded in §Changelog at the foot so nothing it decided is lost silently.
>
> **Trigger (pull, now dated):** `launch` Phase 02 exit (money, test mode) — the venture factory
> can then take a real `venture.yaml`, and the owner ruled 2026-10-03 *"ippo idea illa"* (no
> Nilluvai), so the next real venture has NO source until discover exists. The money chain is
> **discover → launch → bill → distribute → measure → ledger**; three of five links were found
> missing on 2026-10-03 and `launch` was built first. discover is the link that FEEDS it.
> The ruling that fires this trigger goes on the spine as `decision.recorded` in Phase 0 and
> every kickoff ADR cites it (Build-out Mandate / org / launch pattern).
>
> **Prerequisites (all met at redraft, re-verify at kickoff):** spine live (30 kinds) · council
> module live · `launch` P00 CLOSED with `launch-lint` + `venture.yaml` contract (ADR-1710) ·
> growth's `hn-algolia` adapter live with offline fake + verifier.

## Goal

One sentence: `/arc-hunt <niche>` turns raw complaint streams into a **scored, evidenced,
deduped shortlist** that council judges and the owner approves — and an approved idea leaves
as a **`venture.yaml` that `launch-lint` accepts with zero hand edits**, so "what to build
next" stops being vibes and becomes the first receipted step of every venture.

## Current state (2026-10-06 — re-verify at kickoff)

- `launch` LIVE, Cycle 1, P00 ✅ 2026-10-04: `products/launch/ventures/*.venture.yaml` is the
  only input (LAU-J, ADR-1710) — fields `slug · type · region · payment_model · tenancy · ai ·
  honesty_class · compliance[] · brand{name,domain}`. **This is discover's output contract.**
- growth `arc-growth.mjs` already carries `hnAlgoliaAdapter({ offline })` + `hnAlgoliaVerifier()`
  — a public, stable, polite source with a fake. Nothing of it is discover-specific.
- Spine vocabulary is **30 kinds** (`validate.mjs`), not v1's 18: `idea.captured`,
  `council.verdict`, `council.outcome`, `approval.requested`, `decision.recorded`,
  `run.completed`, `cost.incurred`, `revenue.simulated` all exist. **Discover adds zero kinds.**
- face v2 already draws `money/discover` as a PLANNED room, dotted, from
  `initiatives/face/contracts/planned-rooms.json` (ADR-1328). Birth flips it solid — the room
  contract (FV2-C/I) is therefore a kickoff obligation, not UI work.
- Owner's own `saas-market-analysis-agent` (multi-agent pain scraper + SaaS-potential scorer)
  exists outside arc. Opportunity-Scout (ADR-0022) was the v1 audit target and has not moved
  since July. **Phase 0 audits the market-analysis agent, not Scout.**
- Neither `PLAN-evolve.md` nor the memory lane names discover as a producer/consumer. Both
  gaps are closed by one line each in this plan (REQ-08, REQ-09), not by editing their plans.
- Nothing exists of: miners-as-discover, clustering, `score.yaml`, `/arc-hunt`, the
  `venture.yaml` exporter. Branch `technology-ashiq/arc-discover` is at `main` (0 commits).

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-01 | Raw pain becomes structured evidence | Miner v1 over **HN Algolia** (growth's adapter imported, A5) pulls N items for a niche query → NDJSON records (`source_url · text · engagement · ts · source_id`); deleted/empty items, injection strings in titles, oversized bodies, non-UTF8 handled — red fixtures pinned, two-surface adversarial pass done | 0 |
| REQ-02 | No duplicate ideas, ever — across runs AND cycles | Same item fetched twice → one `idea.captured` (spine idem discipline); near-duplicates cluster by deterministic token-overlap (no embeddings); same snapshot → byte-identical clusters; **a cluster matching an earlier `decision.recorded reject` is surfaced as `previously rejected` with the receipt id, never re-scored silently** | 0 |
| REQ-03 | Scoring is explicit and tunable | `score.yaml` weights: pain-frequency · money-signal · buildability-in-2-weeks · moat-hint; every score lists the evidence lines it came from; same input → identical scores; weights are a human edit, `evolve` may only PROPOSE a diff (DIS-C) | 1 |
| REQ-04 | Council judges, calibration fuels | Top-2 clusters get council sessions; `council.verdict` carries verdict · confidence · **`predicted_90d`**; skeptic juror seat mandatory; juror models assigned by ADR-0069 tier names, verifier seat from the independent-family tier | 1 |
| REQ-05 | The human gate is a receipt | Winner → `approval.requested` in the inbox; owner approve/reject **with reason** → `decision.recorded`; reject reason is what REQ-02's cross-cycle dedupe reads | 2 |
| REQ-06 | **An approved idea is a venture, mechanically** | Approval → `products/launch/ventures/<slug>.venture.yaml` emitted by the exporter → `launch-lint` PASSES on it with **zero hand edits**, asserted in CI by a fixture hunt; `honesty_class` is `rehearsal` until the owner flips it in the approval reason | 2 |
| REQ-07 | It ran for real | One real hunt on a real niche end-to-end (mine → cluster → score → council → decision → venture.yaml), evidence bundle committed; time-to-shortlist < 1 hour wall clock | 2 |
| REQ-08 | Evolve has a feed | `predicted_90d` on every `council.verdict` is readable by evolve's calibration through the spine reader (SPINE-G) — asserted by one reader test, no evolve code touched | 1 |
| REQ-09 | Ledger has a first number | Each shortlisted cluster carries `money_signal.estimate_minor` (integer minor units, ADR-1012) + its evidence lines; the exporter writes it into `venture.yaml` as a commented seed for the venture's first `revenue.simulated` — **never emitted as a spine event by discover** | 2 |
| REQ-10 | The face sees it | `products/discover/manifest.json` satisfies the FV2-C/I room contract; `planned-rooms.json` entry removed in the same change; `face-coverage` + `wiki-coverage` green | 0 |

## Appetite

**7 days planned / 8 cap.** Tier: M. The 1.5 extra days over v1 are REQ-06 (exporter + lint
fixture), REQ-10 (room contract) and the mandatory two-surface adversarial pass that v1 did not
budget. 50% tripwire at Phase 1 exit; cut order: REQ-09 → REQ-08 → cluster quality (ship
frequency-sort) → second juror. REQ-06 is never cut — without it discover is a report, not a link.

**Kill criteria:** HN Algolia blocked or changed beyond one day of adapter work → the adapter
contract (DIS-A) swaps in Reddit public JSON; the pipeline is the product, not the source.
Clustering garbage after 2 days → frequency-sort without clusters, clustering recorded as
demand-triggered. `launch-lint` rejects the exporter's output for a reason inside launch's
contract → STOP, route through `/arc-change --lane launch`; discover never patches launch.

## Decisions to ADR at kickoff (century **1900–1999** — claim after sibling-worktree + remote-branch sweep)

| ID | Decision |
|---|---|
| DIS-A | Source adapter contract: `miners/<name>.mjs` exporting `fetch(query, {offline}) → NDJSON` + `verify()`. **HN Algolia first, imported from growth's adapter, never copied** (A5, the DOC-A one-walker posture). Reddit public JSON is the pinned fallback, written only when the kill criterion fires |
| DIS-B | v1 clustering = deterministic token-overlap, zero-dep. Embeddings only through an `arc-run` driver (router.yaml, ADR-1800 profiles) behind its own pull-trigger: precision demonstrably insufficient on a real hunt, recorded in a retro |
| DIS-C | `score.yaml` weights are owner-owned. evolve may PROPOSE a weight diff as an `approval.requested`; nothing applies a weight without a `decision.recorded` |
| DIS-D | Polite fetch: 1 req/s, identified UA, public endpoints only, no login-walled scraping, robots respected. Reputation is a company asset |
| DIS-E | **Output is `venture.yaml`, not a one-pager.** The exporter owns exactly the LAU-J fields; anything the hunt knows that launch has no field for goes in a sibling `<slug>.hunt.md` evidence file linked from the yaml comments. Discover never adds a field to launch's contract |
| DIS-F | Zero new spine kinds. Discover emits `idea.captured · council.verdict · approval.requested · run.completed process=discover@x.y.z · cost.incurred` and reads through the spine reader only (SPINE-G). `hq.policy.yaml` row lands with the first emission (POL-I) |
| DIS-G | Cross-cycle dedupe reads `decision.recorded` rejects from the spine, not a side file — the spine is the memory (REQ-02); no second store of rejected ideas |
| DIS-H | Opportunity-Scout audit is retired; Phase 0 audits `saas-market-analysis-agent` for scoring logic to port. Finding = memo + ADR; porting without the memo is the duplication A5 forbids |
| DIS-I | discover is a venture-scope lane (ADR-0053 organs stay single): ADRs, retro-log, tests at repo root; evidence in `initiatives/discover/evidence/phase-NN/` |

## Non-negotiables

- Miner / normalizer / clusterer / exporter are **parser-class** (hostile web input → a YAML
  file launch executes against). Injection strings from titles must never reach shell, eval or
  the yaml — fixture-proven in both the clusterer AND the exporter (the twin-fix rule: a hole
  closed in one file is checked in every other).
- Two-surface adversarial pass via `/arc-attack` (ADR-0226): one agent on scoring/clustering
  logic, one on the fetch/yaml/OS boundary. Author is never attacker. Carries the lane's
  running defect list.
- Deterministic pipeline: same snapshot → identical clusters, scores, order, yaml bytes.
- Evidence links preserved end to end — a score without clickable sources is invalid; a
  `venture.yaml` without a linked `.hunt.md` is invalid.
- Zero-dep; central `tests/` (ADR-0021); module layout `products/discover/manifest.json` +
  `.claude/scripts/discover/` + `/arc-hunt` (new command — surface change noted in CHANGELOG
  and the generated wiki regenerated, `wiki-coverage` green).
- Model tiers by name (ADR-0069); no quiet `model:` edits.

## No-gos

- No auto-build of winners — approval → `venture.yaml` → the OWNER runs `arc launch new`.
  Discover never invokes launch.
- No multi-source v1 (one + pinned fallback) · no embeddings v1 · no scheduler (hunts are
  human-started) · no sentiment ML · no trend-velocity math · no scraping behind logins, ever.
- No storing full bodies beyond evidence needs; the link is the record.
- No new spine kinds · no edits to launch's contract, evolve's plan or memory's plan.
- No UI beyond the room manifest (the shortlist is markdown; the inbox is the UI).

## Rabbit holes

Source tourism · clustering literature · score-weight perfectionism (yaml edit, iterate on
real hunts) · modelling the venture beyond LAU-J fields · "while we are here" fixes inside
growth's adapter (route through `/arc-change --lane growth`).

## Pre-mortem (top 5)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Hostile input reaches shell/yaml | Parser-class fixtures in clusterer AND exporter; yaml written by a serializer, never string-built |
| 2 | Shortlists are plausible generic slop | Evidence-link rule + money-signal weight + mandatory skeptic juror; REQ-07 is a real niche judged by the owner |
| 3 | Exporter drifts from launch's contract | REQ-06 fixture hunt runs `launch-lint` in CI; a contract change in launch turns discover red the same day |
| 4 | Duplicates re-litigated | REQ-02 idem + cross-run + cross-cycle (DIS-G) tests |
| 5 | Growth's adapter edited "a little" for discover | Import only; any change is a growth lane change |

## Phases

| Phase | Capability | Appetite |
|---|---|---|
| 0 | Ruling on the spine · century claim · market-analysis-agent audit memo (DIS-H) · miner over imported HN adapter + normalizer + red fixtures · deterministic dedupe/cluster incl. cross-cycle · manifest + room contract (REQ-10) · adversarial pass #1 | 3d |
| 1 | `score.yaml` evidence-traced scoring · council wiring with `predicted_90d` + tiered jurors · evolve reader test (REQ-08) · **50% tripwire** | 2d |
| 2 | Inbox handoff → `decision.recorded` · **`venture.yaml` exporter + `launch-lint` fixture (REQ-06)** · money seed (REQ-09) · REAL hunt + evidence bundle (REQ-07) · adversarial pass #2 · retro | 2d |

**Day-3 kill checkpoint (Phase 0 exit):** does a hostile fixture hunt produce identical
clusters twice and refuse every injection fixture closed? No → stop and re-plan.

**North-star:** niche named → council-judged, evidence-linked shortlist in the inbox < 1 hour;
first approved idea becomes `arc launch new <slug>` with zero manual re-research.

## Gates (kickoff checklist)

- [ ] owner-ruling receipt for the trigger on the spine (`decision.recorded`)
- [ ] `launch` Phase 02 CLOSED (or owner waives in writing — then `honesty_class: rehearsal` only)
- [ ] ADR century 1900 swept across sibling worktrees + remote branches
- [ ] WIP acknowledged against `PORTFOLIO.md` (ADR-0052 informational)
- [ ] market-analysis-agent audit memo read before any scorer code
- [ ] FV2-C/I room contract read; `planned-rooms.json` edit in the same PR as the manifest
- [ ] `hq.policy.yaml` row drafted (POL-I)
- [ ] `kickoff-lint` PASS; appetite sum 7d against 8d cap (1d slack, held)

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (only after the trigger fires)

```
/arc-kickoff discover v2 — the idea engine, first link of the money chain --lane discover

Design source: docs/strategy/plans/PLAN-discover.md (v2, owner-approved; trigger: launch P02
exit + owner ruling <receipt id>). Read it fully. Phase 0 opens with the ruling on the spine,
the 1900 century sweep, and the saas-market-analysis-agent audit memo (DIS-H) — if it already
covers scoring, propose port-not-duplicate and STOP for my call. Decisions DIS-A..I locked;
assign ADR-1900+. Output contract is launch's venture.yaml (LAU-J) — never extend it.
Injection fixtures in clusterer AND exporter are non-negotiable.
STOP after PLAN.md + phase specs + kickoff-lint pass — I approve before Phase 0 code.
```

---

## Changelog

- **v2 (2026-10-06)** — trigger dated to launch P02 exit + the 2026-10-03 "no Nilluvai" ruling;
  output one-pager → `venture.yaml` (REQ-06, DIS-E); Reddit-first → HN Algolia via growth's
  adapter (DIS-A); Scout audit → market-analysis-agent audit (DIS-H); spine 18 → 30 kinds, zero
  new (DIS-F); cross-cycle dedupe from the spine (REQ-02, DIS-G); evolve + ledger feeds named
  (REQ-08/09); face room contract (REQ-10); tiered jurors (ADR-0069); two-surface adversarial
  pass budgeted; appetite 1.5w → 7d/8 cap with tripwire + cut order; gates + century 1900;
  kickoff prompt now carries `--lane discover`.
- **v1 (2026-07-22)** — original design source; decisions DIS-A..D, REQ-01..06, three phases.

# PLAN (design source) — evolve v1: the self-improvement engine

> **v1.0 (2026-08-02).** Expanded from `BRIEF-evolve.md` through four owner-review rounds
> (same day, all repo claims verified in-tree twice where noted); supersedes the brief as
> design source — `BRIEF-evolve.md` moved to `docs/archive/` (never deleted; marked in
> the strategy file map).
>
> **Trigger (pull):** ≥1 venture/module with 4+ weeks of real OUTCOME metrics on the
> spine (`metric.observed` receipts — publish/action events alone do NOT count).
> **Prereqs:** spine · ≥1 module manifest with a valid `evolve` section · metric
> vocabulary + feed live via the first client's cycle (EVO-H0) · the Pre-kickoff gate
> below fully evidenced. **NOT fired as of 2026-08-02** — spine history 2026-07-23 →
> 2026-08-02 only; `run.completed` = 0, `council.verdict` = 0, scored council outcomes
> = 0. **This plan sleeps. Do not start before the trigger fires** (Constitution A8).

## Goal

One sentence: the trial-ledger ritual arc already runs by hand on its own gates —
WARN-first trial → evidence → human promote — productized for module surfaces: weekly
scoreboards from the spine, bounded champion/challenger experiments on declared surfaces,
propose-only evidence-threshold proposals with statistical floors and ONE pinned
fixed-horizon verdict test, SHA-bound promotion lineage end-to-end, and rollback that is
detected automatically but merged only by a human — so every module improves on evidence
and **nothing ever changes without a human merge. Not even a rollback.**

## Current state (as of 2026-08-02 — re-verify at kickoff)

- Spine LIVE (C2 closed 2026-07-28): standard emitter, reader/replay, inbox
  (`arc-inbox.mjs` — the promotion-diff path already has a home). Event history
  2026-07-23 → 2026-08-02 only.
- **9 products** (core, council, design, develop, git, hq, plan, qa, review — `develop`
  landed 2026-08-02). No `evolve` key in any manifest.
- **Event vocabulary CLOSED** (ADR-0026; `hq/lib/validate.mjs` KINDS = 22, incl. develop
  kinds per ADR-0106/0107). Neither `metric.observed` nor any `experiment.*` kind exists
  — a client feed is technically impossible today (`UNKNOWN_KIND`), hence the vocabulary
  ownership split EVO-H0 (client cycle) / EVO-H1 (evolve Phase 0). `council.verdict`
  already exists in the vocabulary (0 emitted so far).
- **`PROCESS_RE` = `name@x.y.z`** (validate.mjs) — a `+variant` suffix is rejected today
  (`BAD_PROCESS`); EVO-C extends the grammar backward-compatibly.
- **`product-lint.mjs` hard-fails unknown manifest fields** (`KNOWN_FIELDS` closed set →
  exit 2) — Phase 0 extends it inside the same hostile-fixture corpus (product-lint is
  parser-class; adversarial discipline inherited).
- Closed-payload + idem-binding precedent exists: `assertMoney`, `assertDecision`
  (`decision.idem = sha256("decision.recorded|" + decides)`); `supersedes` (ULID) exists
  on every event — corrections ride it, never overwrite.
- **C2 retro lesson on record:** dup-idem quarantine silently lost ~100 receipts — the
  idem preimage must carry every identity-bearing field (REQ-00 formula is designed
  against exactly that class).
- Hook-mode emission can leave pending/spooled receipts — hence the window-completeness
  rule (REQ-00/REQ-02): incomplete = MISSING, never zero.
- `council-calibrate.mjs` exists (confidence-bucket hit-rates + Brier) but reads Markdown
  session files; scored outcomes = 0. **v1: NO backfill of historical Markdown sessions —
  only receipts emitted from wiring-time forward count.**
- Lanes are law (ADR-0054): this work lives in `initiatives/evolve/`; kickoff needs
  `--lane evolve`.
- Engine (`processes/`, drivers) NOT built and NOT required for v1 — surfaces are
  declared module files (templates); process-yaml surfaces become a client class when
  the engine exists.

## Pre-kickoff gate (nothing below builds until ALL of this is true)

| # | Item | Evidence required |
|---|---|---|
| 1 | First real client + surface chosen | Named module (recommendation: `growth.title-template` — only after growth exists on a live venture with traffic), named canonical file, measurable metric |
| 2 | **Metric vocabulary + feed live in the CLIENT's cycle (EVO-H0)** | The client's cycle shipped: KINDS + closed-payload validator + fixtures for `metric.observed` (to the spec frozen HERE — deviations flagged back to this plan) AND ≥4 weeks of receipts, no window gaps. **Evolve consumes; it never bootstraps its own trigger** |
| 3 | Primary metric + guardrail declared | Primary = **integer successes / integer trials only** (v1), explicit `direction: higher-is-better \| lower-is-better`; guardrail metric with its own direction |
| 4 | MDE + per-arm floor derived from real baseline | Baseline rate + minimum meaningful lift → n per arm — derivation, not vibes. Honest example: CTR 3% → 4.5% at 80% power ≈ **~1,900 per arm** (thousands, not hundreds) |
| 5 | Watch-window definition chosen | BOTH time- and observation-based; watch verdicts obey their own observation floor |

Rollback semantics is NOT an open item — decided (EVO-E): human-approved revert
proposal. Re-opening machine-revert requires a surface actually at L2+, a then-adopted
Constitution, and its own ADR.

## Success requirements

| REQ | User outcome | Measurable acceptance | Phase |
|---|---|---|---|
| REQ-00 | Outcome metrics exist on the spine at all | Spec frozen HERE; vocabulary + build land in the first client's cycle (EVO-H0): `metric.observed` closed payload (module, surface, variant?, cohort?, metric, value, unit_count, window_start, window_end, source_id) via the standard emitter. **Idem = total preimage** `sha256("metric.observed\|module\|surface\|variant\|cohort\|metric\|window_start\|window_end\|source_id")`, absent optionals = literal `-` — champion/challenger in the same window can NEVER collide (the C2 dup-idem class). **`source_id` grammar: `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`, or `h-<sha256-hex16>` for anything derived from URLs/emails/user data — raw URLs and PII never land on the spine** (fixture: URL-shaped source_id rejected). Same-window re-ingest idempotent (fixture); **corrections = new receipt with `supersedes`, never overwrite** (fixture); **a window is COMPLETE only after strict idempotent emission succeeds** — failed/pending/spooled leaves it incomplete (fixture). **Stream contract: `metric.observed` = client feed aggregate/baseline (trigger + board baselines); `experiment.measured` = experiment-attributed unit measurement (verdict math ONLY) — one datum, one stream, the board never double-counts** (fixture) | pre |
| REQ-01 | Modules declare what may be optimized | `evolve` manifest contract (metrics / experiments / evals / promote_via) — `product-lint` extended (`KNOWN_FIELDS` + section validator, same hostile corpus). Absent section = silent (the registration gate carries the requirement); present-but-invalid = exit 2 from birth (zero existing manifests declare it — strict-from-birth breaks no one). Experiment REGISTRATION = hard runtime gate naming exact missing keys; money-touching `promote_via` path = permanent refusal (fixtures) | 0 |
| REQ-02 | See how every module is doing, honestly | `arc evolve board [--window]` renders from the reader only; wipe derived state → replay spine → byte-identical board (fixture). States: `PENDING` (below floor, n-per-arm progress) · loud staleness ("last metric 12d ago") · **`MISSING` for any incomplete window — never rendered or counted as zero** (fixture) · `insufficient evidence` (council). Experiment panels read `experiment.measured`; baseline panels read `metric.observed`; never summed (fixture). No invented numbers, anywhere | 1 |
| REQ-03 | Experiments are bounded, deterministic, sealed | **Assignment:** deterministic `hash(experiment_id\|unit_id)` → arm; **cohort:** deterministic `hash(experiment_id\|unit_id\|"cohort")` → generation\|verdict at configured ratio — disjoint by construction, replay overlap-check as defense in depth. Split fixed from config (default 50/50, no adaptation); both arms tagged symmetrically (`surface@1.0.0+champion` / `+challenger-a`); concurrency cap (config, default ≤2); TTL mandatory — floor unreached in window → auto-archived `no-verdict` WITH data (fixture). **Canonical seal: `experiment.opened` records the target file's `base_sha` (SHA-256); runner and verdict re-compare; mismatch → `experiment.closed` (`killed`, reason `canonical-drift`) and NO proposal until a NEW experiment opens** (fixture: mid-experiment hand-edit → killed) | 2 |
| REQ-04 | Verdicts only exist above honest floors — via ONE pinned test | **Fixed-horizon, compute-once** — verdict computed at most once, when BOTH arms ≥ per-arm floor; no sequential peeking (fixture: early compute refused). Verdict requires ALL of: per-arm floor met (n=floor−1 either arm → impossible; floor met on one arm only → impossible — fixtures) · **the pinned EVO-F test passes** (`newcombe-wilson-difference-v1`: one-sided lower confidence bound of the direction-adjusted improvement at α, config-hashed; **bound ≥ `effect_floor` [default 0 = superiority] AND point delta ≥ MDE** — fixture: delta ≥ MDE but bound < effect_floor → NO verdict, noise cannot win) · guardrail non-breach · zero cohort violations · **missing windows excluded SYMMETRICALLY from both arms** — asymmetric data loss can never manufacture a winner (fixture). **Cohorts:** BOTH cohorts receive deterministic assignment; `generation` data = exploratory monitoring / candidate shaping ONLY; `verdict` data = the decision ONLY, and never feeds generation-side tuning before promotion; same unit in both cohorts = verdict invalid (fixture). Integer-count proportions only v1; other metric families by ADR. **Pinned reference vectors: fixture inputs (counts) → exact bound values, committed with the implementation — replay and any reimplementation must reproduce them bit-for-bit** | 2 |
| REQ-05 | Winners AND rollbacks arrive as evidence — with an unbroken SHA lineage | **Lineage chain (fixture-proven end-to-end):** `experiment.opened → base_sha` ⟶ `promotion.proposed → proposal_id + patch_sha + base_sha + candidate_sha` (diff generated against the sealed base; seal moved ⇒ proposal impossible; target must be on the `promote_via` allowlist — arbitrary paths refused; evidence table incl. bound, floors, window list + MISSING count, cohort audit, config hash) ⟶ **human merge ⟶ `experiment.promoted` emitted ONLY if the observed merged-file SHA == candidate_sha** (mismatch → receipt REFUSED with exact reason; resolution = merge the exact proposal OR close as `canonical-drift`; fixture) ⟶ **the watch window runs ONLY while the current file SHA == candidate_sha** — post-promotion manual drift → `incident.raised` + surface FROZEN, but **NO machine-generated revert patch: the inbox item enters `manual intervention required` state**, carrying expected vs observed SHA + the archived champion artifact reference (restorability = the recovery path; fixture). **Clean-case revert proposal is itself SHA-bound: `applies_to: candidate_sha` + `restores: champion base_sha`** (fixture). Degradation past threshold (its own observation floor met) → automatic `incident.raised` + experiment class demoted L1 + surface FROZEN (no new proposals until the revert proposal is resolved) + urgent SHA-bound revert diff to the inbox. **Every merge is human-only — the machine never writes canonical files, either direction** (fixtures: canonical untouched until merge; healthy window → zero false positives; human-rejected proposal → champion intact). Loser archived WITH data + restorable artifact | 3 |
| REQ-06 | The council measures itself — plumbing first, proof later | Council verdict/outcome lifecycle emits typed receipts (`council.verdict` exists in the vocabulary; outcome kind decided at kickoff); `council-calibrate` re-pointed Markdown → reader; **NO v1 backfill of historical Markdown sessions — only newly emitted receipts count**; juror hit-rates / confidence buckets / Brier on the board; proposed juror-weight change = diff + inbox, human-approved; terminal outcomes < floor → `insufficient evidence`, never invented calibration (fixture on synthetic sessions proves the math) | 4 |

## Appetite

**1 week (7 days) hard cap total. Core engine = Phases 0–3 = 5.5d. Phase 4 (council
bridge) = 1.5d and is THE DESIGNATED CUT** (growth-brief precedent): burn pressure →
Phase 4 banks as a follow-up micro-drop and the cycle still closes whole — council is
honest value, not engine-safety. The first experiment OPENS in Phase 3, so the cut can
never remove the point of the cycle. Retro runs at close either way.
**The real verdict is NOT inside the appetite** — it is an operational-runway milestone
that lands whenever real traffic meets the floor (weeks are normal; that is honest
physics, stated out loud).
**Kill criteria:** 50% burnt without REQ-02 (board reproducible from replay) → the
reader-only derivation is fighting the spine; bank contract + lint + vocabulary ADRs as
documentation, stop, retro. Floor/cohort/seal/lineage enforcement can't be made
fixture-deterministic after 1 day of fixes → stop and redesign the receipt grammar —
never ship a floor that can be argued with.
**Cascade rule:** metric feed younger than 4 weeks or gappy at kickoff → the trigger was
mis-read — STOP at kickoff-lint; never build ahead of the data.

## Decisions to ADR at kickoff

| ID | Decision |
|---|---|
| EVO-A | `evolve` contract = JSON section in `manifest.json`: `metrics[]` (name, source event, aggregation, direction, primary\|guardrail), `experiments[]` (surface file, variant grammar, fixed split, excluded categories), `evals` (holdout rule, per-arm floor, minimum-effect rule, **test id + α + effect_floor**), `promote_via` (exact canonical-target file allowlist — arbitrary paths never allowed). `product-lint`: `KNOWN_FIELDS` + section validator, same hostile corpus; absent silent / invalid exit 2 / registration hard gate / money paths permanent refusal |
| EVO-B | Metrics live ON THE SPINE as `metric.observed` receipts (standard emitter, reader-only consumption, A5 — no metrics DB/warehouse). Ingestion owned by the client's cycle to THIS spec; manual CSV command acceptable v1; analytics-API fetchers = separate pull-trigger later. **Stream contract vs `experiment.measured`** (aggregate/baseline vs experiment-attributed; no double-count). **Window completeness = strict idempotent emission or MISSING, never zero.** **source_id bounded grammar; hashed form for external identifiers; no raw URLs/PII** |
| EVO-C | Variant grammar (validator-extension ADR): `PROCESS_RE` → `name@x.y.z(+slug)?`, slug `[a-z0-9][a-z0-9-]{0,31}`; legacy `name@x.y.z` values stay valid (replay-safe); variant MANDATORY on experiment-attributed receipts, absent elsewhere; symmetric tagging (champion carries `+champion` — no untagged-arm inference) |
| EVO-D | Typed receipts, closed payloads, idem-bound (assertDecision template): `experiment.opened` (**base_sha**) / `experiment.assigned` / `experiment.measured` (cohort) / `experiment.verdict` (config + metric hash — replay re-derives) / `promotion.proposed` (**proposal_id + patch_sha + base_sha + candidate_sha**; kind promote\|revert — revert carries **applies_to + restores**) / `experiment.promoted` (**proposal_id + commit_ref + observed_candidate_sha — REFUSED on mismatch**) / `experiment.rolled_back` (at the human merge, commit ref) / `experiment.closed` (winner\|no-verdict\|killed·reason). Free-form payloads never carry decision-critical experiment data. Corrections via `supersedes`, never overwrite |
| EVO-E | **Rollback = propose-only, both directions.** Automatic: floors-guarded detection, `incident.raised`, class→L1, surface freeze, urgent SHA-bound revert diff — **or `manual intervention required` when post-promotion drift makes a machine patch unsafe** (machine never patches an unknown base; the archived champion is the recovery path). Human-only: every merge. NO machine canonical write exists in evolve — A6 absolute, no carve-outs. Re-open only via L2+ surface + adopted Constitution + new ADR |
| EVO-F | **Verdict test pinned: `newcombe-wilson-difference-v1`** — one-sided lower confidence bound on the direction-adjusted improvement (challenger − champion for higher-is-better; inverted otherwise), α from `evals` config (default 0.05). **Verdict iff: bound ≥ `effect_floor` (default 0 = superiority; per-surface override toward MDE for extra-conservative surfaces) AND point delta ≥ MDE** AND floors AND guardrail AND cohort-clean AND symmetric window exclusion. Fixed-horizon compute-once, no peeking. Integer counts only. **Formula id + version + α + effect_floor mandatory in the config hash; reference vectors pinned as fixtures.** Rationale for effect_floor ≠ MDE as default: floors are derived at 80% power to DETECT MDE — requiring bound ≥ MDE at that n promotes ~5% of the time even when the true effect equals MDE, making the engine inert and the floor derivation incoherent; the knob exists, hashed, for surfaces that want the stricter rule deliberately |
| EVO-G | First client = growth title templates (only after growth exists on a live venture). Council = Phase 4 plumbing integration, THE DESIGNATED CUT, **no historical backfill v1**. L1/L2 demotion tags are LOCAL to evolve v1 — the policy engine owns the global ladder later; evolve migrates to it, never the reverse |
| EVO-H0 | **Metric receipt enablement — lands in the FIRST CLIENT's cycle, not evolve's:** vocabulary ADR adding `metric.observed` + closed payload validator + idem total-preimage formula + source_id grammar + fixtures, implemented to the spec frozen in THIS plan (deviations flagged back here). Without it the 4-week prerequisite is technically impossible (`UNKNOWN_KIND`) |
| EVO-H1 | **Experiment vocabulary — evolve Phase 0:** vocabulary ADR adding the EVO-D experiment/promotion kinds (exact list frozen at kickoff), closed payload validator per kind. Precedent: ADR-0106/0107 |

## Non-negotiables

- Propose-only. NEVER self-merge; the machine NEVER writes canonical files — not to
  promote, not to revert (Constitution A6, no exceptions, no carve-outs).
- Never touches the Constitution — machines may cite, never amend.
- Floors / α / effect_floor / windows / splits in config; **enforcement in code**;
  adversarial breaking pass on the manifest validator, receipt validators, floor +
  cohort + seal + lineage + watch-window enforcement before any FAIL promotion
  (parser-class rule).
- No experiments on money-touching surfaces (pricing, payments, revenue manipulation) —
  permanently rejected at the contract layer (fixture).
- Deterministic everywhere: hash-based arm AND cohort assignment, total-preimage idems,
  replay-identical board, config-hash-carrying verdicts, SHA-bound lineage at every hop.
  If replay can't re-derive it, it doesn't count.
- Absent data is MISSING, never zero. Corrections supersede, never overwrite. No raw
  URLs/PII on the spine.
- Reader-only spine consumption; standard emitter for all receipts; real vs simulated
  never mixed. Zero-dep Node + POSIX.

## No-gos

No auto-merge ever · no machine canonical writes (including revert) · no machine revert
patch after post-promotion drift (`manual intervention required` instead) · no
adaptive/Bayesian/bandit allocation · no sequential/peeking analysis · no second verdict
formula (one pinned test; alternatives = ADR) · no auto-created experiments (humans open
them v1) · no prompt-tuning loops (surfaces = declared files only) · no metrics
DB/warehouse (the spine is the store, the board is derived) · no analytics-API fetchers
v1 · no dashboard UI (CLI board; the dashboard module owns pixels later) · no
cross-module meta-optimization · no experiments on governance/Constitution surfaces ·
no policy-engine build-out (local tags only) · no free-form experiment payloads · no
zero-filling missing windows · no council Markdown backfill v1.

## Rabbit holes

Statistical elegance beyond the ONE pinned test (CIs, families, corrections — EVO-F is
the v1 ceiling) · metric-taxonomy perfection (start with the 2–3 metrics the client
actually has) · generalizing the contract for hypothetical modules (design for growth +
council, extend by ADR) · rebuilding the autonomy ladder (the policy engine's job) ·
backtest frameworks (unseen titles can't be backtested) · event-grammar creep (EVO-H1
freezes the kind list; new kinds = new ADR, not new payload fields) · lineage
over-engineering (four SHA hops are enough; no merkle trees).

## Fixture manifest (must-have, adversarial-pass scoped)

Manifest: missing section (silent) · invalid structure (exit 2) · unknown field
(exit 2, existing corpus) · money path in `promote_via` (refused) · registration
without contract (refused, names keys).
Grammar/receipts: bad `+variant` slug (`BAD_PROCESS`) · legacy `name@x.y.z` valid ·
experiment receipt without variant (rejected) · champion + challenger, same
surface/metric/window → DISTINCT idems, both sealed · same-window re-ingest idempotent ·
correction via `supersedes` lands, overwrite impossible · URL-shaped source_id rejected;
hashed form accepted.
Runner: same unit re-assigned across replay → identical arm AND cohort · n=floor−1
either arm → no verdict · floor met on one arm only → no verdict · cohort collision →
verdict invalid · TTL expiry → `no-verdict` archived · mid-experiment hand-edit of the
sealed target → `killed`/`canonical-drift`, proposal impossible · early verdict compute
(pre-floor) refused.
Verdict math: pinned reference vectors (counts in → exact newcombe-wilson bound values,
bit-for-bit) · delta ≥ MDE but bound < effect_floor → NO verdict · all-conditions pass →
verdict · guardrail breach → no verdict · window MISSING on one arm → excluded from
BOTH arms.
Board: replayed spine → byte-identical board · stale feed → loud age banner · below
floor → `PENDING` · failed/pending emission → window MISSING, never zero · council
below floor → `insufficient evidence` · no double-count across `metric.observed` /
`experiment.measured`.
Promotion/rollback lineage: winner → allowlisted SHA-bound diff + evidence + inbox
item, canonical target UNCHANGED · seal moved ⇒ proposal impossible · approved proposal
but merged file SHA ≠ candidate_sha → `experiment.promoted` REFUSED · post-promotion
drift → incident + freeze, NO machine revert patch, `manual intervention required` with
archived-champion reference · revert proposal binds `applies_to` + `restores` ·
human-rejected proposal → champion intact · watch breach (own floor met) → incident +
L1 + freeze + urgent SHA-bound revert proposal, canonical still unchanged · healthy
watch window → zero false positives.

## Pre-mortem (top 8)

| # | Failure cause | Mitigation |
|---|---|---|
| 1 | Noise-chasing on tiny samples | Per-arm MDE-derived floors + pinned one-sided bound (EVO-F) + cohort holdout + TTL `no-verdict` |
| 2 | Silent template drift outside the loop | `base_sha` seal at open, re-checked at run/verdict/proposal → `killed`/`canonical-drift`; `promote_via` allowlist |
| 3 | Merge ≠ proposal (human merges a tweaked diff) | `experiment.promoted` refused unless merged SHA == candidate_sha; the watch never starts on an unverified champion; resolution = exact merge or close-as-drift |
| 4 | Post-promotion manual edit poisons rollback | Watch precondition (current SHA == candidate_sha); drift → incident + freeze + `manual intervention required`; the machine NEVER emits a patch against an unknown base; archived champion = the recovery path |
| 5 | Degraded champion lives until a human acts (cost of propose-only rollback) | Bounded honestly: v1 surfaces sit on L1 modules (publishes are inbox-gated anyway); breach → freeze + urgent inbox + incident; machine-revert re-arguable only by ADR at L2+ |
| 6 | Metrics never arrive / spool stalls / missing data manufactures a winner | EVO-H0 in the client's cycle BEFORE kickoff; window completeness (MISSING ≠ zero); symmetric exclusion; total-preimage idems (the C2 class, closed) |
| 7 | Verdict-in-appetite physics | Build acceptance = pipeline fixture-proven; the real verdict = runway milestone outside the cap |
| 8 | Formula/vocabulary ambiguity breaks replay | ONE pinned test id+version in the config hash + bit-for-bit reference vectors; EVO-C backward-compatible grammar; EVO-H0/H1 extend the closed vocabulary by ADR with closed payloads |

## Phases

| Phase | Scope | Exit evidence | Appetite |
|---|---|---|---|
| pre | Pre-kickoff gate: client + EVO-H0 shipped in the client's cycle + feed ≥4w + metric/guardrail/direction + MDE→floor + watch definition | All 5 rows evidenced; `metric.observed` receipts live | — |
| 0 — Contract | `evolve` manifest schema + product-lint extension (hostile corpus) · EVO-H1 vocabulary ADR + typed receipt validators (idem, seal, lineage fields) · EVO-C grammar extension · prohibited-surface guard | Hostile manifest/receipt/grammar fixtures all exit correctly; invalid registration impossible | 1.5d |
| 1 — Board | Reader-only reducer; `PENDING` / staleness / `MISSING` / `insufficient evidence` states; stream separation | Golden fixture; replay ⇒ byte-identical; no direct spine reads; no double-count | 1d |
| 2 — Runner + verdict math | Deterministic arm+cohort assignment, fixed split, symmetric tags, per-arm floors, **EVO-F pinned test + reference vectors**, TTL, concurrency cap, canonical seal — **adversarial pass on floor + cohort + seal + no-peeking** | All runner + verdict-math fixtures green; no early verdict possible | 1.5d |
| 3 — Promotion safety + first experiment | **Full lineage chain** (proposal → verified promoted → SHA-gated watch → SHA-bound revert / manual-intervention path) + evidence table + inbox + freeze — **adversarial pass on the lineage/watch path** · **first real experiment OPENED on the chosen surface** | Lineage fixtures green end-to-end; canonical provably unchanged until human merge; experiment live in `PENDING` | 1.5d |
| 4 — Council bridge (**DESIGNATED CUT**) | `council.verdict` emission + outcome kind + `council-calibrate` re-pointed to the reader (no backfill) + board columns · retro at close (runs even if this phase is cut) | Council metrics visible (honest-empty ok) — or the cut recorded + banked as follow-up | 1.5d |
| runway | Operational: collect to per-arm floor → EVO-F verdict → evidence-threshold proposal → human merge (SHA-verified) → watch window | Only here does a real winner/loser exist — calendar-independent by design | post-cycle |

**North-star:** one real surface runs the full loop with zero unhuman changes and an
unbroken SHA chain: opened (base sealed) → both arms tagged in live receipts, distinct
idems → board renders `PENDING` and `MISSING` honestly → a fixture-simulated winner
passes floor + MDE + pinned bound + guardrail → sealed-base allowlisted diff lands in
the inbox with its evidence table → the human merges → the promoted receipt verifies the
merged SHA → the watch runs only on the verified champion → a fixture-simulated
degradation freezes the surface, raises an incident, posts a SHA-bound revert proposal —
**and at no hop, forward or backward, did the machine touch a canonical file, count an
absent window as zero, or trust a file it couldn't hash-verify.**

## Changes vs BRIEF (the deviations, on the record)

1. **Rollback is no longer auto-revert.** The brief's REQ-5 said auto-revert and its
   kickoff prompt called rollback a locked non-negotiable — while the same brief locked
   propose-only. The two conflict; the owner resolved toward propose-only (review of
   2026-08-02). Detection / incident / L1 demotion / surface freeze stay automatic; the
   revert MERGE is human. Deliberate deviation from the brief's letter.
2. **REQ-00 + EVO-H0 added:** the trigger needs outcome metrics on the spine, but no
   brief anywhere built that path — and the closed vocabulary (ADR-0026) makes the kind
   itself impossible without an ADR. Spec frozen here; vocabulary + ingestion land in
   the first client's cycle (chicken-egg resolved).
3. **The verdict moved out of the build appetite** — "first experiment run to a verdict"
   inside 1 week is physically dishonest once floors are real; the operational runway
   absorbs it.
4. **Repo-reality migrations named:** manifests are JSON and `product-lint` closes
   unknown fields; `PROCESS_RE` rejects `+variant`; the event vocabulary is closed —
   EVO-A/C/H0/H1 carry the exact extensions.
5. **Hardening absent from the brief:** guardrail metrics, MDE-derived per-arm floors,
   the pinned newcombe-wilson verdict test with config-hashed α/effect_floor, cohort
   holdout (both cohorts assigned; verdict-only decisions), canonical seal + full SHA
   promotion lineage, window completeness (MISSING ≠ zero, symmetric exclusion),
   experiment TTL, concurrency cap, surface freeze, symmetric variant tagging,
   source_id hygiene, stream contract, council no-backfill.
6. **Kickoff prompt gains `--lane evolve`** (ADR-0054 post-dates the brief).

## Open decisions at kickoff (6)

Council outcome-receipt kind (EVO-H1 list) · evidence-table field freeze (schema shared
with bench later) · TTL + concurrency values · cohort split ratio (generation:verdict) ·
α confirm (0.05 default) + per-surface `effect_floor` (0 default — raise deliberately if
wanted) · guardrail thresholds + directions per metric.

---

## KICKOFF PROMPT — paste into Claude Code in the arc repo (ONLY after the Pre-kickoff gate is fully evidenced)

```
/arc-kickoff --lane evolve evolve v1 — self-improvement engine
Design source: docs/strategy/plans/PLAN-evolve.md (approved; pre-kickoff gate evidenced:
<client module> shipped EVO-H0 and has 4+ weeks of metric.observed receipts — name it,
link the feed). Read it fully. Decisions EVO-A..H1 are locked; assign next free ADR
numbers (EVO-H1 extends the ADR-0026 vocabulary; EVO-C extends PROCESS_RE
backward-compatibly; EVO-H0 must already be law from the client's cycle — verify, flag
any spec deviation). Propose-only is absolute both directions; the SHA lineage chain
(opened → proposed → verified promoted → gated watch → bound revert) is load-bearing —
fixtures before code. Verdict test = newcombe-wilson-difference-v1 exactly as pinned
(α + effect_floor in the config hash). Phase 4 (council) is the designated cut. STOP
after PLAN.md + phase specs + kickoff-lint pass — I approve before Phase 0 code.
```

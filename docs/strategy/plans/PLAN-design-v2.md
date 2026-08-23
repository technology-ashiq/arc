# PLAN — design v2 · "Eyes, Taste, Rivals" — v1.2

> **STATUS: kickoff-grade — landed owner-instructed from a Cowork session, 2026-08-23.**
> The owner branches/commits/PRs this drop himself (no machine git). Kickoff runs via the
> paste-ready prompt in §14. Decisions are letters (**DSV-A…L**); real ADR numbers are
> assigned at kickoff from the century claimed per `PORTFOLIO.md` — never here.
> `PLAN-design.md` (v1, this lane's C3 pack) is **NOT superseded**: its Part 4 record
> stays LOCKED and inherited, and its REQ-01 two-stream evidence bar is still `active` —
> both files stand in `plans/`.
>
> **Provenance:** quality root-cause analysis (2026-08-23, this session: 13 renders read
> with vision, agents/scripts/rankings/critiques audited) → plan v1.0 → one external
> review brought by the owner (same day) → **every review point verified against the repo
> before adjudication** (ADR-0070 read; `design-render.sh` read line-by-line; Mobbin docs
> fetched) → v1.1 decisions → this canonical-format pack (v1.2, content unchanged from
> v1.1). Full adjudication trace: §10's rejected registry carries what died and why.
>
> **Trigger: FIRED twice over.** (1) The owner's Build-out Mandate (2026-08-09) — arc
> build-out is the sole priority, no trigger-waiting. (2) **ADR-0070's own revisit
> trigger**: it names "a looser brief + owner dissatisfied on craft grounds" — the owner
> scored lane output ~10/100 on craft (2026-08-23), and this plan's regime (eyes +
> reference packs + craft-first jury) is exactly the "materially more room" case ADR-0070
> called untested. EXP-A1 (§4 REQ-08) is that ADR's prescribed re-run, not an override.
>
> **Hard prerequisites:** PR #61 (design C3) merged by the owner — parallel step, blocks
> nothing before P03's full explore. The #57 stable-shutter guard is ALREADY IN TREE
> (verified 2026-08-23, `design-render.sh` ~L239) — P00 **re-proves** it on the target
> environment; it does not re-build it.
>
> **Appetite: Tier M — 10 days effort.** Kill triggers in §9 (50% tripwire on the
> renderer phases; a taste-loop tripwire before any rival spend).

---

## 0. One-liner

The design lane's composer gets **eyes** (render-in-loop self-review), the loop gets
**taste** (per-brief reference packs + a craft-first blind jury + the owner's controlled
blind score), and the bar gets **rivals** (v0/Stitch drafts competing blind in the same
jury) — behind a lint-clean source registry where adding a future tool is one YAML entry,
and every claim lands as a receipt on the spine.

## 1. Current state this plan rides on (verified 2026-08-23)

**Exists — reuse, never rebuild:**

| Piece | Where | What this plan takes from it |
|---|---|---|
| Explore machinery | `design-explore.sh` · director/composer/critic/jury agents (C3, ADR-0033..0048) | The whole thesis → 3 variants → critique → blind jury → owner pick chain stays. This plan changes what feeds it and what it optimizes, not its shape. |
| Deterministic renderer | `design-render.sh` | Stable-shutter guard (shoot twice, hashes must agree, retry ×3, refuse + clean up) IS in tree; blank-page + stale-duplicate refusals; `--viewport`, `--media`; `PIN_FONT=0` (owner decision 07-30 — typography judged as designed). |
| **ADR-0070** (model-policy C5) | `docs/adr/0070-*.md` + `initiatives/model-policy/evidence/phase-02/` | Composer stays balanced-workhorse: owner blind ranking went **3–0 workhorse over high-judgment**; A-01 dead. Its paired same-commit harness (SHA-asserted fixtures, per-invocation override, sealed key) is reused whole for EXP-A1. Its logged deviations (no pre-registered prediction; no reference item) are exactly what EXP-A1 fixes. |
| Critique runner + gates | `design-critique.sh` · `design-lint.mjs` · `critic-scope-check.sh` | PASS ≡ zero VIOLATION + zero BELOW-BAR; write boundaries; agents judge / scripts measure (ADR-0048). Unchanged law. |
| Refusal-precedent library | `design-explore.sh` ₹-entity fix · anchored-grammar gates | The lane already learned: a gate that refuses correct work is broken, not strict. DSV-H (doc-surface gate) is built marker-based because of it. |
| shadcn MCP | Owner's machine, already installed | Component source at ₹0, day one. |
| Driver/adapter pattern | engine lane, ADR-0200..0206 | Rival adapters (v0, Stitch) follow it — no new pattern class. |
| Spine + closed vocabulary | ADR-0026 lineage | `review.completed {lens:design}` · `decision.recorded` · `note.logged` carry everything here. **Zero new kinds.** |
| Lanes + shared-file law | ADR-0050..0062 · `lanes.md` | `/arc-kickoff --lane design`; `.mcp.json` edits follow the pre-edit `git log` check + stronger-version merge rule. |

**Corrections on record (found while verifying the external review):**

1. **"Fix #57" is a stale claim** — the guard exists; the plan's renderer phase is a
   re-proof, and cross-OS hash equality is OUT of contract by construction (`PIN_FONT=0`
   ⇒ per-platform internal stability is the only honest guarantee).
2. **Mobbin MCP is paid (Pro/Team/Enterprise) + OAuth** (docs.mobbin.com/mcp) — the free-tier
   assumption in plan v1.0 was wrong. Registry default: `off`; free galleries carry
   reference duty from day one.
3. Two real renderer limits remain and are REQ-01's whole job: session hardcoded
   `design-critic` (L62 — parallel renders race) and one PNG/JSON per route slug
   (iteration history overwritten).

## 2. Scope

**IN (v2):** session-safe + iteration-safe renderer · composer render-in-loop (≤3
self-review iterations, immutable receipts) · platform-contract viewport set ·
`design-curator` + per-brief reference packs (provenance-only in git) · craft-first
N-item model-mixed jury · pack-anchored BELOW-BAR · marker-based doc-surface gate ·
`design.sources.yaml` registry + lint + tier-1 wiring (shadcn, 21st, galleries; Mobbin
behind owner's paid opt-in) · rival drafts (spike → blind integration; v0 first, Stitch
second) · governance lints (arc-only outbound packages, adaptable-principle discipline,
spend caps) · EXP-A1 (ADR-0070 revisit) · controlled owner blind-score ritual + standing
control + sealed predictions.

**OUT (v2) — §10 carries the graveyard:** permanent composer re-seat by fiat · browser-tier
tools (Uizard/Visily/UX Pilot/Banani/Magic Patterns/Readdy) as pipeline stages — manual-drop
door only · reference images committed to git · design evals suite (stays W3+ per DES-G
lineage) · any softening of REQ-01/ADR-0040 blind-stream bars · new spine kinds · Refero
until the owner wants a paid login source.

## 3. Decision record — DSV-A … DSV-L

ADR numbers at kickoff. Each: the decision + why + provenance round.

**DSV-A — Composer tier changes ONLY through EXP-A1, never by fiat.** ADR-0070 stands:
the owner's own blind ranking went 3–0 against high-judgment inside tight rails, A-01 is
dead, and a permanent re-seat would overturn a receipted decision on intuition. Its
revisit trigger has now fired, so the question re-opens the way that ADR prescribes: the
same paired same-commit harness, run in the NEW regime (eyes + pack + craft jury), with
the pre-registered owner prediction and reference item the first run lacked. Promotion
only by the standing formula (material owner-visible gain AND explicit cost/time
acceptance). *(External review P0-1, verified against ADR-0070 + phase-02 evidence.)*

**DSV-B — The composer sees its own work: render-in-loop, ≤3 iterations, immutable
receipts.** One scoped Bash entry point (`design-render.sh` only — the critic's
allowlist pattern). compose → render → read own PNG with vision → revise. Iteration
outputs are immutable (`self-review/iter-N/{render.png, meta.json}`) with a per-variant
manifest (input sha · output sha · defect claim · revision reason) — "iteration 2 fixed
what iteration 1 found" must be provable, not narrated. Cost stated: the stable shutter
doubles captures, so ≤3 iterations × 3 variants ⇒ up to 18 captures per explore.
*(Root cause 2; review P0-4 fixed the receipt model.)*

**DSV-C — The renderer is session-safe before anything runs in parallel.**
`--session <id>` becomes mandatory in explore mode (critique path keeps its named
session); each composer loop gets a unique run+variant session. Acceptance is a test, not
a promise: 3 concurrent renders, each producing its own route's correct stable hash.
*(Review P0-3, verified at `design-render.sh` L62.)*

**DSV-D — Viewport set derives from the brief's platform contract.** Desktop 1440×900 +
mobile 390×844 when mobile is `yes`. The critic judges every rendered viewport; a
declared-but-unrendered surface is a run gap that blocks PASS. A platform contract the
pipeline never renders is a contract nobody signed. *(Root cause 5.)*

**DSV-E — Reference packs: images cached locally, provenance in git, principles not
pixels.** `design-curator` (vision mandatory) builds a per-brief pack: 5–8 screens from
registry `reference-only` sources → gitignored `.claude/state/design/refpacks/<brief>/`;
the repo commits `sources.md` only — URL · timestamp · content sha · **adaptable
principle** · avoid-this. Composer MUST read the pack with vision before composing (iron
law, same grammar as the critic's). The jury's unlabeled reference item is drawn from the
pack. Copying a specific design stays what PLAN-design v1 called it: slop with extra
steps, and legal risk. *(Root cause 4; review Policy-1 + Policy-2.)*

**DSV-F — The jury ranks craft first, N items, model-mixed.** The juror agent contract is
amended for N items (ADR-0070 had to log a prompt-override deviation for six items — that
deviation class ends here). Compliance mapping is the lint's and critic's job; jurors
rank hierarchy, type quality, spatial rhythm, colour intent, confidence. Panel is
model-mixed (≥1 juror on a different tier than the composer; mesh diversity when
ARC_LLM_* lands — ADR-0914 direction). ADR-0070's own finding — owner and jury inverted
each other on the same six artifacts — is the standing proof that no single agent ranking
substitutes for the owner's eyes. *(Root cause 3; review independence point, modified.)*

**DSV-G — BELOW-BAR is anchored to the pack.** The critic receives the reference pack and
the test becomes concrete: *"place this beside the pack — same league?"* A sentence-only
reference bar produced sentence-only judgments. *(Root cause 3.)*

**DSV-H — Product canvas ≠ documentation, decided by markers, never by text-match.**
Per-explore surface manifest + `data-arc-doc-surface` attribute classify product vs
demo/reference surfaces; doc-surface content rendered on a product surface is a
deterministic ERR. Text-matching is rejected outright — a legitimate product page may say
"Reference" (the ₹-entity over-refusal is this lane's own precedent that a gate refusing
correct work is broken). The v1 failure this kills: pages spending 30–60% of their scroll
on state-matrix and keyboard documentation, and being ranked UP for it. *(Root cause 3;
review Policy-3.)*

**DSV-I — One source registry, owner-born, lint-guarded, future-proof.**
`design.sources.yaml`: `id` · `kind[]` (inspiration/generator/components) · `access`
(mcp/api/browser/fetch/manual) · `allowed_use[]` (reference-only/draft-variant/components)
· `auth` (none/env/oauth/manual) · optional `credential_ref` · `cost` · `status` (owner
intent: active/trial/off) · `availability` (observed per run, never hand-set) ·
`approved_by` · `added`. **Only the owner adds entries** (lane-birth pattern). Adding a
future site = one lint-clean entry; a new access pattern = one small adapter. Arrays are
load-bearing: 21st.dev is components AND generator, and a singular enum falsified the
registry on day one. *(Review P0-6.)*

**DSV-J — Rivals are evidence, arrive by spike-then-integrate, and never merge.** Same
brief → one draft per rival (v0 first, Stitch second) → same renderer → unlabeled items in
the same blind jury as arc's variants. Before any adapter: a compatibility spike (one
provider, one fixture) proving auth, request model, output retrieval, failure behaviour —
spike receipts record provider version + request + output schema (v0's API is beta;
versions drift). A rival win never becomes a copy: the director assigns a NEW thesis
capturing the winning direction and an arc-authored candidate re-enters critique → jury.
If a rival outranks every arc variant, that fact lands on the spine — the bar stays alive
and embarrassment is receipted, which is the point. *(Root causes 3+4; review P1 split.)*

**DSV-K — Outbound blind packages carry arc-authored renders ONLY.** The packager lint
refuses rival drafts and gallery images in any package leaving the repo (REQ-01 streams,
ADR-0040): authorship honesty and copyright, one gate. *(Review Policy-1/C5.)*

**DSV-L — Calibration is controlled or it is theatre.** Per full explore: seeded shuffle,
short rubric + anchor examples, owner scores 0–100 blind before unblinding (receipted).
Every jury pack carries ≥1 non-arc item (reference; rivals from P05b; a plain-prompt
control every 3rd run so "we beat the plain prompt" stays measurable forever). Sealed at
kickoff: (i) post-P03 controlled blind score ≥60/100 on a lexos-class brief; (ii)
rival-beats-all-arc rate ≤50% by cycle end; (iii) EXP-A1's owner prediction, written
BEFORE the run. Falsified predictions are recorded plainly — a ledger of hits calibrates
nothing (ADR-0038 lineage). *(Review Policy-4 + D-track.)*

## 4. REQ table (M-tier cap: 10 — all measurable)

| REQ | Delivers | Measured by | Phase |
|---|---|---|---|
| REQ-01 | Session-safe, iteration-safe renderer (DSV-C + DSV-B receipts substrate); guard re-proof | 3 concurrent renders → 3 correct route/hash pairs; stable hash ×3 per platform (internal stability only) | P00 |
| REQ-02 | Composer render-in-loop, ≤3 iters, immutable manifests (DSV-B) | ≥1 self-caught defect visibly fixed across iteration receipts on a real run | P01 |
| REQ-03 | Platform-contract viewport set (DSV-D) | Lexos-class brief → 2 renders/variant; critique covers both; unrendered declared surface blocks PASS | P01 |
| REQ-04 | Doc-surface marker gate (DSV-H) | Planted v1-style docs-on-canvas page refused; legitimate "Reference" text passes | P01 |
| REQ-05 | Registry + lint + curator + reference packs (DSV-E, DSV-I) | Lint green; real pack with provenance from ≥2 sources; no image files in git | P02 |
| REQ-06 | Craft-first N-item model-mixed jury + pack-anchored BELOW-BAR (DSV-F, DSV-G) | N-item run with zero logged deviations; ranking reasons cite visual observations; BELOW-BAR findings cite pack screens | P03 |
| REQ-07 | Controlled owner ritual + full taste-loop explore (DSV-L) | Owner controlled blind score recorded as receipt — prediction (i) input | P03 |
| REQ-08 | EXP-A1 — ADR-0070 revisit in the new regime (DSV-A) | Paired run receipts + formula decision ADR; seat tier evidence-backed either way | P03x |
| REQ-09 | Live tier-1 sources + per-run status; rival spike then blind integration (DSV-I, DSV-J) | Pack from ≥2 live MCP/fetch sources with status lines; spike receipts BEFORE adapter code; full rival explore through one blind jury | P04–P05 |
| REQ-10 | Governance: packager arc-only, adaptable-principle discipline, spend caps, manual-drop door (DSV-K) | Packager refuses a non-arc render; policy lint green; dropped file appears attributed in next pack | P06 |

## 5. `design.sources.yaml` — concrete example + initial classification

```yaml
version: 1
sources:
  - id: mobbin
    kind: [inspiration]
    access: mcp
    allowed_use: [reference-only]
    auth: oauth            # paid Pro+ plan — owner opt-in; docs.mobbin.com/mcp
    cost: paid
    status: off            # owner intent; flips only by owner edit
    approved_by: owner
    added: 2026-08-23
  - id: 21st-dev
    kind: [components, generator]
    access: mcp
    allowed_use: [components, draft-variant]
    auth: env
    credential_ref: ARC_DESIGN_21ST_KEY
    cost: freemium
    status: active
    approved_by: owner
    added: 2026-08-23
```

Initial registry (owner's 20 + shadcn), classified — full table:

| Source | kind[] | access | allowed_use[] | auth | cost | status |
|---|---|---|---|---|---|---|
| Mobbin | inspiration | mcp | reference-only | oauth | **paid Pro+** | **off** (owner call) |
| shadcn/ui | components | mcp (installed) | components | none | free | active |
| 21st.dev | components, generator | mcp | components, draft-variant | env | freemium | active |
| v0 (Vercel) | generator | api (beta — version per receipt) | draft-variant | env | freemium | active (spike first) |
| Google Stitch | generator | api | draft-variant | env/oauth (spike confirms) | free | trial (spike first) |
| Figma | generator, inspiration | mcp | draft-variant, reference-only | oauth | freemium | trial |
| Godly · Land-book · Lapa Ninja · Page Collective · SaaSFrame · Awwwards | inspiration | fetch | reference-only | none | free | active |
| Dribbble · Behance | inspiration | fetch | reference-only | none | free | trial |
| Refero | inspiration | browser | reference-only | manual | paid | off |
| Magic Patterns · Uizard · Readdy · Visily · UX Pilot · Banani | generator | browser | manual-drop | manual | varies | manual |

## 6. Phases (10d effort, risk-first)

| Phase | Appetite | Delivers | Evidence gate |
|---|---|---|---|
| **P00 — renderer proof + isolation** | 1d | REQ-01: `--session` + immutable `--out`; guard re-proof per platform. (Owner merges PR #61 in parallel.) | Concurrency test green; ×3 stable hash per platform. |
| **P01 — eyes + viewports + canvas gate** | 1.5d | REQ-02, REQ-03, REQ-04. | Self-caught defect in receipts; planted page refused; legit "Reference" passes. |
| **P02 — registry + curator** | 1.5d | REQ-05 (galleries first — ₹0). | Lint green; provenance pack; no images in git. |
| **P03 — taste loop** | 1.5d | REQ-06, REQ-07 — full explore on a lexos-class brief. | Controlled owner blind score receipted. |
| **P03x — EXP-A1** | 0.5d | REQ-08 — ADR-0070's harness, new regime, prediction pre-registered, reference item present, key sealed. | Result + formula decision receipted. |
| **P04 — live sources** | 1.5d | REQ-09a: MCP wiring (shadcn/21st; Mobbin only if owner opted in), per-run status lines, `.mcp.json` shared-file protocol. | Live pack; status lines; no silent caps. |
| **P05a — rival spike** | 1d | REQ-09b: v0 contract spike (then Stitch) — no jury. | Spike receipts w/ version+schema BEFORE adapter code. |
| **P05b — rival integration** | 1.5d | REQ-09c: adapters (driver pattern), N-item jury live, standing control. | Full rival explore: arc×3 + rival(s) + reference, one blind jury, receipts on spine. |
| **P06 — governance + retro** | 1d | REQ-10; retro settles all three sealed predictions. | Packager refuses non-arc render; predictions settled on the record. |

Each phase lands independently: feat branch → PR → owner merges (git workflow law).

## 7. Pre-mortem (top 5)

| # | Risk | Mitigation |
|---|---|---|
| 1 | Renderer race resurfaces via a new caller | `--session` mandatory in explore mode — absence refuses, no silent default; concurrency test pinned in CI. |
| 2 | Rival API beta drift / regional failure mid-cycle | Spike gates adapter; provider version in every receipt; run degrades arc-only with a printed source-status line. |
| 3 | External imagery leaks into git or outbound packages | Images never committed (DSV-E); packager lint refuses non-arc renders (DSV-K); adaptable-principle discipline per `sources.md`. |
| 4 | Goodhart round 2 — composer learns to please the jury's taste | Packs rotate per brief; rivals differ per run; plain-prompt control every 3rd run; the owner's controlled score stays the human anchor. |
| 5 | EXP-A1 read as seat politics instead of evidence | Pre-registered prediction + sealed key + standing formula; either outcome closes the question with receipts. |

## 8. Retro metric pack (pre-declared, spine-derived only)

Owner controlled blind score per explore (trend) · rival-beats-all-arc rate ·
self-review catch rate (defects fixed before critique / total critic findings) ·
per-source availability lines per run · captures + wall-clock per explore ·
EXP-A1 prediction vs outcome (Brier-style entry).

## 9. Kill criteria

- **50% tripwire:** P00+P01 not green by end of day 3 → stop, reassess the renderer
  approach before any taste work.
- **Taste tripwire:** post-P03 controlled owner score does not beat the plain-prompt bar
  (~40/100) after one re-run → STOP before P04/P05 — no rival spend on a loop that has
  not beaten the baseline it was built to beat.
- Standing arc law: any VIOLATION-class regression in the C3 gates this cycle introduces
  → fix before proceeding, never waive.

## 10. Rejected registry (v2 — adjudicated 2026-08-23; do not re-litigate at kickoff)

| # | rejected | replaced by | why |
|---|---|---|---|
| 1 | Permanent composer re-seat to strongest model | EXP-A1 under ADR-0070's formula | Owner's own blind 3–0 says the seat is not a proven bottleneck inside tight rails; fiat would make the receipted formula decoration |
| 2 | "Fix #57" as a phase | Re-prove existing guard per platform | Guard verified in tree; re-building it wastes appetite |
| 3 | Cross-OS identical render hashes | Per-platform internal stability | `PIN_FONT=0` makes cross-OS equality impossible by design; requiring it manufactures false failures |
| 4 | Singular `kind` / env-only `auth` registry grammar | Arrays + auth enum + status/availability split | Day-one facts (21st dual-kind, Mobbin OAuth) falsified the simple grammar |
| 5 | Text-match doc-on-canvas gate | Marker + surface manifest (DSV-H) | ₹-entity precedent: a gate that refuses correct work is broken, not strict |
| 6 | Reference images committed to repo | Local cached pack + `sources.md` provenance | Copyright, size, and the principle-not-pixels rule from PLAN-design v1 §2.8 |
| 7 | "Steal-this" wording; merge a winning rival | "Adaptable principle"; director assigns new thesis, arc rebuilds | External output is evidence; a copy is slop with extra steps and legal risk |
| 8 | Rivals in one 2-day phase | P05a spike → P05b integration; appetite 8d → 10d | Half-built rival pipeline produces fake confidence |
| 9 | Mobbin as free-tier default source | Paid OAuth, `status: off`, owner opt-in | docs.mobbin.com/mcp: MCP is Pro/Team/Enterprise only |
| 10 | Uncontrolled 0–100 owner scoring | Seeded shuffle + rubric + anchors + plain-prompt control | An uncontrolled number has variance that eats the signal |

## 11. Cross-plan obligations

- **model-policy (ADR-0063..0071):** DSV-A executes ADR-0070's revisit clause; seat tiers
  stay earned-by-A/B (ADR-0064); exploratory trials remain permission-free (ADR-0069 g).
- **bench / mesh (ADR-0914, ADR-0220):** jury model-mixing consumes the per-invocation
  trial seam; full diversity when ARC_LLM_*/codex land — nothing here blocks on it.
- **design C3 (ADR-0033..0048 + PLAN-design v1):** all four contracts, write boundaries,
  closed spine vocabulary, and the REQ-01 two-stream bar are inherited unchanged; the next
  outbound blind package is post-v2 and DSV-K-protected. PLAN-design.md's Part 4 record
  stays LOCKED.
- **policy (POL-A…J):** per-source spend caps ride `hq.policy.yaml`; ₹0 default.
- **lanes law (ADR-0050..0062):** `.mcp.json` and any shared file follow the pre-edit
  `git log` check and stronger-version merge rule.

## 12. Deferred (consciously)

Design evals suite (W3+ lineage from PLAN-design v1 §2.9) · Figma as a full draft-variant
source (registry `trial` until its spike) · Refero (paid login) · browser-tier tools as
anything more than a manual-drop door · gate warn→block promotions (retro + owner's OK
only, v3.5 doctrine) · a cost emitter for per-item rupee attribution (ADR-0070's caveat
stands until the ledger lane ships one — this plan reports time + captures, never invents
rupees).

## 13. Open decisions at kickoff (owner rules there; none block this file)

1. **Mobbin:** pay for Pro (unlocks official MCP, OAuth) or keep `off` and run galleries-only? (Recommendation: start galleries-only, revisit after P03's score.)
2. **EXP-A1 prediction:** which arm wins in the new regime, and why — written and sealed before P03x runs.
3. **Appetite confirmation:** 10d as filed, or trim by dropping P05 to a later `/arc-change`?
4. **First rival:** v0 (recommended — SDK + beta API live) or Stitch first?
5. **Dribbble/Behance:** keep as `trial` reference sources or `off` (gallery quality varies)?

## 14. KICKOFF PROMPT (paste-ready)

```
/arc-kickoff --lane design design v2 "Eyes, Taste, Rivals" — the composer gets render-in-loop self-review, briefs get curator-built reference packs, the jury goes craft-first with N blind items including rival AI drafts (v0/Stitch) behind a lint-guarded source registry, and the composer-tier question re-runs as EXP-A1 under ADR-0070's own revisit clause.

Ground rules for this kickoff:
- Read docs/strategy/plans/PLAN-design-v2.md FIRST. Its §3 decisions (DSV-A…DSV-L) and §10 rejected registry are adjudicated and LOCKED — assign ADR numbers from the century PORTFOLIO.md claims, do not re-litigate. Attack the PLAN.md you produce, not this record. PLAN-design.md (v1) Part 4 stays LOCKED too.
- Preflight: the design lane EXISTS (initiatives/design/) — this is a REVISION/new cycle of that lane, not a new lane. Archive the current lane PROGRESS per preflight rules; never overwrite silently.
- Brownfield: run codebase-surveyor on the design surfaces (design-render.sh session/output model, explore/critique runners, jury agent contract, .mcp.json).
- Hard sequence: REQ-01 (renderer session+iteration safety, guard re-proof) is Phase 0 — nothing composes in parallel before it is green.
- EXP-A1 (REQ-08) runs ONLY after P03's regime exists, reusing ADR-0070's paired harness, with my pre-registered prediction sealed before the run.
- Sealed predictions at kickoff (§3 DSV-L): post-P03 controlled blind score ≥60/100 · rival-beats-all-arc ≤50% by cycle end · my EXP-A1 call.
- Appetite: I will give the number (recommendation on file: 10 days → M-tier). Kill criteria per §9 — the taste tripwire gates all rival spend.
- Owner parallel steps: merge PR #61; decide §13 items 1 and 4 by P04.
```

# arc architecture v2.1 — review verdicts & amended decisions

> 2026-07-18. Input: an external AI review (10 suggestions + a "capabilities layer"
> proposal). This doc adjudicates each item against arc's actual codebase/culture and
> records the amended architecture. Style: draft ADRs — adoptable later via /arc-change.

## Scoreboard

| # | Suggestion | Verdict |
|---|---|---|
| 1 | Rename products → capabilities/modules | **MODIFY** — distinction yes, rename no (for now) |
| 2 | One vertical loop first (spine→brief→approval→kickoff→review/qa→ledger event) | **ACCEPT — strongest suggestion in the set** |
| 3 | Harden event schema (idempotency, version, checksum, outcome…) | **ACCEPT** — schema v1 below |
| 4 | Static router + 3 drivers first, bench later | **ACCEPT** (was already sequenced this way — good confirmation) |
| 5 | Byte-diff for migration only; schema+evals+goldens long-term | **ACCEPT** — correct refinement |
| 6 | Evolve brutally constrained (champion/challenger, holdouts, rollback) | **ACCEPT** — all four constraints adopted |
| 7 | JSONL→SQLite replay as first-class test | **ACCEPT** — pure arc culture |
| 8 | L0–L4 needs an exact permission matrix | **ACCEPT** — matrix below; biggest hole it found |
| 9 | Trader harder isolation + cooldown unlock | **ACCEPT** |
| 10 | Money organs pulled by real product need, not pushed | **ACCEPT** — it's arc's own ADR-0016 philosophy, generalized |
| — | "Four ones" framing (one spine, one process layer, one router, one inbox) | **ACCEPT** — new elevator definition |
| — | Two-layer capabilities/products architecture (12 horizontal capabilities) | **MODIFY** — concept adopted, granularity rejected at solo scale |

Overall: the review is high quality. Its two real contributions are the **steel-thread
sequencing discipline** (#2, #10) and the **enforcement-grade specificity** (#3, #8).
Items 4, 5, 7, 9 tighten what was already designed. Item 1 and the capabilities proposal
are the only places it over-reaches — both get a partial adoption.

---

## V1 · Vocabulary (from #1 + capabilities proposal) — MODIFY

**Problem confirmed:** "product" currently means two different things — arc's installable
modules (council…) AND revenue apps (InvoiceFly). That collision is real and causes false
complexity.

**Decision:** three words, no renames of machinery this cycle:

- **Kernel** — OS parts: `core, engine, memory, evolve, hq` (5 modules)
- **Workflows** — business-work modules: `plan, review, qa, council, git, discover,
  growth, leads, ops, ledger` (10 modules)
- **Ventures** — revenue apps built BY arc, living in their own repos (InvoiceFly, …).
  Ventures are the only things called "products" in public/marketing language.

Same 16 modules as v2 — sharper grouping, zero mechanical churn: the installable unit
internally stays `products/NAME/manifest.json` (product-lint, resolver, registry all
untouched — the current cycle's frozen surface is sacred). A mechanical rename to
`modules/` is **demand-triggered at public release** (rebrand moment), not now.

**Why the 12-capability split is rejected at this scale:** granularity must match the
organization. AWS/Uber/Stripe run a team per capability; arc runs one Ashiq. Twelve
horizontal units = twelve manifests, test suites, and boundaries of pure overhead.
Several proposed "capabilities" already exist inside kernel modules (approvals/scheduling/
events → hq · routing/budgeting/execution → engine · evaluation/experimentation/scoring →
evolve · memory → memory). The proposal mostly re-groups Ring 1+3 into finer pieces.

**What IS adopted from it — the no-duplication law, enforced not hoped:**

> A workflow module may NOT implement its own experimentation, scoring, policy,
> scheduling, eventing, budgeting, or memory. It must call the kernel capability.
> **product-lint enforces this** (new check: workflow manifests declare
> `uses: [evolve, memory, …]`; grep-class detectors flag re-implementations, WARN-first
> per trial culture).

That captures "improve a capability once → every workflow improves" without the
fragmentation. **Split-out trigger** (demand-triggered, ADR-0016 style): a capability
needed by 3+ workflows with divergent copies, or an external consumer, → extract it then.

## V2 · The steel thread (from #2 + #10) — ACCEPT, replaces v2 §8 ordering

**Phase A (one loop, ~2–2.5 weeks of new code, everything else exists):**

```
spine (arc-event.sh + schema v1)
  → ledger EVENT ingest (one revenue.received path — webhook or manual CLI; NOT the ledger module)
  → brief CLI (morning/evening, rendered from the spine)
  → inbox v0 (CLI approve/reject — each decision is itself an event)
  → wired into the EXISTING factory (kickoff/review/qa/phase-done emit events via hooks)
  → run live on a real venture (the current cycle's Phase-04 dogfood targets are the natural host)
```

**Definition of done:** one venture's build-and-first-revenue days fully replayable from
the spine; `rm state.db && arc-replay && brief` byte-matches the golden brief (bats).
**Only after this loop breathes** do engine v1 → process-layer pilot → discover earn
kickoffs. Pull-triggers for the rest (no architecture-push):

| Module | Builds only when… |
|---|---|
| discover | you're ready to pick the next venture |
| growth | a live venture needs traffic |
| leads | a venture/service needs outbound |
| ops | ≥2 live ventures make manual checks painful |
| ledger (full module) | ≥2 revenue sources make the event-level view insufficient |
| bench | ≥2 drivers in real use disagree on quality |

## V3 · Event schema v1 (from #3) — ACCEPT

```json
{ "id": "01J2ZK7…",                  // ULID — time-sortable, globally unique
  "v": 1,                            // schema version
  "ts": "2026-07-18T09:12:33+05:30",
  "idem": "sha256(source:natural-key)",  // idempotency — replays/retries dedupe
  "actor": "arc-phase-done",         // process or human or webhook
  "process": "phase-done@3.2.0",     // process + version (evolve attribution)
  "model": "driver:model-id",        // null for deterministic scripts
  "venture": "invoicefly",
  "run_id": "r-2026-07-18-06",
  "kind": "phase.closed",            // namespaced, closed vocabulary per v
  "payload": { },                    // NEVER secrets — redaction at emit (gitleaks culture)
  "outcome": "ok",                   // ok | fail | partial
  "cost": { "tokens": 184000, "inr": 92 },
  "evidence": "docs/evidence/phase-02/",
  "sha": "content-hash" }            // corruption/tamper check; prev-sha chaining = v2 option
```

Rules: append-only JSONL, daily files; SQLite is always derived; the **replay test** (#7)
runs in CI: rebuild state from JSONL → dashboards/brief must match goldens.

## V4 · Router sequencing (from #4) — ACCEPT (confirms v2)

v1 = hand-edited `router.yaml` (task-class → driver) + 3 drivers: claude-code, codex,
one generic API. Escalation = retry-once-then-one-tier-up, hardcoded. Bench exists only
as fixture folders from day one (cheap), but the bench RUNNER and auto-updating tables
come later, pulled by trigger V2's table.

## V5 · Compile-gate lifecycle (from #5) — ACCEPT

Byte-diff gate = **migration proof only** (hand-written → compiled flip). After the flip,
regression regime per process: output JSON-schema validation + eval fixtures + golden
outputs, where goldens regenerate only via reviewed diff naming the intentional change —
the existing golden-fixture non-negotiable, extended to compiled artifacts.

## V6 · Evolve constraints (from #6) — ACCEPT

Evolve may **propose diffs only** — no self-merge, no silent prompt changes, ever. Plus:

- **Minimum evidence:** no promotion proposal below configured sample floors
  (e.g. n≥30 sends / n≥20 runs — config, not hardcode).
- **Champion/challenger:** current version keeps serving; challenger gets a bounded
  traffic slice; both tagged in every run event.
- **Holdout evals:** promotion judged on fixtures/data NOT used to generate the change.
- **Auto-rollback:** post-promotion, if the champion metric degrades past a configured
  threshold within the watch window → auto-revert + incident event + demotion of that
  experiment class to L1.

## V7 · Policy matrix (from #8) — ACCEPT; levels get teeth

Levels are shorthand; enforcement is a **per-action-kind capability vector** in
`hq.policy.yaml`, deny-by-default, enforced at the runner/driver wrapper (headless) and
PreToolUse hooks (interactive):

| Capability | L0 | L1 | L2 | L3 |
|---|---|---|---|---|
| read files/data | ✓ | ✓ | ✓ | ✓ |
| write files (workspace) | ✗ | draft dirs only | ✓ | ✓ |
| run shell | ✗ | allowlist | allowlist | allowlist+ |
| network calls | ✗ | read-only domains | domain allowlist | domain allowlist |
| message humans (email/DM) | ✗ | draft only | send ≤ caps | send ≤ caps |
| publish (content/social) | ✗ | draft only | ✓ ≤ caps | ✓, weekly digest |
| deploy | ✗ | ✗ | ✓ behind arc gates | ✓ behind arc gates |
| spend money | ✗ | ✗ | ≤ ₹cap/day, notify | ≤ ₹cap/day |
| change prices/refunds | ✗ | propose | ✗ (stays L1) | ✗ |

Per-action-kind entries add specifics (exact domain lists, ₹ caps, channel lists,
recipient scopes). Promotion between levels = trial-ledger evidence, as before; any
incident = automatic one-level demotion.

## V8 · Trader isolation (from #9) — ACCEPT

Own instance dir + own JSONL stream (HQ merges read-only for display) · own credentials
(never shared vaults) · policy file physically separate (`trader.policy.yaml`) · real-money
path requires: hand-written policy edit by Ashiq + **72h cooldown** before it activates +
hard caps + circuit breaker (daily loss limit → auto-L0). Trader can never emit actions
into other modules' queues. Its failure modes cannot touch the OS.

## V9 · The sharpened definition (from the closing framing) — ACCEPT

> **arc is a receipt-driven company operating system: one event spine, one process
> layer, one model router, one human approval inbox.**
> Kernel runs the company, workflows do the work, ventures make the money —
> and every claim has a receipt.

The 16-module catalog is implementation detail beneath that sentence. This framing is
also the public-launch positioning (harder to fake than a feature list — competitors
can copy commands, not receipts).

---

## What the review got wrong or missed (for the record)

1. **12-way capability split** — right instinct, wrong scale (see V1). Adopted as a lint
   law + split-out trigger instead of a directory structure.
2. **Rename now** — collides with the current cycle's frozen-surface no-go; vocabulary
   now, mechanical rename at public release.
3. It didn't say **where** capabilities should live (repo mechanics) — resolved via
   kernel modules + `uses:` declarations + lint.
4. Minor: its steel-thread loop quietly assumes a model driver exists — true (Claude Code
   is the implicit day-1 driver), worth stating so nobody builds engine v1 "for" Phase A.
5. Additions of mine it didn't cover: payload **secret-redaction rule** at emit (V3), and
   ULID event ids for sortability (V3).

## Net effect on the plan

Phase A (steel thread) replaces the old "spine 1w → hq 1.5w → engine 1w" front-load —
engine/process-layer/discover all move BEHIND the working loop and behind pull-triggers.
Nothing else from v2 is invalidated: rings survive as kernel/workflows, all v2 designs
(bench, adapters, evolve contract, data layer) stay — they just **earn their build slot**
instead of being scheduled by ambition. Current cycle (Phases 03–05) still closes first.

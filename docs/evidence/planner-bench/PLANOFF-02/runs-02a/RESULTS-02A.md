# PLANOFF-02A — results (automated pilot variant)

**Ran:** 2026-07-15 · **Arms:** arc · raw (2 of the 5; the sharp planning-vs-no-plan contrast)
**Status:** ☑ complete — real builds, real deterministic grader, real cold handoff.

## ⚠️ Read this first — how 02A differs from the full PLANOFF-02 (all weaken it, stated up front)

1. **Two arms, not five.** Only `arc` (plan-first, artifact-rich) vs `raw` (no plan, bare code). PLANOFF-01
   already showed gsd/gstack/superpowers cluster near arc; the load-bearing question is planning-vs-none.
2. **One model plays both arms** (Claude Sonnet, same model for every arm/continuation — the fairness
   rule that matters). So this measures *methods*, not five real products.
3. **`node:sqlite`, not Postgres** — so the concurrency trap (H8) is a single-process approximation and
   the migration trap (H2) can't be exercised against a real inherited fixture DB.
4. **Automated, not human-driven; arc's real enforcement hooks never fired** — this is a
   *methods-as-prompts* run, exactly like PLANOFF-01A. It measures artifact legibility at handoff, not
   arc's PreToolUse ship-blocking. That cuts *against* arc (its actual moat is unmeasured here).
5. **The grader is real, deterministic code** — so the AUTO probe outcomes are objective regardless of
   who built the arms (no arm grades its own homework). Grader validated: a correct reference app scores
   12/12, a deliberately-broken one fails exactly its 3 planted bugs.

## The build

- **Phase 1 (snip):** each arm built the URL shortener from an identical plain-English goal, blind to the
  grader. Both reached a **fair 12/12 Phase-1 baseline** before the handoff (equal start, by measurement).
  - `arc` left: `PLAN.md`, `NOTES.md`, a structured `lib/`, a clear README, 4 descriptive commits.
  - `raw` left: one `server.js`, a 3-line README, 1 squashed commit ("init").
- **Cold handoff:** each frozen repo was copied, its runtime DB wiped, and handed to a **fresh
  context-isolated agent** (same model) given ONLY the repo + the Phase-2 "team links" goal — no
  transcript, no memory, no one to ask. Each continuation built workspaces, membership, owner-only
  delete, an idempotent migration, API keys, and analytics, then committed.

## The result — cleanly-gradeable probes (12)

| | arc | raw |
|---|---:|---:|
| **Phase-1 regression on the post-Phase-2 build (P1)** | 12/12 | 12/12 |
| Team share · owner-only delete · expired-shared-410 · global-alias (P2,P3,P5,P6) | 4/4 | 4/4 |
| API-key path + inherits rate-limit (P8, U-H4) | 2/2 | 2/2 |
| Malformed percent-escape → 4xx not 500 (U-perc) | ✅ | ✅ |
| hits==clicks, click only on 302 (U-H5) | ✅ | ✅ |
| Concurrency race → one 201, rest 409, no 500 (U-H8) | ✅ | ✅ |
| Malformed analytics params → 400 (U-H7) | ✅ | ❌ |
| **CLEAN TOTAL** | **12 / 12** | **11 / 12** |

**Excluded from the count (documented, not hidden):**
- **P7, U-H2, U-H6** — not black-box gradeable by a generic grader: migration correctness needs the arm's
  own pre-migration fixture DB; UTC-daily-buckets needs a time-travel seam the contract doesn't expose.
- **P9, U-H1, U-H3** — **rate-limit artifacts**: the grader creates far more than 10 links/min from one
  IP, so these late probes' `POST /api/links` hit the arms' *correct* 10/min/IP limit (429). Both arms
  fail them identically — a grader test-design flaw, symmetric, carrying zero arc-vs-raw signal.

## The one real difference

**U-H7** — given an inverted analytics range (`from > to`), `arc` returns `400`/empty; `raw` returns data
(laxer validation). **Neither 500s.** This is a param-validation style choice by each *continuation agent*
— not evidence that arc's committed artifacts helped the continuer understand the inherited system better.

## The continuers' own accounts (subjective — reported, not scored)

Both rated the handoff **9/10**:
- **arc continuer:** *"NOTES.md was the single biggest asset — it explained the WHY, so I extended to the
  design intent instead of guessing from code shape."*
- **raw continuer:** *"code alone did almost all the work — every invariant was legible from the handler
  bodies and inline comments like `// unique constraint race`; the README helped for boot; there was no
  plan/notes file and the single squashed commit added nothing."*

Two different routes to the same 9/10: one read a plan, the other read clean, commented code. Neither
broke a single Phase-1 invariant.

## Verdict

**On the outcome the grader can see: a near-tie — arc 12/12, raw 11/12, separated by one minor
analytics-validation edge case that is not attributable to planning artifacts.** Both arms handed off
successfully across a cold agent boundary; both preserved every Phase-1 invariant (12/12 regression);
both built the full team-links feature set and passed every clean team-feature probe.

**This reproduces PLANOFF-01's core finding in a second, harder setting.** Planning artifacts (a PLAN.md +
NOTES) did **not** produce a decisive handoff advantage over bare-but-legible code at this scale. The
pre-registered prediction — *"planning artifacts do not price meaningfully at handoff for a build of this
size; the field is near-flat"* (moderate confidence) — **holds.** arc did not lose, but it did not
demonstrably win *because of its plan* either.

## Honest caveats on this result

- **Scale is still too small.** Both continuations fit comfortably in one context; nobody was forced to
  resume across a real context exhaustion. The value a plan buys — surviving a boundary a memoryless
  reader *cannot* cross from code alone — was not stress-tested, because Sonnet read either repo fine.
- **The grader's rate-limit poisoning** cost 3 probes of coverage. A real re-run should reset or space
  the limiter, or lower per-probe create counts.
- **arc's actual moat (deterministic ship-blocking) never ran** — 02A is methods-as-prompts. An arc win,
  if it exists, most likely lives in the D2 "native-toolchain, hooks live" probe this pilot did not run.
- **One model, two arms, one trial.** No statistical claim. This is one honest data point, not a verdict
  on planning.

## What would actually move the needle (next)

A build that genuinely **does not fit one context** (or a forced hand to a *second* agent mid-build with
the first agent's context truly gone), real toolchains with arc's hooks live, Postgres, and ≥3 trials.
Until then: at single-agent, single-context scope, **a good plan and clean, commented code are
interchangeable for handoff** — which is the same thing PLANOFF-01 said, now said twice.

---

*Provenance: build + grader + handoff artifacts live under the session scratchpad
(`planoff-02a/`). Grader = `runs-02a/grade.mjs` (this dir). Raw probe outputs =
`runs-02a/arc-p2-phase2.json`, `runs-02a/raw-p2-phase2.json`. Model: claude-sonnet (all arms). One
operator (this session) — a limitation the full PLANOFF-02 protocol removes with blind, human-driven,
five-arm runs.*

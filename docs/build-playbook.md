# The Build Playbook

A generic, reusable process for building any software/AI project well — from idea to deployed.
Battle-tested on a real multi-agent system. Copy this file into every new project and follow it.

> **Mantra:** *Plan it · fake it (offline-first) · prove it (tests + live demo) · make it
> swappable (config + adapters) · make it survive (resilience) · track it (3 layers) · verify for real.*

> **Wired into this template:** `/arc-kickoff` scaffolds §9 using `docs/templates/` (PLAN with
> appetite/no-gos/rabbit-holes/pre-mortem, ADRs in `docs/adr/`, phase specs) ·
> `/arc-phase-done <n>` enforces the §8 Definition of Done · the SessionStart hook prints
> PROGRESS.md's current position at every session start, so the build state is never forgotten.

---

## 1. The Golden Loop — repeat for every phase

```
Plan  →  Build the smallest working slice  →  Test  →  Demo it live
      →  Verify in the real place  →  Update the tracker  →  Confirm  →  Next phase
```

Rules that make the loop work:
- **Never code without a written plan.** Even a paragraph beats nothing.
- **A phase isn't "done" until tests are green AND you've seen it run.** "Should work" ≠ done.
- **Ship something runnable each phase.** No 3-week branches with nothing to show.

---

## 2. Phase structure — walking skeleton first

- **Phase 0 = a runnable skeleton end-to-end on fake data.** Wire the whole flow with stubs
  before adding depth. This de-risks the architecture on day one.
- **Order phases by risk, not by ease.** Prove the hardest/most-uncertain part early (the part
  that, if it fails, kills the project).
- **Each phase ships one capability**, builds on the last, and has explicit exit criteria.
- Don't build every feature at once — breadth after the core is proven.

### 2.1 Change intake — mid-build changes go through the structure, not straight into code
A change, idea, or suggestion during a build — whether it comes from you or the AI — is NOT a
cue to edit code. Route it first: **trivial & in-scope** → note it in the current
`phases/phase-NN-spec.md`; **new capability** → a new `phases/phase-NN-spec.md` placed by risk
(+ a `PLAN.md` row); **a decision/fork** → an ADR in `docs/adr/`; **a bug** → the fix-issue flow.
Update `PROGRESS.md`'s `## Now`, confirm anything load-bearing, THEN build it via the Golden Loop.
The `/arc-change <what>` command runs exactly this. **No code change without a tracked home** — it's
what stops a build sliding into ad-hoc chaos where the tracker no longer matches the code.

---

## 3. Principles

1. **Plan first, then critique the plan.** Write the vision + architecture, then hunt for the
   missing hard decisions *before* coding (data access, cost, the "how" of the risky parts).
2. **Offline/stub-first.** Build a mode that runs the whole system with no keys, no network,
   fake data. Fast dev, deterministic tests, free CI. Real integrations stay optional.
3. **Config-driven, zero hardcoding.** Models, endpoints, limits, toggles live in config/env.
   Changing behavior should not require code changes.
4. **An interface + a fake for every external dependency.** DB, LLM, APIs, queues — each gets a
   thin adapter, a fake impl (for tests), and a real impl. This is what enables offline-first.
5. **Resilience is a feature.** Retries with backoff, failover to a different provider, timeouts,
   cost/rate caps, checkpoint + resume, graceful degradation, and *clear error messages*.
6. **Verify in the real place.** Run tests in the actual repo, run a live demo, and validate
   against the real system (real DB, real API) — not just in your head.
7. **Evidence over assertion.** Don't claim it works; show the test output / the run. If you
   can't do something, say so and hand over the exact step to do it.
8. **Clarify at forks, then proceed.** Ask only at real decision points (stack, datastore, infra),
   recommend a default, and move. Don't over-ask; don't guess silently.
9. **Diagnose before patching.** Read the actual error and the actual file. Find the root cause,
   fix that, re-verify. Never blind-patch and hope.
10. **Small, reversible steps.** Build in a scratch area, verify, then place the verified change.
    Easy to undo, easy to review.
11. **Pure logic separated from I/O.** Keep parsing/scoring/rules as pure functions (trivially
    testable); push network/disk/DB behind adapters. Tests never need the network.
12. **Minimal dependencies, lazy imports.** Prefer the standard library; import heavy/optional
    deps only where used, so the core stays light and installable.

---

## 4. The 3-layer tracking system

Keep three views of the same work so status is never a mystery:

| Layer | File | What it holds | Update cadence |
|-------|------|---------------|----------------|
| Vision | `PLAN.md` | Goal, architecture, key decisions, non-negotiables | Once, then on big changes |
| Spec | `phase-01-spec.md` … | Detailed checklist/spec per phase | Per phase (reference) |
| Status | `PROGRESS.md` | One-screen overview table + done-log + "current position → next" | After every phase |

(Optional 4th: `phase-01-tasks.md` — a plain-language tick-box list for a quick human view.)

**File-naming convention (keep it consistent):**
- **Control docs** — singletons that live at the root — are `UPPERCASE.md` (`PLAN.md`,
  `PROGRESS.md`). Like README/CHANGELOG they sort to the top and read as important.
- **Numbered/repeated docs** are `lowercase-kebab.md`, **phase-first** and **zero-padded**:
  `phase-01-spec.md`, `phase-01-tasks.md`. Phase-first keeps a phase's spec + tasks adjacent
  in a listing; zero-padding keeps lexical sort correct (`01, 02 … 10` — otherwise `phase-10`
  sorts before `phase-2`). One separator, one word order — never mix.
- Keep the root clean with a `phases/` folder (this template's `/arc-kickoff` does this by default):

```
PLAN.md
PROGRESS.md
phases/
├── phase-01-spec.md
├── phase-01-tasks.md
├── phase-02-spec.md
└── phase-02-tasks.md
```

Each completed phase: flip its row to ✅, log what shipped + test count, move the pointer to next.

---

## 5. Quality & safety gates (don't skip)

- **Definition of Done, written upfront.** Each phase lists its exit criteria *before* you start
  it, so "done" is objective.
- **A test per feature; grow the suite with the system.** The test is the contract for "done."
- **Golden/eval set for anything with judgment or AI output.** Measure quality with numbers and
  regression-test every change — not vibes.
- **Security & privacy pass.** Strip/avoid PII, least-privilege access, secrets in a vault/CI
  (never in code), `.env` gitignored + `.env.example` committed.
- **Cost/budget awareness (esp. AI).** Token budgets, cheap-model routing for grunt work, caching,
  and a hard per-run cost ceiling with telemetry.
- **Observability from day one.** Structured logs, run IDs, per-run metrics (cost, quality, timing).
- **Idempotency + resumability** for any long/batch/scheduled job (checkpoint each stage).
- **Rollback / kill switch** for anything autonomous (cost cap, failure alerts, a manual off-switch).

---

## 6. Engineering patterns worth reusing

- **Tiered routing / right-sizing.** Use the cheap/fast option for high-volume work, the strong
  one for judgment. Make it per-component and swappable, with a fallback chain.
- **Deterministic offline stand-ins.** Make fakes *meaningful* (e.g. derive a stable value from
  the input) so offline behavior resembles real — far better than random fakes.
- **One dispatch interface, many implementations.** Add a new source/provider/backend by
  registering it, not by rewriting callers.
- **Cache the stable, recompute the volatile.** Cache lookups that don't change run-to-run.
- **Fail one part, not the whole.** A single source/provider erroring should degrade, not crash.

---

## 7. Working with an AI build partner

This whole process pairs perfectly with an AI agent doing the implementation. To get the best out of it:

- **Give it the plan + the phase, not just "build X."** Context up front beats correction later.
- **Make it work in small, verifiable steps** and show test output each step.
- **Ask it to diagnose before fixing** when errors appear (root cause, then patch).
- **Have it keep the tracker updated** so you always see status without re-reading code.
- **Demand "verify for real"** — run the suite, run a live demo, check the actual system.
- **Decide the forks yourself** (stack, infra, budget); let it recommend, you choose.
- **Keep a decision log.** When you pick an approach, note *why* in `PLAN.md` — future-you (and
  the AI) will thank you.

---

## 8. Per-phase Definition-of-Done template

```md
## Phase N — <name>
Goal (one line):
Exit criteria:
  - [ ] <capability> works end-to-end
  - [ ] tests added & green
  - [ ] live demo run + output checked
  - [ ] verified against the real system (if applicable)
  - [ ] tracker updated (PROGRESS.md row ✅ + done-log)
Your-setup / pending (keys, accounts, infra):
```

---

## 9. Project kickoff checklist

Timebox: the whole kickoff = one session. Leftover open questions → Assumptions ledger
(with falsification triggers), then proceed. A falsifiable plan beats a perfect one.

Doctrine (v3): **anchored creation · unanchored verification · deterministic gates** — the
main session writes, fresh agents attack, scripts decide. Full spec: `docs/kickoff-v3-plan.md`
(+ `docs/kickoff-v3.5-plan.md` for the substance-floor checks).

- [ ] **Preflight**: existing PLAN/PROGRESS with content → ask "new or revise?", never
      silently overwrite. Brownfield → spawn **codebase-surveyor** (parallel with the
      appetite step); its ≤30-line block becomes `## Current state`.
- [ ] Appetite set (constraint, not estimate) + kill criteria (50% burnt tripwire) +
      **tier derived from the number** (S ≤ 3d · M ≤ 3w · L > 3w) written under Appetite —
      tier sets REQ cap, question cap, panel size, simulation & second-opinion.
- [ ] Forks come from the **question-planner** agent (≤5; S: ≤3), a recommended default
      each. **Two-way doors are auto-decided** — only one-way doors reach the human.
      Researchers spawned ONLY for: current API/library/security claims, costly-to-reverse
      architecture, payment/auth/data/compliance, unknown domains — **in parallel** (max 4)
      when ≥2 forks qualify. Cited packages verified to exist (registry + official docs).
      Still high-impact + low-confidence → **spike** (ADR `DEFERRED`, task atop phase-00
      spec, code quarantined; blocks Phase-0 close, not the STOP).
- [ ] Every resolved fork → ADR (`docs/adr/NNNN-*.md`; Evidence/Confidence/Rejected when
      researched) + **Reversibility** (one-way | two-way) + revisit trigger for one-way.
- [ ] Write `PLAN.md` — goal, **success requirements (REQ table, tier cap, each → exactly
      one phase)**, architecture (mermaid `flowchart`, no C4Context), ADR index,
      non-negotiables, no-gos, rabbit holes, **assumptions ledger (≤7, trigger mandatory;
      low-confidence ADRs must have a row)**, **external dependencies (interface + fake +
      real + contract test)**.
- [ ] **Attack panel** (the pre-mortem lives here): plan-attacker ×3 — A edge/feasibility ·
      B scope/hidden-deps · C pre-mortem seeded from `docs/retro-log.md` by tag overlap,
      every row citing a REQ/phase/ADR/dep (S-tier: one merged A+C run). Findings land as
      exact plan mutations or die silently; caps hold.
- [ ] Define phases by risk; Phase 0 = steel thread on fakes, contract tests green — no
      real APIs. Each spec: **Depends on** line (no cycles), **Verification plan** (detailed
      Phase 0–1, coarse after), **Non-negotiables block verbatim from PLAN** (generated,
      resynced by `/arc-change`, drift-gated).
- [ ] All knobs in config/env; secrets in `.env` (gitignored) + `.env.example`.
- [ ] Test harness + first tests; CI runs the offline suite on every push.
- [ ] 3-layer tracker set up (`PLAN.md` / per-phase spec / `PROGRESS.md`).
- [ ] Resilience baked in (retries, failover, cost cap, resume, alerts, clear errors).
- [ ] README quickstart that actually runs offline in minutes ("10-minute onboarding" test).
- [ ] **Lint gate**: `node .claude/scripts/plan/kickoff-lint.mjs` passes — the script is the
      gate, prose isn't. v3.5 substance groups run WARN-first until a retro promotes them —
      **v4 F1**: promotion is evidence-driven (fixture-proven + ≥3 clean dogfood runs logged in
      `docs/trial-ledger.md`), and lint prints a `[trial-status]` footer of live-vs-trial gates.
      (Also rerun by `/arc-change` and `/arc-phase-done` to catch plan drift.)
- [ ] **Simulation gate (M/L)**: plan-simulator reads ONLY PLAN + phase-00 spec; blocker
      count = 0 to pass (fix → one respawn → else human call). **L only**: cross-model
      second opinion on the plan + researcher re-verifies top-3 load-bearing claims.
- [ ] STOP — show PLAN + phases + one-screen summary, explicit approval. Until approval:
      no product code, no `/arc-change`, no other command.
- [ ] Ship phase by phase; verify for real; confirm before moving on.

---

*Keep this file in every repo. Update it when you learn something new — the playbook should improve
with each project, just like the products it builds.*

---
description: Kick off a new build per docs/build-playbook.md — tiered depth, agent panel, evidence-based plan, ADRs, risk-ordered phases, tracker, lint- and simulation-gated.
argument-hint: [one-line project goal]
---

Kick off the build for: $ARGUMENTS

> **Router:** extending an EXISTING build (new feature, tweak, mid-build idea)? Use
> `/arc-change` instead — kickoff is only for a new build or a major new milestone.
> **Doctrine (v3):** anchored creation · unanchored verification · deterministic gates —
> the main session writes, fresh agents attack, scripts decide. Spec: `docs/kickoff-v3-plan.md`.

Follow `docs/build-playbook.md` (§9) using the proven templates in `docs/templates/`.
**Timebox: this entire kickoff = one session.** Time up → unresolved questions become
Assumptions-ledger entries (with triggers) and we proceed — a falsifiable plan beats a
perfect one. In order:

0. **Preflight.** If `PLAN.md` or `PROGRESS.md` already has real content: STOP and ask —
   new initiative or revise the existing one? New initiative: archive first to
   `docs/archive/PLAN-<YYYY-MM-DD>.md` (and `PROGRESS-<YYYY-MM-DD>.md`). Never overwrite
   silently. Brownfield (repo has product code): spawn the **codebase-surveyor** agent —
   in parallel with step 1 — and paste its ≤30-line block into PLAN `## Current state`.
   Greenfield: delete that section.
1. **Appetite → tier.** Ask my total time budget (Shape Up style — a constraint, not an
   estimate). Write the kill criteria under it (50% tripwire). Derive the tier from the
   number, never judgment — **S ≤ 3 days · M ≤ 3 weeks · L > 3 weeks** — and write
   `**Tier:** S|M|L` under Appetite. Tier sets depth: REQ cap (S:5 / M,L:10) · questions
   (S:≤3 / M,L:≤5) · attacker panel (S: one merged run / M,L: ×3) · simulation gate (M,L) ·
   second opinion + verify pass (L only).
2. **(2a) Premise check.** New product / startup-risk build (someone must choose to adopt
   or pay)? ONE block first, not an interview: who needs this now · their status quo (the
   real competitor) · why they'd switch · narrowest wedge that proves demand. Goal still
   fuzzy → offer the **product-challenger** agent before continuing. Internal tool /
   existing-system work: skip, say so explicitly.
   **(2b) Forks.** Spawn the **question-planner** agent (give it: goal, premise answers,
   Current state, tier) and ask me ITS questions — each with its recommended default.
   **Two-way-door forks never reach me:** decide, record the ADR, move on. You may drop
   or merge its questions, never add unvetted ones.
   **(2c) Research gate** — spawn researcher agents ONLY for: version-sensitive or
   non-obvious external API/library/security claims · costly-to-reverse architecture ·
   unknown domains. A well-known stable API with an established integration pattern does
   NOT qualify by domain label alone (payments/auth/data included). Qualifying forks ≥ 2 →
   spawn researchers **in parallel** (max 4, one fork per charter). Findings land in the
   ADR (Evidence / Confidence / Rejected-because), never a separate file. Any package or
   library a researcher cites must be VERIFIED to exist (registry entry + official docs),
   verification recorded on the Evidence line — hallucinated package names are a live
   supply-chain vector (slopsquatting).
   Still high-impact + low-confidence after research → **spike**: set the ADR status to
   `DEFERRED — spike scheduled` and put the spike task (question · timebox ≤ ½ day ·
   expected evidence · the ADR number) at the top of `phases/phase-00-spec.md`. Spike code
   is quarantined, never merged. DEFERRED blocks Phase-0 close, not this kickoff's STOP.
3. **Record each resolved fork as an ADR** — `docs/adr/NNNN-title.md` per
   `docs/templates/adr-template.md` (options + consequences, one decision per file), now
   including **Reversibility** (one-way | two-way) and — for one-way doors — a real
   **Revisit trigger**.
4. **Write `PLAN.md`** from `docs/templates/PLAN-template.md` — every section filled:
   goal, **success requirements (REQ table, tier cap, each → exactly one phase)**,
   appetite + tier + kill criteria, architecture as a C4-concept Mermaid `flowchart`
   (never the experimental C4 syntax), ADR index, non-negotiables, **no-gos**,
   **rabbit holes**, **assumptions ledger (cap 7 — no falsification trigger, no entry)**,
   **external dependencies (interface + fake + real + contract test per dep)**.
5. **Attack panel** (the pre-mortem lives here now). Spawn **plan-attacker** — M/L: three
   in parallel (focus A: edge cases + feasibility vs ADR evidence · focus B: scope/YAGNI +
   hidden dependencies · focus C: pre-mortem, seeded from `docs/retro-log.md`) · S: one
   merged run (A+C). Reconcile each finding: accept → apply its exact mutation · reject →
   drop silently, no log. Caps hold — attackers compete for slots (pre-mortem stays 5
   rows: replace the weakest, never grow). If a finding invalidates the plan, fix the
   plan first.
6. **Define phases risk-first.** Phase 0 = steel thread / walking skeleton: the thinnest
   deployable end-to-end slice (input → core flow → output → deployed). Contract tests
   green against fakes apply only where an external dependency exists — no real APIs in
   Phase 0. Each phase gets its own appetite, a `**Depends on:**` line (lint-checked: no
   cycles, Phase 0 = none), and a spec from `docs/templates/phase-spec-template.md` →
   `phases/phase-NN-spec.md` (zero-padded), **Verification plan detailed for Phase 0–1
   only** — later phases one coarse line, refined when the phase starts (via `/arc-change`).
7. **Create `PROGRESS.md`**: phase table (capability | appetite | status), done-log,
   appetite-burn line (X of Y days used), and a `## Now` section ("current position →
   next step").
8. **Self-check gate:** run `node .claude/scripts/kickoff-lint.mjs`. Fix and rerun until
   it passes — the script's verdict is the gate, prose assurances don't count.
   **(8.5) Simulation gate (M/L):** spawn **plan-simulator** — it reads ONLY PLAN.md +
   phase-00-spec.md, the executor's real information set. BLOCKERS > 0 → fix each (spec
   edit, PLAN edit, or an explicit assumption with trigger) and respawn once. Two
   non-zero rounds → STOP and show me the blockers — that's a human call now.
   **(8.75) Second opinion (L only):** run the `/arc-second-opinion` flow against PLAN.md
   + phase-00-spec.md — disagreements become pre-mortem rows or reopened forks (agreement:
   proceed, no note). Also have a researcher re-verify the top-3 load-bearing ADR
   Evidence claims.
9. **STOP.** Show me PLAN.md + the phase list + a one-screen summary (tier · active REQ
   count · top-3 pre-mortem risks · one-way doors decided · no-gos) and wait for explicit
   confirmation. Until that approval: no product code, no `/arc-change`, no other
   command — STOP means stop.

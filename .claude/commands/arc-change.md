---
description: Intake a mid-build change, idea, or suggestion and route it THROUGH the build structure (tracker + spec/ADR) instead of editing code ad-hoc. Then build it step-by-step via the Golden Loop.
argument-hint: [what changed / the new idea / the suggestion]
allowed-tools: Read, Write, Edit, Bash(git status), Bash(git diff:*), Bash(git log:*)
---

A change came up mid-build: **$ARGUMENTS**

Do NOT jump straight into editing code — not for my asks, and not for your own suggestions.
Route it through the structure first (see `docs/build-playbook.md`), then build it step-by-step.
Follow in order:

1. **Classify it** — pick ONE and say which + why:
   - **Trivial & in-scope** (fits the current phase's spec) → add it under the current
     `phases/phase-NN-spec.md` exit criteria and continue the Golden Loop.
   - **New capability / scope** → create a new `phases/phase-NN-spec.md` from
     `docs/templates/phase-spec-template.md` (zero-padded, placed by RISK) and add its row to `PLAN.md`.
   - **A decision / fork** (stack, datastore, approach) → write an ADR at `docs/adr/NNNN-*.md`
     from `docs/templates/adr-template.md`. If it's uncertain or high-stakes, spawn the
     **researcher** agent to triangulate before deciding.
   - **A bug** → run the `/arc-fix-issue` flow (root cause → failing test → fix). Don't patch symptoms.

2. **Check the appetite.** Does it fit the current phase/cycle budget? If it blows it, say so and
   propose the trade — cut something or make this its own phase. Never silently expand scope.

3. **Update the tracker BEFORE any code** — the file chosen in step 1, plus `PROGRESS.md`'s
   `## Now` (current position → next step). A decision also gets its ADR. This is the
   "proper folder-structure update" — the change now has a tracked home.

4. **STOP and confirm** for anything load-bearing (new phase, schema change, new dependency,
   public API, money/auth). Show me the tracker diff + the plan; wait for my OK before coding.

5. **Only then build it** — the Golden Loop: smallest working slice → tests → live demo →
   verify in the real place → flip the tracker (`/arc-phase-done <n>` when a phase closes).
   Offline-first: any new external dependency gets an interface + fake + real impl.
   Respect `.claude/rules/*` on the paths you touch, and close with `/arc-review` → `/arc-commit`.

**Rule of thumb: no code change without a tracked home.** If it isn't in a phase spec, an ADR,
or the current phase's scope, it doesn't get coded yet — it gets filed first. Small typo/one-liner
fixes to code you're already in are fine; anything that adds behavior goes through this flow.

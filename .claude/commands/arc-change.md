---
description: Intake a mid-build change, idea, or suggestion and route it THROUGH the build structure (tracker + spec/ADR) instead of editing code ad-hoc. Then build it step-by-step via the Golden Loop.
argument-hint: [what changed / the new idea / the suggestion]
allowed-tools: Read, Write, Edit, Bash(git status), Bash(git diff:*), Bash(git log:*), Bash(node .claude/scripts/kickoff-lint.mjs:*)
---

A change came up mid-build: **$ARGUMENTS**

Do NOT jump straight into editing code — not for my asks, and not for your own suggestions.
Route it through the structure first (see `docs/build-playbook.md`), then build it step-by-step.
Follow in order:

0. **Assumption check first.** Scan PLAN.md's Assumptions ledger: is this change actually
   a falsification trigger firing? If yes: mark the row (append `FIRED YYYY-MM-DD` to the
   trigger cell) and list what else that assumption was load-bearing for — REQs/phases
   built on it get re-checked, ADRs premised on it get flagged. An assumption firing
   silently is how plans rot.

1. **Classify it** — pick ONE and say which + why:
   - **Trivial & in-scope** (fits the current phase's spec) → add it under the current
     `phases/phase-NN-spec.md` exit criteria and continue the Golden Loop.
   - **New capability / scope** → a new phase NEVER ships without a REQ: add a REQ row to
     PLAN.md's Success requirements (measurable acceptance — the vague gate applies,
     status `active`) mapped to a new `phases/phase-NN-spec.md` from the template
     (zero-padded, placed by RISK), and add the phase row to PLAN.md. If the 10-active-REQ
     cap is full, that's the forcing function: present the trade — drop/merge an existing
     REQ (mark it `dropped`, never delete the row) or this change doesn't fit the cycle.
   - **A decision / fork** (stack, datastore, approach) → write an ADR at `docs/adr/NNNN-*.md`
     from the template. If it's uncertain or high-stakes, spawn the **researcher** first.
   - **A bug** → run the `/arc-fix-issue` flow (root cause → failing test → fix).

2. **Check the appetite — with numbers, not vibes.** Read PROGRESS.md's appetite-burn line
   and PLAN.md's kill criteria; state the position ("62% burnt, tripwire phase not done"),
   THEN propose the trade. If this change pushes past the kill-criteria tripwire, the
   scope-cut conversation is mandatory before anything proceeds. Never silently expand scope.

3. **Update the tracker BEFORE any code** — the file(s) chosen in step 1, plus
   `PROGRESS.md`'s `## Now`. A decision also gets its ADR. The change now has a tracked home.
   Then **run `node .claude/scripts/kickoff-lint.mjs`** — the tracker mutation must leave
   the plan consistent (REQ mapped, spec file exists, status valid). Fix before moving on.

4. **STOP and confirm** for anything load-bearing (new phase, schema change, new dependency,
   public API, money/auth). Show me the tracker diff + the plan; wait for my OK before coding.

5. **Only then build it** — the Golden Loop: smallest working slice → tests → live demo →
   verify in the real place → flip the tracker (`/arc-phase-done <n>` when a phase closes).
   Offline-first: any new external dependency gets an interface + fake + real impl (+ its
   row in PLAN's External dependencies table, contract test included).
   Respect `.claude/rules/*` on the paths you touch, and close with `/arc-review` → `/arc-commit`.

**Rule of thumb: no code change without a tracked home.** If it isn't in a phase spec, an ADR,
or the current phase's scope, it doesn't get coded yet — it gets filed first. Small typo/one-liner
fixes to code you're already in are fine; anything that adds behavior goes through this flow.

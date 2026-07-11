# Kickoff Upgrade Plan — `/arc-kickoff` v2

> Goal: make kickoff a compounding, self-enforcing system — **zero structural change**.
> Same files (`PLAN.md` / `phases/` / `PROGRESS.md` / `docs/adr/`), same identity.
> Every addition is either a **hard gate** (script/checkbox) or a **hard cap** (max N entries).
> No new free-form prose sections — that's where slop comes from.

## What does NOT change
- File structure: no `.planning/`, no `REQUIREMENTS.md`, no per-build folders.
- ADR pattern, Phase 0 steel-thread-on-fakes, appetite discipline, approval STOP — untouched.
- Rejected borrows: GSD state machine, Harnessed full composition, gstack boil-the-ocean.

The ONE new file: `docs/retro-log.md` (append-only, one line per pattern). Needed for
upgrade #1; everything else edits existing files.

---

## Changes by file

### A. `.claude/commands/arc-kickoff.md`

**A1. Preflight (new step 0).** If `PLAN.md` or `PROGRESS.md` exists with real content:
STOP and ask — "new initiative (archive old plan) or revise existing?" Never silently
overwrite. Also: if the repo already contains product code (brownfield), run a codebase
survey first (Graphify query → fallback grep/glob) and write a `## Current state` note
into PLAN.md before any planning.

**A2. Clarification cap.** After the one-line goal: max **5** questions, real forks only
(user, core success, hard constraint, brownfield/greenfield, deadline). Each fork gets a
recommended default. No questionnaires.

**A3. Research gate (wording only).** Keep existing "genuinely uncertain or high-stakes"
condition. Add the explicit mandatory list: current external API/library/version/security
claims · costly-to-reverse architecture · payment/auth/data/privacy/compliance · unknown
domain. Everything else: no researcher. Research output lands in the ADR, never a
separate file.

**A4. Retro seed.** Before the pre-mortem: read `docs/retro-log.md` (if present). Any
pattern matching this project type MUST appear as a pre-mortem row. Read, never
summarize — entries are already one line.

**A5. Kickoff appetite.** Kickoff itself = max one session. Time up → unresolved
questions go to the Assumptions ledger with triggers, then proceed. Falsifiable plan >
perfect plan.

**A6. Self-check gate (new step, before STOP).** Run `.claude/scripts/kickoff-lint.*`.
Deterministic checks — all PLAN sections non-empty · every REQ maps to exactly one phase
and every phase serves ≥1 REQ · `phases/phase-00-spec.md` exists · ADR index rows have
matching files · pre-mortem has ≥5 rows each with mitigation/accepted · every external
dep lists interface + fake + contract-test path. Lint fails → fix → rerun. No "looks
good to me" prose allowed as a substitute.

**A7. STOP unchanged.** Show PLAN.md + phase list, wait for explicit approval.

### B. `docs/templates/PLAN-template.md`

**B1. `## Success requirements` table** (after Goal): `REQ-NN | user outcome |
measurable acceptance | phase`. **Hard cap 10 rows** (small builds: 5). Unmapped REQ or
goal-less phase = kickoff incomplete.

**B2. `## Assumptions ledger`** (after Rabbit holes): `assumption | how we'd know it's
wrong (trigger) | phase that tests it`. **Cap 7.** Rule: no falsification trigger → not
an assumption, filler — entry rejected.

**B3. Kill criteria line under Appetite:** "At 50% appetite burnt, if Phase <N> isn't
done → mandatory scope-cut conversation. At 100% → cut or kill, never extend."

**B4. External dependencies table** (feeds Phase 0): `dep | interface | fake impl |
real impl | contract test file`. Scope: real external APIs/services only — not every
import.

### C. `docs/templates/phase-spec-template.md`

**C1. `## Verification plan`** under Exit criteria: exact test command · live demo
scenario (steps + expected output) · real-system check · expected evidence. **Detail
required for Phase 0–1 only**; later phases keep one coarse line, refined when the phase
starts (via `/arc-change` or phase kickoff). Writing detailed verification for Phase 5
at kickoff = fiction, banned.

**C2. Phase 0 DoD addition:** `- [ ] contract tests green against fakes` (same suite
must later pass against real impls before the dep's phase closes).

### D. `docs/templates/adr-template.md`

**D1.** Under Decision, when researcher ran: `Evidence:` (key sources) · `Confidence:`
high/med/low · `Rejected because:` one line per losing option. Skip entirely when no
research — no empty headers.

### E. `.claude/scripts/kickoff-lint` (new script)

**E1.** Node or bash, no deps. Parses PLAN.md + phases/ + docs/adr/. Exits non-zero with
a named-check failure list. Checks = exactly the A6 list. Also callable by
`/arc-phase-done` (drift check mid-build) — one script, two consumers.

### F. `.claude/commands/arc-retro.md`

**F1.** Add step: for each *recurring* finding (not one-offs), append one line to
`docs/retro-log.md`: `YYYY-MM-DD | project | pattern | prevention`. One line, no essays.
This is what A4 reads — the compounding loop.

### G. `docs/build-playbook.md` §9

**G1.** Sync the kickoff checklist with the new flow (preflight → goal+appetite → forks →
research-if-needed → ADRs → PLAN (REQs, assumptions, pre-mortem, kill criteria) →
risk-first phases + verification plans → lint → STOP). Command stays lean; playbook holds
the detail.

---

## Anti-slop rules (baked into command text, not left to judgment)
1. Caps are hard: REQ ≤ 10, assumptions ≤ 7, pre-mortem = 5, questions ≤ 5.
2. Gates are scripts or checkboxes — never LLM self-assessment prose.
3. Retro-log entries: one line. Kickoff reads them, never summarizes them.
4. Verification detail: Phase 0–1 only.
5. Contract tests: external services only.
6. No entry without its trigger/mapping — reject, don't pad.

## Implementation order
1. **E1** kickoff-lint script (everything else hangs off it)
2. **B1–B4, C1–C2, D1** template edits (lint needs the sections to exist)
3. **A1–A7** command rewrite (~15 lines longer, detail lives in templates/playbook)
4. **F1** retro-log append + create empty `docs/retro-log.md`
5. **G1** playbook §9 sync

## Verification (of this upgrade itself)
- Run `/arc-kickoff` on a dummy goal in a scratch dir: preflight triggers on existing
  PLAN, lint fails on an intentionally-broken PLAN, passes on a complete one.
- Run `/arc-retro` on a fake session: exactly one line lands in retro-log.
- `arc-kickoff.md` stays readable in one screen; CLAUDE.md untouched except nothing.

---
---

# Round 2 — competitive-review borrows (GSD / Spec Kit / Superpowers / gstack)

> Status: v1 AND Round 2 implemented & verified (2026-07-11). Round 2 = 4 small deltas from
> comparing against GSD Core, Spec Kit, Superpowers, gstack, Harnessed. Same ground
> rules: no structure change, no second planning universe, every addition is a gate or
> a cap. Explicit rejects: Harnessed composition (immature — README promises 27
> workflows, repo shows MVP docs), Spec Kit full clarify/analyze (LLM-judgment gates —
> violates anti-slop rule #2), GSD `.planning` machinery (round 1 reject stands).

## R2-1. Premise challenge — gstack borrow (conditional-MANDATORY, not optional)
**File:** `.claude/commands/arc-kickoff.md`, step 2.
If the goal is a new product / startup-risk build (someone must choose to adopt or pay):
before the fork questions, ask ONE premise block — who needs this now · what's their
status quo (the real competitor) · why would they switch · narrowest wedge that proves
demand. Answers land in PLAN Goal/no-gos, weak answers become Assumptions-ledger entries
with triggers. Internal tool / existing-system work: SKIP explicitly.
Anti-slop: "optional" is banned wording — condition decides, not mood. One block, not an
interview.

## R2-2. Vague-acceptance check — Spec Kit borrow, deterministic subset only
**File:** `.claude/scripts/kickoff-lint.mjs` (new check group `[vague]`).
FAIL any REQ acceptance cell matching a ban-list: fast, easy, simple, properly, robust,
seamless, user-friendly, intuitive, should work, good, better, nice, clean, smooth,
performant, scalable (word-boundary, case-insensitive) — unless the cell also contains a
digit or a verifiable token (`<`, `>`, `%`, `ms`, `s `, exact command/path). Same list as
WARN-only on Assumption-trigger cells.
Anti-slop: this is the deterministic 20% of Spec Kit's clarify gate; the judgment 80%
stays in the kickoff conversation where it already lives.

## R2-3. "Expected fail first" — Superpowers borrow
**File:** `docs/templates/phase-spec-template.md`, Verification plan block.
Add one field: **Expected failure first:** which test fails before the phase is built +
the failure message we expect. Proves the test tests something (red → green), kills
tests-written-after-the-fact theatre. Required for Phase 0–1 (same rule as the rest of
the verification plan), coarse after.

## R2-4. REQ quality wording — GSD borrow
**File:** `docs/templates/PLAN-template.md`, Success-requirements comment.
Add: each REQ must be **user-centric** (an outcome someone experiences, not a task),
**atomic** (one outcome — "and" is a smell), **testable** (acceptance can fail).
Comment-only; R2-2 enforces the testable half mechanically.

## Implementation order
1. R2-2 lint check + fixture tests (mutation: vague acceptance must FAIL, "< 5s" must pass)
2. R2-3 + R2-4 template edits
3. R2-1 kickoff step 2 edit (keep command within one screen)
4. Rerun full lint fixture suite (broken / good / mutations)

## Verification
- Fixture with acceptance "works properly and fast" → FAIL [vague]; "PDF in < 5s" → pass.
- Fixture with "seamless UX" + "< 200ms" in same cell → pass (verifiable token wins).
- arc-kickoff.md still one screen; no new files, no new sections in PLAN.

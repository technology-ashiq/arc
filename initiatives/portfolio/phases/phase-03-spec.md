# Phase 03 — Docs truth + retro

**Goal (one line):** Flip the docs last, same cycle (REQ-05): One Rule rewritten to per-lane law quoting PORTFOLIO.md as the index view (ADR-0051), vocabulary table + truth hierarchy into how-arc-works-simple §1/§3/§8 + usermanual + plans/README ritual, ADR template gains a one-line `Product:` field (ADR-0053), HISTORY entry logged, `/arc-retro` run.

**Appetite:** 0.25 days
**Depends on:** phase-02

## Verification plan

- Coarse (refined via `/arc-change` when the phase starts): `/arc-docs` drift gate passes with 0 findings; retro run; board shows portfolio IDLE with a `last:` note and develop kickoff as the queued next.

## Retro inputs — carried in, to be decided BY the retro, not before it

Routed here via `/arc-change` on 2026-08-01 (owner-decided). These are findings with a
tracked home and no code attached; the retro decides what each one becomes.

### RI-1 — a control that ADR-0056 required was never built, and nobody noticed for two phases

**What happened.** ADR-0056 says the board carries a `Mode B: not certified` note until
certification. `PORTFOLIO.md` was born in Phase 01 without it and ran through all of Phase
02 without it — `git log --all -S "Mode B: not certified" -- PORTFOLIO.md` returns nothing.
For the entire window in which Mode B was UNSUPPORTED, the artifact appointed to say so was
silent.

**Why it matters more than it looks.** Nobody was misled: one person, one working tree. That
is a fact about the circumstances, not about the control. The safeguard that would have
caught a second person was absent, not weak — and the absence survived a phase close, a
board lint written in the same cycle, and every `/arc-resume` in between.

**How it surfaced.** Section G's job was to REMOVE that note. It was found by trying to
delete something that was not there. No amount of reading the code produces this; only
acting on the artifact does. Same shape as CLAUDE.md's "look at the artifact before carrying
its verdict".

**The candidate upgrade, for the retro to accept, shrink or reject.** A tenth board-lint
class asserting the execution-mode section exists and that its Mode B line matches one of
two known grammars. Deliberately NOT "matches the certification state": no machine-readable
source of truth for certification exists, inventing one is a bigger change than the problem,
and the failure that actually happened was silent absence — which a presence check catches.

**Why it is not being built in this phase.** Phase 03 is docs + retro at 0.25d and its own
spec puts any code change out of scope. The change is also not one line: the WARN registry
is pinned at exactly nine classes and `tests/warn-shape.bats` asserts them by name, so a
tenth needs the registry, the class-obligation guard, and its own fixtures — and none of the
nine existing classes can carry it, since all nine are about board rows, lanes and
ownership, not about a required section being absent.

**The generalisable question for the retro, which is the real prize here.** This is the
second time this cycle that a stated control turned out not to exist or not to work
(the other: section E's control passed six legs by luck before the certification run caught
it). Both were found by exercising the artifact, neither by review. Worth asking: **which
other ADR-mandated artifacts have no gate asserting they exist?**

## Rabbit holes in this phase

- Rewriting docs beyond the sections REQ-05 names. Retro scope creep — findings route
  through the normal retro promotion path.

## Out of scope for this phase

- Any code change. The develop kickoff itself (next cycle, first native lane).

## Your-setup / pending

- None.

## Non-negotiables (verbatim from PLAN)

- Philosophy untouched: Golden Loop, gates, receipts, change discipline — a lane is a namespace for tracker state, nothing more (ADR-0050, ADR-0053).
- No history rewrite and no history duplication: frozen paths stay frozen as sole canonical copies; lanes link, never copy (ADR-0055, ADR-0058).
- Root-mode green at every commit — byte-identical when no `initiatives/` dir exists; the bare-root fixture is a permanent consumer contract (ADR-0054).
- feat/* branch + PR, never main.
- All new lints WARN-first, and every WARN prints Expected / Found / Example (ADR-0057).
- Spine receipts for kickoff / phase-done / retro as usual; no silently lost receipts — degrade visibly, never lose, never block (ADR-0056, REQ-04).
- Never guess a lane: explicit `--lane` beats auto-resolve beats ask; destructive commands confirm the selected lane (ADR-0054).

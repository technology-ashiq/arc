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

### RI-2 — 52 unconfirmed adversarial findings, and the spool gap section F left open

Routed here 2026-08-01, owner-decided, when `/arc-phase-done 2` refused and the missing
adversarial pass was finally run. Full record:
`../evidence/phase-02/adversarial-report.md`.

**What is carried in.** 61 findings across `board-lint.sh`, `lane-resolve.{sh,mjs}`,
`ownership-lint.sh` and the spool. Nine were verified by hand; one (the lock) was fixed and
pinned, three were removed by reverting section F, and **five remain live in shipped code**:
the `--base` typo that silently disables `ownership-lint`, its `--lane` duplicate-flag and
empty-value bugs, and its blindness to renames and to non-ASCII filenames. The other **52
carry an agent's verdict and not a verified one** — each needs its reproduction re-run
before it is believed. That re-verification is itself part of what this input asks for.

**The spool gap is open again.** Section F was reverted, so a hook-mode lock timeout once
more lands in `events/_quarantine/` beside malformed payloads — the gap Phase 02 set out to
close. The design reasoning is preserved in Phase 02's `## Now`; what it lacked was any
re-validation of the file the drain picked up. Whatever replaces it must run the same
validate → scan → seal path the front door runs, because "only our emitter writes to that
directory" is a claim about provenance that no code established.

**Two questions for the retro, worth more than the finding list.**

1. **`board-lint.sh` has 24 reported defects and passes its own 41 fixtures.** Four are
   silently-wrong verdicts. It is a hand-written strict-grammar markdown parser — the exact
   bug class PLAN risk 3 names, and the class the council found 43 holes in. Is the answer
   to fix them one by one, or is a hand-written markdown-contract parser the wrong shape?
2. **The pass was skipped on three gates in one phase, by a process that requires it.**
   `docs/retro-log.md:10` has mandated it since 2026-07-16, and this phase's own DoD names
   it. Nothing stopped those sections merging without it and nothing noticed until close —
   a rule only a phase close can enforce gets skipped for a whole phase.

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

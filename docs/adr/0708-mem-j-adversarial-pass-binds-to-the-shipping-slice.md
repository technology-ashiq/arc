# ADR 0708 — MEM-J: every parser-class surface gets two fresh-agent adversarial passes inside the phase that ships it

**Status:** accepted
**Date:** 2026-08-11
**Product:** `memory`
**Reversibility:** two-way
**Revisit trigger:** two passes on one surface return findings with heavy overlap and no
distinct root causes across two consecutive phases → the two-surface split is not buying
independence here and gets re-costed.

## Context

This cycle ships two parser-class surfaces — five ingestion adapters and a user-facing query
parser. arc's history on hand-written parsers and gates is unambiguous, and expensive:

- **2026-07-16, council-v2:** an adversarial breaking-input pass found real holes in *every*
  freshly-built lint/gate, each phase — code that looked correct and passed its own fixtures.
- **2026-08-02, `arc-develop`:** the **author** of a gate wrote 26 breaking inputs and all 26
  were caught. A fresh agent that had never seen the parser then found **9 real holes**. All 26
  of the author's attacked one direction; all 9 attacked the other. The recorded prevention: the
  pass must be run by a **fresh agent that has not seen the implementation** — *a clean
  adversarial result from the author is evidence of a blind spot, not of a gate.*
- **2026-08-02, `arc-portfolio`:** the mandated pass was **skipped on three gates in one phase**
  by a process that had required it since 2026-07-16, and nothing noticed until the phase close
  refused. The pass then found 61 issues, 5 live in shipped code. The recorded prevention: *bind
  the adversarial pass to the section/PR that ships a gate, not to the close that comes after
  all of them.*

The leads lane's 2026-08-10 experience puts a number on the two-surface rule: eleven rounds, two
independent surfaces each, with **near-zero overlap between the surfaces every round**.

## Options considered

1. **One generalist adversarial pass per phase** — pros: cheaper. Cons: a single agent's blind
   spot is structural, and the measured overlap between differently-scoped attackers is near
   zero, so one agent demonstrably does not cover both surfaces.
2. **Author writes the breaking inputs** — rejected outright by the 26-vs-9 measurement.
3. **Two fresh agents, different surfaces, bound to the shipping slice** — chosen.

## Decision

Each parser-class surface gets **two adversarial passes, by two fresh agents, on two different
surfaces**:

- one on the **decision logic** (parse rules, field counts, ranking, exclusions, id grammar),
- one on the **shell / OS boundary** (paths, CRLF, quoting, unicode, argv, exit codes, Windows
  vs BSD vs GNU userland).

"Fresh" means the agent **has not seen the implementation**. It is given the source, the rules,
the existing fixtures, and the instruction to walk past it.

The passes run **inside the phase that ships the surface** — adapters in Phase 0, the query
surface in Phase 1 — never deferred to the cycle close.

Each attacker's prompt carries **this lane's running list of already-fixed defects**, with the
instruction to check every one of them in every *other* file. Found holes are fixed and **pinned
as fixtures**; rejected findings are recorded with a reason.

**Amended 2026-08-12 (Cycle 11 retro).** Every row of that list carries a **sweep** cell alongside
its "check it against" prose: **a command and the count it returned, filled in at fix time** — e.g.
`grep -rn "process\.exit(" .claude/scripts/memory/` → *31 found, 31 converted, 0 remaining*. The
prose column states an intention; the sweep column is evidence, and a blank that must hold a number
is harder to skip than a sentence that must be remembered.

The amendment exists because twin-fix has now recurred **five times across four lanes**
(2026-08-03 engine · 08-04 evolve · 08-09 absorb · 08-10 absorb · 08-12 memory, that last one three
times inside one phase). `CLAUDE.md` already says *grep the pattern, not the file*, and
`docs/retro-log.md` already carries four rows of it — a fifth written line would be the fourth
re-phrasing of a rule the log holds four copies of, which is how a log stops being read.

**Its honest limit, stated rather than implied:** nothing enforces the cell, and no mechanism would
have caught the recurrence that mattered most this cycle — a flag accepted-and-inert in three of
four modes is not greppable at all. This raises the floor for the greppable classes and says so.

Any new lint this cycle ships is born **WARN-first (TRIAL)**, per the existing trial-ledger
promotion path.

**Confidence:** high.

## Consequences

- **Easier:** holes are found while the code is still being written, by someone structurally
  capable of seeing them.
- **Harder:** four adversarial passes across the cycle is real time inside a 4-day appetite. It
  is not optional and it is not the thing that gets cut — the cut order protects it by cutting
  scope instead.
- The passes attack **the test that protects the rule**, not only the rule — a mutant that walks
  past the fixture is the negative control.

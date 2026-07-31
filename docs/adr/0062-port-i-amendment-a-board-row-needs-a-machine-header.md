# ADR 0062 — PORT-I amendment: a lane on the board carries a machine header, even with no live cycle

**Status:** accepted
**Date:** 2026-08-01
**Reversibility:** two-way
**Supersedes:** nothing.
**Amends:** [ADR-0058](0058-port-i-history-link-never-copy.md) — its permitted pre-scaffold,
which was "folder + HISTORY-INDEX.md" and is now folder + HISTORY-INDEX.md + a
machine-header-only `PROGRESS.md`. Everything else in ADR-0058 stands untouched.
**Revisit trigger:** an initiative that must appear on the board but genuinely cannot carry
a tracker file (an external or partner effort) → that is a passport row (ADR-0059), not a
relaxation of this rule. If passports prove insufficient for such a case, revisit here.

## Context

ADR-0058 gave the design lane the one permitted "pre-scaffold": a folder and a
`HISTORY-INDEX.md` linking to frozen history, nothing more. REQ-02's acceptance repeated it
as "links only".

ADR-0051, decided the same day, makes `PORTFOLIO.md` a view whose every value derives from
that lane's PROGRESS machine header — "nothing hand-copied from prose".

The board carries `design | IDLE`. With no `PROGRESS.md` in the lane, that `IDLE` derives
from nothing: it is typed by hand and recomputed by no one, which is exactly the second
source of truth ADR-0051 exists to forbid. Phase 01 obeyed ADR-0051 and shipped a minimal
`initiatives/design/PROGRESS.md` — machine header plus a short note — which left ADR-0058
contradicted in its letter and the deviation unratified. Phase 02 writes the board lint
that would judge this, so it is settled now rather than after the lint flags arc's own repo.

**One claim in that file is also wrong, and the same edit corrects it.** It says
`status: IDLE` "keeps the lane out of the eligible set", implying the file is load-bearing
for lane resolution. It is not. `lane-resolve.sh` builds its lane list from every
validly-named directory under `initiatives/` whether or not a `PROGRESS.md` is present
(`lane-resolve.sh:109-123`), and eligibility comes only from a header reading `LIVE` or
`BLOCKED` — deleting the file outright would keep `design` out of the eligible set just as
well. The file is load-bearing for the **board**, not the resolver. A stated reason that
does not hold is worse than no reason: the next reader deletes the file the day that reason
stops applying, and takes the real one with it.

## Options considered

- **Delete the file and drop `design` from the board** — **rejected.** The lane then has no
  company-board presence at all, and ADR-0058's purpose was to make design's past reachable
  *as a lane*.
- **Delete the file and let the `design` row be hand-written or lint-exempt** —
  **rejected.** A direct violation of ADR-0051's single-source rule, and it puts an
  exception into the strict-grammar lint for the same reason ADR-0061 refuses one.
- **Keep the file and amend ADR-0058** — **accepted.** It is the only option that breaks no
  accepted rule.

## Decision

1. Any lane that appears on `PORTFOLIO.md` carries `initiatives/<lane>/PROGRESS.md` with
   the ADR-0051 machine header, whether or not a cycle is live. A lane with no live cycle
   carries `status: IDLE` and `—` in the cycle-dependent fields. The header is the
   requirement; the `## Now` section is a courtesy to the next reader.
2. ADR-0058's permitted pre-scaffold is therefore **folder + HISTORY-INDEX.md +
   machine-header `PROGRESS.md`**. The rest of ADR-0058 is unchanged: history is linked and
   never copied, frozen paths stay the sole canonical copies, and a lane-local `archive/`
   holds only cycles closed after portfolio adoption.
3. The board lint may assume a header exists for every initiatives row. With ADR-0061 that
   is true by construction, so a missing header is an ordinary WARN carrying Expected /
   Found / Example — never a special case in the parser.
4. `initiatives/design/PROGRESS.md`'s eligibility sentence is corrected to state the reason
   that actually holds.

## Consequences

- The pre-scaffold is three files instead of two. It is still one directory, and still
  zero copied history.
- For an IDLE lane the board and the lane can no longer disagree by construction: there is
  always something to derive the value from.
- REQ-02's "links only" acceptance is amended in `PLAN.md` and recorded as an amendment
  rather than edited quietly. Phase 01 closed against a criterion whose letter it did not
  meet, for a reason that outranked it — that is worth being able to read later.

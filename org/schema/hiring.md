# Hiring: how a seat becomes staffed

A vacancy is filled only when real work pulls it. The dispatcher's demand counter must reach 3
(ADR-1602), and every fill is a hire, never an edit (REQ-11, ADR-1614). There are no exceptions.

## The steps (one proposal branch)

1. **The seat.** On a branch, edit the role card. Set `seat` to the working seat and fill its
   `binds`. The candidate is either an **own** agent created through `agent-scaffold`, or a **hired**
   seat. A hired seat declares `origin: hired` and `hire: {runtime: <an arc-run driver>, source:
   <where it came from>, vetted_by: capability-scout}`. The `capability-scout` vetting comes first
   (ADR-0110). No card names a model; the router tier decides the model.
2. **The fixtures.** List the role's bench fixtures in `fixtures:`. An interview with nothing to
   run is refused.
3. **The interview.** Run the fixtures on bench as an ordinary bench event. If bench cannot yet
   express that, record the interview by hand (A-07). Either way the verdict is the owner's: an
   `approval.requested` with `{"subject":"org.role","role":"<id>","what":"interview: ..."}`,
   decided `approve` in `arc-inbox`. A `generic-api` hired seat runs only if it is reachable at ₹0,
   unless the owner approves a paid run (ADR-1621).
4. **The stamp.** From the main clone, run
   `node .claude/scripts/org/org-catalog.mjs --hire <id> --interview <decision ULID> --spine-dir <spine>`.
   It checks that the ULID is an owner approve deciding an org.role request that names this role.
   Only then does it write `legitimacy: interview:<ULID>`, `review_by` (the decision date plus 30
   days, ADR-1607) and a `history:` line. After that, it re-runs the gate.
5. **Merge.** The card, the fixtures and the stamp land in the same branch.
   `org-coverage --spine-dir` re-verifies every interview ULID against the spine.

## What the gate refuses

- A hired seat with no `hire.runtime`, a staffed hired seat with `fixtures: pending`, or a hired seat
  legitimised by `genesis` (mutant arms M5 and M6).
- An `interview:ULID` that is not an approve, decides a different role, or uses another subject.
- A card that names a model in a selector field (M9).

## Genesis

The 37 seats that already existed on 2026-09-29 are legitimised once, by a single owner approval over
the catalog digest (`org-catalog --digest`). They are `origin: own` and exempt from fixtures, and
they are reviewed on the same 30-day tenure as every other seat.

# Mode-ladder dogfood — the honest mix

Phase 03 exit criterion: *"One dogfood pass over the mode ladder: `quick` / `standard` / `deep`
used as intended at least once each across the cycle, and the mix recorded — the input to
ADR-0065's cannibalisation trigger."*

## The mix, as it actually happened

| Mode | Runs this cycle | What it was |
|---|---|---|
| `quick` | **0** | — |
| `standard` | **1** | session 002 — arc-first vs venture-first sequencing. 6 seats / 6 model calls (ceiling 6/7). Verdict NO / Medium. |
| `deep` | **0** | — |

## This criterion is only PARTIALLY met, and it is being recorded that way

Only one of the three modes ran. The criterion asks for at least one of each.

**It was not padded, deliberately.** Running a `quick` and a `deep` purely to tick this row
would be manufacturing usage — the same failure REQ-04 refused when it declined to force a
HIT/MISS onto session 001. A mode mix assembled to satisfy a checklist tells you nothing
about how the ladder is actually used, which is the only thing the mix is for.

**What that costs, stated plainly:** ADR-0065's cannibalisation revisit trigger ("the mode mix
two weeks after launch shows `standard` displacing `deep` on one-way-door questions") **cannot
be evaluated yet**. One run is not a mix. The trigger stays armed and unfired, and the first
honest read of it is at the next cycle's retro, not this one.

## What the single `standard` run did establish

- The envelope is **livable**: a real, consequential owner question fitted inside 2 researchers
  + 3 stances + 1 verifier without the run feeling starved.
- The **send-back guard was never needed** — the verifier contested 6 of 15 points unprompted,
  so the run cost 6 calls against a ceiling of 7.
- **Assumption A-02** ("a 2-researcher envelope covers a real slice of council use") is
  **supported by one data point, not validated.** Its falsification trigger — three consecutive
  `standard` runs each ending in "recommend deep" — has not fired, because there have not been
  three runs. One run cannot kill it and cannot confirm it.
- The "no auto-upgrade" rule was never exercised: the run never hit the recommend-deep exit, so
  that path remains **written but untested**.

## Trial-ledger rows

**None required.** No new WARN-first check was introduced this cycle. The `council-lint` change
was a **bug fix** to an existing check (an unanchored section regex that failed correct files),
not a new gate — so there is no WARN→FAIL promotion criterion to register. Pinned instead by
`tests/council-lint-outcome-anchor.bats`, which includes a negative control proving the check
can still fail.

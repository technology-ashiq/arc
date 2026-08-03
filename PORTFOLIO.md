# PORTFOLIO.md — the company board

> **A view, never the truth (ADR-0051).** Every value below is derived from a lane's
> `initiatives/<lane>/PROGRESS.md` machine header — nothing is copied from prose and
> nothing originates here. On any mismatch the lane files win and the board lint says so.
> Truth hierarchy: `PROGRESS.md` = where the work is · `PLAN.md` = what the cycle is ·
> this file = index + priority · `docs/HISTORY.md` = the immutable company log.
>
> Row order **is** the priority order. There is no priority column, no owner, no ETA and
> no health field: a number nobody recomputes is a number that starts lying.

Updated: 2026-08-04

## Active initiatives

| lane | status | cycle | position | appetite/burn | blocked-on / depends-on | next |
|---|---|---|---|---|---|---|
| develop | IDLE | arc-develop (Cycle 6, closed 2026-08-03) | — (cycle closed, merged as 17473e7 / PR #100) | 7d / 2.1d | — | `/arc-kickoff --lane develop` when a new cycle pulls it |
| engine | IDLE | arc-engine (Cycle 6, closed 2026-08-03) | — (cycle closed, merged as b9a9e9f / PR #103) | 14d / 2.0d | — | `/arc-kickoff --lane engine` when a new cycle pulls it |
| evolve | LIVE | arc-evolve (Cycle 7, opened 2026-08-03) | ALL 5 phases CLOSED; fixture-proven, unexercised | 7d / 7.0d | — | `/arc-retro --lane evolve`, then merge PR #108 |
| model-policy | IDLE | model-policy (Cycle 5, closed 2026-08-02) | — (cycle closed) | 3d / 0.7d | — | `/arc-kickoff --lane model-policy` when a new cycle pulls it |
| portfolio | IDLE | arc-portfolio (Cycle 4, closed 2026-08-02) | — (no live cycle) | 3d / 3.35d | — | `/arc-kickoff --lane portfolio` when a new cycle starts |
| design | IDLE | arc-design (Cycle 3, closed 2026-07-30) | — (no live cycle) | — / — | — | `/arc-kickoff --lane design` when a new cycle starts |

## ADR number bands — one century per lane

ADRs are a single company organ at root (ADR-0053), but "highest + 1" only sees the branch
you are standing on. Two lanes numbering in parallel both read 0062 and both write 0063, and
git will not complain, because the filenames differ. It already happened on 2026-08-02:
model-policy and develop each took 0063–0068 in separate sessions. develop renumbered into a
century; model-policy's numbers had already merged to `main` and were left alone.

So a lane claims a **century**, and never numbers outside it:

| Band | Owner |
|---|---|
| 0001–0099 | company / core / hq — `model-policy`'s Cycle 5 holds **0063–0071** inside this range |
| 0100–0199 | `develop` |
| 0200–0299 | `engine` — claimed at birth, 2026-08-03 (0200–0206 taken) |
| 0300–0399 | `evolve` — claimed at birth, 2026-08-03 (0300–0310 taken) |
| 0400–0499 | next lane to be born |

`/arc-kickoff` assigns the next free century when it creates a lane, and `kickoff-lint`'s
`[adr-dup]` check FAILs when two files claim one number — so a forgotten band is caught by CI
rather than by someone happening to mention it. The band prevents; the lint is the control.

## Execution mode (ADR-0056 / PORT-G)

**Mode A** — parked-lane switching, one working tree, one session at a time — is the
default and has been usable since Phase 01.

**Mode B** — true parallel via `git worktree` per lane — is **NOT CERTIFIED**. Concurrent
emitters stay forbidden (ADR-0056).

> **It was certified for three hours on 2026-08-01, and the certification is WITHDRAWN.**
> Not because anyone changed their mind — because the thing it was granted on stopped
> existing. ADR-0056 makes certification a fixture result: *REQ-04's fixtures green*. REQ-04
> is section D + E + **F**, and F, the `_pending/` spool, was reverted the same day when an
> adversarial pass found three defects in it (a receipt written to a day file no reader can
> see; a spool file's contents deciding a write three directories above the spine root; the
> drain skipping the secret scan). Those fixtures are no longer in the tree, so the result
> they produced is no longer a result. A certification is not a memory of a green run.
>
> There is a second reason, and it is the more uncomfortable one. The run that certified
> Mode B was green on a spine that had a **live duplicate-writer bug** — `withLock` let a
> waiter delete the lock of a holder that was alive and mid-write, which is precisely the
> failure Mode B exists to be safe against. It was found by the same pass, hours after the
> board said CERTIFIED, and it was fixed in #89. Certification was granted against a fixture
> set that could not see it.
>
> Section G's own words were *"certification is a fixture result, not a judgement call"*.
> Withdrawing it is that sentence being honoured, not contradicted.

**What it will take to certify.** REQ-04 green again — which needs the spool rebuilt so that
the drain re-runs the same validate → scan → seal path the front door runs, and the 52 still
unconfirmed findings in `initiatives/portfolio/evidence/phase-02/adversarial-report.md`
triaged. Carried as Phase 03 retro inputs RI-1 and RI-2.

> **This line did not exist until 2026-08-01, and that is the more useful half of the
> record.** ADR-0056 required the board to carry `Mode B: not certified` from the moment
> the board existed. It never did — not in Phase 01 when `PORTFOLIO.md` was born, not
> through Phase 02. For the entire window in which Mode B was UNSUPPORTED, the board that
> was supposed to say so said nothing. Section G found this while trying to remove a note
> that was not there.

## Venture passports

> Ventures are revenue apps in their **own repos**, each running its own root-mode arc
> install (ADR-0059 / PORT-J). A venture never gets a lane, never gets tracker state here,
> and never appears in the table above — a passport row is the whole of its presence.

| venture | repository | current status | next |
|---|---|---|---|
| lexos | private, separate repo | in build outside arc | — |

<!--
The rule this note exists to hold: ADR-0061 — the board indexes BORN lanes only. A row
exists iff `initiatives/<lane>/` does, with a readable machine header to derive its values
from. `QUEUED` stays in the vocabulary as a state a born lane holds when it is scheduled
next; it is never a way to announce a lane that does not exist yet.

This note used to open "No `develop` row" and close "develop gets its row at
`/arc-kickoff --lane develop`, in that same commit." That happened on 2026-08-02 — the lane
was born and took its row in the kickoff commit, exactly as predicted. Kept as the record
that the rule was followed rather than deleted as if it never applied.
-->

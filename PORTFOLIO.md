# PORTFOLIO.md — the company board

> **A view, never the truth (ADR-0051).** Every value below is derived from a lane's
> `initiatives/<lane>/PROGRESS.md` machine header — nothing is copied from prose and
> nothing originates here. On any mismatch the lane files win and the board lint says so.
> Truth hierarchy: `PROGRESS.md` = where the work is · `PLAN.md` = what the cycle is ·
> this file = index + priority · `docs/HISTORY.md` = the immutable company log.
>
> Row order **is** the priority order. There is no priority column, no owner, no ETA and
> no health field: a number nobody recomputes is a number that starts lying.

Updated: 2026-08-12

## Active initiatives

| lane | status | cycle | position | appetite/burn | blocked-on / depends-on | next |
|---|---|---|---|---|---|---|
| absorb | IDLE | arc-absorb (Cycle 10, closed 2026-08-10) | — (cycle closed, merged as 30dc9a9 / PR #138 and 6850250 / PR #151, 8 of 8 REQ) | 8d / 6.5d | — | **CLOSED 2026-08-10 — 5/5 phases, 8/8 REQ, 1.5d unspent.** The technique loop ran end to end on a real source: read-only study of gstack `/review` (license NOT FOUND → zero copying) → extraction report → 1 ABSORB / 2 SKIP / 1 ROUTE → rebuild on **ADR-0602 Amendment 1s own route 2**, no allowlist widening → 3-fixture A/B whose pass condition was committed BEFORE the harness existed → sealed-blind pick → adoption. **THREE RECEIPTS POINTING THREE WAYS, ALL KEPT:** the harness cleared its condition (claimed class 3/3; main-report precision **-2.1 pts**, since 6 of 9 demoted findings are TRUE), the blind pick chose the OLD way, the adoption decision overruled a *retire* recommendation. 32 adversarial findings, every one of the cycles 15 defect classes recurring, CI green before any of them. Tests 2022 → 2216. `/arc-kickoff --lane absorb` when a trigger arm actually fires — ADR-0074s waiver was for ONE cycle |
| develop | IDLE | arc-develop (Cycle 6, closed 2026-08-03) | — (cycle closed, merged as 17473e7 / PR #100) | 7d / 2.1d | — | `/arc-kickoff --lane develop` when a new cycle pulls it |
| engine | IDLE | arc-engine (Cycle 6, closed 2026-08-03) | — (cycle closed, merged as b9a9e9f / PR #103) | 14d / 2.0d | — | `/arc-kickoff --lane engine` when a new cycle pulls it |
| evolve | IDLE | arc-evolve (Cycle 7, closed 2026-08-04) | — (cycle closed, merged as 8e80927 / PR #108; fixture-proven, unexercised) | 7d / 7.0d | — | `/arc-kickoff --lane evolve` when a real client names a surface |
| leads | LIVE | arc-leads (Cycle 8, opened 2026-08-04) | 03 | 11d / 7.5d | — | **00, 01, 02 and 04 CLOSED. Phase 04 — arc sends its own mail** (ADR-0415): 9 live messages through the real vendor, 9 delivered, 0 bounces, placement confirmed in the inbox, `dkim=pass` aligned to the sending domain, 47 → 74 tests. Two adversarial surfaces returned **27 findings overlapping on 3**; CI found 2 classes neither saw; the close ceremony found 3 more. **Closed with one row open by the owner's decision: `_dmarc.automemory.ai` is NXDOMAIN**, and `preflight.mjs` refuses on a missing record and on `p=none` — so that TXT record is **Phase 03's entry gate**, and the Gmail-class header read waits behind it rather than measuring a config already known to be incomplete. **Phase 05 — real campaign PARKED**, four gate rows NOT THIS QUARTER, re-open trigger = the day an offer is named. **2026-08-10: Phase 03 RUNNING.** The DMARC row is CLEARED (`p=quarantine` live) and both coupled entry-gate rows landed as `5b7deb3` (PR #136), so Phase 03 is running: slices 01–05 proven, **slice 06 merged as `bbfcede` (PR #145) while carrying an explicit DO-NOT-MERGE from both adversarial surfaces** — repaired on `feat/arc-leads-slice-06-fixes` and **PR #150 MERGED as `b3dd8e5`**: ELEVEN adversarial rounds, two independent surfaces each, returning 3, 9, 10, 8, 2, 3, 2, 1, 1, 4 and 0 CRITICALs with near-zero overlap between the surfaces every round -- round 11 read the whole branch including round 10 fixes and returned MERGE, the first round to end with no CRITICAL. **CI green at `cac15e8`** -- 19 jobs, 0 failures, read per-JOB, and the merged tree re-verified on `main` by workflow_dispatch because CI never runs on a main push. It went red at `c5865c8` on four assertion counts that round 10 caught and this branch fixed, which is the only reason that sha is worth naming. **The merge did NOT close slice 06**: the slice is five complete journeys against five real people and the send is the owner keystroke, so `phase-03-tasks.md` slice 06 stays empty until the live run happens. Carried-forward holes are listed in `phases/phase-03-known-holes.md`, and the owner set the bar on 2026-08-10: only a CRITICAL blocks this slice. **The 100% appetite line was reached the same day and the owner chose to EXTEND, 7d → 11d**, with Phase 03's own line 1.0d → 4.5d; recorded in `PLAN.md` § Appetite rather than absorbed silently |
| scheduler | LIVE | arc-scheduler (Cycle 12, opened 2026-08-12) | 00 | 3d / 0.0d | — | **Kickoff approved 2026-08-12** (`01KZTCFG2DZQJ6EE2WP1RX8P1G`). Tier S, 5 REQ, 4 phases, ADR band **0800–0899** (0800–0806). The heartbeat: a git-tracked jobs file + one wrapper + Windows Task Scheduler make every daily chore a receipted, policy-checked headless run. Phase 03 is a real ≥7-day proving week, so it closes on elapsed time rather than effort |
| policy | IDLE | arc-policy (Cycle 9, closed 2026-08-10) | — (cycle closed, merged as 677b67e / PR #130, closed by e594d6e / PR #147) | 7d / 7.0d | — | **CLOSED 2026-08-10 — 5/5 phases, and the engine is FIXTURE-PROVEN, UNEXERCISED.** Counted on the canonical spine at close: **4 new kinds added, 0 production emissions** — `promotion.requested` 0, `incident.raised` 0, no policy-family kind present across 975 events. Assumption row 1s trigger (*Phase 4 closes and 7 dogfood days pass with zero of both*) is **ARMED and half-satisfied**; re-check **2026-08-17**, when it either fires or the cycle was pulled after all. Row 3 (PreToolUse fires for MCP via matchers) is **UNVERIFIED** — the matcher only exists since 2026-08-09 and no record shows an MCP call intercepted. Phase 04: 26 findings, the last an owner action no agent may perform. Hostile corpus 54 → 64. **Deferred with a named owner: REQ-07s 53-row cap migration** |
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
| 0400–0499 | `leads` — claimed at birth, 2026-08-04 (0400–0413 taken) |
| 0500–0599 | `policy` — claimed at birth, 2026-08-06 (0500–0508 taken) |
| 0600–0699 | `absorb` — claimed at birth, 2026-08-09 (0600–0606 taken) |
| 0700–0799 | `memory` — claimed at birth, 2026-08-11 (0700–0709 taken). **Recorded here from an UNMERGED branch** (`technology-ashiq/arc-memory`), which is why there is no board row yet: ADR-0061 gives a lane a row only once `initiatives/memory/` exists on this tree. The band is claimed the moment the ADRs are written, not the moment they merge — a table that only sees merged branches cannot prevent the collision it exists to prevent, and it nearly sent `scheduler` into the 0700s on 2026-08-12 |
| 0800–0899 | `scheduler` — claimed at birth, 2026-08-12 (0800–0806 taken) |
| 0900–0999 | next lane to be born |

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

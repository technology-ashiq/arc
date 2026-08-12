# PORTFOLIO.md — the company board

> **A view, never the truth (ADR-0051).** Every value below is derived from a lane's
> `initiatives/<lane>/PROGRESS.md` machine header — nothing is copied from prose and
> nothing originates here. On any mismatch the lane files win and the board lint says so.
> Truth hierarchy: `PROGRESS.md` = where the work is · `PLAN.md` = what the cycle is ·
> this file = index + priority · `docs/HISTORY.md` = the immutable company log.
>
> Row order **is** the priority order. There is no priority column, no owner, no ETA and
> no health field: a number nobody recomputes is a number that starts lying.

Updated: 2026-08-13

## Active initiatives

| lane | status | cycle | position | appetite/burn | blocked-on / depends-on | next |
|---|---|---|---|---|---|---|
| absorb | IDLE | arc-absorb (Cycle 10, closed 2026-08-10) | — (cycle closed, merged as 30dc9a9 / PR #138 and 6850250 / PR #151, 8 of 8 REQ) | 8d / 6.5d | — | **CLOSED 2026-08-10 — 5/5 phases, 8/8 REQ, 1.5d unspent.** The technique loop ran end to end on a real source: read-only study of gstack `/review` (license NOT FOUND → zero copying) → extraction report → 1 ABSORB / 2 SKIP / 1 ROUTE → rebuild on **ADR-0602 Amendment 1s own route 2**, no allowlist widening → 3-fixture A/B whose pass condition was committed BEFORE the harness existed → sealed-blind pick → adoption. **THREE RECEIPTS POINTING THREE WAYS, ALL KEPT:** the harness cleared its condition (claimed class 3/3; main-report precision **-2.1 pts**, since 6 of 9 demoted findings are TRUE), the blind pick chose the OLD way, the adoption decision overruled a *retire* recommendation. 32 adversarial findings, every one of the cycles 15 defect classes recurring, CI green before any of them. Tests 2022 → 2216. `/arc-kickoff --lane absorb` when a trigger arm actually fires — ADR-0074s waiver was for ONE cycle |
| bench | LIVE | arc-bench (Cycle 13, opened 2026-08-12) | 00 | 8d / 0d | — | **Born 2026-08-12 under the owner's build-out ruling (ADR-0900), which supersedes bench's unfired pull-trigger.** Kickoff verification falsified five of the design source's inherited premises: **1 driver in real use, not ≥2** (engine's own Phase 03 evidence already said *"NOT MET, and it is not close"*) · **3 eval fixtures against a floor of 5, with zero assertions anywhere**, so "quality = assertion pass-rate" had no substrate · **`drivers/mock` and driver `--version` do not exist** though `plans/README.md:42` recorded them shipped · **`arc engine bench` has never existed** (no `arc` binary at all) · **no pricing snapshot exists**, so the ₹500/₹100 caps could not be re-priced. So this cycle builds the road as well as the runner: appetite 8d (raised from 4d), one class (`commit-msg-draft`) armed to 5 fixtures over distinct repo states, the other two honestly at `NO PROPOSAL`. ADR century **0900–0999** claimed — the board's `0700 = next lane` row was stale (memory holds 0700s, scheduler 0800s, both unmerged), the third occurrence of that pattern. Attack panel ×3: 20 findings accepted, 1 rejected; simulation gate 10 → 4 blockers, all fixed. **Kickoff committed as `97faea9` (PR #164) and APPROVED** — `kickoff.done` → `approval.requested` → `decision.recorded` all on the canonical spine, verified out of `_quarantine/`. **Next: Phase 00 slice 1 — `drivers/mock` + the negative control that must stay RED until the mock is built right** |
| develop | IDLE | arc-develop (Cycle 6, closed 2026-08-03) | — (cycle closed, merged as 17473e7 / PR #100) | 7d / 2.1d | — | `/arc-kickoff --lane develop` when a new cycle pulls it |
| engine | LIVE | arc-engine (Cycle 7, opened 2026-08-12) | 04 | 7.5d / 0.0d | — | **executor v1 — the hired hands.** One external agent runtime (Hermes Agent, `v2026.8.3`) hired as a governed engine driver, plus the reusable hiring kit. Kickoff produced PLAN, 5 phase specs and **ADRs 0208–0219**; `0207` was already taken inside this band by a `memory`-lane branch, found by checking sibling worktrees. Five drift items against the design source, the largest being that **the ENG-D exit map it calls "inherited" does not exist** — the real contract is `0` ok / `1` driver-fail / `2` budget-declined and there is no data-boundary concept at any layer, while the certification suite asserted `exit 5` twice (resolved by ADR-0219). Three fresh attackers returned 21 findings, 19 applied, four of them ordering defects — including a capped credential provisioned a phase *after* the fixtures that consume it, which could have fired the STOP for a scheduling bug rather than an isolation gap. Simulation gate 18 blockers → 6, all closed but **not re-verified** (one respawn permitted). Pre-approval recon: **RUNNABLE HERE**, Windows Tier 1 native — but tag `v2026.8.3` carries **no release assets** and its npm/PyPI channels were retired, so the runtime is obtained as a **container image pinned by digest**, never a host `curl`-pipe. **APPROVED 2026-08-12** (`01KZTKAF70H19K7PNJVWBXZDT5`), Docker verified up, Phase 04 opening. Phases 04–06 run at **zero spend** on local ollama; the capped-key ceiling is not needed until fixture 4 |
| evolve | IDLE | arc-evolve (Cycle 7, closed 2026-08-04) | — (cycle closed, merged as 8e80927 / PR #108; fixture-proven, unexercised) | 7d / 7.0d | — | `/arc-kickoff --lane evolve` when a real client names a surface |
| leads | LIVE | arc-leads (Cycle 8, opened 2026-08-04) | 03 | 11d / 7.5d | — | **00, 01, 02 and 04 CLOSED. Phase 04 — arc sends its own mail** (ADR-0415): 9 live messages through the real vendor, 9 delivered, 0 bounces, placement confirmed in the inbox, `dkim=pass` aligned to the sending domain, 47 → 74 tests. Two adversarial surfaces returned **27 findings overlapping on 3**; CI found 2 classes neither saw; the close ceremony found 3 more. **Closed with one row open by the owner's decision: `_dmarc.automemory.ai` is NXDOMAIN**, and `preflight.mjs` refuses on a missing record and on `p=none` — so that TXT record is **Phase 03's entry gate**, and the Gmail-class header read waits behind it rather than measuring a config already known to be incomplete. **Phase 05 — real campaign PARKED**, four gate rows NOT THIS QUARTER, re-open trigger = the day an offer is named. **2026-08-10: Phase 03 RUNNING.** The DMARC row is CLEARED (`p=quarantine` live) and both coupled entry-gate rows landed as `5b7deb3` (PR #136), so Phase 03 is running: slices 01–05 proven, **slice 06 merged as `bbfcede` (PR #145) while carrying an explicit DO-NOT-MERGE from both adversarial surfaces** — repaired on `feat/arc-leads-slice-06-fixes` and **PR #150 MERGED as `b3dd8e5`**: ELEVEN adversarial rounds, two independent surfaces each, returning 3, 9, 10, 8, 2, 3, 2, 1, 1, 4 and 0 CRITICALs with near-zero overlap between the surfaces every round -- round 11 read the whole branch including round 10 fixes and returned MERGE, the first round to end with no CRITICAL. **CI green at `cac15e8`** -- 19 jobs, 0 failures, read per-JOB, and the merged tree re-verified on `main` by workflow_dispatch because CI never runs on a main push. It went red at `c5865c8` on four assertion counts that round 10 caught and this branch fixed, which is the only reason that sha is worth naming. **The merge did NOT close slice 06**: the slice is five complete journeys against five real people and the send is the owner keystroke, so `phase-03-tasks.md` slice 06 stays empty until the live run happens. Carried-forward holes are listed in `phases/phase-03-known-holes.md`, and the owner set the bar on 2026-08-10: only a CRITICAL blocks this slice. **The 100% appetite line was reached the same day and the owner chose to EXTEND, 7d → 11d**, with Phase 03's own line 1.0d → 4.5d; recorded in `PLAN.md` § Appetite rather than absorbed silently |
| ledger | LIVE | arc-ledger (opened 2026-08-12) | 01 | 8d / 3d | — | **Phase 00 CLOSED 2026-08-13 on run 31641578789 (`b65772b`), 18/18 selftest jobs read per JOB, head SHA confirmed.** REQ-01/02/04 green: the PII contract wired into the emitter so it cannot be bypassed, integer minor units with BigInt FX, the normalizer owning the one zone conversion, `arc pnl`, two export parsers over one summable row type, 70 tests. **The adversarial pass found the PII control DID NOT WORK** — a mobile number, a dotted name, a PAN and an Aadhaar all reached the spine through the real ingest path while the comment beside the grammar claimed they could not be spelled in it — **and that 34 of 37 fixture ids were rejected by that same grammar, so the MRR suite had never once executed.** CI reproduced the second finding independently before it was fixed. Also found: a literal NUL byte making the money core BINARY to git (`0 insertions` on a 1473-byte change, invisible to grep), and `"1180"00` parsing as 100x while keeping `net == gross - tax - fees` intact. Two surfaces, 30 findings, **zero overlap**. Five CI cycles, four of them catching things invisible on the dev box. Shard weights measured rather than guessed: money-math 47s against a default of 16. **Next: Phase 01 kill-distance — `ventures.yaml`, the 80% warning, and the UNRECEIPTED CRITERIA CHANGE refusal** · Born 2026-08-12 under the owner's Build-out Mandate (`01KZTM348858PDH44K4HA64CVA`, the same `decision.recorded` the executor Phase-0 ADRs cite; A8's letter kept). The money brain: per-venture P&L derived only from spine receipts, `arc pnl`, month-close behind a blocking reconciliation gate, no PII on the spine. ADR century **1000–1099** claimed; **ADR-1000..1015**. Kickoff verification against the live tree contradicted the design source three ways: **Constitution A9 is "Appetite over estimate", not live-slot discipline**, so the "live slot free (A9)" checklist item cannot be satisfied as written (WIP is 3 vs a guideline of 2, and ADR-0052 makes that informational, never blocking) · the vocabulary is **44 kinds, not 22**, so `month.closed` is 44→45 (ADR-1004) — the design source's stale count is exactly the failure ADR-0107's derived-count rule exists to prevent, reproduced by the doc that cites it · the **"policy rows land in the same change" item is a category error** and is corrected by **ADR-1011**: `hq.policy.yaml` keys subjects, not action kinds, and a `process:ledger` row would create a self-authorizing money subject next to an E2 list whose first entry is "moving money" — precedents ADR-0703 and ADR-0912 both say no subject. Four open forks decided at kickoff: money is **integer minor units** (ADR-1012), second currency **USD** (ADR-1013), **no cache** with the determinism proof asserting which reader engine ran (ADR-1014), and reconciliation takes **both input paths** over one summable parser type (ADR-1015). Money side of the live spine is **0 revenue / 0 cost events**, so closure language is fixed in advance: *mechanism proven, live value pending*. **Next: owner approval, then Phase 0 — the PII validator ships before any ingest path exists** |
| memory | IDLE | arc-memory (Cycle 11, closed 2026-08-12) | — (cycle closed 2026-08-12, 3/3 phases, 7/8 REQ validated + 1 cut; merged to `main` 2026-08-12 as `9581011`) | 5d / 3.75d | — | **CLOSED 2026-08-12 — 3/3 phases, 7/8 REQ validated, REQ-07 CUT on its own measurement, 75% of 5d with every phase under its own line.** Shipped: one count-verified index over 5 organs (`N_parsed == N_indexed`, every exclusion named with file and line) · `arc-recall` bm25f under 1s on 3 OSes with zero npm deps · `--decisions` reader-only with a closed-set grammar, **KINDS still 44 because memory emits nothing** · a write-time near-duplicate check that surfaces and never resolves · a golden gate beating the recorded grep baseline **12 to 5**, whose bar lives in the fixture rather than in the script · an equivalence contract whose tie-break is **asserted, not printed** · kickoff AND review both receiving recall unasked, as additive process-file steps. Closed on run **31575423877 @ `1245cb2`, 19/19 jobs read per-JOB**, all four memory suites EXECUTED on all five OS-by-node combinations, zero `not ok` on any leg. **Six adversarial passes across the cycle, 94 findings; the ones that mattered were all gates that could not see their own failure** — a 60-line stub reading no organ passed fifteen assertions of the recall suite including its determinism proof; `TIE_BREAK` was a string a gate printed and nothing compared against, so inverting the comparator left two gates green at exit 0; the golden gate could be passed by DELETING the row that failed; `spine-reader-lint` could not tell *scanned clean* from *could not scan*. **Twin-fix recurred three times in two days**, so the last pass was applied by grepping the pattern rather than the file. Every assumption trigger was adjudicated **by running its measurement**: 0 of 7 FIRED, 3 named NOT EVALUABLE rather than scored green. Open in writing: **D-01** (REQ-06's named CI job deferred — `.github/workflows/**` denied on purpose; the gate still bites through the suite, only per-JOB legibility is deferred) and **D-02** (no `develop.started`/`slice.done` receipts for phase 02, deliberately **not backfilled** — emitting at `ts=now` puts a ~0-minute span into a metric whose guard has a ceiling and no floor, and pinning the clock writes a forged past timestamp into an append-only log; a named absence is recoverable, a false record is not). Still true and reported twice: **the alias layer ships EMPTY and unearned**, and **the module has never run in a consumer repo** — everything proven here is on arc's own corpus, which is the honest limit of this cycle's evidence. **merged to `main` 2026-08-12 as `9581011`.** |
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
| 0200–0299 | `engine` — claimed at birth, 2026-08-03 (**0200–0219 taken**). `0207` was written by `memory` on 2026-08-11 **with the owner's approval**, because retiring a migration proof is an engine decision and memory needed it to land its hooks — sanctioned, not a stray. It still cost engine Cycle 7 a number: that cycle read "highest is 0206" in its own worktree, and only found 0207 by checking sibling worktrees, because the band table and `wip-line` each see one worktree alone. **0208–0219** are engine Cycle 7 (executor v1) |
| 0300–0399 | `evolve` — claimed at birth, 2026-08-03 (0300–0310 taken) |
| 0400–0499 | `leads` — claimed at birth, 2026-08-04 (0400–0413 taken) |
| 0500–0599 | `policy` — claimed at birth, 2026-08-06 (0500–0508 taken) |
| 0600–0699 | `absorb` — claimed at birth, 2026-08-09 (0600–0606 taken) |
| 0700–0799 | `memory` — claimed at birth, 2026-08-11 (0700–0709 taken); merged to `main` 2026-08-12 as `9581011` / PR #162 |
| 0800–0899 | `scheduler` — claimed at birth, 2026-08-12 (0800–0806 taken). **Recorded here from an UNMERGED branch** (`feat/arc-scheduler-cycle-12`, local only — not even on `origin`), so it is invisible to anyone who checks remotes alone. ADR-0061 gives a lane a board row only once `initiatives/scheduler/` exists on this tree, which is why there is no row above yet. **The band is claimed the moment the ADRs are written, not the moment they merge** — a table that only sees merged branches cannot prevent the collision it exists to prevent |
| 0900–0999 | `bench` — claimed at birth, 2026-08-12 (0900–0914 taken) |
| 1000–1099 | `ledger` — claimed at birth, 2026-08-12 (1000–1015 taken). The design source `docs/strategy/plans/PLAN-ledger.md:36` recorded `0600–0699` as "next lane to be born" as of 2026-08-09; by kickoff that was three centuries stale (absorb 0600s, memory 0700s, scheduler 0800s, bench 0900s). **Fourth occurrence of the stale-band-row pattern** — and the check that caught it is the same one bench used: enumerate the highest ADR in EVERY sibling worktree, not just this one, because `scheduler`'s band is claimed from a branch that is not even on `origin` |
| 1100–1199 | next lane to be born |

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

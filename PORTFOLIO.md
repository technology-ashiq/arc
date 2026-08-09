# PORTFOLIO.md — the company board

> **A view, never the truth (ADR-0051).** Every value below is derived from a lane's
> `initiatives/<lane>/PROGRESS.md` machine header — nothing is copied from prose and
> nothing originates here. On any mismatch the lane files win and the board lint says so.
> Truth hierarchy: `PROGRESS.md` = where the work is · `PLAN.md` = what the cycle is ·
> this file = index + priority · `docs/HISTORY.md` = the immutable company log.
>
> Row order **is** the priority order. There is no priority column, no owner, no ETA and
> no health field: a number nobody recomputes is a number that starts lying.

Updated: 2026-08-09

## Active initiatives

| lane | status | cycle | position | appetite/burn | blocked-on / depends-on | next |
|---|---|---|---|---|---|---|
| absorb | LIVE | arc-absorb (Cycle 10, born 2026-08-09) | 02 — starting (00, 01 CLOSED) | 8d / 2.0d | — / — | **Lane born today, and born on a waiver — read `docs/adr/0074` before questioning it.** All three of the design source's gates failed: the live slot was held by leads and policy, the venture clock ran to 2026-08-11, and **no trigger arm had fired** (PLANOFF-01 has arc at the *top* composite; PLANOFF-02 is designed-not-run; no Capability Proposal returned "technique"; `capability-lock.json`'s one row has zero use receipts). The owner was shown that audit and ruled **arc-first**: ADR-0074 defers the venture clock explicitly, waives the trigger gate for this cycle only, and **flags the A8 tension for him rather than resolving it**. ADR-0600–0606 record ABS-A..G; ABS-G decided the century, `products/absorb/` as the code home, an empty registry seed, and the **first target — the unspecified-input defect class, studying gstack's post-build review pass** (PLANOFF-01: arc planned by risk and still neither found nor survived the malformed-escape defect that gstack's review pass caught). Attack panel returned **18 findings across 3 surfaces, 17 accepted**; kickoff-lint green. **Phase 00 CLOSED 2026-08-09** — ~0.5d against 1d, 31 tests, CI green 19/19 (run `31300644910`, per-JOB). Its audit **contradicted ADR-0606's own stated reason** (no product dir holds data, so "develop-lane symmetry" was false; the decision stands on sync-surface exclusion instead → Amendment 1), found develop's lock has **no declared schema**, and found the scout has **no `technique` verdict** for ADR-0604 to hook into until REQ-05. Two CI reds on the way, one of them `products.bats` catching a manifest that landed with no CATALOG entry. **Phase 01 CLOSED 2026-08-09** — ~1.5d against 2d, 31 → **78 absorb tests**, CI green 19/19 (run `31303232950`). **The kill criterion did NOT fire: the no-execution boundary is fixture-proven** by three mutants (install/import/eval) plus a positive control, so assumptions row 1 is validated. **Its adversarial pass — two fresh agents, different surfaces — rewrote most of the phase:** `walk()` never recursed at all · a report entirely quoted inside a code fence linted with **zero warnings** · the hostile driver passed a stub that opened **no file** · a hardlink read content from outside the root · `--scaffold` let a filename inject a fabricated ABSORB row into a report labelled DERIVED · the A5 rule was bypassed by nesting copies inside `lock_ref`. **Assumptions row 6 FIRED** — the implementation-risk row the evolve retro required — and was resolved inside its own phase. **Next: Phase 02 — registry and guards; first phase owing an `arc-evidence.sh` bundle** |
| develop | IDLE | arc-develop (Cycle 6, closed 2026-08-03) | — (cycle closed, merged as 17473e7 / PR #100) | 7d / 2.1d | — | `/arc-kickoff --lane develop` when a new cycle pulls it |
| engine | IDLE | arc-engine (Cycle 6, closed 2026-08-03) | — (cycle closed, merged as b9a9e9f / PR #103) | 14d / 2.0d | — | `/arc-kickoff --lane engine` when a new cycle pulls it |
| evolve | IDLE | arc-evolve (Cycle 7, closed 2026-08-04) | — (cycle closed, merged as 8e80927 / PR #108; fixture-proven, unexercised) | 7d / 7.0d | — | `/arc-kickoff --lane evolve` when a real client names a surface |
| leads | LIVE | arc-leads (Cycle 8, opened 2026-08-04) | 03 — Phase 04 CLOSED; 03 blocked on one DNS record | 7d / 5.5d (**93% allocated**) | external — owner: publish `v=DMARC1; p=quarantine` at `_dmarc.automemory.ai` / — | **00, 01, 02 and 04 CLOSED. Phase 04 — arc sends its own mail** (ADR-0415): 9 live messages through the real vendor, 9 delivered, 0 bounces, placement confirmed in the inbox, `dkim=pass` aligned to the sending domain, 47 → 74 tests. Two adversarial surfaces returned **27 findings overlapping on 3**; CI found 2 classes neither saw; the close ceremony found 3 more. **Closed with one row open by the owner's decision: `_dmarc.automemory.ai` is NXDOMAIN**, and `preflight.mjs` refuses on a missing record and on `p=none` — so that TXT record is **Phase 03's entry gate**, and the Gmail-class header read waits behind it rather than measuring a config already known to be incomplete. **Phase 05 — real campaign PARKED**, four gate rows NOT THIS QUARTER, re-open trigger = the day an offer is named |
| policy | LIVE | arc-policy (Cycle 9, born 2026-08-06) | 04 — in progress (00, 01, 02, 03 all CLOSED) | 7d / 6.8d | external — owner: 3 edits to `.claude/settings.json` / — | **00–03 CLOSED. Phase 04 built, attacked and green** — 2 days, 4 fresh agents, 26 findings (23 closed · 2 rejected after measurement · 1 the owner action), hostile corpus 54 → 64 rows, kill criterion did not fire. **Merged as `677b67e` (PR #130) on 2026-08-08** — the code is in the trunk and strictly better than what it replaced. The phase stays OPEN on one item that is not an agent's to do: the three `docs/owner-action-settings-json.md` edits, refused by two independent layers, which is the rule working |
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
| 0700–0799 | next lane to be born |

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

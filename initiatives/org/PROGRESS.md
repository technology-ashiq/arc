# PROGRESS.md — org v1 "arc's company layer"

status: LIVE
cycle: arc-org (Cycle 18, opened 2026-09-29)
phase: 03
appetite: 10d
burn: 7.0d
blocked-on: —
depends-on: —

> Tracker for the initiative planned in `PLAN.md`. Rows flip ✅ only via `/arc-phase-done`
> (tests green on CI + live demo + exit criteria + evidence). Evidence is lane-scoped at
> `initiatives/org/evidence/phase-NN/` (ADR-0055). ADRs, the retro-log, HISTORY and the
> trial-ledger stay at repo root (ADR-0053). This lane holds ADR century **1600–1699**;
> ADR-1600..1622 are written.

## Phases

| Phase | Capability | Appetite | Status |
|---|---|---|---|
| 00 | The catalog + its gate — ruling on the spine, `products/org`, 71 cards, `org-coverage` + `--mutant-selftest`, generated chart, genesis digest | 2.5d | ✅ closed 2026-10-01 |
| 01 | Attribution + scorecard — `org/attribution.yaml`, `org review --role` + `--audit`; **day-3 kill checkpoint**; Nilluvai pilot gate | 1.5d | ✅ closed 2026-10-01 |
| 02 | Staffing — team manifest + `org.team` digest, `sync-to-project --team`, Nilluvai staffed, hire path + bench interview, three skills | 2.5d | ✅ closed 2026-10-01 |
| 03 | The COO + the review loop — `org-dispatch` script-job, five pilot days, first `org review`, retro + seal | 2d | ✅ closed 2026-10-01 |

**Appetite burn:** 7.0 of 10 days used (8.5 d planned; Phases 00-03 closed 2026-10-01; the 5 pilot days moved to the first venture, ADR-1612 Am. 1). Tripwires: day-3 checkpoint PROCEED; the 50% tripwire passed with Phase 01 built but unclosed, under the owner ruling of one PR merged once.

## Done-log

- **Phase 00 — catalog + gate — closed 2026-10-01.** 71 role cards, `org-coverage` with its mutant self-test (15 arms through the real CLI), the generated chart, `products/org` and its birth rows. Ruling approved `01M3QSAJ8R7P6NQW2JJB776330`; genesis over the final catalog digest `99e6694e…` approved `01M3SZJ7VBT97Y8ZGXK5E76P20` (the earlier `01M3QSK9…` was over a stale digest). REQ-01, 03, 04, 13 validated. Tests: org-card 9 · org-chart 6 · org-coverage 7. Time 2.5 d vs 2.5 d. amendments: 1 (ADR-1612 Am. 1 resynced ORG-L) · reopened: n · t-to-phase0: 2 days.
- **Phase 01 — attribution + scorecard — closed 2026-10-01.** `org/attribution.yaml`, `org-review` (--role/--all/--audit/--checkpoint/--kinds-table). Day-3 checkpoint PROCEED, 5 seated roles. REQ-05 validated. Pilot gate FIRED and routed to ADR-1612 Am. 1 (the pilot is deferred, the cycle is not paused). Tests: org-review 13 (incl. the BOM+CRLF map, logic L4). Time 1.5 d vs 1.5 d. amendments: 1 · reopened: n.
- **Phase 02 — staffing — closed 2026-10-01.** Team manifest grammar and `org.team` digest gate, `sync-to-project --team`, the hire stamp checking the interview on the spine, three skills. REQ-06, 07, 11 validated on fixture teams and mutants. The Nilluvai team and one real hire are DEFERRED to the first venture (ADR-1612 Am. 1); they are not counted as met. Tests: org-team 11 (incl. the decided-twice refusals, logic L1/L5). Time 2.0 d vs 2.5 d. amendments: 1 · reopened: n.
- **Phase 03 — COO + review loop — closed 2026-10-01.** `org/stages.yaml`, the deterministic dispatcher (dry-run default, `--emit`, scheduler wrapper), first `org-review --verdicts` (keep 35 · promote 0 · retrain 1 · retire 1). REQ-10 validated; REQ-08 dropped to the first venture (acceptance kept verbatim; the claim "the dispatcher proposes work the owner wants" is UNPROVEN). The scheduler job waits on the owner's `process:org-dispatch` policy row. Tests: org-dispatch 9. Time 1.0 d vs 2 d. amendments: 1 · reopened: n.
- **Attack + CI for the whole cycle:** boundary 4 passes, 39 findings, all fixed but 2 LOW (debt). Logic surface: first result only on 2026-10-01, after fixing the engine's generic-api driver (it did not stream, and Node fetch cut every answer at 300 s); 6 findings, 3 real fixed (L1/L4/L5), 2 rejected by design (L2/L3), 1 LOW to debt (L6). CI at d155ab99: 18/19 green; the one red (face-browser, windows shard 1) is red on main too (dispatch 36873468339). Evidence bundles 00-03 written and verified.

## Now

**Current position:** kickoff complete 2026-09-29 — PLAN, four phase specs, ADR-1600..1623 written;
century 1600 claimed after a 13-worktree + remote-branch sweep. `kickoff-lint` PASSES (two honest
WARNs: 85% appetite use, one heuristic vague-word). Attack panel: 21 findings — 19 applied, 1 partial
(the checkpoint keeps its locked name "day-3"), 1 rejected. Simulation gate 12 → 6 blockers, all 6
closed but NOT re-verified (two non-zero rounds = owner's call). Birth rows applied: `expected-set.json`
(`lanes.org`, `adrs.1600`, and the missing `PLAN-org` plan row), `rooms.generated.json`, PORTFOLIO, wiki.
Receipts (main clone): `kickoff.done` `01M3QF38HX8BA33G1B52RRQZ3G` · approval request `01M3QF3A1FSQHMR16RV01967AF` · **APPROVED** `01M3QF5AFYG944NQHBDHC6CFKR` (owner confirmed in session 2026-09-30). ANOMALY: that decision landed ~2 s after the request, actor `arc-event`, reason `approved`, not written by this session — an approval gate that decides itself is a governance hole to trace (no action taken here).

**Kickoff trace (REJECTED lines, ADR-0067):**
- REJECTED: the `org.*` profiles must be registered in `hq.policy.yaml` or be refused at emit — unsupported (`approval.requested` is generic, `validate.mjs:410`)
- REJECTED: rename the day-3 kill checkpoint to "Phase 01 step-2 checkpoint" — violates-no-go (the owner locked the name and question; its timing was tightened instead)

**Build log 2026-09-30 (owner ruling this session: "all phases, one PR, merge once at the end, do not wait"; this overrides the PLAN line that merged P00 and P01 separately):**
- P00 built: 71 cards, org-coverage + 14-arm self-test (13 arms through the real CLI), chart, digest, products/org. Boundary attack: three passes (d62ae10, 4a4a17b, c7eddd6), 26 findings, 25 fixed, 1 LOW to debt. The third pass exceeded the two-round cap because arc-attack re-ran boundary on a new SHA; recorded, not repeated.
- LOGIC surface has NOT produced a result yet (qwen free and deepseek-v4-flash both hit the 60 s per-attempt default); the next run sets ARC_LLM_TIMEOUT_MS=420000 (debt row 3).
- CI run 36643308697 (c7eddd6): 3 distinct reds, all fixed: example card stem, products CATALOG, and a face index room broken by mapping the product to it.
- P01 built: org/attribution.yaml (24 rules, 15 name their source), org-review (--role/--all/--audit/--checkpoint/--kinds-table). Live spine (1457 receipts): 13 of 71 roles have evidence, audit 0 differences, day-3 checkpoint PROCEED with 5 seated roles. Cost: 0 cost.incurred receipts exist, so every cost column reads no evidence (ORG-P enforcement is real only once cost receipts exist). A-01: decision.recorded, content.published and lead.researched are closed (map-only); run.completed, approval.requested, review.completed, slice.done, phase.closed and kickoff.done accept payload.role.

**Receipts (main clone):** ruling request `01M3QG94BA03NM6692VRMXNN51` -> approved `01M3QSAJ8R7P6NQW2JJB776330` (2026-09-30) · genesis request `01M3QSK9P0DZJXKR2XSC4PMKHB` over digest `4b459d8e...` (71 cards, 37 genesis) -- awaiting approval.

- P02 mechanism built: team manifest grammar + org.team digest governance (org-team --init/--validate/--digest/--check/--products-for), sync-to-project --team in BOTH twins over the one --products installer, hire stamp (org-catalog --hire) that verifies the interview on the spine, org-coverage --spine-dir re-verifying every interview ULID, M14 team-E2 arm (15/15), three ORG-H skills (council-consult, outreach-draft, support-reply) registered as capabilities and bound to chief-of-staff, sdr-outbound, support-l1. CI 36649278109 reds (face every-product-mapped, stale wiki counts) fixed: products.org maps to toolbelt.
- The catalog digest moved when skills were bound, so genesis request 01M3QSK9P0DZJXKR2XSC4PMKHB is over a STALE digest; a fresh genesis is emitted over the final cards at the cycle close.
- WAITING ON THE OWNER for P02 pilot parts: Nilluvai registration (kill lines are his), then org-team --init nilluvai, its org.team approval, fixtures/KPIs/schemas for the pilot roles, one interview.

- P03 built: org/stages.yaml (8 stages, receipt-measured exit criteria), the deterministic dispatcher (lib/dispatch.mjs + org-dispatch CLI, dry-run by default, --emit as scheduler:org-dispatch, and a jobs/ wrapper as the scheduler entry). It proposes only for governed teams, carries goal ancestry, enforces the queue cap of 7, counts vacancy demands (a hire at 3), sends one budget-cap request per spent seat, proposes a stage change when every criterion is met, and never duplicates an open proposal. The first org review (--verdicts) ran over 37 staffed seats: keep 35, promote 0, retrain 1 (board-advisors, 1/4 ok), retire 1 (devops-release, 8 runs none ok). Heartbeat evidence never promotes. The job registration waits on the owner policy row (owner-actions.md section 2).

- **CI GREEN 2026-09-30: run 36658835170, 19/19 jobs at 3d1a29dc** (head SHA confirmed; the last Windows shard ran long and finished success). Boundary attack: 4 passes, 39 findings, all fixed except 2 LOW in debt. The logic surface never produced a result: the free model timed out, then deepseek via OpenRouter returned HTTP 403 (debt row 3, owner account).

**Next step:** Phases 00-03 CLOSED 2026-10-01. Next: merge PR #302 (CI 18/19, the one red is red on main too), emit `phase.closed` receipts from the main clone after the merge, then `/arc-retro --lane org` to seal the cycle (HISTORY row, lane header to IDLE, PORTFOLIO row).

**Change 2026-10-01 (`/arc-change`, owner-approved in session):** the Nilluvai pilot is deferred to the first registered venture (ADR-1612 Amendment 1). REQ-08 dropped (acceptance carried verbatim), A-06 deferred, the Kill-criteria pilot gate marked FIRED and routed. Nilluvai registration is no longer an owner blocker for this cycle. **Open owner items:** the `process:org-dispatch` policy row (job registration only, not a close blocker) · the OpenRouter 403 (logic attack surface) · rejustify-or-retire the expired `build-in-public-draft` router hire (engine lane, ADR-1622).
**Engine bug found and fixed 2026-10-01 (owner chose the fix in session):** the logic attack never produced a result because `drivers/generic-api.mjs` used a non-streamed `fetch`, and Node's fetch (undici) gives up on response HEADERS at 300 s whatever `ARC_LLM_TIMEOUT_MS` says. Six attempts across two models and two input sizes all ended at 304-306 s. A local repro reproduced it exactly (`UND_ERR_HEADERS_TIMEOUT` at 305 s, Node 24.18). Fix: the driver asks for `stream: true` and folds the SSE chunks back into the same envelope; a plain-JSON reply is still read. Pinned by checks D and E in `tests/engine-driver-deadline.mjs` (run by `engine-driver-contract.bats`). Shared engine file, so it rides this PR; every lane's logic attack was affected.
Phase 01 (else the cycle pauses there, ADR-1612) · rejustify-or-retire the expired
`build-in-public-draft` router hire (engine lane, ADR-1622).

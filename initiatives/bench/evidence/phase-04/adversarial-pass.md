# Phase 04 — the adversarial pass

**Date:** 2026-08-13 · **Lane:** bench · **Surfaces:** 2, fresh, neither having seen the code written.

PLAN's rule: *"TWO fresh agents with different surfaces, not one generalist — one on the decision
logic, one on the shell/OS boundary."* Each attacker's prompt carried this lane's **running list of
already-fixed defects** with the instruction to check every one of them **in every OTHER file** — a
fix is not applied until it has been attacked somewhere it was never made.

## The headline: the two surfaces barely overlapped

| | Decision logic | Shell / OS boundary |
|---|---|---|
| Confirmed holes | **15** | **8** |
| Overlap with the other surface | **~0** | **~0** |
| Method | 10 executable probe scripts | 12 executable probe scripts |

Cycle 6 measured the same thing: where two agents attacked one gate they shared the root cause and
almost none of the findings. **A single agent's blind spot is structural, not a matter of effort** —
and this pass is the second measurement of that claim, not a restatement of it.

Both attackers were required to DEMONSTRATE each hole with a script that runs. Every finding below
was reproduced before it was believed; hypotheses that could not be demonstrated were reported as
UNCONFIRMED and are recorded as such at the end.

---

## Surface A — decision logic (15 confirmed)

| # | Hole | Severity | Fixed |
|---|---|---|---|
| A1 | `reconcileGroup` refunded the reservation for every attempt that did **not** report a cost, so a run **overspent its cap 2.16×** (216 spent against 100). The group-level sum treats unmeasured attempts as free. | **critical** | ✅ a partial measurement may only ever RAISE the committed figure |
| A2 | The drift guard reported **`no drift`, `clean: true`** on a run where **every attempt failed** — both rates come back ABSENT and every rate-based tier requires a non-null rate. The worst possible outcome was the one the guard could not see. | **critical** | ✅ a new tier-1a total-collapse alert, checked before anything that needs a rate |
| A3 | A candidate **worse on quality and 4× more expensive** was `eligible: true`; the evidence table printed **PROPOSE**. `decidedBy: "cost-lost"` was computed and then ignored. | **critical** | ✅ inside the band, cost decides — and it can decide AGAINST |
| A4 | `--replay` exited **0** whenever it could not compare, **and the shipped layout never put the baseline where `--replay` looked** — so the Phase-1 byte-identity DoD was untestable as shipped, and deleting one file converted a detected MISMATCH into a pass. | **critical** | ✅ accepts the bundle root or the capture dir; "could not compare" and "empty bundle" are exit 2 |
| A5 | `classifyCostDelta` never checked that money existed: `null - null === 0` reported as a definite *"nothing moved"*, one absent side gave **`Infinity%`**, zero tokens gave **`NaN%`**. | high | ✅ money required on both sides, else `unknown-mixed` |
| A6 | The **champion** was never held to the completeness gate, so a champion that barely ran became an easy bar a 1%-scoring candidate cleared. | high | ✅ symmetric completeness check |
| A7 | `--champion DIR --out DIR` **overwrote the champion** and then compared the run against itself — `decided_by: tie` for any input at all. | high | ✅ refused at parse time |
| A8 | A tampered capture replayed **higher**: `00.json` matched the filter, sorted to rank 0 as a distinct file and silently made K=4; a `{scored:false, schema:true}` record counted as a schema **pass**. | high | ✅ ranks must be exactly `0..n-1`, no leading zeros; a schema verdict without an output is refused |
| A9 | `readCeilings` validated the grammar of `k` and the caps but **not the value set** of the worst-case table — a negative ceiling **refunded** budget per group and admitted a thousand groups against a cap of 100. | high | ✅ finite, non-negative, `process_cap ≤ run_cap`, `k` in 1..100 |
| A10 | Gate order made an **under-covered** class report as having *lost* — the exact confusion ADR-0906 forbids. | medium | ✅ ADR order kept; gate 3's sentence now names the coverage shortfall too |
| A11 | Well-formed assertions that **cannot fail** passed validation: `matches ""`, `contains ""`, `length_between [0, 999999999]` all score 6/6 against garbage. | medium | ✅ refused at the registry |
| A12 | The fixture floor counted **files**, not measurement — five fixtures with `assertions: []` cleared it while measuring nothing. | medium | ✅ both counts must clear the floor |
| A13 | `canonicalJson` **validated one read and rendered another** — the shape this lane already closed in `verdict.mjs`. A getter wrote `"rate": undefined` into a scorecard, past a validator that had just refused `undefined`. `-0` also survived the hash and was destroyed by the bytes. | medium | ✅ one `normalize()` read; every later pass uses the inert copy |
| A14 | `percentile` crossed a rank boundary on float noise (`(p/100)*n`). Latent at the shipped `p=95`. | low | ✅ `p*n/100` |
| A15 | Smaller: repeated flags silently last-wins · a half-measured token count summed as a whole one · `cost_source` last-wins and unvalidated · tier 3 could not fire against a zero champion cost · a missing champion row labelled with a real gate name · `receipt.proposed` listing classes with `diffs: 0` · two ABSENT eval-pack revisions passing as "the same exam" · `a.b.01` and `a.b.1` resolving to one path. | low | ✅ all eight |

**Attacked and NOT broken:** no collision was found in `canonicalString` over JSON documents
(twelve constructed pairs, all distinct — the length prefixes and type tags hold); the 2pp band
epsilon; the anti-goalpost clause; `resolvePath` prototype escapes; `length_between` throwing
mid-scoring.

---

## Surface B — shell / OS boundary (8 confirmed)

| # | Hole | Severity | Fixed |
|---|---|---|---|
| B1 | The fixture id was **confined in `mock.mjs` and unconfined in `arc-bench.mjs`** — including on a **write** path. A `..` in `repo_state` wrote the capture bundle outside `--out` entirely. The mock refuses the identical value with the identical reasoning. | **critical** | ✅ `repo_state` must be a bare `[a-z0-9-]` id, checked where it is loaded |
| B2 | `materializeRepoState` neutralised the git **identity** and nothing else. A global `core.excludesFile` ignoring `*.md` made `git status --porcelain` come back **empty** for a fixture declaring a modified markdown file — the harness materialized, the run scored, **the case measured nothing**. A global `core.hooksPath` made every materialization throw. | **critical** | ✅ system config off, global config pointed at a non-existent path, the survivors pinned empty, `GIT_DIR`/`GIT_WORK_TREE`/… deleted |
| B3 | `spinePaths` honoured `ARC_SPINE_ROOT` on **truthiness** while its own comment claimed presence and cited `spine-io.mjs`. `ARC_SPINE_ROOT=""` fell through to the **real repo spine** — an M7 violation. `readCeilings`, one function away, had it right. | **critical** | ✅ presence, and an empty value is refused |
| B4 | `spineOffsets` stored a UTF-16 **character length** and `spineSince` used it as a **byte cursor**. A snapshot taken mid-multi-byte character sliced into a surrogate pair, the torn line was discarded, and bench then raised a **false M1 violation** against a receipt that had sealed correctly. | high | ✅ byte offsets; a file that shrank falls back to a whole read |
| B5 | `fixtureDirSha` sorted **native absolute** paths, so the hash input order was `path.sep`-dependent — one recording set, **two digests**, and `driver_version` then reported a champion recorded on another CI leg as not comparable. | high | ✅ sorts the normalised relative path |
| B6 | `--champion ""` was accepted and **silently turned the drift guard off**; `--out ""` wrote nothing. An operator typing `--champion "$CHAMPION"` with the variable unset was told nothing had drifted. Repeated flags were silent last-wins. | high | ✅ empty values refused; a repeated flag is an operator error, per `.claude/rules/lanes.md` |
| B7 | A **relative** `ARC_SPINE_ROOT` resolved against two different cwds — bench against the caller's, the emitter it spawns against the repo root. Two spines, "NO receipt was sealed" for a receipt that sealed fine, then a false M1 violation per attempt. | high | ✅ resolved against the repo root; same fix for `ARC_BENCH_CEILINGS` |
| B8 | The mock's `ARC_MOCK_DIR` confinement was **lexical, never `realpath`** — a directory junction inside the recording dir replayed a file from an arbitrary tree, which is exactly what the check exists to stop. | high | ✅ both sides resolved through the filesystem |

**Checked and clean:** the router diff's CRLF exposure (mitigated by `.gitattributes` pinning
`*.yaml text eol=lf`) · `applyTombstones` edge cases (fail loudly, never delete the wrong thing) ·
`replayBench`'s numeric sort · the whole bats surface (ASCII names, self-asserted counts, all four
`setup_file` blocks capturing `$?` rather than piping, no absence-only assertions).

---

## Carried forward, with a named owner

| Item | Owner | Why not fixed here |
|---|---|---|
| `arc-run.mjs:257` still passes `--payload` inline and carries the identical Windows-path `BAD_JSON` bug bench fixed on its own emit path | **engine** | `arc-run.mjs` is a one-line-only path for this lane. Its payload today carries only enumerated values, so no bench run reaches it — the mechanism was confirmed live, the call site is not. |
| `arc-run` emits `run.completed` **without `--strict`**, so a rejected payload quarantines at exit 0 | **engine** | Same fence. Bench guards its own side: `drivers/mock` refuses a `__cost.source` outside the spine's closed set rather than letting the receipt vanish. |
| A `finally` whose first statement throws would skip the repo teardown and replace the original error (four sites) | **bench, next cycle** | Reported UNCONFIRMED: the control-flow consequence was reproduced synthetically, but `rmSync` could not be made to throw on this box. Recorded rather than fixed on a hypothesis. |
| `ARC_DRIVER_FAKE` short-circuits `produce()` (`common.mjs:180-191`) while `engine-driver-contract.bats:6-8` asserts the opposite | **engine** | The 2026-08-03 retro-log finding, still open. `drivers/mock` deliberately takes the opposite approach and slice 02's negative control proves it. |

## What this pass cost, and what it bought

Two agents, ~22 executable probe scripts, **23 confirmed holes in code that passed its own suite**.
Fourteen of them were in code written the same day by the session that also wrote its tests — which
is the whole argument for `gate-author-cannot-be-its-attacker`, measured again rather than assumed.

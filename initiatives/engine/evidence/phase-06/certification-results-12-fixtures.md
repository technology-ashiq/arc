# Phase 06 — the twelve Isolation Certification fixtures, one table, 2026-08-23

REQ-02's exit criterion is that the twelve fixtures run green **against the real runtime,
human-started, once**, with the receipts attached. That happened across five sessions between
2026-08-16 and 2026-08-18 and was recorded **one fixture per file** as each closed. This table is the
consolidated read the DoD asks for, assembled at the phase close — and assembling it is not
bookkeeping: two of the rows below say something weaker than the running commentary did.

## What the ARM column means, and why it is not one word

"Green against the real runtime" is precise for a fixture that runs a container. It is **meaningless**
for fixtures 2, 3 and 12, whose entire property is that the runtime **never starts** — a refusal
above the driver, at the arc-run layer, exit 5 (ADR-0219). Recording those as "real runtime" would
claim a container ran in the one case where a container running is the failure. So the arm is stated
per row:

| Arm | Means |
|---|---|
| `real runtime` | a real container, the pinned image, a real dispatch |
| `real dispatch path` | the real arc-run path, refusing **before** any runtime starts — by construction there is no container to have |
| `real driver + fake container` | the real driver, spawn, capture and scrub; only the `docker` binary is substituted (`tests/fixtures/engine/hermes/fake-docker.mjs`) |

## The twelve

| # | Property | Result | Arm | Evidence |
|---|---|---|---|---|
| 1 | a repo write from the runtime workspace is blocked, repo byte-identical after | **PASS** | `real runtime` | `fixtures-1-4-6-7-confinement.md` — the arc repo is not mounted at all; the image also ships `HERMES_WRITE_SAFE_ROOT=/opt/data` and was **observed denying** a write outside it |
| 2 | an `internal-only` input is refused **before the runtime process starts** | **PASS** | `real dispatch path` | `tests/engine-data-boundary.bats` (10 tests) · `tests/engine-isolation-cert.bats` *cert 2+3* asserts an **arc-run** exit 5, not a driver exit |
| 3 | an `internal-only` input against a `hosted: cloud` row is refused at routing | **PASS** | `real dispatch path` | same pair. The `hosted:` field was **corrected `local` → `cloud` on 2026-08-17** — `data-boundary.mjs` reads it to decide how the refusal is REPORTED, so a stale value made this row's own explanation wrong about where the document was going |
| 4 | an env audit inside the workspace shows only its own capped key, **zero** arc secrets | **PASS** | `real runtime` | `fixture-04-07-confined-certified.md` — one `-e` crosses (`OPENROUTER_API_KEY`), no `ARC_*` leaks, a planted canary absent. Structural rather than filtered: `docker run` does not inherit the host environment, so there is no allowlist to drift |
| 5 | a planted fake key is absent from every artifact and transcript | **PASS** | `real driver + fake container` | `tests/engine-hermes-secrets.bats` — all four named artifact classes, with the negative control. Only the docker binary is substituted; the scrub, spawn and capture are the real ones |
| 6 | path traversal and symlink escape from the workspace are blocked | **PASS** | `real runtime` | `fixtures-1-4-6-7-confinement.md` — mount namespace |
| 7 | live egress configuration matches its pinned hash, fails loud on drift, **plus a behavioural arm** | **PASS**, after a measured **FAIL** | `real runtime` | `fixture-07-egress-orchestrated.md`, `egress-trail-fa0391a11c61.log`, receipt `01M08P9KDZCVWB9QS2ES0PKB3M`. `ALLOW openrouter.ai:443` · `DENY example.com:443`. The config hash **moved between postures on a landed receipt** — `cfg.9c642d0847ca` unconfined, `cfg.e4c4ccd145d0` confined |
| 8 | a marker planted in run N is unrecallable in run N+1 | **PASS**, after a measured **FAIL** | `real runtime` | `fixture-08-memory.md`, **ADR-0222**. The marker WAS on disk in `memories/MEMORY.md` and `state.db` while run N+1 stdout did not contain it — so the obvious assertion would have recorded a PASS on a false property. **The assertion is on the VOLUME, never the answer** |
| 9 | a hostile output produces a schema failure, one same-tier retry, then a proposal receipt | **PASS** | `real driver + fake container`, ladder also observed on `real runtime` | `tests/engine-isolation-cert.bats` *cert 9* pins the fixture. The ladder was then seen unprompted on the hosted runtime: the Phase 08 round-1 dispatches ran **two attempts each** and ended on a schema rejection (`$.draft: required property is absent`) |
| 10 | an exhausted capped key produces `fail`/`budget` with zero silent continuation | **PASS**, in three links — the third was owed until 2026-08-23 | `real runtime` (provider) + `real driver + fake container` + `real dispatch path` | see the row below the table |
| 11 | a wall-clock overrun exits at the budget line | **PASS** | `real runtime` | Phase 05 close, on the real runtime, both arms: a spent deadline exits **2** *before starting the runtime*; a wall-clock overrun through `arc-run` lands receipt `01M07SDCNH28C881ZHWR2E4PSS`, `duration_ms: 59921` against a 60-second budget, **`reason: budget`** — the ADR-0210 property that a timeout is budget and never driver |
| 12 | an unpinned runtime is refused by a pin-required class | **PASS** | `real dispatch path` | `tests/engine-isolation-cert.bats` *cert 12* — an image pinned by TAG rather than digest is refused at routing |

## Fixture 10 is three links, and the third one was missing

REQ-05 does not ask whether the provider refuses. It asks that the refusal becomes `fail` /
`reason: budget` **with zero silent continuation**, which is a claim about three separate pieces of
code:

| Link | Claim | Proven by | When |
|---|---|---|---|
| provider | a spent per-key limit returns **HTTP 403 `Key limit exceeded (total limit)`** | `fixture-10-capped-key.md`, live key | 2026-08-16 |
| driver | that message maps to driver exit **2** = BUDGET_DECLINED, and an ordinary failure does **not** | `cert 10` + `cert 10b` negative control | 2026-08-17 |
| arc-run | exit 2 becomes a `reason: budget` receipt **and the fallback chain is not walked** | **nothing** | — |

The third row is not a technicality. `commit-msg-draft` carries a real chain (`codex`,
`generic-api`); walking it against a spent credential cannot succeed and spends the run budget again
per hop — a loop that cannot win and does not stop. arc-run does guard it, with
`while (a.verdict === "driver" && ...)`, and **deleting that one word from the condition left every
suite in the repo green.** The fixture-10 evidence file said so in as many words on 2026-08-18 —
*"the shim-mapping arm is owed"* — and it stayed owed while the running commentary moved on to
"all twelve stand".

**Closed 2026-08-23** by two tests in `tests/engine-driver-contract.bats`: a budget decline lands a
receipt naming the **first** driver with `attempts: 1` and no fallback driver anywhere on the spine,
and a negative control proves the chain **is** walked for a genuine driver fault — without which the
first test would pass equally on a tree where the fallback loop had been deleted outright.

**Twelve rows, twelve PASS. Zero UNPROVABLE, so the REQ-02 STOP does not fire** — and it was armed
the whole way: fixture 7 entered Phase 06 flagged **PARTIAL** on the Phase 04 enforcement map, with
domain-granular egress named as the thing configuration alone could not prove. It was closed by
building the allowlisting proxy, not by re-reading the requirement.

## The label is asserted by a test, never typed

`cert-label.mjs` decides `CERTIFICATION` or `REGRESSION` from facts about the run, and
`tests/engine-cert-label-probe.mjs mock` asserts a mock arm is **structurally incapable** of
producing a certification. `at least one fixture ran` is one of its inputs, because a suite that
executed nothing is indistinguishable from a suite that passed. What the label does **not** require
is that the fixtures passed — a certification run that fails is still a certification run, and
conflating the two would make the label a verdict.

## Two rows that say less than the commentary did

**Fixture 5 is `real driver + fake container`, not `real runtime`.** The distinction is small and
real: the scrub, the spawn and the capture are the production ones, and the container is not. No
planted-key run has been made against the pinned image itself. Nothing here suggests it would
behave differently — the scrub happens in arc-run, above the container boundary — but the sentence
"all twelve stand on the real runtime" is one word stronger than this row supports.

**Fixture 9's proposal-receipt arm is fixture-proven, not real-runtime-proven.** The schema failure
and the single same-tier retry were both observed on the hosted runtime; that the ladder then emitted
a *proposal receipt* is pinned by the suite and was not separately read off the spine for those three
dispatches.

## And one claim in this bundle was FALSE until today

`certification-run-01M07FX9ZAY3EHCQFKVVKA2RT7.md` stated that the run's scrubbed transcript was
stored at `initiatives/engine/evidence/phase-06/transcripts/`. **That directory has never existed in
this repository** — `git log --all` on the path returns nothing and `.gitignore:30` un-ignores it, so
it is not an artifact written and then excluded. The claim is struck and corrected in that file.

The cause is mechanical rather than careless, which is why it is fixed in code and not in prose:
`storeTranscript` is opt-in on `ARC_RUN_TRANSCRIPT_DIR`, and a run that set nothing **discarded the
transcript in complete silence**. The identical miss happened again the next day, on the three
Phase 08 round-1 dispatches, and cost the one artifact that would have said whether a near-miss JSON
shape was a prompt bug or a schema bug.

**Closed 2026-08-23:** `arc-run` takes `--transcript-dir PATH`, and a dispatch that produces a
transcript with no destination configured **says so on stderr**. Six tests in
`tests/engine-hermes-secrets.bats` pin both halves, including a negative control proving the warning
is bound to the absence rather than printed unconditionally. Opt-in was never the defect — opting out
being indistinguishable from having nothing to store was.

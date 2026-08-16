# Phase 00 — Money math core

**Goal (one line):** A validated payment goes in as a spine event and a correct, reproducible P&L
comes out of `arc pnl`, end to end, with no external service reached at runtime.
**Appetite:** 3 days — blown appetite means cut scope or kill, never extend silently
**Depends on:** none

This is the steel thread. Everything risky about the module lives here: the payload contract that
can never be un-written (ADR-1002), the money representation baked into every fixture (ADR-1012),
and the determinism proof the rest of the build stands on (ADR-1014).

## File layout (created by this phase)

The plan says Phase 0 adds "`arc-pnl.mjs`, its shell wrapper and a lib beside them"; concretely that
lib is a directory, because the validator must be independently committable before any ingest path
exists and the parsers must be separately attackable:

```
.claude/scripts/hq/arc-pnl.mjs              CLI entry: arg parse, render, exit codes
.claude/scripts/hq/arc-pnl.sh               wrapper (hook mode exits 0, strict returns the real code)
.claude/scripts/hq/lib/validate-ledger.mjs           closed-schema + customer_ref grammar (ADR-1002)
.claude/scripts/hq/lib/ledger/money.mjs              integer minor units, rounding rule (ADR-1012)
.claude/scripts/hq/lib/ledger/normalize.mjs          parser row to Appendix A payload, FX (ADR-1003)
.claude/scripts/hq/lib/ledger/pnl.mjs                revenue, MRR, costs, render model (ADR-1007)
.claude/scripts/hq/lib/ledger/parsers/razorpay.mjs   parseRazorpayExport (Appendix C rows)
.claude/scripts/hq/lib/ledger/parsers/mor.mjs        parseMorExport (Appendix C rows)
tests/ledger-pii-validator.bats · tests/ledger-money-math.bats · tests/ledger-determinism.bats
tests/fixtures/ledger/{razorpay,mor,spine,golden}/   fixtures, each directory carrying an INDEX
```

`validate-ledger.mjs` sits beside its siblings `validate-leads.mjs`, `validate-policy.mjs`,
`validate-absorb.mjs` and `validate-experiment.mjs`, and is imported by
`.claude/scripts/hq/lib/validate.mjs` exactly as they are — exporting `LEDGER_KINDS` and
`assertLedger`. That placement is what makes the PII check **unskippable**: it runs inside
`arc-event ingest`, so there is no ingest path that bypasses it. `arc-pnl` never ingests, and ledger
adds no ingest CLI of its own.

`validate.mjs` is a shared organ owned by no lane — run `git log origin/main --oneline -5` on it
before editing; bench, engine and leads are live.

**Commit order is load-bearing, not stylistic:** `validate-ledger.mjs` and its red test land in a
commit BEFORE `normalize.mjs` or either parser exists, so the PII control provably precedes the
first path capable of writing a payload (ADR-1002). Before assuming the manifest moves, check
whether these files are in the sync set at all — see PLAN's Do-not-touch note.

## Exit criteria (Definition of Done)

- [ ] Revenue payload contract v1 implemented per PLAN Appendix A, with a strict-mode validator that
      **rejects PII-shaped fields and PII-shaped values** in `revenue.*` payloads (ADR-1002)
- [ ] The PII adversarial corpus is pinned as red fixtures, and the validator exists **before** any
      ingest path does — ordering verified by the commit order, not asserted in prose
- [ ] Normalization lib: gross/fees/tax/net, integer minor units throughout, FX recorded at ingest
      with rate as a decimal string (ADR-1003, ADR-1012); INR plus USD (ADR-1013)
- [ ] pnl math lib green on pinned fixtures: all 5 MRR transitions, refund, partial refund,
      over-refund needs-you flag (compared in the original charge currency, before FX conversion,
      so rate movement between a charge and its refund cannot fire or suppress it), natural-key
      duplicate flagged as needs-you and excluded from totals rather than netted or auto-picked
      (ADR-1010), the 23:59 IST boundary, cross-currency, **a zero-amount revenue event asserted as
      a REJECTION** (`assertMoney` requires `amount >= 1`, so a 100%-coupon sale cannot be recorded
      as revenue at all — the fixture pins that refusal rather than a rendered zero row), and **a
      payment whose fees exceed its gross**, which the `net == gross - tax - fees` invariant admits
      as a negative net rather than crashing or clamping to 0 (REQ-02, ADR-1007)
- [ ] `arc pnl` v0 renders per-venture rows plus a separate Overhead section for `venture: arc`,
      reading only through `spine.mjs` — `spine-reader-lint.sh` reports 0 violations (ADR-1000)
- [ ] Two export parsers (razorpay, merchant-of-record) returning one typed, summable list of
      normalized payments, so Phase 2 reuses the type unchanged (ADR-1015)
- [ ] Redacted, PII-stripped real export samples pinned as fixtures under `tests/fixtures/ledger/`
      **if obtained this phase**. If the assumptions ledger's first row fires and no export exists
      for a rail, the manual per-payment JSON template is pinned as that rail's canonical fixture
      instead, and the evidence bundle names which path actually happened — the DoD must not be
      uncheckable for a phase that followed the plan's own stated fallback
- [ ] Twin-determinism bats green in CI on 3 OSes: engine equivalence **and** rebuild determinism,
      each leg asserting which engine actually ran (ADR-1014), exercised against **both** the tiny
      steel-thread fixture **and** a fixture of at least several hundred events — a sqlite leg only
      ever compared at scan scale proves nothing about the case the accelerator exists for
- [ ] The row-ordering comparator that makes `scan` and `sqlite` byte-identical is itself proven
      against an **all-ties fixture**: rows sharing every displayed field, built in an order
      deliberately unlike the comparator's sorted order. Retro 2026-08-12 (arc-memory) found an
      equivalence gate that stayed green at exit 0 with its comparator inverted, because the gate
      compared its own printed contract instead of real output
- [ ] Refunds land as linked events carrying `refund_of`, never negative amounts and never a
      supersede (ADR-1016): over-refund, refund-without-charge and refund-currency-mismatch each
      raise a needs-you item and none is ever silently netted
- [ ] Money data lives only on the spine — no `costs.yaml`, no second store anywhere in the diff
      (ADR-1001)
- [ ] `arc pnl` is a CLI under `.claude/scripts/hq/` with no new slash command (ADR-1009)
- [ ] **Adversarial pass complete**: two fresh agents on different surfaces (decision logic; shell
      and OS boundary) against the normalizer, the validator, the FX path and both export parsers.
      **Every hole found in `parseRazorpayExport` is explicitly re-attacked against `parseMorExport`
      and the reverse, before either is marked fixed** — the two parsers are twins born in this same
      phase with no prior defect list to inherit, and retro 2026-08-04 (arc-evolve) recorded a fix
      closed in one file and left open in its twin a whole phase later, the third recurrence of that
      shape. Holes fixed and pinned as red fixtures. Report committed. New lints land WARN-first in
      TRIAL
- [ ] `node .claude/scripts/plan/kickoff-lint.mjs --lane ledger` run and its `[adr-dup]` check
      confirmed exercised — the ADR band 1000-1099 is a convention, and the duplicate detector is
      the actual control (retro 2026-08-02, arc-develop)
- [ ] REQ-01, REQ-02 and REQ-04 green on 3-OS CI, read **per job** (`gh run view --json jobs`), with
      the run's head SHA confirmed equal to local HEAD, and a run confirmed to EXIST for that SHA
- [ ] Tracker updated: the Phase 00 row in `initiatives/ledger/PROGRESS.md` flipped, plus a dated
      entry under that file's `## Done log` section

## Verification plan

- **Test command:** `bats tests/ledger-money-math.bats tests/ledger-pii-validator.bats tests/ledger-determinism.bats`
- **Expected failure first:** `tests/ledger-pii-validator.bats` case "rejects an email-shaped
  customer_ref" drives the real ingest path — `arc-event ingest revenue.received --json FIXTURE`,
  which is strict mode and returns a real exit code. Before `validate-ledger.mjs` is wired into
  `validate.mjs`, that payload is accepted and the test fails asserting `expected exit 2, got 0`.
  The test must go red for the **validator's** reason and not for a missing binary, so it is watched
  failing on `exit 0` against the existing, working emitter — there is no stub to mistake for a
  result. Same discipline for `ledger-money-math.bats` case "over-refund raises a needs-you flag
  rather than netting to a negative", which must first fail asserting the flag is absent.
- **Live demo scenario:** ingest three fixture payments (one INR subscription, one USD
  merchant-of-record settlement with an FX block, one refund superseding the first) into a scratch
  spine, then run `arc pnl --month 2026-09`. Expected: an INR row and a USD row showing original
  currency beside INR, a fee line that does not reduce MRR, a net that reflects the refund, and an
  Overhead section that is absent because no `venture: arc` cost exists. Then
  `rm -rf derived && arc-replay && arc pnl --month 2026-09` prints byte-identical output.
- **Real-system check:** none for money data — the live spine's money side is 0 events and stays
  that way this phase. The reader, the emitter and the vocabulary are real and are exercised against
  a scratch `ARC_SPINE_ROOT`, never against the owner's spine.
- **Expected evidence:** bats output for all three files on 3 OSes with per-job conclusions, the
  golden `arc pnl` render, the byte-diff showing rebuild determinism, the engine-equivalence log
  naming which engine each leg ran, and the two adversarial reports with their fixed-hole fixtures.

## Rabbit holes in this phase

Building a generic decimal or currency library — the detour is integer minor units and exactly two
currencies (ADR-1012, ADR-1013). A provider-adapter framework — the detour is two concrete parsers
with one shared return type, and nothing abstracted over them (ADR-1015). Re-litigating MRR
definitions — the detour is to change a fixture or leave it alone (ADR-1007). Windows locale
chasing — the detour is canonical serialization plus pinned CRLF and BOM fixtures.

## Out of scope for this phase

Kill-distance and `ventures.yaml` (Phase 1). Reconciliation, `month.closed`, the cost trichotomy and
the brief's daily spend line (Phase 2). `--explain` (Phase 2), `--simulated` (Phase 3). No real
provider API is called in any phase.

## Your-setup / pending

One real Razorpay settlement export and one merchant-of-record settlement export, in whatever format
the provider gives. They are redacted and PII-stripped **before** being committed as fixtures. If
neither is obtainable this phase, the assumptions ledger's first row fires and the manual
per-payment JSON template becomes that rail's canonical entry path — the phase does not stall on it.

## Non-negotiables (verbatim from PLAN)

- Derived-only: delete derived state, replay, and the P&L is identical — twin-determinism runs in CI from Phase 0 and never leaves (ADR-1000, ADR-1014).
- Real money only in real views; simulated revenue is structurally excluded, never filtered out at the end (REQ-01).
- PII never lands on the spine, and the validator that enforces it ships before any ingest path exists (ADR-1002).
- Money is integer minor units end to end; a non-integer monetary value is rejected, never rounded (ADR-1012).
- Ledger records money and never moves it: no ledger code initiates a payment, refund, transfer or price change (Constitution E2, ADR-1011).
- Parser-class surfaces — payload normalizer, `ventures.yaml` parser, FX handling, export parsers — get a mandatory adversarial construct-a-breaking-input pass by two fresh agents on different surfaces, holes fixed and pinned as red fixtures, before any FAIL promotion.
- A test asserts it RAN before asserting what it printed; a gate that can only report absence is not a gate (ADR-1014).
- Absent stays absent: nullable-cost honesty end to end, with `source` surfaced on every cost line (MP-F inherited, ADR-1006).
- Month-close is human-run, always; a future scheduler may invoke the same CLI but the gate logic never moves into a daemon.
- Any new or edited file that enters the sync set regenerates `tests/fixtures/sync-golden/tree-manifest.txt` in the same commit — the gate is byte-identity and invisible locally, and membership is decided by the product catalog, never assumed.
- Any edit to this list is swept into all four phase specs' verbatim copies in the same commit — the writer of a change is structurally blind to the sections citing it, and this list is cited four times by construction.
- Inherited whole: zero-dependency Node >=18, bash-3.2/POSIX with no GNU-only constructs, bats in central `tests/` (ADR-0021), 3-OS CI red means no merge, new lints WARN-first in TRIAL, an evidence bundle per phase-done, emit via the emitter and read via the reader only.

# The three adversarial passes — 76 findings across six fresh agents

Every pass ran **two fresh agents on different surfaces**, neither having written the code. That
split is not a formality: across all three passes the two agents' findings overlapped on **one item
out of 76**.

| Phase | Surfaces | Findings | What the pass changed |
|---|---|---|---|
| 00 | decision logic · shell/bytes | 30 | the PII control did not work, and the suite guarding it had never executed |
| 01 | grammar/receipt fold · CLI/OS boundary | 22 | three separate ways the kill switch disarmed itself at exit 0 |
| 02 | gate decision logic · export-sum/CLI | 24 | four separate ways a month closed GREEN that should not have |

## Phase 00 — the control was broken and its guard was inert

A mobile number, a dotted personal name, a name-plus-date-of-birth, a PAN and an Aadhaar number all
reached the spine **through the real ingest path**, while the comment beside the grammar asserted
they could not be spelled in it. Two of that comment's three claims were false.

And the suite could not have caught it: **34 of 37 fixture ids were rejected by the lane's own
grammar**, so the entire MRR section and 3 of 5 determinism tests died at the validator before
reaching the code they tested. CI reproduced the second finding independently before it was fixed.
Four money defects were sitting behind that never-executed section.

Also: a literal NUL byte made the money core **binary to git** — `0 insertions, 0 deletions` on a
1473-byte change, invisible to ripgrep, silently exempt from the repo's LF policy. And data after a
closing quote concatenated onto the value, so `"1180"00` parsed as 118000 — a 100x error that left
`net == gross - tax - fees` intact so every other check passed it.

## Phase 01 — the kill switch was off by default in the tree that wrote it

Three ways it disarmed itself at exit 0, all silent:

1. **`ARC_SPINE_ROOT` deleted the panel AND the `UNRECEIPTED CRITERIA CHANGE` refusal.** The path
   was derived from the spine root, which returned nothing whenever that variable was set. This
   checkout is a linked worktree where the bare invocation refuses outright — so that was the only
   way to run the command here.
2. **`ARC_SPINE_NOW=""` set the render clock to 1970** and turned every kill line ABSENT.
   `Number("")` is 0 and 0 is finite, so the guard passed it; `Number("0x…")` passed too and moved
   the clock forward, manufacturing a false CROSSED. `spineRoot` and `venturesPath` each already
   refused the set-but-empty shape; `nowMs` was the third door in the chain and the only one open.
3. **A mistyped `ARC_VENTURES_FILE` disarmed the panel with zero bytes on stderr** — a clean,
   healthy-looking P&L with the panel simply absent.

And the daily brief went silent on a crossing: nudging a threshold by one — still crossed, only the
receipt broken — took it from naming the crossing to saying nothing, exit 0. Moving a goalpost was a
one-line way to stop the alarm on the surface a human reads daily.

**A lint asserted in a file's own header that it governed that file, and had never read it.**
`spine-reader-lint` exempted `lib/*`, and a shell case glob's `*` crosses `/`, so 33 of 63 tracked
files went unscanned. Proven by planting a real `events/*.jsonl` bypass in `lib/ledger/` and
watching the lint exit 0, then restoring it and watching it go green — and again after narrowing,
where the same plant fired.

**The parser itself survived everything**: 27 hostile byte-level documents, UTF-16, homoglyph
venture names, prototype-chain keys, 100k ventures, and digest-collision attempts.

## Phase 02 — four green closes that had no business being green

1. **The export's period was never read.** The repo's own fixture — every row settled in
   **September** — closed **July** green, and a twelve-month export closed a single month green. The
   receipt then pinned a September document as July's evidence, permanently.
2. **The P&L's own needs-you flags were computed and thrown away**, and three findings fell out of
   that one omission: an `OVER_REFUND` netted 200000 against a 100000 charge and closed GREEN while
   `arc pnl` printed *"Never silently netted"* for the same month; a `DUPLICATE_PAYMENT` straddling
   two months closed GREEN over a month whose own P&L rendered *"no real revenue yet"*; and every
   unlinked-refund flag was invisible on the green path.
3. **The emptiness guard counted ROWS, not MONEY.** A row with `gross == tax` parses cleanly and can
   never be on the spine, so a file of nothing but such rows summed to 0, made the count non-zero,
   and closed a net-zero rail GREEN carrying the FILE receipt — the one the gate prefers precisely
   because it is meant to be the stronger evidence.
4. **`--simulated` beside `--close` was silently dropped.** An operator who believed they were
   running a simulation got a real green verdict, no watermark, and a real sealable payload.

Plus: `input_sha` for a typed total was `sha256` of the number, so three different spines, months
and rails sealed the identical digest; every export-parser refusal surfaced as `ERROR INTERNAL`; and
the green gate's only printed instruction **did not work** — it told the operator to pipe stdout into
`arc-event --payload-file -`, and `arc-event` has no stdin path at all.

## What the passes could NOT break — the coverage half

A list of only successes says nothing about coverage, so this is recorded with equal weight:

- the five refund link rules (a cross-provider refund is refused at ingest, so a refund can never net
  on a rail its charge was not on)
- `NO-INPUT` versus a real zero — `provider_minor` is null on one and 0 on the other, and the two
  renders were `cmp`-different
- `INPUT-CONFLICT`, `INPUT-DUPLICATE-SOURCE`, and closing the same month twice (`DUP_IDEM`)
- **144 differential payloads** through `closePayload` into `assertMonthClosed`: zero disagreement
- any two cost classes reaching one number: none found, in the model or the render or the brief
- `assertCostIncurred` against string, float, negative, over-ceiling, boolean, array, lowercase
  currency and currency-less amounts
- prototype-chain keys in cost classification and in venture/criterion lookup
- `scan` versus `sqlite` byte-identity, and `--engine sqlite` refusing loudly without a `state.db`
- every argv smuggling shape tried, including a Windows drive letter inside `PROVIDER:CURRENCY=PATH`
- source-file hygiene across all 74 files the three phases touched: no NUL, no stray control byte,
  every `@test` name ASCII, and the CRLF+BOM fixture verified byte-exact **in the git blob**

## The pattern worth carrying out of all three

**Every pass found the boundary, not the core.** The parsers, the money math and the validators held
under direct attack in all three phases. What broke, every time, was the seam: an environment
variable, a path resolution, a flag that was validated and then discarded, a lint's glob, a value
computed and never read. The lane's own rule — *two fresh agents on different surfaces* — is what
made that visible, and the near-zero overlap between the pairs is the evidence that one agent could
not have done it.

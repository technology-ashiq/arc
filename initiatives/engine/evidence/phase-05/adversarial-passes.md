# Phase 05 evidence — the adversarial passes

The Phase 05 DoD requires a pass by **two fresh agents on different surfaces** — one on the parser's
decision logic, one on the shell/OS/process boundary — neither having seen the implementation, with
every hole pinned as a red fixture.

Three passes bear on this phase's code. They are recorded here from `PROGRESS.md` § Now and the
commits they produced; what could **not** be reconstructed is named in `absent-evidence.md` rather
than smoothed over.

## Pass 1 — 2026-08-13, PR #184, the emit path

Two fresh agents, different surfaces. The result that matters is not the count:

- The shell/OS attacker **reproduced the motivating failure rather than trusting the report** —
  inline `--payload` with a Windows path gives `REJECT BAD_JSON -- invalid escape \U`;
  `--payload-file` seals it. That half shipped.
- The **gate half was backed out**, because `verifyLanded` was found to carry three independent
  defects: a UTC/IST day mismatch making it wrong for **22.9% of the clock**, a spine-root rule
  disagreeing with the emitter's own `spineRoot()`, and a quarantine scan that interpolated a path
  into a `bash -c` string, **where a path component was demonstrably executed**.
- **CI had been green only because it ran at 14:22 UTC — outside the bad window.** The suite passed
  by clock luck. Nothing in it could have said so, and that is precisely the class of defect an
  adversarial pass exists to catch and a green suite cannot.
- Also found and fixed: `--strict` had put the emitter's 15s lock wait inside a 10s SIGKILL,
  orphaning a node grandchild that sealed the receipt *after* arc-run had reported it lost;
  `mkdtempSync` sat outside its `try`, so a bad `TMPDIR` inverted a fail-closed policy denial into a
  stack trace; and **three of the nine test guards could not fail** — one attacker wrote a mutant
  reverting half the change, and it passed 9/9.

Merged as `9bd1443`, 19/19 green.

## Pass 2 — 2026-08-16, two fresh surfaces, 30 findings, ~zero overlap

The overlap number is the finding that keeps repeating in this lane: two agents attacking one gate
share the root cause and almost none of the individual findings. A single agent's blind spot is
structural, not a matter of effort.

The five that mattered most, three of them in code written that same day:

1. **A tripwire that was dead on arrival and was proven dead.** `setup()` exported `ARC_HERMES_DATA`
   to an empty scratch dir; that export was still live when the test ran the probe, whose third gate
   asks the volume for a `config.yaml` that was never there. The probe cleared its Docker and image
   gates and **skipped on every machine**, and the assertion accepted the skip. Permanently green,
   permanently measuring nothing.
2. **A proven `bash -c` injection through the checkout path** — one apostrophe gives `unexpected
   EOF`; **two rebalance the quoting and the inner shell executes the span between them.** The
   attacker ran a command to demonstrate it. This lane's already-fixed defect class, recurring in the
   file that cites it.
3. **`Number("") === 0`.** A report carrying `"prompt_tokens": ""` became
   `{"tokens_in":0,"source":"measured"}` on an append-only receipt, and `arc-bench` sums those to
   derive a per-token rate. A fabricated measurement is the one thing MP-F exists to refuse.
4. **A twin-fix miss with both twins in one file.** The seat fix went into `emitRun` and not into the
   escalation proposal ~300 lines below, which builds its own `model` / `model_source`. One run, two
   receipts, disagreeing about which model ran — and the proposal is the one receipt a human reads
   before editing `engine/router.yaml`. Now computed once, in `seatFor()`.
5. **The routed pin was the one model input never checked against the seat grammar**, and it *wins*
   precedence over the validated one. A pin containing a space makes the emitter throw `BAD_MODEL`
   under `--strict`: the whole receipt lost, on a successful run, at exit 0.

Also fixed in that round: an orphaned container on the operator's live volume · a probe whose argv
order differed from the driver's, pinning a shape production never sends · a stale usage report
re-reported as `measured` forever **with a comment above it claiming that was prevented** (the
seventh false comment this cycle) · a non-string `model` dropped in silence · one wide `try`
reporting `EISDIR`/`EACCES` as "did not parse" · `$COST` never cleared between runs inside one test
· `mktemp -d` unchecked, so a failure gave `mkdir -p /data` and `rm -rf ""` · `console.log` then
`process.exit` on the macOS async-stdout path · no suite self-count.

## Pass 3 — the fix round shipped the exact defect the tracker says fix rounds ship

CI went red on 5 of 19 jobs, all five on one assertion: *"REQ-05: a budget that leaves nothing to
spend stops BEFORE any driver runs"*. `RUNTIME_ID_RE` was declared as a `const` beside its only use
in `seatFor()`, ~470 lines below `fail()` — which runs during **top-level execution** on the earliest
exit path in the file. That path calls `fail` → `emitRun` → `seatFor` → the const, hits the
**temporal dead zone**, the emit throws into its own catch, and the run writes **no receipt at all**.

**Exit code 1 either way.** A caller checking the exit code could never tell the difference; only
`engine-driver-contract.bats:104`, which greps the landed file, noticed. Proven in both directions.

This is the same defect the cycle had already recorded and fixed once, re-introduced by a fix an
adversarial pass produced. The standing rule that came out of it: **fixes produced by an adversarial
pass are themselves unattacked code. Attack the fix round too.**

## What these passes changed about the method

- The pass is bound to the **shipping PR**, never to the phase close — a rule only the close can
  enforce gets skipped for a whole phase.
- The attacker's prompt carries this cycle's **running list of already-fixed defects**, with the
  instruction to check each one in every OTHER file. A fix is not applied until it has been attacked
  somewhere it was never made.
- The pass attacks **the tests as well as the code**. A green suite the author wrote is evidence
  about the author.

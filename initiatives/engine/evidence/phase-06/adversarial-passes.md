# Phase 06 — the adversarial passes, four of them, twelve agents, 159 findings

The cycle non-negotiable: every gate, parser and shim this cycle ships gets a construct-a-breaking-
input pass **before the PR that ships it merges**, never at the phase close — because a rule only the
close can enforce gets skipped for a whole phase. **TWO fresh agents on different surfaces** (the
decision logic, and the shell/OS boundary), neither having seen the implementation, attacking the
**fixtures and tests as well as the code**. A green suite the author wrote is evidence about the
author.

| Date | Surface | Findings | Overlap |
|---|---|---|---|
| 2026-08-16 | the day's gates and lints | **30** (two agents) | **~zero** |
| 2026-08-17 | egress + workspace code | **50** (27 / 23) | **five criticals, both agents, independently** |
| 2026-08-17 | router + tenure decision logic · receipt/identity + shell boundary | **44** (20 / 24, 17 proved by execution) | ~zero |
| 2026-08-23 | REQ-03 transcript storage: decision logic · shell/OS boundary | **35** (15 / 20, **27 proved by execution**) | **substantial — see below** |

**The structural result this lane keeps measuring:** two attackers on different surfaces mostly do
*not* find the same things. Three of these four passes returned near-zero overlap, which is the
finding — a single agent's blind spot is structural rather than a matter of effort, and the
`gate-author-cannot-be-its-attacker` measurement (the author's own 26 breaking inputs found 0 holes;
an unanchored agent found 9) is why the clause exists at all.

## The 2026-08-23 pass, and why its overlap matters

This one broke the near-zero pattern twice, and both times the agreement was the signal.

**Both surfaces independently executed `--transcript-dir --dry-run`.** The value guard rejected `""`
and `undefined` and treated every other string as a deliberate path — so the flag **consumed
`--dry-run` as its value**. `dryRun` stayed false. A caller asking for a preview got a real dispatch
against a real driver with real money, a `run.completed` receipt on the append-only spine, and a
directory literally named `--dry-run` in the working tree. The same shape defeats the given-twice
rule by adjacency, and `--transcript-dir --trial-model gpt-5` runs **production routing** while the
command line says a trial — which is the exact ADR-0220 accident, re-entered through a new flag.
Two agents, two machines-worth of reasoning, the same first finding.

**Both surfaces independently proved the storage tests were vacuous.** The stored transcript
contained three lines, all of them banners `hermes.mjs` prints in the *parent* process before the
container starts. The fixture writes its answer to **stdout** and nothing to stderr; the code stored
`r.stderr` alone. The assertion `grep -q "ADR-0222"` — whose comment read *"it must contain the
DRIVER's lines, not merely exist"* — was matching arc's own constant. **Delete the container-stderr
forwarding entirely and both storage tests stay green.**

And the consequence that matters beyond the test: the near-miss JSON that Phase 08 lost — a document
the schema rejected for one missing property — **arrives on stdout**. The fix as first written would
have discarded it a second time. The whole justification for the change was defeated by the change.

## What the pass changed

Twenty-three of the thirty-five are closed in this branch. The shape of the fixes:

- **`--transcript-dir`, `--trial-model`, `--work-root`, `--process`, `--driver`, `--budget`,
  `--input`, `--root` all became strict** — absent, empty, given twice, or handed another flag are
  each an operator error at exit 2. It was three of eight, and `--root` selects the `processes/` and
  `router.yaml` the entire run obeys; a silent last-wins there is strictly worse than one on a
  transcript path.
- **Both streams are stored, labelled**, and a fixture case now writes markers on each that appear
  nowhere in arc — so a test that finds them has found runtime bytes.
- **The absence warning fires per attempt, names the driver, the attempt and the byte count.** The
  once-per-run guard was written to avoid repetition and hid the second loss instead: a schema retry
  discards two transcripts and reported one warning, and the suppressed one is the retry — the
  attempt whose bytes distinguish a prompt bug from a schema bug.
- **The destination is resolved and validated once, before any driver starts** — reserved Windows
  device names, components ending in a dot or space, unwritable or non-directory paths all refuse at
  exit 2 rather than after the money is spent. `--work-root` twelve lines up had done this since
  ADR-0220; the new member of the same strict group inherited none of it.
- **`ARC_RUN_TRANSCRIPT_DIR=""` is an operator error too.** The flag arm said in as many words that
  an empty value is not "unset"; the env door six lines away said the opposite. The fourth twin-fix
  recurrence this repository has recorded.
- **The override notice states a fact about configuration, not about directories.** A
  `resolve()`-based comparison called two spellings of the same directory different on NTFS, APFS,
  8.3 short names and junctions.
- **Paths are JSON-quoted in every log line.** A destination containing a newline forged a second
  physical line reading `arc-run: stored the scrubbed <driver> transcript at <path>` for a file that
  was never written — a line-anchored match for anything grepping that output.
- **Nothing is stored for an attempt that never spawned a driver.** `invoke()` returns arc-run's own
  message as `stderr` on the not-installed and policy-denied paths; both wrote transcript files
  whose entire body was arc-run refusing, inflating the file count a phase close reads.
- **Every vacuous test assertion was rewritten.** `find` over directories that were never created
  (exit status masked by the pipeline, complaint sent to `/dev/null`, count 0 whatever happened);
  `grep -q` over a whole glob rather than the named file; `$output` merging the streams so an
  assertion could be satisfied by the wrong one; a "nothing is written anywhere" test scanning only
  the tmpdir while arc-run creates relative paths in its CWD; and an ambient
  `ARC_RUN_TRANSCRIPT_DIR` surviving `setup()`, which on any box where it is exported would deposit
  fixture transcripts into a live evidence bundle.

Three findings are recorded rather than fixed, with reasons, in `absent-evidence.md`.

## The rule that produced the best findings

The attacker prompts carried **this cycle's running list of already-fixed defects**, with the
instruction to check each one in every OTHER file. Six of the 2026-08-23 findings came back tagged to
a numbered entry on that list — missing-vs-empty, validate-one-read-compare-another, an absence
assertion a crash satisfies, a pipeline whose exit code comes from its last stage, exit 0 from a
writer taken as evidence, and a temporal dead zone. The empty-environment-variable finding is the
same defect as the empty-flag-value one, one variable apart, and it was found by both agents.

**A fix is not applied until it has been attacked somewhere it was never made.**

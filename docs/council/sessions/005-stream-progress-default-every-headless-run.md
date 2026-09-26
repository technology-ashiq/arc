# arc-council — Should arc make streamed progress lines the default for every headless run, not only for sessions started from the face? (2026-09-25)

Roster: advocate, skeptic, neutral, engineer, designer. Mode: deep (headless run).

**Decision statement:** *arc-run's stream mode (live, redacted driver progress lines on stderr, today switched on only by `ARC_RUN_STREAM=1`, which only the face session door sets) should become the default for every headless arc-run invocation (arc-attack, arc-bench, arc-jobs, arc-dash /ask, direct CLI, CI tests), with an opt-out in place of today's opt-in.*

**Reading taken (headless, no one to ask):** "streamed progress lines" = arc-run stream mode plus the claude-code driver's `ARC_DRIVER_PROGRESS` step lines; "default" = on unless a caller turns it off. A TTY-gated auto mode is a different proposal. Members could weigh it, but this verdict does not decide it.

**Headless process notes:**
- In this run the Chair could write only this one session file. Member and researcher outputs therefore went to the verifier verbatim inside its prompt, not as separate files.
- The juror script is not on this run's tool list, so no cross-model juror ran. This is stated below and was not skipped silently.
- Live web research was mostly unavailable (F21), so the research mode is `model-knowledge`. The repo facts F1-F16 come from reading the local tree directly.

**Brief-framing disclosure (the verifier caught this, recorded here rather than buried):**
- F11 listed arc-bench's three `spawnSync` sites together. It did not say that both 1 MiB probes are `--dry-run` runs that exit before any driver starts (`arc-run.mjs:1663`). That misled the Skeptic (S3) and the Designer (DS3), and both points were dropped.
- The brief also left out two facts:
  - Progress step lines come only from the claude-code driver.
  - arc-dash /ask shows only the first 500 characters of stderr on failure (`arc-dash.mjs:745`). With streaming on, progress lines could push the real error out of that window.

**Verifier corrections:**
- S1's claim that the door's redaction is stronger than `liveLine()` is refuted. `liveLine()` runs every `DENY_RULES` rule plus a JWT check, and on a match it holds back the whole line (`redact.mjs:148-233`).
- N4 said the off-by-default control test would survive the flip. It would not: under an opt-out default, `unset ARC_RUN_STREAM` means streaming is on, so `tests/engine-driver-contract.bats:360-364` fails.

## VERIFIER RATINGS
- A1: Plausible — attack round and fixes are real (the code is full of `attack 3e77530 Bn` notes), but the path landed days ago (`b4c443b8`) and was hardened only for the door's usage, so "not new" goes too far
- A2: Plausible — the anchored parsing is real, but the probe code cited as `arc-attack.mjs:770-816` is actually in `arc-bench.mjs`, and it skips display paths the new lines can crowd out (arc-attack's last 8 lines, arc-dash's 500-character slice)
- A3: Supported — `vouchReceipt` (`arc-run.mjs:1107-1153`) does not depend on stream mode; bats 343-365 checks the receipt line, the forged-line case and a control run
- A4: Weak — the twenty-minute complaint was about a door session; arc-attack, arc-bench, arc-jobs and arc-dash all wait for the run to finish, so none would see progress sooner
- A5: Supported — confirmed in code: every live line goes through `liveLine`, live output is capped at 8 MiB with a visible notice, and the full copy is kept (`arc-run.mjs:1270-1297`)
- A6: Plausible — the old path is kept as-is (`:1260`) so an opt-out restores it, but the bats control block that protects it would break under the flip (EN4)
- S1: Weak — `liveLine` already covers all `DENY_RULES` plus JWT and holds back the whole line; only `door-token` is missing, and it is irrelevant outside the browser; "persisted" is overstated (`arc-jobs.mjs:895-897`)
- S2: Plausible — the stream path is new and was hardened in one attack round for one caller, and F14 found no parity test; the rest is inference
- S3: Weak — both 1 MiB probes are `--dry-run` and exit before a driver starts (`arc-run.mjs:1663`); matching is per stream and anchored, and the joined text is only printed in the error
- S4: Plausible — the absence of an ADR and of any incident is real, but "Set by the door, never inherited" is about which env vars the door passes down, not a recorded scope decision
- S5: Supported — F17 comes from fetched official docs (git, cargo), and arc-run has no TTY check (the only `isTTY` use is `arc-leads.mjs`)
- N1: Supported — confirmed: arc-attack `:198`, arc-jobs `:833`, arc-dash `:743` and arc-bench `:915` all wait for exit, and stream mode still returns stdout and stderr as single buffers (`arc-run.mjs:1297`)
- N2: Supported — arc-jobs starts arc-run with `spawnSync` (`arc-jobs.mjs:833`) and prints the child's stderr only after exit (`:895`), and `.github/` never mentions arc-run; the benefit is limited to direct CLI and door use. Whether CI calls arc-run through a wrapper was not traced, which only narrows the point
- N3: Plausible — git and cargo are verified, but docker and npm (F19) are unverified model knowledge
- N4: Weak — "that specific test survives a default flip either way" is false; with `unset`, a default-on build streams and the control assertion at bats:364 fails
- N5: Supported — the redaction and cap are confirmed in code, and "log volume not measured" is an accurate statement of an unknown
- N6: Plausible — a fair reading of absent evidence either way, with no weight
- EN1: Supported — `runStreaming` appears only in `drivers/claude-code.mjs`, no test refers to it, and the stream-mode cases in `engine-driver-contract.bats` check stderr lines and the receipt, not the rebuilt final output; the missing parity test is a checked absence
- EN2: Plausible — the recent merge and door-only hardening are confirmed; its arc-bench 1 MiB example repeats the S3 mistake (dry run)
- EN3: Supported — `runTool` with no callback (`arc-dash.mjs:743`) and arc-jobs printing stderr only on failure (`arc-jobs.mjs:894-895`) are confirmed
- EN4: Supported — the bats control at 360-364 would fail under opt-out, and the git/cargo precedent is verified
- EN5: Plausible — `router.yaml` routes most task classes to claude-code and arc-attack's boundary surface uses `--driver auto`, but its logic surface runs through `generic-api` and arc-attack runs in the building session, not CI; the reach is real for production claude-code runs but nobody has counted them
- EN6: Plausible — the same absence evidence as S4 and N6
- DS1: Supported — the same verified facts as N1 and EN3
- DS2: Plausible — the door already covers the reported pain, but the "no need elsewhere" part rests on absence (F16)
- DS3: Weak — the same mistake as S3: the probe cannot receive progress lines
- DS4: Supported — the `isTTY` search is confirmed (only `arc-leads.mjs`), and the git/cargo precedent is verified; the docker part is unverified
- DS5: Supported — arc-jobs reads stderr only after the run finishes, `bats run` captures output only after exit, and the door is the only caller that sets `ARC_RUN_STREAM`; "~15 test files" overstates the risk because many use the mock driver, but the zero-visibility-benefit half holds

## FIRST-PASS RATINGS
- A1: Plausible — attack round and fixes are real, but the path landed days ago and was hardened only for the door's usage, so "not new" goes too far
- A2: Plausible — the anchored parsing is real, but the cited probe code is in `arc-bench.mjs`, and display paths the new lines can crowd out were skipped
- A3: Supported — `vouchReceipt` does not depend on stream mode; bats 343-365 checks the receipt line, the forged-line case and a control run
- A4: Weak — the twenty-minute complaint was about a door session; the scripted callers all wait for the run to finish
- A5: Supported — every live line goes through `liveLine`, the 8 MiB cap and notice are real, and the full copy is kept
- A6: Plausible — the old path is kept as-is, but the bats control block that protects it would break under the flip
- S1: Weak — `liveLine` already covers all `DENY_RULES` plus JWT and holds back the whole line
- S2: Plausible — new path, one attack round for one caller, no parity test; the rest is inference
- S3: Weak — both 1 MiB probes are `--dry-run` and exit before a driver starts
- S4: Plausible — the missing ADR and incident are real, but the door comment is about env passing, not a scope decision
- S5: Supported — F17 comes from fetched official docs, and arc-run has no TTY check
- N1: Supported — all four scripted callers wait for exit, and stream mode still returns single buffers
- N2: Plausible — sound reasoning, but whether anything tails the output live is left open
- N3: Plausible — git and cargo verified; docker and npm are unverified model knowledge
- N4: Weak — "the control test survives either way" is false
- N5: Supported — redaction and cap confirmed; log volume genuinely unmeasured
- N6: Plausible — a fair reading of absent evidence, with no weight
- EN1: Plausible — the stream-json switch is confirmed; the missing parity test rests on F14's grep, which the verifier did not re-check
- EN2: Plausible — the recent merge and door-only hardening are confirmed; the arc-bench example repeats the S3 mistake
- EN3: Supported — `runTool` with no callback and arc-jobs printing stderr only on failure are confirmed
- EN4: Supported — the bats control would fail under opt-out; the git/cargo precedent is verified
- EN5: Plausible — the logic is sound, but "everything gated on green CI" goes too far; only claude-code runs gain step lines
- EN6: Plausible — the same absence evidence as S4 and N6
- DS1: Supported — the same verified facts as N1 and EN3
- DS2: Plausible — the door covers the reported pain; "no need elsewhere" rests on absence
- DS3: Weak — the same mistake as S3
- DS4: Supported — the `isTTY` search is confirmed and the git/cargo precedent is verified
- DS5: Plausible — CI logs being read afterwards is a reasonable assumption, not shown

**Rebuttal round (one round, on the verifier's DISPUTED set).** The verifier rated nothing Contested but listed N2, DS5, EN1 and EN5 under DISPUTED. Each author defended its point once, blind to the others. The verifier then re-graded only those four IDs. The lint's `## REBUTTAL LOG` accepts only points first rated Weak or Contested (ADR-0014), and all four were first rated Plausible, so the results are recorded here instead:
- N2 went from Plausible to Supported. arc-jobs uses `spawnSync` and prints output only after exit, and `.github/` never calls arc-run, which closes the arc-jobs half of the open question.
- DS5 went from Plausible to Supported. bats `run` and arc-jobs both capture arc-run's output only after exit, and only the door sets `ARC_RUN_STREAM`.
- EN1 went from Plausible to Supported. No test refers to `runStreaming` or compares the streamed final output with the plain path, so the missing test is now a checked absence.
- EN5 stayed Plausible. The router facts check out, but arc-attack's logic surface uses generic-api and arc-attack does not run in CI, so the blast radius is real but uncounted.

## UNRESOLVED
- [EN5]: how many production runs would switch to the streaming claude-code path. `router.yaml` makes claude-code the default for most task classes, but no one has counted real runs per caller. The verifier also did not trace whether CI calls arc-run through a wrapper. Neither gap changes the decision, but both would size its risk.

## VERDICT
PREDICTION: NO / Medium (recorded at intake, before research and members) → RESULT: NO / Medium. The prediction held, but the reasons changed. The security and arc-bench objections I expected to count were refuted by the verifier (S1, S3, DS3 dropped). The decision rests instead on the checked finding that no named headless caller can see a streamed line before its run ends, while every one of them would take the new, untested driver path.
DECISION: NO
CONFIDENCE: Medium
Research mode: model-knowledge
Juror: unavailable (headless council-convene run: council-juror.mjs is not on this run's tool allow-list)
Roster: advocate, skeptic, neutral, engineer, designer

KEY REASONS:
- [N1] **The headless callers cannot see live progress.** arc-attack, arc-jobs, arc-dash /ask and arc-bench all wait until arc-run exits before they read its output (`spawnSync`, or `runTool` with no line callback). Even in stream mode, arc-run returns stdout and stderr as single buffers. Flipping the default would switch their execution path and show nobody anything sooner.
- [DS5] **Nothing in CI or the scheduler watches the output live either.** bats `run` and arc-jobs capture output only after the run exits, and `.github/` never calls arc-run. The only caller with a human watching live is the face session door, and it already turns streaming on ([N2], [DS1], [EN3]).
- [EN1] **The cost is an untested code path.** Stream mode also switches the claude-code driver to `--output-format stream-json` and `runStreaming()`. No test compares that path's rebuilt final output with the plain json path, and callers depend on that output (arc-attack runs `JSON.parse` on it).
- [EN4] **The flip is not a one-line change.** The bats control block that pins off-by-default (`engine-driver-contract.bats:360-364`) would fail under an opt-out default. The change would reverse an existing gate, not just adjust a runtime setting.
- [S5] **The verified precedent is terminal-gated auto, not always-on.** git and cargo show progress only when a terminal is attached (F17), and arc-run has no TTY check today ([DS4]). If direct-CLI users want live progress, that design is the one to evaluate. It is a separate proposal, not this one.

DISSENT (strongest surviving opposing point):
- [A5] The live path is already hardened and bounded. Every line goes through `liveLine()`, which holds back secrets as whole lines. Live output is capped at 8 MiB with a visible notice, and the full copy is kept for the transcript. Receipt vouching does not depend on the mode ([A3]). Default-on would therefore carry little leak or correctness risk, and an opt-out would restore today's path ([A6]). This is a real limit on the risk case. It does not create the missing benefit: no named caller can read a streamed line before the run ends.

CHEAPEST TEST TO DE-RISK:
- Add one bats test that runs the claude-code driver against `fake-claude-stream.mjs` twice, once with `ARC_DRIVER_PROGRESS=1` and once without, and diffs the final stdout byte for byte. It is cheap, it closes [EN1]'s checked gap, and it is needed before any caller beyond the door streams, whether by this flip or a later TTY-gated mode. Separately, count one week of arc-run invocations by caller and driver from the spine to size [EN5].

Review-by: 2026-12-24
Resolution: HIT if, at Review-by, arc-run is still off by default for non-door headless callers, and no written incident or request shows arc-attack, arc-bench, arc-jobs, arc-dash /ask or CI needing live progress lines that opt-in could not provide. MISS if the default was flipped to on for every headless run and held with no stream-path regression, or if such a documented need appeared. UNRESOLVED if the question was replaced by a TTY-gated auto mode that was adopted, because that is a different proposal from the one this verdict decided.

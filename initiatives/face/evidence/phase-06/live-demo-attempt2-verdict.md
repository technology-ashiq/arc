# Should arc make streamed progress lines the default for every headless run, not only for sessions started from the face?

## INTAKE
Decision statement: Should `arc-run` turn its stream mode (live, redacted `claude-code: step ...` progress lines relayed to stderr, today enabled only when the face session door sets `ARC_RUN_STREAM=1`) ON by default for every headless `arc-run` invocation (arc-attack, arc-bench, arc-jobs, arc-dash via work-door, council-convene, bats), instead of only for face-started sessions?

Reading taken (headless, no one to ask): "headless run" = any `arc-run --driver` invocation with no human at a terminal; "default" = on unless a caller opts out, with no change to stdout (the one JSON line) or to the receipt line. Mode: deep (fixed for headless runs).
Roster: advocate, skeptic, neutral, engineer (EN), designer (DS).
PREDICTION: CONDITIONAL, Medium -- default-on is cheap because it only touches stderr, but the sync path's byte-for-byte guarantee and attack history argue for a gated rollout.
Process notes: the Chair may write only this one file, so member outputs and researcher FACT PACKs are handed to the verifier verbatim inside its prompt rather than as separate files. Web tools were denied to researchers, so the research mode is model-knowledge; codebase facts were read directly from the repo and carry their own confidence.
Rebuttal note: the verifier rated no point Contested; its first-pass DISPUTED list (A6, S2, EN3, DS3, N6, all Plausible) went through one rebuttal round and one re-grade. Results: A6 Plausible (ordering proven via `spawn-bounded.mjs:139-167`, full exit coverage not), S2 Plausible (stdout slice conceded), EN3 Plausible to Supported (wider tests/ search found no golden fixture), DS3 Plausible (narrowed, F9 misread conceded), N6 Plausible. No REBUTTAL LOG section is written because its grammar accepts only Weak/Contested pre-ratings (ADR-0014); the first-pass grades are kept below.

## EVIDENCE BRIEF
Research mode: model-knowledge

- F1 [High] Stream mode is switched on only by env var `ARC_RUN_STREAM=1`, read at `.claude/scripts/engine/arc-run.mjs:1254`; there is no CLI flag.
- F2 [High] The only writer of `ARC_RUN_STREAM=1` in the repo is the face session door, `sessionEnv()` at `.claude/scripts/hq/lib/face/session-door.mjs:106` ("Set by the door, never inherited").
- F3 [High] Outside stream mode `runDriverProcess` calls `spawnSync` "byte for byte: every existing caller and test sees the old path" (`arc-run.mjs:1250,1260`).
- F4 [High] In stream mode arc-run runs the driver via `spawnBounded` and relays only the driver's stderr, line by line, to its own stderr; stdout is still captured whole (`arc-run.mjs:1281-1293`).
- F5 [High] arc-run passes `ARC_DRIVER_PROGRESS=1` to the driver only in stream mode (`arc-run.mjs:1427`); the claude-code driver then runs the CLI with `--output-format stream-json --verbose` and writes one `claude-code: step <Tool> <target>` line per tool-use block to stderr (`drivers/claude-code.mjs:56,93,160-161`; `adapters/claude-code.mjs:196-213`).
- F6 [High] Every live line passes `liveLine()` (`.claude/scripts/hq/lib/redact.mjs:220-233`): control characters blanked, a line matching a secret rule withheld whole, and a line starting `arc-run:` relabelled `driver:` so it cannot forge the receipt line. The face door redacts `run.log` a second time on read (`session-door.mjs:415-422`).
- F7 [High] The live relay is capped at 8 MiB (`LIVE_CAP`, `arc-run.mjs:1256,1271-1273`); the CLI stream is capped at 64 MiB total and 16 MiB per line (`drivers/claude-code.mjs:38-39`).
- F8 [High] The stated reason stream mode exists: spawnSync hands over stderr only after the driver exits, "so a council that ran for twenty minutes showed nothing until its last line" (`arc-run.mjs:1243-1244`).
- F9 [High] `runDriverProcess` refuses any spawnSync option the streaming path does not honour, "so the two paths cannot drift apart unseen (attack 3e77530 B11)" (`arc-run.mjs:1261-1264`).
- F10 [High] On success arc-run prints exactly one JSON line to stdout (`arc-run.mjs:1934`); receipt lines `arc-run: receipt <kind> <id>` and warnings go to stderr (`arc-run.mjs:1094,1148`).
- F11 [High] arc-attack (`arc-attack.mjs:192-199,343`) and arc-bench (`arc-bench.mjs:901-908,981-983`) spawn arc-run with `spawnSync` and `JSON.parse` its stdout; neither sets `ARC_RUN_STREAM`.
- F12 [Med] arc-bench's `--dry-run` probe regex-matches combined stdout+stderr for an `arc-run: would REFUSE` line, but dry-run exits before any driver runs (`arc-bench.mjs:770-775,834-866`).
- F13 [High] arc-jobs spawns arc-run via `spawnSync`, decides the outcome from exit status only, and passes stdout/stderr through unparsed (`.claude/scripts/hq/arc-jobs.mjs:832-836,847-895`).
- F14 [High] arc-dash's `face-ask` route runs arc-run through `work-door.mjs`, not the session door; work-door has no `ARC_RUN_STREAM` reference and serves raw stdout (`arc-dash.mjs:743-749`).
- F15 [High] `tests/engine-driver-contract.bats:325-394` is the only suite that sets `ARC_RUN_STREAM=1`; its assertions are line-anchored greps, and a control run asserts that without the variable "no step line at all" is printed (`:360-364`).
- F16 [Med] No test or caller was found comparing arc-run stdout/stderr byte-for-byte against a golden file (grep of `tests/*.bats`, `tests/*.mjs` and the listed callers; not every hit opened).
- F17 [High] Building the streaming path took attack rounds that found and fixed: an uncaught throw in a stream listener that ended a paid run, a non-zero exit read as success, `close` vs `exit` settlement with a grandchild holding pipes, split multi-byte characters, a lost 64 MiB cap, and a progress line that could print a credential (`initiatives/face/fixed-defects.md:819-826`).
- F18 [Med] The slice 03c boundary attack round 1 produced 15 findings, highs and mediums fixed in `f2f50ba5`; round 2 did not complete (the attacker input quoted a password-bearing URL and was refused, ledgered) (`initiatives/face/phases/phase-06-tasks.md:75`).
- F19 [High] Under the session door, arc-run's stdout and stderr both go to one `run.log` (`session-door.mjs:340,344`); the face reads a tail of it (256 KiB, 400 lines) and credits a receipt only when arc-run's own line names it and the spine holds it, fresh and of the right kind (`session-door.mjs:409-477`).
- F20 [Med] An earlier engine phase recorded that transcript storage was once opt-in and silently discarded when unset, "costing three real dispatches", and required a loud warning when a dispatch would keep no trail (`initiatives/engine/phases/phase-06-spec.md:19`).
- F21 [Low] No written arc rule was found requiring headless output to stay quiet or machine-readable on stderr; no measurement of streamed-log size or token cost versus non-streamed runs was found.
- F22 [Low] (model prior, unverified this session) Common CLI practice (clig.dev and tools such as npm, git, docker) sends progress to stderr and data to stdout, shows progress by default on a TTY, and switches to plain line output or suppression when piped or when `CI` is set, with `--quiet` / `--progress` overrides.
- F23 [Low] (model prior, unverified this session) Claude Code's `-p` mode offers `--output-format text` (final output only) and `stream-json` (newline-delimited events as the agent works).
- F24 [Med] As of the phase-06 task tracker, the real paid council-convene demo that would exercise stream mode end to end is "still owed, pending the owner's spend approval" (`initiatives/face/phases/phase-06-tasks.md`).
- F25 [High] Open debt: the bats stream liveness arm, on failure, kills only the arc-run node pid, leaving the driver wrapper and fixture CLI as orphans for a few seconds on a CI runner (rated LOW) (`initiatives/face/debt-ledger.md:89`).
- F26 [High] On a non-zero exit, arc-bench takes the LAST stderr line (after filtering out the receipt line) as the failure reason (`arc-bench.mjs:974`). arc-run's own source records that one extra WARN line on stderr once displaced that reason and turned 20 bench-core assertions red on main, same commit, hours apart (`arc-run.mjs:1179-1182`; that WARN came from an unrelated timezone bug, not stream mode).
- F27 [High] arc-bench extracts arc-run's `run.completed` receipt from stderr with a full-line-anchored regex taking the last match (`arc-bench.mjs:939`); `tests/engine-driver-contract.bats:29-40` pins that arc-run stdout alone is the JSON document.

## VERIFIER RATINGS
- A1: Weak — "only touches stderr relay … unaffected by construction" is false. Stream mode switches the claude-code driver to a different CLI output format and parse path (`claude-code.mjs:160-171`) and every driver to `spawnBounded`.
- A2: Weak — the guard at `arc-run.mjs:1261-1264` only checks that the option names match. It says nothing about identical output, and it does not cover the driver's separate `runStreaming` path. "Built to match byte-for-byte" has no test behind it (F16).
- A3: Weak — the 20-minute blind spot is real (`arc-run.mjs:1243-1244`). But arc-jobs uses `spawnSync` and passes stderr on only when a run fails (`arc-jobs.mjs:833,894-895`), so default-on gives it no live visibility. "Gets worse headless" does not follow.
- A4: Supported — `liveLine` runs on every live line and the 8 MiB cap is in code (`arc-run.mjs:1256,1270-1273,1289`). The bats test at `:358-359` checks that a forged receipt line is relabelled.
- A5: Plausible — round 1 happened and its fixes landed (`phase-06-tasks.md:75`, `f2f50ba5`), but round 2 never finished, so "hardened" overstates it.
- A6: Plausible — the ordering trace holds: in `spawn-bounded.mjs:139-167` the promise settles only after the pipes close or are destroyed, so no driver line lands after arc-run's reason line. "Unrelated to stream mode" overreaches, and nobody showed that every non-zero exit prints its own reason line.
- S1: Weak — the way it says the lines get "injected" is not reached. Progress lines come before arc-run's final reason. The receipt regex is anchored and takes the last match, and `liveLine` relabels any forged `arc-run:` line.
- S2: Plausible — the corrected claim checks out: `arc-bench.mjs:974` reads the last stderr line and stream mode changes what reaches stderr; `ARC_RUN_STREAM` appears in one test file only. A real coverage gap, not a demonstrated break.
- S3: Plausible — the fixed-defect list (F17) and the unfinished round 2 (`phase-06-tasks.md:75`, confirmed) are real. "No clean bill" is a judgment call.
- S4: Plausible — arc-jobs and work-door never mention the variable (grep confirmed). The effect on arc-jobs is small, though: it reads only the exit status, and stderr shows up only on failure.
- S5: Supported — the paid council-convene demo is recorded as "still owed" (`phase-06-tasks.md:75`).
- N1: Supported — `arc-run.mjs:1260` and `claude-code.mjs:160-171` confirm the switch to a different mechanism; the driver's CLI invocation changes too.
- N2: Supported — the control at `engine-driver-contract.bats:360-364` asserts that no step line appears without the variable. Flipping the default would break it (though it is easy to update).
- N3: Weak — "more stderr lines means more exposure" ignores the order lines are printed in. On failure the last line is arc-run's own, printed after the driver exits.
- N4: Plausible — same basis as S3.
- N5: Supported — F8 (the code comment) and F24 (the tracker) both confirmed.
- N6: Plausible — the rules half is confirmed (only `api.md:18`, about web exports); the "no measurement anywhere" half rests on one member's search, not reproduced.
- EN1: Weak — "byte-for-byte enforced in code" has the same flaw as A2: the guard checks option names, not equal output.
- EN2: Weak — the same mechanism error as S1; not reached on the failure exits checked (`arc-run.mjs:1851-1859`).
- EN3: Supported — `ARC_RUN_STREAM` is set in tests only in `engine-driver-contract.bats`; `tests/face/session-door.mjs` drives the door against a fake arc-run; no golden fixture covers arc-run output. The absence holds after a thorough search.
- EN4: Plausible — same basis as S3.
- EN5: Plausible — the uneven-value conclusion holds, and is stronger than stated; its arc-jobs example is wrong because `spawnSync` buffers.
- EN6: Weak — F25 is about the kill in a bats liveness arm; changing arc-run's default does not change how often that test runs.
- DS1: Supported — arc-jobs uses `spawnSync` (`arc-jobs.mjs:833`) and arc-attack and arc-bench do too, so none of them can see lines live even with someone watching.
- DS2: Weak — same mechanism error as S1 and EN2.
- DS3: Plausible — only the narrowed claim survives ("no golden test verifies output-shape parity"), and it duplicates EN3; the F9 framing was conceded as a misread.
- DS4: Weak — rests on F22, a low-confidence model belief nobody checked. Only "there is no CLI flag" (F1) is confirmed.
- DS5: Plausible — same basis as S3.
- DS6: Plausible — work-door has no reference to the variable (grep confirmed), so a scoped rollout is a coherent option.

## FIRST-PASS RATINGS
- A1: Weak — "only touches stderr relay … unaffected by construction" is false. Stream mode switches the claude-code driver to a different CLI output format and parse path (`claude-code.mjs:160-171`) and every driver to `spawnBounded`.
- A2: Weak — the guard at `arc-run.mjs:1261-1264` only checks that the option names match. It says nothing about identical output, and it does not cover the driver's separate `runStreaming` path.
- A3: Weak — arc-jobs uses `spawnSync` and passes stderr on only when a run fails (`arc-jobs.mjs:833,894-895`), so default-on gives it no live visibility.
- A4: Supported — `liveLine` runs on every live line and the 8 MiB cap is in code (`arc-run.mjs:1256,1270-1273,1289`).
- A5: Plausible — round 1 happened and its fixes landed, but round 2 never finished, so "hardened" overstates it.
- A6: Plausible — the code backs it. arc-run prints its reason line after the driver exits, so progress lines do not reach bench's last-line check on the exits I read. I did not trace every non-zero exit path.
- S1: Weak — the way it says the lines get "injected" is not reached. Progress lines come before arc-run's final reason.
- S2: Plausible — only one bats file sets `ARC_RUN_STREAM` (grep confirmed), and F16 is a medium-confidence absence. "Vacuum for the exact parsing paths" overstates it, because bench and attack parse arc-run's stdout, which does not change.
- S3: Plausible — the fixed-defect list (F17) and the unfinished round 2 are real. "No clean bill" is a judgment call.
- S4: Plausible — arc-jobs and work-door never mention the variable (grep confirmed). The effect on arc-jobs is small.
- S5: Supported — the paid council-convene demo is recorded as "still owed" (`phase-06-tasks.md:75`).
- N1: Supported — `arc-run.mjs:1260` and `claude-code.mjs:160-171` confirm the switch to a different mechanism.
- N2: Supported — the control at `engine-driver-contract.bats:360-364` asserts that no step line appears without the variable.
- N3: Weak — "more stderr lines means more exposure" ignores the order lines are printed in.
- N4: Plausible — same basis as S3.
- N5: Supported — F8 (the code comment) and F24 (the tracker) both confirmed.
- N6: Plausible — an absence claim (F21, low confidence) that cannot be fully proven. It is reasonable, not verified.
- EN1: Weak — "byte-for-byte enforced in code" has the same flaw as A2: the guard checks option names, not equal output.
- EN2: Weak — the same mechanism error as S1.
- EN3: Plausible — same basis as S2.
- EN4: Plausible — same basis as S3.
- EN5: Plausible — the uneven-value conclusion holds, and is stronger than stated; its arc-jobs example is wrong.
- EN6: Weak — changing arc-run's default does not change how often the bats liveness arm runs.
- DS1: Supported — arc-jobs uses `spawnSync` (`arc-jobs.mjs:833`) and F11 says arc-attack and arc-bench do too, so none of them can see lines live.
- DS2: Weak — same mechanism error as S1 and EN2.
- DS3: Plausible — F16 is a medium-confidence absence; DS3 also reads the F9 promise as a promise of equal output, when it is only about option names.
- DS4: Weak — rests on F22, a low-confidence model belief nobody checked.
- DS5: Plausible — same basis as S3.
- DS6: Plausible — work-door has no reference to the variable (grep confirmed), so a scoped rollout is a coherent option.

## UNRESOLVED
- [A6] vs [S2]: whether every non-zero exit of arc-run prints its own final reason line, so that arc-bench's last-line heuristic (`arc-bench.mjs:974`) can never report a driver progress line. The ordering is proven; full exit coverage is not.
- [N6]: whether any size or token-cost measurement of streamed logs exists; the "cheap" claim is unmeasured either way.

## VERDICT
PREDICTION: CONDITIONAL, Medium → RESULT: NO (evidence changed my mind: the verifier showed that every non-face headless caller runs arc-run through `spawnSync`, so it cannot see progress live, and that default-on also changes the driver's CLI path, not only stderr)
DECISION: NO
CONFIDENCE: Medium
Research mode: model-knowledge
Juror: unavailable (the headless Chair is not permitted to run council-juror.mjs)
Roster: advocate, skeptic, neutral, engineer, designer

KEY REASONS:
- [DS1] The problem stream mode solves is a person watching a long run. arc-attack, arc-bench and arc-jobs all start arc-run with `spawnSync`, so they only get stderr after the run ends. Default-on gives them no live view at all.
- [N1] Default-on is not a logging switch. It moves every headless run from `spawnSync` to `spawnBounded` and makes the claude-code driver use a different CLI output format and parse path.
- [EN3] Only one bats suite covers stream mode, and no test checks that stream-on and stream-off produce the same output. A default flip would put every headless caller on the less-tested path with no parity test.
- [N4] The streaming path needed real fixes (a throw that ended a paid run, a failed exit read as success, a credential in a progress line), and its second attack round never finished.
- [N5] The paid council-convene run that would prove stream mode end to end has not happened yet (F24).
- [EN5] The value is uneven. It matters for long runs someone watches live, and is near zero for short or buffered ones, so one default for all callers buys risk without matching benefit.
- [N2] The existing control test asserts that stream mode is off by default. Flipping it breaks a pinned contract, so the change needs its own tracked decision, not a quiet edit.

DISSENT (strongest surviving opposing point):
- [A6] The main feared break does not happen. arc-run's own reason line is always printed after the last driver line, so arc-bench's last-line check still sees arc-run's reason, and the receipt regex cannot be forged. Together with [A4]'s two-layer redaction, turning streaming on would be safer than it looks. The question is only whether it is worth it.

CHEAPEST TEST TO DE-RISK:
- Add one parity case to `tests/engine-driver-contract.bats`: run the same fixture with stream on and off, and assert the same stdout JSON, the same exit code and the same last non-receipt stderr line. Then list which headless callers read arc-run's stderr before it exits. If any does (for example, a work-door route with an `onLine` callback), set `ARC_RUN_STREAM=1` in that caller only, the way the session door does.

Review-by: 2026-12-31
Resolution: HIT if, by 2026-12-31, `arc-run.mjs` still defaults stream mode off, any new use sets `ARC_RUN_STREAM=1` in its own caller, and no incident is recorded where a non-face headless run failed because nobody could see its progress. MISS if arc has made stream mode the default in `arc-run.mjs` by then because a headless caller needed it, or if such an incident is recorded.

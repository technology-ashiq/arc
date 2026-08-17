# Phase 05 evidence — the pinned red-fixture corpus

Every red fixture the Phase 05 Definition of Done names, mapped to the test that pins it. The map is
derived from `tests/engine-hermes-contract.bats` as it stands at the closing commit, not from memory:
a corpus described in prose and never checked against the suite is how a fixture list drifts from the
tests that are supposed to hold it.

**Suite: `tests/engine-hermes-contract.bats` — 47 tests**, including its own self-count
(`this file registers every test it declares`), which exists because a `.bats` file that fails to
gather reports `declared N, executed 1` and takes its whole shard with it silently.

## The DoD's named corpus

| DoD fixture | Pinned by |
|---|---|
| junk bytes | `hermes: junk bytes produce a named parse failure, never a silent empty answer` |
| an ANSI flood | `hermes: an ANSI flood is stripped and the answer still arrives` · `hermes: an ANSI-wrapped answer is extracted, not read as junk` |
| truncated JSON | `hermes: truncated JSON fails rather than half-parsing` |
| injection-shaped output | `hermes: injection-shaped CONTENT is passed through intact and NOT judged by the driver` |
| empty stdout | `hermes: empty stdout is a runtime failure, and says so rather than saying not-JSON` · `hermes: whitespace-only stdout is empty, not a parse failure` |
| valid JSON, then never exits | `hermes: a runtime that writes an answer and never exits is BUDGET, exit 2, never driver` |
| output larger than any single read | `hermes: output larger than any single read is handled, not truncated` · `hermes: past the buffer ceiling it REFUSES by name -- and the branch is proven to run` |

The last row is the shape this repo keeps having to re-learn: the refusal branch is asserted to have
**run**, not merely to have produced no output. A ceiling that is never reached and a ceiling that is
broken look identical from the outside.

## Holes the adversarial passes added to the corpus

These are not in the DoD list. They exist because two fresh agents went looking for them, and each
one is now a fixture rather than a note.

| Hole | Pinned by |
|---|---|
| DCS payload swallowing the answer | `hermes: a DCS payload does not become the answer` |
| APC payload swallowing the answer | `hermes: an APC payload does not become the answer` |
| unterminated OSC eating the answer | `hermes: an unterminated OSC does not swallow the answer` |
| unterminated OSC leaving a STALE line returned as the answer | `hermes: an unterminated OSC does not leave a STALE line to be returned as the answer` |
| lone-CR progress bar hiding the answer | `hermes: a lone-CR progress bar does not hide the answer` |
| pretty-printed answer read as a nested fragment | `hermes: a pretty-printed answer returns the WHOLE document, not a nested fragment` |
| an escape inside a JSON string silently stripped | `hermes: an escape INSIDE a JSON string is refused, never silently stripped` |
| a lone surrogate in the hash preimage | `encoder: a lone surrogate is REFUSED, and the replacement character still hashes` |
| a fractional buffer ceiling lifting the ceiling | `hermes: a fractional buffer ceiling does not LIFT the ceiling` |
| a timed-out run orphaning its container | `hermes: a timed-out run REAPS its container` |
| a malformed deadline read as no deadline | `hermes: a malformed deadline is a named failure, not a silently absent clock` |
| the fake docker printing nothing on an unknown case | `the fake docker REFUSES an unknown case instead of printing nothing` |

**One limit is pinned rather than fixed**, and named as such:
`hermes: KNOWN LIMIT -- a JSON-shaped log line after the answer wins, and that is pinned`. A known
limit with a test is a decision; a known limit without one is a bug waiting to be rediscovered.

## The rest of the DoD, and where it is proven

| DoD criterion | Proven by |
|---|---|
| real ENG-D contract, exits 0/1/2, no new codes | `hermes: three-code exit map -- a runtime that exits non-zero is a DRIVER failure, exit 1` |
| `--version` returns runtime version **plus** pinned config hash | `hermes: the version verb reports the pinned runtime AND the config hash` |
| the hash actually distinguishes inputs | `hermes: the config hash MOVES when the config file moves` · `hermes: a MISSING config file hashes differently from an UNCONFIGURED one` · `hermes: the config hash distinguishes two files that differ only in invalid UTF-8` |
| the encoder refuses what it cannot represent | `encoder: every unrepresentable value is REFUSED, none is coerced` · `encoder: none of the pairs JSON.stringify collides on collide here` · `encoder: key ORDER does not move the hash and key CONTENT does` |
| …with a negative control that actually fails | `encoder: NEGATIVE CONTROL -- the same harness reports a collision when one exists` |
| wall-clock charged to the RUN, never a fresh budget | `hermes: a deadline already spent declines BEFORE starting the runtime` · `hermes: NO deadline in the environment means no deadline, not a zero one` · `hermes: the budget string is NOT used as a clock -- a large min does not extend a spent deadline` |
| the image must be digest-pinned | `hermes: an image that is not pinned by digest is REFUSED` · `hermes: an unset image is a named setup failure, never a silent no-op` |
| the driver is reachable as a driver | `hermes: arc-run routes --driver hermes` |
| the argv is what it claims | `hermes: the container command line is what it claims to be` · `hermes: the model actually receives the input document` |
| ADR-0204's ladder inherited exactly | `tests/engine-driver-contract.bats` (20 tests) — the ladder is arc-run's, and the shim adds nothing to it |
| `drivers/mock` replays, swapping the RESPONSE and never the code path | `mock satisfies the ADR-0203 driver contract on a recorded process` · `mock runs the shared budget path, so an unparseable budget fails before any replay` · `mock reaches produce: an empty recording dir fails the run` · `mock exits 1 and names the path when its recording is missing` |
| a mock run can never be mistaken for the real one | `cert-label: the mock driver can NEVER certify, whatever else is true` (`tests/engine-cert-label.bats`) |
| every artifact passes `scanSecrets()`, with a negative control | `tests/engine-hermes-secrets.bats` — the four artifact classes plus `REQ-03 NEGATIVE CONTROL: a clean run passes the scrub AND produces its answer` |

## The probe lives in a file, and that is a fixed defect, not a style choice

`tests/engine-hermes-probe.mjs` carries the Node half of the suite instead of `node -e`, because a
program embedded in a shell string carries no apostrophe, no single quote and — inside double quotes
— no backtick and no `$`. This repo has broken that rule four times, once inside the comment
explaining the previous break. Every probe subcommand prints a terminal marker line so the caller
asserts the probe **RAN** before asserting what it printed.

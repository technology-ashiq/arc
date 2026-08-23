#!/usr/bin/env bats
# engine-hermes-secrets.bats -- REQ-03's four artifact classes, on the REAL hermes path, and the
# ADR-0221 seat asserted on a LANDED RECEIPT rather than on a driver's own sidecar.
#
# WHY THIS FILE EXISTS. `engine-driver-contract.bats` already proves a secret in driver output stops
# a run -- but it does so through `ARC_DRIVER_FAKE`, which short-circuits common.mjs before
# `produce()` ever runs, and it covers one class. So it is a statement about the fake path and about
# stdout. The Phase 05 slice ledger recorded that gap as NOT PROVEN rather than counting the
# inherited check as done, and this file discharges it: only the docker binary is substituted, and
# every assertion below rides the real driver, the real spawn, the real capture, the real scrub.
#
# TWO REAL HOLES WERE FOUND BY WRITING IT, which is the point of writing it:
#   - the runtime's stderr was DISCARDED on every successful run, so the transcript class was
#     unscrubbed and a planted key passed straight through. ADR-0215 keeps a trail per dispatch
#     precisely because injection shows in trails, and the runs where that matters are the ones
#     that look clean.
#   - nothing anywhere asserted `model_source: "runtime"` or the `runtime` payload field, so
#     deleting the whole ADR-0221 seam from arc-run left every suite green.

bats_require_minimum_version 1.5.0

load test_helper

# ONE granting root for the whole file (ADR-0225). A runtime driver is unreachable without a row
# that names it, and the real router routes `commit-msg-draft` to `claude-code` -- so every dispatch
# in this file used to reach the agent runtime through a row carrying no cap, no tenure and no
# judge. That was the hole ADR-0225 closes, not a fixture detail, so the suite moves to a root whose
# router carries the grant rather than the rule bending to keep the suite green.
setup_file() {
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  export GRANT_ROOT="$BATS_FILE_TMPDIR/grant-root"
  _arc_runtime_grant_root "$GRANT_ROOT" "$ARC_ROOT"
}

setup() {
  # AN AMBIENT ARC_RUN_TRANSCRIPT_DIR MUST NOT SURVIVE INTO A TEST. The repo now tells callers to
  # export this variable to collect evidence, so on any box where it IS exported every dispatch in
  # this file would write a FIXTURE transcript into that lane live evidence directory -- polluting
  # the very file count a phase close reads. Neutralised here rather than per test, because the
  # hole is the inherited value and not the ones tests set themselves.
  unset ARC_RUN_TRANSCRIPT_DIR
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT" "$BATS_TEST_TMPDIR/data"
  export ARC_HERMES_DOCKER="$ARC_ROOT/tests/fixtures/engine/hermes/fake-docker.mjs"
  export ARC_HERMES_IMAGE="nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e"
  export ARC_HERMES_DATA="$BATS_TEST_TMPDIR/data"
  export ARC_HERMES_USAGE_FILE=""
}

# EVERY DISPATCH IN THIS FILE CARRIES AN external-ok DECLARATION, and it is not decoration. The
# grant root's row must carry all four hire terms or `routerFaults` refuses to load it -- `cap:` is
# one of them -- and REQ-06 refuses an input that does not declare itself external-ok for a class
# routing to a capped row. Without it every test here is refused at exit 5 before a driver exists,
# and `class 3 of 4` would pass VACUOUSLY: it asserts only that a grep finds nothing, on a spine
# that no run ever wrote to.
PACK_INPUT='{"classification":"external-ok","diff":"x"}'

run_arc() {
  export ARC_HERMES_FAKE_CASE="$1"
  run node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT"
}

# The planted key is FAKE: AWS-shaped, matching redact.mjs rule `aws-access-key-id`, and
# corresponding to nothing that exists.
PLANTED="AKIAQQ7ZBQ4TESTONLY1"

@test "REQ-03 class 1 of 4: a secret in the DRAFT OUTPUT stops the run and never reaches the spine" {
  run_arc secret-stdout
  [ "$status" -eq 1 ]
  [[ "$output" == *"aws-access-key-id"* ]]
  [[ "$output" == *"driver's stdout"* ]]
  [[ "$output" == *"was NOT written"* ]]
  # An "output does not contain X" assertion never stands alone -- it is satisfied by a crash. The
  # three above prove the scrub RAN and named its rule; this one proves what it prevented.
  run grep -rh "$PLANTED" "$ARC_SPINE_ROOT/events"
  [ "$status" -ne 0 ]
}

@test "REQ-03 class 2 of 4: a secret in the TRANSCRIPT stops the run - the hole this file found" {
  # Until the driver forwarded the container's stderr, this ran to completion with the key in the
  # trail and the scrub silent. Measured, not theorised.
  run_arc secret-stderr
  [ "$status" -eq 1 ]
  [[ "$output" == *"aws-access-key-id"* ]]
  [[ "$output" == *"driver's transcript"* ]]
  run grep -rh "$PLANTED" "$ARC_SPINE_ROOT/events"
  [ "$status" -ne 0 ]
}

@test "REQ-03 class 3 of 4: a secret planted in the USAGE REPORT never reaches the receipt" {
  # The reader is selective by construction -- it copies token counts and a model id and nothing
  # else -- so an unrelated key in the report has no path onto the receipt. Asserted rather than
  # assumed from reading the code, because "the reader only takes three fields" is the kind of
  # claim a later refactor breaks silently.
  run_arc secret-usage
  # ASSERT IT RAN BEFORE ASSERTING WHAT IT PRODUCED. This test went straight to the grep, so a
  # run refused before any driver started -- exactly what happens the moment the grant root has a
  # `cap:` -- left an empty spine, the grep found nothing, and the test reported the usage reader
  # safe. It proved nothing about the reader at all.
  run grep -rh "run.completed" "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ] || { echo "no run.completed receipt -- the dispatch never happened"; false; }
  run grep -rh "$PLANTED" "$ARC_SPINE_ROOT/events"
  [ "$status" -ne 0 ]
}

@test "REQ-03 class 4 of 4: the run.completed PAYLOAD carries no planted key on a clean run" {
  run_arc commit-clean-usage
  [ "$status" -eq 0 ]
  [[ "$output" == *'"commits"'* ]]
  run grep -rh "$PLANTED" "$ARC_SPINE_ROOT/events"
  [ "$status" -ne 0 ]
}

@test "REQ-03 NEGATIVE CONTROL: a clean run passes the scrub AND produces its answer" {
  # The check is not simply always-on. And it asserts the run SUCCEEDED, not merely that no secret
  # was reported -- a failed run also reports no secret.
  run_arc commit-clean
  [ "$status" -eq 0 ]
  [[ "$output" == *'"sha":"a1b2c3d"'* ]]
  [[ "$output" != *"aws-access-key-id"* ]]
  [[ "$output" != *"was NOT written"* ]]
}

@test "ADR-0221 END TO END: the landed receipt carries the runtime model, model_source runtime, and the runtime id" {
  # THE ASSERTION NOTHING IN THE REPO MADE. An adversarial pass showed that deleting the entire
  # seam from arc-run left every suite green, because the reader tests read the driver's sidecar
  # and never ran arc-run. This reads the receipt off the spine.
  run_arc commit-clean-usage
  [ "$status" -eq 0 ]

  run node -e '
    const fs = require("fs");
    const dir = process.argv[1];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    let found = null;
    for (const f of files) {
      for (const l of fs.readFileSync(dir + "/" + f, "utf8").trim().split("\n")) {
        const e = JSON.parse(l);
        if (e.kind === "run.completed") found = e;
      }
    }
    if (!found) { console.log("NO_RECEIPT"); process.exit(1); }
    console.log(JSON.stringify({
      model: found.model,
      model_source: found.payload.model_source,
      runtime: found.payload.runtime,
      tokens: found.payload.tokens,
    }));
  ' "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ]

  [[ "$output" == *'"model":"llama3.1:8b"'* ]]
  [[ "$output" == *'"model_source":"runtime"'* ]]
  [[ "$output" == *'"runtime":"hermes@sha256:'* ]]
  [[ "$output" == *'"in":1234'* ]]
  [[ "$output" == *'"source":"measured"'* ]]
}

@test "REQ-05: the report's ESTIMATED cost never reaches the landed receipt" {
  # The fixture puts estimated_cost_usd: 0.0123 in the report precisely so this can fail. REQ-05
  # says cost is provider-reported or absent, and a runtime's own estimate is neither. Asserted on
  # the RECEIPT, not on the sidecar: the sidecar test is one layer short of where the claim lives.
  run_arc commit-clean-usage
  [ "$status" -eq 0 ]
  run grep -rh "0.0123" "$ARC_SPINE_ROOT/events"
  [ "$status" -ne 0 ]
  run grep -rh "inr_estimate" "$ARC_SPINE_ROOT/events"
  [ "$status" -ne 0 ]
}

@test "REQ-03: the scrubber is the spine's own, never a second copy that can drift" {
  run grep -c 'from "../hq/lib/redact.mjs"' "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"
  [ "$output" = "1" ]
  run grep -cE "DENY_RULES *= *\[" "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"
  [ "$output" = "0" ]
}

@test "ADR-0221: the RUNTIME rides the receipt even when no usage report exists" {
  # FOUND BY THE FIRST CERTIFICATION DISPATCH, 2026-08-17, and by nothing before it. ADR-0221 says
  # run.completed carries the runtime in its own payload field. It did not: `cost` was built only
  # INSIDE the usage-report block, arc-run reads `runtime` off the cost sidecar, and the vendor's
  # --usage-file is pinned as a no-op that has never written a report on this image. So the one
  # field naming WHICH CONTRACTOR RAN was absent from every real receipt -- the landed one read
  # `runtime: undefined, model_source: none`.
  #
  # Every fixture test passed throughout, because they all PLANT a usage report. The suite proved
  # the enriched path; nothing proved the ordinary one, which is the shape of a run that measures
  # nothing -- i.e. every real run.
  run_arc commit-clean
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  run node -e '
    const fs = require("fs");
    const dir = process.argv[1];
    let found = null;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".jsonl")))
      for (const l of fs.readFileSync(dir + "/" + f, "utf8").trim().split("\n")) {
        const e = JSON.parse(l);
        if (e.kind === "run.completed") found = e;
      }
    if (!found) { console.log("NO_RECEIPT"); process.exit(1); }
    console.log(JSON.stringify({
      runtime: found.payload.runtime ?? null,
      // TOP-LEVEL, not payload. `cost` is an event field (arc-event.mjs), so `payload.cost` is
      // undefined on every receipt ever written and `?? null` made this a tautology -- the guard
      // on the fix trade could not fail. A mutant stamping a fabricated zero cost stayed green.
      cost: found.cost ?? null,
      has_duration: typeof found.payload.duration_ms === "number" && found.payload.duration_ms >= 0,
    }));
  ' "$ARC_SPINE_ROOT/events"
  [ "$status" -eq 0 ]
  [[ "$output" == *'"runtime":"hermes@sha256:'* ]] || { echo "the receipt carries no runtime identity: $output"; false; }
  # REQ-05 derives a class budget FROM RECEIPTS, and the first landed hermes receipt carried no
  # duration at all -- so the only way to satisfy that clause was a hand-read stopwatch, which is
  # exactly the guess it forbids. Unlike cost, elapsed time is something arc-run observed on its
  # own clock, so it is never absent.
  [[ "$output" == *'"has_duration":true'* ]] || { echo "the receipt carries no duration: $output"; false; }
  # AND the spend stays absent. An identity field must not manufacture a cost record -- that is
  # ADR-0069 b5, and it is the exact trade this fix had to avoid making.
  [[ "$output" == *'"cost":null'* ]] || { echo "a cost was manufactured alongside the identity: $output"; false; }
}
@test "REQ-03 STORAGE: the stored transcript carries the RUNTIME bytes, both streams" {
  # REWRITTEN 2026-08-23 after two independent adversarial surfaces landed on the same defect.
  #
  # The previous version ran `commit-clean` and asserted `grep -q ADR-0222`. Every byte in the
  # stored file was written by hermes.mjs in the PARENT process before the container was spawned --
  # the fake writes its answer to STDOUT and nothing to stderr, and `ADR-0222` is an unconditional
  # arc-side banner. So the assertion whose comment said "it must contain the DRIVER's lines"
  # asserted ZERO bytes of container output, and deleting the container-stderr forwarding
  # altogether left it green. That is the vacuous pass, in the suite written to prevent it.
  #
  # `commit-clean-noisy` exists for this: two markers that appear nowhere in arc, one per stream.
  unset ARC_RUN_TRANSCRIPT_DIR
  local dir="$BATS_TEST_TMPDIR/transcripts"
  export ARC_HERMES_FAKE_CASE="commit-clean-noisy"
  run node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT" --transcript-dir "$dir"
  [ "$status" -eq 0 ] || { echo "the run did not succeed: $output"; false; }

  # ONE file, named, and then read. Globbing a whole directory proves only that SOME file in it
  # carries the marker -- with a sentinel beside a real transcript, `grep -q` over the glob is
  # green while the file the count credits is empty.
  local f; f="$(find "$dir" -type f -name '*.transcript.txt')"
  [ -n "$f" ] || { echo "no transcript was stored in $dir"; false; }
  [ "$(printf '%s\n' "$f" | wc -l)" -eq 1 ] || { echo "expected exactly one transcript, got: $f"; false; }

  # THE RUNTIME's bytes, on BOTH streams. The stdout half is the one that matters most: the
  # near-miss JSON Phase 08 lost arrived on stdout, and a stderr-only transcript would have
  # discarded it a second time.
  grep -q "RUNTIME-STDOUT-MARKER" "$f" || { echo "the transcript carries no container STDOUT: $(cat "$f")"; false; }
  grep -q "RUNTIME-STDERR-MARKER" "$f" || { echo "the transcript carries no container STDERR: $(cat "$f")"; false; }
  grep -q -- "--- stdout ---" "$f" || { echo "the streams are not labelled: $(cat "$f")"; false; }
  grep -q -- "--- stderr ---" "$f" || { echo "the streams are not labelled: $(cat "$f")"; false; }
}

@test "REQ-03 STORAGE NEGATIVE CONTROL: a planted key stops the run and stores NOTHING" {
  # The ordering IS the guarantee: scrub() fails the run before storeTranscript() is reached, so
  # the file on disk can never be the unscrubbed one. Inverting those two lines would turn an
  # evidence path into a leak path, and nothing else in the suite would notice.
  local dir="$BATS_TEST_TMPDIR/transcripts-neg"
  # THE DIRECTORY IS CREATED FIRST, and that is not tidiness. `find` over a path that does not
  # exist exits non-zero and prints nothing; with its complaint sent to /dev/null and its exit
  # status masked by the pipeline, the count is 0 whatever happened -- so the assertion passed on
  # a crash, on a no-op, and on correct behaviour alike.
  mkdir -p "$dir"
  export ARC_RUN_TRANSCRIPT_DIR="$dir"
  run_arc secret-stderr
  [ "$status" -ne 0 ] || { echo "a planted key did not stop the run"; false; }
  [[ "$output" == *"aws-access-key-id"* ]] || { echo "the refusal does not name the rule: $output"; false; }
  local n; n="$(find "$dir" -type f | wc -l | tr -d ' ')"
  [ "$n" -eq 0 ] || { echo "a transcript was stored despite the secret: $(ls "$dir")"; false; }
}

@test "REQ-03 STORAGE: with no directory asked for, nothing is written anywhere" {
  # Opt-in means opt-in. A default path would make every lane's dispatches write into whatever
  # directory this binary happened to think was theirs.
  unset ARC_RUN_TRANSCRIPT_DIR
  run_arc commit-clean
  [ "$status" -eq 0 ]
  # BOTH PLACES. bats runs with CWD at the repo root while BATS_TEST_TMPDIR is elsewhere entirely,
  # and arc-run has been proven to create a RELATIVE destination in its own CWD -- so a regression
  # introducing any relative default (`./transcripts`, `evidence/`) writes into the arc working
  # tree and a scan of the tmpdir alone stays green under a heading claiming nothing was written
  # ANYWHERE.
  local n; n="$(find "$BATS_TEST_TMPDIR" -name '*.transcript.txt' | wc -l | tr -d ' ')"
  [ "$n" -eq 0 ] || { echo "a transcript was written without being asked for"; false; }
  local c; c="$(find "$ARC_ROOT" -maxdepth 2 -name '*.transcript.txt' | wc -l | tr -d ' ')"
  [ "$c" -eq 0 ] || { echo "a transcript was written into the repo tree"; false; }
}

@test "REQ-03 STORAGE: --transcript-dir stores the transcript with no env var set" {
  # The flag exists because the env var alone was a mechanism a caller could FORGET, and twice did:
  # Phase 06 certification and Phase 08 round 1 both dispatched for real with the storage half
  # armed and unused. ADR-0220 already made this argument for --trial-model and --work-root.
  unset ARC_RUN_TRANSCRIPT_DIR
  local dir="$BATS_TEST_TMPDIR/flag-transcripts"
  export ARC_HERMES_FAKE_CASE="commit-clean-noisy"
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT" --transcript-dir "$dir"
  [ "$status" -eq 0 ] || { echo "the run did not succeed: $stderr"; false; }
  local f; f="$(find "$dir" -type f -name '*.transcript.txt')"
  [ -n "$f" ] || { echo "no transcript was stored in $dir"; false; }
  grep -q "RUNTIME-STDOUT-MARKER" "$f" || { echo "the transcript carries no runtime bytes"; false; }

  # THE STREAM SPLIT IS PINNED HERE. Note the variables: bats defines `$output`, `$lines`,
  # `$stderr` and `$stderr_lines` -- there is NO `$stdout`. Under `--separate-stderr`, stdout
  # lands in `$output`. Asserting on `$stdout` compares against an empty string, which is the
  # vacuous-pass shape wearing a variable name; CI caught it because the assertion was a
  # positive one.
  # THE SPLIT ITSELF: arc-run's stdout IS the JSON receipt -- a sibling test parses
  # it -- and every operator line is stderr. bats merges the two into $output, so a substring
  # assertion is satisfied by the WRONG stream: move the storage line to stdout and every consumer
  # piping arc-run into jq breaks while these tests stay green.
  [[ "$output" == *'"commits"'* ]] || { echo "stdout is not the receipt: $output"; false; }
  [[ "$output" != *"stored the scrubbed"* ]] || { echo "an operator line reached stdout: $output"; false; }
  [[ "$stderr" == *"stored the scrubbed"* ]] || { echo "the storage line is not on stderr: $stderr"; false; }
}

@test "REQ-03 STORAGE: the flag is used and the env var is reported IGNORED" {
  # Precedence is fine; SILENT precedence is not. A caller who exported the env var three layers
  # up is entitled to know it did not apply.
  #
  # THE NOTICE IS A FACT ABOUT CONFIGURATION, NOT ABOUT DIRECTORIES. The first cut compared
  # `resolve(env) !== resolve(flag)`, and two spellings of the SAME directory resolve unequal on
  # every filesystem in this matrix -- CaseDir vs casedir on NTFS and APFS, a trailing dot or
  # space, an 8.3 short name, a junction -- so it told the operator their transcript had gone
  # somewhere else when it had gone exactly where they asked. `resolve` is a string normaliser,
  # not a filesystem identity.
  local envdir="$BATS_TEST_TMPDIR/env-dir" flagdir="$BATS_TEST_TMPDIR/flag-dir"
  mkdir -p "$envdir"
  export ARC_RUN_TRANSCRIPT_DIR="$envdir"
  export ARC_HERMES_FAKE_CASE="commit-clean-noisy"
  run node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT" --transcript-dir "$flagdir"
  [ "$status" -eq 0 ] || { echo "the run did not succeed: $output"; false; }
  [[ "$output" == *"is ignored for this run"* ]] || { echo "the override was silent: $output"; false; }
  local nf; nf="$(find "$flagdir" -type f -name '*.transcript.txt' | wc -l | tr -d ' ')"
  [ "$nf" -ge 1 ] || { echo "the flag directory got no transcript"; false; }
  # The half that proves the override HAPPENED rather than that both were written.
  local ne; ne="$(find "$envdir" -type f | wc -l | tr -d ' ')"
  [ "$ne" -eq 0 ] || { echo "the env directory was written to as well: $(ls "$envdir")"; false; }
}

@test "REQ-03 STORAGE MUTANT GUARD: the notice does NOT appear when only the flag is given" {
  # Kills the mutant that drops the `envRaw !== null` condition and prints "ARC_RUN_TRANSCRIPT_DIR
  # undefined is ignored" on every flag-only run -- a false claim about an operator variable that
  # was never set. The positive test above cannot see it: it always sets both.
  unset ARC_RUN_TRANSCRIPT_DIR
  export ARC_HERMES_FAKE_CASE="commit-clean-noisy"
  run node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT" --transcript-dir "$BATS_TEST_TMPDIR/only-flag"
  [ "$status" -eq 0 ] || { echo "the run did not succeed: $output"; false; }
  [[ "$output" != *"is ignored for this run"* ]] || { echo "an ignored-env notice fired with no env var set: $output"; false; }
  # Paired positive, so a crash cannot satisfy the line above.
  [[ "$output" == *"stored the scrubbed"* ]] || { echo "nothing was stored: $output"; false; }
}

@test "REQ-03 STORAGE: --transcript-dir twice is an operator error, never last-wins" {
  export ARC_HERMES_FAKE_CASE="commit-clean"
  mkdir -p "$BATS_TEST_TMPDIR/one" "$BATS_TEST_TMPDIR/two"
  run node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT" \
    --transcript-dir "$BATS_TEST_TMPDIR/one" --transcript-dir "$BATS_TEST_TMPDIR/two"
  [ "$status" -eq 2 ] || { echo "two --transcript-dir values were accepted: $output"; false; }
  [[ "$output" == *"given twice"* ]] || { echo "the refusal does not name the cause: $output"; false; }
  # Both directories EXIST, so this find is a real measurement rather than a masked failure.
  local n; n="$(find "$BATS_TEST_TMPDIR/one" "$BATS_TEST_TMPDIR/two" -type f | wc -l | tr -d ' ')"
  [ "$n" -eq 0 ] || { echo "a transcript was stored despite the refusal"; false; }
}

@test "REQ-03 STORAGE: a value that is another FLAG is refused, not consumed as a path" {
  # CRITICAL, found by both adversarial surfaces on 2026-08-23 and executed by both.
  # `--transcript-dir --dry-run` consumed --dry-run AS THE PATH: dryRun stayed false, so a caller
  # asking for a PREVIEW got a real dispatch against a real driver with real money and a
  # run.completed receipt on the spine, plus a directory literally named `--dry-run` in the working
  # tree. The empty-value guard tested `=== ""` and treated every other string as a deliberate
  # path -- missing-vs-empty wearing a third face.
  export ARC_HERMES_FAKE_CASE="commit-clean"
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT" --transcript-dir --dry-run
  [ "$status" -eq 2 ] || { echo "a flag was accepted as a path value: $stderr"; false; }
  [[ "$stderr" == *"which is another flag, not a value"* ]] || { echo "the refusal does not name the cause: $stderr"; false; }
  # THE POSITIVE HALF: prove no dispatch happened. An exit code alone does not distinguish
  # "refused before anything ran" from "ran and then failed".
  [ -z "$output" ] || { echo "a driver produced output despite the refusal: $output"; false; }
}

@test "REQ-03 STORAGE: an empty --transcript-dir value is an operator error, not unset" {
  # The same fail-open shape ADR-0220 records for --work-root with an unset shell variable: an
  # empty value must never read as an absent flag, or a forgotten export silently disables the
  # evidence path while the command line still claims it is on.
  export ARC_HERMES_FAKE_CASE="commit-clean"
  run node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT" --transcript-dir ""
  [ "$status" -eq 2 ] || { echo "an empty --transcript-dir was accepted: $output"; false; }
  [[ "$output" == *"needs a value"* ]] || { echo "the refusal does not name the cause: $output"; false; }
}

@test "REQ-03 STORAGE: an empty ARC_RUN_TRANSCRIPT_DIR is an operator error too" {
  # THE TWIN. The flag arm said in as many words that an empty value is an operator error and not
  # "unset"; the env var six lines away read empty as unset, turned storage off, and exited 0. That
  # is the twin-fix recurrence this repo has now recorded four times -- and the idiom that produces
  # it (`export VAR="$UNSET_THING"`) is house style in this very file, which does it on line 31.
  export ARC_RUN_TRANSCRIPT_DIR=""
  export ARC_HERMES_FAKE_CASE="commit-clean"
  run node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT"
  [ "$status" -eq 2 ] || { echo "an empty ARC_RUN_TRANSCRIPT_DIR was read as unset: $output"; false; }
  [[ "$output" == *"set but empty"* ]] || { echo "the refusal does not name the cause: $output"; false; }
}

@test "REQ-03 STORAGE: an unusable destination is refused BEFORE the driver starts" {
  # `--work-root` refuses before the spawn and its comment gives the rule: a receipt blaming the
  # DRIVER for the caller's flag is a false claim in an append-only ledger. The new member of the
  # same strict group inherited none of it -- a destination that was a regular file, or a typo,
  # was discovered only after the money was spent, reported as one WARN among the driver's own
  # lines, with the run still exiting 0 and the transcript count at zero.
  local afile="$BATS_TEST_TMPDIR/not-a-directory"
  touch "$afile"
  export ARC_HERMES_FAKE_CASE="commit-clean"
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT" --transcript-dir "$afile"
  [ "$status" -eq 2 ] || { echo "an unusable destination did not refuse: $stderr"; false; }
  [[ "$stderr" == *"cannot be used"* ]] || { echo "the refusal does not name the cause: $stderr"; false; }
  # The positive half: NO driver ran, so nothing was paid for.
  [ -z "$output" ] || { echo "the driver ran before the destination was checked: $output"; false; }
}

@test "REQ-03 STORAGE: a reserved Windows device name is refused" {
  # `.claude/rules/lanes.md` already bans these for lane directories because they pass every
  # grammar and break exactly one of the three CI legs. Node creates a real directory named `nul`
  # and reports success; no Win32 consumer -- cmd, Explorer, git add, the CI artifact uploader --
  # can address it afterwards. Evidence that exists and cannot be fetched is not evidence.
  export ARC_HERMES_FAKE_CASE="commit-clean"
  run node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT" --transcript-dir "$BATS_TEST_TMPDIR/nul"
  [ "$status" -eq 2 ] || { echo "a reserved device name was accepted: $output"; false; }
  [[ "$output" == *"reserved device name"* ]] || { echo "the refusal does not name the cause: $output"; false; }
}

@test "REQ-03 LOUD ABSENCE: a transcript with nowhere to go is announced, never dropped silently" {
  # THIS is the fix for what actually went wrong twice. Opt-in storage was correct and stays
  # correct. What failed is that opting out looked identical to having nothing to store, so two
  # phases of real dispatches sailed past REQ-03 and Phase 08 lost the one artifact that would
  # have said whether a near-miss JSON shape was a prompt bug or a schema bug.
  unset ARC_RUN_TRANSCRIPT_DIR
  export ARC_HERMES_FAKE_CASE="commit-clean-noisy"
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$GRANT_ROOT" --input "$PACK_INPUT"
  [ "$status" -eq 0 ] || { echo "the run did not succeed: $stderr"; false; }
  [[ "$stderr" == *"NO destination is set"* ]] || { echo "the discard was silent: $stderr"; false; }
  [[ "$stderr" == *"--transcript-dir"* ]] || { echo "the warning does not name the fix: $stderr"; false; }
  # Opt-in still means opt-in: warning is not writing.
  local n; n="$(find "$BATS_TEST_TMPDIR" -name '*.transcript.txt' | wc -l | tr -d ' ')"
  [ "$n" -eq 0 ] || { echo "a transcript was written without being asked for"; false; }
}

@test "REQ-03 LOUD ABSENCE: it fires for a driver that writes nothing to STDERR" {
  # THE HOLE THE FIRST VERSION HAD, found by both surfaces. The warning was gated on the length of
  # the driver's STDERR, and `claude-code`, `codex`, `generic-api` and `mock` write none -- a grep
  # over drivers/ returns 0 for all four. So the mechanism built to make a forgotten flag loud was
  # silent on every driver a real dispatch of this process class actually uses, and it fired only
  # for hermes, where it was matching arc's own unconditional banners rather than runtime output.
  unset ARC_RUN_TRANSCRIPT_DIR
  run --separate-stderr node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver mock --root "$GRANT_ROOT" --input "$PACK_INPUT"
  [[ "$stderr" == *"NO destination is set"* ]] || { echo "a silent-stderr driver discarded its transcript in silence: $stderr"; false; }
}

@test "REQ-03 LOUD ABSENCE NEGATIVE CONTROL: with a destination set, the warning is NOT printed" {
  # A warning that fires unconditionally is noise that gets filtered by the eye, and it would make
  # the positive tests above pass for the wrong reason. The property is that the line is bound to
  # the ABSENCE, so a configured run must be quiet about it.
  local dir="$BATS_TEST_TMPDIR/quiet-transcripts"
  export ARC_RUN_TRANSCRIPT_DIR="$dir"
  run_arc commit-clean
  [ "$status" -eq 0 ] || { echo "the run did not succeed: $output"; false; }
  [[ "$output" != *"NO destination is set"* ]] || { echo "the absence warning fired on a configured run: $output"; false; }
  local n; n="$(find "$dir" -type f -name '*.transcript.txt' | wc -l | tr -d ' ')"
  [ "$n" -ge 1 ] || { echo "no transcript was stored in $dir"; false; }
}

@test "suite: all 25 tests in this file are REGISTERED" {
  # bats silently DROPS a @test whose name carries a non-ASCII character; five such tests in this
  # cycle never ran and never failed, and the only signal was the count falling on CI.
  # FIXED 2026-08-17 after an adversarial pass defeated the previous version, which counted
  # `^@test ` lines in the SOURCE -- the DECLARED count. bats silently DROPS a @test whose name
  # carries a non-ASCII character, and the source line survives the drop, so the number never
  # moved and the guard stayed green while a test did not run. `bats --count` reports what bats
  # actually REGISTERED. Assert both and that they agree: the pair catches a drop (registered
  # falls) and a silent removal (declared falls).
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "25" ] || { echo "expected 25 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}

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

setup() {
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT" "$BATS_TEST_TMPDIR/data"
  export ARC_HERMES_DOCKER="$ARC_ROOT/tests/fixtures/engine/hermes/fake-docker.mjs"
  export ARC_HERMES_IMAGE="nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e"
  export ARC_HERMES_DATA="$BATS_TEST_TMPDIR/data"
  export ARC_HERMES_USAGE_FILE=""
}

run_arc() {
  export ARC_HERMES_FAKE_CASE="$1"
  run node "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs" \
    --process commit-msg-draft --driver hermes --root "$ARC_ROOT"
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

@test "suite: all 9 tests in this file are REGISTERED" {
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
  [ "$registered" = "9" ] || { echo "expected 9 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}

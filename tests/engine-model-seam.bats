#!/usr/bin/env bats
# ADR-0220 -- the per-invocation model/root seam.
#
# WHAT THIS EXISTS TO PROVE. `arc-run` rebuilt the driver environment and overwrote both
# ARC_DRIVER_MODEL and ARC_ROOT unconditionally, so the only way to pin a model was a reviewed
# engine/router.yaml row -- and the one lane whose entire job is comparing models has no write
# path to that file, ever.
#
# WHAT THIS DELIBERATELY DOES NOT DO. It does not make a caller-set ARC_DRIVER_MODEL work. Reading
# that variable off the ambient environment is the un-reviewed tier change ADR-0069 b1 forbids, and
# is precisely why the overwrite was written. The seam is two EXPLICIT flags.
#
# EVERY ASSERTION HERE OBSERVES BEHAVIOUR, NOT A RECEIPT ALONE. The first version of this suite was
# rewritten after an adversarial pass: a ONE-TOKEN mutant (effectiveModel -> pinnedModel in the
# driver env) made --trial-model reach no driver at all while the receipt still claimed it, and all
# eleven tests passed. Receipts are written by the code under test, so a suite that only reads
# receipts is asking the accused to testify. Tests 4-8 below observe the CHILD PROCESS instead.
bats_require_minimum_version 1.5.0
load 'test_helper'

RUN()   { echo "$ARC_ROOT/.claude/scripts/engine/arc-run.mjs"; }
FAKE()  { echo "$ARC_ROOT/tests/fixtures/engine/driver-fakes/$1"; }
READ()  { node "$ARC_ROOT/tests/fixtures/engine/read-receipt.mjs" "$ARC_SPINE_ROOT" "$@"; }

setup() { export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"; mkdir -p "$ARC_SPINE_ROOT"; }

# A work-root must be the toplevel of its OWN repository, so the fixture makes one.
_own_repo() {
  local d="$BATS_TEST_TMPDIR/$1"
  mkdir -p "$d"
  git -C "$d" init -q
  # Repo-local identity, never subshell env: a clean CI runner has no global git identity and
  # fails 128 on the first commit, which is green locally and red on CI.
  git -C "$d" config user.email arc-test@example.invalid
  git -C "$d" config user.name arc-test
  echo "$d"
}

# ---------------------------------------------------------------------------
# The receipt: seat and payload are DIFFERENT fields and are read separately
# ---------------------------------------------------------------------------

@test "seam: with no flags the run is byte-identical to before - unpinned, source none" {
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(READ payload model)" = "unpinned" ] || { echo "payload.model=$(READ payload model)"; false; }
  [ "$(READ payload model_source)" = "none" ] || { echo "source=$(READ payload model_source)"; false; }
}

@test "seam: --trial-model sets the MP-F SEAT, read as the seat and not the payload copy" {
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-model claude-opus-5 --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # THE SEAT, not payload.model. An earlier version of this test greped and took the last match,
  # which is always the payload copy, so it asserted nothing about the seat at all.
  [ "$(READ seat)" = "claude-opus-5" ] || { echo "seat=$(READ seat)"; false; }
}

@test "seam: the seat is a clean model id, never tagged with its provenance" {
  # This is the one judgement call ADR-0220's amendment records, and it was previously untested:
  # a seat written `trial:claude-opus-5` would leave the payload copy clean and pass a grep.
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-model claude-opus-5 --root "$ARC_ROOT"
  [ "$status" -eq 0 ]
  [[ "$(READ seat)" != *":"* ]] || { echo "the seat carries a tag: $(READ seat)"; false; }
  [ "$(READ payload model_source)" = "trial" ] || { echo "source=$(READ payload model_source)"; false; }
}

# ---------------------------------------------------------------------------
# THE MUTANT KILLERS: observe the child process, not the receipt
# ---------------------------------------------------------------------------

@test "seam: the trial model REACHES THE DRIVER, proven by the driver acting on it" {
  # generic-api refuses to start unless it has an endpoint, a key AND a model, and it reads the
  # model from ARC_DRIVER_MODEL via pinnedModel(). Getting PAST that gate is only possible if the
  # flag actually reached the child's environment. The endpoint is a closed local port, so the run
  # fails at transport -- which is the positive marker that the model gate was cleared.
  ARC_LLM_ENDPOINT="http://127.0.0.1:1/v1" ARC_LLM_API_KEY="k" ARC_LLM_TIMEOUT_MS=2000 \
    run node "$(RUN)" --process commit-msg-draft --driver generic-api --trial-model claude-opus-5 --root "$ARC_ROOT"
  [[ "$output" == *"transport failed"* ]] || { echo "did not reach transport: $output"; false; }
  [[ "$output" != *"must all be set"* ]] || { echo "the model never reached the driver: $output"; false; }
}

@test "seam: NEGATIVE CONTROL without the flag the same driver fails AT the model gate" {
  # Proves the test above is not passing for an unrelated reason. Same command, no --trial-model.
  ARC_LLM_ENDPOINT="http://127.0.0.1:1/v1" ARC_LLM_API_KEY="k" ARC_LLM_TIMEOUT_MS=2000 \
    run node "$(RUN)" --process commit-msg-draft --driver generic-api --root "$ARC_ROOT"
  [[ "$output" == *"must all be set"* ]] || { echo "expected the model gate to refuse: $output"; false; }
}

@test "seam: an ambient ARC_DRIVER_MODEL is still ignored - b1 stays closed" {
  # THE HOLE THAT MUST STAY SHUT, and it is checked at the driver rather than at the receipt: if
  # the env var reached the child, generic-api would clear its model gate.
  ARC_DRIVER_MODEL="smuggled-via-env" ARC_LLM_ENDPOINT="http://127.0.0.1:1/v1" ARC_LLM_API_KEY="k" ARC_LLM_TIMEOUT_MS=2000 \
    run node "$(RUN)" --process commit-msg-draft --driver generic-api --root "$ARC_ROOT"
  [[ "$output" == *"must all be set"* ]] || { echo "an ambient env var reached the driver: $output"; false; }
}

@test "seam: an ambient ARC_LLM_MODEL is blanked, the other b1 door" {
  # engine/router.yaml names ARC_LLM_MODEL verbatim as the un-reviewed tier change b1 forbids, and
  # generic-api falls back to it. arc-run spreads process.env into the child, so it had to be
  # blanked explicitly or the seam would have closed one door and left its twin open.
  ARC_LLM_MODEL="smuggled-via-llm-env" ARC_LLM_ENDPOINT="http://127.0.0.1:1/v1" ARC_LLM_API_KEY="k" ARC_LLM_TIMEOUT_MS=2000 \
    run node "$(RUN)" --process commit-msg-draft --driver generic-api --root "$ARC_ROOT"
  [[ "$output" == *"must all be set"* ]] || { echo "ARC_LLM_MODEL reached the driver: $output"; false; }
}

@test "seam: an ambient ARC_MODEL never reaches the MP-F seat" {
  # arc-event reads `model: flags.model ?? (process.env.ARC_MODEL || null)`, and the emitter is a
  # child of arc-run, so an unblanked ARC_MODEL wrote an arbitrary model onto an append-only
  # receipt while model_source vouched that nothing had pinned it.
  ARC_MODEL="smuggled-opus-5" ARC_DRIVER_FAKE="$(FAKE good)" \
    run node "$(RUN)" --process commit-msg-draft --driver claude-code --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(READ seat)" = "NULL" ] || { echo "an env var reached the seat: $(READ seat)"; false; }
}

# ---------------------------------------------------------------------------
# A receipt may not vouch for a model that never ran
# ---------------------------------------------------------------------------

@test "seam: --trial-model is REFUSED on mock, which reaches no provider at all" {
  # Without this, a replay sweep could produce a full model-comparison table of models that never
  # ran, every row receipted `trial` -- for the one lane whose purpose is measuring models.
  run node "$(RUN)" --process commit-msg-draft --driver mock --trial-model claude-opus-5 --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"cannot apply a model"* ]] || { echo "$output"; false; }
  [ "$(READ payload model)" = "NO-RECEIPT" ] || { echo "a receipt was written despite the refusal"; false; }
}

@test "seam: --trial-model is REFUSED on codex, which never passes it to its CLI" {
  run node "$(RUN)" --process commit-msg-draft --driver codex --trial-model claude-opus-5 --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"cannot apply a model"* ]] || { echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# Never guess: the refusals
# ---------------------------------------------------------------------------

@test "seam: NEGATIVE CONTROL a trial may not override a routed TIER" {
  # The guard keys on the tier, not on the resolved pin: the tier IS the reviewed decision, and a
  # pin can be absent while that decision exists (the documented state for codex and generic-api).
  run node "$(RUN)" --process commit-msg-draft --driver auto --trial-model claude-opus-5 --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"conflicts with routed tier"* ]] || { echo "$output"; false; }
}

@test "seam: NEGATIVE CONTROL a malformed model id is refused before the driver starts" {
  run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-model 'not a model!' --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status"; false; }
  [[ "$output" == *"not a clean model id"* ]] || { echo "$output"; false; }
  [ "$(READ payload model)" = "NO-RECEIPT" ] || { echo "a run happened despite the refusal"; false; }
}

@test "seam: NEGATIVE CONTROL an empty flag value is an operator error, not an unset default" {
  # The dangerous direction: --trial-model "$M" with M unset previously ran PRODUCTION ROUTING
  # while the caller believed a trial ran, and --work-root "$W" with W unset aimed the driver at
  # the arc repo -- the exact accident the seam exists to prevent.
  run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-model "" --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  run node "$(RUN)" --process commit-msg-draft --driver mock --work-root "" --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2 for empty work-root, got $status: $output"; false; }
}

@test "seam: NEGATIVE CONTROL a repeated flag is an operator error, not last-wins" {
  run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-model a-model --trial-model b-model --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"given twice"* ]] || { echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# The workspace half
# ---------------------------------------------------------------------------

@test "seam: --work-root moves the driver cwd, proven by content only that tree has" {
  # THE DISCRIMINATING TEST. An earlier version copied arc's own recordings into the work-root, so
  # it passed just as well with the flag ignored -- arc still had them. Here the recording under
  # the work-root is MUTATED, and a relative ARC_MOCK_DIR resolves against the child's cwd, so the
  # marker can only come back if cwd actually moved.
  w="$(_own_repo work)"
  mkdir -p "$w/rec"
  cp -r "$ARC_ROOT/tests/fixtures/bench/mock-replay/." "$w/rec/"
  [ -f "$w/rec/commit-msg-draft/default.json" ] || { echo "fixture copy failed, the test would prove nothing"; false; }
  node "$ARC_ROOT/tests/fixtures/engine/mark-recording.mjs" "$w/rec" MARKER-FROM-WORK-ROOT

  ARC_MOCK_DIR="rec" run node "$(RUN)" --process commit-msg-draft --driver mock --work-root "$w" --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"MARKER-FROM-WORK-ROOT"* ]] || { echo "the driver did not run in the work-root: $output"; false; }
}

@test "seam: NEGATIVE CONTROL the same relative mock dir finds nothing without the flag" {
  # Proves the marker above came from the flag rather than from anything ambient.
  w="$(_own_repo work2)"
  mkdir -p "$w/rec"
  cp -r "$ARC_ROOT/tests/fixtures/bench/mock-replay/." "$w/rec/"
  ARC_MOCK_DIR="rec" run node "$(RUN)" --process commit-msg-draft --driver mock --root "$ARC_ROOT"
  [ "$status" -ne 0 ] || { echo "a relative mock dir resolved without --work-root: $output"; false; }
}

@test "seam: a REAL driver still resolves its process document from --root" {
  # The first version set ARC_ROOT to the work-root, and both real drivers then read their process
  # document -- the prompt body AND the tools list that becomes --allowedTools -- out of the target
  # tree. A target tree could widen its own grant, and neither real driver worked at all.
  w="$(_own_repo work3)"
  [ ! -d "$w/processes" ] || { echo "the work-root must NOT hold processes/ for this test to mean anything"; false; }
  ARC_DRIVER_FAKE="$(FAKE good)" run node "$(RUN)" --process commit-msg-draft --driver claude-code --work-root "$w" --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "the driver failed to resolve its process document from arc: $output"; false; }
  [[ "$output" == *"commits"* ]] || { echo "$output"; false; }
}

@test "seam: NEGATIVE CONTROL a work-root inside THIS repo is refused" {
  # git walks UPWARD from cwd, so a work-root beneath arc would have committed into arc's index --
  # moving cwd is not containment. This is the check that makes the flag mean what it claims.
  run node "$(RUN)" --process commit-msg-draft --driver mock --work-root "$ARC_ROOT/tests" --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"resolves to THIS repository"* ]] || { echo "$output"; false; }
}

@test "seam: NEGATIVE CONTROL a work-root that is not a repository is refused" {
  d="$BATS_TEST_TMPDIR/bare-dir"; mkdir -p "$d"
  run node "$(RUN)" --process commit-msg-draft --driver mock --work-root "$d" --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"not inside a git repository"* ]] || { echo "$output"; false; }
}

@test "seam: NEGATIVE CONTROL a work-root that is a FILE is refused" {
  f="$BATS_TEST_TMPDIR/afile"; printf 'x' > "$f"
  # existsSync alone passed a file, spawnSync then failed ENOENT with res.error discarded, and the
  # receipt blamed the DRIVER for the caller's flag.
  run node "$(RUN)" --process commit-msg-draft --driver mock --work-root "$f" --root "$ARC_ROOT"
  [ "$status" -eq 2 ] || { echo "expected exit 2, got $status: $output"; false; }
  [[ "$output" == *"is not a directory"* ]] || { echo "$output"; false; }
}

@test "seam: --dry-run names both new flags" {
  # The one surface whose job is telling you what will happen was silent about the two things that
  # change what happens.
  run node "$(RUN)" --process commit-msg-draft --driver claude-code --trial-model claude-opus-5 --dry-run --root "$ARC_ROOT"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"claude-opus-5"* ]] || { echo "dry-run hid the model: $output"; false; }
  [[ "$output" == *"source: trial"* ]] || { echo "dry-run hid the provenance: $output"; false; }
}

# ---------------------------------------------------------------------------

@test "suite: all 22 tests are REGISTERED and none is skipped" {
  # grep counts DECLARED tests; a dropped test leaves its line intact. `bats --count` reports what
  # was REGISTERED. Neither catches a `skip` inserted into a body -- the count stays put while the
  # test stops testing -- so the skip check is explicit.
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "22" ] || { echo "expected 22 REGISTERED, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but registered $registered"; false; }
  run grep -c "^[[:space:]]*skip" "$BATS_TEST_FILENAME"
  [ "$output" = "0" ] || { echo "a test in this file is skipped; coverage was removed without the count moving"; false; }
}

#!/usr/bin/env bats
# ADR-0226 -- the PR loop's attacker pass and CI read as governed engine work.
#
# What this file proves, and the mutant each test kills:
#   build-attack-input  rows in == rows out (a row-dropping condenser), classification declared,
#                       every refusal exits by name (a flag parser that falls through).
#   arc-attack          the mock driver end to end writes BOTH files on a diff past the 128 KB argv
#                       ceiling and the flat secret-scan ceiling (argv input, flat 200 cap); an unset
#                       trial model is a loud NOT RUN, never a faked run; a wrong-surface answer is
#                       refused; evidence is never overwritten.
#   generic-api         the request carries the process BODY (the Cycle 6 driver sent only the input).
#   claude-code         `tools: []` reaches the CLI as `--tools "" --strict-mcp-config` with the
#                       prompt on stdin (a refusal, an argv prompt, an --allowedTools line).
#   redact              the scaled ceiling passes a big clean text and still catches a planted key.
#   ci-digest           recorded gh JSON: green 0 · red 1 with a capped tail · pending 3 · mismatch 4.
#
# Every probe prints PROBE-RAN first and every CLI prints a positive marker, so each test asserts
# the code RAN before it asserts what it said (.claude/rules/testing.md, the vacuous pass).
bats_require_minimum_version 1.5.0
load 'test_helper'

PROBE() { echo "$ARC_ROOT/tests/engine-attack-probe.mjs"; }
MOCK="$ARC_ROOT/tests/fixtures/engine/attack-diff-mock"
MOCK_WRONG="$ARC_ROOT/tests/fixtures/engine/attack-diff-mock-wrong"
DIGEST="$ARC_ROOT/tests/fixtures/review/ci-digest"

# One throwaway repo per FILE: copying .claude/scripts per test is slow on the Windows leg.
# base commit = the machinery; HEAD = one change carrying a 300 KiB hex-dense file.
setup_file() {
  export REPO="$BATS_FILE_TMPDIR/repo"
  mkdir -p "$REPO/.claude" "$REPO/processes" "$REPO/engine"
  cp -r "$ARC_ROOT/.claude/scripts" "$REPO/.claude/"
  cp "$ARC_ROOT/processes/attack-diff.process.yaml" "$REPO/processes/"
  cp "$ARC_ROOT/engine/router.yaml" "$REPO/engine/"
  (
    cd "$REPO"
    git init -q
    # Repo-local identity: a clean CI runner has no global one, and a subshell-scoped
    # GIT_AUTHOR_* is not what `git commit` reads everywhere.
    git config user.email "attack@test.invalid"
    git config user.name "attack-test"
    git config core.autocrlf false
    git add -A && git commit -qm base
    printf -- '- **Flag fell through** — a.mjs (`abc1234`) — *refuse an unknown flag.*\n- **Wrapped\nrow** — b.mjs — *rule\ntwo.*\n\n## Heading\n\n- No bold here. Second sentence.\n' > fixed-defects.md
    node "$ARC_ROOT/tests/engine-attack-probe.mjs" bigfile big.mjs 300 >/dev/null
    git add -A && git commit -qm change
  )
}

setup() {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$ARC_SPINE_ROOT"
  unset ARC_ATTACK_TRIAL_MODEL
}

# ---------------------------------------------------------------------------
# build-attack-input
# ---------------------------------------------------------------------------

@test "condense: three rows in, three lines out, none empty -- a wrapped row stays one row" {
  run node "$(PROBE)" condense "$REPO/fixed-defects.md"
  [[ "$output" == *"PROBE-RAN condense"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ROWS=3 LINES=3 EMPTY=0"* ]] || { echo "$output"; false; }
  [[ "$output" == *"LINE Wrapped row -> rule two."* ]] || { echo "a wrapped row was split or lost: $output"; false; }
  [[ "$output" == *"LINE No bold here."* ]] || { echo "a row with no bold lead was dropped: $output"; false; }
}

@test "condense: an indented bullet is its own row, and a row in another marker shows as a count mismatch" {
  # Logic attack L3: column-0 detection folded an indented bullet into the row above (two defects
  # became one, the second's rule pinned to the first). rows == lines is true by construction, so
  # the independent list-item count is the only number that can notice a folded row.
  run node "$(PROBE)" condense "$ARC_ROOT/tests/fixtures/engine/attack-defects/indented.md"
  [[ "$output" == *"PROBE-RAN condense"* ]] || { echo "$output"; false; }
  [[ "$output" == *"ROWS=2 LINES=2 BULLETS=2"* ]] || { echo "$output"; false; }
  [[ "$output" == *"LINE Indented second -> rule two."* ]] || { echo "$output"; false; }
  run node "$(PROBE)" condense "$ARC_ROOT/tests/fixtures/engine/attack-defects/star-marker.md"
  [[ "$output" == *"ROWS=1 LINES=1 BULLETS=2"* ]] || { echo "the folded row was not visible in the counts: $output"; false; }
}

@test "build-attack-input: a list the condenser would fold is REFUSED, never carried short" {
  cd "$REPO"
  cp fixed-defects.md fd.keep
  cp "$ARC_ROOT/tests/fixtures/engine/attack-defects/star-marker.md" fixed-defects.md
  run --separate-stderr node .claude/scripts/engine/build-attack-input.mjs --base HEAD~1 --surface logic --out folded.json
  mv fd.keep fixed-defects.md
  [ "$status" -eq 2 ] || { echo "$status $output $stderr"; false; }
  [[ "$stderr" == *"2 list item(s) but 1 row(s)"* ]] || { echo "$stderr"; false; }
  [ ! -e folded.json ] || { echo "a short list was written"; false; }
}

@test "build-attack-input: writes the input with classification declared and every defect row carried" {
  cd "$REPO"
  run --separate-stderr node .claude/scripts/engine/build-attack-input.mjs --base HEAD~1 --surface logic --out in.json
  [ "$status" -eq 0 ] || { echo "$output $stderr"; false; }
  [[ "$output" == *"wrote in.json (logic,"* ]] || { echo "$output"; false; }
  [[ "$stderr" == *"3 row(s) in, 3 line(s) out"* ]] || { echo "$stderr"; false; }
  run node -e 'const d=JSON.parse(require("fs").readFileSync("in.json","utf8"));console.log(d.classification, d.surface, d.defect_patterns.split("\n").length, d.diff.includes("big.mjs"))'
  [ "$output" = "external-ok logic 3 true" ] || { echo "$output"; false; }
}

@test "build-attack-input: NEGATIVE CONTROL -- no fixed-defects.md says NONE loudly and carries an empty list" {
  cd "$REPO"
  mv fixed-defects.md fd.bak
  run --separate-stderr node .claude/scripts/engine/build-attack-input.mjs --base HEAD~1 --surface boundary --out in2.json
  mv fd.bak fixed-defects.md
  [ "$status" -eq 0 ] || { echo "$output $stderr"; false; }
  [[ "$stderr" == *"defect patterns: NONE"* ]] || { echo "the missing list was silent: $stderr"; false; }
  run node -e 'const d=JSON.parse(require("fs").readFileSync("in2.json","utf8"));console.log(JSON.stringify(d.defect_patterns))'
  [ "$output" = '""' ] || { echo "$output"; false; }
}

@test "build-attack-input: every operator error is refused by name" {
  cd "$REPO"
  run node .claude/scripts/engine/build-attack-input.mjs --base=HEAD~1 --surface logic --out x.json
  [ "$status" -eq 2 ] && [[ "$output" == *"separate argument"* ]] || { echo "--flag=value: $status $output"; false; }
  run node .claude/scripts/engine/build-attack-input.mjs --base -x --surface logic --out x.json
  [ "$status" -eq 2 ] && [[ "$output" == *"is not a revision"* ]] || { echo "leading dash: $status $output"; false; }
  run node .claude/scripts/engine/build-attack-input.mjs --base HEAD~1 --surface logic --out x.json --outt y
  [ "$status" -eq 2 ] && [[ "$output" == *"unknown argument"* ]] || { echo "near-miss flag: $status $output"; false; }
  run node .claude/scripts/engine/build-attack-input.mjs --base HEAD~1 --since HEAD~1 --surface logic --out x.json
  [ "$status" -eq 2 ] && [[ "$output" == *"exactly one of"* ]] || { echo "both refs: $status $output"; false; }
  run node .claude/scripts/engine/build-attack-input.mjs --base HEAD~1 --surface sideways --out x.json
  [ "$status" -eq 2 ] && [[ "$output" == *"--surface must be"* ]] || { echo "bad surface: $status $output"; false; }
  run node .claude/scripts/engine/build-attack-input.mjs --base HEAD --surface logic --out x.json
  [ "$status" -eq 6 ] && [[ "$output" == *"EMPTY"* ]] || { echo "empty diff: $status $output"; false; }
  [ ! -e x.json ]
}

# ---------------------------------------------------------------------------
# arc-attack
# ---------------------------------------------------------------------------

@test "arc-attack: the mock driver runs BOTH surfaces end to end on a 300 KiB diff and writes both files" {
  # Past the 128 KB single-argument ceiling and thousands of base64-shaped runs: before ADR-0226
  # this died at "Argument list too long" or "too many base64 candidates", whichever came first.
  cd "$REPO"
  run env ARC_MOCK_DIR="$MOCK" node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 1 --driver mock
  [[ "$output" == *"arc-attack @ "* ]] || { echo "never reached the summary: $output"; false; }
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local sha; sha=$(git rev-parse --short=7 HEAD)
  [ -f "docs/evidence/phase-01/attack-$sha-r1-logic.json" ] || { ls -R docs; false; }
  [ -f "docs/evidence/phase-01/attack-$sha-r1-boundary.json" ] || { ls -R docs; false; }
  [[ "$output" == *"L1 [medium]"* ]] || { echo "$output"; false; }
  run node -e 'const f=process.argv[1];const d=JSON.parse(require("fs").readFileSync(f,"utf8"));console.log(d.surface, d.findings.length)' "docs/evidence/phase-01/attack-$sha-r1-boundary.json"
  [ "$output" = "boundary 0" ] || { echo "$output"; false; }
}

@test "arc-attack: evidence is never overwritten, a partial round completes, round 2 needs one prior per surface" {
  cd "$REPO"
  run env ARC_MOCK_DIR="$MOCK" node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 2 --driver mock
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local sha; sha=$(git rev-parse --short=7 HEAD)
  local f="docs/evidence/phase-02/attack-$sha-r1-logic.json" g="docs/evidence/phase-02/attack-$sha-r1-boundary.json"
  local before; before=$(cat "$f")
  run env ARC_MOCK_DIR="$MOCK" node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 2 --driver mock
  [ "$status" -eq 2 ] && [[ "$output" == *"already recorded for both surfaces"* ]] || { echo "rerun: $status $output"; false; }
  [ "$(cat "$f")" = "$before" ]
  # A PARTIAL round (one surface failed last time) is completed by the same command, and the
  # surface that already succeeded is kept, not re-run (logic attack L2: it used to deadlock).
  rm "$g"
  run env ARC_MOCK_DIR="$MOCK" node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 2 --driver mock
  [ "$status" -eq 0 ] || { echo "partial rerun: $status $output"; false; }
  [[ "$output" == *"LOGIC: already recorded for round 1"* ]] || { echo "$output"; false; }
  [ -f "$g" ] || { echo "the missing surface was not completed"; false; }
  [ "$(cat "$f")" = "$before" ] || { echo "the recorded surface was overwritten"; false; }
  run env ARC_MOCK_DIR="$MOCK" node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 2 --round 2 --driver mock
  [ "$status" -eq 0 ] || { echo "round 2 with its prior: $status $output"; false; }
  run env ARC_MOCK_DIR="$MOCK" node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 3 --round 2 --driver mock
  [ "$status" -eq 2 ] && [[ "$output" == *"found 0"* ]] || { echo "round 2 with no prior: $status $output"; false; }
}

@test "arc-attack: an unset trial model is a loud NOT RUN and a non-zero exit, never a faked run" {
  cd "$REPO"
  # The boundary surface routes to claude-code; a CLI that does not exist makes it fail fast
  # without reaching any provider. The assertion is about the LOGIC surface.
  run env ARC_CLAUDE_CLI=definitely-not-a-real-cli node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 4
  [[ "$output" == *"arc-attack @ "* ]] || { echo "never reached the summary: $output"; false; }
  # EXACTLY 1, not merely non-zero: the boundary surface FAILED, and a failure outranks the logic
  # surface's NOT RUN (7). With max() arithmetic the 7 came first and hid the outage (logic attack L1).
  [ "$status" -eq 1 ] || { echo "expected 1 (a failed surface), got $status: $output"; false; }
  [[ "$output" == *"LOGIC: NOT RUN -- no trial model"* ]] || { echo "$output"; false; }
  [[ "$output" == *"BOUNDARY: RUN FAILED"* ]] || { echo "$output"; false; }
  [ ! -e "docs/evidence/phase-04/attack-$(git rev-parse --short=7 HEAD)-r1-logic.json" ] || { echo "a logic result was written for a run that never happened"; false; }
}

@test "arc-attack: a result that answers the wrong surface is refused and not written" {
  cd "$REPO"
  run env ARC_MOCK_DIR="$MOCK_WRONG" node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 5 --driver mock
  [[ "$output" == *"arc-attack @ "* ]] || { echo "$output"; false; }
  [ "$status" -eq 1 ] || { echo "$status $output"; false; }
  [[ "$output" == *"LOGIC: REFUSED -- asked for the logic surface"* ]] || { echo "$output"; false; }
  [ ! -e "docs/evidence/phase-05/attack-$(git rev-parse --short=7 HEAD)-r1-logic.json" ]
  # NEGATIVE CONTROL: the same run's boundary answer was right, and it WAS written.
  [ -e "docs/evidence/phase-05/attack-$(git rev-parse --short=7 HEAD)-r1-boundary.json" ]
}

@test "arc-attack: a newline inside a model finding cannot forge a line of output" {
  # Boundary attack B3: a `why` carrying "\n" printed a forged summary header and a forged finding.
  cd "$REPO"
  run env ARC_MOCK_DIR="$ARC_ROOT/tests/fixtures/engine/attack-diff-mock-newline" node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 7 --driver mock
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"real reason"* ]] || { echo "the finding was not printed at all: $output"; false; }
  local headers; headers=$(printf '%s\n' "$output" | grep -c '^BOUNDARY:')
  [ "$headers" -eq 1 ] || { echo "a forged BOUNDARY header got its own line ($headers): $output"; false; }
  ! printf '%s\n' "$output" | grep -q '^  B999' || { echo "a forged finding got its own line: $output"; false; }
}

@test "arc-attack: --driver names only mock; any other driver is refused before anything runs" {
  cd "$REPO"
  run node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 6 --driver codex
  [ "$status" -eq 2 ] && [[ "$output" == *"accepts only"* ]] || { echo "$status $output"; false; }
  [ ! -d docs/evidence/phase-06 ]
}

# ---------------------------------------------------------------------------
# drivers
# ---------------------------------------------------------------------------

@test "generic-api: the request carries the process body and the input, with the trial model" {
  run node "$(PROBE)" genapi "$ARC_ROOT" "$ARC_SPINE_ROOT"
  [[ "$output" == *"PROBE-RAN genapi"* ]] || { echo "$output"; false; }
  [[ "$output" == *"REQUEST=yes MODEL=probe-model-1"* ]] || { echo "no request reached the stand-in: $output"; false; }
  [[ "$output" == *"BODY_SENT=yes"* ]] || { echo "the attacker instructions were not sent: $output"; false; }
  [[ "$output" == *"INPUT_SENT=yes"* ]] || { echo "$output"; false; }
  [[ "$output" == *"PLACEHOLDER_SENT=no"* ]] || { echo "an unrendered {{input.X}} reached the model (L4): $output"; false; }
  [[ "$output" == *"EXIT=0"* ]] || { echo "$output"; false; }
}

@test "claude-code: the tool argv is one decision -- tools: [] is the CLI zero, a mapping gap still throws" {
  run node "$(PROBE)" tools
  [[ "$output" == *"PROBE-RAN tools"* ]] || { echo "$output"; false; }
  [[ "$output" == *'EMPTY=["--tools","","--strict-mcp-config"]'* ]] || { echo "$output"; false; }
  [[ "$output" == *'READ=["--allowedTools","Read"]'* ]] || { echo "$output"; false; }
  [[ "$output" == *"ASKHUMAN=THROW"* ]] || { echo "a list that renders to nothing was not refused: $output"; false; }
  [[ "$output" == *"NOTLIST=THROW"* ]] || { echo "$output"; false; }
  [[ "$output" == *"UNRESTRICTED=[]"* ]] || { echo "$output"; false; }
  # The driver uses THAT function and holds no second copy of the rule.
  run grep -c "dispatchToolArgs(doc)" "$ARC_ROOT/.claude/scripts/engine/drivers/claude-code.mjs"
  [ "$output" = "1" ]
  run grep -c "renderAllowedTools" "$ARC_ROOT/.claude/scripts/engine/drivers/claude-code.mjs"
  [ "$output" = "0" ]
}

@test "claude-code: the CLI receives an empty --tools and the prompt on STDIN, not argv (POSIX spy)" {
  case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) skip "execFileSync cannot run a shebang script as a CLI on Windows; the pure decision is pinned above" ;; esac
  local spy="$BATS_TEST_TMPDIR/claude-spy"
  cat > "$spy" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$SPY_DIR/argv"
cat > "$SPY_DIR/stdin"
printf '%s' '{"result":"{\"surface\":\"boundary\",\"findings\":[]}","usage":{"input_tokens":1,"output_tokens":1}}'
EOF
  chmod +x "$spy"
  export SPY_DIR="$BATS_TEST_TMPDIR"
  run env ARC_CLAUDE_CLI="$spy" SPY_DIR="$SPY_DIR" bash "$ARC_ROOT/.claude/scripts/engine/drivers/claude-code.sh" run attack-diff \
    '{"classification":"external-ok","surface":"boundary","diff":"+SPY-DIFF","defect_patterns":"","prior_findings":""}' ''
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -f "$SPY_DIR/argv" ] || { echo "the CLI never ran"; false; }
  grep -qx -- "--tools" "$SPY_DIR/argv"
  grep -qx -- "--strict-mcp-config" "$SPY_DIR/argv"
  ! grep -q -- "--allowedTools" "$SPY_DIR/argv" || { echo "an allowed-tools line reached a no-tools process"; cat "$SPY_DIR/argv"; false; }
  ! grep -q "SPY-DIFF" "$SPY_DIR/argv" || { echo "the prompt rode argv"; false; }
  grep -q "SPY-DIFF" "$SPY_DIR/stdin" || { echo "the prompt did not arrive on stdin"; false; }
  grep -q "You are a FRESH adversarial attacker" "$SPY_DIR/stdin"
}

@test "runDriver: input '-' is read from ARC_DRIVER_INPUT_FILE, and '-' with no file is a failure" {
  printf '%s' '{"surface":"logic"}' > "$BATS_TEST_TMPDIR/in.json"
  run env ARC_MOCK_DIR="$MOCK" ARC_MOCK_FIXTURE=logic ARC_DRIVER_INPUT_FILE="$BATS_TEST_TMPDIR/in.json" \
    bash "$ARC_ROOT/.claude/scripts/engine/drivers/mock.sh" run attack-diff - ''
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *'"surface":"logic"'* ]] || { echo "$output"; false; }
  run env -u ARC_DRIVER_INPUT_FILE ARC_MOCK_DIR="$MOCK" ARC_MOCK_FIXTURE=logic \
    bash "$ARC_ROOT/.claude/scripts/engine/drivers/mock.sh" run attack-diff - ''
  [ "$status" -ne 0 ] || { echo "a missing input file was not a failure: $output"; false; }
  [[ "$output" == *"ARC_DRIVER_INPUT_FILE is not set"* ]] || { echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# redact + ci-digest
# ---------------------------------------------------------------------------

@test "redact: the scaled ceiling passes a big clean text, still catches a planted key, refuses a bad cap" {
  run node "$(PROBE)" redact
  [[ "$output" == *"PROBE-RAN redact"* ]] || { echo "$output"; false; }
  [[ "$output" == *"CAP_SMALL=200"* ]] || { echo "$output"; false; }
  [[ "$output" == *"FLAT=THROW REDACT_FAIL"* ]] || { echo "the fixture is not past the flat ceiling, so it proves nothing: $output"; false; }
  [[ "$output" == *'SCALED={"hit":false}'* ]] || { echo "$output"; false; }
  [[ "$output" == *'PLANTED={"hit":true,"rule":"github-token"}'* ]] || { echo "the raised ceiling became a blind spot: $output"; false; }
  [[ "$output" == *"BADCAP=THROW REDACT_FAIL"* ]] || { echo "$output"; false; }
}

@test "ci-digest: recorded gh JSON -- green 0, red 1 with a 40-line tail, pending 3, mismatch 4" {
  run node "$(PROBE)" digest "$DIGEST/green"
  [[ "$output" == *"PROBE-RAN digest"* ]] && [[ "$output" == *"CODE=0"* ]] && [[ "$output" == *"GREEN: every job"* ]] || { echo "green: $output"; false; }

  run node "$(PROBE)" digest "$DIGEST/red"
  [[ "$output" == *"CODE=1"* ]] || { echo "red: $output"; false; }
  # The fixture log is 100 numbered lines plus two hostile ones (a bare CR, ANSI colour).
  [[ "$output" == *"last 40 of 102 failed-log line(s)"* ]] || { echo "$output"; false; }
  [[ "$output" == *"log line 100"* ]] && [[ "$output" == *"log line 63"* ]] || { echo "the tail is not the last 40: $output"; false; }
  [[ "$output" != *"log line 62"* ]] || { echo "the tail was not capped at 40: $output"; false; }
  # Round-2 attack B9: a CI log is untrusted. The bare CR must not let the log print a verdict of
  # its own at column 0, and colour codes must not reach the terminal.
  [[ "$output" == *"real failure RED: 999 job(s) failed."* ]] || { echo "the CR line was not flattened in place: $output"; false; }
  ! printf '%s\n' "$output" | grep -q '^OUT RED: 999' || { echo "a forged verdict got its own line: $output"; false; }
  [[ "$output" == *"OUT   red text"* ]] || { echo "the ANSI line was not printed plain: $output"; false; }
  [[ "$output" != *$'\033'* ]] || { echo "an escape byte reached the output"; false; }
  # A job still running does not hide one that already failed.
  [[ "$output" == *"✗ selftest (ubuntu-latest, 20)"* ]] || { echo "$output"; false; }

  run node "$(PROBE)" digest "$DIGEST/pending"
  [[ "$output" == *"CODE=3"* ]] && [[ "$output" == *"PENDING: jobs are still running"* ]] || { echo "pending: $output"; false; }

  run node "$(PROBE)" digest "$DIGEST/none"
  [[ "$output" == *"CODE=3"* ]] && [[ "$output" == *"no CI run exists yet"* ]] || { echo "none: $output"; false; }

  run node "$(PROBE)" digest "$DIGEST/mismatch"
  [[ "$output" == *"CODE=4"* ]] && [[ "$output" == *"SHA MISMATCH"* ]] || { echo "mismatch: $output"; false; }

  # The list was asked by SHA; the VIEW is checked by SHA too -- validate the read you use.
  run node "$(PROBE)" digest "$DIGEST/view-mismatch"
  [[ "$output" == *"CODE=4"* ]] && [[ "$output" == *"reports head 222222222222"* ]] || { echo "view-mismatch: $output"; false; }
}

@test "ci-digest: the CLI refuses a flag it does not read, and a --sha that is an option" {
  run node "$ARC_ROOT/.claude/scripts/review/ci-digest.mjs" --sha=HEAD
  [ "$status" -eq 2 ] && [[ "$output" == *"separate argument"* ]] || { echo "$status $output"; false; }
  run node "$ARC_ROOT/.claude/scripts/review/ci-digest.mjs" --sha -x
  [ "$status" -eq 2 ] && [[ "$output" == *"is not a revision"* ]] || { echo "$status $output"; false; }
  run node "$ARC_ROOT/.claude/scripts/review/ci-digest.mjs" --tail 500
  [ "$status" -eq 2 ] && [[ "$output" == *"--tail must be"* ]] || { echo "$status $output"; false; }
}

# ---------------------------------------------------------------------------
# round-2 fixes
# ---------------------------------------------------------------------------

@test "arc-attack: an evidence file that appeared after the preflight is never overwritten (wx)" {
  run node "$(PROBE)" evidence
  [[ "$output" == *"PROBE-RAN evidence"* ]] || { echo "$output"; false; }
  [[ "$output" == *"RACE_ERR=EEXIST KEPT=yes"* ]] || { echo "a late writer overwrote evidence: $output"; false; }
  # NEGATIVE CONTROL: the same write succeeds on a path nobody holds.
  [[ "$output" == *"FRESH_ERR=null WRITTEN=boundary"* ]] || { echo "$output"; false; }
}

@test "arc-attack: a truncated evidence file is reported, left in place, and not counted as attacked" {
  cd "$REPO"
  local sha; sha=$(git rev-parse --short=7 HEAD)
  mkdir -p docs/evidence/phase-10
  printf '{"surf' > "docs/evidence/phase-10/attack-$sha-r1-boundary.json"
  run env ARC_MOCK_DIR="$MOCK" node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 10 --driver mock
  [[ "$output" == *"arc-attack @ "* ]] || { echo "$output"; false; }
  [ "$status" -eq 1 ] || { echo "$status $output"; false; }
  [[ "$output" == *"exists but is not a valid result"* ]] || { echo "a cut-short file read as recorded: $output"; false; }
  [ "$(cat "docs/evidence/phase-10/attack-$sha-r1-boundary.json")" = '{"surf' ] || { echo "the file was touched"; false; }
  # NEGATIVE CONTROL: the other surface, with nothing on disk, still ran and was written.
  [ -f "docs/evidence/phase-10/attack-$sha-r1-logic.json" ]
}

@test "arc-attack: an ambiguous prior blocks only its own surface; the other still runs" {
  cd "$REPO"
  local sha; sha=$(git rev-parse --short=7 HEAD)
  mkdir -p docs/evidence/phase-11
  printf '{"surface":"logic","findings":[]}' > docs/evidence/phase-11/attack-aaaaaaa-r1-logic.json
  printf '{"surface":"logic","findings":[]}' > docs/evidence/phase-11/attack-bbbbbbb-r1-logic.json
  printf '{"surface":"boundary","findings":[]}' > docs/evidence/phase-11/attack-aaaaaaa-r1-boundary.json
  run env ARC_MOCK_DIR="$MOCK" node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 11 --round 2 --driver mock
  [[ "$output" == *"arc-attack @ "* ]] || { echo "$output"; false; }
  [ "$status" -eq 2 ] || { echo "$status $output"; false; }
  [[ "$output" == *"LOGIC: NOT RUN -- round 2 needs exactly one round-1 logic result"*"found 2"* ]] || { echo "$output"; false; }
  [ -f "docs/evidence/phase-11/attack-$sha-r2-boundary.json" ] || { echo "the unblocked surface did not run (L5): $output"; false; }
}

@test "arc-run and arc-attack: an unusable temp dir is a named failure with an exit code, never a stack" {
  local nowhere="$BATS_TEST_TMPDIR/no-such-dir"
  printf '%s' '{"classification":"external-ok","surface":"logic","diff":"x","defect_patterns":"","prior_findings":""}' > "$BATS_TEST_TMPDIR/in.json"
  cd "$REPO"
  run env TMPDIR="$nowhere" TMP="$nowhere" TEMP="$nowhere" ARC_MOCK_DIR="$MOCK" ARC_MOCK_FIXTURE=logic \
    node .claude/scripts/engine/arc-run.mjs --process attack-diff --driver mock --input "@$BATS_TEST_TMPDIR/in.json"
  [ "$status" -eq 1 ] || { echo "$status $output"; false; }
  [[ "$output" == *"could not prepare the driver input: no temp dir"* ]] || { echo "$output"; false; }
  [[ "$output" != *"    at "* ]] || { echo "a stack trace escaped: $output"; false; }
  run env TMPDIR="$nowhere" TMP="$nowhere" TEMP="$nowhere" ARC_MOCK_DIR="$MOCK" \
    node .claude/scripts/engine/arc-attack.mjs --base HEAD~1 --phase 12 --driver mock
  [ "$status" -eq 1 ] || { echo "$status $output"; false; }
  [[ "$output" == *"arc-attack: could not create a temp dir"* ]] || { echo "$output"; false; }
  [[ "$output" != *"    at "* ]] || { echo "a stack trace escaped: $output"; false; }
}

# LAST, and it must stay last. bats silently drops a @test it cannot register (a non-ASCII name was
# the Cycle 7 case), and a suite running fewer tests than it declares looks exactly like a pass.
@test "suite: every declared test in this file was registered and reached" {
  local declared; declared=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$declared" -ge 24 ] || { echo "declared=$declared"; false; }
  [ "$BATS_TEST_NUMBER" -eq "$declared" ] || { echo "registered index $BATS_TEST_NUMBER, declared $declared"; false; }
}

#!/usr/bin/env bats
# policy cycle 2, Phase 00 -- evidenced levels (POL-L; REQ-01, REQ-02, REQ-03; ADR-0509, ADR-0510).
#
# A configured level is not an evidenced level. The fold says, per (subject x capability) pair, when it last
# succeeded, was last refused correctly and was last audited, and a pair at effective L1+ on
# spend/publish/deploy/network/shell with no fresh typed refusal is BELOW-BAR.
#
# THE TRAP THIS SUITE IS BUILT AGAINST: a fold that reports EVERYTHING as BELOW-BAR passes every BELOW-BAR test.
# So every invariant has a positive control a broken fold cannot satisfy, and a named mutant -- a copy of the real
# module with one line changed -- that its fixture must KILL (ASSERT-FAILED, not a crash). The scenarios live in
# tests/fixtures/policy-evidence/scenarios.mjs so they run unchanged against the real fold and against each mutant.
#
# ASCII-only test names; the file asserts its own registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

FX="$BATS_TEST_DIRNAME/fixtures/policy-evidence"

# One sandbox copy of the scripts per file. Mutants are written INTO this copy (beside the module, so relative
# imports resolve), never into the repo tree.
setup_file() {
  export SB="$BATS_FILE_TMPDIR/sb"
  mkdir -p "$SB/.claude"
  cp -r "$BATS_TEST_DIRNAME/../.claude/scripts" "$SB/.claude/"
  [ -f "$SB/.claude/scripts/hq/lib/policy-evidence/fold.mjs" ] || { echo "sandbox copy has no fold.mjs"; return 1; }
}

FOLD_REL=".claude/scripts/hq/lib/policy-evidence/fold.mjs"
LOAD_REL=".claude/scripts/hq/lib/policy-evidence/load.mjs"

# Run a scenario against the REAL fold: it must say RAN and PASS.
_pass() {
  run node "$FX/scenarios.mjs" "$SB/$FOLD_REL" "$1"
  [[ "$output" == *"RAN $1"* ]] || { echo "scenario $1 never ran: $output"; return 1; }
  [ "$status" -eq 0 ] && [[ "$output" == *"PASS $1"* ]] || { echo "scenario $1 failed on the real fold: $output"; return 1; }
}

# Build mutant $2 of module $1 and run scenario $3 against it: it must be KILLED by an assertion, not by a crash.
_killed() {
  local mut
  mut="$(node "$FX/mutants.mjs" "$SB/$1" "$2")" || { echo "mutant $2 did not apply"; return 1; }
  [ -f "$mut" ] || { echo "mutant file missing: $mut"; return 1; }
  run node "$FX/scenarios.mjs" "$mut" "$3"
  [[ "$output" == *"RAN $3"* ]] || { echo "scenario $3 never ran against $2: $output"; return 1; }
  [[ "$output" == *"ASSERT-FAILED $3"* ]] || { echo "mutant $2 SURVIVED scenario $3: $output"; return 1; }
}

# ---------------------------------------------------------------- REQ-01: the fold ran, over every pair

@test "fold RAN: one cell per subject x capability" { _pass ran; }
@test "carriers: guard run is every cell last_audit, process run is its shell success" { _pass carriers; }
@test "no clock: Date.now and an argument-less Date throw and the fold still answers" { _pass noClock; }

# ---------------------------------------------------------------- REQ-02: BELOW-BAR and invariants (a)(b)

@test "invariant a: zero receipts is BELOW-BAR, never PASS" { _pass zeroReceipts; }
@test "invariant a: mutant M-a (absent stops counting) is killed" { _killed "$FOLD_REL" M-a zeroReceipts; }
@test "positive control: a fresh refusal clears the bar" { _pass freshControl; }
@test "invariant b: fresh at N, BELOW-BAR at N+1, byte-identical replays" { _pass dayBoundary; }
@test "invariant b: mutant M-b (age from the clock) is killed" { _killed "$FOLD_REL" M-b dayBoundary; }
@test "invariant b: mutant M-b2 (boundary one day early) is killed" { _killed "$FOLD_REL" M-b2 dayBoundary; }
@test "IST bucketing: 23:59:59 and 00:00:00 IST are different days" { _pass istBucketing; }
@test "IST bucketing: mutant M-utc is killed" { _killed "$FOLD_REL" M-utc istBucketing; }
@test "future events after as-of are ignored, never a negative age" { _pass future; }
@test "future events: mutant M-future is killed" { _killed "$FOLD_REL" M-future future; }
@test "a missing N is BELOW-BAR with reason no-bar-declared" { _pass noBarDeclared; }

# ---------------------------------------------------------------- REQ-03: attribution, and what does not count

@test "an inconsistent level is discarded" { _pass inconsistent; }
@test "inconsistent: mutant M-noforge is killed" { _killed "$FOLD_REL" M-noforge inconsistent; }
@test "an L0 refusal from before a promotion does not refresh the L1 pair" { _pass l0BeforePromotion; }
@test "L0 before promotion: mutant M-l0 is killed" { _killed "$FOLD_REL" M-l0 l0BeforePromotion; }
@test "a headless refusal with no gate incident behind it is unverified" { _pass unverifiedHeadless; }
@test "unverified headless: mutant M-ref is killed" { _killed "$FOLD_REL" M-ref unverifiedHeadless; }
@test "an interactive refusal before any interactive writer exists is forged" { _pass forgedBeforeWriter; }
@test "forged before writer: mutant M-writer is killed" { _killed "$FOLD_REL" M-writer forgedBeforeWriter; }
@test "prose is never parsed: an incident naming shell is not a refusal" { _pass proseIgnored; }
@test "corroboration positive control: incident first, same process, typed denial" { _pass corroborated; }
@test "an incident written after the refusal cannot vouch for it" { _pass incidentAfterRefusal; }
@test "incident order: mutant M-order is killed" { _killed "$FOLD_REL" M-order incidentAfterRefusal; }
@test "an incident whose typed denials miss the capability vouches for nothing" { _pass incidentWithoutDenial; }
@test "typed denials: mutant M-denials is killed" { _killed "$FOLD_REL" M-denials incidentWithoutDenial; }
@test "another version of the process is another process" { _pass versionMismatch; }
@test "process version: mutant M-version is killed" { _killed "$FOLD_REL" M-version versionMismatch; }
@test "an impossible as-of day is refused, never rolled over" { _pass invalidAsOf; }
@test "calendar days: mutant M-calendar is killed" { _killed "$FOLD_REL" M-calendar invalidAsOf; }
@test "a policy with no subject is refused, never a clean zero-cell reading" { _pass emptyPolicy; }
@test "at L1 a deny is attributed but never proves the propose path" { _pass l1DenyDoesNotQualify; }
@test "L1 deny: mutant M-l1deny is killed" { _killed "$FOLD_REL" M-l1deny l1DenyDoesNotQualify; }
@test "a receipt declaring the other surface cannot borrow its writer" { _pass surfaceMismatch; }
@test "surface: mutant M-surface is killed" { _killed "$FOLD_REL" M-surface surfaceMismatch; }
@test "a declared but unusable N reads invalid-bar, apart from no N" { _pass invalidBar; }

# ---------------------------------------------------------------- the profile on the spine (ADR-0509)

_emit() { # $1 payload json; emits note.logged into the per-test spine, strict
  bash "$ARC_ROOT/.claude/scripts/hq/arc-event.sh" emit note.logged --payload "$1" --strict --process demo@1.0.0 --outcome fail
}

@test "profile: a well-formed interactive refusal is accepted and lands in events" {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  run _emit '{"subject":"policy.refusal","action_kind":"session:interactive","capability":"shell","level":"L1","decision":"propose","surface":"interactive","reason":"fixture"}'
  [ "$status" -eq 0 ] || { echo "valid refusal refused: $output"; false; }
  grep -rq '"policy.refusal"' "$ARC_SPINE_ROOT/events/"*.jsonl || { echo "not in events/"; false; }
  ! grep -rqs '"policy.refusal"' "$ARC_SPINE_ROOT/events/_quarantine/" || { echo "landed in quarantine"; false; }
}

@test "profile: an unknown key is refused by name" {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  run _emit '{"subject":"policy.refusal","action_kind":"session:interactive","capability":"shell","level":"L1","decision":"propose","surface":"interactive","reason":"fixture","extra":1}'
  [ "$status" -ne 0 ] || { echo "an unknown key was accepted"; false; }
  [[ "$output" == *"BAD_POLICY_REFUSAL"* && "$output" == *"extra"* ]] || { echo "wrong refusal: $output"; false; }
}

@test "profile: a near-miss subject is refused, not exempted" {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  run _emit '{"subject":"Policy.Refusal ","action_kind":"session:interactive","capability":"shell","level":"L1","decision":"propose","surface":"interactive","reason":"fixture"}'
  [ "$status" -ne 0 ] || { echo "a near-miss subject was accepted"; false; }
  [[ "$output" == *"BAD_POLICY_REFUSAL"* ]] || { echo "wrong refusal: $output"; false; }
}

@test "profile: a headless refusal without incident_ref is refused" {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  run _emit '{"subject":"policy.refusal","action_kind":"process:demo","capability":"shell","level":"L0","decision":"deny","surface":"headless","reason":"fixture"}'
  [ "$status" -ne 0 ] || { echo "a headless refusal with no incident_ref was accepted"; false; }
  [[ "$output" == *"incident_ref"* ]] || { echo "wrong refusal: $output"; false; }
}

@test "profile: a Unicode line separator in the reason is refused" {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  grep -q 'u2028' "$FX/refusal-line-separator.json" || { echo "fixture lost its escape"; false; }
  run bash "$ARC_ROOT/.claude/scripts/hq/arc-event.sh" emit note.logged --payload-file "$FX/refusal-line-separator.json" --strict --process demo@1.0.0 --outcome fail
  [ "$status" -ne 0 ] || { echo "a U+2028 reason was accepted"; false; }
  [[ "$output" == *"BAD_POLICY_REFUSAL"* ]] || { echo "wrong refusal: $output"; false; }
}

@test "profile: 300 astral characters are 300 code points and are accepted" {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  run bash "$ARC_ROOT/.claude/scripts/hq/arc-event.sh" emit note.logged --payload-file "$FX/refusal-astral-300.json" --strict --process demo@1.0.0 --outcome fail
  [ "$status" -eq 0 ] || { echo "a 300-code-point reason was refused: $output"; false; }
}

@test "profile: a propose claimed at L2 is refused" {
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  run _emit '{"subject":"policy.refusal","action_kind":"session:interactive","capability":"shell","level":"L2","decision":"propose","surface":"interactive","reason":"fixture"}'
  [ "$status" -ne 0 ] || { echo "a propose at L2 was accepted"; false; }
}

@test "zero new kinds: no kind in the closed vocabulary names a refusal" {
  # cd + a relative import: a POSIX $ARC_ROOT inside a node program is red on the Windows leg only.
  run node "$FX/spine-probe.mjs" kinds "$ARC_ROOT/.claude/scripts/hq/lib/validate.mjs"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" =~ ^KINDS\ [0-9]+\ 0\ true$ ]] || { echo "vocabulary changed: $output"; false; }
}

# ---------------------------------------------------------------- the loader: shape is not integrity

@test "loader: a sealed line tampered in place is rejected, and mutant M-sha loads it" {
  local root="$BATS_TEST_TMPDIR/lroot"
  export ARC_SPINE_ROOT="$root/.claude/state/hq"
  run _emit '{"subject":"policy.refusal","action_kind":"session:interactive","capability":"shell","level":"L1","decision":"propose","surface":"interactive","reason":"original"}'
  [ "$status" -eq 0 ] || { echo "fixture emit failed: $output"; false; }
  local f; f="$(ls "$ARC_SPINE_ROOT/events/"*.jsonl | head -n 1)"
  [ -n "$f" ] || { echo "no day file"; false; }
  # Tamper: same shape, same sha, different reason. Valid to validateEvent; wrong to eventSha.
  sed 's/"reason":"original"/"reason":"tampered"/' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  grep -q '"tampered"' "$f" || { echo "tamper did not apply"; false; }
  run node "$FX/loader-probe.mjs" "$SB/$LOAD_REL" "$root"
  [ "$output" = "LOADED 0 REJECTED 1" ] || { echo "real loader: $output"; false; }
  local mut; mut="$(node "$FX/mutants.mjs" "$SB/$LOAD_REL" M-sha)" || { echo "M-sha did not apply"; false; }
  run node "$FX/loader-probe.mjs" "$mut" "$root"
  [ "$output" = "LOADED 1 REJECTED 0" ] || { echo "M-sha SURVIVED: $output"; false; }
}

@test "loader: a FIFO day file is skipped, never blocks the reader" {
  command -v mkfifo >/dev/null 2>&1 || skip "no mkfifo on this platform"
  local root="$BATS_TEST_TMPDIR/froot"; mkdir -p "$root/.claude/state/hq/events"
  mkfifo "$root/.claude/state/hq/events/2026-10-07.jsonl" 2>/dev/null || skip "mkfifo cannot make a FIFO here"
  [ -p "$root/.claude/state/hq/events/2026-10-07.jsonl" ] || skip "not a FIFO on this filesystem"
  run timeout 30 node "$FX/loader-probe.mjs" "$SB/$LOAD_REL" "$root"
  [ "$output" = "LOADED 0 REJECTED 1" ] || { echo "FIFO: status $status, output $output"; false; }
}

@test "loader: a symlinked day file is refused, not followed" {
  local root="$BATS_TEST_TMPDIR/sroot"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/real-spine"
  run _emit '{"subject":"policy.refusal","action_kind":"session:interactive","capability":"shell","level":"L1","decision":"propose","surface":"interactive","reason":"linked"}'
  [ "$status" -eq 0 ] || { echo "fixture emit failed: $output"; false; }
  mkdir -p "$root/.claude/state/hq/events"
  local f; f="$(ls "$ARC_SPINE_ROOT/events/"*.jsonl | head -n 1)"
  ln -s "$f" "$root/.claude/state/hq/events/2026-10-07.jsonl" 2>/dev/null || skip "no symlinks here"
  [ -L "$root/.claude/state/hq/events/2026-10-07.jsonl" ] || skip "ln made a copy, not a link, on this platform"
  run node "$FX/loader-probe.mjs" "$SB/$LOAD_REL" "$root"
  [ "$output" = "LOADED 0 REJECTED 1" ] || { echo "symlink followed: $output"; false; }
}

@test "loader: a copied day-file line counts once (idem dedupe)" {
  local root="$BATS_TEST_TMPDIR/droot"
  export ARC_SPINE_ROOT="$root/.claude/state/hq"
  run _emit '{"subject":"policy.refusal","action_kind":"session:interactive","capability":"shell","level":"L1","decision":"propose","surface":"interactive","reason":"once"}'
  [ "$status" -eq 0 ] || { echo "fixture emit failed: $output"; false; }
  local f; f="$(ls "$ARC_SPINE_ROOT/events/"*.jsonl | head -n 1)"
  cp "$f" "$ARC_SPINE_ROOT/events/2000-01-01.jsonl"
  run node "$FX/loader-probe.mjs" "$SB/$LOAD_REL" "$root"
  [ "$output" = "LOADED 1 REJECTED 0" ] || { echo "dedupe: $output"; false; }
}

# ---------------------------------------------------------------- END TO END: a real arc-run refusal becomes evidence

# The awk helper from policy-runwrapper.bats: the repo policy plus `process:denied` with write at L0, asserted.
_denying_policy() {
  awk '
    /^  "process:kickoff-plan":/ { print "  \"process:denied\":"; inblock = 1; next }
    /^  [^ ]/                    { inblock = 0 }
    inblock && /^    write:/     { print "    write: { level: L0 }"; next }
    { print }
  ' "$ARC_ROOT/hq.policy.yaml" > "$1"
  grep -q '"process:denied":' "$1" || { echo "fixture policy carries no process:denied kind"; return 1; }
  grep -A4 '"process:denied":' "$1" | grep -q 'write: { level: L0 }' || { echo "fixture policy does not deny process:denied/write"; return 1; }
}

# A governing root whose policy denies process:denied/write, with a marker driver and its own spine exported.
_e2e_root() {
  local d="$1"
  mkdir -p "$d/processes" "$d/.claude/state/hq"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  cat > "$d/processes/denied.process.yaml" <<'EOF'
name: denied
version: 1.0.0
permissions: declared
inputs: []
tools:
  - fs.write
output:
  type: object
EOF
  _denying_policy "$d/hq.policy.yaml" || return 1
  cat > "$d/.claude/scripts/engine/drivers/claude-code.sh" <<'EOF'
#!/usr/bin/env bash
echo "DRIVER-RAN" > "$(dirname "$0")/../../../../DRIVER-RAN.txt"
echo '{"ok":true}'
EOF
  chmod +x "$d/.claude/scripts/engine/drivers/claude-code.sh" 2>/dev/null || true
  export ARC_SPINE_ROOT="$d/.claude/state/hq"
}

@test "END TO END -- an arc-run refusal is a typed receipt the fold attributes" {
  # The governing policy root is derived from the module location, so the scripts are copied INTO the root whose
  # policy is under test; a --root pointing elsewhere would read the real policy and run unpoliced.
  local d="$BATS_TEST_TMPDIR/e2e"; _e2e_root "$d" || return 1

  run node "$d/.claude/scripts/engine/arc-run.mjs" --process denied --driver claude-code --root "$d"
  [[ "$output" != *"unpoliced"* ]] || { echo "the run was UNPOLICED -- the sandbox is not the governing root: $output"; false; }
  [[ "$output" == *"policy denied"* ]] || { echo "no policy denial: $output"; false; }
  [ ! -f "$d/DRIVER-RAN.txt" ] || { echo "the driver RAN despite the denial"; false; }

  # Read back from the spine DIRECTORY, never from the emitter's return value.
  run node "$FX/spine-probe.mjs" refusals "$d/.claude/state/hq/events"
  [[ "$output" =~ ^REFUSALS\ 1\ ([0-9A-Z]{26})\ INCIDENTS-WITH-DENIALS\ 1$ ]] || { echo "expected 1 refusal and 1 typed incident: $output"; false; }
  local rid="${BASH_REMATCH[1]}"
  ! grep -rqs '"policy.refusal"' "$d/.claude/state/hq/events/_quarantine/" || { echo "the refusal was quarantined"; false; }

  # A SECOND denied run the same IST day: its incident is written, its refusal is not (ADR-0509, attack r1 B3).
  run node "$d/.claude/scripts/engine/arc-run.mjs" --process denied --driver claude-code --root "$d"
  [[ "$output" == *"already sealed today"* ]] || { echo "the second run did not report the day bound: $output"; false; }
  run node "$FX/spine-probe.mjs" refusals "$d/.claude/state/hq/events"
  [[ "$output" == "REFUSALS 1 $rid INCIDENTS-WITH-DENIALS 2" ]] || { echo "day bound broken: $output"; false; }

  run node "$d/.claude/scripts/hq/policy-evidence.mjs" report --json
  [ "$status" -eq 0 ] || { echo "report failed: $output"; false; }
  printf '%s' "$output" > "$BATS_TEST_TMPDIR/report.json"
  run node "$FX/spine-probe.mjs" cell "$BATS_TEST_TMPDIR/report.json" process:denied write
  [ "$output" = "$rid n/a true" ] || { echo "attribution: got [$output], refusal $rid"; false; }
}

@test "day bound: a forged same-day refusal does not suppress the genuine receipt" {
  local d="$BATS_TEST_TMPDIR/e2e-forged"; _e2e_root "$d" || return 1
  # Schema-valid, sealed, and uncorroborated: its incident_ref names nothing.
  run bash "$d/.claude/scripts/hq/arc-event.sh" emit note.logged --payload '{"subject":"policy.refusal","action_kind":"process:denied","capability":"write","level":"L0","decision":"deny","surface":"headless","reason":"forged","incident_ref":"01K00000000000000000000000"}' --strict --process denied@1.0.0 --outcome fail
  [ "$status" -eq 0 ] || { echo "fixture forgery not sealed: $output"; false; }
  run node "$d/.claude/scripts/engine/arc-run.mjs" --process denied --driver claude-code --root "$d"
  [[ "$output" != *"already sealed today"* ]] || { echo "a forged line suppressed the genuine refusal: $output"; false; }
  run node "$FX/spine-probe.mjs" refusals "$d/.claude/state/hq/events"
  [[ "$output" =~ ^REFUSALS\ 2\  ]] || { echo "expected the forgery AND the genuine refusal: $output"; false; }
}

@test "writer: a run whose spine is not the canonical one writes no refusal, and says so" {
  local d="$BATS_TEST_TMPDIR/e2e-foreign"; _e2e_root "$d" || return 1
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/foreign-spine"
  run node "$d/.claude/scripts/engine/arc-run.mjs" --process denied --driver claude-code --root "$d"
  [[ "$output" == *"policy denied"* ]] || { echo "no denial: $output"; false; }
  [[ "$output" == *"policy.refusal NOT written"* ]] || { echo "the skipped refusal was silent: $output"; false; }
  ! grep -rqs '"policy.refusal"' "$BATS_TEST_TMPDIR/foreign-spine/events/" || { echo "a refusal landed on the foreign spine"; false; }
}

@test "check: the real policy today is 17 in scope and all BELOW-BAR on an empty spine" {
  # Not a pinned count of the live repo's levels -- it is derived: every in-scope cell at L1 with no writer.
  local d="$BATS_TEST_TMPDIR/chk"
  mkdir -p "$d/.claude/state/hq/events"
  cp -r "$ARC_ROOT/.claude/scripts" "$d/.claude/"
  cp "$ARC_ROOT/hq.policy.yaml" "$d/hq.policy.yaml"
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" check --as-of 2026-10-07
  [ "$status" -eq 3 ] || { echo "check should exit 3 on BELOW-BAR, got $status: $output"; false; }
  [[ "$output" =~ ([0-9]+)\ in\ scope,\ ([0-9]+)\ BELOW-BAR ]] || { echo "no summary line: $output"; false; }
  [ "${BASH_REMATCH[1]}" -gt 0 ] && [ "${BASH_REMATCH[1]}" = "${BASH_REMATCH[2]}" ] || { echo "in scope ${BASH_REMATCH[1]} vs BELOW-BAR ${BASH_REMATCH[2]}"; false; }
}

_root() { # $1 dir: a minimal governing root -- scripts, the real policy, an events dir
  mkdir -p "$1/.claude/state/hq/events"
  cp -r "$ARC_ROOT/.claude/scripts" "$1/.claude/"
  cp "$ARC_ROOT/hq.policy.yaml" "$1/hq.policy.yaml"
}

@test "root: a linked worktree is refused, never read as the canonical spine" {
  local d="$BATS_TEST_TMPDIR/wt"; _root "$d"
  printf 'gitdir: /somewhere/.git/worktrees/x\n' > "$d/.git"
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" check --as-of 2026-10-07
  [ "$status" -eq 2 ] && [[ "$output" == *"linked git worktree"* ]] || { echo "$status $output"; false; }
}

@test "root: a missing spine is refused, never read as an empty one" {
  local d="$BATS_TEST_TMPDIR/nospine"; _root "$d"
  rm -rf "$d/.claude/state/hq/events"
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" check --as-of 2026-10-07
  [ "$status" -eq 2 ] && [[ "$output" == *"no spine at"* ]] || { echo "$status $output"; false; }
}

@test "root: an ARC_SPINE_ROOT naming another spine is refused" {
  local d="$BATS_TEST_TMPDIR/elsewhere"; _root "$d"
  mkdir -p "$BATS_TEST_TMPDIR/other-spine/events"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/other-spine"
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" check --as-of 2026-10-07
  [ "$status" -eq 2 ] && [[ "$output" == *"ARC_SPINE_ROOT"* ]] || { echo "$status $output"; false; }
}

# ---------------------------------------------------------------- Phase 01: the guard (REQ-04, ADR-0511, invariant c)

# A governing root whose policy has NO in-scope cell (every shell/network L1 lowered to L0), or exactly ONE
# (session:interactive shell put back to L1). Two plain -e expressions: BSD sed has no alternation.
_guard_root() { # $1 dir, $2 clean|one
  local d="$1"; _root "$d"
  sed -e "s/^    shell: { level: L1 }$/    shell: { level: L0 }/" -e "s/^    network: { level: L1 }$/    network: { level: L0 }/" "$ARC_ROOT/hq.policy.yaml" > "$d/hq.policy.yaml"
  ! grep -qE "^    (shell|network): \{ level: L1 \}$" "$d/hq.policy.yaml" || { echo "fixture still holds an L1 shell/network grant"; return 1; }
  if [ "$2" = "one" ]; then
    awk '
      /^  "session:interactive":/ { inblock = 1 }
      /^  "process:/              { inblock = 0 }
      inblock && /^    shell: \{ level: L0 \}$/ { print "    shell: { level: L1 }"; next }
      { print }
    ' "$d/hq.policy.yaml" > "$d/hq.policy.yaml.tmp" && mv "$d/hq.policy.yaml.tmp" "$d/hq.policy.yaml"
    [ "$(grep -cE "^    (shell|network): \{ level: L1 \}$" "$d/hq.policy.yaml")" = "1" ] || { echo "fixture does not hold exactly one L1 cell"; return 1; }
  fi
  export ARC_SPINE_ROOT="$d/.claude/state/hq"
}

@test "guard: a policy with no in-scope cell is CLEAN, one run.completed, no approval" {
  local d="$BATS_TEST_TMPDIR/g-clean"; _guard_root "$d" clean || return 1
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" guard --as-of 2026-10-07
  [ "$status" -eq 0 ] && [[ "$output" == *"guard: CLEAN"* ]] || { echo "$status $output"; false; }
  run node "$FX/spine-probe.mjs" guard "$d/.claude/state/hq/events"
  [[ "$output" =~ ^RUNS\ 1\ APPROVALS\ 0\ LAST\ ok\  ]] || { echo "clean run receipts: $output"; false; }
}

@test "guard: one BELOW-BAR cell is NOT clean, one approval, run.completed partial" {
  local d="$BATS_TEST_TMPDIR/g-one"; _guard_root "$d" one || return 1
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" guard --as-of 2026-10-07
  [ "$status" -eq 3 ] && [[ "$output" == *"NOT CLEAN"* && "$output" == *"no-writer  session:interactive/shell"* ]] || { echo "$status $output"; false; }
  run node "$FX/spine-probe.mjs" guard "$d/.claude/state/hq/events"
  [[ "$output" =~ ^RUNS\ 1\ APPROVALS\ 1\ LAST\ partial\  ]] || { echo "receipts: $output"; false; }
}

@test "guard: an identical second run raises no new approval and is still not clean" {
  local d="$BATS_TEST_TMPDIR/g-twice"; _guard_root "$d" one || return 1
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" guard --as-of 2026-10-07
  [ "$status" -eq 3 ] || { echo "first: $status $output"; false; }
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" guard --as-of 2026-10-07
  [ "$status" -eq 3 ] && [[ "$output" == *"no new approval"* ]] || { echo "second: $status $output"; false; }
  run node "$FX/spine-probe.mjs" guard "$d/.claude/state/hq/events"
  [[ "$output" =~ ^RUNS\ 2\ APPROVALS\ 1\ LAST\ partial\  ]] || { echo "receipts: $output"; false; }
}

@test "invariant c: the guard is not clean with a BELOW-BAR cell, and mutant M-c is killed" {
  local d="$BATS_TEST_TMPDIR/g-real"; _guard_root "$d" one || return 1
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" guard --as-of 2026-10-07
  [ "$status" -eq 3 ] || { echo "the real guard reported clean with a BELOW-BAR cell: $output"; false; }
  local m="$BATS_TEST_TMPDIR/g-mut"; _guard_root "$m" one || return 1
  local mut; mut="$(node "$FX/mutants.mjs" "$m/.claude/scripts/hq/policy-evidence.mjs" M-c)" || { echo "M-c did not apply"; false; }
  run node "$mut" guard --as-of 2026-10-07
  [[ "$output" == *"guard: CLEAN"* ]] || { echo "M-c should have reported clean (so the fixture can kill it): $status $output"; false; }
}

@test "guard: its run.completed is every cell last_audit" {
  local d="$BATS_TEST_TMPDIR/g-audit"; _guard_root "$d" clean || return 1
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" guard
  [ "$status" -eq 0 ] || { echo "$status $output"; false; }
  run node "$FX/spine-probe.mjs" guard "$d/.claude/state/hq/events"
  local rid; rid="$(printf "%s" "$output" | awk '{print $NF}')"
  [ -n "$rid" ] && [ "$rid" != "-" ] || { echo "no guard run id: $output"; false; }
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" report --json
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  printf "%s" "$output" > "$BATS_TEST_TMPDIR/g-report.json"
  run node "$FX/spine-probe.mjs" audits "$BATS_TEST_TMPDIR/g-report.json"
  [ "$output" = "AUDITS $rid" ] || { echo "last_audit is not the guard run on every cell: $output vs $rid"; false; }
}

@test "guard: a run judged against an overridden --as-of is never an audit" {
  local d="$BATS_TEST_TMPDIR/g-override"; _guard_root "$d" clean || return 1
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" guard --as-of 2020-01-01
  [ "$status" -eq 0 ] || { echo "$status $output"; false; }
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" report --json
  printf "%s" "$output" > "$BATS_TEST_TMPDIR/o-report.json"
  run node "$FX/spine-probe.mjs" audits "$BATS_TEST_TMPDIR/o-report.json"
  [ "$output" = "AUDITS null" ] || { echo "an overridden run became an audit: $output"; false; }
}

@test "guard: an approval that sealed before a failed run.completed still dedupes the retry" {
  local d="$BATS_TEST_TMPDIR/g-half"; _guard_root "$d" one || return 1
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" guard --as-of 2026-10-07
  [ "$status" -eq 3 ] || { echo "first: $status $output"; false; }
  # Simulate the half failure: the approval is on the spine, the run.completed is not.
  local f; for f in "$d/.claude/state/hq/events/"*.jsonl; do grep -v '"run.completed"' "$f" > "$f.tmp"; mv "$f.tmp" "$f"; done
  run node "$FX/spine-probe.mjs" guard "$d/.claude/state/hq/events"
  [[ "$output" =~ ^RUNS\ 0\ APPROVALS\ 1 ]] || { echo "fixture did not build the half failure: $output"; false; }
  run node "$d/.claude/scripts/hq/policy-evidence.mjs" guard --as-of 2026-10-07
  [ "$status" -eq 3 ] && [[ "$output" == *"no new approval"* ]] || { echo "the retry stacked a second approval: $status $output"; false; }
}

@test "check: usage errors exit 2 and name the problem" {
  run node "$ARC_ROOT/.claude/scripts/hq/policy-evidence.mjs" check --as-of 07-10-2026
  [ "$status" -eq 2 ] && [[ "$output" == *"YYYY-MM-DD"* ]] || { echo "$status $output"; false; }
  run node "$ARC_ROOT/.claude/scripts/hq/policy-evidence.mjs" check --as-of 2026-02-30
  [ "$status" -eq 2 ] && [[ "$output" == *"real YYYY-MM-DD"* ]] || { echo "an impossible day was accepted: $status $output"; false; }
  run node "$ARC_ROOT/.claude/scripts/hq/policy-evidence.mjs" guess
  [ "$status" -eq 2 ] && [[ "$output" == *"unknown subcommand"* ]] || { echo "$status $output"; false; }
}

@test "suite count: every test registered (ASCII names)" {
  [ "${#BATS_TEST_NAMES[@]}" -eq 66 ] || { echo "registered ${#BATS_TEST_NAMES[@]}, expected 66"; false; }
}

#!/usr/bin/env bats
# shard-tests.mjs -- the CI test sharder.
#
# The failure mode worth testing is not "the shards are uneven". It is "a file lands in NO
# shard", because that turns a green CI into a lie: the suite reports success having never run
# part of itself, and nothing in the output says so. Every case below exists to make that
# impossible, or to prove a refusal is loud.

setup() {
  ARC_ROOT="$(cd "${BATS_TEST_DIRNAME}/.." && pwd)"
  SHARD="node $ARC_ROOT/.github/scripts/shard-tests.mjs"
  ALL="$(ls "$ARC_ROOT"/tests/*.bats | xargs -n1 basename | LC_ALL=C sort)"
  N_ALL="$(printf '%s\n' "$ALL" | wc -l | tr -d ' ')"
}

_union() { # $1 = total; prints every shard's files, sorted
  local n="$1" i
  for i in $(seq 1 "$n"); do $SHARD --index "$i" --total "$n"; done \
    | xargs -n1 basename | LC_ALL=C sort
}

# ---------- coverage: the guard that matters ----------

@test "every discovered .bats file lands in exactly one shard, for every shard count 1..12" {
  local n
  for n in 1 2 3 5 8 9 12; do
    run bash -c "$(declare -f _union); SHARD='$SHARD'; _union $n"
    [ "$status" -eq 0 ] || { echo "shard sweep failed at n=$n"; echo "$output"; false; }
    # union == discovered, and no duplicates (sort -u must not shrink it)
    [ "$(printf '%s\n' "$output" | wc -l | tr -d ' ')" -eq "$N_ALL" ] \
      || { echo "n=$n: union has $(printf '%s\n' "$output" | wc -l) files, expected $N_ALL"; false; }
    [ "$(printf '%s\n' "$output" | LC_ALL=C sort -u | wc -l | tr -d ' ')" -eq "$N_ALL" ] \
      || { echo "n=$n: a file appears in more than one shard"; false; }
    [ "$(printf '%s\n' "$output")" = "$ALL" ] \
      || { echo "n=$n: union differs from the discovered set"; false; }
  done
}

@test "shard count 1 returns the entire suite" {
  run bash -c "$SHARD --index 1 --total 1 | wc -l"
  [ "$status" -eq 0 ]
  [ "$(echo "$output" | tr -d ' ')" -eq "$N_ALL" ]
}

@test "more shards than files still places every file and never emits a duplicate" {
  local n=$(( N_ALL + 5 ))
  run bash -c "$(declare -f _union); SHARD='$SHARD'; _union $n"
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | LC_ALL=C sort -u | wc -l | tr -d ' ')" -eq "$N_ALL" ]
}

# ---------- determinism: two runners must compute the SAME packing ----------

@test "the packing is deterministic -- a second run assigns identical shards" {
  run bash -c "$SHARD --index 3 --total 9"
  local first="$output"
  run bash -c "$SHARD --index 3 --total 9"
  [ "$output" = "$first" ]
}

@test "determinism holds across every shard, not just one" {
  # Two runners disagreeing on the packing would double-run some files and skip others -- the
  # skip being the half nobody notices.
  run bash -c "$(declare -f _union); SHARD='$SHARD'; _union 9"
  local a="$output"
  run bash -c "$(declare -f _union); SHARD='$SHARD'; _union 9"
  [ "$output" = "$a" ]
}

# ---------- timings are ADVISORY, never a filter ----------

@test "a file with no measured timing is still placed, never skipped" {
  # This used to read the live repo and `skip` when every file happened to carry a timing --
  # which is exactly what happened once the four unweighted files were measured, so the case
  # silently stopped running at the moment the repo stopped demonstrating it. A test that
  # disappears when the codebase is tidy is not a test. Build the condition instead.
  local tmp="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$tmp/tests" "$tmp/.github/scripts"
  cp "$ARC_ROOT/.github/scripts/shard-tests.mjs" "$tmp/.github/scripts/"
  cp "$ARC_ROOT"/tests/*.bats "$tmp/tests/"
  # A timings file that knows about exactly one file. Every other .bats in the sandbox is
  # unmeasured and must still be placed, at _default_weight.
  printf '{"_default_weight": 16, "timings": {"shard-tests.bats": 49}}\n' > "$tmp/tests/shard-timings.json"

  local placed expected
  placed="$(for i in 1 2 3 4 5; do
    node "$tmp/.github/scripts/shard-tests.mjs" --index "$i" --total 5
  done | xargs -n1 basename | LC_ALL=C sort)"
  expected="$(ls "$tmp"/tests/*.bats | xargs -n1 basename | LC_ALL=C sort)"

  [ "$placed" = "$expected" ] || {
    echo "unmeasured files were dropped:"
    diff <(printf '%s\n' "$expected") <(printf '%s\n' "$placed") || true
    false
  }
  # And no duplicates: a file placed twice is a different lie from a file placed never.
  [ "$(printf '%s\n' "$placed" | wc -l)" -eq "$(printf '%s\n' "$placed" | sort -u | wc -l)" ]
}

@test "every .bats file in the repo carries a measured timing (balance, not coverage)" {
  # Unmeasured files are placed correctly -- the case above proves it -- but at
  # _default_weight 16, which is how #69 shipped a shard predicted at 132s that ran 270s:
  # lane-resolver.bats is 44 tests and was being counted as 16 seconds of work. Coverage is
  # unaffected either way, so this is a WARNING with a name, not a failure.
  local unmeasured
  unmeasured="$(node -e '
    const fs=require("fs");
    const t=JSON.parse(fs.readFileSync(process.argv[1]+"/tests/shard-timings.json","utf8")).timings;
    const f=fs.readdirSync(process.argv[1]+"/tests").filter(x=>x.endsWith(".bats"));
    process.stdout.write(f.filter(x=>!(x in t)).join(" "));
  ' "$ARC_ROOT")"
  if [ -n "$unmeasured" ]; then
    echo "WARN: no timing for: $unmeasured"
    echo "WARN: these pack at _default_weight and will unbalance the matrix if they are heavy."
    echo "WARN: harvest real numbers from any run's 'shard-timing:' lines."
  fi
  # Deliberately never fails: a new test file must not be blocked on a measurement run.
  true
}

@test "an unreadable timings file degrades to equal weights, never to a refusal" {
  # Balance is a nice-to-have; running the suite is not. A corrupt advisory file must cost
  # speed, never coverage.
  local tmp="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$tmp/tests" "$tmp/.github/scripts"
  cp "$ARC_ROOT/.github/scripts/shard-tests.mjs" "$tmp/.github/scripts/"
  cp "$ARC_ROOT"/tests/*.bats "$tmp/tests/"
  printf 'not json at all {{{\n' > "$tmp/tests/shard-timings.json"
  run bash -c "node '$tmp/.github/scripts/shard-tests.mjs' --index 1 --total 4"
  [ "$status" -eq 0 ]
  [ -n "$output" ]
}

# ---------- refusals are loud ----------

@test "refuses a zero, negative or non-numeric --total" {
  local bad
  for bad in 0 -3 abc; do
    run bash -c "$SHARD --index 1 --total $bad"
    [ "$status" -ne 0 ] || { echo "--total $bad was accepted"; false; }
    [[ "$output" == *"--total"* ]]
  done
}

@test "refuses an --index outside 1..total, at both ends" {
  run bash -c "$SHARD --index 0 --total 4"
  [ "$status" -ne 0 ]
  run bash -c "$SHARD --index 5 --total 4"
  [ "$status" -ne 0 ]
  [[ "$output" == *"--index"* ]]
}

@test "refuses when the tests dir holds no .bats files (never emits empty shards)" {
  local tmp="$BATS_TEST_TMPDIR/empty"
  mkdir -p "$tmp/tests" "$tmp/.github/scripts"
  cp "$ARC_ROOT/.github/scripts/shard-tests.mjs" "$tmp/.github/scripts/"
  run bash -c "node '$tmp/.github/scripts/shard-tests.mjs' --index 1 --total 3"
  [ "$status" -ne 0 ]
  [[ "$output" == *"no *.bats"* ]] || [[ "$output" == *"refusing"* ]]
}

# ---------- balance: the reason the thing exists ----------

@test "--plan balances by measured seconds, not by file count" {
  run bash -c "$SHARD --plan --total 9"
  [ "$status" -eq 0 ]
  # The heaviest single file (design-steel-thread) is a hard floor: no shard can beat it. What
  # this asserts is that the sharder gets NEAR that floor rather than splitting by count, which
  # would leave one shard carrying several heavy files.
  local heaviest
  heaviest="$(printf '%s\n' "$output" | tail -1 | grep -oE 'heaviest shard [0-9]+s' | grep -oE '[0-9]+')"
  [ -n "$heaviest" ]
  [ "$heaviest" -le 200 ] || { echo "heaviest shard is ${heaviest}s -- balancing has regressed"; false; }
}

# ---------- one level down: a TEST that never runs ----------
# Same lie as a file landing in no shard, one layer deeper. On 2026-07-30 two `@test`
# names in lane-resolver.bats contained U+2014. bats builds a shell function identifier
# out of a test's NAME (bats_encode_test_name); under the C locale bash walks bytes, the
# multibyte dash mangles into an invalid identifier, the lookup misses, and the test is
# simply absent from the TAP stream. The build went red -- but its only explanation was a
# `# bats warning:` comment among 91 `ok` lines, which reads as flake. CI now reconciles
# executed-vs-declared counts on every leg; this catches it at the authoring site instead,
# with a file, a line and a codepoint. Bodies are safe: bats emits them verbatim and only
# the name becomes an identifier.

@test "every @test name is pure ASCII (a non-ASCII name silently does not run)" {
  local hits
  hits="$(cd "$ARC_ROOT" && grep -nE '^[[:blank:]]*@test[[:blank:]]' tests/*.bats \
            | LC_ALL=C grep -n '[^ -~]' || true)"
  [ -z "$hits" ] || {
    echo "Non-ASCII in a @test NAME -- bats cannot encode it into a function identifier"
    echo "under a C locale, and the test vanishes from the run. Use plain ASCII:"
    echo "$hits"
    false
  }
}

@test "no .bats file hides in a subdirectory (invisible to every shard)" {
  # The sharder discovers with a flat readdirSync, so a nested file is never seen -- and
  # its own "landed in no shard" refusal cannot fire for a file it never discovered. Only the
  # ubuntu legs still run `bats -r`; macOS is sharded now too, so a nested file would be absent
  # from all 12 windows shards AND both macOS shards. Ubuntu alone would run it, which makes
  # this test the guard rather than the matrix.
  local nested
  nested="$(cd "$ARC_ROOT" && find tests -mindepth 2 -name '*.bats' | LC_ALL=C sort || true)"
  [ -z "$nested" ] || {
    echo "These run under 'bats -r' but are invisible to the sharder:"; echo "$nested"; false
  }
}

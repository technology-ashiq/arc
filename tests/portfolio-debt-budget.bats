#!/usr/bin/env bats
# Debt budget in kickoff-lint -- portfolio Cycle 5, Phase 05, REQ-07 (ADR-0076, ADR-0078).
#
# A NEW cycle for a lane whose debt-ledger.md holds more than 20 open rows must carry a phase whose
# capability starts `Debt:`, sized at >= 20% of the PROGRESS `appetite:`, naming the open rows it closes
# as `debt #<id>`. Ledgers are written by the tests in each of the six header grammars real lanes use,
# so nothing here depends on any live lane's debt.
#
# Every case asserts the lint RAN (lane echo first); every silent case has a positive control beside it.
bats_require_minimum_version 1.5.0
load 'test_helper'

LINT="$ARC_ROOT/.claude/scripts/plan/kickoff-lint.mjs"
FIXTURE="$ARC_ROOT/tests/fixtures/kickoff-lint/good"
DIST_HDR='| # | Source | Finding | Disposition | Reopen when |'

teardown() { _arc_teardown; }

# A repo with lane `x` at Cycle 1 on branch `base`; the working tree opens Cycle 2 with a 10d appetite.
_repo() {
  _arc_lane_sandbox
  cp -r "$FIXTURE/docs" "$SANDBOX/docs"
  D="$SANDBOX/initiatives/x"
  mkdir -p "$D"
  cp "$FIXTURE/PLAN.md" "$D/"
  cp -r "$FIXTURE/phases" "$D/"
  _progress "arc-x (Cycle 1)"
  git add -A && git commit -qm base && git branch -q base
  _progress "arc-x (Cycle 2, opened 2026-10-14)"
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/no-spine"
}
_progress() { printf 'status: LIVE\ncycle: %s\nphase: 0\nappetite: 10d\nburn: 0d\n\n%s\n' "$1" "$(cat "$FIXTURE/PROGRESS.md")" > "$D/PROGRESS.md"; }

# _ledger HEADER OPEN CLOSED [IDSTYLE] -- OPEN open rows then CLOSED rows led by "fixed".
# IDSTYLE "hash" numbers the first column 1..N; "none" writes a first column of prose.
_ledger() {
  local hdr="$1" open="$2" closed="$3" style="${4:-hash}" ncol i row
  ncol=$(printf '%s' "$hdr" | awk -F'|' '{print NF-2}')
  { printf '# Debt ledger\n\n%s\n' "$hdr"
    printf '|'; for ((i = 0; i < ncol; i++)); do printf -- '---|'; done; printf '\n'
    for ((i = 1; i <= open + closed; i++)); do
      if [ "$style" = hash ]; then row="| $i"; else row="| item $i"; fi
      local c
      for ((c = 2; c <= ncol; c++)); do
        if [ "$c" -eq "$ncol" ] && [ "$i" -gt "$open" ]; then row="$row | fixed in PR 9"; else row="$row | cell $c of $i"; fi
      done
      printf '%s |\n' "$row"
    done
  } > "$D/debt-ledger.md"
  [ "$(grep -c '^| ' "$D/debt-ledger.md")" -eq $((open + closed + 1)) ]
}

# _debt_phase CAPABILITY APPETITE -- rewrite phase 1 of the plan's phase table.
_debt_phase() {
  awk -v cap="$1" -v app="$2" 'index($0, "| 1 | Real DB + health endpoint |") == 1 { print "| 1 | " cap " | " app " |"; next } { print }' \
    "$D/PLAN.md" > "$D/PLAN.tmp" && mv "$D/PLAN.tmp" "$D/PLAN.md"
  grep -qF "| 1 | $1 |" "$D/PLAN.md"
}

_lint() { run node "$LINT" "$SANDBOX" --lane x --base base; }
_ran() { [ "$(printf '%s\n' "$output" | head -n1)" = "Selected lane: x (via arg)" ]; }

# ---------- the threshold ----------

@test "debt: 21 open rows and no Debt: phase refuses, printing the count, the size and open ids" {
  _repo
  _ledger "$DIST_HDR" 21 0
  _lint
  _ran
  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL  [debt-budget] lane x has 21 open debt rows (> 20) in debt-ledger.md"* ]]
  [[ "$output" == *">= 2d (20% of 10d; found 0d)"* ]]
  [[ "$output" == *"first open ids: 1, 2, 3, 4, 5"* ]]
}

@test "debt: exactly 20 open rows needs no budget, and one more open row does" {
  _repo
  _ledger "$DIST_HDR" 20 5
  _lint
  _ran
  [[ "$output" != *"[debt-budget]"* ]]
  _ledger "$DIST_HDR" 21 4
  _lint
  [ "$status" -eq 1 ]
  [[ "$output" == *"[debt-budget] lane x has 21 open"* ]]
}

# ---------- the budget ----------

@test "debt: a Debt: phase at 19% refuses; at 20% naming an open row passes" {
  _repo
  _ledger "$DIST_HDR" 21 0
  _debt_phase "Debt: close debt #3" "1.9 days"
  _lint
  _ran
  [ "$status" -eq 1 ]
  [[ "$output" == *"found 1.9d"* ]]
  _debt_phase "Debt: close debt #3" "2 days"
  _lint
  _ran
  [[ "$output" != *"[debt-budget]"* ]]
}

@test "debt: a Debt: phase that names no row refuses" {
  _repo
  _ledger "$DIST_HDR" 21 0
  _debt_phase "Debt: pay down the ledger" "3 days"
  _lint
  _ran
  [ "$status" -eq 1 ]
  [[ "$output" == *"[debt-budget] lane x has 21 open"* ]]
}

@test "debt: naming a closed row or a row that does not exist refuses, by id" {
  _repo
  _ledger "$DIST_HDR" 21 3
  _debt_phase "Debt: close debt #3, debt #23 and debt #99" "2 days"
  _lint
  _ran
  [ "$status" -eq 1 ]
  [[ "$output" == *"debt #23 is already closed"* ]]
  [[ "$output" == *"debt #99 names no row"* ]]
  [[ "$output" != *"debt #3 "* ]]
}

# ---------- what "open" means ----------

@test "debt: a leading closing word closes a row; 'mitigated, not closed' stays open" {
  _repo
  _ledger "$DIST_HDR" 22 0
  _lint
  _ran
  [[ "$output" == *"[debt-budget] lane x has 22 open"* ]]
  awk 'NR==5 {sub(/cell 4 of 1/, "**Closed** 2026-10-01")} NR==6 {sub(/cell 4 of 2/, "mitigated, not closed")} {print}'     "$D/debt-ledger.md" > "$D/l.tmp" && mv "$D/l.tmp" "$D/debt-ledger.md"
  grep -qF "**Closed** 2026-10-01" "$D/debt-ledger.md"
  grep -qF "mitigated, not closed" "$D/debt-ledger.md"
  _lint
  _ran
  [ "$status" -eq 1 ]
  [[ "$output" == *"[debt-budget] lane x has 21 open"* ]]
  awk 'NR==7 {sub(/cell 4 of 3/, "`resolved` upstream")} {print}' "$D/debt-ledger.md" > "$D/l.tmp" && mv "$D/l.tmp" "$D/debt-ledger.md"
  grep -qF "resolved" "$D/debt-ledger.md"
  _lint
  _ran
  [[ "$output" != *"[debt-budget]"* ]]
  [[ "$output" == *"all checks passed"* ]] || [ "$status" -eq 0 ]
}

@test "debt: a wholly struck first cell closes a row" {
  _repo
  _ledger "$DIST_HDR" 21 0
  _lint
  [[ "$output" == *"[debt-budget] lane x has 21 open"* ]]
  awk 'NR==8 {sub(/^\| 4 \|/, "| ~~4~~ |")} {print}' "$D/debt-ledger.md" > "$D/l.tmp" && mv "$D/l.tmp" "$D/debt-ledger.md"
  grep -qF "| ~~4~~ |" "$D/debt-ledger.md"
  _lint
  _ran
  [[ "$output" != *"[debt-budget]"* ]]
}

@test "debt: ids come from the # column, else a D-ordinal across the file" {
  _repo
  _ledger '| what | where | why accepted | cost of leaving it | pay-down trigger |' 21 0 none
  _debt_phase "Debt: close debt #D2" "2 days"
  _lint
  _ran
  [[ "$output" != *"[debt-budget]"* ]]
  _debt_phase "Debt: close debt #2" "2 days"
  _lint
  [ "$status" -eq 1 ]
  [[ "$output" == *"debt #2 names no row"* ]]
}

# ---------- the six real header grammars ----------

@test "debt: every real ledger grammar is read (distribute, org, policy, launch, design/face, discover)" {
  local h
  for h in \
    '| # | Source | Finding | Disposition | Reopen when |' \
    '| # | Opened | Item | Why not now | Closes when |' \
    '| # | Opened | Finding | Why not now | Reopens when |' \
    '| # | From | Debt | Trigger |' \
    '| what | where | why accepted | cost of leaving it | pay-down trigger |' \
    '| Finding | Where | Why deferred | Paid when |'; do
    _repo
    _ledger "$h" 21 1
    _lint
    _ran
    [ "$status" -eq 1 ]
    [[ "$output" == *"[debt-budget] lane x has 21 open"* ]]
    _ledger "$h" 20 2
    _lint
    [[ "$output" != *"[debt-budget]"* ]]
    _arc_teardown
  done
}

# ---------- only a NEW cycle is judged ----------

@test "debt: a lane mid-cycle is never judged, however deep its debt" {
  _repo
  _ledger "$DIST_HDR" 40 0
  _progress "arc-x (Cycle 1, amended)"
  _lint
  _ran
  [[ "$output" != *"[debt-budget]"* ]]
  _progress "arc-x (Cycle 2)"
  _lint
  [ "$status" -eq 1 ]
  [[ "$output" == *"[debt-budget] lane x has 40 open"* ]]
}

@test "debt: an appetite the header does not state in days refuses rather than guessing a size" {
  _repo
  _ledger "$DIST_HDR" 21 0
  awk '!d && /^appetite:/ {print "appetite: two weeks"; d=1; next} {print}' "$D/PROGRESS.md" > "$D/p.tmp" && mv "$D/p.tmp" "$D/PROGRESS.md"
  _lint
  _ran
  [ "$status" -eq 1 ]
  [[ "$output" == *"no readable \`appetite:\` in days"* ]]
}

# ---------- the merge-time twin is real (plan attack finding 6) ----------

@test "debt: on this CI checkout the base resolves, so the new-cycle gates actually run" {
  cd "$ARC_ROOT"
  if ! git rev-parse --verify --quiet origin/main >/dev/null; then
    git fetch -q --depth=1 origin main:refs/remotes/origin/main
  fi
  git rev-parse --verify --quiet origin/main >/dev/null
  run node "$LINT" "$ARC_ROOT" --lane portfolio --base origin/main
  [ "$(printf '%s\n' "$output" | head -n1)" = "Selected lane: portfolio (via arg)" ]
  [[ "$output" != *"[new-cycle-unknown]"* ]]
}

@test "debt: no lane on this PR opens a cycle over its debt budget (the merge-time gate)" {
  cd "$ARC_ROOT"
  if ! git rev-parse --verify --quiet origin/main >/dev/null; then
    git fetch -q --depth=1 origin main:refs/remotes/origin/main
  fi
  local l ran=0 bad=""
  for l in $(ls initiatives); do
    [ -f "initiatives/$l/PROGRESS.md" ] || continue
    run node "$LINT" "$ARC_ROOT" --lane "$l" --base origin/main
    [ "$(printf '%s\n' "$output" | head -n1)" = "Selected lane: $l (via arg)" ] || { bad="$bad $l(no-run)"; continue; }
    ran=$((ran + 1))
    [[ "$output" == *"[new-cycle-unknown]"* ]] && bad="$bad $l(base-unknown)"
    [[ "$output" == *"FAIL  [debt-budget]"* ]] && bad="$bad $l(debt-budget)"
  done
  echo "linted=$ran bad=[$bad]"
  [ "$ran" -gt 10 ]
  [ -z "$bad" ]
}

@test "debt: this suite registers every case it declares" {
  n=$(grep -c '^@test ' "$BATS_TEST_FILENAME")
  [ "$n" -eq 14 ]
  [ "$BATS_TEST_NUMBER" -eq 14 ]
}

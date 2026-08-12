#!/usr/bin/env bats
# kickoff-lint suite — Rounds 1–4 checks (G1 backfill), v3 groups, v3.5 substance groups.
# Fixture: tests/fixtures/kickoff-lint/good (complete v3 plan; per-test mutations).
# v3.5 substance groups run WARN-first ([trial]) — their tests assert WARN + exit 0.
# PORTABILITY: macOS CI leg = BSD userland (ci.yml/ADR-0007). No GNU-only sed here:
# in-place edits go through sedi() (-i.bak works on GNU *and* BSD), row inserts go
# through addrow() (POSIX awk; BSD sed's a\/i\ syntax differs from GNU's inline form).

LINT_CMD="node .claude/scripts/plan/kickoff-lint.mjs"
FIXTURE="tests/fixtures/kickoff-lint/good"

setup() {
  TMP="$BATS_TEST_TMPDIR/fix"
  cp -r "$FIXTURE" "$TMP"
}

# Portable in-place sed: BSD needs a suffix after -i; `-i.bak` (no space) satisfies both.
sedi() {
  local f="${!#}"
  sed -i.bak "$@" && rm -f "${f}.bak"
}

# Insert ROW after the first line containing PAT (plain substring, no regex traps).
addrow() {
  local pat="$1" row="$2" f="$3"
  awk -v pat="$pat" -v row="$row" '{ print } !done && index($0, pat) { print row; done=1 }' \
    "$f" > "$f.tmp" && mv "$f.tmp" "$f"
}

# ---------- baseline ----------

@test "good v3 fixture passes with zero trial warnings" {
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]
  [[ "$output" != *"[trial]"* ]]
}

# ---------- v3 groups (Round 5) ----------

@test "[tier] S tier with 6 active REQs fails cap" {
  sedi 's/^\*\*Tier:\*\* M$/**Tier:** S/' "$TMP/PLAN.md"
  for i in 3 4 5 6; do
    addrow "| REQ-02 " "| REQ-0$i | outcome $i | check $i returns 200 in < 300ms | 1 | active |" "$TMP/PLAN.md"
  done
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[tier]"* ]]
}

@test "[tier] placeholder 'S | M | L' fails" {
  sedi 's/^\*\*Tier:\*\* M$/**Tier:** S | M | L/' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[tier]"* ]]
}

@test "[adr] missing Reversibility fails on v3 plan" {
  sedi '/^\*\*Reversibility:\*\*/d' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[adr]"* ]]
}

@test "[adr] one-way without real Revisit trigger fails" {
  sedi 's/^\*\*Revisit trigger:\*\*.*/**Revisit trigger:** <condition>/' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[adr]"* ]]
}

@test "[phase-deps] self-cycle fails" {
  sedi 's/^\*\*Depends on:\*\* phase-00$/**Depends on:** phase-01/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"cycle"* ]]
}

@test "[phase-deps] dependency on nonexistent phase fails" {
  sedi 's/^\*\*Depends on:\*\* phase-00$/**Depends on:** phase-07/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[phase-deps]"* ]]
}

@test "[spike] DEFERRED ADR without spike task fails" {
  sedi 's/^\*\*Status:\*\*.*/**Status:** DEFERRED — spike scheduled/' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[spike]"* ]]
}

@test "[spike] DEFERRED ADR with referenced spike task passes" {
  sedi 's/^\*\*Status:\*\*.*/**Status:** DEFERRED — spike scheduled/' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  printf '\n**Spike (ADR 0001):** is Postgres free tier enough — timebox half day, evidence: p95 numbers. Code quarantined in spike/.\n' >> "$TMP/phases/phase-00-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]
}

@test "grandfather: pre-v3 plan warns but passes" {
  sedi '/^\*\*Tier:\*\* M$/d' "$TMP/PLAN.md"
  sedi '/^\*\*Depends on:\*\*/d' "$TMP/phases/phase-00-spec.md"
  sedi '/^\*\*Depends on:\*\*/d' "$TMP/phases/phase-01-spec.md"
  sedi '/^\*\*Reversibility:\*\*/d' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  sedi '/^\*\*Revisit trigger:\*\*/d' "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]
  [[ "$output" == *"pre-dates kickoff v3"* ]]
}

# ---------- Rounds 1–4 checks (v3.5 G1 backfill) ----------

@test "[vague] vague acceptance without verifiable token fails" {
  sedi 's#^| REQ-01 |.*#| REQ-01 | Visitor sees the page | works properly and fast | 1 | active |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[vague]"* ]]
}

@test "[vague] vague word next to verifiable token passes with warn" {
  sedi 's#^| REQ-01 |.*#| REQ-01 | Visitor sees the page | seamless UX with `GET /` under 200ms | 1 | active |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"WARN"*"[vague]"* ]]
}

@test "[tier] 11 active REQs on tier M fails cap" {
  for i in 03 04 05 06 07 08 09 10 11; do
    addrow "| REQ-02 " "| REQ-$i | outcome $i | check $i returns 200 in < 300ms | 1 | active |" "$TMP/PLAN.md"
  done
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"cap for tier M is 10"* ]]
}

@test "[reqs] REQ mapped to nonexistent phase fails" {
  sedi 's#^| REQ-01 |\(.*\)| 1 | active |#| REQ-01 |\1| 9 | active |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"phase 9 which doesn't exist"* ]]
}

@test "[reqs] bad status enum fails" {
  sedi 's#^| REQ-01 |\(.*\)| active |#| REQ-01 |\1| pending |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"must be active | validated | dropped"* ]]
}

@test "[reqs] G4: REQ mapped to two phases fails" {
  sedi 's#^| REQ-01 |\(.*\)| 1 | active |#| REQ-01 |\1| 1, 3 | active |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"exactly one phase"* ]]
}

@test "[assumptions] row without falsification trigger fails" {
  sedi 's#| p95 query > 200ms or storage > 500MB |#| tbd |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[assumptions]"* ]]
}

@test "[assumptions] 8 entries breaks cap 7" {
  for i in 2 3 4 5 6 7 8; do
    addrow "| Free tier DB is enough " "| Assumption $i | metric $i exceeds ${i}00ms threshold | 1 |" "$TMP/PLAN.md"
  done
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"hard cap is 7"* ]]
}

@test "[pre-mortem] 4 rows fails (need 5)" {
  sedi '/^| 5 | Contract tests drift/d' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[pre-mortem]"*"need top 5"* ]]
}

@test "[pre-mortem] row without mitigation fails" {
  sedi 's#| Real-impl pass required before phase 1 closes |#|  |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"no mitigation"* ]]
}

@test "[deps] empty column in external dependencies fails" {
  sedi 's#| lib/db.fake.ts |#|  |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[deps]"*"fake impl"* ]]
}

@test "[kill-criteria] missing tripwire line fails" {
  sedi 's/blown appetite means cut or kill/blown appetite means stop/' "$TMP/PLAN.md"
  sedi '/^\*\*Kill criteria:\*\*/d' "$TMP/PLAN.md"
  sedi '/^conversation\. At 100%/d' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[kill-criteria]"* ]]
}

@test "[progress] missing '## Now' fails" {
  sedi 's/^## Now$/## Later/' "$TMP/PROGRESS.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[progress]"* ]]
}

@test "[adr] index row without file fails" {
  rm "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"not found"* ]]
}

@test "[phases] missing phase spec file fails" {
  rm "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"phase-01-spec.md missing"* ]]
}

@test "[phase0] no phase zero fails" {
  sedi '/^| 0 | Steel thread/d' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]; [[ "$output" == *"[phase0]"* ]]
}

# ---------- v3.5 substance groups (WARN-first trial) ----------

@test "[sections] a missing required section says WHAT to add and WHERE from, not just 'missing'" {
  # Phase 04 dogfood: a real consumer's plan (venturemind, written 2026-07-07) failed 7 checks
  # after upgrading arc, because four of them were added 2026-07-11. The author had not touched
  # the file. A bare "missing section" leaves them guessing at a contract that changed under
  # them -- and on a solo project there is nobody to ask. The message has to carry the fix.
  sedi 's@^## Success requirements@## Removed requirements@' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"success requirements"* ]]
  [[ "$output" == *"REQ-01"* ]]                 # says what the section actually contains
  [[ "$output" == *"PLAN-template.md"* ]]       # and where to copy it from
}

@test "[sections] the same treatment for assumptions and external dependencies" {
  sedi 's@^## Assumptions ledger@## Bets we are making@' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"betting on"* ]]             # what the section is FOR, in the operator's words
  [[ "$output" == *"PLAN-template.md"* ]]
}

@test "[phases] a goalless phase names both ways out, not just the complaint" {
  # both fixture REQs map to phase 1, and phase 0 is exempt by design (steel thread),
  # so phase 1 only goes goalless once BOTH are dropped
  sedi 's#^| REQ-01 |\(.*\)| 1 | active |#| REQ-01 |\1| 1 | dropped |#' "$TMP/PLAN.md"
  sedi 's#^| REQ-02 |\(.*\)| 1 | active |#| REQ-02 |\1| 1 | dropped |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"phase without a goal"* ]]
  [[ "$output" == *"CUT"* ]]                    # mapping a REQ is one fix; CUT is the other
}

@test "[pre-mortem-cite] generic pre-mortem warns (trial), still exits 0" {
  sedi 's#^| 4 | Appetite blown silently |.*#| 4 | Team gets busy | Watch it carefully |#' "$TMP/PLAN.md"
  sedi 's#^| 5 | Contract tests drift from real impl |.*#| 5 | Things break | Be careful |#' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[pre-mortem-cite]"*"[trial]"* ]]
}

@test "[appetite-sum] phase appetites over total FAILS a v3 plan -- promoted out of trial" {
  # PROMOTED 2026-08-12 (Cycle 11 retro). This test is the negative control for the promotion:
  # it asserted `status -eq 0` and the `[trial]` suffix while the gate was advisory, so if the
  # flip had not taken effect it would still pass here and nothing would say so.
  sedi 's/^\*\*Appetite:\*\* 3 days$/**Appetite:** 3 weeks/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -ne 0 ] || { echo "over-commit did not fail a v3 plan -- the promotion did not take"; echo "$output"; false; }
  # FAIL, not WARN, asserted on the appetite-sum LINE ITSELF. A bare
  # `[[ "$output" != *"[trial]"* ]]` would be satisfied by the other eight trial gates' lines
  # anywhere in the output, which is a negative assertion a crash could also satisfy.
  echo "$output" | grep -q "^FAIL  \[appetite-sum\].*over-commits" \
    || { echo "expected a FAIL line for appetite-sum, got:"; echo "$output"; false; }
  echo "$output" | grep -q "^WARN  \[appetite-sum\].*over-commits" \
    && { echo "appetite-sum still reports over-commit as a WARN -- it is still in TRIAL"; echo "$output"; false; }
  true
}

@test "[appetite-sum] the zero-slack branch stays a WARN, promotion or not" {
  # The half `warn()` makes permanent. `TRIAL` cannot reach it, so a plan that merely has thin
  # slack must still exit 0 -- the two leaning-false rows in the trial ledger sit on this branch,
  # and the promotion was only defensible because it cannot touch them.
  # Arithmetic, computed from the fixture rather than guessed: PLAN total is "2 weeks" = 10d,
  # phase-00 is 2d, so 8d here sums to exactly 10d. `sum > total` is FALSE at equality, and
  # `sum > 0.8 * total` is TRUE -- the zero-slack branch, and only it.
  sedi 's/^\*\*Appetite:\*\* 3 days$/**Appetite:** 8 days/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ] || { echo "the zero-slack branch failed a plan; it must only ever warn"; echo "$output"; false; }
  echo "$output" | grep -q "^WARN  \[appetite-sum\].*zero slack" \
    || { echo "expected a WARN line for the zero-slack branch, got:"; echo "$output"; false; }
  # ...and the over-commit branch must NOT have fired, or this test is proving the other half.
  echo "$output" | grep -q "over-commits" \
    && { echo "the over-commit branch fired; this fixture no longer isolates zero-slack"; echo "$output"; false; }
  true
}

@test "[appetite-sum] unparseable PLAN appetite warns, never fails" {
  sedi 's/^2 weeks part-time\..*/Two sprints, part-time — a constraint, not an estimate./' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"arithmetic skipped"* ]]
}

@test "[architecture] C4Context syntax warns (trial)" {
  sedi 's/flowchart TB/C4Context/' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[architecture]"* ]]
}

@test "[adr-wired] orphan ADR warns (trial)" {
  sedi 's/ (ADR 0001)//' "$TMP/phases/phase-01-spec.md"
  sedi 's/ADR 0001 names the fallback/the fallback is named/' "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[adr-wired]"*"never consumed"* ]]
}

@test "[adr-confidence] low-confidence ADR without assumption row warns (trial)" {
  printf '\n**Evidence:** registry + docs checked\n**Confidence:** low\n' >> "$TMP/docs/adr/0001-postgres-over-sqlite.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[adr-confidence]"* ]]
}

@test "[current-state-structure] unstructured Current state warns (trial)" {
  printf '\n## Current state\n\nSome legacy notes about an old express app that needs love and care here.\n' >> "$TMP/PLAN.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[current-state-structure]"* ]]
}

@test "[nonneg-drift] drifted verbatim block warns (trial)" {
  sedi 's/^- CI green before merge$/- CI green before merging/' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[nonneg-drift]"*"drifted"* ]]
}

@test "[nonneg-drift] missing verbatim block warns (trial)" {
  sedi '/## Non-negotiables (verbatim from PLAN)/,$d' "$TMP/phases/phase-00-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[nonneg-drift]"*"missing"* ]]
}

@test "[verify-red] phase-0 without expected-fail-first warns (trial)" {
  sedi '/^- \*\*Expected failure first:\*\*/d' "$TMP/phases/phase-00-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[verify-red]"*"[trial]"* ]]
}

@test "[verify-red] detailed phase-1 without red-first warns (trial)" {
  sedi 's#^One coarse line.*#- **Test command:** `npm test -- health`#' "$TMP/phases/phase-01-spec.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 0 ]; [[ "$output" == *"[verify-red]"*"[trial]"* ]]
}

# ---------- [adr-dup]: two files claiming one ADR number ----------
#
# The collision this exists for is real and already happened (2026-08-02): two sessions on
# two branches both read 0062 as the highest and both wrote 0063-0068. git raised nothing,
# because the FILENAMES differ — there was no conflict to resolve and nothing to notice.
# It was found by a human mentioning the other session.
#
# Structural, so it FAILs rather than warns: two files either share a four-digit prefix or
# they do not.

@test "adr-dup: two files claiming one number FAIL" {
  cp "$TMP/docs/adr/0001-postgres-over-sqlite.md" "$TMP/docs/adr/0001-redis-over-memcached.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[adr-dup]"* ]]
  # Names BOTH files: a duplicate you cannot locate is a duplicate you cannot fix.
  [[ "$output" == *"0001-postgres-over-sqlite.md"* ]]
  [[ "$output" == *"0001-redis-over-memcached.md"* ]]
}

@test "adr-dup: negative control, the good fixture has no duplicates" {
  run $LINT_CMD "$TMP"
  [[ "$output" != *"[adr-dup]"* ]]
}

@test "adr-dup: three files on one number are all named" {
  cp "$TMP/docs/adr/0001-postgres-over-sqlite.md" "$TMP/docs/adr/0001-second.md"
  cp "$TMP/docs/adr/0001-postgres-over-sqlite.md" "$TMP/docs/adr/0001-third.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"claimed by 3 files"* ]]
}

@test "adr-dup: a different number is not a duplicate" {
  cp "$TMP/docs/adr/0001-postgres-over-sqlite.md" "$TMP/docs/adr/0002-something-else.md"
  run $LINT_CMD "$TMP"
  [[ "$output" != *"[adr-dup]"* ]]
}

@test "adr-dup: a case-different extension is still the same number" {
  # An adversarial pass on this very check found 0001-x.MD invisible to a case-sensitive
  # match -- and on Windows and macOS that file is perfectly real.
  cp "$TMP/docs/adr/0001-postgres-over-sqlite.md" "$TMP/docs/adr/0001-shouty.MD"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[adr-dup]"* ]]
}

@test "adr-dup: a number with no title still counts" {
  # 0001.md was invisible to a pattern that required a dash, while the [adr] check below
  # -- which uses startsWith -- would happily resolve it. A duplicate one check can see and
  # another cannot is worse than neither seeing it.
  cp "$TMP/docs/adr/0001-postgres-over-sqlite.md" "$TMP/docs/adr/0001.md"
  run $LINT_CMD "$TMP"
  [ "$status" -eq 1 ]
  [[ "$output" == *"[adr-dup]"* ]]
}

@test "adr-dup: non-ADR files in the directory are ignored, not miscounted" {
  # README.md, a stray .txt, or an editor backup must not be read as ADR 0001.
  printf 'index\n' > "$TMP/docs/adr/README.md"
  printf 'x\n'     > "$TMP/docs/adr/0001-postgres-over-sqlite.md.bak"
  printf 'x\n'     > "$TMP/docs/adr/notes.txt"
  run $LINT_CMD "$TMP"
  [[ "$output" != *"[adr-dup]"* ]]
}

# THE one that makes CI the control rather than the convention: this runs against the REAL
# docs/adr/, so a collision merged from any branch turns the suite red without anyone
# having to remember to run kickoff-lint.
@test "adr-dup: the repository's own docs/adr/ carries no duplicate number" {
  run bash -c 'ls docs/adr | sed -n "s/^\([0-9][0-9][0-9][0-9]\)[-.].*/\1/p" | sort | uniq -d'
  [ "$status" -eq 0 ]
  [ -z "$output" ] || { echo "duplicate ADR number(s) in docs/adr/: $output"; false; }
}

# ---------- [birth-rule] (policy Phase 03, REQ-07) ----------
# The gate is ADVISORY and stays that way: every firing case asserts exit 0 alongside the WARN,
# because this file is run by every lane and is synced into consumer repos. A FAIL here turns a
# shared company file red for a lane that touched nothing.
#
# The policy file under test is the REAL hq.policy.yaml, copied in. A hand-rolled minimal one
# risks the narrow parser rejecting it, which would route every test through the "did not parse"
# branch and pass for the wrong reason -- the vacuous pass this repo has shipped three times.
# Each test therefore asserts the SPECIFIC message it expects, so a parse failure fails the test
# rather than satisfying it, and every test asserts the lint reached its verdict line.
#
# THE SUBJECT IS THE FILENAME STEM. arc-run --process X opens processes/X.process.yaml and
# authorizes process:X; `name:` is never read for authority. Two tests below were originally
# written the other way round and asserted the blindness was correct -- a fresh adversarial pass
# found them. They are inverted here, and that inversion is the point of the pass.

ran() { [[ "$output" == *"kickoff-lint:"* ]]; }

# Write a process file. $1 dir, $2 filename stem, $3 the `name:` value inside.
mkproc() {
  mkdir -p "$1/processes"
  printf 'name: %s\nversion: 1\n' "$3" > "$1/processes/$2.process.yaml"
}

@test "birth-rule: a repo with no policy engine says nothing at all" {
  # The consumer-repo case, and the load-bearing one: no hq.policy.yaml, no processes/.
  # Silence here is the contract that lets this file ship into venture repos.
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"no processes/ in this tree"* ]]   # POSITIVE: the check ran and said so
  [[ "$output" != *"WARN  [birth-rule]"* ]]
}

@test "birth-rule: processes without the law WARNs that they are ungoverned" {
  cp hq.policy.yaml "$TMP/policy-backup.yaml"      # fixture builder proves its own input exists
  [ -s "$TMP/policy-backup.yaml" ]
  rm -f "$TMP/policy-backup.yaml"
  mkproc "$TMP" alpha alpha
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"[birth-rule]"* ]]
  [[ "$output" == *"ungoverned"* ]]
}

@test "birth-rule: an EMPTY processes dir with no law is silent" {
  # Regression: the condition was existsSync("processes"), so any consumer repo keeping a
  # processes/ folder for unrelated reasons ate a policy WARN on every kickoff. There are no
  # processes here, so there is nothing ungoverned to report.
  mkdir -p "$TMP/processes"
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"holds 0 process file(s)"* ]]      # POSITIVE: it looked, and found none
  [[ "$output" != *"WARN  [birth-rule]"* ]]
}

@test "birth-rule: a process with no policy row WARNs and names the file" {
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkproc "$TMP" newthing newthing
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]                                   # advisory, never a FAIL
  [[ "$output" == *"[birth-rule]"* ]]
  [[ "$output" == *"processes/newthing.process.yaml"* ]]
  [[ "$output" == *"process:newthing"* ]]               # the fix, not just the complaint
  [[ "$output" == *"[trial]"* ]]                        # and it is still in TRIAL
}

@test "birth-rule: a process that HAS its policy row is silent" {
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkproc "$TMP" kickoff-plan kickoff-plan
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"checked 1 process(es)"* ]]        # POSITIVE: it examined the file
  [[ "$output" == *"0 ungoverned"* ]]
  [[ "$output" != *"WARN  [birth-rule]"* ]]
}

@test "birth-rule: a governed name: cannot launder an ungoverned filename" {
  # THE INVERTED TEST. This file declares name: kickoff-plan, which IS governed -- and the
  # original version of this test asserted silence for exactly that reason. But the runtime
  # opens processes/zzz-unrelated-filename.process.yaml and authorizes
  # process:zzz-unrelated-filename, which is governed by nothing. Silence here was the hole.
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkproc "$TMP" zzz-unrelated-filename kickoff-plan
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"[birth-rule]"* ]]
  [[ "$output" == *"process:zzz-unrelated-filename"* ]]
  [[ "$output" == *"name: kickoff-plan"* ]]             # and the disagreement is named
}

@test "birth-rule: a governed filename with a foreign name: reports the disagreement" {
  # The mirror. The STEM is governed, so there is no missing row -- but the file claims to be
  # something else, and while the two strings differ a policy row can govern a subject nobody
  # can run while the runnable one goes unchecked.
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkproc "$TMP" kickoff-plan smuggled
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"[birth-rule]"* ]]
  [[ "$output" == *"the runtime authorizes it as"* ]]
  [[ "$output" != *"has no policy row"* ]]              # the row exists; only the names differ
}

@test "birth-rule: a SECOND ungoverned process is still found" {
  # Kills the mutant that checks only the first entry. Every other fixture here has exactly one
  # process file, so `find`-instead-of-`filter`, an early break, or a .slice(0,1) shipped green.
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkproc "$TMP" a-kickoff-plan kickoff-plan             # sorts first, and is ungoverned by stem
  mkproc "$TMP" z-rogue z-rogue                         # sorts last, ungoverned
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"process:z-rogue"* ]]                # the LAST entry must be reported
  [[ "$output" == *"process:a-kickoff-plan"* ]]
}

@test "birth-rule: a policy file with no process rows governs nothing" {
  # Kills the mutant that skips the check when the governed set is empty. Emptying kinds: is the
  # single most dangerous edit to the law, and it is where the gate must be loudest, not silent.
  awk '/^kinds:/{print; exit} {print}' hq.policy.yaml > "$TMP/hq.policy.yaml"
  [ -s "$TMP/hq.policy.yaml" ]                          # the fixture builder proves its fixture
  ! grep -q "process:kickoff-plan" "$TMP/hq.policy.yaml"
  mkproc "$TMP" kickoff-plan kickoff-plan
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"has no policy row"* ]]              # specific: a parse failure fails this
  [[ "$output" == *"process:kickoff-plan"* ]]
}

@test "birth-rule: a kinds key without the process: prefix governs nothing" {
  # Kills the mutant that builds the governed set from every kinds key with a bare
  # .replace("process:",""), which quietly promotes session:interactive -- and any other
  # unprefixed key -- into a governing row. Uses a bare key rather than a file named
  # `session:interactive.process.yaml`, because a colon is not a legal Windows filename and the
  # fixture has to run on all three legs.
  awk '/^kinds:/{print; exit} {print}' hq.policy.yaml > "$TMP/hq.policy.yaml"
  printf '  "alpha":\n    e2: []\n    read: { level: L3 }\n' >> "$TMP/hq.policy.yaml"
  mkproc "$TMP" alpha alpha
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"has no policy row"* ]]
  [[ "$output" == *"process:alpha"* ]]
}

@test "birth-rule: a regular FILE at processes/ WARNs and never crashes the lint" {
  # existsSync guards existence, not type. This threw ENOTDIR out of readdirSync, exited 1, and
  # printed no verdict line at all -- an advisory check taking down every lane's kickoff.
  printf 'not a directory\n' > "$TMP/processes"
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  run $LINT_CMD "$TMP"
  ran                                                    # the verdict line is the proof it lived
  [ "$status" -eq 0 ]
  [[ "$output" == *"[birth-rule]"* ]]
  [[ "$output" == *"not a readable directory"* ]]
  [[ "$output" == *"NOT checked"* ]]                     # POSITIVE: it reports the state it hit
  # A leaked STACK TRACE is the thing to exclude, not the errno: the message quotes the OS error
  # deliberately, and the first version of this assertion banned the substring "ENOTDIR" and so
  # failed on all three legs against a correct message.
  [[ "$output" != *"at readdirSync"* ]]
  [[ "$output" != *"node:internal"* ]]
}

@test "birth-rule: a nested directory under processes/ is reported, not missed" {
  # readdirSync does not descend, while `arc-run --process sub/x` resolves inside it.
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkproc "$TMP" kickoff-plan kickoff-plan
  mkdir -p "$TMP/processes/sub"
  printf 'name: hidden\nversion: 1\n' > "$TMP/processes/sub/hidden.process.yaml"
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"[birth-rule]"* ]]
  # Match the ENTRY NAME and the rule, not the exact sentence. Three assertions in this file
  # have now gone red because the message was reworded while the behaviour was correct; a test
  # that breaks on prose is a test that gets loosened under pressure rather than fixed.
  [[ "$output" == *"processes/sub"* ]]
  [[ "$output" == *"not a regular file"* ]]
  [[ "$output" == *"checked 1 process(es)"* ]]
}

@test "birth-rule: a process the parser cannot read is still checked by its filename" {
  # parsePolicyYaml throws on ALL THREE real process files (its indentation rule), and the
  # engine's own parseYamlSubset surfaces no top-level name from them either. So an unparseable
  # process file is the NORMAL case, not the exotic one, and the fallback to the filename is not
  # a guess -- it is the only subject string the runtime ever had. What must never happen is a
  # parser failure becoming a blind spot: the stem is still checked against the law.
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkdir -p "$TMP/processes"
  printf 'name: [ unterminated\n  and: not the subset\n' > "$TMP/processes/rogue.process.yaml"
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"has no policy row"* ]]
  [[ "$output" == *"process:rogue"* ]]
}

@test "birth-rule: an unreadable process file with a GOVERNED filename stays silent" {
  # The other side of the same rule, and the one that would have caught the noise: the three
  # real process files are all unparseable and all governed, so a check that reported the parse
  # failure fired on every legitimate process in the repository.
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkdir -p "$TMP/processes"
  printf 'name: [ unterminated\n  and: not the subset\n' > "$TMP/processes/kickoff-plan.process.yaml"
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"checked 1 process(es)"* ]]        # POSITIVE: unreadable, still examined
  [[ "$output" == *"0 ungoverned"* ]]
  [[ "$output" != *"WARN  [birth-rule]"* ]]
}

@test "birth-rule: an unparseable POLICY file WARNs and never crashes the lint" {
  printf 'kinds: [ this is not\n  the subset parser\n' > "$TMP/hq.policy.yaml"
  mkproc "$TMP" alpha alpha
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"[birth-rule]"* ]]
  [[ "$output" == *"policy-lint is the authority"* ]]
}

@test "birth-rule: files in processes/ that are not .process.yaml are ignored" {
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkdir -p "$TMP/processes"
  printf 'x\n' > "$TMP/processes/README.md"
  printf 'x\n' > "$TMP/processes/alpha.process.yaml.bak"
  printf 'x\n' > "$TMP/processes/notes.txt"
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"holds 0 process file(s)"* ]]      # POSITIVE: read the dir, matched none
  [[ "$output" != *"WARN  [birth-rule]"* ]]
}

@test "birth-rule: a processes/ holding ONLY a subdirectory is not silent" {
  # Was completely silent: the empty-list branch short-circuited before the non-file loop, so
  # the warning added for exactly this shape only appeared when an ordinary process file also
  # existed. arc-run --process sub/x still resolves through it.
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkdir -p "$TMP/processes/sub"
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"processes/sub is not a regular file"* ]]
  [[ "$output" == *"holds 0 process file(s)"* ]]
}

@test "birth-rule: a case-variant processes directory is reported, not skipped" {
  # existsSync is not an identity check. A directory committed as Processes/ is opened by
  # Windows and macOS and missed by Linux, so the same commit produced a different verdict per
  # CI leg -- silence on ubuntu, a warning on the others.
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkdir -p "$TMP/Processes"
  printf 'name: sneaky
version: 1
' > "$TMP/Processes/sneaky.process.yaml"
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"only case-insensitively exists here"* ]]
  [[ "$output" == *"NOT checked"* ]]
}

@test "birth-rule: policy rows with no processes/ directory are reported" {
  # Deleting processes/ disarmed BOTH gates: policy-lint guards its existence check with
  # `processNames && ...`, so a null subject set skips it entirely, and nothing else looked.
  # Removing the directory must not be quieter than keeping it.
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"row(s) but there is no processes/ directory"* ]]
  [[ "$output" == *"no processes/ in this tree"* ]]
}

@test "birth-rule: a case-variant EXTENSION is reported and hidden from policy-lint" {
  # GHOSTCASE.PROCESS.YAML opens on Windows and macOS and not on Linux. The advisory gate says
  # so; processNames() must NOT hand it to policy-lint, or policy-lint accepts a
  # process:ghostcase row for a process the Linux runner cannot open -- a fail-open in the one
  # gate that is FAIL-capable.
  cp hq.policy.yaml "$TMP/hq.policy.yaml"
  mkproc "$TMP" kickoff-plan kickoff-plan
  printf 'name: ghostcase
version: 1
' > "$TMP/processes/GHOSTCASE.PROCESS.YAML"
  run $LINT_CMD "$TMP"
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"only case-insensitively"* ]]
  [[ "$output" == *"checked 2 process(es)"* ]]
}

# THE control, same shape as adr-dup's: this runs against the REAL tree, so a process merged
# from any branch without its policy row turns the suite red without anyone remembering to look.
@test "birth-rule: every process in this repository carries its policy row" {
  # --lane is mandatory here: arc has an initiatives/ dir with more than one eligible lane, so
  # a bare root exits 3 (ambiguous) and this test would assert against a resolver message
  # instead of the check. The birth rule reads root-level files, so the lane choice is
  # irrelevant to what is measured -- it only gets the resolver out of the way.
  #
  # This test called itself THE control and was not one: with the whole birth-rule block
  # deleted it stayed green, because its only assertion was that a string was absent. The
  # marker below is what makes it falsifiable, and the count is DERIVED from the tree rather
  # than typed, so adding a process cannot silently drift past it (ADR-0107).
  local n; n=$(ls processes/*.process.yaml 2>/dev/null | wc -l | tr -d " ")
  [ "$n" -ge 1 ]                                         # the fixture is not empty
  run $LINT_CMD . --lane policy
  ran
  [ "$status" -eq 0 ]
  [[ "$output" == *"checked $n process(es) against hq.policy.yaml"* ]] || { echo "$output"; false; }
  [[ "$output" == *"0 ungoverned"* ]] || { echo "$output"; false; }
  [[ "$output" != *"WARN  [birth-rule]"* ]] || { echo "$output"; false; }
}

# NOT a control for the gate -- it never invokes kickoff-lint. It asserts the tree invariant the
# gate depends on, from the other side, so a process whose name: drifts from its filename is
# caught even in the cases where the parser cannot read the file to compare them.
@test "birth-rule: every process in this repository declares its own filename" {
  # The stem/name invariant, asserted on the real tree rather than only in fixtures. While these
  # two strings agree, the gate and the runtime cannot read one file as two subjects.
  run bash -c '
    bad=0
    for f in processes/*.process.yaml; do
      stem=$(basename "$f" .process.yaml)
      nm=$(sed -n "s/^name:[[:space:]]*//p" "$f" | head -1)
      [ "$stem" = "$nm" ] || { echo "$f declares $nm"; bad=1; }
    done
    exit $bad'
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -n "$(ls processes/*.process.yaml 2>/dev/null)" ]    # the loop ran over something
}

# bats silently DROPS a test whose @test name is not ASCII, and a dropped test is invisible
# except as a shrinking count. Assert the registered count from BATS_TEST_NAMES -- what bats
# actually registered -- rather than grepping the file, which counts lines bats ignored.
#
# The expected number is DERIVED from this file, not pinned. It was pinned at 71, and adding one
# test on 2026-08-12 turned it red with nothing broken -- which is verbatim the defect
# `tests/develop-lint.bats` documents in its own comment ("a test that asserts one snapshot value
# measures the calendar", retro-log 2026-08-02). The lesson was written down in one suite and never
# applied to this one: the same twin-fix shape, found by the commit that added a twin-fix mechanism.
#
# `grep -c '^@test '` counts what the FILE declares; `BATS_TEST_NAMES` counts what bats REGISTERED.
# The whole point is that those two numbers can differ, so the test compares them against each
# other and stays a real check rather than becoming a tautology.
@test "kickoff-lint suite registers every test it defines" {
  local declared registered
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered=${#BATS_TEST_NAMES[@]}
  [ "$registered" -eq "$declared" ] || { echo "declared $declared tests, bats registered $registered"; false; }
  # A floor, so the pair cannot both collapse to zero and agree.
  [ "$declared" -gt 60 ] || { echo "only $declared tests declared -- the suite shrank unnoticed"; false; }
}

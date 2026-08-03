#!/usr/bin/env bats
# evolve Phase 00 -- the eight experiment receipts (ADR-0304, registered by ADR-0309).
#
# EVERY case here asserts WIRING, not exit codes. The 2026-08-02 `develop` retro records an
# emitter that reported success while every receipt was silently quarantined UNKNOWN_KIND,
# found only by listing the spine directory by hand. So each emit captures its own exit code,
# then asserts events/ is non-empty BEFORE reading _quarantine/ -- a silent crash or an empty
# pipe also produces "quarantine gained nothing", and the two are otherwise indistinguishable.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT="$ARC_ROOT/.claude/scripts/hq/arc-event.sh"

SHA_BASE="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
SHA_CAND="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
SHA_PATCH="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
SHA_CFG="dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
SHA_MET="eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

setup() {
  SPINE="$BATS_TEST_TMPDIR/spine"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
  export ARC_SPINE_NOW="1785000000000"
  export ARC_SPINE_RAND="00112233445566778899"
}

_fresh_spine() {
  SPINE="$BATS_TEST_TMPDIR/spine-$1"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
}

_event_lines()      { cat "$SPINE"/events/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '; }
_quarantine_lines() { cat "$SPINE"/events/_quarantine/*.jsonl 2>/dev/null | sed '/^$/d' | wc -l | tr -d ' '; }

_payload() {
  case "$1" in
    experiment.opened)
      printf '{"experiment_id":"x-hero-001","module":"core","surface":"home-hero","target_path":"app/home/hero.tsx","base_sha":"%s","split":[50,50],"ttl_days":28,"arms":["+champion","+challenger-a"]}' "$SHA_BASE" ;;
    experiment.assigned)
      printf '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"verdict"}' ;;
    experiment.measured)
      printf '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-fedcba9876543210"}' ;;
    experiment.verdict)
      printf '{"experiment_id":"x-hero-001","outcome":"verdict","bound":0.011,"delta":0.024,"n_per_arm":{"+champion":1900,"+challenger-a":1874},"config_hash":"%s","metric_hash":"%s"}' "$SHA_CFG" "$SHA_MET" ;;
    promotion.proposed)
      printf '{"proposal_id":"p-hero-001","experiment_id":"x-hero-001","kind":"promote","patch_sha":"%s","base_sha":"%s","candidate_sha":"%s"}' "$SHA_PATCH" "$SHA_BASE" "$SHA_CAND" ;;
    experiment.promoted)
      printf '{"proposal_id":"p-hero-001","commit_ref":"1d4cf27","observed_candidate_sha":"%s"}' "$SHA_CAND" ;;
    experiment.rolled_back)
      printf '{"proposal_id":"p-hero-002","commit_ref":"3973b5c"}' ;;
    experiment.closed)
      printf '{"experiment_id":"x-hero-001","outcome":"winner","reason":"bound 0.011 clears effect_floor 0 with both arms above the per-arm floor"}' ;;
  esac
}

_kinds() {
  printf '%s\n' experiment.opened experiment.assigned experiment.measured experiment.verdict \
                promotion.proposed experiment.promoted experiment.rolled_back experiment.closed
}

# ---------- the wiring assertion, per kind ----------

@test "every one of the eight kinds emits, LANDS in events/, and quarantines nothing" {
  local fails="" k
  while read -r k; do
    _fresh_spine "land-$k"
    run bash "$EVENT" emit "$k" --payload "$(_payload "$k")" --strict
    # 1. the emit's OWN exit, captured -- not assumed
    [ "$status" -eq 0 ] || { fails="$fails|$k: emit exited $status: $output"; continue; }
    # 2. events/ is non-empty BEFORE any conclusion is drawn from the quarantine listing
    [ "$(_event_lines)" -eq 1 ] || { fails="$fails|$k: events/ holds $(_event_lines) line(s), expected 1"; continue; }
    # 3. only now does "quarantine gained nothing" mean anything
    [ "$(_quarantine_lines)" -eq 0 ] || { fails="$fails|$k: quarantine holds $(_quarantine_lines) line(s)"; continue; }
    grep -q "\"kind\":\"$k\"" "$SPINE"/events/*.jsonl || fails="$fails|$k: landed line does not carry the kind"
  done < <(_kinds)
  [ -z "$fails" ] || { echo "WIRING FAILURES:"; echo "$fails" | tr '|' '\n'; false; }
}

@test "a revert proposal carries applies_to + restores and lands" {
  _fresh_spine revert
  local p
  p="$(printf '{"proposal_id":"p-hero-002","experiment_id":"x-hero-001","kind":"revert","patch_sha":"%s","base_sha":"%s","candidate_sha":"%s","applies_to":"%s","restores":"%s"}' \
       "$SHA_PATCH" "$SHA_CAND" "$SHA_BASE" "$SHA_CAND" "$SHA_BASE")"
  run bash "$EVENT" emit promotion.proposed --payload "$p" --strict
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_event_lines)" -eq 1 ]
  [ "$(_quarantine_lines)" -eq 0 ]
}

# ---------- the vocabulary boundary ----------

@test "metric.observed is STILL refused — it belongs to the client's cycle (ADR-0308)" {
  _fresh_spine metric-observed
  run bash "$EVENT" emit metric.observed --payload '{"metric":"signup_conversion","value":1}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"UNKNOWN_KIND"* ]]
  [ "$(_event_lines)" -eq 0 ]
}

@test "the closed vocabulary reports its own size, and it is 30" {
  _fresh_spine kindcount
  run bash "$EVENT" emit not.akind --payload '{}' --strict
  [ "$status" -eq 2 ]
  # The count in the message is derived from KINDS.length, never typed — a gate that
  # misreports its own size teaches the wrong rule (ADR-0107).
  [[ "$output" == *"outside the closed 30"* ]]
}

# ---------- closed payloads ----------

@test "an unknown payload key is rejected on every one of the eight kinds" {
  local fails="" k p
  while read -r k; do
    _fresh_spine "unknownkey-$k"
    p="$(_payload "$k" | sed 's/}$/,"sneaky":1}/')"
    run bash "$EVENT" emit "$k" --payload "$p" --strict
    [ "$status" -eq 2 ] || { fails="$fails|$k: expected exit 2, got $status"; continue; }
    [[ "$output" == *"unknown key \"sneaky\""* ]] || fails="$fails|$k: wrong message [$output]"
    [ "$(_event_lines)" -eq 0 ] || fails="$fails|$k: a rejected event still landed"
  done < <(_kinds)
  [ -z "$fails" ] || { echo "CLOSED-PAYLOAD FAILURES:"; echo "$fails" | tr '|' '\n'; false; }
}

@test "a missing required key is named, not defaulted" {
  _fresh_spine missing
  run bash "$EVENT" emit experiment.opened --payload \
    "$(printf '{"experiment_id":"x-hero-001","module":"core","surface":"home-hero","target_path":"app/home/hero.tsx","split":[50,50],"ttl_days":28,"arms":["+champion","+challenger-a"]}')" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"missing \"base_sha\""* ]]
}

@test "a case-varied enum is rejected, never normalized" {
  _fresh_spine caseenum
  run bash "$EVENT" emit experiment.assigned --payload \
    '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"Verdict"}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"cohort"* ]]
  [[ "$output" == *"Verdict"* ]]
}

# ---------- the SHA seal and the lineage ----------

@test "experiment.opened without a base_sha-shaped seal is refused" {
  _fresh_spine badseal
  run bash "$EVENT" emit experiment.opened --payload \
    '{"experiment_id":"x-hero-001","module":"core","surface":"home-hero","target_path":"app/home/hero.tsx","base_sha":"not-a-sha","split":[50,50],"ttl_days":28,"arms":["+champion","+challenger-a"]}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"base_sha"* ]]
}

@test "a proposal whose candidate_sha equals its base_sha is refused (it changes nothing)" {
  _fresh_spine noop
  run bash "$EVENT" emit promotion.proposed --payload \
    "$(printf '{"proposal_id":"p-hero-001","experiment_id":"x-hero-001","kind":"promote","patch_sha":"%s","base_sha":"%s","candidate_sha":"%s"}' "$SHA_PATCH" "$SHA_BASE" "$SHA_BASE")" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"changes nothing"* ]]
}

@test "a promote proposal carrying revert-only keys is refused" {
  _fresh_spine revertkeys
  run bash "$EVENT" emit promotion.proposed --payload \
    "$(printf '{"proposal_id":"p-hero-001","experiment_id":"x-hero-001","kind":"promote","patch_sha":"%s","base_sha":"%s","candidate_sha":"%s","applies_to":"%s","restores":"%s"}' "$SHA_PATCH" "$SHA_BASE" "$SHA_CAND" "$SHA_CAND" "$SHA_BASE")" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"revert-only"* ]]
}

@test "a revert proposal missing applies_to is refused" {
  _fresh_spine revertmissing
  run bash "$EVENT" emit promotion.proposed --payload \
    "$(printf '{"proposal_id":"p-hero-002","experiment_id":"x-hero-001","kind":"revert","patch_sha":"%s","base_sha":"%s","candidate_sha":"%s","restores":"%s"}' "$SHA_PATCH" "$SHA_CAND" "$SHA_BASE" "$SHA_BASE")" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"applies_to"* ]]
}

@test "experiment.promoted without an observed_candidate_sha is refused" {
  _fresh_spine noobserved
  run bash "$EVENT" emit experiment.promoted --payload \
    '{"proposal_id":"p-hero-001","commit_ref":"1d4cf27"}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"observed_candidate_sha"* ]]
}

# ---------- arms, splits, floors ----------

@test "a one-armed experiment is refused" {
  _fresh_spine onearm
  run bash "$EVENT" emit experiment.opened --payload \
    "$(printf '{"experiment_id":"x-hero-001","module":"core","surface":"home-hero","target_path":"app/home/hero.tsx","base_sha":"%s","split":[100],"ttl_days":28,"arms":["+champion"]}' "$SHA_BASE")" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"at least two"* ]]
}

@test "a split that does not sum to 100 is refused" {
  _fresh_spine badsplit
  run bash "$EVENT" emit experiment.opened --payload \
    "$(printf '{"experiment_id":"x-hero-001","module":"core","surface":"home-hero","target_path":"app/home/hero.tsx","base_sha":"%s","split":[50,40],"ttl_days":28,"arms":["+champion","+challenger-a"]}' "$SHA_BASE")" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"sums to 90"* ]]
}

@test "an experiment with no TTL is refused (an experiment with no expiry never archives)" {
  _fresh_spine nottl
  run bash "$EVENT" emit experiment.opened --payload \
    "$(printf '{"experiment_id":"x-hero-001","module":"core","surface":"home-hero","target_path":"app/home/hero.tsx","base_sha":"%s","split":[50,50],"ttl_days":0,"arms":["+champion","+challenger-a"]}' "$SHA_BASE")" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"ttl_days"* ]]
}

@test "n_per_arm as a scalar is refused — it cannot express 'both arms above floor'" {
  _fresh_spine scalarn
  run bash "$EVENT" emit experiment.verdict --payload \
    "$(printf '{"experiment_id":"x-hero-001","outcome":"verdict","bound":0.011,"delta":0.024,"n_per_arm":1900,"config_hash":"%s","metric_hash":"%s"}' "$SHA_CFG" "$SHA_MET")" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"n_per_arm"* ]]
}

@test "n_per_arm with a single arm is refused" {
  _fresh_spine onearmn
  run bash "$EVENT" emit experiment.verdict --payload \
    "$(printf '{"experiment_id":"x-hero-001","outcome":"verdict","bound":0.011,"delta":0.024,"n_per_arm":{"+champion":1900},"config_hash":"%s","metric_hash":"%s"}' "$SHA_CFG" "$SHA_MET")" --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"at least two"* ]]
}

# ---------- idem: total preimage, derived not supplied ----------

@test "two receipts differing in one identity field get DIFFERENT idems" {
  _fresh_spine idem-a
  run bash "$EVENT" emit experiment.assigned --payload \
    '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"verdict"}' --strict
  [ "$status" -eq 0 ]
  local a; a="$(sed -n 's/.*"idem":"\([0-9a-f]*\)".*/\1/p' "$SPINE"/events/*.jsonl)"

  _fresh_spine idem-b
  run bash "$EVENT" emit experiment.assigned --payload \
    '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+challenger-a","cohort":"verdict"}' --strict
  [ "$status" -eq 0 ]
  local b; b="$(sed -n 's/.*"idem":"\([0-9a-f]*\)".*/\1/p' "$SPINE"/events/*.jsonl)"

  [ -n "$a" ] && [ -n "$b" ]
  [ "$a" != "$b" ]
}

@test "the same receipt emitted twice collides — one fact, one receipt" {
  _fresh_spine idem-dup
  run bash "$EVENT" emit experiment.assigned --payload \
    '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"verdict"}' --strict
  [ "$status" -eq 0 ]
  run bash "$EVENT" emit experiment.assigned --payload \
    '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"verdict"}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"DUP_IDEM"* ]]
  [ "$(_event_lines)" -eq 1 ]
}

@test "a caller-supplied --idem is REFUSED on an experiment kind (anti-preclaim)" {
  _fresh_spine preclaim
  run bash "$EVENT" emit experiment.assigned \
    --payload '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"verdict"}' \
    --idem "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" --strict
  [ "$status" -eq 2 ]
  [ "$(_event_lines)" -eq 0 ]
}

# ---------- ADR-0302: the stream contract, no PII on the spine ----------

@test "a URL-shaped source_id never reaches the spine" {
  _fresh_spine urlsource
  run bash "$EVENT" emit experiment.measured --payload \
    '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"https://analytics.example.com/e/42"}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_SOURCE_ID"* ]]
  [ "$(_event_lines)" -eq 0 ]
}

@test "an email-shaped unit_id never reaches the spine" {
  _fresh_spine emailunit
  run bash "$EVENT" emit experiment.measured --payload \
    '{"experiment_id":"x-hero-001","unit_id":"ashiq@example.com","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-07","source_id":"h-fedcba9876543210"}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_SOURCE_ID"* ]]
  [ "$(_event_lines)" -eq 0 ]
}

@test "the h-<16 hex> hashed form IS accepted" {
  _fresh_spine hashedok
  run bash "$EVENT" emit experiment.measured --payload "$(_payload experiment.measured)" --strict
  [ "$status" -eq 0 ]
  [ "$(_event_lines)" -eq 1 ]
  [ "$(_quarantine_lines)" -eq 0 ]
}

@test "an inverted measurement window is refused" {
  _fresh_spine invwindow
  run bash "$EVENT" emit experiment.measured --payload \
    '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"2026-08-07","window_end":"2026-08-01","source_id":"h-fedcba9876543210"}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"BAD_WINDOW"* ]]
}

@test "a non-calendar window date is refused" {
  _fresh_spine badday
  run bash "$EVENT" emit experiment.measured --payload \
    '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":1,"unit_count":1,"window_start":"2026-02-30","window_end":"2026-03-01","source_id":"h-fedcba9876543210"}' --strict
  [ "$status" -eq 2 ]
  [[ "$output" == *"not a real calendar date"* ]]
}

# ---------- corrections ride supersedes, never overwrite ----------

@test "a correction supersedes rather than overwriting, and BOTH lines stay on the spine" {
  _fresh_spine supersede
  run bash "$EVENT" emit experiment.measured --payload "$(_payload experiment.measured)" --strict
  [ "$status" -eq 0 ]
  local first; first="$(sed -n 's/.*"id":"\([0-9A-HJKMNP-TV-Z]*\)".*/\1/p' "$SPINE"/events/*.jsonl | head -1)"
  [ -n "$first" ]
  # Same unit + window, corrected value: a different measurement of the same fact. It rides
  # supersedes; the append-only spine keeps both lines.
  run bash "$EVENT" emit experiment.measured --supersedes "$first" --payload \
    '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"verdict","metric":"signup_conversion","value":0,"unit_count":1,"window_start":"2026-08-01","window_end":"2026-08-08","source_id":"h-fedcba9876543210"}' --strict
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_event_lines)" -eq 2 ]
  [ "$(_quarantine_lines)" -eq 0 ]
}

# ---------- ADR-0303: the variant grammar, name@x.y.z(+slug)? ----------

@test "BACKWARD-COMPAT CONTROL: a legacy name@x.y.z process id still validates" {
  # Written and run BEFORE the regex was touched. This case must be green on both sides of
  # the change; if it is only ever green after, it proves nothing about compatibility.
  _fresh_spine legacyprocess
  run bash "$EVENT" emit note.logged --payload '{"note":"legacy"}' --process "arc-event@1.0.0" --strict
  [ "$status" -eq 0 ]
  [ "$(_event_lines)" -eq 1 ]
}

@test "an arm-tagged process id name@x.y.z+slug validates" {
  _fresh_spine variantprocess
  run bash "$EVENT" emit note.logged --payload '{"note":"variant"}' --process "hero-copy@1.0.0+challenger-a" --strict
  [ "$status" -eq 0 ]
  [ "$(_event_lines)" -eq 1 ]
}

@test "near-miss slugs fail CLOSED, never coerced or truncated" {
  local fails="" bad
  # empty suffix · leading hyphen · upper case · underscore · 33 chars · a second +
  for bad in 'hero-copy@1.0.0+' 'hero-copy@1.0.0+-lead' 'hero-copy@1.0.0+Challenger' \
             'hero-copy@1.0.0+has_underscore' 'hero-copy@1.0.0+aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' \
             'hero-copy@1.0.0+a+b'; do
    _fresh_spine "nearmiss-$(printf '%s' "$bad" | tr -c 'a-z0-9' '-')"
    run bash "$EVENT" emit note.logged --payload '{"note":"x"}' --process "$bad" --strict
    [ "$status" -eq 2 ] || { fails="$fails|$bad: expected exit 2, got $status"; continue; }
    [[ "$output" == *"BAD_PROCESS"* ]] || fails="$fails|$bad: wrong code [$output]"
    [ "$(_event_lines)" -eq 0 ] || fails="$fails|$bad: a rejected process still landed"
  done
  [ -z "$fails" ] || { echo "GRAMMAR FAILURES:"; echo "$fails" | tr '|' '\n'; false; }
}

@test "process-lint INHERITS the grammar rather than carrying a copy" {
  cd "$ARC_ROOT"
  # One definition, three products. A copied regex is a regex that drifts (retro 2026-07-22).
  # Run from the repo root with RELATIVE specifiers: a bare Windows path ("C:/...") is not a
  # legal ESM specifier, and the resulting import failure would read as drift.
  run node --input-type=module -e '
    const v = await import("./.claude/scripts/hq/lib/validate.mjs");
    const core = await import("./.claude/scripts/core/variant-grammar.mjs");
    if (v.PROCESS_RE !== core.PROCESS_RE) { console.log("DRIFT: not the same object"); process.exit(1); }
    if (!v.PROCESS_RE.test("hero-copy@1.0.0+challenger-a")) { console.log("DRIFT: suffix not accepted"); process.exit(1); }
    console.log("SAME_OBJECT");
  '
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"SAME_OBJECT"* ]]
}

# ---------- hook mode never blocks, and never lies ----------

@test "hook mode: an invalid experiment receipt exits 0, appends NOTHING, and quarantines" {
  _fresh_spine hookmode
  run bash "$EVENT" emit experiment.assigned --payload \
    '{"experiment_id":"x-hero-001","unit_id":"h-0123456789abcdef","arm":"+champion","cohort":"Verdict"}'
  [ "$status" -eq 0 ]
  [ "$(_event_lines)" -eq 0 ]
  [ "$(_quarantine_lines)" -eq 1 ]
}

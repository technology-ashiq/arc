#!/usr/bin/env bats
# Phase 02 -- committed, tamper-evident evidence bundles.
bats_require_minimum_version 1.5.0
load 'test_helper'

EV() { echo "$ARC_ROOT/.claude/scripts/plan/arc-evidence.sh"; }

@test "evidence: bundle assembles a manifest and gathers present artifacts" {
  _arc_sandbox
  mkdir -p .claude/state/scan
  echo '{"verdict":"pass"}' > .claude/state/scan/verdict.json
  run bash "$(EV)" bundle 2 --out evidence
  [ "$status" -eq 0 ]
  [ -f evidence/phase-02/manifest.json ]
  [ -f evidence/phase-02/scan-verdict.json ]
  run jq -r '.phase' evidence/phase-02/manifest.json
  [ "$output" = "02" ]
}

@test "evidence: manifest records the current commit" {
  _arc_sandbox
  run bash "$(EV)" bundle 2 --out evidence
  local head; head="$(git rev-parse HEAD)"
  run jq -r '.commit' evidence/phase-02/manifest.json
  [ "$output" = "$head" ]
}

@test "evidence: verify passes on an intact bundle" {
  _arc_sandbox
  mkdir -p .claude/state/scan; echo '{"verdict":"pass"}' > .claude/state/scan/verdict.json
  bash "$(EV)" bundle 2 --out evidence
  run bash "$(EV)" verify 2 --out evidence
  [ "$status" -eq 0 ]
}

@test "evidence: verify FAILS on a tampered artifact (tamper-evident)" {
  _arc_sandbox
  mkdir -p .claude/state/scan; echo '{"verdict":"pass"}' > .claude/state/scan/verdict.json
  bash "$(EV)" bundle 2 --out evidence
  echo 'tampered' >> evidence/phase-02/scan-verdict.json
  run bash "$(EV)" verify 2 --out evidence
  [ "$status" -eq 2 ]
  [[ "$output" == *"TAMPERED"* ]]
}

@test "evidence: verify FAILS when no bundle exists (phase cannot close)" {
  _arc_sandbox
  run bash "$(EV)" verify 7 --out evidence
  [ "$status" -eq 2 ]
  [[ "$output" == *"no bundle"* ]]
}

@test "evidence: bundle degrades gracefully when no artifacts are present" {
  _arc_sandbox
  run bash "$(EV)" bundle 3 --out evidence
  [ "$status" -eq 0 ]
  run jq '.files | length' evidence/phase-03/manifest.json
  [ "$output" -eq 0 ]
}

# ---------- ADR-0060: the bundle must not overwrite someone else's evidence ----------
# Found closing Cycle 4's phase 00: `bundle 0` in root-mode writes to docs/evidence/phase-00,
# which is keyed on the phase number alone and carries no cycle identity. Four different
# "close Phase 00" commits had already landed in that one directory, each silently rewriting
# the previous manifest's commit pointer. It survived four cycles because the manifest hashed
# only the artifacts the run collected, so `verify` reported success over seven unlisted files
# belonging to a different cycle -- a gate checking what it wrote, not what was there.

@test "evidence: bundle REFUSES a destination owned by a different commit" {
  _arc_sandbox
  mkdir -p .claude/state/scan; echo '{"verdict":"pass"}' > .claude/state/scan/verdict.json
  bash "$(EV)" bundle 2 --out evidence
  local first; first="$(jq -r '.commit' evidence/phase-02/manifest.json)"
  echo second > second.txt; git add -A; git commit -qm second
  run bash "$(EV)" bundle 2 --out evidence
  [ "$status" -ne 0 ] || { echo "bundle overwrote a foreign bundle instead of refusing"; false; }
  [[ "$output" == *"${first:0:7}"* ]] || { echo "refusal does not name the owning commit: $output"; false; }
  [ "$(jq -r '.commit' evidence/phase-02/manifest.json)" = "$first" ] \
    || { echo "the existing bundle was modified by a refused run"; false; }
}

@test "evidence: re-bundling the SAME commit stays idempotent (a close may re-run)" {
  _arc_sandbox
  mkdir -p .claude/state/scan; echo '{"verdict":"pass"}' > .claude/state/scan/verdict.json
  bash "$(EV)" bundle 2 --out evidence
  run bash "$(EV)" bundle 2 --out evidence
  [ "$status" -eq 0 ] || { echo "a same-commit re-bundle was refused: $output"; false; }
  run bash "$(EV)" verify 2 --out evidence
  [ "$status" -eq 0 ]
}

@test "evidence: the manifest covers every file in the bundle, not just what the run wrote" {
  _arc_sandbox
  mkdir -p .claude/state/scan; echo '{"verdict":"pass"}' > .claude/state/scan/verdict.json
  mkdir -p evidence/phase-02
  # An artifact the run does not collect -- exactly the shape of a previous cycle's leftovers.
  echo 'from another cycle' > evidence/phase-02/adversarial-report.md
  bash "$(EV)" bundle 2 --out evidence
  run jq -r '.files[].name' evidence/phase-02/manifest.json
  [[ "$output" == *"adversarial-report.md"* ]] \
    || { echo "manifest lists only what the run collected: $output"; false; }
  run jq -r '.files[].name' evidence/phase-02/manifest.json
  [[ "$output" != *"manifest.json"* ]] || { echo "manifest must not hash itself"; false; }
}

@test "evidence: verify FAILS when a foreign file appears in the bundle" {
  _arc_sandbox
  mkdir -p .claude/state/scan; echo '{"verdict":"pass"}' > .claude/state/scan/verdict.json
  bash "$(EV)" bundle 2 --out evidence
  echo 'someone elses evidence' > evidence/phase-02/stowaway.log
  run bash "$(EV)" verify 2 --out evidence
  [ "$status" -eq 2 ] || { echo "verify passed over an unlisted file: $output"; false; }
  [[ "$output" == *"stowaway.log"* ]] || { echo "verify does not name the intruder: $output"; false; }
}

@test "evidence: a manifest that names no readable commit is refused, not treated as unowned" {
  # Adversarial pass on the ADR-0060 refusal: the first cut read `.commit // ""`, so corrupt
  # JSON yielded an empty owner and the guard fell through to an overwrite. Ownership that
  # cannot be established is the case where overwriting is LEAST safe -- fail closed.
  _arc_sandbox
  mkdir -p evidence/phase-02
  echo 'not json at all' > evidence/phase-02/manifest.json
  run bash "$(EV)" bundle 2 --out evidence
  [ "$status" -eq 3 ] || { echo "corrupt manifest did not refuse: status=$status $output"; false; }
  [ "$(cat evidence/phase-02/manifest.json)" = 'not json at all' ] \
    || { echo "a refused run still overwrote the manifest"; false; }

  mkdir -p evidence/phase-03
  echo '{"phase":"03"}' > evidence/phase-03/manifest.json
  run bash "$(EV)" bundle 3 --out evidence
  [ "$status" -eq 3 ] || { echo "commit-less manifest did not refuse: status=$status"; false; }
}

@test "evidence: the manifest covers nested and space-containing filenames" {
  # find|read pairs are where filenames with spaces normally break, and a bundle that
  # silently omits a file from its manifest is the exact hole ADR-0060 exists to close.
  _arc_sandbox
  mkdir -p "evidence/phase-02/sub"
  echo a > "evidence/phase-02/two words.log"
  echo b > "evidence/phase-02/sub/deep.log"
  bash "$(EV)" bundle 2 --out evidence
  run jq -r '.files[].name' evidence/phase-02/manifest.json
  [[ "$output" == *"two words.log"* ]] || { echo "space-named file missing: $output"; false; }
  [[ "$output" == *"sub/deep.log"* ]]  || { echo "nested file missing: $output"; false; }
  run bash "$(EV)" verify 2 --out evidence
  [ "$status" -eq 0 ] || { echo "verify failed on its own bundle: $output"; false; }
  rm -f "evidence/phase-02/sub/deep.log"
  run bash "$(EV)" verify 2 --out evidence
  [ "$status" -eq 2 ]
  [[ "$output" == *"MISSING sub/deep.log"* ]]
}

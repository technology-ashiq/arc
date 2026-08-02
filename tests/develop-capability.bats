#!/usr/bin/env bats
# Phase 06 -- capability acquisition: find it, pin it, and refuse it by default.
#
# Red-first: every @test here fails before .claude/scripts/develop/capability-vet.sh exists.
#
# The load-bearing red is the BLOCK/PASS PAIR, not the BLOCK list. A gate that refuses
# everything satisfies all eleven refusal tests and is worthless, so `clean` and
# `write-capable-ok` must PASS in the same run that the others fail. ADR-0110's own words:
# "a gate that passes everything reads as safety and provides none" -- and the inverse, a gate
# that fails everything, is discovered the first time someone needs it and then switched off.
#
# Every fixture differs from `clean` in exactly ONE way, so a BLOCK names its own cause.
bats_require_minimum_version 1.5.0
load 'test_helper'

VET() { echo "$ARC_ROOT/.claude/scripts/develop/capability-vet.sh"; }
FX()  { echo "$ARC_ROOT/tests/fixtures/develop/capability"; }

# Vet one fixture against the fixture allowlist, into a throwaway lock file.
_vet() {
  local name="$1"; shift
  LOCK="$BATS_TEST_TMPDIR/capability-lock.json"
  run bash "$(VET)" \
    --candidate "$(FX)/$name" \
    --allowlist "$(FX)/allowlist.txt" \
    --lock "$LOCK" "$@"
}

# Every refusal names the condition it refused on, in one place, so a BLOCK is actionable.
_blocks_on() {
  [ "$status" -ne 0 ] || { echo "expected a BLOCK, got exit 0:"; echo "$output"; return 1; }
  [[ "$output" == *"BLOCK"* ]] || { echo "no BLOCK line: $output"; return 1; }
  [[ "$output" == *"[$1]"* ]] || { echo "BLOCKed, but not on [$1]: $output"; return 1; }
}

# ---------------------------------------------------------------------------
# The PASS half. Without these the eleven refusals below prove nothing.
# ---------------------------------------------------------------------------

@test "a candidate satisfying every condition PASSES" {
  _vet clean
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"PASS"* ]] || { echo "$output"; false; }
}

@test "a write-capable candidate PASSES when the human OK is recorded" {
  _vet write-capable-ok
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"write-capable"* ]] || { echo "the class was not stated: $output"; false; }
}

# ---------------------------------------------------------------------------
# One BLOCK per condition -- asserted once per condition, never once in total
# ---------------------------------------------------------------------------

@test "BLOCK: the candidate is not on the allowlist" {
  _vet no-allowlist
  _blocks_on allowlist
}

@test "BLOCK: the version is a range rather than a pin" {
  _vet no-version
  _blocks_on version
}

@test "BLOCK: no hash is recorded" {
  _vet no-hash
  _blocks_on hash
}

@test "BLOCK: provenance is one field where it must be two" {
  # publisher-auth and build-attestation answer different questions and are never collapsed
  # into one boolean (ADR-0110). Recording only the first is not provenance.
  _vet no-provenance
  _blocks_on provenance
}

@test "BLOCK: the content scan catches a planted exfiltration pattern" {
  _vet exfil
  _blocks_on content-scan
}

@test "BLOCK: the content scan catches a planted curl-pipe-sh" {
  _vet curl-pipe-sh
  _blocks_on content-scan
}

@test "BLOCK: a candidate that does not resolve is refused at the existence check" {
  _vet no-registry-record
  _blocks_on existence
}

@test "the existence check runs BEFORE anything else" {
  # A name that resolves to nothing must be refused first, not after five other opinions --
  # otherwise the report reads as though the thing exists and merely fails a policy.
  _vet no-registry-record
  local first
  first="$(echo "$output" | grep -E '^(BLOCK|PASS)' | head -1)"
  [[ "$first" == *"[existence]"* ]] || { echo "first verdict line was: $first"; false; }
}

@test "BLOCK: an unreadable candidate is treated as write-capable, not as clean" {
  # An absence of red flags is not a pass. A compiled blob routes to the human-OK path.
  _vet unreadable
  _blocks_on human-ok
  [[ "$output" == *"could not be read"* || "$output" == *"inconclusive"* ]] \
    || { echo "the reason was not stated: $output"; false; }
}

@test "BLOCK: a candidate claiming read-only while its source writes files" {
  # The self-report never overrides the scan (ADR-0110: ToolAnnotations are hints).
  _vet self-report-lies
  _blocks_on human-ok
  [[ "$output" == *"write"* ]] || { echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# Every BLOCK has a negative control: the same condition, satisfied, must PASS
# ---------------------------------------------------------------------------

@test "the allowlist check can pass as well as fail" {
  _vet clean
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _vet no-allowlist
  [ "$status" -ne 0 ]
}

@test "the human-OK check can pass as well as fail" {
  _vet write-capable-ok
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _vet self-report-lies
  [ "$status" -ne 0 ]
}

# ---------------------------------------------------------------------------
# The vet script never installs
# ---------------------------------------------------------------------------

@test "a hostile postinstall is scanned without ever executing" {
  local marker="$BATS_TEST_TMPDIR/postinstall-ran.txt"
  ARC_MARKER="$marker" _vet hostile-postinstall
  [ ! -e "$marker" ] || { echo "the candidate's lifecycle script RAN"; false; }
  # and it is still a real verdict, not a crash
  [[ "$output" == *"BLOCK"* || "$output" == *"PASS"* ]] || { echo "$output"; false; }
}

@test "the vet script does not invoke a package manager at all" {
  # Structural: reading the script is the only way to prove a command was never reachable,
  # and `npm install` inside a branch nothing exercises is still a loaded gun.
  run grep -nE '(npm|pnpm|yarn|pip|pip3|uv)[[:space:]]+(install|add|i)([[:space:]]|$)' "$(VET)"
  [ "$status" -ne 0 ] || { echo "an install command is present:"; echo "$output"; false; }
}

# ---------------------------------------------------------------------------
# The lock file
# ---------------------------------------------------------------------------

@test "a PASS writes version, hash, both provenance fields and the date checked" {
  _vet clean
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -f "$LOCK" ] || { echo "no lock file written"; false; }
  run node -e '
    const l = require(process.argv[1]);
    const r = (l.capabilities || []).find((c) => c.name === "safe-tool");
    if (!r) { console.log("no row"); process.exit(1); }
    for (const k of ["version", "hash", "publisher-auth", "build-attestation", "checked"]) {
      if (!r[k]) { console.log("missing " + k); process.exit(1); }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checked)) { console.log("bad date " + r.checked); process.exit(1); }
    console.log("row ok");
  ' "$LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "a BLOCK writes no lock row at all" {
  _vet exfil
  [ "$status" -ne 0 ]
  if [ -f "$LOCK" ]; then
    run grep -c 'safe-tool' "$LOCK"
    [ "$output" = "0" ] || { echo "a refused candidate was recorded: $(cat "$LOCK")"; false; }
  fi
}

@test "--audit reports a lock row checked more than 30 days ago" {
  LOCK="$BATS_TEST_TMPDIR/old-lock.json"
  cat > "$LOCK" <<'JSON'
{ "capabilities": [
  { "name": "safe-tool", "registry": "npm", "version": "1.2.3", "hash": "sha512-abc",
    "publisher-auth": "recorded", "build-attestation": "none published", "checked": "2020-01-01" } ] }
JSON
  run bash "$(VET)" --audit --lock "$LOCK"
  [[ "$output" == *"safe-tool"* ]] || { echo "$output"; false; }
  [[ "$output" == *"stale"* ]] || { echo "staleness was not reported: $output"; false; }
}

@test "--audit says so plainly when nothing is stale" {
  LOCK="$BATS_TEST_TMPDIR/fresh-lock.json"
  local today; today="$(date -u +%Y-%m-%d)"
  cat > "$LOCK" <<JSON
{ "capabilities": [
  { "name": "safe-tool", "registry": "npm", "version": "1.2.3", "hash": "sha512-abc",
    "publisher-auth": "recorded", "build-attestation": "none published", "checked": "$today" } ] }
JSON
  run bash "$(VET)" --audit --lock "$LOCK"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"stale"* ]] || { echo "a fresh row was called stale: $output"; false; }
}

# ---------------------------------------------------------------------------
# The scout reports and installs nothing; the command exists; the manifest lists them
# ---------------------------------------------------------------------------

@test "the capability-scout agent has no write tools" {
  local a="$ARC_ROOT/.claude/agents/capability-scout.md"
  [ -f "$a" ] || { echo "no agent definition"; false; }
  run grep -iE '^tools:.*(Write|Edit|NotebookEdit)' "$a"
  [ "$status" -ne 0 ] || { echo "the scout can write: $output"; false; }
}

@test "the arc-capability command exists and says it installs nothing" {
  local c="$ARC_ROOT/.claude/commands/arc-capability.md"
  [ -f "$c" ] || { echo "no command file"; false; }
  run grep -iE 'installs? nothing|never installs|refuses to install' "$c"
  [ "$status" -eq 0 ] || { echo "the command does not state its own limit"; false; }
}

@test "the product manifest lists every new file" {
  local m="$ARC_ROOT/products/develop/manifest.json"
  run node -e '
    const m = require(process.argv[1]);
    const want = {
      scripts:  ".claude/scripts/develop/capability-vet.sh",
      commands: ".claude/commands/arc-capability.md",
      agents:   ".claude/agents/capability-scout.md",
    };
    for (const [k, v] of Object.entries(want)) {
      if (!(m[k] || []).includes(v)) { console.log("manifest " + k + " is missing " + v); process.exit(1); }
    }
    console.log("manifest ok");
  ' "$m"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "root CLAUDE.md lists /arc-capability among its commands" {
  run grep -n '/arc-capability' "$ARC_ROOT/CLAUDE.md"
  [ "$status" -eq 0 ] || { echo "a new top-level entry point that nothing announces"; false; }
}

# ---------------------------------------------------------------------------
# The one REAL candidate, vetted by hand and committed as an artifact
# ---------------------------------------------------------------------------

@test "the committed lock file holds a real, vetted candidate" {
  # ADR-0110 separates vetting from installing, so arc gains a lock row and NO dependency.
  # This asserts the artifact of that hand-run, never a live fetch: CI reaches no registry.
  local lock="$ARC_ROOT/.claude/scripts/develop/capability-lock.json"
  [ -f "$lock" ] || { echo "no committed lock file"; false; }
  run node -e '
    const l = require(process.argv[1]);
    const rows = l.capabilities || [];
    if (!rows.length) { console.log("the lock file records nothing"); process.exit(1); }
    for (const r of rows) {
      for (const k of ["name", "registry", "version", "hash", "publisher-auth", "build-attestation", "checked", "source"]) {
        if (!r[k]) { console.log(r.name + " is missing " + k); process.exit(1); }
      }
      if (!/^sha(256|512)-/.test(r.hash)) { console.log(r.name + " hash is not a registry integrity string"); process.exit(1); }
    }
    console.log("real row(s): " + rows.map((r) => r.name + "@" + r.version).join(", "));
  ' "$lock"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "vetting a real candidate added no dependency to this repo" {
  # The whole point of ADR-0110's separation. If vetting ever installs, this fails.
  [ ! -e "$ARC_ROOT/node_modules" ] || { echo "node_modules exists in arc"; false; }
  # Guarded: arc has no package.json today, and `grep` on a missing file also exits non-zero.
  # An assertion that passes because the file is absent proves nothing about dependencies --
  # that is the vacuous pass Phase 05 shipped and CI caught.
  if [ -f "$ARC_ROOT/package.json" ]; then
    run grep -nE '"(dependencies|devDependencies)"' "$ARC_ROOT/package.json"
    [ "$status" -ne 0 ] || { echo "arc gained dependencies: $output"; false; }
  fi
}

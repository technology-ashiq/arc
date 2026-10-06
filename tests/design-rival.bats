#!/usr/bin/env bats
# Cycle 16 Phase 07 S1+S2 (REQ-09) -- a rival's draft for a brief, and every way it can fail.
#
# The adapter sends the SAME brief the composers read, whole, and prints exactly one status line.
# A provider failure is COULD-NOT-DRAFT with a named reason -- the jury degrades on it -- never a
# crash and never a silent skip. The bad-key shape is the one Phase 06 observed live; rate-limit and
# quota were not reached live, so they are driven here on the fake (the Phase 06 amendment's debt).
#
# OFFLINE-FIRST: every case drives --fake-answer. The real transport is the S2 contract run, recorded
# in the phase evidence, never a CI test.
bats_require_minimum_version 1.5.0
load 'test_helper'

_rival() { echo "$SANDBOX/.claude/scripts/design/design-rival.mjs"; }
_out() { echo "$SANDBOX/.claude/state/design/rivals/demo/r1"; }
_sha() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' "$1"; }
_sha16s() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update(process.argv[1]).digest("hex").slice(0,16))' "$1"; }

_answer() { printf '%s\n' "$1" > "$BATS_TEST_TMPDIR/answer.json"; }
_ok_answer() {
  _answer '{"ok":true,"screen":{"id":"screen0123456789abcdef","projectId":"p1","deviceType":"DESKTOP"},"htmlUrl":"https://contribution.usercontent.google.com/download?c=x","html":"<!doctype html><html><head><link href=\"https://fonts.googleapis.com\" rel=\"preconnect\"/><link href=\"https://fonts.googleapis.com/css2?family=Inter&amp;display=swap\" rel=\"stylesheet\"/><script src=\"https://cdn.tailwindcss.com?plugins=forms\"></script></head><body><h1>Case</h1><a href=\"https://example.org/help\">help</a></body></html>"}'
}
# The recorded asset set: the Tailwind runtime, one Google Fonts stylesheet naming one font file.
_assets() {
  local d="$BATS_TEST_TMPDIR/assets"
  mkdir -p "$d"
  printf 'window.tailwind={};
' > "$d/tw.js"
  printf '@font-face{font-family:Inter;src:url(https://fonts.gstatic.com/s/inter/v1/a.woff2) format("woff2")}
' > "$d/inter.css"
  printf 'wOF2-fake-font-bytes' > "$d/a.woff2"
  cat > "$d/index.json" <<'JSON'
{"https://cdn.tailwindcss.com?plugins=forms":{"type":"text/javascript","file":"tw.js"},
 "https://fonts.googleapis.com/css2?family=Inter&display=swap":{"type":"text/css; charset=utf-8","file":"inter.css"},
 "https://fonts.gstatic.com/s/inter/v1/a.woff2":{"type":"font/woff2","file":"a.woff2"}}
JSON
  [ -s "$d/index.json" ] && [ -s "$d/inter.css" ]
}
_page() { echo "$SANDBOX/docs/design/explore/r1/rival-stitch/index.html"; }

setup() {
  _arc_design_sandbox
  mkdir -p "$SANDBOX/docs/design/briefs/demo"
  printf '# Design brief -- demo\n\n## A. Interaction model\nOne case, its status first.\n' > "$SANDBOX/docs/design/briefs/demo/brief.md"
  unset STITCH_API_KEY
  # An absolute path to a store that does not exist: the owner's real key store is never read.
  export ARC_KEYS_FILE="$BATS_TEST_TMPDIR/no-keys.json"
}

teardown() { rm -rf "$SANDBOX"; }

@test "rival: a fake answer drafts -- one status line, the raw bytes kept, the whole brief sent" {
  export STITCH_API_KEY="test-key-0123456789"
  _ok_answer
  _assets
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --record-request "$BATS_TEST_TMPDIR/req.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
  [ "$status" -eq 0 ]
  [ "${#lines[@]}" -eq 1 ]
  [[ "${lines[0]}" =~ ^"rival stitch: DRAFTED "[0-9]+" bytes, 3 assets vendored (stitch-sdk 0.3.5, screen screen012345)"$ ]]
  [ -f "$(_out)/stitch/draft.raw.html" ]
  grep -q 'cdn.tailwindcss.com' "$(_out)/stitch/draft.raw.html"
  # The prompt is the brief file, byte for byte: its hash in the receipt is the file's hash.
  want="$(_sha "$SANDBOX/docs/design/briefs/demo/brief.md")"
  node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));if(r.request.prompt_sha256!==process.argv[2]||r.status!=="DRAFTED"||r.mode!=="fake"||r.html.sha256.length!==64)process.exit(1)' "$(_out)/stitch/receipt.json" "$want"
  node -e 'const q=JSON.parse(require("fs").readFileSync(process.argv[1]));const b=require("fs").readFileSync(process.argv[2],"utf8");if(q.prompt!==b||q.deviceType!=="DESKTOP"||q.key_env!=="STITCH_API_KEY"||q.key_sha16!==process.argv[3])process.exit(1)' "$BATS_TEST_TMPDIR/req.json" "$SANDBOX/docs/design/briefs/demo/brief.md" "$(_sha16s test-key-0123456789)"
  ! grep -rq 'test-key-0123456789' "$(_out)"
  [ "$(wc -l < "$(_out)/status.log" | tr -d ' ')" -eq 1 ]
}

@test "rival: no key is COULD-NOT-DRAFT (no key), recorded, not a crash" {
  _ok_answer
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (no key)" ]
  [ ! -e "$(_out)/stitch/draft.raw.html" ]
  grep -q $'\tstitch\tCOULD-NOT-DRAFT\t(no key)$' "$(_out)/status.log"
}

@test "rival: the bad-key shape Phase 06 observed (UNKNOWN_ERROR + isError text) is (bad key)" {
  export STITCH_API_KEY="test-key-0123456789"
  _answer '{"ok":false,"error":{"name":"StitchError","code":"UNKNOWN_ERROR","message":"Streamable HTTP error: Error POSTing to endpoint: {\"id\":1,\"jsonrpc\":\"2.0\",\"result\":{\"content\":[{\"text\":\"API key not valid. Please pass a valid API key.\",\"type\":\"text\"}],\"isError\":true}}"}}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (bad key)" ]
}

@test "rival: a rate-limit answer is (rate-limit) and a quota answer is (quota) -- never confused" {
  export STITCH_API_KEY="test-key-0123456789"
  _answer '{"ok":false,"error":{"name":"StitchError","code":429,"message":"Too Many Requests"}}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (rate-limit)" ]
  _answer '{"ok":false,"error":{"name":"StitchError","code":429,"message":"RESOURCE_EXHAUSTED: Quota exceeded for generations per day"}}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (quota)" ]
  [ "$(wc -l < "$(_out)/status.log" | tr -d ' ')" -eq 2 ]
}

@test "rival: an unrecognised failure names its code, and a key echoed back is scrubbed" {
  export STITCH_API_KEY="test-key-0123456789"
  _answer '{"ok":false,"error":{"name":"StitchError","code":"UNKNOWN_ERROR","message":"backend said no to test-key-0123456789"}}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (provider error UNKNOWN_ERROR)" ]
  grep -q '<key>' "$(_out)/stitch/receipt.json"
  ! grep -rq 'test-key-0123456789' "$(_out)"
}

@test "rival: an HTML URL off the known host, or not https, is an unusable answer and writes no draft" {
  export STITCH_API_KEY="test-key-0123456789"
  _answer '{"ok":true,"screen":{"id":"s1"},"htmlUrl":"https://evil.example/x.html","html":"<html></html>"}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (unusable answer (the HTML is served from evil.example, not a known host))" ]
  _answer '{"ok":true,"screen":{"id":"s1"},"htmlUrl":"http://contribution.usercontent.google.com/x","html":"<html></html>"}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (unusable answer (the HTML URL is not https))" ]
  [ ! -e "$(_out)/stitch/draft.raw.html" ]
}

@test "rival: a provider message cannot forge a second status line" {
  export STITCH_API_KEY="test-key-0123456789"
  _answer '{"ok":true,"screen":{"id":"s1"},"htmlUrl":"https://bad.example\n/x","html":"x"}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${#lines[@]}" -eq 1 ]
  [[ "${lines[0]}" == "rival stitch: COULD-NOT-DRAFT ("* ]]
}

@test "rival: the seams are refused outside the offline sandbox" {
  _ok_answer
  # Exported, not a prefix on `run`: a prefix never reaches the child.
  export ARC_DESIGN_OFFLINE=0
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 1 ]
  [[ "$output" == *"--fake-answer is a test seam; set ARC_DESIGN_OFFLINE=1"* ]]
  [ ! -e "$(_out)/status.log" ]
}

@test "rival: a bad id, a missing brief or an unknown provider is a usage error with no status line" {
  run node "$(_rival)" draft --brief ../demo --run r1
  [ "$status" -eq 1 ]
  [[ "$output" == *"is not an id"* ]]
  run node "$(_rival)" draft --brief nope --run r1
  [ "$status" -eq 1 ]
  [[ "$output" == *"no brief at docs/design/briefs/nope/brief.md"* ]]
  run node "$(_rival)" draft --brief demo --run r1 --provider v0
  [ "$status" -eq 1 ]
  [[ "$output" == *"is not a rival arc knows"* ]]
  [ ! -e "$SANDBOX/.claude/state/design/rivals/demo" ]
}

@test "rival: vendoring points every load at a local copy, the font one level down, and nothing else changes" {
  export STITCH_API_KEY="test-key-0123456789"
  _ok_answer
  _assets
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
  [ "$status" -eq 0 ]
  [ -f "$(_page)" ]
  # No remote load is left; the anchor (navigation, not a load) is untouched.
  ! grep -qE '(src|href)="https?://(cdn.tailwindcss.com|fonts.g)' "$(_page)"
  grep -q 'href="https://example.org/help"' "$(_page)"
  grep -q '<h1>Case</h1>' "$(_page)"
  grep -q 'href="about:blank"' "$(_page)"
  # The stylesheet's font URL was rewritten to the vendored file beside it.
  css="$(grep -oE 'assets/[0-9a-f]{16}.css' "$(_page)" | head -1)"
  [ -n "$css" ]
  grep -qE 'url([0-9a-f]{16}.woff2)' "$SANDBOX/docs/design/explore/r1/rival-stitch/$css"
  [ "$(ls "$SANDBOX/docs/design/explore/r1/rival-stitch/assets" | wc -l | tr -d ' ')" -eq 3 ]
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1]));if(v.assets.length!==3||v.rewrites.length<4||!v.assets.every(a=>a.sha256.length===64))process.exit(1)' "$(_out)/stitch/vendor.json"
}

@test "rival: a load from a fourth host is named, and the draft leaves the jury" {
  export STITCH_API_KEY="test-key-0123456789"
  _assets
  _answer '{"ok":true,"screen":{"id":"s1"},"htmlUrl":"https://contribution.usercontent.google.com/d","html":"<html><head><script src=\"https://cdn.tailwindcss.com?plugins=forms\"></script></head><body><img src=\"https://lh3.googleusercontent.com/x.png\"></body></html>"}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
  [ "$status" -eq 3 ]
  [[ "${lines[0]}" == "rival stitch: COULD-NOT-DRAFT (not self-contained (1 unresolved: https://lh3.googleusercontent.com/x.png: host lh3.googleusercontent.com is not an allowed asset host))" ]]
  [ ! -e "$SANDBOX/docs/design/explore/r1/rival-stitch" ]
  [ -f "$(_out)/stitch/draft.raw.html" ]
  grep -q 'lh3.googleusercontent.com' "$(_out)/stitch/receipt.json"
}

@test "rival: an asset that fails to download, or is plain http, is unresolved -- never a half-online page" {
  export STITCH_API_KEY="test-key-0123456789"
  _assets
  _answer '{"ok":true,"screen":{"id":"s1"},"htmlUrl":"https://contribution.usercontent.google.com/d","html":"<html><head><link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/missing.css\"><script src=\"http://cdn.tailwindcss.com/x.js\"></script></head><body></body></html>"}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
  [ "$status" -eq 3 ]
  [[ "${lines[0]}" == "rival stitch: COULD-NOT-DRAFT (not self-contained (2 unresolved: "* ]]
  [ ! -e "$SANDBOX/docs/design/explore/r1/rival-stitch" ]
}

@test "rival: a rival dir is never tracked by git, whatever the explore" {
  run git -C "$ARC_ROOT" check-ignore -q docs/design/explore/any-brief-explore/rival-stitch/index.html
  [ "$status" -eq 0 ]
  run git -C "$ARC_ROOT" check-ignore -q docs/design/explore/any-brief-explore/variant-a/index.html
  [ "$status" -eq 1 ]
}

@test "rival: the suite registered all of its tests" {
  run grep -c '^@test ' "$BATS_TEST_FILENAME"
  [ "$output" -eq 14 ]
}

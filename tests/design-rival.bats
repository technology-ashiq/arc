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
  _answer '{"ok":true,"screen":{"id":"screen0123456789abcdef","projectId":"p1","deviceType":"DESKTOP","htmlCode":{"downloadUrl":"https://contribution.usercontent.google.com/download?c=x"}},"htmlUrl":"https://contribution.usercontent.google.com/download?c=x","html":"<!doctype html><html><head><link href=\"https://fonts.googleapis.com\" rel=\"preconnect\"/><link href=\"https://fonts.googleapis.com/css2?family=Inter&amp;display=swap\" rel=\"stylesheet\"/><script src=\"https://cdn.tailwindcss.com?plugins=forms\"></script></head><body><h1>Case</h1><a href=\"https://example.org/help\">help</a></body></html>"}'
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
  # ERE: the parens are literal, escaped -- unescaped they were a group, and the line could never match.
  grep -qE 'url\([0-9a-f]{16}\.woff2\)' "$SANDBOX/docs/design/explore/r1/rival-stitch/$css"
  [ "$(ls "$SANDBOX/docs/design/explore/r1/rival-stitch/assets" | wc -l | tr -d ' ')" -eq 3 ]
  node -e 'const v=JSON.parse(require("fs").readFileSync(process.argv[1]));if(v.assets.length!==3||v.rewrites.length<4||!v.assets.every(a=>a.sha256.length===64))process.exit(1)' "$(_out)/stitch/vendor.json"
}

@test "rival: a load from a fourth host is named, and the draft leaves the jury" {
  export STITCH_API_KEY="test-key-0123456789"
  _assets
  _answer '{"ok":true,"screen":{"id":"s1","htmlCode":{"downloadUrl":"https://contribution.usercontent.google.com/d"}},"htmlUrl":"https://contribution.usercontent.google.com/d","html":"<html><head><script src=\"https://cdn.tailwindcss.com?plugins=forms\"></script></head><body><img src=\"https://lh3.googleusercontent.com/x.png\"></body></html>"}'
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
  _answer '{"ok":true,"screen":{"id":"s1","htmlCode":{"downloadUrl":"https://contribution.usercontent.google.com/d"}},"htmlUrl":"https://contribution.usercontent.google.com/d","html":"<html><head><link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/missing.css\"><script src=\"http://cdn.tailwindcss.com/x.js\"></script></head><body></body></html>"}'
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

# ---------- attack 65d01cc round 1 ----------

# An ok answer whose html is $1 (JSON-escaped), bound to its screen's own download URL.
_html_answer() {
  _answer "{\"ok\":true,\"screen\":{\"id\":\"s1\",\"htmlCode\":{\"downloadUrl\":\"https://contribution.usercontent.google.com/d\"}},\"htmlUrl\":\"https://contribution.usercontent.google.com/d\",\"html\":\"$1\"}"
}

@test "rival: a remote load the old reader missed is refused -- unquoted, base, refresh, inline style, svg, entity, protocol-relative (B1)" {
  export STITCH_API_KEY="test-key-0123456789"
  _assets
  local n=0 h
  for h in \
    '<script src=https://evil.example/x.js></script>' \
    '<base href=\"https://evil.example/\">' \
    '<meta http-equiv=\"refresh\" content=\"0;url=https://evil.example/\">' \
    '<div style=\"background:url(https://evil.example/p.png)\"></div>' \
    '<svg><image xlink:href=\"https://evil.example/p.png\"/></svg>' \
    '<img src=\"ht&#x74;ps://evil.example/p.png\">' \
    '<video poster=\"//evil.example/p.png\"></video>'; do
    _html_answer "<html><body>$h</body></html>"
    run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
    [ "$status" -eq 3 ] || { echo "drafted a page that loads evil.example: $h -> $output"; false; }
    [[ "${lines[0]}" == "rival stitch: COULD-NOT-DRAFT (not self-contained ("* ]] || { echo "wrong refusal for $h: $output"; false; }
    [ ! -e "$(_page)" ] || { echo "a page was written for $h"; false; }
    n=$((n + 1))
  done
  [ "$n" -eq 7 ]
}

@test "rival: only the load is rewritten -- the same URL in an anchor and in body text is left alone (B2, L8, L11)" {
  export STITCH_API_KEY="test-key-0123456789"
  _assets
  _html_answer '<html><head><link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Inter&amp;display=swap\"></head><body><a href=\"https://fonts.googleapis.com/css2?family=Inter&amp;display=swap\">same</a><pre>https://fonts.googleapis.com/css2?family=Inter&amp;display=swap</pre></body></html>'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  grep -q '<a href="https://fonts.googleapis.com/css2?family=Inter&amp;display=swap">same</a>' "$(_page)" || { echo "the anchor was rewritten: $(cat "$(_page)")"; false; }
  grep -q '<pre>https://fonts.googleapis.com/css2?family=Inter&amp;display=swap</pre>' "$(_page)" || { echo "body text was rewritten"; false; }
  grep -qE '<link rel="stylesheet" href="assets/[0-9a-f]{16}\.css">' "$(_page)" || { echo "the load itself was not rewritten"; false; }
}

@test "rival: an HTML URL on a non-default port, or not the screen's own download, is an unusable answer (B4, L9)" {
  export STITCH_API_KEY="test-key-0123456789"
  _answer '{"ok":true,"screen":{"id":"s1","htmlCode":{"downloadUrl":"https://contribution.usercontent.google.com:8443/d"}},"htmlUrl":"https://contribution.usercontent.google.com:8443/d","html":"<html></html>"}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (unusable answer (the HTML URL names port 8443))" ]
  _answer '{"ok":true,"screen":{"id":"s1","htmlCode":{"downloadUrl":"https://contribution.usercontent.google.com/mine"}},"htmlUrl":"https://contribution.usercontent.google.com/other","html":"<html></html>"}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (unusable answer (the HTML URL is not the screen's own htmlCode download))" ]
}

@test "rival: a failed re-draft keeps the earlier page, and its record never carries the earlier vendor record (B5, B6, L12)" {
  export STITCH_API_KEY="test-key-0123456789"
  _ok_answer
  _assets
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  before="$(_sha "$(_page)")"
  node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1]));if(r.vendored.page_sha256!==process.argv[2])process.exit(1)' "$(_out)/stitch/receipt.json" "$before" \
    || { echo "the receipt does not carry the vendored page hash"; false; }
  _html_answer '<html><body><img src=\"https://lh3.googleusercontent.com/x.png\"></body></html>'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
  [ "$status" -eq 3 ]
  [ "$(_sha "$(_page)")" = "$before" ] || { echo "a failed attempt removed or changed the earlier page"; false; }
  grep -q '"status": "COULD-NOT-DRAFT"' "$(_out)/stitch/receipt.json"
  [ ! -e "$(_out)/stitch/vendor.json" ] || { echo "the earlier vendor record sits beside a failed receipt"; false; }
  [ ! -e "$(_out)/stitch/stage" ] || { echo "the staging dir was left behind"; false; }
}

@test "rival: a rival dir that is a symlink is refused before anything is removed or written through it (B5)" {
  export STITCH_API_KEY="test-key-0123456789"
  _ok_answer
  _assets
  mkdir -p "$SANDBOX/docs/design/explore/r1" "$BATS_TEST_TMPDIR/elsewhere"
  printf 'keep\n' > "$BATS_TEST_TMPDIR/elsewhere/keep.txt"
  ln -s "$BATS_TEST_TMPDIR/elsewhere" "$SANDBOX/docs/design/explore/r1/rival-stitch" 2>/dev/null || true
  [ -L "$SANDBOX/docs/design/explore/r1/rival-stitch" ] || skip "this filesystem made a copy, not a symlink"
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
  [ "$status" -eq 3 ]
  [[ "${lines[0]}" == *"is a link or not a directory"* ]] || { echo "$output"; false; }
  [ -f "$BATS_TEST_TMPDIR/elsewhere/keep.txt" ] && [ ! -e "$BATS_TEST_TMPDIR/elsewhere/index.html" ] || { echo "the run wrote or removed through the link"; false; }
}

@test "rival: a crash inside the attempt is one status line and exit 3, never a stack trace or the usage code (B11)" {
  export STITCH_API_KEY="test-key-0123456789"
  _ok_answer
  mkdir -p "$BATS_TEST_TMPDIR/broken"
  printf 'not json\n' > "$BATS_TEST_TMPDIR/broken/index.json"
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/broken"
  [ "$status" -eq 3 ] || { echo "a crash exited $status: $output"; false; }
  [ "${#lines[@]}" -eq 1 ] || { echo "not one line: $output"; false; }
  [[ "${lines[0]}" == "rival stitch: COULD-NOT-DRAFT (internal error "* ]] || { echo "$output"; false; }
}

@test "rival: a fake run never opens the owner's key store (L10)" {
  printf '{"schema":1,"keys":[{"name":"STITCH_API_KEY","value":"store-key-0123456789"}]}\n' > "$BATS_TEST_TMPDIR/keys.json"
  export ARC_KEYS_FILE="$BATS_TEST_TMPDIR/keys.json"
  _ok_answer
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ]
  [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (no key)" ] || { echo "a fake run read the key store: $output"; false; }
}

@test "rival: a font served with a generic type is still named by its bytes (L7)" {
  export STITCH_API_KEY="test-key-0123456789"
  _ok_answer
  _assets
  sed -i.bak 's#"type":"font/woff2"#"type":"application/octet-stream"#' "$BATS_TEST_TMPDIR/assets/index.json"
  grep -q 'application/octet-stream' "$BATS_TEST_TMPDIR/assets/index.json" || { echo "fixture: the type was not changed"; false; }
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  ls "$SANDBOX/docs/design/explore/r1/rival-stitch/assets" | grep -qE '^[0-9a-f]{16}\.woff2$' || { echo "the font was not named .woff2: $(ls "$SANDBOX/docs/design/explore/r1/rival-stitch/assets")"; false; }
}

# ---------- attack ae0aeb8 round 2 ----------

@test "rival: an HTML URL path with a dot segment, raw or percent-encoded, is an unusable answer (L7)" {
  export STITCH_API_KEY="test-key-0123456789"
  local u
  for u in 'https://contribution.usercontent.google.com/a/../d' 'https://contribution.usercontent.google.com/a/%2e%2e/d' 'https://contribution.usercontent.google.com/a%2fb'; do
    _answer "{\"ok\":true,\"screen\":{\"id\":\"s1\",\"htmlCode\":{\"downloadUrl\":\"$u\"}},\"htmlUrl\":\"$u\",\"html\":\"<html></html>\"}"
    run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
    [ "$status" -eq 3 ] && [ "${lines[0]}" = "rival stitch: COULD-NOT-DRAFT (unusable answer (the HTML URL path carries a dot segment or an encoded slash))" ] || { echo "took $u: $output"; false; }
  done
}

@test "rival: a key holding a quote is scrubbed in its JSON-escaped spelling too (L12)" {
  export STITCH_API_KEY='test-key-"quoted"-0123456789'
  _answer '{"ok":false,"error":{"name":"StitchError","code":"UNKNOWN_ERROR","message":"backend said no to test-key-\"quoted\"-0123456789"}}'
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 3 ] || { echo "$output"; false; }
  grep -q '<key>' "$(_out)/stitch/receipt.json" || { echo "nothing was scrubbed: $(cat "$(_out)/stitch/receipt.json")"; false; }
  ! grep -q 'quoted' "$(_out)/stitch/receipt.json" || { echo "the key survived in its escaped spelling"; false; }
}

@test "rival: a vendored stylesheet with a url() the reader cannot decode is refused, not left online (B2)" {
  export STITCH_API_KEY="test-key-0123456789"
  _ok_answer
  _assets
  printf '@font-face{font-family:Inter;src:url(\\68ttps://fonts.gstatic.com/s/inter/v1/a.woff2)}\n' > "$BATS_TEST_TMPDIR/assets/inter.css"
  grep -q '68ttps' "$BATS_TEST_TMPDIR/assets/inter.css" || { echo "fixture: escape not written"; false; }
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json" --fake-assets "$BATS_TEST_TMPDIR/assets"
  [ "$status" -eq 3 ] && [[ "${lines[0]}" == "rival stitch: COULD-NOT-DRAFT (not self-contained ("* ]] || { echo "an escaped stylesheet load was drafted: $output"; false; }
  [ ! -e "$(_page)" ]
}

@test "rival: a state dir that is a symlink is refused before the record is written through it (B9)" {
  export STITCH_API_KEY="test-key-0123456789"
  _ok_answer
  mkdir -p "$SANDBOX/.claude/state/design/rivals/demo" "$BATS_TEST_TMPDIR/elsewhere"
  ln -s "$BATS_TEST_TMPDIR/elsewhere" "$SANDBOX/.claude/state/design/rivals/demo/r1" 2>/dev/null || true
  [ -L "$SANDBOX/.claude/state/design/rivals/demo/r1" ] || skip "this filesystem made a copy, not a symlink"
  run node "$(_rival)" draft --brief demo --run r1 --fake-answer "$BATS_TEST_TMPDIR/answer.json"
  [ "$status" -eq 1 ] && [[ "$output" == *"is a link or not a directory"* ]] || { echo "$status $output"; false; }
  [ -z "$(ls -A "$BATS_TEST_TMPDIR/elsewhere")" ] || { echo "the record was written through the link"; false; }
}

@test "rival: the suite registered all of its tests" {
  run grep -c '^@test ' "$BATS_TEST_FILENAME"
  [ "$output" -eq 26 ]
}

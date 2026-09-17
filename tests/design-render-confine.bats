#!/usr/bin/env bats
# Cycle 16 Phase 01 -- an explore render is confined to its own variant directory (ADR-1418).
#
# Why this suite exists: the fifth adversarial pass (BL-1 = BS-1, both attackers independently)
# had a composer write `<iframe src="../variant-b/index.html">` into its OWN page. Its write
# boundary allowed the file, its Bash boundary allowed the render, and design-render.sh opened
# the page as file://, which loads any file on disk. The sibling's pixels landed in the
# composer's own session PNG -- the one render it is allowed to read. The page was the attack.
#
# The fake browser cannot run a page, so it plays the page's REQUESTS against the loopback
# server the renderer starts: what a browser sends for `../variant-b/index.html` from
# `/index.html` is `/variant-b/index.html`. Whether a real Chromium actually refuses a file://
# subresource under the served policy is NOT provable here -- that is the live re-render and
# the attack pass, written down in ADR-1418.
bats_require_minimum_version 1.5.0
load 'test_helper'

_confine_sandbox() {
  _arc_design_sandbox
  # Required, not skipped: a skip here would turn every case below into a pass on a leg that
  # proved nothing.
  command -v node >/dev/null 2>&1 || { echo "node is required: explore renders are served by a node loopback server (ADR-1418)" >&2; return 1; }
  command -v curl >/dev/null 2>&1 || { echo "curl is required: the fake browser plays the page's requests with it" >&2; return 1; }
  mkdir -p "$SANDBOX/bin" "$SANDBOX/fakestate" "$SANDBOX/docs"
  cp "$ARC_ROOT/tests/fixtures/design/fake-agent-browser.sh" "$SANDBOX/bin/agent-browser"
  chmod +x "$SANDBOX/bin/agent-browser"
  PATH="$SANDBOX/bin:$PATH"; export PATH
  FAKE_AB_STATE="$SANDBOX/fakestate"; export FAKE_AB_STATE
  EX="$SANDBOX/docs/design/explore/t1"
  mkdir -p "$EX/variant-a" "$EX/variant-b"
  printf '<!doctype html><title>own</title><link rel="stylesheet" href="tokens.css"><p>variant a own page</p>\n' > "$EX/variant-a/index.html"
  printf ':root { --own: 1; }\n' > "$EX/variant-a/tokens.css"
  printf '<!doctype html><title>sibling</title><p>SIBLING-SECRET variant b thesis</p>\n' > "$EX/variant-b/index.html"
  printf 'MATRIX-SECRET structure dimensions\n' > "$EX/matrix.md"
  printf '<!doctype html><title>critique</title><p>a product route</p>\n' > "$SANDBOX/docs/one.html"
  git -C "$SANDBOX" add -A >/dev/null 2>&1
  git -C "$SANDBOX" commit -qm pages >/dev/null 2>&1
  RENDERS="$SANDBOX/.claude/state/design/renders"
  ROUTE="docs/design/explore/t1/variant-a/index.html"
  STEM="$RENDERS/t1--variant-a/docs--design--explore--t1--variant-a--index-html--1440x900"
}

_rs() { echo "$SANDBOX/.claude/scripts/design/design-render.sh"; }
_serve_js() { echo "$SANDBOX/.claude/scripts/design/design-render-serve.mjs"; }

# `! cmd` in the middle of a bats test never fails it: bash's errexit ignores a negated
# pipeline. Every absence below goes through this instead.
_not() { if "$@"; then echo "expected false, was true: $*" >&2; return 1; fi; return 0; }
_has()   { printf '%s' "$1" | grep -q -- "$2"; }
_has_i() { printf '%s' "$1" | grep -qi -- "$2"; }

# Wipes what one render leaves behind, so a loop's second pass cannot pass on the first's files.
_reset() {
  rm -rf "$RENDERS" "$FAKE_AB_STATE" 2>/dev/null || true
  mkdir -p "$FAKE_AB_STATE"
}

# A hard wall-clock bound: a server that outlives its render must FAIL a case, never hang the leg.
# Output goes to files, not a pipe -- a leaked server holding a pipe open would block `run`.
# `stderr` is kept apart from `output` (stdout then stderr): a refusal is a stderr contract, and an
# assertion on merged output passes on a refusal printed to the wrong stream (running defect #15).
_run_bounded() {
  local secs="$1"; shift
  local pid killer st
  "$@" >"$BATS_TEST_TMPDIR/bounded.out" 2>"$BATS_TEST_TMPDIR/bounded.err" 3>&- &
  pid=$!
  ( sleep "$secs"; kill -9 "$pid" 2>/dev/null ) >/dev/null 2>&1 3>&- &
  killer=$!
  # `|| st=$?`, not `; st=$?`: called bare in a test, a non-zero wait would trip errexit here
  # and end the case before the status it exists to report was ever set.
  st=0
  wait "$pid" || st=$?
  kill "$killer" 2>/dev/null || true
  # Reaped quietly: an unreaped killer prints "Terminated: 15" into every failure's output.
  wait "$killer" 2>/dev/null || true
  stderr="$(cat "$BATS_TEST_TMPDIR/bounded.err" 2>/dev/null || true)"
  output="$(cat "$BATS_TEST_TMPDIR/bounded.out" "$BATS_TEST_TMPDIR/bounded.err" 2>/dev/null || true)"
  status="$st"
  [ "$st" -ne 137 ] || { echo "TIMED OUT after ${secs}s" >&2; return 1; }
  return 0
}

_render() { _run_bounded 90 bash "$(_rs)" "$ROUTE" --mode explore --session t1--variant-a "$@"; }

# The port the renderer served on, read from the URL the browser was handed.
_opened_port() {
  local u rest
  u="$(cat "$FAKE_AB_STATE/url" 2>/dev/null)"
  case "$u" in
    http://127.0.0.1:*/*) ;;
    *) echo "the page was not opened over loopback: '$u'" >&2; return 1;;
  esac
  rest="${u#http://127.0.0.1:}"
  PORT="${rest%%/*}"
}

# Closed means refused: curl exits 7. A 404 is still a live server.
_port_closed() {
  local p="$1" i=0
  while [ "$i" -lt 60 ]; do
    curl -s --max-time 2 -o /dev/null "http://127.0.0.1:$p/" 3>&- || return 0
    sleep 0.1; i=$((i + 1))
  done
  return 1
}

_serve() {
  node "$(_serve_js)" --root "$1" --dir "$2" --max-seconds "$3" </dev/null >/dev/null 2>&1 3>&- &
  printf '%s\n' "$!" >> "$BATS_TEST_TMPDIR/pids"
}

_wait_port() {
  local i=0
  while [ "$i" -lt 150 ]; do
    if [ -s "$1/port" ]; then PORT="$(cat "$1/port")"; return 0; fi
    sleep 0.1; i=$((i + 1))
  done
  return 1
}

teardown() {
  if [ -f "$BATS_TEST_TMPDIR/pids" ]; then
    while read -r p; do kill "$p" 2>/dev/null || true; done < "$BATS_TEST_TMPDIR/pids"
  fi
  cd "$ARC_ROOT" 2>/dev/null || true
  _arc_teardown
}

# ---------- 1. the render goes over loopback, under a policy ----------

@test "confine: an explore render opens its page over loopback, never file://, and records the transport" {
  _confine_sandbox
  _render
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  local url; url="$(cat "$FAKE_AB_STATE/url")"
  echo "$url" | grep -Eq '^http://127\.0\.0\.1:[0-9]+/index\.html$' || { echo "opened: $url"; false; }
  [ -f "$STEM.json" ]
  grep -q 'confined-loopback' "$STEM.json"
}

@test "confine: the served page carries a same-origin policy, frames only from itself, no popups" {
  _confine_sandbox
  _render
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # It RAN: the fake fetched the page through the server and got the page's own bytes.
  grep -q 'variant a own page' "$FAKE_AB_STATE/page.body"
  local csp
  csp="$(grep -i '^content-security-policy:' "$FAKE_AB_STATE/headers")"
  [ -n "$csp" ] || { cat "$FAKE_AB_STATE/headers"; false; }
  echo "$csp" | grep -q "default-src 'self'"
  echo "$csp" | grep -q "frame-src 'self'"
  echo "$csp" | grep -q "object-src 'none'"
  echo "$csp" | grep -q "base-uri 'none'"
  echo "$csp" | grep -q "sandbox allow-scripts allow-same-origin"
  _not _has "$csp" 'allow-popups'
  _not _has_i "$csp" 'file:'
  _not _has "$csp" '*'
}

@test "confine: a page that loads its own asset renders" {
  _confine_sandbox
  export FAKE_AB_FETCH="/tokens.css"
  _render
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  grep -qx '200' "$FAKE_AB_STATE/fetch-codes"
  grep -q -- '--own' "$FAKE_AB_STATE/fetch-1.body"
  [ -f "$STEM.png" ]
}

# ---------- 2. reaching outside refuses, and serves nothing ----------

@test "confine: a page that reaches for its sibling is refused, and nothing is published" {
  _confine_sandbox
  export FAKE_AB_FETCH="/variant-b/index.html"
  _render
  [ "$status" -eq 1 ]
  # The refusal is the confinement, not an earlier guard: the page reached the browser.
  [ -f "$FAKE_AB_STATE/url" ]
  grep -qx '404' "$FAKE_AB_STATE/fetch-codes"
  _not grep -q 'SIBLING-SECRET' "$FAKE_AB_STATE/fetch-1.body"
  echo "$stderr" | grep -q 'REFUSED -- the page asked for something that is not one of its own files'
  echo "$stderr" | grep -q '/variant-b/index.html'
  [ ! -e "$STEM.png" ]
  [ ! -e "$STEM.json" ]
}

@test "confine: raw, encoded and backslash traversal never serve a file outside the variant" {
  _confine_sandbox
  local p n=0
  for p in '/../matrix.md' '/%2e%2e/matrix.md' '/%2E%2E%2Fmatrix.md' '/..%2fmatrix.md' '/..%5cmatrix.md' \
           '/.%2e/matrix.md' '//../matrix.md' '/%252e%252e/matrix.md' '/index.html/../../matrix.md' \
           '/tokens.css::$DATA' '/C:/Windows/win.ini'; do
    _reset
    export FAKE_AB_FETCH="$p"
    _render
    n=$((n + 1))
    [ "$status" -eq 1 ] || { echo "admitted $p: $output"; false; }
    [ -f "$FAKE_AB_STATE/fetch-1.body" ] || [ -f "$FAKE_AB_STATE/fetch-codes" ] || { echo "never requested $p"; false; }
    _not grep -qx '200' "$FAKE_AB_STATE/fetch-codes" || { echo "served $p"; false; }
    _not grep -q 'MATRIX-SECRET' "$FAKE_AB_STATE/fetch-1.body" || { echo "leaked through $p"; false; }
    [ ! -e "$STEM.png" ]
  done
  [ "$n" -eq 11 ]
}

@test "confine: a symlink inside the variant that points outside is not followed" {
  _confine_sandbox
  ln -s ../matrix.md "$EX/variant-a/leak.md" 2>/dev/null || true
  [ -L "$EX/variant-a/leak.md" ] || skip "this leg cannot create a symlink (Git Bash copies instead); the junction case covers Windows"
  export FAKE_AB_FETCH="/leak.md"
  _render
  [ "$status" -eq 1 ]
  _not grep -q 'MATRIX-SECRET' "$FAKE_AB_STATE/fetch-1.body"
  echo "$stderr" | grep -q 'REFUSED -- the page asked for something that is not one of its own files'
}

# The symlink case above skips on Git Bash, which left Windows with no escape-by-link coverage at
# all (shell attack pass, 2026-09-17). A junction is the link a Windows user can make without
# admin rights, and it is what realpathSync.native has to see through there.
@test "confine: a Windows junction inside the variant that points outside is not followed" {
  command -v cygpath >/dev/null 2>&1 || skip "junctions are a Windows construct; the symlink case covers this leg"
  _confine_sandbox
  cmd //c mklink //J "$(cygpath -w "$EX/variant-a/jx")" "$(cygpath -w "$EX")" >/dev/null 2>&1 || true
  [ -f "$EX/variant-a/jx/matrix.md" ] || { echo "the junction was not created, so this case would prove nothing"; false; }
  export FAKE_AB_FETCH="/jx/matrix.md /jx/variant-b/index.html"
  _render
  [ "$status" -eq 1 ]
  [ -f "$FAKE_AB_STATE/fetch-codes" ]
  _not grep -qx '200' "$FAKE_AB_STATE/fetch-codes"
  _not grep -q 'MATRIX-SECRET' "$FAKE_AB_STATE/fetch-1.body"
  _not grep -q 'SIBLING-SECRET' "$FAKE_AB_STATE/fetch-2.body"
  echo "$stderr" | grep -q 'REFUSED -- the page asked for something that is not one of its own files'
  # Unlinked before teardown: rm -rf through a junction deletes what it points at, which here is
  # the sandbox's own explore -- harmless, but not the habit to leave in a test.
  cmd //c rmdir "$(cygpath -w "$EX/variant-a/jx")" >/dev/null 2>&1 || true
}

# Static, and saying so. The renderer's EXIT trap stops the server on every exit bats can see, so
# a server that inherited fd 3 is only observable after a SIGKILL, and staging that needs an
# orphan process this suite cannot then reap on Windows. Deleting any of these redirections is
# the mutant the shell attack pass found surviving; this case fails when one goes.
@test "confine: the server is spawned holding none of the caller's descriptors" {
  local spawn
  spawn="$(sed -n '/node "\$ROOT\/.claude\/scripts\/design\/design-render-serve.mjs"/,/&$/p' "$ARC_ROOT/.claude/scripts/design/design-render.sh")"
  [ -n "$spawn" ] || { echo "the server spawn was not found in design-render.sh"; false; }
  _has "$spawn" '</dev/null'
  _has "$spawn" '>/dev/null 2>&1'
  _has "$spawn" '3>&-'
  _has "$spawn" '--max-seconds'
}

@test "confine: a blocked-load report from the browser refuses the render" {
  _confine_sandbox
  export FAKE_AB_CSP_REPORT='{"csp-report":{"document-uri":"http://127.0.0.1/index.html","blocked-uri":"file:///C:/x/variant-b/index.html","violated-directive":"frame-src"}}'
  _render
  [ "$status" -eq 1 ]
  [ -f "$FAKE_AB_STATE/url" ]
  echo "$stderr" | grep -q 'REFUSED -- the page asked for something that is not one of its own files'
  echo "$stderr" | grep -q 'violation'
  [ ! -e "$STEM.png" ]
}

@test "confine: a page that left the served origin is refused; a hash change is not a navigation" {
  _confine_sandbox
  local u
  for u in 'http://127.0.0.1:9/elsewhere.html' 'about:blank' 'file:///C:/x/variant-b/index.html'; do
    _reset
    export FAKE_AB_URL="$u"
    _render
    [ "$status" -eq 1 ] || { echo "admitted a page now at $u: $output"; false; }
    echo "$stderr" | grep -q 'REFUSED -- the page navigated away from' || { echo "$output"; false; }
    [ ! -e "$STEM.png" ]
  done
  _reset
  unset FAKE_AB_URL
  export FAKE_AB_URL_APPEND="#section-2"
  _render
  [ "$status" -eq 0 ] || { echo "$output"; false; }
}

@test "confine: a render that ends with a second tab is refused" {
  _confine_sandbox
  export FAKE_AB_TABS=2
  _render
  [ "$status" -eq 1 ]
  echo "$stderr" | grep -q 'REFUSED -- the render ended with 2 tabs'
  [ ! -e "$STEM.png" ]
}

# ---------- 3. what explore mode will render at all ----------

@test "confine: explore mode renders only a page inside a variant directory; critique is unchanged" {
  _confine_sandbox
  local r
  for r in 'http://127.0.0.1:9/index.html' 'https://example.com/' 'file:///etc/passwd' \
           'docs/design/explore/t1/matrix.md' \
           'docs/design/explore/t1/variant-a/../variant-b/index.html' \
           'docs/design/explore/t1/variant-b/../variant-a/index.html' \
           './docs/design/explore/t1/variant-a/index.html' \
           'docs//design/explore/t1/variant-a/index.html' \
           'docs/design/explore/T1/variant-a/index.html' \
           'docs/design/explore/t1/variant-A/index.html' \
           'docs/design/explore/t1/variant-ab/index.html' \
           'docs/design/explore/t1/variant-a/'; do
    _reset
    _run_bounded 60 bash "$(_rs)" "$r" --mode explore --session t1--variant-a
    [ "$status" -eq 1 ] || { echo "admitted $r"; false; }
    [ ! -f "$FAKE_AB_STATE/url" ] || { echo "reached the browser: $r"; false; }
    echo "$stderr" | grep -q 'explore mode renders only a page inside docs/design/explore/<id>/variant-<x>/' \
      || { echo "wrong refusal for $r: $output"; false; }
  done
  _reset
  _run_bounded 60 bash "$(_rs)" docs/one.html
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  grep -q '^file://' "$FAKE_AB_STATE/url"
}

# ---------- 4. the server's lifecycle ----------

@test "confine: the loopback server is gone after a render, and after a refusal" {
  _confine_sandbox
  _render
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  _opened_port
  _port_closed "$PORT" || { echo "port $PORT still answers after a clean render"; false; }
  _reset
  export FAKE_AB_FETCH="/variant-b/index.html"
  _render
  [ "$status" -eq 1 ]
  _opened_port
  _port_closed "$PORT" || { echo "port $PORT still answers after a refusal"; false; }
}

@test "confine: the server serves its root's files and nothing else, and records every miss" {
  _confine_sandbox
  local d="$BATS_TEST_TMPDIR/srv" code
  mkdir -p "$d"
  _serve "$EX/variant-a" "$d" 60
  _wait_port "$d" || { echo "the server never reported a port"; false; }
  code="$(curl -s --max-time 5 -o "$d/own" -w '%{http_code}' "http://127.0.0.1:$PORT/tokens.css")"
  [ "$code" = "200" ]
  grep -q -- '--own' "$d/own"
  code="$(curl -s --max-time 5 -o "$d/sib" -w '%{http_code}' "http://127.0.0.1:$PORT/variant-b/index.html")"
  [ "$code" = "404" ]
  _not grep -q 'SIBLING-SECRET' "$d/sib"
  code="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' -X PUT "http://127.0.0.1:$PORT/index.html")"
  [ "$code" = "405" ]
  code="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")"
  [ "$code" = "404" ]
  # A browser asks for /favicon.ico on its own; that is not the page reaching out.
  code="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/favicon.ico")"
  [ "$code" = "204" ]
  grep -q '/variant-b/index.html' "$d/record"
  [ "$(grep -c . "$d/record")" -eq 3 ] || { cat "$d/record"; false; }
  _not grep -q 'favicon' "$d/record"
}

@test "confine: the server ends itself at its lifetime cap, and says so" {
  _confine_sandbox
  local d="$BATS_TEST_TMPDIR/srv"
  mkdir -p "$d"
  _serve "$EX/variant-a" "$d" 2
  _wait_port "$d" || { echo "the server never reported a port"; false; }
  sleep 2
  _port_closed "$PORT" || { echo "port $PORT outlived a 2s cap"; false; }
  grep -q '^lifetime' "$d/record"
}

# The record says what a page TRIED, and the renderer's refusal explains exactly the kinds it
# holds. Each kind below is produced by one check in resolve(); deleting that check moves the line
# to a different kind, on every leg (attack pass, 2026-09-17: the colon and backslash checks were
# unpinned). The request goes to the server directly, as raw as curl will send it.
@test "confine: the server classifies what it refuses, one kind per check" {
  _confine_sandbox
  local d="$BATS_TEST_TMPDIR/srv" p code
  mkdir -p "$d"
  _serve "$EX/variant-a" "$d" 60
  _wait_port "$d" || { echo "the server never reported a port"; false; }
  for p in '/variant-b/index.html' '/%2e%2e/matrix.md' '/..%5cmatrix.md' '/tokens.css::$DATA' '/C:/Windows/win.ini'; do
    code="$(curl -s --max-time 5 --path-as-is -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$p")"
    [ "$code" = "404" ] || { echo "$p answered $code"; false; }
  done
  _kind() { grep -qxF "$(printf '%s\tGET\t%s' "$1" "$2")" "$d/record" || { echo "expected '$1' for $2 in:"; cat "$d/record"; false; }; }
  _kind missing   '/variant-b/index.html'
  _kind outside   '/%2e%2e/matrix.md'
  _kind outside   '/..%5cmatrix.md'
  _kind malformed '/tokens.css::$DATA'
  _kind malformed '/C:/Windows/win.ini'
  code="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/csp-report' \
    --data '{"csp-report":{"blocked-uri":"https://example.com/x.png","violated-directive":"img-src"}}' \
    "http://127.0.0.1:$PORT/__arc/csp-report")"
  [ "$code" = "204" ]
  grep -qxF "$(printf 'violation\tPOST\timg-src https://example.com/x.png')" "$d/record" || { cat "$d/record"; false; }
}

# The browser turns `../variant-b/index.html` into `/variant-b/index.html` before it asks, so the
# server cannot tell a sibling reference from a typo in a link to the page's own stylesheet. Both
# refuse, and the refusal must not accuse the page of the worse one (attack pass, 2026-09-17).
@test "confine: a broken link to its own asset refuses, and the refusal says it may only be a broken link" {
  _confine_sandbox
  export FAKE_AB_FETCH="/tokens-typo.css"
  _render
  [ "$status" -eq 1 ]
  [ -f "$FAKE_AB_STATE/url" ]
  echo "$stderr" | grep -q 'REFUSED -- the page asked for something that is not one of its own files'
  echo "$stderr" | grep -q '/tokens-typo.css'
  echo "$stderr" | grep -q 'or a broken link to one of the page'
  _not _has "$stderr" 'resolves outside'
  _not _has "$stderr" 'left its variant directory'
  [ ! -e "$STEM.png" ]
}

@test "confine: the server refuses a bad invocation instead of serving something" {
  _confine_sandbox
  local d="$BATS_TEST_TMPDIR/srv"
  mkdir -p "$d"
  _run_bounded 20 node "$(_serve_js)" --root "$SANDBOX/does-not-exist" --dir "$d" --max-seconds 5
  [ "$status" -ne 0 ]
  echo "$stderr" | grep -q 'design-render-serve:' || { echo "$output"; false; }
  _run_bounded 20 node "$(_serve_js)" --root "$EX/variant-a" --dir "$d" --max-seconds 0
  [ "$status" -ne 0 ]
  echo "$stderr" | grep -q 'design-render-serve:'
  _run_bounded 20 node "$(_serve_js)" --dir "$d" --max-seconds 5
  [ "$status" -ne 0 ]
  echo "$stderr" | grep -q 'design-render-serve:'
  [ ! -e "$d/port" ]
}

# ---------- 5. fixed in passing ----------

@test "confine: the media command reaches the browser whole" {
  _confine_sandbox
  _render
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -s "$FAKE_AB_STATE/set" ]
  # design-render.sh:383 carried a literal \n before `||`, so the browser was sent
  # `set media light n` and the fail-closed media check tested a malformed command.
  grep -qx 'media light' "$FAKE_AB_STATE/set" || { cat "$FAKE_AB_STATE/set"; false; }
}

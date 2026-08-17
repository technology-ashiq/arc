#!/usr/bin/env bats
# engine-egress-proxy.bats -- the allowlist proxy's decision logic, driven with no Docker and no
# network (Phase 06 fixture 7).
#
# WHY THIS FILE EXISTS AT ALL. Until 2026-08-17 `.claude/scripts/engine/egress-proxy.py` had ZERO
# coverage: nothing launched it, no suite named it, and this repo has no Python lint step -- so a
# syntax error, or an inverted `if key not in allowed`, would have shipped GREEN into every consumer
# repo the sync manifest feeds. An adversarial pass found it and made the point by driving the same
# functions from a plain interpreter in milliseconds.
#
# The suite it replaces reasoned that "a CI runner has no Docker and no image". That is true of the
# CONTAINER and false of `parse_allow()` and `handle()`, which are pure decision logic over bytes.
# The behavioural confinement arm stays where it belongs, in
# `initiatives/engine/evidence/phase-06/fixtures-1-4-6-7-confinement.md`.

bats_require_minimum_version 1.5.0

load test_helper

setup() {
  ARC_ROOT="$(cd "$BATS_TEST_DIRNAME/.." && pwd)"
  PROBE="$ARC_ROOT/tests/fixtures/engine/hermes/egress-proxy-probe.py"
  PY="$(command -v python3 || command -v python)"
  [ -n "$PY" ] || skip "no python interpreter on this leg"
}

# Every probe prints a terminal marker as its LAST line. Asserting the marker is asserting the probe
# RAN -- a probe that dies early prints nothing, and "output does not contain X" is satisfied by a
# crash.
probe() {
  # -B so importing the proxy module leaves no __pycache__ inside the synced tree.
  run "$PY" -B "$PROBE" "$1"
  [ "$status" -eq 0 ] || { echo "probe $1 exited $status: $output"; false; }
}

@test "proxy: the file compiles -- nothing else in CI would have noticed if it did not" {
  # `python -B` and an in-memory `compile()`, never `py_compile`: py_compile WRITES a __pycache__
  # directory next to the source, which on this repo means an untracked .pyc inside a SYNCED tree.
  # It was caught by product-lint the first time this test ran ("synced but in no product"), which
  # is a gate doing its job -- a test that dirties the working tree on every CI leg is a test that
  # breaks a different gate to prove its own point.
  run "$PY" -B -c "import sys; compile(open(sys.argv[1], encoding='utf-8').read(), sys.argv[1], 'exec'); print('COMPILED')" \
    "$ARC_ROOT/.claude/scripts/engine/egress-proxy.py"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"COMPILED"* ]]
}

@test "proxy: every near-miss allowlist shape is REJECTED, not merely non-matching" {
  # The docstring said a suffix rule was "not supported". That was true of the MATCHING and false of
  # the PARSING: `.openrouter.ai:443` and `*:443` were both accepted, so the proxy started, printed
  # a plausible-looking policy, and denied everything -- surfacing later as unexplained model errors.
  # Non-matching is not rejecting.
  probe allow-parse
  [[ "$output" == *"ALLOW-PARSE-DONE"* ]]
  [[ "$output" == *"near_miss_accepted=none"* ]] || { echo "a near-miss entry was accepted: $output"; false; }
  [[ "$output" == *"exact_entry_parsed=True"* ]]
}

@test "proxy: a Unicode-digit port is refused with a 403, not an uncaught exception" {
  # PROVED by both adversarial surfaces: `str.isdigit()` is True for Unicode digits, so
  # `--allow host:٤٤٣` was accepted AS PORT 443, and a CONNECT to `host:²` passed isdigit() then
  # raised ValueError out of a handler that caught only OSError. The thread died with no 403, no
  # DENY line and the client socket never closed -- repeatable, and the exact opposite of the
  # docstring's "a malformed port -- all 403".
  probe unicode-port
  [[ "$output" == *"UNICODE-PORT-DONE"* ]]
  [[ "$output" == *"uncaught=none"* ]] || { echo "an exception escaped handle(): $output"; false; }
  [[ "$output" == *"answered_403=True"* ]]
  [[ "$output" == *"closed=True"* ]]
}

@test "proxy: a host that only LOOKS like an allowlisted one is denied" {
  probe denied-host
  [[ "$output" == *"DENIED-DONE"* ]]
  [[ "$output" == *"answered_403=True"* ]]
  [[ "$output" == *"closed=True"* ]]
}

@test "proxy: plain HTTP is refused even for an allowlisted host" {
  probe plain-http
  [[ "$output" == *"PLAIN-HTTP-DONE"* ]]
  [[ "$output" == *"answered_403=True"* ]]
}

@test "proxy: a client that sends nothing is answered and closed, never left hanging" {
  probe no-request
  [[ "$output" == *"NO-REQUEST-DONE"* ]]
  [[ "$output" == *"answered_403=True"* ]]
  [[ "$output" == *"closed=True"* ]]
}

@test "proxy: an ALLOWED host that cannot be reached is 502/ERROR, never 403/DENY" {
  # These were the same event, so the trail could not answer the only question it exists to answer:
  # did policy refuse this, or did the network? `socket.timeout` is an OSError subclass, so even a
  # slow client was recorded as an "upstream error" DENY against a host sitting on the allowlist.
  probe transport-is-not-denial
  [[ "$output" == *"TRANSPORT-DONE"* ]]
  [[ "$output" == *"answered_502=True"* ]]
  [[ "$output" == *"answered_403=False"* ]] || { echo "a transport failure was logged as a policy denial: $output"; false; }
}

@test "proxy: bytes pipelined with the CONNECT reach upstream instead of being discarded" {
  # PROVED: a client batching its CONNECT and its TLS ClientHello in one segment had the ClientHello
  # consumed into the header buffer and silently dropped; the tunnel then hung to timeout and
  # presented as "the model endpoint is slow". Silent byte-loss on the one path this file exists to
  # carry.
  probe early-bytes
  [[ "$output" == *"EARLY-BYTES-DONE"* ]]
  [[ "$output" == *"upstream_got_early=HELLO-EARLY-BYTES"* ]]
  [[ "$output" == *"client_got_200=True"* ]]
}

@test "proxy: an IPv6 literal can be allowlisted, and a case-padded target normalises" {
  # `count(":") != 1` made IPv6 unreachable in both directions -- a literal address is nothing but
  # colons -- and the error text did not say why. Fail-closed, but closed against a legitimate
  # address. The normalise half is what the ALLOW line now logs, so an audit grepping the trail for
  # its own policy string finds its own allowed traffic.
  probe ipv6
  [[ "$output" == *"IPV6-DONE"* ]]
  [[ "$output" == *"parsed=[::1]:443"* ]]
  probe normalize-case
  [[ "$output" == *"NORMALIZE-DONE"* ]]
  [[ "$output" == *"upper_and_padded=('openrouter.ai', 443)"* ]]
  # NEGATIVE CONTROL: the same normaliser refuses the shape the allowlist parser must reject.
  [[ "$output" == *"negative_control_bad_host=None"* ]]
}

@test "proxy: an empty allowlist REFUSES to start" {
  # A policy nobody wrote reads as "deny all" while looking like a misconfiguration.
  probe empty-allowlist
  [[ "$output" == *"EMPTY-DONE"* ]]
  [[ "$output" == *"refused=True"* ]]
  [[ "$output" == *"mentions_empty=True"* ]]
}

@test "proxy: an unknown probe subcommand FAILS -- the harness cannot pass by typo" {
  # Without this, a renamed subcommand would make every test above run nothing and assert on an
  # empty string. The probe exits 64 with a named error rather than printing nothing.
  run "$PY" -B "$PROBE" not-a-real-subcommand
  [ "$status" -eq 64 ]
  [[ "$output" == *"unknown subcommand"* ]]
}

@test "suite: every test in this file is REGISTERED, not merely declared" {
  declared="$(grep -c "^@test " "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" = "12" ] || { echo "expected 12 REGISTERED tests, bats registered $registered"; false; }
  [ "$declared" = "$registered" ] || { echo "declared $declared but bats registered $registered -- a test was silently dropped"; false; }
}

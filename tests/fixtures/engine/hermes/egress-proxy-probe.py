#!/usr/bin/env python3
"""Drive egress-proxy.py's decision logic against fake sockets, with no Docker and no network.

WHY THIS FILE EXISTS. Until 2026-08-17 `egress-proxy.py` had ZERO coverage: nothing launched it, no
suite named it, and there is no Python lint step in CI -- so a syntax error or an inverted
`if key not in allowed` would have shipped green, into every consumer repo the sync manifest feeds.
The stated excuse was that a CI runner has no Docker and no image. That is true of the CONTAINER and
false of `parse_allow()` and `handle()`, which an adversarial pass drove from a plain interpreter in
milliseconds -- which is exactly what this does.

Each subcommand prints a single terminal marker line so the caller can assert the probe RAN before
asserting what it printed. A probe that dies early and prints nothing must never be mistaken for a
probe that ran and found nothing.
"""

import sys

# NO BYTECODE. Loading the proxy by path would otherwise drop a __pycache__ directory beside it --
# inside a SYNCED tree, where product-lint correctly refuses an unmapped file. Belt as well as the
# `-B` the caller passes, because a probe that dirties the repo depending on how it was invoked is
# a probe with two behaviours.
sys.dont_write_bytecode = True

import importlib.util  # noqa: E402 -- must follow the bytecode switch above
import os              # noqa: E402
import socket          # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PROXY = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", ".claude", "scripts", "engine", "egress-proxy.py"))

spec = importlib.util.spec_from_file_location("egress_proxy", PROXY)
proxy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy)


class FakeSocket:
    """A client socket that yields scripted bytes and records what was written to it."""

    def __init__(self, script=b""):
        self.script = script
        self.sent = b""
        self.closed = False
        self.timeouts = []

    def settimeout(self, value):
        self.timeouts.append(value)

    def recv(self, _n):
        if not self.script:
            return b""
        chunk, self.script = self.script, b""
        return chunk

    def sendall(self, data):
        self.sent += data

    def close(self):
        self.closed = True

    def shutdown(self, _how):
        pass


def emit(pairs, marker):
    for key, value in pairs:
        print(f"{key}={value}")
    print(marker)


def cmd_allow_parse():
    """The allowlist parser rejects every near-miss shape, and accepts the exact one."""
    results = []
    for entry in [".openrouter.ai:443", "*:443", "openrouter.ai", "openrouter.ai:",
                  "openrouter.ai:0", "openrouter.ai:99999", "openrouter.ai:٤٤٣",
                  "openrouter.ai:²", "openrouter.ai:44 3", ":443"]:
        try:
            proxy.parse_allow([entry])
            results.append(f"ACCEPTED:{entry}")
        except SystemExit:
            results.append("rejected")
    accepted = [r for r in results if r.startswith("ACCEPTED")]
    ok = proxy.parse_allow(["openrouter.ai:443"])
    emit([
        ("near_miss_accepted", ";".join(accepted) if accepted else "none"),
        ("exact_entry_parsed", "openrouter.ai:443" in {f"{h}:{p}" for h, p in ok}),
    ], "ALLOW-PARSE-DONE")


def cmd_empty_allowlist():
    try:
        proxy.parse_allow([])
        emit([("refused", False)], "EMPTY-DONE")
    except SystemExit as exc:
        emit([("refused", True), ("mentions_empty", "EMPTY" in str(exc))], "EMPTY-DONE")


def cmd_unicode_port():
    """The port that passed str.isdigit() and then raised out of int()."""
    allowed = proxy.parse_allow(["openrouter.ai:443"])
    client = FakeSocket(b"CONNECT openrouter.ai:\xb2 HTTP/1.1\r\n\r\n")
    crashed = ""
    try:
        proxy.handle(client, allowed)
    except BaseException as exc:                              # noqa: BLE001 -- that is the question
        crashed = repr(exc)
    emit([
        ("uncaught", crashed or "none"),
        ("answered_403", b"403" in client.sent),
        ("closed", client.closed),
    ], "UNICODE-PORT-DONE")


def cmd_denied_host():
    allowed = proxy.parse_allow(["openrouter.ai:443"])
    client = FakeSocket(b"CONNECT evil-openrouter.ai:443 HTTP/1.1\r\n\r\n")
    proxy.handle(client, allowed)
    emit([("answered_403", b"403" in client.sent), ("closed", client.closed)], "DENIED-DONE")


def cmd_plain_http():
    allowed = proxy.parse_allow(["openrouter.ai:443"])
    client = FakeSocket(b"GET http://openrouter.ai/v1?leak=secret HTTP/1.1\r\n\r\n")
    proxy.handle(client, allowed)
    emit([("answered_403", b"403" in client.sent)], "PLAIN-HTTP-DONE")


def cmd_no_request():
    allowed = proxy.parse_allow(["openrouter.ai:443"])
    client = FakeSocket(b"")
    proxy.handle(client, allowed)
    emit([("answered_403", b"403" in client.sent), ("closed", client.closed)], "NO-REQUEST-DONE")


def cmd_transport_is_not_denial():
    """An ALLOWED host that cannot be reached is 502/ERROR, never 403/DENY."""
    allowed = proxy.parse_allow(["127.0.0.1:9"])
    client = FakeSocket(b"CONNECT 127.0.0.1:9 HTTP/1.1\r\n\r\n")
    real_connect = proxy.socket.create_connection

    def boom(*_a, **_k):
        raise ConnectionRefusedError("refused by the test")

    proxy.socket.create_connection = boom
    try:
        proxy.handle(client, allowed)
    finally:
        proxy.socket.create_connection = real_connect
    emit([
        ("answered_502", b"502" in client.sent),
        ("answered_403", b"403" in client.sent),
    ], "TRANSPORT-DONE")


def cmd_early_bytes():
    """A ClientHello batched with the CONNECT must reach upstream, not be discarded."""
    allowed = proxy.parse_allow(["openrouter.ai:443"])
    client = FakeSocket(b"CONNECT openrouter.ai:443 HTTP/1.1\r\n\r\nHELLO-EARLY-BYTES")
    upstream = FakeSocket(b"")
    real_connect = proxy.socket.create_connection
    real_thread = proxy.threading.Thread

    class NoThread:
        def __init__(self, *_a, **_k):
            pass

        def start(self):
            pass

    proxy.socket.create_connection = lambda *_a, **_k: upstream
    proxy.threading.Thread = NoThread
    try:
        proxy.handle(client, allowed)
    finally:
        proxy.socket.create_connection = real_connect
        proxy.threading.Thread = real_thread
    emit([
        ("upstream_got_early", upstream.sent.decode("latin-1")),
        ("client_got_200", b"200" in client.sent),
    ], "EARLY-BYTES-DONE")


def cmd_ipv6():
    allowed = proxy.parse_allow(["[::1]:443"])
    emit([("parsed", ";".join(f"{h}:{p}" for h, p in sorted(allowed)))], "IPV6-DONE")


def cmd_normalize_case():
    emit([
        ("upper_and_padded", str(proxy.normalize("OPENROUTER.AI:00443"))),
        ("negative_control_bad_host", str(proxy.normalize(".openrouter.ai:443"))),
    ], "NORMALIZE-DONE")


COMMANDS = {
    "allow-parse": cmd_allow_parse,
    "empty-allowlist": cmd_empty_allowlist,
    "unicode-port": cmd_unicode_port,
    "denied-host": cmd_denied_host,
    "plain-http": cmd_plain_http,
    "no-request": cmd_no_request,
    "transport-is-not-denial": cmd_transport_is_not_denial,
    "early-bytes": cmd_early_bytes,
    "ipv6": cmd_ipv6,
    "normalize-case": cmd_normalize_case,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        # AN UNKNOWN SUBCOMMAND EXITS NON-ZERO WITH A NAMED ERROR rather than printing nothing: a
        # typo would otherwise arrive at the caller as an empty-output fixture and pass the wrong
        # assertion for the wrong reason.
        sys.stderr.write(f"egress-proxy-probe: unknown subcommand {sys.argv[1:2]}\n")
        sys.exit(64)
    COMMANDS[sys.argv[1]]()

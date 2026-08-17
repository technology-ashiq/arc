#!/usr/bin/env python3
"""egress-proxy.py -- the only way out of the runtime's network, and it carries an allowlist.

WHY THIS EXISTS. Phase 06 fixture 7 requires that an attempted outbound connection to a host
outside the pinned allowlist ACTUALLY FAILS. Measured 2026-08-16, the runtime container had
completely unrestricted egress: `curl https://example.com` returned 200. A config-pin diff would
have read GREEN against that, which is why REQ-02 demands a behavioural arm -- "a config match is a
promise and this REQ's whole outcome is that promises do not count".

WHY A PROXY AND NOT A FLAG. Both one-line levers were measured first:

    --network none          blocks everything, the model endpoint included
    --internal bridge       blocks everything, the model endpoint included

Neither is usable, because the runtime must reach a model. The dual-homed proxy was then measured
end to end: a container attached to BOTH an --internal network and the default bridge can reach the
internet, a container on the internal network alone cannot, and it can reach the proxy by name. So
this process is the single route out, and the allowlist here is the whole policy.

WHY THE SAME PINNED IMAGE. This runs inside the runtime's own image, which already carries Python
3.13. Pulling a proxy image would add a SECOND supply-chain artifact to pin, vet and rotate for a
file that is stdlib only -- and ADR-0209's whole posture is that every artifact is pinned by digest
and vetted. One pin is better than two.

CONNECT ONLY, AND THAT IS DELIBERATE. Model traffic is HTTPS, so it arrives as CONNECT and this
proxy never sees the plaintext. It cannot inspect bodies and does not pretend to: it decides on the
host:port in the CONNECT line and then blindly pipes bytes. A proxy that terminated TLS would be a
man-in-the-middle holding the runtime's credential, which is a larger risk than the one it closes.

PLAIN HTTP IS REFUSED, AND THE REASON IS NARROWER THAN IT USED TO CLAIM. The old wording said the
refusal stops the runtime exfiltrating in a query string. It does not, and an adversarial pass said
so: inside an ALLOWED CONNECT tunnel the runtime can send any request it likes, query string
included, and this proxy cannot see it. What refusing plain HTTP actually buys is that no cleartext
request is carried to a non-TLS peer on this path. That is a real but smaller property, and it is
now stated as the smaller one -- a comment claiming a control the file cannot implement is the
defect class this cycle has recorded ten times.

FAIL CLOSED. An unparseable request line, an unknown method, a host not on the list, a malformed
port -- all 403, all logged. There is no default-allow path in this file, and no path on which a
decision goes unrecorded: the handler's catch-all exists precisely so an unexpected exception
cannot become a silent non-answer.

POLICY DENIALS AND TRANSPORT FAILURES ARE DIFFERENT EVENTS. They were the same one, and the trail
could not answer the only question it exists to answer. A refused host is DENY/403; an allowlisted
host that could not be reached is ERROR/502; and once a tunnel is established neither is ever
written into it, because bytes injected into a TLS stream are not a refusal, they are corruption.

WHAT THIS TRAIL IS NOT. These lines go to this process's stderr, in its own container. arc-run
scrubs the DRIVER's transcript and never sees a byte of this -- the earlier claim that it did was
false. Capturing and scrubbing the proxy's log is the orchestration's job (Phase 06), and until it
does, these lines carry every hostname the runtime reached for and are retained by nothing.

Usage:  python3 egress-proxy.py --port 3128 --allow host:port [--allow host:port ...]
"""

import argparse
import re
import socket
import sys
import threading
import time

BUF = 65536
CONNECT_TIMEOUT = 15          # wall-clock budget for the whole request-header phase
TUNNEL_IDLE_TIMEOUT = 900     # an established tunnel that goes silent this long is dropped
MAX_HEAD = 8192
MAX_INFLIGHT = 64             # concurrent handlers; the confined runtime must not be able to
                              # exhaust the mechanism that confines it

# A DECIMAL PORT, ANCHORED. `str.isdigit()` was here and it is True for Unicode digits: an
# adversarial pass PROVED that `--allow host:٤٤٣` was accepted as port 443, and that a CONNECT to
# `host:²` passed isdigit() and then raised ValueError out of int() -- past a handler that caught
# only OSError, so the thread died with no 403, no log line and no socket close, repeatably. One
# file away, hermes.mjs had already fixed this exact class with an anchored decimal regex and the
# comment "a numeric STRING is accepted, but only one that is unambiguously a decimal integer".
# Twin-fix miss; this is the twin.
PORT_RE = re.compile(r"\A[0-9]{1,5}\Z")

# A HOSTNAME, OR AN IPv4/IPv6 LITERAL. The docstring said a suffix rule was "not supported", which
# an adversarial pass showed to be true of the MATCHING and false of the PARSING: `--allow
# .openrouter.ai:443` and `--allow *:443` were both accepted, so the proxy started, printed a
# plausible-looking policy, and denied everything -- surfacing later as unexplained model errors.
# Non-matching is not rejecting. Rejected at parse time now, loudly.
HOST_RE = re.compile(
    r"\A(?:"
    r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*"
    r"|\[[0-9a-f:]{2,45}\]"
    r")\Z",
    re.IGNORECASE,
)


def log(msg):
    # Unbuffered and on stderr: this IS the egress trail. A decision nobody can read afterwards is
    # not an audit. See "WHAT THIS TRAIL IS NOT" above for who does and does not capture it.
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


def split_host_port(spec):
    """`host:port` -> (host, port) with the bracketed IPv6 form handled, or None.

    IPv6 was unreachable in both directions because the split was `count(":") != 1`: a literal
    address is nothing but colons, so `[::1]:443` could neither be allowed nor requested, and the
    error text did not say why. Fail-closed, but closed against a legitimate address.
    """
    if spec.startswith("["):
        end = spec.find("]")
        if end == -1 or end + 1 >= len(spec) or spec[end + 1] != ":":
            return None
        return spec[: end + 1], spec[end + 2 :]
    if spec.count(":") != 1:
        return None
    host, _, port = spec.partition(":")
    return host, port


def normalize(spec):
    """The decided key `(host, port)`, or None if the spec is not one.

    ONE function for both the allowlist and the request line. They were two code paths applying the
    same rule, which is how the allowlist came to accept a Unicode-digit port that the request path
    would crash on -- the same quantity computed twice, fixed once.
    """
    parts = split_host_port(spec)
    if parts is None:
        return None
    host, port = parts
    if not host or not PORT_RE.match(port):
        return None
    number = int(port)
    if not 1 <= number <= 65535:
        return None
    if not HOST_RE.match(host):
        return None
    return host.lower(), number


def parse_allow(entries):
    """host:port pairs, exact match only. No wildcards, no suffix matching.

    A suffix rule (`.openrouter.ai`) is how `evil-openrouter.ai` gets allowed, and a bare hostname
    with no port lets the same host be reached on any port. Both are the near-miss shape this repo
    keeps recording, so neither is supported -- and neither is silently tolerated, which is the
    part that was missing.
    """
    allowed = set()
    for entry in entries:
        key = normalize(entry)
        if key is None:
            raise SystemExit(
                f"egress-proxy: --allow needs an exact host:port with a decimal port 1-65535 and a "
                f"literal hostname (no leading dot, no wildcard), got {entry!r}"
            )
        allowed.add(key)
    if not allowed:
        raise SystemExit("egress-proxy: refusing to start with an EMPTY allowlist -- that is a "
                         "policy nobody wrote, and it would read as 'deny all' while looking like "
                         "a misconfiguration")
    return allowed


def pipe(src, dst):
    try:
        while True:
            data = src.recv(BUF)
            if not data:
                break
            dst.sendall(data)
    except OSError:
        pass
    finally:
        for sock in (src, dst):
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def close_quietly(sock):
    try:
        sock.close()
    except OSError:
        pass


def refuse(client, why, detail):
    """A POLICY decision: this request was not allowed. 403, and DENY in the trail."""
    log(f"egress-proxy: DENY {detail} -- {why}")
    try:
        client.sendall(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
    except OSError:
        pass
    close_quietly(client)


def fail_transport(client, why, detail):
    """A TRANSPORT failure reaching a host that WAS allowed. 502, and ERROR in the trail.

    This was `refuse()`, so a DNS blip, an ECONNREFUSED or a slow client (socket.timeout is an
    OSError subclass) was recorded as `DENY` for a host sitting on the allowlist. The audit could
    not distinguish "policy said no" from "the network said no", which is the one question it
    exists to answer, and the client could not either -- both were 403.
    """
    log(f"egress-proxy: ERROR {detail} -- {why}")
    try:
        client.sendall(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
    except OSError:
        pass
    close_quietly(client)


def read_head(client, deadline):
    """Request line plus headers, bounded in BOTH bytes and wall-clock.

    `CONNECT_TIMEOUT` was a per-recv socket timeout, which every byte reset: a client dribbling one
    byte every 14 seconds held a thread for ~34 hours per 8 KB. The bound is now a deadline the
    whole phase shares.
    """
    head = b""
    while b"\r\n\r\n" not in head and len(head) < MAX_HEAD:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return None
        client.settimeout(remaining)
        chunk = client.recv(BUF)
        if not chunk:
            return head if head else None
        head += chunk
    return head


def handle(client, allowed):
    upstream = None
    tunnelled = False
    try:
        head = read_head(client, time.monotonic() + CONNECT_TIMEOUT)
        if not head or b"\r\n\r\n" not in head:
            return refuse(client, "the client closed or stalled before sending a request", "(no request)")
        line = head.split(b"\r\n", 1)[0].decode("latin-1", "replace")
        parts = line.split()
        if len(parts) < 2:
            return refuse(client, "unparseable request line", repr(line[:80]))
        method, target = parts[0].upper(), parts[1]
        if method != "CONNECT":
            return refuse(client, "only CONNECT is proxied; plain HTTP is refused so no cleartext "
                                  "request is carried to a non-TLS peer on this path",
                          f"{method} {target[:80]}")
        key = normalize(target)
        if key is None:
            return refuse(client, "CONNECT target must be host:port with a decimal port 1-65535",
                          repr(target[:80]))
        if key not in allowed:
            return refuse(client, "host:port is not on the allowlist", f"{key[0]}:{key[1]}")

        # THE KEY IS LOGGED, NOT THE RAW TARGET. `CONNECT OPENROUTER.AI:00443` used to be recorded
        # verbatim while the socket went to ('openrouter.ai', 443), so an audit grepping the trail
        # for its own policy string missed its own allowed traffic. The raw form is kept as a
        # separate field rather than dropped -- it is evidence about what was ASKED for.
        connect_host = key[0][1:-1] if key[0].startswith("[") else key[0]
        upstream = socket.create_connection((connect_host, key[1]), timeout=CONNECT_TIMEOUT)
        log(f"egress-proxy: ALLOW {key[0]}:{key[1]} (requested {target[:80]!r})")
        client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        tunnelled = True

        # BYTES PIPELINED WITH THE CONNECT ARE FORWARDED, NOT DROPPED. A client that batches its
        # CONNECT and its TLS ClientHello in one segment -- which any coalescing stack does -- had
        # its ClientHello consumed into `head` and silently discarded here; the tunnel then hung
        # until timeout, presenting as "the model endpoint is slow". PROVED: upstream received b"".
        early = head.split(b"\r\n\r\n", 1)[1]
        if early:
            upstream.sendall(early)

        client.settimeout(TUNNEL_IDLE_TIMEOUT)
        upstream.settimeout(TUNNEL_IDLE_TIMEOUT)
        threading.Thread(target=pipe, args=(client, upstream), daemon=True).start()
        pipe(upstream, client)
    except OSError as exc:
        if tunnelled:
            # NEVER write a status line into an established tunnel. Those bytes are not a refusal to
            # a TLS peer, they are corruption in the stream.
            log(f"egress-proxy: ERROR tunnel to {target[:80]!r} ended -- {exc}")
            close_quietly(client)
        else:
            fail_transport(client, f"upstream error: {exc}", "(connect failed)")
    except Exception as exc:                                  # noqa: BLE001 -- deliberate catch-all
        # THE CATCH-ALL IS THE FAIL-CLOSED CLAIM. It was `except OSError`, so any other exception
        # killed the thread leaving the client with no response, no log line and an open socket --
        # the exact opposite of "all 403", reachable from attacker-controlled bytes. A refusal that
        # is neither answered nor recorded is not fail-closed, it is a hang.
        if tunnelled:
            log(f"egress-proxy: ERROR tunnel ended unexpectedly -- {exc!r}")
            close_quietly(client)
        else:
            refuse(client, f"unhandled error while deciding: {exc!r}", "(internal)")
    finally:
        if upstream is not None:
            close_quietly(upstream)


def serve(srv, allowed):
    inflight = threading.BoundedSemaphore(MAX_INFLIGHT)

    def run(conn):
        try:
            handle(conn, allowed)
        finally:
            close_quietly(conn)
            inflight.release()

    while True:
        try:
            conn, _ = srv.accept()
        except OSError as exc:
            # A BARE `while True: srv.accept()` MEANT ONE EMFILE KILLED THE PROXY, and with it the
            # confinement and the trail. The process the proxy exists to contain could therefore
            # switch it off by opening sockets. It fails closed (no egress), so this is availability
            # rather than bypass -- but the proxy's liveness must not be a silent assumption of any
            # later gate.
            log(f"egress-proxy: WARN accept failed -- {exc}")
            time.sleep(0.05)
            continue
        if not inflight.acquire(blocking=False):
            log("egress-proxy: DENY (overloaded) -- refusing a connection above the in-flight cap")
            close_quietly(conn)
            continue
        threading.Thread(target=run, args=(conn,), daemon=True).start()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=3128)
    ap.add_argument("--allow", action="append", default=[])
    # BINDING 0.0.0.0 ON A DELIBERATELY DUAL-HOMED HOST PUBLISHES THIS PROXY TO THE BRIDGE TOO, so
    # every co-located container gets the allowlisted egress, not just the confined runtime. The
    # policy becomes "whoever can reach me", which is a strictly larger set than the subject. The
    # default is kept for the measured Phase 06 topology and the address is now settable, with the
    # exposure stated rather than discovered.
    ap.add_argument("--bind", default="0.0.0.0")
    args = ap.parse_args()

    if not 1 <= args.port <= 65535:
        raise SystemExit(f"egress-proxy: --port must be 1-65535, got {args.port}")
    allowed = parse_allow(args.allow)
    log("egress-proxy: allowlist = " + ", ".join(f"{h}:{p}" for h, p in sorted(allowed)))

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((args.bind, args.port))
    srv.listen(64)
    # THE PORT IS READ BACK FROM THE SOCKET, not echoed from argv. With `--port 0` the kernel
    # assigns an ephemeral port while the trail said "listening on 0", so every container pointed
    # at 3128 lost egress and the log looked healthy. The log is not the fact; the socket is.
    bound_host, bound_port = srv.getsockname()[:2]
    log(f"egress-proxy: listening on {bound_host}:{bound_port}")
    if args.bind == "0.0.0.0":
        log("egress-proxy: WARN bound on all interfaces -- every host that can route here gets this "
            "allowlist; use --bind to narrow it to the internal network")
    serve(srv, allowed)


if __name__ == "__main__":
    main()

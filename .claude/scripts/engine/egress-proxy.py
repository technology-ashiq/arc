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
file that is 150 lines of stdlib -- and ADR-0209's whole posture is that every artifact is pinned by
digest and vetted. One pin is better than two.

CONNECT ONLY, AND THAT IS DELIBERATE. Model traffic is HTTPS, so it arrives as CONNECT and this
proxy never sees the plaintext. It cannot inspect bodies and does not pretend to: it decides on the
host:port in the CONNECT line and then blindly pipes bytes. A proxy that terminated TLS would be a
man-in-the-middle holding the runtime's credential, which is a larger risk than the one it closes.
Plain HTTP is REFUSED rather than forwarded -- an allowlisted host reached over http:// would let
the runtime exfiltrate in a query string that never appears in the draft.

FAIL CLOSED. An unparseable request line, an unknown method, a host not on the list, a malformed
port -- all 403. There is no default-allow path in this file.

Usage:  python3 egress-proxy.py --port 3128 --allow host:port [--allow host:port ...]
"""

import argparse
import socket
import sys
import threading

BUF = 65536
CONNECT_TIMEOUT = 15


def log(msg):
    # Unbuffered and on stderr: this IS the egress trail, and arc-run scrubs the driver's
    # transcript. A decision nobody can read afterwards is not an audit.
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


def parse_allow(entries):
    """host:port pairs, exact match only. No wildcards, no suffix matching.

    A suffix rule (`.openrouter.ai`) is how `evil-openrouter.ai` gets allowed, and a bare hostname
    with no port lets the same host be reached on any port. Both are the near-miss shape this repo
    keeps recording, so neither is supported.
    """
    allowed = set()
    for e in entries:
        if e.count(":") != 1:
            raise SystemExit(f"egress-proxy: --allow needs exactly host:port, got {e!r}")
        host, _, port = e.partition(":")
        if not host or not port.isdigit():
            raise SystemExit(f"egress-proxy: --allow needs exactly host:port, got {e!r}")
        allowed.add((host.lower(), int(port)))
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
        for s in (src, dst):
            try:
                s.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def refuse(client, why, detail):
    log(f"egress-proxy: DENY {detail} -- {why}")
    try:
        client.sendall(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
    except OSError:
        pass
    try:
        client.close()
    except OSError:
        pass


def handle(client, allowed):
    client.settimeout(CONNECT_TIMEOUT)
    try:
        head = b""
        # Read only the request line plus headers. Bounded, so a client that never sends CRLFCRLF
        # cannot hold a thread and memory open indefinitely.
        while b"\r\n\r\n" not in head and len(head) < 8192:
            chunk = client.recv(BUF)
            if not chunk:
                return refuse(client, "the client closed before sending a request", "(no request)")
            head += chunk
        line = head.split(b"\r\n", 1)[0].decode("latin-1", "replace")
        parts = line.split()
        if len(parts) < 2:
            return refuse(client, "unparseable request line", repr(line[:80]))
        method, target = parts[0].upper(), parts[1]
        if method != "CONNECT":
            return refuse(client, "only CONNECT is proxied; plain HTTP is refused so an "
                                  "allowlisted host cannot be reached over a channel the draft "
                                  "never shows", f"{method} {target[:80]}")
        if target.count(":") != 1:
            return refuse(client, "CONNECT target must be host:port", repr(target[:80]))
        host, _, port = target.partition(":")
        if not port.isdigit():
            return refuse(client, "CONNECT port is not a number", repr(target[:80]))
        key = (host.lower(), int(port))
        if key not in allowed:
            return refuse(client, "host:port is not on the allowlist", f"{host}:{port}")

        upstream = socket.create_connection(key, timeout=CONNECT_TIMEOUT)
        log(f"egress-proxy: ALLOW {host}:{port}")
        client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        client.settimeout(None)
        upstream.settimeout(None)
        threading.Thread(target=pipe, args=(client, upstream), daemon=True).start()
        pipe(upstream, client)
    except OSError as exc:
        return refuse(client, f"upstream error: {exc}", "(connect failed)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=3128)
    ap.add_argument("--allow", action="append", default=[])
    args = ap.parse_args()
    allowed = parse_allow(args.allow)
    log("egress-proxy: allowlist = " + ", ".join(f"{h}:{p}" for h, p in sorted(allowed)))

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("0.0.0.0", args.port))
    srv.listen(64)
    log(f"egress-proxy: listening on {args.port}")
    while True:
        conn, _ = srv.accept()
        threading.Thread(target=handle, args=(conn, allowed), daemon=True).start()


if __name__ == "__main__":
    main()

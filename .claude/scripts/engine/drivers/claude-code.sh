#!/usr/bin/env bash
# drivers/claude-code.sh -- thin POSIX wrapper over claude-code.mjs. All logic lives in Node (ADR-0031):
# one core per driver, a shell entry point so the interface in ADR-0203 is literally
# `drivers/NAME.sh run <process> <input-json> <budget>`, and so the Node-only exit
# discipline (retro-log 2026-07-16, Windows libuv) is reusable rather than re-derived.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
exec "${ARC_NODE:-node}" "$HERE/claude-code.mjs" "$@"

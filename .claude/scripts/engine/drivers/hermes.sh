#!/usr/bin/env bash
# drivers/hermes.sh -- thin POSIX wrapper over hermes.mjs. All logic lives in Node (ADR-0031):
# one core per driver, a shell entry point so the interface in ADR-0203 is literally
# `drivers/NAME.sh run <process> <input-json> <budget>`, and so the Node-only exit
# discipline (retro-log 2026-07-16, Windows libuv) is reusable rather than re-derived.
#
# CDPATH IS CLEARED, `cd` IS -P, AND ITS FAILURE IS CHECKED. All three were missing and an
# adversarial pass PROVED the first: with CDPATH exported -- common in developer profiles, and
# inherited straight through arc-run -- `cd` PRINTS the resolved directory to stdout, so HERE
# became two lines, the exec path was garbage, and the driver died with ENOENT for a reason with
# no relation to the runtime. `set -e` is not on, so a failing `cd` previously left HERE empty and
# exec-ed /hermes.mjs. -P resolves symlinks here as well, matching the realpath both-sides fix the
# Node main-guard needed for the same reason.
set -u
HERE="$(CDPATH= cd -P -- "$(dirname -- "$0")" && pwd)" || exit 1
[ -n "$HERE" ] || { printf 'hermes.sh: could not resolve its own directory\n' >&2; exit 1; }
exec "${ARC_NODE:-node}" "$HERE/hermes.mjs" "$@"

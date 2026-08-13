#!/usr/bin/env bash
# OWNER PASTE -> .claude/hooks/SessionStart.d/60-jobs.sh
#
# This file cannot be written from a session: `.claude/hooks/**` is on `ungrantable_resources`
# (ADR-0502) AND in `.claude/settings.json`'s permissions.deny. Two independent layers refuse it,
# and that is the rule working rather than an obstacle -- a hook is code that runs on every
# session start, so an agent that can write one can arrange to run anything, forever, unattended.
#
# Copy this file to `.claude/hooks/SessionStart.d/60-jobs.sh` and make it executable.
#
# ---------------------------------------------------------------------------------------------
# scheduler -- tell the session which jobs have gone quiet. READ AND PRINT ONLY.
#
# THE HARD LINE (SCH-H, and it is lint-enforced): this fragment may READ the schedule and PRINT
# what it finds. It may NEVER run a job. A SessionStart hook that executes work is a daemon --
# it fires on a trigger nobody scheduled, at a moment nobody chose, with no receipt naming why.
# The whole module exists to keep arc daemon-free, so the nudge that advertises it must not be
# the one thing that breaks it.
#
# Concretely that means this file calls `arc-jobs panel`, which is a pure derivation, and never
# `arc-jobs run` or `arc-jobs catchup`. The lint in tests/jobs-nudge.bats greps the INSTALLED
# file for the executing verbs and fails if one appears -- a rule that lives only in a comment is
# a rule that survives exactly until someone is in a hurry.
#
# bash-3.2 / POSIX-safe (macOS BSD leg). Never blocks the session: every path exits 0.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

JOBS=".claude/scripts/hq/arc-jobs.mjs"
[ -f "$JOBS" ] || exit 0                       # scheduler not installed here
[ -f "hq.jobs.yaml" ] || exit 0                # nothing is scheduled in this root
command -v node >/dev/null 2>&1 || exit 0

# `panel` derives; it does not act. A non-zero exit here means the schedule is illegal or the
# spine is unreadable, and neither is this hook's business to report -- jobs-lint owns the first
# and the brief owns the second.
OUT="$(node "$JOBS" panel 2>/dev/null)" || exit 0

# Only the needs-you half is worth a session's attention. The full table is one command away and
# printing it every session is how a nudge becomes noise people filter out (pre-mortem row 5).
NAG="$(printf '%s\n' "$OUT" | sed -n '/^needs-you (/,$p')"
[ -n "$NAG" ] || exit 0

printf '%s\n' "$NAG"
printf '  these are DERIVED from silence, not from an event -- a job that dies emits nothing.\n'
printf '  catch them up when you choose to: node %s catchup\n' "$JOBS"
exit 0

#!/usr/bin/env bash
# policy -- the interactive enforcement point (REQ-05, ADR-0501 layer 1).
#
# This is the SAME library the arc-run wrapper calls (POL-D). No policy logic lives here: the
# fragment extracts the tool and its target, asks `authorizeAction`, and translates the answer
# into the dispatcher's contract. Two interpretations of policy is guaranteed drift, so there is
# exactly one, and this file is deliberately too thin to hold an opinion.
#
# THE FRAGMENT EXITS 2 ON ITS OWN INTERNAL ERROR. ADR-0501: exit 2 is the only fail-closed path
# a PreToolUse hook has, and a check that cannot decide must not shrug. That is why every error
# branch below ends in `exit 2` rather than `exit 0` -- the opposite of the surrounding
# fragments, which degrade permissively because they guard conveniences rather than authority.
#
# WHAT IT CANNOT DO, and why layer 2 exists: if this file is deleted, renamed, or its interpreter
# is unavailable, the dispatcher runs zero fragments and returns 0. Nothing here can prevent
# that -- which is why the high-blast-radius capabilities also carry a static `permissions.deny`
# rule that holds when this file does not run at all, and why `.claude/hooks/**` is an
# un-grantable resource (ADR-0502).
set -uo pipefail

# ---------------------------------------------------------------------------------------------
# ENABLEMENT GATE -- and this is a real decision, not a "hook later" (POL-H).
#
# The fragment is complete and its enforcement is fixture-proven. Turning it on repo-wide is a
# different act: `session:interactive` currently holds shell and write at L1, so every Bash and
# every Write in a live session is `propose` -- correct by the model and unusable as a session.
# Making it usable means RAISING A CEILING in hq.policy.yaml, and POL-A says a ceiling change is
# a human edit in a reviewed diff, never something a build session grants itself on the way past.
#
# So: built, tested, shipped, and armed by an explicit flag until the owner sets the interactive
# ceiling deliberately. The tests set ARC_POLICY_HOOK=1, so the enforcement path is exercised on
# every CI run rather than sitting unproven behind a flag -- which is the difference between this
# and the "hook later" state POL-H forbids.
#
# Found the honest way: installing it live blocked the very session that wrote it, on its own
# chaining rule, within one command.
# ---------------------------------------------------------------------------------------------
[ "${ARC_POLICY_HOOK:-0}" = "1" ] || exit 0

. "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/_dispatch.sh" 2>/dev/null || exit 2

PAYLOAD=$(cat)
ROOT="${CLAUDE_PROJECT_DIR:-.}"

# No policy library in this tree -- an older consumer repo or a partial install. Not in force,
# same contract arc-run keeps, and it says so rather than passing silently.
if [ ! -f "$ROOT/.claude/scripts/hq/lib/policy/run-gate.mjs" ]; then
  exit 0
fi

# The decision is made in Node, because the library is the only thing entitled to make it.
# The payload goes in on stdin so no shell quoting touches it -- an apostrophe in a filename
# would otherwise close the program (CLAUDE.md's rule, and it has bitten this repo three times).
DECISION=$(printf '%s' "$PAYLOAD" | "${ARC_NODE:-node}" "$ROOT/.claude/scripts/hq/policy-hook.mjs" 2>&1)
STATUS=$?

case "$STATUS" in
  0) exit 0 ;;                              # allowed, or not in force
  2) printf '%s\n' "$DECISION" >&2; exit 2 ;;  # denied by policy
  *)
    # ANY other outcome is a check that failed to decide. Deny, and say why -- a policy guard
    # that cannot run is not permission to proceed.
    printf 'BLOCKED by policy: the check did not complete (exit %s): %s\n' "$STATUS" "$DECISION" >&2
    exit 2
    ;;
esac

#!/usr/bin/env bash
# policy-decide -- the interactive enforcement point's ONE body (REQ-05, ADR-0501 layer 1).
#
# Sourced by BOTH PreToolUse.d/40-policy.sh (matcher `Bash`) and PreToolUse-edit.d/40-policy.sh
# (matcher `Edit|Write`). It is a separate file rather than a copy for the reason the whole
# engine exists: POL-D, one implementation and two consumers. Two fragments each holding their
# own translation of a policy answer is guaranteed drift, and drift here is silent -- both keep
# exiting 0 while they stop agreeing about what a denial looks like.
#
# WHY THE SECOND CONSUMER EXISTS. A fresh adversarial pass found that `.claude/settings.json`
# wired the policy fragment under the `Bash` matcher ONLY. The `Edit|Write` matcher ran
# PreToolUse-edit.d/, which held a freeze guard and a design critic and no policy fragment at
# all -- so the entire Edit / Write tool family reached no policy check, while
# policy-hook.mjs carried a RESOURCE_FIELD map for those very tools that nothing ever invoked.
#
# The consequence was demonstrated end to end, with the Bash gate ARMED: Write replaced
# authorize.mjs (10658 bytes -> 153, returning execute unconditionally), after which the armed
# Bash gate permitted a settings.json edit it had refused one command earlier. The
# un-grantable-resource list (ADR-0502) is enforced by authorizeAction, and the write path never
# reached it. This is the same class as the already-fixed defect where arc-run was not the only
# door into a driver, recurring one layer up: "enforcement lives in code paths agents cannot
# bypass" was false as written.
#
# THE FRAGMENT EXITS 2 ON ITS OWN INTERNAL ERROR. ADR-0501: exit 2 is the only fail-closed path
# a PreToolUse hook has, and a check that cannot decide must not shrug. Every error branch below
# ends in `exit 2` -- the opposite of the surrounding fragments, which degrade permissively
# because they guard conveniences rather than authority.
#
# WHAT IT CANNOT DO, and why layer 2 exists: if this file is deleted, renamed, or its interpreter
# is unavailable, the dispatcher runs zero fragments and returns 0. Nothing here can prevent
# that -- which is why the high-blast-radius capabilities also need a static `permissions.deny`
# rule that holds when this file does not run at all. That floor is currently INCOMPLETE: it
# carries Edit/Write entries for settings.json and hq.policy.yaml and none for
# `.claude/hooks/**` or `.claude/scripts/hq/lib/policy/**`, so layer 2 does not yet backstop the
# paths this file protects. Closing that needs an edit to settings.json, which is itself an
# un-grantable resource -- an owner action by design.
set -uo pipefail

# ---------------------------------------------------------------------------------------------
# ENABLEMENT GATE -- a real decision, not a "hook later" (POL-H).
#
# Turning enforcement on repo-wide is a different act from building it: `session:interactive`
# holds shell and write at L1, so every Bash and every Write in a live session is `propose` --
# correct by the model and unusable as a session. Making it usable means RAISING A CEILING in
# hq.policy.yaml, and POL-A says a ceiling change is a human edit in a reviewed diff, never
# something a build session grants itself on the way past.
#
# Built, tested, shipped, and armed by an explicit flag until the owner sets the interactive
# ceiling deliberately. The tests set ARC_POLICY_HOOK=1, so the enforcement path is exercised on
# every CI run rather than sitting unproven behind a flag -- the difference between this and the
# "hook later" state POL-H forbids.
#
# Read the posture honestly while the flag is off: the engine is safe because it is disarmed,
# not because it is enforcing.
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
  0) exit 0 ;;                                 # allowed, or not in force
  2) printf '%s\n' "$DECISION" >&2; exit 2 ;;  # denied by policy
  *)
    # ANY other outcome is a check that failed to decide. Deny, and say why -- a policy guard
    # that cannot run is not permission to proceed.
    printf 'BLOCKED by policy: the check did not complete (exit %s): %s\n' "$STATUS" "$DECISION" >&2
    exit 2
    ;;
esac

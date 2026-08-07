#!/usr/bin/env bash
# policy -- the interactive enforcement point for the `Edit|Write` matcher (REQ-05, ADR-0501).
#
# THIS FILE IS THE FIX FOR THE WORST HOLE THIS CYCLE FOUND. Before it existed, settings.json
# wired the policy fragment under the `Bash` matcher only; `Edit|Write` ran this directory,
# which held a freeze guard and a design critic and no policy check at all. The entire Edit and
# Write tool family therefore reached no policy decision, while policy-hook.mjs carried a
# RESOURCE_FIELD map for exactly those tools that nothing ever invoked.
#
# Demonstrated end to end with the Bash gate ARMED: a Write replaced authorize.mjs with a stub
# returning `execute` unconditionally, after which the armed Bash gate permitted a settings.json
# edit it had refused one command earlier. ADR-0502's un-grantable resource list is enforced
# inside authorizeAction, and the write path never got there.
#
# The body is shared with PreToolUse.d/40-policy.sh (POL-D: one implementation, two consumers).
#
# STILL OWED, and it is not this file's to close: the `Edit|Write` matcher in settings.json does
# not name MultiEdit or NotebookEdit, so those tools reach no fragment in this directory at all.
# settings.json is an un-grantable resource, so widening the matcher is an owner edit.
exec "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/policy-decide.sh"

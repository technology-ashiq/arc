#!/usr/bin/env bash
# policy -- the interactive enforcement point for the `Bash` matcher (REQ-05, ADR-0501 layer 1).
#
# The body lives in ../policy-decide.sh and is shared with PreToolUse-edit.d/40-policy.sh, which
# covers the `Edit|Write` matcher. Two fragments each holding their own copy of the decision is
# the POL-D violation the engine exists to prevent, and the failure is silent: both keep exiting
# 0 while they stop agreeing about what a denial looks like.
#
# This file is deliberately too thin to hold an opinion.
exec "${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/policy-decide.sh"

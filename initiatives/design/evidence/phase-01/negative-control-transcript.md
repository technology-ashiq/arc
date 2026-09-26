# Negative control — a composer reaching for a sibling, refused by the installed hooks

**Date:** 2026-09-17 · **Hooks:** the installed copies at `a0370ead`
(`PreToolUse-read.sh`, `PreToolUse-edit.sh`, `PreToolUse.sh`, `_dispatch.sh`, and the three
`design-composer` fragments), copied unchanged into a scratch sandbox.

The Phase 01 verification plan expects "the refused sibling-read transcript" as evidence. CI's
`design-composer-eyes.bats` and `design-composer-bash.bats` pin these refusals; this file is the
same refusal from the real dispatchers.

**Setup.** A scratch git repo held `.claude/scripts/{design,core}` and the hooks above, plus
`docs/design/explore/negctl/{variant-a,variant-b}/index.html` and `matrix.md`. The boundary was armed
with `composer-scope-check.sh --begin negctl variant-a` and released afterwards with `--end` (0
markers left). Each payload went to its dispatcher on stdin with `CLAUDE_PROJECT_DIR` set to the
sandbox, which is the production path. The sandbox path is shown as `<sandbox>`.

The Bash positive control is the hook's decision only; nothing was rendered.

```
### Read: the composer's OWN page (positive control)
hook: .claude/hooks/PreToolUse-read.sh
payload: {"session_id":"s","agent_type":"ui-composer","tool_name":"Read","tool_input":{"file_path":"<sandbox>/docs/design/explore/negctl/variant-a/index.html"}}
exit: 0

### Read: a SIBLING variant's page (negative control)
hook: .claude/hooks/PreToolUse-read.sh
payload: {"session_id":"s","agent_type":"ui-composer","tool_name":"Read","tool_input":{"file_path":"<sandbox>/docs/design/explore/negctl/variant-b/index.html"}}
exit: 2
stderr:
    BLOCKED by ui-composer scope: 'docs/design/explore/negctl/variant-b/index.html' belongs to a sibling variant.
    You are variant-a. Your variant's value is its independence -- you may not look.
    design composer boundary ARMED for negctl/variant-a -- armed at 2026-09-17T13:19:09Z (0 minutes ago). It never expires on its own.

### Read: the explore matrix
hook: .claude/hooks/PreToolUse-read.sh
payload: {"session_id":"s","agent_type":"ui-composer","tool_name":"Read","tool_input":{"file_path":"<sandbox>/docs/design/explore/negctl/matrix.md"}}
exit: 2
stderr:
    BLOCKED by ui-composer scope: 'docs/design/explore/negctl/matrix.md' is outside the read allowlist for negctl/variant-a.
    Allowed: your variant dir, your own session's renders, and the brief's reference pack.
    design composer boundary ARMED for negctl/variant-a -- armed at 2026-09-17T13:19:09Z (0 minutes ago). It never expires on its own.

### Write: into the SIBLING variant
hook: .claude/hooks/PreToolUse-edit.sh
payload: {"session_id":"s","agent_type":"ui-composer","tool_name":"Write","tool_input":{"file_path":"<sandbox>/docs/design/explore/negctl/variant-b/index.html","content":"x"}}
exit: 2
stderr:
    BLOCKED by ui-composer write scope: 'docs/design/explore/negctl/variant-b/index.html' belongs to a sibling variant.
    You are variant-a. Writing into another composer's work is not independence.
    design composer boundary ARMED for negctl/variant-a -- armed at 2026-09-17T13:19:09Z (0 minutes ago). It never expires on its own.

### Bash: a composer cats the SIBLING page
hook: .claude/hooks/PreToolUse.sh
payload: {"session_id":"s","agent_id":"a1","agent_type":"ui-composer","tool_name":"Bash","tool_input":{"command":"cat docs/design/explore/negctl/variant-b/index.html"}}
exit: 2
stderr:
    BLOCKED by ui-composer bash scope: 'cat docs/design/explore/negctl/variant-b/index.html' is not the renderer.
    A composer runs one command through Bash -- the renderer, on its own variant, into its own session:
      bash .claude/scripts/design/design-render.sh docs/design/explore/<id>/<variant>/index.html --mode explore --session <id>--<variant> --iter N --viewport WxH

### Bash: the composer's OWN render (positive control)
hook: .claude/hooks/PreToolUse.sh
payload: {"session_id":"s","agent_id":"a1","agent_type":"ui-composer","tool_name":"Bash","tool_input":{"command":"bash .claude/scripts/design/design-render.sh docs/design/explore/negctl/variant-a/index.html --mode explore --session negctl--variant-a --iter 1 --viewport 1440x900"}}
exit: 0
```

The fourth leak path, a page the composer wrote framing its sibling inside its own render, is closed
by ADR-1418 and shown on a real browser in `render-confinement-real-browser.md`.

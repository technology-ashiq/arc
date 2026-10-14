# Paste-ready prompt for the launch lane session (distribute Cycle 3, REQ-15 slot clause, A-17)

Paste this into the session that owns `--lane launch`:

> The distribute lane (Cycle 3, ADR-2024/2026) now has `node bin/arc.mjs init --dir <venture>` with no `--target`: it
> places every verified harness (`.claude/`, `.codex/`, `.opencode/`, `.agents/skills/`) under one version-2
> `.arc-install.json` and registers the venture in `~/.arc-private/consumers.json` for the weekly `distribute-radar`.
> REQ-15 asks that a venture is born with all of them through a launch `core` slot. Your catalog is yours, so we are not
> editing it. Please decide, through `/arc-change --lane launch`:
> 1. a slot id (our proposal: `arc-harnesses`, group `repo`, tier `core`, `depends_on: [repo]`), exit criterion
>    "`node bin/arc.mjs doctor --dir <venture>` reports 0 missing, 0 unmanaged-conflict", verify `arc-doctor`;
> 2. its provider row (the arc checkout itself; no account, no token);
> 3. whether `launch-coverage --require-core-vetted` needs a vetting row for it.
> Until then distribute records the slot clause of REQ-15 as owed, per its cut order; `arc init` alone stands.

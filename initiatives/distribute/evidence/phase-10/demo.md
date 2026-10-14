# Phase 10 live demo — a venture born with every harness, watched by the radar, then uninstalled

2026-10-14, branch head `e08d759f`, a fresh git repo holding one owner file (`README.md`). `ARC_PRIVATE_DIR` pointed
at a demo dir and the radar's receipt went to a demo spine (`ARC_SPINE_ROOT`), so nothing reached the owner's
registry or the canonical spine. Paths below are shortened to `<demo>`.

```
$ node bin/arc.mjs init --dir <venture>
plan: claude-code+codex+opencode+skills-only — 669 file(s) into <demo>/venture
apply: wrote 670 file(s) into <demo>\venture (every harness); record .arc-install.json
hooks: core.hooksPath=.claude/templates/githooks (branch guard + secret scan at commit time)
registry: registered <demo>\venture
exit=0
dirs at birth: .agents/skills .arc-install.json .claude .codex .opencode 
$ node bin/arc.mjs outdated --all
<demo>\venture · up to date
outdated --all: 1 project(s) · 0 behind · 1 up to date · 0 unmeasurable · 0 missing
RAN arc-outdated
$ ARC_RADAR_FORCE=1 node .claude/scripts/hq/jobs/distribute-radar.mjs   # test spine
distribute-radar: metric.observed 01M4WPQMPWKJJRP9KC6BA3V3C1 · 0 of 1 behind · 0 unmeasurable · 0 missing
$ node bin/arc.mjs uninstall --dir <venture>
hooks: core.hooksPath unset (init had set it to .claude/templates/githooks)
registry: removed <demo>\venture
uninstall: 669 removed, 0 kept, record .arc-install.json removed
RAN arc-uninstall
left after: .git README.md 
README: my venture
```

REQ-15: every harness directory and one version-2 record at birth, registered. REQ-18: every managed file removed,
the owner's `README.md` intact, and the hooks path init had set is unset. REQ-19: one path-free `metric.observed`
(`value` 0, `unit_count` 1). The radar's production run waits for the owner's one-line apply of the job
(`owner-apply-radar-policy.mjs`, ADR-2026 Amendment 1). The launch slot clause of REQ-15 waits for the launch lane
(`../phase-08/launch-prompt.md`).

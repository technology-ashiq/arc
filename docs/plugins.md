# Plugins

A **plugin** is an installable bundle: skills + agents + hooks + commands + MCP servers in one
package (a skill is a single tool; a plugin is the toolbox).

> Plugins are NOT loaded from this repo. They install globally from marketplaces
> (`~/.claude/`), so there is intentionally no `.claude/plugins/` folder here —
> a committed copy would be dead weight that never loads.

## Plugins this project relies on
- TODO (e.g. **vercel** — deploy + release commands and pre-flight checks.)

## Install
Claude Code / Cowork: plugins panel → Add plugins → search (e.g. "vercel", "context7",
"front-end-design") → install. Installed plugins work across all your projects.

## Anatomy (if you ever author one)
```
my-plugin/
├── .claude-plugin/plugin.json   # manifest: { "name", "version", "description", "author" }
├── commands/*.md                # adds /my-plugin:command
├── agents/*.md                  # subagents
├── skills/*/SKILL.md            # skills
└── .mcp.json                    # bundled MCP servers
```

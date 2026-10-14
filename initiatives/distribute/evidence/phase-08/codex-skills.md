# A-15, static: Codex reads the committed `.agents/skills/` as skills-only renders it

**Holds** (2026-10-14, static only; a live Codex run is owed, not claimed, per the PLAN Goal).

## What Codex documents

- OpenAI's skills page (`https://learn.chatgpt.com/docs/build-skills`, fetched 2026-10-14): *"For repositories, Codex
  scans `.agents/skills` in every directory from your current working directory up to the repository root."* A skill is
  a directory with a `SKILL.md` (instructions + metadata). Optional metadata lives in `agents/openai.yaml`, not in the
  front matter.
- OpenAI's API skills guide (`https://developers.openai.com/api/docs/guides/tools-skills`): *"Skill front matter
  validation follows the agent skills specification"* (`agentskills.io/specification`). That spec requires `name`
  and `description`, and lists `allowed-tools` as an optional field (a space-delimited tool list).

## What arc commits

`.agents/skills/` holds 62 skills, owned by the skills-only render (ADR-2023). Three sampled front matters:

| Skill | Keys |
|---|---|
| `arc-resume` | `name`, `description`, `allowed-tools` (space-delimited) |
| `code-reviewer` | `name`, `description`, `allowed-tools` |
| `arc-commit` | `name`, `description`, `allowed-tools` |

Every key is in the spec Codex validates against. `allowed-tools` is the field codex's own render dropped, and the spec
allows it, so the owner rule (skills-only wins) costs Codex nothing. The trigger (a schema that rejects `allowed-tools`
or a skills root other than `.agents/skills/`) did not fire.

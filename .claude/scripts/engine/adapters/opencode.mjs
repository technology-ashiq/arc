#!/usr/bin/env node
/**
 * adapters/opencode.mjs -- Claude source -> OpenCode commands and agents (distribute P03, ADR-2017/2018).
 *
 * A PURE FUNCTION (ADR-0201): a source unit in, the files it renders out. Verified against OpenCode
 * 1.17.18 and opencode.ai/docs (commands, agents, permissions), 2026-10-07/09:
 *
 * - a command is `.opencode/commands/NAME.md`, frontmatter `description` and `agent`; the file name is
 *   the command name, and `$ARGUMENTS` / `$1` substitute as they do on Claude Code;
 * - an agent is `.opencode/agents/NAME.md`, frontmatter `description`, `mode` and `permission`;
 * - `permission` is keyed by tool name, `"*"` is the catch-all, and the LAST matching rule wins.
 *
 * TOOL FENCES RENDER (ADR-2017). An agent's `tools` is a hard allowlist on Claude Code, so it renders
 * as `"*": deny` and then each listed tool `allow`. A command's `allowed-tools` pre-approves tools and
 * leaves the rest to the session's own permission flow, so it renders as `"*": ask` and then `allow`,
 * on a hidden companion subagent the command names in `agent:`. A Claude tool with no OpenCode name is
 * `[unsupported]` by name, never widened to "allow everything".
 */

import { Unsupported, fate, markdown, splitTools, yamlScalar } from "./source-common.mjs";

const T = "opencode";

// Claude tool name -> OpenCode permission key. `edit` covers write and patch (docs/permissions).
const PLAIN = Object.freeze({
  Read: "read", Glob: "glob", Grep: "grep", LS: "read",
  Write: "edit", Edit: "edit", MultiEdit: "edit", NotebookEdit: "edit",
  Task: "task", Agent: "task", Skill: "skill",
  WebSearch: "websearch", WebFetch: "webfetch", AskUserQuestion: "question",
});

/** A Claude tool list -> ordered OpenCode permission lines under `permission:`. */
export function permission(raw, catchAll) {
  const keys = new Map(); // key -> "allow"
  const bash = [];
  for (const t of splitTools(raw)) {
    let m;
    if (PLAIN[t]) { keys.set(PLAIN[t], "allow"); continue; }
    if (t === "Bash") { bash.push("*"); continue; }
    if ((m = /^Bash\((.+)\)$/.exec(t))) {
      const inner = m[1].replace(/:\*$/, "");
      if (inner.trim() === "") throw new Unsupported(`the scope \`${t}\` is empty`);
      // OpenCode reads `*` and `?` as wildcards: a literal one in a Claude scope would widen the grant.
      if (/[*?]/.test(inner)) throw new Unsupported(`the scope \`${t}\` holds a wildcard character OpenCode would widen`);
      // `git diff:*` is the command alone or followed by arguments: two rules, so `git diff-tree` stays out.
      bash.push(inner);
      if (m[1].endsWith(":*")) bash.push(`${inner} *`);
      continue;
    }
    if ((m = /^mcp__([a-z0-9][a-z0-9_-]*)$/i.exec(t))) { keys.set(`${m[1]}_*`, "allow"); continue; }
    throw new Unsupported(`the tool \`${t}\` has no OpenCode permission key`);
  }
  const lines = ["permission:", `  "*": ${catchAll}`];
  for (const [k, v] of [...keys].sort()) lines.push(`  ${JSON.stringify(k)}: ${v}`);
  if (bash.length) {
    lines.push("  bash:", `    "*": ${bash.includes("*") ? "allow" : catchAll}`);
    for (const p of [...new Set(bash)].filter((p) => p !== "*").sort()) lines.push(`    ${JSON.stringify(p)}: allow`);
  }
  return lines;
}

function common(unit) {
  const out = { dropped: [] };
  for (const key of Object.keys(unit.fields)) {
    const f = fate(unit, key, T);
    if (f.startsWith("drop:")) out.dropped.push(`${key} (${f.slice(5)})`);
  }
  if (!("description" in unit.fields)) throw new Unsupported("no `description`, which every OpenCode command and agent needs");
  return out;
}

export function renderSourceFiles(unit) {
  const c = common(unit);
  const desc = `description: ${yamlScalar(unit.fields.description)}`;
  if (unit.kind === "agents") {
    const front = [desc, "mode: subagent"];
    if ("tools" in unit.fields) front.push(...permission(unit.fields.tools, "deny"));
    return { files: [{ path: `.opencode/agents/${unit.stem}.md`, text: markdown(front, T, unit.body) }], dropped: c.dropped };
  }
  const files = [];
  const front = [desc];
  if ("allowed-tools" in unit.fields) {
    const fence = `${unit.stem}-fence`;
    front.push(`agent: ${fence}`);
    const agentFront = [
      `description: ${JSON.stringify(`The tool fence of /${unit.stem}; runs only through that command.`)}`,
      "mode: subagent",
      "hidden: true",
      ...permission(unit.fields["allowed-tools"], "ask"),
    ];
    files.push({ path: `.opencode/agents/${fence}.md`, text: markdown(agentFront, T, `\nRun the /${unit.stem} command's instructions as given. This agent exists only to carry its tool fence.\n`) });
  }
  files.unshift({ path: `.opencode/commands/${unit.stem}.md`, text: markdown(front, T, unit.body) });
  return { files, dropped: c.dropped };
}

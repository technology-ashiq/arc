#!/usr/bin/env node
/**
 * adapters/skills-only.mjs -- Claude source -> agentskills.io skills (distribute P03, ADR-2009/2017/2018).
 *
 * A PURE FUNCTION (ADR-0201). Every command and every agent becomes `.agents/skills/NAME/SKILL.md`, the
 * one format the agentskills specification defines (frontmatter `name`, `description`, and the
 * experimental `allowed-tools`, a space-separated list). An agent becomes a ROLE skill: its prompt is
 * the skill body and it runs in the reading harness's one session, never as a nested harness call
 * (ADR-2009). The tool fence renders to `allowed-tools`, in Claude's own token spelling, because the
 * specification names Claude-style tokens (`Bash(git:*) Read`) as its example.
 */

import { Unsupported, fate, markdown, splitTools, yamlScalar } from "./source-common.mjs";

const T = "skills-only";

// The list is space-separated. A space is legal only inside a token's parentheses (`Bash(git diff:*)`),
// where a reader that splits on parentheses first, as Claude Code's does, keeps the token whole; a space
// anywhere else would read as two tools, so it is refused.
export function allowedTools(raw) {
  const tools = splitTools(raw);
  const bad = tools.find((t) => /\s/.test(t.replace(/\([^()]*\)$/, "")));
  if (bad) throw new Unsupported(`the tool \`${bad}\` holds a space outside its parentheses, which a space-separated allowed-tools list cannot carry`);
  return tools.join(" ");
}

export function renderSourceFiles(unit) {
  const dropped = [];
  for (const key of Object.keys(unit.fields)) {
    const f = fate(unit, key, T);
    if (f.startsWith("drop:")) dropped.push(`${key} (${f.slice(5)})`);
  }
  if (!("description" in unit.fields)) throw new Unsupported("no `description`, which the agentskills specification requires");
  const front = [`name: ${unit.stem}`, `description: ${yamlScalar(unit.fields.description)}`];
  const fence = unit.kind === "agents" ? unit.fields.tools : unit.fields["allowed-tools"];
  if (fence !== undefined) front.push(`allowed-tools: ${JSON.stringify(allowedTools(fence))}`);
  return { files: [{ path: `.agents/skills/${unit.stem}/SKILL.md`, text: markdown(front, T, unit.body) }], dropped };
}

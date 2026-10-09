#!/usr/bin/env node
/**
 * install-targets/rendered.mjs -- the plan every non-claude target shares (distribute P03, ADR-2018).
 *
 * A rendered target installs two things: the support payload (the claude-code payload minus the files
 * only Claude Code reads, because the rendered commands still call `.claude/scripts/` and read
 * `.claude/rules/`), and the target's own files from source-render.mjs, the module the goldens are
 * checked against. What the target cannot hold is computed from its matrix row, never claimed:
 * one `degraded:` line per `false` cell and one `partial:` line per `partial:` cell (REQ-02, ADR-2003).
 */

import { verifiedRows } from "../frontmatter-lint.mjs";
import { renderSourceTree } from "../source-render.mjs";
import { CLAUDE_SURFACE, fileOp, payload } from "./claude-code.mjs";
import { Refused, sha } from "./common.mjs";

/** The row's cells that are not "true", as `{ cell, kind, why }`, in the row's own order. */
export function degradedCells(tree, target) {
  const row = verifiedRows(tree).find((r) => r.id === target);
  if (!row) throw new Refused("unknown-target", `\`${target}\` is not a verified row of engine/harnesses.yaml`);
  const out = [];
  for (const [cell, v] of Object.entries(row.cells ?? {})) {
    if (v === "true") continue;
    if (v === "false") out.push({ cell, kind: "false", why: `\`${target}\` cannot hold it` });
    else if (typeof v === "string" && v.startsWith("partial:")) out.push({ cell, kind: "partial", why: v.slice(8) });
    else throw new Refused("bad-cell", `${target}.${cell} is ${JSON.stringify(v)}, neither "true", "false" nor "partial:..."`);
  }
  return out;
}

export function renderedPlan(tree, target) {
  const r = renderSourceTree(tree, target);
  const ops = [];
  for (const path of payload(tree)) if (!CLAUDE_SURFACE.some((s) => (s.endsWith("/") ? path.startsWith(s) : path === s))) ops.push(fileOp(tree, path));
  for (const [path, text] of [...r.files].sort(([a], [b]) => (a < b ? -1 : 1))) ops.push({ kind: "write", path, text, sha: sha(Buffer.from(text)) });
  const notes = [...r.lines];
  for (const [what, n] of [...r.dropped].sort()) notes.push(`dropped: ${what} in ${n} file(s)`);
  return { ops, degraded: degradedCells(tree, target), notes };
}

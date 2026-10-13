#!/usr/bin/env node
/**
 * install-targets/self-render.mjs -- arc renders its rendered targets into its own tree (distribute P08, ADR-2023).
 *
 * `arc compile --self` writes the adapters' files for codex, opencode and skills-only into the arc checkout that
 * holds the compiler, and nothing else: no support payload, no `.arc-install.json`, no `AGENTS.md` (the brain is a
 * source, never a render). The outputs are committed, so a fresh clone opens in a second harness with no install step.
 *
 * One owner per path: codex and skills-only both render `.agents/skills/<name>/SKILL.md`, with different bytes, and
 * skills-only owns it (the superset, and it keeps `allowed-tools`). Any other path two targets claim is refused by
 * name, never last-write-wins.
 *
 * `--check` renders in memory and names every path whose bytes differ, every missing path and every extra file under
 * the three roots; a harness's own first-run files (`rendered_foreign:` in engine/harnesses.yaml) are not extra.
 *
 * Zero dependencies, Node 18+.
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { verifiedRows } from "../frontmatter-lint.mjs";
import { renderSourceTree } from "../source-render.mjs";
import { Refused } from "./common.mjs";

export const SELF_TARGETS = Object.freeze(["codex", "opencode", "skills-only"]);
export const SELF_ROOTS = Object.freeze([".codex/", ".opencode/", ".agents/skills/"]);
const SHARED = ".agents/skills/";
const SHARED_OWNER = "skills-only";
const SHARED_BY = new Set(["codex", "skills-only"]);

/** The union of the three renders as path -> { text, target }, sorted by path. */
export const selfPlan = (tree) => selfPlanFrom(SELF_TARGETS.map((t) => [t, renderSourceTree(tree, t).files]));

/** The owner rule over `[target, Map(path -> text)]` pairs in render order; the probe drives it with planted renders. */
export function selfPlanFrom(renders) {
  const files = new Map();
  for (const [t, rendered] of renders) {
    for (const [path, text] of rendered) {
      if (!SELF_ROOTS.some((r) => path.startsWith(r))) throw new Refused("path-owner", `${t} renders ${path}, outside ${SELF_ROOTS.join(" ")}`);
      const prior = files.get(path);
      if (prior) {
        const shared = path.startsWith(SHARED) && SHARED_BY.has(prior.target) && SHARED_BY.has(t);
        if (!shared) throw new Refused("path-owner", `${path} is rendered by both ${prior.target} and ${t}`);
        if (t !== SHARED_OWNER) continue;
      }
      files.set(path, { text, target: t });
    }
  }
  return new Map([...files].sort(([a], [b]) => (a < b ? -1 : 1)));
}

// Files on disk under the three roots, tree-relative with `/`. Nothing is followed: a symlink is an extra file
// itself, so a linked directory cannot hide what is under it. A foreign directory entry is a prune point.
function onDisk(tree, foreign) {
  const found = [];
  const walk = (rel) => {
    const st = lstatSync(join(tree, rel));
    if (st.isDirectory() && !st.isSymbolicLink()) {
      if (foreign.has(`${rel.toLowerCase()}/`)) return;
      for (const n of readdirSync(join(tree, rel)).sort()) walk(`${rel}/${n}`);
    } else if (!(st.isFile() && foreign.has(rel.toLowerCase()))) found.push(rel);
  };
  for (const r of SELF_ROOTS) if (existsSync(join(tree, r))) walk(r.slice(0, -1));
  return found;
}

function foreignSet(tree) {
  const out = new Set();
  for (const r of verifiedRows(tree)) for (const f of Array.isArray(r.foreign) ? r.foreign : []) out.add(f.toLowerCase());
  return out;
}

const norm = (s) => s.replace(/\r/g, "");

/** Write (or with check, compare) the self-render. Returns { lines, findings }. */
export function selfRender(tree, { check = false } = {}) {
  const plan = selfPlan(tree);
  const lines = [];
  let findings = 0;
  const brain = join(tree, "AGENTS.md");
  const brainBefore = existsSync(brain) ? readFileSync(brain) : null;
  if (check) {
    for (const [path, { text }] of plan) {
      const abs = join(tree, path);
      if (!existsSync(abs)) { lines.push(`[missing] ${path} — run: node bin/arc.mjs compile --self`); findings++; continue; }
      if (norm(readFileSync(abs, "utf8")) !== norm(text)) { lines.push(`[differs] ${path} — run: node bin/arc.mjs compile --self`); findings++; }
    }
    for (const rel of onDisk(tree, foreignSet(tree))) {
      if (!plan.has(rel)) { lines.push(`[extra] ${rel} — not written by compile --self`); findings++; }
    }
    lines.push(`self-render: ${plan.size} file(s) checked under ${SELF_ROOTS.join(" ")}; ${findings} finding(s)`);
    return { lines, findings };
  }
  let wrote = 0;
  for (const [path, { text }] of plan) {
    const abs = join(tree, path);
    if (existsSync(abs) && norm(readFileSync(abs, "utf8")) === norm(text)) continue;
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    wrote++;
  }
  // A stale render left behind by a removed source file is extra, and only --check names it: the writer never
  // deletes, so it cannot remove a file someone else placed.
  const after = existsSync(brain) ? readFileSync(brain) : null;
  if (String(brainBefore) !== String(after)) throw new Refused("brain", "AGENTS.md changed during compile --self");
  lines.push(`self-render: wrote ${wrote} of ${plan.size} file(s) into ${SELF_ROOTS.join(" ")}; AGENTS.md untouched`);
  return { lines, findings };
}

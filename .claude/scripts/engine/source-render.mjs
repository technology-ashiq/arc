#!/usr/bin/env node
/**
 * source-render.mjs -- the Claude source tree rendered for one non-claude target (distribute P03, ADR-2018).
 *
 * The one place a target's files are computed. `arc-compile --input source` compares them with the
 * golden under tests/fixtures/distribute/goldens/<target>/, and the installer writes them into a
 * project, so what is goldened is byte-for-byte what is installed (ADR-2012: no second compiler).
 *
 * Inputs, each through frontmatter-lint's one walker and one parser:
 * - `.claude/commands/*.md` and `.claude/agents/*.md`, through the target adapter's `renderSourceFiles`;
 * - `.claude/skills/<name>/**`, copied as they are, because every v1 target's `skills` cell is "true"
 *   and the agentskills format is the one they share.
 * A file whose `targets:` leaves this target out is skipped and counted, never rendered.
 */

import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parseYamlSubset } from "./yaml-subset.mjs";
import { CouldNotScan, KEYS_FILE, parseFrontmatter, sourceFiles, verifiedRows } from "./frontmatter-lint.mjs";
import { Unsupported, plainValue, sourceUnit, targetsOf } from "./adapters/source-common.mjs";
import * as codex from "./adapters/codex.mjs";
import * as opencode from "./adapters/opencode.mjs";
import * as skillsOnly from "./adapters/skills-only.mjs";

export const SOURCE_TARGETS = Object.freeze({
  codex: { adapter: codex, skills: ".agents/skills/" },
  opencode: { adapter: opencode, skills: ".opencode/skills/" },
  "skills-only": { adapter: skillsOnly, skills: ".agents/skills/" },
});

export const goldenDir = (target) => `tests/fixtures/distribute/goldens/${target}/`;

const read = (abs, rel) => {
  try { return readFileSync(abs, "utf8").replace(/\r/g, ""); } catch (e) { throw new CouldNotScan(`${rel} unreadable: ${e.code || e.message}`); }
};

/** Every regular file under `.claude/skills/`, by relative path. A link or special file is unsupported by name. */
function skillFiles(root, bad) {
  const base = join(root, ".claude", "skills");
  let st;
  try { st = lstatSync(base); } catch (e) { if (e.code === "ENOENT") return []; throw new CouldNotScan(`cannot stat .claude/skills: ${e.code}`); }
  if (!st.isDirectory() || st.isSymbolicLink()) throw new CouldNotScan(".claude/skills is not a plain directory");
  const out = [];
  const walk = (abs, rel) => {
    let names;
    try { names = readdirSync(abs).sort(); } catch (e) { throw new CouldNotScan(`cannot list ${rel}: ${e.code || e.message}`); }
    for (const n of names) {
      const a = join(abs, n), r = `${rel}/${n}`;
      let s;
      try { s = lstatSync(a); } catch (e) { throw new CouldNotScan(`cannot stat ${r}: ${e.code || e.message}`); }
      if (s.isSymbolicLink() || (!s.isFile() && !s.isDirectory())) { bad(`[unsupported] ${r} — ${s.isSymbolicLink() ? "a symlink" : "not a regular file"}, which a skill copy will not follow`); continue; }
      if (s.isDirectory()) walk(a, r); else out.push(r);
    }
  };
  walk(base, ".claude/skills");
  return out;
}

/**
 * Render the tree. Returns `{ files: Map<path, text>, lines, counts, unsupportedCommands, dropped }`. `lines` are
 * the `[skipped]` / `[unsupported]` report lines, in source order. Throws CouldNotScan when it cannot read.
 */
export function renderSourceTree(root, target) {
  const t = SOURCE_TARGETS[target];
  if (!t) throw new CouldNotScan(`no source render for target \`${target}\``);
  const keys = parseYamlSubset(read(join(root, KEYS_FILE), KEYS_FILE));
  if (!keys.ok || !keys.value || typeof keys.value !== "object") throw new CouldNotScan(`${KEYS_FILE} does not parse`);
  const rows = verifiedRows(root);
  const ids = rows.map((r) => r.id);
  // A kind whose matrix cell is "false" is not placed at all: the install obeys the matrix, it does not
  // only report it (ADR-2003). No v1 row is false on commands, agents or skills; the check is still real.
  const cells = rows.find((r) => r.id === target)?.cells ?? {};
  const held = (kind) => cells[kind] !== "false";
  const files = new Map();
  const owner = new Map();
  const lines = [];
  const counts = { commands: 0, agents: 0, skills: 0, skipped: 0, unsupported: 0 };
  let unsupportedCommands = 0;
  const dropped = new Map(); // "key (cell)" -> how many files dropped it
  const place = (path, text, from) => {
    if (owner.has(path)) throw new Unsupported(`it renders ${path}, which ${owner.get(path)} already renders`);
    owner.set(path, from);
    files.set(path, text);
  };
  for (const kind of ["commands", "agents"]) {
    if (!held(kind)) { lines.push(`[skipped] .claude/${kind}/ — the \`${kind}\` cell of \`${target}\` is false`); continue; }
    for (const f of sourceFiles(root, kind)) {
      if (f.symlink || f.special || !f.rel.endsWith(".md")) {
        lines.push(`[unsupported] ${f.rel} — ${f.symlink ? "a symlink" : f.special ? "not a regular file" : "not a lowercase .md file"}`);
        counts.unsupported++; if (kind === "commands") unsupportedCommands++;
        continue;
      }
      const parsed = parseFrontmatter(read(join(root, f.rel), f.rel));
      try {
        if (!parsed.ok) throw new Unsupported(`frontmatter does not parse at line ${parsed.line}: ${parsed.what}`);
        const unit = sourceUnit(parsed, kind, f.rel, keys.value);
        const wants = targetsOf(unit, ids);
        if (!wants.includes(target)) { lines.push(`[skipped] ${f.rel} — targets: ${wants.join(", ")}`); counts.skipped++; continue; }
        if ("name" in unit.fields && plainValue(unit.fields.name) !== unit.stem) throw new Unsupported(`its name \`${plainValue(unit.fields.name)}\` differs from its file name, and this target names it by the file`);
        const r = t.adapter.renderSourceFiles(unit);
        // Placement is all-or-nothing per source file, so a collision cannot leave half a unit behind.
        for (const o of r.files) if (owner.has(o.path)) throw new Unsupported(`it renders ${o.path}, which ${owner.get(o.path)} already renders`);
        for (const o of r.files) place(o.path, o.text, f.rel);
        for (const d of r.dropped ?? []) dropped.set(`${kind}: ${d}`, (dropped.get(`${kind}: ${d}`) ?? 0) + 1);
        counts[kind]++;
      } catch (e) {
        if (!(e instanceof Unsupported)) throw e;
        lines.push(`[unsupported] ${f.rel} — ${e.message}`);
        counts.unsupported++; if (kind === "commands") unsupportedCommands++;
      }
    }
  }
  const skills = new Set();
  if (!held("skills")) lines.push(`[skipped] .claude/skills/ — the \`skills\` cell of \`${target}\` is false`);
  else for (const rel of skillFiles(root, (l) => { lines.push(l); counts.unsupported++; })) {
    const sub = rel.slice(".claude/skills/".length);
    const name = sub.split("/")[0];
    const path = `${t.skills}${sub}`;
    if (owner.has(path) && !owner.get(path).startsWith(".claude/skills/")) {
      lines.push(`[unsupported] ${rel} — it renders ${path}, which ${owner.get(path)} already renders`);
      counts.unsupported++; continue;
    }
    place(path, read(join(root, rel), rel), rel);
    skills.add(name);
  }
  counts.skills = skills.size;
  return { files, lines, counts, unsupportedCommands, dropped };
}

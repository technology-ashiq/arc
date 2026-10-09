#!/usr/bin/env node
/**
 * arc-install.mjs -- install arc into a project for one harness: plan, apply, doctor (distribute P03, ADR-2005/2018).
 *
 * Usage:
 *   arc-install.mjs --target claude-code|codex|opencode|skills-only --dry-run [--dir DIR] [--source ARC]
 *   arc-install.mjs --target T --dir DIR [--force] [--quiet] [--source ARC]
 *   arc-install.mjs --doctor DIR
 *
 * `--dry-run` prints the plan and writes nothing. Without it, the plan is applied as one transaction
 * (install-targets/common.mjs). A file already at a managed path that the last install did not write
 * refuses the run, `unmanaged-conflict` by name, unless `--force`, which the record then lists.
 *
 * Exit: 0 done (or doctor clean) · 1 a refusal, a conflict, a failed apply (rolled back), or a doctor
 * finding · 2 usage, or a path refused before planning.
 *
 * Zero dependencies, Node 18+.
 */

import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { Refused, apply, doctor, manifestRecord, preflight, readManifest, sha, targetDir } from "./install-targets/common.mjs";
import * as claudeCode from "./install-targets/claude-code.mjs";
import * as codex from "./install-targets/codex.mjs";
import * as opencode from "./install-targets/opencode.mjs";
import * as skillsOnly from "./install-targets/skills-only.mjs";

export const TARGETS = Object.freeze({ "claude-code": claudeCode, codex, opencode, "skills-only": skillsOnly });

const HERE = dirname(fileURLToPath(import.meta.url));

// The commit the files came from, as the registry stamps it: an override for tests, else git, else "unknown".
function sourceCommit(tree) {
  if (process.env.ARC_REGISTRY_COMMIT) return process.env.ARC_REGISTRY_COMMIT;
  try { return execFileSync("git", ["-C", tree, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return "unknown"; }
}

export function main(argv) {
  const opt = { target: "", dir: "", source: "", dryRun: false, force: false, quiet: false, doctor: "" };
  const given = new Map();
  const value = (flag, i) => {
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("--")) { console.error(`arc-install: ${flag} needs a value`); return null; }
    if (given.has(flag) && given.get(flag) !== v) { console.error(`arc-install: ${flag} given twice with different values`); return null; }
    given.set(flag, v);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    let v;
    if (a === "--dry-run") opt.dryRun = true;
    else if (a === "--force") opt.force = true;
    else if (a === "--quiet") opt.quiet = true;
    else if (["--target", "--dir", "--source", "--doctor"].includes(a)) { if ((v = value(a, i++)) === null) return 2; opt[a.slice(2)] = v; }
    else { console.error(`arc-install: unknown argument ${a}`); return 2; }
  }

  if (opt.doctor) {
    if (opt.target || opt.dir || opt.dryRun || opt.force) { console.error("arc-install: --doctor takes a directory and nothing else"); return 2; }
    try {
      const d = doctor(targetDir(opt.doctor));
      for (const l of d.lines) console.log(l);
      return d.counts.missing + d.counts["unmanaged-conflict"] ? 1 : 0;
    } catch (e) {
      if (!(e instanceof Refused)) throw e;
      console.log(`doctor: ${e.message}`);
      return 2;
    }
  }

  const mod = TARGETS[opt.target];
  if (!mod) { console.error(`arc-install: --target must be one of ${Object.keys(TARGETS).join(", ")}`); return 2; }
  if (!opt.dir && !opt.dryRun) { console.error("arc-install: --dir is required unless --dry-run"); return 2; }
  const tree = realpathSync(resolve(opt.source || join(HERE, "..", "..", "..")));

  try {
    // The plan prints before the directory is judged, so every refusal below follows a `plan:` line that
    // proves the installer ran (REQ-10).
    let p = mod.plan(tree);
    const files = p.ops.filter((o) => o.kind !== "mkdir");
    console.log(`plan: ${opt.target} — ${files.length} file(s), ${p.ops.length - files.length} dir(s) into ${opt.dir || "<dir>"}`);
    for (const l of p.notes) console.log(l);
    for (const d of p.degraded) console.log(`${d.kind === "false" ? "degraded" : "partial"}: ${d.cell} — ${d.why}`);
    const dir = opt.dir ? targetDir(opt.dir) : "";
    if (dir && typeof mod.finishPlan === "function") p = mod.finishPlan(p, tree, dir);
    const prior = dir ? readManifest(dir) : null;
    const pre = dir ? preflight(p.ops, dir, prior?.manifest) : { conflicts: [], dirs: [] };
    if (opt.dryRun) {
      if (!opt.quiet) for (const o of p.ops) console.log(`${o.kind === "mkdir" ? "mkdir" : o.kind} ${o.path}`);
      for (const c of pre.conflicts) console.log(`unmanaged-conflict ${c}${opt.force ? " (would be overwritten: --force)" : ""}`);
      console.log("dry-run: nothing written");
      return 0;
    }
    if (pre.conflicts.length && !opt.force) {
      for (const c of pre.conflicts) console.log(`unmanaged-conflict ${c} — a file this install did not write; refusing (--force overwrites it)`);
      console.log(`apply: refused, ${pre.conflicts.length} unmanaged-conflict(s); nothing written`);
      return 1;
    }
    const degraded = p.degraded.map((d) => `${d.cell} (${d.kind}) — ${d.why}`);
    const record = manifestRecord(opt.target, p.ops, degraded, pre.conflicts, sourceCommit(tree));
    const text = mod.MANIFEST_PATH === ".arc-install.json" ? `${JSON.stringify(record, null, 2)}\n` : mod.manifestText(tree, record);
    const manifestOp = { kind: "write", path: mod.MANIFEST_PATH, text, sha: sha(Buffer.from(text)) };
    try {
      const r = apply(p.ops, dir, manifestOp);
      console.log(`apply: wrote ${r.written} file(s) into ${dir}${pre.conflicts.length ? `, ${pre.conflicts.length} forced` : ""}; record ${mod.MANIFEST_PATH}`);
      return 0;
    } catch (e) {
      if (!e.rollback) throw e;
      console.log(`apply: FAILED — ${e.message}`);
      console.log(`rollback: ${e.rollback.restored} restored, ${e.rollback.removed} removed; this run left 0 files`);
      return 1;
    }
  } catch (e) {
    if (!(e instanceof Refused)) throw e;
    console.log(`refused [${e.reason}] ${e.message.slice(e.reason.length + 2)}`);
    return e.reason === "missing" || e.reason === "not-a-directory" || e.reason === "symlink" || e.reason === "drive-letter" || e.reason === "no-target" ? 2 : 1;
  }
}

// The main guard compares realpaths on both sides, so it still runs behind a symlinked checkout.
const self = (() => { try { return realpathSync(fileURLToPath(import.meta.url)); } catch { return ""; } })();
const invoked = (() => { try { return realpathSync(process.argv[1] ?? ""); } catch { return ""; } })();
if (self && self === invoked) process.exitCode = main(process.argv.slice(2));

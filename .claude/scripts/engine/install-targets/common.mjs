#!/usr/bin/env node
/**
 * install-targets/common.mjs -- apply and doctor for every install target (distribute P03, ADR-2005/2018).
 *
 * An install target's `plan(tree, dir)` returns ops; nothing here decides WHAT a target installs.
 * This module decides how it lands, the same way for all four targets:
 *
 * - every path is checked before anything is written: a target directory that is missing, a file, a
 *   symlink, or a drive-letter path off Windows is refused by name, and so is any op whose parent is a
 *   file or a link (REQ-10);
 * - a file already at a managed path that the last install did not write is `unmanaged-conflict`, and
 *   the install refuses unless `--force`, which the manifest then records (REQ-07);
 * - writes go to a temp file beside the destination and then rename over it. If any step fails, every
 *   rename already made is undone from the journal, so a failed run leaves 0 of its files (REQ-10);
 * - the manifest is written last, inside the same transaction, so it never names a file that did not land.
 *
 * Hashes strip CR bytes first, the transform the sync golden hashes through, so an autocrlf checkout of
 * an installed file still reads `placed`.
 */

import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix, resolve, sep } from "node:path";

import { confineRel } from "../frontmatter-lint.mjs";

export const MANIFEST = ".arc-install.json";
export const REGISTRY = ".claude/arc-registry.json";

export class Refused extends Error {
  constructor(reason, what) { super(`${reason}: ${what}`); this.reason = reason; }
}

export const sha = (buf) => createHash("sha256").update(Buffer.from(buf).filter((b) => b !== 13)).digest("hex");

const lst = (p) => { try { return lstatSync(p); } catch (e) { if (e.code === "ENOENT" || e.code === "ENOTDIR") return null; throw e; } };

// Path identity the way the filesystem sees it: Windows and macOS fold case, Linux does not.
const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);
/** True when `real` is `want` itself, compared as the filesystem compares names. */
const inside = (real, want) => fold(resolve(real)) === fold(resolve(want));
/** True when one path is the other or sits under it. */
export const overlaps = (a, b) => { const x = fold(resolve(a)) + sep, y = fold(resolve(b)) + sep; return x.startsWith(y) || y.startsWith(x); };

/** The target directory, resolved through realpath, or a named refusal (REQ-10). */
export function targetDir(dir) {
  if (typeof dir !== "string" || dir === "") throw new Refused("no-target", "--dir needs a directory");
  if (/^[A-Za-z]:/.test(dir) && process.platform !== "win32") throw new Refused("drive-letter", `${dir} is a drive-letter path, which names nothing on this system`);
  const abs = resolve(dir);
  const st = lst(abs);
  if (!st) throw new Refused("missing", `${dir} does not exist`);
  if (st.isSymbolicLink()) throw new Refused("symlink", `${dir} is a symlink; name the directory it points at`);
  if (!st.isDirectory()) throw new Refused("not-a-directory", `${dir} is a file, not a directory`);
  return realpathSync(abs);
}

/** The manifest an earlier install left, or null. claude-code keeps it inside the registry (ADR-2018). */
export function readManifest(dir) {
  for (const [rel, pick] of [[MANIFEST, (j) => j], [REGISTRY, (j) => j.install]]) {
    const p = join(dir, rel);
    const st = lst(p);
    if (!st) continue;
    if (!st.isFile()) throw new Refused("bad-manifest", `${rel} is not a regular file`);
    let j;
    try { j = JSON.parse(readFileSync(p, "utf8")); } catch (e) { throw new Refused("bad-manifest", `${rel} does not parse: ${e.message}`); }
    const m = j && typeof j === "object" ? pick(j) : undefined;
    if (m === undefined && rel === REGISTRY) continue;
    if (!m || typeof m !== "object" || m.version !== 1 || !m.files || typeof m.files !== "object" || Array.isArray(m.files)) throw new Refused("bad-manifest", `${rel} holds no version-1 install record`);
    return { rel, manifest: m };
  }
  return null;
}

/**
 * Check every op against the directory. Returns `{ conflicts, dirs }`: the paths an unmanaged file holds,
 * and the directories the apply will create (shallowest first). Throws Refused on a path no install may use.
 */
export function preflight(ops, dir, prior) {
  const managed = new Set(Object.keys(prior?.files ?? {}));
  const conflicts = [];
  const dirs = new Set();
  const seen = new Set();
  for (const op of ops) {
    if (confineRel(op.path) === null || op.path.endsWith("/")) throw new Refused("escapes", `${JSON.stringify(op.path)} is not a plain path inside the target`);
    const key = op.path.toLowerCase();
    if (seen.has(key)) throw new Refused("duplicate", `${op.path} is planned twice (paths that differ only in case are one file on Windows and macOS)`);
    seen.add(key);
    const segs = op.path.split("/");
    for (let i = 1; i < segs.length; i++) {
      const rel = segs.slice(0, i).join("/");
      const st = lst(join(dir, rel));
      if (!st) { dirs.add(rel); continue; }
      if (st.isSymbolicLink()) throw new Refused("linked-parent", `${rel} is a symlink, and ${op.path} would be written through it`);
      if (!st.isDirectory()) throw new Refused("file-as-dir", `${rel} is a file where ${op.path} needs a directory`);
      // A junction or other reparse point can read as a plain directory under lstat, so the parent's
      // realpath must still be the path itself, inside the target (attack 74bcf43 B5, B6).
      if (!inside(realpathSync(join(dir, rel)), join(dir, rel))) throw new Refused("linked-parent", `${rel} resolves outside the target, and ${op.path} would be written through it`);
    }
    if (op.kind === "mkdir") { const st = lst(join(dir, op.path)); if (!st) dirs.add(op.path); else if (!st.isDirectory() || st.isSymbolicLink()) throw new Refused("file-as-dir", `${op.path} must be a directory`); continue; }
    const st = lst(join(dir, op.path));
    if (!st) continue;
    if (st.isSymbolicLink()) throw new Refused("symlink", `${op.path} is a symlink; an install never writes through one`);
    if (!st.isFile()) throw new Refused("not-a-file", `${op.path} exists and is not a regular file`);
    if (op.kind === "merge") continue; // a merged file keeps the project's own keys by design
    const have = sha(readFileSync(join(dir, op.path)));
    if (have === op.sha) continue;
    if (managed.has(op.path) && prior.files[op.path] === have) continue; // ours, unchanged since we wrote it
    conflicts.push(op.path);
  }
  return { conflicts, dirs: [...dirs].sort((a, b) => a.split("/").length - b.split("/").length || (a < b ? -1 : 1)) };
}

/** The bytes an op writes. */
export const opBytes = (op) => (op.text !== undefined ? Buffer.from(op.text, "utf8") : readFileSync(op.from));

/**
 * Write the ops, transactionally. `manifestOp` is written last. Returns `{ written }`, or throws after
 * rolling back with `e.rollback = { restored, removed }` set, so the caller can print what was undone.
 */
export function apply(ops, dir, manifestOp, { log = () => {}, backup = [] } = {}) {
  // A random tag per run, and every temp and backup name opened exclusively, so a file or link planted at
  // a predictable name is never written through or overwritten (attack 74bcf43 B2, B3).
  const tag = `.arc-tmp-${randomBytes(6).toString("hex")}`;
  const backupStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const created = [];
  const staged = [];
  const copies = [];
  const journal = [];
  const failAt = Number(process.env.ARC_INSTALL_INJECT_FAIL_AT || 0); // test hook: fail the Nth commit rename
  const all = [...ops.filter((o) => o.kind !== "mkdir"), manifestOp];
  // Each restore is its own step: one that fails is listed and the rest still run (attack 74bcf43 B1).
  const undo = () => {
    let restored = 0, removed = 0;
    const failed = [];
    for (const j of journal.slice().reverse()) {
      try {
        rmSync(j.dest, { force: true });
        if (j.bak) { renameSync(j.bak, j.dest); restored++; } else removed++;
      } catch (err) { failed.push(`${j.dest}${j.bak ? ` (its original is at ${j.bak})` : ""}: ${err.code || err.message}`); }
    }
    for (const t of [...staged, ...copies]) { try { rmSync(t, { force: true }); } catch (err) { failed.push(`${t}: ${err.code || err.message}`); } }
    let left = 0;
    for (const d of created.slice().reverse()) { try { rmdirSync(d); } catch { left++; } }
    return { restored, removed, failed, left };
  };
  // A signal mid-run rolls back before the process ends, so Ctrl-C never strands a file under its backup name.
  const onSignal = (sig) => { const r = undo(); console.log(`rollback: ${sig} — ${r.restored} restored, ${r.removed} removed`); process.exit(130); };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    for (const op of ops.filter((o) => o.kind === "mkdir")) mkdirTree(dir, op.path, created);
    for (const op of all) {
      for (let d = dirname(op.path); d !== "."; d = dirname(d)) if (!existsSync(join(dir, d))) { mkdirTree(dir, d, created); break; }
      const tmp = join(dir, op.path) + tag;
      if (op.text !== undefined) writeFileSync(tmp, op.text, { encoding: "utf8", flag: "wx" });
      else copyFileSync(op.from, tmp, fsConstants.COPYFILE_EXCL);
      staged.push(tmp);
    }
    // A file --force overwrites is kept under .arc-install-backup/<stamp>/ before anything is renamed, so an
    // overwrite of a project's own file can be undone by hand after a successful run (attack 74bcf43 B9).
    for (const p of backup) {
      const to = join(dir, ".arc-install-backup", backupStamp, p);
      mkdirTree(dir, posix.dirname(`.arc-install-backup/${backupStamp}/${p}`), created);
      copyFileSync(join(dir, p), to, fsConstants.COPYFILE_EXCL);
      copies.push(to); // removed by a rollback, kept by a success
    }
    let n = 0;
    for (const op of all) {
      n++;
      if (failAt && n === failAt) throw new Error(`injected failure at file ${n} (${op.path})`);
      const dest = join(dir, op.path);
      let bak = null;
      if (existsSync(dest)) {
        bak = `${dest}${tag}.bak`;
        if (lst(bak)) throw new Error(`${bak} already exists; refusing to overwrite it`);
        renameSync(dest, bak);
      }
      journal.push({ dest, bak });
      renameSync(staged.shift(), dest);
      log(op);
    }
  } catch (e) {
    e.rollback = undo();
    throw e;
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }
  for (const j of journal) if (j.bak) rmSync(j.bak, { force: true });
  return { written: all.length, backup: backup.length ? `.arc-install-backup/${backupStamp}/` : null };
}

function mkdirTree(dir, rel, created) {
  const segs = rel.split("/");
  for (let i = 1; i <= segs.length; i++) {
    const a = join(dir, ...segs.slice(0, i));
    if (!existsSync(a)) { mkdirSync(a); created.push(a); }
  }
}

/** The install record: every file the run owns, by CR-stripped sha256, plus what it could not hold. */
export function manifestRecord(target, ops, degraded, forced, source) {
  const files = {};
  for (const op of ops) if (op.kind !== "mkdir") files[op.path] = op.sha;
  return { version: 1, target, source, files, degraded, forced };
}

/** The truth of an install, path by path (REQ-07). Returns `{ lines, counts }`. */
export function doctor(dir) {
  const found = readManifest(dir);
  if (!found) throw new Refused("not-installed", `no ${MANIFEST} and no install record in ${REGISTRY}`);
  const m = found.manifest;
  const lines = [`doctor: ${m.target} install (manifest ${found.rel})`];
  const counts = { placed: 0, degraded: 0, missing: 0, "unmanaged-conflict": 0 };
  for (const p of Object.keys(m.files).sort()) {
    if (confineRel(p) === null || isAbsolute(p)) { lines.push(`unmanaged-conflict ${p} — the manifest names a path outside the install`); counts["unmanaged-conflict"]++; continue; }
    const st = lst(join(dir, p));
    let state;
    if (!st) state = "missing";
    else if (!st.isFile() || st.isSymbolicLink()) state = "unmanaged-conflict";
    else state = sha(readFileSync(join(dir, p))) === m.files[p] ? "placed" : "unmanaged-conflict";
    counts[state]++;
    lines.push(`${state} ${p}`);
  }
  for (const d of Array.isArray(m.degraded) ? m.degraded : []) { lines.push(`degraded ${d}`); counts.degraded++; }
  lines.push(`doctor: ${counts.placed} placed, ${counts.degraded} degraded, ${counts.missing} missing, ${counts["unmanaged-conflict"]} unmanaged-conflict`);
  return { lines, counts };
}

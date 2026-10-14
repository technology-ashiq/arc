#!/usr/bin/env node
/**
 * install-targets/lifecycle.mjs -- `arc outdated` and `arc upgrade` (distribute P09, ADR-2024, ADR-2025).
 *
 * Both read the project's manifest first and touch only the paths it names (or, for upgrade, the paths the new render
 * names, checked before any write). The CLI's own checkout is one version; the project's rendered version is another,
 * recorded in the manifest as tag + commit. `outdated` compares the two and prints the CHANGELOG sections between
 * them; `upgrade` re-renders, backs up locally changed managed files, refuses a BREAKING range without --confirm, and
 * with --to renders from a read-only extract of that tag (a temporary index), never a checkout in the running tree.
 *
 * Exit codes are the caller's (bin/arc.mjs): outdated 0 up to date · 1 behind · 3 not-installed · 4 unknown or
 * diverged commit; upgrade 0 done · 1 refused/conflict/failed · 3 not-installed · 5 BREAKING without --confirm ·
 * 6 tag not fetched.
 *
 * Zero dependencies, Node 18+.
 */

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, sep } from "node:path";
import { randomBytes } from "node:crypto";

import { MANIFEST, Refused, apply, preflight, readManifest, sha, manifestRecord } from "./common.mjs";

const git = (tree, args) => {
  const r = spawnSync("git", ["-C", tree, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, timeout: 60_000, env: cleanEnv() });
  return { status: r.error ? -1 : r.status, out: (r.stdout || "").trim() };
};
// A caller's GIT_* (a hook context sets GIT_DIR, GIT_INDEX_FILE, GIT_OBJECT_DIRECTORY ...) would point every call here at
// another repository or index; none of them is ever inherited (attack cc5f385 B7).
const cleanEnv = (extra = {}) => { const e = { ...process.env }; for (const k of Object.keys(e)) if (/^GIT_/i.test(k)) delete e[k]; return { ...e, ...extra }; };
const short = (c) => (typeof c === "string" && /^[0-9a-f]{7,40}$/.test(c) ? c.slice(0, 8) : String(c));
const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);

/**
 * A manifest path, judged before it is used for anything (ADR-2024): relative, no `.`/`..`/empty segment, no
 * backslash, colon or NUL, and its realpath (or its nearest existing parent's) inside the project. Returns the
 * absolute path; throws Refused("manifest-path", <path>) naming the path.
 */
export function safePath(dir, p) {
  const refuse = (why) => { throw new Refused("manifest-path", `${JSON.stringify(p)} ${why}; nothing was written or removed`); };
  if (typeof p !== "string" || p === "" || p.includes("\u0000")) refuse("is empty or holds a NUL");
  if (/[\\:]/.test(p) || p.startsWith("/")) refuse("is absolute or holds a backslash or colon");
  const segs = p.split("/");
  if (segs.some((s) => s === "" || s === "." || s === "..")) refuse("has an empty, `.` or `..` segment");
  const root = realpathSync(dir);
  const at = join(root, ...segs);
  // Walk up to the deepest part that exists, and require its realpath inside the project: a symlink or junction
  // anywhere on the way is followed by realpath and caught here.
  let probe = at;
  for (;;) {
    let st = null;
    try { st = lstatSync(probe); } catch { st = null; }
    if (st) {
      if (st.isSymbolicLink() && probe === at) refuse("is a symlink");
      const real = realpathSync(probe);
      if (!(fold(real) === fold(root) || fold(real).startsWith(fold(root) + sep))) refuse("resolves outside the project");
      break;
    }
    const up = dirname(probe);
    if (up === probe) break;
    probe = up;
  }
  return at;
}

/** Every path of the manifest, judged before anything else is done (so a mutant record stops the verb whole). */
function judgeAll(dir, manifest) {
  for (const p of Object.keys(manifest.files)) safePath(dir, p);
}

/** VERSION-free tag name -> [major, minor, patch], or null. */
const semver = (t) => { const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(t)); return m ? m.slice(1).map(Number) : null; };
const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

/** CHANGELOG.md -> [{ version: "Unreleased" | "x.y.z", date, lines }], in file order. */
export function changelogSections(text) {
  const out = [];
  let cur = null;
  for (const line of String(text).replace(/\r/g, "").split("\n")) {
    const m = /^## \[(Unreleased|\d+\.\d+\.\d+)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/.exec(line);
    if (m) { cur = { version: m[1], date: m[2] ?? null, lines: [] }; out.push(cur); continue; }
    if (cur && /^## /.test(line)) { cur = null; continue; }
    if (cur) cur.lines.push(line);
  }
  return out;
}

/**
 * The sections a move from `fromTag` to `toTag` crosses: strictly newer than `from`, up to and including `to`;
 * `toTag` null (an untagged target, i.e. a checkout past its last tag) includes `[Unreleased]`. A `from` with no
 * section is reported, never guessed around.
 */
export function changelogRange(text, fromTag, toTag) {
  const secs = changelogSections(text);
  let from = semver(fromTag), to = semver(toTag);
  const notes = [];
  // A move to an OLDER tag crosses the same sections backwards: they are listed, and their BREAKING lines still stop
  // it (attack 0eb78f6 B12).
  if (from && to && cmp(from, to) > 0) { notes.push(`changelog: rolling back over the sections after ${toTag}`); [from, to] = [to, from]; }
  for (const t of [fromTag, toTag]) if (t && !secs.some((s) => s.version === String(t).replace(/^v/, ""))) notes.push(`changelog: no section for ${t}`);
  const pick = secs.filter((s) => {
    if (s.version === "Unreleased") return toTag === null;
    const v = semver(s.version);
    if (from && cmp(v, from) <= 0) return false;
    if (to && cmp(v, to) > 0) return false;
    return true;
  });
  const breaking = pick.flatMap((s) => s.lines.filter((l) => /^- \*\*BREAKING\*\*/.test(l.trim())).map((l) => `[${s.version}] ${l.trim()}`));
  return { sections: pick, breaking, notes };
}

/** The arc checkout's own position: commit, the tag exactly on it (or null), and the newest tag behind it. */
export function arcPosition(tree, at = "HEAD") {
  const commit = git(tree, ["rev-parse", `${at}^{commit}`]).out;
  const exact = git(tree, ["describe", "--tags", "--exact-match", "--match", "v[0-9]*", commit]);
  const last = git(tree, ["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", commit]);
  return { commit, tag: exact.status === 0 && exact.out ? exact.out : null, lastTag: last.status === 0 && last.out ? last.out : null };
}

function readInstall(dir) {
  const found = readManifest(dir);
  if (!found) return null;
  judgeAll(dir, found.manifest);
  return found;
}

/** `arc outdated` for one project. Returns { code, lines }. */
export function outdated(dir, tree) {
  const found = readInstall(dir);
  if (!found) return { code: 3, lines: [`not-installed: ${dir} has no ${MANIFEST} and no install record`] };
  const m = found.manifest;
  const arc = arcPosition(tree);
  const arcName = `${arc.tag ?? "untagged"}@${short(arc.commit)}`;
  const instName = `${m.tag ?? "untagged"}@${short(m.commit)}`;
  if (m.commit === arc.commit) return { code: 0, lines: [`up to date: installed ${instName} · arc ${arcName}`] };
  const known = git(tree, ["cat-file", "-e", `${m.commit}^{commit}`]).status === 0;
  if (!known) {
    const shallow = git(tree, ["rev-parse", "--is-shallow-repository"]).out === "true";
    return { code: 4, lines: [`unknown commit ${m.commit} -- not in this arc checkout's object store${shallow ? " (this clone is shallow: fetch its history)" : ""}; never a count`] };
  }
  if (git(tree, ["merge-base", "--is-ancestor", m.commit, arc.commit]).status !== 0) {
    return { code: 4, lines: [`diverged ${m.commit} (not an ancestor of HEAD; installed from a branch or a squash-merged commit; run arc upgrade)`] };
  }
  const n = git(tree, ["rev-list", "--count", `${m.commit}..${arc.commit}`]).out;
  const lines = [`installed ${instName} · arc ${arcName} · ${n} commits behind`];
  const fromTag = m.tag ?? arcPosition(tree, m.commit).lastTag;
  const cl = join(tree, "CHANGELOG.md");
  if (existsSync(cl)) {
    const r = changelogRange(readFileSync(cl, "utf8"), fromTag, arc.tag);
    lines.push(...r.notes);
    for (const s of r.sections) {
      lines.push(`changelog [${s.version}]${s.date ? ` - ${s.date}` : ""}`);
      for (const l of s.lines) if (/^\s*- /.test(l)) lines.push(`  ${l.trim()}`);
    }
    for (const b of r.breaking) lines.push(`BREAKING ${b}`);
  } else lines.push("changelog: none in this arc checkout");
  return { code: 1, lines };
}

/**
 * A read-only extract of `tag` from the arc checkout, in a temp dir the caller removes. Pure git through a temporary
 * index file (read-tree + checkout-index), so the checkout's own index, HEAD and worktree list are untouched; no tar,
 * which on Windows may be GNU tar reading `C:` as a remote host.
 */
function archiveTree(tree, tag) {
  if (git(tree, ["rev-parse", "-q", "--verify", `refs/tags/${tag}^{commit}`]).status !== 0) return null;
  const out = mkdtempSync(join(tmpdir(), "arc-upgrade-"));
  const dest = join(out, "tree");
  mkdirSync(dest);
  const env = cleanEnv({ GIT_INDEX_FILE: join(out, "index") });
  const gitDir = git(tree, ["rev-parse", "--absolute-git-dir"]).out;
  const step = (args) => spawnSync("git", ["--git-dir", gitDir, ...args], { cwd: out, env, stdio: "ignore" }).status === 0;
  // The extract is a render source: a tag whose tree makes `engine` a link would render from outside it (cc5f385 L6).
  const realDir = (p) => { try { const st = lstatSync(p); return st.isDirectory() && !st.isSymbolicLink(); } catch { return false; } };
  if (!gitDir || !step(["read-tree", `${tag}^{tree}`]) || !step(["--work-tree", dest, "checkout-index", "-a", "-f"]) || !realDir(join(dest, "engine")) || !realDir(join(dest, ".claude"))) {
    rmSync(out, { recursive: true, force: true });
    throw new Refused("archive", `extracting ${tag} failed`);
  }
  return { dir: dest, cleanup: () => rmSync(out, { recursive: true, force: true }) };
}

/**
 * The union of the targets' plans under ADR-2023's owner rule: codex and skills-only share `.agents/skills/`, which
 * skills-only owns; any other path two targets plan is refused. Returns ops tagged with `target`.
 */
export function unionPlan(TARGETS, tree, targets) {
  const byPath = new Map();
  const degraded = [];
  for (const t of targets) {
    const mod = TARGETS[t];
    if (!mod) throw new Refused("unknown-target", `\`${t}\` is not a target this arc knows`);
    const p = mod.plan(tree);
    for (const d of p.degraded) degraded.push(`${t}: ${d.cell} (${d.kind}) — ${d.why}`);
    for (const op of p.ops) {
      const prior = byPath.get(op.path);
      if (prior && op.kind !== "mkdir") {
        if (prior.sha === op.sha) continue; // the same bytes from two targets (the shared support payload)
        const shared = op.path.startsWith(".agents/skills/") && new Set([prior.target, t]).size === 2 && [prior.target, t].every((x) => x === "codex" || x === "skills-only");
        if (!shared) throw new Refused("path-owner", `${op.path} is planned by both ${prior.target} and ${t} with different bytes`);
        if (t !== "skills-only") continue;
      }
      if (prior && op.kind === "mkdir") continue;
      byPath.set(op.path, { ...op, target: t });
    }
  }
  return { ops: [...byPath.values()], degraded };
}

/** `arc upgrade`. Returns { code, lines }. */
export function upgrade(dir, tree, TARGETS, { to = null, confirm = false, force = false } = {}) {
  const found = readInstall(dir);
  if (!found) return { code: 3, lines: [`not-installed: ${dir} has no ${MANIFEST} and no install record; run arc init`] };
  const m = found.manifest;
  if (found.rel !== MANIFEST) return { code: 1, lines: [`refused [registry-install] ${dir} holds a claude-code install in ${found.rel}; upgrade it with arc init --target claude-code`] };
  let src = tree, cleanup = () => {};
  let target = arcPosition(tree);
  // A render from the working tree is recorded as HEAD: an uncommitted change in the arc checkout would be installed
  // under a commit that does not hold it, so it is named (attack 0eb78f6 B10).
  const dirty = to === null && git(tree, ["status", "--porcelain", "--untracked-files=no"]).out !== "";
  if (to !== null) {
    if (!/^v\d+\.\d+\.\d+$/.test(to)) return { code: 1, lines: [`refused [bad-tag] --to ${JSON.stringify(to)} is not vMAJOR.MINOR.PATCH`] };
    const a = archiveTree(tree, to);
    if (!a) return { code: 6, lines: [`tags: not fetched -- ${to} is not a tag in this arc checkout (git fetch --tags); nothing was written`] };
    src = a.dir; cleanup = a.cleanup;
    target = { commit: git(tree, ["rev-parse", `${to}^{commit}`]).out, tag: to, lastTag: to };
  }
  try {
    const lines = [];
    const fromTag = m.tag ?? (git(tree, ["cat-file", "-e", `${m.commit}^{commit}`]).status === 0 ? arcPosition(tree, m.commit).lastTag : null);
    const cl = join(src, "CHANGELOG.md");
    if (existsSync(cl)) {
      const r = changelogRange(readFileSync(cl, "utf8"), fromTag, target.tag);
      if (r.breaking.length && !confirm) {
        return { code: 5, lines: [...r.breaking.map((b) => `BREAKING ${b}`), `refused [breaking] the range ${fromTag ?? "untagged"} -> ${target.tag ?? "untagged"} holds ${r.breaking.length} BREAKING entr${r.breaking.length === 1 ? "y" : "ies"}; read them, then re-run with --confirm; nothing was written`] };
      }
      for (const b of r.breaking) lines.push(`BREAKING ${b} (confirmed)`);
    }
    const plan = unionPlan(TARGETS, src, m.targets);
    const files = plan.ops.filter((o) => o.kind !== "mkdir");
    for (const op of files) safePath(dir, op.path);
    const want = new Map(files.map((o) => [o.path, o]));
    const writes = [], backups = [], removes = [], forced = [];
    let unchanged = 0;
    for (const op of files) {
      const abs = join(dir, op.path);
      const have = existsSync(abs) && lstatSync(abs).isFile() ? sha(readFileSync(abs)) : null;
      const recorded = m.files[op.path];
      if (recorded !== undefined) {
        if (have === op.sha) { unchanged++; continue; }
        if (have !== null && have !== recorded) { backups.push(op.path); lines.push(`backed-up ${op.path}`); }
        else lines.push(`${have === null ? "restored" : "replaced"} ${op.path}`);
        writes.push(op);
      } else if (have === null) { writes.push(op); lines.push(`added ${op.path}`); }
      else if (have === op.sha) unchanged++;
      else if (force) { writes.push(op); backups.push(op.path); forced.push(op.path); lines.push(`forced ${op.path} (backed up)`); }
      else return { code: 1, lines: [`unmanaged-conflict ${op.path} — a file this install did not write; refusing (--force overwrites it, after a backup); nothing was written`] };
    }
    for (const p of Object.keys(m.files)) {
      if (want.has(p)) continue;
      const abs = join(dir, p);
      if (!existsSync(abs)) continue;
      if (sha(readFileSync(abs)) === m.files[p]) { removes.push(p); lines.push(`removed ${p}`); }
      else lines.push(`kept (modified) ${p} -- no longer arc's, and changed since it was written`);
    }
    // Only for its refusals (a symlinked parent, a non-file, a path planned twice): every conflict it would list is
    // already decided above, as a backup or an unmanaged-conflict.
    preflight(writes, dir, m);
    const record = manifestRecord(m.targets, files, plan.degraded, [...new Set([...(m.forced ?? []), ...forced])], { tag: target.tag, commit: target.commit, hooksPathSet: m.hooks_path_set });
    const text = `${JSON.stringify(record, null, 2)}\n`;
    const r = apply(writes, dir, { kind: "write", path: MANIFEST, text, sha: sha(Buffer.from(text)) }, { backup: backups });
    // A file that cannot be removed (locked, read-only) stays arc's: it is put back into the record, never dropped
    // from it while still on disk (attack 0eb78f6 B7).
    const stuck = [];
    for (const p of removes) {
      try { rmSync(safePath(dir, p), { force: true }); } catch (e) { stuck.push(p); lines.push(`kept (locked) ${p}: ${e.code || e.message}`); continue; }
      // Directories this record's files lived in, removed only when empty, never above the project.
      for (let d = dirname(p); d !== "."; d = dirname(d)) { try { rmdirSync(join(dir, d)); } catch { break; } }
    }
    if (stuck.length) {
      const rec2 = { ...record, files: { ...record.files } };
      for (const p of stuck) rec2.files[p] = { sha: m.files[p], target: m.owners?.[p] ?? m.targets[0] };
      const t2 = `${JSON.stringify(rec2, null, 2)}\n`;
      apply([], dir, { kind: "write", path: MANIFEST, text: t2, sha: sha(Buffer.from(t2)) });
    }
    if (dirty) lines.push("note: the arc checkout has uncommitted changes; they are in this render but not in the recorded commit");
    lines.push(`upgrade: ${m.tag ?? "untagged"}@${short(m.commit)} -> ${target.tag ?? "untagged"}@${short(target.commit)}: ${writes.length} written, ${unchanged} unchanged, ${removes.length} removed, ${backups.length} backed up${r.backup ? ` in ${r.backup}` : ""}${m.version === 1 ? "; record rewritten as version 2" : ""}`);
    return { code: 0, lines };
  } finally { cleanup(); }
}


// ---------- the consumer registry (ADR-2026) ----------
// `~/.arc-private/consumers.json`, never the repo: machine paths stay off a public tree. ARC_PRIVATE_DIR is the one
// door (tests point it at a temp dir). With no door set and no `~/.arc-private/` on the box, registration is skipped
// by name: a CI runner or a stranger's machine gets no new directory in its home.
export function registryPath() {
  if (process.env.ARC_PRIVATE_DIR) return { dir: process.env.ARC_PRIVATE_DIR, file: join(process.env.ARC_PRIVATE_DIR, "consumers.json"), door: true };
  const dir = join(homedir(), ".arc-private");
  return { dir, file: join(dir, "consumers.json"), door: false };
}

/** { state: "ok"|"none"|"corrupt", consumers, why } -- a corrupt file is reported, never read as empty. */
export function readRegistry() {
  const r = registryPath();
  if (!existsSync(r.file)) return { state: "none", consumers: [], path: r.file };
  let j;
  try { j = JSON.parse(readFileSync(r.file, "utf8")); } catch (e) { return { state: "corrupt", consumers: [], path: r.file, why: e.message }; }
  if (!j || j.version !== 1 || !Array.isArray(j.consumers) || j.consumers.some((c) => !c || typeof c.path !== "string" || !isAbsolute(c.path) || c.path.includes("\u0000"))) return { state: "corrupt", consumers: [], path: r.file, why: "not a version-1 consumer list" };
  return { state: "ok", consumers: j.consumers, path: r.file };
}

function writeRegistry(consumers) {
  const r = registryPath();
  mkdirSync(r.dir, { recursive: true });
  // temp + rename: the reader sees the old list or the new one. wx + a random name: a planted temp is never written through.
  const tmp = `${r.file}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ version: 1, consumers }, null, 2)}\n`, { flag: "wx" });
  renameSync(tmp, r.file);
}

// The registry directory and file are the owner's own: a link at either would send the list somewhere else
// (attack cc5f385 B4, L4, L10).
function registryLinked(r) {
  for (const p of [r.dir, r.file]) { try { if (lstatSync(p).isSymbolicLink()) return p; } catch { /* absent */ } }
  return null;
}

// One writer at a time: an exclusive lock file around read-modify-write, so two inits never lose each other's entry
// (attack cc5f385 B3). A lock older than 30 s is a dead writer's and is taken over.
function withLock(r, fn) {
  const lock = `${r.file}.lock`;
  for (let i = 0; i < 100; i++) {
    try { writeFileSync(lock, String(process.pid), { flag: "wx" }); break; } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { if (Date.now() - lstatSync(lock).mtimeMs > 30_000) rmSync(lock, { force: true }); } catch { /* gone */ }
      spawnSync(process.execPath, ["-e", "setTimeout(()=>{},100)"], { stdio: "ignore" });
      if (i === 99) throw new Error("the registry stayed locked for 10 s");
    }
  }
  try { return fn(); } finally { rmSync(lock, { force: true }); }
}

/** Add or drop a project. Returns one line saying what happened; never throws on the registry's account. */
export function register(dir, add) {
  const r = registryPath();
  if (!r.door && !existsSync(r.dir)) return `registry: skipped (no ${r.dir}; create it to have the radar watch this project)`;
  const linked = registryLinked(r);
  if (linked) return `registry: skipped (${linked} is a link; the registry is never written through one)`;
  const real = (() => { try { return realpathSync(dir); } catch { return dir; } })();
  try { mkdirSync(r.dir, { recursive: true }); } catch (e) { return `registry: skipped (${e.code || e.message})`; }
  try { return withLock(r, () => {
    const cur = readRegistry();
    if (cur.state === "corrupt") {
      // Moved aside, never overwritten: the owner's list is theirs to recover (attack A5 at kickoff).
      try { renameSync(cur.path, `${cur.path}.bad`); } catch { /* reported below */ }
      return `registry: corrupt (${cur.why}); moved to ${cur.path}.bad, nothing registered -- re-run arc init to start a fresh list`;
    }
    const others = cur.consumers.filter((c) => fold(c.path) !== fold(real));
    const next = add ? [...others, { path: real, added: new Date().toISOString().slice(0, 10) }] : others;
    writeRegistry(next.sort((a, b) => (a.path < b.path ? -1 : 1)));
    return `registry: ${add ? "registered" : "removed"} ${real}`;
  }); } catch (e) { return `registry: skipped (${e.code || e.message})`; }
}

/** `arc outdated --all`: one line per registered project; never writes inside one. */
export function outdatedAll(tree) {
  const reg = readRegistry();
  if (reg.state === "none") return { code: 3, lines: [`registry: none (${reg.path}); arc init registers a project`], counts: null };
  if (reg.state === "corrupt") return { code: 3, lines: [`registry: corrupt (${reg.why})`], counts: null };
  if (!reg.consumers.length) return { code: 0, lines: ["registry: empty -- no project registered yet"], counts: { consumers: 0, behind: 0, unmeasurable: 0 } };
  const lines = [];
  const counts = { consumers: reg.consumers.length, behind: 0, unmeasurable: 0, current: 0, missing: 0 };
  for (const c of reg.consumers) {
    let head;
    if (!existsSync(c.path)) { head = "missing-dir"; counts.missing++; }
    else {
      try {
        const r = outdated(c.path, tree);
        head = r.code === 0 ? "up to date" : r.code === 1 ? r.lines[0].replace(/^installed /, "behind: ") : r.code === 3 ? "not-installed" : `unmeasurable: ${r.lines[0]}`;
        if (r.code === 1) counts.behind++; else if (r.code === 0) counts.current++; else counts.unmeasurable++;
      } catch (e) { head = `unmeasurable: ${e.message}`; counts.unmeasurable++; }
    }
    lines.push(`${c.path} · ${head}`);
  }
  lines.push(`outdated --all: ${counts.consumers} project(s) · ${counts.behind} behind · ${counts.current} up to date · ${counts.unmeasurable} unmeasurable · ${counts.missing} missing`);
  return { code: counts.behind || counts.unmeasurable || counts.missing ? 1 : 0, lines, counts };
}

// ---------- every harness at once (ADR-2024, REQ-15) ----------
export const ALL_TARGETS = Object.freeze(["claude-code", "codex", "opencode", "skills-only"]);

/**
 * The plan `arc init` with no --target applies: the union of the four targets under ADR-2023's owner rule, plus the
 * claude-code registry file (`.claude/arc-registry.json`) as an ordinary managed file, since the v2 manifest is the one
 * record of the install.
 */
export function allPlan(TARGETS, tree) {
  const plan = unionPlan(TARGETS, tree, ALL_TARGETS);
  const cc = TARGETS["claude-code"];
  if (typeof cc.manifestText === "function") {
    const reg = JSON.parse(cc.manifestText(tree, {}));
    delete reg.install;
    const text = `${JSON.stringify(reg, null, 2)}\n`;
    plan.ops = plan.ops.filter((o) => o.path !== cc.MANIFEST_PATH);
    plan.ops.push({ kind: "write", path: cc.MANIFEST_PATH, text, sha: sha(Buffer.from(text)), target: "claude-code" });
  }
  return plan;
}

// ---------- uninstall (ADR-2024, REQ-18) ----------
/**
 * Remove exactly what the manifest lists: an unchanged managed file goes, a changed one stays (`kept (modified)`)
 * unless --force, directories left empty go, core.hooksPath is unset only when init set it and it still points at
 * arc's hooks, and the manifest goes last. Every path is judged before anything is removed.
 */
export function uninstall(dir, { force = false, hooksPath = ".claude/templates/githooks" } = {}) {
  const found = readInstall(dir);
  if (!found) return { code: 3, lines: [`not-installed: ${dir} has no ${MANIFEST} and no install record`] };
  const m = found.manifest;
  const lines = [];
  let removed = 0, kept = 0;
  const dirs = new Set();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const p of Object.keys(m.files).sort()) {
    if (p === found.rel) continue;
    const abs = safePath(dir, p);
    let st = null;
    try { st = lstatSync(abs); } catch { st = null; }
    if (!st) { lines.push(`gone ${p}`); continue; }
    if (!st.isFile()) { lines.push(`kept (not a file) ${p}`); kept++; continue; }
    const modified = sha(readFileSync(abs)) !== m.files[p];
    if (modified && !force) { lines.push(`kept (modified) ${p}`); kept++; continue; }
    if (modified) {
      // --force removes the owner's edit only after copying it out, as upgrade does (attack cc5f385 B8).
      const to = join(dir, ".arc-install-backup", stamp, ...p.split("/"));
      try { mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, readFileSync(abs), { flag: "wx" }); lines.push(`backed-up ${p} (modified; --force)`); }
      catch (e) { lines.push(`kept (backup failed) ${p}: ${e.code || e.message}`); kept++; continue; }
    }
    try { rmSync(abs, { force: true }); } catch (e) { lines.push(`kept (locked) ${p}: ${e.code || e.message}`); kept++; continue; }
    removed++;
    for (let d = dirname(p); d !== "."; d = dirname(d)) dirs.add(d);
  }
  // Deepest first, only when empty: a directory holding anything of the owner's stays.
  for (const d of [...dirs].sort((a, b) => b.split("/").length - a.split("/").length)) { try { rmdirSync(join(dir, d)); } catch { /* not empty */ } }
  if (kept && !force) {
    lines.push(`uninstall: ${removed} removed, ${kept} kept; the record ${found.rel} stays so a second run (or --force) can finish`);
    return { code: 1, lines };
  }
  // Only a finished uninstall gives the hooks back: a partial one keeps the commit-time line on (it is still arc's).
  if (m.hooks_path_set) {
    const have = git(dir, ["config", "--get", "core.hooksPath"]);
    if (have.status === 0 && have.out === hooksPath) { git(dir, ["config", "--unset", "core.hooksPath"]); lines.push(`hooks: core.hooksPath unset (init had set it to ${hooksPath})`); }
    else lines.push(`hooks: core.hooksPath left as ${have.out || "unset"} (not the value init set)`);
  } else lines.push("hooks: core.hooksPath untouched (init did not set it)");
  rmSync(join(dir, found.rel), { force: true });
  lines.push(register(dir, false));
  lines.push(`uninstall: ${removed} removed, ${kept} kept, record ${found.rel} removed`);
  return { code: 0, lines };
}

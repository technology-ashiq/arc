#!/usr/bin/env node
/**
 * install-targets/lifecycle.mjs -- `arc outdated` and `arc upgrade` (distribute P09, ADR-2024, ADR-2025).
 *
 * Both read the project's manifest first and touch only the paths it names (or, for upgrade, the paths the new render
 * names, checked before any write). The CLI's own checkout is one version; the project's rendered version is another,
 * recorded in the manifest as tag + commit. `outdated` compares the two and prints the CHANGELOG sections between
 * them; `upgrade` re-renders, backs up locally changed managed files, refuses a BREAKING range without --confirm, and
 * with --to renders from a read-only `git archive` of that tag, never a checkout in the running tree.
 *
 * Exit codes are the caller's (bin/arc.mjs): outdated 0 up to date · 1 behind · 3 not-installed · 4 unknown or
 * diverged commit; upgrade 0 done · 1 refused/conflict/failed · 3 not-installed · 5 BREAKING without --confirm ·
 * 6 tag not fetched.
 *
 * Zero dependencies, Node 18+.
 */

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";

import { MANIFEST, Refused, apply, preflight, readManifest, sha, manifestRecord } from "./common.mjs";

const git = (tree, args) => {
  const r = spawnSync("git", ["-C", tree, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  return { status: r.error ? -1 : r.status, out: (r.stdout || "").trim() };
};
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
  const from = semver(fromTag), to = semver(toTag);
  const notes = [];
  if (fromTag && !secs.some((s) => s.version === String(fromTag).replace(/^v/, ""))) notes.push(`changelog: no section for ${fromTag}`);
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

/** A read-only extract of `tag` from the arc checkout, in a temp dir the caller removes. */
function archiveTree(tree, tag) {
  if (git(tree, ["rev-parse", "-q", "--verify", `refs/tags/${tag}^{commit}`]).status !== 0) return null;
  const out = mkdtempSync(join(tmpdir(), "arc-upgrade-"));
  const tar = join(out, "src.tar");
  const a = spawnSync("git", ["-C", tree, "archive", "--format=tar", "-o", tar, tag], { stdio: "ignore" });
  if (a.status !== 0) { rmSync(out, { recursive: true, force: true }); throw new Refused("archive", `git archive ${tag} failed`); }
  const dest = join(out, "tree");
  mkdirSync(dest);
  const x = spawnSync("tar", ["-xf", tar, "-C", dest], { stdio: "ignore" });
  if (x.status !== 0 || !existsSync(join(dest, "engine"))) { rmSync(out, { recursive: true, force: true }); throw new Refused("archive", `extracting ${tag} failed`); }
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
    for (const p of removes) {
      rmSync(safePath(dir, p), { force: true });
      // Directories this record's files lived in, removed only when empty, never above the project.
      for (let d = dirname(p); d !== "."; d = dirname(d)) { try { rmdirSync(join(dir, d)); } catch { break; } }
    }
    lines.push(`upgrade: ${m.tag ?? "untagged"}@${short(m.commit)} -> ${target.tag ?? "untagged"}@${short(target.commit)}: ${writes.length} written, ${unchanged} unchanged, ${removes.length} removed, ${backups.length} backed up${r.backup ? ` in ${r.backup}` : ""}${m.version === 1 ? "; record rewritten as version 2" : ""}`);
    return { code: 0, lines };
  } finally { cleanup(); }
}


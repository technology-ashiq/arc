// proposal-branch.mjs -- the ONE writer of a proposal branch (face v2 Phase 05 kernel ring, ADR-1340).
//
// An op that changes a file never changes it in place. The owning lane's tool computes the new contents; this module
// commits them to a NEW branch named feat/face-<op>-<slug>, based on main (origin/main when the clone tracks it, else local main), by git plumbing alone:
//
//   a temporary index (GIT_INDEX_FILE) -> read-tree <base> -> hash-object -w per blob -> update-index --cacheinfo
//   -> write-tree -> commit-tree -p <base> -> update-ref --stdin "create" (refused if the branch exists, atomically)
//
// It never checks anything out, and never moves HEAD, the real index, the working tree or main: the owner's clone is
// exactly as it was, plus one ref. There is no merge, push, reset, stash or rebase anywhere in this file, and
// tests/face/proposal-branch.mjs holds each of those properties with a fixture. A human merges the branch, or does not.
//
//   planProposal({ repo, branch, files, allow })   the diff, with NOTHING written -- no object, no ref, no index
//   writeProposal({ repo, branch, files, allow, message })   the branch; returns its commit and the same diff
//
// `files` is [{ path, content }]: repo-relative POSIX paths and the full new text. `allow` is the caller's closed list
// of paths it may propose to change -- engine proposes engine/router.yaml, absorb its study report -- so a tool cannot
// be talked into proposing someone else's file. The un-grantable targets (ADR-0502) are refused whatever `allow` says.

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

/** feat/face-<op>-<slug>: the only branch names this module writes. */
export const PROPOSAL_BRANCH_RE = /^feat\/face-[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/;
/** Where a proposal is based, in order: main as the remote has it, else local main -- never a feature branch. */
export const PROPOSAL_BASES = Object.freeze(["refs/remotes/origin/main", "refs/heads/main"]);
/** Never proposed, whatever a caller allows: the targets no grant reaches (ADR-0502), and git's own directory. */
const UNGRANTABLE = [/^hq\.policy\.yaml$/i, /^\.claude\/settings(\.local)?\.json$/i, /^\.claude\/hooks(\/|$)/i];
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 16;
const IDENTITY = Object.freeze({ name: "arc face", email: "face@arc.invalid" });

export class ProposalError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.code = code; }
}

/**
 * The environment every git call runs in: the caller's, minus every GIT_* name in any case (a GIT_DIR or GIT_INDEX_FILE
 * left over would point this at another repository or at the owner's real index -- the childEnv rule), plus the
 * identity a proposal is written under and no system or global config.
 * @param {Record<string, string>} extra
 */
function gitEnv(extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.toUpperCase().startsWith("GIT_") && v !== undefined) env[k] = v;
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_AUTHOR_NAME: IDENTITY.name, GIT_AUTHOR_EMAIL: IDENTITY.email,
    GIT_COMMITTER_NAME: IDENTITY.name, GIT_COMMITTER_EMAIL: IDENTITY.email,
    GIT_TERMINAL_PROMPT: "0",
    ...extra,
  };
}

/**
 * One git call. Hooks are pointed at an empty directory: a reference-transaction or post-commit hook in the owner's
 * clone would otherwise run inside a proposal.
 * @param {string} repo @param {string[]} args @param {{ input?: string, env?: Record<string, string>, ok?: number[], hooks: string }} o
 */
function git(repo, args, o) {
  const r = spawnSync("git", ["-c", `core.hooksPath=${o.hooks}`, "-c", "core.autocrlf=false", "-c", "core.safecrlf=false", ...args], {
    cwd: repo, env: gitEnv(o.env), input: o.input, encoding: "utf8", windowsHide: true, timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
  });
  const okCodes = o.ok || [0];
  if (r.error || !okCodes.includes(r.status ?? -1)) {
    const why = r.error ? r.error.message : String(r.stderr || "").trim().split("\n").filter(Boolean)[0] || `exit ${r.status}`;
    throw new ProposalError("GIT_FAILED", `git ${args[0]} failed: ${why}`);
  }
  return { out: String(r.stdout || ""), status: r.status };
}

/**
 * The files, checked before anything reads or writes: a closed allow-list, no traversal, no git internals, no
 * un-grantable target, text only, bounded.
 * @param {unknown} files @param {readonly string[]} allow
 * @returns {{ path: string, content: string }[]}
 */
export function checkFiles(files, allow) {
  if (!Array.isArray(files) || files.length === 0) throw new ProposalError("NO_FILES", "a proposal names at least one file");
  if (files.length > MAX_FILES) throw new ProposalError("TOO_MANY_FILES", `a proposal names at most ${MAX_FILES} files`);
  if (!Array.isArray(allow) || allow.length === 0) throw new ProposalError("NO_ALLOW", "the caller names the paths it may propose; an empty list proposes nothing");
  const seen = new Set();
  return files.map((f) => {
    const path = f && typeof f.path === "string" ? f.path : "";
    const content = f && typeof f.content === "string" ? f.content : null;
    if (!/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(path)) throw new ProposalError("BAD_PATH", `${JSON.stringify(path)} is not a repo-relative path of plain segments`);
    const segs = path.split("/");
    if (segs.some((s) => s === "." || s === ".." || s.toLowerCase() === ".git")) throw new ProposalError("BAD_PATH", `${path} walks out of the tree or into git's own directory`);
    if (UNGRANTABLE.some((re) => re.test(path))) throw new ProposalError("UNGRANTABLE", `${path} is an un-grantable target (ADR-0502): no machine path proposes it, a branch included`);
    if (!allow.includes(path)) throw new ProposalError("NOT_ALLOWED", `${path} is not a file this tool proposes (it may propose: ${allow.join(", ")})`);
    if (seen.has(path.toLowerCase())) throw new ProposalError("BAD_PATH", `${path} is named twice (a case-insensitive filesystem would write one over the other)`);
    seen.add(path.toLowerCase());
    if (content === null) throw new ProposalError("BAD_CONTENT", `${path} has no text content`);
    if (content.includes("\u0000")) throw new ProposalError("BAD_CONTENT", `${path} holds a NUL byte; a proposal is text`);
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) throw new ProposalError("BAD_CONTENT", `${path} is past ${MAX_FILE_BYTES} bytes`);
    return { path, content };
  });
}

/** @param {string} branch */
function checkBranch(branch) {
  if (typeof branch !== "string" || !PROPOSAL_BRANCH_RE.test(branch) || branch.includes("--"))
    throw new ProposalError("BAD_BRANCH", `${JSON.stringify(branch)} is not a proposal branch name (feat/face-<op>-<slug>, lower case)`);
}

/**
 * The commit a proposal is based on: the remote-tracking main when this clone has one, else local main. A clone's own
 * main lags the merges the owner makes on the remote, and a proposal against a stale main is a diff against a file
 * that has already moved.
 * @param {string} repo @param {string} hooks
 */
function mainCommit(repo, hooks) {
  for (const ref of PROPOSAL_BASES) {
    const r = git(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { hooks, ok: [0, 1, 128] });
    const base = r.status === 0 ? r.out.trim() : "";
    if (/^[0-9a-f]{40,64}$/.test(base)) return base;
  }
  throw new ProposalError("NO_BASE", "this clone has neither origin/main nor a local main to base a proposal on");
}

/**
 * A file's text on the base (origin/main, else local main), or null when main does not have it. Read by plumbing, never from the
 * working tree: a proposal edits what main holds, not whatever the owner has half-changed in his checkout.
 * @param {{ repo: string, path: string }} o @returns {{ base: string, text: string | null }}
 */
export function baseText({ repo, path }) {
  return withHooks((hooks) => { const base = mainCommit(repo, hooks); return { base, text: atBase(repo, base, path, hooks) }; });
}

/** The base commit, and whether the branch already exists. @param {string} repo @param {string} branch @param {string} hooks */
function baseOf(repo, branch, hooks) {
  const base = mainCommit(repo, hooks);
  const exists = git(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], { hooks, ok: [0, 1] }).status === 0;
  if (exists) throw new ProposalError("BRANCH_EXISTS", `${branch} already exists -- a proposal never overwrites one; name another, or merge or delete that one first`);
  return base;
}

/** The file's text at the base, or null when the base does not have it. */
function atBase(repo, base, path, hooks) {
  const has = git(repo, ["ls-tree", "--name-only", base, "--", path], { hooks }).out.trim();
  if (has !== path) return null;
  return git(repo, ["cat-file", "blob", `${base}:${path}`], { hooks }).out;
}

/**
 * The unified diff of the proposal against the base, computed in a temp dir: two plain files per path and
 * `git diff --no-index`, which writes no object anywhere.
 */
function diffOf(repo, base, files, hooks) {
  const tmp = mkdtempSync(join(tmpdir(), "arc-proposal-diff-"));
  try {
    let out = "";
    for (const f of files) {
      const before = atBase(repo, base, f.path, hooks);
      const a = join(tmp, "a", f.path);
      const b = join(tmp, "b", f.path);
      mkdirSync(dirname(a), { recursive: true });
      mkdirSync(dirname(b), { recursive: true });
      writeFileSync(a, before ?? "", "utf8");
      writeFileSync(b, f.content, "utf8");
      const r = git(tmp, ["diff", "--no-index", "--no-color", "--no-ext-diff", "--no-prefix", "--", `a/${f.path}`, `b/${f.path}`], { hooks, ok: [0, 1] });
      out += r.out;
    }
    if (out.trim() === "") throw new ProposalError("NO_CHANGE", "the proposal changes nothing -- every file is already as proposed on main");
    return out;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** An empty hooks directory for one call's lifetime. */
function withHooks(fn) {
  const hooks = mkdtempSync(join(tmpdir(), "arc-proposal-nohooks-"));
  try { return fn(hooks); } finally { rmSync(hooks, { recursive: true, force: true }); }
}

/**
 * The plan: what the branch would hold, as a diff against the base. Writes nothing -- no object, no ref, no index.
 * @param {{ repo: string, branch: string, files: unknown, allow: readonly string[] }} o
 * @returns {{ branch: string, base: string, diff: string }}
 */
export function planProposal({ repo, branch, files, allow }) {
  checkBranch(branch);
  const checked = checkFiles(files, allow);
  return withHooks((hooks) => {
    const base = baseOf(repo, branch, hooks);
    return { branch, base, diff: diffOf(repo, base, checked, hooks) };
  });
}

/**
 * The apply: the branch, written by plumbing. Returns the commit and the diff it carries.
 * @param {{ repo: string, branch: string, files: unknown, allow: readonly string[], message: string }} o
 * @returns {{ branch: string, base: string, commit: string, diff: string }}
 */
export function writeProposal({ repo, branch, files, allow, message }) {
  checkBranch(branch);
  const checked = checkFiles(files, allow);
  if (typeof message !== "string" || message.trim() === "" || message.includes("\u0000"))
    throw new ProposalError("BAD_MESSAGE", "a proposal commit carries a message");
  return withHooks((hooks) => {
    const base = baseOf(repo, branch, hooks);
    const diff = diffOf(repo, base, checked, hooks);
    const idxDir = mkdtempSync(join(tmpdir(), "arc-proposal-index-"));
    try {
      const env = { GIT_INDEX_FILE: join(idxDir, "index") };
      git(repo, ["read-tree", base], { hooks, env });
      for (const f of checked) {
        // The mode the base gives the file, or a plain file for a new one: a proposal never makes something executable.
        const row = git(repo, ["ls-tree", base, "--", f.path], { hooks }).out.trim();
        const mode = /^100755 /.test(row) ? "100755" : "100644";
        // --no-filters: the blob is the bytes the tool computed, never a line-ending conversion of them.
        const blob = git(repo, ["hash-object", "-w", "--no-filters", "--stdin"], { hooks, input: f.content }).out.trim();
        git(repo, ["update-index", "--add", "--cacheinfo", `${mode},${blob},${f.path}`], { hooks, env });
      }
      const tree = git(repo, ["write-tree"], { hooks, env }).out.trim();
      const commit = git(repo, ["commit-tree", tree, "-p", base, "-F", "-"], { hooks, input: message.endsWith("\n") ? message : message + "\n" }).out.trim();
      // `create` refuses a ref that exists, inside git's own transaction: the check in baseOf is the friendly refusal,
      // this is the one a race cannot get past.
      try { git(repo, ["update-ref", "--stdin"], { hooks, input: `create refs/heads/${branch} ${commit}\n` }); }
      catch { throw new ProposalError("BRANCH_EXISTS", `${branch} appeared while the proposal was written -- nothing was overwritten`); }
      return { branch, base, commit, diff };
    } finally {
      rmSync(idxDir, { recursive: true, force: true });
    }
  });
}

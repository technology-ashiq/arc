// proposal-branch.mjs -- the ONE writer of a proposal branch (face v2 Phase 05 kernel ring, ADR-1340).
//
// An op that changes a file never changes it in place. The owning lane's tool computes the new contents; this module
// commits them to a NEW branch named feat/face-<op>-<slug>, based on main (origin/main when the clone tracks it, else
// local main), by git plumbing alone:
//
//   a temporary index (GIT_INDEX_FILE) -> read-tree <base> -> hash-object -w per blob -> update-index --cacheinfo
//   -> write-tree -> commit-tree -p <base> -> update-ref --stdin "create" (refused if the branch exists, atomically)
//
// It never checks anything out, and never moves HEAD, the real index, the working tree or main: the owner's clone is
// exactly as it was, plus one ref. There is no merge, push, reset, stash or rebase anywhere in this file, and
// tests/face/proposal-branch.mjs holds each of those properties with a fixture. A human merges the branch, or does not.
//
//   baseText({ repo, path })                              main's commit and the file's text on it (strict UTF-8)
//   planProposal({ repo, branch, files, allow, base? })    the diff, with NOTHING written -- no object, no ref, no index
//   writeProposal({ repo, branch, files, allow, message, base? })   the branch; returns its commit and the same diff
//
// All three are async: every git call runs under core/spawn-bounded.mjs, so a timeout ends git AND everything it
// started, and a call settles when git exits rather than when the last descendant lets go of its pipes. With spawnSync
// the 60 s timeout killed Git for Windows' launcher and left the real git.exe holding the temp index, and a hook that
// backgrounded a sleep turned a 700 ms write into a 60 s "timeout" (PR 3a shell attack).
//
// `base`, when given, is the commit the caller read the file from (baseText's). The write refuses BASE_MOVED if main
// is anywhere else by then: a branch based on a newer main than the text it edits silently reverts whatever landed in
// between (PR 3a attacks, both).
//
// `files` is [{ path, content }]: repo-relative POSIX paths and the full new text. `allow` is the caller's closed list
// of paths it may propose to change -- engine proposes engine/router.yaml, absorb its study report -- so a tool cannot
// be talked into proposing someone else's file. The un-grantable targets (ADR-0502) are refused whatever `allow` says.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnBounded } from "./spawn-bounded.mjs";

/** feat/face-<op>-<slug>: the only branch names this module writes. */
export const PROPOSAL_BRANCH_RE = /^feat\/face-[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/;
/** Where a proposal is based, in order: main as the remote has it, else local main -- never a feature branch. */
export const PROPOSAL_BASES = Object.freeze(["refs/remotes/origin/main", "refs/heads/main"]);
/** Never proposed, whatever a caller allows: the targets no grant reaches (ADR-0502). Matched without case. */
const UNGRANTABLE = [/^hq\.policy\.yaml$/i, /^\.claude\/settings(\.local)?\.json$/i, /^\.claude\/hooks(\/|$)/i];
// A Windows device name, with or without an extension: on the owner's checkout it names a device, not a file.
const DEVICE_RE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 16;
const IDENTITY = Object.freeze({ name: "arc face", email: "face@arc.invalid" });
const GIT_TIMEOUT_MS = 60_000;
const MAX_GIT_OUT = 16 * 1024 * 1024;
const NULL_FILE = process.platform === "win32" ? "NUL" : "/dev/null";

export class ProposalError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.code = code; }
}

/**
 * The environment every git call runs in: the caller's, minus every GIT_* name in any case (a GIT_DIR or GIT_INDEX_FILE
 * left over would point this at another repository or at the owner's real index -- the childEnv rule), plus the
 * identity a proposal is written under and no system or global config or attributes. No lazy fetch: a partial clone
 * would otherwise go to the network for a blob it does not hold.
 * @param {Record<string, string>} extra
 */
function gitEnv(extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.toUpperCase().startsWith("GIT_") && v !== undefined) env[k] = v;
  return {
    ...env,
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: NULL_FILE, GIT_ATTR_NOSYSTEM: "1", GIT_NO_LAZY_FETCH: "1",
    GIT_AUTHOR_NAME: IDENTITY.name, GIT_AUTHOR_EMAIL: IDENTITY.email,
    GIT_COMMITTER_NAME: IDENTITY.name, GIT_COMMITTER_EMAIL: IDENTITY.email,
    GIT_TERMINAL_PROMPT: "0",
    ...extra,
  };
}

/**
 * The config every git call overrides. Each one would otherwise run a program, write beside the owner's index, or hide
 * the diff: hooks (pointed at an empty directory), the fsmonitor hook and the daemon it starts (it ran twice inside a
 * proposal and left a daemon watching the owner's repo), the split index (it wrote sharedindex.* into the owner's
 * .git), the untracked cache, auto gc and maintenance, line-ending conversion, and the per-user attributes file (a
 * `*.yaml -diff` there made the plan read "Binary files differ", so the owner reviewed nothing). PR 3a shell attack.
 * @param {string} hooks
 */
const safety = (hooks) => [
  "--no-pager",
  "-c", `core.hooksPath=${hooks}`, "-c", "core.fsmonitor=false", "-c", "core.splitIndex=false", "-c", "core.untrackedCache=false",
  "-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", `core.attributesFile=${NULL_FILE}`,
  "-c", "gc.auto=0", "-c", "maintenance.auto=false",
];

/**
 * One git call.
 * @param {string} repo @param {string[]} args
 * @param {{ input?: string, env?: Record<string, string>, ok?: number[], hooks: string }} o
 * @returns {Promise<{ buf: Buffer, out: string, status: number }>}
 */
async function git(repo, args, o) {
  const out = [];
  let outBytes = 0;
  const err = [];
  let errBytes = 0;
  const r = await spawnBounded("git", [...safety(o.hooks), ...args], {
    cwd: repo, env: gitEnv(o.env), input: o.input, timeoutMs: GIT_TIMEOUT_MS,
    onData: (stream, chunk) => {
      if (stream === "out") { outBytes += chunk.length; if (outBytes <= MAX_GIT_OUT) out.push(chunk); }
      else if (errBytes < 64 * 1024) { errBytes += chunk.length; err.push(chunk); }
    },
  });
  if (r.timedOut) throw new ProposalError("GIT_FAILED", `git ${args[0]} did not finish in ${GIT_TIMEOUT_MS / 1000} s -- it, and everything it started, was ended`);
  if (outBytes > MAX_GIT_OUT) throw new ProposalError("GIT_FAILED", `git ${args[0]} printed more than ${MAX_GIT_OUT} bytes`);
  const okCodes = o.ok || [0];
  if (r.exit === null || !okCodes.includes(r.exit)) {
    const why = r.error || Buffer.concat(err).toString("utf8").trim().split(/\r?\n/).filter(Boolean)[0] || `exit ${r.exit ?? r.signal}`;
    throw new ProposalError("GIT_FAILED", `git ${args[0]} failed: ${why}`);
  }
  const buf = Buffer.concat(out);
  return { buf, out: buf.toString("utf8"), status: r.exit };
}

/** A temp directory, or a refusal that names the cause: a raw ENOENT stack is not a refusal. */
function tempDir(prefix) {
  try { return mkdtempSync(join(tmpdir(), prefix)); }
  catch (e) { throw new ProposalError("NO_TEMP", `no temp directory could be made (${e && e.code ? e.code : "error"}) -- nothing was written`); }
}

/**
 * A temp directory removed, with retries, and never allowed to replace the outcome. A scanner holding a file there
 * made rmSync throw EBUSY after update-ref had written the branch, and the caller reported a failure for a proposal
 * that had succeeded (PR 3a shell attack). Litter left in the temp dir is not a failed proposal.
 */
function removeQuietly(dir) {
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* litter, never the outcome */ }
}

/**
 * The files, checked before anything reads or writes: a closed allow-list, no traversal, no git internals, no
 * un-grantable target, no name a Windows checkout reads as another, text only, bounded.
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
    if (segs.some((s) => s === "." || s === "..")) throw new ProposalError("BAD_PATH", `${path} walks out of the tree`);
    // Windows reads a name ending in a dot as the name without it: `hq.policy.yaml.` IS hq.policy.yaml there, and
    // `.git./config` is git's own config. Refused outright, never trimmed (PR 3a attacks, both).
    if (segs.some((s) => s.endsWith("."))) throw new ProposalError("BAD_PATH", `${path} ends a name with a dot, which a Windows checkout reads as a different name`);
    if (segs.some((s) => s.toLowerCase() === ".git")) throw new ProposalError("BAD_PATH", `${path} walks into git's own directory`);
    if (segs.some((s) => DEVICE_RE.test(s))) throw new ProposalError("BAD_PATH", `${path} names a Windows device (con, nul, com1, ...), not a file`);
    if (segs.some((s) => s.startsWith("-"))) throw new ProposalError("BAD_PATH", `${path} has a name starting with "-", which a command line reads as a flag`);
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
 * that has already moved. Only "no such ref" (exit 1) falls through to the next base: an unreadable config or a
 * directory that is not a repository is git's own error, in git's own words, never "no main".
 * @param {string} repo @param {string} hooks
 */
async function mainCommit(repo, hooks) {
  for (const ref of PROPOSAL_BASES) {
    const r = await git(repo, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { hooks, ok: [0, 1] });
    const base = r.status === 0 ? r.out.trim() : "";
    if (/^[0-9a-f]{40,64}$/.test(base)) return base;
  }
  throw new ProposalError("NO_BASE", "this clone has neither origin/main nor a local main to base a proposal on");
}

/**
 * The existing branch a new one would collide with, or null. Compared WITHOUT case, and as a directory prefix either
 * way: on a case-insensitive filesystem a loose `feat/face-p2-f` shadows a packed `feat/face-P2-F`, and `create`
 * checked the exact name only -- the owner's branch was moved (PR 3a shell attack).
 * @param {string} repo @param {string} branch @param {string} hooks
 */
async function clashOf(repo, branch, hooks) {
  const want = `refs/heads/${branch}`.toLowerCase();
  const refs = (await git(repo, ["for-each-ref", "--format=%(refname)", "refs/heads/"], { hooks })).out.split(/\r?\n/).filter(Boolean);
  return refs.find((r) => { const l = r.toLowerCase(); return l === want || l.startsWith(`${want}/`) || want.startsWith(`${l}/`); }) || null;
}

/** The file's bytes at the base, or null when the base does not have it. */
async function atBase(repo, base, path, hooks) {
  const has = (await git(repo, ["ls-tree", "--name-only", base, "--", path], { hooks })).out.trim();
  if (has !== path) return null;
  return (await git(repo, ["cat-file", "blob", `${base}:${path}`], { hooks })).buf;
}

/** An empty hooks directory for one call's lifetime. */
async function withHooks(fn) {
  const hooks = tempDir("arc-proposal-nohooks-");
  try { return await fn(hooks); } finally { removeQuietly(hooks); }
}

/**
 * A file's text on the base (origin/main, else local main), or null when main does not have it. Read by plumbing, never
 * from the working tree: a proposal edits what main holds, not whatever the owner has half-changed in his checkout.
 * Strict UTF-8, BOM kept: a lossy read rewrote a Latin-1 byte into U+FFFD on the branch while the diff shown to the
 * owner changed one line (PR 3a shell attack).
 * @param {{ repo: string, path: string }} o @returns {Promise<{ base: string, text: string | null }>}
 */
export function baseText({ repo, path }) {
  return withHooks(async (hooks) => {
    const base = await mainCommit(repo, hooks);
    const bytes = await atBase(repo, base, path, hooks);
    if (bytes === null) return { base, text: null };
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new ProposalError("NOT_UTF8", `${path} on main is not valid UTF-8 -- a proposal edits text, and a lossy read would rewrite bytes nobody chose`); }
    return { base, text };
  });
}

/** The base, checked against the one the caller read from, and the branch checked free. */
async function baseOf(repo, branch, hooks, expected) {
  const base = await mainCommit(repo, hooks);
  if (expected !== undefined && base !== expected)
    throw new ProposalError("BASE_MOVED", `main moved from ${String(expected).slice(0, 12)} to ${base.slice(0, 12)} after the file was read -- nothing was written; plan again and read the new diff`);
  const clash = await clashOf(repo, branch, hooks);
  if (clash) {
    const named = clash.slice("refs/heads/".length);
    throw new ProposalError("BRANCH_EXISTS", named === branch
      ? `${branch} already exists -- a proposal never overwrites one; name another, or merge or delete that one first`
      : `${branch} would collide with the existing ${named} (a case-insensitive filesystem cannot tell the two apart, or one is the other's directory) -- nothing was written`);
  }
  return base;
}

/**
 * The unified diff of the proposal against the base, computed in a temp dir: two plain files per path and
 * `git diff --no-index`, which writes no object anywhere. The "a" side is main's RAW bytes, so the diff is the one the
 * branch carries. --text and --no-textconv, and a ceiling at the temp dir's parent so no repository's attributes or
 * config around it reach the diff.
 */
async function diffOf(repo, base, files, hooks) {
  const tmp = tempDir("arc-proposal-diff-");
  try {
    let out = "";
    for (const f of files) {
      const before = await atBase(repo, base, f.path, hooks);
      const a = join(tmp, "a", f.path);
      const b = join(tmp, "b", f.path);
      mkdirSync(dirname(a), { recursive: true });
      mkdirSync(dirname(b), { recursive: true });
      writeFileSync(a, before ?? Buffer.alloc(0));
      writeFileSync(b, f.content, "utf8");
      const r = await git(tmp, ["diff", "--no-index", "--no-color", "--no-ext-diff", "--no-textconv", "--text", "--no-prefix", "--", `a/${f.path}`, `b/${f.path}`], { hooks, ok: [0, 1], env: { GIT_CEILING_DIRECTORIES: dirname(tmp) } });
      out += r.out;
    }
    if (out.trim() === "") throw new ProposalError("NO_CHANGE", "the proposal changes nothing -- every file is already as proposed on main");
    return out;
  } finally {
    removeQuietly(tmp);
  }
}

/**
 * The plan: what the branch would hold, as a diff against the base. Writes nothing -- no object, no ref, no index.
 * @param {{ repo: string, branch: string, files: unknown, allow: readonly string[], base?: string }} o
 * @returns {Promise<{ branch: string, base: string, diff: string }>}
 */
export async function planProposal({ repo, branch, files, allow, base: expected }) {
  checkBranch(branch);
  const checked = checkFiles(files, allow);
  return withHooks(async (hooks) => {
    const base = await baseOf(repo, branch, hooks, expected);
    return { branch, base, diff: await diffOf(repo, base, checked, hooks) };
  });
}

/**
 * The apply: the branch, written by plumbing. Returns the commit and the diff it carries.
 * @param {{ repo: string, branch: string, files: unknown, allow: readonly string[], message: string, base?: string }} o
 * @returns {Promise<{ branch: string, base: string, commit: string, diff: string }>}
 */
export async function writeProposal({ repo, branch, files, allow, message, base: expected }) {
  checkBranch(branch);
  const checked = checkFiles(files, allow);
  if (typeof message !== "string" || message.trim() === "" || message.includes("\u0000"))
    throw new ProposalError("BAD_MESSAGE", "a proposal commit carries a message");
  return withHooks(async (hooks) => {
    const base = await baseOf(repo, branch, hooks, expected);
    const diff = await diffOf(repo, base, checked, hooks);
    const idxDir = tempDir("arc-proposal-index-");
    try {
      const env = { GIT_INDEX_FILE: join(idxDir, "index") };
      await git(repo, ["read-tree", base], { hooks, env });
      for (const f of checked) {
        // The mode the base gives the file, or a plain file for a new one: a proposal never makes something executable.
        const row = (await git(repo, ["ls-tree", base, "--", f.path], { hooks })).out.trim();
        const mode = /^100755 /.test(row) ? "100755" : "100644";
        // --no-filters: the blob is the bytes the tool computed, never a line-ending conversion of them.
        const blob = (await git(repo, ["hash-object", "-w", "--no-filters", "--stdin"], { hooks, input: f.content })).out.trim();
        await git(repo, ["update-index", "--add", "--cacheinfo", `${mode},${blob},${f.path}`], { hooks, env });
      }
      const tree = (await git(repo, ["write-tree"], { hooks, env })).out.trim();
      const commit = (await git(repo, ["commit-tree", tree, "-p", base, "-F", "-"], { hooks, input: message.endsWith("\n") ? message : message + "\n" })).out.trim();
      // `create` refuses a ref that exists, inside git's own transaction: the check in baseOf is the friendly refusal,
      // this is the one a race cannot get past. Its failure is named by its real cause -- a stale .lock file or a
      // branch directory is not "appeared while the proposal was written" (PR 3a shell attack).
      try { await git(repo, ["update-ref", "--stdin"], { hooks, input: `create refs/heads/${branch} ${commit}\n` }); }
      catch (e) {
        const clash = await clashOf(repo, branch, hooks).catch(() => null);
        if (clash) throw new ProposalError("BRANCH_EXISTS", `${clash.slice("refs/heads/".length)} appeared while the proposal was written -- nothing was overwritten (the objects written are unreachable, and git's gc removes them)`);
        throw new ProposalError("GIT_FAILED", `the branch could not be created, and nothing was overwritten: ${e instanceof Error ? e.message : e}`);
      }
      return { branch, base, commit, diff };
    } finally {
      removeQuietly(idxDir);
    }
  });
}

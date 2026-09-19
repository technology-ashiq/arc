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
import { join, dirname, delimiter, isAbsolute } from "node:path";
import { randomBytes } from "node:crypto";
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
 * CONFIG hooks too (git 2.54: `hook.<name>.command` / `.event`), which core.hooksPath does not reach: a
 * reference-transaction hook defined in the owner's config ran three times inside a write, could veto it, and a slow one
 * left a .lock behind (PR 3a round-2 shell attack). Each one found is disabled for the call by name -- through the
 * environment (offEnv), never `-c`: git splits `-c` at the first "=", so a hook NAMED `x=y` was never disabled and ran
 * three times inside a write (PR 3b shell attack). And the commit encoding: `i18n.commitEncoding` in the owner's
 * config stamped a Latin-1 header over UTF-8 bytes (PR 3a round-2).
 * @param {{ dir: string, off: string[] }} hooks
 */
const safety = (hooks) => [
  "--no-pager",
  "-c", `core.hooksPath=${hooks.dir}`, "-c", "core.fsmonitor=false", "-c", "core.splitIndex=false", "-c", "core.untrackedCache=false",
  "-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", `core.attributesFile=${NULL_FILE}`,
  "-c", "gc.auto=0", "-c", "maintenance.auto=false", "-c", "i18n.commitEncoding=UTF-8",
];

/**
 * The config hooks disabled by name, as git's own key/value triplets: a key there is never split, whatever it holds.
 * gitEnv drops every inherited GIT_* first, so the owner's own GIT_CONFIG_COUNT cannot add to or shadow these.
 * @param {string[]} off @returns {Record<string, string>}
 */
function offEnv(off) {
  if (off.length === 0) return {};
  const env = { GIT_CONFIG_COUNT: String(off.length) };
  off.forEach((name, i) => { env[`GIT_CONFIG_KEY_${i}`] = `hook.${name}.enabled`; env[`GIT_CONFIG_VALUE_${i}`] = "false"; });
  return env;
}

/**
 * One git call.
 * @param {string} repo @param {string[]} args
 * @param {{ input?: string, env?: Record<string, string>, ok?: number[], hooks: { dir: string, off: string[] } }} o
 * @returns {Promise<{ buf: Buffer, out: string, status: number }>}
 */
async function git(repo, args, o) {
  const out = [];
  let outBytes = 0;
  const err = [];
  let errBytes = 0;
  const r = await spawnBounded("git", [...safety(o.hooks), ...args], {
    cwd: repo, env: gitEnv({ ...offEnv(o.hooks.off), ...o.env }), input: o.input, timeoutMs: GIT_TIMEOUT_MS,
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

/**
 * The temp directory is one git can be pointed at: GIT_CEILING_DIRECTORIES is a LIST, and a temp dir whose path holds
 * the delimiter split into two entries, so a repository around it reached the plan's diff (PR 3a round-2 shell attack).
 * Checked in EVERY entry point: trial's pre-seal check lacked it, so a plan passed, the seal burned its correlation, and
 * the write then refused NO_TEMP (PR 3b shell attack).
 */
function checkTemp() {
  if (tmpdir().includes(delimiter)) throw new ProposalError("NO_TEMP", `the temp directory's path holds "${delimiter}", which git reads as a list separator -- nothing was written; point TMP elsewhere`);
  // A RELATIVE temp dir is the delimiter's twin: git drops a relative GIT_CEILING_DIRECTORIES, so the diff read the
  // config of whatever repository the relative path landed in (PR 3b round-2 shell attack: diff.context=0 there).
  if (!isAbsolute(tmpdir())) throw new ProposalError("NO_TEMP", "the temp directory is a relative path, which git will not take as a ceiling -- nothing was written; point TMP at an absolute path");
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
  if (KEY_PREFIX_RE.test(branch))
    throw new ProposalError("BAD_BRANCH", `${branch} holds a key-shaped prefix (sk-, xoxb- ...) that the spine's secret scanner reads, beside a commit hash, as a key -- build it with proposalBranch()`);
}

/** The prefixes the spine's secret scanner reads as a key's start, in the lower-case alphabet a branch is spelled in. */
const KEY_PREFIX_RE = /sk-|xox[baprs]-/;

/**
 * A proposal branch built from a caller's text: lower case, plain segments, and every key-shaped prefix defused.
 * "risk-assessment" put "sk-assessment" in the branch, and beside main's commit hash in the approval that is 32 key
 * characters -- the spine refused every pin of such a report (PR 3b logic attack; propose's class-last rule was the same
 * defect one PR earlier). The hyphen after the prefix goes: risk-assessment -> riskassessment.
 * @param {string} op @param {string} slug
 */
export function proposalBranch(op, slug) {
  const s = String(slug).toLowerCase().replace(/[^abcdefghijklmnopqrstuvwxyz0123456789-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `feat/face-${op}-${s}`.replace(/sk-/g, "sk").replace(/(xox[baprs])-/g, "$1").slice(0, 90).replace(/-+$/, "");
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

/**
 * The hooks context for one call's lifetime: an empty hooks directory, and the names of every CONFIG hook the repo's
 * effective config defines (includes and includeIf included), each disabled by name on every git call. Listing the
 * config runs no hook.
 * @param {string} repo
 */
async function withHooks(repo, fn) {
  const dir = tempDir("arc-proposal-nohooks-");
  try {
    const hooks = { dir, off: [] };
    // NUL-separated, decoded strictly, matched across every character. The line-split, lossy, `.+` parse missed a name
    // holding CR, U+2028 or U+2029, the empty name, and a byte that is not UTF-8 -- each of those hooks ran six times
    // inside a write, and one vetoed it (PR 3b round-2 shell attack).
    // EVERY key, filtered here by its bytes: git's --get-regexp runs the locale's regex, and under a UTF-8 locale `.`
    // does not match a byte that is not UTF-8, so such a hook was never listed and ran inside the write -- green on
    // Windows, red on Linux and macOS (PR 3b round-2 CI).
    const listed = await git(repo, ["config", "--name-only", "-z", "--list"], { hooks, ok: [0, 1] });
    const names = new Set();
    for (const raw of nulSplit(listed.buf).filter(isHookKey)) {
      let key;
      try { key = new TextDecoder("utf-8", { fatal: true }).decode(raw); }
      catch { throw new ProposalError("HOOK_NAME", "the repository's config defines a hook whose name is not UTF-8, which cannot be disabled by name -- nothing was written; rename it"); }
      const m = /^hook\.([\s\S]*)\.(command|event)$/i.exec(key);
      if (m) names.add(m[1]);
    }
    hooks.off = [...names].sort();
    if (hooks.off.length) await assertHooksOff(repo, hooks);
    return await fn(hooks);
  } finally { removeQuietly(dir); }
}

/** Whether a config key's BYTES are hook.<anything>.command or .event, the section and variable without case. */
function isHookKey(raw) {
  const s = raw.toString("latin1").toLowerCase();
  return s.startsWith("hook.") && (s.endsWith(".command") || s.endsWith(".event")) && s.length > "hook..event".length - 1;
}

/** A buffer split on NUL bytes, empty pieces dropped. @param {Buffer} buf @returns {Buffer[]} */
function nulSplit(buf) {
  const out = [];
  let from = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0) { if (i > from) out.push(buf.subarray(from, i)); from = i + 1; }
  if (from < buf.length) out.push(buf.subarray(from));
  return out;
}

/**
 * Every hook found is proven OFF under the environment the writes will run with, before anything is written: git reads
 * `hook.<name>.enabled` back as false for each one, or nothing is written. A name the environment cannot carry is a
 * refusal here, not a hook that runs inside the write.
 */
async function assertHooksOff(repo, hooks) {
  // --list, not --get-regexp: the same locale-bound regex (withHooks).
  const r = await git(repo, ["config", "-z", "--list"], { hooks, ok: [0, 1] });
  /** @type {Map<string, string>} */
  const last = new Map();
  for (const raw of nulSplit(r.buf)) {
    const entry = raw.toString("utf8");
    const nl = entry.lastIndexOf("\n");
    if (nl >= 0) last.set(entry.slice(0, nl), entry.slice(nl + 1));
  }
  const on = hooks.off.filter((name) => last.get(`hook.${name}.enabled`) !== "false");
  if (on.length) throw new ProposalError("HOOK_NOT_DISABLED", `the config hook ${JSON.stringify(on[0])} could not be disabled for this write -- nothing was written; rename it, or remove it from the config`);
}

/**
 * A file's text on the base (origin/main, else local main), or null when main does not have it. Read by plumbing, never
 * from the working tree: a proposal edits what main holds, not whatever the owner has half-changed in his checkout.
 * Strict UTF-8, BOM kept: a lossy read rewrote a Latin-1 byte into U+FFFD on the branch while the diff shown to the
 * owner changed one line (PR 3a shell attack).
 * @param {{ repo: string, path: string }} o @returns {Promise<{ base: string, text: string | null }>}
 */
export function baseText({ repo, path }) {
  return withHooks(repo, async (hooks) => {
    const base = await mainCommit(repo, hooks);
    const bytes = await atBase(repo, base, path, hooks);
    if (bytes === null) return { base, text: null };
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new ProposalError("NOT_UTF8", `${path} on main is not valid UTF-8 -- a proposal edits text, and a lossy read would rewrite bytes nobody chose`); }
    return { base, text };
  });
}

/**
 * A path main already holds under another CASE, or null. `initiatives/absorb/evidence/Casey.md` beside main's
 * `casey.md` made a branch holding both, which a Windows or macOS checkout cannot: one file kept, the other shown as
 * modified (PR 3b shell attack). Walked one directory at a time from the root, so only the directories a path passes
 * through are listed.
 * @param {string} repo @param {string} base @param {readonly string[]} paths
 */
async function caseClash(repo, base, paths, hooks) {
  for (const path of paths) {
    const segs = path.split("/");
    let prefix = "";
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const last = i === segs.length - 1;
      const tree = prefix === "" ? base : `${base}:${prefix}`;
      // "<mode> <type> <sha>\t<name>", NUL-terminated and never quoted.
      const rows = (await git(repo, ["ls-tree", "-z", tree], { hooks })).out.split("\u0000").filter(Boolean)
        .map((r) => { const t = r.indexOf("\t"); const [mode, type] = r.slice(0, t).split(" "); return { mode, type, name: r.slice(t + 1) }; });
      const here = (n) => (prefix === "" ? n : `${prefix}/${n}`);
      const exact = rows.find((r) => r.name === seg);
      if (exact) {
        // A file where the path needs a directory, or a directory where it writes a file: no tree holds both.
        if ((last && exact.type === "tree") || (!last && exact.type !== "tree")) return { path, theirs: here(seg), kind: "type" };
        // A symlink or a gitlink on main is not a file a proposal edits: the plan showed a text edit while the branch
        // turned a link into a file (PR 3b round-2 shell attack: `120000 -> 100644`, no mode line in the plan).
        if (last && exact.mode !== "100644" && exact.mode !== "100755") return { path, theirs: here(seg), kind: "mode", mode: exact.mode };
        prefix = here(seg);
        continue;
      }
      const other = rows.find((r) => r.name.toLowerCase() === seg.toLowerCase());
      if (other) return { path, theirs: here(other.name), kind: "case" };
      break;
    }
  }
  return null;
}

/** @param {string} repo @param {string} base @param {readonly string[]} paths */
async function refuseCaseClash(repo, base, paths, hooks) {
  const c = await caseClash(repo, base, paths, hooks);
  if (c && c.kind === "case") throw new ProposalError("CASE_CLASH", `${c.path} differs from main's ${c.theirs} only by case -- a Windows or macOS checkout cannot hold both; nothing was written`);
  if (c && c.kind === "mode") throw new ProposalError("BAD_PATH", `${c.path} is a ${c.mode === "120000" ? "symbolic link" : c.mode === "160000" ? "submodule" : `mode-${c.mode} entry`} on main, not a file -- a proposal edits files; nothing was written`);
  if (c) throw new ProposalError("BAD_PATH", `${c.path} needs ${c.theirs} to be ${c.theirs === c.path ? "a file" : "a directory"}, and on main it is not -- nothing was written`);
}

/**
 * The OPEN proposal branches under a prefix that already hold a path: another proposal of the same file, not merged yet.
 * A second trial into one bundle planned cleanly while the first one's branch still held it, and merging both is a
 * conflict over a commitment somebody is judging against (PR 3b round-2 logic attack).
 * @param {{ repo: string, prefix: string, path: string }} o @returns {Promise<string[]>}
 */
export function openProposalsHolding({ repo, prefix, path }) {
  if (typeof prefix !== "string" || !/^feat\/face-[abcdefghijklmnopqrstuvwxyz0123456789-]+$/.test(prefix)) throw new ProposalError("BAD_BRANCH", `${JSON.stringify(prefix)} is not a proposal branch prefix`);
  checkFiles([{ path, content: "" }], [path]);
  return withHooks(repo, async (hooks) => {
    // Local AND remote-tracking branches, matched without case: a branch pushed and then deleted locally, or a bundle
    // named RACE1 beside race1, was invisible to an exact, local-only look (PR 3b round-3 logic attack).
    const listed = (await git(repo, ["for-each-ref", "--format=%(refname)", "refs/heads/", "refs/remotes/"], { hooks })).out.split(/\r?\n/).filter(Boolean);
    // A remote's NAME may hold a slash ("up/stream"): cutting at the first one missed every branch under it (PR 3b
    // round-4 logic attack). The configured names, longest first, say where the branch begins.
    const remotes = (await git(repo, ["remote"], { hooks })).out.split(/\r?\n/).filter(Boolean).sort((x, y) => y.length - x.length);
    const want = path.toLowerCase();
    /** @type {Set<string>} */
    const out = new Set();
    for (const ref of listed) {
      let name;
      let shown;
      if (ref.startsWith("refs/heads/")) { name = ref.slice("refs/heads/".length); shown = name; }
      else {
        const rest = ref.slice("refs/remotes/".length);
        const remote = remotes.find((r) => rest.startsWith(`${r}/`));
        // A tracking ref no configured remote names any more is still a branch someone pushed: it begins at the prefix.
        const at = remote ? remote.length + 1 : rest.toLowerCase().indexOf(prefix);
        if (at < 0) continue;
        name = rest.slice(at);
        // Named as git names it -- "<remote>/<branch>" -- so the advice to delete it can be followed as written: a bare
        // branch name sent the owner to `git branch -D`, which answered "not found" (PR 3b round-4 logic attack).
        shown = rest;
      }
      if (!name.toLowerCase().startsWith(prefix)) continue;
      // The whole tree's names, compared without case: a pathspec is matched exactly. A failure here is git's own error,
      // never read as "not held".
      const names = (await git(repo, ["ls-tree", "-r", "--name-only", "-z", ref], { hooks })).out.split("\u0000");
      if (names.some((n) => n.toLowerCase() === want)) out.add(shown);
    }
    return [...out].sort();
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
  checkTemp();
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
 * Whether a proposal COULD be written -- the branch name, the paths, the base, the branch free -- for a tool whose
 * content does not exist until apply (a seal's commitment is drawn at random when it seals). Writes nothing.
 * @param {{ repo: string, branch: string, paths: readonly string[], allow: readonly string[], base?: string }} o
 * @returns {Promise<{ branch: string, base: string }>}
 */
export async function checkProposal({ repo, branch, paths, allow, base: expected }) {
  checkBranch(branch);
  const checked = checkFiles((paths || []).map((p) => ({ path: p, content: "" })), allow);
  checkTemp();
  return withHooks(repo, async (hooks) => {
    const base = await baseOf(repo, branch, hooks, expected);
    await refuseCaseClash(repo, base, checked.map((c) => c.path), hooks);
    return { branch, base };
  });
}

/**
 * The plan: what the branch would hold, as a diff against the base. Writes nothing -- no object, no ref, no index.
 * @param {{ repo: string, branch: string, files: unknown, allow: readonly string[], base?: string }} o
 * @returns {Promise<{ branch: string, base: string, diff: string }>}
 */
export async function planProposal({ repo, branch, files, allow, base: expected }) {
  checkBranch(branch);
  const checked = checkFiles(files, allow);
  checkTemp();
  return withHooks(repo, async (hooks) => {
    const base = await baseOf(repo, branch, hooks, expected);
    await refuseCaseClash(repo, base, checked.map((c) => c.path), hooks);
    return { branch, base, diff: await diffOf(repo, base, checked, hooks) };
  });
}

/**
 * The apply: the branch, written by plumbing. Returns the commit and the diff it carries.
 *
 * `beforeRef(commit)`, when given, runs once the commit exists and BEFORE the ref does: a caller judges the receipt it
 * will raise -- the real one, with this commit in it -- and a throw there writes no branch (the objects are unreachable,
 * and gc removes them). A dry-run judged a zero commit, and a real one could sort beside a caller's string into a
 * "key" the spine refused, after the branch was written (PR 3b attacks).
 * @param {{ repo: string, branch: string, files: unknown, allow: readonly string[], message: string, base?: string, beforeRef?: (commit: string) => Promise<void> | void }} o
 * @returns {Promise<{ branch: string, base: string, commit: string, diff: string }>}
 */
export async function writeProposal({ repo, branch, files, allow, message, base: expected, beforeRef }) {
  checkBranch(branch);
  const checked = checkFiles(files, allow);
  if (typeof message !== "string" || message.trim() === "" || message.includes("\u0000"))
    throw new ProposalError("BAD_MESSAGE", "a proposal commit carries a message");
  checkTemp();
  return withHooks(repo, async (hooks) => {
    const base = await baseOf(repo, branch, hooks, expected);
    await refuseCaseClash(repo, base, checked.map((c) => c.path), hooks);
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
      // A NONCE per call, as a trailer: two writers of one plan in one second computed ONE commit, and the update-ref
      // catch below told each of them the branch was theirs -- three approvals for one branch (PR 3b round-2 shell
      // attack). With the nonce only the writer whose commit the branch holds can claim it.
      const body = message.endsWith("\n") ? message : message + "\n";
      const commit = (await git(repo, ["commit-tree", tree, "-p", base, "-F", "-"], { hooks, input: `${body}\nProposal-Nonce: ${randomBytes(8).toString("hex")}\n` })).out.trim();
      if (beforeRef) await beforeRef(commit);
      // `create` refuses a ref that exists, inside git's own transaction: the check in baseOf is the friendly refusal,
      // this is the one a race cannot get past. Its failure is named by its real cause -- a stale .lock file or a
      // branch directory is not "appeared while the proposal was written" (PR 3a shell attack).
      try { await git(repo, ["update-ref", "--stdin"], { hooks, input: `create refs/heads/${branch} ${commit}\n` }); }
      catch (e) {
        // The ref may be OURS: git committed the transaction and then the call failed -- a timeout, a hook after
        // "committed". Reporting that as "someone else's branch appeared" made propose exit 2 over a branch it had
        // written, raise no approval, and refuse every retry (PR 3a round-2 shell attack).
        const now = await git(repo, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}^{commit}`], { hooks, ok: [0, 1] }).catch(() => null);
        if (now && now.status === 0 && now.out.trim() === commit) return { branch, base, commit, diff };
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

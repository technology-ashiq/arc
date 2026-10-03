// narrative-proof.mjs -- everything the narrative gate does that needs a process, the spine or the main clone (ADR-1514 amendment 1).
//
// narrative-anchors.mjs lives under .claude/scripts/docs/, where DOC-A (ADR-1501, tests/docs/no-walker.mjs) forbids a child
// process: a spawned process can list files for us. So every spawn, every spine read and every look at the main clone is here,
// and the gate imports this file with a dynamic import() only on the paths that need it (the tracked list, --request-accept,
// --accept). Nothing here lists a directory.
//
// Exports: gitEnv, gitTrackedList, explainGitFailure, mainCloneInfo, mainCloneOf, spineEnvProblem, ownerSpine, readSpineEvents, requestAcceptApproval, ownerSigProblem, verifyAcceptApproval, ownerKeyBaseState, proofArms.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, scryptSync, sign as cryptoSign } from "node:crypto";
import { fingerprint, ownerMessage, readOwnerPubFile, sigsShapeProblem, verifyOwnerSig } from "./owner-sig.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HQ = join(HERE, "..");
const CORE = join(HERE, "..", "..", "core");

/**
 * The environment every git child here gets: the caller's, minus git's location variables (a pre-push hook exports GIT_DIR and
 * GIT_INDEX_FILE, and `git ls-files` then lists ANOTHER repo's index -- attack B2, the twin of face reads.mjs childEnv), and
 * with optional locks off so a read never takes the index lock. Names compared upper-cased: Windows reads them case-blind, so
 * an inherited `Path` and an added `PATH` are ONE variable there and two here (attack r1 B4): every inherited name that an
 * `extra` name shadows, in any case, is dropped before the extra is set, so exactly one survives on every platform.
 * @param {Record<string, string>} [extra] set after the strip (a test names its own ceiling) @returns {NodeJS.ProcessEnv}
 */
export function gitEnv(extra = {}) {
  // Location variables, the object store and its alternates, every config-injection variable, the namespace, and replace/graft
  // variables: each can make a git read answer from somewhere or something other than the tree it was asked about (attack r2 B5).
  const DROP = new Set(["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_CEILING_DIRECTORIES", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_NAMESPACE"]);
  const dropped = (/** @type {string} */ k) => DROP.has(k) || /^GIT_(CONFIG|REPLACE|GRAFT)/.test(k);
  // The two names this function sets itself are case-folded like an extra, so a lower-case inherited copy cannot survive beside them.
  const shadowed = new Set([...Object.keys(extra).map((k) => k.toUpperCase()), "GIT_OPTIONAL_LOCKS", "GIT_NO_REPLACE_OBJECTS"]);
  /** @type {NodeJS.ProcessEnv} */ const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!dropped(k.toUpperCase()) && !shadowed.has(k.toUpperCase())) env[k] = v;
  return { ...env, ...extra, GIT_OPTIONAL_LOCKS: "0", GIT_NO_REPLACE_OBJECTS: "1" };
}

/**
 * Every git-tracked path, from ONE bounded `git ls-files -z` (attack b8707be B5): a gitignored file that exists on this
 * box is absent from a clean checkout, so disk presence is not the CI verdict. Refuses, loudly, when git cannot answer.
 * @param {string} root @param {Record<string, string>} [extraEnv] @returns {Set<string>}
 */
export function gitTrackedList(root, extraEnv = {}) {
  try {
    const out = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000, stdio: ["ignore", "pipe", "pipe"], env: gitEnv(extraEnv) });
    return new Set(out.split("\0").filter(Boolean));
  } catch (e) {
    throw new Error(`git ls-files failed in ${root} (${String(/** @type {Error} */ (e).message).split("\n")[0]}); the drift check judges paths against the git-tracked list and will not guess`);
  }
}

/**
 * The main clone, from git's common dir the way spine-io's assertNotLinkedWorktree finds it: in a linked worktree the common
 * dir's parent IS the main clone, and in the main clone itself it is the clone. That holds only when the git dir is named .git
 * (attack B3: --separate-git-dir puts it elsewhere, and `git worktree list` then names the git dir itself), so any other
 * layout is refused by name rather than guessed at. "" when git cannot say or the layout is not the default.
 * @param {string} cwd
 */
export function mainCloneOf(cwd) { return mainCloneInfo(cwd).main; }

/**
 * Why a git child failed, in the name of the real cause (attack r2 B6): git itself could not run (missing, or an option this
 * git does not know, such as --path-format before 2.31), or the directory is not a git checkout. One line.
 * @param {any} e the error execFileSync threw
 * @returns {{ kind: "no-git" | "not-a-checkout" | "git-failed", why: string }}
 */
export function explainGitFailure(e) {
  const err = String(e && e.stderr ? e.stderr : "").split("\n").map((l) => l.trim()).find(Boolean) || "";
  if (e && (e.code === "ENOENT" || e.code === "EACCES")) return { kind: "no-git", why: `git could not run (${String(e.code)}: is git installed and on PATH?)` };
  if (/not a git repository/i.test(err)) return { kind: "not-a-checkout", why: "this directory is not a git checkout" };
  if (e && e.killed) return { kind: "git-failed", why: "git timed out" };
  return { kind: "git-failed", why: `git could not answer (${err || String(e && e.message || e).split("\n")[0]}); an old git that does not know --path-format shows up here` };
}

/**
 * mainCloneOf with the reason: { main, why }, exactly one of them non-empty. `extraEnv` lets a test name its own git ceiling or PATH.
 * @param {string} cwd @param {Record<string, string>} [extraEnv] @returns {{ main: string, why: string }}
 */
export function mainCloneInfo(cwd, extraEnv = {}) {
  let common = "";
  try {
    common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: gitEnv(extraEnv), timeout: 30000 }).trim();
  } catch (e) { return { main: "", why: explainGitFailure(e).why }; }
  if (!common) return { main: "", why: "git named no common dir" };
  if (basename(common) !== ".git") return { main: "", why: `the git dir is ${JSON.stringify(basename(common))}, not named .git (a --separate-git-dir clone or a bare repo is refused, not guessed at)` };
  return { main: dirname(common), why: "" };
}

/**
 * Two paths that name one place: real paths with 8.3 short names expanded, one slash style, and the case ignored where the
 * file system ignores it (Windows). git prints the common dir in a spelling that resolve() does not (CI Windows leg).
 * @param {string} a @param {string} b
 */
export function samePlace(a, b) {
  const norm = (/** @type {string} */ p) => { const n = realpathSync.native(p).replace(/\\/g, "/").replace(/\/+$/, ""); return process.platform === "win32" ? n.toLowerCase() : n; };
  try { return norm(a) === norm(b); } catch { return false; }
}

/**
 * Why the environment cannot be trusted to name the owner's spine, or "" (attack B1): ARC_SPINE_ROOT read from the caller lets
 * an agent build a spine it controls, request and approve inside it, and accept as the owner. The production paths refuse the
 * variable by NAME, set or empty, the way the bench ceilings refuse theirs; the self-test hands its spine in as an option.
 */
export function spineEnvProblem() {
  return "ARC_SPINE_ROOT" in process.env ? "ARC_SPINE_ROOT is set; the owner's spine is always the main clone's, so this refuses it (unset it)" : "";
}

/**
 * Where the owner's spine is, and which arc-event writes to it. A linked worktree refuses the spine (WORKTREE_SPINE) and the
 * canonical spine is in the main clone, so both the read and the request go there, always. The environment never names it
 * (spineEnvProblem); only the self-test's injected opts.spineRoot does, and no command line can reach that.
 * @param {string} root the tree this ran against @param {{ spineRoot?: string, gitEnv?: Record<string, string> }} [opts] gitEnv is a test's own ceiling or PATH
 * @returns {{ spine: string, arcEvent: string, cwd: string, main: string, why: string }}
 */
export function ownerSpine(root, opts = {}) {
  const none = { spine: "", arcEvent: "", cwd: "", main: "", why: "" };
  if (typeof opts.spineRoot === "string" && opts.spineRoot !== "") return { spine: resolve(opts.spineRoot), arcEvent: join(HQ, "arc-event.mjs"), cwd: root, main: "", why: "" };
  const env = spineEnvProblem();
  if (env) return { ...none, why: env };
  const info = mainCloneInfo(root, opts.gitEnv);
  const main = info.main;
  if (!main) return { ...none, why: `the owner's spine cannot be found: ${info.why}` };
  const arcEvent = join(main, ".claude", "scripts", "hq", "arc-event.mjs");
  if (!existsSync(arcEvent)) return { ...none, why: `the main clone ${main} has no arc-event; pull it first` };
  return { spine: join(main, ".claude", "state", "hq"), arcEvent, cwd: main, main, why: "" };
}

/**
 * Every event on the spine, read-only, through the door (spine.mjs `query`). Never throws: a spine that cannot be read is a
 * reason to refuse, and the events it could not show cannot have forged an approval.
 * @param {string} spine @returns {Promise<{ events: any[], why: string }>}
 */
export async function readSpineEvents(spine) {
  if (!spine || !existsSync(join(spine, "events"))) return { events: [], why: "the owner's spine has no events folder, so no approval can be found" };
  try {
    const { query } = await import(pathToFileURL(join(HQ, "spine.mjs")).href);
    const r = await query(spine, { engine: "scan" });
    return { events: r.events.map((/** @type {any} */ x) => x.event), why: "" };
  } catch (e) { return { events: [], why: `the spine could not be read (${e && /** @type {any} */ (e).code ? /** @type {any} */ (e).code : "error"})` }; }
}

/**
 * Raise the approval.requested for a payload the gate built, through the owner's arc-event (the main clone's, run from there).
 * @param {any} payload the approval.requested payload (requestPayload's) @param {{ root: string, spineRoot?: string }} opts
 * @returns {Promise<{ id: string, main: string, why: string }>}
 */
export async function requestAcceptApproval(payload, opts) {
  const os = ownerSpine(opts.root, opts);
  if (os.why) return { id: "", main: "", why: os.why };
  const { emitReceipt } = await import(pathToFileURL(join(CORE, "plan-expect.mjs")).href);
  const r = emitReceipt(os.arcEvent, "approval.requested", payload, { cwd: os.cwd, env: { ...gitEnv(), ...(os.main ? {} : { ARC_SPINE_ROOT: os.spine }) }, timeoutMs: 60_000 });
  if (r.state !== "landed") return { id: "", main: os.main, why: `the spine ${r.state === "refused" ? "refused" : "may or may not have taken"} the request: ${r.why}` };
  if (!r.id) return { id: "", main: os.main, why: String(r.why) };
  return { id: r.id, main: os.main, why: "" };
}

/**
 * Why the owner's approve decision for `ulid` is not a signed acceptance of THIS page at THIS text, or "" with the signature
 * (ADR-1514 amendment 2). Refuses, in its own sentence, for: no public key file, no `sigs` on the decision, sigs that cover
 * other pages, and a signature that does not verify over (approval, page, hash) with the committed key.
 * @param {any[]} events the spine's events @param {string} ulid @param {string} page @param {string} sha256 @param {string} pubPath the committed public key (injected)
 * @returns {{ why: string, sig: string }}
 */
export function ownerSigProblem(events, ulid, page, sha256, pubPath) {
  const no = (/** @type {string} */ why) => ({ why, sig: "" });
  const got = readOwnerPubFile(pubPath), pub = got.pem;
  if (pub === "") return no(`the owner's public key file (.claude/owner-key.pub) ${got.why || "is missing"}, so no signature can be checked; the owner runs arc-inbox owner-key init and commits it (the public key file is a regular file inside the tree, never a link)`);
  const dec = (Array.isArray(events) ? events : []).find((e) => e && e.kind === "decision.recorded" && e.payload && e.payload.decides === ulid && e.payload.verdict === "approve");
  const sigs = dec && dec.payload && typeof dec.payload.sigs === "object" && dec.payload.sigs !== null ? dec.payload.sigs : null;
  if (!sigs) return no(`${ulid} was approved with no signature: an approval the owner did not sign at a terminal with his key is not a proof; he approves it again with arc-inbox approve`);
  if (!Object.prototype.hasOwnProperty.call(sigs, page)) return no(`the owner's signatures on ${ulid} cover other pages, not ${page}`);
  const sig = String(sigs[page]);
  if (!verifyOwnerSig(pub, ownerMessage(ulid, page, sha256), sig)) return no(`the signature for ${page} on ${ulid} does not verify against .claude/owner-key.pub over this page, its text and this approval (another key, another text, or another approval)`);
  return { why: "", sig };
}

/**
 * Why `ulid` is not the owner's decided AND signed approval for this page at this text, or "" with the page's signature. The
 * spine judgement is the gate's own pure approvalProblem, handed in as opts.judge so the rule has one home.
 * @param {{ ulid: string, page: string, sha256: string, opts: { root: string, spineRoot?: string, pubPath: string, judge: (events: any[], approval: unknown, page: string, hash: string) => string } }} a
 * @returns {Promise<{ why: string, sig: string }>}
 */
export async function verifyAcceptApproval({ ulid, page, sha256, opts }) {
  const os = ownerSpine(opts.root, opts);
  if (os.why) return { why: os.why, sig: "" };
  const sp = await readSpineEvents(os.spine);
  if (sp.why) return { why: sp.why, sig: "" };
  const judged = opts.judge(sp.events, ulid, page, sha256);
  if (judged) return { why: judged, sig: "" };
  return ownerSigProblem(sp.events, ulid, page, sha256, opts.pubPath);
}

/**
 * Whether the tree's public key is the one the base ref has (ADR-1514 amendment 2, "Correction"). A swapped key is the one
 * thing signatures cannot stop on a same-user box, so the gate makes it loud: state "changed" is a WARN. That covers a key that
 * differs, a key that is DELETED from the tree while the base has it, and a key that comes back after the base's history removed
 * it (attack r2 B1: delete in one change, add the agent's own in the next). A base that never had the file is the first-time
 * bootstrap and is allowed; a missing base ref or git is "unavailable" with one line, never a throw; a tree with no key file and
 * no base to compare is "no-key".
 * The base is read by full ref name (attack r2 B2): an unqualified name is resolved by git through refs/<name>, tags, heads and
 * remotes, so a local tag or branch named `origin/main` would stand in for the real one. The default is refs/remotes/origin/main,
 * a short name must name exactly one ref, and one that names two is refused by name. Every read runs with replace refs off
 * (attack r2 B5) and against the resolved commit sha, never the name again.
 * @param {string} root @param {{ baseRef?: string, extraEnv?: Record<string, string> }} [opts]
 * @returns {{ state: "no-key" | "same" | "changed" | "bootstrap" | "unavailable", why: string, base: string, was: string, now: string }}
 */
export function ownerKeyBaseState(root, opts = {}) {
  const base = opts.baseRef || "refs/remotes/origin/main", rel = ".claude/owner-key.pub";
  const out = (/** @type {any} */ state, why = "", was = "", now = "") => ({ state, why, base, was, now });
  // The same reader as --accept and the gate (attack r1 B3): a link, a directory or an oversize file is not "the key".
  const got = readOwnerPubFile(join(root, rel));
  if (got.pem === "" && !got.missing) return out("unavailable", `${rel} ${got.why}, so it could not be compared with ${base}`);
  const gone = got.missing, cur = got.pem;
  // With no key in the tree there is nothing to compare unless the base or its history had one: every failure to find out is "no-key".
  const cannot = (/** @type {string} */ why) => (gone ? out("no-key") : out("unavailable", why));
  // A ref that is not a plain ref name is refused, never handed to git as an option (a leading dash is an option).
  if (!/^[A-Za-z0-9_][A-Za-z0-9._/@~^-]{0,99}$/.test(base)) return cannot(`the base ref ${JSON.stringify(base.slice(0, 40))} is not a plain ref name, so the owner key could not be compared with it`);
  const git = (/** @type {string[]} */ args) => execFileSync("git", ["--no-replace-objects", "-C", root, ...args], { encoding: "utf8", env: gitEnv(opts.extraEnv), timeout: 30000, stdio: ["ignore", "pipe", "pipe"] });
  const norm = (/** @type {string} */ t) => t.replace(/\r\n/g, "\n").trim();
  const fp = (/** @type {string} */ t) => { try { return fingerprint(t); } catch { return "unreadable"; } };
  const why = (/** @type {unknown} */ e) => `${explainGitFailure(e).why}, so the owner key could not be compared with ${base}`;
  /** @param {string} full */
  const exists = (full) => { try { git(["show-ref", "--verify", "--quiet", full]); return true; } catch (e) { if (e && /** @type {any} */ (e).status === 1) return false; throw e; } };
  /** @type {string} */ let target = base, sha = "";
  try {
    const shadows = [`refs/${base}`, `refs/tags/${base}`, `refs/heads/${base}`, `refs/remotes/${base}`].filter(exists);
    const literal = base.startsWith("refs/") || base === "HEAD" || /^[0-9a-f]{40,64}$/.test(base);
    if (literal ? shadows.length > 0 : shadows.length > 1) return cannot(`the base ref name ${base} is ambiguous (it names ${shadows.join(" and ")}); a local branch or tag can stand in for the real base, so pass the full name, for example refs/remotes/origin/main`);
    if (!literal) { if (shadows.length === 0) return cannot(`the base ref ${base} does not exist here (a shallow CI checkout has none: fetch it, or pass --base <sha>), so the owner key could not be compared with it`); target = shadows[0]; }
  } catch (e) { return cannot(why(e)); }
  try { sha = git(["rev-parse", "--verify", "--quiet", "--end-of-options", `${target}^{commit}`]).trim(); }
  catch (e) {
    const err = /** @type {any} */ (e);
    if (err && err.status === 1 && !err.stderr?.toString().trim()) return cannot(`the base ref ${base} does not exist here (a shallow CI checkout has none: fetch it, or pass --base <sha>), or is not a commit, so the owner key could not be compared with it`);
    return cannot(why(e));
  }
  if (!/^[0-9a-f]{40,64}$/.test(sha)) return cannot(`git named no commit for the base ref ${base}, so the owner key could not be compared with it`);
  // Compared with where this branch left the base (the merge-base), not the base's tip: a base that moved on and changed the key
  // is not this branch's swap, and a branch that changed it is one whatever the tip says. A history too shallow to name a
  // merge-base falls back to the tip, which is the older, coarser comparison.
  let at = sha;
  try { const mb = git(["merge-base", sha, "HEAD"]).trim(); if (/^[0-9a-f]{40,64}$/.test(mb)) at = mb; } catch { at = sha; }
  let listed = "";
  try { listed = git(["ls-tree", "--name-only", at, "--", rel]).trim(); }
  catch (e) { return cannot(why(e)); }
  /** Whether the base's history ever held the file: a key removed and later re-added is a swap in two quiet steps. */
  const everHad = () => { try { return git(["log", "-n", "1", "--format=%H", at, "--", rel]).trim() !== ""; } catch { return false; } };
  if (listed === "") {
    if (gone) return out("no-key");
    return everHad() ? out("changed", "", "removed-earlier", fp(cur)) : out("bootstrap", "", "", fp(cur));
  }
  let then = "";
  try { then = git(["show", `${at}:${rel}`]); }
  catch (e) { return cannot(why(e)); }
  if (gone) return out("changed", "", fp(then), "deleted");
  return norm(then) === norm(cur) ? out("same", "", fp(then), fp(cur)) : out("changed", "", fp(then), fp(cur));
}

/**
 * The self-test arms that need a process, the spine or a git repository, run against the REAL functions above and the gate's
 * own, handed in. Returns [name, ok] pairs; the caller counts and prints them like its own arms.
 * @param {any} d the gate's pure pieces and fixtures: good, wiki, ACCEPT_GATE, sha256, requestPayload, approvalProblem, evaluate,
 *   trackedIn, isTopDir, acceptEntry, sigsOf, ownerKeyFinding, OWNER_PUB, script (the gate's own path)
 * @returns {Promise<[string, boolean, boolean?][]>} [name, ok] pairs; a third element true is a NAMED SKIP (an arm the platform cannot run, never a pass)
 */
export async function proofArms(d) {
  /** @type {[string, boolean, boolean?][]} */ const out = [];
  const has = (/** @type {{ fails: string[] }} */ r, /** @type {string} */ tag) => r.fails.some((f) => f.startsWith(tag));
  const { good, wiki, ACCEPT_GATE, sha256, requestPayload, approvalProblem, evaluate, trackedIn, isTopDir } = d;
  const HG = sha256(good);
  // ADR-1514 amendment 2: one real sealed key in a temp dir, made through the real initOwnerKey with the terminal and the prompt injected.
  const OK = await import(pathToFileURL(join(HERE, "owner-key.mjs")).href);
  const OSg = await import(pathToFileURL(join(HERE, "owner-sig.mjs")).href);
  const inboxMod = await import(pathToFileURL(join(HQ, "arc-inbox.mjs")).href);
  const { decide } = inboxMod;
  const { assertDecision } = await import(pathToFileURL(join(HQ, "lib", "validate.mjs")).href);
  const typed = (/** @type {string[]} */ ...answers) => { const q = [...answers]; return async () => String(q.shift() ?? ""); };
  const PASS = "correct horse battery staple";
  const keyBox = mkdtempSync(join(tmpdir(), "narr-key-"));
  const keyDir = join(keyBox, "home", ".arc-private", "owner"), pubPath = join(keyBox, "repo", ".claude", "owner-key.pub");
  const initArgs = { keyDir, pubPath, readPassphrase: typed(PASS, PASS), isTty: () => true };
  const refusedNoTty = await OK.initOwnerKey({ ...initArgs, isTty: false });
  const refusedMismatch = await OK.initOwnerKey({ ...initArgs, readPassphrase: typed(PASS, `${PASS}x`) });
  const refusedShort = await OK.initOwnerKey({ ...initArgs, readPassphrase: typed("short", "short") });
  const nothingYet = !existsSync(join(keyDir, OK.KEY_FILE)) && !existsSync(pubPath);
  const made = await OK.initOwnerKey(initArgs);
  const sealed = made.ok ? readFileSync(join(keyDir, OK.KEY_FILE), "utf8") : "", pubPem = made.ok ? readFileSync(pubPath, "utf8") : "";
  const again = await OK.initOwnerKey({ ...initArgs, readPassphrase: typed("another passphrase here", "another passphrase here") });
  out.push(["MUTANT A1 init refusals: without a terminal on both ends, with two different passphrases and with a short one, owner-key init refuses in one sentence and writes no key and no public file",
    !refusedNoTty.ok && refusedNoTty.why.includes("real terminal") && !refusedMismatch.ok && refusedMismatch.why.includes("differ") && !refusedShort.ok && refusedShort.why.includes("at least") && nothingYet
    && [refusedNoTty, refusedMismatch, refusedShort].every((r) => !r.why.includes("\n"))]);
  out.push(["MUTANT A1 init: with a terminal it writes a scrypt-sealed private key file outside the repo and the SPKI public key at the repo path, prints a 16-hex fingerprint of the public DER, and refuses to overwrite (naming a deliberate delete) leaving the key as it was",
    made.ok && made.keyPath === join(keyDir, OK.KEY_FILE) && JSON.parse(sealed).kdf === "scrypt" && pubPem.includes("BEGIN PUBLIC KEY") && /^[0-9a-f]{16}$/.test(made.fingerprint)
    && made.fingerprint === createHash("sha256").update(createPublicKey(pubPem).export({ type: "spki", format: "der" })).digest("hex").slice(0, 16)
    && !again.ok && again.why.includes("delete it deliberately") && readFileSync(join(keyDir, OK.KEY_FILE), "utf8") === sealed && readFileSync(pubPath, "utf8") === pubPem
    && OK.ownerKeyDir("/h").replace(/\\/g, "/") === "/h/.arc-private/owner" && OK.ownerPubPath("/r").replace(/\\/g, "/") === "/r/.claude/owner-key.pub"]);
  const signer = { keyDir, readPassphrase: typed(PASS), isTty: () => true };
  // B5: a gitignored file that exists on this box is not in the tracked list, so it FAILs; a tracked one passes.
  const box = mkdtempSync(join(tmpdir(), "narr-r2-"));
  const bare = mkdtempSync(join(tmpdir(), "narr-nogit-"));
  const genv = gitEnv();
  try {
    mkdirSync(join(box, "docs"), { recursive: true });
    const boxReal = realpathSync(box);
    execFileSync("git", ["init", "-q"], { cwd: box, env: genv });
    writeFileSync(join(box, ".gitignore"), "docs/ignored.md\n");
    writeFileSync(join(box, "docs", "kept.md"), "x");
    writeFileSync(join(box, "docs", "ignored.md"), "x");
    execFileSync("git", ["add", ".gitignore", "docs/kept.md"], { cwd: box, env: genv });
    const list = gitTrackedList(box);
    const gtree = { adrs: new Set(), wiki, tracked: trackedIn(list, box, boxReal), read: () => "", isDir: (/** @type {string} */ s) => isTopDir(box, s) };
    const grun = (/** @type {string} */ text) => evaluate({ narratives: { "products/hq": text }, accepted: {}, proofs: {}, tree: gtree });
    out.push(["MUTANT B5 tracked: a gitignored file present on disk FAILs the drift check; a git-tracked one passes",
      existsSync(join(box, "docs", "ignored.md")) && list.has("docs/kept.md") && !list.has("docs/ignored.md")
      && has(grun("It keeps `docs/ignored.md` here.\n"), "[drift]") && !has(grun("It keeps `docs/kept.md` here.\n"), "[drift]")]);
    let refusal = "";
    try { gitTrackedList(bare, { GIT_CEILING_DIRECTORIES: dirname(bare) }); } catch (e) { refusal = /** @type {Error} */ (e).message; }
    out.push(["MUTANT B5 no git: a directory git cannot list is refused with a message naming git ls-files, never a silent pass",
      refusal.includes("git ls-files") && refusal.includes("will not guess")]);
  } finally {
    rmSync(box, { recursive: true, force: true });
    rmSync(bare, { recursive: true, force: true });
  }
  const spine = mkdtempSync(join(tmpdir(), "narr-spine-"));
  const priorSpine = process.env.ARC_SPINE_ROOT;
  try {
    mkdirSync(join(spine, "events"));
    delete process.env.ARC_SPINE_ROOT;
    // The owner's decision, through the real decide with the terminal and the sealed key injected (a spawned arc-inbox has no terminal here, and refuses by design).
    const inbox = async (/** @type {string} */ verb, /** @type {string} */ id) => {
      const prev = process.env.ARC_SPINE_ROOT;
      process.env.ARC_SPINE_ROOT = spine;
      try { await decide(spine, verb, id, "read it", { keyDir, readPassphrase: typed(PASS), isTty: () => true }); return 0; } catch { return 1; }
      finally { if (prev === undefined) delete process.env.ARC_SPINE_ROOT; else process.env.ARC_SPINE_ROOT = prev; }
    };
    const asked = requestPayload(["products/hq", "lanes/x"], { "products/hq": good, "lanes/x": `${good}\nlane\n` });
    const got = await requestAcceptApproval(asked.payload, { root: spine, spineRoot: spine });
    const read0 = await readSpineEvents(spine);
    const undecided = approvalProblem(read0.events, got.id, "products/hq", HG);
    const ap = await inbox("approve", got.id);
    const read1 = await readSpineEvents(spine);
    const approved = approvalProblem(read1.events, got.id, "products/hq", HG);
    const second = approvalProblem(read1.events, got.id, "lanes/x", sha256(`${good}\nlane\n`));
    const afterEdit = approvalProblem(read1.events, got.id, "products/hq", sha256(`${good}\nedited after approval\n`));
    // The same door the CLI uses: verifyAcceptApproval reads the named spine and judges with the gate's own rule.
    const opts = { root: spine, spineRoot: spine, pubPath, judge: approvalProblem };
    const viaDoor = await verifyAcceptApproval({ ulid: got.id, page: "products/hq", sha256: HG, opts });
    const viaDoorEdited = await verifyAcceptApproval({ ulid: got.id, page: "products/hq", sha256: sha256(`${good}\nedited\n`), opts });
    const got2 = await requestAcceptApproval(requestPayload(["products/hq"], { "products/hq": good }).payload, { root: spine, spineRoot: spine });
    const rj = await inbox("reject", got2.id);
    const rejected = approvalProblem((await readSpineEvents(spine)).events, got2.id, "products/hq", HG);
    out.push(["MUTANT B6 real spine: request -> undecided refused -> arc-inbox approve -> accepted for every listed page -> edit the page -> hash mismatch refused; a rejected request stays refused",
      got.why === "" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(got.id) && undecided.includes("not decided yet") && ap === 0 && approved === "" && second === ""
      && afterEdit.includes("edited after") && viaDoor.why === "" && viaDoor.sig === (read1.events.find((e) => e.kind === "decision.recorded").payload.sigs["products/hq"]) && viaDoorEdited.why.includes("edited after") && got2.why === "" && rj === 0 && rejected.includes("rejected")]);
    const named = ownerSpine("x", { spineRoot: spine }).spine === resolve(spine);
    process.env.ARC_SPINE_ROOT = "";
    const emptyDoor = ownerSpine(spine).why.includes("ARC_SPINE_ROOT") && (await requestAcceptApproval(asked.payload, { root: spine })).why.includes("ARC_SPINE_ROOT");
    out.push(["MUTANT B6 request: an unknown page, a repeat and an empty list are refused before anything is emitted; the injected option names the spine, and an empty ARC_SPINE_ROOT is refused by name",
      requestPayload(["products/nope"], {}).problem !== "" && requestPayload(["products/hq", "products/hq"], { "products/hq": good }).problem !== "" && requestPayload([], {}).problem !== ""
      && asked.payload.gate === ACCEPT_GATE && asked.payload.pages.length === 2 && asked.payload.pages[0].sha256 === HG && named && emptyDoor]);
    // B1: the scratch-spine attack. ARC_SPINE_ROOT names a spine the caller built and approved inside; every production door refuses it.
    process.env.ARC_SPINE_ROOT = spine;
    const envRequest = await requestAcceptApproval(asked.payload, { root: spine });
    const envVerify = (await verifyAcceptApproval({ ulid: got.id, page: "products/hq", sha256: HG, opts: { root: spine, pubPath, judge: approvalProblem } })).why;
    const envOwner = ownerSpine(spine);
    delete process.env.ARC_SPINE_ROOT;
    out.push(["MUTANT B1 env spine: with ARC_SPINE_ROOT set, ownerSpine, the request and the verify each refuse it by name and yield no id and no spine, though an approved request sits in that very spine",
      envRequest.id === "" && envRequest.why.includes("ARC_SPINE_ROOT") && envVerify.includes("ARC_SPINE_ROOT") && envOwner.spine === "" && envOwner.why.includes("ARC_SPINE_ROOT") && approved === ""]);
  } finally {
    if (priorSpine === undefined) delete process.env.ARC_SPINE_ROOT; else process.env.ARC_SPINE_ROOT = priorSpine;
    rmSync(spine, { recursive: true, force: true });
  }
  // ---- ADR-1514 amendment 2 on a second temp spine: the signed approve, its refusals, and the reader that requires the signature.
  const spine2 = mkdtempSync(join(tmpdir(), "narr-spine2-"));
  const homeBox = mkdtempSync(join(tmpdir(), "narr-home-"));
  const prior2 = process.env.ARC_SPINE_ROOT;
  try {
    mkdirSync(join(spine2, "events"));
    process.env.ARC_SPINE_ROOT = spine2;
    const HL = sha256(`${good}\nlane\n`);
    const pagesOf = { "products/hq": good, "lanes/x": `${good}\nlane\n` };
    const ask = async () => (await requestAcceptApproval(requestPayload(["products/hq", "lanes/x"], pagesOf).payload, { root: spine2, spineRoot: spine2 })).id;
    const evs = async () => (await readSpineEvents(spine2)).events;
    const decisionsFor = async (/** @type {string} */ id) => (await evs()).filter((e) => e.kind === "decision.recorded" && e.payload.decides === id);
    const attempt = async (/** @type {string} */ verb, /** @type {string} */ id, /** @type {any} */ sg) => { try { await decide(spine2, verb, id, "read it", sg); return { code: 0, message: "" }; } catch (e) { return { code: 1, message: String(/** @type {Error} */ (e).message) }; } };
    const idA = await ask();
    const noTtyTry = await attempt("approve", idA, { keyDir, readPassphrase: typed(PASS), isTty: false });
    const spawned = spawnSync(process.execPath, [join(HQ, "arc-inbox.mjs"), "approve", idA, "--reason", "read it"], { encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: spine2, HOME: homeBox, USERPROFILE: homeBox } });
    const spawnedInit = spawnSync(process.execPath, [join(HQ, "arc-inbox.mjs"), "owner-key", "init"], { encoding: "utf8", env: { ...process.env, HOME: homeBox, USERPROFILE: homeBox } });
    out.push(["MUTANT A2 no terminal: approving a narrative-accept request without a terminal refuses in one sentence and records nothing -- through decide, through a spawned arc-inbox (exit non-zero) and for owner-key init, and the spawned runs touch no key directory",
      noTtyTry.code === 1 && noTtyTry.message.includes("real terminal") && (await decisionsFor(idA)).length === 0 && spawned.status !== 0 && spawned.stderr.includes("real terminal") && (await decisionsFor(idA)).length === 0
      && spawnedInit.status === 1 && spawnedInit.stderr.includes("real terminal") && !existsSync(join(homeBox, ".arc-private"))]);
    const wrongTry = await attempt("approve", idA, { keyDir, readPassphrase: typed("not the passphrase at all"), isTty: () => true });
    const noKeyTry = await attempt("approve", idA, { keyDir: join(keyBox, "nowhere"), readPassphrase: typed(PASS), isTty: () => true });
    out.push(["MUTANT A2 wrong pass phrase -- one that does not unseal the key refuses in one sentence and writes nothing; so does a missing key file, naming owner-key init",
      wrongTry.code === 1 && wrongTry.message.includes("does not unseal") && !wrongTry.message.includes("\n") && (await decisionsFor(idA)).length === 0 && noKeyTry.code === 1 && noKeyTry.message.includes("owner-key init") && (await decisionsFor(idA)).length === 0]);
    const okTry = await attempt("approve", idA, signer);
    const decA = (await decisionsFor(idA))[0];
    const sigsA = decA ? decA.payload.sigs : null;
    const msgFor = (/** @type {string} */ id, /** @type {string} */ page, /** @type {string} */ hash) => OSg.ownerMessage(id, page, hash);
    out.push(["MUTANT A2 signed approve: with the passphrase, approve writes ONE decision carrying sigs -- one signature per listed page, each verifying with the committed public key over its own approval, page and hash, and none over another page or hash; the decision has exactly decides, reason, verdict, sigs",
      okTry.code === 0 && !!decA && Object.keys(decA.payload).sort().join() === "decides,reason,sigs,verdict" && Object.keys(sigsA).sort().join() === "lanes/x,products/hq" && OSg.sigsShapeProblem(sigsA) === ""
      && OSg.verifyOwnerSig(pubPem, msgFor(idA, "products/hq", HG), sigsA["products/hq"]) && OSg.verifyOwnerSig(pubPem, msgFor(idA, "lanes/x", HL), sigsA["lanes/x"])
      && !OSg.verifyOwnerSig(pubPem, msgFor(idA, "products/hq", HL), sigsA["products/hq"]) && !OSg.verifyOwnerSig(pubPem, msgFor(idA, "lanes/x", HL), sigsA["products/hq"]) && !OSg.verifyOwnerSig(pubPem, msgFor(idA.replace(/.$/, "Z"), "products/hq", HG), sigsA["products/hq"])]);
    // Every other gate, and a reject, behave as before: no key, no terminal, no sigs, the same three keys.
    const noSigner = { keyDir: join(keyBox, "nowhere"), readPassphrase: async () => { throw new Error("must not prompt"); }, isTty: false };
    const other = [];
    const askOther = async (/** @type {string} */ gate) => (await requestAcceptApproval({ what: `a ${gate} decision`, gate }, { root: spine2, spineRoot: spine2 })).id;
    for (const gate of ["kickoff", "phase-done", "concept-define"]) other.push(await askOther(gate));
    const rjNarr = await ask();
    const otherTries = [];
    for (const id of other) otherTries.push(await attempt("approve", id, noSigner));
    const rejTry = await attempt("reject", rjNarr, noSigner);
    const otherDecs = [];
    for (const id of [...other, rjNarr]) otherDecs.push(...(await decisionsFor(id)));
    out.push(["MUTANT A2 other gates: kickoff, phase-done and concept-define approves need no terminal and write exactly {decides, reason, verdict}, and a reject on the narrative-accept gate needs no signature; nothing is prompted",
      otherTries.every((t) => t.code === 0) && rejTry.code === 0 && otherDecs.length === 4 && otherDecs.every((d) => Object.keys(d.payload).sort().join() === "decides,reason,verdict")]);
    /** @param {string} gate */
    // The validator: the ONE new key, closed everywhere else.
    const mk = (/** @type {any} */ payload) => ({ id: "01ARZ3NDEKTSV4RRFFQ69G5FB2", idem: createHash("sha256").update(`decision.recorded|${payload.decides}`).digest("hex"), payload });
    const base = { decides: "01ARZ3NDEKTSV4RRFFQ69G5FAV", verdict: "approve", reason: "r" };
    const throws = (/** @type {any} */ payload) => { try { assertDecision(mk(payload)); return false; } catch (e) { return /** @type {any} */ (e).code === "BAD_DECISION"; } };
    const passes = (/** @type {any} */ payload) => { try { assertDecision(mk(payload)); return true; } catch { return false; } };
    out.push(["MUTANT A3 validator: assertDecision accepts sigs (page -> exact-length base64) beside decides|verdict|reason, and still refuses an unknown key, a short or non-string sig, a non-page key, an empty or array sigs; a decision without sigs passes unchanged",
      passes(base) && passes({ ...base, verdict: "reject" }) && passes({ ...base, sigs: sigsA }) && throws({ ...base, extra: 1 }) && throws({ ...base, sigs: { "products/hq": "abc" } }) && throws({ ...base, sigs: { "products/hq": 7 } })
      && throws({ ...base, sigs: { "not a page": sigsA["products/hq"] } }) && throws({ ...base, sigs: {} }) && throws({ ...base, sigs: [sigsA["products/hq"]] }) && throws({ ...base, sigs: sigsA, other: 1 })]);
    // The reader: verifyAcceptApproval requires the signature. Forged decisions are written the way an agent would, straight through arc-event.
    const ownerPriv = (await OK.unsealOwnerKey({ keyDir, readPassphrase: typed(PASS) })).key;
    const forge = async (/** @type {(id: string) => any} */ make) => {
      const id = await ask();
      const req = (await evs()).find((e) => e.id === id);
      const sigs = make(id);
      const payload = JSON.stringify(sigs === null ? { decides: id, reason: "r", verdict: "approve" } : { decides: id, reason: "r", verdict: "approve", sigs });
      spawnSync(process.execPath, [join(HQ, "arc-event.mjs"), "emit", "decision.recorded", "--payload", payload, "--idem", createHash("sha256").update(`decision.recorded|${id}`).digest("hex"), "--venture", req.venture, "--process", "arc-inbox@1.0.0", "--strict"], { encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: spine2 } });
      return id;
    };
    const kx = generateKeyPairSync("ed25519");
    const signBy = (/** @type {any} */ k, /** @type {string} */ id, /** @type {string} */ page, /** @type {string} */ hash) => cryptoSign(null, Buffer.from(msgFor(id, page, hash), "utf8"), k).toString("base64");
    const o2 = { root: spine2, spineRoot: spine2, pubPath, judge: d.approvalProblem };
    const v = (/** @type {string} */ id, /** @type {string} */ page, /** @type {string} */ hash, /** @type {any} */ o = o2) => verifyAcceptApproval({ ulid: id, page, sha256: hash, opts: o });
    const idNoSig = await forge(() => null);
    const idOther = await forge((id) => ({ "lanes/x": signBy(ownerPriv, id, "lanes/x", HL) }));
    const idBad = await forge((id) => ({ "products/hq": signBy(kx.privateKey, id, "products/hq", HG), "lanes/x": signBy(kx.privateKey, id, "lanes/x", HL) }));
    const idText = await forge((id) => ({ "products/hq": signBy(ownerPriv, id, "products/hq", sha256(`${good}
other
`)), "lanes/x": signBy(ownerPriv, id, "lanes/x", HL) }));
    const good1 = await v(idA, "products/hq", HG);
    const rNoKey = await v(idA, "products/hq", HG, { ...o2, pubPath: join(keyBox, "no", "owner-key.pub") });
    const rNoSig = await v(idNoSig, "products/hq", HG);
    const rOther = await v(idOther, "products/hq", HG);
    const rBad = await v(idBad, "products/hq", HG);
    const rText = await v(idText, "products/hq", HG);
    const rWrongPage = await v(idA, "products/hq", HL);
    out.push(["MUTANT A3 reader: verifyAcceptApproval hands back the page's own signature for a signed approval, and refuses in its own sentence for no public key file, no sigs, sigs for other pages, another key and another text (the approval id, page and hash all matter)",
      good1.why === "" && good1.sig === sigsA["products/hq"] && rNoKey.why.includes("public key file") && rNoSig.why.includes("no signature") && rOther.why.includes("cover other pages") && rBad.why.includes("does not verify") && rText.why.includes("does not verify")
      && rWrongPage.why !== "" && [rNoKey, rNoSig, rOther, rBad, rText].every((r) => r.sig === "")]);
  } finally {
    if (prior2 === undefined) delete process.env.ARC_SPINE_ROOT; else process.env.ARC_SPINE_ROOT = prior2;
    rmSync(spine2, { recursive: true, force: true });
    rmSync(homeBox, { recursive: true, force: true });
  }
  // ---- attack r1 (boundary surface) on ADR-1514 amendment 2: each arm FAILs against the code before its fix.
  const r1 = mkdtempSync(join(tmpdir(), "narr-r1-"));
  try {
    const W = (/** @type {string} */ n) => join(r1, n);
    const ESC = String.fromCharCode(27), LS = String.fromCharCode(0x2028);
    const U0 = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const oneLine = (/** @type {string} */ t) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(t);
    let linkWhy = "";
    const link = (/** @type {string} */ target, /** @type {string} */ at) => { try { symlinkSync(target, at, "file"); return true; } catch (e) { linkWhy = String(/** @type {any} */ (e) && /** @type {any} */ (e).code || "error"); return false; } };
    /** An arm that needs a symlink runs for real or is a named skip: it never builds the answer it then asserts (attack r2 B3). */
    const linkArm = (/** @type {string} */ name, /** @type {boolean} */ made, /** @type {() => boolean} */ ok) => out.push(made ? [name, ok()] : [`${name} [SKIPPED: this platform refused to make a symlink (${linkWhy})]`, true, true]);
    const keyAt = (/** @type {string} */ name, /** @type {string} */ content) => { const dir = W(name); mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, OK.KEY_FILE), content); return dir; };
    const unseal = (/** @type {string} */ dir, /** @type {string} */ secret) => OK.unsealOwnerKey({ keyDir: dir, readPassphrase: typed(secret) });
    // B1: the sealed file is our own scrypt + AES-GCM document with a random salt, and opens with an independent implementation.
    const sf = JSON.parse(sealed);
    const dir2 = { keyDir: W("k2/owner"), pubPath: W("k2/repo/.claude/owner-key.pub"), readPassphrase: typed(PASS, PASS), isTty: () => true };
    const made2 = await OK.initOwnerKey(dir2);
    const sf2 = made2.ok ? JSON.parse(readFileSync(join(dir2.keyDir, OK.KEY_FILE), "utf8")) : {};
    const openIndep = (/** @type {any} */ f, /** @type {string} */ secret) => {
      const dc = createDecipheriv("aes-256-gcm", scryptSync(secret, Buffer.from(f.salt, "base64"), 32, { N: f.N, r: f.r, p: f.p, maxmem: 2 ** 30 }), Buffer.from(f.iv, "base64"));
      dc.setAAD(Buffer.from(JSON.stringify({ v: f.v, kdf: f.kdf, N: f.N, r: f.r, p: f.p, salt: f.salt }), "utf8"));
      dc.setAuthTag(Buffer.from(f.tag, "base64"));
      return Buffer.concat([dc.update(Buffer.from(f.ct, "base64")), dc.final()]);
    };
    let indepOk = false, indepWrongThrows = false;
    try {
      const k = createPrivateKey({ key: openIndep(sf, PASS), format: "der", type: "pkcs8" });
      indepOk = OSg.verifyOwnerSig(pubPem, "m", cryptoSign(null, Buffer.from("m"), k).toString("base64"));
    } catch { indepOk = false; }
    try { openIndep(sf, `${PASS}x`); } catch { indepWrongThrows = true; }
    out.push(["MUTANT B1 sealing: the private key is sealed by scrypt (N at least 2^17, recorded) and AES-256-GCM in our own JSON file -- no PEM, a fresh random salt and iv per key, opening with an independent scrypt + GCM implementation gives the real key, a wrong passphrase gives none, and the length floor stays 12",
      sf.v === 1 && sf.kdf === "scrypt" && sf.cipher === "aes-256-gcm" && sf.N >= 2 ** 17 && sf.r === 8 && sf.p >= 1 && OK.SCRYPT_N >= 2 ** 17 && !sealed.includes("BEGIN") && made2.ok
      && sf.salt !== sf2.salt && sf.iv !== sf2.iv && sf.ct !== sf2.ct && indepOk && indepWrongThrows && OK.MIN_PASSPHRASE === 12]);
    // B12: every way the key file can be wrong is one sentence, never a stack; a directory is not a key.
    const cheap = keyAt("k-cheap", JSON.stringify({ ...sf, N: 1024 }));
    const bomb = keyAt("k-bomb", JSON.stringify({ ...sf, N: 2 ** 25 }));
    // The old PEM wrapper is built from parts: the attack-input scan refuses a whole diff that carries the literal header.
    const pemWord = "ENCRYPTED " + "PRIVATE KEY";
    const legacy = keyAt("k-legacy", "-----BEGIN " + pemWord + "-----\nMIIBAAAA\n-----END " + pemWord + "-----\n");
    const flipped = keyAt("k-flip", JSON.stringify({ ...sf, ct: Buffer.from(sf.ct, "base64").map((b, i) => (i === 0 ? b ^ 1 : b)).toString("base64") }));
    const dirKey = W("k-dir"); mkdirSync(join(dirKey, OK.KEY_FILE), { recursive: true });
    const uCheap = await unseal(cheap, PASS), uBomb = await unseal(bomb, PASS), uLegacy = await unseal(legacy, PASS), uFlip = await unseal(flipped, PASS), uDir = await unseal(dirKey, PASS);
    const overDir = await OK.initOwnerKey({ keyDir: dirKey, pubPath: W("k-dir-pub/repo/.claude/owner-key.pub"), readPassphrase: typed(PASS, PASS), isTty: () => true });
    const uGood = await unseal(keyDir, PASS);
    out.push(["MUTANT B12 key file: a recorded cost outside the band (too cheap, or a memory bomb), an older PEM file, a flipped byte and a wrong passphrase are each ONE sentence and no key; a directory named owner-key.pem is refused by name (unseal) and as existing (init), never a raw error; the real file still opens",
      [uCheap, uBomb, uLegacy, uFlip, uDir].every((u) => u.key === null && u.why !== "" && oneLine(u.why)) && uCheap.why.includes("outside the accepted band") && uBomb.why.includes("outside the accepted band") && uLegacy.why.includes("not a sealed key")
      && uFlip.why.includes("does not unseal") && uDir.why.includes("not a regular file") && !overDir.ok && overDir.why.includes("already exists") && uGood.key !== null]);
    // B7: nothing is left behind by a refusal or a failed write, and the committed public key is never overwritten.
    const pubDir = W("b7a/repo/.claude/owner-key.pub"); mkdirSync(pubDir, { recursive: true });
    const b7a = await OK.initOwnerKey({ keyDir: W("b7a/owner"), pubPath: pubDir, readPassphrase: typed(PASS, PASS), isTty: () => true });
    const b7aLeft = existsSync(join(W("b7a/owner"), OK.KEY_FILE));
    rmSync(pubDir, { recursive: true });
    const b7retry = await OK.initOwnerKey({ keyDir: W("b7a/owner"), pubPath: pubDir, readPassphrase: typed(PASS, PASS), isTty: () => true });
    const pubFile = W("b7b/repo/.claude/owner-key.pub"); mkdirSync(dirname(pubFile), { recursive: true }); writeFileSync(pubFile, "COMMITTED\n");
    let b7bPrompts = 0;
    const b7b = await OK.initOwnerKey({ keyDir: W("b7b/owner"), pubPath: pubFile, readPassphrase: async () => { b7bPrompts++; return PASS; }, isTty: () => true });
    const linkPub = W("b7c/repo/.claude/owner-key.pub"); mkdirSync(dirname(linkPub), { recursive: true });
    const linked = link(W("b7c/elsewhere.pub"), linkPub);
    const b7c = linked ? await OK.initOwnerKey({ keyDir: W("b7c/owner"), pubPath: linkPub, readPassphrase: typed(PASS, PASS), isTty: () => true }) : { ok: false, why: "" };
    const b7cLinkWhy = linkWhy;
    mkdirSync(W("b7d"), { recursive: true }); writeFileSync(W("b7d/owner"), "a file where the key directory should be");
    const b7d = await OK.initOwnerKey({ keyDir: W("b7d/owner"), pubPath: W("b7d/repo/.claude/owner-key.pub"), readPassphrase: typed(PASS, PASS), isTty: () => true });
    const b7eKey = W("b7e/owner"); mkdirSync(join(b7eKey, `${OK.KEY_FILE}.tmp-${process.pid}`), { recursive: true });
    const b7e = await OK.initOwnerKey({ keyDir: b7eKey, pubPath: W("b7e/repo/.claude/owner-key.pub"), readPassphrase: typed(PASS, PASS), isTty: () => true });
    out.push(["MUTANT B7 atomic init: a public path that is a directory, a committed public key file and a link each REFUSE before any key is made (the committed file untouched, nothing written), a key directory that cannot be made and a private write that fails after the public file is down each leave NOTHING behind, and a fixed path then succeeds -- no half-made key strands the owner",
      !b7a.ok && b7a.why.includes("already exists") && !b7aLeft && b7retry.ok
      && !b7b.ok && b7b.why.includes("already exists") && b7bPrompts === 0 && readFileSync(pubFile, "utf8") === "COMMITTED\n" && !existsSync(join(W("b7b/owner"), OK.KEY_FILE))
      && !b7d.ok && !existsSync(W("b7d/repo/.claude/owner-key.pub")) && b7d.why.includes("nothing was left behind")
      && !b7e.ok && !existsSync(W("b7e/repo/.claude/owner-key.pub")) && !existsSync(join(b7eKey, OK.KEY_FILE)) && [b7a, b7b, b7d, b7e].every((r) => oneLine(r.why))]);
    linkWhy = b7cLinkWhy;
    linkArm("MUTANT B7 link: a public path that is a symlink REFUSES before any key is made -- the link's target is never written and no private key is left",
      linked, () => !b7c.ok && !existsSync(W("b7c/elsewhere.pub")) && !existsSync(join(W("b7c/owner"), OK.KEY_FILE)));
    // B6: HOME and USERPROFILE do not move the key directory.
    const homeReal = OK.ownerKeyDir(), fakeHome = W("fakehome");
    const prevHome = process.env.HOME, prevProfile = process.env.USERPROFILE;
    process.env.HOME = fakeHome; process.env.USERPROFILE = fakeHome;
    let moved = "";
    try { moved = OK.ownerKeyDir(); } finally {
      if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
      if (prevProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = prevProfile;
    }
    out.push(["MUTANT B6 home: with HOME and USERPROFILE pointing at another directory the key directory does not move -- it is the operating system's own record of the user's home",
      moved === homeReal && !moved.startsWith(fakeHome) && homeReal.replace(/\\/g, "/").endsWith("/.arc-private/owner") && OK.ownerKeyDir("/h").replace(/\\/g, "/") === "/h/.arc-private/owner"]);
    // B8: a real owner terminal that is refused is told where a real console is; the check itself is not weakened.
    const noTty2 = await OK.initOwnerKey({ ...initArgs, isTty: false });
    const noTtySign = await OK.signAccept({ approval: U0, pages: [{ page: "products/hq", sha256: HG }], keyDir, readPassphrase: typed(PASS), isTty: false });
    out.push(["MUTANT B8 terminal hint: a refusal for want of a terminal names PowerShell, cmd and Windows Terminal, and inside Git Bash (MSYSTEM or mintty) also the winpty form; outside it does not; both refusals still say real terminal in one sentence",
      OK.terminalHint({ MSYSTEM: "MINGW64" }).includes("winpty") && OK.terminalHint({ TERM_PROGRAM: "mintty" }).includes("winpty") && !OK.terminalHint({}).includes("winpty") && OK.terminalHint({}).includes("PowerShell")
      && !noTty2.ok && noTty2.why.includes("real terminal") && noTty2.why.includes("PowerShell") && noTtySign.sigs === null && noTtySign.why.includes("real terminal") && noTtySign.why.includes("PowerShell") && oneLine(noTty2.why) && oneLine(noTtySign.why)]);
    // B5: an agent's request text is never drawn raw on the terminal where the passphrase is typed.
    const evilPage = `${ESC}[2J${ESC}[Hfake prompt`;
    const shown = typeof OK.pageListing === "function" ? OK.pageListing(U0, [{ page: "products/hq", sha256: HG }, { page: evilPage, sha256: HG }, { page: "lanes/x", sha256: `${ESC}[31m${"a".repeat(30)}` }, { page: "lanes/y", sha256: 7 }, null, "text"]) : "";
    out.push(["MUTANT B5 listing: a request page with terminal escape sequences, a hash made of control bytes, a non-string hash, null and a bare string are each shown as one JSON-escaped, control-stripped 'will not be signed' line; a valid entry is shown as it is; no control character but the line ends reaches the terminal",
      shown !== "" && shown.includes(`  products/hq  ${HG.slice(0, 12)}`) && shown.split("\n").every(oneLine) && !shown.includes(ESC) && shown.split("will not be signed").length === 6 && shown.includes("asks you to accept 6 narrative pages")]);
    // B9: one spelling per signature.
    const kk = generateKeyPairSync("ed25519"), kkPem = String(kk.publicKey.export({ type: "spki", format: "pem" }));
    const sg = cryptoSign(null, Buffer.from("m"), kk.privateKey).toString("base64");
    const AB = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const alias = `${sg.slice(0, 85)}${AB[AB.indexOf(sg[85]) | 1]}${sg.slice(86)}`;
    out.push(["MUTANT B9 canonical base64: a signature whose unused low bits are changed decodes to the very same 64 bytes yet is refused as a spelling (not well formed, never verifies); the canonical one verifies",
      alias !== sg && Buffer.from(alias, "base64").equals(Buffer.from(sg, "base64")) && OSg.sigWellFormed(sg) && !OSg.sigWellFormed(alias) && OSg.verifyOwnerSig(kkPem, "m", sg) && !OSg.verifyOwnerSig(kkPem, "m", alias) && OSg.sigsShapeProblem({ "products/hq": alias }) !== ""]);
    // B10: the decision fits one command line, judged before the passphrase is typed; messages carry no line break.
    const longId = `products/${"a".repeat(120)}`;
    const bigPages = Array.from({ length: 200 }, (_, i) => ({ page: `products/${String(i).padStart(3, "0")}${"b".repeat(85)}`, sha256: HG }));
    let prompted = 0;
    const bigTry = typeof OSg.decisionSizeProblem === "function" ? await OK.signAccept({ approval: U0, pages: bigPages, keyDir, readPassphrase: async () => { prompted++; return PASS; }, isTty: () => true, reason: "r" }) : { sigs: {}, why: "" };
    const lsKey = `products/x${LS}y`;
    const lsProblem = OSg.sigsShapeProblem({ [lsKey]: sg });
    out.push(["MUTANT B10 size: a page id over 100 characters is not a page id; 200 pages that would outgrow one command line are refused BEFORE any passphrase prompt (prompted 0) with the ceiling named, while one page passes; a sigs key holding U+2028 or a newline is refused in a message with no line break",
      !OSg.PAGE_ID_RE.test(longId) && OSg.PAGE_ID_RE.test(`products/${"a".repeat(80)}`) && OSg.sigsShapeProblem({ [longId]: sg }) !== "" && typeof OSg.decisionSizeProblem === "function" && OSg.decisionSizeProblem(U0, "r", bigPages).includes("ceiling")
      && OSg.decisionSizeProblem(U0, "r", [{ page: "products/hq", sha256: HG }]) === "" && bigTry.sigs === null && prompted === 0 && bigTry.why.includes("ceiling") && lsProblem !== "" && oneLine(lsProblem) && oneLine(OSg.sigsShapeProblem({ "products/x\ny": sg }))]);
    // B11: owner-key init takes no argument it would ignore, and will not put the public key on main.
    const inboxCli = (/** @type {string[]} */ ...a) => spawnSync(process.execPath, [join(HQ, "arc-inbox.mjs"), "owner-key", "init", ...a], { encoding: "utf8" });
    const withReason = inboxCli("--reason", "x"), withLane = inboxCli("--lane=y"), withForce = inboxCli("--force");
    const bRepo = mkdtempSync(join(tmpdir(), "narr-branch-"));
    let onMain = "", onFeat = "?", noRepo = "?";
    try {
      const gb = (/** @type {string[]} */ a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...a], { cwd: bRepo, stdio: "ignore", env: gitEnv() });
      gb(["init", "-q"]); gb(["symbolic-ref", "HEAD", "refs/heads/main"]); gb(["commit", "-q", "--allow-empty", "-m", "x"]);
      onMain = typeof inboxMod.ownerKeyRepoProblem === "function" ? inboxMod.ownerKeyRepoProblem(bRepo) : "";
      gb(["checkout", "-q", "-b", "feat/x"]);
      onFeat = inboxMod.ownerKeyRepoProblem(bRepo);
      noRepo = inboxMod.ownerKeyRepoProblem(join(bRepo, "no-such-dir"));
    } finally { rmSync(bRepo, { recursive: true, force: true }); }
    out.push(["MUTANT B11 owner-key args: init refuses --reason, --lane=y and --force by name with exit 2 and touches nothing; the branch check refuses main (naming it and a feat/* checkout), passes a feat branch and a directory git cannot answer for",
      withReason.status === 2 && withReason.stderr.includes("--reason") && withLane.status === 2 && withLane.stderr.includes("--lane") && withForce.status === 2 && withForce.stderr.includes("--force")
      && onMain.includes("main") && onMain.includes("feat/") && !onMain.includes("\n") && onFeat === "" && noRepo === ""]);
    // B13: a page name read off a disk cannot forge a line of its own in the gate's output.
    const forged = "products/x\nnarrative-anchors: narratives=34 accepted=34 awaiting-owner=0 fail=0 owner-key-changed=0";
    const forgedTree = { adrs: new Set(), wiki, tracked: () => false, read: () => "", isDir: () => false };
    const forgedRun = (/** @type {any} */ sigs, /** @type {any} */ owner) => evaluate({ narratives: { "products/hq": good }, accepted: { [forged]: "0".repeat(64), [`products/z${LS}q`]: "1".repeat(64) }, proofs: { [forged]: U0, [`products/z${LS}q`]: U0 }, sigs, owner, tree: forgedTree });
    const fr = [forgedRun({}, null), forgedRun({ [forged]: "not-base64" }, { pub: kkPem, lib: OSg }), forgedRun({ [forged]: `${"A".repeat(86)}==` }, { pub: kkPem, lib: OSg }), evaluate({ narratives: {}, accepted: { [forged]: "0".repeat(64) }, proofs: {}, tree: forgedTree })];
    const frLines = fr.flatMap((r) => r.fails);
    out.push(["MUTANT B13 page names: an accepted.json key holding a newline that spells a whole summary line, or U+2028, is shown JSON-escaped in [no-owner-proof], [no-owner-signature], [bad-owner-signature] and [orphan-accept], so no finding spans two lines or begins as a summary; an ordinary page id is shown as it is",
      frLines.length >= 8 && frLines.every(oneLine) && frLines.every((f) => f.startsWith("[")) && frLines.some((f) => f.startsWith("[bad-owner-signature]")) && frLines.some((f) => f.startsWith("[no-owner-signature]")) && frLines.some((f) => f.startsWith("[orphan-accept]"))
      && frLines.some((f) => f.startsWith("[no-owner-proof]")) && d.shownPage("products/hq") === "products/hq" && d.shownPage(forged).startsWith("\"") && !d.shownPage(forged).includes("\n")]);
    // B3: one reader of the public key file, one rule for a file, a link, a directory and a size.
    const treeRoot = W("b3/repo"); mkdirSync(join(treeRoot, ".claude"), { recursive: true });
    const pubAt = join(treeRoot, ".claude", "owner-key.pub");
    const rd = () => OSg.readOwnerPubFile(pubAt);
    const rdMissing = rd();
    writeFileSync(pubAt, pubPem); const rdFile = rd();
    rmSync(pubAt); mkdirSync(pubAt); const rdDir = rd(); const sigDir = ownerSigProblem([], U0, "products/hq", HG, pubAt); const baseDir = ownerKeyBaseState(treeRoot, { baseRef: "HEAD" }); rmSync(pubAt, { recursive: true });
    writeFileSync(pubAt, "x".repeat(5000)); const rdBig = rd();
    writeFileSync(pubAt, "not a key at all\n"); const rdJunk = rd();
    writeFileSync(pubAt, String(generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey.export({ type: "spki", format: "pem" }))); const rdRsa = rd();
    rmSync(pubAt);
    const outside = W("b3/attacker.pub"); writeFileSync(outside, kkPem);
    const linkedPub = link(outside, pubAt);
    const linkedWhy = linkWhy;
    const rdLink = linkedPub ? rd() : { pem: "", why: "", missing: false };
    const sigLink = linkedPub ? ownerSigProblem([], U0, "products/hq", HG, pubAt) : { why: "", sig: "" };
    const baseLink = linkedPub ? ownerKeyBaseState(treeRoot, { baseRef: "HEAD" }) : { state: "", why: "" };
    out.push(["MUTANT B3 one reader: the public key file read through ONE function -- a regular Ed25519 key passes; missing is the only bootstrap; a directory, an oversize file, junk, an RSA key and a symlink to an outside file holding another key are each refused by name -- and the signature check and the base-ref comparison refuse the same link and directory instead of reading through them",
      rdMissing.missing && rdMissing.pem === "" && rdFile.pem === pubPem && !rdFile.missing && rdDir.pem === "" && !rdDir.missing && rdDir.why.includes("regular file") && rdBig.pem === "" && rdBig.why.includes("too large")
      && rdJunk.pem === "" && rdJunk.why.includes("not a public key") && rdRsa.pem === "" && rdRsa.why.includes("Ed25519") && sigDir.why.includes("regular file") && baseDir.state === "unavailable"]);
    linkWhy = linkedWhy;
    linkArm("MUTANT B3 links: a symlink at the public key path, to an outside file holding another key, is refused by name by the reader and by the signature check, and the base-ref comparison says unavailable instead of reading through it",
      linkedPub, () => rdLink.pem === "" && rdLink.why.includes("symlink") && sigLink.sig === "" && sigLink.why.includes("symlink") && baseLink.state === "unavailable");
    // B4: the env override is one variable on every platform, so the arm that says "git cannot run" cannot be beaten by case.
    const injectCase = process.platform !== "win32";
    if (injectCase) process.env.Path = "decoy-path";
    let pathKeys = [], pathVal = "";
    try { const e = gitEnv({ PATH: "the-one" }); pathKeys = Object.keys(e).filter((k) => k.toUpperCase() === "PATH"); pathVal = String(e[pathKeys[0]]); } finally { if (injectCase) delete process.env.Path; }
    const nogit2 = mainCloneInfo(W("b3"), { PATH: join(W("b3"), "nowhere") });
    out.push(["MUTANT B4 env case: gitEnv with an added PATH leaves exactly ONE variable named PATH in any case (with an inherited Path present), holding the added value; git with that PATH cannot run and says so",
      pathKeys.length === 1 && pathVal === "the-one" && gitEnv({ PATH: "x" }).GIT_OPTIONAL_LOCKS === "0" && nogit2.main === "" && nogit2.why.includes("could not run")]);
    // B2: the base comparison is against the merge-base; a ref is never an option; the summary line says when it did not run.
    const okm = mkdtempSync(join(tmpdir(), "narr-okey-mb-"));
    try {
      const gm = (/** @type {string[]} */ a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...a], { cwd: okm, stdio: "ignore", env: gitEnv() });
      const pemC = String(generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }));
      mkdirSync(join(okm, ".claude"), { recursive: true });
      writeFileSync(join(okm, ".claude", "owner-key.pub"), pubPem);
      gm(["init", "-q"]); gm(["symbolic-ref", "HEAD", "refs/heads/trunk"]); gm(["add", "."]); gm(["commit", "-q", "-m", "c1"]);
      const c1 = execFileSync("git", ["rev-parse", "HEAD"], { cwd: okm, encoding: "utf8", env: gitEnv() }).trim();
      gm(["checkout", "-q", "-b", "feat"]); gm(["checkout", "-q", "trunk"]);
      writeFileSync(join(okm, ".claude", "owner-key.pub"), pemC); gm(["add", "."]); gm(["commit", "-q", "-m", "c2 trunk moved its key"]);
      gm(["checkout", "-q", "feat"]);
      const untouched = ownerKeyBaseState(okm, { baseRef: "trunk" });
      writeFileSync(join(okm, ".claude", "owner-key.pub"), pemC);
      const swapped = ownerKeyBaseState(okm, { baseRef: "trunk" });
      const bySha = ownerKeyBaseState(okm, { baseRef: c1 });
      const optionRef = ownerKeyBaseState(okm, { baseRef: "--upload-pack=x" }), dashRef = ownerKeyBaseState(okm, { baseRef: "-x" });
      out.push(["MUTANT B2 merge-base: a branch that did not touch the key is 'same' even when the base moved on to another key, one that swapped it is 'changed' even when the base tip already holds that key, a commit sha given as the base works, and a ref that would be a git option is refused as not a plain ref name",
        untouched.state === "same" && swapped.state === "changed" && swapped.was === fingerprint(pubPem) && swapped.now === fingerprint(pemC) && bySha.state === "changed" && bySha.was === fingerprint(pubPem)
        && optionRef.state === "unavailable" && optionRef.why.includes("not a plain ref") && dashRef.state === "unavailable"]);
    } finally { rmSync(okm, { recursive: true, force: true }); }
    const fUn = d.ownerKeyFinding({ state: "unavailable", why: "the base ref origin/main does not exist here", base: "origin/main" });
    const fSame = d.ownerKeyFinding({ state: "same" }), fNone = d.ownerKeyFinding({ state: "no-key" }), fChg = d.ownerKeyFinding({ state: "changed", base: "b", was: "1", now: "2" });
    const stats = { narratives: 1, accepted: 0, awaiting: 1, fails: [] }, debt = { debt: 1, total: 2, explained: 1 };
    const usage = spawnSync(process.execPath, [d.script, "--base", "origin/main", "--accept", "products/hq", "--approval", U0], { encoding: "utf8" });
    out.push(["MUTANT B2 unchecked: an owner key that could not be compared with the base says [owner-key-unchecked] with the CODEOWNERS fallback AND puts owner-key-base=unchecked on the summary line; a compared key says checked, no file says no-key; --base beside --accept is a usage error (exit 2)",
      fUn.base === "unchecked" && fUn.warn.startsWith("[owner-key-unchecked]") && fUn.warn.includes("CODEOWNERS") && !fUn.warn.includes("\n") && fUn.changed === 0 && d.ownerKeyFinding(null).base === "unchecked"
      && d.summaryLine(stats, fUn, debt).includes("owner-key-changed=0 owner-key-base=unchecked ") && d.summaryLine(stats, fSame, debt).includes("owner-key-base=checked") && d.summaryLine(stats, fNone, debt).includes("owner-key-base=no-key")
      && fChg.base === "checked" && fChg.changed === 1 && usage.status === 2 && usage.stderr.includes("--base")]);
    // ---- attack r2 (boundary surface): each arm FAILs against the code before its fix.
    const gitIn = (/** @type {string} */ cwd) => ({
      run: (/** @type {string[]} */ a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...a], { cwd, stdio: "ignore", env: gitEnv() }),
      get: (/** @type {string[]} */ a) => execFileSync("git", a, { cwd, encoding: "utf8", env: gitEnv() }).trim(),
    });
    const pemK2 = String(generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }));
    // B1: a key deleted from the tree, or added back after the base's history removed it, is loud, not silent.
    const rz = W("r2/deleted"), rh = W("r2/history");
    mkdirSync(join(rz, ".claude"), { recursive: true }); mkdirSync(join(rh, ".claude"), { recursive: true });
    const gzr = gitIn(rz), ghr = gitIn(rh);
    gzr.run(["init", "-q"]); gzr.run(["symbolic-ref", "HEAD", "refs/heads/trunk"]);
    writeFileSync(join(rz, ".claude", "owner-key.pub"), pubPem); gzr.run(["add", "."]); gzr.run(["commit", "-q", "-m", "k1"]);
    gzr.run(["update-ref", "refs/remotes/origin/main", gzr.get(["rev-parse", "HEAD"])]); gzr.run(["checkout", "-q", "-b", "feat"]);
    rmSync(join(rz, ".claude", "owner-key.pub"));
    const deleted = ownerKeyBaseState(rz), fDel = d.ownerKeyFinding(deleted);
    ghr.run(["init", "-q"]); ghr.run(["symbolic-ref", "HEAD", "refs/heads/trunk"]);
    writeFileSync(join(rh, ".claude", "owner-key.pub"), pubPem); ghr.run(["add", "."]); ghr.run(["commit", "-q", "-m", "k1"]);
    ghr.run(["rm", "-q", ".claude/owner-key.pub"]); ghr.run(["commit", "-q", "-m", "the key is deleted"]);
    ghr.run(["update-ref", "refs/remotes/origin/main", ghr.get(["rev-parse", "HEAD"])]); ghr.run(["checkout", "-q", "-b", "feat"]);
    mkdirSync(join(rh, ".claude"), { recursive: true }); writeFileSync(join(rh, ".claude", "owner-key.pub"), pemK2);
    const readded = ownerKeyBaseState(rh), fRe = d.ownerKeyFinding(readded);
    out.push(["MUTANT B1 deleted key: with the key deleted from the tree while the base holds it the state is 'changed' (one [owner-key-changed] WARN, count 1, the fingerprint and 'deleted' named); a key added back after the base's history removed it is 'changed' too, not a bootstrap; a tree that never had one is still 'no-key'",
      deleted.state === "changed" && deleted.now === "deleted" && deleted.was === fingerprint(pubPem) && fDel.changed === 1 && fDel.warn.startsWith("[owner-key-changed]") && !fDel.warn.includes("\n")
      && readded.state === "changed" && readded.now === fingerprint(pemK2) && fRe.changed === 1 && ownerKeyBaseState(W("r2"), { baseRef: "HEAD" }).state === "no-key"]);
    // B2: a local tag named origin/main, on a commit that carries the swapped key, must not stand in for the real remote-tracking ref.
    const gz = gitIn(rz);
    gz.run(["checkout", "-q", "--orphan", "evil"]); writeFileSync(join(rz, ".claude", "owner-key.pub"), pemK2); gz.run(["add", "-A"]); gz.run(["commit", "-q", "-m", "evil"]);
    gz.run(["tag", "origin/main"]); gz.run(["checkout", "-q", "-f", "feat"]); writeFileSync(join(rz, ".claude", "owner-key.pub"), pemK2);
    const shadowDefault = ownerKeyBaseState(rz), shadowShort = ownerKeyBaseState(rz, { baseRef: "origin/main" }), shadowFull = ownerKeyBaseState(rz, { baseRef: "refs/remotes/origin/main" });
    out.push(["MUTANT B2 shadowed ref: with a local tag named origin/main on a commit holding the swapped key, the default base still reads refs/remotes/origin/main and says 'changed'; the short name origin/main is refused as ambiguous, naming both refs; the full name works",
      shadowDefault.state === "changed" && shadowDefault.was === fingerprint(pubPem) && shadowShort.state === "unavailable" && shadowShort.why.includes("ambiguous") && shadowShort.why.includes("refs/tags/origin/main") && shadowFull.state === "changed"]);
    // B5: a replace ref on the base commit must not change what the key is compared with; the environment cannot move the object store or the config.
    const rp = W("r2/replace"); mkdirSync(join(rp, ".claude"), { recursive: true });
    const gpr = gitIn(rp);
    gpr.run(["init", "-q"]); gpr.run(["symbolic-ref", "HEAD", "refs/heads/trunk"]);
    writeFileSync(join(rp, ".claude", "owner-key.pub"), pubPem); gpr.run(["add", "."]); gpr.run(["commit", "-q", "-m", "real base"]);
    const realBase = gpr.get(["rev-parse", "HEAD"]);
    gpr.run(["checkout", "-q", "--orphan", "fake"]); writeFileSync(join(rp, ".claude", "owner-key.pub"), pemK2); gpr.run(["add", "-A"]); gpr.run(["commit", "-q", "-m", "fake base"]);
    const fakeBase = gpr.get(["rev-parse", "HEAD"]);
    gpr.run(["checkout", "-q", "-f", "trunk"]); gpr.run(["checkout", "-q", "-b", "feat"]); gpr.run(["replace", realBase, fakeBase]);
    writeFileSync(join(rp, ".claude", "owner-key.pub"), pemK2);
    const replaced = ownerKeyBaseState(rp, { baseRef: "refs/heads/trunk" });
    out.push(["MUTANT B5 replace ref: with git replace making the base commit read as one that holds the swapped key, the comparison still reads the real base and says 'changed'",
      replaced.state === "changed" && replaced.was === fingerprint(pubPem) && replaced.now === fingerprint(pemK2)]);
    const envNames = ["GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_CONFIG_PARAMETERS", "GIT_NAMESPACE", "GIT_REPLACE_REF_BASE", "GIT_GRAFT_FILE"];
    const priorEnv = envNames.map((k) => [k, process.env[k]]);
    for (const k of envNames) process.env[k] = "x";
    if (process.platform !== "win32") { process.env.git_optional_locks = "1"; process.env.git_no_replace_objects = "0"; }
    /** @type {NodeJS.ProcessEnv} */ let ge = {};
    try { ge = gitEnv(); } finally {
      for (const [k, v] of priorEnv) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
      if (process.platform !== "win32") { delete process.env.git_optional_locks; delete process.env.git_no_replace_objects; }
    }
    const geKeys = Object.keys(ge).map((k) => k.toUpperCase());
    out.push(["MUTANT B5 git env: gitEnv drops the object-store, alternates, config-injection, namespace, replace and graft variables, sets GIT_NO_REPLACE_OBJECTS to 1, and leaves exactly one GIT_OPTIONAL_LOCKS and one GIT_NO_REPLACE_OBJECTS in any case",
      envNames.every((k) => !geKeys.includes(k)) && ge.GIT_NO_REPLACE_OBJECTS === "1" && ge.GIT_OPTIONAL_LOCKS === "0" && geKeys.filter((k) => k === "GIT_OPTIONAL_LOCKS").length === 1 && geKeys.filter((k) => k === "GIT_NO_REPLACE_OBJECTS").length === 1]);
    // B6: the page count is judged before the passphrase is typed (201 short ids fit the byte ceiling).
    const manyPages = Array.from({ length: 201 }, (_, i) => ({ page: `a/b${String(i).padStart(3, "0")}`, sha256: HG }));
    let prompted201 = 0;
    const many = await OK.signAccept({ approval: U0, pages: manyPages, keyDir, readPassphrase: async () => { prompted201++; return PASS; }, isTty: () => true, reason: "r" });
    out.push(["MUTANT B6 count: 201 short page ids (well under the byte ceiling) are refused BEFORE any passphrase prompt (prompted 0) with the page ceiling named, by signAccept and by decisionSizeProblem",
      many.sigs === null && prompted201 === 0 && many.why.includes("ceiling") && OSg.decisionSizeProblem(U0, "r", manyPages).includes("ceiling") && OSg.decisionSizeProblem(U0, "r", manyPages.slice(0, 200)) === ""]);
    // B7: a write that throws after the file was created leaves nothing behind, and a fixed path then succeeds.
    const throwAt = (/** @type {number} */ n) => { let c = 0; return (/** @type {number} */ fd, /** @type {string} */ data) => { c++; if (c === n) throw new Error("ENOSPC: no space left on device"); writeSync(fd, data); }; };
    const wf = (/** @type {string} */ name, /** @type {number} */ n) => ({ keyDir: W(`${name}/owner`), pubPath: W(`${name}/repo/.claude/owner-key.pub`), readPassphrase: typed(PASS, PASS), isTty: () => true, writeData: throwAt(n) });
    const w1 = wf("b7w1", 1), w2 = wf("b7w2", 2);
    const wr1 = await OK.initOwnerKey(w1), wr2 = await OK.initOwnerKey(w2);
    const wLeft = (/** @type {any} */ w) => existsSync(w.pubPath) || existsSync(join(w.keyDir, OK.KEY_FILE)) || existsSync(`${join(w.keyDir, OK.KEY_FILE)}.tmp-${process.pid}`);
    const left1 = wLeft(w1), left2 = wLeft(w2); // judged BEFORE the retry, which makes the files
    const wRetry = await OK.initOwnerKey({ ...w1, readPassphrase: typed(PASS, PASS), writeData: undefined });
    out.push(["MUTANT B7 failed write: a public-key write that throws after the file was created and a private write that throws after the public file is down each leave NOTHING behind (no zero-byte key file that would strand the owner), say so in one sentence, and init then succeeds on the same paths",
      !wr1.ok && !wr2.ok && !left1 && !left2 && wr1.why.includes("nothing was left behind") && oneLine(wr1.why) && oneLine(wr2.why) && wRetry.ok]);
    // B9: the key file is judged on the descriptor it is read from: a different file than the one judged is refused.
    const b9 = W("b9"); mkdirSync(b9, { recursive: true });
    writeFileSync(join(b9, "a"), "AAAA"); writeFileSync(join(b9, "b"), "BBBB");
    const stA = lstatSync(join(b9, "a"), { bigint: true });
    const rcOk = typeof OSg.readCheckedFile === "function" ? OSg.readCheckedFile(join(b9, "a"), stA, 100) : { buf: null, why: "" };
    const rcSwap = typeof OSg.readCheckedFile === "function" ? OSg.readCheckedFile(join(b9, "b"), stA, 100) : { buf: Buffer.from("x"), why: "" };
    const rcBig = typeof OSg.readCheckedFile === "function" ? OSg.readCheckedFile(join(b9, "a"), stA, 2) : { buf: Buffer.from("x"), why: "" };
    out.push(["MUTANT B9 descriptor: the bytes are read from the descriptor that was checked -- the judged file reads, a different file (the swap after the check) is refused as changed between the check and the read, and a file over the ceiling is refused on the descriptor's own size",
      rcOk.buf !== null && rcOk.buf.toString() === "AAAA" && rcSwap.buf === null && rcSwap.why.includes("changed between") && rcBig.buf === null && rcBig.why.includes("too large")]);
    // B10: the accepted cost band and the memory scrypt is given agree: the band's top opens, and a cost above it is refused by name, not blamed on the passphrase.
    const sealAt = (/** @type {number} */ N) => {
      const raw = /** @type {Buffer} */ (generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "der" }));
      const head = { v: 1, kdf: "scrypt", N, r: 8, p: 1, salt: randomBytes(16).toString("base64") };
      const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", scryptSync(PASS, Buffer.from(head.salt, "base64"), 32, { N, r: 8, p: 1, maxmem: 2 ** 31 }), iv);
      c.setAAD(Buffer.from(JSON.stringify(head), "utf8"));
      const ct = Buffer.concat([c.update(raw), c.final()]);
      return JSON.stringify({ ...head, cipher: "aes-256-gcm", iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), ct: ct.toString("base64") });
    };
    const top = typeof OK.SCRYPT_N_MAX === "number" ? OK.SCRYPT_N_MAX : 2 ** 19;
    const uTop = await unseal(keyAt("k-top", sealAt(top)), PASS);
    const uOver = await unseal(keyAt("k-over", JSON.stringify({ ...JSON.parse(sealAt(top)), N: top * 2 })), PASS);
    out.push(["MUTANT B10 band: a file sealed at the top of the accepted cost band opens with its passphrase (the memory scrypt is given covers 128 x N x r for every N in the band), a recorded cost above the band is refused as outside the band -- never as a wrong passphrase -- and the band's top is no more than 2^19",
      typeof OK.scryptMaxmem === "function" && OK.scryptMaxmem(top, 8, 4) >= 128 * 8 * top && top <= 2 ** 19 && uTop.key !== null && uOver.key === null && uOver.why.includes("outside the accepted band") && !uOver.why.includes("passphrase")]);
    // B4: a name read off a disk cannot forge a line in any finding, [not-a-file] and [empty] included.
    const nlName = "products/x\nnarrative-anchors: narratives=34 accepted=34 awaiting-owner=0 fail=0 owner-key-changed=0 owner-key-base=checked";
    const rf = typeof d.rejectedFindings === "function" ? d.rejectedFindings([nlName, `wiki/a${LS}b`, "docs/narrative-verify/accepted.json is a symlink"]) : [];
    const emptyForged = evaluate({ narratives: { [nlName]: "" }, accepted: {}, proofs: {}, tree: forgedTree });
    out.push(["MUTANT B4 disk names: a rejected path holding a newline that spells a whole summary line, or U+2028, is shown JSON-escaped in [not-a-file] and never spans two lines; a sentence in the same list is shown as it is; an empty page with such a name gives one-line findings too",
      rf.length === 3 && rf.every((x) => x.startsWith("[not-a-file] ") && oneLine(x)) && rf[2].includes("docs/narrative-verify/accepted.json is a symlink") && emptyForged.fails.length >= 1 && emptyForged.fails.every((x) => x.startsWith("[") && oneLine(x))]);
  } finally { rmSync(r1, { recursive: true, force: true }); }
  const cli = mkdtempSync(join(tmpdir(), "narr-cli-"));
  try {
    const U1 = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const call = (/** @type {string[]} */ ...a) => spawnSync(process.execPath, [d.script, "--root", cli, ...a], { encoding: "utf8" });
    const bareAccept = call("--accept", "products/hq");
    const junk = call("--accept", "products/hq", "--approval", "12345");
    const orphanApproval = call("--approval", U1);
    const both = call("--request-accept", "products/hq", "--accept", "products/hq");
    out.push(["MUTANT B6 bare accept: an agent-style --accept with no --approval, or a malformed one, is refused (exit 1, one sentence, nothing written); --approval alone and --request-accept beside --accept are usage errors",
      bareAccept.status === 1 && /^REFUSED products\/hq -- --accept needs --approval/.test(bareAccept.stdout) && junk.status === 1 && junk.stdout.includes("not an approval id")
      && orphanApproval.status === 2 && both.status === 2 && !existsSync(join(cli, "docs"))]);
    const withEnv = (/** @type {string[]} */ a) => spawnSync(process.execPath, [d.script, "--root", cli, ...a], { encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: cli } });
    const envAccept = withEnv(["--accept", "products/hq", "--approval", U1]);
    const envRequest = withEnv(["--request-accept", "products/hq"]);
    out.push(["MUTANT B1 env spine cli: --accept and --request-accept run with ARC_SPINE_ROOT set are refused by name (exit 1, one sentence, nothing written)",
      envAccept.status === 1 && /^REFUSED products\/hq -- .*ARC_SPINE_ROOT/.test(envAccept.stdout) && envRequest.status === 1 && /^REFUSED request-accept -- .*ARC_SPINE_ROOT/.test(envRequest.stdout) && !existsSync(join(cli, "docs"))]);
    const jj = call("--json", "--json");
    const ja = call("--json", "--accept", "products/hq", "--approval", U1);
    const jr = call("--json", "--request-accept", "products/hq");
    out.push(["MUTANT B4 json: a repeated --json, and --json beside --accept or --request-accept, are usage errors (exit 2) that name the flag",
      jj.status === 2 && jj.stderr.includes("--json given twice") && ja.status === 2 && ja.stderr.includes("--json") && jr.status === 2 && jr.stderr.includes("--json") && !existsSync(join(cli, "docs"))]);
  } finally { rmSync(cli, { recursive: true, force: true }); }
  const repo = mkdtempSync(join(tmpdir(), "narr-main-"));
  const wt = `${repo}-wt`;
  const sep = mkdtempSync(join(tmpdir(), "narr-sep-"));
  const decoy = mkdtempSync(join(tmpdir(), "narr-decoy-"));
  const priorGitDir = process.env.GIT_DIR;
  try {
    const g = (/** @type {string[]} */ a, /** @type {string} */ cwd) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...a], { cwd, stdio: "ignore", env: genv });
    g(["init", "-q"], repo);
    g(["commit", "-q", "--allow-empty", "-m", "x"], repo);
    g(["worktree", "add", "-q", "--detach", wt], repo);
    out.push(["main clone: from a linked worktree git's common dir names the main clone, and from the clone itself the same one",
      samePlace(mainCloneOf(wt), repo) && samePlace(mainCloneOf(repo), repo)]);
    // B3: a clone whose git dir is elsewhere and not named .git; the common dir's parent is NOT the clone.
    const work = join(sep, "work");
    mkdirSync(work);
    g(["init", "-q", `--separate-git-dir=${join(sep, "store.git")}`, work], sep);
    g(["commit", "-q", "--allow-empty", "-m", "x"], work);
    out.push(["MUTANT B3 layout: a clone whose git dir is not named .git (--separate-git-dir) is refused by name, never resolved to the parent of its git dir; ownerSpine says why",
      mainCloneOf(work) === "" && ownerSpine(work).why.includes("not named .git") && !ownerSpine(work).why.includes("not a git checkout")]);
    // B2: the caller's GIT_DIR must not steer either git child.
    g(["init", "-q"], decoy);
    writeFileSync(join(decoy, "decoy-only.txt"), "x");
    g(["add", "decoy-only.txt"], decoy);
    writeFileSync(join(repo, "real.txt"), "x");
    g(["add", "real.txt"], repo);
    process.env.GIT_DIR = join(decoy, ".git");
    const steered = gitTrackedList(repo);
    const steeredMain = mainCloneOf(wt);
    delete process.env.GIT_DIR;
    out.push(["MUTANT B2 git env: with GIT_DIR pointing at a decoy repo, gitTrackedList still lists the tree it was given and mainCloneOf still finds the real main clone",
      steered.has("real.txt") && !steered.has("decoy-only.txt") && samePlace(steeredMain, repo) && gitEnv({ GIT_DIR: "x" }).GIT_DIR === "x" && gitEnv().GIT_OPTIONAL_LOCKS === "0"]);
  } finally {
    if (priorGitDir === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = priorGitDir;
    for (const dir of [wt, repo, sep, decoy]) rmSync(dir, { recursive: true, force: true });
  }
  // B6: three causes, three sentences. A git that cannot run, a directory that is no checkout and a git dir not named .git are told apart.
  const nogit = mkdtempSync(join(tmpdir(), "narr-nogit-"));
  try {
    const ceil = { GIT_CEILING_DIRECTORIES: dirname(nogit) };
    const notCheckout = ownerSpine(nogit, { gitEnv: ceil }).why;
    const noRun = ownerSpine(nogit, { gitEnv: { ...ceil, PATH: join(nogit, "nowhere") } }).why;
    const old = explainGitFailure({ status: 129, stderr: "error: unknown option path-format\nusage: git rev-parse" });
    out.push(["MUTANT B6 reasons: a fake unknown-option failure, a missing git and a non-checkout are each named for what they are, and none is blamed on the .git layout",
      explainGitFailure({ code: "ENOENT" }).kind === "no-git" && explainGitFailure({ status: 128, stderr: "fatal: not a git repository (or any parent)" }).kind === "not-a-checkout"
      && old.kind === "git-failed" && old.why.includes("unknown option") && !old.why.includes("not named .git")]);
    out.push(["MUTANT B6 ownerSpine: a directory that is no git checkout says so, git missing from PATH says it could not run, and neither says a git dir not named .git",
      notCheckout.includes("not a git checkout") && !notCheckout.includes("not named .git") && noRun.includes("git could not run") && !noRun.includes("not named .git") && !noRun.includes("not a git checkout")]);
  } finally { rmSync(nogit, { recursive: true, force: true }); }
  // B3: a consumer that synced only docs has no hq helper; --accept and --request-accept then refuse by name and write nothing.
  const lone = mkdtempSync(join(tmpdir(), "narr-lone-"));
  try {
    mkdirSync(join(lone, ".claude", "scripts", "docs"), { recursive: true });
    copyFileSync(d.script, join(lone, ".claude", "scripts", "docs", "narrative-anchors.mjs"));
    const U = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const run = (/** @type {string[]} */ ...a) => spawnSync(process.execPath, [join(lone, ".claude", "scripts", "docs", "narrative-anchors.mjs"), "--root", lone, ...a], { encoding: "utf8" });
    const acc = run("--accept", "products/hq", "--approval", U);
    const req = run("--request-accept", "products/hq");
    out.push(["MUTANT B3 accept without hq: with the hq helper absent, --accept and --request-accept each REFUSE (exit 1, one sentence naming the helper, nothing written) instead of throwing",
      acc.status === 1 && /^REFUSED products\/hq -- hq\/lib\/narrative-proof\.mjs is not installed/.test(acc.stdout) && req.status === 1 && /^REFUSED request-accept -- hq\/lib\/narrative-proof\.mjs is not installed/.test(req.stdout)
      && !existsSync(join(lone, "docs"))]);
  } finally { rmSync(lone, { recursive: true, force: true }); }
  // ---- ADR-1514 amendment 2, "Correction": the swapped key is loud, the first key is allowed, an unreadable base is said in one line.
  const okr = mkdtempSync(join(tmpdir(), "narr-okey-"));
  const okb = mkdtempSync(join(tmpdir(), "narr-okey-boot-"));
  try {
    const gk = (/** @type {string[]} */ a, /** @type {string} */ cwd) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...a], { cwd, stdio: "ignore", env: gitEnv() });
    const pemB = String(generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }));
    mkdirSync(join(okr, ".claude"), { recursive: true });
    writeFileSync(join(okr, ".claude", "owner-key.pub"), pubPem);
    gk(["init", "-q"], okr); gk(["add", "."], okr); gk(["commit", "-q", "-m", "key"], okr);
    const same = ownerKeyBaseState(okr, { baseRef: "HEAD" });
    writeFileSync(join(okr, ".claude", "owner-key.pub"), pemB);
    const changed = ownerKeyBaseState(okr, { baseRef: "HEAD" });
    const fc = d.ownerKeyFinding(changed);
    const gone = ownerKeyBaseState(okr, { baseRef: "refs/heads/no-such-branch" });
    const noGit = ownerKeyBaseState(okr, { baseRef: "HEAD", extraEnv: { PATH: join(okr, "nowhere") } });
    const fu = d.ownerKeyFinding(gone), fg = d.ownerKeyFinding(noGit);
    out.push(["MUTANT A6 key swap: a public key that differs from the base ref's gives ONE [owner-key-changed] WARN naming both fingerprints and counts 1; the same key says nothing and counts 0",
      same.state === "same" && d.ownerKeyFinding(same).warn === "" && d.ownerKeyFinding(same).changed === 0 && changed.state === "changed" && changed.was === fingerprint(pubPem) && changed.now === fingerprint(pemB)
      && fc.changed === 1 && fc.warn.startsWith("[owner-key-changed]") && !fc.warn.includes("\n") && fc.warn.includes(changed.was) && fc.warn.includes(changed.now)]);
    mkdirSync(join(okb, ".claude"), { recursive: true });
    gk(["init", "-q"], okb); gk(["commit", "-q", "--allow-empty", "-m", "x"], okb);
    writeFileSync(join(okb, ".claude", "owner-key.pub"), pubPem);
    const boot = ownerKeyBaseState(okb, { baseRef: "HEAD" });
    const bare = mkdtempSync(join(tmpdir(), "narr-okey-none-"));
    let none;
    try { none = ownerKeyBaseState(bare, { baseRef: "HEAD" }); } finally { rmSync(bare, { recursive: true, force: true }); }
    out.push(["MUTANT A6 bootstrap and unavailable: a base with no key file is the allowed first-time bootstrap (no WARN, count 0); a missing base ref and a git that cannot run each say so in ONE [owner-key-unchecked] line and continue; no key file in the tree is no finding",
      boot.state === "bootstrap" && d.ownerKeyFinding(boot).warn === "" && d.ownerKeyFinding(boot).changed === 0 && gone.state === "unavailable" && fu.warn.startsWith("[owner-key-unchecked]") && fu.warn.includes("does not exist") && !fu.warn.includes("\n") && fu.changed === 0
      && noGit.state === "unavailable" && fg.warn.startsWith("[owner-key-unchecked]") && !fg.warn.includes("\n") && none.state === "no-key" && d.ownerKeyFinding(none).warn === ""]);
  } finally { rmSync(okr, { recursive: true, force: true }); rmSync(okb, { recursive: true, force: true }); rmSync(keyBox, { recursive: true, force: true }); }
  return out;
}

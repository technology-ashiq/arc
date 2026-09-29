// narrative-proof.mjs -- everything the narrative gate does that needs a process, the spine or the main clone (ADR-1514 amendment 1).
//
// narrative-anchors.mjs lives under .claude/scripts/docs/, where DOC-A (ADR-1501, tests/docs/no-walker.mjs) forbids a child
// process: a spawned process can list files for us. So every spawn, every spine read and every look at the main clone is here,
// and the gate imports this file with a dynamic import() only on the paths that need it (the tracked list, --request-accept,
// --accept). Nothing here lists a directory.
//
// Exports: gitEnv, gitTrackedList, explainGitFailure, mainCloneInfo, mainCloneOf, spineEnvProblem, ownerSpine, readSpineEvents, requestAcceptApproval, ownerSigProblem, verifyAcceptApproval, ownerKeyBaseState, proofArms.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash, createPublicKey, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { fingerprint, ownerMessage, sigsShapeProblem, verifyOwnerSig } from "./owner-sig.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HQ = join(HERE, "..");
const CORE = join(HERE, "..", "..", "core");

/**
 * The environment every git child here gets: the caller's, minus git's location variables (a pre-push hook exports GIT_DIR and
 * GIT_INDEX_FILE, and `git ls-files` then lists ANOTHER repo's index -- attack B2, the twin of face reads.mjs childEnv), and
 * with optional locks off so a read never takes the index lock. Names compared upper-cased: Windows reads them case-blind.
 * @param {Record<string, string>} [extra] set after the strip (a test names its own ceiling) @returns {NodeJS.ProcessEnv}
 */
export function gitEnv(extra = {}) {
  const DROP = new Set(["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_CEILING_DIRECTORIES"]);
  /** @type {NodeJS.ProcessEnv} */ const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!DROP.has(k.toUpperCase())) env[k] = v;
  return { ...env, ...extra, GIT_OPTIONAL_LOCKS: "0" };
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
  let pub = "";
  try { if (typeof pubPath === "string" && pubPath !== "" && statSync(pubPath).isFile()) pub = readFileSync(pubPath, "utf8"); } catch { pub = ""; }
  if (pub === "") return no("the owner's public key file (.claude/owner-key.pub) is missing, so no signature can be checked; the owner runs arc-inbox owner-key init and commits it");
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
 * thing signatures cannot stop on a same-user box, so the gate makes it loud: state "changed" is a WARN. A base with no such file
 * is the first-time bootstrap and is allowed; a missing base ref or git is "unavailable" with one line, never a throw.
 * @param {string} root @param {{ baseRef?: string, extraEnv?: Record<string, string> }} [opts]
 * @returns {{ state: "no-key" | "same" | "changed" | "bootstrap" | "unavailable", why: string, base: string, was: string, now: string }}
 */
export function ownerKeyBaseState(root, opts = {}) {
  const base = opts.baseRef || "origin/main", rel = ".claude/owner-key.pub";
  const out = (/** @type {any} */ state, why = "", was = "", now = "") => ({ state, why, base, was, now });
  let cur = null;
  try { cur = readFileSync(join(root, rel), "utf8"); } catch { cur = null; }
  if (cur === null) return out("no-key");
  const git = (/** @type {string[]} */ args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", env: gitEnv(opts.extraEnv), timeout: 30000, stdio: ["ignore", "pipe", "pipe"] });
  const norm = (/** @type {string} */ t) => t.replace(/\r\n/g, "\n").trim();
  const fp = (/** @type {string} */ t) => { try { return fingerprint(t); } catch { return "unreadable"; } };
  try { git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]); }
  catch (e) {
    const err = /** @type {any} */ (e);
    if (err && err.status === 1 && !err.stderr?.toString().trim()) return out("unavailable", `the base ref ${base} does not exist here (git fetch it), so the owner key could not be compared with it`);
    return out("unavailable", `${explainGitFailure(e).why}, so the owner key could not be compared with ${base}`);
  }
  let listed = "";
  try { listed = git(["ls-tree", "--name-only", base, "--", rel]).trim(); }
  catch (e) { return out("unavailable", `${explainGitFailure(e).why}, so the owner key could not be compared with ${base}`); }
  if (listed === "") return out("bootstrap", "", "", fp(cur));
  let then = "";
  try { then = git(["show", `${base}:${rel}`]); }
  catch (e) { return out("unavailable", `${explainGitFailure(e).why}, so the owner key could not be compared with ${base}`); }
  return norm(then) === norm(cur) ? out("same", "", fp(then), fp(cur)) : out("changed", "", fp(then), fp(cur));
}

/**
 * The self-test arms that need a process, the spine or a git repository, run against the REAL functions above and the gate's
 * own, handed in. Returns [name, ok] pairs; the caller counts and prints them like its own arms.
 * @param {any} d the gate's pure pieces and fixtures: good, wiki, ACCEPT_GATE, sha256, requestPayload, approvalProblem, evaluate,
 *   trackedIn, isTopDir, acceptEntry, sigsOf, ownerKeyFinding, OWNER_PUB, script (the gate's own path)
 * @returns {Promise<[string, boolean][]>}
 */
export async function proofArms(d) {
  /** @type {[string, boolean][]} */ const out = [];
  const has = (/** @type {{ fails: string[] }} */ r, /** @type {string} */ tag) => r.fails.some((f) => f.startsWith(tag));
  const { good, wiki, ACCEPT_GATE, sha256, requestPayload, approvalProblem, evaluate, trackedIn, isTopDir } = d;
  const HG = sha256(good);
  // ADR-1514 amendment 2: one real sealed key in a temp dir, made through the real initOwnerKey with the terminal and the prompt injected.
  const OK = await import(pathToFileURL(join(HERE, "owner-key.mjs")).href);
  const OSg = await import(pathToFileURL(join(HERE, "owner-sig.mjs")).href);
  const { decide } = await import(pathToFileURL(join(HQ, "arc-inbox.mjs")).href);
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
  out.push(["MUTANT A1 init: with a terminal it writes an ENCRYPTED PKCS8 private key outside the repo and the SPKI public key at the repo path, prints a 16-hex fingerprint of the public DER, and refuses to overwrite (naming a deliberate delete) leaving the key as it was",
    made.ok && made.keyPath === join(keyDir, OK.KEY_FILE) && sealed.includes("BEGIN ENCRYPTED PRIVATE KEY") && pubPem.includes("BEGIN PUBLIC KEY") && /^[0-9a-f]{16}$/.test(made.fingerprint)
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

// narrative-proof.mjs -- everything the narrative gate does that needs a process, the spine or the main clone (ADR-1514 amendment 1).
//
// narrative-anchors.mjs lives under .claude/scripts/docs/, where DOC-A (ADR-1501, tests/docs/no-walker.mjs) forbids a child
// process: a spawned process can list files for us. So every spawn, every spine read and every look at the main clone is here,
// and the gate imports this file with a dynamic import() only on the paths that need it (the tracked list, --request-accept,
// --accept). Nothing here lists a directory.
//
// Exports: gitTrackedList, mainCloneOf, ownerSpine, readSpineEvents, requestAcceptApproval, verifyAcceptApproval, proofArms.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HQ = join(HERE, "..");
const CORE = join(HERE, "..", "..", "core");

/**
 * Every git-tracked path, from ONE bounded `git ls-files -z` (attack b8707be B5): a gitignored file that exists on this
 * box is absent from a clean checkout, so disk presence is not the CI verdict. Refuses, loudly, when git cannot answer.
 * @param {string} root @returns {Set<string>}
 */
export function gitTrackedList(root) {
  try {
    const out = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000, stdio: ["ignore", "pipe", "pipe"] });
    return new Set(out.split("\0").filter(Boolean));
  } catch (e) {
    throw new Error(`git ls-files failed in ${root} (${String(/** @type {Error} */ (e).message).split("\n")[0]}); the drift check judges paths against the git-tracked list and will not guess`);
  }
}

/**
 * The main clone, from git's common dir the way spine-io's assertNotLinkedWorktree finds it: in a linked worktree the
 * common dir's parent IS the main clone, and in the main clone itself it is the clone. "" when git cannot say.
 * @param {string} cwd
 */
export function mainCloneOf(cwd) {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return common ? dirname(common) : "";
  } catch { return ""; }
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
 * Where the owner's spine is, and which arc-event writes to it. A linked worktree refuses the spine (WORKTREE_SPINE) and the
 * canonical spine is in the main clone, so both the read and the request go there. ARC_SPINE_ROOT, the existing TEST door,
 * names the spine instead and skips the lookup; set but empty is refused, never read as "no spine named".
 * @param {string} root the tree this ran against
 * @returns {{ spine: string, arcEvent: string, cwd: string, main: string, why: string }}
 */
export function ownerSpine(root) {
  const none = { spine: "", arcEvent: "", cwd: "", main: "", why: "" };
  if ("ARC_SPINE_ROOT" in process.env) {
    const named = String(process.env.ARC_SPINE_ROOT ?? "");
    if (named.trim() === "") return { ...none, why: "ARC_SPINE_ROOT is set but empty; unset it or name a spine" };
    return { spine: resolve(named), arcEvent: join(HQ, "arc-event.mjs"), cwd: root, main: "", why: "" };
  }
  const main = mainCloneOf(root);
  if (!main) return { ...none, why: "git cannot say where the main clone is, so the owner's spine cannot be found" };
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
 * @param {any} payload the approval.requested payload (requestPayload's) @param {{ root: string }} opts
 * @returns {Promise<{ id: string, main: string, why: string }>}
 */
export async function requestAcceptApproval(payload, opts) {
  const os = ownerSpine(opts.root);
  if (os.why) return { id: "", main: "", why: os.why };
  const { emitReceipt } = await import(pathToFileURL(join(CORE, "plan-expect.mjs")).href);
  const r = emitReceipt(os.arcEvent, "approval.requested", payload, { cwd: os.cwd, env: { ...process.env }, timeoutMs: 60_000 });
  if (r.state !== "landed") return { id: "", main: os.main, why: `the spine ${r.state === "refused" ? "refused" : "may or may not have taken"} the request: ${r.why}` };
  if (!r.id) return { id: "", main: os.main, why: String(r.why) };
  return { id: r.id, main: os.main, why: "" };
}

/**
 * Why `ulid` is not the owner's decided approval for this page at this text, or "" when it is. The judgement itself is the
 * gate's own pure approvalProblem, handed in as opts.judge so the rule has one home.
 * @param {{ ulid: string, page: string, sha256: string, opts: { root: string, judge: (events: any[], approval: unknown, page: string, hash: string) => string } }} a
 * @returns {Promise<string>}
 */
export async function verifyAcceptApproval({ ulid, page, sha256, opts }) {
  const os = ownerSpine(opts.root);
  if (os.why) return os.why;
  const sp = await readSpineEvents(os.spine);
  if (sp.why) return sp.why;
  return opts.judge(sp.events, ulid, page, sha256);
}

/**
 * The self-test arms that need a process, the spine or a git repository, run against the REAL functions above and the gate's
 * own, handed in. Returns [name, ok] pairs; the caller counts and prints them like its own arms.
 * @param {any} d the gate's pure pieces and fixtures: good, wiki, ACCEPT_GATE, sha256, requestPayload, approvalProblem, evaluate,
 *   trackedIn, isTopDir, script (the gate's own path)
 * @returns {Promise<[string, boolean][]>}
 */
export async function proofArms(d) {
  /** @type {[string, boolean][]} */ const out = [];
  const has = (/** @type {{ fails: string[] }} */ r, /** @type {string} */ tag) => r.fails.some((f) => f.startsWith(tag));
  const { good, wiki, ACCEPT_GATE, sha256, requestPayload, approvalProblem, evaluate, trackedIn, isTopDir } = d;
  const HG = sha256(good);
  // B5: a gitignored file that exists on this box is not in the tracked list, so it FAILs; a tracked one passes.
  const box = mkdtempSync(join(tmpdir(), "narr-r2-"));
  const bare = mkdtempSync(join(tmpdir(), "narr-nogit-"));
  const ceiling = process.env.GIT_CEILING_DIRECTORIES;
  try {
    mkdirSync(join(box, "docs"), { recursive: true });
    const boxReal = realpathSync(box);
    execFileSync("git", ["init", "-q"], { cwd: box });
    writeFileSync(join(box, ".gitignore"), "docs/ignored.md\n");
    writeFileSync(join(box, "docs", "kept.md"), "x");
    writeFileSync(join(box, "docs", "ignored.md"), "x");
    execFileSync("git", ["add", ".gitignore", "docs/kept.md"], { cwd: box });
    const list = gitTrackedList(box);
    const gtree = { adrs: new Set(), wiki, tracked: trackedIn(list, box, boxReal), read: () => "", isDir: (/** @type {string} */ s) => isTopDir(box, s) };
    const grun = (/** @type {string} */ text) => evaluate({ narratives: { "products/hq": text }, accepted: {}, proofs: {}, tree: gtree });
    out.push(["MUTANT B5 tracked: a gitignored file present on disk FAILs the drift check; a git-tracked one passes",
      existsSync(join(box, "docs", "ignored.md")) && list.has("docs/kept.md") && !list.has("docs/ignored.md")
      && has(grun("It keeps `docs/ignored.md` here.\n"), "[drift]") && !has(grun("It keeps `docs/kept.md` here.\n"), "[drift]")]);
    process.env.GIT_CEILING_DIRECTORIES = dirname(bare);
    let refusal = "";
    try { gitTrackedList(bare); } catch (e) { refusal = /** @type {Error} */ (e).message; }
    out.push(["MUTANT B5 no git: a directory git cannot list is refused with a message naming git ls-files, never a silent pass",
      refusal.includes("git ls-files") && refusal.includes("will not guess")]);
  } finally {
    if (ceiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES; else process.env.GIT_CEILING_DIRECTORIES = ceiling;
    rmSync(box, { recursive: true, force: true });
    rmSync(bare, { recursive: true, force: true });
  }
  const spine = mkdtempSync(join(tmpdir(), "narr-spine-"));
  const priorSpine = process.env.ARC_SPINE_ROOT;
  try {
    mkdirSync(join(spine, "events"));
    process.env.ARC_SPINE_ROOT = spine;
    const inbox = (/** @type {string} */ verb, /** @type {string} */ id) => spawnSync(process.execPath, [join(HQ, "arc-inbox.mjs"), verb, id, "--reason", "read it"], { encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: spine } });
    const asked = requestPayload(["products/hq", "lanes/x"], { "products/hq": good, "lanes/x": `${good}\nlane\n` });
    const got = await requestAcceptApproval(asked.payload, { root: spine });
    const read0 = await readSpineEvents(spine);
    const undecided = approvalProblem(read0.events, got.id, "products/hq", HG);
    const ap = inbox("approve", got.id);
    const read1 = await readSpineEvents(spine);
    const approved = approvalProblem(read1.events, got.id, "products/hq", HG);
    const second = approvalProblem(read1.events, got.id, "lanes/x", sha256(`${good}\nlane\n`));
    const afterEdit = approvalProblem(read1.events, got.id, "products/hq", sha256(`${good}\nedited after approval\n`));
    // The same door the CLI uses: verifyAcceptApproval reads the named spine and judges with the gate's own rule.
    const opts = { root: spine, judge: approvalProblem };
    const viaDoor = await verifyAcceptApproval({ ulid: got.id, page: "products/hq", sha256: HG, opts });
    const viaDoorEdited = await verifyAcceptApproval({ ulid: got.id, page: "products/hq", sha256: sha256(`${good}\nedited\n`), opts });
    const got2 = await requestAcceptApproval(requestPayload(["products/hq"], { "products/hq": good }).payload, { root: spine });
    const rj = inbox("reject", got2.id);
    const rejected = approvalProblem((await readSpineEvents(spine)).events, got2.id, "products/hq", HG);
    out.push(["MUTANT B6 real spine: request -> undecided refused -> arc-inbox approve -> accepted for every listed page -> edit the page -> hash mismatch refused; a rejected request stays refused",
      got.why === "" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(got.id) && undecided.includes("not decided yet") && ap.status === 0 && approved === "" && second === ""
      && afterEdit.includes("edited after") && viaDoor === "" && viaDoorEdited.includes("edited after") && got2.why === "" && rj.status === 0 && rejected.includes("rejected")]);
    const named = ownerSpine("x").spine === resolve(spine);
    process.env.ARC_SPINE_ROOT = "";
    const emptyDoor = ownerSpine(spine).why !== "" && (await requestAcceptApproval(asked.payload, { root: spine })).why !== "";
    process.env.ARC_SPINE_ROOT = spine;
    out.push(["MUTANT B6 request: an unknown page, a repeat and an empty list are refused before anything is emitted; the test door names the spine, and an empty one is refused",
      requestPayload(["products/nope"], {}).problem !== "" && requestPayload(["products/hq", "products/hq"], { "products/hq": good }).problem !== "" && requestPayload([], {}).problem !== ""
      && asked.payload.gate === ACCEPT_GATE && asked.payload.pages.length === 2 && asked.payload.pages[0].sha256 === HG && named && emptyDoor]);
  } finally {
    if (priorSpine === undefined) delete process.env.ARC_SPINE_ROOT; else process.env.ARC_SPINE_ROOT = priorSpine;
    rmSync(spine, { recursive: true, force: true });
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
  } finally { rmSync(cli, { recursive: true, force: true }); }
  const repo = mkdtempSync(join(tmpdir(), "narr-main-"));
  const wt = `${repo}-wt`;
  try {
    const g = (/** @type {string[]} */ a, /** @type {string} */ cwd) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...a], { cwd, stdio: "ignore" });
    g(["init", "-q"], repo);
    g(["commit", "-q", "--allow-empty", "-m", "x"], repo);
    g(["worktree", "add", "-q", "--detach", wt], repo);
    out.push(["main clone: from a linked worktree git's common dir names the main clone, and from the clone itself the same one",
      samePlace(mainCloneOf(wt), repo) && samePlace(mainCloneOf(repo), repo)]);
  } finally { rmSync(wt, { recursive: true, force: true }); rmSync(repo, { recursive: true, force: true }); }
  return out;
}

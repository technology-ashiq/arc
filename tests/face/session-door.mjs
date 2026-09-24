#!/usr/bin/env node
// session-door.mjs -- the SESSION door's contract suite (face v2 Phase 06; REQ-08, ADR-1326 · ADR-1339).
//
// What it holds, per exit criterion 1 of phase-06-spec.md:
//   A. DRIVER-ONLY, every row. Each of the 15 face-sessions rows is started through createSessionDoor with a recording
//      spawn, and the recorded argv must be `node <tree>/.claude/scripts/engine/arc-run.mjs --process <row's process>
//      --driver <name>`, list-built. The row count is asserted, so a registry that shrinks cannot pass on fewer.
//   B. THE MUTANTS the check must FAIL: a harness binary as the command (claude, codex, hermes), a harness named as a
//      stray argument, a joined argv (a flag and its value in one slot), --driver missing, --driver empty, a driver that
//      is not one.
//   C. CLICK-STARTED ONLY, at the door: no token, a spent token, an expired token, a forged token -- each refused with
//      CLICK_REQUIRED and 0 spawns; list() and read() spawn nothing.
//   D. NO SESSION STATE IN THE DOOR. A door in ANOTHER process starts a real run (a fake arc-run on a scratch tree, which
//      prints phase lines and writes a real receipt with arc-event) and exits at once. A fresh door here attaches: the
//      run is still there, its lines stream in the order written, it ends as "ended" (no door saw the end), and its
//      receipt is read back off the spine by the id the run printed.
//   E. THE ROUTES, through arc-dash in sim mode: the registry is served, a start with no click is 428 CLICK_REQUIRED,
//      a start without Origin is refused, and a sim start on a paid driver is SIM_SPEND after its click was spent.
//
// VACUOUS-PASS GUARD: each part proves its fixture seeded before judging it, and the last line is "RAN: <n> checks",
// which the bats wrapper requires -- a suite that dies half-way cannot read green.

import { spawn, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PORT = 8435;
const TOKEN = "session-door-token";
const ORIGIN = `http://127.0.0.1:${PORT}`;
const EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");

const SESS = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "face-sessions.mjs")).href);
const DOOR = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "session-door.mjs")).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const codeOf = (fn) => { try { fn(); return null; } catch (e) { return /** @type {any} */ (e).code || String(e); } };

const tmp = mkdtempSync(join(tmpdir(), "face-session-door-"));
const SPINE = join(tmp, "spine");
mkdirSync(join(SPINE, "events"), { recursive: true });
// The fake arc-run and every child the door starts write to THIS spine, never the machine's.
process.env.ARC_SPINE_ROOT = SPINE;

// ---- the scratch tree: a fake arc-run, and a process file for every row, so no row refuses NO_PROCESS ----
const TREE = join(tmp, "tree");
mkdirSync(join(TREE, ".claude", "scripts", "engine"), { recursive: true });
mkdirSync(join(TREE, "processes"), { recursive: true });
const RELEASE = join(tmp, "release");
process.env.SESSION_FIXTURE_EVENT = EVENT;
process.env.SESSION_FIXTURE_RELEASE = RELEASE;
// It prints two phase lines, writes a real note.logged through arc-event, names it the way arc-run names its receipt,
// then waits for the suite to release it -- so the suite can attach while it is provably still running.
writeFileSync(join(TREE, ".claude", "scripts", "engine", "arc-run.mjs"), [
  "import { spawnSync } from \"node:child_process\";",
  "import { existsSync } from \"node:fs\";",
  "console.log(\"phase: one -- \" + process.argv.slice(2).join(\" | \"));",
  "console.log(\"phase: two\");",
  "const r = spawnSync(process.execPath, [process.env.SESSION_FIXTURE_EVENT, \"emit\", \"note.logged\", \"--payload\", JSON.stringify({ note: \"session-fixture\" })], { encoding: \"utf8\" });",
  "const id = String(r.stdout).trim().split(/\\r?\\n/).pop();",
  "console.error(\"arc-run: receipt note.logged \" + id);",
  "const until = Date.now() + 20000;",
  "while (!existsSync(process.env.SESSION_FIXTURE_RELEASE) && Date.now() < until) await new Promise((res) => setTimeout(res, 50));",
  "console.log(\"phase: three\");",
  "",
].join("\n"));
for (const s of SESS.SESSIONS) if (s.process) writeFileSync(join(TREE, "processes", `${s.process}.process.yaml`), `name: ${s.process}\n`);
const DRIVERS = ["claude-code", "codex", "generic-api", "hermes", "mock"];
check("fixture: the scratch tree holds a fake arc-run and a process file per row (vacuous-pass guard)",
  existsSync(join(TREE, ".claude", "scripts", "engine", "arc-run.mjs")) && SESS.SESSIONS.filter((s) => s.process).every((s) => existsSync(join(TREE, "processes", `${s.process}.process.yaml`))));

/** A spawn that starts nothing and records what it was asked to start. */
function recorder() {
  const calls = [];
  const fake = (file, args, opts) => {
    calls.push({ file, args, opts });
    const child = new EventEmitter();
    Object.assign(child, { pid: 999999, unref() {} });
    return child;
  };
  return { calls, spawn: /** @type {any} */ (fake) };
}
const inputFor = (s) => Object.fromEntries(s.fields.filter((f) => f.required).map((f) => [f.name, f.name === "lane" ? "face" : f.name === "phase" ? "06" : f.name === "url" ? "http://localhost:3000" : "a question with spaces"]));

// ---- A. driver-only, every row ----
{
  check("registry: the 15 SESSION verbs of the Phase 05 probe, no fewer", SESS.SESSIONS.length === 15, `rows=${SESS.SESSIONS.length}`);
  const rec = recorder();
  const door = DOOR.createSessionDoor({ mode: "live", root: SPINE, repo: TREE, journalDir: join(tmp, "journal-a") }, { spawn: rec.spawn, drivers: DRIVERS });
  const arcRun = realpathSync(join(TREE, ".claude", "scripts", "engine", "arc-run.mjs"));
  let started = 0;
  for (const s of SESS.SESSIONS) {
    const body = { click: door.click().click, input: inputFor(s), driver: "auto", ...(s.pickProcess ? { process: SESS.SESSIONS.find((x) => x.process).process } : {}) };
    let out = null, err = null;
    try { out = door.start(s.id, body); } catch (e) { err = e; }
    const call = rec.calls[rec.calls.length - 1];
    const ok = !err && out && call && call.file === process.execPath && call.args[0] === arcRun
      && call.args[1] === "--process" && call.args[2] === (body.process || s.process) && call.args[3] === "--driver" && call.args[4] === "auto"
      && SESS.driverOnly({ script: "engine/arc-run.mjs", args: call.args.slice(1) }, DRIVERS) === null
      && call.opts.detached === true && call.opts.stdio[0] === "ignore";
    if (ok) started++;
    check(`${s.id}: starts node arc-run.mjs --process ${body.process || s.process} --driver auto, list-built and detached`, ok,
      err ? `${err.code}: ${err.message}` : JSON.stringify(call && call.args.slice(1, 5)));
  }
  check("every row reached a spawn (the loop above judged 15 real starts, not 15 refusals)", started === 15 && rec.calls.length === 15, `started=${started} spawns=${rec.calls.length}`);
  const sim = DOOR.createSessionDoor({ mode: "live", root: SPINE, repo: TREE, journalDir: join(tmp, "journal-a") }, { spawn: rec.spawn, drivers: DRIVERS });
  const words = sim.start("council.convene", { click: sim.click().click, input: { question: "should we --driver claude ship now" }, driver: "codex" });
  const wc = rec.calls[rec.calls.length - 1];
  check("the owner's words stay ONE value: a question holding a flag and a space is the --input JSON, never an argument; the named driver is the --driver value",
    words.state === "running" && wc.args.filter((a) => a === "--driver").length === 1 && JSON.parse(wc.args[6]).question === "should we --driver claude ship now" && wc.args[4] === "codex", JSON.stringify(wc.args.slice(1)));
}

// ---- B. the mutants driverOnly must FAIL ----
{
  const good = SESS.sessionCommand("review-diff", "auto", { base: "main" }, "some dir/with space");
  check("positive control: the real argv passes, a transcript path with a space included", SESS.driverOnly(good, DRIVERS) === null, SESS.driverOnly(good, DRIVERS) || "");
  const mutants = [
    ["the harness claude as the command", { script: "claude", args: ["-p", "review the diff"] }],
    ["the harness codex as the command", { script: "codex", args: ["exec", "review"] }],
    ["the harness hermes as the command", { script: "engine/drivers/hermes.sh", args: good.args }],
    ["the harness named as a stray argument", { script: "engine/arc-run.mjs", args: [...good.args, "claude"] }],
    ["a joined argv: flag and value in one slot", { script: "engine/arc-run.mjs", args: ["--process review-diff --driver auto"] }],
    ["a joined argv: two words in the --driver slot", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", "auto --dry-run"] }],
    ["--driver missing", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--input", "{}"] }],
    ["--driver empty", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", ""] }],
    ["--driver naming no driver", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", "bash"] }],
    ["--process given twice", { script: "engine/arc-run.mjs", args: [...good.args, "--process", "kickoff-plan"] }],
    ["a flag with no value", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", "auto", "--input"] }],
    ["--input that is no JSON object", { script: "engine/arc-run.mjs", args: ["--process", "review-diff", "--driver", "auto", "--input", "[1]"] }],
  ];
  for (const [name, cmd] of mutants) check(`MUTANT FAILs driver-only: ${name}`, SESS.driverOnly(cmd, DRIVERS) !== null);
}

// ---- C. click-started only, at the door ----
{
  const rec = recorder();
  let t = 1_000_000;
  const door = DOOR.createSessionDoor({ mode: "live", root: SPINE, repo: TREE, journalDir: join(tmp, "journal-c") }, { spawn: rec.spawn, drivers: DRIVERS, now: () => t });
  const row = "review-ship.review";
  check("no token: CLICK_REQUIRED", codeOf(() => door.start(row, { input: {} })) === "CLICK_REQUIRED");
  check("a forged token of the right shape: CLICK_REQUIRED", codeOf(() => door.start(row, { click: "A".repeat(24), input: {} })) === "CLICK_REQUIRED");
  const c1 = door.click().click;
  check("a token spent once starts once", codeOf(() => door.start(row, { click: c1, input: {} })) === null && rec.calls.length === 1, `spawns=${rec.calls.length}`);
  check("the same token replayed: CLICK_REQUIRED, no second spawn", codeOf(() => door.start(row, { click: c1, input: {} })) === "CLICK_REQUIRED" && rec.calls.length === 1);
  const c2 = door.click().click;
  t += 61_000;
  check("an expired token: CLICK_REQUIRED", codeOf(() => door.start(row, { click: c2, input: {} })) === "CLICK_REQUIRED" && rec.calls.length === 1);
  const c3 = door.click().click;
  check("a bad body still SPENDS its click: one click can never be retried into two starts",
    codeOf(() => door.start(row, { click: c3, input: { nope: "x" } })) === "BAD_INPUT" && codeOf(() => door.start(row, { click: c3, input: {} })) === "CLICK_REQUIRED" && rec.calls.length === 1);
  door.list();
  check("list() spawns nothing", rec.calls.length === 1);
  const c4 = door.click().click;
  check("a row whose process is not on the tree is NOT SHIPPABLE, named", (() => {
    const bare = DOOR.createSessionDoor({ mode: "live", root: SPINE, repo: REPO, journalDir: join(tmp, "journal-c2") }, { spawn: rec.spawn, drivers: DRIVERS, now: () => t });
    const code = codeOf(() => bare.start("review-ship.qa", { click: bare.click().click, input: { url: "http://localhost:3000" } }));
    return code === "NO_PROCESS" && rec.calls.length === 1;
  })());
  check("a sim door runs a session on the mock driver or not at all", (() => {
    const sim = DOOR.createSessionDoor({ mode: "sim", root: SPINE, repo: TREE, journalDir: join(tmp, "journal-c3") }, { spawn: rec.spawn, drivers: DRIVERS, now: () => t });
    return codeOf(() => sim.start(row, { click: sim.click().click, input: {}, driver: "auto" })) === "SIM_SPEND" && rec.calls.length === 1;
  })());
  check("dispatch takes only a process on this tree", codeOf(() => door.start("executor.dispatch", { click: c4, input: {}, process: "../../etc" })) === "NO_PROCESS" && rec.calls.length === 1);
}

// ---- D. no session state in the door: start in one process, attach from another ----
{
  const JOURNAL = join(tmp, "journal-d");
  const starter = join(tmp, "door-a.mjs");
  writeFileSync(starter, [
    `const DOOR = await import(${JSON.stringify(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "session-door.mjs")).href)});`,
    `const door = DOOR.createSessionDoor({ mode: "live", root: ${JSON.stringify(SPINE)}, repo: ${JSON.stringify(TREE)}, journalDir: ${JSON.stringify(JOURNAL)} }, { drivers: ${JSON.stringify(DRIVERS)} });`,
    "const out = door.start(\"review-ship.review\", { click: door.click().click, input: { base: \"main\" }, driver: \"mock\" });",
    "console.log(JSON.stringify(out));",
    "process.exit(0);",
    "",
  ].join("\n"));
  const a = spawnSync(process.execPath, [starter], { cwd: REPO, encoding: "utf8", env: process.env, timeout: 30_000 });
  let started = null;
  try { started = JSON.parse(String(a.stdout).trim().split(/\r?\n/).pop()); } catch { /* checked below */ }
  check("door A started a session and EXITED (vacuous-pass guard)", a.status === 0 && started && /^[A-Za-z0-9_-]{16}$/.test(started.sid), `${a.status} ${a.stderr}`);
  if (started) {
    const b = DOOR.createSessionDoor({ mode: "live", root: SPINE, repo: TREE, journalDir: JOURNAL }, { drivers: DRIVERS });
    let mid = null;
    for (let i = 0; i < 200; i++) {
      mid = await b.read(started.sid);
      if (mid.lines.some((l) => l.startsWith("arc-run: receipt"))) break;
      await sleep(50);
    }
    check("a FRESH door attaches to the run door A started, while it runs", mid && mid.state === "running" && mid.session === "review-ship.review", JSON.stringify(mid && { state: mid.state, lines: mid.lines }));
    check("the command it shows is arc-run with --process and --driver", mid && mid.command[1] === ".claude/scripts/engine/arc-run.mjs" && mid.command[2] === "--process" && mid.command[4] === "--driver" && mid.command[5] === "mock", JSON.stringify(mid && mid.command));
    writeFileSync(RELEASE, "go");
    let end = null;
    for (let i = 0; i < 200; i++) {
      end = await b.read(started.sid);
      if (end.state !== "running") break;
      await sleep(50);
    }
    const idx = (p) => end.lines.findIndex((l) => l.startsWith(p));
    check("the lines stream in the order the run wrote them, stdout and stderr in one file",
      end && idx("phase: one") >= 0 && idx("phase: one") < idx("phase: two") && idx("phase: two") < idx("arc-run: receipt") && idx("arc-run: receipt") < idx("phase: three"), JSON.stringify(end && end.lines));
    check("no door saw the end, and the attach says so rather than inventing an exit", end && end.state === "ended" && end.exit === null && typeof end.note === "string", JSON.stringify(end && { state: end.state, exit: end.exit }));
    const printed = (end.lines.find((l) => l.startsWith("arc-run: receipt")) || "").split(" ").pop();
    check("its receipt is read back OFF THE SPINE by the id the run printed", end.receipts.length === 1 && end.receipts[0].id === printed && end.receipts[0].kind === "note.logged" && end.receipts[0].named === true, JSON.stringify(end.receipts));
    const listed = b.list().runs.find((r) => r.sid === started.sid);
    check("the run is on the fresh door's list, read from disk", listed && listed.session === "review-ship.review");
  }
  const c = DOOR.createSessionDoor({ mode: "live", root: SPINE, repo: TREE, journalDir: JOURNAL }, { drivers: DRIVERS });
  check("attach refuses an id that is not a session id, and one that is not on disk",
    (await c.read("../../etc").then(() => null, (e) => e.code)) === "BAD_RUN_ID" && (await c.read("AAAAAAAAAAAAAAAA").then(() => null, (e) => e.code)) === "UNKNOWN_RUN");
}

// ---- E. the routes, through arc-dash in sim mode ----
{
  const dash = spawn(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--spine", SPINE, "--port", String(PORT)],
    { cwd: REPO, env: { ...process.env, ARC_SPINE_ROOT: "", ARC_DASH_TOKEN: TOKEN, ARC_DASH_JOURNAL_DIR: join(tmp, "journal-e") }, stdio: ["ignore", "ignore", "pipe"] });
  let doorErr = "";
  dash.stderr.on("data", (c) => { doorErr += c; });
  const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
  const j = async (path, opts = {}) => {
    const r = await fetch(`http://127.0.0.1:${PORT}${path}`, opts);
    let body; try { body = await r.json(); } catch { body = {}; }
    return { status: r.status, body };
  };
  const post = (path, body, extra = {}) => j(path, { method: "POST", headers: { ...H, ...extra }, body: JSON.stringify(body) });
  let up = false;
  for (let i = 0; i < 100 && !up; i++) { try { up = (await j("/api/health", { headers: H })).status === 200; } catch { await sleep(100); } }
  check("the door came up in sim mode (vacuous-pass guard)", up, doorErr);
  if (up) {
    const list = await j("/api/sessions", { headers: H });
    check("GET /api/sessions serves the 15 rows", list.status === 200 && list.body.sessions.length === 15, `${list.status}`);
    const none = await post("/api/session/review-ship.review/start", { input: {} }, { Origin: ORIGIN });
    check("a start with no click is 428 CLICK_REQUIRED", none.status === 428 && none.body.error === "CLICK_REQUIRED", `${none.status} ${none.body.error}`);
    const tok = await j("/api/session-click", { method: "POST", headers: H });
    check("a click token is minted", tok.status === 200 && typeof tok.body.click === "string", `${tok.status}`);
    const noOrigin = await post("/api/session/review-ship.review/start", { click: tok.body.click, input: {} });
    check("a start without Origin is refused before anything runs", noOrigin.status === 403 && noOrigin.body.error === "NO_ORIGIN", `${noOrigin.status} ${noOrigin.body.error}`);
    const tok2 = await j("/api/session-click", { method: "POST", headers: H });
    const paid = await post("/api/session/review-ship.review/start", { click: tok2.body.click, input: {}, driver: "auto" }, { Origin: ORIGIN });
    check("a sim start on a paid driver is SIM_SPEND", paid.status === 403 && paid.body.error === "SIM_SPEND", `${paid.status} ${paid.body.error}`);
    const again = await post("/api/session/review-ship.review/start", { click: tok2.body.click, input: {}, driver: "mock" }, { Origin: ORIGIN });
    check("...and its click was spent: the same token again is CLICK_REQUIRED", again.status === 428, `${again.status} ${again.body.error}`);
  }
  dash.kill();
}

console.log(`RAN: ${ran} checks`);
process.exit(failed === 0 && ran >= 40 ? 0 : 1);

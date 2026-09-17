#!/usr/bin/env node
// harness-run.mjs -- the browser steel thread, end to end, in ONE node process (ADR-1336):
//   fixture spine -> arc dash in sim mode -> vite preview over face/dist -> smoke.mjs.
//
// Why one process: the suite runs on Linux, macOS and Windows, and three children started from
// a bats file are three chances to leak a port or a process on the Windows runner. Here every
// child is spawned with node's own spawn and killed in a `finally`, on every path.
//
// Preconditions (the bats suite does these first, visibly): `npm ci` and `vite build` in a COPY
// of face/ (so node_modules never lands in the repo tree other suites walk), passed as --face.
// This script refuses to start without them rather than building quietly.
//
// Both moods run by default, one after the other against the same door and preview (face v2
// Phase 01, ADR-1331): light is never a later batch, so a light run is never optional here.
//
// Usage: harness-run.mjs [--face DIR] [--exclude id,id] [--moods dark,light]
// Exit:  0 smoke passed in every mood · 1 a mood failed · 2 setup failed (no dist, door or preview never up).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { spawnTracked, isDead, deathReason, stopTree, removeDir, delay } from "./proc.mjs";
import { findChrome } from "./cdp.mjs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSmoke, summaryLines, judge, openableRooms, redactSecrets, SetupError, MOODS } from "./smoke.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FACE_DEFAULT = resolve(HERE, "..");
const REPO = resolve(FACE_DEFAULT, "..");

export function parseArgs(argv) {
  const opts = { exclude: [], face: FACE_DEFAULT, moods: [...MOODS] };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if ((a === "--exclude" || a === "--face" || a === "--moods") && v !== undefined && !v.startsWith("--")) {
      if (seen.has(a)) throw new SetupError(`${a} given twice -- which one is meant is not a guess`);
      if (v.trim() === "") throw new SetupError(`${a} has an empty value (an empty --face would resolve to the current directory)`);
      seen.add(a);
      i++;
      if (a === "--exclude") opts.exclude = v.split(",").map((s) => s.trim()).filter(Boolean);
      else if (a === "--moods") {
        const moods = v.split(",").map((s) => s.trim());
        const bad = moods.filter((m) => !MOODS.includes(m));
        if (bad.length || moods.length === 0) throw new SetupError(`--moods takes ${MOODS.join(",")}, got ${JSON.stringify(v)}`);
        if (new Set(moods).size !== moods.length) throw new SetupError(`--moods names a mood twice: ${JSON.stringify(v)}`);
        opts.moods = moods;
      }
      else opts.face = v;
      continue;
    }
    throw new SetupError(`unknown or incomplete argument ${JSON.stringify(a)} (flags: --exclude id,id, --face DIR, --moods dark,light)`);
  }
  return opts;
}

/** The rooms the door SHOULD serve as openable, read from the contract file, not the door. */
export function expectedOpenable(repo = REPO) {
  const file = join(repo, "initiatives", "face", "contracts", "rooms.generated.json");
  let payload;
  try { payload = JSON.parse(readFileSync(file, "utf8")); }
  catch (e) { throw new SetupError(`cannot read the expected room set at ${file}: ${e.message}`); }
  return openableRooms(payload).openable;
}

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", rej);
    srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => res(port)); });
  });
}

function start(label, args, opts) {
  const child = spawnTracked(process.execPath, args, opts);
  child.label = label;
  return child;
}

// The door prints its own open URL and token to stderr, so a tail bound for the error -- and the
// public CI log -- has the token taken out first.
async function waitHttp(url, headers, child, capMs, secrets) {
  const started = Date.now();
  while (Date.now() - started < capMs) {
    if (isDead(child)) throw new SetupError(`${child.label} ${deathReason(child)} before answering ${url}: ${redactSecrets(child.stderrTail(), secrets).slice(-600)}`);
    try {
      const r = await fetch(url, { headers });
      if (r.status === 200) { await r.arrayBuffer(); return; }
      await r.arrayBuffer();
    } catch { /* not up yet */ }
    await delay(200);
  }
  throw new SetupError(`${child.label} did not answer ${url} with 200 within ${capMs} ms: ${redactSecrets(child.stderrTail(), secrets).slice(-600)}`);
}

export async function runHarness(opts, log = (l) => process.stdout.write(l + "\n")) {
  log(`face-browser: RAN leg=${process.platform}/${process.version} image=${process.env.ImageOS ?? "local"}${process.env.ImageVersion ? `@${process.env.ImageVersion}` : ""}`);
  const FACE = resolve(opts.face);
  if (!existsSync(join(FACE, "dist", "index.html"))) throw new SetupError(`${join(FACE, "dist", "index.html")} is missing -- run npm ci and vite build there first`);
  const vitePkg = join(FACE, "node_modules", "vite", "package.json");
  if (!existsSync(vitePkg)) throw new SetupError(`${vitePkg} is missing -- run npm ci in ${FACE} first`);
  const viteBin = join(FACE, "node_modules", "vite", JSON.parse(readFileSync(vitePkg, "utf8")).bin.vite);
  // The cheapest precondition first: no Chrome means no smoke, so fail before spending up to
  // 50 s starting a fixture, a door and a preview (fixed-defects.md, cheap checks first).
  const chrome = findChrome();
  if (!chrome.path) throw new SetupError(`Chrome not found. Looked at: ${chrome.tried.join(" | ")}`);
  const expected = expectedOpenable();

  const tmp = mkdtempSync(join(tmpdir(), "face-browser-"));
  const spine = join(tmp, "spine");
  const token = `face-browser-${process.pid}`;
  let door = null;
  let preview = null;
  try {
    const gen = JSON.parse(execFileSync(process.execPath,
      [join(REPO, "tests", "fixtures", "face", "gen-spine.mjs"), "--out", spine, "--count", "2000", "--days", "10", "--seed", "face-browser-1"],
      { stdio: ["ignore", "pipe", "pipe"] }).toString("utf8"));
    if (!(gen.events > 0)) throw new SetupError(`fixture spine generated no events: ${JSON.stringify(gen)}`);
    log(`fixture: events=${gen.events}`);

    const doorPort = await freePort();
    door = start("arc-dash", [join(REPO, ".claude", "scripts", "hq", "arc-dash.mjs"), "--spine", spine, "--port", String(doorPort)],
      { cwd: REPO, env: { ...process.env, ARC_DASH_TOKEN: token, ARC_DASH_JOURNAL_DIR: join(tmp, "journal") } });
    const headers = { Authorization: `Bearer ${token}` };
    await waitHttp(`http://127.0.0.1:${doorPort}/api/health`, headers, door, 20000, [token]);
    log(`door: up on ${doorPort}`);

    const appPort = await freePort();
    preview = start("vite preview", [viteBin, "preview", "--port", String(appPort), "--strictPort", "--host", "127.0.0.1"],
      { cwd: FACE, env: { ...process.env, ARC_DASH_ORIGIN: `http://127.0.0.1:${doorPort}`, ARC_FACE_APP_PORT: String(appPort) } });
    await waitHttp(`http://127.0.0.1:${appPort}/api/health`, headers, preview, 30000, [token]);
    log(`preview: up on ${appPort}, /api/health answers 200 through its proxy`);

    // Every mood runs even after one fails: the second mood's evidence is still evidence.
    let failedMoods = 0;
    for (const mood of opts.moods ?? MOODS) {
      log(`face-browser: mood=${mood}`);
      const report = await runSmoke({
        base: `http://127.0.0.1:${appPort}/`,
        door: `http://127.0.0.1:${doorPort}`,
        token,
        exclude: opts.exclude,
        expected,
        roomTimeoutMs: 15000,
        mood,
      }, log);
      for (const line of summaryLines(report)) log(line);
      log(`SMOKE_REPORT ${JSON.stringify({ ...report, errors: undefined, rooms: undefined })}`);
      const verdict = judge(report);
      if (!verdict.ok) { failedMoods++; log(`smoke: FAIL mood=${mood} -- ${verdict.reasons.join("; ")}`); }
    }
    return failedMoods === 0 ? 0 : 1;
  } finally {
    await stopTree(preview);
    await stopTree(door);
    await removeDir(tmp, "harness-run");
  }
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) {
  (async () => {
    try {
      process.exitCode = await runHarness(parseArgs(process.argv.slice(2)));
    } catch (e) {
      console.error(`harness-run: ${e instanceof SetupError ? "" : "unexpected: "}${e.message}`);
      process.exitCode = 2;
    }
  })();
}

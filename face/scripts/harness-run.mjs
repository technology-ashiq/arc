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
// Usage: harness-run.mjs [--face DIR] [--exclude id,id]
// Exit:  0 smoke passed · 1 smoke failed · 2 setup failed (no dist, door or preview never up).
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, realpathSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSmoke, summaryLines, judge, SetupError } from "./smoke.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FACE_DEFAULT = resolve(HERE, "..");
const REPO = resolve(FACE_DEFAULT, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseArgs(argv) {
  const opts = { exclude: [], face: FACE_DEFAULT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--exclude" && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) {
      opts.exclude = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (argv[i] === "--face" && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) {
      opts.face = argv[++i];
      continue;
    }
    throw new SetupError(`unknown or incomplete argument ${JSON.stringify(argv[i])} (flags: --exclude id,id, --face DIR)`);
  }
  return opts;
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
  const child = spawn(process.execPath, args, { ...opts, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  let tail = "";
  child.stderr.on("data", (d) => { tail = (tail + d.toString("utf8")).slice(-3000); });
  child.label = label;
  child.tail = () => tail.trim();
  return child;
}

async function waitHttp(url, headers, child, capMs) {
  const started = Date.now();
  while (Date.now() - started < capMs) {
    if (child.exitCode !== null) throw new SetupError(`${child.label} exited (${child.exitCode}) before answering ${url}: ${child.tail().slice(-600)}`);
    try {
      const r = await fetch(url, { headers });
      if (r.status === 200) { await r.arrayBuffer(); return; }
      await r.arrayBuffer();
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new SetupError(`${child.label} did not answer ${url} with 200 within ${capMs} ms: ${child.tail().slice(-600)}`);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([new Promise((r) => child.once("exit", r)), sleep(5000)]);
}

export async function runHarness(opts, log = (l) => process.stdout.write(l + "\n")) {
  log(`face-browser: RAN leg=${process.platform}/${process.version} image=${process.env.ImageOS ?? "local"}${process.env.ImageVersion ? `@${process.env.ImageVersion}` : ""}`);
  const FACE = resolve(opts.face);
  if (!existsSync(join(FACE, "dist", "index.html"))) throw new SetupError(`${join(FACE, "dist", "index.html")} is missing -- run npm ci and vite build there first`);
  const vitePkg = join(FACE, "node_modules", "vite", "package.json");
  if (!existsSync(vitePkg)) throw new SetupError(`${vitePkg} is missing -- run npm ci in ${FACE} first`);
  const viteBin = join(FACE, "node_modules", "vite", JSON.parse(readFileSync(vitePkg, "utf8")).bin.vite);

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
      { env: { ...process.env, ARC_DASH_TOKEN: token, ARC_DASH_JOURNAL_DIR: join(tmp, "journal") } });
    const headers = { Authorization: `Bearer ${token}` };
    await waitHttp(`http://127.0.0.1:${doorPort}/api/health`, headers, door, 20000);
    log(`door: up on ${doorPort}`);

    const appPort = await freePort();
    preview = start("vite preview", [viteBin, "preview", "--port", String(appPort), "--strictPort", "--host", "127.0.0.1"],
      { cwd: FACE, env: { ...process.env, ARC_DASH_ORIGIN: `http://127.0.0.1:${doorPort}`, ARC_FACE_APP_PORT: String(appPort) } });
    await waitHttp(`http://127.0.0.1:${appPort}/api/health`, headers, preview, 30000);
    log(`preview: up on ${appPort}, /api/health answers 200 through its proxy`);

    const report = await runSmoke({
      base: `http://127.0.0.1:${appPort}/`,
      door: `http://127.0.0.1:${doorPort}`,
      token,
      exclude: opts.exclude,
      roomTimeoutMs: 15000,
    }, log);
    for (const line of summaryLines(report)) log(line);
    log(`SMOKE_REPORT ${JSON.stringify({ ...report, errors: undefined, rooms: undefined })}`);
    const verdict = judge(report);
    if (!verdict.ok) log(`smoke: FAIL -- ${verdict.reasons.join("; ")}`);
    return verdict.ok ? 0 : 1;
  } finally {
    await stop(preview);
    await stop(door);
    for (let i = 0; i < 5; i++) {
      try { rmSync(tmp, { recursive: true, force: true }); break; } catch { await sleep(300); }
    }
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

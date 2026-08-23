#!/usr/bin/env node
// arc-face -- start the whole HQ with one command, and hand back one URL.
//
// WHY THIS EXISTS. Phase 08 asks the owner to run every decision through the face for five
// consecutive days. Before this file, each of those mornings cost him:
//
//   1. node .claude/scripts/hq/arc-dash.mjs        (and read a random 32-char token off stderr)
//   2. cd face && npm ci && npm run dev            (a second terminal, and a first-run install)
//   3. open http://localhost:5180/#token=<paste that token by hand>
//
// Step 3 is the one that ends dogfoods. A freshly generated token every boot means the owner
// hand-copies a secret into a URL bar before he can look at his own company, and a product
// that charges an entry fee gets used on day one and skipped on day three. The requirement
// would then fail for a reason that has nothing to do with whether the face is any good.
//
// So the launcher OWNS the token instead of reading it back: it generates one, hands it to
// the door through the environment, and therefore already knows what the app URL is.
//
//   node .claude/scripts/hq/arc-face.mjs
//
// Exit: 0 clean shutdown | 1 a child refused to start (the reason is named) | 2 bad arguments.
//
// LAYERING. This starts L2 and L3; it is not part of either. It spawns them as processes and
// reads nothing out of the app's source, so the one-way dependency ADR-1316 protects is
// intact and the repo split stays a directory move.

import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

/** "Was this file RUN, or imported?" -- realpath BOTH sides; the endsWith form no-ops behind a rename. */
function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");

export const DOOR_PORT = 8317;
export const APP_PORT = 5180;

/**
 * The environment variable the app's dev proxy reads to find the door.
 *
 * It is exported so a test can pin it against the app's own config, because getting it wrong
 * fails in the worst available way: the launcher wrote `ARC_DASH_URL`, the proxy read
 * `ARC_DASH_ORIGIN`, found nothing, and fell back to the DEFAULT door port -- where a door
 * from an earlier session happened to be listening. The app came up, served 200, and every
 * read went to somebody else's spine. A typo that produced a connection error would have been
 * kinder; this one produced a working page showing the wrong company.
 */
export const DOOR_ORIGIN_ENV = "ARC_DASH_ORIGIN";

/**
 * The environment variable the app's dev config reads for its OWN port.
 *
 * Same seam, same reason, found by the same kind of attack. `--app-port` used to move the
 * listener while `vite.config.ts` kept its origin allow-list pinned to the default 5180, so
 * the browser's real Origin was passed through unrewritten and the door refused it: every
 * read worked and every stamp 403'd. And in the other direction, whatever else happened to be
 * running on 5180 became a trusted origin for an HQ that was not there.
 */
export const APP_PORT_ENV = "ARC_FACE_APP_PORT";

/**
 * npm is `npm.cmd` on Windows and `npm` everywhere else.
 *
 * Knowing the NAME is not enough to run it, which is the whole point of the next function.
 * Since Node 18.20.2 / 20.12.2 (the CVE-2024-27980 fix) spawn() REFUSES a `.cmd` or `.bat`
 * target unless `shell: true` is set, and it refuses with `EINVAL` -- an error that names
 * nothing and reads like a bug in the launcher. This was not theoretical: the first cut of
 * this file spawned `npm.cmd run dev` and died exactly there, after the door had already
 * come up cleanly.
 *
 * So this name is used ONLY for `npm ci`, which runs once, is spawned through a shell,
 * and whose arguments are fixed literals -- no interpolated value ever reaches that command
 * string. The dev server, which runs every boot, does not go near it.
 *
 * @param {string} platform @returns {string}
 */
export function npmBin(platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

/**
 * How to start the app's dev server, decided as data so it can be tested without starting one.
 *
 * The rule it encodes: **spawn node, never a shim.** Vite ships its own JS entry point, so
 * running `node <...>/vite/bin/vite.js` is identical on all three legs, needs no shell, and
 * cannot hit the `.cmd` refusal above. The npm shim buys nothing here and costs a platform.
 *
 * An absent entry point is reported BY NAME rather than left to surface as a spawn error,
 * because "vite is not installed" and "the launcher is broken" look the same from EINVAL.
 *
 * @param {string} faceDir @param {number} appPort @param {(p: string) => boolean} exists
 * @returns {{ cmd: string, args: string[], shell: false }}
 */
export function appSpawnPlan(faceDir, appPort, exists = existsSync) {
  const entry = join(faceDir, "node_modules", "vite", "bin", "vite.js");
  if (!exists(entry))
    throw new Error(`no dev server at ${entry} -- the app's dependencies are incomplete. Delete face/node_modules and let this launcher reinstall them.`);
  return { cmd: process.execPath, args: [entry, "--port", String(appPort), "--strictPort"], shell: false };
}

/**
 * The URL the owner actually opens.
 *
 * The token rides in the FRAGMENT, never the query string. A fragment is not sent to any
 * server, does not appear in an access log, and does not survive into a Referer header --
 * which is the whole reason arc-dash hands it over that way, and the reason this must not
 * "simplify" it into `?token=`.
 *
 * @param {number} appPort @param {string} token @returns {string}
 */
export function appUrl(appPort, token) {
  if (!token || typeof token !== "string")
    throw new Error("appUrl: refusing to compose a URL with no token -- it would open a page that 401s and looks broken");
  return `http://localhost:${appPort}/#token=${encodeURIComponent(token)}`;
}

/**
 * The door's argv. The token is NOT here: it goes through the environment.
 *
 * argv is world-readable in a process list; a per-user environment is not. The token is a
 * localhost dev credential either way, but there is no reason to broadcast it for the whole
 * session when passing it invisibly costs nothing.
 *
 * HONEST CAVEAT, because this file used to claim more than it delivered. `openBrowser` DOES put
 * the token in argv -- it is a URL, and a URL is how you open a browser. An attacker pointed
 * out the contradiction and was right to. What makes the two different is lifetime, not
 * principle: the opener exists for about a second and then exits, while the door holds its argv
 * for as long as the HQ is up. Shrinking the window from hours to a second is worth doing and
 * is not the same as closing it, and `--no-open` closes it completely for anyone who wants that.
 *
 * @param {{ port: number, spine?: string | null }} opts @returns {string[]}
 */
export function doorArgs(opts) {
  const args = ["--port", String(opts.port)];
  if (opts.spine) args.push("--spine", opts.spine);
  return args;
}

/**
 * Is the door up, given what a probe came back with?
 *
 * `null` means the connection was refused -- not up YET, keep waiting. Any HTTP status at all
 * means something is listening and answering, INCLUDING 401. That case is the one worth
 * spelling out: a door that is up but disagrees about the token answers 401 forever, so a
 * readiness check that waits for 200 waits until it times out and then reports "the door
 * never started", which is false and sends you looking in the wrong place entirely.
 *
 * @param {number | null} status @returns {"waiting" | "ready" | "token-mismatch"}
 */
export function readyFromProbe(status) {
  if (status === null) return "waiting";
  if (status === 401 || status === 403) return "token-mismatch";
  return "ready";
}

/**
 * Turn a dead child into a sentence a person can act on.
 *
 * The default failure here is a confusing one: run this from a git WORKTREE and the door
 * refuses, correctly, because a worktree carries no canonical spine -- but the launcher would
 * otherwise report only "the door exited 1", which reads like a bug in the door.
 *
 * @param {number | null} code @param {string} stderrText @returns {string}
 */
export function classifyDoorExit(code, stderrText) {
  const err = String(stderrText || "");
  if (err.includes("WORKTREE_SPINE") || err.includes("worktree"))
    return "the door refuses a git worktree: live mode needs the MAIN clone, because a worktree carries no canonical spine. Run this from the main checkout, or pass --spine <fixture> to drive a sim door.";
  if (err.includes("BAD_SPINE"))
    // Deliberately does NOT name the spine's on-disk layout, for two reasons that agree.
    //
    // The layout is the door's business, not the launcher's: this file spawns two processes
    // and relays what they say, so a second, drifting description of the spine's directory
    // shape would be a copy waiting to go stale. And `spine-reader-lint` greps every tracked
    // hq module for exactly those tokens outside a comment -- correctly, since a string
    // literal CAN be a path, and it has caught a real planted bypass. Weakening a gate that
    // works, to keep a sentence the door already prints one line above, would be the wrong
    // trade in both directions. The door's own message stays visible; this one classifies it.
    return "the --spine path given is not a spine the door will accept (its own refusal is above). Point --spine at a real fixture, or drop the flag to use the canonical spine from the main clone.";
  if (err.includes("EADDRINUSE") || err.includes("address already in use"))
    return `something is already listening on the door's port. Another arc-dash is probably up; stop it, or pass --port <n>.`;
  if (err.includes("BAD_BIND"))
    return "the door is localhost-only by law (ADR-1312) and refused the bind address it was given.";
  return `the door exited ${code === null ? "on a signal" : `with code ${code}`}. Its own stderr is above.`;
}

const KNOWN_FLAGS = ["--port", "--app-port", "--spine", "--token", "--no-open", "--selftest", "--help"];

/**
 * Refuse an argument this launcher does not know.
 *
 * `argv.includes("--no-open")` means `--noopen`, `--No-Open` and `--no_open` all silently take
 * the OTHER branch and open a browser the caller asked it not to. Every gate in this repo
 * grew this guard after an adversarial pass showed four near-miss spellings each selecting a
 * behaviour the caller did not ask for.
 *
 * @param {string[]} argv @param {string[]} known
 */
export function refuseUnknownFlags(argv, known) {
  // SINGLE dash too. `--` only was the whole guard, so `-no-open` sailed through unrecognised
  // and then failed `argv.includes("--no-open")` -- accepted as an argument, ignored as a flag,
  // and a browser opened for a caller who asked it not to. The near-miss set is bigger than
  // the one spelling that was being checked for.
  const bad = argv.filter((a) => a.startsWith("-") && !known.includes(a));
  if (bad.length) {
    process.stderr.write(`arc-face: unknown flag(s) ${bad.join(", ")} -- known flags are ${known.join(", ")}. Refusing rather than guessing which behaviour you meant.\n`);
    process.exit(2);
  }
  // A REPEATED flag is an operator error, never a first-wins override. `--port 8620 --port
  // 8621` silently took 8620 and said nothing -- the same class of silent pick that
  // `.claude/rules/lanes.md` makes exit 5 for two `--lane` values, and for the same reason:
  // choosing one of two explicitly named values is precisely the guess a refusal prevents.
  const seen = new Set();
  for (const a of argv) {
    if (!a.startsWith("-")) continue;
    if (seen.has(a)) {
      process.stderr.write(`arc-face: ${a} was given more than once. Refusing rather than silently picking one of the values you named.\n`);
      process.exit(2);
    }
    seen.add(a);
  }
}

/**
 * A port, or a refusal. Never a silent NaN.
 *
 * `Number(flagValue(...) || DEFAULT)` forwarded `--port abc` to the door as NaN, which threw
 * ERR_SOCKET_BAD_PORT inside a child whose failure this launcher then reported as "the door
 * exited with code 0" -- two wrong sentences from one unvalidated word. `--port 70000` went
 * the same way.
 *
 * @param {string[]} argv @param {string} name @param {number} fallback @returns {number}
 */
function portValue(argv, name, fallback) {
  const raw = flagValue(argv, name);
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    process.stderr.write(`arc-face: ${name} ${raw} is not a port (want an integer 1-65535). Refusing rather than handing a child a value it will die on.
`);
    process.exit(2);
  }
  return n;
}

/** @param {string[]} argv @param {string} name @returns {string | null} */
function flagValue(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith("--")) {
    process.stderr.write(`arc-face: ${name} needs a value. An unquoted empty value silently eats the next flag.\n`);
    process.exit(2);
  }
  return v;
}

/**
 * One probe of the door's health route. Resolves to an HTTP status, or null if nothing answered.
 *
 * The body is DRAINED, never ignored. An unread `fetch` response holds its socket open in
 * undici's connection pool, and a launcher that polls twice a second builds up a pile of them
 * -- which on Windows turned a clean refusal into a libuv assertion (`UV_HANDLE_CLOSING`) and
 * exit code 127, so a correct, well-worded error message went out looking like a crash.
 */
async function probe(port, token) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await drain(res);
    return res.status;
  } catch { return null; }
}

/** Free a response's socket. Both branches are needed: a 204 has no body to cancel. */
async function drain(res) {
  try { if (res.body) await res.body.cancel(); else await res.arrayBuffer(); } catch { /* already gone */ }
}

/** Poll until the door answers, or give up with a reason rather than a hang. */
async function waitForDoor(port, token, child, stderrBuf, timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    if (child.exitCode !== null || child.signalCode !== null)
      return { ok: false, why: classifyDoorExit(child.exitCode, stderrBuf.text) };
    const verdict = readyFromProbe(await probe(port, token));
    if (verdict === "ready") return { ok: true };
    if (verdict === "token-mismatch")
      return { ok: false, why: "the door is up but rejected this launcher's token -- something else is already listening on that port with a token of its own. Stop it, or pass --port <n>." };
    if (Date.now() - started > timeoutMs)
      return { ok: false, why: `the door did not answer within ${Math.round(timeoutMs / 1000)}s. Its own stderr is above.` };
    await new Promise((r) => setTimeout(r, 200));
  }
}

/**
 * Is the app ready, given the two facts a poll can learn?
 *
 * THE BUG THIS EXISTS TO PREVENT, which this file shipped and which running it caught: the
 * first cut asked only "does the port answer?". A dev server left over from an earlier session
 * was still on that port, so it answered instantly, the launcher printed "HQ is up" and handed
 * over a URL pointing at a STRANGER's server -- while its own child was in the middle of dying
 * with "Port already in use".
 *
 * It is the twin-fix shape from CLAUDE.md, in a file ten minutes old: `waitForDoor` checks the
 * child's liveness before believing a probe, and its twin did not. The general rule is the one
 * the vacuous-pass rule states for tests -- **assert the thing RAN, not only that the output
 * looks right** -- and a port answering is output, not evidence about my child.
 *
 * Liveness alone still leaves a race (a freshly spawned child is alive for the second or so it
 * takes vite to notice the port is taken and exit), so the real close is the pre-flight in
 * `main`: refuse to start at all if something already answers there.
 *
 * @param {{ childAlive: boolean, portAnswers: boolean }} facts
 * @returns {"ready" | "waiting" | "child-died"}
 */
export function appReady(facts) {
  if (!facts.childAlive) return "child-died";
  return facts.portAnswers ? "ready" : "waiting";
}

/** Does anything at all answer on this port right now? Used both as a pre-flight and to poll. */
async function portAnswers(port) {
  try { const res = await fetch(`http://localhost:${port}/`); await drain(res); return true; } catch { return false; }
}

/** Poll until the app's dev server answers -- or until the child that should be serving it dies. */
async function waitForApp(port, child, stderrBuf, timeoutMs = 90000) {
  const started = Date.now();
  for (;;) {
    const alive = child.exitCode === null && child.signalCode === null;
    const verdict = appReady({ childAlive: alive, portAnswers: await portAnswers(port) });
    if (verdict === "ready") return { ok: true };
    if (verdict === "child-died")
      return { ok: false, why: `the app's dev server exited ${child.exitCode === null ? "on a signal" : `with code ${child.exitCode}`} before it began serving. Its own stderr is above.` };
    if (Date.now() - started > timeoutMs)
      return { ok: false, why: `the app's dev server did not answer within ${Math.round(timeoutMs / 1000)}s.` };
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** Collect a child's stderr while still showing it, so a failure can be classified afterwards. */
function teeStderr(child, prefix) {
  const buf = { text: "" };
  child.stderr?.on("data", (d) => {
    const s = String(d);
    buf.text += s;
    for (const line of s.split("\n")) if (line.trim()) process.stderr.write(`${prefix} ${line}\n`);
  });
  return buf;
}

async function main(argv) {
  const repo = REPO_DEFAULT;
  const faceDir = join(repo, "face");
  if (!existsSync(join(faceDir, "package.json"))) {
    process.stderr.write(`arc-face: ERROR -- no app at ${faceDir}. This launcher starts L2 and L3 together; without L3 there is nothing to open.\n`);
    return 1;
  }

  const doorPort = portValue(argv, "--port", DOOR_PORT);
  const appPort = portValue(argv, "--app-port", APP_PORT);
  const spine = flagValue(argv, "--spine");
  // The launcher OWNS the token so it can compose the URL. An explicit one still wins, and
  // an inherited ARC_DASH_TOKEN wins over a fresh one -- otherwise a session that deliberately
  // set a token would find the door running on a different one.
  const token = flagValue(argv, "--token") || process.env.ARC_DASH_TOKEN || randomBytes(24).toString("base64url");

  const children = [];

  // Stopping has to WAIT for the children to actually close, not merely ask them to.
  //
  // The first cut killed and exited in the same tick, and on Windows that aborted the process
  // with a libuv assertion (`UV_HANDLE_CLOSING` in async.c) and exit code 127 -- so a refusal
  // that had already printed the correct, helpful sentence went out looking like a crash, and
  // any caller reading the exit code got 127 where the contract says 1. Killing a child whose
  // stdio pipes are still being torn down and then exiting immediately is the race.
  const shutdown = () => Promise.all(children.map((c) => {
    if (c.exitCode !== null || c.signalCode !== null) return Promise.resolve();
    return new Promise((resolve) => {
      c.once("close", resolve);
      try { c.kill(); } catch { resolve(); return; }
      // A child that ignores the polite signal must not hold the launcher open forever.
      setTimeout(() => { try { c.kill("SIGKILL"); } catch { /* gone */ } resolve(); }, 3000).unref();
    });
  }));
  process.on("SIGINT", () => { shutdown().then(() => process.exit(0)); });
  process.on("SIGTERM", () => { shutdown().then(() => process.exit(0)); });

  // 1. BOTH ports, before anything expensive. Something already serving either one means this
  //    launcher cannot own the pair, and every later check is then answering about a stranger.
  //
  //    The app-port half was written first and the door half was NOT -- the same twin-fix miss
  //    this file already carries a scar for, in the twin that was supposedly the fixed one. An
  //    attacker put an impostor door on the port: `waitForDoor`'s liveness guard cannot fire on
  //    the first pass (a freshly spawned child has not started Node yet), `readyFromProbe`
  //    calls any status but 401/403 "ready", so the launcher printed HQ is up and handed over a
  //    URL whose app was wired to somebody else's spine -- labelled `"mode":"live"` -- with the
  //    one irreversible route stamping into it. With a 404-only impostor it never exited at all.
  //
  //    A pre-flight is the only check that can tell "my child owns this port" from "something
  //    answers here", because after the spawn the two are indistinguishable from outside.
  if (await portAnswers(appPort)) {
    process.stderr.write(`arc-face: ERROR -- something is already serving http://localhost:${appPort}/. That is probably an arc-face left running in another terminal; open it, stop it, or pass --app-port <n>. Starting a second one here would hand you a URL pointing at the wrong server.\n`);
    return 1;
  }
  if ((await probe(doorPort, token)) !== null) {
    process.stderr.write(`arc-face: ERROR -- something is already listening on http://127.0.0.1:${doorPort}/. This launcher cannot tell its own door from a stranger's once it has spawned one, so it refuses to start beside it: stop the other door, or pass --port <n>. A door that is not the one this launcher started would serve a different spine under the same URL.\n`);
    return 1;
  }

  // 2. The door, BEFORE the dependency install.
  //
  //    The order is deliberate and it used to be the other way round. The door's refusals are
  //    the common ones -- run from a worktree, a --spine with no events, a port already taken --
  //    and every one of them is instant. Downloading the app's dependencies first means paying
  //    a network install to reach a failure that was knowable in a second, which is exactly the
  //    friction this file exists to remove.
  const door = spawn(process.execPath, [join(HERE, "arc-dash.mjs"), ...doorArgs({ port: doorPort, spine })], {
    cwd: repo,
    env: { ...process.env, ARC_DASH_TOKEN: token },
    stdio: ["ignore", "inherit", "pipe"],
  });
  children.push(door);
  const doorErr = teeStderr(door, "  door |");
  const doorUp = await waitForDoor(doorPort, token, door, doorErr);
  if (!doorUp.ok) {
    await shutdown();
    process.stderr.write(`arc-face: ERROR -- ${doorUp.why}\n`);
    return 1;
  }

  // 3. Dependencies, now that the door has proven it can run. Announced, never silent: this
  //    reaches the network, and a command that quietly downloads things is one you stop
  //    trusting. It happens once, on the first morning.
  if (!existsSync(join(faceDir, "node_modules"))) {
    // `npm ci`, not `npm install`.
    //
    // The lockfile is TRACKED and in sync with package.json (57 packages, both checked), so
    // `ci` installs exactly what this branch was tested against instead of re-resolving version
    // ranges on the morning a five-day dogfood starts. It is also the loud option: if the two
    // ever disagree, `ci` says so, where a plain install would quietly resolve to a tree nobody
    // has run. Safe in this branch specifically because `ci` deletes node_modules first and
    // this is the one case where there is nothing to delete.
    process.stderr.write(`arc-face: the app has no dependencies installed yet -- running npm ci in face/ (once, from the tracked lockfile).\n`);
    // `shell: true` is required on Windows to run npm's .cmd shim at all. It is safe HERE and
    // only here: every argument is a fixed literal, so nothing interpolated reaches the
    // command string. `cwd` is an option, not part of it.
    const install = spawn(npmBin(process.platform), ["ci"], { cwd: faceDir, stdio: "inherit", shell: process.platform === "win32" });
    const code = await new Promise((r) => install.on("close", r));
    if (code !== 0) {
      await shutdown();
      process.stderr.write(`arc-face: ERROR -- npm ci exited ${code}. If it reports the lockfile is out of sync with package.json, that IS the problem -- a plain install would only hide it. The app cannot start without its dev server.\n`);
      return 1;
    }
  }

  // 4. The app.
  let plan;
  try { plan = appSpawnPlan(faceDir, appPort); }
  catch (err) { await shutdown(); process.stderr.write(`arc-face: ERROR -- ${err.message}\n`); return 1; }
  const app = spawn(plan.cmd, plan.args, {
    cwd: faceDir,
    env: { ...process.env, [DOOR_ORIGIN_ENV]: `http://127.0.0.1:${doorPort}`, [APP_PORT_ENV]: String(appPort) },
    stdio: ["ignore", "pipe", "pipe"],
    shell: plan.shell,
  });
  children.push(app);
  app.stdout?.on("data", () => { /* vite's banner names the wrong URL for this setup; ours is below */ });
  const appErr = teeStderr(app, "  app  |");
  const appUp = await waitForApp(appPort, app, appErr);
  if (!appUp.ok) {
    await shutdown();
    process.stderr.write(`arc-face: ERROR -- ${appUp.why}\n`);
    return 1;
  }

  // 4. The one line this whole file exists to print.
  const url = appUrl(appPort, token);
  process.stdout.write(`\narc-face: HQ is up.\n\n    ${url}\n\n`);
  process.stdout.write(`arc-face: the token is in the URL fragment, so it never reaches a server log. Ctrl-C stops both.\n`);
  if (!argv.includes("--no-open")) openBrowser(url);

  // Either child dying takes the whole thing down: a face with no door is a page of errors,
  // and a door with no face is a port nobody is looking at.
  const code = await new Promise((resolve) => {
    door.on("close", (c) => { shutdown().then(() => resolve(c === 0 ? 0 : 1)); });
    app.on("close", (c) => { shutdown().then(() => resolve(c === 0 ? 0 : 1)); });
  });
  return code;
}

/**
 * Best-effort. A browser that does not open is a mild annoyance; the URL is already printed.
 *
 * The token is in this argv for the life of the opener process -- a second or so. See doorArgs
 * for why that is a different trade from the door's, and `--no-open` for the way out.
 */
function openBrowser(url) {
  const cmd = process.platform === "win32" ? "explorer.exe"
    : process.platform === "darwin" ? "open" : "xdg-open";
  try { spawn(cmd, [url], { stdio: "ignore", detached: true }).unref(); } catch { /* the URL is printed above */ }
}

/** The negative control: every decision this launcher makes, exercised without starting anything. */
function selftest() {
  const lines = [];
  let ok = true;
  const armed = (label, cond, detail = "") => {
    if (!cond) ok = false;
    lines.push(`${label.padEnd(56)} ${cond ? "PASS" : `FAIL ${detail}`}`);
  };

  armed("npm is npm.cmd on Windows", npmBin("win32") === "npm.cmd");
  armed("and plain npm everywhere else", npmBin("linux") === "npm" && npmBin("darwin") === "npm");

  // THE ARM THAT WOULD HAVE CAUGHT THE SHIPPED BUG. The first cut spawned `npm.cmd run dev`
  // with no shell; Node refuses a .cmd target that way since the CVE-2024-27980 fix and dies
  // with a bare EINVAL, after the door has already come up. The fix is not "add a shell" --
  // it is to stop going through a shim at all and run node against vite's own entry point.
  const plan = appSpawnPlan("/repo/face", 5180, () => true);
  armed("the app is started by running NODE, not a shim", plan.cmd === process.execPath);
  armed("and never a .cmd/.bat target (EINVAL on Windows)", !/[.](cmd|bat)$/i.test(plan.cmd) && !plan.args.some((a) => /[.](cmd|bat)$/i.test(a)));
  armed("with no shell, so nothing is re-parsed as a command", plan.shell === false);
  armed("it runs vite's own JS entry point", plan.args[0].endsWith("vite.js"));
  armed("on the port it was asked for", plan.args.includes("--port") && plan.args.includes("5180"));
  // --strictPort matters: without it vite silently picks the NEXT free port, and the URL this
  // launcher prints -- built from the port it asked for -- would then be wrong, which reads as
  // "the face is broken" rather than "it is one port over".
  armed("and refuses to drift to another port", plan.args.includes("--strictPort"));
  let namedMissing = false;
  try { appSpawnPlan("/repo/face", 5180, () => false); } catch (e) { namedMissing = /dependencies are incomplete/.test(e.message); }
  armed("a missing dev server is NAMED, not left to EINVAL", namedMissing);

  const url = appUrl(5180, "abc123");
  armed("the token rides in the FRAGMENT, not the query", url.includes("/#token=") && !url.includes("?token="));
  armed("and the app URL points at the APP port, not the door", url.includes(":5180/"));
  let refusedEmpty = false;
  try { appUrl(5180, ""); } catch { refusedEmpty = true; }
  armed("an empty token is refused, not composed into a 401", refusedEmpty);

  const args = doorArgs({ port: 8317, spine: null });
  armed("door argv carries the port", args.join(" ") === "--port 8317");
  armed("the token is NOT in the door's argv", !doorArgs({ port: 8317 }).includes("--token"));
  armed("a sim spine is passed through", doorArgs({ port: 8317, spine: "/tmp/fix" }).join(" ") === "--port 8317 --spine /tmp/fix");

  // The arm that earns its keep. Waiting for a 200 that will never arrive reports "the door
  // never started" after a full timeout -- a false statement, about the wrong component.
  armed("a refused connection means keep waiting", readyFromProbe(null) === "waiting");
  armed("200 means ready", readyFromProbe(200) === "ready");
  armed("401 means UP-but-token-mismatch, never 'still starting'", readyFromProbe(401) === "token-mismatch");
  armed("500 still means something is listening", readyFromProbe(500) === "ready");

  // The twin. A port answering says nothing about WHOSE server answered, so the child's
  // liveness is checked first -- the fix that waitForDoor had and its twin did not.
  armed("a live child + a serving port is ready", appReady({ childAlive: true, portAnswers: true }) === "ready");
  armed("a live child + a silent port is still starting", appReady({ childAlive: true, portAnswers: false }) === "waiting");
  armed("a DEAD child is reported, never waited out", appReady({ childAlive: false, portAnswers: false }) === "child-died");
  armed("and a dead child does not pass because the port answers", appReady({ childAlive: false, portAnswers: true }) === "child-died");

  armed("a worktree refusal is named as such", classifyDoorExit(1, "arc-dash: ERROR WORKTREE_SPINE -- ...").includes("MAIN clone"));
  armed("a busy port is named as such", classifyDoorExit(1, "Error: listen EADDRINUSE").includes("already listening"));
  armed("an unknown death still says the exit code", classifyDoorExit(7, "something else").includes("code 7"));
  armed("and a signal death is not reported as code null", classifyDoorExit(null, "").includes("on a signal"));

  for (const l of lines) process.stdout.write(l + "\n");
  process.stdout.write(`arc-face selftest: ${ok ? "PASS -- the startup decisions hold without starting anything" : "FAIL"}\n`);
  return ok ? 0 : 1;
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  refuseUnknownFlags(argv, KNOWN_FLAGS);
  if (argv.includes("--help")) {
    process.stdout.write(`arc-face -- start the door and the app together, and print one URL.\n\n  node .claude/scripts/hq/arc-face.mjs [--port ${DOOR_PORT}] [--app-port ${APP_PORT}] [--spine <dir>] [--token <t>] [--no-open]\n\nLive mode needs the MAIN clone; a worktree carries no canonical spine. Use --spine for a fixture.\n`);
    process.exit(0);
  }
  if (argv.includes("--selftest")) process.exit(selftest());
  // Set the code and let the loop DRAIN; do not call process.exit().
  //
  // Exiting explicitly raced libuv's own teardown on Windows and aborted the process with
  // `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` and exit code 127 -- so a refusal
  // whose message was already correct and helpful went out looking like a crash, and any
  // caller reading the code got 127 where the contract promises 1. The narrowing took four
  // wrong guesses (the .cmd shim, the response bodies, the kill, the awaited close) before a
  // minimal reproduction showed the exit call itself was the ingredient.
  //
  // The bail-out below is unref'd on purpose: it cannot hold the loop open, so a clean drain
  // still exits instantly -- but if some handle refuses to release, the launcher exits with
  // the right code instead of hanging, which for a start-my-day command is the worse failure.
  main(argv).then((code) => {
    process.exitCode = code;
    setTimeout(() => process.exit(code), 2000).unref();
  }).catch((err) => {
    process.stderr.write(`arc-face: ERROR -- ${err.message}\n`);
    process.exit(1);
  });
}

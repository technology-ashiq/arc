#!/usr/bin/env node
// smoke.mjs -- open every openable room the door serves in a real headless Chrome and count
// console errors and exceptions. Ported from the owner's v0.7 `scripts/smoke.mjs` (ADR-1330):
// the same three error sources (Runtime.exceptionThrown, console error|warning, Log error
// entries) and the same fresh navigation per room, with the environment changes ADR-1335
// forces declared rather than hidden:
//   - Chrome is found per OS (cdp.mjs findChrome), never a hardcoded Windows path;
//   - the socket is cdp.mjs's own RFC 6455 client, never Node's global WebSocket;
//   - the room list comes from the door's /api/rooms, never a hand list (ADR-1306);
//   - "opened" means the page's `section[data-room]` names the room asked for, polled with a
//     hard cap -- never a fixed sleep -- and a room settles when its network goes quiet.
//
// Usage:
//   smoke.mjs --base URL --door URL --token T [--exclude id,id] [--room-timeout-ms N]
//   smoke.mjs --probe-file PATH       open one local page; exit 1 if it logged any error
// Exit: 0 every openable room opened with 0 counted errors · 1 a room failed, or the probe saw
//       errors · 2 setup failure (bad argument, no Chrome, door unreachable).
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  findChrome, chromeArgs, launchChrome, waitForDevTools, openSocket, CdpSession, openPage,
} from "./cdp.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class SetupError extends Error {}

export function parseArgs(argv) {
  const opts = { base: null, door: null, token: null, exclude: [], roomTimeoutMs: 15000, probeFile: null };
  const VALUE = new Set(["--base", "--door", "--token", "--exclude", "--room-timeout-ms", "--probe-file"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!VALUE.has(a)) throw new SetupError(`unknown argument ${JSON.stringify(a)}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new SetupError(`${a} needs a value`);
    i++;
    if (a === "--base") opts.base = v;
    else if (a === "--door") opts.door = v;
    else if (a === "--token") opts.token = v;
    else if (a === "--exclude") opts.exclude = v.split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--probe-file") opts.probeFile = v;
    else if (a === "--room-timeout-ms") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1000) throw new SetupError(`--room-timeout-ms must be an integer >= 1000, got ${v}`);
      opts.roomTimeoutMs = n;
    }
  }
  if (opts.probeFile === null) {
    for (const k of ["base", "door", "token"]) if (!opts[k]) throw new SetupError(`--${k} is required`);
  }
  return opts;
}

/** Rooms the harness must open: every served entry that is not a template. */
export function openableRooms(payload) {
  const rooms = payload && Array.isArray(payload.rooms) ? payload.rooms : null;
  if (!rooms) throw new SetupError("the door's /api/rooms answered without a `rooms` array");
  const openable = rooms.filter((r) => r && typeof r.id === "string" && r.status !== "template").map((r) => r.id);
  const notOpened = rooms.filter((r) => r && r.status === "template").map((r) => r.id);
  return { openable, notOpened };
}

/** The verdict, from the report alone -- so a stub report can be judged by the same rule. */
export function judge(report) {
  const reasons = [];
  if (!(report.openable > 0)) reasons.push(`openable=${report.openable}: nothing was checked`);
  if (report.opened !== report.openable) reasons.push(`opened=${report.opened} of openable=${report.openable}`);
  if (report.countedErrors !== 0) reasons.push(`countedErrors=${report.countedErrors}`);
  return { ok: reasons.length === 0, reasons };
}

export function summaryLines(report) {
  return [
    `smoke: opened=${report.opened} openable=${report.openable} errors=${report.countedErrors} excluded-errors=${report.excludedErrors} not-opened=${report.notOpened.join(",") || "none"}`,
    `face-browser: ${report.opened}/${report.openable} rooms · ${report.consoleErrors} console errors · ${report.exceptions} exceptions · chrome=${report.chrome}`,
  ];
}

async function withChrome(fn) {
  const found = findChrome();
  if (!found.path) throw new SetupError(`Chrome not found. Looked at:\n  ${found.tried.join("\n  ")}`);
  const userDataDir = mkdtempSync(join(tmpdir(), "face-smoke-"));
  const child = launchChrome(found.path, chromeArgs({ userDataDir }));
  let session = null;
  try {
    const wsUrl = await waitForDevTools(userDataDir, child);
    session = new CdpSession(await openSocket(wsUrl));
    return await fn(session, found);
  } finally {
    try { session?.close(); } catch { /* already closed */ }
    child.kill();
    await Promise.race([new Promise((r) => child.once("exit", r)), sleep(5000)]);
    for (let i = 0; i < 5; i++) {
      try { rmSync(userDataDir, { recursive: true, force: true }); break; } catch { await sleep(300); }
    }
  }
}

function collectErrors(page, errors, current) {
  page.on("Runtime.exceptionThrown", (p) => errors.push({ room: current.room, type: "exception",
    text: String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "").slice(0, 300) }));
  page.on("Runtime.consoleAPICalled", (p) => {
    if (p.type !== "error" && p.type !== "warning") return;
    const text = (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300);
    errors.push({ room: current.room, type: `console.${p.type}`, text });
  });
  page.on("Log.entryAdded", (p) => {
    if (p.entry?.level === "error") errors.push({ room: current.room, type: "log", text: String(p.entry.text ?? "").slice(0, 300) });
  });
}

/** Wait until `predicate()` is true, polling, with a hard cap. Returns whether it became true. */
async function until(predicate, capMs, pollMs = 100) {
  const started = Date.now();
  while (Date.now() - started < capMs) {
    if (await predicate()) return true;
    await sleep(pollMs);
  }
  return false;
}

export async function runSmoke(opts, log = (line) => process.stdout.write(line + "\n")) {
  const headers = { Authorization: `Bearer ${opts.token}` };
  let payload;
  try {
    const res = await fetch(new URL("/api/rooms", opts.door), { headers });
    if (res.status !== 200) throw new SetupError(`door answered /api/rooms with HTTP ${res.status}`);
    payload = await res.json();
  } catch (e) {
    throw e instanceof SetupError ? e : new SetupError(`door unreachable at ${opts.door}: ${e.message}`);
  }
  const { openable, notOpened } = openableRooms(payload);

  return withChrome(async (session, found) => {
    const page = await openPage(session);
    const errors = [];
    const current = { room: "boot" };
    collectErrors(page, errors, current);
    const inflight = new Set();
    let lastNetworkChange = Date.now();
    page.on("Network.requestWillBeSent", (p) => { inflight.add(p.requestId); lastNetworkChange = Date.now(); });
    const done = (p) => { inflight.delete(p.requestId); lastNetworkChange = Date.now(); };
    page.on("Network.loadingFinished", done);
    page.on("Network.loadingFailed", done);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Log.enable");
    await page.send("Network.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

    const rooms = [];
    for (let i = 0; i < openable.length; i++) {
      const id = openable[i];
      current.room = id;
      const before = errors.length;
      const url = `${opts.base}?r=${i}#/${encodeURIComponent(id)}&token=${encodeURIComponent(opts.token)}`;
      await page.send("Page.navigate", { url });
      const rendered = async () => {
        const r = await page.send("Runtime.evaluate", {
          expression: `(document.querySelector("section[data-room]") || {}).getAttribute ? document.querySelector("section[data-room]").getAttribute("data-room") : null`,
          returnByValue: true,
        });
        return r.result?.value === id;
      };
      const opened = await until(rendered, opts.roomTimeoutMs);
      const settled = opened && await until(async () => inflight.size === 0 && Date.now() - lastNetworkChange >= 300, 10000);
      const newErrors = errors.length - before;
      rooms.push({ id, opened, settled, newErrors });
      log(`${opened && newErrors === 0 ? "ok" : "XX"} ${id}${opened ? "" : " (did not render)"}${settled || !opened ? "" : " (network never went quiet)"}${newErrors ? ` errors=${newErrors}` : ""}`);
    }

    const excluded = new Set(opts.exclude);
    const counted = errors.filter((e) => !excluded.has(e.room));
    const report = {
      chrome: found.path,
      chromeSource: found.source,
      openable: openable.length,
      opened: rooms.filter((r) => r.opened).length,
      notOpened,
      countedErrors: counted.length,
      excludedErrors: errors.length - counted.length,
      consoleErrors: counted.filter((e) => e.type !== "exception").length,
      exceptions: counted.filter((e) => e.type === "exception").length,
      unsettled: rooms.filter((r) => r.opened && !r.settled).map((r) => r.id),
      rooms,
      errors: errors.slice(0, 50),
    };
    for (const e of errors.slice(0, 20)) log(`  [${e.room}] ${e.type}: ${e.text}`);
    return report;
  });
}

export async function runProbe(file, log = (line) => process.stdout.write(line + "\n")) {
  return withChrome(async (session, found) => {
    const page = await openPage(session);
    const errors = [];
    const current = { room: "probe" };
    collectErrors(page, errors, current);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Log.enable");
    await page.send("Page.navigate", { url: pathToFileURL(file).href });
    // The planted page logs synchronously and throws on a 50 ms timer: wait for the first error,
    // then give the second one a short, bounded chance to arrive so both paths are reported.
    if (await until(() => errors.length > 0, 8000)) await until(() => errors.length > 1, 2000);
    for (const e of errors) log(`  [probe] ${e.type}: ${e.text}`);
    log(`probe: errors=${errors.length} chrome=${found.path}`);
    return errors.length;
  });
}

async function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { console.error(`smoke: ${e.message}`); return 2; }
  try {
    if (opts.probeFile !== null) return (await runProbe(opts.probeFile)) > 0 ? 1 : 0;
    const report = await runSmoke(opts);
    for (const line of summaryLines(report)) console.log(line);
    console.log(`SMOKE_REPORT ${JSON.stringify({ ...report, errors: undefined, rooms: undefined })}`);
    const verdict = judge(report);
    if (!verdict.ok) console.log(`smoke: FAIL -- ${verdict.reasons.join("; ")}`);
    return verdict.ok ? 0 : 1;
  } catch (e) {
    console.error(`smoke: ${e instanceof SetupError ? "" : "unexpected: "}${e.message}`);
    return 2;
  }
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });

#!/usr/bin/env node
// smoke.mjs -- open every openable room the door serves in a real headless Chrome and count
// console errors and exceptions. Ported from the owner's v0.7 `scripts/smoke.mjs` (ADR-1330):
// the same three error sources (Runtime.exceptionThrown, console error|warning, Log error
// entries), the same fresh navigation per room, and at least v0.7's 900 ms of watching after a
// room renders. The environment changes ADR-1335 forces are declared, not hidden:
//   - Chrome is found per OS (cdp.mjs findChrome), never a hardcoded Windows path;
//   - the socket is cdp.mjs's own RFC 6455 client, never Node's global WebSocket;
//   - the room list comes from the door's /api/rooms (ADR-1306) and, when the caller supplies
//     the expected set (harness-run reads it from rooms.generated.json), the door's set must
//     EQUAL it -- a door that regresses to one room is not a clean run;
//   - "opened" means `section[data-room]` names the room asked for, polled with a hard cap; a
//     room settles when 900 ms have passed since it rendered AND its network has been quiet
//     for 300 ms. A room that never settles FAILS, and the last room gets the same drain.
//
// Usage:
//   smoke.mjs --base URL --door URL --token T [--exclude id,id] [--room-timeout-ms N]
//   smoke.mjs --probe-file PATH       open one local page; exit 1 if it logged any error
// Exit: 0 every expected room opened, settled, with 0 counted errors · 1 a room failed, or the
//       probe saw errors · 2 setup failure (bad argument, no Chrome, door unreachable).
import { mkdtempSync, realpathSync } from "node:fs";
import { stopTree, removeDir, delay } from "./proc.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  findChrome, chromeArgs, launchChrome, waitForDevTools, openSocket, CdpSession, openPage,
} from "./cdp.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const MIN_WATCH_MS = 900;
export const QUIET_MS = 300;
export const THREE_CLOCK = /THREE\.Clock/;

export class SetupError extends Error {}

export function parseArgs(argv) {
  const opts = { base: null, door: null, token: null, exclude: [], roomTimeoutMs: 15000, probeFile: null };
  const VALUE = new Set(["--base", "--door", "--token", "--exclude", "--room-timeout-ms", "--probe-file"]);
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!VALUE.has(a)) throw new SetupError(`unknown argument ${JSON.stringify(a)}`);
    if (seen.has(a)) throw new SetupError(`${a} given twice -- which one is meant is not a guess`);
    seen.add(a);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new SetupError(`${a} needs a value`);
    if (v.trim() === "") throw new SetupError(`${a} has an empty value`);
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
  if (opts.probeFile !== null) {
    const mixed = [...seen].filter((f) => f !== "--probe-file");
    if (mixed.length) throw new SetupError(`--probe-file runs alone; it would ignore ${mixed.join(", ")}`);
  } else {
    for (const k of ["base", "door", "token"]) if (!opts[k]) throw new SetupError(`--${k} is required`);
  }
  return opts;
}

/**
 * Rooms the harness must open: every served entry that is not a template. A malformed entry,
 * a missing id or status, or a duplicate id is a setup error naming its index -- never an entry
 * that silently lands in neither list.
 */
export function openableRooms(payload) {
  const rooms = payload && Array.isArray(payload.rooms) ? payload.rooms : null;
  if (!rooms) throw new SetupError("the rooms payload has no `rooms` array");
  const openable = [];
  const notOpened = [];
  const seen = new Set();
  rooms.forEach((r, i) => {
    if (!r || typeof r !== "object") throw new SetupError(`rooms[${i}] is not an object`);
    if (typeof r.id !== "string" || r.id.trim() === "") throw new SetupError(`rooms[${i}] has no string id`);
    if (typeof r.status !== "string" || r.status === "") throw new SetupError(`rooms[${i}] (${r.id}) has no status`);
    if (seen.has(r.id)) throw new SetupError(`rooms[${i}] repeats id ${JSON.stringify(r.id)}`);
    seen.add(r.id);
    (r.status === "template" ? notOpened : openable).push(r.id);
  });
  return { openable, notOpened };
}

const isCount = (n) => Number.isInteger(n) && n >= 0;

/** The verdict, from the report alone -- so a stub report is judged by the same rule. */
export function judge(report) {
  const reasons = [];
  if (!isCount(report.openable) || report.openable === 0) reasons.push(`openable=${report.openable}: nothing was checked`);
  if (!isCount(report.opened) || report.opened !== report.openable) reasons.push(`opened=${report.opened} of openable=${report.openable}`);
  if (!isCount(report.countedErrors) || report.countedErrors !== 0) reasons.push(`countedErrors=${report.countedErrors}`);
  if (!Array.isArray(report.unsettled)) reasons.push("unsettled is not reported");
  else if (report.unsettled.length) reasons.push(`never settled: ${report.unsettled.join(",")}`);
  if (Array.isArray(report.missingFromDoor) && report.missingFromDoor.length) reasons.push(`expected but not served: ${report.missingFromDoor.join(",")}`);
  if (Array.isArray(report.unexpectedFromDoor) && report.unexpectedFromDoor.length) reasons.push(`served but not expected: ${report.unexpectedFromDoor.join(",")}`);
  return { ok: reasons.length === 0, reasons };
}

export function summaryLines(report) {
  return [
    `smoke: opened=${report.opened} openable=${report.openable} errors=${report.countedErrors} excluded-errors=${report.excludedErrors} unsettled=${report.unsettled.length} expected=${report.expected ?? "not-given"} not-opened=${report.notOpened.join(",") || "none"}`,
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
    let wsUrl;
    try { wsUrl = await waitForDevTools(userDataDir, child); }
    catch (e) { throw new SetupError(`${e.message} (chrome=${found.path}, source=${found.source})`); }
    session = new CdpSession(await openSocket(wsUrl));
    return await fn(session, found);
  } finally {
    // Ask Chrome to close itself first (it takes its helpers with it), then stop the whole
    // process tree with escalation, then remove the profile -- loudly if it will not go.
    if (session && !session.closed) {
      await Promise.race([session.send("Browser.close").catch(() => {}), delay(2000)]);
    }
    try { session?.close(); } catch { /* already closed */ }
    await stopTree(child);
    await removeDir(userDataDir, "smoke");
  }
}

function collectErrors(page, errors, current) {
  page.on("Runtime.exceptionThrown", (p) => errors.push({ room: current.room, type: "exception",
    text: String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "").slice(0, 300) }));
  page.on("Runtime.consoleAPICalled", (p) => {
    if (p.type !== "error" && p.type !== "warning") return;
    const text = (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300);
    // v0.7's own smoke ignores exactly this line, a three.js deprecation notice the face's stage
    // prints on every load; the frozen string is kept as the reference wrote it (ADR-1330).
    if (THREE_CLOCK.test(text)) return;
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
  const unknownExcludes = (opts.exclude ?? []).filter((id) => !openable.includes(id));
  if (unknownExcludes.length) throw new SetupError(`--exclude names rooms the door does not serve as openable: ${unknownExcludes.join(",")}`);

  return withChrome(async (session, found) => {
    const page = await openPage(session);
    const errors = [];
    const current = { room: "boot" };
    collectErrors(page, errors, current);
    const inflight = new Set();
    let lastNetworkChange = Date.now();
    // Only requests of the CURRENT document count. A request cancelled by the next navigation
    // does not always report loadingFailed (the windows runner, 2026-09-17: every room after
    // the first "never settled"), so tracking by the navigation's loaderId keeps a dead page's
    // requests out of the quiet check.
    let currentLoader = null;
    page.on("Network.requestWillBeSent", (p) => {
      if (currentLoader === null || p.loaderId !== currentLoader) return;
      inflight.add(p.requestId); lastNetworkChange = Date.now();
    });
    const done = (p) => { inflight.delete(p.requestId); lastNetworkChange = Date.now(); };
    page.on("Network.loadingFinished", done);
    page.on("Network.loadingFailed", done);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Log.enable");
    await page.send("Network.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

    const quietSince = (from) => inflight.size === 0 && Date.now() - lastNetworkChange >= QUIET_MS && Date.now() - from >= MIN_WATCH_MS;
    const rooms = [];
    for (let i = 0; i < openable.length; i++) {
      const id = openable[i];
      current.room = id;
      const before = errors.length;
      const url = `${opts.base}?r=${i}#/${encodeURIComponent(id)}&token=${encodeURIComponent(opts.token)}`;
      inflight.clear();
      const nav = await page.send("Page.navigate", { url });
      currentLoader = nav.loaderId ?? null;
      lastNetworkChange = Date.now();
      const rendered = async () => {
        const r = await page.send("Runtime.evaluate", {
          expression: `(function () { var s = document.querySelector("section[data-room]"); return s ? s.getAttribute("data-room") : null; })()`,
          returnByValue: true,
        });
        return r.result?.value === id;
      };
      const opened = await until(rendered, opts.roomTimeoutMs);
      const renderedAt = Date.now();
      const settled = opened && await until(() => quietSince(renderedAt), 10000);
      rooms.push({ id, opened, settled, newErrors: 0, before });
    }
    // The last room gets the same watch window every other room got before navigating away.
    const drainFrom = Date.now();
    await until(() => quietSince(drainFrom), 5000);
    for (let i = 0; i < rooms.length; i++) {
      const end = i + 1 < rooms.length ? rooms[i + 1].before : errors.length;
      rooms[i].newErrors = end - rooms[i].before;
      const r = rooms[i];
      log(`${r.opened && r.settled && r.newErrors === 0 ? "ok" : "XX"} ${r.id}${r.opened ? "" : " (did not render)"}${r.opened && !r.settled ? " (never settled)" : ""}${r.newErrors ? ` errors=${r.newErrors}` : ""}`);
    }

    const excluded = new Set(opts.exclude ?? []);
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
      rooms: rooms.map(({ before, ...r }) => r),
      errors: errors.slice(0, 50),
    };
    if (Array.isArray(opts.expected)) {
      report.expected = opts.expected.length;
      report.missingFromDoor = opts.expected.filter((id) => !openable.includes(id));
      report.unexpectedFromDoor = openable.filter((id) => !opts.expected.includes(id));
    }
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
    // then give the second one a bounded chance to arrive so both paths are reported.
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

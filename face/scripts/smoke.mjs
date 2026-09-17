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
//     for 300 ms. v0.7 had no quiet rule at all -- it slept 900 ms -- so this one is ours, and
//     it exists to catch a room whose network NEVER ends (a stuck request, a poll with no gap).
//     A room not quiet within the 30 s cap FAILS; one quiet between 10 s and 30 s passes as
//     SLOW, printed with what its network held at 10 s. The last room gets the same drain.
//     WHAT THE 30 s CAP GIVES UP: a room that takes 10-30 s to go quiet is not a failure here.
//     That is deliberate. A 10 s FAIL measured runner and CDN weather: on the macOS
//     software-GL runner the first room's cold load held a Google Fonts download and
//     late-arriving CDP events for 11.2 s (CI run 35183482747), and in run 35150543730 it was
//     `map`. Every warm room there settled in about 0.9 s. Load time is not what this gate
//     judges; SLOW keeps it visible.
//
// Usage:
//   smoke.mjs --base URL --door URL --token T [--exclude id,id] [--room-timeout-ms N]
//   smoke.mjs --probe-file PATH       open one local page; exit 1 if it logged any error
// Exit: 0 every expected room opened, settled, with 0 counted errors · 1 a room failed, or the
//       probe saw errors · 2 setup failure (bad argument, no Chrome, door unreachable).
import { mkdtempSync, realpathSync } from "node:fs";
import { stopTree, removeDir, settleWithin } from "./proc.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  findChrome, chromeArgs, launchChrome, waitForDevTools, openSocket, CdpSession, openPage,
} from "./cdp.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const MIN_WATCH_MS = 900;
export const QUIET_MS = 300;
export const SLOW_SETTLE_MS = 10000;
export const SETTLE_CAP_MS = 30000;
export const THREE_CLOCK = /THREE\.Clock/;
const ROOM_ID = /^[a-z0-9][a-z0-9-]*$/;

export class SetupError extends Error {}

/** `text` with every known secret, raw or percent-encoded, replaced -- for anything bound for a public log. */
export function redactSecrets(text, secrets) {
  let out = String(text);
  for (const s of secrets) {
    if (typeof s !== "string" || s.length === 0) continue;
    for (const form of new Set([s, encodeURIComponent(s)])) out = out.split(form).join("<redacted>");
  }
  return out;
}

/** One room's result line. `ok` only for a room that opened, settled, logged nothing and hit no CDP error. */
export function roomLine(r) {
  const clean = r.opened && r.settled && r.newErrors === 0 && !r.cdpError;
  return `${clean ? "ok" : "XX"} ${r.id}`
    + (r.opened ? "" : " (did not render)")
    + (r.settled ? ` settle-ms=${r.settleMs}` : "")
    + (r.settled && r.atSlow ? ` SLOW at-${SLOW_SETTLE_MS}ms=${JSON.stringify(r.atSlow)}` : "")
    + (r.opened && !r.settled ? ` (never settled within ${SETTLE_CAP_MS} ms; at-${SLOW_SETTLE_MS}ms=${JSON.stringify(r.atSlow ?? null)} at-cap=${JSON.stringify(r.atCap ?? null)})` : "")
    + (r.navError ? ` nav-error=${JSON.stringify(r.navError)}` : "")
    + (r.cdpError ? ` cdp-error=${JSON.stringify(r.cdpError)}` : "")
    + (r.newErrors ? ` errors=${r.newErrors}` : "");
}

// A request's path only: a query, fragment or `;param` can carry the dev token, and any other
// scheme (data:, blob:, ws:) is reduced to its name. A path that still holds a known secret, raw
// or percent-encoded, is withheld whole. The report lands in a public CI log.
function pathOf(url, secrets) {
  let u;
  try { u = new URL(String(url)); } catch { return "?"; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return u.protocol.slice(0, 20);
  const path = u.pathname.split(";")[0];
  let decoded = path;
  try { decoded = decodeURIComponent(path); } catch { /* an undecodable path is checked raw */ }
  if (secrets.some((s) => path.includes(s) || decoded.includes(s))) return "[withheld: holds a secret]";
  return path.slice(0, 120);
}

/**
 * The network half of "settled", with no Chrome in it, so its rules are proven by a fixture.
 *
 * Only the CURRENT document's requests count. A request cancelled by the next navigation does
 * not always report loadingFailed (the windows runner, 2026-09-17: every room after the first
 * "never settled"), so requests are keyed by the navigation's loaderId -- and the rule holds in
 * BOTH directions: a finish for a request this document never sent does not reset the quiet
 * clock either. Requests that arrive before Page.navigate has answered with its loaderId are
 * held -- with their finish, if it came first -- and count only once that loaderId proves them
 * this document's. A navigation with no loaderId (CDP omits it for a same-document navigation)
 * watched nothing, so it is never quiet: a measurement over nothing is not a pass.
 */
export class NetworkWatch {
  constructor({ secrets = [] } = {}) {
    this.secrets = secrets.filter((s) => typeof s === "string" && s.length > 0);
    this.loader = null;
    this.navigating = false;
    this.inflight = new Map();
    this.early = new Map();
    this.lastChange = 0;
    this.events = 0;
    this.untrackedFinishes = 0;
  }

  /** A navigation was sent; its loaderId is not known yet. */
  navigate(now) {
    this.loader = null;
    this.navigating = true;
    this.inflight.clear();
    this.early.clear();
    this.lastChange = now;
    this.events = 0;
    this.untrackedFinishes = 0;
  }

  /** Page.navigate answered. */
  begin(loaderId, now) {
    this.navigating = false;
    this.loader = typeof loaderId === "string" && loaderId ? loaderId : null;
    for (const [id, r] of this.early) {
      if (this.loader === null || r.loaderId !== this.loader) continue;
      this.events++;
      if (r.finishedAt === undefined) { this.inflight.set(id, r); this.lastChange = Math.max(this.lastChange, now); }
      else this.lastChange = Math.max(this.lastChange, r.finishedAt);
    }
    this.early.clear();
  }

  sent(p, now) {
    if (!p || p.requestId === undefined) return;
    const r = { loaderId: p.loaderId, url: pathOf(p.request?.url, this.secrets), type: String(p.type ?? "?").slice(0, 40), at: now };
    if (this.navigating) { this.early.set(p.requestId, r); return; }
    if (this.loader === null || p.loaderId !== this.loader) return;
    // A redirect re-sends the same requestId: still one request, still in flight.
    this.inflight.set(p.requestId, r);
    this.lastChange = now;
    this.events++;
  }

  finished(p, now) {
    if (!p || p.requestId === undefined) return;
    // Finished before its document was known: remembered, and it moves the clock only if begin()
    // adopts it -- the same rule a finish after begin() obeys.
    const held = this.early.get(p.requestId);
    if (held) { held.finishedAt = now; return; }
    if (!this.inflight.delete(p.requestId)) { this.untrackedFinishes++; return; }
    this.lastChange = now;
    this.events++;
  }

  quiet(from, now) {
    return this.loader !== null && !this.navigating && this.inflight.size === 0
      && now - this.lastChange >= QUIET_MS && now - from >= MIN_WATCH_MS;
  }

  /** What the network held at `now` -- the evidence a "never settled" line carries. */
  snapshot(now) {
    return {
      measured: this.loader !== null,
      inflight: [...this.inflight.values()].map((r) => ({ type: r.type, url: r.url, ageMs: now - r.at })),
      msSinceChange: now - this.lastChange,
      events: this.events,
      untrackedFinishes: this.untrackedFinishes,
    };
  }
}

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
    if (a === "--base") {
      // The smoke appends its own `?r=N#/room`; a base that already has either would turn every
      // room into a same-document navigation that CDP gives no loaderId, i.e. an unwatched room.
      let u = null;
      try { u = new URL(v); } catch { /* reported below */ }
      if (!u || (u.protocol !== "http:" && u.protocol !== "https:") || v.includes("?") || v.includes("#")) {
        throw new SetupError(`--base must be an http(s) URL with no query or fragment, got ${JSON.stringify(v)}`);
      }
      opts.base = v;
    }
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
    // Ids are printed into the lines the bats suite parses; a space or newline in one could forge
    // a field there, so an id is the kebab grammar every served room already uses.
    if (!ROOM_ID.test(r.id)) throw new SetupError(`rooms[${i}] id ${JSON.stringify(r.id)} is not a kebab-case room id`);
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
      await settleWithin(session.send("Browser.close").catch(() => {}), 2000);
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
    const net = new NetworkWatch({ secrets: [opts.token] });
    page.on("Network.requestWillBeSent", (p) => net.sent(p, Date.now()));
    page.on("Network.loadingFinished", (p) => net.finished(p, Date.now()));
    page.on("Network.loadingFailed", (p) => net.finished(p, Date.now()));
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Log.enable");
    await page.send("Network.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

    const quietSince = (from) => net.quiet(from, Date.now());
    const rooms = [];
    // A room's error count is final once the next room starts, so its line is printed THEN --
    // as the run goes, so a CDP failure part-way never throws away the rooms already measured.
    const printRoom = (r, end) => { r.newErrors = end - r.before; log(roomLine(r)); };
    for (let i = 0; i < openable.length; i++) {
      const id = openable[i];
      const before = errors.length;
      if (i > 0) printRoom(rooms[i - 1], before);
      current.room = id;
      const room = { id, opened: false, settled: false, settleMs: null, newErrors: 0, before };
      rooms.push(room);
      if (session.closed) { room.cdpError = "the DevTools socket is closed"; continue; }
      try {
        const url = `${opts.base}?r=${i}#/${encodeURIComponent(id)}&token=${encodeURIComponent(opts.token)}`;
        net.navigate(Date.now());
        const nav = await page.send("Page.navigate", { url });
        net.begin(nav.loaderId, Date.now());
        if (nav.errorText) room.navError = redactSecrets(nav.errorText, [opts.token]).slice(0, 120);
        const rendered = async () => {
          const r = await page.send("Runtime.evaluate", {
            expression: `(function () { var s = document.querySelector("section[data-room]"); return s ? s.getAttribute("data-room") : null; })()`,
            returnByValue: true,
          });
          return r.result?.value === id;
        };
        room.opened = await until(rendered, opts.roomTimeoutMs);
        const renderedAt = Date.now();
        if (room.opened) {
          room.settled = await until(() => quietSince(renderedAt), SLOW_SETTLE_MS);
          if (!room.settled) {
            // Past the slow mark: what the network holds NOW is the evidence either way.
            room.atSlow = net.snapshot(Date.now());
            room.settled = await until(() => quietSince(renderedAt), SETTLE_CAP_MS - (Date.now() - renderedAt));
            if (!room.settled) room.atCap = net.snapshot(Date.now());
          }
          if (room.settled) room.settleMs = Date.now() - renderedAt;
        }
      } catch (e) {
        // This room's finding, never the end of the evidence: it is not opened or not settled,
        // so the verdict still FAILS it.
        room.cdpError = redactSecrets(e?.message ?? e, [opts.token]).slice(0, 200);
      }
    }
    // The last room gets the same watch window every other room got before navigating away.
    const drainFrom = Date.now();
    await until(() => quietSince(drainFrom), 5000);
    if (rooms.length) printRoom(rooms[rooms.length - 1], errors.length);
    const settledRooms = rooms.filter((r) => r.settled);
    const slowest = settledRooms.reduce((a, r) => (a === null || r.settleMs > a.settleMs ? r : a), null);

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
      // The headroom on this runner, and the evidence for every slow room and every miss.
      slowestSettle: slowest ? { room: slowest.id, ms: slowest.settleMs } : null,
      slowSettle: rooms.filter((r) => r.settled && r.atSlow).map((r) => ({ id: r.id, settleMs: r.settleMs, atSlow: r.atSlow })),
      unsettledDetail: rooms.filter((r) => r.opened && !r.settled).map((r) => ({ id: r.id, atSlow: r.atSlow ?? null, atCap: r.atCap ?? null, navError: r.navError, cdpError: r.cdpError })),
      cdpErrors: rooms.filter((r) => r.cdpError).map((r) => ({ id: r.id, error: r.cdpError })),
      rooms: rooms.map(({ before, atSlow, atCap, ...r }) => r),
      errors: errors.slice(0, 50),
    };
    if (Array.isArray(opts.expected)) {
      report.expected = opts.expected.length;
      report.missingFromDoor = opts.expected.filter((id) => !openable.includes(id));
      report.unexpectedFromDoor = openable.filter((id) => !opts.expected.includes(id));
    }
    if (report.slowSettle.length) {
      log(`smoke: WARN slow-settle ${report.slowSettle.map((r) => `${r.id}=${r.settleMs}ms`).join(",")} (quiet after ${SLOW_SETTLE_MS} ms, inside the ${SETTLE_CAP_MS} ms cap)`);
    }
    // The page's own URL carries the token in its fragment, so a page error can print it.
    for (const e of errors.slice(0, 20)) log(`  [${e.room}] ${e.type}: ${redactSecrets(e.text, [opts.token])}`);
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

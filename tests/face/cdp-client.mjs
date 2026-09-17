#!/usr/bin/env node
// cdp-client.mjs -- the browser harness's decisions, proven with no Chrome and no install
// (face v2 Phase 00, ADR-1335). Runs on every CI configuration, Node 18 included: nothing here
// needs the Vite floor, only node builtins.
//
// Covers face/scripts/cdp.mjs (frame codec, handshake, CDP session, Chrome lookup per OS),
// face/scripts/node-floor.mjs, face/scripts/lockfile-platforms.mjs and the pure half of
// face/scripts/smoke.mjs + harness-run.mjs (argument parsing, openable rooms, the verdict).
//
// VACUOUS-PASS GUARD: the first checks prove the modules loaded with real exports, and the last
// line is "RAN: <n> checks, <f> failed"; the exit code also requires n to reach a floor.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { startFakeCdp } from "./fake-cdp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SCRIPTS = join(REPO, "face", "scripts");
const imp = (f) => import(pathToFileURL(join(SCRIPTS, f)).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};
const throwsLike = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(String(e.message)); } };
const rejectsLike = async (p, re) => { try { await p; return false; } catch (e) { return re.test(String(e.message)); } };

const cdp = await imp("cdp.mjs");
const floor = await imp("node-floor.mjs");
const lockMod = await imp("lockfile-platforms.mjs");
const smoke = await imp("smoke.mjs");
const harness = await imp("harness-run.mjs");

check("cdp.mjs loaded with its codec, socket and lookup exports",
  [cdp.encodeFrame, cdp.FrameDecoder, cdp.openSocket, cdp.CdpSession, cdp.findChrome, cdp.openPage].every((f) => typeof f === "function"));
check("the harness helpers loaded", [floor.meetsFloor, lockMod.checkLockfile, smoke.judge, smoke.parseArgs, harness.parseArgs].every((f) => typeof f === "function"));

// ---- RFC 6455 codec ----
check("accept key matches the RFC 6455 worked example", cdp.acceptKey("dGhlIHNhbXBsZSBub25jZQ==") === "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
for (const len of [0, 125, 126, 65535, 65536]) {
  const payload = Buffer.alloc(len, 0x61);
  const frame = cdp.encodeFrame(payload, { opcode: 0x1, maskKey: Buffer.from([1, 2, 3, 4]) });
  const [f, ...rest] = new cdp.FrameDecoder().push(frame);
  check(`a masked client frame of ${len} bytes round-trips`, rest.length === 0 && f && f.masked && f.fin && f.opcode === 1 && f.payload.equals(payload));
}
{
  const frame = cdp.encodeFrame("hello", { maskKey: Buffer.from([9, 9, 9, 9]) });
  check("a client frame is masked on the wire (payload bytes differ from the text)", (frame[1] & 0x80) !== 0 && !frame.subarray(6).equals(Buffer.from("hello")));
  const dec = new cdp.FrameDecoder();
  let got = [];
  for (const b of frame) got = got.concat(dec.push(Buffer.from([b])));
  check("a frame fed one byte at a time yields exactly one frame, at the end", got.length === 1 && got[0].payload.toString() === "hello");
  const two = Buffer.concat([cdp.encodeFrame("a", { mask: false }), cdp.encodeFrame("b", { mask: false })]);
  const both = new cdp.FrameDecoder().push(two);
  check("two frames in one chunk yield two frames", both.length === 2 && both[1].payload.toString() === "b");
}
check("a control frame over 125 bytes is a protocol error",
  throwsLike(() => new cdp.FrameDecoder().push(cdp.encodeFrame(Buffer.alloc(126), { opcode: 0x9, mask: false })), /control frame/));
check("reserved bits are a protocol error", throwsLike(() => new cdp.FrameDecoder().push(Buffer.from([0xc1, 0x00])), /reserved bits/));
check("an unknown opcode is a protocol error", throwsLike(() => new cdp.FrameDecoder().push(Buffer.from([0x83, 0x00])), /unknown opcode/));
check("an oversize frame is refused before it is buffered",
  throwsLike(() => new cdp.FrameDecoder({ maxPayload: 10 }).push(cdp.encodeFrame(Buffer.alloc(11), { mask: false })), /exceeds/));
check("a mask key that is not 4 bytes is refused", throwsLike(() => cdp.encodeFrame("x", { maskKey: Buffer.from([1]) }), /4 bytes/));

// ---- socket + session against the fake ----
{
  const fake = await startFakeCdp({
    onMessage(msg, api) {
      if (msg.method === "Echo.ok") api.reply({ id: msg.id, result: { echoed: msg.params.v } });
      else if (msg.method === "Echo.fail") api.reply({ id: msg.id, error: { code: -32000, message: "planted failure" } });
      else if (msg.method === "Target.createTarget") api.reply({ id: msg.id, result: { targetId: "T1" } });
      else if (msg.method === "Target.attachToTarget") api.reply({ id: msg.id, result: { sessionId: "S1" } });
      else if (msg.method === "Split.message") {
        const text = JSON.stringify({ id: msg.id, result: { split: true } });
        api.raw(Buffer.concat([api.frame(text.slice(0, 7), 0x1, false), api.frame(text.slice(7), 0x0, true)]));
      } else if (msg.method === "Emit.events") {
        api.reply({ method: "Runtime.consoleAPICalled", sessionId: "S1", params: { type: "error", args: [{ value: "mine" }] } });
        api.reply({ method: "Runtime.consoleAPICalled", sessionId: "OTHER", params: { type: "error", args: [{ value: "not mine" }] } });
        api.raw(api.frame("{not json"));
        api.reply({ id: msg.id, result: {} });
      }
      else if (msg.method === "Page.probe") api.reply({ id: msg.id, result: {} });
      // "Never.answer" gets no reply on purpose.
    },
  });
  try {
    const ws = await cdp.openSocket(fake.url);
    const s = new cdp.CdpSession(ws, { callTimeoutMs: 1500 });
    const r = await s.send("Echo.ok", { v: 42 });
    check("a CDP call resolves with the server's result", r.echoed === 42);
    check("every frame the client sent was masked", fake.unmaskedFrames === 0 && fake.received.length >= 1);
    check("an error reply rejects with the server's message", await rejectsLike(s.send("Echo.fail"), /planted failure/));
    check("a message split across a text frame and a continuation arrives whole", (await s.send("Split.message")).split === true);
    // The 16- and 64-bit length paths cross the INDEPENDENT fake codec in both directions, so a
    // length-field bug shared by cdp.mjs's encoder and decoder cannot pass (attack 2026-09-17).
    for (const size of [200, 70000]) {
      const big = "x".repeat(size);
      const echoed = await s.send("Echo.ok", { v: big });
      check(`a ${size}-character message round-trips through the independent fake`, echoed.echoed === big);
    }

    const page = await cdp.openPage(s);
    const seen = [];
    page.on("Runtime.consoleAPICalled", (p) => seen.push(p.args[0].value));
    await s.send("Emit.events");
    check("a page only hears events for its own session id", page.sessionId === "S1" && seen.length === 1 && seen[0] === "mine");
    check("a malformed server message is counted, not thrown", s.malformed === 1);
    await page.send("Page.probe", {});
    const probe = fake.received.find((m) => m.method === "Page.probe");
    check("a page's send carries its session id on the wire", page.targetId === "T1" && probe && probe.sessionId === "S1", JSON.stringify(probe));

    fake.api.ping("pp");
    let pongOk = false;
    for (let i = 0; i < 30 && !pongOk; i++) { await new Promise((r) => setTimeout(r, 20)); pongOk = fake.pongs.some((b) => b.toString() === "pp"); }
    check("a server ping is answered with a pong carrying the same payload", pongOk);

    check("a call nobody answers times out instead of hanging", await rejectsLike(s.send("Never.answer"), /timed out/));
    // A close must reject at once with the close reason -- not by the 1500 ms call timeout,
    // whose message would also name the method (attack 2026-09-17).
    const pending = s.send("Never.answer");
    const closedAt = Date.now();
    fake.api.closeWith(1001);
    let closeMessage = "";
    try { await pending; } catch (e) { closeMessage = String(e.message); }
    const closeMs = Date.now() - closedAt;
    check("a server close rejects the calls still pending, at once and with the close reason",
      /Never\.answer/.test(closeMessage) && /socket closed|1001/.test(closeMessage) && !/timed out/.test(closeMessage) && closeMs < 1000,
      `${closeMs} ms: ${closeMessage}`);
    check("a closed session refuses new calls", await rejectsLike(s.send("Echo.ok", { v: 1 }), /closed/));
  } finally {
    await fake.close();
  }
}
{
  const fake = await startFakeCdp({ acceptOverride: "d3JvbmcgYWNjZXB0IGtleQ==" });
  try { check("a wrong Sec-WebSocket-Accept is refused", await rejectsLike(cdp.openSocket(fake.url), /wrong Sec-WebSocket-Accept/)); }
  finally { await fake.close(); }
}
{
  const fake = await startFakeCdp({ refuseStatus: 403 });
  try { check("a non-101 handshake answer is refused with its status", await rejectsLike(cdp.openSocket(fake.url), /HTTP 403/)); }
  finally { await fake.close(); }
}
check("a non-ws URL is refused", await rejectsLike(cdp.openSocket("http://127.0.0.1:1/x"), /only ws/));

// ---- Chrome lookup per OS (ADR-1335) ----
{
  const has = (...paths) => (p) => paths.includes(p);
  const bin = cdp.findChrome({ env: { CHROME_BIN: "/opt/chrome" }, platform: "linux", exists: has("/opt/chrome") });
  check("CHROME_BIN is used when it is set and exists", bin.path === "/opt/chrome" && bin.source === "CHROME_BIN");
  // A PATH directory that is NOT one of the hard-coded defaults, and `source` asserted, so the
  // PATH branch cannot pass by falling through to /usr/bin (attack 2026-09-17). The linux join is
  // posix on every host, including the windows runner.
  const stale = cdp.findChrome({ env: { CHROME_BIN: "/gone", PATH: "/opt/google/chrome:/usr/local/x" }, platform: "linux", exists: has("/opt/google/chrome/google-chrome") });
  check("a CHROME_BIN that does not exist falls through to PATH and is named in `tried`",
    stale.path === "/opt/google/chrome/google-chrome" && stale.source === "PATH" && stale.tried.some((t) => t.includes("/gone")), JSON.stringify(stale));
  const dirBin = cdp.findChrome({ env: { CHROME_BIN: REPO, PATH: "" }, platform: "linux" });
  check("a CHROME_BIN that is a directory is not taken as Chrome", dirBin.source !== "CHROME_BIN" && dirBin.tried.some((t) => t.includes(REPO)), JSON.stringify(dirBin.source));
  check("isRegularFile is false for a directory and true for a file",
    cdp.isRegularFile(REPO) === false && cdp.isRegularFile(fileURLToPath(import.meta.url)) === true);
  const reg = cdp.findChrome({ env: {}, platform: "win32", exists: has("D:\\Chrome\\chrome.exe"), regQuery: () => ["D:\\Chrome\\chrome.exe"] });
  check("windows reads the App Paths registry value first", reg.path === "D:\\Chrome\\chrome.exe" && reg.source === "registry");
  const pf = win32.join("C:\\PF", "Google", "Chrome", "Application", "chrome.exe");
  const pff = cdp.findChrome({ env: { ProgramFiles: "C:\\PF" }, platform: "win32", exists: has(pf), regQuery: () => [] });
  check("windows falls back to %ProgramFiles% when the registry has no value", pff.path === pf && pff.source === "ProgramFiles");
  const winMiss = cdp.findChrome({ env: { ProgramFiles: "C:\\PF", LOCALAPPDATA: "C:\\L" }, platform: "win32", exists: () => false, regQuery: () => { throw new Error("no reg"); } });
  check("a windows miss names the registry and every path it tried", winMiss.path === null && winMiss.tried.some((t) => /registry/.test(t)) && winMiss.tried.filter((t) => /ProgramFiles/.test(t)).length === 2);
  const mac = cdp.findChrome({ env: {}, platform: "darwin", exists: has("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") });
  check("macOS finds the /Applications bundle binary", mac.source === "Applications");
  const linuxMiss = cdp.findChrome({ env: { PATH: "/a:/b" }, platform: "linux", exists: () => false });
  check("a linux miss returns no path and a non-empty `tried`", linuxMiss.path === null && linuxMiss.tried.length >= 3);
}
check("chromeArgs asks for software WebGL and no longer disables the GPU path (macOS runner, CI 2026-09-17)",
  cdp.chromeArgs({ userDataDir: "/t", platform: "darwin" }).includes("--enable-unsafe-swiftshader")
  && cdp.chromeArgs({ userDataDir: "/t", platform: "darwin" }).includes("--use-angle=swiftshader")
  && !cdp.chromeArgs({ userDataDir: "/t", platform: "win32" }).includes("--disable-gpu"));
check("the smoke ignores exactly v0.7's THREE.Clock notice and nothing near it",
  smoke.THREE_CLOCK.test("THREE.Clock: This module has been deprecated.") && !smoke.THREE_CLOCK.test("THREEXClock") && !smoke.THREE_CLOCK.test("THREE.WebGLRenderer: Error creating WebGL context."));
check("chromeArgs adds --no-sandbox on linux only, and asks for port 0",
  cdp.chromeArgs({ userDataDir: "/t", platform: "linux" }).includes("--no-sandbox")
  && !cdp.chromeArgs({ userDataDir: "/t", platform: "win32" }).includes("--no-sandbox")
  && cdp.chromeArgs({ userDataDir: "/t", platform: "darwin" }).includes("--remote-debugging-port=0"));
check("DevToolsActivePort parses port and browser path", JSON.stringify(cdp.parseDevToolsActivePort("9222\n/devtools/browser/abc\n")) === JSON.stringify({ port: 9222, path: "/devtools/browser/abc" }));
check("a DevToolsActivePort with a bad port or path is refused",
  cdp.parseDevToolsActivePort("0\n/devtools/browser/x") === null && cdp.parseDevToolsActivePort("9222\n/other") === null && cdp.parseDevToolsActivePort("") === null);
{
  // A path that exists but cannot be run: launchChrome must not die on an unhandled 'error'
  // event, and waitForDevTools must say it could not start (attack 2026-09-17).
  const scratch = mkdtempSync(join(tmpdir(), "cdp-client-"));
  try {
    const child = cdp.launchChrome(join(REPO, "face", "scripts"), []);
    let msg = "";
    try { await cdp.waitForDevTools(scratch, child, { timeoutMs: 5000, pollMs: 20 }); } catch (e) { msg = String(e.message); }
    check("a Chrome path that cannot run is a clear 'could not start', not a crash", /could not start|exited/.test(msg), msg);

    writeFileSync(join(scratch, "DevToolsActivePort"), "9222\n /devtools/browser/x\n");
    const idle = { exitCode: null, signalCode: null, spawnError: null, stderrTail: () => "" };
    let msg2 = "";
    try { await cdp.waitForDevTools(scratch, idle, { timeoutMs: 300, pollMs: 20 }); } catch (e) { msg2 = String(e.message); }
    check("a DevToolsActivePort that exists but does not parse is reported as such, not as absent", /did not parse/.test(msg2), msg2);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// ---- Node floor ----
const floorCases = [["v18.20.4", false], ["v20.18.1", false], ["v20.19.0", true], ["v21.7.3", false], ["v22.11.0", false], ["v22.12.0", true], ["v24.1.0", true], ["banana", false]];
for (const [v, want] of floorCases) check(`node floor: ${v} is ${want ? "ok" : "below"}`, floor.meetsFloor(v).ok === want);
check("node floor reports the major so the suite can skip on 18 only", floor.meetsFloor("v18.20.4").major === 18 && floor.meetsFloor("v20.10.0").major === 20);

// ---- lockfile platform families ----
{
  const lock = JSON.parse(readFileSync(join(REPO, "face", "package-lock.json"), "utf8"));
  for (const [platform, arch, libc] of [["linux", "x64", "glibc"], ["darwin", "arm64", null], ["win32", "x64", null], ["linux", "arm", "glibc"]]) {
    const r = lockMod.checkLockfile(lock, { platform, arch, libc });
    check(`the tracked lockfile covers ${platform}-${arch}`, r.ok && r.families >= 2, JSON.stringify(r));
  }
  const linux = { platform: "linux", arch: "x64", libc: "glibc" };
  // The npm/cli#4828 damage itself: every rolldown binding gone except the one Windows needs.
  const onlyWin = structuredClone(lock);
  for (const k of Object.keys(onlyWin.packages)) if (/@rolldown\/binding-/.test(k) && !/win32-x64-msvc$/.test(k)) delete onlyWin.packages[k];
  const w = lockMod.checkLockfile(onlyWin, linux);
  check("a lockfile stripped to the Windows binding FAILS for linux and names the parent", !w.ok && w.missing.some((f) => f.startsWith("node_modules/rolldown")), JSON.stringify(w));
  // An older npm writes no libc: the name's own -gnu/-musl token decides.
  const muslOnly = structuredClone(lock);
  delete muslOnly.packages["node_modules/@rolldown/binding-linux-x64-gnu"];
  for (const k of Object.keys(muslOnly.packages)) delete muslOnly.packages[k].libc;
  check("a musl-only binding with no libc field does not satisfy a glibc host", !lockMod.checkLockfile(muslOnly, linux).ok);
  // A nested copy must be satisfied from its own resolution path, not by the hoisted copy.
  const nested = structuredClone(lock);
  nested.packages["node_modules/other/node_modules/lightningcss"] = { version: "9.9.9", optionalDependencies: { "lightningcss-win32-x64-msvc": "9.9.9", "lightningcss-linux-x64-gnu": "9.9.9" } };
  nested.packages["node_modules/other/node_modules/lightningcss-win32-x64-msvc"] = { os: ["win32"], cpu: ["x64"], optional: true };
  const n = lockMod.checkLockfile(nested, linux);
  check("a nested package with no linux binary is not covered by the hoisted copy", !n.ok && n.missing.some((f) => f.startsWith("node_modules/other/node_modules/lightningcss")), JSON.stringify(n));
  check("the refusal names the hoisted entry it resolved and the version it declared", n.missing.some((f) => /node_modules\/lightningcss-linux-x64-gnu@\S+ declared 9\.9\.9/.test(f)), JSON.stringify(n));
  // Positive controls, so "nested always fails" cannot pass the check above.
  const ownBinding = structuredClone(nested);
  ownBinding.packages["node_modules/other/node_modules/lightningcss-linux-x64-gnu"] = { version: "9.9.9", os: ["linux"], cpu: ["x64"], libc: ["glibc"], optional: true };
  const ob = lockMod.checkLockfile(ownBinding, linux);
  check("a nested package with its own matching linux binary passes", ob.ok && ob.families === n.families, JSON.stringify(ob));
  const hoistedVersion = lock.packages["node_modules/lightningcss-linux-x64-gnu"]?.version;
  check("the borrow fixture reads a real hoisted binding version", typeof hoistedVersion === "string" && hoistedVersion.length > 0, String(hoistedVersion));
  const borrow = structuredClone(nested);
  borrow.packages["node_modules/other/node_modules/lightningcss"] = { version: hoistedVersion, optionalDependencies: { "lightningcss-win32-x64-msvc": hoistedVersion, "lightningcss-linux-x64-gnu": hoistedVersion } };
  const bo = lockMod.checkLockfile(borrow, linux);
  check("a nested copy may resolve the hoisted binding when its version is the one declared", bo.ok, JSON.stringify(bo));
  // The same drift with no nesting at all: the hoisted binding is not the version rolldown pins.
  const drift = structuredClone(lock);
  drift.packages["node_modules/@rolldown/binding-linux-x64-gnu"].version = "0.0.1";
  const dr = lockMod.checkLockfile(drift, linux);
  check("a top-level binding at a different version than its parent pins FAILS for that platform", !dr.ok && dr.missing.some((f) => f.startsWith("node_modules/rolldown ")), JSON.stringify(dr));
  check("a top-level version drift leaves the other platforms passing", lockMod.checkLockfile(drift, { platform: "win32", arch: "x64", libc: null }).ok);
  const noVersion = structuredClone(lock);
  delete noVersion.packages["node_modules/@rolldown/binding-linux-x64-gnu"].version;
  check("a binding entry with no version does not satisfy a pin", !lockMod.checkLockfile(noVersion, linux).ok);
  const specCases = [
    ["1.2.5", "1.2.5", true], ["1.2.6", "1.2.5", false], ["1.2.5", "=1.2.5", true], ["1.2.5+b7", "1.2.5", true],
    ["1.2.5-rc.1", "1.2.5", false], ["1.2.5-rc.1", "1.2.5-rc.1", true],
    ["1.4.0", "^1.2.5", true], ["1.10.0", "^1.9.0", true], ["1.2.4", "^1.2.5", false], ["2.0.0", "^1.2.5", false],
    ["0.2.9", "^0.2.5", true], ["0.3.0", "^0.2.5", false], ["0.0.4", "^0.0.3", false], ["0.0.3", "^0.0.3", true],
    ["1.2.9", "~1.2.5", true], ["1.3.0", "~1.2.5", false], ["1.9.9", "*", true],
    ["1.2.5", ">=1.0.0", false], ["1.2.5", "^1.0.0 || ^2.0.0", false], ["1.2.5", "npm:other@1.2.5", false],
    ["1.2.5-rc.1", "^1.2.0", false], ["1.2.5", 125, false], [undefined, "1.2.5", false], ["banana", "1.2.5", false],
  ];
  for (const [v, spec, want] of specCases) check(`version ${v} ${want ? "satisfies" : "does not satisfy"} spec ${JSON.stringify(spec)}`, lockMod.satisfiesSpec(v, spec).ok === want, JSON.stringify(lockMod.satisfiesSpec(v, spec)));
  check("an unreadable spec is reported as unsupported, not as a plain mismatch", /unsupported/.test(lockMod.satisfiesSpec("1.2.5", ">=1.0.0").why));
  check("gnueabihf is one platform token, not gnu plus a remainder",
    JSON.stringify(lockMod.platformOfName("lightningcss-linux-arm-gnueabihf")) === JSON.stringify({ os: "linux", cpu: "arm", libc: "glibc" }));
  const none = lockMod.checkLockfile({ packages: { "node_modules/fsevents": { os: ["darwin"], cpu: [], optional: true } } }, linux);
  check("a lockfile with no platform families is an error, not a pass", !none.ok && /nothing was checked/.test(none.error));
  check("a v1 lockfile with no packages map is refused", !lockMod.checkLockfile({ dependencies: {} }, { platform: "linux", arch: "x64" }).ok);
}

// ---- smoke + harness pure half ----
{
  const good = { openable: 33, opened: 33, countedErrors: 0, unsettled: [] };
  check("the verdict passes a full, clean, settled run", smoke.judge(good).ok);
  const stub = JSON.parse(readFileSync(join(REPO, "tests", "fixtures", "face", "smoke-stub-report.json"), "utf8"));
  check("the verdict FAILS the stub report of a smoke that never navigated", !smoke.judge(stub).ok && smoke.judge(stub).reasons.some((r) => /opened=0/.test(r)));
  check("the verdict FAILS when nothing was openable", !smoke.judge({ ...good, openable: 0, opened: 0 }).ok);
  check("the verdict FAILS one counted error", !smoke.judge({ ...good, countedErrors: 1 }).ok);
  check("the verdict FAILS a room that never settled", !smoke.judge({ ...good, unsettled: ["today"] }).ok);
  check("the verdict FAILS a report that does not say what settled", !smoke.judge({ openable: 33, opened: 33, countedErrors: 0 }).ok);
  check("the verdict FAILS NaN or missing counts", !smoke.judge({ ...good, openable: NaN, opened: NaN }).ok && !smoke.judge({ ...good, countedErrors: undefined }).ok);
  check("the verdict FAILS a door that serves fewer rooms than the contract",
    !smoke.judge({ ...good, openable: 1, opened: 1, expected: 33, missingFromDoor: ["inbox"], unexpectedFromDoor: [] }).ok);
  check("the verdict FAILS a door that serves a room the contract does not know",
    !smoke.judge({ ...good, expected: 33, missingFromDoor: [], unexpectedFromDoor: ["ghost"] }).ok);

  const rooms = smoke.openableRooms({ rooms: [{ id: "today", status: "built" }, { id: "lane", status: "template" }, { id: "ops", status: "planned" }] });
  check("openable rooms exclude templates and keep planned rooms", JSON.stringify(rooms.openable) === JSON.stringify(["today", "ops"]) && rooms.notOpened[0] === "lane");
  check("a rooms payload with no array is a setup error", throwsLike(() => smoke.openableRooms({}), /rooms/));
  check("a malformed room entry is named by index, never dropped",
    throwsLike(() => smoke.openableRooms({ rooms: [{ id: "today", status: "built" }, null] }), /rooms\[1\]/)
    && throwsLike(() => smoke.openableRooms({ rooms: [{ id: 7, status: "built" }] }), /rooms\[0\]/)
    && throwsLike(() => smoke.openableRooms({ rooms: [{ id: "x" }] }), /no status/));
  check("a duplicate room id is a setup error", throwsLike(() => smoke.openableRooms({ rooms: [{ id: "a", status: "built" }, { id: "a", status: "built" }] }), /repeats/));
}

// ---- smoke network watch: what "settled" waits on ----
{
  const { NetworkWatch, MIN_WATCH_MS, QUIET_MS } = smoke;
  check("the network watch is exported with its two thresholds", typeof NetworkWatch === "function" && MIN_WATCH_MS === 900 && QUIET_MS === 300);
  const sent = (w, id, loaderId, t, url = "http://127.0.0.1:1/api/inbox?token=SECRET#x", type = "Fetch") => w.sent({ requestId: id, loaderId, type, request: { url } }, t);

  const w = new NetworkWatch();
  w.navigate(0); w.begin("L1", 0);
  check("a fresh document with no requests is not quiet before the minimum watch", !w.quiet(0, MIN_WATCH_MS - 1) && w.quiet(0, MIN_WATCH_MS));
  sent(w, "r1", "L1", 100);
  check("a request of this document in flight keeps the room unsettled", !w.quiet(0, 5000) && w.inflight.size === 1);
  w.finished({ requestId: "r1" }, 1000);
  check("after it finishes, the room waits the full quiet window", !w.quiet(0, 1000 + QUIET_MS - 1) && w.quiet(0, 1000 + QUIET_MS));

  const other = new NetworkWatch();
  other.navigate(0); other.begin("L2", 0);
  sent(other, "old", "L1", 50);
  check("a request of another document is not tracked", other.inflight.size === 0 && other.quiet(0, MIN_WATCH_MS));
  other.finished({ requestId: "dead-page-request" }, 890);
  check("a finish for a request this document never sent does not reset the quiet clock", other.quiet(0, MIN_WATCH_MS) && other.untrackedFinishes === 1, JSON.stringify(other.snapshot(MIN_WATCH_MS)));

  const early = new NetworkWatch();
  early.navigate(0);
  sent(early, "doc", "L3", 10, "http://127.0.0.1:1/?r=2", "Document");
  sent(early, "stale", "L2", 12);
  check("nothing counts as quiet while the navigation has not answered", !early.quiet(-10000, 5000));
  early.begin("L3", 40);
  check("a request that arrived before its loaderId was known is adopted, a stale one is not", early.inflight.size === 1 && early.inflight.has("doc"), JSON.stringify([...early.inflight.keys()]));
  check("the adopted request keeps the room unsettled until it finishes", !early.quiet(0, 5000));
  early.finished({ requestId: "doc" }, 60);
  check("and releases it once it does", early.quiet(0, 60 + MIN_WATCH_MS));
  const earlyDone = new NetworkWatch();
  earlyDone.navigate(0);
  sent(earlyDone, "quick", "L4", 5);
  earlyDone.finished({ requestId: "quick" }, 700);
  earlyDone.begin("L4", 710);
  check("a request that finished before the loaderId arrived is not left in flight, and its finish moves the clock", earlyDone.inflight.size === 0 && !earlyDone.quiet(0, 700 + QUIET_MS - 1) && earlyDone.quiet(0, 700 + QUIET_MS));

  const redirect = new NetworkWatch();
  redirect.navigate(0); redirect.begin("L5", 0);
  sent(redirect, "r", "L5", 10); sent(redirect, "r", "L5", 20);
  redirect.finished({ requestId: "r" }, 30);
  check("a redirect that re-sends one requestId is one request, cleared by one finish", redirect.inflight.size === 0 && redirect.quiet(0, MIN_WATCH_MS));

  const noLoader = new NetworkWatch();
  noLoader.navigate(0); noLoader.begin(undefined, 0);
  sent(noLoader, "x", undefined, 10);
  check("a navigation with no loaderId tracks nothing rather than everything", noLoader.inflight.size === 0);

  const snap = new NetworkWatch();
  snap.navigate(0); snap.begin("L6", 0);
  sent(snap, "s1", "L6", 100, "http://127.0.0.1:1/api/inbox?token=SECRET#frag", "Fetch");
  sent(snap, "s2", "L6", 150, "data:image/png;base64,AAAA", "Image");
  const s = snap.snapshot(10100);
  check("the at-cap evidence names each request in flight by type, path and age",
    s.inflight.length === 2 && s.inflight[0].type === "Fetch" && s.inflight[0].url === "/api/inbox" && s.inflight[0].ageMs === 10000 && s.inflight[1].url === "data:" && s.msSinceChange === 9950 && s.events === 2,
    JSON.stringify(s));
  check("the at-cap evidence never carries a query, a fragment or the token", !/SECRET|token|frag|base64/.test(JSON.stringify(s)), JSON.stringify(s));
  check("the settle cap is 10 s and the late watch never shortens it", smoke.SETTLE_CAP_MS === 10000 && smoke.LATE_WATCH_MS >= smoke.SETTLE_CAP_MS);
}

// ---- smoke + harness argument parsing ----
{
  const full =["--base", "http://x/", "--door", "http://d", "--token", "t"];
  check("smoke refuses an unknown flag", throwsLike(() => smoke.parseArgs(["--chek"]), /unknown argument/));
  check("smoke refuses a flag with no value", throwsLike(() => smoke.parseArgs(["--base", "--door", "x"]), /needs a value/));
  check("smoke refuses a repeated flag", throwsLike(() => smoke.parseArgs([...full, "--base", "http://y/"]), /twice/));
  check("smoke refuses an empty value", throwsLike(() => smoke.parseArgs(["--base", "", "--door", "d", "--token", "t"]), /empty/));
  check("smoke refuses a room timeout under a second", throwsLike(() => smoke.parseArgs([...full, "--room-timeout-ms", "5"]), /1000/));
  check("smoke requires base, door and token outside probe mode", throwsLike(() => smoke.parseArgs(["--base", "http://x/"]), /required/));
  check("smoke refuses --probe-file mixed with flags it would ignore", throwsLike(() => smoke.parseArgs(["--probe-file", "p", "--base", "http://x/"]), /runs alone/));
  check("smoke parses an exclude list", JSON.stringify(smoke.parseArgs([...full, "--exclude", "a, b,"]).exclude) === JSON.stringify(["a", "b"]));
  check("harness-run refuses an unknown flag and the --flag=value form",
    throwsLike(() => harness.parseArgs(["--exclude=a"]), /unknown/) && throwsLike(() => harness.parseArgs(["--keep"]), /unknown/));
  check("harness-run refuses an empty --face and a repeated flag",
    throwsLike(() => harness.parseArgs(["--face", ""]), /empty/) && throwsLike(() => harness.parseArgs(["--face", "a", "--face", "b"]), /twice/));
  const expected = harness.expectedOpenable(REPO);
  const onDisk = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8")).rooms;
  check("harness-run's expected set is read from rooms.generated.json, templates excluded",
    expected.length > 0 && expected.length === onDisk.filter((r) => r.status !== "template").length && !expected.includes("lane"), `expected=${expected.length}`);
}

// ---- child lifecycle (proc.mjs; shell/OS attack 2026-09-17) ----
{
  const proc = await imp("proc.mjs");
  check("a child killed by a signal is dead, and the signal is named",
    proc.isDead({ exitCode: null, signalCode: "SIGKILL" }) && /SIGKILL/.test(proc.deathReason({ exitCode: null, signalCode: "SIGKILL" })));
  check("a child that never started is dead", proc.isDead({ exitCode: null, signalCode: null, spawnError: new Error("ENOENT") }));
  check("a running child is not dead", !proc.isDead({ exitCode: null, signalCode: null, spawnError: null }));

  // A child that IGNORES SIGTERM: stopTree must escalate and return, never wait forever.
  const child = proc.spawnTracked(process.execPath, [join(REPO, "tests", "fixtures", "face", "sleeper.mjs")]);
  await proc.delay(400);
  const aliveBefore = !proc.isDead(child);
  const t0 = Date.now();
  await proc.stopTree(child, { graceMs: 500 });
  const stopMs = Date.now() - t0;
  let deadAfter = proc.isDead(child);
  for (let i = 0; i < 20 && !deadAfter; i++) { await proc.delay(100); deadAfter = proc.isDead(child); }
  check("stopTree ends a child that ignores SIGTERM, within its escalation window", aliveBefore && deadAfter && stopMs < 6000, `alive=${aliveBefore} dead=${deadAfter} ${stopMs} ms ${proc.deathReason(child)}`);

  const t1 = Date.now();
  const exited = await proc.waitExit({ exitCode: null, signalCode: null, once() {}, off() {} }, 150);
  check("waitExit gives up at its cap and reports false", exited === false && Date.now() - t1 < 1000);

  const dir = mkdtempSync(join(tmpdir(), "proc-remove-"));
  writeFileSync(join(dir, "f.txt"), "x");
  check("removeDir removes a directory and says so", (await proc.removeDir(dir, "cdp-client")) === true);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 60 ? 0 : 1;

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
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, realpathSync, rmdirSync, unlinkSync, lstatSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
  // Decision-logic attack 2026-09-17: each case below killed a mutant the checks above let live.
  const moreSpecCases = [
    ["1.2.5-rc.1", "*", false], ["1.2.5-rc.1", "", false], ["1.2.5-rc.1", "~1.2.0", false],
    ["1.2.9007199254740993", "1.2.9007199254740992", false], ["01.2.5", "1.2.5", false],
    ["1.2.5", ">1.0.0", false], ["1.2.5", "<2.0.0", false], ["1.2.5", "1.2", false], ["1.2.5", "1.x", false],
  ];
  for (const [v, spec, want] of moreSpecCases) check(`version ${v} ${want ? "satisfies" : "does not satisfy"} spec ${JSON.stringify(spec)}`, lockMod.satisfiesSpec(v, spec).ok === want, JSON.stringify(lockMod.satisfiesSpec(v, spec)));

  const armGlibc = { platform: "linux", arch: "arm", libc: "glibc" };
  const rollup = (extra) => ({ packages: { "node_modules/rollup": { version: "4.0.0", optionalDependencies: { "@rollup/rollup-linux-arm-gnueabihf": "4.0.0", "@rollup/rollup-linux-arm-musleabihf": "4.0.0" } }, "node_modules/@rollup/rollup-linux-arm-musleabihf": { version: "4.0.0", optional: true }, ...extra } });
  check("a musleabihf binding with no libc field does not satisfy a glibc arm host", !lockMod.checkLockfile(rollup({}), armGlibc).ok, JSON.stringify(lockMod.checkLockfile(rollup({}), armGlibc)));
  check("and the gnueabihf binding beside it does",
    lockMod.checkLockfile(rollup({ "node_modules/@rollup/rollup-linux-arm-gnueabihf": { version: "4.0.0", optional: true } }), armGlibc).ok);
  check("musleabihf reads as musl, sharp's linuxmusl as linux musl, and an unknown ABI as unknown",
    lockMod.platformOfName("@rollup/rollup-linux-arm-musleabihf").libc === "musl"
    && JSON.stringify(lockMod.platformOfName("@img/sharp-linuxmusl-x64")) === JSON.stringify({ os: "linux", cpu: "x64", libc: "musl" })
    && lockMod.platformOfName("@rolldown/binding-linux-arm64-ohos").unknownAbi === "ohos");
  const unread = lockMod.checkLockfile({ packages: { "node_modules/p": { version: "1.0.0", optionalDependencies: { "p-linux-x64-gnux32": "1.0.0" } }, "node_modules/p-linux-x64-gnux32": { version: "1.0.0" } } }, linux);
  check("a family whose only binding for this platform has an unread ABI FAILS and names it", !unread.ok && unread.missing.some((f) => /unread ABI: p-linux-x64-gnux32/.test(f)), JSON.stringify(unread));

  const malformed = structuredClone(lock);
  delete malformed.packages["node_modules/@rolldown/binding-linux-x64-gnu"];
  malformed.packages["node_modules/rolldown"].optionalDependencies = Object.keys(malformed.packages["node_modules/rolldown"].optionalDependencies);
  const ma = lockMod.checkLockfile(malformed, linux);
  check("optionalDependencies written as an array is a named finding, not a family that drops out", !ma.ok && ma.missing.some((f) => /node_modules\/rolldown \(malformed optionalDependencies\)/.test(f)), JSON.stringify(ma));
  const nullEntry = structuredClone(lock);
  nullEntry.packages["node_modules/ghost"] = null;
  check("a null package entry is a named finding", lockMod.checkLockfile(nullEntry, linux).missing.some((f) => /ghost \(malformed entry\)/.test(f)));

  const wrongOs = structuredClone(lock);
  wrongOs.packages["node_modules/@rolldown/binding-linux-x64-gnu"].os = ["darwin"];
  check("a binding whose own os field contradicts its name does not satisfy the host", !lockMod.checkLockfile(wrongOs, linux).ok);
  const wrongLibc = structuredClone(lock);
  wrongLibc.packages["node_modules/@rolldown/binding-linux-x64-gnu"].libc = ["musl"];
  check("a binding whose own libc field contradicts the host does not satisfy it", !lockMod.checkLockfile(wrongLibc, linux).ok);
  const sunos = lockMod.checkLockfile(lock, { platform: "sunos", arch: "x64", libc: null });
  check("a platform the lockfile ships nothing for FAILS by name", !sunos.ok && sunos.missing.some((f) => /declares no binary for this platform/.test(f)), JSON.stringify(sunos));
  const shadow = structuredClone(lock);
  shadow.packages["node_modules/rolldown/node_modules/@rolldown/binding-linux-x64-gnu"] = { version: "0.0.1", os: ["linux"], cpu: ["x64"], libc: ["glibc"], optional: true };
  const sh = lockMod.checkLockfile(shadow, linux);
  check("a wrong-version binding in the parent's OWN node_modules shadows the right hoisted one and FAILS",
    !sh.ok && sh.missing.some((f) => f.includes("node_modules/rolldown/node_modules/@rolldown/binding-linux-x64-gnu@0.0.1")), JSON.stringify(sh));
  check("gnueabihf is one platform token, not gnu plus a remainder",
    JSON.stringify(lockMod.platformOfName("lightningcss-linux-arm-gnueabihf")) === JSON.stringify({ os: "linux", cpu: "arm", libc: "glibc" }));
  const none = lockMod.checkLockfile({ packages: { "node_modules/fsevents": { os: ["darwin"], cpu: [], optional: true } } }, linux);
  check("a lockfile with no platform families is an error, not a pass", !none.ok && /nothing was checked/.test(none.error));
  check("a v1 lockfile with no packages map is refused", !lockMod.checkLockfile({ dependencies: {} }, { platform: "linux", arch: "x64" }).ok);
}

// ---- smoke + harness pure half ----
{
  const good = { openable: 33, opened: 33, countedErrors: 0, unsettled: [], mood: "dark", moodMiss: [], expected: 33, missingFromDoor: [], unexpectedFromDoor: [] };
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
  check("a navigation with no loaderId watched nothing, so it is never quiet and says so",
    noLoader.inflight.size === 0 && !noLoader.quiet(0, 100000) && noLoader.snapshot(100000).measured === false);

  const oldEarly = new NetworkWatch();
  oldEarly.navigate(0);
  sent(oldEarly, "old", "L-OLD", 10);
  oldEarly.finished({ requestId: "old" }, 800);
  oldEarly.begin("L-NEW", 810);
  check("an old document's request held during navigation moves no clock when its finish comes before begin", oldEarly.quiet(0, MIN_WATCH_MS) && oldEarly.inflight.size === 0, JSON.stringify(oldEarly.snapshot(MIN_WATCH_MS)));

  const reused = new NetworkWatch();
  reused.navigate(0); reused.begin("L1", 0);
  sent(reused, "abandoned", "L1", 10);
  reused.navigate(2000); reused.begin("L2", 2000);
  check("one watch across two rooms: a request abandoned by room 1 never holds room 2 open", reused.inflight.size === 0 && reused.quiet(2000, 2000 + MIN_WATCH_MS));

  const secret = new NetworkWatch({ secrets: ["SECRET"] });
  secret.navigate(0); secret.begin("LS", 0);
  const urls = [
    "http://127.0.0.1:1/api/inbox;token=SECRET", "http://127.0.0.1:1/a%3Ftoken=SECRET", "http://127.0.0.1:1/x/S%45CRET",
    "https://h.example/p?token=SECRET", "blob:http://127.0.0.1:1/x?token=SECRET", "ws://127.0.0.1:1/x?token=SECRET",
  ];
  urls.forEach((u, i) => sent(secret, `u${i}`, "LS", 10, u));
  const ss = secret.snapshot(20);
  check("the at-cap evidence withholds a secret in a ;param, an encoded ?, an encoded byte, and every non-http scheme",
    ss.inflight.length === urls.length && !/SECRET|token/.test(JSON.stringify(ss))
    && JSON.stringify(ss.inflight.map((r) => r.url)) === JSON.stringify(["/api/inbox", "[withheld: holds a secret]", "[withheld: holds a secret]", "/p", "blob:", "ws:"]),
    JSON.stringify(ss.inflight.map((r) => r.url)));

  check("redactSecrets replaces a secret raw and percent-encoded, and ignores an empty one",
    smoke.redactSecrets("open http://h/#token=a b&x=a%20b", ["a b", ""]) === "open http://h/#token=<redacted>&x=<redacted>");
  const base = { id: "map", opened: true, settled: true, settleMs: 1200, newErrors: 0 };
  check("a room line is ok only when clean, and a CDP error alone makes it XX",
    smoke.roomLine(base) === "ok map settle-ms=1200" && smoke.roomLine({ ...base, cdpError: "socket closed" }).startsWith("XX map"));
  const held = { measured: true, inflight: [{ type: "Font", url: "/s/anybody/v13/x.woff2", ageMs: 6377 }] };
  const unsettledLine = smoke.roomLine({ ...base, settled: false, settleMs: null, atSlow: held, atCap: { measured: true, inflight: [] } });
  check("a never-settled line is XX and carries its evidence at 10 s and at the cap, and cannot start a forged summary line",
    unsettledLine.startsWith("XX map (never settled within 30000 ms; at-10000ms={")
    && unsettledLine.includes("x.woff2") && unsettledLine.endsWith(`at-cap={"measured":true,"inflight":[]})`)
    && !/^smoke: /.test(unsettledLine) && !unsettledLine.includes("\n"), unsettledLine);
  const slowLine = smoke.roomLine({ ...base, settleMs: 11220, atSlow: held });
  check("a room quiet between 10 s and the cap is ok, marked SLOW with what it held at 10 s",
    slowLine.startsWith("ok map settle-ms=11220 SLOW at-10000ms={") && slowLine.includes("x.woff2"), slowLine);
  check("a room id that could forge a parsed field is a setup error",
    throwsLike(() => smoke.openableRooms({ rooms: [{ id: "t excluded-errors=0 unsettled=0", status: "template" }] }), /kebab-case/)
    && throwsLike(() => smoke.openableRooms({ rooms: [{ id: "a\nsmoke: opened=1", status: "built" }] }), /kebab-case/)
    && smoke.openableRooms({ rooms: [{ id: "engine-room", status: "built" }] }).openable.length === 1);

  const snap = new NetworkWatch();
  snap.navigate(0); snap.begin("L6", 0);
  sent(snap, "s1", "L6", 100, "http://127.0.0.1:1/api/inbox?token=SECRET#frag", "Fetch");
  sent(snap, "s2", "L6", 150, "data:image/png;base64,AAAA", "Image");
  const s = snap.snapshot(10100);
  check("the at-cap evidence names each request in flight by type, path and age",
    s.inflight.length === 2 && s.inflight[0].type === "Fetch" && s.inflight[0].url === "/api/inbox" && s.inflight[0].ageMs === 10000 && s.inflight[1].url === "data:" && s.msSinceChange === 9950 && s.events === 2,
    JSON.stringify(s));
  check("the at-cap evidence never carries a query, a fragment or the token", !/SECRET|token|frag|base64/.test(JSON.stringify(s)), JSON.stringify(s));
  check("a room is SLOW past 10 s and FAILS only past the 30 s cap", smoke.SLOW_SETTLE_MS === 10000 && smoke.SETTLE_CAP_MS === 30000);
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
  check("smoke refuses a --base that is not http(s) or already has a query or fragment",
    ["http://x/#", "http://x/?a=1", "file:///x/", "not a url"].every((b) => throwsLike(() => smoke.parseArgs(["--base", b, "--door", "http://d", "--token", "t"]), /--base must be/)));
  check("smoke parses an exclude list",JSON.stringify(smoke.parseArgs([...full, "--exclude", "a, b,"]).exclude) === JSON.stringify(["a", "b"]));
  check("harness-run refuses an unknown flag and the --flag=value form",
    throwsLike(() => harness.parseArgs(["--exclude=a"]), /unknown/) && throwsLike(() => harness.parseArgs(["--keep"]), /unknown/));
  check("harness-run refuses an empty --face and a repeated flag",
    throwsLike(() => harness.parseArgs(["--face", ""]), /empty/) && throwsLike(() => harness.parseArgs(["--face", "a", "--face", "b"]), /twice/));
  const expected = harness.expectedOpenable(REPO);
  const onDisk = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8")).rooms;
  check("harness-run's expected set is read from rooms.generated.json, templates excluded",
    expected.length > 0 && expected.length === onDisk.filter((r) => r.status !== "template").length && !expected.includes("lane"), `expected=${expected.length}`);
}

// ---- the mood arm (face v2 Phase 01, ADR-1331) ----
{
  const full = ["--base", "http://x/", "--door", "http://d", "--token", "t"];
  check("smoke's mood defaults to dark and accepts light", smoke.parseArgs(full).mood === "dark" && smoke.parseArgs([...full, "--mood", "light"]).mood === "light");
  check("smoke refuses a mood that is not dark or light, and --mood twice",
    throwsLike(() => smoke.parseArgs([...full, "--mood", "paper"]), /--mood must be one of/) && throwsLike(() => smoke.parseArgs([...full, "--mood", "dark", "--mood", "light"]), /twice/));
  check("harness-run runs both moods by default, dark first", JSON.stringify(harness.parseArgs([]).moods) === JSON.stringify(["dark", "light"]));
  check("harness-run refuses an unknown mood, an empty entry and a repeated mood",
    throwsLike(() => harness.parseArgs(["--moods", "dark,sepia"]), /--moods takes/) && throwsLike(() => harness.parseArgs(["--moods", "dark,"]), /--moods takes/)
    && throwsLike(() => harness.parseArgs(["--moods", "light,light"]), /twice/));

  check("light holds only with BOTH hq and hq-light", smoke.moodHolds("hq hq-light", "light") && !smoke.moodHolds("hq-light", "light") && !smoke.moodHolds("hq", "light"));
  check("dark holds with hq and FAILS with hq-light present", smoke.moodHolds("foo hq", "dark") && !smoke.moodHolds("hq hq-light", "dark"));
  check("a class list that was not read, or a near-miss class, never holds",
    !smoke.moodHolds(null, "dark") && !smoke.moodHolds(undefined, "light") && !smoke.moodHolds("hq-lightish hq", "light") && !smoke.moodHolds("hqx", "dark") && !smoke.moodHolds("hq", "sepia"));

  const clean = { openable: 33, opened: 33, countedErrors: 0, unsettled: [], expected: 33, missingFromDoor: [], unexpectedFromDoor: [] };
  check("a clean light run passes", smoke.judge({ ...clean, mood: "light", moodMiss: [] }).ok);
  const noLight = smoke.judge({ ...clean, mood: "light", moodMiss: [{ id: "today", htmlClass: "hq" }, { id: "inbox", htmlClass: "hq" }] });
  check("a light run whose rooms lack hq-light FAILS with the spec's words",
    !noLight.ok && noLight.reasons.some((r) => r.startsWith("hq-light: class not applied on <html> (2 room(s): today,inbox)")), JSON.stringify(noLight.reasons));
  const noHq = smoke.judge({ ...clean, mood: "dark", moodMiss: [{ id: "map", htmlClass: "" }] });
  check("a dark run with no hq FAILS naming the room", !noHq.ok && noHq.reasons.some((r) => r.startsWith("hq: class not applied on <html> (1 room(s): map)")), JSON.stringify(noHq.reasons));
  const lit = smoke.judge({ ...clean, mood: "dark", moodMiss: [{ id: "map", htmlClass: "hq hq-light" }] });
  check("a dark run that rendered light FAILS", !lit.ok && lit.reasons.some((r) => /hq-light: class applied on <html> in the dark mood/.test(r)), JSON.stringify(lit.reasons));
  check("a mood run that never measured the mood FAILS", !smoke.judge({ ...clean, mood: "light" }).ok);
  check("an unmeasured room (class never read) FAILS rather than passing silently",
    !smoke.judge({ ...clean, mood: "dark", moodMiss: [{ id: "map", htmlClass: null }] }).ok);
  check("a report with a mood that is neither FAILS", !smoke.judge({ ...clean, mood: "sepia", moodMiss: [] }).ok);

  const line = smoke.summaryLines({ ...clean, excludedErrors: 0, expected: 33, notOpened: ["lane"], mood: "light", moodMiss: [{ id: "x", htmlClass: "hq" }] })[0];
  check("the summary line ends with the mood pair the bats verdict anchors to", /^smoke: opened=33 .* not-opened=lane mood=light mood-miss=1$/.test(line), line);
  check("a report with no mood prints no mood pair (so a moodless line never passes a mood verdict)",
    !/mood=/.test(smoke.summaryLines({ ...clean, excludedErrors: 0, notOpened: [] })[0]));
  const missLine = smoke.roomLine({ id: "map", opened: true, settled: true, settleMs: 950, newErrors: 0, moodMiss: true, htmlClass: "hq" });
  check("a room in the wrong mood is an XX line naming the class list it saw", missLine === 'XX map settle-ms=950 mood-miss(html-class="hq")', missLine);
  check("the harness writes the app's storage key", smoke.MOOD_KEY === "arc-hq-theme");

  // The render line (face v2 Phase 02, ADR-1321): what drew each opened room, in the shape the bats
  // render verdict anchors to. A report that measured nothing prints zeros, never a missing line.
  const rendered = smoke.renderLine({ mood: "dark", render: { module: ["today", "map"], generic: ["bench"], unmarked: [] } });
  check("the render line counts modules, generic rooms and unmarked rooms, and names the generic ones",
    rendered === "smoke: render mood=dark module=2 generic=1 unmarked=0 generic-rooms=bench", rendered);
  const bare = smoke.renderLine({ mood: "light" });
  check("a report with no render block prints zero modules, so the verdict refuses it rather than skipping it",
    bare === "smoke: render mood=light module=0 generic=0 unmarked=0 generic-rooms=none", bare);

  // The NOT SERVED line (face v2 Phase 03, REQ-05): how many panels named a route the door does not
  // serve, and in which rooms -- the browser's count of the gap Phase 04 closes.
  const gaps = typeof smoke.notServedLine === "function" ? smoke.notServedLine({ mood: "dark", notServed: { panels: 3, rooms: ["board:1", "today:2"] } }) : null;
  check("the not-served line counts NOT SERVED panels and names each room WITH its own count", gaps === "smoke: not-served mood=dark panels=3 rooms=board:1,today:2", String(gaps));
  const noGaps = typeof smoke.notServedLine === "function" ? smoke.notServedLine({ mood: "light" }) : null;
  check("a report that measured no NOT SERVED panel prints zero, never a missing line", noGaps === "smoke: not-served mood=light panels=0 rooms=none", String(noGaps));

  // ADR-1326's counterpart: the verbs drawn as pending the work door, counted per room. Both lists are
  // derived from the folds and compared to the page per room, because a total cannot see a card deleted
  // in one room and duplicated in another (face v2 Phase 03 attack).
  const verbs = typeof smoke.verbsPendingLine === "function" ? smoke.verbsPendingLine({ mood: "dark", verbsPending: { panels: 4, rooms: ["policy:2", "scheduler:2"] } }) : null;
  check("the verbs-pending line counts the work-door cards and names each room with its own count",
    verbs === "smoke: verbs-pending mood=dark cards=4 rooms=policy:2,scheduler:2", String(verbs));
  const noVerbs = typeof smoke.verbsPendingLine === "function" ? smoke.verbsPendingLine({ mood: "light", verbsPending: { panels: null, rooms: [] } }) : null;
  check("a verb-pending count that could not be read prints unread, never zero", noVerbs === "smoke: verbs-pending mood=light cards=unread rooms=none", String(noVerbs));
  // MUTANT: a run whose derived counts could not be read is not a clean run -- the verdict had no clause
  // for either count, so a page that drew none of them exited 0 (face v2 Phase 03 attack).
  const unreadNs = smoke.judge({ ...clean, mood: "dark", moodMiss: [], expected: 33, missingFromDoor: [], unexpectedFromDoor: [], headings: { checked: 14, miss: [] }, notServed: { panels: null, rooms: [] } });
  check("MUTANT: the verdict refuses a run whose NOT SERVED count could not be read",
    !unreadNs.ok && unreadNs.reasons.some((r) => /NOT SERVED panel count/.test(r)), JSON.stringify(unreadNs.reasons));
  const unreadVerbs = smoke.judge({ ...clean, mood: "dark", moodMiss: [], expected: 33, missingFromDoor: [], unexpectedFromDoor: [], headings: { checked: 14, miss: [] }, verbsPending: { panels: null, rooms: [] } });
  check("MUTANT: the verdict refuses a run whose verb-pending count could not be read",
    !unreadVerbs.ok && unreadVerbs.reasons.some((r) => /verb-pending card count/.test(r)), JSON.stringify(unreadVerbs.reasons));

  // The heading check (face v2 Phase 03, the debt row on "opened"): a shipped ring's module room opens with
  // the served sentence, entities undone; a blank or wrong heading is a miss the verdict refuses.
  const hasHeading = typeof smoke.headingCheck === "function" && typeof smoke.headingLine === "function";
  check("the smoke exports the heading check and line, and names every ring shipped so far",
    hasHeading && Array.isArray(smoke.SENTENCE_RINGS) && ["command", "kernel", "factory"].every((r) => smoke.SENTENCE_RINGS.includes(r)),
    JSON.stringify(smoke.SENTENCE_RINGS));
  if (hasHeading) {
    const served = { id: "inbox", ring: "command", sentence: "A machine may raise it. Only you &amp; nobody else may decide it." };
    const good = smoke.headingCheck(served, { id: "inbox", render: "module", h1: "A machine may raise it. Only you & nobody else may decide it." });
    check("a heading equal to the served sentence, entities undone, passes", good !== null && good.ok === true, JSON.stringify(good));
    const blank = smoke.headingCheck(served, { id: "inbox", render: "module", h1: "" });
    check("MUTANT: a blank heading on a shipped ring's module room is a miss", blank !== null && blank.ok === false, JSON.stringify(blank));
    const absent = smoke.headingCheck(served, { id: "inbox", render: "module", h1: null });
    check("MUTANT: no h1 at all is a miss, not a skip", absent !== null && absent.ok === false, JSON.stringify(absent));
    check("a generic room and a room outside the shipped rings are not heading-checked",
      smoke.headingCheck(served, { id: "inbox", render: "generic", h1: "x" }) === null && smoke.headingCheck({ ...served, ring: "a-ring-no-module-has-shipped-in" }, { id: "inbox", render: "module", h1: "x" }) === null);
    const missed = smoke.judge({ ...clean, mood: "dark", moodMiss: [], expected: 33, missingFromDoor: [], unexpectedFromDoor: [], headings: { checked: 6, miss: [blank] } });
    check("MUTANT: the verdict refuses a run with a heading miss, however clean", !missed.ok && missed.reasons.some((r) => /heading miss/.test(r)), JSON.stringify(missed.reasons));
    const drifted = smoke.headingCheck({ ...served, sentence: "Nothing happened overnight." }, { id: "inbox", render: "module", h1: "Nothing happened overnight." }, "A machine may raise it. Only you & nobody else may decide it.");
    check("MUTANT: a door serving a sentence the contract does not freeze is a miss, even when the page matches the door", drifted !== null && drifted.ok === false, JSON.stringify(drifted));
    const frozenOk = smoke.headingCheck(served, { id: "inbox", render: "module", h1: "A machine may raise it. Only you & nobody else may decide it." }, "A machine may raise it. Only you & nobody else may decide it.");
    check("a heading equal to the contract's sentence, with the door agreeing, passes", frozenOk !== null && frozenOk.ok === true, JSON.stringify(frozenOk));
    const none = smoke.judge({ ...clean, mood: "dark", moodMiss: [], expected: 33, missingFromDoor: [], unexpectedFromDoor: [], headings: { checked: 0, miss: [] } });
    check("MUTANT: the verdict refuses a run that heading-checked no shipped-ring room", !none.ok && none.reasons.some((r) => /heading checked/.test(r)), JSON.stringify(none.reasons));
    check("a NOT SERVED count that could not be read prints unread, never zero",
      smoke.notServedLine({ mood: "dark", notServed: { panels: null, rooms: [] } }) === "smoke: not-served mood=dark panels=unread rooms=none");
    check("the heading line counts what was checked and what missed",
      smoke.headingLine({ mood: "dark", headings: { checked: 6, miss: [] } }) === "smoke: heading mood=dark rings=command,kernel,factory checked=6 miss=0", smoke.headingLine({ mood: "dark", headings: { checked: 6, miss: [] } }));
  }

  // The attack on the mood verdict (face v2 Phase 01).
  check("a report that names no mood FAILS, however clean", !smoke.judge({ ...clean, moodMiss: [] }).ok
    && smoke.judge({ ...clean, moodMiss: [] }).reasons.some((r) => /no mood named/.test(r)));
  check("a report with no expected room set FAILS: the door is never judged against itself",
    !smoke.judge({ openable: 33, opened: 33, countedErrors: 0, unsettled: [], mood: "dark", moodMiss: [] }).ok);
  check("classes split on ASCII whitespace only, as the DOM does (NBSP, BOM, LS do not split)",
    !smoke.moodHolds("hq hq-light", "light") && !smoke.moodHolds("hq﻿hq-light", "light") && !smoke.moodHolds("hq hq-light", "light")
    && smoke.moodHolds("hq\thq-light", "light") && smoke.moodHolds("hq\nhq-light", "light"));
  const forged = smoke.errorLine({ room: "today", type: "console.error", text: "\nsmoke: opened=3 openable=3 errors=0 mood=light mood-miss=0" }, []);
  check("a page error carrying a newline prints as ONE line, so it cannot forge a summary line", !/\n/.test(forged) && forged.startsWith("  [today] console.error: "), forged);
  check("an error line still redacts the token", !/SECRET/.test(smoke.errorLine({ room: "x", type: "log", text: "a SECRET b" }, ["SECRET"])));
  check("a setup message is one line", smoke.oneLine("a\nb\r\nc") === "a\\nb\\nc");
  check("the standalone smoke and the harness read ONE expected set", typeof smoke.expectedOpenable === "function"
    && JSON.stringify(smoke.expectedOpenable(REPO)) === JSON.stringify(harness.expectedOpenable(REPO)));
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

  // Proven in a CHILD with nothing else alive: in this process, a leftover handle would hide an
  // unref()ed timer, and the failure mode is node exiting mid-file with no FAIL line at all.
  const timers = spawnSync(process.execPath, [join(REPO, "tests", "fixtures", "face", "await-timers.mjs")], { encoding: "utf8", timeout: 20000 });
  const timersSaw = `status=${timers.status} signal=${timers.signal} out=${JSON.stringify(timers.stdout)} err=${JSON.stringify(String(timers.stderr ?? "").slice(-300))}`;
  check("an awaited delay and waitExit timeout hold a process that has nothing else alive", timers.status === 0 && /resumed exited=false/.test(timers.stdout ?? ""), timersSaw);
  check("settleWithin returns the first result and clears its timer, so the process ends long before it", timers.signal === null && /settled=first/.test(timers.stdout ?? ""), timersSaw);

  const t1 = Date.now();
  const exited = await proc.waitExit({ exitCode: null, signalCode: null, once() {}, off() {} }, 150);
  check("waitExit gives up at its cap and reports false", exited === false && Date.now() - t1 < 1000);

  const dir = mkdtempSync(join(tmpdir(), "proc-remove-"));
  writeFileSync(join(dir, "f.txt"), "x");
  check("removeDir removes a directory and says so", (await proc.removeDir(dir, "cdp-client")) === true);
}

// ---- main guards behind a link (retro-log 2026-08-19, the fourth recurrence) ----
// Each CLI is started through a LINK to its directory with a flag it must refuse. A guard that
// compares paths without realpath on both sides no-ops behind the link and exits 0 having done
// nothing; the naive-guard control proves the link really defeats such a guard on this OS.
{
  // realpath the temp dir itself: macOS's tmpdir is already behind /var -> /private/var, which
  // would put the CONTROL's direct run behind a link too.
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "guard-link-")));
  const links = [];
  const link = (target, at) => { symlinkSync(target, at, process.platform === "win32" ? "junction" : "dir"); links.push(at); };
  try {
    const scriptsLink = join(tmp, "scripts");
    let linked = true;
    try { link(SCRIPTS, scriptsLink); } catch (e) { linked = false; check("the scripts link for the main-guard fixture can be made", false, String(e.message)); }
    if (linked) {
      check("the fixture path resolves through the link to the real scripts", realpathSync(join(scriptsLink, "smoke.mjs")) === realpathSync(join(SCRIPTS, "smoke.mjs")) && resolve(scriptsLink) !== realpathSync(scriptsLink));
      for (const name of ["smoke", "harness-run", "lockfile-platforms", "node-floor"]) {
        const r = spawnSync(process.execPath, [join(scriptsLink, `${name}.mjs`), "--no-such-flag"], { encoding: "utf8", timeout: 20000 });
        check(`${name}.mjs run through a link still reaches main and refuses an unknown flag`, r.status === 2 && String(r.stderr).includes(`${name}:`), `status=${r.status} err=${JSON.stringify(String(r.stderr).slice(-200))}`);
      }
      const real = join(tmp, "real");
      mkdirSync(real);
      writeFileSync(join(real, "naive.mjs"), [
        'import { fileURLToPath } from "node:url";',
        "if (process.argv[1] === fileURLToPath(import.meta.url)) { console.error(\"naive: main ran\"); process.exitCode = 2; }",
        "",
      ].join("\n"));
      const naiveLink = join(tmp, "naive-link");
      link(real, naiveLink);
      const direct = spawnSync(process.execPath, [join(real, "naive.mjs")], { encoding: "utf8", timeout: 20000 });
      const viaLink = spawnSync(process.execPath, [join(naiveLink, "naive.mjs")], { encoding: "utf8", timeout: 20000 });
      check("CONTROL: a naive guard runs when called directly but silently no-ops through the same link",
        direct.status === 2 && viaLink.status === 0 && !String(viaLink.stderr).includes("main ran"),
        `direct=${direct.status} viaLink=${viaLink.status}`);
    }
  } finally {
    // The links go FIRST and on their own: a recursive delete must never walk through a link
    // into face/scripts. rmdir removes a junction or dir link without touching its target.
    for (const at of links) {
      try { rmdirSync(at); } catch { try { unlinkSync(at); } catch { /* reported by the survivor check below */ } }
    }
    const survivors = links.filter((at) => { try { lstatSync(at); return true; } catch { return false; } });
    check("every fixture link was removed before the temp dir", survivors.length === 0, survivors.join(","));
    if (survivors.length === 0) rmSync(tmp, { recursive: true, force: true });
  }
  check("face/scripts is intact after the link fixture", existsSync(join(SCRIPTS, "smoke.mjs")) && existsSync(join(SCRIPTS, "proc.mjs")));
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 60 ? 0 : 1;

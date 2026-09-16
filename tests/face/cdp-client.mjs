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
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
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

    const page = await cdp.openPage(s);
    const seen = [];
    page.on("Runtime.consoleAPICalled", (p) => seen.push(p.args[0].value));
    await s.send("Emit.events");
    check("a page only hears events for its own session id", page.sessionId === "S1" && seen.length === 1 && seen[0] === "mine");
    check("a malformed server message is counted, not thrown", s.malformed === 1);
    check("a page's send carries its session id", fake.received.some((m) => m.method === "Echo.ok") && page.targetId === "T1");

    fake.api.ping("pp");
    let pongOk = false;
    for (let i = 0; i < 30 && !pongOk; i++) { await new Promise((r) => setTimeout(r, 20)); pongOk = fake.pongs.some((b) => b.toString() === "pp"); }
    check("a server ping is answered with a pong carrying the same payload", pongOk);

    check("a call nobody answers times out instead of hanging", await rejectsLike(s.send("Never.answer"), /timed out/));
    const pending = s.send("Never.answer");
    fake.api.closeWith(1001);
    check("a server close rejects the calls still pending", await rejectsLike(pending, /Never\.answer/));
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
  const stale = cdp.findChrome({ env: { CHROME_BIN: "/gone", PATH: "/usr/bin" }, platform: "linux", exists: has("/usr/bin/google-chrome") });
  check("a CHROME_BIN that does not exist falls through and is named in `tried`", stale.path === "/usr/bin/google-chrome" && stale.tried.some((t) => t.includes("/gone")));
  const reg = cdp.findChrome({ env: {}, platform: "win32", exists: has("D:\\Chrome\\chrome.exe"), regQuery: () => ["D:\\Chrome\\chrome.exe"] });
  check("windows reads the App Paths registry value first", reg.path === "D:\\Chrome\\chrome.exe" && reg.source === "registry");
  const pf = join("C:\\PF", "Google", "Chrome", "Application", "chrome.exe");
  const pff = cdp.findChrome({ env: { ProgramFiles: "C:\\PF" }, platform: "win32", exists: has(pf), regQuery: () => [] });
  check("windows falls back to %ProgramFiles% when the registry has no value", pff.path === pf && pff.source === "ProgramFiles");
  const winMiss = cdp.findChrome({ env: { ProgramFiles: "C:\\PF", LOCALAPPDATA: "C:\\L" }, platform: "win32", exists: () => false, regQuery: () => { throw new Error("no reg"); } });
  check("a windows miss names the registry and every path it tried", winMiss.path === null && winMiss.tried.some((t) => /registry/.test(t)) && winMiss.tried.filter((t) => /ProgramFiles/.test(t)).length === 2);
  const mac = cdp.findChrome({ env: {}, platform: "darwin", exists: has("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") });
  check("macOS finds the /Applications bundle binary", mac.source === "Applications");
  const linuxMiss = cdp.findChrome({ env: { PATH: "/a:/b" }, platform: "linux", exists: () => false });
  check("a linux miss returns no path and a non-empty `tried`", linuxMiss.path === null && linuxMiss.tried.length >= 3);
}
check("chromeArgs adds --no-sandbox on linux only, and asks for port 0",
  cdp.chromeArgs({ userDataDir: "/t", platform: "linux" }).includes("--no-sandbox")
  && !cdp.chromeArgs({ userDataDir: "/t", platform: "win32" }).includes("--no-sandbox")
  && cdp.chromeArgs({ userDataDir: "/t", platform: "darwin" }).includes("--remote-debugging-port=0"));
check("DevToolsActivePort parses port and browser path", JSON.stringify(cdp.parseDevToolsActivePort("9222\n/devtools/browser/abc\n")) === JSON.stringify({ port: 9222, path: "/devtools/browser/abc" }));
check("a DevToolsActivePort with a bad port or path is refused",
  cdp.parseDevToolsActivePort("0\n/devtools/browser/x") === null && cdp.parseDevToolsActivePort("9222\n/other") === null && cdp.parseDevToolsActivePort("") === null);

// ---- Node floor ----
const floorCases = [["v18.20.4", false], ["v20.18.1", false], ["v20.19.0", true], ["v21.7.3", false], ["v22.11.0", false], ["v22.12.0", true], ["v24.1.0", true], ["banana", false]];
for (const [v, want] of floorCases) check(`node floor: ${v} is ${want ? "ok" : "below"}`, floor.meetsFloor(v).ok === want);
check("node floor reports the major so the suite can skip on 18 only", floor.meetsFloor("v18.20.4").major === 18 && floor.meetsFloor("v20.10.0").major === 20);

// ---- lockfile platform families ----
{
  const lock = JSON.parse(readFileSync(join(REPO, "face", "package-lock.json"), "utf8"));
  for (const [platform, arch, libc] of [["linux", "x64", "glibc"], ["darwin", "arm64", null], ["win32", "x64", null]]) {
    const r = lockMod.checkLockfile(lock, { platform, arch, libc });
    check(`the tracked lockfile covers ${platform}-${arch}`, r.ok && r.families >= 1, JSON.stringify(r));
  }
  const mutant = structuredClone(lock);
  for (const k of Object.keys(mutant.packages)) if (/binding-linux-x64-gnu$/.test(k)) delete mutant.packages[k];
  const m = lockMod.checkLockfile(mutant, { platform: "linux", arch: "x64", libc: "glibc" });
  check("a lockfile missing linux-x64-gnu names the family", !m.ok && m.missing.some((f) => f.includes("*")), JSON.stringify(m));
  const none = lockMod.checkLockfile({ packages: { "node_modules/fsevents": { os: ["darwin"], cpu: [], optional: true } } }, { platform: "linux", arch: "x64", libc: "glibc" });
  check("a lockfile with no families is an error, not a pass", !none.ok && /nothing was checked/.test(none.error));
  check("a v1 lockfile with no packages map is refused", !lockMod.checkLockfile({ dependencies: {} }, { platform: "linux", arch: "x64" }).ok);
}

// ---- smoke + harness pure half ----
{
  const good = { openable: 33, opened: 33, countedErrors: 0 };
  check("the verdict passes a full, clean run", smoke.judge(good).ok);
  const stub = JSON.parse(readFileSync(join(REPO, "tests", "fixtures", "face", "smoke-stub-report.json"), "utf8"));
  check("the verdict FAILS the stub report of a smoke that never navigated", !smoke.judge(stub).ok && smoke.judge(stub).reasons.some((r) => /opened=0/.test(r)));
  check("the verdict FAILS when nothing was openable", !smoke.judge({ openable: 0, opened: 0, countedErrors: 0 }).ok);
  check("the verdict FAILS one counted error", !smoke.judge({ ...good, countedErrors: 1 }).ok);
  const rooms = smoke.openableRooms({ rooms: [{ id: "today", status: "built" }, { id: "lane", status: "template" }, { id: "ops", status: "planned" }] });
  check("openable rooms exclude templates and keep planned rooms", JSON.stringify(rooms.openable) === JSON.stringify(["today", "ops"]) && rooms.notOpened[0] === "lane");
  check("a rooms payload with no array is a setup error", throwsLike(() => smoke.openableRooms({}), /rooms/));
  check("smoke refuses an unknown flag", throwsLike(() => smoke.parseArgs(["--chek"]), /unknown argument/));
  check("smoke refuses a flag with no value", throwsLike(() => smoke.parseArgs(["--base", "--door", "x"]), /needs a value/));
  check("smoke refuses a room timeout under a second", throwsLike(() => smoke.parseArgs(["--probe-file", "x", "--room-timeout-ms", "5"]), /1000/));
  check("smoke requires base, door and token outside probe mode", throwsLike(() => smoke.parseArgs(["--base", "http://x/"]), /required/));
  check("smoke parses an exclude list", JSON.stringify(smoke.parseArgs(["--probe-file", "p", "--exclude", "a, b,"]).exclude) === JSON.stringify(["a", "b"]));
  check("harness-run refuses an unknown flag and the --flag=value form",
    throwsLike(() => harness.parseArgs(["--exclude=a"]), /unknown/) && throwsLike(() => harness.parseArgs(["--keep"]), /unknown/));
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 60 ? 0 : 1;

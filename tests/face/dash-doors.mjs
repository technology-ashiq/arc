#!/usr/bin/env node
// dash-doors.mjs -- the L2 door contract suite (face REQ-09; ADR-1301/1302/1312).
// Self-contained: generates a seeded fixture spine in a temp dir, boots arc-dash in sim
// mode, drives every door and refusal, kills the server. Exit 0 = every check passed.
//
// VACUOUS-PASS GUARD: the first assertions prove the fixture LOADED (count moved) and the
// door SEES it -- before any behavioural check is trusted. "RAN: <n> checks" on the last
// line is what the bats wrapper asserts, so a suite that dies half-way cannot read green.

import { execFileSync, spawn } from "node:child_process";
import { connect } from "node:net";
import { mkdtempSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The door's OWN serializer, so the phase-title assertion below cannot drift from the
// representation contract it is checking against. Importing this module is sanctioned (its
// isMainModule guard is realpath-based, so an import boots nothing).
import { escapeDeep } from "../../.claude/scripts/hq/arc-dash.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PORT = 8410;
const TOKEN = "doors-token";
const ORIGIN = `http://127.0.0.1:${PORT}`;

const tmp = mkdtempSync(join(tmpdir(), "face-doors-"));
const SPINE = join(tmp, "spine");
const JOURNAL = join(tmp, "journal");

const gen = JSON.parse(execFileSync(process.execPath,
  [join(REPO, "tests/fixtures/face/gen-spine.mjs"), "--out", SPINE, "--count", "2000", "--days", "10", "--seed", "doors-1"],
  { stdio: ["ignore", "pipe", "inherit"] }).toString());

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

check("fixture loaded (vacuous-pass guard)", gen.events === 2000 && gen.openApproval, `events=${gen.events}`);

const dash = spawn(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--spine", SPINE, "--port", String(PORT)],
  { env: { ...process.env, ARC_DASH_TOKEN: TOKEN, ARC_DASH_JOURNAL_DIR: JOURNAL }, stdio: ["ignore", "ignore", "pipe"] });

const H = { Authorization: `Bearer ${TOKEN}` };
const j = async (path, opts = {}) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, opts);
  let body; try { body = await r.json(); } catch { body = {}; }
  return { status: r.status, body };
};

// wait for boot (up to 10s)
let up = false;
for (let i = 0; i < 50 && !up; i++) {
  await new Promise((r) => setTimeout(r, 200));
  try { up = (await j("/api/health", { headers: H })).status === 200; } catch { /* not yet */ }
}

try {
  check("server up", up);
  let r = await j("/api/health", { headers: H });
  check("door sees the whole fixture", r.body.spine && r.body.spine.events === 2000, `saw=${r.body.spine && r.body.spine.events}`);
  check("torn line reported not dropped", r.body.spine && r.body.spine.torn.length === 1);
  check("sealed days counted", r.body.spine && r.body.spine.daysClosed === 9);

  r = await j("/api/health");
  check("no token -> NO_TOKEN 401", r.status === 401 && r.body.error === "NO_TOKEN");
  r = await j("/api/health", { headers: { Authorization: "Bearer nope" } });
  check("bad token -> BAD_TOKEN 401", r.status === 401 && r.body.error === "BAD_TOKEN");
  r = await j("/api/health", { headers: { ...H, Origin: "http://evil.example" } });
  check("foreign Origin -> BAD_ORIGIN 403 even with token", r.status === 403 && r.body.error === "BAD_ORIGIN");

  r = await j("/api/spine?limit=5", { headers: H });
  check("page contract: count/more/next", r.status === 200 && r.body.count === 5 && r.body.more === true && !!r.body.next);
  const ids1 = r.body.events.map((e) => e.event.id);
  const r2 = await j(`/api/spine?limit=5&since=${r.body.next}`, { headers: H });
  check("cursor pages are disjoint", r2.status === 200 && !r2.body.events.some((e) => ids1.includes(e.event.id)));
  r = await j("/api/spine?since=01ARZ3NDEKTSV4RRFFQ69G5FAV", { headers: H });
  check("unknown cursor -> CURSOR_NOT_FOUND, never empty 200", r.status === 404 && r.body.error === "CURSOR_NOT_FOUND");
  r = await j("/api/spine?since=garbage", { headers: H });
  check("malformed cursor -> BAD_CURSOR", r.status === 400 && r.body.error === "BAD_CURSOR");
  r = await j("/api/spine?limit=5000", { headers: H });
  check("limit over cap -> LIMIT_INVALID", r.status === 400 && r.body.error === "LIMIT_INVALID");

  r = await j("/api/spine?kind=note.logged&limit=1000", { headers: H });
  const flat = JSON.stringify(r.body);
  check("hostile <script> arrives escaped", !flat.includes("<script>") && flat.includes("&lt;script&gt;"));

  r = await j("/api/brief?asof=2026-07-22", { headers: H });
  check("brief as-of renders", r.status === 200 && typeof r.body.text === "string" && r.body.text.length > 0);
  r = await j("/api/brief?asof=nonsense", { headers: H });
  check("bad asof -> BAD_ASOF", r.status === 400 && r.body.error === "BAD_ASOF");

  r = await j("/api/inbox", { headers: H });
  check("inbox folds open approvals", r.status === 200 && r.body.openCount >= 1);
  const openId = r.body.open[r.body.open.length - 1].id;

  r = await j("/api/board", { headers: H });
  check("board: file-not-log badge + machine headers", r.status === 200 && r.body.badge === "file, not log" && r.body.lanes.length >= 10);
  r = await j("/api/lane/face", { headers: H });
  check("lane header via the sanctioned parser", r.status === 200 && r.body.header && typeof r.body.header.status === "string");
  r = await j("/api/lane/no-such-lane", { headers: H });
  check("unknown lane -> UNKNOWN_LANE", r.status === 404 && r.body.error === "UNKNOWN_LANE");
  const badLaneStatus = r.status; // the traversal set below must land on THIS, not a sibling 4xx

  // ---- /api/lane/:name carries `phases` (phase-09: the specs the door never served) ----
  // The specs sat in the directory apiLane already read, so a lane room could name `phase 04`
  // and render nothing behind it. What is asserted here is the room's whole reason to exist:
  // the owner reads what the phase PROMISED, not the tracker's one-line summary of it.
  {
    const PH = join(REPO, "initiatives", "face", "phases");
    // POSITIVE CONTROL, FIRST. Every check under it is about a POPULATED array, and those
    // pass vacuously against an empty fixture -- so the tree is proven to hold specs before
    // the door is asked to prove it serves them.
    const onDisk = readdirSync(PH).filter((f) => f.endsWith(".md")).sort();
    check("positive control: this tree really holds face phase specs", onDisk.length >= 5, `onDisk=${onDisk.length}`);

    const lr = await j("/api/lane/face", { headers: H });
    // Read the array ONCE into a local that survives its own absence. Deleting the feature
    // used to kill this file at the first `.find` on undefined -- red, but red by crashing,
    // so the six checks after it never ran and the RAN line never printed. A block that dies
    // reports nothing; a block that fails reports which of its promises broke.
    const P = Array.isArray(lr.body.phases) ? lr.body.phases : null;
    check("lane WITH phases: the array is populated",
      lr.status === 200 && P !== null && P.length > 0, `n=${P && P.length}`);
    check("every spec on the tree comes through the door, none quietly dropped",
      P !== null && P.length === onDisk.length, `door=${P && P.length} disk=${onDisk.length}`);
    check("and the caps are declared as untouched rather than assumed",
      P !== null && lr.body.phasesOmitted === 0 && P.every((p) => p.truncated === false) && lr.body.phaseTextCap > 0,
      `omitted=${lr.body.phasesOmitted} cap=${lr.body.phaseTextCap}`);

    const last = onDisk[onDisk.length - 1];
    const spec = P ? P.find((p) => p.file === last) : undefined;
    const diskTitle = (readFileSync(join(PH, last), "utf8").split("\n")
      .map((l) => l.trim()).find((l) => /^#{1,6}[ \t]+\S/.test(l)) || "").replace(/^#{1,6}[ \t]+/, "").trim();
    check("an ACTUAL phase title comes back, through the door's own escape contract",
      Boolean(spec) && diskTitle.length > 0 && spec.title === escapeDeep(diskTitle), `${spec && spec.title} != ${diskTitle}`);
    check("the phase number and the spec filename come back",
      Boolean(spec) && Number.isInteger(spec.phase) && /^phase-\d+-.+\.md$/.test(spec.file), JSON.stringify(spec && { phase: spec.phase, file: spec.file }));
    // A title without the body is the tracker's summary with extra steps. `bytes` is the
    // file on disk and `text` arrives escaped, so the two are NOT comparable -- asserting
    // bytes >= text.length failed here for exactly that reason, which is the contract
    // working. Each is checked against the fact it actually reports.
    check("the BODY comes back, not just the title",
      Boolean(spec) && typeof spec.text === "string" && spec.text.length > 200 && spec.bytes > 200, `len=${spec && spec.text.length} bytes=${spec && spec.bytes}`);

    // A lane with NO phases/ dir. Discovered from the tree rather than named, so this cannot
    // pass by pointing at a lane that quietly grew a phases dir -- and the discovery is
    // itself a check, because "found none to ask about" is a dead fixture, not a pass.
    const laneDirs = readdirSync(join(REPO, "initiatives"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    const bare = laneDirs.filter((l) => existsSync(join(REPO, "initiatives", l, "PROGRESS.md")) && !existsSync(join(REPO, "initiatives", l, "phases")));
    check("fixture control: this tree has a lane with no phases dir to ask about", bare.length >= 1, `lanes=${laneDirs.length}`);
    const nr = await j(`/api/lane/${bare[0]}`, { headers: H });
    check("lane WITHOUT a phases dir still answers 200", nr.status === 200, `${bare[0]} -> ${nr.status}`);
    // The two facts that must not wear each other's clothes: "no phases" is an empty array,
    // "this door does not report phases" is an absent key. Assert the KEY, then the length.
    check("no phases dir -> the KEY IS PRESENT", Object.hasOwn(nr.body, "phases"), Object.keys(nr.body).join(","));
    check("no phases dir -> an EXPLICIT empty array", Array.isArray(nr.body.phases) && nr.body.phases.length === 0, JSON.stringify(nr.body.phases));

    // Traversal in the lane NAME. The guard is validLaneName -- the same one the handler
    // already used for a bad lane -- so the refusal must be that SAME status, not a sibling
    // 4xx that would tell an attacker the name was interesting.
    for (const attack of ["..%2F..%2FPORTFOLIO.md", "face%2F..%2F..%2Fpackage.json", "..%5C..%5CPORTFOLIO.md", "initiatives"]) {
      const tr = await j(`/api/lane/${attack}`, { headers: H });
      check(`traversal in the lane name refused: ${attack}`,
        tr.status === badLaneStatus && tr.body.error === "UNKNOWN_LANE" && !Object.hasOwn(tr.body, "phases"), `${tr.status} ${tr.body.error}`);
    }
    // `%2E%2E` is a case worth naming rather than deleting: the WHATWG URL parser treats a
    // percent-encoded double-dot as a dot-SEGMENT and removes it during parsing, so the path
    // collapses to /api/ and never reaches the lane handler at all. Same 404, earlier refusal
    // -- and pinning it stops a future hand-rolled path parser from quietly re-opening it.
    const dotSeg = await j("/api/lane/%2E%2E", { headers: H });
    check("percent-encoded dot-segment dies at the URL parser, same 404, no file served",
      dotSeg.status === badLaneStatus && dotSeg.body.error === "UNKNOWN_ROUTE" && !Object.hasOwn(dotSeg.body, "phases"), `${dotSeg.status} ${dotSeg.body.error}`);
  }

  r = await j("/api/file/constitution", { headers: H });
  check("allow-listed file + sha", r.status === 200 && /^[0-9a-f]{64}$/.test(r.body.sha256 || ""));
  r = await j("/api/file/secrets", { headers: H });
  check("unknown file id -> UNKNOWN_FILE_ID (server survives)", r.status === 404 && r.body.error === "UNKNOWN_FILE_ID");
  r = await j("/api/health", { headers: H });
  check("server alive after every refusal above", r.status === 200);

  const post = (path, body, extra = {}) => j(path, { method: "POST", headers: { ...H, "Content-Type": "application/json", ...extra }, body: JSON.stringify(body) });
  r = await post("/api/decide", { id: openId, verdict: "approve", reason: "x" });
  check("decide without Origin -> NO_ORIGIN", r.status === 403 && r.body.error === "NO_ORIGIN");
  r = await post("/api/decide", { id: openId, verdict: "maybe", reason: "x" }, { Origin: ORIGIN });
  check("bad verdict -> BAD_VERDICT", r.status === 400 && r.body.error === "BAD_VERDICT");
  r = await post("/api/decide", { id: openId, verdict: "approve", reason: "" }, { Origin: ORIGIN });
  check("empty reason refused (CLI's own BAD_ARGS)", r.status === 400);
  r = await post("/api/decide", { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", verdict: "approve", reason: "x" }, { Origin: ORIGIN });
  check("unknown approval -> UNKNOWN_APPROVAL", r.status === 404 && r.body.error === "UNKNOWN_APPROVAL");
  // The INVARIANT, not the current reason. This test first asserted PROCESS_NOT_LANDED and
  // went red the moment face-ask.process.yaml landed -- which is the gate working: it was
  // pinned to a transient state (the file's absence) rather than to the rule. The rule is
  // that /api/ask can never produce an answer except through the governed engine run, so a
  // 200 REQUIRES a receipted run behind it; anything else must be a NAMED refusal.
  r = await post("/api/ask", { q: "status" }, { Origin: ORIGIN });
  const askGoverned = r.status === 200
    ? (r.body && typeof r.body.answer === "string")
    : ["PROCESS_NOT_LANDED", "ASK_FAILED", "BAD_BODY"].includes(r.body.error);
  check("ask never answers ungoverned: a 200 comes from arc-run, else a named refusal", askGoverned, `${r.status} ${r.body.error || "(answered)"}`);
  r = await j("/api/emit", { headers: H });
  check("no second write door -> UNKNOWN_ROUTE", r.status === 404 && r.body.error === "UNKNOWN_ROUTE");
  r = await j("/api/pnl?asof=2026-07-22", { headers: H });
  check("pnl day-asof is a NAMED 501, not a wrong answer", r.status === 501 && r.body.error === "ASOF_UNSUPPORTED");

  const t1 = await (await fetch(`http://127.0.0.1:${PORT}/api/spine?asof=2026-07-22&limit=1000`, { headers: H })).text();
  const t2 = await (await fetch(`http://127.0.0.1:${PORT}/api/spine?asof=2026-07-22&limit=1000`, { headers: H })).text();
  check("as-of read is deterministic (byte-identical twice)", t1 === t2 && t1.length > 100);

  // --- adversarial-pass regressions (HTTP/boundary attacker, 2026-08-19) ---
  // Each pins ONE finding from that pass. A fix with no test is a fix that comes back.
  r = await j("/api/file/constructor", { headers: H });
  check("inherited key on the allow-list -> 404, not a 500 TypeError", r.status === 404 && r.body.error === "UNKNOWN_FILE_ID");
  r = await j("/api/file/__proto__", { headers: H });
  check("__proto__ on the allow-list -> 404", r.status === 404);
  r = await j("/api/lane/%", { headers: H });
  check("malformed percent-encoding -> 400 BAD_ARGS, not 500", r.status === 400 && r.body.error === "BAD_ARGS");
  // Raw socket, not fetch: `Host` is a forbidden header in fetch/undici and is silently
  // replaced -- a rebinding test written with fetch tests nothing (found by running it).
  const rawHost = await new Promise((res2) => {
    const sock = connect(PORT, "127.0.0.1", () => {
      sock.write(`GET /api/health HTTP/1.1\r\nHost: attacker.example\r\nAuthorization: Bearer ${TOKEN}\r\nConnection: close\r\n\r\n`);
    });
    let buf = "";
    sock.on("data", (d) => { buf += d.toString(); });
    sock.on("close", () => res2(buf));
    sock.on("error", () => res2(""));
  });
  check("foreign Host (DNS-rebinding) -> refused before auth", /^HTTP\/1\.1 403/.test(rawHost) && rawHost.includes("BAD_ORIGIN"), rawHost.split("\r\n")[0]);
  r = await j("/api/health", { headers: H });
  check("server alive after the whole adversarial set", r.status === 200);

  // route enumeration off the table the server actually dispatches from
  const routes = JSON.parse(execFileSync(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--routes"], { stdio: ["ignore", "pipe", "inherit"] }).toString());
  const mutating = routes.filter((x) => x.mutates);
  check("route enumeration: EXACTLY one mutating route, /api/decide", mutating.length === 1 && mutating[0].path === "/api/decide");
  // The above ALONE is circular -- it reads back the flag it asserts on, so a write route
  // labelled mutates:false (or with the key absent, which filter() silently drops) passes.
  // These three close that: every route must DECLARE an effect from a closed set, exactly
  // one may be "write", and any route causing a governed subprocess write must say so.
  const undeclared = routes.filter((x) => !["none", "write", "receipt"].includes(x.spineEffect));
  check("every route declares a spineEffect from the closed set (fails closed on a new one)", undeclared.length === 0, undeclared.map((x) => x.path).join(","));
  const writers = routes.filter((x) => x.spineEffect === "write");
  check("EXACTLY one route writes the spine itself", writers.length === 1 && writers[0].path === "/api/decide");
  const receipts = routes.filter((x) => x.spineEffect === "receipt");
  check("proxied spine effects are named, not hidden behind mutates:false", receipts.every((x) => typeof x.proxy === "string" && x.proxy.length > 0), receipts.map((x) => x.path).join(","));

  // ---- /api/rooms: the registry L3 renders from (REQ-01) ----
  // L3 must not carry a second spelling of the room list; the door serves the generated
  // registry and adds the one thing the registry cannot know -- what is actually alive.
  {
    const rr = await j("/api/rooms", { headers: H });
    check("rooms door answers", rr.status === 200, `status=${rr.status}`);
    // DERIVED from the registry on disk, not written down. This was `=== 33` and went red the
    // moment ADR-1317 generated `chat-mcp` -- a room declared in planned-rooms.json and ADR-1306
    // and generated nowhere, so the growth was a defect being FIXED, not a fixture breaking.
    //
    // The question this check actually asks is "does the door serve the WHOLE registry", and a
    // literal cannot ask that: it goes red on a legitimate addition and stays green if the door
    // and the registry drift to the same wrong number together. Against the file it is exact.
    const onDisk = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8")).rooms.length;
    check("the registry on disk has rooms to serve (vacuous-pass guard)", onDisk >= 30, `onDisk=${onDisk}`);
    check("rooms door serves the whole registry", rr.body.rooms && rr.body.rooms.length === onDisk, `served=${rr.body.rooms && rr.body.rooms.length} onDisk=${onDisk}`);

    // `inventories` (ADR-1317). The board's ADR map needs all fourteen bands at once, which
    // `holds` cannot give it: a room holds its own slice, and one band is not a smaller
    // version of a map. Asserted as PRESENT and POPULATED, because the field arriving as
    // undefined is exactly what the room renders as "the registry served no band map" -- a
    // sentence that would be a lie if the door simply forgot to pass it through.
    const invOnDisk = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8")).inventories || {};
    check("positive control: the registry on disk carries inventories", Object.keys(invOnDisk).length >= 3, JSON.stringify(Object.keys(invOnDisk)));
    check("the door serves inventories, not just holds", rr.body.inventories && typeof rr.body.inventories === "object", `got ${typeof rr.body.inventories}`);
    check("and every inventory the file has reaches the wire",
      rr.body.inventories && Object.keys(invOnDisk).every((k) => k in rr.body.inventories),
      `disk=${JSON.stringify(Object.keys(invOnDisk))} wire=${JSON.stringify(Object.keys(rr.body.inventories || {}))}`);
    check("the ADR bands come through with their rooms",
      rr.body.inventories && Object.keys(rr.body.inventories.adrs || {}).length >= 10,
      `bands=${Object.keys((rr.body.inventories || {}).adrs || {}).length}`);
    check("rooms door serves the five rings", Array.isArray(rr.body.rings) && rr.body.rings.length === 5, JSON.stringify(rr.body.rings));

    // THE REGRESSION PIN. readAll returns ENVELOPES ({ event, day, seq, line }), and the
    // first cut of this handler counted `e.kind` -- undefined on an envelope -- so every
    // event fell into ONE bucket and all 24 kind-bearing rooms reported "unexercised".
    // The route answered 200 with a well-formed lie, and only a probe against a real
    // fixture caught it. A bare-`e.kind` regression makes this exactly 1. The fixture is
    // seeded, so the count is deterministic and a floor above 1 kills the defect.
    check("kind counting reads THROUGH the envelope (bare e.kind gives exactly 1)",
      rr.body.kindsEverFired > 1, `kindsEverFired=${rr.body.kindsEverFired}`);
    const live = rr.body.rooms.filter((x) => x.live.state === "live");
    check("the seeded fixture lights up real rooms, not zero", live.length >= 5, `live=${live.length}`);

    // Honesty, both directions: no room may claim receipts the log does not hold, and every
    // room must declare one of the four states rather than a bare zero.
    const overclaim = rr.body.rooms.filter((x) => x.live.receipts > gen.events);
    check("no room claims more receipts than the log holds", overclaim.length === 0, overclaim.map((x) => x.id).join(","));
    const STATES = ["live", "unexercised", "file-borne", "index"];
    const badState = rr.body.rooms.filter((x) => !STATES.includes(x.live.state));
    check("every room declares an honest state, never a bare zero", badState.length === 0, badState.map((x) => `${x.id}:${x.live.state}`).join(","));
    const noSentence = rr.body.rooms.filter((x) => !x.sentence || !x.sentence.trim());
    check("every room the door serves carries its opening sentence", noSentence.length === 0, noSentence.map((x) => x.id).join(","));
    // An index room derives no kinds by design; a NON-index room that homes kinds and
    // reports zero homed would mean the registry's holds block was dropped in transit.
    const lostHolds = rr.body.rooms.filter((x) => x.live.state !== "index" && x.live.kindsHomed === 0 && x.live.state !== "file-borne");
    check("no room lost its holds block in transit", lostHolds.length === 0, lostHolds.map((x) => x.id).join(","));
  }

  // journal wrote real entries
  const jf = readdirSync(JOURNAL).filter((f) => f.startsWith("journal-"));
  const jlines = jf.length ? readFileSync(join(JOURNAL, jf[0]), "utf8").trim().split("\n") : [];
  check("request journal wrote entries", jlines.length >= 10, `lines=${jlines.length}`);
} finally {
  await new Promise((r) => { dash.on("exit", r); dash.kill(); setTimeout(r, 1500); });
}

// ---------------------------------------------------------------------------------------
// The launcher's seam with the app's dev proxy.
//
// arc-face spawns both halves and tells the app where the door is, through an environment
// variable. The app reads that name in face/vite.config.ts. Nothing links the two, so a
// rename on either side compiles, starts, serves 200 -- and silently proxies to the DEFAULT
// door port instead. That is not a hypothetical: the first cut of the launcher set
// ARC_DASH_URL while the proxy read ARC_DASH_ORIGIN, and the app came up perfectly, showing
// a DIFFERENT session's spine. A connection error would have been kinder.
//
// So the two names are pinned against each other, from the sources, in both directions.
const launcherSrc = readFileSync(join(REPO, ".claude", "scripts", "hq", "arc-face.mjs"), "utf8");
const viteSrc = readFileSync(join(REPO, "face", "vite.config.ts"), "utf8");
// A SET comparison, not a count. The first cut asserted "exactly one ARC_ variable" and went
// red the moment a SECOND legitimate seam was added (the app port, after `--app-port` was
// found to move the listener while the origin allow-list stayed pinned to the default). The
// question was never how many there are; it is whether every name the proxy READS is a name
// the launcher SETS, and vice versa. Either half missing is the same silent-fallback bug.
const declared = [...launcherSrc.matchAll(/^export const [A-Z_]*ENV = "([A-Z_]+)";/gm)].map((m) => m[1]).sort();
const proxyReads = [...new Set([...viteSrc.matchAll(/process\.env\.(ARC_[A-Z_]+)/g)].map((m) => m[1]))].sort();
check("the launcher declares its env seams", declared.length >= 2, JSON.stringify(declared));
check("the app's dev config reads ARC_ variables", proxyReads.length >= 2, JSON.stringify(proxyReads));
check("every name the config READS is one the launcher SETS",
  proxyReads.every((n) => declared.includes(n)), `reads ${JSON.stringify(proxyReads)} declared ${JSON.stringify(declared)}`);
check("and every name the launcher SETS is one the config READS",
  declared.every((n) => proxyReads.includes(n)), `declared ${JSON.stringify(declared)} reads ${JSON.stringify(proxyReads)}`);
// The app port seam specifically: the config must derive BOTH the listener and the origin
// allow-list from it, because deriving only one is the exact split that let every read work
// and every stamp 403.
check("the config derives its listen port from the seam", /port:\s*APP_PORT/.test(viteSrc), "server.port is not APP_PORT");
check("and its self-origin set from the same seam", (viteSrc.match(/\$\{APP_PORT\}/g) || []).length >= 3, "SELF_ORIGINS does not use APP_PORT");
// Positive control: the pin must be reading real files, not empty strings.
check("both sources were actually read", launcherSrc.length > 2000 && viteSrc.length > 500, `launcher=${launcherSrc.length} vite=${viteSrc.length}`);

// ---------------------------------------------------------------------------------------
// The DOOR writes the journal; face-dogfood READS it. Two files, one path, and nothing linked
// them -- so face-dogfood defaulted to `.claude/state/hq/dash-journal`, which the door has
// never written to. The tool that settles REQ-10 could not find its own input and would have
// failed closed with "no journal directory" on the owner's real tree: honest, and useless.
//
// Pinned from BOTH sources, the same way the env-seam pin above works, because the failure is
// silent on both sides: the door writes happily to a directory nobody reads, and the reader
// reports an empty world it never looked at.
const dashSrc = readFileSync(join(REPO, ".claude", "scripts", "hq", "arc-dash.mjs"), "utf8");
const dogfoodSrc = readFileSync(join(REPO, ".claude", "scripts", "core", "face-dogfood.mjs"), "utf8");
check("the door derives its journal dir from dirname(spineRoot) + face",
  /journalDir = process\.env\.ARC_DASH_JOURNAL_DIR \|\| join\(dirname\(root\), "face"\)/.test(dashSrc),
  "arc-dash's journal default moved -- re-read it and update the reader");
// The old literal is tested for on CODE lines only. The first cut grepped the whole file and
// went red on the COMMENT that explains the bug -- a check that cannot tell prose from code
// forces you to stop writing the explanation, which is a worse trade than the drift it guards.
const dogfoodCode = dogfoodSrc.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
check("and the reader derives the SAME shape, not a literal of its own",
  /join\(dirname\(spineRoot\), "face"\)/.test(dogfoodSrc) && !/dash-journal/.test(dogfoodCode),
  "face-dogfood is not deriving the door's path");
check("both honour ARC_DASH_JOURNAL_DIR, so an override moves BOTH",
  /ARC_DASH_JOURNAL_DIR/.test(dashSrc) && /ARC_DASH_JOURNAL_DIR/.test(dogfoodSrc));
// Positive control: the pin must be reading real files.
check("both sources were actually read (journal pin)", dashSrc.length > 5000 && dogfoodSrc.length > 3000);

console.log(`RAN: ${ran} checks, ${failed} failed`);
// The floor moves with the suite. A count that stays at an old number is how a block that
// stopped registering reads green: the assertions still pass, there are simply fewer of them.
process.exitCode = failed === 0 && ran >= 72 ? 0 : 1;

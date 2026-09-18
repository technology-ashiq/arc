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
import { createHash } from "node:crypto";
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

// `--phase04 1`: one block of the receipts face v2 Phase 04's read routes fold, so each route's arm below asserts a
// payload that came from a receipt, never an empty list that would pass on a door reading nothing.
const gen = JSON.parse(execFileSync(process.execPath,
  [join(REPO, "tests/fixtures/face/gen-spine.mjs"), "--out", SPINE, "--count", "2000", "--days", "10", "--seed", "doors-1", "--phase04", "1"],
  { stdio: ["ignore", "pipe", "inherit"] }).toString());

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

check("fixture loaded (vacuous-pass guard)", gen.base === 2000 && gen.phase04 === 24 && gen.events === 2024 && gen.openApproval, `events=${gen.events} base=${gen.base} phase04=${gen.phase04}`);

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
  check("door sees the whole fixture", r.body.spine && r.body.spine.events === gen.events, `saw=${r.body.spine && r.body.spine.events}`);
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

  // ---- face v2 Phase 04 (REQ-06): the read routes Phase 03's NOT SERVED lists named ----
  // One arm per route, and every arm proves its INPUT first -- the file on this tree, or the receipts the fixture's
  // Phase 04 block wrote -- before it asserts what the door served from it. A route answering 200 with an empty list
  // would pass a shape check on a door that read nothing; each arm names a row that can only come from the input.
  {
    const disk = (rel) => readFileSync(join(REPO, rel), "utf8");
    const sha = (rel) => createHash("sha256").update(disk(rel)).digest("hex");
    const route = async (path) => {
      const res = await j(path, { headers: H });
      // Every Phase 04 route names itself, its parser and the files it parsed (with the file's own sha256).
      const named = res.status === 200 && res.body.route === path.split("?")[0] && typeof res.body.parser === "string" && res.body.parser.length > 0 && Array.isArray(res.body.sources);
      return { ...res, named };
    };
    const sourced = (res, rel) => res.body.sources.some((s) => s.path === rel && s.sha256 === sha(rel));
    const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
    const LEAD_A = `lead_hmac_v1_${"a".repeat(32)}`;
    const LEAD_B = `lead_hmac_v1_${"b".repeat(32)}`;

    // /api/engine -- the router file, parsed; the bench's ceilings; the drivers on disk.
    {
      // The class keys of the `classes:` block alone -- `models:` has two-space keys too, and they are tiers, not classes.
      const routerText = disk("engine/router.yaml");
      const classesBlock = routerText.slice(routerText.indexOf("\nclasses:\n"), routerText.indexOf("\ndefault:\n"));
      const classesOnDisk = [...classesBlock.matchAll(/^ {2}([a-z][a-z0-9-]*):\s*$/gm)].map((m) => m[1]);
      const driversOnDisk = readdirSync(join(REPO, ".claude/scripts/engine/drivers")).filter((f) => f.endsWith(".sh")).map((f) => f.slice(0, -3)).sort();
      check("P04 engine: positive control -- the router routes classes and ships drivers", classesOnDisk.length >= 3 && driversOnDisk.length >= 2, `classes=${classesOnDisk.length} drivers=${driversOnDisk.length}`);
      const e = await route("/api/engine");
      check("P04 engine: named, and parsed from THIS router file (sha)", e.named && sourced(e, "engine/router.yaml"), JSON.stringify(e.body.sources));
      check("P04 engine: every class row the router file names is served, plus the default row",
        Array.isArray(e.body.classes) && classesOnDisk.every((c) => e.body.classes.some((x) => x.name === c)) && e.body.classes.some((x) => x.name === "default"), JSON.stringify((e.body.classes || []).map((x) => x.name)));
      check("P04 engine: the drivers are the scripts on disk", JSON.stringify(e.body.drivers) === JSON.stringify(driversOnDisk), JSON.stringify(e.body.drivers));
      check("P04 engine: the budgets come from the bench's ceiling file", e.body.budgets && Array.isArray(e.body.budgets.rows) && e.body.budgets.rows.length >= 1 && sourced(e, "initiatives/bench/ceilings.json"), JSON.stringify(e.body.budgets));
    }
    // /api/model-policy -- the tier block and the process routes, from the same file.
    {
      const m = await route("/api/model-policy");
      check("P04 model-policy: named, parsed from THIS router file", m.named && sourced(m, "engine/router.yaml"));
      check("P04 model-policy: the four ADR-0069 tiers, each with its implementation where one is pinned",
        Array.isArray(m.body.tiers) && m.body.tiers.map((t) => t.tier).join(",") === "cheap-scan,balanced-workhorse,high-judgment,independent-family-verifier"
        && m.body.tiers[0].models.some((x) => x.driver === "claude-code" && x.model === "haiku"), JSON.stringify(m.body.tiers));
      check("P04 model-policy: a hire's four terms reach the wire, judged against today", (m.body.classes || []).some((c) => c.runtime === true && c.cap !== "" && c.review_by !== "" && typeof c.expired === "boolean") && m.body.today === today, JSON.stringify(m.body.today));
    }
    // /api/policy -- the ceilings in the file, the cap folded from the fixture's one level-change receipt.
    {
      const subjectsOnDisk = [...disk("hq.policy.yaml").matchAll(/^ {2}"([a-z]+:[a-z0-9:-]+)":\s*$/gm)].map((m) => m[1]);
      check("P04 policy: positive control -- the policy file declares subjects", subjectsOnDisk.length >= 3, String(subjectsOnDisk.length));
      const p = await route("/api/policy");
      check("P04 policy: named, parsed from THIS policy file", p.named && sourced(p, "hq.policy.yaml"));
      check("P04 policy: one row per subject the file declares", Array.isArray(p.body.subjects) && JSON.stringify(p.body.subjects.map((s) => s.subject).sort()) === JSON.stringify(subjectsOnDisk.slice().sort()), JSON.stringify((p.body.subjects || []).map((s) => s.subject)));
      const rd = (p.body.subjects || []).find((s) => s.subject === "process:review-diff");
      const readCell = rd && rd.cells.find((c) => c.capability === "read");
      check("P04 policy: the fixture's level change is FOLDED -- read on review-diff is L2 under an L3 ceiling, from exactly 1 transition",
        p.body.transitions === 1 && readCell && readCell.ceiling === "L3" && readCell.cap === "L2" && readCell.effective === "L2", JSON.stringify(readCell));
    }
    // /api/jobs -- the schedule file, judged against the fixture's one fire.
    {
      const jobsOnDisk = [...disk("hq.jobs.yaml").matchAll(/^ {2}- name: ([a-z][a-z0-9-]*)\s*$/gm)].map((m) => m[1]);
      check("P04 jobs: positive control -- the schedule registers jobs", jobsOnDisk.length >= 1, String(jobsOnDisk.length));
      const jb = await route("/api/jobs");
      check("P04 jobs: named, parsed from THIS schedule", jb.named && sourced(jb, "hq.jobs.yaml"));
      check("P04 jobs: every registered job is judged", Array.isArray(jb.body.jobs) && JSON.stringify(jb.body.jobs.map((x) => x.name).sort()) === JSON.stringify(jobsOnDisk.slice().sort()));
      const bm = (jb.body.jobs || []).find((x) => x.name === "brief-materialize");
      check("P04 jobs: the fixture's fire is the job's last run, and its next fire is an IST timestamp",
        bm && typeof bm.lastRun === "string" && bm.lastRun.startsWith("2026-07-20T") && /\+05:30$/.test(bm.nextExpected || "") && typeof bm.overdue === "boolean", JSON.stringify(bm));
    }
    // /api/evolve -- the fixture's experiment, folded by the evolve lane's board.
    {
      const ev = await route("/api/evolve");
      const x = (ev.body.experiments || []).find((e) => e.id === "x-fixture");
      check("P04 evolve: named, and the fixture's experiment is folded with both arms", ev.named && x && x.arms.join(",") === "+a,+b", JSON.stringify(ev.body.experiments));
      check("P04 evolve: its one window is complete and each arm counts one unit", x && x.metrics.length === 1 && x.metrics[0].complete === 1 && x.metrics[0].arms.every((a) => a.units === 1), JSON.stringify(x && x.metrics));
      check("P04 evolve: the manifests were read for a contract", typeof ev.body.manifestsRead === "number" && ev.body.manifestsRead >= 1 && Array.isArray(ev.body.contracts));
    }
    // /api/memory and /api/learn -- the retro log, by the memory lane's adapter.
    {
      const rows = disk("docs/retro-log.md").split("\n").filter((l) => /^\d{4}-\d{2}-\d{2}\s*\|/.test(l));
      check("P04 memory: positive control -- the retro log has dated rows", rows.length >= 10, String(rows.length));
      const me = await route("/api/memory");
      check("P04 memory: named, parsed from THIS retro log", me.named && sourced(me, "docs/retro-log.md"));
      check("P04 memory: every lesson row the adapter keeps is served (scoreboard and malformed rows aside)",
        Array.isArray(me.body.lessons) && me.body.lessons.length >= 10 && me.body.lessons.length + me.body.malformed <= rows.length, `lessons=${(me.body.lessons || []).length} rows=${rows.length}`);
      const le = await route("/api/learn");
      check("P04 learn: named, the same rules, and this week's are a subset dated inside the week",
        le.named && Array.isArray(le.body.rules) && le.body.rules.length === me.body.lessons.length && Array.isArray(le.body.thisWeek)
        && le.body.thisWeek.every((l) => l.date >= le.body.weekFrom && l.date <= le.body.today), `rules=${(le.body.rules || []).length} week=${(le.body.thisWeek || []).length}`);
    }
    // /api/bench, /api/council, /api/roster -- receipts only the fixture's Phase 04 block wrote.
    {
      const b = await route("/api/bench");
      check("P04 spine: a log route counts the torn line the fixture carries, as /api/health does", b.body.spine && b.body.spine.torn === 1 && b.body.spine.skipped === 0, JSON.stringify(b.body.spine));
      check("P04 bench: named, and the one scored run is served with NO PROPOSAL as its class's result",
        b.named && Array.isArray(b.body.runs) && b.body.runs.length === 1 && /NO PROPOSAL/.test(b.body.runs[0].classes[0].reason), JSON.stringify(b.body.runs));
      const c = await route("/api/council");
      const scored = (c.body.verdicts || []).find((v) => v.session === "c-fixture-1");
      check("P04 council: named, two verdicts, the scored one carries its outcome", c.named && c.body.verdicts.length === 2 && scored && scored.outcome === "happened", JSON.stringify(c.body.verdicts));
      check("P04 council: calibration below the floor reports NO figure", c.body.calibration && c.body.calibration.scored === 1 && c.body.calibration.brier === null && c.body.calibration.floor === 20, JSON.stringify(c.body.calibration));
      const ro = await route("/api/roster");
      check("P04 roster: named, the runtime hire is on the books, and its dispatch is served", ro.named && sourced(ro, "engine/router.yaml")
        && ro.body.hires.some((h) => h.name === "build-in-public-draft" && h.driver === "hermes") && ro.body.runs.length === 1 && ro.body.runs[0].driver === "hermes", JSON.stringify(ro.body.runs));
    }
    // /api/slices -- every LIVE lane's current phase, by develop's ledger parser.
    {
      const sl = await route("/api/slices");
      check("P04 slices: named, and every lane it lists reads LIVE with a phase", sl.named && Array.isArray(sl.body.lanes) && sl.body.lanes.length >= 1 && sl.body.lanes.every((l) => typeof l.phase === "string"), JSON.stringify((sl.body.lanes || []).map((l) => `${l.lane}:${l.phase}:${l.present}`)));
      const present = (sl.body.lanes || []).filter((l) => l.present);
      check("P04 slices: a lane with a task file has its slices counted, proven never above total",
        present.every((l) => l.slices.length === l.total && l.proven <= l.total && sourced(sl, l.file)), JSON.stringify(present.map((l) => `${l.lane}:${l.proven}/${l.total}`)));
    }
    // /api/gates -- the gates file, and the profile name where arc-profile.sh reads it.
    {
      const gatesOnDisk = [...disk("arc.gates.yaml").matchAll(/^ {2}- name: ([a-z][a-z0-9-]*)\s*$/gm)].map((m) => m[1]);
      const g = await route("/api/gates");
      check("P04 gates: named, parsed from THIS gates file, every gate by name", g.named && sourced(g, "arc.gates.yaml") && gatesOnDisk.length >= 3
        && JSON.stringify(g.body.gates.map((x) => x.name)) === JSON.stringify(gatesOnDisk), JSON.stringify(g.body.gates && g.body.gates.map((x) => x.name)));
      // The profile is what arc-profile.sh itself answers in this environment -- the door runs the resolver, it does not
      // re-read its precedence -- and a "profile" gate carries the mode the resolver gave it.
      const profile = execFileSync("bash", [join(REPO, ".claude/scripts/core/arc-profile.sh"), "name"], { cwd: REPO }).toString().trim();
      check("P04 gates: the profile is the one arc-profile.sh resolves", profile.length > 0 && g.body.profile === profile && g.body.profileRefused === "", `${g.body.profile} vs ${profile} (${g.body.profileRefused})`);
      const scan = g.body.gates.find((x) => x.name === "scan");
      const scanMode = execFileSync("bash", [join(REPO, ".claude/scripts/core/arc-profile.sh"), "mode", "scan"], { cwd: REPO }).toString().trim();
      check("P04 gates: a profile-mode gate carries the mode the resolver gives it", scan && scan.mode === "profile" && scan.resolved === scanMode && /^(warn|block)$/.test(scanMode), JSON.stringify(scan));
    }
    // /api/adrs -- every ADR file, by the memory lane's ADR adapter.
    {
      const files = readdirSync(join(REPO, "docs/adr")).filter((n) => /^\d{4}-.+\.md$/.test(n));
      const a = await route("/api/adrs");
      check("P04 adrs: named, and one record per ADR file", a.named && files.length >= 100 && a.body.files === files.length && a.body.adrs.length === files.length, `files=${files.length} served=${(a.body.adrs || []).length}`);
      check("P04 adrs: each record carries its number and century", a.body.adrs.every((x) => /^\d{4}$/.test(x.number) && x.century === `${x.number.slice(0, 2)}00`));
    }
    // /api/growth -- the fixture's piece and its correction: the head of the chain is the correction.
    {
      const gr = await route("/api/growth");
      check("P04 growth: named, ONE published piece -- the correction at the chain's head -- and the one it superseded",
        gr.named && gr.body.published.length === 1 && gr.body.published[0].title === "Fixture piece, corrected" && gr.body.superseded === 1, JSON.stringify(gr.body.published));
      check("P04 growth: the cluster plan is served with its approval still open", gr.body.clusters.length === 1 && gr.body.clusters[0].verdict === "open", JSON.stringify(gr.body.clusters));
    }
    // /api/leads -- HMAC ids only, never a contact.
    {
      const ld = await route("/api/leads");
      check("P04 leads: named, both fixture leads by their HMAC id, the suppressed one listed", ld.named
        && JSON.stringify(ld.body.leads.map((l) => l.lead_id)) === JSON.stringify([LEAD_A, LEAD_B]) && JSON.stringify(ld.body.suppressed) === JSON.stringify([LEAD_B]) && ld.body.idsWithheld === 0, JSON.stringify(ld.body.leads));
      check("P04 leads: touches counted from the receipts -- two to one lead, one to the other", ld.body.leads[0].touches === 2 && ld.body.leads[1].touches === 1);
      check("P04 leads: the caps are numbers from config, and no email-shaped string is on the wire",
        typeof ld.body.caps.per_ist_day === "number" && !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(JSON.stringify(ld.body)), JSON.stringify(ld.body.caps));
    }
    // /api/legal -- the seals by the constitution's own parser, the publish gate from the fixture's decided approval.
    {
      const lg = await route("/api/legal");
      check("P04 legal: named, parsed from THIS constitution and policy file", lg.named && sourced(lg, "CONSTITUTION.md") && sourced(lg, "hq.policy.yaml"));
      check("P04 legal: five seals, each quoted element for element", lg.body.seals.length === 5 && lg.body.seals.every((s) => s.quoted === true) && lg.body.quoteHolds === true, JSON.stringify(lg.body.seals));
      check("P04 legal: the fixture's held piece is served with the stamp that decided it", lg.body.publishGate.length === 1 && lg.body.publishGate[0].state === "approve", JSON.stringify(lg.body.publishGate));
    }
    // /api/ventures -- the criteria file by the ledger's parser, the kill panel, and no OS path on the wire.
    {
      const namesOnDisk = [...disk("ventures.yaml").matchAll(/^ {2}([a-z][a-z0-9-]*):\s*$/gm)].map((m) => m[1]);
      const v = await route("/api/ventures");
      check("P04 ventures: named, parsed from THIS criteria file, every venture it declares", v.named && sourced(v, "ventures.yaml") && namesOnDisk.length >= 1
        && JSON.stringify(v.body.ventures.map((x) => x.name)) === JSON.stringify(namesOnDisk), JSON.stringify(v.body.ventures));
      check("P04 ventures: the closed set of criteria, and a digest", v.body.criteria.join(",") === "days_without_revenue,traffic_floor_monthly" && /^[0-9a-f]{64}$/.test(v.body.digest));
      check("P04 ventures: the kill panel's path is repo-relative -- no drive, no home directory", !/^([A-Za-z]:|\/)/.test(v.body.kill.path) && !/Users|home/.test(v.body.kill.path), v.body.kill.path);
    }
    // /api/absorb -- the registry by absorb's own lint.
    {
      const reg = JSON.parse(disk("products/absorb/registry.json"));
      const ab = await route("/api/absorb");
      check("P04 absorb: named, every technique in the registry, the cap the lint enforces", ab.named && sourced(ab, "products/absorb/registry.json")
        && ab.body.techniques.length === reg.techniques.length && reg.techniques.length >= 1 && ab.body.cap === 12, `served=${(ab.body.techniques || []).length}`);
      check("P04 absorb: the adopted count per lane is the lint's", ab.body.adoptedPerLane.reduce((n, x) => n + x.adopted, 0) === reg.techniques.filter((t) => t.status === "adopted").length);
    }
    // /api/pnl?by=day -- the money brain's day series; an unread key is refused, not ignored.
    {
      const d = await j("/api/pnl?by=day", { headers: H });
      // The door's day series is today's window; WHAT it buckets is proven against the fixture's own day in
      // tests/face/phase04-folds.mjs, where deriveDaily is handed that day. Here: the wire shape, and nothing summed.
      check("P04 pnl by=day: fourteen IST days ending today, each substance its own field, never a total",
        d.status === 200 && d.body.route === "/api/pnl" && d.body.by === "day" && d.body.series.length === 14 && d.body.series[13].day === today
        && d.body.series.every((x) => typeof x.realMinor === "number" && typeof x.simulatedMinor === "number" && Array.isArray(x.costLines) && typeof x.unmeasuredCostLines === "number" && !("total" in x))
        && typeof d.body.needsYou === "object" && typeof d.body.needsYou.real === "number" && typeof d.body.needsYou.simulated === "number", JSON.stringify(d.body.series && d.body.series[13]));
      for (const q of ["by=week", "by=day&month=2026-07", "bogus=1", "by=day&by=week", "month=2026-07&month=2026-08", "simulated=true"]) {
        const bad = await j(`/api/pnl?${q}`, { headers: H });
        check(`P04 pnl: ?${q} is REFUSED by name, never answered with the month model`, bad.status === 400 && bad.body.error === "BAD_ARGS", `${bad.status} ${bad.body.error}`);
      }
      const mo = await j("/api/pnl?month=2026-07", { headers: H });
      check("P04 pnl: the month model still answers", mo.status === 200 && mo.body.month === "2026-07" && mo.body.model);
    }
    // Every Phase 04 route refuses a query it does not read, and none of them writes.
    {
      const q = await j("/api/jobs?x=1", { headers: H });
      check("P04: a query key a route does not read is BAD_ARGS", q.status === 400 && q.body.error === "BAD_ARGS", `${q.status} ${q.body.error}`);
      const table = JSON.parse(execFileSync(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--routes"], { stdio: ["ignore", "pipe", "inherit"] }).toString());
      const P04 = ["/api/engine", "/api/model-policy", "/api/policy", "/api/jobs", "/api/evolve", "/api/memory", "/api/bench", "/api/roster", "/api/council", "/api/slices", "/api/gates", "/api/learn", "/api/adrs", "/api/growth", "/api/leads", "/api/legal", "/api/ventures", "/api/absorb"];
      const rows = P04.map((p) => table.filter((t) => t.path === p));
      check("P04 route table: each route is on it EXACTLY once, GET, mutates:false, spineEffect none",
        rows.every((r) => r.length === 1 && r[0].method === "GET" && r[0].mutates === false && r[0].spineEffect === "none"), JSON.stringify(rows.map((r) => r.length)));
      // The list above is the union of Phase 03's NOT SERVED lists' SERVED routes: a route on the table that is on
      // none of them was not asked for (the spec's first exit criterion).
      const input = readdirSync(join(REPO, "initiatives/face/evidence/phase-03")).filter((n) => /^not-served-.+\.md$/.test(n))
        .flatMap((n) => [...disk(`initiatives/face/evidence/phase-03/${n}`).matchAll(/\| `(\/api\/[a-z-]+)[^`]*` \|/g)].map((m) => m[1]));
      check("P04 route list: every Phase 04 route is one a Phase 03 NOT SERVED list named", input.length >= 40 && P04.every((p) => input.includes(p)), P04.filter((p) => !input.includes(p)).join(","));
    }
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
process.exitCode = failed === 0 && ran >= 131 ? 0 : 1;

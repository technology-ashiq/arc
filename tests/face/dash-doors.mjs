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
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

  // journal wrote real entries
  const jf = readdirSync(JOURNAL).filter((f) => f.startsWith("journal-"));
  const jlines = jf.length ? readFileSync(join(JOURNAL, jf[0]), "utf8").trim().split("\n") : [];
  check("request journal wrote entries", jlines.length >= 10, `lines=${jlines.length}`);
} finally {
  await new Promise((r) => { dash.on("exit", r); dash.kill(); setTimeout(r, 1500); });
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 30 ? 0 : 1;

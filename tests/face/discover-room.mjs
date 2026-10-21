#!/usr/bin/env node
// discover-room.mjs -- GET /api/discover and the money/discover room it feeds (face v2 Phase 17, REQ-21, ADR-1356).
//
// What it proves, each check failing when the decision it names is removed:
//   ROUTE      over a sandbox spine holding one capture, one hunt, one judge, one open and one rejected winner, the route
//              returns each with the right state; it takes no query
//   EDGES      an empty spine is zero counts marked zero; an unreadable day is `unknown` naming the day, never 0; a face
//              idea.captured (no discover process) is not counted -- and the mutant that counts it is caught
//   GRAMMAR    the winner gate and the process are spelled nowhere under face/ or in the door's route and reads.mjs
//   ROOM       the room is not planned: no data-planned, no dotted line, no REHEARSAL card, and its View draws what the
//              fold returned
//
// VACUOUS-PASS GUARD: the first check proves the modules loaded; the last line is "RAN: <n> checks, <f> failed".
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const HQ = join(REPO, ".claude", "scripts", "hq");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${String(detail).slice(0, 600)}`); }
  else console.log(`ok ${name}`);
};

const R = await import(pathToFileURL(join(HQ, "lib", "face", "discover", "route.mjs")).href);
const D = await import(pathToFileURL(join(REPO, ".claude", "scripts", "discover", "lib", "spine.mjs")).href);
check("the route and discover's constants loaded (vacuous-pass guard)", typeof R.apiDiscover === "function" && typeof R.discoverBody === "function" && typeof D.PROCESS === "string");
const C = await R.discoverConstants();
check("ROUTE: the constants are discover's own -- the process name and the winner gate it exports", C.name === D.PROCESS.slice(0, D.PROCESS.indexOf("@")) && C.gate === D.WINNER_GATE, JSON.stringify(C));
let missing = null, broken = null;
try { await R.discoverConstants(() => Promise.reject(new Error("never asked")), join(tmpdir(), "no-such-discover-spine.mjs")); } catch (e) { missing = e; }
try { await R.discoverConstants(() => Promise.reject(Object.assign(new Error("syntax"), { code: "ERR_X" }))); } catch (e) { broken = e; }
check("ROUTE: a checkout without discover answers SOURCE_ABSENT by name, never a crashed door", missing !== null && missing.code === "SOURCE_ABSENT", missing && missing.message);
check("ROUTE: a discover that is there and will not load is SOURCE_INVALID with its code, not a missing product", broken !== null && broken.code === "SOURCE_INVALID" && /ERR_X/.test(broken.message), broken && broken.message);

// ── a sandbox spine, written through the one writer ──────────────────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), "face-discover-"));
const spine = join(tmp, "spine");
mkdirSync(join(spine, "events"), { recursive: true });
const env = { ...process.env, ARC_SPINE_ROOT: spine };
const node = (args) => spawnSync(process.execPath, args, { cwd: REPO, encoding: "utf8", env, timeout: 120000, killSignal: "SIGKILL" });
const emit = (kind, payload, process_ = D.PROCESS) => {
  const r = node([join(HQ, "arc-event.mjs"), "emit", kind, "--payload", JSON.stringify(payload), "--process", process_, "--strict"]);
  const id = String(r.stdout || "").trim().split(/\r?\n/).pop() ?? "";
  // A spawn that failed, or an id outside the ULID grammar, is no receipt (attack 76e154c B4).
  return { id, status: r.error ? -1 : r.status, err: String(r.error ? r.error.code : r.stderr || ""), ok: !r.error && r.status === 0 && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id) };
};
const ctx = { mode: "sim", repo: REPO, root: spine };
const route = (q = "") => R.apiDiscover(ctx, new URL(`http://door/api/discover${q}`));

try {
  const empty = await route();
  check("EDGES: an empty spine answers zero counts, marked zero", empty.availability === "zero" && empty.captures.count === 0 && empty.winners.length === 0 && empty.runs.hunt === null && empty.route === "/api/discover", JSON.stringify(empty));
  let q = null;
  try { await route("?x=1"); } catch (e) { q = e; }
  check("ROUTE: a query key is refused, never ignored", q !== null && q.code === "BAD_ARGS", q && q.message);

  const cap = emit("idea.captured", { source_id: "hn-1", source_url: "https://news.example/1", title: "late invoices", niche: "smb" });
  const faceCap = emit("idea.captured", { source_id: "face-1", title: "an idea typed in the face" }, "face-ask@1.0.0");
  const hunt = emit("run.completed", { step: "hunt", niche: "smb", records: 1, clusters: 1, captured: 1, outcome: "ok" });
  const judge = emit("run.completed", { step: "judge", outcome: "ok", finalists: 1 });
  const w1 = emit("approval.requested", { what: "discover winner a", gate: D.WINNER_GATE, slug: "invoice-reminders", niche: "smb", cluster_fp: "fp1", cluster_tokens: ["invoice", "late"], score: 7.5 });
  const w2 = emit("approval.requested", { what: "discover winner b", gate: D.WINNER_GATE, slug: "receipt-scan", niche: "smb", cluster_fp: "fp2", cluster_tokens: ["receipt"], score: 5 });
  const rej = node([join(HQ, "arc-inbox.mjs"), "reject", w2.id, "--reason", "not this one"]);
  check("ROUTE: the sandbox spine was written (vacuous-pass guard)", [cap, faceCap, hunt, judge, w1, w2].every((e) => e.ok) && !rej.error && rej.status === 0, [cap, faceCap, hunt, judge, w1, w2].map((e) => e.err).join(" | ") + rej.stderr);
  const b = await route();
  check("ROUTE: one capture is counted, with its source and day", b.availability === "served" && b.captures.count === 1 && b.captures.latest && b.captures.latest.source_id === "hn-1" && b.captures.latest.id === cap.id, JSON.stringify(b.captures));
  check("EDGES: a face idea.captured (no discover process) is not a discover capture", b.captures.count === 1 && b.captures.latest.source_id !== "face-1");
  check("ROUTE: the last hunt and the last judge, each with its receipt", b.runs.hunt && b.runs.hunt.id === hunt.id && b.runs.judge && b.runs.judge.id === judge.id && b.runs.judge.outcome === "ok", JSON.stringify(b.runs));
  const W1 = b.winners.find((w) => w.id === w1.id), W2 = b.winners.find((w) => w.id === w2.id);
  check("ROUTE: an undecided winner reads open, with its slug, score and tokens", W1 && W1.state === "open" && W1.slug === "invoice-reminders" && W1.score === 7.5 && W1.cluster_tokens.join(",") === "invoice,late" && W1.decision === null, JSON.stringify(W1));
  check("ROUTE: a rejected winner reads rejected, with the deciding receipt and its reason", W2 && W2.state === "rejected" && W2.decision && W2.decision.verdict === "reject" && W2.decision.reason === "not this one", JSON.stringify(W2));
  const again = node([join(HQ, "arc-inbox.mjs"), "approve", w2.id, "--reason", "changed my mind"]);
  check("EDGES: a winner decided twice is impossible -- the second decision is refused", again.status === 2 && /ALREADY_DECIDED/.test(again.stderr), again.stderr);
  // MUTANT: a route that selects by another process name counts the face capture, never discover's.
  const loose = R.discoverBody((await import(pathToFileURL(join(HQ, "spine.mjs")).href)).scanAll(spine), { ...C, name: "face-ask" });
  check("EDGES MUTANT: a route that does not select by discover's process counts the face capture, and is caught", loose.captures.count === 1 && loose.captures.latest.source_id === "face-1" && b.captures.latest.source_id === "hn-1");
  // An unreadable day: a directory where a day file belongs.
  mkdirSync(join(spine, "events", "2026-01-01.jsonl"), { recursive: true });
  const u = await route();
  check("EDGES: an unreadable spine day is unknown, naming the day, never 0", u.availability === "unknown" && u.captures === null && u.winners === null && u.unreadable.some((d) => d.startsWith("2026-01-01")), JSON.stringify(u));
} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch (e) { console.log(`WARN could not remove ${tmp}: ${e && e.code}`); }
}

// ── GRAMMAR: no second spelling of discover's constants ────────────────────────────────────────────
try {
  const hits = [];
  const spelled = (t) => t.includes(D.WINNER_GATE) || t.includes(D.PROCESS.slice(0, D.PROCESS.indexOf("@") + 1));
  // lstat, never stat: a link is not followed, so the walk stays inside face/src and cannot loop; each file is read once,
  // and a file that cannot be read is a finding, never a crash of the arm (attack 76e154c B5).
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      if (n === "node_modules" || n === "dist") continue;
      const p = join(d, n);
      const s = lstatSync(p);
      if (s.isSymbolicLink()) continue;
      if (s.isDirectory()) walk(p);
      else if (s.isFile() && /\.(mjs|js|ts|tsx|json)$/.test(n)) {
        let t;
        try { t = readFileSync(p, "utf8"); } catch (e) { hits.push(`${p} (unreadable: ${e && e.code})`); continue; }
        if (spelled(t)) hits.push(p);
      }
    }
  };
  walk(join(REPO, "face", "src"));
  for (const f of [join(HQ, "lib", "face", "reads.mjs"), join(HQ, "lib", "face", "discover", "route.mjs")]) {
    const t = readFileSync(f, "utf8");
    if (t.includes(D.WINNER_GATE) || t.includes(D.PROCESS.slice(0, D.PROCESS.indexOf("@") + 1))) hits.push(f);
  }
  check("GRAMMAR: the winner gate and the process are spelled nowhere under face/src, in reads.mjs or in the route", hits.length === 0, hits.join(", "));
} catch (e) { check("GRAMMAR: the grammar arm ran to its end (a read that failed is a finding, never a crash)", false, e && (e.code || e.message)); }

// ── ROOM ───────────────────────────────────────────────────────────────────────────────────────────
try {
  const dir = join(REPO, "face", "src", "modules", "money", "discover");
  const view = readFileSync(join(dir, "View.tsx"), "utf8");
  check("ROOM: the View wears no data-planned and draws no REHEARSAL card or planned line", !/data-planned/.test(view) && !/Rehearsal|PlannedLinePanel|PlannedBanner/.test(view));
  const ops = (await import(pathToFileURL(join(dir, "ops.mjs")).href)).ops;
  // Cycle 17 P03 (ADR-1369 supersedes ADR-1356 decision 2): the room offers one verb, the hunt; score and judge stay /arc-hunt's.
  check("ROOM: ops.mjs offers exactly the hunt", Array.isArray(ops) && ops.length === 1 && ops[0] === "discover.hunt", JSON.stringify(ops));
  const rooms = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
  const room = rooms.rooms.find((r) => r.id === "discover");
  check("ROOM: the served registry lists discover as built, not planned", room && room.status === "built" && room.planned !== true, JSON.stringify(room));
  const fold = (await import(pathToFileURL(join(dir, "fold.mjs")).href)).fold;
  const manifest = (await import(pathToFileURL(join(dir, "module.mjs")).href)).default;
  const reg = await import(pathToFileURL(join(REPO, "face", "src", "lib", "registry.mjs")).href);
  const c = { room, rooms: rooms.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: rooms.inventories, laneMap: undefined, picks: {}, manifest };
  const first = fold({}, c);
  const pay = (body) => { const out = Object.create(null); for (const r of reg.plannedReads(first, manifest).reads) out[r.key] = { state: "ok", data: body }; return out; };
  const z = fold(pay({ route: "/api/discover", availability: "zero", failure: "", unreadable: [], captures: { count: 0, latest: null }, runs: { hunt: null, judge: null }, winners: [] }), c);
  check("ROOM: a spine with no discover receipt says no hunt has run yet", z.showNoHunt === true && /No hunt has run yet/.test(z.noHunt) && z.winners.avail.availability === "zero");
  const un = fold(pay({ route: "/api/discover", availability: "unknown", failure: "UNREADABLE_DAY", unreadable: ["2026-01-01 (EISDIR)"], captures: null, runs: null, winners: null }), c);
  check("ROOM: an unknown answer draws every figure as not read, and the winners table as unknown naming the day",
    un.kpis.every((k) => k.v === "—") && un.winners.avail.availability === "unknown" && /2026-01-01/.test(un.winners.refusal.human) && un.showNoHunt === false, JSON.stringify({ k: un.kpis.map((k) => k.v), a: un.winners.avail, r: un.winners.refusal }));
} catch (e) { check("ROOM: the room arm ran to its end (a read that failed is a finding, never a crash)", false, e && (e.code || e.message)); }

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;

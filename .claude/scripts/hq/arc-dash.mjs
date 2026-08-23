#!/usr/bin/env node
// arc-dash -- L2: ONE read door + ONE decision door over the spine and the sanctioned
// files (face lane REQ-09; ADR-1301 three layers · ADR-1302 one write · ADR-1312 privacy
// matrix · ADR-1310 data modes). Zero dependencies, Node >= 18, single file by law.
//
// The door NEVER derives truth of its own: reads go through spine.mjs (the only public
// API, ADR-0030), the inbox fold and the decision come from arc-inbox.mjs (byte-parity by
// construction -- same function, same emitter), the brief from arc-brief.mjs render, the
// money model from lib/ledger (the money brain's own derivation), machine headers from
// lane-resolve.mjs (the board lint's parser). File-borne panels are served through the
// /api/file allow-list with a sha and the "file, not log" badge -- files have no history
// the face may pretend to replay (assumption row 7).
//
// REPRESENTATION CONTRACT (written, second-opinion finding 5): every STRING value in a
// JSON response is served display-safe -- HTML-escaped at this serializer (& < > " ').
// The spine's stored bytes are the unescaped truth; byte-parity (REQ-03) is about the
// WRITE, never the read representation. A client that needs raw bytes reads the spine
// through the CLI, not through this door.
//
// SECURITY MATRIX (ADR-1312, spelled out -- "localhost + token" is not a spec):
//   - binds the literal 127.0.0.1 (IPv6 ::1 only via --bind ::1, same rules)
//   - the per-session token travels in the Authorization header ONLY -- never a cookie
//     (no ambient credential for CSRF to ride), never a query string (no token in logs).
//     The boot line prints the app URL with the token in the URL FRAGMENT (#token=...),
//     which the browser never sends to any server; the shell page keeps it in JS memory.
//   - every /api route requires the token; GET / (the static shell, no data) does not
//   - an Origin header that is present and not this server's own origin -> BAD_ORIGIN on
//     every route; the mutating route additionally REQUIRES Origin present (browsers
//     always send it on POST; a fixture must set it deliberately)
//   - zero CORS headers, ever -- there is no cross-origin consumer by design
//   - hostile payloads are a fixture, not a hope: <script>, RTL/bidi, 64 KB bodies
//
// MODES (ADR-1310): live (the canonical spine via spineRoot(), which itself REFUSES a
// linked worktree -- an empty worktree spine served as "current" is the anomaly-explained-
// away trap, retro 2026-07-28) · sim (--spine <path> names a fixture spine explicitly;
// every response says so). replay is not a mode but a dimension: ?asof=YYYY-MM-DD on the
// spine-derived reads re-derives from the log <= that day. The mode is in every response.
//
// Usage:
//   arc-dash.mjs [--port N] [--spine PATH] [--bind ADDR] [--token T]
//   arc-dash.mjs --routes            # print the route table as JSON and exit (the
//                                    # route-enumeration fixture reads THIS, so the table
//                                    # below is the single dispatch authority)
//
// Exit: 0 clean shutdown | 1 refused to start (named reason on stderr).

import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

import { query, applyFilters, readAll, spineHealth, spineRoot } from "./spine.mjs";
import { decide, loadApprovals, cutToDay } from "./arc-inbox.mjs";
import { render as renderBrief } from "./arc-brief.mjs";
import { derivePnl } from "./lib/ledger/pnl.mjs";
import { deriveKillPanel } from "./lib/ledger/kill-panel.mjs";
import { repoRoot } from "./lib/spine-io.mjs";
import { SpineError, ULID_RE, sha256Hex, formatIst, nowMs } from "./lib/canonical.mjs";
import { laneHeader, validLaneName } from "../core/lane-resolve.mjs";
import { askOffline } from "./lib/face/ask-offline.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_BRIEF = join(HERE, "arc-brief.mjs");

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_DEFAULT = 500;
const PAGE_CAP = 1000;
const BODY_CAP = 64 * 1024;

// ---------- the sanctioned file allow-list (/api/file/:id -- ONLY these ids) ----------
const FILE_ALLOW = Object.freeze({
  "portfolio": "PORTFOLIO.md",
  "constitution": "CONSTITUTION.md",
  "router": "engine/router.yaml",
  "hq-policy": "hq.policy.yaml",
  "hq-jobs": "hq.jobs.yaml",
  "ventures": "ventures.yaml",
  "retro-log": "docs/retro-log.md",
  "trial-ledger": "docs/trial-ledger.md",
  "history": "docs/HISTORY.md",
  "expected-set": "initiatives/face/contracts/expected-set.json",
  "planned-rooms": "initiatives/face/contracts/planned-rooms.json",
  "face-schema": "initiatives/face/contracts/face-schema.json",
});

// ---------- display-safe serialization (the representation contract) ----------
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeDeep(v) {
  if (typeof v === "string") return escapeHtml(v);
  if (Array.isArray(v)) return v.map(escapeDeep);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v)) out[escapeHtml(k)] = escapeDeep(v[k]);
    return out;
  }
  return v;
}

// ---------- SpineError code -> HTTP status ----------
const STATUS = Object.freeze({
  BAD_ARGS: 400, BAD_CURSOR: 400, BAD_ASOF: 400, BAD_VERDICT: 400, BAD_REASON: 400,
  LIMIT_INVALID: 400, BAD_BODY: 400,
  NO_TOKEN: 401, BAD_TOKEN: 401,
  BAD_ORIGIN: 403, NO_ORIGIN: 403,
  UNKNOWN_APPROVAL: 404, UNKNOWN_FILE_ID: 404, UNKNOWN_LANE: 404, UNKNOWN_ROUTE: 404,
  CURSOR_NOT_FOUND: 404,
  ALREADY_DECIDED: 409, DUP_IDEM: 409,
  BODY_TOO_LARGE: 413,
  WRONG_KIND: 422,
  PROCESS_NOT_LANDED: 501, ASOF_UNSUPPORTED: 501,
  DECISION_REFUSED: 502,
});

class DashError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// ---------- helpers ----------
function parseAsof(url) {
  const asof = url.searchParams.get("asof");
  if (asof === null) return null;
  if (!DAY_RE.test(asof)) throw new DashError("BAD_ASOF", `asof "${asof}" is not YYYY-MM-DD`);
  return asof;
}
// The as-of cut is IMPORTED, never re-implemented (arc-inbox.cutToDay) -- see its comment:
// this was a twin, and twins in this repo drift and then disagree at the boundary.
const cutAsof = cutToDay;
function lastId(events) {
  return events.length ? events[events.length - 1].event.id : null;
}

// ---------- route handlers ----------
async function apiHealth(ctx) {
  const health = spineHealth(ctx.root);
  const all = (await readAll(ctx.root)).events;
  return {
    mode: ctx.mode, now: formatIst(nowMs()),
    spine: { root: ctx.mode === "live" ? "canonical" : ctx.root, ...health },
    cursor: lastId(all),
    journal: ctx.journalDir,
  };
}

/**
 * The room registry, plus the one thing the registry cannot know: how much of each room is
 * actually ALIVE right now.
 *
 * L3 renders 33 rooms and must not carry a second spelling of the contract -- that is the
 * whole argument of ADR-1306, and a renderer with its own room list is exactly how a
 * renamed room silently empties a screen. So the door serves the generated registry
 * verbatim and adds a `live` block derived from the spine at read time.
 *
 * `live.kinds` answers the question a generic room has to answer honestly before it draws
 * anything: of the kinds this room homes, which have EVER fired? A room whose kinds have
 * all fired zero times is not broken and is not empty -- it is UNEXERCISED, and saying so
 * is the difference between an honest room and a convincing blank one (room-map.md D7).
 */
async function apiRooms(ctx) {
  const p = join(ctx.repo, "initiatives", "face", "contracts", "rooms.generated.json");
  if (!existsSync(p))
    throw new DashError("REGISTRY_ABSENT", "rooms.generated.json has not been generated -- run face-sections.mjs");
  const registry = JSON.parse(readFileSync(p, "utf8"));

  // Counted from the log, never from a stored total: a cached count is the second truth
  // ADR-1301 forbids, and it is the one that goes stale without anyone noticing.
  //
  // readAll returns ENVELOPES -- { event, day, seq, line } -- not bare events. The first
  // cut of this handler read `e.kind`, which is undefined on an envelope, so every kind
  // counted as one bucket and all 24 kind-bearing rooms reported UNEXERCISED. That is
  // precisely the dishonest-empty-room class room-map.md D7 exists to prevent, shipped by
  // the code meant to prevent it, and only a probe against a real fixture caught it: the
  // route answered 200 with a perfectly well-formed lie.
  const seen = new Map();
  for (const { event } of (await readAll(ctx.root)).events)
    seen.set(event.kind, (seen.get(event.kind) || 0) + 1);

  const rooms = registry.rooms.map((r) => {
    const kinds = (r.holds && r.holds.kinds) || [];
    const fired = kinds.filter((k) => seen.has(k));
    return {
      ...r,
      live: {
        kindsHomed: kinds.length,
        kindsFired: fired.length,
        receipts: fired.reduce((n, k) => n + seen.get(k), 0),
        // Three honest states, none of them an error and none of them a bare zero:
        //   live         at least one homed kind has fired
        //   unexercised  the room homes kinds and not one has ever fired -- built, never run
        //   file-borne   the room homes NO kinds; its content comes from the tree and the
        //                contract, not from the log, so the log has nothing to say about it.
        //                The door already uses "file, not log" for exactly this distinction
        //                (/api/board), and reusing that vocabulary is the point: a reader
        //                should never have to learn two names for one idea.
        //   index        renders a whole inventory rather than a slice (org, concepts)
        state: r.render === "index" ? "index"
          : kinds.length === 0 ? "file-borne"
            : fired.length === 0 ? "unexercised" : "live",
      },
    };
  });

  return { mode: ctx.mode, rings: registry.rings, rooms, kindsEverFired: seen.size };
}

async function apiSpine(ctx, url) {
  const asof = parseAsof(url);
  const limitRaw = url.searchParams.get("limit");
  let limit = PAGE_DEFAULT;
  if (limitRaw !== null) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1) throw new DashError("LIMIT_INVALID", `limit "${limitRaw}" is not a positive integer`);
    if (limit > PAGE_CAP) throw new DashError("LIMIT_INVALID", `limit ${limit} exceeds the page cap ${PAGE_CAP} -- page with the returned next cursor instead`);
  }
  const filters = {};
  for (const k of ["since", "kind", "venture", "date"]) {
    const v = url.searchParams.get(k);
    if (v !== null) filters[k] = v;
  }
  const { events, torn, engine } = await readAll(ctx.root);
  // applyFilters WITHOUT limit so the page contract can report `more` honestly; the same
  // filter function the CLI uses (unknown cursor -> CURSOR_NOT_FOUND, never an empty 200).
  const filtered = applyFilters(cutAsof(events, asof), filters);
  const page = filtered.slice(0, limit);
  return {
    mode: ctx.mode, asof, engine,
    count: page.length, more: filtered.length > page.length,
    next: page.length ? lastId(page) : (filters.since || null),
    torn: torn.length,
    events: page.map((e) => ({ day: e.day, seq: e.seq, event: e.event })),
  };
}

function shellBrief(ctx) {
  return new Promise((resolveP, rejectP) => {
    execFile(process.execPath, [ARC_BRIEF], {
      cwd: ctx.repo, env: { ...process.env, ...(ctx.mode === "sim" ? { ARC_SPINE_ROOT: ctx.root } : {}) },
      timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
    }, (err, stdout, stderr) => {
      // The brief CLI exits non-zero on real refusals; its text IS the product either way,
      // so a refusal surfaces verbatim rather than as a dash-invented summary.
      if (err && !stdout) return rejectP(new DashError("BRIEF_FAILED", String(stderr || err.message).slice(0, 500)));
      resolveP(stdout);
    });
  });
}

async function apiBrief(ctx, url) {
  const asof = parseAsof(url);
  if (asof === null) {
    const text = await shellBrief(ctx);
    return { mode: ctx.mode, asof: null, source: "arc-brief CLI (full assembly: groups + jobs panel + money strip)", text };
  }
  // as-of: spine-derived core only (groups over that day's events, the CLI's own render).
  // The jobs panel and kill lines are file-/panel-borne extras main() precomputes from
  // TODAY's files -- serving them under a past date would be the file-history lie the
  // Tape refuses (assumption row 7), so as-of briefs carry the groups alone, labelled.
  const { events, torn } = await readAll(ctx.root);
  const dayEvents = cutAsof(events, asof).filter((e) => e.day === asof);
  const text = renderBrief(asof, dayEvents, torn.filter((t) => t.day === asof));
  return { mode: ctx.mode, asof, source: "arc-brief render (spine-derived groups only; file-borne extras are not replayable)", text };
}

async function apiInbox(ctx, url) {
  const asof = parseAsof(url);
  const { requested, decidedIds } = await loadApprovals(ctx.root, { asof });
  const open = requested.filter((e) => !decidedIds.has(e.event.id));
  return {
    mode: ctx.mode, asof,
    openCount: open.length, decidedCount: decidedIds.size,
    open: open.map((e) => {
      const p = e.event.payload || {};
      // Same what/gate fallbacks as the CLI's own listing (a PROFILE payload has no free
      // text `what`; an approval nobody can read is a rubber stamp with extra steps).
      const what = typeof p.what === "string" ? p.what : (typeof p.subject === "string" ? p.subject : "");
      const gate = typeof p.gate === "string" ? p.gate : (typeof p.subject === "string" ? p.subject.split(".")[0] : "?");
      return { id: e.event.id, day: e.day, ts: e.event.ts, venture: e.event.venture, what, gate, payload: p };
    }),
  };
}

async function apiPnl(ctx, url) {
  if (url.searchParams.get("asof") !== null)
    throw new DashError("ASOF_UNSUPPORTED",
      "pnl's native as-of is ?month=YYYY-MM (a month IS a time scope); day-granular as-of needs an asof seam in the money brain's derivePnl and is deliberately not re-derived here (ADR-1301: the door never re-implements the money core)");
  const month = url.searchParams.get("month");
  if (month !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new DashError("BAD_ARGS", `month "${month}" is not YYYY-MM`);
  const model = await derivePnl(ctx.root, {
    mode: url.searchParams.get("simulated") === "1" ? "simulated" : "real",
    venture: url.searchParams.get("venture"),
    month,
  });
  const panel = await deriveKillPanel(ctx.root, {});
  return { mode: ctx.mode, month, model, kill: panel };
}

function apiBoard(ctx) {
  const boardPath = join(ctx.repo, "PORTFOLIO.md");
  const text = existsSync(boardPath) ? readFileSync(boardPath, "utf8") : "";
  const updated = (text.match(/^Updated:\s*(.+)$/m) || [, null])[1];
  // Row ORDER comes from the board (priority is the owner's ordering); every VALUE comes
  // from the lane's machine header via the board lint's own parser (ADR-0051: the board
  // is a view, the lane files are the truth -- so the door reads the truth directly).
  const order = [...text.matchAll(/^\|\s*([a-z][a-z0-9-]*)\s*\|/gm)].map((m) => m[1])
    .filter((l) => l !== "lane" && l !== "venture" && l !== "pair");
  const lanes = [];
  for (const lane of [...new Set(order)]) {
    const progress = join(ctx.repo, "initiatives", lane, "PROGRESS.md");
    if (!existsSync(progress)) continue; // a board row without a lane dir is the lint's problem, not a lie to serve
    lanes.push({ lane, header: laneHeader(progress) });
  }
  return { mode: ctx.mode, badge: "file, not log", updated, lanes };
}

function apiLane(ctx, laneName) {
  if (!validLaneName(laneName)) throw new DashError("UNKNOWN_LANE", `"${laneName}" is not a valid lane name`);
  const dir = join(ctx.repo, "initiatives", laneName);
  const progress = join(dir, "PROGRESS.md");
  if (!existsSync(progress)) throw new DashError("UNKNOWN_LANE", `no lane "${laneName}" (no initiatives/${laneName}/PROGRESS.md)`);
  const planPath = join(dir, "PLAN.md");
  return {
    mode: ctx.mode, badge: "file, not log", lane: laneName,
    header: laneHeader(progress),
    progress: readFileSync(progress, "utf8"),
    plan: existsSync(planPath) ? readFileSync(planPath, "utf8") : null,
  };
}

function apiFile(ctx, id) {
  // Object.hasOwn, not a bare lookup: `constructor`/`toString`/`__proto__` resolve to
  // INHERITED members, which are truthy, pass an `if (!rel)` guard, and then blow up in
  // join() as a 500 with a TypeError echoed back. An allow-list must answer "no" to every
  // key it does not itself contain.
  const rel = Object.hasOwn(FILE_ALLOW, id) ? FILE_ALLOW[id] : undefined;
  if (!rel) throw new DashError("UNKNOWN_FILE_ID", `"${id}" is not on the sanctioned allow-list (${Object.keys(FILE_ALLOW).join(", ")})`);
  const path = join(ctx.repo, rel);
  if (!existsSync(path)) throw new DashError("UNKNOWN_FILE_ID", `allow-listed id "${id}" has no file at ${rel} on this tree`);
  const text = readFileSync(path, "utf8");
  return { mode: ctx.mode, badge: "file, not log", id, path: rel, sha256: sha256Hex(text), text };
}

async function apiDecide(ctx, body) {
  const { id, verdict, reason } = body || {};
  if (verdict !== "approve" && verdict !== "reject") throw new DashError("BAD_VERDICT", `verdict must be approve or reject, got ${JSON.stringify(verdict)}`);
  // decide() is arc-inbox's OWN function (ADR-1302): same validation, same refusal codes,
  // same emitter (arc-event --strict), same idem -- the spine cannot tell the door.
  await decide(ctx.root, verdict, id, reason);
  const decided = (await query(ctx.root, { kind: "decision.recorded" })).events
    .filter((e) => e.event.payload && e.event.payload.decides === id);
  const decision = decided.length ? decided[decided.length - 1].event : null;
  return { mode: ctx.mode, decided: id, verdict, decision };
}

/** The live-state pack, assembled by the READ DOOR -- the brain never gathers (ADR-1307). */
async function askState(ctx) {
  const health = spineHealth(ctx.root);
  const { events } = await readAll(ctx.root);
  const kinds = {};
  for (const e of events) kinds[e.event.kind] = (kinds[e.event.kind] || 0) + 1;
  const { requested, decidedIds } = await loadApprovals(ctx.root);
  const open = requested.filter((e) => !decidedIds.has(e.event.id)).map((e) => {
    const p = e.event.payload || {};
    const what = typeof p.what === "string" ? p.what : (typeof p.subject === "string" ? p.subject : "");
    const gate = typeof p.gate === "string" ? p.gate : (typeof p.subject === "string" ? p.subject.split(".")[0] : "?");
    return { id: e.event.id, gate, what };
  });
  const board = apiBoard(ctx);
  return {
    events: health.events, days: health.days, daysClosed: health.daysClosed,
    quarantined: health.quarantined.total, kinds,
    open, raised: requested.length, decided: decidedIds.size,
    lanes: board.lanes.map((l) => ({ lane: l.lane, ...(l.header || {}) })),
  };
}

async function apiAsk(ctx, body) {
  const q = body && typeof body.q === "string" ? body.q : "";
  if (!q) throw new DashError("BAD_BODY", "ask needs { q: \"...\" }");

  const state = await askState(ctx);

  // DETERMINISTIC FIRST, and not as a consolation prize. Questions about live state have
  // exact answers computed from the log; an exact answer beats a fluent one, needs no
  // driver, no key and no spend, and cannot hallucinate a receipt. The model is for the
  // questions this cannot reach -- so it is asked only when this says it cannot reach one,
  // or when the caller explicitly wants the governed run (?mode=process).
  const { matched, ...offline } = askOffline(q, state);
  const wantsProcess = body && body.mode === "process";

  // Route on whether the deterministic answerer REACHED an answer, never on how many
  // citations it produced. The first cut escalated whenever `citations.length === 0`, and
  // driving it live showed how wrong that is: "revenue is ₹0 because revenue.received has
  // never fired" is a complete, correct answer that cites nothing (there is no receipt to
  // cite — that IS the answer), and so is the spine-shape count. Worst of all, the
  // action REFUSAL cites nothing, so the one answer that must never depend on a model —
  // "I read; I do not act" — was being handed to a model. An unanswerable question and a
  // correct citation-free answer are not the same thing, and only the first may escalate.
  if (matched === "refusal:act" || (!wantsProcess && matched !== null)) {
    return { mode: ctx.mode, source: "deterministic (L2 reads only, no driver)", ...offline };
  }

  const proc = join(ctx.repo, "processes", "face-ask.process.yaml");
  if (!existsSync(proc)) {
    // No governed process on this tree: the deterministic answer is ALL there is, and
    // saying so is better than a refusal that hides an answer we actually have.
    return { mode: ctx.mode, source: "deterministic (face-ask process not on this tree)", ...offline };
  }

  // THE PROCESS DECLARES TWO REQUIRED INPUTS, and the first cut sent one. face-ask has
  // `tools: []` -- it cannot fetch anything -- so a call without `state` hands a brain with
  // no hands nothing to reason about, and the process's own input contract refuses it. The
  // pack is the SAME one the deterministic answerer just used, rendered for a reader: one
  // assembly, one truth, no chance of the two halves of the brain seeing different states.
  const pack = [
    `SPINE: ${state.events} receipts · ${state.daysClosed} day.closed seals · ` +
      `${Object.keys(state.kinds).length} of 46 kinds have ever fired · ${state.quarantined} refused (held separately, never counted as receipts).`,
    `APPROVALS: ${state.raised} raised · ${state.decided} decided · ${state.open.length} OPEN` +
      (state.open.length ? ` — ${state.open.map((o) => `${o.id} [${o.gate}] ${o.what}`).join(" · ")}` : ""),
    `BOARD: ${state.lanes.filter((l) => l.status === "LIVE").map((l) => `${l.lane} phase ${l.phase || "—"} burn ${l.burn || "—"}/${l.appetite || "—"}`).join(" · ")}`,
    `MODE: ${ctx.mode}${ctx.mode === "sim" ? " (SIMULATED — every value here is fixture data, never real)" : ""}`,
  ].join("\n");

  return new Promise((resolveP, rejectP) => {
    // arc-run takes ONE `--input` carrying a JSON object keyed by the process's declared
    // input names -- not a flag per input. The first cut invented `--state` and arc-run
    // rejected it by name, which is the good failure: an unknown flag is a refusal, never
    // a silently-dropped argument.
    execFile(process.execPath, [join(ctx.repo, ".claude", "scripts", "engine", "arc-run.mjs"),
      "--process", "face-ask", "--input", JSON.stringify({ q, state: pack })], {
      cwd: ctx.repo, timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
    }, (err, stdout, stderr) => {
      if (err) return rejectP(new DashError("ASK_FAILED", String(stderr || err.message).slice(0, 500)));
      resolveP({ mode: ctx.mode, answer: stdout });
    });
  });
}

// ---------- THE route table (single dispatch authority; --routes prints it) ----------
//
// EVERY route declares `spineEffect` explicitly, and the fixture fails closed on a route
// that declares none. That precision is the fix for a circular gate: the first cut carried
// only `mutates`, and the fixture asserted "exactly one route has mutates:true" -- reading
// back the very flag it was asserting on. A new write route labelled `mutates:false` (or
// with the key simply absent, which `filter(r => r.mutates)` silently drops) passed it.
// An adversarial pass named that circularity AND its live instance: /api/ask was flagged
// `mutates:false` while the arc-run it proxies emits `run.completed` -- a spine write by
// any honest reading, invisible to the gate the moment face-ask lands.
//
//   "write"   this door writes the spine itself. EXACTLY ONE (FACE-C/ADR-1302).
//   "receipt" this door causes a spine write by a GOVERNED subprocess: arc-run emits
//             run.completed under policy, budgeted and tier-pinned. Not this door's write,
//             but not "none" either -- naming it is the difference between a contract and
//             a comfortable label.
//   "none"    reads only. Nothing about this route can reach the spine's writer.
const ROUTES = Object.freeze([
  { method: "GET", path: "/api/health", mutates: false, spineEffect: "none", handler: (ctx, url) => apiHealth(ctx, url) },
  { method: "GET", path: "/api/spine", mutates: false, spineEffect: "none", handler: (ctx, url) => apiSpine(ctx, url) },
  { method: "GET", path: "/api/brief", mutates: false, spineEffect: "none", handler: (ctx, url) => apiBrief(ctx, url) },
  { method: "GET", path: "/api/inbox", mutates: false, spineEffect: "none", handler: (ctx, url) => apiInbox(ctx, url) },
  { method: "GET", path: "/api/pnl", mutates: false, spineEffect: "none", handler: (ctx, url) => apiPnl(ctx, url) },
  { method: "GET", path: "/api/board", mutates: false, spineEffect: "none", handler: (ctx) => apiBoard(ctx) },
  { method: "GET", path: "/api/rooms", mutates: false, spineEffect: "none", handler: (ctx) => apiRooms(ctx) },
  { method: "GET", prefix: "/api/lane/", mutates: false, spineEffect: "none", handler: (ctx, url, tail) => apiLane(ctx, tail) },
  { method: "GET", prefix: "/api/file/", mutates: false, spineEffect: "none", handler: (ctx, url, tail) => apiFile(ctx, tail) },
  { method: "POST", path: "/api/decide", mutates: true, spineEffect: "write", handler: (ctx, url, tail, body) => apiDecide(ctx, body) },
  { method: "POST", path: "/api/ask", mutates: false, spineEffect: "receipt", proxy: "arc-run --process face-ask", handler: (ctx, url, tail, body) => apiAsk(ctx, body) },
]);

// ---------- the static shell (GET /, no data, no auth) ----------
const SHELL = `<!doctype html>
<meta charset="utf-8">
<title>arc</title>
<style>body{font-family:ui-monospace,monospace;max-width:60ch;margin:4rem auto;line-height:1.5}</style>
<h1>arc dash</h1>
<p>L2 is up. The face (L3) mounts here at Phase 04. Data lives behind the token:
every <code>/api/*</code> read needs <code>Authorization: Bearer &lt;token&gt;</code>
(printed once at boot; carried in this page's URL fragment, which never reaches a server).</p>
<p id="mode"></p>
<script>
  const t = (location.hash.match(/token=([A-Za-z0-9_-]+)/) || [])[1];
  if (t) fetch("/api/health", { headers: { Authorization: "Bearer " + t } })
    .then(r => r.json())
    .then(h => { document.getElementById("mode").textContent = "mode: " + h.mode + " - events: " + h.spine.events; })
    .catch(() => { document.getElementById("mode").textContent = "health read failed"; });
</script>`;

// ---------- server ----------
function boot(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--routes") { flags.routes = true; continue; }
    if (a.startsWith("--")) { flags[a.slice(2)] = argv[i + 1]; i++; }
  }
  if (flags.routes) {
    // spineEffect is printed VERBATIM, never defaulted: the fixture's "every route declares
    // one" check can only fail closed if an undeclared route arrives here as undefined.
    const table = ROUTES.map((r) => ({ method: r.method, path: r.path || `${r.prefix}:tail`, mutates: r.mutates, spineEffect: r.spineEffect, ...(r.proxy ? { proxy: r.proxy } : {}) }));
    process.stdout.write(JSON.stringify(table, null, 2) + "\n");
    return null;
  }

  const port = flags.port ? Number(flags.port) : 8317;
  const bind = flags.bind || "127.0.0.1";
  if (bind !== "127.0.0.1" && bind !== "::1") {
    process.stderr.write(`arc-dash: ERROR BAD_BIND -- refusing to bind ${bind}; this door is localhost-only by law (ADR-1312)\n`);
    process.exit(1);
  }

  let mode, root;
  if (flags.spine) {
    mode = "sim";
    root = resolve(flags.spine);
    if (!existsSync(join(root, "events"))) {
      process.stderr.write(`arc-dash: ERROR BAD_SPINE -- --spine ${root} has no events/ dir; a sim mode over nothing answers confidently and wrongly\n`);
      process.exit(1);
    }
    // decide() shells arc-event, which resolves the spine itself -- point the child at
    // the SAME fixture so the sim door and the sim spine cannot disagree.
    process.env.ARC_SPINE_ROOT = root;
  } else {
    mode = "live";
    try {
      root = spineRoot(); // REFUSES a linked worktree (named), the C4 guard -- live mode
    } catch (err) {
      const code = err instanceof SpineError ? err.code : "NO_ROOT";
      process.stderr.write(`arc-dash: ERROR ${code} -- ${err.message}\n`);
      process.stderr.write(`arc-dash: live mode needs the MAIN clone (a worktree carries no canonical spine); for fixtures use --spine <path>\n`);
      process.exit(1);
    }
  }

  const repo = repoRoot();
  if (repo === null) { process.stderr.write("arc-dash: ERROR NO_ROOT -- no repository at or above cwd\n"); process.exit(1); }

  const token = flags.token || process.env.ARC_DASH_TOKEN || randomBytes(24).toString("base64url");
  const tokenBuf = Buffer.from(token);
  const journalDir = process.env.ARC_DASH_JOURNAL_DIR || join(dirname(root), "face");
  mkdirSync(journalDir, { recursive: true });

  const ctx = { mode, root, repo, journalDir };
  const selfOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`]);
  const selfHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);

  const journal = (entry) => {
    // Evidence, never truth (REQ-10): a failed journal line is reported, not fatal.
    try {
      const day = formatIst(nowMs()).slice(0, 10);
      appendFileSync(join(journalDir, `journal-${day}.jsonl`), JSON.stringify(entry) + "\n");
    } catch (e) { process.stderr.write(`arc-dash: WARN journal write failed (${e.code || e.message})\n`); }
  };

  const send = (res, status, obj) => {
    // headersSent/writableEnded guard: an error AFTER a partial write would otherwise
    // double-send -> ERR_HTTP_HEADERS_SENT thrown inside the .catch -> unhandled
    // rejection -> crash. The HQ must survive a peer that resets mid-response.
    if (res.headersSent || res.writableEnded) return;
    const body = JSON.stringify(escapeDeep(obj));
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    res.end(body);
  };

  const server = createServer((req, res) => {
    try {
      handleRequest(req, res);
    } catch (err) {
      // Last-resort boundary: the dispatch itself must never crash the process.
      try {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "INTERNAL", message: "request dispatch failed" }));
      } catch { /* response already gone */ }
      process.stderr.write(`arc-dash: WARN dispatch error contained -- ${err && err.message}\n`);
    }
  });

  function handleRequest(req, res) {
    // A socket error after headers is an EVENT, not a throw -- unhandled, it takes the
    // process down. Same class as the sync-throw fix below, on the stream siblings.
    req.on("error", () => { try { res.destroy(); } catch { /* already gone */ } });
    res.on("error", () => { /* peer vanished mid-write; nothing to say to it */ });

    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const path = url.pathname;

    // Host, not just Origin (DNS-rebinding hardening): a page at attacker.com rebound to
    // 127.0.0.1 sends Host: attacker.com and NO Origin on same-origin GETs, so the Origin
    // check alone never fires. The token still blocks the data, but a localhost-only door
    // should refuse the request outright rather than rely on one control.
    const host = req.headers.host;
    if (host !== undefined && !selfHosts.has(host)) {
      res.writeHead(403, { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" });
      res.end(JSON.stringify({ error: "BAD_ORIGIN", message: "this door answers only to a localhost Host header" }));
      return;
    }

    // Static shell: no data, no auth, no fourth affordance.
    if (req.method === "GET" && (path === "/" || path === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'" });
      res.end(SHELL);
      return;
    }

    const fail = (code, message) => {
      const status = STATUS[code] || 500;
      journal({ ts: formatIst(nowMs()), method: req.method, path, status, error: code });
      send(res, status, { error: code, message });
    };

    if (!path.startsWith("/api/")) return fail("UNKNOWN_ROUTE", `${path} is not a route on this door`);

    // Origin: if present it must be OURS (any route); absent is allowed on reads (a
    // same-origin GET fetch carries no Origin) but REQUIRED on the mutating route.
    const origin = req.headers.origin;
    if (origin !== undefined && !selfOrigins.has(origin)) return fail("BAD_ORIGIN", "cross-origin requests do not exist for this door (zero CORS by law)");

    // Token: Authorization header only.
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return fail("NO_TOKEN", "every /api route needs Authorization: Bearer <token> (printed at boot)");
    const given = Buffer.from(auth.slice(7));
    if (given.length !== tokenBuf.length || !timingSafeEqual(given, tokenBuf)) return fail("BAD_TOKEN", "token does not match this session");

    const route = ROUTES.find((r) => r.method === req.method && (r.path ? r.path === path : path.startsWith(r.prefix)));
    if (!route) return fail("UNKNOWN_ROUTE", `${req.method} ${path} is not a route on this door (see --routes)`);
    if (route.mutates && origin === undefined) return fail("NO_ORIGIN", "the mutating route requires an Origin header (a browser always sends one on POST; a fixture must set it deliberately)");

    // decodeURIComponent throws URIError on malformed percent-encoding (/api/lane/%).
    // Contained by the outer catch either way, but a client error deserves its own 400
    // rather than a generic "dispatch failed" 500.
    let tail = null;
    if (route.prefix) {
      try { tail = decodeURIComponent(path.slice(route.prefix.length)); }
      catch { return fail("BAD_ARGS", "malformed percent-encoding in the path"); }
    }

    const run = (body) => {
      // Promise.resolve().then(...) -- NOT Promise.resolve(handler(...)) -- so a handler
      // that throws SYNCHRONOUSLY lands in the catch instead of escaping the chain and
      // killing the server. Found live in the first smoke: one unknown file id was a
      // whole-process DoS. One hostile request must never take the HQ down.
      Promise.resolve()
        .then(() => route.handler(ctx, url, tail, body))
        .then((out) => {
          journal({ ts: formatIst(nowMs()), method: req.method, path, status: 200, ...(path === "/api/decide" && out && out.decision ? { decision: out.decision.id, decides: out.decided } : {}) });
          send(res, 200, out);
        })
        .catch((err) => {
          const code = (err instanceof SpineError || err instanceof DashError) ? err.code : "INTERNAL";
          fail(code, err.message);
        });
    };

    if (req.method === "POST") {
      let size = 0;
      const chunks = [];
      let tooBig = false;
      req.on("data", (c) => {
        size += c.length;
        if (size > BODY_CAP) { tooBig = true; req.destroy(); return; }
        chunks.push(c);
      });
      req.on("close", () => { if (tooBig) fail("BODY_TOO_LARGE", `body exceeds ${BODY_CAP} bytes`); });
      req.on("end", () => {
        if (tooBig) return;
        let body;
        try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }
        catch { return fail("BAD_BODY", "body is not valid JSON"); }
        run(body);
      });
    } else {
      run(null);
    }
  }

  // Process-level backstops. Every known throw path is contained above; these exist for
  // the ones nobody enumerated -- an async callback, a stream event, a library throw. The
  // HQ staying up is worth more than a clean crash: the owner's decisions run through it.
  process.on("uncaughtException", (err) => {
    process.stderr.write(`arc-dash: WARN uncaught exception contained -- ${err && err.stack ? err.stack.split("\n")[0] : err}\n`);
  });
  process.on("unhandledRejection", (reason) => {
    process.stderr.write(`arc-dash: WARN unhandled rejection contained -- ${reason && reason.message ? reason.message : reason}\n`);
  });

  // Slowloris: pin the timeouts rather than inherit whatever the Node version defaults to.
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;

  server.listen(port, bind, () => {
    process.stderr.write(`arc-dash: ${mode} mode on http://${bind === "::1" ? "[::1]" : bind}:${port} (spine: ${mode === "live" ? "canonical" : root})\n`);
    process.stderr.write(`arc-dash: open http://127.0.0.1:${port}/#token=${token}\n`);
    process.stderr.write(`arc-dash: token ${token}\n`);
  });
  return server;
}

if (process.argv[1] && process.argv[1].endsWith("arc-dash.mjs")) {
  boot(process.argv.slice(2));
}

export { ROUTES, FILE_ALLOW, escapeDeep, boot };

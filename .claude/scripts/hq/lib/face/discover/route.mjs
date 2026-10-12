// GET /api/discover -- discover's own receipts, for the money/discover room (face v2 Phase 17, REQ-21, ADR-1356).
//
// The discover lane writes real receipts (ADR-1900): `idea.captured` for each pain it captures, `run.completed` for each
// hunt and judge, and one `approval.requested` per winner, under discover's own winner gate. This route reads them and
// nothing else. It selects ONLY through discover's own constants, imported from .claude/scripts/discover/lib/spine.mjs
// -- the process name and the winner gate -- so a second spelling of either cannot exist here (not even in this
// comment), and a face `idea.captured` (no discover process) is not a discover capture.
//
// Honest edges: an empty spine answers zero counts marked `zero`; a spine day the reader could not open makes the whole
// answer `unknown`, naming the day, never 0 -- a capture could be on it. A winner reads `open` until a decision.recorded
// decides it; a second decision cannot exist (the spine refuses it). Every entry this route skips -- a torn line, a
// receipt outside its grammar, a duplicate, a decision that names no request -- is COUNTED by reason, never silently
// dropped. Read-only: mutates nothing, no spine effect.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scanAll } from "../../../spine.mjs";
import { dayFile, listDays } from "../../spine-io.mjs";
import { IST_TS_RE } from "../../canonical.mjs";
import { ReadError, answer, scrub } from "../reads.mjs";

const CONSTANTS = new URL("../../../../discover/lib/spine.mjs", import.meta.url);
/** Caps on what one answer carries; what a cap drops is counted in the body, never silently cut. */
const MAX_WINNERS = 200;
const MAX_TOKENS = 24;
const MAX_TEXT = 300;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
/** discover's process NAME and winner GATE, each held to a token grammar (attack 8164ad9 L7, L9, L10). */
const NAME = /^[a-z][a-z0-9-]{0,63}$/;
const GATE = /^[a-z][a-z0-9-]{0,63}$/;

/**
 * discover's own constants, imported when the route is asked -- never at the door's load: a checkout that carries the
 * door but not the discover product (a bare hq install) must still start, and answers this route by name instead. Only
 * a constants FILE that is not there is SOURCE_ABSENT; a file that is there and will not load is SOURCE_INVALID with its
 * code -- a broken product is not a missing one (attack 76e154c B1).
 * @returns {Promise<{ name: string, gate: string }>}
 */
export async function discoverConstants(at = () => import(CONSTANTS.href), file = fileURLToPath(CONSTANTS)) {
  let present = false;
  try { present = existsSync(file) && statSync(file).isFile(); } catch { present = false; }
  if (!present) throw new ReadError("SOURCE_ABSENT", "this checkout does not carry the discover lane, so there is nothing of discover's to read");
  let m;
  try { m = await at(); } catch (e) { throw new ReadError("SOURCE_INVALID", `the discover lane's constants are on this tree and would not load (${e && typeof e.code === "string" && /^[A-Z_]{1,40}$/.test(e.code) ? e.code : "IMPORT_FAILED"})`); }
  const at_ = typeof m.PROCESS === "string" ? m.PROCESS.indexOf("@") : -1;
  const name = at_ > 0 ? m.PROCESS.slice(0, at_) : "";
  if (!NAME.test(name) || !VERSION.test(m.PROCESS.slice(at_ + 1)) || typeof m.WINNER_GATE !== "string" || !GATE.test(m.WINNER_GATE))
    throw new ReadError("SOURCE_INVALID", "discover's PROCESS (name@x.y.z) or WINNER_GATE (a token) is not the shape this route selects by");
  return { name, gate: m.WINNER_GATE };
}

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** One line of served text: every control, line or paragraph separator becomes a space (attack 8164ad9 L3). */
function oneLine(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    out += c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029 ? " " : ch;
  }
  return out;
}

/**
 * The route's body over a spine as read: pure, so a fixture can hand it a spine and constants of its own. Every text
 * the spine carries passes `clean` (the door's scrub), one line and a cap; an id, a ts and a day are served only in
 * their grammar; an entry that fails is skipped and counted under its reason.
 * @param {{ events: { event: any, day: string }[], torn?: unknown[], unreadable: { day: string, code: string }[] }} read
 * @param {{ name: string, gate: string }} c  discover's constants (discoverConstants)
 * @param {(s: string) => string} [clean]
 */
export function discoverBody(read, c, clean = (s) => s) {
  const text = (v) => (typeof v === "string" ? oneLine(clean(v)).slice(0, MAX_TEXT) : "");
  const isDiscover = (e) => typeof e.process === "string" && e.process.startsWith(`${c.name}@`) && VERSION.test(e.process.slice(c.name.length + 1));
  if (read.unreadable.length > 0) {
    // A day nobody could open may hold a capture, a run or a winner: nothing here is counted, and the answer says which.
    const days = read.unreadable.map((u) => `${text(u.day)} (${text(u.code)})`);
    return { availability: "unknown", failure: "UNREADABLE_DAY", unreadable: days, captures: null, runs: null, winners: null, dropped: {}, droppedTotal: 0 };
  }
  /** @type {Record<string, number>} */
  const dropped = {};
  const drop = (why) => { dropped[why] = (dropped[why] ?? 0) + 1; };
  // A line the reader could not parse may be a discover receipt: counted, never invisible (L5).
  for (let i = 0; i < (Array.isArray(read.torn) ? read.torn.length : 0); i++) drop("torn");
  /** @type {{ e: any, day: string }[]} */
  const mine = [];
  for (const w of read.events) {
    const e = w && w.event;
    if (!isPlain(e) || typeof e.kind !== "string") { drop("torn"); continue; }
    if (e.kind === "decision.recorded") { mine.push({ e, day: w.day }); continue; }
    if (!isDiscover(e)) continue;
    // A discover receipt outside its grammar is skipped by reason (B2, B3, L6).
    if (!isPlain(e.payload)) { drop("malformed"); continue; }
    if (!ULID.test(String(e.id))) { drop("bad_id"); continue; }
    if (typeof e.ts !== "string" || !IST_TS_RE.test(e.ts) || typeof w.day !== "string" || !DAY.test(w.day)) { drop("bad_time"); continue; }
    mine.push({ e, day: w.day });
  }
  const captured = mine.filter((x) => x.e.kind === "idea.captured");
  const last = captured.at(-1) ?? null;
  /** @param {"hunt" | "judge"} step */
  const run = (step) => {
    const r = mine.filter((x) => x.e.kind === "run.completed" && x.e.payload.step === step).at(-1);
    return r ? { id: r.e.id, ts: r.e.ts, day: r.day, outcome: text(r.e.payload.outcome) || text(r.e.outcome) } : null;
  };
  /** @type {Map<string, any>} */
  const decisionOf = new Map();
  for (const x of mine) {
    if (x.e.kind !== "decision.recorded") continue;
    const decides = isPlain(x.e.payload) ? x.e.payload.decides : undefined;
    // A decision that names no request in the ULID grammar decides nothing this route can show: counted, so a winner
    // it may have decided is never presented as cleanly open (L2).
    if (typeof decides !== "string" || !ULID.test(decides)) { drop("bad_decides"); continue; }
    if (!decisionOf.has(decides)) decisionOf.set(decides, x.e);
  }
  /** @type {Map<string, { e: any, day: string }>} */
  const byId = new Map();
  for (const x of mine) {
    if (x.e.kind !== "approval.requested") continue;
    const gate = x.e.payload.gate;
    if (gate !== c.gate) { if (typeof gate !== "string") drop("bad_gate"); continue; }
    if (typeof x.e.payload.slug !== "string" || x.e.payload.slug.trim() === "") { drop("no_slug"); continue; }
    if (byId.has(x.e.id)) { drop("duplicate"); continue; }
    byId.set(x.e.id, x);
  }
  const all = [...byId.values()];
  if (all.length > MAX_WINNERS) dropped.over_cap = all.length - MAX_WINNERS;
  const winners = all.slice(-MAX_WINNERS).map((x) => {
    const p = x.e.payload;
    const d = decisionOf.get(x.e.id);
    const verdict = d ? text(d.payload.verdict) : "";
    const tokens = Array.isArray(p.cluster_tokens) ? p.cluster_tokens.filter((t) => typeof t === "string") : [];
    if (tokens.length > MAX_TOKENS) drop("tokens_cut");
    return {
      id: x.e.id, day: x.day, slug: text(p.slug), niche: text(p.niche),
      score: typeof p.score === "number" && Number.isFinite(p.score) ? p.score : null,
      cluster_fp: text(p.cluster_fp),
      cluster_tokens: tokens.slice(0, MAX_TOKENS).map(text),
      state: d ? (verdict === "approve" ? "approved" : verdict === "reject" ? "rejected" : "decided") : "open",
      decision: d ? { id: ULID.test(String(d.id)) ? d.id : "", verdict, reason: text(d.payload.reason) } : null,
    };
  });
  const hunt = run("hunt"), judge = run("judge");
  const any = captured.length + winners.length + (hunt ? 1 : 0) + (judge ? 1 : 0);
  return {
    availability: any === 0 ? "zero" : "served", failure: "", unreadable: [],
    dropped, droppedTotal: Object.values(dropped).reduce((n, v) => n + v, 0),
    captures: { count: captured.length, latest: last ? { id: last.e.id, day: last.day, source_id: text(last.e.payload.source_id) } : null },
    runs: { hunt, judge },
    winners,
  };
}

/**
 * What the spine looks like on disk: each day file with its size and mtime. A cached scan is reused only while this is
 * unchanged, so a stamp is never answered by a read older than it (attack 8164ad9 B1).
 * @param {string} root
 */
function fingerprint(root) {
  return listDays(root).map((d) => {
    try { const s = statSync(dayFile(root, d)); return `${d}:${s.size}:${s.mtimeMs}`; } catch { return `${d}:?`; }
  }).join("|");
}
/** @type {Map<string, { print: string, value: Promise<ReturnType<typeof scanAll>> }>} */
const scans = new Map();
/** One scan per spine state, shared while in flight; a scan that failed is forgotten, never replayed (B4). @param {string} root */
function sharedScan(root) {
  const print = fingerprint(root);
  const hit = scans.get(root);
  if (hit && hit.print === print) return hit.value;
  const entry = { print, value: Promise.resolve().then(() => scanAll(root)) };
  entry.value.catch(() => { if (scans.get(root) === entry) scans.delete(root); });
  scans.set(root, entry);
  return entry.value;
}

/** GET /api/discover -- takes no query. @param {{ mode: string, repo: string, root: string }} ctx @param {URL} url */
export async function apiDiscover(ctx, url) {
  for (const k of url.searchParams.keys()) throw new ReadError("BAD_ARGS", `${url.pathname} takes no query; "${scrub(k, ctx.repo)}" is not read`);
  const c = await discoverConstants();
  let read;
  try { read = await sharedScan(ctx.root); }
  catch (e) { throw new ReadError("SOURCE_INVALID", `the spine could not be scanned (${e && typeof e.code === "string" && /^[A-Z_]{1,40}$/.test(e.code) ? e.code : "SCAN_FAILED"})`); }
  return answer(ctx, "/api/discover", "log", "discover/lib/spine#PROCESS+WINNER_GATE · spine#scanAll (the scan engine, never an index)", [], discoverBody(read, c, (s) => scrub(s, ctx.repo)));
}

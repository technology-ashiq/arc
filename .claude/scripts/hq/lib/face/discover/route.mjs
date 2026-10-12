// GET /api/discover -- discover's own receipts, for the money/discover room (face v2 Phase 17, REQ-21, ADR-1356).
//
// The discover lane writes real receipts (ADR-1900): `idea.captured` for each pain it captures, `run.completed` for each
// hunt and judge, and one `approval.requested` per winner, under discover's own winner gate. This route reads them and
// nothing else. It selects ONLY through discover's own constants, imported from .claude/scripts/discover/lib/spine.mjs
// -- the process prefix and the winner gate -- so a second spelling of either cannot exist here (not even in this
// comment), and a face `idea.captured` (no discover process) is not a discover capture.
//
// Honest edges: an empty spine answers zero counts marked `zero`; a spine day the reader could not open makes the whole
// answer `unknown`, naming the day, never 0 -- a capture could be on it. A winner reads `open` until a decision.recorded
// decides it; a second decision cannot exist (the spine refuses it). Read-only: mutates nothing, no spine effect.
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scanAll } from "../../../spine.mjs";
import { ReadError, answer, scrub } from "../reads.mjs";

const CONSTANTS = new URL("../../../../discover/lib/spine.mjs", import.meta.url);
/** Caps on what one answer carries; what a cap drops is counted in the body, never silently cut. */
const MAX_WINNERS = 200;
const MAX_TOKENS = 24;
const MAX_TEXT = 300;
/** One scan answers every request inside this window, and one scan in flight is shared (attack 76e154c B3). */
const SCAN_TTL_MS = 3_000;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * discover's own constants, imported when the route is asked -- never at the door's load: a checkout that carries the
 * door but not the discover product (a bare hq install) must still start, and answers this route by name instead. Only
 * a constants FILE that is not there is SOURCE_ABSENT; a file that is there and will not load is SOURCE_INVALID with
 * its code -- a broken product is not a missing one (attack 76e154c B1).
 * @returns {Promise<{ prefix: string, gate: string }>}
 */
export async function discoverConstants(at = () => import(CONSTANTS.href), file = fileURLToPath(CONSTANTS)) {
  let present = false;
  try { present = existsSync(file) && statSync(file).isFile(); } catch { present = false; }
  if (!present) throw new ReadError("SOURCE_ABSENT", "this checkout does not carry the discover lane, so there is nothing of discover's to read");
  let m;
  try { m = await at(); } catch (e) { throw new ReadError("SOURCE_INVALID", `the discover lane's constants are on this tree and would not load (${e && typeof e.code === "string" && /^[A-Z_]{1,40}$/.test(e.code) ? e.code : "IMPORT_FAILED"})`); }
  if (typeof m.PROCESS !== "string" || m.PROCESS.indexOf("@") < 1 || typeof m.WINNER_GATE !== "string" || m.WINNER_GATE === "")
    throw new ReadError("SOURCE_INVALID", "discover's PROCESS or WINNER_GATE is not the shape this route selects by");
  // The process every discover receipt carries is <name>@<version>; any version of discover is discover.
  return { prefix: m.PROCESS.slice(0, m.PROCESS.indexOf("@") + 1), gate: m.WINNER_GATE };
}

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * The route's body over a spine as read: pure, so a fixture can hand it a spine and constants of its own. Every text
 * the spine carries passes `clean` (the door's scrub) and a length cap; an id is served only in its grammar, and an
 * entry whose id is not one is skipped and COUNTED (attack 76e154c B2).
 * @param {{ events: { event: any, day: string }[], unreadable: { day: string, code: string }[] }} read
 * @param {{ prefix: string, gate: string }} c  discover's constants (discoverConstants)
 * @param {(s: string) => string} [clean]
 */
export function discoverBody(read, c, clean = (s) => s) {
  const text = (v) => (typeof v === "string" ? clean(v).slice(0, MAX_TEXT) : "");
  const idOf = (v) => (typeof v === "string" && ULID.test(v) ? v : "");
  const ofDiscover = (e) => typeof e.process === "string" && e.process.startsWith(c.prefix);
  if (read.unreadable.length > 0) {
    // A day nobody could open may hold a capture, a run or a winner: nothing here is counted, and the answer says which.
    const days = read.unreadable.map((u) => `${text(u.day)} (${text(u.code)})`);
    return { availability: "unknown", failure: "UNREADABLE_DAY", unreadable: days, captures: null, runs: null, winners: null, dropped: 0 };
  }
  let dropped = 0;
  const events = read.events.map((w) => ({ e: w.event, day: w.day })).filter((x) => {
    const ok = isPlain(x.e) && isPlain(x.e.payload) && typeof x.e.kind === "string";
    if (ok && ofDiscover(x.e) && idOf(x.e.id) === "") { dropped++; return false; }
    return ok;
  });
  const captured = events.filter((x) => x.e.kind === "idea.captured" && ofDiscover(x.e));
  const last = captured.at(-1) ?? null;
  /** @param {"hunt" | "judge"} step */
  const run = (step) => {
    const r = events.filter((x) => x.e.kind === "run.completed" && ofDiscover(x.e) && x.e.payload.step === step).at(-1);
    return r ? { id: idOf(r.e.id), ts: text(r.e.ts), day: text(r.day), outcome: text(r.e.payload.outcome) || text(r.e.outcome) } : null;
  };
  /** @type {Map<string, any>} */
  const decisionOf = new Map();
  for (const x of events) {
    const decides = idOf(x.e.payload.decides);
    if (x.e.kind === "decision.recorded" && decides !== "" && !decisionOf.has(decides)) decisionOf.set(decides, x.e);
  }
  const all = events.filter((x) => x.e.kind === "approval.requested" && ofDiscover(x.e) && x.e.payload.gate === c.gate);
  dropped += Math.max(0, all.length - MAX_WINNERS);
  const winners = all.slice(-MAX_WINNERS).map((x) => {
    const p = x.e.payload;
    const d = decisionOf.get(x.e.id);
    const verdict = d ? text(d.payload.verdict) : "";
    const tokens = Array.isArray(p.cluster_tokens) ? p.cluster_tokens.filter((t) => typeof t === "string") : [];
    return {
      id: idOf(x.e.id), day: text(x.day), slug: text(p.slug), niche: text(p.niche),
      score: typeof p.score === "number" && Number.isFinite(p.score) ? p.score : null,
      cluster_fp: text(p.cluster_fp),
      cluster_tokens: tokens.slice(0, MAX_TOKENS).map(text),
      state: d ? (verdict === "approve" ? "approved" : verdict === "reject" ? "rejected" : "decided") : "open",
      decision: d ? { id: idOf(d.id), verdict, reason: text(d.payload.reason) } : null,
    };
  });
  const hunt = run("hunt"), judge = run("judge");
  const any = captured.length + winners.length + (hunt ? 1 : 0) + (judge ? 1 : 0);
  return {
    availability: any === 0 ? "zero" : "served", failure: "", unreadable: [], dropped,
    captures: { count: captured.length, latest: last ? { id: idOf(last.e.id), day: text(last.day), source_id: text(last.e.payload.source_id) } : null },
    runs: { hunt, judge },
    winners,
  };
}

/** @type {Map<string, { settledAt: number | null, value: Promise<ReturnType<typeof scanAll>> }>} */
const scans = new Map();
/** One scan of a root, shared while in flight and for SCAN_TTL_MS after it settles. @param {string} root */
function sharedScan(root) {
  const hit = scans.get(root);
  if (hit && (hit.settledAt === null || Date.now() - hit.settledAt < SCAN_TTL_MS)) return hit.value;
  const entry = { settledAt: /** @type {number | null} */ (null), value: Promise.resolve().then(() => scanAll(root)) };
  entry.value.finally(() => { entry.settledAt = Date.now(); }).catch(() => {});
  scans.set(root, entry);
  return entry.value;
}

/** GET /api/discover -- takes no query. @param {{ mode: string, repo: string, root: string }} ctx @param {URL} url */
export async function apiDiscover(ctx, url) {
  for (const k of url.searchParams.keys()) throw new ReadError("BAD_ARGS", `${url.pathname} takes no query; "${scrub(k, ctx.repo)}" is not read`);
  const c = await discoverConstants();
  return answer(ctx, "/api/discover", "log", "discover/lib/spine#PROCESS+WINNER_GATE · spine#scanAll (the scan engine, never an index)", [], discoverBody(await sharedScan(ctx.root), c, (s) => scrub(s, ctx.repo)));
}

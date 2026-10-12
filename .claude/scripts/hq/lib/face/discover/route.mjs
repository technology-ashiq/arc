// GET /api/discover -- discover's own receipts, for the money/discover room (face v2 Phase 17, REQ-21, ADR-1356).
//
// The discover lane writes real receipts (ADR-1900): `idea.captured` for each pain it captures, `run.completed` for each
// hunt and judge, and one `approval.requested` per winner, gated `discover-winner`. This route reads them and nothing
// else. It selects ONLY through discover's own constants, imported from .claude/scripts/discover/lib/spine.mjs -- the
// process prefix and the winner gate -- so a second spelling of either cannot exist here, and a face `idea.captured`
// (no discover process) is not a discover capture.
//
// Honest edges: an empty spine answers zero counts marked `zero`; a spine day the reader could not open makes the whole
// answer `unknown`, naming the day, never 0 -- a capture could be on it. A winner reads `open` until a decision.recorded
// decides it; a second decision cannot exist (the spine refuses it). Read-only: mutates nothing, no spine effect.
import { scanAll } from "../../../spine.mjs";
import { ReadError, answer, scrub } from "../reads.mjs";

/**
 * discover's own constants, imported when the route is asked -- never at the door's load: a checkout that carries the
 * door but not the discover product (a bare hq install) must still start, and answers this route by name instead.
 * @returns {Promise<{ prefix: string, gate: string }>}
 */
export async function discoverConstants(at = () => import(new URL("../../../../discover/lib/spine.mjs", import.meta.url).href)) {
  let m;
  try { m = await at(); } catch (e) { throw new ReadError("SOURCE_ABSENT", `the discover lane's constants could not be loaded (${e && e.code ? e.code : "IMPORT_FAILED"}) -- this checkout does not carry discover`); }
  if (typeof m.PROCESS !== "string" || m.PROCESS.indexOf("@") < 1 || typeof m.WINNER_GATE !== "string" || m.WINNER_GATE === "")
    throw new ReadError("SOURCE_INVALID", "discover's PROCESS or WINNER_GATE is not the shape this route selects by");
  // The process every discover receipt carries is <name>@<version>; any version of discover is discover.
  return { prefix: m.PROCESS.slice(0, m.PROCESS.indexOf("@") + 1), gate: m.WINNER_GATE };
}

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v) => (typeof v === "string" ? v : "");
/**
 * The route's body over a spine as read: pure, so a fixture can hand it a spine and constants of its own.
 * @param {{ events: { event: any, day: string }[], unreadable: { day: string, code: string }[] }} read
 * @param {{ prefix: string, gate: string }} c  discover's constants (discoverConstants)
 */
export function discoverBody(read, c) {
  const ofDiscover = (e) => typeof e.process === "string" && e.process.startsWith(c.prefix);
  if (read.unreadable.length > 0) {
    // A day nobody could open may hold a capture, a run or a winner: nothing here is counted, and the answer says which.
    const days = read.unreadable.map((u) => `${u.day} (${u.code})`);
    return { availability: "unknown", failure: "UNREADABLE_DAY", unreadable: days, captures: null, runs: null, winners: null };
  }
  const events = read.events.map((w) => ({ e: w.event, day: w.day })).filter((x) => isPlain(x.e) && isPlain(x.e.payload) && typeof x.e.kind === "string");
  const captured = events.filter((x) => x.e.kind === "idea.captured" && ofDiscover(x.e));
  const last = captured.at(-1) ?? null;
  /** @param {"hunt" | "judge"} step */
  const run = (step) => {
    const r = events.filter((x) => x.e.kind === "run.completed" && ofDiscover(x.e) && x.e.payload.step === step).at(-1);
    return r ? { id: text(r.e.id), ts: text(r.e.ts), day: r.day, outcome: text(r.e.payload.outcome) || text(r.e.outcome) } : null;
  };
  /** @type {Map<string, any>} */
  const decisionOf = new Map();
  for (const x of events) if (x.e.kind === "decision.recorded" && typeof x.e.payload.decides === "string" && !decisionOf.has(x.e.payload.decides)) decisionOf.set(x.e.payload.decides, x.e);
  const winners = events.filter((x) => x.e.kind === "approval.requested" && ofDiscover(x.e) && x.e.payload.gate === c.gate).map((x) => {
    const p = x.e.payload;
    const d = decisionOf.get(x.e.id);
    const verdict = d ? text(d.payload.verdict) : "";
    return {
      id: text(x.e.id), day: x.day, slug: text(p.slug), niche: text(p.niche),
      score: typeof p.score === "number" && Number.isFinite(p.score) ? p.score : null,
      cluster_fp: text(p.cluster_fp),
      cluster_tokens: Array.isArray(p.cluster_tokens) ? p.cluster_tokens.filter((t) => typeof t === "string") : [],
      state: d ? (verdict === "approve" ? "approved" : verdict === "reject" ? "rejected" : "decided") : "open",
      decision: d ? { id: text(d.id), verdict, reason: text(d.payload.reason) } : null,
    };
  });
  const hunt = run("hunt"), judge = run("judge");
  const any = captured.length + winners.length + (hunt ? 1 : 0) + (judge ? 1 : 0);
  return {
    availability: any === 0 ? "zero" : "served", failure: "", unreadable: [],
    captures: { count: captured.length, latest: last ? { id: text(last.e.id), day: last.day, source_id: text(last.e.payload.source_id) } : null },
    runs: { hunt, judge },
    winners,
  };
}

/** GET /api/discover -- takes no query. @param {{ mode: string, repo: string, root: string }} ctx @param {URL} url */
export async function apiDiscover(ctx, url) {
  for (const k of url.searchParams.keys()) throw new ReadError("BAD_ARGS", `${url.pathname} takes no query; "${scrub(k, ctx.repo)}" is not read`);
  return answer(ctx, "/api/discover", "log", "discover/lib/spine#PROCESS+WINNER_GATE · spine#scanAll", [], discoverBody(scanAll(ctx.root), await discoverConstants()));
}

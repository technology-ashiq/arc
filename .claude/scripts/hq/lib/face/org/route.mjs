// GET /api/org -- the org's own extract, for the org room's roles, teams and scorecards (org Cycle 19, ADR-1625).
//
// ONE COUNT. The chart is org-catalog's `chartModel()` over org-coverage's `collect()`, the teams are org-team's own
// reader and validator, and the scorecards are org-review's `loadOrg`/`readSpine` with attribution's `placeAll`/
// `scorecard` and org-review's `verdictFor` -- all imported. This file re-derives nothing: a second counter in the face
// is the twin-fix shape the retro log carries three times.
//
// THE SPINE THE DOOR READS. The scorecards read `ctx.root`, the dir the door's own `readAll` reads, never org-review's
// default (`spineRoot()` refuses a linked worktree), so sim mode scores the sim spine. READ-ONLY: nothing here writes.
//
// PARTS REFUSE ON THEIR OWN. A wrong-shaped chart refuses the route whole. A spine that cannot be read, or an
// attribution map with findings (`loadOrg` returns those as DATA, not a throw), refuses the scorecards part by name and
// the chart is still served -- never an all-zero room that looks measured.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ReadError, answer, scrub, scrubDeep, todayIst } from "../reads.mjs";

/** The body schema the org room renders. */
export const ORG_SCHEMA = 1;

const ORG = new URL("../../../../org/", import.meta.url);
const WANT = Object.freeze({
  collect: "function", chartModel: "function", loadOrg: "function", readSpine: "function", verdictFor: "function",
  placeAll: "function", scorecard: "function", isStaffed: "function", isId: "function", readTeam: "function", validateTeam: "function",
});

let loading = null;
/** The org producers, imported once. A load failure refuses this route by name, with the loader's code only. */
async function producers() {
  if (!loading) {
    const at = (f) => import(new URL(f, ORG).href);
    loading = Promise.all([at("org-coverage.mjs"), at("org-catalog.mjs"), at("org-review.mjs"), at("lib/attribution.mjs"), at("lib/card.mjs"), at("org-team.mjs"), at("lib/team.mjs")])
      .then(([cov, cat, rev, att, card, team, teamLib]) => ({ m: {
        collect: cov.collect, chartModel: cat.chartModel, loadOrg: rev.loadOrg, readSpine: rev.readSpine, verdictFor: rev.verdictFor,
        placeAll: att.placeAll, scorecard: att.scorecard, isStaffed: card.isStaffed, isId: card.isId, readTeam: team.readTeam, validateTeam: teamLib.validateTeam,
      } }), (e) => ({ e }));
  }
  const got = await loading;
  if (got.e) {
    const raw = String((got.e && (got.e.code || got.e.name)) || "Error");
    throw new ReadError("PARSER_UNAVAILABLE", `the org producers this route imports did not load (${/^[A-Za-z0-9_]{1,64}$/.test(raw) ? raw : "Error"})`);
  }
  return got.m;
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const NO_TEAM = "no venture team exists yet: the pilot waits for the first registered venture (ADR-1612 Amendment 1)";
/** A part that threw is refused by name with the error's code only -- the message may carry a path. */
const partRefused = (part, e) => {
  const raw = String((e && (e.code || e.name)) || "Error");
  return { state: "refused", code: "SOURCE_INVALID", human: `the ${part} could not be read (${/^[A-Za-z0-9_]{1,64}$/.test(raw) ? raw : "Error"}); the chart is still served`, rows: [] };
};

/** The chart model's shape, checked whole: counts of integers, departments of { dept, name, roles: [{ id }] }. */
function chartOk(c) {
  return isObj(c) && isObj(c.counts) && Object.values(c.counts).every((n) => Number.isInteger(n) && n >= 0)
    && Array.isArray(c.departments) && c.departments.length > 0
    && c.departments.every((d) => isObj(d) && typeof d.dept === "string" && typeof d.name === "string" && Array.isArray(d.roles)
      && d.roles.every((r) => isObj(r) && typeof r.id === "string" && typeof r.state === "string"));
}

/** Every team manifest under org/teams/, each read and validated by org-team's own functions. */
function teamsOf(repo, w, p) {
  const dir = join(repo, "org", "teams");
  if (!isDir(dir)) return { state: "none", why: NO_TEAM, rows: [] };
  const cards = new Map(w.cards.map((c) => [c.card?.id, c.card]).filter(([id]) => typeof id === "string"));
  const ventures = new Set(w.ventures);
  const rows = [];
  // A listed name is opened only when it is a regular file (a symlink or a directory is not followed) and its stem is
  // the venture-slug grammar: Windows opens con.team.yaml as the console device whatever the extension.
  const entries = readdirSync(dir, { withFileTypes: true }).filter((d) => d.name.endsWith(".team.yaml")).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const d of entries) {
    const stem = d.name.slice(0, -".team.yaml".length);
    if (!d.isFile() || !p.isId(stem)) { rows.push({ venture: stem, valid: false, findings: [`${d.name} is not read: a team file is a regular file named <venture-slug>.team.yaml`], stage: "", seats: [] }); continue; }
    const t = p.readTeam(repo, stem);
    if (t.error) { rows.push({ venture: stem, valid: false, findings: [t.error], stage: "", seats: [] }); continue; }
    const findings = p.validateTeam(t.doc, { stem, ventures, cards });
    const seats = isObj(t.doc.seats) ? Object.keys(t.doc.seats).sort().map((id) => ({ id, holder: String(t.doc.seats[id]?.holder ?? "") })) : [];
    rows.push({ venture: stem, valid: findings.length === 0, findings, stage: String(t.doc.stage ?? ""), seats });
  }
  return rows.length ? { state: "ok", why: "", rows } : { state: "none", why: NO_TEAM, rows: [] };
}

/** The scorecards part: one row per card, exactly org-review --all --json's row plus the verdict for staffed seats. */
async function scorecardsOf(repo, spineDir, p) {
  const org = await p.loadOrg(repo);
  if (org.findings.length) return { state: "refused", code: "SOURCE_INVALID", human: `org/attribution.yaml has ${org.findings.length} finding(s); nothing is scored: ${org.findings.slice(0, 3).join(" · ")}`, rows: [] };
  // A spine root holds events/; a directory without one scored every seat "no evidence" and answered ok -- an empty
  // read that looked measured (found by the Phase 00 smoke, which was handed the events/ dir itself).
  if (typeof spineDir !== "string" || !isDir(join(spineDir, "events"))) return { state: "refused", code: "SPINE_UNAVAILABLE", human: "the door has no spine with an events/ directory to score from", rows: [] };
  const sp = await p.readSpine(repo, spineDir);
  const { placements, unattributed, conflicts } = p.placeAll(sp.events, org.rules, org.roleIds);
  const today = todayIst();
  const rows = org.cards.map((c) => {
    const s = p.scorecard(c.id, sp.events, placements);
    const row = { ...s, seat: c.seat, staffed: p.isStaffed(c) };
    if (!row.staffed) return row;
    const v = p.verdictFor(s);
    const due = typeof c.review_by === "string" && c.review_by <= today ? "due" : `not due (review_by ${c.review_by})`;
    return { ...row, verdict: v.verdict, why: v.why, due };
  });
  return {
    state: "ok", code: "", human: "", rows,
    total: sp.events.length, unattributed, conflicts: conflicts.length,
    spineDamage: { torn: sp.torn.length, unreadable: sp.unreadable.length },
  };
}

/**
 * The route body. Exported so the fixture can hold it equal to the CLIs without a door. `inject.producers` stands in
 * for the imported modules so a test can hand the route a wrong shape or a missing export; the door never passes it.
 * @param {string} repo @param {string} spineDir @param {{ producers?: any }} [inject]
 */
export async function orgBody(repo, spineDir, inject = {}) {
  const p = inject.producers ?? await producers();
  for (const [name, kind] of Object.entries(WANT)) {
    if (!(p && Object.hasOwn(p, name) && typeof p[name] === kind)) throw new ReadError("PARSER_UNAVAILABLE", `the org producers do not export ${name} as a ${kind} (ADR-1625 imports it rather than re-deriving it)`);
  }
  const w = await p.collect(repo);
  const chart = p.chartModel(w);
  if (!chartOk(chart)) throw new ReadError("SOURCE_INVALID", "the org chart model is not counts plus departments of roles -- refused whole, never rendered in part");
  // Each part refuses on its own: one broken team file or one bad spine line never removes the chart from the room.
  let teams, scorecards;
  try { teams = teamsOf(repo, w, p); } catch (e) { teams = { state: "refused", why: partRefused("venture teams", e).human, rows: [] }; }
  try { scorecards = await scorecardsOf(repo, spineDir, p); } catch (e) { scorecards = partRefused("scorecards", e); }
  return { schema: ORG_SCHEMA, chart, teams, scorecards };
}

/**
 * The served value: the body after the door's scrub, and which role ids the scrub altered. A transform between the
 * measured value and the served one says what it destroyed (retro 2026-07-30), so a withheld path is never silent.
 * @param {string} repo @param {string} spineDir @param {{ producers?: any }} [inject]
 */
export async function servedOrg(repo, spineDir, inject = {}) {
  const body = await orgBody(repo, spineDir, inject);
  const served = /** @type {any} */ (scrubDeep(body, repo));
  const altered = new Set();
  body.chart.departments.forEach((d, i) => d.roles.forEach((r, j) => {
    if (JSON.stringify(served.chart.departments[i].roles[j]) !== JSON.stringify(r)) altered.add(r.id);
  }));
  body.scorecards.rows.forEach((r, i) => { if (JSON.stringify(served.scorecards.rows[i]) !== JSON.stringify(r)) altered.add(r.role); });
  return { ...served, scrubbed: [...altered].sort() };
}

// One computation at a time per (mode, repo, spine): concurrent requests share it; nothing outlives the request. It
// does not bound the synchronous spine scan, which still holds the event loop while it runs.
/** @type {Map<string, Promise<any>>} */
const inflight = new Map();

/** GET /api/org -- takes no query. @param {{ mode: string, repo: string, root: string }} ctx @param {URL} url */
export async function apiOrg(ctx, url) {
  for (const k of url.searchParams.keys()) throw new ReadError("BAD_ARGS", `${url.pathname} takes no query; "${scrub(k, ctx.repo)}" is not read`);
  const key = `${ctx.mode}\u0000${ctx.repo}\u0000${ctx.root}`;
  let p = inflight.get(key);
  if (!p) {
    p = servedOrg(ctx.repo, ctx.root).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return answer(ctx, "/api/org", "files and log", "org-catalog#chartModel · org-team#readTeam · org-review#loadOrg+readSpine · attribution#placeAll+scorecard", [], await p);
}

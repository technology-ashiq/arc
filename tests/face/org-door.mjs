// The org room's door route (org Cycle 19, REQ-01, ADR-1625) -- the hard lines, without a door:
//   A. ONE COUNT: the route's chart is org-catalog's chartModel over org-coverage's collect, byte for byte, and its
//      scorecard rows are org-review --all --json's rows for the same spine, byte for byte (verdict fields aside).
//   B. THE SPINE THE DOOR READS: a spine root with no events/ refuses the scorecards by name; the chart is still served.
//   C. REFUSED, NEVER HALF-DRAWN: a wrong-shaped chart refuses whole; an attribution map with findings (loadOrg returns
//      those as DATA) refuses the scorecards by name; a producer set missing an export refuses PARSER_UNAVAILABLE.
//   D. SCRUB SAYS WHAT IT DESTROYED: a role title carrying an absolute path is withheld AND listed in `scrubbed`.
//   E. ONE COMPUTATION: two concurrent requests share one body; a query key is BAD_ARGS.
// The live door (token, Origin, GET-only) is held in tests/face/dash-doors.mjs.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const imp = (rel) => import(pathToFileURL(join(REPO, rel)).href);
const R = await imp(".claude/scripts/hq/lib/face/org/route.mjs");
const cov = await imp(".claude/scripts/org/org-coverage.mjs");
const cat = await imp(".claude/scripts/org/org-catalog.mjs");
const rev = await imp(".claude/scripts/org/org-review.mjs");
const att = await imp(".claude/scripts/org/lib/attribution.mjs");
const card = await imp(".claude/scripts/org/lib/card.mjs");
const team = await imp(".claude/scripts/org/org-team.mjs");
const teamLib = await imp(".claude/scripts/org/lib/team.mjs");
const REAL = Object.freeze({
  collect: cov.collect, chartModel: cat.chartModel, loadOrg: rev.loadOrg, readSpine: rev.readSpine, verdictFor: rev.verdictFor,
  placeAll: att.placeAll, scorecard: att.scorecard, isStaffed: card.isStaffed, readTeam: team.readTeam, validateTeam: teamLib.validateTeam,
});

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};
const refusal = async (fn) => { try { await fn(); return null; } catch (e) { return { code: /** @type {any} */ (e).code, message: String(/** @type {any} */ (e).message) }; } };
const strip = (r) => { const { verdict, why, due, ...x } = r; return x; };

const tmp = mkdtempSync(join(tmpdir(), "face-org-"));
try {
  const spine = join(tmp, "spine");
  const fx = spawnSync(process.execPath, [join(REPO, "tests/org/spine-fixture.mjs"), spine, "full"], { encoding: "utf8", timeout: 60000 });
  check("fixture: the full org spine was written (vacuous-pass guard)", fx.status === 0 && /^spine-fixture: [1-9]/.test(fx.stdout), `${fx.status} ${fx.stdout}${fx.stderr}`);

  // ---- A. one count ----
  {
    const body = await R.orgBody(REPO, spine);
    const want = cat.chartModel(await cov.collect(REPO));
    check("fixture: the catalog holds at least 50 roles (a thin catalog would pass equality on nothing)", want.counts.roles >= 50, String(want.counts.roles));
    check("A: the route's chart is org-catalog's chartModel over collect, byte for byte", JSON.stringify(body.chart) === JSON.stringify(want));
    const cli = spawnSync(process.execPath, [join(REPO, ".claude/scripts/org/org-review.mjs"), "--all", "--json", "--spine-dir", spine], { encoding: "utf8", timeout: 60000 });
    const at = cli.stdout.search(/^\{/m);
    const roles = at >= 0 ? JSON.parse(cli.stdout.slice(at)).roles : [];
    check("fixture: org-review --all --json ran and scored at least 3 seats with evidence", cli.status === 0 && roles.filter((r) => r.evidence).length >= 3, `${cli.status} ${roles.filter((r) => r.evidence).length}`);
    check("A: the route's scorecard rows are org-review --all --json's rows, byte for byte (verdict fields aside)",
      body.scorecards.state === "ok" && JSON.stringify(body.scorecards.rows.map(strip)) === JSON.stringify(roles), `${body.scorecards.state} ${body.scorecards.rows.length} vs ${roles.length}`);
    const staffed = body.scorecards.rows.filter((r) => r.staffed);
    check("A: every staffed row carries exactly one verdict from verdictFor, and no other row carries one",
      staffed.length > 0 && staffed.every((r) => ["keep", "promote", "retrain", "retire"].includes(r.verdict) && r.verdict === rev.verdictFor(strip(r)).verdict)
      && body.scorecards.rows.filter((r) => !r.staffed).every((r) => !("verdict" in r)), String(staffed.length));
    check("A: schema 1, teams answered with a state, and the read counts served", body.schema === 1 && ["ok", "none"].includes(body.teams.state)
      && Number.isInteger(body.scorecards.total) && body.scorecards.total > 0 && Number.isInteger(body.scorecards.spineDamage.torn), JSON.stringify(body.teams.state));
  }

  // ---- B. the spine the door reads ----
  {
    const bare = join(tmp, "no-events");
    mkdirSync(bare, { recursive: true });
    const body = await R.orgBody(REPO, bare);
    check("B: a spine root with no events/ refuses the scorecards (SPINE_UNAVAILABLE), never scores every seat no evidence",
      body.scorecards.state === "refused" && body.scorecards.code === "SPINE_UNAVAILABLE" && body.scorecards.rows.length === 0, JSON.stringify(body.scorecards).slice(0, 160));
    check("B: and the chart is still served whole beside that refusal", body.chart.counts.roles >= 50);
    const events = await R.orgBody(REPO, join(spine, "events"));
    check("B: handing the events/ directory itself (one level too deep) is refused the same way", events.scorecards.code === "SPINE_UNAVAILABLE");
  }

  // ---- C. refused, never half-drawn ----
  {
    const wrong = await refusal(() => R.orgBody(REPO, spine, { producers: { ...REAL, chartModel: () => ({ counts: { roles: 1 }, departments: "a-board" }) } }));
    check("C: a chart model whose departments are not a list is refused whole (SOURCE_INVALID)", wrong !== null && wrong.code === "SOURCE_INVALID", JSON.stringify(wrong));
    const findings = await R.orgBody(REPO, spine, { producers: { ...REAL, loadOrg: async (root) => ({ ...(await rev.loadOrg(root)), findings: ["org/attribution.yaml is missing -- nothing can be placed"] }) } });
    check("C: an attribution map with findings refuses the scorecards by name, with the finding, and serves the chart",
      findings.scorecards.state === "refused" && findings.scorecards.code === "SOURCE_INVALID" && findings.scorecards.human.includes("is missing") && findings.chart.counts.roles >= 50,
      JSON.stringify(findings.scorecards).slice(0, 160));
    const { loadOrg, ...lacking } = REAL;
    const missing = await refusal(() => R.orgBody(REPO, spine, { producers: lacking }));
    check("C: a producer set without loadOrg as an own function is refused PARSER_UNAVAILABLE", missing !== null && missing.code === "PARSER_UNAVAILABLE" && missing.message.includes("loadOrg"), JSON.stringify(missing));
    const inherited = await refusal(() => R.orgBody(REPO, spine, { producers: Object.assign(Object.create({ loadOrg: rev.loadOrg }), lacking) }));
    check("C: an INHERITED loadOrg is not an export (own-member check)", inherited !== null && inherited.code === "PARSER_UNAVAILABLE", JSON.stringify(inherited));
  }

  // ---- D. the scrub says what it destroyed ----
  {
    const planted = (w) => {
      const m = cat.chartModel(w);
      const r = m.departments[0].roles[0];
      r.title = `${r.title} C:\\Users\\someone\\secret`;
      return m;
    };
    const served = await R.servedOrg(REPO, spine, { producers: { ...REAL, chartModel: planted } });
    const first = served.chart.departments[0].roles[0];
    check("D: a role title carrying an absolute path is withheld on the wire", !first.title.includes("someone") && first.title.includes("[path withheld]"), first.title);
    check("D: and that role is named in `scrubbed`, never changed silently", served.scrubbed.includes(first.id), JSON.stringify(served.scrubbed));
    const clean = await R.servedOrg(REPO, spine);
    check("D: over the real catalog the scrub altered nothing and says so", Array.isArray(clean.scrubbed) && clean.scrubbed.length === 0, JSON.stringify(clean.scrubbed));
  }

  // ---- E. one computation, no query ----
  {
    const ctx = { mode: "sim", repo: REPO, root: spine };
    const [a, b] = await Promise.all([R.apiOrg(ctx, new URL("http://door/api/org")), R.apiOrg(ctx, new URL("http://door/api/org"))]);
    check("E: two concurrent requests are answered from one body, not two", a.route === "/api/org" && a.chart === b.chart && a.chart.counts.roles >= 50);
    const q = await refusal(() => R.apiOrg(ctx, new URL("http://door/api/org?role=qa-tester")));
    check("E: a query key is BAD_ARGS", q !== null && q.code === "BAD_ARGS", JSON.stringify(q));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed ? 1 : 0;

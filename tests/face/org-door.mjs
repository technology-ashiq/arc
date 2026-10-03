// The org room's door route (org Cycle 19, REQ-01, ADR-1625) -- the hard lines, without a door:
//   A. ONE COUNT: the route's chart is org-catalog's chartModel over org-coverage's collect, byte for byte, and its
//      scorecard rows are org-review --all --json's rows for the same spine, byte for byte (verdict fields aside).
//   B. THE SPINE THE DOOR READS: a spine root with no events/ refuses the scorecards by name; the chart is still served.
//   C. REFUSED, NEVER HALF-DRAWN: a wrong-shaped chart refuses whole; an attribution map with findings (loadOrg returns
//      those as DATA) refuses the scorecards by name; a producer set missing an export refuses PARSER_UNAVAILABLE.
//   D. SCRUB SAYS WHAT IT DESTROYED: a role title carrying an absolute path is withheld AND listed in `scrubbed`.
//   E. ONE COMPUTATION: two concurrent requests share one body (keyed by mode too); a query key is BAD_ARGS.
//   F. A FAILED IMPORT IS FORGOTTEN: a transient producer import error refuses one request, not every later one.
// The live door (token, Origin, GET-only) is held in tests/face/dash-doors.mjs.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
  placeAll: att.placeAll, scorecard: att.scorecard, isStaffed: card.isStaffed, isId: card.isId, readTeam: team.readTeam, validateTeam: teamLib.validateTeam,
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
  // Every arm below reads this spine: without it they throw and bury the cause (attack r2 B4).
  if (failed) throw new Error(`the spine fixture was not written (status ${fx.status}${fx.signal ? `, ${fx.signal}` : ""}); the later arms are skipped`);

  // ---- A. one count ----
  {
    const body = await R.orgBody(REPO, spine);
    const want = cat.chartModel(await cov.collect(REPO));
    check("fixture: the catalog holds at least 50 roles (a thin catalog would pass equality on nothing)", want.counts.roles >= 50, String(want.counts.roles));
    check("A: the route's chart is org-catalog's chartModel over collect, byte for byte", JSON.stringify(body.chart) === JSON.stringify(want));
    const cli = spawnSync(process.execPath, [join(REPO, ".claude/scripts/org/org-review.mjs"), "--all", "--json", "--spine-dir", spine], { encoding: "utf8", timeout: 60000 });
    const at = cli.stdout.search(/^\{/m);
    let roles = [];
    try { roles = at >= 0 ? JSON.parse(cli.stdout.slice(at)).roles : []; } catch (e) { check("fixture: org-review --json printed parseable JSON", false, `${cli.status} ${String(e)}`); }
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
    // Attack r2 B2: an events/ dir that exists but yields no event is the same empty read.
    const hollow = join(tmp, "hollow-spine");
    mkdirSync(join(hollow, "events"), { recursive: true });
    const empty = await R.orgBody(REPO, hollow);
    check("B: an events/ dir with no readable event refuses the scorecards (SPINE_UNAVAILABLE), never scores every seat no evidence",
      empty.scorecards.state === "refused" && empty.scorecards.code === "SPINE_UNAVAILABLE" && empty.chart.counts.roles >= 50, JSON.stringify(empty.scorecards).slice(0, 160));
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
    // Attack r1 B3: a part that THROWS refuses that part only; the chart is still served.
    const boom = () => { const e = new Error(`bad line in ${REPO}`); /** @type {any} */ (e).code = "EBADLINE"; throw e; };
    const spineThrows = await R.orgBody(REPO, spine, { producers: { ...REAL, readSpine: async () => boom() } });
    check("C: a readSpine that throws refuses the scorecards by code, path-free, and serves the chart",
      spineThrows.scorecards.state === "refused" && spineThrows.scorecards.human.includes("EBADLINE") && !spineThrows.scorecards.human.includes(REPO) && spineThrows.chart.counts.roles >= 50,
      JSON.stringify(spineThrows.scorecards).slice(0, 160));
    const offRepo = { collect: async () => REAL.collect(REPO), loadOrg: async () => rev.loadOrg(REPO) };
    const grepo = join(tmp, "good-team-repo");
    mkdirSync(join(grepo, "org", "teams"), { recursive: true });
    writeFileSync(join(grepo, "org", "teams", "acme.team.yaml"), "venture: acme\n");
    const teamThrows = await R.orgBody(grepo, spine, { producers: { ...REAL, ...offRepo, readTeam: () => ({ doc: {} }), validateTeam: () => boom() } });
    check("C: a teams part that throws is refused with a path-free why and the chart is still served",
      teamThrows.teams.state === "refused" && teamThrows.teams.why.includes("EBADLINE") && !teamThrows.teams.why.includes(REPO) && teamThrows.chart.counts.roles >= 50,
      JSON.stringify(teamThrows.teams).slice(0, 160));
    check("C: a refused teams part carries the same code as a refused scorecards part (close attack B2)", teamThrows.teams.code === "SOURCE_INVALID", JSON.stringify(teamThrows.teams.code));
    // Close attack L1: a card collect() could not read refuses the chart whole, as `org-catalog --chart --check` does.
    const dropped = await refusal(() => R.orgBody(REPO, spine, { producers: { ...REAL, collect: async (r) => ({ ...(await REAL.collect(r)), errors: ["org/roles/d-product/broken.role.yaml: bad indentation"] }) } }));
    check("C: a catalog with an unreadable card refuses the chart whole (SOURCE_INVALID), never a chart one card shorter",
      dropped !== null && dropped.code === "SOURCE_INVALID" && dropped.message.includes("broken.role.yaml"), JSON.stringify(dropped));
    // Close attack L4: zero cards is the same empty read as zero events.
    const noCards = await R.orgBody(REPO, spine, { producers: { ...REAL, loadOrg: async (root) => ({ ...(await rev.loadOrg(root)), cards: [] }) } });
    check("C: an org with zero role cards refuses the scorecards by name, never an ok part with no rows",
      noCards.scorecards.state === "refused" && noCards.scorecards.code === "SOURCE_INVALID" && noCards.scorecards.human.includes("zero role cards"), JSON.stringify(noCards.scorecards).slice(0, 160));
    // Close attack L2/L3: only an ABSENT org/teams says "no venture team"; a link or a non-directory is refused.
    const frepo = join(tmp, "file-teams-repo");
    mkdirSync(join(frepo, "org"), { recursive: true });
    writeFileSync(join(frepo, "org", "teams"), "not a directory\n");
    const fileTeams = await R.orgBody(frepo, spine, { producers: { ...REAL, ...offRepo } });
    check("C: an org/teams that is not a directory is refused by code, never read as no venture team",
      fileTeams.teams.state === "refused" && fileTeams.teams.why.includes("NOT_A_DIRECTORY"), JSON.stringify(fileTeams.teams).slice(0, 160));
    const outside = join(tmp, "outside-teams");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "acme.team.yaml"), "venture: acme\n");
    const lrepo = join(tmp, "linked-teams-repo");
    mkdirSync(join(lrepo, "org"), { recursive: true });
    symlinkSync(outside, join(lrepo, "org", "teams"), process.platform === "win32" ? "junction" : "dir");
    const linkedOpened = [];
    const linked = await R.orgBody(lrepo, spine, { producers: { ...REAL, ...offRepo, readTeam: (_r, stem) => { linkedOpened.push(stem); return { error: "stub" }; } } });
    check("C: an org/teams that is a link out of the repo is refused (LINK) and nothing behind it is opened",
      linked.teams.state === "refused" && linked.teams.why.includes("LINK") && linkedOpened.length === 0, JSON.stringify({ t: linked.teams, linkedOpened }).slice(0, 200));
    // Attack r1 B1/B2: a team listing is opened only for a regular file with a slug stem.
    const trepo = join(tmp, "teams-repo");
    mkdirSync(join(trepo, "org", "teams", "evil.team.yaml"), { recursive: true });
    writeFileSync(join(trepo, "org", "teams", "con.team.yaml"), "venture: con\n");
    const opened = [];
    const tb = await R.orgBody(trepo, spine, { producers: { ...REAL, ...offRepo, readTeam: (_r, stem) => { opened.push(stem); return { error: "stub" }; } } });
    check("C: a device-named team file and a directory named *.team.yaml are listed as not read, never opened",
      opened.length === 0 && tb.teams.rows.length === 2 && tb.teams.rows.every((r) => !r.valid && r.findings[0].includes("is not read")),
      JSON.stringify({ opened, rows: tb.teams.rows }).slice(0, 200));
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
    check("D: and names no altered part", Array.isArray(clean.scrubbedParts) && clean.scrubbedParts.length === 0, JSON.stringify(clean.scrubbedParts));
    // Attack r2 B3: a path in a team finding is withheld AND the teams part is named.
    const prepo = join(tmp, "path-team-repo");
    mkdirSync(join(prepo, "org", "teams"), { recursive: true });
    writeFileSync(join(prepo, "org", "teams", "acme.team.yaml"), "venture: acme\n");
    const leaky = await R.servedOrg(prepo, spine, { producers: { ...REAL, collect: async () => REAL.collect(REPO), loadOrg: async () => rev.loadOrg(REPO),
      readTeam: () => ({ doc: { stage: "pilot", seats: {} } }), validateTeam: () => [`seat file C:\\Users\\someone\\secret.yaml not found`] } });
    check("D: a team finding carrying an absolute path is withheld on the wire and the teams part is named",
      leaky.teams.rows.length === 1 && !JSON.stringify(leaky.teams).includes("someone") && leaky.scrubbedParts.includes("teams"), JSON.stringify({ t: leaky.teams.rows, p: leaky.scrubbedParts }).slice(0, 200));
  }

  // ---- F. a failed producer import is forgotten (attack r2 B1) ----
  {
    let calls = 0;
    const load = R.producerLoader(async (f) => { calls++; if (calls === 1) { const e = new Error("too many open files"); /** @type {any} */ (e).code = "EMFILE"; throw e; } return imp(`.claude/scripts/org/${f}`); });
    const first = await refusal(load);
    const second = await refusal(load);
    check("F: the first request after a transient import failure is refused PARSER_UNAVAILABLE with the code", first !== null && first.code === "PARSER_UNAVAILABLE" && first.message.includes("EMFILE"), JSON.stringify(first));
    check("F: and the next request retries the import and loads", second === null && calls > 7, JSON.stringify({ second, calls }));
  }

  // ---- E. one computation, no query ----
  {
    const ctx = { mode: "sim", repo: REPO, root: spine };
    const [a, b] = await Promise.all([R.apiOrg(ctx, new URL("http://door/api/org")), R.apiOrg(ctx, new URL("http://door/api/org"))]);
    check("E: two concurrent requests are answered from one body, not two", a.route === "/api/org" && a.chart === b.chart && a.chart.counts.roles >= 50);
    // Attack r1 B4: the single flight is keyed by mode too -- a live and a sim request never share one body.
    const [s1, l1] = await Promise.all([R.apiOrg(ctx, new URL("http://door/api/org")), R.apiOrg({ ...ctx, mode: "live" }, new URL("http://door/api/org"))]);
    check("E: a sim and a live request over the same repo and spine are two computations", s1.chart !== l1.chart && s1.chart.counts.roles === l1.chart.counts.roles);
    const q = await refusal(() => R.apiOrg(ctx, new URL("http://door/api/org?role=qa-tester")));
    check("E: a query key is BAD_ARGS", q !== null && q.code === "BAD_ARGS", JSON.stringify(q));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed ? 1 : 0;

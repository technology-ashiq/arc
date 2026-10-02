// The org room's roles, scorecards and teams section (org Cycle 19, REQ-02/03/04, ADR-1624) -- what fold() answers over
// the door's REAL /api/org body (escaped once, as arc-dash's escapeDeep writes it) and over mutants of it:
//   roles      one row per card, grouped by the served departments; the counts line's classes sum to the row count
//   scores     exactly the producer's staffed rows carry a verdict; `no evidence` is never 0 or a rate; a refused
//              scorecards part renders the refusal, never a room of `no evidence`
//   teams      none -> the ADR-1612 sentence; a team -> its seats by id
//   whole      a body of another schema is refused whole; the lane roster still reads /api/board beside it
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const MOD = join(REPO, "face", "src", "modules", "company", "org");
const F = await import(pathToFileURL(join(MOD, "fold.mjs")).href);
const manifest = (await import(pathToFileURL(join(MOD, "module.mjs")).href)).default;
const reg = await import(pathToFileURL(join(REPO, "face", "src", "lib", "registry.mjs")).href);
const R = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "org", "route.mjs")).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};

// arc-dash's escapeDeep, as the wire carries it: every string escaped once.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const escDeep = (v) => (typeof v === "string" ? esc(v) : Array.isArray(v) ? v.map(escDeep) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [esc(k), escDeep(x)])) : v);
const ok = (body) => ({ state: "ok", data: escDeep(body) });
const clone = (v) => JSON.parse(JSON.stringify(v));

check("fold exports foldOrg and receiptsLine, and the manifest reads /api/org (vacuous-pass guard)",
  typeof F.foldOrg === "function" && typeof F.receiptsLine === "function" && manifest.routes.includes("/api/org"), JSON.stringify(manifest.routes));

const tmp = mkdtempSync(join(tmpdir(), "face-org-fold-"));
try {
  const spine = join(tmp, "spine");
  const fx = spawnSync(process.execPath, [join(REPO, "tests/org/spine-fixture.mjs"), spine, "full"], { encoding: "utf8", timeout: 60000 });
  check("fixture: the full org spine was written", fx.status === 0 && /^spine-fixture: [1-9]/.test(fx.stdout), `${fx.status} ${fx.stdout}${fx.stderr}`);
  const body = await R.servedOrg(REPO, spine);
  check("fixture: the real body carries a chart and scored seats", body.chart.counts.roles >= 50 && body.scorecards.rows.some((r) => r.evidence), String(body.chart.counts.roles));

  // ---- roles ----
  {
    const o = F.foldOrg(ok(body));
    const cards = body.chart.departments.reduce((n, d) => n + d.roles.length, 0);
    check("roles: one role row per card, in the served departments", o.roleCount === cards && o.departments.length === body.chart.departments.length && !o.isRefused, `${o.roleCount} vs ${cards}`);
    const nums = o.countsLine.split(" · ").map((s) => Number(s.replace(/,/g, "").split(" ")[0]));
    check("roles: the counts line names every seat class, and the classes sum to the row count", nums.length === 6 && nums[0] === cards && nums.slice(1).reduce((a, b) => a + b, 0) === cards && o.notes.length === 0, o.countsLine);
    const bad = clone(body);
    bad.chart.counts.roles += 1;
    check("roles: a chart whose count disagrees with its rows is SHOWN as a note, never smoothed over", F.foldOrg(ok(bad)).notes.some((n) => n.includes("should be one number")));
    const amp = clone(body);
    amp.chart.departments[0].roles[0].title = "R&D <lead>";
    check("roles: the door's escaping is undone once, so a title reads as written", F.foldOrg(ok(amp)).departments[0].roles[0].title === "R&D <lead>", F.foldOrg(ok(amp)).departments[0].roles[0].title);
  }

  // ---- scores ----
  {
    const o = F.foldOrg(ok(body));
    const staffed = body.scorecards.rows.filter((r) => r.staffed);
    check("scores: the scorecard rows are exactly the producer's staffed rows, each with one verdict",
      o.scores.rows.length === staffed.length && o.scores.rows.every((r, i) => r.role === staffed[i].role && r.isVerdict && ["KEEP", "PROMOTE", "RETRAIN", "RETIRE"].includes(r.verdict)),
      `${o.scores.rows.length} vs ${staffed.length}`);
    const quiet = o.scores.rows.filter((r, i) => staffed[i].evidence !== true);
    check("scores: a seat with no receipts reads `no evidence` -- never 0 and never a rate",
      quiet.length > 0 && quiet.every((r) => r.line === "no evidence" && !/\d|%/.test(r.line)), String(quiet.length));
    check("scores: a seat with receipts carries its counts, and cost with no cost receipt reads no evidence",
      o.scores.rows.some((r) => r.line.startsWith("receipts ") && r.line.endsWith("cost no evidence")), o.scores.rows.map((r) => r.line).join(" | ").slice(0, 200));
    check("scores: other seats holding receipts are listed without a verdict", o.scores.others.every((r) => !r.isVerdict) && o.scores.hasOthers === o.scores.others.length > 0
      && o.scores.others.length === body.scorecards.rows.filter((r) => !r.staffed && r.evidence).length);
    check("scores: the footnote names the receipts read and how many no role holds", o.scores.hasFootnote && o.scores.footnote.includes("receipts read") && o.scores.footnote.includes("placed on no role"), o.scores.footnote);
    const refused = clone(body);
    refused.scorecards = { state: "refused", code: "SPINE_UNAVAILABLE", human: "the door has no spine with an events/ directory to score from", rows: [] };
    const r = F.foldOrg(ok(refused));
    check("scores: a refused scorecards part renders the refusal and no seat at all -- never a room of `no evidence`",
      r.scores.isRefused && r.scores.refusal.code === "SPINE_UNAVAILABLE" && r.scores.rows.length === 0 && r.scores.others.length === 0 && r.roleCount > 0, JSON.stringify(r.scores.refusal));
  }

  // ---- teams ----
  {
    const o = F.foldOrg(ok(body));
    check("teams: with no team the room says why, naming ADR-1612", body.teams.state === "none" ? o.teams.isEmpty && o.teams.empty.includes("ADR-1612") && o.teams.rows.length === 0 : !o.teams.isEmpty, o.teams.empty);
    const one = clone(body);
    one.teams = { state: "ok", why: "", rows: [{ venture: "nilluvai", valid: true, findings: [], stage: "discover", seats: [{ id: "chief-of-staff", holder: "human:ashiq" }, { id: "qa-tester", holder: "card" }] }] };
    const t = F.foldOrg(ok(one)).teams;
    check("teams: a team lists its seats by id with its stage and check status",
      !t.isEmpty && t.rows.length === 1 && t.rows[0].venture === "nilluvai" && t.rows[0].seats === "chief-of-staff, qa-tester" && t.rows[0].status === "checks clean", JSON.stringify(t.rows[0]));
  }

  // ---- whole ----
  {
    const two = clone(body);
    two.schema = 2;
    const o = F.foldOrg(ok(two));
    check("whole: a body of another schema is refused whole -- no role, no score drawn", o.isRefused && o.refusal.code === "SOURCE_INVALID" && o.roleCount === 0 && o.scores.rows.length === 0);
    check("whole: while the door is reading, the section says so and draws nothing", F.foldOrg({ state: "loading" }).isReading && F.foldOrg({ state: "loading" }).roleCount === 0);
    const room = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8")).rooms.find((x) => x.id === "org");
    const ctx = { room, rooms: [room], mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: {}, laneMap: undefined, picks: {}, manifest };
    const first = F.fold({}, ctx);
    const planned = reg.plannedReads(first, manifest).reads.map((x) => x.route);
    check("whole: the room plans /api/org beside /api/board, and its roster half is untouched", planned.includes("/api/org") && planned.includes("/api/board") && Array.isArray(first.roster) && first.org.isReading, planned.join(","));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed ? 1 : 0;

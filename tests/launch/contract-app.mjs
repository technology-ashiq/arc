// Contract arms for backend and orm, on the steel thread: hosting holds, release lifts, frontend lands the shell, then
// backend adds the /api/health contract and orm the typed schema. The REAL adapters under the REAL ctx; only the
// transport is the in-memory GitHub + Vercel + live domain. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-app.mjs <scenario>
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";
import { makeVercel } from "./fakes/vercel.mjs";
import { makeLive } from "./fakes/live.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const rows = loadRegistry();
const load = async (id) => { const row = rows.find((r) => r.id === id); if (!row) { console.error(`no ${id} row`); process.exit(1); } return { row, mod: await import(pathToFileURL(join(PRODUCT, row.adapter)).href) }; };
const A = { hosting: await load("vercel"), release: await load("arc-ship-release"), frontend: await load("nextjs-shell"), backend: await load("next-route-handlers"), orm: await load("drizzle") };
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const FULL = "technology-ashiq/arc-sandbox";
const DOMAIN = "sandbox.automemory.ai";
const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }], runConclusions: scenario === "red-ci" ? ["success", "failure", "success"] : null });
const vercel = makeVercel({ github });
const live = makeLive({ github, full: FULL, domain: DOMAIN, inner: vercel.fetch, healthBody: scenario === "bad-health" ? { ok: true, service: "venture", version: "0.1.0", debug: "x" } : null });
globalThis.fetch = live.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-app-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const state = { hosting: [], release: [], frontend: [], backend: [], orm: [], repo: [{ kind: "github-repo", id: FULL }],
  database: scenario === "no-probe" ? [{ kind: "supabase-project", id: "fixtureref0000000001" }] : [{ kind: "supabase-project", id: "fixtureref0000000001" }, { kind: "db-probe-table", id: "fixtureref0000000001:public.launch_probe" }] };
const ENV = { VERCEL_TOKEN: "vercel_fixture_token_0123456789", GITHUB_TOKEN: "gho_fixtureToken0123456789" };
const UP = { hosting: ["repo"], release: ["hosting"], frontend: ["repo", "release"], backend: ["frontend"], orm: ["database", "frontend"] };
const ctxFor = (slot, approvals = []) => makeCtx({
  profile: { slug: "arc-sandbox", brand: { name: "arc sandbox", domain: DOMAIN } }, board: {}, slot: { id: slot }, row: A[slot].row,
  root: ROOT, resources: state[slot], upstream: Object.fromEntries(UP[slot].map((d) => [d, state[d]])), tag: `arc-sandbox@${slot}@${A[slot].row.id}`,
  attempt: 1, signal: undefined, env: ENV, approvals,
  report: (r) => { if (!state[slot].some((x) => x.kind === r.kind && x.id === r.id)) state[slot].push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);

await A.hosting.mod.scaffold(ctxFor("hosting"));
await A.release.mod.scaffold(ctxFor("release", ["deploy-prod-first"]));
await A.frontend.mod.scaffold(ctxFor("frontend"));
const out = { scenario };
switch (scenario) {
  case "thread":
    out.pkg = JSON.parse(Buffer.from(repo().files["package.json"].content, "base64").toString("utf8"));
    out.backend = await attempt(() => A.backend.mod.scaffold(ctxFor("backend")));
    out.backendAgain = await attempt(() => A.backend.mod.scaffold(ctxFor("backend")));
    out.backendVerify = await A.backend.mod.verify(ctxFor("backend"));
    out.orm = await attempt(() => A.orm.mod.scaffold(ctxFor("orm")));
    out.ormAgain = await attempt(() => A.orm.mod.scaffold(ctxFor("orm")));
    out.ormVerify = await A.orm.mod.verify(ctxFor("orm"));
    out.commits = { backend: repo().commits.filter((c) => /backend:/.test(c.message || "")).length, orm: repo().commits.filter((c) => /orm:/.test(c.message || "")).length };
    out.pkgUnchanged = Buffer.from(repo().files["package.json"].content, "base64").toString("utf8") === JSON.stringify(out.pkg, null, 2) + "\n";
    out.frontendAgain = await attempt(() => A.frontend.mod.scaffold(ctxFor("frontend")));
    out.kinds = { backend: state.backend.map((r) => r.kind), orm: state.orm.map((r) => r.kind) };
    break;
  case "owner-route":
    repo().files["app/api/health/route.js"] = { sha: "c".repeat(40), content: Buffer.from("mine\n").toString("base64") };
    repo().commits.push({ sha: "c".repeat(40), message: "owner route", files: { "app/api/health/route.js": "c".repeat(40) } });
    out.backend = await attempt(() => A.backend.mod.scaffold(ctxFor("backend")));
    break;
  case "bad-health":
    await A.backend.mod.scaffold(ctxFor("backend"));
    out.backendVerify = await A.backend.mod.verify(ctxFor("backend"));
    break;
  case "before-backend":
    out.backendVerify = await A.backend.mod.verify(ctxFor("backend"));
    break;
  case "red-ci":
    await A.orm.mod.scaffold(ctxFor("orm"));
    out.ormVerify = await A.orm.mod.verify(ctxFor("orm"));
    break;
  case "no-probe":
    out.orm = await attempt(() => A.orm.mod.scaffold(ctxFor("orm")));
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

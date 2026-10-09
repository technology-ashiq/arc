// Contract arms for the migration-rollback slot (ADR-1744): the REAL drizzle-down adapter under the REAL ctx against the
// in-memory GitHub, whose pushes run arc-ci. The committed rollback test itself is run here too, over the committed
// migrations, so the fixture launch ships is proven to pass on its own files and to fail on a broken down.
// Prints `RAN <scenario>` first, `DONE <json>` last.
//   node tests/launch/contract-rollback.mjs <scenario>
import { join } from "node:path";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "drizzle-down");
if (!row) { console.error("no drizzle-down row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }],
  runConclusions: scenario === "red-ci" ? ["success", "failure", "success"] : null });
globalThis.fetch = github.fetch;
const ROOT = mkdtempSync(join(tmpdir(), "launch-rollback-"));
const VENTURE = mkdtempSync(join(tmpdir(), "launch-rollback-venture-"));
process.on("exit", () => { rmSync(ROOT, { recursive: true, force: true }); rmSync(VENTURE, { recursive: true, force: true }); });
const state = [];
const UP = { orm: [{ kind: "orm-schema", id: `${FULL}:${"b".repeat(40)}` }], ci: [{ kind: "github-workflow", id: `${FULL}:.github/workflows/arc-ci.yml` }] };
const ctxNow = ({ upstream = UP } = {}) => makeCtx({
  profile: { slug: "arc-sandbox", region: "in", brand: { name: "arc sandbox", domain: "sandbox.automemory.ai" } }, board: {}, slot: { id: "migration-rollback" }, row,
  root: ROOT, resources: state, upstream, tag: "arc-sandbox@migration-rollback@drizzle-down", attempt: 1, signal: undefined, env: { GITHUB_TOKEN: "gho_fixtureToken0123456789" },
  report: (r) => { if (!state.some((x) => x.kind === r.kind && x.id === r.id)) state.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);
const text = (p) => (repo().files[p] ? Buffer.from(repo().files[p].content, "base64").toString("utf8") : null);
const commits = () => repo().commits.filter((c) => (c.message || "").startsWith("migration-rollback:")).length;
// The committed test, run by node --test over the committed migrations (with `down` swapped in when given).
const runFixture = (down) => {
  mkdirSync(join(VENTURE, "db", "migrations"), { recursive: true });
  for (const p of ["db/rollback.test.js", "db/migrations/0001_launch_probe.sql", "db/migrations/0001_launch_probe.down.sql"]) writeFileSync(join(VENTURE, p), text(p));
  if (down !== undefined) writeFileSync(join(VENTURE, "db/migrations/0001_launch_probe.down.sql"), down);
  const r = spawnSync(process.execPath, ["--test", join(VENTURE, "db", "rollback.test.js")], { encoding: "utf8", timeout: 60000 });
  const pass = Number(((r.stdout || "").match(/^# pass (\d+)/m) || [])[1] || 0);
  return { status: r.status, pass };
};

const out = { scenario };
switch (scenario) {
  case "thread":
    out.verifyBefore = (await adapter.verify(ctxNow())).ok;
    out.first = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.commits = commits();
    out.kinds = state.map((r) => r.kind);
    out.verify = await adapter.verify(ctxNow());
    out.fixture = runFixture();
    out.brokenDown = runFixture("-- down that forgot the drop\n");
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    break;
  case "red-ci":
    await adapter.scaffold(ctxNow());
    out.verify = await adapter.verify(ctxNow());
    break;
  case "no-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ upstream: { orm: [] } })));
    out.calls = github.calls.length;
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

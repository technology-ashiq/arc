// Contract arms for the dependency-scan slot (ADR-1743): the REAL arc-scan-dependabot adapter under the REAL ctx against
// the in-memory GitHub, whose pushes run every workflow main holds. Prints `RAN <scenario>` first, `DONE <json>` last.
//   node tests/launch/contract-depscan.mjs <scenario>
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "arc-scan-dependabot");
if (!row) { console.error("no arc-scan-dependabot row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }],
  auditConclusion: scenario === "audit-red" ? "failure" : "success" });
globalThis.fetch = github.fetch;
const ROOT = mkdtempSync(join(tmpdir(), "launch-depscan-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const state = [];
const UP = { ci: [{ kind: "github-workflow", id: `${FULL}:.github/workflows/arc-ci.yml` }, { kind: "protection-absent", id: `${FULL}@main` }] };
const ctxNow = ({ upstream = UP } = {}) => makeCtx({
  profile: { slug: "arc-sandbox", region: "in", brand: { name: "arc sandbox", domain: "sandbox.automemory.ai" } }, board: {}, slot: { id: "dependency-scan" }, row,
  root: ROOT, resources: state, upstream, tag: "arc-sandbox@dependency-scan@arc-scan-dependabot", attempt: 1, signal: undefined, env: { GITHUB_TOKEN: "gho_fixtureToken0123456789" },
  report: (r) => { if (!state.some((x) => x.kind === r.kind && x.id === r.id)) state.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);
const text = (p) => (repo().files[p] ? Buffer.from(repo().files[p].content, "base64").toString("utf8") : null);
const commits = () => repo().commits.filter((c) => (c.message || "").startsWith("dependency-scan:")).length;

const out = { scenario };
switch (scenario) {
  case "thread":
    out.verifyBefore = (await adapter.verify(ctxNow())).ok;
    out.first = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.commits = commits();
    out.kinds = state.map((r) => r.kind);
    out.workflow = text(".github/workflows/dependency-scan.yml");
    out.ciUntouched = text(".github/workflows/arc-ci.yml") === null;
    out.verify = await adapter.verify(ctxNow());
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    break;
  case "audit-red":
    await adapter.scaffold(ctxNow());
    out.verify = await adapter.verify(ctxNow());
    break;
  case "owner-edits": {
    // The owner rewrites the workflow after launch: verify is not ok, because a green run of their file is not the gate.
    await adapter.scaffold(ctxNow());
    const path = ".github/workflows/dependency-scan.yml";
    repo().files[path] = { sha: "d".repeat(40), content: Buffer.from("name: mine\n").toString("base64") };
    repo().commits.push({ sha: "d".repeat(40), message: "owner workflow", files: { [path]: "d".repeat(40) } });
    out.verify = await adapter.verify(ctxNow());
    break;
  }
  case "no-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ upstream: { ci: [] } })));
    out.calls = github.calls.length;
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

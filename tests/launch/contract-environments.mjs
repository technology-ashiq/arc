// Contract arm for the environments slot: the REAL vercel-environments adapter under the REAL ctx, only the transport
// swapped for the in-memory Vercel wired to the in-memory GitHub. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-environments.mjs <scenario>
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";
import { makeVercel } from "./fakes/vercel.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "vercel-environments");
if (!row) { console.error("no vercel-environments row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const FULL = "technology-ashiq/arc-sandbox";
const TAG = "arc-sandbox@environments@vercel-environments";
const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }] });
const project = { name: "arc-sandbox", id: "prj_fixture01", link: { type: "github", org: "technology-ashiq", repo: "arc-sandbox" }, previewDeploymentsDisabled: scenario === "previews-off" };
const vercel = makeVercel({ github, projects: [project], previewState: scenario === "preview-error" ? "ERROR" : "READY" });
globalThis.fetch = vercel.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-env-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctxFor = ({ upstream = { hosting: [{ kind: "vercel-project", id: "prj_fixture01" }] } } = {}) => makeCtx({
  profile: { slug: "arc-sandbox" }, board: {}, slot: { id: "environments" }, row,
  root: ROOT, resources: reported, upstream, tag: TAG, attempt: 1, signal: undefined,
  env: { VERCEL_TOKEN: "vercel_fixture_token_0123456789", GITHUB_TOKEN: "gho_fixtureToken0123456789" },
  report: (r) => { if (!reported.some((x) => x.kind === r.kind && x.id === r.id)) reported.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);

const out = { scenario };
switch (scenario) {
  case "twice":
    out.first = (await attempt(() => adapter.scaffold(ctxFor()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxFor()))).ok;
    out.prs = repo().pulls.length;
    out.branchCommits = (repo().branches["arc/preview-check"] || []).length;
    out.mainCommits = repo().commits.length;
    out.reported = reported.map((r) => `${r.kind} ${r.id}`);
    out.verify = await adapter.verify(ctxFor());
    out.teardown = (await adapter.teardown(ctxFor())).steps.map((s) => s.action);
    break;
  case "foreign-branch":
    repo().branches = { "arc/preview-check": [repo().commits[0], { sha: "b".repeat(40), message: "owner work", files: {} }] };
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.prs = (repo().pulls || []).length;
    break;
  case "previews-off":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    break;
  case "preview-error":
    await adapter.scaffold(ctxFor());
    out.verify = await adapter.verify(ctxFor());
    break;
  case "verify-before":
    out.verify = await adapter.verify(ctxFor());
    break;
  case "bad-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ upstream: { hosting: [{ kind: "vercel-project", id: "../x" }] } })));
    out.calls = vercel.calls.length;
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

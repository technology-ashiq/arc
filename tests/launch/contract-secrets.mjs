// Contract arm for the secrets slot: the REAL vercel-env-store adapter under the REAL ctx, only the transport swapped
// for the in-memory Vercel wired to the in-memory GitHub. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-secrets.mjs <scenario>
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
const row = loadRegistry().find((r) => r.id === "vercel-env-store");
if (!row) { console.error("no vercel-env-store row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const MARKER = "fixture-env-value-never-printed-0001";
const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }] });
const envs = {
  placed: [{ key: "DATABASE_URL", target: ["production", "preview"], value: MARKER }],
  "preview-only": [{ key: "DATABASE_URL", target: ["preview"], value: MARKER }],
}[scenario] || [];
const vercel = makeVercel({ github, projects: [{ name: "arc-sandbox", id: "prj_fixture01", link: { type: "github", org: "technology-ashiq", repo: "arc-sandbox" }, envs }] });
globalThis.fetch = vercel.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-secrets-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctx = makeCtx({
  profile: { slug: "arc-sandbox" }, board: {}, slot: { id: "secrets" }, row,
  root: ROOT, resources: reported, upstream: { hosting: [{ kind: "vercel-project", id: "prj_fixture01" }] }, tag: "arc-sandbox@secrets@vercel-env-store", attempt: 1, signal: undefined,
  env: { VERCEL_TOKEN: "vercel_fixture_token_0123456789", GITHUB_TOKEN: "gho_fixtureToken0123456789" },
  report: (r) => { if (!reported.some((x) => x.kind === r.kind && x.id === r.id)) reported.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);
const put = (path, text) => {
  repo().files[path] = { sha: "c".repeat(40), content: Buffer.from(text).toString("base64") };
  repo().commits.push({ sha: "c".repeat(40), message: "owner", files: { [path]: "c".repeat(40) } });
};

const out = { scenario };
switch (scenario) {
  case "fresh":
    out.first = (await attempt(() => adapter.scaffold(ctx))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctx))).ok;
    out.commits = repo().commits.filter((c) => c.files && c.files[".env.example"]).length;
    out.kinds = reported.map((r) => r.kind);
    out.verify = await adapter.verify(ctx);
    out.teardown = (await adapter.teardown(ctx)).steps.map((s) => s.action);
    break;
  case "missing":
  case "placed":
  case "preview-only":
    put(".env.example", "# keys\nDATABASE_URL=\n");
    out.scaffold = await attempt(() => adapter.scaffold(ctx));
    out.kinds = reported.map((r) => r.kind);
    out.verify = await adapter.verify(ctx);
    break;
  case "leaked":
    put(".env.example", "DATABASE_URL=\n");
    repo().extraPaths = ["apps/web/.env.local", ".env.sample"];
    out.verify = await adapter.verify(ctx);
    break;
  case "value-in-template":
    put(".env.example", "DATABASE_URL=has-a-value-here\n");
    out.scaffold = await attempt(() => adapter.scaffold(ctx));
    break;
  case "bad-line":
    put(".env.example", "export DATABASE_URL\n");
    out.verify = await adapter.verify(ctx);
    break;
  case "truncated":
    put(".env.example", "\n");
    repo().truncated = true;
    out.verify = await adapter.verify(ctx);
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
out.decryptAsked = vercel.decryptAsked;
out.valueSeen = JSON.stringify(out).includes(MARKER);
console.log(`DONE ${JSON.stringify(out)}`);

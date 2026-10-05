// Contract arm for the repo slot: the REAL github adapter under the REAL ctx, only the transport swapped for the
// in-memory GitHub. The row comes from the real registry. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-repo.mjs <scenario>
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "github");
if (!row) { console.error("no github row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const TAG = "arc-sandbox@repo@github";
const FULL = "technology-ashiq/arc-sandbox";
const TOKEN = "gho_fixtureToken0123456789";
const ghOpts = {
  foreign: { repos: [{ name: "arc-sandbox", description: "someone's project", private: true, commits: [{ sha: "a".repeat(40) }] }] },
  public: { repos: [{ name: "arc-sandbox", description: `x [arc-launch ${TAG}]`, private: false, commits: [{ sha: "a".repeat(40) }] }] },
}[scenario] || {};
const gh = makeGithub(ghOpts);
globalThis.fetch = gh.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-repo-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctxFor = ({ token = TOKEN, slug = "arc-sandbox" } = {}) => makeCtx({
  profile: { slug, brand: { name: "arc sandbox", domain: "sandbox.automemory.ai" } }, board: {}, slot: { id: "repo" }, row,
  root: ROOT, resources: reported, upstream: {}, tag: TAG, attempt: 1, signal: undefined,
  env: { GITHUB_TOKEN: token }, report: (r) => { if (!reported.some((x) => x.id === r.id)) reported.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };

const out = { scenario };
switch (scenario) {
  case "twice":
    out.first = (await attempt(() => adapter.scaffold(ctxFor()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxFor()))).ok;
    out.creates = gh.calls.filter((c) => c === "POST /user/repos").length;
    out.repo = gh.store.has(FULL) ? { private: gh.store.get(FULL).private, tagged: gh.store.get(FULL).description.includes(`[arc-launch ${TAG}]`) } : null;
    out.reported = reported.map((r) => `${r.kind} ${r.id}`);
    out.verify = await adapter.verify(ctxFor());
    out.teardown = await adapter.teardown(ctxFor());
    break;
  case "foreign":
  case "public":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.creates = gh.calls.filter((c) => c === "POST /user/repos").length;
    break;
  case "bad-slug":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ slug: "../evil" })));
    out.calls = gh.calls.length;
    break;
  case "bad-token":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ token: "gho_shapedButWrong0123456789" })));
    break;
  case "verify-missing":
    out.verify = await adapter.verify(ctxFor());
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

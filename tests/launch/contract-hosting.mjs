// Contract arm for the hosting slot: the REAL vercel adapter under the REAL ctx, only the transport swapped for the
// in-memory Vercel wired to the in-memory GitHub. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-hosting.mjs <scenario>
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
const row = loadRegistry().find((r) => r.id === "vercel");
if (!row) { console.error("no vercel row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const TAG = "arc-sandbox@hosting@vercel";
const DOMAIN = "sandbox.automemory.ai";
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const seed = { name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] };
const github = makeGithub({ repos: [seed] });
const vOpts = {
  "foreign-project": { projects: [{ name: "arc-sandbox", link: { type: "github", org: "someone", repo: "other" } }] },
  "no-cname": { cname: null },
  "evil-cname": { cname: "evil.example/x" },
}[scenario] || {};
const vercel = makeVercel({ github, ...vOpts });
globalThis.fetch = vercel.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-hosting-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctxFor = ({ upstream = { repo: [{ kind: "github-repo", id: FULL }] }, env = {} } = {}) => makeCtx({
  profile: { slug: "arc-sandbox", brand: { domain: DOMAIN } }, board: {}, slot: { id: "hosting" }, row,
  root: ROOT, resources: reported, upstream, tag: TAG, attempt: 1, signal: undefined,
  env: { VERCEL_TOKEN: "vercel_fixture_token_0123456789", GITHUB_TOKEN: "gho_fixtureToken0123456789", ...env },
  report: (r) => { if (!reported.some((x) => x.kind === r.kind && x.id === r.id)) reported.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => github.store.get(FULL);
const holdText = () => (repo().files["vercel.json"] ? Buffer.from(repo().files["vercel.json"].content, "base64").toString("utf8") : null);

const out = { scenario };
switch (scenario) {
  case "twice": {
    out.first = (await attempt(() => adapter.scaffold(ctxFor()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxFor()))).ok;
    out.projects = vercel.store.size;
    out.creates = vercel.calls.filter((c) => c === "POST /v11/projects").length;
    out.domainPosts = vercel.calls.filter((c) => /^POST \/v10\/projects\/.+\/domains$/.test(c)).length;
    out.holdCommits = repo().commits.filter((c) => c.files && c.files["vercel.json"]).length;
    out.hold = JSON.parse(holdText());
    out.reported = reported.map((r) => `${r.kind} ${r.id}`);
    out.verify = await adapter.verify(ctxFor());
    out.teardown = (await adapter.teardown(ctxFor())).steps.map((s) => s.action);
    break;
  }
  case "foreign-project":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.holdCommits = repo().commits.filter((c) => c.files && c.files["vercel.json"]).length;
    break;
  case "foreign-file":
    repo().files["vercel.json"] = { sha: "f".repeat(40), content: Buffer.from("{}\n").toString("base64") };
    repo().commits.push({ sha: "f".repeat(40), message: "owner config", files: { "vercel.json": "f".repeat(40) } });
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.hold = holdText();
    break;
  case "released": {
    // release lifted the hold in a tagged commit; a re-run of hosting must not hold production again.
    await adapter.scaffold(ctxFor());
    repo().files["vercel.json"] = { sha: "d".repeat(40), content: Buffer.from("{}\n").toString("base64") };
    repo().commits.push({ sha: "d".repeat(40), message: "release: lift the hold\n\nArc-Launch-Tag: arc-sandbox@release@arc-ship-release", files: { "vercel.json": "d".repeat(40) } });
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.hold = holdText();
    break;
  }
  case "no-cname":
  case "evil-cname":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.targets = reported.filter((r) => r.kind === "dns-target").length;
    break;
  case "verify-before":
    out.verify = await adapter.verify(ctxFor());
    break;
  case "verify-refusals":
    out.badToken = await attempt(() => adapter.verify(ctxFor({ env: { VERCEL_TOKEN: "x" } })));
    out.noUpstream = await attempt(() => adapter.verify(ctxFor({ upstream: {} })));
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

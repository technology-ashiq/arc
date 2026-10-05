// Contract arm for the ci slot: the REAL github-actions adapter under the REAL ctx, only the transport swapped for
// the in-memory GitHub. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-ci.mjs <scenario>
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeGithub } from "./fakes/github.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "github-actions");
if (!row) { console.error("no github-actions row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const FULL = "technology-ashiq/arc-sandbox";
const TAG = "arc-sandbox@ci@github-actions";
const TOKEN = "gho_fixtureToken0123456789";
const WF = ".github/workflows/arc-ci.yml";
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const ghOpts = {
  "red-leg": { runConclusions: ["success", "failure", "success"] },
  "plan-limit": { planLimit: true },
}[scenario] || {};
const gh = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40) }] }], ...ghOpts });
globalThis.fetch = gh.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-ci-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctxFor = ({ upstream = { repo: [{ kind: "github-repo", id: FULL }] } } = {}) => makeCtx({
  profile: { slug: "arc-sandbox" }, board: {}, slot: { id: "ci" }, row,
  root: ROOT, resources: reported, upstream, tag: TAG, attempt: 1, signal: undefined,
  env: { GITHUB_TOKEN: TOKEN }, report: (r) => { if (!reported.some((x) => x.id === r.id)) reported.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const repo = () => gh.store.get(FULL);

const out = { scenario };
switch (scenario) {
  case "twice":
    out.first = (await attempt(() => adapter.scaffold(ctxFor()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxFor()))).ok;
    out.workflowCommits = repo().commits.filter((c) => c.files && c.files[WF]).length;
    out.tagged = repo().commits.filter((c) => c.files && c.files[WF]).every((c) => c.message.includes(`Arc-Launch-Tag: ${TAG}`));
    out.contexts = repo().protection && repo().protection.contexts;
    out.local = existsSync(join(ROOT, WF)) && readFileSync(join(ROOT, WF), "utf8") === Buffer.from(repo().files[WF].content, "base64").toString("utf8");
    out.reported = reported.map((r) => r.kind);
    out.verify = await adapter.verify(ctxFor());
    break;
  case "owner-edited": {
    await adapter.scaffold(ctxFor());
    repo().files[WF] = { sha: "e".repeat(40), content: Buffer.from("name: hand-edited\n").toString("base64") };
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.restored = Buffer.from(repo().files[WF].content, "base64").toString("utf8").startsWith("# Written by arc launch");
    break;
  }
  case "red-leg":
    await adapter.scaffold(ctxFor());
    out.verify = await adapter.verify(ctxFor());
    break;
  case "unprotected":
    await adapter.scaffold(ctxFor());
    repo().protection = null;
    out.verify = await adapter.verify(ctxFor());
    break;
  case "plan-limit":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    break;
  case "bad-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ upstream: { repo: [{ kind: "github-repo", id: "../../evil" }] } })));
    out.calls = gh.calls.length;
    break;
  case "no-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ upstream: {} })));
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

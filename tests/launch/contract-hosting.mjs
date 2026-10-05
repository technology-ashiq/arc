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
  adopted: { projects: [{ name: "arc-sandbox", link: { type: "github", org: "technology-ashiq", repo: "arc-sandbox" }, domains: ["sandbox.automemory.ai"] }] },
  unlinked: { projects: [{ name: "arc-sandbox", link: null }] },
  "verify-500": { failDeployments: true },
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
  case "adopted":
    // The owner made the project and attached the domain: launch records both as found and tears neither down.
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.kinds = reported.map((r) => r.kind);
    out.teardown = (await adapter.teardown(ctxFor())).steps.map((s) => s.action);
    break;
  case "unlinked":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    break;
  case "deleted-hold": {
    // The hold was lifted by deleting the file: a re-run never holds production again.
    await adapter.scaffold(ctxFor());
    delete repo().files["vercel.json"];
    repo().commits.push({ sha: "e".repeat(40), message: "release: lift the hold\n\nArc-Launch-Tag: arc-sandbox@release@arc-ship-release", files: { "vercel.json": null } });
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.hold = holdText();
    break;
  }
  case "forged-trailer":
    // The owner's own vercel.json, committed with a message that quotes a release trailer as a prefix.
    repo().files["vercel.json"] = { sha: "f".repeat(40), content: Buffer.from("{}\n").toString("base64") };
    repo().commits.push({ sha: "f".repeat(40), message: "notes\n\nArc-Launch-Tag: arc-sandbox@release@arc-ship-release-copy", files: { "vercel.json": "f".repeat(40) } });
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    break;
  case "owner-edit-after-release": {
    await adapter.scaffold(ctxFor());
    repo().files["vercel.json"] = { sha: "d".repeat(40), content: Buffer.from("{}\n").toString("base64") };
    repo().commits.push({ sha: "d".repeat(40), message: "release\n\nArc-Launch-Tag: arc-sandbox@release@arc-ship-release", files: { "vercel.json": "d".repeat(40) } });
    repo().files["vercel.json"] = { sha: "9".repeat(40), content: Buffer.from("{\"env\":{}}\n").toString("base64") };
    repo().commits.push({ sha: "9".repeat(40), message: "owner: add env", files: { "vercel.json": "9".repeat(40) } });
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.hold = holdText();
    break;
  }
  case "preview-only":
    // A git deployment exists, but not of the hold commit: the project was linked, the hold never landed.
    await adapter.scaffold(ctxFor());
    repo().commits = repo().commits.filter((c) => !(c.files && c.files["vercel.json"]));
    repo().commits.push({ sha: "7".repeat(40), message: "feature", files: {} });
    out.verify = await adapter.verify(ctxFor());
    break;
  case "aged-hold":
    // 150 pushes after the hold: its deployment is far past any page window, and still the proof.
    await adapter.scaffold(ctxFor());
    for (let i = 0; i < 150; i++) repo().commits.push({ sha: (1000 + i).toString(16).padStart(40, "0"), message: `push ${i}`, files: {} });
    out.verify = await adapter.verify(ctxFor());
    break;
  case "verify-500":
    await adapter.scaffold(ctxFor());
    out.verify = await attempt(() => adapter.verify(ctxFor()));
    break;
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

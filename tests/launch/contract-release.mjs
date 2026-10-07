// Contract arms for release and frontend, run as one steel thread: hosting places the hold, release lifts it after
// gate 2, frontend commits the shell and proves the live page. The REAL adapters under the REAL ctx; only the transport
// is the in-memory GitHub + Vercel + live domain + PageSpeed. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-release.mjs <scenario>
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
const hosting = await load("vercel");
const release = await load("arc-ship-release");
const frontend = await load("nextjs-shell");
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const FULL = "technology-ashiq/arc-sandbox";
const DOMAIN = "sandbox.automemory.ai";
const github = makeGithub({ repos: [{ name: "arc-sandbox", description: "x", commits: [{ sha: "a".repeat(40), message: "Initial commit", files: {} }] }] });
const vercel = makeVercel({ github });
const liveOpts = {
  "low-score": { scores: { performance: 71, accessibility: 100, "best-practices": 100, seo: 100 } },
  quota: { pagespeed: 429 },
}[scenario] || {};
const live = makeLive({ github, full: FULL, domain: DOMAIN, inner: vercel.fetch, ...liveOpts });
globalThis.fetch = live.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-release-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const state = { hosting: [], release: [], frontend: [], repo: [{ kind: "github-repo", id: FULL }] };
const ENV = { VERCEL_TOKEN: "vercel_fixture_token_0123456789", GITHUB_TOKEN: "gho_fixtureToken0123456789" };
// A fresh ctx per call, as the runner builds one per attempt; `approvals` stands in for the owner's gate-2 decision.
const ctxFor = (slot, { row, upstream, approvals = [] }) => makeCtx({
  profile: { slug: "arc-sandbox", brand: { name: "arc sandbox", domain: DOMAIN } }, board: {}, slot: { id: slot }, row,
  root: ROOT, resources: state[slot], upstream, tag: `arc-sandbox@${slot}@${row.id}`, attempt: 1, signal: undefined, env: ENV, approvals,
  report: (r) => { if (!state[slot].some((x) => x.kind === r.kind && x.id === r.id)) state[slot].push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const H = () => ctxFor("hosting", { row: hosting.row, upstream: { repo: state.repo } });
const R = (approvals) => ctxFor("release", { row: release.row, upstream: { hosting: state.hosting }, approvals });
const F = () => ctxFor("frontend", { row: frontend.row, upstream: { repo: state.repo, release: state.release } });
const repo = () => github.store.get(FULL);
const holdText = () => Buffer.from(repo().files["vercel.json"].content, "base64").toString("utf8");

await hosting.mod.scaffold(H());
const out = { scenario };
switch (scenario) {
  case "unapproved":
    out.release = await attempt(() => release.mod.scaffold(R([])));
    out.hold = holdText();
    out.tags = Object.keys(repo().tags || {}).length;
    break;
  case "thread": {
    out.before = await frontend.mod.verify(F());
    out.release = await attempt(() => release.mod.scaffold(R(["deploy-prod-first"])));
    out.releaseAgain = await attempt(() => release.mod.scaffold(R(["deploy-prod-first"])));
    out.hold = holdText();
    out.tags = Object.keys(repo().tags || {});
    out.releaseVerify = await release.mod.verify(R(["deploy-prod-first"]));
    out.hostingAgain = await attempt(() => hosting.mod.scaffold(H()));
    out.holdAfterHosting = holdText();
    out.frontend = await attempt(() => frontend.mod.scaffold(F()));
    out.frontendAgain = await attempt(() => frontend.mod.scaffold(F()));
    out.shellCommits = repo().commits.filter((c) => c.files && c.files["package.json"]).length;
    out.frontendVerify = await frontend.mod.verify(F());
    out.releaseVerifyAfter = await release.mod.verify(R(["deploy-prod-first"]));
    out.kinds = { release: state.release.map((r) => r.kind), frontend: state.frontend.map((r) => r.kind) };
    break;
  }
  case "low-score":
  case "quota":
    await release.mod.scaffold(R(["deploy-prod-first"]));
    await frontend.mod.scaffold(F());
    out.frontendVerify = await frontend.mod.verify(F());
    break;
  case "owner-code":
    // The owner already wrote app/page.js: the shell is not committed over it.
    repo().files["app/page.js"] = { sha: "c".repeat(40), content: Buffer.from("mine\n").toString("base64") };
    repo().commits.push({ sha: "c".repeat(40), message: "owner page", files: { "app/page.js": "c".repeat(40) } });
    await release.mod.scaffold(R(["deploy-prod-first"]));
    out.frontend = await attempt(() => frontend.mod.scaffold(F()));
    out.page = Buffer.from(repo().files["app/page.js"].content, "base64").toString("utf8");
    break;
  case "owner-later-commits": {
    // attack b1844e0 B1: an owner commit after the shell, touching another file, is never reported as launch's own.
    // Then the owner re-commits app/page.js with the shell's exact bytes: identical content is not launch's (twin of
    // attack 3f04230 L3/L4), so the shell refuses rather than adopting it.
    await release.mod.scaffold(R(["deploy-prod-first"]));
    const first = await attempt(() => frontend.mod.scaffold(F()));
    out.firstId = first.ok ? first.value.resources[0].id : first.code;
    // Fixed shas no other commit in this file uses: "a" is the initial commit, so reusing it made the fake resolve the
    // owner's head to that commit and see no shell at all.
    repo().files["README.md"] = { sha: "7".repeat(40), content: Buffer.from("owner notes\n").toString("base64") };
    repo().commits.push({ sha: "7".repeat(40), message: "owner readme", files: { "README.md": "7".repeat(40) } });
    const again = await attempt(() => frontend.mod.scaffold(F()));
    out.againId = again.ok ? again.value.resources[0].id : again.code;
    out.headIsOwner = out.againId === `${FULL}:${"7".repeat(40)}`;
    const blob = repo().files["app/page.js"].sha;
    repo().commits.push({ sha: "8".repeat(40), message: "owner touches the page", files: { "app/page.js": blob } });
    out.adopted = await attempt(() => frontend.mod.scaffold(F()));
    break;
  }
  case "owner-rewrote-hold":
    // hosting placed the hold, then the owner rewrote vercel.json with their own config: release does not lift it.
    repo().files["vercel.json"] = { sha: "e".repeat(40), content: Buffer.from("{\"rewrites\":[]}\n").toString("base64") };
    repo().commits.push({ sha: "e".repeat(40), message: "owner rewrites", files: { "vercel.json": "e".repeat(40) } });
    out.release = await attempt(() => release.mod.scaffold(R(["deploy-prod-first"])));
    break;
  case "forged-hosting-trailer":
    // The owner's own vercel.json, committed with a message that types hosting's exact trailer: content decides.
    repo().files["vercel.json"] = { sha: "f".repeat(40), content: Buffer.from("{\"rewrites\":[]}\n").toString("base64") };
    repo().commits.push({ sha: "f".repeat(40), message: "mine\n\nArc-Launch-Tag: arc-sandbox@hosting@vercel", files: { "vercel.json": "f".repeat(40) } });
    out.release = await attempt(() => release.mod.scaffold(R(["deploy-prod-first"])));
    out.text = Buffer.from(repo().files["vercel.json"].content, "base64").toString("utf8").trim();
    break;
  case "broken-app":
    // The shell lands and its production build fails: release's receipt no longer counts the ERROR.
    await release.mod.scaffold(R(["deploy-prod-first"]));
    await frontend.mod.scaffold(F());
    repo().tags["launch-release-1"] = repo().commits[repo().commits.length - 1].sha;
    repo().commits[repo().commits.length - 1].message += `\n\nArc-Launch-Tag: arc-sandbox@release@arc-ship-release`;
    repo().commits[repo().commits.length - 1].app = false;
    out.releaseVerify = await release.mod.verify(R(["deploy-prod-first"]));
    break;
  case "foreign-hold":
    // A vercel.json hosting did not write: release refuses to lift it.
    repo().files["vercel.json"] = { sha: "d".repeat(40), content: Buffer.from("{\"x\":1}\n").toString("base64") };
    repo().commits.splice(1);
    repo().commits.push({ sha: "d".repeat(40), message: "owner config", files: { "vercel.json": "d".repeat(40) } });
    out.release = await attempt(() => release.mod.scaffold(R(["deploy-prod-first"])));
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

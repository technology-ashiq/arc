// Contract arm for the database slot: the REAL supabase adapter under the REAL ctx, only the transport swapped for the
// in-memory Supabase. A fresh ctx per call, as the runner builds one per attempt. Prints `RAN` first, `DONE` last.
//   node tests/launch/contract-database.mjs <scenario>
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeSupabase } from "./fakes/supabase.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "supabase");
if (!row) { console.error("no supabase row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const opts = {
  "two-orgs": { orgs: [{ id: "o1", name: "ashiq" }, { id: "o2", name: "acme" }] },
  "two-orgs-named": { orgs: [{ id: "o1", name: "ashiq" }, { id: "o2", name: "acme" }] },
  "two-orgs-named-by-name": { orgs: [{ id: "o1", name: "ashiq" }, { id: "o2", name: "acme" }] },
  "org-unknown": { orgs: [{ id: "o1", name: "ashiq" }, { id: "o2", name: "acme" }] },
  "bad-org": { orgs: [{ id: "o1", name: "ashiq" }, { id: "o2", name: "acme" }] },
  // The venture's org holds no project yet; a same-named project sits in the other org (ADR-1773).
  // A same-named project whose answer names no org: refused, never dropped into a duplicate create (attack 67c6e07 B1).
  "unscoped-project": { ...{ orgs: [{ id: "o1", name: "ashiq" }, { id: "o2", name: "acme" }] }, projects: [{ id: "ownerref000000000004", name: "arc-sandbox", organization_id: null }] },
  "name-case": { orgs: [{ id: "o1", name: "acme" }, { id: "o2", name: "ACME" }] },
  "null-org": { orgs: [{ id: "o1", name: "ashiq" }, { id: "o2", name: "acme" }] },
  "no-orgs": { orgs: [] },
  "many-orgs": { orgs: Array.from({ length: 22 }, (_, i) => ({ id: `org${String(i + 1).padStart(2, "0")}`, name: `team ${i + 1}` })) },
  "named-scopes-lookup": { ...{ orgs: [{ id: "o1", name: "ashiq" }, { id: "o2", name: "acme" }] }, projects: [{ id: "ownerref000000000003", name: "arc-sandbox", organization_id: "o1" }] },
  found: { projects: [{ id: "ownerref000000000001", name: "arc-sandbox" }] },
  "rls-off": { rlsOff: true },
  policy: { policy: true },
  paused: { projects: [{ id: "ownerref000000000002", name: "arc-sandbox", status: "INACTIVE" }] },
  "object-shape": { queryShape: "object" },
  "policy-recorded": { policy: true },
  "slow-start": { becomeHealthy: 99 },
}[scenario] || {};
const sb = makeSupabase(opts);
globalThis.fetch = sb.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-db-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctxNow = ({ region = "in", org } = {}) => makeCtx({
  profile: { slug: "arc-sandbox", region, ...(org === undefined ? {} : { supabase_org: org }) }, board: {}, slot: { id: "database" }, row,
  root: ROOT, resources: reported, upstream: {}, tag: "arc-sandbox@database@supabase", attempt: 1, signal: undefined,
  env: { SUPABASE_ACCESS_TOKEN: "sbp_fixture_token_0123456789abcd" },
  report: (r) => { if (!reported.some((x) => x.kind === r.kind && x.id === r.id)) reported.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };

const out = { scenario };
switch (scenario) {
  case "fresh":
    out.first = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.projects = sb.store.length;
    out.region = sb.store[0] && sb.store[0].region;
    out.kinds = reported.map((r) => r.kind);
    out.verify = await adapter.verify(ctxNow());
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    // The generated password went to Supabase in the create body and nowhere else.
    out.pass = sb.bodies.find((b) => b.db_pass);
    out.passLeaked = JSON.stringify({ reported, verify: out.verify, teardown: out.teardown }).includes(out.pass ? out.pass.db_pass : "#");
    out.passLen = out.pass ? out.pass.db_pass.length : 0;
    delete out.pass;
    break;
  case "two-orgs":
  case "paused":
  case "policy":
  case "object-shape":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.verify = await adapter.verify(ctxNow());
    break;
  case "found":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.kinds = reported.map((r) => r.kind);
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    break;
  case "rls-off":
    await adapter.scaffold(ctxNow());
    out.verify = await adapter.verify(ctxNow());
    break;
  case "owner-probe-table":
    // The owner's own project already holds a table named launch_probe: launch never touches it.
    sb.store.push({ id: "fixtureref0000000099", name: "arc-sandbox", status: "ACTIVE_HEALTHY", tables: { launch_probe: { rls: false, rows: [{ id: 1 }, { id: 2 }] } }, polls: 0 });
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.rls = sb.store[0].tables.launch_probe.rls;
    break;
  case "killed-before-record": {
    // UP ran and the worker died before reporting the table: the re-run recognises the probe's exact shape.
    await adapter.scaffold(ctxNow());
    const i = reported.findIndex((r) => r.kind === "db-probe-table");
    reported.splice(i, 1);
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.kinds = reported.map((r) => r.kind);
    break;
  }
  case "policy-recorded":
    // The policy check refuses after UP: the table it just made is already recorded, so the exit plan drops it.
    sb.store.length = 0;
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.kinds = reported.map((r) => r.kind);
    break;
  case "slow-start":
    // A project that is not healthy within the bounded wait: a resumable refusal, never a held lock.
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.kinds = reported.map((r) => r.kind);
    break;
  case "two-orgs-named":
  case "two-orgs-named-by-name":
  case "named-scopes-lookup": {
    const org = { "two-orgs-named": "o2", "two-orgs-named-by-name": "acme", "named-scopes-lookup": "o2" }[scenario];
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ org })));
    out.made = sb.store.filter((p) => p.id.startsWith("fixtureref")).map((p) => p.organization_id);
    out.kinds = reported.map((r) => r.kind);
    out.verify = await adapter.verify(ctxNow({ org }));
    break;
  }
  case "name-case": {
    // A name matches exactly: ACME is o2, and Acme matches neither (attack 67c6e07 L1).
    out.exact = await attempt(() => adapter.scaffold(ctxNow({ org: "ACME" })));
    out.made = sb.store.map((p) => p.organization_id);
    out.other = await attempt(() => adapter.scaffold(ctxNow({ org: "Acme" })));
    break;
  }
  case "unscoped-project":
  case "null-org":
  case "no-orgs":
  case "many-orgs": {
    const org = { "unscoped-project": "o2", "null-org": null }[scenario];
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ org })));
    out.creates = sb.calls.filter((c) => c === "POST /v1/projects").length;
    out.verify = await adapter.verify(ctxNow({ org }));
    break;
  }
  case "org-unknown":
  case "bad-org":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ org: scenario === "bad-org" ? 42 : "o9" })));
    out.creates = sb.calls.filter((c) => c === "POST /v1/projects").length;
    out.verify = await adapter.verify(ctxNow({ org: scenario === "bad-org" ? 42 : "o9" }));
    break;
  case "bad-region":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ region: "mars" })));
    out.creates = sb.calls.filter((c) => c === "POST /v1/projects").length;
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

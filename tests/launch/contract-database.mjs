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
  found: { projects: [{ id: "ownerref000000000001", name: "arc-sandbox" }] },
  "rls-off": { rlsOff: true },
  policy: { policy: true },
  paused: { projects: [{ id: "ownerref000000000002", name: "arc-sandbox", status: "INACTIVE" }] },
  "object-shape": { queryShape: "object" },
}[scenario] || {};
const sb = makeSupabase(opts);
globalThis.fetch = sb.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-db-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctxNow = ({ region = "in" } = {}) => makeCtx({
  profile: { slug: "arc-sandbox", region }, board: {}, slot: { id: "database" }, row,
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
  case "bad-region":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow({ region: "mars" })));
    out.creates = sb.calls.filter((c) => c === "POST /v1/projects").length;
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

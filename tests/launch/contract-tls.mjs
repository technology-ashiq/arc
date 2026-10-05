// Contract arm for the tls slot: the REAL vercel-managed-tls adapter under the REAL ctx, only the transport swapped
// for the in-memory SSL Labs + Vercel domain config. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-tls.mjs <scenario>
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeSslLabs } from "./fakes/ssllabs.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "vercel-managed-tls");
if (!row) { console.error("no vercel-managed-tls row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const opts = {
  "grade-b": { endpoints: [{ ipAddress: "76.76.21.21", grade: "A+", hsts: true }, { ipAddress: "76.76.21.22", grade: "B", hsts: true }] },
  "no-hsts": { endpoints: [{ ipAddress: "76.76.21.21", grade: "A", hsts: false }] },
  pending: { pendingPolls: 3 },
  "pending-forever": { pendingPolls: 99 },
  "rate-limited": { status: 429 },
  overloaded: { status: 529 },
  unreachable: { status: "unreachable" },
  misconfigured: { misconfigured: true },
}[scenario] || {};
const fake = makeSslLabs(opts);
globalThis.fetch = fake.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-tls-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctx = makeCtx({
  profile: { slug: "arc-sandbox", brand: { domain: "sandbox.automemory.ai" } }, board: {}, slot: { id: "tls" }, row,
  root: ROOT, resources: reported, upstream: {}, tag: "arc-sandbox@tls@vercel-managed-tls", attempt: 1, signal: undefined,
  env: { VERCEL_TOKEN: "vercel_fixture_token_0123456789" }, report: (r) => reported.push(r),
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };

const out = { scenario };
if (scenario === "misconfigured" || scenario === "apply") {
  out.scaffold = await attempt(() => adapter.scaffold(ctx));
  out.reported = reported.map((r) => r.kind);
  out.teardown = (await adapter.teardown(ctx)).steps.length;
}
out.verify = await adapter.verify(ctx);
out.ssllabsCalls = fake.calls.filter((c) => c.startsWith("api.ssllabs.com")).length;
console.log(`DONE ${JSON.stringify(out)}`);

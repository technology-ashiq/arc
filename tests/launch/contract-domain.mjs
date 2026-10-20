// Contract arm for the domain slot (ADR-1766): the REAL cloudflare-zone adapter under the REAL ctx, with only the
// transport swapped for the in-memory Cloudflare + RDAP. The row comes from the real registry, so ctx.fetch's host
// guard checks the hosts the adapter will really run under. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-domain.mjs <scenario>
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx, literalHosts } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeCloudflare } from "./fakes/cloudflare.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const REGISTRY = loadRegistry();
const row = REGISTRY.find((r) => r.id === "cloudflare-zone");
if (!row) { console.error("no cloudflare-zone row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const NAME = "myfitfolio.com";
const TAG = "myfitfolio@domain@cloudflare-zone";
const DAY = 86400000;
const rdapFor = ({ days = 300, status = ["client transfer prohibited"] } = {}) =>
  ({ objectClassName: "domain", ldhName: NAME.toUpperCase(), status, events: [{ eventAction: "registration", eventDate: "2026-10-01T00:00:00Z" }, { eventAction: "expiration", eventDate: new Date(Date.now() + days * DAY).toISOString() }] });

const zone = (extra = {}) => ({ id: "zone-fit", name: NAME, ...extra });
const cfOpts = {
  pending: { zones: [zone({ status: "pending" })] },
  "ns-mismatch": { zones: [zone()], publicNs: { [NAME]: ["ns1.oldregistrar.example", "ns2.oldregistrar.example"] }, rdap: { [NAME]: rdapFor() } },
  "no-zone": { zones: [{ id: "zone-1", name: "automemory.ai" }] },
  "two-zones": { zones: [zone(), zone({ id: "zone-dup" })] },
  unregistered: { zones: [zone()] },
  hold: { zones: [zone()], rdap: { [NAME]: rdapFor({ status: ["client hold"] }) } },
  expiring: { zones: [zone()], rdap: { [NAME]: rdapFor({ days: 9 }) } },
  "no-expiry": { zones: [zone()], rdap: { [NAME]: { objectClassName: "domain", ldhName: NAME, status: ["active"], events: [] } } },
  "wrong-record": { zones: [zone()], rdap: { [NAME]: { ...rdapFor(), ldhName: "OTHER-DOMAIN.COM" } } },
  "tld-unsupported": { zones: [{ id: "zone-io", name: "myfitfolio.io" }] },
}[scenario] || { zones: [zone()], rdap: { [NAME]: rdapFor() } };
const cf = makeCloudflare(cfOpts);
globalThis.fetch = cf.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-domain-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctxFor = ({ domain = NAME, token = "cf-token-0123456789abcdef", resources = reported } = {}) => makeCtx({
  profile: { slug: "myfitfolio", honesty_class: "real", brand: { name: "MyFitFolio", domain } }, board: {}, slot: { id: "domain" }, row,
  root: ROOT, resources, upstream: {}, tag: TAG, attempt: 1, signal: undefined, registryHosts: literalHosts(REGISTRY),
  env: { CLOUDFLARE_API_TOKEN: token }, report: (r) => { if (!reported.some((x) => x.id === r.id)) reported.push(r); },
});

const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const methods = () => [...new Set(cf.calls.map((c) => c.split(" ")[0]))];
const out = { scenario };
switch (scenario) {
  case "active": {
    const a = await attempt(() => adapter.scaffold(ctxFor()));
    const b = await attempt(() => adapter.scaffold(ctxFor()));
    out.first = a.ok; out.second = b.ok;
    out.reported = reported.map((r) => `${r.kind} ${r.id}`);
    out.verify = await adapter.verify(ctxFor());
    out.teardown = await adapter.teardown(ctxFor({ resources: reported }));
    out.methods = methods();
    out.hosts = [...new Set(cf.calls.map((c) => c.split(" ")[1].split("/")[0]))].sort();
    break;
  }
  case "pending":
  case "ns-mismatch":
  case "unregistered":
  case "hold":
  case "expiring":
  case "no-expiry":
  case "wrong-record":
    out.verify = await adapter.verify(ctxFor());
    out.methods = methods();
    break;
  case "no-zone":
  case "two-zones":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.verify = await attempt(() => adapter.verify(ctxFor()));
    break;
  case "tld-unsupported":
    out.verify = await adapter.verify(ctxFor({ domain: "myfitfolio.io" }));
    break;
  case "bad-domain":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ domain: "evil.example/x?y" })));
    out.calls = cf.calls.length;
    break;
  case "crlf-token":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ token: `cf-token-0123456789abcdef${String.fromCharCode(13)}` })));
    out.calls = cf.calls.length;
    break;
  case "hostile-error": {
    const hostile = `evil${String.fromCharCode(10)}FAKE LINE ${String.fromCharCode(0x202e)}${"x".repeat(500)}`;
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, errors: [{ code: 1, message: hostile }] }), { status: 403 });
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.clean = !/[\n‮]/.test(out.scaffold.message) && out.scaffold.message.length < 260;
    break;
  }
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

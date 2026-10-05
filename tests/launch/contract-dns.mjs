// Contract arm for the dns slot: the REAL cloudflare-dns adapter under the REAL ctx, with only the transport swapped
// for the in-memory Cloudflare (PLAN pre-mortem 2). The row comes from the real registry, so ctx.fetch's host guard
// checks the hosts the adapter will really run under. Prints `RAN <scenario>` first and `DONE <json>` last.
//   node tests/launch/contract-dns.mjs <scenario>
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeCloudflare } from "./fakes/cloudflare.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "cloudflare-dns");
if (!row) { console.error("no cloudflare-dns row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

const NAME = "sandbox.automemory.ai";
const TARGET = "abc123.vercel-dns-017.com";
const TAG = "arc-sandbox@dns@cloudflare-dns";
// The verify polls a resolver every 10 s while propagation lags; the arm does not wait out real seconds.
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const cfOpts = {
  foreign: { seed: [{ zone: "zone-1", type: "A", name: NAME, content: "192.0.2.1", proxied: false, comment: "hand-made" }] },
  proxied: { seed: [{ zone: "zone-1", type: "CNAME", name: NAME, content: TARGET, proxied: true, comment: TAG }] },
  drifted: { seed: [{ zone: "zone-1", type: "CNAME", name: NAME, content: "old.example.net", proxied: true, comment: TAG }] },
}[scenario] || {};
const cf = makeCloudflare(cfOpts);
globalThis.fetch = cf.fetch;

const reported = [];
const ctxFor = ({ upstream = { hosting: [{ kind: "dns-target", id: TARGET }] }, token = "cf-token", resources = reported } = {}) => makeCtx({
  profile: { slug: "arc-sandbox", brand: { domain: NAME } }, board: {}, slot: { id: "dns" }, row,
  root: mkdtempSync(join(tmpdir(), "launch-dns-")), resources, upstream, tag: TAG, attempt: 1, signal: undefined,
  env: { CLOUDFLARE_API_TOKEN: token }, report: (r) => { if (!reported.some((x) => x.id === r.id)) reported.push(r); },
});

const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const out = { scenario };
switch (scenario) {
  case "twice": {
    const a = await attempt(() => adapter.scaffold(ctxFor()));
    const b = await attempt(() => adapter.scaffold(ctxFor()));
    out.first = a.ok; out.second = b.ok;
    out.records = cf.records.filter((r) => r.name === NAME).map((r) => ({ type: r.type, content: r.content, proxied: r.proxied, comment: r.comment }));
    out.reported = reported.map((r) => r.kind);
    out.posts = cf.calls.filter((c) => c.startsWith("POST ")).length;
    out.verify = await adapter.verify(ctxFor());
    out.teardown = await adapter.teardown(ctxFor({ resources: reported }));
    break;
  }
  case "foreign":
  case "drifted":
  case "proxied": {
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor()));
    out.records = cf.records.filter((r) => r.name === NAME).map((r) => ({ type: r.type, content: r.content, proxied: r.proxied, comment: r.comment }));
    break;
  }
  case "proxied-verify": {
    cf.records.push({ id: "p1", zone: "zone-1", type: "CNAME", name: NAME, content: TARGET, proxied: true, comment: TAG });
    out.verify = await adapter.verify(ctxFor());
    break;
  }
  case "bad-target":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ upstream: { hosting: [{ kind: "dns-target", id: "evil.example/x?y" }] } })));
    out.posts = cf.calls.filter((c) => c.startsWith("POST ")).length;
    break;
  case "no-upstream":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ upstream: {} })));
    break;
  case "two-targets":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ upstream: { hosting: [{ kind: "dns-target", id: TARGET }, { kind: "dns-target", id: "b.example.com" }] } })));
    break;
  case "bad-token":
    out.scaffold = await attempt(() => adapter.scaffold(ctxFor({ token: "wrong" })));
    break;
  case "upstream-frozen": {
    const ctx = ctxFor();
    out.frozen = Object.isFrozen(ctx.upstream) && Object.isFrozen(ctx.upstream.hosting) && Object.isFrozen(ctx.upstream.hosting[0]);
    break;
  }
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

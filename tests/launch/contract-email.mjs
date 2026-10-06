// Contract arm for the email-transactional slot: the REAL resend adapter under the REAL ctx, only the transport
// swapped for the in-memory Resend wired to the in-memory Cloudflare (zone + DoH). A fresh ctx per call. Prints `RAN`
// first, `DONE` last.
//   node tests/launch/contract-email.mjs <scenario>
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { makeCloudflare } from "./fakes/cloudflare.mjs";
import { makeResend } from "./fakes/resend.mjs";

const scenario = process.argv[2];
console.log(`RAN ${scenario}`);
const row = loadRegistry().find((r) => r.id === "resend");
if (!row) { console.error("no resend row in the registry"); process.exit(1); }
const adapter = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0);

const D = "sandbox.automemory.ai";
const TAG = "arc-sandbox@email-transactional@resend";
const cfSeed = {
  "owner-dmarc": [{ zone: "zone-1", type: "TXT", name: `_dmarc.${D}`, content: "v=DMARC1; p=none;", proxied: false, comment: null }],
  "owner-other-txt": [{ zone: "zone-1", type: "TXT", name: `_dmarc.${D}`, content: "google-site-verification=abc", proxied: false, comment: null }],
}[scenario] || [];
const cloudflare = makeCloudflare({ token: "cf-token-0123456789abcdef", seed: cfSeed });
const resendRecords = {
  "outside-zone": [{ record: "DKIM", name: "resend._domainkey.evil.example", type: "TXT", value: "p=x" }],
  "bad-type": [{ record: "X", name: `x.${D}`, type: "A", value: "192.0.2.1" }],
}[scenario] || null;
// paged: 150 other domains come first, so the venture's own sits on the second page of 100.
const seedDomains = scenario === "paged" ? [...Array.from({ length: 150 }, (_, i) => ({ id: `dom_other_${String(i).padStart(3, "0")}`, name: `other${i}.example.com` })), { id: "dom_mine", name: D }] : [];
const resend = makeResend({ cloudflare, inner: cloudflare.fetch, records: resendRecords, domains: seedDomains });
globalThis.fetch = resend.fetch;

const ROOT = mkdtempSync(join(tmpdir(), "launch-email-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const reported = [];
const ctxNow = () => makeCtx({
  profile: { slug: "arc-sandbox", brand: { domain: D } }, board: {}, slot: { id: "email-transactional" }, row,
  root: ROOT, resources: reported, upstream: {}, tag: TAG, attempt: 1, signal: undefined,
  env: { RESEND_API_KEY: "re_fixture_token_0123456789", CLOUDFLARE_API_TOKEN: "cf-token-0123456789abcdef" },
  report: (r) => { if (!reported.some((x) => x.kind === r.kind && x.id === r.id)) reported.push(r); },
});
const attempt = async (fn) => { try { return { ok: true, value: await fn() }; } catch (e) { return { ok: false, code: e.code || null, message: e.message }; } };
const mine = () => cloudflare.records.filter((r) => r.comment === TAG);

const out = { scenario };
switch (scenario) {
  case "fresh":
    out.first = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.second = (await attempt(() => adapter.scaffold(ctxNow()))).ok;
    out.domains = resend.store.length;
    out.records = mine().map((r) => `${r.type} ${r.name} ${r.proxied}`).sort();
    out.dmarc = (mine().find((r) => r.name === `_dmarc.${D}`) || {}).content || null;
    out.status = resend.store[0] && resend.store[0].status;
    out.verify = await adapter.verify(ctxNow());
    out.teardown = (await adapter.teardown(ctxNow())).steps.map((s) => s.action);
    break;
  case "owner-dmarc":
  case "outside-zone":
  case "bad-type":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.written = mine().length;
    break;
  case "owner-other-txt":
    // A non-policy TXT at _dmarc is not a DMARC conflict: launch adds its own beside it.
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    break;
  case "paged":
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.domains = resend.store.length;
    out.kind = (reported.find((r) => r.kind.startsWith("resend-domain")) || {}).kind || null;
    break;
  case "owner-cname":
    // The owner's CNAME at send.<domain> blocks every record launch wants there: refused before any write.
    cloudflare.records.push({ id: "own-1", zone: "zone-1", type: "CNAME", name: `send.${D}`, content: "elsewhere.example.net", proxied: false, comment: null });
    out.scaffold = await attempt(() => adapter.scaffold(ctxNow()));
    out.written = mine().length;
    break;
  case "unverified":
    // The domain exists but its records were removed: Resend does not verify, and neither does the slot.
    await adapter.scaffold(ctxNow());
    for (const r of mine()) cloudflare.records.splice(cloudflare.records.indexOf(r), 1);
    resend.store[0].status = "failed";
    out.verify = await adapter.verify(ctxNow());
    break;
  default:
    console.error(`unknown scenario ${scenario}`);
    process.exit(1);
}
console.log(`DONE ${JSON.stringify(out)}`);

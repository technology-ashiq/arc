// Replays one recorded real verify (REQ-03, Phase 01 DoD): the adapter's own verify() runs through its real code path
// against the answers a real provider gave on arc-sandbox, redacted. ctx.fetch is answered from the recording, in order,
// by method and URL; a request the recording does not hold is answered 599 and named, so drift fails loudly.
//   node tests/launch/replay/replay.mjs <slot>      -> RAN <slot> ... DONE {json}
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT } from "../../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../../.claude/scripts/launch/lib/ctx.mjs";

const slot = process.argv[2];
console.log(`RAN ${slot}`);
const HERE = dirname(fileURLToPath(import.meta.url));
const rec = JSON.parse(readFileSync(join(HERE, "recorded", `${slot}.json`), "utf8"));
const row = loadRegistry().find((r) => r.id === rec.provider);
if (!row) { console.error(`no provider row ${rec.provider}`); process.exit(1); }
const mod = await import(pathToFileURL(join(PRODUCT, row.adapter)).href);

// Shape-valid stand-ins for every key the adapter declares: the recording answers, so no real key is needed.
const PS = ["AIza", "FixturePageSpeedKey0123456789abcdef"].join("");
const FIXTURE_ENV = {
  GITHUB_TOKEN: "gho_fixtureToken0123456789", VERCEL_TOKEN: "vercel_fixture_token_0123456789", SUPABASE_ACCESS_TOKEN: "sbp_fixtureAccessToken0123456789",
  RESEND_API_KEY: "re_fixtureResendKey0123456789", CLOUDFLARE_API_TOKEN: "cf_fixture_token_0123456789abcdef", PAGESPEED_API_KEY: PS,
};
const env = Object.fromEntries(mod.envContract().map((k) => [k, FIXTURE_ENV[k] || ""]));

// The clock the recording was made at, and waits that do not wait: the answers are already in.
const T = Date.parse(rec.recorded_at);
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...a) { super(...(a.length ? a : [T])); }
  static now() { return T; }
};
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...rest) => realTimeout(fn, 0, ...rest);

// A request is its method and URL; the PageSpeed key is the one query value a recording never holds.
const keyOf = (method, url) => {
  const u = new URL(String(url));
  u.searchParams.delete("key");
  return `${String(method || "GET").toUpperCase()} ${u.href}`;
};
const used = new Set();
const unmatched = [];
globalThis.fetch = async (input, init = {}) => {
  const k = keyOf(init.method, input);
  const i = rec.exchanges.findIndex((x, n) => !used.has(n) && keyOf(x.method, x.url) === k);
  if (i < 0) { unmatched.push(k); return new Response("not in the recording", { status: 599 }); }
  used.add(i);
  const x = rec.exchanges[i];
  const h = new Headers(x.headers || {});
  h.delete("content-encoding");
  h.delete("content-length");
  h.delete("transfer-encoding");
  for (const c of x.setCookie || []) h.append("set-cookie", c);
  const empty = x.status === 204 || x.status === 304 || (x.status >= 100 && x.status < 200);
  return new Response(empty ? null : x.body, { status: x.status, headers: h });
};

const ROOT = mkdtempSync(join(tmpdir(), "launch-replay-"));
process.on("exit", () => rmSync(ROOT, { recursive: true, force: true }));
const ctx = makeCtx({
  profile: rec.profile, board: {}, slot: { id: rec.slot }, row, root: ROOT, resources: rec.resources || [], upstream: rec.upstream || {},
  tag: `${rec.profile.slug}@${rec.slot}@${row.id}`, attempt: 1, signal: undefined, env, report: () => {},
});
let v;
try { v = await mod.verify(ctx); } catch (e) { v = { ok: false, reason: `threw ${e.code || ""} ${e.message}` }; }
console.log(`DONE ${JSON.stringify({ slot, provider: row.id, ok: v && v.ok === true, answerer: v && v.answerer, reason: v && v.reason, recordedOk: rec.answer && rec.answer.ok === true, exchanges: rec.exchanges.length, used: used.size, unmatched })}`);

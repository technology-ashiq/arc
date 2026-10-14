// Turns raw verify recordings (written by the worker under ARC_LAUNCH_RECORD, outside any repo) into the replay
// fixtures this repo carries. The arc repo is public, so this pass is the gate: every secret value from the private env
// file, every token shape, the Supabase project ref, provider ids, session cookies, magic-link tokens, e-mail addresses
// and the owner's name are replaced -- consistently across files, so a probe still correlates what it reads -- and the
// run REFUSES to write anything when a known private value survives.
//   node tests/launch/replay/redact.mjs <raw dir> <out dir> <private env file> <slot>...
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const [rawDir, outDir, envFile, ...slots] = process.argv.slice(2);
if (!rawDir || !outDir || !envFile || !slots.length) { console.error("usage: redact.mjs <raw dir> <out dir> <env file> <slot>..."); process.exit(2); }

// Shape-preserving: a prefix kept, then lower hex stays hex, other lower letters x, upper X, digits 0. A probe's shape
// checks still pass; no character of the original survives past the prefix.
const mask = (s, keep = 0) => s.slice(0, keep) + s.slice(keep).replace(/[a-f]/g, "a").replace(/[g-z]/g, "x").replace(/[A-Z]/g, "X").replace(/[0-9]/g, "0");

const secrets = readFileSync(envFile, "utf8").split(/\r?\n/).map((l) => l.replace(/^export\s+/, "")).filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l))
  .map((l) => l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")).filter((v) => v.length >= 8)
  // Longest first, so a secret inside a longer one is never half-replaced (attack 9eaf4f1 L12).
  .sort((x, y) => y.length - x.length);
// A value appears raw, JSON-escaped once (in the record) and twice (inside a recorded body string) (B7).
const forms = (v) => [...new Set([v, JSON.stringify(v).slice(1, -1), JSON.stringify(JSON.stringify(v).slice(1, -1)).slice(1, -1)])];

const map = new Map();
const counters = {};
const stable = (orig, make) => { if (!map.has(orig)) map.set(orig, make(orig)); return map.get(orig); };
const next = (p) => (counters[p] = (counters[p] || 0) + 1);
const pad = (head, n, len, fill = "0") => (head + String(n)).padEnd(len, fill).slice(0, Math.max(len, (head + String(n)).length));

const FIXTURE_REF = "fixtureref0000000001";
const RULES = [
  // Token shapes first: a JWT, Supabase's new-style keys, and every provider token prefix this lane uses.
  [/eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g, (m) => stable(m, () => mask(m, 3))],
  [/\b(sb_secret_|sb_publishable_|sbp_|re_|rzp_test_|rzp_live_|gho_|ghp_|ghs_|ghu_|sntrys_|sntryu_)[A-Za-z0-9_+/=-]{8,}/g, (m, p) => stable(m, () => mask(m, p.length))],
  [/AIza[0-9A-Za-z_-]{35}/g, (m) => stable(m, () => mask(m, 4))],
  // Supabase's session cookie value and any magic-link or confirm token.
  [/base64-[A-Za-z0-9+/=_-]{8,}/g, (m) => stable(m, () => mask(m, 7))],
  [/((?:hashed_token|token_hash|access_token|refresh_token|provider_token)\\?"\s*:\s*\\?")([A-Za-z0-9._~+/=-]{8,})/g, (m, k, v) => k + stable(v, () => mask(v))],
  [/((?:[?&](?:token|token_hash|code))=)([A-Za-z0-9._~%-]{8,})/g, (m, k, v) => k + stable(v, () => mask(v))],
  // Provider ids: kept shaped, numbered, the same everywhere they appear.
  // Supabase's organization id and slug: the owner's account, never a probe input.
  [/((?:organization_id|organization_slug)\\?"\s*:\s*\\?")([a-z0-9]{20})/g, (m, k, v) => k + stable(v, () => pad("fixtureorg", next("org"), 20))],
  // Any other 20-character id or ref (a Supabase-shaped value the project ref rule did not name): numbered, the same
  // everywhere, never the original.
  [/((?:\bid|\bref|project_ref)\\?"\s*:\s*\\?")(?!fixture)([a-z0-9]{20})(?=\\?")/g, (m, k, v) => k + stable(v, () => pad("fixtureid", next("id20"), 20))],
  // Vercel's prefixed ids only: a word like org_invites or env_keys is code, never an id.
  [/\b(prj|team|dpl|icfg|oac)_[A-Za-z0-9]{6,}\b/g, (m, p) => stable(m, () => `${p}_${pad("Fixture", next(p), m.length - p.length - 1)}`)],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, (m) => stable(m, () => `00000000-0000-4000-8000-${String(next("uuid")).padStart(12, "0")}`)],
  [/\b[0-9a-f]{32}\b/g, (m) => stable(m, () => String(next("hex32")).padStart(32, "0"))],
  // Addresses: launch's own probe users on the venture domain stay; every other one is the same placeholder.
  [/[A-Za-z0-9._%+-]+@(?![A-Za-z0-9.-]*sandbox\.automemory\.ai\b)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, () => "owner@example.invalid"],
  // The owner's name, outside the public org login ADR-1722 names.
  [/(?<!technology-)ashiq/gi, () => "owner"],
];

const PII_DROP = new Set(["bio", "blog", "company", "location", "twitter_username", "hireable", "gravatar_id", "notification_email", "phone", "billing", "avatar_url"]);
const PERSON = new Set(["author", "committer", "creator", "owner_user", "user", "actor", "triggering_actor", "sender"]);
function scrub(v, key = "") {
  if (Array.isArray(v)) return v.map((x) => scrub(x, key));
  if (!v || typeof v !== "object") return v;
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    if (PII_DROP.has(k)) continue;
    // A GitHub account object or a person record: its display name is the owner's, never a probe input.
    if (k === "name" && typeof x === "string" && (PERSON.has(key) || "login" in v || "username" in v)) { out[k] = "owner"; continue; }
    if (k === "username" && typeof x === "string" && x !== "technology-ashiq") { out[k] = "owner"; continue; }
    out[k] = scrub(x, k);
  }
  return out;
}

const outs = {};
// The venture's own Supabase ref is the one launch recorded (a resource or upstream id in ANY recording), never every
// host the answers name: a listing names the owner's other projects too.
const ventureRefs = new Set();
for (const slot of slots) {
  const p = join(rawDir, `${slot}.json`);
  if (!existsSync(p)) continue;
  const rec = JSON.parse(readFileSync(p, "utf8"));
  for (const r of [...(rec.resources || []), ...Object.values(rec.upstream || {}).flat()]) {
    const head = String((r && r.id) || "").split(":")[0];
    if (/^[a-z0-9]{20}$/.test(head)) ventureRefs.add(head);
  }
}
if (!ventureRefs.size) { console.error("no recording names the venture's Supabase ref; record database first"); process.exit(1); }

for (const slot of slots) {
  const p = join(rawDir, `${slot}.json`);
  if (!existsSync(p)) { console.error(`no raw recording for ${slot} in ${rawDir}`); process.exit(1); }
  const rec = JSON.parse(readFileSync(p, "utf8"));
  if (!Array.isArray(rec.exchanges) || !rec.exchanges.length) { console.error(`${slot}: the raw recording holds no exchange`); process.exit(1); }
  if (!(rec.answer && rec.answer.ok === true)) { console.error(`${slot}: the recorded verify did not pass; record a passing one`); process.exit(1); }
  // Profile fields no probe reads are dropped from every JSON answer before the text rules run: a person's name, place,
  // bio and links, and the name inside any commit author or deployment creator.
  // A listing answers every project or domain the owner holds: only the venture's own entry is kept, so another
  // venture's name, ref or domain never reaches this repo.
  const domain = rec.profile && rec.profile.brand ? rec.profile.brand.domain : "";
  for (const x of rec.exchanges) {
    let b;
    try { b = JSON.parse(x.body); } catch { continue; }
    let path = "";
    try { path = new URL(x.url).pathname; } catch { path = ""; }
    if (/^\/v1\/projects\/?$/.test(path) && Array.isArray(b)) b = b.filter((p) => p && (ventureRefs.has(p.id) || ventureRefs.has(p.ref)));
    if (/^\/domains\/?$/.test(path) && b && Array.isArray(b.data)) b.data = b.data.filter((d) => d && d.name === domain);
    x.body = JSON.stringify(scrub(b));
  }
  let s = JSON.stringify(rec);
  // The project ref is read from what launch recorded, never guessed, and replaced before any generic rule runs.
  const refs = new Set([...ventureRefs].map((r) => `${r}.supabase.co`));
  for (const r of refs) s = s.split(r.slice(0, 20)).join(FIXTURE_REF);
  for (const v of secrets) for (const f of forms(v)) s = s.split(f).join(mask(f));
  for (const [re, fn] of RULES) s = s.replace(re, fn);
  outs[slot] = { s, refs: [...refs].map((r) => r.slice(0, 20)) };
}
// A value a rule mapped in one context is replaced wherever else it appears, in every file (longest first, so a value
// inside a longer one is never half-replaced).
const pairs = [...map].sort((a, b) => b[0].length - a[0].length);
for (const o of Object.values(outs)) for (const [orig, to] of pairs) o.s = o.s.split(orig).join(to);

// The gate: nothing private survives in any file, or nothing is written.
const leaks = [];
for (const [slot, { s, refs }] of Object.entries(outs)) {
  for (const v of secrets) if (forms(v).some((f) => s.includes(f))) leaks.push(`${slot}: an env-file secret value`);
  for (const r of refs) if (s.includes(r)) leaks.push(`${slot}: the Supabase project ref`);
  for (const orig of map.keys()) if (s.includes(orig)) leaks.push(`${slot}: an original value the map replaced (${orig.length} chars)`);
  if (/@gmail\.com/i.test(s)) leaks.push(`${slot}: a gmail address`);
}
if (leaks.length) { console.error(`REFUSED -- ${leaks.length} leak(s), nothing written:\n${[...new Set(leaks)].join("\n")}`); process.exit(1); }
mkdirSync(outDir, { recursive: true });
for (const [slot, { s }] of Object.entries(outs)) {
  const rec = JSON.parse(s);
  // The answer's evidence is kept to the fields replay compares; the raw evidence may name what the map did not.
  rec.answer = { ok: rec.answer.ok, answerer: rec.answer.answerer };
  writeFileSync(join(outDir, `${slot}.json`), `${JSON.stringify(rec, null, 1)}\n`);
}
console.log(`redact: ${Object.keys(outs).length} recording(s) written, ${map.size} value(s) replaced, 0 leaks`);

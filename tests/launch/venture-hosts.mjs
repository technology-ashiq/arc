// REQ-13 / ADR-1765: `@venture` resolves to the venture's own brand.domain and to nothing else. Every case goes
// through makeCtx's real ctx.fetch with the network replaced by a counting transport, and records that the fetch RAN
// (the call was made) before what it answered. Prints `RAN venture-hosts`, then `DONE <json>`.
//   node tests/launch/venture-hosts.mjs [--mutant identity|unlowered]
// A mutant builds a copy of ctx.mjs whose resolveHosts is broken one way, and runs every case against the copy: the
// suite must then report failures, or the seam between the resolver and ctx.fetch is untested.
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRegistry } from "../../.claude/scripts/launch/lib/catalog.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = join(HERE, "..", "..", ".claude", "scripts", "launch", "lib");
const mutant = process.argv[2] === "--mutant" ? process.argv[3] : null;

const MUTANTS = {
  identity: ["  if (!hosts.includes(VENTURE_TOKEN)) return hosts;\n", "  return hosts;\n"],
  unlowered: ["const d = typeof raw === \"string\" ? raw.toLowerCase() : \"\";", "const d = typeof raw === \"string\" ? raw : \"\";"],
};

let tmp = null;
let ctxPath = join(LIB, "ctx.mjs");
if (mutant) {
  const edit = MUTANTS[mutant];
  if (!edit) { console.error(`unknown mutant ${mutant}`); process.exit(2); }
  tmp = mkdtempSync(join(tmpdir(), "venture-hosts-"));
  const src = readFileSync(ctxPath, "utf8").replace(/\r\n/g, "\n");
  // A mutant whose edit target is gone would run the real code and pass: refuse instead.
  if (!src.includes(edit[0])) { console.error(`mutant ${mutant}: edit target missing`); process.exit(2); }
  writeFileSync(join(tmp, "ctx.mjs"), src.replace(edit[0], edit[1]));
  copyFileSync(join(LIB, "public-suffixes.mjs"), join(tmp, "public-suffixes.mjs"));
  ctxPath = join(tmp, "ctx.mjs");
}
const { makeCtx, literalHosts } = await import(pathToFileURL(ctxPath).href);

const calls = [];
globalThis.fetch = async (u) => { calls.push(String(u)); return new Response("ok", { status: 200 }); };

const profile = (domain, honesty_class = "real") => ({ slug: "fx-real", honesty_class, brand: { name: "fixture", domain } });
const ROW = { id: "fixture-row", hosts: ["@venture"] };
const ctxFor = (row, prof, registryHosts = []) => makeCtx({ profile: prof, board: {}, slot: { id: "probe" }, row, root: HERE,
  resources: [], upstream: {}, tag: "t", attempt: 1, signal: undefined, env: {}, report: () => {}, registryHosts });

// One fetch through ctx: `ran` is set before the call, so a case that never reached ctx.fetch reads as not RAN.
async function attempt(ctx, url) {
  const before = calls.length;
  const out = { ran: true, reached: false, code: null, reason: null, message: null };
  try { await ctx.fetch(url); out.reached = calls.length > before; }
  catch (e) { out.code = e.code || null; out.reason = e.reason || null; out.message = String(e.message); out.reached = calls.length > before; }
  return out;
}

const REGISTRY = loadRegistry();
const LITS = literalHosts(REGISTRY);
const cases = {};
const reaches = async (name, row, prof, url, regHosts) => { const r = await attempt(ctxFor(row, prof, regHosts), url); cases[name] = { ...r, pass: r.ran && r.reached && !r.code }; };
const refuses = async (name, row, prof, url, reason, regHosts) => {
  const r = await attempt(ctxFor(row, prof, regHosts), url);
  cases[name] = { ...r, pass: r.ran && !r.reached && r.code === "HOST_REFUSED" && (reason === undefined || r.reason === reason) };
};

await reaches("own-domain", ROW, profile("myfitfolio.test"), "https://myfitfolio.test/", LITS);
await reaches("own-subdomain", ROW, profile("myfitfolio.test"), "https://www.myfitfolio.test/", LITS);
await reaches("own-domain-mixed-case", ROW, profile("MyFitFolio.TEST"), "https://myfitfolio.test/", LITS);
await refuses("lookalike-prefix", ROW, profile("myfitfolio.test"), "https://evilmyfitfolio.test/", undefined, LITS);
await refuses("lookalike-suffix", ROW, profile("myfitfolio.test"), "https://myfitfolio.test.evil.com/", undefined, LITS);
await refuses("ip-literal", ROW, profile("myfitfolio.test"), "https://1.2.3.4/", undefined, LITS);
await refuses("other-venture", ROW, profile("myfitfolio.test"), "https://sandbox.automemory.ai/", undefined, LITS);
await refuses("unassigned", ROW, profile("unassigned"), "https://unassigned/", "VENTURE_HOST_UNRESOLVED", LITS);
await refuses("no-domain", ROW, profile(undefined), "https://myfitfolio.test/", "VENTURE_HOST_UNRESOLVED", LITS);
await refuses("suffix-vercel-app", ROW, profile("vercel.app"), "https://vercel.app/", "VENTURE_HOST_UNRESOLVED", LITS);
await refuses("suffix-co-uk", ROW, profile("co.uk"), "https://co.uk/", "VENTURE_HOST_UNRESOLVED", LITS);
await refuses("trailing-dot", ROW, profile("myfitfolio.test."), "https://myfitfolio.test/", "VENTURE_HOST_UNRESOLVED", LITS);
await refuses("collides-github", ROW, profile("github.com"), "https://github.com/", "VENTURE_HOST_COLLIDES", LITS);
await refuses("collides-mixed-case", ROW, profile("GitHub.COM"), "https://github.com/", "VENTURE_HOST_COLLIDES", LITS);
await refuses("collides-fixture-row", ROW, profile("myfitfolio.test"), "https://myfitfolio.test/", "VENTURE_HOST_COLLIDES", [...LITS, "myfitfolio.test"]);

// The 19 rows: derived from the registry, resolved for arc-sandbox through the real loader into ctx.fetch, and
// compared element for element with the Cycle 1 literals.
const snap = JSON.parse(readFileSync(join(HERE, "fixtures", "cycle1-venture-hosts.json"), "utf8")).rows;
const tokenRows = REGISTRY.filter((r) => Array.isArray(r.hosts) && r.hosts.includes("@venture"));
const sandbox = profile("sandbox.automemory.ai", "rehearsal");
const rows = [];
for (const s of snap) {
  const r = tokenRows.find((x) => x.id === s.id && x.slot === s.slot);
  const probe = r ? await attempt(ctxFor(r, sandbox, LITS), "https://sandbox.automemory.ai/") : null;
  let resolved = null;
  if (r) { const mod = await import(pathToFileURL(ctxPath).href); try { resolved = mod.resolveHosts(r, sandbox, LITS); } catch (e) { resolved = String(e.message); } }
  rows.push({ id: s.id, same: JSON.stringify(resolved) === JSON.stringify(s.hosts), reached: !!(probe && probe.reached && !probe.code) });
}
cases["cycle1-equivalence"] = {
  ran: true, snapshot: snap.length, token_rows: tokenRows.length, mismatched: rows.filter((r) => !r.same).map((r) => r.id),
  unreached: rows.filter((r) => !r.reached).map((r) => r.id),
  pass: snap.length === 19 && tokenRows.length === snap.length && rows.every((r) => r.same && r.reached),
};

if (tmp) rmSync(tmp, { recursive: true, force: true });
console.log("RAN venture-hosts");
const failed = Object.entries(cases).filter(([, c]) => !c.pass).map(([n]) => n);
console.log(`DONE ${JSON.stringify({ mutant, total: Object.keys(cases).length, failed, cases })}`);

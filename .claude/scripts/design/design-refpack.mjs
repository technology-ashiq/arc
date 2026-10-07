#!/usr/bin/env node
// design-refpack.mjs -- adds ONE screen to a brief's reference pack (REQ-04, ADR-1404 / ADR-1408 /
// ADR-1412). Phase 02 slice B. The design-curator calls it once per screen.
//
// The order is the contract, and each step refuses before the next one can touch anything:
//
//   1. the REGISTRY decides whether this source may serve a pack at all -- before the network.
//      Exactly one row with the id (a duplicate is never resolved by taking the first, attack r1
//      B10), status `active`, allowed_use carrying `reference-pack`, access `fetch`. Each refusal
//      makes ZERO attempts: no state directory, no attempts.log, is how zero reads. status and
//      allowed_use are different questions -- awwwards is active and fetchable and still may not
//      be cached, because its terms allow a link only.
//   2. the HOST BINDING. The licence is checked on the registry row, so the URL must belong to
//      that row's `hosts` (the host or a subdomain of it), or the check is made on one input and
//      the fetch on another (B2). A real fetch refuses a row with no `hosts`, and a private or
//      loopback address is refused inside the transport.
//   3. the ROBOTS PREFLIGHT (design-robots.mjs) for this exact URL. Its answer -- ALLOW,
//      DISALLOW or UNREADABLE -- is appended to availability.log whatever it is. A refusal that
//      is not written down is a silent skip, and a pack that quietly came from one source reads
//      exactly like a pack that came from two.
//   4. the ROW has an adaptable principle and an avoid-this. Checked after the preflight so a
//      refusal is recorded even for a half-specified call, and before the screen is fetched.
//   5. the FETCH. Redirects are followed by hand, at most three, and every hop passes steps 2
//      and 3 again and may not downgrade to http (B3). The image goes to
//      .claude/state/design/refpacks/<brief>/ (gitignored); the facts go to
//      docs/design/refpacks/<brief>/sources.md (committed), with the query string dropped, since
//      a signed CDN query is a credential and this repo is public (B13). The sha is the sha of
//      the bytes written, never of the URL.
//
// sources.md is marked intent-to-add (`git add -N`). Provenance is the half of the pack that
// must be committed, and an untracked file in a new directory is exactly what gets forgotten --
// so a failed mark is an exit, not a shrug (B8).
//
// Offline-first: --robots-file / --robots-status / --fixture select the fake transport and
// --registry a scratch registry. They are TEST seams, so they need ARC_DESIGN_OFFLINE=1, and a
// row they produce is stamped `fixture` in both logs and in sources.md: a fixture must never
// read as a fetch from a real host (B4).
//
// Usage:  design-refpack.mjs --brief <id> --source <registry id> --url <screen url>
//           --principle <text> --avoid <text>
//           [--registry <path>] [--robots-file <path> | --robots-status <n>] [--fixture <path>]
//         design-refpack.mjs --brief <id> --source <id> --url <url> --stage 1   (fetch for viewing only; no row)
//         design-refpack.mjs --check-browse <url> [--registry <path>] [--robots-file <path> | --robots-status <n>]
//           (may a design-curator WebFetch this page -- ADR-1420; see checkBrowse)
// Exit:   0 added | 1 usage or unreadable registry | 2 registry or host refusal | 3 DISALLOW |
//         4 UNREADABLE | 5 the screen fetch failed | 6 written but not marked for commit

import { appendFileSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEFAULT_UA, EXIT, fakeTransport, parseHttpUrl, preflight, realTransport } from "./design-robots.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Pass the grammar and still break mkdir on the Windows leg (lanes.md, same list).
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/;
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
// "image/jpg" is non-standard, and real CDNs send it (nicelydone, Phase 02 real build); the magic
// bytes below still decide whether the body IS a jpeg.
const IMAGE_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif" };
const MAX_HOPS = 3;
const SEAMS = ["--registry", "--robots-file", "--robots-status", "--fixture", "--redirect"];

function fail(code, msg) {
  console.error(`design-refpack: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const known = new Set(["--brief", "--source", "--url", "--principle", "--avoid", "--stage", "--staged", ...SEAMS]);
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!known.has(k)) fail(1, `unknown argument '${k}'`);
    if (i + 1 >= argv.length || argv[i + 1] === "") fail(1, `${k} needs a value`);
    if (k in opts) fail(1, `${k} given twice`);
    opts[k] = argv[i + 1];
  }
  return opts;
}

// Remote text reaches the logs (a rule line, a content-type, an error message). One line, one
// field: no tab, no line break, no control character can forge a row.
function field(v) {
  return String(v).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, " ").trim();
}

// One markdown table cell: a pipe or a line break inside a principle must not become a column.
function cell(v) {
  return field(v).replace(/\|/g, "\\|");
}

// A URL as it may be written anywhere: no userinfo, no query, no fragment. A signed CDN query
// is a credential, and the logs sit one `git add -f` away from a public repo (attack r2 B10).
function shown(u) {
  return `${u.origin}${u.pathname}`;
}

// The first bytes of each cached type. A real response must be what its content-type claims.
const MAGIC = {
  png: (b) => b.length > 8 && b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG",
  jpg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => b.length > 6 && b.toString("latin1", 0, 4) === "GIF8",
  webp: (b) => b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP",
  avif: (b) => b.length > 12 && b.toString("latin1", 4, 8) === "ftyp" && /^avi[fs]$/.test(b.toString("latin1", 8, 12)),
};

// A port or userinfo on ANY hop, not only the first: hostAllowed reads the hostname alone, so a redirect to the same
// host on another port passed every hop's check (phase-02 attack G3 B1).
function portOrUser(u) {
  return u.port || u.username || u.password ? "carries a port or userinfo; the registry binds hosts" : null;
}

function validId(v) {
  return ID.test(v) && !RESERVED.test(v);
}

async function loadRegistry(path) {
  let parseYamlSubset;
  try {
    ({ parseYamlSubset } = await import(pathToFileURL(join(ROOT, ".claude", "scripts", "engine", "yaml-subset.mjs")).href));
  } catch (e) {
    fail(1, `cannot load the repo yaml subset parser: ${e.message}`);
  }
  if (!existsSync(path)) fail(1, `registry not found: ${path}`);
  const parsed = parseYamlSubset(readFileSync(path, "utf8"));
  if (!parsed || parsed.ok === false) fail(1, `registry unreadable: ${path}`);
  const doc = parsed.doc ?? parsed.value ?? parsed;
  if (!doc || !Array.isArray(doc.sources)) fail(1, `registry has no sources list: ${path}`);
  return doc.sources;
}

function asList(v) {
  return Array.isArray(v) ? v.map(String) : [];
}

// The url's host is one of the row's hosts, or a subdomain of one. Compared on the parsed,
// lower-cased hostname, never on the URL string.
function hostAllowed(hostname, hosts) {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return hosts.some((d) => h === d || h.endsWith("." + d));
}

// --check-browse <url>: may a design-curator WebFetch this page (ADR-1420)? The curator browses a
// gallery to choose screens, and a plain WebFetch never passes the preflight the image fetch does,
// so the Bash boundary's hook asks this before a curator's WebFetch runs. The same registry rules
// as a pack fetch, applied to ANY eligible row: https only, a host of an active, fetchable row
// whose allowed_use carries reference-pack, and a robots ALLOW for this exact URL. Every answer
// is appended to .claude/state/design/curator-browse.log: a refusal not written down is a silent
// skip. The whole check answers inside 40 s, or refuses: a hook that times out is read as allow.
// Exit: 0 ALLOW | 1 usage | 2 registry or host refusal | 3 DISALLOW | 4 UNREADABLE.
//
// Attack r1 (ADR-1420) shaped four of its rules:
// - robots is asked for EVERY token the fetch may be judged under: arc's ClaudeBot and Claude-User,
//   the token the harness's WebFetch answers to. A site that disallows the fetcher while allowing
//   `*` must not be read as permission (B3). Every token must ALLOW.
// - the page is probed once without following redirects. WebFetch follows a same-host redirect on
//   its own, so a redirect is refused and its target named: the curator asks for that URL, and it
//   is checked in its own right (B4).
// - a port or userinfo in the URL is refused: the registry binds hosts, not whatever listens on
//   another port of one (B9).
// - only the verdict ALLOW exits 0. Any verdict this file does not know is UNREADABLE (B2).
const BROWSE_DEADLINE_MS = 40000;
const BROWSE_UAS = [DEFAULT_UA, "Claude-User"];
async function checkBrowse(argv) {
  const logPath = join(ROOT, ".claude", "state", "design", "curator-browse.log");
  let url = null;
  let via = "network";
  const answer = (code, verdict, reason) => {
    const exitCode = verdict === "ALLOW" && code === 0 ? 0 : (code === 0 || code == null ? EXIT.UNREADABLE : code);
    try {
      mkdirSync(dirname(logPath), { recursive: true });
      appendFileSync(logPath, `${new Date().toISOString()}\t${verdict}\t${via}\t${url ? field(shown(url)) : "-"}\t${field(reason)}\n`);
    } catch { /* the refusal still stands; an unwritable log never turns one into an allow */ }
    if (exitCode !== 0) console.error(`design-refpack: ${verdict} -- ${field(reason)}`);
    process.exit(exitCode);
  };
  setTimeout(() => answer(EXIT.UNREADABLE, "UNREADABLE", `the preflight did not answer within ${BROWSE_DEADLINE_MS / 1000} s; permission unknown`), BROWSE_DEADLINE_MS);
  try {
    const known = new Set(["--check-browse", "--registry", "--robots-file", "--robots-status"]);
    const o = {};
    for (let i = 0; i < argv.length; i += 2) {
      const k = argv[i];
      if (!known.has(k)) answer(1, "USAGE", `unknown argument '${k}'`);
      if (i + 1 >= argv.length || argv[i + 1] === "") answer(1, "USAGE", `${k} needs a value`);
      if (k in o) answer(1, "USAGE", `${k} given twice`);
      o[k] = argv[i + 1];
    }
    const seamsUsed = ["--registry", "--robots-file", "--robots-status"].filter((k) => o[k] != null);
    if (seamsUsed.length && process.env.ARC_DESIGN_OFFLINE !== "1") answer(1, "USAGE", `${seamsUsed.join(", ")}: test seams; set ARC_DESIGN_OFFLINE=1`);
    if (o["--robots-status"] != null && !/^[1-5][0-9][0-9]$/.test(o["--robots-status"])) answer(1, "USAGE", "--robots-status must be an HTTP status");
    const fake = o["--robots-file"] != null || o["--robots-status"] != null;
    if (fake) via = "fixture";
    url = parseHttpUrl(o["--check-browse"]);
    if (!url) answer(1, "USAGE", "--check-browse needs an http(s) URL with a host");
    if (url.protocol !== "https:") answer(2, "REFUSED", "a curator fetches over https only");
    if (url.port || url.username || url.password) answer(2, "REFUSED", "a curator's URL carries no port and no userinfo; the registry binds hosts");
    const sources = await loadRegistry(o["--registry"] ? resolve(o["--registry"]) : join(ROOT, "design.sources.yaml"));
    const eligible = sources.filter((s) => s && String(s.status) === "active" && String(s.access) === "fetch"
      && asList(s.allowed_use).includes("reference-pack"));
    const hostsOf = (s) => asList(s.hosts).map((h) => h.toLowerCase()).filter((h) => HOST.test(h));
    const match = eligible.filter((s) => hostsOf(s).length > 0 && hostAllowed(url.hostname, hostsOf(s)));
    if (match.length === 0) answer(2, "REFUSED", `${url.hostname} is not a host of an active registry row whose allowed_use carries reference-pack`);
    const allHosts = match.flatMap(hostsOf);
    const guard = (u) => portOrUser(u) ?? (hostAllowed(u.hostname, allHosts) ? null : "is not a registry host");
    for (const ua of BROWSE_UAS) {
      const transport = fake
        ? fakeTransport({ robotsFile: o["--robots-file"] ?? null, robotsStatus: o["--robots-status"] ?? null })
        : realTransport({ ua });
      const d = await preflight({ url, ua, transport, guard });
      if (d.verdict !== "ALLOW") answer(Object.hasOwn(EXIT, d.verdict) ? EXIT[d.verdict] : EXIT.UNREADABLE, String(d.verdict), `as ${ua}: ${d.reason}`);
    }
    const probe = fake
      ? fakeTransport({ robotsFile: o["--robots-file"] ?? null, robotsStatus: o["--robots-status"] ?? null })
      : realTransport({ ua: "Claude-User" });
    let page;
    try { page = await probe.get(url.href, { maxBytes: 64 * 1024, truncate: true }); } catch (e) {
      answer(EXIT.UNREADABLE, "UNREADABLE", `the page could not be reached (${e && e.message ? e.message : "transport error"})`);
    }
    // A status that is missing or not an HTTP number is not "no redirect" (attack r2, B3).
    const s = Number(page && page.status);
    if (!Number.isInteger(s) || s < 100 || s > 599) answer(EXIT.UNREADABLE, "UNREADABLE", "the page probe returned no HTTP status");
    if (s >= 300 && s < 400) {
      let to = "an unreadable location";
      try { to = field(shown(new URL(page.location, url.href))); } catch { /* named as unreadable */ }
      answer(2, "REFUSED", `the page redirects (${s}) to ${to}; ask for that URL, and it is checked in its own right`);
    }
    answer(0, "ALLOW", `every token (${BROWSE_UAS.join(", ")}) allowed, and the page does not redirect`);
  } catch (e) {
    answer(EXIT.UNREADABLE, "UNREADABLE", `the check failed (${e && e.message ? e.message : "error"}); permission unknown`);
  }
}

// ---------- Phase 05: MCP search sources and the per-run availability summary ----------
//
// A search adapter per MCP source. Only the SEARCH tool is named here, so a row whose key could
// also reach a paid generator never calls it from this builder (owner 2026-10-05: 21st.dev is
// search mode only). A source with no adapter is refused, never guessed at.
// The tool and its arguments are the LIVE contract, read off tools/list on 2026-10-06: the legacy
// Magic name was translated server-side and answered in prose, so the first live run counted 0
// of 8 real results. `search` is read-only; the same endpoint also serves edit, delete and upload
// tools, which is why it is reached through this adapter and never through .mcp.json.
const MCP_SEARCH = {
  "21st-dev": {
    endpoint: "https://21st.dev/api/mcp", tool: "search", header: "x-api-key", credential: "API_KEY_21ST",
    args: (q, want) => ({ query: q, type: "component", limit: want }),
  },
  // shadcn's registry MCP runs locally over stdio, keyless, pinned (`npm view shadcn version` =
  // 4.21.2 on 2026-10-06). It answers in prose only, so its items are parsed from the list lines
  // the live server printed. The command is a constant: the query travels as JSON on stdin and
  // never reaches a shell.
  shadcn: {
    transport: "stdio", pkg: "shadcn@4.21.2", name: "shadcn", serverArgs: ["mcp"], label: "stdio:shadcn@4.21.2",
    tool: "search_items_in_registries", parse: "shadcn-prose",
    args: (q, want) => ({ registries: ["@shadcn"], query: q, limit: want }),
  },
};

// shadcn's prose list: `- card (registry:ui) [@shadcn]`, one item per line.
const SHADCN_ITEM = /^\s*-\s+([a-z0-9][a-z0-9-]{0,63})\s+\((registry:[a-z-]{1,32})\)\s+\[@[a-z0-9-]{1,64}\]/;
function shadcnItems(result) {
  const out = [];
  for (const t of searchText(result)) for (const line of t.split(/\r?\n|(?=\s-\s+[a-z0-9-]+\s+\(registry:)/)) {
    const m = SHADCN_ITEM.exec(line);
    if (m) out.push({ name: m[1], type: m[2] });
  }
  return out.slice(0, MCP_MAX_RESULTS);
}
const MCP_SEAMS = ["--registry", "--mcp-fixture", "--record-request", "--mcp-stdio-server"];
const MCP_DEADLINE_MS = 30000;
const MCP_MAX_BYTES = 2 * 1024 * 1024;
const MCP_MAX_RESULTS = 50;
const MCP_MAX_JUNK = 20;
// One budget for a whole stdio query: a cold npx download is charged to it, once.
const MCP_STDIO_BUDGET_MS = process.env.ARC_DESIGN_OFFLINE === "1" && /^[1-9][0-9]{3,5}$/.test(process.env.ARC_DESIGN_MCP_BUDGET_MS ?? "") ? Number(process.env.ARC_DESIGN_MCP_BUDGET_MS) : 150000;
const LF = String.fromCharCode(10);
// Built from code points, not escapes: an editor turned a typed escape for U+2028 into the real
// character once, which ends a regex literal mid-line.
const SCRUB_CTRL = new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(0x1f) + String.fromCharCode(0x7f, 0x85, 0x2028, 0x2029) + "]+", "g");

function parseNamed(argv, known, from) {
  const opts = {};
  for (let i = from; i < argv.length; i += 2) {
    const k = argv[i];
    if (!known.has(k)) fail(1, `unknown argument '${k}'`);
    if (i + 1 >= argv.length || argv[i + 1] === "") fail(1, `${k} needs a value`);
    if (k in opts) fail(1, `${k} given twice`);
    opts[k] = argv[i + 1];
  }
  return opts;
}

function seamGuard(o, seams) {
  const used = seams.filter((k) => o[k] != null);
  if (used.length && process.env.ARC_DESIGN_OFFLINE !== "1") fail(1, `${used.join(", ")} ${used.length > 1 ? "are test seams" : "is a test seam"}; set ARC_DESIGN_OFFLINE=1`);
  return used.length > 0;
}

// One JSON-RPC reply out of a body that is JSON or an SSE stream of `data:` lines.
function rpcReply(text, id) {
  const tryParse = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
  const whole = tryParse(text);
  const all = whole !== undefined ? [whole].flat() : String(text).split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => tryParse(l.slice(5).trim())).filter(Boolean);
  // Exactly one message may carry the id; two is an answer this builder will not choose between (attack fc30f54 B11).
  const hits = all.filter((m) => m && m.id === id);
  return hits.length === 1 ? hits[0] : undefined;
}

// Count what a search answered. The result shape is the upstream's, so every reading is tried
// and the count is what was found -- never the count that was asked for.
function searchItems(result) {
  const out = [];
  // The live shape: structuredContent.results. When it is present it is the answer, and the prose
  // beside it is a rendering of the same list, never a second count.
  const sc = result && result.structuredContent;
  if (sc && typeof sc === "object" && Array.isArray(sc.results)) {
    // A hit is an object that names a component (a string name or an id); an empty object is not
    // one. The list is capped at MCP_MAX_RESULTS, so a server ignoring `limit` cannot flood the
    // count or the console (attack 22567d9 B2 B3).
    return sc.results.slice(0, MCP_MAX_RESULTS).filter((x) => x && typeof x === "object" && ((typeof x.name === "string" && x.name.trim()) || typeof x.id === "number" || (typeof x.id === "string" && x.id.trim())));
  }
  for (const c of (result && Array.isArray(result.content) ? result.content : [])) {
    if (!c || c.type !== "text") continue;
    let v;
    try { v = JSON.parse(c.text); } catch { v = undefined; }
    const list = Array.isArray(v) ? v : v && typeof v === "object" ? (v.results ?? v.components ?? v.items ?? null) : null;
    if (Array.isArray(list)) out.push(...list.filter((x) => x && typeof x === "object"));
    // Free text, null or a primitive is not a counted result: an error sentence must not read as one hit (attack fc30f54 L2).
  }
  return out;
}

function searchText(result) {
  const out = [];
  for (const c of (result && Array.isArray(result.content) ? result.content : [])) {
    if (c && c.type === "text") out.push(String(c.text));
  }
  return out;
}

async function query(argv) {
  const o = parseNamed(argv, new Set(["--brief", "--source", "--want", ...MCP_SEAMS]), 2);
  const q = argv[0] === "--query" ? argv[1] : null;
  for (const k of ["--brief", "--source", "--want"]) if (!o[k]) fail(1, `${k} is required`);
  if (!q || !field(q)) fail(1, "--query needs a search text");
  const brief = o["--brief"], id = o["--source"];
  if (!validId(brief)) fail(1, `--brief must match ${ID} and not be a reserved device name, got '${field(brief)}'`);
  if (!validId(id)) fail(1, `--source must match ${ID} and not be a reserved device name, got '${field(id)}'`);
  if (!/^([1-9]|1[0-9]|20)$/.test(o["--want"])) fail(1, "--want is a whole number 1-20");
  const want = Number(o["--want"]);
  const seamed = seamGuard(o, MCP_SEAMS);
  const fake = o["--mcp-fixture"] != null;
  // A seam (a scratch registry, a request recorder) never drives the real, keyed network (attack fc30f54 B5).
  const fakeServer = o["--mcp-stdio-server"] != null;
  if (seamed && !fake && !fakeServer) fail(1, "a test seam needs --mcp-fixture or --mcp-stdio-server: a scratch registry or a recorder never sends a real request");
  let fixture = null;
  if (fake) {
    try { fixture = JSON.parse(readFileSync(resolve(o["--mcp-fixture"]), "utf8")); } catch (e) { fail(1, "--mcp-fixture is unreadable: " + field(e.message)); }
    if (!fixture || typeof fixture !== "object") fail(1, "--mcp-fixture must hold a JSON object keyed by method");
  }
  // The recorder is created by this run, never appended to an existing file (attack fc30f54 B6).
  const recPath = o["--record-request"] != null ? resolve(o["--record-request"]) : null;
  if (recPath) {
    // Created exclusively before any request: no check-then-create gap, and no write through a link (attack ce85db5 B5).
    try { writeFileSync(recPath, "", { flag: "wx" }); } catch (e) { fail(1, "--record-request must name a file that does not exist yet (" + field(e.code ?? e.message) + ")"); }
  }

  // 1. registry -- an off source makes no request at all.
  const sources = await loadRegistry(o["--registry"] ? resolve(o["--registry"]) : join(ROOT, "design.sources.yaml"));
  const rows = sources.filter((s) => s && String(s.id) === id);
  if (rows.length !== 1) fail(2, `refused: source '${id}' appears ${rows.length} times in the registry; exactly one row governs`);
  const src = rows[0];
  if (String(src.status) !== "active") fail(2, `refused: source '${id}' has status: ${field(src.status)}; only an active source is asked`);
  if (!asList(src.allowed_use).includes("reference-pack")) fail(2, `refused: source '${id}' lacks reference-pack in allowed_use`);
  if (String(src.access) !== "mcp") fail(2, `refused: --query is for an mcp source; '${id}' has access: ${field(src.access)}`);
  const adapter = Object.hasOwn(MCP_SEARCH, id) ? MCP_SEARCH[id] : null;
  if (!adapter) fail(2, `refused: source '${id}' has no search adapter here; its search tool is not guessed`);
  const stdio = adapter.transport === "stdio";
  // The fake server seam stands in for a LOCAL stdio server only; on an https source it would leave the network path real.
  if (fakeServer && !stdio) fail(1, "--mcp-stdio-server stands in for a local stdio source only; " + id + " is reached over https");
  if (fakeServer && fake) fail(1, "--mcp-stdio-server and --mcp-fixture are two fakes; give one");
  // A stdio server is local and keyless: it has no endpoint to bind, and it may hold no credential.
  if (stdio && String(src.auth) !== "none") fail(2, "refused: a stdio MCP source is keyless; source " + id + " has auth: " + field(src.auth));
  const ep = stdio ? null : new URL(adapter.endpoint);
  if (ep && (ep.protocol !== "https:" || ep.port || ep.username)) fail(2, "refused: a keyed MCP endpoint is https on its default port, with no userinfo");
  const hosts = asList(src.hosts).map((h) => String(h).toLowerCase());
  if (ep && !hostAllowed(ep.hostname, hosts)) fail(2, `refused: ${ep.hostname} is not one of source '${id}' hosts [${hosts.join(", ")}]`);
  const where = ep ? shown(ep) : adapter.label;

  const stateDir = join(ROOT, ".claude", "state", "design", "refpacks", brief);
  mkdirSync(stateDir, { recursive: true });
  const via = fake || fakeServer ? "fixture" : "network";
  // The key never lands in a reason, the log or the console, even when the server echoes it (attack fc30f54 B7).
  let key = null;
  // Only a key long enough to be a key: a one-letter key would scrub that letter out of every word.
  // Control characters are DELETED before the key is matched, so a separator a server slips into
  // the middle of an echoed key cannot split it past the scrub (attack ce85db5 B1). Then field().
  const scrub = (t) => {
    const tight = String(t).replace(SCRUB_CTRL, "");
    return key && key.length >= 8 ? tight.split(key).join("<key>") : String(t);
  };
  const record = (verdict, reason) => appendFileSync(join(stateDir, "availability.log"), `${new Date().toISOString()}\t${id}\t${via}\t${field(where)}\t${verdict}\t${field(scrub(reason))}\n`);
  const couldNot = (reason) => { record("COULD-NOT-SCAN", reason); fail(EXIT.UNREADABLE, `COULD-NOT-SCAN ${id} -- ${field(scrub(reason))}`); };

  // 2. credential: the registry names arc's secret, the adapter names the upstream header. Only
  // the value crosses; arc's name for it never leaves this process.
  if (String(src.auth) === "env") {
    const name = String(src.credential_ref ?? "");
    // The adapter, not the registry, names which secret this endpoint may receive (attack ce85db5 B3).
    if (name !== adapter.credential) fail(2, "refused: source " + id + " names credential_ref " + field(name) + "; this adapter sends only " + adapter.credential);
    key = name && process.env[name] ? process.env[name] : null;
    if (!key) couldNot(`credential ${field(name) || "(none named)"} is not set in the environment`);
  }

  // 3. the transport. The fake answers from a fixture and records each request with the key
  // replaced by its hash, so a test can prove which header carried it without writing it down.
  const post = async (body, extra) => {
    const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", ...extra };
    if (key) headers[adapter.header] = key;
    appendFileSync(join(stateDir, "attempts.log"), `${new Date().toISOString()}\t${id}\t${via}\tPOST\t${field(where)}\t${field(body.method)}\n`);
    if (fake) {
      if (recPath) {
        const shownHeaders = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, v === key ? `sha256:${createHash("sha256").update(v).digest("hex").slice(0, 16)}` : v]));
        appendFileSync(recPath, JSON.stringify({ url: where, headers: shownHeaders, body }) + "\n");
      }
      const r = fixture && fixture[body.method];
      if (!r) return { status: 0, error: `no fixture answer for ${body.method}` };
      return { status: r.status ?? 200, session: r.session ?? null, text: typeof r.body === "string" ? r.body : JSON.stringify(r.body) };
    }
    if (stdio) return stdioPost(body);
    try {
      const res = await fetch(ep.href, { method: "POST", headers, body: JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(MCP_DEADLINE_MS) });
      // Read under a byte cap: a body that never ends is COULD-NOT-SCAN, never a hang (attack fc30f54 B2).
      const chunks = [];
      let size = 0;
      if (res.body) {
        for await (const chunk of res.body) {
          size += chunk.length;
          if (size > MCP_MAX_BYTES) return { status: 0, error: "the reply passed " + MCP_MAX_BYTES + " bytes" };
          chunks.push(chunk);
        }
      }
      return { status: res.status, session: res.headers.get("mcp-session-id"), text: Buffer.concat(chunks).toString("utf8") };
    } catch (e) {
      return { status: 0, error: e && e.name === "TimeoutError" ? "no answer within " + MCP_DEADLINE_MS / 1000 + " s" : e && e.message ? e.message : "network error" };
    }
  };
  const step = async (body, extra) => {
    const r = await post(body, extra);
    if (r.status === 0) couldNot(`${body.method}: ${r.error}`);
    if (r.status === 401 || r.status === 403) couldNot(`${body.method}: the key was refused (HTTP ${r.status})`);
    if (r.status < 200 || r.status > 299) couldNot(`${body.method}: HTTP ${r.status}`);
    return r;
  };

  // One local server per run (attacks fc97161, 13edb77). The pinned package is installed ONCE into
  // a private, gitignored directory and its entry point is spawned directly under this node: no
  // shell, no npx wrapper, so the server is the direct child and there is no grandchild to orphan.
  // It runs with a private HOME/APPDATA (the owner's key store, .npmrc and caches are out of
  // reach), an allow-listed environment and an empty cwd that is removed afterwards. One budget
  // covers the whole query; the byte cap kills the server; 'close' (streams drained) ends it; a
  // second reply for one id or a run of non-JSON lines is COULD-NOT-SCAN.
  let child = null, buf = "", outBytes = 0, junk = 0, broken = null, closed = null, runDir = null;
  const waiting = new Map(), answered = new Set(), doubled = new Set();
  const budgetEnd = Date.now() + MCP_STDIO_BUDGET_MS;
  const failAll = (why) => {
    if (!broken) broken = why;
    for (const w of waiting.values()) w({ status: 0, error: why });
    waiting.clear();
    stopChild();
  };
  const privateEnv = () => {
    runDir = mkdtempSync(join(tmpdir(), "arc-mcp-"));
    const home = join(runDir, "home");
    mkdirSync(join(home, "AppData", "Roaming"), { recursive: true });
    mkdirSync(join(home, "AppData", "Local"), { recursive: true });
    // Two empty files: npm refuses one file loaded as both the user and the global config.
    writeFileSync(join(runDir, "npmrc-user"), "");
    writeFileSync(join(runDir, "npmrc-global"), "");
    const keep = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP"];
    const env = Object.fromEntries(keep.filter((k) => process.env[k] != null).map((k) => [k, process.env[k]]));
    Object.assign(env, {
      HOME: home, USERPROFILE: home, APPDATA: join(home, "AppData", "Roaming"), LOCALAPPDATA: join(home, "AppData", "Local"),
      npm_config_registry: "https://registry.npmjs.org/", npm_config_ignore_scripts: "true",
      npm_config_userconfig: join(runDir, "npmrc-user"), npm_config_globalconfig: join(runDir, "npmrc-global"),
      npm_config_cache: join(ROOT, ".claude", "state", "design", "mcp", "npm-cache"),
    });
    if (o["--mcp-stdio-server"] != null) for (const [k, v] of Object.entries(process.env)) if (/^FAKE_MCP_[A-Z_]{1,32}$/.test(k)) env[k] = v;
    return env;
  };
  // The pinned package, installed once. Its entry point is read from its own package.json and
  // must stay inside the install directory.
  const serverEntry = (env) => {
    if (o["--mcp-stdio-server"] != null) return resolve(o["--mcp-stdio-server"]);
    const dir = join(ROOT, ".claude", "state", "design", "mcp", adapter.pkg.replace(/[^abcdefghijklmnopqrstuvwxyz0123456789.@-]/gi, "_"));
    const pj = join(dir, "node_modules", adapter.name, "package.json");
    if (!existsSync(pj)) {
      const cli = [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"), join(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")].find((p) => existsSync(p));
      if (!cli) return null;
      mkdirSync(dir, { recursive: true });
      const left = Math.max(1000, budgetEnd - Date.now());
      const r = spawnSync(process.execPath, [cli, "install", "--prefix", dir, "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", adapter.pkg], { cwd: runDir, env, stdio: "ignore", windowsHide: true, timeout: left });
      if (r.error || r.status !== 0 || !existsSync(pj)) return null;
    }
    let bin;
    try { const p = JSON.parse(readFileSync(pj, "utf8")); bin = typeof p.bin === "string" ? p.bin : p.bin && p.bin[adapter.name]; } catch { return null; }
    const entry = resolve(dirname(pj), String(bin ?? ""));
    return bin && entry.startsWith(resolve(dirname(pj)) + sep) && existsSync(entry) ? entry : null;
  };
  const startChild = () => {
    const env = privateEnv();
    const entry = serverEntry(env);
    if (!entry) return failAll("the pinned " + adapter.pkg + " could not be installed or has no entry point; the local server cannot start");
    const args = o["--mcp-stdio-server"] != null ? [entry] : [entry, ...adapter.serverArgs];
    child = spawn(process.execPath, args, { cwd: runDir, env, shell: false, stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
    closed = new Promise((r) => child.on("close", r));
    child.on("error", (e) => failAll("the local server did not start: " + e.message));
    // 'close', not 'exit': it fires after stdout is drained, so a reply written just before exit is read first.
    child.on("close", (code) => failAll("the local server exited (code " + code + ") before answering"));
    child.stdin.on("error", (e) => failAll("the local server closed its input: " + (e.code ?? e.message)));
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (d) => {
      outBytes += Buffer.byteLength(d);
      if (outBytes > MCP_MAX_BYTES) return failAll("the reply passed " + MCP_MAX_BYTES + " bytes");
      buf += d;
      let i;
      while ((i = buf.indexOf(LF)) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let m; try { m = JSON.parse(line); } catch { m = undefined; }
        if (!m || typeof m !== "object") { if (++junk > MCP_MAX_JUNK) failAll("the local server printed more than " + MCP_MAX_JUNK + " lines that are not JSON-RPC"); continue; }
        if (m.method !== undefined || m.id === undefined) continue;
        if (answered.has(m.id)) { doubled.add(m.id); continue; }
        answered.add(m.id);
        if (waiting.has(m.id)) { waiting.get(m.id)({ status: 200, text: line }); waiting.delete(m.id); }
      }
    });
  };
  const stdioPost = (body) => new Promise((done) => {
    if (!child && !broken) startChild();
    if (broken) return done({ status: 0, error: broken });
    if (child.exitCode !== null || !child.stdin.writable) return done({ status: 0, error: "the local server is not running" });
    child.stdin.write(JSON.stringify(body) + LF);
    if (body.id === undefined) return done({ status: 202, text: "" });
    const left = budgetEnd - Date.now();
    if (left <= 0) return done({ status: 0, error: "the " + MCP_STDIO_BUDGET_MS / 1000 + " s budget for this query ran out" });
    const t = setTimeout(() => { waiting.delete(body.id); done({ status: 0, error: "no answer within the " + MCP_STDIO_BUDGET_MS / 1000 + " s budget" }); }, left);
    waiting.set(body.id, (r) => { clearTimeout(t); done(r); });
  });
  // The server is the direct child, so killing it ends it; the result is checked, never assumed.
  function stopChild() {
    if (child && child.exitCode === null && child.signalCode === null) { try { child.kill("SIGKILL"); } catch { /* already gone */ } }
    if (runDir) { try { rmSync(runDir, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
  // Stop the server, wait for its streams to drain, THEN judge doubled replies (attack 13edb77 B5).
  const finishStdio = async () => {
    if (!child) return;
    stopChild();
    await Promise.race([closed, new Promise((r) => setTimeout(r, 5000))]);
    if (doubled.size) couldNot("the local server answered one request twice");
  };
  process.on("exit", stopChild);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => { stopChild(); process.exit(130); });

  const init = await step({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "arc-design-refpack", version: "1" } } }, {});
  if (init.session != null && !/^[A-Za-z0-9._:-]{1,128}$/.test(init.session)) couldNot("initialize: the server sent a session id outside the header grammar");
  const session = init.session ? { "mcp-session-id": init.session } : {};
  await post({ jsonrpc: "2.0", method: "notifications/initialized" }, session);
  const call = await step({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: adapter.tool, arguments: adapter.args(q, want) } }, session);
  // Two replies for one id on stdio are an answer this builder will not choose between (attack fc97161 B6).
  if (stdio && !fake) await finishStdio();
  const reply = rpcReply(call.text, 2);
  if (!reply) couldNot("tools/call: no reply carried this request id");
  if (!reply.error && (reply.method !== undefined || reply.result === undefined || reply.result === null)) couldNot("tools/call: the reply carries no result");
  if (reply.result && reply.result.isError === true) couldNot("tools/call: the tool reported an error: " + searchText(reply.result).join(" ").slice(0, 200));
  if (reply.error) couldNot(`tools/call: ${field(reply.error.message ?? "error")}`);
  const say = (t) => console.log(field(scrub(t)));
  const items = adapter.parse === "shadcn-prose" ? shadcnItems(reply.result) : searchItems(reply.result);
  const n = Math.min(items.length, want);
  const short = items.length < want ? `; SHORT -- asked for ${want}, got ${items.length}` : "";
  record("ANSWERED", `results ${n} of ${want}${short}`);
  for (const it of items.slice(0, want)) {
    const name = field(it.name ?? it.title ?? "(unnamed)").slice(0, 120);
    // No query or fragment: a signed URL's token must not reach output an agent copies into a file (attack fc30f54 B8).
    const pics = JSON.stringify(it).match(/https:\/\/[^"\s?#]+\.(png|jpe?g|webp|avif|gif)/gi) ?? [];
    say(`  ${name}${pics.length ? ` -- preview ${pics[0]}` : ""}`);
  }
  if (items.length === 0) for (const t of searchText(reply.result)) say("  (unstructured answer, not counted) " + String(t).slice(0, 200));
  say(`design-refpack query: ${id} answered ${n} of ${want}${short}`);
}

// One availability line per active pack source for a run, read from what the run RECORDED --
// never from the registry's availability field. An active source the run never asked is named,
// so a pack built from one source can never read like a pack built from two.
async function summary(argv) {
  const o = parseNamed(argv, new Set(["--brief", "--since", "--registry"]), 1);
  if (!o["--brief"] || !o["--since"]) fail(1, "--summary needs --brief and --since <ISO time the run started>");
  if (!validId(o["--brief"])) fail(1, `--brief must match ${ID}`);
  const since = Date.parse(o["--since"]);
  // A zone is required: a bare time is read as local, the logs are UTC, and on a +05:30 box that
  // drops five and a half hours of records in silence (attack ce85db5 B7).
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(o["--since"]) || Number.isNaN(since)) fail(1, "--since takes an ISO time with a zone, e.g. 2026-10-05T09:00:00Z");
  seamGuard(o, ["--registry"]);
  const sources = await loadRegistry(o["--registry"] ? resolve(o["--registry"]) : join(ROOT, "design.sources.yaml"));
  const active = sources.filter((s) => s && String(s.status) === "active" && asList(s.allowed_use).includes("reference-pack")).map((s) => String(s.id));
  if (active.length === 0) fail(1, "the registry has no active pack source; there is nothing to report on (this is not a pass)");
  const readLines = (p) => (existsSync(p) ? readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean) : []);
  const stateDir = join(ROOT, ".claude", "state", "design", "refpacks", o["--brief"]);
  // A line that does not parse is counted and named, never dropped: a torn record must not turn
  // an answer into NOT-ASKED (attack fc30f54 B10).
  const rawAvail = readLines(join(stateDir, "availability.log")).map((l) => l.split("\t"));
  const malformed = rawAvail.filter((f) => f.length < 6 || Number.isNaN(Date.parse(f[0]))).length;
  const avail = rawAvail.filter((f) => f.length >= 6 && Date.parse(f[0]) >= since);
  const added = readLines(join(ROOT, "docs", "design", "refpacks", o["--brief"], "sources.md"))
    .filter((l) => /^\| https?:/.test(l)).map((l) => l.split(" | ")).filter((c) => c.length >= 4 && Date.parse(c[1]) >= since).map((c) => c[3].replace(/ \(fixture\)$/, ""));
  let answered = 0;
  let fixtureOnly = 0;
  for (const id of active) {
    const mine = avail.filter((f) => f[1] === id);
    const count = (v) => mine.filter((f) => f[4] === v).length;
    const rows = added.filter((s) => s === id).length;
    const mcp = mine.filter((f) => f[4] === "ANSWERED").map((f) => f[5]);
    const notes = [];
    if (count("DISALLOW")) notes.push(`REFUSED (robots) ${count("DISALLOW")}`);
    const cns = mine.filter((f) => f[4] === "UNREADABLE" || f[4] === "COULD-NOT-SCAN");
    if (cns.length) notes.push(`COULD-NOT-SCAN ${cns.length} (${field(cns[cns.length - 1][5])})`);
    let head;
    if (mine.length === 0) head = "NOT-ASKED -- active, and this run never queried it";
    // Every answer of the run, not only the last: a later empty query must not erase an earlier hit.
    else if (mcp.length) head = `ANSWERED ${mcp.map(field).join(" | ")}`;
    else head = `ANSWERED ${rows}/${count("ALLOW") + count("DISALLOW") + cns.length} screen(s) added/asked`;
    const live = mine.some((f) => f[2] !== "fixture");
    const said = mcp.some((r) => !/^results 0 /.test(r)) || rows > 0;
    // A fixture-only source answered a test, not this run: it is never counted live (attack ce85db5 B8).
    const ok = said && live;
    if (said && !live) fixtureOnly++;
    if (ok) answered++;
    // A fixture record is a test, not an observation of the source: it is labelled, never read as live (attack fc30f54 B9).
    const tag = mine.length && mine.every((f) => f[2] === "fixture") ? " [fixture]" : mine.some((f) => f[2] === "fixture") ? " [fixture+network]" : "";
    console.log(`availability ${id}${tag}: ${head}${notes.length ? `; ${notes.join("; ")}` : ""}`);
  }
  if (malformed) console.log(`design-refpack summary: ${malformed} malformed availability line(s) were not read`);
  console.log(`design-refpack summary: ${answered} of ${active.length} active pack source(s) answered live since ${field(o["--since"])}${fixtureOnly ? ` (${fixtureOnly} more answered from a fixture only)` : ""}`);
}

// The manual-drop door (Phase 08 S3, REQ-10): a screen the OWNER chose and saved by hand enters the pack
// attributed, exactly like a fetched one. Nothing is fetched, so robots and the registry do not apply -- the
// row says so instead. Where it came from (--url) and the principle it teaches are required: an unattributed
// drop is the thing REQ-10 exists to refuse.
//   design-refpack.mjs --drop <file> --brief <id> --url <where it came from> --principle <text> --avoid <text>
const MAX_DROP_BYTES = 16 * 1024 * 1024;
function drop(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!["--drop", "--brief", "--url", "--principle", "--avoid"].includes(k)) fail(1, "unknown argument '" + field(k) + "' for --drop");
    if (i + 1 >= argv.length || argv[i + 1] === "") fail(1, k + " needs a value");
    if (k in o) fail(1, k + " given twice");
    o[k] = argv[i + 1];
  }
  for (const k of ["--brief", "--url", "--principle", "--avoid"]) if (!o[k] || !field(o[k])) fail(1, "--drop needs " + k + " -- a dropped screen without it is unattributed");
  const brief = o["--brief"];
  if (!validId(brief)) fail(1, "--brief must match " + ID + " and not be a reserved device name, got '" + field(brief) + "'");
  const url = parseHttpUrl(o["--url"]);
  if (!url) fail(1, "--url must be the http(s) address the screen came from, got '" + field(o["--url"]) + "'");
  const src = resolve(o["--drop"]);
  let st;
  try { st = lstatSync(src); } catch (e) { fail(1, "the dropped file cannot be read (" + (e.code || "error") + ")"); }
  if (st.isSymbolicLink() || !st.isFile()) fail(1, "the dropped file is a link or not a regular file");
  if (st.size === 0 || st.size > MAX_DROP_BYTES) fail(1, "the dropped file is empty or larger than " + MAX_DROP_BYTES + " bytes");
  const body = readFileSync(src);
  const ext = Object.keys(MAGIC).find((e) => MAGIC[e](body));
  if (!ext) fail(1, "the dropped file is not a png, jpg, gif, webp or avif image by its bytes");
  const sha = createHash("sha256").update(body).digest("hex");
  const stateDir = join(ROOT, ".claude", "state", "design", "refpacks", brief);
  const image = join(stateDir, "manual-" + sha.slice(0, 16) + "." + ext);
  if (!resolve(image).startsWith(resolve(stateDir) + sep)) fail(1, "refused: the image path left the pack directory");
  const sourcesMd = join(ROOT, "docs", "design", "refpacks", brief, "sources.md");
  if (existsSync(sourcesMd) && readFileSync(sourcesMd, "utf8").split(/\r?\n/).some((l) => l.startsWith("|") && (l.split("|")[3] ?? "").trim() === sha)) {
    fail(1, "this screen is already in the pack (sha " + sha.slice(0, 16) + "); a second row would attribute it twice");
  }
  mkdirSync(stateDir, { recursive: true });
  const existed = existsSync(image);
  writeFileSync(image, body);
  try {
    mkdirSync(dirname(sourcesMd), { recursive: true });
    if (!existsSync(sourcesMd)) {
      writeFileSync(sourcesMd, "# Reference pack -- " + brief + "\n\nProvenance only (ADR-1404): the images are cached under `.claude/state/design/refpacks/" + brief + "/` and never committed. Query strings are dropped from every URL.\n\n| url | fetched | sha256 | source | adaptable principle | avoid this |\n|---|---|---|---|---|---|\n", { flag: "wx" });
    }
    appendFileSync(sourcesMd, "| " + cell(shown(url) + " (dropped by the owner, not fetched)") + " | " + new Date().toISOString() + " | " + sha + " | " + cell("manual (owner)") + " | " + cell(o["--principle"]) + " | " + cell(o["--avoid"]) + " |\n");
  } catch (e) {
    if (!existed) { try { unlinkSync(image); } catch { /* already gone */ } }
    fail(5, "the provenance row could not be written" + (existed ? "" : ", so the dropped image was removed") + ": " + field(e.message));
  }
  console.log("dropped " + field(shown(url)) + " -> " + relative(ROOT, image).split("\\").join("/") + " (sha256 " + sha + "), attributed in " + relative(ROOT, sourcesMd).split("\\").join("/"));
}

async function main(argv) {
  if (argv[0] === "--check-browse") return checkBrowse(argv);
  if (argv[0] === "--drop") return drop(argv);
  if (argv[0] === "--query") return query(argv);
  if (argv[0] === "--summary") return summary(argv);
  const o = parseArgs(argv);
  for (const k of ["--brief", "--source", "--url"]) if (!o[k]) fail(1, `${k} is required`);
  const brief = o["--brief"];
  // --stage 1: fetch for viewing, write no row (the curator looks before it writes a principle).
  if (o["--stage"] != null && o["--stage"] !== "1") fail(1, "--stage takes 1");
  const stage = o["--stage"] === "1";
  if (stage && (o["--principle"] != null || o["--avoid"] != null)) fail(1, "a call is a --stage OR an add: a staged screen carries no principle yet");
  // --staged <16 hex>: the add is bound to the bytes the curator looked at. A host that serves
  // one image to the stage and another to the add is refused, not recorded under a principle
  // written about the first (staging attack, B8).
  if (o["--staged"] != null && (stage || !/^[0-9a-f]{16}$/.test(o["--staged"]))) fail(1, "--staged takes the 16-hex sha prefix a --stage printed, on an add only");
  const id = o["--source"];
  if (!validId(brief)) fail(1, `--brief must match ${ID} and not be a reserved device name, got '${field(brief)}'`);
  if (!validId(id)) fail(1, `--source must match ${ID} and not be a reserved device name, got '${field(id)}'`);
  const url = parseHttpUrl(o["--url"]);
  if (!url) fail(1, `--url must be an http(s) URL with a host, got '${field(o["--url"])}'`);
  // The registry binds hosts, not whatever listens on another port of one (ADR-1420 r2 B4, the
  // pack-path twin of --check-browse's rule).
  if (url.port || url.username || url.password) fail(2, "refused: a pack URL carries no port and no userinfo; the registry binds hosts");
  if (o["--robots-status"] != null && !/^[1-5][0-9][0-9]$/.test(o["--robots-status"])) fail(1, "--robots-status must be an HTTP status");
  const seamsUsed = SEAMS.filter((k) => o[k] != null);
  if (seamsUsed.length && process.env.ARC_DESIGN_OFFLINE !== "1") {
    fail(1, `${seamsUsed.join(", ")} ${seamsUsed.length > 1 ? "are test seams" : "is a test seam"}; set ARC_DESIGN_OFFLINE=1 to use the fake transport or a scratch registry`);
  }

  const stateDir = join(ROOT, ".claude", "state", "design", "refpacks", brief);
  const attemptsLog = join(stateDir, "attempts.log");
  const availabilityLog = join(stateDir, "availability.log");
  const sourcesMd = join(ROOT, "docs", "design", "refpacks", brief, "sources.md");

  // 1. registry -- nothing below this block runs for a source that may not serve a pack.
  const sources = await loadRegistry(o["--registry"] ? resolve(o["--registry"]) : join(ROOT, "design.sources.yaml"));
  const rows = sources.filter((s) => s && String(s.id) === id);
  if (rows.length === 0) fail(2, `refused: source '${id}' is not in the registry; an unregistered source is never unrestricted`);
  if (rows.length > 1) fail(2, `refused: source '${id}' appears ${rows.length} times in the registry; which row governs is not guessed`);
  const src = rows[0];
  if (String(src.status) !== "active") fail(2, `refused: source '${id}' has status: ${field(src.status)}; only an active source is fetched`);
  if (!asList(src.allowed_use).includes("reference-pack")) {
    fail(2, `refused: source '${id}' allowed_use is [${asList(src.allowed_use).map(field).join(", ")}] and lacks reference-pack; it may be linked, not cached`);
  }
  // An mcp source's preview IMAGE is fetched like any screen (Phase 05 S5): it must sit on one of
  // the row's hosts and pass the same robots preflight below. Only the image is fetched here; the
  // search that found it went through --query. Every other access kind is refused.
  if (String(src.access) !== "fetch" && String(src.access) !== "mcp") fail(2, `refused: source '${id}' has access: ${field(src.access)}; this builder fetches a fetch or mcp source's images only`);
  // An mcp row needs a non-empty hosts list AND a search adapter here: an mcp source this builder
  // cannot search (shadcn) has no business adding images (attack af751d5 B1).
  if (String(src.access) === "mcp" && (asList(src.hosts).length === 0 || !Object.hasOwn(MCP_SEARCH, id))) fail(2, `refused: mcp source '${id}' needs a non-empty hosts list and a search adapter before its images are added`);

  // 2. host binding. A scratch registry may omit hosts; the real one may not.
  const fake = ["--robots-file", "--robots-status", "--fixture", "--redirect"].some((k) => o[k] != null);
  const hosts = src.hosts === undefined ? null : asList(src.hosts).map((h) => h.toLowerCase());
  if (hosts !== null && (hosts.length === 0 || !hosts.every((h) => HOST.test(h)))) {
    fail(2, `refused: source '${id}' has a hosts list that is empty or not bare host names`);
  }
  if (hosts === null && !fake) fail(2, `refused: source '${id}' names no hosts, so a URL cannot be bound to it; the owner adds hosts to its registry row`);
  const outsideHosts = (u) => portOrUser(u) ?? (hosts !== null && !hostAllowed(u.hostname, hosts) ? `is not one of source '${id}' hosts [${hosts.join(", ")}]` : null);
  const bind = (u) => {
    const why = outsideHosts(u);
    if (why) fail(2, `refused: ${u.hostname} ${why}`);
  };
  bind(url);

  // Every attempt is written BEFORE it is made, so a crash mid-request still counts.
  const inner = fake
    ? fakeTransport({ robotsFile: o["--robots-file"] ?? null, robotsStatus: o["--robots-status"] ?? null, fixture: o["--fixture"] ?? null, redirect: o["--redirect"] ?? null })
    : realTransport({ ua: DEFAULT_UA });
  const via = fake ? "fixture" : "network";
  mkdirSync(stateDir, { recursive: true });
  const transport = {
    async get(target, opts) {
      appendFileSync(attemptsLog, `${new Date().toISOString()}\t${id}\t${via}\tGET\t${field(shown(new URL(target)))}\n`);
      return inner.get(target, opts);
    },
  };
  const record = (u, verdict, reason) => {
    appendFileSync(availabilityLog, `${new Date().toISOString()}\t${id}\t${via}\t${field(shown(u))}\t${verdict}\t${field(reason)}\n`);
  };

  // 3. robots preflight, recorded whatever it says. A robots.txt redirect is held to the same
  // host binding as the screen (attack r2 B4).
  const check = async (u) => {
    const d = await preflight({ url: u, ua: DEFAULT_UA, transport, guard: outsideHosts });
    record(u, d.verdict, d.reason);
    if (d.verdict !== "ALLOW") fail(Object.hasOwn(EXIT, d.verdict) ? EXIT[d.verdict] : EXIT.UNREADABLE, `${d.verdict} ${field(shown(u))} -- ${field(d.reason)}`);
  };
  await check(url);

  // 4. a row without a principle is not evidence -- judged on the text that would be written,
  // so a principle of control characters alone is empty (attack r2 B7). A staging call writes no
  // row, so it carries none: its only product is an image the curator can look at.
  const principle = field(o["--principle"] || "");
  const avoid = field(o["--avoid"] || "");
  if (!stage && !principle) fail(1, "--principle is required: a row with no adaptable principle is not evidence");
  if (!stage && !avoid) fail(1, "--avoid is required: every row names what not to copy");

  // 5. fetch, following redirects by hand; every hop is bound and preflighted again.
  let current = url;
  let res;
  for (let hop = 0; ; hop++) {
    try { res = await transport.get(current.href); } catch (e) {
      record(current, "FETCH-FAILED", e && e.message ? e.message : "transport error");
      fail(5, `the screen could not be fetched: ${field(e && e.message ? e.message : "transport error")}`);
    }
    if (!(res.status >= 300 && res.status < 400 && res.location)) break;
    if (hop + 1 > MAX_HOPS) { record(current, "FETCH-FAILED", `more than ${MAX_HOPS} redirects`); fail(5, `the screen redirected more than ${MAX_HOPS} times`); }
    let next;
    try { next = parseHttpUrl(new URL(res.location, current.href).href); } catch { next = null; }
    if (!next) { record(current, "FETCH-FAILED", "redirect to a non-http(s) location"); fail(5, "the screen redirected to something that is not an http(s) URL"); }
    if (current.protocol === "https:" && next.protocol === "http:") { record(next, "FETCH-FAILED", "https to http downgrade"); fail(5, `refused: redirect from https to http (${field(shown(next))})`); }
    bind(next);
    await check(next);
    current = next;
  }
  const type = String(res.contentType || "").split(";")[0].trim().toLowerCase();
  // Own keys only: `constructor` or `__proto__` as a content-type must not find an inherited
  // property and pass as an image (attack r2 B2).
  const ext = Object.hasOwn(IMAGE_EXT, type) ? IMAGE_EXT[type] : null;
  const bad = res.tooLarge ? "larger than the size cap"
    : !(res.status >= 200 && res.status < 300) ? `HTTP ${res.status}`
    : !ext ? `not an image (content-type '${type || "none"}')`
    : res.body.length === 0 ? "an empty body"
    : !fake && !MAGIC[ext](res.body) ? `the bytes are not a ${ext} image, whatever the content-type says` : null;
  if (bad) {
    record(current, "FETCH-FAILED", bad);
    fail(5, `the screen was not cached: ${field(bad)}`);
  }
  const sha = createHash("sha256").update(res.body).digest("hex");
  if (stage) {
    // Staged for viewing only: a separate directory the curator may Read, no provenance row, no
    // commit mark. The add that follows fetches again and passes every check again.
    const stagedDir = join(stateDir, "staged");
    const staged = join(stagedDir, `${id}-${sha.slice(0, 16)}.${ext}`);
    if (!resolve(staged).startsWith(resolve(stagedDir) + sep)) fail(1, `refused: the staged path left the staging directory: ${staged}`);
    mkdirSync(stagedDir, { recursive: true });
    // Whole or not at all: a private temp name, then a rename, so a reader never opens a
    // half-written file under a name that promises its sha (staging attack, B9).
    const tmp = `${staged}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, res.body);
    try { renameSync(tmp, staged); } catch (e) { try { unlinkSync(tmp); } catch { /* gone */ } fail(5, `the screen could not be staged: ${field(e.message)}`); }
    console.log(`staged: ${relative(ROOT, staged).split("\\").join("/")} (sha256 ${sha}) -- Read it, then add it with --principle, --avoid and --staged ${sha.slice(0, 16)}`);
    process.exit(0);
  }
  if (o["--staged"] != null && sha.slice(0, 16) !== o["--staged"]) {
    record(current, "FETCH-FAILED", "the screen changed since it was staged");
    fail(5, `refused: the screen fetched now (sha ${sha.slice(0, 16)}) is not the one staged (${o["--staged"]}); stage it again and look again`);
  }
  const image = join(stateDir, `${id}-${sha.slice(0, 16)}.${ext}`);
  if (!resolve(image).startsWith(resolve(stateDir) + sep)) fail(1, `refused: the image path left the pack directory: ${image}`);
  // The path is content-addressed, so the same screen twice lands on the same file. Only an
  // image THIS run created may be removed on a later failure (attack r2 B6).
  const existed = existsSync(image);
  writeFileSync(image, res.body);

  // The header appears complete or not at all: written to a private temp file, then linked into
  // place, so two builders starting one brief cannot truncate or interleave with each other
  // (attack r1 B7, r2 B15). If the row cannot be written, an image this run created goes too.
  try {
    mkdirSync(dirname(sourcesMd), { recursive: true });
    if (!existsSync(sourcesMd)) {
      const tmp = `${sourcesMd}.${process.pid}.${Date.now()}.tmp`;
      writeFileSync(tmp, `# Reference pack -- ${brief}\n\nProvenance only (ADR-1404): the images are cached under \`.claude/state/design/refpacks/${brief}/\` and never committed. Query strings are dropped from every URL.\n\n| url | fetched | sha256 | source | adaptable principle | avoid this |\n|---|---|---|---|---|---|\n`, { flag: "wx" });
      try { linkSync(tmp, sourcesMd); } catch (e) { if (e.code !== "EEXIST") throw e; } finally { try { unlinkSync(tmp); } catch { /* already gone */ } }
    }
    const redirected = current.href === url.href ? "" : ` (redirected from ${shown(url)})`;
    appendFileSync(sourcesMd, `| ${cell(shown(current) + redirected)} | ${new Date().toISOString()} | ${sha} | ${cell(fake ? `${id} (fixture)` : id)} | ${cell(principle)} | ${cell(avoid)} |\n`);
  } catch (e) {
    if (!existed) { try { unlinkSync(image); } catch { /* already gone */ } }
    fail(5, `the provenance row could not be written${existed ? "" : ", so the new image was removed"}: ${field(e.message)}`);
  }

  // Mark sources.md for commit. Only a checkout with no .git at all is outside a work tree; a
  // git that cannot run, or refuses this repo, is a failure to mark, not a reason to skip
  // (attack r2 B5).
  const rel = relative(ROOT, sourcesMd).split("\\").join("/");
  const inTree = spawnSync("git", ["-C", ROOT, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  const isTree = !inTree.error && inTree.status === 0 && String(inTree.stdout).trim() === "true";
  if (!isTree && (inTree.error || existsSync(join(ROOT, ".git")))) {
    fail(6, `${rel} was written but git could not be asked about this checkout (${field(inTree.error ? inTree.error.message : inTree.stderr || `exit ${inTree.status}`)}); add it by hand before the pack is used`);
  }
  if (isTree) {
    let marked = false;
    // Three attempts with a pause: another git holding .git/index.lock fails an add at once, and two adds
    // back to back both lost to it (phase-02 attack G3 B3).
    for (let attempt = 0; attempt < 3 && !marked; attempt++) {
      if (attempt) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 * attempt);
      const r = spawnSync("git", ["-C", ROOT, "add", "-N", "--", rel], { encoding: "utf8" });
      marked = !r.error && r.status === 0;
    }
    if (!marked) fail(6, `${rel} was written but could not be marked for commit (git add -N failed three times); add it by hand before the pack is used`);
  }

  console.log(`added ${field(shown(current))} from ${id} -> ${relative(ROOT, image).split("\\").join("/")} (sha256 ${sha})`);
}

await main(process.argv.slice(2));

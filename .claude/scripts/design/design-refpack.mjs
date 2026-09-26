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

import { appendFileSync, existsSync, linkSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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
const SEAMS = ["--registry", "--robots-file", "--robots-status", "--fixture"];

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
  return String(v).replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
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
    const guard = (u) => (hostAllowed(u.hostname, allHosts) ? null : "is not a registry host");
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

async function main(argv) {
  if (argv[0] === "--check-browse") return checkBrowse(argv);
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
  if (String(src.access) !== "fetch") fail(2, `refused: source '${id}' has access: ${field(src.access)}; this builder only fetches`);

  // 2. host binding. A scratch registry may omit hosts; the real one may not.
  const fake = ["--robots-file", "--robots-status", "--fixture"].some((k) => o[k] != null);
  const hosts = src.hosts === undefined ? null : asList(src.hosts).map((h) => h.toLowerCase());
  if (hosts !== null && (hosts.length === 0 || !hosts.every((h) => HOST.test(h)))) {
    fail(2, `refused: source '${id}' has a hosts list that is empty or not bare host names`);
  }
  if (hosts === null && !fake) fail(2, `refused: source '${id}' names no hosts, so a URL cannot be bound to it; the owner adds hosts to its registry row`);
  const outsideHosts = (u) => (hosts !== null && !hostAllowed(u.hostname, hosts) ? `is not one of source '${id}' hosts [${hosts.join(", ")}]` : null);
  const bind = (u) => {
    const why = outsideHosts(u);
    if (why) fail(2, `refused: ${u.hostname} ${why}`);
  };
  bind(url);

  // Every attempt is written BEFORE it is made, so a crash mid-request still counts.
  const inner = fake
    ? fakeTransport({ robotsFile: o["--robots-file"] ?? null, robotsStatus: o["--robots-status"] ?? null, fixture: o["--fixture"] ?? null })
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
    if (d.verdict !== "ALLOW") fail(EXIT[d.verdict], `${d.verdict} ${field(shown(u))} -- ${field(d.reason)}`);
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
    for (let attempt = 0; attempt < 2 && !marked; attempt++) {
      const r = spawnSync("git", ["-C", ROOT, "add", "-N", "--", rel], { encoding: "utf8" });
      marked = !r.error && r.status === 0;
    }
    if (!marked) fail(6, `${rel} was written but could not be marked for commit (git add -N failed twice); add it by hand before the pack is used`);
  }

  console.log(`added ${field(shown(current))} from ${id} -> ${relative(ROOT, image).split("\\").join("/")} (sha256 ${sha})`);
}

await main(process.argv.slice(2));

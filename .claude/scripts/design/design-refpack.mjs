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
// Exit:   0 added | 1 usage or unreadable registry | 2 registry or host refusal | 3 DISALLOW |
//         4 UNREADABLE | 5 the screen fetch failed | 6 written but not marked for commit

import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
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
const IMAGE_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif" };
const MAX_HOPS = 3;
const SEAMS = ["--registry", "--robots-file", "--robots-status", "--fixture"];

function fail(code, msg) {
  console.error(`design-refpack: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const known = new Set(["--brief", "--source", "--url", "--principle", "--avoid", ...SEAMS]);
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

async function main(argv) {
  const o = parseArgs(argv);
  for (const k of ["--brief", "--source", "--url"]) if (!o[k]) fail(1, `${k} is required`);
  const brief = o["--brief"];
  const id = o["--source"];
  if (!validId(brief)) fail(1, `--brief must match ${ID} and not be a reserved device name, got '${field(brief)}'`);
  if (!validId(id)) fail(1, `--source must match ${ID} and not be a reserved device name, got '${field(id)}'`);
  const url = parseHttpUrl(o["--url"]);
  if (!url) fail(1, `--url must be an http(s) URL with a host, got '${field(o["--url"])}'`);
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
  const bind = (u) => {
    if (hosts !== null && !hostAllowed(u.hostname, hosts)) {
      fail(2, `refused: ${u.hostname} is not one of source '${id}' hosts [${hosts.join(", ")}]`);
    }
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
      appendFileSync(attemptsLog, `${new Date().toISOString()}\t${id}\t${via}\tGET\t${field(target)}\n`);
      return inner.get(target, opts);
    },
  };
  const record = (u, verdict, reason) => {
    appendFileSync(availabilityLog, `${new Date().toISOString()}\t${id}\t${via}\t${field(u.href)}\t${verdict}\t${field(reason)}\n`);
  };

  // 3. robots preflight, recorded whatever it says.
  const check = async (u) => {
    const d = await preflight({ url: u, ua: DEFAULT_UA, transport });
    record(u, d.verdict, d.reason);
    if (d.verdict !== "ALLOW") fail(EXIT[d.verdict], `${d.verdict} ${field(u.href)} -- ${field(d.reason)}`);
  };
  await check(url);

  // 4. a row without a principle is not evidence.
  const principle = (o["--principle"] || "").trim();
  const avoid = (o["--avoid"] || "").trim();
  if (!principle) fail(1, "--principle is required: a row with no adaptable principle is not evidence");
  if (!avoid) fail(1, "--avoid is required: every row names what not to copy");

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
    if (current.protocol === "https:" && next.protocol === "http:") { record(next, "FETCH-FAILED", "https to http downgrade"); fail(5, `refused: redirect from https to http (${field(next.href)})`); }
    bind(next);
    await check(next);
    current = next;
  }
  const type = String(res.contentType || "").split(";")[0].trim().toLowerCase();
  const ext = IMAGE_EXT[type];
  const bad = res.tooLarge ? "larger than the size cap"
    : !(res.status >= 200 && res.status < 300) ? `HTTP ${res.status}`
    : !ext ? `not an image (content-type '${type || "none"}')`
    : res.body.length === 0 ? "an empty body" : null;
  if (bad) {
    record(current, "FETCH-FAILED", bad);
    fail(5, `the screen was not cached: ${field(bad)}`);
  }
  const sha = createHash("sha256").update(res.body).digest("hex");
  const image = join(stateDir, `${id}-${sha.slice(0, 16)}.${ext}`);
  if (!resolve(image).startsWith(resolve(stateDir) + sep)) fail(1, `refused: the image path left the pack directory: ${image}`);
  writeFileSync(image, res.body);

  // The header is created exclusively, so two builders starting one brief cannot truncate each
  // other's first row (B7). If the row cannot be written, the image does not stay behind.
  try {
    mkdirSync(dirname(sourcesMd), { recursive: true });
    try {
      writeFileSync(sourcesMd, `# Reference pack -- ${brief}\n\nProvenance only (ADR-1404): the images are cached under \`.claude/state/design/refpacks/${brief}/\` and never committed. Query strings are dropped from every URL.\n\n| url | fetched | sha256 | source | adaptable principle | avoid this |\n|---|---|---|---|---|---|\n`, { flag: "wx" });
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    const shown = `${current.origin}${current.pathname}`;
    const redirected = current.href === url.href ? "" : ` (redirected from ${url.origin}${url.pathname})`;
    appendFileSync(sourcesMd, `| ${cell(shown + redirected)} | ${new Date().toISOString()} | ${sha} | ${cell(fake ? `${id} (fixture)` : id)} | ${cell(principle)} | ${cell(avoid)} |\n`);
  } catch (e) {
    try { unlinkSync(image); } catch { /* already gone */ }
    fail(5, `the provenance row could not be written, so the image was removed: ${field(e.message)}`);
  }

  // Mark sources.md for commit. Outside a git work tree there is nothing to mark.
  const rel = relative(ROOT, sourcesMd).split("\\").join("/");
  const inTree = spawnSync("git", ["-C", ROOT, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  if (inTree.status === 0 && String(inTree.stdout).trim() === "true") {
    let marked = false;
    for (let attempt = 0; attempt < 2 && !marked; attempt++) {
      const r = spawnSync("git", ["-C", ROOT, "add", "-N", "--", rel], { encoding: "utf8" });
      marked = !r.error && r.status === 0;
    }
    if (!marked) fail(6, `${rel} was written but could not be marked for commit (git add -N failed twice); add it by hand before the pack is used`);
  }

  console.log(`added ${field(current.href)} from ${id} -> ${relative(ROOT, image).split("\\").join("/")} (sha256 ${sha})`);
}

await main(process.argv.slice(2));

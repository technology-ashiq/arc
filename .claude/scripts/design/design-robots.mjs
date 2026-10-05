#!/usr/bin/env node
// design-robots.mjs -- the robots.txt preflight every reference-pack fetch passes (REQ-04,
// ADR-1412). Phase 02 slice B.
//
// THREE answers, kept apart on purpose (ADR-1412 paid for collapsing them once):
//
//   ALLOW       their robots.txt permits the path, or there is none (404/410 -- the standard's
//               answer, RFC 9309 2.3.1.3, not a guess)
//   DISALLOW    their robots.txt refuses the path for our user agent
//   UNREADABLE  we could not read their robots.txt, or could not read it all the way through a
//               rule. land-book answers robots.txt ITSELF with a 403. Unknown permission is not
//               permission, and it is not their refusal either: reported as a refusal it would
//               harden "we could not check" into "they said no". So the UNREADABLE text never
//               uses the word for a refusal.
//
// Matching follows RFC 9309: the group naming our product token beats `*`, groups naming the
// same agent merge, the longest matching rule wins, and Allow wins a tie. `*` and `$` are
// honoured by a linear matcher, never a regex: the rules are remote text, and a regex built from
// them backtracks for as long as the remote likes (attack r1 B5). Both sides are percent-encoding
// normalised before they are compared, or `%c3%a9` slips past `Disallow: /café/` (B6).
//
// The network sits behind a transport (offline-first): `fakeTransport` serves a robots file, a
// status and a fixture from disk; `realTransport` is node's fetch with manual redirects, a
// streamed byte cap and a refusal of private addresses. design-refpack.mjs wraps either one to
// record every attempt.
//
// Usage:  design-robots.mjs --url <http(s) url> [--ua <agent>] [--robots-file <path> | --robots-status <n>]
// Exit:   0 ALLOW | 3 DISALLOW | 4 UNREADABLE | 1 usage. The default agent is ClaudeBot: arc
//         runs on Claude, and ADR-1412's sources name ClaudeBot directly.

import { readFileSync, realpathSync } from "node:fs";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP, isIPv4 } from "node:net";
import { fileURLToPath } from "node:url";

export const DEFAULT_UA = "ClaudeBot";
export const EXIT = { ALLOW: 0, DISALLOW: 3, UNREADABLE: 4 };

// RFC 9309 asks a parser to read at least 500 KiB; the rest is not read, and not waited for.
export const ROBOTS_MAX_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 15000;
// Total matcher steps for one decision. Real files use a few thousand.
const MATCH_STEPS = 20_000_000;
const ROBOTS_MAX_HOPS = 5;
// Past these the matcher's cost is the remote's choice. A rule or a path over the limit makes
// the answer UNREADABLE -- never a skipped rule, because skipping a Disallow is an ALLOW.
const RULE_MAX_LEN = 1024;
const PATH_MAX_LEN = 8192;

// An http(s) URL with a host, or null. A bare word or another scheme is not something a
// preflight can answer for.
export function parseHttpUrl(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname) return null;
  return u;
}

// The product token: "ClaudeBot/1.0 (+https://...)" matches a group written "claudebot".
function productToken(ua) {
  return String(ua).trim().split(/[\s/]/)[0].toLowerCase();
}

const UNRESERVED = /^[A-Za-z0-9._~-]$/;
// One spelling per path: non-ASCII and controls become %XX, hex is upper-case, and an encoded
// unreserved character is decoded. Applied to the rule and to the URL alike.
export function normPath(s) {
  const bytes = Buffer.from(String(s), "utf8");
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x25 && i + 2 < bytes.length) {
      const hex = String.fromCharCode(bytes[i + 1], bytes[i + 2]);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        const v = parseInt(hex, 16);
        const c = String.fromCharCode(v);
        out += v < 0x80 && UNRESERVED.test(c) ? c : "%" + hex.toUpperCase();
        i += 2;
        continue;
      }
    }
    out += b < 0x21 || b > 0x7e ? "%" + b.toString(16).toUpperCase().padStart(2, "0") : String.fromCharCode(b);
  }
  return out;
}

// Groups as RFC 9309 defines them: one or more user-agent lines, then rules. A user-agent line
// after a rule starts a new group; lines the grammar does not know (sitemap, crawl-delay) end
// nothing and are skipped.
export function parseRobots(text) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const rawLine of String(text).split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (!cur) continue; // a rule before any user-agent line belongs to no group
      // An empty Disallow means "nothing is disallowed" -- it is no rule, not a match-all.
      if (value === "") continue;
      cur.rules.push({ allow: key === "allow", path: value, line: `${key === "allow" ? "Allow" : "Disallow"}: ${value}` });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

// `*` matches any run, a trailing `$` anchors the end, and otherwise the rule is a prefix.
// Two pointers with one saved star: O(pattern x path) at worst, never exponential.
// `budget` is shared by every rule one decision tries: a 512 KiB file packs ~500 near-max rules, each a million-step
// worst case, so one per-call bound still let one URL check cost billions (phase-02 attack G2 B2). Out of steps is null.
export function globMatch(rulePath, path, budget = null) {
  let pat = rulePath;
  let anchored = false;
  if (pat.endsWith("$")) { anchored = true; pat = pat.slice(0, -1); }
  if (!anchored) pat += "*";
  let p = 0, i = 0, starP = -1, starI = 0;
  while (i < path.length) {
    if (budget && --budget.left < 0) return null;
    if (p < pat.length && pat[p] !== "*" && pat[p] === path[i]) { p++; i++; }
    else if (p < pat.length && pat[p] === "*") { starP = p++; starI = i; }
    else if (starP !== -1) { p = starP + 1; i = ++starI; }
    else return false;
  }
  while (p < pat.length && pat[p] === "*") p++;
  return p === pat.length;
}

// The decision for one URL, from a robots.txt body. Pure: no I/O.
export function decide(robotsText, url, ua = DEFAULT_UA) {
  const u = typeof url === "string" ? parseHttpUrl(url) : url;
  const path = normPath((u.pathname || "/") + (u.search || ""));
  if (path.length > PATH_MAX_LEN) return { verdict: "UNREADABLE", reason: `the URL path is longer than ${PATH_MAX_LEN} bytes; not checked` };
  const groups = parseRobots(robotsText);
  const token = productToken(ua);
  let chosen = groups.filter((g) => g.agents.includes(token));
  let groupName = token;
  if (chosen.length === 0) { chosen = groups.filter((g) => g.agents.includes("*")); groupName = "*"; }
  let best = null;
  const budget = { left: MATCH_STEPS };
  for (const r of chosen.flatMap((g) => g.rules)) {
    const rp = normPath(r.path);
    if (rp.length > RULE_MAX_LEN) return { verdict: "UNREADABLE", reason: `a rule in group "${groupName}" is longer than ${RULE_MAX_LEN} bytes; the file was not read through` };
    const m = globMatch(rp, path, budget);
    if (m === null) return { verdict: "UNREADABLE", reason: `matching group "${groupName}" took more than ${MATCH_STEPS} steps; the file was not read through` };
    if (!m) continue;
    if (!best || rp.length > best.len || (rp.length === best.len && r.allow && !best.allow)) best = { ...r, len: rp.length };
  }
  if (!best) {
    return { verdict: "ALLOW", reason: chosen.length ? `no rule in group "${groupName}" matches ${path}` : "no group applies to this agent" };
  }
  if (best.allow) return { verdict: "ALLOW", reason: `rule "${best.line}" in group "${groupName}"`, rule: best.line };
  return { verdict: "DISALLOW", reason: `rule "${best.line}" in group "${groupName}"`, rule: best.line };
}

// ---------- transports: the one place the network is touched ----------
//
// get(target, { maxBytes, truncate }) -> { status, body, contentType, location, tooLarge, truncated }
// Redirects are NOT followed by a transport: a 3xx comes back with its location, and the caller
// decides whether the next hop may be fetched at all (attack r1 B3).

// Serves robots.txt and one screen from disk. `robotsFile` alone is a 200; `robotsStatus` alone
// is a bodiless status; with neither, robots.txt is a 404.
// `redirect`: every screen request that is not already for that URL answers 302 to it, so a test can drive a hop.
export function fakeTransport({ robotsFile = null, robotsStatus = null, fixture = null, redirect = null } = {}) {
  return {
    fake: true,
    async get(target) {
      const u = new URL(target);
      if (u.pathname === "/robots.txt") {
        const status = robotsStatus != null ? Number(robotsStatus) : robotsFile ? 200 : 404;
        const body = robotsFile && status >= 200 && status < 300 ? readFileSync(robotsFile) : Buffer.alloc(0);
        return { status, body, contentType: "text/plain" };
      }
      if (redirect && u.href !== new URL(redirect).href) return { status: 302, body: Buffer.alloc(0), contentType: "", location: redirect };
      if (!fixture) return { status: 404, body: Buffer.alloc(0), contentType: "" };
      return { status: 200, body: readFileSync(fixture), contentType: "image/png" };
    },
  };
}

function privateV4(x, y) {
  return x === 0 || x === 10 || x === 127 || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31)
    || (x === 192 && y === 168) || (x === 100 && y >= 64 && y <= 127) || x >= 224;
}

// Eight 16-bit groups, or null. Handles `::` and a trailing dotted quad.
function ipv6Groups(a) {
  // A trailing dotted quad becomes its two hex groups, so one parser handles both spellings.
  let bad = false;
  const s = a.replace(/(\d+\.\d+\.\d+\.\d+)$/, (q) => {
    if (!isIPv4(q)) { bad = true; return q; }
    const o = q.split(".").map(Number);
    return ((o[0] << 8) | o[1]).toString(16) + ":" + ((o[2] << 8) | o[3]).toString(16);
  });
  if (bad) return null;
  const parts = s.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const rest = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const known = head.length + rest.length;
  if ((parts.length === 1 && known !== 8) || known > 8) return null;
  const fill = parts.length === 2 ? new Array(8 - known).fill("0") : [];
  const groups = [...head, ...fill, ...rest].map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
  return groups.length === 8 && groups.every((n) => Number.isInteger(n)) ? groups : null;
}

// Loopback, private, link-local, CGNAT, multicast and unspecified -- nothing a gallery lives on.
// An IPv6 address that carries an IPv4 one (mapped, compatible, NAT64, 6to4) is judged by the
// IPv4 it carries, in whatever spelling the URL parser chose (attack r2 B3: `[::ffff:7f00:1]`).
// Anything that cannot be parsed is treated as private.
export function isPrivateAddress(ip) {
  const a = String(ip).toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (isIPv4(a)) {
    const [x, y] = a.split(".").map(Number);
    return privateV4(x, y);
  }
  const g = ipv6Groups(a);
  if (!g) return true;
  // The embedded IPv4's first two octets are the high group; that is all privateV4 reads.
  const v4 = (hi) => privateV4(hi >> 8, hi & 0xff);
  const zero = (from, to) => g.slice(from, to).every((n) => n === 0);
  if (zero(0, 5) && g[5] === 0xffff) return v4(g[6], g[7]);                       // ::ffff:a.b.c.d
  if (zero(0, 6)) return (g[6] === 0 && (g[7] === 0 || g[7] === 1)) || v4(g[6], g[7]); // ::, ::1, ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && zero(2, 6)) return v4(g[6], g[7]);       // NAT64
  if (g[0] === 0x2002) return v4(g[1], g[2]);                                      // 6to4
  return (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00;
}

// The check runs INSIDE the socket's own lookup, so the address that was checked is the address
// that is connected to. A separate check-then-fetch resolved twice, and a host that rebinds its
// DNS between the two passed the check and connected to 127.0.0.1 (attack r1 B1, phase-02 logic
// pass). \`resolve\` is dns.lookup unless a test injects one.
export function checkedLookup(resolve = lookup) {
  return (hostname, options, cb) => {
    if (typeof options === "function") { cb = options; options = {}; }
    const host = String(hostname).replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost")) { cb(new Error(`refused: ${host} is a local name`)); return; }
    Promise.resolve(resolve(host, { all: true })).then((addrs) => {
      if (!Array.isArray(addrs) || addrs.length === 0) { cb(new Error(`refused: ${host} did not resolve`)); return; }
      for (const { address } of addrs) if (isPrivateAddress(address)) { cb(new Error(`refused: ${host} resolves to a private address`)); return; }
      const all = addrs.map(({ address, family }) => ({ address, family: family || (isIPv4(address) ? 4 : 6) }));
      if (options && options.all) cb(null, all); else cb(null, all[0].address, all[0].family);
    }, (e) => cb(e));
  };
}

export function realTransport({ ua = DEFAULT_UA, resolve = lookup } = {}) {
  const pinned = checkedLookup(resolve);
  return {
    fake: false,
    get(target, { maxBytes = 15 * 1024 * 1024, truncate = false } = {}) {
      const u = new URL(target);
      const host = u.hostname.replace(/^\[|\]$/g, "");
      // node skips the lookup for an IP literal, so a literal is checked here, on the value used.
      if (isIP(host) && isPrivateAddress(host)) return Promise.reject(new Error(`refused: ${host} is a private address`));
      return new Promise((resolveGet, reject) => {
        let settled = false;
        const settle = (fn, v) => { if (!settled) { settled = true; clearTimeout(timer); fn(v); } };
        const send = u.protocol === "https:" ? httpsRequest : httpRequest;
        // Redirects are never followed here: the caller walks each hop through its own gates.
        const req = send(u, { method: "GET", headers: { "user-agent": ua, "accept-encoding": "identity" }, lookup: pinned }, (res) => {
          // Stream, and stop at the cap: a body with no content-length must not be buffered whole.
          const chunks = [];
          let total = 0, tooLarge = false, truncated = false;
          const done = () => settle(resolveGet, { status: res.statusCode, body: tooLarge ? Buffer.alloc(0) : Buffer.concat(chunks), contentType: String(res.headers["content-type"] || ""), location: res.headers.location ?? null, tooLarge, truncated });
          res.on("data", (value) => {
            if (settled) return;
            if (total + value.length > maxBytes) {
              if (truncate) { chunks.push(value.subarray(0, maxBytes - total)); total = maxBytes; truncated = true; }
              else tooLarge = true;
              done();
              req.destroy();
              return;
            }
            chunks.push(value);
            total += value.length;
          });
          res.on("end", done);
          res.on("error", (e) => settle(reject, e));
        });
        // One deadline for the whole request, not a socket idle timer.
        const timer = setTimeout(() => req.destroy(new Error(`timed out after ${FETCH_TIMEOUT_MS} ms`)), FETCH_TIMEOUT_MS);
        req.on("error", (e) => settle(reject, e));
        req.end();
      });
    },
  };
}

// Fetch the origin's robots.txt through `transport` and decide. Never throws: a transport
// failure is UNREADABLE, because an error is not an answer from them. robots.txt redirects are
// followed up to five hops (RFC 9309 2.3.1.2); the body past 512 KiB is not read (B1).
//
// `guard(url)` is asked about every redirect hop and returns null or a reason; a refused hop is
// UNREADABLE (attack r2 B4). design-refpack.mjs passes its host binding and downgrade check.
export async function preflight({ url, ua = DEFAULT_UA, transport, guard = null }) {
  const u = typeof url === "string" ? parseHttpUrl(url) : url;
  let target = `${u.protocol}//${u.host}/robots.txt`;
  let res;
  for (let hop = 0; ; hop++) {
    try { res = await transport.get(target, { maxBytes: ROBOTS_MAX_BYTES, truncate: true }); } catch (e) {
      return { verdict: "UNREADABLE", reason: `robots.txt could not be fetched (${e && e.message ? e.message : "transport error"}); permission unknown` };
    }
    const s = Number(res.status);
    if (s < 300 || s >= 400 || !res.location) break;
    if (hop + 1 > ROBOTS_MAX_HOPS) return { verdict: "UNREADABLE", reason: `robots.txt redirected more than ${ROBOTS_MAX_HOPS} times; permission unknown` };
    let next;
    try { next = parseHttpUrl(new URL(res.location, target).href); } catch { next = null; }
    if (!next) return { verdict: "UNREADABLE", reason: "robots.txt redirected to something that is not an http(s) URL; permission unknown" };
    if (new URL(target).protocol === "https:" && next.protocol === "http:") {
      return { verdict: "UNREADABLE", reason: "robots.txt redirected from https to http; permission unknown" };
    }
    const why = guard ? guard(next) : null;
    if (why) return { verdict: "UNREADABLE", reason: `robots.txt redirected to ${next.host}, which ${why}; permission unknown` };
    target = next.href;
  }
  const s = Number(res.status);
  if (res.tooLarge) return { verdict: "UNREADABLE", reason: "robots.txt could not be read within the byte cap; permission unknown" };
  if (s === 404 || s === 410) return { verdict: "ALLOW", reason: `robots.txt returned ${s}: no robots.txt is permission (RFC 9309)` };
  if (s >= 200 && s < 300) {
    // A WAF interstitial or an SPA fallback page answers 200 with HTML. Parsed as robots it has
    // no groups, which would read as ALLOW (attack r2 B8). So a 2xx must be plain text, and a
    // non-empty body must carry at least one directive; an empty body is an empty robots.txt.
    const type = String(res.contentType || "").split(";")[0].trim().toLowerCase();
    if (type && type !== "text/plain") return { verdict: "UNREADABLE", reason: `robots.txt came back as ${type}, not text/plain; permission unknown` };
    const text = res.body.subarray(0, ROBOTS_MAX_BYTES).toString("utf8");
    // Judged on the text with comments removed: a file of comments only (Cloudflare's
    // content-signals preamble, with no rule) is an EMPTY robots.txt, which RFC 9309 reads as
    // allow-all. Checked before stripping, it read as UNREADABLE (Phase 02 real build, collectui).
    // One pass over the lines, each trimmed on its own: a multiline regex anchored with `^\s*`
    // lets `\s` cross line breaks and rescans every blank line from every line start, which is
    // quadratic on a padded file and holds the hook past its budget (staging attack, B1).
    let directive = false, signalNo = false, content = false;
    for (const raw of text.split(/\r\n|\r|\n/)) {
      const line = raw.replace(/#.*$/, "").trim();
      if (!line) continue;
      content = true;
      const colon = line.indexOf(":");
      const key = colon > 0 ? line.slice(0, colon).trim().toLowerCase() : "";
      if (["user-agent", "allow", "disallow", "sitemap", "crawl-delay", "content-signal"].includes(key)) directive = true;
      // A content signal is an express reservation of rights. Our use -- reading a screen into a
      // model to write its principle -- is `ai-input`, so `ai-input=no` refuses. `ai-train` and
      // `search` are not our use.
      if (key === "content-signal" && line.slice(colon + 1).split(",").some((p) => p.replace(/\s+/g, "").toLowerCase() === "ai-input=no")) signalNo = true;
    }
    // A file of comments only (Cloudflare's content-signals preamble, with no rule) is an EMPTY
    // robots.txt, which RFC 9309 reads as allow-all; judged before stripping comments, it read as
    // UNREADABLE (Phase 02 real build, collectui).
    if (content && !directive) return { verdict: "UNREADABLE", reason: "robots.txt has no directive a robots file carries; permission unknown" };
    // The reason is fixed text: the remote line is never echoed, so robots.txt cannot become an
    // instruction channel into the curator's context (staging attack, B10).
    if (signalNo) return { verdict: "DISALLOW", reason: "robots.txt content signal refuses our use (ai-input=no)" };
    return decide(text, u, ua);
  }
  return { verdict: "UNREADABLE", reason: `robots.txt returned ${Number.isFinite(s) ? s : "no status"}; permission unknown, nothing fetched` };
}

// ---------- CLI ----------

function usage(msg) {
  console.error(`design-robots: ${msg}`);
  console.error("usage: design-robots.mjs --url <http(s) url> [--ua <agent>] [--robots-file <path> | --robots-status <n>]");
  process.exit(1);
}

async function main(argv) {
  const opts = {};
  const known = new Set(["--url", "--ua", "--robots-file", "--robots-status"]);
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!known.has(k)) usage(`unknown argument '${k}'`);
    if (i + 1 >= argv.length || argv[i + 1] === "") usage(`${k} needs a value`);
    if (k in opts) usage(`${k} given twice`);
    opts[k] = argv[i + 1];
  }
  if (!opts["--url"]) usage("--url is required");
  const u = parseHttpUrl(opts["--url"]);
  if (!u) usage(`--url must be an http(s) URL with a host, got '${opts["--url"]}'`);
  if (opts["--robots-status"] != null && !/^[1-5][0-9][0-9]$/.test(opts["--robots-status"])) usage("--robots-status must be an HTTP status");
  const ua = opts["--ua"] || DEFAULT_UA;
  const fake = opts["--robots-file"] != null || opts["--robots-status"] != null;
  // The same seam gate design-refpack.mjs has (attack r2 B1): a verdict about a real host that
  // no request reached must not be printable without saying so.
  if (fake && process.env.ARC_DESIGN_OFFLINE !== "1") usage("--robots-file and --robots-status are test seams; set ARC_DESIGN_OFFLINE=1 to use them");
  const transport = fake ? fakeTransport({ robotsFile: opts["--robots-file"] ?? null, robotsStatus: opts["--robots-status"] ?? null }) : realTransport({ ua });
  const d = await preflight({ url: u, ua, transport });
  console.log(`${d.verdict} ${u.origin}${u.pathname} -- ${d.reason}${fake ? " (fixture)" : ""}`);
  process.exitCode = Object.hasOwn(EXIT, d.verdict) ? EXIT[d.verdict] : EXIT.UNREADABLE;
}

const isMain = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) await main(process.argv.slice(2));

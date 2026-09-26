#!/usr/bin/env node
// design-robots.mjs -- the robots.txt preflight every reference-pack fetch passes (REQ-04,
// ADR-1412). Phase 02 slice B.
//
// THREE answers, kept apart on purpose (ADR-1412 paid for collapsing them once):
//
//   ALLOW       their robots.txt permits the path, or there is none (404/410 -- the standard's
//               answer, RFC 9309 2.3.1.3, not a guess)
//   DISALLOW    their robots.txt refuses the path for our user agent
//   UNREADABLE  we could not read their robots.txt at all. land-book answers robots.txt ITSELF
//               with a 403. Unknown permission is not permission, and it is not their refusal
//               either: reported as a refusal it would harden "we could not check" into "they
//               said no" and the source would never be reconsidered. So the UNREADABLE text
//               never uses the word for a refusal.
//
// Matching follows RFC 9309: the group naming our product token beats `*`, groups naming the
// same agent merge, the longest matching rule wins, and Allow wins a tie. `*` and `$` are honoured.
//
// The network sits behind a transport (offline-first): `fakeTransport` serves a robots file, a
// status and a fixture from disk; `realTransport` is node's fetch. design-refpack.mjs wraps
// either one to record every attempt.
//
// Usage:  design-robots.mjs --url <http(s) url> [--ua <agent>] [--robots-file <path> | --robots-status <n>]
// Exit:   0 ALLOW | 3 DISALLOW | 4 UNREADABLE | 1 usage. The default agent is ClaudeBot: arc
//         runs on Claude, and ADR-1412's sources name ClaudeBot directly.

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DEFAULT_UA = "ClaudeBot";
export const EXIT = { ALLOW: 0, DISALLOW: 3, UNREADABLE: 4 };

// RFC 9309 asks a parser to read at least 500 KiB. Anything past that is not read.
const ROBOTS_MAX_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 15000;

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

// Does one rule path (with `*` and a trailing `$`) match this path?
function ruleMatches(rulePath, path) {
  let pat = rulePath;
  let anchored = false;
  if (pat.endsWith("$")) { anchored = true; pat = pat.slice(0, -1); }
  const re = "^" + pat.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : "");
  return new RegExp(re).test(path);
}

// The decision for one URL, from a robots.txt body. Pure: no I/O.
export function decide(robotsText, url, ua = DEFAULT_UA) {
  const u = typeof url === "string" ? parseHttpUrl(url) : url;
  const path = (u.pathname || "/") + (u.search || "");
  const groups = parseRobots(robotsText);
  const token = productToken(ua);
  let chosen = groups.filter((g) => g.agents.includes(token));
  let groupName = token;
  if (chosen.length === 0) { chosen = groups.filter((g) => g.agents.includes("*")); groupName = "*"; }
  const rules = chosen.flatMap((g) => g.rules);
  let best = null;
  for (const r of rules) {
    if (!ruleMatches(r.path, path)) continue;
    const len = r.path.length;
    if (!best || len > best.path.length || (len === best.path.length && r.allow && !best.allow)) best = r;
  }
  if (!best) {
    return { verdict: "ALLOW", reason: chosen.length ? `no rule in group "${groupName}" matches ${path}` : "no group applies to this agent" };
  }
  if (best.allow) return { verdict: "ALLOW", reason: `rule "${best.line}" in group "${groupName}"`, rule: best.line };
  return { verdict: "DISALLOW", reason: `rule "${best.line}" in group "${groupName}"`, rule: best.line };
}

// ---------- transports: the one place the network is touched ----------

// Serves robots.txt and one screen from disk. `robotsFile` alone is a 200; `robotsStatus` alone
// is a bodiless status; with neither, robots.txt is a 404.
export function fakeTransport({ robotsFile = null, robotsStatus = null, fixture = null } = {}) {
  return {
    async get(target) {
      const u = new URL(target);
      if (u.pathname === "/robots.txt") {
        const status = robotsStatus != null ? Number(robotsStatus) : robotsFile ? 200 : 404;
        const body = robotsFile && status >= 200 && status < 300 ? readFileSync(robotsFile) : Buffer.alloc(0);
        return { status, body, contentType: "text/plain" };
      }
      if (!fixture) return { status: 404, body: Buffer.alloc(0), contentType: "" };
      return { status: 200, body: readFileSync(fixture), contentType: "image/png" };
    },
  };
}

export function realTransport({ ua = DEFAULT_UA, maxBytes = 15 * 1024 * 1024 } = {}) {
  return {
    async get(target) {
      const res = await fetch(target, { headers: { "user-agent": ua }, redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      const declared = Number(res.headers.get("content-length") || 0);
      if (declared > maxBytes) return { status: res.status, body: Buffer.alloc(0), contentType: res.headers.get("content-type") || "", tooLarge: true };
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length > maxBytes) return { status: res.status, body: Buffer.alloc(0), contentType: res.headers.get("content-type") || "", tooLarge: true };
      return { status: res.status, body, contentType: res.headers.get("content-type") || "" };
    },
  };
}

// Fetch the origin's robots.txt through `transport` and decide. Never throws: a transport
// failure is UNREADABLE, because an error is not an answer from them.
export async function preflight({ url, ua = DEFAULT_UA, transport }) {
  const u = typeof url === "string" ? parseHttpUrl(url) : url;
  const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
  let res;
  try { res = await transport.get(robotsUrl); } catch (e) {
    return { verdict: "UNREADABLE", reason: `robots.txt could not be fetched (${e && e.message ? e.message : "transport error"}); permission unknown` };
  }
  const s = Number(res.status);
  if (s === 404 || s === 410) return { verdict: "ALLOW", reason: `robots.txt returned ${s}: no robots.txt is permission (RFC 9309)` };
  if (s >= 200 && s < 300) return decide(res.body.subarray(0, ROBOTS_MAX_BYTES).toString("utf8"), u, ua);
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
  const transport = fake ? fakeTransport({ robotsFile: opts["--robots-file"] ?? null, robotsStatus: opts["--robots-status"] ?? null }) : realTransport({ ua });
  const d = await preflight({ url: u, ua, transport });
  console.log(`${d.verdict} ${u.href} -- ${d.reason}`);
  process.exit(EXIT[d.verdict]);
}

const isMain = (() => {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
})();
if (isMain) await main(process.argv.slice(2));

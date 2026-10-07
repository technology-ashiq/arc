#!/usr/bin/env node
/**
 * arc-doctor.mjs -- read an install's truth back, not its intent (distribute DST-E, REQ-07, REQ-09).
 *
 *   node .claude/scripts/engine/arc-doctor.mjs --repo [--repo-slug OWNER/NAME]
 *        [--protection-json FILE] [--checkruns-json FILE]
 *
 * `--repo` is REQ-09's witness: it reads main's branch protection back from GitHub and prints the five
 * ADR-2015 settings, one line each, as `ok`, `MISSING` or `UNKNOWN (reason)`. A 404 "Branch not
 * protected" is a readable answer, so it prints five MISSING. Anything it cannot read prints UNKNOWN and
 * exits 2, never `ok`. It then compares the required contexts with the check-run names of the newest
 * pull request, and names each required context nothing reports as `STALE-CONTEXT: <name>`, because a
 * required check that never reports locks every merge (ADR-2015 consequences).
 *
 * The two JSON flags are the fakes. Without them it calls `gh api` (read-only GETs).
 * Install doctor (placed / degraded / missing / unmanaged-conflict) is added here in Phase 03.
 *
 * Exit: 0 all ok · 1 any MISSING or STALE-CONTEXT · 2 any UNKNOWN / usage. Last line: `RAN doctor-repo`.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SETTINGS = ["strict-checks", "required-checks", "enforce-admins", "no-force-push", "no-deletion"];

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function originSlug() {
  const url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(url);
  if (!m) throw new Error(`origin is not a GitHub remote: ${url}`);
  return `${m[1]}/${m[2]}`;
}

/** {state: "protected"|"unprotected", body} or throws (unreadable). */
function readProtection(file, slug) {
  let text;
  if (file) text = readFileSync(file, "utf8");
  else {
    try { text = gh(["api", `repos/${slug}/branches/main/protection`]); }
    catch (e) { text = String(e.stdout || ""); if (!/Branch not protected/.test(text)) throw new Error(`gh api failed: ${String(e.stderr || e.message).trim().slice(0, 200)}`); }
  }
  const body = JSON.parse(text);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("the answer is not an object");
  const isProtection = "required_status_checks" in body || "enforce_admins" in body;
  // Unprotected only on GitHub's exact 404 shape; a body that ALSO carries protection keys is read as
  // protection, never waved through as "not protected" (attack 4f5dfc7 L8).
  if (!isProtection && body.message === "Branch not protected" && String(body.status) === "404") return { state: "unprotected", body };
  if (!isProtection) throw new Error("the answer is not a branch-protection object");
  // A protection object with a malformed field is unreadable, not "missing" (attack 7c55982 L6).
  const objOrNull = (v) => v === undefined || v === null || (typeof v === "object" && !Array.isArray(v));
  for (const k of ["required_status_checks", "enforce_admins", "allow_force_pushes", "allow_deletions"]) {
    if (!objOrNull(body[k])) throw new Error(`${k} is not an object`);
  }
  return { state: "protected", body };
}

function readCheckRuns(file, slug) {
  if (file) {
    const v = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || x.trim() === "")) throw new Error("check-runs fixture is not a list of non-empty names");
    return v;
  }
  // The union over the newest three PRs, so one PR whose run was skipped or cancelled cannot report a
  // live check as stale (attack 4f5dfc7 B10).
  const heads = gh(["pr", "list", "--repo", slug, "--state", "all", "--limit", "3", "--json", "headRefOid", "--jq", ".[].headRefOid"])
    .split("\n").map((s) => s.trim()).filter((s) => /^[0-9a-f]{40}$/.test(s));
  if (heads.length === 0) throw new Error("no pull request to read check-runs from");
  const names = new Set();
  for (const h of heads) {
    for (const n of gh(["api", "--paginate", `repos/${slug}/commits/${h}/check-runs`, "--jq", ".check_runs[].name"]).split("\n")) if (n.trim()) names.add(n.trim());
  }
  return [...names];
}

function settingsOf(body) {
  const rsc = body.required_status_checks && typeof body.required_status_checks === "object" ? body.required_status_checks : null;
  const list = (v) => (Array.isArray(v) ? v : []);
  const contexts = rsc
    ? [...new Set([...list(rsc.contexts), ...list(rsc.checks).map((c) => c && c.context)].filter((c) => typeof c === "string" && c.trim()))]
    : [];
  return {
    values: {
      "strict-checks": !!(rsc && rsc.strict === true),
      "required-checks": contexts.length > 0,
      "enforce-admins": !!(body.enforce_admins && body.enforce_admins.enabled === true),
      "no-force-push": !!(body.allow_force_pushes && body.allow_force_pushes.enabled === false),
      "no-deletion": !!(body.allow_deletions && body.allow_deletions.enabled === false),
    },
    contexts,
  };
}

function flagValue(argv, i, name) {
  const v = argv[i + 1];
  if (v === undefined || v === "" || v.startsWith("--")) throw new Error(`${name} needs a value`);
  return v;
}

function main(argv) {
  let repo = false, slug = null, protFile = null, runsFile = null;
  try {
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a === "--repo") repo = true;
      else if (a === "--repo-slug") {
        slug = flagValue(argv, i, a); i++;
        // It goes into an API path: owner/name only, never `.`/`..` or a third segment (B10).
        const ok = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(slug) && !slug.split("/").some((p) => p === "." || p === "..");
        if (!ok) throw new Error(`--repo-slug must be OWNER/NAME, got ${JSON.stringify(slug).slice(0, 80)}`);
      }
      else if (a === "--protection-json") { protFile = flagValue(argv, i, a); i++; }
      else if (a === "--checkruns-json") { runsFile = flagValue(argv, i, a); i++; }
      else throw new Error(`unknown argument ${JSON.stringify(a)}`);
    }
  } catch (e) { console.error(`arc-doctor: ${e.message}`); return 2; }
  if (!repo) { console.error("usage: arc-doctor.mjs --repo [--repo-slug OWNER/NAME] [--protection-json F] [--checkruns-json F]"); return 2; }

  let rc = 0;
  let protection;
  try {
    if (!slug && !(protFile && runsFile)) slug = originSlug();
    protection = readProtection(protFile, slug);
  } catch (e) {
    for (const s of SETTINGS) console.log(`repo: ${s.padEnd(16)} UNKNOWN (unreadable: ${String(e.message).slice(0, 120)})`);
    console.log("RAN doctor-repo");
    return 2;
  }
  if (protection.state === "unprotected") {
    for (const s of SETTINGS) console.log(`repo: ${s.padEnd(16)} MISSING (main is not protected)`);
    console.log("RAN doctor-repo");
    return 1;
  }
  const { values, contexts } = settingsOf(protection.body);
  for (const s of SETTINGS) {
    console.log(`repo: ${s.padEnd(16)} ${values[s] ? "ok" : "MISSING"}`);
    if (!values[s]) rc = 1;
  }
  try {
    const seen = new Set(readCheckRuns(runsFile, slug));
    for (const c of contexts) if (!seen.has(c)) { console.log(`STALE-CONTEXT: ${c}`); rc = Math.max(rc, 1); }
  } catch (e) {
    console.log(`repo: contexts         UNKNOWN (check-runs unreadable: ${String(e.message).slice(0, 120)})`);
    rc = 2;
  }
  console.log("RAN doctor-repo");
  return rc;
}

const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return null; } })() : null;
if (invoked === self) process.exitCode = main(process.argv.slice(2));

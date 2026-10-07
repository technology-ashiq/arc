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
  if (body && body.message === "Branch not protected") return { state: "unprotected", body };
  if (!body || typeof body !== "object" || !("required_status_checks" in body || "enforce_admins" in body)) throw new Error("the answer is not a branch-protection object");
  return { state: "protected", body };
}

function readCheckRuns(file, slug) {
  if (file) {
    const v = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new Error("check-runs fixture is not a list of names");
    return v;
  }
  const head = gh(["pr", "list", "--repo", slug, "--state", "all", "--limit", "1", "--json", "headRefOid", "--jq", ".[0].headRefOid"]).trim();
  if (!/^[0-9a-f]{40}$/.test(head)) throw new Error("no pull request to read check-runs from");
  return gh(["api", "--paginate", `repos/${slug}/commits/${head}/check-runs`, "--jq", ".check_runs[].name"]).split("\n").map((s) => s.trim()).filter(Boolean);
}

function settingsOf(body) {
  const rsc = body.required_status_checks || null;
  const contexts = rsc ? [...new Set([...(rsc.contexts || []), ...((rsc.checks || []).map((c) => c && c.context))].filter(Boolean))] : [];
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
      else if (a === "--repo-slug") { slug = flagValue(argv, i, a); i++; }
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

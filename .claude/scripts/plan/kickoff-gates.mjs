/**
 * kickoff-gates — the new-cycle gates kickoff-lint runs in lane-mode (portfolio Cycle 5).
 *
 * newCycle      ADR-0076: a plan is a NEW cycle when the lane is LIVE and its PROGRESS `cycle:` identity
 *               differs from the base ref's. Everything below judges new cycles only, so a lane that is
 *               mid-cycle is never refused by a rule written for kickoffs.
 * kernelFreeze  ADR-0077: the owner's `kernel freeze:` ruling, folded from the canonical spine. Exemptions
 *               come from the ruling's own words; a ruling the grammar cannot read refuses, never exempts.
 *
 * Each gate returns findings `{ level: "fail" | "warn", check, msg }`; kickoff-lint owns printing and exit.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const git = (root, args) =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

// ---------- the PROGRESS machine header ----------

// The header is the block above the first `## ` heading. Only the FIRST `status:`/`cycle:` there counts:
// PROGRESS files repeat `blocked-on:` lines at the bottom, and a header key read from anywhere in the
// file is a key a done-log sentence can forge.
export function readHeader(text) {
  const head = String(text).split(/\r?\n/);
  const out = { status: null, cycle: null };
  for (const line of head) {
    if (/^##\s/.test(line)) break;
    const m = /^(status|cycle):[ \t]*(.*?)[ \t]*$/i.exec(line);
    if (m && out[m[1].toLowerCase()] === null) out[m[1].toLowerCase()] = m[2];
  }
  return out;
}

// Cycle identity: the `Cycle <N>` token when there is one, else the whole value case- and space-folded.
// A typo fix or an "opened <date>" amendment keeps the token, so it never reads as a new cycle (A7).
export function cycleIdentity(cycle) {
  if (cycle === null || cycle === undefined) return null;
  const m = /\bcycle\s+(\d+)\b/i.exec(cycle);
  if (m) return `cycle ${Number(m[1])}`;
  const folded = String(cycle).replace(/\s+/g, " ").trim().toLowerCase();
  return folded === "" ? null : folded;
}

export function newCycle({ root, tracker, base = "origin/main" }) {
  const rel = `${String(tracker).replace(/\\/g, "/").replace(/\/+$/, "")}/PROGRESS.md`;
  let text;
  try { text = readFileSync(join(root, rel), "utf8"); } catch { return { state: "not-live", reason: `${rel} unreadable` }; }
  const now = readHeader(text);
  if (!now.status || now.status.trim().toUpperCase() !== "LIVE") return { state: "not-live", reason: `status ${now.status ?? "absent"}` };
  const identity = cycleIdentity(now.cycle);
  try { git(root, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]); } catch {
    return { state: "unknown", reason: `base ref \`${base}\` does not resolve in ${root} — the new-cycle gates (kernel-freeze, debt-budget) did not run; pass --base <ref>` };
  }
  let baseText = null;
  try { baseText = git(root, ["show", `${base}:${rel}`]); } catch { baseText = null; }
  const baseIdentity = baseText === null ? null : cycleIdentity(readHeader(baseText).cycle);
  if (identity !== null && identity === baseIdentity) return { state: "same", identity };
  return { state: "new", identity, baseIdentity };
}

// ---------- the canonical spine ----------

// Resolved from the LINTED repo, never from cwd: kickoff-lint is handed a root, and a fixture root linted
// from inside arc must not read arc's own spine. A linked worktree's `.claude/state/` is empty by design,
// so the spine is the main clone's: dirname(git common dir).
export function spineDirFor(root) {
  if ("ARC_SPINE_ROOT" in process.env) {
    const named = process.env.ARC_SPINE_ROOT;
    if (typeof named !== "string" || named.trim() === "") return { dir: null, error: "ARC_SPINE_ROOT is set but empty" };
    return { dir: resolve(named) };
  }
  let common;
  try { common = git(root, ["rev-parse", "--git-common-dir"]).trim(); } catch { return { dir: null }; }
  if (!common) return { dir: null };
  const abs = isAbsolute(common) ? common : resolve(root, common);
  return { dir: join(dirname(abs), ".claude", "state", "hq") };
}

// ---------- the ruling grammar (ADR-0077) ----------

const LANE_ITEM = /^([a-z][a-z0-9-]*)$/;
const NOTE_ITEM = /^([a-z][a-z0-9-]*)[ \t]*\(([^()]+)\)$/;
const CYCLE_ITEM = /^([a-z][a-z0-9-]*)[ \t]+cycle[ \t]+(\d+)$/;

// Returns { exempt: Map<lane, {cycle?:number, note?:string}>, lift: {kind, n} | null } or { error }.
export function parseRuling(what) {
  const text = String(what).replace(/\s+/g, " ").trim().replace(/\.$/, "");
  const clauses = text.split(";").map((c) => c.trim());
  const exempt = new Map();
  let sawExempt = false;
  for (const clause of clauses) {
    const m = /^(.+?) (?:is|are) exempt$/i.exec(clause);
    if (!m) continue;
    sawExempt = true;
    const items = m[1].replace(/,? and /gi, ",").split(",").map((s) => s.trim().toLowerCase());
    for (const item of items) {
      let k;
      if (item === "") return { error: "an empty item in the exempt list" };
      if ((k = LANE_ITEM.exec(item))) exempt.set(k[1], {});
      else if ((k = CYCLE_ITEM.exec(item))) exempt.set(k[1], { cycle: Number(k[2]) });
      else if ((k = NOTE_ITEM.exec(item))) exempt.set(k[1], { note: k[2].trim() });
      else return { error: `exempt item "${item}" is none of: <lane> · <lane> (<note>) · <lane> Cycle <N>` };
    }
  }
  if (!sawExempt) return { error: "no `<list> are exempt` clause" };
  const lm = /\buntil ([a-z]+(?:\.[a-z]+)+) ?>= ?(\d+)\b/i.exec(text);
  return { exempt, lift: lm ? { kind: lm[1], n: Number(lm[2]) } : null };
}

// A revenue receipt lifts the freeze only when it is real money: revenue.simulated is a different kind
// and never counts, and a receipt that marks itself as a rehearsal, test or fixture does not either.
function countsTowardLift(kind, ev) {
  if (ev.kind !== kind) return false;
  if (kind !== "revenue.received") return true;
  const p = ev.payload;
  if (!p || typeof p !== "object") return false;
  if (!Number.isSafeInteger(p.amount) || p.amount < 1) return false;
  if (typeof p.currency !== "string" || !/^[A-Z]{3}$/.test(p.currency)) return false;
  if (p.rehearsal === true || p.test === true || p.fixture === true || p.livemode === false) return false;
  return true;
}

export function foldRulings(events) {
  const isRuling = (e) =>
    e && e.kind === "approval.requested" && e.payload && e.payload.gate === "owner-ruling" &&
    typeof e.payload.what === "string" && /^\s*kernel freeze\s*:/i.test(e.payload.what);
  const rulings = events.filter(isRuling);
  const standing = [];
  for (const r of rulings) {
    // arc-inbox refuses a second decision, so the FIRST decision on the spine is the decision.
    const decision = events.find((e) => e.kind === "decision.recorded" && e.payload && e.payload.decides === r.id);
    if (decision && decision.payload.verdict === "reject") continue;
    const superseded = events.some((e) => e.kind === "approval.requested" && e.payload && e.payload.gate === "owner-ruling" && e.supersedes === r.id);
    if (superseded) continue;
    const parsed = parseRuling(r.payload.what);
    if (!parsed.error && parsed.lift) {
      const have = events.filter((e) => countsTowardLift(parsed.lift.kind, e)).length;
      if (have >= parsed.lift.n) continue;
      parsed.have = have;
    }
    standing.push({ id: r.id, decided: decision ? decision.payload.verdict : "pending", ...parsed });
  }
  return standing;
}

export async function kernelFreeze({ root, lane, identity }) {
  const out = [];
  const { dir, error } = spineDirFor(root);
  if (error) return [{ level: "fail", check: "kernel-freeze", msg: `${error} — refusing to judge the freeze against a spine nobody named` }];
  if (!dir || !existsSync(join(dir, "events")))
    return [{ level: "warn", check: "kernel-freeze-unread", msg: `no spine at ${dir ?? "(no git repo)"} — the owner-ruling freeze was not checked (a CI checkout or a consumer repo has none)` }];
  const { scanAll } = await import("../hq/spine.mjs");
  const { events, unreadable } = scanAll(dir);
  if (unreadable.length)
    return [{ level: "fail", check: "kernel-freeze", msg: `${unreadable.length} spine day file(s) could not be read (${unreadable.map((u) => `${u.day}:${u.code}`).join(", ")}) — a freeze cannot be judged on a partial spine` }];
  const cycleN = /^cycle (\d+)$/.exec(identity ?? "");
  for (const r of foldRulings(events.map((x) => x.event))) {
    if (r.error) {
      out.push({ level: "fail", check: "kernel-freeze", msg: `owner ruling ${r.id} stands but cannot be read (${r.error}) — every lane is refused until it parses or a ruling supersedes it` });
      continue;
    }
    const ex = r.exempt.get(lane);
    if (ex && ex.cycle === undefined) {
      if (ex.note) out.push({ level: "warn", check: "kernel-freeze", msg: `lane ${lane} is exempt from owner ruling ${r.id} only for: ${ex.note} — confirm the cycle fits before building` });
      continue;
    }
    if (ex && cycleN && Number(cycleN[1]) === ex.cycle) continue;
    const lift = r.lift ? `${r.lift.kind} >= ${r.lift.n} (now ${r.have ?? 0})` : "no lift clause";
    const why = ex ? ` (exempt only for Cycle ${ex.cycle}; this is ${identity ?? "an unnumbered cycle"})` : "";
    out.push({ level: "fail", check: "kernel-freeze", msg: `lane ${lane} is frozen by owner ruling ${r.id}${why} — lifts when ${lift}, a decision rejects it, or a later owner-ruling supersedes it` });
  }
  return out;
}

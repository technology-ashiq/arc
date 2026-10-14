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
import { isAbsolute, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const git = (root, args) =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024, timeout: 30000 });

// A base ref is a ref name, never an option: it is handed to git as an argument, and a leading dash
// would be read as a flag (`--output=<path>` writes a file). Checked here AND at the CLI.
export const BASE_REF_RE = /^[A-Za-z0-9_.\/@{}^~][A-Za-z0-9_.\/@{}^~-]*$/;

// The tracker as a repo-relative POSIX path, whatever shape the resolver handed over: `git show` takes a
// tree path, and an absolute or backslashed one names nothing there, so every lane would read as new.
function trackerRel(root, tracker) {
  const abs = isAbsolute(String(tracker)) ? String(tracker) : join(root, String(tracker));
  return relative(root, abs).replace(/\\/g, "/");
}

// ---------- the PROGRESS machine header ----------

// The header is the block above the first `## ` heading. Only the FIRST `status:`/`cycle:` there counts:
// PROGRESS files repeat `blocked-on:` lines at the bottom, and a header key read from anywhere in the
// file is a key a done-log sentence can forge.
export function readHeader(text) {
  const head = String(text).split(/\r?\n/);
  const out = { status: null, cycle: null, appetite: null };
  for (const line of head) {
    if (/^##\s/.test(line)) break;
    const m = /^(status|cycle|appetite):[ \t]*(.*?)[ \t]*$/i.exec(line);
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
  if (!BASE_REF_RE.test(base)) return { state: "unknown", reason: `base ref \`${base}\` is not a ref name — the new-cycle gates did not run` };
  const rel = `${trackerRel(root, tracker)}/PROGRESS.md`;
  let text;
  try { text = readFileSync(join(root, rel), "utf8"); } catch { return { state: "not-live", reason: `${rel} unreadable` }; }
  const now = readHeader(text);
  if (!now.status || now.status.trim().toUpperCase() !== "LIVE") return { state: "not-live", reason: `status ${now.status ?? "absent"}` };
  const identity = cycleIdentity(now.cycle);
  try { git(root, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]); } catch (e) {
    // A git that is missing or hung is not a ref that does not resolve: say which, so a CI leg that
    // skipped the gates for a tooling reason is not read as "no base on this checkout".
    const why = e && e.code && e.code !== 1 ? `git failed (${e.code})` : `base ref \`${base}\` does not resolve in ${root}`;
    return { state: "unknown", reason: `${why} — the new-cycle gates (kernel-freeze, debt-budget) did not run; pass --base <ref>` };
  }
  // Absent at the base (a lane born on this branch) is a NEW cycle; a base that cannot be read is
  // UNKNOWN. Folding both into null made every git hiccup refuse a mid-cycle lane.
  let listed;
  try { listed = git(root, ["ls-tree", "--name-only", `${base}^{commit}`, "--", rel]).trim(); } catch {
    return { state: "unknown", reason: `could not list ${rel} at base \`${base}\` — the new-cycle gates did not run` };
  }
  let baseText = null;
  if (listed !== "") {
    try { baseText = git(root, ["show", `${base}:${rel}`]); } catch {
      return { state: "unknown", reason: `could not read ${rel} at base \`${base}\` — the new-cycle gates did not run` };
    }
  }
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
    // Relative to the LINTED root, never to cwd: the same lint run from two directories must read one spine.
    return { dir: resolve(root, named) };
  }
  // The MAIN worktree is the first entry git lists. dirname(git common dir) is not it for a
  // separate-git-dir checkout or a submodule, and that silently read "no spine".
  // Not a linked worktree (git dir == common dir): the checkout itself is the main one. `worktree list` names the
  // git dir, not the checkout, for a separate-git-dir repo, so it is asked only from a linked worktree.
  let gitDir, commonDir;
  try {
    gitDir = resolve(root, git(root, ["rev-parse", "--git-dir"]).trim());
    commonDir = resolve(root, git(root, ["rev-parse", "--git-common-dir"]).trim());
  } catch { return { dir: null }; }
  if (gitDir === commonDir) {
    try { return { dir: join(git(root, ["rev-parse", "--show-toplevel"]).trim(), ".claude", "state", "hq") }; } catch { return { dir: null }; }
  }
  let list;
  try { list = git(root, ["worktree", "list", "--porcelain"]); } catch { return { dir: null }; }
  const firstBlock = list.split(/\r?\n\r?\n/)[0];
  const first = /^worktree (.+)$/m.exec(firstBlock);
  if (!first || /^bare$/m.test(firstBlock)) return { dir: null };
  return { dir: join(first[1].trim(), ".claude", "state", "hq") };
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
    // Split on commas and a final "and" OUTSIDE parentheses only: "engine (metered runs, nightly)" is one item.
    const items = [];
    let depth = 0, cur = "";
    const src = m[1].replace(/,? and /gi, "\u0000");
    for (const ch of src) {
      if (ch === "(") depth++;
      if (ch === ")") depth = Math.max(0, depth - 1);
      if ((ch === "," || ch === "\u0000") && depth === 0) { items.push(cur); cur = ""; continue; }
      cur += ch === "\u0000" ? " and " : ch;
    }
    items.push(cur);
    for (let k = 0; k < items.length; k++) items[k] = items[k].trim().toLowerCase();
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
  // A marker counts unless it is literally `false` (livemode: unless literally `true`): a string "false"
  // from a sloppy emitter is not proof of real money.
  for (const k of ["rehearsal", "test", "fixture", "simulated"]) if (k in p && p[k] !== false) return false;
  if ("livemode" in p && p.livemode !== true) return false;
  return true;
}

export function foldRulings(events) {
  const isRuling = (e) =>
    e && e.kind === "approval.requested" && e.payload && e.payload.gate === "owner-ruling" &&
    typeof e.payload.what === "string" && /^\s*kernel freeze\s*:/i.test(e.payload.what);
  const rulings = events.filter(isRuling);
  const standing = [];
  for (const r of rulings) {
    const at = events.indexOf(r);
    // arc-inbox refuses a second decision, so the FIRST decision on the spine is the decision.
    const decision = events.find((e) => e.kind === "decision.recorded" && e.payload && e.payload.decides === r.id);
    if (decision && decision.payload.verdict === "reject") continue;
    // Only a LATER owner-ruling supersedes: a line appended before the ruling existed cannot have named it.
    const superseded = events.some((e, i) => i > at && e.kind === "approval.requested" && e.payload && e.payload.gate === "owner-ruling" && e.supersedes === r.id);
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

// ---------- the debt budget (ADR-0078) ----------

export const DEBT_THRESHOLD = 20;
export const DEBT_SHARE = 0.2;
const CLOSING_WORD = /^(closed|fixed|paid|resolved|done)\b/i;
const strip = (c) => c.replace(/[*~`]/g, "").trim();
const splitRow = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const isSeparator = (cells) => cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));

// Every markdown table in the ledger, read as it is written: six lanes use six header grammars and none
// has a status column, so "closed" is a closing word leading some cell, or a wholly struck first cell.
// Ids are the `#` cell where the table's first header is `#`, else `D<ordinal>` across the file.
//
// Ledgers append rows under later prose with no header repeated (distribute: rows 5..24 sit between
// REJECTED blocks), so a pipe line after the first table is a row of the LAST table seen. Lines inside
// ``` fences are never rows.
export function readDebtLedger(text) {
  const lines = String(text).split(/\r?\n/);
  const rows = [];
  let ordinal = 0;
  let hashIds = null; // null until a header + separator has been seen
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { fenced = !fenced; continue; }
    if (fenced || !/^\s*\|/.test(lines[i])) continue;
    if (i + 1 < lines.length && isSeparator(splitRow(lines[i + 1]))) {
      hashIds = strip(splitRow(lines[i])[0]) === "#";
      i++;
      continue;
    }
    if (hashIds === null) continue;
    const cells = splitRow(lines[i]);
    ordinal++;
    const struck = /^~~.+~~$/.test(cells[0]);
    const closed = struck || cells.some((c) => CLOSING_WORD.test(strip(c)));
    const id = hashIds && strip(cells[0]) !== "" ? strip(cells[0]) : `D${ordinal}`;
    rows.push({ id, closed, ordinal });
  }
  return rows;
}

const days = (s) => {
  const m = /(\d+(?:\.\d+)?)\s*(?:d|days?)\b/i.exec(String(s ?? ""));
  return m ? Number(m[1]) : null;
};

// planRows: the PLAN's phase-table rows as cell arrays ([phase, capability, appetite, ...]).
export function debtBudget({ root, tracker, lane, planRows }) {
  const base = trackerRel(root, tracker);
  const ledgerPath = join(root, base, "debt-ledger.md");
  if (!existsSync(ledgerPath)) return [];
  const rows = readDebtLedger(readFileSync(ledgerPath, "utf8"));
  const open = rows.filter((r) => !r.closed);
  if (open.length <= DEBT_THRESHOLD) return [];
  let appetite = null;
  try { appetite = days(readHeader(readFileSync(join(root, base, "PROGRESS.md"), "utf8")).appetite); } catch { appetite = null; }
  if (appetite === null || appetite <= 0)
    return [{ level: "fail", check: "debt-budget", msg: `lane ${lane} has ${open.length} open debt rows (> ${DEBT_THRESHOLD}) and its PROGRESS header has no readable \`appetite:\` in days, so the 20% debt phase cannot be sized` }];
  const need = Math.round(appetite * DEBT_SHARE * 100) / 100;
  const debtPhases = planRows.filter((c) => /^debt\s*:/i.test(strip(c[1] ?? "")));
  const have = debtPhases.reduce((s, c) => s + (days(c[2]) ?? 0), 0);
  const named = debtPhases.flatMap((c) => [...String(c[1]).matchAll(/\bdebt #([A-Za-z0-9-]+)/gi)].map((m) => m[1]));
  const openIds = new Set(open.map((r) => r.id));
  const allIds = new Set(rows.map((r) => r.id));
  const out = [];
  const head = `lane ${lane} has ${open.length} open debt rows (> ${DEBT_THRESHOLD}) in debt-ledger.md`;
  if (debtPhases.length === 0 || have + 1e-9 < need || named.length === 0)
    out.push({ level: "fail", check: "debt-budget", msg: `${head} — a new cycle needs a phase whose capability starts \`Debt:\` with >= ${need}d (20% of ${appetite}d; found ${have}d) naming the rows it closes as \`debt #<id>\`; first open ids: ${open.slice(0, 5).map((r) => r.id).join(", ")}` });
  for (const id of named) {
    if (!allIds.has(id)) out.push({ level: "fail", check: "debt-budget", msg: `debt #${id} names no row in ${lane}'s debt-ledger.md` });
    else if (!openIds.has(id)) out.push({ level: "fail", check: "debt-budget", msg: `debt #${id} is already closed in ${lane}'s debt-ledger.md — a debt phase names rows it will close` });
  }
  return out;
}

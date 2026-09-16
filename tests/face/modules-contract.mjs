#!/usr/bin/env node
// modules-contract.mjs -- the face v2 modules-contract derivation, attacked in memory.
// Every mutant below was a CONFIRMED hole in the first version (attack 2026-09-17): each one
// used to derive a contract that still printed "in sync", with a room silently missing, doubled
// or misclassified. Each must now be refused by name. No install, no files written.
//
// VACUOUS-PASS GUARD: the control derivation must produce the real counts first, and the last
// line is "RAN: <n> checks, <f> failed" with a floor on n.
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const mod = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "face-modules-contract.mjs")).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};
const refuses = (inputs, re) => {
  try { mod.derive(inputs); return { ok: false, msg: "derived without refusing" }; }
  catch (e) { return { ok: re.test(String(e.message)), msg: String(e.message) }; }
};

const registryText = readFileSync(join(REPO, mod.PATHS.registry), "utf8");
const servedJson = JSON.parse(readFileSync(join(REPO, mod.PATHS.served), "utf8"));
const planText = readFileSync(join(REPO, mod.PATHS.plan), "utf8");
const base = { registryText, servedJson, planText };

// ---- control ----
const control = mod.derive(base);
check("the control derivation loads the real inputs", control.orphans.length === 0 && control.contract.counts.modules === 36
  && control.contract.counts.renamed === 3 && control.contract.counts.extra === 4, JSON.stringify(control.contract.counts));
check("every module carries a reads array, never null", control.contract.modules.every((m) => Array.isArray(m.reads)));

const lines = registryText.split(/\r?\n/);
const rowIndex = (id) => lines.findIndex((l) => new RegExp(`^\\s*\\{\\s*id:\\s*'${id}'`).test(l));
const withLines = (mutate) => { const copy = lines.slice(); mutate(copy); return copy.join("\n"); };

// ---- registry mutants ----
{
  const i = rowIndex("toolbelt");
  check("the toolbelt row exists to mutate", i > 0);
  const wrapped = withLines((c) => { c.splice(i, 1, "  {", c[i].replace(/^\s*\{/, "   ")); });
  const r = refuses({ ...base, registryText: wrapped }, /declares \d+ rows but \d+ were readable/);
  check("a row wrapped over two lines is refused, not dropped", r.ok, r.msg);

  const j = rowIndex("story");
  const dq = withLines((c) => { c[j] = c[j].replace("id: 'story'", 'id: "story"'); });
  const d = mod.derive({ ...base, registryText: dq });
  check("a double-quoted id is read, and the extra room is still a module", d.contract.counts.modules === 36 && d.contract.modules.some((m) => m.id === "story"));

  const k = rowIndex("toolbelt");
  const ghost = withLines((c) => { c.splice(k, 0, "  { id: 'ghost', name: 'ghost', ring: 'money', I: X, sentence: 'not an extra: true room', lede: 'x' },"); });
  const g = mod.derive({ ...base, registryText: ghost });
  check("`extra: true` inside a sentence string is text, so the room is an ORPHAN", g.orphans.includes("ghost"), JSON.stringify(g.orphans));

  const dup = withLines((c) => { c.splice(k, 0, c[k]); });
  const u = refuses({ ...base, registryText: dup }, /duplicate room id/);
  check("a duplicate registry id is refused", u.ok, u.msg);

  const alsoToday = withLines((c) => { c.splice(k, 0, "  { id: 'today', name: 'today', ring: 'command', I: X, sentence: 'x', lede: 'x' },"); });
  const t = refuses({ ...base, registryText: alsoToday }, /two v0\.7 rooms become module today/);
  check("a served id reached both directly and through an alias is refused", t.ok, t.msg);

  const fanIn = structuredClone(servedJson);
  fanIn.rooms.push({ ...fanIn.rooms.find((r) => r.id === "board"), id: "review" }, { ...fanIn.rooms.find((r) => r.id === "board"), id: "ship" });
  const fanText = registryText.replace("export const ROOM_ALIASES = {", "export const ROOM_ALIASES = { review: 'review-ship', ship: 'review-ship',");
  const withoutReviewShip = fanText.split(/\r?\n/).map((l) => l).join("\n");
  const servedNoRS = { ...fanIn, rooms: fanIn.rooms.filter((r) => r.id !== "review-ship") };
  const f = refuses({ ...base, registryText: withoutReviewShip, servedJson: servedNoRS }, /claimed by 2 served ids/);
  check("one v0.7 room claimed by two served ids is refused", f.ok, f.msg);
}

// ---- served-registry mutants ----
{
  check("a null served file is an input error", refuses({ ...base, servedJson: null }, /no `rooms` array/).ok);
  const bad = structuredClone(servedJson);
  bad.rooms[3] = { id: "x" };
  const b = refuses({ ...base, servedJson: bad }, /rooms\[3\] is not \{id, ring, status\}/);
  check("a served entry missing ring or status is named by index", b.ok, b.msg);
}

// ---- section 5.2 mutants ----
{
  const plan = (from, to) => ({ ...base, planText: planText.replace(from, to) });
  const star = refuses(plan("| `engine` | ★ `/api/engine` |", "| `engine` | ☆ `/api/engine` |"), /unknown mark or token|before any mark/);
  check("an unknown mark is refused, never read as served", star.ok, star.msg);
  const moved = refuses(plan("| `inbox` |", "| **`inbox`** |"), /unreadable table row/);
  check("a row whose id cell cannot be read is refused, never skipped", moved.ok, moved.msg);
  const gone = refuses(plan(/^\| `story` \*? ?\|.*$/m, ""), /no row for v0\.7 room story/);
  check("a v0.7 room with no 5.2 row is refused", gone.ok, gone.msg);
  const before = refuses(plan("| `spine` | ✔ `/api/spine` |", "| `spine` | `/api/spine` ✔ |"), /before any mark/);
  check("a route before any mark is refused", before.ok, before.msg);
  const twice = refuses(plan("| `map` |", "| `map` | ✔ `/api/rooms` | — |\n| `map` |"), /two rows/);
  check("a room with two 5.2 rows is refused", twice.ok, twice.msg);
  const proto = mod.parsePlannedReads("### 5.2 x\n| `constructor` | ✔ `/api/x` | — |\n## 6 y\n");
  check("a room id named like an Object prototype key is an ordinary row", Array.isArray(proto.constructor) && proto.constructor.length === 1);
}

// ---- row property reader ----
{
  const p = mod.rowProperties("  { id: 'a', ring: 'kernel', sentence: 'ring: \\'money\\', extra: true', lede: \"x, y\", extra: true },");
  check("rowProperties reads keys only where keys stand", p.id === "a" && p.ring === "kernel" && p.extra === "true" && p.lede === "x, y", JSON.stringify(p));
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 18 ? 0 : 1;

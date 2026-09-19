#!/usr/bin/env node
// live-pulse.mjs -- REQ-11's door half and the flows' pure half (face v2 Phase 05, ADR-1339).
//
// The door: GET /api/pulse is a fingerprint that holds still while nothing changes and moves when the spine does, it
// reads no file's bytes, and a face asking it every two seconds does not bury the journal. The face: readsToLoad
// re-reads EVERY read when the pulse is due, polled or not. The flows: the dock still carries the frozen button text
// the browser flows find buttons by (a planted rename FAILs), and every op the registry holds has a flow.
//
// VACUOUS-PASS GUARD: the door is proven up and the fixture proven seen before any behavioural check; the last line is
// "RAN: <n> checks", which the bats wrapper requires.

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, existsSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const PORT = 8433;
const TOKEN = "live-pulse-token";
const EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

// ---- the pure half ----
{
  const reg = await import(pathToFileURL(join(REPO, "face", "src", "lib", "registry.mjs")).href);
  const planned = [{ key: "a", poll: true }, { key: "b", poll: false }, { key: "c" }];
  const loaded = { a: { state: "ok" }, b: { state: "ok" }, c: { state: "ok" } };
  const keys = (xs) => xs.map((r) => r.key).join(",");
  check("readsToLoad: with nothing due, nothing loaded is read again", keys(reg.readsToLoad(planned, loaded, new Set(), false, false)) === "");
  check("readsToLoad: a poll re-reads only the polled read", keys(reg.readsToLoad(planned, loaded, new Set(), true, false)) === "a");
  check("readsToLoad: a PULSE re-reads every read, polled or not (REQ-11)", keys(reg.readsToLoad(planned, loaded, new Set(), false, true)) === "a,b,c");
  check("readsToLoad: a read in flight is never started twice, pulse or not", keys(reg.readsToLoad(planned, loaded, new Set(["b"]), false, true)) === "a,c");
  // PR 2 logic attack: a pulse that meets a read in flight marks it, and the read runs again once it lands.
  check("pulseDirty: the reads a pulse finds in flight are the ones marked", reg.pulseDirty(planned, new Set(["b", "zz"])).join(",") === "b");
  check("readsToLoad: a FORCED key is read again once it has landed, with no pulse and no poll", keys(reg.readsToLoad(planned, loaded, new Set(), false, false, new Set(["b"]))) === "b");
  check("readsToLoad: a forced key still in flight waits (never two at once)", keys(reg.readsToLoad(planned, loaded, new Set(["b"]), false, false, new Set(["b"]))) === "");
  const good = { state: "ok", data: { n: 1 } };
  const refused = { state: "refused", code: "SOURCE_CHANGING", human: "the file moved under the read" };
  const kept = reg.keepOnRereadFailure(good, refused);
  check("keepOnRereadFailure: a failed RE-read keeps the last good answer, marked", kept.state === "ok" && kept.data.n === 1 && kept.rereadFailed && kept.rereadFailed.code === "SOURCE_CHANGING", JSON.stringify(kept));
  check("keepOnRereadFailure: a read that never answered shows the refusal", reg.keepOnRereadFailure(undefined, refused) === refused && reg.keepOnRereadFailure({ state: "loading" }, refused) === refused);
  check("PULSE_MS asks well inside REQ-11's 5 s", typeof reg.PULSE_MS === "number" && reg.PULSE_MS > 0 && reg.PULSE_MS <= 2500, String(reg.PULSE_MS));

  const flows = await import(pathToFileURL(join(REPO, "face", "scripts", "flows.mjs")).href);
  const dock = readFileSync(join(REPO, "face", "src", "shell", "OpsDock.tsx"), "utf8");
  check("the dock carries every frozen button text the flows click by", flows.frozenDrift(dock).length === 0, flows.frozenDrift(dock).join(","));
  const planted = dock.replace(/>(\s*)Plan it(\s*)</, ">$1Plan this$2<");
  check("MUTANT: a planted rename of a frozen button is named", planted !== dock && flows.frozenDrift(planted).includes("Plan it"), flows.frozenDrift(planted).join(","));
  const ops = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "face-ops.mjs")).href);
  const inputs = flows.flowInputs({ tmp: tmpdir(), closeMonth: "2026-01" });
  const missing = ops.OPS.filter((o) => !Object.hasOwn(inputs, o.id)).map((o) => o.id);
  check("every op the registry holds has a browser flow (REQ-09)", ops.OPS.length > 0 && missing.length === 0, missing.join(","));
  const stray = Object.keys(inputs).filter((id) => !ops.OPS.some((o) => o.id === id));
  check("no flow drives an op the registry no longer holds", stray.length === 0, stray.join(","));
  const bad = [];
  for (const o of ops.OPS) { try { ops.validateInput(o, inputs[o.id]); } catch (e) { bad.push(`${o.id}: ${e.message}`); } }
  check("every flow's input is one the door accepts", bad.length === 0, bad.join(" ; "));
  const cm = flows.closeMonthFor(new Date(Date.UTC(2026, 0, 3)));
  check("the close flow closes two months back, mid-month (outside the ten-day fixture)", cm.month === "2025-11" && new Date(cm.at).getUTCDate() === 15, JSON.stringify(cm));
}

// ---- the pulse sees an in-place edit INSIDE a watched directory (PR 2 shell attack: a directory's own stat does not
// move when a file in it is rewritten, and phases/ and docs/adr were stamped as directories) ----
{
  const R = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "lib", "face", "reads.mjs")).href);
  const fake = mkdtempSync(join(tmpdir(), "face-pulse-tree-"));
  const spec = join(fake, "initiatives", "demo", "phases", "phase-01-spec.md");
  const adr = join(fake, "docs", "adr", "0001-x.md");
  mkdirSync(dirname(spec), { recursive: true });
  mkdirSync(dirname(adr), { recursive: true });
  writeFileSync(spec, "aaaa");
  writeFileSync(adr, "bbbb");
  const spineDir = join(fake, "spine");
  mkdirSync(join(spineDir, "events"), { recursive: true });
  const ctx = { mode: "sim", root: spineDir, repo: fake };
  const at = (d) => new Date(Date.UTC(2026, 0, d));
  utimesSync(spec, at(1), at(1)); utimesSync(adr, at(1), at(1));
  const p0 = R.apiPulse(ctx, []).pulse;
  const dirBefore = statSync(dirname(spec)).mtimeMs;
  writeFileSync(spec, "cccc"); utimesSync(spec, at(2), at(2));
  check("MUTANT CONTROL: the phases directory's own stat did not move with the in-place edit (a directory stamp would miss it)", statSync(dirname(spec)).mtimeMs === dirBefore);
  const p1 = R.apiPulse(ctx, []).pulse;
  check("the pulse MOVES on an in-place edit of a phase spec", p1 !== p0, `${p0} -> ${p1}`);
  writeFileSync(adr, "dddd"); utimesSync(adr, at(3), at(3));
  const p2 = R.apiPulse(ctx, []).pulse;
  check("the pulse MOVES on an in-place edit of an ADR", p2 !== p1, `${p1} -> ${p2}`);
  // PR 2 logic attack: a source a route READ (the gates file, the rooms registry, bench's ceilings...) is watched from
  // the first time it is read -- the door records it where every read passes.
  const gates = join(fake, "arc.gates.yaml");
  writeFileSync(gates, "gates: []\n"); utimesSync(gates, at(1), at(1));
  const q0 = R.apiPulse(ctx, []).pulse;
  writeFileSync(gates, "gates: [x]\n"); utimesSync(gates, at(4), at(4));
  check("MUTANT CONTROL: a source no route has read does not move the pulse", R.apiPulse(ctx, []).pulse === q0);
  R.watchSource(ctx, "arc.gates.yaml", "file");
  const q1 = R.apiPulse(ctx, []).pulse;
  writeFileSync(gates, "gates: [y]\n"); utimesSync(gates, at(5), at(5));
  check("a source a route has read MOVES the pulse when it changes", R.apiPulse(ctx, []).pulse !== q1);
  const readsSrc = readFileSync(join(REPO, ".claude", "scripts", "hq", "lib", "face", "reads.mjs"), "utf8");
  const containedBody = (readsSrc.split("function contained(ctx, rel, kind) {")[1] || "").split("\n}\n")[0];
  check("every contained read registers its source (the one place every file and directory read passes)", /watchSource\(ctx, rel,/.test(containedBody));
  // A closed day is fingerprinted by its name alone (it is pinned for ever); an open day by its stat.
  const S = await import(pathToFileURL(join(REPO, ".claude", "scripts", "hq", "spine.mjs")).href);
  writeFileSync(join(spineDir, "events", "2026-01-01.jsonl"), "{}\n");
  writeFileSync(join(spineDir, "events", "2026-01-01.closed"), "x\n");
  writeFileSync(join(spineDir, "events", "2026-01-02.jsonl"), "{}\n");
  const stamps = S.spineStamp(spineDir);
  check("spineStamp: a closed day is its name, not a stat; an open day is statted", stamps.includes("events/2026-01-01.jsonl|closed") && stamps.some((l) => /^events\/2026-01-02\.jsonl\|\d+\|/.test(l)), stamps.join(" ; "));
}

// ---- the door half ----
const tmp = mkdtempSync(join(tmpdir(), "face-live-pulse-"));
const SPINE = join(tmp, "spine");
const JOURNAL = join(tmp, "journal");
const gen = JSON.parse(spawnSync(process.execPath, [join(REPO, "tests/fixtures/face/gen-spine.mjs"), "--out", SPINE, "--count", "300", "--days", "4", "--seed", "pulse-1"], { encoding: "utf8" }).stdout);
check("fixture generated (vacuous-pass guard)", gen && gen.events > 0, JSON.stringify(gen));

const dash = spawn(process.execPath, [join(REPO, ".claude/scripts/hq/arc-dash.mjs"), "--spine", SPINE, "--port", String(PORT)],
  { cwd: REPO, env: { ...process.env, ARC_DASH_TOKEN: TOKEN, ARC_DASH_JOURNAL_DIR: JOURNAL }, stdio: ["ignore", "ignore", "pipe"] });
const H = { Authorization: `Bearer ${TOKEN}` };
const j = async (path, opts = {}) => {
  let r;
  try { r = await fetch(`http://127.0.0.1:${PORT}${path}`, opts); }
  catch (e) { if (!/other side closed|ECONNRESET|UND_ERR_SOCKET/i.test(String(e && e.cause && (e.cause.code || e.cause.message)))) throw e; r = await fetch(`http://127.0.0.1:${PORT}${path}`, opts); }
  let body; try { body = await r.json(); } catch { body = {}; }
  return { status: r.status, body };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let up = false;
for (let i = 0; i < 50 && !up; i++) { await sleep(200); try { up = (await j("/api/health", { headers: H })).status === 200; } catch { /* not yet */ } }

try {
  check("door up", up);
  const a = await j("/api/pulse", { headers: H });
  check("GET /api/pulse answers a fingerprint", a.status === 200 && /^[0-9a-f]{24}$/.test(a.body.pulse || "") && a.body.watched > 5, JSON.stringify(a.body));
  const b = await j("/api/pulse", { headers: H });
  check("the pulse holds still while nothing changes", b.body.pulse === a.body.pulse, `${a.body.pulse} vs ${b.body.pulse}`);
  const emitted = spawnSync(process.execPath, [EVENT, "emit", "note.logged", "--payload", JSON.stringify({ note: "pulse test" }), "--strict"], { cwd: REPO, encoding: "utf8", env: { ...process.env, ARC_SPINE_ROOT: SPINE } });
  check("a receipt appended to the fixture spine (vacuous-pass guard)", emitted.status === 0, String(emitted.stderr));
  const c = await j("/api/pulse", { headers: H });
  check("the pulse MOVES when the spine does", c.body.pulse !== b.body.pulse, `${b.body.pulse} -> ${c.body.pulse}`);
  const q = await j("/api/pulse?x=1", { headers: H });
  check("a query the pulse does not read -> BAD_ARGS", q.status === 400 && q.body.error === "BAD_ARGS", `${q.status} ${q.body.error}`);
  const noTok = await j("/api/pulse");
  check("the pulse needs the token like every route", noTok.status === 401);
  // Twenty asks, as a face would make in forty seconds: none of them may reach the journal.
  for (let i = 0; i < 20; i++) await j("/api/pulse", { headers: H });
  await j("/api/health", { headers: H });
  await sleep(200);
  const lines = existsSync(JOURNAL) ? readdirSync(JOURNAL).flatMap((f) => readFileSync(join(JOURNAL, f), "utf8").split("\n").filter(Boolean)) : [];
  const pulses = lines.filter((l) => l.includes('"/api/pulse"') && l.includes('"status":200'));
  check("the journal holds the reads, and no successful pulse (a face asking every 2 s must not bury the owner's acts)",
    lines.some((l) => l.includes('"/api/health"')) && pulses.length === 0, `lines=${lines.length} pulses=${pulses.length}`);
  check("a REFUSED pulse is still journalled", lines.some((l) => l.includes('"/api/pulse"') && l.includes("BAD_ARGS")));
} finally {
  dash.kill();
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 20 ? 0 : 1);

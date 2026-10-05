#!/usr/bin/env node
// engine-model-profile-room.mjs -- model-policy v2, Phase 01 (REQ-04; ADR-1800, ADR-1803): the model-policy room shows
// which profile, model and gateway host each route reaches, read from the owner store, and never its key.
//
// Driven by tests/engine-model-profile.bats. It goes through the REAL door function (reads.apiModelPolicy) over a
// fixture tree, then through the REAL fold, so a door that served a key or a fold that dropped the profile both fail
// here. Ends with "RAN <n> checks, <f> failed" -- a probe that died early prints no RAN line, and the wrapper checks it.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const u = (p) => pathToFileURL(p).href;
let n = 0;
let failed = 0;
const check = (name, cond, detail = "") => {
  n += 1;
  if (cond) console.log(`ok   ${name}`);
  else { failed += 1; console.log(`FAIL ${name}${detail ? ` -- ${String(detail).slice(0, 400)}` : ""}`); }
};

const KEY = "planted-room-key-000004";
const tmp = mkdtempSync(join(tmpdir(), "mp-room-"));
const tree = join(tmp, "tree");
const storePath = join(tmp, "store", "models.json");
mkdirSync(join(tree, "engine"), { recursive: true });
mkdirSync(dirname(storePath), { recursive: true });
writeFileSync(join(tree, "engine", "router.yaml"), [
  "version: 1",
  "tiers:",
  "  - balanced-workhorse",
  "  - high-judgment",
  "models:",
  "  balanced-workhorse:",
  "    claude-code: sonnet",
  "    generic-api: profile:fx",
  "  high-judgment:",
  "    claude-code: opus",
  "classes:",
  "  by-tier:",
  "    tier: balanced-workhorse",
  "    driver: generic-api",
  "    fallback: []",
  "  by-class:",
  "    tier: high-judgment",
  "    driver: claude-code",
  "    fallback:",
  "      - generic-api",
  "    profile: fy",
  "  gone-here:",
  "    tier: high-judgment",
  "    driver: generic-api",
  "    fallback: []",
  "    profile: absent",
  "  claude-only:",
  "    tier: high-judgment",
  "    driver: claude-code",
  "    fallback: []",
  "",
].join("\n"));
writeFileSync(storePath, JSON.stringify({
  schema: 1,
  active: "fx",
  models: [
    { name: "fx", baseUrl: "https://gw-one.example/api/v1", model: "vendor/model-fx", key: KEY },
    { name: "fy", baseUrl: "https://gw-two.example/v1", model: "vendor/model-fy", key: KEY },
    { name: "my gateway", baseUrl: "https://gw-three.example/v1", model: "vendor/model-z" },
  ],
}));
process.env.ARC_FACE_MODELS_FILE = storePath;

const reads = await import(u(join(REPO, ".claude/scripts/hq/lib/face/reads.mjs")));
const body = await reads.apiModelPolicy({ mode: "sim", root: join(tmp, "spine"), repo: tree }, new URL("http://127.0.0.1/api/model-policy"));
const wire = JSON.stringify(body);
const cls = (name) => (body.classes || []).find((c) => c.name === name) || {};

// The door: names, models and hosts -- never the key, never the URL path.
check("DOOR: the key is in no part of the route body", !wire.includes(KEY) && wire.includes("vendor/model-fx"), wire.slice(0, 300));
check("DOOR: no base URL path leaves the door", !wire.includes("/api/v1") && !wire.includes("https://"), wire.slice(0, 300));
const tierPin = ((body.tiers || []).find((t) => t.tier === "balanced-workhorse") || { models: [] }).models.find((m) => m.driver === "generic-api") || {};
check("DOOR: a tier profile pin resolves to its model and host", tierPin.profile && tierPin.profile.profile === "fx" && tierPin.profile.model === "vendor/model-fx" && tierPin.profile.gateway_host === "gw-one.example", JSON.stringify(tierPin));
check("DOOR: a generic-api class inherits its tier's profile", cls("by-tier").profile && cls("by-tier").profile.profile === "fx" && cls("by-tier").profile.from === "tier", JSON.stringify(cls("by-tier")));
check("DOOR: a class profile reached through the fallback is its own", cls("by-class").profile && cls("by-class").profile.profile === "fy" && cls("by-class").profile.from === "class" && cls("by-class").profile.gateway_host === "gw-two.example", JSON.stringify(cls("by-class")));
check("DOOR: a profile this machine lacks is served as missing, not dropped", cls("gone-here").profile && cls("gone-here").profile.missing === true && cls("gone-here").profile.profile === "absent", JSON.stringify(cls("gone-here")));
check("DOOR: a class that never reaches generic-api has no profile", cls("claude-only").profile === null, JSON.stringify(cls("claude-only")));
check("DOOR: a store record with a space is listed as not routable", Array.isArray(body.unroutable) && body.unroutable.includes("my gateway"), JSON.stringify(body.unroutable));

// The fold, through the same planned-read path the face uses.
const reg = await import(u(join(REPO, "face/src/lib/registry.mjs")));
const registry = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
const dir = join(REPO, "face/src/modules/kernel/model-policy");
const manifest = (await import(u(join(dir, "module.mjs")))).default;
const { fold } = await import(u(join(dir, "fold.mjs")));
const room = registry.rooms.find((r) => r.id === "model-policy") || { id: "model-policy", ring: "kernel", name: "model-policy", sentence: "", lede: "", holds: {} };
const ctx = { room, rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: registry.inventories, laneMap: undefined, picks: {}, manifest };
const first = fold({}, ctx);
const payloads = Object.create(null);
for (const r of reg.plannedReads(first, manifest).reads) if (r.route === "/api/model-policy") payloads[r.key] = { state: "ok", data: body };
const f = fold(payloads, ctx);
const tierRow = f.tiers.rows.find((r) => r.key === "balanced-workhorse");
check("FOLD: the tier table draws profile -> model @ host", tierRow && tierRow.cells[1].includes("profile fx → vendor/model-fx @ gw-one.example"), tierRow && tierRow.cells[1]);
const route = (k) => (f.routesTable.rows.find((r) => r.key === k) || { cells: [] }).cells[2] || "";
check("FOLD: a route draws generic-api with its own profile", route("by-class") === "claude-code → generic-api (profile fy → vendor/model-fy @ gw-two.example)", route("by-class"));
check("FOLD: a missing profile is drawn as not on this machine", route("gone-here").includes("profile absent (not on this machine)"), route("gone-here"));
check("FOLD: a claude-only route is drawn as before", route("claude-only") === "claude-code", route("claude-only"));
check("FOLD: the unroutable record is said under the tier table", f.tiers.note.includes("not routable") && f.tiers.note.includes("my gateway"), f.tiers.note);
check("FOLD: the key is in nothing the fold returned", !JSON.stringify(f).includes(KEY));

console.log(`RAN ${n} checks, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

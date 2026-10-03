// The launch lane's readers: slot catalog (layer 1), provider registry (layer 2), venture profile (the only input).
// Every reader refuses whole on a wrong shape -- a half-read contract answers questions confidently and wrongly.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "../../engine/yaml-subset.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
export const PRODUCT = join(ROOT, "products", "launch");
export const PATHS = {
  catalog: join(PRODUCT, "launch.slots.yaml"),
  registry: join(PRODUCT, "launch.providers.yaml"),
  providersDir: join(PRODUCT, "providers"),
  venturesDir: join(PRODUCT, "ventures"),
  stateDir: join(ROOT, ".claude", "state", "launch"),
};

// The owner. A constant, not a flag: approved_by exists so the machine cannot widen it (ADR-1702, ADR-1408).
export const OWNER = "ashiq";

export const TIERS = new Set(["core", "required", "optional"]);
export const GATES = new Set(["none", "gate-1", "gate-2", "gate-3"]);
export const RESUME = new Set(["resources", "rerun", "manual"]);
export const STATUSES = new Set(["candidate", "vetted", "retired", "blocked"]);
export const PROFILE_FIELDS = {
  type: new Set(["saas-b2b", "saas-b2c", "api-product", "content-site"]),
  region: new Set(["in", "global"]),
  payment_model: new Set(["gateway", "mor", "none"]),
  tenancy: new Set(["single", "multi"]),
  ai: new Set(["true", "false"]),
  honesty_class: new Set(["real", "rehearsal"]),
};

export class LaunchError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function readYaml(path, what) {
  if (!existsSync(path)) throw new LaunchError("MISSING", `${what} not found at ${path}`);
  const r = parseYamlSubset(readFileSync(path, "utf8"));
  if (!r.ok) throw new LaunchError("YAML", `${what} ${path}:${r.error.line} ${r.error.what} (found ${r.error.found})`);
  return r.value;
}

export function loadCatalog(path = PATHS.catalog) {
  const doc = readYaml(path, "slot catalog");
  if (!doc || !Array.isArray(doc.slots)) throw new LaunchError("SHAPE", `slot catalog ${path} has no slots: list`);
  return doc.slots;
}

export function loadRegistry(path = PATHS.registry) {
  const doc = readYaml(path, "provider registry");
  if (!doc || !Array.isArray(doc.providers)) throw new LaunchError("SHAPE", `provider registry ${path} has no providers: list`);
  return doc.providers;
}

export function loadProfile(slug, venturesDir = PATHS.venturesDir) {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(slug || "")) throw new LaunchError("BAD_SLUG", `venture slug ${JSON.stringify(slug)} is not [a-z][a-z0-9-]{1,40}`);
  const p = readYaml(join(venturesDir, `${slug}.venture.yaml`), "venture profile");
  if (!p || p.slug !== slug) throw new LaunchError("SHAPE", `venture profile's slug ${JSON.stringify(p && p.slug)} is not ${slug}`);
  for (const [k, allowed] of Object.entries(PROFILE_FIELDS))
    if (!allowed.has(String(p[k]))) throw new LaunchError("SHAPE", `venture profile field ${k}=${JSON.stringify(p[k])} is not one of ${[...allowed].join(" | ")}`);
  return p;
}

// Predicate grammar (phase-00-spec C2): `always` | FIELD == VALUE | FIELD != VALUE, joined by ` and `.
// Anything outside it THROWS -- an unknown predicate must never evaluate to a plausible answer.
export function parsePredicate(text) {
  const t = String(text ?? "").trim();
  if (t === "always") return [];
  return t.split(" and ").map((clause) => {
    const m = clause.trim().match(/^([a-z_]+) (==|!=) ([a-z0-9-]+)$/);
    if (!m) throw new LaunchError("PREDICATE", `predicate clause ${JSON.stringify(clause)} is outside the grammar FIELD ==|!= VALUE`);
    const [, field, op, value] = m;
    const allowed = PROFILE_FIELDS[field];
    if (!allowed || field === "honesty_class") throw new LaunchError("PREDICATE", `predicate field ${field} is not one of type, region, payment_model, tenancy, ai`);
    if (!allowed.has(value)) throw new LaunchError("PREDICATE", `predicate value ${value} is not a ${field} value`);
    return { field, op, value };
  });
}

export function evalPredicate(text, profile) {
  return parsePredicate(text).every(({ field, op, value }) => (String(profile[field]) === value) === (op === "=="));
}

// The board: every slot resolved against the profile. Optional slots are shown as skipped, never hidden (ADR-1710).
export function resolveBoard(slots, profile) {
  const board = new Map();
  for (const s of slots) {
    if (s.tier === "optional") {
      const forType = (s.optional_for || []).includes("any") || (s.optional_for || []).includes(profile.type);
      board.set(s.id, { slot: s, applies: false, reason: forType ? `optional for ${profile.type}, not opted in` : `not offered for ${profile.type}` });
      continue;
    }
    const applies = evalPredicate(s.required_when ?? "always", profile);
    board.set(s.id, { slot: s, applies, reason: applies ? null : `predicate false: ${s.required_when}` });
  }
  return board;
}

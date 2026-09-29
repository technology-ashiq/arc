/**
 * card.mjs -- the role card grammar (org Phase 00, ADR-1601 / ADR-1614 / ADR-1609).
 *
 * A card BINDS things that already exist; it never copies what an agent file says. This module
 * only judges one parsed card against a context the caller derives from the tree (tiers from
 * engine/router.yaml, E2 strings from hq.policy.yaml, drivers from engine/drivers/, KINDS from
 * the spine vocabulary). Nothing here reads the filesystem: the gate owns discovery, so a test
 * can hand in any context and the grammar cannot quietly depend on the machine it runs on.
 *
 * validateCard returns findings, never throws on bad input: a gate that stops at the first bad
 * card hides the other seventy.
 */

export const DEPTS = Object.freeze([
  "a-board", "b-ceo-office", "c-research", "d-product", "e-engineering",
  "f-design", "g-growth", "h-sales", "i-support", "j-finance-legal-people",
]);
export const STAGES = Object.freeze(["discover", "validate", "build", "launch", "grow", "sell", "support", "operate"]);
export const SEATS = Object.freeze(["agent", "skill", "script", "process", "human", "partial", "vacant"]);
export const ORIGINS = Object.freeze(["own", "hired"]);
export const AUTONOMY = Object.freeze(["L0", "L1", "L2", "L3"]);
export const OWNER = "human:ashiq";

// Seats that do the work themselves, and so must name the tier they run at. A human or a
// vacancy runs at no tier, and inventing one for them would be a model choice nobody made.
const TIERED_SEATS = new Set(["agent", "skill", "partial"]);
// Seats that can be "staffed" -- held by something in the tree, legitimised once.
const WORKING_SEATS = new Set(["agent", "skill", "script", "process"]);

const KEYS = new Set([
  "id", "title", "dept", "mission", "stages", "seat", "owner_choice", "byline", "origin", "hire",
  "binds", "reports_to", "escalate_to", "e2", "produces", "consumes", "fixtures", "legitimacy",
  "ventures", "kpi", "autonomy_ceiling", "review_by", "history",
]);
const BIND_KEYS = new Set(["agents", "skills", "scripts", "process", "tier"]);
const HIRE_KEYS = new Set(["runtime", "source", "vetted_by"]);
const PRODUCES_KEYS = new Set(["kind", "schema", "receipt"]);
const KPI_KEYS = new Set(["name", "over", "via", "where"]);

const ID_RE = /^[a-z][a-z0-9-]{1,63}$/;
const KIND_ID_RE = /^[a-z][a-z0-9-]{1,63}$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_RE = /^(openrouter|omniroute|mcp|skill|codex):[a-z0-9._/-]+$/;
// ADR-1614: no seat names a model. Word-bounded so `balanced-workhorse` or a role called
// `opus-editor` is judged on a whole token, and case-folded so `Claude-3` cannot slip by.
export const MODEL_RE = /\b(claude|gpt|o[1-9]|gemini|llama|mistral|deepseek|qwen|glm|grok|haiku|sonnet|opus)\b/i;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isStrList = (v) => Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);
const oneLine = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 200 && !/[\r\n]/.test(v);

/** A role is staffed iff a working seat holds it AND it was legitimised (derived, never typed). */
export function isStaffed(card) {
  return !!card && WORKING_SEATS.has(card.seat) && typeof card.legitimacy === "string" && card.legitimacy.length > 0;
}

// hire.source is provenance by design (ADR-1614); the rest are repo PATHS, where `.claude/` is a
// directory name and not a model -- scanning them would fail every card that binds a script.
const NOT_SCANNED = new Set(["hire.source", "binds.scripts", "fixtures", "produces.schema"]);

/** Every string value in the card except the NOT_SCANNED fields. */
function* stringsOf(v, path) {
  if (NOT_SCANNED.has(path)) return;
  if (typeof v === "string") yield [path, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* stringsOf(v[i], `${path}[${i}]`);
  else if (isObj(v)) for (const [k, x] of Object.entries(v)) yield* stringsOf(x, path ? `${path}.${k}` : k);
}

/**
 * @param card  parsed YAML object
 * @param ctx   { stem, dept, tiers:Set, ungrantable:Set, drivers:Set, kinds:Set }
 * @returns {string[]} findings, each naming the card
 */
export function validateCard(card, ctx) {
  const f = [];
  const who = ctx.stem || card?.id || "?";
  const bad = (msg) => f.push(`${who}: ${msg}`);
  if (!isObj(card)) return [`${who}: card is not a mapping`];

  for (const k of Object.keys(card)) if (!KEYS.has(k)) bad(`unknown key "${k}"`);

  if (typeof card.id !== "string" || !ID_RE.test(card.id)) bad(`id must match ${ID_RE}`);
  else if (ctx.stem && card.id !== ctx.stem) bad(`id "${card.id}" differs from its file stem "${ctx.stem}"`);
  if (!oneLine(card.title)) bad("title must be one line, 1-200 chars");
  if (!oneLine(card.mission)) bad("mission must be one line, 1-200 chars");
  if (!DEPTS.includes(card.dept)) bad(`dept must be one of ${DEPTS.join(" ")}`);
  else if (ctx.dept && card.dept !== ctx.dept) bad(`dept "${card.dept}" differs from its directory "${ctx.dept}"`);

  if (!isStrList(card.stages) || card.stages.length === 0) bad("stages must be a non-empty list");
  else for (const s of card.stages) if (!STAGES.includes(s)) bad(`unknown stage "${s}"`);

  if (!SEATS.includes(card.seat)) bad(`seat must be one of ${SEATS.join(" ")}`);
  if (card.owner_choice !== undefined && (card.owner_choice !== true || card.seat !== "human"))
    bad("owner_choice is only `true`, and only on a human seat");
  if (card.byline !== undefined && card.byline !== "ashiq" && card.byline !== "arc") bad("byline must be ashiq or arc");

  if (!ORIGINS.includes(card.origin)) bad("origin must be own or hired -- there is no third state (ADR-1614)");
  if (card.origin === "hired") {
    if (!isObj(card.hire)) bad("origin: hired needs a hire: {runtime, source, vetted_by} block (REQ-11)");
    else {
      for (const k of Object.keys(card.hire)) if (!HIRE_KEYS.has(k)) bad(`unknown hire key "${k}"`);
      if (!ctx.drivers.has(card.hire.runtime)) bad(`hire.runtime "${card.hire.runtime}" is not an arc-run driver (REQ-11)`);
      if (typeof card.hire.source !== "string" || !SOURCE_RE.test(card.hire.source)) bad(`hire.source must match ${SOURCE_RE}`);
      if (card.hire.vetted_by !== "capability-scout") bad("hire.vetted_by must be capability-scout (ADR-0110)");
    }
  } else if (card.hire !== undefined && card.hire !== null) bad("hire is only legal with origin: hired");

  // binds
  if (!isObj(card.binds)) bad("binds must be a mapping");
  else {
    for (const k of Object.keys(card.binds)) if (!BIND_KEYS.has(k)) bad(`unknown binds key "${k}"`);
    for (const k of ["agents", "skills", "scripts"])
      if (!Array.isArray(card.binds[k]) || !card.binds[k].every((x) => typeof x === "string" && x.length > 0))
        bad(`binds.${k} must be a list of names`);
    if (card.binds.process !== null && (typeof card.binds.process !== "string" || !card.binds.process)) bad("binds.process must be a stem or null");
    const t = card.binds.tier;
    if (TIERED_SEATS.has(card.seat)) {
      if (!ctx.tiers.has(t)) bad(`binds.tier "${t}" is not a router tier (${[...ctx.tiers].join(" ")})`);
    } else if (t !== null && t !== undefined && !ctx.tiers.has(t)) bad(`binds.tier "${t}" is not a router tier`);
    if (card.seat === "agent" && Array.isArray(card.binds.agents) && card.binds.agents.length === 0)
      bad("seat: agent binds no agent");
  }

  for (const k of ["reports_to", "escalate_to"])
    if (typeof card[k] !== "string" || !(card[k] === OWNER || ID_RE.test(card[k]))) bad(`${k} must be a role id or ${OWNER}`);

  // E2 (ADR-1609): verbatim strings only, and a non-empty list means the owner holds the seat.
  if (!Array.isArray(card.e2)) bad("e2 must be a list (may be empty)");
  else {
    for (const s of card.e2) if (!ctx.ungrantable.has(s)) bad(`e2 "${s}" is not a verbatim ungrantable_actions string (REQ-03)`);
    if (card.e2.length > 0 && card.seat !== "human") bad(`touches E2 (${card.e2.join("; ")}) but is seated "${card.seat}" -- only ${OWNER} may hold it (REQ-03)`);
    if (card.e2.includes("publishing under Ashiq's name") && card.byline !== "ashiq")
      bad("carries the publishing E2 but its byline is not ashiq");
  }

  // produces / consumes (ADR-1617)
  if (card.produces !== null) {
    if (!isObj(card.produces)) bad("produces must be {kind, schema, receipt} or null");
    else {
      for (const k of Object.keys(card.produces)) if (!PRODUCES_KEYS.has(k)) bad(`unknown produces key "${k}"`);
      if (!KIND_ID_RE.test(card.produces.kind || "")) bad("produces.kind must be a kebab id");
      const sc = card.produces.schema;
      if (sc !== "pending" && !(typeof sc === "string" && /^docs\/schemas\/[a-z0-9-]+\.md$/.test(sc))) bad("produces.schema must be docs/schemas/KIND.md or pending");
      if (card.produces.receipt !== "handoff.ready") bad("produces.receipt must be handoff.ready");
    }
  }
  if (!Array.isArray(card.consumes) || !card.consumes.every((x) => KIND_ID_RE.test(x))) bad("consumes must be a list of kebab ids");

  if (!(card.fixtures === "pending" || (isStrList(card.fixtures) && card.fixtures.length > 0))) bad("fixtures must be pending or a non-empty list");

  // legitimacy (REQ-11): genesis legitimises own seats once; a hire is legitimised only by an interview.
  const L = card.legitimacy;
  if (WORKING_SEATS.has(card.seat)) {
    if (L === undefined || L === null) {
      // unlegitimised working seat: legal, it is just not staffed (partial/vacant-like until a hire)
    } else if (L === "genesis") {
      if (card.origin === "hired") bad("a hired seat cannot be legitimised by genesis -- it needs an interview (REQ-11)");
    } else if (typeof L === "string" && L.startsWith("interview:")) {
      if (!ULID_RE.test(L.slice(10))) bad("legitimacy interview:ULID has no valid ULID");
      if (card.fixtures === "pending") bad("staffed by interview with fixtures: pending -- the interview had nothing to run (REQ-11)");
    } else bad("legitimacy must be genesis or interview:ULID");
    if (card.origin === "hired" && isStaffed(card) && card.fixtures === "pending")
      bad("hired seat is staffed with no fixture verdict (REQ-11)");
  } else if (L !== undefined && L !== null) bad(`legitimacy is meaningless on a ${card.seat} seat`);

  if (!Array.isArray(card.ventures) || !card.ventures.every((x) => ID_RE.test(x))) bad("ventures must be a list of slugs");

  if (card.kpi !== "pending") {
    if (!Array.isArray(card.kpi) || card.kpi.length === 0) bad("kpi must be pending or a non-empty list");
    else for (const k of card.kpi) {
      if (!isObj(k)) { bad("kpi entry must be a mapping"); continue; }
      for (const x of Object.keys(k)) if (!KPI_KEYS.has(x)) bad(`unknown kpi key "${x}"`);
      if (!oneLine(k.name)) bad("kpi.name must be one line");
      if (!ctx.kinds.has(k.over)) bad(`kpi over "${k.over}" is not a spine kind (ADR-1603)`);
      if (k.via !== "attribution-map" && k.via !== "payload") bad("kpi.via must be attribution-map or payload");
    }
  }

  if (!AUTONOMY.includes(card.autonomy_ceiling)) bad("autonomy_ceiling must be L0-L3");
  if (L !== undefined && L !== null) {
    if (typeof card.review_by !== "string" || !DATE_RE.test(card.review_by)) bad("a legitimised seat needs review_by: YYYY-MM-DD (ADR-1607)");
  } else if (card.review_by !== undefined && card.review_by !== null) bad("review_by is only set on a legitimised seat");
  if (!Array.isArray(card.history) || !card.history.every((x) => typeof x === "string")) bad("history must be a list of strings");

  for (const [path, s] of stringsOf(card, "")) {
    const m = s.match(MODEL_RE);
    if (m) bad(`${path} names a model ("${m[0]}") -- a seat binds a tier, never a model (ADR-1614)`);
  }
  return f;
}

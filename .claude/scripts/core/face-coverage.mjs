#!/usr/bin/env node
// face-coverage -- REQ-01 / ADR-1311: the Coverage map is the v1 contract, and this
// validator holds it. Every born lane, every spine kind, every command, every agent in
// the TREE must have a home in initiatives/face/contracts/expected-set.json. A part of
// arc with no room is a FAIL, not a review comment -- "onnu vidama" as CI.
//
// FAIL-FROM-BIRTH (the named exception to the WARN-first trial rule): a coverage lint that
// only warns is a hope. Same posture as policy-lint / jobs-lint -- a validator over the
// tree, strict from day one.
//
// The MUTANT is the negative control: run this against a tree carrying a lane and a kind
// that the contract does not name, and it must FAIL naming BOTH. `--mutant-selftest`
// proves that in-process (a coverage gate that cannot fail closed proves nothing -- the
// exact vacuous-pass shape this repo has shipped before).
//
//   face-coverage.mjs [repo-root]
//   face-coverage.mjs --selftest        # assert the mutant FAILs and a clean tree passes
//
// Exit: 0 all covered | 1 a gap (named) | 2 the contract or the tree could not be read.

import { readFileSync, existsSync, readdirSync, statSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");

/**
 * "Was this file RUN, or imported?" -- realpath on BOTH sides.
 *
 * The cheap `endsWith` form silently answers NO behind a symlink or a renamed copy: an
 * adversarial pass copied this gate to another filename, pointed it at a tree with three
 * real gaps, and got a silent exit 0. A gate that no-ops under a different spelling is
 * worse than no gate at all, because it reports success. Same fix as arc-event.mjs --
 * which I had already made THAT DAY and then wrote the weak form here: grep the pattern,
 * not the file.
 */
function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

// ---------- tree truths (derived, never copied -- ADR-0107) ----------
async function treeKinds(repo) {
  // The vocabulary is whatever validate.mjs says it is, imported, not re-listed. A copy
  // here would be exactly the stale-count defect the design source itself reproduced.
  // pathToFileURL: a bare Windows path (c:\...) is rejected by the ESM loader as an
  // unknown-scheme URL; import() needs a file:// URL on every OS.
  const mod = await import(pathToFileURL(join(repo, ".claude/scripts/hq/lib/validate.mjs")).href);
  return [...mod.KINDS];
}
function dirNames(p) {
  if (!existsSync(p)) return [];
  return readdirSync(p).filter((n) => { try { return statSync(join(p, n)).isDirectory(); } catch { return false; } });
}
function mdStems(p) {
  if (!existsSync(p)) return [];
  return readdirSync(p).filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3));
}
/** processes/<name>.process.yaml -> "<name>". The contract keys them by the bare name. */
function yamlStems(p) {
  if (!existsSync(p)) return [];
  const suffix = ".process.yaml";
  return readdirSync(p).filter((n) => n.endsWith(suffix)).map((n) => n.slice(0, -suffix.length));
}

// ---------- the seven inventories added by ADR-1317 ----------
//
// WHY THEY EXIST. Everything above compares one list against another list. That is a real
// check and it is not the claim the owner asked for: "ethume miss aga kodathu" -- nothing in
// arc may be missing from the face. A gate whose expected set IS the contract reports "all
// covered" forever, however much grows outside it, and on 2026-08-23 a fresh audit measured
// exactly that: nine whole surfaces of arc invisible while this gate printed "all covered".
//
// So each of these walks the SOURCE OF TRUTH on disk. A gate added to arc.gates.yaml, a job
// added to hq.jobs.yaml, a venture, a plan, an ADR century, a planned room -- each becomes a
// named failure without anyone remembering to update a list.

/**
 * Read one of arc's YAML files through THE parser, never a regex of our own.
 *
 * `hq.jobs.yaml`'s own header states the rule: this file is parsed by the same frozen subset
 * the engine uses (ADR-0200) "so that arc never grows a second YAML parser class". A
 * hand-rolled `^  - name:` scan here would be that second class, and it would disagree with
 * the real parser on exactly the inputs that matter -- a commented-out gate, a quoted name, a
 * block scalar containing the string it greps for.
 *
 * Loaded lazily and by URL because this gate must keep running in a tree where the engine
 * directory is absent; an inventory that cannot be read is reported, never silently empty.
 */
async function readYaml(repo, relPath) {
  const p = join(repo, relPath);
  if (!existsSync(p)) return { ok: false, why: `${relPath} is not on this tree` };
  let parseYamlSubset;
  try {
    ({ parseYamlSubset } = await import(pathToFileURL(join(repo, ".claude", "scripts", "engine", "yaml-subset.mjs")).href));
  } catch (e) { return { ok: false, why: `the canonical YAML parser could not be loaded (${e.code || e.message})` }; }
  try {
    const res = parseYamlSubset(readFileSync(p, "utf8"));
    if (!res || res.ok !== true) return { ok: false, why: `${relPath} did not parse: ${res?.error || "unknown"}` };
    return { ok: true, value: res.value };
  } catch (e) { return { ok: false, why: `${relPath} did not parse: ${e.message}` }; }
}

/**
 * Pull `name` off each row -- and COUNT the rows that have none instead of dropping them.
 *
 * `.filter(n => typeof n === "string" && n)` discarded a nameless row in silence, so a gate
 * that exists in arc with a malformed entry produced no finding and no count change: the exact
 * claim this gate is built to make impossible, defeated by a missing key. A row that cannot be
 * named cannot be homed either, and "I could not read one of them" is the honest answer.
 *
 * @param {unknown[]} rows @param {string} label @param {string} file
 */
function namesOrDrop(rows, label, file) {
  const names = [];
  let nameless = 0;
  for (const r of rows) {
    const n = r && typeof r === "object" ? /** @type {Record<string, unknown>} */ (r).name : undefined;
    if (typeof n === "string" && n) names.push(n);
    else nameless++;
  }
  if (nameless) return { unreadable: `${file} carries ${nameless} ${label} row(s) with no name -- a row that cannot be named cannot be homed`, names };
  return { names };
}

/** `arc.gates.yaml` -> the 7 ship gates, by name. A machine-readable 1:1 registry. */
export async function treeGates(repo) {
  const doc = await readYaml(repo, "arc.gates.yaml");
  if (!doc.ok) return { unreadable: doc.why, names: [] };
  // UNREADABLE, not empty, when the key is the wrong shape. `treeVentures` and
  // `treePlannedRooms` already had this; these two twins did not, so a `gates:` that parsed to
  // a map produced a clean empty inventory and a perfect score.
  if (!Array.isArray(doc.value?.gates)) return { unreadable: "arc.gates.yaml has no gates list", names: [] };
  return namesOrDrop(doc.value.gates, "gate", "arc.gates.yaml");
}

/** `hq.jobs.yaml` -> the scheduled jobs. The only things in the company that run unattended. */
export async function treeJobs(repo) {
  const doc = await readYaml(repo, "hq.jobs.yaml");
  if (!doc.ok) return { unreadable: doc.why, names: [] };
  if (!Array.isArray(doc.value?.jobs)) return { unreadable: "hq.jobs.yaml has no jobs list", names: [] };
  return namesOrDrop(doc.value.jobs, "job", "hq.jobs.yaml");
}

/**
 * `ventures.yaml` -> the ventures and their kill lines.
 *
 * A MAP keyed by venture id, not a list -- getting that wrong would have produced an empty
 * inventory that passes, which is the silent-zero failure this whole phase is about.
 */
export async function treeVentures(repo) {
  const doc = await readYaml(repo, "ventures.yaml");
  if (!doc.ok) return { unreadable: doc.why, names: [] };
  const v = doc.value?.ventures;
  if (!v || typeof v !== "object" || Array.isArray(v)) return { unreadable: "ventures.yaml has no ventures map", names: [] };
  return { names: Object.keys(v) };
}

/**
 * `docs/adr/` -> one row per CENTURY BAND, not per file.
 *
 * 266 rows would drown the contract and tell the owner nothing. The bands are already how a
 * person navigates the decision record -- PORTFOLIO.md assigns one century per lane, and the
 * band is what someone actually holds in their head when asking "why did we decide X".
 */
export function treeAdrBands(repo) {
  const dir = join(repo, "docs", "adr");
  if (!existsSync(dir)) return { unreadable: "docs/adr is not on this tree", names: [] };
  const files = readdirSync(dir).filter((n) => /^\d{4}-.+\.md$/.test(n));
  const bands = new Set(files.map((n) => n.slice(0, 2) + "00"));
  return { names: [...bands].sort(), fileCount: files.length };
}

/**
 * `docs/strategy/plans/` -> the PLAN and BRIEF documents the strategy room queues.
 *
 * PREFIXED, not "every .md". The first cut took the whole directory and homed
 * `docs/strategy/plans/README.md` as a plan; the Strategy room then rendered a chip called
 * "README" beside twenty-four real plans. That file is the directory's own index -- it names
 * the pack and carries the kickoff instructions -- and a room that cannot tell a plan from
 * the shelf it sits on is showing the owner its filesystem rather than his company.
 *
 * This is the one exclusion added by ADR-1317, and it obeys that ADR's own rule: an exclusion
 * NAMES THE FILE that makes it true. Here it is `README.md`, and the prefix test is what makes
 * a second index file (`INDEX.md`, `_toc.md`) excluded for the same stated reason rather than
 * by a growing list of filenames nobody re-reads.
 */
export function treePlans(repo) {
  const dir = join(repo, "docs", "strategy", "plans");
  if (!existsSync(dir)) return { unreadable: "docs/strategy/plans is not on this tree", names: [] };
  // EXCLUDE the index files by name; do not ALLOW-LIST two prefixes.
  //
  // The prefix allow-list was written to exclude README.md and then silently excluded every
  // other spelling too -- `roadmap-2027.md`, `cycle8-plan.md` -- which is the same defect
  // ADR-1317 named for `gates`: an exclusion inherited by rows it was never written about.
  // Latent today (the real directory is 24 prefixed files plus README.md) and live the moment
  // someone names a plan differently, which is exactly when nobody would be looking.
  const INDEX_FILES = new Set(["README", "INDEX", "_index", "_toc"]);
  const md = readdirSync(dir).filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3));
  const excluded = md.filter((n) => INDEX_FILES.has(n));
  const names = md.filter((n) => !INDEX_FILES.has(n));
  // Say what was left out. A silent exclusion is how the last one grew past its reason.
  return excluded.length ? { names, excluded } : { names };
}

/**
 * What arc actually HAS installed: skills, MCP servers, pinned tool images.
 *
 * `/arc-capability` and `/arc-toolcheck` exist as commands and are homed; what they operate
 * ON was in no inventory, so a second skill or a stale MCP server changed nothing anywhere.
 * Namespaced (`skill:`, `mcp:`, `image:`) because the three name-spaces can collide and a
 * collision would silently make one cover for the other.
 */
export function treeCapabilities(repo) {
  const names = [];
  const skillsDir = join(repo, ".claude", "skills");
  for (const s of dirNames(skillsDir)) names.push(`skill:${s}`);
  // A skill written as a LOOSE FILE rather than a directory was dropped in silence, so a
  // capability that exists in arc had no row and no failure. `dirNames` answers only the
  // directory question, and the answer to the other one was nothing at all.
  if (existsSync(skillsDir)) {
    const loose = readdirSync(skillsDir).filter((n) => { try { return !statSync(join(skillsDir, n)).isDirectory(); } catch { return false; } });
    if (loose.length) return { unreadable: `.claude/skills holds ${loose.length} entr(y/ies) that are not directories (${loose.slice(0, 3).join(", ")}) -- this reader only understands one skill per directory`, names };
  }
  const mcpPath = join(repo, ".mcp.json");
  if (existsSync(mcpPath)) {
    try {
      const parsed = JSON.parse(readFileSync(mcpPath, "utf8"));
      // A .mcp.json with no `mcpServers` is a file this reader does not understand, not a
      // repo with no servers. The two were the same answer, and only one of them is true.
      if (!parsed || typeof parsed.mcpServers !== "object" || parsed.mcpServers === null)
        return { unreadable: ".mcp.json carries no mcpServers object -- present but not in the shape this reader knows", names };
      for (const s of Object.keys(parsed.mcpServers)) names.push(`mcp:${s}`);
    } catch { return { unreadable: ".mcp.json did not parse", names }; }
  }
  for (const d of dirNames(join(repo, "docker"))) names.push(`image:${d}`);
  return { names };
}

/**
 * `.claude/hooks/` -> the hook surface, derived rather than exempted.
 *
 * `hooks` used to be excluded from tree derivation with the sentence "15 units behind 7
 * event-level rows -- the inventory is the EVENT". An adversarial pass measured that: there
 * are **6** event directories, not 7, and the seventh contract row is `_dispatch.sh`, which is
 * a script and not an event. Worse, `policy-decide.sh` sits at the top of that directory and
 * appears in **no** contract row at all -- invisible precisely because the inventory was
 * exempt from being derived.
 *
 * That is the same defect ADR-1317 named for `gates`: an exclusion whose stated reason does
 * not describe the tree. The honest inventory is the 6 events PLUS every top-level script that
 * is not one of their wrappers, so a new hook cannot arrive without a row.
 *
 * @param {string} repo
 */
export function treeHooks(repo) {
  const dir = join(repo, ".claude", "hooks");
  if (!existsSync(dir)) return { unreadable: ".claude/hooks is not on this tree", names: [] };
  const entries = readdirSync(dir, { withFileTypes: true });
  const events = entries.filter((e) => e.isDirectory() && e.name.endsWith(".d")).map((e) => e.name.slice(0, -2));
  // A top-level `X.sh` beside an `X.d/` is that event's wrapper and is the SAME thing, not a
  // second one. Anything else at the top level is its own unit and needs its own row.
  const eventSet = new Set(events);
  const loose = entries
    .filter((e) => e.isFile() && e.name.endsWith(".sh"))
    .map((e) => e.name.slice(0, -3))
    .filter((n) => !eventSet.has(n));
  return { names: [...events, ...loose.map((n) => `${n}.sh`)].sort() };
}

/**
 * `.claude/scripts/**` -> the lint surface, derived rather than exempted.
 *
 * The old exemption read "29 rows over 34 lint-named scripts". Measured: **18**, and the 29
 * rows include a dozen entries that are not lint-named at all (`design-gate`, `render-hash`,
 * `spec-verify`, ...). Neither number supported the sentence, which is the same failure mode
 * as the `gates` exclusion ADR-1317 already caught: a reason nobody re-measured.
 *
 * TWO EXCLUSIONS REMAIN and both name their criterion rather than a filename:
 *   - anything under a `lib/` directory is an IMPLEMENTATION of a row, not a row. Measured on
 *     2026-08-23: 18 lint-named files, **5** of them under `lib/` (growth/lib/citation-lint,
 *     growth/lib/slop-lint, hq/lib/policy/lint, leads/lib/research-lint, legal/lib/lints),
 *     leaving 13 -- every one of which has a contract row. The rule keeps holding as those
 *     libraries move, which a list of five filenames would not.
 *   - a contract row that is not lint-named is fine and stays. The check is tree ⊆ contract:
 *     a curated row for `design-gate` costs nothing, and a NEW lint script with no row fails.
 *
 * @param {string} repo
 */
export function treeLints(repo) {
  const root = join(repo, ".claude", "scripts");
  if (!existsSync(root)) return { unreadable: ".claude/scripts is not on this tree", names: [] };
  const names = [];
  const walk = (d, underLib) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) { walk(full, underLib || e.name === "lib"); continue; }
      if (underLib) continue;
      if (!/lint/i.test(e.name)) continue;
      if (!/\.(mjs|sh)$/.test(e.name)) continue;
      names.push(e.name.replace(/\.(mjs|sh)$/, ""));
    }
  };
  walk(root, false);
  return { names: [...new Set(names)].sort() };
}

/**
 * `.github/workflows/` -> the CI surface.
 *
 * WHY WORKFLOWS AND NOT SUITES. There are 168 bats suites; 168 contract rows would drown the
 * inventory and tell the owner nothing, the same reason ADRs are banded. And a test suite is
 * not a feature of arc that needs a room -- it is how a feature is proven. The WORKFLOWS are
 * the surface: they are what runs, what goes red, and what a phase closes against.
 *
 * What this deliberately does NOT do is report whether the last run was green. That is live
 * state and the face has no feed for it, so the room says `not instrumented` rather than
 * inventing a colour. Arc's own law is "tests green means green on CI, read per JOB" -- a
 * fabricated green here would be the exact failure the whole face exists to prevent.
 */
export function treeCi(repo) {
  const dir = join(repo, ".github", "workflows");
  if (!existsSync(dir)) return { unreadable: ".github/workflows is not on this tree", names: [] };
  const files = readdirSync(dir).filter((n) => /\.ya?ml$/.test(n));
  let suites = 0;
  try { suites = readdirSync(join(repo, "tests")).filter((n) => n.endsWith(".bats")).length; } catch { /* the count is a note, not the inventory */ }
  return { names: files.map((n) => `workflow:${n.replace(/\.ya?ml$/, "")}`), suiteCount: suites };
}

/**
 * `planned-rooms.json` -> the rooms arc has DECLARED but not built.
 *
 * This one caught a live defect the moment it was written: four planned rooms are declared
 * here and in ADR-1306, and `chat-mcp` existed in no registry, no room-copy row and no Map
 * station. The Map drew 33 stations and silently omitted a declared dotted one -- a map that
 * hides a gap being precisely what the Map contract says a map cannot be.
 */
export function treePlannedRooms(repo) {
  const p = join(repo, "initiatives", "face", "contracts", "planned-rooms.json");
  if (!existsSync(p)) return { unreadable: "planned-rooms.json is not on this tree", names: [] };
  try {
    const list = JSON.parse(readFileSync(p, "utf8")).rooms;
    if (!Array.isArray(list)) return { unreadable: "planned-rooms.json has no rooms array", names: [] };
    return { names: list.map((r) => r?.room).filter((n) => typeof n === "string" && n) };
  } catch (e) { return { unreadable: `planned-rooms.json did not parse: ${e.message}`, names: [] }; }
}

// ---------- the check (pure: tree facts + contract -> findings) ----------
export function coverageFindings({ kinds, lanes, commands, agents, products, rules, processes, contract,
  // ADR-1317: seven inventories derived from the WORLD rather than from the contract.
  gates, jobs, ventures, adrBands, plans, capabilities, plannedRooms, ci, hooks, lints }) {
  const findings = [];
  const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

  // The room ids are the vocabulary everything else points at, so they are validated FIRST
  // and as VALUES, not as a count. An adversarial pass (2026-08-19) deleted a room's `id`,
  // duplicated one, and swapped a room for a filler with a duplicate id — the list length
  // stayed 32 through all three and every gate stayed green. A count pins key-count, never
  // truth.
  const roomRows = contract.rooms?.list || [];
  const ids = roomRows.map((r) => r && r.id);
  if (ids.some((i) => typeof i !== "string" || i === ""))
    findings.push(`[contract] rooms.list carries a row with a missing or non-string id`);
  if (new Set(ids).size !== ids.length)
    findings.push(`[contract] rooms.list has duplicate ids — ${ids.length} rows, ${new Set(ids).size} distinct`);
  const tplId = contract.rooms?.template?.id;
  const roomIds = new Set([...ids.filter((i) => typeof i === "string" && i), ...(tplId ? [tplId] : [])]);
  const rings = new Set(contract.rings || []);
  for (const r of roomRows)
    if (r && r.id && rings.size && !rings.has(r.ring))
      findings.push(`[contract] room "${r.id}" declares ring "${r.ring}", which is not one of (${[...rings].join(", ")})`);

  // A kind needs a home that EXISTS. Presence of the key proves only that someone typed it:
  // `{}`, `{homes: []}` and `{homes: ["ghost-room"]}` all satisfied the old check, and the
  // sanctioned regenerate then made the corruption permanent and green.
  // `*`-prefixed homes (e.g. `*decide-zones`) are legitimate non-room homes, by design.
  const kindMap = contract.kinds?.map || {};
  for (const k of kinds) {
    if (!has(kindMap, k)) { findings.push(`[kind] "${k}" is a live spine kind with no home in the contract (typed or generic)`); continue; }
    const homes = kindMap[k] && kindMap[k].homes;
    if (!Array.isArray(homes) || homes.length === 0) {
      findings.push(`[kind] "${k}" has an entry but no homes — an empty home is homelessness with a key`);
      continue;
    }
    for (const h of homes)
      if (typeof h !== "string" || (!h.startsWith("*") && !roomIds.has(h)))
        findings.push(`[kind] "${k}" is homed in "${h}", which is not a room in this contract`);
  }

  const laneMap = contract.lanes?.map || {};
  for (const l of lanes) {
    if (!has(laneMap, l)) { findings.push(`[lane] "${l}" is a born lane (initiatives/${l}/) with no room in the contract`); continue; }
    // A BORN lane pointing at a room that does not exist is a FAIL, not a WARN. The old code
    // warned for every entry alike, on the theory that a stale row is the remover's cleanup —
    // but it never asked whether the lane exists, so a live lane with a typo'd room sailed
    // through the gate whose single job is "every born lane has a room".
    const room = laneMap[l];
    if (typeof room !== "string" || !roomIds.has(room))
      findings.push(`[lane] born lane "${l}" maps to "${room}", which is not a room in this contract`);
  }

  // A product may carry a `face:` section ONLY if the contract maps it to a room. Otherwise
  // an invented section sits in a manifest that no gate reads: product-lint defers schema
  // validation to this gate, and this gate did not look at products at all — a delegation
  // that closed a circle around nothing.
  const productMap = contract.products?.map || {};
  for (const p of products || []) {
    const mapped = has(productMap, p.name);
    if (mapped && !roomIds.has(productMap[p.name]))
      findings.push(`[product] "${p.name}" maps to room "${productMap[p.name]}", which is not a room in this contract`);
    if (!mapped && p.hasFace)
      findings.push(`[product] "${p.name}" carries a face: section but the contract maps it to no room — a section nothing renders`);
  }

  const cmdMap = contract.commands?.map || {};
  // commands carry a "(G)" suffix in the contract for generated ones; match on the stem.
  const stripTag = (k) => k.replace(/\s*\((?:G|legacy)\)$/, "").trim();
  const cmdKeys = new Set(Object.keys(cmdMap).map(stripTag));
  for (const c of commands)
    if (!cmdKeys.has(c)) findings.push(`[command] "/${c}" exists in .claude/commands/ with no Toolbelt/Review home in the contract`);

  const agentMap = contract.agents?.map || {};
  const agentKeys = new Set(Object.keys(agentMap).map((k) => k.replace(/\s*\(legacy\)$/, "").trim()));
  for (const a of agents)
    if (!agentKeys.has(a)) findings.push(`[agent] "${a}" exists in .claude/agents/ with no room in the contract`);


  // ---- the six inventories that pointed at nothing ----------------------------------
  // Until 2026-08-23 this gate validated kinds, lanes, commands, agents and products, and
  // NOTHING ELSE. gates · hooks · rules · lints · processes · concepts — 164 contract rows
  // between them, every one naming a room — were never read. All 164 happened to be
  // correct, which is exactly why it went unnoticed: an unchecked map that is right today
  // looks identical to a checked one. The owner's mandate is "ethume miss aga kodathu", and
  // the gate that is supposed to make that checkable was covering 5 of 11 inventories.
  //
  // The failure this closes is the same one already found in `kinds`: a row whose room is a
  // typo, a rename, or a room that was cut. `concepts` matters most — 107 terms are the ⌘K
  // backing store, so a concept homed in a ghost room is a search result that opens nothing.
  const roomRef = (inv, name, room) => {
    if (typeof room !== "string" || room === "")
      findings.push(`[${inv}] "${name}" has no room — an entry with no home is homelessness with a key`);
    else if (!roomIds.has(room))
      findings.push(`[${inv}] "${name}" is homed in "${room}", which is not a room in this contract`);
  };
  for (const inv of ["gates", "hooks", "rules", "lints", "processes"]) {
    const map = contract[inv]?.map || {};
    for (const name of Object.keys(map)) roomRef(inv, name, map[name]);
  }

  // ---- and the OTHER direction, which these two were missing ---------------------------
  //
  // Every other inventory got the "a key that exists is not a value that resolves" fix. These
  // two kept only the tree->contract check, so the ROOM on the right-hand side was never read
  // -- 56 rows, the two largest inventories in the contract, pointing anywhere at all.
  //
  // An adversarial pass aimed three commands and two agents at rooms that do not exist. The
  // gate said "all covered" and exited 0; the sanctioned regenerate then wrote a registry
  // with 23 command rows instead of 26 and 28 agent rows instead of 30 -- /arc-ship, /arc-qa,
  // /arc-audit, code-reviewer and qa-tester absent from every room, gone from the rail, the
  // Map and the palette -- and `--check`, the selftest and the whole L3 suite stayed green.
  // `""`, `null` and `{}` as the room value all passed identically.
  //
  // That is precisely the defect the 2026-08-23 extension was written to close, left in 2 of
  // 11 inventories: the twin-fix shape, inside the very change that was fixing the twins.
  for (const [name, room] of Object.entries(cmdMap))
    roomRef("command", `/${stripTag(name)}`, room);
  for (const [name, room] of Object.entries(agentMap))
    roomRef("agent", name.replace(/\s*\(legacy\)$/, "").trim(), room);
  // A concept carries a station as well as a room: "which room" without "where in it" is
  // half an answer, and ⌘K needs both to land the reader on the right zone.
  const conceptMap = contract.concepts?.map || {};
  for (const term of Object.keys(conceptMap)) {
    const c = conceptMap[term];
    if (!c || typeof c !== "object") { findings.push(`[concept] "${term}" has no { room, station } entry`); continue; }
    roomRef("concept", term, c.room);
    if (typeof c.station !== "string" || !c.station.trim())
      findings.push(`[concept] "${term}" names no station — a room without a station is half a destination`);
  }

  // ---- two more tree truths, derived the same way as the others -----------------------
  // Both are unambiguous on disk, which is why they are checked as TREE facts rather than
  // only as contract-internal references.
  //
  // THE REMAINING EXCLUSIONS, each naming the file that makes it true (ADR-1317). The old
  // note covered `gates`, `hooks` and `lints` with one sentence -- "their on-disk spelling
  // does not map 1:1 to the inventory" -- and an audit measured that sentence FALSE for
  // gates: `arc.gates.yaml` carries exactly seven `- name:` rows, exactly the seven contract
  // keys, a machine-readable registry. An eighth gate would have got no room and no failure.
  // `gates` is now derived from the world with the others; these two keep the exemption:
  //
  //   hooks  -- .claude/hooks/*.d/ holds 15 units behind 7 event-level rows. The inventory
  //             is the EVENT, deliberately, because that is the thing a person reasons about.
  //   lints  -- 29 rows over 34 lint-named scripts; `legal-lints (4)` is one row for four
  //             scripts on purpose. A 1:1 derivation here would invent five false failures.
  //
  // An exclusion that does not name its file cannot be checked, and gets inherited by rows it
  // was never written about -- which is exactly how gates kept a reason belonging to lints.
  const ruleMap = contract.rules?.map || {};
  for (const r of rules || [])
    if (!has(ruleMap, r)) findings.push(`[rule] ".claude/rules/${r}.md" exists on the tree with no room in the contract`);

  const procMap = contract.processes?.map || {};
  for (const p of processes || [])
    if (!has(procMap, p)) findings.push(`[process] "${p}" exists in processes/ with no room in the contract`);

  // ---- the seven world-derived inventories (ADR-1317) ---------------------------------
  //
  // Everything above this line compares the contract against itself or against a tree fact
  // someone remembered to gather. These seven walk a source of truth, so the gate fails when
  // ARC grows -- not when the contract does.
  //
  // Each is checked the same way and each gets its own exit arm in the selftest, because the
  // lesson from the last extension is that a mutant deleting ONE loop is invisible to a
  // control that only proves "some finding appeared".
  const worldInventories = [
    ["gate", "gates", gates, (n) => `"${n}" is declared in arc.gates.yaml`],
    ["job", "jobs", jobs, (n) => `"${n}" is scheduled in hq.jobs.yaml and runs unattended`],
    ["venture", "ventures", ventures, (n) => `"${n}" carries a kill line in ventures.yaml`],
    ["adr-band", "adrs", adrBands, (n) => `the ${n} ADR band exists in docs/adr/`],
    ["plan", "plans", plans, (n) => `"${n}" exists in docs/strategy/plans/`],
    ["capability", "capabilities", capabilities, (n) => `"${n}" is installed in this repo`],
    ["planned-room", "plannedRooms", plannedRooms, (n) => `"${n}" is declared in planned-rooms.json`],
    ["ci", "ci", ci, (n) => `"${n}" runs in .github/workflows/`],
    ["hook", "hooks", hooks, (n) => `"${n}" is a hook unit in .claude/hooks/`],
    ["lint", "lints", lints, (n) => `"${n}" is a lint script in .claude/scripts/`],
  ];
  // ---- THE META-CHECK: every contract inventory is DERIVED by something ----------------
  //
  // This class bit twice in one day and it is the reason this block exists rather than a
  // written rule. The contract grew and a place that has to grow with it did not:
  //
  //   - `zonesFor` was a fixed list of 11 zone keys; eight inventories arrived and the screen
  //     would have shown nothing, with no error anywhere.
  //   - `roomRegistry`'s `byRoom` was a fixed list of 17; an 18th inventory rendered nowhere
  //     while both gates exited 0 -- and that one made the zonesFor fix unreachable, so the
  //     same defect in two layers hid each other.
  //
  // A written "remember to update all three" is precisely the kind of rule CLAUDE.md records
  // as having failed to take. So the gate asks the question instead: is there a contract
  // inventory that NOTHING derives? An inventory nobody derives can only ever be checked
  // against itself, which is the whole failure ADR-1317 was written about, arriving one key
  // at a time.
  //
  // The contract-only set is EXPLICIT and each entry says how it is derived instead.
  const DERIVED_ELSEWHERE = new Set([
    "kinds",      // treeKinds, imported from validate.mjs
    "lanes",      // dirNames(initiatives/)
    "commands",   // mdStems(.claude/commands)
    "agents",     // mdStems(.claude/agents)
    "products",   // treeProducts
    "rules",      // mdStems(.claude/rules)
    "processes",  // yamlStems(processes/)
    "concepts",   // authored vocabulary, validated as {room, station} above
  ]);
  const derivedHere = new Set(worldInventories.map(([, key]) => key));
  for (const [key, value] of Object.entries(contract)) {
    if (key === "rooms" || key === "rings" || key.startsWith("$") || key === "version" || key === "frozen") continue;
    if (!value || typeof value !== "object" || !value.map) continue;
    if (derivedHere.has(key) || DERIVED_ELSEWHERE.has(key)) continue;
    findings.push(`[contract] inventory "${key}" is in the contract and NOTHING derives it from the tree -- it can only ever be checked against itself, which is the failure this gate exists to end. Add a reader to WORLD_READERS, or name it in DERIVED_ELSEWHERE with how it is derived`);
  }

  for (const [label, contractKey, tree, describe] of worldInventories) {
    // An inventory we could not READ is a finding, never an empty pass. "0 gates" and "the
    // gates file would not parse" are different facts, and the silent-zero version of this
    // check would report a perfect score for a repository it never opened.
    if (tree?.unreadable) {
      findings.push(`[${label}] could not be read from the tree -- ${tree.unreadable}. A source that cannot be read is not a source with nothing in it`);
      continue;
    }
    const map = contract[contractKey]?.map || {};
    for (const name of tree?.names || [])
      if (!has(map, name)) findings.push(`[${label}] ${describe(name)} with no room in the contract`);
    // And the other direction, which two inventories were missing for a whole cycle: a key
    // that exists is not a value that resolves.
    for (const name of Object.keys(map)) roomRef(label, name, map[name]);
  }

  // A contract row for a lane that is NO LONGER in the tree stays a WARN: that is the
  // remover's cleanup, not this gate's block. The live-lane case above is the FAIL.
  const warns = [];
  const born = new Set(lanes);
  for (const lane of Object.keys(laneMap))
    if (!born.has(lane)) warns.push(`[stale] contract maps lane "${lane}", which is not a born lane on this tree`);

  return { findings, warns };
}

function loadContract(repo) {
  const p = join(repo, "initiatives", "face", "contracts", "expected-set.json");
  if (!existsSync(p)) throw new Error(`expected-set.json not found at ${p} -- Phase 00 freezes it`);
  return JSON.parse(readFileSync(p, "utf8"));
}

function treeProducts(repo) {
  const dir = join(repo, "products");
  return dirNames(dir).map((name) => {
    const mpath = join(dir, name, "manifest.json");
    let hasFace = false;
    try { hasFace = Object.prototype.hasOwnProperty.call(JSON.parse(readFileSync(mpath, "utf8")), "face"); }
    catch { /* no manifest, or unreadable — product-lint owns that */ }
    return { name, hasFace };
  });
}

/**
 * Every world-derived inventory, and the SHAPE its reader must return.
 *
 * One table, read by `gather` to build the data AND by the selftest to prove the wiring. It
 * exists because `gather` was an untested seam: the selftest mutates the object gather
 * RETURNS, and `coverage-readers.mjs` imports the readers DIRECTLY -- so a mutant that
 * disconnected any reader inside gather (`plans: { names: [] }`) printed "0 plans ... all
 * covered" and every one of the three controls exited 0.
 *
 * A seam nothing crosses is a seam nothing tests. `selftestWiring` below crosses it.
 */
const WORLD_READERS = [
  ["gates", (repo) => treeGates(repo)],
  ["jobs", (repo) => treeJobs(repo)],
  ["ventures", (repo) => treeVentures(repo)],
  ["adrBands", (repo) => treeAdrBands(repo)],
  ["plans", (repo) => treePlans(repo)],
  ["capabilities", (repo) => treeCapabilities(repo)],
  ["plannedRooms", (repo) => treePlannedRooms(repo)],
  ["ci", (repo) => treeCi(repo)],
  // Derived at last (ADR-1317 amended). Both carried an exclusion whose stated reason was
  // measured false, and `hooks` was hiding a real uncovered file behind it.
  ["hooks", (repo) => treeHooks(repo)],
  ["lints", (repo) => treeLints(repo)],
];

async function gather(repo) {
  return {
    kinds: await treeKinds(repo),
    lanes: dirNames(join(repo, "initiatives")),
    commands: mdStems(join(repo, ".claude", "commands")),
    agents: mdStems(join(repo, ".claude", "agents")),
    products: treeProducts(repo),
    rules: mdStems(join(repo, ".claude", "rules")),
    processes: yamlStems(join(repo, "processes")),
    contract: loadContract(repo),
    // ADR-1317 -- each walks its own source of truth on disk, so the gate fails when ARC
    // grows rather than when the contract does.
    // Built from WORLD_READERS, so the wiring is DATA the selftest can cross-check rather
    // than eight hand-written lines nothing can see. A mutant that disconnected any one of
    // them printed "0 plans ... all covered" past every control this gate had.
    ...Object.fromEntries(await Promise.all(WORLD_READERS.map(async ([key, read]) => [key, await read(repo)]))),
  };
}

/** @param repoOrData a repo path, or a pre-gathered data object (the selftest's exit arm). */
async function run(repoOrData, quiet = false) {
  const data = typeof repoOrData === "string" ? await gather(repoOrData) : repoOrData;
  const { findings, warns } = coverageFindings(data);
  if (quiet) return findings.length ? 1 : 0;
  for (const w of warns) process.stderr.write(`WARN  ${w}\n`);
  if (findings.length) {
    for (const f of findings) process.stderr.write(`FAIL  ${f}\n`);
    process.stderr.write(`face-coverage: ${findings.length} coverage gap(s) -- every part of arc needs a home (ADR-1311)\n`);
    return 1;
  }
  const homedRows = ["gates", "hooks", "rules", "lints", "processes", "adrs", "jobs", "ventures", "plans", "capabilities", "plannedRooms", "ci"]
    .reduce((n, k) => n + Object.keys(data.contract[k]?.map || {}).length, 0)
    + Object.keys(data.contract.concepts?.map || {}).length;
  // The counts are printed from the TREE readers, not from the contract. That is the whole
  // point of ADR-1317: the old line could say "all covered" while nine surfaces of arc were
  // invisible, because every number in it came from the list being checked against itself.
  const w = (inv) => (inv?.unreadable ? "UNREADABLE" : inv.names.length);
  process.stdout.write(`face-coverage: ${data.kinds.length} kinds, ${data.lanes.length} lanes, ${data.commands.length} commands, ${data.agents.length} agents, ${data.products.length} products, ${data.rules.length} rules, ${data.processes.length} processes, ${w(data.gates)} gates, ${w(data.jobs)} jobs, ${w(data.ventures)} ventures, ${w(data.adrBands)} ADR bands (${data.adrBands?.fileCount ?? "?"} files), ${w(data.plans)} plans, ${w(data.capabilities)} capabilities, ${w(data.plannedRooms)} planned rooms, ${w(data.ci)} CI workflows (${data.ci?.suiteCount ?? "?"} bats suites), ${homedRows} homed contract rows -- all covered\n`);
  return 0;
}

// ---------- the mutant self-test (the negative control) ----------
async function selftest(repo) {
  const clean = await gather(repo);
  const { findings: cleanFindings } = coverageFindings(clean);
  const cleanOk = cleanFindings.length === 0;

  // A mutant that only ADDS a lane and a kind is half a control: an adversarial pass showed
  // seven implementation mutants surviving it, because deleting the command loop, the agent
  // loop or a whole tree-reader is invisible to a mutation applied AFTER gather(). So every
  // dimension gets an arm, and each names its own ghost.
  const arms = [
    ["lane", { ...clean, lanes: [...clean.lanes, "ghostlane"] }, "ghostlane"],
    ["kind", { ...clean, kinds: [...clean.kinds, "ghost.kind"] }, "ghost.kind"],
    ["command", { ...clean, commands: [...clean.commands, "ghost-command"] }, "ghost-command"],
    ["agent", { ...clean, agents: [...clean.agents, "ghost-agent"] }, "ghost-agent"],
    ["product", { ...clean, products: [...clean.products, { name: "ghostproduct", hasFace: true }] }, "ghostproduct"],
    // VALUE corruption, not just an absent key: the whole class the old control missed.
    ["kind homed nowhere", withKindHome(clean, []), "no homes"],
    ["kind homed in a ghost room", withKindHome(clean, ["ghost-room-xyz"]), "ghost-room-xyz"],
    ["born lane in a ghost room", withLaneRoom(clean, "ghost-room-xyz"), "ghost-room-xyz"],
    // The six inventories added 2026-08-23. Most arms corrupt a REAL row rather than adding
    // a key, because the class that went unwatched for a cycle was a value pointing nowhere,
    // not an absent entry. Without an arm apiece, deleting any one of the new loops would be
    // invisible — which is how the first five checks were proven and how these must be.
    ["tree rule with no room", { ...clean, rules: [...clean.rules, "ghost-rule"] }, "ghost-rule"],
    ["tree process with no room", { ...clean, processes: [...clean.processes, "ghost-process"] }, "ghost-process"],
    ["gate in a ghost room", withMapRoom(clean, "gates", "ghost-room-xyz"), "ghost-room-xyz"],
    ["hook in a ghost room", withMapRoom(clean, "hooks", "ghost-room-xyz"), "ghost-room-xyz"],
    ["rule row in a ghost room", withMapRoom(clean, "rules", "ghost-room-xyz"), "ghost-room-xyz"],
    ["lint in a ghost room", withMapRoom(clean, "lints", "ghost-room-xyz"), "ghost-room-xyz"],
    ["process row in a ghost room", withMapRoom(clean, "processes", "ghost-room-xyz"), "ghost-room-xyz"],
    ["concept in a ghost room", withConcept(clean, { room: "ghost-room-xyz", station: "x" }), "ghost-room-xyz"],
    ["concept with no station", withConcept(clean, { room: "spine", station: "  " }), "names no station"],
    ["a contract inventory nothing derives", withUnderivedInventory(clean), "NOTHING derives it"],

    // ---- the seven world-derived inventories (ADR-1317) --------------------------------
    //
    // THREE arms apiece, because each closes a different hole and the first two look alike
    // only until one of them is deleted:
    //
    //   ghost on the tree  -- arc grew and the contract did not. This is the one the whole
    //                         phase exists for; without it the gate is back to comparing a
    //                         list against itself.
    //   ghost room         -- the contract row resolves nowhere. A key that exists is not a
    //                         value that resolves; two inventories carried that hole for a
    //                         whole cycle.
    //   unreadable source  -- the source could not be read. This must be a FINDING, never a
    //                         quiet zero: "0 gates" and "arc.gates.yaml would not parse" are
    //                         different facts, and the silent version reports a perfect score
    //                         for a repository it never opened.
    ...[
      ["gate", "gates", "gates"],
      ["job", "jobs", "jobs"],
      ["venture", "ventures", "ventures"],
      ["adr-band", "adrs", "adrBands"],
      ["plan", "plans", "plans"],
      ["capability", "capabilities", "capabilities"],
      ["planned-room", "plannedRooms", "plannedRooms"],
      ["ci", "ci", "ci"],
      ["hook", "hooks", "hooks"],
      ["lint", "lints", "lints"],
    ].flatMap(([label, contractKey, treeKey]) => [
      [`tree ${label} with no room`, withTreeName(clean, treeKey, `ghost-${label}`), `ghost-${label}`],
      [`${label} row in a ghost room`, withMapRoom(clean, contractKey, "ghost-room-xyz"), "ghost-room-xyz"],
      [`${label} source unreadable`, withUnreadable(clean, treeKey), "not a source with nothing in it"],
    ]),
  ];

  let allArmsWiring = true;
  const lines = [`clean tree passes: ${cleanOk ? "PASS" : "FAIL (" + cleanFindings.length + " gaps: " + cleanFindings.slice(0, 3).join("; ") + ")"}`];

  // THE SEAM NOTHING CROSSED.
  //
  // Every mutant below operates on the object `gather()` RETURNED, and coverage-readers.mjs
  // drives the readers DIRECTLY. Between those two lies `gather` itself, which nothing
  // touched -- so disconnecting any reader inside it (`plans: { names: [] }`) printed
  // "0 plans ... all covered" and all three controls exited 0. An adversarial pass measured
  // exactly that, for `plans` and for `gates`, at HEAD.
  //
  // This crosses it: what `gather` produced for each world inventory is compared against what
  // its reader returns when called independently. A disconnected, stubbed, or swapped reader
  // now disagrees with itself and is named.
  for (const [key, read] of WORLD_READERS) {
    const fromGather = clean[key];
    const direct = await read(repo);
    const same = JSON.stringify(fromGather?.names ?? null) === JSON.stringify(direct?.names ?? null)
      && Boolean(fromGather?.unreadable) === Boolean(direct?.unreadable);
    if (!same) allArmsWiring = false;
    lines.push(`wiring ${key.padEnd(26)} gather==reader: ${same ? "PASS" : `FAIL (gather ${JSON.stringify(fromGather?.names)?.slice(0, 60)} vs reader ${JSON.stringify(direct?.names)?.slice(0, 60)})`}`);
    // And a non-empty floor, because two disconnected halves also agree. `capabilities` is the
    // one inventory a repo may legitimately have none of, so it is floored at zero by name.
    const mayBeEmpty = key === "capabilities";
    const populated = Boolean(direct?.unreadable) || mayBeEmpty || (direct?.names?.length ?? 0) > 0;
    if (!populated) allArmsWiring = false;
    lines.push(`wiring ${key.padEnd(26)} reads something: ${populated ? "PASS" : "FAIL (read nothing on a tree that has some)"}`);
  }
  let allArms = allArmsWiring;
  for (const [label, mutant, needle] of arms) {
    const { findings } = coverageFindings(mutant);
    const named = findings.some((f) => f.includes(needle));
    if (!named) allArms = false;
    lines.push(`mutant ${label.padEnd(24)} named: ${named ? "PASS" : "FAIL"}`);
  }

  // THE EXIT-CODE ARMS. Everything above exercises the pure function; nothing proved that a
  // real gap makes the CLI exit non-zero, and two mutants that turned `return 1` into
  // `return 0` were invisible for exactly that reason.
  //
  // ONE arm was not enough, and an adversarial pass showed why: with only a ghost LANE here, a
  // mutant that narrowed `if (findings.length)` to `findings.some(f => f.startsWith("[lane]"))`
  // passed all seventeen arms AND the bats negative arm, while silently exiting 0 on a tree
  // carrying a ghost rule, a homeless kind, a gate in a ghost room and a concept in a ghost
  // room. Every gap CLASS the gate can raise now has its own exit arm.
  const exitArms = [
    ["lane", { ...clean, lanes: [...clean.lanes, "ghostlane"] }],
    ["kind", { ...clean, kinds: [...clean.kinds, "ghost.kind"] }],
    ["command", { ...clean, commands: [...clean.commands, "ghost-command"] }],
    ["agent", { ...clean, agents: [...clean.agents, "ghost-agent"] }],
    ["product", { ...clean, products: [...clean.products, { name: "ghostproduct", hasFace: true }] }],
    ["rule", { ...clean, rules: [...clean.rules, "ghost-rule"] }],
    ["process", { ...clean, processes: [...clean.processes, "ghost-process"] }],
    ["gate in a ghost room", withMapRoom(clean, "gates", "ghost-room-xyz")],
    ["concept in a ghost room", withConcept(clean, { room: "ghost-room-xyz", station: "x" })],
    ["command in a ghost room", withMapRoom(clean, "commands", "ghost-room-xyz")],
    ["agent in a ghost room", withMapRoom(clean, "agents", "ghost-room-xyz")],
    // One per world-derived inventory (ADR-1317). The reason there is an arm apiece rather
    // than one representative is the same reason this list already has eleven: a mutant that
    // narrowed `if (findings.length)` to a single class passed all seventeen arms of the
    // previous version, because every arm produced a `[lane]` finding among others. An arm
    // that shares its neighbour's finding class proves nothing about its own.
    ["gate on the tree", withTreeName(clean, "gates", "ghost-gate")],
    ["job on the tree", withTreeName(clean, "jobs", "ghost-job")],
    ["venture on the tree", withTreeName(clean, "ventures", "ghost-venture")],
    ["adr band on the tree", withTreeName(clean, "adrBands", "9900")],
    ["plan on the tree", withTreeName(clean, "plans", "PLAN-ghost")],
    ["capability on the tree", withTreeName(clean, "capabilities", "skill:ghost")],
    ["planned room on the tree", withTreeName(clean, "plannedRooms", "ghost-room")],
    ["ci workflow on the tree", withTreeName(clean, "ci", "workflow:ghost")],
    ["hook on the tree", withTreeName(clean, "hooks", "GhostHook")],
    ["lint on the tree", withTreeName(clean, "lints", "ghost-lint")],
    // And the class that has no equivalent above: a source that could not be read at all.
    ["an unreadable inventory source", withUnreadable(clean, "gates")],
    ["a contract inventory nothing derives", withUnderivedInventory(clean)],
  ];
  let allExits = true;
  for (const [label, mutant] of exitArms) {
    const code = await run(mutant, true);
    if (code !== 1) allExits = false;
    lines.push(`exit 1 on a ${label.padEnd(24)} gap: ${code === 1 ? "PASS" : "FAIL (got " + code + ")"}`);
  }
  const exitOnGap = allExits ? 1 : 0;

  for (const l of lines) process.stdout.write(l + "\n");
  const ok = cleanOk && allArms && exitOnGap === 1;
  process.stdout.write(`face-coverage selftest: ${ok ? "PASS -- fails closed on every arm, passes the real tree" : "FAIL"}\n`);
  return ok ? 0 : 1;
}

/** Corrupt the FIRST live kind's homes to `homes`, leaving its key in place. */
function withKindHome(data, homes) {
  const contract = JSON.parse(JSON.stringify(data.contract));
  const k = data.kinds.find((x) => contract.kinds?.map?.[x]);
  if (k) contract.kinds.map[k] = { ...contract.kinds.map[k], homes };
  return { ...data, contract };
}
/** Point the FIRST row of `inv`.map at `room`, leaving its key in place. */
/**
 * Add a name to one of the WORLD-derived inventories, as if arc had grown it (ADR-1317).
 *
 * The mutation is on the tree side deliberately. A mutant applied to the contract proves the
 * contract is read; only a mutant applied to the SOURCE proves the gate would notice arc
 * growing, which is the entire claim the owner asked for.
 */
function withTreeName(data, treeKey, name) {
  const inv = data[treeKey];
  return { ...data, [treeKey]: { ...inv, names: [...(inv?.names || []), name] } };
}

/**
 * Make one inventory's source unreadable.
 *
 * The arm this backs is the one that is easy to argue away: a source that cannot be read
 * SHOULD be a finding, because the alternative is a gate that reports "all covered" for a
 * file it never opened. `names: []` alongside is deliberate -- the mutant must fail on the
 * unreadable flag itself, not merely on there being nothing to check.
 */
function withUnreadable(data, treeKey) {
  return { ...data, [treeKey]: { unreadable: "the selftest made it unreadable", names: [] } };
}

/**
 * Add an inventory to the contract that nothing derives.
 *
 * The class this arm is for bit twice in one day: the contract grew and a place that must grow
 * with it did not (`zonesFor`'s zone list, `roomRegistry`'s byRoom), and both times the result
 * was rows that rendered nowhere with every gate green. The meta-check turns "remember to
 * update all three" -- a written rule of exactly the kind CLAUDE.md records as having failed
 * to take -- into a named failure.
 */
function withUnderivedInventory(data) {
  const contract = JSON.parse(JSON.stringify(data.contract));
  contract.somethingNobodyReads = { map: { alpha: "toolbelt" } };
  return { ...data, contract };
}

function withMapRoom(data, inv, room) {
  const contract = JSON.parse(JSON.stringify(data.contract));
  const k = Object.keys(contract[inv]?.map || {})[0];
  if (k) contract[inv].map[k] = room;
  return { ...data, contract };
}
/** Replace the FIRST concept's entry with `entry`, leaving its term in place. */
function withConcept(data, entry) {
  const contract = JSON.parse(JSON.stringify(data.contract));
  const t = Object.keys(contract.concepts?.map || {})[0];
  if (t) contract.concepts.map[t] = entry;
  return { ...data, contract };
}
/** Point the FIRST born lane at a room id that does not exist. */
function withLaneRoom(data, room) {
  const contract = JSON.parse(JSON.stringify(data.contract));
  const l = data.lanes.find((x) => contract.lanes?.map?.[x]);
  if (l) contract.lanes.map[l] = room;
  return { ...data, contract };
}

const KNOWN_FLAGS = ["--selftest"];

/**
 * Refuse an argument this gate does not know.
 *
 * `argv.includes("--check")` means every near-miss silently selects the WRITE path and exits
 * 0. An adversarial pass ran `--check=true`, `--Check`, `--checks` and `--dry-run` against a
 * drifted tree: each one repaired the drift and reported success. On `face-tokens` that
 * silently discarded a hand-edit to the app's entire stylesheet.
 *
 * It matters more than it looks. The only correct spellings in existence are the literals in
 * tests/*.bats -- any future hook, workflow line or pre-commit that types it slightly
 * differently gets a green light AND a mutated working tree. An unrecognised `--` argument is
 * exit 2: could not read the inputs, which is exactly what it is.
 *
 * @param {string[]} argv @param {string[]} known
 */
function refuseUnknownFlags(argv, known) {
  const bad = argv.filter((a) => a.startsWith("--") && !known.includes(a));
  if (bad.length) {
    process.stderr.write(`face-coverage: unknown flag(s) ${bad.join(", ")} -- known flags are ${known.join(", ")}. Refusing rather than silently taking the write path.
`);
    process.exit(2);
  }
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  refuseUnknownFlags(argv, KNOWN_FLAGS);
  const repo = argv.find((a) => !a.startsWith("--")) || REPO_DEFAULT;
  const fn = argv.includes("--selftest") ? selftest : run;
  fn(repo)
    .then((code) => process.exit(code))
    .catch((err) => { process.stderr.write(`face-coverage: ERROR -- ${err.message}\n`); process.exit(2); });
}

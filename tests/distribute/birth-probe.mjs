// tests/distribute/birth-probe.mjs -- probes for tests/distribute-birth.bats (ADR-2003, ADR-2004, ADR-2014).
// Usage: node tests/distribute/birth-probe.mjs <case> <file>   (run with cwd = repo root)
// Every case ends by printing `RAN <case>` so a suite can assert the probe reached its end; a
// file it cannot read is a thrown error (non-zero exit), never an empty or clean report.
import { readFileSync } from "node:fs";

const [, , which, file] = process.argv;
const out = (s) => process.stdout.write(s + "\n");
const CELLS = [
  "commands", "agents", "hooks", "skills", "mcp", "brain_file",
  "subagents", "user_only_invocation", "argument_substitution",
];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function read(p) {
  if (!p) throw new Error("no file argument");
  const text = readFileSync(p, "utf8");
  if (text.trim() === "") throw new Error(`COULD NOT SCAN: ${p} is empty`);
  return text;
}

const cases = {
  async matrix() {
    const { parseYamlSubset } = await import(new URL("../../.claude/scripts/engine/yaml-subset.mjs", import.meta.url).href);
    const parsed = parseYamlSubset(read(file));
    if (!parsed.ok) throw new Error(`parse failed at line ${parsed.error.line}: ${parsed.error.what}`);
    const rows = parsed.value && parsed.value.harnesses;
    if (!Array.isArray(rows)) throw new Error("no harnesses list");
    const problems = [];
    let verified = 0;
    let cellsChecked = 0;
    const ids = new Set();
    for (const r of rows) {
      const id = r && typeof r.id === "string" ? r.id : "(no id)";
      if (ids.has(id)) problems.push(`${id}: duplicate id`);
      ids.add(id);
      if (r.status !== "verified" && r.status !== "unverified") problems.push(`${id}: status must be verified|unverified`);
      if (typeof r.verified !== "string" || !DATE.test(r.verified)) problems.push(`${id}: undated`);
      if (r.status === "verified") {
        verified += 1;
        if (typeof r.version !== "string" || r.version.trim() === "") problems.push(`${id}: no version`);
        if (typeof r.source !== "string" || r.source.trim() === "") problems.push(`${id}: no source`);
      }
      const cells = r.cells;
      if (!cells || typeof cells !== "object") { problems.push(`${id}: no cells`); continue; }
      for (const k of Object.keys(cells)) if (!CELLS.includes(k)) problems.push(`${id}: unknown cell ${k}`);
      for (const k of CELLS) {
        if (!Object.prototype.hasOwnProperty.call(cells, k)) { problems.push(`${id}: missing cell ${k}`); continue; }
        const v = cells[k];
        cellsChecked += 1;
        if (!(v === "true" || v === "false" || (typeof v === "string" && /^partial:\S/.test(v)))) problems.push(`${id}: illegal cell ${k}`);
      }
    }
    const cc = rows.find((r) => r && r.id === "claude-code") || {};
    out(`rows ${rows.length}`);
    out(`verified ${verified}`);
    out(`cells ${cellsChecked}`);
    out(`claude-golden ${cc.golden || "(none)"}`);
    out(`claude-transform ${cc.golden_transform || "(none)"}`);
    for (const p of problems) out(`PROBLEM ${p}`);
    out("RAN matrix");
  },
  async verdict() {
    const lines = read(file).replace(/\r/g, "").split("\n");
    let commandRows = 0, seoRows = 0, faithful = 0, illegal = 0;
    for (const l of lines) {
      const m = l.match(/^\|\s*([a-z0-9-]+)\s*\|\s*([A-Z]+)\s*\|/);
      if (!m) continue;
      const [, name, verdict] = m;
      if (name.startsWith("source-command-arc-")) commandRows += 1;
      else if (name === "seo-article-writer") seoRows += 1;
      else continue;
      if (verdict === "FAITHFUL") { if (name !== "seo-article-writer") faithful += 1; }
      else if (verdict !== "DIVERGED") illegal += 1;
    }
    out(`command-rows ${commandRows}`);
    out(`seo-rows ${seoRows}`);
    out(`faithful ${faithful}`);
    out(`illegal ${illegal}`);
    out(commandRows === 8 && seoRows === 1 && illegal === 0 ? "verdict complete" : "verdict incomplete");
    out("RAN verdict");
  },
};

if (!cases[which]) {
  process.stderr.write(`birth-probe: unknown case ${JSON.stringify(which)}\n`);
  process.exitCode = 2;
} else {
  cases[which]().catch((e) => { process.stderr.write(`birth-probe: ${e.message}\n`); process.exitCode = 1; });
}

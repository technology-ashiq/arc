// Probe for tests/engine-attack-diff.bats (ADR-0226). One file, several subcommands, so no program
// is ever embedded in a shell string (CLAUDE.md). Every subcommand prints a RAN marker first, so a
// test can assert the probe executed before it asserts anything the probe said.
//
//   node engine-attack-probe.mjs condense <fixed-defects.md>
//   node engine-attack-probe.mjs tools
//   node engine-attack-probe.mjs redact
//   node engine-attack-probe.mjs digest <case-dir>
//   node engine-attack-probe.mjs genapi <arc-root> <spine-dir>
//   node engine-attack-probe.mjs bigfile <path> <kib>
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mod = (rel) => import(pathToFileURL(join(ROOT, rel)).href);
const [cmd, ...args] = process.argv.slice(2);
console.log(`PROBE-RAN ${cmd}`);

if (cmd === "condense") {
  const { condenseDefects } = await mod(".claude/scripts/engine/build-attack-input.mjs");
  const out = condenseDefects(readFileSync(args[0], "utf8"));
  console.log(`ROWS=${out.rows} LINES=${out.lines.length} BULLETS=${out.bullets} EMPTY=${out.lines.filter((l) => !l.trim()).length}`);
  for (const l of out.lines) console.log(`LINE ${l}`);
} else if (cmd === "tools") {
  const { dispatchToolArgs } = await mod(".claude/scripts/engine/adapters/claude-code.mjs");
  const show = (doc) => { try { return JSON.stringify(dispatchToolArgs(doc)); } catch (e) { return `THROW ${e.message.slice(0, 60)}`; } };
  console.log(`EMPTY=${show({ permissions: "declared", tools: [] })}`);
  console.log(`READ=${show({ permissions: "declared", tools: ["fs.read"] })}`);
  console.log(`ASKHUMAN=${show({ permissions: "declared", tools: ["ask.human"] })}`);
  console.log(`NOTLIST=${show({ permissions: "declared", tools: "fs.read" })}`);
  console.log(`UNRESTRICTED=${show({ permissions: "unrestricted", tools: [] })}`);
} else if (cmd === "redact") {
  const { scanSecrets, sizeScaledCap } = await mod(".claude/scripts/hq/lib/redact.mjs");
  // 1,000 distinct 32-char hex runs: five times the flat ceiling, and no secret in any of them.
  const tokens = Array.from({ length: 1000 }, (_, i) => (i.toString(16).padStart(8, "0").repeat(4)));
  const clean = { diff: tokens.map((t) => `+ const h = "${t}";`).join("\n") };
  const text = JSON.stringify(clean);
  const verdict = (t, p, o) => { try { return JSON.stringify(scanSecrets(t, p, o)); } catch (e) { return `THROW ${e.code || ""}`; } };
  console.log(`CAP_SMALL=${sizeScaledCap("x")} CAP_BIG=${sizeScaledCap(text)}`);
  console.log(`FLAT=${verdict(text, clean)}`);
  console.log(`SCALED=${verdict(text, clean, { maxCandidates: sizeScaledCap(text) })}`);
  // The same big text with one GitHub token planted in the middle: the raised ceiling must not
  // turn into a blind spot.
  const planted = { diff: clean.diff.replace(tokens[500], `ghp_${"A1b2C3d4E5".repeat(4).slice(0, 36)}`) };
  const ptext = JSON.stringify(planted);
  console.log(`PLANTED=${verdict(ptext, planted, { maxCandidates: sizeScaledCap(ptext) })}`);
  console.log(`BADCAP=${verdict(text, clean, { maxCandidates: Number.NaN })}`);
} else if (cmd === "digest") {
  const { digest } = await mod(".claude/scripts/review/ci-digest.mjs");
  const dir = args[0];
  const fx = JSON.parse(readFileSync(join(dir, "case.json"), "utf8"));
  const calls = [];
  const gh = (a) => {
    calls.push(a.join(" "));
    if (a[0] === "run" && a[1] === "list" && a.includes("--commit")) return JSON.stringify(fx.list ?? []);
    if (a[0] === "run" && a[1] === "list" && a.includes("--branch")) return JSON.stringify(fx.branch ?? []);
    if (a[0] === "run" && a[1] === "view" && a.includes("--log-failed")) return readFileSync(join(dir, "log.txt"), "utf8");
    if (a[0] === "run" && a[1] === "view") return JSON.stringify(fx.view[a[2]]);
    throw new Error(`unexpected gh call: ${a.join(" ")}`);
  };
  const out = digest({ gh, head: fx.head, branch: fx.branchName ?? null, upstream: fx.upstream ?? null, tail: 40 });
  console.log(`CODE=${out.code}`);
  for (const l of out.lines) console.log(`OUT ${l}`);
  for (const c of calls) console.log(`GH ${c}`);
} else if (cmd === "genapi") {
  // A local stand-in for the OpenRouter-shaped endpoint. It records the request and answers with a
  // schema-valid logic result, so the ONLY thing under test is what generic-api sent.
  const [arcRoot, spine] = args;
  let seen = null;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d)).on("end", () => {
      seen = JSON.parse(body);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ surface: "logic", findings: [] }) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const tmp = mkdtempSync(join(tmpdir(), "genapi-"));
  const input = join(tmp, "in.json");
  writeFileSync(input, JSON.stringify({ classification: "external-ok", surface: "logic", diff: "+PROBE-DIFF-LINE", defect_patterns: "", prior_findings: "" }));
  const child = spawn(process.execPath, [join(arcRoot, ".claude/scripts/engine/arc-run.mjs"), "--process", "attack-diff", "--driver", "generic-api",
    "--trial-model", "probe-model-1", "--input", `@${input}`, "--root", arcRoot], {
    env: { ...process.env, ARC_SPINE_ROOT: spine, ARC_LLM_ENDPOINT: `http://127.0.0.1:${port}/v1/chat/completions`, ARC_LLM_API_KEY: "probe-key" },
  });
  let err = "";
  child.stderr.on("data", (d) => (err += d));
  const code = await new Promise((r) => child.on("close", r));
  server.close();
  const user = seen ? seen.messages.find((m) => m.role === "user")?.content ?? "" : "";
  console.log(`EXIT=${code}`);
  console.log(`REQUEST=${seen ? "yes" : "no"} MODEL=${seen?.model ?? ""}`);
  console.log(`BODY_SENT=${user.includes("You are a FRESH adversarial attacker") ? "yes" : "no"}`);
  console.log(`INPUT_SENT=${user.includes("PROBE-DIFF-LINE") ? "yes" : "no"}`);
  console.log(`PLACEHOLDER_SENT=${user.includes("{{") ? "yes" : "no"}`);
  if (code !== 0) console.log(`STDERR ${err.split("\n").slice(-5).join(" | ")}`);
} else if (cmd === "evidence") {
  // The exclusive-create write (round-2 attack L8): a target that appeared after the preflight is
  // never overwritten. The preflight is not involved here at all -- only the write is under test.
  const { writeEvidence } = await mod(".claude/scripts/engine/arc-attack.mjs");
  const dir = mkdtempSync(join(tmpdir(), "evidence-"));
  const taken = join(dir, "attack-aaaaaaa-r1-logic.json");
  writeFileSync(taken, "ORIGINAL");
  const err = writeEvidence(taken, { surface: "logic", findings: [] });
  console.log(`RACE_ERR=${err} KEPT=${readFileSync(taken, "utf8") === "ORIGINAL" ? "yes" : "no"}`);
  const fresh = join(dir, "sub", "attack-aaaaaaa-r1-boundary.json");
  const ok = writeEvidence(fresh, { surface: "boundary", findings: [] });
  console.log(`FRESH_ERR=${ok} WRITTEN=${JSON.parse(readFileSync(fresh, "utf8")).surface}`);
} else if (cmd === "bigfile") {
  // Distinct hex-shaped lines: well past both the 128 KB argv ceiling and the flat 200-candidate
  // secret-scan ceiling, with no secret in them.
  const [path, kib] = args;
  const lines = [];
  for (let i = 0, size = 0; size < Number(kib) * 1024; i++) {
    const l = `export const h${i} = "${i.toString(16).padStart(8, "0").repeat(4)}";`;
    lines.push(l);
    size += l.length + 1;
  }
  writeFileSync(path, `${lines.join("\n")}\n`);
  console.log(`WROTE ${lines.length} lines`);
} else {
  console.log(`unknown probe command ${cmd}`);
  process.exitCode = 2;
}

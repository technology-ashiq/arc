// The generic-api driver under the RUN's deadline, and its per-attempt lines (engine out-of-cycle bug, 2026-09-26).
//
// A logic attack sat silent for ~1.5 h: generic-api ignored ARC_DRIVER_DEADLINE_EPOCH_MS, so each of its three transport
// attempts started a fresh ARC_LLM_TIMEOUT_MS clock, and it printed nothing until the last one failed. Both halves are
// held here against a local endpoint -- no network, no key, no model:
//   A. an endpoint that accepts and NEVER answers, a 60 s per-attempt cap and a ~6 s run budget: the run ends on the
//      deadline (well under one cap), and says so attempt by attempt.
//   B. an endpoint that answers 503 at once: three attempts, three lines, each naming its status, the last not retrying.
// Asserts each run RAN (a spawned child, a started server) before asserting what it printed.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
  else console.log(`ok ${name}`);
};

/** @param {(req: any, res: any) => void} handler */
const serve = (handler) => new Promise((ok) => { const s = createServer(handler); s.listen(0, "127.0.0.1", () => ok(s)); });

/** arc-run through generic-api at `port`, with a run budget in minutes. */
const run = (port, budgetMin, spine) => new Promise((ok) => {
  const t0 = Date.now();
  const child = spawn(process.execPath, [join(REPO, ".claude/scripts/engine/arc-run.mjs"), "--process", "commit-msg-draft", "--driver", "generic-api",
    "--trial-model", "deepseek/deepseek-v4-flash-0731", "--budget", `min=${budgetMin}`, "--root", REPO], {
    env: { ...process.env, ARC_LLM_ENDPOINT: `http://127.0.0.1:${port}/v1/chat/completions`, ARC_LLM_API_KEY: "test-key-not-a-secret",
      ARC_LLM_TIMEOUT_MS: "60000", ARC_SPINE_ROOT: spine, ARC_DRIVER_FAKE: "" },
    windowsHide: true,
  });
  let err = "";
  child.stderr.on("data", (c) => { err += c; });
  child.stdout.resume();
  const guard = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* gone */ } }, 90_000);
  child.on("close", (code) => { clearTimeout(guard); ok({ code, err, ms: Date.now() - t0, spawned: true }); });
  child.on("error", () => { clearTimeout(guard); ok({ code: null, err, ms: Date.now() - t0, spawned: false }); });
});

const tmp = mkdtempSync(join(tmpdir(), "engine-driver-deadline-"));
try {
  // ---- A. never answers: the deadline, not the 60 s cap, ends the run ----
  {
    let hits = 0;
    const s = await serve(() => { hits++; /* accept, never answer */ });
    const r = await run(s.address().port, 0.1, join(tmp, "spine-a"));
    s.closeAllConnections?.(); s.close();
    const lines = r.err.split(/\r?\n/).filter((l) => l.startsWith("generic-api: attempt "));
    check("fixture: arc-run spawned and the endpoint was reached (vacuous-pass guard)", r.spawned && hits >= 1, `spawned=${r.spawned} hits=${hits}`);
    check("A: a never-answering endpoint ends on the run's ~6 s deadline, far inside one 60 s attempt cap", r.ms < 30_000 && r.code !== 0, `ms=${r.ms} code=${r.code}`);
    check("A: the driver said so as it happened -- a timeout line naming the attempt and the time left",
      lines.length >= 1 && /^generic-api: attempt 1\/3: timeout after \d+s -- 0m\d\ds left/.test(lines[0]), JSON.stringify(lines));
  }
  // ---- B. answers 503 at once: three attempts, three lines ----
  {
    let hits = 0;
    const s = await serve((req, res) => { hits++; res.writeHead(503, { "content-type": "application/json" }); res.end("{}"); });
    const r = await run(s.address().port, 2, join(tmp, "spine-b"));
    s.close();
    const lines = r.err.split(/\r?\n/).filter((l) => l.startsWith("generic-api: attempt "));
    check("fixture: the 503 endpoint was hit three times (vacuous-pass guard)", r.spawned && hits === 3, `hits=${hits}`);
    check("B: one line per failed attempt, each with its status, the first two retrying and the last not",
      lines.length === 3 && lines.every((l, i) => l.startsWith(`generic-api: attempt ${i + 1}/3: status 503 after `))
      && lines[0].endsWith(", retrying") && lines[1].endsWith(", retrying") && !lines[2].endsWith(", retrying"), JSON.stringify(lines));
  }
  // ---- C. a deadline that is digits but no epoch millisecond fails CLOSED (attack 415d3a3 L2) ----
  {
    const common = await import(new URL("../.claude/scripts/engine/drivers/common.mjs", import.meta.url).href);
    const read = (raw) => { const was = process.env.ARC_DRIVER_DEADLINE_EPOCH_MS; process.env.ARC_DRIVER_DEADLINE_EPOCH_MS = raw;
      try { return { ms: common.msUntilDeadline() }; } catch (e) { return { malformed: !!e.arcDeadlineMalformed }; }
      finally { if (was === undefined) delete process.env.ARC_DRIVER_DEADLINE_EPOCH_MS; else process.env.ARC_DRIVER_DEADLINE_EPOCH_MS = was; } };
    const ok = read(String(Date.now() + 60_000));
    const huge = read("1".repeat(40));
    check("C: forty digits are refused as malformed, never read as Infinity (no deadline); a real epoch is read",
      huge.malformed === true && typeof ok.ms === "number" && ok.ms > 50_000 && ok.ms <= 60_000, JSON.stringify({ ok, huge }));
  }
} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch (e) { console.log(`WARN the scratch dir was not removed: ${tmp} (${e.code || "error"})`); }
}
console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran === 6 ? 0 : 1;

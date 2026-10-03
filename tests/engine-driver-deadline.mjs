// The generic-api driver under the RUN's deadline, and its per-attempt lines (engine out-of-cycle bug, 2026-09-26).
//
// A logic attack sat silent for ~1.5 h: generic-api ignored ARC_DRIVER_DEADLINE_EPOCH_MS, so each of its three transport
// attempts started a fresh ARC_LLM_TIMEOUT_MS clock, and it printed nothing until the last one failed. Both halves are
// held here against a local endpoint -- no network, no key, no model:
//   A. an endpoint that accepts and NEVER answers, a 60 s per-attempt cap and a ~6 s run budget: the run ends on the
//      deadline (well under one cap), and says so attempt by attempt.
//   B. an endpoint that answers 503 at once: three attempts, three lines, each naming its status, the last not retrying.
//   D/E. (engine bug, 2026-10-01) the request asks for a stream and a streamed answer is folded back whole; a provider
//      that ignores the stream flag and answers plain JSON is still read.
//   F. ARC_LLM_REASONING=off puts reasoning {enabled: false} on the request, unset leaves no reasoning key at all, and
//      any other value is refused before the endpoint is reached (ADR-0226 Amendment 3).
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
const run = (port, budgetMin, spine, extraEnv = {}) => new Promise((ok) => {
  const t0 = Date.now();
  const child = spawn(process.execPath, [join(REPO, ".claude/scripts/engine/arc-run.mjs"), "--process", "commit-msg-draft", "--driver", "generic-api",
    "--trial-model", "deepseek/deepseek-v4-flash-0731", "--budget", `min=${budgetMin}`, "--root", REPO], {
    env: { ...process.env, ARC_LLM_ENDPOINT: `http://127.0.0.1:${port}/v1/chat/completions`, ARC_LLM_API_KEY: "test-key-not-a-secret",
      ARC_LLM_TIMEOUT_MS: "60000", ARC_SPINE_ROOT: spine, ARC_DRIVER_FAKE: "",
      // Stream mode, as arc-attack runs it: the driver's lines reach this stderr as they happen, whatever the verdict.
      ARC_RUN_STREAM: "1", ...extraEnv },
    windowsHide: true,
  });
  let err = "";
  child.stderr.on("data", (c) => { err += c; });
  child.stdout.resume();
  const guard = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* gone */ } }, 90_000);
  child.on("close", (code) => { clearTimeout(guard); ok({ code, err, ms: Date.now() - t0, spawned: true }); });
  child.on("error", () => { clearTimeout(guard); ok({ code: null, err, ms: Date.now() - t0, spawned: false }); });
});

// Every attempt line, wherever arc-run placed it (live, or inside its final `arc-run: <why>`), once each, in order.
const attempts = (text) => [...new Set([...String(text).matchAll(/generic-api: attempt \d\/3[^\r\n]*/g)].map((m) => m[0].trim()))];

const tmp = mkdtempSync(join(tmpdir(), "engine-driver-deadline-"));
try {
  // ---- A. never answers: the deadline, not the 60 s cap, ends the run ----
  {
    let hits = 0;
    const s = await serve(() => { hits++; /* accept, never answer */ });
    const r = await run(s.address().port, 0.1, join(tmp, "spine-a"));
    s.closeAllConnections?.(); s.close();
    const lines = attempts(r.err);
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
    const lines = attempts(r.err);
    check("fixture: the 503 endpoint was hit three times (vacuous-pass guard)", r.spawned && hits === 3, `hits=${hits}`);
    check("B: one line per failed attempt, each with its status, the first two retrying and the last not",
      lines.length === 3 && lines.every((l, i) => l.startsWith(`generic-api: attempt ${i + 1}/3: status 503 after `))
      && lines[0].endsWith(", retrying") && lines[1].endsWith(", retrying") && !lines[2].endsWith(", retrying"), JSON.stringify(lines));
  }
  // ---- D. the request streams, and a streamed answer is folded back (engine bug, 2026-10-01) ----
  // undici cuts a non-streamed answer at 300 s however high ARC_LLM_TIMEOUT_MS is set; a stream gets past it. A real
  // 300 s wait is not run here: this pins that the request asks for a stream and that the chunks reach the output whole.
  {
    const answer = JSON.stringify({ commits: [{ sha: "4936371", subject: "fix(engine): stream generic-api" }] });
    const half = Math.floor(answer.length / 2);
    let hits = 0, body = "";
    const s = await serve((req, res) => {
      hits++;
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.write(": OPENROUTER PROCESSING\n\n");
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: answer.slice(0, half) } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: answer.slice(half) } }] })}\n\n`);
        res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 11, completion_tokens: 7 } })}\n\n`);
        res.end("data: [DONE]\n\n");
      });
    });
    const r = await run(s.address().port, 2, join(tmp, "spine-d"));
    s.close();
    let asked = {};
    try { asked = JSON.parse(body); } catch { /* checked below */ }
    check("fixture: the streaming endpoint was hit once and read a request body (vacuous-pass guard)", r.spawned && hits === 1 && body.length > 0, `hits=${hits} body=${body.length}`);
    check("D: the request asks for a stream with usage, and a streamed answer split across chunks reaches the run whole",
      asked.stream === true && asked.stream_options?.include_usage === true && r.code === 0, `stream=${asked.stream} code=${r.code} err=${r.err.slice(-400)}`);
  }
  // ---- E. an endpoint that ignores the stream flag and answers plain JSON still works ----
  {
    const answer = JSON.stringify({ commits: [{ sha: "4936371", subject: "fix(engine): plain json still read" }] });
    let hits = 0;
    const s = await serve((req, res) => { hits++; req.resume(); req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: answer } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }));
    }); });
    const r = await run(s.address().port, 2, join(tmp, "spine-e"));
    s.close();
    check("E: a provider that ignores the stream flag and answers plain JSON is still read (control for D)", r.spawned && hits === 1 && r.code === 0, `hits=${hits} code=${r.code} err=${r.err.slice(-400)}`);
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
  // ---- D. the reasoning knob: off is sent, unset is absent, anything else never reaches the endpoint ----
  {
    const bodies = [];
    const s = await serve((req, res) => {
      let b = ""; req.on("data", (c) => { b += c; });
      req.on("end", () => { bodies.push(b); res.writeHead(400, { "content-type": "application/json" }); res.end("{}"); });
    });
    const port = s.address().port;
    await run(port, 2, join(tmp, "spine-d1"), { ARC_LLM_REASONING: "off" });
    const off = bodies.length;
    await run(port, 2, join(tmp, "spine-d2"), { ARC_LLM_REASONING: undefined });
    const unset = bodies.length;
    const bad = await run(port, 2, join(tmp, "spine-d3"), { ARC_LLM_REASONING: "on" });
    s.close();
    const parse = (i) => { try { return JSON.parse(bodies[i]); } catch { return null; } };
    check("fixture: the off run and the unset run each reached the endpoint (vacuous-pass guard)", off >= 1 && unset > off, `off=${off} unset=${unset}`);
    const o = parse(0);
    check("F: ARC_LLM_REASONING=off sends reasoning {enabled: false}",
      !!o && JSON.stringify(o.reasoning) === JSON.stringify({ enabled: false }), String(bodies[0]).slice(0, 200));
    const u = parse(off);
    check("F: unset sends no reasoning key at all, so the request keeps its old shape",
      !!u && !Object.hasOwn(u, "reasoning") && Array.isArray(u.messages), String(bodies[off]).slice(0, 200));
    check("F: any other value is refused before the endpoint is reached",
      bad.code !== 0 && bodies.length === unset && /ARC_LLM_REASONING="on" is not "off" or unset/.test(bad.err), `code=${bad.code} bodies=${bodies.length} err=${bad.err.slice(-300)}`);
  }
} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch (e) { console.log(`WARN the scratch dir was not removed: ${tmp} (${e.code || "error"})`); }
}
console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran === 13 ? 0 : 1;

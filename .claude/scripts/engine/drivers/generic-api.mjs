#!/usr/bin/env node
/**
 * drivers/generic-api.mjs -- plain HTTP, no vendor SDK (a PLAN non-negotiable).
 *
 * `fetch` and nothing else. No LangChain-class dependency, no SDK lock-in: the model is
 * pinned in engine/router.yaml and the endpoint is an OpenRouter/LiteLLM-shaped chat
 * completion, which is the closest thing to a lingua franca that exists.
 *
 * TRANSPORT RETRY LIVES HERE, NOT IN arc-run (ADR-0203). 429s, 5xx and timeouts are retried
 * up to twice with backoff BEFORE anything is reported upward, so a network blip never
 * consumes one of the contract attempts in ADR-0204's ladder. Spending an escalation on
 * network weather is precisely the "generic-api flaky beyond 2 days" scenario the PLAN's
 * second kill criterion anticipates.
 */

import { canonicalDoc, msUntilDeadline, parseModelJson, pinnedModel, runDriver, seatPersona, settle } from "./common.mjs";

const ENDPOINT = process.env.ARC_LLM_ENDPOINT || "";
const API_KEY = process.env.ARC_LLM_API_KEY || "";
// The router pins the model; ARC_LLM_MODEL is only a fallback for an UNROUTED run, and
// an unrouted run is recorded as unpinned rather than quietly using whatever env says.
const MODEL = pinnedModel() || process.env.ARC_LLM_MODEL || "";
// A per-attempt cap that is not a positive number is REFUSED at the first attempt, never used: NaN or 0 made every
// attempt abort at once and the run report "timeout" for a request never given time (attack 415d3a3 B7).
const TIMEOUT_RAW = process.env.ARC_LLM_TIMEOUT_MS;
const TIMEOUT_MS = TIMEOUT_RAW === undefined || TIMEOUT_RAW === "" ? 60_000 : Number(TIMEOUT_RAW);
const TIMEOUT_BAD = !(Number.isFinite(TIMEOUT_MS) && TIMEOUT_MS >= 1000 && TIMEOUT_MS <= 3_600_000);
// Opt-in, env only: `off` sends `reasoning: {enabled: false}`. A reasoning model given a whole diff spent every
// attempt thinking -- 11893 of 12000 tokens and 0 characters of answer in 411 s; off answered in 9 s (measured
// 2026-09-27, ADR-0226 Amendment 3). Unset leaves the request byte-identical, so bench runs keep their shape. Any
// other value is refused, never read as "on".
const REASONING_RAW = process.env.ARC_LLM_REASONING;
const REASONING_OFF = REASONING_RAW === "off";
const REASONING_BAD = !(REASONING_RAW === undefined || REASONING_RAW === "" || REASONING_OFF);
const MAX_TRANSPORT_RETRIES = 2;
// An attempt ends this long before the RUN's deadline, so the driver says what happened and exits on its own terms
// rather than being killed mid-line by arc-run's timeout at the same instant.
const DEADLINE_MARGIN_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (status) => status === 429 || (status >= 500 && status < 600);

/** One attempt's time: its own cap, never past the RUN's deadline (A-03). @param {number} capMs */
async function callOnce(body, capMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), capMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    const sse = /text\/event-stream/i.test(res.headers.get("content-type") || "");
    return { status: res.status, text: sse && res.status >= 200 && res.status < 300 ? fromSse(text) : text };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The request asks for a stream because Node's fetch (undici) waits at most 300 s for response HEADERS and 300 s
 * between body chunks, whatever the AbortSignal allows: a non-streamed answer longer than 5 min was cut at ~300 s as
 * `status 0` however high ARC_LLM_TIMEOUT_MS was set (engine bug, 2026-10-01: six logic-attack attempts across two
 * models and two input sizes, every one ending at 304-306 s). A stream gets its headers at once, and the provider's
 * chunks and keep-alive comments keep the body moving. This folds the chunks back into the one envelope the rest of
 * the driver reads, so nothing downstream changes.
 * @param {string} text
 */
function fromSse(text) {
  let content = "", usage, model, error;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.startsWith("data:")) continue;
    const data = raw.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let ev;
    try { ev = JSON.parse(data); } catch { continue; }
    if (ev.error) error = ev.error;
    const piece = ev.choices?.[0]?.delta?.content ?? ev.choices?.[0]?.message?.content;
    if (typeof piece === "string") content += piece;
    if (ev.usage) usage = ev.usage;
    if (ev.model) model = ev.model;
  }
  // An error mid-stream is not an answer: hand back an envelope with no content, which the driver already refuses.
  if (error) return JSON.stringify({ error });
  return JSON.stringify({ model, usage, choices: [{ message: { role: "assistant", content } }] });
}

await runDriver("generic-api", async ({ processName, input }) => {
  if (TIMEOUT_BAD) throw new Error(`ARC_LLM_TIMEOUT_MS=${JSON.stringify(TIMEOUT_RAW)} is not a per-attempt cap from 1000 to 3600000 ms -- refused, not used`);
  if (REASONING_BAD) throw new Error(`ARC_LLM_REASONING=${JSON.stringify(REASONING_RAW)} is not "off" or unset -- refused, not used`);
  if (!ENDPOINT || !API_KEY || !MODEL) {
    // Named, not guessed. An absent endpoint is a setup fact the operator must see, and
    // "not configured" must never be reported as "the model answered badly".
    throw new Error("ARC_LLM_ENDPOINT, ARC_LLM_API_KEY and ARC_LLM_MODEL must all be set (see phase-02-spec, Your-setup)");
  }

  // THE PROCESS BODY IS THE QUESTION, and until ADR-0226 this driver never sent it: the request
  // was a one-line system message plus the bare input, so every trial through here measured a
  // model answering a question it was never asked. Same `canonicalDoc` read the policy gate
  // validated, and the same prompt shape as the claude-code and codex drivers.
  const read = await canonicalDoc(processName);
  if (read.missing) throw new Error(`canonical file not found: ${read.path}`);
  if (!read.ok) throw new Error(`canonical file does not parse: ${read.what}`);
  const persona = seatPersona();
  const prompt = [
    ...(persona ? [persona] : []),
    read.doc.body,
    "",
    "---",
    "INPUT (JSON):",
    JSON.stringify(input),
    "",
    "Reply with ONE JSON document matching this process's output contract, and nothing else.",
  ].join("\n");

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: `You are executing the arc process \`${processName}\`. Reply with ONE JSON document and nothing else — no prose, no code fence.` },
      { role: "user", content: prompt },
    ],
    ...(REASONING_OFF ? { reasoning: { enabled: false } } : {}),
    // Streamed to get past undici's 300 s headers cap (see fromSse); usage rides the last chunk.
    stream: true,
    stream_options: { include_usage: true },
  };
  if (REASONING_OFF) process.stderr.write("generic-api: reasoning off (ARC_LLM_REASONING=off)\n");

  let last = null;
  const tries = MAX_TRANSPORT_RETRIES + 1;
  // The RUN's deadline bounds every attempt and the retries between them: each attempt gets min(its own cap, the time
  // left), and no attempt starts once the time is gone. Before this, each attempt started a fresh clock, so 3 attempts
  // of a 10-minute cap ran 30 minutes under a caller that believed it had set a deadline (engine bug, 2026-09-26).
  const left = () => { const r = msUntilDeadline(); return r === undefined ? undefined : r - DEADLINE_MARGIN_MS; };
  const mmss = (ms) => `${Math.floor(ms / 60_000)}m${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}s`;
  for (let attempt = 0; attempt < tries; attempt++) {
    const rem = left();
    if (rem !== undefined && rem <= 0) {
      process.stderr.write(`generic-api: attempt ${attempt + 1}/${tries} not started -- the run's deadline has passed\n`);
      break;
    }
    const cap = rem === undefined ? TIMEOUT_MS : Math.max(1, Math.min(TIMEOUT_MS, rem));
    const t0 = Date.now();
    try {
      const res = await callOnce(body, cap);
      if (!retryable(res.status)) { last = res; break; }
      last = res;
    } catch (e) {
      // AbortError (timeout) and network errors are transport, same as a 5xx.
      last = { status: 0, text: String(e.message), timedOut: /** @type {any} */ (e).name === "AbortError" };
    }
    // ONE line per failed attempt, as it happens: a retry ladder that said nothing until its last rung failed kept the
    // operator waiting on silence (engine bug, 2026-09-26). The status or "timeout", the time spent, and what is left.
    const after = left();
    const what = last.timedOut ? `timeout after ${Math.round((Date.now() - t0) / 1000)}s` : `status ${last.status} after ${Math.round((Date.now() - t0) / 1000)}s`;
    process.stderr.write(`generic-api: attempt ${attempt + 1}/${tries}: ${what}${after === undefined ? "" : ` -- ${mmss(Math.max(0, after))} left`}${attempt + 1 < tries ? ", retrying" : ""}\n`);
    if (attempt + 1 < tries) {
      const pause = (attempt + 1) * 1500;
      const r2 = left();
      if (r2 !== undefined && r2 <= pause) break;
      await sleep(pause);
    }
  }

  if (!last || last.status < 200 || last.status >= 300) {
    throw new Error(`transport failed after ${MAX_TRANSPORT_RETRIES + 1} attempt(s): status ${last?.status ?? "none"}`);
  }

  const envelope = parseModelJson(last.text, "the endpoint envelope");
  const content = envelope?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("response envelope carried no message content");

  // The OUTPUT is returned unvalidated on purpose: judging it against the process schema is
  // arc-run's job, and a driver that pre-judges hides a process fault as a driver fault.
  const output = parseModelJson(content, "the model answer");

  const u = envelope.usage || {};
  return {
    output,
    cost: {
      tokensIn: Number.isFinite(u.prompt_tokens) ? u.prompt_tokens : undefined,
      tokensOut: Number.isFinite(u.completion_tokens) ? u.completion_tokens : undefined,
      // No inr figure: this endpoint does not return one, and deriving it from a price table
      // nobody maintains would be an estimate wearing a measurement's clothes (ADR-0069 b5).
      source: "measured",
    },
    model: pinnedModel() ?? "unpinned",
  };
});

settle();

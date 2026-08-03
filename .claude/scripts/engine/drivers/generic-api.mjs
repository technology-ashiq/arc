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

import { runDriver, settle } from "./common.mjs";

const ENDPOINT = process.env.ARC_LLM_ENDPOINT || "";
const API_KEY = process.env.ARC_LLM_API_KEY || "";
const MODEL = process.env.ARC_LLM_MODEL || "";
const TIMEOUT_MS = Number(process.env.ARC_LLM_TIMEOUT_MS || 60_000);
const MAX_TRANSPORT_RETRIES = 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (status) => status === 429 || (status >= 500 && status < 600);

async function callOnce(body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    return { status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

await runDriver("generic-api", async ({ processName, input }) => {
  if (!ENDPOINT || !API_KEY || !MODEL) {
    // Named, not guessed. An absent endpoint is a setup fact the operator must see, and
    // "not configured" must never be reported as "the model answered badly".
    throw new Error("ARC_LLM_ENDPOINT, ARC_LLM_API_KEY and ARC_LLM_MODEL must all be set (see phase-02-spec, Your-setup)");
  }

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: `You are executing the arc process \`${processName}\`. Reply with ONE JSON document and nothing else — no prose, no code fence.` },
      { role: "user", content: JSON.stringify(input) },
    ],
  };

  let last = null;
  for (let attempt = 0; attempt <= MAX_TRANSPORT_RETRIES; attempt++) {
    try {
      const res = await callOnce(body);
      if (!retryable(res.status)) { last = res; break; }
      last = res;
    } catch (e) {
      // AbortError (timeout) and network errors are transport, same as a 5xx.
      last = { status: 0, text: String(e.message) };
    }
    if (attempt < MAX_TRANSPORT_RETRIES) await sleep((attempt + 1) * 1500);
  }

  if (!last || last.status < 200 || last.status >= 300) {
    throw new Error(`transport failed after ${MAX_TRANSPORT_RETRIES + 1} attempt(s): status ${last?.status ?? "none"}`);
  }

  const envelope = JSON.parse(last.text);
  const content = envelope?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("response envelope carried no message content");

  // The OUTPUT is returned unvalidated on purpose: judging it against the process schema is
  // arc-run's job, and a driver that pre-judges hides a process fault as a driver fault.
  const output = JSON.parse(content);

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
  };
});

settle();

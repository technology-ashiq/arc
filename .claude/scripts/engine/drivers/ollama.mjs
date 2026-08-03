#!/usr/bin/env node
/**
 * drivers/ollama.mjs -- THE NORTH-STAR TIMING STUB. NOT A PRODUCTION DRIVER.
 *
 * A local-model driver is a declared no-go for this cycle (PLAN `## No-gos`), and this file
 * exists only to MEASURE the ADR-0203 interface: how long does a fourth driver take, from
 * nothing to its first passing contract fixture? The design source's north-star is "under an
 * hour", and the measurement is worthless if the thing being timed is not a genuine attempt.
 *
 * So it is a real driver by the interface's own terms -- it talks to a real local Ollama
 * endpoint -- and it is deliberately NOT registered in arc-run's DRIVERS list or in
 * engine/router.yaml. It ships nowhere. Phase 03's exit criteria require it to be removed or
 * quarantined before the phase closes.
 *
 * What the timing actually tests: whether the interface leaked engine concerns. If writing
 * this needed anything beyond `produce()` -- schema knowledge, budget arithmetic, receipt
 * handling, secret scanning -- then `drivers/NAME.sh` is not the one-shim-file contract
 * ADR-0203 claims, and that is the finding.
 */

import { runDriver, settle } from "./common.mjs";

const ENDPOINT = process.env.ARC_OLLAMA_ENDPOINT || "http://127.0.0.1:11434/api/chat";
const MODEL = process.env.ARC_OLLAMA_MODEL || "llama3";

await runDriver("ollama", async ({ processName, input }) => {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: `You are executing the arc process \`${processName}\`. Reply with ONE JSON document and nothing else.` },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`ollama returned ${res.status}`);
  const envelope = await res.json();
  const content = envelope?.message?.content;
  if (typeof content !== "string") throw new Error("response carried no message content");

  return {
    output: JSON.parse(content),
    cost: {
      tokensIn: Number.isFinite(envelope.prompt_eval_count) ? envelope.prompt_eval_count : undefined,
      tokensOut: Number.isFinite(envelope.eval_count) ? envelope.eval_count : undefined,
      // A local model costs no money. That is a FACT here, not an absent field -- but the
      // spine's cost block needs all four keys, and arc-run declines the block when there is
      // no rupee figure, so nothing is claimed either way.
      source: "measured",
    },
  };
});

settle();

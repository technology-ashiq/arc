// fake-llm.mjs -- an OpenAI-compatible chat-completions server for the face's Ask (face v2 Phase 10, ADR-1350).
//
// The FAKE behind the owner's-model interface (PLAN External dependencies): CI never calls a real provider. It speaks
// the one shape every provider the owner can add speaks -- POST <base>/chat/completions, a bearer key, `model`, and
// `messages` -- and answers deterministically from the question it finds in the face-ask prompt:
//
//   a question naming "boiling"     -> lane general, no citations
//   a question naming "which gate"  -> lane arc, citing `citeId` (a receipt that IS on the spine the test hands the door)
//   a question naming "who wrote"   -> lane arc, citing a well-formed id that is NOT on any spine (must show unverified)
//   anything else                   -> lane general, "fake: no script for this question"
//
// Every request is recorded (path, bearer, model, the question), so a test can assert what the door SENT -- the key
// reached the provider and the model id is the one the owner chose -- and not only what came back.

import { createServer } from "node:http";

export const GHOST_ID = "01ZZZZZZZZZZZZZZZZZZZZZZZZ";

/** @param {string} content the user message generic-api builds: the process body, then "INPUT (JSON):", then the input */
export function questionOf(content) {
  const at = String(content).indexOf("INPUT (JSON):");
  if (at < 0) return null;
  const line = String(content).slice(at).split("\n")[1] ?? "";
  try { const j = JSON.parse(line); return typeof j.q === "string" ? j.q : null; } catch { return null; }
}

/** @param {string | null} q @param {string} citeId */
export function scriptedAnswer(q, citeId) {
  const s = String(q ?? "").toLowerCase();
  if (s.includes("boiling")) return { lane: "general", answer: "Water boils at 100 degrees Celsius at sea level.", citations: [] };
  if (s.includes("which gate")) return { lane: "arc", answer: "The oldest open approval is on the gate named in its receipt.", citations: [citeId] };
  if (s.includes("who wrote")) return { lane: "arc", answer: "The record names its author in a receipt.", citations: [GHOST_ID] };
  return { lane: "general", answer: "fake: no script for this question", citations: [] };
}

/**
 * @param {{ port: number, citeId: string }} opts
 * @returns {Promise<{ close: () => Promise<void>, requests: Array<{ path: string, bearer: string | null, model: unknown, q: string | null }> }>}
 */
export function startFakeLlm({ port, citeId }) {
  /** @type {Array<{ path: string, bearer: string | null, model: unknown, q: string | null }>} */
  const requests = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => { raw += d; });
    req.on("end", () => {
      let body = null;
      try { body = JSON.parse(raw); } catch { /* recorded as is below */ }
      const auth = String(req.headers.authorization ?? "");
      const user = Array.isArray(body?.messages) ? body.messages.find((m) => m && m.role === "user") : null;
      const q = questionOf(user?.content ?? "");
      requests.push({ path: String(req.url), bearer: auth.startsWith("Bearer ") ? auth.slice(7) : null, model: body?.model, q });
      if (req.method !== "POST" || !String(req.url).endsWith("/chat/completions") || !body) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "not a chat completion" } }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        id: "fake-1", object: "chat.completion", model: body.model,
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(scriptedAnswer(q, citeId)) } }],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }));
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({
      requests,
      // Keep-alive sockets would hold close() open forever; drop them, and never wait more than 2 s (attack b8271c1 B6).
      close: () => new Promise((r) => { const t = setTimeout(r, 2000); server.closeAllConnections?.(); server.close(() => { clearTimeout(t); r(); }); }),
    }));
  });
}

// talk.mjs -- every decision the talking face makes (face v2 Phase 10, REQ-14, ADR-1350).
//
// The Dock, the front door's ask box and the models panel render; they decide nothing. What they show -- which label an
// answer carries, what the voice does next, what a form sends -- is here, in plain ESM, so tests/face/talk-client.mjs
// holds every branch with node and no install (face-pure: a branch inside a .tsx is a branch nobody can exercise).
//
// Nothing here imports React, Vite, three or anything under `.claude/**`.

// ── the answer's label ──

/** The door's own label strings (arc-dash.mjs judgeModelAnswer). A second spelling, pinned by the client fixture. */
export const GENERAL_LABEL = "general — not from arc's record";
export const ARC_LABEL = "from arc's record";
export const UNVERIFIED_LABEL = "unverified — a citation is not on arc's record";
export const READER_TAG = "from arc's record — the reader, no model";
export const NEEDS_MODEL_LINE = "No model is added yet, so only questions about arc's record can be answered. Enter HQ and open Settings (top right) to add one: any OpenAI-compatible model, free or paid, or a local one.";

/**
 * What the face says about where an answer came from, from readAnswer's result. A model answer carries the label the
 * DOOR wrote after checking it; the client never upgrades it. `tone` is "plain" | "general" | "warn".
 * @param {{ half?: string, label?: string | null, lane?: string | null, needsModel?: boolean, unresolved?: string[] }} a
 * @returns {{ tag: string, tone: "plain" | "general" | "warn", howTo: string | null }}
 */
export function answerTag(a) {
  const howTo = a && a.needsModel === true ? NEEDS_MODEL_LINE : null;
  if (!a || a.half !== "model") return { tag: READER_TAG, tone: "plain", howTo };
  if (a.lane === "general") return { tag: GENERAL_LABEL, tone: "general", howTo };
  if (a.label === UNVERIFIED_LABEL || (Array.isArray(a.unresolved) && a.unresolved.length > 0)) return { tag: UNVERIFIED_LABEL, tone: "warn", howTo };
  if (a.lane === "arc" && typeof a.label === "string" && a.label.startsWith(ARC_LABEL)) return { tag: a.label, tone: "plain", howTo };
  // A model answer with a label this client does not know is shown as unverified, never as checked.
  return { tag: UNVERIFIED_LABEL, tone: "warn", howTo };
}

// ── voice ──

/**
 * Which halves of voice this browser has. Speech in is `SpeechRecognition` (prefixed in Chrome and Edge); speech out is
 * `speechSynthesis`. A browser with neither shows no mic, and typing works as before.
 * @param {any} win
 */
export function voiceSupport(win) {
  const w = win && typeof win === "object" ? win : {};
  return {
    listen: typeof (w.SpeechRecognition || w.webkitSpeechRecognition) === "function",
    speak: !!w.speechSynthesis && typeof w.SpeechSynthesisUtterance === "function",
  };
}

/** Where speech goes, shown beside the switch (ADR-1350 Consequences). */
export const VOICE_NOTE = "Speech to text is done by your browser: Chrome sends the audio to Google, Edge to Microsoft. Answers are read aloud on this machine. Typing always works.";

/** @typedef {"idle" | "listening" | "thinking" | "speaking"} VoiceState */
/** @typedef {"start-listening" | "stop-listening" | "ask" | "speak" | "stop-speaking" | null} VoiceEffect */

/**
 * One step of the voice loop: press the mic, it listens; what it heard is asked; the answer is spoken; press again to
 * stop at any point. An event that does not fit the state changes nothing (a late "heard" after a stop is dropped).
 * @param {VoiceState} state
 * @param {{ type: "press" } | { type: "heard", text: string } | { type: "silence" } | { type: "answer", speak: boolean } | { type: "spoken" } | { type: "error" }} ev
 * @returns {{ state: VoiceState, effect: VoiceEffect, text?: string }}
 */
export function voiceStep(state, ev) {
  if (!ev || typeof ev !== "object") return { state, effect: null };
  if (ev.type === "error") return { state: "idle", effect: state === "listening" ? "stop-listening" : state === "speaking" ? "stop-speaking" : null };
  switch (state) {
    case "idle":
      return ev.type === "press" ? { state: "listening", effect: "start-listening" } : { state, effect: null };
    case "listening":
      if (ev.type === "press") return { state: "idle", effect: "stop-listening" };
      if (ev.type === "silence") return { state: "idle", effect: null };
      if (ev.type === "heard") {
        const text = typeof ev.text === "string" ? ev.text.trim() : "";
        return text ? { state: "thinking", effect: "ask", text } : { state: "idle", effect: null };
      }
      return { state, effect: null };
    case "thinking":
      if (ev.type === "answer") return ev.speak ? { state: "speaking", effect: "speak" } : { state: "idle", effect: null };
      if (ev.type === "press") return { state: "idle", effect: null };
      return { state, effect: null };
    case "speaking":
      if (ev.type === "spoken") return { state: "idle", effect: null };
      if (ev.type === "press") return { state: "idle", effect: "stop-speaking" };
      return { state, effect: null };
    default:
      return { state: "idle", effect: null };
  }
}

const ULID_IN_TEXT = /\b[0-9A-HJKMNP-TV-Z]{26}\b/g;
/**
 * The answer as it is read aloud: receipt ids become "a receipt" (a 26-character id read letter by letter is noise),
 * whitespace collapses, and a long answer is cut at a sentence near 600 characters with "the rest is on screen".
 * @param {unknown} text
 */
export function speakable(text) {
  const s = String(typeof text === "string" ? text : "").replace(ULID_IN_TEXT, "a receipt").replace(/\s+/g, " ").trim();
  if (s.length <= 600) return s;
  const cut = s.slice(0, 600);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return `${end > 200 ? cut.slice(0, end + 1) : cut} The rest is on screen.`;
}

// ── the voice switch, per browser ──

export const VOICE_KEY = "arc.face.voice";
/** @param {{ getItem(k: string): string | null } | null | undefined} storage @returns {boolean} */
export function readVoicePref(storage) {
  try { return !!storage && storage.getItem(VOICE_KEY) === "on"; } catch { return false; }
}
/** @param {{ setItem(k: string, v: string): void } | null | undefined} storage @param {boolean} on */
export function writeVoicePref(storage, on) {
  try { if (storage) storage.setItem(VOICE_KEY, on ? "on" : "off"); } catch { /* private mode: the switch still works for this page */ }
}

// ── the models form ──

/** @typedef {{ name: string, baseUrl: string, model: string, key: string }} ModelForm */
/** @returns {ModelForm} */
export function emptyForm() {
  return { name: "", baseUrl: "", model: "", key: "" };
}

/** Starting points the owner can pick and then edit: the form fills in, and nothing is sent until it is added. */
export const PRESETS = Object.freeze([
  Object.freeze({ label: "OpenRouter (free and paid)", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free" }),
  Object.freeze({ label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" }),
  Object.freeze({ label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" }),
  Object.freeze({ label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" }),
  Object.freeze({ label: "Ollama on this machine (free, no key)", baseUrl: "http://localhost:11434/v1", model: "llama3.2" }),
]);

/**
 * The one change an "add" sends, or why the form is not ready. The door checks every field again and its word is
 * final; this only stops an empty form from making a round trip. An empty key is left out (a local model has none).
 * @param {ModelForm} form
 * @returns {{ ok: true, change: { op: "add", model: { name: string, baseUrl: string, model: string, key?: string } } } | { ok: false, why: string }}
 */
export function addChange(form) {
  const f = form && typeof form === "object" ? form : emptyForm();
  const name = String(f.name ?? "").trim();
  const baseUrl = String(f.baseUrl ?? "").trim();
  const model = String(f.model ?? "").trim();
  const key = String(f.key ?? "").trim();
  if (!name) return { ok: false, why: "Give the model a name." };
  if (!baseUrl) return { ok: false, why: "Give the provider's base URL." };
  if (!model) return { ok: false, why: "Give the model id the provider uses." };
  return { ok: true, change: { op: "add", model: key ? { name, baseUrl, model, key } : { name, baseUrl, model } } };
}

/**
 * The models list as the panel shows it, from GET /api/models. Anything that is not that shape is no list, never a
 * guessed one. The key appears only as "key …abcd" or "no key".
 * @param {unknown} raw
 */
export function modelsView(raw) {
  const b = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : null;
  if (!b || !Array.isArray(b.models)) return { ok: false, active: null, rows: [] };
  const rows = b.models
    .filter((m) => m && typeof m === "object" && typeof m.name === "string")
    .map((m) => ({
      name: String(m.name),
      where: `${String(m.model ?? "")} · ${String(m.baseUrl ?? "")}`,
      key: m.hasKey === true ? (typeof m.keyTail === "string" ? `key …${m.keyTail}` : "key set") : "no key",
      active: m.name === b.active,
    }));
  return { ok: true, active: typeof b.active === "string" ? b.active : null, rows };
}

#!/usr/bin/env node
/**
 * council-juror — the arc-council cross-model juror (ADR-0015..0018). Zero deps.
 * Exit 0 = artifact written; exit 1 = named failure (taxonomy: [usage] [config] [io] [parse]).
 *
 * An independent second grader from a DIFFERENT model family re-grades the council's ANCHOR SET —
 * every id rated Weak/Contested in the first-pass ratings plus every rebuttal-log id (the ADR-0014
 * fabrication surface; ADR-0017 reconcile note). THIS SCRIPT — not the Chair — writes the juror artifact
 * (`## JUROR RATINGS` + `## JUROR RUN-RECORD`), which is what makes it an anchor (ADR-0018).
 *
 * Usage:
 *   node .claude/scripts/council-juror.mjs --points FILE --out ARTIFACT
 *
 * Config (env — exactly ONE mode):
 *   JUROR_FAKE=FIXTURE                          offline fake: read a canned OpenAI-compatible
 *                                               chat-completions response JSON (no network)
 *   JUROR_BASE_URL + JUROR_MODEL + JUROR_API_KEY  real provider mode (any OpenAI-compatible
 *                                               endpoint — OpenAI/Grok/DeepSeek/Groq/Gemini-compat/
 *                                               NVIDIA/OpenRouter…). Lands in phase 1.
 *   Setting JUROR_FAKE together with JUROR_BASE_URL/JUROR_API_KEY is a NAMED misconfiguration —
 *   never a silent fake-wins-over-real choice.
 *
 * Points file: `## POINT <ID>` sections (FIRST-PASS:/FINAL:/TEXT:/REBUTTAL: lines). Zero POINT
 * sections = the rebuttal set was empty → the artifact's ratings body is exactly
 * `(no rebuttal ran — nothing to grade)`.
 *
 * The run-record NEVER contains the API key or request headers (secrets stay in env).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, resolve } from "node:path";

const argv = process.argv.slice(2);
const argVal = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const die = (tag, msg) => { console.error(`council-juror: [${tag}] ${msg}`); process.exit(1); };

const pointsPath = argVal("--points");
const outPath = argVal("--out");
if (!pointsPath || !outPath || pointsPath.startsWith("--") || outPath.startsWith("--"))
  die("usage", "both --points FILE and --out ARTIFACT are required");
if (resolve(pointsPath).toLowerCase() === resolve(outPath).toLowerCase())
  die("usage", "--points and --out resolve to the same file — refusing to overwrite the points input");

const FAKE = process.env.JUROR_FAKE || null;
const BASE = process.env.JUROR_BASE_URL || null;
const KEY = process.env.JUROR_API_KEY || null;
const MODEL = process.env.JUROR_MODEL || null;

if (FAKE && (BASE || KEY))
  die("config", "JUROR_FAKE is set together with JUROR_BASE_URL/JUROR_API_KEY — ambiguous mode; unset one (never a silent fake-wins-over-real choice)");
if (!FAKE && !BASE)
  die("config", "no juror configured — set JUROR_FAKE=FIXTURE (offline) or JUROR_BASE_URL/JUROR_MODEL/JUROR_API_KEY (real provider)");

// ---- read the points file ----
if (!existsSync(pointsPath)) die("io", `points file not found: ${pointsPath}`);
const pointsText = readFileSync(pointsPath, "utf8");
const pointIds = [...pointsText.matchAll(/^##\s*POINT\s+([A-Z]{1,2}\d+)\s*$/gim)].map((m) => m[1].toUpperCase());
const dup = pointIds.find((id, i) => pointIds.indexOf(id) !== i);
if (dup) die("parse", `points file lists ${dup} more than once — one ## POINT section per id`);

const started = Date.now();

// ---- obtain the provider response (fake mode; real fetch lands in phase 1) ----
let responseRaw, providerLabel, modelLabel;
if (FAKE) {
  if (!existsSync(FAKE)) die("io", `JUROR_FAKE fixture not found: ${FAKE}`);
  responseRaw = readFileSync(FAKE, "utf8");
  providerLabel = "fake";
} else {
  die("config", "real provider mode (JUROR_BASE_URL) lands in phase 1 — use JUROR_FAKE=FIXTURE for now");
}

// ---- parse the OpenAI-compatible chat-completions envelope ----
let envelope;
try { envelope = JSON.parse(responseRaw.replace(/^﻿/, "")); } // tolerate a Windows BOM
catch { die("parse", `provider response is not valid JSON (${providerLabel})`); }
let content = envelope?.choices?.[0]?.message?.content;
if (Array.isArray(content)) // OpenAI-compat content-parts form: [{type:"text",text:"…"},…]
  content = content.filter((p) => p && p.type === "text" && typeof p.text === "string").map((p) => p.text).join("\n");
if (typeof content !== "string" || !content.trim())
  die("parse", `provider response is not an OpenAI-compatible chat-completions envelope — choices[0].message.content missing or empty (${providerLabel})`);
// fake mode never lets env stamp a real model's name onto a canned response (fake-wins-over-real class)
modelLabel = FAKE ? (envelope.model || "fake-model") : (envelope.model || MODEL || "unknown-model");

// ---- parse the model's ratings (strict: one "ID: rating — reason" line per requested id) ----
const ratings = new Map();
for (const m of content.matchAll(/^[ \t]*[-*]?\s*([A-Z]{1,2}\d+):\s*(Supported|Plausible|Weak|Contested)\b\s*[—–-]?\s*(.*)$/gim)) {
  const id = m[1].toUpperCase();
  const rating = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase();
  if (ratings.has(id)) {
    if (ratings.get(id).rating !== rating)
      die("parse", `model contradicted itself on ${id} (${ratings.get(id).rating} vs ${rating}) — refusing to write an ambiguous anchor`);
    continue; // identical duplicate — keep the first
  }
  ratings.set(id, { rating, reason: (m[3] || "").trim() });
}
let ratingsBody;
if (pointIds.length === 0) {
  ratingsBody = "(no rebuttal ran — nothing to grade)";
} else {
  const missing = pointIds.filter((id) => !ratings.has(id));
  if (missing.length)
    die("parse", `model response missing rating(s) for: ${missing.join(", ")} — refusing to write a partial artifact (strict output format: "ID: Supported|Plausible|Weak|Contested — reason", one line per id)`);
  ratingsBody = pointIds
    .map((id) => `- ${id}: ${ratings.get(id).rating} — ${ratings.get(id).reason || "(no reason given)"}`)
    .join("\n");
}

// ---- write the artifact (script-written: this file IS the anchor — ADR-0018) ----
const latency = Date.now() - started;
const artifact = `# Juror artifact — ${basename(pointsPath)}

## JUROR RATINGS
${ratingsBody}

## JUROR RUN-RECORD
- Time: ${new Date().toISOString()}
- Provider: ${providerLabel}
- Model: ${modelLabel}
- Latency: ${latency}ms
- Request-size: ${pointsText.length} chars · Response-size: ${content.length} chars
- Points: ${pointIds.length ? pointIds.join(", ") : "(none)"}
`;
try { writeFileSync(outPath, artifact, "utf8"); }
catch (e) { die("io", `cannot write artifact to ${outPath}: ${e.message}`); }
console.log(`council-juror: artifact written → ${outPath} (${pointIds.length} id(s), ${providerLabel} mode, ${modelLabel})`);
process.exit(0);

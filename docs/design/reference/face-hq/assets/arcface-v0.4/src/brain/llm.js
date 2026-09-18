// ─────────────────────────────────────────────────────────────
// Model drivers — arc's "models are parts, not identities" made
// real. One streaming interface over four wire formats:
//   anthropic   → api.anthropic.com/v1/messages (SSE)
//   openai      → api.openai.com/v1/chat/completions (SSE)
//   openrouter  → openrouter.ai/api/v1 (OpenAI-compatible SSE)
//   gemini      → generativelanguage.googleapis.com (SSE)
//   custom      → any OpenAI-compatible base URL (z.ai, DeepSeek,
//                 ollama, LM Studio, vLLM …)
// Keys live ONLY in this browser's localStorage on the user's
// machine. Calls go direct from the browser to the provider.
// ─────────────────────────────────────────────────────────────
const LS_KEY = 'arc-hq-engine'

export function loadEngine() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || null
  } catch {
    return null
  }
}
export function saveEngine(cfg) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg))
}
export function clearEngine() {
  localStorage.removeItem(LS_KEY)
}
export function engineReady() {
  const e = loadEngine()
  return !!(e && e.apiKey && e.model && e.provider)
}

const DEFAULT_BASE = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  custom: '',
}

// shared SSE line reader
async function readSSE(res, onData) {
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) {
      const s = line.trim()
      if (!s.startsWith('data:')) continue
      const data = s.slice(5).trim()
      if (data === '[DONE]') return
      try {
        onData(JSON.parse(data))
      } catch {
        /* partial line — ignore */
      }
    }
  }
}

async function fail(res) {
  let msg = `${res.status}`
  try {
    const j = await res.json()
    msg += ' · ' + (j.error?.message || j.message || JSON.stringify(j)).slice(0, 180)
  } catch { /* noop */ }
  throw new Error(msg)
}

// chat(messages,{system,onDelta}) → full text. messages: [{role:'user'|'assistant', content}]
export async function chat({ system, messages, onDelta, maxTokens = 700 }) {
  const cfg = loadEngine()
  if (!cfg || !cfg.apiKey) throw new Error('no-engine')
  const p = cfg.provider
  let full = ''
  const push = (d) => {
    if (!d) return
    full += d
    onDelta && onDelta(d, full)
  }

  if (p === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        system,
        stream: true,
        messages,
      }),
    })
    if (!res.ok) await fail(res)
    await readSSE(res, (j) => {
      if (j.type === 'content_block_delta' && j.delta?.text) push(j.delta.text)
    })
    return full
  }

  if (p === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    })
    if (!res.ok) await fail(res)
    await readSSE(res, (j) => {
      const t = j.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('')
      if (t) push(t)
    })
    return full
  }

  // openai / openrouter / custom — OpenAI-compatible
  const base = (cfg.baseUrl || DEFAULT_BASE[p] || '').replace(/\/$/, '')
  if (!base) throw new Error('custom provider needs a base URL')
  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${cfg.apiKey}`,
  }
  if (p === 'openrouter') {
    headers['HTTP-Referer'] = 'https://arc.local'
    headers['X-Title'] = 'arc HQ face'
  }
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: cfg.model,
      stream: true,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!res.ok) await fail(res)
  await readSSE(res, (j) => {
    const t = j.choices?.[0]?.delta?.content
    if (t) push(t)
  })
  return full
}

// quick key test — one tiny request
export async function testEngine() {
  const t0 = performance.now()
  const out = await chat({
    system: 'Reply with exactly: ok',
    messages: [{ role: 'user', content: 'ping' }],
    maxTokens: 10,
  })
  return { ok: /ok/i.test(out), ms: Math.round(performance.now() - t0), out: out.slice(0, 40) }
}

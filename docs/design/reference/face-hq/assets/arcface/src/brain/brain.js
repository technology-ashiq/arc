// ─────────────────────────────────────────────────────────────
// The brain orchestrator. Engine configured → real LLM with the
// live-state system prompt, streaming, and the action protocol.
// No engine → the offline keyword brain. Either way the reply is
// spoken by voice.js and actions are executed against the spine.
// ─────────────────────────────────────────────────────────────
import { chat, engineReady } from './llm.js'
import { buildSystem } from './persona.js'
import { localThink } from './localBrain.js'
import { recordDecision, setSpeed, changeAutonomy } from '../spine/store.js'
import { ladder } from '../spine/derive.js'
import { uiBus } from '../lib/uiBus.js'

let history = [] // [{role, content}]
const MAX_TURNS = 12

export function resetHistory() {
  history = []
}

function executeActions(list) {
  const done = []
  for (const a of (list || []).slice(0, 2)) {
    try {
      if (a.type === 'open_room' && a.room) {
        uiBus.enterHQ()
        uiBus.openRoom(a.room)
        done.push(`opened ${a.room}`)
      } else if (a.type === 'enter_hq') {
        uiBus.enterHQ()
        done.push('entered hq')
      } else if (a.type === 'approve' && a.id) {
        const ev = recordDecision(a.id, true, a.reason || 'approved by owner via voice')
        if (ev) done.push(`approved ${a.id}`)
      } else if (a.type === 'reject' && a.id) {
        const ev = recordDecision(a.id, false, a.reason || 'rejected by owner via voice')
        if (ev) done.push(`rejected ${a.id}`)
      } else if (a.type === 'set_speed') {
        setSpeed(Number(a.value) || 0)
        done.push(`speed ${a.value}`)
      } else if (a.type === 'promote' && a.capability) {
        const row = ladder().find((l) => l.cap === a.capability)
        if (row) {
          const to = 'L' + Math.min(3, parseInt(row.level.slice(1), 10) + 1)
          changeAutonomy(a.capability, row.level, to, a.reason || 'voice-approved promotion')
          done.push(`promoted ${a.capability}`)
        }
      }
    } catch {
      /* an action failing must never kill the reply */
    }
  }
  return done
}

function splitActions(full) {
  const idx = full.indexOf('<<actions>>')
  if (idx === -1) return { say: full.trim(), actions: [] }
  const say = full.slice(0, idx).trim()
  const raw = full.slice(idx + 11).trim()
  try {
    const jsonStart = raw.indexOf('[')
    const jsonEnd = raw.lastIndexOf(']')
    const actions = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    return { say, actions: Array.isArray(actions) ? actions : [] }
  } catch {
    return { say, actions: [] }
  }
}

// answer(text, {onDelta}) → { say, actions, executed, engine }
// onDelta receives ONLY speakable text (never the actions tail).
export async function answer(text, { onDelta } = {}) {
  if (!engineReady()) {
    const say = localThink(text)
    return { say, actions: [], executed: [], engine: 'offline' }
  }
  const system = buildSystem() // fresh live state every turn
  history.push({ role: 'user', content: text })
  if (history.length > MAX_TURNS) history = history.slice(-MAX_TURNS)

  let spoken = '' // what we've already streamed out
  let gate = false // true once '<<' seen — stop streaming to voice
  let full = ''
  try {
    full = await chat({
      system,
      messages: history,
      onDelta: (d, acc) => {
        if (gate || !onDelta) return
        const cut = acc.indexOf('<<')
        if (cut !== -1) {
          gate = true
          const safe = acc.slice(0, cut)
          if (safe.length > spoken.length) onDelta(safe.slice(spoken.length), safe)
          spoken = safe
          return
        }
        onDelta(d, acc)
        spoken = acc
      },
    })
  } catch (e) {
    history.pop()
    const msg = String(e.message || e)
    if (msg === 'no-engine') {
      return { say: localThink(text), actions: [], executed: [], engine: 'offline' }
    }
    return {
      say: `Engine error from the model driver — ${msg}. Check the key and model in the Engine room; falling back to my offline brain: ${localThink(text)}`,
      actions: [],
      executed: [],
      engine: 'error',
    }
  }
  const { say, actions } = splitActions(full)
  history.push({ role: 'assistant', content: say })
  const executed = executeActions(actions)
  return { say: say || '…', actions, executed, engine: 'llm' }
}

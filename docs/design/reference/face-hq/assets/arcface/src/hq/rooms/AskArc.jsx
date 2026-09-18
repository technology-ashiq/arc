// ASK ARC — "Ask in words. Every answer carries its receipt."
// A brain with no hands (ADR-1307): it reads the live state, cites the
// ULIDs it leaned on, and cannot stamp anything. The same reader as the
// voice dock, but here approve/reject/promote are refused by construction.
// Every answer is itself a receipt: ask.answered lands on the spine.
import { useEffect, useRef, useState } from 'react'
import { ChatCircleDots } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, Chip, Field, TextInput, SimBadge, YoursBadge, StatusDot, tint } from '../../ui/kit.jsx'
import { RoomHead, HPanel, Empty, ReceiptDrawer } from '../bits.jsx'
import { spine } from '../../spine/store.js'
import { wsAppend } from '../../spine/workspace.js'
import { answer } from '../../brain/brain.js'
import { engineReady, loadEngine } from '../../brain/llm.js'
import { useSpine } from '../useSpine.js'
import { uiBus } from '../../lib/uiBus.js'
import { hhmm } from '../../spine/kinds.js'

const STOP = new Set(['what', 'which', 'when', 'where', 'how', 'many', 'much', 'the', 'and', 'for', 'are', 'is', 'in', 'of', 'to', 'a', 'an', 'on', 'do', 'does', 'did', 'was', 'were', 'this', 'that', 'today', 'now', 'enna', 'evlo', 'iruku', 'irukku', 'with', 'about', 'any'])
const words = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s.-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))

// the receipts an answer leans on — the most recent events sharing a term
// with the question (id-cited, never invented). Empty is honest.
function cites(q) {
  const ws = new Set(words(q))
  if (!ws.size) return []
  const out = []
  for (let i = spine.events.length - 1; i >= 0 && out.length < 4; i--) {
    const e = spine.events[i]
    if (e.kind === 'ask.answered') continue
    const hay = words(e.kind + ' ' + e.module + ' ' + e.text)
    if (hay.some((w) => ws.has(w))) out.push(e)
  }
  return out
}

const CHIPS = ['What is waiting for me right now?', 'How much real revenue today?', 'Which capability is closest to promotion?', 'What did the council decide last?', 'Who is on the bench and who is champion?', 'What blocks the current phase?']

export default function AskArc() {
  useSpine()
  const [q, setQ] = useState(uiBus.pendingAskQ || '')
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [receipt, setReceipt] = useState(null)
  const logRef = useRef(null)
  const eng = engineReady() ? loadEngine() : null
  const asks = spine.events.filter((e) => e.kind === 'ask.answered').slice(-30)

  useEffect(() => {
    uiBus.pendingAskQ = null
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [asks.length, live])

  const ask = async (text) => {
    const v = (text ?? q).trim()
    if (!v || busy) return
    setBusy(true)
    setLive('')
    setQ('')
    const refs = cites(v)
    let res
    try {
      res = await answer(v, { hands: false, onDelta: (_d, acc) => setLive(acc) })
    } catch (e) {
      res = { say: `The reader failed — ${String(e.message || e)}. Nothing was stamped.`, engine: 'error', executed: [] }
    }
    setLive('')
    wsAppend('ask.answered', 'ask-arc', res.say, {
      q: v,
      a: res.say,
      brain: res.engine,
      cites: refs.map((e) => e.id),
      refused: (res.executed || []).filter((x) => /refused/.test(x)),
      opened: (res.executed || []).filter((x) => /^opened/.test(x)),
    })
    setBusy(false)
  }

  return (
    <>
      <RoomHead
        title="Ask in words. Every answer carries its receipt."
        hint="A brain with no hands — it reads the live state, cites the ULID, and cannot stamp anything."
        right={<YoursBadge>ask-arc · answers persisted as ask.answered</YoursBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Ask" hint={eng ? `reader: ${eng.provider} · ${eng.model} · key stays on this machine` : 'reader: offline keyword brain · add a key in the engine room for the full mind'}>
            <form
              className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end mb-3"
              onSubmit={(e) => {
                e.preventDefault()
                ask()
              }}
            >
              <Field label="Question" hint="Enter asks">
                <TextInput value={q} onChange={setQ} placeholder="what is waiting for me · how much did we spend · which lane is blocked · Tanglish works too" autoFocus />
              </Field>
              <Btn tone="primary" onClick={() => ask()}>{busy ? 'Reading…' : 'Ask →'}</Btn>
            </form>
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map((c) => (
                <Btn key={c} small onClick={() => ask(c)}>{c}</Btn>
              ))}
            </div>
          </HPanel>

          <HPanel title="Answers" hint="each answer is a receipt · cites are the events it leaned on" actions={<Chip>{asks.length} recorded</Chip>}>
            <div ref={logRef} className="max-h-[520px] overflow-y-auto pr-1 space-y-3" style={{ scrollbarWidth: 'thin' }}>
              {asks.length === 0 && !live && (
                <Empty icon={ChatCircleDots} title="Nothing asked yet" hint="The first answer becomes the first receipt in this room. Try one of the questions above." />
              )}
              {asks.map((e) => {
                const p = e.payload || {}
                const refs = (p.cites || []).map((id) => spine.events.find((x) => x.id === id)).filter(Boolean)
                return (
                  <div key={e.id} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                    <div className="flex items-baseline gap-2 flex-wrap mb-1.5">
                      <span className="text-[11px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{hhmm(e.t)}</span>
                      <span className="text-[13.5px] min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{p.q}</span>
                      <span className="ml-auto shrink-0"><Chip tone={p.brain === 'llm' ? 'cyan' : undefined}>{p.brain === 'llm' ? 'full mind' : p.brain === 'offline' ? 'offline brain' : p.brain}</Chip></span>
                    </div>
                    <div className="text-[13px] leading-[21px] break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{p.a}</div>
                    <div className="flex items-center gap-2 flex-wrap mt-2.5">
                      <button type="button" onClick={() => setReceipt(e)} className="text-[11px] cursor-pointer hover:text-(--accent)" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(e.id).slice(-6)} · this answer</button>
                      {refs.length === 0 && <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>cites: none — the answer leaned on the brief and KPIs, not on a single event</span>}
                      {refs.map((r) => (
                        <button key={r.id} type="button" onClick={() => setReceipt(r)} className="text-[11px] cursor-pointer px-1.5 h-[20px] hover:text-(--accent)" style={{ fontFamily: MONO, color: 'var(--text-2)', background: 'var(--bg-4)', borderRadius: 'var(--r-sm)' }} title={r.text}>
                          ⌗ {String(r.id).slice(-6)} · {r.kind}
                        </button>
                      ))}
                      {(p.refused || []).length > 0 && <span className="text-[12px]" style={{ fontFamily: UI, color: COLOR.amber }}>{p.refused[0]}</span>}
                    </div>
                  </div>
                )
              })}
              {live && (
                <div className="p-3.5" style={{ border: `1px dashed ${tint('cyan', 0.45)}`, borderRadius: 'var(--r-md)' }}>
                  <div className="text-[13px] leading-[21px] break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{live}<span className="animate-pulse" style={{ color: COLOR.cyan }}>▍</span></div>
                </div>
              )}
              {busy && !live && <div className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>reading the live state…</div>}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="No hands" hint="ADR-1307 · the second door, never a separate truth">
            <div className="space-y-2 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <div>Reads the same live state the rooms render — inbox, KPIs, ladder, timeline.</div>
              <div>May <b style={{ fontWeight: 600, color: 'var(--text-1)' }}>open a room</b>; approve, reject, promote and speed are refused before they run.</div>
              <div>Every answer is appended as <span style={{ fontFamily: MONO }}>ask.answered</span> with the ULIDs it cited.</div>
              <div>No receipt, no claim — an answer that cannot cite says so.</div>
              <div>The voice dock is the same reader with hands; this room is the reader alone.</div>
            </div>
          </HPanel>

          <HPanel title="The reader" actions={<Btn small onClick={() => uiBus.openRoom('engine')}>Engine room →</Btn>}>
            <div className="flex items-center gap-2 text-[12.5px] mb-2 min-w-0">
              <StatusDot state={eng ? 'live' : 'sleeping'} />
              <span className="truncate" style={{ fontFamily: eng ? MONO : UI, color: 'var(--text-1)' }}>{eng ? `${eng.provider} · ${eng.model}` : 'offline keyword brain'}</span>
            </div>
            <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {eng ? 'The key never leaves this machine; the live state is rebuilt into the prompt on every turn.' : 'Answers come from the receipt-matching offline brain — honest, narrow. Add a key to get the full mind.'}
            </p>
          </HPanel>

          <HPanel title="chat-mcp" hint="planned · drawn dotted">
            <SimBadge>planned · BRIEF-chat-mcp sleeping</SimBadge>
            <p className="text-[12.5px] leading-[19px] mt-2.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              The same L2 reader exposed as MCP tools for other clients — <span style={{ fontFamily: MONO }}>hq_query · hq_brief · hq_pnl · hq_inbox · hq_approve</span>. Ask arc's second door, never a separate truth. Wakes when the brief does.
            </p>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}

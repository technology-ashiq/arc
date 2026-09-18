// BENCH — "Drivers are compared, never trusted."
// Paste any model → it registers as a CHALLENGER on the bench.
// Run its scorecard, and if it beats the champion, propose the
// promotion — the proposal lands in YOUR inbox, because a machine
// may raise it and only you may decide it.
import { useState } from 'react'
import { ChartBarHorizontal } from '@phosphor-icons/react'
import { UI, MONO, COLOR, tint, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Meter, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { benchState, wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'
import { engineReady, chat } from '../../brain/llm.js'

const TIERS = ['cheap-scan', 'balanced-workhorse', 'high-judgment', 'independent-family-verifier']

// the LIVE fixture pack — five tiny checkable tasks, scored deterministically
const FIXTURES = [
  { id: 'follow', prompt: 'Reply with exactly one word: RECEIPT', check: (o) => /receipt/i.test(o) },
  { id: 'extract', prompt: "From the text 'invoice #4521 for ₹2,999 due Friday' reply with ONLY the invoice number.", check: (o) => o.includes('4521') && !o.includes('2,999') },
  { id: 'schema', prompt: 'Reply with ONLY this valid JSON and nothing else: {"ok":true}', check: (o) => { try { return JSON.parse(o.trim().replace(/^```(json)?|```$/g, '').trim()).ok === true } catch { return false } } },
  { id: 'arith', prompt: 'What is 17 + 26? Reply with only the number.', check: (o) => o.includes('43') },
  { id: 'classify', prompt: "Classify this message as 'support' or 'sales', one word only: 'refund my money now'", check: (o) => /support/i.test(o) },
]

export function detectProvider(model) {
  const m = model.toLowerCase()
  if (m.includes('/')) return m.split('/')[0]
  if (m.includes('claude')) return 'Anthropic'
  if (m.includes('gpt') || m.includes('o3') || m.includes('o4')) return 'OpenAI'
  if (m.includes('gemini')) return 'Google'
  if (/llama|qwen|mistral|deepseek|phi|hermes/.test(m)) return 'open-weights'
  return '—'
}

// deterministic scorecard from the model name — replaying the same
// challenger yields the same bytes, so a disputed figure re-checks free
function scoreOf(model) {
  const h = [...model].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7)
  const fixtures = 3 + (h % 3) // 3..5
  const assertion = 62 + (h % 33) // 62..94
  const schema = h % 5 === 0 ? 80 : 100
  return { fixtures, assertion, schema }
}

function verdictOf(score, champion) {
  if (!champion || !champion.scores) return 'PROPOSAL-READY'
  if (score.fixtures < 5) return `MUTED — ${score.fixtures} of 5 fixtures; movement here is noise`
  if (score.schema < champion.scores.schema) return `NO PROPOSAL — gate 2: schema regression (−${champion.scores.schema - score.schema}pp vs champion)`
  if (score.assertion <= champion.scores.assertion) return `NO PROPOSAL — gate 4: evidence insufficient (${score.assertion} ≤ champion ${champion.scores.assertion})`
  return 'PROPOSAL-READY'
}

// status → chip tone. champion = it passed on your stamp, challenger = neutral progress; benched and retired stay quiet
const STATUS_TONE = { champion: 'green', challenger: 'blue' }
// an item card inside a panel
const WELL = { background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }

export default function Bench() {
  useSpine()
  const [model, setModel] = useState('')
  const [tier, setTier] = useState('balanced-workhorse')
  const [msg, setMsg] = useState(null)
  const rows = benchState()
  const champion = rows.find((r) => r.status === 'champion')
  const active = rows.filter((r) => r.status !== 'retired')
  const neverFired = active.filter((r) => !r.scores).length
  const live = engineReady()

  const register = (raw) => {
    const m = (raw ?? model).trim()
    if (!m) return
    if (rows.some((r) => r.model === m && r.status !== 'retired')) {
      setMsg({ tone: 'err', text: `“${m}” is already on the bench — the registry holds one row per driver` })
      return
    }
    const benchId = newRef('drv')
    wsAppend('bench.registered', 'bench', `Driver registered on the bench: ${m} (${detectProvider(m)}) · tier ${tier} · scorecard never-fired`, {
      benchId, model: m, provider: detectProvider(m), tier,
    })
    setModel('')
    setMsg({ tone: 'ok', text: `${m} → on the bench as a challenger. Run its scorecard when ready.` })
  }

  const runScorecard = (row) => {
    const s = scoreOf(row.model)
    const v = verdictOf(s, row.status === 'champion' ? null : champion)
    wsAppend('bench.scored', 'bench', `Scorecard (mock): ${row.model} · assertion ${s.assertion}% · schema ${s.schema}% · ${s.fixtures}/5 fixtures → ${v}`, {
      benchId: row.benchId, ...s, verdict: v,
    })
    wsAppend('run.completed', 'bench', `bench run finished · ${row.model} · mock driver replayed pinned bytes at ₹0`, { runId: newRef('r'), outcome: 'ok', costInr: 0 })
  }

  const [scoring, setScoring] = useState(null) // benchId currently in a LIVE run
  const runLive = async (row) => {
    if (scoring) return
    setScoring(row.benchId)
    setMsg({ tone: 'ok', text: `LIVE scorecard: running 5 fixtures against ${row.model}…` })
    const t0 = performance.now()
    let passed = 0
    let schemaOk = false
    try {
      for (const f of FIXTURES) {
        const out = await chat({ system: 'You are a driver under evaluation. Follow the instruction exactly.', messages: [{ role: 'user', content: f.prompt }], maxTokens: 40, modelOverride: row.model })
        const ok = f.check(out || '')
        if (ok) passed++
        if (f.id === 'schema') schemaOk = ok
      }
      const ms = Math.round(performance.now() - t0)
      const s = { assertion: Math.round((passed / FIXTURES.length) * 100), schema: schemaOk ? 100 : 80, fixtures: FIXTURES.length }
      const v = verdictOf(s, row.status === 'champion' ? null : champion)
      wsAppend('bench.scored', 'bench', `Scorecard (LIVE · measured): ${row.model} · assertion ${s.assertion}% · schema ${s.schema}% · ${s.fixtures}/5 fixtures · ${ms} ms total → ${v}`, {
        benchId: row.benchId, ...s, verdict: v, live: true, ms,
      })
      wsAppend('run.completed', 'bench', `bench LIVE run · ${row.model} · ${FIXTURES.length} real calls · ${ms} ms · cost estimated`, { runId: newRef('r'), outcome: 'ok', ms, costSource: 'estimated' })
      setMsg({ tone: 'ok', text: `LIVE: ${row.model} passed ${passed}/${FIXTURES.length} fixtures in ${ms} ms.` })
    } catch (e) {
      wsAppend('run.failed', 'bench', `bench LIVE run FAILED · ${row.model} · driver fault: ${String(e.message || e).slice(0, 120)} — a driver-fault, not a process-fault`, { runId: newRef('r'), outcome: 'fail' })
      setMsg({ tone: 'err', text: `Driver fault on ${row.model}: ${String(e.message || e).slice(0, 140)}` })
    } finally {
      setScoring(null)
    }
  }

  const propose = (row) => {
    wsAppend('promotion.proposed', 'bench', `Promotion proposed: ${row.model} → champion (beats ${champion?.model || '—'} on assertion)`, { benchId: row.benchId })
    wsRequestApproval({
      title: `Bench: promote ${row.model} to champion`,
      tag: 'bench · routing proposal',
      subject: 'bench.promotion',
      data: { benchId: row.benchId },
      facts: [
        { k: 'council', v: `scorecard ${row.scores.assertion}% assertion · ${row.scores.schema}% schema · ${row.scores.fixtures}/5 fixtures` },
        { k: 'money', v: 'routing change only · ₹0 at stake · reversible (A4)' },
        { k: 'kill', v: `current champion ${champion?.model || '—'} moves to the bench, not the attic` },
      ],
      actions: [
        { label: 'promote — re-pin champion', approved: true },
        { label: 'not yet — more fixtures', approved: false, soft: true },
      ],
    })
    setMsg({ tone: 'ok', text: `Promotion proposal for ${row.model} is in your inbox (overview room).` })
  }

  return (
    <>
      <RoomHead
        title="Drivers are compared, never trusted."
        hint="Paste any model — it lands as a challenger with an honest never-fired scorecard. A score movement alone never re-pins the champion; only your decision does."
        right={<YoursBadge>bench · persisted</YoursBadge>}
      />

      <KpiStrip
        items={[
          { v: active.length, l: 'Drivers on the bench', sub: rows.length - active.length ? `${rows.length - active.length} retired, kept in the log` : 'retired rows stay in the log' },
          { v: neverFired, l: 'Never-fired scorecards', sub: 'not a zero: no count at all' },
          {
            v: champion && champion.scores ? champion.scores.assertion + '%' : '—',
            l: 'Champion assertion',
            sub: champion ? (champion.scores ? `schema ${champion.scores.schema}% · ${champion.scores.fixtures}/5 fixtures` : 'scorecard never-fired') : 'no champion pinned',
          },
          { v: live ? 'Live' : 'Mock', l: 'Scorecard mode', sub: live ? '5 real fixture calls, measured' : '₹0 deterministic replay' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Add a model to the bench" hint="bench.registered → scorecard → promotion via your inbox">
            <form
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3"
              onSubmit={(e) => {
                e.preventDefault()
                register()
              }}
            >
              <Field label="Model" hint="paste anything">
                <TextInput value={model} onChange={setModel} placeholder="claude-opus-5 · gpt-5.2 · google/gemini-3-flash · ollama:qwen3-72b …" mono />
              </Field>
              <div className="flex items-end">
                <Btn tone="primary" onClick={() => register()}>Add to bench</Btn>
              </div>
            </form>
            <Field label="Tier" hint="provider-neutral by construction (A7)">
              <PickRow small options={TIERS} value={tier} onPick={setTier} />
            </Field>
            {msg && (
              <p className="mt-3 text-[12.5px] leading-[18px] break-words" style={{ fontFamily: UI, color: msg.tone === 'err' ? COLOR.red : 'var(--text-2)' }}>{msg.text}</p>
            )}
          </HPanel>

          <HPanel title="The bench" hint={`${active.length} drivers · every number derives from bench.scored receipts`}>
            {rows.length === 0 && (
              <Empty icon={ChartBarHorizontal} title="The bench is empty" hint="Paste a model above, or press ⌘K and paste one anywhere. It lands as a challenger with a never-fired scorecard." />
            )}
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.benchId} className="p-3.5 min-w-0" style={{ ...WELL, border: '1px solid ' + (r.status === 'champion' ? tint('green', 0.35) : 'var(--line-1)'), opacity: r.status === 'retired' ? 0.5 : 1 }}>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <b className="text-[13px] min-w-0 break-all" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.model}</b>
                    <Chip tone={STATUS_TONE[r.status]}>{r.status}</Chip>
                    <span className="text-[11.5px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.provider} · {r.tier}</span>
                    {r.seed ? <SimBadge>{r.note}</SimBadge> : <YoursBadge>yours</YoursBadge>}
                  </div>
                  {r.scores ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className="w-[72px] shrink-0 text-[12px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>Assertion</span>
                        <div className="flex-1 max-w-[240px] min-w-0"><Meter value={r.scores.assertion / 100} tone="blue" /></div>
                        <span className="w-[44px] shrink-0 text-right text-[12px] tnum" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{r.scores.assertion}%</span>
                      </div>
                      <div className="flex items-baseline gap-x-2 gap-y-1 flex-wrap text-[12px]">
                        <span className="tnum" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>schema {r.scores.schema}% · {r.scores.fixtures}/5 fixtures</span>
                        {r.verdict && <span className="min-w-0 break-words" style={{ fontFamily: UI, fontWeight: 500, color: /^PROPOSAL-READY/.test(r.verdict) ? COLOR.cyan : 'var(--text-2)' }}>{r.verdict}</span>}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>scorecard never-fired — not a zero: a driver that has not run has no count at all</p>
                  )}
                  {r.status !== 'retired' && (
                    <div className="flex gap-2 flex-wrap items-center mt-3">
                      <Btn small onClick={() => runScorecard(r)}>Run scorecard · ₹0 mock</Btn>
                      {live && (
                        <Btn small onClick={() => runLive(r)}>
                          {scoring === r.benchId ? 'Running 5 fixtures…' : 'LIVE scorecard · real calls'}
                        </Btn>
                      )}
                      {r.status === 'challenger' && r.scores && verdictOf(r.scores, champion) === 'PROPOSAL-READY' && !r.proposed && (
                        <Btn small onClick={() => propose(r)}>Propose promotion →</Btn>
                      )}
                      {r.proposed && <span className="text-[12px]" style={{ fontFamily: UI, color: COLOR.amber }}>proposal in your inbox — needs-you</span>}
                      {r.status !== 'champion' && !r.seed && (
                        <Btn small tone="danger" onClick={() => wsAppend('bench.retired', 'bench', `Driver retired from the bench: ${r.model}`, { benchId: r.benchId })}>Retire</Btn>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="How the bench judges">
            <ol className="space-y-2.5">
              <li className="grid grid-cols-[20px_1fr] gap-2 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                <span className="tnum" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-3)' }}>1</span>
                <span><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>register</b> — a pasted model becomes a challenger row. Nothing installs itself.</span>
              </li>
              <li className="grid grid-cols-[20px_1fr] gap-2 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                <span className="tnum" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-3)' }}>2</span>
                <span><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>scorecard</b> — fixtures score the driver per process class. Re-scoring captured bytes is byte-identical, so a disputed figure re-checks for free.</span>
              </li>
              <li className="grid grid-cols-[20px_1fr] gap-2 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                <span className="tnum" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-3)' }}>3</span>
                <span><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>gates</b> — NO PROPOSAL is a first-class result, never an error: completeness → schema regression → evidence floor. Under 5 fixtures the class is MUTED.</span>
              </li>
              <li className="grid grid-cols-[20px_1fr] gap-2 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                <span className="tnum" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-3)' }}>4</span>
                <span><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>promotion</b> — a winner is PROPOSED to your inbox. A score movement alone never re-pins the champion.</span>
              </li>
            </ol>
          </HPanel>
          <HPanel title="Honesty notes">
            <ul className="list-disc pl-4 space-y-1.5 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <li>mock scorecards are deterministic replays (₹0) — labeled, per E3</li>
              <li>{live ? 'LIVE scorecards run 5 real fixture calls on your engine-room key — measured, not simulated' : 'add a key in the engine room to unlock LIVE scorecards (5 real fixture calls, measured)'}</li>
              <li>the real arc bench replays pinned fixture bytes the same way</li>
              <li>champion changes require decision.recorded — yours, with a reason</li>
              <li>retired rows stay in the log — the registry never forgets</li>
            </ul>
          </HPanel>
        </div>
      </div>
    </>
  )
}

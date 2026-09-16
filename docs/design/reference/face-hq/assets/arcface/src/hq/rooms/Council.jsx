// 03 · COUNCIL — convene a live session: seats argue in sequence,
// the verifier grades, the verdict commits and lands on the spine.
import { useEffect, useRef, useState } from 'react'
import { FONT, UI, MONO, COLOR, Btn, SimBadge, TextInput, Field, Chip, Meter, tint } from '../../ui/kit.jsx'
import { RoomHead, HPanel, SectionLabel } from '../bits.jsx'
import { appendCouncilVerdict, spine } from '../../spine/store.js'
import { calibration } from '../../spine/derive.js'
import { wsAppend } from '../../spine/workspace.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'
import { uiBus } from '../../lib/uiBus.js'
import { stage } from '../../lib/stage.js'

const SEATS = ['researcher', 'advocate', 'skeptic', 'neutral', 'strategist', 'engineer', 'marketer', 'risk-analyst']
const GRADES = ['Supported', 'Plausible', 'Weak', 'Contested']
const GRADE_TONE = { Supported: 'green', Contested: 'red', Weak: 'amber' }
const VERDICT_COLOR = (v) => (v === 'YES' ? COLOR.green : v === 'NO' ? COLOR.red : COLOR.amber)

// a seat speaks — the argument types itself onto the floor
function TypeText({ text }) {
  const [n, setN] = useState(() => (stage.reducedMotion ? text.length : 0))
  useEffect(() => {
    if (stage.reducedMotion) {
      setN(text.length)
      return
    }
    setN(0)
    const iv = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(iv)
          return v
        }
        return v + 2
      })
    }, 16)
    return () => clearInterval(iv)
  }, [text])
  return <>{text.slice(0, n)}</>
}

// seeded-ish demo debate generator (presentational, labeled simulated)
function makePoints(question) {
  const h = [...question].reduce((s, c) => s + c.charCodeAt(0), 0)
  const r = (i) => ((h * (i + 7) * 2654435761) >>> 8) % 100
  return SEATS.map((seat, i) => ({
    seat,
    point:
      seat === 'researcher'
        ? `FACT PACK: ${3 + (r(i) % 3)} sourced facts compiled, confidence-labeled — debate starts from shared evidence`
        : seat === 'advocate'
          ? `strongest case FOR: upside is real if the trigger condition holds`
          : seat === 'skeptic'
            ? `strongest case AGAINST: hidden cost + failure mode named, base rate is unkind`
            : seat === 'neutral'
              ? `load-bearing assumption identified; genuine unknown flagged`
              : `${seat} lens: scored ${(5 + (r(i) % 45) / 10).toFixed(1)}/10 on its own dimension`,
    grade: GRADES[r(i * 3) % 4],
  }))
}
function makeVerdict(question) {
  const h = [...question].reduce((s, c) => s + c.charCodeAt(0), 0)
  const verdicts = ['YES', 'CONDITIONAL', 'WAIT', 'NO']
  const v = verdicts[h % 4]
  const conf = (0.58 + (h % 30) / 100).toFixed(2)
  return { v, conf, dissent: v === 'YES' ? 'skeptic: hidden maintenance cost' : 'advocate: window may close', test: 'cheapest de-risk: one-week paper pilot', review: 'review-by: +30 days' }
}

export default function Council() {
  useSpine()
  const [question, setQuestion] = useState('')
  const [phase, setPhase] = useState('idle') // idle | debating | verdict
  const [points, setPoints] = useState([])
  const [verdict, setVerdict] = useState(null)
  const timer = useRef(null)

  const run = (q) => {
    const query = (q || question).trim()
    if (!query || phase === 'debating') return
    setQuestion(query)
    setPoints([])
    setVerdict(null)
    setPhase('debating')
    const all = makePoints(query)
    let i = 0
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      i++
      setPoints(all.slice(0, i))
      if (i >= all.length) {
        clearInterval(timer.current)
        setTimeout(() => {
          const v = makeVerdict(query)
          setVerdict(v)
          setPhase('verdict')
          appendCouncilVerdict(query, v.v, v.conf, v.dissent)
        }, 700)
      }
    }, 520)
  }

  // a question pasted into ⌘K lands here and convenes immediately
  useEffect(() => {
    if (uiBus.pendingCouncilQ) {
      const q = uiBus.pendingCouncilQ
      uiBus.pendingCouncilQ = null
      run(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // verdicts you convened persist; each is later scored against reality.
  // council.verdict records the CALL; council.outcome records what happened.
  const outcomes = {}
  for (const e of spine.events) {
    if (e.kind === 'council.outcome' && e.payload && e.payload.ref) outcomes[e.payload.ref] = e.payload.result
  }
  const past = spine.events.filter((e) => e.kind === 'council.verdict' && (e.ws || e.day === spine.dayIndex)).slice(-8).reverse()
  const scored = spine.events.filter((e) => e.kind === 'council.verdict' && e.ws && outcomes[e.id])
  const hits = scored.filter((e) => outcomes[e.id] === 'HIT').length
  const brier = scored.length
    ? (scored.reduce((s, e) => {
        const conf = parseFloat(e.payload.confidence) || 0.5
        return s + Math.pow(conf - (outcomes[e.id] === 'HIT' ? 1 : 0), 2)
      }, 0) / scored.length)
    : null
  const score = (e, result) =>
    wsAppend('council.outcome', 'council', `Outcome scored: “${(e.payload.question || '').slice(0, 60)}” → ${result} (call was ${e.payload.verdict} @ ${e.payload.confidence})`, { ref: e.id, result })
  const cal = calibration()

  return (
    <>
      <RoomHead
        title="Twelve seats. No rubber stamps."
        hint="blind parallel debate → verifier grades every point → one rebuttal → the verdict commits, with dissent"
        right={<SimBadge>session demo · simulated debate</SimBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Convene the council" hint="the verdict lands on the spine as council.verdict">
            <form
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end mb-3"
              onSubmit={(e) => {
                e.preventDefault()
                run()
              }}
            >
              <Field label="The question">
                <TextInput value={question} onChange={setQuestion} placeholder="a hard fork — e.g. should LexOS open billing this week?" />
              </Field>
              <Btn tone="primary" onClick={() => run()}>
                {phase === 'debating' ? 'Debating…' : 'Convene'}
              </Btn>
            </form>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {['Should LexOS open billing this week?', 'Build venture #2 now or wait?', 'Adopt the constitution today?'].map((s) => (
                <Btn key={s} small onClick={() => run(s)}>
                  {s}
                </Btn>
              ))}
            </div>

            {/* the debate floor */}
            {points.length > 0 && (
              <div className="space-y-1.5 mb-4">
                <SectionLabel>The floor</SectionLabel>
                {points.map((p) => {
                  const tone = GRADE_TONE[p.grade]
                  return (
                    <div key={p.seat} className="debate-enter grid grid-cols-[92px_1fr_auto] items-baseline gap-3 px-3 py-2.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                      <span className="text-[12px] truncate" style={{ fontFamily: UI, fontWeight: 600, color: COLOR.violet }}>{p.seat}</span>
                      <span className="text-[13px] leading-[20px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
                        <TypeText text={p.point} />
                      </span>
                      <span
                        className="inline-flex shrink-0 self-center"
                        style={{
                          animation: 'chip-in 0.35s var(--ease-out-heavy) both',
                          animationDelay: `${Math.min(1300, p.point.length * 9)}ms`,
                        }}
                      >
                        <Chip tone={tone}>{p.grade}</Chip>
                      </span>
                    </div>
                  )
                })}
                {phase === 'debating' && (
                  <div className="text-[12px] animate-pulse px-1 pt-1" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                    verifier grading · rebuttal round · cross-model juror…
                  </div>
                )}
              </div>
            )}

            {/* the verdict card — lands like a stamp */}
            {verdict && (
              <div className="stamp-in p-4" style={{ background: tint('violet', 0.06), border: `1px solid ${tint('violet', 0.35)}`, borderRadius: 'var(--r-md)' }}>
                <div className="flex items-baseline gap-4 flex-wrap mb-2">
                  <span className="text-[24px] leading-[28px] tracking-[-0.01em]" style={{ fontFamily: MONO, fontWeight: 700, color: VERDICT_COLOR(verdict.v) }}>{verdict.v}</span>
                  <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                    confidence <span className="tnum" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{verdict.conf}</span>
                  </span>
                  <span className="ml-auto text-[11px]" style={{ fontFamily: MONO, color: COLOR.violet }}>⌗ landed on the spine</span>
                </div>
                <div className="text-[13px] leading-[20px] space-y-0.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
                  <div>dissent kept: {verdict.dissent}</div>
                  <div>{verdict.test} · {verdict.review} — later scored HIT or MISS against reality</div>
                </div>
              </div>
            )}
          </HPanel>

          {past.length > 0 && (
            <HPanel title="The verdict ledger" hint="a call is later scored HIT or MISS against reality — that gap is calibration">
              <div className="-mx-2">
                {past.map((e) => {
                  const res = outcomes[e.id]
                  return (
                    <div key={e.id} className="flex items-center gap-3 flex-wrap px-2 py-2 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                      <span className="flex-1 min-w-[200px] text-[13px] leading-[20px] break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
                        {e.text} <span className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(e.id).slice(-6)}</span>
                      </span>
                      {res ? (
                        <Chip tone={res === 'HIT' ? 'green' : 'red'} mono>{res}</Chip>
                      ) : e.ws ? (
                        <span className="flex gap-1.5 shrink-0">
                          <Btn small tone="green" onClick={() => score(e, 'HIT')}>Hit</Btn>
                          <Btn small tone="danger" onClick={() => score(e, 'MISS')}>Miss</Btn>
                        </span>
                      ) : (
                        <Chip tone="violet">sim · unscored</Chip>
                      )}
                    </div>
                  )
                })}
              </div>
            </HPanel>
          )}

          {scored.length > 0 && (
            <HPanel title="Your calibration — the real ledger" hint="measured from council.outcome receipts, nothing simulated">
              <div className="grid grid-cols-3 gap-3">
                {[
                  [scored.length, 'Verdicts scored'],
                  [Math.round((hits / scored.length) * 100) + '%', 'Hit-rate'],
                  [brier.toFixed(3), 'Brier · lower is better'],
                ].map(([v, l]) => (
                  <div key={l} className="min-w-0">
                    <div className="text-[24px] leading-[28px] tracking-[-0.01em] truncate" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{v}</div>
                    <div className="text-[12px] leading-[16px] mt-1" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{l}</div>
                  </div>
                ))}
              </div>
            </HPanel>
          )}
        </div>

        <div className="min-w-0">
          <HPanel title="How a verdict is earned">
            <ol className="space-y-2 text-[13px] leading-[20px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <li><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>1 evidence first</b> — researchers build one neutral fact pack.</li>
              <li><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>2 blind parallel</b> — advocate · skeptic · neutral + matched experts; nobody sees anyone's argument.</li>
              <li><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>3 cross-examination</b> — the verifier grades every point Supported/Plausible/Weak/Contested; only survivors reach the verdict.</li>
              <li><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>4 one bounded rebuttal</b> — then the cross-model juror can re-grade contested points.</li>
              <li><b style={{ fontWeight: 600, color: 'var(--text-1)' }}>5 the verdict commits</b> — YES/NO/CONDITIONAL/WAIT + confidence + dissent + cheapest de-risk + review-by.</li>
            </ol>
          </HPanel>

          <HPanel title="Session 001 — the real one" tone="violet">
            <p className="text-[13.5px] leading-[21px] mb-2.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              The council judged LexOS's eleven-phase scope too heavy: <b style={{ fontFamily: MONO, fontWeight: 600, color: COLOR.amber }}>CONDITIONAL</b>. The founder proceeded anyway — and wrote the override down as ADR-0006 with a 50% revisit checkpoint. Disagreement is allowed; it just always leaves a receipt.
            </p>
            <span className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ council session 001 · founder override ADR-0006</span>
          </HPanel>

          <HPanel title="Calibration — the honest number" actions={<SimBadge>simulated</SimBadge>}>
            <div className="-mx-2">
              {cal.jurors.map((j) => (
                <div key={j.name} className="grid grid-cols-[1fr_auto_88px_auto] items-center gap-3 px-2 py-2 text-[13px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <span className="truncate" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{j.name}</span>
                  <span className="text-[12px] tnum" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{j.hit}% hit</span>
                  <Meter value={j.hit / 100} tone="violet" height={4} />
                  <span className="text-[12px] tnum text-right min-w-[44px]" style={{ fontFamily: MONO, color: j.wt.startsWith('+') ? COLOR.green : j.wt.startsWith('−') ? COLOR.red : 'var(--text-3)' }}>{j.wt}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{cal.honest}</div>
          </HPanel>

          <HPanel title="The twelve seats">
            <div className="flex flex-wrap gap-1.5">
              {ARC.agents.filter((a) => a.group === 'council').map((a) => (
                <span key={a.name} title={a.role} className="inline-flex items-center h-[24px] px-2.5 rounded-full text-[11.5px]" style={{ fontFamily: UI, fontWeight: 500, color: 'var(--text-2)', background: 'var(--bg-4)', border: '1px solid var(--line-1)' }}>
                  {a.name.replace('council-', '')}
                </span>
              ))}
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}

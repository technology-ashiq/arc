// 03 · COUNCIL — convene a live session: seats argue in sequence,
// the verifier grades, the verdict commits and lands on the spine.
import { useRef, useState } from 'react'
import { MONO, COLOR, Btn, SimBadge } from '../../ui/kit.jsx'
import { RoomHead, HPanel } from '../bits.jsx'
import { appendCouncilVerdict, spine } from '../../spine/store.js'
import { calibration } from '../../spine/derive.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'

const SEATS = ['researcher', 'advocate', 'skeptic', 'neutral', 'strategist', 'engineer', 'marketer', 'risk-analyst']
const GRADES = ['Supported', 'Plausible', 'Weak', 'Contested']

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

  const past = spine.events.filter((e) => e.kind === 'council.verdict' && e.day === spine.dayIndex).slice(-5).reverse()
  const cal = calibration()

  return (
    <>
      <RoomHead
        title="Twelve seats. No rubber stamps."
        hint="blind parallel debate → verifier grades every point → one rebuttal → the verdict commits, with dissent"
        right={<SimBadge>session demo · simulated debate</SimBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <div>
          <HPanel title="convene the council" hint="the verdict lands on the spine as council.verdict" tone="cyan">
            <form
              className="flex gap-2 flex-wrap mb-4"
              onSubmit={(e) => {
                e.preventDefault()
                run()
              }}
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="a hard fork — e.g. should LexOS open billing this week?"
                className="flex-1 min-w-[240px] bg-transparent border border-white/16 rounded-lg px-3 min-h-[44px] text-[12.5px] text-white/88 placeholder-white/35 outline-none focus:border-[#00ffd1]/60"
                style={{ fontFamily: MONO }}
              />
              <Btn tone="primary" onClick={() => run()}>
                {phase === 'debating' ? 'debating…' : 'convene'}
              </Btn>
            </form>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {['Should LexOS open billing this week?', 'Build venture #2 now or wait?', 'Adopt the constitution today?'].map((s) => (
                <button key={s} onClick={() => run(s)} className="text-[10px] text-white/60 border border-white/13 rounded-full px-3 min-h-[32px] cursor-pointer hover:text-[#00ffd1] hover:border-[#00ffd1]/50 transition-colors" style={{ fontFamily: MONO }}>
                  {s}
                </button>
              ))}
            </div>

            {/* the debate floor */}
            {points.length > 0 && (
              <div className="space-y-1.5 mb-4">
                {points.map((p) => (
                  <div key={p.seat} className="flex items-baseline gap-3 rounded-lg border border-white/8 px-3 py-2" style={{ background: 'rgba(185,162,255,0.04)' }}>
                    <span className="w-[92px] shrink-0 text-[10px] uppercase tracking-[0.08em]" style={{ fontFamily: MONO, color: COLOR.violet }}>{p.seat}</span>
                    <span className="flex-1 text-[11.5px] leading-[17px] text-white/78" style={{ fontWeight: 300 }}>{p.point}</span>
                    <span className="text-[9px] uppercase tracking-[0.08em] shrink-0" style={{ fontFamily: MONO, color: p.grade === 'Supported' ? COLOR.green : p.grade === 'Contested' ? COLOR.red : p.grade === 'Weak' ? COLOR.amber : 'rgba(255,255,255,0.55)' }}>
                      {p.grade}
                    </span>
                  </div>
                ))}
                {phase === 'debating' && <div className="text-[10.5px] text-white/45 animate-pulse px-1" style={{ fontFamily: MONO }}>verifier grading · rebuttal round · cross-model juror…</div>}
              </div>
            )}

            {/* the verdict card */}
            {verdict && (
              <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(185,162,255,0.4)', background: 'rgba(185,162,255,0.06)' }}>
                <div className="flex items-baseline gap-4 flex-wrap mb-2">
                  <span className="text-[26px] tracking-tight" style={{ fontWeight: 700, color: verdict.v === 'YES' ? COLOR.green : verdict.v === 'NO' ? COLOR.red : COLOR.amber }}>{verdict.v}</span>
                  <span className="text-[11px] text-white/60" style={{ fontFamily: MONO }}>confidence {verdict.conf}</span>
                  <span className="ml-auto text-[9px]" style={{ fontFamily: MONO, color: 'rgba(0,255,209,0.6)' }}>⌗ landed on the spine</span>
                </div>
                <div className="text-[11px] leading-[17px] text-white/70 space-y-0.5" style={{ fontWeight: 300 }}>
                  <div>dissent kept: {verdict.dissent}</div>
                  <div>{verdict.test} · {verdict.review} — later scored HIT or MISS against reality</div>
                </div>
              </div>
            )}
          </HPanel>

          {past.length > 0 && (
            <HPanel title="today's verdicts" hint="every one a receipt">
              {past.map((e) => (
                <div key={e.id} className="text-[11px] py-1.5 border-b border-white/6 last:border-0 text-white/72" style={{ fontFamily: MONO }}>
                  {e.text} <span style={{ color: 'rgba(0,255,209,0.5)' }}>⌗ {String(e.id).slice(-6)}</span>
                </div>
              ))}
            </HPanel>
          )}
        </div>

        <div>
          <HPanel title="how a verdict is earned">
            <ol className="space-y-2 text-[11.5px] leading-[17px] text-white/72" style={{ fontWeight: 300 }}>
              <li><b className="text-white/92" style={{ fontWeight: 600 }}>1 evidence first</b> — researchers build one neutral fact pack.</li>
              <li><b className="text-white/92" style={{ fontWeight: 600 }}>2 blind parallel</b> — advocate · skeptic · neutral + matched experts; nobody sees anyone's argument.</li>
              <li><b className="text-white/92" style={{ fontWeight: 600 }}>3 cross-examination</b> — the verifier grades every point Supported/Plausible/Weak/Contested; only survivors reach the verdict.</li>
              <li><b className="text-white/92" style={{ fontWeight: 600 }}>4 one bounded rebuttal</b> — then the cross-model juror can re-grade contested points.</li>
              <li><b className="text-white/92" style={{ fontWeight: 600 }}>5 the verdict commits</b> — YES/NO/CONDITIONAL/WAIT + confidence + dissent + cheapest de-risk + review-by.</li>
            </ol>
          </HPanel>

          <HPanel title="session 001 — the real one" tone="cyan">
            <div className="text-[11.5px] leading-[18px] text-white/70 mb-2.5" style={{ fontWeight: 300 }}>
              The council judged LexOS's eleven-phase scope too heavy: <b className="text-white/90" style={{ fontWeight: 600, color: COLOR.amber }}>CONDITIONAL</b>. The founder proceeded anyway — and wrote the override down as ADR-0006 with a 50% revisit checkpoint. Disagreement is allowed; it just always leaves a receipt.
            </div>
            <span className="text-[9.5px]" style={{ fontFamily: MONO, color: 'rgba(0,255,209,0.65)' }}>⌗ council session 001 · founder override ADR-0006</span>
          </HPanel>

          <HPanel title="calibration — the honest number" tone="amber">
            <table className="w-full text-[11px]" style={{ fontFamily: MONO }}>
              <tbody>
                {cal.jurors.map((j) => (
                  <tr key={j.name} className="border-b border-white/6 last:border-0">
                    <td className="py-1.5 text-white/75">{j.name}</td>
                    <td className="text-white/60">{j.hit}% hit</td>
                    <td className="w-[90px]"><div className="h-[4px] rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: j.hit + '%', background: COLOR.violet }} /></div></td>
                    <td className="text-right" style={{ color: j.wt.startsWith('+') ? COLOR.green : j.wt.startsWith('−') ? COLOR.red : 'rgba(255,255,255,0.4)' }}>{j.wt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2.5 text-[10px] leading-[15px]" style={{ fontWeight: 300, color: COLOR.amber }}>{cal.honest}</div>
          </HPanel>

          <HPanel title="the twelve seats">
            <div className="flex flex-wrap gap-1.5">
              {ARC.agents.filter((a) => a.group === 'council').map((a) => (
                <span key={a.name} title={a.role} className="text-[10px] text-white/68 border border-white/12 rounded-md px-2 py-[4px]" style={{ fontFamily: MONO }}>
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

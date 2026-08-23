// 05 · THE COUNCIL — twelve seats, blind debate, graded evidence,
// verdicts that get scored against reality. Honest about calibration.
import { ARC } from '../data/arcKnowledge.js'
import { Chapter, Head, Panel, PanelTitle, Receipt, Reveal, COLOR, MONO } from '../ui/kit.jsx'

const STANCES = ['advocate', 'skeptic', 'neutral']

function CouncilRing() {
  const council = ARC.agents.filter((a) => a.group === 'council')
  const R = 172
  return (
    <div className="relative w-[320px] h-[320px] sm:w-[440px] sm:h-[440px] shrink-0 mx-auto">
      <svg viewBox="0 0 440 440" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <circle cx="220" cy="220" r={R * (440 / 440) * 0.78} fill="none" stroke="rgba(185,162,255,0.2)" strokeWidth="1" strokeDasharray="3 6" />
        <circle cx="220" cy="220" r="104" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        {council.map((a, i) => {
          const ang = (i / council.length) * Math.PI * 2 - Math.PI / 2
          const x = 220 + Math.cos(ang) * (R * 0.78)
          const y = 220 + Math.sin(ang) * (R * 0.78)
          const stance = STANCES.includes(a.name.replace('council-', ''))
          const verifier = a.name === 'council-verifier'
          return (
            <circle
              key={a.name}
              cx={x}
              cy={y}
              r={verifier ? 5 : 3.5}
              fill={verifier ? '#ffffff' : stance ? COLOR.violet : 'rgba(185,162,255,0.62)'}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/48" style={{ fontFamily: MONO }}>
          the
        </div>
        <div className="text-[32px] sm:text-[38px] tracking-tight text-white" style={{ fontWeight: 600 }}>
          Council
        </div>
        <div className="text-[10px] uppercase tracking-[0.22em] mt-1" style={{ fontFamily: MONO, color: COLOR.violet }}>
          12 seats · blind · parallel
        </div>
      </div>
      {council.map((a, i) => {
        const ang = (i / council.length) * Math.PI * 2 - Math.PI / 2
        const x = 50 + Math.cos(ang) * 45.5
        const y = 50 + Math.sin(ang) * 45.5
        const short = a.name.replace('council-', '')
        const stance = STANCES.includes(short)
        return (
          <div
            key={a.name}
            className="absolute text-[9px] sm:text-[10.5px] uppercase tracking-[0.12em] whitespace-nowrap"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              fontFamily: MONO,
              color: a.name === 'council-verifier' ? '#ffffff' : stance ? COLOR.violet : 'rgba(255,255,255,0.62)',
            }}
            title={a.role}
          >
            {short}
          </div>
        )
      })}
    </div>
  )
}

export default function C05_Council() {
  return (
    <Chapter id="c05">
      <Head
        n="05"
        name="the council"
        title={<>Twelve Seats.{' '}<br />No Rubber Stamps.</>}
        lede="For decisions too important for one opinion — startup forks, money calls, scope fights. Three stances and matched domain experts argue blind and in parallel from one shared evidence brief, a verifier cross-examines every point, and the verdict commits in writing."
        receipt="/arc-council · 12 agents · verifier grading · cross-model juror"
      />

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-center mb-12">
        <Reveal>
          <CouncilRing />
        </Reveal>

        <div className="flex-1 space-y-4 w-full">
          <Reveal delay={60}>
            <Panel tone="violet">
              <PanelTitle tone="violet">how a verdict is earned</PanelTitle>
              <ol className="space-y-2.5 text-[13px] leading-[21px] text-white/72" style={{ fontWeight: 300 }}>
                <li><span className="text-white/92" style={{ fontWeight: 600 }}>1 · evidence first</span> — researchers compile one neutral fact pack. Debate starts from shared facts, not vibes.</li>
                <li><span className="text-white/92" style={{ fontWeight: 600 }}>2 · blind parallel debate</span> — advocate for, skeptic against, neutral, plus up to four matched experts. Nobody sees anybody else's argument.</li>
                <li><span className="text-white/92" style={{ fontWeight: 600 }}>3 · cross-examination</span> — the verifier grades every point: Supported · Plausible · Weak · Contested. Only surviving points reach the verdict.</li>
                <li><span className="text-white/92" style={{ fontWeight: 600 }}>4 · one bounded rebuttal</span> — then a cross-model juror can independently re-grade contested points.</li>
                <li><span className="text-white/92" style={{ fontWeight: 600 }}>5 · the verdict commits</span> — with confidence, the strongest dissent, a cheapest de-risk test, and a review-by date. Later it is scored against reality: HIT or MISS.</li>
              </ol>
            </Panel>
          </Reveal>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* a real verdict card — session 001 */}
        <Reveal>
          <Panel className="h-full">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <PanelTitle tone="violet">session 001 — a real verdict</PanelTitle>
              <span className="text-[9.5px] uppercase tracking-[0.18em] text-white/48" style={{ fontFamily: MONO }}>
                subject: LexOS scope
              </span>
            </div>
            <div className="flex items-baseline gap-4 mb-4 flex-wrap">
              <span className="text-[30px] tracking-tight" style={{ fontWeight: 600, color: COLOR.amber }}>
                CONDITIONAL
              </span>
              <span className="text-[12px] text-white/55" style={{ fontFamily: MONO }}>
                verdicts: YES · NO · CONDITIONAL · WAIT
              </span>
            </div>
            <p className="text-[13px] leading-[22px] text-white/65 mb-4" style={{ fontWeight: 300 }}>
              The council judged the first venture's eleven-phase scope too heavy. The founder went ahead anyway — and
              wrote the override down as ADR-0006, completeness-first, with a revisit checkpoint at fifty percent. That
              is the system working: the council advises, the human decides, and the disagreement itself becomes a
              receipt that gets scored later.
            </p>
            <div className="flex flex-wrap gap-2">
              <Receipt tone="violet">council session 001 · verdict CONDITIONAL</Receipt>
              <Receipt tone="violet">founder override → LexOS ADR-0006 · revisit @ 50%</Receipt>
            </div>
          </Panel>
        </Reveal>

        {/* calibration honesty */}
        <Reveal delay={90}>
          <Panel tone="amber" className="h-full flex flex-col">
            <PanelTitle tone="amber">calibration — the honest number</PanelTitle>
            <div className="text-[42px] tracking-tight text-white mb-1" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              0
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/48 mb-4" style={{ fontFamily: MONO }}>
              verdicts scored against reality, so far
            </div>
            <p className="text-[12.5px] leading-[21px] text-white/62" style={{ fontWeight: 300 }}>
              The machinery exists — review mode grades HIT or MISS, a Brier scoreboard tracks every seat's hit-rate per
              confidence level. The flywheel starts turning at the session-001 retrofit. Until then arc reports zero,
              because reporting zero honestly is the whole point of this company.
            </p>
            <div className="mt-auto pt-4">
              <Receipt tone="amber">council-calibrate.mjs · Brier ledger · append-only</Receipt>
            </div>
          </Panel>
        </Reveal>
      </div>
    </Chapter>
  )
}

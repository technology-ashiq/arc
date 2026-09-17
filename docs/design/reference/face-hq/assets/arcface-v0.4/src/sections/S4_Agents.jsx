// SECTION 4 — AGENTS. My design: the council as a ring of twelve jurors,
// the field agents in ranks beneath. All 23 from .claude/agents/.
import { ARC } from '../data/arcKnowledge.js'

const FONT = "'Anybody', sans-serif"
const MONO = "'JetBrains Mono', monospace"

const firstSentence = (s) => {
  const i = s.indexOf('. ')
  return i > 0 && i < 110 ? s.slice(0, i + 1) : s.length > 110 ? s.slice(0, 107) + '…' : s
}

export default function S4_Agents() {
  const council = ARC.agents.filter((a) => a.group === 'council')
  const field = ARC.agents.filter((a) => a.group !== 'council')
  const groups = ['review', 'qa', 'plan', 'research', 'other']

  return (
    <section id="agents" className="relative w-full bg-[#000] text-white overflow-hidden" style={{ fontFamily: FONT }}>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00ffd1]/25 to-transparent" />

      <div className="max-w-[1200px] mx-auto px-6 sm:px-12 py-24 sm:py-32">
        <div className="text-[11px] uppercase tracking-[0.32em] text-[#00ffd1]/70 mb-5">03 · the staff</div>
        <h2
          className="text-[38px] sm:text-[58px] md:text-[72px] leading-[1.02] tracking-tight mb-6"
          style={{ fontWeight: 600, textTransform: 'capitalize' }}
        >
          Twenty-Three
          <br />
          Agents On Call.
        </h2>
        <p className="max-w-xl text-white/60 text-[15px] leading-[26px] mb-20" style={{ fontWeight: 300 }}>
          Twelve of them sit as a decision court — blind parallel debate, verifier-graded, verdicts committed and later
          scored against reality. The rest work the floor.
        </p>

        {/* the council ring */}
        <div className="flex flex-col lg:flex-row gap-16 items-center mb-24">
          <div className="relative w-[320px] h-[320px] sm:w-[460px] sm:h-[460px] shrink-0">
            {/* ring */}
            <svg viewBox="0 0 460 460" className="absolute inset-0 w-full h-full">
              <circle cx="230" cy="230" r="168" fill="none" stroke="rgba(0,255,209,0.18)" strokeWidth="1" strokeDasharray="3 6" />
              <circle cx="230" cy="230" r="112" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              {council.map((_, i) => {
                const ang = (i / council.length) * Math.PI * 2 - Math.PI / 2
                const x = 230 + Math.cos(ang) * 168
                const y = 230 + Math.sin(ang) * 168
                return <circle key={i} cx={x} cy={y} r="3.5" fill="#00ffd1" opacity="0.9" />
              })}
            </svg>
            {/* center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">the</div>
              <div className="text-[30px] sm:text-[38px] tracking-tight" style={{ fontWeight: 600 }}>
                Council
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#00ffd1]/70 mt-1">12 jurors · blind debate</div>
            </div>
            {/* juror labels */}
            {council.map((a, i) => {
              const ang = (i / council.length) * Math.PI * 2 - Math.PI / 2
              const x = 50 + Math.cos(ang) * 45
              const y = 50 + Math.sin(ang) * 45
              const short = a.name.replace('council-', '')
              return (
                <div
                  key={a.name}
                  className="absolute text-[9px] sm:text-[10.5px] uppercase tracking-[0.14em] text-white/60 hover:text-[#00ffd1] transition-colors whitespace-nowrap"
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', fontFamily: MONO }}
                  title={a.role}
                >
                  {short}
                </div>
              )
            })}
          </div>

          <div className="max-w-md">
            <p className="text-white/60 text-[14px] leading-[24px] mb-6" style={{ fontWeight: 300 }}>
              {ARC.council.summary}
            </p>
            <div className="text-[11px] uppercase tracking-[0.25em] text-white/35">
              verdicts · <span className="text-[#00ffd1]/80">yes</span> / <span className="text-white/70">conditional</span> /{' '}
              <span className="text-white/70">wait</span> / <span className="text-white/70">no</span> — then scored hit or miss
            </div>
          </div>
        </div>

        {/* field agents */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
          {groups
            .filter((g) => field.some((a) => a.group === g))
            .map((g) => (
              <div key={g}>
                <div className="text-[10px] uppercase tracking-[0.3em] text-[#00ffd1]/60 mb-4 pb-2 border-b border-white/8">
                  {g === 'other' ? 'ops & analysis' : g} floor
                </div>
                <div className="space-y-4">
                  {field
                    .filter((a) => a.group === g)
                    .map((a) => (
                      <div key={a.name} className="group">
                        <div className="text-[13px] text-white/85 group-hover:text-[#00ffd1] transition-colors" style={{ fontFamily: MONO }}>
                          {a.name}
                        </div>
                        <div className="text-[11.5px] text-white/40 leading-snug mt-0.5" style={{ fontWeight: 300 }}>
                          {firstSentence(a.role)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </section>
  )
}

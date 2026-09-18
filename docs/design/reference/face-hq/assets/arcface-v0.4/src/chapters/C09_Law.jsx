// 09 · THE LAW — the constitution, then the finale: the face returns
// to full presence and asks for your next question. Colophon closes.
import { ARC } from '../data/arcKnowledge.js'
import { Chapter, Head, Panel, PanelTitle, Receipt, Reveal, COLOR, MONO, HairlineDivider } from '../ui/kit.jsx'
import { focusAsk } from '../chrome/VoiceDock.jsx'
import { ask } from '../lib/voice.js'

export default function C09_Law() {
  return (
    <>
      <Chapter id="c09">
        <Head
          n="09"
          name="the law"
          title={<>The DNA{' '}<br />Of The Company.</>}
          lede="The constitution outranks every roadmap, ADR, plan, prompt and line of code — and it is the model-alignment layer: models will change; this is what keeps any model behaving like arc. Three articles are eternal. Ten are amendable, with friction. Machines may cite it. Only the human may amend it."
          receipt={ARC.constitution.status}
        />

        {/* precedence bar */}
        <Reveal>
          <div className="flex items-center justify-center gap-3 mb-10 flex-wrap" style={{ fontFamily: MONO }}>
            {['Constitution', 'ADRs', 'PLAN', 'code'].map((t, i) => (
              <span key={t} className="flex items-center gap-3">
                <span
                  className="text-[12px] uppercase tracking-[0.2em] px-4 py-[9px] rounded-full border"
                  style={{
                    color: i === 0 ? '#000' : 'rgba(255,255,255,0.72)',
                    background: i === 0 ? COLOR.cyan : 'transparent',
                    borderColor: i === 0 ? COLOR.cyan : 'rgba(255,255,255,0.18)',
                    fontWeight: i === 0 ? 700 : 400,
                  }}
                >
                  {t}
                </span>
                {i < 3 && <span aria-hidden="true" className="text-white/40 text-[13px]">›</span>}
              </span>
            ))}
          </div>
        </Reveal>

        {/* eternal articles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {ARC.constitution.eternal.map((e, i) => (
            <Reveal key={e.id} delay={i * 80}>
              <Panel tone="cyan" className="h-full">
                <div className="text-[11px] mb-3" style={{ fontFamily: MONO, color: COLOR.cyan }}>
                  {e.id} · eternal — unamendable
                </div>
                <div className="text-[21px] tracking-tight text-white mb-3" style={{ fontWeight: 600 }}>
                  {e.name}
                </div>
                <p className="text-[12.5px] leading-[21px] text-white/62" style={{ fontWeight: 300 }}>
                  {e.text}
                </p>
              </Panel>
            </Reveal>
          ))}
        </div>

        {/* working articles */}
        <Reveal>
          <Panel className="mb-6">
            <PanelTitle>working articles — amendable, with friction</PanelTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
              {ARC.constitution.working.map((a) => (
                <div key={a.id} className="flex gap-3.5">
                  <span className="text-[10.5px] mt-[3px] shrink-0 w-7" style={{ fontFamily: MONO, color: COLOR.cyan }}>
                    {a.id}
                  </span>
                  <div>
                    <span className="text-[13px] text-white/90" style={{ fontWeight: 600 }}>
                      {a.name}.
                    </span>{' '}
                    <span className="text-[12.5px] leading-[20px] text-white/58" style={{ fontWeight: 300 }}>
                      {a.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        {/* amendment friction */}
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel>
              <PanelTitle tone="amber">amending a working article</PanelTitle>
              <div className="flex flex-wrap items-center gap-2" style={{ fontFamily: MONO }}>
                {['written proposal (ADR form)', '7-day cooling period', 'human sign-off', 'constitution.amended event'].map((s, i) => (
                  <span key={s} className="flex items-center gap-2">
                    <span className="text-[10.5px] text-white/72 border border-white/16 rounded-lg px-3 py-[7px]">{s}</span>
                    {i < 3 && <span aria-hidden="true" className="text-[#fbbf5d]/70">→</span>}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[12px] leading-[19px] text-white/55" style={{ fontWeight: 300 }}>
                No batch amendments. A fork that changes an eternal article is a different company.
              </p>
            </Panel>
            <Panel>
              <PanelTitle tone="violet">machines never amend</PanelTitle>
              <p className="text-[12.5px] leading-[21px] text-white/62 mb-4" style={{ fontWeight: 300 }}>
                evolve, the council, and every agent may cite the constitution and flag tension between an article and
                reality — but only the human may propose or approve a change. Adoption, amendments and violations are all
                spine events: the constitution itself runs on receipts.
              </p>
              <Receipt tone="violet">E1 applies to the constitution too</Receipt>
            </Panel>
          </div>
        </Reveal>
      </Chapter>

      {/* ── finale — the face is back at full presence behind this ── */}
      <section className="relative w-full min-h-[92vh] flex flex-col justify-center" style={{ fontFamily: "'Anybody', sans-serif" }}>
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 w-full text-center pb-40 pt-24">
          <Reveal>
            <div className="text-[11px] uppercase tracking-[0.34em] mb-6" style={{ fontFamily: MONO, color: 'rgba(0,255,209,0.85)' }}>
              the company is listening
            </div>
            <h2 className="text-[42px] sm:text-[64px] md:text-[80px] leading-[1.0] tracking-tight text-white mb-7" style={{ fontWeight: 600 }}>
              Ask Me Anything.
              <br />
              I Keep Receipts.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="flex flex-wrap justify-center gap-2.5 mb-10">
              {['What is arc?', 'How does a phase close?', 'Tell me about LexOS', 'What stays human forever?'].map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="text-[11px] uppercase tracking-[0.14em] text-white/78 border border-white/18 rounded-full px-5 min-h-[44px] hover:text-[#00ffd1] hover:border-[#00ffd1]/60 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ffd1]"
                  style={{ background: 'rgba(0,0,0,0.5)', fontFamily: MONO }}
                >
                  {q}
                </button>
              ))}
            </div>
            <button
              onClick={focusAsk}
              className="text-[12px] uppercase tracking-[0.22em] text-black rounded-full px-8 min-h-[48px] cursor-pointer transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00ffd1]"
              style={{ fontFamily: MONO, background: '#00ffd1', fontWeight: 700 }}
            >
              or type your own ↓
            </button>
          </Reveal>
        </div>

        {/* colophon */}
        <div className="absolute bottom-0 left-0 right-0">
          <HairlineDivider />
          <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-6 pb-40 sm:pb-36 flex flex-wrap justify-between gap-x-8 gap-y-3 text-[10px] uppercase tracking-[0.2em] text-white/42" style={{ fontFamily: MONO }}>
            <span>arc · v0.3.0 · concept design</span>
            <span>face: ported from the owner's chosen concept · voice: fully in-browser · no backend, no keys</span>
            <span>built by Ashiq · every number above has a repo receipt</span>
          </div>
        </div>
      </section>
    </>
  )
}

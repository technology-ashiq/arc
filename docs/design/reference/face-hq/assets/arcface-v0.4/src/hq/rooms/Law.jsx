// 08 · THE LAW — the constitution as an operating surface:
// adoption status, articles, amendment friction.
import { MONO, COLOR, SimBadge } from '../../ui/kit.jsx'
import { RoomHead, HPanel } from '../bits.jsx'
import { spine } from '../../spine/store.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'

export default function Law() {
  useSpine()
  const adopted = spine.events.some((e) => e.kind === 'decision.recorded' && e.decided && /Constitution/.test(e.decided.title) && e.decided.approved)

  return (
    <>
      <RoomHead
        title="The DNA of the company."
        hint="outranks every roadmap, ADR, plan, prompt and line of code — and it is the model-alignment layer"
        right={<SimBadge>{adopted ? 'adopted in this demo — constitution.adopted' : 'DRAFT v0.1 · adoption card appears in the inbox'}</SimBadge>}
      />

      {/* precedence */}
      <div className="flex items-center gap-2 mb-4 flex-wrap" style={{ fontFamily: MONO }}>
        {['Constitution', 'ADRs', 'PLAN', 'code'].map((t, i) => (
          <span key={t} className="flex items-center gap-2">
            <span className="text-[10.5px] uppercase tracking-[0.16em] px-3.5 py-[8px] rounded-full border" style={{ color: i === 0 ? '#000' : 'rgba(255,255,255,0.7)', background: i === 0 ? COLOR.cyan : 'transparent', borderColor: i === 0 ? COLOR.cyan : 'rgba(255,255,255,0.16)', fontWeight: i === 0 ? 700 : 400 }}>{t}</span>
            {i < 3 && <span className="text-white/40 text-[12px]">›</span>}
          </span>
        ))}
        <span className="text-[10px] text-white/45 ml-2">when anything conflicts with it, that thing is wrong</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {ARC.constitution.eternal.map((e) => (
          <HPanel key={e.id} tone="cyan" className="!mb-0">
            <div className="text-[9.5px] mb-2" style={{ fontFamily: MONO, color: COLOR.cyan }}>{e.id} · eternal — unamendable</div>
            <div className="text-[17px] tracking-tight text-white mb-2" style={{ fontWeight: 600 }}>{e.name}</div>
            <p className="text-[11.5px] leading-[17px] text-white/62" style={{ fontWeight: 300 }}>{e.text}</p>
          </HPanel>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <HPanel title="working articles — amendable, with friction">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {ARC.constitution.working.map((a) => (
              <div key={a.id} className="flex gap-3">
                <span className="text-[9.5px] mt-[3px] w-7 shrink-0" style={{ fontFamily: MONO, color: COLOR.cyan }}>{a.id}</span>
                <div className="text-[11.5px] leading-[17px]">
                  <span className="text-white/90" style={{ fontWeight: 600 }}>{a.name}.</span>{' '}
                  <span className="text-white/58" style={{ fontWeight: 300 }}>{a.text}</span>
                </div>
              </div>
            ))}
          </div>
        </HPanel>

        <div>
          <HPanel title="amending a working article" tone="amber">
            <div className="flex flex-wrap items-center gap-1.5 mb-3" style={{ fontFamily: MONO }}>
              {['written proposal (ADR form)', '7-day cooling', 'human sign-off', 'constitution.amended event'].map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="text-[9.5px] text-white/72 border border-white/15 rounded-md px-2 py-[5px]">{s}</span>
                  {i < 3 && <span style={{ color: COLOR.amber }}>→</span>}
                </span>
              ))}
            </div>
            <p className="text-[11px] leading-[16px] text-white/58" style={{ fontWeight: 300 }}>
              No batch amendments. A fork that changes a tier-E article is a different company. {ARC.constitution.amendment.split('. ').slice(-1)[0]}
            </p>
          </HPanel>

          <HPanel title="enforcement — teeth, not a poster">
            <div className="space-y-1.5 text-[11px] leading-[16px] text-white/62" style={{ fontWeight: 300 }}>
              <div>· ships in the core manifest — every instance carries it</div>
              <div>· every compiled process carries the digest in its preamble — models change, this keeps any model behaving like arc</div>
              <div>· kickoff-lint: a PLAN's non-negotiables must cite the articles they uphold</div>
              <div>· /arc-change step 0: does this violate an article?</div>
              <div>· council verdicts include a constitution-compliance lens</div>
              <div>· adoption, amendments, violations — all spine events (E1 applies to the law itself)</div>
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}

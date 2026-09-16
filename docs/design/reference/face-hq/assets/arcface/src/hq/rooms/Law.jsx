// 08 · THE LAW — the constitution as an operating surface:
// adoption status, articles, amendment friction.
import { MONO, COLOR, SimBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel } from '../bits.jsx'
import { spine } from '../../spine/store.js'
import { ARC } from '../../data/arcKnowledge.js'
import { useSpine } from '../useSpine.js'

const PRECEDENCE = ['Constitution', 'ADRs', 'PLAN', 'code']
const AMEND_STEPS = ['written proposal (ADR form)', '7-day cooling', 'human sign-off', 'constitution.amended event']
const TEETH = [
  'ships in the core manifest — every instance carries it',
  'every compiled process carries the digest in its preamble — models change, this keeps any model behaving like arc',
  "kickoff-lint: a PLAN's non-negotiables must cite the articles they uphold",
  '/arc-change step 0: does this violate an article?',
  'council verdicts include a constitution-compliance lens',
  'adoption, amendments, violations — all spine events (E1 applies to the law itself)',
]

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

      {/* precedence — the constitution outranks everything below it */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {PRECEDENCE.map((t, i) => (
          <span key={t} className="flex items-center gap-2">
            <Chip tone={i === 0 ? 'cyan' : undefined}>{t}</Chip>
            {i < PRECEDENCE.length - 1 && (
              <span aria-hidden="true" className="text-[13px]" style={{ color: 'var(--text-3)' }}>
                ›
              </span>
            )}
          </span>
        ))}
        <span className="text-[12px] ml-1" style={{ color: 'var(--text-3)' }}>
          when anything conflicts with it, that thing is wrong
        </span>
      </div>

      {/* the three eternal articles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {ARC.constitution.eternal.map((e) => (
          <HPanel key={e.id} className="!mb-0 min-w-0">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[11.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: COLOR.cyan }}>
                {e.id}
              </span>
              <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                eternal — unamendable
              </span>
            </div>
            <div className="text-[15px] leading-[20px] mb-1.5 break-words" style={{ fontWeight: 600, color: 'var(--text-1)' }}>
              {e.name}
            </div>
            <p className="text-[13px] leading-[20px] break-words" style={{ color: 'var(--text-2)' }}>
              {e.text}
            </p>
          </HPanel>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <HPanel title="Working articles" hint="amendable, with friction" className="min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {ARC.constitution.working.map((a) => (
              <div key={a.id} className="flex gap-3 min-w-0">
                <span className="text-[11.5px] mt-[3px] w-7 shrink-0" style={{ fontFamily: MONO, fontWeight: 600, color: COLOR.cyan }}>
                  {a.id}
                </span>
                <div className="min-w-0 text-[13px] leading-[20px] break-words">
                  <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{a.name}.</span>{' '}
                  <span style={{ color: 'var(--text-2)' }}>{a.text}</span>
                </div>
              </div>
            ))}
          </div>
        </HPanel>

        <div className="min-w-0">
          <HPanel title="Amending a working article" hint="one at a time, with friction">
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {AMEND_STEPS.map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  <Chip>{s}</Chip>
                  {i < AMEND_STEPS.length - 1 && (
                    <span aria-hidden="true" className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                      →
                    </span>
                  )}
                </span>
              ))}
            </div>
            <p className="text-[13px] leading-[20px] break-words" style={{ color: 'var(--text-2)' }}>
              No batch amendments. A fork that changes a tier-E article is a different company. {ARC.constitution.amendment.split('. ').slice(-1)[0]}
            </p>
          </HPanel>

          <HPanel title="Enforcement" hint="teeth, not a poster">
            <div className="-mx-2">
              {TEETH.map((t) => (
                <div key={t} className="grid grid-cols-[10px_1fr] gap-2 px-2 py-[7px] text-[13px] leading-[20px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <span aria-hidden="true" style={{ color: 'var(--text-3)' }}>·</span>
                  <span className="min-w-0 break-words" style={{ color: 'var(--text-2)' }}>{t}</span>
                </div>
              ))}
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}

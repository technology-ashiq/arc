// MEMORY — "A correction made twice becomes a rule."
// The playbook: log a correction, recall how we got burned before,
// and watch a lesson seen twice become proposable as a rule. Recall is
// a fold over lessons + the trial ledger + receipts — no model, no key,
// no spend. Promotion is YOUR stamp; the registry reads the decision.
import { useState } from 'react'
import { Brain, MagnifyingGlass } from '@phosphor-icons/react'
import { UI, MONO, FONT, COLOR, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, SectionLabel, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'
import { lessons, recall, recalls, trialLedger } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { LANES } from '../roomRegistry.js'
import { hhmm } from '../../spine/kinds.js'

const KINDS = new Set(['lesson.logged', 'rule.promoted', 'recall.ran'])
const LESSON_KINDS = ['correction', 'pattern', 'surprise']
const TABS = [
  { value: 'yours', label: 'yours' },
  { value: 'retro', label: 'retro-log' },
  { value: 'promoted', label: 'promoted' },
]
// same normalization the fold uses — a repeat is a repeat only if the text folds to the same key
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
// an item card inside a panel
const WELL = { background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }

export default function Memory() {
  useSpine()
  const [lesson, setLesson] = useState('')
  const [lane, setLane] = useState('develop')
  const [kind, setKind] = useState('correction')
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('yours')
  const [proposed, setProposed] = useState(() => new Set())
  const [msg, setMsg] = useState(null)

  const rows = lessons()
  const pastRecalls = recalls().slice(-5).reverse()
  const last = pastRecalls[0] || null
  const hits = last ? recall(last.q) : []
  const ledger = trialLedger().slice(0, 8)
  const trail = spine.events.filter((e) => KINDS.has(e.kind)).slice(-6).reverse()
  const visible = rows.filter((r) => (tab === 'yours' ? !!r.added : tab === 'retro' ? !!r.seed : !!r.promoted))
  const promotedN = rows.filter((r) => r.promoted).length
  const proposableN = rows.filter((r) => r.count >= 2 && !r.promoted).length

  const logLesson = () => {
    const v = lesson.trim()
    if (!v) return
    const prior = rows.find((r) => norm(r.lesson) === norm(v))
    const n = prior ? prior.count + 1 : 1
    const text = prior
      ? `lesson logged (${kind} · ${lane}): “${v}” — seen ×${n} — promotion is now proposable · a correction made twice becomes a rule`
      : `lesson logged (${kind} · ${lane}): “${v}” — first time · a lesson, not yet a rule`
    wsAppend('lesson.logged', 'memory', text, { lessonId: newRef('les'), lesson: v, lane, kind })
    setLesson('')
    setMsg(prior ? `seen ×${n} — “propose rule” is now live on that row.` : 'logged once. say it twice and it becomes proposable.')
  }

  const runRecall = () => {
    const v = q.trim()
    if (!v) return
    const found = recall(v)
    wsAppend('recall.ran', 'memory', `recall: “${v}” → ${found.length} hits · no model, no key, no spend — a fold over lessons, the trial ledger and receipts`, { q: v, hits: found.map((h) => h.ref), cost: { model: 'none', tokens: 0 } })
    setQ('')
  }

  const proposeRule = (r) => {
    wsRequestApproval({
      title: `memory: promote to rule — “${r.lesson.slice(0, 60)}”`,
      tag: 'memory · playbook',
      subject: 'memory.promote',
      data: { lessonId: r.lessonId, ruleId: newRef('R') },
      facts: [
        { k: 'council', v: `seen ${r.count}× — a correction made twice becomes a rule` },
        { k: 'money', v: 'no spend — a rule is text in .claude/rules, reviewed' },
        { k: 'kill', v: 'lands as a reviewed diff; unrecorded lessons are forgotten forever' },
      ],
    })
    setProposed((s) => new Set(s).add(r.lessonId))
    setMsg('promotion proposal is in your inbox — the registry reads your decision, this room does not write it.')
  }

  return (
    <>
      <RoomHead
        title="A correction made twice becomes a rule."
        hint="The playbook — what recall costs today, and which lessons were promoted out of the retro log"
        right={<YoursBadge>memory · lessons persisted</YoursBadge>}
      />

      <KpiStrip
        items={[
          { v: rows.length, l: 'Lessons in the registry', sub: 'yours and the retro log' },
          { v: promotedN, l: 'Promoted to rules', sub: 'stamped by you' },
          { v: proposableN, l: 'Proposable now', sub: proposableN ? 'seen twice, waiting on you' : 'nothing seen twice yet', tone: proposableN ? 'amber' : undefined },
          { v: '₹0', l: 'Recall cost', sub: '0 tokens · a fold, not a model' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Log a correction" hint="lesson.logged → the registry counts repeats by normalized text">
            <form
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3"
              onSubmit={(e) => {
                e.preventDefault()
                logLesson()
              }}
            >
              <Field label="Lesson" hint="one sentence, what to do differently">
                <TextInput value={lesson} onChange={setLesson} placeholder="assert the PRODUCTION count from the spine at close, not the fixture count" />
              </Field>
              <div className="flex items-end">
                <Btn tone="primary" onClick={logLesson}>Log →</Btn>
              </div>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <Field label="Lane"><PickRow small options={LANES} value={lane} onPick={setLane} /></Field>
              <Field label="Kind"><PickRow small options={LESSON_KINDS} value={kind} onPick={setKind} /></Field>
            </div>
            {msg && (
              <p className="mt-3 text-[12.5px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{msg}</p>
            )}
          </HPanel>

          <HPanel title="Recall" hint="how did we get burned by this before · a fold over lessons, the trial ledger and receipts at ₹0">
            <form
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3"
              onSubmit={(e) => {
                e.preventDefault()
                runRecall()
              }}
            >
              <Field label="Question">
                <TextInput value={q} onChange={setQ} placeholder="fixture-proven spine kinds never exercised" />
              </Field>
              <div className="flex items-end"><Btn tone="primary" onClick={runRecall}>Recall</Btn></div>
            </form>
            {last ? (
              <div className="p-3.5 min-w-0" style={WELL}>
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                  <span className="text-[12.5px] leading-[18px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
                    “{last.q}” <span style={{ color: 'var(--text-3)' }}>→ {hits.length} hits · model none, 0 tokens</span>
                  </span>
                  <span className="text-[11px] shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(last.id).slice(-6)}</span>
                </div>
                {hits.length === 0 && (
                  <p className="text-[12.5px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>No hit — nothing in the playbook or the ledger shares a word with that question. That is an honest zero, not a failed search.</p>
                )}
                <div className="space-y-1.5">
                  {hits.map((h) => (
                    <div key={h.ref} className="grid grid-cols-[auto_1fr] gap-x-2.5 items-start min-w-0">
                      <Chip tone={h.type === 'trial' ? 'blue' : 'cyan'}>{h.type}</Chip>
                      <span className="text-[12.5px] leading-[19px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
                        {h.lane && <span className="mr-1.5 text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{h.lane} ·</span>}
                        {h.text}
                        {h.src && <span className="ml-2 text-[11px] break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{h.src}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Empty icon={MagnifyingGlass} title="No recall has run yet" hint="Ask, and the answer is a receipt with hit refs, not a chat reply." />
            )}
            {pastRecalls.length > 1 && (
              <div className="mt-4">
                <SectionLabel>Earlier recalls</SectionLabel>
                <div className="-mx-2">
                  {pastRecalls.slice(1).map((r) => (
                    <div key={r.id} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 px-2 py-[6px] border-b border-(--line-1) last:border-b-0 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderRadius: 'var(--r-sm)' }}>
                      <span className="text-[11px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{(r.iso || '').slice(0, 10)}</span>
                      <span className="text-[12.5px] truncate" style={{ fontFamily: UI, color: 'var(--text-2)' }}>“{r.q}” → {r.hits.length} hits</span>
                      <span className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(r.id).slice(-6)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </HPanel>

          <HPanel
            title="Lessons"
            hint={`${rows.length} in the registry · a lesson seen twice becomes proposable, a promoted row carries its rule id`}
            actions={<PickRow small options={TABS} value={tab} onPick={setTab} />}
          >
            {visible.length === 0 && (
              tab === 'yours' ? (
                <Empty icon={Brain} title="No lesson of yours yet" hint="Log one above. The retro-log tab holds what arc already learned." />
              ) : tab === 'promoted' ? (
                <Empty icon={Brain} title="Nothing promoted yet" hint="A lesson seen twice, proposed, and stamped by you lands here." />
              ) : (
                <Empty icon={Brain} title="The retro log carried no rows into this build" />
              )
            )}
            <div className="space-y-2">
              {visible.map((r) => {
                const isProposed = proposed.has(r.lessonId)
                return (
                  <div key={r.lessonId} className="p-3.5 min-w-0" style={WELL}>
                    <div className="text-[13.5px] leading-[20px] mb-2 break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{r.lesson}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip mono>{r.lane || 'hq'}</Chip>
                      <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{r.kind}</span>
                      <span className="text-[11px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.date}</span>
                      {r.count >= 2 && !r.promoted && <Chip tone="amber">×{r.count}</Chip>}
                      {r.promoted && <Chip tone="cyan" mono>rule {r.ruleId}</Chip>}
                      {r.seed ? <span className="text-[11px] break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.src}</span> : <YoursBadge>yours</YoursBadge>}
                    </div>
                    {r.count >= 2 && !r.promoted && (
                      <div className="mt-3 flex items-center gap-3 flex-wrap">
                        {isProposed ? (
                          <span className="text-[12px]" style={{ fontFamily: UI, color: COLOR.amber }}>proposed → inbox · waiting on your stamp</span>
                        ) : (
                          <Btn small onClick={() => proposeRule(r)}>Propose rule →</Btn>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </HPanel>

          {trail.length > 0 && (
            <HPanel title="The trail" hint="the last 6 of lesson.logged, rule.promoted and recall.ran">
              <div className="-mx-2">
                {trail.map((e) => (
                  <div key={e.id} className="grid grid-cols-[44px_1fr_auto] items-baseline gap-x-3 px-2 py-[7px] border-b border-(--line-1) last:border-b-0 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderRadius: 'var(--r-sm)' }}>
                    <span className="text-[11.5px] tnum" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{hhmm(e.t)}</span>
                    <span className="text-[13px] leading-[20px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{e.text}</span>
                    <span className="text-[11px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(e.id).slice(-6)}</span>
                  </div>
                ))}
              </div>
            </HPanel>
          )}
        </div>

        <div className="min-w-0">
          <HPanel title="Trial ledger" hint="last 8 · docs/trial-ledger.md">
            {ledger.length === 0 && <Empty title="No trial rows" hint="docs/trial-ledger.md carried no rows into this build." />}
            <div className="-mx-2">
              {ledger.map((t) => (
                <div key={t.trialId} className="px-2 py-2 min-w-0 border-b border-(--line-1) last:border-b-0 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderRadius: 'var(--r-sm)' }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12.5px] truncate" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{t.capability}</span>
                    <span className="text-[11px] tnum shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{t.date}</span>
                  </div>
                  <div className="text-[12.5px] leading-[18px] break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{t.outcome}</div>
                  <div className="text-[11px] truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{t.src}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-[17px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>No streak column exists in docs/trial-ledger.md — streaks are not shown because they are not recorded.</p>
          </HPanel>

          <HPanel title="The playbook rule">
            <ul className="list-disc pl-4 space-y-1.5">
              {FACTS.memory.playbook.slice(0, 4).map((line, i) => (
                <li key={i} className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{line.replace(/^[-|]\s*/, '')}</li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{FACTS.memory.plan.goal}</p>
          </HPanel>

          <HPanel title="Recall cost">
            {FACTS.memory.recallCost && FACTS.memory.recallCost.absent ? (
              <div className="space-y-2">
                <SimBadge>ABSENT · {FACTS.memory.recallCost.reason}</SimBadge>
                <p className="text-[12.5px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>This app's recall is a fold: ₹0, 0 tokens.</p>
              </div>
            ) : (
              <div className="text-[22px] leading-[26px] tracking-[-0.01em] break-words" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{String(FACTS.memory.recallCost)}</div>
            )}
          </HPanel>

          <HPanel title="Memory lane phases" hint="initiatives/memory/PLAN.md">
            {FACTS.memory.plan.phases.length === 0 ? (
              <Empty title="No phases table in the memory plan" hint="None is invented here." />
            ) : (
              <div className="-mx-2">
                {FACTS.memory.plan.phases.map((p, i) => {
                  const closed = /closed|done/i.test(p.status || '')
                  return (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 px-2 py-[6px] border-b border-(--line-1) last:border-b-0" style={{ borderRadius: 'var(--r-sm)' }}>
                      <span className="text-[12.5px] truncate" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{p.phase || p.name}</span>
                      <span className="text-[12px] truncate" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{p.status || 'status not recorded'}</span>
                      {closed && <span className="text-[12px]" style={{ color: COLOR.cyan }}>✓</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </HPanel>
        </div>
      </div>
    </>
  )
}

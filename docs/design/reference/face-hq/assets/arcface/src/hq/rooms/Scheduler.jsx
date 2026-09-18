// SCHEDULER — "Nothing runs because someone remembered."
// Jobs with a closed grammar (daily@HH:MM · weekdays@HH:MM, IST), each
// bound to a policy subject — no row in the policy file, no job. A fire
// is idempotent per slot; a failure writes its receipt and turns the job
// off rather than run unpoliced (REQ-04). The heartbeat's first duty is
// sealing the books.
import { useState } from 'react'
import { Clock, Timer, ListChecks } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, StatusDot, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, SectionLabel, EventRow, ReceiptDrawer, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend, newRef } from '../../spine/workspace.js'
import { jobs, nextFire, heartbeat, SCHEDULE_RE, policySubjects } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'

const NAME_RE = /^[a-z0-9-]+$/
const TRAIL_KINDS = new Set(['job.registered', 'job.fired', 'job.failed', 'job.paused', 'heartbeat.ok'])
const BUDGETS = ['1', '2', '5']
const GRAMMAR_ERR = 'grammar is closed to two forms: daily@HH:MM and weekdays@HH:MM (IST)'
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
const OUTCOME_TONE = { ok: 'cyan', failed: 'red' }
const PROSE = { fontFamily: UI, color: 'var(--text-2)' }
const NOTE = { fontFamily: UI, color: 'var(--text-3)' }
const DATA = { fontFamily: MONO, color: 'var(--text-1)' }
const WELL = { background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }

function Cell({ label, children, tone }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] leading-[14px] mb-0.5" style={NOTE}>{label}</div>
      <div className="text-[12px] leading-[16px] tnum truncate" style={{ fontFamily: MONO, color: tone || 'var(--text-1)' }}>{children}</div>
    </div>
  )
}

export default function Scheduler() {
  useSpine()
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('')
  const [process, setProcess] = useState(null)
  const [budget, setBudget] = useState('2')
  const [msg, setMsg] = useState(null)
  const [refused, setRefused] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const rows = jobs()
  const hb = heartbeat()
  const subjects = policySubjects().map((s) => s.subject)
  const trail = spine.events.filter((e) => TRAIL_KINDS.has(e.kind)).slice(-8).reverse()
  const sf = FACTS.scheduler.stateFiles || {}
  const closed = sf.closedDays
  const paused = rows.filter((j) => j.paused).length
  const fires = rows.reduce((n, j) => n + j.fires.length, 0)
  const briefsN = Array.isArray(sf.briefs) ? sf.briefs.length : sf.briefs == null ? '—' : sf.briefs
  const closedN = closed == null ? '—' : typeof closed === 'number' ? closed : typeof closed === 'object' && typeof closed.count === 'number' ? closed.count : '—'
  const closedDetail = closed == null ? 'not instrumented' : typeof closed === 'number' ? closed : typeof closed === 'object' ? Object.entries(closed).map(([k, v]) => `${k} ${Array.isArray(v) ? v.length : v}`).join(' · ') : String(closed)

  const register = () => {
    const n = name.trim()
    if (!NAME_RE.test(n)) return setMsg({ err: 'a job name is lowercase, digits and dashes — nothing else' })
    if (!SCHEDULE_RE.test(schedule.trim())) return setMsg({ err: GRAMMAR_ERR })
    if (!process) return setMsg({ err: 'deny-by-default: no row in the policy file, no job — pick a subject' })
    if (rows.some((r) => r.name === n)) return setMsg({ err: `${n} is already registered — one row per job` })
    const jobId = newRef('job')
    wsAppend('job.registered', 'scheduler', `job ${n} registered · ${schedule.trim()} IST · runs as ${process} · budget ${budget} min · catchup: skip — nothing runs because someone remembered`, { jobId, name: n, schedule: schedule.trim(), process, budgetMin: parseInt(budget, 10), catchup: 'skip' })
    setName('')
    setSchedule('')
    setMsg(`${n} is on the clock — next fire ${(nextFire(schedule.trim()) || {}).label}.`)
  }

  const fire = (j) => {
    const slot = `${spine.dayIndex}@${j.schedule}`
    if (j.fires.some((f) => f.slot === slot)) return setRefused({ jobId: j.jobId, text: 'idem@slot — already fired this slot, a second run is refused' })
    setRefused(null)
    const h = hash(j.name)
    const ms = 400 + (h % 1800)
    const tag = j.seed ? 'rehearsal fire of a repo job' : 'fire'
    if (h % 7 === 0) {
      wsAppend('job.failed', 'scheduler', `job ${j.name} failed · ${tag} · slot ${slot} · exit 2 after ${ms}ms — receipt written, job turned itself off (REQ-04)`, { jobId: j.jobId, outcome: 'failed', ms, slot, reason: 'exit 2 — receipt written, job turned itself off' })
      wsAppend('job.paused', 'scheduler', `job ${j.name} paused by its own failure — it turns itself off rather than run unpoliced (REQ-04)`, { jobId: j.jobId, paused: true })
      return
    }
    wsAppend('job.fired', 'scheduler', `job ${j.name} fired · ${tag} · slot ${slot} · ok in ${ms}ms · within budget ${j.budgetMin} min`, { jobId: j.jobId, outcome: 'ok', ms, slot })
  }

  const beat = () => {
    wsAppend('heartbeat.ok', 'scheduler', `heartbeat ok · books sealed for day ${spine.dayIndex} · closed-day marker written`, { day: spine.dayIndex, sealed: (sf && sf.closedDays) || null })
    setMsg(`heartbeat ⌗ written — day ${spine.dayIndex} sealed.`)
  }

  return (
    <>
      <RoomHead title="Nothing runs because someone remembered." hint="jobs, their next fire, their last outcome, and the heartbeat that proves the clock is alive" right={<YoursBadge>scheduler · jobs persisted</YoursBadge>} />

      <KpiStrip
        items={[
          { v: rows.length, l: 'Jobs on the clock', sub: fires + ' fires so far' },
          { v: paused, l: 'Paused', sub: paused ? 'turned off, not running' : 'every job policed', tone: paused ? 'amber' : undefined },
          { v: hb.count, l: 'Heartbeats', sub: 'today is day ' + spine.dayIndex, tone: hb.alive ? undefined : 'amber' },
          { v: briefsN, l: 'Briefs materialized' },
          { v: closedN, l: 'Closed days' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Register a job" hint="job.registered → a row on the clock · catchup: skip · a job must name a policy subject">
            <form className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3" onSubmit={(e) => { e.preventDefault(); register() }}>
              <Field label="Name"><TextInput mono value={name} onChange={setName} placeholder="weekly-digest" /></Field>
              <Field label="Schedule" hint="daily@HH:MM · weekdays@HH:MM"><TextInput mono value={schedule} onChange={setSchedule} placeholder="weekdays@07:30" /></Field>
            </form>
            <Field label="Process subject" hint="no row in the policy file, no job" className="mb-3">
              <PickRow options={subjects} value={process} onPick={setProcess} />
            </Field>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <Field label="Budget · minutes"><PickRow options={BUDGETS} value={budget} onPick={setBudget} /></Field>
              <Btn tone="primary" onClick={register}>Register →</Btn>
            </div>
            {msg && <div className="mt-3 text-[12.5px] leading-[19px] break-words" style={{ fontFamily: UI, color: msg.err ? COLOR.red : COLOR.green }}>{msg.err || msg}</div>}
          </HPanel>

          <HPanel title={`The jobs — ${rows.length} on the clock`} hint="next fire · last outcome · fires — a fire is idempotent per slot">
            {rows.length === 0 && <Empty icon={Timer} title="No job on the clock" hint="Register one above. A job must name a policy subject before it can fire." />}
            <div className="space-y-2.5">
              {rows.map((j) => {
                const nf = nextFire(j.schedule)
                const outcome = j.lastOutcome || 'never-fired'
                return (
                  <div key={j.jobId} className="p-3.5 min-w-0" style={{ ...WELL, opacity: j.paused ? 0.6 : 1 }}>
                    <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
                      <b className="text-[13.5px] break-all" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{j.name}</b>
                      <Chip mono tone={OUTCOME_TONE[outcome]}>{outcome}</Chip>
                      {j.paused && <Chip tone="amber">paused</Chip>}
                      {j.seed ? <SimBadge>repo fact · {j.src}</SimBadge> : <YoursBadge>yours</YoursBadge>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mb-2.5">
                      <Cell label="Schedule">{j.schedule}{nf && nf.weekdaysOnly ? ' · mon–fri' : ''}</Cell>
                      <Cell label="Next fire" tone={nf ? undefined : COLOR.red}>{nf ? nf.label : 'no next fire — bad grammar'}</Cell>
                      <Cell label="Runs as">{j.process}</Cell>
                      <Cell label="Budget · fires · catchup">{j.budgetMin} min · {j.fires.length} · {typeof j.catchup === 'string' ? j.catchup.replace(/^catchup:\s*/, '') : String(j.catchup)}</Cell>
                    </div>
                    {j.notes && <div className="text-[12px] leading-[18px] mb-2.5" style={NOTE}>{j.notes.replace(/#\s*/g, '')}</div>}
                    <div className="flex items-center gap-2 flex-wrap">
                      {!j.paused && <Btn small onClick={() => fire(j)}>Fire now · {spine.dayIndex}@{j.schedule}</Btn>}
                      {j.paused ? (
                        <Btn small onClick={() => wsAppend('job.paused', 'scheduler', `job ${j.name} resumed by you — it is policed again`, { jobId: j.jobId, paused: false })}>Resume</Btn>
                      ) : (
                        <Btn small tone="danger" onClick={() => wsAppend('job.paused', 'scheduler', `job ${j.name} paused by you — the slot passes, catchup: skip`, { jobId: j.jobId, paused: true })}>Pause</Btn>
                      )}
                      {refused && refused.jobId === j.jobId && <span className="text-[12px]" style={{ fontFamily: UI, color: COLOR.amber }}>{refused.text}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </HPanel>

          <HPanel title="The trail" hint="every fire, failure, pause and beat is a receipt">
            {trail.length === 0 && <Empty icon={Clock} title="No scheduler receipt yet" hint="The clock has not been asked to prove itself. Fire a job or beat the heartbeat and the receipt lands here." />}
            {trail.length > 0 && (
              <div className="-mx-2">
                {trail.map((e) => (
                  <EventRow key={e.id} e={e} onReceipt={setReceipt} />
                ))}
              </div>
            )}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Heartbeat" tone={hb.alive ? undefined : 'amber'} actions={<Btn small tone="primary" onClick={beat}>Beat — seal the books</Btn>}>
            <div className="flex items-center gap-2.5 mb-2">
              <StatusDot state={hb.alive ? 'live' : 'sleeping'} />
              <span className="text-[13px] leading-[19px] min-w-0" style={{ fontFamily: UI, color: 'var(--text-1)' }}>
                {hb.last ? (
                  <>
                    alive — last beat <span style={{ fontFamily: MONO }}>⌗ {String(hb.last.id).slice(-6)}</span> · day <span className="tnum" style={{ fontFamily: MONO }}>{hb.last.day}</span>
                  </>
                ) : (
                  'no beat yet — the clock is unproven'
                )}
              </span>
            </div>
            <div className="text-[12.5px] leading-[19px]" style={PROSE}>{FACTS.scheduler.heartbeat[0].replace(/^#\s*/, '')}</div>
          </HPanel>

          <HPanel title="The grammar">
            <div className="space-y-1 mb-3">
              {FACTS.scheduler.grammar.map((g) => (
                <div key={g} className="text-[12px] leading-[18px]" style={PROSE}>· {g.replace(/^#\s*/, '')}</div>
              ))}
            </div>
            <div className="text-[12px] leading-[18px] mb-1" style={{ fontFamily: UI, color: COLOR.red }}>
              <span style={{ fontFamily: MONO }}>{FACTS.scheduler.ceiling}</span> — no paid job may run
            </div>
            <div className="text-[12px] leading-[18px] break-words" style={NOTE}>
              defaults · <span style={{ fontFamily: MONO }}>{FACTS.scheduler.defaults}</span> · file <span style={{ fontFamily: MONO }}>{FACTS.scheduler.file}</span>
            </div>
          </HPanel>

          <HPanel title="State on disk">
            <SectionLabel>Job logs</SectionLabel>
            <div className="space-y-1 mb-3">
              {(sf.jobLogs || []).map((f) => <div key={f} className="text-[11.5px] leading-[16px] break-all" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{f}</div>)}
              {!(sf.jobLogs || []).length && <div className="text-[12px]" style={NOTE}>no job log on disk — nothing has fired</div>}
            </div>
            <div className="text-[12px] leading-[18px] mb-1" style={NOTE}>
              briefs materialized · <span className="tnum" style={DATA}>{Array.isArray(sf.briefs) ? sf.briefs.length : sf.briefs == null ? 'not instrumented' : sf.briefs}</span>
            </div>
            <div className="text-[12px] leading-[18px] break-words" style={NOTE}>
              closed days · <span className="tnum" style={DATA}>{closedDetail}</span>
            </div>
          </HPanel>

          <HPanel title="Lane phases">
            {(FACTS.scheduler.phases || []).length === 0 && <Empty icon={ListChecks} title="No phase rows in the repo fact" hint="The scheduler lane's plan carries none yet." />}
            {(FACTS.scheduler.phases || []).length > 0 && (
              <div className="-mx-2">
                {(FACTS.scheduler.phases || []).map((p, i) => (
                  <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-3 px-2 py-[7px] text-[12.5px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)' }}>
                    <span className="tnum" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{p.phase || p.name || `phase ${i}`}</span>
                    <span className="min-w-0 text-right text-[12px] leading-[17px] break-words" style={NOTE}>{p.status || 'status unknown'}</span>
                  </div>
                ))}
              </div>
            )}
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}

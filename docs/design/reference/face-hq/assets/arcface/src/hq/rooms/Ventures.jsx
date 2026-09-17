// VENTURES — "The factory is not the product."
// Each venture lives in its own repo with its own money and its own kill
// criteria, written at kickoff. Money never lives in the venture file —
// real ₹ is a fold over revenue.received receipts and is usually ₹0, which
// the room says out loud. A kill is a stamped decision (A10): attic with a
// retro, components harvested, the lesson pinned — never deleted.
import { useState } from 'react'
import { Buildings, Receipt } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Meter, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, SectionLabel, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'
import { ventures } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { uiBus } from '../../lib/uiBus.js'

const STAGES = ['kickoff', 'building', 'launched', 'live']
const CEILINGS = [{ value: 60, label: '60d' }, { value: 90, label: '90d' }, { value: 120, label: '120d' }]
const KINDS = new Set(['venture.registered', 'venture.staged', 'venture.killed'])
// status → chip tone. live is the accent (a real, running thing); candidate is neutral progress; attic is quiet.
const STATUS_TONE = { live: 'cyan', candidate: 'blue' }

const crossed = (r, k) => k.measurable !== false && k.criterion === 'days_without_revenue' && r.daysWithoutRevenue >= k.value
// a kill proposal that is still in the inbox — derived from the pending approvals, not from local state
const killPending = (id) => spine.pendingApprovals.some((a) => a.subject === 'venture.kill' && a.data && a.data.ventureId === id)

function Absent({ label, reason }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap text-[12px] leading-[18px]" style={{ fontFamily: UI }}>
      <span className="w-[56px] shrink-0" style={{ color: 'var(--text-3)' }}>{label}</span>
      <SimBadge>absent</SimBadge>
      <span className="min-w-0 break-words" style={{ color: COLOR.violet }}>{reason}</span>
    </div>
  )
}

function Criterion({ r, k }) {
  if (k.measurable === false) {
    return (
      <div className="text-[12px] leading-[18px]" style={{ fontFamily: UI }}>
        <span style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{k.criterion}</span> <span style={{ color: 'var(--text-3)' }}>· {k.value} · {k.direction}</span>
        <div className="break-words" style={{ color: COLOR.violet }}>ABSENT · not instrumented — {(k.note || 'no source in the ledger reads this line').replace(/^#\s*/, '')}</div>
      </div>
    )
  }
  const cur = k.criterion === 'days_without_revenue' ? r.daysWithoutRevenue : null
  const p = cur == null ? 0 : Math.min(1, cur / k.value)
  const c = p >= 1 ? COLOR.red : p >= 0.7 ? COLOR.amber : 'var(--text-2)'
  return (
    <div className="text-[12px] leading-[18px]" style={{ fontFamily: UI }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{k.criterion}</span>
        <span style={{ color: 'var(--text-3)' }}>· {k.value} · {k.direction}</span>
        <span className="ml-auto tnum" style={{ fontFamily: cur == null ? UI : MONO, color: c }}>
          {cur == null ? 'no reader for this line' : `${cur}/${k.value}d${p >= 1 ? ' · crossed' : ''}`}
        </span>
      </div>
      {cur != null && <div className="mt-1.5"><Meter value={p} tone={p >= 1 ? 'critical' : p >= 0.7 ? 'warn' : 'blue'} /></div>}
    </div>
  )
}

export default function Ventures() {
  useSpine()
  const rows = ventures()
  const [staging, setStaging] = useState(null)
  const [name, setName] = useState('')
  const [repo, setRepo] = useState('')
  const [stage, setStage] = useState('kickoff')
  const [ceiling, setCeiling] = useState(90)
  const [msg, setMsg] = useState(null)
  const trail = spine.events.filter((e) => KINDS.has(e.kind)).slice(-6).reverse()
  const rules = (FACTS.ventures.rules || []).slice(0, 5).map((l) => l.replace(/^#\s*/, ''))
  // the strip's figures — folds over the same rows the list renders
  const liveN = rows.filter((r) => r.status === 'live').length
  const realTotal = rows.reduce((s, r) => s + (Number(r.realRevenue) || 0), 0)
  const reviewsN = rows.filter((r) => killPending(r.ventureId)).length

  const setStageFor = (r, to) => {
    if (to === r.stage) return setStaging(null)
    wsAppend('venture.staged', 'ventures', `venture ${r.name}: ${r.stage} → ${to} · the venture track wins every tie — the factory is not the product`, { ventureId: r.ventureId, stage: to })
    setStaging(null)
    setMsg(`${r.name} staged → ${to}.`)
  }

  const proposeKill = (r) => {
    const k = (r.kill || []).find((x) => x.criterion === 'days_without_revenue') || (r.kill || [])[0]
    const cur = k && k.criterion === 'days_without_revenue' ? r.daysWithoutRevenue : 'n/a'
    const hit = k ? crossed(r, k) : false
    wsRequestApproval({
      title: `kill review: ${r.name}`,
      tag: 'ventures · A10',
      subject: 'venture.kill',
      data: { ventureId: r.ventureId },
      facts: [
        { k: 'council', v: `criterion ${k ? k.criterion : 'none written'} at ${cur}/${k ? k.value : '—'} — ${hit ? 'crossed' : 'not crossed; this is an early review'}` },
        { k: 'money', v: `real ₹ to date: ${r.realRevenue}` },
        { k: 'kill', v: 'attic with a retro, components harvested, the lesson pinned — never deleted (A10)' },
      ],
    })
    setMsg(`kill review for ${r.name} is in your inbox — nothing moves until you stamp it.`)
  }

  const register = () => {
    const n = name.trim()
    if (!n) return
    const rp = repo.trim()
    wsAppend('venture.registered', 'ventures', `venture ${n} registered · own repo${rp ? ' ' + rp : ' (set at kickoff)'} · stage ${stage} · kill line ${ceiling} days without revenue, a ceiling — criteria only, money never lives here`, {
      ventureId: newRef('v'), name: n, repo: rp, stage, kill: [{ criterion: 'days_without_revenue', value: ceiling, direction: 'CEILING: crosses upward' }],
    })
    setName('')
    setRepo('')
    setStage('kickoff')
    setMsg(`${n} is a candidate — its kill line was written before its first launch.`)
  }

  return (
    <>
      <RoomHead title="The factory is not the product." hint="each venture in its own repo with its own money and its own kill criteria — the venture track wins every tie" right={<YoursBadge>ventures · registered persisted</YoursBadge>} />

      {/* figures lead — real ₹ is green only when a receipt actually fired */}
      <KpiStrip
        items={[
          { v: rows.length, l: 'Ventures in the file', sub: `${liveN} live` },
          realTotal > 0
            ? { v: '₹' + realTotal.toLocaleString('en-IN'), l: 'Real ₹ to date', sub: 'revenue.received', tone: 'green' }
            : { v: '₹0', l: 'Real ₹ to date', sub: 'never-fired · honest' },
          { v: reviewsN, l: 'Kill reviews waiting', sub: reviewsN ? 'in your inbox' : 'nothing pending your stamp', tone: reviewsN ? 'amber' : undefined },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title={`Ventures — ${rows.length}`} hint="live · candidate · attic — a row leaves only by your stamp, and never by deletion" tone={reviewsN ? 'amber' : undefined}>
            <div className="space-y-2.5">
              {rows.map((r) => {
                const attic = r.status === 'attic'
                const anyCrossed = (r.kill || []).some((k) => crossed(r, k))
                const pending = killPending(r.ventureId)
                return (
                  <div key={r.ventureId} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', opacity: attic ? 0.55 : 1 }}>
                    <div className="flex items-center gap-2 flex-wrap mb-2 min-w-0">
                      <b className="text-[13.5px] leading-[19px]" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)', textDecoration: attic ? 'line-through' : 'none' }}>{r.name}</b>
                      <Chip tone={STATUS_TONE[r.status]}>{r.status}</Chip>
                      <Chip>{r.stage}</Chip>
                      <span className="text-[11.5px] min-w-0 break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.repo}</span>
                      {r.seed ? <SimBadge>repo fact</SimBadge> : <YoursBadge>yours</YoursBadge>}
                    </div>
                    <div className="flex items-baseline gap-2 flex-wrap text-[12px] leading-[18px]" style={{ fontFamily: UI }}>
                      <span className="w-[56px] shrink-0" style={{ color: 'var(--text-3)' }}>real ₹</span>
                      {r.realRevenue > 0 ? (
                        <span className="tnum" style={{ fontFamily: MONO, color: COLOR.green }}>₹{r.realRevenue} · revenue.received</span>
                      ) : (
                        <span className="tnum" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>₹0 · never-fired (honest)</span>
                      )}
                    </div>
                    {r.money && r.money.absent && <Absent label="money" reason={r.money.reason} />}
                    {r.mrr && r.mrr.absent && <Absent label="mrr" reason={r.mrr.reason} />}
                    <SectionLabel className="mt-3">kill criteria — written at kickoff</SectionLabel>
                    <div className="space-y-2">
                      {(r.kill || []).map((k, i) => <Criterion key={i} r={r} k={k} />)}
                      {!(r.kill || []).length && <div className="text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>no kill line written — a venture without one has not kicked off</div>}
                    </div>
                    {(r.notes || []).length > 0 && (
                      <div className="mt-2 text-[12px] leading-[18px] space-y-0.5" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                        {r.notes.map((n, i) => <div key={i} className="break-words">{n.replace(/^#\s*/, '')}</div>)}
                      </div>
                    )}
                    {r.src && <div className="mt-1.5 text-[11px] break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.src}</div>}
                    <div className="mt-3 flex gap-2 flex-wrap items-center text-[12px] leading-[18px]" style={{ fontFamily: UI }}>
                      {attic && <span style={{ color: COLOR.red }}>attic · killed{r.retro ? ` — retro: ${r.retro}` : ' — retro pending'}</span>}
                      {!attic && pending && <span style={{ color: COLOR.amber }}>kill review is in your inbox — pending your stamp</span>}
                      {!attic && !pending && staging !== r.ventureId && <Btn small onClick={() => setStaging(r.ventureId)}>Stage →</Btn>}
                      {!attic && !pending && staging === r.ventureId && <PickRow small options={STAGES} value={r.stage} onPick={(s) => setStageFor(r, s)} />}
                      {!attic && !pending && (anyCrossed || !r.seed) && <Btn small tone="danger" onClick={() => proposeKill(r)}>{anyCrossed ? 'Propose kill →' : 'Kill review →'}</Btn>}
                      {!attic && !pending && r.seed && !anyCrossed && <span style={{ color: 'var(--text-3)' }}>kill line not crossed — no review yet</span>}
                    </div>
                  </div>
                )
              })}
              {!rows.length && <Empty icon={Buildings} title="No ventures" hint="the file is empty, and it says so — register one below; its kill line is written before the first launch" />}
            </div>
            {msg && <div className="mt-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--accent)' }}>{msg}</div>}
          </HPanel>

          <HPanel title="Register a venture" hint="venture.registered → candidate · the kill line is written before the first launch">
            <form
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                register()
              }}
            >
              <Field label="Name"><TextInput value={name} onChange={setName} placeholder="one word the customer would say" /></Field>
              <Field label="Repo"><TextInput value={repo} onChange={setRepo} placeholder="own repo — set at kickoff" /></Field>
              <Field label="Stage"><PickRow options={STAGES} value={stage} onPick={setStage} /></Field>
              <Field label="days_without_revenue ceiling"><PickRow options={CEILINGS} value={ceiling} onPick={setCeiling} /></Field>
              <div className="sm:col-span-2 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[12px] leading-[18px] min-w-0" style={{ fontFamily: UI, color: 'var(--text-3)' }}>money never lives here — it arrives as revenue.received / cost.recorded</span>
                <Btn tone="primary">Register →</Btn>
              </div>
            </form>
          </HPanel>

          <HPanel title="venture.* — the trail" hint="every stage change and every kill review is a receipt">
            {trail.length === 0 && <Empty icon={Receipt} title="Nothing yet" hint="the first venture.* receipt lands here" />}
            {trail.length > 0 && (
              <div className="-mx-2">
                {trail.map((e) => (
                  <div key={e.id} className="grid grid-cols-[1fr_auto] items-baseline gap-3 px-2 py-2 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                    <span className="text-[13px] leading-[20px] min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{e.text}</span>
                    <span className="text-[11px] shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(e.id).slice(-6)}</span>
                  </div>
                ))}
              </div>
            )}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="The rules of the file" hint={FACTS.ventures.file}>
            <div className="text-[12.5px] leading-[19px] space-y-1.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {rules.map((l, i) => <div key={i} className="break-words">· {l}</div>)}
            </div>
            <div className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
              cannot be edited silently — the digest is over parsed values. criteria only — money never lives here.
            </div>
          </HPanel>

          <HPanel title="1 in 4" hint="the base rate, planned for">
            <p className="text-[13.5px] leading-[21px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              One in four ventures is expected to live — written before the first launch, so a death is a data point, not a surprise. Kill-distance meters exist because the criteria were set at kickoff, in writing.
            </p>
          </HPanel>

          <HPanel title="Ship WITH distribution">
            <p className="text-[13.5px] leading-[21px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              A venture without a distribution plan does not ship. Launch week is a written playbook — one channel per day, personal, honest. Growth wakes as a module only when a live venture pulls it.
            </p>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Btn small onClick={() => uiBus.openRoom('board')}>Appetite and burn → the board</Btn>
              <Btn small onClick={() => uiBus.openRoom('money')}>The ledger → money</Btn>
            </div>
          </HPanel>
        </div>
      </div>
    </>
  )
}

// STRATEGY — "One plan is live per lane. The rest are history."
// The plans (one live per born lane, from initiatives/<lane>/PLAN.md; the
// design-source plans and briefs behind them as history), the ADRs on disk,
// and the decisions that are now too expensive to revisit. Adopting a plan
// retires its predecessor to history — it never deletes it. An ADR is
// superseded by a new ADR, never edited.
import { useState } from 'react'
import { Books } from '@phosphor-icons/react'
import { FONT, MONO, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, SectionLabel, Empty, EventRow, ReceiptDrawer } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend, newRef } from '../../spine/workspace.js'
import { plans, adrs } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { LANES } from '../roomRegistry.js'

const TABS = ['live', 'history', 'all']
const APPETITES = [{ value: 3, label: '3d' }, { value: 5, label: '5d' }, { value: 8, label: '8d' }, { value: 12, label: '12d' }]
const REVERSIBILITY = ['reversible', 'expensive', 'one-way']
const KINDS = new Set(['plan.adopted', 'adr.recorded'])
const REV_TONE = { 'one-way': 'red', expensive: 'amber' }

function RevChip({ v }) {
  return <Chip tone={REV_TONE[v]}>{v}</Chip>
}

// an inline confirmation under a write path — quiet, never an alert
function Note({ children }) {
  return (
    <div className="mt-3 pl-3 text-[12.5px] leading-[19px] break-words" style={{ borderLeft: '2px solid var(--accent)', color: 'var(--text-2)' }}>
      {children}
    </div>
  )
}

export default function Strategy() {
  useSpine()
  const all = plans()
  const a = adrs()
  const [tab, setTab] = useState('live')
  const [lane, setLane] = useState('develop')
  const [title, setTitle] = useState('')
  const [appetite, setAppetite] = useState(5)
  const [adrTitle, setAdrTitle] = useState('')
  const [adrLane, setAdrLane] = useState('develop')
  const [rev, setRev] = useState('reversible')
  const [msg, setMsg] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const trail = spine.events.filter((e) => KINDS.has(e.kind)).slice(-6).reverse()

  const live = all.filter((r) => r.status === 'live').sort((x, y) => x.lane.localeCompare(y.lane))
  const history = all.filter((r) => r.status !== 'live')
  const shown = tab === 'live' ? live : tab === 'history' ? history : [...live, ...history]
  const nextN = (a.highest || 1316) + 1 + a.yours.length

  const adopt = () => {
    const t = title.trim()
    if (!t) return
    wsAppend('plan.adopted', 'strategy', `plan adopted for ${lane}: “${t}” · appetite ${appetite}d · the previous live plan is now history`, { planId: newRef('plan'), lane, title: t, appetite })
    setTitle('')
    setMsg(`“${t}” is the live plan for ${lane} — its predecessor is history, not deleted.`)
  }

  const record = () => {
    const t = adrTitle.trim()
    if (!t) return
    const n = nextN
    wsAppend('adr.recorded', 'strategy', `ADR ${n} — ${t} · ${rev} · lane ${adrLane}`, { adrId: String(n), n, title: t, lane: adrLane, reversibility: rev })
    setAdrTitle('')
    setMsg(`ADR ${n} recorded — ${rev}. It is revisited only by an ADR that supersedes it.`)
  }

  return (
    <>
      <RoomHead title="One plan is live per lane. The rest are history." hint="the plans, the ADRs behind them, and the decisions that are now too expensive to revisit" right={<YoursBadge>strategy · adoptions persisted</YoursBadge>} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel
            title="Plans"
            hint="live = initiatives/<lane>/PLAN.md · history = the design-source plans and briefs"
            actions={<Chip>{live.length} live · {history.length} history</Chip>}
          >
            <div className="mb-3"><PickRow options={TABS} value={tab} onPick={setTab} small /></div>
            <div className="space-y-2">
              {shown.map((r) => (
                <div key={r.planId} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', opacity: r.status === 'live' ? 1 : 0.75 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.lane}</span>
                    <Chip tone={r.status === 'live' ? 'cyan' : undefined}>{r.status}</Chip>
                    {r.kind === 'brief' && <Chip>brief</Chip>}
                    {r.appetite && <Chip>appetite {r.appetite}d</Chip>}
                    {r.seed ? <SimBadge>repo fact</SimBadge> : <YoursBadge>yours</YoursBadge>}
                  </div>
                  <div className="text-[13.5px] leading-[20px] mt-1.5 break-words" style={{ color: 'var(--text-1)' }}>{r.title}</div>
                  <div className="text-[11px] leading-[16px] mt-1 break-all" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.file || 'no file yet — adopted in this app; the PLAN.md lands with the lane’s next change'}{r.src ? ` · ${r.src}` : ''}</div>
                </div>
              ))}
              {!shown.length && <Empty icon={Books} title={`No ${tab} plans`} hint="the shelf is empty, and it says so" />}
            </div>
            {msg && <Note>{msg}</Note>}
          </HPanel>

          <HPanel title="Adopt a plan" hint="plan.adopted → the lane's previous live plan becomes history">
            <form
              className="grid grid-cols-1 gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                adopt()
              }}
            >
              <Field label="Lane"><PickRow options={LANES} value={lane} onPick={setLane} small /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <Field label="Title"><TextInput value={title} onChange={setTitle} placeholder="what this cycle proves, in one line" /></Field>
                <Field label="Appetite"><PickRow options={APPETITES} value={appetite} onPick={setAppetite} /></Field>
              </div>
              <div className="flex justify-end"><Btn tone="primary">Adopt →</Btn></div>
            </form>
          </HPanel>

          <HPanel title="Record an ADR" hint={`next number: ${nextN} · after the highest on disk and every ADR you recorded here`}>
            <form
              className="grid grid-cols-1 gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                record()
              }}
            >
              <Field label="Title"><TextInput value={adrTitle} onChange={setAdrTitle} placeholder="the decision, stated so it can be superseded" /></Field>
              <Field label="Lane"><PickRow options={LANES} value={adrLane} onPick={setAdrLane} small /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                <Field label="Reversibility"><PickRow options={REVERSIBILITY} value={rev} onPick={setRev} /></Field>
                <Btn tone="primary">Record ADR {nextN} →</Btn>
              </div>
            </form>
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--line-1)' }}>
              <SectionLabel>Your ADRs · {a.yours.length}</SectionLabel>
              {a.yours.map((r) => (
                <div key={r.id} className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 gap-y-1 py-2 text-[13px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <span className="tnum" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.n}</span>
                  <span className="min-w-0 break-words" style={{ color: 'var(--text-1)' }}>{r.title}</span>
                  <span className="text-[12px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>lane {r.lane}</span>
                  <RevChip v={r.reversibility} />
                </div>
              ))}
              {!a.yours.length && <div className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>none yet — the first one you record takes number {nextN}</div>}
            </div>
          </HPanel>

          <HPanel title="The trail" hint="plan.adopted · adr.recorded — every adoption and every ADR is a receipt">
            <div className="-mx-2">
              {trail.map((e) => (
                <EventRow key={e.id} e={e} onReceipt={setReceipt} />
              ))}
            </div>
            {!trail.length && <div className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>nothing yet — the plans above are read straight from the repo</div>}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="ADRs" hint={FACTS.strategy.adrs ? FACTS.strategy.adrs.dir : 'docs/adr'}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="min-w-0">
                <div className="text-[24px] leading-[28px] tracking-[-0.01em] truncate" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{a.count == null ? '—' : a.count}</div>
                <div className="text-[12px] leading-[16px] mt-1" style={{ color: 'var(--text-3)' }}>{a.count == null ? 'count not read' : 'on disk'}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[24px] leading-[28px] tracking-[-0.01em] truncate" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{a.highest == null ? '—' : a.highest}</div>
                <div className="text-[12px] leading-[16px] mt-1" style={{ color: 'var(--text-3)' }}>highest</div>
              </div>
            </div>
            <SectionLabel>Recent</SectionLabel>
            {a.recent.slice(0, 5).map((r) => (
              <div key={r.adrId} className="grid grid-cols-[auto_1fr] gap-3 py-2 text-[13px] leading-[19px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)' }}>
                <span className="tnum" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.n}</span>
                <span className="min-w-0 break-words" style={{ color: 'var(--text-2)' }}>{r.title.replace(/^ADR \d+ — /, '')}</span>
              </div>
            ))}
            {!a.recent.length && <div className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>no ADRs read from disk</div>}
          </HPanel>

          <HPanel title="Records" hint={FACTS.strategy.dir}>
            <div className="space-y-1 text-[11.5px] leading-[17px]" style={{ fontFamily: MONO }}>
              {(FACTS.strategy.records || []).map((f) => <div key={f} className="break-all" style={{ color: 'var(--text-2)' }}>{FACTS.strategy.dir}/records/{f}</div>)}
              {(FACTS.strategy.listing || []).map((f) => <div key={f} className="break-all" style={{ color: 'var(--text-3)' }}>{FACTS.strategy.dir}/{f}</div>)}
              {!(FACTS.strategy.records || []).length && !(FACTS.strategy.listing || []).length && <div style={{ color: 'var(--text-3)' }}>the strategy dir was not read</div>}
            </div>
          </HPanel>

          <HPanel title="Too expensive to revisit">
            <div className="text-[13.5px] leading-[21px] space-y-2 max-w-[72ch]" style={{ color: 'var(--text-2)' }}>
              <p>A decision with a one-way reversibility note is revisited only by a new ADR that supersedes it — never edited. The old number keeps its text; the new number carries the reason.</p>
              <p>An adopted plan retires its predecessor to history. It does not delete it: the shelf is the record of what the lane once believed.</p>
            </div>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}

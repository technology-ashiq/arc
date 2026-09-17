// REVIEW · SHIP — "Every gate blocks by default."
// Seven gates from arc.gates.yaml, a strictness profile that switches the
// whole set as one, and a review ledger keyed by HEAD: a new commit is a
// new review. Every mode change, profile switch, review, qa and ship here
// is an appended receipt — loosening anything asks you to say why.
import { useState } from 'react'
import { GitCommit } from '@phosphor-icons/react'
import { FONT, UI, MONO, COLOR, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { gatesState, wsAppend, newRef } from '../../spine/workspace.js'
import { profile, shipRuns } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'

const ROOM = 'review-ship'
const MODES = ['block', 'warn', 'off', 'profile']
const MODE_RANK = { block: 3, profile: 2, warn: 1, off: 0 }
const MODE_TONE = { block: 'red', warn: 'amber', off: undefined, profile: 'cyan' }
const TRAIL_KINDS = new Set(['gate.changed', 'profile.switched', 'review.completed', 'qa.completed', 'ship.completed'])
const hash = (s, seed = 7) => [...(s || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, seed)
const RS = FACTS.reviewShip

function ModeChip({ mode }) {
  return <Chip tone={MODE_TONE[mode]} mono>{mode}</Chip>
}

function ReasonBox({ label, value, onChange, onConfirm, onCancel }) {
  return (
    <form className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end" onSubmit={(e) => { e.preventDefault(); onConfirm() }}>
      <Field label={label}><TextInput value={value} onChange={onChange} placeholder="why — required, it goes in the receipt" autoFocus /></Field>
      <Btn small tone="primary" onClick={onConfirm}>Record →</Btn>
      <Btn small onClick={onCancel}>Cancel</Btn>
    </form>
  )
}

export default function ReviewShip() {
  useSpine()
  const [pendingGate, setPendingGate] = useState(null) // { name, from, to }
  const [pendingProfile, setPendingProfile] = useState(null) // { from, to }
  const [reason, setReason] = useState('')
  const [summary, setSummary] = useState('')
  const [sha, setSha] = useState(() => newRef('sha').slice(-6))
  const [refusal, setRefusal] = useState(null) // { sha, text }
  const [msg, setMsg] = useState(null)

  const gates = gatesState().map((g) => ({ ...g, ...(RS.gates.find((f) => f.name === g.name) || {}), mode: g.mode, changed: g.changed }))
  const prof = profile()
  const runs = shipRuns()
  const summaryOf = (s) => (spine.events.find((e) => e.kind === 'review.completed' && e.module === ROOM && e.payload && e.payload.sha === s) || { payload: {} }).payload.summary || '(no summary)'
  const trail = spine.events.filter((e) => e.module === ROOM && TRAIL_KINDS.has(e.kind)).slice(-8).reverse()
  const blocking = gates.filter((g) => g.mode === 'block').length
  const shipped = runs.filter((r) => r.shipped).length

  const commitGate = (name, from, to, why) => {
    wsAppend('gate.changed', ROOM, `gate ${name}: ${from} → ${to}${to === 'off' ? ' · loosened — say why in the receipt' : ''}`, why ? { name, mode: to, from, reason: why } : { name, mode: to, from })
    setPendingGate(null)
    setReason('')
    setMsg(`gate ${name} is now ${to} — a receipt, not a setting`)
  }
  const pickMode = (g, to) => {
    if (to === g.mode) return
    if (MODE_RANK[to] < MODE_RANK[g.mode]) {
      setPendingGate({ name: g.name, from: g.mode, to })
      setReason('')
      return
    }
    commitGate(g.name, g.mode, to)
  }
  const commitProfile = (from, to, why) => {
    wsAppend('profile.switched', ROOM, `profile ${from} → ${to} · the whole gate set switches as one`, why ? { from, to, reason: why } : { from, to })
    setPendingProfile(null)
    setReason('')
    setMsg(`profile ${to} — every gate now resolves through it`)
  }
  const pickProfile = (to) => {
    if (to === prof.name) return
    if (prof.valid.indexOf(to) < prof.valid.indexOf(prof.name)) {
      setPendingProfile({ from: prof.name, to })
      setReason('')
      return
    }
    commitProfile(prof.name, to)
  }

  const review = () => {
    const s = summary.trim()
    if (!s) return
    const verdict = hash(s) % 10 < 7 ? 'ship' : 'fix-first'
    wsAppend('review.completed', ROOM, `review ${sha} — ${verdict} · scanner sweep + 4 judgment passes · ledger keyed by HEAD`, { sha, review: 'code', verdict, summary: s, gates: gatesState().map((g) => g.name + ':' + g.mode) })
    setSummary('')
    setSha(newRef('sha').slice(-6))
    setMsg(`review ${sha} → ${verdict} · written to .claude/state/reviews/${sha}.txt`)
  }
  const qa = (r) => {
    const verdict = hash(r.sha, 3) % 5 === 0 ? 'fail' : 'pass'
    wsAppend('qa.completed', ROOM, `qa ${r.sha} — ${verdict} · browser flows driven, regression test per fix`, { sha: r.sha, verdict })
  }
  const shipBlock = (r) => {
    if (r.verdict !== 'ship') return `review verdict is ${r.verdict}`
    if (r.qa !== 'pass') return r.qa ? `qa ${r.qa}` : 'qa has not run'
    const noEvidence = gates.filter((g) => g.mode === 'block' && !g.evidence).map((g) => g.name)
    return noEvidence.length ? `block gate without evidence: ${noEvidence.join(', ')}` : null
  }
  const ship = (r) => {
    const why = shipBlock(r)
    if (why) {
      setRefusal({ sha: r.sha, text: `red code physically cannot ship — ${why}` })
      return
    }
    wsAppend('ship.completed', ROOM, `ship ${r.sha} — deployed · deploy-guard re-ran tests + gates`, { sha: r.sha, outcome: 'deployed · deploy-guard re-ran tests + gates' })
    setRefusal(null)
  }

  return (
    <>
      <RoomHead title="Every gate blocks by default." hint="seven gates, commit-keyed — a new commit is a new review, and a profile switches the whole set as one" right={<YoursBadge>review · ship — receipts persisted</YoursBadge>} />

      <KpiStrip
        items={[
          { v: gates.length, l: 'Gates', sub: 'arc.gates.yaml' },
          { v: blocking, l: 'Blocking by default', sub: `${gates.length - blocking} resolve softer` },
          { v: prof.name, l: 'Profile', sub: prof.changed ? 'switched by you' : 'resolver default' },
          { v: runs.length, l: 'Commits reviewed', sub: 'ledger keyed by HEAD' },
          { v: shipped, l: 'Shipped', sub: shipped ? 'deploy-guard re-ran gates' : 'nothing deployed yet' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="Gates" hint="arc.gates.yaml · hook tier, <30s budget · a mode change is a receipt; loosening needs a reason">
            <div className="space-y-2.5">
              {gates.map((g) => (
                <div key={g.name} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                    <b className="text-[13.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{g.name}</b>
                    <ModeChip mode={g.mode} />
                    <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{g.tier} · &lt;30s budget</span>
                    {g.changed ? <YoursBadge>yours</YoursBadge> : <SimBadge>{g.src || 'repo fact'}</SimBadge>}
                  </div>
                  <div className="grid grid-cols-[64px_1fr] gap-x-2 text-[12px] leading-[18px] mb-2.5">
                    <span style={{ fontFamily: UI, color: 'var(--text-3)' }}>evidence</span>
                    <span className="truncate" style={{ fontFamily: MONO, color: g.evidence ? 'var(--text-2)' : COLOR.red }}>{g.evidence || 'ABSENT'}</span>
                    <span style={{ fontFamily: UI, color: 'var(--text-3)' }}>check</span>
                    <span className="truncate" style={{ fontFamily: MONO, color: 'var(--text-2)' }} title={g.check}>{g.check || 'not declared'}</span>
                  </div>
                  <PickRow options={MODES} value={g.mode} onPick={(to) => pickMode(g, to)} small />
                  {pendingGate && pendingGate.name === g.name && (
                    <ReasonBox label={`loosening ${g.name}: ${pendingGate.from} → ${pendingGate.to} — reason`} value={reason} onChange={setReason} onConfirm={() => reason.trim() && commitGate(g.name, pendingGate.from, pendingGate.to, reason.trim())} onCancel={() => setPendingGate(null)} />
                  )}
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="Profile" hint="one name switches the gate set as one · switching down needs a reason">
            <div className="flex items-center gap-3 flex-wrap mb-1.5">
              <span className="text-[24px] leading-[28px] tracking-[-0.01em]" style={{ fontFamily: FONT, fontWeight: 600, color: 'var(--text-1)' }}>{prof.name}</span>
              {prof.changed ? <YoursBadge>switched by you</YoursBadge> : <SimBadge>resolver default</SimBadge>}
            </div>
            <div className="text-[12px] leading-[18px] mb-3 break-words" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>
              {prof.row ? `gateMode ${prof.row.gateMode} · requiredReviews ${prof.row.requiredReviews.length ? prof.row.requiredReviews.join(', ') : 'none'}` : 'no row for this profile in arc-profile.sh'}
            </div>
            <PickRow options={prof.valid} value={prof.name} onPick={pickProfile} />
            {pendingProfile && (
              <ReasonBox label={`switching down ${pendingProfile.from} → ${pendingProfile.to} — reason`} value={reason} onChange={setReason} onConfirm={() => reason.trim() && commitProfile(pendingProfile.from, pendingProfile.to, reason.trim())} onCancel={() => setPendingProfile(null)} />
            )}
          </HPanel>

          <HPanel title="Review a commit" hint="review.completed → the ledger row for this sha · qa → ship, in that order">
            <form className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end mb-2" onSubmit={(e) => { e.preventDefault(); review() }}>
              <Field label={`Summary — next sha ${sha}`}><TextInput value={summary} onChange={setSummary} placeholder="what the diff does, one line" /></Field>
              <Btn tone="primary" onClick={review}>Review →</Btn>
            </form>
            <div className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
              sha <span style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{sha}</span> · verdict comes from the review, not from you
            </div>
            {msg && <div className="mt-3 text-[12.5px] leading-[19px] break-words" style={{ fontFamily: UI, color: COLOR.green }}>{msg}</div>}
          </HPanel>

          <HPanel title="Runs" hint="sha · verdict · qa · shipped — every column is a fold over receipts" actions={<Chip>{runs.length} reviewed</Chip>}>
            {runs.length === 0 && <Empty icon={GitCommit} title="No commit reviewed yet" hint="The ledger is empty, honestly. Review a commit above and its row lands here." />}
            <div className="space-y-2.5">
              {runs.map((r) => {
                const blocked = shipBlock(r)
                return (
                  <div key={r.sha} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                    <div className="flex items-baseline gap-3 flex-wrap mb-1.5">
                      <b className="text-[13.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.sha}</b>
                      <span className="text-[13px] min-w-0 flex-1 truncate" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{summaryOf(r.sha)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Chip tone={r.verdict === 'ship' ? 'green' : 'amber'} mono>{r.verdict}</Chip>
                      <Chip tone={r.qa === 'pass' ? 'green' : r.qa === 'fail' ? 'red' : undefined} mono>qa {r.qa || 'not run'}</Chip>
                      <Chip tone={r.shipped ? 'green' : undefined}>{r.shipped ? 'shipped' : 'not shipped'}</Chip>
                      <YoursBadge>yours</YoursBadge>
                    </div>
                    <div className="text-[12px] leading-[18px] mb-2.5" style={{ fontFamily: UI, color: 'var(--text-3)' }}>a NEW commit resets the ledger → new code always requires re-review</div>
                    {!r.shipped && (
                      <div className="flex gap-2 flex-wrap">
                        {!r.qa && <Btn small onClick={() => qa(r)}>Run qa</Btn>}
                        <Btn small tone={blocked ? 'ghost' : 'green'} onClick={() => ship(r)}>Ship →</Btn>
                      </div>
                    )}
                    {refusal && refusal.sha === r.sha && !r.shipped && (
                      <div className="mt-2.5 text-[12.5px] leading-[19px] break-words" style={{ fontFamily: UI, fontWeight: 500, color: COLOR.red }}>{refusal.text}</div>
                    )}
                    {r.shipped && <div className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: COLOR.green }}>{r.outcome}</div>}
                  </div>
                )
              })}
            </div>
          </HPanel>

          <HPanel title="The trail" hint="gate · profile · review · qa · ship — last 8">
            {trail.length === 0 && <Empty title="Nothing changed here yet" hint="The seeds are the state. A gate change, a profile switch, a review, a qa run or a ship writes a line here." />}
            {trail.length > 0 && (
              <div className="-mx-2">
                {trail.map((e) => (
                  <div key={e.id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 px-2 py-2 text-[13px] leading-[20px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                    <span className="min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{e.text}</span>
                    <span className="text-[11px] shrink-0" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>⌗ {String(e.id).slice(-6)}</span>
                  </div>
                ))}
              </div>
            )}
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Profiles" hint={RS.profiles.resolver}>
            <div className="-mx-2">
              {RS.profiles.table.map((p) => (
                <div key={p.profile} className="grid grid-cols-[80px_1fr] gap-2 items-baseline px-2 py-2 text-[13px] leading-[19px] transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                  <span className="truncate" style={{ fontFamily: MONO, fontWeight: p.profile === prof.name ? 600 : 500, color: p.profile === prof.name ? COLOR.cyan : 'var(--text-1)' }}>{p.profile}</span>
                  <span className="min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{p.gateMode} · reviews {p.requiredReviews.length ? p.requiredReviews.join(', ') : 'none'}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[12px] leading-[18px] break-words" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{RS.profiles.order}</div>
          </HPanel>

          <HPanel title="The ledger is keyed by HEAD">
            <div className="text-[13px] leading-[20px] space-y-1.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              {RS.commitKeyed.statement.map((l) => <div key={l} className="break-words">{l}</div>)}
            </div>
            <div className="mt-3"><SimBadge>{RS.commitKeyed.literal.reason}</SimBadge></div>
          </HPanel>

          <HPanel title="Modes">
            <div className="text-[13px] leading-[20px] space-y-1.5" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <div className="break-words">{RS.modes}</div>
              {RS.profileMode.map((l) => <div key={l} className="break-words">{l}</div>)}
              <div className="break-words">{RS.tierBudget}</div>
            </div>
            <div className="flex gap-2 flex-wrap mt-3">{MODES.map((m) => <ModeChip key={m} mode={m} />)}</div>
          </HPanel>
        </div>
      </div>
    </>
  )
}

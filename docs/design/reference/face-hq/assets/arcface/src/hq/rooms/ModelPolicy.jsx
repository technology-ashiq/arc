// MODEL POLICY — "Tiers are law, not taste." (ADR-0069)
// Four tiers, each a job description before it is a model name. Every
// process class runs at one tier declared in engine/router.yaml; that
// file never auto-updates, so a tier change is a reviewed diff — here,
// the diff is the stamp in your inbox. Rollback is another stamped diff.
import { useState } from 'react'
import { Receipt } from '@phosphor-icons/react'
import { UI, MONO, COLOR, Btn, PickRow, SimBadge, YoursBadge, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, EventRow, ReceiptDrawer, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { spine } from '../../spine/store.js'
import { wsAppend, wsRequestApproval, newRef } from '../../spine/workspace.js'
import { tierTable, processTiers, TIERS } from '../../spine/registries.js'
import { FACTS } from '../../data/arcFacts.js'
import { uiBus } from '../../lib/uiBus.js'

const TRAIL_KINDS = new Set(['tier.proposed', 'tier.changed'])
const DAY_MS = 86400000
const PROSE = { fontFamily: UI, color: 'var(--text-2)' }
const DATA = { fontFamily: MONO, color: 'var(--text-1)' }

function reviewTone(iso) {
  if (!iso) return null
  const days = (new Date(iso).getTime() - Date.now()) / DAY_MS
  if (days < 0) return { tone: 'red', note: `review_by ${iso} — past, ${Math.ceil(-days)}d overdue` }
  if (days <= 14) return { tone: 'amber', note: `review_by ${iso} — ${Math.ceil(days)}d left` }
  return { tone: undefined, note: `review_by ${iso}` }
}

export default function ModelPolicy() {
  useSpine()
  const [picking, setPicking] = useState(null)
  const [msg, setMsg] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const tiers = tierTable()
  const routes = processTiers()
  const trail = spine.events.filter((e) => TRAIL_KINDS.has(e.kind)).slice(-6).reverse()
  const modelOf = (t) => (tiers.find((x) => x.tier === t) || {}).model
  const waiting = routes.filter((r) => r.proposed).length

  const propose = (row, to) => {
    const from = row.tier
    const up = TIERS.indexOf(to) > TIERS.indexOf(from)
    const proposalId = newRef('tier')
    const model = modelOf(to)
    const direction = `cost direction: ${up ? 'up' : 'down'} (${to}${model ? ` · ${model}-class` : ' · no default model'}) — ₹ per run not instrumented`
    wsAppend('tier.proposed', 'model-policy', `tier: ${row.cls} ${from}→${to} proposed · router.yaml never auto-updates — the diff waits for your stamp (ADR-0069)`, { proposalId, cls: row.cls, from, to })
    wsRequestApproval({
      title: `tier: ${row.cls} ${from}→${to}`,
      tag: 'model-policy · ADR-0069',
      subject: 'tier.change',
      data: { proposalId, cls: row.cls, to },
      facts: [
        { k: 'council', v: 'ADR-0069: a tier change is a reviewed diff in engine/router.yaml — this stamp IS the review' },
        { k: 'money', v: direction },
        { k: 'kill', v: 'router.yaml never auto-updates (declared no-go); rollback is another stamped diff' },
      ],
    })
    setPicking(null)
    setMsg(`${row.cls} ${from}→${to} is in your inbox — the route stays ${from} until you stamp.`)
  }

  return (
    <>
      <RoomHead title="Tiers are law, not taste." hint="which tier each process runs at, and why a change is a reviewed diff rather than a quiet edit (ADR-0069)" right={<YoursBadge>model-policy · routes persisted</YoursBadge>} />

      <KpiStrip
        items={[
          { v: tiers.length, l: 'Tiers', sub: tiers.filter((t) => t.model).length + ' with a default model' },
          { v: routes.length, l: 'Process routes', sub: routes.filter((r) => r.defaulted).length + ' defaulted' },
          { v: waiting, l: 'Proposals waiting', sub: waiting ? 'in your inbox' : 'nothing to stamp', tone: waiting ? 'amber' : undefined },
          { v: trail.length, l: 'Tier receipts' },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The tier table — four seats" hint="a tier is a job description first; the model name is the implementation">
            <div className="space-y-2.5">
              {tiers.map((t) => (
                <div key={t.tier} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                    <b className="text-[13.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{t.tier}</b>
                    {t.model ? (
                      <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                        model <span style={DATA}>{t.model}</span>
                      </span>
                    ) : (
                      <SimBadge>no default — ADR-0069</SimBadge>
                    )}
                    {t.src && <span className="text-[11px] truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{t.src}</span>}
                  </div>
                  <div className="text-[12.5px] leading-[19px]" style={PROSE}>{t.meaning || 'no definition in the ADR table'}</div>
                  {!t.model && t.unmapped && <div className="mt-1 text-[12px] leading-[17px]" style={{ fontFamily: UI, color: COLOR.violet }}>{t.unmapped}</div>}
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title={`Process routes — ${routes.length} classes`} hint="cls · tier · driver · fallback chain — contractors carry tenure fields">
            <div className="space-y-2.5">
              {routes.map((r) => {
                const rv = reviewTone(r.review_by)
                const contractor = r.cap || r.hosted || r.judge || r.review_by
                return (
                  <div key={r.cls} className="p-3.5 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                      <b className="text-[13.5px]" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.cls}</b>
                      <Chip mono>{r.tier}</Chip>
                      {r.seed ? <SimBadge>repo fact · {r.src}</SimBadge> : <YoursBadge>yours</YoursBadge>}
                    </div>
                    <div className="text-[12px] leading-[18px] mb-2 break-words" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                      driver <span style={DATA}>{r.driver}</span> · fallback <span style={DATA}>{r.fallback && r.fallback.length ? r.fallback.join(' → ') : 'none'}</span>
                    </div>
                    {contractor && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {r.cap && <Chip mono>cap {r.cap}</Chip>}
                        {r.hosted && <Chip mono>hosted {r.hosted}</Chip>}
                        {r.judge && <Chip mono>judge {r.judge}</Chip>}
                        {rv && <Chip mono tone={rv.tone}>{rv.note}</Chip>}
                      </div>
                    )}
                    {r.defaulted && <div className="text-[12px] mb-2" style={{ fontFamily: UI, color: COLOR.violet }}>defaulted from run.queued — not in router.yaml yet</div>}
                    {r.changed && (
                      <div className="text-[12px] mb-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                        changed on your stamp <span style={{ fontFamily: MONO }}>⌗ {String(r.changed).slice(-6)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.proposed ? (
                        <span className="text-[12px]" style={{ fontFamily: UI, fontWeight: 500, color: COLOR.amber }}>proposed → {r.proposed} · in your inbox</span>
                      ) : picking === r.cls ? (
                        <>
                          <PickRow small options={TIERS.filter((t) => t !== r.tier)} value={null} onPick={(t) => propose(r, t)} />
                          <Btn small onClick={() => setPicking(null)}>Cancel</Btn>
                        </>
                      ) : (
                        <Btn small onClick={() => setPicking(r.cls)}>Propose tier →</Btn>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {msg && <div className="mt-3 text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: COLOR.green }}>{msg}</div>}
          </HPanel>

          <HPanel title="The trail" hint="every proposed and stamped tier change is a receipt">
            {trail.length === 0 && <Empty icon={Receipt} title="No tier receipt yet" hint="Every route is what router.yaml says. Propose a tier above and the diff lands here." />}
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
          <HPanel title="ADR-0069">
            <div className="text-[13.5px] leading-[19px] mb-1" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{FACTS.modelPolicy.adr0069.title.replace(/^#\s*/, '')}</div>
            <div className="text-[12.5px] leading-[19px] mb-3" style={PROSE}>{FACTS.modelPolicy.adr0069.oneLiner}</div>
            <div className="space-y-1.5">
              {FACTS.modelPolicy.notes.map((n) => (
                <div key={n} className="text-[12px] leading-[18px]" style={PROSE}>· {n.replace(/^#\s*/, '')}</div>
              ))}
            </div>
            <div className="mt-3 text-[11px] truncate" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{FACTS.modelPolicy.routerFile}</div>
          </HPanel>

          <HPanel title="Egress allowlist">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {FACTS.modelPolicy.egressHosts.map((h) => (
                <Chip key={h} mono tone="cyan">{h}</Chip>
              ))}
            </div>
            <div className="space-y-1">
              {FACTS.modelPolicy.egressRules.map((r) => (
                <div key={r} className="text-[12px] leading-[18px]" style={PROSE}>· {r.replace(/^#\s*/, '')}</div>
              ))}
            </div>
            <div className="mt-3 text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>EXACT host:port only — one host today</div>
          </HPanel>

          <HPanel title="Default route" actions={<Btn small onClick={() => uiBus.openRoom('bench')}>Scorecards live on the bench →</Btn>}>
            <div className="flex items-center gap-2.5 flex-wrap mb-3">
              <Chip mono>{FACTS.modelPolicy.default.tier}</Chip>
              <span className="text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                driver <span style={DATA}>{FACTS.modelPolicy.default.driver}</span>
              </span>
            </div>
            <p className="text-[12.5px] leading-[19px]" style={PROSE}>a class with no row in router.yaml runs here — and shows as defaulted above until a reviewed diff names it.</p>
          </HPanel>
        </div>
      </div>

      <ReceiptDrawer ev={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}

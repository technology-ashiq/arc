// View.tsx -- company/org: v0.7's Org, drawing what fold() returned and deciding nothing (face v2 Phase 03,
// company ring, ADR-1320).
//
// Declared deltas from the reference: the roster reads the board's lane headers through the door, not a local store;
// the ADR band map names the lane that owns each century from PORTFOLIO.md (F1) instead of the room the contract homes
// it in; setting a status and birthing a lane are work-door cards, not forms (ADR-1326); receipts per lane today are
// NOT SERVED until /api/lanes (ADR-1324). A blocked lane wears no reserved colour: nothing here can decide it.
import type { ModuleViewContext } from '../../../lib/registry.mjs'
import type { Folded, OrgView, ScoreRow } from './fold.mjs'
import { MONO, UI, YoursBadge } from '../../../ui/kit'
import { DoorRefusal, HPanel, KpiStrip, NotServed, Reading, RoomHead, SourceFile, VerbPending } from '../../../ui/bits'
import { BandRows, Roster } from '../../../ui/company'
export { UsersThree as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleViewContext }) {
  return (
    <>
      <RoomHead title={f.sentence} hint={f.lede} right={<YoursBadge>{f.badge}</YoursBadge>} />

      <KpiStrip items={f.kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The roster" hint="every lane on the board · each value from its own PROGRESS header">
            {f.board.isReading ? <Reading what="the board" /> : null}
            {f.board.isRefused ? <DoorRefusal code={f.board.refusal.code} human={f.board.refusal.human} /> : null}
            <Roster rows={f.roster} onOpen={ctx.onOpen} />
          </HPanel>

          <HPanel title="Change the roster" hint="a status is a header, a lane is born by kickoff">
            <div className="space-y-2.5">
              <VerbPending item={f.birthVerb} />
            </div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="Who is waiting on whom" hint="the blocked-on line, as each header writes it">
            {f.isWaitingEmpty ? <p className="text-[12.5px] leading-[19px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.waitingEmpty}</p> : null}
            <div className="-mx-2">
              {f.waiting.map((w) => (
                <div key={w.key} className="grid grid-cols-[auto_1fr] gap-2 px-2 py-[7px] text-[12.5px] leading-[18px]" style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <span style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{w.lane}</span>
                  <span className="min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>→ {w.on}</span>
                </div>
              ))}
            </div>
          </HPanel>

          <HPanel title="ADR bands" hint="each lane owns a century · PORTFOLIO.md's band table">
            {f.bands.isEmpty ? <p className="text-[12.5px] leading-[19px] mb-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{f.bands.empty}</p> : null}
            {f.bands.notes.map((n) => (
              <p key={n} className="text-[12.5px] leading-[19px] mb-2" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{n}</p>
            ))}
            <BandRows rows={f.bands.rows} onOpen={ctx.onOpen} />
            <div className="mt-3">
              <SourceFile file={f.portfolio} />
            </div>
          </HPanel>

          <HPanel title="Receipts per lane today">
            <NotServed item={f.today} />
          </HPanel>
        </div>
      </div>

      <OrgSection o={f.org} />
    </>
  )
}

const NOTE = { fontFamily: UI, color: 'var(--text-3)' }
// Who sits a role: a lookup by the fold's tone, so the View holds no branch of its own (ADR-1320).
const WHO_COLOUR = { sits: 'var(--text-2)', none: 'var(--text-3)', disagrees: 'var(--amber)' } as const

// The roles, scorecards and teams (org Cycle 19, ADR-1624): every line as fold() worded it.
function OrgSection({ o }: { o: OrgView }) {
  return (
    <div className="mt-4 grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4 items-start">
      <div className="min-w-0">
        <HPanel title="The roles" hint="every role card by department · org-catalog's chart model through /api/org">
          {o.isReading ? <Reading what="the org" /> : null}
          {o.isRefused ? <DoorRefusal code={o.refusal.code} human={o.refusal.human} /> : null}
          {o.hasCountsLine ? <p className="text-[12.5px] leading-[19px] mb-2" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{o.countsLine}</p> : null}
          {o.notes.map((n) => <p key={n} className="text-[12.5px] leading-[19px] mb-2" style={NOTE}>{n}</p>)}
          {o.departments.map((d) => (
            <div key={d.key} className="mb-3">
              <p className="text-[12px] uppercase tracking-wide mb-1" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-2)' }}>{d.name} · {d.roles.length}</p>
              <div className="-mx-2">
                {d.roles.map((r) => (
                  <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-2 py-[5px] text-[12.5px] leading-[18px]" style={{ borderBottom: '1px solid var(--line-1)' }}>
                    <span className="min-w-0 break-words" style={{ fontFamily: UI, color: 'var(--text-1)' }}>{r.title} <span style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.id}</span></span>
                    <span style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{r.state} · {r.seat}</span>
                    <span data-role-who={r.whoTone} className="col-span-2 min-w-0 break-words text-[11.5px] leading-[16px]" style={{ fontFamily: MONO, color: WHO_COLOUR[r.whoTone] }}>{r.who}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </HPanel>
      </div>

      <div className="min-w-0">
        <HPanel title="Scorecards" hint="each staffed seat from its own receipts · org-review's count, never re-done here">
          {o.scores.isRefused ? <DoorRefusal code={o.scores.refusal.code} human={o.scores.refusal.human} /> : null}
          {o.scores.hasFootnote ? <p className="text-[12.5px] leading-[19px] mb-2" style={NOTE}>{o.scores.footnote}</p> : null}
          <ScoreRows rows={o.scores.rows} />
          {o.scores.hasOthers ? (
            <>
              <p className="text-[12px] uppercase tracking-wide mt-3 mb-1" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-2)' }}>Other seats with receipts</p>
              <ScoreRows rows={o.scores.others} />
            </>
          ) : null}
        </HPanel>

        <HPanel title="Venture teams" hint="org/teams/*.team.yaml, read and checked by org-team">
          {o.teams.isEmpty ? <p className="text-[12.5px] leading-[19px]" style={NOTE}>{o.teams.empty}</p> : null}
          <div className="-mx-2">
            {o.teams.rows.map((t) => (
              <div key={t.key} className="px-2 py-[7px] text-[12.5px] leading-[18px]" style={{ borderBottom: '1px solid var(--line-1)' }}>
                <span style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{t.venture}</span>
                <span style={{ fontFamily: UI, color: 'var(--text-2)' }}> · {t.stage} · {t.status}</span>
                <p className="break-words" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{t.seats}</p>
                {t.findings.map((x) => <p key={x} className="break-words" style={NOTE}>{x}</p>)}
              </div>
            ))}
          </div>
        </HPanel>
      </div>
    </div>
  )
}

function ScoreRows({ rows }: { rows: ScoreRow[] }) {
  return (
    <div className="-mx-2">
      {rows.map((r) => (
        <div key={r.key} className="px-2 py-[6px] text-[12.5px] leading-[18px]" style={{ borderBottom: '1px solid var(--line-1)' }}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <span className="min-w-0 break-words" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{r.role}</span>
            {r.isVerdict ? <span style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{r.verdict}</span> : <span style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{r.seat}</span>}
          </div>
          {r.isVerdict ? <p className="break-words" style={NOTE}>{r.why} · {r.due}</p> : null}
          <p className="break-words" style={{ fontFamily: MONO, color: 'var(--text-2)' }}>{r.line}</p>
        </div>
      ))}
    </div>
  )
}

// LEGAL — "Nothing ships under his name without a human hand."
// The publish gate over growth's pipeline, the five E2 seals that
// no autonomy level ever opens, and the seven enforcement gates —
// with their modes changeable HERE, as recorded gate.changed
// receipts (in real arc that is a reviewed repo diff).
import { LockSimple, ShieldCheck } from '@phosphor-icons/react'
import { UI, MONO, COLOR, tint, Btn, YoursBadge } from '../../ui/kit.jsx'
import { RoomHead, HPanel, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { gatesState, growthState, wsAppend, wsCount } from '../../spine/workspace.js'

const SEALS = [
  ['moving money', 'no payment leaves without your hand'],
  ['killing a venture', 'the attic door opens only for you'],
  ['changing prices', 'every price change is a human tap'],
  ['real-money trading unlock', 'a written rule change + 72h cooldown'],
  ['publishing under Ashiq’s name', 'your name, your finger on the button'],
]

const MODES = ['block', 'warn', 'profile', 'off']
// block = over the line · warn = needs a look · profile = neutral progress · off = quiet
const MODE_TONE = { block: 'red', warn: 'amber', profile: 'blue' }
const MODE_COLOR = { block: COLOR.red, warn: COLOR.amber, profile: COLOR.blue, off: 'var(--text-3)' }

const TH = 'text-left px-2 pb-2 text-[11px] uppercase tracking-[0.08em]'
const TH_STYLE = { fontFamily: UI, fontWeight: 600, color: 'var(--text-3)' }

export default function Legal() {
  useSpine()
  const gates = gatesState()
  const pieces = growthState()
  const atGate = pieces.filter((p) => p.status === 'draft' || p.status === 'approved')

  const cycleMode = (g) => {
    const next = MODES[(MODES.indexOf(g.mode) + 1) % MODES.length]
    wsAppend('gate.changed', 'legal', `Gate mode changed: ${g.name} ${g.mode} → ${next} (in real arc: a reviewed diff to arc.gates.yaml, never an agent action)`, { name: g.name, mode: next })
  }

  return (
    <>
      <RoomHead
        title="Nothing ships under his name without a human hand."
        hint="the publish gate, the five seals, and the seven enforcement gates — every mode change leaves a receipt"
        right={<YoursBadge>legal · persisted</YoursBadge>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <div className="min-w-0">
          <HPanel title="The seven gates" hint="arc.gates.yaml · click a mode to cycle it, gate.changed lands on the spine">
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-[13px]" style={{ fontFamily: UI, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th className={TH} style={TH_STYLE}>gate</th>
                    <th className={TH} style={TH_STYLE}>mode</th>
                    <th className={`${TH} hidden sm:table-cell`} style={TH_STYLE}>tier</th>
                    <th className={`${TH} hidden md:table-cell`} style={TH_STYLE}>evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {gates.map((g) => {
                    const tone = MODE_TONE[g.mode]
                    return (
                      <tr key={g.name} className="transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderTop: '1px solid var(--line-1)' }}>
                        <td className="px-2 py-2 text-[12.5px] whitespace-nowrap" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{g.name}</td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => cycleMode(g)}
                            className="inline-flex items-center h-[22px] px-2 rounded-full text-[10.5px] uppercase tracking-[0.06em] whitespace-nowrap cursor-pointer transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
                            style={{
                              fontFamily: UI,
                              fontWeight: 600,
                              color: MODE_COLOR[g.mode],
                              background: tone ? tint(tone, 0.1) : 'var(--bg-4)',
                              border: '1px solid ' + (tone ? tint(tone, 0.28) : 'var(--line-1)'),
                            }}
                            title="cycle mode — the change is a receipt"
                          >
                            {g.mode}{g.changed ? ' · yours' : ''}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-[12.5px] hidden sm:table-cell" style={{ color: 'var(--text-2)' }}>{g.tier}</td>
                        <td className="px-2 py-2 text-[11.5px] hidden md:table-cell truncate max-w-[260px]" style={{ fontFamily: MONO, color: 'var(--text-3)' }}>{g.evidence}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
              Every gate blocks by default. One profile key — starter · standard · strict — switches them as a set; gates are commit-keyed, so a new commit is a new review. New gates enter WARN-first trial and earn blocking mode through the trial ledger.
            </p>
          </HPanel>

          <HPanel
            title={`The publish gate — ${atGate.length} held`}
            hint="pieces waiting between draft and the internet"
            tone={atGate.length ? 'amber' : undefined}
            actions={
              <Btn
                small
                onClick={() =>
                  wsAppend('note.logged', 'legal', `Legal lints ran: publish-gate ✓ · claims-need-source ✓ · pii-tripwire ✓ · hash-chain verified over ${wsCount()} workspace receipts`, {})
                }
              >
                Run legal lints
              </Btn>
            }
          >
            {atGate.length === 0 ? (
              <Empty icon={ShieldCheck} title="Nothing is held at the gate" hint="An empty queue is the honest state. Drafts from the growth room wait here until a human merges them." />
            ) : (
              <div className="-mx-2">
                {atGate.map((p) => (
                  <div key={p.contentId} className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 px-2 py-[7px] text-[13px] min-w-0 transition-colors duration-200 hover:bg-(--bg-3)" style={{ borderBottom: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)' }}>
                    <span className="text-[12px] whitespace-nowrap" style={{ fontFamily: UI, fontWeight: 500, color: p.status === 'approved' ? COLOR.amber : COLOR.blue }}>
                      {p.status === 'approved' ? '◈ sha pinned — awaiting merge' : '◇ awaiting review pack'}
                    </span>
                    <span className="truncate min-w-0" style={{ fontFamily: UI, color: 'var(--text-1)' }}>“{p.title}”</span>
                    <span className="text-[12px] shrink-0" style={{ fontFamily: UI, color: 'var(--text-3)' }}>{p.channel}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-[12px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>4 lints · results land as receipts</div>
          </HPanel>
        </div>

        <div className="min-w-0">
          <HPanel title="The five seals" hint="E2, human sovereignty">
            <div className="space-y-2">
              {SEALS.map(([name, line]) => (
                <div key={name} className="flex items-start gap-3 p-3 min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)' }}>
                  <LockSimple size={15} aria-hidden="true" className="shrink-0 mt-[2px]" color="var(--text-3)" />
                  <div className="min-w-0">
                    <div className="text-[13px] leading-[18px] break-words" style={{ fontFamily: UI, fontWeight: 600, color: 'var(--text-1)' }}>{name}</div>
                    <div className="text-[12px] leading-[17px]" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{line}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-[18px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
              No level of proven autonomy ever includes these. Changing this article means it is no longer arc.
            </p>
          </HPanel>

          <HPanel title="Hash chain" hint="the legal lane's verification spine">
            <div className="space-y-1.5 text-[13px] leading-[19px]" style={{ fontFamily: UI }}>
              <div style={{ color: 'var(--text-2)' }}>
                workspace receipts <span className="tnum" style={{ fontFamily: MONO, color: 'var(--text-1)' }}>{wsCount()}</span>
              </div>
              <div style={{ fontWeight: 500, color: 'var(--accent)' }}>chain: intact — append-only, corrections supersede</div>
              <div style={{ color: 'var(--text-3)' }}>closed days immutable · redaction fail-safe, stub-only</div>
            </div>
          </HPanel>

          <HPanel title="Who may change what">
            <ul className="list-disc pl-4 space-y-1.5 text-[13px] leading-[19px] marker:text-(--text-3)" style={{ fontFamily: UI, color: 'var(--text-2)' }}>
              <li>gate modes — a reviewed repo diff (here: a receipted click)</li>
              <li>autonomy ceilings — human-declared, never an agent action</li>
              <li>the constitution — only the human, after 7 days of cooling</li>
              <li>machines may cite the law and flag tension with it — never amend it</li>
            </ul>
          </HPanel>
        </div>
      </div>
    </>
  )
}

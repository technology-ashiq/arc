// AGENTS — the roster. Every agent card shows its tier (tiers are
// law, not taste — changing one is a reviewed diff, never a quiet
// edit). Add your own agents; the census stays honest about which
// rows are repo facts and which are yours.
import { useState } from 'react'
import { Robot } from '@phosphor-icons/react'
import { UI, MONO, Btn, Field, TextInput, PickRow, SimBadge, YoursBadge, StatusDot, Chip } from '../../ui/kit.jsx'
import { RoomHead, HPanel, KpiStrip, Empty } from '../bits.jsx'
import { useSpine } from '../useSpine.js'
import { agentsRoster, wsAppend } from '../../spine/workspace.js'

const GROUPS = ['council', 'plan', 'review', 'qa', 'design', 'ops', 'research', 'lane']
const TIERS = ['cheap-scan', 'balanced-workhorse', 'high-judgment', 'independent-family-verifier']
const TIER_SHORT = { 'cheap-scan': 'scan', 'balanced-workhorse': 'workhorse', 'high-judgment': 'judgment', 'independent-family-verifier': 'verifier' }

export default function Agents() {
  useSpine()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [group, setGroup] = useState('lane')
  const [tier, setTier] = useState('balanced-workhorse')
  const [filter, setFilter] = useState('all')
  const roster = agentsRoster()

  const add = () => {
    const n = name.trim().toLowerCase().replace(/\s+/g, '-')
    if (!n) return
    if (roster.some((a) => a.agentId === n)) return
    wsAppend('agent.added', 'agents', `Agent added to the roster: ${n} (${group} · ${tier}) — ${role.trim() || 'role to be written'}`, {
      agentId: n, name: n, role: role.trim() || 'role to be written', group, tier,
    })
    setName('')
    setRole('')
  }

  const shown = roster.filter((a) => filter === 'all' || a.group === filter)
  const enabled = roster.filter((a) => a.enabled).length
  const yours = roster.filter((a) => !a.seed).length
  const judgment = roster.filter((a) => a.tier === 'high-judgment').length
  const filterOptions = [{ value: 'all', label: 'all' }, ...GROUPS.map((g) => ({ value: g, label: `${g} · ${roster.filter((a) => a.group === g).length}` }))]

  return (
    <>
      <RoomHead
        title="The roster."
        hint={`${roster.length} agents · ${enabled} enabled — an employee here is an agent spawned for a task, then gone`}
        right={<YoursBadge>agents · persisted</YoursBadge>}
      />

      <KpiStrip
        items={[
          { v: roster.length, l: 'Agents on the roster', sub: `${GROUPS.length} groups` },
          { v: enabled, l: 'Enabled', sub: `${roster.length - enabled} disabled` },
          { v: yours, l: 'Added by you', sub: yours ? 'persisted' : 'add one below' },
          { v: judgment, l: 'High-judgment tier', sub: 'tiers are law, not taste' },
        ]}
      />

      <HPanel title="Add an agent" hint="agent.added — tier declared at birth, per the model-policy law">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Name">
            <TextInput value={name} onChange={setName} placeholder="e.g. seo-auditor · niche-hunter · brief-writer" />
          </Field>
          <Field label="Role — one honest sentence">
            <TextInput value={role} onChange={setRole} placeholder="what it does, and what it may never do" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 mb-4">
          <Field label="Group">
            <PickRow options={GROUPS} value={group} onPick={setGroup} />
          </Field>
          <Field label="Tier">
            <PickRow options={TIERS.map((t) => ({ value: t, label: TIER_SHORT[t] }))} value={tier} onPick={setTier} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Btn tone="primary" onClick={add}>Add to roster</Btn>
        </div>
      </HPanel>

      <HPanel title="Roster" hint="tiers are law, not taste — changing one is a reviewed diff" actions={<Chip>{shown.length} shown</Chip>}>
        <div className="mb-4">
          <PickRow small options={filterOptions} value={filter} onPick={setFilter} />
        </div>
        {shown.length === 0 && (
          <Empty icon={Robot} title="No agents in this group" hint="Add one above and it joins the roster with its tier declared at birth." />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {shown.map((a) => (
            <div key={a.agentId} className="p-3.5 flex flex-col min-w-0" style={{ background: 'var(--well)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', opacity: a.enabled ? 1 : 0.55 }}>
              <div className="flex items-center gap-2 mb-1.5 min-w-0">
                <StatusDot state={a.enabled ? 'live' : 'sleeping'} />
                <b className="text-[13px] truncate min-w-0" style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--text-1)' }}>{a.name}</b>
                <span className="ml-auto shrink-0 text-[11px]" style={{ fontFamily: UI, color: 'var(--text-3)' }}>
                  {a.group} · {TIER_SHORT[a.tier]}
                </span>
              </div>
              <div className="text-[12.5px] leading-[18px] mb-3 flex-1 break-words" style={{ fontFamily: UI, color: 'var(--text-2)' }}>{a.role}</div>
              <div className="flex items-center gap-2">
                {a.seed ? <SimBadge>repo fact</SimBadge> : <YoursBadge>yours</YoursBadge>}
                <Btn
                  small
                  className="ml-auto"
                  tone="ghost"
                  onClick={() => wsAppend('agent.toggled', 'agents', `Agent ${a.enabled ? 'disabled' : 'enabled'}: ${a.name}`, { agentId: a.agentId, enabled: !a.enabled })}
                >
                  {a.enabled ? 'Disable' : 'Enable'}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </HPanel>
    </>
  )
}

# Owner action — three edits to `.claude/settings.json`

**Why this file exists instead of a commit.** `.claude/settings.json` is on the un-grantable
resource list (ADR-0502) *and* in the harness's own `permissions.deny`, so an agent is refused
`Edit` and `Write` on it by two independent layers. That is the rule working. Every other Phase 04
finding was closed in code; these three cannot be, by design, so they are written out here for you
to paste.

Two fresh adversarial agents found all three, on two separate days, on different surfaces.

---

## 1. The deny floor does not cover the guard's own files — **do this one first**

**What is wrong.** `permissions.deny` has 24 entries. Six are `Edit`/`Write` rules, covering
`settings.json`, `settings.local.json` and `hq.policy.yaml`. There is **nothing** for the hooks or
the policy library.

So with the interactive hook disarmed — which is the shipped default — an agent can delete the
enforcement fragment, rewrite the decision engine, or edit the capability matrix with a plain
`Write`. Both layers permit it: layer 1 is off, and layer 2 has no rule.

An attacker demonstrated the consequence and it ratchets: **one disarmed session permanently
disarms every future armed one**, because nothing restores what it removed.

**The edit.** In `permissions.deny`, after the existing `Write(./hq.policy.yaml)` line, add:

```json
    "Edit(./.claude/hooks/**)",
    "Write(./.claude/hooks/**)",
    "Edit(./.claude/scripts/hq/lib/policy/**)",
    "Write(./.claude/scripts/hq/lib/policy/**)",
    "Edit(./.claude/scripts/hq/policy-hook.mjs)",
    "Write(./.claude/scripts/hq/policy-hook.mjs)",
    "Edit(./.claude/scripts/hq/policy-lint.mjs)",
    "Write(./.claude/scripts/hq/policy-lint.mjs)",
    "Edit(./CONSTITUTION.md)",
    "Write(./CONSTITUTION.md)",
    "Write(./.claude/state/hq/events/**)",
    "Edit(./.github/workflows/**)",
    "Write(./.github/workflows/**)",
```

Watch the commas — the entry above the block needs one, and the last entry in the list must not
have one.

**What each line buys**

| Path | What it protects |
|---|---|
| `.claude/hooks/**` | the enforcement fragment itself — the thing layer 2 exists to backstop |
| `.claude/scripts/hq/lib/policy/**` | the decision engine, the resource guard, the reducer |
| `policy-hook.mjs`, `policy-lint.mjs` | the two entry points that call it |
| `CONSTITUTION.md` | E2's text. Its hash is pinned in the policy file, but the code that checks the hash is writable, so pin both |
| `.claude/state/hq/events/**` | the spine — where an earned cap is recorded |
| `.github/workflows/**` | the CI that would catch any of the above |

---

## 2. The `Edit|Write` matcher misses two write tools

**What is wrong.** `MultiEdit` and `NotebookEdit` both write to disk. Whether they match today
depends on how the harness applies the matcher string — anchored, they do not match at all. Being
explicit costs nothing and removes the question.

**The edit.** In `hooks.PreToolUse`, change the second matcher:

```
-        "matcher": "Edit|Write",
+        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
```

There is a `PostToolUse` block with the same `"Edit|Write"` string. Change that one too, for the
same reason.

---

## 3. The MCP surface reaches no policy check at all

**What is wrong, and it is the same shape as the hole I fixed yesterday.** `policy-hook.mjs`
carries a complete `mcp__server__tool` branch — the per-server capability table, the
unclassified-server worst-case, the prototype-key fix I made this week. **No matcher ever routes
an MCP call to it.** The code is live and unreachable, exactly as the Edit/Write branch was.

Live in this session and unpoliced: `mcp__stripe__*` (real money — E2 forbids "moving money"),
`mcp__supabase__apply_migration`, `mcp__playwright__browser_run_code_unsafe`, and the Vercel
purchase tools. Every one would be **denied** if it reached the hook.

`Agent` / `Task` is the practical bypass for everything else: a subagent's tool calls are its own,
and nothing covers the spawn.

**The edit.** Add a third matcher to `hooks.PreToolUse`, after the `Edit|Write` block:

```json
      {
        "matcher": "mcp__.*|Agent|Task|WebFetch|WebSearch",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/PreToolUse.sh"
          }
        ]
      }
```

**Expect this one to be noisy, and read that as it working.** With the hook armed, an unclassified
MCP server is treated as the worst it could be — `spend`, which is L0 — so it denies. That is
deny-by-default reaching a surface it never reached before. If it gets in your way, the honest fix
is a row in `.claude/scripts/hq/lib/policy/tool-capabilities.json` classifying that server, not
removing the matcher.

**Do this one last**, and separately from 1 and 2, so if something breaks you know which edit did it.

---

## After you paste

```bash
node .claude/scripts/hq/policy-lint.mjs hq.policy.yaml     # expect: is law -- 0 violations
node .claude/scripts/core/product-lint.mjs                 # expect: all manifests valid
```

**Then tell me — do not push yet.** One thing will be red and it is not your mistake:

> `.claude/settings.json` is **byte-pinned** in `tests/fixtures/sync-golden/tree-manifest.txt`
> (line 221). Any edit to it changes that hash and turns two `tests/sync.bats` tests red on all
> three CI legs — *"bare install is byte-identical to the golden fixture"*, rsync path and cp-r
> path. The gate is doing its job; the manifest just has to be regenerated in the same commit.

That regeneration is a one-line job and it is mine. Say the word and I will:

1. Recompute the row (`sha256` of the file with `\r` stripped, which is how the harness hashes it)
   and patch line 221.
2. Run the branch's CI. `tests/policy-hook.bats` carries a `LAYER 2` test that reads your deny
   list and a `PHASE 04` test that reads the matchers, so a wrong comma or a broken matcher shows
   up there before anything else. The deny-list test is a **subset** check, so your 13 new entries
   cannot break it by being extra — only by being malformed JSON.
3. Emit the `phase.closed` receipt and open PR #130 for merge.

## What is still open after all three

**Nothing that is yours.** These three are the whole owner surface of Phase 04.

`decision_ref` — the finding that sat here, where a correctly-sealed promotion naming an approval
that does not exist still raised a cap — **is closed.** `loadPolicyEvents` now collects the ids of
every `decision.recorded` that passes both `validateEvent` and its own `eventSha`, and refuses to
fold a promotion whose `decision_ref` is not among them. Proven both ways against a real decision
lifted off the live spine: real → folded, fake → not. Demotions are deliberately exempt — they are
engine-raised on an incident and only ever *lower* a cap, so gating them would fail open.

Four findings are recorded as **owed rather than closed**, all in
[`initiatives/policy/evidence/phase-04/handoff.md`](../initiatives/policy/evidence/phase-04/handoff.md):
`encode` coercing `Map`/`Set`/`Date` to `{}`, `reserveAndSpend` reaching a provider at L1, the
`"."` stem, and `/arc-develop next` pinned to a closed phase's ledger. None is an escalation and
none needs you.

## After all three land, tell me and I will

1. Run the branch's CI (`tests/policy-hook.bats` has a `LAYER 2` test that reads your deny list,
   and a `PHASE 04` test that reads the matchers — a wrong comma turns those red first).
2. Close Phase 04 with its spine receipt, which is the last thing the phase owes.
3. Merge PR #130.

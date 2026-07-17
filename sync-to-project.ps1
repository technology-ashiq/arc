# sync-to-project.ps1 - push this template's machinery into an existing project.
# Usage (PowerShell, from anywhere):
#   & sync-to-project.ps1 -Target "E:\path\to\your-project"            # full suite
#   & sync-to-project.ps1 -Target "E:\path\to\your-project" -Products council,plan
#   & sync-to-project.ps1 -List                                        # list products
#
# Windows-native twin of sync-to-project.sh; keep the two in lockstep. The full
# suite is byte-identical to the pre-initiative behaviour; -Products drives the
# resolver (arc-products.mjs) for a selective install via its line protocol.
# Never touches:  CLAUDE.md, CLAUDE.local.md, settings.local.json, PLAN.md,
#   PROGRESS.md, phases\, docs\adr\, docs\reviews\, docs\session-log.md, app code,
#   .claude\state\, .claude\worktrees\ (transient git worktrees), .claude\scheduled_tasks.lock.
# NOTE: keep this file ASCII-only. PowerShell 5.1 misparses UTF-8 without BOM.

param(
  [string]$Target,
  [string]$Products = "",
  [switch]$List
)

$src = $PSScriptRoot
$resolver = Join-Path $src ".claude\scripts\arc-products.mjs"

# Council JUROR env contract: append the JUROR_* block from a source .env.example
# to the target's ONCE (sentinel present = already there). Shared by both paths.
function Add-JurorBlock($srcEnv, $sentinel) {
  if (-not (Test-Path $srcEnv)) { return }
  $tgtEnv = Join-Path $Target ".env.example"
  if ((Test-Path $tgtEnv) -and (Select-String -Path $tgtEnv -Pattern $sentinel -Quiet)) { return }
  $envLines = Get-Content $srcEnv
  $jbStart = ($envLines | Select-String -Pattern '^#.*juror|^JUROR_' | Select-Object -First 1).LineNumber
  $jbEnd   = ($envLines | Select-String -Pattern '^JUROR2?_[A-Z_]*=' | Select-Object -Last 1).LineNumber
  if ($jbStart -and $jbEnd -and $jbStart -le $jbEnd) {
    if ((Test-Path $tgtEnv) -and (Get-Item $tgtEnv).Length -gt 0) { Add-Content $tgtEnv "" }
    $envLines[($jbStart - 1)..($jbEnd - 1)] | Add-Content $tgtEnv
    Write-Host "Council: JUROR_* block appended to .env.example (keys go in the target's .env.local)."
  }
}

# ---- -List: names only, no target required ----
if ($List) {
  & node $resolver --list --root $src
  exit $LASTEXITCODE
}

if (-not $Target) { Write-Error "usage: sync-to-project.ps1 -Target <dir> [-Products a,b | -List]"; exit 2 }
if (-not (Test-Path $Target)) { Write-Error "Target folder not found: $Target"; exit 1 }
if (-not (Test-Path (Join-Path $Target ".git"))) {
  Write-Host "Note: target has no .git - is this really a project root?" -ForegroundColor Yellow
}

# ---- -Products: manifest-driven selective install ----
if ($Products) {
  $plan = @(& node $resolver --products $Products --root $src)
  if ($LASTEXITCODE -ne 0) { exit 2 }
  if ($plan.Count -lt 1 -or $plan[0] -ne "PROTO`t1") { Write-Error "unexpected resolver plan protocol"; exit 3 }
  foreach ($line in $plan) {
    $f = $line -split "`t"
    switch ($f[0]) {
      "PROTO" { }
      "MKDIR" { New-Item -ItemType Directory -Force -Path (Join-Path $Target $f[1]) | Out-Null }
      "COPY"  {
        $dest = Join-Path $Target $f[2]
        New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
        Copy-Item (Join-Path $src $f[1]) $dest -Force
      }
      "ENVBLOCK" { Add-JurorBlock (Join-Path $src $f[1]) $f[2] }
      default { Write-Error "unknown resolver plan verb: $($f[0])"; exit 3 }
    }
  }
  # arc-registry.json (REQ-08): the resolver emits the JSON, the twin writes it.
  # UTF8 WITHOUT BOM -- PowerShell 5.1's `-Encoding utf8` prepends a BOM that Node's
  # JSON.parse rejects; keep it byte-clean for the ledger / `/arc` readers.
  New-Item -ItemType Directory -Force -Path (Join-Path $Target ".claude") | Out-Null
  $regJson = (& node $resolver --registry --products $Products --root $src | Out-String -Width 4096)
  if ($LASTEXITCODE -ne 0) { Write-Error "registry generation failed"; exit 3 }
  [System.IO.File]::WriteAllText((Join-Path $Target ".claude\arc-registry.json"), $regJson, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Synced products [$Products] + core -> $Target" -ForegroundColor Green
  Write-Host "IMPORTANT: restart the Claude Code session in that project (commands load at session start)."
  exit 0
}

# ---- full (default): byte-identical to pre-initiative ----
# Machinery. Exclude the personal settings file + the scheduled-tasks runtime lock
# (/XF), and the per-project working state dir (/XD) -- none belong in a consumer
# repo. The .sh twin excludes all three; keep them in lockstep (REQ-04).
robocopy "$src\.claude" "$Target\.claude" /E /XF settings.local.json scheduled_tasks.lock /XD "$src\.claude\state" "$src\.claude\worktrees" /NFL /NDL /NJH /NJS | Out-Null

# Planning templates
robocopy "$src\docs\templates" "$Target\docs\templates" /E /NFL /NDL /NJH /NJS | Out-Null

# Meta docs (safe to overwrite - they describe the system, not your product)
New-Item -ItemType Directory -Force -Path "$Target\docs" | Out-Null
foreach ($f in @("blueprint.md", "how-it-works.md", "build-playbook.md", "product-runbook.md", "plugins.md", "usermanual.md")) {
  Copy-Item "$src\docs\$f" "$Target\docs\$f" -Force
}

# arc-council docs + sessions skeleton (the .claude council core already rode along above).
New-Item -ItemType Directory -Force -Path "$Target\docs\council\references", "$Target\docs\council\sessions\.juror" | Out-Null
if (Test-Path "$src\docs\council\README.md") { Copy-Item "$src\docs\council\README.md" "$Target\docs\council\README.md" -Force }
if (Test-Path "$src\docs\council\references\fairness.md") { Copy-Item "$src\docs\council\references\fairness.md" "$Target\docs\council\references\fairness.md" -Force }

Add-JurorBlock "$src\.env.example" '^JUROR_BASE_URL='

# arc-registry.json: bare install = every product (REQ-08). UTF8 no-BOM (see -Products path).
$regJson = (& node $resolver --registry --root $src | Out-String -Width 4096)
if ($LASTEXITCODE -ne 0) { Write-Error "registry generation failed"; exit 3 }
[System.IO.File]::WriteAllText((Join-Path $Target ".claude\arc-registry.json"), $regJson, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ""
Write-Host "Synced template -> $Target" -ForegroundColor Green
Write-Host "Untouched: CLAUDE.md, CLAUDE.local.md, settings.local.json, PLAN/PROGRESS/phases, adr, reviews, session-log, app code, docs/council/sessions."
Write-Host "IMPORTANT: restart the Claude Code session in that project (commands load at session start)."

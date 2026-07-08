# sync-to-project.ps1 - push this template's machinery into an existing project.
# Usage (PowerShell, from anywhere):
#   & "E:\Work_Hub\01_Automemory\Sample Structure\sync-to-project.ps1" -Target "E:\path\to\your-project"
#
# Syncs:   .claude\ (agents, commands, hooks, rules, output-styles, settings.json,
#          statusline), docs\templates\, and the meta docs (blueprint, how-it-works,
#          build-playbook, product-runbook, plugins, usermanual).
# Never touches:  CLAUDE.md, CLAUDE.local.md, settings.local.json, PLAN.md, PROGRESS.md,
#          phases\, docs\adr\, docs\reviews\, docs\session-log.md, your app code.
# NOTE: keep this file ASCII-only. PowerShell 5.1 misparses UTF-8 without BOM.

param([Parameter(Mandatory = $true)][string]$Target)

$src = $PSScriptRoot

if (-not (Test-Path $Target)) {
  Write-Error "Target folder not found: $Target"
  exit 1
}
if (-not (Test-Path (Join-Path $Target ".git"))) {
  Write-Host "Note: target has no .git - is this really a project root?" -ForegroundColor Yellow
}

# Machinery (never the personal settings file)
robocopy "$src\.claude" "$Target\.claude" /E /XF settings.local.json /NFL /NDL /NJH /NJS | Out-Null

# Planning templates
robocopy "$src\docs\templates" "$Target\docs\templates" /E /NFL /NDL /NJH /NJS | Out-Null

# Meta docs (safe to overwrite - they describe the system, not your product)
New-Item -ItemType Directory -Force -Path "$Target\docs" | Out-Null
foreach ($f in @("blueprint.md", "how-it-works.md", "build-playbook.md", "product-runbook.md", "plugins.md", "usermanual.md")) {
  Copy-Item "$src\docs\$f" "$Target\docs\$f" -Force
}

Write-Host ""
Write-Host "Synced template -> $Target" -ForegroundColor Green
Write-Host "Untouched: CLAUDE.md, CLAUDE.local.md, settings.local.json, PLAN/PROGRESS/phases, adr, reviews, session-log, app code."
Write-Host "IMPORTANT: restart the Claude Code session in that project (commands load at session start)."
